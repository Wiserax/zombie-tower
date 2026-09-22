import { chromium, webkit } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://localhost:5197/";
const report = { date: new Date().toISOString(), engines: [] };
for (const [name, engine, options] of [
  ["Chrome", chromium, { channel: "chrome" }],
  ["WebKit", webkit, {}],
]) {
  const browser = await engine.launch({ headless: true, ...options });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\.(wav|mp3)/.test(r.url())) requests.push(r.url());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__lab);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => __lab.audio.ctx), undefined);
  assert.equal(
    requests.length,
    0,
    "silent initial load must not download audio",
  );
  await page.click("#sound");
  await page.waitForFunction(
    () => __lab.audio.ready && __lab.audio.ctx.state === "running",
    null,
    { timeout: 30000 },
  );
  assert.equal(await page.evaluate(() => __lab.audio.buffers.size), 22);
  const decoded = await page.evaluate(() =>
    [...__lab.audio.buffers].map(([name, b]) => ({
      name,
      duration: b.duration,
      channels: b.numberOfChannels,
      sampleRate: b.sampleRate,
    })),
  );
  const loop = decoded.filter((x) => x.name.startsWith("siege"));
  assert(Math.abs(loop[0].duration - loop[1].duration) < 0.0001);
  await page.evaluate(() => {
    __lab.setDensity(1600);
    __lab.combat.cooldown = 0;
    __lab.combat.overcharge();
  });
  await page.waitForTimeout(1500);
  await page.click("#pause");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __lab.audio.ctx.state), "suspended");
  await page.click("#resume");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __lab.audio.ctx.state), "running");
  await page.click("#sound");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __lab.audio.ctx.state), "suspended");
  await page.click("#sound");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __lab.audio.loops.length), 3);
  await page.click("#settings-toggle");
  await page.locator("#audio-music").fill("62");
  await page.locator("#audio-effects").fill("70");
  await page.locator("#audio-ambience").fill("30");
  assert.equal(await page.evaluate(() => __lab.audio.levels.music), 0.62);
  await page.click("#close-settings");
  const stats = await page.evaluate(
    async (duration) => {
      const a = __lab.audio,
        data = new Float32Array(a.analyser.fftSize),
        levels = [];
      const dest = a.ctx.createMediaStreamDestination();
      a.analyser.connect(dest);
      const type = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";
      const rec = new MediaRecorder(dest.stream, { mimeType: type }),
        chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      const timer = setInterval(() => {
        a.analyser.getFloatTimeDomainData(data);
        let peak = 0,
          power = 0;
        for (const x of data) {
          peak = Math.max(peak, Math.abs(x));
          power += x * x;
        }
        levels.push({
          peak,
          rms: Math.sqrt(power / data.length),
          voices: a.voices.size,
          fps: __lab.metrics().fps,
        });
      }, 100);
      const charge = setInterval(() => {
        __lab.combat.cooldown = 0;
        __lab.combat.overcharge();
      }, 13000);
      await new Promise((r) => setTimeout(r, duration));
      clearInterval(timer);
      clearInterval(charge);
      const result = await new Promise((resolve) => {
        rec.onstop = async () => {
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
          let binary = "";
          for (const b of bytes) binary += String.fromCharCode(b);
          resolve(btoa(binary));
        };
        rec.stop();
      });
      a.analyser.disconnect(dest);
      dest.stream.getTracks().forEach((t) => t.stop());
      dest.disconnect();
      return { metrics: a.metrics(), levels, recording: result, type };
    },
    name === "Chrome" ? 94000 : 6000,
  );
  const ext = stats.type.startsWith("audio/webm") ? "webm" : "m4a";
  await fs.writeFile(
    `qa/audio-${name.toLowerCase()}.${ext}`,
    Buffer.from(stats.recording, "base64"),
  );
  delete stats.recording;
  assert(
    stats.levels.every((x) => x.peak < 0.94),
    "mix exceeded limiter ceiling",
  );
  assert(
    stats.levels.some((x) => x.rms > 0.005),
    "mix unexpectedly silent",
  );
  assert(stats.metrics.peakVoices <= 24);
  assert(
    stats.metrics.counts.gun > 1 &&
      stats.metrics.counts.boom > 0 &&
      stats.metrics.counts.tesla > 0 &&
      stats.metrics.counts.ballista > 0,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  const metrics = stats.metrics;
  const levels = {
    maxPeak: Math.max(...stats.levels.map((x) => x.peak)),
    averageRms:
      stats.levels.reduce((s, x) => s + x.rms, 0) / stats.levels.length,
    minFps: Math.min(...stats.levels.map((x) => x.fps)),
    samples: stats.levels.length,
  };
  await page.reload();
  await page.waitForFunction(() => window.__lab);
  assert.equal(await page.evaluate(() => __lab.audio.levels.music), 0.62);
  assert.equal(await page.evaluate(() => __lab.audio.enabled), false);
  report.engines.push({
    name,
    errors,
    decoded,
    metrics,
    levels,
    checks: [
      "opt-in lazy load",
      "22 assets decoded",
      "synchronized music duration",
      "pause/mute suspend",
      "resume keeps 3 loops",
      "volume persistence without autoplay",
      "bounded voices",
      "limiter headroom",
      "battle event coverage",
      name === "Chrome"
        ? "full 87-second musical loop crossed"
        : "short WebKit capture",
    ],
  });
  await browser.close();
  console.log(name, JSON.stringify({ metrics, levels }));
}
// Downloadable HTML must also play without an external audio fetch.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const p = await browser.newPage();
const external = [];
p.on("request", (r) => {
  if (/\/audio\/.*\.(wav|mp3)/.test(r.url())) external.push(r.url());
});
await p.goto(base + "Deadwood.html");
await p.waitForFunction(() => window.__lab);
await p.click("#sound");
await p.waitForFunction(() => __lab.audio.ready, null, { timeout: 30000 });
assert.equal(external.length, 0);
report.standalone = {
  buffers: await p.evaluate(() => __lab.audio.buffers.size),
  externalAudioRequests: external,
};
await browser.close();
await fs.writeFile("qa/audio.json", JSON.stringify(report, null, 2) + "\n");
console.log("Audio verification passed");
