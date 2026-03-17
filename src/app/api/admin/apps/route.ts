import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { appId, action } = await request.json();

  const updates: Record<string, any> = {
    approve: { isApproved: true },
    unapprove: { isApproved: false, isFeatured: false },
    feature: { isFeatured: true, isApproved: true },
    unfeature: { isFeatured: false },
  };

  if (!updates[action]) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await db.app.update({
    where: { id: appId },
    data: updates[action],
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { appId } = await request.json();

  await db.app.delete({ where: { id: appId } });

  return NextResponse.json({ success: true });
}
