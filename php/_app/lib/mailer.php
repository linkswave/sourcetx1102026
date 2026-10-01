<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

function mail_configured(): bool
{
    return (string) config('smtpHost', '') !== '';
}

function send_mail(string $to, string $subject, string $body, ?string $replyTo = null, bool $html = false, array $attachments = []): bool
{
    if (!mail_configured() || $to === '') {
        return false;
    }
    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = (string) config('smtpHost');
        $mail->Port = (int) config('smtpPort', 465);
        $secure = (string) config('smtpSecure', 'ssl');
        if ($secure !== '') {
            $mail->SMTPSecure = $secure;
        }
        $mail->SMTPAuth = (string) config('smtpUser', '') !== '';
        $mail->Username = (string) config('smtpUser', '');
        $mail->Password = (string) config('smtpPass', '');
        $mail->CharSet = 'UTF-8';
        $mail->setFrom((string) config('mailFrom', config('smtpUser', 'no-reply@sourcetx.com')), 'SourceTX');
        $mail->addAddress($to);
        if ($replyTo) {
            $mail->addReplyTo($replyTo);
        }
        $mail->Subject = $subject;
        if ($html) {
            $mail->isHTML(true);
            $mail->Body = $body;
            $mail->AltBody = strip_tags($body);
        } else {
            $mail->Body = $body;
        }
        foreach ($attachments as $attachment) {
            $path = (string) ($attachment['path'] ?? '');
            if ($path !== '' && is_file($path)) {
                $mail->addAttachment($path, (string) ($attachment['name'] ?? ''));
            }
        }
        return $mail->send();
    } catch (PHPMailerException $e) {
        error_log('[sourcetx] mail error: ' . $e->getMessage());
        return false;
    }
}

function notify(string $subject, string $body, ?string $replyTo = null, array $attachments = []): bool
{
    $to = (string) config('notifyEmail', '');
    return send_mail($to, $subject, $body, $replyTo, false, $attachments);
}
