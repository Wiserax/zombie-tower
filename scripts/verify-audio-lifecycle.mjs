import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage();
await p.route("**/audio/tesla.wav", (r) => r.abort());
await p.goto("http://localhost:5197");
await p.waitForFunction(() => window.__lab);
await p.click("#sound");
await p.waitForFunction(() => !document.querySelector("#sound").disabled);
assert.equal(await p.evaluate(() => __lab.audio.enabled), false);
assert.match(await p.locator("#audio-status").textContent(), /retry/);
await p.unroute("**/audio/tesla.wav");
await p.click("#sound");
await p.waitForFunction(() => __lab.audio.ready);
assert.equal(await p.evaluate(() => __lab.audio.buffers.size), 22);
await p.evaluate(() => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
});
await p.waitForTimeout(200);
assert.equal(await p.evaluate(() => __lab.audio.ctx.state), "suspended");
await p.evaluate(() => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => false,
  });
  document.dispatchEvent(new Event("visibilitychange"));
});
await p.waitForTimeout(200);
assert.equal(await p.evaluate(() => __lab.audio.ctx.state), "running");
await p.close();
const f = await b.newPage();
const errors = [];
f.on("pageerror", (e) => errors.push(e.message));
await f.goto(pathToFileURL(path.resolve("dist/Deadwood.html")).href);
await f.waitForFunction(() => window.__lab);
await f.click("#sound");
await f.waitForFunction(() => __lab.audio.ready);
assert.equal(await f.evaluate(() => __lab.audio.buffers.size), 22);
assert.equal(errors.length, 0);
await b.close();
console.log(
  "Failed-download retry, background suspend/resume, and actual file:// audio passed",
);
