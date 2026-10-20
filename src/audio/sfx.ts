/**
 * Sound effects.
 */
import { chip } from './chip';

export type SfxName =
  | 'hit'
  | 'crit'
  | 'death'
  | 'loot'
  | 'buy'
  | 'node'
  | 'throne'
  | 'button'
  | 'level'
  | 'error'
  | 'soul';

const HIT_FREQUENCIES = [420, 360, 300, 480];

export function playSfx(name: SfxName, variation = 0): void {
  switch (name) {
    case 'hit': {
      const frequency = HIT_FREQUENCIES[variation % HIT_FREQUENCIES.length]!;
      chip.play({ frequency, duration: 0.09, waveform: 'square', volume: 0.18, slide: -120 });
      break;
    }
    case 'crit': {
      chip.play({ frequency: 760, duration: 0.16, waveform: 'square', volume: 0.24, slide: -260 });
      chip.play({ frequency: 1500, duration: 0.1, waveform: 'triangle', volume: 0.12, delay: 0.02 });
      break;
    }
    case 'death': {
      chip.play({ frequency: 180, duration: 0.35, waveform: 'sawtooth', volume: 0.22, slide: -120 });
      chip.play({ frequency: 90, duration: 0.4, waveform: 'noise', volume: 0.12, delay: 0.05 });
      break;
    }
    case 'loot': {
      chip.play({ frequency: 880, duration: 0.09, waveform: 'triangle', volume: 0.16 });
      chip.play({ frequency: 1320, duration: 0.12, waveform: 'triangle', volume: 0.14, delay: 0.07 });
      break;
    }
    case 'soul': {
      chip.play({ frequency: 1046, duration: 0.14, waveform: 'sine', volume: 0.12, slide: 260 });
      break;
    }
    case 'buy': {
      chip.play({ frequency: 660, duration: 0.08, waveform: 'square', volume: 0.16 });
      chip.play({ frequency: 990, duration: 0.12, waveform: 'square', volume: 0.14, delay: 0.06 });
      break;
    }
    case 'node': {
      chip.play({ frequency: 520, duration: 0.1, waveform: 'triangle', volume: 0.16, slide: 180 });
      break;
    }
    case 'throne': {
      const notes = [392, 523, 659, 784];
      notes.forEach((frequency, i) => {
        chip.play({ frequency, duration: 0.3, waveform: 'square', volume: 0.18, delay: i * 0.13 });
      });
      break;
    }
    case 'level': {
      const notes = [523, 659, 784, 1046];
      notes.forEach((frequency, i) => {
        chip.play({ frequency, duration: 0.18, waveform: 'triangle', volume: 0.16, delay: i * 0.08 });
      });
      break;
    }
    case 'button': {
      chip.play({ frequency: 300, duration: 0.05, waveform: 'square', volume: 0.1 });
      break;
    }
    case 'error': {
      chip.play({ frequency: 160, duration: 0.16, waveform: 'sawtooth', volume: 0.16, slide: -40 });
      break;
    }
    default:
      break;
  }
}
