import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/organization-context";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";
import { requireSameOrigin } from "@/lib/request-security";
import { customerPatchSchema } from "@/lib/simpleshop/master-data-schema";
import { getCustomer, updateCustomer } from "@/lib/simpleshop/master-data-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, route: RouteContext) {
  try {
    const context = await requireOrganizationContext();
    const { id } = await route.params;
    const customer = await getCustomer(context.organizationId, id);
    return NextResponse.json({ customer });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, route: RouteContext) {
  try {
    const context = await requireOrganizationContext();
    requireSameOrigin(request);
    const { id } = await route.params;
    const patch = customerPatchSchema.parse(await request.json());
    const customer = await updateCustomer(context.organizationId, id, patch);
    return NextResponse.json({ customer });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, route: RouteContext) {
  try {
    const context = await requireOrganizationContext();
    requireSameOrigin(request);
    const { id } = await route.params;
    const customer = await updateCustomer(context.organizationId, id, { status: "INACTIVE" });
    return NextResponse.json({ customer });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
