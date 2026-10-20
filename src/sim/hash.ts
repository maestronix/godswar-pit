/**
 * State hashing.
 *
 * Used by the determinism gate: running the same simulation live and in the
 * fast-forward must produce the same hash.
 */
import type { RngState } from '../core/rng';
import type { SimState, StatusEffect } from './types';

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function statusKey(status: StatusEffect): string {
  return [status.id, status.stacks, status.power, status.mult, status.remaining, status.sourceId ?? ''].join(':');
}

function rngKey(state: RngState): string {
  return [state.s0, state.s1, state.s2, state.s3].join(',');
}

/** A canonical, order stable representation of the simulation state. */
export function serializeState(state: SimState): string {
  const hero = state.hero;
  const parts: string[] = [
    `tick=${state.tick}`,
    `phase=${state.phase}`,
    `zone=${state.zoneId}`,
    `class=${state.classId}`,
    `seed=${state.seed}`,
    `depth=${state.depth}`,
    `kills=${state.kills}`,
    `souls=${state.souls}`,
    `echo=${state.echo}`,
    `boss=${state.bossDefeated ? 1 : 0}`,
    `dead=${state.deathCause ?? ''}`,
    `hero=${hero.hp.toFixed(4)}/${hero.maxHp.toFixed(4)}/${hero.resource.toFixed(4)}`,
    `heroPos=${hero.x.toFixed(4)},${hero.y.toFixed(4)},${hero.facing}`,
    `heroTimer=${hero.attackTimer}`,
    `level=${hero.level},${hero.xp},${hero.runSkillPoints}`,
    `cooldowns=${Object.keys(hero.cooldowns)
      .sort()
      .map((k) => `${k}=${hero.cooldowns[k]}`)
      .join(',')}`,
    `statuses=${hero.statuses.map(statusKey).sort().join(',')}`,
    `skills=${hero.skills.join(',')}`,
    `skillRanks=${Object.keys(hero.skillRanks)
      .sort()
      .map((k) => `${k}=${hero.skillRanks[k]}`)
      .join(',')}`,
    `enemies=${state.enemies
      .map((e) => `${e.id}:${e.hp.toFixed(4)}:${e.x.toFixed(4)},${e.y.toFixed(4)}:${e.alive ? 1 : 0}:${e.statuses.map(statusKey).sort().join('/')}`)
      .join('|')}`,
    `nodes=${state.visitedNodeIds.join(',')}`,
    `nodeState=${Object.keys(state.nodeState)
      .sort()
      .map((k) => `${k}=${state.nodeState[k]!.cleared ? 1 : 0}${state.nodeState[k]!.result ?? ''}`)
      .join(',')}`,
    `next=${state.nextNodeIds.join(',')}`,
    `loot=${state.loot.map((i) => `${i.id}:${i.rarity}:${i.itemLevel}`).join(',')}`,
    `counters=${state.counters.damageDealt.toFixed(3)},${state.counters.damageTaken.toFixed(3)},${state.counters.healingDone.toFixed(3)}`,
    `rng=${Object.keys(state.rng)
      .sort()
      .map((k) => `${k}=${rngKey(state.rng[k]!)}`)
      .join(',')}`,
  ];
  return parts.join('|');
}

export function hashState(state: SimState): string {
  return fnv1a(serializeState(state));
}
