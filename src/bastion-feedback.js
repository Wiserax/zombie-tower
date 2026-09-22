const TAU = Math.PI * 2;

// Cosmetic strikes follow the attacking arm cycle. Reuse existing particle pools;
// at most one chip burst per wall sector per 0.3s, even when the wall is surrounded.
export class BastionFeedback {
  constructor(fx, sparks) {
    this.fx = fx;
    this.sparks = sparks;
    this.time = 0;
    this.sectors = new Float32Array(8);
    this.attackers = 0;
    this.strikes = 0;
    this.smokeClock = 0;
    this.onStrike = () => {};
  }
  update(dt, h) {
    const before = this.time;
    this.time += dt;
    this.attackers = 0;
    for (let j = 0; j < 8; j++)
      this.sectors[j] = Math.max(0, this.sectors[j] - dt);
    for (let i = 0; i < h.hp.length; i++) {
      if (h.hp[i] <= 0) continue;
      const x = h.x[i],
        z = h.z[i],
        r = Math.hypot(x, z);
      if (r >= 6.5) continue;
      this.attackers++;
      if (
        dt <= 0 ||
        Math.floor((this.time * 7 + h.phase[i]) / TAU) ===
          Math.floor((before * 7 + h.phase[i]) / TAU)
      )
        continue;
      const angle = Math.atan2(x, z),
        sector = Math.min(7, Math.floor(((angle + Math.PI) / TAU) * 8));
      if (this.sectors[sector] > 0) continue;
      this.sectors[sector] = 0.3;
      const px = (x / r) * 5.82,
        pz = (z / r) * 5.82;
      this.sparks.hit(px, 1.25, pz, 0, h.type[i] === 2);
      this.fx.burst(
        px,
        1.15,
        pz,
        h.type[i] === 2 ? 6 : 3,
        0xb8b18b,
        h.type[i] === 2 ? 2.7 : 1.7,
      );
      this.fx.smoke.emit(
        px,
        0.8,
        pz,
        0.8,
        0xb4ac90,
        0.45,
        (x / r) * 0.45,
        0.25,
        (z / r) * 0.45,
        0.2,
        1.4,
      );
      this.strikes++;
      this.onStrike(x);
    }
    this.smokeClock -= dt;
    if (h.health < 45 && dt > 0 && this.smokeClock <= 0) {
      this.smokeClock = 0.25;
      this.fx.smoke.emit(
        -2.3,
        2.1,
        1.4,
        0.65,
        0x3c3e38,
        1.7,
        -0.1,
        1,
        0.2,
        0.28,
        2.2,
      );
    }
  }
}
