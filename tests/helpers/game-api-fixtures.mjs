import { registerHooks } from 'node:module';

export const gameApiFixture = { page: /** @type {Record<string, unknown> | null} */ (null),
  apps: /** @type {Array<{id: string, category: string, isApproved: boolean, isFeatured: boolean}>} */ ([]),
  appQueries: /** @type {Array<{isApproved?: boolean, isFeatured?: boolean}>} */ ([]), variantCount: 0, writes: 0, issued: /** @type {Array<{src: string, section: number}>} */ ([]) };
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
            async findFirst({ where }) { return f.page && Object.entries(where).every(([key, value]) => f.page[key] === value) ? f.page : null; },
            async findMany() { return f.page ? [f.page] : []; },
            async count() { return f.variantCount; }, async groupBy() { return []; },
            async create({ data }) { f.writes++; return f.page = { id: 'fixture-page', createdAt: new Date(), updatedAt: new Date(), ...data }; },
            async updateMany({ data }) { if (f.page) Object.assign(f.page, data); },
            async update({ data }) { f.writes++; return f.page = { ...f.page, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), updatedAt: new Date() }; },
          },
          user: { async findFirst() { return { id: 'fixture-admin' }; } },
          app: {
            async findFirst({ where }) { return f.apps.find(app => Object.entries(where).every(([key, value]) => app[key] === value)) ?? null; },
            async findUnique(query) { return this.findFirst(query); },
            async findMany({ where }) { f.appQueries.push(where); return f.apps.filter(app => Object.entries(where).every(([key, value]) => app[key] === value)); },
            async create({ data }) { const app = { id: 'fixture-app-' + f.apps.length, isFeatured: true, tags: [], ...data }; f.apps.push(app); return app; },
            async update({ where, data }) { const app = await this.findFirst({ where }); Object.assign(app, data); return app; },
            async updateMany({ where, data }) { for (const app of await this.findMany({ where })) Object.assign(app, data); },
          },
        };
      ` };
      return nextLoad(url, context);
    },
  });
}

export function currentGamePage() { return gameApiFixture.page; }
