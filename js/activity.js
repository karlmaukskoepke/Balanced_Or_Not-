/*
 * What Makes It Balance? — the student page (spec v3).
 *
 * Per equation (Parts 1-2): Build (or look at the model) → Slide → one-tap Check → Solve (stop screen) →
 * Compare (worked steps, reflection-page column) → Next. Reflection breaks after #7, #9, #10 and #12.
 * Part 3 (#11-12): look at the model → predict a category and a reason (slider broken) → Solve → Compare.
 * After #12: the completion screen.
 *
 * Navigation: the page walks through in order; every numbered equation in the top strip is clickable and
 * keeps its own progress. Progress is saved in this browser; the load screen asks "Where is your group starting?".
 *
 * Address options (for the teacher): ?eq=4 open equation 4 · ?reset=1 clear saved progress first.
 */
(function () {
  "use strict";
  var BON = window.BON, E = BON.exact, M = BON.model, F = BON.flow, T = F.TEXT;
  var EQS = BON.EQUATIONS, CATS = BON.CATEGORIES;
  var KEY = "what-makes-it-balance-v3";
  var REFLECT_AFTER = [7, 9, 10, 12];

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  /* ---------- saved progress ---------- */

  function blank() { return { current: 0, coachSeen: false, eqs: {}, reflections: {}, finished: false }; }
  function load() {
    try {
      if (params.get("reset") === "1") localStorage.removeItem(KEY);
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.eqs && s.reflections) return s;
    } catch (e) { /* storage blocked or unreadable: start fresh */ }
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* keep working without saving */ } }
  var saved = load();
  var state = saved || blank();
  if (params.get("reset") === "1") {
    params.delete("reset");
    try { history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "")); } catch (e) { /* ignore */ }
  }

  function rec(eq) {
    return state.eqs[eq.id] || (state.eqs[eq.id] = {
      model: eq.built ? M.emptyModel() : M.modelFromEquation(eq), built: false, positions: [], slid: false,
      check: { done: false, wrongs: 0 }, spotlight: false,
      p3: { done: false, wrongs: 0, cat: null, reason: null }, solved: false
    });
  }
  function step(eq, r) {
    if (!r.built) return "build";
    if (eq.part === 3) {
      if (!r.p3.done) return "predict";
    } else {
      if (!r.slid) return "slide";
      if (!r.check.done) return "check";
    }
    if (!r.solved) return "solve";
    return "compare";
  }
  function isDone(eq) { var r = state.eqs[eq.id]; return !!(r && r.solved); }
  function firstOpen() {
    for (var i = 0; i < EQS.length; i++) if (!isDone(EQS[i])) return i;
    return EQS.length - 1;
  }
  function stripStep(st) { return st === "predict" ? "check" : st; }

  var startEq = parseInt(params.get("eq"), 10);
  if (startEq >= 1 && startEq <= EQS.length) state.current = startEq - 1;

  /* ---------- the explorer (slider, typed box, balance, readout) ---------- */

  var ex = BON.createExplorer({
    svg: $("balance"), sliderHost: $("vslider"), form: $("x-form"), input: $("x-input"), msg: $("x-msg"),
    xbox: $("xbox"), totL: $("tot-left"), totR: $("tot-right"), rel: $("rel"), relSr: $("rel-sr"),
    onMove: function (x) {
      var eq = EQS[state.current], r = rec(eq), st = step(eq, r);
      if (st === "slide") {
        if (!r.positions.some(function (p) { return E.fEq(p, x); })) r.positions.push(x);
        if (r.positions.length === F.MIN_POSITIONS) { save(); drawPrompt(eq, r); }
      }
      if (st === "check" && r.spotlight) {       // using the slider relights the screen and reopens the question
        r.spotlight = false; save();
        enterStep(eq, r, false);
      }
    }
  });

  /* ---------- building ---------- */

  function addX(side) { side.groups[side.groups.length - 1]++; }
  function removeX(side) { for (var i = side.groups.length - 1; i >= 0; i--) if (side.groups[i] > 0) { side.groups[i]--; return; } }
  var buildMsg = "";
  function afterBuildChange(eq, r) {
    buildMsg = "";
    document.querySelectorAll(".palette").forEach(function (p) { p.classList.remove("is-look"); });
    ex.show(eq, r.model, { build: true });
    var m = document.querySelector("#prompt .prompt-msg");
    if (m) m.textContent = "";
    save();
  }
  document.querySelectorAll(".palette").forEach(function (pal) {
    pal.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var eq = EQS[state.current], r = rec(eq);
      if (step(eq, r) !== "build" || !eq.built) return;
      var side = r.model[pal.getAttribute("data-side")], act = b.getAttribute("data-act");
      if (act === "x" && M.xCount(side) < 9) addX(side);
      if (act === "plus" && side.c < 12) side.c++;
      if (act === "minus" && side.c > -12) side.c--;
      if (act === "clear") { side.groups = [0]; side.c = 0; }
      afterBuildChange(eq, r);
    });
  });
  $("balance").addEventListener("click", function (e) {
    var eq = EQS[state.current], r = rec(eq);
    if (step(eq, r) !== "build" || !eq.built) return;
    var piece = e.target.closest("[data-shape]"), group = e.target.closest("[data-side]");
    if (!piece || !group) return;
    var side = r.model[group.getAttribute("data-side")];
    if (/box|x-balloon/.test(piece.getAttribute("data-shape"))) removeX(side); else side.c = 0;
    afterBuildChange(eq, r);
  });

  /* ---------- small DOM helpers ---------- */

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  /* "3x − 2" with the x-terms in blue (for the worked steps). */
  function eqHTML(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/(\d*x)/g, '<span class="eqn-x">$1</span>');
  }
  function eqLine(eq) {
    var span = h("span", { "class": "eqline" });
    BON.renderEquation(span, eq, { emphasis: eq.part === 2 });
    return span;
  }

  /* The worked steps, in the sheet's notation: the added term under each side. */
  function stepsBlock(eq) {
    var st = eq.steps, box = h("div", { "class": "work", "aria-label": "Worked steps" });
    function row(l, r, cls) {
      box.appendChild(h("span", { "class": "w-l " + (cls || ""), html: eqHTML(l) }));
      box.appendChild(h("span", { "class": "w-eq " + (cls || ""), text: cls === "w-op" ? "" : "=" }));
      box.appendChild(h("span", { "class": "w-r " + (cls || ""), html: eqHTML(r) }));
    }
    function label(t) { box.appendChild(h("span", { "class": "w-label", html: t })); }
    row(st.start[0], st.start[1]);
    st.lines.forEach(function (ln) {
      if (ln.how === "add") {
        label("Add the same to both sides:");
        var t = "+ (" + ln.term + ")";
        row(t, t, "w-op");
      } else if (ln.how === "divide") {
        label("Divide both sides by " + ln.by + ":");
        row("÷ " + ln.by, "÷ " + ln.by, "w-op");
      } else {
        label("Combine like terms: " + eqHTML(ln.note));
      }
      row(ln.eq[0], ln.eq[1], "w-res");
    });
    var wrap = h("div", { "class": "work-wrap" }, [box]);
    if (st.end) wrap.appendChild(h("p", { "class": "w-text", text: st.end }));
    wrap.appendChild(h("p", { "class": "w-text w-check", text: st.check }));
    if (st.extra) wrap.appendChild(h("p", { "class": "w-text", text: st.extra }));
    return wrap;
  }

  /* ---------- the prompt panel ---------- */

  function drawPrompt(eq, r) {
    var p = $("prompt"), st = step(eq, r), focus = null;
    p.textContent = "";
    if (st === "build") p.appendChild(h("p", { "class": "prompt-driver", text: "Driver: switch this equation" }));
    if (st === "build" && eq.built) {
      p.appendChild(h("p", { "class": "prompt-q", text: "Build the equation on the balance." }));
      p.appendChild(h("p", { "class": "prompt-help", text: "x adds a box. +1 and −1 change the number on that side. Click a piece to take it off." }));
      p.appendChild(h("button", { type: "button", "class": "btn btn-primary", id: "built-btn", text: "I built the equation", onclick: function () {
        var res = F.checkBuild(eq, r.model);
        if (res.ok) { r.built = true; r.model = M.modelFromEquation(eq); save(); enterStep(eq, r, true); return; }
        buildMsg = res.message;
        document.querySelectorAll(".palette").forEach(function (pl) {
          pl.classList.toggle("is-look", res.wrong === "both" || pl.getAttribute("data-side") === res.wrong);
        });
        p.querySelector(".prompt-msg").textContent = res.message;
      } }));
      p.appendChild(h("p", { "class": "prompt-msg is-help", role: "status", text: buildMsg }));
      focus = document.querySelector('.palette[data-side="left"] .pbtn');
    } else if (st === "build") {
      p.appendChild(h("p", { "class": "prompt-q", text: T.lookModel }));
      if (eq.part === 3) p.appendChild(h("p", { "class": "prompt-help", text: "The slider is broken for this one." }));
      focus = p.appendChild(h("button", { type: "button", "class": "btn btn-primary", id: "continue-btn", text: "Continue", onclick: function () {
        r.built = true; save(); enterStep(eq, r, true);
      } }));
    } else if (st === "slide") {
      p.appendChild(h("p", { "class": "prompt-q", text: "Move the slider. Where does it balance?" }));
      p.appendChild(h("p", { "class": "prompt-help", text: "Drag it, use the arrow keys, or type a value for x." }));
      p.appendChild(h("p", { "class": "prompt-group", text: "Talk it over: what do you see? Agree as a group, then tap." }));
      if (r.positions.length >= F.MIN_POSITIONS) {
        p.appendChild(h("button", { type: "button", "class": "btn btn-primary", id: "enough-btn", text: "I’ve seen enough", onclick: function () {
          r.slid = true; save(); enterStep(eq, r, true);
        } }));
      }
      focus = ex.slider.thumb;
    } else if (st === "check") {
      p.appendChild(h("p", { "class": "prompt-q", text: T.checkQ }));
      var choices = h("div", { "class": "choices", role: "group", "aria-label": T.checkQ });
      F.SLIDER_WORDS.forEach(function (w) {
        choices.appendChild(h("button", { type: "button", "class": "btn choice", "data-cat": w[0], text: w[1], onclick: function () {
          if (F.checkSlider(eq, w[0])) {
            r.check.done = true; r.check.firstTry = r.check.wrongs === 0; r.spotlight = false; save(); enterStep(eq, r, true);
          } else {
            r.check.wrongs++; r.spotlight = true; save(); enterStep(eq, r, true);
          }
        } }));
      });
      if (r.spotlight) choices.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      p.appendChild(choices);
      focus = r.spotlight ? ex.slider.thumb : choices.querySelector("button");
    } else if (st === "predict") {
      focus = drawPredict(p, eq, r);
    } else if (st === "compare") {
      p.appendChild(h("p", { "class": "prompt-q is-compact" }, ["Compare with your work. ",
        h("span", { "class": "prompt-help", text: "Copy the correct steps onto your sheet." })]));
      if (BON.BRIDGE[eq.id]) {
        p.insertBefore(h("div", { "class": "bridge", role: "note" }, [h("p", { "class": "bridge-title", text: "Talk with your group" }),
          h("p", { text: BON.BRIDGE[eq.id] })]), p.firstChild);
      }
      p.appendChild(stepsBlock(eq));
      // sorting is a group decision: ask first, then show the column
      var col = h("div", { "class": "prompt-col", id: "col-box" });
      var showCol = function () {
        col.textContent = "";
        col.appendChild(h("p", { html: "Write this equation under <b>" + CATS[eq.category].title + "</b> on your reflection page." }));
      };
      if (r.colShown) showCol();
      else {
        col.appendChild(h("p", { text: "Decide as a group: which column?" }));
        col.appendChild(h("button", { type: "button", "class": "btn btn-small-inline", id: "col-btn", text: "Check our column", onclick: function () {
          r.colShown = true; save(); showCol(); var n = $("next-eq"); if (n) n.focus();
        } }));
      }
      p.appendChild(col);
      var last = state.current === EQS.length - 1;
      focus = p.appendChild(h("button", { type: "button", "class": "btn btn-primary", id: "next-eq",
        text: last ? "Next ›" : "Next equation ›", onclick: function () { afterCompare(eq); } }));
    }
    return focus;
  }

  /* Part 3: predict a category and pick a reason; wrong reasoning gets a counterexample. */
  var p3pick = { cat: null, reason: null, feedback: null };
  function drawPredict(p, eq, r) {
    p.appendChild(h("p", { "class": "prompt-q", text: "The slider broke. What does your group predict?" }));
    var cats = h("div", { "class": "choices is-row", role: "group", "aria-label": "Prediction" });
    F.SLIDER_WORDS.forEach(function (w) {
      cats.appendChild(h("button", { type: "button", "class": "btn choice", "data-cat": w[0], text: w[1],
        "aria-pressed": p3pick.cat === w[0] ? "true" : "false", onclick: function () { p3pick.cat = w[0]; p3pick.feedback = null; drawPrompt(eq, r); focusSel('[data-cat="' + w[0] + '"]'); } }));
    });
    p.appendChild(cats);
    p.appendChild(h("p", { "class": "prompt-sub", text: "Because…" }));
    var reasons = h("div", { "class": "reasons", role: "group", "aria-label": "Reason" });
    BON.REASONS.forEach(function (rs) {
      reasons.appendChild(h("button", { type: "button", "class": "btn reason", "data-reason": rs.id, text: rs.text,
        "aria-pressed": p3pick.reason === rs.id ? "true" : "false", onclick: function () { p3pick.reason = rs.id; p3pick.feedback = null; drawPrompt(eq, r); focusSel('[data-reason="' + rs.id + '"]'); } }));
    });
    p.appendChild(reasons);
    var go = h("button", { type: "button", "class": "btn btn-primary", id: "predict-btn", text: "Check my prediction", onclick: function () {
      var earlier = EQS.filter(function (q) { return q.id < eq.id && q.part !== 3 && isDone(q); });
      var res = F.checkPart3(eq, p3pick.cat, p3pick.reason, earlier);
      if (res.ok) { r.p3.done = true; r.p3.firstTry = r.p3.wrongs === 0; r.p3.cat = p3pick.cat; r.p3.reason = p3pick.reason; p3pick = { cat: null, reason: null, feedback: null }; save(); enterStep(eq, r, true); return; }
      r.p3.wrongs++; save();
      p3pick.feedback = res;
      drawPrompt(eq, r);
      var fb = document.querySelector(".counter"); if (fb) fb.focus();
    } });
    if (!p3pick.cat || !p3pick.reason) go.disabled = true;
    p.appendChild(go);
    var fb = p3pick.feedback;
    if (fb) {
      var box = h("div", { "class": "counter", tabindex: "-1", role: "status" });
      if (!fb.reasonFits) box.appendChild(h("p", { text: "Count the x’s and the plain numbers on each side of #" + eq.id + " again." }));
      if (fb.example) {
        box.appendChild(h("p", { text: fb.reasonFits ? "This one you did fits that reason too:" : "Here is one you did that fits that reason:" }));
        var line = h("p", { "class": "counter-eq" }, [h("span", { "class": "sort-num", text: fb.example.id }), eqLine(fb.example)]);
        box.appendChild(line);
        box.appendChild(h("p", { html: "Its slider showed: <b>" + CATS[fb.exampleCat].slider + "</b>." }));
      }
      p.appendChild(box);
    }
    return cats.querySelector("button");
  }
  function focusSel(sel) { var e = document.querySelector("#prompt " + sel); if (e) e.focus(); }

  /* ---------- stop screens: Solve, reflection breaks, welcome back, completion ---------- */

  function showStop(nodes, focusEl) {
    var s = $("stop");
    s.textContent = "";
    var card = h("div", { "class": "stop-card" });
    nodes.forEach(function (n) { card.appendChild(n); });
    s.appendChild(card);
    s.hidden = false;
    document.body.classList.add("is-stopped");
    if (focusEl) focusEl.focus();
  }
  function hideStop() { $("stop").hidden = true; document.body.classList.remove("is-stopped"); }

  function solveScreen(eq, r) {
    var b = h("button", { type: "button", "class": "btn btn-primary btn-big", id: "solved-btn", text: "I solved it", onclick: function () {
      r.solved = true; save(); hideStop(); enterStep(eq, r, true);
    } });
    var big = h("div", { "class": "stop-eq" }, [h("span", { "class": "eq-number", text: eq.id }), eqLine(eq)]);
    showStop([big,
      h("p", { "class": "stop-lead", text: "Solve #" + eq.id + " together on your whiteboard." }),
      h("p", { "class": "stop-text", text: "Talk through each step. Then everyone copies it onto their own sheet: " +
        (eq.part === 3 ? "circle your prediction, write why, and write your result." :
        "circle what the slider showed, write where it balances, and write your result.") +
        " Press ‘I solved it’ when your group has an answer." }),
      b], b);
  }

  function reflectionScreen(id, then) {
    var ps = BON.REFLECTIONS[id];
    var b = h("button", { type: "button", "class": "btn btn-primary btn-big", id: "reflect-done", text: "Done, continue", onclick: function () {
      state.reflections[id] = true; save(); hideStop(); then();
    } });
    var nodes = [h("p", { "class": "stop-lead", text: "Turn to your reflection page." }),
      h("p", { "class": "stop-text", text: "Talk it over as a group, then everyone writes. " +
        (ps.length === 1 ? "Do prompt " + ps[0].n + "." : "Do prompts " + ps.map(function (q) { return q.n; }).join(", ").replace(/, ([^,]*)$/, " and $1") + ".") })];
    ps.forEach(function (q) {
      nodes.push(h("p", { "class": "stop-prompt" + (ps.length > 1 ? " is-small" : "") }, [h("span", { "class": "prompt-n", text: q.n }), q.text]));
    });
    nodes.push(b);
    showStop(nodes, b);
  }

  /* Groups re-form daily, so the load screen asks where the group is starting (default: the last one opened here). */
  function startScreen() {
    var def = state.current;
    var startAt = function (i) {
      hideStop(); state.current = i; save();
      enterStep(EQS[i], rec(EQS[i]), true);
      if (i === 0 && !state.coachSeen) startCoach();
    };
    var go = h("button", { type: "button", "class": "btn btn-primary btn-big", id: "start-go", text: "Start at #" + EQS[def].id,
      onclick: function () { startAt(def); } });
    var list = h("div", { "class": "start-list", role: "group", "aria-label": "Pick an equation" });
    EQS.forEach(function (eq, i) {
      list.appendChild(h("button", { type: "button", "class": "eqpick is-big" + (isDone(eq) ? " is-done" : "") + (i === def ? " is-default" : ""),
        "data-start": eq.id, text: eq.id, "aria-label": "Start at equation " + eq.id + (isDone(eq) ? " (done on this computer)" : ""),
        onclick: function () { startAt(i); } }));
    });
    var buttons = [go];
    if (state.finished) buttons.push(h("button", { type: "button", "class": "btn", id: "start-results", text: "See the results", onclick: function () { hideStop(); completionScreen(); } }));
    var nodes = [h("p", { "class": "stop-lead", text: "Where is your group starting?" }), list,
      h("p", { "class": "stop-note", text: "Start at the first equation anyone in your group hasn\u2019t finished." }),
      h("div", { "class": "stop-buttons" }, buttons)];
    if (EQS.some(isDone)) nodes.push(h("p", { "class": "stop-note", text: "A \u2713 means it was finished on this computer." }));
    showStop(nodes, go);
  }

  function completionScreen() {
    state.finished = true; save();
    var rows = EQS.map(function (eq) {
      var r = state.eqs[eq.id] || null, ok = null;
      if (r) ok = eq.part === 3 ? (r.p3.done ? r.p3.firstTry : null) : (r.check.done ? r.check.firstTry : null);
      var mark = ok === true ? "✓ Yes" : ok === false ? "✗ Not the first time" : "— not done";
      return h("tr", { "data-eq": eq.id }, [
        h("th", { scope: "row" }, [h("span", { "class": "sort-num", text: eq.id })]),
        h("td", { "class": "c-eq" }, [eqLine(eq)]),
        h("td", { text: CATS[eq.category].title }),
        h("td", { "class": ok === true ? "c-yes" : ok === false ? "c-no" : "", text: mark })
      ]);
    });
    var table = h("table", { "class": "results" }, [
      h("thead", {}, [h("tr", {}, [h("th", { scope: "col", text: "#" }), h("th", { scope: "col", text: "Equation" }),
        h("th", { scope: "col", text: "Category" }), h("th", { scope: "col", text: "Right on the first try?" })])]),
      h("tbody", {}, rows)
    ]);
    var close = h("button", { type: "button", "class": "btn", id: "results-close", text: "Back to the equations", onclick: function () {
      hideStop(); enterStep(EQS[state.current], rec(EQS[state.current]), true);
    } });
    showStop([h("p", { "class": "stop-lead", text: "You finished! Show this to your teacher." }), table,
      h("p", { "class": "stop-note", text: "For #11 and #12 the check is your prediction. Nothing is sent anywhere." }),
      h("div", { "class": "stop-buttons" }, [close])], close);
  }

  /* After Compare: a reflection break if one is due, then the next equation (or the completion screen). */
  function afterCompare(eq) {
    var next = function () {
      if (state.current < EQS.length - 1) go(state.current + 1); else completionScreen();
    };
    if (REFLECT_AFTER.indexOf(eq.id) >= 0 && !state.reflections[eq.id]) reflectionScreen(eq.id, next);
    else next();
  }

  /* ---------- drawing a step ---------- */

  function drawStrip() {
    var strip = $("eqstrip");
    strip.textContent = "";
    EQS.forEach(function (eq, i) {
      var b = h("button", { type: "button", "class": "eqpick" + (isDone(eq) ? " is-done" : ""), text: eq.id,
        "aria-label": "Equation " + eq.id + (isDone(eq) ? ", done" : ""), onclick: function () { go(i); } });
      if (i === state.current) b.setAttribute("aria-current", "true");
      strip.appendChild(b);
    });
  }

  function enterStep(eq, r, focus) {
    var st = step(eq, r);
    hideStop();
    document.body.setAttribute("data-step", stripStep(st));
    document.body.setAttribute("data-part", eq.part);
    Array.prototype.forEach.call($("steps").children, function (li) {
      var s = li.getAttribute("data-step");
      if (s === stripStep(st)) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      li.classList.toggle("is-skipped", eq.part === 3 && s === "slide");
    });
    $("eq-number").textContent = eq.id;
    BON.renderEquation($("eq-display"), eq, { emphasis: eq.part === 2 });
    drawStrip();

    var building = st === "build";
    // Part 3 is predicted "just by looking": the model shows boxes marked x, a level beam and no totals
    var looking = building || eq.part === 3;
    $("palettes").hidden = !(building && eq.built);
    ex.setLocked(building || eq.part === 3 || st === "solve");
    ex.setFlicker(eq.part === 3);
    ex.show(eq, r.model, { build: looking, x: looking ? undefined : (!r.positions.length ? E.frac(0) : undefined) });

    var spot = st === "check" && r.spotlight;
    $("veil").hidden = !spot;
    document.body.classList.toggle("is-spotlight", spot);
    $("spot-msg").textContent = spot ? T.checkSlider : "";

    var f = drawPrompt(eq, r);
    if (st === "solve") solveScreen(eq, r);
    else if (focus && f && $("coach").hidden) f.focus();
  }

  /* ---------- navigation ---------- */

  function go(i) {
    if (i < 0 || i >= EQS.length) return;
    state.current = i;
    buildMsg = ""; p3pick = { cat: null, reason: null, feedback: null };
    save();
    enterStep(EQS[i], rec(EQS[i]), true);
  }
  document.addEventListener("keydown", function (e) {
    if (!$("coach").hidden) { if (e.key === "Escape") endCoach(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || !$("stop").hidden) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.getAttribute("role") === "slider")) return;
    if (e.key === "n" || e.key === "N") go(state.current + 1);
    if (e.key === "b" || e.key === "B") go(state.current - 1);
  });
  function startOver() {
    if (!window.confirm("Start over? This clears all your work on this computer.")) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ }
    state = blank(); state.coachSeen = true;
    hideStop();
    enterStep(EQS[0], rec(EQS[0]), true);
  }
  $("start-over").addEventListener("click", startOver);

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
  function startCoach() { if (!$("stop").hidden) return; coachBack = document.activeElement; coachAt = -1; $("coach").hidden = false; coachNext(); }
  function endCoach() {
    $("coach").hidden = true; state.coachSeen = true; save();
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
    var bw = bub.offsetWidth, bh = bub.offsetHeight, tall = rect.height > innerHeight * 0.5;
    var below = rect.bottom + pad + 12, above = rect.top - pad - 12 - bh;
    var top = below + bh <= innerHeight - 8 ? below : above >= 8 ? above : Math.max(8, innerHeight - bh - 8);
    var left = tall && rect.right + 16 + bw <= innerWidth - 8 ? rect.right + 16 : Math.min(innerWidth - bw - 12, Math.max(12, rect.left + rect.width / 2 - bw / 2));
    if (tall) top = Math.max(8, Math.min(innerHeight - bh - 8, rect.top + rect.height / 2 - bh / 2));
    bub.style.left = left + "px"; bub.style.top = top + "px";
    $("coach-next").focus();
  }
  $("coach-next").addEventListener("click", coachNext);
  $("coach-skip").addEventListener("click", endCoach);
  $("help").addEventListener("click", startCoach);

  /* ---------- start ---------- */

  enterStep(EQS[state.current], rec(EQS[state.current]), true);
  if (!(startEq >= 1)) startScreen();
  else if (state.current === 0 && !state.coachSeen) startCoach();
})();
