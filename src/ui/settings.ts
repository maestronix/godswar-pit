/** SETTINGS: audio, accessibility and the save tools. */
import { button, clear, el, statLine } from './dom';
import { chip } from '../audio/chip';
import { music } from '../audio/music';
import type { Game } from '../game';

export function renderSettings(root: HTMLElement, game: Game): void {
  const save = game.save;
  clear(root);

  root.append(
    el('header', { class: 'sub-header' }, [
      el('h1', { text: 'Settings' }),
      button('Back to Ashvale', () => {
        game.screen = 'hub';
      }),
    ]),
  );

  const audio = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Audio' })]);
  audio.append(slider('Master volume', save.settings.masterVolume, (value) => {
    chip.setVolume(value);
    game.store.update((s) => {
      s.settings.masterVolume = value;
    });
  }));
  audio.append(slider('Music', save.settings.musicVolume, (value) => {
    music.setVolume(value);
    game.store.update((s) => {
      s.settings.musicVolume = value;
    });
  }));
  const mute = el('input', { type: 'checkbox' }) as HTMLInputElement;
  mute.checked = save.settings.muted;
  mute.addEventListener('change', () => {
    chip.setMuted(mute.checked);
    music.setMuted(mute.checked);
    game.store.update((s) => {
      s.settings.muted = mute.checked;
    });
  });
  audio.append(el('div', { class: 'field' }, [mute, el('span', { text: 'Mute everything' })]));
  root.append(audio);

  const access = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Display' })]);
  const reduced = el('input', { type: 'checkbox' }) as HTMLInputElement;
  reduced.checked = save.settings.reducedMotion;
  reduced.addEventListener('change', () => {
    game.store.update((s) => {
      s.settings.reducedMotion = reduced.checked;
    });
  });
  access.append(el('div', { class: 'field' }, [reduced, el('span', { text: 'Reduced motion' })]));
  const numbers = el('input', { type: 'checkbox' }) as HTMLInputElement;
  numbers.checked = save.settings.showDamageNumbers;
  numbers.addEventListener('change', () => {
    game.store.update((s) => {
      s.settings.showDamageNumbers = numbers.checked;
    });
  });
  access.append(el('div', { class: 'field' }, [numbers, el('span', { text: 'Damage numbers' })]));
  access.append(
    slider('Font scale', save.settings.fontScale, (value) => {
      document.documentElement.style.setProperty('--font-scale', String(value));
      game.store.update((s) => {
        s.settings.fontScale = value;
      });
    }),
  );
  root.append(access);

  const saveTools = el('div', { class: 'panel' }, [el('h2', { class: 'panel__title', text: 'Save' })]);
  saveTools.append(statLine('Fingerprint', game.store.fingerprint()));
  const output = el('textarea', { class: 'textarea', readonly: true, rows: 4 }) as HTMLTextAreaElement;
  output.value = game.store.export();
  saveTools.append(output);
  saveTools.append(
    button('Copy save code', () => {
      if (navigator.clipboard) void navigator.clipboard.writeText(output.value);
    }),
  );
  const importField = el('textarea', { class: 'textarea', rows: 4, placeholder: 'Paste a save code here...' }) as HTMLTextAreaElement;
  saveTools.append(importField);
  saveTools.append(
    button('Import save', () => {
      const result = game.store.import(importField.value);
      if (!result.ok) {
        window.alert(`Import failed: ${result.errors.join(', ')}`);
        return;
      }
      game.replaceSave(game.store.current);
      game.screen = 'hub';
    }, 'btn--primary'),
  );
  saveTools.append(
    button('Wipe save', () => {
      if (!window.confirm('Delete everything and start over?')) return;
      game.store.reset();
      game.screen = 'hub';
    }, 'btn--danger'),
  );
  root.append(saveTools);
}

function slider(label: string, value: number, onChange: (value: number) => void): HTMLElement {
  const input = el('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: String(Math.round(value * 100)),
  }) as HTMLInputElement;
  const valueLabel = el('span', { class: 'field__value', text: `${Math.round(value * 100)}%` });
  input.addEventListener('input', () => {
    const next = Number(input.value) / 100;
    valueLabel.textContent = `${input.value}%`;
    onChange(next);
  });
  return el('label', { class: 'field' }, [el('span', { class: 'field__label', text: label }), input, valueLabel]);
}
