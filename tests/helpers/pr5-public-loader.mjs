import { registerHooks } from 'node:module';
export const pr5State = { issued: 0, writes: 0, organizationId: 'org-a', session: /** @type {null | {organizationId: string}} */ (null), queries: [] };
globalThis[Symbol.for('appai.test.pr5')] = pr5State;
export function registerPr5PublicFixtures() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      const names = { '@/lib/iframe-tool-session': 'identity', '@/lib/auth': 'auth', '@/lib/api-auth': 'api-auth', '@/lib/revalidate-seo': 'revalidate', 'next/navigation': 'navigation' };
      return names[specifier] ? { url: 'fixture:pr5-' + names[specifier], shortCircuit: true } : nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      const source = {
        'fixture:pr5-navigation': 'export { notFound, redirect } from "next/navigation.js"; export function useRouter() { return { refresh() {} }; }',
        'fixture:pr5-identity': 'export function issueIframeToolSession() { globalThis[Symbol.for("appai.test.pr5")].issued++; return { token: "fixture-session", expiresAt: new Date("2026-11-12T01:00Z") }; }',
        'fixture:pr5-auth': 'export async function auth() { return globalThis[Symbol.for("appai.test.pr5")].session; } export function signIn() { throw new Error("Unexpected sign in"); }',
        'fixture:pr5-api-auth': 'export async function validateApiKey() { return { organizationId: globalThis[Symbol.for("appai.test.pr5")].organizationId, apiKeyId: "fixture-key", organization: { plan: "PRO" } }; }',
        'fixture:pr5-revalidate': 'export function revalidateSeoIndexes() {}',
      }[url];
      return source ? { format: 'module', shortCircuit: true, source } : nextLoad(url, context);
    },
  });
}

export function registerPr5CacheFixture(state) {
  globalThis[Symbol.for('appai.test.pr5-cache')] = state;
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === 'next/cache' ? { url: 'fixture:pr5-cache', shortCircuit: true } : nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      return url === 'fixture:pr5-cache' ? { format: 'module', shortCircuit: true, source: `
        const state = globalThis[Symbol.for('appai.test.pr5-cache')];
        export function revalidatePath(...args) { state.paths.push(args); if (state.fail) throw new Error('fixture'); }
        export function revalidateTag(...args) { state.tags.push(args); if (state.fail) throw new Error('fixture'); }
      ` } : nextLoad(url, context);
    },
  });
}
