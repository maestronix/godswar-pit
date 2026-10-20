/** ACHIEVEMENTS screen. */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { metricValue } from '../../state/achievements';
import type { Game } from '../../game';
import type { AchievementCategory } from '../../data/types';

const CATEGORIES: AchievementCategory[] = [
  'COMBAT',
  'DEPTH',
  'LOOT',
  'META',
  'IDLE',
  'COLLECTION',
  'SECRET',
  'DISCOVERY',
];

export function renderAchievements(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  root.append(
    el('header', { class: 'sub-header' }, [
      el('h1', { text: 'Achievements' }),
      el('span', { text: `${save.achievements.unlocked.length} / ${Content.achievements.size}` }),
      button('Back to Ashvale', () => {
        game.screen = 'hub';
      }),
    ]),
  );

  for (const category of CATEGORIES) {
    const list = [...Content.achievements.values()].filter((a) => a.category === category);
    if (list.length === 0) continue;
    const done = list.filter((a) => save.achievements.unlocked.includes(a.id)).length;
    const panel = el('div', { class: 'panel' }, [
      el('h2', { class: 'panel__title', text: category }),
      statLine('Progress', `${done} / ${list.length}`),
    ]);
    for (const achievement of list) {
      const unlocked = save.achievements.unlocked.includes(achievement.id);
      if (achievement.hidden && !unlocked) continue;
      const value = metricValue(save, achievement.metric);
      const row = el('div', { class: `achievement${unlocked ? ' achievement--done' : ''}` }, [
        el('span', { class: 'achievement__name', text: achievement.name }),
        el('span', { class: 'achievement__desc', text: achievement.description }),
        el('span', {
          class: 'achievement__progress',
          text: unlocked ? 'unlocked' : `${formatNumber(Math.min(value, achievement.threshold))} / ${formatNumber(achievement.threshold)}`,
        }),
        el('span', {
          class: 'achievement__reward',
          text: `${achievement.reward.amount} ${achievement.reward.kind}`,
        }),
      ]);
      panel.append(row);
    }
    root.append(panel);
  }
}
