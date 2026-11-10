export const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const button = (label: string, action: string, cls = '') =>
  `<button class="${cls}" data-action="${action}">${esc(label)}</button>`;
