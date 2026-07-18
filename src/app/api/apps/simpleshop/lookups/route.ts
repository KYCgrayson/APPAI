import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/organization-context";
import { requireActiveOrganizationApp } from "@/lib/native-apps/service";
import { isLookupKind, type LookupResponse } from "@/lib/simpleshop/lookups";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    await requireActiveOrganizationApp(context.organizationId, "simpleshop");

    const kind = request.nextUrl.searchParams.get("kind") || "";
    if (!isLookupKind(kind)) {
      return NextResponse.json({ error: "INVALID_LOOKUP_KIND" }, { status: 400 });
    }
    if (request.nextUrl.searchParams.has("organizationId")) {
      return NextResponse.json({ error: "ORGANIZATION_ID_NOT_ALLOWED" }, { status: 400 });
    }

    const response: LookupResponse = {
      items: [],
      nextCursor: null,
      available: false,
      message: "主檔查詢將於 Simpleshop Phase 2 啟用；目前不會建立假資料。",
    };
    return NextResponse.json(response);
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
