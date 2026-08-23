import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { isAdminEmail } from "./admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { organizationId: true, role: true },
        });
        session.organizationId = dbUser?.organizationId ?? null;
        session.role = dbUser?.role ?? "USER";
      }
      return session;
    },
  },
  events: {
    // Promotion has to run on every sign-in, not only at createUser. An
    // account that already existed when ADMIN_EMAILS was configured would
    // otherwise stay USER forever — silently losing the admin exemptions
    // (uncapped clip length, no daily quota) it is supposed to have.
    async signIn({ user }) {
      if (user.id && user.email && isAdminEmail(user.email)) {
        await db.user.updateMany({
          where: { id: user.id, role: { not: "ADMIN" } },
          data: { role: "ADMIN" },
        });
      }
    },
    async createUser({ user }) {
      if (user.id && user.email) {
        const userId = user.id;
        // Auto-create Organization when user signs up
        const slug = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const role = isAdminEmail(user.email) ? "ADMIN" : "USER";
        await db.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: {
              name: user.name || slug,
              slug: `${slug}-${Date.now().toString(36)}-${userId.slice(-6)}`,
              email: user.email,
            },
          });
          await tx.user.update({
            where: { id: userId },
            data: { organizationId: org.id, role },
          });
        });
      }
    },
  },
  pages: {
    signIn: "/login",
  },
});
