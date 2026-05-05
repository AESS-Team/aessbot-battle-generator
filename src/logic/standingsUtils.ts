import { getWinnerSide, isScoreComplete, type MatchScore } from './scoreUtils';

interface BattleLike {
  id: string;
  teamA: string;
  teamB: string;
}

export interface StandingRow {
  team: string;
  pointsFor: number;
  pointsAgainst: number;
  played: number;
}

export function buildStandings(
  teams: string[],
  battles: BattleLike[],
  scores: Record<string, MatchScore>,
  roundsToWin = 2,
): StandingRow[] {
  const points = new Map<string, number>(teams.map((t) => [t, 0]));
  const pl = new Map<string, number>(teams.map((t) => [t, 0]));

  for (const battle of battles) {
    const score = scores[battle.id];
    if (!isScoreComplete(score, roundsToWin)) continue;
    const winnerSide = getWinnerSide(score, roundsToWin);

    pl.set(battle.teamA, (pl.get(battle.teamA) ?? 0) + 1);
    pl.set(battle.teamB, (pl.get(battle.teamB) ?? 0) + 1);

    if (winnerSide === 'teamA') {
      points.set(battle.teamA, (points.get(battle.teamA) ?? 0) + 3);
    }

    if (winnerSide === 'teamB') {
      points.set(battle.teamB, (points.get(battle.teamB) ?? 0) + 3);
    }
  }

  return teams
    .map((team) => ({
      team,
      pointsFor: points.get(team) ?? 0,
      pointsAgainst: 0,
      played: pl.get(team) ?? 0,
    }))
    .sort((a, b) => {
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      if (b.played !== a.played) return b.played - a.played;
      return a.team.localeCompare(b.team);
    });
}

export function getDirectQualifiedCount(
  standings: StandingRow[],
  requestedDirectQualifiedCount: number,
): number {
  if (requestedDirectQualifiedCount <= 0 || standings.length <= requestedDirectQualifiedCount) {
    return requestedDirectQualifiedCount;
  }

  const boundary = standings[requestedDirectQualifiedCount - 1];
  const next = standings[requestedDirectQualifiedCount];

  if (
    !boundary ||
    !next ||
    boundary.pointsFor !== next.pointsFor
  ) {
    return requestedDirectQualifiedCount;
  }

  // Tie crosses the boundary: exclude all tied teams from direct qualification.
  // Find the first position in the sorted standings where this tie group begins.
  return standings.findIndex(
    (row) => row.pointsFor === boundary.pointsFor,
  );
}
