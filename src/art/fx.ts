/**
 * Particle system.
 *
 * A small pool of particles for hits, deaths, loot and soul sparks. The
 * particles live in world (tile) coordinates so the camera can be applied
 * when drawing.
 */
import { TILE } from './renderer';
import { withAlpha } from './palette';

export type ParticleKind = 'spark' | 'dust' | 'blood' | 'soul' | 'loot' | 'ring';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: ParticleKind;
}

const MAX_PARTICLES = 400;

export class ParticleSystem {
  private particles: Particle[] = [];

  get count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles.length = 0;
  }

  private push(particle: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(particle);
  }

  spawnHit(x: number, y: number, amount: number): void {
    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2 + Math.random() * 0.6;
      const speed = 0.04 + Math.random() * 0.09;
      this.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.02,
        life: 14 + Math.random() * 10,
        maxLife: 24,
        color: i % 3 === 0 ? '#f0b27a' : '#f4f4f4',
        size: 1,
        kind: 'spark',
      });
    }
  }

  spawnDeath(x: number, y: number): void {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const speed = 0.03 + Math.random() * 0.07;
      this.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.03,
        life: 20 + Math.random() * 18,
        maxLife: 38,
        color: i % 4 === 0 ? '#5ccfe6' : '#7a2331',
        size: 1,
        kind: 'blood',
      });
    }
    this.push({ x, y, vx: 0, vy: 0, life: 16, maxLife: 16, color: '#f4f4f4', size: 1, kind: 'ring' });
  }

  spawnSouls(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.push({
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.02,
        vy: -0.03 - Math.random() * 0.03,
        life: 26 + Math.random() * 20,
        maxLife: 46,
        color: '#5ccfe6',
        size: 1,
        kind: 'soul',
      });
    }
  }

  spawnLoot(x: number, y: number): void {
    this.push({ x, y, vx: 0, vy: -0.05, life: 30, maxLife: 30, color: '#e8c15a', size: 2, kind: 'loot' });
  }

  spawnDust(x: number, y: number): void {
    this.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -0.01,
      life: 18,
      maxLife: 18,
      color: '#8a8a8a',
      size: 1,
      kind: 'dust',
    });
  }

  update(speed = 1): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= speed;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * speed;
      p.y += p.vy * speed;
      if (p.kind === 'blood' || p.kind === 'dust') p.vy += 0.002 * speed;
      if (p.kind === 'soul' || p.kind === 'loot') p.vy += 0.001 * speed;
    }
  }

  draw(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      if (p.kind === 'ring') {
        ctx.strokeStyle = withAlpha(p.color, alpha * 0.8);
        const radius = (p.maxLife - p.life) * 1.6;
        ctx.beginPath();
        ctx.arc(originX + p.x * TILE, originY + p.y * TILE, radius, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = withAlpha(p.color, alpha);
      ctx.fillRect(
        Math.round(originX + p.x * TILE),
        Math.round(originY + p.y * TILE),
        p.size,
        p.size,
      );
    }
  }
}
