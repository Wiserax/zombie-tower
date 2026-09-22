import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:5197";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  results = [];
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [1440, 1000],
  [1920, 1080],
  [844, 390],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.__lab);
  await page.waitForTimeout(600);
  const layout = await page.evaluate(() => {
    const box = (s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    };
    return {
      shell: box("#game-shell"),
      canvas: box("#battlefield"),
      chapter: box(".chapter"),
      controls: box(".top-controls"),
      footer: box("footer"),
      style: __lab.view.style,
    };
  });
  assert.equal(layout.style, "retro");
  assert(layout.canvas.h > layout.canvas.w, "Portrait canvas");
  assert(layout.chapter.right <= layout.controls.x, "Header collision");
  assert(layout.footer.bottom <= layout.shell.bottom, "Footer outside shell");
  assert(
    layout.shell.x >= 0 && layout.shell.right <= width,
    "Horizontal overflow",
  );
  const x = layout.canvas.x + layout.canvas.w * 0.37,
    y = layout.canvas.y + layout.canvas.h * 0.46;
  const point = await page.evaluate(
    ({ x, y }) => {
      __lab.pause(true);
      const p = __lab.view.point(x, y);
      return { x: p.x, z: p.z };
    },
    { x, y },
  );
  await page.evaluate(() => __lab.pause(false));
  await page.mouse.click(x, y);
  const focus = await page.evaluate(() => ({
    focus: __lab.combat.focus,
    marker: document
      .querySelector("#focus-marker")
      .getBoundingClientRect()
      .toJSON(),
  }));
  assert(
    Math.abs(focus.focus.x - point.x) < 0.1 &&
      Math.abs(focus.focus.z - point.z) < 0.1,
    "Offset input misses world",
  );
  await page.locator("#settings-toggle").click();
  await page.locator('[data-style="original"]').click();
  assert.equal(await page.evaluate(() => __lab.view.style), "original");
  await page.locator('[data-style="retro"]').click();
  // Warm both geometry/texture sets once, then prove toggling reuses GPU resources.
  const resource = await page.evaluate(() => {
    const v = __lab.view;
    v.setStyle("original");
    v.render();
    v.setStyle("retro");
    v.render();
    const before = { ...v.renderer.info.memory };
    for (let i = 0; i < 20; i++) {
      v.setStyle(i % 2 ? "retro" : "original");
      v.render();
    }
    return { before, after: { ...v.renderer.info.memory } };
  });
  assert.deepEqual(
    resource.before,
    resource.after,
    "Style switching leaks GPU resources",
  );
  await page.locator("#close-settings").click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `qa/portrait-${width}x${height}.png` });
  results.push({ width, height, layout, resource });
  await page.close();
}
assert.deepEqual(errors, []);
await fs.writeFile(
  "qa/portrait.json",
  JSON.stringify(
    { date: new Date().toISOString(), base, results, errors },
    null,
    2,
  ),
);
await browser.close();
console.log(
  "Portrait layouts, input mapping, style switching, and GPU reuse passed.",
);
