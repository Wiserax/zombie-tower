import { chromium, webkit } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://localhost:5197",
  results = [];
for (const engine of ["chrome", "webkit"]) {
  const browser =
    engine === "chrome"
      ? await chromium.launch({ channel: "chrome", headless: true })
      : await webkit.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => {
    const original = requestAnimationFrame;
    let first = true;
    window.requestAnimationFrame = (callback) =>
      original((time) => {
        if (first) {
          first = false;
          callback(time - 1000);
        } else callback(time);
      });
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__lab);
  await page.waitForTimeout(1200);
  const startup = await page.evaluate(() => ({
    elapsed: __lab.metrics().elapsed,
    minimumHP: Math.min(...__lab.horde.hp),
    maximumFlash: Math.max(...__lab.horde.hit),
    resolution: __lab.metrics().resolution,
    dpr: __lab.view.renderer.getPixelRatio(),
  }));
  assert(startup.elapsed >= 0, "Simulation ran backwards on startup");
  assert(
    startup.maximumFlash <= 1,
    "Negative time generated invalid hit flash",
  );
  assert.deepEqual(startup.resolution, [624, 1350]);
  const target = await page.locator("#battlefield").boundingBox();
  await page.mouse.click(
    target.x + target.width * 0.42,
    target.y + target.height * 0.43,
  );
  await page.waitForTimeout(80);
  assert(
    await page.evaluate(() => __lab.view.fx.focusMarker.visible),
    "World focus feedback missing",
  );
  await page.locator("#settings-toggle").click();
  await page.locator("#pixel-toggle").check();
  assert.equal(await page.evaluate(() => __lab.view.canvas.width), 320);
  await page.locator("#pixel-toggle").uncheck();
  await page.locator('[data-style="original"]').click();
  await page.locator('[data-style="retro"]').click();
  await page.locator("#close-settings").click();
  await page.evaluate(() => {
    __lab.setDensity(1600);
    __lab.resetMetrics();
  });
  await page.waitForTimeout(8000);
  const metrics = await page.evaluate(() => __lab.metrics());
  await page.locator("#overcharge").click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: `qa/${engine}-graphics-impact.png` });
  const culling = await page.evaluate(() => {
    const { view: v, horde: h } = __lab;
    __lab.pause(true);
    v.shakeEnabled = false;
    const outcomes = [];
    for (const zoom of [0.7, 1, 1.7]) {
      v.zoom = zoom;
      v.resize();
      const drawn = new Set();
      for (const u of v.units) {
        const a = u.mesh.instanceMatrix.array;
        for (let n = 0; n < u.mesh.count; n++)
          drawn.add(
            `${a[n * 16 + 12].toFixed(4)},${a[n * 16 + 14].toFixed(4)}`,
          );
      }
      let expected = 0,
        missing = 0;
      for (let i = 0; i < h.hp.length; i++)
        if (h.hp[i] > 0) {
          const scale =
            (h.type[i] === 2 ? 1.55 : h.type[i] === 1 ? 0.95 : 1) *
            (0.91 + h.phase[i] * 0.025);
          let intersects = false;
          for (const dx of [-0.45, 0.45])
            for (const dy of [0, 1.75])
              for (const dz of [-0.45, 0.45]) {
                const p = v.vec
                  .clone()
                  .set(h.x[i] + dx * scale, dy * scale, h.z[i] + dz * scale)
                  .project(v.camera);
                if (
                  Math.abs(p.x) <= 1 &&
                  Math.abs(p.y) <= 1 &&
                  Math.abs(p.z) <= 1
                )
                  intersects = true;
              }
          if (intersects) {
            expected++;
            if (!drawn.has(`${h.x[i].toFixed(4)},${h.z[i].toFixed(4)}`))
              missing++;
          }
        }
      outcomes.push({ zoom, expected, rendered: drawn.size, missing });
    }
    return outcomes;
  });
  assert(
    culling.every((x) => x.missing === 0),
    "Culling removed a visible body",
  );
  const pools = await page.evaluate(() => {
    const art = __lab.view.impacts;
    art.setEnabled(true);
    for (let i = 0; i < 100; i++) {
      art.explosion(8, 7, 4.8);
      art.muzzle(0, 5, 0, 0);
    }
    art.update(1 / 60);
    const peak = {
      blasts: art.blasts.length,
      muzzles: art.muzzles.length,
      flames: art.flames.count,
      stars: art.burstMesh.count,
    };
    art.update(1);
    return {
      peak,
      after: [
        art.blasts.length,
        art.muzzles.length,
        art.flames.count,
        art.burstMesh.count,
        art.muzzleMesh.count,
      ],
    };
  });
  assert(
    pools.peak.blasts <= 32 &&
      pools.peak.muzzles <= 24 &&
      pools.peak.flames <= 96 &&
      pools.peak.stars <= 32,
  );
  assert(
    pools.after.every((n) => n === 0),
    "Expired flashes remained visible",
  );
  if (engine === "chrome") {
    const cdp = await page.context().newCDPSession(page);
    for (const dpr of [1, 3]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: dpr,
        mobile: false,
      });
      await page.waitForFunction(
        (dpr) => __lab.view.renderer.getPixelRatio() === Math.min(dpr, 1.6),
        dpr,
      );
    }
    await cdp.detach();
  }
  assert.deepEqual(errors, []);
  results.push({ engine, startup, metrics, culling, pools, errors });
  await browser.close();
  console.log(engine, "graphics checks passed");
}
await fs.writeFile(
  "qa/graphics.json",
  JSON.stringify({ date: new Date().toISOString(), base, results }, null, 2),
);
