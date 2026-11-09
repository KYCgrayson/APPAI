import { createRun, leaderboardPreflight } from '@/lib/games/leaderboard';
import { leaderboardDeps } from '@/lib/games/leaderboard-server';

export const dynamic = 'force-dynamic';
export function OPTIONS(request: Request) { return leaderboardPreflight(request, leaderboardDeps); }
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return createRun(request, slug, leaderboardDeps);
}
