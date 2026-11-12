import { matchesWhere } from './hosted-render-loader.mjs';
export function managementStore(initial = []) {
  const store = { rows: structuredClone(initial), events: /** @type {Array<Record<string, unknown>>} */ ([]), users: [{ id: 'owner', role: 'USER', organizationId: 'org-a' }, { id: 'other', role: 'USER', organizationId: 'org-b' }, { id: 'no-org', role: 'USER', organizationId: null }, { id: 'admin', role: 'ADMIN', organizationId: null }],
    organizations: [{ id: 'org-a', plan: 'PRO' }, { id: 'org-b', plan: 'PRO' }], apps: /** @type {Array<Record<string, unknown>>} */ ([]), locks: [], committed: false,
    async $transaction(fn) {
      const before = structuredClone({ rows: store.rows, events: store.events, apps: store.apps });
      store.committed = false;
      try { const result = await fn(store); store.committed = true; return result; }
      catch (error) { Object.assign(store, before); throw error; }
    },
    async $queryRaw(strings, ...values) { store.locks.push(values[0]); return []; },
    async $executeRaw(strings, ...values) {
      const sql = strings.join('?');
      const restore = sql.includes('"removalState"=NULL');
      const live = sql.includes('"removalState" IS NULL');
      const id = values[restore ? 0 : 4];
      const row = store.rows.find(row => row.id === id);
      if (!row || (live ? row.removalState !== null : row.removalState !== values[restore ? 1 : 5] || row.removalBatchId !== values[restore ? 2 : 6])) return 0;
      if (restore) Object.assign(row, { isPublished: row.wasPublished, removalState: null, removalSource: null, removedAt: null, removedById: null, removalBatchId: null, wasPublished: null });
      else Object.assign(row, { wasPublished: live ? row.isPublished : row.wasPublished, isPublished: false, removalState: values[0], removalSource: values[1], removedById: values[2], removalBatchId: values[3], removedAt: new Date('2026-11-12T00:00Z') });
      return 1;
    },
  };
  const find = (rows, query = {}) => {
    let found = rows.filter(row => matchesWhere(row, query.where));
    for (const order of [...(Array.isArray(query.orderBy) ? query.orderBy : query.orderBy ? [query.orderBy] : [])].reverse()) {
      for (const [key, direction] of Object.entries(order)) found.sort((a,b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (direction === 'desc' ? -1 : 1));
    }
    return found;
  };
  store.hostedPage = {
    async findFirst(query) { return structuredClone(find(store.rows, query)[0] ?? null); },
    async findUnique(query) { return this.findFirst({ ...query, where: query.where.slug_locale || query.where }); },
    async findMany(query) { return structuredClone(find(store.rows, query)); },
    async count(query) { return find(store.rows, query).length; },
    async groupBy(query) { return [...new Set(find(store.rows, query).map(row => row.slug))].map(slug => ({ slug })); },
    async update(query) { const row = find(store.rows, query)[0]; if (!row) throw new Error('Conditional update lost'); Object.assign(row, Object.fromEntries(Object.entries(query.data).filter(([,v]) => v !== undefined))); return row; },
    async updateMany(query) { const rows = find(store.rows, query); rows.forEach(row => Object.assign(row, query.data)); return { count: rows.length }; },
    async delete(query) { const row = find(store.rows, query)[0]; if (!row) throw new Error('Conditional delete lost'); store.rows = store.rows.filter(p => p.id !== row.id); return row; },
    async create({ data }) { const row = { id: 'created-' + store.rows.length, removalState: null, removalSource: null, removedAt: null, removedById: null, removalBatchId: null, wasPublished: null, createdAt: new Date(), updatedAt: new Date(), ...data }; store.rows.push(row); return row; },
  };
  store.hostedPageEvent = { async create({ data }) { const event = { id: 'event-' + store.events.length, createdAt: new Date(), ...data }; store.events.push(event); return event; } };
  store.user = { async findUnique(query) { return find(store.users, query)[0] ?? null; }, async findFirst(query) { return find(store.users, query)[0] ?? null; } };
  store.organization = { async findUniqueOrThrow(query) { const org = find(store.organizations, query)[0]; if (!org) throw new Error('Missing fixture org'); return org; } };
  store.app = { async findFirst(query) { return find(store.apps, query)[0] ?? null; }, async update(query) { const app = find(store.apps, query)[0]; Object.assign(app, query.data); return app; }, async updateMany(query) { find(store.apps, query).forEach(app => Object.assign(app, query.data)); }, async create({ data }) { const app = { id: 'new-app', ...data }; store.apps.push(app); return app; }, async deleteMany(query) { store.apps = store.apps.filter(app => !matchesWhere(app, query.where)); } };
  return store;
}
