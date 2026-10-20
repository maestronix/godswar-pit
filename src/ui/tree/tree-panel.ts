/**
 * The tree panel.
 *
 * Renders the pit tree of the current run as SVG. The whole tree is visible:
 * the player knows the type and the risk of every room, but not what is
 * inside it.
 */
import { el } from '../dom';
import type { NodeType } from '../../data/types';
import type { SimState } from '../../sim/types';

const NODE_SIZE = 26;
const GAP_X = 34;
const GAP_Y = 40;

export const NODE_COLORS: Record<NodeType, string> = {
  FIGHT: '#8a8a8a',
  ELITE: '#e07a2c',
  TREASURE: '#e8c15a',
  HEALING: '#7ac74f',
  EVENT: '#b34b8a',
  TRAP: '#d1454b',
  BOSS: '#f0b27a',
};

export const NODE_LABELS: Record<NodeType, string> = {
  FIGHT: 'Fight',
  ELITE: 'Elite',
  TREASURE: 'Treasure',
  HEALING: 'Shrine',
  EVENT: 'Event',
  TRAP: 'Trap',
  BOSS: 'Throne',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

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

export interface TreePanelOptions {
  state: SimState;
  onPick?: (nodeId: string) => void;
  /** Show the node names next to the symbols. */
  showLabels?: boolean;
  /** Loot rarity preview (the Ash-Seer automation). */
  preview?: (nodeId: string) => string | null;
}

const RARITY_DOTS: Record<string, string> = {
  common: '#9a9a9a',
  magic: '#5c8ae6',
  rare: '#e8c15a',
  legendary: '#e07a2c',
  mythic: '#c050d8',
};

export function renderTreePanel(container: HTMLElement, options: TreePanelOptions): void {
  const { state, onPick } = options;
  container.innerHTML = '';

  const layers = state.tree.layers;
  const maxWidth = Math.max(...layers.map((l) => l.length));
  const width = maxWidth * GAP_X + 40;
  const height = layers.length * GAP_Y + 30;

  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height: '100%',
    preserveAspectRatio: 'xMidYMin meet',
    class: 'tree-svg',
  });

  // Connections.
  for (const node of state.tree.nodes) {
    if (!node.parent) continue;
    const parent = state.tree.nodes.find((n) => n.id === node.parent);
    if (!parent) continue;
    const x1 = 20 + parent.x * GAP_X + NODE_SIZE / 2;
    const y1 = height - 20 - parent.depth * GAP_Y;
    const x2 = 20 + node.x * GAP_X + NODE_SIZE / 2;
    const y2 = height - 20 - node.depth * GAP_Y;
    const visited = state.visitedNodeIds.includes(node.id);
    root.append(
      svg('line', {
        x1,
        y1,
        x2,
        y2,
        stroke: visited ? '#e8c15a' : '#3a3a44',
        'stroke-width': visited ? 2 : 1,
        'stroke-dasharray': visited ? '' : '3 3',
      }),
    );
  }

  // Nodes.
  for (const node of state.tree.nodes) {
    const x = 20 + node.x * GAP_X;
    const y = height - 20 - node.depth * GAP_Y - NODE_SIZE;
    const isCurrent = state.currentNodeId === node.id;
    const isNext = state.nextNodeIds.includes(node.id);
    const isVisited = state.visitedNodeIds.includes(node.id);
    const color = NODE_COLORS[node.type];

    const group = svg('g', {
      class: `tree-node${isNext ? ' tree-node--next' : ''}${isCurrent ? ' tree-node--current' : ''}`,
      transform: `translate(${x},${y})`,
    });

    group.append(
      svg('rect', {
        width: NODE_SIZE,
        height: NODE_SIZE,
        rx: 4,
        fill: isVisited ? '#2a2635' : '#181622',
        stroke: color,
        'stroke-width': isCurrent ? 3 : isNext ? 2 : 1,
      }),
    );

    // Risk pips.
    for (let i = 0; i < node.risk; i++) {
      group.append(
        svg('rect', {
          x: 3 + i * 4,
          y: NODE_SIZE - 5,
          width: 3,
          height: 3,
          fill: '#d1454b',
        }),
      );
    }

    group.append(
      svg('text', {
        x: NODE_SIZE / 2,
        y: NODE_SIZE / 2 + 5,
        'text-anchor': 'middle',
        fill: color,
        'font-size': 13,
        'font-family': 'monospace',
      }, [node.type === 'EVENT' ? '?' : node.type.charAt(0)]),
    );

    // Loot preview (Ash-Seer).
    const previewRarity = options.preview?.(node.id) ?? null;
    if (previewRarity && RARITY_DOTS[previewRarity]) {
      group.append(
        svg('rect', {
          x: NODE_SIZE - 7,
          y: 2,
          width: 5,
          height: 5,
          fill: RARITY_DOTS[previewRarity],
        }),
      );
    }

    const title = svg('title', {}, [
      `${NODE_LABELS[node.type]} - risk ${node.risk}${isNext ? ' (click to enter)' : ''}`,
    ]);
    group.append(title);

    if (onPick && isNext) {
      group.setAttribute('class', 'tree-node tree-node--next tree-node--clickable');
      group.addEventListener('click', () => onPick(node.id));
    }

    root.append(group);
  }

  container.append(root);
}

/** A small legend of the node types. */
export function renderTreeLegend(): HTMLElement {
  return el(
    'div',
    { class: 'tree-legend' },
    (Object.keys(NODE_LABELS) as NodeType[]).map((type) =>
      el('span', { class: 'tree-legend__item' }, [
        el('span', { class: 'tree-legend__dot', style: `background:${NODE_COLORS[type]}` }),
        el('span', { text: NODE_LABELS[type] }),
      ]),
    ),
  );
}
