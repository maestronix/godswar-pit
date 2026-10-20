/** STATISTICS screen: numbers, best runs and the share text. */
import { button, clear, el, statLine } from './dom';
import { formatDuration, formatNumber } from '../core/format';
import { Content } from '../data/registry';
import type { Game } from '../game';

export function renderStats(root: HTMLElement, game: Game): void {
  const save = game.save;
  const stats = save.stats;
  clear(root);

  root.append(
    el('header', { class: 'sub-header' }, [
      el('h1', { text: 'Statistics' }),
      button('Back to Ashvale', () => {
        game.screen = 'hub';
      }),
    ]),
  );

  root.append(
    el('div', { class: 'panel' }, [
      el('h2', { class: 'panel__title', text: 'The climb' }),
      statLine('Runs started', formatNumber(stats.runsStarted)),
      statLine('Runs finished', formatNumber(stats.runsFinished)),
      statLine('Victories', formatNumber(stats.victories)),
      statLine('Deaths', formatNumber(stats.deaths)),
      statLine('Deepest run', String(stats.deepestRun)),
      statLine('Kills', formatNumber(stats.kills)),
      statLine('Boss kills', formatNumber(stats.bossKills)),
      statLine('Nodes visited', formatNumber(stats.nodesVisited)),
    ]),
  );

  root.append(
    el('div', { class: 'panel' }, [
      el('h2', { class: 'panel__title', text: 'Wealth' }),
      statLine('Total souls', formatNumber(stats.totalSoulsEarned)),
      statLine('Best run (souls)', formatNumber(stats.bestSoulsRun)),
      statLine('Total echo', formatNumber(stats.totalEchoEarned)),
      statLine('Total inheritance', formatNumber(stats.totalInheritanceEarned)),
      statLine('Items found', formatNumber(stats.itemsFound)),
      statLine('Items kept', formatNumber(stats.itemsVaulted)),
      statLine('Items scrapped', formatNumber(stats.itemsScrapped)),
    ]),
  );

  root.append(
    el('div', { class: 'panel' }, [
      el('h2', { class: 'panel__title', text: 'Time' }),
      statLine('Play time', formatDuration(stats.totalPlaySeconds)),
      statLine('Offline time', formatDuration(stats.totalOfflineSeconds)),
      statLine('Longest run', formatDuration(stats.longestRunSeconds)),
      statLine('Fastest throne', formatDuration(stats.fastestThroneSeconds)),
    ]),
  );

  const best = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Best runs' })]);
  if (stats.bestRuns.length === 0) {
    best.append(el('p', { class: 'empty', text: 'No runs recorded yet.' }));
  }
  for (const run of stats.bestRuns) {
    best.append(
      el('div', { class: 'run-row' }, [
        el('span', { text: `Zone ${run.zone} - depth ${run.depth}` }),
        el('span', { text: `${run.kills} kills` }),
        el('span', { text: formatDuration(run.seconds) }),
        el('span', { text: `${formatNumber(run.souls)} souls` }),
      ]),
    );
  }
  best.append(
    button('Copy share text', () => {
      const text = game.shareText();
      if (navigator.clipboard) void navigator.clipboard.writeText(text);
    }),
  );
  root.append(best);

  void Content;
}
