import { NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/organization-context";
import { requireActiveOrganizationApp } from "@/lib/native-apps/service";
import { getNativeAppDefinition } from "@/lib/native-apps/registry";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";

export async function GET() {
  try {
    const context = await requireOrganizationContext();
    const instance = await requireActiveOrganizationApp(context.organizationId, "simpleshop");
    return NextResponse.json({
      instance,
      organization: context.organization,
      definition: getNativeAppDefinition("simpleshop"),
    });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
