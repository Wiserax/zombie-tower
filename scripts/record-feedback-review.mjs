import { chromium } from "playwright";
import fs from "node:fs/promises";
const b = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir("qa/motion/feedback", { recursive: true });
const context = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  recordVideo: { dir: "qa/motion/feedback", size: { width: 390, height: 844 } },
});
const p = await context.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://localhost:5197");
await p.waitForFunction(() => __lab);
await p.waitForTimeout(7000);
// Real player inputs: focus the visible front, discharge, then compare weapons.
await p.mouse.click(195, 510);
await p.waitForTimeout(5000);
await p.locator("#overcharge").click();
await p.waitForTimeout(6000);
await p.locator('[data-weapon="tesla"]').click();
await p.locator('[data-weapon="mortar"]').click();
await p.waitForTimeout(9000);
await p.mouse.click(130, 480);
await p.waitForTimeout(5000);
await p.locator('[data-weapon="tesla"]').click();
await p.locator('[data-weapon="mortar"]').click();
await p.waitForTimeout(6000);
await p.locator("#overcharge").click();
await p.waitForTimeout(5000);
await p.locator("#pause").click();
await p.waitForTimeout(1500);
await p.locator("#resume").click();
await p.waitForTimeout(5000);
await p.screenshot({ path: "qa/feel/motion-end.png" });
console.log(
  JSON.stringify({ errors, metrics: await p.evaluate(() => __lab.metrics()) }),
);
const video = p.video();
await context.close();
await video.saveAs("qa/motion/feedback/battle-review.webm");
await b.close();
