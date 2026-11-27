import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as logic from '../src/logic.js';
import * as ai from '../src/ai.js';
import * as i18n from '../src/i18n.js';
import * as controller from '../src/controller.js';
import * as rooms from '../src/rooms.js';
import { FakeServer, MemoryStorage } from './fake-server.mjs';

// Exercise the shipped app's handlers and rendering without dependencies or a
// network. This small DOM double models replacement/focus and form defaults;
// it does not perform layout or replace a browser's native-event verification.
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');

export function appHarness({ state = controller.initialState(), lang = 'en', server = new FakeServer() } = {}) {
  const storage = new MemoryStorage();
  storage.setItem(controller.STORAGE_KEY, JSON.stringify(state));
  const handlers = new Map(), timers = new Map();
  let elements = [], generation = 0, nextTimer = 0, html = '';
  const body = { tagName: 'BODY', dataset: {} };
  const announcer = { textContent: '' };
  const schedule = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; };
  const cancel = (id) => timers.delete(id);
  const root = {
    addEventListener(type, handler) { handlers.set(type, handler); },
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value; generation++; document.activeElement = body;
      elements = [...html.matchAll(/<(button|input|select|form)\b([^>]*)>/g)].map(([, tag, raw]) => {
        const attrs = Object.fromEntries([...raw.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? '']));
        const born = generation;
        return {
          tagName: tag.toUpperCase(), id: attrs.id ?? '', type: attrs.type, value: attrs.value ?? '',
          disabled: Object.hasOwn(attrs, 'disabled'), attrs,
          dataset: Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5), value])),
          get isConnected() { return generation === born; },
          focus() { if (this.isConnected) document.activeElement = this; },
          closest(selector) { return selector === '[data-action]' && this.dataset.action || selector === '[data-index]' && this.dataset.index !== undefined ? this : null; },
        };
      });
      for (const form of elements.filter((e) => e.tagName === 'FORM')) {
        form.elements = Object.fromEntries(elements.filter((e) => e.id).map((e) => [e.id, e]));
      }
    },
    querySelector(selector) { return selector === '.board-wrap' ? null : this.querySelectorAll(selector)[0] ?? null; },
    querySelectorAll(selector) {
      const index = selector.match(/^\[data-index="(\d+)"\]$/)?.[1];
      return elements.filter((e) => index !== undefined ? e.dataset.index === index : selector === '[data-index]' && e.dataset.index !== undefined);
    },
  };
  const document = {
    activeElement: body, documentElement: { dataset: {} },
    getElementById(id) { return id === 'app' ? root : id === 'announcer' ? announcer : elements.find((e) => e.id === id) ?? null; },
    addEventListener() {},
  };
  runInNewContext(source, {
    ...logic, ...ai, ...i18n, ...controller, ...rooms,
    RoomsClient: class extends rooms.RoomsClient { constructor(options) { super({ ...options, fetcher: server.fetch }); } },
    OnlineSession: class extends rooms.OnlineSession {
      constructor(...args) { super(...args, { schedule, cancel, hidden: () => false }); }
    },
    document, window: { localStorage: storage, addEventListener() {} },
    location: new URL(`https://appai.info/games/five-in-a-row/?lang=${lang}`),
    navigator: { languages: [lang] }, history: { replaceState() {} }, URL, URLSearchParams,
    setTimeout: schedule, clearTimeout: cancel,
  }, { filename: 'src/app.js' });
  const fire = (type, target, extra = {}) => {
    const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    handlers.get(type)?.(event);
    return event;
  };
  const element = (id) => document.getElementById(id);
  const action = (name) => elements.find((e) => e.dataset.action === name);
  const submit = () => fire('submit', element('join-room'));
  const runTimer = (delay) => {
    const entry = [...timers].find(([, timer]) => timer.delay === delay);
    if (!entry) throw Error(`No timer scheduled for ${delay} ms`);
    timers.delete(entry[0]); entry[1].callback();
  };
  return {
    root, document, announcer, server, fire, element, action,
    get renders() { return generation; },
    get inputs() { return elements.filter((e) => e.tagName === 'INPUT'); },
    saved: () => JSON.parse(storage.getItem(controller.STORAGE_KEY)),
    typeCode(value) { const input = element('room-code'); input.focus(); input.value = value; fire('input', input); return input; },
    tapJoin() {
      const button = action('join');
      // On a native pointer activation, blur/change precedes the button click.
      if (document.activeElement.tagName === 'INPUT') fire('change', document.activeElement);
      if (!button.isConnected || button.disabled) return;
      button.focus(); fire('click', button);
      if (button.type === 'submit' && button.isConnected) submit();
    },
    enterCode() {
      const input = element('room-code'); input.focus();
      const event = fire('keydown', input, { key: 'Enter' });
      if (!event.defaultPrevented && input.isConnected && action('join').type === 'submit') submit();
    },
    change(id, value) { const target = element(id); target.value = String(value); return fire('change', target); },
    runComputer: () => runTimer(80), poll: () => runTimer(1200),
    flush: () => new Promise((resolve) => setImmediate(resolve)),
  };
}

export async function waitingServer() {
  const server = new FakeServer();
  await new rooms.RoomsClient({ fetcher: server.fetch }).create(logic.newGame(15));
  server.requests.length = 0;
  return server;
}
