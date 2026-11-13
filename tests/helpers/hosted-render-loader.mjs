// Isolated rendering fixtures: never connect to a database or issue identity tokens.
import { registerHooks } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));
/** Evaluate the Prisma filters used by public read queries against fictional rows. */
export function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true; // Prisma omits undefined filters and update fields.
    if (key === 'OR') return value.some(condition => matchesWhere(row, condition));
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(condition => matchesWhere(row, condition));
    if (key === 'NOT') return !matchesWhere(row, value);
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if ('equals' in value) return row[key] === value.equals;
      if ('not' in value) return (row[key] ?? null) !== value.not;
    }
    return (row[key] ?? null) === value;
  });
}
function queryRows(rows, query) {
  let result = rows.filter(row => matchesWhere(row, query.where));
  if (query.orderBy) {
    const orders = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
    result.sort((a, b) => {
      for (const order of orders) for (const [key, direction] of Object.entries(order)) {
        const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
        if (comparison) return direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
  }
  if (query.take !== undefined) result = result.slice(0, query.take);
  return result;
}
export const fixtureDb = {
  /** @type {Array<Record<string, unknown>>} */
  rows: [], queries: [],
  /** @type {Array<Record<string, unknown>>} */
  apps: [],
  /** @type {Array<{ id: string, name: string, users: { role: string }[] }>} */
  organizations: [],
  organizationQueries: 0,
  locale: "en",
  hostedPath: "",
  acceptLanguage: "",
  async $transaction(fn) { return fn(fixtureDb); },
  async $queryRaw() { return []; },
  app: {
    async findUnique(query) { return fixtureDb.apps.find(row => row.id === query.where.id) ?? null; },
    async findFirst(query) { return queryRows(fixtureDb.apps, query)[0] ?? null; },
    async findMany(query) { return queryRows(fixtureDb.apps, query); },
  },
  appRelease: { async findMany() { return []; } },
  organization: { async findMany() { fixtureDb.organizationQueries++; return fixtureDb.organizations; } },
  hostedPage: {
    async count(query) { return (await fixtureDb.hostedPage.findMany(query)).length; },
    async findFirst(query) {
      fixtureDb.queries.push(query);
      return queryRows(fixtureDb.rows, query)[0] ?? null;
    },
    async findMany(query) { return queryRows(fixtureDb.rows, query); },
  },
};
globalThis[Symbol.for('appai.test.db')] = fixtureDb;

export const fixtureSitemapCache = {
  entries: new Map(),
  /** @type {Array<{ keys: string[], args: string[], options: { revalidate: number, tags: string[] }, bytes: number }>} */
  writes: [],
};
globalThis[Symbol.for('appai.test.sitemap-cache')] = fixtureSitemapCache;

export function registerSitemapFixtures() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === 'next/cache' ? { url: 'fixture:sitemap-cache', shortCircuit: true } : nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url !== 'fixture:sitemap-cache') return nextLoad(url, context);
      return { format: 'module', shortCircuit: true, source: `
        const { entries, writes } = globalThis[Symbol.for('appai.test.sitemap-cache')];
        export function revalidateTag() { entries.clear(); }
        export function revalidatePath() {}
        export function unstable_cache(fn, keys, options) {
          return async (...args) => {
            const key = JSON.stringify([keys, args]);
            if (entries.has(key)) return entries.get(key);
            const json = JSON.stringify(await fn(...args));
            writes.push({ keys, args, options, bytes: Buffer.byteLength(json) });
            // Mimic Next's JSON round-trip (Date values become strings).
            entries.set(key, JSON.parse(json));
            return entries.get(key);
          };
        }
      ` };
    },
  });
}

export function registerHostedHeaders() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === 'next/headers' ? { url: 'fixture:hosted-headers', shortCircuit: true } : nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      return url === 'fixture:hosted-headers' ? { format: 'module', shortCircuit: true, source: `
        export async function headers() { return new Headers({ 'x-appai-hosted-path': globalThis[Symbol.for('appai.test.db')].hostedPath, 'accept-language': globalThis[Symbol.for('appai.test.db')].acceptLanguage }); }
        export async function cookies() { return { get() { return undefined; } }; }
      ` } : nextLoad(url, context);
    },
  });
}
export function registerDirectoryFixtures({ translated = false } = {}) {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'next-intl/server') return { url: 'fixture:intl-server', shortCircuit: true };
      if (specifier === 'next-intl') return { url: 'fixture:intl-client', shortCircuit: true };
      if (specifier === '@/i18n/navigation') return { url: 'fixture:navigation', shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:intl-server') return { format: 'module', source: `
        import { readFileSync } from 'node:fs';
        import { createTranslator } from 'use-intl/core';
        export async function getLocale() { return globalThis[Symbol.for('appai.test.db')].locale; }
        export async function getTranslations(input) {
          if (!${translated}) { const t = key => key; t.has = () => true; return t; }
          const locale = typeof input === 'object' && input.locale || await getLocale();
          const namespace = typeof input === 'string' ? input : input?.namespace;
          const messages = JSON.parse(readFileSync(${JSON.stringify(sourceRoot)} + 'messages/' + locale + '.json', 'utf8'));
          const lookup = key => [...(namespace ? namespace.split('.') : []), ...key.split('.')].reduce((value, part) => value?.[part], messages);
          const t = (key, values = {}) => {
            const value = lookup(key);
            if (typeof value !== 'string') throw new Error('Missing translation: ' + locale + '/' + namespace + '/' + key);
            return value.replace(/\\{(\\w+)\\}/g, (match, field) => values[field] ?? match);
          };
          t.has = key => lookup(key) !== undefined;
          t.rich = createTranslator({ locale, namespace, messages }).rich;
          return t;
        }
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
      if (specifier === 'next/image') return { url: 'fixture:next-image', shortCircuit: true };
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
      if (url === 'fixture:next-image') return { format: 'module', source: 'export { Image as default } from "next/dist/client/image-component.js";', shortCircuit: true };
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


export function registerGameRenderState() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'react' && context.parentURL?.endsWith('/GameSection.tsx')) return { url: 'fixture:game-state', shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:game-state') return { format: 'module', shortCircuit: true, source: `
        export * from "react";
        import { useState as realUseState } from "react";
        export function useState(initial) { return realUseState(globalThis[Symbol.for("appai.test.game-render")].expanded || initial); }
      ` };
      return nextLoad(url, context);
    },
  });
}

export function registerPlayCompatibilityEffects() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'react' && context.parentURL?.endsWith('/GamePlayCompatibility.tsx')) {
        return { url: 'fixture:play-effects', shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:play-effects') return {
        format: 'module', shortCircuit: true,
        source: 'export function useEffect(effect) { globalThis[Symbol.for("appai.test.play-effects")].push(effect); }',
      };
      return nextLoad(url, context);
    },
  });
}

/** Render real hosted chrome in open/closed and signed-in/out states. */
export function registerHostedNavigationState(state) {
  globalThis[Symbol.for("appai.test.hosted-navigation")] = state;
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "react" && context.parentURL?.endsWith("/MobileMenu.tsx")) return { url: "fixture:hosted-menu-state", shortCircuit: true };
      if (specifier === "@/lib/auth") return { url: "fixture:hosted-navigation-auth", shortCircuit: true };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url === "fixture:hosted-menu-state") return { format: "module", shortCircuit: true, source: `
        export * from "react";
        import { useState as realUseState } from "react";
        export function useState(initial) { return realUseState(globalThis[Symbol.for("appai.test.hosted-navigation")].open || initial); }
      ` };
      if (url === "fixture:hosted-navigation-auth") return { format: "module", shortCircuit: true, source: `
        export async function auth() { const user = globalThis[Symbol.for("appai.test.hosted-navigation")].user; return user ? { user } : null; }
        export function signIn() { throw new Error("Unexpected sign-in in render fixture"); }
      ` };
      return next(url, context);
    },
  });
}

/** Supply the active management URL while server-rendering the real client trail. */
export function registerBreadcrumbNavigation() {
  return registerHooks({
    resolve(specifier, context, next) {
      return specifier === "next/navigation" && context.parentURL?.endsWith("/ManagementBreadcrumb.tsx")
        ? { url: "fixture:breadcrumb-navigation", shortCircuit: true } : next(specifier, context);
    },
    load(url, context, next) {
      return url === "fixture:breadcrumb-navigation" ? { format: "module", shortCircuit: true, source: `
        export function usePathname() { return globalThis[Symbol.for('appai.test.db')].hostedPath; }
      ` } : next(url, context);
    },
  });
}
