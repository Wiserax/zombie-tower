import { chromium } from "playwright";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://localhost:5197";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const html = await (await fetch(base)).text();
const runtimeAsset = html.match(/src="([^\"]+\.js)"/)[1];
const runtimeBytes = await (
  await fetch(new URL(runtimeAsset, base))
).arrayBuffer();
const runtimeSha256 = crypto
  .createHash("sha256")
  .update(Buffer.from(runtimeBytes))
  .digest("hex");
for (const spec of [
  { name: "phone-600", density: 600, zoom: 1, rate: 1, bars: "damaged" },
  { name: "phone-1600", density: 1600, zoom: 1, rate: 1, bars: "damaged" },
  {
    name: "wide-1600-all-bars",
    density: 1600,
    zoom: 0.7,
    rate: 1,
    bars: "all",
  },
  {
    name: "cpu-throttled-600",
    density: 600,
    zoom: 1,
    rate: 4,
    bars: "damaged",
  },
]) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: spec.rate });
  await page.goto(base);
  await page.waitForFunction(() => __lab);
  await page.evaluate((spec) => {
    __lab.setDensity(spec.density);
    __lab.view.zoom = spec.zoom;
    __lab.view.healthBars.mode = spec.bars;
    __lab.view.resize();
  }, spec);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    __lab.resetMetrics();
    const v = __lab.view,
      gl = v.renderer.getContext(),
      ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    window.__gpu = {
      available: !!ext,
      times: [],
      pending: [],
      skipped: 0,
      disjoint: 0,
    };
    if (!ext) return;
    const original = v.render.bind(v);
    v.render = () => {
      const data = __gpu;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (disjoint) {
        data.disjoint++;
        for (const q of data.pending) gl.deleteQuery(q);
        data.pending.length = 0;
      }
      for (let i = data.pending.length - 1; i >= 0; i--) {
        const q = data.pending[i];
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
          if (!disjoint)
            data.times.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(q);
          data.pending.splice(i, 1);
        }
      }
      const q = data.pending.length < 8 ? gl.createQuery() : null;
      if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      else data.skipped++;
      original();
      if (q) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        data.pending.push(q);
      }
    };
  });
  for (let j = 0; j < 3; j++) {
    await page.waitForTimeout(5000);
    if (j < 2)
      await page.evaluate(() => {
        __lab.combat.cooldown = 0;
        __lab.combat.overcharge();
      });
  }
  const result = await page.evaluate(() => {
    const values = __gpu.times.sort((a, b) => a - b),
      p = (q) =>
        values[Math.min(values.length - 1, Math.floor(values.length * q))] ??
        null;
    const gl = __lab.view.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      metrics: __lab.metrics(),
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown",
      timing: {
        available: __gpu.available,
        count: values.length,
        medianMs: p(0.5),
        p95Ms: p(0.95),
        p99Ms: p(0.99),
        maxMs: values.at(-1) ?? null,
        disjoint: __gpu.disjoint,
        skipped: __gpu.skipped,
      },
    };
  });
  assert.deepEqual(errors, []);
  assert(result.metrics.damageLabels <= 32);
  assert(result.metrics.hitSparks <= 120);
  results.push({ spec, ...result, errors });
  console.log(spec.name, JSON.stringify(result));
  await page.close();
}
await browser.close();
await fs.writeFile(
  "qa/feedback-performance.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      base,
      runtimeAsset,
      runtimeSha256,
      note: "Desktop Apple GPU and emulated phone viewport. 4x rate is CPU throttling, not a physical mobile-device measurement.",
      results,
    },
    null,
    2,
  ),
);
