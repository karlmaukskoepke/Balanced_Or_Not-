/*
 * What Makes It Balance? — the student page (spec v3). Stage 1: Build and Slide.
 *
 * Build (equations 1-4): the student builds each side with x / +1 / −1 (click a piece to remove it) and presses
 * "I built the equation". Equations 5-12 arrive pre-built ("Look at the model…", Continue). The beam stays level.
 * Slide: the slider unlocks; drag, nudge or type x. "I've seen enough" appears after three different positions.
 * Check, Solve and Compare come in Stage 2. Part 3 (#11-12): pre-built, the slider broken.
 *
 * Address options (for the teacher): ?eq=4 open equation 4 · ?all=1 unlock every equation.
 */
(function () {
  "use strict";
  var BON = window.BON, E = BON.exact, M = BON.model, F = BON.flow, T = F.TEXT;
  var EQS = BON.EQUATIONS;

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var unlockAll = params.get("all") === "1";

  // Stage 1 keeps progress in memory only (saving comes in Stage 2)
  var state = { current: 0, coachSeen: false, eqs: {} };
  function rec(eq) {
    return state.eqs[eq.id] || (state.eqs[eq.id] = {
      model: eq.built ? M.emptyModel() : M.modelFromEquation(eq), built: false, positions: [], slid: false });
  }
  function step(eq, r) {
    if (eq.part === 3) return "part3";
    if (!r.built) return "build";
    if (!r.slid) return "slide";
    return "check"; // Stage 2
  }
  function isUnlocked(i) {
    if (unlockAll || i === 0) return true;
    var prev = state.eqs[EQS[i - 1].id];
    return !!(prev && (prev.slid || EQS[i - 1].part === 3));
  }
  var startEq = parseInt(params.get("eq"), 10);
  if (startEq >= 1 && startEq <= EQS.length && isUnlocked(startEq - 1)) state.current = startEq - 1;

  var ex = BON.createExplorer({
    svg: $("balance"), sliderHost: $("vslider"), form: $("x-form"), input: $("x-input"), msg: $("x-msg"),
    xbox: $("xbox"), totL: $("tot-left"), totR: $("tot-right"), rel: $("rel"), relSr: $("rel-sr"),
    onMove: function (x) {
      var eq = EQS[state.current], r = rec(eq);
      if (step(eq, r) !== "slide") return;
      if (!r.positions.some(function (p) { return E.fEq(p, x); })) r.positions.push(x);
      if (r.positions.length === F.MIN_POSITIONS) drawPrompt(eq, r);
    }
  });

  /* ---------- building ---------- */

  function sideOf(r, s) { return r.model[s]; }
  function addX(side) { side.groups[side.groups.length - 1]++; }
  function removeX(side) {
    for (var i = side.groups.length - 1; i >= 0; i--) if (side.groups[i] > 0) { side.groups[i]--; return; }
  }
  var buildMsg = { text: "", side: null };
  function afterBuildChange(eq, r) {
    buildMsg = { text: "", side: null };
    document.querySelectorAll(".palette").forEach(function (p) { p.classList.remove("is-look"); });
    ex.show(eq, r.model, { build: true });
    var m = document.querySelector("#prompt .prompt-msg");
    if (m) m.textContent = "";
  }
  document.querySelectorAll(".palette").forEach(function (pal) {
    pal.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var eq = EQS[state.current], r = rec(eq);
      if (step(eq, r) !== "build" || !eq.built) return;
      var side = sideOf(r, pal.getAttribute("data-side")), act = b.getAttribute("data-act");
      if (act === "x" && M.xCount(side) < 9) addX(side);
      if (act === "plus" && side.c < 12) side.c++;
      if (act === "minus" && side.c > -12) side.c--;
      if (act === "clear") { side.groups = [0]; side.c = 0; }
      afterBuildChange(eq, r);
    });
  });
  // clicking a piece on a pan removes it (Build step only)
  $("balance").addEventListener("click", function (e) {
    var eq = EQS[state.current], r = rec(eq);
    if (step(eq, r) !== "build" || !eq.built) return;
    var piece = e.target.closest("[data-shape]"), group = e.target.closest("[data-side]");
    if (!piece || !group) return;
    var side = sideOf(r, group.getAttribute("data-side")), shape = piece.getAttribute("data-shape");
    if (/box|x-balloon/.test(shape)) removeX(side); else side.c = 0;
    afterBuildChange(eq, r);
  });

  /* ---------- the prompt panel ---------- */

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  function drawPrompt(eq, r) {
    var p = $("prompt"), st = step(eq, r), focus = null;
    p.textContent = "";
    if (st === "build" && eq.built) {
      p.appendChild(h("p", { "class": "prompt-q", text: "Build the equation on the balance." }));
      p.appendChild(h("p", { "class": "prompt-help", text: "x adds a box. +1 and −1 change the number on that side. Click a piece to take it off." }));
      var b = h("button", { type: "button", "class": "btn btn-primary", id: "built-btn", text: "I built the equation", onclick: function () {
        var res = F.checkBuild(eq, r.model);
        if (res.ok) { r.built = true; r.model = M.modelFromEquation(eq); enterStep(eq, r, true); return; }
        buildMsg = { text: res.message, side: res.wrong };
        document.querySelectorAll(".palette").forEach(function (pl) {
          pl.classList.toggle("is-look", res.wrong === "both" || pl.getAttribute("data-side") === res.wrong);
        });
        p.querySelector(".prompt-msg").textContent = res.message;
      } });
      p.appendChild(b);
      p.appendChild(h("p", { "class": "prompt-msg is-help", role: "status", text: buildMsg.text }));
      focus = document.querySelector('.palette[data-side="left"] .pbtn');
    } else if (st === "build") {
      p.appendChild(h("p", { "class": "prompt-q", text: T.lookModel }));
      focus = h("button", { type: "button", "class": "btn btn-primary", id: "continue-btn", text: "Continue", onclick: function () {
        r.built = true; enterStep(eq, r, true);
      } });
      p.appendChild(focus);
    } else if (st === "slide") {
      p.appendChild(h("p", { "class": "prompt-q", text: "Move the slider. Where does it balance?" }));
      p.appendChild(h("p", { "class": "prompt-help", text: "Drag it, use the arrow keys, or type a value for x." }));
      if (r.positions.length >= F.MIN_POSITIONS) {
        p.appendChild(h("button", { type: "button", "class": "btn btn-primary", id: "enough-btn", text: "I’ve seen enough", onclick: function () {
          r.slid = true; enterStep(eq, r, true);
        } }));
      }
      focus = ex.slider.thumb;
    } else if (st === "part3") {
      p.appendChild(h("p", { "class": "prompt-q", text: "The slider broke." }));
      p.appendChild(h("p", { "class": "prompt-help", text: "Part 3 (predict without the slider) comes in Stage 2 of the build." }));
      if (state.current < EQS.length - 1) focus = nextButton(p);
    } else {
      p.appendChild(h("p", { "class": "prompt-q", text: "Next comes the one-tap check (Stage 2 of the build)." }));
      if (state.current < EQS.length - 1) focus = nextButton(p);
    }
    return focus;
  }
  function nextButton(p) {
    var b = h("button", { type: "button", "class": "btn", id: "next-eq", text: "Next equation ›", onclick: function () { go(1); } });
    p.appendChild(b);
    return b;
  }

  /* ---------- drawing a step ---------- */

  function enterStep(eq, r, focus) {
    var st = step(eq, r);
    document.body.setAttribute("data-step", st === "part3" ? "slide" : st);
    document.body.setAttribute("data-part", eq.part);
    Array.prototype.forEach.call($("steps").children, function (li) {
      var on = li.getAttribute("data-step") === (st === "part3" ? "slide" : st);
      if (on) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $("eq-number").textContent = eq.id;
    BON.renderEquation($("eq-display"), eq, { emphasis: eq.part === 2 });
    $("progress").textContent = eq.id + " of " + EQS.length;
    $("progress").setAttribute("aria-label", "Equation " + eq.id + " of " + EQS.length);
    $("back").disabled = state.current === 0;
    $("next").disabled = state.current === EQS.length - 1 || !isUnlocked(state.current + 1);

    var building = st === "build";
    $("palettes").hidden = !(building && eq.built);
    ex.setLocked(building || st === "part3");
    ex.setFlicker(st === "part3");
    ex.show(eq, r.model, { build: building, x: building ? undefined : (r.positions.length ? undefined : E.frac(0)), style: "int" });
    var f = drawPrompt(eq, r);
    if (focus && f && $("coach").hidden) f.focus();
  }

  /* ---------- navigation ---------- */

  function go(d) {
    var i = state.current + d;
    if (i < 0 || i >= EQS.length) return;
    if (d > 0 && !isUnlocked(i)) return;
    state.current = i;
    buildMsg = { text: "", side: null };
    enterStep(EQS[i], rec(EQS[i]), true);
  }
  $("back").addEventListener("click", function () { go(-1); });
  $("next").addEventListener("click", function () { go(1); });
  document.addEventListener("keydown", function (e) {
    if (!$("coach").hidden) { if (e.key === "Escape") endCoach(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.getAttribute("role") === "slider")) return;
    if (e.key === "n" || e.key === "N") { if (!$("next").disabled) go(1); }
    if (e.key === "b" || e.key === "B") { if (!$("back").disabled) go(-1); }
  });
  $("start-over").addEventListener("click", function () {
    if (!window.confirm("Start over? This clears your work on this computer.")) return;
    state = { current: 0, coachSeen: true, eqs: {} };
    enterStep(EQS[0], rec(EQS[0]), true);
  });

  /* ---------- coach marks (equation 1, replayable with "?") ---------- */

  var COACH = [
    { target: function () { return $("eq-display"); }, text: "This is the equation: one side goes on each pan." },
    { target: function () { return $("palettes").hidden ? null : $("palettes"); }, text: "Click these buttons to build each side." },
    { target: function () { return $("balance-box"); }, text: "The pans hold the two sides of the equation." },
    { target: function () { return $("xbox"); }, text: "This is x: every box on the pans is the same size as this one." },
    { target: function () { return $("vslider"); }, text: "Slide x up and down: heavier at the top, lighter at the bottom." },
    { target: function () { return $("readout"); }, text: "Here are the two totals, with a sign that shows which side is heavier." }
  ];
  var coachAt = -1, coachBack = null;
  function startCoach() { coachBack = document.activeElement; coachAt = -1; $("coach").hidden = false; coachNext(); }
  function endCoach() {
    $("coach").hidden = true; state.coachSeen = true;
    var f = drawPrompt(EQS[state.current], rec(EQS[state.current]));
    if (f) f.focus(); else if (coachBack && coachBack.focus) coachBack.focus();
  }
  function coachNext() {
    coachAt++;
    while (coachAt < COACH.length && !COACH[coachAt].target()) coachAt++;
    if (coachAt >= COACH.length) { endCoach(); return; }
    var c = COACH[coachAt], rect = c.target().getBoundingClientRect(), pad = 8, ring = $("coach-ring");
    ring.style.left = (rect.left - pad) + "px"; ring.style.top = (rect.top - pad) + "px";
    ring.style.width = (rect.width + 2 * pad) + "px"; ring.style.height = (rect.height + 2 * pad) + "px";
    $("coach-text").textContent = c.text;
    $("coach-count").textContent = (coachAt + 1) + " of " + COACH.length;
    $("coach-next").textContent = COACH.slice(coachAt + 1).every(function (k) { return !k.target(); }) ? "Done" : "Next";
    var bub = $("coach-bubble");
    bub.style.left = "0px"; bub.style.top = "0px";
    var bw = bub.offsetWidth, bh = bub.offsetHeight;
    var below = rect.bottom + pad + 12, above = rect.top - pad - 12 - bh;
    var top = below + bh <= innerHeight - 8 ? below : above >= 8 ? above : Math.max(8, innerHeight - bh - 8);
    var left = rect.right + 16 + bw <= innerWidth - 8 && rect.height > innerHeight * 0.5 ? rect.right + 16 :
      Math.min(innerWidth - bw - 12, Math.max(12, rect.left + rect.width / 2 - bw / 2));
    if (rect.height > innerHeight * 0.5) top = Math.max(8, Math.min(innerHeight - bh - 8, rect.top + rect.height / 2 - bh / 2));
    bub.style.left = left + "px"; bub.style.top = top + "px";
    $("coach-next").focus();
  }
  $("coach-next").addEventListener("click", coachNext);
  $("coach-skip").addEventListener("click", endCoach);
  $("help").addEventListener("click", startCoach);

  enterStep(EQS[state.current], rec(EQS[state.current]), true);
  if (state.current === 0 && !state.coachSeen) startCoach();
})();
