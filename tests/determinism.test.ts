import { describe, expect, it } from 'vitest';
import { RngStreams } from '../src/core/rng';
import { createDefaultSave, type SaveFile } from '../src/state/schema';
import { createRun } from '../src/sim/expedition';
import { step } from '../src/sim/engine';
import { hashState } from '../src/sim/hash';
import { DEFAULT_POLICY } from '../src/sim/policy';
import type { SimContext } from '../src/sim/context';

function makeSave(): SaveFile {
  const save = createDefaultSave();
  save.player.classId = 'bladewalker';
  save.unlocked.persistent.activeSkills = ['bw_a1', 'bw_a2'];
  return save;
}

function makeRun(save: SaveFile, seed: number) {
  return createRun({
    player: save.player,
    tree: save.tree,
    unlocked: save.unlocked,
    meta: save.meta,
    seed,
    zoneId: 1,
    runId: `run_${seed.toString(36)}`,
  });
}

describe('determinism', () => {
  it('produces the same state hash live and in fast forward', () => {
    const save = makeSave();
    const seed = 0xc0ffee;

    const live = makeRun(save, seed);
    for (let i = 0; i < 400; i++) {
      step(live.state, live.ctx, 1, { policy: DEFAULT_POLICY });
    }

    const fast = makeRun(save, seed);
    step(fast.state, fast.ctx, 400, { policy: DEFAULT_POLICY });

    expect(hashState(live.state)).toBe(hashState(fast.state));
    expect(live.state.tick).toBe(fast.state.tick);
    expect(live.state.kills).toBe(fast.state.kills);
    expect(live.state.souls).toBe(fast.state.souls);
  });

  it('produces the same result in chunks of different sizes', () => {
    const save = makeSave();
    const seed = 4242;

    const a = makeRun(save, seed);
    for (let i = 0; i < 20; i++) step(a.state, a.ctx, 37, { policy: DEFAULT_POLICY });

    const b = makeRun(save, seed);
    step(b.state, b.ctx, 740, { policy: DEFAULT_POLICY });

    expect(hashState(a.state)).toBe(hashState(b.state));
  });

  it('is deterministic across several zones', () => {
    for (const zone of [1, 3, 5, 7]) {
      const save = makeSave();
      const a = makeRun(save, 1000 + zone);
      const b = makeRun(save, 1000 + zone);
      a.state.zoneId = zone;
      b.state.zoneId = zone;
      step(a.state, a.ctx, 250, { policy: DEFAULT_POLICY });
      step(b.state, b.ctx, 250, { policy: DEFAULT_POLICY });
      expect(hashState(a.state)).toBe(hashState(b.state));
    }
  });

  it('produces different results for different seeds', () => {
    const save = makeSave();
    const a = makeRun(save, 1);
    const b = makeRun(save, 2);
    step(a.state, a.ctx, 200, { policy: DEFAULT_POLICY });
    step(b.state, b.ctx, 200, { policy: DEFAULT_POLICY });
    expect(hashState(a.state)).not.toBe(hashState(b.state));
  });

  it('survives a save / load round trip of the run state', () => {
    const save = makeSave();
    const run = makeRun(save, 777);
    step(run.state, run.ctx, 120, { policy: DEFAULT_POLICY });

    const json = JSON.stringify(run.state);
    const restored = JSON.parse(json) as typeof run.state;

    // A restored run rebuilds its RNG streams from the stored state.
    const streams = new RngStreams(restored.seed);
    streams.restore(restored.rng);
    const restoredCtx: SimContext = { streams, mods: run.ctx.mods };

    step(restored, restoredCtx, 80, { policy: DEFAULT_POLICY });
    step(run.state, run.ctx, 80, { policy: DEFAULT_POLICY });

    expect(hashState(restored)).toBe(hashState(run.state));
  });
});
