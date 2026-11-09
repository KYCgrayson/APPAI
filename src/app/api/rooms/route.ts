import { createRoom, roomsPreflight } from "@/lib/rooms";
import { roomDeps } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) {
  return roomsPreflight(request, roomDeps.env);
}
export function POST(request: Request) {
  return createRoom(request, roomDeps);
}
