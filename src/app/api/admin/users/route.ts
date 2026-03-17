import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, role } = await request.json();

  if (!["USER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent removing your own admin role
  if (userId === admin.id && role !== "ADMIN") {
    return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { role },
  });

  return NextResponse.json({ success: true });
}
