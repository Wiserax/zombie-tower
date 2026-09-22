export class Combat {
  constructor(horde, view) {
    this.h = horde;
    this.v = view;
    this.fx = view.fx;
    view.weaponFX.combat = this;
    this.enabled = { guns: true, tesla: true, mortar: true };
    this.clocks = [0, 0.06, 1, 1.8];
    this.tesla = 0.8;
    this.boltClock = 0.5;
    this.bolts = [];
    this.shells = [];
    this.cooldown = 0;
    this.focus = null;
    this.focusTime = 0;
    this.lastPack = 0;
    this.onPack = () => {};
    this.onSound = () => {};
  }
  volley() {
    for (const b of this.v.fort.ballistas) {
      const i = this.h.nearest(b.position.x, b.position.z, 23);
      if (i < 0) continue;
      const a = Math.atan2(
        this.h.x[i] - b.position.x,
        this.h.z[i] - b.position.z,
      );
      b.rotation.y = a;
      b.userData.kick = 1;
      this.onSound("ballista", 0.3, b.position.x);
      for (const offset of [-0.11, 0, 0.11])
        this.bolts.push({
          x: b.position.x,
          y: 2.5,
          z: b.position.z,
          dx: Math.sin(a + offset),
          dz: Math.cos(a + offset),
          life: 1.4,
          hits: 0,
          seen: new Set(),
        });
    }
  }
  target(range = 27) {
    if (this.focus && this.focusTime > 0) {
      const i = this.h.nearest(this.focus.x, this.focus.z, 8);
      if (i >= 0) return i;
    }
    return this.h.cluster(range);
  }
  fireGun(t) {
    const h = this.h,
      gun = this.v.fort.turrets[t],
      i = this.target(25);
    if (i < 0) return;
    const x = h.x[i],
      z = h.z[i],
      a = Math.atan2(x - gun.position.x, z - gun.position.z);
    gun.rotation.y = a;
    const s = [
      gun.position.x + Math.sin(a) * 1.5,
      2.63,
      gun.position.z + Math.cos(a) * 1.5,
    ];
    this.v.impacts.muzzle(...s, a);
    this.v.recoil[t] = 1;
    this.v.lighting.flash(s[0], s[2], "gun");
    this.fx.line(s, [x, 0.9, z], 0xffbb55, 0.085, 0.045);
    this.fx.line(s, [x, 0.9, z], 0xffffd4, 0.045, 0.014);
    this.fx.burst(...s, 3, 0xffd77e, 1.5);
    // Brass ejects sideways from the receiver, separate from the forward muzzle flash.
    this.fx.particle(
      gun.position.x,
      2.6,
      gun.position.z,
      Math.cos(a) * 2.2,
      1.7,
      -Math.sin(a) * 2.2,
      0.065,
      0xe1b15c,
      0.65,
    );
    this.fx.glow.emit(...s, 0.85, 0xffbf48, 0.12, 0, 0, 0, 1, 0);
    h.damage(i, 17, 0.4, 0);
    this.onSound("gun", 0.12, gun.position.x);
  }
  fireMortar(t) {
    const i = this.target(28);
    if (i < 0) return;
    const h = this.h,
      g = this.v.fort.turrets[t],
      x = h.x[i],
      z = h.z[i];
    g.rotation.y = Math.atan2(x - g.position.x, z - g.position.z);
    this.shells.push({
      sx: g.position.x,
      sz: g.position.z,
      x,
      z,
      time: 0,
      max: 1.2,
    });
    this.v.recoil[t] = 1.8;
    this.v.impacts.muzzle(
      g.position.x + Math.sin(g.rotation.y) * 1.1,
      3.3,
      g.position.z + Math.cos(g.rotation.y) * 1.1,
      g.rotation.y,
      true,
    );
    this.fx.burst(g.position.x, 3.2, g.position.z, 8, 0xffce78, 3);
    this.onSound("launch", 0.3, g.position.x);
  }
  zap() {
    const h = this.h;
    let i = this.target(25);
    if (i < 0) return;
    this.v.energy = 1;
    this.v.lighting.flash(h.x[i], h.z[i], "electric");
    let from = [0, 7.1, 0];
    const seen = new Set();
    for (let k = 0; k < 13 && i >= 0; k++) {
      seen.add(i);
      const to = [h.x[i], 1, h.z[i]];
      this.fx.lightning(from, to);
      h.damage(i, 74, 1.1, 1);
      from = to;
      let next = -1,
        best = 4.8 ** 2;
      for (let j = 0; j < h.hp.length; j++) {
        if (h.hp[j] <= 0 || seen.has(j)) continue;
        const d = (h.x[j] - from[0]) ** 2 + (h.z[j] - from[2]) ** 2;
        if (d < best) {
          best = d;
          next = j;
        }
      }
      i = next;
    }
    this.onSound("tesla", 0.25);
  }
  strike(x, z) {
    const n = this.h.blast(x, z, 4.3, 135);
    this.fx.explosion(x, z, 4.8);
    this.v.impacts.explosion(x, z, 4.8);
    this.v.shake = Math.max(this.v.shake, 0.8);
    this.v.lighting.flash(x, z, "shell");
    this.onSound("boom", 0.6, x);
    if (n >= 5) {
      this.lastPack = n;
      this.onPack(n, x, z, "pack");
    }
    return n;
  }
  overcharge() {
    if (this.cooldown > 0) return false;
    this.cooldown = 12;
    this.v.energy = 1.8;
    this.v.weaponFX.discharge();
    this.v.lighting.flash(0, 0, "surge");
    this.fx.ring(0, 0, 25, 0x93e9ff, 1.15);
    let n = 0;
    // One visible arc per angular sector: damage still reaches every enemy.
    // This keeps a 1,600-unit discharge readable instead of a solid white web.
    const arcs = new Array(12),
      distances = new Float32Array(12);
    for (let i = 0; i < this.h.hp.length; i++)
      if (this.h.hp[i] > 0 && Math.hypot(this.h.x[i], this.h.z[i]) < 23) {
        const x = this.h.x[i],
          z = this.h.z[i],
          d = x * x + z * z;
        const sector = Math.min(
          11,
          Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12),
        );
        if (d > distances[sector]) {
          distances[sector] = d;
          arcs[sector] = [x, 1, z];
        }
        n += this.h.damage(i, 190, 9, 1) ? 1 : 0;
      }
    for (const target of arcs)
      if (target) this.fx.lightning([0, 7.1, 0], target);
    this.v.shake = 1.5;
    this.lastPack = n;
    this.onPack(n, 0, 0, "surge");
    this.onSound("overcharge", 1);
    return true;
  }
  step(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.focusTime -= dt;
    this.fx.focus(this.focus, this.focusTime);
    for (let t = 0; t < 4; t++) {
      this.clocks[t] -= dt;
      const active = t < 2 ? this.enabled.guns : this.enabled.mortar;
      if (this.clocks[t] <= 0 && active) {
        if (t < 2) this.fireGun(t);
        else this.fireMortar(t);
        this.clocks[t] = t < 2 ? 0.105 : 2.6;
      }
    }
    this.tesla -= dt;
    if (this.tesla <= 0 && this.enabled.tesla) {
      this.zap();
      this.tesla = 1.35;
    }
    this.boltClock -= dt;
    if (this.boltClock <= 0 && this.enabled.guns) {
      this.volley();
      this.boltClock = 1.5;
    }
    for (let n = this.bolts.length - 1; n >= 0; n--) {
      const b = this.bolts[n];
      b.life -= dt;
      const old = [b.x, b.y, b.z];
      b.x += b.dx * 26 * dt;
      b.z += b.dz * 26 * dt;
      b.y = Math.max(0.8, b.y - dt * 3);
      this.fx.line(
        [b.x - b.dx * 1.1, b.y, b.z - b.dz * 1.1],
        [b.x, b.y, b.z],
        0xe5d5a1,
        0.06,
        0.035,
      );
      const i = this.h.nearest(b.x, b.z, 0.7);
      if (i >= 0 && !b.seen.has(i)) {
        b.seen.add(i);
        this.h.damage(i, 40, 1.2);
        b.hits++;
      }
      if (b.life <= 0 || b.hits >= 3) this.bolts.splice(n, 1);
    }
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.time += dt;
      const f = Math.min(1, s.time / s.max),
        x = s.sx + (s.x - s.sx) * f,
        z = s.sz + (s.z - s.sz) * f,
        y = 3 * (1 - f) + Math.sin(f * Math.PI) * 8;
      this.fx.glow.emit(x, y, z, 0.7, 0xffc75e, 0.08, 0, 0, 0, 1, 0);
      if (s.last) this.fx.line(s.last, [x, y, z], 0xffc472, 0.17);
      s.last = [x, y, z];
      this.fx.particle(x, y, z, 0, 0.2, 0, 0.12, 0x827e6b, 0.3, 0);
      if (f >= 1) {
        this.strike(s.x, s.z);
        this.shells.splice(i, 1);
      }
    }
  }
}
