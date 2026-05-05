import { type CompetitionConfig } from '../logic/battleGenerator';
import styles from './CompetitionConfig.module.css';

interface Props {
  config: CompetitionConfig;
  onChange: (config: CompetitionConfig) => void;
  teamCount: number;
  /** Maximum simultaneous battles allowed (for validation hint). */
  maxSimultaneous?: number;
}

/**
 * Competition configuration panel.
 * Allows setting fights-per-team and number of direct qualifiers.
 * Shows an automatic recommendation when fightCount exceeds maxUnique opponents.
 */
export default function CompetitionConfigPanel({ config, onChange, teamCount, maxSimultaneous = 8 }: Props) {
  const FINAL_STAGE_SIZE = 8;
  const maxUnique = teamCount > 1 ? teamCount - 1 : 0;
  const needsAdjust = teamCount >= 4 && maxUnique < config.fightCount;

  function handleFightCount(val: number) {
    const clamped = Math.max(1, Math.min(val, 30));
    onChange({ ...config, fightCount: clamped });
  }

  function handleQualifiedCount(val: number) {
    const clamped = Math.max(1, Math.min(val, Math.max(Math.min(teamCount, FINAL_STAGE_SIZE), 1)));
    onChange({ ...config, qualifiedCount: clamped });
  }

  function handleSimultaneous(val: number) {
    const clamped = Math.max(1, Math.min(val, maxSimultaneous));
    onChange({ ...config, simultaneousBattles: clamped });
  }

  function handleRoundsToWin(val: number) {
    onChange({ ...config, roundsToWin: val === 3 ? 3 : 2 });
  }

  function applyRecommendation() {
    onChange({ ...config, fightCount: maxUnique });
  }

  return (
    <div className={styles.panel}>
      <div className="section-tag">Configuració de la competició</div>

      <div className={styles.fields}>
        {/* Fights per team */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cfg-fight-count">
            Combats per equip
          </label>
          <div className={styles.stepper}>
            <button
              className="btn btn--ghost btn--icon"
              id="cfg-fight-dec"
              onClick={() => handleFightCount(config.fightCount - 1)}
              aria-label="Reduir combats"
            >−</button>
            <input
              id="cfg-fight-count"
              type="number"
              className="input input-number"
              value={config.fightCount}
              min={1}
              max={30}
              onChange={(e) => handleFightCount(parseInt(e.target.value) || 1)}
            />
            <button
              className="btn btn--ghost btn--icon"
              id="cfg-fight-inc"
              onClick={() => handleFightCount(config.fightCount + 1)}
              aria-label="Augmentar combats"
            >+</button>
          </div>
          <span className={styles.hint}>
            Per defecte: 8
          </span>
        </div>

        {/* Qualified teams */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cfg-qualified-count">
            Classificats directes a quarts
          </label>
          <div className={styles.stepper}>
            <button
              className="btn btn--ghost btn--icon"
              id="cfg-qualified-dec"
              onClick={() => handleQualifiedCount(config.qualifiedCount - 1)}
              aria-label="Reduir classificats"
            >−</button>
            <input
              id="cfg-qualified-count"
              type="number"
              className="input input-number"
              value={config.qualifiedCount}
              min={1}
              onChange={(e) => handleQualifiedCount(parseInt(e.target.value) || 1)}
            />
            <button
              className="btn btn--ghost btn--icon"
              id="cfg-qualified-inc"
              onClick={() => handleQualifiedCount(config.qualifiedCount + 1)}
              aria-label="Augmentar classificats"
            >+</button>
          </div>
          <span className={styles.hint}>
            La repesca omple fins al 8è lloc
          </span>
        </div>

        {/* Simultaneous battles */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cfg-simultaneous">
            Combats simultànis (Fase 1)
          </label>
          <div className={styles.stepper}>
            <button
              className="btn btn--ghost btn--icon"
              id="cfg-simultaneous-dec"
              onClick={() => handleSimultaneous(config.simultaneousBattles - 1)}
              aria-label="Reduir combats simultànis"
            >−</button>
            <input
              id="cfg-simultaneous"
              type="number"
              className="input input-number"
              value={config.simultaneousBattles}
              min={1}
              max={maxSimultaneous}
              onChange={(e) => handleSimultaneous(parseInt(e.target.value) || 1)}
            />
            <button
              className="btn btn--ghost btn--icon"
              id="cfg-simultaneous-inc"
              onClick={() => handleSimultaneous(config.simultaneousBattles + 1)}
              aria-label="Augmentar combats simultànis"
            >+</button>
          </div>
          <span className={styles.hint}>
            Fase 2 i 3: sempre 1 combat alhora
          </span>
        </div>

        {/* Victory condition */}
        <div className={styles.field}>
          <span className={styles.label} id="cfg-rounds-to-win-label">
            Rondes per guanyar combat
          </span>
          <div
            className={styles.stepper}
            role="group"
            aria-labelledby="cfg-rounds-to-win-label"
          >
            <button
              type="button"
              className={`btn ${config.roundsToWin === 2 ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => handleRoundsToWin(2)}
              aria-pressed={config.roundsToWin === 2}
            >
              Guanya a 2
            </button>
            <button
              type="button"
              className={`btn ${config.roundsToWin === 3 ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => handleRoundsToWin(3)}
              aria-pressed={config.roundsToWin === 3}
            >
              Guanya a 3
            </button>
          </div>
          <span className={styles.hint}>
            {config.roundsToWin === 2 ? 'Màxim 3 rondes per combat' : 'Màxim 5 rondes per combat'}
          </span>
        </div>
      </div>

      {/* Auto-recommendation banner */}
      {needsAdjust && (
        <div className={styles.recommendation}>
          <span className={styles.recIcon}>💡</span>
          <div className={styles.recText}>
            <strong>Recomanació:</strong> Amb {teamCount} equips, el màxim de combats únics
            possibles és {maxUnique}.
          </div>
          <button
            className="btn btn--secondary"
            id="cfg-apply-recommendation"
            onClick={applyRecommendation}
          >
            Ajustar a {maxUnique}
          </button>
        </div>
      )}
    </div>
  );
}
