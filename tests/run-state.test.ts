/**
 * The state of a running expedition.
 *
 * These are the regressions that cost the player a run:
 *  - a run must never end in a room without a way out (the trap anomaly used
 *    to clear the throne room and left the hero standing in an "ascending"
 *    state for ever),
 *  - a decision of the player has to be worth making: the event dialog and
 *    the choice of the path stay open long enough to read them.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../src/state/schema';
import { anomaliesForSeries, createRun, enterNode, pickRoute } from '../src/sim/expedition';
import {
  DECISION_TIMEOUT_TICKS,
  EVENT_DECISION_TIMEOUT_TICKS,
  ROUTE_DECISION_TIMEOUT_TICKS,
  step,
} from '../src/sim/engine';
import { DEFAULT_POLICY } from '../src/sim/policy';
import type { SimState } from '../src/sim/types';

function makeRun(seed = 4242, zone = 1, anomalies: string[] = []) {
  const save = createDefaultSave();
  const { state, ctx } = createRun({
    player: save.player,
    tree: save.tree,
    unlocked: save.unlocked,
    meta: save.meta,
    seed,
    zoneId: zone,
    runId: `run_${seed}`,
    anomalyIds: anomalies,
  });
  return { state, ctx };
}

/** A run must always come to an end - and it must never get stuck. */
function playOut(state: SimState, ctx: ReturnType<typeof makeRun>['ctx'], maxTicks = 60_000): void {
  for (let i = 0; i < maxTicks; i++) {
    step(state, ctx, 1, { policy: DEFAULT_POLICY });
    if (state.phase === 'dead' || state.phase === 'victory') return;
    if (state.phase === 'expedition' && state.routeId !== null && state.nextNodeIds.length === 0) {
      throw new Error(`the run is stuck at depth ${state.depth} (${state.currentNodeId})`);
    }
  }
  throw new Error(`the run did not end after ${maxTicks} ticks (depth ${state.depth})`);
}

describe('a run never gets stuck', () => {
  it('ends in every zone, also with the anomalies of the ascension', () => {
    for (const zone of [1, 3, 5]) {
      for (const seed of [1, 2, 42, 777]) {
        const { state, ctx } = makeRun(seed, zone, anomaliesForSeries(1));
        playOut(state, ctx);
        expect(['dead', 'victory']).toContain(state.phase);
      }
    }
  });

  it('keeps the fight of a room when the floor gives way', () => {
    // The trap anomaly of the first series is always active.
    const { state, ctx } = makeRun(99, 1, anomaliesForSeries(1));
    pickRoute(state, ctx, state.routes.routes[0]!.id);
    // The entrance is a fight - the trap must not clear the room.
    expect(state.phase).toBe('battle');
    expect(state.enemies.length).toBeGreaterThan(0);
  });

  it('lets the trap of the anomaly kill the hero', () => {
    const { state, ctx } = makeRun(5, 1, ['anom_s5_mountain_of_teeth']);
    state.hero.hp = 1;
    state.hero.maxHp = 100;
    // A room that is not a trap and not the entrance.
    const room = state.routes.routes[0]!.nodes.find((node) => node.type !== 'TRAP' && node.depth > 0)!;
    enterNode(state, ctx, room.id);
    // The trap may or may not hit - but the room must never be cleared by it.
    if (state.phase === 'dead') expect(state.deathCause).toBe('Killed by a trap');
    else expect(state.nextNodeIds.length).toBeLessThanOrEqual(1);
  });

  it('ends a run that has no way out any more', () => {
    const { state, ctx } = makeRun(3, 1);
    pickRoute(state, ctx, state.routes.routes[0]!.id);
    // A broken run: the hero stands in a room without a way out.
    state.phase = 'expedition';
    state.nextNodeIds = [];
    step(state, ctx, 2, { policy: DEFAULT_POLICY });
    expect(state.phase).toBe('dead');
    expect(state.deathCause).toBeTruthy();
  });
});

describe('the player gets the time to decide', () => {
  it('keeps the event dialog open long enough to read it', () => {
    expect(EVENT_DECISION_TIMEOUT_TICKS).toBeGreaterThan(DECISION_TIMEOUT_TICKS * 3);
    const { state, ctx } = makeRun(11, 1);
    pickRoute(state, ctx, state.routes.routes[0]!.id);
    // Walk to the first event room of the path.
    const eventRoom = state.routes.routes[0]!.nodes.find((node) => node.type === 'EVENT');
    if (!eventRoom) return;
    enterNode(state, ctx, eventRoom.id);
    expect(state.phase).toBe('event');
    // The steward may not decide before the dialog had a chance.
    step(state, ctx, DECISION_TIMEOUT_TICKS * 2, { policy: DEFAULT_POLICY });
    expect(state.phase).toBe('event');
  });

  it('gives the player the full window for the path of the run', () => {
    expect(ROUTE_DECISION_TIMEOUT_TICKS).toBeGreaterThan(DECISION_TIMEOUT_TICKS);
    const { state, ctx } = makeRun(13, 1);
    expect(state.routeId).toBeNull();
    step(state, ctx, DECISION_TIMEOUT_TICKS, { policy: DEFAULT_POLICY });
    // The path is still open - the steward may not take it away too fast.
    expect(state.routeId).toBeNull();
  });

  it('gives every room its own decision window', () => {
    const { state, ctx } = makeRun(17, 1);
    pickRoute(state, ctx, state.routes.routes[0]!.id);
    // A long fight must not eat the window of the next room.
    state.nodeTimer = 500;
    state.phase = 'expedition';
    state.nextNodeIds = [state.routes.routes[0]!.nodes[1]!.id];
    step(state, ctx, 1, { policy: DEFAULT_POLICY });
    expect(state.phase).toBe('expedition');
  });
});

describe('the path of the run', () => {
  it('is chosen once and never changed', () => {
    const { state, ctx } = makeRun(23, 1);
    const first = state.routes.routes[0]!;
    pickRoute(state, ctx, first.id);
    expect(state.routeId).toBe(first.id);
    const second = state.routes.routes[1]!;
    expect(pickRoute(state, ctx, second.id)).toBe(false);
    expect(state.routeId).toBe(first.id);
  });

  it('is walked without a second choice', () => {
    const { state, ctx } = makeRun(29, 1);
    pickRoute(state, ctx, state.routes.routes[1]!.id);
    const route = state.routes.routes[1]!;
    playOut(state, ctx);
    // Every visited room belongs to the path.
    for (const id of state.visitedNodeIds) {
      expect(route.nodes.some((node) => node.id === id)).toBe(true);
    }
  });
});
