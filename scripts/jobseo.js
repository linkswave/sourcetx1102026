'use strict';

const BASE = 'https://sourcetx.com/';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attr(s) {
  return esc(s).replace(/"/g, '&quot;');
}

function addDays(iso, days) {
  if (!iso) return undefined;
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseLoc(loc) {
  if (/remote/i.test(String(loc || '').trim())) return { remote: true };
  const cityPart = String(loc || '').split('/')[0].trim();
  const bits = cityPart.split(',').map(s => s.trim());
  const address = { '@type': 'PostalAddress', addressLocality: bits[0] };
  if (bits[1]) {
    if (/^[A-Za-z]{2}$/.test(bits[1])) address.addressRegion = bits[1].toUpperCase();
    else address.addressCountry = bits[1] === 'United Kingdom' ? 'GB' : bits[1];
  }
  if (!address.addressCountry) address.addressCountry = 'US';
  return { remote: false, address };
}

function employmentType(type) {
  if (type === 'Contract') return 'CONTRACTOR';
  if (type === 'Contract-to-Hire' || type === 'Direct Hire') return 'FULL_TIME';
  return 'OTHER';
}

function jobUrl(job) {
  return BASE + 'jobs/' + encodeURIComponent(job.id);
}

function jobPosting(job, url) {
  const u = url || jobUrl(job);
  const description = '<p>' + esc(job.description || job.summary) + '</p>' +
    '<h3>Responsibilities</h3><ul>' + (job.responsibilities || []).map(r => '<li>' + esc(r) + '</li>').join('') + '</ul>' +
    '<h3>Requirements</h3><ul>' + (job.requirements || []).map(r => '<li>' + esc(r) + '</li>').join('') + '</ul>' +
    '<h3>Skills</h3><p>' + esc((job.skills || []).join(', ')) + '</p>';
  const posting = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description,
    identifier: { '@type': 'PropertyValue', name: 'SourceTX', value: job.id },
    employmentType: employmentType(job.type),
    directApply: true,
    hiringOrganization: { '@type': 'Organization', name: 'SourceTX', sameAs: 'https://sourcetx.com', logo: BASE + 'pictures/sourceTX-mark.png' },
    url: u
  };
  const posted = job.posted || job.lastRefreshed;
  if (posted) {
    posting.datePosted = posted;
    const validThrough = addDays(posted, 90);
    if (validThrough) posting.validThrough = validThrough;
  }
  const loc = parseLoc(job.location);
  if (loc.remote) {
    posting.jobLocationType = 'TELECOMMUTE';
    posting.applicantLocationRequirements = { '@type': 'Country', name: 'United States' };
  } else {
    posting.jobLocation = { '@type': 'Place', address: loc.address };
  }
  return posting;
}

function breadcrumbList(job, url) {
  const u = url || jobUrl(job);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Careers', item: BASE + 'job-seekers.html' },
      { '@type': 'ListItem', position: 3, name: 'Jobs', item: BASE + 'jobs.html' },
      { '@type': 'ListItem', position: 4, name: job.title, item: u }
    ]
  };
}

function ldScripts(objs) {
  return objs.map(o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>').join('\n');
}

function metaTitle(job) {
  return job.title + ' | SourceTX Careers';
}

function metaDescription(job) {
  return job.summary || ('View details for the ' + job.title + ' position with SourceTX.');
}

function renderJobPage(template, job, basePath) {
  const url = basePath || jobUrl(job);
  const title = metaTitle(job);
  const desc = metaDescription(job);
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>');
  html = html.replace(/(<meta name="description" content=")[^"]*(">)/, '$1' + attr(desc) + '$2');
  html = html.replace(/(<link rel="canonical" href=")[^"]*(">)/, '$1' + attr(url) + '$2');
  html = html.replace(/(<meta property="og:url" content=")[^"]*(">)/, '$1' + attr(url) + '$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*(">)/, '$1' + attr(title) + '$2');
  html = html.replace(/(<meta property="og:description" content=")[^"]*(">)/, '$1' + attr(desc) + '$2');
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + attr(title) + '$2');
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + attr(desc) + '$2');
  html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="index,follow">');
  const anchor = '<script defer src="js/job-detail.js"></script>';
  const blocks = ldScripts([breadcrumbList(job, url), jobPosting(job, url)]);
  if (html.includes(anchor)) html = html.replace(anchor, blocks + '\n  ' + anchor);
  else html = html.replace('</head>', blocks + '\n</head>');
  return html;
}

module.exports = { BASE, jobUrl, jobPosting, breadcrumbList, ldScripts, renderJobPage, esc, attr };
