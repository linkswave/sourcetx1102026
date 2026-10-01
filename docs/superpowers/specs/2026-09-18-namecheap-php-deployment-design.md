# SourceTX — Namecheap Shared Hosting (PHP) Deployment

Date: 2026-09-18
Status: Approved design (user confirmed approach A, MySQL, PHP admin, PHP chat, cPanel SMTP, email-only forms)

## Goal

Deploy the SourceTX website to **Namecheap shared hosting (cPanel/Apache)** while preserving its
public features — static marketing pages, dynamic job listings, application/contact forms,
rule-based chat, and an admin review panel — using **PHP + MySQL** instead of the current
Node.js/Express server.

## Context and constraints

- Namecheap shared hosting cannot run the Node.js app (`server.js`). It supports Apache,
  PHP, and MySQL.
- The current site is 40 static HTML pages plus a Node API: `GET /api/jobs`, `POST /api/contact`,
  `POST /api/apply` (résumé upload), `POST /api/talent-request`, `POST /api/chat`,
  server-rendered `/jobs/:id` and `/apply/:id`, dynamic `/sitemap.xml`, and an admin SPA.
- Confirmed decisions:
  - **Approach A:** PHP overlay/back-end-for-frontend on top of the existing static HTML.
  - **Forms:** email only. No file uploads; the résumé file field becomes a résumé/LinkedIn link.
  - **Jobs:** data in MySQL, served by PHP; job and apply pages rendered server-side for SEO.
  - **Storage:** MySQL for jobs and all submissions.
  - **Admin:** PHP admin for submissions review + jobs management. The Node-only page/content
    file editors stay local and are **out of scope** on production.
  - **Chat:** port the rule-based `chatbot.js` logic to PHP using the existing `data/chatbot.json`.
  - **Email:** cPanel SMTP via PHPMailer.
- The Node app remains the development source of truth and is unchanged.

## Architecture

Two source trees feed one deployable:

- `public/` — the static site (unchanged, except the form field change in section 7).
- `php/` — the new PHP backend overlay.
- `scripts/build-php.js` — assembles `dist-php/` by copying `public/` then overlaying `php/`,
  copying data files, generating `schema.sql` and `.htaccess`, linting with `php -l`, and writing
  a deploy checklist.

Request flow on the host:

- Static asset or `*.html` exists -> Apache serves it directly.
- Matching dynamic URL -> `.htaccess` rewrite -> PHP entry point -> MySQL / PHPMailer -> JSON or HTML.

The frontend JavaScript continues to call the same URLs (`/api/jobs`, `/api/chat`, form actions),
so only the form field change and one status message change touch the client.

## File layout (`dist-php/` = document root)

```
index.html, about.html, services.html, ...      # from public/
css/  js/  pictures/  robots.txt
.htaccess                                       # generated rewrites
job.php                                         # SSR /jobs/<id>
apply.php                                       # SSR /apply/<id>
sitemap.php                                     # SSR /sitemap.xml
api/
  jobs.php  contact.php  apply.php  talent-request.php  chat.php
admin/
  index.php  api.php  export.php  login.php  logout.php
_app/                                           # protected by _app/.htaccess (deny all)
  .htaccess
  config.php                                    # server-only, not committed
  config.example.php
  lib/
    bootstrap.php   # PDO connection, JSON helpers, config load, error handling
    auth.php        # session login, CSRF, rate-limit guard
    jobs.php        # job read/write + JobPosting/BreadcrumbList builders
    submissions.php # submission listing, read/reply, CSV export
    chat.php        # PHP port of chatbot.js
    mailer.php      # PHPMailer wrapper (cPanel SMTP)
  sql/
    jobs.sql.fragment      # jobs table DDL; merged with storage.js TABLES into schema.sql
  data/
    chatbot.json           # copied from data/chatbot.json at build time
```

## Routing (`.htaccess`)

Real files and directories pass through first:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^jobs/?$                          jobs.html              [L]
RewriteRule ^jobs/([A-Za-z0-9._-]+)/?$        job.php?id=$1          [L,QSA]
RewriteRule ^apply/?$                         general-application.html [L]
RewriteRule ^apply/([A-Za-z0-9._-]+)/?$       apply.php?id=$1        [L,QSA]
RewriteRule ^sitemap\.xml$                    sitemap.php            [L]
RewriteRule ^api/jobs$                        api/jobs.php           [L,QSA]
RewriteRule ^api/contact$                     api/contact.php        [L,QSA]
RewriteRule ^api/apply$                       api/apply.php          [L,QSA]
RewriteRule ^api/talent-request$              api/talent-request.php [L,QSA]
RewriteRule ^api/chat$                        api/chat.php           [L,QSA]
RewriteRule ^admin/?$                         admin/index.php        [L,QSA]
RewriteRule ^admin/export/([a-z-]+)\.csv$     admin/export.php?kind=$1 [L,QSA]
RewriteRule ^api/admin/([A-Za-z0-9_/-]+)$     admin/api.php?route=$1 [L,QSA]
```

`_app/.htaccess` contains `Require all denied` (with a `Deny from all` fallback for older Apache).

## Database schema (MySQL)

Generated into `_app/sql/schema.sql`. Reuses the table definitions in `storage.js`, plus a `jobs`
table (the Node app stores jobs in JSON only).

- `jobs(id VARCHAR(64) PK, title, location, type, department, posted DATE, summary TEXT,
  description TEXT, responsibilities TEXT, requirements TEXT, skills TEXT, sourceUrl,
  source, lastRefreshed DATE, active TINYINT(1) DEFAULT 1, closedReason, closedAt DATETIME,
  createdAt, updatedAt)`
  - `responsibilities`, `requirements`, `skills` are JSON-encoded text.
- `applications(id CHAR(36) PK, submittedAt DATETIME, status, jobId, jobTitle, name, email, phone,
  location, linkedin, workAuthorization, message, resume, originalResumeName,
  isRead TINYINT(1) DEFAULT 0, replies TEXT)`
- `messages(id CHAR(36) PK, submittedAt DATETIME, status, name, email, phone, topic, message,
  isRead TINYINT(1) DEFAULT 0, replies TEXT)`
- `talent_requests(id CHAR(36) PK, submittedAt DATETIME, status, name, company, email, phone,
  service, targetDate, needs, isRead TINYINT(1) DEFAULT 0, replies TEXT)`
- `chat_captures(id CHAR(36) PK, submittedAt DATETIME, status, email, question, intent,
  isRead TINYINT(1) DEFAULT 0, replies TEXT)`
- Indexes on `jobs(active, posted)`, `applications(submittedAt)`, `messages(submittedAt)`,
  `talent_requests(submittedAt)`.
- All tables `utf8mb4`.
- The four submission tables reuse the exact DDL in `storage.js` `TABLES`, so the Node dev server and
  the PHP production build can share one database. Only the `jobs` table is new.

## API endpoints and response shapes

Shapes match the Node server so no client changes are required.

| Method | URL | Behavior | Response |
| --- | --- | --- | --- |
| GET | `/api/jobs` | Active jobs, newest first | JSON array of job objects |
| POST | `/api/contact` | Validate, insert `messages`, email admin | `{"ok":true,"message":"..."}` |
| POST | `/api/apply` | Validate, insert `applications`, email admin + applicant | `{"ok":true,"message":"..."}` |
| POST | `/api/talent-request` | Validate, insert `talent_requests`, email admin | `{"ok":true,"message":"..."}` |
| POST | `/api/chat` | Match intent, optionally capture email | `{"ok","reply","followups","fallback"}` (same keys as the Node server) |

- Validation errors return HTTP 400 with `{"ok":false,"message":"..."}`; the existing client reads
  `json.message` on failure and on success.
- `POST /api/apply` required fields: `name`, `email`, `phone`, `consent`, plus `jobId`. `resumeUrl`
  optional. File parts are ignored and never written to disk.
- All form posts are `multipart/form-data` (the client sends `FormData`); PHP reads `$_POST`.
- Output uses `header('Content-Type: application/json')` with `JSON_UNESCAPED_UNICODE`.

## Server-rendered job and apply pages

- `job.php?id=<id>`:
  - Serves the static `job-<id>.html` directly when it exists (featured jobs, matching the Node
    server). Otherwise loads the deployed `job-detail.html` as the template.
  - Looks up the job in MySQL. Missing or `active = 0` -> HTTP 404 with `404.html`.
  - Fills the template's existing element IDs (`jd-department`, `jd-title`, `jd-meta`, `jd-summary`,
    `jd-description`, `jd-responsibilities`, `jd-requirements`, `jd-skills`, apply links).
  - Sets `<title>`, meta description, canonical, `og:*`, `twitter:*`, and injects `JobPosting` and
    `BreadcrumbList` JSON-LD (port of `scripts/jobseo.js`), with `robots` set to `index,follow`.
  - `job-detail.js` remains as progressive enhancement and is idempotent.
- `apply.php?id=<id>`:
  - Serves the static `apply-<id>.html` directly when it exists; otherwise loads the deployed
    `apply-detail.html` and fills the hidden `apply-job-id`, `apply-title`, and `apply-meta`.
    Unknown id -> 404.
- `sitemap.php`:
  - Reads the deployed `public/sitemap.xml` and appends one `/jobs/<id>` URL per active job.
    Served as `application/xml`. The `.htaccess` routes `/sitemap.xml` to this script before the
    static-file pass-through so the static sitemap is never served on its own.

## Form changes (email only)

In the 8 apply pages and `apply-detail.html` / the generated apply template:

- Remove `enctype="multipart/form-data"` and the `<input type="file" name="resume" ...>`.
- Add `<label>Résumé or LinkedIn link<input type="url" name="resumeUrl" ...></label>`.
- Keep `name`, `email`, `phone`, `location`, `linkedin`, `workAuthorization`, `message`, `consent`.

In `public/js/app.js`:

- Replace the "Forms work after starting the included Node.js server..." message with a neutral
  fallback ("Please email info@sourcetx.com...").
- Keep the existing `data-ajax` submit and JSON response handling.

## Chat port

- `_app/lib/chat.php` ports `chatbot.js`: normalization, aliases, stopwords, keyword scoring,
  `CONFIDENCE_THRESHOLD = 0.6`, and the same fallback reply and follow-ups.
- Knowledge base read from `_app/data/chatbot.json`.
- When a chat message includes an email and no confident intent, insert a `chat_captures` row
  (parity with the Node behavior).

## Admin scope (PHP)

- `admin/index.php`: session login (single credential from `_app/config.php`, stored via
  `password_hash`), CSRF token on all writes, and a simple lockout after repeated failures.
- Tabs: **Applications**, **Messages**, **Talent Requests**, **Jobs**.
  - Submissions: list, view, mark read, reply (stores the reply in `replies` and emails the sender),
    CSV export via `admin/export.php`.
  - Jobs: add, edit, activate/deactivate.
- Reuses the existing `admin/admin.html` and `admin/admin.js` look and structure, mapping
  `/api/admin/*` to `admin/api.php`. `admin/index.php` injects
  `window.SOURCETX_PHP_ADMIN = true` and `window.SOURCETX_CSRF`, which hides the Node-only
  **Job Sync**, **Content**, and **Page Content** tabs, adds the CSRF header to writes, and renders
  the résumé cell as an external link instead of an `/uploads/...` path.
- Endpoints implemented: `GET /api/admin/jobs`, `POST /api/admin/jobs`, `PUT /api/admin/jobs/<id>`,
  `GET /api/admin/<kind>`, `POST /api/admin/<kind>/<id>/read`, `POST /api/admin/<kind>/<id>/reply`,
  `GET /admin/export/<kind>.csv`.

## Email

- PHPMailer vendored at `_app/lib/PHPMailer/`.
- `_app/lib/mailer.php` configures SMTP from `_app/config.php` (`smtpHost`, `smtpPort`,
  `smtpSecure`, `smtpUser`, `smtpPass`, `mailFrom`, `notifyEmail`).
- Sends an admin notification per submission and an applicant confirmation on `/api/apply`.
- No attachments.
- If `smtpHost` is empty, mail is skipped and the submission is still stored (parity with Node).

## Configuration and secrets

- `_app/config.example.php` (committed) with placeholders:
  `dbHost`, `dbPort`, `dbName`, `dbUser`, `dbPass`, `smtpHost`, `smtpPort`, `smtpSecure`,
  `smtpUser`, `smtpPass`, `mailFrom`, `notifyEmail`, `siteUrl`, `adminUser`, `adminPassHash`.
- `_app/config.php` is created on the server and is gitignored.
- Admin password hash generated with a documented one-liner:
  `php -r "echo password_hash('YOUR-PASSWORD', PASSWORD_DEFAULT);"`.

## Build

`scripts/build-php.js`:

1. Clean and create `dist-php/`.
2. Copy `public/` into `dist-php/`.
3. Copy `php/` into `dist-php/`, mapping `php/_app`, `php/api`, `php/admin`, and the root PHP
   entry points to their deploy paths; skip `config.php` and `htaccess-deny`.
4. Copy `admin/admin.html` and `admin/admin.js` into `dist-php/admin/`.
5. Copy `data/chatbot.json` -> `dist-php/_app/data/chatbot.json`.
6. Generate `dist-php/.htaccess` and `dist-php/_app/.htaccess`.
7. Generate `dist-php/_app/sql/schema.sql` from `storage.js` `TABLES` plus `jobs.sql.fragment`.
8. Run `php -l` on every PHP file when PHP is available; fail the build on syntax errors.
9. Write `dist-php/DEPLOY.md` and produce `dist-php.zip` when `zip` is available.

## Deployment steps (Namecheap cPanel)

1. cPanel -> **MySQL Databases**: create database + user, grant all privileges.
2. cPanel -> **phpMyAdmin**: select the database, import `_app/sql/schema.sql`.
3. Create the domain mailbox (e.g. `no-reply@sourcetx.com`) and note the SMTP host/port.
4. Upload the contents of `dist-php/` into the domain's document root (`public_html` for the main
   domain, or the addon domain's folder) via File Manager or FTP.
5. Create `_app/config.php` from `config.example.php` with the DB, SMTP, `siteUrl`, and
   `adminPassHash` values.
6. Ensure PHP 8.1+ is selected in cPanel -> **MultiPHP Manager**, and enable the `pdo_mysql`
   extension (default on Namecheap).
7. Visit `https://sourcetx.com/admin` and log in; add jobs and confirm forms/chat.
8. Enable SSL via cPanel **AutoSSL** and confirm HTTPS plus the preferred canonical host redirect.

## Local testing

- `php -S localhost:8080 scripts/php-router.php` emulates the `.htaccess` rewrites (the built-in
  server ignores `.htaccess`). The router maps the same dynamic routes to the same PHP files.
- `scripts/php-check.js` smoke tests against the local PHP server:
  - `/api/jobs` returns a JSON array.
  - `/api/contact` and `/api/apply` return `{ok:true,message}` and insert rows.
  - `/api/chat` returns `reply`, `followups`, `intent`.
  - `/jobs/<id>` HTML contains `"@type":"JobPosting"` and the job title; unknown id returns 404.
  - `/sitemap.xml` contains `</urlset>` and at least one `/jobs/` URL.
  - `/admin` returns the login page; unauthenticated admin API returns 401/redirect.
- The existing Node `npm test` and browser/regression checks remain unchanged.

## Node parity changes

The forms are shared between the Node dev server and the PHP production build, so the Node apply
route must be updated in the same change as the form markup:

- `server.js` `POST /api/apply`: change `upload.single('resume')` to `upload.none()` and drop
  `!req.file` from the required-fields check. Validate `resumeUrl` (optional, `http(s)` URL) instead
  of a file. Store `resumeUrl` in the `resume` column and write an empty `originalResumeName`, so the
  MySQL column set stays compatible.
- `public/js/app.js`: replace the "Node.js server" file-protocol message with the neutral email
  fallback (section 7).
- Keep `express.urlencoded` / `express.json` middleware; the client always posts `FormData`
  (multipart), which `multer.none()` parses.
- After this change, run `npm test` and the form smoke tests to confirm Node still accepts no-file
  submissions.

## Parity and maintenance

- Node `server.js`, `scripts/jobseo.js`, and `storage.js` remain the source of truth for behavior.
  The PHP layer mirrors the endpoints and response shapes; changes to job/meta rendering should be
  applied to both `scripts/jobseo.js` and `_app/lib/jobs.php`.
- Form field names must stay identical between `public/*.html` and the PHP validators.

## Out of scope

- Page Content / site Content file editors on production (static HTML is baked at build time).
- Résumé file uploads and file storage.
- Cron/background jobs for stale-job auto-close; the Node app auto-closes jobs after 60 days.
  On PHP, jobs are deactivated manually in the admin (a PHP cron task could be added later).
- Email deliverability tuning beyond cPanel SMTP (SPF/DKIM are set by cPanel when mail is hosted there).

## Risks and mitigations

- **Rewrite conflicts:** static pass-through rule precedes dynamic rewrites; verify each URL locally
  with the router and on the host.
- **PHP/Node drift:** documented shared behavior and mirrored validators; keep field names and JSON
  shapes identical.
- **MySQL credentials leak:** `_app/` denied by `.htaccess`; `config.php` never committed.
- **Spam on public forms:** reuse simple rate limiting and a honeypot field; PHPMailer sends from the
  authenticated mailbox so messages are not rejected.
- **PHPMailer availability:** vendor the library into the repo at build time; if it cannot be
  downloaded, the build fails loudly rather than shipping a broken mailer.

## Success criteria

- `https://sourcetx.com` serves all static pages unchanged, with valid canonical/meta/JSON-LD.
- `/jobs/<id>` and `/apply/<id>` work for every active job with server-rendered content and SEO tags.
- Contact, apply (no upload), and talent forms store to MySQL and send email via cPanel SMTP.
- Chat replies using the existing knowledge base.
- `/admin` logs in, lists submissions, marks read, replies (with email), exports CSV, and manages jobs.
- `/sitemap.xml` lists static pages plus all active jobs.
