// Tiny helpers for building the screens.

// h('button', { class: 'chip', onclick: fn, disabled: true }, 'Text', childElement, ...)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value == null) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  return append(el, ...children);
}

// Adds children to `el`: nested arrays are flattened, null and false are skipped, strings become text.
export function append(el, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function clear(el) {
  el.replaceChildren();
}

// A labeled row of buttons where one value is selected.
export function choices(label, values, labels, selected, onPick) {
  return h('div', { class: 'group', role: 'group', 'aria-label': label },
    h('div', { class: 'group-label' }, label),
    h('div', { class: 'chips' },
      values.map((value) => h('button', {
        class: 'chip',
        'aria-pressed': value === selected ? 'true' : 'false',
        onclick: () => onPick(value),
      }, labels[value]))));
}

// A small circle of a color.
export function swatch(hex) {
  return h('span', { class: 'swatch', style: `background:${hex}` });
}

// A clothing photo; a placeholder with the file name when there is no photo or it fails to load.
export function photo(url, fileName) {
  const placeholder = () => h('div', { class: 'photo placeholder' }, fileName || 'Photo');
  if (!url) return placeholder();
  const img = h('img', { class: 'photo', src: url, alt: fileName, loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(placeholder()));
  return img;
}

// Attributes that make a box work as one button: a tap, Enter or Space calls `onTap`.
export function tapAttrs(onTap, label) {
  return {
    role: 'button',
    tabindex: '0',
    'aria-label': label,
    onclick: onTap,
    onkeydown: (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onTap();
    },
  };
}

// One outfit, big, over a darkened screen: `pieces` are { url, fileName }, `top` sits beside
// the × and `after` under the photos. × or a tap on the dark area closes it (Esc too, in app.js).
export function bigOutfit(pieces, { top, after, opening, onClose }) {
  const close = h('button', { class: 'icon zoom-close', 'aria-label': 'Close', onclick: onClose }, '×');
  const panel = h('div', { class: 'zoom-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Outfit' },
    h('div', { class: 'zoom-top' }, top, close),
    h('div', { class: 'zoom-pieces' }, pieces.map(({ url, fileName }) => h('figure', { class: 'piece' }, photo(url, fileName)))),
    after);
  const backdrop = h('div', { class: opening ? 'zoom opening' : 'zoom' }, panel);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) onClose();
  });
  if (opening) queueMicrotask(() => close.focus({ preventScroll: true }));
  return backdrop;
}
