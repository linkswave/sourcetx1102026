(function () {
  'use strict';

  var app = document.getElementById('assess-app');
  if (!app) return;

  var body = document.getElementById('assess-body');
  var count = document.getElementById('assess-count');
  var bar = document.getElementById('assess-progress-bar');
  var back = document.getElementById('assess-back');
  var next = document.getElementById('assess-next');
  var actions = app.querySelector('.assess-actions');

  var QUESTIONS = [
    { q: 'How centralized is your organization\'s data?', a: ['Mostly siloed', 'Partially centralized', 'Central data warehouse', 'Modern cloud data platform'] },
    { q: 'How would you describe the quality and trust of your enterprise data?', a: ['Unreliable or inconsistent', 'Improving but uneven', 'Mostly reliable', 'Governed and trusted'] },
    { q: 'How mature is your cloud adoption?', a: ['Mostly on-premises', 'Early migration', 'Hybrid, cloud-first', 'Fully cloud-native'] },
    { q: 'How defined are your data governance practices?', a: ['Not defined', 'Ad hoc', 'Documented', 'Enforced and monitored'] },
    { q: 'How would you describe AI adoption today?', a: ['Not started', 'Exploring', 'Pilots in progress', 'In production'] },
    { q: 'How mature is your analytics and reporting?', a: ['Mostly manual', 'Basic dashboards', 'Central BI with shared metrics', 'Self-service with near real-time insight'] },
    { q: 'How much of your key processes are automated?', a: ['Mostly manual', 'Some automation', 'Significant automation', 'End-to-end orchestrated'] },
    { q: 'How prepared are your security and infrastructure foundations for AI?', a: ['Significant gaps', 'Basic controls', 'Solid controls', 'Strong and continuously monitored'] }
  ];

  var LEVELS = [
    { max: 14, name: 'FOUNDATION', recos: ['Establish a governed enterprise data foundation', 'Improve data quality and consistency', 'Define priority AI use cases', 'Build an initial AI proof of concept'] },
    { max: 20, name: 'EMERGING', recos: ['Centralize your most valuable data sources', 'Strengthen governance and data quality', 'Prioritize high-value AI use cases', 'Run a focused pilot with clear success measures'] },
    { max: 26, name: 'ADVANCED', recos: ['Scale your governed data platform', 'Operationalize AI with MLOps and monitoring', 'Expand automation across key processes', 'Optimize platform performance and cost'] },
    { max: 32, name: 'AI READY', recos: ['Scale AI across business units', 'Formalize AI governance, monitoring, and evaluation', 'Optimize performance and cost continuously', 'Innovate with agents and advanced analytics'] }
  ];

  var answers = new Array(QUESTIONS.length).fill(0);
  var index = 0;
  var finished = false;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setProgress() {
    var pct = finished ? 100 : Math.round(((index) / QUESTIONS.length) * 100);
    if (bar) bar.style.width = pct + '%';
  }

  function renderQuestion() {
    actions.hidden = false;
    var item = QUESTIONS[index];
    count.textContent = 'Question ' + (index + 1) + ' of ' + QUESTIONS.length;
    var html = '<fieldset class="assess-q"><legend>' + esc(item.q) + '</legend><div class="assess-options">';
    for (var i = 0; i < item.a.length; i++) {
      var checked = answers[index] === i + 1 ? ' checked' : '';
      html += '<label><input type="radio" name="q" value="' + (i + 1) + '"' + checked + '> ' + esc(item.a[i]) + '</label>';
    }
    html += '</div></fieldset>';
    body.innerHTML = html;
    back.disabled = index === 0;
    next.textContent = index === QUESTIONS.length - 1 ? 'See my result' : 'Next';
    next.disabled = !answers[index];
    setProgress();
    var first = body.querySelector('input');
    if (first) first.focus();
  }

  body.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'q') {
      answers[index] = Number(e.target.value);
      next.disabled = false;
    }
  });

  back.addEventListener('click', function () {
    if (index > 0) { index--; renderQuestion(); }
  });

  next.addEventListener('click', function () {
    if (!answers[index]) return;
    if (index < QUESTIONS.length - 1) { index++; renderQuestion(); }
    else { finished = true; renderResult(); }
  });

  function levelFor(score) {
    for (var i = 0; i < LEVELS.length; i++) { if (score <= LEVELS[i].max) return LEVELS[i]; }
    return LEVELS[LEVELS.length - 1];
  }

  function renderResult() {
    var score = answers.reduce(function (a, b) { return a + b; }, 0);
    var level = levelFor(score);
    var pct = Math.round((score / 32) * 100);
    count.textContent = 'Your result';
    setProgress();
    actions.hidden = true;
    var recoHtml = level.recos.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    body.innerHTML =
      '<div class="assess-result">' +
        '<p class="assess-summary">Indicative maturity level</p>' +
        '<p class="assess-level">' + esc(level.name) + '</p>' +
        '<p class="assess-summary">Overall readiness score: ' + score + ' of 32</p>' +
        '<div class="assess-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
        '<div class="assess-recos"><h3>Recommended next steps</h3><ul>' + recoHtml + '</ul></div>' +
      '</div>' +
      '<form class="assess-form" id="assess-form" novalidate>' +
        '<h3>Request a Free Data &amp; AI Consultation</h3>' +
        '<p>Share a few details and a SourceTX specialist will follow up with tailored guidance.</p>' +
        '<div class="two">' +
          '<label>Name <input type="text" name="name" autocomplete="name" required></label>' +
          '<label>Business email <input type="email" name="email" autocomplete="email" required></label>' +
        '</div>' +
        '<div class="two">' +
          '<label>Company <input type="text" name="company" autocomplete="organization" required></label>' +
          '<label>Phone <input type="tel" name="phone" autocomplete="tel"></label>' +
        '</div>' +
        '<label>Primary technology challenge <textarea name="challenge" rows="3" required></textarea></label>' +
        '<label class="consent"><input type="checkbox" name="consent" required> I agree to be contacted about my request.</label>' +
        '<input type="hidden" name="topic" value="Data & AI Readiness Assessment">' +
        '<input type="hidden" name="message" value="">' +
        '<div class="actions"><button class="btn btn-gradient" type="submit">Request a Free Data &amp; AI Consultation</button></div>' +
        '<p class="form-status" role="status" aria-live="polite"></p>' +
      '</form>';
    var form = document.getElementById('assess-form');
    form.addEventListener('submit', onSubmit);
    syncMessage(form, level, score);
    form.addEventListener('input', function () { syncMessage(form, level, score); });
  }

  function syncMessage(form, level, score) {
    var msg = form.querySelector('[name="message"]');
    if (!msg) return;
    var company = (form.querySelector('[name="company"]') || {}).value || '';
    var challenge = (form.querySelector('[name="challenge"]') || {}).value || '';
    msg.value = 'Assessment result: ' + level.name + ' (score ' + score + '/32).' +
      (company ? ' Company: ' + company + '.' : '') +
      (challenge ? ' Primary challenge: ' + challenge : '');
  }

  function onSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var status = form.querySelector('.form-status');
    if (!form.checkValidity()) { status.className = 'form-status error'; status.textContent = 'Please complete the required fields.'; return; }
    status.className = 'form-status';
    status.textContent = 'Submitting…';
    fetch('/api/contact', { method: 'POST', body: new FormData(form) })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error((r.j && r.j.message) || 'Submission failed.');
        status.classList.add('success');
        status.textContent = (r.j && r.j.message) || 'Thank you. We will be in touch.';
        form.reset();
      })
      .catch(function (err) {
        status.classList.add('error');
        status.textContent = err.message || 'Something went wrong. Please email info@sourcetx.com.';
      });
  }

  renderQuestion();
})();
