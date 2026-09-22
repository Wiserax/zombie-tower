import { chromium, webkit } from "playwright";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const base = process.env.BASE_URL || "https://wiserax.github.io/zombie-tower/";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const htmlResponse = await fetch(base + "?v=0.4.0");
assert.equal(htmlResponse.status, 200);
const html = await htmlResponse.text();
assert(html.includes("VISUAL LAB · 0.4"));
const assets = [...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map(
  (m) => m[1],
);
const files = [];
for (const asset of [...new Set(assets), "Deadwood.html"]) {
  const url = new URL(asset, base);
  url.searchParams.set("v", "0.4.0");
  const response = await fetch(url);
  assert.equal(response.status, 200, url.href);
  const bytes = Buffer.from(await response.arrayBuffer());
  const localPath =
    asset === "Deadwood.html"
      ? "dist/Deadwood.html"
      : "dist/" + asset.replace(/^\.\//, "");
  const localHash = hash(await fs.readFile(localPath));
  assert.equal(hash(bytes), localHash, `Published asset differs: ${asset}`);
  files.push({ asset, bytes: bytes.length, sha256: localHash });
}

const browsers = [];
for (const [name, engine, options] of [
  ["Chrome", chromium, { channel: "chrome" }],
  ["WebKit", webkit, {}],
]) {
  const browser = await engine.launch({ headless: true, ...options });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const errors = [],
    failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => failedRequests.push(r.url()));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base + "?v=0.4.0");
  await page.waitForFunction(() => window.__lab);
  await page.waitForTimeout(12000);
  assert.equal(await page.locator(".version").textContent(), "0.4.0");
  assert.equal(await page.evaluate(() => __lab.audio.ctx), undefined);
  const before = await page.evaluate(() => ({
    metrics: __lab.metrics(),
    healthMode: __lab.view.healthBars.mode,
  }));
  assert.equal(before.healthMode, "damaged");
  assert(before.metrics.healthBars > 0);
  assert(before.metrics.kills > 0 && before.metrics.bestStreak > 0);
  await page.locator("#overcharge").tap();
  await page.waitForTimeout(200);
  assert(await page.locator("#overcharge").isDisabled());
  assert.match(await page.locator("#combo small").textContent(), /SURGE/);
  await page.screenshot({
    path: `qa/public-${name.toLowerCase()}-feedback.png`,
  });
  await page.locator("#pause").tap();
  const time = await page.evaluate(() => __lab.horde.time);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __lab.horde.time), time);
  await page.locator("#resume").tap();
  await page.locator("#sound").tap();
  await page.waitForFunction(() => __lab.audio.ready, null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => __lab.audio.buffers.size), 22);
  await page.locator("#sound").tap();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => __lab.audio.ctx.state), "suspended");
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  browsers.push({
    name,
    before,
    errors,
    failedRequests,
    checks: [
      "public 0.4.0",
      "healthy startup",
      "damaged HP bars",
      "real kills and streak",
      "overcharge",
      "pause/resume",
      "audio opt-in/decode/mute",
    ],
  });
  await browser.close();
}
await fs.writeFile(
  "qa/public-feedback-release.json",
  JSON.stringify(
    { date: new Date().toISOString(), base, files, browsers },
    null,
    2,
  ),
);
console.log(
  "Published assets match local production build; Chrome/WebKit release interactions passed",
);
