/**
 * The tick engine.
 *
 * `step()` advances the simulation by a number of ticks. The live game calls
 * it with small batches from `requestAnimationFrame`, the offline simulation
 * calls it with big batches. Both produce exactly the same result.
 */
import { chooseEventOption, chooseRoute, type ManagerPolicy } from './policy';
import { stepBattle } from './combat';
import { chooseEvent, enterNode, finishBattle, pickRoute } from './expedition';
import type { SimContext } from './context';
import type { SimEventSink, SimState } from './types';

/** Ticks the player has to decide before the steward takes over. */
export const DECISION_TIMEOUT_TICKS = 30;
/** Ticks the player has to pick the path of the run. */
export const ROUTE_DECISION_TIMEOUT_TICKS = 150;
/** Ticks the player has to read an event and to choose. */
export const EVENT_DECISION_TIMEOUT_TICKS = 300;
/** Ticks between two rooms of the path - the pause of the walking hero. */
export const ROUTE_STEP_TICKS = 10;
/** A fight that lasts longer than this is a stalemate and ends the run. */
export const MAX_BATTLE_TICKS = 2400;

export interface StepOptions {
  sink?: SimEventSink;
  policy: ManagerPolicy;
}

export function step(state: SimState, ctx: SimContext, ticks: number, options: StepOptions): SimState {
  const { sink, policy } = options;
  for (let i = 0; i < ticks; i++) {
    if (state.phase === 'dead' || state.phase === 'victory') break;
    state.tick += 1;
    state.nodeTimer += 1;

    switch (state.phase) {
      case 'battle': {
        stepBattle(state, ctx, sink);
        const alive = state.enemies.some((e) => e.side === 'enemy' && e.alive);
        if (!state.hero.alive) {
          state.phase = 'dead';
          state.deathCause = state.deathCause ?? 'Slain in battle';
        } else if (!alive) {
          finishBattle(state, ctx, sink);
        } else if (state.nodeTimer > MAX_BATTLE_TICKS) {
          // A fight that never ends (the regenerating dead of the pit) must
          // not keep the run alive forever.
          state.phase = 'dead';
          state.deathCause = 'The fight never ends - the hero retreats';
        }
        break;
      }
      case 'expedition': {
        if (state.routeId === null) {
          // The path of the run is still open. The player picks it, the
          // steward takes over when the player does nothing.
          if (state.nodeTimer >= ROUTE_DECISION_TIMEOUT_TICKS) {
            const route = chooseRoute(state, policy);
            if (route) pickRoute(state, ctx, route.id, sink);
          }
        } else if (state.nextNodeIds.length > 0 && state.nodeTimer >= ROUTE_STEP_TICKS) {
          // The hero walks the chosen path on its own.
          const next = state.nextNodeIds[0]!;
          enterNode(state, ctx, next, sink);
        } else if (state.nextNodeIds.length === 0) {
          // A room without a way out must not keep the run alive forever.
          state.phase = 'dead';
          state.deathCause = state.deathCause ?? 'The pit closed behind the hero';
        }
        break;
      }
      case 'event': {
        if (state.nodeTimer >= EVENT_DECISION_TIMEOUT_TICKS) {
          const choice = chooseEventOption(state, policy);
          if (choice) chooseEvent(state, ctx, choice, sink);
        }
        break;
      }
      default:
        break;
    }
  }

  state.rng = ctx.streams.snapshot();
  return state;
}

/**
 * Run the simulation for a long time without a UI. Used by the offline
 * report and by the balance tool. The function yields to the caller every
 * `chunkTicks` so the browser stays responsive.
 */
export function stepChunked(
  state: SimState,
  ctx: SimContext,
  totalTicks: number,
  options: StepOptions & { chunkTicks?: number; onChunk?: (ticksDone: number) => Promise<void> | void },
): Promise<SimState> {
  const chunk = options.chunkTicks ?? 5000;
  let done = 0;
  return new Promise<SimState>((resolve) => {
    const run = (): void => {
      while (done < totalTicks) {
        const batch = Math.min(chunk, totalTicks - done);
        step(state, ctx, batch, options);
        done += batch;
        if (state.phase === 'dead' || state.phase === 'victory') {
          resolve(state);
          return;
        }
      }
      resolve(state);
    };
    run();
  });
}
