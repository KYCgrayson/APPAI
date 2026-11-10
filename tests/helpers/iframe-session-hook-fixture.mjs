import { registerHooks } from 'node:module';

export const hookEffects = [];
Object.assign(globalThis, { [Symbol.for('appai.test.iframe-effects')]: hookEffects });
export function registerIframeSessionHook() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'react' && context.parentURL?.endsWith('/use-iframe-tool-session.ts')) return { url: 'fixture:iframe-hooks', shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:iframe-hooks') return { format: 'module', shortCircuit: true, source: `
        export function useState(initial) { return [initial, () => {}]; }
        export function useRef(current) { return { current }; }
        export function useCallback(fn) { return fn; }
        export function useEffect(fn) { globalThis[Symbol.for('appai.test.iframe-effects')].push(fn); }
      ` };
      return nextLoad(url, context);
    },
  });
}
