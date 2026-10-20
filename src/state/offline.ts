/**
 * Offline simulation.
 *
 * When the player comes back, the elapsed real time is turned into game
 * time. The first 200 000 ticks are simulated for real (in chunks, so the
 * browser stays responsive), everything beyond that is extrapolated with a
 * reduced efficiency and clearly marked as an estimate in the report.
 */
import { BALANCE } from '../data/balance';
import { msToTicks, ticksToSeconds } from '../core/time';
import { step } from '../sim/engine';
import { type ManagerPolicy } from '../sim/policy';
import type { SimContext } from '../sim/context';
import type { SimEventSink, SimState } from '../sim/types';

export interface OfflineReport {
  /** Real seconds that were away. */
  seconds: number;
  /** Ticks that correspond to the elapsed time. */
  totalTicks: number;
  /** Ticks that were really simulated. */
  simulatedTicks: number;
  /** Ticks that were extrapolated. */
  estimatedTicks: number;
  /** True when a part of the result is an estimate. */
  estimated: boolean;
  /** How long the simulation really took (ms). */
  wallClockMs: number;
  zoneId: number;
  nodesVisited: number;
  depth: number;
  kills: number;
  souls: number;
  echo: number;
  itemsFound: number;
  victory: boolean;
  deathCause: string | null;
  /** Souls per minute - the most important farming number. */
  soulsPerMinute: number;
}

export interface OfflineOptions {
  policy: ManagerPolicy;
  /** Called after every chunk so the UI can show a progress bar. */
  onProgress?: (doneTicks: number, totalTicks: number) => void;
  /** Sink for simulation events (usually not needed offline). */
  sink?: SimEventSink;
  /** Wall clock budget in ms. */
  budgetMs?: number;
}

export interface OfflineResult {
  report: OfflineReport;
  state: SimState;
}

/**
 * Run the offline simulation. Returns the new state and a report.
 */
export async function runOffline(
  state: SimState,
  ctx: SimContext,
  elapsedMs: number,
  options: OfflineOptions,
): Promise<OfflineResult> {
  const started = Date.now();
  const totalTicks = Math.max(0, msToTicks(elapsedMs));
  const realTicks = Math.min(totalTicks, BALANCE.offlineRealTicks);

  const before = snapshotCounters(state);

  let simulated = 0;
  const chunk = BALANCE.offlineChunkTicks;
  while (simulated < realTicks) {
    if (state.phase === 'dead' || state.phase === 'victory') break;
    const batch = Math.min(chunk, realTicks - simulated);
    step(state, ctx, batch, { policy: options.policy, sink: options.sink });
    simulated += batch;
    options.onProgress?.(simulated, realTicks);
    // Give the browser a chance to paint.
    await yieldToBrowser();
    const budget = options.budgetMs ?? BALANCE.offlineWallClockBudgetMs;
    if (Date.now() - started > budget) break;
  }

  const after = snapshotCounters(state);
  const wallClockMs = Date.now() - started;

  /* Extrapolation --------------------------------------------------- */
  const estimatedTicks = Math.max(0, totalTicks - realTicks);
  const soulsPerTick = simulated > 0 ? (after.souls - before.souls) / simulated : 0;
  const killsPerTick = simulated > 0 ? (after.kills - before.kills) / simulated : 0;
  const itemsPerTick = simulated > 0 ? (after.items - before.items) / simulated : 0;

  const efficiency = BALANCE.offlineExtrapolationEfficiency;
  const estimatedSouls = Math.round(soulsPerTick * estimatedTicks * efficiency);
  const estimatedKills = Math.round(killsPerTick * estimatedTicks * efficiency);
  const estimatedItems = estimatedTicks > 0 ? Math.round(itemsPerTick * estimatedTicks * efficiency) : 0;

  state.souls += estimatedSouls;
  state.kills += estimatedKills;

  const report: OfflineReport = {
    seconds: Math.round(elapsedMs / 1000),
    totalTicks,
    simulatedTicks: simulated,
    estimatedTicks,
    estimated: estimatedTicks > 0,
    wallClockMs,
    zoneId: state.zoneId,
    nodesVisited: state.visitedNodeIds.length,
    depth: state.depth,
    kills: after.kills - before.kills + estimatedKills,
    souls: after.souls - before.souls + estimatedSouls,
    echo: after.echo - before.echo,
    itemsFound: after.items - before.items + estimatedItems,
    victory: state.phase === 'victory',
    deathCause: state.deathCause,
    soulsPerMinute: elapsedMs > 0 ? Math.round(((after.souls - before.souls + estimatedSouls) / (elapsedMs / 60000)) * 10) / 10 : 0,
  };

  return { report, state };
}

function snapshotCounters(state: SimState) {
  return {
    souls: state.souls,
    kills: state.kills,
    echo: state.echo,
    items: state.loot.length,
  };
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Format the report for the UI. */
export function describeOffline(report: OfflineReport): string[] {
  const lines: string[] = [];
  lines.push(`Away for ${ticksToSeconds(report.seconds).toFixed(0)}s`);
  lines.push(`Visited ${report.nodesVisited} rooms, reached depth ${report.depth}`);
  lines.push(`Defeated ${report.kills} enemies`);
  lines.push(`Earned ${report.souls} souls`);
  if (report.estimated) {
    lines.push(`(${Math.round((report.estimatedTicks / Math.max(1, report.totalTicks)) * 100)}% of the time was estimated)`);
  }
  if (report.deathCause) lines.push(`Cause of death: ${report.deathCause}`);
  return lines;
}
