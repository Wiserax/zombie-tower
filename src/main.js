import "./style.css";
import { Horde } from "./sim.js";
import { Battlefield } from "./renderer.js";
import { Combat } from "./combat.js";
const $ = (s) => document.querySelector(s),
  h = new Horde(),
  view = new Battlefield($("#battlefield"), h),
  combat = new Combat(h, view);
h.onDeath = (i, e, k) => view.death(i, e, k);
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
  elapsed = 0;
combat.onPack = (n) => {
  if (n < 5) return;
  $("#combo span").textContent = n;
  $("#combo").classList.add("show");
  comboTimer = 1.2;
};
function pause(p) {
  paused = p;
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
    const m = $("#focus-marker");
    m.style.left = e.clientX + "px";
    m.style.top = e.clientY + "px";
    m.classList.remove("show");
    void m.offsetWidth;
    m.classList.add("show");
  }
});
addEventListener("resize", () => view.resize());
document.addEventListener("visibilitychange", () => {
  last = performance.now();
});
// Sound is opt-in; the prototype and all automated verification start silently.
let audio = null,
  sound = false;
$("#sound").onclick = async () => {
  sound = !sound;
  if (sound) {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    await audio.resume();
  }
  $("#sound").innerHTML = sound ? "♪" : '♪<span class="slash">╱</span>';
  $("#sound").setAttribute("aria-label", sound ? "Mute sound" : "Enable sound");
};
combat.onSound = (type, gain) => {
  if (!sound || !audio || paused) return;
  const now = audio.currentTime,
    o = audio.createOscillator(),
    g = audio.createGain();
  o.connect(g);
  g.connect(audio.destination);
  o.type = type === "tesla" ? "sawtooth" : "triangle";
  const freq = { gun: 160, launch: 95, boom: 65, tesla: 380, overcharge: 130 }[
    type
  ];
  const dur = type === "overcharge" ? 0.7 : type === "gun" ? 0.06 : 0.25;
  o.frequency.setValueAtTime(freq, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(25, freq * 0.3), now + dur);
  g.gain.setValueAtTime(gain * 0.035, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur);
};
function percentile(a, p) {
  const b = [...a].sort((a, b) => a - b);
  return b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0;
}
function metrics() {
  return {
    alive: h.alive,
    visible: view.visible,
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
  const raw = now - last;
  last = now;
  if (document.hidden) return;
  const dt = Math.min(raw / 1000, 0.04);
  if (!paused) {
    elapsed += dt;
    const t = performance.now();
    h.step(dt);
    combat.step(dt);
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
view.update(0);
view.render();
$("#loading").remove();
requestAnimationFrame(frame);
