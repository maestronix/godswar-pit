/**
 * Canvas renderer.
 *
 * The scene is drawn at 480x270 and scaled up by CSS with
 * `image-rendering: pixelated`, so every pixel stays square.
 */
import { Content } from '../data/registry';
import type { SimState } from '../sim/types';
import { CLASS_SPRITES, DEFAULT_CREATURE, bossFor, creatureFor, frameIndex, type CreatureBody, type Sprite } from './sprites';
import { zonePalette, withAlpha } from './palette';
import { drawTiles } from './tiles';
import { ParticleSystem } from './fx';

export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 270;
export const TILE = 16;

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface RenderState {
  particles: ParticleSystem;
  texts: FloatingText[];
  shake: number;
  flash: number;
  frame: number;
  lastAttack: number;
}

export function createRenderState(): RenderState {
  return {
    particles: new ParticleSystem(),
    texts: [],
    shake: 0,
    flash: 0,
    frame: 0,
    lastAttack: -999,
  };
}

/** Draw a sprite frame at a pixel position. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  frame: number,
  flip = false,
): void {
  const source = sprite.frames[Math.max(0, Math.min(sprite.frames.length - 1, frame))];
  if (!source) return;
  const rows = source.split('\n');
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row]!;
    for (let col = 0; col < line.length; col++) {
      const key = line[col]!;
      if (key === '.') continue;
      const color = sprite.palette[key];
      if (!color) continue;
      const px = flip ? x - (col + 1) : x + col;
      ctx.fillStyle = color;
      ctx.fillRect(px, y + row, 1, 1);
    }
  }
}

function spriteForEnemy(defId: string, kind: 'normal' | 'elite' | 'boss', tier: number): Sprite {
  if (kind === 'boss') {
    const palette = zonePalette('divine');
    return bossFor(palette.accent, palette.wall, palette.glow);
  }
  const def = Content.enemies.get(defId);
  const body = bodyForDef(def?.sprite ?? '', def?.traits ?? []);
  const palette = zonePalette(Content.zone(tier)?.palette ?? 'ashvale');
  return creatureFor(defId, body, palette.accent, palette.wall, palette.edge);
}

function bodyForDef(spriteId: string, traits: string[]): CreatureBody {
  const id = spriteId.toLowerCase();
  if (traits.includes('flying')) return 'flyer';
  if (traits.includes('undead')) return 'skeleton';
  if (traits.includes('boss')) return 'construct';
  if (id.includes('wraith') || id.includes('spirit') || id.includes('ghost')) return 'wraith';
  if (id.includes('beast') || id.includes('crawler') || id.includes('beast') || id.includes('hound')) return 'quad';
  if (id.includes('blob') || id.includes('ooze') || id.includes('slime') || id.includes('rot')) return 'blob';
  if (id.includes('construct') || id.includes('idol') || id.includes('golem')) return 'construct';
  return 'biped';
}

export interface SceneOptions {
  state: SimState;
  render: RenderState;
  showDamageNumbers: boolean;
  reducedMotion: boolean;
}

/** Draw one frame of the expedition scene. */
export function drawScene(ctx: CanvasRenderingContext2D, options: SceneOptions): void {
  const { state, render } = options;
  const zone = Content.zone(state.zoneId) ?? Content.zones[0]!;
  const palette = zonePalette(zone.palette);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Screen shake.
  if (render.shake > 0 && !options.reducedMotion) {
    const amount = render.shake;
    ctx.translate(
      Math.round((Math.random() - 0.5) * amount),
      Math.round((Math.random() - 0.5) * amount),
    );
  }

  const cameraX = state.hero.x;
  const cameraY = state.hero.y;
  const originX = Math.round(VIEW_WIDTH / 2 - cameraX * TILE);
  const originY = Math.round(VIEW_HEIGHT / 2 - cameraY * TILE);

  drawTiles(ctx, originX, originY, palette, state.tick, options.reducedMotion);

  // Sort by depth so that overlapping sprites look right.
  const drawables: { y: number; draw: () => void }[] = [];

  for (const enemy of state.enemies) {
    if (!enemy.alive && !enemy.minion) continue;
    if (enemy.side === 'hero' && !enemy.minion) continue;
    const sprite = enemy.minion
      ? creatureFor('minion', 'wraith', '#b34b8a', '#241f35', '#e59ad0')
      : spriteForEnemy(enemy.defId, enemy.kind, state.zoneId);
    const width = sprite.width;
    const height = sprite.height;
    const px = originX + Math.round(enemy.x * TILE) - Math.floor(width / 2);
    const py = originY + Math.round(enemy.y * TILE) - height + Math.floor(TILE * 0.5);
    const isHeroSide = enemy.side === 'hero';
    const anim = !enemy.alive ? 'death' : state.phase === 'battle' ? 'walk' : 'idle';
    const frame = frameIndex(anim as 'idle', render.frame, isHeroSide ? 0 : 2);
    drawables.push({
      y: enemy.y,
      draw: () => {
        if (!enemy.alive) {
          ctx.globalAlpha = 0.55;
        }
        drawSprite(ctx, sprite, px, py, frame);
        ctx.globalAlpha = 1;
      },
    });
  }

  const heroSprite = CLASS_SPRITES[state.classId] ?? CLASS_SPRITES.bladewalker!;
  const heroPx = originX + Math.round(state.hero.x * TILE) - Math.floor(heroSprite.width / 2);
  const heroPy = originY + Math.round(state.hero.y * TILE) - heroSprite.height + Math.floor(TILE * 0.5);
  const heroFrame = frameIndex('idle', render.frame, state.hero.facing as 0 | 1 | 2 | 3);
  drawables.push({
    y: state.hero.y,
    draw: () => {
      drawSprite(ctx, heroSprite, heroPx, heroPy, heroFrame, state.hero.facing === 1);
      // Health pip under the hero.
      const hpRatio = Math.max(0, state.hero.hp / Math.max(1, state.hero.maxHp));
      ctx.fillStyle = withAlpha('#000000', 0.6);
      ctx.fillRect(heroPx + 1, heroPy + heroSprite.height, 14, 2);
      ctx.fillStyle = hpRatio > 0.5 ? '#7ac74f' : hpRatio > 0.25 ? '#e8c15a' : '#d1454b';
      ctx.fillRect(heroPx + 1, heroPy + heroSprite.height, Math.round(14 * hpRatio), 2);
    },
  });

  drawables.sort((a, b) => a.y - b.y);
  for (const drawable of drawables) drawable.draw();

  // Particles and floating text.
  render.particles.draw(ctx, originX, originY);
  if (options.showDamageNumbers) {
    for (const text of render.texts) {
      const alpha = Math.max(0, Math.min(1, text.life / text.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = text.color;
      ctx.font = `${text.size}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(text.text, originX + text.x * TILE, originY + text.y * TILE);
      ctx.globalAlpha = 1;
    }
  }

  // Fog / darkness overlay.
  const gradient = ctx.createRadialGradient(
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    40,
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2,
    260,
  );
  gradient.addColorStop(0, withAlpha(palette.fog, 0));
  gradient.addColorStop(1, withAlpha(palette.fog, 0.55));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  if (render.flash > 0) {
    ctx.fillStyle = withAlpha('#f4f4f4', Math.min(0.5, render.flash));
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    render.flash = Math.max(0, render.flash - 0.08);
  }

  ctx.restore();
}

/** Advance the visual state (particles, text, shake). */
export function updateRenderState(render: RenderState, reducedMotion: boolean): void {
  render.frame++;
  render.particles.update(reducedMotion ? 0.4 : 1);
  for (let i = render.texts.length - 1; i >= 0; i--) {
    const text = render.texts[i]!;
    text.life -= 1;
    text.y -= 0.012;
    if (text.life <= 0) render.texts.splice(i, 1);
  }
  if (render.shake > 0) render.shake = Math.max(0, render.shake - 0.6);
}

/** Convert a simulation event into visual feedback. */
export function handleEvent(render: RenderState, event: { type: string; x?: number; y?: number; amount?: number; text?: string; targetId?: string }, showDamageNumbers: boolean, reducedMotion: boolean): void {
  const x = event.x ?? 0;
  const y = event.y ?? 0;
  switch (event.type) {
    case 'damage':
    case 'crit':
      if (showDamageNumbers) {
        render.texts.push({
          x,
          y,
          text: `${event.amount ?? 0}`,
          color: event.type === 'crit' ? '#f0b27a' : '#f4f4f4',
          life: 40,
          maxLife: 40,
          size: event.type === 'crit' ? 8 : 6,
        });
      }
      if (!reducedMotion) render.shake = Math.min(4, render.shake + (event.type === 'crit' ? 2.5 : 0.8));
      render.particles.spawnHit(x, y, event.type === 'crit' ? 8 : 4);
      break;
    case 'heal':
      if (showDamageNumbers) {
        render.texts.push({ x, y, text: `+${event.amount ?? 0}`, color: '#7ac74f', life: 40, maxLife: 40, size: 6 });
      }
      break;
    case 'death':
      render.particles.spawnDeath(x, y);
      break;
    case 'souls':
      render.particles.spawnSouls(x, y);
      if (showDamageNumbers) {
        render.texts.push({ x, y, text: `+${event.amount ?? 0} souls`, color: '#5ccfe6', life: 50, maxLife: 50, size: 6 });
      }
      break;
    case 'loot':
      render.particles.spawnLoot(x, y);
      break;
    case 'level':
      render.flash = 0.3;
      break;
    default:
      break;
  }
}

export { DEFAULT_CREATURE };
