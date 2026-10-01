<?php
declare(strict_types=1);

// Local development router for: php -S 127.0.0.1:8080 -t public scripts/php-router.php
// Emulates the production .htaccess rewrites. Not used on the host.

define('PUBLIC_ROOT', dirname(__DIR__) . '/public');

$root = dirname(__DIR__);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rtrim($path, '/');
if ($path === '') {
    $path = '/';
}

$serve = function (string $file): void {
    header('Content-Type: text/html; charset=utf-8');
    readfile($file);
    exit;
};

// API
if ($path === '/api/jobs') {
    require $root . '/php/api/jobs.php';
    return true;
}
if ($path === '/api/contact') {
    require $root . '/php/api/contact.php';
    return true;
}
if ($path === '/api/apply') {
    require $root . '/php/api/apply.php';
    return true;
}
if ($path === '/api/talent-request') {
    require $root . '/php/api/talent-request.php';
    return true;
}
if ($path === '/api/chat') {
    require $root . '/php/api/chat.php';
    return true;
}
if (strpos($path, '/api/admin/') === 0) {
    $_GET['route'] = substr($path, strlen('/api/admin/'));
    require $root . '/php/admin/api.php';
    return true;
}

// Dynamic pages
if ($path === '/sitemap.xml') {
    require $root . '/php/sitemap.php';
    return true;
}
if (preg_match('#^/jobs/([A-Za-z0-9._-]+)$#', $path, $m)) {
    $_GET['id'] = $m[1];
    require $root . '/php/job.php';
    return true;
}
if ($path === '/jobs') {
    $serve(PUBLIC_ROOT . '/jobs.html');
}
if (preg_match('#^/apply/([A-Za-z0-9._-]+)$#', $path, $m)) {
    $_GET['id'] = $m[1];
    require $root . '/php/apply.php';
    return true;
}
if ($path === '/apply') {
    $serve(PUBLIC_ROOT . '/general-application.html');
}

// Admin
if ($path === '/admin' || $path === '/admin/index.php') {
    require $root . '/php/admin/index.php';
    return true;
}
if ($path === '/admin/login') {
    require $root . '/php/admin/login.php';
    return true;
}
if ($path === '/admin/logout') {
    require $root . '/php/admin/logout.php';
    return true;
}
if (preg_match('#^/admin/export/([a-z-]+)\.csv$#', $path, $m)) {
    $_GET['kind'] = $m[1];
    require $root . '/php/admin/export.php';
    return true;
}
// Admin static assets (admin.js) live outside public/ in source.
if (preg_match('#^/admin/([A-Za-z0-9._-]+)$#', $path, $m)) {
    $file = $root . '/admin/' . $m[1];
    if (is_file($file)) {
        $types = ['js' => 'application/javascript', 'css' => 'text/css', 'html' => 'text/html'];
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream') . '; charset=utf-8');
        readfile($file);
        exit;
    }
}

// Existing static files are served by the built-in server (-t public).
if ($path === '/') {
    $serve(PUBLIC_ROOT . '/index.html');
}
$static = PUBLIC_ROOT . $path;
if ($path !== '/' && is_file($static)) {
    return false;
}

// 404
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
readfile(PUBLIC_ROOT . '/404.html');
return true;
