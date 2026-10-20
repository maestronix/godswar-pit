/**
 * Runtime context for the simulation.
 *
 * The context holds everything that must *not* be serialised: the live RNG
 * streams and the resolved loadout modifiers. Both are recreated from the
 * save whenever a run starts, and the RNG state is written back into the
 * save after every step so a run can be resumed exactly.
 */
import type { RngStreams } from '../core/rng';
import type { LoadoutModifiers } from './stats';

export interface SimContext {
  streams: RngStreams;
  mods: LoadoutModifiers;
}
