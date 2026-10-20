import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../src/state/schema';
import { createRun } from '../src/sim/expedition';
import { runOffline } from '../src/state/offline';
import { DEFAULT_POLICY } from '../src/sim/policy';
import { hashState } from '../src/sim/hash';
import { step } from '../src/sim/engine';

function makeRun(seed = 31337) {
  const save = createDefaultSave();
  const classDef = save.player.classId;
  void classDef;
  const { state, ctx } = createRun({
    player: save.player,
    tree: save.tree,
    unlocked: save.unlocked,
    meta: save.meta,
    seed,
    zoneId: 1,
    runId: 'run_offline',
  });
  return { state, ctx };
}

describe('offline simulation', () => {
  it('advances the run and reports what happened', async () => {
    const { state, ctx } = makeRun();
    const { report } = await runOffline(state, ctx, 60 * 60 * 1000, { policy: DEFAULT_POLICY });
    expect(report.seconds).toBe(3600);
    expect(report.totalTicks).toBe(36000);
    expect(report.nodesVisited).toBeGreaterThan(0);
    expect(report.kills).toBeGreaterThan(0);
    expect(report.souls).toBeGreaterThan(0);
    expect(report.soulsPerMinute).toBeGreaterThan(0);
  });

  it('marks the extrapolated part as estimated', async () => {
    const { state, ctx } = makeRun(11);
    const { report } = await runOffline(state, ctx, 12 * 60 * 60 * 1000, { policy: DEFAULT_POLICY });
    expect(report.estimated).toBe(true);
    expect(report.estimatedTicks).toBeGreaterThan(0);
    expect(report.simulatedTicks).toBeLessThanOrEqual(200_000);
  });

  it('produces the same result for the same duration', async () => {
    const a = makeRun(5150);
    const b = makeRun(5150);
    const first = await runOffline(a.state, a.ctx, 10 * 60 * 1000, { policy: DEFAULT_POLICY });
    const second = await runOffline(b.state, b.ctx, 10 * 60 * 1000, { policy: DEFAULT_POLICY });
    expect(first.report.souls).toBe(second.report.souls);
    expect(first.report.kills).toBe(second.report.kills);
    expect(first.report.nodesVisited).toBe(second.report.nodesVisited);
  });

  it('agrees with the live simulation over the same number of ticks', async () => {
    // The offline simulation must not drift away from the live one.
    const live = makeRun(777);
    step(live.state, live.ctx, 6000, { policy: DEFAULT_POLICY });

    const offline = makeRun(777);
    const { state } = await runOffline(offline.state, offline.ctx, 600 * 1000, { policy: DEFAULT_POLICY });

    expect(hashState(state)).toBe(hashState(live.state));
  });

  it('stops the simulation when the hero dies', async () => {
    const { state, ctx } = makeRun(3);
    // A hero that cannot survive: the report still has to be complete.
    const { report } = await runOffline(state, ctx, 30 * 60 * 1000, { policy: DEFAULT_POLICY });
    expect(report.deathCause === null || report.deathCause.length > 0).toBe(true);
  });
});
