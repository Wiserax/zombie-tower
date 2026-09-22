import { chromium } from "playwright";
import fs from "node:fs/promises";

// Serve a frozen 0.3 checkout at 5198 and the candidate at 5197.
// Identical seeded input, CSS viewport and observation times; not a performance benchmark.
const browser = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir("qa/feel/comparison", { recursive: true });
const observations = [];
for (const [version, url] of [
  ["v03", "http://localhost:5198"],
  ["v04", "http://localhost:5197"],
]) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.addInitScript(() => {
    let seed = 82936;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__lab);
  await page.waitForTimeout(18000);
  await page.screenshot({ path: `qa/feel/comparison/${version}-battle.png` });
  await page.locator("#overcharge").click();
  await page.waitForTimeout(120);
  await page.screenshot({ path: `qa/feel/comparison/${version}-surge.png` });
  await page.waitForTimeout(650);
  await page.screenshot({ path: `qa/feel/comparison/${version}-falling.png` });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: `qa/feel/comparison/${version}-aftermath.png`,
  });
  await page.waitForTimeout(10000);
  await page.mouse.click(285, 520);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `qa/feel/comparison/${version}-focus.png` });
  observations.push({
    version,
    errors,
    metrics: await page.evaluate(() => __lab.metrics()),
  });
  await page.close();
}
await browser.close();
await fs.writeFile(
  "qa/feel/comparison/observations.json",
  JSON.stringify(observations, null, 2),
);
console.log(JSON.stringify(observations));
