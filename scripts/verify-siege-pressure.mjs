import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

// Exercise actual wall pressure and the visual lab's automatic reset. Never change HP.
const base = process.env.BASE_URL || "http://localhost:5197";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page.waitForFunction(() => window.__lab);
await page.locator("#sound").click();
await page.waitForFunction(() => __lab.audio.ready);
for (const weapon of ["guns", "tesla", "mortar"])
  await page.locator(`[data-weapon="${weapon}"]`).click();
await page.evaluate(() => __lab.setDensity(1600));
await fs.mkdir("qa/feel/pressure", { recursive: true });
const samples = [];
let warning = false,
  critical = false,
  reset = false,
  afterReset = 0;
let bestBeforeReset = 0;
for (let i = 0; i < 180; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => ({
    ...__lab.metrics(),
    health: __lab.horde.health,
    warning: document.querySelector("#bastion-label").textContent,
    defenseState: document.querySelector(".defense").dataset.state,
    vignette: Number(
      getComputedStyle(document.querySelector("#danger-vignette")).opacity,
    ),
    reset: document
      .querySelector("#announcement small")
      .textContent.includes("AUTOMATIC RESET"),
    audio: __lab.audio.metrics(),
  }));
  samples.push(state);
  if (!warning && state.health < 58) {
    warning = true;
    assert.equal(state.defenseState, "damaged");
    await page.screenshot({ path: "qa/feel/pressure/under-siege.png" });
  }
  if (!critical && state.health < 27) {
    critical = true;
    assert.equal(state.defenseState, "critical");
    assert.equal(state.warning, "CRITICAL");
    assert(state.vignette > 0);
    assert(state.wallStrikes > 0);
    await page.screenshot({ path: "qa/feel/pressure/critical.png" });
  }
  if (!reset && state.reset) {
    reset = true;
    assert(state.health > 90);
    assert(state.streak < 100);
    assert.equal(
      state.bestStreak,
      bestBeforeReset,
      "Automatic cleanup awarded an unearned best streak",
    );
    assert.equal(
      await page
        .locator("#combo")
        .evaluate((el) => el.classList.contains("show")),
      false,
      "Reset left a pack reward on screen",
    );
    for (const weapon of ["guns", "tesla", "mortar"])
      await page.locator(`[data-weapon="${weapon}"]`).click();
    await page.screenshot({ path: "qa/feel/pressure/reset.png" });
  }
  if (!reset) bestBeforeReset = state.bestStreak;
  if (reset && ++afterReset >= 12) break;
  if (i % 15 === 0)
    console.log(
      "pressure",
      i,
      Math.round(state.health),
      "HP",
      state.wallAttackers,
      "attackers",
    );
}
assert(
  warning && critical && reset,
  "Did not observe the full natural pressure/reset sequence",
);
assert(samples.some((s) => s.audio.counts.hit > 0));
assert(
  samples.every(
    (s) => s.audio.peakVoices <= 24 && s.hitSparks <= 120 && s.corpses <= 400,
  ),
);
assert.deepEqual(errors, []);
await fs.writeFile(
  "qa/feedback-pressure.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      base,
      warning,
      critical,
      reset,
      errors,
      samples,
    },
    null,
    2,
  ),
);
await browser.close();
console.log(
  "Natural siege pressure, critical feedback, automatic reset and restored defenses passed",
);
