/** MARKET tab: potions and the souls <-> echo exchange. */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { BALANCE, potionPrice } from '../../data/balance';
import type { Game } from '../../game';

export function renderMarket(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  const potions = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Potions' }),
    el('p', { class: 'panel__text', text: 'Potions work for the whole run. Three slots in the loadout.' }),
  ]);
  const list = el('div', { class: 'item-list' });
  for (const potion of Content.potions.values()) {
    const row = el('div', { class: 'item-row' }, [
      el('span', { class: 'item-row__name', text: potion.name }),
      el('span', { class: 'item-row__meta', text: potion.description }),
    ]);
    const tierRow = el('div', { class: 'row' });
    potion.tiers.forEach((tier, index) => {
      const price = potionPrice(index, tier.mult);
      tierRow.append(
        button(`${tier.name} (${price})`, () => {
          if (save.player.souls < price) return;
          game.store.update((s) => {
            s.player.souls -= price;
          });
          game.screen = 'hub';
        }, 'btn--small'),
      );
    });
    row.append(tierRow);
    list.append(row);
  }
  potions.append(list);
  root.append(potions);

  const exchange = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Echo exchange' }),
    el('p', { class: 'panel__text', text: `Trade souls for Divine Echo (${BALANCE.echoExchangeRate} souls for 1 echo).` }),
    statLine('Souls', formatNumber(save.player.souls)),
    statLine('Divine Echo', formatNumber(save.player.echo)),
  ]);
  exchange.append(
    button(`Trade 1 echo (${BALANCE.echoExchangeRate} souls)`, () => {
      if (save.player.souls < BALANCE.echoExchangeRate) return;
      game.store.update((s) => {
        s.player.souls -= BALANCE.echoExchangeRate;
        s.player.echo += 1;
      });
      game.screen = 'hub';
    }),
    button('Trade 1 soul for 1 echo', () => {
      if (save.player.souls < 1) return;
      game.store.update((s) => {
        s.player.souls -= 1;
        s.player.echo += 1;
      });
      game.screen = 'hub';
    }),
  );
  root.append(exchange);
}
