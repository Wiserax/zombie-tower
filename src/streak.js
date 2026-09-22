// Simulation-time feedback only: never changes damage, rewards or enemy balance.
export const STREAK_TIERS = [
  { at: 0, label: "KILL CHAIN", color: "mint" },
  { at: 10, label: "ON A ROLL", color: "mint" },
  { at: 25, label: "RELENTLESS", color: "gold" },
  { at: 50, label: "RAMPAGE", color: "orange" },
  { at: 100, label: "UNSTOPPABLE", color: "cyan" },
  { at: 200, label: "ANNIHILATION", color: "violet" },
  { at: 500, label: "DOMINATION", color: "ember" },
  { at: 1000, label: "LEGENDARY", color: "legendary" },
];
export class KillStreak {
  constructor() {
    this.window = 2.4;
    this.count = 0;
    this.remaining = 0;
    this.best = 0;
    this.tier = 0;
    this.pending = -1;
    this.expired = 0;
    this.revision = 0;
    this.onMilestone = () => {};
    this.onEnd = () => {};
  }
  kill() {
    if (this.remaining <= 0) {
      this.count = 0;
      this.tier = 0;
      this.expired = 0;
    }
    this.count++;
    this.remaining = this.window;
    this.best = Math.max(this.best, this.count);
    this.revision++;
    const next = STREAK_TIERS.reduce(
      (v, t, i) => (this.count >= t.at ? i : v),
      0,
    );
    if (next > this.tier) {
      this.tier = next;
      this.pending = next;
    }
  }
  update(dt) {
    if (this.pending >= 0) {
      this.onMilestone(STREAK_TIERS[this.pending], this.count);
      this.pending = -1;
    }
    const previous = this.remaining;
    this.remaining = Math.max(0, this.remaining - dt);
    if (previous > 0 && this.remaining === 0) {
      this.expired = this.count;
      this.onEnd(this.count);
      this.count = 0;
      this.tier = 0;
      this.revision++;
    }
  }
  reset() {
    this.count = 0;
    this.remaining = 0;
    this.tier = 0;
    this.pending = -1;
    this.expired = 0;
    this.revision++;
  }
}
