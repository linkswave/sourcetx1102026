<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/submissions.php';
require_once __DIR__ . '/../_app/lib/auth.php';

session_boot();
require_admin();

$kind = (string) ($_GET['kind'] ?? '');
if (!submission_table($kind)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not found';
    exit;
}

$rows = list_submissions($kind);

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $kind . '.csv"');
echo csv_export($rows);
