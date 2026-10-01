<?php
// Copy this file to config.php on the server and fill in real values.
// config.php is never committed.
return [
  'dbHost' => 'localhost',
  'dbPort' => '3306',
  'dbName' => 'sourcetx',
  'dbUser' => 'sourcetx_user',
  'dbPass' => 'CHANGE-ME',

  'smtpHost' => 'mail.sourcetx.com',
  'smtpPort' => '465',
  'smtpSecure' => 'ssl',
  'smtpUser' => 'no-reply@sourcetx.com',
  'smtpPass' => 'CHANGE-ME',
  'mailFrom' => 'no-reply@sourcetx.com',
  'notifyEmail' => 'info@sourcetx.com',

  'siteUrl' => 'https://sourcetx.com',

  'adminUser' => 'admin',
  // Generate with: php -r "echo password_hash('YOUR-PASSWORD', PASSWORD_DEFAULT);"
  'adminPassHash' => 'REPLACE_WITH_PASSWORD_HASH',
];
