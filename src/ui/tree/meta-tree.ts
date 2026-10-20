/**
 * A meta tree (Grace Mirror / Inheritance Tree).
 *
 * The same renderer is used for both: nodes are drawn in columns by depth,
 * connected by lines, and can be bought with the matching currency.
 */
import { el, button } from '../dom';
import { ARCHETYPES, resolveNodeEffect } from '../../data/nodes/archetypes';
import type { TreeDef, TreeNodeDef } from '../../data/types';
import { formatNumber } from '../../core/format';

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_W = 150;
const NODE_H = 54;
const GAP_X = 180;
const GAP_Y = 72;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  children: (Node | string)[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  for (const child of children) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

export interface MetaTreeOptions {
  tree: TreeDef;
  ranks: Record<string, number>;
  cost: (node: TreeNodeDef, rank: number) => number;
  currency: string;
  onBuy: (node: TreeNodeDef) => void;
}

export function renderMetaTree(container: HTMLElement, options: MetaTreeOptions): void {
  const { tree, ranks } = options;
  container.innerHTML = '';

  const depths = new Map<number, TreeNodeDef[]>();
  for (const node of tree.nodes) {
    const list = depths.get(node.depth) ?? [];
    list.push(node);
    depths.set(node.depth, list);
  }
  for (const list of depths.values()) list.sort((a, b) => a.id.localeCompare(b.id));

  // Layout: the x position is the index inside the depth layer.
  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, list] of depths) {
    list.forEach((node, index) => {
      positions.set(node.id, { x: index, y: depth });
    });
  }

  const maxDepth = Math.max(...depths.keys());
  const maxWidth = Math.max(...[...depths.values()].map((l) => l.length));

  const width = maxWidth * GAP_X + 40;
  const height = maxDepth * GAP_Y + 40;

  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height: String(height),
    class: 'meta-tree',
  });

  const byId = new Map(tree.nodes.map((n) => [n.id, n]));

  for (const node of tree.nodes) {
    if (!node.parent) continue;
    const parent = byId.get(node.parent);
    if (!parent) continue;
    const parentPos = positions.get(parent.id)!;
    const nodePos = positions.get(node.id)!;
    const px = 20 + parentPos.x * GAP_X + NODE_W / 2;
    const py = 20 + (maxDepth - parent.depth) * GAP_Y;
    const nx = 20 + nodePos.x * GAP_X + NODE_W / 2;
    const ny = 20 + (maxDepth - node.depth) * GAP_Y;
    root.append(
      svg('line', {
        x1: px,
        y1: py,
        x2: nx,
        y2: ny,
        stroke: '#3a3a44',
        'stroke-width': 1,
      }),
    );
  }

  for (const node of tree.nodes) {
    const pos = positions.get(node.id)!;
    const x = 20 + pos.x * GAP_X;
    const y = 20 + (maxDepth - node.depth) * GAP_Y;
    const owned = ranks[node.id] ?? 0;
    const affordable = owned < node.maxRank;

    const group = svg('g', { transform: `translate(${x},${y})` });
    group.append(
      svg('rect', {
        width: NODE_W,
        height: NODE_H,
        rx: 4,
        fill: owned > 0 ? '#2a2635' : '#181622',
        stroke: owned > 0 ? '#e8c15a' : '#3a3a44',
        'stroke-width': owned > 0 ? 2 : 1,
      }),
    );
    group.append(
      svg('text', { x: 8, y: 17, fill: '#f4f4f4', 'font-size': 12, 'font-family': 'monospace' }, [node.name]),
    );
    const spec = ARCHETYPES[node.archetype];
    const blurb = spec ? spec.blurb(node) : '';
    group.append(
      svg('text', { x: 8, y: 32, fill: '#8a8a8a', 'font-size': 9, 'font-family': 'monospace' }, [
        blurb.length > 26 ? `${blurb.slice(0, 25)}...` : blurb,
      ]),
    );
    group.append(
      svg('text', { x: 8, y: 47, fill: '#e8c15a', 'font-size': 9, 'font-family': 'monospace' }, [
        owned > 0 ? `Rank ${owned}/${node.maxRank}` : `${options.cost(node, owned)} ${options.currency}`,
      ]),
    );

    const title = svg('title', {}, [`${node.name}\n${node.description}\nCost: ${options.cost(node, owned)} ${options.currency}`]);
    group.append(title);

    if (affordable) {
      group.setAttribute('class', 'meta-node meta-node--buy');
      group.addEventListener('click', () => options.onBuy(node));
    }

    root.append(group);
  }

  container.append(root);
}

/** Human readable description of what a node does. */
export function describeNode(node: TreeNodeDef): string {
  const effect = resolveNodeEffect(node, 1);
  if (!effect) return node.description;
  switch (effect.type) {
    case 'access':
      return `Unlocks the skill ${effect.skill}${effect.permanent ? ' permanently' : ' for this ascension'}.`;
    case 'rune':
      return `Unlocks the rune ${effect.rune} for ${effect.skill}.`;
    case 'multiplier':
      return `Multiplies ${effect.stat} by ${effect.mult} per stack (max ${effect.cap}).`;
    case 'stat':
      return `+${formatNumber(effect.value * 100)}% ${effect.stat}.`;
    default:
      return node.description;
  }
}

export { button, el };
