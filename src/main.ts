/**
 * Bootstrap and screen router.
 */
import './styles.css';
import { Game } from './game';
import { renderHub } from './ui/hub/hub';
import { renderRunScreen } from './ui/run';
import { renderInventory } from './ui/inventory/inventory';
import { renderSkillTrees } from './ui/tree/skill-tree';
import { renderAchievements } from './ui/achievements/achievements';
import { renderStats } from './ui/stats';
import { renderSettings } from './ui/settings';
import { renderOfflineReport } from './ui/offline-report/offline-report';
import { el } from './ui/dom';
import { showToast } from './ui/toast';
import { evaluateAchievements } from './state/achievements';
import { chip } from './audio/chip';

const app = document.getElementById('app');
if (!app) throw new Error('No #app element found');
const root: HTMLElement = app;

const game = new Game();
game.init();
window.addEventListener('pointerdown', () => chip.ensure(), { once: true });
window.addEventListener('keydown', () => chip.ensure(), { once: true });

const content = el('div', { class: 'content' });
const nav = el('nav', { class: 'navbar' });

function renderNav(): void {
  nav.innerHTML = '';
  const entries: { id: typeof game.screen; label: string }[] = [
    { id: 'hub', label: 'ASHVALE' },
    { id: 'inventory', label: 'INVENTORY' },
    { id: 'trees', label: 'SKILL TREES' },
    { id: 'achievements', label: 'ACHIEVEMENTS' },
    { id: 'stats', label: 'STATS' },
    { id: 'settings', label: 'SETTINGS' },
  ];
  for (const entry of entries) {
    const node = el('button', {
      class: `navbar__item${game.screen === entry.id ? ' navbar__item--active' : ''}`,
      type: 'button',
    }, [entry.label]);
    node.addEventListener('click', () => {
      if (game.state) game.persist();
      game.screen = entry.id;
    });
    nav.append(node);
  }
}

function render(): void {
  content.innerHTML = '';
  game.onRender = null;

  switch (game.screen) {
    case 'run':
      renderRunScreen(content, game);
      break;
    case 'trees':
      renderSkillTrees(content, game);
      break;
    case 'inventory':
      renderInventory(content, game);
      break;
    case 'achievements':
      renderAchievements(content, game);
      break;
    case 'stats':
      renderStats(content, game);
      break;
    case 'settings':
      renderSettings(content, game);
      break;
    case 'offline':
      if (game.offlineReport) renderOfflineReport(content, game, game.offlineReport);
      else game.screen = 'hub';
      break;
    case 'hub':
    default:
      renderHub(content, game);
      break;
  }

  renderNav();
  showAchievementToasts();
}

/** Toasts for the achievements that were unlocked in the last run. */
function showAchievementToasts(): void {
  const rewards = game.lastAchievements;
  if (rewards.length === 0) return;
  game.lastAchievements = [];
  for (const reward of rewards) {
    showToast(`Achievement: ${reward.name}`, `Reward: ${reward.reward}`);
  }
}

/* ------------------------------------------------------------- startup */

game.onScreenChange = () => render();

async function boot(): Promise<void> {
  root.innerHTML = '';
  root.append(nav, content);

  const save = game.save;
  const elapsed = Date.now() - (save.savedAt || Date.now());

  // Resume an interrupted run.
  if (save.run) {
    game.resumeRun();
  }

  // The offline simulation runs after the first frame so the page appears fast.
  if (elapsed > 60_000) {
    const report = await game.processOffline(elapsed);
    if (report) game.screen = 'offline';
  }

  const result = evaluateAchievements(game.save);
  if (result.unlocked.length > 0) game.persist();

  game.start();
  render();
}

boot().catch((error) => {
  console.error(error);
  root.innerHTML = '';
  root.append(
    el('div', { class: 'boot' }, [
      el('h1', { class: 'boot__title', text: 'GODSWAR PIT' }),
      el('p', { class: 'boot__hint', text: 'Something went wrong while starting the game.' }),
      el('pre', { class: 'boot__error', text: String(error) }),
    ]),
  );
});
