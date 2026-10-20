/** Small toast messages (achievement unlocks, hints). */
import { el } from './dom';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && container.isConnected) return container;
  container = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  document.body.append(container);
  return container;
}

export function showToast(title: string, text = ''): void {
  const root = ensureContainer();
  const toast = el('div', { class: 'toast' }, [
    el('strong', { class: 'toast__title', text: title }),
    text ? el('span', { class: 'toast__text', text }) : el('span'),
  ]);
  root.append(toast);
  window.setTimeout(() => {
    toast.classList.add('toast--out');
    window.setTimeout(() => toast.remove(), 400);
  }, 4200);
}
