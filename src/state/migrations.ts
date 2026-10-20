/**
 * Save migrations.
 *
 * A save file carries the version it was written with. Every upgrade step is
 * a pure function so it can be unit tested with a frozen v1 fixture.
 */
import {
  SAVE_VERSION,
  type SaveFile,
  createDefaultSave,
  createDefaultSettings,
  createDefaultStats,
  createDefaultMeta,
  createDefaultContracts,
  createDefaultTree,
  type ItemRecord,
} from './schema';
import type { ItemSlot } from '../data/types';

export interface MigrationResult {
  save: SaveFile;
  from: number;
  to: number;
  steps: string[];
}

type AnyRecord = Record<string, unknown>;

/**
 * v1 -> v2
 *  - `player.equipped` changed from an array to a slot map.
 *  - `unlocked` gained the `currentInkarnation` bucket.
 *  - `settings` gained `showOfflineEstimate`, `autoScrap`, `scrapThreshold`.
 */
function migrateV1toV2(raw: AnyRecord): AnyRecord {
  const next: AnyRecord = { ...raw };
  const player = { ...((raw.player as AnyRecord) ?? {}) };

  const equipped = player.equipped;
  if (Array.isArray(equipped)) {
    const map: Record<string, ItemRecord> = {};
    for (const item of equipped as ItemRecord[]) {
      if (item && typeof item.slot === 'string') map[item.slot] = { ...item, originRun: item.originRun ?? null };
    }
    player.equipped = map;
  } else if (equipped && typeof equipped === 'object') {
    const map: Record<string, ItemRecord> = {};
    for (const [slot, item] of Object.entries(equipped as Record<string, ItemRecord>)) {
      map[slot] = { ...item, originRun: item.originRun ?? null };
    }
    player.equipped = map;
  } else {
    player.equipped = {};
  }
  next.player = player;

  const unlocked = { ...((raw.unlocked as AnyRecord) ?? {}) };
  const persistent = { ...((unlocked.persistent as AnyRecord) ?? {}) };
  persistent.boundAspects = persistent.boundAspects ?? {};
  persistent.titles = persistent.titles ?? [];
  unlocked.persistent = persistent;
  unlocked.currentInkarnation = { activeSkills: [] };
  next.unlocked = unlocked;
  const settings = { ...createDefaultSettings(), ...((raw.settings as AnyRecord) ?? {}) };
  next.settings = settings;

  const stats = { ...createDefaultStats(), ...((raw.stats as AnyRecord) ?? {}) };
  next.stats = stats;

  next.meta = { ...createDefaultMeta(), ...((raw.meta as AnyRecord) ?? {}) };
  next.contracts = { ...createDefaultContracts(), ...((raw.contracts as AnyRecord) ?? {}) };
  next.tree = { ...createDefaultTree(), ...((raw.tree as AnyRecord) ?? {}) };

  next.version = 2;
  return next;
}

const MIGRATIONS: Record<number, (raw: AnyRecord) => AnyRecord> = {
  1: migrateV1toV2,
};

export function migrateSave(raw: unknown): MigrationResult {
  const steps: string[] = [];
  let data = (raw && typeof raw === 'object' ? raw : {}) as AnyRecord;
  let version = typeof data.version === 'number' ? data.version : 0;

  if (version === 0) {
    // A save without a version is treated as the oldest known format.
    version = 1;
    data = { ...data, version: 1 };
    steps.push('inferred v1');
  }

  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) {
      // Unknown intermediate version: fall back to defaults for the rest.
      steps.push(`no migration for v${version}, using defaults`);
      const fallback = createDefaultSave();
      data = { ...fallback, version: SAVE_VERSION, player: { ...fallback.player, ...(data.player as AnyRecord) } };
      version = SAVE_VERSION;
      break;
    }
    data = migrate(data);
    steps.push(`v${version} -> v${version + 1}`);
    version++;
  }

  const base = createDefaultSave();
  const unlockedData = (data.unlocked as AnyRecord | undefined) ?? {};
  const merged: SaveFile = {
    ...base,
    ...(data as Partial<SaveFile>),
    version: SAVE_VERSION,
    player: { ...base.player, ...(data.player as AnyRecord) },
    settings: { ...base.settings, ...(data.settings as AnyRecord) },
    stats: { ...base.stats, ...(data.stats as AnyRecord) },
    achievements: { ...base.achievements, ...(data.achievements as AnyRecord) },
    unlocked: {
      persistent: { ...base.unlocked.persistent, ...((unlockedData.persistent as AnyRecord) ?? {}) },
      currentInkarnation: {
        ...base.unlocked.currentInkarnation,
        ...((unlockedData.currentInkarnation as AnyRecord) ?? {}),
      },
    },
    meta: { ...base.meta, ...(data.meta as AnyRecord) },
    contracts: { ...base.contracts, ...(data.contracts as AnyRecord) },
    tree: { ...base.tree, ...(data.tree as AnyRecord) },
  };

  return { save: merged, from: version, to: SAVE_VERSION, steps };
}

export function isValidSlot(value: unknown): value is ItemSlot {
  return value === 'weapon' || value === 'armor' || value === 'boots' || value === 'gloves' || value === 'amulet' || value === 'ring';
}
