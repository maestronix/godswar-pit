/**
 * The pit tree.
 *
 * A run is an ascending tree: the hero starts at the bottom and climbs to the
 * throne at the top. The *shape* and the *risk* of every node are visible
 * from the start, the *content* is only rolled when the node is entered.
 */
import { Rng, hashString } from '../core/rng';
import { clamp } from '../core/math';
import type { NodeType } from '../data/types';
import type { SimTree, SimTreeNode } from './types';

export interface TreeOptions {
  zone: number;
  seed: number;
  /** 0 = normal, higher numbers add more branches. */
  branching?: number;
}

/** Number of layers (rooms) a run in the given zone contains. */
export function treeDepthFor(zone: number): number {
  return clamp(10 + Math.ceil(zone / 2), 12, 16);
}

function typeWeights(layer: number, depth: number, healingLeft: number, treasureLeft: number): number[] {
  // FIGHT, TREASURE, HEALING, TRAP, ELITE, EVENT
  const weights = [46, 14, 8, 10, 12, 10];
  if (layer <= 1) {
    weights[2] = 0; // no healing in the first two layers
    weights[3] = 0; // no traps before layer 3
  }
  if (layer < 2) weights[4] = 0; // no elites before layer 2
  if (healingLeft <= 0) weights[2] = 0;
  if (treasureLeft <= 0) weights[1] = 0;
  // Later layers are more dangerous and less forgiving.
  const danger = depth / 16;
  weights[0] *= 1 + danger * 0.4;
  weights[4] *= 1 + danger * 0.8;
  weights[3] *= 1 + danger * 0.6;
  weights[2] *= 1 - danger * 0.4;
  return weights;
}

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
 * Generate the tree for a run. The result is stored in the save, so the
 * generation itself does not have to be reproducible - but it is anyway.
 */
export function generateTree(options: TreeOptions): SimTree {
  const { zone } = options;
  const seed = options.seed >>> 0;
  const rng = new Rng((seed ^ hashString('tree')) >>> 0);

  const depth = treeDepthFor(zone);
  const branchCount = options.branching ?? (zone >= 4 ? 3 : 2);

  const nodes: SimTreeNode[] = [];
  const layers: string[][] = [];

  const healingBudget = zone >= 4 ? 3 : 2;
  const treasureBudget = Math.max(1, Math.floor(depth / 5));
  let healingUsed = 0;
  let treasureUsed = 0;

  const riskBase = clamp(0.6 + zone * 0.32, 0, 3.2);
  const riskStep = 1.35 / depth;

  const pushLayer = (layer: number, types: NodeType[]): string[] => {
    const ids: string[] = [];
    for (let i = 0; i < types.length; i++) {
      const id = `n${layer}_${i}`;
      const risk = clamp(
        Math.round(riskBase + layer * riskStep + TYPE_BONUS[types[i]!] + rng.range(-0.35, 0.35)),
        0,
        5,
      );
      nodes.push({
        id,
        parent: null,
        depth: layer,
        type: types[i]!,
        risk,
        x: (i - (types.length - 1) / 2) * 2.4,
        y: layer,
        contentSeed: (seed ^ hashString(`${zone}:${layer}:${i}`)) >>> 0,
      });
      ids.push(id);
    }
    layers.push(ids);
    return ids;
  };

  // Layer 0: the entrance.
  const entrance = pushLayer(0, ['FIGHT']);

  // Middle layers: every layer offers `branchCount` rooms to choose from.
  for (let layer = 1; layer < depth - 1; layer++) {
    const types: NodeType[] = [];
    for (let i = 0; i < branchCount; i++) {
      const weights = typeWeights(layer, layer, healingBudget - healingUsed, treasureBudget - treasureUsed);
      const type = (['FIGHT', 'TREASURE', 'HEALING', 'TRAP', 'ELITE', 'EVENT'] as NodeType[])[
        rng.weightedIndex(weights)
      ]!;
      if (type === 'HEALING') healingUsed++;
      if (type === 'TREASURE') treasureUsed++;
      types.push(type);
    }
    pushLayer(layer, types);
  }

  // Top layer: exactly one throne.
  pushLayer(depth - 1, ['BOSS']);

  // Connect the layers: a node in a layer is the child of a node below it,
  // so the player can climb from the entrance to the throne.
  for (let layer = 1; layer < layers.length; layer++) {
    const below = layers[layer - 1]!;
    const current = layers[layer]!;
    for (let i = 0; i < current.length; i++) {
      const node = nodes.find((n) => n.id === current[i])!;
      node.parent = below[i % below.length]!;
    }
  }

  // Risk must not decrease with depth.
  for (let layer = 1; layer < layers.length; layer++) {
    const previous = layers[layer - 1]!.map((id) => nodes.find((n) => n.id === id)!.risk);
    const floor = previous.length > 0 ? Math.min(...previous) : 0;
    for (const id of layers[layer]!) {
      const node = nodes.find((n) => n.id === id)!;
      if (node.risk < floor) node.risk = floor;
    }
  }

  return {
    nodes,
    layers,
    bossId: layers[layers.length - 1]![0]!,
    startId: entrance[0]!,
  };
}

/** Children of a node (the nodes the player may pick next). */
export function childrenOf(tree: SimTree, nodeId: string): string[] {
  return tree.nodes.filter((n) => n.parent === nodeId).map((n) => n.id);
}

/** The node ids that may be entered next. */
export function nextOptions(tree: SimTree, currentNodeId: string | null): string[] {
  if (currentNodeId === null) {
    return [tree.startId];
  }
  const children = childrenOf(tree, currentNodeId);
  if (children.length > 0) return children;
  const node = tree.nodes.find((n) => n.id === currentNodeId);
  if (!node) return [];
  // The throne is the last layer - nothing follows it.
  if (node.type === 'BOSS') return [];
  // Fall back to the closest node in the next layer.
  const layer = tree.layers[node.depth + 1];
  return layer ? [layer[0]!] : [];
}
