import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:5197";
const results = [];
for (const engine of ["chrome", "webkit"]) {
  const browser =
    engine === "chrome"
      ? await chromium.launch({ channel: "chrome", headless: true })
      : await webkit.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__lab);
  await page.waitForTimeout(1000);
  assert.equal(
    await page.evaluate(() => __lab.audio.metrics().state),
    "uninitialized",
    "Autoplay must remain silent",
  );
  const health = await page.evaluate(() => {
    const { horde: h, view: v } = __lab;
    __lab.pause(true);
    h.hp.fill(0);
    h.alive = 0;
    h.free = Array.from({ length: 2048 }, (_, i) => 2047 - i);
    const ids = [];
    for (let t = 0; t < 3; t++) {
      const i = h.spawn();
      ids.push(i);
      h.type[i] = t;
      h.hp[i] = h.maxHp[i] = [42, 24, 210][t];
      h.x[i] = 8 + t * 2;
      h.z[i] = 10;
      h.hit[i] = h.slow[i] = 0;
    }
    v.healthBars.mode = "damaged";
    v.update(0);
    v.render();
    const healthy = v.healthBars.geo.instanceCount;
    h.damage(ids[0], 21, 0, 0);
    v.update(0.016);
    v.render();
    const bar = Array.from(
      v.healthBars.geo.attributes.aValues.array.slice(0, 4),
    );
    const shape = Array.from(
      v.healthBars.geo.attributes.aShape.array.slice(0, 3),
    );
    const damaged = v.healthBars.geo.instanceCount;
    for (let i = 0; i < 30; i++) v.update(1 / 60);
    const settled = v.healthBars.geo.attributes.aValues.array[1];
    v.healthBars.mode = "all";
    v.update(0);
    const all = v.healthBars.geo.instanceCount;
    v.healthBars.mode = "off";
    v.update(0);
    const off = v.healthBars.geo.instanceCount;
    h.damage(ids[0], 999);
    const generation = h.generation[ids[0]];
    const reused = h.spawn();
    h.x[reused] = 8;
    h.z[reused] = 10;
    v.healthBars.mode = "all";
    v.update(0);
    v.render();
    return {
      healthy,
      damaged,
      bar,
      shape,
      settled,
      all,
      off,
      reused,
      generation: generation + 1 === h.generation[reused],
      recycledTrail: v.healthBars.trail[reused],
    };
  });
  assert.equal(health.healthy, 0);
  assert.equal(health.damaged, 1);
  assert.equal(health.bar[0], 0.5);
  assert.equal(health.bar[1], 1);
  assert(Math.abs(health.settled - 0.5) < 0.001);
  assert.equal(health.all, 3);
  assert.equal(health.off, 0);
  assert(health.generation);
  assert.equal(health.recycledTrail, 1);
  const status = await page.evaluate(() => {
    const { horde: h, view: v } = __lab;
    h.damage(2, 10, 0, 1);
    v.update(0);
    v.render();
    const active = v.shockArcs.count;
    h.step(0.6);
    v.update(0.6);
    v.render();
    const expired = v.shockArcs.count;
    v.hitSparks.events.length = 0;
    v.numbers.events.length = 0;
    const particleCursor = v.fx.cursor,
      kills = h.kills;
    h.x[2] = 100;
    h.z[2] = 100;
    h.damage(2, 10000, 1, 1);
    return {
      active,
      expired,
      offscreenKilled: h.kills - kills,
      offscreenSparks: v.hitSparks.events.length,
      offscreenLabels: v.numbers.events.length,
      offscreenParticles: v.fx.cursor - particleCursor,
    };
  });
  assert(status.active > 0);
  assert.equal(status.expired, 0);
  assert.equal(status.offscreenKilled, 1);
  assert.equal(status.offscreenSparks, 0);
  assert.equal(status.offscreenLabels, 0);
  assert.equal(status.offscreenParticles, 0);
  const numbers = await page.evaluate(() => {
    const { view: v } = __lab,
      n = v.numbers;
    n.events.length = 0;
    n.time = 0;
    n.lastSmall = -Infinity;
    n.add(8, 2, 10, 7, "hit", 42);
    n.add(8, 2, 10, 5, "hit", 42);
    const coalesced = n.events[0].value;
    n.add(8, 2, 10, 4, "hit", 42 + 2048);
    const slotSafe = n.events.length === 1; // throttled, never merged with old generation
    for (let i = 0; i < 100; i++) n.add(8 + (i % 8), 2, 10, 10 + i, "pack");
    n.update(0.05, v.camera);
    v.render();
    const peak = n.events.length,
      glyphs = n.geo.instanceCount;
    const finite = Object.values(n.geo.attributes).every((a) =>
      Array.from(a.array).every(Number.isFinite),
    );
    const rectangles = n.occupied.map((r) => ({ ...r }));
    n.clearPacks();
    const packsAfterClear = n.events.filter(
      (e) => e.kind === "pack" || e.kind === "surge",
    ).length;
    n.update(5, v.camera);
    const expired = n.events.length,
      expiredGlyphs = n.geo.instanceCount;
    return {
      coalesced,
      slotSafe,
      peak,
      glyphs,
      finite,
      rectangles,
      packsAfterClear,
      expired,
      expiredGlyphs,
    };
  });
  assert.equal(numbers.coalesced, 12);
  assert(numbers.slotSafe);
  assert(numbers.peak <= 32);
  assert(numbers.glyphs <= 192);
  assert(numbers.finite);
  assert.equal(numbers.packsAfterClear, 0);
  assert.equal(numbers.expired, 0);
  assert.equal(numbers.expiredGlyphs, 0);
  const surge = await page.evaluate(() => {
    const { horde: h, view: v, combat: c } = __lab;
    h.hp.fill(0);
    h.alive = 0;
    h.free = Array.from({ length: 2048 }, (_, i) => 2047 - i);
    for (let j = 0; j < 120; j++) {
      const i = h.spawn(),
        a = (j / 120) * Math.PI * 2;
      h.x[i] = Math.sin(a) * 16;
      h.z[i] = Math.cos(a) * 16;
      h.type[i] = 0;
      h.hp[i] = h.maxHp[i] = 42;
    }
    h.grid();
    v.fx.lines.length = 0;
    c.cooldown = 0;
    const kills = h.kills;
    c.overcharge();
    const lines = v.fx.lines.length;
    v.update(0.04);
    v.render();
    return {
      kills: h.kills - kills,
      lines,
      lightCount: v.scene.children.filter((o) => o.isPointLight).length,
      sparks: v.hitSparks.events.length,
      lights: v.lighting.events.length,
    };
  });
  assert.equal(surge.kills, 120);
  assert(surge.lines <= 12 * 16);
  assert.equal(surge.lightCount, 3);
  assert(surge.sparks <= 120);
  assert(surge.lights <= 24);
  const before = await page.evaluate(() => ({
    time: __lab.view.time,
    streak: __lab.streak.remaining,
  }));
  await page.waitForTimeout(350);
  assert.deepEqual(
    await page.evaluate(() => ({
      time: __lab.view.time,
      streak: __lab.streak.remaining,
    })),
    before,
    "Pause advanced combat feedback",
  );
  const modes = await page.evaluate(() => {
    const v = __lab.view;
    v.lighting.enabled = false;
    v.numbers.enabled = false;
    v.healthBars.mode = "off";
    v.update(0);
    v.render();
    const disabled = {
      lights: v.lighting.lights.map((l) => l.intensity),
      core: v.lighting.core.intensity,
      glows: v.lighting.glows.count,
      glyphs: v.numbers.geo.instanceCount,
      bars: v.healthBars.geo.instanceCount,
    };
    for (let j = 0; j < 4; j++) {
      v.setStyle("original");
      v.setStyle("retro");
      v.pixelFilter = !v.pixelFilter;
      v.resize();
    }
    v.lighting.enabled = true;
    v.numbers.enabled = true;
    v.healthBars.mode = "damaged";
    v.update(0.1);
    v.render();
    return { disabled, programs: v.renderer.info.programs.length };
  });
  assert.deepEqual(modes.disabled, {
    lights: [0, 0],
    core: 0,
    glows: 0,
    glyphs: 0,
    bars: 0,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(150);
  const layout = await page.evaluate(() => {
    const r = (s) => {
      const b = document.querySelector(s).getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom };
    };
    return {
      compact: document
        .querySelector("#game-shell")
        .classList.contains("compact"),
      header: r("header"),
      stats: r(".battle-stats"),
      streak: r("#streak"),
      combo: r("#combo"),
      overchargePosition: getComputedStyle(
        document.querySelector("#overcharge"),
      ).position,
      footer: r("footer"),
      canvas: r("#battlefield"),
    };
  });
  assert(layout.compact);
  assert(layout.header.bottom <= layout.stats.y);
  assert(layout.stats.bottom <= layout.streak.y);
  assert(layout.streak.bottom <= layout.combo.y);
  assert.equal(layout.overchargePosition, "relative");
  assert(layout.footer.bottom <= 568);
  await page.screenshot({ path: `qa/${engine}-feedback-check.png` });
  assert.deepEqual(errors, []);
  results.push({ engine, health, numbers, surge, modes, layout, errors });
  await browser.close();
  console.log(engine, "feedback checks passed");
}
await fs.writeFile(
  "qa/feedback.json",
  JSON.stringify({ date: new Date().toISOString(), base, results }, null, 2),
);
