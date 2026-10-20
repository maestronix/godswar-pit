/**
 * Icon set.
 *
 * 16x16 pixel icons for items, skills, achievements and the hub tabs. Icons
 * are plain strings so they can be swapped for PNGs later without touching
 * the UI code.
 */
import { PALETTE } from './palette';

export interface Icon {
  palette: Record<string, string | null>;
  rows: string[];
  width: number;
  height: number;
}

const ICON_PALETTE: Record<string, string | null> = {
  '.': null,
  k: PALETTE.darkest,
  w: PALETTE.white,
  g: PALETTE.grey,
  s: PALETTE.slate,
  r: PALETTE.crimson,
  b: PALETTE.blood,
  o: PALETTE.orange,
  y: PALETTE.gold,
  c: PALETTE.cyan,
  n: PALETTE.navy,
  p: PALETTE.purple,
  m: PALETTE.magenta,
  e: PALETTE.amber,
  t: PALETTE.tan,
  l: PALETTE.lime,
  d: PALETTE.brown,
  v: PALETTE.violet,
};

function icon(rows: string[]): Icon {
  const height = rows.length;
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const padded = rows.map((row) => row.padEnd(width, '.'));
  return { palette: ICON_PALETTE, rows: padded, width, height };
}

/* ------------------------------------------------------------- item slots */

const SLOT_ICONS: Record<string, Icon> = {
  weapon: icon([
    '..........kkk...',
    '.........kwwwk..',
    '........kwwwwk..',
    '.......kwwwwk...',
    '......kwwwwk....',
    '.....kwwwwk.....',
    '....kwwwwk......',
    '...kwwwwk.......',
    '..kwwwwk........',
    '..kwwwk.........',
    '.kdwwwk.........',
    '.kddd k.........',
    '.kddk...........',
    '.kkk............',
    '................',
    '................',
  ]),
  armor: icon([
    '...kkkkkkkkk....',
    '..kwwwwwwwwwk...',
    '.kwwooooooowwk..',
    '.kwoyyyyyyowk...',
    '.kwoywwwwyowk...',
    '.kwoywk kwyowk..',
    '.kwoywk.kwyowk..',
    '.kwoywwwwyowk...',
    '.kwoyyyyyyowk...',
    '.kwoywwwwyowk...',
    '.kwoyywwwwyowk..',
    '.kwoyyyyyyowk...',
    '.kwooooooooowk..',
    '..kwwwwwwwwwk...',
    '...kkkkkkkkk....',
    '................',
  ]),
  boots: icon([
    '................',
    '..kkk.....kkk...',
    '.kwwwk....kwwwk..',
    '.kwwwk....kwwwk..',
    '.kwwwk....kwwwk..',
    '.kwwwk....kwwwk..',
    '.kwwwk....kwwwk..',
    '.kwwwk....kwwwk..',
    '.kwwwk....kwwwk..',
    '.kwwwwk..kwwwwk..',
    '.kwwwwk.kwwwwk...',
    '.kwwwwwkkwwwwwk..',
    '.kddddddddddddk..',
    '.kkkkkkkkkkkkkk..',
    '................',
    '................',
  ]),
  gloves: icon([
    '................',
    '....kk.kk........',
    '...kwwkwwk.......',
    '...kwwwwwwk......',
    '...kwwwwwwk......',
    '...kwwwwwwk......',
    '...kwwwwwwk......',
    '...kwwwwwwk......',
    '...kwwwwwwk......',
    '...kwwwwwwk......',
    '..kwwwwwwwwk.....',
    '..kwwwwwwwwk.....',
    '..kwwwwwwwwk.....',
    '..kkkkkkkkkk.....',
    '................',
    '................',
  ]),
  amulet: icon([
    '.....kkkkk......',
    '....kwwwwwk.....',
    '...kwkwwwkwk....',
    '..kwk.wwk.wk....',
    '..kwk.wwk.wk....',
    '...kwkkkkwk.....',
    '....kwwwwk......',
    '.....kwwk.......',
    '.....kyyk.......',
    '....kyyyk.......',
    '....kyyyk.......',
    '.....kyk........',
    '.....kyk........',
    '......k.........',
    '................',
    '................',
  ]),
  ring: icon([
    '................',
    '................',
    '.....kkkkk......',
    '....k.....k.....',
    '...k.......k....',
    '...k.......k....',
    '..kk..yy..kk...',
    '..k...yyy...k...',
    '..k...yyy...k...',
    '..k..yyyy..k....',
    '...k.....k......',
    '....k...k.......',
    '.....k.k........',
    '......k.........',
    '................',
    '................',
  ]),
};

/* ------------------------------------------------------------------ tabs */

const TAB_ICONS: Record<string, Icon> = {
  contracts: icon([
    '..kkkkkkkkkkkk..',
    '..kwwwwwwwwwwk..',
    '..kwkkkkkkkwwk..',
    '..kwk......kwwk.',
    '..kwk.wwww.kwwk.',
    '..kwk.wkkw.kwwk.',
    '..kwk.wkkw.kwwk.',
    '..kwk.wwww.kwwk.',
    '..kwk......kwwk.',
    '..kwkkkkkkkwwk..',
    '..kwwwwwwwwwwk..',
    '..kwwwwwwwwwwk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ]),
  smithy: icon([
    '................',
    '......kk........',
    '.....kwwk.......',
    '.....kwwk.......',
    '.....kwwk.......',
    '....kwwwwk......',
    '...kwwwwwwk.....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '.kwwwwwwwwwwk...',
    '.kwwwwwwwwwwk...',
    '.kwwwwwwwwwwk...',
    '..kkkkkkkkkkk...',
    '................',
    '................',
    '................',
  ]),
  envoy: icon([
    '.....kkkk.......',
    '....kwwwwk......',
    '....kwwwwk......',
    '....kwwwwk......',
    '....kwwwwk......',
    '....kwwwwk......',
    '....kwwwwk......',
    '.....kwwk.......',
    '....kwwwwk......',
    '...kwwwwwwk.....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '...kwwwwwwk.....',
    '....kkkkkkk.....',
    '................',
    '................',
  ]),
  grace: icon([
    '.......kk.......',
    '......kcck......',
    '.....kccck......',
    '....kcccck......',
    '...kcccccck.....',
    '..kcccccccck....',
    '..kccccccccck...',
    '..kccccccccck...',
    '..kccccccccck...',
    '..kccccccccck...',
    '..kkccccccckk...',
    '...kkccccckk....',
    '....kkccckk.....',
    '.....kkkkk......',
    '................',
    '................',
  ]),
  market: icon([
    '................',
    '...kkkkkkkk.....',
    '..kwwwwwwwwk....',
    '..kwkkkkkkwk....',
    '..kwwwwwwwwk....',
    '..kwwkkkkwwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kwkkkkkkwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kkkkkkkkkk....',
    '................',
    '................',
    '................',
    '................',
  ]),
  stats: icon([
    '................',
    '..k..........k..',
    '..k.k......k.k..',
    '..k.k.k...k.k...',
    '..k.k.k.k.k.k...',
    '..k.k.kkkk.k....',
    '..k.k.kkkk.k....',
    '..k.k.k.k.k.k...',
    '..k.k.k.k.k.k...',
    '..k.k.k.k.k.k...',
    '..kk.k.k.k.kk...',
    '....k.k.k.k.....',
    '....k.k.k.k.....',
    '....kk.k.kk.....',
    '................',
    '................',
  ]),
  achievements: icon([
    '.......kk.......',
    '......kyyk......',
    '.....kyyyyk.....',
    '.....kyyyyk.....',
    '......kyyk......',
    '.......kk.......',
    '.......kk.......',
    '......kcck......',
    '.....kcccck.....',
    '....kcccccck....',
    '....kcccccck....',
    '....kkcccckk....',
    '......kkkk......',
    '................',
    '................',
    '................',
  ]),
  tree: icon([
    '......kk........',
    '.....kppk.......',
    '....kp..pk......',
    '......kk........',
    '......kk........',
    '.....kppk.......',
    '....kp..pk......',
    '......kk........',
    '......kk........',
    '.....kppk.......',
    '....kp..pk......',
    '......kk........',
    '......kk........',
    '................',
    '................',
    '................',
  ]),
  inventory: icon([
    '..kkkkkkkkkkkk..',
    '..k..........k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..kkkkkkkkkkkk..',
    '..k..........k..',
    '..k.wwwwwwww.k..',
    '..k.wwwwwwww.k..',
    '..kkkkkkkkkkkk..',
    '................',
  ]),
};

export function slotIcon(slot: string): Icon {
  return SLOT_ICONS[slot] ?? SLOT_ICONS.weapon!;
}

export function tabIcon(tab: string): Icon {
  return TAB_ICONS[tab] ?? TAB_ICONS.stats!;
}

/** Draw an icon into a canvas context at the given pixel size. */
export function drawIcon(ctx: CanvasRenderingContext2D, source: Icon, x: number, y: number, scale = 1): void {
  for (let row = 0; row < source.rows.length; row++) {
    const line = source.rows[row]!;
    for (let col = 0; col < line.length; col++) {
      const key = line[col]!;
      if (key === '.') continue;
      const color = source.palette[key];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

/** Render an icon to a data URL (used by DOM UI). */
export function iconToDataUrl(source: Icon, scale = 1): string {
  const canvas = document.createElement('canvas');
  canvas.width = source.width * scale;
  canvas.height = source.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  drawIcon(ctx, source, 0, 0, scale);
  return canvas.toDataURL();
}
