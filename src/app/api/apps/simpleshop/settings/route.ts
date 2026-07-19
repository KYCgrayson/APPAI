import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/organization-context";
import {
  getSimpleshopSettings,
  updateSimpleshopSettings,
} from "@/lib/native-apps/service";
import { simpleshopSettingsPatchSchema } from "@/lib/simpleshop/settings-schema";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";
import { requireSameOrigin } from "@/lib/request-security";

export async function GET() {
  try {
    const context = await requireOrganizationContext();
    const result = await getSimpleshopSettings(context.organizationId);
    return NextResponse.json({ settings: result.settings });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    requireSameOrigin(request);
    const patch = simpleshopSettingsPatchSchema.parse(await request.json());
    const result = await updateSimpleshopSettings(context.organizationId, patch);
    return NextResponse.json({ settings: result.settings });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
