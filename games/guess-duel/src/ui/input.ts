export function keyboardAction(screen: string, key: string, interactive: boolean) {
  if (interactive || !['secret', 'play'].includes(screen)) return null;
  if (/^\d$/.test(key)) return { type: 'digit', value: key };
  if (key === 'Backspace') return { type: 'delete' };
  if (key === 'Enter') return { type: 'submit' };
  return null;
}
export function rematchNames(
  names: [string, string],
  relay: boolean,
  seat: 0 | 1,
): [string, string] {
  return relay && seat === 1 ? [names[1], names[0]] : [...names];
}
