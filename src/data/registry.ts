/**
 * Content registry.
 *
 * All game content is loaded here exactly once and exposed through typed
 * lookups. Nothing in the game is allowed to read JSON files directly - that
 * keeps the content swappable and makes the schema test meaningful.
 */
import type {
  AchievementDef,
  AnomalyDef,
  AspectDef,
  AffixDef,
  ClassDef,
  ContractDef,
  EnemyDef,
  EventDef,
  ItemBaseDef,
  PotionDef,
  SkillDef,
  ThroneDef,
  TreeDef,
  TreeNodeDef,
  ZoneDef,
} from './types';

import classesBladewalker from './classes/bladewalker.json';
import classesAshmonk from './classes/ashmonk.json';
import classesPitsorcer from './classes/pitsorcer.json';
import classesIronpriest from './classes/ironpriest.json';
import classesPlagueborn from './classes/plagueborn.json';
import classesSoulbinder from './classes/soulbinder.json';

import skillsBladewalker from './skills/bladewalker.json';
import skillsAshmonk from './skills/ashmonk.json';
import skillsPitsorcer from './skills/pitsorcer.json';
import skillsIronpriest from './skills/ironpriest.json';
import skillsPlagueborn from './skills/plagueborn.json';
import skillsSoulbinder from './skills/soulbinder.json';

import treeBladewalkerMight from './nodes/trees/bladewalker_might.json';
import treeBladewalkerFlame from './nodes/trees/bladewalker_flame.json';
import treeBladewalkerBlood from './nodes/trees/bladewalker_blood.json';
import treeAshmonkFlow from './nodes/trees/ashmonk_flow.json';
import treeAshmonkBreath from './nodes/trees/ashmonk_breath.json';
import treeAshmonkIron from './nodes/trees/ashmonk_iron.json';
import treePitsorcerStorm from './nodes/trees/pitsorcer_storm.json';
import treePitsorcerFrost from './nodes/trees/pitsorcer_frost.json';
import treePitsorcerVoid from './nodes/trees/pitsorcer_void.json';
import treeIronpriestFaith from './nodes/trees/ironpriest_faith.json';
import treeIronpriestShield from './nodes/trees/ironpriest_shield.json';
import treeIronpriestLight from './nodes/trees/ironpriest_light.json';
import treePlaguebornVenom from './nodes/trees/plagueborn_venom.json';
import treePlaguebornSickness from './nodes/trees/plagueborn_sickness.json';
import treePlaguebornSwift from './nodes/trees/plagueborn_swift.json';
import treeSoulbinderShadow from './nodes/trees/soulbinder_shadow.json';
import treeSoulbinderBlood from './nodes/trees/soulbinder_blood.json';
import treeSoulbinderDoom from './nodes/trees/soulbinder_doom.json';

import itemBases from './items/bases.json';
import affixDefs from './items/affixes.json';
import aspectDefs from './items/aspects.json';

import zoneEnemies1 from './enemies/zone1.json';
import zoneEnemies2 from './enemies/zone2.json';
import zoneEnemies3 from './enemies/zone3.json';
import zoneEnemies4 from './enemies/zone4.json';
import zoneEnemies5 from './enemies/zone5.json';
import zoneEnemies6 from './enemies/zone6.json';
import zoneEnemies7 from './enemies/zone7.json';
import zoneEnemies8 from './enemies/zone8.json';
import zoneEnemies9 from './enemies/zone9.json';
import zoneEnemies10 from './enemies/zone10.json';

import zoneDefs from './zones.json';
import eventDefs from './events.json';
import achievementDefs from './achievements.json';
import contractDefs from './contracts.json';
import throneDefs from './thrones.json';
import potionDefs from './potions.json';
import anomalyDefs from './anomalies.json';
import mirrorTree from './meta/grace-mirror.json';
import inheritanceTree from './meta/inheritance-tree.json';

function index<T extends { id: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
}

const classList = [
  classesBladewalker,
  classesAshmonk,
  classesPitsorcer,
  classesIronpriest,
  classesPlagueborn,
  classesSoulbinder,
] as ClassDef[];

const skillList = [
  ...(skillsBladewalker as SkillDef[]),
  ...(skillsAshmonk as SkillDef[]),
  ...(skillsPitsorcer as SkillDef[]),
  ...(skillsIronpriest as SkillDef[]),
  ...(skillsPlagueborn as SkillDef[]),
  ...(skillsSoulbinder as SkillDef[]),
];

const treeList = [
  treeBladewalkerMight,
  treeBladewalkerFlame,
  treeBladewalkerBlood,
  treeAshmonkFlow,
  treeAshmonkBreath,
  treeAshmonkIron,
  treePitsorcerStorm,
  treePitsorcerFrost,
  treePitsorcerVoid,
  treeIronpriestFaith,
  treeIronpriestShield,
  treeIronpriestLight,
  treePlaguebornVenom,
  treePlaguebornSickness,
  treePlaguebornSwift,
  treeSoulbinderShadow,
  treeSoulbinderBlood,
  treeSoulbinderDoom,
] as unknown as TreeDef[];

const enemyList = [
  ...(zoneEnemies1 as EnemyDef[]),
  ...(zoneEnemies2 as EnemyDef[]),
  ...(zoneEnemies3 as EnemyDef[]),
  ...(zoneEnemies4 as EnemyDef[]),
  ...(zoneEnemies5 as EnemyDef[]),
  ...(zoneEnemies6 as EnemyDef[]),
  ...(zoneEnemies7 as EnemyDef[]),
  ...(zoneEnemies8 as EnemyDef[]),
  ...(zoneEnemies9 as EnemyDef[]),
  ...(zoneEnemies10 as EnemyDef[]),
];

const nodeList: TreeNodeDef[] = treeList.flatMap((tree) => tree.nodes);

const aspectList = aspectDefs as unknown as AspectDef[];
const throneList = throneDefs as unknown as ThroneDef[];
const throneMap = new Map<string, ThroneDef>();
for (const throne of throneList) throneMap.set(`throne_${throne.rank}`, throne);

export const Content = {
  classes: index(classList),
  classList,
  skills: index(skillList),
  skillList,
  trees: index(treeList),
  treeList,
  nodes: index(nodeList),
  nodeList,
  itemBases: index(itemBases as unknown as ItemBaseDef[]),
  affixes: index(affixDefs as unknown as AffixDef[]),
  aspects: index(aspectList),
  aspectDefs: aspectList,
  enemies: index(enemyList),
  enemyList,
  zones: zoneDefs as unknown as ZoneDef[],
  events: index(eventDefs as unknown as EventDef[]),
  achievements: index(achievementDefs as unknown as AchievementDef[]),
  contracts: index(contractDefs as unknown as ContractDef[]),
  thrones: throneMap,
  throneList,
  potions: index(potionDefs as unknown as PotionDef[]),
  anomalies: index(anomalyDefs as unknown as AnomalyDef[]),
  graceMirror: mirrorTree as unknown as TreeDef,
  inheritanceTree: inheritanceTree as unknown as TreeDef,

  class(id: string): ClassDef | undefined {
    return this.classes.get(id);
  },
  skill(id: string): SkillDef | undefined {
    return this.skills.get(id);
  },
  tree(id: string): TreeDef | undefined {
    return this.trees.get(id);
  },
  node(id: string): TreeNodeDef | undefined {
    return this.nodes.get(id);
  },
  zone(id: number): ZoneDef | undefined {
    return this.zones.find((z) => z.id === id);
  },
  throne(rank: number): ThroneDef | undefined {
    return this.thrones.get(`throne_${rank}`);
  },  potion(id: string): PotionDef | undefined {
    return this.potions.get(id);
  },
  anomaly(id: string): AnomalyDef | undefined {
    return this.anomalies.get(id);
  },
  /** All nodes of a class, in tree order. */
  nodesOfClass(classId: string): TreeNodeDef[] {
    return this.treeList
      .filter((tree) => tree.classId === classId)
      .flatMap((tree) => tree.nodes);
  },
  /** All skills of a class. */
  skillsOfClass(classId: string): SkillDef[] {
    return this.skillList.filter((skill) => skill.classId === classId);
  },
  /** All aspects of a class (including the universal ones). */
  aspectsOfClass(classId: string): AspectDef[] {
    return this.aspectDefs.filter((aspect) => aspect.classId === classId || aspect.classId === '');
  },
} as const;

export type ContentRegistry = typeof Content;
