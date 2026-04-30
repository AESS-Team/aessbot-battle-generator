import { useEffect, useState } from 'react';
import { computeSecondsLeft, TIMER_DURATION, type TimerState } from '../logic/timerUtils';
import styles from './BattleTimer.module.css';

interface Props {
  timerState: TimerState;
  onTimerChange: (state: TimerState) => void;
}

export default function BattleTimer({ timerState, onTimerChange }: Props) {
  const [, forceRender] = useState(0);

  const isRunning = timerState.startedAt !== null;
  const secondsLeft = computeSecondsLeft(timerState);
  const isFinished = secondsLeft === 0;
  const isWarning = secondsLeft <= 30 && secondsLeft > 0 && isRunning;
  const progress = secondsLeft / TIMER_DURATION;

  // Re-render every 500ms while running so display updates
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => forceRender((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [isRunning]);

  // Stop timer when it reaches zero
  useEffect(() => {
    if (isRunning && secondsLeft <= 0) {
      onTimerChange({ pausedSecondsLeft: 0, startedAt: null });
    }
  }, [isRunning, secondsLeft, onTimerChange]);

  function handleStart() {
    if (secondsLeft <= 0) return;
    onTimerChange({ pausedSecondsLeft: secondsLeft, startedAt: Date.now() });
  }

  function handleStop() {
    onTimerChange({ pausedSecondsLeft: secondsLeft, startedAt: null });
  }

  function handleReset() {
    onTimerChange({ pausedSecondsLeft: TIMER_DURATION, startedAt: null });
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className={[styles.timer, isWarning ? styles.timerWarning : '', isFinished ? styles.timerFinished : ''].filter(Boolean).join(' ')}>
      <svg className={styles.ring} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--subtle-fill)" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke={isWarning || isFinished ? 'var(--accent-danger)' : 'var(--accent-secondary)'}
          strokeWidth="2.5"
          strokeDasharray={`${progress * 100} 100`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className={styles.display}>
        <span className={[styles.time, isWarning || isFinished ? styles.timeWarning : ''].filter(Boolean).join(' ')}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        <span className={styles.timeLabel}>ronda</span>
      </div>
      <div className={styles.controls}>
        {!isRunning ? (
          <button type="button" className={`${styles.btn} ${styles.btnStart}`} onClick={handleStart} disabled={isFinished} title="Iniciar">▶</button>
        ) : (
          <button type="button" className={`${styles.btn} ${styles.btnPause}`} onClick={handleStop} title="Pausar">⏸</button>
        )}
        <button type="button" className={`${styles.btn} ${styles.btnReset}`} onClick={handleReset} title="Reiniciar">↺</button>
      </div>
    </div>
  );
}
