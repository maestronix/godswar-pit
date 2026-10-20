/**
 * The colour palette.
 *
 * A fixed 32 colour scheme (DB32 inspired) plus one palette per zone. Item
 * rarities have their own colour codes so a legendary always looks legendary.
 */

export const PALETTE = {
  black: '#000000',
  darkest: '#1a1c2c',
  dark: '#2d2b55',
  purple: '#5b275d',
  violet: '#7b3f61',
  dusty: '#ab5236',
  orange: '#d0743a',
  sandy: '#e09256',
  tan: '#f0b27a',
  skin: '#f6d7b2',
  light: '#f9f871',
  white: '#f4f4f4',
  grey: '#8a8a8a',
  slate: '#5c5c6a',
  steel: '#3a3a44',
  blue: '#1c57a7',
  navy: '#143062',
  cyan: '#2e9cac',
  teal: '#1c6b6b',
  green: '#3a8a3a',
  lime: '#7ac74f',
  red: '#a5383b',
  crimson: '#d1454b',
  blood: '#7a2331',
  brown: '#7a5230',
  wood: '#a06a3c',
  gold: '#d9a72e',
  amber: '#e8c15a',
  bone: '#e8dcc4',
  shadow: '#3b2f4a',
  cyan2: '#5ccfe6',
  magenta: '#b34b8a',
} as const;

export type PaletteColor = keyof typeof PALETTE;

/** Rarity colours used across the whole UI. */
export const RARITY_COLORS = {
  common: '#9a9a9a',
  magic: '#5c8ae6',
  rare: '#e8c15a',
  legendary: '#e07a2c',
  mythic: '#c050d8',
} as const;

/** Zone palettes: floor, wall, edge, accent, fog. */
export interface ZonePalette {
  floor: string;
  floorAlt: string;
  wall: string;
  wallTop: string;
  edge: string;
  accent: string;
  fog: string;
  glow: string;
}

export const ZONE_PALETTES: Record<string, ZonePalette> = {
  ashvale: {
    floor: '#3a3340',
    floorAlt: '#443b4a',
    wall: '#241f2c',
    wallTop: '#4a4056',
    edge: '#5c5068',
    accent: '#d0743a',
    fog: '#1a1622',
    glow: '#f0b27a',
  },
  bone: {
    floor: '#4a4438',
    floorAlt: '#57503f',
    wall: '#2b2720',
    wallTop: '#6b6250',
    edge: '#8a7f66',
    accent: '#e8dcc4',
    fog: '#221f18',
    glow: '#f6eecf',
  },
  frost: {
    floor: '#2f4457',
    floorAlt: '#395068',
    wall: '#1b2a38',
    wallTop: '#4a6b85',
    edge: '#6d92ac',
    accent: '#5ccfe6',
    fog: '#16222e',
    glow: '#b7ecf7',
  },
  ember: {
    floor: '#4a2a24',
    floorAlt: '#57312a',
    wall: '#2a1714',
    wallTop: '#7a3a2c',
    edge: '#a34a30',
    accent: '#e09256',
    fog: '#1e100e',
    glow: '#ffc27a',
  },
  verdant: {
    floor: '#27402c',
    floorAlt: '#2f4d33',
    wall: '#18271b',
    wallTop: '#3f6b46',
    edge: '#548f5c',
    accent: '#7ac74f',
    fog: '#111c14',
    glow: '#b6f08a',
  },
  rust: {
    floor: '#4a3524',
    floorAlt: '#573d29',
    wall: '#2b1e14',
    wallTop: '#7a5230',
    edge: '#a06a3c',
    accent: '#d9a72e',
    fog: '#1c130c',
    glow: '#f5d183',
  },
  void: {
    floor: '#241f35',
    floorAlt: '#2b2540',
    wall: '#141024',
    wallTop: '#413a63',
    edge: '#5b5189',
    accent: '#b34b8a',
    fog: '#0c0916',
    glow: '#e59ad0',
  },
  obsidian: {
    floor: '#22222a',
    floorAlt: '#292932',
    wall: '#101015',
    wallTop: '#3c3c48',
    edge: '#55555f',
    accent: '#7b3f61',
    fog: '#08080c',
    glow: '#c79bd0',
  },
  gold: {
    floor: '#463a24',
    floorAlt: '#53462b',
    wall: '#2a2114',
    wallTop: '#7d6535',
    edge: '#b4924a',
    accent: '#e8c15a',
    fog: '#1a1409',
    glow: '#ffe9a8',
  },
  divine: {
    floor: '#3c3a4a',
    floorAlt: '#474456',
    wall: '#232230',
    wallTop: '#6f6a86',
    edge: '#948fb0',
    accent: '#f0b27a',
    fog: '#16151f',
    glow: '#fff3d0',
  },
};

export const DEFAULT_ZONE_PALETTE = ZONE_PALETTES.ashvale!;

export function zonePalette(name: string): ZonePalette {
  return ZONE_PALETTES[name] ?? DEFAULT_ZONE_PALETTE;
}

/** Convert "#rrggbb" to "rgba(r,g,b,a)". */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mix two hex colours, t = 0 -> a, t = 1 -> b. */
export function mixColor(a: string, b: string, t: number): string {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const r = Math.round(parseInt(pa.slice(0, 2), 16) * (1 - t) + parseInt(pb.slice(0, 2), 16) * t);
  const g = Math.round(parseInt(pa.slice(0, 2), 16) * (1 - t) + parseInt(pb.slice(2, 4), 16) * t);
  const bl = Math.round(parseInt(pa.slice(0, 2), 16) * (1 - t) + parseInt(pb.slice(4, 6), 16) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
