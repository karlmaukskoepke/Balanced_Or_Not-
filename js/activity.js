/*
 * The student activity, Parts 1 and 2 (equations 1-10).
 * Per equation: guesses (seeded on 1-3) -> prediction -> slider -> sort -> solve on paper and enter the result.
 *
 * Address options (for the teacher):
 *   ?eq=4     open equation 4 (if it is unlocked)
 *   ?all=1    unlock every equation (teacher walkthrough)
 *   ?reset=1  clear this browser's saved progress first
 */
(function () {
  "use strict";
  var BON = window.BON, E = BON.exact, M = BON.model, F = BON.flow, T = F.TEXT;
  var EQS = BON.EQUATIONS, CATS = BON.CATEGORIES;
  var KEY = "balanced-or-not-v1";
  var COL_ORDER = ["one", "always", "never"]; // the reflection page's order

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var unlockAll = params.get("all") === "1";

  /* ---------- saved state ---------- */

  function blank() { return { current: 0, eqs: {} }; }
  function load() {
    try {
      if (params.get("reset") === "1") localStorage.removeItem(KEY);
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.eqs) return s;
    } catch (e) { /* storage blocked or unreadable: start fresh */ }
    return blank();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* keep working without saving */ }
  }
  var state = load();
  if (params.get("reset") === "1") { // don't clear again on a refresh
    params.delete("reset");
    try { history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "")); } catch (e) { /* ignore */ }
  }

  function rec(eq) {
    var r = state.eqs[eq.id];
    if (!r) {
      r = state.eqs[eq.id] = { guesses: [], note: false, prediction: null, sliderUsed: false, sliderX: null,
        sliderStyle: "decimal", sort: null, sortTries: 0, spotlight: false, solve: null, done: false };
    }
    return r;
  }

  /* ---------- where the student is ---------- */

  function answeredCount(r) { return r.guesses.filter(function (g) { return g.answered; }).length; }
  function pending(r) { return r.guesses.filter(function (g) { return !g.answered; })[0] || null; }
  function lastAnswered(r) {
    var a = r.guesses.filter(function (g) { return g.answered; });
    return a[a.length - 1] || null;
  }
  function phase(eq, r) {
    if (eq.part === 3) return "part3";
    if (answeredCount(r) < F.GUESSES) return "guess";
    if (!r.prediction) return "predict";
    if (!r.sort) return "slider";
    if (!r.done) return "solve";
    return "done";
  }
  function isUnlocked(i) {
    if (unlockAll || i === 0) return true;
    var prev = state.eqs[EQS[i - 1].id];
    return !!(prev && prev.done);
  }
  /* Equations 1-3: is a page-supplied guess still to come? (The first one appears on arrival;
     the next one after the student has seen the beam tip and asks for it.) */
  function seedDue(eq, r) {
    return !pending(r) && r.guesses.length < F.seedsFor(eq).length && r.guesses.length < F.GUESSES;
  }
  function addSeed(eq, r) {
    if (seedDue(eq, r)) r.guesses.push({ x: F.seedsFor(eq)[r.guesses.length], style: "int", given: true, answered: false, tries: 0 });
  }

  var startEq = parseInt(params.get("eq"), 10);
  if (startEq >= 1 && startEq <= EQS.length && isUnlocked(startEq - 1)) state.current = startEq - 1;
  if (!(state.current >= 0 && state.current < EQS.length) || !isUnlocked(state.current)) state.current = 0;

  /* ---------- the balance ---------- */

  var view = BON.createBalance($("balance"));
  var feedbackHighlight = null; // set after a wrong answer, cleared on the next action

  function sliderStart(eq, r) {
    if (r.sliderX) return;
    var g = lastAnswered(r), x = E.frac(0), style = "decimal";
    if (g && E.isHundredths(g.x) && E.fCmp(g.x, E.frac(eq.sliderRange[0])) >= 0 &&
        E.fCmp(g.x, E.frac(eq.sliderRange[1])) <= 0) { x = g.x; style = g.style === "fraction" ? "decimal" : g.style; }
    r.sliderX = x; r.sliderStyle = style;
  }

  function balanceView(eq, r) {
    var ph = phase(eq, r);
    if (ph === "guess" || ph === "predict") {
      var p = pending(r);
      if (p) return { x: p.x, style: p.style, tilt: "level" };
      var g = lastAnswered(r);
      return g ? { x: g.x, style: g.style, tilt: "live" } : { x: null, tilt: "level" };
    }
    if (ph === "part3") return { x: null, tilt: "level" };
    sliderStart(eq, r);
    return { x: r.sliderX, style: r.sliderStyle, tilt: "live" };
  }

  function drawBalance() {
    var eq = EQS[state.current], r = rec(eq), v = balanceView(eq, r);
    view.update({ eq: eq, x: v.x, style: v.style, tilt: v.tilt, highlight: feedbackHighlight });
  }

  /* ---------- the guess log ---------- */

  function heavierWord(h) { return h === "left" ? "Left" : h === "right" ? "Right" : "Balanced"; }

  function drawLog(eq, r) {
    var withDiff = eq.part === 1;
    var head = "<tr><th scope=\"col\">#</th><th scope=\"col\"><span class=\"eqn-x\">x</span></th>" +
      "<th scope=\"col\">Left</th><th scope=\"col\">Right</th><th scope=\"col\">Heavier</th>" +
      (withDiff ? "<th scope=\"col\">Difference</th>" : "") + "</tr>";
    $("log-head").innerHTML = head;
    var body = $("log-body");
    body.textContent = "";
    if (eq.part === 3) { $("log").parentNode.hidden = true; return; }
    $("log").parentNode.hidden = false;
    for (var i = 0; i < F.GUESSES; i++) {
      var g = r.guesses[i], tr = document.createElement("tr");
      var cells;
      if (!g) {
        cells = [String(i + 1), "", "", "", ""];
        if (withDiff) cells.push("");
        tr.className = "log-empty";
      } else {
        var c = M.compare(eq, g.x);
        cells = [String(i + 1) + (g.given ? " given" : ""), E.fmtValue(g.x, g.style),
          E.fmtValue(c.left, g.style), E.fmtValue(c.right, g.style), g.answered ? heavierWord(c.heavier) : "?"];
        if (withDiff) cells.push(g.answered ? E.fmtValue(c.diff, g.style) : "?");
        if (!g.answered) tr.className = "log-pending";
      }
      cells.forEach(function (text, k) {
        var td = document.createElement(k === 0 ? "th" : "td");
        if (k === 0) {
          td.scope = "row";
          var parts = text.split(" ");
          td.textContent = parts[0];
          if (parts[1]) { var s = document.createElement("span"); s.className = "given"; s.textContent = "given"; td.appendChild(s); }
        } else td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    }
  }

  /* ---------- the sort bar ---------- */

  function drawSortBar() {
    var counts = { one: 0, always: 0, never: 0 }, lists = { one: [], always: [], never: [] };
    EQS.forEach(function (eq) {
      var r = state.eqs[eq.id];
      if (r && r.sort) { counts[r.sort]++; lists[r.sort].push(eq); }
    });
    $("sortbar-toggle").innerHTML = "<span class=\"sortbar-label\">Sorted</span> " + COL_ORDER.map(function (k) {
      return "<span class=\"sortbar-count\">" + CATS[k].title + " <b>" + counts[k] + "</b></span>";
    }).join("") + "<span class=\"sortbar-caret\" aria-hidden=\"true\">▾</span>";
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
    var btn = $("sortbar-toggle"), panel = $("sortbar-panel");
    if (open === undefined) open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  $("sortbar-toggle").addEventListener("click", function () { toggleSortPanel(); });
  document.addEventListener("click", function (e) {
    if (!$("sortbar-panel").hidden && !e.target.closest(".sortbar")) toggleSortPanel(false);
  });

  /* ---------- small DOM helpers for the prompt ---------- */

  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function choiceButtons(options, onPick, selected) {
    return h("div", { "class": "choices" }, options.map(function (o) {
      return h("button", { type: "button", "class": "btn choice", "data-choice": o.value,
        "aria-pressed": selected === o.value ? "true" : "false", onclick: function () { onPick(o.value); } },
        o.sub ? [h("span", { "class": "choice-title", text: o.label }), h("span", { "class": "choice-sub", text: o.sub })] : [o.label]);
    }));
  }
  var CAT_OPTIONS = COL_ORDER.map(function (k) { return { value: k, label: CATS[k].title, sub: CATS[k].sub }; });
  var SIDE_OPTIONS = [{ value: "left", label: "Left" }, { value: "right", label: "Right" }, { value: "balanced", label: "Balanced" }];

  /* ---------- the prompt (right column, bottom) ---------- */

  var ui = { heavierPick: null, message: "", messageKind: "" };

  function setMessage(text, kind) {
    ui.message = text; ui.messageKind = kind || "";
    var m = document.querySelector("#prompt .prompt-msg");
    if (m) { m.textContent = text; m.className = "prompt-msg" + (kind ? " is-" + kind : ""); }
  }
  function msgEl() {
    return h("p", { "class": "prompt-msg" + (ui.messageKind ? " is-" + ui.messageKind : ""), role: "status", text: ui.message });
  }

  function drawPrompt(eq, r) {
    var p = $("prompt"), ph = phase(eq, r);
    p.textContent = "";
    p.setAttribute("data-phase", ph);
    var focusTarget = null;

    if (ph === "part3") {
      p.appendChild(h("p", { "class": "prompt-q", text: "Part 3 comes in the next stage of the build." }));
      return null;
    }

    if (ph === "guess") {
      var g = pending(r), n = answeredCount(r);
      if (r.note) p.appendChild(h("p", { "class": "prompt-note", text: T.secondValue }));
      if (!g && seedDue(eq, r)) {
        p.appendChild(msgEl());
        var nb = h("button", { type: "button", "class": "btn btn-primary", id: "next-guess",
          text: "Next: guess " + (n + 1) + " (given) \u203A", onclick: function () {
            addSeed(eq, r); ui.message = ""; save(); render({ focus: true });
          } });
        p.appendChild(nb);
        return nb;
      }
      if (!g) {
        p.appendChild(h("p", { "class": "prompt-q" }, ["Guess " + (n + 1) + " of " + F.GUESSES + ": type a value for ",
          h("span", { "class": "eqn-x", text: "x" }), "."]));
        p.appendChild(msgEl());
        return $("x-input");
      }
      p.appendChild(h("p", { "class": "prompt-step", text: "Guess " + (n + 1) + (g.given ? " (given)" : "") +
        ": x = " + E.fmtValue(g.x, g.style) }));
      var askDiff = eq.part === 1;
      p.appendChild(h("p", { "class": "prompt-q", text: "Which side is heavier?" }));
      var sides = choiceButtons(SIDE_OPTIONS, function (v) {
        ui.heavierPick = v;
        sides.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.choice === v ? "true" : "false"); });
        if (!askDiff) submitGuessAnswer(eq, r, g, { heavier: v }, false);
        else { var d = $("diff-input"); if (d) d.focus(); }
      }, ui.heavierPick);
      p.appendChild(sides);
      focusTarget = sides.querySelector("button");
      if (askDiff) {
        var diffForm = h("form", { "class": "diff-form", onsubmit: function (e) {
          e.preventDefault();
          if (!ui.heavierPick) { setMessage("First choose Left, Right or Balanced.", "help"); return; }
          submitGuessAnswer(eq, r, g, { heavier: ui.heavierPick, diff: $("diff-input").value }, true);
        } }, [
          h("label", { "for": "diff-input", "class": "diff-label", text: "Difference (larger − smaller)" }),
          h("input", { id: "diff-input", "class": "small-input", type: "text", inputmode: "text", autocomplete: "off", spellcheck: "false" }),
          h("button", { type: "submit", "class": "btn btn-primary", text: "Check" })
        ]);
        p.appendChild(diffForm);
      }
      p.appendChild(msgEl());
      return focusTarget;
    }

    if (ph === "predict") {
      p.appendChild(h("p", { "class": "prompt-q", text: "Predict: which column will this equation go in?" }));
      var pc = choiceButtons(CAT_OPTIONS, function (v) {
        r.prediction = v; save(); ui.message = ""; render({ focus: true });
      }, null);
      p.appendChild(pc);
      return pc.querySelector("button");
    }

    if (ph === "slider" || ph === "solve" || ph === "done") {
      p.appendChild(h("p", { "class": "prompt-live", id: "live-line" }));
    }

    if (ph === "slider") {
      p.appendChild(h("p", { "class": "prompt-step", text: "You predicted: " + CATS[r.prediction].title }));
      if (!r.sliderUsed) {
        p.appendChild(h("p", { "class": "prompt-q", text: "The slider is unlocked. Use it to test your prediction." }));
        return $("x-slider");
      }
      p.appendChild(h("p", { "class": "prompt-q", text: "Sort this equation:" }));
      var sc = choiceButtons(CAT_OPTIONS, function (v) {
        if (F.checkSort(eq, v)) {
          r.sort = v; r.spotlight = false; save(); ui.message = ""; render({ focus: true });
        } else {
          r.sortTries++; r.spotlight = true; save(); render({ focus: true });
        }
      }, null);
      if (r.spotlight) sc.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      p.appendChild(sc);
      return r.spotlight ? $("x-slider") : sc.querySelector("button");
    }

    if (ph === "solve") {
      p.appendChild(h("p", { "class": "prompt-step", text: "Sorted: " + CATS[r.sort].title }));
      p.appendChild(h("p", { "class": "prompt-q", text: "Solve it on paper. Your result:" }));
      var form = h("form", { "class": "solve-form", onsubmit: function (e) {
        e.preventDefault();
        var res = F.checkSolve(eq, $("solve-left").value, $("solve-right").value);
        if (res.status === "agree" || res.status === "disagree") {
          r.solve = { left: $("solve-left").value, right: $("solve-right").value, status: res.status, entered: res.entered };
          r.done = true; save();
          ui.message = res.message; ui.messageKind = res.status === "agree" ? "ok" : "help";
          render({ focus: true });
        } else setMessage(res.message, "help");
      } }, [
        h("input", { id: "solve-left", "class": "small-input", type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "Left side of your result" }),
        h("span", { "class": "solve-eq", "aria-hidden": "true", text: "=" }),
        h("input", { id: "solve-right", "class": "small-input", type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "Right side of your result" }),
        h("button", { type: "submit", "class": "btn btn-primary", text: "Check" })
      ]);
      p.appendChild(form);
      p.appendChild(msgEl());
      return $("solve-left");
    }

    // done
    p.appendChild(h("p", { "class": "prompt-step", text: "Sorted: " + CATS[r.sort].title + ". Your result: " + r.solve.entered }));
    p.appendChild(msgEl());
    var last = state.current === EQS.length - 1;
    var nextBtn = h("button", { type: "button", "class": "btn btn-primary", id: "prompt-next",
      text: last ? "Finished" : "Next equation ›", onclick: function () { go(1); } });
    if (last) nextBtn.disabled = true;
    p.appendChild(nextBtn);
    return nextBtn;
  }

  function submitGuessAnswer(eq, r, g, answer, askDiff) {
    var res = F.checkGuess(eq, g.x, g.style, answer, askDiff);
    if (!res.ok) {
      g.tries++; save();
      feedbackHighlight = res.highlight;
      setMessage(res.message, "help");
      drawBalance();
      if (res.field === "diff") { var d = $("diff-input"); if (d) { d.focus(); d.select(); } }
      return;
    }
    g.answered = true;
    feedbackHighlight = null;
    ui.heavierPick = null;
    var balancedNow = res.cmp.heavier === "balanced";
    var firstBalance = balancedNow && !r.note && answeredCount(r) < F.GUESSES;
    if (firstBalance) r.note = true;
    ui.message = M.resultText(res.cmp, g.style) + ".";
    ui.messageKind = "ok";
    save();
    render({ focus: true });
  }

  /* ---------- x entry and slider ---------- */

  var input = $("x-input"), slider = $("x-slider");

  function drawEntry(eq, r) {
    var ph = phase(eq, r), p = pending(r);
    var guessing = ph === "guess" && !p, sliding = ph === "slider" || ph === "solve" || ph === "done";
    input.disabled = !(guessing || sliding);
    $("x-try").hidden = sliding;
    $("x-try").disabled = !guessing;
    if (ph === "guess" && p) input.value = E.fmtValue(p.x, p.style);
    else if (guessing && document.activeElement !== input) input.value = "";
    else if (sliding && document.activeElement !== input) input.value = E.fmtValue(r.sliderX, r.sliderStyle);
    else if (ph === "predict" || ph === "part3") input.value = "";
    if (!guessing && !sliding) $("x-msg").textContent = "";

    var locked = !sliding;
    slider.disabled = locked;
    slider.min = eq.sliderRange[0]; slider.max = eq.sliderRange[1];
    $("slider-min").textContent = E.fmtValue(E.frac(eq.sliderRange[0]));
    $("slider-max").textContent = E.fmtValue(E.frac(eq.sliderRange[1]));
    $("slider-lock").hidden = !locked;
    $("slider-row").classList.toggle("is-locked", locked);
    $("slider-row").hidden = eq.part === 3;
    if (sliding) slider.value = E.fmtValueAscii(roundToHundredths(r.sliderX));
    else slider.value = "0";
  }
  function roundToHundredths(f) {
    return E.isHundredths(f) ? f : E.frac(Math.round(f.n * 100 / f.d), 100); // only positions the thumb
  }

  function drawLiveLine(eq, r) {
    var el = $("live-line");
    if (!el || !r.sliderX) return;
    var c = M.compare(eq, r.sliderX);
    el.textContent = "x = " + E.fmtValue(r.sliderX, r.sliderStyle) + ": " + M.resultText(c, r.sliderStyle);
  }

  /* Slider moved or a value typed while the slider is unlocked: update live, never logged. */
  function useSlider(x, style, fromSlider) {
    var eq = EQS[state.current], r = rec(eq);
    r.sliderX = x; r.sliderStyle = style;
    var wasSpot = r.spotlight, wasUnused = !r.sliderUsed;
    r.sliderUsed = true;
    if (wasSpot) r.spotlight = false;
    if (!fromSlider) slider.value = E.fmtValueAscii(roundToHundredths(x));
    if (fromSlider && document.activeElement !== input) input.value = E.fmtValue(x, style);
    save();
    if (wasSpot || wasUnused) render({ keepFocus: true });
    else { drawBalance(); drawLiveLine(eq, r); }
  }

  slider.addEventListener("input", function () {
    var p = E.parseNumber(slider.value);
    if (!p.ok) return;
    useSlider(p.value, "decimal", true);
  });
  slider.addEventListener("keydown", function (e) {
    var step = e.key === "PageUp" ? 1 : e.key === "PageDown" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    var eq = EQS[state.current], r = rec(eq);
    var x = E.fAdd(roundToHundredths(r.sliderX || E.frac(0)), E.frac(step));
    if (E.fCmp(x, E.frac(eq.sliderRange[0])) < 0) x = E.frac(eq.sliderRange[0]);
    if (E.fCmp(x, E.frac(eq.sliderRange[1])) > 0) x = E.frac(eq.sliderRange[1]);
    useSlider(x, "decimal", true);
  });

  function readTyped() {
    var p = E.parseNumber(input.value);
    var msg = $("x-msg");
    if (p.ok) { msg.textContent = ""; return p; }
    msg.textContent = p.partial ? (input.value.trim() === "" ? "" : T.notNumberYet) : p.zeroDen ? T.zeroDen : T.notNumber;
    return null;
  }
  input.addEventListener("input", function () {
    var eq = EQS[state.current], r = rec(eq), ph = phase(eq, r);
    var p = readTyped();
    if (p && (ph === "slider" || ph === "solve" || ph === "done")) {
      if (Math.abs(p.value.n / p.value.d) > 999) { $("x-msg").textContent = "Try a number between −999 and 999."; return; }
      useSlider(p.value, p.style, false);
    }
  });
  $("x-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var eq = EQS[state.current], r = rec(eq);
    if (phase(eq, r) !== "guess" || pending(r)) return;
    var p = readTyped();
    if (!p) { if (input.value.trim() === "") $("x-msg").textContent = T.notNumber; input.focus(); return; }
    if (Math.abs(p.value.n / p.value.d) > 999) { $("x-msg").textContent = "Try a number between −999 and 999."; return; }
    if (F.isDuplicate(r.guesses, p.value)) { $("x-msg").textContent = T.duplicate(E.fmtValue(p.value, p.style)); input.select(); return; }
    r.guesses.push({ x: p.value, style: p.style, given: false, answered: false, tries: 0 });
    ui.message = ""; ui.heavierPick = null; feedbackHighlight = null;
    save();
    render({ focus: true });
  });

  /* ---------- navigation ---------- */

  function go(delta) {
    var i = state.current + delta;
    if (i < 0 || i >= EQS.length) return;
    if (delta > 0 && !isUnlocked(i)) return;
    state.current = i;
    ui = { heavierPick: null, message: "", messageKind: "" };
    feedbackHighlight = null;
    save();
    render({ focus: true });
  }
  $("back").addEventListener("click", function () { go(-1); });
  $("next").addEventListener("click", function () { go(1); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { toggleSortPanel(false); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.key === "n" || e.key === "N") { if (!$("next").disabled) go(1); }
    if (e.key === "b" || e.key === "B") { if (!$("back").disabled) go(-1); }
  });
  $("start-over").addEventListener("click", function () {
    if (!window.confirm("Start over? This clears all your guesses, sorts and results on this computer.")) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ }
    state = blank(); ui = { heavierPick: null, message: "", messageKind: "" }; feedbackHighlight = null;
    render({ focus: true });
  });

  /* ---------- draw everything ---------- */

  function render(how) {
    how = how || {};
    var eq = EQS[state.current], r = rec(eq);
    if (r.guesses.length === 0) addSeed(eq, r);
    var ph = phase(eq, r);
    if (ph === "slider" || ph === "solve" || ph === "done") sliderStart(eq, r);

    $("eq-number").textContent = eq.id;
    BON.renderEquation($("eq-display"), eq, { emphasis: eq.part === 2 });
    $("progress").textContent = "Equation " + eq.id + " of " + EQS.length;
    $("back").disabled = state.current === 0;
    $("next").disabled = state.current === EQS.length - 1 || !isUnlocked(state.current + 1);
    document.body.setAttribute("data-part", eq.part);

    drawEntry(eq, r);
    drawLog(eq, r);
    drawSortBar();
    var focusTarget = drawPrompt(eq, r);
    drawLiveLine(eq, r);
    drawBalance();

    var spot = ph === "slider" && r.spotlight;
    $("veil").hidden = !spot;
    document.body.classList.toggle("is-spotlight", spot);
    $("spot-msg").textContent = spot ? T.checkSlider : "";

    if (how.focus && focusTarget && !how.keepFocus && !focusTarget.disabled) focusTarget.focus();
  }

  render();
})();
