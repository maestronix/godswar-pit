/** The offline report - shown when the player comes back. */
import { button, clear, el, statLine } from '../dom';
import { formatDuration, formatNumber } from '../../core/format';
import type { OfflineReport } from '../../state/offline';
import type { Game } from '../../game';

export function renderOfflineReport(root: HTMLElement, game: Game, report: OfflineReport): void {
  clear(root);

  root.append(
    el('header', { class: 'sub-header' }, [
      el('h1', { text: 'While you were away' }),
    ]),
  );

  const panel = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Return report' }),
    statLine('Time away', formatDuration(report.seconds)),
    statLine('Rooms visited', String(report.nodesVisited)),
    statLine('Depth reached', String(report.depth)),
    statLine('Enemies defeated', formatNumber(report.kills)),
    statLine('Souls earned', formatNumber(report.souls)),
    statLine('Divine Echo', formatNumber(report.echo)),
    statLine('Souls per minute', formatNumber(report.soulsPerMinute)),
    report.victory ? statLine('Result', 'Throne claimed') : statLine('Result', report.deathCause ?? 'The pit took you'),
  ]);
  root.append(panel);

  if (report.estimated) {
    const share = report.estimatedTicks / Math.max(1, report.totalTicks);
    root.append(
      el('div', { class: 'panel panel--muted' }, [
        el('h2', { class: 'panel__title', text: 'Estimated' }),
        el('p', {
          class: 'panel__text',
          text: `${Math.round(share * 100)}% of the time was estimated from a 50% efficiency curve. Long absences are never simulated completely - the numbers above the estimate are exact.`,
        }),
      ]),
    );
  }

  root.append(
    el('div', { class: 'actions' }, [
      button('Continue', () => {
        game.offlineReport = null;
        game.screen = game.state ? 'run' : 'hub';
      }, 'btn--primary'),
    ]),
  );
}
