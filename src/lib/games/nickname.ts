import { allowedNames, blockedWords, leetFold, reservedWords } from './nickname-blocklist.ts';
import { casefold } from './nickname-casefold.ts';
export function normalizeNickname(value: unknown): { nickname: string; nicknameKey: string } | { error: 'invalid_nickname' | 'nickname_rejected' } {
  if (typeof value !== 'string') return { error: 'invalid_nickname' };
  if (/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(value)) return { error: 'invalid_nickname' };
  const nickname = value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, '');
  const nicknameKey = casefold(nickname), size = Array.from(nickname).length;
  // Dependent vowel/diacritic marks are part of letters in many scripts.
  // Allow them only after letters; enclosing emoji keycap marks stay excluded.
  if (size < 2 || size > 12 || !/^(?:\p{L}[\p{Mn}\p{Mc}]*|[\p{N}_.-])+(?: (?:\p{L}[\p{Mn}\p{Mc}]*|[\p{N}_.-])+)*$/u.test(nickname) ||
    /@|http|www|\.com/i.test(nicknameKey) || /\p{N}{7}/u.test(nickname)) return { error: 'invalid_nickname' };
  const folded = leetFold(nicknameKey);
  if (reservedWords.some(word => folded.includes(word)) || !allowedNames.has(folded) && blockedWords.some(word => folded.includes(word))) return { error: 'nickname_rejected' };
  return { nickname, nicknameKey };
}
