import test from "node:test";
import assert from "node:assert/strict";
import { Horde, CAP } from "../src/sim.js";
test("a reproducible horde stays finite, outside the fort, and bounded for five minutes", () => {
  const h = new Horde(44);
  h.fill(1600);
  for (let frame = 0; frame < 18000; frame++) {
    h.step(1 / 60);
    if (frame % 90 === 0) h.blast(8, 0, 7, 180);
    if (frame % 300 === 0) {
      for (let i = 0; i < CAP; i++)
        if (h.hp[i] > 0) {
          assert.ok(Number.isFinite(h.x[i] + h.z[i]));
          assert.ok(Math.hypot(h.x[i], h.z[i]) >= 6.1);
        }
      assert.ok(h.alive <= 1600);
      assert.ok(h.neighborChecks <= h.alive * 25);
      assert.equal(h.free.length + h.alive, CAP);
    }
  }
  assert.ok(h.kills > 100);
  assert.ok(h.health >= 0 && h.health <= 100);
});
test("mass kills release each slot once and can refill all slots repeatedly", () => {
  const h = new Horde();
  let deaths = 0;
  h.onDeath = () => deaths++;
  for (let k = 0; k < 20; k++) {
    h.fill(1600);
    const alive = h.alive;
    assert.equal(h.blast(0, 0, 100, 10000), alive);
    assert.equal(h.alive, 0);
    assert.equal(h.free.length, CAP);
    assert.equal(new Set(h.free).size, CAP);
    assert.equal(h.blast(0, 0, 100, 10000), 0);
  }
  assert.equal(deaths, 32000);
});
test("cluster can be queried immediately; deterministic spawn seed and bounded density", () => {
  const a = new Horde(123),
    b = new Horde(123);
  assert.equal(a.x[0], b.x[0]);
  assert.ok(a.cluster() >= 0);
  a.fill(999999);
  assert.equal(a.target, 1600);
  assert.equal(a.alive, 1600);
  a.fill(-100);
  assert.equal(a.target, 100);
});
test("large scenery keeps living units out of its footprint", () => {
  const h = new Horde(99),
    o = { x: 10, z: 0, r: 2 };
  h.setObstacles([o]);
  for (let i = 0; i < 600; i++) h.step(1 / 60);
  for (let i = 0; i < CAP; i++)
    if (h.hp[i] > 0)
      assert.ok(Math.hypot(h.x[i] - o.x, h.z[i] - o.z) >= o.r + 0.18);
});
