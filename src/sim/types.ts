/** Types of the deterministic simulation. */
import type { ItemSlot, NodeType, Rarity, StatKey } from '../data/types';
import type { RngState } from '../core/rng';
import type { ItemRecord } from '../state/schema';

export type { NodeType };

/* --------------------------------------------------------------- status */

export type StatusKind = 'dot' | 'buff' | 'debuff' | 'shield';

export interface StatusEffect {
  /** Status id, e.g. `burn`, `poison`, `slow`, `rage`, `shield`. */
  id: string;
  kind: StatusKind;
  stacks: number;
  /** Damage per tick for dots, flat stat value for buffs/debuffs. */
  power: number;
  /** Multiplier applied to a stat for buffs/debuffs. */
  mult: number;
  stat?: StatKey;
  /** Remaining duration in ticks. */
  remaining: number;
  sourceId?: string;
}

/* ----------------------------------------------------------------- hero */

export interface HeroStats {
  maxHp: number;
  damage: number;
  armor: number;
  /** Attack speed in attacks per second. */
  attackSpeed: number;
  critChance: number;
  critDamage: number;
  /** Additive damage bonus in percent (0.15 = +15%). */
  damagePct: number;
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
  dodge: number;
  flatSouls: number;
}

export interface HeroState {
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  x: number;
  y: number;
  /** 0 = south, 1 = west, 2 = north, 3 = east. */
  facing: number;
  /** Ticks until the next basic attack is ready. */
  attackTimer: number;
  /** skillId -> ticks left. */
  cooldowns: Record<string, number>;
  statuses: StatusEffect[];
  targetId: string | null;
  /** Active skill ids that are available right now. */
  skills: string[];
  skillRanks: Record<string, number>;
  passiveRanks: Record<string, number>;
  runSkillPoints: number;
  /** Run level and experience (lost on death). */
  level: number;
  xp: number;
  stats: HeroStats;
  /** Potion id + tier index. */
  potions: { id: string; tier: number }[];
  alive: boolean;
  /** Ticks since the run started, for the boss fight. */
  inCombatFor: number;
}

/* ------------------------------------------------------------- enemies */

export interface Combatant {
  id: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  dps: number;
  speed: number;
  range: number;
  armor: number;
  tier: number;
  x: number;
  y: number;
  statuses: StatusEffect[];
  attackTimer: number;
  traits: string[];
  souls: number;
  /** Health regeneration per tick (the anomaly of the ascension). */
  regen?: number;
  onHit?: { status: string; chance: number; duration: number; stacks?: number }[];
  size: number;
  kind: 'normal' | 'elite' | 'boss';
  /** Which side the combatant fights for. */
  side: 'hero' | 'enemy';
  /** True for summoned minions. */
  minion?: boolean;
  alive: boolean;
}

/* ----------------------------------------------------------------- tree */

export interface SimTreeNode {
  id: string;
  depth: number;
  type: NodeType;
  risk: number;
  /** Seed used to roll the content when the node is entered. */
  contentSeed: number;
}

/** One path of the pit: a straight line of rooms from the entrance to the throne. */
export interface SimRoute {
  id: string;
  name: string;
  /** The rooms of the path, from the entrance (depth 0) to the throne. */
  nodes: SimTreeNode[];
}

/** All the paths the player may choose from in a run. */
export interface SimRoutes {
  routes: SimRoute[];
  /** Every room of every path, flat. */
  nodes: SimTreeNode[];
}

export interface SimNodeState {
  visited: boolean;
  cleared: boolean;
  /** Short result text, e.g. "Victory", "Mimic!". */
  result?: string;
}

/* ---------------------------------------------------------------- events */

export type SimEventType =
  | 'damage'
  | 'crit'
  | 'heal'
  | 'death'
  | 'loot'
  | 'souls'
  | 'cast'
  | 'status'
  | 'node'
  | 'level'
  | 'throne'
  | 'note';

export interface SimEvent {
  type: SimEventType;
  tick: number;
  x?: number;
  y?: number;
  amount?: number;
  targetId?: string;
  sourceId?: string;
  text?: string;
  color?: string;
  /** Index into the enemy array, for renderer targeting. */
  targetIndex?: number;
}

export type SimEventSink = (event: SimEvent) => void;

/* ------------------------------------------------------------- sim state */

export type SimPhase = 'expedition' | 'battle' | 'event' | 'dead' | 'victory';

export interface SimState {
  tick: number;
  phase: SimPhase;
  zoneId: number;
  classId: string;
  seed: number;
  runId: string;
  hero: HeroState;
  enemies: Combatant[];
  /** The paths of the pit. The player chooses one of them at the entrance. */
  routes: SimRoutes;
  /** The path the player chose - null as long as the choice is open. */
  routeId: string | null;
  currentNodeId: string | null;
  /** Node ids the player may pick next. */
  nextNodeIds: string[];
  visitedNodeIds: string[];
  nodeState: Record<string, SimNodeState>;
  /** Set while an event node waits for a choice. */
  pendingEvent: { nodeId: string; eventId: string } | null;
  /** Loot found during this run (run scope). */
  loot: ItemRecord[];
  /** Souls earned during this run. */
  souls: number;
  echo: number;
  kills: number;
  depth: number;
  rng: Record<string, RngState>;
  deathCause: string | null;
  bossDefeated: boolean;
  /** Ticks spent in the current node. */
  nodeTimer: number;
  /** Ascension counter (difficulty multiplier). */
  ascensions: number;
  /** The anomalies of the current ascension. */
  anomalies: string[];
  /** Runes bound to skills, resolved at run start. */
  runes: Record<string, string>;
  /** Items that were looted and auto-equipped during the run. */
  equippedDuringRun: ItemSlot[];
  /** Aggregate counters for the report. */
  counters: {
    damageDealt: number;
    damageTaken: number;
    healingDone: number;
    eventsTriggered: number;
    potionsUsed: number;
  };
}

export interface SimItem {
  id: string;
  baseId: string;
  slot: ItemSlot;
  rarity: Rarity;
  itemLevel: number;
  name: string;
  affixes: { affixId: string; tier: number; value: number }[];
  aspectId: string | null;
  originRun: string | null;
  quality: number;
}
