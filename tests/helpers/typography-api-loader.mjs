import { registerHooks } from 'node:module';

export function registerTypographyApiFixtures() { return registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/api-auth') return { url: 'fixture:typography-auth', shortCircuit: true };
    if (specifier === '@/lib/revalidate-seo') return { url: 'fixture:typography-revalidate', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'fixture:typography-auth') return { format: 'module', shortCircuit: true, source: 'export async function validateApiKey() { return { organizationId: "fixture-org", organization: { plan: "PRO" } }; }' };
    if (url === 'fixture:typography-revalidate') return { format: 'module', shortCircuit: true, source: 'export function revalidateSeoIndexes() {}' };
    return next(url, context);
  },
}); }
