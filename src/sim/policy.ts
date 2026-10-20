/**
 * The manager (steward).
 *
 * The player is the only active decision in a run: which node to enter next.
 * When the player does nothing for three seconds - or when the game runs
 * offline - the steward picks according to a policy.
 */
import { Content } from '../data/registry';
import type { SimState } from './types';

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

/** Score a candidate node. Higher is better. */
export function scoreNode(state: SimState, nodeId: string, policy: ManagerPolicy): number {
  const node = state.tree.nodes.find((n) => n.id === nodeId);
  if (!node) return -Infinity;

  const hpFraction = state.hero.hp / Math.max(1, state.hero.maxHp);
  let score = 0;

  switch (node.type) {
    case 'HEALING':
      score += 4 + policy.healingPreference * 12 * (1 - hpFraction);
      break;
    case 'TREASURE':
      score += 3 + policy.treasureHunt * 8;
      break;
    case 'ELITE':
      score += 2 + (policy.riskTolerance - node.risk / 5) * 6;
      break;
    case 'TRAP':
      score += 1 - policy.trapAvoidance * 10 * (node.risk / 5);
      break;
    case 'EVENT':
      score += 2;
      break;
    case 'BOSS':
      score += 100;
      break;
    case 'FIGHT':
    default:
      score += 3 + (policy.riskTolerance - node.risk / 5) * 3;
      break;
  }

  // Generic risk penalty.
  score -= node.risk * (1 - policy.riskTolerance) * 2.5;
  return score;
}

/** Pick the next node according to the policy. Deterministic. */
export function chooseNextNode(state: SimState, policy: ManagerPolicy): string | null {
  const candidates = state.nextNodeIds;
  if (candidates.length === 0) return null;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const id of candidates) {
    const score = scoreNode(state, id, policy);
    if (score > bestScore) {
      bestScore = score;
      best = id;
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
