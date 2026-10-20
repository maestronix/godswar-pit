/**
 * Versioned save schema.
 *
 * Rules that must never be broken:
 *  - Only *state* is stored. Everything that can be derived from content
 *    (stats, prices, drop tables) is computed at runtime, so balancing changes
 *    never invalidate an existing save.
 *  - Every save carries a `version`. Migrations upgrade older saves.
 *  - The split between "survives death", "run scope" and "incarnation scope"
 *    is encoded in the shape of the data, not in ad-hoc bookkeeping.
 */
import type { ItemSlot, Rarity, StatKey } from '../data/types';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'godswarpit.save.v1';

/* -------------------------------------------------------------- item data */

export interface AffixRoll {
  affixId: string;
  tier: number;
  value: number;
}

export interface ItemRecord {
  id: string;
  baseId: string;
  slot: ItemSlot;
  rarity: Rarity;
  itemLevel: number;
  name: string;
  affixes: AffixRoll[];
  aspectId: string | null;
  /** Run that produced this item. Items from the current run are lost on death. */
  originRun: string | null;
  /** 0..1 quality score, used by the auto-scrap rule. */
  quality: number;
}

/* ----------------------------------------------------------------- player */

export interface LoadoutState {
  /** Potion slot 0..2, `null` = empty. */
  potions: (string | null)[];
  /** Skill ids in auto-cast priority order. */
  skillPriority: string[];
  /** skillId -> runeId. */
  runes: Record<string, string>;
  /** Zone the next expedition starts in. */
  targetZone: number;
}

export interface PlayerState {
  name: string;
  classId: string;
  level: number;
  xp: number;
  souls: number;
  echo: number;
  inheritance: number;
  /** Highest throne rank claimed. */
  throneRank: number;
  /** Number of completed incarnations. */
  incarnations: number;
  /** Highest zone reached. */
  highestZone: number;
  /** Story chapter progress (0..10). */
  storyChapter: number;
  /** Six equipment slots. These survive death, they do not survive incarnation. */
  equipped: Partial<Record<ItemSlot, ItemRecord>>;
  /** Persistent stash. Unbounded. */
  vault: ItemRecord[];
  loadout: LoadoutState;
  /** Automatically start a new run after death. */
  autoRetry: boolean;
  /** Unspent run skill points (lost on death). */
  runSkillPoints: number;
  /** Runes bound to a skill, resolved from the tree. */
  unlockedRunes: string[];
}

/* --------------------------------------------------------------- settings */

export interface SettingsState {
  masterVolume: number;
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  showDamageNumbers: boolean;
  fontScale: number;
  /** Items below this quality are scrapped when sorted into the vault. */
  scrapThreshold: number;
  autoScrap: boolean;
  /** Ask before overwriting a save on import. */
  confirmOverwrite: boolean;
  /** Show the estimated part of offline reports. */
  showOfflineEstimate: boolean;
}

/* ------------------------------------------------------------------ stats */

export interface StatsState {
  runsStarted: number;
  runsFinished: number;
  deaths: number;
  victories: number;
  kills: number;
  bossKills: number;
  totalSoulsEarned: number;
  totalEchoEarned: number;
  totalInheritanceEarned: number;
  deepestRun: number;
  bestSoulsRun: number;
  longestRunSeconds: number;
  fastestThroneSeconds: number;
  totalPlaySeconds: number;
  totalOfflineSeconds: number;
  nodesVisited: number;
  itemsFound: number;
  itemsVaulted: number;
  itemsScrapped: number;
  potionsUsed: number;
  recrafts: number;
  respecs: number;
  aspectRerolls: number;
  bestRuns: BestRunEntry[];
}

export interface BestRunEntry {
  runId: string;
  classId: string;
  zone: number;
  depth: number;
  throneRank: number;
  seconds: number;
  souls: number;
  kills: number;
  build: string;
  when: number;
}

/* ----------------------------------------------------------- achievements */

export interface AchievementsState {
  unlocked: string[];
  /** Latest observed value per achievement metric. */
  progress: Record<string, number>;
  /** Cosmetic titles owned. */
  titles: string[];
  /** Shadowpet companions owned. */
  pets: string[];
}

/* --------------------------------------------------------------- unlocks */

/**
 * Two clearly separated buckets:
 *  - `persistent` survives death *and* incarnation.
 *  - `currentInkarnation` is wiped on incarnation but survives death.
 */
export interface UnlockedState {
  persistent: {
    classes: string[];
    /** Active skills that stay available forever. */
    activeSkills: string[];
    runes: string[];
    /** Codex entries (aspects, enemies, lore). */
    codex: string[];
    features: string[];
    startItems: string[];
    startBonuses: string[];
    titles: string[];
    /** Aspects bound to a specific item id. */
    boundAspects: Record<string, string>;
  };
  currentInkarnation: {
    /** Active skills unlocked during this incarnation. */
    activeSkills: string[];
  };
}

/* ------------------------------------------------------------------- meta */

export interface MetaState {
  /** Grace Mirror node ranks (Echo). */
  graceMirror: Record<string, number>;
  /** Inheritance Tree node ranks (Inheritance). */
  inheritanceTree: Record<string, number>;
  /** Echo invested in the mirror. */
  echoSpent: number;
  /** Inheritance invested in the tree. */
  inheritanceSpent: number;
  /** Inheritance sacrificed during the last incarnation to keep more echo. */
  inheritanceSacrificed: number;
  /** Unlocked Remembrance (run skill points -> permanent ranks). */
  remembranceUnlocked: boolean;
}

/* -------------------------------------------------------------- contracts */

export interface ActiveContract {
  id: string;
  /** Contract definition id. */
  defId: string;
  progress: number;
  claimed: boolean;
  /** When the contract was rolled. */
  startedAt: number;
  /** Only for story contracts. */
  story?: boolean;
}

export interface ContractsState {
  rotating: ActiveContract[];
  story: ActiveContract | null;
  /** Timestamp of the last rolling refresh. */
  lastRefresh: number;
  /** Login bonus streak. */
  loginStreak: number;
  lastLoginDay: string;
  /** Days the streak was already collected. */
  loginClaimedToday: boolean;
}

/* ------------------------------------------------------------------- tree */

/**
 * Class skill tree state.
 * Ranks are permanent (they survive death). Some nodes only grant their
 * active skill for the current incarnation - see `unlocked.currentInkarnation`.
 */
export interface TreeState {
  /** nodeId -> owned rank. */
  ranks: Record<string, number>;
  /** nodeId -> number of ranks bought with run skill points. */
  runRanks: Record<string, number>;
}

/* ------------------------------------------------------------------- save */

export interface SaveFile {
  version: number;
  savedAt: number;
  player: PlayerState;
  settings: SettingsState;
  stats: StatsState;
  achievements: AchievementsState;
  unlocked: UnlockedState;
  meta: MetaState;
  contracts: ContractsState;
  tree: TreeState;
  /** The run in progress, if any. */
  run: unknown | null;
  /** Incrementing counter for deterministic id generation. */
  idCounter: number;
}

/* --------------------------------------------------------------- defaults */

export function createDefaultPlayer(): PlayerState {
  return {
    name: 'Nameless',
    classId: 'bladewalker',
    level: 1,
    xp: 0,
    souls: 0,
    echo: 0,
    inheritance: 0,
    throneRank: 0,
    incarnations: 0,
    highestZone: 1,
    storyChapter: 0,
    equipped: {},
    vault: [],
    loadout: {
      potions: [null, null, null],
      skillPriority: [],
      runes: {},
      targetZone: 1,
    },
    autoRetry: true,
    runSkillPoints: 0,
    unlockedRunes: [],
  };
}

export function createDefaultSettings(): SettingsState {
  return {
    masterVolume: 0.7,
    muted: false,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    reducedMotion: false,
    showDamageNumbers: true,
    fontScale: 1,
    scrapThreshold: 0.35,
    autoScrap: true,
    confirmOverwrite: true,
    showOfflineEstimate: true,
  };
}

export function createDefaultStats(): StatsState {
  return {
    runsStarted: 0,
    runsFinished: 0,
    deaths: 0,
    victories: 0,
    kills: 0,
    bossKills: 0,
    totalSoulsEarned: 0,
    totalEchoEarned: 0,
    totalInheritanceEarned: 0,
    deepestRun: 0,
    bestSoulsRun: 0,
    longestRunSeconds: 0,
    fastestThroneSeconds: 0,
    totalPlaySeconds: 0,
    totalOfflineSeconds: 0,
    nodesVisited: 0,
    itemsFound: 0,
    itemsVaulted: 0,
    itemsScrapped: 0,
    potionsUsed: 0,
    recrafts: 0,
    respecs: 0,
    aspectRerolls: 0,
    bestRuns: [],
  };
}

export function createDefaultUnlocked(): UnlockedState {
  return {
    persistent: {
      classes: ['bladewalker'],
      activeSkills: [],
      runes: [],
      codex: [],
      features: [],
      startItems: [],
      startBonuses: [],
      titles: [],
      boundAspects: {},
    },
    currentInkarnation: {
      activeSkills: [],
    },
  };
}

export function createDefaultMeta(): MetaState {
  return {
    graceMirror: {},
    inheritanceTree: {},
    echoSpent: 0,
    inheritanceSpent: 0,
    inheritanceSacrificed: 0,
    remembranceUnlocked: false,
  };
}

export function createDefaultContracts(): ContractsState {
  return {
    rotating: [],
    story: null,
    lastRefresh: 0,
    loginStreak: 0,
    lastLoginDay: '',
    loginClaimedToday: false,
  };
}

export function createDefaultTree(): TreeState {
  return { ranks: {}, runRanks: {} };
}

export function createDefaultSave(): SaveFile {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    player: createDefaultPlayer(),
    settings: createDefaultSettings(),
    stats: createDefaultStats(),
    achievements: { unlocked: [], progress: {}, titles: [], pets: [] },
    unlocked: createDefaultUnlocked(),
    meta: createDefaultMeta(),
    contracts: createDefaultContracts(),
    tree: createDefaultTree(),
    run: null,
    idCounter: 1,
  };
}

/* -------------------------------------------------------------- stat keys */

/** Stats that can be raised by affixes - used by the item generator. */
export const AFFIXABLE_STATS: StatKey[] = [
  'damagePct',
  'critChance',
  'critDamage',
  'maxHpPct',
  'armorPct',
  'attackSpeed',
  'cooldownReduction',
  'aoePct',
  'dotPct',
  'soulYieldPct',
  'moveSpeed',
  'resourceRegen',
  'executeThreshold',
  'statusResist',
  'hpRegen',
  'lifeOnHit',
  'dodge',
];
