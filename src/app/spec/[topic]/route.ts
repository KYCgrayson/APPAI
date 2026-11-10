import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const topics = ["api", "style", "theme", "typography", "pages", "sections", "i18n", "tools", "apps", "games"];

export async function GET(_request: Request, context: { params: Promise<{ topic: string }> }) {
  const { topic } = await context.params;
  if (!topics.includes(topic)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(readFileSync(join(process.cwd(), "docs/spec", `${topic}.md`), "utf-8"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
