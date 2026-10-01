<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/jobs.php';
require_once __DIR__ . '/../_app/lib/jobs_import.php';
require_once __DIR__ . '/../_app/lib/submissions.php';
require_once __DIR__ . '/../_app/lib/mailer.php';
require_once __DIR__ . '/../_app/lib/auth.php';

session_boot();
require_admin();

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$route = trim((string) ($_GET['route'] ?? ''), '/');
$parts = $route === '' ? [] : explode('/', $route);

if (!in_array($method, ['GET', 'HEAD'], true)) {
    check_csrf();
}

function list_strings($value): array
{
    if (!is_array($value)) {
        return [];
    }
    return array_values(array_filter(array_map(fn($v) => is_scalar($v) ? trim((string) $v) : '', $value), fn($v) => $v !== ''));
}

// ---- Jobs ----
if (($parts[0] ?? '') === 'jobs') {
    if (count($parts) === 1 && $method === 'GET') {
        json_out(['ok' => true, 'data' => all_jobs(false)]);
    }

    if (count($parts) === 2 && $parts[1] === 'import' && $method === 'POST') {
        $in = request_input();
        $raw = '';
        if (isset($in['text']) && is_string($in['text'])) {
            $raw = $in['text'];
        } elseif (isset($in['jobs']) && is_array($in['jobs'])) {
            $raw = json_encode($in['jobs']);
        }
        if (trim($raw) === '') {
            json_out(['ok' => false, 'message' => 'Paste JSON in the "text" field.'], 400);
        }
        try {
            $jobs = jobs_from_json($raw);
        } catch (InvalidArgumentException $e) {
            json_out(['ok' => false, 'message' => $e->getMessage()], 400);
        }
        $source = field('source') !== '' ? field('source') : 'import';
        $dryRun = !empty($in['dryRun']) && $in['dryRun'] !== 'false';
        try {
            $result = import_jobs_data($jobs, $source, $dryRun);
        } catch (Throwable $e) {
            json_out(['ok' => false, 'message' => 'Import failed: ' . $e->getMessage()], 500);
        }
        $message = sprintf(
            'Imported %d new, skipped %d existing, %d invalid. Total: %d.%s',
            $result['imported'],
            $result['skipped'],
            $result['invalid'],
            $result['total'],
            $dryRun ? ' (dry run - nothing saved)' : ''
        );
        json_out(['ok' => true, 'data' => [
            'imported' => $result['imported'],
            'skipped' => $result['skipped'],
            'invalid' => $result['invalid'],
            'total' => $result['total'],
            'message' => $message,
            'details' => $result['details'],
        ]]);
    }

    if (count($parts) === 1 && $method === 'POST') {
        $in = request_input();
        $title = field('title');
        if ($title === '') {
            json_out(['ok' => false, 'message' => 'Title is required.'], 400);
        }
        $job = [
            'title' => $title,
            'location' => field('location'),
            'type' => field('type'),
            'department' => field('department'),
            'posted' => field('posted') !== '' ? field('posted') : date('Y-m-d'),
            'summary' => field('summary'),
            'description' => field('description'),
            'responsibilities' => list_strings($in['responsibilities'] ?? []),
            'requirements' => list_strings($in['requirements'] ?? []),
            'skills' => list_strings($in['skills'] ?? []),
            'source' => 'manual',
            'lastRefreshed' => date('Y-m-d'),
            'active' => true,
        ];
        $id = insert_job($job);
        $saved = find_job($id);
        notify('New job posted: ' . $saved['title'], 'Title: ' . $saved['title'] . "\nLocation: " . ($saved['location'] ?: '—') . "\nType: " . ($saved['type'] ?: '—') . "\nDepartment: " . ($saved['department'] ?: '—') . "\n\n" . ($saved['summary'] ?? ''));
        json_out(['ok' => true, 'data' => $saved]);
    }

    if (count($parts) === 2 && in_array($method, ['PUT', 'PATCH'], true)) {
        $id = urldecode($parts[1]);
        $existing = find_job($id);
        if (!$existing) {
            json_out(['ok' => false, 'message' => 'Job not found'], 404);
        }
        $in = request_input();
        if (array_key_exists('active', $in) && is_bool($in['active'])) {
            set_active($id, $in['active']);
            json_out(['ok' => true, 'data' => find_job($id)]);
        }
        if (array_key_exists('title', $in) && field('title') === '') {
            json_out(['ok' => false, 'message' => 'Title is required.'], 400);
        }
        $patch = [];
        foreach (['title', 'location', 'type', 'department', 'posted', 'summary', 'description'] as $k) {
            if (array_key_exists($k, $in)) {
                $patch[$k] = field($k);
            }
        }
        foreach (['responsibilities', 'requirements', 'skills'] as $k) {
            if (array_key_exists($k, $in) && is_array($in[$k])) {
                $patch[$k] = list_strings($in[$k]);
            }
        }
        $patch['lastRefreshed'] = date('Y-m-d');
        update_job($id, $patch);
        json_out(['ok' => true, 'data' => find_job($id)]);
    }

    json_out(['ok' => false, 'message' => 'Not found.'], 404);
}

// ---- Submissions ----
$kind = $parts[0] ?? '';
if (!submission_table($kind)) {
    json_out(['ok' => false, 'message' => 'Unknown kind'], 404);
}

if (count($parts) === 1 && $method === 'GET') {
    json_out(['ok' => true, 'data' => list_submissions($kind)]);
}

if ($kind === 'messages' && count($parts) === 3 && $parts[2] === 'attachment' && in_array($method, ['GET', 'HEAD'], true)) {
    $stmt = db()->prepare('SELECT attachment, originalAttachmentName FROM messages WHERE id = ?');
    $stmt->execute([urldecode($parts[1])]);
    $row = $stmt->fetch();
    $name = $row ? basename((string) $row['attachment']) : '';
    $file = APP_ROOT . '/uploads/messages/' . $name;
    if ($name === '' || !is_file($file)) {
        json_out(['ok' => false, 'message' => 'No attachment found.'], 404);
    }
    $download = preg_replace('/[\r\n"]/', '', (string) ($row['originalAttachmentName'] ?: $name));
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $download . '"');
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

if (count($parts) === 3 && $parts[2] === 'read' && $method === 'POST') {
    $read = request_input()['read'] ?? true;
    mark_read($kind, urldecode($parts[1]), $read !== false && $read !== 'false');
    json_out(['ok' => true]);
}

if (count($parts) === 3 && $parts[2] === 'reply' && $method === 'POST') {
    $to = field('to');
    $subject = field('subject');
    $body = field('body');
    if ($to === '' || $subject === '' || $body === '') {
        json_out(['ok' => false, 'message' => 'to, subject, and body are required.'], 400);
    }
    if (!mail_configured()) {
        json_out(['ok' => false, 'message' => 'SMTP is not configured on this server.'], 503);
    }
    send_mail($to, $subject, $body);
    add_reply($kind, urldecode($parts[1]), [
        'to' => $to,
        'subject' => $subject,
        'body' => $body,
        'at' => now_iso(),
    ]);
    json_out(['ok' => true, 'message' => 'Reply sent.']);
}

json_out(['ok' => false, 'message' => 'Not found.'], 404);
