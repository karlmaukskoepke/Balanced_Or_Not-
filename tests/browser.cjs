// Real-browser checks (spec v3, Stage 1) at 1366 x 650 and 1366 x 768. Run: node tests/browser.cjs [outDir]
// Serves the folder itself (Playwright must be installed). Covers the section 13 cases that apply to Stage 1.
const http = require("http"), fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.log("browser: SKIP (no Playwright)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."), OUT = process.argv[2] || path.join(ROOT, "docs", "screens");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".pdf": "application/pdf" };
const M = "−";
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  fs.readFile(p.endsWith("/") ? p + "index.html" : p, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" }); res.end(data);
  });
});
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok  " : "  FAIL ") + msg); if (!ok) fails++; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const [w, hgt] of [[1366, 650], [1366, 768]]) {
    const tag = `${w}x${hgt}`;
    const page = await browser.newPage({ viewport: { width: w, height: hgt }, reducedMotion: "reduce" });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const rel = () => page.getAttribute("#rel", "data-rel").then((r) => (page.$eval("#rel", (e) => e.textContent ? e.getAttribute("data-rel") : "")));
    const tots = () => page.evaluate(() => [document.getElementById("tot-left").textContent, document.getElementById("tot-right").textContent]);
    const angle = async () => parseFloat(await page.getAttribute("#balance", "data-target-angle"));
    const type = async (x) => { await page.fill("#x-input", x); await page.press("#x-input", "Enter"); };
    const testEq = async (id, x) => { await page.goto(base + `balance-test.html?eq=${id}` + (x !== undefined ? `&x=${encodeURIComponent(x)}` : "")); await page.waitForSelector("[data-expr]"); };
    const shapes = (side) => page.$$eval(`[data-side=${side}] [data-shape]`, (els) => els.map((e) => e.dataset.shape + ":" + e.dataset.label));
    const fits = async (where) => {
      const r = await page.evaluate(() => {
        const over = [...document.querySelectorAll(".stage > *, .bar > *, .col-center > *, .col-slide > *")].filter((el) => {
          const b = el.getBoundingClientRect(); return b.height && (b.bottom > innerHeight + 0.5 || b.right > innerWidth + 0.5);
        }).map((el) => el.className || el.id);
        return { page: document.documentElement.scrollHeight - innerHeight, w: document.documentElement.scrollWidth - innerWidth, over };
      });
      check(r.page <= 0 && r.w <= 0 && !r.over.length, `${tag} ${where}: fits, nothing scrolls or is cut off (${JSON.stringify(r)})`);
    };

    // ---- the left x-box and the pan x-boxes: identical rendered sizes ----
    for (const v of ["-6", "-1", "0", "0.5", "1", "6"]) {
      await testEq(1, v);
      const s = await page.evaluate(() => {
        const xb = document.getElementById("xbox").getBoundingClientRect();
        const pans = [...document.querySelectorAll("[data-side] [data-shape$='box'] [data-measure], [data-side] [data-shape='x-balloon'] [data-measure]")]
          .map((r) => r.getBoundingClientRect().width);
        return { x: xb.width, pans };
      });
      const same = s.pans.length === 3 && s.pans.every((p) => Math.abs(p - s.x) <= 0.75);
      check(same, `${tag}: x = ${v}: the left x-box and all 3 pan x-boxes are the same size (${s.x.toFixed(2)} vs ${s.pans.map((p) => p.toFixed(2)).join(", ")} px)`);
    }

    // ---- #3 flipped ----
    await testEq(3, "0");
    check((await rel()) === ">" && (await angle()) < 0, `${tag} #3 at 0: left heavier (>)`);
    await type("3");
    check((await rel()) === "<" && (await angle()) > 0, `${tag} #3 at 3: right heavier (<)`);
    await type("1.3");
    await page.focus(".vs-thumb");
    let sawEq = false;
    for (let i = 0; i < 12; i++) { await page.keyboard.press("ArrowUp"); if ((await rel()) === "=") sawEq = true; }
    check(!sawEq && (await page.getAttribute(".vs-thumb", "aria-valuenow")) === "1.42", `${tag} #3: nudging 1.30 -> 1.42 by 0.01 never reaches =`);
    // drag slowly across 1.2 .. 1.5
    const tr = await page.$eval(".vs-track", (t) => t.getBoundingClientRect().toJSON());
    const yFor = (v) => tr.top + 14 + (tr.height - 28) * (6 - v) / 12;
    await page.mouse.move(tr.left + 52, yFor(1.2)); await page.mouse.down();
    for (let y = yFor(1.2); y >= yFor(1.5); y -= 0.5) { await page.mouse.move(tr.left + 52, y); if ((await rel()) === "=") sawEq = true; }
    await page.mouse.up();
    check(!sawEq, `${tag} #3: dragging across 1.2–1.5 never reaches =`);
    await type("4/3");
    const eqStyle = await page.$eval("#rel", (r) => getComputedStyle(r, "::before").backgroundImage);
    check((await rel()) === "=" && /gradient/.test(eqStyle) && (await tots()).join("|") === "19/3|19/3", `${tag} #3: typing 4/3 reaches the gold = (19/3 and 19/3)`);
    await page.screenshot({ path: `${OUT}/${tag}-eq3-four-thirds.png` });

    // ---- the beam keeps responding all the way to the solution (section 13) ----
    await testEq(1, "3");
    const tilts = [];
    for (const v of ["3", "3.5", "3.9", "3.99", "4"]) { await type(v); tilts.push(Math.abs(await angle())); }
    check(tilts.every((t, i) => i === 0 || t < tilts[i - 1]) && tilts[3] > 0 && tilts[4] === 0,
      `${tag} #1 at 3, 3.5, 3.9, 3.99, 4: tilt ${tilts.map((t) => t.toFixed(2)).join(" > ")} (level only at 4)`);
    for (const [id, vals] of [[2, ["-2", "-2.5", "-2.9", "-2.99", "-3"]], [3, ["2", "1.5", "1.4", "1.34", "4/3"]], [9, ["1", "0.5", "0.1", "0.01", "0"]], [12, ["5", "4.5", "4.1", "4.01", "4"]]]) {
      await testEq(id, vals[0]);
      const ts = [];
      for (const v of vals) { await type(v); ts.push(Math.abs(await angle())); }
      check(ts.every((t, i) => i === 0 || t < ts[i - 1]) && ts[3] > 0 && ts[4] === 0 && (await rel()) === "=",
        `${tag} #${id}: ${vals.join(", ")}: tilt keeps shrinking, gold = at ${vals[4]}`);
    }

    // ---- #9 at 0, #2 at −3 ----
    await testEq(9, "0");
    const zb = await page.$$eval("[data-shape='zero-box'] rect", (r) => r.map((x) => x.getAttribute("stroke-dasharray")));
    check(zb.length === 3 && zb.every(Boolean) && (await tots()).join("|") === "4|4" && (await rel()) === "=", `${tag} #9 at 0: dashed 0 boxes, 4 and 4, gold =`);
    await testEq(2, "-3");
    const L = await shapes("left"), R = await shapes("right");
    check((await tots()).join("|") === `${M}7|${M}7` && L.filter((s) => s.startsWith("x-balloon")).length === 3 &&
      R.includes(`balloon:${M}4`) && R.includes(`x-balloon:${M}3`), `${tag} #2 at −3: both −7; x-balloons on the left; −4 balloon and an x-balloon on the right`);
    await page.screenshot({ path: `${OUT}/${tag}-eq2-minus3.png` });

    // ---- never / always ----
    for (const id of [4, 5, 8, 11, 6, 7, 10]) {
      await testEq(id, "-6");
      const rels = new Set(), angles = new Set();
      for (const v of ["-6", "-2.5", "-1", "0", "1/3", "2", "4.75", "6"]) { await type(v); rels.add(await rel()); angles.add(await angle()); }
      if ([4, 5, 8, 11].includes(id)) check(!rels.has("=") && angles.size === 1, `${tag} #${id}: never =, one constant tilt (${[...rels].join("")})`);
      else check(rels.size === 1 && rels.has("=") && angles.has(0) && angles.size === 1, `${tag} #${id}: always =, level`);
    }

    // ---- balloons straight up, never over the equation, at the extremes ----
    let straight = true, clear = true;
    for (const id of [2, 5, 6, 11, 12]) for (const v of ["-6", "6"]) {
      await testEq(id, v);
      const r = await page.evaluate(() => {
        const eqBox = document.getElementById("eq-display").getBoundingClientRect();
        return [...document.querySelectorAll("[data-shape='balloon'], [data-shape='x-balloon']")].map((b) => {
          const line = b.querySelector("[data-string]"), body = b.querySelector("[data-measure]").getBoundingClientRect();
          return { straight: line.getAttribute("x1") === line.getAttribute("x2"), top: body.top, eqBottom: eqBox.bottom };
        });
      });
      if (!r.every((b) => b.straight)) straight = false;
      if (!r.every((b) => b.top >= b.eqBottom)) clear = false;
    }
    check(straight, `${tag}: every balloon string is vertical`);
    check(clear, `${tag}: no balloon overlaps the equation at x = −6 or 6`);
    await testEq(12, "-6");
    await page.screenshot({ path: `${OUT}/${tag}-eq12-minus6.png` });

    // ---- the slider: snap, release, keys ----
    await testEq(1, "0");
    const tr2 = await page.$eval(".vs-track", (t) => t.getBoundingClientRect().toJSON());
    const y2 = (v) => tr2.top + 14 + (tr2.height - 28) * (6 - v) / 12;
    const val = () => page.getAttribute(".vs-thumb", "aria-valuenow");
    await page.mouse.move(tr2.left + 52, y2(0)); await page.mouse.down();
    await page.mouse.move(tr2.left + 52, y2(2.08)); const snapped = await val();
    await page.mouse.move(tr2.left + 52, y2(2.3)); const released = await val();
    await page.mouse.up();
    check(snapped === "2.00" && Math.abs(parseFloat(released) - 2.3) < 0.05, `${tag}: drag snaps to 2 near 2.08 (${snapped}) and lets go by 2.3 (${released})`);
    await type("1");
    await page.focus(".vs-thumb");
    await page.keyboard.press("ArrowUp"); const a1 = await val();
    await page.keyboard.press("Shift+ArrowUp"); const a2 = await val();
    await page.keyboard.press("PageUp"); const a3 = await val();
    await page.keyboard.press("ArrowDown"); const a4 = await val();
    check(a1 === "1.01" && a2 === "1.11" && a3 === "2.11" && a4 === "2.10", `${tag}: keys: ↑ 0.01, Shift+↑ 0.1, PageUp 1, ↓ 0.01 (${[a1, a2, a3, a4].join(", ")})`);
    check((await page.textContent("#tot-left")) === "7.2", `${tag}: totals follow the keys (2(2.1) + 3 = 7.2)`);
    await type("7");
    check((await page.textContent("#x-msg")) === `Try a value between ${M}6 and 6.`, `${tag}: typed 7 is refused`);
    await type("-1/2");
    check((await page.textContent("#xbox")) === `${M}1/2` && (await tots()).join("|") === "2|13/2", `${tag}: typed −1/2: x-box shows −1/2, totals 2 and 13/2`);

    // ---- the slider column stands apart from the balance; a negative x floats just beside its slot ----
    for (const pageName of ["balance-test.html?eq=12&x=", "index.html?all=1&eq=12&x="]) {
      for (const v of ["-6", "-1", "0", "6"]) {
        if (pageName.startsWith("index")) { await page.goto(base + "balance-test.html?eq=12&x=" + v); }
        else await testEq(12, v);
        const r = await page.evaluate(() => {
          const R = (e) => e.getBoundingClientRect();
          const col = R(document.querySelector(".col-slide")), xb = R(document.getElementById("xbox"));
          const slot = R(document.querySelector(".vs-slot")), bal = R(document.getElementById("balance"));
          const vb = document.getElementById("balance").viewBox.baseVal, k = Math.min(bal.width / vb.width, bal.height / vb.height);
          const drawLeft = bal.left + (bal.width - vb.width * k) / 2;
          const hit = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
          const nums = [...document.querySelectorAll(".vs-num")].map(R);
          const form = [...document.querySelectorAll(".x-form > *")].map(R);
          return { inside: xb.left >= col.left && xb.right <= col.right && xb.top >= col.top,
            gap: drawLeft - col.right, beside: xb.left - slot.left, onLabels: nums.some((n) => hit(n, xb)),
            formInside: form.every((f) => f.right <= col.right - 2), balloon: document.getElementById("xbox").classList.contains("is-balloon") };
        });
        check(r.inside && !r.onLabels && r.formInside && r.gap >= 40,
          `${tag} x = ${v}: the x-box stays in the slider column, off the labels; the balance starts ${Math.round(r.gap)} px to the right`);
        if (v.startsWith("-")) check(r.balloon && r.beside >= 8 && r.beside <= 20, `${tag} x = ${v}: the balloon sits just beside the slot (${Math.round(r.beside)} px), not far right`);
        await fits(`x = ${v}`);
      }
      break; // both pages share the same screen; the test page covers it
    }

    // ---- busiest balance: five boxes and a ball on one pan, a balloon on the other ----
    for (const [id, v] of [[8, "6"], [12, "6"], [12, "-6"], [5, "-6"]]) {
      await testEq(id, v);
      await fits(`#${id} at ${v}`);
    }
    await testEq(8, "6");
    await page.screenshot({ path: `${OUT}/${tag}-eq8-six.png` });
    const allText = await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const o = []; while (w.nextNode()) o.push(w.currentNode.nodeValue); return o; });
    check(allText.every((t) => !/\d\.\d{3,}|NaN|undefined/.test(t)), `${tag}: no float artifacts in any text on screen`);
    check(!(await page.$("[data-sub], .guess-table, .nl-marker, .sortbar, .eq-arrow")), `${tag}: no substitution lines, table, markers, sort bar or label under the equation`);

    // ---- the student page: Build, Slide, Check, Solve, Compare, reflection breaks, Part 3, completion ----
    page.on("dialog", (d) => d.accept());
    const stepNow = () => page.getAttribute('#steps li[aria-current="step"]', "data-step");
    const stopText = () => page.$eval("#stop", (s) => s.hidden ? "" : s.textContent);
    const click = async (side, act, times = 1) => { for (let i = 0; i < times; i++) await page.click(`.palette[data-side=${side}] [data-act=${act}]`); };
    const slideThree = async () => { for (const v of ["1", "-2", "3"]) await type(v); await page.click("#enough-btn"); };
    const finishTo = async (cat) => { await page.click(`#prompt [data-cat=${cat}]`); await page.click("#solved-btn"); };
    await page.goto(base + "index.html");          // a fresh computer: the start screen
    await page.waitForSelector("#stop:not([hidden])");
    check((await stopText()).includes("Where is your group starting?") && (await stopText()).includes("Start at the first equation anyone in your group hasn\u2019t finished.") &&
      (await page.$$("#stop [data-start]")).length === 12 && (await page.textContent("#start-go")) === "Start at #1",
      `${tag}: start screen: "Where is your group starting?", twelve choices, default #1`);
    await fits("start screen");
    await page.screenshot({ path: `${OUT}/${tag}-start.png` });
    // teacher reset: saved progress (this version and an older one) is cleared, ?reset leaves the address, #1 opens
    await page.evaluate(() => {
      localStorage.setItem("what-makes-it-balance-v3", JSON.stringify({ current: 6, coachSeen: true, finished: true,
        eqs: { 1: { built: true, solved: true, positions: [], slid: true, check: { done: true, wrongs: 0 }, p3: { done: false, wrongs: 0 } } }, reflections: { 7: true } }));
      localStorage.setItem("what-makes-it-balance-v2", "{}");
    });
    const navs = [];
    const onLoad = () => navs.push(1); page.on("load", onLoad);
    await page.goto(base + "index.html?reset");
    await page.waitForSelector("#coach:not([hidden])");
    await page.waitForTimeout(150);
    const rs = await page.evaluate(() => {
      const v3 = JSON.parse(localStorage.getItem("what-makes-it-balance-v3") || "null");
      return { search: location.search, v2: localStorage.getItem("what-makes-it-balance-v2"),
        solved: !!(v3 && v3.eqs && v3.eqs[1] && v3.eqs[1].solved), reflections: v3 ? Object.keys(v3.reflections).length : 0,
        stop: document.getElementById("stop").hidden, eq: document.getElementById("eq-number").textContent };
    });
    check(rs.search === "" && rs.v2 === null && !rs.solved && rs.reflections === 0 && rs.stop && rs.eq === "1" && navs.length === 1,
      `${tag}: ?reset clears all saved progress, leaves the address bar without reloading, opens #1 (${JSON.stringify(rs)}, ${navs.length} load)`);
    page.off("load", onLoad);
    let n = 0; const texts = [];
    while (!(await page.isHidden("#coach")) && n < 10) { n++; texts.push(await page.textContent("#coach-text")); if (n === 1) await fits("coach marks"); await page.click("#coach-next"); }
    check(n === 6 && texts.some((t) => /build/i.test(t)) && texts.some((t) => /heavier at the top/.test(t)), `${tag} #1: six coach marks`);
    check((await stepNow()) === "build" && (await page.$$(".eqstrip .eqpick")).length === 12, `${tag} #1: Build; twelve numbered equations in the top strip`);
    check((await page.textContent("#prompt .prompt-driver")) === "Driver: switch this equation", `${tag} #1: "Driver: switch this equation" on a new equation`);
    await click("left", "x", 2); await click("left", "plus", 3); await click("right", "x"); await click("right", "minus");
    check((await angle()) === 0, `${tag} #1: the beam stays level while building`);
    await page.click("#built-btn");
    check((await page.textContent("#prompt .prompt-msg")) === "Look at the right side again." && (await stepNow()) === "build", `${tag} #1: a wrong model is refused without the answer`);
    await page.click('[data-side="right"] [data-shape="balloon"]');
    await click("right", "plus", 7);
    await fits("building");
    await page.click("#built-btn");
    check((await stepNow()) === "slide", `${tag} #1: the right model is accepted`);
    await page.focus(".vs-thumb"); await page.keyboard.press("PageUp"); await page.keyboard.press("PageUp");
    check(!(await page.$("#enough-btn")), `${tag} #1: no "I've seen enough" after two positions`);
    await type("4");
    check((await rel()) === "=" && !!(await page.$("#enough-btn")), `${tag} #1: gold = at 4; "I've seen enough" after three positions`);
    check((await page.textContent("#prompt .prompt-group")) === "Talk it over: what do you see? Agree as a group, then tap.", `${tag} #1: Slide asks the group to agree`);
    await page.click("#enough-btn");
    const words = await page.$$eval("#prompt [data-cat]", (b) => b.map((x) => x.textContent));
    check((await stepNow()) === "check" && (await page.textContent("#prompt .prompt-q")) === "What did the slider show? Agree as a group first." &&
      words.join("|") === "Sometimes balanced|Always balanced|Never balanced", `${tag} #1: the one-tap check: Sometimes / Always / Never balanced`);
    // wrong answer: everything dims except the slider
    await page.click("#prompt [data-cat=never]");
    const spot = await page.evaluate(() => {
      const veil = document.getElementById("veil"), col = document.querySelector(".col-slide").getBoundingClientRect();
      const pr = document.getElementById("prompt").getBoundingClientRect(), bal = document.getElementById("balance-box").getBoundingClientRect();
      const at = (x, y) => document.elementFromPoint(x, y);
      return { veil: !veil.hidden, msg: document.getElementById("spot-msg").textContent,
        promptCovered: at(pr.left + pr.width / 2, pr.top + 20) === veil, balanceCovered: at(bal.left + bal.width / 2, bal.top + bal.height / 2) === veil,
        sliderLit: document.querySelector(".col-slide").contains(at(col.left + col.width / 2, col.top + col.height / 2)),
        disabled: [...document.querySelectorAll("#prompt [data-cat]")].every((b) => b.disabled) };
    });
    check(spot.veil && spot.msg === "Check the slider again." && spot.promptCovered && spot.balanceCovered && spot.sliderLit && spot.disabled,
      `${tag} #1: wrong check: everything dims except the slider, "Check the slider again." (${JSON.stringify(spot)})`);
    check(!/Sometimes balanced is|the answer/i.test(await page.textContent("#prompt")), `${tag} #1: the wrong check doesn't give the answer`);
    await page.screenshot({ path: `${OUT}/${tag}-check-again.png` });
    await page.focus(".vs-thumb"); await page.keyboard.press("ArrowUp");
    check(await page.isHidden("#veil") && !(await page.isDisabled("#prompt [data-cat=one]")), `${tag} #1: using the slider relights the screen and reopens the question`);
    await page.click("#prompt [data-cat=one]");
    // Solve stop screen
    check((await stepNow()) === "solve" && (await stopText()).includes("Solve #1 together on your whiteboard.") &&
      (await stopText()).includes("Then everyone copies it onto their own sheet") && (await stopText()).includes("when your group has an answer") && (await page.textContent("#stop .eq-number")) === "1" &&
      (await page.$eval("#stop .eqline", (e) => e.textContent.replace(/\s+/g, " ").trim())) === "2x + 3 = x + 7", `${tag} #1: Solve stop screen: the equation large with its number`);
    await fits("solve screen");
    await page.screenshot({ path: `${OUT}/${tag}-solve.png` });
    await page.click("#solved-btn");
    // Compare
    check((await page.textContent("#col-box")).includes("Decide as a group: which column?") && !(await page.textContent("#col-box")).includes("One solution"),
      `${tag} #1: Compare asks "Decide as a group: which column?" before showing it`);
    await page.click("#col-btn");
    const work = await page.$$eval("#prompt .work > span", (s) => s.map((x) => x.textContent));
    check((await stepNow()) === "compare" && work.join(" ").includes("+ (−x)") && work.join(" ").includes("x + 3 = 7") &&
      (await page.textContent("#prompt")).includes("Check: 2(4) + 3 = 11 and 4 + 7 = 11") && (await page.textContent(".prompt-col")).includes("One solution"),
      `${tag} #1: Compare: worked steps, the check line, "Write this equation under One solution"`);
    check(!(await page.$("[data-countdown], .countdown")) && !(await page.isDisabled("#next-eq")), `${tag} #1: no timer; Next is ready`);
    await page.click("#next-eq");
    check((await page.textContent("#eq-number")) === "2" && (await stepNow()) === "build", `${tag}: Next goes to #2 (no reflection break after #1)`);
    check(await page.$eval('.eqpick[aria-label^="Equation 1"]', (b) => b.classList.contains("is-done")), `${tag}: #1 is marked done in the strip`);
    // saved progress
    await page.reload(); await page.waitForSelector("#stop:not([hidden])");
    check((await stopText()).includes("Where is your group starting?") && (await page.textContent("#start-go")) === "Start at #2" &&
      await page.$eval('#stop [data-start="1"]', (b) => b.classList.contains("is-done")), `${tag}: after a refresh: the start screen defaults to #2 (last opened); #1 shows done`);
    await page.click("#start-go");
    check((await page.textContent("#eq-number")) === "2", `${tag}: Continue at #2 opens #2`);
    // the strip: any equation is clickable; each keeps its own progress
    await page.click('.eqpick[aria-label^="Equation 7"]');
    check((await page.textContent("#eq-number")) === "7" && (await page.textContent("#prompt")).includes("Look at the model"), `${tag}: the strip opens #7 directly`);
    await page.click("#continue-btn"); await slideThree();
    await page.click('.eqpick[aria-label^="Equation 1"]');
    check((await stepNow()) === "compare", `${tag}: #1 still shows its Compare step`);
    await page.click('.eqpick[aria-label^="Equation 7"]');
    check((await stepNow()) === "check", `${tag}: #7 kept its progress (at the check)`);
    await finishTo("always");
    await page.click("#next-eq");
    const r7 = await stopText();
    check(r7.includes("Turn to your reflection page.") && r7.includes("Talk it over as a group, then everyone writes.") && r7.includes("Do prompts 1 and 2.") &&
      r7.includes("Look at the equations in your “No solutions” column. What is the same about the two sides? What is different?") &&
      r7.includes("If the equation is balanced no matter what value of x we choose on the slider, then ANY value seems to balance the equation. How many possible solutions are there for these types of equations?"),
      `${tag}: after #7: reflection break with prompts 1 and 2`);
    await fits("reflection break");
    await page.click("#reflect-done");
    check((await page.textContent("#eq-number")) === "8", `${tag}: Done, continue -> #8`);
    // Part 3: #11
    await page.click('.eqpick[aria-label^="Equation 11"]');
    check(await page.$eval(".vs", (v) => v.classList.contains("is-disabled")) && (await page.isDisabled("#x-input")) &&
      await page.$eval(".vs-host", (v) => v.classList.contains("is-broken")), `${tag} #11: slider and typed box disabled (broken)`);
    await page.click("#continue-btn");
    check((await stepNow()) === "check" && (await page.$$("#prompt [data-reason]")).length === 3, `${tag} #11: predict a category and pick one of three reasons`);
    await page.click("#prompt [data-cat=always]"); await page.click('#prompt [data-reason="same-same"]'); await page.click("#predict-btn");
    const ce = await page.textContent(".counter");
    check(/Count the x.s and the plain numbers/.test(ce) && /#\d+|Here is one you did/.test(ce) && /Its slider showed:/.test(ce) &&
      !/same number of x|the rule|means never|means always/i.test(ce), `${tag} #11: wrong reasoning -> a counterexample, no rule: "${ce.replace(/\s+/g, " ")}"`);
    await fits("Part 3 counterexample");
    await page.screenshot({ path: `${OUT}/${tag}-part3.png` });
    await page.click("#prompt [data-cat=never]"); await page.click('#prompt [data-reason="same-diff"]'); await page.click("#predict-btn");
    check((await stopText()).includes("Solve #11 together on your whiteboard."), `${tag} #11: the right prediction -> Solve`);
    await page.click("#solved-btn");
    await page.click("#col-btn");
    check((await page.textContent("#prompt")).includes("never true") && (await page.textContent(".prompt-col")).includes("No solutions"), `${tag} #11: Compare steps`);
    // #12 then the last reflection and the completion screen
    await page.click("#next-eq");
    await page.click("#continue-btn");
    await page.click("#prompt [data-cat=one]"); await page.click('#prompt [data-reason="diff"]'); await page.click("#predict-btn");
    await page.click("#solved-btn");
    await fits("Compare with the longest steps (#12)");
    await page.screenshot({ path: `${OUT}/${tag}-compare12.png` });
    await page.click("#next-eq");
    const r12 = await stopText();
    check(r12.includes("Do prompts 5a, 5b and 5c.") && r12.includes("How can you tell just by looking that an equation has no solutions?"), `${tag}: after #12: prompts 5a, 5b, 5c`);
    await fits("reflection 5a-5c");
    await page.click("#reflect-done");
    const rows = await page.$$eval("#stop .results tbody tr", (t) => t.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent)));
    check(rows.length === 12 && rows[0][1] === "One solution" && /Not the first time/.test(rows[0][2]) && /Yes/.test(rows[6][2]) &&
      /Not the first time/.test(rows[10][2]) && /Yes/.test(rows[11][2]) && /not done/.test(rows[1][2]),
      `${tag}: completion screen: category and first-try result for all 12`);
    await fits("completion screen");
    await page.screenshot({ path: `${OUT}/${tag}-completion.png` });
    // the busiest Compare for a Part 1 equation (#2: three steps)
    await page.click("#results-close");
    await page.click('.eqpick[aria-label^="Equation 2"]');
    await click("left", "x", 3); await click("left", "plus", 2); await click("right", "x"); await click("right", "minus", 4);
    await page.click("#built-btn"); await slideThree(); await finishTo("one");
    await fits("Compare #2 (three steps)");
    // start over
    // the bridge to "infinite" on #6
    await page.click('.eqpick[aria-label^="Equation 6"]');
    await page.click("#continue-btn"); await slideThree(); await finishTo("always");
    const kids = await page.$$eval("#prompt > *", (k) => k.map((e) => e.className));
    check(kids[0] === "bridge" && (await page.textContent("#prompt .bridge")).includes("Name three values of x that work. Could you name them all? How many are there?") &&
      kids.indexOf("bridge") < kids.indexOf("work-wrap"), `${tag} #6: "Talk with your group" bridge before the worked steps`);
    await fits("#6 bridge and steps");
    await page.screenshot({ path: `${OUT}/${tag}-bridge6.png` });
    await page.evaluate(() => localStorage.setItem("what-makes-it-balance-v2", "{}"));
    await page.click("#start-over");
    const so = await page.evaluate(() => {
      const v3 = JSON.parse(localStorage.getItem("what-makes-it-balance-v3") || "null");
      return { v2: localStorage.getItem("what-makes-it-balance-v2"), solved: v3 ? Object.values(v3.eqs).filter((r) => r.solved).length : 0,
        reflections: v3 ? Object.keys(v3.reflections).length : 0 };
    });
    check((await page.textContent("#eq-number")) === "1" && (await stepNow()) === "build" && !(await page.$(".eqstrip .eqpick.is-done")) &&
      so.v2 === null && so.solved === 0 && so.reflections === 0, `${tag}: Start over clears the same saved data as ?reset (${JSON.stringify(so)})`);
    await page.reload(); await page.waitForSelector("#stop:not([hidden])");
    check((await page.textContent("#start-go")) === "Start at #1" && !(await page.$("#stop .is-done")), `${tag}: after Start over, the start screen shows nothing done`);
    check(errors.length === 0, `${tag}: no script errors ${errors.join("; ")}`);
    await page.close();
  }

  // live dragging updates on every input (motion allowed)
  const live = await browser.newPage({ viewport: { width: 1366, height: 650 }, reducedMotion: "no-preference" });
  await live.goto(base + "balance-test.html?eq=1&x=0"); await live.waitForSelector("[data-expr]");
  const t = await live.$eval(".vs-track", (e) => e.getBoundingClientRect().toJSON());
  await live.mouse.move(t.left + 52, t.top + t.height / 2); await live.mouse.down();
  const seen = new Set();
  for (let i = 1; i <= 8; i++) { await live.mouse.move(t.left + 52, t.top + t.height / 2 - i * 17); seen.add(await live.textContent("#tot-left") + await live.getAttribute("#balance", "data-target-angle")); }
  await live.mouse.up();
  check(seen.size >= 6, `live: totals and beam follow the drag (${seen.size} states)`);
  await live.fill("#x-input", "-5"); await live.press("#x-input", "Enter");
  await live.waitForTimeout(120);
  const mid = await live.getAttribute(".vs-thumb", "aria-valuenow");
  await live.waitForTimeout(1100);
  const end = await live.getAttribute(".vs-thumb", "aria-valuenow");
  check(mid !== end && end === "-5.00", `live: a typed value travels (${mid} on the way) and lands (${end})`);
  await live.close();

  const p = await browser.newPage();
  await p.goto(base + "teachers.html");
  for (const href of await p.$$eval("a[href$='.pdf']", (a) => a.map((x) => x.getAttribute("href")))) {
    check((await p.request.get(base + href)).status() === 200, "teacher link works: " + href);
  }
  await browser.close(); server.close();
  console.log(fails ? `\nbrowser: ${fails} FAILED` : "\nbrowser: all passed");
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
