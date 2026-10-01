<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/auth.php';

session_boot();
if (is_logged_in()) {
    redirect('/admin');
}

$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    check_csrf();
    $user = (string) ($_POST['user'] ?? '');
    $pass = (string) ($_POST['password'] ?? '');
    if (login_attempt($user, $pass)) {
        redirect('/admin');
    }
    $error = 'Invalid credentials.';
}

$token = htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8');
$errorHtml = $error !== '' ? '<p class="error">' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</p>' : '';
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>SourceTX Admin Login</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#071526;color:#e8eef7;font-family:Inter,system-ui,sans-serif}
  form{background:#0d2138;padding:36px;border-radius:14px;width:min(92vw,360px);box-shadow:0 20px 60px rgba(0,0,0,.4)}
  h1{margin:0 0 20px;font-size:20px}
  label{display:block;margin-bottom:14px;font-size:13px;color:#a9bbd0}
  input{width:100%;margin-top:6px;padding:11px 12px;border-radius:8px;border:1px solid #24405e;background:#08192b;color:#e8eef7;font-size:15px;box-sizing:border-box}
  button{width:100%;margin-top:8px;padding:12px;border:0;border-radius:8px;background:linear-gradient(120deg,#2d7ff9,#7b5cff);color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  .error{color:#ff8f8f;font-size:13px;margin:0 0 12px}
</style>
</head>
<body>
<form method="post" action="/admin/login">
  <h1>SourceTX Admin</h1>
  <?= $errorHtml ?>
  <input type="hidden" name="csrf" value="<?= $token ?>">
  <label>Username<input name="user" autocomplete="username" required autofocus></label>
  <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
</form>
</body>
</html>
