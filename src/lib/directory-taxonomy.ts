export const DIRECTORY_KINDS = ["websites", "tools", "apps"] as const;
export type DirectoryKind = (typeof DIRECTORY_KINDS)[number];

// The categories presented to publishers and in the public directory.
// The release contract also accepts other valid uppercase category values.
export const UNIVERSAL_APP_CATEGORIES = [
  "WRITING",
  "CODING",
  "DESIGN",
  "AUTOMATION",
  "PRODUCTIVITY",
  "SOCIAL",
  "FINANCE",
  "DATABASE",
  "HEALTH",
  "EDUCATION",
  "FOOD",
  "TRAVEL",
  "ENTERTAINMENT",
  "GAMES",
  "MEDIA",
  "UTILITIES",
  "COMMERCE",
  "INVENTORY",
  "OTHER",
] as const;
