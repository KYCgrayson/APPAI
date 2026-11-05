import { PRESET_DEFS } from "@/lib/template-registry";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const examples: Record<string, string> = {
  ...Object.fromEntries(PRESET_DEFS.map(p => [p.exampleFile, "application/json"])),
  "placeholder-logo.png": "image/png",
  "publish-person-site.mjs": "text/javascript",
  "person-site.example.json": "application/json",
  "placeholder.svg": "image/svg+xml",
  "placeholder-screen.svg": "image/svg+xml",
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!Object.hasOwn(examples, name)) return new NextResponse("Not found", { status: 404 });
  const content = await readFile(join(process.cwd(), "docs/examples", name));
  return new NextResponse(new Uint8Array(content), { headers: {
    "Content-Type": examples[name] + (examples[name] === "image/png" ? "" : "; charset=utf-8"),
    "Cache-Control": "public, max-age=3600",
  } });
}
