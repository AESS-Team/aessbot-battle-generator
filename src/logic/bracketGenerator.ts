/**
 * Bracket generator for the knockout phase.
 * Produces a seeded bracket following the Champions League model:
 *   QF1: seed1 vs seed8, QF2: seed4 vs seed5, QF3: seed2 vs seed7, QF4: seed3 vs seed6
 *   SF-A: winner(QF1) vs winner(QF2),  SF-B: winner(QF3) vs winner(QF4)
 *   Final: winner(SF-A) vs winner(SF-B)
 *
 * This guarantees seeds 1 and 2 are on opposite sides of the bracket.
 */

interface Seed {
  seed: number;
  name: string;
}

interface Match {
  id: string;
  seedA: Seed;
  seedB: Seed;
  winner: Seed | null;
  label: string;
}

interface Bracket {
  quarterfinals: Match[];
  semifinals: Match[];
  final: Match;
}

/**
 * Generate a seeded knockout bracket from an ordered list of 8 finalists.
 *
 * Seeding order:
 *   Position 1 → seed 1 (best), position 8 → seed 8.
 *
 * @param {string[]} finalistTeams - Teams ranked 1–8 for the knockout phase.
 * @returns {Bracket} Full bracket structure ready for result population.
 */
export function generateBracket(finalistTeams: string[]): Bracket {
  // Build seeded participants list (seeds 1–8)
  const seeds: Seed[] = finalistTeams.slice(0, 8).map((name, i) => ({ seed: i + 1, name }));

  /**
   * Create a match object.
   *
   * @param id - Unique match identifier.
   * @param seedNumA - Seed number of first team.
   * @param seedNumB - Seed number of second team.
   * @param label - Human-readable label (e.g. "QF1").
   */
  function makeMatch(id: string, seedNumA: number, seedNumB: number, label: string): Match {
    return {
      id,
      seedA: seeds[seedNumA - 1],
      seedB: seeds[seedNumB - 1],
      winner: null,
      label,
    };
  }

  // Quarterfinals: CL seeded bracket
  //   Side A: QF1 (1v8), QF2 (4v5)  → winner meets winner in SF-A
  //   Side B: QF3 (2v7), QF4 (3v6)  → winner meets winner in SF-B
  const quarterfinals: Match[] = [
    makeMatch('qf1', 1, 8, 'QF 1'),
    makeMatch('qf2', 4, 5, 'QF 2'),
    makeMatch('qf3', 2, 7, 'QF 3'),
    makeMatch('qf4', 3, 6, 'QF 4'),
  ];

  // Semifinals: placeholder winners filled in when results are added
  const semifinals: Match[] = [
    {
      id: 'sf1',
      seedA: { seed: 0, name: 'Guanyador QF1' },
      seedB: { seed: 0, name: 'Guanyador QF2' },
      winner: null,
      label: 'Semifinal A',
    },
    {
      id: 'sf2',
      seedA: { seed: 0, name: 'Guanyador QF3' },
      seedB: { seed: 0, name: 'Guanyador QF4' },
      winner: null,
      label: 'Semifinal B',
    },
  ];

  // Final
  const final: Match = {
    id: 'final',
    seedA: { seed: 0, name: 'Guanyador SF-A' },
    seedB: { seed: 0, name: 'Guanyador SF-B' },
    winner: null,
    label: 'Final',
  };

  return { quarterfinals, semifinals, final };
}

export type { Seed, Match, Bracket };
