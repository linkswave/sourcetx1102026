<?php
declare(strict_types=1);

// php/_app (this file lives in php/_app/lib)
define('APP_ROOT', dirname(__DIR__));
// Document root that contains index.html and _app/. The local dev router
// pre-defines this to point at public/.
if (!defined('PUBLIC_ROOT')) {
    define('PUBLIC_ROOT', dirname(APP_ROOT));
}

$GLOBALS['__config'] = null;

function config(?string $key = null, $default = null)
{
    if ($GLOBALS['__config'] === null) {
        $file = APP_ROOT . '/config.php';
        $GLOBALS['__config'] = is_file($file) ? (require $file) : [];
    }
    if ($key === null) {
        return $GLOBALS['__config'];
    }
    return array_key_exists($key, $GLOBALS['__config']) ? $GLOBALS['__config'][$key] : $default;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        config('dbHost', 'localhost'),
        config('dbPort', '3306'),
        config('dbName', '')
    );
    $pdo = new PDO($dsn, (string) config('dbUser', ''), (string) config('dbPass', ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function is_api_request(): bool
{
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    return strpos($uri, '/api/') === 0;
}

function wants_json(): bool
{
    if (is_api_request()) {
        return true;
    }
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    return stripos($accept, 'application/json') !== false;
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_input(): array
{
    static $data = null;
    if (is_array($data)) {
        return $data;
    }
    $data = $_POST;
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $json = json_decode((string) $raw, true);
        if (is_array($json)) {
            $data = array_merge($data, $json);
        }
    }
    return $data;
}

// Mirrors server.js safe(): trim and collapse newlines.
function field(string $key): string
{
    $value = request_input()[$key] ?? '';
    if (!is_string($value)) {
        return '';
    }
    return trim((string) preg_replace('/[\r\n]+/', ' ', $value));
}

function bool_field(string $key): bool
{
    $v = field($key);
    return $v !== '' && strtolower($v) !== 'no' && $v !== '0';
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function redirect(string $to, int $code = 302): void
{
    header('Location: ' . $to, true, $code);
    exit;
}

set_exception_handler(function (Throwable $e): void {
    error_log('[sourcetx] ' . $e->getMessage());
    if (wants_json()) {
        json_out(['ok' => false, 'message' => 'Something went wrong. Please try again.'], 500);
    }
    http_response_code(500);
    echo 'Something went wrong. Please try again.';
    exit;
});
