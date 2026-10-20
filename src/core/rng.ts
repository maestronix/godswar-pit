/**
 * Deterministic RNG.
 *
 * The whole game (live play, offline fast-forward, balance simulation) has to
 * produce byte-identical results for identical inputs. Therefore the only
 * source of randomness is this xorshift128 implementation, and every consumer
 * gets its own *stream* so that adding a loot roll can never shift the
 * outcome of a critical hit.
 */

export interface RngState {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
}

/** FNV-1a, used to turn a stream name into a 32 bit seed offset. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** splitmix32 - used to expand a single seed number into xorshift state. */
function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export class Rng {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    const gen = splitmix32(this.seed === 0 ? 0x1a2b3c4d : this.seed);
    this.s0 = gen();
    this.s1 = gen();
    this.s2 = gen();
    this.s3 = gen();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 1;
      this.s1 = 2;
      this.s2 = 3;
      this.s3 = 4;
    }
  }

  static fromState(seed: number, state: RngState): Rng {
    const rng = new Rng(seed);
    rng.s0 = state.s0 >>> 0;
    rng.s1 = state.s1 >>> 0;
    rng.s2 = state.s2 >>> 0;
    rng.s3 = state.s3 >>> 0;
    if ((rng.s0 | rng.s1 | rng.s2 | rng.s3) === 0) {
      rng.s0 = 1;
      rng.s1 = 2;
      rng.s2 = 3;
      rng.s3 = 4;
    }
    return rng;
  }

  getState(): RngState {
    return { s0: this.s0, s1: this.s1, s2: this.s2, s3: this.s3 };
  }

  /** Core xorshift128 step. Returns an unsigned 32 bit integer. */
  nextUint32(): number {
    let t = this.s0 ^ (this.s0 << 11);
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = this.s3;
    this.s3 = (this.s3 ^ (this.s3 >>> 19)) ^ (t ^ (t >>> 8));
    return this.s3 >>> 0;
  }

  /** Uniform float in [0, 1). */
  nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /** Uniform integer in [min, max) (max exclusive). */
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + (this.nextUint32() % (max - min));
  }

  /** Uniform float in [min, max] rounded to `step` increments. */
  step(min: number, max: number, step: number): number {
    const steps = Math.floor((max - min) / step) + 1;
    return min + this.int(0, steps) * step;
  }

  chance(probability: number): boolean {
    return this.nextFloat() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.nextUint32() % items.length]!;
  }

  /** Pick an index from a weight table. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return 0;
    let roll = this.nextFloat() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i]! > 0 ? weights[i]! : 0;
      roll -= w;
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }

  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    return items[this.weightedIndex(weights)]!;
  }

  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.nextUint32() % (i + 1);
      const tmp = items[i]!;
      items[i] = items[j]!;
      items[j] = tmp;
    }
    return items;
  }

  /** Derive an independent child stream. Identical seeds yield identical children. */
  fork(stream: string): Rng {
    return new Rng((this.seed ^ hashString(stream)) >>> 0);
  }

  /** Derive a child stream from an explicit numeric seed. */
  derive(salt: number): Rng {
    return new Rng((this.seed ^ (salt >>> 0)) >>> 0);
  }
}

/** The named RNG streams used by the simulation. */
export const RNG_STREAMS = ['loot', 'crit', 'spawn', 'event', 'ai', 'misc'] as const;
export type RngStreamName = (typeof RNG_STREAMS)[number];

/** All streams derived from one master seed. */
export class RngStreams {
  private readonly streams = new Map<string, Rng>();
  readonly masterSeed: number;

  constructor(masterSeed: number) {
    this.masterSeed = masterSeed >>> 0;
    for (const name of RNG_STREAMS) {
      this.streams.set(name, new Rng((this.masterSeed ^ hashString(name)) >>> 0));
    }
  }

  get(name: RngStreamName): Rng {
    const stream = this.streams.get(name);
    if (!stream) throw new Error(`Unknown RNG stream: ${name}`);
    return stream;
  }

  snapshot(): Record<RngStreamName, RngState> {
    const out = {} as Record<RngStreamName, RngState>;
    for (const name of RNG_STREAMS) out[name] = this.get(name).getState();
    return out;
  }

  restore(states: Record<string, RngState>): void {
    for (const name of RNG_STREAMS) {
      const state = states[name];
      if (!state) continue;
      this.streams.set(name, Rng.fromState((this.masterSeed ^ hashString(name)) >>> 0, state));
    }
  }
}
