import { roomsPreflight, startRoom } from "@/lib/rooms";
import { roomDeps } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) {
  return roomsPreflight(request, roomDeps.env);
}
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  return startRoom(request, (await params).code, roomDeps);
}
