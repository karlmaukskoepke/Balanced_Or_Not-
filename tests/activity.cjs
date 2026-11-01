// Real-browser walk through the student activity (equations 1, 3 and 8), at 1366 x 768 and 1366 x 650.
// Called from tests/browser.cjs.
const M = "−";
module.exports = async function (browser, base, OUT, check) {
  for (const [w, hgt] of [[1366, 768], [1366, 650]]) {
    const tag = `${w}x${hgt}`;
    const page = await browser.newPage({ viewport: { width: w, height: hgt }, reducedMotion: "reduce" });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const prompt = () => page.textContent("#prompt");
    const msg = () => page.textContent("#prompt .prompt-msg").catch(() => "");
    const held = async () => (await page.getAttribute("#balance", "data-held")) === "1";
    const target = async () => parseFloat(await page.getAttribute("#balance", "data-target-angle"));
    const fits = async (where) => {
      const r = await page.evaluate(() => {
        const p = document.getElementById("prompt");
        const over = [...document.querySelectorAll(".col-right > *, .col-left > *")].some((el) => {
          const b = el.getBoundingClientRect(); return b.bottom > innerHeight + 0.5;
        });
        return { page: document.documentElement.scrollHeight - innerHeight, prompt: p.scrollHeight - p.clientHeight,
          over, w: document.documentElement.scrollWidth - innerWidth };
      });
      check(r.page <= 0 && r.prompt <= 1 && !r.over && r.w <= 0,
        `${tag} ${where}: fits on one screen, no scrolling (${JSON.stringify(r)})`);
    };
    const logRow = (i) => page.$$eval(`#log-body tr:nth-child(${i}) td`, (t) => t.map((x) => x.textContent));
    const guess = async (x) => { await page.fill("#x-input", x); await page.press("#x-input", "Enter"); };
    const answer1 = async (side, diff) => {
      await page.click(`#prompt [data-choice=${side}]`); await page.fill("#diff-input", diff); await page.press("#diff-input", "Enter");
    };

    await page.goto(base + "index.html?reset=1");
    await page.waitForSelector("#log-body tr");
    // Equation 1: seeded guesses
    check((await logRow(1)).join("|") === "1|5|8|?|?", `${tag} #1: guess 1 is given (x = 1), its row shows 5 and 8`);
    check((await page.textContent("#log-body tr:nth-child(1) th")).includes("given"), `${tag} #1: row 1 is marked given`);
    check(await held(), `${tag} #1: beam held level before the answer`);
    check(await page.isDisabled("#x-input"), `${tag} #1: x box is closed while the given guess is answered`);
    check(await page.isDisabled("#x-slider"), `${tag} #1: slider locked`);
    await fits("guess prompt");
    await page.screenshot({ path: `${OUT}/${tag}-1-given-guess.png` });
    await answer1("left", "3");
    check((await msg()).includes("8 is greater than 5"), `${tag} #1: wrong side -> "8 is greater than 5"`);
    check(!!(await page.$('[data-greater="right"]')), `${tag} #1: the right total is marked "greater"`);
    await answer1("right", "4");
    check((await msg()).includes("Larger minus smaller: 8 " + M + " 5"), `${tag} #1: wrong difference -> "8 − 5"`);
    await fits("wrong-answer hint");
    await page.screenshot({ path: `${OUT}/${tag}-2-wrong-difference.png` });
    await answer1("right", "3");
    check((await logRow(1)).join("|") === "1|5|8|Right|3", `${tag} #1: answered row 1`);
    check(!(await held()) && (await target()) > 0, `${tag} #1: beam tips right after the answer`);
    check((await logRow(2))[0] === "" && (await prompt()).includes("Next: guess 2 (given)"), `${tag} #1: the tip stays on screen until the student asks for guess 2`);
    await page.click("#next-guess");
    check(await held(), `${tag} #1: guess 2 holds the beam level again`);
    check((await logRow(2))[0] === "7" && (await prompt()).includes("Guess 2 (given): x = 7"), `${tag} #1: guess 2 (x = 7) supplied`);
    await answer1("left", "3");
    check((await prompt()).includes("Guess 3 of 5"), `${tag} #1: now the student's own guess 3`);
    check(!(await page.isDisabled("#x-input")), `${tag} #1: x box opens for guess 3`);
    await page.fill("#x-input", "-");
    check((await page.textContent("#x-msg")).includes("isn't a number yet"), `${tag} #1: "-" alone -> gentle "not a number yet"`);
    await guess("4");
    await answer1("balanced", "");
    check((await prompt()).includes("That balances. Can you find a different value that also balances?"),
      `${tag} #1: first balance -> second-value prompt`);
    await guess("4");
    await fits("duplicate message and second-value note");
    check((await page.textContent("#x-msg")).includes("already tried x = 4"), `${tag} #1: repeated x refused`);
    await guess("-1/2");
    check((await logRow(4)).slice(0, 3).join("|") === `${M}1/2|2|13/2`, `${tag} #1: typed fraction −1/2 -> 2 and 13/2`);
    check((await page.textContent('[data-sub="left"]')) === `2(${M}1/2) + 3 = 2`, `${tag} #1: one-line substitution under the left pan`);
    await answer1("right", "4");
    await fits("second-value note and a hint");
    await answer1("right", "4.5");
    check((await logRow(4))[4] === "9/2", `${tag} #1: difference 4.5 accepted as 9/2`);
    check((await prompt()).match(/That balances/g).length === 1, `${tag} #1: second-value prompt shown once`);
    await guess("0");
    await answer1("right", "4");
    // prediction
    check((await prompt()).includes("Predict"), `${tag} #1: prediction after 5 guesses`);
    check(await page.isDisabled("#x-slider"), `${tag} #1: slider still locked before the prediction`);
    await fits("prediction");
    await page.click("#prompt [data-choice=never]");
    check(!(await page.isDisabled("#x-slider")), `${tag} #1: slider unlocks after the prediction`);
    const rows = await page.$$eval("#log-body tr", (t) => t.length);
    // live slider: drag with the mouse; the beam target must change before the button is released
    const box = await page.locator("#x-slider").boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.down();
    const seen = new Set();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box.x + box.width * (0.5 + i * 0.05), box.y + box.height / 2);
      seen.add(await target() + "|" + (await page.textContent('[data-total="left"]')));
    }
    await page.mouse.up();
    check(seen.size >= 6, `${tag} #1: balance and totals update while dragging (${seen.size} different states before release)`);
    check((await page.$$eval("#log-body tr", (t) => t.length)) === rows && (await logRow(5))[0] === "0",
      `${tag} #1: the slider does not add rows to the log`);
    await page.focus("#x-slider");
    await page.fill("#x-input", "4");
    check((await page.textContent("#live-line")).includes("Balanced"), `${tag} #1: typed 4 with the slider open: balanced, live`);
    await page.focus("#x-slider"); await page.keyboard.press("ArrowRight");
    check((await page.inputValue("#x-input")) === "4.01", `${tag} #1: arrow key nudges the slider by 0.01`);
    await fits("slider and sort");
    // wrong sort -> spotlight
    await page.click("#prompt [data-choice=never]");
    check(!(await page.isHidden("#veil")) && (await page.textContent("#spot-msg")) === "Check the slider again.",
      `${tag} #1: wrong sort -> screen grays, "Check the slider again."`);
    check(!(await prompt()).match(/One solution.*correct|exactly one value is right/i), `${tag} #1: wrong sort does not reveal the answer`);
    check(await page.isDisabled("#prompt [data-choice=one]"), `${tag} #1: sort closed during the spotlight`);
    await page.screenshot({ path: `${OUT}/${tag}-3-check-the-slider.png` });
    await page.focus("#x-slider"); await page.keyboard.press("ArrowLeft");
    check(await page.isHidden("#veil"), `${tag} #1: using the slider relights the screen`);
    await page.click("#prompt [data-choice=one]");
    check((await page.textContent("#sortbar-toggle")).replace(/\s+/g, " ").includes("One solution 1"), `${tag} #1: count bar shows One solution 1`);
    // solve
    await fits("solve entry");
    await page.fill("#solve-left", "4"); await page.fill("#solve-right", "x"); await page.press("#solve-right", "Enter");
    check((await msg()).includes("agrees"), `${tag} #1: "4 = x" accepted`);
    check(!(await page.isDisabled("#next")), `${tag} #1: Next enabled`);
    await fits("finished equation");
    await page.screenshot({ path: `${OUT}/${tag}-4-done.png` });
    // persistence
    await page.reload(); await page.waitForSelector("#log-body tr");
    check((await logRow(4))[0] === `${M}1/2` && (await prompt()).includes("Your result: x = 4"), `${tag}: progress survives a refresh`);
    await page.click("#sortbar-toggle");
    check((await page.textContent("#sortbar-panel")).includes("2x + 3 = x + 7"), `${tag}: count bar expands to show sorted equations`);
    await page.keyboard.press("Escape");

    // Equation 3: rounded decimal refused, 8/6 accepted (teacher link opens it directly)
    await page.goto(base + "index.html?reset=1&all=1&eq=3"); await page.waitForSelector("#log-body tr");
    check((await logRow(1))[0] === "0" && (await logRow(2)).join("") === "", `${tag} #3: given guesses start with x = 0`);
    await answer1("right", "4"); await page.click("#next-guess"); await answer1("left", "5");
    for (const x of ["1", "2", "-1"]) { await guess(x); const c = (await logRow((await page.$$eval("#log-body tr:not(.log-empty)", (t) => t.length)))); await answer1(c[1] === c[2] ? "balanced" : (parseFloat(c[1].replace(M, "-")) > parseFloat(c[2].replace(M, "-")) ? "left" : "right"), String(Math.abs(parseFloat(c[1].replace(M, "-")) - parseFloat(c[2].replace(M, "-"))))); }
    await page.click("#prompt [data-choice=one]");
    await page.fill("#x-input", "1.33");
    check((await page.textContent("#live-line")).includes("Right side is heavier by 0.01"), `${tag} #3: 1.33 is not balanced (0.01)`);
    check(Math.abs(await target()) >= 4, `${tag} #3: beam still tips at least 4°`);
    await page.click("#prompt [data-choice=one]");
    await page.fill("#solve-left", "x"); await page.fill("#solve-right", "1.33"); await page.press("#solve-right", "Enter");
    check((await msg()).includes("rounded value") && !(await msg()).includes("4/3"), `${tag} #3: 1.33 -> rounded-value message, no 4/3`);
    await page.fill("#solve-right", "8/6"); await page.press("#solve-right", "Enter");
    check((await msg()).includes("agrees"), `${tag} #3: 8/6 accepted`);

    // Equation 8 (Part 2): no seeds, no difference column, one click answers
    await page.goto(base + "index.html?reset=1&all=1&eq=8"); await page.waitForSelector("#log-body tr");
    check(!(await page.textContent("#log-head")).includes("Difference"), `${tag} #8: no difference column in Part 2`);
    check((await prompt()).includes("Guess 1 of 5") && !(await page.isDisabled("#x-input")), `${tag} #8: no given guesses`);
    check(!!(await page.$(".eqn--emphasis")), `${tag} #8: x-terms tinted in Part 2`);
    await guess("2");
    check(!(await page.$("#diff-input")), `${tag} #8: no difference box`);
    await page.click("#prompt [data-choice=right]");
    check((await logRow(1)).join("|") === "2|12|13|Right", `${tag} #8: one click answers`);
    await fits("Part 2 guess");
    await page.screenshot({ path: `${OUT}/${tag}-5-part2.png` });
    check(errors.length === 0, `${tag}: no script errors ${errors.join("; ")}`);
    await page.close();
  }
};
