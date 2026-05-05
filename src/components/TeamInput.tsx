import { useState, useRef, type KeyboardEvent } from 'react';
import styles from './TeamInput.module.css';

const DEMO_NAMES = [
  'Ashfu',
  'Bobobot',
  'Brouston',
  'CabraLabs 2.0',
  'Clanker',
  'Dodgers',
  'Eco byte',
  'FLYINGBOTS',
  'ForceVector Robotics',
  'Goat Slayer',
  'La cucaracha',
  'Manelxina',
  'Pajaro Azul',
  'Payo Industries',
  'Pip install IA',
  'SigmaBot',
];

function pickDemoTeams(existing: string[]): string[] {
  const available = DEMO_NAMES.filter((n) => !existing.includes(n));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, 16);
}

interface Props {
  teams: string[];
  onAdd: (names: string[]) => boolean;
  onRemove: (name: string) => boolean;
  onClear: () => boolean;
}

/**
 * Team management panel.
 * Supports adding teams one-by-one (Enter key or button) or
 * pasting multiple names (one per line) at once.
 */
export default function TeamInput({ teams, onAdd, onRemove, onClear }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed || teams.includes(trimmed)) return;
    if (!onAdd([trimmed])) return;
    setInputValue('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  function handleBulkAdd() {
    const names = bulkValue
      .split('\n')
      .map((n) => n.trim())
      .filter((n, index, allNames) => n && !teams.includes(n) && allNames.indexOf(n) === index);
    if (names.length > 0 && !onAdd(names)) return;
    setBulkValue('');
    setShowBulk(false);
  }

  return (
    <div className={styles.panel}>
      {/* Demo generator */}
      {teams.length === 0 && (
        <button
          className={`btn btn--ghost ${styles.demoBtn}`}
          onClick={() => onAdd(pickDemoTeams(teams))}
          title="Genera 16 noms d'equips de prova per explorar l'aplicació"
        >
          🎲 Genera 16 equips de prova
        </button>
      )}

      {/* Single team input */}
      <div className={styles.addRow}>
        <input
          ref={inputRef}
          id="team-input"
          type="text"
          className="input"
          placeholder="Nom de l'equip..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Nom de l'equip"
        />
        <button
          id="btn-add-team"
          className="btn btn--primary"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          + Afegir
        </button>
        <button
          id="btn-toggle-bulk"
          className={`btn btn--secondary ${showBulk ? styles.activeToggle : ''}`}
          onClick={() => setShowBulk((v) => !v)}
          title="Enganxar múltiples equips"
        >
          📋 Enganxar llista
        </button>
      </div>

      {/* Bulk paste area */}
      {showBulk && (
        <div className={`${styles.bulkArea} animate-fade-in-up`}>
          <label className={styles.bulkLabel} htmlFor="bulk-input">
            Enganxa els noms dels equips, un per línia:
          </label>
          <textarea
            id="bulk-input"
            className="input textarea"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="RobotX&#10;TeamSumo2&#10;NanoBot..."
            rows={5}
          />
          <div className={styles.bulkActions}>
            <button
              id="btn-bulk-add"
              className="btn btn--primary"
              onClick={handleBulkAdd}
              disabled={!bulkValue.trim()}
            >
              Afegir tots
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => { setShowBulk(false); setBulkValue(''); }}
            >
              Cancel·lar
            </button>
          </div>
        </div>
      )}

      {/* Team list */}
      <div className={styles.listHeader}>
        <span className={styles.count}>
          <span className={styles.countNum}>{teams.length}</span>
          {' '}equip{teams.length !== 1 ? 's' : ''} registrat{teams.length !== 1 ? 's' : ''}
        </span>
        {teams.length > 0 && (
          <button
            id="btn-clear-teams"
            className="btn btn--danger"
            onClick={onClear}
          >
            Buidar tot
          </button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🤖</span>
          <p>Afegeix equips per começar</p>
        </div>
      ) : (
        <ul className={styles.teamList} role="list">
          {teams.map((team, idx) => (
            <li
              key={team}
              className={`${styles.teamItem} animate-fade-in-up`}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <span className={styles.teamIndex}>{idx + 1}</span>
              <span className={styles.teamName}>{team}</span>
              <button
                className="btn btn--danger btn--icon"
                id={`btn-remove-${idx}`}
                onClick={() => onRemove(team)}
                aria-label={`Eliminar ${team}`}
                title={`Eliminar ${team}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
