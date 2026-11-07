import { LOGO_GUIDANCE } from "@/lib/page-logo";
import { PAGE_STYLES, TYPOGRAPHY_RECIPES } from "@/lib/page-styles";
import { NextResponse } from "next/server";
import { PRESET_DEFS, getSectionDef } from "@/lib/template-registry";

// GET /api/v1/presets
export async function GET() {
  // Enrich presets with full section definitions
  const presets = PRESET_DEFS.map((preset) => ({
    ...preset,
    sectionDetails: preset.sections.map((sType) => getSectionDef(sType)).filter(Boolean),
  }));

  return NextResponse.json({
    logoGuidance: LOGO_GUIDANCE,
    styles: PAGE_STYLES,
    typographyRecipes: TYPOGRAPHY_RECIPES,
    presets,
    total: presets.length,
  });
}
