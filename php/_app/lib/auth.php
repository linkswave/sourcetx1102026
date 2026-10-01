<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function session_boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
        'path' => '/',
    ]);
    session_start();
}

function is_logged_in(): bool
{
    session_boot();
    return !empty($_SESSION['admin']);
}

function require_admin(): void
{
    if (is_logged_in()) {
        return;
    }
    if (is_api_request()) {
        json_out(['ok' => false, 'message' => 'Not authenticated.'], 401);
    }
    redirect('/admin/login');
}

function login_attempt(string $user, string $pass): bool
{
    session_boot();
    $until = (int) ($_SESSION['lockoutUntil'] ?? 0);
    if ($until > time()) {
        return false;
    }
    $ok = hash_equals((string) config('adminUser', ''), $user)
        && password_verify($pass, (string) config('adminPassHash', ''));
    if ($ok) {
        $_SESSION['admin'] = $user;
        $_SESSION['attempts'] = 0;
        $_SESSION['lockoutUntil'] = 0;
        session_regenerate_id(true);
        return true;
    }
    $_SESSION['attempts'] = (int) ($_SESSION['attempts'] ?? 0) + 1;
    if ($_SESSION['attempts'] >= 8) {
        $_SESSION['lockoutUntil'] = time() + 15 * 60;
        $_SESSION['attempts'] = 0;
    }
    return false;
}

function logout_admin(): void
{
    session_boot();
    unset($_SESSION['admin']);
    session_destroy();
}

function csrf_token(): string
{
    session_boot();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf'];
}

function check_csrf(): void
{
    session_boot();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? (request_input()['csrf'] ?? '');
    if (!is_string($sent) || $sent === '' || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $sent)) {
        if (is_api_request()) {
            json_out(['ok' => false, 'message' => 'Invalid CSRF token.'], 403);
        }
        http_response_code(403);
        echo 'Invalid CSRF token.';
        exit;
    }
}
