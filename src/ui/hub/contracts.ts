/** CONTRACTS tab: rotating contracts, the story chain and the login bonus. */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { claimContract, collectLoginBonus, contractTarget, loginBonus, updateContractProgress } from '../../state/contracts';
import type { Game } from '../../game';

export function renderContracts(root: HTMLElement, game: Game): void {
  const save = game.save;
  updateContractProgress(save);
  clear(root);

  /* ------------------------------------------------------------ story */

  const story = save.contracts.story;
  if (story) {
    const def = Content.contracts.get(story.defId);
    const target = contractTarget(story.defId);
    const panel = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Story' })]);
    if (def) {
      panel.append(
        el('p', { class: 'panel__text', text: def.description }),
        statLine('Progress', `${Math.min(story.progress, target)} / ${target}`),
        statLine('Reward', `${formatNumber(def.reward.souls)} souls + ${def.reward.inheritance} inheritance`),
      );
      if (story.progress >= target && !story.claimed) {
        panel.append(button('Claim', () => {
          const message = claimContract(save, story.id);
          if (message) {
            game.persist();
            game.screen = 'hub';
          }
        }, 'btn--primary'));
      }
    }
    root.append(panel);
  }

  /* -------------------------------------------------------- rotating */

  const list = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Contracts' })]);
  if (save.contracts.rotating.length === 0) {
    list.append(el('p', { class: 'empty', text: 'No contracts yet - come back later.' }));
  }
  for (const contract of save.contracts.rotating) {
    const def = Content.contracts.get(contract.defId);
    if (!def) continue;
    const target = contractTarget(contract.defId);
    const done = contract.progress >= target;
    const row = el('div', { class: `contract${contract.claimed ? ' contract--done' : ''}` }, [
      el('div', { class: 'contract__text' }, [
        el('span', { class: 'contract__desc', text: def.description }),
        el('span', { class: 'contract__progress', text: `${Math.min(contract.progress, target)} / ${target}` }),
      ]),
      el('div', { class: 'contract__reward', text: `${formatNumber(def.reward.souls)} souls` }),
    ]);
    if (done && !contract.claimed) {
      row.append(
        button('Claim', () => {
          claimContract(save, contract.id);
          game.persist();
          game.screen = 'hub';
        }, 'btn--small'),
      );
    } else if (contract.claimed) {
      row.append(el('span', { class: 'contract__done', text: 'Claimed' }));
    }
    list.append(row);
  }
  root.append(list);

  /* ------------------------------------------------------ login bonus */

  const bonus = loginBonus(save);
  const bonusPanel = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Login bonus' }),
    statLine('Streak', `${save.contracts.loginStreak} days`),
    statLine('Today', bonus.available ? `Day ${bonus.day}: ${formatNumber(bonus.souls)} souls` : 'Already collected'),
  ]);
  if (bonus.available) {
    bonusPanel.append(
      button('Collect', () => {
        if (collectLoginBonus(save)) {
          game.persist();
          game.screen = 'hub';
        }
      }, 'btn--primary'),
    );
  }
  root.append(bonusPanel);
}
