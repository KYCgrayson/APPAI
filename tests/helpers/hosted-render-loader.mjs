// Isolated rendering fixtures: never connect to a database or issue identity tokens.
import { registerHooks } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));
export const fixtureDb = {
  /** @type {Array<Record<string, unknown>>} */
  rows: [], queries: [],
  /** @type {Array<Record<string, unknown>>} */
  apps: [],
  /** @type {Array<{ id: string, name: string, users: { role: string }[] }>} */
  organizations: [],
  organizationQueries: 0,
  locale: "en",
  app: { async findMany(query) { return fixtureDb.apps.filter(row => Object.entries(query.where).every(([key, value]) => row[key] === value)); } },
  appRelease: { async findMany() { return []; } },
  organization: { async findMany() { fixtureDb.organizationQueries++; return fixtureDb.organizations; } },
  hostedPage: {
    async findFirst(query) {
      fixtureDb.queries.push(query);
      const rows = fixtureDb.rows.filter(row => Object.entries(query.where).every(([key, value]) => row[key] === value));
      if (query.orderBy) rows.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      return rows[0] ?? null;
    },
    async findMany(query) {
      return fixtureDb.rows.filter(row => Object.entries(query.where).every(([key, value]) =>
        key === 'OR' ? value.some(condition => Object.entries(condition).every(([k, v]) => v && typeof v === 'object' && 'in' in v ? v.in.includes(row[k]) : row[k] === v)) : value && typeof value === 'object' && 'in' in value ? value.in.includes(row[key]) : row[key] === value));
    },
  },
};
globalThis[Symbol.for('appai.test.db')] = fixtureDb;
export function registerDirectoryFixtures() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'next-intl/server') return { url: 'fixture:intl-server', shortCircuit: true };
      if (specifier === 'next-intl') return { url: 'fixture:intl-client', shortCircuit: true };
      if (specifier === '@/i18n/navigation') return { url: 'fixture:navigation', shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:intl-server') return { format: 'module', source: `
        export async function getLocale() { return globalThis[Symbol.for('appai.test.db')].locale; }
        export async function getTranslations() { const t = key => key; t.has = () => true; return t; }
      `, shortCircuit: true };
      if (url === 'fixture:intl-client') return { format: 'module', source: `export function useLocale() { return globalThis[Symbol.for('appai.test.db')].locale; }`, shortCircuit: true };
      if (url === 'fixture:navigation') return { format: 'module', source: `
        import { createElement } from 'react';
        export function Link({ href, children, ...props }) {
          const locale = globalThis[Symbol.for('appai.test.db')].locale;
          return createElement('a', { ...props, href: (locale === 'en' ? '' : '/' + locale) + href }, children);
        }
        export function useRouter() { return { replace() { throw new Error('Unexpected navigation in SSR fixture'); } }; }
        export function usePathname() { return '/apps'; }
      `, shortCircuit: true };
      return nextLoad(url, context);
    },
  });
}
export function registerHostedRenderLoader() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@/lib/iframe-tool-session') return { url: 'fixture:identity', shortCircuit: true };
      if (specifier === '@/lib/auth') return { url: 'fixture:auth', shortCircuit: true };
      if (specifier === '@/lib/db') return { url: 'fixture:db', shortCircuit: true };
      if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith('file:'))) {
        const path = specifier.startsWith('@/') ? sourceRoot + specifier.slice(2) : fileURLToPath(new URL(specifier, context.parentURL));
        for (const suffix of ['', '.ts', '.tsx', '/index.js']) {
          if (existsSync(path + suffix) && statSync(path + suffix).isFile()) return { url: pathToFileURL(path + suffix).href, shortCircuit: true };
        }
      }
      if (context.parentURL?.startsWith('fixture:')) return nextResolve(specifier, { ...context, parentURL: import.meta.url });
      if (/^next\/[^/.]+$/.test(specifier)) return nextResolve(specifier + '.js', context);
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:identity') return { format: 'module', source: 'export function issueIframeToolSession() { throw new Error("Unexpected identity issuance in render fixture"); }', shortCircuit: true };
      if (url === 'fixture:auth') return { format: 'module', source: 'export async function auth() { return null; } export function signIn() { throw new Error("Unexpected auth in render fixture"); }', shortCircuit: true };
      if (url === 'fixture:db') return { format: 'module', source: 'export const db = globalThis[Symbol.for("appai.test.db")];', shortCircuit: true };
      if (url.endsWith('.css')) return { format: 'module', source: 'export default {};', shortCircuit: true };
      if (/\.[cm]?tsx?$/.test(url) && !url.includes('/node_modules/')) {
        return { format: 'module', source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
        }).outputText, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });
}
