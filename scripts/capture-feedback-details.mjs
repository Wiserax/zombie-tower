import { chromium } from "playwright";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("qa/feel/details", { recursive: true });
await page.goto("http://localhost:5197");
await page.waitForFunction(() => window.__lab);
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const { horde: h, view: v, combat: c } = __lab;
  __lab.pause(true);
  document.querySelector("#paused").hidden = true;
  document.querySelector("#announcement").style.opacity = 0;
  for (const k in c.enabled) c.enabled[k] = false;
  c.bolts.length = 0;
  c.shells.length = 0;
  h.hp.fill(0);
  h.alive = 0;
  h.free = Array.from({ length: 2048 }, (_, i) => 2047 - i);
  h.target = 0;
  v.dead.length = 0;
  v.numbers.events.length = 0;
  v.fx.lines.length = 0;
  v.fx.rings.length = 0;
  v.fx.scorches.length = 0;
  for (const p of v.fx.p) p.life = 0;
  for (const p of v.fx.smoke.items) p.life = 0;
  for (const p of v.fx.glow.items) p.life = 0;
  v.shakeEnabled = false;
  v.zoom = 1.55;
  for (let j = 0; j < 12; j++) {
    const i = h.spawn();
    h.x[i] = 5 + (j % 4) * 1.25;
    h.z[i] = 9 + Math.floor(j / 4) * 1.1;
    h.type[i] = j % 3;
    h.hp[i] = h.maxHp[i] = [42, 24, 210][h.type[i]];
    h.angle[i] = Math.atan2(-h.x[i], -h.z[i]);
  }
  h.grid();
  v.resize();
  v.update(0);
  v.render();
});
await page.screenshot({ path: "qa/feel/details/before.png" });
await page.evaluate(() => {
  const { horde: h, view: v } = __lab;
  h.damage(8, 74, 1, 1);
  v.update(0.03);
  v.render();
});
await page.screenshot({ path: "qa/feel/details/electric-hit.png" });
await page.evaluate(() => {
  const v = __lab.view;
  __lab.step(0.25);
  v.render();
});
await page.screenshot({ path: "qa/feel/details/health-trail.png" });
await page.evaluate(() => {
  __lab.combat.strike(6.7, 10);
});
for (const [name, dt] of [
  ["impact", 0.04],
  ["airborne", 0.1],
  ["landing", 0.28],
  ["aftermath", 0.45],
  ["fading", 4.3],
]) {
  await page.evaluate((dt) => {
    const v = __lab.view;
    for (let t = 0; t < dt; t += 1 / 60) __lab.step(Math.min(1 / 60, dt - t));
    v.render();
  }, dt);
  await page.screenshot({ path: `qa/feel/details/${name}.png` });
}
await page.evaluate(() => {
  const { horde: h, view: v } = __lab;
  h.health = 24;
  h.fill(600);
  for (let i = 0; i < h.hp.length; i++)
    if (h.hp[i] > 0) {
      const a = (i / 600) * Math.PI * 2;
      h.x[i] = Math.sin(a) * (6.2 + (i % 8) * 0.3);
      h.z[i] = Math.cos(a) * (6.2 + (i % 8) * 0.3);
    }
  h.grid();
  v.zoom = 1;
  v.resize();
  __lab.pause(false);
});
await page.waitForTimeout(450);
await page.screenshot({ path: "qa/feel/details/critical.png" });
await page.evaluate(() => __lab.pause(true));
await page.waitForTimeout(250);
console.log(
  JSON.stringify({
    errors,
    metrics: await page.evaluate(() => __lab.metrics()),
  }),
);
await browser.close();
