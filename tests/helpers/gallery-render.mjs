import { registerHooks } from 'node:module';

// Same stable CSS-name fixture pattern as project-cards; use real CSS in browser QA.
export function registerGalleryCss() {
  return registerHooks({ load(url, context, next) {
    return url.endsWith('gallery.module.css')
      ? { format: 'module', shortCircuit: true, source: 'export default new Proxy({}, { get: (_, key) => key });' }
      : next(url, context);
  } });
}
