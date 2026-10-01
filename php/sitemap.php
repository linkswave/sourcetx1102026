<?php
declare(strict_types=1);

require_once __DIR__ . '/_app/lib/bootstrap.php';
require_once __DIR__ . '/_app/lib/jobs.php';

$base = @file_get_contents(PUBLIC_ROOT . '/sitemap.xml');
if ($base === false) {
    $base = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n" . '</urlset>';
}

$jobUrls = [];
foreach (all_jobs() as $job) {
    $loc = str_replace('&', '&amp;', job_url($job));
    $entry = '  <url><loc>' . $loc . '</loc>';
    if (!empty($job['posted'])) {
        $entry .= '<lastmod>' . esc_html($job['posted']) . '</lastmod>';
    }
    $entry .= '<changefreq>weekly</changefreq><priority>0.5</priority></url>';
    $jobUrls[] = $entry;
}

$out = ($jobUrls && strpos($base, '</urlset>') !== false)
    ? str_replace('</urlset>', implode("\n", $jobUrls) . "\n</urlset>", $base)
    : $base;

header('Content-Type: application/xml; charset=utf-8');
echo $out;
