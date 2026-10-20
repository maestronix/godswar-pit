/**
 * The run screen: the battle canvas, the pit tree and the run HUD.
 */
import { el, button, statLine, bar, clear } from './dom';
import { formatNumber, formatClock } from '../core/format';
import { Content } from '../data/registry';
import { drawScene, VIEW_WIDTH, VIEW_HEIGHT } from '../art/renderer';
import { NODE_LABELS, renderTreeLegend, renderTreePanel } from './tree/tree-panel';
import { spendRunSkillPoint } from '../sim/expedition';
import { hasFeature } from '../state/thrones';
import { previewRarity } from '../state/automation';
import type { Game } from '../game';

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
  const treeBox = el('div', { class: 'tree-box' });
  const sideBox = el('div', { class: 'run-side' });

  root.append(
    el('div', { class: 'run' }, [
      el('div', { class: 'run__main' }, [hud, el('div', { class: 'run__canvas' }, [canvas])]),
      el('div', { class: 'run__side' }, [sideBox, treeBox]),
    ]),
  );

  /* ------------------------------------------------------------- HUD */

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

  /* -------------------------------------------------------- tree panel */

  renderTreePanel(treeBox, {
    state,
    onPick: (nodeId) => {
      game.pickNode(nodeId);
      refresh();
    },
    preview: hasFeature(game.save, 'throne_preview')
      ? (nodeId) => {
          const node = state.tree.nodes.find((n) => n.id === nodeId);
          if (!node || node.type === 'HEALING' || node.type === 'EVENT') return null;
          return previewRarity(node.contentSeed, state.zoneId, node.depth);
        }
      : undefined,
  });
  treeBox.append(renderTreeLegend());

  /* ------------------------------------------------------------ side */

  const renderSide = (): void => {
    clear(sideBox);
    sideBox.append(
      el('div', { class: 'panel' }, [
        el('h2', { class: 'panel__title', text: 'Expedition' }),
        statLine('Depth', `${state.depth} / ${state.tree.layers.length - 1}`),
        statLine('Kills', formatNumber(state.kills)),
        statLine('Souls', formatNumber(state.souls)),
        statLine('Level', `${state.hero.level} (${state.hero.runSkillPoints} skill points)`),
        statLine('Loot found', formatNumber(state.loot.length)),
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
      sideBox.append(parallel);
    }

    if (state.hero.runSkillPoints > 0) {
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
                renderSide();
              }
            }, 'btn--tiny'),
          ]),
        );
      }
      sideBox.append(list);
    }

    if (state.phase === 'event' && state.pendingEvent) {
      const event = Content.events.get(state.pendingEvent.eventId);
      if (event) {
        const modal = el('div', { class: 'modal' }, [
          el('div', { class: 'modal__box' }, [
            el('h2', { class: 'panel__title', text: event.name }),
            el('p', { class: 'modal__text', text: event.description }),
            ...event.choices.map((choice) =>
              el('button', { class: 'modal__choice', type: 'button' }, [
                el('span', { class: 'modal__choice-label', text: choice.label }),
                el('span', { class: 'modal__choice-outcome', text: choice.outcome }),
              ]),
            ),
          ]),
        ]);
        for (const [index, choice] of event.choices.entries()) {
          const node = modal.querySelectorAll('.modal__choice')[index] as HTMLButtonElement;
          node.addEventListener('click', () => {
            game.pickEvent(choice.id);
            refresh();
          });
        }
        sideBox.append(modal);
      }
    }
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
              : 'Ascending';

    if (ctx) {
      drawScene(ctx, {
        state,
        render: game.render,
        showDamageNumbers: game.save.settings.showDamageNumbers,
        reducedMotion: game.save.settings.reducedMotion,
      });
    }
    renderSide();
  };

  /** The report of a finished run. */
  const showSummary = (): void => {
    const summary = game.summary;
    if (!summary) return;
    if (root.querySelector('.modal')) return;
    root.append(
      el('div', { class: 'modal' }, [
        el('div', { class: 'modal__box' }, [
          el('h2', { class: 'panel__title', text: summary.victory ? 'Throne claimed' : 'You died' }),
          el('p', { text: summary.deathCause ?? '' }),
          statLine('Depth', String(summary.depth)),
          statLine('Kills', formatNumber(summary.kills)),
          statLine('Souls', formatNumber(summary.souls)),
          statLine('Items kept', String(summary.itemsKept)),
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
      showSummary();
      return;
    }
    refresh();
  };
  showSummary();

  void NODE_LABELS;
  void bar;
}
