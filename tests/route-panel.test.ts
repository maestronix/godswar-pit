/**
 * The path panel.
 *
 * The panel has to show every path of the pit - nothing may be cut off, and
 * while the choice is open every path has to be pickable.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../src/state/schema';
import { createRun } from '../src/sim/expedition';
import { renderRoutePanel } from '../src/ui/route/route-panel';
import type { SimState } from '../src/sim/types';

function makeState(zone: number, seed: number): SimState {
  const save = createDefaultSave();
  const { state } = createRun({
    player: save.player,
    tree: save.tree,
    unlocked: save.unlocked,
    meta: save.meta,
    seed,
    zoneId: zone,
    runId: `run_${seed}`,
  });
  return state;
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

describe('the path panel', () => {
  for (const zone of [1, 5, 9]) {
    it(`keeps every room of zone ${zone} inside the viewBox`, () => {
      const state = makeState(zone, 1234 + zone);
      const container = document.createElement('div');
      renderRoutePanel(container, { state });

      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      const { width, height } = viewBoxOf(svg as SVGSVGElement);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);

      const groups = container.querySelectorAll('g.tree-node');
      expect(groups.length).toBe(state.routes.nodes.length);

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

  it('lets the player pick every path while the choice is open', () => {
    const state = makeState(1, 99);
    const container = document.createElement('div');
    const picked: string[] = [];
    renderRoutePanel(container, {
      state,
      onPickRoute: (routeId) => picked.push(routeId),
    });

    const clickable = container.querySelectorAll('g.tree-node--clickable');
    expect(clickable.length).toBe(state.routes.nodes.length);

    for (const group of clickable) {
      expect(group.getAttribute('tabindex')).toBe('0');
      expect(group.getAttribute('role')).toBe('button');
      expect(group.getAttribute('aria-label')).toBeTruthy();
    }

    // The name of every path is clickable, too.
    const heads = container.querySelectorAll('g.route-head--open');
    expect(heads.length).toBe(state.routes.routes.length);

    (clickable[0] as SVGGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual([state.routes.routes[0]!.id]);
  });

  it('shows the name of every room', () => {
    const state = makeState(1, 5);
    const container = document.createElement('div');
    renderRoutePanel(container, { state, showLabels: true });
    const labels = container.querySelectorAll('g.tree-node text');
    expect(labels.length).toBeGreaterThanOrEqual(state.routes.nodes.length * 2);
  });
});
