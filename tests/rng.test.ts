import { describe, expect, it } from 'vitest';
import { Rng, RngStreams, hashString } from '../src/core/rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.nextUint32()).toBe(b.nextUint32());
    }
  });

  it('produces a different sequence for a different seed', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.nextUint32());
    const seqB = Array.from({ length: 20 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it('survives a state round trip', () => {
    const rng = new Rng(999);
    for (let i = 0; i < 37; i++) rng.nextUint32();
    const state = rng.getState();
    const restored = Rng.fromState(999, state);
    const a = Array.from({ length: 25 }, () => rng.nextUint32());
    const b = Array.from({ length: 25 }, () => restored.nextUint32());
    expect(a).toEqual(b);
  });

  it('keeps sub streams independent', () => {
    const master = new Rng(7);
    const loot = master.fork('loot');
    const crit = master.fork('crit');
    const loot2 = master.fork('loot');
    expect(loot.nextUint32()).toBe(loot2.nextUint32());
    expect(loot.nextUint32()).not.toBe(crit.nextUint32());
  });

  it('keeps the streams of RngStreams independent', () => {
    const streams = new RngStreams(42);
    const loot = streams.get('loot');
    const crit = streams.get('crit');
    const before = crit.getState();
    for (let i = 0; i < 100; i++) loot.nextUint32();
    expect(crit.getState()).toEqual(before);
  });

  it('restores the streams from a snapshot', () => {
    const streams = new RngStreams(42);
    for (let i = 0; i < 50; i++) streams.get('spawn').nextUint32();
    const snapshot = streams.snapshot();
    const expected = Array.from({ length: 10 }, () => streams.get('spawn').nextUint32());

    const restored = new RngStreams(42);
    restored.restore(snapshot);
    const actual = Array.from({ length: 10 }, () => restored.get('spawn').nextUint32());
    expect(actual).toEqual(expected);
  });

  it('hashes strings deterministically', () => {
    expect(hashString('loot')).toBe(hashString('loot'));
    expect(hashString('loot')).not.toBe(hashString('crit'));
  });

  it('respects the weighted distribution', () => {
    const rng = new Rng(2024);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[rng.weightedIndex([1, 3, 6])]! += 1;
    expect(counts[0]!).toBeLessThan(counts[1]!);
    expect(counts[1]!).toBeLessThan(counts[2]!);
  });

  it('shuffles deterministically', () => {
    const a = new Rng(5).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    const b = new Rng(5).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
