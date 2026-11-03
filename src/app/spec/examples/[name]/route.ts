import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const examples: Record<string, string> = {
  "publish-person-site.mjs": "text/javascript",
  "person-site.example.json": "application/json",
  "placeholder.svg": "image/svg+xml",
  "placeholder-screen.svg": "image/svg+xml",
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!Object.hasOwn(examples, name)) return new NextResponse("Not found", { status: 404 });
  const content = await readFile(join(process.cwd(), "docs/examples", name), "utf8");
  return new NextResponse(content, { headers: {
    "Content-Type": `${examples[name]}; charset=utf-8`,
    "Cache-Control": "public, max-age=3600",
  } });
}
