import type { PrismaClient } from "@prisma/client";

/** Binding a draft root is allowed; publication is checked at public reads. */
export async function hostedPageBindingIssue(
  store: Pick<PrismaClient, "hostedPage">,
  organizationId: string,
  slug: string | null | undefined,
) {
  if (!slug) return null;
  const root = await store.hostedPage.findFirst({
    where: { slug, organizationId, parentSlug: null }, select: { id: true },
  });
  return root ? null : {
    code: "custom", path: ["hostedPageSlug"],
    message: "Must reference a root page in the same organisation.",
  };
}
