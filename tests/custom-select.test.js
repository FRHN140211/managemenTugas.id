import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/js/ui.js', import.meta.url), 'utf8');

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.defaultPrevented = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = 0;
    this.textContent = '';
    this.innerHTML = '';
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !this.classes.has(name) : force;
        if (shouldAdd) this.classes.add(name);
        else this.classes.delete(name);
        return shouldAdd;
      }
    };
  }

  get className() {
    return [...this.classes].join(' ');
  }

  set className(value) {
    this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  appendChild(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, reference) {
    if (child.parentElement) child.parentElement.removeChild(child);
    const index = this.children.indexOf(reference);
    child.parentElement = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentElement = null;
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    event.target = this;
    for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new MockEvent('click'));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  scrollIntoView() {}

  matches(selector) {
    if (selector === 'select') return this.tagName === 'SELECT';
    const tagMatch = /^([a-z]+)/i.exec(selector);
    if (tagMatch && this.tagName !== tagMatch[1].toUpperCase()) return false;
    for (const [, name] of selector.matchAll(/\.([\w-]+)/g)) {
      if (!this.classList.contains(name)) return false;
    }
    for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (!this.hasAttribute(name)) return false;
      if (value !== undefined && this.getAttribute(name) !== value) return false;
    }
    for (const [, name] of selector.matchAll(/:not\(\[([\w-]+)="[^"]*"\]\)/g)) {
      if (this.hasAttribute(name)) return false;
    }
    return true;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (parent) => {
      for (const child of parent.children) {
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
}

class MockSelect extends MockElement {
  constructor(options, selectedIndex = 0) {
    super('select');
    this.options = options.map(({ textContent, disabled = false }) => ({ textContent, disabled }));
    this.selectedIndex = selectedIndex;
    this.multiple = false;
    this.size = 0;
    this.labels = [];
  }
}

function createRuntime(initialSelects = []) {
  const observers = [];
  const document = {
    nodeType: 9,
    activeElement: null,
    listeners: new Map(),
    body: new MockElement('body'),
    createElement(tagName) {
      const element = new MockElement(tagName);
      element.ownerDocument = document;
      return element;
    },
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    },
    querySelectorAll(selector) {
      return this.body.querySelectorAll(selector);
    }
  };
  document.body.ownerDocument = document;
  for (const select of initialSelects) {
    select.ownerDocument = document;
    const parent = document.createElement('div');
    parent.appendChild(select);
    document.body.appendChild(parent);
  }

  class MockMutationObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }

    observe(target, options) {
      this.target = target;
      this.options = options;
    }
  }

  runInNewContext(source, {
    window: {
      MT: { icon: () => '<svg></svg>' },
      MutationObserver: MockMutationObserver
    },
    document,
    Event: MockEvent
  });

  return {
    document,
    notifyAdded(node) {
      observers.forEach((observer) => observer.callback([{ addedNodes: [node] }]));
    }
  };
}

function getSelectUi(select) {
  const wrapper = select.parentElement;
  return {
    wrapper,
    trigger: wrapper.querySelector('.custom-select-trigger'),
    listbox: wrapper.querySelector('.custom-select-listbox')
  };
}

function keyEvent(key) {
  return {
    key,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }
  };
}

test('enhances eligible selects and reflects the selected option', () => {
  const select = new MockSelect([{ textContent: 'First' }, { textContent: 'Second' }], 1);
  const runtime = createRuntime([select]);
  const { wrapper, trigger, listbox } = getSelectUi(select);

  assert.equal(wrapper.className, 'custom-select');
  assert.equal(select.dataset.customSelect, 'true');
  assert.equal(select.getAttribute('aria-hidden'), 'true');
  assert.equal(select.tabIndex, -1);
  assert.equal(trigger.getAttribute('role'), 'combobox');
  assert.equal(trigger.getAttribute('aria-controls'), listbox.id);
  assert.equal(trigger.querySelector('.custom-select-label').textContent, 'Second');
  assert.deepEqual(listbox.querySelectorAll('[role="option"]').map((item) => item.textContent), ['First', 'Second']);
  assert.equal(runtime.document.body.querySelectorAll('.custom-select').length, 1);
});

test('supports keyboard navigation, selection, and native change dispatch', () => {
  const select = new MockSelect([
    { textContent: 'First' },
    { textContent: 'Unavailable', disabled: true },
    { textContent: 'Third' }
  ]);
  createRuntime([select]);
  const { trigger, listbox } = getSelectUi(select);
  let changes = 0;
  select.addEventListener('change', () => { changes += 1; });

  const openEvent = keyEvent('ArrowDown');
  trigger.listeners.get('keydown')[0](openEvent);
  assert.equal(openEvent.defaultPrevented, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(listbox.hidden, false);

  const navigationEvent = keyEvent('ArrowDown');
  listbox.listeners.get('keydown')[0](navigationEvent);
  assert.equal(navigationEvent.defaultPrevented, true);
  assert.equal(listbox.querySelectorAll('[role="option"]')[2], select.ownerDocument.activeElement);

  const selectionEvent = keyEvent('Enter');
  listbox.listeners.get('keydown')[0](selectionEvent);
  assert.equal(selectionEvent.defaultPrevented, true);
  assert.equal(select.selectedIndex, 2);
  assert.equal(changes, 1);
  assert.equal(trigger.querySelector('.custom-select-label').textContent, 'Third');
  assert.equal(listbox.hidden, true);
  assert.equal(select.ownerDocument.activeElement, trigger);
});

test('enhances selects inserted after initial setup', () => {
  const runtime = createRuntime();
  const select = new MockSelect([{ textContent: 'Added later' }]);
  const container = runtime.document.createElement('section');
  container.appendChild(select);
  runtime.document.body.appendChild(container);

  runtime.notifyAdded(container);

  assert.equal(select.dataset.customSelect, 'true');
  assert.equal(getSelectUi(select).trigger.querySelector('.custom-select-label').textContent, 'Added later');
});
