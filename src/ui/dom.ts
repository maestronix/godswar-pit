/** Tiny DOM helpers - no framework, no runtime dependencies. */

export type Attrs = Record<string, string | number | boolean | undefined | null>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else if (key.startsWith('data-')) node.setAttribute(key, String(value));
    else if (key === 'style') node.setAttribute('style', String(value));
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const node = el('button', { class: `btn ${className}`.trim(), type: 'button' }, [label]);
  node.addEventListener('click', (event) => {
    event.preventDefault();
    onClick();
  });
  return node;
}

export function section(title: string, children: (Node | string)[] = [], className = ''): HTMLElement {
  return el('section', { class: `panel ${className}`.trim() }, [
    el('h2', { class: 'panel__title', text: title }),
    ...children,
  ]);
}

export function statLine(label: string, value: string, className = ''): HTMLElement {
  return el('div', { class: `stat-line ${className}`.trim() }, [
    el('span', { class: 'stat-line__label', text: label }),
    el('span', { class: 'stat-line__value', text: value }),
  ]);
}

export function bar(fraction: number, className = ''): HTMLElement {
  const clamped = Math.max(0, Math.min(1, fraction));
  return el('div', { class: `bar ${className}`.trim() }, [
    el('div', { class: 'bar__fill', style: `width:${(clamped * 100).toFixed(1)}%` }),
  ]);
}

export function empty(message: string): HTMLElement {
  return el('p', { class: 'empty', text: message });
}
