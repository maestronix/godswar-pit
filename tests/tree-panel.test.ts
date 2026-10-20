/**
 * The pit tree panel.
 *
 * The tree has to show every room of the climb - nothing may be cut off and
 * the rooms the player can enter right now have to be obvious.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { generateTree } from '../src/sim/tree';
import { renderTreePanel } from '../src/ui/tree/tree-panel';
import type { SimState } from '../src/sim/types';

function fakeState(zone: number, seed: number, next: string[], current: string | null): SimState {
  const tree = generateTree({ zone, seed });
  return {
    tree,
    currentNodeId: current,
    nextNodeIds: next,
    visitedNodeIds: current ? [current] : [],
  } as unknown as SimState;
}

function viewBoxOf(svg: SVGSVGElement): { width: number; height: number } {
  const raw = svg.getAttribute('viewBox') ?? '0 0 0 0';
  const parts = raw.split(/\s+/).map(Number);
  return { width: parts[2] ?? 0, height: parts[3] ?? 0 };
}

function translateOf(group: Element): { x: number; y: number } {
  const match = /translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(group.getAttribute('transform') ?? '');
  return { x: match ? Number(match[1]) : NaN, y: match ? Number(match[2]) : NaN };
}

describe('the pit tree panel', () => {
  for (const zone of [1, 5, 9]) {
    it(`keeps every room of zone ${zone} inside the viewBox`, () => {
      const state = fakeState(zone, 1234 + zone, [], null);
      const container = document.createElement('div');
      renderTreePanel(container, { state });

      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      const { width, height } = viewBoxOf(svg as SVGSVGElement);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);

      const groups = container.querySelectorAll('g.tree-node');
      expect(groups.length).toBe(state.tree.nodes.length);

      for (const group of groups) {
        const box = group.querySelector('.tree-node__box');
        expect(box).toBeTruthy();
        const boxWidth = Number(box!.getAttribute('width'));
        const boxHeight = Number(box!.getAttribute('height'));
        const { x, y } = translateOf(group);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + boxWidth).toBeLessThanOrEqual(width);
        expect(y + boxHeight).toBeLessThanOrEqual(height);
      }
    });
  }

  it('marks the rooms the player can enter and picks them on click', () => {
    const state = fakeState(1, 99, [], null);
    const next = state.tree.layers[2]!.slice(0, 2);
    state.nextNodeIds = next;
    state.currentNodeId = state.tree.layers[1]![0]!;
    state.visitedNodeIds = [state.currentNodeId];

    const container = document.createElement('div');
    const picked: string[] = [];
    renderTreePanel(container, {
      state,
      onPick: (nodeId) => picked.push(nodeId),
    });

    const clickable = container.querySelectorAll('g.tree-node--clickable');
    expect(clickable.length).toBe(next.length);

    // Every clickable room carries the marker and the keyboard role.
    for (const group of clickable) {
      expect(group.getAttribute('tabindex')).toBe('0');
      expect(group.getAttribute('role')).toBe('button');
      expect(group.getAttribute('aria-label')).toBeTruthy();
    }
    const markers = Array.from(container.querySelectorAll('g.tree-node--next text')).filter(
      (text) => text.textContent === 'NEXT',
    );
    expect(markers.length).toBe(next.length);

    (clickable[0] as SVGGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual([next[0]]);
  });

  it('shows the name of every room', () => {
    const state = fakeState(1, 5, [], null);
    const container = document.createElement('div');
    renderTreePanel(container, { state, showLabels: true });
    const labels = container.querySelectorAll('g.tree-node text');
    // The letter, the name of the room and (for the next rooms) the marker.
    expect(labels.length).toBeGreaterThanOrEqual(state.tree.nodes.length * 2);
  });
});
