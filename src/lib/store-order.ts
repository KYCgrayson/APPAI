export function preferredStore(userAgent: string): "app" | "play" | null {
  if (/android/i.test(userAgent)) return "play";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "app";
  return null;
}
