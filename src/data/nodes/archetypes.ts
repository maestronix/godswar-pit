/**
 * The 12 node archetypes.
 *
 * All ~540 skill tree nodes in the game are generated from these archetypes
 * plus parameters. A node never contains bespoke logic - it only describes
 * *what* it does, and `resolveNodeEffect` turns that into concrete modifiers.
 */
import type { ArchetypeId, StatKey, TreeDef, TreeNodeDef } from '../types';

/* ------------------------------------------------------------ conditions */

export type Condition =
  | { kind: 'always' }
  | { kind: 'resourceAtMost'; value: number }
  | { kind: 'resourceAtLeast'; value: number }
  | { kind: 'enemiesAtLeast'; value: number }
  | { kind: 'hpAtMost'; fraction: number }
  | { kind: 'hpAtLeast'; fraction: number };

export function parseCondition(raw: unknown): Condition {
  if (!raw || typeof raw !== 'object') return { kind: 'always' };
  const cond = raw as Record<string, unknown>;
  switch (cond.kind) {
    case 'resourceAtMost':
      return { kind: 'resourceAtMost', value: Number(cond.value ?? 0) };
    case 'resourceAtLeast':
      return { kind: 'resourceAtLeast', value: Number(cond.value ?? 0) };
    case 'enemiesAtLeast':
      return { kind: 'enemiesAtLeast', value: Number(cond.value ?? 0) };
    case 'hpAtMost':
      return { kind: 'hpAtMost', fraction: Number(cond.fraction ?? 0) };
    case 'hpAtLeast':
      return { kind: 'hpAtLeast', fraction: Number(cond.fraction ?? 0) };
    default:
      return { kind: 'always' };
  }
}

/* ---------------------------------------------------------------- effects */

export type NodeEffect =
  | { type: 'stat'; stat: StatKey; value: number }
  | { type: 'conditional'; condition: Condition; stat: StatKey; value: number }
  | { type: 'cooldown'; skill: string; ticks: number }
  | { type: 'resource'; skill: string; delta: number }
  | { type: 'transform'; skill: string; flag: string }
  | { type: 'pierce'; skill: string; count: number }
  | { type: 'duration'; status: string; ticks: number }
  | { type: 'rune'; skill: string; rune: string }
  | { type: 'access'; skill: string; permanent: boolean }
  | { type: 'multiplier'; stat: StatKey; mult: number; cap: number }
  | { type: 'passive'; passive: string; rank: number }
  | { type: 'gate'; node: string };

/* ------------------------------------------------------------ archetypes */

export interface ArchetypeSpec {
  id: ArchetypeId;
  name: string;
  description: string;
  /** Cost multiplier relative to the base node cost. */
  costMult: number;
  /** Maximum number of ranks. */
  maxRank: number;
  /** Whether the node changes the hero's behaviour (counts against the active node budget). */
  active: boolean;
  /** Description template, `{name}` is replaced by the node name. */
  blurb: (node: TreeNodeDef) => string;
}

const n = (node: TreeNodeDef) => node.params;
const num = (node: TreeNodeDef, key: string, fallback = 0): number => {
  const value = n(node)[key];
  return typeof value === 'number' ? value : fallback;
};
const str = (node: TreeNodeDef, key: string, fallback = ''): string => {
  const value = n(node)[key];
  return typeof value === 'string' ? value : fallback;
};
const bool = (node: TreeNodeDef, key: string, fallback = false): boolean => {
  const value = n(node)[key];
  return typeof value === 'boolean' ? value : fallback;
};

export const ARCHETYPES: Record<ArchetypeId, ArchetypeSpec> = {
  VALUE: {
    id: 'VALUE',
    name: 'Value',
    description: 'A flat bonus to one stat.',
    costMult: 1,
    maxRank: 5,
    active: false,
    blurb: (node) => `+${num(node, 'value', 0) * 100}% ${str(node, 'stat', 'damage')}`,
  },
  CONDITIONAL: {
    id: 'CONDITIONAL',
    name: 'Conditional',
    description: 'A bonus that only applies under a condition.',
    costMult: 1.25,
    maxRank: 3,
    active: true,
    blurb: (node) => `While ${str(node, 'conditionText', 'the condition holds')}: +${num(node, 'value', 0) * 100}% ${str(node, 'stat', 'damage')}`,
  },
  COOLDOWN: {
    id: 'COOLDOWN',
    name: 'Cooldown',
    description: 'Shortens or extends a skill cooldown.',
    costMult: 1.2,
    maxRank: 3,
    active: true,
    blurb: (node) => `${str(node, 'skill', 'Your skill')}: ${num(node, 'ticks', 0) > 0 ? '-' : '+'}${Math.abs(num(node, 'ticks', 0)) / 10}s cooldown`,
  },
  RESOURCE: {
    id: 'RESOURCE',
    name: 'Resource',
    description: 'Changes the resource cost of a skill.',
    costMult: 1.1,
    maxRank: 3,
    active: true,
    blurb: (node) => `${str(node, 'skill', 'Your skill')}: ${num(node, 'delta', 0) > 0 ? '+' : ''}${num(node, 'delta', 0)} resource`,
  },
  TRANSFORM: {
    id: 'TRANSFORM',
    name: 'Transform',
    description: 'Changes how a skill behaves (AoE <-> single target, ...).',
    costMult: 1.6,
    maxRank: 1,
    active: true,
    blurb: (node) => `${str(node, 'skill', 'Your skill')}: ${str(node, 'flag', 'transformed')}`,
  },
  PIERCE: {
    id: 'PIERCE',
    name: 'Pierce',
    description: 'Lets a skill hit additional targets.',
    costMult: 1.45,
    maxRank: 3,
    active: true,
    blurb: (node) => `${str(node, 'skill', 'Your skill')}: hits ${num(node, 'count', 1)} more target(s)`,
  },
  DURATION: {
    id: 'DURATION',
    name: 'Duration',
    description: 'Extends or shortens a status effect.',
    costMult: 1.1,
    maxRank: 3,
    active: true,
    blurb: (node) => `${str(node, 'status', 'Status')}: ${num(node, 'ticks', 0) > 0 ? '+' : ''}${num(node, 'ticks', 0) / 10}s duration`,
  },
  RUNE_UNLOCK: {
    id: 'RUNE_UNLOCK',
    name: 'Rune Unlock',
    description: 'Unlocks a rune for a skill.',
    costMult: 2.2,
    maxRank: 1,
    active: true,
    blurb: (node) => `Unlocks rune "${str(node, 'rune', 'Rune')}" for ${str(node, 'skill', 'your skill')}`,
  },
  ACCESS: {
    id: 'ACCESS',
    name: 'Access',
    description: 'Unlocks an active skill.',
    costMult: 3,
    maxRank: 1,
    active: true,
    blurb: (node) => `Unlocks the skill "${str(node, 'skill', 'Skill')}"${bool(node, 'permanent') ? ' (permanent)' : ' (this incarnation)'}`,
  },
  MULTIPLIER: {
    id: 'MULTIPLIER',
    name: 'Multiplier',
    description: 'A multiplicative bonus with a hard stack cap.',
    costMult: 2,
    maxRank: 3,
    active: true,
    blurb: (node) => `+${Math.round((num(node, 'mult', 1) - 1) * 100)}% ${str(node, 'stat', 'damage')} (max ${num(node, 'cap', 3)} stacks)`,
  },
  PASSIVE: {
    id: 'PASSIVE',
    name: 'Passive',
    description: 'Raises the rank of a class passive.',
    costMult: 1.35,
    maxRank: 5,
    active: false,
    blurb: (node) => `Passive "${str(node, 'passive', 'Passive')}" +${num(node, 'rank', 1)}`,
  },
  NODE_GATE: {
    id: 'NODE_GATE',
    name: 'Node Gate',
    description: 'Requires another node to be owned.',
    costMult: 0.8,
    maxRank: 1,
    active: false,
    blurb: (node) => `Requires "${str(node, 'node', 'another node')}"`,
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/* ---------------------------------------------------------- resolution */

export function resolveNodeEffect(node: TreeNodeDef, rank: number): NodeEffect | null {
  const p = node.params;
  const num = (key: string, fallback = 0): number => {
    const value = p[key];
    return typeof value === 'number' ? value : fallback;
  };
  const str = (key: string, fallback = ''): string => {
    const value = p[key];
    return typeof value === 'string' ? value : fallback;
  };
  const bool = (key: string, fallback = false): boolean => {
    const value = p[key];
    return typeof value === 'boolean' ? value : fallback;
  };
  switch (node.archetype) {
    case 'VALUE':
      return { type: 'stat', stat: (str('stat', 'damagePct') as StatKey), value: num('value') * rank };
    case 'CONDITIONAL':
      return {
        type: 'conditional',
        condition: parseCondition(p.condition),
        stat: (str('stat', 'damagePct') as StatKey),
        value: num('value') * rank,
      };
    case 'COOLDOWN':
      return { type: 'cooldown', skill: str('skill'), ticks: num('ticks') * rank };
    case 'RESOURCE':
      return { type: 'resource', skill: str('skill'), delta: num('delta') * rank };
    case 'TRANSFORM':
      return { type: 'transform', skill: str('skill'), flag: str('flag') };
    case 'PIERCE':
      return { type: 'pierce', skill: str('skill'), count: num('count', 1) * rank };
    case 'DURATION':
      return { type: 'duration', status: str('status'), ticks: num('ticks') * rank };
    case 'RUNE_UNLOCK':
      return { type: 'rune', skill: str('skill'), rune: str('rune') };
    case 'ACCESS':
      return { type: 'access', skill: str('skill'), permanent: bool('permanent') };
    case 'MULTIPLIER':
      return {
        type: 'multiplier',
        stat: (str('stat', 'damagePct') as StatKey),
        mult: num('mult', 1.1),
        cap: num('cap', 3),
      };
    case 'PASSIVE':
      return { type: 'passive', passive: str('passive'), rank: num('rank', 1) * rank };
    case 'NODE_GATE':
      return { type: 'gate', node: str('node') };
    default:
      return null;
  }
}

/* ------------------------------------------------------------ validation */

export interface BudgetReport {
  treeId: string;
  ok: boolean;
  errors: string[];
  multiplierBudget: number;
  activeNodes: number;
}

/** Hard budget rules, enforced by `tests/node-budget.test.ts`. */
export const BUDGET = {
  maxMultiplierStacks: 3,
  maxMultiplierBudget: 3.0,
  maxActiveNodes: 40,
  maxRank: 5,
};

export function validateTree(tree: TreeDef): BudgetReport {
  const errors: string[] = [];
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  let multiplierBudget = 0;
  let activeNodes = 0;

  for (const node of tree.nodes) {
    const spec = ARCHETYPES[node.archetype];
    if (!spec) {
      errors.push(`${node.id}: unknown archetype "${node.archetype}"`);
      continue;
    }
    if (node.maxRank > BUDGET.maxRank) {
      errors.push(`${node.id}: maxRank ${node.maxRank} exceeds budget ${BUDGET.maxRank}`);
    }
    if (node.archetype === 'MULTIPLIER') {
      if (node.maxRank > BUDGET.maxMultiplierStacks) {
        errors.push(`${node.id}: multiplier allows ${node.maxRank} stacks (max ${BUDGET.maxMultiplierStacks})`);
      }
      const mult = Number(node.params.mult) || 1;
      multiplierBudget += Math.pow(mult, node.maxRank) - 1;
    }
    if (spec.active) activeNodes++;

    if (node.parent !== null) {
      const parent = byId.get(node.parent);
      if (!parent) {
        errors.push(`${node.id}: missing parent "${node.parent}"`);
      } else if (parent.depth >= node.depth) {
        errors.push(`${node.id}: depth ${node.depth} is not below parent depth ${parent.depth}`);
      }
    }

    if (node.archetype === 'NODE_GATE') {
      const required = String(node.params.node ?? '');
      if (!byId.has(required)) errors.push(`${node.id}: gate target "${required}" does not exist`);
      if (required === node.id) errors.push(`${node.id}: gate targets itself`);
    }
  }

  // No cycles: follow parents up to the root.
  for (const node of tree.nodes) {
    const seen = new Set<string>();
    let current: TreeNodeDef | undefined = node;
    while (current && current.parent !== null) {
      if (seen.has(current.id)) {
        errors.push(`${node.id}: cycle in parent chain`);
        break;
      }
      seen.add(current.id);
      current = byId.get(current.parent);
    }
  }

  if (multiplierBudget > BUDGET.maxMultiplierBudget + 1e-6) {
    errors.push(`multiplier budget ${multiplierBudget.toFixed(2)} exceeds ${BUDGET.maxMultiplierBudget}`);
  }
  if (activeNodes > BUDGET.maxActiveNodes) {
    errors.push(`${activeNodes} active nodes exceeds budget ${BUDGET.maxActiveNodes}`);
  }

  return { treeId: tree.id, ok: errors.length === 0, errors, multiplierBudget, activeNodes };
}
