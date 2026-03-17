import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const patchSchema = z.object({
  appId: z.string(),
  action: z.enum(["approve", "unapprove", "feature", "unfeature"]),
});

const deleteSchema = z.object({
  appId: z.string(),
});

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { appId, action } = patchSchema.parse(body);

    const updates: Record<string, any> = {
      approve: { isApproved: true },
      unapprove: { isApproved: false, isFeatured: false },
      feature: { isFeatured: true, isApproved: true },
      unfeature: { isFeatured: false },
    };

    await db.app.update({
      where: { id: appId },
      data: updates[action],
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

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { appId } = deleteSchema.parse(body);

    await db.app.delete({ where: { id: appId } });

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
