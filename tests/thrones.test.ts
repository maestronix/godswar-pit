import { describe, expect, it } from 'vitest';
import { createDefaultSave, type SaveFile } from '../src/state/schema';
import { ascend, canAscend, hasFeature, idleSoulRate, parallelExpeditions, rotationZone } from '../src/state/thrones';
import { autoEquip, autoRerollAspects, previewRarity } from '../src/state/automation';
import { Content } from '../src/data/registry';

function saveWithThrone(rank: number): SaveFile {
  const save = createDefaultSave();
  save.player.throneRank = rank;
  for (let r = 1; r <= rank; r++) {
    const throne = Content.throne(r);
    if (throne) save.unlocked.persistent.features.push(throne.feature);
  }
  return save;
}

describe('throne automation', () => {
  it('unlocks the automation of every claimed throne', () => {
    expect(hasFeature(saveWithThrone(0), 'throne_auto_equip')).toBe(false);
    expect(hasFeature(saveWithThrone(4), 'throne_auto_equip')).toBe(true);
    expect(hasFeature(saveWithThrone(5), 'throne_manager')).toBe(true);
  });

  it('allows more parallel expeditions with higher ranks', () => {
    expect(parallelExpeditions(saveWithThrone(0))).toBe(1);
    expect(parallelExpeditions(saveWithThrone(3))).toBe(2);
    expect(parallelExpeditions(saveWithThrone(9))).toBe(3);
  });

  it('rotates the zone only from rank 8 on', () => {
    const save = saveWithThrone(8);
    save.player.highestZone = 7;
    save.player.loadout.targetZone = 3;
    expect(rotationZone(save)).toBe(7);
    const low = saveWithThrone(2);
    low.player.loadout.targetZone = 3;
    expect(rotationZone(low)).toBe(3);
  });

  it('pays idle souls only from rank 6 on', () => {
    expect(idleSoulRate(saveWithThrone(0))).toBe(0);
    expect(idleSoulRate(saveWithThrone(6))).toBeGreaterThan(0);
  });

  it('equips the better item of every slot', () => {
    const save = createDefaultSave();
    save.player.vault.push({
      id: 'weak',
      baseId: 'sword',
      slot: 'weapon',
      rarity: 'common',
      itemLevel: 1,
      name: 'Weak',
      affixes: [],
      aspectId: null,
      originRun: null,
      quality: 0.1,
    });
    save.player.vault.push({
      id: 'strong',
      baseId: 'sword',
      slot: 'weapon',
      rarity: 'legendary',
      itemLevel: 20,
      name: 'Strong',
      affixes: [],
      aspectId: null,
      originRun: null,
      quality: 0.9,
    });
    const changed = autoEquip(save);
    expect(changed).toBe(1);
    expect(save.player.equipped.weapon?.id).toBe('strong');
    expect(save.player.vault.find((v) => v.id === 'weak')).toBeTruthy();
  });

  it('binds a codex aspect to new legendaries', () => {
    const save = createDefaultSave();
    save.unlocked.persistent.codex.push('flamebrand');
    const item = {
      id: 'legend',
      baseId: 'sword',
      slot: 'weapon' as const,
      rarity: 'legendary' as const,
      itemLevel: 20,
      name: 'Legend',
      affixes: [],
      aspectId: null,
      originRun: null,
      quality: 0.9,
    };
    const changed = autoRerollAspects(save, [item]);
    expect(changed).toBe(1);
    expect(item.aspectId).toBe('flamebrand');
  });

  it('previews a rarity deterministically', () => {
    const a = previewRarity(12345, 1, 3);
    const b = previewRarity(12345, 1, 3);
    expect(a).toBe(b);
    expect(['common', 'magic', 'rare', 'legendary', 'mythic']).toContain(a);
  });
});

describe('ascension', () => {
  it('needs all ten thrones', () => {
    expect(canAscend(saveWithThrone(9))).toBe(false);
    expect(canAscend(saveWithThrone(10))).toBe(true);
  });

  it('keeps the permanent progress and drops the rest', () => {
    const save = saveWithThrone(10);
    save.player.souls = 5000;
    save.player.echo = 1000;
    save.player.inheritance = 3;
    save.player.equipped.weapon = {
      id: 'sword',
      baseId: 'sword',
      slot: 'weapon',
      rarity: 'rare',
      itemLevel: 9,
      name: 'Sword',
      affixes: [],
      aspectId: null,
      originRun: null,
      quality: 0.5,
    };
    save.player.vault.push({ ...save.player.equipped.weapon!, id: 'loot' });
    save.tree.ranks = { bladewalker_might_n00: 3 };
    save.unlocked.currentInkarnation.activeSkills = ['bw_a1'];
    save.unlocked.persistent.activeSkills = ['bw_a2'];
    save.player.throneRank = 10;

    const result = ascend(save);
    expect(result.ok).toBe(true);
    expect(save.player.incarnations).toBe(1);
    expect(save.player.souls).toBe(5000);
    expect(save.player.echo).toBeLessThan(1000);
    expect(save.player.echo).toBeGreaterThanOrEqual(250);
    expect(save.player.equipped.weapon).toBeUndefined();
    expect(save.player.vault).toHaveLength(0);
    expect(save.tree.ranks).toEqual({});
    expect(save.unlocked.currentInkarnation.activeSkills).toEqual([]);
    expect(save.unlocked.persistent.activeSkills).toContain('bw_a2');
    expect(save.player.throneRank).toBe(10);
  });

  it('keeps more echo when inheritances are sacrificed', () => {
    const save = saveWithThrone(10);
    save.player.echo = 1000;
    save.player.inheritance = 0;
    const without = ascend(save).echoKept;

    const other = saveWithThrone(10);
    other.player.echo = 1000;
    other.player.inheritance = 5;
    const withSacrifice = ascend(other).echoKept;

    expect(withSacrifice).toBeGreaterThan(without);
  });
});
