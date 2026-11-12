#!/usr/bin/env node
// Read-only schema verification. No dotenv, no implicit application connection.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const removalColumns = { removalState: 'text', removalSource: 'text', removedAt: 'timestamp without time zone', removedById: 'text', removalBatchId: 'text', wasPublished: 'boolean' };
const eventColumns = { id: 'text', createdAt: 'timestamp without time zone', batchId: 'text', organizationId: 'text', pageId: 'text', slug: 'text', parentSlug: 'text', locale: 'text', action: 'text', fromState: 'text', toState: 'text', actorKind: 'text', actorUserId: 'text', apiKeyId: 'text' };
const nullableEvents = new Set(['parentSlug', 'fromState', 'toState', 'actorUserId', 'apiKeyId']);
const expectedCheck = `CHECK (("removalState" IS NULL AND "removalSource" IS NULL AND "removedAt" IS NULL AND "removedById" IS NULL AND "removalBatchId" IS NULL AND "wasPublished" IS NULL) OR ("removalState" IS NOT NULL AND "removalState" IN ('UNPUBLISHED','DELETED') AND "removalSource" IS NOT NULL AND "removalSource" IN ('OWNER','ADMIN') AND "removedAt" IS NOT NULL AND "removedById" IS NOT NULL AND "removalBatchId" IS NOT NULL AND "wasPublished" IS NOT NULL AND "isPublished" = false))`;
// pg_get_constraintdef rewrites IN to ANY(ARRAY[...]) and adds casts/parens.
export function normalizeCheck(value) {
  const sql = value.replace(/::(?:text\[\]|text|boolean)/g, '')
    .replace(/=\s*ANY\s*\(\s*ARRAY\s*\[([^\]]+)\]\s*\)/gi, ' IN ($1)')
    .replace(/^CHECK\s*/i, '').replace(/"/g, '').toLowerCase();
  const tokens = sql.match(/'[^']*'|[a-z_][a-z_0-9]*|[(),=]|\S/g) || [];
  let position = 0;
  const eat = word => { if (tokens[position++] !== word) throw new Error('Invalid CHECK expression'); };
  function join(operator, entries) {
    return { [operator]: entries.flatMap(entry => entry[operator] || [entry]) };
  }
  function primary() {
    if (tokens[position] === '(') { position++; const expr = or(); eat(')'); return expr; }
    const field = tokens[position++];
    if (tokens[position] === 'is') { position++; const negated = tokens[position] === 'not'; if (negated) position++; eat('null'); return { field, op: negated ? 'is not null' : 'is null' }; }
    if (tokens[position] === 'in') { position++; eat('('); const values = [tokens[position++]]; while (tokens[position] === ',') { position++; values.push(tokens[position++]); } eat(')'); return { field, op: 'in', values }; }
    eat('='); return { field, op: '=', value: tokens[position++] };
  }
  function and() { const entries = [primary()]; while (tokens[position] === 'and') { position++; entries.push(primary()); } return entries.length === 1 ? entries[0] : join('and', entries); }
  function or() { const entries = [and()]; while (tokens[position] === 'or') { position++; entries.push(and()); } return entries.length === 1 ? entries[0] : join('or', entries); }
  try { const result = or(); if (position !== tokens.length) return sql; return JSON.stringify(result); }
  catch { return sql; }
}
export async function verifyRemovalSchema(query) {
  const failures = [];
  const columns = await query(`SELECT table_name, column_name, data_type, is_nullable, datetime_precision, column_default FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('HostedPage','HostedPageEvent')`);
  for (const [table, expected] of [['HostedPage', removalColumns], ['HostedPageEvent', eventColumns]]) {
    for (const [name, type] of Object.entries(expected)) {
      const column = columns.find(c => c.table_name === table && c.column_name === name);
      const nullable = table === 'HostedPage' || nullableEvents.has(name) ? 'YES' : 'NO';
      if (!column || column.data_type !== type || column.is_nullable !== nullable || (type.startsWith('timestamp') && column.datetime_precision !== 3) || (table === 'HostedPage' && column.column_default !== null)) failures.push(`${table}.${name}: missing or incompatible type/nullability/precision`);
    }
  }
  const constraints = await query(`SELECT conname, contype, convalidated, conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('"HostedPage"'::regclass, '"HostedPageEvent"'::regclass)`);
  const check = constraints.find(c => c.conname === 'HostedPage_removal_consistent');
  if (!check?.convalidated || check.contype !== 'c' || normalizeCheck(check.definition) !== normalizeCheck(expectedCheck)) failures.push('HostedPage_removal_consistent: missing, unvalidated or incompatible CHECK');
  if (constraints.some(c => c.contype === 'f' && /HostedPageEvent/.test(c.table_name))) failures.push('HostedPageEvent must have no foreign keys');
  const primary = constraints.find(c => c.conname === 'HostedPageEvent_pkey');
  if (!primary || primary.definition !== 'PRIMARY KEY (id)') failures.push('HostedPageEvent: incompatible primary key');
  const indexes = await query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename IN ('HostedPage','HostedPageEvent')`);
  for (const [name, table, keys] of [
    ['HostedPage_organizationId_createdAt_idx', 'HostedPage', '"organizationId", "createdAt"'],
    ['HostedPageEvent_organizationId_createdAt_idx', 'HostedPageEvent', '"organizationId", "createdAt"'],
    ['HostedPageEvent_pageId_createdAt_idx', 'HostedPageEvent', '"pageId", "createdAt"'],
  ]) {
    const index = indexes.find(i => i.indexname === name);
    if (!index || !index.indexdef.includes(`"${table}" USING btree (${keys})`) || / WHERE | UNIQUE /i.test(index.indexdef)) failures.push(`${name}: missing or incompatible index`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
  return 'Hosted-page removal schema verified.';
}
async function main() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL (owner application) or TEST_DATABASE_URL (isolated tests) explicitly.');
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({ datasources: { db: { url } } });
  try { console.log(await verifyRemovalSchema(sql => client.$queryRawUnsafe(sql))); }
  finally { await client.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
