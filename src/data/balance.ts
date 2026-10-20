/**
 * All tuning numbers live here.
 *
 * Nothing in this file is saved into a save file - the values are always
 * recomputed from the current content, so rebalancing never invalidates a
 * save. Use `npm run balance` to measure the effect of a change.
 */
import { clamp, round } from '../core/math';

export const BALANCE = {
  /* ------------------------------------------------------------- time */
  tickMs: 100,

  /* ------------------------------------------------------------- hero */
  baseHeroHp: 120,
  baseHeroArmor: 8,
  baseHeroDamage: 12,
  baseAttackSpeed: 1.6,
  baseCritChance: 0.05,
  baseCritDamage: 1.5,
  /** Armour divisor: damage reduction = armor / (armor + this). */
  armorConstant: 45,
  maxArmorReduction: 0.75,
  /** Bonus damage multiplier on every hit after the execute threshold. */
  executeBonus: 2.5,
  /** Health regenerated per second, as a fraction of the maximum health. */
  baseHpRegen: 0.03,
  baseResourceRegen: 2.2,
  /** Hero speed in tiles per second. */
  moveSpeed: 3.4,

  /* ---------------------------------------------------------- enemies */
  enemyHpBase: 58,
  enemyDpsBase: 1.4,
  enemySpeedBase: 2.0,
  enemySoulsBase: 1.5,
  /** Enemy hp multiplier per zone. */
  enemyHpPerZone: 1.42,
  /** Enemy damage multiplier per zone. */
  enemyDpsPerZone: 1.33,
  /** Additional enemy multiplier per elite tier. */
  eliteHpMult: 1.9,
  eliteDpsMult: 1.3,
  bossHpMult: 7,
  bossDpsMult: 2.0,
  /** Soul multiplier per zone. */
  soulsPerZone: 1.55,
  /** How many enemies a fight contains. */
  enemiesPerFight: [4, 5, 6] as [number, number, number],
  elitesPerFight: [6, 8] as [number, number],
  bossAdds: [2, 4] as [number, number],

  /* ----------------------------------------------------------- combat */
  /** Ticks between two basic attacks at 1.0 attack speed. */
  ticksPerAttack: 10,
  minAttackTicks: 2,
  /** Maximum fraction of a cooldown that can be removed. */
  maxCooldownReduction: 0.6,
  /** Execute threshold is only relevant above 0. */
  executeThresholdBase: 0,

  /* ------------------------------------------------------------- loot */
  /** Item level of a drop is derived from zone and tree depth. */
  itemLevelBase: 1,
  itemLevelPerZone: 6,
  itemLevelPerDepth: 0.55,
  /** Rarity weights at zone 1, shift with depth. */
  rarityWeights: [62, 26, 9, 2.6, 0.4] as [number, number, number, number, number],
  /** Rarity weight shift per zone (more rares later). */
  rarityShiftPerZone: 2.2,
  /** Chance that a treasure node is a mimic. */
  mimicChance: 0.2,
  /** Souls from a treasure node. */
  treasureSoulsBase: 18,
  treasureSoulsPerZone: 14,
  /** Healing node: fraction of max hp restored and soul cost. */
  healingHpFraction: 0.4,
  healingSoulCostFraction: 0.1,
  /** Trap node damage. */
  trapDamageMin: 0.1,
  trapDamageMax: 0.25,
  trapSoulsBase: 6,
  /** Loot per fight. */
  lootPerFight: 1.15,
  /** Extra loot chance per elite. */
  eliteLootBonus: 0.6,
  /** Boss always drops this many items. */
  bossLootCount: 3,

  /* --------------------------------------------------------- progress */
  /** XP needed for level n. */
  xpForLevel: (level: number): number => Math.round(28 * Math.pow(level, 1.42)),
  /** Run skill points granted per hero level. */
  skillPointsPerLevel: 1,
  /** Souls for a run skill point conversion. */
  remembranceSoulCost: 12,
  /** Echo awarded at the end of a run. */
  echoPerRunBase: 4,
  echoPerZone: 3,
  echoOnVictory: 6,
  /** Inheritance awarded for a throne siege. */
  inheritancePerThrone: 1,
  /** Throne multipliers. */
  throneBonusPerRank: 0.03,
  /** Multiplier per ascension. */
  ascensionEnemyHpMult: 0.5,
  ascensionEnemyDpsMult: 0.35,
  /** Echo kept on ascension. */
  echoKeptBase: 0.25,
  echoKeptPerSacrificedInheritance: 0.05,

  /* ----------------------------------------------------------- skills */
  /** Class skill tree node costs. */
  nodeCostBase: 18,
  nodeCostPerDepth: 0.55,
  nodeCostGrowth: 1.55,
  /** Meta tree (Grace Mirror) costs. */
  mirrorCostBase: 12,
  mirrorCostGrowth: 1.34,
  /** Meta tree (Inheritance) costs. */
  inheritanceCostBase: 1,
  inheritanceCostGrowth: 1.5,

  /* ------------------------------------------------------------ market */
  potionPriceBase: 40,
  potionPriceGrowth: 1.6,
  /** Souls <-> Echo exchange rate (1 echo costs this many souls). */
  echoExchangeRate: 220,

  /* --------------------------------------------------------- contracts */
  contractDurationMs: 24 * 60 * 60 * 1000,
  contractCount: 3,
  /** Login bonus rewards. */
  loginSouls: 35,
  loginSoulsPerStreak: 18,
  loginInheritanceEvery: 7,

  /* --------------------------------------------------------- offline */
  /** Ticks simulated for real before extrapolating. */
  offlineRealTicks: 200_000,
  /** Chunk size for the offline simulation (yields to the browser). */
  offlineChunkTicks: 5_000,
  /** Efficiency of the extrapolation phase. */
  offlineExtrapolationEfficiency: 0.5,
  /** Offline simulation runs at most this many real seconds. */
  offlineWallClockBudgetMs: 8_000,
} as const;

/* ---------------------------------------------------------------- helpers */

/** Enemy hp for a given zone and tier. */
export function enemyHp(zone: number, tier: number, kind: 'normal' | 'elite' | 'boss'): number {
  const base = BALANCE.enemyHpBase * Math.pow(BALANCE.enemyHpPerZone, zone - 1);
  const tierMult = 1 + (tier - 1) * 0.28;
  let mult = tierMult;
  if (kind === 'elite') mult *= BALANCE.eliteHpMult;
  if (kind === 'boss') mult *= BALANCE.bossHpMult;
  return Math.round(base * mult);
}

/** Enemy damage per second for a given zone and tier. */
export function enemyDps(zone: number, tier: number, kind: 'normal' | 'elite' | 'boss'): number {
  const base = BALANCE.enemyDpsBase * Math.pow(BALANCE.enemyDpsPerZone, zone - 1);
  const tierMult = 1 + (tier - 1) * 0.22;
  let mult = tierMult;
  if (kind === 'elite') mult *= BALANCE.eliteDpsMult;
  if (kind === 'boss') mult *= BALANCE.bossDpsMult;
  return round(base * mult, 2);
}

/** Souls granted for killing an enemy of the given tier in a zone. */
export function enemySouls(zone: number, tier: number, kind: 'normal' | 'elite' | 'boss'): number {
  const base = BALANCE.enemySoulsBase * Math.pow(BALANCE.soulsPerZone, zone - 1);
  const tierMult = 1 + (tier - 1) * 0.35;
  let mult = tierMult;
  if (kind === 'elite') mult *= 2.6;
  if (kind === 'boss') mult *= 12;
  return Math.max(1, Math.round(base * mult));
}

/** Item level for a drop. */
export function itemLevelFor(zone: number, depth: number, boss: boolean): number {
  const level =
    BALANCE.itemLevelBase +
    (zone - 1) * BALANCE.itemLevelPerZone +
    depth * BALANCE.itemLevelPerDepth +
    (boss ? 4 : 0);
  return Math.max(1, Math.round(level));
}

/** Affix tier for an item level. */
export function affixTierFor(itemLevel: number): number {
  return Math.max(1, Math.floor(itemLevel / 6) + 1);
}

/** Rarity weights for a drop. */
export function rarityWeightsFor(zone: number, depth: number): number[] {
  const shift = (zone - 1) * BALANCE.rarityShiftPerZone + depth * 0.55;
  const w = BALANCE.rarityWeights.slice() as number[];
  // Shift weight from common towards rare/legendary.
  const common = Math.max(12, w[0]! - shift * 6);
  w[0] = common;
  w[1] = Math.max(6, w[1]! - shift * 1.2);
  w[2] = w[2]! + shift * 3.4;
  w[3] = w[3]! + shift * 1.1;
  w[4] = w[4]! + shift * 0.25;
  return w;
}

/** Cost of a class skill tree node. */
export function nodeCost(depth: number, archetypeCostMult: number, rank: number): number {
  const base = BALANCE.nodeCostBase * (1 + BALANCE.nodeCostPerDepth * Math.max(0, depth - 1)) * archetypeCostMult;
  return Math.max(1, Math.round(base * Math.pow(BALANCE.nodeCostGrowth, rank)));
}

/** Cost of a Grace Mirror node. */
export function mirrorCost(depth: number, rank: number): number {
  return Math.max(1, Math.round(BALANCE.mirrorCostBase * Math.pow(BALANCE.mirrorCostGrowth, depth + rank)));
}

/** Cost of an Inheritance Tree node. */
export function inheritanceCost(depth: number, rank: number): number {
  return Math.max(1, Math.round(BALANCE.inheritanceCostBase * Math.pow(BALANCE.inheritanceCostGrowth, depth + rank)));
}

/** XP required to reach the next level. */
export function xpToNextLevel(level: number): number {
  return BALANCE.xpForLevel(level);
}

/** Soul price of a potion at a given tier. */
export function potionPrice(tierIndex: number, mult: number): number {
  return Math.round(BALANCE.potionPriceBase * Math.pow(BALANCE.potionPriceGrowth, tierIndex) * mult);
}

/** Difficulty multiplier for the current ascension. */
export function ascensionHpMult(ascensions: number): number {
  return 1 + BALANCE.ascensionEnemyHpMult * ascensions;
}

export function ascensionDpsMult(ascensions: number): number {
  return 1 + BALANCE.ascensionEnemyDpsMult * ascensions;
}

/** Enemy count for a fight node. */
export function enemyCountFor(nodeType: string, rng: () => number): number {
  const [min, max] = BALANCE.enemiesPerFight;
  if (nodeType === 'ELITE') {
    const [emin, emax] = BALANCE.elitesPerFight;
    return emin + Math.floor(rng() * (emax - emin + 1));
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/** Treasure node soul reward. */
export function treasureSouls(zone: number, risk: number): number {
  return Math.round((BALANCE.treasureSoulsBase + BALANCE.treasureSoulsPerZone * (zone - 1)) * (1 + risk * 0.15));
}

/** Trap node damage as a fraction of max hp. */
export function trapDamage(risk: number, roll: number): number {
  const min = BALANCE.trapDamageMin;
  const max = BALANCE.trapDamageMax;
  return clamp(min + (max - min) * roll * (0.6 + risk * 0.2), 0, 0.6);
}
