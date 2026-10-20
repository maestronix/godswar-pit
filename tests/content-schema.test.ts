import { describe, expect, it } from 'vitest';
import { Content } from '../src/data/registry';
import { STAT_KEYS, ITEM_SLOTS, RARITIES } from '../src/data/types';
import { ARCHETYPES, ARCHETYPE_IDS } from '../src/data/nodes/archetypes';

describe('content schema', () => {
  it('has six classes with a signature and four actives', () => {
    expect(Content.classList).toHaveLength(6);
    for (const classDef of Content.classList) {
      expect(classDef.signature).toBeTruthy();
      expect(classDef.actives).toHaveLength(4);
      expect(classDef.passives).toHaveLength(8);
      expect(classDef.trees).toHaveLength(3);
      expect(classDef.trees.every((id) => Content.tree(id))).toBe(true);
      expect(Content.skill(classDef.signature)).toBeTruthy();
      for (const active of classDef.actives) expect(Content.skill(active)).toBeTruthy();
    }
  });

  it('defines every skill of every class', () => {
    for (const classDef of Content.classList) {
      const skills = Content.skillsOfClass(classDef.id);
      expect(skills.length).toBeGreaterThanOrEqual(5);
      for (const skill of skills) {
        expect(skill.classId).toBe(classDef.id);
        expect(skill.effects.length).toBeGreaterThan(0);
        expect(skill.cooldown).toBeGreaterThan(0);
        expect(skill.runes.length).toBeGreaterThanOrEqual(2);
        for (const rune of skill.runes) {
          expect(rune.id.startsWith(skill.id)).toBe(true);
          expect(rune.name).toBeTruthy();
        }
      }
    }
  });

  it('defines ten zones with enemies and a boss', () => {
    expect(Content.zones).toHaveLength(10);
    for (const zone of Content.zones) {
      expect(zone.enemies.length).toBeGreaterThanOrEqual(4);
      for (const enemyId of zone.enemies) expect(Content.enemies.get(enemyId)).toBeTruthy();
      expect(Content.enemies.get(zone.boss)).toBeTruthy();
      expect(zone.name).toBeTruthy();
    }
  });

  it('defines enemies with sane numbers', () => {
    expect(Content.enemyList.length).toBeGreaterThanOrEqual(50);
    for (const enemy of Content.enemyList) {
      expect(enemy.hp).toBeGreaterThan(0);
      expect(enemy.dps).toBeGreaterThan(0);
      expect(enemy.speed).toBeGreaterThan(0);
      expect(enemy.range).toBeGreaterThan(0);
      expect(enemy.souls).toBeGreaterThan(0);
    }
  });

  it('covers every item slot with bases', () => {
    for (const slot of ITEM_SLOTS) {
      const bases = [...Content.itemBases.values()].filter((b) => b.slot === slot);
      expect(bases.length).toBeGreaterThan(0);
    }
  });

  it('defines 16 affixes with valid stats', () => {
    const affixes = [...Content.affixes.values()];
    expect(affixes).toHaveLength(16);
    for (const affix of affixes) {
      expect(STAT_KEYS).toContain(affix.stat);
      expect(affix.max).toBeGreaterThan(affix.min);
      expect(affix.prefix.length + affix.suffix.length).toBeGreaterThan(0);
      for (const rarity of affix.rarities) expect(RARITIES).toContain(rarity);
    }
  });

  it('gives every class at least four aspects', () => {
    for (const classDef of Content.classList) {
      expect(Content.aspectsOfClass(classDef.id).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('defines every aspect referenced by a class', () => {
    for (const classDef of Content.classList) {
      for (const aspectId of classDef.aspects) {
        expect(Content.aspects.get(aspectId)).toBeTruthy();
      }
    }
  });

  it('defines every weapon base referenced by a class', () => {
    for (const classDef of Content.classList) {
      for (const baseId of classDef.weaponBases) {
        expect(Content.itemBases.get(baseId)).toBeTruthy();
      }
    }
  });

  it('defines ten thrones with increasing ranks', () => {
    for (let rank = 1; rank <= 10; rank++) {
      const throne = Content.throne(rank);
      expect(throne).toBeTruthy();
      expect(throne!.rank).toBe(rank);
      expect(throne!.name).toBeTruthy();
      expect(throne!.feature).toBeTruthy();
    }
  });

  it('defines 70 achievements in 8 categories', () => {
    const list = [...Content.achievements.values()];
    expect(list).toHaveLength(70);
    const categories = new Set(list.map((a) => a.category));
    expect(categories.size).toBe(8);
  });

  it('defines events with three choices each', () => {
    const events = [...Content.events.values()];
    expect(events.length).toBeGreaterThanOrEqual(10);
    for (const event of events) {
      expect(event.choices).toHaveLength(3);
      for (const choice of event.choices) {
        expect(choice.effects.length).toBeGreaterThan(0);
      }
    }
  });

  it('defines potions with three tiers', () => {
    for (const potion of Content.potions.values()) {
      expect(potion.tiers).toHaveLength(3);
      expect(potion.effect.stat).toBeTruthy();
    }
  });

  it('defines anomalies in ascending series', () => {
    const anomalies = [...Content.anomalies.values()];
    expect(anomalies.length).toBeGreaterThanOrEqual(20);
    const series = new Set(anomalies.map((a) => a.series));
    expect(series.size).toBeGreaterThanOrEqual(5);
  });

  it('uses known archetypes in every tree node', () => {
    for (const node of Content.nodeList) {
      expect(ARCHETYPE_IDS).toContain(node.archetype);
      expect(ARCHETYPES[node.archetype]).toBeTruthy();
    }
  });

  it('defines 18 class trees with 30 nodes each', () => {
    expect(Content.treeList).toHaveLength(18);
    for (const tree of Content.treeList) {
      expect(tree.nodes).toHaveLength(30);
    }
  });
});
