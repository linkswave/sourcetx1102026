(function () {
  'use strict';

  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"][aria-controls^="demo-"]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-demo-panel]'));
  if (!tabs.length || !panels.length) return;

  function selectTab(id) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) { p.hidden = p.id !== id; });
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { selectTab(t.getAttribute('aria-controls')); });
    t.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(t);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[n].focus();
        selectTab(tabs[n].getAttribute('aria-controls'));
      }
    });
  });

  function out(badge, title, body) {
    return '<span class="demo-badge">' + badge + '</span><h4>' + title + '</h4>' + body;
  }

  function q(text) {
    return '<p style="color:#8FDDF4">Q: ' + String(text).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) + '</p>';
  }

  var OUTPUTS = {
    'ask': function (val) {
      return out('Sample answer', 'Grounded response',
        q(val || 'What does the policy cover?') +
        '<p>Based on the remote work policy, employees may work remotely up to three days per week with manager approval. Equipment requests are reviewed within five business days.</p>' +
        '<p><strong>Source:</strong> Remote Work Policy (sample document)</p>');
    },
    'ask-eligibility': function () {
      return out('Sample answer', 'Who is eligible for remote work?',
        '<p>Employees can work remotely up to three days per week with manager approval, per the sample policy.</p><p><strong>Source:</strong> Remote Work Policy (sample document)</p>');
    },
    'ask-equipment': function () {
      return out('Sample answer', 'How long do equipment requests take?',
        '<p>Equipment requests are reviewed within five business days according to the sample policy.</p><p><strong>Source:</strong> Remote Work Policy (sample document)</p>');
    },
    'doc-summary': function () {
      return out('Sample summary', 'Document summary',
        '<p>A vendor agreement that renews automatically for twelve months unless either party gives sixty days written notice, with net thirty payment terms and a thirty day cure period for material breach.</p>');
    },
    'doc-extract': function () {
      return out('Sample extraction', 'Key terms',
        '<ul><li><strong>Renewal:</strong> automatic, 12 months, 60 days notice to cancel</li><li><strong>Payment:</strong> net 30 days</li><li><strong>Termination:</strong> material breach with 30 days to cure</li></ul>');
    },
    'doc-classify': function () {
      return out('Sample classification', 'Classification',
        '<p><strong>Type:</strong> Vendor agreement</p><p><strong>Risk flags:</strong> automatic renewal, termination-for-convenience not present</p>');
    },
    'doc-compare': function () {
      return out('Sample comparison', 'Compared to standard terms',
        '<ul><li>Renewal notice: 60 days (standard: 30 days)</li><li>Payment terms: net 30 (standard: net 45)</li><li>No termination-for-convenience clause</li></ul>');
    },
    'analyst-revenue': function () {
      return out('Sample analysis', 'Revenue by region, last quarter',
        '<p><strong>SQL</strong></p><pre style="white-space:pre-wrap;color:#A7F3D0">SELECT region, SUM(amount) AS revenue\nFROM orders\nWHERE order_date >= DATE_TRUNC(\'quarter\', CURRENT_DATE)\nGROUP BY region\nORDER BY revenue DESC;</pre>' +
        '<p><strong>Interpretation:</strong> Groups completed orders by region for the current quarter and ranks by total revenue.</p>');
    },
    'analyst-customers': function () {
      return out('Sample analysis', 'Top customers by orders',
        '<p><strong>SQL</strong></p><pre style="white-space:pre-wrap;color:#A7F3D0">SELECT c.name, COUNT(*) AS orders\nFROM orders o JOIN customers c USING (customer_id)\nGROUP BY c.name\nORDER BY orders DESC\nLIMIT 10;</pre>' +
        '<p><strong>Interpretation:</strong> Ranks customers by number of orders.</p>');
    },
    'analyst-trend': function () {
      return out('Sample analysis', 'Monthly order trend',
        '<p><strong>SQL</strong></p><pre style="white-space:pre-wrap;color:#A7F3D0">SELECT DATE_TRUNC(\'month\', order_date) AS month, COUNT(*) AS orders\nFROM orders\nGROUP BY 1 ORDER BY 1;</pre>' +
        '<p><strong>Interpretation:</strong> Counts orders per month to reveal trend and seasonality.</p>');
    },
    'service-order': function () {
      return out('Sample agent', 'Customer service AI agent',
        '<p><strong>Customer:</strong> Where is my order?</p><p><strong>Agent:</strong> I can help with that. Could you share your order number? I can then check the latest status and expected delivery window.</p>');
    },
    'service-return': function () {
      return out('Sample agent', 'Customer service AI agent',
        '<p><strong>Customer:</strong> How do I return an item?</p><p><strong>Agent:</strong> Returns are accepted within 30 days of delivery. I can start a return, generate a label, and email you the instructions.</p>');
    },
    'service-billing': function () {
      return out('Sample agent', 'Customer service AI agent',
        '<p><strong>Customer:</strong> I was charged twice.</p><p><strong>Agent:</strong> I am sorry about that. I can review the two charges, confirm which is a duplicate, and initiate a refund or escalate to billing if needed.</p>');
    },
    'knowledge': function (val) {
      return out('Sample results', 'Knowledge search',
        q(val || 'company knowledge') +
        '<ul><li><strong>Onboarding Guide (v3):</strong> Week 1 setup, tools access, and buddy assignment</li><li><strong>People Handbook:</strong> Policies on leave, expenses, and working hours</li></ul><p><strong>Sources:</strong> Onboarding Guide; People Handbook (sample knowledge base)</p>');
    },
    'knowledge-onboarding': function () {
      return out('Sample results', 'Onboarding process',
        '<ul><li>Day 1: accounts, tools, and security training</li><li>Week 1: team introductions and buddy assignment</li><li>Day 30: first check-in with manager</li></ul><p><strong>Source:</strong> Onboarding Guide (v3)</p>');
    },
    'knowledge-expenses': function () {
      return out('Sample results', 'Expense policy',
        '<ul><li>Submit expenses within 30 days with receipts</li><li>Manager approval required above the standard threshold</li><li>Travel booked through the approved process</li></ul><p><strong>Source:</strong> People Handbook</p>');
    },
    'workflow': function () {
      return out('Sample agent run', 'Purchase approval workflow',
        '<ul><li>Validated request details and amount</li><li>Checked available budget for the cost center</li><li>Routed to the correct approver based on policy threshold</li><li>Recorded an audit trail and notified the requester</li></ul><p><strong>Result:</strong> Request approved and logged (illustrative).</p>');
    }
  };

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-run]') : null;
    if (!trigger) return;
    var key = trigger.getAttribute('data-run');
    var panel = trigger.closest('[data-demo-panel]');
    if (!panel) return;
    var outputEl = panel.querySelector('.demo-output');
    if (!outputEl) return;
    var val = '';
    var input = panel.querySelector('input[type="text"]');
    if (input && input.value) val = input.value;
    var fn = OUTPUTS[key];
    outputEl.innerHTML = fn ? fn(val) : '<p class="demo-placeholder">This demo output is not available.</p>';
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var input = e.target;
    if (!input || input.tagName !== 'INPUT' || input.type !== 'text') return;
    var panel = input.closest('[data-demo-panel]');
    if (!panel) return;
    var runBtn = panel.querySelector('button[data-run]');
    if (runBtn) { e.preventDefault(); runBtn.click(); }
  });
})();
