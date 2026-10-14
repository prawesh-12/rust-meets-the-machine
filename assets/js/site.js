/* Page-level behaviour shared by every page:
   - marks the document as JS-capable (diagrams start in their first state)
   - opens and closes the contents panel on narrow screens
   - makes sure every external link opens in a new tab and says so */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector("[data-toc-toggle]");
    var toc = document.getElementById("toc");
    if (btn && toc) {
      var close = function () {
        toc.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      };
      btn.addEventListener("click", function () {
        var open = !toc.classList.contains("is-open");
        toc.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
        if (open) {
          var cur = toc.querySelector('[aria-current="page"]') || toc.querySelector("a");
          if (cur) cur.focus();
        }
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && toc.classList.contains("is-open")) { close(); btn.focus(); }
      });
      document.addEventListener("click", function (e) {
        if (toc.classList.contains("is-open") && !toc.contains(e.target) && e.target !== btn) close();
      });
    }

    /* "On this page": mark the section being read, in both outline lists */
    var outLinks = Array.prototype.slice.call(document.querySelectorAll(".otp__list a, .toc__sub a"));
    if (outLinks.length) {
      var heads = [];
      outLinks.forEach(function (a) {
        var h = document.getElementById(a.getAttribute("href").slice(1));
        if (h && heads.indexOf(h) === -1) heads.push(h);
      });
      heads.sort(function (x, y) { return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
      var ticking = false;
      var picked = null; /* a heading chosen from the outline, kept until the reader scrolls by hand */
      var show = function (id) {
        outLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + id);
        });
      };
      var mark = function () {
        ticking = false;
        if (picked) { show(picked); return; }
        var line = Math.max(120, window.innerHeight * 0.25);
        var current = heads[0];
        for (var j = 0; j < heads.length; j++) {
          if (heads[j].getBoundingClientRect().top < line) current = heads[j]; else break;
        }
        /* at the very bottom, the last section is the one being read */
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = heads[heads.length - 1];
        show(current.id);
      };
      outLinks.forEach(function (a) {
        a.addEventListener("click", function () { picked = a.getAttribute("href").slice(1); show(picked); });
      });
      var release = function () { picked = null; };
      ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
        window.addEventListener(ev, function (e) {
          if (ev === "mousedown" && e.target.closest && e.target.closest(".otp__list a, .toc__sub a")) return;
          release();
        }, { passive: true });
      });
      window.addEventListener("scroll", function () {
        if (!ticking) { ticking = true; window.requestAnimationFrame(mark); }
      }, { passive: true });
      mark();
    }

    /* reading progress: remember which topics were opened in this browser and mark them with a ✓ */
    var KEY = "rmc-opened";
    var opened = [];
    try { opened = JSON.parse(window.localStorage.getItem(KEY) || "[]"); } catch (e) { opened = []; }
    if (!Array.isArray(opened)) opened = [];
    var here = location.pathname.match(/lessons\/(\d\d)-[^\/]*\.html$/);
    if (here && opened.indexOf(here[1]) === -1) {
      opened.push(here[1]);
      try { window.localStorage.setItem(KEY, JSON.stringify(opened)); } catch (e) { /* storage blocked: no marks */ }
    }
    document.querySelectorAll('.toc ol a, .contents a').forEach(function (a) {
      var m = (a.getAttribute("href") || "").match(/(\d\d)-[^\/]*\.html$/);
      var n = a.querySelector(".n");
      if (!m || !n || opened.indexOf(m[1]) === -1) return;
      var s = document.createElement("span");
      s.className = "seen"; s.title = "Opened before";
      s.innerHTML = "✓<span class=\"sr-only\"> (opened before)</span>";
      n.appendChild(s);
    });

    /* figures and end-of-page blocks fade in once as they scroll into view; anything already on screen is left alone */
    if ("IntersectionObserver" in window && window.matchMedia && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px" });
      document.querySelectorAll("figure.fig, .keep, .test, .aside, .pager").forEach(function (el) {
        if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add("reveal"); io.observe(el); }
      });
    }

    var links = document.querySelectorAll('a[href^="http"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      if (!a.querySelector(".sr-only")) {
        var s = document.createElement("span");
        s.className = "sr-only";
        s.textContent = " (opens another site in a new tab)";
        a.appendChild(s);
      }
    }
  });
})();
