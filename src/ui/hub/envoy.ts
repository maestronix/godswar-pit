/** ENVOY tab: the Inheritance Tree - permanent unlocks bought with Inheritance. */
import { button, clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { inheritanceCost, nodeCost } from '../../data/balance';
import { ARCHETYPES } from '../../data/nodes/archetypes';
import { renderMetaTree } from '../tree/meta-tree';
import type { Game } from '../../game';
import type { TreeNodeDef } from '../../data/types';
import type { SaveFile } from '../../state/schema';

export function renderEnvoy(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  const tree = Content.inheritanceTree;
  const panel = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Inheritance Tree' }),
    el('p', { class: 'panel__text', text: tree.description }),
    statLine('Inheritance', formatNumber(save.player.inheritance)),
    statLine('Unlocked nodes', String(Object.keys(save.meta.inheritanceTree).length)),
  ]);
  root.append(panel);

  // The classes are unlocked here as well.
  const classes = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Classes' })]);
  for (const classDef of Content.classList) {
    const unlocked = save.unlocked.persistent.classes.includes(classDef.id);
    const cost = classUnlockCost(classDef.id);
    const row = el('div', { class: 'equip-row' }, [
      el('span', { class: 'equip-row__slot', text: classDef.name }),
      el('span', { class: 'equip-row__item', text: unlocked ? 'Unlocked' : classDef.tagline }),
    ]);
    if (!unlocked) {
      row.append(
        button(`Unlock (${cost} inheritance)`, () => {
          if (save.player.inheritance < cost) return;
          game.store.update((s) => {
            s.player.inheritance -= cost;
            if (!s.unlocked.persistent.classes.includes(classDef.id)) {
              s.unlocked.persistent.classes.push(classDef.id);
            }
          });
          game.persist();
          game.screen = 'hub';
        }, 'btn--small'),
      );
    }
    classes.append(row);
  }
  root.append(classes);

  // The remembrance: run skill points become permanent tree ranks.
  const remembrance = el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__title', text: 'Remembrance' }),
    el('p', {
      class: 'panel__text',
      text: 'Turn the skill points of your last run into permanent ranks of your class tree. A point costs 12 souls, but it never dies.',
    }),
    statLine('Run skill points', String(save.player.runSkillPoints)),
    statLine('Cost per point', `${REMEMBRANCE_COST} souls`),
  ]);
  if (!save.meta.remembranceUnlocked) {
    remembrance.append(
      button(`Unlock the remembrance (3 inheritance)`, () => {
        if (save.player.inheritance < 3) return;
        game.store.update((s) => {
          s.player.inheritance -= 3;
          s.meta.remembranceUnlocked = true;
        });
        game.persist();
        game.screen = 'hub';
      }, 'btn--small'),
    );
  } else {
    remembrance.append(
      button('Convert the run skill points', () => {
        const points = save.player.runSkillPoints;
        if (points <= 0) return;
        const cost = points * REMEMBRANCE_COST;
        if (save.player.souls < cost) return;
        game.store.update((s) => {
          s.player.souls -= cost;
          s.player.runSkillPoints = 0;
          for (let i = 0; i < points; i++) buyCheapestNode(s);
        });
        game.persist();
        game.screen = 'hub';
      }, 'btn--primary'),
    );
  }
  root.append(remembrance);

  const box = el('div', { class: 'meta-tree-box' });
  root.append(box);

  renderMetaTree(box, {
    tree,
    ranks: save.meta.inheritanceTree,
    currency: 'inheritance',
    cost: (node, rank) => inheritanceCost(node.depth, rank),
    onBuy: (node: TreeNodeDef) => {
      const cost = inheritanceCost(node.depth, save.meta.inheritanceTree[node.id] ?? 0);
      if (save.player.inheritance < cost) return;
      game.store.update((s) => {
        s.player.inheritance -= cost;
        s.meta.inheritanceSpent += cost;
        s.meta.inheritanceTree[node.id] = (s.meta.inheritanceTree[node.id] ?? 0) + 1;
        applyUnlocks(s, node);
      });
      game.screen = 'hub';
    },
  });
}

/** How much inheritance a class costs to unlock. */
export function classUnlockCost(classId: string): number {
  const order = Content.classList.findIndex((c) => c.id === classId);
  return Math.max(1, order) * 2;
}

const REMEMBRANCE_COST = 12;

/** Buy the cheapest available class tree node - one point of remembrance. */
function buyCheapestNode(save: SaveFile): void {
  const candidates: { node: TreeNodeDef; cost: number }[] = [];
  for (const tree of Content.treeList) {
    if (tree.classId !== save.player.classId) continue;
    for (const node of tree.nodes) {
      const rank = save.tree.ranks[node.id] ?? 0;
      if (rank >= node.maxRank) continue;
      if (node.parent && !save.tree.ranks[node.parent]) continue;
      candidates.push({
        node,
        cost: nodeCost(node.depth, ARCHETYPES[node.archetype]?.costMult ?? 1, rank),
      });
    }
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.cost - b.cost);
  const chosen = candidates[0]!;
  save.tree.ranks[chosen.node.id] = (save.tree.ranks[chosen.node.id] ?? 0) + 1;
  applyUnlocks(save, chosen.node);
}

/** A bought node can grant permanent unlocks. */
function applyUnlocks(save: SaveFile, node: TreeNodeDef): void {
  if (node.archetype === 'ACCESS') {
    const skill = String(node.params.skill ?? '');
    if (skill && !save.unlocked.persistent.activeSkills.includes(skill)) {
      save.unlocked.persistent.activeSkills.push(skill);
    }
  }
  if (node.archetype === 'RUNE_UNLOCK') {
    const rune = String(node.params.rune ?? '');
    if (rune && !save.unlocked.persistent.runes.includes(rune)) {
      save.unlocked.persistent.runes.push(rune);
    }
  }
}

export { button, clear, el };
