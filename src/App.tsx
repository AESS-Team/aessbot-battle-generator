import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import TeamInput from './components/TeamInput';
import CompetitionConfigPanel from './components/CompetitionConfig';
import AlertBanner, { type Alert } from './components/AlertBanner';
import Phase1Results from './components/Phase1Results';
import Phase2Results from './components/Phase2Results';
import Phase3Results from './components/Phase3Results';
import SpectatorView from './components/SpectatorView';
import { generateBattles, type CompetitionConfig, type BattleResult } from './logic/battleGenerator';
import { generateBracket, type Bracket } from './logic/bracketGenerator';
import { createGeneratedPhase3BracketState } from './logic/phase3Publication';
import { DEFAULT_TIMER_STATE, TIMER_DURATION, type TimerState } from './logic/timerUtils';
import {
  createEmptyScore,
  getRoundCount,
  isScoreComplete,
  normalizeRoundsToWin,
  normalizeScoreMap,
  getWinnerSide,
  type MatchScore,
} from './logic/scoreUtils';
import { buildStandings, getDirectQualifiedCount } from './logic/standingsUtils';
import aessLogo from './assets/aess-logo.svg';
import aessLogoWhite from './assets/aess-logo-white.svg';
import styles from './App.module.css';

const STORAGE_KEY = 'aessbot-v1';
const THEME_STORAGE_KEY = 'aessbot-theme';
type ThemeMode = 'dark' | 'light';

const DEFAULT_COMPETITION_CONFIG: CompetitionConfig = {
  fightCount: 8,
  qualifiedCount: 8,
  simultaneousBattles: 1,
  roundsToWin: 2,
};

function loadTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const config = normalizeCompetitionConfig(parsed.config);
    const roundCount = getRoundCount(config.roundsToWin);
    return {
      ...parsed,
      config,
      battleScores: normalizeScoreMap(parsed.battleScores, roundCount, config.roundsToWin),
      bracketScores: normalizeScoreMap(parsed.bracketScores, roundCount, config.roundsToWin),
      timerState: normalizeTimerState(parsed.timerState),
    };
  } catch {
    return null;
  }
}

function normalizeCompetitionConfig(config: unknown): CompetitionConfig {
  if (!config || typeof config !== 'object') return DEFAULT_COMPETITION_CONFIG;
  const candidate = config as Partial<CompetitionConfig>;

  return {
    fightCount: Number.isFinite(Number(candidate.fightCount))
      ? Math.max(1, Math.min(Number(candidate.fightCount), 30))
      : DEFAULT_COMPETITION_CONFIG.fightCount,
    qualifiedCount: Number.isFinite(Number(candidate.qualifiedCount))
      ? Math.max(1, Math.min(Number(candidate.qualifiedCount), 8))
      : DEFAULT_COMPETITION_CONFIG.qualifiedCount,
    simultaneousBattles: Number.isFinite(Number(candidate.simultaneousBattles))
      ? Math.max(1, Math.min(Number(candidate.simultaneousBattles), 1))
      : DEFAULT_COMPETITION_CONFIG.simultaneousBattles,
    roundsToWin: normalizeRoundsToWin(candidate.roundsToWin),
  };
}

function normalizeTimerState(timerState: unknown): TimerState {
  if (!timerState || typeof timerState !== 'object') return DEFAULT_TIMER_STATE;
  const candidate = timerState as { pausedSecondsLeft?: unknown; startedAt?: unknown };
  const pausedSecondsLeft = Number(candidate.pausedSecondsLeft);
  const startedAt = typeof candidate.startedAt === 'number' ? candidate.startedAt : null;

  return {
    pausedSecondsLeft: Number.isFinite(pausedSecondsLeft)
      ? Math.max(0, Math.min(TIMER_DURATION, Math.floor(pausedSecondsLeft)))
      : DEFAULT_TIMER_STATE.pausedSecondsLeft,
    startedAt,
  };
}

const _persisted = loadPersistedState();
const hasPersistedPhase3PublicationState =
  _persisted !== null && Object.prototype.hasOwnProperty.call(_persisted, 'phase3BracketPublished');

type PhaseKey = 'phase1' | 'phase2' | 'phase3';
type BattleScores = Record<string, MatchScore>;
type BracketScores = Record<string, MatchScore>;
type RepescaWinners = string[];

function hasRegisteredScore(scores: Record<string, MatchScore>): boolean {
  return Object.values(scores).some((score) => score.rounds.some((roundWinner) => roundWinner !== ''));
}

function getBracketSignature(bracket: Bracket | null): string {
  if (!bracket) return '';

  return bracket.quarterfinals
    .flatMap((match) => [match.seedA, match.seedB])
    .sort((a, b) => a.seed - b.seed)
    .map((seed) => seed.name)
    .join('\u001f');
}

export default function App() {
  const FINAL_STAGE_SIZE = 8;

  const [teams, setTeams] = useState<string[]>(_persisted?.teams ?? []);
  const [config, setConfig] = useState<CompetitionConfig>(_persisted?.config ?? DEFAULT_COMPETITION_CONFIG);
  const [result, setResult] = useState<BattleResult | null>(_persisted?.result ?? null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [hasGenerated, setHasGenerated] = useState<boolean>(_persisted?.hasGenerated ?? false);
  const [activePhase, setActivePhase] = useState<PhaseKey>(_persisted?.activePhase ?? 'phase1');
  const [battleScores, setBattleScores] = useState<BattleScores>(_persisted?.battleScores ?? {});
  const [bracketScores, setBracketScores] = useState<BracketScores>(_persisted?.bracketScores ?? {});
  const [repescaWinners, setRepescaWinners] = useState<RepescaWinners>(_persisted?.repescaWinners ?? []);
  const [phase3Bracket, setPhase3Bracket] = useState<Bracket | null>(
    hasPersistedPhase3PublicationState ? _persisted?.phase3Bracket ?? null : null
  );
  const [phase3BracketPublished, setPhase3BracketPublished] = useState<boolean>(_persisted?.phase3BracketPublished ?? false);
  const [timerState, setTimerState] = useState<TimerState>(_persisted?.timerState ?? DEFAULT_TIMER_STATE);
  const [configOpen, setConfigOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(loadTheme);

  const isSpectatorMode = new URLSearchParams(window.location.search).get('mode') === 'spectator';
  const hasPhase1Results = hasRegisteredScore(battleScores);
  const hasPhase2Results = repescaWinners.some(Boolean);
  const hasPhase3Results = hasRegisteredScore(bracketScores);
  const hasAnyRegisteredResults = hasPhase1Results || hasPhase2Results || hasPhase3Results;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    function handleThemeStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      setTheme(event.newValue === 'light' ? 'light' : 'dark');
    }

    window.addEventListener('storage', handleThemeStorage);
    return () => window.removeEventListener('storage', handleThemeStorage);
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        teams, config, result, hasGenerated, activePhase, battleScores, bracketScores, repescaWinners, phase3Bracket, phase3BracketPublished, timerState,
      }));
    } catch {
      // ignore quota errors
    }
  }, [teams, config, result, hasGenerated, activePhase, battleScores, bracketScores, repescaWinners, phase3Bracket, phase3BracketPublished, timerState]);

  useEffect(() => {
    if (!configOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfigOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [configOpen]);

  const themeLogo = theme === 'light' ? aessLogo : aessLogoWhite;

  function resetCompetitionState() {
    setResult(null);
    setHasGenerated(false);
    setAlerts([]);
    setActivePhase('phase1');
    setBattleScores({});
    setBracketScores({});
    setRepescaWinners([]);
    setPhase3Bracket(null);
    setPhase3BracketPublished(false);
    setTimerState(DEFAULT_TIMER_STATE);
  }

  function confirmResultOverwrite(message: string) {
    return window.confirm(message);
  }

  function confirmIfResultsWouldBeRemoved(message: string) {
    if (!hasAnyRegisteredResults) return true;
    return confirmResultOverwrite(message);
  }

  function handleBracketScoreChange(matchId: string, score: MatchScore) {
    setBracketScores((prev) => {
      const prevWinner = getWinnerSide(prev[matchId], config.roundsToWin);
      const newWinner = getWinnerSide(score, config.roundsToWin);
      const winnerChanged = prevWinner !== newWinner;
      const roundCount = getRoundCount(config.roundsToWin);

      const next = { ...prev, [matchId]: score };

      if (winnerChanged) {
        if (matchId === 'qf1' || matchId === 'qf2') {
          next.sf1 = createEmptyScore(roundCount);
          next.thirdPlace = createEmptyScore(roundCount);
          next.final = createEmptyScore(roundCount);
        }
        if (matchId === 'qf3' || matchId === 'qf4') {
          next.sf2 = createEmptyScore(roundCount);
          next.thirdPlace = createEmptyScore(roundCount);
          next.final = createEmptyScore(roundCount);
        }
        if (matchId === 'sf1' || matchId === 'sf2') {
          next.thirdPlace = createEmptyScore(roundCount);
          next.final = createEmptyScore(roundCount);
        }
      }

      return next;
    });
  }

  function handleAddTeams(names: string[]) {
    if (!confirmIfResultsWouldBeRemoved(
      'Afegir equips reiniciarà la competició i eliminarà els resultats registrats a qualsevol fase. Continuar?'
    )) {
      return false;
    }

    setTeams((prev) => {
      const newNames = names.filter((n, index) => !prev.includes(n) && names.indexOf(n) === index);
      return [...prev, ...newNames];
    });
    resetCompetitionState();
    return true;
  }

  function handleRemoveTeam(name: string) {
    if (!confirmIfResultsWouldBeRemoved(
      `Eliminar ${name} reiniciarà la competició i eliminarà els resultats registrats a qualsevol fase. Continuar?`
    )) {
      return false;
    }

    setTeams((prev) => prev.filter((t) => t !== name));
    resetCompetitionState();
    return true;
  }

  function handleClearTeams() {
    if (!confirmIfResultsWouldBeRemoved(
      'Buidar els equips reiniciarà la competició i eliminarà els resultats registrats a qualsevol fase. Continuar?'
    )) {
      return false;
    }

    setTeams([]);
    resetCompetitionState();
    return true;
  }

  function handleBattleScoreChange(battleId: string, score: MatchScore) {
    setBattleScores((prev) => ({
      ...prev,
      [battleId]: score,
    }));
  }

  function handleSimulatePhase1Results() {
    if (!result) return;
    if (!confirmResultOverwrite(
      hasAnyRegisteredResults
        ? 'Simular la Fase 1 substituirà els resultats registrats i eliminarà els resultats de repesca i eliminatòries. Continuar?'
        : 'Vols simular automàticament tots els resultats de la Fase 1?'
    )) {
      return;
    }

    const simulatedScores = result.battles.reduce<BattleScores>((acc, battle) => {
      acc[battle.id] = createRandomCompleteScore(config.roundsToWin);
      return acc;
    }, {});

    setBattleScores(simulatedScores);
    setBracketScores({});
    setRepescaWinners([]);
    setPhase3Bracket(null);
    setPhase3BracketPublished(false);
  }

  function handleRepescaWinnerChange(roundIndex: number, winner: string) {
    if (hasPhase3Results && !confirmResultOverwrite(
      'Canviar la repesca eliminarà els resultats registrats de les eliminatòries. Continuar?'
    )) {
      return;
    }

    setRepescaWinners((prev) => {
      const next = [...prev];
      next[roundIndex] = winner;
      return next;
    });
    setBracketScores({});
    setPhase3Bracket(null);
    setPhase3BracketPublished(false);
  }

  const standings = result ? buildStandings(teams, result.battles, battleScores, config.roundsToWin) : [];
  const completedBattleCount = result
    ? result.battles.filter((battle) => isScoreComplete(battleScores[battle.id], config.roundsToWin)).length
    : 0;
  const allPhase1ResultsRegistered =
    result !== null && completedBattleCount === result.battles.length && result.battles.length > 0;
  const rankedTeams = allPhase1ResultsRegistered ? standings.map((row) => row.team) : [];
  const requestedDirectQualifiedCount = Math.min(config.qualifiedCount, FINAL_STAGE_SIZE, standings.length);
  const phase1PreviewQualifiedCount = getDirectQualifiedCount(standings, requestedDirectQualifiedCount, FINAL_STAGE_SIZE);
  const directQualifiedCount = allPhase1ResultsRegistered
    ? getDirectQualifiedCount(standings, requestedDirectQualifiedCount, FINAL_STAGE_SIZE)
    : requestedDirectQualifiedCount;
  const previewRepescaSlots = Math.max(FINAL_STAGE_SIZE - phase1PreviewQualifiedCount, 0);
  const repescaSlots = Math.max(FINAL_STAGE_SIZE - directQualifiedCount, 0);
  const qualifiedTeams = rankedTeams.slice(0, directQualifiedCount);
  const repescaTeams = rankedTeams.slice(directQualifiedCount);
  const hasEnoughTeamsForQuarterfinals = rankedTeams.length >= FINAL_STAGE_SIZE;
  const filledRepescaWinners = repescaWinners.filter(Boolean);
  const isRepescaRequired = repescaSlots > 0;
  const isRepescaComplete = !isRepescaRequired || filledRepescaWinners.length === repescaSlots;
  const finalistTeams = isRepescaRequired
    ? [...qualifiedTeams, ...filledRepescaWinners]
    : qualifiedTeams;
  const bracketReady =
    allPhase1ResultsRegistered &&
    isRepescaComplete &&
    hasEnoughTeamsForQuarterfinals &&
    finalistTeams.length === FINAL_STAGE_SIZE;
  const finalistSignature = finalistTeams.join('\u001f');
  const computedBracket = bracketReady && getBracketSignature(phase3Bracket) === finalistSignature
    ? phase3Bracket
    : null;
  const isPhase3Complete = computedBracket !== null
    && getWinnerSide(bracketScores.thirdPlace, config.roundsToWin) !== null
    && getWinnerSide(bracketScores.final, config.roundsToWin) !== null;

  function handleGeneratePhase3Bracket() {
    if (!bracketReady) return;
    if ((computedBracket || hasPhase3Results) && !confirmResultOverwrite(
      hasPhase3Results
        ? 'Generar un nou encreuament eliminarà els resultats registrats de les eliminatòries i el publicarà al mode espectador. Continuar?'
        : 'Vols generar un nou encreuament aleatori per a quarts?'
    )) {
      return;
    }

    const nextBracketState = createGeneratedPhase3BracketState(generateBracket(finalistTeams));
    setPhase3Bracket(nextBracketState.phase3Bracket);
    setBracketScores({});
    setPhase3BracketPublished(nextBracketState.phase3BracketPublished);
  }

  function handlePublishPhase3Bracket() {
    if (!computedBracket) return;
    setPhase3BracketPublished(true);
  }

  function handleSimulateRepesca() {
    if (!confirmResultOverwrite(
      hasPhase2Results || hasPhase3Results
        ? 'Simular la repesca substituirà els classificats registrats i eliminarà els resultats de les eliminatòries. Continuar?'
        : 'Vols simular automàticament els classificats de la repesca?'
    )) {
      return;
    }

    const simulated: string[] = [];
    const available = [...repescaTeams];

    for (let i = 0; i < repescaSlots && available.length > 0; i++) {
      const index = Math.floor(Math.random() * available.length);
      simulated.push(available[index]);
      available.splice(index, 1);
    }

    setRepescaWinners(simulated);
    setBracketScores({});
    setPhase3Bracket(null);
    setPhase3BracketPublished(false);
  }

  const handleGenerate = useCallback(() => {
    if (teams.length < 4) {
      setAlerts([{
        type: 'error',
        message: `Es necessiten almenys 4 equips per generar combats. Ara hi ha ${teams.length} equip${teams.length !== 1 ? 's' : ''}.`,
      }]);
      return;
    }

    if (hasAnyRegisteredResults && !window.confirm(
      'Generar batalles de nou eliminarà els resultats registrats a qualsevol fase. Continuar?'
    )) {
      return;
    }

    const battleResult = generateBattles(teams, config);
    setResult(battleResult);
    setBattleScores({});
    setBracketScores({});
    setRepescaWinners([]);
    setPhase3Bracket(null);
    setPhase3BracketPublished(false);

    if (battleResult.rounds.length === 0) {
      setAlerts(
        battleResult.warnings.map((w) => ({
          type: 'error' as const,
          message: w,
        }))
      );
      setHasGenerated(false);
      return;
    }

    const newAlerts: Alert[] = battleResult.warnings.map((w) => ({
      type: 'warning' as const,
      message: w,
    }));

    setAlerts(newAlerts);
    setHasGenerated(true);
    setActivePhase('phase1');
    setConfigOpen(false);
  }, [teams, config, hasAnyRegisteredResults]);

  function handleRegenerate() {
    handleGenerate();
  }

  function handleReset() {
    setResetPending(true);
  }

  function handleResetConfirm() {
    setResetPending(false);
    setTeams([]);
    setConfig(DEFAULT_COMPETITION_CONFIG);
    resetCompetitionState();
  }

  function handleResetCancel() {
    setResetPending(false);
  }

  function handleToggleTheme() {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  }

  const canGenerate = teams.length >= 4;

  if (isSpectatorMode) {
    return <SpectatorView theme={theme} />;
  }

  return (
    <div className={styles.app}>
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenConfig={() => setConfigOpen(true)}
      />

      <main className={styles.main}>
        <div className="container">
          <div className={styles.results}>
            <AlertBanner alerts={alerts} />

            {!hasGenerated ? (
              <div className={styles.emptyState}>
                <img className={styles.emptyLogo} src={themeLogo} alt="AESS" />
                <h2 className={styles.emptyTitle}>Preparat per generar</h2>
                <p className={styles.emptyText}>
                  Obre la <strong>configuració</strong> amb el botó d&apos;engranatge,
                  afegeix els equips participants, ajusta els paràmetres i genera
                  la competició per començar a treballar amb les fases.
                </p>
                <div className={styles.emptySteps}>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>1</span>
                    <span>Obre configuració</span>
                  </div>
                  <div className={styles.stepArrow}>→</div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>2</span>
                    <span>Afegeix equips</span>
                  </div>
                  <div className={styles.stepArrow}>→</div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>3</span>
                    <span>Genera fases</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.phaseTabsLayout}>
                <div className={styles.phaseTabs} role="tablist" aria-label="Fases de la competició">
                  {(
                    [
                      { key: 'phase1' as PhaseKey, label: 'Fase 1', status: allPhase1ResultsRegistered ? 'completed' : 'active' },
                      { key: 'phase2' as PhaseKey, label: 'Fase 2', status: !allPhase1ResultsRegistered ? 'locked' : isRepescaComplete ? 'completed' : 'active' },
                      { key: 'phase3' as PhaseKey, label: 'Fase 3', status: (!allPhase1ResultsRegistered || (isRepescaRequired && !isRepescaComplete)) ? 'locked' : isPhase3Complete ? 'completed' : 'active' },
                    ] as const
                  ).map(({ key, label, status }) => (
                    <button
                      key={key}
                      type="button"
                      className={[
                        styles.phaseTab,
                        activePhase === key ? styles.phaseTabActive : '',
                        status === 'completed' ? styles.phaseTabCompleted : '',
                        status === 'locked' ? styles.phaseTabLocked : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setActivePhase(key)}
                      aria-pressed={activePhase === key}
                    >
                      {status === 'completed' && <span className={styles.phaseTabIcon}>✓</span>}
                      {status === 'locked' && <span className={styles.phaseTabIcon}>🔒</span>}
                      {label}
                    </button>
                  ))}
                </div>

                <section className={`card card--elevated ${styles.phasePanel}`}>
                  <div key={activePhase} className={styles.phasePanelContent}>
                  {activePhase === 'phase1' && result && (
                    <Phase1Results
                      battles={result.battles}
                      rounds={result.rounds}
                      simultaneousBattles={config.simultaneousBattles}
                      roundsToWin={config.roundsToWin}
                      onRegenerate={handleRegenerate}
                      onSimulateResults={handleSimulatePhase1Results}
                      battleScores={battleScores}
                      onBattleScoreChange={handleBattleScoreChange}
                      standings={standings}
                      completedBattleCount={completedBattleCount}
                      directQualifiedCount={phase1PreviewQualifiedCount}
                      repescaSlots={previewRepescaSlots}
                      timerState={timerState}
                      onTimerChange={setTimerState}
                    />
                  )}

                  {activePhase === 'phase2' && (
                    allPhase1ResultsRegistered ? (
                      <Phase2Results
                        repescaTeams={repescaTeams}
                        qualifiedCount={directQualifiedCount}
                        repescaSlots={repescaSlots}
                        repescaWinners={repescaWinners}
                        standings={standings}
                        roundsToWin={config.roundsToWin}
                        onRepescaWinnerChange={handleRepescaWinnerChange}
                        onSimulateRepesca={handleSimulateRepesca}
                      />
                    ) : (
                      <LockedPhaseMessage
                        title="Completa la Fase 1"
                        message={`Registra els resultats dels ${result?.battles.length ?? 0} combats de la lliga per calcular quins equips passen a repesca.`}
                        actionLabel="Simular resultats"
                        onAction={handleSimulatePhase1Results}
                      />
                    )
                  )}

                  {activePhase === 'phase3' && !allPhase1ResultsRegistered && (
                    <LockedPhaseMessage
                      title="Pendent de classificació"
                      message="La fase final no es pot preparar fins que tots els combats de la Fase 1 tinguin resultat."
                      actionLabel="Simular resultats"
                      onAction={handleSimulatePhase1Results}
                    />
                  )}

                  {activePhase === 'phase3' && allPhase1ResultsRegistered && isRepescaRequired && !isRepescaComplete && (
                    <LockedPhaseMessage
                      title="Pendent de repesca"
                      message={`Cal registrar ${repescaSlots} classificat${repescaSlots > 1 ? 's' : ''} de repesca per generar el quadre final.`}
                      actionLabel="Simular repesca"
                      onAction={handleSimulateRepesca}
                    />
                  )}

                  {activePhase === 'phase3' && allPhase1ResultsRegistered && !hasEnoughTeamsForQuarterfinals && (
                    <>
                      <div className="section-tag">Fase 3</div>
                      <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-sm)', fontSize: '0.9rem' }}>
                        Es necessiten 8 equips per generar el quadre eliminatori.
                        Ara n&apos;hi ha {rankedTeams.length}.
                      </p>
                    </>
                  )}

                  {activePhase === 'phase3' && bracketReady && !computedBracket && (
                    <Phase3BracketGate
                      onGenerate={handleGeneratePhase3Bracket}
                    />
                  )}

                  {activePhase === 'phase3' &&
                    bracketReady &&
                    computedBracket && (
                      <>
                        <Phase3BracketActions
                          isPublished={phase3BracketPublished}
                          onRegenerate={handleGeneratePhase3Bracket}
                          onPublish={handlePublishPhase3Bracket}
                        />
                        <Phase3Results
                          bracket={computedBracket}
                          finalistTeams={finalistTeams}
                          directQualifiedCount={directQualifiedCount}
                          repescaCount={filledRepescaWinners.length}
                          bracketScores={bracketScores}
                          roundsToWin={config.roundsToWin}
                          timerState={timerState}
                          onTimerChange={setTimerState}
                          onBracketScoreChange={handleBracketScoreChange}
                        />
                      </>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </main>

      {configOpen && (
        <div className={styles.configOverlay} onClick={() => setConfigOpen(false)}>
          <div
            className={`card card--elevated ${styles.configModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.configHeader}>
              <div>
                <div className="section-tag">Configuració</div>
                <h2 className={styles.configTitle}>Paràmetres i equips</h2>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setConfigOpen(false)}
              >
                Tancar
              </button>
            </div>

            <div className={styles.configContent}>
              <div className="card">
                <CompetitionConfigPanel
                  config={config}
                  onChange={setConfig}
                  teamCount={teams.length}
                />
              </div>

              <div className="card">
                <TeamInput
                  teams={teams}
                  onAdd={handleAddTeams}
                  onRemove={handleRemoveTeam}
                  onClear={handleClearTeams}
                />
              </div>
            </div>

            <div className={styles.configActions}>
              <button
                id="btn-generate"
                className="btn btn--primary btn--large"
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{ flex: 1 }}
              >
                <img className={styles.buttonLogo} src={themeLogo} alt="" aria-hidden="true" />
                Generar batalles
              </button>
              {hasGenerated && !resetPending && (
                <button
                  id="btn-reset"
                  className="btn btn--secondary"
                  onClick={handleReset}
                  title="Reiniciar tot"
                >
                  🔄 Reiniciar
                </button>
              )}
            </div>

            {resetPending && (
              <div className={styles.resetConfirm}>
                <p className={styles.resetConfirmText}>
                  S&apos;esborraran tots els equips, resultats i dades de la competició. Continuar?
                </p>
                <div className={styles.resetConfirmActions}>
                  <button
                    className="btn btn--danger"
                    onClick={handleResetConfirm}
                  >
                    Sí, esborrar-ho tot
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={handleResetCancel}
                  >
                    Cancel·lar
                  </button>
                </div>
              </div>
            )}

            {!canGenerate && teams.length > 0 && (
              <p className={styles.validationHint}>
                {teams.length < 4
                  ? `Afegeix almenys ${4 - teams.length} equip${4 - teams.length > 1 ? 's' : ''} més`
                  : 'Ja pots generar la competició'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function createRandomCompleteScore(roundsToWin: number): MatchScore {
  const roundCount = getRoundCount(roundsToWin);
  const rounds: MatchScore['rounds'] = [];
  let teamAWins = 0;
  let teamBWins = 0;

  for (let index = 0; index < roundCount; index++) {
    if (teamAWins >= roundsToWin || teamBWins >= roundsToWin) {
      rounds.push('');
      continue;
    }

    const winner = Math.random() > 0.5 ? 'teamA' : 'teamB';
    rounds.push(winner);
    if (winner === 'teamA') teamAWins += 1;
    if (winner === 'teamB') teamBWins += 1;
  }

  return { rounds };
}

function LockedPhaseMessage({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div>
      <div className="section-tag">Pendent</div>
      <p style={{ color: 'var(--text-primary)', marginTop: 'var(--space-sm)', fontWeight: 600 }}>
        {title}
      </p>
      <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)', fontSize: '0.9rem' }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          className="btn btn--secondary"
          style={{ marginTop: 'var(--space-md)' }}
          onClick={onAction}
        >
          🎲 {actionLabel}
        </button>
      )}
    </div>
  );
}

function Phase3BracketGate({
  onGenerate,
}: {
  onGenerate: () => void;
}) {
  return (
    <div>
      <div className="section-tag">Fase 3</div>
      <p style={{ color: 'var(--text-primary)', marginTop: 'var(--space-sm)', fontWeight: 600 }}>
        Encreuaments pendents de sorteig
      </p>
      <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)', fontSize: '0.9rem' }}>
        Genera els quarts de final quan vulguis. El mode espectador els veurà automàticament.
      </p>
      <button
        type="button"
        className="btn btn--primary"
        style={{ marginTop: 'var(--space-md)' }}
        onClick={onGenerate}
      >
        🎲 Generar encreuaments
      </button>
    </div>
  );
}

function Phase3BracketActions({
  isPublished,
  onRegenerate,
  onPublish,
}: {
  isPublished: boolean;
  onRegenerate: () => void;
  onPublish: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-sm)',
      marginBottom: 'var(--space-md)',
      paddingBottom: 'var(--space-md)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span className={isPublished ? 'badge badge--secondary' : 'badge'}>
        {isPublished ? 'Publicat al mode espectador' : 'Encara no publicat'}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <button type="button" className="btn btn--secondary" onClick={onRegenerate}>
          🎲 Tornar a generar
        </button>
        {!isPublished && (
          <button type="button" className="btn btn--primary" onClick={onPublish}>
            Publicar al mode espectador
          </button>
        )}
      </div>
    </div>
  );
}
