import { NextResponse } from "next/server";
import { SECTION_DEFS } from "@/lib/template-registry";

// GET /api/v1/sections
export async function GET() {
  return NextResponse.json({
    sections: SECTION_DEFS,
    total: SECTION_DEFS.length,
  });
}
