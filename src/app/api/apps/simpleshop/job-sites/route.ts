import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/organization-context";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";
import { requireSameOrigin } from "@/lib/request-security";
import { jobSiteCreateSchema, masterDataIdSchema, masterDataListQuerySchema } from "@/lib/simpleshop/master-data-schema";
import { createJobSite, listJobSites } from "@/lib/simpleshop/master-data-service";

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
    const customerIdValue = request.nextUrl.searchParams.get("customerId");
    const customerId = customerIdValue ? masterDataIdSchema.parse(customerIdValue) : undefined;
    const jobSites = await listJobSites(context.organizationId, { ...query, customerId });
    return NextResponse.json({ jobSites });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    requireSameOrigin(request);
    const input = jobSiteCreateSchema.parse(await request.json());
    const jobSite = await createJobSite(context.organizationId, input);
    return NextResponse.json({ jobSite }, { status: 201 });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
