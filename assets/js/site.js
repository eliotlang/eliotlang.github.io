/* Eliot landing page — minimal progressive enhancement.
   No dependencies. Everything degrades gracefully without JS:
   all panels are real content, tabs are buttons, code is selectable. */
(function () {
  "use strict";

  /* -------- Example tabs -------- */
  function initTabs() {
    var tablist = document.querySelector('[role="tablist"]');
    if (!tablist) return;
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'));

    function select(name) {
      tabs.forEach(function (t) {
        t.setAttribute("aria-selected", String(t.dataset.tab === name));
      });
      panels.forEach(function (p) {
        p.hidden = p.dataset.panel !== name;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab.dataset.tab); });
      tab.addEventListener("keydown", function (e) {
        var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        next.focus();
        select(next.dataset.tab);
      });
    });
  }

  /* -------- Copy buttons -------- */
  function initCopy() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var block = btn.closest("[data-code]");
        var code = block && block.querySelector("code");
        if (!code) return;
        var text = code.innerText.replace(/\n$/, "");
        var done = function () {
          var prev = btn.textContent;
          btn.textContent = "copied";
          btn.classList.add("is-copied");
          setTimeout(function () {
            btn.textContent = prev;
            btn.classList.remove("is-copied");
          }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
        function fallback() {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); done(); } catch (e) { /* no-op */ }
          document.body.removeChild(ta);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { initTabs(); initCopy(); });
  } else {
    initTabs();
    initCopy();
  }
})();
