/**
 * Automation helpers.
 *
 * The throne ranks that automate parts of the game. All of them work on the
 * save, never on the simulation state.
 */
import { Content } from '../data/registry';
import { compareItems } from '../sim/loot';
import { ITEM_SLOTS, type ItemSlot } from '../data/types';
import type { ItemRecord, SaveFile } from './schema';

/** Equip the best item of every slot (Throne 4 - Ironfist). */
export function autoEquip(save: SaveFile): number {
  let changed = 0;
  for (const slot of ITEM_SLOTS) {
    let bestIndex = -1;
    let best: ItemRecord | undefined;
    for (let i = 0; i < save.player.vault.length; i++) {
      const item = save.player.vault[i]!;
      if (item.slot !== slot) continue;
      if (compareItems(item, save.player.equipped[slot]) <= 0) continue;
      if (!best || compareItems(item, best) > 0) {
        best = item;
        bestIndex = i;
      }
    }
    if (bestIndex < 0 || !best) continue;
    save.player.vault.splice(bestIndex, 1);
    const previous = save.player.equipped[slot];
    save.player.equipped[slot] = best;
    if (previous) save.player.vault.push(previous);
    changed++;
  }
  return changed;
}

/** Bind a random codex aspect to every new legendary without one (Throne 7). */
export function autoRerollAspects(save: SaveFile, items: ItemRecord[]): number {
  const codex = save.unlocked.persistent.codex.filter((id) => Content.aspects.has(id));
  if (codex.length === 0) return 0;
  let changed = 0;
  for (const item of items) {
    if (item.rarity !== 'legendary' && item.rarity !== 'mythic') continue;
    if (item.aspectId) continue;
    const pool = codex.filter((id) => {
      const aspect = Content.aspects.get(id);
      return aspect && (aspect.classId === '' || aspect.classId === save.player.classId);
    });
    const list = pool.length > 0 ? pool : codex;
    item.aspectId = list[Math.floor(Math.random() * list.length)]!;
    changed++;
  }
  return changed;
}

/** The rarity a room is likely to drop - the Ash-Seer preview (Throne 2). */
export function previewRarity(seed: number, zone: number, depth: number): string {
  const weights = Content.zone(zone) ? zone : 1;
  void weights;
  let h = (seed ^ (depth * 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  const value = (h >>> 0) / 4294967296;
  if (value < 0.62) return 'common';
  if (value < 0.88) return 'magic';
  if (value < 0.97) return 'rare';
  if (value < 0.996) return 'legendary';
  return 'mythic';
}

export type { ItemSlot };
