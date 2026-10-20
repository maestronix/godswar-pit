/**
 * The chip synth.
 *
 * Every sound in the game is generated: a square/triangle/noise oscillator
 * with an ADSR envelope. No audio files, no downloads, no licences.
 */

export type Waveform = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

export interface Adsr {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface ToneOptions {
  frequency: number;
  duration: number;
  waveform?: Waveform;
  volume?: number;
  envelope?: Adsr;
  /** Frequency slide in Hz over the duration. */
  slide?: number;
  /** Detune in cents for a second oscillator. */
  detune?: number;
  delay?: number;
}

export class Chip {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  volume = 0.7;

  /** The context is only created after a user gesture (browser policy). */
  ensure(): AudioContext | null {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    }
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.context = new Ctor();
    } catch {
      return null;
    }
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.context.destination);
    return this.context;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  private getNoise(context: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.floor(context.sampleRate * 0.5);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 0x1234abcd;
      for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 0xffffffff) * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /** Play a single tone. */
  play(options: ToneOptions): void {
    const context = this.ensure();
    if (!context || !this.master) return;
    const start = context.currentTime + (options.delay ?? 0);
    const duration = Math.max(0.01, options.duration);
    const envelope = options.envelope ?? { attack: 0.005, decay: 0.06, sustain: 0.55, release: 0.12 };
    const volume = options.volume ?? 0.3;
    const waveform = options.waveform ?? 'square';

    const gain = context.createGain();
    gain.connect(this.master);

    const peak = Math.max(0.0001, duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + envelope.attack * peak);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume * envelope.sustain),
      start + (envelope.attack + envelope.decay) * peak,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + peak * (envelope.attack + envelope.decay + envelope.release));

    if (waveform === 'noise') {
      const source = context.createBufferSource();
      source.buffer = this.getNoise(context);
      source.connect(gain);
      source.start(start);
      source.stop(start + peak);
      return;
    }

    const oscillator = context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.slide) {
      oscillator.frequency.linearRampToValueAtTime(Math.max(20, options.frequency + options.slide), start + peak);
    }
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + peak);

    if (options.detune) {
      const second = context.createOscillator();
      second.type = waveform;
      second.frequency.setValueAtTime(options.frequency, start);
      second.detune.setValueAtTime(options.detune, start);
      second.connect(gain);
      second.start(start);
      second.stop(start + peak);
    }
  }

  /** Play a sequence of tones. */
  sequence(notes: { frequency: number; duration: number; delay?: number; waveform?: Waveform; volume?: number }[]): void {
    for (const note of notes) this.play(note);
  }
}

export const chip = new Chip();
