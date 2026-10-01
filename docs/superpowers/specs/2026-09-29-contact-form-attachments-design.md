# Contact Form Attachments: Design

Date: 2026-09-29
Status: Approved (design), pending implementation

## Goal

Let a visitor attach one file (up to 10 MB) to the contact form. The file is stored on
the server and also attached to the notification email to SourceTX. Admins can download
the stored file from the Messages view.

## Non-Goals

- No changes to the application (résumé) form; it keeps the `resumeUrl` link field.
- No changes to the Node admin for jobs/content/pages.
- No virus scanning or content inspection beyond type/size checks.
- No public URLs for stored contact attachments.

## UX

- Add an optional file input `attachment` to the contact form on `public/contact.html`,
  with a hint listing allowed types and the 10 MB maximum.
- The existing AJAX handler (`public/js/app.js`) already submits `FormData`, so no JS
  change is required. The form remains usable if the field is empty.
- Client-side `accept` is a convenience only; all validation is server-side.

## Validation

- Allowed extensions: `pdf doc docx xls xlsx ppt pptx txt csv png jpg jpeg gif webp`.
  SVG, HTML, scripts, archives, and executables are rejected.
- Maximum size: 10 MB (10 * 1024 * 1024 bytes).
- One file per submission (multi-file uploads are rejected/ignored).
- Stored filename is derived from the message id plus a lowercased extension:
  `<message-id>.<ext>`. The original filename is stored only as text.
- PHP additionally sniffs the MIME type with `finfo` as a secondary check.

## Storage

- Node: `uploads/messages/<message-id>.<ext>`.
- PHP: `_app/uploads/messages/<message-id>.<ext>` (inside the `.htaccess`-protected
  `_app` directory, so it is never directly web-accessible).
- Both directories are writable at runtime and ignored by git.

## Schema

Add two nullable columns to `messages`:

- `attachment VARCHAR(255)` - stored key (`<message-id>.<ext>`) or empty.
- `originalAttachmentName VARCHAR(255)` - the sender's original filename.

`storage.js` `TABLES.messages` is the source of truth and drives the generated
`php/_app/sql/schema.sql`. Because `CREATE TABLE IF NOT EXISTS` will not alter an
existing table:

- `MySqlStore.init()` gains a lightweight migration (mirroring the existing `isRead` /
  `replies` migration) that adds the two columns when missing.
- `php/DEPLOY.md` documents an equivalent `ALTER TABLE messages ...` step for existing
  PHP deployments.

## Node changes

- Add a contact-specific multer instance: disk storage into `uploads/messages`, 10 MB
  limit, one file, extension allow-list, filename from request id.
- `/api/contact` switches from `upload.none()` to that middleware, stores
  `attachment` and `originalAttachmentName`, and passes the file to `notify()` as a real
  email attachment. Friendly errors for wrong type and oversized files.
- Add an authenticated admin download route
  `GET /api/admin/messages/:id/attachment` that streams the file with
  `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.

## PHP changes

- `php/api/contact.php` reads `$_FILES['attachment']`, checks the PHP upload error code,
  size, and extension (plus a `finfo` MIME check), moves it into `_app/uploads/messages`,
  and stores the two columns.
- `php/_app/lib/mailer.php` `send_mail()` gains an optional `$attachments` parameter and
  calls `PHPMailer::addAttachment()`.
- `php/admin/api.php` gains `GET /api/admin/messages/<id>/attachment`, which loads the
  row, guards against path traversal (basename only), and streams the file.
- No router/`.htaccess` change is needed: the admin API is already routed under
  `/api/admin/`.

## Admin UI

- In `admin/admin.js`, `cardGeneric()` shows an attachment link for message records that
  have one. Both stacks use `/api/admin/messages/<id>/attachment`, so a single branch
  works; the link text shows the original filename.

## Email

- `notify()` includes the file as a real attachment under its original name. The body
  still lists sender name, email, phone, topic, and message.
- Note: a 10 MB file becomes roughly 13 MB once base64-encoded, which some SMTP servers
  cap. Operators should keep attachments well under their provider's message limit.

## Security

- Extension allow-list plus size cap; no server-side execution of uploaded content.
- Random/id-derived filenames; the original name is never used on disk.
- Stored files are not publicly reachable (Node serves the download through the
  authenticated admin route; PHP serves through the admin API in protected `_app`).
- Download responses force attachment disposition and `nosniff`.

## Testing

- Extend `scripts/php-check.js`:
  - multipart contact submission with a small allowed file, asserting the row stores the
    attachment fields;
  - rejected disallowed extension and oversized file;
  - authenticated admin download returns the file bytes; unauthenticated download is
    rejected.
- Keep `npm test` (website checks) and `npm run build:php` passing.

## Deploy prerequisites

- PHP `upload_max_filesize` and `post_max_size` >= 11 MB (cPanel MultiPHP INI Editor).
- `_app/uploads/messages/` writable by the web user.
- Run the documented `ALTER TABLE messages ...` on existing databases.

## Out of Scope

- Attachments on apply, talent-request, or chat forms.
- Multiple attachments or resumable uploads.
- Attachment retention/cleanup policies.
