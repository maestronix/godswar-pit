/**
 * Throne automation.
 *
 * Every throne rank unlocks one automation. The feature keys live in
 * `src/data/thrones.json`; this module is the single place that decides
 * whether a feature is active for a save.
 */
import { Content } from '../data/registry';
import { BALANCE } from '../data/balance';
import type { SaveFile } from './schema';

/** Is the automation of this throne rank unlocked? */
export function hasFeature(save: SaveFile, feature: string): boolean {
  return save.unlocked.persistent.features.includes(feature);
}

/** All feature keys of the claimed thrones. */
export function unlockedFeatures(save: SaveFile): string[] {
  const features: string[] = [];
  for (let rank = 1; rank <= save.player.throneRank; rank++) {
    const throne = Content.throne(rank);
    if (throne) features.push(throne.feature);
  }
  return features;
}

/** How many expeditions can run at the same time? */
export function parallelExpeditions(save: SaveFile): number {
  if (hasFeature(save, 'throne_divine_voice')) return 3;
  if (hasFeature(save, 'throne_parallel_2')) return 2;
  return 1;
}

/** The zone the steward rotates to when nothing else is selected. */
export function rotationZone(save: SaveFile): number {
  if (hasFeature(save, 'throne_shadowlord')) {
    return Math.min(save.player.highestZone, 10);
  }
  return save.player.loadout.targetZone;
}

/** Souls per minute that trickle in while no expedition runs. */
export function idleSoulRate(save: SaveFile): number {
  if (hasFeature(save, 'throne_soul_counter')) return 4;
  if (hasFeature(save, 'throne_divine_voice')) return 8;
  return 0;
}

/**
 * Ascend: the hard reset of the current incarnation.
 *
 * Everything that belongs to the incarnation is lost, the permanent
 * progression stays and the divine echo is reduced to the share that is
 * kept.
 */
export interface AscendResult {
  ok: boolean;
  message: string;
  echoKept: number;
  echoLost: number;
  inheritanceSacrificed: number;
}

export function canAscend(save: SaveFile): boolean {
  return save.player.throneRank >= 10;
}

export function ascend(save: SaveFile): AscendResult {
  if (!canAscend(save)) {
    return { ok: false, message: 'All ten thrones must be claimed first.', echoKept: 0, echoLost: 0, inheritanceSacrificed: 0 };
  }

  // The player may sacrifice inheritances to keep more echo.
  const sacrifice = Math.min(save.player.inheritance, 5);
  const keepRatio = Math.min(0.9, BALANCE.echoKeptBase + sacrifice * BALANCE.echoKeptPerSacrificedInheritance);
  const echoBefore = save.player.echo;
  const echoKept = Math.floor(echoBefore * keepRatio);

  save.player.incarnations += 1;
  save.player.echo = echoKept;
  save.player.inheritance -= sacrifice;
  save.meta.inheritanceSacrificed += sacrifice;

  // The loadout and the run progress are gone.
  save.player.equipped = {};
  save.player.vault = [];
  save.player.runSkillPoints = 0;
  save.player.level = 1;
  save.player.xp = 0;
  save.player.loadout.potions = [null, null, null];
  save.player.loadout.skillPriority = [];
  save.player.loadout.runes = {};

  // The class trees belong to the incarnation - the nodes are bought again.
  save.tree.ranks = {};
  save.tree.runRanks = {};

  // Only the skills that were unlocked during this ascension are lost.
  save.unlocked.currentInkarnation.activeSkills = [];

  save.run = null;

  return {
    ok: true,
    message: `You ascend. ${Math.round(keepRatio * 100)}% of your echo survived, ${sacrifice} inheritance was sacrificed.`,
    echoKept,
    echoLost: echoBefore - echoKept,
    inheritanceSacrificed: sacrifice,
  };
}
