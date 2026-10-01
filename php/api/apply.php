<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/jobs.php';
require_once __DIR__ . '/../_app/lib/mailer.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_out(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$required = ['name', 'email', 'phone', 'consent'];
foreach ($required as $key) {
    if (field($key) === '') {
        json_out(['ok' => false, 'message' => 'Complete all required fields and provide consent.'], 400);
    }
}
if (!filter_var(field('email'), FILTER_VALIDATE_EMAIL)) {
    json_out(['ok' => false, 'message' => 'Please provide a valid email address.'], 400);
}
$resumeUrl = field('resumeUrl');
if ($resumeUrl !== '' && !preg_match('#^https?://#i', $resumeUrl)) {
    json_out(['ok' => false, 'message' => 'Résumé or LinkedIn link must start with http:// or https://.'], 400);
}

$jobId = field('jobId');
if ($jobId === 'general') {
    $job = ['id' => 'general', 'title' => 'General Talent Network'];
} else {
    $found = find_job($jobId);
    $job = ($found && !empty($found['active'])) ? $found : null;
}
if (!$job) {
    json_out(['ok' => false, 'message' => 'That opportunity is no longer available.'], 400);
}

$item = [
    'id' => uuid(),
    'submittedAt' => gmdate('Y-m-d H:i:s'),
    'status' => 'new',
    'jobId' => $job['id'],
    'jobTitle' => $job['title'],
    'name' => field('name'),
    'email' => field('email'),
    'phone' => field('phone'),
    'location' => field('location'),
    'linkedin' => field('linkedin'),
    'workAuthorization' => field('workAuthorization'),
    'message' => field('message'),
    'resume' => $resumeUrl,
    'originalResumeName' => '',
];
$stmt = db()->prepare(
    'INSERT INTO applications (id,submittedAt,status,jobId,jobTitle,name,email,phone,location,linkedin,workAuthorization,message,resume,originalResumeName,isRead,replies)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)'
);
$stmt->execute([
    $item['id'], $item['submittedAt'], $item['status'], $item['jobId'], $item['jobTitle'],
    $item['name'], $item['email'], $item['phone'], $item['location'], $item['linkedin'],
    $item['workAuthorization'], $item['message'], $item['resume'], $item['originalResumeName'], '[]',
]);

$details = 'Name: ' . $item['name'] . "\nEmail: " . $item['email'] . "\nPhone: " . $item['phone']
    . ($item['location'] ? "\nLocation: " . $item['location'] : '')
    . ($item['workAuthorization'] ? "\nWork authorization: " . $item['workAuthorization'] : '')
    . "\nLinkedIn: " . ($item['linkedin'] ?: '—')
    . ($resumeUrl ? "\nRésumé/LinkedIn link: " . $resumeUrl : '')
    . "\n\n" . $item['message'];
notify('New application: ' . $job['title'], $details, $item['email']);

if ($item['email'] !== '' && mail_configured()) {
    $body = 'Hi ' . $item['name'] . ",\n\n"
        . 'Thank you for applying to the ' . $job['title'] . ' position'
        . (!empty($job['location']) ? ' (' . $job['location'] . ')' : '') . '. '
        . "Your application has been received by the SourceTX recruiting team.\n\n"
        . "If your background is a match for this role, a recruiter will contact you to discuss next steps. We appreciate your interest in joining SourceTX.\n\n"
        . "Best regards,\nSourceTX Talent Team";
    send_mail($item['email'], 'Application received: ' . $job['title'], $body, (string) config('notifyEmail', ''));
}

json_out(['ok' => true, 'message' => 'Thank you. Your application was received and will be reviewed by the SourceTX recruiting team.']);
