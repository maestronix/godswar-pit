/** SMITHY tab: recraft, respec, aspect reroll and the scrap rules. */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { RARITY_COLORS } from '../../art/palette';
import { compareItems } from '../../sim/loot';
import { BALANCE } from '../../data/balance';
import type { Game } from '../../game';

const RECRAFT_COST = 120;
const RESPEC_COST = 250;
const ASPECT_REROLL_COST = 400;

export function renderSmithy(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  /* ---------------------------------------------------------- recraft */

  const recraft = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Recraft' }),
    el('p', { class: 'panel__text', text: 'Reroll the value of one affix on an item in your vault.' }),
  ]);
  const recraftList = el('div', { class: 'item-list' });
  const recraftable = save.player.vault.filter((item) => item.affixes.length > 0).slice(0, 12);
  if (recraftable.length === 0) {
    recraftList.append(el('p', { class: 'empty', text: 'No items with affixes in the vault.' }));
  }
  for (const item of recraftable) {
    recraftList.append(
      el('div', { class: 'item-row' }, [
        el('span', { class: 'item-row__name', style: `color:${RARITY_COLORS[item.rarity]}`, text: item.name }),
        el('span', { class: 'item-row__meta', text: `iLvl ${item.itemLevel} - ${item.affixes.length} affixes` }),
        button(`Reroll (${RECRAFT_COST})`, () => {
          if (save.player.souls < RECRAFT_COST) return;
          game.store.update((s) => {
            s.player.souls -= RECRAFT_COST;
            s.stats.recrafts += 1;
            const target = s.player.vault.find((v) => v.id === item.id);
            if (target && target.affixes.length > 0) {
              const roll = target.affixes[Math.floor(Math.random() * target.affixes.length)]!;
              const def = Content.affixes.get(roll.affixId);
              if (def) {
                const value = def.min + (def.max - def.min) * Math.random();
                roll.value = Math.round(value * 10000) / 10000;
              }
            }
          });
          game.screen = 'hub';
        }, 'btn--small'),
      ]),
    );
  }
  recraft.append(recraftList);
  root.append(recraft);

  /* ------------------------------------------------------------ respec */

  const ownedNodes = Object.entries(save.tree.ranks).filter(([, rank]) => rank > 0);
  const respec = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Respec' }),
    el('p', { class: 'panel__text', text: 'Refund every rank in your class trees and start over.' }),
    statLine('Owned nodes', String(ownedNodes.length)),
    statLine('Cost', `${RESPEC_COST} souls`),
  ]);
  respec.append(
    button('Respec', () => {
      if (ownedNodes.length === 0 || save.player.souls < RESPEC_COST) return;
      game.store.update((s) => {
        s.player.souls -= RESPEC_COST;
        s.stats.respecs += 1;
        s.tree.ranks = {};
        s.tree.runRanks = {};
      });
      game.screen = 'hub';
    }, 'btn--primary'),
  );
  root.append(respec);

  /* ------------------------------------------------------ aspect reroll */

  const codex = save.unlocked.persistent.codex.filter((id) => Content.aspects.has(id));
  const reroll = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Aspect reroll' }),
    el('p', { class: 'panel__text', text: 'Bind an aspect from your codex to an item in your vault.' }),
    statLine('Codex entries', String(codex.length)),
  ]);
  const rerollList = el('div', { class: 'item-list' });
  for (const item of save.player.vault.slice(0, 8)) {
    rerollList.append(
      el('div', { class: 'item-row' }, [
        el('span', { class: 'item-row__name', style: `color:${RARITY_COLORS[item.rarity]}`, text: item.name }),
        el('span', { class: 'item-row__meta', text: item.aspectId ? Content.aspects.get(item.aspectId)?.name ?? '' : 'No aspect' }),
        button(`Reroll (${ASPECT_REROLL_COST})`, () => {
          if (codex.length === 0 || save.player.souls < ASPECT_REROLL_COST) return;
          game.store.update((s) => {
            s.player.souls -= ASPECT_REROLL_COST;
            s.stats.aspectRerolls += 1;
            const target = s.player.vault.find((v) => v.id === item.id);
            if (target) {
              const pool = codex.filter((id) => {
                const aspect = Content.aspects.get(id);
                return aspect && (aspect.classId === '' || aspect.classId === target.baseId);
              });
              const aspect = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)]! : codex[Math.floor(Math.random() * codex.length)]!;
              target.aspectId = aspect;
            }
          });
          game.screen = 'hub';
        }, 'btn--small'),
      ]),
    );
  }
  reroll.append(rerollList);
  root.append(reroll);

  /* ------------------------------------------------------------- scrap */

  const scrap = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Scrap rules' }),
    el('p', { class: 'panel__text', text: 'Items below the quality threshold are destroyed when they enter the vault.' }),
    statLine('Threshold', `${Math.round(save.settings.scrapThreshold * 100)}%`),
  ]);
  const threshold = el('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: String(Math.round(save.settings.scrapThreshold * 100)),
  }) as HTMLInputElement;
  threshold.addEventListener('input', () => {
    game.store.update((s) => {
      s.settings.scrapThreshold = Number(threshold.value) / 100;
    });
  });
  const auto = el('input', { type: 'checkbox' }) as HTMLInputElement;
  auto.checked = save.settings.autoScrap;
  auto.addEventListener('change', () => {
    game.store.update((s) => {
      s.settings.autoScrap = auto.checked;
    });
  });
  scrap.append(el('div', { class: 'field' }, [auto, el('span', { text: 'Auto scrap' })]));
  scrap.append(el('div', { class: 'field' }, [threshold]));
  root.append(scrap);

  void BALANCE;
  void compareItems;
  void formatNumber;
}
