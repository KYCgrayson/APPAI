// Opt-in only. Never use DATABASE_URL or dotenv; the target must be a local,
// disposable TEST_DATABASE_URL. Each run owns and drops its random schema.
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
export function sqlStatements(sql) {
  const chunks = []; let start = 0; let quote = null;
  sql = sql.replace(/--[^\n]*/g, '');
  for (let i = 0; i < sql.length; i++) {
    if (quote === '$$') { if (sql.slice(i,i+2) === '$$') {quote=null;i++;} continue; }
    if (quote) { if (sql[i] === quote) { if(sql[i+1]===quote)i++;else quote=null; } continue; }
    if(sql.slice(i,i+2)==='$$'){quote='$$';i++;}
    else if(sql[i]==="'"||sql[i]==='"')quote=sql[i];
    else if(sql[i]===';'){const chunk=sql.slice(start,i).trim();if(chunk)chunks.push(chunk);start=i+1;}
  }
  if(sql.slice(start).trim())chunks.push(sql.slice(start).trim());return chunks;
}
export async function isolatedPostgres(url) {
  const parsed = new URL(url);
  if (!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)) throw new Error('PR-5 tests require a local disposable TEST_DATABASE_URL.');
  const schema = 'pr5_' + randomUUID().replaceAll('-','');
  parsed.searchParams.set('schema',schema);parsed.searchParams.set('connection_limit','1');
  const clients = Array.from({length:3},()=>new PrismaClient({datasourceUrl:parsed.href}));
  await clients[0].$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await Promise.all(clients.map(client => client.$executeRawUnsafe(`SET search_path TO "${schema}"`)));
  for (const client of clients) {
    const [row] = await client.$queryRawUnsafe('SELECT current_schema() AS schema');
    if (row.schema !== schema) throw new Error('Test schema isolation failed');
  }
  // Old HostedPage table, before M1. Enough for real Prisma page reads/mutations.
  await clients[0].$executeRawUnsafe(`CREATE TABLE "HostedPage" (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'en', "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL, template TEXT NOT NULL DEFAULT 'APP_LANDING', title TEXT NOT NULL DEFAULT 'Fixture',
    tagline TEXT, "heroImage" TEXT, "headerLogo" TEXT, content JSONB NOT NULL DEFAULT '{}', "privacyPolicy" TEXT, "termsOfService" TEXT,
    "metaTitle" TEXT, "metaDescription" TEXT, "ogImage" TEXT, "canonicalUrl" TEXT, "customCss" TEXT, "themeColor" TEXT,
    "themeColorSecondary" TEXT, "fontFamily" TEXT, "darkMode" BOOLEAN NOT NULL DEFAULT false, "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "customDomain" TEXT, "parentSlug" TEXT, "hideFromNav" BOOLEAN NOT NULL DEFAULT false, "navOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (slug,locale))`);
  return {clients,schema,async close(){try{await clients[0].$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);}finally{await Promise.all(clients.map(c=>c.$disconnect()));}}};
}
export const deferred = () => { let resolve = () => {}; const promise = new Promise(done => {resolve=()=>done(undefined);});return {promise,resolve}; };
export async function waitForAdvisoryWait(observer, pid) {
  const deadline = Date.now()+5000;
  while(Date.now()<deadline){
    const rows=await observer.$queryRaw`SELECT 1 FROM pg_locks WHERE pid=${pid} AND locktype='advisory' AND NOT granted`;
    if(rows.length)return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error('Second connection never waited on the tree lock');
}
