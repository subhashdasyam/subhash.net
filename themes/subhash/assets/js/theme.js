/* ==========================================================================
   subhash theme runtime

   Ported from the inline IIFE on subhashdasyam.com. Two deliberate changes:

     - Block 5 (Suggested Protocol) is gone. The original fetched 50 posts from
       the Blogger Atom feed at runtime to pick a random related post; Hugo
       resolves related content at build time instead, so there is nothing left
       to do on the client.
     - Theme bootstrap moved to an inline <head> script (see partials/head.html)
       so dark-mode users don't get a white first paint. This file only owns the
       toggle from here on.
   ========================================================================== */
(function () {
  // 1. Reading progress + back-to-top
  var progressBar = document.getElementById('reading-progress-bar');
  var backToTop = document.getElementById('back-to-top');
  window.addEventListener('scroll', function () {
    var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    var scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    if (progressBar) progressBar.style.width = scrolled + '%';
    if (backToTop) {
      backToTop.style.opacity = winScroll > 300 ? '1' : '0';
      backToTop.style.pointerEvents = winScroll > 300 ? 'auto' : 'none';
    }
  });

  // 2. Dark mode toggle. The initial data-theme is already set by the inline
  //    head script; this only handles clicks and persistence.
  var toggle = document.getElementById('theme-toggle');
  var root = document.documentElement;

  function paintToggle() {
    if (!toggle) return;
    toggle.innerHTML = root.getAttribute('data-theme') === 'dark' ? '&#9790;' : '&#9728;';
  }
  paintToggle();

  window.toggleTheme = function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    paintToggle();
  };

  // 3. Dynamic content guard (tables / images)
  window.addEventListener('load', function () {
    document.querySelectorAll('.post-body table').forEach(function (table) {
      if (!table.parentNode.classList.contains('table-responsive')) {
        var wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });
    document.querySelectorAll('.post-body img').forEach(function (img) {
      img.setAttribute('loading', 'lazy');
    });
  });

  // 4. Copy button on every code block
  function initCopyButtons() {
    var blocks = document.querySelectorAll('.post-body pre');
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].querySelector('.copy-code-button')) continue;
      var button = document.createElement('button');
      button.className = 'copy-code-button';
      button.type = 'button';
      button.textContent = 'COPY';
      (function (btn, blk) {
        btn.addEventListener('click', function () {
          var code = blk.querySelector('code') || blk;
          // exclude the button's own label from the copied text
          var text = Array.prototype.filter
            .call(code.childNodes, function (n) { return n !== btn; })
            .map(function (n) { return n.textContent; })
            .join('');
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = 'COPIED';
            setTimeout(function () { btn.textContent = 'COPY'; }, 2000);
          });
        });
        blk.appendChild(btn);
      })(button, blocks[i]);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopyButtons);
  } else {
    initCopyButtons();
  }
})();
