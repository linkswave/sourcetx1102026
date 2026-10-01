<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/jobs.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_out(['ok' => false, 'message' => 'Method not allowed.'], 405);
}
json_out(all_jobs());
