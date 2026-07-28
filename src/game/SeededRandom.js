/**
 * Small deterministic PRNG. Its state is serializable so a loaded game produces
 * exactly the same subsequent rolls and events.
 */
export class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.state = this.seed || 0x6d2b79f5;
  }

  next() {
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.state = t >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick(items) {
    if (!items.length) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  exportState() {
    return { seed: this.seed, state: this.state >>> 0 };
  }

  importState({ seed, state }) {
    this.seed = seed >>> 0;
    this.state = state >>> 0;
  }
}

