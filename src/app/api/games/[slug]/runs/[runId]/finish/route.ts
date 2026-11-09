import { finishRun, leaderboardPreflight } from '@/lib/games/leaderboard';
import { leaderboardDeps } from '@/lib/games/leaderboard-server';

export const dynamic = 'force-dynamic';
export function OPTIONS(request: Request) { return leaderboardPreflight(request, leaderboardDeps); }
export async function POST(request: Request, { params }: { params: Promise<{ slug: string; runId: string }> }) {
  const { slug, runId } = await params;
  return finishRun(request, slug, runId, leaderboardDeps);
}
