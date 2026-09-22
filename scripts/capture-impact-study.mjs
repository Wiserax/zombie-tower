import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const page = await b.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://localhost:5197");
await page.waitForFunction(() => window.__lab);
await page.evaluate(() => {
  __lab.pause(true);
  document.querySelector("#paused").hidden = true;
  document.querySelector("#announcement").style.opacity = 0;
  __lab.view.shakeEnabled = false;
  __lab.view.update(0);
  __lab.view.render();
});
await page.screenshot({ path: "qa/impact-before.png" });
await page.evaluate(() => {
  const l = __lab;
  l.combat.strike(8, 7);
});
for (const [name, dt] of [
  ["flash", 0.025],
  ["fire", 0.075],
  ["smoke", 0.25],
  ["aftermath", 0.45],
]) {
  await page.evaluate((dt) => {
    const l = __lab;
    l.view.update(dt);
    l.view.render();
  }, dt);
  await page.screenshot({ path: `qa/impact-${name}.png` });
}
console.log(
  JSON.stringify({
    errors,
    metrics: await page.evaluate(() => __lab.metrics()),
  }),
);
await b.close();
if (errors.length) process.exit(1);
