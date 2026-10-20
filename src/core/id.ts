/**
 * Deterministic id generation.
 *
 * Ids must be unique inside a save but also reproducible when a save is
 * re-simulated, so we use a plain counter that lives in the save state
 * instead of `Math.random()` or `Date.now()`.
 */
export class IdCounter {
  private value: number;

  constructor(start = 1) {
    this.value = start;
  }

  next(prefix = 'id'): string {
    const id = `${prefix}_${this.value.toString(36)}`;
    this.value++;
    return id;
  }

  get current(): number {
    return this.value;
  }

  set current(value: number) {
    this.value = value;
  }
}
