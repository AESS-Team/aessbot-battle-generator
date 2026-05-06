import { useState } from 'react';
import type { Round } from '../logic/battleGenerator';
import BattleTimer from './BattleTimer';
import { calcBattleDuration, calcPhase1Duration, formatDuration } from '../logic/battleGenerator';
import { copyToClipboard, formatBattlesAsText, downloadPhase1BattlesAsExcel } from '../logic/exportUtils';
import type { Battle } from '../logic/battleGenerator';
import type { TimerState } from '../logic/timerUtils';
import {
  getRoundCount,
  getScoreTotals,
  isScoreComplete,
  updateRoundWinner,
  type MatchScore,
} from '../logic/scoreUtils';
import { type StandingRow } from '../logic/standingsUtils';
import styles from './Phase1Results.module.css';

interface Props {
  rounds: Round[];
  battles: Battle[];
  simultaneousBattles: number;
  roundsToWin: number;
  onRegenerate: () => void;
  onSimulateResults: () => void;
  battleScores: Record<string, MatchScore>;
  onBattleScoreChange: (battleId: string, score: MatchScore) => void;
  standings: StandingRow[];
  completedBattleCount: number;
  directQualifiedCount: number;
  repescaSlots: number;
  timerState: TimerState;
  onTimerChange: (state: TimerState) => void;
}

/**
 * Displays Phase 1 battles organized by rounds (jornades).
 * Each round shows battles where every team appears at most once.
 * Includes time estimation based on rounds and simultaneous battle count.
 *
 * @param rounds - Battles grouped into rounds.
 * @param battles - Flat battle list (for export).
 * @param simultaneousBattles - Number of concurrent battles per time slot.
 * @param onRegenerate - Callback to re-shuffle with new randomization.
 */
export default function Phase1Results({
  rounds,
  battles,
  simultaneousBattles,
  roundsToWin,
  onRegenerate,
  onSimulateResults,
  battleScores,
  onBattleScoreChange,
  standings,
  completedBattleCount,
  directQualifiedCount,
  repescaSlots,
  timerState,
  onTimerChange,
}: Props) {
  const [viewMode, setViewMode] = useState<'rounds' | 'teams' | 'standings'>('rounds');
  const [copied, setCopied] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(
    new Set([1]) // first round open by default
  );
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(
    new Set(teamSchedulesSeed(rounds))
  );

  const roundCount = getRoundCount(roundsToWin);
  const battleDuration = calcBattleDuration(roundsToWin);
  const estimatedMinutes = calcPhase1Duration(rounds, simultaneousBattles, roundsToWin);
  const teamSchedules = buildTeamSchedules(rounds);

  const currentRoundNum = rounds.find(
    (r) => r.battles.some((b) => !isScoreComplete(battleScores[b.id], roundsToWin))
  )?.number ?? null;

  function toggleRound(num: number) {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedRounds(new Set(rounds.map((r) => r.number)));
  }

  function collapseAll() {
    setExpandedRounds(new Set());
  }

  function toggleTeam(team: string) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) {
        next.delete(team);
      } else {
        next.add(team);
      }
      return next;
    });
  }

  async function handleCopy() {
    const text = formatBattlesAsText(battles);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownload() {
    downloadPhase1BattlesAsExcel(rounds, battleScores, roundsToWin);
  }

  return (
    <div className={styles.section}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="section-tag">Fase 1</div>
          <h2 className={styles.title}>Lliga</h2>
          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <span className={styles.metaNum}>{rounds.length}</span>
              jornada{rounds.length !== 1 ? 's' : ''}
            </span>
            <span className={styles.metaDot}>·</span>
            <span className={styles.metaItem}>
              <span className={styles.metaNum}>{battles.length}</span>
              combats
            </span>
            <span className={styles.metaDot}>·</span>
            <span className={styles.metaItem}>
              <span className={styles.metaNum}>{completedBattleCount}</span>
              resultats registrats
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <BattleTimer timerState={timerState} onTimerChange={onTimerChange} />
          <button
            id="btn-regenerate"
            className="btn btn--secondary"
            onClick={onRegenerate}
            title="Regenerar amb nova aleatorietat"
          >
            🔀 Regenerar
          </button>
          <button
            id="btn-copy-battles"
            className="btn btn--secondary"
            onClick={handleCopy}
          >
            {copied ? '✓ Copiat!' : '📋 Copiar'}
          </button>
          <button
            id="btn-simulate-results"
            className="btn btn--secondary"
            onClick={onSimulateResults}
            title="Omplir automàticament tots els resultats de la fase 1"
          >
            🎲 Simular resultats
          </button>
          <button
            id="btn-download-battles"
            className="btn btn--secondary"
            onClick={handleDownload}
            title="Exportar combats en Excel"
          >
            ⬇ Excel
          </button>
        </div>
      </div>

      {/* Time estimation */}
      <div className={styles.timeEstimate}>
        <div className={styles.timeCard}>
          <span className={styles.timeIcon}>⏱</span>
          <div className={styles.timeInfo}>
            <span className={styles.timeValue}>{formatDuration(estimatedMinutes)}</span>
            <span className={styles.timeLabel}>durada estimada Fase 1</span>
          </div>
        </div>
        <div className={styles.timeDetails}>
          <span>{rounds.length} jornades</span>
          <span className={styles.timeSep}>×</span>
          <span>~{Math.ceil((rounds[0]?.battles.length ?? 1) / simultaneousBattles) * battleDuration} min/jornada ({roundCount} rondes d'1 min)</span>
          <span className={styles.timeSep}>({simultaneousBattles} combat{simultaneousBattles > 1 ? 's' : ''} simultani{simultaneousBattles > 1 ? 's' : ''})</span>
        </div>
      </div>

      <div className={styles.progressBox}>
        <div className={styles.progressHeader}>
          <div>
            <div className={styles.progressTitle}>Resultats de la Fase 1</div>
            <div className={styles.progressSubtitle}>
              Cal completar tots els combats per calcular classificació, repesca i eliminatòries.
            </div>
          </div>
          <div className={styles.progressCount}>
            <span className={styles.progressCountNum}>{completedBattleCount}</span>
            <span className={styles.progressCountSep}>/</span>
            <span>{battles.length}</span>
          </div>
        </div>
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: battles.length > 0 ? `${(completedBattleCount / battles.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Round controls */}
      <div className={styles.roundControls}>
        <div className={styles.viewTabs} role="tablist" aria-label="Vista de la fase 1">
          <button
            type="button"
            className={`${styles.viewTab} ${viewMode === 'rounds' ? styles.viewTabActive : ''}`}
            onClick={() => setViewMode('rounds')}
            aria-pressed={viewMode === 'rounds'}
          >
            Per jornades
          </button>
          <button
            type="button"
            className={`${styles.viewTab} ${viewMode === 'teams' ? styles.viewTabActive : ''}`}
            onClick={() => setViewMode('teams')}
            aria-pressed={viewMode === 'teams'}
          >
            Per equips
          </button>
          <button
            type="button"
            className={`${styles.viewTab} ${viewMode === 'standings' ? styles.viewTabActive : ''}`}
            onClick={() => setViewMode('standings')}
            aria-pressed={viewMode === 'standings'}
          >
            Classificació
          </button>
        </div>
        {viewMode === 'rounds' && (
          <div className={styles.roundControlBtns}>
            <span className={styles.roundCount}>{rounds.length} jornades</span>
            <button className="btn btn--ghost" style={{ fontSize: '0.75rem' }} onClick={expandAll}>
              Expandir tot
            </button>
            <button className="btn btn--ghost" style={{ fontSize: '0.75rem' }} onClick={collapseAll}>
              Plegar tot
            </button>
          </div>
        )}
      </div>

      {viewMode === 'rounds' ? (
        <div className={styles.roundsList}>
          {rounds.map((round) => {
            const isOpen = expandedRounds.has(round.number);
            const isCurrent = currentRoundNum === round.number;
            const isCompleted = round.battles.every((b) => isScoreComplete(battleScores[b.id], roundsToWin));
            return (
              <div
                key={round.number}
                className={[
                  styles.roundBlock,
                  'animate-fade-in-up',
                  isCurrent ? styles.roundBlockCurrent : '',
                  isCompleted ? styles.roundBlockCompleted : '',
                ].filter(Boolean).join(' ')}
                style={{ animationDelay: `${Math.min((round.number - 1) * 40, 400)}ms` }}
              >
                <button
                  id={`round-toggle-${round.number}`}
                  className={styles.roundHeader}
                  onClick={() => toggleRound(round.number)}
                  aria-expanded={isOpen}
                >
                  <div className={styles.roundTitleGroup}>
                    <span className={styles.roundNum}>Jornada {round.number}</span>
                    <span className={styles.roundBattleCount}>
                      {round.battles.length} combat{round.battles.length !== 1 ? 's' : ''}
                    </span>
                    {isCurrent && <span className={styles.roundCurrentBadge}>Ara</span>}
                    {isCompleted && <span className={styles.roundDoneBadge}>✓</span>}
                  </div>
                  <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div className={styles.roundBattles}>
                    {round.battles.map((battle, idx) => (
                      <div
                        key={battle.id}
                        className={styles.battleRow}
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className={styles.battleInfo}>
                          <span className={styles.battleNum}>{idx + 1}</span>
                          <span className={styles.battleMatchup}>{battle.teamA} - {battle.teamB}</span>
                        </div>
                        <ScoreInputs
                          battle={battle}
                          roundCount={roundCount}
                          score={battleScores[battle.id]}
                          onScoreChange={onBattleScoreChange}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === 'teams' ? (
        <div className={styles.teamScheduleListView}>
          {teamSchedules.map((teamSchedule, idx) => (
            <div
              key={teamSchedule.team}
              className={`${styles.teamScheduleCard} animate-fade-in-up`}
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <button
                type="button"
                className={styles.teamScheduleHeader}
                onClick={() => toggleTeam(teamSchedule.team)}
                aria-expanded={expandedTeams.has(teamSchedule.team)}
              >
                <div className={styles.teamScheduleHeaderInfo}>
                  <h3 className={styles.teamScheduleName}>{teamSchedule.team}</h3>
                  <span className={styles.teamScheduleMeta}>
                    {teamSchedule.matchups.length} jornada{teamSchedule.matchups.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className={`${styles.chevron} ${expandedTeams.has(teamSchedule.team) ? styles.chevronOpen : ''}`}>
                  ›
                </span>
              </button>
              {expandedTeams.has(teamSchedule.team) && (
                <div className={styles.teamScheduleList}>
                  {teamSchedule.matchups.map((matchup, matchupIndex) => (
                    <div key={`${teamSchedule.team}-${matchup.round}`} className={styles.battleRow}>
                      <div className={styles.battleInfo}>
                        <span className={styles.battleNum}>{matchupIndex + 1}</span>
                        <span className={styles.battleMatchup}>J{matchup.round} · {teamSchedule.team} - {matchup.opponent}</span>
                      </div>
                      <ScoreInputs
                        battle={{
                          id: matchup.battleId,
                          teamA: matchup.originalTeamA,
                          teamB: matchup.originalTeamB,
                          repeated: false,
                        }}
                        displayTeamA={teamSchedule.team}
                        displayTeamB={matchup.opponent}
                        roundCount={roundCount}
                        score={battleScores[matchup.battleId]}
                        onScoreChange={onBattleScoreChange}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.standingsCard}>
          <div className={styles.standingsHeader}>
            <h3 className={styles.standingsTitle}>Classificació provisional</h3>
            <span className={styles.standingsHint}>Actualització en temps real · {repescaSlots} places en joc a repesca</span>
          </div>
          <div className={styles.standingsLegend}>
            <span className={`${styles.legendPill} ${styles.legendQualified}`}>Classificats directes</span>
            <span className={`${styles.legendPill} ${styles.legendRepesca}`}>Repesca</span>
          </div>
          <div className={styles.standingsList}>
            {standings.map((row, index) => {
              const isDirect = index < directQualifiedCount;
              const isRepesca = index >= directQualifiedCount;
              return (
                <div
                  key={row.team}
                  className={`${styles.standingsRow} ${isDirect ? styles.standingsRowQualified : ''} ${isRepesca ? styles.standingsRowRepesca : ''}`}
                >
                  <span className={styles.standingsPos}>{index + 1}</span>
                  <span className={styles.standingsTeam}>{row.team}</span>
                  <div className={styles.standingsStats}>
                    <span className={styles.pointsBadge}>{row.pointsFor} pts</span>
                    <span className={styles.playedBadge}>{row.played} J</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreInputs({
  battle,
  displayTeamA,
  displayTeamB,
  roundCount,
  score,
  onScoreChange,
}: {
  battle: Battle;
  displayTeamA?: string;
  displayTeamB?: string;
  roundCount: number;
  score?: MatchScore;
  onScoreChange: (battleId: string, score: MatchScore) => void;
}) {
  const [focusedRound, setFocusedRound] = useState<number | null>(null);
  const totals = getScoreTotals(score, roundCount);
  const visibleTeamA = displayTeamA ?? battle.teamA;
  const visibleTeamB = displayTeamB ?? battle.teamB;
  const visibleTeamASide = visibleTeamA === battle.teamB ? 'teamB' : 'teamA';
  const visibleTeamBSide = visibleTeamB === battle.teamA ? 'teamA' : 'teamB';
  const visibleTotals = {
    teamA: visibleTeamASide === 'teamA' ? totals.teamA : totals.teamB,
    teamB: visibleTeamBSide === 'teamB' ? totals.teamB : totals.teamA,
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (focusedRound === null) return;
    if (e.key.toLowerCase() === 'a') {
      e.preventDefault();
      onScoreChange(battle.id, updateRoundWinner(score, focusedRound, visibleTeamASide, roundCount));
    }
    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      onScoreChange(battle.id, updateRoundWinner(score, focusedRound, visibleTeamBSide, roundCount));
    }
  }

  return (
    <div className={styles.scoreEditor} onKeyDown={handleKeyDown}>
      <div
        className={styles.teamScoreGroup}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusedRound(null); }}
      >
        <span className={styles.scoreLabel}>{visibleTeamA}</span>
        <div className={styles.scorePills}>
          {Array.from({ length: roundCount }, (_, roundIndex) => (
            <button
              key={`teamA-${roundIndex}`}
              type="button"
              className={`${styles.scorePill} ${score?.rounds?.[roundIndex] === visibleTeamASide ? styles.scorePillSelected : ''}`}
              onFocus={() => setFocusedRound(roundIndex)}
              onClick={() => onScoreChange(battle.id, updateRoundWinner(score, roundIndex, visibleTeamASide, roundCount))}
              aria-pressed={score?.rounds?.[roundIndex] === visibleTeamASide}
              title={`Ronda ${roundIndex + 1}`}
            >
              R{roundIndex + 1}
            </button>
          ))}
        </div>
      </div>
      <span className={styles.scoreDivider}>{visibleTotals.teamA}—{visibleTotals.teamB}</span>
      <div
        className={styles.teamScoreGroup}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusedRound(null); }}
      >
        <span className={styles.scoreLabel}>{visibleTeamB}</span>
        <div className={styles.scorePills}>
          {Array.from({ length: roundCount }, (_, roundIndex) => (
            <button
              key={`teamB-${roundIndex}`}
              type="button"
              className={`${styles.scorePill} ${score?.rounds?.[roundIndex] === visibleTeamBSide ? styles.scorePillSelected : ''}`}
              onFocus={() => setFocusedRound(roundIndex)}
              onClick={() => onScoreChange(battle.id, updateRoundWinner(score, roundIndex, visibleTeamBSide, roundCount))}
              aria-pressed={score?.rounds?.[roundIndex] === visibleTeamBSide}
              title={`Ronda ${roundIndex + 1}`}
            >
              R{roundIndex + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildTeamSchedules(rounds: Round[]) {
  const scheduleMap = new Map<string, Array<{
    round: number;
    opponent: string;
    battleId: string;
    originalTeamA: string;
    originalTeamB: string;
  }>>();

  for (const round of rounds) {
    for (const battle of round.battles) {
      const teamASchedule = scheduleMap.get(battle.teamA) ?? [];
      teamASchedule.push({
        round: round.number,
        opponent: battle.teamB,
        battleId: battle.id,
        originalTeamA: battle.teamA,
        originalTeamB: battle.teamB,
      });
      scheduleMap.set(battle.teamA, teamASchedule);

      const teamBSchedule = scheduleMap.get(battle.teamB) ?? [];
      teamBSchedule.push({
        round: round.number,
        opponent: battle.teamA,
        battleId: battle.id,
        originalTeamA: battle.teamA,
        originalTeamB: battle.teamB,
      });
      scheduleMap.set(battle.teamB, teamBSchedule);
    }
  }

  return [...scheduleMap.entries()]
    .map(([team, matchups]) => ({
      team,
      matchups: matchups.sort((a, b) => a.round - b.round),
    }))
    .sort((a, b) => a.team.localeCompare(b.team));
}

function teamSchedulesSeed(rounds: Round[]) {
  const teams = new Set<string>();
  for (const round of rounds) {
    for (const battle of round.battles) {
      teams.add(battle.teamA);
      teams.add(battle.teamB);
    }
  }
  return [...teams];
}
