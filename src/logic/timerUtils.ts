import { ROUND_DURATION_MIN } from './scoreUtils';

export const TIMER_DURATION = ROUND_DURATION_MIN * 60;

export interface TimerState {
  pausedSecondsLeft: number;
  startedAt: number | null;
}

export const DEFAULT_TIMER_STATE: TimerState = {
  pausedSecondsLeft: TIMER_DURATION,
  startedAt: null,
};

export function computeSecondsLeft(state: TimerState, now = Date.now()): number {
  if (state.startedAt === null) return state.pausedSecondsLeft;
  const elapsed = (now - state.startedAt) / 1000;
  return Math.max(0, Math.floor(state.pausedSecondsLeft - elapsed));
}
