import { z } from "zod";

export const formFieldSchema = z.object({
  type: z.enum(["text", "email", "tel", "textarea", "select"]),
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field name must be a valid identifier"),
  label: z.string().min(1).max(200),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional(),
  options: z
    .array(
      z.object({
        value: z.string().min(1).max(100),
        label: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
      })
    )
    .optional(),
});

export const formSectionDataSchema = z.object({
  heading: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  fields: z.array(formFieldSchema).min(1).max(20),
  /**
   * Either "mailto:address@example.com" or an https:// URL for webhook.
   * Non-https webhooks are rejected to prevent SSRF and plaintext leak.
   */
  submitTo: z
    .string()
    .refine(
      (v) => v.startsWith("mailto:") || /^https:\/\//.test(v),
      "submitTo must start with mailto: or https://"
    ),
  submitLabel: z.string().max(100).optional(),
  successMessage: z.string().max(500).optional(),
});

export type FormField = z.infer<typeof formFieldSchema>;
export type FormSectionData = z.infer<typeof formSectionDataSchema>;
