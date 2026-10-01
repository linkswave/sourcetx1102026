const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const STORE_PATH = path.join(ROOT, 'data', 'pages.json');
const DEFAULTS_PATH = path.join(ROOT, 'data', 'page_defaults.json');

const PAGES = [
  { file: 'index.html', label: 'Home' },
  { file: 'about.html', label: 'About' },
  { file: 'services.html', label: 'Services' },
  { file: 'jobs.html', label: 'Jobs' },
  { file: 'job-seekers.html', label: 'Careers' },
  { file: 'employers.html', label: 'Work With Us' },
  { file: 'contact.html', label: 'Contact' },
  { file: 'software-development.html', label: 'Software Development' },
  { file: 'mobile-app-development.html', label: 'Mobile App Development' },
  { file: 'ui-ux-design.html', label: 'UI/UX Design' },
  { file: 'cloud-devops.html', label: 'Cloud & DevOps' },
  { file: 'qa-testing.html', label: 'QA & Testing' },
  { file: 'data-analytics.html', label: 'Data & Analytics' },
  { file: 'ai-machine-learning.html', label: 'AI & Machine Learning' },
  { file: 'ai-automation-agents.html', label: 'AI Automation & Agents' },
  { file: 'digital-transformation.html', label: 'Digital Transformation' },
  { file: 'staff-augmentation.html', label: 'Staff Augmentation' },
  { file: 'project-management.html', label: 'Project Management' },
  { file: 'ai-workflow-automation.html', label: 'AI Integration & Workflow' },
  { file: 'managed-security-compliance.html', label: 'Managed Security & Compliance' },
  { file: 'cloud-infrastructure-optimization.html', label: 'Cloud Optimization & Infrastructure' },
  { file: 'data-engineering-pipelines.html', label: 'Data Engineering & Pipelines' },
  { file: 'case-studies.html', label: 'Case Studies' },
  { file: 'ai-lab.html', label: 'SourceTX AI Lab' },
  { file: 'assessment.html', label: 'Data & AI Assessment' },
  { file: 'managed-services.html', label: 'Managed Services' },
  { file: 'insights.html', label: 'Insights' },
];

const PF_OPEN = (key) => `<!--e:pf:${key}-->`;
const PF_CLOSE = '<!--/e-->';
const mk = (key, val) => PF_OPEN(key) + val + PF_CLOSE;
const MARKER_RE = /<!--e:pf:([^>]+?)-->([\s\S]*?)<!--\/e-->/g;
const HERO_RE = /<section class="(?:hero|service-hero|page-hero)\b[^"]*"[\s\S]*?<\/section>/;

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019',
  lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', copy: '\u00a9',
  reg: '\u00ae', trade: '\u2122', times: '\u00d7',
};

function decode(s) {
  return String(s).replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    const v = ENTITIES[e];
    return v === undefined ? m : v;
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasMarkers(html) {
  return /<!--e:pf:/.test(html);
}

function stripMarkers(html) {
  return html.replace(MARKER_RE, (m, key, val) => val);
}

function mainBounds(html) {
  const open = html.indexOf('<main');
  if (open < 0) return null;
  const gt = html.indexOf('>', open);
  if (gt < 0) return null;
  const close = html.lastIndexOf('</main>');
  if (close < 0 || close < gt) return null;
  return { start: gt + 1, end: close };
}

function wrapHero(hero, file) {
  if (file === 'index.html') return hero;
  let out = hero;
  out = out.replace(
    /(<span class="eyebrow[^"]*">)([\s\S]*?)(<\/span>)/,
    (m, a, val, b) => a + mk('hero.eyebrow', val) + b
  );
  out = out.replace(
    /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/,
    (m, a, val, b) => a + mk('hero.title', val) + b
  );
  out = out.replace(
    /(<\/h1>[\s\S]*?)(<p[^>]*>)([\s\S]*?)(<\/p>)/,
    (m, pre, a, val, b) => pre + a + mk('hero.intro', val) + b
  );
  let bi = 0;
  out = out.replace(
    /(<(?:a|button) class="btn[^"]*"[^>]*>)([\s\S]*?)(<\/(?:a|button)>)/g,
    (m, a, val, b) => {
      if (val.indexOf('<') >= 0) return m;
      const key = 'hero.btn.' + bi++;
      return a + mk(key, val) + b;
    }
  );
  return out;
}

function wrapBody(body) {
  let hi = 0;
  body = body.replace(
    /(<h2[^>]*>)([\s\S]*?)(<\/h2>)/g,
    (m, a, val, b) => {
      const key = `section.${++hi}.title`;
      return a + mk(key, val) + b;
    }
  );
  let ei = 0;
  body = body.replace(
    /(<span class="eyebrow[^"]*">)([\s\S]*?)(<\/span>)/g,
    (m, a, val, b) => {
      const key = `section.${++ei}.eyebrow`;
      return a + mk(key, val) + b;
    }
  );
  body = body.replace(
    /(<!--e:pf:section\.(\d+)\.title-->[^<]*<!--\/e--><\/h2>)(\s*)(<p[^>]*>)([\s\S]*?)(<\/p>)/g,
    (m, close, n, ws, a, val, b) => {
      const key = `section.${n}.intro`;
      return close + ws + a + mk(key, val) + b;
    }
  );
  let bi = 0;
  body = body.replace(
    /(<(?:a|button) class="btn[^"]*"[^>]*>)([\s\S]*?)(<\/(?:a|button)>)/g,
    (m, a, val, b) => {
      if (val.indexOf('<') >= 0) return m;
      const key = 'button.' + bi++;
      return a + mk(key, val) + b;
    }
  );
  return body;
}

function tokenizeMain(main, file) {
  if (hasMarkers(main)) return main;
  const hm = main.match(HERO_RE);
  let heroStart = -1;
  let heroEnd = -1;
  let heroStr = '';
  if (hm) {
    heroStart = hm.index;
    heroEnd = hm.index + hm[0].length;
    heroStr = hm[0];
  }
  const placeholder = '\u0000PFHERO\u0000';
  let body = heroStart >= 0 ? main.slice(0, heroStart) + placeholder + main.slice(heroEnd) : main;
  body = wrapBody(body);
  if (heroStart >= 0) {
    heroStr = wrapHero(heroStr, file);
    body = body.replace(placeholder, () => heroStr);
  }
  return body;
}

function secGroup(titles, n) {
  const t = titles[n];
  if (!t) return `Section ${n}`;
  return `Section ${n}: ${t.length > 60 ? t.slice(0, 57) + '...' : t}`;
}

function describe(key, titles) {
  let m;
  if (key === 'hero.eyebrow') return { group: 'Hero', label: 'Eyebrow' };
  if (key === 'hero.title') return { group: 'Hero', label: 'Headline' };
  if (key === 'hero.intro') return { group: 'Hero', label: 'Intro text' };
  if ((m = key.match(/^hero\.btn\.(\d+)$/))) return { group: 'Hero', label: `Button ${+m[1] + 1}` };
  if ((m = key.match(/^section\.(\d+)\.eyebrow$/))) return { group: secGroup(titles, m[1]), label: 'Eyebrow' };
  if ((m = key.match(/^section\.(\d+)\.title$/))) return { group: secGroup(titles, m[1]), label: 'Heading' };
  if ((m = key.match(/^section\.(\d+)\.intro$/))) return { group: secGroup(titles, m[1]), label: 'Intro text' };
  if ((m = key.match(/^button\.(\d+)$/))) return { group: 'Buttons & CTAs', label: `Button ${+m[1] + 1}` };
  return { group: 'Other', label: key };
}

function readFields(html) {
  const raw = [];
  let m;
  MARKER_RE.lastIndex = 0;
  while ((m = MARKER_RE.exec(html))) raw.push({ key: m[1], value: decode(m[2]) });
  const titles = {};
  for (const f of raw) {
    const s = f.key.match(/^section\.(\d+)\.title$/);
    if (s) titles[s[1]] = f.value;
  }
  return raw.map((f) => ({ key: f.key, value: f.value, ...describe(f.key, titles) }));
}

function applyFields(html, values) {
  return html.replace(MARKER_RE, (m, key, cur) =>
    values[key] !== undefined ? PF_OPEN(key) + esc(values[key]) + PF_CLOSE : m
  );
}

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2) + '\n');
}

function loadDefaults() {
  try {
    return JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveDefaults(defaults) {
  fs.writeFileSync(DEFAULTS_PATH, JSON.stringify(defaults, null, 2) + '\n');
}

function seedDefaults() {
  const out = {};
  for (const p of PAGES) {
    const fields = pageFields(p.file);
    out[p.file] = Object.fromEntries(fields.map((f) => [f.key, f.value]));
  }
  saveDefaults(out);
  return out;
}

function readFile(file) {
  return fs.readFileSync(path.join(PUBLIC, file), 'utf8');
}

function pageFields(file) {
  const html = readFile(file);
  return readFields(html);
}

function savePage(file, values) {
  const html = readFile(file);
  const next = applyFields(html, values);
  if (next !== html) fs.writeFileSync(path.join(PUBLIC, file), next);
  return next !== html;
}

function rebuildAll(store) {
  const s = store || loadStore();
  const changed = [];
  for (const [file, values] of Object.entries(s)) {
    try {
      const html = readFile(file);
      const next = applyFields(html, values);
      if (next !== html) {
        fs.writeFileSync(path.join(PUBLIC, file), next);
        changed.push(file);
      }
    } catch {
      /* ignore missing page */
    }
  }
  return changed;
}

function tokenizeAll(force) {
  const changed = [];
  for (const p of PAGES) {
    const html = readFile(p.file);
    const b = mainBounds(html);
    if (!b) continue;
    let inner = html.slice(b.start, b.end);
    if (force) inner = stripMarkers(inner);
    const next = tokenizeMain(inner, p.file);
    if (next !== inner) {
      const out = html.slice(0, b.start) + next + html.slice(b.end);
      fs.writeFileSync(path.join(PUBLIC, p.file), out);
      changed.push(p.file);
    }
  }
  return changed;
}

module.exports = {
  PAGES,
  PUBLIC,
  STORE_PATH,
  tokenizeAll,
  tokenizeMain,
  stripMarkers,
  readFields,
  readFieldsFor: pageFields,
  applyFields,
  savePage,
  rebuildAll,
  loadStore,
  saveStore,
  loadDefaults,
  saveDefaults,
  seedDefaults,
  describe,
};

if (require.main === module) {
  const force = process.argv.includes('--force');
  const changed = tokenizeAll(force);
  if (!fs.existsSync(DEFAULTS_PATH)) seedDefaults();
  let total = 0;
  for (const p of PAGES) {
    const n = pageFields(p.file).length;
    total += n;
    console.log(`${p.file}: ${n} fields`);
  }
  console.log(`tokenized ${changed.length} page(s); ${total} fields total`);
}
