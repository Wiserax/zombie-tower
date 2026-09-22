import { chromium, webkit } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://localhost:5197",
  results = [];
for (const engine of ["chrome", "webkit"]) {
  const b =
    engine === "chrome"
      ? await chromium.launch({ channel: "chrome", headless: true })
      : await webkit.launch();
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await p.goto(base);
  await p.waitForFunction(() => __lab);
  await p.waitForTimeout(1500);
  const reduced = await p.evaluate(() => {
    __lab.combat.overcharge();
    __lab.view.update(0.02);
    __lab.view.render();
    const v = __lab.view;
    return {
      shakeEnabled: v.shakeEnabled,
      camera: [v.camera.position.x, v.camera.position.z],
      shimmer: getComputedStyle(
        document.querySelector("#overcharge"),
        "::after",
      ).display,
    };
  });
  assert.equal(reduced.shakeEnabled, false);
  assert.deepEqual(reduced.camera, [30, 36]);
  assert.equal(reduced.shimmer, "none");
  const canLose = await p.evaluate(() => {
    window.__contextTest = __lab.view.renderer
      .getContext()
      .getExtension("WEBGL_lose_context");
    return !!__contextTest;
  });
  let recovery = null;
  if (canLose) {
    await p.evaluate(() => __contextTest.loseContext());
    await p.waitForFunction(
      () => !document.querySelector("#graphics-restoring").hidden,
    );
    const t = await p.evaluate(() => ({
      time: __lab.horde.time,
      streak: __lab.streak.remaining,
    }));
    await p.waitForTimeout(400);
    assert.deepEqual(
      await p.evaluate(() => ({
        time: __lab.horde.time,
        streak: __lab.streak.remaining,
      })),
      t,
      "Lost graphics kept advancing the unseen battle",
    );
    await p.evaluate(() => __contextTest.restoreContext());
    await p.waitForFunction(
      () => document.querySelector("#graphics-restoring").hidden,
    );
    await p.waitForTimeout(900);
    recovery = await p.evaluate(() => ({
      lost: __lab.view.renderer.getContext().isContextLost(),
      time: __lab.horde.time,
      visible: __lab.view.visible,
      draws: __lab.metrics().drawCalls,
      audio: __lab.audio.metrics().state,
    }));
    assert(!recovery.lost);
    assert(recovery.time > t.time);
    assert(recovery.visible > 0);
    assert(recovery.draws > 20);
    assert.equal(recovery.audio, "uninitialized");
    await p.locator("#pause").click();
    await p.evaluate(() => __contextTest.loseContext());
    await p.waitForFunction(
      () => !document.querySelector("#graphics-restoring").hidden,
    );
    await p.evaluate(() => __contextTest.restoreContext());
    await p.waitForFunction(
      () => document.querySelector("#graphics-restoring").hidden,
    );
    const paused = await p.evaluate(() => __lab.horde.time);
    await p.waitForTimeout(250);
    assert.equal(
      await p.evaluate(() => __lab.horde.time),
      paused,
      "Context restore silently resumed a paused game",
    );
    await p.locator("#resume").click();
  }
  let touch = null;
  await p.locator("#settings-toggle").tap();
  if (engine === "chrome") {
    const box = await p.locator("#settings").boundingBox(),
      cdp = await p.context().newCDPSession(p),
      x = box.x + box.width * 0.65,
      y = box.y + box.height * 0.82;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - i * 18 }],
      });
      await p.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await p.waitForTimeout(250);
    touch = await p.evaluate(() => ({
      scroll: document.querySelector("#settings").scrollTop,
      bodyY: window.scrollY,
    }));
    assert(touch.scroll > 40);
    assert.equal(touch.bodyY, 0);
  }
  // Closing remains available after a long-panel scroll.
  await p.locator("#settings").evaluate((el) => (el.scrollTop = 0));
  await p.evaluate(() => {
    __lab.combat.cooldown = 0;
  });
  await p.locator("#bars-mode").focus();
  await p.keyboard.press("Space");
  assert.equal(
    await p.evaluate(() => __lab.combat.cooldown),
    0,
    "Dropdown keyboard input fired Overcharge",
  );
  await p.keyboard.press("Enter");
  await p.locator("#close-settings").tap();
  await p.locator("#pause").focus();
  await p.keyboard.press("Space");
  assert.equal(
    await p.evaluate(() => __lab.combat.cooldown),
    0,
    "Pause keyboard input fired Overcharge",
  );
  assert(await p.locator("#paused").isVisible());
  await p.locator("#resume").tap();
  await p.locator("#battlefield").tap({ position: { x: 80, y: 500 } });
  await p.keyboard.press("Space");
  assert(
    await p.evaluate(() => __lab.combat.cooldown > 0),
    "Battlefield Space shortcut stopped working",
  );
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(250);
  const short = await p.evaluate(() => {
    const r = (s) => {
      const b = document.querySelector(s).getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    };
    return {
      active: document.querySelector("#game-shell").classList.contains("short"),
      stats: r(".battle-stats"),
      controls: r(".top-controls"),
      streak: r("#streak"),
      combo: r("#combo"),
      footer: r("footer"),
      safeTop: __lab.view.numbers.safeTop,
      safeBottom: __lab.view.numbers.safeBottom,
    };
  });
  assert(short.active);
  assert(short.stats.right <= short.controls.left);
  assert(short.streak.bottom <= short.combo.top);
  assert(
    short.combo.bottom + 50 < short.footer.top,
    "No readable battle band in short viewport",
  );
  await p.screenshot({ path: `qa/${engine}-feedback-short.png` });
  assert.deepEqual(errors, []);
  results.push({ engine, reduced, recovery, touch, short, errors });
  await b.close();
  console.log(engine, "lifecycle checks passed");
}
await fs.writeFile(
  "qa/feedback-lifecycle.json",
  JSON.stringify({ date: new Date().toISOString(), base, results }, null, 2),
);
