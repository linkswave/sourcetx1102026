<?php
declare(strict_types=1);

require_once __DIR__ . '/../_app/lib/bootstrap.php';
require_once __DIR__ . '/../_app/lib/jobs.php';
require_once __DIR__ . '/../_app/lib/mailer.php';
require_once __DIR__ . '/../_app/lib/chat.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_out(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$message = field('message');
if ($message === '') {
    json_out(['ok' => false, 'message' => 'Please enter a question.'], 400);
}
if (mb_strlen($message, 'UTF-8') > 500) {
    json_out(['ok' => false, 'message' => 'That question is too long (500 character limit).'], 400);
}
$email = field('email');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_out(['ok' => false, 'message' => 'Please provide a valid email address.'], 400);
}

$result = chat_answer($message);

if (!empty($result['fallback'])) {
    try {
        $stmt = db()->prepare(
            'INSERT INTO chat_captures (id,submittedAt,status,email,question,intent,isRead,replies) VALUES (?,?,?,?,?,?,0,?)'
        );
        $stmt->execute([uuid(), gmdate('Y-m-d H:i:s'), 'new', $email, $message, (string) ($result['intent'] ?? 'none'), '[]']);
    } catch (Throwable $e) {
        error_log('[sourcetx] chat capture failed: ' . $e->getMessage());
    }
    notify('Chat: unanswered question', $message . "\n\n" . ($email !== '' ? $email : 'No email provided'), $email !== '' ? $email : null);
}

json_out([
    'ok' => true,
    'reply' => $result['reply'],
    'followups' => $result['followups'] ?? [],
    'fallback' => (bool) $result['fallback'],
]);
