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
    expect(run.state.visitedNodeIds.length).toBeLessThanOrEqual(run.state.tree.nodes.length);
  });

  it('keeps the tree free of forbidden node types in the early layers', () => {
    const run = makeContext();
    const early = run.state.tree.nodes.filter((n) => n.depth <= 1);
    for (const node of early) {
      expect(node.type).not.toBe('HEALING');
      expect(node.type).not.toBe('TRAP');
    }
  });

  it('has exactly one boss node on the top layer', () => {
    const run = makeContext();
    const top = run.state.tree.layers[run.state.tree.layers.length - 1]!;
    expect(top).toHaveLength(1);
    const boss = run.state.tree.nodes.find((n) => n.id === run.state.tree.bossId)!;
    expect(boss.type).toBe('BOSS');
  });

  it('never decreases the risk with the depth', () => {
    const run = makeContext();
    const layers = run.state.tree.layers;
    for (let i = 1; i < layers.length; i++) {
      const previous = layers[i - 1]!.map(
        (id) => run.state.tree.nodes.find((n) => n.id === id)!.risk,
      );
      const current = layers[i]!.map((id) => run.state.tree.nodes.find((n) => n.id === id)!.risk);
      expect(Math.min(...current)).toBeGreaterThanOrEqual(Math.min(...previous));
    }
  });
});
