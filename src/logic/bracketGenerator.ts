/**
 * Bracket generator for the knockout phase.
 * Produces a random knockout bracket:
 *   QF1-QF4 are filled from a full random draw of the 8 finalists.
 *   SF-A: winner(QF1) vs winner(QF2),  SF-B: winner(QF3) vs winner(QF4)
 *   Final: winner(SF-A) vs winner(SF-B)
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
 * Generate a random knockout bracket from an ordered list of 8 finalists.
 *
 * Seed numbers preserve the qualifying order, but they do not determine pairings.
 *
 * @param {string[]} finalistTeams - Teams ranked 1–8 for the knockout phase.
 * @returns {Bracket} Full bracket structure ready for result population.
 */
export function generateBracket(finalistTeams: string[]): Bracket {
  const seeds: Seed[] = finalistTeams.slice(0, 8).map((name, i) => ({ seed: i + 1, name }));
  const drawnSeeds = shuffle(seeds);

  function makeMatch(id: string, indexA: number, indexB: number, label: string): Match {
    return {
      id,
      seedA: drawnSeeds[indexA],
      seedB: drawnSeeds[indexB],
      winner: null,
      label,
    };
  }

  const quarterfinals: Match[] = [
    makeMatch('qf1', 0, 1, 'QF 1'),
    makeMatch('qf2', 2, 3, 'QF 2'),
    makeMatch('qf3', 4, 5, 'QF 3'),
    makeMatch('qf4', 6, 7, 'QF 4'),
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

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export type { Seed, Match, Bracket };
