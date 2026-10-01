<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/jobs.php';
require_once __DIR__ . '/../_app/lib/mailer.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_out(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$required = ['name', 'company', 'email', 'needs', 'consent'];
foreach ($required as $key) {
    if (field($key) === '') {
        json_out(['ok' => false, 'message' => 'Please complete all required fields and provide consent.'], 400);
    }
}
if (!filter_var(field('email'), FILTER_VALIDATE_EMAIL)) {
    json_out(['ok' => false, 'message' => 'Please provide a valid email address.'], 400);
}

$item = [
    'id' => uuid(),
    'submittedAt' => gmdate('Y-m-d H:i:s'),
    'status' => 'new',
    'name' => field('name'),
    'company' => field('company'),
    'email' => field('email'),
    'phone' => field('phone'),
    'service' => field('service'),
    'targetDate' => field('targetDate'),
    'needs' => field('needs'),
];
$stmt = db()->prepare(
    'INSERT INTO talent_requests (id,submittedAt,status,name,company,email,phone,service,targetDate,needs,isRead,replies) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)'
);
$stmt->execute([$item['id'], $item['submittedAt'], $item['status'], $item['name'], $item['company'], $item['email'], $item['phone'], $item['service'], $item['targetDate'], $item['needs'], '[]']);

notify(
    'Talent request: ' . $item['company'],
    $item['name'] . "\n" . $item['email'] . "\n" . $item['phone'] . "\n" . $item['service'] . "\n" . $item['targetDate'] . "\n\n" . $item['needs'],
    $item['email']
);

json_out(['ok' => true, 'message' => 'Thank you. A SourceTX specialist will contact you about your request.']);
