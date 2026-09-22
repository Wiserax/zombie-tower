export const CAP = 2048;
const TAU = Math.PI * 2;
export class Horde {
  constructor(seed = 821) {
    this.seed = seed;
    this.time = 0;
    this.alive = 0;
    this.kills = 0;
    this.peak = 0;
    this.target = 600;
    this.health = 100;
    this.combo = 0;
    this.comboTime = 0;
    this.x = new Float32Array(CAP);
    this.z = new Float32Array(CAP);
    this.hp = new Float32Array(CAP);
    this.maxHp = new Float32Array(CAP);
    this.generation = new Uint32Array(CAP);
    this.element = new Uint8Array(CAP);
    this.type = new Uint8Array(CAP);
    this.phase = new Float32Array(CAP);
    this.hit = new Float32Array(CAP);
    this.slow = new Float32Array(CAP);
    this.angle = new Float32Array(CAP);
    this.vx = new Float32Array(CAP);
    this.vz = new Float32Array(CAP);
    this.next = new Int32Array(CAP);
    this.heads = new Int32Array(2500);
    this.obstacleCells = Array.from({ length: 2500 }, () => []);
    this.free = Array.from({ length: CAP }, (_, i) => CAP - 1 - i);
    this.onDeath = () => {};
    this.onDamage = () => {};
    this.onHit = () => {};
    this.spawnBudget = 0;
    this.neighborChecks = 0;
    this.fill(600, true);
    this.grid();
  }
  random() {
    let a = this.seed | 0;
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    this.seed = a;
    return (a >>> 0) / 4294967296;
  }
  setObstacles(obstacles) {
    for (const cell of this.obstacleCells) cell.length = 0;
    for (const o of obstacles) {
      for (
        let z = Math.floor((o.z - o.r - 1 + 50) / 2);
        z <= Math.floor((o.z + o.r + 1 + 50) / 2);
        z++
      )
        for (
          let x = Math.floor((o.x - o.r - 1 + 50) / 2);
          x <= Math.floor((o.x + o.r + 1 + 50) / 2);
          x++
        ) {
          if (x >= 0 && x < 50 && z >= 0 && z < 50)
            this.obstacleCells[z * 50 + x].push(o);
        }
    }
  }
  spawn(initial = false) {
    if (!this.free.length) return -1;
    const i = this.free.pop(),
      lane = Math.floor(this.random() * 6);
    const a = (lane * TAU) / 6 + (this.random() - 0.5) * 0.52;
    const r = initial
      ? 10 + Math.sqrt(this.random()) * 23
      : 29 + this.random() * 8;
    this.x[i] = Math.sin(a) * r;
    this.z[i] = Math.cos(a) * r;
    const roll = this.random();
    this.type[i] = roll > 0.94 ? 2 : roll > 0.75 ? 1 : 0;
    this.hp[i] = this.maxHp[i] = [42, 24, 210][this.type[i]];
    this.generation[i]++;
    this.element[i] = 0;
    this.phase[i] = this.random() * TAU;
    this.angle[i] = Math.atan2(-this.x[i], -this.z[i]);
    this.vx[i] = this.vz[i] = this.hit[i] = this.slow[i] = 0;
    this.alive++;
    this.peak = Math.max(this.alive, this.peak);
    return i;
  }
  fill(n, initial = true) {
    this.target = Math.min(1600, Math.max(100, n));
    while (this.alive < this.target) this.spawn(initial);
  }
  grid() {
    this.heads.fill(-1);
    for (let i = 0; i < CAP; i++)
      if (this.hp[i] > 0) {
        const gx = Math.max(0, Math.min(49, Math.floor((this.x[i] + 50) / 2))),
          gz = Math.max(0, Math.min(49, Math.floor((this.z[i] + 50) / 2)));
        const h = gz * 50 + gx;
        this.next[i] = this.heads[h];
        this.heads[h] = i;
      }
  }
  step(dt) {
    this.time += dt;
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (!this.comboTime) this.combo = 0;
    this.spawnBudget += dt * Math.max(45, this.target * 0.13);
    while (this.spawnBudget >= 1 && this.alive < this.target) {
      this.spawn();
      this.spawnBudget--;
    }
    this.spawnBudget = Math.min(8, this.spawnBudget);
    this.grid();
    this.neighborChecks = 0;
    for (let i = 0; i < CAP; i++)
      if (this.hp[i] > 0) {
        const x = this.x[i],
          z = this.z[i],
          r = Math.hypot(x, z),
          t = this.type[i];
        const speed = [1.05, 1.8, 0.68][t] * (this.slow[i] > 0 ? 0.22 : 1);
        let dx = -x / (r || 1),
          dz = -z / (r || 1),
          sx = 0,
          sz = 0,
          found = 0;
        const gx = Math.floor((x + 50) / 2),
          gz = Math.floor((z + 50) / 2),
          sep = t === 2 ? 0.88 : 0.55;
        outer: for (let oz = -1; oz <= 1; oz++)
          for (let ox = -1; ox <= 1; ox++) {
            const h = (gz + oz) * 50 + gx + ox;
            if (h < 0 || h >= 2500) continue;
            for (let j = this.heads[h]; j >= 0; j = this.next[j]) {
              if (i === j) continue;
              this.neighborChecks++;
              const ax = x - this.x[j],
                az = z - this.z[j],
                d2 = ax * ax + az * az;
              if (d2 < sep * sep && d2 > 0.00001) {
                const d = Math.sqrt(d2),
                  p = (sep - d) / sep;
                sx += (ax / d) * p;
                sz += (az / d) * p;
              }
              if (++found > 24) break outer;
            }
          }
        if (r < 6.5) {
          dx *= 0.03;
          dz *= 0.03;
          this.health -= dt * (t === 2 ? 0.09 : 0.025);
        }
        const obstacles = this.obstacleCells[gz * 50 + gx] || [];
        for (const o of obstacles) {
          const ax = x - o.x,
            az = z - o.z,
            d = Math.hypot(ax, az) || 0.001,
            reach = o.r + 0.75;
          if (d < reach) {
            const p = (reach - d) / reach;
            sx += (ax / d) * p * 3 + (az / d) * p * 0.6;
            sz += (az / d) * p * 3 - (ax / d) * p * 0.6;
          }
        }
        let nx = x + (dx * speed + sx * 2.8 + this.vx[i]) * dt,
          nz = z + (dz * speed + sz * 2.8 + this.vz[i]) * dt;
        for (const o of obstacles) {
          const ax = nx - o.x,
            az = nz - o.z,
            d = Math.hypot(ax, az) || 0.001;
          if (d < o.r + 0.19) {
            nx = o.x + (ax / d) * (o.r + 0.19);
            nz = o.z + (az / d) * (o.r + 0.19);
          }
        }
        const nr = Math.hypot(nx, nz);
        if (nr < 6.12) {
          nx *= 6.12 / nr;
          nz *= 6.12 / nr;
        }
        this.x[i] = nx;
        this.z[i] = nz;
        this.angle[i] = Math.atan2(-nx, -nz);
        this.vx[i] *= Math.exp(-dt * 5);
        this.vz[i] *= Math.exp(-dt * 5);
        this.hit[i] = Math.max(0, this.hit[i] - dt * 9);
        this.slow[i] = Math.max(0, this.slow[i] - dt);
      }
    this.health = Math.max(0, Math.min(100, this.health + dt * 0.75));
  }
  damage(i, amount, knock = 0, element = 0) {
    if (i < 0 || this.hp[i] <= 0) return false;
    const applied = Math.min(this.hp[i], amount);
    this.hp[i] -= amount;
    this.element[i] = element;
    this.hit[i] = 1;
    const r = Math.hypot(this.x[i], this.z[i]) || 1;
    this.vx[i] += (this.x[i] / r) * knock;
    this.vz[i] += (this.z[i] / r) * knock;
    if (element === 1) this.slow[i] = 0.55;
    this.onDamage(i, element, applied, this.hp[i] <= 0, knock);
    if (this.hp[i] <= 0) {
      this.hp[i] = 0;
      this.alive--;
      this.kills++;
      this.combo++;
      this.comboTime = 1.6;
      this.onDeath(i, element, knock);
      this.free.push(i);
      return true;
    }
    this.onHit(i, element);
    return false;
  }
  nearest(x = 0, z = 0, range = 24, skip = -1) {
    let best = -1,
      d = range * range;
    for (let i = 0; i < CAP; i++)
      if (this.hp[i] > 0 && i !== skip) {
        const ds = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (ds < d) {
          d = ds;
          best = i;
        }
      }
    return best;
  }
  cluster(range = 24) {
    // Approximate a dense target with a bounded sample; no all-pairs scan.
    let best = -1,
      score = -1;
    for (let k = 0; k < 45; k++) {
      const i = Math.floor(this.random() * CAP);
      if (this.hp[i] <= 0 || Math.hypot(this.x[i], this.z[i]) > range) continue;
      const gx = Math.floor((this.x[i] + 50) / 2),
        gz = Math.floor((this.z[i] + 50) / 2);
      let n = 0;
      for (let oz = -1; oz <= 1; oz++)
        for (let ox = -1; ox <= 1; ox++) {
          const h = (gz + oz) * 50 + gx + ox;
          if (h < 0 || h >= 2500) continue;
          for (let j = this.heads[h]; j >= 0; j = this.next[j]) n++;
        }
      if (n > score) {
        score = n;
        best = i;
      }
    }
    return best < 0 ? this.nearest(0, 0, range) : best;
  }
  blast(x, z, radius, damage, element = 2) {
    let n = 0;
    const r2 = radius * radius;
    for (let i = 0; i < CAP; i++)
      if (this.hp[i] > 0) {
        const dx = this.x[i] - x,
          dz = this.z[i] - z,
          d2 = dx * dx + dz * dz;
        if (d2 < r2) {
          n += this.damage(i, damage * (1 - (0.25 * d2) / r2), 6, element)
            ? 1
            : 0;
        }
      }
    return n;
  }
}
