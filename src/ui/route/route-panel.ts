/**
 * The path panel.
 *
 * Every path of the pit is a column of rooms: the entrance at the bottom, the
 * throne at the top. The player picks one of the columns at the entrance and
 * the hero walks exactly that column up to the throne - there is no second
 * choice after a cleared room.
 *
 * The layout is computed from the paths themselves: the column of a room is
 * the path it belongs to, the row is its depth. The viewBox is built from the
 * real bounds, so nothing is ever cut off and the SVG scales itself into
 * whatever box the panel gets.
 */
import { el } from '../dom';
import type { NodeType } from '../../data/types';
import type { SimState } from '../../sim/types';

const NODE_SIZE = 26;
/** Horizontal distance between two paths. */
const GAP_X = 132;
/** Vertical distance between two rooms. */
const GAP_Y = 36;
/** Free space around the paths (glow, labels, the markers). */
const MARGIN = 18;
/** Space for the name of the path above the topmost room. */
const HEADER = 26;
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

export interface RoutePanelOptions {
  state: SimState;
  onPickRoute?: (routeId: string) => void;
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
 * The position of every room inside the SVG.
 *
 * The column is the path the room belongs to, the row is its depth (the
 * entrance is at the bottom, the throne at the top).
 */
export function layoutRoutes(state: SimState): {
  points: Map<string, Point>;
  width: number;
  height: number;
} {
  const routes = state.routes.routes;
  const maxDepth = routes.reduce(
    (max, route) => route.nodes.reduce((m, node) => Math.max(m, node.depth), max),
    0,
  );

  const points = new Map<string, Point>();
  routes.forEach((route, index) => {
    const x = index * GAP_X;
    for (const node of route.nodes) {
      points.set(node.id, { x, y: (maxDepth - node.depth) * GAP_Y });
    }
  });

  const width = Math.max(0, routes.length - 1) * GAP_X + NODE_SIZE + MARGIN * 2;
  const height = maxDepth * GAP_Y + NODE_SIZE + MARGIN * 2 + HEADER;
  return { points, width, height };
}

export function renderRoutePanel(container: HTMLElement, options: RoutePanelOptions): void {
  const { state, onPickRoute } = options;
  const showLabels = options.showLabels ?? true;
  container.innerHTML = '';

  const routes = state.routes.routes;
  if (routes.length === 0) {
    container.append(el('p', { class: 'empty', text: 'No path yet.' }));
    return;
  }

  const { points, width, height } = layoutRoutes(state);

  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'tree-svg',
    role: 'group',
    'aria-label': 'The paths of the pit',
  });

  // The path that is being walked. The other ones are only shown as long as
  // the choice is open.
  const chosen = state.routeId;
  const open = chosen === null;

  routes.forEach((route, routeIndex) => {
    const point = points.get(route.nodes[0]?.id ?? '');
    const baseX = point?.x ?? routeIndex * GAP_X;
    const isChosen = route.id === chosen;

    // The name of the path.
    const head = svg('g', {
      class: `route-head${isChosen ? ' route-head--chosen' : ''}${open ? ' route-head--open' : ''}`,
      transform: `translate(${baseX},${MARGIN - 4})`,
    });
    head.append(
      svg('text', {
        x: NODE_SIZE / 2,
        y: 0,
        'text-anchor': 'middle',
        fill: isChosen || open ? ACCENT : '#6f6683',
        'font-size': 9,
        'font-family': 'monospace',
        'font-weight': isChosen || open ? 'bold' : 'normal',
        stroke: PANEL_BG,
        'stroke-width': 3,
        'paint-order': 'stroke fill',
      }, [route.name]),
    );
    if (open && onPickRoute) {
      head.setAttribute('tabindex', '0');
      head.setAttribute('role', 'button');
      head.setAttribute('aria-label', `Choose ${route.name}`);
      head.addEventListener('click', () => onPickRoute(route.id));
      head.addEventListener('keydown', (event) => {
        const key = (event as KeyboardEvent).key;
        if (key !== 'Enter' && key !== ' ') return;
        event.preventDefault();
        onPickRoute(route.id);
      });
    }
    root.append(head);

    for (const node of route.nodes) {
      const room = points.get(node.id);
      if (!room) continue;
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
        transform: `translate(${room.x + MARGIN},${room.y + MARGIN + HEADER})`,
      });

      // The halo of the room the hero is walking to.
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

      // The marker on the room the hero is walking to.
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
          `${label} - risk ${node.risk}${isNext ? ' (the hero walks here next)' : ''}${isCurrent ? ' (you are here)' : ''}`,
        ]),
      );

      // While the choice is open every room of every path can be clicked to
      // pick that path.
      if (open && onPickRoute) {
        group.setAttribute('class', `${classes.join(' ')} tree-node--clickable`);
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
        group.setAttribute('aria-label', `Choose ${route.name}, ${label.toLowerCase()}, risk ${node.risk}`);
        group.addEventListener('click', () => onPickRoute(route.id));
        group.addEventListener('keydown', (event) => {
          const key = (event as KeyboardEvent).key;
          if (key !== 'Enter' && key !== ' ') return;
          event.preventDefault();
          onPickRoute(route.id);
        });
      }

      root.append(group);
    }
  });

  container.append(root);
}

/** A small legend of the room types. */
export function renderRouteLegend(): HTMLElement {
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
