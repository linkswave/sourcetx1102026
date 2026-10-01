<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/jobs.php';

const SUBMISSION_TABLES = [
    'applications' => 'applications',
    'messages' => 'messages',
    'talent-requests' => 'talent_requests',
    'chat-captures' => 'chat_captures',
];

function submission_table(string $kind): ?string
{
    return SUBMISSION_TABLES[$kind] ?? null;
}

function to_iso(?string $dbDate): ?string
{
    if (empty($dbDate)) {
        return $dbDate;
    }
    if (strpos($dbDate, 'T') !== false) {
        return $dbDate;
    }
    return str_replace(' ', 'T', $dbDate) . 'Z';
}

function normalize_record(array $row): array
{
    $row['submittedAt'] = to_iso($row['submittedAt'] ?? null);
    $row['read'] = !empty($row['isRead']);
    unset($row['isRead']);
    $replies = json_list($row['replies'] ?? '[]');
    $row['replies'] = $replies;
    return $row;
}

function list_submissions(string $kind): array
{
    $table = submission_table($kind);
    if (!$table) {
        return [];
    }
    $rows = db()->query('SELECT * FROM ' . $table . ' ORDER BY submittedAt DESC')->fetchAll();
    return array_map('normalize_record', $rows);
}

function mark_read(string $kind, string $id, bool $read): void
{
    $table = submission_table($kind);
    if (!$table) {
        return;
    }
    $stmt = db()->prepare('UPDATE ' . $table . ' SET isRead = ? WHERE id = ?');
    $stmt->execute([$read ? 1 : 0, $id]);
}

function add_reply(string $kind, string $id, array $reply): void
{
    $table = submission_table($kind);
    if (!$table) {
        return;
    }
    $stmt = db()->prepare('SELECT replies FROM ' . $table . ' WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        return;
    }
    $replies = json_list($row['replies'] ?? '[]');
    $replies[] = $reply;
    $u = db()->prepare('UPDATE ' . $table . ' SET replies = ?, isRead = 1 WHERE id = ?');
    $u->execute([json_encode($replies), $id]);
}

function csv_export(array $rows): string
{
    if (!$rows) {
        return '';
    }
    $keys = array_keys($rows[0]);
    $q = function ($v) {
        if (is_array($v)) {
            $v = json_encode($v);
        }
        return '"' . str_replace('"', '""', (string) ($v ?? '')) . '"';
    };
    $lines = [implode(',', array_map($q, $keys))];
    foreach ($rows as $r) {
        $lines[] = implode(',', array_map(fn($k) => $q($r[$k] ?? ''), $keys));
    }
    return implode("\n", $lines);
}
