import { describe, expect, it } from 'vitest';
import { MemoryStorage, SaveStore, validateSave } from '../src/state/store';
import { migrateSave } from '../src/state/migrations';
import { SAVE_KEY, SAVE_VERSION, createDefaultSave } from '../src/state/schema';

describe('save system', () => {
  it('round trips through localStorage', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    store.update((save) => {
      save.player.souls = 1234;
      save.player.throneRank = 3;
      save.unlocked.persistent.activeSkills.push('bw_a1');
    });
    store.persist();

    const reloaded = new SaveStore(storage);
    expect(reloaded.current.player.souls).toBe(1234);
    expect(reloaded.current.player.throneRank).toBe(3);
    expect(reloaded.current.unlocked.persistent.activeSkills).toContain('bw_a1');
  });

  it('keeps the incarnation scope separate from the permanent unlocks', () => {
    const save = createDefaultSave();
    save.unlocked.persistent.activeSkills.push('permanent_skill');
    save.unlocked.currentInkarnation.activeSkills.push('temporary_skill');
    const migrated = migrateSave(save);
    expect(migrated.save.unlocked.persistent.activeSkills).toContain('permanent_skill');
    expect(migrated.save.unlocked.currentInkarnation.activeSkills).toContain('temporary_skill');
    expect(migrated.save.unlocked.persistent.activeSkills).not.toContain('temporary_skill');
  });

  it('migrates a v1 save to v2', () => {
    const v1 = {
      version: 1,
      savedAt: 1000,
      player: {
        name: 'Old',
        classId: 'bladewalker',
        level: 3,
        xp: 10,
        souls: 55,
        echo: 2,
        inheritance: 1,
        throneRank: 1,
        incarnations: 0,
        highestZone: 2,
        storyChapter: 1,
        equipped: [
          {
            id: 'item_1',
            baseId: 'sword',
            slot: 'weapon',
            rarity: 'rare',
            itemLevel: 4,
            name: 'Old Sword',
            affixes: [],
            aspectId: null,
            originRun: null,
            quality: 0.5,
          },
        ],
        vault: [],
        loadout: { potions: [null, null, null], skillPriority: [], runes: {}, targetZone: 1 },
        autoRetry: true,
        runSkillPoints: 0,
        unlockedRunes: [],
      },
      settings: { masterVolume: 0.5, muted: false },
      stats: { kills: 12 },
      achievements: { unlocked: [], progress: {} },
      unlocked: { persistent: { classes: ['bladewalker'] } },
      meta: {},
      contracts: {},
      tree: {},
      run: null,
      idCounter: 1,
    };

    const result = migrateSave(v1);
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.steps).toContain('v1 -> v2');
    expect(result.save.player.souls).toBe(55);
    expect(result.save.player.equipped.weapon?.name).toBe('Old Sword');
    expect(result.save.unlocked.currentInkarnation.activeSkills).toEqual([]);
    expect(result.save.unlocked.persistent.classes).toContain('bladewalker');
    expect(result.save.settings.masterVolume).toBe(0.5);
    expect(result.save.settings.scrapThreshold).toBeGreaterThan(0);
  });

  it('rejects a broken save', () => {
    const result = validateSave({ version: 2 });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('exports and imports a save code', () => {
    const store = new SaveStore(new MemoryStorage());
    store.update((save) => {
      save.player.souls = 999;
    });
    const code = store.export();
    const other = new SaveStore(new MemoryStorage());
    const result = other.import(code);
    expect(result.ok).toBe(true);
    expect(other.current.player.souls).toBe(999);
  });

  it('refuses a garbage import', () => {
    const store = new SaveStore(new MemoryStorage());
    expect(store.import('not-a-save').ok).toBe(false);
  });

  it('falls back to a default save when the stored data is broken', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    const store = new SaveStore(storage);
    expect(store.current.version).toBe(SAVE_VERSION);
    expect(store.current.player.souls).toBe(0);
  });
});
