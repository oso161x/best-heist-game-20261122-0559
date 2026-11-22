// A small seeded generator (mulberry32) so a ?seed=N run is the same run every time.
// The game never needs cryptographic randomness; it needs a fixed shuffle for the patrol
// jitter and the dust motes, and a seed the screenshot scenes can pin down.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of a non-empty array. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}
