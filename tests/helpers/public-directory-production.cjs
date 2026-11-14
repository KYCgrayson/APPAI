/* eslint-disable @typescript-eslint/no-require-imports -- Node preload for isolated production-build QA. */
// Opt-in mock only. Never reads application credentials or opens a DB connection.
if (process.env.DIRECTORY_CACHE_QA !== '1' || process.env.DATABASE_URL !== 'postgresql://mock:mock@127.0.0.1:1/mock') {
  throw new Error('Directory QA requires explicit opt-in and the unreachable mock database URL.');
}
const fs = require('node:fs');
const at = new Date('2026-11-13T00:00:00Z');
const apps = ['website', 'tool', 'native', 'person'].map((kind, i) => ({
  id: `fixture-${kind}`, organizationId: 'fixture-org', hostedPageSlug: `fixture-${kind}`,
  name: `Fixture ${kind}`, tagline: 'Fictional cache verification listing',
  description: 'Fictional application for local verification.', category: 'OTHER', tags: [],
  isApproved: true, isFeatured: true, appType: kind === 'native' ? 'fixture-native' : null,
  logoUrl: null, screenshots: [], url: null, iosUrl: null, androidUrl: null,
  createdAt: new Date(at.getTime() - i * 1000), updatedAt: at,
}));
const pages = apps.flatMap(app => ['en', 'zh-TW'].map(locale => ({
  id: `${app.id}-${locale}`, organizationId: app.organizationId, slug: app.hostedPageSlug,
  parentSlug: null, locale, isDefault: locale === 'en', isPublished: true,
  title: locale === 'en' ? app.name : `測試${app.id}`,
  tagline: locale === 'en' ? app.tagline : '本機快取驗證用虛構內容',
  metaDescription: null, canonicalUrl: null, template: app.id.endsWith('person') ? 'PERSON' : 'APP_LANDING',
  content: { sections: app.id.endsWith('tool') ? [{ type: 'iframe-tool', data: { src: 'https://example.com' } }] : [] },
  createdAt: at, updatedAt: at, privacyPolicy: null, termsOfService: null,
})));
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(condition => matches(row, condition));
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
    return (row[key] ?? null) === value;
  });
}
function query(model, rows, args = {}) {
  const log = process.env.DIRECTORY_QUERY_LOG || '/private/tmp/appai-92a/queries.jsonl';
  fs.appendFileSync(log, JSON.stringify({ model, method: 'read' }) + '\n');
  let result = rows.filter(row => matches(row, args.where));
  if (args.orderBy) {
    const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
    result.sort((a, b) => {
      for (const order of orders) for (const [key, direction] of Object.entries(order)) {
        if (a[key] < b[key]) return direction === 'desc' ? 1 : -1;
        if (a[key] > b[key]) return direction === 'desc' ? -1 : 1;
      }
      return 0;
    });
  }
  if (args.skip) result = result.slice(args.skip);
  if (args.take) result = result.slice(0, args.take);
  return result;
}
const admin = { id: 'fixture-admin', name: 'Fictional Admin', email: 'admin@example.test',
  role: 'ADMIN', organizationId: 'fixture-org', emailVerified: null, image: null };
globalThis.prisma = {
  hostedPage: {
    findMany: async args => query('hostedPage', pages, args),
    count: async args => query('hostedPage', pages, args).length,
    findFirst: async args => query('hostedPage', pages, args)[0] ?? null,
  },
  app: {
    update: async ({ where, data }) => Object.assign(apps.find(app => app.id === where.id), data),
    findMany: async args => query('app', apps, args),
    findFirst: async args => query('app', apps, args)[0] ?? null,
  },
  appRelease: { findMany: async args => query('appRelease', [], args) },
  organization: { findMany: async args => query('organization', [{ id: 'fixture-org', name: 'Fixture Studio', users: [] }], args) },
  session: {
    update: async ({ data }) => data,
    delete: async () => {},
    findUnique: async ({ where }) => where.sessionToken === 'fixture-admin-session'
      ? { sessionToken: where.sessionToken, userId: admin.id, expires: new Date(Date.now() + 3600000), user: admin } : null,
  },
  user: { findUnique: async () => admin },
};
module.exports = { apps, pages };
