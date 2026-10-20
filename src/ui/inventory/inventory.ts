/** INVENTORY: equipment, vault and codex. */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { RARITY_COLORS } from '../../art/palette';
import { compareItems, itemScore } from '../../sim/loot';
import { ITEM_SLOTS, type ItemSlot } from '../../data/types';
import type { Game } from '../../game';
import type { ItemRecord } from '../../state/schema';

const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  boots: 'Boots',
  gloves: 'Gloves',
  amulet: 'Amulet',
  ring: 'Ring',
};

let search = '';
let onlyBetter = false;

export function renderInventory(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  root.append(
    el('header', { class: 'sub-header' }, [
      el('h1', { text: 'Inventory' }),
      button('Back to Ashvale', () => {
        game.screen = 'hub';
      }),
    ]),
  );

  /* --------------------------------------------------------- equipment */

  const gear = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Equipment' })]);
  for (const slot of ITEM_SLOTS) {
    const item = save.player.equipped[slot];
    const better = findBetter(save.player.vault, slot, item);
    const row = el('div', { class: 'equip-row' }, [
      el('span', { class: 'equip-row__slot', text: SLOT_LABELS[slot] }),
      el('span', {
        class: 'equip-row__item',
        style: `color:${item ? RARITY_COLORS[item.rarity] : '#5c5c6a'}`,
        text: item ? item.name : 'empty',
      }),
      el('span', { class: 'equip-row__score', text: item ? formatNumber(itemScore(item)) : '' }),
    ]);
    if (better) {
      row.append(button('Equip better', () => equipFromVault(game, better.id, slot), 'btn--small'));
    }
    gear.append(row);
  }
  root.append(gear);

  /* ------------------------------------------------------------- vault */

  const vault = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: `Vault (${save.player.vault.length})` })]);

  const searchInput = el('input', { class: 'input', type: 'search', placeholder: 'Search items...' }) as HTMLInputElement;
  searchInput.value = search;
  searchInput.addEventListener('input', () => {
    search = searchInput.value.toLowerCase();
    game.screen = 'inventory';
  });
  const betterToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
  betterToggle.checked = onlyBetter;
  betterToggle.addEventListener('change', () => {
    onlyBetter = betterToggle.checked;
    game.screen = 'inventory';
  });
  vault.append(el('div', { class: 'field' }, [searchInput, betterToggle, el('span', { text: 'Only upgrades' })]));

  const items = save.player.vault.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search)) return false;
    if (onlyBetter) {
      const equipped = save.player.equipped[item.slot];
      if (!equipped) return false;
      if (compareItems(item, equipped) <= 0) return false;
    }
    return true;
  });

  const list = el('div', { class: 'item-list' });
  if (items.length === 0) {
    list.append(el('p', { class: 'empty', text: 'The vault is empty. Win a throne to fill it.' }));
  }
  for (const item of items.slice(0, 200)) {
    const equipped = save.player.equipped[item.slot];
    const better = compareItems(item, equipped) > 0;
    const affixText = item.affixes
      .map((roll) => {
        const def = Content.affixes.get(roll.affixId);
        return def ? `${def.id.replace('aff_', '')} ${formatAffix(def.stat, roll.value)}` : '';
      })
      .filter(Boolean)
      .join(', ');
    const aspect = item.aspectId ? Content.aspects.get(item.aspectId) : undefined;
    list.append(
      el('div', { class: `item-row${better ? ' item-row--better' : ''}` }, [
        el('span', { class: 'item-row__name', style: `color:${RARITY_COLORS[item.rarity]}`, text: item.name }),
        el('span', { class: 'item-row__meta', text: `iLvl ${item.itemLevel} - ${affixText}` }),
        aspect ? el('span', { class: 'item-row__aspect', text: aspect.name }) : el('span'),
        button('Equip', () => equipFromVault(game, item.id, item.slot), 'btn--small'),
      ]),
    );
  }
  vault.append(list);
  root.append(vault);

  /* ------------------------------------------------------------- codex */

  const codex = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Codex' })]);
  const found = save.unlocked.persistent.codex.filter((id) => Content.aspects.has(id));
  codex.append(statLine('Aspects found', `${found.length} / ${Content.aspects.size}`));
  for (const id of found) {
    const aspect = Content.aspects.get(id)!;
    codex.append(el('div', { class: 'codex-row' }, [el('strong', { text: aspect.name }), el('span', { text: aspect.description })]));
  }
  root.append(codex);
}

function formatAffix(stat: string, value: number): string {
  if (stat.endsWith('Pct') || stat === 'critChance' || stat === 'critDamage' || stat === 'dodge') {
    return `+${(value * 100).toFixed(1)}%`;
  }
  return `+${formatNumber(value)}`;
}

function findBetter(vault: ItemRecord[], slot: ItemSlot, equipped: ItemRecord | undefined): ItemRecord | undefined {
  let best: ItemRecord | undefined;
  for (const item of vault) {
    if (item.slot !== slot) continue;
    if (compareItems(item, equipped) <= 0) continue;
    if (!best || compareItems(item, best) > 0) best = item;
  }
  return best;
}

function equipFromVault(game: Game, itemId: string, slot: ItemSlot): void {
  game.store.update((s) => {
    const index = s.player.vault.findIndex((v) => v.id === itemId);
    if (index < 0) return;
    const item = s.player.vault.splice(index, 1)[0]!;
    const previous = s.player.equipped[slot];
    s.player.equipped[slot] = item;
    if (previous) s.player.vault.push(previous);
  });
  game.persist();
  game.screen = 'inventory';
}
