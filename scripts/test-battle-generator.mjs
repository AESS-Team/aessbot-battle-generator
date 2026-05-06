import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function loadTs(relativePath) {
  const path = resolve(root, relativePath);
  if (cache.has(path)) return cache.get(path).exports;

  const source = readFileSync(path, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const exports = {};
  cache.set(path, { exports });

  const functionExports = [...js.matchAll(/export function (\w+)/g)].map((match) => match[1]);
  const constExports = [...js.matchAll(/export const (\w+)\s*=/g)].map((match) => match[1]);
  const exportedNames = [...functionExports, ...constExports];

  const rewritten = js
    .replace(/import\s+\{([^}]+)\}\s+from\s+['"]\.\/scoreUtils['"];?/g, (_, names) => {
      return `const {${names}} = await loadTs('src/logic/scoreUtils.ts');`;
    })
    .replace(/export function (\w+)/g, 'function $1')
    .replace(/export const (\w+)\s*=/g, 'const $1 =');

  const moduleUrl = pathToFileURL(path).href;
  const exportBlock = `\nObject.assign(exports, { ${exportedNames.join(', ')} });`;
  const fn = new AsyncFunction('exports', 'loadTs', `${rewritten}${exportBlock}\n//# sourceURL=${moduleUrl}`);
  await fn(exports, loadTs);
  return exports;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertOddTeamGeneration(result, teams) {
  assert(result.rounds.length > 0, `Expected rounds for 15 teams. Warnings: ${result.warnings.join(' | ')}`);
  assert(result.battles.length === 60, `Expected 60 battles for 15 teams playing 8 each, got ${result.battles.length}`);

  for (const round of result.rounds) {
    assert(round.battles.length > 0, `Round ${round.number} should not be empty`);
    assert(round.battles.length <= 7, `Expected at most 7 battles in round ${round.number}, got ${round.battles.length}`);

    const teamsInRound = new Set();
    for (const battle of round.battles) {
      assert(!teamsInRound.has(battle.teamA), `${battle.teamA} appears twice in round ${round.number}`);
      assert(!teamsInRound.has(battle.teamB), `${battle.teamB} appears twice in round ${round.number}`);
      teamsInRound.add(battle.teamA);
      teamsInRound.add(battle.teamB);
    }
  }

  const stats = new Map(result.teamStats.map((row) => [row.name, row.fights]));
  for (const team of teams) {
    assert(stats.get(team) === 8, `Expected ${team} to have 8 fights, got ${stats.get(team)}`);
  }

  const pairs = new Set();
  for (const battle of result.battles) {
    const key = [battle.teamA, battle.teamB].sort().join(' vs ');
    assert(!pairs.has(key), `Repeated battle: ${key}`);
    pairs.add(key);
  }
}

const { generateBattles } = await loadTs('src/logic/battleGenerator.ts');
const { getDirectQualifiedCount } = await loadTs('src/logic/standingsUtils.ts');
const { createGeneratedPhase3BracketState } = await loadTs('src/logic/phase3Publication.ts');
const teams = Array.from({ length: 15 }, (_, index) => `Team ${index + 1}`);
const result = generateBattles(teams, { fightCount: 8 });

assertOddTeamGeneration(result, teams);

const tiedBoundaryStandings = Array.from({ length: 15 }, (_, index) => ({
  team: `Team ${index + 1}`,
  pointsFor: index < 6 ? 24 - index * 3 : 6,
  pointsAgainst: 0,
  played: 8,
}));

assert(
  getDirectQualifiedCount(tiedBoundaryStandings, 7) === 7,
  'Expected 7 direct qualifiers even when teams around the cut are tied'
);

const publishedBracketState = createGeneratedPhase3BracketState({ quarterfinals: [] });
assert(
  publishedBracketState.phase3BracketPublished === true,
  'Expected generated phase 3 brackets to be visible in spectator mode immediately'
);

console.log('battleGenerator odd-team tests passed');
