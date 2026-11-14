import { registerHooks } from 'node:module';

// Stable, real local CSS class names in SSR fixtures (not Next build hashes).
export function registerProjectCardCss() {
  return registerHooks({ load(url, context, next) {
    return url.endsWith('editorial.module.css')
      ? { format: 'module', shortCircuit: true, source: 'export default new Proxy({}, { get: (_, key) => key });' }
      : next(url, context);
  } });
}
