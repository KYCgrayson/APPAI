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
    presets,
    total: presets.length,
  });
}
