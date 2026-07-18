import { z } from "zod";

export const simpleOrderSectionDataSchema = z.object({
  heading: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  storeName: z.string().max(200).optional(),
  storeDescription: z.string().max(1000).optional(),
  notificationEmail: z.email("notificationEmail must be a valid email address"),
  paymentUrl: z
    .string()
    .refine(
      (v) => /^https?:\/\//i.test(v) || /^line:/i.test(v),
      "paymentUrl must be an http(s) or line: URL",
    ),
  paymentHeading: z.string().max(200).optional(),
  paymentInstructions: z.string().max(1000).optional(),
  currency: z.string().min(3).max(3).default("TWD").optional(),
  submitLabel: z.string().max(100).optional(),
  successMessage: z.string().max(500).optional(),
  maxItems: z.number().int().min(1).max(50).optional(),
});

export const simpleOrderItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive().max(100000),
  unitPrice: z.number().nonnegative().max(100000000),
});

export const simpleOrderSubmissionSchema = z.object({
  pageSlug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  parentSlug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).nullable().optional(),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  sectionOrder: z.number().int().optional(),
  customer: z.object({
    name: z.string().min(1).max(200),
    email: z.email("Customer email must be valid"),
  }),
  preferredDate: z.string().min(1).max(100),
  note: z.string().max(5000).optional(),
  items: z.array(simpleOrderItemSchema).min(1).max(50),
});

export type SimpleOrderSectionData = z.infer<typeof simpleOrderSectionDataSchema>;
export type SimpleOrderSubmission = z.infer<typeof simpleOrderSubmissionSchema>;
