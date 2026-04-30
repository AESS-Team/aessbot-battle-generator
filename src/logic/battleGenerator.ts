/**
 * Battle generation logic for the league phase.
 *
 * The phase is built as a partial round-robin:
 * - exactly `fightCount` jornades
 * - every team plays exactly once per jornada
 * - every jornada has the same number of battles
 * - no repeated battles
 */

export interface Battle {
  id: string;
  teamA: string;
  teamB: string;
  repeated: boolean;
}

/** A round (jornada): a group of battles where each team plays at most once. */
export interface Round {
  number: number;
  battles: Battle[];
}

export interface TeamStats {
  name: string;
  fights: number;
  opponents: string[];
  hasRepeats: boolean;
}

export interface BattleResult {
  battles: Battle[];
  rounds: Round[];
  teamStats: TeamStats[];
  warnings: string[];
}

export interface CompetitionConfig {
  /** Number of battles per team in the league phase (default: 8). */
  fightCount: number;
  /** Number of teams that qualify directly to quarterfinals (default: 7). */
  qualifiedCount: number;
  /** Number of simultaneous battles during Phase 1 (default: 1). */
  simultaneousBattles: number;
}

/** Duration of a single battle in minutes. */
export const BATTLE_DURATION_MIN = ROUND_COUNT * ROUND_DURATION_MIN;

/**
 * Calculate the estimated duration of a phase given a list of rounds.
 * Each round's battles are split into slots based on the number of simultaneous battles.
 *
 * @param rounds - Rounds to calculate duration for.
 * @param simultaneous - Simultaneous battles per slot.
 * @returns Total estimated minutes.
 */
export function calcPhase1Duration(rounds: Round[], simultaneous: number): number {
  return rounds.reduce((total, round) => {
    const slots = Math.ceil(round.battles.length / simultaneous);
    return total + slots * BATTLE_DURATION_MIN;
  }, 0);
}

/**
 * Format minutes as a human-readable string (e.g. "1h 25min").
 *
 * @param minutes - Total number of minutes.
 * @returns Formatted duration string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Shuffle array in-place using Fisher-Yates algorithm.
 *
 * @param arr - Array to shuffle.
 * @returns The same array, shuffled.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildRoundRobinRounds(teams: string[]): Array<Array<[string, string]>> {
  const rotation = [...shuffle([...teams])];
  const rounds: Array<Array<[string, string]>> = [];
  const teamCount = rotation.length;
  const half = teamCount / 2;

  for (let roundIndex = 0; roundIndex < teamCount - 1; roundIndex++) {
    const pairings: Array<[string, string]> = [];

    for (let i = 0; i < half; i++) {
      const teamA = rotation[i];
      const teamB = rotation[teamCount - 1 - i];
      pairings.push(Math.random() > 0.5 ? [teamA, teamB] : [teamB, teamA]);
    }

    rounds.push(pairings);

    const fixed = rotation[0];
    const rotating = rotation.slice(1);
    rotating.unshift(rotating.pop()!);
    rotation.splice(0, rotation.length, fixed, ...rotating);
  }

  return shuffle(rounds);
}

function buildBattleKey(teamA: string, teamB: string): string {
  return [teamA, teamB].sort().join('|||');
}

/**
 * Generate league phase battles as exact jornades.
 * Each team plays exactly `fightCount` battles, one per jornada, with no repeats.
 *
 * @param teams - List of participating team names.
 * @param config - Competition configuration.
 * @returns Generated battles, rounds, per-team stats, and any warnings.
 */
export function generateBattles(
  teams: string[],
  config: Partial<CompetitionConfig> = {}
): BattleResult {
  const { fightCount = 8 } = config;
  const warnings: string[] = [];
  const n = teams.length;

  // Validation
  if (n < 4) {
    return {
      battles: [],
      rounds: [],
      teamStats: [],
      warnings: [`Es necessiten almenys 4 equips per generar combats. Equips actuals: ${n}.`],
    };
  }

  if (n % 2 !== 0) {
    return {
      battles: [],
      rounds: [],
      teamStats: [],
      warnings: [
        `Amb ${n} equips no es poden crear jornades perfectes: cada jornada requereix un nombre parell d'equips perquè tothom jugui exactament un cop.`,
      ],
    };
  }

  const maxUnique = n - 1;
  const effectiveFightCount = Math.min(fightCount, maxUnique);

  if (maxUnique < fightCount) {
    warnings.push(
      `Amb ${n} equips, el màxim de combats únics possibles és ${maxUnique}. ` +
      `La fase 1 s'ha ajustat a ${effectiveFightCount} jornades per mantenir combats únics.`
    );
  }

  const roundRobinRounds = buildRoundRobinRounds(teams).slice(0, effectiveFightCount);
  const rounds: Round[] = roundRobinRounds.map((pairings, roundIndex) => ({
    number: roundIndex + 1,
    battles: pairings.map(([teamA, teamB], battleIndex) => ({
      id: `battle-${roundIndex + 1}-${battleIndex + 1}`,
      teamA,
      teamB,
      repeated: false,
    })),
  }));

  const battles = rounds.flatMap((round) => round.battles);
  const seenPairs = new Set<string>();

  for (const battle of battles) {
    const key = buildBattleKey(battle.teamA, battle.teamB);
    if (seenPairs.has(key)) {
      return {
        battles: [],
        rounds: [],
        teamStats: [],
        warnings: [
          `S'ha detectat un combat duplicat entre "${battle.teamA}" i "${battle.teamB}". ` +
          'La generació s\'ha cancel·lat perquè A-B i B-A es consideren exactament el mateix combat.',
        ],
      };
    }
    seenPairs.add(key);
  }

  // Per-team stats
  const teamStats: TeamStats[] = teams.map((name) => {
    const teamBattles = battles.filter(
      (b) => b.teamA === name || b.teamB === name
    );
    const opponents = teamBattles.map((b) =>
      b.teamA === name ? b.teamB : b.teamA
    );
    const hasRepeats = false;
    return { name, fights: teamBattles.length, opponents, hasRepeats };
  });

  return { battles, rounds, teamStats, warnings };
}
import { ROUND_COUNT, ROUND_DURATION_MIN } from './scoreUtils';
