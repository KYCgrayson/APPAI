import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { pageId, action } = await request.json();

  const updates: Record<string, any> = {
    publish: { isPublished: true },
    unpublish: { isPublished: false },
  };

  if (!updates[action]) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await db.hostedPage.update({
    where: { id: pageId },
    data: updates[action],
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { pageId, slug } = await request.json();

  // Also delete linked app if exists
  if (slug) {
    await db.app.deleteMany({ where: { hostedPageSlug: slug } });
  }

  await db.hostedPage.delete({ where: { id: pageId } });

  return NextResponse.json({ success: true });
}
