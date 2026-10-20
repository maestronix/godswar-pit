/**
 * Balance tool.
 *
 * Simulates many runs with the *real* engine (never a separate balancing
 * engine - the numbers have to match the game) and prints a report:
 *
 *   - time per throne
 *   - where the hero dies (node type heat map)
 *   - drop rates per rarity
 *   - souls per minute
 *
 * Usage: npm run balance -- --runs=200 --class=bladewalker
 */
import { Content } from '../src/data/registry';
import { createDefaultSave, type ItemRecord, type SaveFile } from '../src/state/schema';
import { createRun } from '../src/sim/expedition';
import { step } from '../src/sim/engine';
import { DEFAULT_POLICY, type ManagerPolicy } from '../src/sim/policy';
import { nodeCost } from '../src/data/balance';
import { ARCHETYPES } from '../src/data/nodes/archetypes';
import { compareItems } from '../src/sim/loot';
import { ITEM_SLOTS } from '../src/data/types';
import type { TreeNodeDef } from '../src/data/types';

interface Args {
  runs: number;
  classId: string | null;
}

function parseArgs(): Args {
  const args: Args = { runs: 1000, classId: null };
  for (const arg of process.argv.slice(2)) {
    const match = /^--([a-z]+)=(.+)$/.exec(arg);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'runs') args.runs = Math.max(1, Number(value));
    if (key === 'class') args.classId = value;
  }
  return args;
}

interface RunResult {
  victory: boolean;
  seconds: number;
  depth: number;
  kills: number;
  souls: number;
  items: number;
  rarities: Record<string, number>;
  deathType: string;
  zone: number;
  hp: number;
  stats: Record<string, number>;
  loot: ItemRecord[];
}

/** Buy the cheapest affordable node - a simple greedy "investor". */
function invest(save: SaveFile): void {
  for (;;) {
    const candidates: { node: TreeNodeDef; cost: number }[] = [];
    for (const tree of Content.treeList) {
      if (tree.classId !== save.player.classId) continue;
      for (const node of tree.nodes) {
        const rank = save.tree.ranks[node.id] ?? 0;
        if (rank >= node.maxRank) continue;
        if (node.parent && !(save.tree.ranks[node.parent])) continue;
        const cost = nodeCost(node.depth, ARCHETYPES[node.archetype]?.costMult ?? 1, rank);
        if (cost > save.player.souls) continue;
        candidates.push({ node, cost });
      }
    }
    if (candidates.length === 0) return;
    candidates.sort((a, b) => a.cost - b.cost);
    const chosen = candidates[0]!;
    save.player.souls -= chosen.cost;
    save.tree.ranks[chosen.node.id] = (save.tree.ranks[chosen.node.id] ?? 0) + 1;
  }
}

function simulateRun(save: SaveFile, seed: number, zone: number, policy: ManagerPolicy): RunResult {
  const run = createRun({
    player: save.player,
    tree: save.tree,
    unlocked: save.unlocked,
    meta: save.meta,
    seed,
    zoneId: zone,
    runId: `run_${seed.toString(36)}`,
  });

  const maxTicks = 60 * 60 * 10; // one hour of game time
  step(run.state, run.ctx, maxTicks, { policy });

  const rarities: Record<string, number> = {};
  for (const item of run.state.loot) {
    rarities[item.rarity] = (rarities[item.rarity] ?? 0) + 1;
  }

  const deathType =
    run.state.phase === 'victory'
      ? 'THRONE'
      : (run.state.tree.nodes.find((n) => n.id === run.state.currentNodeId)?.type ?? 'UNKNOWN');

  return {
    victory: run.state.phase === 'victory',
    seconds: run.state.tick / 10,
    depth: run.state.depth,
    kills: run.state.kills,
    souls: run.state.souls,
    items: run.state.loot.length,
    loot: run.state.loot,
    rarities,
    deathType,
    zone,
    hp: run.state.hero.hp,
    stats: run.state.hero.stats as unknown as Record<string, number>,
  };
}

/** Equip the best item of every slot - the same thing the game does. */
function autoEquip(save: SaveFile): void {
  for (const slot of ITEM_SLOTS) {
    let bestIndex = -1;
    let best: ItemRecord | undefined;
    for (let i = 0; i < save.player.vault.length; i++) {
      const item = save.player.vault[i]!;
      if (item.slot !== slot) continue;
      if (compareItems(item, save.player.equipped[slot]) <= 0) continue;
      if (!best || compareItems(item, best) > 0) {
        best = item;
        bestIndex = i;
      }
    }
    if (bestIndex < 0 || !best) continue;
    save.player.vault.splice(bestIndex, 1);
    const previous = save.player.equipped[slot];
    save.player.equipped[slot] = best;
    if (previous) save.player.vault.push(previous);
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function report(classId: string, results: RunResult[]): void {
  const victories = results.filter((r) => r.victory);
  const durations = results.map((r) => r.seconds);
  const depths = results.map((r) => r.depth);
  const souls = results.map((r) => r.souls);
  const items = results.map((r) => r.items);
  const perMinute = results.map((r) => (r.seconds > 0 ? (r.souls / r.seconds) * 60 : 0));

  const deathCounts = new Map<string, number>();
  for (const result of results) {
    deathCounts.set(result.deathType, (deathCounts.get(result.deathType) ?? 0) + 1);
  }
  const dropCounts = new Map<string, number>();
  for (const result of results) {
    for (const [rarity, count] of Object.entries(result.rarities)) {
      dropCounts.set(rarity, (dropCounts.get(rarity) ?? 0) + count);
    }
  }

  console.log(`\n=== ${classId} ===`);
  console.log(`runs: ${results.length}`);
  console.log(`throne rate: ${((victories.length / results.length) * 100).toFixed(1)}%`);
  console.log(`avg run: ${average(durations).toFixed(1)}s (min ${Math.min(...durations).toFixed(0)}s, max ${Math.max(...durations).toFixed(0)}s)`);
  console.log(`avg depth: ${average(depths).toFixed(1)}`);
  console.log(`avg kills: ${average(results.map((r) => r.kills)).toFixed(1)}`);
  console.log(`avg souls: ${average(souls).toFixed(0)}`);
  console.log(`avg souls/min: ${average(perMinute).toFixed(1)}`);
  console.log(`avg items/run: ${average(items).toFixed(2)}`);

  console.log('deaths by room type:');
  for (const [type, count] of [...deathCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(10)} ${((count / results.length) * 100).toFixed(1)}%`);
  }

  console.log('drop rates per rarity (per run):');
  for (const rarity of ['common', 'magic', 'rare', 'legendary', 'mythic']) {
    const count = dropCounts.get(rarity) ?? 0;
    console.log(`  ${rarity.padEnd(10)} ${(count / results.length).toFixed(3)}`);
  }
}

function main(): void {
  const args = parseArgs();
  const classIds = args.classId ? [args.classId] : Content.classList.map((c) => c.id);
  const policy: ManagerPolicy = { ...DEFAULT_POLICY };

  for (const classId of classIds) {
    const classDef = Content.class(classId);
    if (!classDef) {
      console.log(`Unknown class ${classId}`);
      continue;
    }

    const save = createDefaultSave();
    save.player.classId = classId;
    save.unlocked.persistent.activeSkills = [classDef.signature, ...classDef.actives];
    save.player.level = 1;

    const results: RunResult[] = [];
    let zone = 1;
    let zoneWins = 0;
    let seed = 0x1234abcd;

    for (let i = 0; i < args.runs; i++) {
      // The zone grows with the progress the simulated player made.
      const result = simulateRun(save, seed, zone, policy);
      seed = (seed * 1664525 + 1013904223) >>> 0;
      results.push(result);

      // The death rules: a victory secures the loot, a death loses it.
      if (result.victory) {
        save.player.vault.push(...result.loot);
        autoEquip(save);
        zoneWins += 1;
      }
      save.player.souls += result.souls;
      // A throne has to be farmed a few times before the next zone opens.
      if (result.victory && zoneWins >= 3 && zone < 10) {
        zone += 1;
        zoneWins = 0;
      }
      invest(save);
      if (process.env.BALANCE_DEBUG) {
        console.log(
          `run ${i}: ${result.victory ? 'WIN' : 'lose'} depth=${result.depth} kills=${result.kills} zone=${result.zone} hp=${result.hp.toFixed(0)} souls=${save.player.souls.toFixed(0)} nodes=${Object.keys(save.tree.ranks).length} dmg=${result.stats.damage?.toFixed(1)}`,
        );
      }
    }

    report(classId, results);
  }
}

main();
