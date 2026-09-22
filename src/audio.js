// Sample-based siege mix. One context, bounded transient voices, two synchronized score stems.
export const AUDIO_FILES = [
  "gun0.wav",
  "gun1.wav",
  "gun2.wav",
  "launch.wav",
  "boom0.wav",
  "boom1.wav",
  "ballista.wav",
  "tesla.wav",
  "overcharge.wav",
  "ui.wav",
  "open.wav",
  "close.wav",
  "focus.wav",
  "ready.wav",
  "hit.wav",
  "death.wav",
  "horde0.wav",
  "horde1.wav",
  "pack.wav",
  "siege-bed.mp3",
  "siege-drums.mp3",
  "wind.mp3",
];
const LOOP = (32 * 4 * 60) / 88;
const RULES = {
  gun: [0.045, 3, 0.15, 1],
  launch: [0.18, 2, 0.42, 2],
  boom: [0.12, 3, 0.65, 4],
  ballista: [0.2, 2, 0.23, 2],
  tesla: [0.3, 2, 0.34, 3],
  overcharge: [1, 1, 0.76, 8],
  ui: [0.055, 2, 0.22, 6],
  open: [0.12, 1, 0.24, 6],
  close: [0.12, 1, 0.2, 6],
  focus: [0.13, 1, 0.19, 5],
  ready: [3, 1, 0.24, 5],
  pack: [3, 1, 0.2, 5],
  hit: [0.7, 2, 0.28, 3],
  death: [0.28, 2, 0.15, 0],
  horde: [3.5, 1, 0.14, 0],
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export class SiegeAudio {
  constructor() {
    this.enabled = false;
    this.blocked = false;
    this.ready = false;
    this.voices = new Set();
    this.buffers = new Map();
    this.last = new Map();
    this.counts = {};
    this.dropped = 0;
    this.peakVoices = 0;
    this.variant = 0;
    this.levels = { music: 0.45, effects: 0.75, ambience: 0.35 };
    this.lastHealth = 100;
    this.nextHorde = 4;
    this.duckUntil = 0;
    try {
      const saved = JSON.parse(localStorage.getItem("deadwood-audio-v1"));
      for (const key in this.levels)
        if (Number.isFinite(saved?.[key]))
          this.levels[key] = clamp(saved[key], 0, 1);
    } catch {}
  }
  async enable() {
    this.enabled = true;
    if (!this.ctx) this.create();
    // Resume synchronously inside the original user gesture, including Safari.
    await this.ctx.resume();
    this.loading ??= this.load().catch((e) => {
      this.loading = null;
      throw e;
    });
    try {
      await this.loading;
    } catch (e) {
      this.enabled = false;
      this.sync();
      throw e;
    }
    if (!this.loopsStarted) this.startLoops();
    this.sync();
  }
  create() {
    const c = (this.ctx = new (window.AudioContext ||
      window.webkitAudioContext)({ latencyHint: "interactive" }));
    this.master = c.createGain();
    this.master.gain.value = 0;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 32;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -13;
    comp.knee.value = 14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const limiter = c.createWaveShaper();
    const curve = new Float32Array(4097);
    // Transparent below -3 dBFS, soft knee to a hard output ceiling below full scale.
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1,
        a = Math.abs(x);
      curve[i] =
        Math.sign(x) *
        (a <= 0.7 ? a : 0.7 + 0.23 * Math.tanh((a - 0.7) / 0.23));
    }
    limiter.curve = curve;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master
      .connect(hp)
      .connect(comp)
      .connect(limiter)
      .connect(this.analyser)
      .connect(c.destination);
    this.buses = {};
    for (const key of ["music", "effects", "ambience"]) {
      const g = c.createGain();
      g.gain.value = this.levels[key];
      g.connect(this.master);
      this.buses[key] = g;
    }
    this.bed = c.createGain();
    this.bed.gain.value = 0.31;
    this.bed.connect(this.buses.music);
    this.drums = c.createGain();
    this.drums.gain.value = 0.1;
    this.drums.connect(this.buses.music);
    const reverb = c.createConvolver(),
      impulse = c.createBuffer(
        2,
        Math.floor(c.sampleRate * 0.65),
        c.sampleRate,
      );
    for (let ch = 0; ch < 2; ch++) {
      const a = impulse.getChannelData(ch);
      let s = 921 + ch;
      for (let i = 0; i < a.length; i++) {
        s = (s * 16807) % 2147483647;
        a[i] =
          ((s / 2147483647) * 2 - 1) * Math.exp((-i / a.length) * 9) * 0.35;
      }
    }
    reverb.buffer = impulse;
    const wet = c.createGain();
    wet.gain.value = 0.1;
    reverb.connect(wet).connect(this.buses.effects);
    this.reverb = reverb;
  }
  async load() {
    await Promise.all(
      AUDIO_FILES.map(async (file) => {
        if (this.buffers.has(file)) return;
        const embedded = document.getElementById("audio-assets");
        const url = embedded
          ? (this.embedded ??= JSON.parse(embedded.textContent))[file]
          : new URL("audio/" + file, document.baseURI).href;
        const r = await fetch(url);
        if (!r.ok) throw new Error("Audio asset failed: " + file);
        const b = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(file, b);
      }),
    );
    this.ready = true;
  }
  startLoops() {
    const now = this.ctx.currentTime + 0.08;
    this.loops = [];
    for (const [file, bus, level] of [
      ["siege-bed.mp3", this.bed, 1],
      ["siege-drums.mp3", this.drums, 1],
      ["wind.mp3", this.buses.ambience, 0.13],
    ]) {
      const s = this.ctx.createBufferSource(),
        g = this.ctx.createGain();
      s.buffer = this.buffers.get(file);
      s.loop = true;
      s.loopEnd = file.startsWith("siege")
        ? Math.min(LOOP, s.buffer.duration)
        : s.buffer.duration;
      g.gain.value = level;
      s.connect(g).connect(bus);
      s.start(now);
      this.loops.push(s);
    }
    this.loopsStarted = true;
  }
  disable() {
    this.enabled = false;
    this.sync();
  }
  setBlocked(value) {
    this.blocked = value;
    this.sync();
  }
  sync() {
    if (!this.ctx) return;
    clearTimeout(this.suspendTimer);
    const audible = this.enabled && !this.blocked && this.ready;
    if (audible) {
      this.ctx.resume();
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.12);
    } else {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.012);
      this.suspendTimer = setTimeout(() => {
        if (!this.enabled || this.blocked) this.ctx.suspend();
      }, 90);
    }
  }
  setLevel(key, value) {
    this.levels[key] = clamp(value, 0, 1);
    if (this.ctx)
      this.buses[key].gain.setTargetAtTime(
        this.levels[key],
        this.ctx.currentTime,
        0.04,
      );
    try {
      localStorage.setItem("deadwood-audio-v1", JSON.stringify(this.levels));
    } catch {}
  }
  play(type, position = 0) {
    if (
      !this.enabled ||
      !this.ready ||
      this.blocked ||
      this.ctx.state !== "running"
    )
      return false;
    const rule = RULES[type];
    if (!rule) return false;
    const [interval, limit, volume, priority] = rule,
      now = this.ctx.currentTime;
    if (now - (this.last.get(type) ?? -999) < interval) return false;
    const same = [...this.voices].filter((v) => v.type === type);
    if (same.length >= limit) return false;
    if (this.voices.size >= 24) {
      const old = [...this.voices].find((v) => v.priority < priority);
      if (!old) {
        this.dropped++;
        return false;
      }
      old.stop();
    }
    this.last.set(type, now);
    let file = type;
    if (type === "gun") file += this.variant++ % 3;
    if (type === "boom" || type === "horde") file += this.variant++ % 2;
    const buffer = this.buffers.get(file + ".wav");
    if (!buffer) return false;
    const s = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      pan = this.ctx.createStereoPanner();
    s.buffer = buffer;
    s.playbackRate.value =
      type === "pack" || type === "ready" ? 1 : 0.96 + Math.random() * 0.08;
    gain.gain.value = volume * (0.94 + Math.random() * 0.12);
    pan.pan.value = clamp(position, -0.65, 0.65);
    const bus = type === "horde" ? this.buses.ambience : this.buses.effects;
    s.connect(gain).connect(pan).connect(bus);
    if (["boom", "overcharge", "tesla", "ballista"].includes(type))
      gain.connect(this.reverb);
    const voice = {
      type,
      priority,
      stop: () => {
        s.stop();
        this.voices.delete(voice);
      },
    };
    s.onended = () => {
      s.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.voices.delete(voice);
    };
    this.voices.add(voice);
    this.peakVoices = Math.max(this.peakVoices, this.voices.size);
    this.counts[type] = (this.counts[type] || 0) + 1;
    s.start();
    if (type === "overcharge") this.duckUntil = now + 1.2;
    return true;
  }
  update(dt, horde, cooldown) {
    if (!this.ready || !this.enabled || this.blocked) return;
    const now = this.ctx.currentTime,
      tension = clamp(
        (100 - horde.health) / 75 + (horde.alive - 300) / 1800,
        0,
        1,
      );
    const duck = now < this.duckUntil ? 0.32 : 1;
    this.bed.gain.setTargetAtTime(0.31 * duck, now, 0.18);
    this.drums.gain.setTargetAtTime((0.1 + tension * 0.24) * duck, now, 0.7);
    if (horde.health < this.lastHealth - 0.05) this.play("hit");
    this.lastHealth = horde.health;
    this.nextHorde -= dt;
    if (this.nextHorde <= 0) {
      this.play("horde", (Math.random() - 0.5) * 1.1);
      this.nextHorde = 6 + Math.random() * 5;
    }
    if (this.previousCooldown > 0 && cooldown === 0) this.play("ready");
    this.previousCooldown = cooldown;
  }
  metrics() {
    return {
      enabled: this.enabled,
      ready: this.ready,
      state: this.ctx?.state ?? "uninitialized",
      voices: this.voices.size,
      peakVoices: this.peakVoices,
      buffers: this.buffers.size,
      loops: this.loops?.length ?? 0,
      counts: { ...this.counts },
      dropped: this.dropped,
    };
  }
}
