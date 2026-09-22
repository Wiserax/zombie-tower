import { chromium } from "playwright";
import fs from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:5196";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  results = [];
for (const test of [
  { name: "desktop-300", w: 1440, h: 1000, d: 300 },
  { name: "desktop-600", w: 1440, h: 1000, d: 600 },
  { name: "desktop-1000", w: 1440, h: 1000, d: 1000 },
  { name: "desktop-1600", w: 1440, h: 1000, d: 1600 },
  { name: "mobile-600", w: 390, h: 844, d: 600, dpr: 2 },
]) {
  const context = await b.newContext({
    viewport: { width: test.w, height: test.h },
    deviceScaleFactor: test.dpr || 1,
    isMobile: !!test.dpr,
    hasTouch: !!test.dpr,
  });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(test.name + ": " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(test.name + ": " + m.text());
  });
  await p.goto(base);
  await p.waitForFunction(() => !!window.__lab);
  await p.evaluate((n) => {
    const l = window.__lab;
    if (n < l.horde.alive) {
      l.horde.blast(0, 0, 100, 10000);
      l.view.dead.length = 0;
    }
    l.setDensity(n);
  }, test.d);
  await p.waitForTimeout(2500);
  await p.evaluate(() => __lab.resetMetrics());
  await p.waitForTimeout(9000);
  const metrics = await p.evaluate(() => {
    const l = __lab,
      g = l.view.renderer.getContext(),
      ext = g.getExtension("WEBGL_debug_renderer_info");
    return {
      ...l.metrics(),
      gpu: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable",
      dpr: l.view.renderer.getPixelRatio(),
    };
  });
  if (metrics.target !== test.d)
    errors.push(test.name + ": density changed during test");
  await p.screenshot({ path: `qa/${test.name}.png` });
  results.push({ test, ...metrics });
  if (test.d === 600) {
    await p.locator("#overcharge").click();
    await p.waitForTimeout(200);
    await p.screenshot({ path: `qa/${test.name}-overcharge.png` });
    const cooldown = await p.locator("#overcharge").isDisabled();
    if (!cooldown) errors.push("Overcharge cooldown missing");
    await p.locator("#pause").click();
    const t = await p.evaluate(() => __lab.horde.time);
    await p.waitForTimeout(300);
    if (t !== (await p.evaluate(() => __lab.horde.time)))
      errors.push("Pause failed");
    await p.locator("#resume").click();
    await p.locator("#settings-toggle").click();
    if (!(await p.locator("#settings").isVisible()))
      errors.push("Settings failed");
    await p.locator("#close-settings").click();
  }
  await context.close();
  console.log(test.name, JSON.stringify(metrics));
}
await fs.writeFile(
  "qa/performance.json",
  JSON.stringify(
    { date: new Date().toISOString(), base, results, errors },
    null,
    2,
  ),
);
await b.close();
if (errors.length) {
  console.error(errors);
  process.exitCode = 1;
}
