# SourceTX — Jobs JSON Import Tool (PHP CLI)

Date: 2026-09-22
Status: Approved design (user confirmed PHP CLI on the server, match by id and skip existing)

## Goal

Provide a small, safe command-line tool that connects to the site's MySQL `jobs` table and imports
jobs from a JSON file, inserting only the jobs whose `id` does not already exist. It is meant to be
run on the Namecheap host (or locally against the same database) after the site is deployed.

## Context and constraints

- The production site is PHP + MySQL on Namecheap shared hosting. MySQL is only reliably reachable
  from the host itself, so the tool runs there via cPanel Terminal.
- `jobs.responsibilities`, `jobs.requirements`, and `jobs.skills` are stored as **JSON-encoded
  TEXT** because `php/_app/lib/jobs.php` reads them through `json_list()` (`jobs.php:21-31`,
  `normalize_job` at `jobs.php:33-40`). The importer must encode arrays the same way so server-side
  rendering and `JobPosting` structured data stay identical.
- The existing Node "Job Sync" (`server.js:275`) operates on `data/jobs.json`, not MySQL, and
  updates existing rows. It is a different workflow and is not reused.
- Confirmed decisions:
  - **Runtime:** PHP CLI shipped with the site, reusing `_app/config.php` and the app bootstrap.
  - **Duplicate detection:** match by `id` only; existing rows are never modified.
  - **Placement:** under `_app/` so `_app/.htaccess` (`Require all denied`) keeps it
    web-inaccessible while still runnable from the CLI.

## Input format

The attached feed is a top-level JSON array of job objects:

```json
[
  {
    "id": "senior-data-engineer",
    "title": "Senior Data Engineer",
    "location": "New York, NY / Hybrid",
    "type": "Contract",
    "department": "Data & AI",
    "posted": "2026-07-15",
    "summary": "...",
    "description": "...",
    "responsibilities": ["..."],
    "requirements": ["..."],
    "skills": ["Python", "Spark"],
    "active": true
  }
]
```

The tool also accepts an object whose `jobs` property is such an array. A job is **valid** when it
has a non-empty `id` and `title`; rows failing this are reported as invalid and skipped.

## Tool: `php/_app/tools/import-jobs.php`

Deployed to `_app/tools/import-jobs.php`. Usage:

```bash
php _app/tools/import-jobs.php jobs.json
php _app/tools/import-jobs.php jobs.json --dry-run
php _app/tools/import-jobs.php jobs.json --source=import
```

### Behavior

1. Read the JSON file given as the first argument; fail fast (exit 1) if it is missing, unreadable,
   not valid JSON, or not an array/list of objects.
2. Connect using the site's existing PDO connection (`db()` from `_app/lib/bootstrap.php`), which
   reads `_app/config.php`.
3. For each valid job, in document order:
   - `SELECT 1 FROM jobs WHERE id = ?`; if a row exists, count it as **skipped** and leave it
     untouched.
   - otherwise `INSERT` it, counted as **imported**.
4. Perform all writes inside a single transaction so a failure leaves the table unchanged.
5. Print a summary: `imported N, skipped M (already exist), invalid K, total now T`.
6. Exit `0` on success and `1` on a fatal error.
7. `--dry-run` performs validation and duplicate checks and prints the intended outcome, but writes
   nothing.
8. `--source=<value>` sets the `source` column (default `import`).

### Field mapping

| JSON field | Column | Rule |
|---|---|---|
| `id` | `id` | required; primary key |
| `title` | `title` | required |
| `location` | `location` | as-is |
| `type` | `type` | as-is |
| `department` | `department` | as-is |
| `posted` | `posted` | must match `YYYY-MM-DD`; otherwise today's date |
| `summary` | `summary` | as-is |
| `description` | `description` | as-is |
| `responsibilities` | `responsibilities` | `json_encode()` of the array |
| `requirements` | `requirements` | `json_encode()` of the array |
| `skills` | `skills` | `json_encode()` of the array |
| `active` | `active` | `1` when not `false`; default `1` |
| — | `sourceUrl` | `''` (absent from the feed) |
| — | `source` | `import`, or the `--source=` value |
| — | `lastRefreshed` | today's date |
| — | `createdAt`, `updatedAt` | `NOW()` |

Text fields default to `''` when absent; array fields default to `[]`.

## Explicit non-goals

- No updates to existing rows (the confirmed "skip if exists" rule).
- No deactivation of jobs absent from the file.
- No generation of static `job-<id>.html` / `apply-<id>.html` pages; new jobs are served through
  server-side rendering at `/jobs/<id>` and `/apply/<id>`.
- No web UI and no Node.js involvement.

## Testing

Add a CLI check to `scripts/php-check.js` that, against the local test database:

1. Imports a small fixture containing one job id that already exists and one that does not, and
   asserts the summary reports one imported and one skipped.
2. Runs the same import a second time and asserts it imports zero (idempotency).
3. Verifies the new row's `responsibilities`/`requirements`/`skills` are stored as JSON text.

## Documentation

Add an "Importing jobs" section to `php/DEPLOY.md.template` describing the command and the
insert-only, skip-existing behavior.
