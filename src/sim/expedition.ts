/**
 * Expedition logic: starting a run, entering nodes, resolving their content
 * and handing out the rewards.
 */
import { Rng, RngStreams, hashString } from '../core/rng';
import { BALANCE, enemyDps, enemyHp, enemySouls, trapDamage, treasureSouls, xpToNextLevel } from '../data/balance';
import { Content } from '../data/registry';
import { resolveNodeEffect } from '../data/nodes/archetypes';
import type { StatKey } from '../data/types';
import type { ItemRecord, MetaState, PlayerState, TreeState, UnlockedState } from '../state/schema';
import { resolveLoadout } from './stats';
import { healHero } from './combat';
import { lootCountFor, rollItem, shouldScrap } from './loot';
import { generateTree, nextOptions } from './tree';
import type { SimContext } from './context';
import type { Combatant, SimEventSink, SimState, SimTreeNode } from './types';

export interface CreateRunParams {
  player: PlayerState;
  tree: TreeState;
  unlocked: UnlockedState;
  meta: MetaState;
  seed: number;
  zoneId: number;
  runId: string;
  /** Ascensions increase the difficulty. */
  ascensions?: number;
  /** Anomalies of the current incarnation. */
  anomalyIds?: string[];
}

export function createRun(params: CreateRunParams): { state: SimState; ctx: SimContext } {
  const { player, tree, unlocked, meta, seed, zoneId, runId } = params;
  const classDef = Content.class(player.classId) ?? Content.classList[0]!;
  const mods = resolveLoadout({ player, tree, unlocked, meta });
  const streams = new RngStreams(seed);
  const ctx: SimContext = { streams, mods };

  const zone = Content.zone(zoneId) ?? Content.zones[0]!;
  const treeInstance = generateTree({ zone: zoneId, seed });

  const priority = buildSkillPriority(player, classDef.id, mods.availableSkills);

  const hero = {
    hp: mods.stats.maxHp,
    maxHp: mods.stats.maxHp,
    resource: classDef.resourceMax,
    maxResource: classDef.resourceMax,
    x: 0,
    y: 0,
    facing: 0,
    attackTimer: 0,
    cooldowns: {},
    statuses: [],
    targetId: null,
    skills: priority,
    skillRanks: { ...mods.skillRanks },
    passiveRanks: { ...mods.passiveRanks },
    runSkillPoints: player.runSkillPoints,
    level: player.level,
    xp: player.xp,
    stats: mods.stats,
    potions: (player.loadout.potions.filter((p): p is string => Boolean(p)) as string[]).map((id) => ({
      id,
      tier: 1,
    })),
    alive: true,
    inCombatFor: 0,
  };

  const state: SimState = {
    tick: 0,
    phase: 'expedition',
    zoneId,
    classId: classDef.id,
    seed,    runId,
    hero,
    enemies: [],
    tree: treeInstance,
    currentNodeId: null,
    nextNodeIds: [treeInstance.startId],
    visitedNodeIds: [],
    nodeState: {},
    pendingEvent: null,
    loot: [],
    souls: 0,
    echo: 0,
    kills: 0,
    depth: 0,
    rng: streams.snapshot(),
    deathCause: null,
    bossDefeated: false,
    nodeTimer: 0,
    ascensions: params.ascensions ?? player.incarnations,
    anomalies: params.anomalyIds ?? [],
    runes: { ...player.loadout.runes },
    equippedDuringRun: [],
    counters: {
      damageDealt: 0,
      damageTaken: 0,
      healingDone: 0,
      eventsTriggered: 0,
      potionsUsed: 0,
    },
  };

  void zone;
  return { state, ctx };
}

/** Build the auto-cast priority list from the loadout. */
export function buildSkillPriority(
  player: PlayerState,
  classId: string,
  available: string[],
): string[] {
  const classDef = Content.class(classId);
  const signature = classDef?.signature;
  const ordered: string[] = [];
  for (const id of player.loadout.skillPriority) {
    if (available.includes(id) && !ordered.includes(id)) ordered.push(id);
  }
  if (signature && available.includes(signature) && !ordered.includes(signature)) {
    ordered.push(signature);
  }
  for (const id of available) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

/* ------------------------------------------------------------------ nodes */

/** The anomalies of an ascension series. */
export function anomaliesForSeries(series: number): string[] {
  const index = Math.max(1, Math.min(5, series));
  return [...Content.anomalies.values()].filter((a) => a.series === index).map((a) => a.id);
}

function anomalyMagnitude(state: SimState, kind: string): number {
  let total = 0;
  for (const id of state.anomalies) {
    const anomaly = Content.anomaly(id);
    if (anomaly && anomaly.kind === kind) total += anomaly.magnitude;
  }
  return total;
}

export function nodeById(state: SimState, nodeId: string): SimTreeNode | undefined {
  return state.tree.nodes.find((n) => n.id === nodeId);
}

/** Enter a node: roll its content and start whatever it contains. */
export function enterNode(state: SimState, ctx: SimContext, nodeId: string, sink?: SimEventSink): void {
  const node = nodeById(state, nodeId);
  if (!node) return;

  state.currentNodeId = nodeId;
  state.depth = Math.max(state.depth, node.depth);
  state.nodeTimer = 0;
  state.visitedNodeIds.push(nodeId);
  state.nodeState[nodeId] = { visited: true, cleared: false };
  state.nextNodeIds = [];

  sink?.({ type: 'node', tick: state.tick, text: node.type, sourceId: nodeId });

  switch (node.type) {
    case 'FIGHT':
      spawnRoomEnemies(state, ctx, node, 'fight');
      break;
    case 'ELITE':
      spawnRoomEnemies(state, ctx, node, 'elite');
      break;
    case 'BOSS':
      spawnRoomEnemies(state, ctx, node, 'boss');
      break;
    case 'TREASURE':
      resolveTreasure(state, ctx, node, sink);
      break;
    case 'HEALING':
      resolveHealing(state, ctx, node, sink);
      break;
    case 'TRAP':
      resolveTrap(state, ctx, node, sink);
      break;
    case 'EVENT':
      resolveEvent(state, ctx, node, sink);
      break;
    default:
      finishNode(state, ctx, node, sink);
      break;
  }

  // The "every n-th room is a trap" anomaly.
  const trapEvery = anomalyMagnitude(state, 'trap_every');
  if (trapEvery > 0 && node.type !== 'TRAP' && state.visitedNodeIds.length % Math.max(2, Math.round(trapEvery)) === 0) {
    resolveTrap(state, ctx, node, sink);
  }
}

/** Called when the current node is done and the player may pick the next. */
export function finishNode(state: SimState, ctx: SimContext, node: SimTreeNode, sink?: SimEventSink): void {
  const entry = state.nodeState[node.id];
  if (entry) entry.cleared = true;
  state.phase = 'expedition';
  state.nextNodeIds = nextOptions(state.tree, node.id);
  void ctx;
  void sink;
}

/* --------------------------------------------------------------- spawning */

function enemyTier(zone: number, node: SimTreeNode): number {
  return Math.max(1, Math.round(zone * 0.6 + node.risk * 0.55));
}

export function spawnRoomEnemies(
  state: SimState,
  ctx: SimContext,
  node: SimTreeNode,
  kind: 'fight' | 'elite' | 'boss',
  forceCount?: number,
): void {
  const zone = Content.zone(state.zoneId) ?? Content.zones[0]!;
  const rng = ctx.streams.get('spawn');
  const nodeRng = new Rng(node.contentSeed);
  const tier = enemyTier(state.zoneId, node);
  const enemies: Combatant[] = [];

  const makeEnemy = (defId: string, enemyKind: 'normal' | 'elite' | 'boss', index: number): Combatant => {
    const def = Content.enemies.get(defId);
    const hp = enemyHp(state.zoneId, tier, enemyKind);
    const dps = enemyDps(state.zoneId, tier, enemyKind);
    const souls = enemySouls(state.zoneId, tier, enemyKind);
    const angle = (index / 6) * Math.PI * 2;
    const radius = enemyKind === 'boss' ? 3.4 : 4.2 + nodeRng.range(0, 1.4);
    return {
      id: `e${state.tick}_${index}`,
      defId,
      name: def?.name ?? 'Creature',
      hp,
      maxHp: hp,
      dps,
      speed: def?.speed ?? BALANCE.enemySpeedBase,
      range: def?.range ?? 1.1,
      armor: (def?.traits.includes('armored') ? 10 : 0) + tier * 3,
      tier,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      statuses: [],
      attackTimer: nodeRng.int(0, 8),
      traits: def?.traits ?? [],
      souls,
      onHit: def?.onHit,
      size: enemyKind === 'boss' ? 2 : 1,
      kind: enemyKind,
      side: 'enemy',
      alive: true,
    };
  };

  if (kind === 'boss') {
    enemies.push(makeEnemy(zone.boss, 'boss', 0));
    const [minAdds, maxAdds] = BALANCE.bossAdds;
    const adds = minAdds + nodeRng.int(0, maxAdds - minAdds + 1);
    for (let i = 0; i < adds; i++) {
      const defId = zone.enemies[nodeRng.int(0, zone.enemies.length)]!;
      enemies.push(makeEnemy(defId, 'normal', i + 1));
    }
  } else {
    const [min, max] = BALANCE.enemiesPerFight;
    const count = forceCount ?? (kind === 'elite' ? BALANCE.elitesPerFight[0]! + nodeRng.int(0, BALANCE.elitesPerFight[1]! - BALANCE.elitesPerFight[0]!) : min + nodeRng.int(0, max - min));
    for (let i = 0; i < count; i++) {
      const defId = zone.enemies[nodeRng.int(0, zone.enemies.length)]!;
      enemies.push(makeEnemy(defId, 'normal', i));
    }
    if (kind === 'elite') {
      // The elite has a leader.
      const leaderIndex = nodeRng.int(0, enemies.length);
      const leader = enemies[leaderIndex]!;
      leader.kind = 'elite';
      leader.hp = enemyHp(state.zoneId, tier, 'elite');
      leader.maxHp = leader.hp;
      leader.dps = enemyDps(state.zoneId, tier, 'elite');
      leader.size = 1.4;
    }
  }

  // Ascension difficulty.
  const hpMult = 1 + BALANCE.ascensionEnemyHpMult * state.ascensions;
  const dpsMult = 1 + BALANCE.ascensionEnemyDpsMult * state.ascensions;
  // The anomalies of the ascension.
  const anomalyHp = 1 + anomalyMagnitude(state, 'enemy_hp');
  const anomalyDps = 1 + anomalyMagnitude(state, 'enemy_damage');
  for (const enemy of enemies) {
    enemy.hp = Math.round(enemy.hp * hpMult * anomalyHp);
    enemy.maxHp = enemy.hp;
    enemy.dps = Math.round(enemy.dps * dpsMult * anomalyDps * 100) / 100;
    const regen = anomalyMagnitude(state, 'heal_enemies');
    if (regen > 0) enemy.regen = regen;
  }

  // The extra elites of the ascension.
  const extraElites = Math.round(anomalyMagnitude(state, 'extra_elite'));
  const doubleElite = anomalyMagnitude(state, 'double_elite') > 0 && kind === 'elite';
  for (let i = 0; i < extraElites; i++) {
    const defId = zone.enemies[nodeRng.int(0, zone.enemies.length)]!;
    const elite = makeEnemy(defId, 'elite', enemies.length);
    enemies.push(elite);
  }
  if (doubleElite) {
    for (const enemy of enemies) {
      const twin = makeEnemy(enemy.defId, 'normal', enemies.length);
      enemies.push(twin);
    }
  }

  state.enemies = enemies;
  state.phase = 'battle';
  state.hero.inCombatFor = 0;
  void rng;
}

/* --------------------------------------------------------------- rewards */

export function awardKill(state: SimState, ctx: SimContext, enemy: Combatant, sink?: SimEventSink): void {
  const hero = state.hero;
  const soulYield = 1 + hero.stats.soulYieldPct + hero.stats.flatSouls / 100;
  const tax = 1 - anomalyMagnitude(state, 'soul_tax');
  const souls = Math.max(1, Math.round(enemy.souls * soulYield * tax));
  state.souls += souls;
  sink?.({ type: 'souls', tick: state.tick, amount: souls, x: enemy.x, y: enemy.y });

  // Experience and run skill points.
  const xpGain = Math.max(1, Math.round(6 + enemy.tier * 2.2 + (enemy.kind === 'boss' ? 40 : 0)));
  hero.xp += xpGain;
  while (hero.xp >= xpToNextLevel(hero.level)) {
    hero.xp -= xpToNextLevel(hero.level);
    hero.level += 1;
    hero.runSkillPoints += BALANCE.skillPointsPerLevel;
    sink?.({ type: 'level', tick: state.tick, amount: hero.level });
  }
  void ctx;
}

export function rollLootFor(
  state: SimState,
  ctx: SimContext,
  count: number,
  kind: 'normal' | 'elite' | 'boss' | 'treasure',
  levelBonus = 0,
): void {
  const classId = state.classId;
  for (let i = 0; i < count; i++) {
    const result = rollItem(state, ctx, {
      zone: state.zoneId,
      depth: state.depth,
      kind,
      classId,
      levelBonus,
    });
    state.loot.push(result.item);
  }
}

function classOfSkill(skillId: string): string {
  return Content.skill(skillId)?.classId ?? 'bladewalker';
}
void classOfSkill;

/** The battle was won. Grant rewards and open the next node. */
export function finishBattle(state: SimState, ctx: SimContext, sink?: SimEventSink): void {
  const node = state.currentNodeId ? nodeById(state, state.currentNodeId) : undefined;
  if (!node) return;

  const kind = node.type === 'BOSS' ? 'boss' : node.type === 'ELITE' ? 'elite' : 'normal';
  const count = lootCountFor(kind, ctx.streams.get('loot'));
  rollLootFor(state, ctx, count, kind);

  // Node soul bonus.
  const nodeSouls = Math.round((2 + node.risk * 3) * Math.pow(BALANCE.soulsPerZone, state.zoneId - 1));
  state.souls += nodeSouls;
  sink?.({ type: 'souls', tick: state.tick, amount: nodeSouls });

  state.enemies = [];
  state.hero.inCombatFor = 0;

  if (node.type === 'BOSS') {
    state.bossDefeated = true;
    state.phase = 'victory';
    const entry = state.nodeState[node.id];
    if (entry) entry.result = 'Throne claimed';
    sink?.({ type: 'throne', tick: state.tick, text: 'Throne claimed' });
    return;
  }

  const entry = state.nodeState[node.id];
  if (entry) entry.result = 'Cleared';
  finishNode(state, ctx, node, sink);
}

/* ------------------------------------------------------------- non fights */

function resolveTreasure(state: SimState, ctx: SimContext, node: SimTreeNode, sink?: SimEventSink): void {
  const rng = ctx.streams.get('event');
  const souls = treasureSouls(state.zoneId, node.risk);
  state.souls += souls;
  sink?.({ type: 'souls', tick: state.tick, amount: souls });

  const count = 1 + (rng.nextFloat() < 0.4 ? 1 : 0);
  rollLootFor(state, ctx, count, 'treasure');

  if (rng.nextFloat() < BALANCE.mimicChance) {
    const entry = state.nodeState[node.id];
    if (entry) entry.result = 'Mimic!';
    sink?.({ type: 'node', tick: state.tick, text: 'Mimic!' });
    spawnRoomEnemies(state, ctx, node, 'fight', 3);
    return;
  }
  finishNode(state, ctx, node, sink);
}

function resolveHealing(state: SimState, ctx: SimContext, node: SimTreeNode, sink?: SimEventSink): void {
  const cost = Math.round(state.souls * BALANCE.healingSoulCostFraction);
  state.souls = Math.max(0, state.souls - cost);
  healHero(state, state.hero.maxHp * BALANCE.healingHpFraction, sink);
  const entry = state.nodeState[node.id];
  if (entry) entry.result = 'Rested';
  finishNode(state, ctx, node, sink);
}

function resolveTrap(state: SimState, ctx: SimContext, node: SimTreeNode, sink?: SimEventSink): void {
  const rng = ctx.streams.get('event');
  const fraction = trapDamage(node.risk, rng.nextFloat());
  state.hero.hp = Math.max(1, state.hero.hp - state.hero.maxHp * fraction);
  state.souls += Math.round(BALANCE.trapSoulsBase * (1 + node.risk * 0.5));
  if (state.hero.hp <= 0) {
    state.hero.alive = false;
    state.phase = 'dead';
    state.deathCause = 'Killed by a trap';
    return;
  }
  const entry = state.nodeState[node.id];
  if (entry) entry.result = 'Trap sprung';
  finishNode(state, ctx, node, sink);
}

function resolveEvent(state: SimState, ctx: SimContext, node: SimTreeNode, sink?: SimEventSink): void {
  const rng = ctx.streams.get('event');
  const events = [...Content.events.values()];
  const event = events[rng.int(0, events.length)]!;
  state.pendingEvent = { nodeId: node.id, eventId: event.id };
  state.phase = 'event';
  state.counters.eventsTriggered += 1;
  sink?.({ type: 'node', tick: state.tick, text: event.name });
}

/** Apply the player's event choice. */
export function chooseEvent(state: SimState, ctx: SimContext, choiceId: string, sink?: SimEventSink): void {
  const pending = state.pendingEvent;
  if (!pending) return;
  const event = Content.events.get(pending.eventId);
  const choice = event?.choices.find((c) => c.id === choiceId);
  const node = nodeById(state, pending.nodeId);
  if (!choice || !node) {
    state.pendingEvent = null;
    state.phase = 'expedition';
    return;
  }

  for (const effect of choice.effects) {
    switch (effect.kind) {
      case 'souls':
        state.souls += effect.amount;
        sink?.({ type: 'souls', tick: state.tick, amount: effect.amount });
        break;
      case 'hp':
        healHero(state, state.hero.maxHp * effect.fraction, sink);
        break;
      case 'maxHp':
        state.hero.maxHp = Math.round(state.hero.maxHp * (1 + effect.fraction));
        break;
      case 'damage':
        state.hero.hp = Math.max(1, state.hero.hp - state.hero.maxHp * effect.fraction);
        break;
      case 'buff':
        state.hero.statuses.push({
          id: 'rage',
          kind: 'buff',
          stacks: 1,
          power: 0,
          mult: 1.2,
          stat: 'damagePct',
          remaining: effect.duration,
          sourceId: 'event',
        });
        break;
      case 'loot':
        rollLootFor(state, ctx, effect.count, 'treasure', effect.levelBonus);
        break;
      case 'resource':
        state.hero.resource = Math.min(
          state.hero.maxResource,
          state.hero.resource + state.hero.maxResource * effect.fraction,
        );
        break;
      case 'echo':
        state.echo += effect.amount;
        break;
      case 'fight':
        spawnRoomEnemies(state, ctx, node, 'fight', 3 + effect.tier);
        state.pendingEvent = null;
        return;
      default:
        break;
    }
  }

  const entry = state.nodeState[node.id];
  if (entry) entry.result = choice.label;
  state.pendingEvent = null;
  finishNode(state, ctx, node, sink);
}

/* ------------------------------------------------------- run skill points */

export type RunSkillTarget = { kind: 'skill'; skillId: string } | { kind: 'node'; nodeId: string };

/** Spend a run skill point. Returns false when there are no points left. */
export function spendRunSkillPoint(
  state: SimState,
  ctx: SimContext,
  target: RunSkillTarget,
): boolean {
  const hero = state.hero;
  if (hero.runSkillPoints <= 0) return false;

  if (target.kind === 'skill') {
    const skill = Content.skill(target.skillId);
    if (!skill) return false;
    const rank = (hero.skillRanks[skill.id] ?? 0) + 1;
    hero.skillRanks[skill.id] = rank;
    hero.runSkillPoints -= 1;
    // Each rank adds 8% power.
    ctx.mods.runAdd.damagePct = (ctx.mods.runAdd.damagePct ?? 0) + 0.08;
    return true;
  }

  const node = Content.node(target.nodeId);
  if (!node) return false;
  const effect = resolveNodeEffect(node, 1);
  if (!effect) return false;
  hero.passiveRanks[node.id] = (hero.passiveRanks[node.id] ?? 0) + 1;
  hero.runSkillPoints -= 1;
  if (effect.type === 'stat') {
    const stat = effect.stat as StatKey;
    ctx.mods.runAdd[stat] = (ctx.mods.runAdd[stat] ?? 0) + effect.value;
  } else if (effect.type === 'multiplier') {
    const stat = effect.stat as StatKey;
    const bonus = Math.pow(effect.mult, 1) - 1;
    ctx.mods.runAdd[stat] = (ctx.mods.runAdd[stat] ?? 0) + bonus;
  }
  return true;
}

/* -------------------------------------------------------------- item flow */

/**
 * Sort the loot of a finished run into the vault.
 *
 * This is the moment where the run scope of an item is decided: items that
 * are equipped keep their power across death, everything else decays when
 * the run ends in death.
 */
export function sortRunLoot(
  items: ItemRecord[],
  options: { scrapThreshold: number; autoScrap: boolean },
): { vaulted: ItemRecord[]; scrapped: ItemRecord[] } {
  const vaulted: ItemRecord[] = [];
  const scrapped: ItemRecord[] = [];
  for (const item of items) {
    if (options.autoScrap && shouldScrap(item, options.scrapThreshold)) {
      scrapped.push(item);
      continue;
    }
    vaulted.push(item);
  }
  return { vaulted, scrapped };
}

/** Deterministic id for a run (used for the origin marker of items). */
export function makeRunId(seed: number, tick: number): string {
  return `run_${(seed ^ hashString(`r${tick}`)).toString(36)}`;
}
