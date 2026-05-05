import type { Bracket } from '../logic/bracketGenerator';
import styles from './Phase3Results.module.css';
import { copyToClipboard, formatBracketAsText } from '../logic/exportUtils';
import { formatDuration, BATTLE_DURATION_MIN } from '../logic/battleGenerator';
import { useState } from 'react';
import {
  ROUND_COUNT,
  getScoreTotals,
  getWinner,
  updateRoundWinner,
  type MatchScore,
} from '../logic/scoreUtils';
import {
  CW, CH, QF_LX, SF_LX, FIN_X, SF_RX, QF_RX,
  QF1_Y, QF2_Y, QF1_CY, QF2_CY, SF_CY, SF_Y, SVG_W, SVG_H, JUNC_L, JUNC_R,
  type ResolvedMatch, type ResolvedBracket,
} from '../logic/bracketSvgConstants';

interface Props {
  bracket: Bracket;
  finalistTeams: string[];
  directQualifiedCount: number;
  repescaCount: number;
  bracketScores: BracketScores;
  onBracketScoreChange: (matchId: string, score: MatchScore) => void;
}

type BracketScores = Record<string, MatchScore>;

export default function Phase3Results({
  bracket, finalistTeams, directQualifiedCount, repescaCount, bracketScores, onBracketScoreChange,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedSeeds, setCopiedSeeds] = useState(false);

  const TOTAL_BRACKET_BATTLES = 7;
  const estimatedMinutes = TOTAL_BRACKET_BATTLES * BATTLE_DURATION_MIN;

  // Resolve progressive bracket state
  const qf = bracket.quarterfinals;
  const qf1A = qf[0].seedA.name, qf1B = qf[0].seedB.name;
  const qf2A = qf[1].seedA.name, qf2B = qf[1].seedB.name;
  const qf3A = qf[2].seedA.name, qf3B = qf[2].seedB.name;
  const qf4A = qf[3].seedA.name, qf4B = qf[3].seedB.name;

  const qf1W = getWinner(qf1A, qf1B, bracketScores['qf1']);
  const qf2W = getWinner(qf2A, qf2B, bracketScores['qf2']);
  const qf3W = getWinner(qf3A, qf3B, bracketScores['qf3']);
  const qf4W = getWinner(qf4A, qf4B, bracketScores['qf4']);

  const sf1A = qf1W ?? 'Guanyador QF 1';
  const sf1B = qf2W ?? 'Guanyador QF 2';
  const sf2A = qf3W ?? 'Guanyador QF 3';
  const sf2B = qf4W ?? 'Guanyador QF 4';
  const sf1Locked = !qf1W || !qf2W;
  const sf2Locked = !qf3W || !qf4W;

  const sf1W = sf1Locked ? null : getWinner(sf1A, sf1B, bracketScores['sf1']);
  const sf2W = sf2Locked ? null : getWinner(sf2A, sf2B, bracketScores['sf2']);

  const finA = sf1W ?? 'Guanyador SF-A';
  const finB = sf2W ?? 'Guanyador SF-B';
  const finalLocked = !sf1W || !sf2W;

  const champion = finalLocked ? null : getWinner(finA, finB, bracketScores['final']);

  async function handleCopy() {
    const text = formatBracketAsText(bracket);
    const ok = await copyToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  async function handleCopySeeds() {
    const text = finalistTeams.slice(0, 8).map((name, i) => `#${i + 1} ${name}`).join('\n');
    const ok = await copyToClipboard(text);
    if (ok) { setCopiedSeeds(true); setTimeout(() => setCopiedSeeds(false), 2000); }
  }

  // Resolved bracket for SVG (dynamic team names)
  const resolvedBracket = {
    quarterfinals: qf.map((match) => ({
      ...match,
      score: getScoreTotals(bracketScores[match.id]),
    })),
    semifinals: [
      { ...bracket.semifinals[0], seedA: { seed: 0, name: sf1A }, seedB: { seed: 0, name: sf1B }, score: getScoreTotals(bracketScores.sf1) },
      { ...bracket.semifinals[1], seedA: { seed: 0, name: sf2A }, seedB: { seed: 0, name: sf2B }, score: getScoreTotals(bracketScores.sf2) },
    ],
    final: { ...bracket.final, seedA: { seed: 0, name: finA }, seedB: { seed: 0, name: finB }, score: getScoreTotals(bracketScores.final) },
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className="section-tag">Fase 3</div>
          <h2 className={styles.title}>Eliminatòries</h2>
          <p className={styles.subtitle}>
            Quadre d&apos;eliminatòria generat per sorteig aleatori
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.timeCard}>
            <span className={styles.timeIcon}>⏱</span>
            <div>
              <div className={styles.timeValue}>{formatDuration(estimatedMinutes)}</div>
              <div className={styles.timeLabel}>{TOTAL_BRACKET_BATTLES} combats · 1 simultani</div>
            </div>
          </div>
          <button id="btn-copy-bracket" className="btn btn--secondary" onClick={handleCopy}>
            {copied ? '✓ Copiat!' : '📋 Copiar quadre'}
          </button>
        </div>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className={styles.championBanner}>
          <span className={styles.championTrophy}>🏆</span>
          <div>
            <div className={styles.championLabel}>Campió AESSBot</div>
            <div className={styles.championName}>{champion}</div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{finalistTeams[0]}</span>
          <span className={styles.summaryLabel}>1r classificat</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{directQualifiedCount}</span>
          <span className={styles.summaryLabel}>classificats directes</span>
        </div>
        {repescaCount > 0 && (
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{repescaCount}</span>
            <span className={styles.summaryLabel}>via repesca</span>
          </div>
        )}
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{formatDuration(estimatedMinutes)}</span>
          <span className={styles.summaryLabel}>durada estimada fase 3</span>
        </div>
      </div>

      {/* Seeding legend */}
      <div className={styles.seedLegendSection}>
        <div className={styles.seedLegendHeader}>
          <span className={styles.seedLegendTitle}>Classificació</span>
          <button
            className="btn btn--ghost"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
            onClick={handleCopySeeds}
          >
            {copiedSeeds ? '✓ Copiat!' : '📋 Copiar classificació'}
          </button>
        </div>
        <div className={styles.seedLegend}>
          {finalistTeams.slice(0, 8).map((name, i) => (
            <div key={name} className={styles.seedItem}>
              <span className={styles.seedNum}>#{i + 1}</span>
              <span className={styles.seedName}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Bracket */}
      <div className={styles.bracketWrapper}>
        <BracketSVG bracket={resolvedBracket} />
      </div>

      {/* Score registration */}
      <div className={styles.scoresSection}>
        <div className="section-tag">Resultats</div>

        <div className={styles.scoresGroup}>
          <div className={styles.scoresGroupLabel}>Quarts de final</div>
          <div className={styles.scoresGroupMatches}>
            {([
              { id: 'qf1', label: 'QF 1', teamA: qf1A, teamB: qf1B, seedA: qf[0].seedA.seed, seedB: qf[0].seedB.seed },
              { id: 'qf2', label: 'QF 2', teamA: qf2A, teamB: qf2B, seedA: qf[1].seedA.seed, seedB: qf[1].seedB.seed },
              { id: 'qf3', label: 'QF 3', teamA: qf3A, teamB: qf3B, seedA: qf[2].seedA.seed, seedB: qf[2].seedB.seed },
              { id: 'qf4', label: 'QF 4', teamA: qf4A, teamB: qf4B, seedA: qf[3].seedA.seed, seedB: qf[3].seedB.seed },
            ] as const).map((m) => (
              <BracketMatchRow
                key={m.id}
                matchId={m.id}
                label={m.label}
                teamA={m.teamA}
                teamB={m.teamB}
                seedA={m.seedA}
                seedB={m.seedB}
                score={bracketScores[m.id]}
                onScoreChange={onBracketScoreChange}
              />
            ))}
          </div>
        </div>

        <div className={styles.scoresGroup}>
          <div className={styles.scoresGroupLabel}>Semifinals</div>
          <div className={styles.scoresGroupMatches}>
            <BracketMatchRow
              matchId="sf1" label="SF-A"
              teamA={sf1A} teamB={sf1B}
              score={bracketScores['sf1']}
              onScoreChange={onBracketScoreChange}
              locked={sf1Locked}
            />
            <BracketMatchRow
              matchId="sf2" label="SF-B"
              teamA={sf2A} teamB={sf2B}
              score={bracketScores['sf2']}
              onScoreChange={onBracketScoreChange}
              locked={sf2Locked}
            />
          </div>
        </div>

        <div className={styles.scoresGroup}>
          <div className={styles.scoresGroupLabel}>Final</div>
          <div className={styles.scoresGroupMatches}>
            <BracketMatchRow
              matchId="final" label="Final"
              teamA={finA} teamB={finB}
              score={bracketScores['final']}
              onScoreChange={onBracketScoreChange}
              locked={finalLocked}
              isFinal
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SVG Bracket ────────────────────────────────────────────────

function BracketSVG({ bracket }: { bracket: ResolvedBracket }) {
  const lineColor = 'var(--bracket-line)';
  const lineW = 1.5;
  const leftC = [
    `M ${QF_LX + CW} ${QF1_CY} H ${JUNC_L}`, `M ${QF_LX + CW} ${QF2_CY} H ${JUNC_L}`,
    `M ${JUNC_L} ${QF1_CY} V ${QF2_CY}`, `M ${JUNC_L} ${SF_CY} H ${SF_LX}`,
  ].join(' ');
  const rightC = [
    `M ${QF_RX} ${QF1_CY} H ${JUNC_R}`, `M ${QF_RX} ${QF2_CY} H ${JUNC_R}`,
    `M ${JUNC_R} ${QF1_CY} V ${QF2_CY}`, `M ${JUNC_R} ${SF_CY} H ${SF_RX + CW}`,
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} aria-label="Quadre eliminatori">
      <text x={QF_LX + CW / 2} y={16} textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="2" fill="var(--bracket-side-label)">COSTAT A</text>
      <text x={FIN_X + CW / 2} y={16} textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="2" fill="var(--accent-primary)">FINAL</text>
      <text x={QF_RX + CW / 2} y={16} textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="2" fill="var(--bracket-side-label)">COSTAT B</text>
      <path d={leftC} stroke={lineColor} strokeWidth={lineW} fill="none" />
      <path d={`M ${SF_LX + CW} ${SF_CY} H ${FIN_X}`} stroke={lineColor} strokeWidth={lineW} fill="none" />
      <path d={`M ${FIN_X + CW} ${SF_CY} H ${SF_RX}`} stroke={lineColor} strokeWidth={lineW} fill="none" />
      <path d={rightC} stroke={lineColor} strokeWidth={lineW} fill="none" />
      <SvgMatchCard x={QF_LX} y={QF1_Y} match={bracket.quarterfinals[0]} />
      <SvgMatchCard x={QF_LX} y={QF2_Y} match={bracket.quarterfinals[1]} />
      <SvgMatchCard x={SF_LX} y={SF_Y} match={bracket.semifinals[0]} />
      <SvgMatchCard x={FIN_X} y={SF_Y} match={bracket.final} isFinal />
      <SvgMatchCard x={SF_RX} y={SF_Y} match={bracket.semifinals[1]} />
      <SvgMatchCard x={QF_RX} y={QF1_Y} match={bracket.quarterfinals[2]} />
      <SvgMatchCard x={QF_RX} y={QF2_Y} match={bracket.quarterfinals[3]} />
    </svg>
  );
}

function SvgMatchCard({ x, y, match, isFinal = false }: { x: number; y: number; match: ResolvedMatch; isFinal?: boolean }) {
  const seedAResolved = !match.seedA.name.startsWith('Guanyador');
  const seedBResolved = !match.seedB.name.startsWith('Guanyador');
  const isPlaceholder = !seedAResolved || !seedBResolved;
  const hasScore = (match.score?.teamA ?? 0) > 0 || (match.score?.teamB ?? 0) > 0;
  const seedAWon = hasScore && (match.score?.teamA ?? 0) > (match.score?.teamB ?? 0);
  const seedBWon = hasScore && (match.score?.teamB ?? 0) > (match.score?.teamA ?? 0);
  return (
    <foreignObject x={x} y={y} width={CW} height={CH}>
      <div className={[styles.svgCard, isPlaceholder ? styles.svgCardPlaceholder : '', isFinal ? styles.svgCardFinal : ''].filter(Boolean).join(' ')}>
        <div className={styles.svgCardHeader}>
          <span className={styles.svgCardLabel}>{match.label}</span>
          {hasScore && <span className={styles.svgCardScore}>{match.score?.teamA ?? 0}-{match.score?.teamB ?? 0}</span>}
        </div>
        <div className={`${styles.svgCardTeam} ${seedAResolved ? styles.svgCardTeamResolved : styles.svgCardTeamPending} ${seedAWon ? styles.svgCardTeamWinner : ''} ${seedBWon ? styles.svgCardTeamLoser : ''}`}>
          {match.seedA.seed > 0 && <span className={styles.svgSeedNum}>#{match.seedA.seed}</span>}
          <span className={styles.svgTeamName}>{match.seedA.name}</span>
        </div>
        <div className={styles.svgDivider} />
        <div className={`${styles.svgCardTeam} ${seedBResolved ? styles.svgCardTeamResolved : styles.svgCardTeamPending} ${seedBWon ? styles.svgCardTeamWinner : ''} ${seedAWon ? styles.svgCardTeamLoser : ''}`}>
          {match.seedB.seed > 0 && <span className={styles.svgSeedNum}>#{match.seedB.seed}</span>}
          <span className={styles.svgTeamName}>{match.seedB.name}</span>
        </div>
      </div>
    </foreignObject>
  );
}

// ── Score row ────────────────────────────────────────────────

function BracketMatchRow({
  matchId, label, teamA, teamB, seedA, seedB, score, onScoreChange, locked = false, isFinal = false,
}: {
  matchId: string; label: string;
  teamA: string; teamB: string;
  seedA?: number; seedB?: number;
  score?: MatchScore;
  onScoreChange: (id: string, score: MatchScore) => void;
  locked?: boolean;
  isFinal?: boolean;
}) {
  const [focusedRound, setFocusedRound] = useState<number | null>(null);
  const totals = getScoreTotals(score);
  const aWon = totals.teamA > totals.teamB;
  const bWon = totals.teamB > totals.teamA;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (focusedRound === null || locked) return;
    if (e.key.toLowerCase() === 'a') {
      e.preventDefault();
      onScoreChange(matchId, updateRoundWinner(score, focusedRound, 'teamA'));
    }
    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      onScoreChange(matchId, updateRoundWinner(score, focusedRound, 'teamB'));
    }
  }

  return (
    <div className={[styles.matchRow, locked ? styles.matchRowLocked : '', isFinal ? styles.matchRowFinal : ''].filter(Boolean).join(' ')} onKeyDown={handleKeyDown}>
      <span className={styles.matchRowLabel}>{label}</span>

      <div className={styles.matchRowTeams}>
        {/* Team A */}
        <div
          className={`${styles.matchRowTeam} ${aWon ? styles.matchRowTeamWinner : ''}`}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusedRound(null); }}
        >
          {seedA != null && seedA > 0 && <span className={styles.matchRowSeed}>#{seedA}</span>}
          <span className={styles.matchRowName}>{teamA}</span>
          {!locked && (
            <div className={styles.matchRowPills}>
              {Array.from({ length: ROUND_COUNT }, (_, roundIndex) => (
                <button key={`teamA-${roundIndex}`} type="button"
                  className={`${styles.pill} ${score?.rounds?.[roundIndex] === 'teamA' ? styles.pillSelected : ''}`}
                  onFocus={() => setFocusedRound(roundIndex)}
                  onClick={() => onScoreChange(matchId, updateRoundWinner(score, roundIndex, 'teamA'))}
                  aria-pressed={score?.rounds?.[roundIndex] === 'teamA'}
                >R{roundIndex + 1}</button>
              ))}
            </div>
          )}
        </div>

        <span className={styles.matchRowVs}>{totals.teamA}-{totals.teamB}</span>

        {/* Team B */}
        <div
          className={`${styles.matchRowTeam} ${bWon ? styles.matchRowTeamWinner : ''}`}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusedRound(null); }}
        >
          {seedB != null && seedB > 0 && <span className={styles.matchRowSeed}>#{seedB}</span>}
          <span className={styles.matchRowName}>{teamB}</span>
          {!locked && (
            <div className={styles.matchRowPills}>
              {Array.from({ length: ROUND_COUNT }, (_, roundIndex) => (
                <button key={`teamB-${roundIndex}`} type="button"
                  className={`${styles.pill} ${score?.rounds?.[roundIndex] === 'teamB' ? styles.pillSelected : ''}`}
                  onFocus={() => setFocusedRound(roundIndex)}
                  onClick={() => onScoreChange(matchId, updateRoundWinner(score, roundIndex, 'teamB'))}
                  aria-pressed={score?.rounds?.[roundIndex] === 'teamB'}
                >R{roundIndex + 1}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {locked && <span className={styles.matchRowPending}>Pendent de fase anterior</span>}
    </div>
  );
}
