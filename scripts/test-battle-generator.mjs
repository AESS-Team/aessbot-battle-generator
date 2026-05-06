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
  assert(result.rounds.length === result.battles.length, `Expected one combat per jornada, got ${result.rounds.length} rounds for ${result.battles.length} battles`);

  for (const round of result.rounds) {
    assert(round.battles.length === 1, `Expected exactly 1 battle in round ${round.number}, got ${round.battles.length}`);

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
const { updateRoundWinner, getScoreTotals, sanitizeScore } = await loadTs('src/logic/scoreUtils.ts');
const { getDirectQualifiedCount } = await loadTs('src/logic/standingsUtils.ts');
const { createGeneratedPhase3BracketState } = await loadTs('src/logic/phase3Publication.ts');
const { buildPhase1BattlesWorkbook } = await loadTs('src/logic/xlsxUtils.ts');
const teams = Array.from({ length: 15 }, (_, index) => `Team ${index + 1}`);
const result = generateBattles(teams, { fightCount: 8 });

assertOddTeamGeneration(result, teams);

const bestOfThreeLockedScore = [
  [0, 'teamA'],
  [1, 'teamA'],
  [2, 'teamA'],
].reduce((score, [roundIndex, side]) => (
  updateRoundWinner(score, roundIndex, side, 3, 2)
), undefined);

assert(
  getScoreTotals(bestOfThreeLockedScore, 3).teamA === 2,
  'Expected best-of-3 scores to stop once a team reaches 2 wins'
);

const repairedLegacyScore = sanitizeScore({ rounds: ['teamB', 'teamB', 'teamB'] }, 3, 2);
assert(
  getScoreTotals(repairedLegacyScore, 3).teamB === 2,
  'Expected legacy 3-win best-of-3 scores to be trimmed to 2 wins'
);

const tiedBoundaryStandings = [15, 12, 12, 9, 9, 9, 9, 9, 6, 6, 6, 3, 0, 0].map((pointsFor, index) => ({
  team: `Team ${index + 1}`,
  pointsFor,
  pointsAgainst: 0,
  played: 5,
}));

assert(
  getDirectQualifiedCount(tiedBoundaryStandings, 7, 8) === 3,
  'Expected only teams above the 8th-place points to qualify directly'
);

const uniqueBoundaryStandings = [24, 21, 18, 15, 12, 9, 6, 3, 0].map((pointsFor, index) => ({
  team: `Unique ${index + 1}`,
  pointsFor,
  pointsAgainst: 0,
  played: 8,
}));

assert(
  getDirectQualifiedCount(uniqueBoundaryStandings, 7, 8) === 7,
  'Expected configured direct qualifiers when the 8th-place cut is not tied'
);

const publishedBracketState = createGeneratedPhase3BracketState({ quarterfinals: [] });
assert(
  publishedBracketState.phase3BracketPublished === true,
  'Expected generated phase 3 brackets to be visible in spectator mode immediately'
);

const workbookBytes = buildPhase1BattlesWorkbook(
  [{
    number: 1,
    battles: [
      { id: 'battle-1', teamA: 'Ashfu', teamB: 'Bobobot', repeated: false },
      { id: 'battle-2', teamA: 'Brouston', teamB: 'Clanker', repeated: false },
    ],
  }],
  { 'battle-1': { rounds: ['teamA', 'teamB', 'teamA'] } },
  2
);
const workbookText = new TextDecoder().decode(workbookBytes);
assert(workbookBytes[0] === 0x50 && workbookBytes[1] === 0x4b, 'Expected XLSX ZIP signature');
assert(workbookText.includes('xl/worksheets/sheet1.xml'), 'Expected worksheet entry in XLSX');
assert(workbookText.includes('Guanyador'), 'Expected winner column in battle export');
assert(workbookText.includes('Ashfu'), 'Expected team names in battle export');
assert(workbookText.includes('Completat'), 'Expected completed battles in battle export');
assert(workbookText.includes('Pendent'), 'Expected pending battles in battle export');

console.log('battleGenerator odd-team tests passed');
