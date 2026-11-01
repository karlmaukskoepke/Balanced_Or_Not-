// Real-browser checks of the Stage 1 test page. Run: node tests/browser.cjs [outDir]
// Serves the folder itself, so no other setup is needed (Playwright must be installed).
const http = require("http"), fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.log("browser: SKIP (no Playwright)"); process.exit(0); }
const ROOT = path.join(__dirname, ".."), OUT = process.argv[2] || path.join(ROOT, "docs", "stage-1");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".pdf": "application/pdf" };
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const open = async (q) => { await page.goto(base + "balance-test.html?" + q); await page.waitForSelector("[data-total]"); };
  const shapes = (side) => page.$$eval(`.bon-pan[data-side=${side}] [data-shape]`,
    (els) => els.map((e) => e.dataset.shape + ":" + e.dataset.label));
  const angle = async () => parseFloat(await page.getAttribute("#balance", "data-angle"));
  const result = () => page.textContent("#readout-result");

  await open("eq=3&x=1.33");
  check((await result()).includes("Right side is heavier by 0.01"), "#3 at 1.33: right heavier by 0.01");
  check((await angle()) >= 4, "#3 at 1.33: beam tips at least 4° (right side down): " + (await angle()));
  await page.screenshot({ path: path.join(OUT, "eq3-x1.33.png") });
  await page.focus("#x-slider"); await page.keyboard.press("ArrowRight");
  check((await page.inputValue("#x-input")) === "1.34" && (await result()).includes("Left side is heavier by 0.02"),
    "#3: slider arrow key moves to 1.34 and the tilt flips");
  check((await angle()) <= -4, "#3 at 1.34: left side down at least 4°");

  await open("eq=9&x=0");
  check((await result()).includes("Balanced: both sides are 4"), "#9 at 0: balanced at 4 and 4");
  check(JSON.stringify(await shapes("left")) === JSON.stringify(["zero-box:0", "zero-box:0", "zero-box:0", "weight:+4"]),
    "#9 at 0: three zero boxes and a +4 weight on the left");
  check((await page.$$eval('[data-shape="zero-box"] rect', (r) => r.every((x) => x.getAttribute("stroke-dasharray")))),
    "#9 at 0: zero boxes are dashed");
  check((await angle()) === 0, "#9 at 0: level");
  await page.screenshot({ path: path.join(OUT, "eq9-x0.png") });

  await open("eq=2&x=-3");
  check((await result()).includes("both sides are −7"), "#2 at −3: both sides −7");
  check(JSON.stringify(await shapes("left")) === JSON.stringify(["float-box:−3", "float-box:−3", "float-box:−3", "weight:+2"]),
    "#2 at −3: left has three floating boxes −3 and a +2 weight");
  check(JSON.stringify(await shapes("right")) === JSON.stringify(["float-box:−3", "balloon:−4"]),
    "#2 at −3: right has a floating box and a −4 balloon");
  check((await page.$$('.bon-pan [data-string]')).length === 5, "#2 at −3: every floating piece has a string (5)");
  await page.screenshot({ path: path.join(OUT, "eq2-x-3.png") });

  for (const id of [5, 8]) {
    await open(`eq=${id}&x=0`);
    let level = 0;
    for (const x of ["-10", "-3.33", "-0.01", "0", "0.01", "2.5", "10"]) {
      await page.fill("#x-input", x);
      if ((await angle()) === 0) level++;
    }
    check(level === 0, `#${id}: never level at any tried value`);
  }
  await open("eq=8&x=8"); await page.screenshot({ path: path.join(OUT, "eq8-x8.png") });
  for (const id of [6, 7, 10]) {
    await open(`eq=${id}&x=0`);
    let tipped = 0;
    for (const x of ["-10", "-2", "-0.5", "0", "0.01", "4", "10"]) {
      await page.fill("#x-input", x);
      if ((await angle()) !== 0) tipped++;
    }
    check(tipped === 0, `#${id}: level at every tried value, including 0 and negatives`);
  }
  await open("eq=10&x=-2"); await page.screenshot({ path: path.join(OUT, "eq10-x-2.png") });
  await open("eq=11&x=2"); await page.screenshot({ path: path.join(OUT, "eq11-x2.png") });

  // typing, the ± button, arrow nudges, no float artifacts
  await open("eq=1&x=0");
  await page.fill("#x-input", "0.1"); await page.keyboard.press("Shift+ArrowUp");
  check((await page.inputValue("#x-input")) === "0.11", "Shift+Up adds 0.01 in the typed box");
  await page.fill("#x-input", "0.3");
  check((await page.textContent("#readout-left")).includes("2(0.3) + 3 = 0.6 + 3 = 3.6"), "typed 0.3: readout is exact");
  await page.click("#x-sign");
  check((await page.inputValue("#x-input")) === "−0.3", "± makes x negative");
  await page.fill("#x-input", "abc");
  check((await page.textContent("#x-error")).length > 0, "a non-number shows a message");
  const allText = await page.textContent("body");
  check(!/\d\.\d{3,}|NaN|undefined/.test(allText), "no long decimals, NaN or undefined on the page");

  // equation buttons with the keyboard
  await page.focus(".eq-pick:nth-child(4)"); await page.keyboard.press("Enter");
  check((await page.textContent("#eq-display")) === "2x + 3 = 2x + 8", "keyboard picks equation 4");
  check((await page.$$eval("#eq-display .eqn-x", (e) => e.map((s) => s.textContent))).join(",") === "2x,2x",
    "x-terms are marked as x-terms (blue)");

  // easing when motion is allowed
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  await page2.goto(base + "balance-test.html?eq=1&x=0"); await page2.waitForSelector("[data-total]");
  await page2.fill("#x-input", "9");
  await page2.waitForTimeout(120);
  const mid = parseFloat(await page2.getAttribute("#balance", "data-angle"));
  const target = parseFloat(await page2.getAttribute("#balance", "data-target-angle"));
  await page2.waitForTimeout(700);
  const end = parseFloat(await page2.getAttribute("#balance", "data-angle"));
  check(mid !== target && end === target, `beam eases when motion is allowed (mid ${mid}, end ${end})`);

  // phone width
  const page3 = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page3.goto(base + "balance-test.html?eq=10&x=4"); await page3.waitForSelector("[data-total]");
  const sw = await page3.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= 390, "no sideways scroll at phone width (" + sw + ")");
  await page3.screenshot({ path: path.join(OUT, "phone-eq10-x4.png"), fullPage: true });

  await page.goto(base + "teachers.html");
  for (const href of await page.$$eval("a[href$='.pdf']", (a) => a.map((x) => x.getAttribute("href")))) {
    const r = await page.request.get(base + href);
    check(r.status() === 200, "teacher link works: " + href);
  }
  check(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.join("; ") : ""));
  await browser.close(); server.close();
  console.log(fails ? `\nbrowser: ${fails} FAILED` : "\nbrowser: all passed");
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
