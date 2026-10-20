/**
 * Persistence layer.
 *
 * The store owns exactly one save slot in `localStorage`. It autosaves on a
 * timer, on tab visibility change and before unload, and it can export /
 * import a save as Base64 text.
 */
import { decodeBase64, encodeBase64, checksum } from '../core/base64';
import { migrateSave } from './migrations';
import {
  SAVE_KEY,
  SAVE_VERSION,
  createDefaultSave,
  type SaveFile,
} from './schema';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage used in tests and when localStorage is unavailable. */
export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function resolveStorage(): StorageLike {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      // Touch it - Safari private mode throws on write.
      const probe = `${SAVE_KEY}.probe`;
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    /* fall through */
  }
  return new MemoryStorage();
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateSave(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Save is not an object'] };
  }
  const save = raw as Partial<SaveFile>;
  if (typeof save.version !== 'number') errors.push('Missing version');
  if (typeof save.savedAt !== 'number') errors.push('Missing savedAt');
  if (!save.player || typeof save.player !== 'object') errors.push('Missing player');
  else {
    if (typeof save.player.souls !== 'number') errors.push('player.souls must be a number');
    if (typeof save.player.classId !== 'string') errors.push('player.classId must be a string');
    if (save.player.equipped && typeof save.player.equipped !== 'object') errors.push('player.equipped must be an object');
    if (!Array.isArray(save.player.vault)) errors.push('player.vault must be an array');
  }
  if (!save.unlocked || typeof save.unlocked !== 'object') errors.push('Missing unlocked');
  else if (!save.unlocked.persistent || typeof save.unlocked.persistent !== 'object') {
    errors.push('Missing unlocked.persistent');
  } else if (!save.unlocked.currentInkarnation || typeof save.unlocked.currentInkarnation !== 'object') {
    errors.push('Missing unlocked.currentInkarnation');
  }
  if (!save.settings || typeof save.settings !== 'object') errors.push('Missing settings');
  if (!save.stats || typeof save.stats !== 'object') errors.push('Missing stats');
  if (!save.meta || typeof save.meta !== 'object') errors.push('Missing meta');
  if (!save.contracts || typeof save.contracts !== 'object') errors.push('Missing contracts');
  if (!save.tree || typeof save.tree !== 'object') errors.push('Missing tree');
  return { ok: errors.length === 0, errors };
}

export class SaveStore {
  private save: SaveFile;
  private readonly storage: StorageLike;
  private autosaveTimer: number | null = null;
  private dirty = false;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? resolveStorage();
    this.save = this.load();
  }

  /** Read the save from storage, migrate and validate it. */
  load(): SaveFile {
    const raw = this.storage.getItem(SAVE_KEY);
    if (!raw) {
      this.save = createDefaultSave();
      return this.save;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      const result = migrateSave(parsed);
      this.save = result.save;
      return this.save;
    } catch {
      // A corrupted save must never brick the game: keep a backup and reset.
      try {
        this.storage.setItem(`${SAVE_KEY}.broken`, raw);
      } catch {
        /* ignore */
      }
      this.save = createDefaultSave();
      return this.save;
    }
  }

  get current(): SaveFile {
    return this.save;
  }

  /** Mutate the save and mark it dirty. Call `persist()` to write to storage. */
  update(mutator: (save: SaveFile) => void): SaveFile {
    mutator(this.save);
    this.save.savedAt = Date.now();
    this.dirty = true;
    return this.save;
  }

  /** Write the save to storage. */
  persist(): void {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
      this.dirty = false;
    } catch {
      // Quota exceeded or private mode: the run continues in memory.
    }
  }

  get hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  /** Replace the whole save (import, wipe). */
  replace(save: SaveFile): void {
    this.save = save;
    this.save.version = SAVE_VERSION;
    this.dirty = true;
    this.persist();
  }

  reset(): SaveFile {
    this.save = createDefaultSave();
    this.dirty = true;
    this.persist();
    return this.save;
  }

  /* --------------------------------------------------------- autosave */

  startAutosave(intervalMs = 10_000): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(() => this.persist(), intervalMs) as unknown as number;
  }

  stopAutosave(): void {
    if (this.autosaveTimer !== null) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /* ----------------------------------------------------- export/import */

  /** Export as Base64 text (JSON inside). */
  export(): string {
    return encodeBase64(JSON.stringify(this.save));
  }

  /** Import from Base64 text. Validates and migrates before applying. */
  import(text: string): ValidationResult & { save?: SaveFile } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeBase64(text.trim()));
    } catch {
      return { ok: false, errors: ['Not a valid save code'] };
    }
    const validation = validateSave(parsed);
    if (!validation.ok) return validation;
    const migrated = migrateSave(parsed);
    this.replace(migrated.save);
    return { ok: true, errors: [], save: migrated.save };
  }

  /** Short fingerprint of the current save. */
  fingerprint(): string {
    return checksum(JSON.stringify(this.save));
  }
}
