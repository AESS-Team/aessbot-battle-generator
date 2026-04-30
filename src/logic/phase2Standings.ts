export interface StandingLike {
  team: string;
}

export function buildPhase2Standings<T extends StandingLike>(
  standings: T[],
  directQualifiedCount: number,
  repescaWinners: string[]
): T[] {
  const directQualified = standings.slice(0, directQualifiedCount);
  const directQualifiedTeams = new Set(directQualified.map((row) => row.team));

  const repescaQualified = repescaWinners
    .filter(Boolean)
    .map((team) => standings.find((row) => row.team === team))
    .filter((row): row is T => row !== undefined && !directQualifiedTeams.has(row.team));

  const repescaQualifiedTeams = new Set(repescaQualified.map((row) => row.team));

  const remainingTeams = standings.filter(
    (row) => !directQualifiedTeams.has(row.team) && !repescaQualifiedTeams.has(row.team)
  );

  return [...directQualified, ...repescaQualified, ...remainingTeams];
}
