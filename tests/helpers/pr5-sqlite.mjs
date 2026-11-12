// Execute the production parameterized aggregate SQL, rather than emulating its filters.
import { DatabaseSync } from 'node:sqlite';
export function dashboardStore(rows) {
  const database = new DatabaseSync(':memory:');
  const columns = ['id', 'organizationId', 'parentSlug', 'slug', 'title', 'template', 'locale', 'isDefault', 'isPublished', 'createdAt', 'privacyPolicy', 'termsOfService'];
  database.exec(`CREATE TABLE HostedPage (${columns.map(column => '"' + column + '"').join(', ')})`);
  const insert = database.prepare(`INSERT INTO HostedPage VALUES (${columns.map(() => '?').join(', ')})`);
  const value = input => input instanceof Date ? input.toISOString() : typeof input === 'boolean' ? Number(input) : input ?? null;
  for (const row of rows) insert.run(...columns.map(column => value(row[column])));
  return {
    /** @type {string[]} */
    queries: [],
    async $queryRaw(query) {
      this.queries.push(query.sql);
      return database.prepare(query.sql).all(...query.values.map(value)).map(row => {
        for (const column of ['isDefault', 'isPublished', 'hasPrivacy', 'hasTerms']) if (column in row) row[column] = !!row[column];
        if (row.createdAt) row.createdAt = new Date(row.createdAt);
        return row;
      });
    },
    close() { database.close(); },
  };
}
