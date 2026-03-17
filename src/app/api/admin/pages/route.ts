import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const patchSchema = z.object({
  pageId: z.string(),
  action: z.enum(["publish", "unpublish"]),
});

const deleteSchema = z.object({
  pageId: z.string(),
  slug: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { pageId, action } = patchSchema.parse(body);

    const updates: Record<string, any> = {
      publish: { isPublished: true },
      unpublish: { isPublished: false },
    };

    await db.hostedPage.update({
      where: { id: pageId },
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
    const { pageId, slug } = deleteSchema.parse(body);

    // Also delete linked app if exists
    if (slug) {
      await db.app.deleteMany({ where: { hostedPageSlug: slug } });
    }

    await db.hostedPage.delete({ where: { id: pageId } });

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
