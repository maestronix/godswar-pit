/**
 * Procedural pixel art.
 *
 * A sprite is a palette plus a list of frames. Every frame is a string where
 * one character is one pixel and "\n" separates the rows. The renderer only
 * needs `drawSprite`, so a PNG pipeline could replace this later without
 * touching any game logic.
 */

export interface Sprite {
  palette: Record<string, string | null>;
  frames: string[];
  width: number;
  height: number;
}

const TRANSPARENT = '.';

/* ------------------------------------------------------------------ grid */

export class Grid {
  readonly width: number;
  readonly height: number;
  private readonly cells: string[];

  constructor(width: number, height: number, fill = TRANSPARENT) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(fill);
  }

  set(x: number, y: number, color: string): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.cells[y * this.width + x] = color;
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return TRANSPARENT;
    return this.cells[y * this.width + x]!;
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }

  frame(x: number, y: number, w: number, h: number, color: string): void {
    for (let i = 0; i < w; i++) {
      this.set(x + i, y, color);
      this.set(x + i, y + h - 1, color);
    }
    for (let j = 0; j < h; j++) {
      this.set(x, y + j, color);
      this.set(x + w - 1, y + j, color);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, color);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Mirror the grid horizontally (used to derive the left facing). */
  mirrored(): Grid {
    const out = new Grid(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        out.set(this.width - 1 - x, y, this.get(x, y));
      }
    }
    return out;
  }

  toFrame(): string {
    const rows: string[] = [];
    for (let y = 0; y < this.height; y++) {
      let row = '';
      for (let x = 0; x < this.width; x++) row += this.get(x, y);
      rows.push(row);
    }
    return rows.join('\n');
  }
}

export interface Palette {
  [key: string]: string | null;
}

export function sprite(width: number, height: number, palette: Palette, frames: Grid[]): Sprite {
  return { palette, frames: frames.map((f) => f.toFrame()), width, height };
}

/* -------------------------------------------------------------- humanoid */

export interface HumanoidOptions {
  /** Main body colour. */
  body: string;
  /** Skin colour. */
  skin: string;
  /** Hair / helmet colour. */
  hair: string;
  /** Boots / legs colour. */
  boots: string;
  /** Weapon colour, `null` for no weapon. */
  weapon?: string | null;
  /** Trim / accent colour. */
  accent?: string;
}

type Pose = 'idle' | 'walk' | 'attack' | 'hit' | 'death';

const HERO_W = 16;
const HERO_H = 24;

function drawHumanoid(grid: Grid, opts: HumanoidOptions, pose: Pose, frame: number, facing: 'front' | 'back' | 'side'): void {
  const { body, skin, hair, boots } = opts;
  const accent = opts.accent ?? body;
  const weapon = opts.weapon ?? null;

  const cx = Math.floor(HERO_W / 2);

  // Death frames: the body sinks and rotates away.
  if (pose === 'death') {
    const drop = frame * 3;
    const width = 12 - frame * 2;
    grid.rect(cx - width / 2, HERO_H - 7 - drop, width, 5, body);
    grid.rect(cx - 3, HERO_H - 9 - drop, 6, 3, skin);
    grid.rect(cx - 3, HERO_H - 10 - drop, 6, 2, hair);
    grid.rect(cx - width / 2, HERO_H - 3 - drop, width, 2, boots);
    return;
  }

  // Head.
  grid.rect(cx - 3, 2, 6, 6, skin);
  grid.rect(cx - 3, 1, 6, 2, hair);
  if (facing === 'front') {
    grid.set(cx - 2, 4, 'k');
    grid.set(cx + 1, 4, 'k');
    grid.rect(cx - 1, 6, 2, 1, accent);
  } else if (facing === 'back') {
    grid.rect(cx - 3, 1, 6, 5, hair);
  } else {
    grid.set(cx + 1, 4, 'k');
  }

  // Torso.
  const torsoTop = 8;
  const torsoHeight = 9;
  grid.rect(cx - 3, torsoTop, 6, torsoHeight, body);
  grid.rect(cx - 3, torsoTop, 6, 1, accent);
  if (facing !== 'back') grid.rect(cx - 1, torsoTop + 2, 2, torsoHeight - 4, accent);

  // Arms.
  const armSwing =
    pose === 'walk' ? [0, 1, 0, -1][frame % 4]! : pose === 'attack' ? [2, 3][frame % 2]! : pose === 'hit' ? -1 : 0;
  grid.rect(cx - 5, torsoTop + 1 + Math.max(0, armSwing), 2, 6, body);
  grid.rect(cx + 3, torsoTop + 1 + Math.max(0, -armSwing), 2, 6, body);

  // Legs.
  const legTop = torsoTop + torsoHeight;
  let legOffset = 0;
  if (pose === 'walk') {
    legOffset = [0, 1, 0, -1][frame % 4]!;
  } else if (pose === 'hit') {
    legOffset = -1;
  }
  grid.rect(cx - 3, legTop, 2, 5 - Math.abs(legOffset), boots);
  grid.rect(cx + 1, legTop, 2, 5 - Math.abs(legOffset), boots);
  if (legOffset > 0) grid.rect(cx + 1, legTop + 5, 2, 1, boots);
  if (legOffset < 0) grid.rect(cx - 3, legTop + 5, 2, 1, boots);

  // Weapon in the right hand.
  if (weapon) {
    if (pose === 'attack') {
      const swing = frame === 0 ? -6 : 2;
      grid.line(cx + 4, torsoTop + 2, cx + 4 + swing, torsoTop - 2, weapon);
      grid.set(cx + 4 + swing, torsoTop - 3, accent);
    } else {
      const offset = pose === 'walk' ? [0, 1, 0, -1][frame % 4]! : 0;
      grid.line(cx + 4, torsoTop + 1 + offset, cx + 4, torsoTop - 4, weapon);
      grid.set(cx + 4, torsoTop - 5, accent);
    }
  }

  if (pose === 'hit') {
    grid.set(cx - 4, torsoTop + 3, 'w');
    grid.set(cx + 4, torsoTop + 2, 'w');
  }
}

/** A 16x24 humanoid with idle / walk / attack / hit / death frames. */
export function humanoidSprite(opts: HumanoidOptions): Sprite {
  const palette: Palette = {
    '.': null,
    k: '#101018',
    w: '#f4f4f4',
  };
  const faces: ('front' | 'back' | 'side')[] = ['front', 'back', 'side'];
  const frames: Grid[] = [];

  for (const facing of faces) {
    for (let i = 0; i < 2; i++) {
      const grid = new Grid(HERO_W, HERO_H);
      drawHumanoid(grid, opts, 'idle', i, facing);
      frames.push(grid);
    }
    for (let i = 0; i < 4; i++) {
      const grid = new Grid(HERO_W, HERO_H);
      drawHumanoid(grid, opts, 'walk', i, facing);
      frames.push(grid);
    }
    for (let i = 0; i < 2; i++) {
      const grid = new Grid(HERO_W, HERO_H);
      drawHumanoid(grid, opts, 'attack', i, facing);
      frames.push(grid);
    }
    const hit = new Grid(HERO_W, HERO_H);
    drawHumanoid(hit, opts, 'hit', 0, facing);
    frames.push(hit);
    for (let i = 0; i < 3; i++) {
      const grid = new Grid(HERO_W, HERO_H);
      drawHumanoid(grid, opts, 'death', i, facing);
      frames.push(grid);
    }
  }

  // The left facing is the mirrored side facing.
  const sideStart = 2 * 12;
  for (let i = 0; i < 12; i++) {
    frames.push(frames[sideStart + i]!.mirrored());
  }

  return sprite(HERO_W, HERO_H, palette, frames);
}

/* -------------------------------------------------------------- creature */

export type CreatureBody = 'blob' | 'biped' | 'quad' | 'flyer' | 'skeleton' | 'wraith' | 'construct';

export interface CreatureOptions {
  body: CreatureBody;
  main: string;
  dark: string;
  light: string;
  eye?: string;
}

const CREATURE_W = 16;
const CREATURE_H = 16;

function drawCreature(grid: Grid, opts: CreatureOptions, frame: number, dead: boolean): void {
  const { main, dark, light } = opts;
  const eye = opts.eye ?? '#f0b27a';
  const bob = frame % 2 === 0 ? 0 : 1;

  if (dead) {
    grid.rect(3, 12, 10, 3, dark);
    grid.rect(4, 11, 8, 2, main);
    return;
  }

  switch (opts.body) {
    case 'blob': {
      grid.rect(3, 6 + bob, 10, 7, main);
      grid.rect(4, 5 + bob, 8, 2, light);
      grid.rect(5, 13 + bob, 6, 2, dark);
      grid.set(6, 8 + bob, eye);
      grid.set(9, 8 + bob, eye);
      break;
    }
    case 'biped': {
      grid.rect(5, 2 + bob, 6, 5, main);
      grid.rect(5, 1 + bob, 6, 2, light);
      grid.rect(3, 7 + bob, 10, 5, main);
      grid.rect(4, 12 + bob, 3, 3, dark);
      grid.rect(9, 12 + bob, 3, 3, dark);
      grid.set(6, 4 + bob, eye);
      grid.set(9, 4 + bob, eye);
      break;
    }
    case 'quad': {
      grid.rect(2, 5 + bob, 12, 6, main);
      grid.rect(4, 4 + bob, 8, 2, light);
      grid.rect(2, 11 + bob, 2, 4, dark);
      grid.rect(6, 11 + bob, 2, 4, dark);
      grid.rect(10, 11 + bob, 2, 4, dark);
      grid.set(4, 7 + bob, eye);
      grid.set(10, 7 + bob, eye);
      break;
    }
    case 'flyer': {
      const flap = frame % 2 === 0 ? 0 : 2;
      grid.rect(5, 5 + bob, 6, 6, main);
      grid.rect(1, 4 + flap, 4, 3, light);
      grid.rect(11, 4 + flap, 4, 3, light);
      grid.rect(6, 3 + bob, 4, 3, light);
      grid.set(6, 6 + bob, eye);
      grid.set(9, 6 + bob, eye);
      break;
    }
    case 'skeleton': {
      grid.rect(5, 2 + bob, 6, 5, light);
      grid.rect(5, 1 + bob, 6, 2, dark);
      grid.rect(4, 7 + bob, 8, 4, light);
      grid.rect(3, 8 + bob, 2, 4, light);
      grid.rect(11, 8 + bob, 2, 4, light);
      grid.rect(5, 11 + bob, 2, 4, light);
      grid.rect(9, 11 + bob, 2, 4, light);
      grid.set(6, 4 + bob, '#101018');
      grid.set(9, 4 + bob, '#101018');
      break;
    }
    case 'wraith': {
      grid.rect(4, 3 + bob, 8, 6, main);
      grid.rect(3, 9 + bob, 10, 4, dark);
      grid.rect(5, 13 + bob, 2, 3, main);
      grid.rect(9, 13 + bob, 2, 3, main);
      grid.set(6, 5 + bob, eye);
      grid.set(9, 5 + bob, eye);
      break;
    }
    case 'construct':
    default: {
      grid.rect(3, 3 + bob, 10, 9, main);
      grid.rect(3, 3 + bob, 10, 2, light);
      grid.rect(4, 6 + bob, 8, 3, dark);
      grid.rect(2, 12 + bob, 3, 3, dark);
      grid.rect(11, 12 + bob, 3, 3, dark);
      grid.set(5, 7 + bob, eye);
      grid.set(10, 7 + bob, eye);
      break;
    }
  }
}

export function creatureSprite(opts: CreatureOptions): Sprite {
  const palette: Palette = { '.': null, k: '#101018', w: '#f4f4f4' };
  const frames: Grid[] = [];
  for (let i = 0; i < 2; i++) {
    const grid = new Grid(CREATURE_W, CREATURE_H);
    drawCreature(grid, opts, i, false);
    frames.push(grid);
  }
  for (let i = 0; i < 4; i++) {
    const grid = new Grid(CREATURE_W, CREATURE_H);
    drawCreature(grid, opts, i, false);
    frames.push(grid);
  }
  for (let i = 0; i < 2; i++) {
    const grid = new Grid(CREATURE_W, CREATURE_H);
    drawCreature(grid, opts, i, false);
    frames.push(grid);
  }
  const hit = new Grid(CREATURE_W, CREATURE_H);
  drawCreature(hit, opts, 0, false);
  frames.push(hit);
  for (let i = 0; i < 3; i++) {
    const grid = new Grid(CREATURE_W, CREATURE_H);
    drawCreature(grid, opts, i, true);
    frames.push(grid);
  }
  return sprite(CREATURE_W, CREATURE_H, palette, frames);
}

/* ------------------------------------------------------------------ boss */

const BOSS_W = 32;
const BOSS_H = 32;

export function bossSprite(opts: { main: string; dark: string; light: string; eye?: string }): Sprite {
  const palette: Palette = { '.': null, k: '#101018', w: '#f4f4f4' };
  const eye = opts.eye ?? '#f0b27a';
  const frames: Grid[] = [];
  for (let i = 0; i < 2; i++) {
    const grid = new Grid(BOSS_W, BOSS_H);
    drawBoss(grid, opts, i, false, eye);
    frames.push(grid);
  }
  for (let i = 0; i < 4; i++) {
    const grid = new Grid(BOSS_W, BOSS_H);
    drawBoss(grid, opts, i, false, eye);
    frames.push(grid);
  }
  for (let i = 0; i < 2; i++) {
    const grid = new Grid(BOSS_W, BOSS_H);
    drawBoss(grid, opts, i, false, eye);
    frames.push(grid);
  }
  const hit = new Grid(BOSS_W, BOSS_H);
  drawBoss(hit, opts, 0, false, eye);
  frames.push(hit);
  for (let i = 0; i < 3; i++) {
    const grid = new Grid(BOSS_W, BOSS_H);
    drawBoss(grid, opts, i, true, eye);
    frames.push(grid);
  }
  return sprite(BOSS_W, BOSS_H, palette, frames);
}

function drawBoss(grid: Grid, opts: { main: string; dark: string; light: string }, frame: number, dead: boolean, eye: string): void {
  const { main, dark, light } = opts;
  if (dead) {
    grid.rect(2, 26, 28, 5, dark);
    grid.rect(5, 22, 22, 5, main);
    return;
  }
  const bob = frame % 2 === 0 ? 0 : 1;
  // Horns.
  grid.line(8, 6 + bob, 5, 1 + bob, light);
  grid.line(23, 6 + bob, 26, 1 + bob, light);
  // Head.
  grid.rect(9, 4 + bob, 14, 9, main);
  grid.rect(9, 3 + bob, 14, 3, light);
  grid.set(12, 7 + bob, eye);
  grid.set(19, 7 + bob, eye);
  grid.rect(12, 10 + bob, 8, 2, dark);
  // Body.
  grid.rect(6, 13 + bob, 20, 12, main);
  grid.rect(6, 13 + bob, 20, 2, light);
  grid.rect(10, 17 + bob, 12, 5, dark);
  // Arms.
  grid.rect(2, 15 + bob, 4, 10, main);
  grid.rect(26, 15 + bob, 4, 10, main);
  // Legs.
  grid.rect(8, 25 + bob, 6, 6, dark);
  grid.rect(18, 25 + bob, 6, 6, dark);
}

/* ---------------------------------------------------------------- sprites */

/** Sprites of the six player classes. */
export const CLASS_SPRITES: Record<string, Sprite> = {
  bladewalker: humanoidSprite({
    body: '#a5383b',
    skin: '#f6d7b2',
    hair: '#3a2a20',
    boots: '#3a3a44',
    weapon: '#c9ced8',
    accent: '#d9a72e',
  }),
  ashmonk: humanoidSprite({
    body: '#e09256',
    skin: '#f0b27a',
    hair: '#f4f4f4',
    boots: '#7a5230',
    weapon: '#a06a3c',
    accent: '#f6d7b2',
  }),
  pitsorcer: humanoidSprite({
    body: '#1c57a7',
    skin: '#e8dcc4',
    hair: '#5ccfe6',
    boots: '#143062',
    weapon: '#5ccfe6',
    accent: '#9fdcff',
  }),
  ironpriest: humanoidSprite({
    body: '#d9a72e',
    skin: '#f6d7b2',
    hair: '#f0b27a',
    boots: '#7a5230',
    weapon: '#c9ced8',
    accent: '#f4f4f4',
  }),
  plagueborn: humanoidSprite({
    body: '#3a8a3a',
    skin: '#8fae7a',
    hair: '#1b1b20',
    boots: '#241f2c',
    weapon: '#7ac74f',
    accent: '#b6f08a',
  }),
  soulbinder: humanoidSprite({
    body: '#241f35',
    skin: '#b34b8a',
    hair: '#5b275d',
    boots: '#141024',
    weapon: '#b34b8a',
    accent: '#e59ad0',
  }),
};

/** Fallback sprite for enemies that have no dedicated art. */
export const DEFAULT_CREATURE = creatureSprite({ body: 'biped', main: '#5c5c6a', dark: '#3a3a44', light: '#8a8a8a' });

const creatureCache = new Map<string, Sprite>();

export function creatureFor(_defId: string, body: CreatureBody, main: string, dark: string, light: string): Sprite {
  const key = `${body}:${main}:${dark}:${light}`;
  const cached = creatureCache.get(key);
  if (cached) return cached;
  const created = creatureSprite({ body, main, dark, light });
  creatureCache.set(key, created);
  return created;
}

const bossCache = new Map<string, Sprite>();

export function bossFor(main: string, dark: string, light: string): Sprite {
  const key = `${main}:${dark}:${light}`;
  const cached = bossCache.get(key);
  if (cached) return cached;
  const created = bossSprite({ main, dark, light });
  bossCache.set(key, created);
  return created;
}

/* --------------------------------------------------------------- frames */

/** Frame layout of a humanoid sprite. */
export const HERO_FRAME_COUNT = 12;
export const CREATURE_FRAME_COUNT = 12;

/** Index of a frame inside a sprite for a given animation state. */
export function frameIndex(state: 'idle' | 'walk' | 'attack' | 'hit' | 'death', frame: number, facing: 0 | 1 | 2 | 3): number {
  const faceIndex = facing === 3 ? 2 : facing === 1 ? 3 : facing === 2 ? 1 : 0;
  const base = faceIndex * HERO_FRAME_COUNT;
  switch (state) {
    case 'idle':
      return base + (frame % 2);
    case 'walk':
      return base + 2 + (frame % 4);
    case 'attack':
      return base + 6 + (frame % 2);
    case 'hit':
      return base + 8;
    case 'death':
      return base + 9 + Math.min(2, frame);
    default:
      return base;
  }
}
