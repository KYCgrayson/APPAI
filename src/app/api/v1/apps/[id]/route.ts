import { hostedPageBindingIssue } from "@/lib/app-hosted-page-binding";
import { revalidateSeoIndexes } from "@/lib/revalidate-seo";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { updateAppSchema } from "@/lib/validations/app";

// GET /api/v1/apps/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = await db.app.findFirst({
    where: { id, organizationId: authResult.organizationId },
  });

  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(app);
}

// PUT /api/v1/apps/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = await db.app.findFirst({
    where: { id, organizationId: authResult.organizationId },
  });
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = updateAppSchema.parse(body);
    const bindingIssue = await hostedPageBindingIssue(db, authResult.organizationId, data.hostedPageSlug);
    if (bindingIssue) {
      return NextResponse.json({ error: "Validation failed", details: [bindingIssue] }, { status: 400 });
    }

    const updated = await db.app.update({
      where: { id: app.id },
      data,
    });

    revalidateSeoIndexes();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/v1/apps/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = await db.app.findFirst({
    where: { id, organizationId: authResult.organizationId },
  });
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.app.delete({ where: { id: app.id } });

  revalidateSeoIndexes();
  return NextResponse.json({ message: "Deleted" });
}
