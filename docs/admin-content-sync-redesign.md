# Admin Job Sync, Content Editor, Email & Logo Refresh — Design

Status: Approved 2026-09-09 · Target: this /workspace static site (`public/*.html`, `server.js`, `admin/`)

## Scope
No colour/palette, service-list, or copy changes outside the shared regions below. Existing 15 services and all content preserved.

## 1. Logo mark
- Converted user-supplied emblem `d920b1bf-sourcetx-newlogo-1.PNG`: edge flood-fill keyed `#202020` background to transparency, cropped → `public/pictures/sourceTX-mark.png` (146×179, α preserved).
- New `public/pictures/favicon.png` (64px square, emblem fitted on transparent canvas).
- Swap: header + footer brand `<svg class="logo-mark">` replaced by `<img class="logo-mark">` across all 40 shell pages; "Source TX" wordmark text retained (mark-only per user).
- Header/footer markup unified through one rebuild script (below); per-page unique SVG gradient IDs no longer needed.

## 2. Content editors
### 2a. Shared content editor (not a full CMS)
- Editable shared regions only:
  - Header nav labels + header CTA label/link
  - Home hero eyebrow / title / subtitle / primary+secondary CTA labels (`index.html`)
  - Footer tagline, email, phone, company name
- `data/content.json` = single source of truth, seeded with the exact current copy (defaults = no visible change).
- `scripts/shell.js` wraps `<header>` and `<footer>` in HTML comment markers on every page and regenerates both blocks from the stored content file (idempotent). Home hero editable strings are tokenized inline (`<!--e:hero.title-->…<!--/e-->`) so labels can be rewritten without touching the surrounding motion markup.
- Server API: `GET/POST /api/admin/content` (basic-auth). POST validates, saves `content.json`, rebuilds pages, returns count applied.
- Admin tab: `Content`.

### 2b. Per-page content editor
- Text-only fields on the 22 editable pages (7 core + 15 service pages): hero eyebrow/headline/intro/CTA button labels, and each section's eyebrow/heading/intro, plus bottom-CTA button labels.
- `scripts/pagefields.js` tokenizes each page body once with `<!--e:pf:<key>-->…<!--/e-->` markers keyed by structure (`hero.title`, `section.N.eyebrow`, `section.N.title`, `section.N.intro`, `button.N`, `hero.btn.N`). Tokenization is content-preserving (verified byte-identical apart from markers) and idempotent.
- `data/page_defaults.json` = immutable snapshot of the original text (used for Reset). `data/pages.json` (gitignored) = per-page overrides.
- Server API: `GET /api/admin/pages` returns every page with grouped fields; `POST /api/admin/pages` saves `{file, values}` (empty value = revert field to default; `values:{}` = reset page). Unknown pages/keys rejected.
- Admin tab: `Page Content` with a page picker, grouped fields, Save & Apply, and Reset Page. Header/footer and images are never touched.


## 3. Emails
- On apply (`POST /api/apply`):
  - Applicant confirmation email "Application received: <position>" (sent when SMTP configured; failures logged, never block the response).
  - Existing admin alert extended: full candidate details + attached CV from `uploads/<file>` using the stored original filename.
- `sendMail/notify` now accept optional `attachments`.

## 4. Job sync + auto-close
- Job fields added: `source` (`manual`/`bulk`), `sourceUrl`, `lastRefreshed`; closed jobs reuse `active:false` (public routes already filter on it).
- Admin tab `Job Sync`: table with source/refresh columns, Edit/Deactivate, and an **Import modal**:
  - Paste format: `Title | Location | Type | Department | Summary | URL` (one per line)
  - CSV: header `title,location,type,department,posted,summary,url`
- Dedupe by `sourceUrl`, else `title`+`location`; matching rows upsert (id preserved, so apply URLs never orphan) and refresh `lastRefreshed`; closed matches reactivate.
- Auto-close: postings with `source`/`lastRefreshed` older than `JOB_STALE_DAYS` (default 60, env-tunable) become inactive with `closedReason:'stale'`. Runs on server start, hourly, before `/api/jobs`, and on each Job Sync view. Legacy bundled jobs (no sync fields) are untouched.
- Public jobs cards & detail pages show an optional "View Original Posting" link when `sourceUrl` is present.

## 5. Header/menu style
- Ported from reference `a33cc78f-styles-2.css` using the existing SourceTX palette:
  - Transparent logo mark (`object-fit: contain`, no tile/backdrop) in header/footer
  - Header top gradient strip, stronger blur, `scrolled` compact state (nav 78→64px, shadow)
  - Nav links: animated underline (`scaleX`) replaces the old pill background; active + hover keep white text
- Scroll listener added to `public/js/app.js` (CSP-safe, no inline JS).

## 6. Verification
- `npm test` (scripts/check.js): all 19 checks pass.
- Shared content mutate + revert, sync import + dedupe, deactivate → hidden from `/api/jobs`, apply flow with CV attachment stored.
- Page editor: 22 pages / 409 fields tokenized with lossless round-trip; `GET /api/admin/pages`, save, and reset exercised end-to-end (reset restores byte-identical files); unknown page rejected; unauthenticated 401.
- Live preview restarted on port 3000.
