// Client-side behaviour of the workflow documentation page. Inlined into site/index.html by
// scripts/build-workflow-docs.mjs. Plain browser JavaScript, no build step.
(function () {
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var baseTitle = document.title;

  // ------------------------------------------------------------------ theme
  $('#theme-toggle').addEventListener('click', function () {
    var dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* storage unavailable */ }
  });

  // ---------------------------------------------------------------- routing
  // #/<area>/<slug> shows one workflow; anything else shows the overview.
  function route() {
    var match = location.hash.match(/^#\/([^/]+)\/([^/]+)/);
    var id = match ? match[1] + '/' + match[2] : 'overview';
    var view = $('[data-view="' + id + '"]') || $('[data-view="overview"]');
    $$('[data-view]').forEach(function (el) { el.classList.toggle('hidden', el !== view); });
    $$('[data-nav]').forEach(function (el) {
      var active = el.getAttribute('data-nav') === view.getAttribute('data-view');
      el.classList.toggle('nav-active', active);
      if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    var title = view.getAttribute('data-title');
    document.title = title ? title + ' · ' + baseTitle : baseTitle;
    window.scrollTo(0, 0);
    document.body.classList.remove('sidebar-open');
  }
  window.addEventListener('hashchange', route);
  route();

  // Section links inside a workflow page scroll without touching the route.
  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-scroll-to]');
    if (!link) return;
    event.preventDefault();
    var target = document.getElementById(link.getAttribute('data-scroll-to'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ----------------------------------------------------------------- sidebar
  $('#sidebar-toggle').addEventListener('click', function () {
    document.body.classList.toggle('sidebar-open');
  });

  var search = $('#search');
  search.addEventListener('input', function () {
    var query = search.value.trim().toLowerCase();
    $$('[data-group]').forEach(function (group) {
      var visible = 0;
      $$('[data-nav]', group).forEach(function (item) {
        var show = !query || item.getAttribute('data-search').indexOf(query) !== -1;
        item.classList.toggle('hidden', !show);
        if (show) visible += 1;
      });
      group.classList.toggle('hidden', visible === 0);
    });
    $('#search-empty').classList.toggle('hidden', $$('[data-group]:not(.hidden)').length > 0);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === '/' && document.activeElement !== search && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    }
  });

  // -------------------------------------------------------------- JSON panel
  function workflowJson(panel) {
    if (!panel._json) {
      var source = document.getElementById(panel.getAttribute('data-json-source'));
      panel._json = JSON.stringify(JSON.parse(source.textContent), null, 2);
    }
    return panel._json;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Keys, strings, numbers and literals each get a class; everything else stays plain.
  function highlight(json) {
    return escapeHtml(json).replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g,
      function (token, string, colon, literal) {
        if (string) return '<span class="' + (colon ? 'j-key' : 'j-str') + '">' + string + '</span>' + (colon || '');
        if (literal) return '<span class="j-lit">' + literal + '</span>';
        return '<span class="j-num">' + token + '</span>';
      }
    );
  }

  function toggleJson(panel) {
    var body = $('[data-json-body]', panel);
    var open = body.classList.toggle('hidden') === false;
    panel.classList.toggle('json-open', open);
    $('[data-json-toggle]', panel).setAttribute('aria-expanded', String(open));
    if (open && !body.firstElementChild.innerHTML) body.firstElementChild.innerHTML = highlight(workflowJson(panel));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(area);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-json-toggle]');
    if (toggle) return toggleJson(toggle.closest('[data-json-panel]'));

    var copy = event.target.closest('[data-json-copy]');
    if (!copy) return;
    var label = $('[data-copy-label]', copy);
    copyText(workflowJson(copy.closest('[data-json-panel]'))).then(
      function () { label.textContent = 'Copied'; },
      function () { label.textContent = 'Copy failed'; }
    ).then(function () {
      setTimeout(function () { label.textContent = 'Copy'; }, 1600);
    });
  });
})();
