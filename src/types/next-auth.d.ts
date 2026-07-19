import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    organizationId: string | null;
    role: string;
    user: DefaultSession["user"] & { id: string };
  }
}
