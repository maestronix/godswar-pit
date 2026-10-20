/**
 * Content type definitions.
 *
 * Every piece of game content lives in `src/data/**` as JSON and is typed
 * here. The schema validation test (`tests/content-schema.test.ts`) makes sure
 * a typo in a JSON file can never reach the running game.
 */

/* ------------------------------------------------------------------ stats */

/** The rooms of the pit tree. */
export type NodeType = 'FIGHT' | 'ELITE' | 'TREASURE' | 'HEALING' | 'EVENT' | 'TRAP' | 'BOSS';

/** Every stat that can be modified by affixes, skills, nodes or meta trees. */
export type StatKey =
  | 'damagePct'
  | 'flatDamage'
  | 'critChance'
  | 'critDamage'
  | 'maxHpPct'
  | 'flatHp'
  | 'armorPct'
  | 'flatArmor'
  | 'attackSpeed'
  | 'cooldownReduction'
  | 'aoePct'
  | 'dotPct'
  | 'soulYieldPct'
  | 'moveSpeed'
  | 'resourceRegen'
  | 'executeThreshold'
  | 'statusResist'
  | 'flatSouls'
  | 'hpRegen'
  | 'lifeOnHit'
  | 'dodge';

export const STAT_KEYS: StatKey[] = [
  'damagePct',
  'flatDamage',
  'critChance',
  'critDamage',
  'maxHpPct',
  'flatHp',
  'armorPct',
  'flatArmor',
  'attackSpeed',
  'cooldownReduction',
  'aoePct',
  'dotPct',
  'soulYieldPct',
  'moveSpeed',
  'resourceRegen',
  'executeThreshold',
  'statusResist',
  'flatSouls',
  'hpRegen',
  'lifeOnHit',
  'dodge',
];

/** Stats that are stored as "0.15 means 15%". */
export const PERCENT_STATS: StatKey[] = [
  'damagePct',
  'critChance',
  'critDamage',
  'maxHpPct',
  'armorPct',
  'aoePct',
  'dotPct',
  'soulYieldPct',
  'dodge',
];

/* ----------------------------------------------------------------- skills */

export type SkillKind = 'signature' | 'active' | 'passive';
export type TargetMode = 'single' | 'aoe' | 'self' | 'all' | 'ground';
export type DamageType = 'physical' | 'fire' | 'frost' | 'lightning' | 'shadow' | 'poison' | 'holy' | 'physical-dot';

export type EffectKind =
  | 'damage'
  | 'dot'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'shield'
  | 'summon'
  | 'resource'
  | 'chain'
  | 'execute';

export interface EffectDef {
  kind: EffectKind;
  /** Multiplier of the caster's attack power (0 = no direct damage). */
  power?: number;
  /** Status id to apply (`burn`, `poison`, `slow`, ...). */
  status?: string;
  /** How long the effect lasts, in ticks. */
  duration?: number;
  /** Stacks applied. */
  stacks?: number;
  /** Stat id for buffs/debuffs. */
  stat?: StatKey;
  /** Additive value for buffs/debuffs. */
  amount?: number;
  /** Multiplicative value for buffs/debuffs. */
  mult?: number;
  /** Radius in tiles for AoE effects. */
  radius?: number;
  /** Number of extra targets for chain effects. */
  count?: number;
  /** Damage type. */
  damageType?: DamageType;
  /** Text shown in the tooltip. */
  text?: string;
}

export interface RuneDef {
  id: string;
  name: string;
  description: string;
  /** Effect overrides applied when the rune is bound. */
  overrides?: {
    power?: number;
    cooldown?: number;
    cost?: number;
    targeting?: TargetMode;
    aoeRadius?: number;
    damageType?: DamageType;
  };
  /** Effect overrides merged into the primary effect. */
  effectOverrides?: Partial<EffectDef>;
}

export interface SkillDef {
  id: string;
  name: string;
  classId: string;
  kind: SkillKind;
  description: string;
  /** Resource cost per cast. */
  cost: number;
  /** Cooldown in ticks. */
  cooldown: number;
  /** Ticks the cast animation blocks the hero (0 = instant). */
  castTime: number;
  /** Attack range in tiles. */
  range: number;
  targeting: TargetMode;
  /** Radius in tiles for AoE. */
  aoeRadius?: number;
  /** Base damage multiplier. */
  power: number;
  /** Extra damage multipliers, e.g. `{ stat: 'aoePct', mult: 1 }`. */
  scaling?: { stat: StatKey; mult: number }[];
  effects: EffectDef[];
  tags: string[];
  icon: string;
  runes: RuneDef[];
  /** Where the skill becomes available. */
  unlock?: { source: 'inheritance' | 'classTree'; id: string };
}

/* ---------------------------------------------------------------- classes */

export interface ClassDef {
  id: string;
  name: string;
  /** Short flavor line shown in the class select. */
  tagline: string;
  /** Resource name, e.g. "Wrath". */
  resource: string;
  /** Max resource. */
  resourceMax: number;
  /** Resource gained per basic attack. */
  resourcePerHit: number;
  /** Resource regenerated per second. */
  resourceRegen: number;
  /** Base attributes. */
  base: {
    hp: number;
    armor: number;
    damage: number;
    attackSpeed: number;
    critChance: number;
    critDamage: number;
  };
  /** Weapon base ids usable by this class. */
  weaponBases: string[];
  /** Aspect ids bound to this class. */
  aspects: string[];
  /** Skill tree ids. */
  trees: string[];
  signature: string;
  actives: string[];
  passives: string[];
  /** Sprite palette override. */
  palette: Record<string, string>;
}

/* ------------------------------------------------------------------ items */

export type ItemSlot = 'weapon' | 'armor' | 'boots' | 'gloves' | 'amulet' | 'ring';
export const ITEM_SLOTS: ItemSlot[] = ['weapon', 'armor', 'boots', 'gloves', 'amulet', 'ring'];

export type Rarity = 'common' | 'magic' | 'rare' | 'legendary' | 'mythic';
export const RARITIES: Rarity[] = ['common', 'magic', 'rare', 'legendary', 'mythic'];

export const RARITY_AFFIX_COUNT: Record<Rarity, number> = {
  common: 0,
  magic: 1,
  rare: 2,
  legendary: 3,
  mythic: 4,
};

export interface ItemBaseDef {
  id: string;
  name: string;
  slot: ItemSlot;
  /** Class ids allowed to use it. Empty = any class. */
  classes: string[];
  /** Stat modifiers that are always present. */
  implicit: { stat: StatKey; value: number }[];
  /** Base armour/damage multiplier. */
  baseDamage?: number;
  baseArmor?: number;
  /** Sprite id. */
  icon: string;
  /** Flavor text. */
  flavor?: string;
}

export interface AffixDef {
  id: string;
  stat: StatKey;
  /** Value range at tier 1. Higher tiers scale the range. */
  min: number;
  max: number;
  /** Tier per item level step. */
  tier: number;
  /** Weight for the random affix pool. */
  weight: number;
  prefix: string[];
  suffix: string[];
  /** Rarities this affix can appear in. */
  rarities: Rarity[];
  tags?: string[];
}

export interface AspectDef {
  id: string;
  name: string;
  classId: string;
  description: string;
  params: Record<string, number>;
  icon: string;
}

/* ----------------------------------------------------------------- enemies */

export type EnemyTrait =
  | 'fast'
  | 'armored'
  | 'undead'
  | 'beast'
  | 'caster'
  | 'summoner'
  | 'boss'
  | 'elite'
  | 'regenerating'
  | 'explosive'
  | 'shielded'
  | 'flying';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** Damage per second. */
  dps: number;
  /** Tiles per second. */
  speed: number;
  /** Attack range in tiles. */
  range: number;
  tier: number;
  sprite: string;
  traits: EnemyTrait[];
  /** Statuses the enemy applies on hit. */
  onHit?: { status: string; chance: number; duration: number; stacks?: number }[];
  /** Bonus souls on kill. */
  souls: number;
  /** Loot weight multiplier. */
  lootBonus?: number;
  size?: number;
}

/* ------------------------------------------------------------------- zones */

export interface ZoneDef {
  id: number;
  name: string;
  subtitle: string;
  /** Tree template id. */
  treeId: string;
  /** Enemy ids that can appear here. */
  enemies: string[];
  /** Enemy id of the zone boss. */
  boss: string;
  /** Palette key for tiles and sprites. */
  palette: string;
  /** Ambient color. */
  color: string;
  /** Base difficulty multiplier. */
  threat: number;
  /** Minimum run level to enter. */
  minLevel: number;
  /** Souls multiplier. */
  soulMultiplier: number;
  description: string;
}

/* ------------------------------------------------------------- tree nodes */

export type ArchetypeId =
  | 'VALUE'
  | 'CONDITIONAL'
  | 'COOLDOWN'
  | 'RESOURCE'
  | 'TRANSFORM'
  | 'PIERCE'
  | 'DURATION'
  | 'RUNE_UNLOCK'
  | 'ACCESS'
  | 'MULTIPLIER'
  | 'PASSIVE'
  | 'NODE_GATE';

/** A node parameter value. */
export type NodeParam = string | number | boolean | { kind: string; value?: number; fraction?: number };

export interface TreeNodeDef {
  id: string;
  treeId: string;
  parent: string | null;
  depth: number;
  name: string;
  description: string;
  archetype: ArchetypeId;
  /** Cost in souls (rank 1 cost). */
  cost: number;
  /** Cost growth per additional rank. */
  costGrowth: number;
  /** Max ranks. */
  maxRank: number;
  /** Archetype parameters. */
  params: Record<string, NodeParam>;
  /** Icon id. */
  icon: string;
  /** Requires another node to be owned. */
  requires?: string;
}

export interface TreeDef {
  id: string;
  classId: string;
  name: string;
  description: string;
  /** Column positions are assigned by the generator. */
  nodes: TreeNodeDef[];
}

/* ------------------------------------------------------------ achievements */

export type AchievementCategory =
  | 'COMBAT'
  | 'DEPTH'
  | 'LOOT'
  | 'META'
  | 'IDLE'
  | 'COLLECTION'
  | 'SECRET'
  | 'DISCOVERY';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  /** Threshold based metric. */
  metric: string;
  threshold: number;
  /** Reward kind. */
  reward: { kind: 'inheritance' | 'souls' | 'echo' | 'title' | 'pet'; amount: number; id?: string };
  /** Hidden achievements are not listed until unlocked. */
  hidden?: boolean;
  icon: string;
}

/* --------------------------------------------------------------- contracts */

export type ContractMetric =
  | 'kill_count'
  | 'reach_depth'
  | 'find_rarity'
  | 'earn_souls'
  | 'survive_runs'
  | 'ascend';

export interface ContractDef {
  id: string;
  metric: ContractMetric;
  description: string;
  /** Metric parameters (zone, enemy type, rarity, ...). */
  params: Record<string, number | string>;
  /** Reward. */
  reward: { souls: number; inheritance: number; potion?: string; echo?: number };
  /** Rolling contracts only. */
  rolling?: boolean;
}

/* ----------------------------------------------------------------- thrones */

export interface ThroneDef {
  rank: number;
  name: string;
  description: string;
  /** Feature key unlocked by this rank. */
  feature: string;
  /** Permanent multiplier granted. */
  bonus: { stat: StatKey; value: number };
  /** Inheritance granted. */
  inheritance: number;
  /** Zone cleared to claim it. */
  zone: number;
}

/* ---------------------------------------------------------------- potions */

export interface PotionDef {
  id: string;
  name: string;
  description: string;
  /** Effect applied for the whole run. */
  effect: { stat: StatKey; value: number };
  /** Tier multipliers. */
  tiers: { id: string; name: string; mult: number; price: number }[];
  /** Restriction, e.g. only for a specific class. */
  classId?: string;
}

/* -------------------------------------------------------------- anomalies */

export interface AnomalyDef {
  id: string;
  name: string;
  description: string;
  /** Modifier kind. */
  kind: 'extra_elite' | 'heal_enemies' | 'trap_every' | 'enemy_damage' | 'enemy_hp' | 'soul_tax' | 'double_elite' | 'fog' | 'cursed';
  /** Magnitude. */
  magnitude: number;
  /** Inkarnation this series belongs to. */
  series: number;
}

/* ----------------------------------------------------------------- events */

export type EventEffect =
  | { kind: 'souls'; amount: number }
  | { kind: 'hp'; fraction: number }
  | { kind: 'maxHp'; fraction: number }
  | { kind: 'damage'; fraction: number }
  | { kind: 'buff'; stat: StatKey; value: number; duration: number }
  | { kind: 'loot'; count: number; levelBonus: number }
  | { kind: 'fight'; tier: number }
  | { kind: 'resource'; fraction: number }
  | { kind: 'echo'; amount: number };

export interface EventChoiceDef {
  id: string;
  label: string;
  description: string;
  /** Effect summary shown to the player. */
  outcome: string;
  /** Risk level 0..3. */
  risk: number;
  effects: EventEffect[];
}

export interface EventDef {
  id: string;
  name: string;
  description: string;
  choices: EventChoiceDef[];
}

/* ------------------------------------------------------------------ misc */

export interface CodexEntryDef {
  id: string;
  kind: 'aspect' | 'enemy' | 'item' | 'lore' | 'enemyClass';
  name: string;
  text: string;
  unlockedBy?: string;
}
