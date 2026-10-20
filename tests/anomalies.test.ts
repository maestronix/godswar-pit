import { describe, expect, it } from 'vitest';
import { Content } from '../src/data/registry';
import { createDefaultSave } from '../src/state/schema';
import { anomaliesForSeries, createRun, pickRoute } from '../src/sim/expedition';
import { step } from '../src/sim/engine';
import { DEFAULT_POLICY } from '../src/sim/policy';
import { ascend } from '../src/state/thrones';

function runWith(anomalyIds: string[], seed = 4242) {
  const save = createDefaultSave();
  const classDef = Content.class('bladewalker')!;
  save.unlocked.persistent.activeSkills = [classDef.signature, ...classDef.actives];
  const run = createRun({
    player: save.player,
    tree: save.tree,
    unlocked: save.unlocked,
    meta: save.meta,
    seed,
    zoneId: 1,
    runId: 'run_test',
    ascensions: 1,
    anomalyIds,
  });
  // The player picks the path of the run - the entrance is entered at once.
  pickRoute(run.state, run.ctx, run.state.routes.routes[0]!.id);
  return run;
}

describe('anomalies', () => {
  it('has five series with anomalies', () => {
    for (let series = 1; series <= 5; series++) {
      const ids = anomaliesForSeries(series);
      expect(ids.length).toBeGreaterThanOrEqual(5);
      expect(ids.length).toBeLessThanOrEqual(7);
    }
  });

  it('makes the enemies tougher with the enemy hp anomaly', () => {
    const hpAnomaly = [...Content.anomalies.values()].find((a) => a.kind === 'enemy_hp');
    expect(hpAnomaly).toBeTruthy();
    const plain = runWith([]);
    const cursed = runWith([hpAnomaly!.id]);
    step(plain.state, plain.ctx, 40, { policy: DEFAULT_POLICY });
    step(cursed.state, cursed.ctx, 40, { policy: DEFAULT_POLICY });

    const plainHp = plain.state.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    const cursedHp = cursed.state.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    expect(cursedHp).toBeGreaterThan(plainHp);
  });

  it('is deterministic with anomalies', () => {
    const ids = anomaliesForSeries(2);
    const a = runWith(ids, 99);
    const b = runWith(ids, 99);
    step(a.state, a.ctx, 300, { policy: DEFAULT_POLICY });
    step(b.state, b.ctx, 300, { policy: DEFAULT_POLICY });
    expect(a.state.souls).toBe(b.state.souls);
    expect(a.state.kills).toBe(b.state.kills);
    expect(a.state.depth).toBe(b.state.depth);
  });

  it('taxes the souls of the tax anomaly', () => {
    const taxAnomaly = [...Content.anomalies.values()].find((a) => a.kind === 'soul_tax');
    if (!taxAnomaly) return;
    const taxed = runWith([taxAnomaly.id], 7);
    step(taxed.state, taxed.ctx, 200, { policy: DEFAULT_POLICY });
    const plain = runWith([], 7);
    step(plain.state, plain.ctx, 200, { policy: DEFAULT_POLICY });
    expect(taxed.state.souls).toBeLessThanOrEqual(plain.state.souls);
  });
});

describe('ascension in the simulation', () => {
  it('makes the next ascension harder', () => {
    const save = createDefaultSave();
    const classDef = Content.class('bladewalker')!;
    save.unlocked.persistent.activeSkills = [classDef.signature, ...classDef.actives];

    const first = createRun({
      player: save.player,
      tree: save.tree,
      unlocked: save.unlocked,
      meta: save.meta,
      seed: 5,
      zoneId: 3,
      runId: 'run_first',
      ascensions: 0,
    });
    const second = createRun({
      player: save.player,
      tree: save.tree,
      unlocked: save.unlocked,
      meta: save.meta,
      seed: 5,
      zoneId: 3,
      runId: 'run_second',
      ascensions: 1,
    });
    pickRoute(first.state, first.ctx, first.state.routes.routes[0]!.id);
    pickRoute(second.state, second.ctx, second.state.routes.routes[0]!.id);
    step(first.state, first.ctx, 60, { policy: DEFAULT_POLICY });
    step(second.state, second.ctx, 60, { policy: DEFAULT_POLICY });

    const firstHp = first.state.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    const secondHp = second.state.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    expect(secondHp).toBeGreaterThan(firstHp);
  });

  it('keeps the thrones after the ascension', () => {
    const save = createDefaultSave();
    save.player.throneRank = 10;
    save.player.echo = 400;
    const result = ascend(save);
    expect(result.ok).toBe(true);
    expect(save.player.throneRank).toBe(10);
    expect(save.player.incarnations).toBe(1);
  });
});
