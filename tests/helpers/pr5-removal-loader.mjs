import { registerHooks } from 'node:module';
export function registerRemovalFixtures(state) {
 globalThis[Symbol.for('appai.test.removal')] = state;
return registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/src/lib/admin.ts') && ['./auth', './db'].includes(specifier)) return { url: 'fixture:removal-' + (specifier === './auth' ? 'auth' : 'db'), shortCircuit: true };
    const name = ({ "@/lib/db": "db", "@/lib/auth": "auth", "@/lib/api-auth": "api", "@/lib/revalidate-seo": "cache" })[specifier];
    return name ? { url: "fixture:removal-" + name, shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    const pre = 'const state = globalThis[Symbol.for("appai.test.removal")];';
    const body = ({
      "fixture:removal-db": 'export const db = new Proxy({}, { get(_, key) { return state.store[key]; } });',
      "fixture:removal-auth": 'export async function auth() { return state.session; }',
      "fixture:removal-api": 'export async function validateApiKey(header) { return header === "Bearer fixture" ? { organizationId: "org-a", apiKeyId: "key-fixture", organization: { plan: state.store.organizations[0].plan } } : null; }',
      "fixture:removal-cache": 'export function revalidateSeoIndexes() { state.cache.push(state.store.committed); return true; }',
    })[url];
    return body ? { format: "module", shortCircuit: true, source: pre + body } : next(url, context);
  },
});

}
