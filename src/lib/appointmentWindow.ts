// Helpers for the time window during which the video call can be joined.

export const JOIN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

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
  /** Currently inside the join window. */
  canJoin: boolean;
  /** Window has already passed. */
  ended: boolean;
  /** ms until the window opens (>0 if still in the future). */
  msUntilStart: number;
  /** Human-readable label e.g. "Available in 12 min" / "Call ended". */
  label: string;
}

export function getJoinWindowState(date: string, time: string, now: Date = new Date()): JoinWindowState {
  const start = parseAppointmentDateTime(date, time);
  if (!start) return { canJoin: false, ended: false, msUntilStart: 0, label: '' };
  const startMs = start.getTime();
  const endMs = startMs + JOIN_WINDOW_MS;
  const nowMs = now.getTime();
  if (nowMs < startMs) {
    const mins = Math.ceil((startMs - nowMs) / 60000);
    const label = mins >= 60
      ? `Available in ${Math.floor(mins / 60)}h ${mins % 60}m`
      : `Available in ${mins} min`;
    return { canJoin: false, ended: false, msUntilStart: startMs - nowMs, label };
  }
  if (nowMs <= endMs) {
    const remaining = Math.ceil((endMs - nowMs) / 60000);
    return { canJoin: true, ended: false, msUntilStart: 0, label: `Join now · ${remaining} min left` };
  }
  return { canJoin: false, ended: true, msUntilStart: 0, label: 'Call ended' };
}
