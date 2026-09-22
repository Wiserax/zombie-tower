import { chromium } from "playwright";
import fs from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:5197";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  samples = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await p.goto(base);
await p.waitForFunction(() => window.__lab);
await p.evaluate(() => {
  __lab.setDensity(1600);
  __lab.resetMetrics();
});
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(10000);
  const m = await p.evaluate(() => ({
    ...__lab.metrics(),
    freeSlots: __lab.horde.free.length,
    bolts: __lab.combat.bolts.length,
    shells: __lab.combat.shells.length,
    lines: __lab.view.fx.lines.length,
    rings: __lab.view.fx.rings.length,
    scorches: __lab.view.fx.scorches.length,
  }));
  samples.push(m);
  if (i % 2 === 1)
    await p.evaluate(() => {
      __lab.combat.cooldown = 0;
      __lab.combat.overcharge();
    });
  console.log(i + 1, m.alive, m.fps, m.geometries, m.textures);
}
await p.screenshot({ path: "qa/soak-end.png" });
const first = samples[1],
  last = samples.at(-1);
if (first.geometries !== last.geometries || first.textures !== last.textures)
  errors.push("GPU resource counts grew");
for (const s of samples) {
  if (s.alive + s.freeSlots !== 2048) errors.push("Pool accounting failed");
  if (
    s.corpses > 400 ||
    s.particles > 2400 ||
    s.lines > 900 ||
    s.rings > 64 ||
    s.scorches > 160
  )
    errors.push("Effect retention exceeded caps");
}
await fs.writeFile(
  "qa/stability.json",
  JSON.stringify(
    { base, date: new Date().toISOString(), samples, errors },
    null,
    2,
  ),
);
await b.close();
if (errors.length) {
  console.error(errors);
  process.exitCode = 1;
}
