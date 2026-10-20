/**
 * The run screen: the battle canvas, the paths of the pit and the run HUD.
 */
import { el, button, statLine, clear } from './dom';
import { formatNumber, formatClock } from '../core/format';
import { Content } from '../data/registry';
import { drawScene, VIEW_WIDTH, VIEW_HEIGHT } from '../art/renderer';
import { NODE_LABELS, renderRouteLegend, renderRoutePanel } from './route/route-panel';
import { spendRunSkillPoint } from '../sim/expedition';
import { hasFeature } from '../state/thrones';
import { previewRarity } from '../state/automation';
import { EVENT_DECISION_TIMEOUT_TICKS, ROUTE_DECISION_TIMEOUT_TICKS } from '../sim/engine';
import type { Game } from '../game';
import type { SimState } from '../sim/types';

export function renderRunScreen(root: HTMLElement, game: Game): void {
  const state = game.state;
  clear(root);

  if (!state) {
    root.append(el('p', { class: 'empty', text: 'No expedition in progress.' }));
    root.append(button('Back to Ashvale', () => {
      game.screen = 'hub';
    }));
    return;
  }

  const zone = Content.zone(state.zoneId);
  const canvas = el('canvas', {
    class: 'scene',
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    role: 'img',
    'aria-label': `Battle scene in ${zone?.name ?? 'the pit'}`,
  }) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;

  const hud = el('div', { class: 'hud' });
  const pathBox = el('div', { class: 'tree-box' });
  const pathView = el('div', { class: 'tree-box__view' });
  const pathDepth = el('span', { class: 'tree-box__depth', text: '' });
  const pathHintKey = el('span', { class: 'tree-box__hint-key', text: '' });
  const pathHintRest = el('span', { text: '' });
  pathBox.append(
    el('div', { class: 'tree-box__head' }, [
      el('span', { class: 'tree-box__title', text: 'The paths' }),
      pathDepth,
    ]),
    el('p', { class: 'tree-box__hint' }, [pathHintKey, pathHintRest]),
    pathView,
  );
  const sideBox = el('div', { class: 'run-side' });
  // The interactive parts of the side panel live in their own boxes: they are
  // only rebuilt when their content changes. A dialog that is rebuilt every
  // frame swallows the click of the player.
  const statsBox = el('div', { class: 'run-side__stats' });
  const pointsBox = el('div', { class: 'run-side__points' });
  const eventBox = el('div', { class: 'run-side__event' });
  sideBox.append(statsBox, pointsBox, eventBox);
  const overlayBox = el('div', { class: 'run__overlay' });

  root.append(
    el('div', { class: 'run' }, [
      el('div', { class: 'run__main' }, [hud, el('div', { class: 'run__canvas' }, [canvas])]),
      el('div', { class: 'run__side' }, [pathBox, sideBox]),
    ]),
    overlayBox,
  );

  /* ------------------------------------------------------------ HUD */

  const hpBar = el('div', { class: 'bar bar--hp' }, [el('div', { class: 'bar__fill' })]);
  const resBar = el('div', { class: 'bar bar--res' }, [el('div', { class: 'bar__fill' })]);
  const hpFill = hpBar.querySelector('.bar__fill') as HTMLElement;
  const resFill = resBar.querySelector('.bar__fill') as HTMLElement;

  hud.append(
    el('div', { class: 'hud__row' }, [
      el('span', { class: 'hud__zone', text: zone?.name ?? 'The Pit' }),
      el('span', { class: 'hud__phase', text: '' }),
    ]),
    el('div', { class: 'hud__bars' }, [
      el('div', { class: 'hud__bar' }, [el('span', { class: 'hud__label', text: 'HP' }), hpBar]),
      el('div', { class: 'hud__bar' }, [el('span', { class: 'hud__label', text: 'RES' }), resBar]),
    ]),
    el('div', { class: 'hud__row hud__row--stats' }),
  );
  const statsRow = hud.querySelector('.hud__row--stats') as HTMLElement;
  const phaseLabel = hud.querySelector('.hud__phase') as HTMLElement;

  /* -------------------------------------------------------- path panel */

  const renderPaths = (): void => {
    renderRoutePanel(pathView, {
      state,
      onPickRoute: (routeId) => {
        game.pickRoute(routeId);
        refresh();
      },
      preview: hasFeature(game.save, 'throne_preview')
        ? (nodeId) => {
            const node = state.routes.nodes.find((n) => n.id === nodeId);
            if (!node || node.type === 'HEALING' || node.type === 'EVENT') return null;
            return previewRarity(node.contentSeed, state.zoneId, node.depth);
          }
        : undefined,
    });
  };

  // The panel is only redrawn when the state of the run changed.
  let pathSignature = '';
  const refreshPaths = (): void => {
    const signature = [
      state.currentNodeId ?? '-',
      state.nextNodeIds.join(','),
      state.visitedNodeIds.length,
      state.routeId ?? '-',
      state.phase,
    ].join('|');
    if (signature === pathSignature) return;
    pathSignature = signature;
    renderPaths();
    const [key, rest] = describePathHint(state);
    pathHintKey.textContent = key;
    pathHintRest.textContent = rest;
    pathDepth.textContent = `Depth ${state.depth} / ${maxDepth(state)}`;
  };

  refreshPaths();
  pathBox.append(renderRouteLegend());
  pathBox.classList.toggle('tree-box--still', game.save.settings.reducedMotion);

  /* ------------------------------------------------------------ side */

  const renderStats = (): void => {
    clear(statsBox);
    statsBox.append(
      el('div', { class: 'panel' }, [
        el('h2', { class: 'panel__title', text: 'Expedition' }),
        statLine('Depth', `${state.depth} / ${maxDepth(state)}`),
        statLine('Kills', formatNumber(state.kills)),
        statLine('Souls', formatNumber(state.souls)),
        statLine('Level', `${state.hero.level} (${state.hero.runSkillPoints} skill points)`),
        statLine('Loot found', formatNumber(state.loot.length)),
        el('p', {
          class: 'panel__text',
          text: 'The souls are paid out when the run ends. The loot of the run only survives a claimed throne.',
        }),
      ]),
    );

    // The background expeditions of the throne ranks.
    if (game.shadowRuns.length > 0) {
      const parallel = el('div', { class: 'panel' }, [
        el('h2', { class: 'panel__title', text: 'Parallel expeditions' }),
      ]);
      game.shadowRuns.forEach((shadow, index) => {
        parallel.append(
          statLine(
            `Expedition ${index + 2}`,
            `Zone ${shadow.zoneId} - depth ${shadow.state.depth} - ${formatNumber(shadow.state.souls)} souls`,
          ),
        );
      });
      statsBox.append(parallel);
    }
  };

  // The buttons of the run points are only rebuilt when they change.
  let pointsSignature = '';
  const renderPoints = (): void => {
    const signature = [
      state.hero.runSkillPoints,
      ...state.hero.skills.slice(0, 4).map((id) => `${id}:${state.hero.skillRanks[id] ?? 1}`),
    ].join('|');
    if (signature === pointsSignature) return;
    pointsSignature = signature;
    clear(pointsBox);
    if (state.hero.runSkillPoints <= 0) return;
    const list = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Spend run points' })]);
    const skills = state.hero.skills.slice(0, 4);
    for (const skillId of skills) {
      const skill = Content.skill(skillId);
      if (!skill) continue;
      list.append(
        el('div', { class: 'skill-row' }, [
          el('span', { class: 'skill-row__name', text: `${skill.name} (${state.hero.skillRanks[skill.id] ?? 1})` }),
          button('+1', () => {
            if (game.ctx && spendRunSkillPoint(state, game.ctx, { kind: 'skill', skillId })) {
              game.persist();
              renderPoints();
            }
          }, 'btn--tiny'),
        ]),
      );
    }
    pointsBox.append(list);
  };

  // The event dialog is only rebuilt when a new event waits.
  let eventSignature = '';
  let eventTimer: HTMLElement | null = null;
  const renderEvent = (): void => {
    const signature = `${state.phase}|${state.pendingEvent?.eventId ?? '-'}`;
    if (signature === eventSignature) {
      updateEventTimer();
      return;
    }
    eventSignature = signature;
    clear(eventBox);
    eventTimer = null;
    if (state.phase !== 'event' || !state.pendingEvent) return;
    const event = Content.events.get(state.pendingEvent.eventId);
    if (!event) return;
    const modal = el('div', { class: 'modal modal--event' }, [
      el('div', { class: 'modal__box' }, [
        el('h2', { class: 'panel__title', text: event.name }),
        el('p', { class: 'modal__text', text: event.description }),
        ...event.choices.map((choice) =>
          el('button', { class: 'modal__choice', type: 'button' }, [
            el('span', { class: 'modal__choice-label', text: choice.label }),
            el('span', { class: 'modal__choice-outcome', text: choice.outcome }),
          ]),
        ),
        el('p', { class: 'modal__timer', text: '' }),
      ]),
    ]);
    for (const [index, choice] of event.choices.entries()) {
      const node = modal.querySelectorAll('.modal__choice')[index] as HTMLButtonElement;
      node.addEventListener('click', () => {
        game.pickEvent(choice.id);
        refresh();
      });
    }
    eventTimer = modal.querySelector('.modal__timer') as HTMLElement;
    eventBox.append(modal);
    updateEventTimer();
  };

  const updateEventTimer = (): void => {
    if (!eventTimer) return;
    const remaining = Math.max(0, EVENT_DECISION_TIMEOUT_TICKS - state.nodeTimer);
    const seconds = Math.ceil(remaining / 10);
    eventTimer.textContent =
      remaining > 0
        ? `The steward decides in ${seconds}s.`
        : 'The steward decides...';
  };

  /* ------------------------------------------------------------- loop */

  const refresh = (): void => {
    const hpRatio = Math.max(0, state.hero.hp / Math.max(1, state.hero.maxHp));
    hpFill.style.width = `${(hpRatio * 100).toFixed(1)}%`;
    resFill.style.width = `${((state.hero.resource / Math.max(1, state.hero.maxResource)) * 100).toFixed(1)}%`;
    hpBar.classList.toggle('bar--low', hpRatio < 0.3);

    clear(statsRow);
    statsRow.append(
      el('span', { text: `Depth ${state.depth}` }),
      el('span', { text: `Kills ${formatNumber(state.kills)}` }),
      el('span', { text: `Souls ${formatNumber(state.souls)}` }),
      el('span', { text: formatClock(state.tick / 10) }),
    );

    phaseLabel.textContent =
      state.phase === 'battle'
        ? 'Combat'
        : state.phase === 'event'
          ? 'Choice'
          : state.phase === 'victory'
            ? 'Throne claimed'
            : state.phase === 'dead'
              ? 'Dead'
              : state.routeId === null
                ? 'Choose a path'
                : 'Climbing';

    if (ctx) {
      drawScene(ctx, {
        state,
        render: game.render,
        showDamageNumbers: game.save.settings.showDamageNumbers,
        reducedMotion: game.save.settings.reducedMotion,
      });
    }
    refreshPaths();
    renderStats();
    renderPoints();
    renderEvent();
  };

  /** The report of a finished run. */
  const showSummary = (): void => {
    const summary = game.summary;
    if (!summary) return;
    clear(overlayBox);
    overlayBox.append(
      el('div', { class: 'modal' }, [
        el('div', { class: 'modal__box' }, [
          el('h2', { class: 'panel__title', text: summary.victory ? 'Throne claimed' : 'You died' }),
          el('p', { text: summary.deathCause ?? '' }),
          statLine('Depth', String(summary.depth)),
          statLine('Kills', formatNumber(summary.kills)),
          statLine('Souls', formatNumber(summary.souls)),
          statLine('Items kept', String(summary.itemsKept)),
          summary.victory
            ? el('p', { class: 'panel__text', text: 'The throne secures the loot of the run.' })
            : el('p', {
                class: 'panel__text',
                text: 'The souls are yours. The loot of the run rots in the pit - only a claimed throne keeps it.',
              }),
          game.lastAchievements.length > 0
            ? el('p', {
                class: 'panel__text',
                text: `Achievements: ${game.lastAchievements.map((a) => a.name).join(', ')}`,
              })
            : el('span'),
          button(summary.victory ? 'Back to Ashvale' : 'Descend again', () => {
            game.onRender = null;
            game.summary = null;
            if (!summary.victory && game.save.player.autoRetry) {
              // The steward starts the next expedition right away.
              game.autoRetry();
              return;
            }
            game.screen = 'hub';
          }, summary.victory ? '' : 'btn--primary'),
        ]),
      ]),
    );
  };

  refresh();
  game.onRender = () => {
    if (game.state !== state) {
      // The run has ended - the report takes over.
      game.onRender = null;
      clear(eventBox);
      showSummary();
      return;
    }
    refresh();
  };
  showSummary();

  void NODE_LABELS;
}

/** The deepest room of the longest path. */
function maxDepth(state: SimState): number {
  let max = 0;
  for (const route of state.routes.routes) {
    for (const node of route.nodes) max = Math.max(max, node.depth);
  }
  return max;
}

/**
 * What the player has to do right now. The first part is the action, the
 * second part the explanation.
 */
function describePathHint(state: SimState): [string, string] {
  switch (state.phase) {
    case 'expedition':
      return state.routeId === null
        ? ['Choose a path', ` - click one of them. The steward picks one after ${ROUTE_DECISION_TIMEOUT_TICKS / 10}s.`]
        : ['The hero walks the path', ' - the next room opens by itself.'];
    case 'battle':
      return ['Fighting', ' - the next room opens when the fight ends.'];
    case 'event':
      return ['A choice is waiting', ' - pick it in the dialog.'];
    case 'victory':
      return ['The throne is claimed', '.'];
    case 'dead':
      return ['The run is over', '.'];
    default:
      return ['', ''];
  }
}
