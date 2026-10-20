/**
 * The hub of Ashvale.
 */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import type { Game } from '../../game';
import { renderContracts } from './contracts';
import { renderSmithy } from './smithy';
import { renderEnvoy } from './envoy';
import { renderGrace } from './grace';
import { renderMarket } from './market';
import { POLICY_PRESETS, type PolicyPreset } from '../../sim/policy';
import { rotationZone } from '../../state/thrones';

const TABS = [
  { id: 'contracts', label: 'CONTRACTS' },
  { id: 'smithy', label: 'SMITHY' },
  { id: 'envoy', label: 'ENVOY' },
  { id: 'grace', label: 'GRACE MIRROR' },
  { id: 'market', label: 'MARKET' },
];

export function renderHub(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  /* ------------------------------------------------------------ header */

  root.append(
    el('header', { class: 'hub__header' }, [
      el('div', { class: 'hub__title' }, [
        el('h1', { text: 'GODSWAR PIT' }),
        el('span', { class: 'hub__subtitle', text: 'Ashvale - Climb to become a god' }),
      ]),
      el('div', { class: 'hub__currencies' }, [
        currency('Souls', save.player.souls),
        currency('Divine Echo', save.player.echo),
        currency('Inheritance', save.player.inheritance),
      ]),
      el('div', { class: 'hub__ranks' }, [
        el('span', { text: `Throne ${save.player.throneRank}/10` }),
        el('span', { text: `Story ${save.player.storyChapter}/10` }),
        el('span', { text: `Ascension ${save.player.incarnations}` }),
      ]),
    ]),
  );

  /* --------------------------------------------------------- expedition */

  const expedition = el('div', { class: 'panel expedition' });
  expedition.append(el('h2', { class: 'panel__title', text: 'Expedition' }));

  const classRow = el('div', { class: 'row' });
  for (const classDef of Content.classList) {
    const unlocked = save.unlocked.persistent.classes.includes(classDef.id);
    const node = el('button', {
      class: `chip${save.player.classId === classDef.id ? ' chip--active' : ''}${unlocked ? '' : ' chip--locked'}`,
      type: 'button',
      title: unlocked ? classDef.tagline : 'Locked - see the Envoy',
    }, [unlocked ? classDef.name : '???']);
    node.addEventListener('click', () => {
      if (!unlocked) return;
      game.store.update((s) => {
        s.player.classId = classDef.id;
        s.player.loadout.skillPriority = [];
      });
      game.screen = 'hub';
    });
    classRow.append(node);
  }
  expedition.append(el('div', { class: 'field' }, [el('span', { class: 'field__label', text: 'Class' }), classRow]));

  const zoneRow = el('div', { class: 'row' });
  for (const zone of Content.zones) {
    const unlocked = zone.id <= save.player.highestZone;
    const node = el('button', {
      class: `chip${save.player.loadout.targetZone === zone.id ? ' chip--active' : ''}${unlocked ? '' : ' chip--locked'}`,
      type: 'button',
      title: unlocked ? zone.description : 'Locked',
    }, [`${zone.id}. ${unlocked ? zone.name : '???'}`]);
    node.addEventListener('click', () => {
      if (!unlocked) return;
      game.store.update((s) => {
        s.player.loadout.targetZone = zone.id;
      });
      game.screen = 'hub';
    });
    zoneRow.append(node);
  }
  expedition.append(el('div', { class: 'field' }, [el('span', { class: 'field__label', text: 'Zone' }), zoneRow]));

  // Potions.
  const potionRow = el('div', { class: 'row' });
  for (let slot = 0; slot < 3; slot++) {
    const select = el('select', { class: 'select' }) as HTMLSelectElement;
    select.append(el('option', { value: '', text: 'Empty' }));
    for (const potion of Content.potions.values()) {
      const option = el('option', { value: potion.id, text: potion.name });
      if (save.player.loadout.potions[slot] === potion.id) option.setAttribute('selected', 'selected');
      select.append(option);
    }
    select.value = save.player.loadout.potions[slot] ?? '';
    select.addEventListener('change', () => {
      game.store.update((s) => {
        s.player.loadout.potions[slot] = select.value || null;
      });
    });
    potionRow.append(el('label', { class: 'field__label' }, [`Slot ${slot + 1}`, select]));
  }
  expedition.append(el('div', { class: 'field' }, [el('span', { class: 'field__label', text: 'Potions' }), potionRow]));

  // Manager policy.
  const policyRow = el('div', { class: 'row' });
  for (const preset of Object.keys(POLICY_PRESETS) as PolicyPreset[]) {
    const node = el('button', {
      class: `chip${game.policy.preset === preset ? ' chip--active' : ''}`,
      type: 'button',
    }, [preset.toUpperCase()]);
    node.addEventListener('click', () => {
      game.policy = { ...POLICY_PRESETS[preset] };
      game.screen = 'hub';
    });
    policyRow.append(node);
  }
  expedition.append(el('div', { class: 'field' }, [el('span', { class: 'field__label', text: 'Steward' }), policyRow]));

  const autoRetry = el('input', { type: 'checkbox' }) as HTMLInputElement;
  autoRetry.checked = save.player.autoRetry;
  autoRetry.addEventListener('change', () => {
    game.store.update((s) => {
      s.player.autoRetry = autoRetry.checked;
    });
  });
  expedition.append(el('div', { class: 'field' }, [autoRetry, el('span', { text: 'Restart automatically after death' })]));

  const startZone = Math.min(rotationZone(save), save.player.highestZone);
  expedition.append(
    el('div', { class: 'expedition__actions' }, [
      button(`Descend into zone ${startZone}`, () => {
        game.startRun(Math.max(1, startZone));
      }, 'btn--primary'),
      button('Equipment', () => {
        game.screen = 'inventory';
      }),
      button('Skill trees', () => {
        game.screen = 'trees';
      }),
    ]),
  );

  // The parallel expeditions the throne ranks allow.
  if (game.maxParallel > 1) {
    expedition.append(
      statLine('Parallel expeditions', String(game.maxParallel)),
    );
  }

  // The ascension is the end of the first cycle.
  if (save.player.throneRank >= 10) {
    const ascendPanel = el('div', { class: 'panel panel--muted' }, [
      el('h2', { class: 'panel__title', text: 'The Hollow Throne' }),
      el('p', {
        class: 'panel__text',
        text: 'All ten thrones are yours. Ascend to become a god: your gear, your skill points and the skills of this incarnation are lost, the pit gets harder and you keep a part of your divine echo.',
      }),
    ]);
    ascendPanel.append(
      button('Ascend', () => {
        const message = game.ascend();
        window.alert(message);
        game.screen = 'hub';
      }, 'btn--primary'),
    );
    root.append(ascendPanel);
  }

  root.append(expedition);

  /* -------------------------------------------------------------- tabs */

  const tabBar = el('nav', { class: 'tabs', role: 'tablist' });
  const tabBody = el('div', { class: 'tab-body' });
  for (const tab of TABS) {
    const node = el('button', {
      class: `tab${game.hubTab === tab.id ? ' tab--active' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-selected': game.hubTab === tab.id ? 'true' : 'false',
    }, [tab.label]);
    node.addEventListener('click', () => {
      game.hubTab = tab.id;
      game.screen = 'hub';
    });
    tabBar.append(node);
  }
  root.append(el('div', { class: 'hub__tabs' }, [tabBar, tabBody]));

  switch (game.hubTab) {
    case 'smithy':
      renderSmithy(tabBody, game);
      break;
    case 'envoy':
      renderEnvoy(tabBody, game);
      break;
    case 'grace':
      renderGrace(tabBody, game);
      break;
    case 'market':
      renderMarket(tabBody, game);
      break;
    case 'contracts':
    default:
      renderContracts(tabBody, game);
      break;
  }
}

function currency(label: string, value: number): HTMLElement {
  return el('div', { class: 'currency' }, [
    el('span', { class: 'currency__label', text: label }),
    el('span', { class: 'currency__value', text: formatNumber(value) }),
  ]);
}

export { statLine };
