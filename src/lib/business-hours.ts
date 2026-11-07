export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type BusinessHours = { days: typeof DAYS[number][]; open: string; close: string; note?: string };
export function isBusinessHours(value: unknown): value is BusinessHours {
  if (!value || typeof value !== "object") return false;
  const h = value as BusinessHours;
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return Array.isArray(h.days) && h.days.length > 0 && h.days.every(day => DAYS.includes(day))
    && typeof h.open === "string" && time.test(h.open) && typeof h.close === "string" && time.test(h.close)
    && (h.note === undefined || typeof h.note === "string");
}
export function formatBusinessHours(hours: BusinessHours, locale = "en"): string {
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }); }
  catch { formatter = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }); }
  return hours.days.map(day => formatter.format(new Date(Date.UTC(2024, 0, 1 + DAYS.indexOf(day))))).join(", ")
    + `: ${hours.open}–${hours.close}`;
}
export function mapLinks(address: string) {
  const query = encodeURIComponent(address);
  return { google: `https://www.google.com/maps/search/?api=1&query=${query}`, apple: `https://maps.apple.com/?q=${query}` };
}
