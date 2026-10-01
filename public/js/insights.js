(function () {
  'use strict';

  var filters = Array.prototype.slice.call(document.querySelectorAll('.insight-filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.insight-card'));
  var empty = document.getElementById('insights-empty');
  if (!filters.length || !cards.length) return;

  function apply(filter) {
    var shown = 0;
    cards.forEach(function (card) {
      var cats = (card.getAttribute('data-cat') || '').split(/\s+/);
      var on = filter === 'all' || cats.indexOf(filter) !== -1;
      card.hidden = !on;
      if (on) shown++;
    });
    filters.forEach(function (f) {
      f.setAttribute('aria-pressed', String(f.getAttribute('data-filter') === filter));
    });
    if (empty) empty.hidden = shown !== 0;
  }

  filters.forEach(function (f) {
    f.addEventListener('click', function () { apply(f.getAttribute('data-filter')); });
  });
})();
