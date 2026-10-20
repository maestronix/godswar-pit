/**
 * The class skill trees.
 *
 * Three trees per class, bought with souls. Ranks survive death; the active
 * skills that some nodes grant only last for the current ascension.
 */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { ARCHETYPES } from '../../data/nodes/archetypes';
import { nodeCost } from '../../data/balance';
import { renderMetaTree } from './meta-tree';
import type { Game } from '../../game';
import type { TreeDef, TreeNodeDef } from '../../data/types';

let selectedTree = 0;

export function renderSkillTrees(root: HTMLElement, game: Game): void {
  const save = game.save;
  const classDef = Content.class(save.player.classId) ?? Content.classList[0]!;
  const trees = classDef.trees.map((id) => Content.tree(id)).filter((t): t is TreeDef => Boolean(t));
  clear(root);

  root.append(
    el('header', { class: 'sub-header' }, [
      el('h1', { text: `${classDef.name} - Skill trees` }),
      button('Back to Ashvale', () => {
        game.screen = 'hub';
      }),
    ]),
  );

  const tabs = el('nav', { class: 'tabs', role: 'tablist' });
  trees.forEach((tree, index) => {
    const node = el('button', {
      class: `tab${selectedTree === index ? ' tab--active' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-selected': selectedTree === index ? 'true' : 'false',
    }, [tree.name]);
    node.addEventListener('click', () => {
      selectedTree = index;
      game.screen = 'trees';
    });
    tabs.append(node);
  });
  root.append(tabs);

  const tree = trees[selectedTree] ?? trees[0]!;
  const owned = Object.entries(save.tree.ranks)
    .filter(([id]) => id.startsWith(`${tree.id}_`))
    .reduce<Record<string, number>>((acc, [id, rank]) => {
      acc[id] = rank;
      return acc;
    }, {});

  root.append(
    el('div', { class: 'panel' }, [
      el('h2', { class: 'panel__title', text: tree.name }),
      el('p', { class: 'panel__text', text: tree.description }),
      statLine('Souls', formatNumber(save.player.souls)),
      statLine('Owned ranks', String(Object.values(owned).reduce((a, b) => a + b, 0))),
    ]),
  );

  const box = el('div', { class: 'meta-tree-box' });
  root.append(box);

  renderMetaTree(box, {
    tree,
    ranks: owned,
    currency: 'souls',
    cost: (node, rank) => nodeCost(node.depth, ARCHETYPES[node.archetype]?.costMult ?? 1, rank),
    onBuy: (node: TreeNodeDef) => {
      const cost = nodeCost(node.depth, ARCHETYPES[node.archetype]?.costMult ?? 1, save.tree.ranks[node.id] ?? 0);
      if (save.player.souls < cost) return;
      game.store.update((s) => {
        s.player.souls -= cost;
        s.tree.ranks[node.id] = (s.tree.ranks[node.id] ?? 0) + 1;
        applySkillUnlock(s, node);
      });
      game.persist();
      game.screen = 'trees';
    },
  });

  root.append(renderLoadoutPanel(game));
}

/**
 * The loadout of the class: which runes are bound to which skill and in
 * which order the skills fire.
 */
function renderLoadoutPanel(game: Game): HTMLElement {
  const save = game.save;
  const classDef = Content.class(save.player.classId) ?? Content.classList[0]!;
  const panel = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Loadout' }),
    el('p', { class: 'panel__text', text: 'Bind a rune to a skill and set the order in which the skills fire.' }),
  ]);

  const available = new Set<string>([
    classDef.signature,
    ...classDef.actives,
    ...save.unlocked.persistent.activeSkills,
    ...save.unlocked.currentInkarnation.activeSkills,
  ]);
  const skills = Content.skillsOfClass(classDef.id).filter((skill) => available.has(skill.id));

  for (const skill of skills) {
    const row = el('div', { class: 'skill-row' }, [
      el('span', { class: 'skill-row__name', text: skill.name }),
    ]);

    // Rune selection - only runes the player has unlocked.
    const select = el('select', { class: 'select' }) as HTMLSelectElement;
    select.append(el('option', { value: '', text: 'No rune' }));
    for (const rune of skill.runes) {
      const unlocked = save.unlocked.persistent.runes.includes(rune.id);
      const option = el('option', { value: rune.id, text: unlocked ? rune.name : `${rune.name} (locked)` });
      if (!unlocked) option.setAttribute('disabled', 'disabled');
      if (save.player.loadout.runes[skill.id] === rune.id) option.setAttribute('selected', 'selected');
      select.append(option);
    }
    select.value = save.player.loadout.runes[skill.id] ?? '';
    select.addEventListener('change', () => {
      game.store.update((s) => {
        if (select.value) s.player.loadout.runes[skill.id] = select.value;
        else delete s.player.loadout.runes[skill.id];
      });
      game.persist();
    });
    row.append(select);

    // Priority: move the skill up and down in the auto cast list.
    row.append(
      button('^', () => {
        game.store.update((s) => {
          const list = s.player.loadout.skillPriority.filter((id) => id !== skill.id);
          const index = s.player.loadout.skillPriority.indexOf(skill.id);
          list.splice(Math.max(0, index - 1), 0, skill.id);
          s.player.loadout.skillPriority = list;
        });
        game.screen = 'trees';
      }, 'btn--tiny'),
      button('v', () => {
        game.store.update((s) => {
          const list = s.player.loadout.skillPriority.filter((id) => id !== skill.id);
          const index = s.player.loadout.skillPriority.indexOf(skill.id);
          list.splice(Math.min(list.length, index + 1), 0, skill.id);
          s.player.loadout.skillPriority = list;
        });
        game.screen = 'trees';
      }, 'btn--tiny'),
    );
    panel.append(row);
  }

  const order = save.player.loadout.skillPriority;
  if (order.length > 0) {
    panel.append(
      el('p', { class: 'panel__text', text: `Auto cast order: ${order.join(' -> ')}` }),
    );
  }

  return panel;
}

/** ACCESS nodes grant an active skill - for this ascension or forever. */
function applySkillUnlock(save: { unlocked: { persistent: { activeSkills: string[] }; currentInkarnation: { activeSkills: string[] } } }, node: TreeNodeDef): void {
  if (node.archetype !== 'ACCESS') return;
  const skill = String(node.params.skill ?? '');
  if (!skill) return;
  const permanent = Boolean(node.params.permanent);
  const bucket = permanent ? save.unlocked.persistent.activeSkills : save.unlocked.currentInkarnation.activeSkills;
  if (!bucket.includes(skill)) bucket.push(skill);
}
