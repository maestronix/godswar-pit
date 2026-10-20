/**
 * The paths of the pit.
 *
 * A run is not a branching tree any more: the player chooses ONE path at the
 * entrance and the hero walks exactly that path up to the throne. There is no
 * second choice after a cleared room - the whole run is decided by the path
 * that was picked at the beginning.
 *
 * The paths differ in their mix:
 *  - the Shrine Way has the most healing rooms,
 *  - the Gilded Road has the most treasure and the most danger,
 *  - the Ash Road is the plain way in between.
 *
 * The type and the risk of every room of every path are visible from the
 * start, the content of a room is only rolled when the hero enters it.
 */
import { Rng, hashString } from '../core/rng';
import { clamp } from '../core/math';
import type { NodeType } from '../data/types';
import type { SimRoute, SimRoutes, SimTreeNode } from './types';

export interface RouteOptions {
  zone: number;
  seed: number;
}

interface RouteProfile {
  name: string;
  /** Healing rooms on the path. */
  shrines: number;
  /** Treasure rooms on the path. */
  treasures: number;
  /** Multiplier for the danger of the path. */
  danger: number;
  /** Multiplier for the weight of the elite rooms. */
  elites: number;
}

/** The character of every path. The rooms themselves are rolled per run. */
const PROFILES: RouteProfile[] = [
  { name: 'The Ash Road', shrines: 2, treasures: 2, danger: 1, elites: 1 },
  { name: 'The Shrine Way', shrines: 3, treasures: 1, danger: 0.85, elites: 0.7 },
  { name: 'The Gilded Road', shrines: 1, treasures: 3, danger: 1.2, elites: 1.5 },
];

/** How many paths the player may choose from. */
export function routeCountFor(zone: number): number {
  void zone;
  return Math.min(PROFILES.length, 3);
}

/** How many rooms a path has (entrance and throne included). */
export function routeLengthFor(zone: number): number {
  return clamp(10 + Math.ceil(zone / 2), 12, 16);
}

/** The name of a path. */
export function routeName(index: number): string {
  return PROFILES[index]?.name ?? `The ${index + 1}. Path`;
}

/** The risk bonus of a room type. */
const TYPE_BONUS: Record<NodeType, number> = {
  FIGHT: 0,
  ELITE: 1.2,
  TREASURE: -0.4,
  HEALING: -0.8,
  EVENT: 0.2,
  TRAP: 0.8,
  BOSS: 0,
};

/**
 * The weights of the room types of a normal room.
 *
 * FIGHT, TREASURE, HEALING, TRAP, ELITE, EVENT
 */
function roomWeights(depth: number, length: number, profile: RouteProfile): number[] {
  const weights = [46, 14, 8, 10, 12, 10];
  if (depth <= 1) {
    weights[2] = 0; // no healing in the first two rooms
    weights[3] = 0; // no traps before the third room
  }
  if (depth < 2) weights[4] = 0; // no elites before the third room
  // Later rooms are more dangerous and less forgiving.
  const danger = depth / length;
  weights[0] *= 1 + danger * 0.4;
  weights[4] *= (1 + danger * 0.8) * profile.elites;
  weights[3] *= 1 + danger * 0.6;
  weights[2] *= 1 - danger * 0.4;
  return weights;
}

/**
 * Spread `count` rooms over the given depths.
 *
 * The healing rooms of a path are spread over the whole path, so the player
 * can see where the next shrine is coming. The result is deterministic.
 */
function spreadOver(depths: number[], count: number, rng: Rng): number[] {
  const n = Math.min(count, depths.length);
  if (n <= 0 || depths.length === 0) return [];
  const used = new Set<number>();
  const picked: number[] = [];
  for (let i = 0; i < n; i++) {
    const ideal = Math.round((i * (depths.length - 1)) / Math.max(1, n - 1));
    let index = clamp(ideal + rng.int(-1, 1), 0, depths.length - 1);
    let guard = 0;
    while (used.has(index) && guard < depths.length) {
      index = (index + 1) % depths.length;
      guard++;
    }
    used.add(index);
    picked.push(depths[index]!);
  }
  return picked.sort((a, b) => a - b);
}

/**
 * Generate the paths of a run.
 *
 * The result is stored in the save, so the generation itself does not have to
 * be reproducible - but it is anyway.
 */
export function generateRoutes(options: RouteOptions): SimRoutes {
  const { zone } = options;
  const seed = options.seed >>> 0;
  const length = routeLengthFor(zone);
  const count = routeCountFor(zone);

  const routes: SimRoute[] = [];
  const nodes: SimTreeNode[] = [];

  for (let index = 0; index < count; index++) {
    const profile = PROFILES[index]!;
    const rng = new Rng((seed ^ hashString(`route:${index}`)) >>> 0);
    const types: NodeType[] = new Array(length).fill('FIGHT');
    types[0] = 'FIGHT'; // the entrance
    types[length - 1] = 'BOSS'; // the throne

    // The healing rooms and the treasure rooms are placed first, the rest is
    // rolled from the weights. The first two rooms are never a shrine and
    // never a trap - the pit lets the hero arrive first.
    const middleDepths: number[] = [];
    for (let depth = 1; depth < length - 1; depth++) middleDepths.push(depth);
    const shrineDepths = middleDepths.filter((depth) => depth >= 2);
    const used = new Set<number>();
    for (const depth of spreadOver(shrineDepths, profile.shrines, rng)) {
      types[depth] = 'HEALING';
      used.add(depth);
    }
    for (const depth of spreadOver(middleDepths.filter((d) => !used.has(d)), profile.treasures, rng)) {
      types[depth] = 'TREASURE';
      used.add(depth);
    }
    for (const depth of middleDepths) {
      if (used.has(depth)) continue;
      const weights = roomWeights(depth, length, profile);
      types[depth] = (['FIGHT', 'TREASURE', 'HEALING', 'TRAP', 'ELITE', 'EVENT'] as NodeType[])[
        rng.weightedIndex(weights)
      ]!;
    }

    // The risk grows with the depth and never drops.
    const riskBase = clamp(0.6 + zone * 0.32, 0, 3.2);
    const riskStep = 1.35 / length;
    const routeNodes: SimTreeNode[] = [];
    let riskFloor = 0;
    for (let depth = 0; depth < length; depth++) {
      const type = types[depth]!;
      const risk = clamp(
        Math.round(
          (riskBase + depth * riskStep + TYPE_BONUS[type] + rng.range(-0.35, 0.35)) * profile.danger,
        ),
        0,
        5,
      );
      const node: SimTreeNode = {
        id: `r${index}_d${depth}`,
        depth,
        type,
        risk: Math.max(risk, riskFloor),
        contentSeed: (seed ^ hashString(`${zone}:${index}:${depth}`)) >>> 0,
      };
      riskFloor = node.risk;
      routeNodes.push(node);
      nodes.push(node);
    }

    routes.push({ id: `route_${index}`, name: profile.name, nodes: routeNodes });
  }

  return { routes, nodes };
}

/** The path with the given id. */
export function routeById(routes: SimRoutes, routeId: string | null): SimRoute | undefined {
  if (!routeId) return undefined;
  return routes.routes.find((route) => route.id === routeId);
}

/** The room that follows the given room on the path. */
export function roomAfter(route: SimRoute, nodeId: string | null): SimTreeNode | undefined {
  if (!nodeId) return route.nodes[0];
  const index = route.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return route.nodes[0];
  return route.nodes[index + 1];
}

/** The room of the path the hero is standing in. */
export function currentRoom(route: SimRoute, nodeId: string | null): SimTreeNode | undefined {
  if (!nodeId) return undefined;
  return route.nodes.find((node) => node.id === nodeId);
}
