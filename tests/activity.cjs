// Real-browser walk through the student page, Stage A (screen + Guess step), at 1366 x 650 and 1366 x 768.
// Called from tests/browser.cjs.
const M = "−";
module.exports = async function (browser, base, OUT, check) {
  for (const [w, hgt] of [[1366, 650], [1366, 768]]) {
    const tag = `${w}x${hgt}`;
    const page = await browser.newPage({ viewport: { width: w, height: hgt }, reducedMotion: "no-preference" });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const instr = () => page.textContent("#instruction");
    const arrow = async () => { const a = await page.$("#eq-arrow:not([hidden])"); return a ? (await a.getAttribute("data-heavier")) : null; };
    const arrived = () => page.waitForFunction(() => document.getElementById("x-slider").classList.contains("is-arrived"), null, { timeout: 5000 });
    const card = (i) => page.$eval(`#cards .card-guess:nth-child(${i})`, (c) => ({
      x: (c.querySelector(".card-box") || {}).textContent, totals: [...c.querySelectorAll(".card-totals > span:not(.card-bar)")].map((s) => s.textContent).join("|"),
      given: !!c.querySelector(".given"), heavier: c.getAttribute("data-heavier") }));
    const markers = () => page.$$eval("#nl-markers .nl-marker", (m) => m.map((x) => x.getAttribute("data-heavier")));
    const fits = async (where) => {
      const r = await page.evaluate(() => {
        const over = [...document.querySelectorAll(".stage > *, .bar > *, .top-row > *")].filter((el) => {
          const b = el.getBoundingClientRect(); return b.bottom > innerHeight + 0.5 || b.right > innerWidth + 0.5;
        }).map((el) => el.className || el.id);
        const bar = document.querySelector(".bar");
        return { page: document.documentElement.scrollHeight - innerHeight, w: document.documentElement.scrollWidth - innerWidth,
          bar: bar.scrollWidth - bar.clientWidth, over };
      });
      check(r.page <= 0 && r.w <= 0 && r.bar <= 0 && !r.over.length, `${tag} ${where}: fits, nothing scrolls or is cut off (${JSON.stringify(r)})`);
    };
    const guess = async (x) => {
      await page.fill("#x-input", x); await page.press("#x-input", "Enter");
    };
    const guessAndLand = async (x) => {
      await page.waitForFunction(() => !document.getElementById("x-input").disabled, null, { timeout: 5000 });
      await guess(x); await page.waitForTimeout(30); await arrived(); await page.waitForTimeout(30);
    };

    // ---- Equation 1: first given guess plays, then the coach marks ----
    await page.goto(base + "index.html?reset=1");
    await page.waitForSelector("#coach:not([hidden])", { timeout: 5000 });
    check((await page.title()) === "What Makes It Balance?" && (await page.textContent(".bar-title")) === "What Makes It Balance?", `${tag}: renamed`);
    const c1 = await card(1);
    check(c1.x === "1" && c1.totals === "5|8" && c1.given, `${tag} #1: given guess 1 card: x = 1, 5 | 8, marked given`);
    check((await arrow()) === "right", `${tag} #1: arrow at "=" points right (right heavier)`);
    check((await page.textContent("#eq-arrow")).includes("right heavier"), `${tag} #1: the arrow carries text`);
    check(JSON.stringify(await markers()) === '["right"]', `${tag} #1: a ▶ marker on the number line`);
    check(await page.isDisabled("#x-slider"), `${tag} #1: slider locked during guessing`);
    // coach marks
    let steps = 0, ringsOk = true;
    const seen = [];
    while (!(await page.isHidden("#coach")) && steps < 10) {
      steps++;
      seen.push(await page.textContent("#coach-text"));
      const r = await page.$eval("#coach-ring", (e) => e.getBoundingClientRect().toJSON());
      const b = await page.$eval("#coach-bubble", (e) => e.getBoundingClientRect().toJSON());
      if (b.bottom > hgt || b.top < 0 || r.width < 10) ringsOk = false;
      if (steps === 1) { await fits("coach marks"); await page.screenshot({ path: `${OUT}/${tag}-A1-coach.png` }); }
      await page.click("#coach-next");
    }
    check(steps === 6, `${tag} #1: six coach marks (${steps})`);
    check(seen.some((t) => t.includes("This box is x")) && seen.some((t) => t.includes("+3 ball")), `${tag} #1: coach marks name the x box and the +3 ball`);
    check(seen.every((t) => t.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length === 1), `${tag} #1: each coach mark is one sentence`);
    check(ringsOk, `${tag} #1: every coach callout is on screen`);
    check(await page.isDisabled("#x-input"), `${tag} #1: x box closed while a given guess is still to come`);

    // second given guess: travel updates the balance on the way, thumb turns green on arrival
    const before = await page.getAttribute("#balance", "data-target-angle");
    await page.click("#next-guess");
    const samples = new Set();
    for (let i = 0; i < 10; i++) {
      samples.add((await page.inputValue("#x-slider")) + "|" + (await page.getAttribute("#balance", "data-target-angle")) + "|" + (await page.textContent("#xbox")));
      await page.waitForTimeout(40);
    }
    await arrived();
    check(samples.size >= 4, `${tag} #1: the thumb travels and the balance/x-box update on the way (${samples.size} states)`);
    check((await page.getAttribute("#balance", "data-target-angle")) !== before, `${tag} #1: beam changed`);
    check(await page.$eval("#x-slider", (s) => s.classList.contains("is-arrived") && [...document.styleSheets].some((sh) =>
      [...sh.cssRules].some((r) => /is-arrived::-webkit-slider-thumb/.test(r.selectorText || "") && /--green|30, 122, 54/.test(r.cssText)))),
      `${tag} #1: thumb is green on arrival`);
    const c2 = await card(2);
    check(c2.x === "7" && c2.totals === "17|14" && (await arrow()) === "left", `${tag} #1: given guess 2: 17 | 14, arrow left`);
    check((await page.textContent("#xbox")) === "7", `${tag} #1: x-box shows 7`);

    // own guesses
    check(!(await page.isDisabled("#x-input")) && (await instr()).includes("Guess 3 of 5"), `${tag} #1: now guess 3 of 5`);
    await page.fill("#x-input", "-");
    check((await page.textContent("#x-msg")) === "Keep typing: that isn't a number yet.", `${tag} #1: "-" -> keep typing`);
    await guess("11");
    check((await page.textContent("#x-msg")) === `Try a value between ${M}10 and 10.`, `${tag} #1: 11 refused (out of range)`);
    await guess("1");
    check((await page.textContent("#x-msg")) === "You already tried that one.", `${tag} #1: repeated x refused`);
    check((await page.$$("#cards .card-guess:not(.is-empty)")).length === 2, `${tag} #1: refusals add no card`);
    await guessAndLand("4");
    check((await arrow()) === "balanced" && (await page.textContent("#eq-arrow")).includes("balanced"), `${tag} #1: x = 4 balances: ✓ at "="`);
    check((await instr()).includes("That balances. Can you find a different value that also balances?"), `${tag} #1: second-value note`);
    await guessAndLand("-1/2");
    const c4 = await card(4);
    check(c4.x === `${M}1/2` && c4.totals === "2|13/2", `${tag} #1: fraction guess card: −1/2, 2 | 13/2`);
    check((await instr()).match(/That balances/g).length === 1, `${tag} #1: the note stays, shown once`);
    // expressions under the pans: coloured, ride with the pan, never rotate; substitution lines fixed
    const ex = await page.evaluate(() => {
      const L = document.querySelector('[data-expr="left"]'), R = document.querySelector('[data-expr="right"]');
      const pans = [...document.querySelectorAll(".bon-pan")].map((p) => p.getAttribute("transform"));
      const subs = [...document.querySelectorAll("[data-sub]")].map((t) => t.getBoundingClientRect().top);
      return { l: L.textContent, colors: [...L.querySelectorAll("tspan")].map((t) => t.getAttribute("fill")),
        ly: L.getBoundingClientRect().top, ry: R.getBoundingClientRect().top, pans, subs, sub: document.querySelector('[data-sub="left"]').textContent };
    });
    check(ex.l === "2x + 3" && ex.colors[0] === "#1F5FBF" && ex.colors[ex.colors.length - 1] === "#1E7A36", `${tag} #1: "2x + 3" under the left pan, 2x blue, + 3 green`);
    check(ex.pans.every((t) => /^translate\(/.test(t)) && Math.abs(ex.ly - ex.ry) > 5, `${tag} #1: expressions move with the pans (translate only)`);
    check(Math.abs(ex.subs[0] - ex.subs[1]) < 0.5 && ex.sub === `2(${M}1/2) + 3 = 2`, `${tag} #1: substitution lines fixed and level: "${ex.sub}"`);
    await fits("note and four cards");
    await guessAndLand("0");
    check((await instr()).includes("Five guesses done"), `${tag} #1: after five guesses, Predict is next`);
    check((await page.getAttribute('#steps li[aria-current="step"]', "data-step")) === "predict", `${tag} #1: step strip moves to Predict`);
    check(JSON.stringify(await markers()) === '["right","left","balanced","right","right"]', `${tag} #1: five markers ▶ ◀ ✓ ▶ ▶`);
    check(await page.$$eval("#nl-markers .nl-marker", (ms) => { const r = ms.map((m) => m.getBoundingClientRect());
      return r.every((a, i) => r.every((b, j) => i >= j || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)); }),
      `${tag} #1: markers for −1/2, 0 and 1 don't cover each other`);
    check(!(await page.$(".log, #diff-input")), `${tag} #1: no per-guess questions, no difference column`);
    await fits("five cards");
    await page.screenshot({ path: `${OUT}/${tag}-A2-five-guesses.png` });
    const bodyText = await page.textContent("body");
    check(!/\d\.\d{3,}|NaN|undefined/.test(bodyText), `${tag}: no float artifacts or NaN on screen`);
    // persistence; the coach marks don't replay by themselves
    await page.reload(); await page.waitForSelector("#cards .card-guess");
    check((await page.$$("#cards .card-guess:not(.is-empty)")).length === 5 && (await page.isHidden("#coach")), `${tag}: refresh keeps the cards; no coach marks`);
    await page.click("#help");
    check(!(await page.isHidden("#coach")), `${tag}: "?" replays the coach marks`);
    await page.keyboard.press("Escape");
    check(await page.isHidden("#coach"), `${tag}: Escape closes them`);

    // ---- #3 flipped (reduced motion: the thumb jumps) ----
    const rm = await browser.newPage({ viewport: { width: w, height: hgt }, reducedMotion: "reduce" });
    rm.on("pageerror", (e) => errors.push(e.message));
    const rmArrow = async () => { const a = await rm.$("#eq-arrow:not([hidden])"); return a ? a.getAttribute("data-heavier") : null; };
    const rmGuess = async (x) => { await rm.fill("#x-input", x); await rm.press("#x-input", "Enter"); };
    const rmMarkers = () => rm.$$eval("#nl-markers .nl-marker", (m) => m.map((x) => x.getAttribute("data-heavier")));
    await rm.goto(base + "index.html?reset=1&all=1&eq=3"); await rm.waitForSelector("#cards .card-guess:not(.is-empty)");
    check((await rm.$eval("#eq-display", (d) => { const c = d.cloneNode(true); c.querySelectorAll(".eq-arrow").forEach((a) => a.remove()); return c.textContent.replace(/\s+/g, " ").trim(); })) === "x + 5 = 4x + 1", `${tag} #3: shows x + 5 = 4x + 1`);
    check((await rmArrow()) === "left", `${tag} #3: given x = 0 -> left heavier (opposite of #1 for a low guess)`);
    await rm.click("#next-guess");
    check((await rmArrow()) === "right", `${tag} #3: given x = 3 -> right heavier`);
    check((await rm.inputValue("#x-slider")) === "3", `${tag} #3: with reduced motion the thumb jumps straight to 3`);
    await rmGuess("1.33");
    check((await rmArrow()) === "left" && Math.abs(parseFloat(await rm.getAttribute("#balance", "data-target-angle"))) >= 4,
      `${tag} #3: 1.33 not balanced, beam still tips at least 4°`);
    await rmGuess("1.34");
    check((await rmArrow()) === "right", `${tag} #3: 1.34 tips the other way`);

    // ---- #2 at −3, #9 at 0 ----
    await rm.goto(base + "index.html?reset=1&all=1&eq=2"); await rm.waitForSelector("#next-guess");
    await rm.click("#next-guess"); await rmGuess("-3");
    const shapes = (side) => rm.$$eval(`.bon-pan[data-side=${side}] [data-shape]`, (els) => els.map((e) => e.dataset.shape + ":" + e.dataset.label));
    check(JSON.stringify(await shapes("left")) === JSON.stringify([`float-box:${M}3`, `float-box:${M}3`, `float-box:${M}3`, "weight:+2"]) &&
      JSON.stringify(await shapes("right")) === JSON.stringify([`float-box:${M}3`, `balloon:${M}4`]) && (await rmArrow()) === "balanced",
      `${tag} #2 at −3: floating boxes and a −4 balloon, balanced at −7`);
    await rm.screenshot({ path: `${OUT}/${tag}-A3-eq2-at-minus3.png` });
    await rm.goto(base + "index.html?reset=1&all=1&eq=9"); await rm.waitForSelector("#x-input:not([disabled])");
    check(!(await rm.$("#cards .card-guess:not(.is-empty)")), `${tag} #9: no given guesses`);
    await rmGuess("0");
    check((await rm.$$eval('[data-shape="zero-box"] rect', (r) => r.length === 3 && r.every((x) => x.getAttribute("stroke-dasharray")))) &&
      (await rmArrow()) === "balanced" && (await rm.textContent('[data-sub="right"]')) === "4", `${tag} #9 at 0: dashed 0 boxes, balanced at 4`);
    check(!!(await rm.$(".eqn--emphasis")), `${tag} #9: Part 2 x-terms tinted`);

    // ---- markers: never equations all one way, always equations all ✓ ----
    for (const [id, want] of [[4, "right"], [5, "left"], [8, "right"], [6, "balanced"], [7, "balanced"], [10, "balanced"]]) {
      await rm.goto(base + `index.html?reset=1&all=1&eq=${id}`); await rm.waitForSelector("#x-input:not([disabled])");
      for (const x of ["-10", "-2.5", "0", "1/3", "10"]) await rmGuess(x);
      const mk = await rmMarkers();
      check(mk.length === 5 && mk.every((m) => m === want), `${tag} #${id}: markers all ${want} (${mk.join(",")})`);
      if (id <= 5) {
        const angles = await rm.$$eval(".card-beam g", (g) => g.map((x) => x.getAttribute("transform")));
        check(new Set(angles).size === 1, `${tag} #${id}: never-balanced: the same tilt at every guess`);
      }
    }
    await rm.screenshot({ path: `${OUT}/${tag}-A4-eq10-always.png` });
    check(errors.length === 0, `${tag}: no script errors ${errors.join("; ")}`);
    await rm.close();
    await page.close();
  }
};
