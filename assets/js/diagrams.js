/* Diagram behaviour.

   Two shared tools, then one small section per figure.

   1. Stepper — for figures that tell a story in steps. The figure's HTML
      already contains every part of the picture; the stepper only decides
      which parts are visible or highlighted at the current step:
        data-from="k"        visible from step k on
        data-only="a b"      visible only at the listed steps
        data-now="a b"       highlighted (class is-now) at the listed steps
        data-dim="a b"       faded at the listed steps
        data-vals='["x",…]'  text per step (the last value carries forward)
        data-cls='{"2":"c"}' extra class from that step until another entry replaces it
      <ol class="steps"> holds one sentence per step. Without JavaScript the
      whole list is shown and every part of the picture is visible, so the
      figure still reads as a finished drawing.

   2. Wires — draws arrows between two elements (a pointer and what it
      points to), recomputed when the layout changes.

   Each figure-specific section below is registered by name and started for
   every element with a matching data-fig attribute. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var registry = {};
  function register(name, fn) { registry[name] = fn; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function inList(list, k) {
    return (" " + list + " ").indexOf(" " + k + " ") !== -1;
  }

  /* ------------------------------------------------------------------
     Wires
     ------------------------------------------------------------------ */
  var SVGNS = "http://www.w3.org/2000/svg";

  function Wires(container) {
    this.container = container;
    this.svg = document.createElementNS(SVGNS, "svg");
    this.svg.setAttribute("class", "wires");
    this.svg.setAttribute("aria-hidden", "true");
    container.appendChild(this.svg);
    this.list = [];
    var self = this;
    if (window.ResizeObserver) {
      new ResizeObserver(function () { self.render(); }).observe(container);
    } else {
      window.addEventListener("resize", function () { self.render(); });
    }
  }
  /* spec: {from, to, cls, fromSide, toSide}; sides: top|bottom|left|right */
  Wires.prototype.set = function (specs) { this.list = specs || []; this.render(); };
  Wires.prototype.render = function () {
    var svg = this.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var box = this.container.getBoundingClientRect();
    for (var i = 0; i < this.list.length; i++) {
      var w = this.list[i];
      if (!w.from || !w.to) continue;
      if (!w.from.offsetParent || !w.to.offsetParent) continue; /* display: none */
      if (w.from.closest(".is-off") || w.to.closest(".is-off")) continue; /* hidden by a stepper */
      var a = anchor(w.from.getBoundingClientRect(), w.fromSide || "bottom", box);
      var b = anchor(w.to.getBoundingClientRect(), w.toSide || "top", box);
      var d = curve(a, b, w.fromSide || "bottom", w.toSide || "top");
      var p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", d);
      p.setAttribute("class", w.cls || "");
      svg.appendChild(p);
      var h = document.createElementNS(SVGNS, "path");
      h.setAttribute("d", head(b, w.toSide || "top"));
      h.setAttribute("class", "head " + (w.cls || ""));
      h.setAttribute("style", "fill: currentColor; stroke: none");
      h.style.color = getComputedStyle(p).stroke;
      svg.appendChild(h);
      if (w.dot !== false) {
        var c = document.createElementNS(SVGNS, "circle");
        c.setAttribute("cx", a.x); c.setAttribute("cy", a.y); c.setAttribute("r", 3.2);
        c.setAttribute("style", "stroke: none; fill: " + getComputedStyle(p).stroke);
        svg.appendChild(c);
      }
    }
  };
  function anchor(r, side, box) {
    var x = r.left - box.left, y = r.top - box.top;
    if (side === "top") return { x: x + r.width / 2, y: y };
    if (side === "bottom") return { x: x + r.width / 2, y: y + r.height };
    if (side === "left") return { x: x, y: y + r.height / 2 };
    if (side === "right") return { x: x + r.width, y: y + r.height / 2 };
    if (side === "top-left") return { x: x + Math.min(14, r.width / 2), y: y };
    return { x: x + r.width / 2, y: y };
  }
  function dir(side) {
    if (side === "top" || side === "top-left") return { x: 0, y: -1 };
    if (side === "bottom") return { x: 0, y: 1 };
    if (side === "left") return { x: -1, y: 0 };
    return { x: 1, y: 0 };
  }
  function curve(a, b, sa, sb) {
    var da = dir(sa), db = dir(sb);
    var dist = Math.max(30, Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) * 0.45));
    var end = { x: b.x + db.x * 7, y: b.y + db.y * 7 };
    return "M" + a.x + "," + a.y +
      " C" + (a.x + da.x * dist) + "," + (a.y + da.y * dist) +
      " " + (end.x + db.x * dist) + "," + (end.y + db.y * dist) +
      " " + end.x + "," + end.y;
  }
  function head(b, side) {
    var d = dir(side), s = 7;
    /* arrow points opposite to the side's outward direction */
    var px = -d.y, py = d.x;
    var bx = b.x + d.x * s, by = b.y + d.y * s;
    return "M" + b.x + "," + b.y + " L" + (bx + px * s * 0.6) + "," + (by + py * s * 0.6) +
      " L" + (bx - px * s * 0.6) + "," + (by - py * s * 0.6) + " Z";
  }

  /* ------------------------------------------------------------------
     Stepper
     ------------------------------------------------------------------ */
  function Stepper(fig, opts) {
    opts = opts || {};
    this.fig = fig;
    this.steps = $all("ol.steps > li", fig);
    this.n = this.steps.length || parseInt(fig.getAttribute("data-steps"), 10) || 1;
    this.k = 0;
    this.onStep = opts.onStep || null;
    this.playable = fig.hasAttribute("data-play");
    this.say = $(".now-says", fig);
    if (!this.say) {
      this.say = el("p", { "class": "now-says", "aria-live": "polite" });
      var list = $("ol.steps", fig);
      if (list) list.parentNode.insertBefore(this.say, list);
    }
    this.buildControls(opts.controlsInto || $(".controls[data-stepper-controls]", fig));
    var self = this;
    fig.addEventListener("keydown", function (e) {
      if (e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") { self.go(self.k + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { self.go(self.k - 1); e.preventDefault(); }
    });
    this.go(0);
  }
  Stepper.prototype.buildControls = function (box) {
    var self = this;
    if (!box) {
      box = el("div", { "class": "controls" });
      this.say.parentNode.insertBefore(box, this.say);
    }
    var label = this.fig.getAttribute("data-label") || "diagram";
    this.bBack = el("button", { "class": "btn", type: "button", "aria-label": "Previous step of the " + label }, "← Back");
    this.bNext = el("button", { "class": "btn btn--main", type: "button", "aria-label": "Next step of the " + label }, "Next →");
    this.bReset = el("button", { "class": "btn", type: "button", "aria-label": "Reset the " + label + " to the first step" }, "Reset");
    box.appendChild(this.bBack);
    box.appendChild(this.bNext);
    if (this.playable) {
      this.bPlay = el("button", { "class": "btn", type: "button", "aria-label": "Play every step of the " + label }, "Play");
      box.appendChild(this.bPlay);
      this.bPlay.addEventListener("click", function () { self.togglePlay(); });
    }
    box.appendChild(this.bReset);
    this.counter = el("span", { "class": "counter", "aria-hidden": "true" });
    box.appendChild(this.counter);
    this.bBack.addEventListener("click", function () { self.stop(); self.go(self.k - 1); });
    this.bNext.addEventListener("click", function () { self.stop(); self.go(self.k + 1); });
    this.bReset.addEventListener("click", function () { self.stop(); self.go(0); });
  };
  Stepper.prototype.togglePlay = function () {
    if (this.timer) { this.stop(); return; }
    var self = this;
    if (this.k >= this.n - 1) this.go(0);
    this.bPlay.textContent = "Pause";
    this.timer = setInterval(function () {
      if (self.k >= self.n - 1) { self.stop(); return; }
      self.go(self.k + 1);
    }, reduceMotion ? 2600 : 1900);
  };
  Stepper.prototype.stop = function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.bPlay) this.bPlay.textContent = "Play";
  };
  Stepper.prototype.go = function (k) {
    k = Math.max(0, Math.min(this.n - 1, k));
    this.k = k;
    var fig = this.fig;
    fig.setAttribute("data-step", k);
    $all("[data-from]", fig).forEach(function (e) {
      e.classList.toggle("is-off", k < parseInt(e.getAttribute("data-from"), 10));
    });
    $all("[data-only]", fig).forEach(function (e) {
      e.classList.toggle("is-off", !inList(e.getAttribute("data-only"), k));
    });
    $all("[data-now]", fig).forEach(function (e) {
      e.classList.toggle("is-now", inList(e.getAttribute("data-now"), k));
    });
    $all("[data-dim]", fig).forEach(function (e) {
      e.classList.toggle("is-dim", inList(e.getAttribute("data-dim"), k));
    });
    $all("[data-vals]", fig).forEach(function (e) {
      var v = JSON.parse(e.getAttribute("data-vals"));
      e.textContent = v[Math.min(k, v.length - 1)];
    });
    $all("[data-cls]", fig).forEach(function (e) {
      var map = JSON.parse(e.getAttribute("data-cls"));
      var keys = Object.keys(map).map(Number).sort(function (a, b) { return a - b; });
      keys.forEach(function (key) { map[key].split(" ").forEach(function (c) { if (c) e.classList.remove(c); }); });
      var chosen = null;
      keys.forEach(function (key) { if (key <= k) chosen = map[key]; });
      if (chosen) chosen.split(" ").forEach(function (c) { if (c) e.classList.add(c); });
    });
    var li = this.steps[k];
    if (li) {
      this.say.innerHTML = li.innerHTML;
      this.say.classList.toggle("now-says--bad", li.classList.contains("bad"));
    }
    this.bBack.disabled = k === 0;
    this.bNext.disabled = k === this.n - 1;
    this.counter.textContent = "Step " + (k + 1) + " of " + this.n;
    if (this.onStep) this.onStep(k);
  };

  /* simple pressed-state toggles: <div class="seg" data-choice="name"><button data-value=…> */
  function choice(group, onChange) {
    var buttons = $all("button[data-value]", group);
    function pick(b) {
      buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      onChange(b.getAttribute("data-value"));
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { pick(b); }); });
    var start = buttons.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })[0] || buttons[0];
    if (start) pick(start);
    return { pick: function (v) { buttons.forEach(function (b) { if (b.getAttribute("data-value") === v) pick(b); }); } };
  }

  window.Diagrams = { register: register, Stepper: Stepper, Wires: Wires, choice: choice, $: $, $all: $all, el: el };

  document.addEventListener("DOMContentLoaded", function () {
    $all("[data-fig]").forEach(function (fig) {
      var fn = registry[fig.getAttribute("data-fig")];
      try {
        if (fn) fn(fig);
        else if (fig.querySelector("ol.steps")) new Stepper(fig);
      } catch (err) {
        /* a broken diagram must not take the page down; show its static form */
        fig.classList.add("is-static");
        if (window.console) console.error("diagram " + fig.getAttribute("data-fig") + ":", err);
      }
    });
  });

  /* ==================================================================
     Figure-specific sections
     ================================================================== */

  /* ---- generic stepper with arrows declared in markup ----------------
     <figure data-fig="steps-wires"> with elements carrying
     data-wire-from="id-of-target" data-wire-side="bottom>top"
     data-wire-cls="ref" data-wire-steps="2 3 4" (steps when the arrow shows) */
  register("steps-wires", function (fig) {
    var body = $(".fig__body", fig) || fig;
    var wires = new Wires(body);
    new Stepper(fig, {
      onStep: function (k) {
        var specs = [];
        $all("[data-wire-to]", fig).forEach(function (src) {
          var steps = src.getAttribute("data-wire-steps");
          if (steps && !inList(steps, k)) return;
          var target = document.getElementById(src.getAttribute("data-wire-to"));
          var sides = (src.getAttribute("data-wire-side") || "bottom>top").split(">");
          specs.push({ from: src, to: target, cls: src.getAttribute("data-wire-cls") || "", fromSide: sides[0], toSide: sides[1] });
        });
        /* wait for visibility transitions to settle so positions are final */
        wires.set(specs);
        setTimeout(function () { wires.render(); }, 260);
      }
    });
  });

  /* ---- 03: one executable, two processes --------------------------
     Writing scores[0] in one process changes only that process's frame. */
  register("twoproc", function (fig) {
    var vals = { A: 10, B: 10 };
    var frame = { A: 7, B: 12 };
    var say = $(".now-says", fig);
    function show(who) {
      ["A", "B"].forEach(function (p) {
        $('[data-val="' + p + '"]', fig).textContent = vals[p];
        $('[data-fval="' + p + '"]', fig).textContent = vals[p];
        $('[data-row="' + p + '"]', fig).classList.toggle("is-now", p === who);
        $('[data-frame="' + p + '"]', fig).classList.toggle("is-now", p === who);
      });
    }
    $all("[data-write]", fig).forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.getAttribute("data-write"), other = p === "A" ? "B" : "A";
        vals[p] += 1;
        show(p);
        say.innerHTML = "Process " + p + " wrote to <code>0x5000</code>. In its address space that address leads to frame " +
          frame[p] + ", so only frame " + frame[p] + " changed. Process " + other + " still reads " + vals[other] +
          " at the very same address, because for " + other + " it leads to frame " + frame[other] + ".";
      });
    });
    $("[data-reset]", fig).addEventListener("click", function () {
      vals = { A: 10, B: 10 }; show(null);
      say.innerHTML = "Both processes use the address <code>0x5000</code>. The kernel connected that address to a different frame of RAM in each process.";
    });
  });

  /* ---- 04: the address-space map ----------------------------------
     Clicking a region shows its "what lives here / who manages it" panel.
     The overlay toggle shows a second run of the same program. */
  register("vmmap", function (fig) {
    var vm = $(".vm", fig);
    var regions = $all("button.vreg", fig);
    var panels = $all(".vm__detail > div", fig);
    function showPanel(name) {
      panels.forEach(function (p) { p.classList.toggle("is-shown", p.getAttribute("data-d") === name); });
    }
    regions.forEach(function (b) {
      b.addEventListener("click", function () {
        regions.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        showPanel(b.getAttribute("data-r"));
        if (window.innerWidth < 900) {
          var shown = $(".vm__detail > .is-shown", fig);
          if (shown) shown.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
        }
      });
    });
    choice($('[data-choice="overlay"]', fig), function (v) {
      vm.classList.toggle("show-b", v === "ab");
      if (v === "ab") {
        regions.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        showPanel("b");
      } else {
        showPanel("intro");
      }
    });
  });

  /* ---- 05: address translator --------------------------------------
     Toy machine: 16-bit virtual addresses, 4 KiB pages (12-bit offset),
     so the first hex digit is the page number. 16 physical frames.
     Every translation is computed as a list of steps, each with a full
     snapshot of the machine, so Back can undo a page fault's changes. */
  register("translate", function (fig) {
    var HEX = "0123456789ABCDEF";
    function initial() {
      var pt = { A: [], B: [] };
      for (var i = 0; i < 16; i++) { pt.A.push(null); pt.B.push(null); }
      function m(p, v, f, perm, use, present) { pt[p][v] = { f: f, perm: perm, use: use, present: present !== false }; }
      m("A", 1, 3, "r-x", "code (shared)"); m("B", 1, 3, "r-x", "code (shared)");
      m("A", 2, 6, "r--", "read-only data"); m("B", 2, 6, "r--", "read-only data");
      m("A", 4, 9, "rw-", "heap: scores buffer"); m("B", 4, 1, "rw-", "heap: scores buffer");
      m("A", 5, 7, "rw-", "data"); m("B", 5, 12, "rw-", "data");
      m("A", 6, null, "rw-", "anonymous, never written", false); m("B", 6, null, "rw-", "anonymous, never written", false);
      m("A", 14, 2, "rw-", "main thread stack"); m("B", 14, 14, "rw-", "main thread stack");
      return {
        pt: pt,
        tlb: [{ p: "A", v: 1, f: 3, perm: "r-x" }],
        free: { A: 11, B: 0 }
      };
    }
    var FRAMES = {
      1: ["B", "B: heap"], 2: ["A", "A: stack"], 3: ["AB", "code"], 6: ["AB", "read-only data"],
      7: ["A", "A: data"], 9: ["A", "A: heap"], 12: ["B", "B: data"], 14: ["B", "B: stack"],
      13: ["k", "B's page table"], 15: ["k", "A's page table"]
    };
    var machine = initial();
    var proc = "A", kind = "read";
    var steps = [], k = 0;

    var input = $("#va-input", fig), say = $("[data-say]", fig);
    var bNext = $("[data-next]", fig), bBack = $("[data-back]", fig), counter = $("[data-counter]", fig);

    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function hex(n, w) { var s = n.toString(16).toUpperCase(); while (s.length < w) s = "0" + s; return s; }
    function allowed(perm, kind) { return kind === "read" ? perm[0] === "r" : kind === "write" ? perm[1] === "w" : perm[2] === "x"; }
    var verb = { read: "read", write: "write to", exec: "execute code at" };

    function plan(p, va, kind) {
      var st = clone(machine), out = [];
      var v = va >> 12, off = va & 0xFFF, offs = hex(off, 3);
      var hl = { vpn: hex(v, 1), off: offs, pfn: "?", tlb: -1, pte: -1, frame: -1 };
      function push(text, extra, bad) {
        out.push({ text: text, st: clone(st), hl: Object.assign({}, hl, extra || {}), bad: !!bad });
      }
      push("Process " + p + " wants to " + verb[kind] + " <code>0x" + hex(va, 4) + "</code>. The MMU splits it: page <code>" +
        hex(v, 1) + "</code>, offset <code>0x" + offs + "</code> (byte " + off + " of the page).");
      var ti = -1;
      st.tlb.forEach(function (e, i) { if (e.p === p && e.v === v) ti = i; });
      var e;
      if (ti >= 0) {
        e = st.tlb[ti];
        st.tlb.unshift(st.tlb.splice(ti, 1)[0]);
        push("<b>TLB hit.</b> The TLB already holds (" + p + ", page " + hex(v, 1) + " → frame " + e.f + ", " + e.perm +
          "). No page-table walk is needed.", { tlb: 0 });
      } else {
        push("<b>TLB miss.</b> No cached translation for (" + p + ", page " + hex(v, 1) + "). The hardware must read the page table in memory.");
        var pte = st.pt[p][v];
        if (!pte) {
          push("Entry " + hex(v, 1) + " of " + p + "'s page table says <b>not mapped</b>. The MMU raises a page fault and the CPU switches to the kernel.", { pte: v }, true);
          push("<b>The kernel decides: illegal.</b> No mapping of this process covers <code>0x" + hex(va, 4) + "</code>. It sends <code>SIGSEGV</code> and, by default, the process ends with “Segmentation fault”. (The toy machine keeps going so you can try another address.)", { pte: v }, true);
          return out;
        }
        if (!pte.present) {
          push("Entry " + hex(v, 1) + " says <b>mapped but not present</b>: this page belongs to an anonymous " + pte.perm +
            " mapping that has never been used, so it has no frame. The MMU raises a page fault.", { pte: v });
          var nf = st.free[p];
          pte.present = true; pte.f = nf; pte.use = "anonymous, now in use";
          st.newFrame = { f: nf, p: p };
          push("<b>The kernel decides: legal.</b> The address is inside a mapping. It takes free frame " + nf +
            ", fills it with zeros, records it in the page table, and restarts the instruction. The program never sees this.", { pte: v, frame: nf, changed: v });
        }
        if (!allowed(pte.perm, kind)) {
          push("Entry " + hex(v, 1) + ": frame " + pte.f + ", allowed <code>" + pte.perm + "</code>. A " + (kind === "exec" ? "fetch for execution" : kind) +
            " is <b>not allowed</b> on this page. The MMU raises a page fault.", { pte: v }, true);
          push("<b>The kernel decides: illegal.</b> The page is mapped, but not for this kind of access. It sends <code>SIGSEGV</code>. (The toy machine keeps going so you can try another address.)", { pte: v }, true);
          return out;
        }
        e = { p: p, v: v, f: pte.f, perm: pte.perm };
        st.tlb.unshift(e);
        if (st.tlb.length > 4) st.tlb.pop();
        push("Entry " + hex(v, 1) + ": present, frame " + pte.f + ", allowed <code>" + pte.perm + "</code>. The access is allowed, and the translation is saved in the TLB.", { pte: v, tlb: 0 });
      }
      if (!allowed(e.perm, kind)) {
        push("The TLB entry says <code>" + e.perm + "</code>: this access is <b>not allowed</b>. Page fault, and the kernel sends <code>SIGSEGV</code>. (The toy machine keeps going so you can try another address.)", { tlb: 0 }, true);
        return out;
      }
      var other = p === "A" ? "B" : "A", op = st.pt[other][v];
      var note = op && op.present && op.f !== e.f ? " Process " + other + " using the same address would reach frame " + op.f + "." :
        op && op.f === e.f ? " Process " + other + " maps this page to the same frame: it is shared." : "";
      push("<b>Physical address <code>0x" + hex(e.f, 1) + offs + "</code></b>: frame " + e.f + ", same offset. The memory access goes ahead." + note,
        { pfn: hex(e.f, 1), frame: e.f, tlb: 0 });
      return out;
    }

    function render(s) {
      var st = s.st, hl = s.hl;
      $('[data-out="vpn"]', fig).textContent = hl.vpn;
      $('[data-out="off"]', fig).textContent = hl.off;
      $('[data-out="off2"]', fig).textContent = hl.off;
      $('[data-out="pfn"]', fig).textContent = hl.pfn;
      $('[data-out="ptname"]', fig).textContent = "Page table of process " + proc;
      $('[data-out="result"]', fig).textContent = hl.pfn === "?" ? "" : "Process " + proc + " → physical 0x" + hl.pfn + hl.off;
      var tb = $("[data-tlb]", fig); tb.innerHTML = "";
      st.tlb.forEach(function (e, i) {
        var tr = el("tr"); if (i === hl.tlb) tr.className = "is-now";
        [e.p, HEX[e.v], e.f, e.perm].forEach(function (x) { tr.appendChild(el("td", null, String(x))); });
        tb.appendChild(tr);
      });
      var pb = $("[data-ptab]", fig); pb.innerHTML = "";
      st.pt[proc].forEach(function (e, v) {
        /* runs of unmapped pages collapse into one row unless one is being looked at */
        var prevEmpty = v > 0 && !st.pt[proc][v - 1] && v - 1 !== hl.pte;
        if (!e && v !== hl.pte && prevEmpty) return;
        var last = v;
        if (!e && v !== hl.pte) while (last + 1 < 16 && !st.pt[proc][last + 1] && last + 1 !== hl.pte) last++;
        var tr = el("tr");
        if (v === hl.pte) tr.className = s.bad ? "is-bad" : "is-now";
        if (v === hl.changed) tr.className += " is-changed";
        var state = !e ? "not mapped" : e.present ? "present" : "mapped, not present";
        var cells = [last > v ? HEX[v] + "\u2013" + HEX[last] : HEX[v], state, e && e.present ? e.f : e ? "—" : "", e ? e.perm : "", e ? e.use : ""];
        cells.forEach(function (x, i) { var td = el("td", null, String(x)); if (i === 1 && !e) td.className = "inv"; tr.appendChild(td); });
        pb.appendChild(tr);
      });
      var ram = $("[data-ram]", fig); ram.innerHTML = "";
      for (var f = 0; f < 16; f++) {
        var d = el("div"); d.className = "rf";
        var info = FRAMES[f];
        if (st.newFrame && st.newFrame.f === f) info = [st.newFrame.p, st.newFrame.p + ": zero-filled"];
        ["A", "B"].forEach(function (p) {
          st.pt[p].forEach(function (e, v) {
            if (e && e.present && e.f === f && (f === 11 || f === 0)) info = [p, p + ": page " + HEX[v]];
          });
        });
        if (info) d.className += " " + (info[0] === "AB" ? "ab" : info[0] === "k" ? "k" : info[0].toLowerCase());
        if (f === hl.frame) d.className += " is-now";
        d.appendChild(el("span", { "class": "fn" }, "frame " + f));
        d.appendChild(document.createTextNode(info ? info[1] : "free"));
        ram.appendChild(d);
      }
      say.innerHTML = s.text;
      say.classList.toggle("now-says--bad", s.bad);
    }

    function go(i) {
      k = Math.max(0, Math.min(steps.length - 1, i));
      render(steps[k]);
      bBack.disabled = k === 0;
      bNext.disabled = k === steps.length - 1;
      counter.textContent = "Step " + (k + 1) + " of " + steps.length;
      if (k === steps.length - 1) machine = clone(steps[k].st);
    }
    function idle(msg) {
      steps = [{ text: msg, st: clone(machine), hl: { vpn: "·", off: "···", pfn: "·", tlb: -1, pte: -1, frame: -1 }, bad: false }];
      go(0);
    }
    function start() {
      var raw = input.value.trim().replace(/^0x/i, "");
      if (!/^[0-9a-f]{1,4}$/i.test(raw)) {
        idle("That is not a 16-bit hexadecimal address. Use one to four hex digits, such as <code>0x5010</code>.");
        say.classList.add("now-says--bad");
        return;
      }
      var va = parseInt(raw, 16);
      input.value = "0x" + hex(va, 4);
      steps = plan(proc, va, kind);
      go(0);
    }

    var procChoice = choice($('[data-choice="proc"]', fig), function (v) { proc = v; if (steps.length) idle("Process " + v + " selected. Press Translate."); });
    var kindChoice = choice($('[data-choice="kind"]', fig), function (v) { kind = v; });
    $("[data-go]", fig).addEventListener("click", start);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") start(); });
    bNext.addEventListener("click", function () { go(k + 1); });
    bBack.addEventListener("click", function () { go(k - 1); });
    $("[data-reset]", fig).addEventListener("click", function () { machine = initial(); idle("Machine reset: TLB, page tables and frames are back to their starting state."); });
    $all("[data-try]", fig).forEach(function (b) {
      b.addEventListener("click", function () {
        var parts = b.getAttribute("data-try").split(" ");
        input.value = parts[0];
        kindChoice.pick(parts[1]);
        start();
      });
    });
    idle("Choose a process and an address, then press <b>Translate</b>. Each press of <b>Next</b> shows one thing the hardware or the kernel does.");
  });

  /* ---- 06: two threads, one address space ---------------------------
     Each lane has its own stack. Calling or returning in one lane never
     touches the other. Arrows: an owner's pointer (solid) and references
     (dashed) into thread 1's frame, where `scores` lives. */
  register("threads", function (fig) {
    var body = $(".fig__body", fig);
    var wires = new Wires(body);
    var base = { 1: "main", 2: "closure" };
    var stacks;
    var say = $(".now-says", fig);
    $all(".no-js-only", fig).forEach(function (n) { if (n.classList.contains("frm")) n.parentNode.removeChild(n); });

    function frameEl(t, name, depth) {
      var d = el("div", { "class": "frm" });
      d.appendChild(el("b", null, name));
      var slots = name === "main" ? "scores: ptr · len 3 · cap 3" :
        name === "closure" ? "captured: &scores" : "values: &scores · sum";
      d.appendChild(el("span", { "class": "slots" }, slots));
      if (t === 1 && name === "main") d.id = "t1-main";
      return d;
    }
    function render(changed) {
      var specs = [];
      [1, 2].forEach(function (t) {
        var col = $('[data-stack="' + t + '"]', fig);
        col.innerHTML = "";
        stacks[t].forEach(function (name, i) {
          var f = frameEl(t, name, i);
          if (i === stacks[t].length - 1) f.classList.add("is-top");
          col.appendChild(f);
        });
        var top = stacks[t][stacks[t].length - 1];
        $('[data-ip="' + t + '"]', fig).textContent = top;
        $('[data-sp="' + t + '"]', fig).textContent = "top of " + top + "'s frame";
        $('[data-lane="' + t + '"]', fig).classList.toggle("is-now", t === changed);
      });
      var mainFrame = $("#t1-main", fig);
      specs.push({ from: mainFrame, to: $("#t-buf", fig), fromSide: "top", toSide: "bottom", cls: "" });
      var l1 = $('[data-lane="1"]', fig).getBoundingClientRect();
      var l2 = $('[data-lane="2"]', fig).getBoundingClientRect();
      var stacked = l2.top >= l1.bottom - 1;
      $all(".frm", fig).forEach(function (f) {
        if (f === mainFrame) return;
        var sameLane = f.parentNode === mainFrame.parentNode;
        if (sameLane) specs.push({ from: f, to: mainFrame, fromSide: "left", toSide: "left", cls: "ref" });
        else if (stacked) specs.push({ from: f, to: mainFrame, fromSide: "right", toSide: "right", cls: "ref" });
        else specs.push({ from: f, to: mainFrame, fromSide: "left", toSide: "right", cls: "ref" });
      });
      wires.set(specs);
    }
    function act(a) {
      var parts = a.split(" "), t = +parts[1], other = t === 1 ? 2 : 1;
      if (parts[0] === "reset") {
        stacks = { 1: ["main"], 2: ["closure"] }; render(0);
        say.innerHTML = "Back to the start: thread 1 is in <code>main</code>, thread 2 is in the closure.";
        return;
      }
      if (parts[0] === "call") {
        if (stacks[t].indexOf("total") !== -1) { say.innerHTML = "Thread " + t + " is already inside <code>total</code>."; return; }
        stacks[t].push("total");
        render(t);
        say.innerHTML = "Thread " + t + " called <code>total</code>. A new frame went on <b>thread " + t + "'s</b> stack. Its <code>values</code> holds the address of <code>scores</code>, which sits in thread 1's <code>main</code> frame. Thread " + other + "'s stack did not change.";
      } else {
        if (stacks[t].length === 1) { say.innerHTML = "Thread " + t + " is in its first function (" + base[t] + "). Returning from it would end the thread; this diagram stops here."; return; }
        stacks[t].pop();
        render(t);
        say.innerHTML = "<code>total</code> returned in thread " + t + ". Its frame is gone from thread " + t + "'s stack; the space will be reused by the next call. The buffer, owned by <code>scores</code>, is untouched. Thread " + other + " was not affected.";
      }
    }
    $all("[data-act]", fig).forEach(function (b) { b.addEventListener("click", function () { act(b.getAttribute("data-act")); }); });
    stacks = { 1: ["main"], 2: ["closure"] };
    render(0);
  });


  /* ---- 07: one load ------------------------------------------------
     Two lanes. The TLB choice decides whether the walk happens; the level
     choice decides how far down the data lookup goes. The stepper walks
     through the five stages and the narration follows the choices. */
  register("load", function (fig) {
    var tlb = "hit", level = "l1";
    var order = ["l1", "l2", "l3", "ram"];
    var names = { l1: "L1", l2: "L2", l3: "L3", ram: "RAM" };
    var hop = function (n) { return $('[data-hop="' + n + '"]', fig); };
    var stepper;

    function res(n, text, cls) {
      var r = $(".res", hop(n));
      r.textContent = text || "";
      r.className = "res" + (cls ? " " + cls : "");
    }

    function draw(k) {
      $all(".hop", fig).forEach(function (h) { h.classList.remove("is-now", "is-skip"); });
      ["tlb", "walk"].concat(order).forEach(function (n) { res(n, ""); });
      var li = order.indexOf(level);

      /* results that are already known by step k stay visible */
      if (k >= 1) {
        res("tlb", tlb === "hit" ? "hit" : "miss", tlb === "hit" ? "hit" : "miss");
        if (tlb === "hit") hop("walk").classList.add("is-skip");
        else res("walk", "walked", "hit");
      }
      if (k >= 3) {
        order.forEach(function (n, i) {
          if (i < li) res(n, "miss", "miss");
          else if (i === li) res(n, n === "ram" ? "read" : "hit", "hit");
          else hop(n).classList.add("is-skip");
        });
      }

      var say = "";
      if (k === 0) { hop("va").classList.add("is-now"); say = "The core computes the virtual address <code>rdi + 4</code> = <code>0x579e63956d54</code>."; }
      if (k === 1) {
        hop("tlb").classList.add("is-now");
        if (tlb === "hit") say = "TLB hit: the translation for this page is cached, so the MMU has the frame number at once. No page-table walk.";
        else { hop("walk").classList.add("is-now"); say = "TLB miss: the hardware walks the page tables, reading entries from memory (those reads can themselves hit in the caches), then puts the translation in the TLB."; }
      }
      if (k === 2) { hop("pa").classList.add("is-now"); say = "The physical address is ready: the frame from the translation, with the page offset <code>0xd54</code> unchanged."; }
      if (k === 3) {
        for (var i = 0; i <= li; i++) hop(order[i]).classList.add("is-now");
        if (level === "l1") say = "L1 hit: the line is already in the core's L1 data cache. This is the common case in a loop like <code>total</code>.";
        else if (level === "ram") say = "Miss in L1, L2 and L3: the 64-byte line has to come from RAM. This is the slowest case.";
        else say = "Miss in " + order.slice(0, li).map(function (n) { return names[n]; }).join(" and ") + ", hit in " + names[level] + ": the line is copied from there.";
      }
      if (k === 4) {
        hop("reg").classList.add("is-now");
        say = (level === "l1" ? "The 4 bytes are read from L1" : "The whole line is brought up into the faster levels on the way back (in a typical design), and the 4 bytes are taken from it") + ": <code>eax</code> = 20.";
      }
      stepper.say.innerHTML = say;
    }

    stepper = new Stepper(fig, { onStep: function (k) { if (stepper) draw(k); } });
    draw(stepper.k);
    choice($('[data-choice="tlb"]', fig), function (v) { tlb = v; draw(stepper.k); });
    choice($('[data-choice="level"]', fig), function (v) { level = v; draw(stepper.k); });
  });


  /* ---- 09: binding / value / storage / heap -----------------------
     A choice picks one example; arrows go from each pointer to the heap
     block it owns. Without JavaScript every example is shown. */
  register("bv", function (fig) {
    var body = $(".fig__body", fig);
    var wires = new Wires(body);
    var groups = $all("[data-ex]", fig);
    function draw() {
      var one = getComputedStyle($(".bv", fig)).gridTemplateColumns.split(" ").length === 1;
      var specs = [];
      $all("[data-ptr]", fig).forEach(function (p) {
        specs.push({
          from: p, to: document.getElementById(p.getAttribute("data-ptr")), cls: "own",
          fromSide: one ? "bottom" : "right", toSide: one ? "top" : "left"
        });
      });
      wires.set(specs);
    }
    choice($('[data-choice="ex"]', fig), function (v) {
      groups.forEach(function (g) { g.classList.toggle("is-shown", g.getAttribute("data-ex") === v); });
      draw();
    });
    window.addEventListener("resize", draw);
  });


  /* ---- 10: Vec handle and buffer ------------------------------------
     Steps through vec![10, 20] → push(30) → push(40). Two choices:
     what the allocator does when the buffer must grow (both outcomes
     were observed with examples/vec.rs), and whether a reference into
     the buffer is held across the push. */
  register("vec", function (fig) {
    var stage = $(".vecfig", fig);
    var codeBox = $("[data-vec-code]", fig);
    var errBox = $("[data-vec-error]", fig);
    var wires;
    var outcome = "place", borrow = false;
    /* addresses from one run of examples/vec.rs: v grew in place at …8d50;
       w (with a neighbour after it) moved from …8d70 to …8db0 */
    var A_PLACE = "0x5621…8d50", A_MOVE = "0x5621…8d70", B = "0x5621…8db0", A = A_PLACE;

    var CODE = [
      ["let mut scores = vec![10, 20];", [0]],
      ["let first = &scores[0];", [0], "borrow"],
      ["scores.push(30);", [1, 2, 3]],
      ["scores.push(40);", [4], "noborrow"],
      ["println!(\"{first}\");", [4], "borrow"]
    ];

    function cells(vals, cap, opts) {
      opts = opts || {};
      var box = el("div", { "class": "cells" });
      for (var i = 0; i < cap; i++) {
        var has = i < vals.length;
        var c = el("div", { "class": "cell" + (has ? "" : " cell--spare") + (opts.newAt === i ? " is-new" : "") + (opts.copied && has ? " is-new" : "") });
        c.textContent = has ? vals[i] : "·";
        c.appendChild(el("small", null, has ? "[" + i + "]" : "spare"));
        if (i === 0) c.id = opts.id0;
        box.appendChild(c);
      }
      return box;
    }

    function narrate(k, moved) {
      var t = "";
      if (k === 0) t = "<code>vec![10, 20]</code> asks the allocator for room for exactly two <code>i32</code>s (8 bytes) and fills it. The handle records where the buffer is (<code>ptr</code>), how many elements are in use (<code>len</code>) and how many fit (<code>cap</code>)." + (borrow ? " <code>first</code> borrows <code>scores</code> and points at element 0." : "");
      if (k === 1) t = "<code>push(30)</code>: <code>len</code> equals <code>cap</code>, so there is no free slot. The <code>Vec</code> asks the allocator for a bigger block, room for 4 in this run. How much a <code>Vec</code> grows by is not specified." + (borrow ? " <b>This is the line the compiler rejects:</b> <code>push</code> needs <code>&amp;mut scores</code> while <code>first</code> still borrows it." : "");
      if (k === 2 && !moved) t = "The allocator had room right after the block and grew it where it was, so <code>ptr</code> does not change. This is what happened for this exact code in <code>examples/vec.rs</code>." + (borrow ? " <code>first</code> would happen to stay valid here, but nobody can know in advance which outcome the allocator will choose, so the program is rejected either way." : "");
      if (k === 2 && moved) t = "Another allocation sits right after the block, so it cannot grow in place. The allocator hands out a new block, 10 and 20 are copied into it, and the old block is freed. <code>ptr</code> now holds the new address." + (borrow ? " <code>first</code> still holds the old address: it would point into freed memory." : "");
      if (k === 3) t = "30 is written into slot [2]. <code>len</code> becomes 3; <code>cap</code> stays 4.";
      if (k === 4) t = borrow ? "<code>println!</code> uses <code>first</code>. That later use keeps the borrow alive across the push, which is why the push is rejected. Without this line the borrow would end earlier and the program would compile." : "<code>push(40)</code>: there is a spare slot, so nothing is allocated. 40 goes into slot [3]; <code>len</code> is 4, <code>cap</code> is 4.";
      return t;
    }

    function draw(k) {
      A = outcome === "move" ? A_MOVE : A_PLACE;
      var moved = outcome === "move" && k >= 2;
      var cap = k >= 2 ? 4 : 2;
      var vals = k >= 4 && !borrow ? [10, 20, 30, 40] : k >= 3 ? [10, 20, 30] : [10, 20];
      var len = vals.length;
      var ptr = moved ? B : A;
      stepper.say.innerHTML = narrate(k, moved);

      /* code */
      codeBox.innerHTML = "";
      CODE.forEach(function (row) {
        if (row[2] === "borrow" && !borrow) return;
        if (row[2] === "noborrow" && borrow) return;
        var ln = el("span", { "class": "ln" + (row[1].indexOf(k) !== -1 ? " is-now" : "") }, row[0]);
        codeBox.appendChild(ln);
      });
      errBox.hidden = !borrow;

      /* picture */
      stage.innerHTML = "";
      var top = el("div", { "class": "handle-row" });
      top.appendChild(el("span", { "class": "name" }, "scores"));
      var h = el("div", { "class": "handle" });
      [["ptr", ptr], ["len", len], ["cap", cap]].forEach(function (f, i) {
        var d = el("div");
        d.appendChild(el("small", null, f[0]));
        var b = el("b", null, String(f[1]));
        d.appendChild(b);
        if (i === 0) d.id = "vec-ptr";
        if ((k === 1 && i > 0) || (k === 2 && i !== 1) || (k >= 3 && i === 1)) d.classList.add("is-now");
        h.appendChild(d);
      });
      top.appendChild(h);
      top.appendChild(el("span", { "class": "note-sm" }, "24 bytes, in main's frame"));
      stage.appendChild(top);

      var refRow = null;
      if (borrow) {
        refRow = el("div", { "class": "handle-row" });
        refRow.appendChild(el("span", { "class": "name" }, "first"));
        var dangling = moved;
        var rb = el("span", { "class": "refbox" + (dangling ? " is-bad" : ""), id: "vec-ref" }, "&i32 → " + A);
        refRow.appendChild(rb);
        refRow.appendChild(el("span", { "class": "borrow-mark" + (k >= 1 ? " is-bad" : "") },
          k === 0 ? "shared borrow of scores" :
            dangling ? "would point into freed memory" :
              "still borrowing scores while push needs &mut"));
        stage.appendChild(refRow);
      }

      var heap = el("div", { "class": "heap-zone" });
      heap.appendChild(el("div", { "class": "heap-zone__h" }, "Heap · blocks from the global allocator"));
      var bufs = el("div", { "class": "bufs" });

      var bufA = el("div", { "class": "buf" + (moved ? " is-freed" : "") });
      bufA.appendChild(el("span", { "class": "buf__addr" }, A + (k === 2 && outcome === "place" ? "  same block, grown in place" : "")));
      bufA.appendChild(cells(moved ? [10, 20] : vals, moved ? 2 : cap, { id0: "vec-a0", newAt: (k === 3 || k === 4) && !moved ? len - 1 : -1 }));
      bufs.appendChild(bufA);

      if (outcome === "move") {
        var nb = el("div", { "class": "buf" });
        nb.appendChild(el("span", { "class": "buf__addr" }, "another allocation"));
        var nbc = el("div", { "class": "cells" });
        var nc = el("div", { "class": "cell cell--spare" }, "…");
        nc.appendChild(el("small", null, "not scores"));
        nbc.appendChild(nc);
        nb.appendChild(nbc);
        bufs.appendChild(nb);
      }
      if (moved) {
        var bufB = el("div", { "class": "buf" });
        bufB.appendChild(el("span", { "class": "buf__addr" }, B + (k === 2 ? "  new block, 10 and 20 copied" : "")));
        bufB.appendChild(cells(vals, 4, { id0: "vec-b0", copied: k === 2, newAt: k >= 3 ? len - 1 : -1 }));
        bufs.appendChild(bufB);
      }
      heap.appendChild(bufs);
      stage.appendChild(heap);

      if (!wires) wires = new Wires(stage);
      else stage.appendChild(wires.svg);
      var specs = [{ from: $("#vec-ptr", fig), to: $(moved ? "#vec-b0" : "#vec-a0", fig), cls: "own" }];
      if (borrow) specs.push({ from: $("#vec-ref", fig), to: $("#vec-a0", fig), cls: moved ? "bad" : "ref", fromSide: "bottom", toSide: "top" });
      wires.set(specs);
    }

    var stepper = null;
    stepper = new Stepper(fig, { onStep: function (k) { if (stepper) draw(k); } });
    choice($('[data-choice="grow"]', fig), function (v) { outcome = v; draw(stepper.k); });
    choice($('[data-choice="borrow"]', fig), function (v) { borrow = v === "yes"; draw(stepper.k); });
    draw(stepper.k);
  });


  /* ---- generic: a static drawing with arrows declared in markup -------
     Same attributes as steps-wires, without steps. */
  register("wires", function (fig) {
    var body = $(".fig__body", fig) || fig;
    var wires = new Wires(body);
    function draw() {
      /* data-wire-side-sm: sides to use when the drawing is narrow (one column) */
      var narrow = body.getBoundingClientRect().width < 700;
      wires.set($all("[data-wire-to]", fig).map(function (src) {
        var side = (narrow && src.getAttribute("data-wire-side-sm")) || src.getAttribute("data-wire-side") || "bottom>top";
        var sides = side.split(">");
        return {
          from: src, to: document.getElementById(src.getAttribute("data-wire-to")),
          cls: src.getAttribute("data-wire-cls") || "", fromSide: sides[0], toSide: sides[1]
        };
      }));
    }
    draw();
    window.addEventListener("resize", draw);
  });

  /* ---- generic: one choice shows one of several panels ------------------
     <div class="seg" data-choice="pick"> buttons with data-value, panels with
     data-pick="value". Without JavaScript every panel is shown. */
  register("pick", function (fig) {
    var panels = $all("[data-pick]", fig);
    choice($('[data-choice="pick"]', fig), function (v) {
      panels.forEach(function (p) { p.classList.toggle("is-shown", p.getAttribute("data-pick") === v); });
    });
  });


  /* ---- 13: iterators -------------------------------------------------
     One loop over scores, in three modes. The iterator is drawn as its own
     value with a cursor into the buffer; the item it hands out each step is
     a reference into the buffer, or the element itself. */
  register("iter", function (fig) {
    var stage = $(".iterfig", fig);
    var codeBox = $("[data-iter-code]", fig);
    var mode = "iter", wires = null, stepper = null;
    var M = {
      iter: { call: "scores.iter()", item: "&i32", body: "println!(\"{s}\");", state: ["borrowed", "shared borrow (&) by the iterator"], it: "slice::Iter", size: 16 },
      iter_mut: { call: "scores.iter_mut()", item: "&mut i32", body: "*s += 1;", state: ["borrowed", "mutable borrow (&mut) by the iterator"], it: "slice::IterMut", size: 16 },
      into_iter: { call: "scores.into_iter()", item: "i32", body: "let owned: i32 = s;", state: ["moved", "moved into the iterator"], it: "vec::IntoIter", size: 32 }
    };

    function narrate(k) {
      var m = M[mode];
      if (k === 0) return "<code>" + m.call + "</code> creates a separate iterator value (" + m.size + " bytes in this build) that " + (mode === "into_iter" ? "takes ownership of the whole <code>Vec</code>, buffer included. <code>scores</code> can no longer be used." : "borrows <code>scores</code>. Its cursor starts at element 0. Nothing has been read yet: iterators are lazy.");
      if (k >= 1 && k <= 3) {
        var i = k - 1;
        if (mode === "iter") return "The loop calls <code>next()</code>: it returns <code>Some(&amp;scores[" + i + "])</code>, a reference to the element in the buffer, and moves the cursor on. Nothing is copied out.";
        if (mode === "iter_mut") return "<code>next()</code> returns a <code>&amp;mut i32</code> to element " + i + ". <code>*s += 1</code> writes straight into the buffer.";
        return "<code>next()</code> moves element " + i + " out of the buffer and hands over the <code>i32</code> itself. For an <code>i32</code> that is a 4-byte copy; for a <code>String</code> it would be the handle.";
      }
      if (mode === "into_iter") return "<code>next()</code> returns <code>None</code> and the loop ends. The iterator is dropped, and because it owns the buffer, the buffer is freed here.";
      return "<code>next()</code> returns <code>None</code> and the loop ends. The iterator is dropped, the borrow ends, and <code>scores</code> can be used again" + (mode === "iter_mut" ? ", now holding 11, 21, 31." : ".");
    }

    function draw(k) {
      var m = M[mode];
      var done = k === 4;
      var cur = Math.min(k, 3); /* cursor position: 0..3, 3 = end */
      var vals = [10, 20, 30].map(function (v, i) { return mode === "iter_mut" && i < k ? v + 1 : v; });

      codeBox.innerHTML = "";
      [["let mut scores = vec![10, 20, 30];", []], ["for s in " + m.call + " {", [0, 4]], ["    " + m.body, [1, 2, 3]], ["}", [4]]].forEach(function (r) {
        codeBox.appendChild(el("span", { "class": "ln" + (r[1].indexOf(k) !== -1 ? " is-now" : "") }, r[0]));
      });
      stepper.say.innerHTML = narrate(k);

      stage.innerHTML = "";
      /* top row: scores handle and the iterator */
      var row = el("div", { "class": "iter-item" });
      var sc = el("div", { "class": "var" + (mode === "into_iter" ? " is-moved" : "") });
      var nm = el("span", { "class": "var__name" });
      nm.appendChild(el("span", { "class": "nm" }, "scores"));
      var stateTxt = done && mode !== "into_iter" ? "owner, usable again" : m.state[1];
      nm.appendChild(el("span", { "class": "var__state " + (done && mode !== "into_iter" ? "owner" : m.state[0]) }, stateTxt));
      sc.appendChild(nm);
      var h = el("div", { "class": "handle", id: "it-handle" });
      [["ptr", "…"], ["len", "3"], ["cap", "3"]].forEach(function (f) { var d = el("div"); d.appendChild(el("small", null, f[0])); d.appendChild(el("b", null, f[1])); h.appendChild(d); });
      sc.appendChild(h);
      row.appendChild(sc);

      var it = el("div", { "class": "var" + (done ? " is-moved" : "") });
      var inm = el("span", { "class": "var__name" });
      inm.appendChild(el("span", { "class": "nm" }, "iterator"));
      inm.appendChild(el("span", { "class": "var__state borrowed" }, done ? "dropped" : m.it + " · " + m.size + " B"));
      it.appendChild(inm);
      var ih = el("div", { "class": "handle" });
      var f1 = el("div", { id: "it-cur" }); f1.appendChild(el("small", null, "next")); f1.appendChild(el("b", null, cur < 3 ? "[" + cur + "]" : "end"));
      var f2 = el("div", { id: "it-end" }); f2.appendChild(el("small", null, "end")); f2.appendChild(el("b", null, "[3]"));
      ih.appendChild(f1); ih.appendChild(f2);
      if (mode === "into_iter") { var f3 = el("div"); f3.appendChild(el("small", null, "owns")); f3.appendChild(el("b", null, "buffer")); ih.appendChild(f3); }
      it.appendChild(ih);
      row.appendChild(it);
      stage.appendChild(row);

      /* the item handed out this step */
      var itemRow = el("div", { "class": "iter-item" });
      itemRow.appendChild(el("span", { "class": "var__name" }, "s"));
      if (k >= 1 && k <= 3) {
        var i = k - 1;
        if (mode === "into_iter") {
          var cb = el("div", { "class": "cells" }); var c = el("div", { "class": "cell is-now" }, String(vals[i])); c.appendChild(el("small", null, "i32, owned")); cb.appendChild(c);
          itemRow.appendChild(cb);
        } else {
          itemRow.appendChild(el("span", { "class": "refbox" + (mode === "iter_mut" ? " refbox--mut" : ""), id: "it-item" }, m.item + " → [" + i + "]"));
        }
      } else {
        itemRow.appendChild(el("span", { "class": "note-sm" }, k === 0 ? "no item yet" : "None: the loop ends"));
      }
      stage.appendChild(itemRow);

      /* the buffer */
      var heap = el("div", { "class": "heap-zone" });
      heap.appendChild(el("div", { "class": "heap-zone__h" }, "Heap · scores's buffer" + (mode === "into_iter" ? ", now owned by the iterator" : "")));
      var buf = el("div", { "class": "buf" + (mode === "into_iter" && done ? " is-freed" : "") });
      var cells = el("div", { "class": "cells" });
      vals.forEach(function (v, i) {
        var taken = mode === "into_iter" && i < k;
        var c = el("div", { "class": "cell" + (k >= 1 && i === k - 1 ? " is-now" : "") + (taken ? " cell--spare" : ""), id: "it-c" + i }, taken ? "·" : String(v));
        c.appendChild(el("small", null, taken ? "moved out" : "[" + i + "]"));
        cells.appendChild(c);
      });
      var endc = el("div", { "class": "cell cell--spare", id: "it-c3" }, "");
      endc.appendChild(el("small", null, "end"));
      cells.appendChild(endc);
      buf.appendChild(cells);
      heap.appendChild(buf);
      stage.appendChild(heap);

      if (!wires) wires = new Wires(stage); else stage.appendChild(wires.svg);
      var specs = [];
      if (!done) {
        specs.push({ from: $("#it-cur", fig), to: $("#it-c" + cur, fig), cls: mode === "iter_mut" ? "mut" : "ref" });
        specs.push({ from: $("#it-end", fig), to: $("#it-c3", fig), cls: "dim" });
      }
      if ($("#it-item", fig)) specs.push({ from: $("#it-item", fig), to: $("#it-c" + (k - 1), fig), cls: mode === "iter_mut" ? "mut" : "ref", fromSide: "bottom", toSide: "top" });
      wires.set(specs);
    }

    stepper = new Stepper(fig, { onStep: function (k) { if (stepper) draw(k); } });
    choice($('[data-choice="mode"]', fig), function (v) { mode = v; draw(stepper.k); });
    draw(stepper.k);
  });

})();
