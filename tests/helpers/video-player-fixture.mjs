import { registerHooks } from 'node:module';

export const videoHooks = {
  refs: /** @type {Array<{current: unknown}>} */ ([]),
  states: /** @type {Array<{state: string}>} */ ([]),
  effects: /** @type {Array<() => (() => void) | undefined>} */ ([]),
  refIndex: 0, stateIndex: 0,
};
globalThis[Symbol.for('appai.test.video-hooks')] = videoHooks;
export function registerVideoPlayerFixture() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'react' && context.parentURL?.endsWith('/VideoPlayer.tsx')) return { url: 'fixture:video-hooks', shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:video-hooks') return { format: 'module', shortCircuit: true, source: `
        const f = globalThis[Symbol.for('appai.test.video-hooks')];
        export function useState(initial) {
          const i = f.stateIndex++;
          if (i >= f.states.length) f.states.push(initial);
          return [f.states[i], value => { f.states[i] = typeof value === 'function' ? value(f.states[i]) : value; }];
        }
        export function useRef(initial) {
          const i = f.refIndex++;
          return f.refs[i] ??= { current: initial };
        }
        export function useEffect(fn) { f.effects.push(fn); }
      ` };
      return nextLoad(url, context);
    },
  });
}
