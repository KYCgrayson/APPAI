import "server-only";

import { db } from "@/lib/db";

export function countNativeAppUsageSince(appType: string, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  return db.usageEvent.count({
    where: {
      connector: `native-app:${appType}`,
      createdAt: { gte: since },
    },
  });
}
