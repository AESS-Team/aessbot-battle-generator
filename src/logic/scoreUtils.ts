export const ROUND_COUNT = 3;
export const ROUND_DURATION_MIN = 1;

export type RoundWinner = 'teamA' | 'teamB' | '';

export interface MatchScore {
  rounds: RoundWinner[];
}

export type ScoreMap = Record<string, MatchScore>;

export function createEmptyScore(): MatchScore {
  return { rounds: Array.from({ length: ROUND_COUNT }, () => '') };
}

export function normalizeRoundWinner(value: unknown): RoundWinner {
  return value === 'teamA' || value === 'teamB' ? value : '';
}

export function normalizeScore(score: unknown): MatchScore | undefined {
  if (!score || typeof score !== 'object') return undefined;

  const candidate = score as { rounds?: unknown; teamA?: unknown; teamB?: unknown };

  if (Array.isArray(candidate.rounds)) {
    const rounds = candidate.rounds as unknown[];
    return {
      rounds: Array.from({ length: ROUND_COUNT }, (_, index) => normalizeRoundWinner(rounds[index])),
    };
  }

  const teamA = Number(candidate.teamA);
  const teamB = Number(candidate.teamB);

  if (!Number.isInteger(teamA) || !Number.isInteger(teamB) || teamA < 0 || teamB < 0) {
    return undefined;
  }

  const legacyRounds: RoundWinner[] = [];
  for (let i = 0; i < Math.min(teamA, ROUND_COUNT); i++) legacyRounds.push('teamA');
  for (let i = 0; i < Math.min(teamB, ROUND_COUNT - legacyRounds.length); i++) legacyRounds.push('teamB');

  while (legacyRounds.length < ROUND_COUNT) legacyRounds.push('');

  return { rounds: legacyRounds };
}

export function normalizeScoreMap(scores: unknown): ScoreMap {
  if (!scores || typeof scores !== 'object') return {};

  const entries = Object.entries(scores as Record<string, unknown>)
    .map(([id, score]) => [id, normalizeScore(score)] as const)
    .filter((entry): entry is readonly [string, MatchScore] => entry[1] !== undefined);

  return Object.fromEntries(entries);
}

export function getScoreTotals(score?: MatchScore): { teamA: number; teamB: number } {
  const rounds = score?.rounds ?? [];

  return rounds.reduce(
    (totals, roundWinner) => {
      if (roundWinner === 'teamA') totals.teamA += 1;
      if (roundWinner === 'teamB') totals.teamB += 1;
      return totals;
    },
    { teamA: 0, teamB: 0 }
  );
}

export function isScoreComplete(score?: MatchScore): boolean {
  if (!score) return false;
  return score.rounds.length === ROUND_COUNT && score.rounds.every((roundWinner) => roundWinner !== '');
}

export function getWinnerSide(score?: MatchScore): 'teamA' | 'teamB' | null {
  if (!isScoreComplete(score)) return null;
  const totals = getScoreTotals(score);
  if (totals.teamA === totals.teamB) return null;
  return totals.teamA > totals.teamB ? 'teamA' : 'teamB';
}

export function getWinner(teamA: string, teamB: string, score?: MatchScore): string | null {
  const winnerSide = getWinnerSide(score);
  if (!winnerSide) return null;
  return winnerSide === 'teamA' ? teamA : teamB;
}

export function updateRoundWinner(
  previousScore: MatchScore | undefined,
  roundIndex: number,
  side: 'teamA' | 'teamB'
): MatchScore {
  const rounds = [...(previousScore?.rounds ?? createEmptyScore().rounds)];
  const currentValue = rounds[roundIndex] ?? '';
  rounds[roundIndex] = currentValue === side ? '' : side;
  return { rounds };
}
