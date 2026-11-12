import { registerHooks } from 'node:module';
export const actionHooks = { refs: [], states: [], refIndex: 0, stateIndex: 0, refreshes: 0 };
globalThis[Symbol.for('appai.test.actions-hooks')] = actionHooks;
export function registerActionsFixture() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL?.endsWith('/dashboard/pages/actions.tsx')) {
        if (specifier === 'react') return {url:'fixture:actions-hooks',shortCircuit:true};
        if (specifier === 'next/navigation') return {url:'fixture:actions-navigation',shortCircuit:true};
      }
      return next(specifier,context);
    },
    load(url,context,next) {
      const pre = 'const f = globalThis[Symbol.for("appai.test.actions-hooks")];';
      if (url === 'fixture:actions-navigation') return {format:'module',shortCircuit:true,source:pre+'export function useRouter() { return { refresh() { f.refreshes++; } }; }'};
      if (url === 'fixture:actions-hooks') return {format:'module',shortCircuit:true,source:pre+`
        export function useState(initial) { const i = f.stateIndex++; if(i>=f.states.length) f.states.push(initial); return [f.states[i],value=>{f.states[i]=value;}]; }
        export function useRef(initial) {const i=f.refIndex++;return f.refs[i]??={current:initial};}
      `};
      return next(url,context);
    },
  });
}
