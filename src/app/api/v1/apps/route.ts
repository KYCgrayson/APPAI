import { withPageWrite, type PageApiActor } from "@/lib/page-write-guard";
import type { PageStore } from "@/lib/page-management";
import { hostedPageBindingIssue } from "@/lib/app-hosted-page-binding";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { createAppSchema } from "@/lib/validations/app";

// POST /api/v1/apps
async function postApp(request: NextRequest, db: PageStore, authResult: PageApiActor) {
  try {
    const body = await request.json();
    const data = createAppSchema.parse(body);
    const bindingIssue = await hostedPageBindingIssue(db, authResult.organizationId, data.hostedPageSlug);
    if (bindingIssue) {
      return NextResponse.json({ error: "Validation failed", details: [bindingIssue] }, { status: 400 });
    }

    // Check plan limits
    const appCount = await db.app.count({
      where: { organizationId: authResult.organizationId },
    });
    if (authResult.organization.plan === "FREE" && appCount >= 1) {
      return NextResponse.json(
        { error: "Free plan limit: max 1 app. Upgrade to Pro." },
        { status: 403 }
      );
    }

    const app = await db.app.create({
      data: {
        ...data,
        organizationId: authResult.organizationId,
      },
    });

    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withPageWrite(request, null, (tx, actor) => postApp(request, tx, actor), { appCreate: true });
}

// GET /api/v1/apps
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apps = await db.app.findMany({
    where: { organizationId: authResult.organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return NextResponse.json(apps);
}
