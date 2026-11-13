import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { POST as managePages } from "@/app/api/dashboard/pages/actions/route";

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return managePages(request);
}
// Legacy hard deletion/publication is retired: admin uses logical soft removal.
export async function DELETE() {
  return NextResponse.json({ error: "Use POST with dryRun and expected counts for soft deletion", code: "confirmation_required" }, { status: 409 });
}
export const PATCH = DELETE;
