/**
 * The game controller.
 *
 * Owns the save, the running simulation, the render state and the screen
 * routing. The UI modules only talk to this object.
 */
import { RngStreams } from './core/rng';
import { formatNumber } from './core/format';
import { TICK_MS } from './core/time';
import { BALANCE } from './data/balance';
import { Content } from './data/registry';
import { RARITY_COLORS } from './art/palette';
import { createRenderState, handleEvent, updateRenderState, type RenderState } from './art/renderer';
import { playSfx } from './audio/sfx';
import { chip } from './audio/chip';
import { music } from './audio/music';
import { step } from './sim/engine';
import { createRun, enterNode, chooseEvent, nodeById, sortRunLoot } from './sim/expedition';
import { DEFAULT_POLICY, type ManagerPolicy } from './sim/policy';
import { resolveLoadout } from './sim/stats';
import { hashState } from './sim/hash';
import type { SimContext } from './sim/context';
import type { SimEvent, SimPhase, SimState } from './sim/types';
import { SaveStore } from './state/store';
import { SAVE_VERSION, type ItemRecord, type SaveFile } from './state/schema';
import {
  collectLoginBonus,
  ensureStoryContract,
  refreshContracts,
  rollLoginDay,
  updateContractProgress,
} from './state/contracts';
import { runOffline, type OfflineReport } from './state/offline';
import { ascend, hasFeature, idleSoulRate, parallelExpeditions, rotationZone } from './state/thrones';
import { autoEquip, autoRerollAspects } from './state/automation';

export type ScreenId =
  | 'hub'
  | 'run'
  | 'trees'
  | 'inventory'
  | 'achievements'
  | 'stats'
  | 'settings'
  | 'offline';

export interface RunSummary {
  victory: boolean;
  zoneId: number;
  depth: number;
  nodesVisited: number;
  kills: number;
  souls: number;
  echo: number;
  itemsKept: number;
  itemsScrapped: number;
  deathCause: string | null;
  seconds: number;
  level: number;
}

export class Game {
  readonly store: SaveStore;
  state: SimState | null = null;
  ctx: SimContext | null = null;
  render: RenderState = createRenderState();
  policy: ManagerPolicy = { ...DEFAULT_POLICY };
  private _screen: ScreenId = 'hub';
  hubTab = 'contracts';
  summary: RunSummary | null = null;
  offlineReport: OfflineReport | null = null;
  /** Set when the player has to pick an event option. */
  pendingEventId: string | null = null;
  private accumulator = 0;
  private lastFrame = 0;
  private rafHandle = 0;
  private running = false;
  /** Called every animation frame while a screen is mounted. */
  onRender: (() => void) | null = null;
  /** Called whenever the screen changes. */
  onScreenChange: (() => void) | null = null;
  /** Additional expeditions that run in the background (Throne 3 and 9). */
  shadowRuns: { state: SimState; ctx: SimContext; zoneId: number }[] = [];
  /** Last time the idle soul income was granted. */
  private lastIdleTick = Date.now();

  get screen(): ScreenId {
    return this._screen;
  }

  set screen(value: ScreenId) {
    this._screen = value;
    if (value !== 'run') this.onRender = null;
    this.onScreenChange?.();
  }

  constructor(store?: SaveStore) {
    this.store = store ?? new SaveStore();
  }

  get save(): SaveFile {
    return this.store.current;
  }

  /* ------------------------------------------------------------- setup */

  init(): void {
    const save = this.save;
    rollLoginDay(save);
    refreshContracts(save.contracts, Date.now(), save.player.name.length * 7919 + 13);
    ensureStoryContract(save.contracts, Math.max(1, save.player.storyChapter + 1));
    updateContractProgress(save);
    collectLoginBonus(save);

    chip.setVolume(save.settings.masterVolume);
    chip.setMuted(save.settings.muted);
    music.setVolume(save.settings.musicVolume);
    music.setMuted(save.settings.muted);

    this.store.startAutosave(10_000);
    window.addEventListener('beforeunload', () => this.persist());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist();
    });
  }

  /* ------------------------------------------------------- run control */

  /** Start a new expedition in the given zone. */
  startRun(zoneId: number): void {
    const save = this.save;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const runId = `run_${seed.toString(36)}`;
    const { state, ctx } = createRun({
      player: save.player,
      tree: save.tree,
      unlocked: save.unlocked,
      meta: save.meta,
      seed,
      zoneId,
      runId,
      ascensions: save.player.incarnations,
    });
    this.state = state;
    this.ctx = ctx;
    this.save.run = state;
    this.screen = 'run';
    this.summary = null;
    this.store.update((s) => {
      s.stats.runsStarted += 1;
    });
    this.syncShadowRuns();
    music.play(Content.zone(zoneId)?.palette ?? 'ashvale');
    this.persist();
  }

  /** Resume a run that was interrupted (page reload). */
  resumeRun(): boolean {
    const save = this.save;
    const stored = save.run as SimState | null;
    if (!stored || typeof stored !== 'object' || !stored.hero) return false;
    const streams = new RngStreams(stored.seed);
    streams.restore(stored.rng ?? {});
    const mods = resolveLoadout({
      player: save.player,
      tree: save.tree,
      unlocked: save.unlocked,
      meta: save.meta,
    });
    this.state = stored;
    this.ctx = { streams, mods };
    this.screen = 'run';
    return true;
  }

  /** The player chooses the next node. */
  pickNode(nodeId: string): void {
    if (!this.state || !this.ctx) return;
    if (this.state.phase !== 'expedition') return;
    const node = nodeById(this.state, nodeId);
    if (!node) return;
    if (!this.state.nextNodeIds.includes(nodeId)) return;
    enterNode(this.state, this.ctx, nodeId, (event) => this.onEvent(event));
    playSfx('node');
    if ((this.state.phase as SimPhase) === 'event') {
      this.pendingEventId = this.state.pendingEvent?.eventId ?? null;
    }
    this.persist();
  }

  /** The player chooses an event option. */
  pickEvent(choiceId: string): void {
    if (!this.state || !this.ctx) return;
    if (this.state.phase !== 'event') return;
    chooseEvent(this.state, this.ctx, choiceId, (event) => this.onEvent(event));
    this.pendingEventId = null;
    playSfx('button');
    this.persist();
  }

  /* ------------------------------------------------------- the game loop */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (timestamp: number): void => {
      if (!this.running) return;
      const delta = Math.min(250, timestamp - this.lastFrame);
      this.lastFrame = timestamp;
      this.advance(delta);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
  }

  private advance(deltaMs: number): void {
    const save = this.save;
    updateRenderState(this.render, save.settings.reducedMotion);

    if (this.state && this.ctx) {
      const phase: SimPhase = this.state.phase;
      if (phase !== 'dead' && phase !== 'victory') {
        this.accumulator += deltaMs;
        const ticks = Math.floor(this.accumulator / TICK_MS);
        if (ticks > 0) {
          this.accumulator -= ticks * TICK_MS;
          const maxTicks = 5; // no death spiral
          const batch = Math.min(ticks, maxTicks);
          step(this.state, this.ctx, batch, {
            policy: this.policy,
            sink: (event) => this.onEvent(event),
          });
          const nextPhase: SimPhase = this.state.phase;
          if (nextPhase === 'dead' || nextPhase === 'victory') {
            this.finishRun();
          }
        }
        music.setIntensity(this.state.phase === 'battle' ? 1 : 0.25);
      } else {
        music.setIntensity(0.15);
      }
    } else {
      music.setIntensity(0.15);
    }

    this.stepShadowRuns();
    this.grantIdleSouls();

    if (Date.now() - this.lastSaveAt > 10_000) {
      this.persist();
    }

    this.onRender?.();
  }

  private lastSaveAt = 0;

  private onEvent(event: SimEvent): void {
    handleEvent(this.render, event, this.save.settings.showDamageNumbers, this.save.settings.reducedMotion);
    switch (event.type) {
      case 'damage':
        playSfx('hit', event.amount ?? 0);
        break;
      case 'crit':
        playSfx('crit');
        break;
      case 'death':
        playSfx('death');
        break;
      case 'souls':
        playSfx('soul');
        break;
      case 'level':
        playSfx('level');
        break;
      case 'throne':
        playSfx('throne');
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------ throne automation */

  /** How many expeditions may run at the same time? */
  get maxParallel(): number {
    return parallelExpeditions(this.save);
  }

  /** Start the background expeditions the throne ranks allow. */
  syncShadowRuns(): void {
    const wanted = Math.max(0, this.maxParallel - (this.state ? 1 : 0));
    while (this.shadowRuns.length > wanted) this.shadowRuns.pop();
    while (this.shadowRuns.length < wanted) {
      const zone = rotationZone(this.save);
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      const { state, ctx } = createRun({
        player: this.save.player,
        tree: this.save.tree,
        unlocked: this.save.unlocked,
        meta: this.save.meta,
        seed,
        zoneId: zone,
        runId: `shadow_${seed.toString(36)}`,
      });
      this.shadowRuns.push({ state, ctx, zoneId: zone });
    }
  }

  /** The background expeditions run in the background and pay out. */
  private stepShadowRuns(): void {
    if (this.shadowRuns.length === 0) return;
    this.accumulator = Math.min(this.accumulator, TICK_MS * 5);
    for (let i = this.shadowRuns.length - 1; i >= 0; i--) {
      const shadow = this.shadowRuns[i]!;
      step(shadow.state, shadow.ctx, 1, { policy: this.policy });
      if (shadow.state.phase === 'dead' || shadow.state.phase === 'victory') {
        this.collectShadowRun(shadow);
        this.shadowRuns.splice(i, 1);
        this.syncShadowRuns();
      }
    }
  }

  private collectShadowRun(shadow: { state: SimState; zoneId: number }): void {
    const save = this.save;
    const victory = shadow.state.phase === 'victory';
    this.store.update((s) => {
      s.player.souls += shadow.state.souls;
      s.stats.totalSoulsEarned += shadow.state.souls;
      s.stats.kills += shadow.state.kills;
      s.stats.nodesVisited += shadow.state.visitedNodeIds.length;
      s.stats.totalPlaySeconds += Math.round(shadow.state.tick / 10);
      if (victory) {
        // A shadow victory also secures the loot.
        for (const item of shadow.state.loot) {
          item.originRun = null;
          s.player.vault.push(item);
        }
        s.stats.victories += 1;
      }
    });
    if (hasFeature(save, 'throne_auto_equip')) {
      this.store.update((s) => {
        autoEquip(s);
      });
    }
  }

  /** Souls that trickle in while no expedition runs (Throne 6 and 9). */
  private grantIdleSouls(): void {
    const rate = idleSoulRate(this.save);
    const now = Date.now();
    const elapsed = now - this.lastIdleTick;
    if (elapsed < 1000) return;
    this.lastIdleTick = now;
    if (rate <= 0) return;
    if (this.state) return;
    const souls = (rate * elapsed) / 60000;
    this.store.update((s) => {
      s.player.souls += souls;
      s.stats.totalSoulsEarned += souls;
    });
  }

  /* ---------------------------------------------------------- run results */

  /** Apply the results of a finished run (death rules, rewards). */
  finishRun(): void {
    if (!this.state || !this.ctx) return;
    const state = this.state;
    const save = this.save;
    const victory = state.phase === 'victory';

    const seconds = Math.round(state.tick * (TICK_MS / 1000));

    // Loot: the vault is filled, but only a victory secures it.
    const { vaulted, scrapped } = sortRunLoot(state.loot, {
      scrapThreshold: save.settings.scrapThreshold,
      autoScrap: save.settings.autoScrap,
    });
    const secured = victory ? vaulted : [];

    this.store.update((s) => {
      s.player.souls += state.souls;
      s.stats.totalSoulsEarned += state.souls;
      s.stats.kills += state.kills;
      s.stats.nodesVisited += state.visitedNodeIds.length;
      s.stats.itemsFound += state.loot.length;
      s.stats.itemsVaulted += secured.length;
      s.stats.itemsScrapped += scrapped.length;
      s.stats.runsFinished += 1;
      s.stats.longestRunSeconds = Math.max(s.stats.longestRunSeconds, seconds);
      s.stats.deepestRun = Math.max(s.stats.deepestRun, state.depth);
      s.stats.bestSoulsRun = Math.max(s.stats.bestSoulsRun, state.souls);
      s.stats.totalPlaySeconds += seconds;

      if (victory) {
        s.player.vault.push(...secured);
        // The items become permanent once they are secured.
        for (const item of secured) item.originRun = null;
        s.player.throneRank = Math.max(s.player.throneRank, state.zoneId);
        s.player.highestZone = Math.max(s.player.highestZone, state.zoneId + 1);
        s.player.inheritance += BALANCE.inheritancePerThrone;
        s.stats.totalInheritanceEarned += BALANCE.inheritancePerThrone;
        const echo = BALANCE.echoPerRunBase + BALANCE.echoPerZone * state.zoneId + BALANCE.echoOnVictory;
        s.player.echo += echo;
        s.stats.totalEchoEarned += echo;
        s.stats.victories += 1;
        s.stats.bossKills += 1;
        if (s.stats.fastestThroneSeconds === 0 || seconds < s.stats.fastestThroneSeconds) {
          s.stats.fastestThroneSeconds = seconds;
        }
        s.player.storyChapter = Math.max(s.player.storyChapter, state.zoneId);
        ensureStoryContract(s.contracts, state.zoneId + 1);
      } else {
        // Death: the loadout survives, the loot of this run is lost.
        s.stats.deaths += 1;
        s.player.runSkillPoints = 0;
      }

      // Run skill points and the run level are run scope.
      s.player.runSkillPoints = victory ? s.player.runSkillPoints + state.hero.runSkillPoints : 0;
      s.player.level = Math.max(s.player.level, state.hero.level);
      s.run = null;
    });

    this.summary = {
      victory,
      zoneId: state.zoneId,
      depth: state.depth,
      nodesVisited: state.visitedNodeIds.length,
      kills: state.kills,
      souls: state.souls,
      echo: victory ? BALANCE.echoPerRunBase + BALANCE.echoPerZone * state.zoneId + BALANCE.echoOnVictory : 0,
      itemsKept: secured.length,
      itemsScrapped: scrapped.length,
      deathCause: state.deathCause,
      seconds,
      level: state.hero.level,
    };

    // Best runs.
    this.store.update((s) => {
      s.stats.bestRuns.unshift({
        runId: state.runId,
        classId: state.classId,
        zone: state.zoneId,
        depth: state.depth,
        throneRank: s.player.throneRank,
        seconds,
        souls: state.souls,
        kills: state.kills,
        build: state.classId,
        when: Date.now(),
      });
      s.stats.bestRuns = s.stats.bestRuns.slice(0, 5);
    });

    updateContractProgress(save);
    this.state = null;
    this.ctx = null;

    // The throne automations work on the result of the run.
    if (hasFeature(save, 'throne_auto_equip')) {
      this.store.update((s) => {
        autoEquip(s);
      });
    }
    if (hasFeature(save, 'throne_rune_binder')) {
      this.store.update((s) => {
        autoRerollAspects(s, secured);
      });
    }

    this.persist();
  }

  /** Ascend: the hard reset of the current incarnation. */
  ascend(): string {
    const result = ascend(this.save);
    if (result.ok) {
      this.state = null;
      this.ctx = null;
      this.shadowRuns = [];
      this.persist();
    }
    return result.message;
  }

  /** Start the next run automatically (auto retry). */
  autoRetry(): void {
    if (!this.save.player.autoRetry) return;
    const zone = Math.min(this.save.player.loadout.targetZone, this.save.player.highestZone);
    this.startRun(Math.max(1, zone));
  }

  /* ---------------------------------------------------------- offline */

  /** Handle the time the player was away. */
  async processOffline(elapsedMs: number): Promise<OfflineReport | null> {
    if (elapsedMs < BALANCE.offlineRealTicks * (TICK_MS / 1000)) return null;
    const save = this.save;
    const stored = save.run as SimState | null;
    if (!stored) {
      // No run in progress - the steward starts a new one.
      const zone = Math.min(save.player.loadout.targetZone, save.player.highestZone);
      this.startRun(Math.max(1, zone));
    }
    if (!this.state || !this.ctx) return null;
    const result = await runOffline(this.state, this.ctx, elapsedMs, { policy: this.policy });
    this.offlineReport = result.report;
    save.stats.totalOfflineSeconds += Math.round(elapsedMs / 1000);
    if (result.state.phase === 'dead' || result.state.phase === 'victory') {
      this.finishRun();
    }
    this.persist();
    return result.report;
  }

  /* ------------------------------------------------------------ misc */

  persist(): void {
    this.lastSaveAt = Date.now();
    if (this.state) this.save.run = this.state;
    this.store.persist();
  }

  /** Replace the whole save (import). */
  replaceSave(save: SaveFile): void {
    save.version = SAVE_VERSION;
    this.store.replace(save);
    this.state = null;
    this.ctx = null;
  }

  /** Item display helpers. */
  itemLabel(item: ItemRecord): string {
    return `${item.name} (${item.rarity})`;
  }

  itemColor(item: ItemRecord): string {
    return RARITY_COLORS[item.rarity] ?? '#ffffff';
  }

  /** Hash of the current run - used by the determinism test. */
  stateHash(): string {
    return this.state ? hashState(this.state) : '';
  }

  /** A compact share text for the best run. */
  shareText(): string {
    const best = this.save.stats.bestRuns[0];
    if (!best) return 'Godswar Pit - no run yet';
    return [
      `Godswar Pit - ${best.classId}`,
      `Zone ${best.zone} - depth ${best.depth}`,
      `${best.kills} kills in ${best.seconds}s`,
      `${formatNumber(best.souls)} souls`,
    ].join(' | ');
  }
}
