/**
 * Contracts, the story chain and the login bonus.
 */
import { Rng } from '../core/rng';
import { dayDiff, dayKey } from '../core/format';
import { BALANCE } from '../data/balance';
import { Content } from '../data/registry';
import type { ActiveContract, ContractsState, SaveFile } from './schema';

const STORY_CONTRACTS = new Map<number, string>();

/** Build the lookup of story contract definitions (zone -> contract id). */
function storyContractByZone(): Map<number, string> {
  if (STORY_CONTRACTS.size > 0) return STORY_CONTRACTS;
  for (const contract of Content.contracts.values()) {
    if (contract.params && typeof contract.params.zone === 'number' && contract.metric === 'ascend') {
      STORY_CONTRACTS.set(contract.params.zone, contract.id);
    }
  }
  return STORY_CONTRACTS;
}

/** Roll a fresh set of rotating contracts. */
export function refreshContracts(state: ContractsState, now: number, seed: number): void {
  const expired = now - state.lastRefresh >= BALANCE.contractDurationMs;
  if (!expired && state.rotating.length >= BALANCE.contractCount) return;

  const rng = new Rng((seed ^ 0x51ed270b) >>> 0);
  const rolling = [...Content.contracts.values()].filter((c) => c.rolling);
  const picked: ActiveContract[] = [];
  const pool = rng.shuffle([...rolling]);
  for (const contract of pool) {
    if (picked.length >= BALANCE.contractCount) break;
    picked.push({
      id: `c_${contract.id}_${now.toString(36)}`,
      defId: contract.id,
      progress: 0,
      claimed: false,
      startedAt: now,
    });
  }
  state.rotating = picked;
  state.lastRefresh = now;
}

/** Ensure the story contract for the current chapter exists. */
export function ensureStoryContract(state: ContractsState, chapter: number): void {
  const map = storyContractByZone();
  const defId = map.get(chapter);
  if (!defId) return;
  if (state.story && state.story.defId === defId) return;
  state.story = {
    id: `story_${defId}`,
    defId,
    progress: 0,
    claimed: false,
    startedAt: Date.now(),
    story: true,
  };
}

/** Progress values of a contract, derived from the save. */
export function contractProgress(save: SaveFile, contract: ActiveContract): number {
  const def = Content.contracts.get(contract.defId);
  if (!def) return 0;
  const stats = save.stats;
  switch (def.metric) {
    case 'kill_count':
      return stats.kills;
    case 'reach_depth':
      return stats.deepestRun;
    case 'find_rarity':
      return stats.itemsFound;
    case 'earn_souls':
      return stats.totalSoulsEarned;
    case 'survive_runs':
      return stats.runsFinished;
    case 'ascend':
      return save.player.throneRank;
    default:
      return 0;
  }
}

/** Target value of a contract. */
export function contractTarget(defId: string): number {
  const def = Content.contracts.get(defId);
  if (!def) return 1;
  const params = def.params as Record<string, number | string>;
  switch (def.metric) {
    case 'kill_count':
      return Number(params.count ?? 10);
    case 'reach_depth':
      return Number(params.depth ?? 5);
    case 'find_rarity':
      return Number(params.count ?? 1);
    case 'earn_souls':
      return Number(params.souls ?? 100);
    case 'survive_runs':
      return Number(params.count ?? 1);
    case 'ascend':
      return Number(params.zone ?? 1);
    default:
      return 1;
  }
}

/** Refresh the progress of every contract. */
export function updateContractProgress(save: SaveFile): void {
  for (const contract of save.contracts.rotating) {
    contract.progress = contractProgress(save, contract);
  }
  if (save.contracts.story) {
    save.contracts.story.progress = contractProgress(save, save.contracts.story);
  }
}

/** Claim a finished contract. Returns the reward description or null. */
export function claimContract(save: SaveFile, contractId: string): string | null {
  const list = [...save.contracts.rotating];
  if (save.contracts.story) list.push(save.contracts.story);
  const contract = list.find((c) => c.id === contractId);
  if (!contract || contract.claimed) return null;
  const def = Content.contracts.get(contract.defId);
  if (!def) return null;
  if (contract.progress < contractTarget(contract.defId)) return null;

  contract.claimed = true;
  save.player.souls += def.reward.souls;
  save.stats.totalSoulsEarned += def.reward.souls;
  if (def.reward.inheritance) {
    save.player.inheritance += def.reward.inheritance;
    save.stats.totalInheritanceEarned += def.reward.inheritance;
  }
  if (def.reward.echo) {
    save.player.echo += def.reward.echo;
    save.stats.totalEchoEarned += def.reward.echo;
  }

  if (contract.story) {
    // The story chain advances the chapter and unlocks the next zone.
    const chapter = Number((def.params as Record<string, number>).zone ?? 0);
    if (chapter > save.player.storyChapter) save.player.storyChapter = chapter;
    if (chapter > save.player.highestZone) save.player.highestZone = chapter + 1;
    ensureStoryContract(save.contracts, save.player.storyChapter + 1);
    return `Story chapter ${chapter} complete!`;
  }

  return `Claimed ${def.reward.souls} souls${def.reward.inheritance ? ' and an Inheritance' : ''}.`;
}

/* ------------------------------------------------------------ login bonus */

export interface LoginBonus {
  available: boolean;
  day: number;
  souls: number;
  inheritance: number;
}

/** Compute the login bonus for today. */
export function loginBonus(save: SaveFile, now = new Date()): LoginBonus {
  const state = save.contracts;
  const today = dayKey(now);
  const streak = state.lastLoginDay ? dayDiff(state.lastLoginDay, today) : 99;
  const continues = streak === 1;
  const day = continues ? (state.loginStreak % 7) + 1 : 1;
  const cycle = Math.floor(state.loginStreak / 7);
  const souls = Math.round((BALANCE.loginSouls + BALANCE.loginSoulsPerStreak * day) * (1 + cycle * 0.25));
  const inheritance = state.loginStreak > 0 && day % BALANCE.loginInheritanceEvery === 0 ? 1 : 0;
  return {
    available: !state.loginClaimedToday && state.lastLoginDay !== today,
    day,
    souls,
    inheritance,
  };
}

/** Collect the login bonus. */
export function collectLoginBonus(save: SaveFile, now = new Date()): LoginBonus | null {
  const state = save.contracts;
  const today = dayKey(now);
  if (state.loginClaimedToday || state.lastLoginDay === today) return null;

  const bonus = loginBonus(save, now);
  save.player.souls += bonus.souls;
  save.stats.totalSoulsEarned += bonus.souls;
  if (bonus.inheritance > 0) {
    save.player.inheritance += bonus.inheritance;
    save.stats.totalInheritanceEarned += bonus.inheritance;
  }
  state.loginStreak += 1;
  state.lastLoginDay = today;
  state.loginClaimedToday = true;
  return bonus;
}

/** Called on every load - resets the "claimed today" flag on a new day. */
export function rollLoginDay(save: SaveFile, now = new Date()): void {
  const today = dayKey(now);
  if (save.contracts.lastLoginDay !== today) {
    save.contracts.loginClaimedToday = false;
  }
}
