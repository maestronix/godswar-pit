/**
 * The tick engine.
 *
 * `step()` advances the simulation by a number of ticks. The live game calls
 * it with small batches from `requestAnimationFrame`, the offline simulation
 * calls it with big batches. Both produce exactly the same result.
 */
import { chooseEventOption, chooseNextNode, type ManagerPolicy } from './policy';
import { stepBattle, healHero } from './combat';
import { chooseEvent, enterNode, finishBattle } from './expedition';
import type { SimContext } from './context';
import type { SimEventSink, SimState } from './types';

/** Ticks the player has to decide before the steward takes over. */
export const DECISION_TIMEOUT_TICKS = 30;

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
        }
        break;
      }
      case 'expedition': {
        // Between the rooms the hero catches their breath.
        if (state.hero.hp < state.hero.maxHp && state.hero.stats.hpRegen > 0) {
          healHero(state, (state.hero.maxHp * state.hero.stats.hpRegen) / 10, sink);
        }
        if (state.nextNodeIds.length > 0 && state.nodeTimer >= DECISION_TIMEOUT_TICKS) {
          const choice = chooseNextNode(state, policy);
          if (choice) enterNode(state, ctx, choice, sink);
        }
        break;
      }
      case 'event': {
        if (state.nodeTimer >= DECISION_TIMEOUT_TICKS) {
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
