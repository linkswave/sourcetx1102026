'use strict';

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PHP_TEST_PORT || '8097';
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', 'public', 'scripts/php-router.php'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cookie = '';

async function req(pathname, opts = {}) {
  const headers = Object.assign({}, opts.headers);
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + pathname, { ...opts, headers, redirect: 'manual' });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, text, json, headers: res.headers };
}

function form(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function runImport(file, args = []) {
  const res = spawnSync('php', [path.join(ROOT, 'php/_app/tools/import-jobs.php'), file, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return { code: res.status, out: (res.stdout || '') + (res.stderr || '') };
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await req('/api/jobs');
      if (r.status === 200) return;
    } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('PHP server did not start');
}

async function main() {
  await waitForServer();
  let checks = 0;
  const ok = () => checks++;

  const index = await req('/');
  if (index.status !== 200 || !index.text) throw new Error('/ returned ' + index.status);
  ok();

  const jobs = await req('/api/jobs');
  if (jobs.status !== 200 || !Array.isArray(jobs.json) || !jobs.json.length) throw new Error('/api/jobs invalid');
  ok();
  const jobId = jobs.json[0].id;

  const job = await req('/jobs/' + encodeURIComponent(jobId));
  if (job.status !== 200 || !job.text.includes('"@type":"JobPosting"')) throw new Error('/jobs/<id> missing JobPosting');
  ok();

  const missing = await req('/jobs/definitely-not-a-real-job');
  if (missing.status !== 404) throw new Error('unknown job should 404');
  ok();

  const sitemap = await req('/sitemap.xml');
  if (sitemap.status !== 200 || !sitemap.text.includes('</urlset>') || !sitemap.text.includes('/jobs/')) throw new Error('sitemap invalid');
  ok();

  const chat = await req('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'What services do you offer?' }) });
  if (chat.status !== 200 || !chat.json.ok || !chat.json.reply || chat.json.fallback) throw new Error('chat known intent failed');
  ok();

  const fallback = await req('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'zorbafax' }) });
  if (fallback.status !== 200 || !fallback.json.ok || !fallback.json.fallback) throw new Error('chat fallback failed');
  ok();

  const emptyChat = await req('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '' }) });
  if (emptyChat.status !== 400) throw new Error('empty chat should 400');
  ok();

  const contact = await req('/api/contact', { method: 'POST', body: form({ name: 'Smoke Test', email: `smoke${Date.now()}@example.com`, phone: '1', topic: 'General', message: 'Smoke test message', consent: 'yes' }) });
  if (contact.status !== 200 || !contact.json.ok) throw new Error('contact failed: ' + contact.text);
  ok();

  const apply = await req('/api/apply', { method: 'POST', body: form({ jobId: 'general', name: 'Smoke Test', email: `smoke${Date.now()}@example.com`, phone: '1', resumeUrl: 'https://linkedin.com/in/smoke', consent: 'yes' }) });
  if (apply.status !== 200 || !apply.json.ok) throw new Error('apply failed: ' + apply.text);
  ok();

  const talent = await req('/api/talent-request', { method: 'POST', body: form({ name: 'Smoke', company: 'Acme', email: `smoke${Date.now()}@example.com`, needs: 'Staffing', consent: 'yes' }) });
  if (talent.status !== 200 || !talent.json.ok) throw new Error('talent-request failed: ' + talent.text);
  ok();

  const adminPage = await req('/admin');
  if (adminPage.status !== 302) throw new Error('/admin should redirect when unauthenticated, got ' + adminPage.status);
  ok();

  const unauth = await req('/api/admin/jobs');
  if (unauth.status !== 401) throw new Error('unauthenticated admin API should 401, got ' + unauth.status);
  ok();

  const loginPage = await req('/admin/login');
  const csrfMatch = loginPage.text.match(/name="csrf" value="([^"]+)"/);
  if (!csrfMatch) throw new Error('login page missing CSRF token');
  const csrf = csrfMatch[1];
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD || 'test-password-123';
  const login = await req('/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ user, password: pass, csrf }).toString() });
  if (login.status !== 302) throw new Error('login failed with ' + login.status + ': ' + login.text);
  ok();

  const authed = await req('/api/admin/jobs');
  if (authed.status !== 200 || !authed.json.ok || !Array.isArray(authed.json.data)) throw new Error('authenticated admin API failed');
  ok();

  // contact attachments: stored, downloadable by admin, rejected types/sizes
  const marker = `ATTACH-${Date.now()}`;
  const attachName = `smoke-${Date.now()}.pdf`;
  const contactFile = new FormData();
  contactFile.append('name', 'Attach Sender');
  contactFile.append('email', `attach${Date.now()}@example.com`);
  contactFile.append('topic', 'General question');
  contactFile.append('message', `Please see attached ${marker}`);
  contactFile.append('consent', 'yes');
  contactFile.append('attachment', new Blob([`%PDF-1.4 ${marker}`], { type: 'application/pdf' }), attachName);
  const attachContact = await req('/api/contact', { method: 'POST', body: contactFile });
  if (attachContact.status !== 200 || !attachContact.json.ok) throw new Error('contact with attachment failed: ' + attachContact.text);
  ok();

  const badType = new FormData();
  badType.append('name', 'Bad Type');
  badType.append('email', `badtype${Date.now()}@example.com`);
  badType.append('message', 'nope');
  badType.append('consent', 'yes');
  badType.append('attachment', new Blob(['MZ'], { type: 'application/octet-stream' }), 'virus.exe');
  const badTypeRes = await req('/api/contact', { method: 'POST', body: badType });
  if (badTypeRes.status !== 400) throw new Error('disallowed attachment type should 400, got ' + badTypeRes.status);
  ok();

  const bigFile = new FormData();
  bigFile.append('name', 'Big File');
  bigFile.append('email', `big${Date.now()}@example.com`);
  bigFile.append('message', 'too big');
  bigFile.append('consent', 'yes');
  bigFile.append('attachment', new Blob([Buffer.alloc(11 * 1024 * 1024, 1)], { type: 'application/pdf' }), 'big.pdf');
  const bigRes = await req('/api/contact', { method: 'POST', body: bigFile });
  if (bigRes.status !== 400) throw new Error('oversized attachment should 400, got ' + bigRes.status);
  ok();

  const msgList = await req('/api/admin/messages');
  const stored = Array.isArray(msgList.json?.data) ? msgList.json.data.find((m) => typeof m.message === 'string' && m.message.includes(marker)) : null;
  if (!stored || !stored.attachment || stored.originalAttachmentName !== attachName) throw new Error('stored message missing attachment fields');
  ok();

  const download = await req(`/api/admin/messages/${encodeURIComponent(stored.id)}/attachment`);
  if (download.status !== 200 || !download.text.includes(marker)) throw new Error('admin attachment download failed: ' + download.status);
  if (!/attachment/i.test(download.headers.get('content-disposition') || '')) throw new Error('download missing Content-Disposition');
  ok();

  const savedCookie = cookie;
  cookie = '';
  const deniedDownload = await req(`/api/admin/messages/${encodeURIComponent(stored.id)}/attachment`);
  cookie = savedCookie;
  if (deniedDownload.status !== 401) throw new Error('unauthenticated attachment download should 401, got ' + deniedDownload.status);
  ok();

  // jobs JSON import CLI: insert new, skip existing, idempotent, dry-run
  const importId = `php-check-import-${Date.now()}`;
  const fixture = path.join(os.tmpdir(), `jobs-import-${Date.now()}.json`);
  fs.writeFileSync(fixture, JSON.stringify([
    { id: jobId, title: 'Duplicate should be skipped' },
    { id: importId, title: 'PHP Check Imported Job', location: 'Remote', type: 'Contract', department: 'QA', posted: '2026-01-02', summary: 's', description: 'd', responsibilities: ['a'], requirements: ['b'], skills: ['PHP', 'MySQL'], active: true },
  ]));

  const first = runImport(fixture);
  if (first.code !== 0 || !/imported 1, skipped 1/.test(first.out)) throw new Error('import first run failed: ' + first.out);
  ok();

  const second = runImport(fixture);
  if (second.code !== 0 || !/imported 0, skipped 2/.test(second.out)) throw new Error('import second run not idempotent: ' + second.out);
  ok();

  const allJobs = await req('/api/jobs');
  const imported = Array.isArray(allJobs.json) ? allJobs.json.find((j) => j.id === importId) : null;
  if (!imported || !Array.isArray(imported.skills) || imported.skills.join(',') !== 'PHP,MySQL') throw new Error('imported job missing or skills not stored as JSON');
  ok();

  const dryId = `${importId}-dry`;
  const dryFixture = path.join(os.tmpdir(), `jobs-import-dry-${Date.now()}.json`);
  fs.writeFileSync(dryFixture, JSON.stringify([{ id: dryId, title: 'Dry Run Job' }]));
  const dry = runImport(dryFixture, ['--dry-run']);
  if (dry.code !== 0 || !/imported 1, skipped 0/.test(dry.out)) throw new Error('dry run output unexpected: ' + dry.out);
  const afterDry = await req('/api/jobs');
  if (Array.isArray(afterDry.json) && afterDry.json.some((j) => j.id === dryId)) throw new Error('dry run wrote a row');
  ok();

  // admin JSON import endpoint (same insert-only logic, CSRF protected)
  const adminImportId = `php-check-admin-import-${Date.now()}`;
  const adminImport = await req('/api/admin/jobs/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ text: JSON.stringify([
      { id: jobId, title: 'Duplicate should be skipped' },
      { id: adminImportId, title: 'Admin Imported Job', skills: ['Go'] },
    ]) }),
  });
  if (adminImport.status !== 200 || !adminImport.json.ok || adminImport.json.data.imported !== 1 || adminImport.json.data.skipped !== 1) throw new Error('admin import failed: ' + adminImport.text);
  ok();

  const badImport = await req('/api/admin/jobs/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ text: 'not json' }),
  });
  if (badImport.status !== 400) throw new Error('admin import invalid JSON should 400, got ' + badImport.status);
  ok();

  const adminDryId = `${adminImportId}-dry`;
  const adminDry = await req('/api/admin/jobs/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ text: JSON.stringify([{ id: adminDryId, title: 'Admin Dry Job' }]), dryRun: true }),
  });
  if (adminDry.status !== 200 || !adminDry.json.ok || adminDry.json.data.imported !== 1) throw new Error('admin dry import unexpected: ' + adminDry.text);
  const afterAdminDry = await req('/api/jobs');
  if (Array.isArray(afterAdminDry.json) && afterAdminDry.json.some((j) => j.id === adminDryId)) throw new Error('admin dry import wrote a row');
  ok();

  console.log(`All ${checks} PHP checks passed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => server.kill('SIGTERM'));
