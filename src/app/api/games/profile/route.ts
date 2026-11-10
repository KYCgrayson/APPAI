import { profile, leaderboardPreflight } from '@/lib/games/leaderboard';
import { leaderboardDeps } from '@/lib/games/leaderboard-server';

export const dynamic = 'force-dynamic';
export function OPTIONS(request: Request) { return leaderboardPreflight(request, leaderboardDeps); }
export function GET(request: Request) { return profile(request, leaderboardDeps); }
export function PUT(request: Request) { return profile(request, leaderboardDeps); }
export function DELETE(request: Request) { return profile(request, leaderboardDeps); }
