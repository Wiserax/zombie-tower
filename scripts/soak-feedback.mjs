import { chromium, webkit } from "playwright";
import fs from "node:fs/promises";
import crypto from "node:crypto";
const base = process.env.BASE_URL || "http://localhost:5197";
const engine = process.env.SOAK_ENGINE || "chrome";
const seconds = Math.max(60, Number(process.env.SOAK_SECONDS || 600));
const artifact = process.env.SOAK_REPORT || `qa/feedback-soak-${engine}`;
const started = Date.now();
const browser =
  engine === "webkit"
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const errors = [],
  samples = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const response = await page.goto(base);
const html = await response.text();
const asset = html.match(/src="([^\"]+\.js)"/)[1];
const bytes = await (await fetch(new URL(asset, base))).arrayBuffer();
const runtimeHash = crypto
  .createHash("sha256")
  .update(Buffer.from(bytes))
  .digest("hex");
await page.waitForFunction(() => window.__lab);
await page.evaluate(() => {
  const l = __lab;
  l.setDensity(1600);
  l.view.shakeEnabled = false;
  l.view.healthBars.mode = "all";
  for (let type = 0; type < 3; type++)
    l.view.dead.push({
      x: 8,
      z: 7,
      a: 0,
      type,
      time: 0,
      v: 0,
      phase: 0,
      element: 0,
    });
  l.view.setStyle("original");
  l.view.setStyle("retro");
  l.view.impacts.explosion(8, 7, 4.8);
  l.view.impacts.muzzle(0, 7, 0, 0);
  l.view.update(0.02);
  l.view.render();
});
await page.waitForTimeout(5000);
const cdp =
  engine === "chrome" ? await page.context().newCDPSession(page) : null;
if (cdp) {
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.collectGarbage");
}
const heap = async () => {
  if (!cdp) return null;
  const { metrics } = await cdp.send("Performance.getMetrics");
  return metrics.find((m) => m.name === "JSHeapUsedSize").value;
};
const initialHeap = await heap();
await page.evaluate(() => __lab.resetMetrics());
for (let i = 0; i < Math.ceil(seconds / 10); i++) {
  await page.waitForTimeout(10000);
  const sample = await page.evaluate(() => ({
    ...__lab.metrics(),
    programs: __lab.view.renderer.info.programs.length,
    freeSlots: __lab.horde.free.length,
    bolts: __lab.combat.bolts.length,
    shells: __lab.combat.shells.length,
    lines: __lab.view.fx.lines.length,
    rings: __lab.view.fx.rings.length,
    scorches: __lab.view.fx.scorches.length,
    streakLabel: document.querySelector("#streak-count").textContent,
    killedLabel: document.querySelector("#kills").textContent,
    activeLights: __lab.view.scene.children.filter((o) => o.isPointLight)
      .length,
    healthMode: __lab.view.healthBars.mode,
  }));
  samples.push(sample);
  if (
    sample.alive + sample.freeSlots !== 2048 ||
    sample.corpses > 400 ||
    sample.impactFlashes > 32 ||
    sample.muzzleFlashes > 24 ||
    sample.lines > 900 ||
    sample.rings > 64 ||
    sample.scorches > 160 ||
    sample.healthBars > 2048 ||
    sample.damageLabels > 32 ||
    sample.damageGlyphs > 192 ||
    sample.hitSparks > 120 ||
    sample.lightEvents > 24 ||
    sample.electrified > 2048 ||
    sample.activeLights !== 3
  )
    errors.push("Pool invariant at " + i);
  if (i % 2 === 1)
    await page.evaluate(() => {
      __lab.combat.cooldown = 0;
      __lab.combat.overcharge();
    });
  if (i % 6 === 5) {
    console.log(
      "minute",
      (i + 1) / 6,
      "fps",
      sample.fps,
      "resources",
      sample.geometries,
      sample.textures,
      "programs",
      sample.programs,
    );
    await page.evaluate(() => {
      const v = __lab.view;
      v.healthBars.mode = v.healthBars.mode === "all" ? "damaged" : "all";
      v.numbers.enabled = !v.numbers.enabled;
      v.lighting.enabled = !v.lighting.enabled;
      v.setStyle("original");
      v.setStyle("retro");
      v.pixelFilter = true;
      v.resize();
      v.pixelFilter = false;
      v.resize();
    });
  }
  await fs.writeFile(
    `${artifact}-progress.json`,
    JSON.stringify(
      { completedSamples: samples.length, last: sample, errors },
      null,
      2,
    ),
  );
}
if (cdp) await cdp.send("HeapProfiler.collectGarbage");
const finalHeap = await heap();
const first = samples[5],
  last = samples.at(-1);
if (
  first.geometries !== last.geometries ||
  first.textures !== last.textures ||
  first.programs !== last.programs
)
  errors.push("GPU resources grew after warmup");
await page.screenshot({ path: `${artifact}-end.png` });
await fs.writeFile(
  `${artifact}.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      base,
      runtimeHash,
      engine,
      durationSeconds: seconds,
      wallSeconds: (Date.now() - started) / 1000,
      initialHeap,
      finalHeap,
      samples,
      errors,
    },
    null,
    2,
  ),
);
await fs.rm(`${artifact}-progress.json`, { force: true });
await browser.close();
console.log("Finished", JSON.stringify({ errors, initialHeap, finalHeap }));
if (errors.length) process.exit(1);
