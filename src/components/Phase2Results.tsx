import { calcBattleDuration, formatDuration } from '../logic/battleGenerator';
import { buildPhase2Standings } from '../logic/phase2Standings';
import { type StandingRow } from '../logic/standingsUtils';
import styles from './Phase2Results.module.css';

interface Props {
  repescaTeams: string[];
  qualifiedCount: number;
  repescaSlots: number;
  repescaWinners: string[];
  standings: StandingRow[];
  roundsToWin: number;
  onRepescaWinnerChange: (roundIndex: number, winner: string) => void;
  onSimulateRepesca: () => void;
}

/**
 * Displays the repesca (Phase 2) teams.
 * These teams fight in a battle royale (round-robin) to determine the remaining knockout slots.
 * Duration is estimated from the configured rounds per combat with 1 simultaneous battle.
 *
 * @param repescaTeams - Teams that did not qualify directly.
 * @param qualifiedCount - Number of direct qualified slots (context).
 * @param repescaSlots - Number of slots still open in the final bracket.
 */
export default function Phase2Results({
  repescaTeams,
  qualifiedCount,
  repescaSlots,
  repescaWinners,
  standings,
  roundsToWin,
  onRepescaWinnerChange,
  onSimulateRepesca,
}: Props) {
  const r = repescaTeams.length;
  const totalBattles = repescaSlots;
  const estimatedMinutes = totalBattles * calcBattleDuration(roundsToWin);
  const completedRounds = repescaWinners.filter(Boolean).length;
  const repescaRounds = buildRepescaRounds(repescaTeams, repescaSlots, repescaWinners);
  const qualifiedFromRepesca = repescaWinners.filter(Boolean);
  const displayStandings = buildPhase2Standings(standings, qualifiedCount, repescaWinners);

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className="section-tag">Fase 2</div>
          <h2 className={styles.title}>Repesca</h2>
          <p className={styles.subtitle}>
            Battle royale per decidir els llocs {qualifiedCount + 1}è al {qualifiedCount + repescaSlots}è de la fase final
          </p>
        </div>
        {r > 1 && (
          <div className={styles.timeCard}>
            <span className={styles.timeIcon}>⏱</span>
            <div>
              <div className={styles.timeValue}>{formatDuration(estimatedMinutes)}</div>
              <div className={styles.timeLabel}>{totalBattles} rondes · 1 battle royale per ronda</div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onSimulateRepesca}
        >
          🎲 Simular fase
        </button>
      </div>

      <div className={styles.infoBox}>
        <span className={styles.infoIcon}>⚔️</span>
        <div>
          <strong>Format: Battle royale per places</strong>
          <p>
            A cada ronda entren al ring tots els robots de repesca que encara no s'han classificat.
            L'últim robot que queda dins del ring aconsegueix una plaça per a quarts. Es fan {repescaSlots} rondes
            per completar les places pendents.
          </p>
        </div>
      </div>

      <div className={styles.progressBox}>
        <div>
          <strong>Classificats de repesca registrats</strong>
          <p>{completedRounds}/{repescaSlots} places decidides</p>
        </div>
      </div>

      {repescaTeams.length === 0 ? (
        <p className={styles.empty}>
          Defineix els classificats per veure qui va a repesca.
        </p>
      ) : (
        <>
          <div className={styles.teamGrid}>
            {qualifiedFromRepesca.length === 0 ? (
              <p className={styles.empty}>Encara no hi ha cap equip classificat des de repesca.</p>
            ) : (
              qualifiedFromRepesca.map((team, idx) => (
              <div
                key={`${team}-${idx}`}
                className={`${styles.teamCard} animate-fade-in-up`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <span className={styles.teamIdx}>{qualifiedCount + 1 + idx}</span>
                <span className={styles.teamName}>{team}</span>
                <span className="badge badge--secondary">Classificat</span>
              </div>
              ))
            )}
          </div>

          <div className={styles.roundList}>
            {repescaRounds.map((round, idx) => (
              <div key={round.label} className={styles.roundCard}>
                <div className={styles.roundHeader}>
                  <div>
                    <div className="section-tag">{round.label}</div>
                    <p className={styles.roundSubtitle}>
                      Classifica el lloc {qualifiedCount + idx + 1}è
                    </p>
                  </div>
                  {round.winner && <span className="badge badge--secondary">Registrat</span>}
                </div>

                <div className={styles.roundTeams}>
                  {round.availableTeams.map((team) => (
                    <button
                      key={`${round.label}-${team}`}
                      type="button"
                      className={`${styles.winnerBtn} ${round.winner === team ? styles.winnerBtnActive : ''}`}
                      onClick={() => onRepescaWinnerChange(idx, team)}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.standingsSection}>
            <div className={styles.standingsHeader}>
              <div>
                <div className="section-tag">Classificació</div>
                <p className={styles.standingsSubtitle}>
                  Els classificats de repesca ocupen les places finals en l&apos;ordre en què es decideixen.
                </p>
              </div>
            </div>

            <div className={styles.standingsList}>
              {displayStandings.map((row, index) => {
                const isDirect = index < qualifiedCount;
                const isRepescaQualified = qualifiedFromRepesca.includes(row.team);
                return (
                  <div
                    key={row.team}
                    className={`${styles.standingsRow} ${isRepescaQualified ? styles.standingsRowRepescaQualified : isDirect ? styles.standingsRowQualified : styles.standingsRowRepesca}`}
                  >
                    <span className={styles.standingsPos}>{index + 1}</span>
                    <span className={styles.standingsTeam}>{row.team}</span>
                    <div className={styles.standingsStats}>
                      <span className={styles.pointsBadge}>{row.pointsFor} pts</span>
                      <span className={styles.playedBadge}>{row.played} J</span>
                    </div>
                    <span className={styles.standingsBadge}>
                      {isRepescaQualified ? 'R+' : isDirect ? 'Q' : 'R'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildRepescaRounds(repescaTeams: string[], repescaSlots: number, repescaWinners: string[]) {
  const rounds: Array<{ label: string; availableTeams: string[]; winner: string }> = [];
  const qualified = new Set<string>();

  for (let i = 0; i < repescaSlots; i++) {
    const winner = repescaWinners[i] ?? '';
    const availableTeams = repescaTeams.filter((team) => !qualified.has(team));
    rounds.push({
      label: `Ronda ${i + 1}`,
      availableTeams,
      winner,
    });

    if (winner) {
      qualified.add(winner);
    }
  }

  return rounds;
}
