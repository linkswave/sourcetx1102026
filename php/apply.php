<?php
declare(strict_types=1);

require_once __DIR__ . '/_app/lib/bootstrap.php';
require_once __DIR__ . '/_app/lib/jobs.php';

$raw = isset($_GET['id']) ? trim((string) $_GET['id']) : '';
$id = preg_match('/^[A-Za-z0-9._-]+$/', $raw) ? $raw : '';

// Featured jobs have a static apply page; serve it as-is (matches the Node server).
$static = PUBLIC_ROOT . '/apply-' . $id . '.html';
if ($id !== '' && is_file($static)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($static);
    exit;
}

$job = $id !== '' ? find_job($id) : null;
if (!$job) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    readfile(PUBLIC_ROOT . '/404.html');
    exit;
}

$template = (string) file_get_contents(PUBLIC_ROOT . '/apply-detail.html');
$html = render_apply_page($template, $job);

header('Content-Type: text/html; charset=utf-8');
echo $html;
