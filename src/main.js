import "./style.css";
import { Horde } from "./sim.js";
import { Battlefield } from "./renderer.js";
import { Combat } from "./combat.js";
import { SiegeAudio } from "./audio.js";
import { KillStreak } from "./streak.js";
const siegeAudio = new SiegeAudio(),
  streak = new KillStreak();
const $ = (s) => document.querySelector(s),
  h = new Horde(),
  view = new Battlefield($("#battlefield"), h),
  combat = new Combat(h, view);
view.bastionFeedback.onStrike = (x) => siegeAudio.play("hit", x / 35);
h.onDeath = (i, e, k) => {
  view.death(i, e, k);
  if (!automaticReset) streak.kill();
  if (Math.hypot(h.x[i], h.z[i]) < 20) siegeAudio.play("death", h.x[i] / 35);
};
h.onDamage = (i, element, amount, killed, knock) => {
  if (!view.feedbackVisible(h.x[i], 1.5, h.z[i], 2)) return;
  view.hitSparks.hit(
    h.x[i],
    h.type[i] === 2 ? 1.8 : 1.05,
    h.z[i],
    element,
    h.type[i] === 2,
  );
  const kind = element === 1 ? "electric" : element === 2 ? "blast" : "hit";
  // Individual numbers serve single targets. AOE deaths are represented by one pack total.
  if (element !== 2 && !(element === 1 && killed && knock >= 9))
    view.numbers.add(
      h.x[i],
      h.type[i] === 2 ? 3.6 : 2.1,
      h.z[i],
      amount,
      kind,
      i + 2048 * h.generation[i],
    );
};
h.onHit = (i, e) => {
  if (!view.feedbackVisible(h.x[i], 1.1, h.z[i], 1)) return;
  view.fx.burst(
    h.x[i],
    1.1,
    h.z[i],
    e === 1 ? 4 : 3,
    e === 1 ? 0x8befff : 0xffd478,
    e === 1 ? 2.5 : 1.8,
  );
};
let paused = false,
  graphicsLost = false,
  automaticReset = false,
  frames = [],
  simTimes = [],
  renderTimes = [],
  last = performance.now(),
  ui = 0,
  comboTimer = 0,
  comboCount = 0,
  elapsed = 0,
  toastTime = 0,
  streakUi = -1,
  surgeToast = 0;
combat.onPack = (n, x = 0, z = 0, kind = "pack") => {
  if (automaticReset) return;
  if (n < 3 || (kind !== "surge" && surgeToast > 0)) return;
  if (kind === "surge") {
    surgeToast = 1.25;
    view.numbers.clearPacks();
  }
  view.numbers.add(x, kind === "surge" ? 8 : 2.8, z, n, kind);
  if (n < 8 || (comboTimer > 0 && n < comboCount)) return;
  comboCount = n;
  if (n >= 20) siegeAudio.play("pack");
  $("#combo span").textContent = n;
  $("#combo small").textContent =
    kind === "surge" ? "SURGE CLEAR" : "MULTI-KILL";
  $("#combo").classList.remove("pop");
  void $("#combo").offsetWidth;
  $("#combo").classList.add("show", "pop");
  comboTimer = n >= 100 ? 1.6 : 1.1;
};
streak.onMilestone = (tier, count) => {
  $("#streak-title").textContent = tier.label;
  $("#streak").dataset.tier = tier.color;
  $("#streak").classList.remove("milestone");
  void $("#streak").offsetWidth;
  $("#streak").classList.add("milestone");
  siegeAudio.play("pack");
};
streak.onEnd = (count) => {
  if (count < 10) return;
  $("#streak-title").textContent = "CHAIN COMPLETE";
  $("#streak-count").textContent =
    count < 10000 ? count : `${(count / 1000).toFixed(1)}K`;
  toastTime = 1.3;
};
function updateStreak(dt) {
  streak.update(dt);
  surgeToast = Math.max(0, surgeToast - dt);
  toastTime = Math.max(0, toastTime - dt);
  $("#streak").classList.toggle("active", streak.count >= 3 || toastTime > 0);
  if (streak.revision !== streakUi) {
    streakUi = streak.revision;
    $("#streak").dataset.long = String(streak.count >= 10000);
    $("#kills").textContent = h.kills.toLocaleString();
    if (streak.count > 0) {
      $("#streak-count").textContent =
        streak.count < 10000
          ? streak.count
          : `${(streak.count / 1000).toFixed(1)}K`;
      $("#streak-count").title = String(streak.count);
      if (streak.tier === 0) {
        $("#streak-title").textContent = "KILL CHAIN";
        $("#streak").dataset.tier = "mint";
      }
    }
    $("#streak-best").textContent =
      streak.count >= streak.best && streak.count >= 25
        ? "NEW BEST"
        : `BEST ${streak.best < 10000 ? streak.best : (streak.best / 1000).toFixed(1) + "K"}`;
  }
  $("#streak-meter").style.transform =
    `scaleX(${streak.remaining / streak.window})`;
}
function pause(p) {
  paused = p;
  siegeAudio.setBlocked(p || document.hidden || graphicsLost);
  $("#paused").hidden = !p;
  $("#pause").textContent = p ? "▶" : "Ⅱ";
}
$("#pause").onclick = () => pause(!paused);
$("#resume").onclick = () => pause(false);
$("#overcharge").onclick = () => combat.overcharge();
addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    !(
      e.target instanceof Element &&
      e.target.closest("input, select, textarea, button, [contenteditable]")
    )
  ) {
    e.preventDefault();
    if (!paused && !graphicsLost) combat.overcharge();
  }
  if (e.code === "Escape") pause(!paused);
});
document.querySelectorAll("[data-weapon]").forEach(
  (b) =>
    (b.onclick = () => {
      const key = b.dataset.weapon;
      combat.enabled[key] = !combat.enabled[key];
      b.classList.toggle("active", combat.enabled[key]);
      b.setAttribute("aria-pressed", combat.enabled[key]);
    }),
);
$("#settings-toggle").onclick = () =>
  ($("#settings").hidden = !$("#settings").hidden);
$("#close-settings").onclick = () => ($("#settings").hidden = true);
document.querySelectorAll("[data-density]").forEach(
  (b) =>
    (b.onclick = () => {
      h.fill(+b.dataset.density);
      document
        .querySelectorAll("[data-density]")
        .forEach((x) => x.classList.toggle("selected", x === b));
    }),
);
document.querySelectorAll("[data-style]").forEach((button) => {
  button.onclick = () => {
    view.setStyle(button.dataset.style);
    document.querySelectorAll("[data-style]").forEach((b) => {
      b.classList.toggle("selected", b === button);
      b.setAttribute("aria-pressed", b === button);
    });
  };
});
$("#pixel-toggle").onchange = (e) => {
  view.pixelFilter = e.target.checked;
  view.resize();
};
$("#lights-toggle").onchange = (e) => {
  view.lighting.enabled = e.target.checked;
  view.update(0);
  view.render();
};
$("#bars-mode").onchange = (e) => {
  view.healthBars.mode = e.target.value;
  view.update(0);
  view.render();
};
$("#numbers-toggle").onchange = (e) => {
  view.numbers.enabled = e.target.checked;
  view.update(0);
  view.render();
};
$("#stats-toggle").onchange = (e) =>
  ($("#performance").hidden = !e.target.checked);
$("#shake-toggle").checked = view.shakeEnabled;
$("#shake-toggle").onchange = (e) => (view.shakeEnabled = e.target.checked);
$("#zoom-in").onclick = () => {
  view.zoom = Math.min(1.7, view.zoom + 0.15);
  view.resize();
};
$("#zoom-out").onclick = () => {
  view.zoom = Math.max(0.7, view.zoom - 0.15);
  view.resize();
};
$("#battlefield").addEventListener("pointerdown", (e) => {
  if (paused || graphicsLost) return;
  const p = view.point(e.clientX, e.clientY);
  if (p) {
    combat.focus = { x: p.x, z: p.z };
    combat.focusTime = 5;
    siegeAudio.play("focus", p.x / 35);
    const m = $("#focus-marker");
    const rect = $("#battlefield").getBoundingClientRect();
    m.style.left = e.clientX - rect.left + "px";
    m.style.top = e.clientY - rect.top + "px";
    m.classList.remove("show");
    void m.offsetWidth;
    m.classList.add("show");
  }
});
function feedbackInsets() {
  const canvas = view.canvas.getBoundingClientRect(),
    footer = $("footer").getBoundingClientRect();
  view.numbers.safeTop = $("#combo").offsetTop + $("#combo").offsetHeight + 8;
  view.numbers.safeBottom = canvas.bottom - footer.top + 8;
}
new ResizeObserver(() => {
  view.resize();
  feedbackInsets();
}).observe($("#game-shell"));
document.fonts.ready.then(feedbackInsets);
document.addEventListener("visibilitychange", () => {
  last = performance.now();
  siegeAudio.setBlocked(paused || document.hidden || graphicsLost);
});
view.canvas.addEventListener("webglcontextlost", () => {
  graphicsLost = true;
  $("#graphics-restoring").hidden = false;
  siegeAudio.setBlocked(true);
});
view.canvas.addEventListener("webglcontextrestored", () => {
  view.resize();
  graphicsLost = false;
  last = performance.now();
  $("#graphics-restoring").hidden = true;
  siegeAudio.setBlocked(paused || document.hidden);
});
// Silent until an explicit click. Volume preferences persist, autoplay consent does not.
$("#sound").onclick = async () => {
  const button = $("#sound");
  if (siegeAudio.enabled) {
    siegeAudio.disable();
  } else {
    button.disabled = true;
    button.textContent = "…";
    $("#audio-status").textContent = "Preparing soundtrack…";
    try {
      await siegeAudio.enable();
      $("#audio-status").textContent = "Siege mix ready";
      siegeAudio.play("open");
    } catch {
      $("#audio-status").textContent = "Sound could not load. Tap ♪ to retry.";
    } finally {
      button.disabled = false;
    }
  }
  button.innerHTML = siegeAudio.enabled ? "♪" : '♪<span class="slash">╱</span>';
  button.setAttribute(
    "aria-label",
    siegeAudio.enabled ? "Mute sound" : "Enable sound",
  );
  button.title = siegeAudio.enabled ? "Mute sound" : "Enable sound";
  button.setAttribute("aria-pressed", String(siegeAudio.enabled));
};
for (const key of ["music", "effects", "ambience"]) {
  const input = $("#audio-" + key);
  input.value = Math.round(siegeAudio.levels[key] * 100);
  input.oninput = () => siegeAudio.setLevel(key, Number(input.value) / 100);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.id === "sound" || b.id === "overcharge" || b.id === "pause")
    return;
  siegeAudio.play(
    b.id === "settings-toggle"
      ? "open"
      : b.id === "close-settings"
        ? "close"
        : "ui",
  );
});
combat.onSound = (type, gain, x = 0) => siegeAudio.play(type, x / 35);
function percentile(a, p) {
  const b = [...a].sort((a, b) => a - b);
  return b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0;
}
function metrics() {
  return {
    style: view.style,
    pixelFilter: view.pixelFilter,
    resolution: [view.canvas.width, view.canvas.height],
    alive: h.alive,
    visible: view.visible,
    rendered: view.units.reduce((n, u) => n + u.mesh.count, 0),
    wallStrikes: view.bastionFeedback.strikes,
    wallAttackers: view.bastionFeedback.attackers,
    electrified: view.shockArcs.count,
    hitSparks: view.hitSparks.events.length,
    lightEvents: view.lighting.events.length,
    healthBars: view.healthBars.geo.instanceCount,
    damageLabels: view.numbers.events.length,
    damageGlyphs: view.numbers.geo.instanceCount,
    streak: streak.count,
    bestStreak: streak.best,
    impactFlashes: view.impacts.blasts.length,
    muzzleFlashes: view.impacts.muzzles.length,
    target: h.target,
    kills: h.kills,
    corpses: view.dead.length,
    particles: view.fx.mesh.count,
    drawCalls: view.renderer.info.render.calls,
    triangles: view.renderer.info.render.triangles,
    fps: Math.round(
      1000 / (frames.reduce((a, b) => a + b, 0) / frames.length || 16.67),
    ),
    frameP95: percentile(frames, 0.95),
    simP95: percentile(simTimes, 0.95),
    renderP95: percentile(renderTimes, 0.95),
    geometries: view.renderer.info.memory.geometries,
    textures: view.renderer.info.memory.textures,
    neighborChecks: h.neighborChecks,
    elapsed,
  };
}
window.__lab = {
  horde: h,
  view,
  combat,
  audio: siegeAudio,
  streak,
  metrics,
  pause,
  setDensity: (n) => h.fill(n),
  resetMetrics: () => {
    frames = [];
    simTimes = [];
    renderTimes = [];
  },
  step: (dt = 1 / 60) => {
    h.step(dt);
    combat.step(dt);
    updateStreak(dt);
    view.update(dt);
    view.render();
  },
};
function frame(now) {
  requestAnimationFrame(frame);
  // A first rAF timestamp can precede script initialization after shader compilation.
  const raw = Math.max(0, now - last);
  last = now;
  if (document.hidden || graphicsLost) return;
  // Some browsers/emulation change DPR without resize or media-query events.
  if (view.displayDpr !== devicePixelRatio) view.resize();
  const dt = Math.min(raw / 1000, 0.04);
  if (!paused) {
    elapsed += dt;
    const t = performance.now();
    h.step(dt);
    combat.step(dt);
    updateStreak(dt);
    siegeAudio.update(dt, h, combat.cooldown);
    if (h.health <= 0) {
      automaticReset = true;
      combat.cooldown = 0;
      combat.overcharge();
      automaticReset = false;
      h.health = 100;
      streak.reset();
      toastTime = 0;
      comboTimer = comboCount = surgeToast = 0;
      view.numbers.events.length = 0;
      $("#combo").classList.remove("show", "pop");
      $("#streak").classList.remove("active", "milestone");
      $("#streak").dataset.tier = "mint";
      $("#announcement small").textContent = "VISUAL LAB · AUTOMATIC RESET";
      $("#announcement strong").textContent = "A NEW LAST STAND";
      $("#announcement").style.opacity = 1;
      ((elapsed = 0), (toastTime = 0), (streakUi = -1));
    }
    const s = performance.now();
    view.update(dt);
    view.render();
    const r = performance.now();
    frames.push(raw);
    simTimes.push(s - t);
    renderTimes.push(r - s);
    if (frames.length > 600) {
      frames.shift();
      simTimes.shift();
      renderTimes.shift();
    }
    comboTimer -= dt;
    if (comboTimer <= 0) $("#combo").classList.remove("show");
  }
  ui += dt;
  if (ui > 0.2) {
    ui = 0;
    $("#alive").textContent = h.alive.toLocaleString();
    $("#kills").textContent = h.kills.toLocaleString();
    $("#health").style.width = h.health + "%";
    $("#health-label").textContent = Math.ceil(h.health) + "%";
    $(".defense").dataset.state =
      h.health < 30 ? "critical" : h.health < 60 ? "damaged" : "healthy";
    $("#danger-vignette").style.opacity = String(
      Math.max(0, (45 - h.health) / 45) * 0.3,
    );
    $("#bastion-label").textContent =
      h.health < 30
        ? "CRITICAL"
        : view.bastionFeedback.attackers > 15
          ? "UNDER SIEGE"
          : "BASTION";
    $("#overcharge").disabled = combat.cooldown > 0;
    $("#overcharge").style.setProperty(
      "--charge",
      `${(1 - combat.cooldown / 12) * 100}%`,
    );
    $("#overcharge").classList.toggle("is-ready", combat.cooldown === 0);
    $("#charge-label").textContent =
      combat.cooldown > 0
        ? `RECHARGING · ${Math.ceil(combat.cooldown)}s`
        : "READY · SPACE";
    if (elapsed > 4) $("#announcement").style.opacity = 0;
    if (!$("#performance").hidden) {
      const m = metrics();
      $("#performance").textContent =
        `${m.fps} FPS · p95 ${m.frameP95.toFixed(1)}ms\n${m.alive} alive · ${m.visible} visible\n${m.drawCalls} draw calls · ${(m.triangles / 1000).toFixed(0)}k triangles\nsim p95 ${m.simP95.toFixed(2)}ms\n${m.particles} particles · ${m.corpses} bodies`;
    }
  }
}
// Compile the fixed effect materials before the first visible volley.
view.renderer.compile(view.scene, view.camera);
view.update(0);
view.render();
$("#loading").remove();
requestAnimationFrame(frame);
