import { auth } from "./auth";
import { db } from "./db";

/**
 * Check if the current session user is an admin.
 * Admin is determined by: User.role === "ADMIN"
 *
 * To promote a user to admin, either:
 * 1. Set ADMIN_EMAILS env var (comma-separated) — auto-promoted on login
 * 2. Manually update the user's role in the database
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return user;
}

/**
 * Check if an email should be auto-promoted to admin on signup/login.
 * Reads from ADMIN_EMAILS env var (comma-separated).
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}
