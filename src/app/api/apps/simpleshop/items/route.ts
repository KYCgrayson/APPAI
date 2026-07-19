import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/organization-context";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";
import { requireSameOrigin } from "@/lib/request-security";
import { itemCreateSchema, masterDataListQuerySchema } from "@/lib/simpleshop/master-data-schema";
import { createItem, listItems } from "@/lib/simpleshop/master-data-service";

export async function GET(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    if (request.nextUrl.searchParams.has("organizationId")) {
      return NextResponse.json({ error: "ORGANIZATION_ID_NOT_ALLOWED" }, { status: 400 });
    }
    const query = masterDataListQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });
    const items = await listItems(context.organizationId, query);
    return NextResponse.json({ items });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    requireSameOrigin(request);
    const input = itemCreateSchema.parse(await request.json());
    const item = await createItem(context.organizationId, input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
