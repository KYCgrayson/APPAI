// Small, original child-safety vocabulary; provenance/license in ASSETS.md.
export const blockedWords = [
  'fuck', 'shit', 'bitch', 'porn', 'sex', 'nude', 'kill',
  '幹你', '干你', '操你', '他媽', '他妈', '色情', '做愛', '做爱', '去死',
  'くそ', 'クソ', '死ね', 'エロ', 'セックス',
];
// Exact folded names only: do not remove allowed substrings from arbitrary names.
export const allowedNames = new Set(['essex', 'sussex', 'middlesex', 'sexton', 'skill', 'skills']);
export const reservedWords = ['admin', 'administrator', 'appai', '官方', '管理員', '管理员', '管理人', 'moderator', 'system', 'support', '管理者', '運営', '运营'];
export function leetFold(value: string) {
  const substitutions: Record<string, string> = { '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i' };
  return value.replace(/[0123456789@$!]/g, c => substitutions[c]).replace(/[ ._-]/g, '');
}
