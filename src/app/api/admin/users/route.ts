import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const patchSchema = z.object({
  userId: z.string(),
  role: z.enum(["USER", "ADMIN"]),
});

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { userId, role } = patchSchema.parse(body);

    // Prevent removing your own admin role
    if (userId === admin.id && role !== "ADMIN") {
      return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
    }

    await db.user.update({
      where: { id: userId },
      data: { role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    throw error;
  }
}
