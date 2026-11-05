import { z } from "zod";

export const createAppSchema = z.object({
  name: z.string().min(1).max(200),
  tagline: z.string().min(1).max(500),
  description: z.string().min(1),
  category: z
    .enum([
      "WRITING", "CODING", "DESIGN", "AUTOMATION", "PRODUCTIVITY",
      "SOCIAL", "FINANCE", "HEALTH", "EDUCATION",
      "FOOD", "TRAVEL", "ENTERTAINMENT", "GAMES", "MEDIA",
      "UTILITIES", "COMMERCE",
      "OTHER",
    ])
    .default("OTHER"),
  tags: z.array(z.string()).default([]),
  url: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
  iosUrl: z.string().url().optional(),
  androidUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  screenshots: z.array(z.string().url()).default([]),
  hostedPageSlug: z.string().optional(),
});

export const updateAppSchema = createAppSchema.extend({
  category: createAppSchema.shape.category.removeDefault(),
  tags: createAppSchema.shape.tags.removeDefault(),
  screenshots: createAppSchema.shape.screenshots.removeDefault(),
}).partial();

export type CreateAppInput = z.infer<typeof createAppSchema>;
export type UpdateAppInput = z.infer<typeof updateAppSchema>;
