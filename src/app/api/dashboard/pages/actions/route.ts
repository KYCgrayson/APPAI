import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasSameOrigin } from "@/lib/request-security";
import { managePages, PageManagementError } from "@/lib/page-management";
import { revalidateSeoIndexes } from "@/lib/revalidate-seo";

const inputSchema = z.object({
  action: z.enum(["unpublish", "delete", "restore"]),
  targets: z.array(z.string().min(1).max(128)).min(1).max(100),
  dryRun: z.boolean().optional(),
  expected: z.object({ pages: z.number().int().min(1), rows: z.number().int().min(1) }).optional(),
}).strict();
export async function POST(request: NextRequest) {
  if (request.headers.has("authorization")) return NextResponse.json({ error: "Session required" }, { status: 401 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Forbidden", code: "invalid_origin" }, { status: 403 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, organizationId: true, role: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json());
    const result = await managePages(db, { kind: user.role === "ADMIN" ? "admin" : "user", userId: user.id, organizationId: user.organizationId }, input);
    // managePages resolves only after COMMIT.
    const cacheRefreshed = input.dryRun ? true : revalidateSeoIndexes("all");
    return NextResponse.json({ ...result, cacheRefreshed });
  } catch (error) {
    if (error instanceof PageManagementError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    console.error("Page management failed", error);
    return NextResponse.json({ error: "Page management failed" }, { status: 500 });
  }
}
