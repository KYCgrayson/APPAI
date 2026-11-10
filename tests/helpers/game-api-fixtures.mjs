import { registerHooks } from 'node:module';

export const gameApiFixture = { page: null, writes: 0, issued: /** @type {Array<{src: string}>} */ ([]) };
globalThis[Symbol.for('appai.test.game-api')] = gameApiFixture;
export function registerGameApiFixtures() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      const modules = { '@/lib/db': 'db', '@/lib/api-auth': 'api-auth', '@/lib/revalidate-seo': 'revalidate', '@/lib/iframe-tool-session': 'identity' };
      return modules[specifier] ? { url: 'fixture:game-' + modules[specifier], shortCircuit: true } : nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:game-api-auth') return { format: 'module', shortCircuit: true, source: 'export async function validateApiKey() { return { organizationId: "fixture-org", organization: { plan: "FREE" } }; }' };
      if (url === 'fixture:game-revalidate') return { format: 'module', shortCircuit: true, source: 'export function revalidateSeoIndexes() {}' };
      if (url === 'fixture:game-identity') return { format: 'module', shortCircuit: true, source: 'export function issueIframeToolSession(input) { globalThis[Symbol.for("appai.test.game-api")].issued.push(input); return { token: "fixture-session", expiresAt: new Date("2030-01-01") }; }' };
      if (url === 'fixture:game-db') return { format: 'module', shortCircuit: true, source: `
        const f = globalThis[Symbol.for('appai.test.game-api')];
        export const db = {
          hostedPage: {
            async findUnique() { return f.page; },
            async findFirst({ where }) { return where.template === 'PERSON' ? null : f.page; },
            async findMany() { return f.page ? [f.page] : []; },
            async count() { return 0; }, async groupBy() { return []; },
            async create({ data }) { f.writes++; return f.page = { id: 'fixture-page', createdAt: new Date(), updatedAt: new Date(), ...data }; },
            async update({ data }) { f.writes++; return f.page = { ...f.page, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), updatedAt: new Date() }; },
          },
          user: { async findFirst() { return { id: 'fixture-admin' }; } },
          app: { async findFirst() { return null; }, async create() {}, async updateMany() {} },
        };
      ` };
      return nextLoad(url, context);
    },
  });
}
