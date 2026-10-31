// Just enough of a browser page for the screens in js/ui/ to be drawn in Node: elements with
// attributes, children, listeners and text. Import it before the screen under test.

class FakeNode {}

class FakeElement extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.attributes = {};
    this.children = [];
    this.listeners = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  get textContent() {
    return this.children.map((c) => (c instanceof FakeElement ? c.textContent : c)).join('');
  }
}

globalThis.Node = FakeNode;
globalThis.document = { createElement: (tag) => new FakeElement(tag) };

export const newRoot = () => new FakeElement('div');

// Every element under `root`, depth first.
export function elements(root) {
  const out = [];
  const walk = (el) => {
    for (const child of el.children) {
      if (child instanceof FakeElement) {
        out.push(child);
        walk(child);
      }
    }
  };
  walk(root);
  return out;
}

// The button or label whose text is `text`.
export const control = (root, text) => elements(root).find((el) => ['BUTTON', 'LABEL'].includes(el.tagName) && el.textContent.trim() === text);

// A button, or a photo picker (a label around a file input), that can't be used right now.
export function isDisabled(el) {
  const target = el.tagName === 'LABEL' ? el.children.find((c) => c instanceof FakeElement && c.tagName === 'INPUT') : el;
  return target.getAttribute('disabled') !== null;
}
