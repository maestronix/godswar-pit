/**
 * UI smoke test.
 *
 * Boots the real application in a DOM and walks through the screens. It
 * catches the mistakes a type checker cannot see: a missing element, a
 * broken event handler, a screen that throws while rendering.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';

function setUpDom(): void {
  document.body.innerHTML = '<div id="app"><div id="boot" class="boot">Loading</div></div>';
  window.localStorage.clear();
  // jsdom has no canvas backend - the renderer must survive that.
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
}

describe('application boot', () => {
  beforeEach(() => {
    setUpDom();
  });

  it('boots and renders the hub', async () => {
    const { Game } = await import('../src/game');
    const game = new Game();
    game.init();
    const root = document.getElementById('app')!;
    root.innerHTML = '';
    const content = document.createElement('div');
    root.append(content);

    const { renderHub } = await import('../src/ui/hub/hub');
    renderHub(content, game);

    expect(content.textContent).toContain('GODSWAR PIT');
    expect(content.textContent).toContain('Expedition');
    expect(content.querySelectorAll('.tab').length).toBe(5);
  });

  it('renders every hub tab without throwing', async () => {
    const { Game } = await import('../src/game');
    const game = new Game();
    game.init();
    const content = document.createElement('div');

    const { renderContracts } = await import('../src/ui/hub/contracts');
    const { renderSmithy } = await import('../src/ui/hub/smithy');
    const { renderEnvoy } = await import('../src/ui/hub/envoy');
    const { renderGrace } = await import('../src/ui/hub/grace');
    const { renderMarket } = await import('../src/ui/hub/market');

    for (const render of [renderContracts, renderSmithy, renderEnvoy, renderGrace, renderMarket]) {
      content.innerHTML = '';
      expect(() => render(content, game)).not.toThrow();
      expect(content.children.length).toBeGreaterThan(0);
    }
  });

  it('renders the inventory, the trees, the stats and the achievements', async () => {
    const { Game } = await import('../src/game');
    const game = new Game();
    game.init();
    const content = document.createElement('div');

    const { renderInventory } = await import('../src/ui/inventory/inventory');
    const { renderSkillTrees } = await import('../src/ui/tree/skill-tree');
    const { renderStats } = await import('../src/ui/stats');
    const { renderAchievements } = await import('../src/ui/achievements/achievements');
    const { renderSettings } = await import('../src/ui/settings');

    for (const render of [renderInventory, renderSkillTrees, renderStats, renderAchievements, renderSettings]) {
      content.innerHTML = '';
      expect(() => render(content, game)).not.toThrow();
      expect(content.children.length).toBeGreaterThan(0);
    }
  });

  it('runs a full expedition and shows the run screen', async () => {
    const { Game } = await import('../src/game');
    const game = new Game();
    game.init();

    game.startRun(1);
    expect(game.state).toBeTruthy();
    expect(game.state!.phase).toBe('expedition');

    // The steward picks a room after the decision timeout.
    const { step } = await import('../src/sim/engine');
    const { DEFAULT_POLICY } = await import('../src/sim/policy');
    step(game.state!, game.ctx!, 120, { policy: DEFAULT_POLICY });
    expect(game.state!.visitedNodeIds.length).toBeGreaterThan(0);

    const content = document.createElement('div');
    const { renderRunScreen } = await import('../src/ui/run');
    expect(() => renderRunScreen(content, game)).not.toThrow();
    expect(content.querySelector('canvas')).toBeTruthy();
    expect(content.querySelector('.tree-svg')).toBeTruthy();
  });

  it('applies the death rules: gear survives, the loot of the run is lost', async () => {
    const { Game } = await import('../src/game');
    const game = new Game();
    game.init();
    game.startRun(1);
    const state = game.state!;

    // Fake some loot and a piece of equipment.
    state.loot.push({
      id: 'item_test',
      baseId: 'sword',
      slot: 'weapon',
      rarity: 'rare',
      itemLevel: 5,
      name: 'Test Sword',
      affixes: [],
      aspectId: null,
      originRun: state.runId,
      quality: 0.8,
    });
    game.store.update((s) => {
      s.player.equipped.weapon = {
        id: 'item_equipped',
        baseId: 'sword',
        slot: 'weapon',
        rarity: 'common',
        itemLevel: 1,
        name: 'Old Sword',
        affixes: [],
        aspectId: null,
        originRun: null,
        quality: 0.4,
      };
    });

    state.phase = 'dead';
    state.deathCause = 'Slain in battle';
    game.finishRun();

    expect(game.save.player.equipped.weapon?.id).toBe('item_equipped');
    expect(game.save.player.vault.find((v) => v.id === 'item_test')).toBeUndefined();
    expect(game.save.stats.deaths).toBe(1);
  });

  it('keeps the loot when the throne is taken', async () => {
    const { Game } = await import('../src/game');
    const game = new Game();
    game.init();
    game.startRun(1);
    const state = game.state!;
    state.loot.push({
      id: 'item_win',
      baseId: 'sword',
      slot: 'weapon',
      rarity: 'rare',
      itemLevel: 5,
      name: 'Win Sword',
      affixes: [],
      aspectId: null,
      originRun: state.runId,
      quality: 0.8,
    });
    state.phase = 'victory';
    state.bossDefeated = true;
    game.finishRun();

    expect(game.save.player.vault.find((v) => v.id === 'item_win')).toBeTruthy();
    expect(game.save.player.throneRank).toBe(1);
    expect(game.save.stats.victories).toBe(1);
  });
});
