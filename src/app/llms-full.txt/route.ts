import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// llms-full.txt — Complete spec for AI agents
// Contains the full AGENT_INSTRUCTIONS.md content
export async function GET() {
  const filePath = join(process.cwd(), "AGENT_INSTRUCTIONS.md");
  const content = readFileSync(filePath, "utf-8");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
