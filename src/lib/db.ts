import { PrismaClient } from "@prisma/client";
import { dbQueryLogEnabled, logDbQuery } from "./db-query-log.ts";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const client = new PrismaClient();
  if (!dbQueryLogEnabled()) return client;
  // The extension keeps every model/transaction API; only the static type
  // differs, so expose it as the plain client the rest of the code expects.
  return client.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        return logDbQuery(model, operation, () => query(args));
      },
    },
  }) as unknown as PrismaClient;
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
