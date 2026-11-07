import { db } from "@/lib/db";
import { hashApiKey, validateApiKey } from "@/lib/api-auth";
import { notifyFeedback, selectFeedbackContact, type FeedbackDeps } from "@/lib/feedback";

export const feedbackDeps: FeedbackDeps = {
  env: process.env,
  async authenticate(header) {
    const key = await validateApiKey(header);
    if (!key) return null;
    const apiKey = await db.apiKey.findUnique({
      where: { keyHash: hashApiKey(header!.slice(7)) }, select: { id: true },
    });
    const users = await db.user.findMany({
      where: { organizationId: key.organizationId },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    const contact = selectFeedbackContact(users);
    if (!apiKey || !contact?.email) return null;
    return { apiKeyId: apiKey.id, organizationId: key.organizationId, userId: contact.id, contactEmail: contact.email };
  },
  async save(data) {
    if (!data.apiKeyId) return db.feedback.create({ data, select: { id: true } });
    return db.$transaction(async tx => {
      // Lock the key row so concurrent submissions cannot pass the quota together.
      await tx.$queryRaw`SELECT id FROM "ApiKey" WHERE id = ${data.apiKeyId} FOR UPDATE`;
      const count = await tx.feedback.count({ where: { apiKeyId: data.apiKeyId, createdAt: { gte: new Date(Date.now() - 86400000) } } });
      if (count >= 20) return null;
      return tx.feedback.create({ data, select: { id: true } });
    });
  },
  notify: data => notifyFeedback(data, process.env),
};
