/** Status effect handling (DoTs, buffs, debuffs, shields). */
import type { StatusEffect, StatusKind } from './types';
import type { SimEventSink } from './types';

export interface StatusTemplate {
  id: string;
  kind: StatusKind;
  /** Damage per tick for DoTs. */
  power?: number;
  /** Buff/debuff stat value. */
  stat?: string;
  mult?: number;
  defaultDuration?: number;
  maxStacks?: number;
}

export const STATUS_TEMPLATES: Record<string, StatusTemplate> = {
  burn: { id: 'burn', kind: 'dot', power: 1, defaultDuration: 30, maxStacks: 5 },
  poison: { id: 'poison', kind: 'dot', power: 1, defaultDuration: 40, maxStacks: 8 },
  decay: { id: 'decay', kind: 'dot', power: 1, defaultDuration: 50, maxStacks: 3 },
  bleed: { id: 'bleed', kind: 'dot', power: 1, defaultDuration: 24, maxStacks: 6 },
  chill: { id: 'chill', kind: 'debuff', stat: 'attackSpeed', mult: 0.7, defaultDuration: 30 },
  freeze: { id: 'freeze', kind: 'debuff', mult: 0, defaultDuration: 20, maxStacks: 1 },
  blind: { id: 'blind', kind: 'debuff', stat: 'critChance', mult: 0.5, defaultDuration: 25 },
  slow: { id: 'slow', kind: 'debuff', stat: 'moveSpeed', mult: 0.6, defaultDuration: 30 },
  rage: { id: 'rage', kind: 'buff', stat: 'damagePct', mult: 1.3, defaultDuration: 40 },
  shield: { id: 'shield', kind: 'shield', defaultDuration: 60, maxStacks: 1 },
  aura: { id: 'aura', kind: 'buff', stat: 'armorPct', mult: 1.2, defaultDuration: 100 },
  focus: { id: 'focus', kind: 'buff', stat: 'critChance', mult: 1.4, defaultDuration: 50 },
  haste: { id: 'haste', kind: 'buff', stat: 'attackSpeed', mult: 1.25, defaultDuration: 40 },
  regen: { id: 'regen', kind: 'buff', stat: 'hpRegen', mult: 2, defaultDuration: 60 },
  weaken: { id: 'weaken', kind: 'debuff', stat: 'damagePct', mult: 0.8, defaultDuration: 30 },
  curse: { id: 'curse', kind: 'debuff', stat: 'resourceRegen', mult: 0.5, defaultDuration: 60 },
};

export function getStatusTemplate(id: string): StatusTemplate {
  return STATUS_TEMPLATES[id] ?? { id, kind: 'debuff', defaultDuration: 30, maxStacks: 3 };
}

export function applyStatus(
  target: { statuses: StatusEffect[] },
  template: StatusTemplate,
  power: number,
  duration: number,
  stacks = 1,
  sourceId?: string,
): void {
  const existing = target.statuses.find((s) => s.id === template.id);
  const maxStacks = template.maxStacks ?? 3;
  if (existing) {
    existing.stacks = Math.min(maxStacks, existing.stacks + stacks);
    existing.remaining = Math.max(existing.remaining, duration);
    existing.power = Math.max(existing.power, power);
    if (sourceId) existing.sourceId = sourceId;
    return;
  }
  target.statuses.push({
    id: template.id,
    kind: template.kind,
    stacks: Math.max(1, Math.min(maxStacks, stacks)),
    power,
    mult: template.mult ?? 1,
    stat: template.stat as StatusEffect['stat'],
    remaining: duration,
    sourceId,
  });
}

export function hasStatus(target: { statuses: StatusEffect[] }, id: string): boolean {
  return target.statuses.some((s) => s.id === id && s.remaining > 0);
}

export function getStatus(target: { statuses: StatusEffect[] }, id: string): StatusEffect | undefined {
  return target.statuses.find((s) => s.id === id && s.remaining > 0);
}

export function totalStacks(target: { statuses: StatusEffect[] }, id: string): number {
  return target.statuses.find((s) => s.id === id)?.stacks ?? 0;
}

/** Remove expired statuses. */
export function pruneStatuses(target: { statuses: StatusEffect[] }): void {
  for (let i = target.statuses.length - 1; i >= 0; i--) {
    if (target.statuses[i]!.remaining <= 0) target.statuses.splice(i, 1);
  }
}

/**
 * Tick all statuses of a combatant. DoTs deal damage, everything else just
 * counts down. Returns the total damage dealt by DoTs.
 */
export function tickStatuses(
  target: { hp: number; maxHp: number; statuses: StatusEffect[] },
  sink: SimEventSink | undefined,
  tick: number,
  damageScale = 1,
  resist = 0,
  targetId?: string,
): number {
  let damage = 0;
  for (const status of target.statuses) {
    if (status.kind === 'dot') {
      const amount = status.power * status.stacks * damageScale * (1 - resist);
      damage += amount;
      if (amount > 0) {
        sink?.({
          type: 'status',
          tick,
          amount: Math.round(amount),
          text: status.id,
          targetId,
        });
      }
    }
    status.remaining -= 1;
  }
  if (damage > 0) target.hp -= damage;
  pruneStatuses(target);
  return damage;
}

/** Multiplier contribution of all buff/debuff statuses on a stat. */
export function statusMultiplier(target: { statuses: StatusEffect[] }, stat: string): number {
  let mult = 1;
  for (const status of target.statuses) {
    if ((status.kind === 'buff' || status.kind === 'debuff') && status.stat === stat) {
      mult *= status.mult;
    }
  }
  return mult;
}

/** Additive contribution of all buff/debuff statuses on a stat. */
export function statusBonus(target: { statuses: StatusEffect[] }, stat: string): number {
  let value = 0;
  for (const status of target.statuses) {
    if ((status.kind === 'buff' || status.kind === 'debuff') && status.stat === stat && status.power) {
      value += status.power;
    }
  }
  return value;
}
