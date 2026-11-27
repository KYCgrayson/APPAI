import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { isAdminEmail } from "./admin";
import { publicSession } from "./auth-session";
import { refreshAccessToken, tokenAccess, type AccessMemo, type AccessStore } from "./auth-token";

const accessDeps = { store: db as unknown as AccessStore, isAdminEmail, memo: new Map() as AccessMemo };

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // #92-E: JWT sessions. A database session made every signed-in request
  // read (and often write) the Session table; the cookie now carries the
  // session, so auth() and /api/auth/session never touch the database for
  // visitors without a cookie and only refresh access claims for signed-in
  // users every ACCESS_REFRESH_SECONDS. The adapter still stores users and
  // OAuth accounts at sign-in.
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      return refreshAccessToken(token, user, accessDeps);
    },
    async session({ session, token }) {
      return publicSession(
        session,
        { id: token.sub ?? "", name: token.name, email: token.email, image: token.picture },
        tokenAccess(token),
      );
    },
  },
  events: {
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
