import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../src/state/schema';
import { createRun } from '../src/sim/expedition';
import { rollItem, buildItemName, compareItems, shouldScrap } from '../src/sim/loot';
import { Content } from '../src/data/registry';
import { step } from '../src/sim/engine';
import { DEFAULT_POLICY } from '../src/sim/policy';

function makeContext() {
  const save = createDefaultSave();
  const run = createRun({
    player: save.player,
    tree: save.tree,
    unlocked: save.unlocked,
    meta: save.meta,
    seed: 31337,
    zoneId: 2,
    runId: 'run_test',
  });
  return run;
}

describe('loot', () => {
  it('rolls items with the expected structure', () => {
    const run = makeContext();
    const result = rollItem(run.state, run.ctx, {
      zone: 2,
      depth: 4,
      kind: 'normal',
      classId: 'bladewalker',
    });
    const item = result.item;
    expect(item.slot).toBeTruthy();
    expect(item.itemLevel).toBeGreaterThan(0);
    expect(item.quality).toBeGreaterThanOrEqual(0);
    expect(item.quality).toBeLessThanOrEqual(1);
    expect(item.originRun).toBe(run.state.runId);
    for (const affix of item.affixes) {
      expect(Content.affixes.get(affix.affixId)).toBeTruthy();
    }
  });

  it('is deterministic for the same seed', () => {
    const a = makeContext();
    const b = makeContext();
    const options = { zone: 3, depth: 6, kind: 'elite' as const, classId: 'bladewalker' };
    const itemA = rollItem(a.state, a.ctx, options).item;
    const itemB = rollItem(b.state, b.ctx, options).item;
    expect(itemA.rarity).toBe(itemB.rarity);
    expect(itemA.itemLevel).toBe(itemB.itemLevel);
    expect(itemA.affixes).toEqual(itemB.affixes);
  });

  it('scrapes weak items but never legendaries', () => {
    const run = makeContext();
    const result = rollItem(run.state, run.ctx, {
      zone: 1,
      depth: 1,
      kind: 'normal',
      classId: 'bladewalker',
    });
    const weak = { ...result.item, rarity: 'common' as const, quality: 0.1, aspectId: null };
    expect(shouldScrap(weak, 0.35)).toBe(true);
    const legendary = { ...weak, rarity: 'legendary' as const };
    expect(shouldScrap(legendary, 0.35)).toBe(false);
    expect(shouldScrap(weak, 0)).toBe(false);
  });

  it('compares items by rarity first', () => {
    const run = makeContext();
    const result = rollItem(run.state, run.ctx, {
      zone: 1,
      depth: 1,
      kind: 'normal',
      classId: 'bladewalker',
    });
    const common = { ...result.item, rarity: 'common' as const };
    const mythic = { ...result.item, rarity: 'mythic' as const };
    expect(compareItems(mythic, common)).toBeGreaterThan(0);
    expect(compareItems(common, mythic)).toBeLessThan(0);
    expect(compareItems(undefined, undefined)).toBe(0);
  });

  it('builds names from the affix word lists', () => {
    const base = Content.itemBases.get('sword')!;
    const name = buildItemName(base, [{ affixId: 'aff_damage' }], 'rare');
    expect(name.length).toBeGreaterThan(base.name.length);
    expect(name).toContain(base.name);
  });

  it('generates different names for different affixes', () => {
    const base = Content.itemBases.get('sword')!;
    const names = new Set(
      [...Content.affixes.values()].map((affix) => buildItemName(base, [{ affixId: affix.id }], 'rare')),
    );
    expect(names.size).toBeGreaterThan(5);
  });
});

describe('expedition', () => {
  it('visits rooms and fights', () => {
    const run = makeContext();
    step(run.state, run.ctx, 300, { policy: DEFAULT_POLICY });
    expect(run.state.visitedNodeIds.length).toBeGreaterThan(0);
    expect(run.state.visitedNodeIds.length).toBeLessThanOrEqual(run.state.routes.nodes.length);
  });

  it('keeps the path free of forbidden node types in the early rooms', () => {
    const run = makeContext();
    const early = run.state.routes.nodes.filter((n) => n.depth <= 1);
    for (const node of early) {
      expect(node.type).not.toBe('HEALING');
      expect(node.type).not.toBe('TRAP');
    }
  });

  it('ends every path with exactly one throne', () => {
    const run = makeContext();
    for (const route of run.state.routes.routes) {
      const throne = route.nodes[route.nodes.length - 1]!;
      expect(throne.type).toBe('BOSS');
      expect(route.nodes.filter((n) => n.type === 'BOSS')).toHaveLength(1);
      expect(route.nodes[0]!.type).toBe('FIGHT');
    }
  });

  it('never decreases the risk with the depth', () => {
    const run = makeContext();
    for (const route of run.state.routes.routes) {
      for (let i = 1; i < route.nodes.length; i++) {
        expect(route.nodes[i]!.risk).toBeGreaterThanOrEqual(route.nodes[i - 1]!.risk);
      }
    }
  });

  it('walks exactly one path and never offers a second one', () => {
    const run = makeContext();
    step(run.state, run.ctx, 400, { policy: DEFAULT_POLICY });
    expect(run.state.routeId).not.toBeNull();
    const route = run.state.routes.routes.find((r) => r.id === run.state.routeId)!;
    expect(route).toBeTruthy();
    // Every visited room belongs to the chosen path.
    for (const id of run.state.visitedNodeIds) {
      expect(route.nodes.some((node) => node.id === id)).toBe(true);
    }
    // And there is never more than one room to walk to.
    expect(run.state.nextNodeIds.length).toBeLessThanOrEqual(1);
  });

  it('gives every path at least one healing room', () => {
    const run = makeContext();
    for (const route of run.state.routes.routes) {
      expect(route.nodes.some((node) => node.type === 'HEALING')).toBe(true);
    }
  });
});
