<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/auth.php';

session_boot();
if (!is_logged_in()) {
    redirect('/admin/login');
}

$candidates = [
    PUBLIC_ROOT . '/admin/admin.html',
    dirname(dirname(APP_ROOT)) . '/admin/admin.html',
];
$source = null;
foreach ($candidates as $candidate) {
    if (is_file($candidate)) {
        $source = $candidate;
        break;
    }
}
if ($source === null) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Admin UI not found.';
    exit;
}
$html = (string) file_get_contents($source);
$inject = '<script>window.SOURCETX_PHP_ADMIN=true;window.SOURCETX_CSRF=' . json_encode(csrf_token()) . ';</script>';
$html = preg_replace('/(<script[^>]*src="\/admin\/admin\.js"[^>]*>)/', $inject . '${1}', $html, 1);

header('Content-Type: text/html; charset=utf-8');
echo $html;
