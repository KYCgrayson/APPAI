import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// GET /spec — Serve docs/spec/overview.md as plain text
// AI agents can fetch this to learn how to use AppAI
export async function GET() {
  const filePath = join(process.cwd(), "docs/spec/overview.md");
  const content = readFileSync(filePath, "utf-8");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
