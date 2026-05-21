// Helpers for the time window around an appointment slot.

export const JOIN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
export const REMINDER_LEAD_MS = 10 * 60 * 1000; // 10 minutes before start

/** Test patients for whom the appointment is ALWAYS marked available. */
export const ALWAYS_JOIN_PATIENT_IDS = new Set<string>([
  '44857ea3-ba82-4825-bca4-d6e6013e777e', // Rahim Ahmed (test account)
]);

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
  options: { sessionEndedAt?: string | null; status?: string | null; patientId?: string | null } = {},
): JoinWindowState {
  const alwaysJoin = !!(options.patientId && ALWAYS_JOIN_PATIENT_IDS.has(options.patientId));

  const start = parseAppointmentDateTime(date, time);
  if (!start) {
    if (alwaysJoin) {
      return { canJoin: true, ended: false, endedEarly: false, msUntilStart: 0, isReminderTime: false, label: 'Start call' };
    }
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

  if (manuallyEnded && !alwaysJoin) {
    return { canJoin: false, ended: true, endedEarly: !!options.sessionEndedAt, msUntilStart: 0, isReminderTime: false, label: 'Session ended' };
  }

  // Always allow joining for confirmed/pending appointments — no time window.
  if (nowMs < startMs) {
    const msUntil = startMs - nowMs;
    const mins = Math.ceil(msUntil / 60000);
    const isReminderTime = msUntil <= REMINDER_LEAD_MS;
    const label = mins >= 60
      ? `Ready · starts in ${Math.floor(mins / 60)}h ${mins % 60}m`
      : `Ready · starts in ${mins} min`;
    return { canJoin: true, ended: false, endedEarly: false, msUntilStart: msUntil, isReminderTime, label };
  }
  if (nowMs <= endMs) {
    const remaining = Math.ceil((endMs - nowMs) / 60000);
    return { canJoin: true, ended: false, endedEarly: false, msUntilStart: 0, isReminderTime: false, label: `Live · ${remaining} min remaining` };
  }
  // Past the scheduled end — still allow joining (no auto-close).
  return { canJoin: true, ended: false, endedEarly: false, msUntilStart: 0, isReminderTime: false, label: 'Start call' };
}
