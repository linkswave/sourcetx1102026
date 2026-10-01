<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function base_url(): string
{
    return rtrim((string) config('siteUrl', 'https://sourcetx.com'), '/') . '/';
}

function esc_html($s): string
{
    return htmlspecialchars((string) ($s ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function esc_attr($s): string
{
    return htmlspecialchars((string) ($s ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function json_list($value): array
{
    if (is_array($value)) {
        return $value;
    }
    if (!is_string($value) || $value === '') {
        return [];
    }
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function normalize_job(array $row): array
{
    $row['responsibilities'] = json_list($row['responsibilities'] ?? '');
    $row['requirements'] = json_list($row['requirements'] ?? '');
    $row['skills'] = json_list($row['skills'] ?? '');
    $row['active'] = (bool) ($row['active'] ?? true);
    return $row;
}

function all_jobs(bool $activeOnly = true): array
{
    $sql = 'SELECT * FROM jobs';
    if ($activeOnly) {
        $sql .= ' WHERE active = 1';
    }
    $sql .= ' ORDER BY posted DESC, id ASC';
    $rows = db()->query($sql)->fetchAll();
    return array_map('normalize_job', $rows);
}

function find_job(string $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM jobs WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? normalize_job($row) : null;
}

function insert_job(array $data): string
{
    $id = (string) ($data['id'] ?? '');
    if ($id === '') {
        $id = strtolower(preg_replace('/[^a-z0-9]+/i', '-', (string) ($data['title'] ?? 'job')));
        $id = trim($id, '-') ?: uuid();
    }
    $stmt = db()->prepare(
        'INSERT INTO jobs (id,title,location,type,department,posted,summary,description,responsibilities,requirements,skills,sourceUrl,source,lastRefreshed,active,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())'
    );
    $stmt->execute([
        $id,
        $data['title'] ?? '',
        $data['location'] ?? '',
        $data['type'] ?? '',
        $data['department'] ?? '',
        $data['posted'] ?? date('Y-m-d'),
        $data['summary'] ?? '',
        $data['description'] ?? '',
        json_encode(json_list($data['responsibilities'] ?? [])),
        json_encode(json_list($data['requirements'] ?? [])),
        json_encode(json_list($data['skills'] ?? [])),
        $data['sourceUrl'] ?? '',
        $data['source'] ?? 'manual',
        $data['lastRefreshed'] ?? date('Y-m-d'),
        !empty($data['active']) ? 1 : 0,
    ]);
    return $id;
}

function update_job(string $id, array $data): bool
{
    $existing = find_job($id);
    if (!$existing) {
        return false;
    }
    $merged = array_merge($existing, $data);
    if (empty($merged['lastRefreshed'])) {
        $merged['lastRefreshed'] = date('Y-m-d');
    }
    $stmt = db()->prepare(
        'UPDATE jobs SET title=?,location=?,type=?,department=?,posted=?,summary=?,description=?,responsibilities=?,requirements=?,skills=?,sourceUrl=?,active=?,lastRefreshed=?,updatedAt=NOW() WHERE id=?'
    );
    $stmt->execute([
        $merged['title'],
        $merged['location'],
        $merged['type'],
        $merged['department'],
        $merged['posted'],
        $merged['summary'],
        $merged['description'],
        json_encode(json_list($merged['responsibilities'])),
        json_encode(json_list($merged['requirements'])),
        json_encode(json_list($merged['skills'])),
        $merged['sourceUrl'],
        !empty($merged['active']) ? 1 : 0,
        $merged['lastRefreshed'],
        $id,
    ]);
    return true;
}

function set_active(string $id, bool $active): bool
{
    $stmt = db()->prepare('UPDATE jobs SET active = ?, updatedAt = NOW() WHERE id = ?');
    $stmt->execute([$active ? 1 : 0, $id]);
    return $stmt->rowCount() > 0;
}

function deactivate_job(string $id): bool
{
    $stmt = db()->prepare('UPDATE jobs SET active = 0, closedAt = NOW(), updatedAt = NOW() WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
}

function job_url(array $job): string
{
    return base_url() . 'jobs/' . rawurlencode((string) $job['id']);
}

function add_days(?string $iso, int $days): ?string
{
    if (empty($iso)) {
        return null;
    }
    $d = DateTime::createFromFormat('Y-m-d', substr($iso, 0, 10), new DateTimeZone('UTC'));
    if (!$d) {
        return null;
    }
    $d->modify('+' . $days . ' days');
    return $d->format('Y-m-d');
}

function parse_loc(?string $loc): array
{
    if (preg_match('/remote/i', trim((string) $loc))) {
        return ['remote' => true];
    }
    $cityPart = trim(explode('/', (string) $loc)[0]);
    $bits = array_map('trim', explode(',', $cityPart));
    $address = ['@type' => 'PostalAddress', 'addressLocality' => $bits[0] ?? ''];
    if (!empty($bits[1])) {
        if (preg_match('/^[A-Za-z]{2}$/', $bits[1])) {
            $address['addressRegion'] = strtoupper($bits[1]);
        } else {
            $address['addressCountry'] = $bits[1] === 'United Kingdom' ? 'GB' : $bits[1];
        }
    }
    if (empty($address['addressCountry'])) {
        $address['addressCountry'] = 'US';
    }
    return ['remote' => false, 'address' => $address];
}

function employment_type(?string $type): string
{
    if ($type === 'Contract') {
        return 'CONTRACTOR';
    }
    if ($type === 'Contract-to-Hire' || $type === 'Direct Hire') {
        return 'FULL_TIME';
    }
    return 'OTHER';
}

function job_posting(array $job, ?string $url = null): array
{
    $u = $url ?: job_url($job);
    $description = '<p>' . esc_html($job['description'] ?: $job['summary']) . '</p>'
        . '<h3>Responsibilities</h3><ul>' . implode('', array_map(fn($r) => '<li>' . esc_html($r) . '</li>', json_list($job['responsibilities']))) . '</ul>'
        . '<h3>Requirements</h3><ul>' . implode('', array_map(fn($r) => '<li>' . esc_html($r) . '</li>', json_list($job['requirements']))) . '</ul>'
        . '<h3>Skills</h3><p>' . esc_html(implode(', ', json_list($job['skills']))) . '</p>';
    $posting = [
        '@context' => 'https://schema.org',
        '@type' => 'JobPosting',
        'title' => $job['title'],
        'description' => $description,
        'identifier' => ['@type' => 'PropertyValue', 'name' => 'SourceTX', 'value' => $job['id']],
        'employmentType' => employment_type($job['type'] ?? ''),
        'directApply' => true,
        'hiringOrganization' => [
            '@type' => 'Organization',
            'name' => 'SourceTX',
            'sameAs' => 'https://sourcetx.com',
            'logo' => base_url() . 'pictures/sourceTX-mark.png',
        ],
        'url' => $u,
    ];
    $posted = $job['posted'] ?? ($job['lastRefreshed'] ?? '');
    if (!empty($posted)) {
        $posting['datePosted'] = substr((string) $posted, 0, 10);
        $valid = add_days((string) $posted, 90);
        if ($valid) {
            $posting['validThrough'] = $valid;
        }
    }
    $loc = parse_loc($job['location'] ?? '');
    if (!empty($loc['remote'])) {
        $posting['jobLocationType'] = 'TELECOMMUTE';
        $posting['applicantLocationRequirements'] = ['@type' => 'Country', 'name' => 'United States'];
    } else {
        $posting['jobLocation'] = ['@type' => 'Place', 'address' => $loc['address']];
    }
    return $posting;
}

function breadcrumb_list(array $job, ?string $url = null): array
{
    $u = $url ?: job_url($job);
    return [
        '@context' => 'https://schema.org',
        '@type' => 'BreadcrumbList',
        'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => base_url()],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'Careers', 'item' => base_url() . 'job-seekers.html'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => 'Jobs', 'item' => base_url() . 'jobs.html'],
            ['@type' => 'ListItem', 'position' => 4, 'name' => $job['title'], 'item' => $u],
        ],
    ];
}

function ld_scripts(array $objs): string
{
    return implode("\n", array_map(function ($o) {
        $json = json_encode($o, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $json = str_replace('<', '\\u003c', (string) $json);
        return '<script type="application/ld+json">' . $json . '</script>';
    }, $objs));
}

function meta_title(array $job): string
{
    return $job['title'] . ' | SourceTX Careers';
}

function meta_description(array $job): string
{
    return !empty($job['summary']) ? $job['summary'] : ('View details for the ' . $job['title'] . ' position with SourceTX.');
}

function render_job_page(string $template, array $job, ?string $url = null): string
{
    $u = $url ?: job_url($job);
    $title = meta_title($job);
    $desc = meta_description($job);
    $html = $template;
    $html = preg_replace('/<title>[^<]*<\/title>/', '<title>' . esc_html($title) . '</title>', $html, 1);
    $html = preg_replace('/(<meta name="description" content=")[^"]*(">)/', '${1}' . esc_attr($desc) . '${2}', $html, 1);
    $html = preg_replace('/(<link rel="canonical" href=")[^"]*(">)/', '${1}' . esc_attr($u) . '${2}', $html, 1);
    $html = preg_replace('/(<meta property="og:url" content=")[^"]*(">)/', '${1}' . esc_attr($u) . '${2}', $html, 1);
    $html = preg_replace('/(<meta property="og:title" content=")[^"]*(">)/', '${1}' . esc_attr($title) . '${2}', $html, 1);
    $html = preg_replace('/(<meta property="og:description" content=")[^"]*(">)/', '${1}' . esc_attr($desc) . '${2}', $html, 1);
    $html = preg_replace('/(<meta name="twitter:title" content=")[^"]*(">)/', '${1}' . esc_attr($title) . '${2}', $html, 1);
    $html = preg_replace('/(<meta name="twitter:description" content=")[^"]*(">)/', '${1}' . esc_attr($desc) . '${2}', $html, 1);
    $html = preg_replace('/<meta name="robots" content="[^"]*">/', '<meta name="robots" content="index,follow">', $html, 1);
    $anchor = '<script defer src="js/job-detail.js"></script>';
    $blocks = ld_scripts([breadcrumb_list($job, $u), job_posting($job, $u)]);
    $html = str_replace($anchor, $blocks . "\n  " . $anchor, $html);
    return $html;
}

function fmt_posted(?string $d): string
{
    if (empty($d)) {
        return '';
    }
    $dt = DateTime::createFromFormat('Y-m-d', substr($d, 0, 10), new DateTimeZone('UTC'));
    return $dt ? $dt->format('M j, Y') : (string) $d;
}

// Fill the empty body placeholders exactly like public/js/job-detail.js.
function render_job_body(string $html, array $job): string
{
    $sets = [
        'jd-department' => esc_html($job['department'] ?? ''),
        'jd-title' => esc_html($job['title'] ?? ''),
        'jd-meta' => esc_html(($job['location'] ?? '') . ' · ' . ($job['type'] ?? '')),
        'jd-summary' => esc_html($job['summary'] ?? ''),
        'jd-description' => esc_html($job['description'] ?? ''),
        'jd-sidebar-title' => esc_html($job['title'] ?? ''),
    ];
    foreach ($sets as $id => $value) {
        $pattern = '/(id="' . preg_quote($id, '/') . '"[^>]*>)(.*?)(<\/[a-z0-9]+>)/is';
        $html = preg_replace($pattern, '${1}' . $value . '${3}', $html, 1);
    }
    $lists = [
        'jd-responsibilities' => array_map(fn($x) => '<li>' . esc_html($x) . '</li>', json_list($job['responsibilities'] ?? [])),
        'jd-requirements' => array_map(fn($x) => '<li>' . esc_html($x) . '</li>', json_list($job['requirements'] ?? [])),
        'jd-skills' => array_map(fn($x) => '<span class="tag">' . esc_html($x) . '</span>', json_list($job['skills'] ?? [])),
    ];
    foreach ($lists as $id => $items) {
        $pattern = '/(id="' . preg_quote($id, '/') . '"[^>]*>)(.*?)(<\/[a-z0-9]+>)/is';
        $html = preg_replace($pattern, '${1}' . implode('', $items) . '${3}', $html, 1);
    }
    $applyUrl = base_url() . 'apply/' . rawurlencode((string) $job['id']);
    $html = preg_replace('/(href=")[^"]*("[^>]*id="jd-apply")/', '${1}' . esc_attr($applyUrl) . '${2}', $html, 1);
    $html = preg_replace('/(href=")[^"]*("[^>]*id="jd-sidebar-apply")/', '${1}' . esc_attr($applyUrl) . '${2}', $html, 1);
    $sidebar = esc_html($job['location'] ?? '') . '<br>' . esc_html($job['type'] ?? '') . ' · Posted ' . esc_html(fmt_posted($job['posted'] ?? ''));
    $html = preg_replace('/(id="jd-sidebar-meta"[^>]*>)(.*?)(<\/[a-z0-9]+>)/is', '${1}' . $sidebar . '${3}', $html, 1);
    return $html;
}

function render_apply_page(string $template, array $job): string
{
    $url = base_url() . 'apply/' . rawurlencode((string) $job['id']);
    $title = 'Apply: ' . $job['title'] . ' | SourceTX Careers';
    $desc = 'Apply for the ' . $job['title'] . ' position with SourceTX.';
    $html = $template;
    $html = preg_replace('/<title>[^<]*<\/title>/', '<title>' . esc_html($title) . '</title>', $html, 1);
    $html = preg_replace('/(<meta name="description" content=")[^"]*(">)/', '${1}' . esc_attr($desc) . '${2}', $html, 1);
    $html = preg_replace('/(<link rel="canonical" href=")[^"]*(">)/', '${1}' . esc_attr($url) . '${2}', $html, 1);
    $html = preg_replace('/(id="apply-job-id"[^>]*value=")[^"]*(")/', '${1}' . esc_attr($job['id']) . '${2}', $html, 1);
    $html = preg_replace('/(id="apply-title"[^>]*>)(.*?)(<\/[a-z0-9]+>)/is', '${1}' . esc_html($job['title']) . '${3}', $html, 1);
    $meta = esc_html(($job['location'] ?? '') . ' · ' . ($job['type'] ?? ''));
    $html = preg_replace('/(id="apply-meta"[^>]*>)(.*?)(<\/[a-z0-9]+>)/is', '${1}' . $meta . '${3}', $html, 1);
    return $html;
}
