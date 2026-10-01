const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const CONTENT_PATH = path.join(ROOT, 'data', 'content.json');

const HS = '<!--src-shell-header-->';
const HE = '<!--src-shell-header-end-->';
const FS = '<!--src-shell-footer-->';
const FE = '<!--src-shell-footer-end-->';

const DEFAULT_CONTENT = {
  nav: {
    home: 'Home',
    about: 'About',
    services: 'Services',
    solutions: 'Solutions',
    aiData: 'AI & Data',
    industries: 'Industries',
    technology: 'Technology',
    insights: 'Insights',
    careers: 'Careers',
    jobs: 'Jobs',
    contact: 'Contact',
  },
  cta: { label: 'Talk to an Expert', href: 'contact.html' },
  hero: {
    eyebrow: 'Technology Engineering & AI Transformation',
    title: 'Build smarter. Move faster. Transform with confidence.',
    subtitle:
      'SourceTX helps organizations modernize applications, automate operations, unlock the value of their data, and build intelligent digital products.',
    primary: 'Start Your Project',
    secondary: 'Explore Our Services',
  },
  footer: {
    tagline:
      'Technology engineering and AI transformation — software, cloud, data, AI, automation, and security from strategy to production.',
    email: 'info@sourcetx.com',
    phone: '+1 (201) 500-7797',
    name: 'SourceTX',
  },
};

const SKIP = new Set([
  'application-engineering.html',
  'cloud-infrastructure.html',
  'cybersecurity-quality.html',
  'data-ai-analytics.html',
  'talent-workforce.html',
]);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadContent() {
  try {
    const merged = { ...DEFAULT_CONTENT };
    const file = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
    merged.nav = { ...merged.nav, ...(file.nav || {}) };
    merged.cta = { ...merged.cta, ...(file.cta || {}) };
    merged.hero = { ...merged.hero, ...(file.hero || {}) };
    merged.footer = { ...merged.footer, ...(file.footer || {}) };
    return merged;
  } catch {
    return { ...DEFAULT_CONTENT };
  }
}

function saveContent(content) {
  const file = { nav: {}, cta: {}, hero: {}, footer: {} };
  for (const k of Object.keys(DEFAULT_CONTENT.nav)) file.nav[k] = content.nav[k];
  for (const k of Object.keys(DEFAULT_CONTENT.cta)) file.cta[k] = content.cta[k];
  for (const k of Object.keys(DEFAULT_CONTENT.hero)) file.hero[k] = content.hero[k];
  for (const k of Object.keys(DEFAULT_CONTENT.footer)) file.footer[k] = content.footer[k];
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(file, null, 2) + '\n');
}

const SERVICES_MENU = [
  ['Engineering &amp; Delivery', [
    ['software-development.html', 'Software Development'],
    ['mobile-app-development.html', 'Mobile App Development'],
    ['ui-ux-design.html', 'UI/UX Design'],
    ['qa-testing.html', 'QA &amp; Testing'],
    ['project-management.html', 'Project Management'],
  ]],
  ['Cloud &amp; Data', [
    ['cloud-devops.html', 'Cloud &amp; DevOps'],
    ['cloud-infrastructure-optimization.html', 'Cloud Optimization &amp; Infrastructure'],
    ['data-analytics.html', 'Data &amp; Analytics'],
    ['data-engineering-pipelines.html', 'Data Engineering &amp; Pipelines'],
  ]],
  ['AI &amp; Transformation', [
    ['ai-machine-learning.html', 'AI &amp; Machine Learning'],
    ['ai-automation-agents.html', 'AI Automation &amp; Agents'],
    ['ai-workflow-automation.html', 'AI Integration &amp; Workflow'],
    ['digital-transformation.html', 'Digital Transformation'],
  ]],
  ['Talent &amp; Security', [
    ['staff-augmentation.html', 'Staff Augmentation'],
    ['managed-security-compliance.html', 'Managed Security &amp; Compliance'],
  ]],
];

const CAREERS_MENU = [
  ['job-seekers.html', 'Job Seekers'],
  ['jobs.html', 'Open Roles'],
  ['employers.html', 'Work With Us'],
];

const SOLUTIONS_MENU = [
  ['index.html#solutions-build-ai', 'Build Enterprise AI'],
  ['index.html#solutions-modernize-data', 'Modernize My Data Platform'],
  ['index.html#solutions-value-data', 'Get More Value From My Data'],
  ['index.html#solutions-cloud', 'Move to the Cloud'],
  ['index.html#solutions-automate', 'Automate Business Processes'],
  ['index.html#solutions-optimize', 'Improve Performance &amp; Reduce Cost'],
  ['case-studies.html', 'Case Studies'],
  ['ai-lab.html', 'SourceTX AI Lab'],
  ['assessment.html', 'Data &amp; AI Assessment'],
  ['managed-services.html', 'Managed Services'],
];

const AIDATA_MENU = [
  ['ai-machine-learning.html', 'AI &amp; Machine Learning'],
  ['ai-automation-agents.html', 'AI Automation &amp; Agents'],
  ['ai-workflow-automation.html', 'AI Integration &amp; Workflow'],
  ['data-analytics.html', 'Data &amp; Analytics'],
  ['data-engineering-pipelines.html', 'Data Engineering &amp; Pipelines'],
  ['cloud-devops.html', 'Cloud &amp; DevOps'],
  ['ai-lab.html', 'SourceTX AI Lab'],
];

const AI_LAB_FILES = new Set(['ai-lab.html']);
const SOLUTION_FILES = new Set(['case-studies.html', 'assessment.html', 'managed-services.html']);

const SERVICE_FILES = new Set(
  SERVICES_MENU.reduce((acc, [, items]) => acc.concat(items.map(([href]) => href)), [])
);

const CARET =
  '<svg viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function activeHrefFor(file) {
  if (file === 'index.html') return 'index.html';
  if (file === 'about.html') return 'about.html';
  if (file === 'insights.html') return 'insights.html';
  if (file === 'employers.html') return 'employers.html';
  if (file === 'job-seekers.html' || file === 'general-application.html')
    return 'job-seekers.html';
  if (file === 'jobs.html' || file.startsWith('job-') || file.startsWith('apply-'))
    return 'jobs.html';
  if (file === 'contact.html') return 'contact.html';
  if (SOLUTION_FILES.has(file) || AI_LAB_FILES.has(file)) return file;
  if (SERVICE_FILES.has(file)) return file;
  return '';
}

function buildHeader(c, file) {
  const act = activeHrefFor(file);
  const link = (href, label) =>
    `        <a class="nav-link${href === act ? ' active' : ''}" href="${href}">${esc(label)}</a>`;
  const caret = (id, label) =>
    `          <button class="nav-caret" type="button" aria-expanded="false" aria-controls="${id}" aria-label="Toggle ${esc(label)} submenu">${CARET}</button>`;

  const servicesChildren = SERVICES_MENU.reduce(
    (acc, [, items]) => acc.concat(items.map(([href]) => href)),
    []
  );
  const servicesActive = act === 'services.html' || servicesChildren.indexOf(act) >= 0;
  const servicesCols = SERVICES_MENU.map(
    ([title, items]) =>
      '            <div class="dropdown-col">\n' +
      `              <span class="dropdown-title">${title}</span>\n` +
      items
        .map(
          ([href, label]) =>
            `              <a${href === act ? ' class="active"' : ''} href="${href}">${label}</a>`
        )
        .join('\n') +
      '\n            </div>'
  ).join('\n');
  const servicesItem =
    '        <div class="nav-item has-dropdown">\n' +
    `          <a class="nav-link${servicesActive ? ' active' : ''}" href="services.html" aria-haspopup="true">${esc(c.nav.services)}</a>\n` +
    caret('nav-menu-services', c.nav.services) +
    '\n' +
    '          <div class="dropdown mega" id="nav-menu-services">\n' +
    '            <div class="dropdown-grid">\n' +
    servicesCols +
    '\n            </div>\n' +
    '            <a class="dropdown-all" href="services.html">View all services <span aria-hidden="true">&#8594;</span></a>\n' +
    '          </div>\n' +
    '        </div>';

  const careersActive = CAREERS_MENU.some(([href]) => href === act);
  const careersLinks = CAREERS_MENU.map(
    ([href, label]) =>
      `              <a${href === act ? ' class="active"' : ''} href="${href}">${label}</a>`
  ).join('\n');
  const careersItem =
    '        <div class="nav-item has-dropdown">\n' +
    `          <a class="nav-link${careersActive ? ' active' : ''}" href="job-seekers.html" aria-haspopup="true">${esc(c.nav.careers)}</a>\n` +
    caret('nav-menu-careers', c.nav.careers) +
    '\n' +
    '          <div class="dropdown" id="nav-menu-careers">\n' +
    careersLinks +
    '\n          </div>\n' +
    '        </div>';

  const dropdownItem = (id, label, href, entries, active) => {
    const links = entries
      .map(
        ([h, t]) =>
          `              <a${h === act ? ' class="active"' : ''} href="${h}">${t}</a>`
      )
      .join('\n');
    return (
      '        <div class="nav-item has-dropdown">\n' +
      `          <a class="nav-link${active ? ' active' : ''}" href="${href}" aria-haspopup="true">${esc(label)}</a>\n` +
      caret(id, label) +
      '\n' +
      `          <div class="dropdown" id="${id}">\n` +
      links +
      '\n          </div>\n' +
      '        </div>'
    );
  };

  const solutionsActive = SOLUTION_FILES.has(act);
  const aiDataActive = AI_LAB_FILES.has(act);
  const solutionsItem = dropdownItem(
    'nav-menu-solutions',
    c.nav.solutions || 'Solutions',
    'case-studies.html',
    SOLUTIONS_MENU,
    solutionsActive
  );
  const aiDataItem = dropdownItem(
    'nav-menu-aidata',
    c.nav.aiData || 'AI & Data',
    'ai-machine-learning.html',
    AIDATA_MENU,
    aiDataActive
  );

  const items = [
    servicesItem,
    solutionsItem,
    aiDataItem,
    link('services.html#industries', c.nav.industries || 'Industries'),
    link('index.html#technology', c.nav.technology || 'Technology'),
    link('insights.html', c.nav.insights || 'Insights'),
    link('about.html', c.nav.about),
    careersItem,
  ].join('\n');

  return (
    '<header class="site-header">\n' +
    '    <div class="container nav-wrap">\n' +
    '      <a href="index.html" class="brand" aria-label="SourceTX home">\n' +
    '        <span class="logo">\n' +
    '          <img class="logo-mark" src="pictures/sourceTX-mark.png" alt="SourceTX mark" width="29" height="36">\n' +
    '          <span class="wordmark">Source<span class="tx">TX</span></span>\n' +
    '        </span>\n' +
    '      </a>\n' +
    '      <button class="menu" aria-expanded="false" aria-controls="main-nav" aria-label="Toggle navigation"><span class="menu-bar"></span><span class="menu-bar"></span><span class="menu-bar"></span></button>\n' +
    '      <nav id="main-nav">\n' +
    items +
    '\n' +
    `        <a class="btn btn-small btn-gradient" href="${esc(c.cta.href)}">${esc(c.cta.label)}</a>\n` +
    '      </nav>\n' +
    '    </div>\n' +
    '  </header>'
  );
}

function buildFooter(c) {
  const mail = c.footer.email;
  const tel = String(c.footer.phone || '').replace(/[^+\d]/g, '');
  const company = [
    ['about.html', 'About'],
    ['services.html', 'Services'],
    ['case-studies.html', 'Case Studies'],
    ['ai-lab.html', 'AI Lab'],
    ['assessment.html', 'AI Readiness Assessment'],
    ['managed-services.html', 'Managed Services'],
    ['insights.html', 'Insights'],
    ['services.html#industries', 'Industries'],
    ['employers.html', 'Work With Us'],
    ['job-seekers.html', 'Careers'],
    ['contact.html', 'Employment Verification'],
  ];
  const services = [
    ['software-development.html', 'Software Development'],
    ['mobile-app-development.html', 'Mobile App Development'],
    ['ui-ux-design.html', 'UI/UX Design'],
    ['cloud-devops.html', 'Cloud &amp; DevOps'],
    ['qa-testing.html', 'QA &amp; Testing'],
    ['data-analytics.html', 'Data &amp; Analytics'],
    ['ai-machine-learning.html', 'AI &amp; Machine Learning'],
    ['ai-automation-agents.html', 'AI Automation &amp; Agents'],
    ['digital-transformation.html', 'Digital Transformation'],
    ['staff-augmentation.html', 'Staff Augmentation'],
    ['project-management.html', 'Project Management'],
    ['ai-workflow-automation.html', 'AI Integration &amp; Workflow'],
    ['managed-security-compliance.html', 'Managed Security &amp; Compliance'],
    ['cloud-infrastructure-optimization.html', 'Cloud Optimization &amp; Infrastructure'],
    ['data-engineering-pipelines.html', 'Data Engineering &amp; Pipelines'],
  ];
  const offices = ['Fort Lee, NJ', 'Pittsburgh, PA', 'Tampa, FL', 'London, UK'];
  const col = (title, rows) =>
    '        <div class="footer-col">\n' +
    `          <strong>${title}</strong>\n` +
    rows.map((r) => `          ${r}\n`).join('') +
    '        </div>';
  return (
    '<footer class="site-footer">\n' +
    '    <div class="container">\n' +
    '      <div class="footer-grid">\n' +
    '        <div class="footer-brand">\n' +
    '          <a href="index.html" class="logo" aria-label="SourceTX home">\n' +
    '            <img class="logo-mark" src="pictures/sourceTX-mark.png" alt="SourceTX mark" width="29" height="36">\n' +
    '            <span class="wordmark">Source<span class="tx">TX</span></span>\n' +
    '          </a>\n' +
    `          <p>${esc(c.footer.tagline)}</p>\n` +
    '          <div class="footer-contact">\n' +
    `            <a href="mailto:${esc(mail)}">${esc(mail)}</a>\n` +
    `            <a href="tel:${esc(tel)}">${esc(c.footer.phone)}</a>\n` +
    '            <a href="https://www.linkedin.com/company/sourcetx-inc-" target="_blank" rel="noopener">LinkedIn</a>\n' +
    '          </div>\n' +
    '        </div>\n' +
    col('Company', company.map(([h, t]) => `<a href="${h}">${t}</a>`)) +
    '\n' +
    col('Services', services.map(([h, t]) => `<a href="${h}">${t}</a>`)) +
    '\n' +
    col('Offices', offices.map((city) => `<span>${city}</span>`)) +
    '\n' +
    '      </div>\n' +
    '      <div class="copyright">\n' +
    `        <span>© <span data-year></span> ${esc(c.footer.name)}. All rights reserved.</span>\n` +
    '        <span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></span>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </footer>'
  );
}

function ensureRegion(html, openTag, closeTag, START, END) {
  let hs = html.indexOf(START);
  if (hs < 0) {
    const o = html.indexOf(openTag);
    const cEnd = html.indexOf(closeTag, o < 0 ? 0 : o);
    if (o < 0 || cEnd < 0) return null;
    const close = cEnd + closeTag.length;
    html = html.slice(0, o) + START + '\n' + html.slice(o, close) + '\n' + END + html.slice(close);
  }
  return html;
}

function replaceRegion(html, START, END, replacement) {
  const hs = html.indexOf(START);
  const he = html.indexOf(END, hs);
  if (hs < 0 || he < 0) return null;
  const after = he + END.length;
  return html.slice(0, hs) + START + '\n' + replacement + '\n' + END + html.slice(after);
}

function applyHero(html, c) {
  const h = html.indexOf('<section class="hero"');
  if (h < 0) return html;
  const he = html.indexOf('</section>', h);
  if (he < 0) return html;
  const hero = html.slice(h, he + '</section>'.length);
  let out = hero;
  const h1 = out.indexOf('<h1>');
  if (h1 >= 0) {
    const h1c = out.indexOf('</h1>', h1);
    out = out.slice(0, h1 + 4) + `<!--e:hero.title-->${esc(c.hero.title)}<!--/e-->` + out.slice(h1c);
    const p = out.indexOf('<p>', h1);
    const pc = out.indexOf('</p>', p + 2);
    if (p >= 0 && pc > 0)
      out = out.slice(0, p + 3) + `<!--e:hero.subtitle-->${esc(c.hero.subtitle)}<!--/e-->` + out.slice(pc);
  }
  const eo = out.indexOf('<span class="eyebrow">');
  if (eo >= 0) {
    const ec = out.indexOf('</span>', eo);
    out = out.slice(0, eo + 22) + `<!--e:hero.eyebrow-->${esc(c.hero.eyebrow)}<!--/e-->` + out.slice(ec);
  }
  for (const [cls, key] of [
    ['btn btn-gradient', 'hero.primary'],
    ['btn btn-outline', 'hero.secondary'],
  ]) {
    const a = out.indexOf(`class="${cls}"`);
    if (a >= 0) {
      const ac = out.indexOf('</a>', a);
      const gt = out.indexOf('>', a);
      if (ac > 0 && gt > 0)
        out = out.slice(0, gt + 1) + `<!--e:${key}-->${esc(c.hero[key === 'hero.primary' ? 'primary' : 'secondary'])}<!--/e-->` + out.slice(ac);
    }
  }
  return html.slice(0, h) + out + html.slice(he + '</section>'.length);
}

function pageFiles() {
  return fs
    .readdirSync(PUBLIC)
    .filter((f) => f.endsWith('.html') && !SKIP.has(f))
    .sort();
}

function rebuildAll(content) {
  const c = content || loadContent();
  const changed = [];
  for (const file of pageFiles()) {
    let html;
    try {
      html = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
    } catch {
      continue;
    }
    if (html.indexOf('<header class="site-header">') < 0 && html.indexOf(HS) < 0) continue;
    const original = html;
    const withMarkers = ensureRegion(html, '<header class="site-header">', '</header>', HS, HE);
    if (!withMarkers) continue;
    let next = ensureRegion(withMarkers, '<footer class="site-footer">', '</footer>', FS, FE);
    if (!next) continue;
    next = replaceRegion(next, HS, HE, buildHeader(c, file));
    if (next === null) continue;
    next = replaceRegion(next, FS, FE, buildFooter(c));
    if (next === null) continue;
    if (file === 'index.html') next = applyHero(next, c);
    if (next !== original) {
      fs.writeFileSync(path.join(PUBLIC, file), next);
      changed.push(file);
    }
  }
  return changed;
}

module.exports = { rebuildAll, loadContent, saveContent, DEFAULT_CONTENT, CONTENT_PATH, PUBLIC };

if (require.main === module) {
  const c = loadContent();
  const changed = rebuildAll(c);
  console.log(`shell rebuilt: ${changed.length} file(s) updated`);
  for (const f of changed) console.log('  ' + f);
}
