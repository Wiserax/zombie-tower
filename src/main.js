import "./style.css";
import { Horde } from "./sim.js";
import { Battlefield } from "./renderer.js";
import { Combat } from "./combat.js";
import { SiegeAudio } from "./audio.js";
const siegeAudio = new SiegeAudio();
const $ = (s) => document.querySelector(s),
  h = new Horde(),
  view = new Battlefield($("#battlefield"), h),
  combat = new Combat(h, view);
h.onDeath = (i, e, k) => {
  view.death(i, e, k);
  if (Math.hypot(h.x[i], h.z[i]) < 20) siegeAudio.play("death", h.x[i] / 35);
};
h.onHit = (i, e) => {
  if (Math.random() < 0.35)
    view.fx.burst(h.x[i], 0.8, h.z[i], 2, e === 1 ? 0x8befff : 0xc3a56b, 1.5);
};
let paused = false,
  frames = [],
  simTimes = [],
  renderTimes = [],
  last = performance.now(),
  ui = 0,
  comboTimer = 0,
  comboCount = 0,
  elapsed = 0;
combat.onPack = (n) => {
  if (n < 5 || (comboTimer > 0 && n < comboCount)) return;
  comboCount = n;
  if (n >= 20) siegeAudio.play("pack");
  $("#combo span").textContent = n;
  $("#combo").classList.add("show");
  comboTimer = n >= 100 ? 1.8 : 1.2;
};
function pause(p) {
  paused = p;
  siegeAudio.setBlocked(p || document.hidden);
  $("#paused").hidden = !p;
  $("#pause").textContent = p ? "▶" : "Ⅱ";
}
$("#pause").onclick = () => pause(!paused);
$("#resume").onclick = () => pause(false);
$("#overcharge").onclick = () => combat.overcharge();
addEventListener("keydown", (e) => {
  if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    if (!paused) combat.overcharge();
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
  if (paused) return;
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
new ResizeObserver(() => view.resize()).observe($("#game-shell"));
document.addEventListener("visibilitychange", () => {
  last = performance.now();
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
    view.update(dt);
    view.render();
  },
};
function frame(now) {
  requestAnimationFrame(frame);
  // A first rAF timestamp can precede script initialization after shader compilation.
  const raw = Math.max(0, now - last);
  last = now;
  if (document.hidden) return;
  // Some browsers/emulation change DPR without resize or media-query events.
  if (view.displayDpr !== devicePixelRatio) view.resize();
  const dt = Math.min(raw / 1000, 0.04);
  if (!paused) {
    elapsed += dt;
    const t = performance.now();
    h.step(dt);
    combat.step(dt);
    siegeAudio.update(dt, h, combat.cooldown);
    if (h.health <= 0) {
      combat.cooldown = 0;
      combat.overcharge();
      h.health = 100;
      $("#announcement small").textContent = "VISUAL LAB · AUTOMATIC RESET";
      $("#announcement strong").textContent = "A NEW LAST STAND";
      $("#announcement").style.opacity = 1;
      elapsed = 0;
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
    $("#overcharge").disabled = combat.cooldown > 0;
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
