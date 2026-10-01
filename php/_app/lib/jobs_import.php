<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// Shared JSON -> jobs import logic used by both the CLI tool
// (_app/tools/import-jobs.php) and the admin API (admin/api.php).
// Insert-only: a job is written only when its id is not already present.

function job_import_text($value): string
{
    if (is_string($value)) {
        return trim($value);
    }
    if (is_scalar($value)) {
        return trim((string) $value);
    }
    return '';
}

function job_import_list($value): array
{
    if (!is_array($value)) {
        return [];
    }
    return array_values(array_map(static function ($item): string {
        return is_scalar($item) ? (string) $item : '';
    }, $value));
}

function job_import_date(string $value): string
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
        return $value;
    }
    return gmdate('Y-m-d');
}

function job_import_active(array $job): int
{
    if (!array_key_exists('active', $job)) {
        return 1;
    }
    return $job['active'] ? 1 : 0;
}

// Decode a JSON document that is either an array of job objects or an object
// with a "jobs" array. Throws InvalidArgumentException on malformed input.
function jobs_from_json(string $raw): array
{
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new InvalidArgumentException('Invalid JSON: ' . json_last_error_msg());
    }
    if (!is_array($data)) {
        throw new InvalidArgumentException('JSON root must be an array of jobs or an object with a "jobs" array.');
    }
    if (!array_is_list($data)) {
        if (isset($data['jobs']) && is_array($data['jobs'])) {
            $data = $data['jobs'];
        } else {
            throw new InvalidArgumentException('JSON root must be an array of jobs or an object with a "jobs" array.');
        }
    }
    return $data;
}

/**
 * Insert jobs whose id is not already present. Existing rows are never modified.
 *
 * @return array{imported:int,skipped:int,invalid:int,total:int,details:array<int,array<string,mixed>>}
 */
function import_jobs_data(array $jobs, string $source = 'import', bool $dryRun = false): array
{
    $pdo = db();
    $exists = $pdo->prepare('SELECT 1 FROM jobs WHERE id = ? LIMIT 1');
    $insert = $pdo->prepare(
        'INSERT INTO jobs (id,title,location,type,department,posted,summary,description,responsibilities,requirements,skills,sourceUrl,source,lastRefreshed,active,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())'
    );

    $imported = 0;
    $skipped = 0;
    $invalid = 0;
    $details = [];

    $pdo->beginTransaction();
    try {
        foreach ($jobs as $index => $job) {
            if (!is_array($job)) {
                $invalid++;
                $details[] = ['action' => 'invalid', 'index' => $index, 'reason' => 'not an object'];
                continue;
            }

            $id = job_import_text($job['id'] ?? '');
            $title = job_import_text($job['title'] ?? '');
            if ($id === '' || $title === '') {
                $invalid++;
                $details[] = ['action' => 'invalid', 'index' => $index, 'reason' => 'missing ' . ($id === '' ? 'id' : 'title')];
                continue;
            }

            $exists->execute([$id]);
            if ($exists->fetchColumn() !== false) {
                $skipped++;
                $details[] = ['action' => 'skip', 'id' => $id];
                continue;
            }

            $insert->execute([
                $id,
                $title,
                job_import_text($job['location'] ?? ''),
                job_import_text($job['type'] ?? ''),
                job_import_text($job['department'] ?? ''),
                job_import_date(job_import_text($job['posted'] ?? '')),
                job_import_text($job['summary'] ?? ''),
                job_import_text($job['description'] ?? ''),
                json_encode(job_import_list($job['responsibilities'] ?? [])),
                json_encode(job_import_list($job['requirements'] ?? [])),
                json_encode(job_import_list($job['skills'] ?? [])),
                job_import_text($job['sourceUrl'] ?? ''),
                $source,
                gmdate('Y-m-d'),
                job_import_active($job),
            ]);

            $imported++;
            $details[] = ['action' => 'insert', 'id' => $id, 'title' => $title];
        }

        if ($dryRun) {
            $pdo->rollBack();
        } else {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $total = (int) $pdo->query('SELECT COUNT(*) FROM jobs')->fetchColumn();

    return ['imported' => $imported, 'skipped' => $skipped, 'invalid' => $invalid, 'total' => $total, 'details' => $details];
}
