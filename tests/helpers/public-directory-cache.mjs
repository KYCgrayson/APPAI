import { registerHooks } from 'node:module';

export function registerPublicDirectoryCache(state) {
  globalThis[Symbol.for('appai.test.directory-cache')] = state;
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'next/cache') return { url: 'fixture:public-directory-cache', shortCircuit: true };
      if (specifier === '@/lib/admin') return { url: 'fixture:directory-admin', shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'fixture:directory-admin') return { format: 'module', shortCircuit: true,
        source: `export async function requireAdmin() { return globalThis[Symbol.for('appai.test.directory-cache')].admin ? { id: 'fixture-admin' } : null; }` };
      if (url !== 'fixture:public-directory-cache') return nextLoad(url, context);
      return { format: 'module', shortCircuit: true, source: `
        const state = globalThis[Symbol.for('appai.test.directory-cache')];
        export function unstable_cache(fn, keys, options) {
          state.registrations.push({keys, options});
          return async (...args) => {
            const key = JSON.stringify([keys, args]);
            if (state.entries.has(key)) return JSON.parse(state.entries.get(key).json);
            const result = await fn(...args);
            const json = JSON.stringify(result);
            state.writes.push({ keys, args, options, bytes: Buffer.byteLength(json), json });
            state.entries.set(key, {json, tags: options.tags});
            return JSON.parse(json);
          };
        }
        export function revalidateTag(tag, options) {
          state.invalidations.push([tag, options]);
          if (state.failTag === tag) throw new Error('Fixture invalidation failure');
          if (options.expire === 0) for (const [key, entry] of state.entries) if (entry.tags.includes(tag)) state.entries.delete(key);
        }
        export function revalidatePath() {}
      ` };
    },
  });
}
