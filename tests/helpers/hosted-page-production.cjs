/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in production QA preload. */
// Only fictional rows. Fail closed; never instantiate a Prisma connection.
if (process.env.HOSTED_CACHE_QA !== '1' || process.env.DATABASE_URL !== 'postgresql://mock:mock@127.0.0.1:1/mock') {
  throw new Error('Hosted QA requires opt-in and the exact unreachable mock URL.');
}
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const at = new Date('2026-11-13T00:00:00Z');
const org = { id: 'fixture-org', name: 'Fictional Studio', plan: 'PRO', users: [] };
function page(slug, extra = {}) {
  return { id: `${slug}-en`, slug, organizationId: org.id, parentSlug: null, locale: 'en', isDefault: true,
    isPublished: true, template: 'APP_LANDING', title: `Fixture ${slug}`, tagline: 'Fictional cache verification',
    heroImage: null, headerLogo: null, privacyPolicy: 'Fictional privacy policy.', termsOfService: 'Fictional terms.',
    metaTitle: null, metaDescription: null, ogImage: null, canonicalUrl: null, customCss: null,
    themeColor: '#123456', themeColorSecondary: null, fontFamily: null, darkMode: false,
    hideFromNav: false, navOrder: null, createdAt: at, updatedAt: at, customDomain: null,
    removalState: null, removalSource: null, removedAt: null, removedById: null, removalBatchId: null, wasPublished: null,
    content: { sections: [{ type: 'about', order: 0, data: { heading: 'Fictional overview', text: 'Fictional publisher content.' } }] }, ...extra };
}
const pages = [
  page('fixture-person', { template: 'PERSON', content: { sections: [
    { type: 'profile-header', order: 0, data: { name: 'Fictional Creator', bio: 'A fictional profile for cache verification.' } },
    { type: 'about', order: 1, data: { text: 'Fictional PERSON biography.' } },
  ] } }),
  page('fixture-app'), page('fixture-app', { id: 'fixture-app-zh', locale: 'zh-TW', isDefault: false, title: '虛構軟體', tagline: '繁體中文快取驗證',
    content: { sections: [{ type: 'about', order: 0, data: { text: '這是虛構軟體的說明。' } }] } }),
  page('fixture-child', { parentSlug: 'fixture-app', title: 'Fictional child' }),
  page('fixture-tool', { content: { sections: [{ type: 'iframe-tool', order: 0, data: { src: 'https://fixture.pages.dev/tool', heading: 'Fictional public tool', identity: true } }] } }),
  page('fixture-login', { content: { sections: [{ type: 'iframe-tool', order: 0, data: { src: 'https://fixture.pages.dev/private', heading: 'Fictional gated tool', access: 'login', identity: true } }] } }),
  page('fixture-no-policy', { privacyPolicy: null, termsOfService: null }),
  page('fixture-large', { customCss: '/* oversized-fixture ' + 'x'.repeat(1_810_000) + ' */' }),
];
const apps = ['person', 'app', 'tool', 'login'].map((kind, i) => ({ id: `listing-${kind}`, organizationId: org.id,
  hostedPageSlug: `fixture-${kind}`, name: `Fixture ${kind}`, tagline: 'Fictional listing', description: 'Fictional listing description',
  category: 'OTHER', tags: [], isApproved: true, isFeatured: true, appType: kind === 'app' ? 'fixture-native' : null,
  logoUrl: null, screenshots: [], url: null, iosUrl: null, androidUrl: null, createdAt: new Date(+at - i * 1000), updatedAt: at }));
const users = ['user', 'other', 'admin'].map(kind => ({ id: `fixture-${kind}`, name: `Fictional ${kind}`, email: `${kind}@example.test`,
  organizationId: org.id, role: kind === 'admin' ? 'ADMIN' : 'USER', emailVerified: null, image: null }));
const sessions = users.map(user => ({ sessionToken: `${user.id}-session`, userId: user.id, user, expires: new Date('2099-01-01T00:00Z') }));
const apiKeys = [{ id: 'fixture-key', keyHash: createHash('sha256').update('appai_sk_FICTIONAL_QA_ONLY').digest('hex'),
  organizationId: org.id, organization: org, isActive: true, expiresAt: null }];
const tables = { hostedPage: pages, app: apps, user: users, session: sessions, organization: [org], apiKey: apiKeys,
  appRelease: [], hostedPageEvent: [], pageView: [] };
function record(model, operation, type) {
  const file = process.env.HOSTED_QUERY_LOG;
  if (!file) throw new Error('HOSTED_QUERY_LOG is required');
  fs.appendFileSync(file, JSON.stringify({ model, operation, type }) + '\n');
}
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some(w => matches(row, w));
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(w => matches(row, w));
    if (key === 'NOT') return !matches(row, value);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('not' in value) return (row[key] ?? null) !== value.not;
      if ('equals' in value) return row[key] === value.equals;
      if (key === 'slug_locale') return matches(row, value);
      throw new Error(`Unsupported QA filter: ${key}`);
    }
    return (row[key] ?? null) === value;
  });
}
function query(rows, args = {}) {
  let found = rows.filter(row => matches(row, args.where));
  const order = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) : [];
  found.sort((a, b) => { for (const item of order) for (const [key, dir] of Object.entries(item)) {
    if (a[key] < b[key]) return dir === 'desc' ? 1 : -1;
    if (a[key] > b[key]) return dir === 'desc' ? -1 : 1;
  } return 0; });
  if (args.skip) found = found.slice(args.skip);
  if (args.take !== undefined) found = found.slice(0, args.take);
  return found;
}
const project = (row, args) => row ? structuredClone(args.select ? Object.fromEntries(Object.keys(args.select).filter(k => args.select[k]).map(k => [k, row[k]])) : row) : null;
const delegates = Object.fromEntries(Object.entries(tables).map(([model, rows]) => [model, new Proxy({}, {
  get(_, operation) {
    if (typeof operation !== 'string') return undefined;
    return async (args = {}) => {
      const reads = ['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'count', 'groupBy'];
      const writes = ['create', 'update', 'updateMany', 'delete', 'deleteMany'];
      if (!reads.includes(operation) && !writes.includes(operation)) throw new Error(`Unexpected QA operation ${model}.${operation}`);
      record(model, operation, reads.includes(operation) ? 'read' : 'write');
      const found = query(rows, args);
      if (operation === 'count') return found.length;
      if (operation === 'groupBy') return [...new Map(found.map(row => [JSON.stringify(args.by.map(k => row[k])), Object.fromEntries(args.by.map(k => [k, row[k]]))])).values()];
      if (operation === 'findMany') return found.map(row => project(row, args));
      if (operation.startsWith('find')) { if (!found[0] && operation.endsWith('OrThrow')) throw new Error('QA row missing'); return project(found[0], args); }
      if (operation === 'create') {
        const created = model === 'hostedPage' ? page(args.data.slug, { id: `${args.data.slug}-${args.data.locale || 'en'}`, ...args.data }) : { id: `${model}-${rows.length}`, ...args.data };
        rows.push(created); return project(created, args);
      }
      if (operation.startsWith('update')) {
        const selected = operation === 'updateMany' ? found : found.slice(0, 1);
        for (const row of selected) Object.assign(row, Object.fromEntries(Object.entries(args.data).filter(([, value]) => value !== undefined)));
        return operation === 'updateMany' ? { count: selected.length } : project(selected[0], args);
      }
      const selected = operation === 'deleteMany' ? found : found.slice(0, 1);
      for (const row of selected) rows.splice(rows.indexOf(row), 1);
      return operation === 'deleteMany' ? { count: selected.length } : project(selected[0], args);
    };
  },
})]));
const db = new Proxy({ ...delegates,
  async $transaction(callback) {
    record('$transaction', 'begin', 'transaction');
    const backup = structuredClone(tables);
    try { const result = await callback(db); record('$transaction', 'commit', 'transaction'); return result; }
    catch (error) { for (const [name, rows] of Object.entries(tables)) rows.splice(0, rows.length, ...backup[name]); record('$transaction', 'rollback', 'transaction'); throw error; }
  },
  async $queryRaw(strings) {
    record('$raw', '$queryRaw', 'read');
    if (!strings.join('?').includes('pg_advisory_xact_lock')) throw new Error('Unknown QA raw read');
    return [{ locked: '' }];
  },
  async $executeRaw(strings, ...values) {
    record('$raw', '$executeRaw', 'write');
    const sql = strings.join('?');
    if (!sql.startsWith('UPDATE "HostedPage" SET')) throw new Error('Unknown QA raw write');
    if (sql.includes('"isPublished"="wasPublished"')) {
      const [id, state, batch] = values; const row = pages.find(p => p.id === id && p.removalState === state && p.removalBatchId === batch);
      if (!row) return 0;
      Object.assign(row, { isPublished: row.wasPublished, removalState: null, removalSource: null, removedAt: null, removedById: null, removalBatchId: null, wasPublished: null }); return 1;
    }
    const [state, source, actor, batch, id, previous, previousBatch] = values;
    const row = pages.find(p => p.id === id && (sql.includes('IS NULL') ? p.removalState === null : p.removalState === previous && p.removalBatchId === previousBatch));
    if (!row) return 0;
    if (sql.includes('"wasPublished"="isPublished"')) row.wasPublished = row.isPublished;
    Object.assign(row, { isPublished: false, removalState: state, removalSource: source, removedById: actor, removalBatchId: batch, removedAt: at }); return 1;
  },
}, { get(target, property) { if (property in target) return target[property]; throw new Error(`Unexpected QA delegate ${String(property)}`); } });
globalThis.prisma = db;
module.exports = { pages, apps, users, matches };
