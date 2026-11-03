/*
 * What Makes It Balance? — the student page (spec v2).
 * Stage A: the screen and the Guess step. Predict, Slide, Solve and Answer come in Stage B.
 *
 * Guess step: the student types x; the slider thumb travels there (balance, boxes, totals update on the way),
 * turns green on arrival, an arrow at the "=" points to the heavier side, a marker goes on the number line
 * and a guess card is added. Equations 1-3 start with two given guesses. No questions per guess.
 *
 * Address options (for the teacher):  ?eq=4  open equation 4 (if unlocked) · ?all=1 unlock every equation ·
 * ?reset=1 clear this browser's saved progress first.
 */
(function () {
  "use strict";
  var BON = window.BON, E = BON.exact, M = BON.model, F = BON.flow, T = F.TEXT;
  var EQS = BON.EQUATIONS, CATS = BON.CATEGORIES;
  var KEY = "what-makes-it-balance-v2";
  var COL_ORDER = ["one", "always", "never"];
  var TRAVEL_MAX_MS = 1000;

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var unlockAll = params.get("all") === "1";

  /* ---------- saved state ---------- */

  function blank() { return { current: 0, coachSeen: false, eqs: {} }; }
  function load() {
    try {
      if (params.get("reset") === "1") localStorage.removeItem(KEY);
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.eqs) return s;
    } catch (e) { /* storage blocked or unreadable: start fresh */ }
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* keep working */ } }
  var state = load();
  if (params.get("reset") === "1") {
    params.delete("reset");
    try { history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "")); } catch (e) { /* ignore */ }
  }

  function rec(eq) {
    return state.eqs[eq.id] || (state.eqs[eq.id] = { guesses: [], note: false, prediction: null, sort: null });
  }

  /* ---------- where the student is ---------- */

  function step(eq, r) {
    if (eq.part === 3) return "part3";
    if (r.guesses.length < F.GUESSES) return "guess";
    return "predict"; // Stage B builds Predict, Slide, Solve and Answer
  }
  function isUnlocked(i) {
    if (unlockAll || i === 0) return true;
    var prev = state.eqs[EQS[i - 1].id];
    return !!(prev && prev.guesses.length >= F.GUESSES); // Stage A: five guesses open the next equation
  }
  function seedDue(eq, r) { return r.guesses.length < F.seedsFor(eq).length; }

  var startEq = parseInt(params.get("eq"), 10);
  if (startEq >= 1 && startEq <= EQS.length && isUnlocked(startEq - 1)) state.current = startEq - 1;
  if (!(state.current >= 0 && state.current < EQS.length) || !isUnlocked(state.current)) state.current = 0;

  /* ---------- current x (what the slider and balance show) ---------- */

  var view = BON.createBalance($("balance"));
  var slider = $("x-slider"), input = $("x-input");
  // cur.x: exact value shown; cur.pos: slider position (a number, for drawing only); cur.landed: arrow showing
  var cur = { x: null, style: "int", pos: 0, landed: false };
  var travel = null;

  function reducedMotion() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function posOf(x) { return x.n / x.d; }

  function showX(eq) {
    view.update({ eq: eq, x: cur.x, style: cur.style, tilt: "live" });
    slider.value = String(Math.round(cur.pos * 100) / 100);
    drawXBox(cur.x, cur.style);
    drawArrow(eq);
  }

  /* Move the thumb to x (animated, at most about 1 s), updating the balance on the way; then land. */
  function travelTo(eq, x, style, onLand) {
    if (travel) { cancelAnimationFrame(travel.id); travel = null; }
    var from = cur.pos, to = posOf(x);
    cur.landed = false;
    slider.classList.remove("is-arrived");
    var finish = function () {
      travel = null;
      cur.x = x; cur.style = style; cur.pos = to; cur.landed = true;
      showX(eq);
      slider.classList.add("is-arrived");
      if (onLand) onLand();
    };
    if (reducedMotion() || Math.abs(to - from) < 0.005) { finish(); return; }
    var ms = Math.min(TRAVEL_MAX_MS, 300 + 60 * Math.abs(to - from)), start = null;
    travel = { id: 0 };
    var stepFn = function (ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / ms);
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (t >= 1) { finish(); return; }
      cur.pos = from + (to - from) * e;
      cur.x = E.frac(Math.round(cur.pos * 100), 100);
      cur.style = "decimal";
      showX(eq);
      travel.id = requestAnimationFrame(stepFn);
    };
    travel.id = requestAnimationFrame(stepFn);
  }

  /* ---------- the arrow at "=" ---------- */

  function drawArrow(eq) {
    var a = document.getElementById("eq-arrow");
    if (!a) return;
    var sr = $("arrow-sr");
    if (!cur.landed || !cur.x) { a.hidden = true; a.removeAttribute("data-heavier"); sr.textContent = ""; return; }
    var c = M.compare(eq, cur.x);
    var glyph = c.heavier === "left" ? "◀" : c.heavier === "right" ? "▶" : "✓";
    var words = c.heavier === "left" ? "left heavier" : c.heavier === "right" ? "right heavier" : "balanced";
    a.hidden = false;
    a.setAttribute("data-heavier", c.heavier);
    a.innerHTML = "<span class=\"eq-arrow-glyph\" aria-hidden=\"true\">" + glyph + "</span><span class=\"eq-arrow-text\">" + words + "</span>";
    sr.textContent = "x = " + E.fmtValue(cur.x, cur.style) + ": " + words + ".";
  }

  /* ---------- the x-box beside the slider (resizes like the pan boxes) ---------- */

  function drawXBox(x, style) {
    var box = $("xbox");
    if (!x) { box.textContent = "x"; box.className = "xbox is-unknown"; box.style.width = box.style.height = ""; return; }
    var v = Math.abs(posOf(x)), side = Math.max(38, Math.min(52, 20 * Math.sqrt(v)));
    var s = E.fSign(x);
    box.className = "xbox" + (s === 0 ? " is-zero" : s < 0 ? " is-negative" : "");
    box.style.width = box.style.height = side.toFixed(1) + "px";
    box.textContent = E.fmtValue(x, style);
    box.style.fontSize = (box.textContent.length > 4 ? 0.8 : 1) + "rem";
  }

  /* ---------- the number line: ticks, labels, guess markers ---------- */

  function nlLeft(eq, v) {
    var lo = eq.sliderRange[0], hi = eq.sliderRange[1], f = (v - lo) / (hi - lo);
    return "calc(var(--thumb) / 2 + (100% - var(--thumb)) * " + f.toFixed(5) + ")";
  }
  function drawTicks(eq) {
    var ticks = $("nl-ticks"), lo = eq.sliderRange[0], hi = eq.sliderRange[1];
    ticks.textContent = "";
    for (var v = lo; v <= hi; v++) {
      var t = document.createElement("span");
      var major = v % 5 === 0;
      t.className = "nl-tick" + (major ? " is-major" : "") + (v === 0 ? " is-zero" : "");
      t.style.left = nlLeft(eq, v);
      ticks.appendChild(t);
      if (major) {
        var lab = document.createElement("span");
        lab.className = "nl-num";
        lab.style.left = nlLeft(eq, v);
        lab.textContent = E.fmtValue(E.frac(v));
        ticks.appendChild(lab);
      }
    }
  }
  /* Markers sit above the line; markers too close together stack into rows so none hides another. */
  var MARKER_GAP_PX = 26, MARKER_ROW_PX = 25;
  function drawMarkers(eq, r) {
    var box = $("nl-markers"), nl = $("nl");
    box.textContent = "";
    var lo = eq.sliderRange[0], hi = eq.sliderRange[1];
    var usable = Math.max(1, nl.clientWidth - 26);
    var rows = []; // last pixel x used in each row
    var items = r.guesses.map(function (g) { return { g: g, px: (posOf(g.x) - lo) / (hi - lo) * usable }; });
    items.slice().sort(function (a, b) { return a.px - b.px; }).forEach(function (it) {
      var k = 0;
      while (k < rows.length && it.px - rows[k] < MARKER_GAP_PX) k++;
      rows[k] = it.px; it.row = k;
    });
    items.forEach(function (it) {
      var g = it.g, c = M.compare(eq, g.x);
      var m = document.createElement("span");
      m.className = "nl-marker is-" + c.heavier;
      m.style.left = nlLeft(eq, posOf(g.x));
      m.style.top = ((rows.length - 1 - it.row) * MARKER_ROW_PX) + "px";
      m.setAttribute("data-heavier", c.heavier);
      m.innerHTML = "<span aria-hidden=\"true\">" + (c.heavier === "left" ? "\u25C0" : c.heavier === "right" ? "\u25B6" : "\u2713") +
        "</span><span class=\"sr-only\">x = " + E.fmtValue(g.x, g.style) + ", " +
        (c.heavier === "balanced" ? "balanced" : c.heavier + " heavier") + "</span>";
      box.appendChild(m);
    });
    nl.style.setProperty("--marker-rows", Math.max(1, rows.length));
  }

  /* ---------- guess cards ---------- */

  function drawCards(eq, r) {
    var box = $("cards");
    box.textContent = "";
    box.hidden = eq.part === 3;
    for (var i = 0; i < F.GUESSES; i++) {
      var g = r.guesses[i], card = document.createElement("div");
      if (!g) {
        card.className = "card-guess is-empty";
        card.innerHTML = "<span class=\"card-num\">" + (i + 1) + "</span>";
        box.appendChild(card);
        continue;
      }
      card.className = "card-guess";
      var c = M.compare(eq, g.x);
      var s = E.fSign(g.x);
      card.innerHTML =
        "<span class=\"card-num\">" + (i + 1) + (g.given ? "<span class=\"given\">given</span>" : "") + "</span>" +
        "<span class=\"card-x\"><span class=\"eqn-x\">x</span> = <span class=\"card-box" + (s === 0 ? " is-zero" : s < 0 ? " is-negative" : "") +
        "\">" + E.fmtValue(g.x, g.style) + "</span></span>" +
        "<span class=\"card-totals\"><span>" + E.fmtValue(c.left, g.style) + "</span><span class=\"card-bar\" aria-hidden=\"true\">|</span><span>" +
        E.fmtValue(c.right, g.style) + "</span></span>" +
        "<svg class=\"card-beam\" aria-hidden=\"true\"></svg>" +
        "<span class=\"sr-only\">" + (c.heavier === "balanced" ? "balanced" : c.heavier + " heavier") + "</span>";
      BON.miniBeam(card.querySelector(".card-beam"), eq, g.x);
      card.setAttribute("data-heavier", c.heavier);
      box.appendChild(card);
    }
  }

  /* ---------- the sort bar ---------- */

  function drawSortBar() {
    var counts = { one: 0, always: 0, never: 0 }, lists = { one: [], always: [], never: [] };
    EQS.forEach(function (eq) {
      var r = state.eqs[eq.id];
      if (r && r.sort) { counts[r.sort]++; lists[r.sort].push(eq); }
    });
    $("sortbar-toggle").innerHTML = "<span class=\"sortbar-label\">Sorted:</span> " + COL_ORDER.map(function (k) {
      return "<b title=\"" + CATS[k].title + "\">" + counts[k] + "<span class=\"sr-only\"> " + CATS[k].title + "</span></b>";
    }).join("<span aria-hidden=\"true\"> · </span>") + " <span class=\"sortbar-caret\" aria-hidden=\"true\">▾</span>";
    var panel = $("sortbar-panel");
    panel.textContent = "";
    COL_ORDER.forEach(function (k) {
      var col = document.createElement("div");
      col.className = "sort-col";
      col.innerHTML = "<h2>" + CATS[k].title + "</h2><p class=\"sort-sub\">" + CATS[k].sub + "</p>";
      var ul = document.createElement("ul");
      lists[k].forEach(function (eq) {
        var li = document.createElement("li");
        var num = document.createElement("span"); num.className = "sort-num"; num.textContent = eq.id;
        var eqEl = document.createElement("span");
        BON.renderEquation(eqEl, eq, { emphasis: eq.part === 2 });
        li.appendChild(num); li.appendChild(eqEl); ul.appendChild(li);
      });
      if (!lists[k].length) { var li = document.createElement("li"); li.className = "sort-none"; li.textContent = "None yet"; ul.appendChild(li); }
      col.appendChild(ul);
      panel.appendChild(col);
    });
  }
  function toggleSortPanel(open) {
    var panel = $("sortbar-panel");
    if (open === undefined) open = panel.hidden;
    panel.hidden = !open;
    $("sortbar-toggle").setAttribute("aria-expanded", open ? "true" : "false");
  }
  $("sortbar-toggle").addEventListener("click", function () { toggleSortPanel(); });
  document.addEventListener("click", function (e) {
    if (!$("sortbar-panel").hidden && !e.target.closest(".sortbar")) toggleSortPanel(false);
  });

  /* ---------- the instruction bar ---------- */

  function drawInstruction(eq, r) {
    var bar = $("instruction"), st = step(eq, r);
    bar.textContent = "";
    var p = document.createElement("p");
    p.className = "instruction-text";
    bar.appendChild(p);
    var focusTarget = null;
    if (st === "part3") {
      p.textContent = "Part 3 (the broken slider) comes in a later build.";
    } else if (st === "guess") {
      var n = r.guesses.length;
      if (n < F.seedsFor(eq).length) {
        p.textContent = n === 0 ? "Watch: the first guess is given." : "Given guess " + n + ": x = " +
          E.fmtValue(r.guesses[n - 1].x, r.guesses[n - 1].style) + ". Watch the beam and the arrow.";
        if (n > 0) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "btn btn-primary"; b.id = "next-guess";
          b.textContent = "Next: given guess " + (n + 1) + " ›";
          b.addEventListener("click", function () { addGuess(eq, r, F.seedsFor(eq)[n], "int", true); });
          bar.appendChild(b);
          focusTarget = b;
        }
      } else {
        p.textContent = "Guess " + (n + 1) + " of " + F.GUESSES + ": type a value for x.";
        focusTarget = input;
      }
      if (r.note) {
        var note = document.createElement("p");
        note.className = "instruction-note";
        note.textContent = T.secondValue;
        bar.appendChild(note);
      }
    } else {
      p.textContent = "Five guesses done. Predict comes next (in the next part of the build).";
      if (state.current < EQS.length - 1) {
        var nb = document.createElement("button");
        nb.type = "button"; nb.className = "btn"; nb.textContent = "Next equation ›";
        nb.addEventListener("click", function () { go(1); });
        bar.appendChild(nb);
        focusTarget = nb;
      }
    }
    return focusTarget;
  }

  /* ---------- guessing ---------- */

  function addGuess(eq, r, x, style, given) {
    if (travel) return;
    input.disabled = true; $("x-try").disabled = true;
    var nb = $("next-guess"); if (nb) nb.disabled = true;
    travelTo(eq, x, style, function () {
      r.guesses.push({ x: x, style: style, given: !!given });
      if (!r.note && M.compare(eq, x).heavier === "balanced" && r.guesses.length < F.GUESSES) r.note = true;
      if (!given) input.value = "";
      save();
      render({ focus: true, keepX: true });
      if (eq.id === 1 && !state.coachSeen && r.guesses.length === 1) startCoach();
    });
  }

  $("x-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var eq = EQS[state.current], r = rec(eq);
    if (step(eq, r) !== "guess" || seedDue(eq, r) || travel) return;
    var res = F.readGuess(eq, r.guesses, input.value);
    if (!res.ok) { $("x-msg").textContent = res.message; input.focus(); input.select(); return; }
    $("x-msg").textContent = "";
    addGuess(eq, r, res.value, res.style, false);
  });
  input.addEventListener("input", function () {
    var p = E.parseNumber(input.value);
    $("x-msg").textContent = !p.ok && p.partial && input.value.trim() !== "" ? T.notNumberYet : "";
  });

  /* ---------- navigation ---------- */

  function go(delta) {
    var i = state.current + delta;
    if (i < 0 || i >= EQS.length || travel) return;
    if (delta > 0 && !isUnlocked(i)) return;
    state.current = i;
    save();
    render({ focus: true });
  }
  $("back").addEventListener("click", function () { go(-1); });
  $("next").addEventListener("click", function () { go(1); });
  document.addEventListener("keydown", function (e) {
    if (!$("coach").hidden) { if (e.key === "Escape") endCoach(); return; }
    if (e.key === "Escape") { toggleSortPanel(false); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.key === "n" || e.key === "N") { if (!$("next").disabled) go(1); }
    if (e.key === "b" || e.key === "B") { if (!$("back").disabled) go(-1); }
  });
  $("start-over").addEventListener("click", function () {
    if (!window.confirm("Start over? This clears all your guesses and answers on this computer.")) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ }
    state = blank();
    render({ focus: true });
  });

  /* ---------- coach marks (equation 1, replayable with "?") ---------- */

  var COACH = [
    { target: function () { return $("eq-display"); }, text: "This is the equation: one side goes on each pan." },
    { target: function () { return $("xbox-wrap"); }, text: "This box is x: it shows the value x has right now." },
    { target: function () { return document.querySelector(".bon-pan[data-side=left] .bon-pieces") ? $("balance-box") : null; },
      text: "The pans hold the two sides: a box for each x, a ball for each number." },
    { target: function () { return document.querySelector(".bon-pan [data-shape=weight] circle"); },
      text: function (el) { return "A green " + el.parentNode.getAttribute("data-label") + " ball adds that much weight to its pan."; } },
    { target: function () { return $("nl"); }, text: "Type a guess for x and the slider travels to it on this number line." },
    { target: function () { return $("cards"); }, text: "Each guess leaves a card: the two sides and which way the beam tipped." }
  ];
  var coachAt = -1, coachReturn = null;

  function startCoach() {
    coachReturn = document.activeElement;
    coachAt = -1;
    $("coach").hidden = false;
    coachNext();
  }
  function endCoach() {
    $("coach").hidden = true;
    coachAt = -1;
    state.coachSeen = true; save();
    var eq = EQS[state.current];
    var f = drawInstruction(eq, rec(eq));
    (f && !f.disabled ? f : coachReturn && coachReturn.focus ? coachReturn : input).focus();
  }
  function coachNext() {
    coachAt++;
    while (coachAt < COACH.length && !COACH[coachAt].target()) coachAt++;
    if (coachAt >= COACH.length) { endCoach(); return; }
    var c = COACH[coachAt], target = c.target();
    var rect = target.getBoundingClientRect(), pad = 8;
    var ring = $("coach-ring");
    ring.style.left = (rect.left - pad) + "px"; ring.style.top = (rect.top - pad) + "px";
    ring.style.width = (rect.width + 2 * pad) + "px"; ring.style.height = (rect.height + 2 * pad) + "px";
    $("coach-text").textContent = typeof c.text === "function" ? c.text(target) : c.text;
    $("coach-count").textContent = (coachAt + 1) + " of " + COACH.length;
    var last = COACH.slice(coachAt + 1).every(function (k) { return !k.target(); });
    $("coach-next").textContent = last ? "Done" : "Next";
    var bubble = $("coach-bubble");
    bubble.style.left = "0px"; bubble.style.top = "0px";
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    var below = rect.bottom + pad + 12, above = rect.top - pad - 12 - bh;
    var top = below + bh <= innerHeight - 8 ? below : above >= 8 ? above : Math.max(8, innerHeight - bh - 8);
    var left = Math.min(innerWidth - bw - 12, Math.max(12, rect.left + rect.width / 2 - bw / 2));
    bubble.style.left = left + "px"; bubble.style.top = top + "px";
    $("coach-next").focus();
  }
  $("coach-next").addEventListener("click", coachNext);
  $("coach-skip").addEventListener("click", endCoach);
  $("help").addEventListener("click", function () { if (!travel) startCoach(); });

  /* ---------- draw everything ---------- */

  var drawnEq = null;

  function render(how) {
    how = how || {};
    var eq = EQS[state.current], r = rec(eq), st = step(eq, r);
    var newEq = drawnEq !== eq.id;
    drawnEq = eq.id;

    document.body.setAttribute("data-step", st === "part3" ? "guess" : st);
    document.body.setAttribute("data-part", eq.part);
    Array.prototype.forEach.call($("steps").children, function (li) {
      var on = li.getAttribute("data-step") === (st === "part3" ? "answer" : st);
      if (on) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });

    $("eq-number").textContent = eq.id;
    BON.renderEquation($("eq-display"), eq, { emphasis: eq.part === 2 });
    var eqSign = $("eq-display").querySelector(".eqn-eq");
    var arrow = document.createElement("span");
    arrow.className = "eq-arrow"; arrow.id = "eq-arrow"; arrow.hidden = true;
    eqSign.appendChild(arrow);

    $("progress").textContent = eq.id + " of " + EQS.length;
    $("progress").setAttribute("aria-label", "Equation " + eq.id + " of " + EQS.length);
    $("back").disabled = state.current === 0;
    $("next").disabled = state.current === EQS.length - 1 || !isUnlocked(state.current + 1);

    if (newEq) drawTicks(eq);
    drawMarkers(eq, r);
    drawCards(eq, r);
    drawSortBar();

    // the current x: the last guess, landed (unless a guess was just made, which already set it)
    if (newEq || !how.keepX) {
      var last = r.guesses[r.guesses.length - 1];
      cur = last ? { x: last.x, style: last.style, pos: posOf(last.x), landed: true } : { x: null, style: "int", pos: 0, landed: false };
      slider.classList.toggle("is-arrived", !!last);
    }
    showX(eq);

    var guessing = st === "guess" && !seedDue(eq, r);
    input.disabled = !guessing;
    $("x-try").disabled = !guessing;
    if (!guessing) $("x-msg").textContent = "";
    slider.disabled = true; // unlocks after five guesses and a prediction (Stage B)
    $("x-area").classList.toggle("is-part3", st === "part3");

    var focusTarget = drawInstruction(eq, r);
    if (how.focus && focusTarget && !focusTarget.disabled && $("coach").hidden) focusTarget.focus();

    // equations 1-3: the first given guess plays as soon as the equation opens
    if (st === "guess" && r.guesses.length === 0 && seedDue(eq, r) && !travel) {
      addGuess(eq, r, F.seedsFor(eq)[0], "int", true);
    }
  }

  window.addEventListener("resize", function () { var eq = EQS[state.current]; drawMarkers(eq, rec(eq)); });

  render();
})();
