// Real-browser walk through the student page, Stage A with the v2.1 layout, at 1366 x 650 and 1366 x 768.
// Called from tests/browser.cjs.
const M = "−";
module.exports = async function (browser, base, OUT, check) {
  for (const [w, hgt] of [[1366, 650], [1366, 768]]) {
    const tag = `${w}x${hgt}`;
    const page = await browser.newPage({ viewport: { width: w, height: hgt }, reducedMotion: "no-preference" });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const prompt = () => page.textContent("#prompt");
    const arrived = () => page.waitForFunction(() => document.getElementById("x-slider").classList.contains("is-arrived"), null, { timeout: 5000 });
    const row = (i) => page.$eval(`#guess-rows tr:nth-child(${i})`, (tr) => ({
      given: !!tr.querySelector(".given"), cells: [...tr.querySelectorAll("td")].map((t) => t.textContent) }));
    const rowCount = () => page.$$eval("#guess-rows tr:not(.is-empty)", (r) => r.length);
    const markers = () => page.$$eval("#nl-markers .nl-marker", (m) => m.map((x) => x.getAttribute("data-heavier")));
    const fits = async (where) => {
      const r = await page.evaluate(() => {
        const over = [...document.querySelectorAll(".stage > *, .bar > *, .col-right > *, .col-x > *")].filter((el) => {
          const b = el.getBoundingClientRect(); return b.bottom > innerHeight + 0.5 || b.right > innerWidth + 0.5;
        }).map((el) => el.className || el.id);
        const bar = document.querySelector(".bar"), tb = document.getElementById("table-box"), t = document.getElementById("guess-table");
        const p = document.getElementById("prompt").getBoundingClientRect();
        return { page: document.documentElement.scrollHeight - innerHeight, w: document.documentElement.scrollWidth - innerWidth,
          bar: bar.scrollWidth - bar.clientWidth, table: Math.max(t.scrollWidth - tb.clientWidth + 0, tb.scrollHeight - tb.clientHeight),
          promptTableOverlap: p.bottom > tb.getBoundingClientRect().top + 0.5, over };
      });
      check(r.page <= 0 && r.w <= 0 && r.bar <= 0 && r.table <= 1 && !r.promptTableOverlap && !r.over.length,
        `${tag} ${where}: fits, nothing scrolls, overlaps or is cut off (${JSON.stringify(r)})`);
    };
    const guess = async (x) => { await page.fill("#x-input", x); await page.press("#x-input", "Enter"); };
    const guessAndLand = async (x) => {
      await page.waitForFunction(() => !document.getElementById("x-input").disabled, null, { timeout: 5000 });
      await guess(x); await page.waitForTimeout(30); await arrived(); await page.waitForTimeout(30);
    };
    // the left x-box and one pan box, in screen pixels (the pan box may be smaller only if its pan is crowded)
    const boxes = () => page.evaluate(() => {
      const xb = document.getElementById("xbox").getBoundingClientRect();
      const pb = document.querySelector(".bon-pan [data-shape$='box'] rect");
      return { x: xb.width, xText: document.getElementById("xbox").textContent,
        pan: pb ? pb.getBoundingClientRect().width : 0, panText: pb ? pb.parentNode.getAttribute("data-label") : "" };
    });

    // ---- Equation 1 ----
    await page.goto(base + "index.html?reset=1");
    await page.waitForSelector("#coach:not([hidden])", { timeout: 5000 });
    check((await page.title()) === "What Makes It Balance?", `${tag}: title`);
    const r1 = await row(1);
    check(r1.given && r1.cells.join("|") === "1|5|8|Right heavier by 3 ▶", `${tag} #1: given guess 1 row: 1 | 5 | 8 | Right heavier by 3 ▶`);
    check(JSON.stringify(await markers()) === '["right"]', `${tag} #1: a ▶ marker on the number line`);
    check(!(await page.$(".eq-arrow")) && !(await page.$("[data-sub]")) && !(await page.$(".cards, .card-guess")),
      `${tag} #1: no label under the equation, no substitution lines, no cards`);
    check(await page.isDisabled("#x-slider") && (await page.isVisible("#slider-lock")), `${tag} #1: slider locked, labelled`);
    // number line: a label at every integer, none overlapping
    const labels = await page.$$eval(".nl-num", (n) => n.map((x) => ({ t: x.textContent, r: x.getBoundingClientRect().toJSON() })));
    const noOverlap = labels.every((a, i) => i === 0 || labels[i - 1].r.right + 2 <= a.r.left);
    check(labels.length === 21 && labels[0].t === `${M}10` && labels[20].t === "10" && noOverlap, `${tag}: number line labels all 21 integers, none overlapping`);
    // coach marks
    let steps = 0, ringsOk = true, coverBalance = false;
    const seen = [];
    while (!(await page.isHidden("#coach")) && steps < 10) {
      steps++;
      seen.push(await page.textContent("#coach-text"));
      const b = await page.$eval("#coach-bubble", (e) => e.getBoundingClientRect().toJSON());
      if (b.bottom > hgt || b.top < 0 || b.right > w) ringsOk = false;
      if (steps === 1) { await fits("coach marks"); await page.screenshot({ path: `${OUT}/${tag}-A1-coach.png` }); }
      await page.click("#coach-next");
    }
    check(steps === 6 && seen.some((t) => /table/.test(t)) && seen.some((t) => t.includes("This box is x")), `${tag} #1: six coach marks, ending on the table`);
    check(ringsOk, `${tag} #1: every coach callout is on screen`);

    const b1 = await boxes();
    check(b1.xText === "1" && b1.panText === "1" && Math.abs(b1.x - b1.pan) <= 1.5,
      `${tag} #1: at x = 1 the x-box and the pan boxes are the same size (${b1.x.toFixed(1)} vs ${b1.pan.toFixed(1)} px)`);
    // given guess 2: travel updates the balance and the left x-box on the way
    await page.click("#next-guess");
    const samples = new Set();
    for (let i = 0; i < 10; i++) {
      samples.add((await page.inputValue("#x-slider")) + "|" + (await page.textContent("#xbox")) + "|" + (await page.textContent('[data-total="left"]')));
      await page.waitForTimeout(40);
    }
    await arrived();
    check(samples.size >= 4, `${tag} #1: thumb travels; x-box and totals update on the way (${samples.size} states)`);
    check(await page.$eval("#x-slider", (s) => s.classList.contains("is-arrived")), `${tag} #1: thumb green on arrival`);
    check((await row(2)).cells.join("|") === "7|17|14|◀ Left heavier by 3", `${tag} #1: row 2: 7 | 17 | 14 | ◀ Left heavier by 3`);
    const tot = await page.evaluate(() => ["left", "right"].map((s) => document.querySelector(`[data-total="${s}"] text`).textContent));
    check(tot.join("|") === "17|14", `${tag} #1: totals 17 and 14 under the pans`);
    const bx = await boxes();
    check(bx.xText === "7" && bx.panText === "7" && bx.pan <= bx.x + 1, `${tag} #1: x-box and pan boxes both show 7`);

    // own guesses, the cue, refusals
    check(await page.isVisible("#cue") && (await page.textContent("#cue")) === "Type a value for x", `${tag} #1: cue "Type a value for x" by the box`);
    const cueBox = await page.$eval("#cue", (e) => e.getBoundingClientRect().toJSON());
    const balBox = await page.$eval("#balance-box", (e) => e.getBoundingClientRect().toJSON());
    check(cueBox.right <= balBox.left, `${tag} #1: the cue doesn't cover the balance`);
    check((await prompt()).includes("Guess 3 of 5"), `${tag} #1: prompt panel: Guess 3 of 5`);
    await page.fill("#x-input", "-");
    check(await page.isHidden("#cue"), `${tag} #1: the cue goes away when the student types`);
    check((await page.textContent("#x-msg")) === "Keep typing: that isn't a number yet.", `${tag} #1: "-" -> keep typing`);
    await guess("11");
    check((await page.textContent("#x-msg")) === `Try a value between ${M}10 and 10.`, `${tag} #1: 11 refused`);
    await guess("1");
    check((await page.textContent("#x-msg")) === "You already tried that one." && (await rowCount()) === 2, `${tag} #1: repeat refused, no row added`);
    await guessAndLand("4");
    check((await row(3)).cells[3] === "✓ Balanced", `${tag} #1: row 3: ✓ Balanced`);
    check((await prompt()).includes("That balances. Can you find a different value that also balances?"), `${tag} #1: second-value note in the prompt panel`);
    await guessAndLand("-1/2");
    check((await row(4)).cells.join("|") === `${M}1/2|2|13/2|Right heavier by 9/2 ▶`, `${tag} #1: fraction row: −1/2 | 2 | 13/2 | Right heavier by 9/2 ▶`);
    const neg = await boxes();
    check(neg.xText === `${M}1/2` && neg.panText === `${M}1/2`, `${tag} #1: x-box and pan boxes show −1/2`);
    check((await prompt()).match(/That balances/g).length === 1, `${tag} #1: note kept, shown once`);
    const ex = await page.evaluate(() => {
      const L = document.querySelector('[data-expr="left"]'), R = document.querySelector('[data-expr="right"]');
      const lt = document.querySelector('[data-total="left"]'), rt = document.querySelector('[data-total="right"]');
      return { l: L.textContent, colors: [...L.querySelectorAll("tspan")].map((t) => t.getAttribute("fill")),
        dy: [L.getBoundingClientRect().top - R.getBoundingClientRect().top, lt.getBoundingClientRect().top - rt.getBoundingClientRect().top],
        pans: [...document.querySelectorAll(".bon-pan")].map((p) => p.getAttribute("transform")),
        sub: document.body.textContent.includes("2(" + "−" + "1/2)") };
    });
    check(ex.l === "2x + 3" && ex.colors[0] === "#1F5FBF" && ex.colors[1] === "#1E7A36", `${tag} #1: "2x + 3": 2x blue, + 3 green`);
    check(ex.pans.every((t) => /^translate\(/.test(t)) && Math.abs(ex.dy[0]) > 5 && Math.abs(ex.dy[0] - ex.dy[1]) < 1,
      `${tag} #1: expressions and totals ride with the pans, level (translate only)`);
    check(!ex.sub, `${tag} #1: no substitution line anywhere`);
    await fits("note and four rows");
    await guessAndLand("10");
    check((await row(5)).cells.join("|") === "10|23|17|◀ Left heavier by 6", `${tag} #1: row 5`);
    const big = await boxes();
    check(big.x > big.pan + 5, `${tag} #1: at x = 10 the crowded pan shrinks its boxes but the x-box keeps the true size (${big.x.toFixed(0)} > ${big.pan.toFixed(0)} px)`);
    check((await prompt()).includes("Five guesses done"), `${tag} #1: after five guesses, Predict is next`);
    check(JSON.stringify(await markers()) === '["right","left","balanced","right","left"]', `${tag} #1: five markers`);
    check(await page.$$eval("#nl-markers .nl-marker", (ms) => { const r = ms.map((m) => m.getBoundingClientRect());
      return r.every((a, i) => r.every((b, j) => i >= j || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)); }),
      `${tag} #1: markers don't cover each other`);
    await fits("five rows");
    await page.screenshot({ path: `${OUT}/${tag}-A2-five-guesses.png` });
    check(!/\d\.\d{3,}|NaN|undefined/.test(await page.textContent("body")), `${tag}: no float artifacts or NaN on screen`);
    await page.reload(); await page.waitForSelector("#guess-rows tr");
    check((await rowCount()) === 5 && (await page.isHidden("#coach")), `${tag}: refresh keeps the table; no coach marks`);
    await page.click("#help");
    check(!(await page.isHidden("#coach")), `${tag}: "?" replays the coach marks`);
    await page.keyboard.press("Escape");

    // ---- with reduced motion: #3, #2, #9, the never/always equations ----
    const rm = await browser.newPage({ viewport: { width: w, height: hgt }, reducedMotion: "reduce" });
    rm.on("pageerror", (e) => errors.push(e.message));
    const rmGuess = async (x) => { await rm.fill("#x-input", x); await rm.press("#x-input", "Enter"); };
    const rmHeavier = async () => rm.$eval("#guess-rows tr:not(.is-empty):last-of-type", (tr) => tr.getAttribute("data-heavier")).catch(async () =>
      rm.$$eval("#guess-rows tr:not(.is-empty)", (t) => t[t.length - 1].getAttribute("data-heavier")));
    const lastRow = () => rm.$$eval("#guess-rows tr:not(.is-empty)", (t) => [...t[t.length - 1].querySelectorAll("td")].map((c) => c.textContent));
    const rmMarkers = () => rm.$$eval("#nl-markers .nl-marker", (m) => m.map((x) => x.getAttribute("data-heavier")));
    await rm.goto(base + "index.html?reset=1&all=1&eq=3"); await rm.waitForSelector("#guess-rows tr:not(.is-empty)");
    check((await rm.textContent("#eq-display")).replace(/\s+/g, " ").trim() === "x + 5 = 4x + 1", `${tag} #3: x + 5 = 4x + 1`);
    check((await lastRow()).join("|") === "0|5|1|◀ Left heavier by 4", `${tag} #3: given x = 0 -> ◀ Left heavier by 4`);
    await rm.click("#next-guess");
    check((await lastRow()).join("|") === "3|8|13|Right heavier by 5 ▶" && (await rm.inputValue("#x-slider")) === "3",
      `${tag} #3: given x = 3 -> Right heavier by 5 ▶; thumb jumps (reduced motion)`);
    await rmGuess("1.33");
    check((await lastRow())[3] === "◀ Left heavier by 0.01" && Math.abs(parseFloat(await rm.getAttribute("#balance", "data-target-angle"))) >= 4,
      `${tag} #3: 1.33 -> ◀ Left heavier by 0.01, beam still tips at least 4°`);
    await rmGuess("1.34");
    check((await lastRow())[3] === "Right heavier by 0.02 ▶", `${tag} #3: 1.34 -> Right heavier by 0.02 ▶`);

    await rm.goto(base + "index.html?reset=1&all=1&eq=2"); await rm.waitForSelector("#next-guess");
    await rm.click("#next-guess"); await rmGuess("-3");
    const shapes = (side) => rm.$$eval(`.bon-pan[data-side=${side}] [data-shape]`, (els) => els.map((e) => e.dataset.shape + ":" + e.dataset.label));
    check(JSON.stringify(await shapes("left")) === JSON.stringify([`float-box:${M}3`, `float-box:${M}3`, `float-box:${M}3`, "weight:+2"]) &&
      JSON.stringify(await shapes("right")) === JSON.stringify([`float-box:${M}3`, `balloon:${M}4`]) &&
      (await lastRow()).join("|") === `${M}3|${M}7|${M}7|✓ Balanced`, `${tag} #2 at −3: floating boxes, −4 balloon, both −7, ✓ Balanced`);
    await rmGuess("-1/3");
    check((await lastRow()).join("|") === `${M}1/3|1|${M}13/3|◀ Left heavier by 16/3`, `${tag} #2 at −1/3: heavier column right for a negative fraction`);
    await rm.screenshot({ path: `${OUT}/${tag}-A3-eq2.png` });

    await rm.goto(base + "index.html?reset=1&all=1&eq=9"); await rm.waitForSelector("#x-input:not([disabled])");
    check((await rm.$$("#guess-rows tr:not(.is-empty)")).length === 0, `${tag} #9: no given guesses`);
    await rmGuess("0");
    check((await rm.$$eval('[data-shape="zero-box"] rect', (r) => r.length === 3 && r.every((x) => x.getAttribute("stroke-dasharray")))) &&
      (await lastRow()).join("|") === "0|4|4|✓ Balanced" && (await rm.$eval("#xbox", (b) => b.classList.contains("is-zero"))),
      `${tag} #9 at 0: dashed 0 boxes (pans and x-box), 4 and 4, ✓ Balanced`);
    check(!!(await rm.$(".eqn--emphasis")), `${tag} #9: Part 2 x-terms tinted`);

    for (const [id, want] of [[4, "right"], [5, "left"], [8, "right"], [6, "balanced"], [7, "balanced"], [10, "balanced"]]) {
      await rm.goto(base + `index.html?reset=1&all=1&eq=${id}`); await rm.waitForSelector("#x-input:not([disabled])");
      for (const x of ["-10", "-2.5", "0", "1/3", "10"]) await rmGuess(x);
      const mk = await rmMarkers();
      check(mk.length === 5 && mk.every((m) => m === want), `${tag} #${id}: markers all ${want}`);
    }
    await rm.screenshot({ path: `${OUT}/${tag}-A4-eq10-always.png` });
    check(errors.length === 0, `${tag}: no script errors ${errors.join("; ")}`);
    await rm.close();
    await page.close();
  }
};
