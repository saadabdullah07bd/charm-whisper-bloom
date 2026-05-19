// Helpers for the time window during which the video call can be joined.

export const JOIN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
export const REMINDER_LEAD_MS = 10 * 60 * 1000; // 10 minutes before start

export function parseAppointmentDateTime(date: string, time: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  const value = new Date(`${date}T00:00:00`);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

export interface JoinWindowState {
  /** Currently inside the join window AND session not manually ended. */
  canJoin: boolean;
  /** Window already passed OR doctor ended session early. */
  ended: boolean;
  /** Session was explicitly ended early by the doctor. */
  endedEarly: boolean;
  /** ms until the window opens (>0 if still in the future). */
  msUntilStart: number;
  /** Inside the 10-min pre-call reminder window. */
  isReminderTime: boolean;
  /** Human-readable label e.g. "Starts in 12 min" / "Session ended". */
  label: string;
}

/**
 * Compute the full session-window state. Pass the appointment row's
 * `session_ended_at` / `status` to honour an early "End Session".
 */
export function getJoinWindowState(
  date: string,
  time: string,
  now: Date = new Date(),
  options: { sessionEndedAt?: string | null; status?: string | null } = {},
): JoinWindowState {
  const start = parseAppointmentDateTime(date, time);
  if (!start) {
    return { canJoin: false, ended: false, endedEarly: false, msUntilStart: 0, isReminderTime: false, label: '' };
  }
  const startMs = start.getTime();
  const endMs = startMs + JOIN_WINDOW_MS;
  const nowMs = now.getTime();

  const manuallyEnded =
    !!options.sessionEndedAt ||
    options.status === 'completed' ||
    options.status === 'ended_early' ||
    options.status === 'cancelled' ||
    options.status === 'rejected';

  if (manuallyEnded) {
    return { canJoin: false, ended: true, endedEarly: !!options.sessionEndedAt, msUntilStart: 0, isReminderTime: false, label: 'Session ended' };
  }

  if (nowMs < startMs) {
    const msUntil = startMs - nowMs;
    const mins = Math.ceil(msUntil / 60000);
    const isReminderTime = msUntil <= REMINDER_LEAD_MS;
    // Open the join window up to 24 hours before the scheduled start so
    // doctor and patient can connect early (covers same-day testing).
    if (msUntil <= 24 * 60 * 60 * 1000) {
      return { canJoin: true, ended: false, endedEarly: false, msUntilStart: 0, isReminderTime, label: `Ready · ${mins} min to start` };
    }
    const label = mins >= 60
      ? `Starts in ${Math.floor(mins / 60)}h ${mins % 60}m`
      : `Starts in ${mins} min`;
    return { canJoin: false, ended: false, endedEarly: false, msUntilStart: msUntil, isReminderTime, label };
  }
  if (nowMs <= endMs) {
    const remaining = Math.ceil((endMs - nowMs) / 60000);
    return { canJoin: true, ended: false, endedEarly: false, msUntilStart: 0, isReminderTime: false, label: `Live · ${remaining} min remaining` };
  }
  return { canJoin: false, ended: true, endedEarly: false, msUntilStart: 0, isReminderTime: false, label: 'Session ended' };
}
