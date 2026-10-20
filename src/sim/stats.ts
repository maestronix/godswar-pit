/**
 * Stat resolution.
 *
 * Turns a save (class, equipment, trees, meta trees, potions) into the
 * concrete numbers the simulation uses. Nothing here is stored in a save -
 * it is always recomputed, so balancing changes apply retroactively.
 */
import { clamp } from '../core/math';
import { BALANCE } from '../data/balance';
import { Content } from '../data/registry';
import { ARCHETYPES, resolveNodeEffect, type Condition } from '../data/nodes/archetypes';
import type { StatKey } from '../data/types';
import type {
  MetaState,
  PlayerState,
  TreeState,
  UnlockedState,
} from '../state/schema';
import type { HeroStats } from './types';

export interface ConditionalBonus {
  condition: Condition;
  stat: StatKey;
  value: number;
}

export interface LoadoutModifiers {
  stats: HeroStats;
  /** skillId -> cooldown delta in ticks (negative = faster). */
  skillCooldown: Record<string, number>;
  /** skillId -> resource cost delta. */
  skillCost: Record<string, number>;
  /** skillId -> extra targets. */
  skillPierce: Record<string, number>;
  /** status id -> extra duration in ticks. */
  statusDuration: Record<string, number>;
  /** skillId -> transform flag. */
  skillTransform: Record<string, string>;
  conditionals: ConditionalBonus[];
  /** Active skills the hero can cast. */
  availableSkills: string[];
  /** Passive ranks. */
  passiveRanks: Record<string, number>;
  /** skillId -> rank (run + permanent). */
  skillRanks: Record<string, number>;
  /** Extra stats granted during the run by spent run skill points. */
  runAdd: Partial<Record<StatKey, number>>;
}

type StatBag = Record<StatKey, number>;

function zeroBag(): StatBag {
  return {
    damagePct: 0,
    flatDamage: 0,
    critChance: 0,
    critDamage: 0,
    maxHpPct: 0,
    flatHp: 0,
    armorPct: 0,
    flatArmor: 0,
    attackSpeed: 0,
    cooldownReduction: 0,
    aoePct: 0,
    dotPct: 0,
    soulYieldPct: 0,
    moveSpeed: 0,
    resourceRegen: 0,
    executeThreshold: 0,
    statusResist: 0,
    flatSouls: 0,
    hpRegen: 0,
    lifeOnHit: 0,
    dodge: 0,
  };
}

function applyStat(bag: StatBag, stat: StatKey, value: number): void {
  if (!(stat in bag)) return;
  bag[stat] += value;
}

interface Accumulator {
  add: StatBag;
  mult: StatBag;
  skillCooldown: Record<string, number>;
  skillCost: Record<string, number>;
  skillPierce: Record<string, number>;
  statusDuration: Record<string, number>;
  skillTransform: Record<string, string>;
  conditionals: ConditionalBonus[];
  passiveRanks: Record<string, number>;
  skillRanks: Record<string, number>;
  unlockedActives: { skill: string; permanent: boolean }[];
}

function newAccumulator(): Accumulator {
  return {
    add: zeroBag(),
    mult: zeroBag(),
    skillCooldown: {},
    skillCost: {},
    skillPierce: {},
    statusDuration: {},
    skillTransform: {},
    conditionals: [],
    passiveRanks: {},
    skillRanks: {},
    unlockedActives: [],
  };
}

function collectNodeEffects(
  acc: Accumulator,
  nodes: { id: string; maxRank: number; archetype: string; params: Record<string, unknown> }[],
  ranks: Record<string, number>,
): void {
  for (const node of nodes) {
    const rank = ranks[node.id] ?? 0;
    if (rank <= 0) continue;
    const def = Content.node(node.id);
    if (!def) continue;
    const effect = resolveNodeEffect(def, rank);
    if (!effect) continue;
    switch (effect.type) {
      case 'stat':
        applyStat(acc.add, effect.stat, effect.value);
        break;
      case 'conditional':
        acc.conditionals.push({ condition: effect.condition, stat: effect.stat, value: effect.value });
        break;
      case 'multiplier': {
        const key = effect.stat;
        if (key in acc.mult) acc.mult[key] = (acc.mult[key] || 0) + (Math.pow(effect.mult, rank) - 1);
        break;
      }
      case 'cooldown':
        acc.skillCooldown[effect.skill] = (acc.skillCooldown[effect.skill] ?? 0) + effect.ticks;
        break;
      case 'resource':
        acc.skillCost[effect.skill] = (acc.skillCost[effect.skill] ?? 0) + effect.delta;
        break;
      case 'pierce':
        acc.skillPierce[effect.skill] = (acc.skillPierce[effect.skill] ?? 0) + effect.count;
        break;
      case 'duration':
        acc.statusDuration[effect.status] = (acc.statusDuration[effect.status] ?? 0) + effect.ticks;
        break;
      case 'transform':
        acc.skillTransform[effect.skill] = effect.flag;
        break;
      case 'passive':
        acc.passiveRanks[effect.passive] = (acc.passiveRanks[effect.passive] ?? 0) + effect.rank;
        break;
      case 'access':
        acc.unlockedActives.push({ skill: effect.skill, permanent: effect.permanent });
        break;
      case 'rune':
      case 'gate':
        break;
    }
  }
}

export interface ResolveInput {
  player: PlayerState;
  tree: TreeState;
  unlocked: UnlockedState;
  meta: MetaState;
}

export function resolveLoadout(input: ResolveInput): LoadoutModifiers {
  const { player, tree, unlocked, meta } = input;
  const classDef = Content.class(player.classId) ?? Content.classList[0]!;
  const acc = newAccumulator();

  /* class skill trees ------------------------------------------------- */
  const classTrees = Content.treeList.filter((t) => t.classId === classDef.id);
  const classNodes = classTrees.flatMap((t) => t.nodes);
  const permanentRanks: Record<string, number> = { ...tree.ranks };
  for (const [id, rank] of Object.entries(tree.runRanks)) {
    permanentRanks[id] = (permanentRanks[id] ?? 0) + rank;
  }
  collectNodeEffects(acc, classNodes, permanentRanks);

  /* meta trees -------------------------------------------------------- */
  collectNodeEffects(acc, Content.graceMirror.nodes, meta.graceMirror);
  collectNodeEffects(acc, Content.inheritanceTree.nodes, meta.inheritanceTree);

  /* equipment --------------------------------------------------------- */
  for (const item of Object.values(player.equipped)) {
    if (!item) continue;
    const base = Content.itemBases.get(item.baseId);
    if (base) {
      for (const implicit of base.implicit) applyStat(acc.add, implicit.stat, implicit.value);
    }
    for (const affix of item.affixes) {
      const def = Content.affixes.get(affix.affixId);
      if (!def) continue;
      applyStat(acc.add, def.stat, affix.value);
    }
    const aspect = item.aspectId ? Content.aspects.get(item.aspectId) : undefined;
    if (aspect) applyAspectParams(acc, aspect.params);
  }

  /* potions ----------------------------------------------------------- */
  for (const potion of player.loadout.potions) {
    if (!potion) continue;
    const def = Content.potion(potion);
    if (!def) continue;
    const tierMult = def.tiers[1]?.mult ?? 1;
    applyStat(acc.add, def.effect.stat, def.effect.value * tierMult);
  }

  /* thrones ----------------------------------------------------------- */
  for (let rank = 1; rank <= player.throneRank; rank++) {
    const throne = Content.throne(rank);
    if (!throne) continue;
    applyStat(acc.add, throne.bonus.stat, throne.bonus.value);
  }
  applyStat(acc.add, 'damagePct', BALANCE.throneBonusPerRank * player.throneRank);

  /* ascend ------------------------------------------------------------ */
  // The ascension multipliers are applied to the enemies, not to the hero.

  /* finalise ---------------------------------------------------------- */
  const add = acc.add;
  const mult = acc.mult;

  const hpBase = (classDef.base.hp + add.flatHp) * (1 + add.maxHpPct) * (1 + (mult.maxHpPct || 0));
  const damage =
    (classDef.base.damage + add.flatDamage) *
    (1 + add.damagePct) *
    (1 + (mult.damagePct || 0)) *
    (1 + BALANCE.throneBonusPerRank * player.throneRank * 0.5);

  const stats: HeroStats = {
    maxHp: Math.max(1, Math.round(hpBase)),
    damage,
    armor: Math.max(0, (classDef.base.armor + add.flatArmor) * (1 + add.armorPct) * (1 + (mult.armorPct || 0))),
    attackSpeed: Math.max(0.3, classDef.base.attackSpeed * (1 + add.attackSpeed)),
    critChance: clamp(classDef.base.critChance + add.critChance, 0, 0.95),
    critDamage: classDef.base.critDamage + add.critDamage,
    damagePct: add.damagePct,
    cooldownReduction: clamp(add.cooldownReduction, 0, BALANCE.maxCooldownReduction),
    aoePct: add.aoePct,
    dotPct: add.dotPct,
    soulYieldPct: add.soulYieldPct,
    moveSpeed: BALANCE.moveSpeed * (1 + add.moveSpeed),
    resourceRegen: classDef.resourceRegen * (1 + add.resourceRegen),
    executeThreshold: add.executeThreshold,
    statusResist: clamp(add.statusResist, 0, 0.75),
    hpRegen: BALANCE.baseHpRegen * (1 + add.hpRegen),
    lifeOnHit: add.lifeOnHit,
    dodge: clamp(add.dodge, 0, 0.5),
    flatSouls: add.flatSouls,
  };

  /* available skills --------------------------------------------------- */
  const available = new Set<string>();
  available.add(classDef.signature);
  for (const id of unlocked.persistent.activeSkills) available.add(id);
  for (const id of unlocked.currentInkarnation.activeSkills) available.add(id);
  for (const entry of acc.unlockedActives) available.add(entry.skill);

  /* skill ranks ------------------------------------------------------- */
  const skillRanks: Record<string, number> = { ...acc.skillRanks };
  for (const skill of Content.skillsOfClass(classDef.id)) {
    if (skill.kind === 'active' && available.has(skill.id)) {
      skillRanks[skill.id] = 1;
    }
  }

  return {
    stats,
    skillCooldown: acc.skillCooldown,
    skillCost: acc.skillCost,
    skillPierce: acc.skillPierce,
    statusDuration: acc.statusDuration,
    skillTransform: acc.skillTransform,
    conditionals: acc.conditionals,
    availableSkills: Array.from(available),
    passiveRanks: acc.passiveRanks,
    skillRanks,
    runAdd: {},
  };
}

function applyAspectParams(acc: Accumulator, params: Record<string, number>): void {
  for (const [key, value] of Object.entries(params)) {
    switch (key) {
      case 'damagePct':
        applyStat(acc.add, 'damagePct', value);
        break;
      case 'critChance':
        applyStat(acc.add, 'critChance', value);
        break;
      case 'maxHpPct':
        applyStat(acc.add, 'maxHpPct', value);
        break;
      case 'armorPct':
        applyStat(acc.add, 'armorPct', value);
        break;
      case 'aoePct':
        applyStat(acc.add, 'aoePct', value);
        break;
      case 'dotPct':
        applyStat(acc.add, 'dotPct', value);
        break;
      case 'cooldownReduction':
        applyStat(acc.add, 'cooldownReduction', value);
        break;
      case 'attackSpeed':
        applyStat(acc.add, 'attackSpeed', value);
        break;
      case 'soulYieldPct':
        applyStat(acc.add, 'soulYieldPct', value);
        break;
      case 'lifeOnHit':
        applyStat(acc.add, 'lifeOnHit', value);
        break;
      case 'moveSpeed':
        applyStat(acc.add, 'moveSpeed', value);
        break;
      case 'resourceRegen':
        applyStat(acc.add, 'resourceRegen', value);
        break;
      case 'hpRegen':
        applyStat(acc.add, 'hpRegen', value);
        break;
      case 'dodge':
        applyStat(acc.add, 'dodge', value);
        break;
      default:
        break;
    }
  }
}

/** Runtime conditional bonuses (resource, enemy count, hp). */
export function evaluateConditionals(
  conditionals: ConditionalBonus[],
  ctx: { resource: number; maxResource: number; enemies: number; hp: number; maxHp: number },
): StatBag {
  const bag = zeroBag();
  for (const bonus of conditionals) {
    if (!conditionHolds(bonus.condition, ctx)) continue;
    applyStat(bag, bonus.stat, bonus.value);
  }
  return bag;
}

export function conditionHolds(
  condition: Condition,
  ctx: { resource: number; maxResource: number; enemies: number; hp: number; maxHp: number },
): boolean {
  switch (condition.kind) {
    case 'always':
      return true;
    case 'resourceAtMost':
      return ctx.resource <= ctx.maxResource * condition.value;
    case 'resourceAtLeast':
      return ctx.resource >= ctx.maxResource * condition.value;
    case 'enemiesAtLeast':
      return ctx.enemies >= condition.value;
    case 'hpAtMost':
      return ctx.hp <= ctx.maxHp * condition.fraction;
    case 'hpAtLeast':
      return ctx.hp >= ctx.maxHp * condition.fraction;
    default:
      return true;
  }
}

/** All archetype ids that count as "active" for the budget rules. */
export function isActiveArchetype(archetype: string): boolean {
  return ARCHETYPES[archetype as keyof typeof ARCHETYPES]?.active ?? false;
}
