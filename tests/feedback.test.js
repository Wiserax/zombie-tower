import test from "node:test";
import assert from "node:assert/strict";
import { Horde } from "../src/sim.js";
import { KillStreak } from "../src/streak.js";

test("damage feedback reports actual damage, before death/recycling, once per hit", () => {
  const h = new Horde(99),
    i = 0,
    full = h.hp[i],
    generation = h.generation[i],
    events = [];
  h.onDamage = (index, element, amount, killed) =>
    events.push({
      index,
      element,
      amount,
      killed,
      hp: h.hp[index],
      generation: h.generation[index],
    });
  h.damage(i, 7, 0, 1);
  assert.equal(events[0].amount, 7);
  assert.equal(events[0].hp, full - 7);
  assert.equal(events[0].killed, false);
  h.damage(i, 10000, 0, 2);
  assert.equal(events[1].amount, full - 7);
  assert.equal(events[1].killed, true);
  assert.equal(events[1].generation, generation);
  h.damage(i, 10);
  assert.equal(events.length, 2);
  const slot = h.spawn();
  assert.equal(slot, i);
  assert.equal(h.generation[slot], generation + 1);
  assert.equal(h.hp[slot], h.maxHp[slot]);
  assert.equal(h.element[slot], 0);
});
test("a same-frame mass kill announces only the highest reached streak milestone", () => {
  const s = new KillStreak(),
    announced = [];
  s.onMilestone = (tier, n) => announced.push([tier.label, n]);
  for (let i = 0; i < 210; i++) s.kill();
  s.update(0);
  assert.deepEqual(announced, [["ANNIHILATION", 210]]);
  assert.equal(s.best, 210);
  assert.equal(s.count, 210);
  s.update(1);
  assert(Math.abs(s.remaining - 1.4) < 1e-9);
  s.kill();
  assert.equal(s.remaining, 2.4);
  s.update(0);
  assert.equal(announced.length, 1);
});
test("streak timeout ends once, zero-time pause is inert, new chain starts fresh", () => {
  const s = new KillStreak(),
    ended = [];
  s.onEnd = (n) => ended.push(n);
  for (let i = 0; i < 30; i++) s.kill();
  s.update(0);
  assert.equal(s.count, 30);
  for (let i = 0; i < 300; i++) s.update(0);
  assert.equal(s.remaining, 2.4);
  s.update(2.4);
  s.update(10);
  assert.deepEqual(ended, [30]);
  assert.equal(s.count, 0);
  assert.equal(s.best, 30);
  s.kill();
  assert.equal(s.count, 1);
  assert.equal(s.tier, 0);
  s.reset();
  assert.equal(s.remaining, 0);
  assert.equal(s.best, 30);
});

test("wall feedback remains bounded for a packed perimeter and does not advance while paused", async () => {
  const { BastionFeedback } = await import("../src/bastion-feedback.js");
  let bursts = 0,
    sparks = 0;
  const fx = { burst: () => bursts++, smoke: { emit: () => {} } };
  const wall = new BastionFeedback(fx, { hit: () => sparks++ });
  const h = new Horde(123);
  h.hp.fill(0);
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    h.hp[i] = 42;
    h.x[i] = Math.sin(a) * 6.3;
    h.z[i] = Math.cos(a) * 6.3;
    h.phase[i] = i * 0.42;
  }
  for (let i = 0; i < 60; i++) wall.update(1 / 60, h);
  assert.equal(wall.attackers, 240);
  assert(
    bursts > 0 && bursts <= 32,
    "Dense attackers caused an unbounded wall effect burst",
  );
  assert.equal(sparks, bursts);
  const stopped = wall.strikes;
  for (let i = 0; i < 60; i++) wall.update(0, h);
  assert.equal(wall.strikes, stopped);
  h.hp.fill(0);
  wall.update(1 / 60, h);
  assert.equal(wall.attackers, 0);
});
