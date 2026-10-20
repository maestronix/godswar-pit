/** Fixed game-time constants. 1 tick = 100 ms of game time. */
export const TICK_MS = 100;
export const TICKS_PER_SECOND = 1000 / TICK_MS;
export const TICKS_PER_MINUTE = 60 * TICKS_PER_SECOND;

export function ticksToSeconds(ticks: number): number {
  return ticks / TICKS_PER_SECOND;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

export function minutesToTicks(minutes: number): number {
  return Math.round(minutes * TICKS_PER_MINUTE);
}

export function ticksToMs(ticks: number): number {
  return ticks * TICK_MS;
}

export function msToTicks(ms: number): number {
  return Math.floor(ms / TICK_MS);
}
