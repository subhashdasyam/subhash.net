/* ==========================================================================
   Client-side search.

   No external library. Fuse/lunr would each add 20-25 KB of dependency for a
   43-post index; a weighted substring scorer is smaller, has no supply chain,
   and is more predictable to reason about.

   Index fields (short keys keep the JSON small):
     t title   u url   d date   s system   g tags   e summary   b body
   ========================================================================== */
(function () {
  var form = document.getElementById('search-form');
  if (!form) return;

  var input   = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  var status  = document.getElementById('search-status');
  var indexURL = form.getAttribute('data-index');

  var index = null;
  var loading = null;

  // Field weights. Title beats tags beats summary beats body.
  var W = { t: 12, g: 8, s: 6, e: 3, b: 1 };

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    setStatus('LOADING INDEX...');
    loading = fetch(indexURL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        index = data;
        return index;
      })
      .catch(function (err) {
        setStatus('INDEX UNAVAILABLE (' + err.message + ')');
        loading = null;
        throw err;
      });
    return loading;
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function scoreEntry(entry, terms) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var termScore = 0;
      for (var field in W) {
        var value = entry[field];
        if (!value) continue;
        if (Array.isArray(value)) value = value.join(' ');
        var hay = value.toLowerCase();
        var at = hay.indexOf(term);
        if (at === -1) continue;
        var s = W[field];
        // whole-word and prefix matches outrank matches mid-word
        if (at === 0 || /[^a-z0-9]/.test(hay.charAt(at - 1))) s *= 2;
        termScore += s;
      }
      // every term must appear somewhere -- this is an AND search
      if (termScore === 0) return 0;
      total += termScore;
    }
    return total;
  }

  function snippet(entry, terms) {
    var body = entry.b || entry.e || '';
    var lower = body.toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length && at === -1; i++) at = lower.indexOf(terms[i]);
    if (at === -1) return escapeHTML(entry.e || body.slice(0, 200));

    var start = Math.max(0, at - 90);
    var text = body.slice(start, start + 240);
    if (start > 0) text = '...' + text;
    if (start + 240 < body.length) text += '...';

    var html = escapeHTML(text);
    terms.forEach(function (term) {
      var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      html = html.replace(re, '<mark>$1</mark>');
    });
    return html;
  }

  function render(matches, terms, query) {
    if (!matches.length) {
      results.innerHTML =
        '<article class="post"><div class="post-body">' +
        '<p>No matches for <strong>' + escapeHTML(query) + '</strong>.</p>' +
        '</div></article>';
      setStatus('0 MATCHES');
      return;
    }
    results.innerHTML = matches.map(function (m) {
      var e = m.entry;
      return '' +
        '<article class="post">' +
          '<h2 class="post-title"><a href="' + e.u + '">' + escapeHTML(e.t) + '</a></h2>' +
          '<div class="post-meta">' +
            '<span>DATE: ' + escapeHTML(e.d) + '</span>' +
            (e.s ? '<span class="post-meta-system">SYSTEM: ' + escapeHTML(e.s) + '</span>' : '') +
          '</div>' +
          '<div class="post-body">' +
            '<div class="post-snippet">' + snippet(e, terms) + '</div>' +
            '<div class="read-more">' +
              '<a href="' + e.u + '">$ EXECUTE_READ</a>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');
    setStatus(matches.length + ' MATCH' + (matches.length === 1 ? '' : 'ES'));
  }

  function run(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      results.innerHTML = '';
      setStatus('AWAITING QUERY');
      return;
    }
    loadIndex().then(function (data) {
      var matches = [];
      for (var i = 0; i < data.length; i++) {
        var score = scoreEntry(data[i], terms);
        if (score > 0) matches.push({ entry: data[i], score: score });
      }
      matches.sort(function (a, b) {
        return b.score - a.score || (a.entry.d < b.entry.d ? 1 : -1);
      });
      render(matches, terms, query);
    }).catch(function () { /* status already set */ });
  }

  // debounce so we are not re-scoring on every keystroke
  var timer;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var q = input.value.trim();
      run(q);
      var url = q ? '?q=' + encodeURIComponent(q) : location.pathname;
      history.replaceState(null, '', url);
    }, 120);
  }

  input.addEventListener('input', schedule);
  form.addEventListener('submit', function (e) { e.preventDefault(); schedule(); });

  // warm the index on focus so the first query feels instant
  input.addEventListener('focus', function () { loadIndex().catch(function () {}); }, { once: true });

  // deep link: /search/?q=term
  var initial = new URLSearchParams(location.search).get('q');
  if (initial) {
    input.value = initial;
    run(initial);
  } else {
    setStatus('AWAITING QUERY');
  }
  input.focus();
})();

/* "/" anywhere on the site jumps to search. Lives outside the guard above so it
   works on every page, not just /search/. */
(function () {
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var el = document.activeElement;
    var tag = el ? el.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable)) return;
    var onSearchPage = document.getElementById('search-input');
    e.preventDefault();
    if (onSearchPage) onSearchPage.focus();
    else window.location.href = document.body.getAttribute('data-search-url') || '/search/';
  });
})();
