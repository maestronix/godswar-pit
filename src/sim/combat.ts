/**
 * Combat resolution.
 *
 * One tick of combat is:
 *   1. tick statuses (DoTs, buff durations)
 *   2. tick cooldowns
 *   3. auto-cast the highest priority ready skill
 *   4. basic attack
 *   5. enemy movement + attacks
 *   6. resolve deaths
 *
 * The order is fixed so that the simulation stays deterministic.
 */
import { BALANCE } from '../data/balance';
import { Content } from '../data/registry';
import type { SkillDef, StatKey } from '../data/types';
import { clamp } from '../core/math';
import { applyStatus, getStatusTemplate, statusMultiplier, tickStatuses } from './status';
import { evaluateConditionals } from './stats';
import type { SimContext } from './context';
import type { Combatant, SimEventSink, SimState } from './types';

export const BASIC_ATTACK_RANGE = 1.3;

/* --------------------------------------------------------------- helpers */

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Current effective stats (base stats plus conditional bonuses). */
export function effectiveStats(state: SimState, ctx: SimContext): HeroStatsLite {
  const hero = state.hero;
  const cond = evaluateConditionals(ctx.mods.conditionals, {
    resource: hero.resource,
    maxResource: hero.maxResource,
    enemies: state.enemies.filter((e) => e.side === 'enemy' && e.alive).length,
    hp: hero.hp,
    maxHp: hero.maxHp,
  });
  const stats = hero.stats;
  const run = ctx.mods.runAdd;
  return {
    damagePct: stats.damagePct + cond.damagePct + (run.damagePct ?? 0),
    critChance: clamp(stats.critChance + cond.critChance + (run.critChance ?? 0), 0, 0.95),
    critDamage: stats.critDamage + cond.critDamage + (run.critDamage ?? 0),
    maxHpPct: cond.maxHpPct + (run.maxHpPct ?? 0),
    armorPct: cond.armorPct + (run.armorPct ?? 0),
    attackSpeed: stats.attackSpeed * (1 + cond.attackSpeed + (run.attackSpeed ?? 0)),
    aoePct: stats.aoePct + cond.aoePct + (run.aoePct ?? 0),
    dotPct: stats.dotPct + cond.dotPct + (run.dotPct ?? 0),
    cooldownReduction: clamp(
      stats.cooldownReduction + cond.cooldownReduction + (run.cooldownReduction ?? 0),
      0,
      BALANCE.maxCooldownReduction,
    ),
    soulYieldPct: stats.soulYieldPct + cond.soulYieldPct + (run.soulYieldPct ?? 0),
    damage: stats.damage,
    armor: stats.armor,
    maxHp: stats.maxHp,
    hpRegen: stats.hpRegen,
    lifeOnHit: stats.lifeOnHit,
    moveSpeed: stats.moveSpeed,
    resourceRegen: stats.resourceRegen,
    executeThreshold: stats.executeThreshold,
    statusResist: stats.statusResist,
  };
}

export interface HeroStatsLite {
  damage: number;
  armor: number;
  maxHp: number;
  attackSpeed: number;
  critChance: number;
  critDamage: number;
  cooldownReduction: number;
  aoePct: number;
  dotPct: number;
  soulYieldPct: number;
  moveSpeed: number;
  resourceRegen: number;
  executeThreshold: number;
  statusResist: number;
  hpRegen: number;
  lifeOnHit: number;
  damagePct: number;
  maxHpPct: number;
  armorPct: number;
}

export function armorReduction(armor: number): number {
  return Math.min(BALANCE.maxArmorReduction, armor / (armor + BALANCE.armorConstant));
}

/* --------------------------------------------------------------- damage */

export interface HitOptions {
  skill: SkillDef | null;
  target: Combatant;
  sink?: SimEventSink;
  tick: number;
  scale?: number;
  isDot?: boolean;
}

export function applyDamage(
  state: SimState,
  ctx: SimContext,
  target: Combatant,
  amount: number,
  options: HitOptions,
): number {
  if (!target.alive) return 0;
  const stats = effectiveStats(state, ctx);
  const skill = options.skill;
  let damage = amount * (options.scale ?? 1);

  if (skill) {
    for (const scaling of skill.scaling ?? []) {
      const value = (stats as unknown as Record<string, number>)[scaling.stat] ?? 0;
      damage *= 1 + value * scaling.mult;
    }
    if (skill.targeting === 'aoe') damage *= 1 + stats.aoePct;
  }

  if (options.isDot) damage *= 1 + stats.dotPct;

  let crit = false;
  if (!options.isDot) {
    const roll = ctx.streams.get('crit').nextFloat();
    if (roll < stats.critChance) {
      crit = true;
      damage *= stats.critDamage;
    }
  }

  if (!options.isDot && stats.executeThreshold > 0 && target.hp <= target.maxHp * stats.executeThreshold) {
    damage *= BALANCE.executeBonus;
  }

  damage *= 1 - armorReduction(target.armor);
  damage = Math.max(1, Math.round(damage));
  target.hp -= damage;
  state.counters.damageDealt += damage;

  options.sink?.({
    type: crit ? 'crit' : 'damage',
    tick: options.tick,
    amount: damage,
    targetId: target.id,
    targetIndex: state.enemies.indexOf(target),
    x: target.x,
    y: target.y,
  });

  if (!options.isDot && stats.lifeOnHit > 0) {
    healHero(state, stats.lifeOnHit, options.sink, options.tick);
  }

  return damage;
}

/* ---------------------------------------------------------------- healing */

export function healHero(state: SimState, amount: number, sink?: SimEventSink, tick = state.tick): number {
  const hero = state.hero;
  const before = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
  const healed = hero.hp - before;
  if (healed > 0) {
    state.counters.healingDone += healed;
    sink?.({ type: 'heal', tick, amount: Math.round(healed), x: hero.x, y: hero.y });
  }
  return healed;
}

export function damageHero(
  state: SimState,
  ctx: SimContext,
  amount: number,
  sink?: SimEventSink,
  tick = state.tick,
): number {
  const hero = state.hero;
  if (!hero.alive) return 0;
  let damage = Math.max(0, Math.round(amount));

  const shield = hero.statuses.find((s) => s.id === 'shield' && s.remaining > 0);
  if (shield && shield.power > 0) {
    const absorbed = Math.min(shield.power, damage);
    shield.power -= absorbed;
    damage -= absorbed;
    if (shield.power <= 0) shield.remaining = 0;
  }

  if (damage <= 0) return 0;

  if (ctx.streams.get('crit').nextFloat() < state.hero.stats.dodge) return 0;

  hero.hp -= damage;
  state.counters.damageTaken += damage;
  sink?.({ type: 'damage', tick, amount: damage, x: hero.x, y: hero.y, targetId: 'hero' });
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.alive = false;
  }
  return damage;
}

/* ----------------------------------------------------------------- skills */

export function skillCost(ctx: SimContext, skill: SkillDef): number {
  return Math.max(0, skill.cost + (ctx.mods.skillCost[skill.id] ?? 0));
}

export function skillCooldownTicks(ctx: SimContext, skill: SkillDef): number {
  const base = skill.cooldown;
  const delta = ctx.mods.skillCooldown[skill.id] ?? 0;
  const reduced = base - delta;
  const withCdr = reduced * (1 - ctx.mods.stats.cooldownReduction);
  return Math.max(1, Math.round(withCdr));
}

export function enemiesInRadius(state: SimState, x: number, y: number, radius: number): Combatant[] {
  return state.enemies.filter(
    (e) => e.side === 'enemy' && e.alive && distance(e.x, e.y, x, y) <= radius + e.size * 0.25,
  );
}

export function livingEnemies(state: SimState): Combatant[] {
  return state.enemies.filter((e) => e.side === 'enemy' && e.alive);
}

export function pickTarget(state: SimState): Combatant | null {
  const alive = livingEnemies(state);
  if (alive.length === 0) return null;
  const boss = alive.find((e) => e.kind === 'boss');
  if (boss && alive.length <= 2) return boss;
  let best = alive[0]!;
  let bestDistance = distance(state.hero.x, state.hero.y, best.x, best.y);
  for (const enemy of alive) {
    const d = distance(state.hero.x, state.hero.y, enemy.x, enemy.y);
    if (d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

function statusDurationFor(ctx: SimContext, statusId: string, base: number): number {
  return Math.max(1, base + (ctx.mods.statusDuration[statusId] ?? 0));
}

export function castSkill(state: SimState, ctx: SimContext, skill: SkillDef, sink?: SimEventSink): void {
  const hero = state.hero;
  const stats = effectiveStats(state, ctx);
  const target = pickTarget(state);

  const cost = skillCost(ctx, skill);
  hero.resource = Math.max(0, hero.resource - cost);
  hero.cooldowns[skill.id] = skillCooldownTicks(ctx, skill);

  sink?.({ type: 'cast', tick: state.tick, sourceId: skill.id, text: skill.name });

  const runeId = state.runes[skill.id];
  const rune = runeId ? skill.runes.find((r) => r.id === runeId) : undefined;

  if (!target) {
    for (const effect of skill.effects) applyHeroEffect(state, ctx, skill, effect, null, sink);
    return;
  }

  const transform = ctx.mods.skillTransform[skill.id];
  const isAoe = skill.targeting === 'aoe' || transform === 'aoe';
  const isSingle = !isAoe && skill.targeting !== 'all';

  const damageEffect = skill.effects.find((e) => e.kind === 'damage');
  if (damageEffect) {
    const base = stats.damage * (damageEffect.power ?? skill.power);
    if (isAoe) {
      const radius = skill.aoeRadius ?? 2.4;
      for (const enemy of enemiesInRadius(state, target.x, target.y, radius)) {
        applyDamage(state, ctx, enemy, base, { skill, target: enemy, sink, tick: state.tick });
      }
    } else if (skill.targeting === 'all') {
      for (const enemy of livingEnemies(state)) {
        applyDamage(state, ctx, enemy, base, { skill, target: enemy, sink, tick: state.tick });
      }
    } else {
      applyDamage(state, ctx, target, base, { skill, target, sink, tick: state.tick });
    }
  }

  const chainEffect = skill.effects.find((e) => e.kind === 'chain');
  if (chainEffect) {
    const count = chainEffect.count ?? 1;
    const base = stats.damage * (chainEffect.power ?? skill.power);
    const others = livingEnemies(state)
      .filter((e) => e !== target)
      .sort((a, b) => distance(a.x, a.y, target.x, target.y) - distance(b.x, b.y, target.x, target.y));
    for (let i = 0; i < Math.min(count, others.length); i++) {
      const enemy = others[i]!;
      applyDamage(state, ctx, enemy, base, { skill, target: enemy, sink, tick: state.tick });
    }
  }

  for (const effect of skill.effects) {
    if (effect.kind === 'damage' || effect.kind === 'chain') continue;
    const merged =
      rune?.effectOverrides && rune.effectOverrides.kind === effect.kind
        ? { ...effect, ...rune.effectOverrides }
        : effect;

    if (merged.kind === 'dot') {
      const targets = isAoe
        ? enemiesInRadius(state, target.x, target.y, skill.aoeRadius ?? 2.4)
        : isSingle
          ? [target]
          : livingEnemies(state);
      const power = stats.damage * (merged.power ?? 0.15) * (1 + stats.dotPct);
      const duration = statusDurationFor(ctx, merged.status ?? 'poison', merged.duration ?? 30);
      for (const enemy of targets) {
        applyStatus(enemy, getStatusTemplate(merged.status ?? 'poison'), power, duration, merged.stacks ?? 1, 'hero');
      }
    } else if (merged.kind === 'debuff') {
      const targets = isAoe ? enemiesInRadius(state, target.x, target.y, skill.aoeRadius ?? 2.4) : [target];
      const template = getStatusTemplate(merged.status ?? 'slow');
      for (const enemy of targets) {
        applyStatus(
          enemy,
          { ...template, kind: 'debuff' },
          merged.amount ?? 0,
          statusDurationFor(ctx, template.id, merged.duration ?? 30),
          merged.stacks ?? 1,
          'hero',
        );
      }
    } else {
      applyHeroEffect(state, ctx, skill, merged, target, sink);
    }
  }
}

function applyHeroEffect(
  state: SimState,
  ctx: SimContext,
  skill: SkillDef,
  effect: {
    kind: string;
    power?: number;
    amount?: number;
    duration?: number;
    status?: string;
    count?: number;
    stacks?: number;
  },
  _target: Combatant | null,
  sink?: SimEventSink,
): void {
  const hero = state.hero;
  switch (effect.kind) {
    case 'heal': {
      healHero(state, hero.maxHp * (effect.power ?? 0.1) + (effect.amount ?? 0), sink);
      break;
    }
    case 'shield': {
      const amount = hero.maxHp * (effect.power ?? 0.1) + (effect.amount ?? 0);
      const template = getStatusTemplate('shield');
      const existing = hero.statuses.find((s) => s.id === 'shield');
      if (existing) {
        existing.power += amount;
        existing.remaining = Math.max(existing.remaining, effect.duration ?? template.defaultDuration ?? 60);
      } else {
        applyStatus(hero, template, amount, effect.duration ?? template.defaultDuration ?? 60, 1, 'hero');
      }
      break;
    }
    case 'buff': {
      const template = getStatusTemplate(effect.status ?? 'rage');
      const duration = statusDurationFor(ctx, template.id, effect.duration ?? template.defaultDuration ?? 40);
      applyStatus(hero, { ...template, kind: 'buff' }, effect.amount ?? 0, duration, effect.stacks ?? 1, 'hero');
      break;
    }
    case 'resource': {
      hero.resource = Math.min(hero.maxResource, hero.resource + hero.maxResource * (effect.power ?? 0.2));
      break;
    }
    case 'summon': {
      summonMinion(state, skill, effect.count ?? 1);
      break;
    }
    default:
      break;
  }
}

export function summonMinion(state: SimState, skill: SkillDef, count: number): void {
  const existing = state.enemies.filter((e) => e.side === 'hero' && e.minion);
  const cap = 3;
  const toSummon = Math.max(0, Math.min(count, cap - existing.length));
  for (let i = 0; i < toSummon; i++) {
    const index = state.enemies.length;
    const angle = (i / cap) * Math.PI * 2;
    const minion: Combatant = {
      id: `minion_${state.tick}_${index}`,
      defId: `minion_${skill.id}`,
      name: 'Shadow Effigy',
      hp: state.hero.maxHp * 0.25,
      maxHp: state.hero.maxHp * 0.25,
      dps: state.hero.stats.damage * 0.4,
      speed: 3,
      range: 1.2,
      armor: 0,
      tier: 1,
      x: state.hero.x + Math.cos(angle) * 1.2,
      y: state.hero.y + Math.sin(angle) * 1.2,
      statuses: [],
      attackTimer: 0,
      traits: ['summoner'],
      souls: 0,
      size: 0.7,
      kind: 'normal',
      side: 'hero',
      minion: true,
      alive: true,
    };
    state.enemies.push(minion);
  }
}

/* -------------------------------------------------------------- targeting */

export function chooseSkill(state: SimState, ctx: SimContext): SkillDef | null {
  const hero = state.hero;
  const alive = livingEnemies(state);
  if (alive.length === 0) return null;

  for (const skillId of hero.skills) {
    const skill = Content.skill(skillId);
    if (!skill) continue;
    if ((hero.cooldowns[skillId] ?? 0) > 0) continue;
    const cost = skillCost(ctx, skill);
    if (hero.resource < cost) continue;
    if (skill.tags.includes('ultimate') && alive.length < 2 && !alive.some((e) => e.kind === 'boss')) continue;
    if (skill.tags.includes('aoe') && alive.length < 2) continue;
    return skill;
  }
  return null;
}

/* ------------------------------------------------------------------ step */

export function stepBattle(state: SimState, ctx: SimContext, sink?: SimEventSink): void {
  const hero = state.hero;
  if (!hero.alive) {
    state.phase = 'dead';
    return;
  }

  const stats = effectiveStats(state, ctx);

  tickStatuses(hero, sink, state.tick, 1, stats.statusResist, 'hero');
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    tickStatuses(enemy, sink, state.tick, 1, 0, enemy.id);
  }

  for (const key of Object.keys(hero.cooldowns)) {
    const value = hero.cooldowns[key] ?? 0;
    if (value > 0) hero.cooldowns[key] = value - 1;
  }

  const target = pickTarget(state);
  hero.targetId = target?.id ?? null;

  if (target) {
    const dx = target.x - hero.x;
    const dy = target.y - hero.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > BASIC_ATTACK_RANGE) {
      const speed = stats.moveSpeed / 10;
      hero.x += (dx / d) * speed;
      hero.y += (dy / d) * speed;
      hero.facing = facingFrom(dx / d, dy / d);
    }
  }

  const skill = chooseSkill(state, ctx);
  if (skill) {
    castSkill(state, ctx, skill, sink);
    hero.attackTimer = Math.max(hero.attackTimer, attackIntervalTicks(stats.attackSpeed));
  }

  if (hero.attackTimer <= 0) {
    if (target) {
      const d = distance(hero.x, hero.y, target.x, target.y);
      if (d <= BASIC_ATTACK_RANGE + 0.35) {
        applyDamage(state, ctx, target, stats.damage, { skill: null, target, sink, tick: state.tick });
      }
    }
    hero.attackTimer = attackIntervalTicks(stats.attackSpeed);
  } else {
    hero.attackTimer -= 1;
  }

  hero.resource = Math.min(hero.maxResource, hero.resource + stats.resourceRegen / 10);
  if (hero.hp < hero.maxHp && stats.hpRegen > 0) {
    healHero(state, (hero.maxHp * stats.hpRegen) / 10, sink);
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    if (enemy.side === 'hero') {
      stepMinion(state, ctx, enemy, sink);
      continue;
    }
    stepEnemy(state, ctx, enemy, sink);
  }

  resolveDeaths(state, sink);
}

function attackIntervalTicks(attackSpeed: number): number {
  return Math.max(BALANCE.minAttackTicks, Math.round(BALANCE.ticksPerAttack / Math.max(0.2, attackSpeed)));
}

function facingFrom(nx: number, ny: number): number {
  if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? 3 : 1;
  return ny > 0 ? 0 : 2;
}

function stepEnemy(state: SimState, ctx: SimContext, enemy: Combatant, sink?: SimEventSink): void {
  const hero = state.hero;
  const dx = hero.x - enemy.x;
  const dy = hero.y - enemy.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const slowed = statusMultiplier(enemy, 'moveSpeed');
  const frozen = enemy.statuses.some((s) => s.id === 'freeze' && s.remaining > 0);

  // The "enemies regenerate" anomaly.
  const regen = enemy.regen ?? 0;
  if (regen > 0 && enemy.hp < enemy.maxHp) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * regen * 0.1);
  }

  if (d > enemy.range && !frozen && d > 0) {
    const speed = (enemy.speed * slowed) / 10;
    enemy.x += (dx / d) * speed;
    enemy.y += (dy / d) * speed;
  }

  if (enemy.attackTimer > 0) {
    enemy.attackTimer -= 1;
    return;
  }

  enemy.attackTimer = attackIntervalTicks(Math.max(0.4, enemy.speed * 0.45));
  if (d <= enemy.range + 0.3) {
    const reduction = 1 - armorReduction(state.hero.stats.armor);
    let damage = enemy.dps * (enemy.attackTimer / 10) * reduction;
    if (enemy.traits.includes('explosive')) damage *= 1.6;
    damageHero(state, ctx, damage, sink);
    if (enemy.onHit && enemy.onHit.length > 0) {
      for (const hit of enemy.onHit) {
        if (ctx.streams.get('crit').nextFloat() < hit.chance) {
          applyStatus(
            hero,
            { ...getStatusTemplate(hit.status), kind: 'debuff' },
            0,
            hit.duration,
            hit.stacks ?? 1,
            enemy.id,
          );
        }
      }
    }
  }
}

function stepMinion(state: SimState, ctx: SimContext, minion: Combatant, sink?: SimEventSink): void {
  const target = pickTarget(state);
  if (!target) return;
  const dx = target.x - minion.x;
  const dy = target.y - minion.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > minion.range && d > 0) {
    const speed = minion.speed / 10;
    minion.x += (dx / d) * speed;
    minion.y += (dy / d) * speed;
  }
  if (minion.attackTimer > 0) {
    minion.attackTimer -= 1;
    return;
  }
  minion.attackTimer = attackIntervalTicks(1.4);
  if (d <= minion.range + 0.3) {
    applyDamage(state, ctx, target, minion.dps * 0.6, { skill: null, target, sink, tick: state.tick });
  }
}

function resolveDeaths(state: SimState, sink?: SimEventSink): void {
  for (const enemy of state.enemies) {
    if (enemy.alive && enemy.hp <= 0) {
      enemy.alive = false;
      enemy.hp = 0;
      if (enemy.side === 'enemy') {
        state.kills++;
        sink?.({ type: 'death', tick: state.tick, targetId: enemy.id, x: enemy.x, y: enemy.y });
      }
    }
  }
  if (!state.hero.alive && state.phase === 'battle') {
    state.phase = 'dead';
    state.deathCause = 'Slain in battle';
  }
}

export type { StatKey };
