# Implementation Plan — Namecheap PHP Deployment

Spec: `docs/superpowers/specs/2026-09-18-namecheap-php-deployment-design.md`
Date: 2026-09-18

Each task lists the files it touches and a concrete verification step. Do not start a phase until
the previous phase's verification passes. Run `npm test` after any change under `public/` or
`server.js`.

## Phase 0 — Node parity for the shared forms

### Task 0.1 — Convert the résumé file field to a link field
Files: `public/apply-detail.html`, the 8 apply pages (`public/apply-*.html`), `public/js/app.js`.
Steps:
- Remove `enctype="multipart/form-data"` from each apply `<form data-ajax action="/api/apply">`.
- Replace the file input with
  `<label>Résumé or LinkedIn link<small>Paste a link to your résumé or profile</small><input type="url" name="resumeUrl" placeholder="https://..."></label>`.
- In `public/js/app.js`, replace the `file:` branch message with a neutral email fallback.
Verification:
- `npm test` is 19/19.
- Open `http://localhost:3000/apply/general`, submit with `resumeUrl` empty and filled; both return
  `{ok:true}`.

### Task 0.2 — Make the Node apply route accept no file
Files: `server.js`.
Steps:
- `POST /api/apply`: change `upload.single('resume')` to `upload.none()`.
- Required fields become `name,email,phone,consent`; validate `resumeUrl` only if non-empty and
  `^https?://`.
- Store `resumeUrl` in the `resume` column; write `originalResumeName: ''`.
- Update the error message to no longer mention attaching a résumé.
Verification:
- `npm test` 19/19; the form from Task 0.1 succeeds and a row appears in
  `data/applications.json` with a `resumeUrl` link.
- `node -e "require('./server.js')"`-style boot check: server starts without errors.

## Phase 1 — PHP foundation

### Task 1.1 — Config template
Files: `php/_app/config.example.php`.
Steps: create placeholders `dbHost,dbPort,dbName,dbUser,dbPass,smtpHost,smtpPort,smtpSecure,
smtpUser,smtpPass,mailFrom,notifyEmail,siteUrl,adminUser,adminPassHash`.
Verification: `php -l php/_app/config.example.php`.

### Task 1.2 — Bootstrap
Files: `php/_app/lib/bootstrap.php`.
Steps:
- Load `config.php` if present (raise a clear error if missing).
- Create a shared PDO (utf8mb4, `ERRMODE_EXCEPTION`, `FETCH_ASSOC`).
- Helpers: `json_out($data,$code=200)`, `json_body()`, `str_field($key)`, `post_field($key)`,
  `is_https()`, and a global exception handler returning JSON for `/api/*`.
Verification: `php -l`; a scratch script `php -r "require 'php/_app/lib/bootstrap.php';"` runs with a
local config.

### Task 1.3 — Auth and CSRF
Files: `php/_app/lib/auth.php`.
Steps: session start, `require_admin()`, `login()`, `logout()`, `csrf_token()`, `check_csrf()`,
and a simple attempt counter/lockout in the session.
Verification: `php -l`.

### Task 1.4 — Apache rules
Files: `php/htaccess.template`, `php/_app/htaccess-deny`.
Steps: write the `.htaccess` rewrite block from the spec, and the `_app` deny rule
(`Require all denied` with `Deny from all` fallback).
Verification: templates exist and are consumed by the build in Task 7.1.

## Phase 2 — Data and content services

### Task 2.1 — Jobs repository
Files: `php/_app/lib/jobs.php`.
Steps:
- `all_jobs($activeOnly=true)`, `find_job($id)`, `insert_job($data)`, `update_job($id,$data)`,
  `deactivate_job($id)`.
- JSON-encode/decode `responsibilities`, `requirements`, `skills`.
- Include `jobPosting($job,$url)`, `breadcrumbList($job,$url)`, `ldScripts($objs)`,
  `metaTitle`, `metaDescription` as a direct port of `scripts/jobseo.js` (same output).
Verification:
- `php -l`.
- A scratch script dumps `json_encode(jobPosting($job))` for a fixture job and matches the Node
  output for the same job (compare via a small `node -e` run).

### Task 2.2 — Schema SQL
Files: `php/_app/sql/schema.sql.fragment` (jobs) generated into `dist-php/_app/sql/schema.sql`.
Steps: define the `jobs` table; the build appends the four `TABLES` DDLs extracted from `storage.js`.
Verification: schema imports into a local MySQL/MariaDB without error (or SQLite-compatible review
if no MySQL is available).

### Task 2.3 — Mailer
Files: `php/_app/lib/mailer.php`, vendored `php/_app/lib/PHPMailer/`.
Steps: `send_mail($to,$subject,$html)` using PHPMailer SMTP from config; return false and log when
`smtpHost` is empty; `notify($subject,$html)` sends to `notifyEmail`.
Verification: `php -l`; a scratch send to a local catch-all (e.g. `mailhog`) if available, otherwise
assert the function returns false with empty config and does not throw.

## Phase 3 — Public API endpoints

### Task 3.1 — `GET /api/jobs`
Files: `php/api/jobs.php`.
Verification: `curl localhost:8080/api/jobs` returns a JSON array.

### Task 3.2 — `POST /api/contact`
Files: `php/api/contact.php`.
Steps: require `name,email,message,consent`; insert `messages`; `notify()`.
Verification: `curl -F` post returns `{ok:true,message}` and a row exists.

### Task 3.3 — `POST /api/apply`
Files: `php/api/apply.php`.
Steps: require `name,email,phone,consent`; resolve `jobId` (`general` or existing job); insert
`applications` with `resume` = `resumeUrl`; notify admin and confirm to applicant.
Verification: post with and without `jobId`, and with/without `resumeUrl`; rows correct.

### Task 3.4 — `POST /api/talent-request`
Files: `php/api/talent-request.php`.
Steps: require `name,company,email,needs,consent`; insert `talent_requests`; notify.
Verification: post returns `{ok:true}` and a row exists.

## Phase 4 — Chat

### Task 4.1 — Port the chatbot
Files: `php/_app/lib/chat.php`.
Steps: port normalization, aliases, stopwords, scoring, `CONFIDENCE_THRESHOLD=0.6`, fallback and
follow-ups from `chatbot.js`; load `_app/data/chatbot.json`.
Verification: compare replies for ~10 fixture questions against Node `chatbot.js`; all match.

### Task 4.2 — `POST /api/chat`
Files: `php/api/chat.php`.
Steps: parse `message`/`email`; return the `{reply,followups,confidence,fallback,intent}` shape;
insert `chat_captures` on email capture.
Verification: `curl` returns the same keys; a capture row appears when an email is sent.

## Phase 5 — Server-rendered pages

### Task 5.1 — Job page
Files: `php/job.php`, template `php/views/job.template.html`.
Steps:
- Base the template on `public/job-detail.html` (build-time copy, Task 7.2).
- Look up the job; 404 with `404.html` when missing/inactive.
- Replace head/meta/canonical/og/twitter via the ported renderer and inject JSON-LD.
- Fill `jd-department,jd-title,jd-meta,jd-summary,jd-description,jd-responsibilities,
  jd-requirements,jd-skills,jd-apply,jd-sidebar-apply,jd-sidebar-title,jd-sidebar-meta` exactly as
  `job-detail.js` does.
Verification:
- `curl localhost:8080/jobs/full-stack-developer` contains the title, `"@type":"JobPosting"`,
  `"@type":"BreadcrumbList"`, and `index,follow`.
- Unknown id returns HTTP 404.

### Task 5.2 — Apply page
Files: `php/apply.php`, template `php/views/apply.template.html`.
Steps: unknown id -> 404; set `apply-job-id` (hidden value), `apply-title`, `apply-meta`, title/meta.
Verification: `curl localhost:8080/apply/full-stack-developer` shows the role; unknown -> 404.

### Task 5.3 — Sitemap
Files: `php/sitemap.php`, build-copied `php/_app/sitemap-base.xml`.
Steps: emit base URLs plus active `/jobs/<id>`; `Content-Type: application/xml`.
Verification: `curl localhost:8080/sitemap.xml` is valid XML and contains at least one `/jobs/` URL.

## Phase 6 — Admin

### Task 6.1 — Login/logout shell
Files: `php/admin/index.php`, `php/admin/login.php`, `php/admin/logout.php`.
Steps: render login form when not authenticated; `password_verify` against `adminPassHash`;
session + CSRF; logout clears the session.
Verification: unauthenticated `/admin` shows login; correct credentials reach the dashboard;
`/api/admin/jobs` without a session returns 401.

### Task 6.2 — Admin API
Files: `php/admin/api.php`.
Steps: route `route` query param to jobs list/create/update and submissions list/read/reply; enforce
auth + CSRF on writes; reply sends email and appends to `replies`.
Verification: create a job via `curl` with a session cookie and see it in `/api/jobs`; mark-read and
reply persist.

### Task 6.3 — CSV export
Files: `php/admin/export.php`.
Steps: emit CSV for `applications|messages|talent-requests|chat-captures`, matching the Node columns.
Verification: `curl` returns `text/csv` with a header row and data rows.

### Task 6.4 — Admin UI adaptation
Files: `admin/admin.js` (guarded), `php/admin/dashboard.php`.
Steps: reuse the existing admin markup/JS; point requests at the same `/api/admin/*` URLs; hide the
Content and Page Content tabs in the PHP build. Do not change the Node admin behavior.
Verification: dashboard lists and edits jobs and submissions in the local PHP server; Node admin
still works (`npm test`).

## Phase 7 — Build pipeline

### Task 7.1 — `scripts/build-php.js`
Files: new `scripts/build-php.js`, `package.json` (`build:php` script).
Steps:
1. Reset `dist-php/`.
2. Copy `public/` -> `dist-php/`.
3. Copy `php/` -> `dist-php/` (`php/_app` and `php/api` map to deploy paths; skip `config.php`).
4. Copy `data/chatbot.json` -> `dist-php/_app/data/chatbot.json`.
5. Copy `public/sitemap.xml` -> `dist-php/_app/sitemap-base.xml`.
6. Copy `public/job-detail.html` and `public/apply-detail.html` -> `php/views` templates in a
   pre-step, then place them under `dist-php/_app/views/`.
7. Generate `.htaccess` from `php/htaccess.template` and `_app/.htaccess`.
8. Generate `schema.sql` from the jobs fragment plus `TABLES` parsed out of `storage.js`.
9. `php -l` every PHP file when `php` is on PATH; fail on error.
10. Write `dist-php/DEPLOY.md` from a template with the cPanel checklist.
Verification: `node scripts/build-php.js` exits 0 and `dist-php/` has the expected tree;
`php -l` runs on all files.

### Task 7.2 — Template generation
Files: part of `scripts/build-php.js`.
Steps: strip the `<!--src-shell-*-->` generation is NOT needed (shell is already baked in the
public HTML); just copy the two pages as `_app/views/*.template.html`.
Verification: templates exist and contain the `jd-*` / `apply-*` IDs.

### Task 7.3 — Zip artifact
Files: part of `scripts/build-php.js`.
Steps: optionally `dist-php.zip` using the system `zip` when available; skip with a warning
otherwise.
Verification: `dist-php.zip` opens and contains `index.html` and `_app/config.example.php` when zip
is present.

## Phase 8 — Local test harness

### Task 8.1 — Router
Files: `scripts/php-router.php`.
Steps: map the same routes as `.htaccess` to the same PHP files; serve static files otherwise.
Verification: `php -S localhost:8080 scripts/php-router.php` serves `/`, `/jobs/<id>`, `/api/jobs`,
`/sitemap.xml`, `/admin`.

### Task 8.2 — Smoke tests
Files: `scripts/php-check.js`, `package.json` (`test:php`).
Steps: start the PHP server on a spare port, run the checks in the spec's "Local testing" section
(API shapes, 404s, sitemap, admin auth), then stop it.
Verification: `npm run test:php` passes against a local MySQL with `schema.sql` imported.

## Phase 9 — Documentation and deploy

### Task 9.1 — DEPLOY.md
Files: `php/DEPLOY.md.template`.
Steps: reproduce the spec's cPanel checklist and config instructions.
Verification: generated `dist-php/DEPLOY.md` renders and lists every required value.

### Task 9.2 — Final verification
Steps:
- `npm test` (19/19) and `npm run test:php`.
- Confirm `git status` shows no unintended changes to `data/` or `public/` beyond the form change.
- Commit in logical chunks: form change + Node parity, PHP core, endpoints, SSR, admin, build/tests,
  docs.
Verification: clean `git status` after commits; all tests green.

## Manual production steps (not automated)

1. cPanel -> MySQL Databases: create DB and user.
2. phpMyAdmin: import `_app/sql/schema.sql`.
3. Create the mailbox and note SMTP settings.
4. Upload `dist-php/` contents to the document root.
5. Create `_app/config.php` from the example.
6. Select PHP 8.1+; confirm `pdo_mysql`.
7. Log in at `/admin`; add jobs; test forms and chat.
8. Enable AutoSSL; confirm HTTPS and the canonical host redirect.
