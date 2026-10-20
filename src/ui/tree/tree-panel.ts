/**
 * The tree panel.
 *
 * Renders the pit tree of the current run as SVG. The whole tree is visible:
 * the player knows the type and the risk of every room, but not what is
 * inside it.
 *
 * The layout is computed from the tree itself: the column of a node is its
 * index inside its layer, the row is its depth. The viewBox is built from
 * the real bounds of the nodes, so nothing is ever cut off and the SVG can
 * scale itself into whatever box the panel gives it.
 */
import { el } from '../dom';
import type { NodeType } from '../../data/types';
import type { SimState, SimTreeNode } from '../../sim/types';

const NODE_SIZE = 26;
/** Horizontal distance between two columns of the same layer. */
const GAP_X = 116;
/** Vertical distance between two layers. */
const GAP_Y = 36;
/** Free space around the tree (glow, labels, the NEXT marker). */
const MARGIN = 18;
/** The background of the panel - used as the halo of the texts. */
const PANEL_BG = '#171320';

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

const ACCENT = '#e8c15a';
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
  /** Show the name of the room under every node. */
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

interface Point {
  x: number;
  y: number;
}

/**
 * The position of every node inside the SVG.
 *
 * The column is the index of the node inside its layer, the row is its depth
 * (the entrance is at the bottom, the throne at the top). The result is
 * shifted so that the whole tree sits inside the viewBox.
 */
export function layoutTree(nodes: SimTreeNode[], layers: string[][]): {
  points: Map<string, Point>;
  width: number;
  height: number;
} {
  const slot = new Map<string, { index: number; count: number }>();
  for (const ids of layers) {
    ids.forEach((id, index) => slot.set(id, { index, count: ids.length }));
  }

  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0);
  const raw = new Map<string, Point>();
  let minX = Infinity;
  let maxX = -Infinity;

  for (const node of nodes) {
    const place = slot.get(node.id) ?? { index: 0, count: 1 };
    const x = (place.index - (place.count - 1) / 2) * GAP_X;
    const y = (maxDepth - node.depth) * GAP_Y;
    raw.set(node.id, { x, y });
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 0;
  }

  const width = maxX - minX + NODE_SIZE + MARGIN * 2;
  const height = maxDepth * GAP_Y + NODE_SIZE + MARGIN * 2;

  const points = new Map<string, Point>();
  for (const [id, point] of raw) {
    points.set(id, { x: point.x - minX + MARGIN, y: point.y + MARGIN });
  }
  return { points, width, height };
}

export function renderTreePanel(container: HTMLElement, options: TreePanelOptions): void {
  const { state, onPick } = options;
  const showLabels = options.showLabels ?? true;
  container.innerHTML = '';

  const nodes = state.tree.nodes;
  if (nodes.length === 0) {
    container.append(el('p', { class: 'empty', text: 'No tree yet.' }));
    return;
  }

  const { points, width, height } = layoutTree(nodes, state.tree.layers);

  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'tree-svg',
    role: 'group',
    'aria-label': 'Pit tree',
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));

  // Connections.
  for (const node of nodes) {
    if (!node.parent) continue;
    const parent = byId.get(node.parent);
    const from = parent ? points.get(parent.id) : undefined;
    const to = points.get(node.id);
    if (!from || !to) continue;
    const visited = state.visitedNodeIds.includes(node.id);
    root.append(
      svg('line', {
        x1: from.x + NODE_SIZE / 2,
        y1: from.y + NODE_SIZE / 2,
        x2: to.x + NODE_SIZE / 2,
        y2: to.y + NODE_SIZE / 2,
        stroke: visited ? ACCENT : '#3a3a44',
        'stroke-width': visited ? 2 : 1,
        ...(visited ? {} : { 'stroke-dasharray': '3 3' }),
      }),
    );
  }

  // Nodes.
  for (const node of nodes) {
    const point = points.get(node.id);
    if (!point) continue;
    const isCurrent = state.currentNodeId === node.id;
    const isNext = state.nextNodeIds.includes(node.id);
    const isVisited = state.visitedNodeIds.includes(node.id);
    const color = NODE_COLORS[node.type];
    const label = NODE_LABELS[node.type];

    const classes = ['tree-node'];
    if (isNext) classes.push('tree-node--next');
    if (isCurrent) classes.push('tree-node--current');
    if (isVisited) classes.push('tree-node--visited');
    if (!isNext && !isCurrent && !isVisited) classes.push('tree-node--idle');

    const group = svg('g', {
      class: classes.join(' '),
      transform: `translate(${point.x},${point.y})`,
    });

    // The halo of the rooms the player can enter right now.
    if (isNext) {
      group.append(
        svg('rect', {
          class: 'tree-node__halo',
          x: -4,
          y: -4,
          width: NODE_SIZE + 8,
          height: NODE_SIZE + 8,
          rx: 7,
          fill: 'none',
          stroke: ACCENT,
          'stroke-width': 1.5,
          opacity: 0.55,
        }),
      );
    }

    group.append(
      svg('rect', {
        class: 'tree-node__box',
        width: NODE_SIZE,
        height: NODE_SIZE,
        rx: 4,
        fill: isNext ? '#2c2440' : isCurrent || isVisited ? '#2a2635' : '#181622',
        stroke: isNext || isCurrent ? ACCENT : color,
        'stroke-width': isCurrent ? 3 : isNext ? 2 : 1,
      }),
    );

    // Risk pips.
    for (let i = 0; i < node.risk; i++) {
      group.append(
        svg('rect', {
          class: 'tree-node__risk',
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
        fill: isNext ? '#f4f4f4' : color,
        'font-size': 13,
        'font-family': 'monospace',
        'font-weight': isNext ? 'bold' : 'normal',
      }, [node.type === 'EVENT' ? '?' : node.type.charAt(0)]),
    );

    // The name of the room.
    if (showLabels) {
      group.append(
        svg('text', {
          x: NODE_SIZE / 2,
          y: NODE_SIZE + 9,
          'text-anchor': 'middle',
          fill: isNext ? ACCENT : isCurrent ? ACCENT : '#6f6683',
          'font-size': 8,
          'font-family': 'monospace',
          stroke: PANEL_BG,
          'stroke-width': 3,
          'paint-order': 'stroke fill',
        }, [label]),
      );
    }

    // The marker on the rooms the player can enter right now.
    if (isNext) {
      group.append(
        svg('text', {
          x: NODE_SIZE / 2,
          y: -5,
          'text-anchor': 'middle',
          fill: ACCENT,
          'font-size': 8,
          'font-family': 'monospace',
          'letter-spacing': '0.1em',
          stroke: PANEL_BG,
          'stroke-width': 3,
          'paint-order': 'stroke fill',
        }, ['NEXT']),
      );
    }

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

    group.append(
      svg('title', {}, [
        `${label} - risk ${node.risk}${isNext ? ' (click to enter)' : ''}${isCurrent ? ' (you are here)' : ''}`,
      ]),
    );

    if (onPick && isNext) {
      group.setAttribute('class', `${classes.join(' ')} tree-node--clickable`);
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `Enter ${label.toLowerCase()}, risk ${node.risk}`);
      group.addEventListener('click', () => onPick(node.id));
      group.addEventListener('keydown', (event) => {
        const key = (event as KeyboardEvent).key;
        if (key !== 'Enter' && key !== ' ') return;
        event.preventDefault();
        onPick(node.id);
      });
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
