<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/jobs.php';
require_once __DIR__ . '/../_app/lib/mailer.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_out(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

const CONTACT_MAX_BYTES = 10485760;
const CONTACT_ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
const CONTACT_DENIED_MIME = [
    'text/html',
    'application/x-httpd-php',
    'application/x-php',
    'application/x-sh',
    'application/x-executable',
    'application/x-dosexec',
    'application/x-msdownload',
    'application/x-msdos-program',
];

$required = ['name', 'email', 'message', 'consent'];
foreach ($required as $key) {
    if (field($key) === '') {
        json_out(['ok' => false, 'message' => 'Please complete all required fields and provide consent.'], 400);
    }
}
if (!filter_var(field('email'), FILTER_VALIDATE_EMAIL)) {
    json_out(['ok' => false, 'message' => 'Please provide a valid email address.'], 400);
}

$id = uuid();
$attachment = '';
$originalAttachmentName = '';

$upload = $_FILES['attachment'] ?? null;
if (is_array($upload) && (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $error = (int) $upload['error'];
    if ($error !== UPLOAD_ERR_OK) {
        $message = in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            ? 'Attachment must be 10 MB or smaller.'
            : 'The attachment could not be uploaded. Please try again.';
        json_out(['ok' => false, 'message' => $message], 400);
    }
    if ((int) ($upload['size'] ?? 0) > CONTACT_MAX_BYTES) {
        json_out(['ok' => false, 'message' => 'Attachment must be 10 MB or smaller.'], 400);
    }

    $originalAttachmentName = trim((string) ($upload['name'] ?? ''));
    $extension = strtolower(pathinfo($originalAttachmentName, PATHINFO_EXTENSION));
    if (!in_array($extension, CONTACT_ALLOWED_EXT, true)) {
        json_out(['ok' => false, 'message' => 'Attachment must be a PDF, Office document, text file, or image.'], 400);
    }

    $tmp = (string) ($upload['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        json_out(['ok' => false, 'message' => 'The attachment could not be uploaded. Please try again.'], 400);
    }

    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $mime = strtolower((string) finfo_file($finfo, $tmp));
            finfo_close($finfo);
            if (in_array($mime, CONTACT_DENIED_MIME, true)) {
                json_out(['ok' => false, 'message' => 'That file type is not allowed.'], 400);
            }
        }
    }

    $dir = APP_ROOT . '/uploads/messages';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
        json_out(['ok' => false, 'message' => 'Attachments are temporarily unavailable. Please email us instead.'], 500);
    }
    $stored = $id . '.' . $extension;
    if (!move_uploaded_file($tmp, $dir . '/' . $stored)) {
        json_out(['ok' => false, 'message' => 'The attachment could not be saved. Please try again.'], 500);
    }
    $attachment = $stored;
}

$item = [
    'id' => $id,
    'submittedAt' => gmdate('Y-m-d H:i:s'),
    'status' => 'new',
    'name' => field('name'),
    'email' => field('email'),
    'phone' => field('phone'),
    'topic' => field('topic'),
    'message' => field('message'),
    'attachment' => $attachment,
    'originalAttachmentName' => $originalAttachmentName,
];
$stmt = db()->prepare(
    'INSERT INTO messages (id,submittedAt,status,name,email,phone,topic,message,attachment,originalAttachmentName,isRead,replies) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)'
);
$stmt->execute([
    $item['id'], $item['submittedAt'], $item['status'], $item['name'], $item['email'],
    $item['phone'], $item['topic'], $item['message'], $item['attachment'],
    $item['originalAttachmentName'], '[]',
]);

$attachments = $attachment !== ''
    ? [['path' => APP_ROOT . '/uploads/messages/' . $attachment, 'name' => $originalAttachmentName]]
    : [];
notify(
    'Website message: ' . $item['topic'],
    $item['name'] . "\n" . $item['email'] . "\n" . $item['phone'] . "\n\n" . $item['message'],
    $item['email'],
    $attachments
);

json_out(['ok' => true, 'message' => 'Thank you. Your message has been sent to SourceTX.']);
