/**
 * Procedural zone music.
 *
 * Ten loops, one per zone. Every loop is a bass line, an arpeggio and a
 * noise percussion that follows a scale and a tempo. The combat intensity
 * modulates the percussion density.
 */
import { chip } from './chip';

export interface MusicTheme {
  id: string;
  /** Root note in Hz. */
  root: number;
  /** Semitone offsets of the scale. */
  scale: number[];
  /** Beats per minute. */
  bpm: number;
  /** Pattern length in steps (16th notes). */
  steps: number;
  /** Bass line as scale degrees, -1 = rest. */
  bass: number[];
  /** Arpeggio as scale degrees, -1 = rest. */
  arp: number[];
  /** Waveform of the bass. */
  waveform: 'square' | 'triangle' | 'sawtooth';
  /** Probability of a drum hit on a step (0..1). */
  drums: number[];
}

function note(root: number, semitones: number): number {
  return root * Math.pow(2, semitones / 12);
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const PENTATONIC = [0, 3, 5, 7, 10];
const WHOLE = [0, 2, 4, 6, 8, 10, 12];

function pattern(degrees: number[]): number[] {
  return degrees;
}

export const ZONE_THEMES: MusicTheme[] = [
  {
    id: 'ashvale',
    root: 110,
    scale: MINOR,
    bpm: 84,
    steps: 16,
    bass: pattern([0, -1, 0, -1, 3, -1, 2, -1, 0, -1, 0, -1, 4, -1, 2, -1]),
    arp: pattern([0, 2, 4, 2, 0, 4, 2, 4, 0, 2, 4, 2, 3, 2, 0, -1]),
    waveform: 'triangle',
    drums: [1, 0, 0.4, 0, 0.8, 0, 0.4, 0, 1, 0, 0.4, 0, 0.8, 0.4, 0.4, 0],
  },
  {
    id: 'bone',
    root: 98,
    scale: PHRYGIAN,
    bpm: 76,
    steps: 16,
    bass: pattern([0, 0, -1, 0, -1, 0, 1, -1, 0, 0, -1, 0, 2, -1, 1, -1]),
    arp: pattern([0, 3, 2, 3, 0, 3, 2, 3, 0, 3, 2, 3, 1, 2, 0, -1]),
    waveform: 'square',
    drums: [1, 0, 0, 0.3, 0.7, 0, 0, 0, 1, 0, 0.3, 0, 0.7, 0, 0.3, 0],
  },
  {
    id: 'frost',
    root: 130.8,
    scale: LYDIAN,
    bpm: 92,
    steps: 16,
    bass: pattern([0, -1, -1, 0, 4, -1, 2, -1, 0, -1, -1, 0, 5, -1, 2, -1]),
    arp: pattern([0, 4, 2, 4, 5, 4, 2, 4, 0, 4, 2, 4, 6, 4, 2, 0]),
    waveform: 'triangle',
    drums: [1, 0, 0.5, 0, 0.9, 0, 0.5, 0, 1, 0, 0.5, 0, 0.9, 0, 0.6, 0.5],
  },
  {
    id: 'ember',
    root: 98,
    scale: HARMONIC,
    bpm: 104,
    steps: 16,
    bass: pattern([0, 0, 1, 0, -1, 0, 1, 0, 0, 0, 4, 0, 3, -1, 1, 0]),
    arp: pattern([0, 1, 4, 1, 0, 1, 4, 3, 0, 1, 4, 1, 2, 1, 0, 0]),
    waveform: 'sawtooth',
    drums: [1, 0, 0.6, 0, 0.9, 0, 0.6, 0, 1, 0, 0.6, 0, 0.9, 0.6, 0.7, 0.4],
  },
  {
    id: 'verdant',
    root: 116.5,
    scale: DORIAN,
    bpm: 88,
    steps: 16,
    bass: pattern([0, -1, 2, -1, 0, -1, 4, -1, 0, -1, 2, -1, 5, -1, 4, -1]),
    arp: pattern([0, 2, 4, 5, 4, 2, 0, 2, 0, 2, 4, 5, 6, 5, 4, 2]),
    waveform: 'triangle',
    drums: [1, 0, 0.3, 0, 0.7, 0, 0.3, 0, 1, 0, 0.3, 0, 0.7, 0.3, 0.5, 0],
  },
  {
    id: 'rust',
    root: 87.3,
    scale: WHOLE,
    bpm: 96,
    steps: 16,
    bass: pattern([0, 0, 0, -1, 3, -1, -1, 0, 0, 0, 0, -1, 5, -1, 3, -1]),
    arp: pattern([0, 2, 4, 6, 4, 2, 0, 2, 0, 2, 4, 6, 7, 6, 4, 2]),
    waveform: 'square',
    drums: [1, 0, 0.5, 0, 0.8, 0, 0.5, 0.5, 1, 0, 0.5, 0, 0.8, 0.5, 0.5, 0.4],
  },
  {
    id: 'void',
    root: 73.4,
    scale: PHRYGIAN,
    bpm: 70,
    steps: 16,
    bass: pattern([0, -1, -1, -1, 1, -1, -1, 0, 0, -1, -1, -1, 2, -1, 1, -1]),
    arp: pattern([0, 1, 4, 1, 2, 1, 4, 1, 0, 1, 4, 1, 3, 4, 1, 0]),
    waveform: 'sawtooth',
    drums: [1, 0, 0, 0, 0.6, 0, 0, 0, 1, 0, 0, 0.3, 0.6, 0, 0, 0],
  },
  {
    id: 'obsidian',
    root: 82.4,
    scale: MINOR,
    bpm: 118,
    steps: 16,
    bass: pattern([0, 0, 0, 0, 5, 0, 3, 0, 0, 0, 0, 0, 4, 0, 2, 0]),
    arp: pattern([0, 3, 5, 3, 0, 3, 5, 7, 0, 3, 5, 3, 2, 3, 5, 3]),
    waveform: 'square',
    drums: [1, 0.5, 0.6, 0.5, 0.9, 0.5, 0.6, 0.5, 1, 0.5, 0.6, 0.5, 0.9, 0.6, 0.7, 0.6],
  },
  {
    id: 'gold',
    root: 146.8,
    scale: LYDIAN,
    bpm: 100,
    steps: 16,
    bass: pattern([0, -1, 2, -1, 4, -1, 2, -1, 0, -1, 2, -1, 6, -1, 4, -1]),
    arp: pattern([0, 2, 4, 6, 4, 2, 0, 2, 0, 2, 4, 6, 7, 6, 4, 2]),
    waveform: 'triangle',
    drums: [1, 0, 0.4, 0, 0.8, 0, 0.4, 0, 1, 0, 0.4, 0, 0.8, 0.4, 0.5, 0.3],
  },
  {
    id: 'divine',
    root: 130.8,
    scale: PENTATONIC,
    bpm: 112,
    steps: 16,
    bass: pattern([0, 0, -1, 0, -1, 0, 2, -1, 0, 0, -1, 0, 3, -1, 2, -1]),
    arp: pattern([0, 3, 5, 3, 0, 3, 5, 3, 0, 3, 5, 3, 4, 5, 3, 0]),
    waveform: 'sawtooth',
    drums: [1, 0.5, 0.7, 0.5, 0.9, 0.5, 0.7, 0.5, 1, 0.5, 0.7, 0.5, 0.9, 0.7, 0.8, 0.6],
  },
];

export class MusicPlayer {
  private timer: number | null = null;
  private step = 0;
  private theme: MusicTheme = ZONE_THEMES[0]!;
  private intensity = 0;
  private volume = 0.35;
  private muted = false;

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** 0 = calm, 1 = full combat. */
  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  play(themeId: string): void {
    const theme = ZONE_THEMES.find((t) => t.id === themeId) ?? ZONE_THEMES[0]!;
    if (theme.id === this.theme.id && this.timer !== null) return;
    this.theme = theme;
    this.step = 0;
    this.start();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private start(): void {
    if (this.timer !== null) return;
    const stepMs = (60_000 / this.theme.bpm) / 4;
    this.timer = setInterval(() => this.tick(), stepMs) as unknown as number;
  }

  private tick(): void {
    if (this.muted || this.volume <= 0) {
      this.step = (this.step + 1) % this.theme.steps;
      return;
    }
    const theme = this.theme;
    const step = this.step % theme.steps;

    const bassDegree = theme.bass[step % theme.bass.length]!;
    if (bassDegree >= 0) {
      const frequency = note(theme.root, theme.scale[bassDegree % theme.scale.length]!);
      chip.play({
        frequency,
        duration: 0.22,
        waveform: theme.waveform,
        volume: this.volume * 0.5,
        envelope: { attack: 0.01, decay: 0.05, sustain: 0.6, release: 0.12 },
      });
    }

    if (step % 2 === 0) {
      const arpDegree = theme.arp[step % theme.arp.length]!;
      if (arpDegree >= 0) {
        const frequency = note(theme.root * 2, theme.scale[arpDegree % theme.scale.length]!);
        chip.play({
          frequency,
          duration: 0.12,
          waveform: 'triangle',
          volume: this.volume * 0.22,
          envelope: { attack: 0.005, decay: 0.04, sustain: 0.25, release: 0.08 },
        });
      }
    }

    const drumChance = theme.drums[step % theme.drums.length]! * (0.55 + this.intensity * 0.75);
    if (Math.random() < drumChance) {
      chip.play({
        frequency: 120,
        duration: 0.08,
        waveform: 'noise',
        volume: this.volume * (0.18 + this.intensity * 0.2),
        envelope: { attack: 0.002, decay: 0.05, sustain: 0.05, release: 0.05 },
      });
    }

    this.step = (this.step + 1) % theme.steps;
  }
}

export const music = new MusicPlayer();
