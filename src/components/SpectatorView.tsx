import { useState, useEffect } from 'react';
import { computeSecondsLeft, TIMER_DURATION, type TimerState } from '../logic/timerUtils';
import type { Bracket } from '../logic/bracketGenerator';
import {
  getLoser,
  getScoreTotals,
  getRoundCount,
  getWinner,
  isScoreComplete,
  normalizeRoundsToWin,
  normalizeScoreMap,
  type MatchScore,
} from '../logic/scoreUtils';
import { buildStandings, getDirectQualifiedCount } from '../logic/standingsUtils';
import { buildPhase2Standings } from '../logic/phase2Standings';
import {
  CW, CH, QF_LX, SF_LX, FIN_X, SF_RX, QF_RX,
  QF1_Y, QF2_Y, QF1_CY, QF2_CY, SF_CY, SF_Y, THIRD_Y, SVG_W, SVG_H, JUNC_L, JUNC_R,
  type ResolvedMatch, type ResolvedBracket,
} from '../logic/bracketSvgConstants';
import aessLogo from '../assets/aess-logo.svg';
import aessLogoWhite from '../assets/aess-logo-white.svg';
import logoTelecos from '../assets/logo-telecos.svg';
import logoVento from '../assets/logo-vento.svg';
import logoUpc from '../assets/logo-upc.svg';
import styles from './SpectatorView.module.css';

const STORAGE_KEY = 'aessbot-v1';
const FINAL_STAGE_SIZE = 8;

interface Battle { id: string; teamA: string; teamB: string; }
interface Round  { number: number; battles: Battle[]; }

interface PersistedState {
  teams: string[];
  result: { battles: Battle[]; rounds: Round[] } | null;
  battleScores: Record<string, MatchScore>;
  bracketScores: Record<string, MatchScore>;
  repescaWinners: string[];
  phase3Bracket?: Bracket | null;
  phase3BracketPublished?: boolean;
  activePhase: string;
  hasGenerated: boolean;
  config: { qualifiedCount: number; simultaneousBattles: number; roundsToWin?: number };
  timerState?: TimerState;
}

function getRoundsToWin(state: PersistedState | null): number {
  return normalizeRoundsToWin(state?.config?.roundsToWin);
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const roundsToWin = normalizeRoundsToWin(parsed.config?.roundsToWin);
    const roundCount = getRoundCount(roundsToWin);
    return {
      ...parsed,
      config: {
        ...parsed.config,
        roundsToWin,
      },
      battleScores: normalizeScoreMap(parsed.battleScores, roundCount, roundsToWin),
      bracketScores: normalizeScoreMap(parsed.bracketScores, roundCount, roundsToWin),
    };
  } catch { return null; }
}

function getBracketSignature(bracket: Bracket): string {
  return bracket.quarterfinals
    .flatMap((match) => [match.seedA, match.seedB])
    .sort((a, b) => a.seed - b.seed)
    .map((seed) => seed.name)
    .join('\u001f');
}

function resolveChampion(state: PersistedState | null): string | null {
  if (!state?.hasGenerated || !state.result) return null;
  if (!state.phase3BracketPublished) return null;

  const { teams, result, battleScores, bracketScores, repescaWinners, config } = state;
  const roundsToWin = getRoundsToWin(state);
  const standings = buildStandings(teams, result.battles, battleScores, roundsToWin);
  const completedCount = result.battles.filter(b => isScoreComplete(battleScores[b.id], roundsToWin)).length;
  const allPhase1ResultsRegistered = completedCount === result.battles.length && result.battles.length > 0;
  if (!allPhase1ResultsRegistered) return null;

  const rankedTeams = standings.map((row) => row.team);
  const filledRepescaWinners = repescaWinners.filter(Boolean);
  const requestedDirectQualifiedCount = Math.min(config.qualifiedCount ?? 6, FINAL_STAGE_SIZE, standings.length);
  const directQualifiedCount = getDirectQualifiedCount(standings, requestedDirectQualifiedCount, FINAL_STAGE_SIZE);
  const repescaSlots = Math.max(FINAL_STAGE_SIZE - directQualifiedCount, 0);
  const finalistTeams = repescaSlots > 0
    ? [...rankedTeams.slice(0, directQualifiedCount), ...filledRepescaWinners]
    : rankedTeams.slice(0, directQualifiedCount);
  if (rankedTeams.length < FINAL_STAGE_SIZE || finalistTeams.length !== FINAL_STAGE_SIZE) return null;

  const bracket = state.phase3Bracket;
  if (!bracket || getBracketSignature(bracket) !== finalistTeams.join('\u001f')) return null;

  const qf = bracket.quarterfinals;
  const qf1W = getWinner(qf[0].seedA.name, qf[0].seedB.name, bracketScores.qf1, roundsToWin);
  const qf2W = getWinner(qf[1].seedA.name, qf[1].seedB.name, bracketScores.qf2, roundsToWin);
  const qf3W = getWinner(qf[2].seedA.name, qf[2].seedB.name, bracketScores.qf3, roundsToWin);
  const qf4W = getWinner(qf[3].seedA.name, qf[3].seedB.name, bracketScores.qf4, roundsToWin);
  const sf1W = qf1W && qf2W ? getWinner(qf1W, qf2W, bracketScores.sf1, roundsToWin) : null;
  const sf2W = qf3W && qf4W ? getWinner(qf3W, qf4W, bracketScores.sf2, roundsToWin) : null;
  const thirdPlaceComplete = isScoreComplete(bracketScores.thirdPlace, roundsToWin);

  return sf1W && sf2W && thirdPlaceComplete
    ? getWinner(sf1W, sf2W, bracketScores.final, roundsToWin)
    : null;
}


export default function SpectatorView({
  theme,
}: {
  theme: 'dark' | 'light';
}) {
  const [state, setState] = useState<PersistedState | null>(() => loadState());
  const [celebratingChampion, setCelebratingChampion] = useState<string | null>(null);
  const [, tick] = useState(0);
  const themeLogo = theme === 'light' ? aessLogo : aessLogoWhite;
  const championForCelebration = resolveChampion(state);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setState(loadState()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      tick(n => n + 1);
      setState(loadState());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const nextChampion = championForCelebration;
    if (!nextChampion) {
      const resetTimeout = window.setTimeout(() => setCelebratingChampion(null), 0);
      return () => window.clearTimeout(resetTimeout);
    }

    const startTimeout = window.setTimeout(() => setCelebratingChampion(nextChampion), 0);
    const timeout = window.setTimeout(() => {
      setCelebratingChampion((currentChampion) => (
        currentChampion === nextChampion ? null : currentChampion
      ));
    }, 10000);

    return () => {
      window.clearTimeout(startTimeout);
      window.clearTimeout(timeout);
    };
  }, [championForCelebration]);

  if (!state?.hasGenerated || !state.result) {
    const waitingTeamCount = state?.teams?.length ?? 0;
    const waitingFightCount = state?.config?.qualifiedCount ?? FINAL_STAGE_SIZE;
    const waitingSimultaneous = state?.config?.simultaneousBattles ?? 1;

    return (
      <div className={styles.spectator}>
        <div className={styles.waiting}>
          <div className={styles.waitingHero}>
            <img className={styles.waitingLogo} src={themeLogo} alt="AESS" />
            <div>
              <div className={styles.waitingKicker}>AESSBot Battle Generator</div>
              <div className={styles.waitingTitle}>Competició preparada</div>
              <div className={styles.waitingMsg}>Esperant que el jurat iniciï la competició...</div>
            </div>
          </div>

          <div className={styles.waitingGrid}>
            <div className={styles.waitingPanel}>
              <div className={styles.waitingPanelLabel}>Estat</div>
              <div className={styles.waitingStatus}>
                <span className={styles.waitingStatusDot} />
                En espera
              </div>
              <div className={styles.waitingProgress} aria-hidden="true">
                <span />
              </div>
            </div>

            <div className={styles.waitingPanel}>
              <div className={styles.waitingPanelLabel}>Configuració</div>
              <div className={styles.waitingStats}>
                <div>
                  <span className={styles.waitingStatValue}>{waitingTeamCount}</span>
                  <span className={styles.waitingStatLabel}>equips</span>
                </div>
                <div>
                  <span className={styles.waitingStatValue}>{waitingFightCount}</span>
                  <span className={styles.waitingStatLabel}>classificats</span>
                </div>
                <div>
                  <span className={styles.waitingStatValue}>{waitingSimultaneous}</span>
                  <span className={styles.waitingStatLabel}>simultanis</span>
                </div>
              </div>
            </div>

            <div className={styles.waitingPanel}>
              <div className={styles.waitingPanelLabel}>Pròximament</div>
              <div className={styles.waitingTimeline}>
                <span>Fase 1 · Lliga</span>
                <span>Fase 2 · Repesca</span>
                <span>Fase 3 · Eliminatòries</span>
              </div>
            </div>
          </div>

          <div className={styles.waitingTicker} aria-hidden="true">
            <span>AESSBot</span>
            <span>Robots sumo</span>
            <span>Fase 1</span>
            <span>Repesca</span>
            <span>Finals</span>
          </div>

          <div className={styles.waitingSponsors} aria-label="Sponsors AESSBot">
            <div className={styles.waitingSponsorsLabel}>powered by</div>
            <div className={styles.waitingSponsorLogos}>
              <img src={logoTelecos} alt="Telecos" />
              <img className={styles.waitingSponsorLogoPrimary} src={logoVento} alt="Vento" />
              <img src={logoUpc} alt="UPC" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { teams, result, battleScores, bracketScores, repescaWinners, activePhase, config, timerState } = state;
  const roundsToWin = getRoundsToWin(state);
  const roundCount = getRoundCount(roundsToWin);

  // Timer
  const timer = timerState ?? { pausedSecondsLeft: TIMER_DURATION, startedAt: null };
  const secondsLeft = computeSecondsLeft(timer);
  const isRunning = timer.startedAt !== null;
  const isWarning = secondsLeft <= 30 && secondsLeft > 0 && isRunning;
  const isFinished = secondsLeft === 0;
  const progress = secondsLeft / TIMER_DURATION;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  // Standings
  const standings = buildStandings(teams, result.battles, battleScores, roundsToWin);
  const completedCount = result.battles.filter(b => isScoreComplete(battleScores[b.id], roundsToWin)).length;
  const allPhase1ResultsRegistered =
    result !== null && completedCount === result.battles.length && result.battles.length > 0;
  const rankedTeams = allPhase1ResultsRegistered ? standings.map((row) => row.team) : [];

  // Qualified/repesca split, mirroring the main app logic
  const filledRepescaWinners = repescaWinners.filter(Boolean);
  const requestedDirectQualifiedCount = Math.min(config.qualifiedCount ?? 6, FINAL_STAGE_SIZE, standings.length);
  const directQualifiedCount = allPhase1ResultsRegistered
    ? getDirectQualifiedCount(standings, requestedDirectQualifiedCount, FINAL_STAGE_SIZE)
    : requestedDirectQualifiedCount;
  const repescaSlots = Math.max(FINAL_STAGE_SIZE - directQualifiedCount, 0);
  const qualifiedTeams = rankedTeams.slice(0, directQualifiedCount);
  const repescaTeams = rankedTeams.slice(directQualifiedCount);
  const displayStandings = activePhase === 'phase2'
    ? buildPhase2Standings(standings, directQualifiedCount, repescaWinners)
    : standings;
  const isRepescaRequired = repescaSlots > 0;
  const isRepescaComplete = !isRepescaRequired || filledRepescaWinners.length === repescaSlots;
  const hasEnoughTeamsForQuarterfinals = rankedTeams.length >= FINAL_STAGE_SIZE;

  // Phase 1 current round
  const currentRound = result.rounds.find(r => r.battles.some(b => !isScoreComplete(battleScores[b.id], roundsToWin))) ?? null;
  const totalRounds = result.rounds.length;

  // Phase 3 bracket
  const finalistTeams = isRepescaRequired
    ? [...qualifiedTeams, ...filledRepescaWinners]
    : qualifiedTeams;
  const computedBracket =
    allPhase1ResultsRegistered &&
    isRepescaComplete &&
    hasEnoughTeamsForQuarterfinals &&
    finalistTeams.length === FINAL_STAGE_SIZE &&
    state.phase3BracketPublished &&
    state.phase3Bracket &&
    getBracketSignature(state.phase3Bracket) === finalistTeams.join('\u001f')
      ? state.phase3Bracket
      : null;

  let champion: string | null = null;
  let resolvedBracket: ResolvedBracket | null = null;
  let currentBracketMatchId: string | null = null;
  let currentBracketMatch: ResolvedMatch | null = null;

  if (computedBracket) {
    const qf = computedBracket.quarterfinals;
    const [qf1A, qf1B] = [qf[0].seedA.name, qf[0].seedB.name];
    const [qf2A, qf2B] = [qf[1].seedA.name, qf[1].seedB.name];
    const [qf3A, qf3B] = [qf[2].seedA.name, qf[2].seedB.name];
    const [qf4A, qf4B] = [qf[3].seedA.name, qf[3].seedB.name];
    const qf1W = getWinner(qf1A, qf1B, bracketScores['qf1'], roundsToWin);
    const qf2W = getWinner(qf2A, qf2B, bracketScores['qf2'], roundsToWin);
    const qf3W = getWinner(qf3A, qf3B, bracketScores['qf3'], roundsToWin);
    const qf4W = getWinner(qf4A, qf4B, bracketScores['qf4'], roundsToWin);
    const sf1W = qf1W && qf2W ? getWinner(qf1W, qf2W, bracketScores['sf1'], roundsToWin) : null;
    const sf2W = qf3W && qf4W ? getWinner(qf3W, qf4W, bracketScores['sf2'], roundsToWin) : null;
    const sf1L = qf1W && qf2W ? getLoser(qf1W, qf2W, bracketScores['sf1'], roundsToWin) : null;
    const sf2L = qf3W && qf4W ? getLoser(qf3W, qf4W, bracketScores['sf2'], roundsToWin) : null;
    const thirdPlaceComplete = isScoreComplete(bracketScores.thirdPlace, roundsToWin);
    champion = sf1W && sf2W && thirdPlaceComplete
      ? getWinner(sf1W, sf2W, bracketScores['final'], roundsToWin)
      : null;

    currentBracketMatchId = [
      { id: 'qf1', ready: true },
      { id: 'qf2', ready: true },
      { id: 'qf3', ready: true },
      { id: 'qf4', ready: true },
      { id: 'sf1', ready: Boolean(qf1W && qf2W) },
      { id: 'sf2', ready: Boolean(qf3W && qf4W) },
      { id: 'thirdPlace', ready: Boolean(sf1L && sf2L) },
      { id: 'final', ready: Boolean(sf1W && sf2W && thirdPlaceComplete) },
    ].find((match) => match.ready && !isScoreComplete(bracketScores[match.id], roundsToWin))?.id ?? null;

    // Resolved bracket with winner names for the SVG display
    const sf1A = qf1W ?? 'Guanyador QF 1';
    const sf1B = qf2W ?? 'Guanyador QF 2';
    const sf2A = qf3W ?? 'Guanyador QF 3';
    const sf2B = qf4W ?? 'Guanyador QF 4';
    const finA = sf1W ?? 'Guanyador SF-A';
    const finB = sf2W ?? 'Guanyador SF-B';
    const thirdA = sf1L ?? 'Perdedor SF-A';
    const thirdB = sf2L ?? 'Perdedor SF-B';
    const thirdPlaceTemplate = computedBracket.thirdPlace ?? {
      id: 'thirdPlace',
      seedA: { seed: 0, name: 'Perdedor SF-A' },
      seedB: { seed: 0, name: 'Perdedor SF-B' },
      winner: null,
      label: '3r / 4t lloc',
    };
    resolvedBracket = {
      quarterfinals: computedBracket.quarterfinals.map((match) => ({
        ...match,
        score: getScoreTotals(bracketScores[match.id], roundCount),
      })),
      semifinals: [
        { ...computedBracket.semifinals[0], seedA: { seed: 0, name: sf1A }, seedB: { seed: 0, name: sf1B }, score: getScoreTotals(bracketScores.sf1, roundCount) },
        { ...computedBracket.semifinals[1], seedA: { seed: 0, name: sf2A }, seedB: { seed: 0, name: sf2B }, score: getScoreTotals(bracketScores.sf2, roundCount) },
      ],
      thirdPlace: { ...thirdPlaceTemplate, seedA: { seed: 0, name: thirdA }, seedB: { seed: 0, name: thirdB }, score: getScoreTotals(bracketScores.thirdPlace, roundCount) },
      final: { ...computedBracket.final, seedA: { seed: 0, name: finA }, seedB: { seed: 0, name: finB }, score: getScoreTotals(bracketScores.final, roundCount) },
    };
    currentBracketMatch = currentBracketMatchId
      ? [
        ...resolvedBracket.quarterfinals,
        ...resolvedBracket.semifinals,
        resolvedBracket.thirdPlace,
        resolvedBracket.final,
      ].find((match) => match.id === currentBracketMatchId) ?? null
      : null;
  }

  const phaseLabel = activePhase === 'phase1' ? 'Fase 1 · Lliga'
    : activePhase === 'phase2' ? 'Fase 2 · Repesca'
    : 'Fase 3 · Eliminatòries';
  const isPhase3View = activePhase === 'phase3';
  const showChampionCelebration = Boolean(champion) && celebratingChampion === champion;

  // SVG ring circumference r=18 → 2πr ≈ 113.1
  const CIRC = 113.1;

  return (
    <div className={styles.spectator}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topLogo}>
          <img className={styles.topLogoIcon} src={themeLogo} alt="AESS" />
          <span className={styles.topLogoBrand}>AESSBot</span>
        </div>
        <div className={styles.topPhase}>{phaseLabel}</div>
        <div className={styles.topRight}>
          {activePhase === 'phase1' && <span>{completedCount}/{result.battles.length} combats</span>}
          {activePhase === 'phase3' && champion && <span className={styles.topChampion}>🏆 {champion}</span>}
        </div>
      </div>

      {/* ── Timer strip ── */}
      <div className={[styles.timerStrip, isWarning ? styles.timerStripWarning : '', isFinished ? styles.timerStripFinished : ''].filter(Boolean).join(' ')}>
        <svg className={styles.timerRingSvg} viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="none" stroke="var(--subtle-fill)" strokeWidth="3" />
          <circle cx="20" cy="20" r="18" fill="none"
            stroke={isWarning || isFinished ? 'var(--accent-danger)' : 'var(--accent-secondary)'}
            strokeWidth="3"
            strokeDasharray={`${progress * CIRC} ${CIRC}`}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
          />
        </svg>
        <div className={[styles.timerTime, isWarning || isFinished ? styles.timerTimeWarn : ''].filter(Boolean).join(' ')}>
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
        <div className={styles.timerBarWrap}>
          <div className={styles.timerBar}
            style={{ width: `${progress * 100}%`, background: isWarning || isFinished ? 'var(--accent-danger)' : 'var(--accent-secondary)' }}
          />
        </div>
        <div className={styles.timerStatus}>
          {isFinished ? 'Temps esgotat' : isRunning ? 'En curs' : 'Aturat'}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className={`${styles.main} ${isPhase3View ? styles.mainPhase3 : ''}`}>

        {!isPhase3View && (
          <>
            {/* LEFT: battles / phase content */}
            <div className={styles.leftCol}>
              <div className={styles.colTitle}>
                {activePhase === 'phase1' && currentRound
                  ? `Jornada ${currentRound.number} de ${totalRounds}`
                  : activePhase === 'phase1'
                  ? 'Fase 1 completada'
                  : 'Repesca'}
              </div>

              {/* Phase 1 battles */}
              {activePhase === 'phase1' && currentRound && (
                <div className={styles.battleList}>
                  {currentRound.battles.map((battle) => {
                    const sc = battleScores[battle.id];
                    const done = isScoreComplete(sc, roundsToWin);
                    const totals = getScoreTotals(sc, roundCount);
                    const aWon = done && totals.teamA > totals.teamB;
                    const bWon = done && totals.teamB > totals.teamA;
                    return (
                      <div key={battle.id} className={`${styles.battleRow} ${done ? styles.battleRowDone : ''}`}>
                        <span className={`${styles.battleTeam} ${styles.battleTeamLeft} ${aWon ? styles.battleTeamWin : ''}`}>{battle.teamA}</span>
                        <span className={`${styles.battleScore} ${aWon ? styles.battleScoreWin : ''}`}>{totals.teamA}</span>
                        <span className={styles.battleVs}>vs</span>
                        <span className={`${styles.battleScore} ${bWon ? styles.battleScoreWin : ''}`}>{totals.teamB}</span>
                        <span className={`${styles.battleTeam} ${styles.battleTeamRight} ${bWon ? styles.battleTeamWin : ''}`}>{battle.teamB}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {activePhase === 'phase1' && !currentRound && (
                <div className={styles.doneMsg}>✓ Tots els combats completats</div>
              )}

              {/* Phase 2 repesca */}
              {activePhase === 'phase2' && (
                <div className={styles.battleList}>
                  {repescaTeams.map((team, i) => {
                    const qualified = filledRepescaWinners.includes(team);
                    return (
                      <div key={team} className={`${styles.battleRow} ${qualified ? styles.battleRowDone : ''}`}>
                        <span className={styles.repescaPos}>{directQualifiedCount + i + 1}</span>
                        <span className={styles.battleTeam} style={{ flex: 1 }}>{team}</span>
                        {qualified && <span className={styles.repescaQual}>✓ Classificat</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className={styles.divider} />

            {/* RIGHT: standings */}
            <div className={styles.rightCol}>
              <div className={styles.colTitle}>Classificació</div>
              <div className={styles.standingsList}>
                {displayStandings.map((row, i) => {
                  const isDirect = i < directQualifiedCount;
                  const isRepescaQualified = activePhase === 'phase2' && filledRepescaWinners.includes(row.team);
                  return (
                    <div
                      key={row.team}
                      className={[
                        styles.standRow,
                        isRepescaQualified
                          ? styles.standRowRepescaQualified
                          : isDirect
                          ? styles.standRowDirect
                          : styles.standRowRepesca,
                      ].filter(Boolean).join(' ')}
                    >
                      <span className={styles.standPos}>{i + 1}</span>
                      <span className={styles.standTeam}>{row.team}</span>
                      <span className={styles.standPf}>{row.pointsFor}pts</span>
                      <span className={styles.standPa}>{row.played}J</span>
                      <span className={styles.standBadge}>
                        {isRepescaQualified ? <span className={styles.badgeRepescaQualified}>R+</span> : isDirect ? <span className={styles.badgeDirect}>Q</span> : <span className={styles.badgeRepesca}>R</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className={styles.standLegend}>
                <span className={styles.legendDirect}>Q Classificat</span>
                <span className={styles.legendRepesca}>R Repesca</span>
                {activePhase === 'phase2' && <span className={styles.legendRepescaQualified}>R+ Via repesca</span>}
              </div>
            </div>
          </>
        )}

        {isPhase3View && (
          <div className={`${styles.phase3Board} ${showChampionCelebration ? styles.phase3BoardChampion : ''}`}>
            {showChampionCelebration && champion && (
              <div className={styles.championStage}>
                <div className={styles.confettiLayer} aria-hidden="true">
                  {Array.from({ length: 34 }, (_, index) => (
                    <span
                      key={index}
                      className={styles.confettiPiece}
                      style={{
                        left: `${(index * 29) % 100}%`,
                        animationDelay: `${(index % 12) * 0.16}s`,
                        animationDuration: `${2.4 + (index % 6) * 0.25}s`,
                      }}
                    />
                  ))}
                </div>
                <div className={styles.championCrown}>🏆</div>
                <div className={styles.championStageLabel}>Campió AESSBot</div>
                <div className={styles.championStageName}>{champion}</div>
              </div>
            )}

            {!showChampionCelebration && champion && (
              <div className={styles.championBanner}>
                <span className={styles.championBannerTrophy}>🏆</span>
                <div>
                  <div className={styles.championBannerLabel}>Campió AESSBot</div>
                  <div className={styles.championBannerName}>{champion}</div>
                </div>
              </div>
            )}

            {!showChampionCelebration && !champion && currentBracketMatch && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '0.45rem 1.25rem 0.25rem',
                flexShrink: 0,
              }}>
                <div style={{ textAlign: 'right', fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentBracketMatch.seedA.name}
                </div>
                <div style={{
                  minWidth: '7rem',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  color: 'var(--accent-warning)',
                }}>
                  {currentBracketMatch.score?.teamA ?? 0}-{currentBracketMatch.score?.teamB ?? 0}
                </div>
                <div style={{ textAlign: 'left', fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentBracketMatch.seedB.name}
                </div>
              </div>
            )}

            {!showChampionCelebration && resolvedBracket && (
              <div className={styles.bracketWrap}>
                <SpectatorBracketSVG bracket={resolvedBracket} currentMatchId={currentBracketMatchId} />
              </div>
            )}

            {!showChampionCelebration && !resolvedBracket && (
              <div className={styles.doneMsg}>
                {!allPhase1ResultsRegistered
                  ? 'Pendent de completar la fase 1'
                  : isRepescaRequired && !isRepescaComplete
                  ? 'Pendent de completar la repesca'
                  : !hasEnoughTeamsForQuarterfinals
                  ? 'No hi ha prou equips per generar el quadre'
                  : !state.phase3BracketPublished
                  ? 'Pendent de publicació dels encreuaments'
                  : 'Pendent de resultats'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bracket SVG (inline styles — no CSS module dependency) ────────

function SpectatorBracketSVG({ bracket, currentMatchId }: { bracket: ResolvedBracket; currentMatchId: string | null }) {
  const lineColor = 'var(--bracket-line)';
  const lw = 1.5;
  const leftC = [
    `M ${QF_LX + CW} ${QF1_CY} H ${JUNC_L}`, `M ${QF_LX + CW} ${QF2_CY} H ${JUNC_L}`,
    `M ${JUNC_L} ${QF1_CY} V ${QF2_CY}`,     `M ${JUNC_L} ${SF_CY} H ${SF_LX}`,
  ].join(' ');
  const rightC = [
    `M ${QF_RX} ${QF1_CY} H ${JUNC_R}`,      `M ${QF_RX} ${QF2_CY} H ${JUNC_R}`,
    `M ${JUNC_R} ${QF1_CY} V ${QF2_CY}`,     `M ${JUNC_R} ${SF_CY} H ${SF_RX + CW}`,
  ].join(' ');
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} aria-label="Quadre eliminatori">
      <text x={QF_LX + CW / 2} y={16} textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="2" fill="var(--bracket-side-label)">COSTAT A</text>
      <text x={FIN_X + CW / 2} y={16} textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="2" fill="var(--accent-primary)">FINAL</text>
      <text x={QF_RX + CW / 2} y={16} textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="2" fill="var(--bracket-side-label)">COSTAT B</text>
      <path d={leftC} stroke={lineColor} strokeWidth={lw} fill="none" />
      <path d={`M ${SF_LX + CW} ${SF_CY} H ${FIN_X}`} stroke={lineColor} strokeWidth={lw} fill="none" />
      <path d={`M ${FIN_X + CW} ${SF_CY} H ${SF_RX}`} stroke={lineColor} strokeWidth={lw} fill="none" />
      <path d={rightC} stroke={lineColor} strokeWidth={lw} fill="none" />
      <SpectatorSvgCard x={QF_LX}  y={QF1_Y} match={bracket.quarterfinals[0]} isCurrent={currentMatchId === 'qf1'} />
      <SpectatorSvgCard x={QF_LX}  y={QF2_Y} match={bracket.quarterfinals[1]} isCurrent={currentMatchId === 'qf2'} />
      <SpectatorSvgCard x={SF_LX}  y={SF_Y}  match={bracket.semifinals[0]} isCurrent={currentMatchId === 'sf1'} />
      <SpectatorSvgCard x={FIN_X}  y={SF_Y}  match={bracket.final} isFinal isCurrent={currentMatchId === 'final'} />
      <SpectatorSvgCard x={FIN_X}  y={THIRD_Y} match={bracket.thirdPlace} isThirdPlace isCurrent={currentMatchId === 'thirdPlace'} />
      <SpectatorSvgCard x={SF_RX}  y={SF_Y}  match={bracket.semifinals[1]} isCurrent={currentMatchId === 'sf2'} />
      <SpectatorSvgCard x={QF_RX}  y={QF1_Y} match={bracket.quarterfinals[2]} isCurrent={currentMatchId === 'qf3'} />
      <SpectatorSvgCard x={QF_RX}  y={QF2_Y} match={bracket.quarterfinals[3]} isCurrent={currentMatchId === 'qf4'} />
    </svg>
  );
}

function SpectatorSvgCard({
  x, y, match, isFinal = false, isThirdPlace = false, isCurrent = false,
}: {
  x: number; y: number; match: ResolvedMatch; isFinal?: boolean; isThirdPlace?: boolean; isCurrent?: boolean;
}) {
  const seedAResolved = !match.seedA.name.startsWith('Guanyador');
  const seedBResolved = !match.seedB.name.startsWith('Guanyador');
  const isPlaceholder = !seedAResolved || !seedBResolved;
  const hasScore = (match.score?.teamA ?? 0) > 0 || (match.score?.teamB ?? 0) > 0;
  const seedAWon = hasScore && (match.score?.teamA ?? 0) > (match.score?.teamB ?? 0);
  const seedBWon = hasScore && (match.score?.teamB ?? 0) > (match.score?.teamA ?? 0);
  return (
    <foreignObject x={x} y={y} width={CW} height={CH}>
      <div style={{
        width: '100%', height: '100%', boxSizing: 'border-box',
        background: isCurrent
          ? 'linear-gradient(135deg, rgba(232,133,74,0.18), rgba(74,158,237,0.08))'
          : isFinal ? 'rgba(232,133,74,0.07)' : isThirdPlace ? 'rgba(74,158,237,0.06)' : 'var(--bracket-card-bg)',
        border: `1px solid ${isCurrent ? 'rgba(240,192,64,0.85)' : isFinal ? 'rgba(232,133,74,0.4)' : isThirdPlace ? 'rgba(74,158,237,0.34)' : 'var(--bracket-card-border)'}`,
        borderStyle: isPlaceholder ? 'dashed' : 'solid',
        boxShadow: isCurrent ? '0 0 0 2px rgba(240,192,64,0.16), 0 0 28px rgba(232,133,74,0.32)' : 'none',
        borderRadius: '8px', padding: '8px 10px',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '6px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          lineHeight: 1,
          padding: '0 2px',
        }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isCurrent ? 'rgba(240,192,64,0.95)' : 'var(--text-muted)' }}>
            {match.label}
          </span>
          {hasScore && (
            <span style={{
              fontFamily: 'monospace',
              fontSize: '0.66rem',
              fontWeight: 800,
              color: isCurrent ? 'rgba(240,192,64,0.98)' : 'var(--bracket-score-text)',
              flexShrink: 0,
            }}>
              {match.score?.teamA ?? 0}-{match.score?.teamB ?? 0}
            </span>
          )}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          borderRadius: '6px',
          minHeight: '26px',
          padding: '4px 8px',
          background: seedAResolved ? 'var(--bracket-team-bg)' : 'var(--bracket-team-pending-bg)',
          border: seedAResolved ? `1px solid ${seedAWon ? 'var(--bracket-team-winner-border)' : 'var(--bracket-team-border)'}` : '1px solid transparent',
          filter: seedBWon ? 'saturate(0.65)' : 'none',
        }}>
          {match.seedA.seed > 0 && <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 700, color: seedBWon ? 'var(--text-muted)' : 'var(--accent-primary)', flexShrink: 0, minWidth: '2rem', textAlign: 'left' }}>#{match.seedA.seed}</span>}
          <span style={{ fontSize: '0.78rem', fontWeight: seedAResolved ? 700 : 500, color: seedBWon ? 'var(--text-muted)' : seedAResolved ? 'var(--bracket-team-resolved-text)' : 'var(--text-muted)', fontStyle: seedAResolved ? 'normal' : 'italic', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.seedA.name}</span>
        </div>
        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 2px' }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          borderRadius: '6px',
          minHeight: '26px',
          padding: '4px 8px',
          background: seedBResolved ? 'var(--bracket-team-bg)' : 'var(--bracket-team-pending-bg)',
          border: seedBResolved ? `1px solid ${seedBWon ? 'var(--bracket-team-winner-border)' : 'var(--bracket-team-border)'}` : '1px solid transparent',
          filter: seedAWon ? 'saturate(0.65)' : 'none',
        }}>
          {match.seedB.seed > 0 && <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', fontWeight: 700, color: seedAWon ? 'var(--text-muted)' : 'var(--accent-primary)', flexShrink: 0, minWidth: '2rem', textAlign: 'left' }}>#{match.seedB.seed}</span>}
          <span style={{ fontSize: '0.78rem', fontWeight: seedBResolved ? 700 : 500, color: seedAWon ? 'var(--text-muted)' : seedBResolved ? 'var(--bracket-team-resolved-text)' : 'var(--text-muted)', fontStyle: seedBResolved ? 'normal' : 'italic', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.seedB.name}</span>
        </div>
      </div>
    </foreignObject>
  );
}
