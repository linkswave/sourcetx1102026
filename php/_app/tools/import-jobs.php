<?php
declare(strict_types=1);

// Command-line only. Refuse to run over the web even if .htaccess is missing.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "This tool can only be run from the command line.\n";
    exit(1);
}

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/jobs_import.php';

function import_usage(): void
{
    fwrite(STDOUT, "Usage: php import-jobs.php <jobs.json> [--dry-run] [--source=NAME]\n\n");
    fwrite(STDOUT, "Imports jobs from a JSON array into the jobs table.\n");
    fwrite(STDOUT, "A job is inserted only when its id is not already present; existing rows are never changed.\n\n");
    fwrite(STDOUT, "Options:\n");
    fwrite(STDOUT, "  --dry-run        Validate and report without writing anything.\n");
    fwrite(STDOUT, "  --source=NAME    Value for the source column (default: import).\n");
    fwrite(STDOUT, "  -h, --help       Show this help.\n");
}

function import_fail(string $message): void
{
    fwrite(STDERR, '[import-jobs] ERROR: ' . $message . "\n");
    exit(1);
}

$file = null;
$dryRun = false;
$source = 'import';

foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--dry-run') {
        $dryRun = true;
    } elseif ($arg === '-h' || $arg === '--help') {
        import_usage();
        exit(0);
    } elseif (str_starts_with($arg, '--source=')) {
        $source = substr($arg, 9);
    } elseif (str_starts_with($arg, '--')) {
        import_fail('Unknown option: ' . $arg);
    } elseif ($file === null) {
        $file = $arg;
    } else {
        import_fail('Unexpected argument: ' . $arg);
    }
}

if ($file === null) {
    import_usage();
    exit(2);
}

if (!is_file($file) || !is_readable($file)) {
    import_fail('File not found or not readable: ' . $file);
}

$raw = file_get_contents($file);
if ($raw === false) {
    import_fail('Could not read file: ' . $file);
}

try {
    $jobs = jobs_from_json($raw);
} catch (InvalidArgumentException $e) {
    import_fail($e->getMessage() . ' in ' . $file);
}

if ($jobs === []) {
    import_fail('No jobs found in ' . $file . '.');
}

fwrite(STDOUT, '[import-jobs] file: ' . $file . "\n");
if ($dryRun) {
    fwrite(STDOUT, "[import-jobs] dry run - no changes will be written\n");
}

try {
    $result = import_jobs_data($jobs, $source, $dryRun);
} catch (Throwable $e) {
    import_fail($e->getMessage());
}

foreach ($result['details'] as $detail) {
    if ($detail['action'] === 'insert') {
        fwrite(STDOUT, '  INSERT   ' . $detail['id'] . '  ' . $detail['title'] . "\n");
    } elseif ($detail['action'] === 'skip') {
        fwrite(STDOUT, '  SKIP     ' . $detail['id'] . "  (already exists)\n");
    } else {
        fwrite(STDOUT, sprintf("  INVALID  #%d (%s)\n", $detail['index'], $detail['reason']));
    }
}

fwrite(STDOUT, sprintf(
    "imported %d, skipped %d, invalid %d, total now %d%s\n",
    $result['imported'],
    $result['skipped'],
    $result['invalid'],
    $result['total'],
    $dryRun ? ' (dry run)' : ''
));

exit(0);
