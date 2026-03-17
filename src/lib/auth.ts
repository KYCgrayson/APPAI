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
        (session as any).organizationId = dbUser?.organizationId ?? null;
        (session as any).role = dbUser?.role ?? "USER";
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email) {
        // Auto-create Organization when user signs up
        const slug = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const org = await db.organization.create({
          data: {
            name: user.name || slug,
            slug: `${slug}-${Date.now().toString(36)}`,
            email: user.email,
          },
        });
        // Auto-promote admin emails
        const role = isAdminEmail(user.email) ? "ADMIN" : "USER";
        await db.user.update({
          where: { id: user.id },
          data: { organizationId: org.id, role },
        });
      }
    },
  },
  pages: {
    signIn: "/login",
  },
});
