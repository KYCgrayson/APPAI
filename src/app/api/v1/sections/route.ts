import { NextResponse } from "next/server";
import { SECTION_DEFS, COMMON_SECTION_FIELD } from "@/lib/template-registry";

// GET /api/v1/sections
export async function GET() {
  // Inject the common `id` field into every section's field list so agents
  // see it in the spec without us having to duplicate it in SECTION_DEFS.
  const enriched = SECTION_DEFS.map((s) => ({
    ...s,
    fields: [COMMON_SECTION_FIELD, ...s.fields],
  }));
  return NextResponse.json({
    sections: enriched,
    total: enriched.length,
  });
}
