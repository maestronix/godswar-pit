/**
 * Loot generation.
 *
 * Item level -> rarity -> affixes -> aspect. The whole pipeline runs off the
 * `loot` RNG stream so that adding a new affix never changes the outcome of
 * an unrelated roll.
 */
import { BALANCE, affixTierFor, itemLevelFor, rarityWeightsFor } from '../data/balance';
import { Content } from '../data/registry';
import type { AffixDef, ItemBaseDef, ItemSlot, Rarity } from '../data/types';
import { RARITY_AFFIX_COUNT } from '../data/types';
import type { ItemRecord } from '../state/schema';
import type { SimContext } from './context';
import type { SimState } from './types';

export interface LootContext {
  zone: number;
  depth: number;
  kind: 'normal' | 'elite' | 'boss' | 'treasure';
  classId: string;
  /** Item level bonus (events can add this). */
  levelBonus?: number;
}

export interface ItemQuality {
  /** 0..1 - how good the roll was compared to the maximum. */
  score: number;
  shouldScrap: boolean;
}

const RARITY_ORDER: Rarity[] = ['common', 'magic', 'rare', 'legendary', 'mythic'];

export function rollRarity(rng: { nextFloat(): number }, zone: number, depth: number): Rarity {
  const weights = rarityWeightsFor(zone, depth);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.nextFloat() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return RARITY_ORDER[i]!;
  }
  return 'common';
}

/** All item bases that a class can use. */
export function basesForClass(classId: string): ItemBaseDef[] {
  const all = [...Content.itemBases.values()];
  return all.filter((base) => base.classes.length === 0 || base.classes.includes(classId));
}

export function basesForSlot(classId: string, slot: ItemSlot): ItemBaseDef[] {
  return basesForClass(classId).filter((base) => base.slot === slot);
}

function pickBase(rng: { nextFloat(): number; weightedIndex(w: readonly number[]): number }, classId: string, slot?: ItemSlot): ItemBaseDef {
  const pool = slot ? basesForSlot(classId, slot) : basesForClass(classId);
  if (pool.length === 0) {
    const fallback = [...Content.itemBases.values()][0];
    if (!fallback) throw new Error('No item bases defined');
    return fallback;
  }
  return pool[rng.weightedIndex(pool.map(() => 1))]!;
}

function affixPool(rarity: Rarity, classId: string): AffixDef[] {
  const pool = [...Content.affixes.values()].filter((affix) => affix.rarities.includes(rarity));
  if (pool.length === 0) return [];
  // Class specific affixes are less common but always available.
  void classId;
  return pool;
}

function rollAffixValue(affix: AffixDef, tier: number, rng: { nextFloat(): number }): number {
  const scale = 1 + 0.14 * (tier - 1);
  const raw = affix.min + (affix.max - affix.min) * rng.nextFloat();
  return round(raw * scale, 4);
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface RollResult {
  item: ItemRecord;
  quality: ItemQuality;
}

export function rollItem(state: SimState, ctx: SimContext, options: LootContext): RollResult {
  const rng = ctx.streams.get('loot');
  const level = itemLevelFor(options.zone, options.depth, options.kind === 'boss') + (options.levelBonus ?? 0);
  const rarity = rollRarity(rng, options.zone, options.depth);
  const base = pickBase(rng, options.classId);
  const tier = affixTierFor(level);

  const count = RARITY_AFFIX_COUNT[rarity];
  const pool = affixPool(rarity, options.classId);
  const affixes: { affixId: string; tier: number; value: number }[] = [];
  let rolled = 0;
  let maximum = 0;

  const shuffled = rng.shuffle([...pool]);
  for (const affix of shuffled) {
    if (affixes.length >= count) break;
    const value = rollAffixValue(affix, tier, rng);
    affixes.push({ affixId: affix.id, tier, value });
    rolled += Math.abs(value);
    maximum += Math.abs(affix.max) * (1 + 0.14 * (tier - 1));
  }

  let aspectId: string | null = null;
  if (rarity === 'legendary' || rarity === 'mythic') {
    const chance = rarity === 'mythic' ? 0.85 : 0.45;
    if (rng.nextFloat() < chance) {
      const candidates = Content.aspectsOfClass(options.classId);
      if (candidates.length > 0) {
        aspectId = candidates[Math.floor(rng.nextFloat() * candidates.length)]!.id;
      }
    }
  }

  const qualityScore = maximum > 0 ? Math.min(1, rolled / maximum) : 1;
  const name = buildItemName(base, affixes, rarity);

  const item: ItemRecord = {
    id: `item_${state.tick.toString(36)}_${Math.floor(rng.nextFloat() * 1e9).toString(36)}`,
    baseId: base.id,
    slot: base.slot,
    rarity,
    itemLevel: level,
    name,
    affixes,
    aspectId,
    originRun: state.runId,
    quality: round(qualityScore, 3),
  };

  return { item, quality: { score: qualityScore, shouldScrap: false } };
}

/** Build the display name from the rolled affixes. */
export function buildItemName(
  base: ItemBaseDef,
  affixes: { affixId: string }[],
  rarity: Rarity,
): string {
  if (rarity === 'common') return base.name;
  let prefix = '';
  let suffix = '';
  for (const roll of affixes) {
    const affix = Content.affixes.get(roll.affixId);
    if (!affix) continue;
    if (!prefix && affix.prefix.length > 0) {
      prefix = affix.prefix[Math.floor(hashIndex(roll.affixId) % affix.prefix.length)]!;
    }
    if (affix.suffix.length > 0) {
      suffix = affix.suffix[Math.floor(hashIndex(roll.affixId + 'x') % affix.suffix.length)]!;
    }
  }
  let name = base.name;
  if (prefix) name = `${prefix} ${name}`;
  if (suffix) name = `${name} ${suffix}`;
  return name;
}

function hashIndex(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Should this item be scrapped instead of entering the vault? */
export function shouldScrap(item: ItemRecord, threshold: number): boolean {
  if (threshold <= 0) return false;
  if (item.rarity === 'legendary' || item.rarity === 'mythic') return false;
  if (item.aspectId) return false;
  return item.quality < threshold;
}

/** Total rolled value of an item - used for the "is this better" comparison. */
export function itemScore(item: ItemRecord): number {
  const base = Content.itemBases.get(item.baseId);
  let score = 0;
  if (base) {
    for (const implicit of base.implicit) score += Math.abs(implicit.value);
  }
  for (const affix of item.affixes) {
    const def = Content.affixes.get(affix.affixId);
    if (!def) continue;
    score += Math.abs(affix.value) * (def.stat.endsWith('Pct') || def.stat === 'critChance' || def.stat === 'critDamage' ? 1 : 0.6);
  }
  if (item.aspectId) score += 0.6;
  return score;
}

/** Compare two items in the same slot. Returns > 0 when `a` is better. */
export function compareItems(a: ItemRecord | undefined, b: ItemRecord | undefined): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const rarityDiff = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  if (rarityDiff !== 0) return rarityDiff;
  return itemScore(a) - itemScore(b);
}

/** Number of items a fight drops. */
export function lootCountFor(kind: 'normal' | 'elite' | 'boss', rng: { nextFloat(): number }): number {
  if (kind === 'boss') return BALANCE.bossLootCount;
  const base = BALANCE.lootPerFight * (kind === 'elite' ? 1 + BALANCE.eliteLootBonus : 1);
  const count = Math.floor(base);
  const extra = rng.nextFloat() < base - count ? 1 : 0;
  return count + extra;
}
