import { registerHooks } from 'node:module';

export function registerDiagramCss() {
  return registerHooks({ load(url, context, next) {
    return url.endsWith('diagram.module.css')
      ? { format: 'module', shortCircuit: true, source: 'export default new Proxy({}, { get: (_, key) => key });' }
      : next(url, context);
  } });
}
