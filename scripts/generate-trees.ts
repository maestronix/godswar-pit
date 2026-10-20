/**
 * Skill tree generator.
 *
 * The six classes have 3 trees each with 30 nodes - 540 nodes in total.
 * None of them is hand written: they are composed from the 12 archetypes
 * plus parameters, which keeps the content budget under control and makes
 * the balance rules checkable (`npm run test` -> node budget test).
 *
 * Run with: npm run gen:trees
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArchetypeId, SkillDef, TreeDef, TreeNodeDef } from '../src/data/types';
import { ARCHETYPES } from '../src/data/nodes/archetypes';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'src', 'data', 'nodes', 'trees');
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ data */

interface TreeSpec {
  id: string;
  classId: string;
  name: string;
  description: string;
  /** Skills referenced by this tree. */
  skills: string[];
  /** Stat used by the generic value nodes. */
  primaryStat: string;
  secondaryStat: string;
  names: string[];
}

const SPECS: TreeSpec[] = [
  {
    id: 'bladewalker_might',
    classId: 'bladewalker',
    name: 'Might',
    description: 'Raw physical force. Every point of this tree is another body that will not stop you.',
    skills: ['bw_a4', 'bw_a2'],
    primaryStat: 'damagePct',
    secondaryStat: 'maxHpPct',
    names: [
      'Iron Will', 'Harsh Lesson', 'Bracing Stance', 'Wrist of Steel', 'Cleaving Habit',
      'Grounded Feet', 'Weight of Iron', 'Colossus Frame', 'Unyielding', 'Reckless Swing',
      'Shield Wall', 'Bonebreaker', 'Savage Momentum', 'Threshold', "Executioner's Toll",
      'Shatterpoint', 'Brute Force', 'Relentless', 'Hammer of Flesh', 'Vow of Ruin',
      'Adamant Heart', 'Mountains Split', 'Tempered Wrath', 'Brace for Impact', 'Final Swing',
      'Oath of Steel', 'Bulwark of Sinew', 'Siegebreaker', 'Reckoning', 'Avatar of Wrath',
    ],
  },
  {
    id: 'bladewalker_flame',
    classId: 'bladewalker',
    name: 'Flame',
    description: 'Set your steel alight and let the pit do the rest.',
    skills: ['bw_a1', 'bw_a3'],
    primaryStat: 'dotPct',
    secondaryStat: 'damagePct',
    names: [
      'First Spark', 'Ember', 'Kindling', 'Catch the Wind', 'Coal Heart',
      'Ashen Trail', 'Burning Edge', 'Pyre', 'Firebrand', 'Scorched Earth',
      'Kindle', 'Chain of Fire', 'Wildfire', 'Furnace', 'Red Hymn',
      'Searing Word', 'Flameborn', 'Smoulder', 'Pyroclasm', 'Ember Storm',
      'Sunscar', 'Living Coal', 'Ignite', 'Overheat', 'Blazing Oath',
      'Cinder Storm', 'Immolate', 'The Long Burn', 'Firestorm', 'Flame of the Pit',
    ],
  },
  {
    id: 'bladewalker_blood',
    classId: 'bladewalker',
    name: 'Blood',
    description: 'Pay in blood now, bleed the enemy later.',
    skills: ['bw_a4', 'bw_a1'],
    primaryStat: 'lifeOnHit',
    secondaryStat: 'dodge',
    names: [
      'Open Wound', 'Red Pact', 'Crimson Price', 'Thirst', 'Sanguine Edge',
      'Hemorrhage', 'Bloodletting', 'Red Second Wind', 'Iron Blood', 'Sanguine Rage',
      'Venom of the Self', 'Tainted Cut', 'Bleeding Deep', 'Siphon', 'Life Debt',
      'Mortify', 'Blood Echo', 'Crimson Hunger', 'Wound Echo', 'Scarlet Vow',
      'The Red Hour', 'Hemolock', 'Pact Renewal', 'Drain', 'Vital Ruin',
      'Sanguine Crown', 'Crimson Engine', 'Last Drop', 'Hemorrhage Ritual', 'Blood God',
    ],
  },
  {
    id: 'ashmonk_flow',
    classId: 'ashmonk',
    name: 'Flow',
    description: 'Water does not fight the rock. It becomes the rock.',
    skills: ['am_a1', 'am_a3'],
    primaryStat: 'attackSpeed',
    secondaryStat: 'cooldownReduction',
    names: [
      'First Breath', 'Empty Mind', 'Palm of Air', 'Ripple', 'Water Step',
      'Soft Landing', 'Breath of Grass', 'Formless', 'Sixfold Strike', 'Echoing Palm',
      'Still Water', 'Flowing Guard', 'Windwheel', 'Sutra of Motion', 'Gracious Step',
      'Tornado Palm', "Serpent's Coil", 'Momentum', 'Breath Control', 'Whirlwind Sutra',
      'Open Gate', 'Perfect Form', 'Sevenfold Echo', 'Rising Tide', 'Breath of the Void',
      'Unbroken', 'Ceaseless', 'Flowing Steel', 'The Long Breath', 'Endless Form',
    ],
  },
  {
    id: 'ashmonk_breath',
    classId: 'ashmonk',
    name: 'Breath',
    description: 'The breath is the weapon. Everything else is decoration.',
    skills: ['am_a4', 'am_a2'],
    primaryStat: 'hpRegen',
    secondaryStat: 'maxHpPct',
    names: [
      'First Inhale', 'Steady Lung', 'Iron Ribs', 'Deep Draw', 'Purifying Breath',
      'Short Breath', 'Ascent', 'Renewed Draw', 'Sustained', 'Calm Mind',
      'Fast Exhale', 'Burning Lung', 'Windpipe', 'Recovers', 'Counted Breath',
      'The Slow Exhale', 'Vitality', 'Ancestral Air', 'Chi of the Mountain', 'Pressed Breath',
      'Vital Spark', 'Lung of Stone', 'Braced Core', 'Neverending Draw', 'Perfect Breath',
      "Dragon's Breath", 'Hollow Lung', 'Breath of Life', 'The Final Breath', 'Second Wind',
    ],
  },
  {
    id: 'ashmonk_iron',
    classId: 'ashmonk',
    name: 'Iron',
    description: 'Stone does not tire. Neither do you.',
    skills: ['am_a2', 'am_a1'],
    primaryStat: 'armorPct',
    secondaryStat: 'maxHpPct',
    names: [
      'Stone Fist', 'Iron Palm', 'Mountain Stance', 'Tempered Nerves', 'Unbreakable',
      'Grounded Root', 'Hardened Bones', 'Tempered Flesh', 'Granite Will', 'Iron Blood',
      'Weight of Stone', 'Immovable', 'Bronze Skin', 'Shattering Palm', 'Earthshaker',
      'Steel Discipline', 'Endure', 'Iron Skin', 'Unyielding Mountain', 'Sutra of Stone',
      'Boundless', 'Stoneheart', 'Immortal Stance', 'Tempered Chi', 'The Weight of Nine',
      'Hard as Pit Stone', 'Rockfall Strike', 'Immovable Mind', 'Granite Avatar', 'The Unyielding',
    ],
  },
  {
    id: 'pitsorcer_storm',
    classId: 'pitsorcer',
    name: 'Storm',
    description: 'Call the sky down. It is the only god that still answers.',
    skills: ['ps_a2', 'ps_a1'],
    primaryStat: 'damagePct',
    secondaryStat: 'aoePct',
    names: [
      'Static Field', 'Arc Bolt', 'Charged Air', 'Thunderclap', 'Overcharge',
      'Storm Caller', 'Ball Lightning', 'Chain Reaction', 'High Voltage', 'Tempest Weapon',
      'Forked Lightning', 'Storm Front', 'Conduction', 'Electrical Skin', 'Rapid Discharge',
      'Storm Crown', 'Discharge', 'The Gathering Sky', 'Thunderbolt', 'Voltage',
      'Skyfall', 'Storm Herald', 'Voltaic Wrath', 'Eye of the Storm', 'Tempest Heart',
      'Thunder Sovereign', "Stormcaller's Crown", 'Lightning Domain', "Sky's Wrath", 'Thunderhead',
    ],
  },
  {
    id: 'pitsorcer_frost',
    classId: 'pitsorcer',
    name: 'Frost',
    description: 'Cold is patience. The pit freezes everything eventually.',
    skills: ['ps_a1', 'ps_a4'],
    primaryStat: 'dotPct',
    secondaryStat: 'cooldownReduction',
    names: [
      'First Frost', 'Cold Touch', 'Chilling Wind', 'Rime', 'Frozen Edge',
      'Deep Chill', 'Ice Shards', 'Glacial Skin', 'Permafrost', 'Snowveil',
      'Frostbite', "Winter's Edge", 'Cryostasis', 'Frozen Heart', 'Cold Snap',
      'Hypothermia', 'Frost Nova Echo', 'Icicle Barrage', 'Avalanche', "Winter's Nail",
      'Absolute Zero', 'Shatter Ice', 'Glacier Skin', 'Frostbound', 'Heart of Winter',
      'Cold Sovereign', 'Permafrost Soul', 'Snowgrave', "Winter's Domain", 'Eternal Frost',
    ],
  },
  {
    id: 'pitsorcer_void',
    classId: 'pitsorcer',
    name: 'Void',
    description: 'The pit has a bottom. You have found it.',
    skills: ['ps_a3', 'ps_a2'],
    primaryStat: 'critChance',
    secondaryStat: 'moveSpeed',
    names: [
      'First Rift', 'Void Touch', 'Umbral Step', 'Null Field', 'Hollow Sight',
      'Unmake', 'Dimensional Tear', 'Void Bolt', 'Silent Step', 'Between',
      'Rift Walk', 'Devour', 'Black Pulse', 'Event Horizon', 'Void Shield',
      'Unseen', 'Graviton', 'Void Grasp', 'Rift Storm', 'Nightfall',
      'Siphon Void', 'Umbral Call', 'Eventide', 'Void Crown', 'Null Domain',
      'Space Thief', 'Rift Herald', 'The Hollow', 'Void Sovereign', 'Unmade',
    ],
  },
  {
    id: 'ironpriest_faith',
    classId: 'ironpriest',
    name: 'Faith',
    description: 'The old gods are dead. Their light still works.',
    skills: ['ip_a3', 'ip_a4'],
    primaryStat: 'damagePct',
    secondaryStat: 'critDamage',
    names: [
      'First Prayer', 'Devotion', 'Holy Sigil', 'Light of Faith', 'Zeal',
      'Blessed Edge', 'Divine Shield', 'Grace', 'Judgment', 'Vow',
      'Faithful', 'Consecrated', 'Smite', 'Atonement', 'Radiant Guard',
      'Angel', 'Sanctity', 'Ordained', 'Lightbearer', 'The Charge',
      'Zealot', 'Risen', 'Purifier', 'Faith Ascendant', 'Empyrean',
      'Crown of Dawn', 'The Beacon', 'Unblinking', 'Seraph', 'Divine Ascendant',
    ],
  },
  {
    id: 'ironpriest_shield',
    classId: 'ironpriest',
    name: 'Shield',
    description: 'A wall is only a promise that the world will not move.',
    skills: ['ip_a1', 'ip_a2'],
    primaryStat: 'armorPct',
    secondaryStat: 'maxHpPct',
    names: [
      'First Bulwark', 'Iron Wall', 'Grounded', 'Shield Bash', 'Bastion',
      'Deflector', 'Tower', 'Stonewall', 'Aegis', 'Resolve',
      'Wall of Will', 'Guard', 'Riposte Guard', 'Unbroken Wall', 'Sanctuary Wall',
      'Bulwark Master', 'Iron Oath', 'Reflect', 'Shield Song', 'Vanguard',
      'Defiant', 'The Wall', 'Bastion Lord', 'Aegis Bearer', 'Immovable Guard',
      'Guardian', 'Shield Eternal', 'Stoneguard', 'Fortress', 'Aegis Sovereign',
    ],
  },
  {
    id: 'ironpriest_light',
    classId: 'ironpriest',
    name: 'Light',
    description: 'The pit swallowed two gods. Their afterglow still burns.',
    skills: ['ip_a2', 'ip_a4'],
    primaryStat: 'aoePct',
    secondaryStat: 'cooldownReduction',
    names: [
      'First Light', 'Radiance', 'Beam', 'Lumen', 'Illumination',
      'Dawnfire', 'Haste of Light', 'Prism', 'Sunburst', 'Clarity',
      'Burning Radiance', "Light's Edge", 'Consecrated Fire', 'Holy Fire', 'Revelation',
      'Beacon', 'Flash', 'Solar Flare', 'Warding Light', 'Purity',
      'Lamp of the Pit', 'Brilliance', 'Scintillation', 'Solar Crown', 'The Radiant',
      'Lumen Domain', 'Starfire', 'Sacred Flame', 'Radiant Sovereign', 'The Second Sun',
    ],
  },
  {
    id: 'plagueborn_venom',
    classId: 'plagueborn',
    name: 'Venom',
    description: 'The slow poison. The one that gets the last word.',
    skills: ['pb_a1', 'pb_a4'],
    primaryStat: 'dotPct',
    secondaryStat: 'damagePct',
    names: [
      'First Venom', 'Toxic Touch', 'Blight', "Serpent's Gift", 'Corrosion',
      'Poisoned Edge', 'Virulence', 'Toxin', 'Numbing', 'Sickness',
      'Toxic Aura', 'Contagion', 'Venomous', 'Wither', 'Antidote',
      'Ichor', 'Blight Touch', 'Toxic Burst', 'Plague', 'Miasma',
      'Venom Lord', 'Hex', 'Corpse Rot', 'Septic', 'Bubonic',
      "Serpent's Kiss", 'Toxic Cloud', 'Hollow Venom', 'Pestilence', 'Venom Sovereign',
    ],
  },
  {
    id: 'plagueborn_sickness',
    classId: 'plagueborn',
    name: 'Sickness',
    description: 'Let the plague walk in front of you. It clears the way.',
    skills: ['pb_a2', 'pb_signature'],
    primaryStat: 'maxHpPct',
    secondaryStat: 'statusResist',
    names: [
      'First Rot', 'Miasma', 'Fever', 'Waste', 'Fester',
      'Bilious', 'Sallow', 'Rotting', 'Pale', 'Putrid',
      'Well of Sickness', 'Pallor', 'Leeching Rot', 'Diseased', 'Curse of Frail',
      'Infirm', 'Undying Rot', 'Wasting', 'Sickness Cloud', 'Sepsis',
      'Harrow', 'Frail Heart', 'Gangrene', 'Mortal Rot', 'Withered',
      'Sickened', "Rodent's Gift", 'Black Rot', 'Sickness Sovereign', 'The Pale Waste',
    ],
  },
  {
    id: 'plagueborn_swift',
    classId: 'plagueborn',
    name: 'Swift',
    description: 'Never let the blade land twice on the same place.',
    skills: ['pb_a3', 'pb_a1'],
    primaryStat: 'attackSpeed',
    secondaryStat: 'critChance',
    names: [
      'First Step', 'Swiftness', 'Quick Draw', 'Nimble', 'Quick Recovery',
      "Cat's Grace", 'Reflex', 'Double Step', 'Lunge', 'High Step',
      'Wind Step', 'Feather Fall', 'Twin Fang Echo', 'Skirmisher', 'Afterimage',
      'Blur', 'Quickstrike', 'Evasive', "Dancer's Step", 'Fleet',
      'Scrapper', 'Sidestep', 'Razor Reflex', 'Swift Echo', 'Phantom Step',
      'Storm of Blades', "Viper's Rush", 'Swift Sovereign', 'The Quick Blade', 'Second Wind',
    ],
  },
  {
    id: 'soulbinder_shadow',
    classId: 'soulbinder',
    name: 'Shadow',
    description: 'Let something else take the first hit.',
    skills: ['sb_a1', 'sb_a3'],
    primaryStat: 'dodge',
    secondaryStat: 'maxHpPct',
    names: [
      'First Shadow', 'Umbra', 'Dark Pact', 'Gloom', 'Night Eye',
      'Shadow Bolt', 'Shade', 'Veil', 'Dread', 'Umbral Bond',
      'Whisper', 'Hollow', 'Void Shade', 'Shadow Dance', 'Shroud',
      'Scent of Death', 'Grave Wind', 'Pale Rider', 'Black Shroud', 'Deadlight',
      'Shadow Sentinel', 'Nightfall Echo', 'Umbra Crown', 'Shadow Domain', 'Soulbind',
      'The Long Dark', 'Shade Walker', 'Dread Sovereign', 'Gravebound', 'Shadow Sovereign',
    ],
  },
  {
    id: 'soulbinder_blood',
    classId: 'soulbinder',
    name: 'Blood',
    description: 'Every soul is a coin. Spend it carefully.',
    skills: ['sb_a2', 'sb_a4'],
    primaryStat: 'lifeOnHit',
    secondaryStat: 'soulYieldPct',
    names: [
      'First Drain', 'Crimson Feast', 'Blood Pact', 'Thirst', 'Leech',
      'Red Wound', 'Sanguine Bond', 'Hemoglobin', 'Vitality Drain', 'Vein Open',
      'Bloodmark', 'Crimson Echo', 'Sanguine Sight', 'Scarlet Feast', 'Hemomancy',
      'Red Shroud', 'Bleed Ward', 'The Red Hour', 'Blood Sorcery', 'Arterial Cut',
      'Gout', 'Ruby Wound', 'Vital Hunger', 'Crimson Crown', 'Sanguine Edge',
      'Second Pact', 'Hemolock', 'Rune of Blood', 'Blood Sovereign', 'Sanguine Feast',
    ],
  },
  {
    id: 'soulbinder_doom',
    classId: 'soulbinder',
    name: 'Doom',
    description: 'The dead are the only ones who kept their oaths.',
    skills: ['sb_a4', 'sb_signature'],
    primaryStat: 'critDamage',
    secondaryStat: 'dotPct',
    names: [
      'First Omen', 'Doom', 'Grave Call', 'Soul Taint', 'Whispers',
      'Death Mark', 'Reaper', 'Hollow Call', 'Bone Echo', 'Undying',
      'Mourning', 'Grim Harvest', 'Deathrattle', 'Soul Storm', 'Last Breath',
      'Pallor', 'Cairn', 'Wailing', 'The Reaping', 'Undying Rites',
      'Grave Bane', 'Deathblow', 'Mourning Bell', 'Gloom Herald', "Death's Door",
      'Soul Eater', 'Grim Sovereign', 'The Long Dusk', 'Grave Sovereign', 'Doom Sovereign',
    ],
  },
];

/* -------------------------------------------------------------- skeleton */

/** Node counts per depth - 30 nodes in total. */
const SHAPE = [1, 2, 4, 6, 8, 9];

/** Archetype per depth and index. */
const ARCHETYPE_PLAN: ArchetypeId[][] = [
  ['MULTIPLIER'],
  ['VALUE', 'CONDITIONAL'],
  ['VALUE', 'MULTIPLIER', 'PASSIVE', 'CONDITIONAL'],
  ['COOLDOWN', 'RESOURCE', 'DURATION', 'VALUE', 'PIERCE', 'PASSIVE'],
  ['TRANSFORM', 'PIERCE', 'DURATION', 'RUNE_UNLOCK', 'MULTIPLIER', 'VALUE', 'COOLDOWN', 'RESOURCE'],
  ['ACCESS', 'RUNE_UNLOCK', 'VALUE', 'MULTIPLIER', 'PASSIVE', 'CONDITIONAL', 'DURATION', 'TRANSFORM', 'VALUE'],
];

const VALUE_STATS = [
  'damagePct',
  'maxHpPct',
  'armorPct',
  'attackSpeed',
  'critChance',
  'critDamage',
  'cooldownReduction',
  'aoePct',
  'dotPct',
  'soulYieldPct',
  'moveSpeed',
  'resourceRegen',
  'hpRegen',
  'statusResist',
];

const CONDITION_TEXTS = [
  'your resource is below half',
  'fewer than three enemies stand',
  'you are below half health',
  'your resource is full',
  'a boss stands before you',
];

const STATUS_IDS = ['burn', 'poison', 'slow', 'rage', 'shield', 'haste', 'focus', 'aura'];

const TRANSFORM_FLAGS = ['aoe', 'single', 'pierce', 'chain'];

/** The passive id prefix of every class. */
const PASSIVE_PREFIX: Record<string, string> = {
  bladewalker: 'bw',
  ashmonk: 'am',
  pitsorcer: 'ps',
  ironpriest: 'ip',
  plagueborn: 'pb',
  soulbinder: 'sb',
};

function passivesOf(classId: string): string[] {
  const prefix = PASSIVE_PREFIX[classId] ?? classId.slice(0, 2);
  return Array.from({ length: 8 }, (_, i) => `${prefix}_p${i + 1}`);
}

function loadSkills(): Map<string, SkillDef> {
  const map = new Map<string, SkillDef>();
  const files = [
    'bladewalker',
    'ashmonk',
    'pitsorcer',
    'ironpriest',
    'plagueborn',
    'soulbinder',
  ];
  for (const name of files) {
    const url = new URL(`../src/data/skills/${name}.json`, import.meta.url);
    const json = JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as SkillDef[];
    for (const skill of json) map.set(skill.id, skill);
  }
  return map;
}

const skills = loadSkills();

/* ------------------------------------------------------------- generator */

function buildTree(spec: TreeSpec): TreeDef {
  const nodes: TreeNodeDef[] = [];
  const passives = passivesOf(spec.classId);
  const layers: string[][] = [];
  let counter = 0;
  const parents: string[] = [];

  for (let depth = 0; depth < SHAPE.length; depth++) {
    const count = SHAPE[depth]!;
    const layer: string[] = [];
    for (let i = 0; i < count; i++) {
      const archetype = ARCHETYPE_PLAN[depth]![i % ARCHETYPE_PLAN[depth]!.length]!;
      const index = counter++;
      const id = `${spec.id}_n${String(index).padStart(2, '0')}`;
      const name = spec.names[index] ?? `${spec.name} ${index + 1}`;
      const parent = depth === 0 ? null : parents[Math.floor((i * parents.length) / count)] ?? null;

      const node: TreeNodeDef = {
        id,
        treeId: spec.id,
        parent,
        depth: depth + 1,
        name,
        description: '',
        archetype,
        cost: 1,
        costGrowth: 1.55,
        maxRank: ARCHETYPES[archetype].maxRank,
        params: {},
        icon: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      };

      buildParams(node, spec, archetype, passives);
      node.description = describe(node);
      node.cost = costFor(node, depth + 1);
      nodes.push(node);
      layer.push(id);
    }
    layers.push(layer);
    parents.length = 0;
    parents.push(...layer);
  }

  return { id: spec.id, classId: spec.classId, name: spec.name, description: spec.description, nodes };
}

function buildParams(node: TreeNodeDef, spec: TreeSpec, archetype: ArchetypeId, passives: string[]): void {
  const hash = hashIndex(node.id);
  const skill = spec.skills[hash % spec.skills.length]!;
  const valueStat = VALUE_STATS[hash % VALUE_STATS.length]!;

  switch (archetype) {
    case 'VALUE': {
      const stat = hash % 3 === 0 ? spec.primaryStat : valueStat;
      node.params = { stat, value: stat === 'critChance' ? 0.012 : 0.03 };
      break;
    }
    case 'CONDITIONAL': {
      const stat = spec.primaryStat;
      node.params = {
        stat,
        value: 0.04,
        condition: { kind: 'enemiesAtLeast', value: 3 + (hash % 3) },
        conditionText: CONDITION_TEXTS[hash % CONDITION_TEXTS.length]!,
      };
      break;
    }
    case 'COOLDOWN': {
      node.params = { skill, ticks: -5 };
      break;
    }
    case 'RESOURCE': {
      node.params = { skill, delta: -3 };
      break;
    }
    case 'TRANSFORM': {
      node.params = { skill, flag: TRANSFORM_FLAGS[hash % TRANSFORM_FLAGS.length]! };
      break;
    }
    case 'PIERCE': {
      node.params = { skill, count: 1 };
      break;
    }
    case 'DURATION': {
      node.params = { status: STATUS_IDS[hash % STATUS_IDS.length]!, ticks: 10 };
      break;
    }
    case 'RUNE_UNLOCK': {
      const def = skills.get(skill);
      const rune = def?.runes?.[hash % Math.max(1, def.runes.length)]?.id ?? `${skill}_flood`;
      node.params = { skill, rune };
      break;
    }
    case 'ACCESS': {
      node.params = { skill, permanent: false };
      break;
    }
    case 'MULTIPLIER': {
      node.params = { stat: spec.primaryStat, mult: 1.1, cap: 3 };
      break;
    }
    case 'PASSIVE': {
      node.params = { passive: passives[hash % passives.length]!, rank: 1 };
      break;
    }
    case 'NODE_GATE': {
      node.params = { node: '' };
      break;
    }
    default:
      node.params = {};
      break;
  }
}

function describe(node: TreeNodeDef): string {
  const spec = ARCHETYPES[node.archetype];
  const base = spec.blurb(node);
  return `${node.name} - ${base}.`;
}

function costFor(node: TreeNodeDef, depth: number): number {
  const spec = ARCHETYPES[node.archetype];
  const base = 18 * (1 + 0.55 * (depth - 1)) * spec.costMult;
  return Math.max(1, Math.round(base));
}

function hashIndex(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/* ----------------------------------------------------------------- write */

let written = 0;
for (const spec of SPECS) {
  const tree = buildTree(spec);
  const file = resolve(outDir, `${spec.id}.json`);
  writeFileSync(file, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');
  written += tree.nodes.length;
}

console.log(`Generated ${SPECS.length} trees with ${written} nodes into ${outDir}`);
