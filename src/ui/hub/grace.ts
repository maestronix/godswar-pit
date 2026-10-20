/** GRACE MIRROR tab: the paragon tree bought with Divine Echo. */
import { clear, el, statLine } from '../dom';
import { formatNumber } from '../../core/format';
import { Content } from '../../data/registry';
import { mirrorCost } from '../../data/balance';
import { renderMetaTree } from '../tree/meta-tree';
import type { Game } from '../../game';
import type { TreeNodeDef } from '../../data/types';

export function renderGrace(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  const tree = Content.graceMirror;
  root.append(
    el('div', { class: 'panel' }, [
      el('h2', { class: 'panel__title', text: 'Grace Mirror' }),
      el('p', { class: 'panel__text', text: tree.description }),
      statLine('Divine Echo', formatNumber(save.player.echo)),
      statLine('Invested', formatNumber(save.meta.echoSpent)),
      statLine('Unlocked nodes', String(Object.keys(save.meta.graceMirror).length)),
    ]),
  );

  const box = el('div', { class: 'meta-tree-box' });
  root.append(box);

  renderMetaTree(box, {
    tree,
    ranks: save.meta.graceMirror,
    currency: 'echo',
    cost: (node, rank) => mirrorCost(node.depth, rank),
    onBuy: (node: TreeNodeDef) => {
      const cost = mirrorCost(node.depth, save.meta.graceMirror[node.id] ?? 0);
      if (save.player.echo < cost) return;
      game.store.update((s) => {
        s.player.echo -= cost;
        s.meta.echoSpent += cost;
        s.meta.graceMirror[node.id] = (s.meta.graceMirror[node.id] ?? 0) + 1;
      });
      game.screen = 'hub';
    },
  });
}
