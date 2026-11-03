/*
 * The vertical number-line slider (spec v3, section 5).
 *
 *   var vs = BON.createVSlider(container, { min: -6, max: 6, onInput: function (x, style, how) {} });
 *   vs.setValue(x, style)   move the thumb without telling anyone (x is an exact fraction)
 *   vs.setPos(number)       move the thumb to a drawing position (travel animation)
 *   vs.setDisabled(bool), vs.setFlicker(bool), vs.zeroY(), vs.slot (the element beside zero for the x-box)
 *
 * - Tick and label at every integer; "Heavier" at the top, "Lighter" at the bottom.
 * - Drag: values to 0.01, with a magnetic pull to whole numbers within SNAP that lets go once you move past it.
 * - Keys on the thumb: arrows 0.01, Shift + arrow 0.1, Page Up / Page Down 1, Home / End the ends.
 * Values are exact: drag and keys produce whole hundredths; the pointer position is only used to pick them.
 */
(function (root) {
  "use strict";
  var BON = root.BON || (root.BON = {});
  var E = BON.exact;
  var SNAP = 0.15;   // magnetic capture around each whole number (units of x); tunable
  var PAD = 14;      // px between the track ends and the first/last tick

  function createVSlider(container, opts) {
    var min = opts.min, max = opts.max;
    container.classList.add("vs");
    container.innerHTML =
      '<span class="vs-cap vs-top">Heavier</span>' +
      '<div class="vs-track">' +
        '<div class="vs-line" aria-hidden="true"></div>' +
        '<div class="vs-ticks" aria-hidden="true"></div>' +
        '<div class="vs-slot"></div>' +
        '<div class="vs-thumb" role="slider" tabindex="0" aria-orientation="vertical" aria-label="Value of x"></div>' +
      '</div>' +
      '<span class="vs-cap vs-bottom">Lighter</span>';
    var track = container.querySelector(".vs-track"), thumb = container.querySelector(".vs-thumb");
    var ticks = container.querySelector(".vs-ticks"), slot = container.querySelector(".vs-slot");
    thumb.setAttribute("aria-valuemin", min); thumb.setAttribute("aria-valuemax", max);
    var state = { x: E.frac(0), style: "int", pos: 0, disabled: false };

    function frac01(v) { return (max - v) / (max - min); }
    function topFor(v) { return "calc(" + PAD + "px + (100% - " + 2 * PAD + "px) * " + frac01(v).toFixed(5) + ")"; }

    for (var v = min; v <= max; v++) {
      var t = document.createElement("span");
      t.className = "vs-tick" + (v === 0 ? " is-zero" : "");
      t.style.top = topFor(v);
      ticks.appendChild(t);
      var n = document.createElement("span");
      n.className = "vs-num" + (v === 0 ? " is-zero" : "");
      n.style.top = topFor(v);
      n.textContent = E.fmtValue(E.frac(v));
      ticks.appendChild(n);
    }
    slot.style.top = topFor(0);

    function setPos(p) {
      state.pos = Math.max(min, Math.min(max, p));
      thumb.style.top = topFor(state.pos);
    }
    function setValue(x, style) {
      state.x = x; state.style = style || "decimal";
      setPos(x.n / x.d);
      thumb.setAttribute("aria-valuenow", (x.n / x.d).toFixed(2));
      thumb.setAttribute("aria-valuetext", "x = " + E.fmtValue(x, state.style));
    }
    function emit(h, how) {
      h = Math.max(min * 100, Math.min(max * 100, h));
      var x = E.frac(h, 100);
      setValue(x, h % 100 === 0 ? "int" : "decimal");
      if (opts.onInput) opts.onInput(x, state.style, how);
    }
    function hundredths() {
      var x = state.x;
      return E.isHundredths(x) ? E.toHundredths(x) : Math.round(x.n * 100 / x.d); // keys start from the nearest 0.01
    }

    // drag (pointer position only picks a whole number of hundredths)
    function fromPointer(e) {
      var r = track.getBoundingClientRect();
      var f = (e.clientY - r.top - PAD) / (r.height - 2 * PAD);
      var raw = max - f * (max - min);
      var h = Math.round(raw * 100);
      var whole = Math.round(h / 100);
      if (Math.abs(h - whole * 100) <= SNAP * 100) h = whole * 100;
      return h;
    }
    var dragging = false;
    track.addEventListener("pointerdown", function (e) {
      if (state.disabled) return;
      dragging = true;
      track.setPointerCapture(e.pointerId);
      thumb.focus({ preventScroll: true });
      container.classList.add("is-dragging");
      emit(fromPointer(e), "drag");
      e.preventDefault();
    });
    track.addEventListener("pointermove", function (e) { if (dragging) emit(fromPointer(e), "drag"); });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      container.classList.remove("is-dragging");
      if (opts.onRelease) opts.onRelease();
    }
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);

    thumb.addEventListener("keydown", function (e) {
      if (state.disabled) return;
      var step = 0, h = hundredths();
      if (e.key === "ArrowUp" || e.key === "ArrowRight") step = e.shiftKey ? 10 : 1;
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") step = e.shiftKey ? -10 : -1;
      else if (e.key === "PageUp") step = 100;
      else if (e.key === "PageDown") step = -100;
      else if (e.key === "Home") { e.preventDefault(); emit(min * 100, "key"); return; }
      else if (e.key === "End") { e.preventDefault(); emit(max * 100, "key"); return; }
      if (!step) return;
      e.preventDefault();
      emit(h + step, "key");
    });

    function setDisabled(d) {
      state.disabled = !!d;
      container.classList.toggle("is-disabled", !!d);
      thumb.setAttribute("aria-disabled", d ? "true" : "false");
      thumb.tabIndex = d ? -1 : 0;
    }
    function setFlicker(f) { container.classList.toggle("is-flicker", !!f); }
    function zeroY() { var r = slot.getBoundingClientRect(); return r.top; }

    setValue(E.frac(0), "int");
    return { setValue: setValue, setPos: setPos, setDisabled: setDisabled, setFlicker: setFlicker, zeroY: zeroY,
      slot: slot, thumb: thumb, track: track, SNAP: SNAP };
  }

  BON.createVSlider = createVSlider;
})(typeof window !== "undefined" ? window : globalThis);
