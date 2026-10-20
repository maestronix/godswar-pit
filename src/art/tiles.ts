/**
 * Tile drawing.
 *
 * The floor is generated from a base schema (floor, floor variant, cracks,
 * edges) plus the zone palette. Variation is seeded, so the same room always
 * looks the same.
 */
import { TILE, VIEW_HEIGHT, VIEW_WIDTH } from './renderer';
import type { ZonePalette } from './palette';
import { withAlpha } from './palette';

function hash(x: number, y: number, seed: number): number {
  let h = seed ^ (x * 374761393) ^ (y * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return h;
}

/** Draw the floor and the wall band. */
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  palette: ZonePalette,
  tick: number,
  reducedMotion: boolean,
): void {
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const seed = Math.floor(tick / 10) % 9973;

  const cols = Math.ceil(VIEW_WIDTH / TILE) + 2;
  const rows = Math.ceil(VIEW_HEIGHT / TILE) + 2;
  const startCol = Math.floor(-originX / TILE) - 1;
  const startRow = Math.floor(-originY / TILE) - 1;

  for (let row = startRow; row < startRow + rows; row++) {
    for (let col = startCol; col < startCol + cols; col++) {
      const px = originX + col * TILE;
      const py = originY + row * TILE;
      const h = hash(col, row, seed);

      if (h % 5 === 0) {
        ctx.fillStyle = palette.floorAlt;
        ctx.fillRect(px, py, TILE, TILE);
      }
      if (h % 11 === 0) {
        // Crack.
        ctx.fillStyle = withAlpha(palette.wall, 0.7);
        ctx.fillRect(px + 3 + (h % 7), py + 4 + (h % 5), 1, 6);
        ctx.fillRect(px + 4 + (h % 7), py + 9 + (h % 5), 4, 1);
      }
      if (h % 17 === 0) {
        // Bone / rubble.
        ctx.fillStyle = withAlpha(palette.glow, 0.25);
        ctx.fillRect(px + 2 + (h % 9), py + 2 + (h % 11), 2, 2);
      }
      if (h % 23 === 0) {
        ctx.fillStyle = withAlpha(palette.accent, 0.14);
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }

  // Wall band at the top of the screen.
  const wallHeight = 18;
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, VIEW_WIDTH, wallHeight);
  ctx.fillStyle = palette.wallTop;
  ctx.fillRect(0, 0, VIEW_WIDTH, 3);
  for (let x = 0; x < VIEW_WIDTH; x += TILE) {
    const h = hash(x / TILE, 0, seed + 7);
    ctx.fillStyle = withAlpha(palette.edge, 0.5);
    ctx.fillRect(x + (h % 6), 3, 1, wallHeight - 4);
    if (h % 4 === 0) {
      // Torch.
      const flicker = reducedMotion ? 0 : Math.floor(tick / 6) % 3;
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x + 6, 4 + flicker, 2, 3);
      ctx.fillStyle = palette.glow;
      ctx.fillRect(x + 6, 4 + flicker, 1, 2);
      ctx.fillStyle = withAlpha(palette.glow, 0.12);
      ctx.fillRect(x + 2, 2, 10, 12);
    }
  }
}
