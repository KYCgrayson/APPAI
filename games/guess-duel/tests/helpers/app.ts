import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { RoomsClient } from '../../src/net/rooms.ts';

/** Run the real controller and views with an event/storage facade, without a browser DOM. */
export function loadApp(
  fetcher: typeof fetch,
  url = 'https://appai.info/games/guess-duel/',
  now: () => number = Date.now,
  saved: Record<string, string> = {},
) {
  const location = new URL(url);
  const values = new Map<string, string>(Object.entries(saved));
  const storage = {
    get length() {
      return values.size;
    },
    key: (i: number) => [...values.keys()][i],
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const events = new Map<string, (event: any) => void>();
  const documentEvents = new Map<string, (event: any) => void>();
  const windowEvents = new Map<string, (event: any) => void>();
  const intervals: (() => void)[] = [];
  const elements = new Map<string, { innerHTML: string; textContent: string }>();
  let html = '',
    renders = 0,
    boxes: any[] = [],
    notes: { open: boolean } | undefined,
    captured: number | undefined;
  const root = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value: string) {
      html = value;
      renders++;
      boxes = [...value.matchAll(/<input data-room-digit="\d"[^>]*value="([^"]*)"/g)].map((m) => ({
        value: m[1],
        focus() {},
      }));
      notes = value.includes('notes-disclosure') ? { open: false } : undefined;
      elements.clear();
      const countdown = value.match(/<p[^>]*data-countdown[^>]*>([^<]*)<\/p>/);
      if (countdown) elements.set('countdown', { innerHTML: '', textContent: countdown[1] });
      for (const match of value.matchAll(/<([\w-]+)[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
        elements.set(match[2], {
          innerHTML: match[3],
          get textContent() {
            return this.innerHTML.replace(/<[^>]*>/g, '');
          },
          set textContent(value: string) {
            this.innerHTML = value;
          },
        });
      }
    },
    addEventListener: (name: string, fn: (event: any) => void) => events.set(name, fn),
    querySelectorAll: (selector: string) => (selector === '[data-room-digit]' ? boxes : []),
    querySelector: (selector: string) => (selector === '.notes-disclosure' ? notes : null),
    setPointerCapture: (id: number) => (captured = id),
  };
  const document = {
    hidden: false,
    documentElement: { lang: '', dataset: {}, style: { setProperty() {} } },
    querySelector: (selector: string) =>
      selector === '#app'
        ? root
        : selector === '[data-countdown]'
          ? (elements.get('countdown') ?? null)
          : null,
    getElementById: (id: string) => elements.get(id) ?? null,
    addEventListener: (name: string, fn: (event: any) => void) => documentEvents.set(name, fn),
  };
  const window: any = {
    localStorage: storage,
    addEventListener: (name: string, fn: (event: any) => void) => windowEvents.set(name, fn),
  };
  window.top = { location };
  const history = {
    replaceState(_state: unknown, _title: string, href: string) {
      location.href = new URL(href, location).href;
    },
  };
  const cache = new Map<string, { exports: any }>();
  function load(name: string): any {
    const file = new URL('../../src/ui/' + name + '.ts', import.meta.url);
    if (cache.has(name)) return cache.get(name)!.exports;
    const module = { exports: {} };
    cache.set(name, module);
    const require = createRequire(file);
    const compiled = ts.transpileModule(
      readFileSync(file, 'utf8').replace('import.meta.env.DEV', 'false'),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      },
    ).outputText;
    const injectedRequire = (path: string) => {
      if (path.endsWith('.css')) return {};
      if (path === './app.ts' || path === './views.ts') return load(path.slice(2, -3));
      if (path === '../net/rooms.ts')
        return {
          ...require(path),
          RoomsClient: class extends RoomsClient {
            constructor(base: string, _fetcher: unknown, store: any) {
              super(base, fetcher, store, undefined, now);
            }
          },
        };
      return require(path);
    };
    new Function(
      'require',
      'exports',
      'module',
      'window',
      'document',
      'location',
      'navigator',
      'history',
      'confirm',
      'setInterval',
      'Date',
      compiled,
    )(
      injectedRequire,
      module.exports,
      module,
      window,
      document,
      location,
      { language: 'en' },
      history,
      () => true,
      (fn: () => void) => intervals.push(fn),
      class extends Date {
        static now() {
          return now();
        }
      },
    );
    return module.exports;
  }
  const app = load('app');
  function dispatch(
    type: string,
    dataset: Record<string, string>,
    keypad = false,
    detail = 0,
    key = '',
  ) {
    const target = {
      dataset,
      disabled: false,
      closest(selector: string): unknown {
        const matches = selector.split(',').some((part) => {
          part = part.trim();
          if (part.startsWith('.keypad')) return keypad;
          const attr = part.match(/^\[data-(\w+)(?:="([^"]*)")?\]$/);
          return (
            attr && dataset[attr[1]] !== undefined && (!attr[2] || dataset[attr[1]] === attr[2])
          );
        });
        return matches ? this : null;
      },
    };
    events.get(type)!({
      type,
      target,
      detail,
      key,
      pointerId: 1,
      button: 0,
      isPrimary: true,
      preventDefault() {},
    });
  }
  return {
    app,
    act: window.__duelTest.act,
    storage,
    get url() {
      return location.href;
    },
    tick: () => intervals.forEach((fn) => fn()),
    setHidden(hidden: boolean) {
      document.hidden = hidden;
      documentEvents.get('visibilitychange')?.({});
    },
    get html() {
      return html;
    },
    get renders() {
      return renders;
    },
    get capturedPointer() {
      return captured;
    },
    text: (id: string) => elements.get(id)?.textContent,
    openNotes() {
      if (notes) notes.open = true;
    },
    get notesOpen() {
      return notes?.open;
    },
    enterRoom(code: string) {
      boxes.forEach((box, i) => {
        box.value = code[i] ?? '';
        box.oninput();
      });
    },
    click: (action: string) => dispatch('click', { action }),
    pointerAction: (action: string) => dispatch('pointerdown', { action }),
    pointerNote: (note: string) => dispatch('pointerdown', { note }),
    pointerControlClick: (dataset: Record<string, string>) => dispatch('click', dataset, false, 1),
    endPointer: (type = 'pointerup') => events.get(type)!({ pointerId: 1 }),
    peekKey: (type: string, key = ' ') => dispatch(type, { action: 'peek' }, false, 0, key),
    blur: () => windowEvents.get('blur')!({}),
    pointerDigit: (digit: string) => dispatch('pointerdown', { digit }, true),
    pointerClick: (digit: string) => dispatch('click', { digit }, true, 1),
    keyboardClick: (digit: string) => dispatch('click', { digit }, true),
    stop: () => app.session?.stop(),
  };
}

export async function until(condition: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw Error('Controller did not reach the expected state');
}
