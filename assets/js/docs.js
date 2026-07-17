/* Eliot docs — dependency-free progressive enhancement.
   1. Syntax-highlights ```eliot code blocks into the brand .code component.
   2. Adds copy buttons.
   3. Builds the "On this page" TOC and tracks the active section.
   4. Filters the chapter nav from the topbar search.
   5. Drives the mobile chapter drawer.
   Everything degrades gracefully without JS. */
(function () {
  "use strict";

  /* -------- Eliot syntax highlighter --------
     Single-pass scanner: comments and strings are consumed whole (so keywords
     inside them aren't recolored), Uppercase words are types / constructors, a
     fixed set of words are keywords, digit runs are numbers. */
  var KEYWORDS = {
    "import": 1, "def": 1, "type": 1, "data": 1, "ability": 1, "implement": 1,
    "match": 1, "case": 1, "val": 1, "where": 1, "private": 1,
    "infix": 1, "prefix": 1, "postfix": 1, "auto": 1, "catch": 1, "else": 1
  };

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function span(cls, s) { return '<span class="' + cls + '">' + esc(s) + "</span>"; }
  function isIdentStart(c) { return /[A-Za-z_]/.test(c) || c.charCodeAt(0) > 127; }
  function isIdentChar(c) { return /[A-Za-z0-9_]/.test(c) || c.charCodeAt(0) > 127; }

  function highlightEliot(src) {
    var out = "", i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (c === "/" && src[i + 1] === "/") {
        var j = src.indexOf("\n", i); if (j < 0) j = n;
        out += span("t-com", src.slice(i, j)); i = j; continue;
      }
      if (c === "/" && src[i + 1] === "*") {
        var k = src.indexOf("*/", i + 2); k = (k < 0) ? n : k + 2;
        out += span("t-com", src.slice(i, k)); i = k; continue;
      }
      if (c === '"') {
        var s = i + 1;
        while (s < n) { if (src[s] === "\\") { s += 2; continue; } if (src[s] === '"') { s++; break; } s++; }
        out += span("t-str", src.slice(i, s)); i = s; continue;
      }
      if (isIdentStart(c)) {
        var a = i + 1; while (a < n && isIdentChar(src[a])) a++;
        var word = src.slice(i, a);
        if (KEYWORDS[word]) out += span("t-kw", word);
        else if (/^[A-Z]/.test(word)) out += span("t-ty", word);
        else out += esc(word);
        i = a; continue;
      }
      if (/[0-9]/.test(c)) {
        var d = i + 1; while (d < n && /[0-9]/.test(src[d])) d++;
        out += span("t-num", src.slice(i, d)); i = d; continue;
      }
      out += esc(c); i++;
    }
    return out;
  }

  function upgradeBlocks() {
    var seen = [];
    var nodes = document.querySelectorAll(".language-eliot, code.language-eliot, pre.language-eliot");
    Array.prototype.forEach.call(nodes, function (el) {
      var code = el.matches("code") ? el : el.querySelector("code");
      if (!code || seen.indexOf(code) !== -1) return;
      seen.push(code);
      var container = el.closest(".highlighter-rouge") || (el.tagName === "PRE" ? el : el.closest("pre")) || el;

      var src = code.textContent.replace(/\n$/, "");

      var wrap = document.createElement("div");
      wrap.className = "code"; wrap.setAttribute("data-code", "");

      var bar = document.createElement("div");
      bar.className = "code__bar";
      var dot = document.createElement("span"); dot.className = "code__dot"; dot.setAttribute("aria-hidden", "true");
      var file = document.createElement("span"); file.className = "code__file";
      file.textContent = container.getAttribute("data-file") || "eliot";
      var copy = document.createElement("button");
      copy.type = "button"; copy.className = "code__copy"; copy.setAttribute("data-copy", ""); copy.textContent = "copy";
      bar.appendChild(dot); bar.appendChild(file); bar.appendChild(copy);

      var pre = document.createElement("pre");
      var codeEl = document.createElement("code");
      codeEl.innerHTML = highlightEliot(src);
      pre.appendChild(codeEl);

      wrap.appendChild(bar); wrap.appendChild(pre);
      if (container.parentNode) container.parentNode.replaceChild(wrap, container);
    });
  }

  /* -------- Copy buttons -------- */
  function copyText(text, btn) {
    var done = function () {
      var prev = btn.textContent;
      btn.textContent = "copied"; btn.classList.add("is-copied");
      setTimeout(function () { btn.textContent = prev; btn.classList.remove("is-copied"); }, 1400);
    };
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "absolute"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* no-op */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
  }

  function initCopy() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var block = btn.closest("[data-code]");
        var code = block && block.querySelector("code");
        if (!code) return;
        copyText(code.innerText.replace(/\n$/, ""), btn);
      });
    });
  }

  /* -------- On this page (TOC) + scroll-spy -------- */
  function initToc() {
    var article = document.querySelector(".docs-article");
    var toc = document.querySelector(".docs-toc");
    var list = document.getElementById("docs-toc-list");
    if (!article || !toc || !list) return;
    var heads = Array.prototype.slice.call(article.querySelectorAll("h2[id]"));
    if (!heads.length) return;

    var links = heads.map(function (h) {
      var a = document.createElement("a");
      a.href = "#" + h.id; a.textContent = h.textContent;
      list.appendChild(a);
      return a;
    });
    toc.hidden = false;

    function onScroll() {
      var idx = 0;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top <= 90) idx = i; else break;
      }
      links.forEach(function (a, n) { a.classList.toggle("is-active", n === idx); });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* -------- Topbar search: filter the chapter nav -------- */
  function initSearch() {
    var input = document.getElementById("docs-search");
    if (!input) return;
    var groups = Array.prototype.slice.call(document.querySelectorAll(".docs-nav__group"));
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      groups.forEach(function (g) {
        var any = false;
        g.querySelectorAll(".docs-nav__list li").forEach(function (li) {
          var match = !q || li.textContent.toLowerCase().indexOf(q) >= 0;
          li.style.display = match ? "" : "none";
          if (match) any = true;
        });
        g.style.display = any ? "" : "none";
      });
    });
  }

  /* -------- Mobile chapter drawer -------- */
  function initDrawer() {
    var body = document.body;
    var open = function () { body.classList.add("docs-nav-open"); };
    var close = function () { body.classList.remove("docs-nav-open"); };
    document.querySelectorAll("[data-docs-open]").forEach(function (b) { b.addEventListener("click", open); });
    document.querySelectorAll("[data-docs-close]").forEach(function (b) { b.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    document.querySelectorAll(".docs-nav a").forEach(function (a) { a.addEventListener("click", close); });
  }

  /* -------- Center the active chapter in the sidebar -------- */
  function centerActive() {
    var side = document.getElementById("docs-side");
    var active = side && side.querySelector("li.is-active");
    if (side && active) side.scrollTop = active.offsetTop - side.clientHeight / 2;
  }

  function init() { upgradeBlocks(); initCopy(); initToc(); initSearch(); initDrawer(); centerActive(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
