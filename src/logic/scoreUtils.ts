export const DEFAULT_ROUNDS_TO_WIN = 2;
export const MAX_ROUNDS_TO_WIN = 3;
export const ROUND_COUNT = getRoundCount(DEFAULT_ROUNDS_TO_WIN);
export const ROUND_DURATION_MIN = 1;

export type RoundWinner = 'teamA' | 'teamB' | '';
export type RoundsToWin = 2 | 3;

export interface MatchScore {
  rounds: RoundWinner[];
}

export type ScoreMap = Record<string, MatchScore>;

export function getRoundCount(roundsToWin: number = DEFAULT_ROUNDS_TO_WIN): number {
  return Math.max(1, roundsToWin * 2 - 1);
}

export function normalizeRoundsToWin(value: unknown): RoundsToWin {
  return Number(value) === MAX_ROUNDS_TO_WIN ? 3 : DEFAULT_ROUNDS_TO_WIN;
}

export function createEmptyScore(roundCount = ROUND_COUNT): MatchScore {
  return { rounds: Array.from({ length: roundCount }, () => '') };
}

export function normalizeRoundWinner(value: unknown): RoundWinner {
  return value === 'teamA' || value === 'teamB' ? value : '';
}

export function sanitizeScore(
  score: MatchScore | undefined,
  roundCount = ROUND_COUNT,
  roundsToWin = DEFAULT_ROUNDS_TO_WIN,
): MatchScore {
  const rounds: RoundWinner[] = [];
  let teamAWins = 0;
  let teamBWins = 0;

  for (let index = 0; index < roundCount; index++) {
    const roundWinner = normalizeRoundWinner(score?.rounds?.[index]);
    if (teamAWins >= roundsToWin || teamBWins >= roundsToWin) {
      rounds.push('');
      continue;
    }

    rounds.push(roundWinner);
    if (roundWinner === 'teamA') teamAWins += 1;
    if (roundWinner === 'teamB') teamBWins += 1;
  }

  return { rounds };
}

export function normalizeScore(
  score: unknown,
  roundCount = ROUND_COUNT,
  roundsToWin = DEFAULT_ROUNDS_TO_WIN,
): MatchScore | undefined {
  if (!score || typeof score !== 'object') return undefined;

  const candidate = score as { rounds?: unknown; teamA?: unknown; teamB?: unknown };

  if (Array.isArray(candidate.rounds)) {
    const rounds = candidate.rounds as unknown[];
    return sanitizeScore({
      rounds: Array.from({ length: roundCount }, (_, index) => normalizeRoundWinner(rounds[index])),
    }, roundCount, roundsToWin);
  }

  const teamA = Number(candidate.teamA);
  const teamB = Number(candidate.teamB);

  if (!Number.isInteger(teamA) || !Number.isInteger(teamB) || teamA < 0 || teamB < 0) {
    return undefined;
  }

  const legacyRounds: RoundWinner[] = [];
  for (let i = 0; i < Math.min(teamA, roundCount); i++) legacyRounds.push('teamA');
  for (let i = 0; i < Math.min(teamB, roundCount - legacyRounds.length); i++) legacyRounds.push('teamB');

  while (legacyRounds.length < roundCount) legacyRounds.push('');

  return sanitizeScore({ rounds: legacyRounds }, roundCount, roundsToWin);
}

export function normalizeScoreMap(
  scores: unknown,
  roundCount = ROUND_COUNT,
  roundsToWin = DEFAULT_ROUNDS_TO_WIN,
): ScoreMap {
  if (!scores || typeof scores !== 'object') return {};

  const entries = Object.entries(scores as Record<string, unknown>)
    .map(([id, score]) => [id, normalizeScore(score, roundCount, roundsToWin)] as const)
    .filter((entry): entry is readonly [string, MatchScore] => entry[1] !== undefined);

  return Object.fromEntries(entries);
}

export function getScoreTotals(score?: MatchScore, roundCount = score?.rounds.length ?? 0): { teamA: number; teamB: number } {
  const rounds = (score?.rounds ?? []).slice(0, roundCount);

  return rounds.reduce(
    (totals, roundWinner) => {
      if (roundWinner === 'teamA') totals.teamA += 1;
      if (roundWinner === 'teamB') totals.teamB += 1;
      return totals;
    },
    { teamA: 0, teamB: 0 }
  );
}

export function isScoreComplete(score?: MatchScore, roundsToWin = DEFAULT_ROUNDS_TO_WIN): boolean {
  if (!score) return false;
  const roundCount = getRoundCount(roundsToWin);
  const totals = getScoreTotals(score, roundCount);
  return (
    totals.teamA >= roundsToWin ||
    totals.teamB >= roundsToWin ||
    (score.rounds.length >= roundCount && score.rounds.slice(0, roundCount).every((roundWinner) => roundWinner !== ''))
  );
}

export function getWinnerSide(score?: MatchScore, roundsToWin = DEFAULT_ROUNDS_TO_WIN): 'teamA' | 'teamB' | null {
  if (!isScoreComplete(score, roundsToWin)) return null;
  const totals = getScoreTotals(score, getRoundCount(roundsToWin));
  if (totals.teamA === totals.teamB) return null;
  return totals.teamA > totals.teamB ? 'teamA' : 'teamB';
}

export function getWinner(teamA: string, teamB: string, score?: MatchScore, roundsToWin = DEFAULT_ROUNDS_TO_WIN): string | null {
  const winnerSide = getWinnerSide(score, roundsToWin);
  if (!winnerSide) return null;
  return winnerSide === 'teamA' ? teamA : teamB;
}

export function updateRoundWinner(
  previousScore: MatchScore | undefined,
  roundIndex: number,
  side: 'teamA' | 'teamB',
  roundCount = ROUND_COUNT,
  roundsToWin = DEFAULT_ROUNDS_TO_WIN,
): MatchScore {
  const sanitizedPrevious = sanitizeScore(previousScore, roundCount, roundsToWin);
  const rounds = [...sanitizedPrevious.rounds];
  while (rounds.length < Math.max(roundCount, roundIndex + 1)) {
    rounds.push('');
  }
  const currentValue = rounds[roundIndex] ?? '';
  if (currentValue === '' && isScoreComplete(sanitizedPrevious, roundsToWin)) {
    return sanitizedPrevious;
  }

  rounds[roundIndex] = currentValue === side ? '' : side;
  return sanitizeScore({ rounds: rounds.slice(0, roundCount) }, roundCount, roundsToWin);
}
