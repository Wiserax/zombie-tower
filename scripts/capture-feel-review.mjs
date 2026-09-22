import { chromium } from "playwright";
import fs from "node:fs/promises";
const b = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir("qa/feel", { recursive: true });
for (const [name, width, height, density, mode] of [
  ["phone", 390, 844, 600, "all"],
  ["small", 320, 568, 600, "all"],
  ["crowd", 390, 844, 1600, "all"],
  ["guns", 390, 844, 600, "guns"],
  ["tesla", 390, 844, 600, "tesla"],
  ["mortars", 390, 844, 600, "mortar"],
]) {
  const p = await b.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:5197");
  await p.waitForFunction(() => window.__lab);
  await p.evaluate(
    ({ density, mode }) => {
      __lab.setDensity(density);
      if (mode !== "all")
        for (const k in __lab.combat.enabled)
          __lab.combat.enabled[k] = k === mode;
    },
    { density, mode },
  );
  await p.waitForTimeout(16000);
  await p.screenshot({ path: `qa/feel/${name}-battle.png` });
  await p.evaluate(() => {
    __lab.combat.cooldown = 0;
    __lab.combat.overcharge();
  });
  await p.waitForTimeout(90);
  await p.screenshot({ path: `qa/feel/${name}-surge.png` });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `qa/feel/${name}-aftermath.png` });
  console.log(
    name,
    JSON.stringify({
      errors,
      metrics: await p.evaluate(() => __lab.metrics()),
    }),
  );
  await p.close();
}
await b.close();
