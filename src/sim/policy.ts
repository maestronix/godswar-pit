/**
 * The manager (steward).
 *
 * The player makes the decision that matters: the path of the run. When the
 * player does nothing for a while - or when the game runs offline - the
 * steward picks a path according to a policy.
 */
import { Content } from '../data/registry';
import type { SimRoute, SimState } from './types';

export type PolicyPreset = 'safe' | 'balanced' | 'greedy';

export interface ManagerPolicy {
  preset: PolicyPreset;
  /** 0..1 - how much the steward values healing rooms. */
  healingPreference: number;
  /** 0..1 - how much the steward values treasure. */
  treasureHunt: number;
  /** 0..1 - how much the steward avoids traps. */
  trapAvoidance: number;
  /** 0..1 - how much risk the steward accepts. */
  riskTolerance: number;
}

export const DEFAULT_POLICY: ManagerPolicy = {
  preset: 'balanced',
  healingPreference: 0.5,
  treasureHunt: 0.5,
  trapAvoidance: 0.5,
  riskTolerance: 0.5,
};

export const POLICY_PRESETS: Record<PolicyPreset, ManagerPolicy> = {
  safe: { preset: 'safe', healingPreference: 0.9, treasureHunt: 0.3, trapAvoidance: 0.9, riskTolerance: 0.2 },
  balanced: DEFAULT_POLICY,
  greedy: { preset: 'greedy', healingPreference: 0.2, treasureHunt: 1, trapAvoidance: 0.3, riskTolerance: 0.9 },
};

/** How many rooms of a kind a path has. */
function countRooms(route: SimRoute, type: string): number {
  return route.nodes.filter((node) => node.type === type).length;
}

/** The average risk of a path. */
function averageRisk(route: SimRoute): number {
  if (route.nodes.length === 0) return 0;
  const sum = route.nodes.reduce((acc, node) => acc + node.risk, 0);
  return sum / route.nodes.length;
}

/**
 * Score a path. Higher is better.
 *
 * The path with the most shrines is the safest one, the path with the most
 * treasure is the most rewarding one. A path that offers many fights but
 * almost no shrine is a trap for a hero that cannot heal any more.
 */
export function scoreRoute(state: SimState, route: SimRoute, policy: ManagerPolicy): number {
  const hpFraction = state.hero.hp / Math.max(1, state.hero.maxHp);
  const shrines = countRooms(route, 'HEALING');
  const treasures = countRooms(route, 'TREASURE');
  const traps = countRooms(route, 'TRAP');
  const elites = countRooms(route, 'ELITE');
  const fights = countRooms(route, 'FIGHT');

  // A wounded hero values the shrines much more than a healthy one.
  const healingWeight = 1 + policy.healingPreference * (1 + (1 - hpFraction) * 6);
  const treasureWeight = 1 + policy.treasureHunt * 6;

  const value = shrines * healingWeight + treasures * treasureWeight;

  // The danger of the path: the risk of the rooms, the traps and the elites.
  const danger = averageRisk(route) + traps * 2 + elites * 1.5;

  // Fights without a shrine in sight wear the hero down.
  const strain = Math.max(0, fights + elites - shrines * 3);
  const strainPenalty = strain * (1 - policy.riskTolerance) * 2;

  return value / (1 + danger * (1.2 - policy.riskTolerance)) - strainPenalty;
}

/** Pick a path according to the policy. Deterministic. */
export function chooseRoute(state: SimState, policy: ManagerPolicy): SimRoute | null {
  let best: SimRoute | null = null;
  let bestScore = -Infinity;
  for (const route of state.routes.routes) {
    const score = scoreRoute(state, route, policy);
    if (score > bestScore) {
      bestScore = score;
      best = route;
    }
  }
  return best;
}

/**
 * Pick an event option. The steward prefers the safest reasonable option.
 */
export function chooseEventOption(state: SimState, policy: ManagerPolicy): string | null {
  if (!state.pendingEvent) return null;
  const event = Content.events.get(state.pendingEvent.eventId);
  if (!event) return null;
  void policy;
  const choice = event.choices
    .slice()
    .sort((a, b) => a.risk - b.risk || a.id.localeCompare(b.id))[0];
  return choice?.id ?? null;
}
