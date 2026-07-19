import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/organization-context";
import { requireActiveOrganizationApp } from "@/lib/native-apps/service";
import { isLookupKind, type LookupResponse } from "@/lib/simpleshop/lookups";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";
import { masterDataIdSchema, masterDataListQuerySchema } from "@/lib/simpleshop/master-data-schema";
import { listCustomers, listItems, listJobSites } from "@/lib/simpleshop/master-data-service";

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

    const query = masterDataListQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });
    const customerIdValue = request.nextUrl.searchParams.get("customerId");
    const customerId = customerIdValue ? masterDataIdSchema.parse(customerIdValue) : undefined;
    const items: LookupResponse["items"] = kind === "customer"
      ? (await listCustomers(context.organizationId, query)).map((customer) => ({
        kind: "customer" as const,
        id: customer.id,
        customerCode: String(customer.customerCode).padStart(4, "0"),
        name: customer.name,
        ...(customer.phone ? { phone: customer.phone } : {}),
        ...(customer.address ? { address: customer.address } : {}),
      }))
      : kind === "job-site"
        ? (await listJobSites(context.organizationId, { ...query, customerId })).map((site) => ({
          kind: "job-site" as const,
          id: site.id,
          name: site.name,
          ...(site.address ? { address: site.address } : {}),
          ...(site.keyword ? { keyword: site.keyword } : {}),
          ...(site.monthCodes[0] ? { monthlyCode: String(site.monthCodes[0].monthlyCode).padStart(3, "0") } : {}),
        }))
        : (await listItems(context.organizationId, query)).map((item) => ({
          kind: "item" as const,
          id: item.id,
          itemCode: item.itemCode,
          canonicalName: item.canonicalName,
          ...(item.material ? { material: item.material } : {}),
          ...(item.dimensionMode !== "NONE" ? {
            dimensionLabel: [item.length, item.width, item.thickness]
              .filter((value) => value != null)
              .map(String)
              .join(" × ") + (item.dimensionUnit ? ` ${item.dimensionUnit}` : ""),
          } : {}),
          defaultUnit: item.defaultUnit,
        }));

    const response: LookupResponse = {
      items,
      nextCursor: null,
      available: true,
      message: items.length ? "" : "目前沒有符合條件的主檔資料。",
    };
    return NextResponse.json(response);
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
