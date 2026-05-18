// Asia/Dhaka (UTC+6) is the canonical clinic timezone.
// Display falls back to the viewer's device tz, but anything we *store*
// as "9:00 PM" is interpreted as Dhaka local time.

export const CLINIC_TZ = 'Asia/Dhaka';
export const CLINIC_TZ_OFFSET_MIN = 6 * 60; // UTC+6

/**
 * Parse a stored appointment date+time slot ("2026-05-18", "9:00 PM") into a
 * real Date that points to the correct instant in time — interpreting the
 * time as Dhaka local. This way, the same appointment shows the right wall
 * clock no matter where the viewer is.
 */
export function parseClinicDateTime(date: string, time: string): Date | null {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  const mer = m[3].toUpperCase();
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  const [y, mo, d] = date.split('-').map(Number);
  // Construct as UTC, then subtract the clinic offset to get the real instant.
  const utcMs = Date.UTC(y, (mo || 1) - 1, d || 1, h, mi, 0, 0) - CLINIC_TZ_OFFSET_MIN * 60_000;
  return new Date(utcMs);
}

/** Format the date portion in Dhaka tz, e.g. "May 18, 2026". */
export function formatClinicDate(date: string): string {
  try {
    return new Date(`${date}T00:00:00+06:00`).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: CLINIC_TZ,
    });
  } catch {
    return date;
  }
}

/** "9:00 PM" — already the slot label; helper kept for future formatting. */
export function formatClinicTime(time: string): string {
  return time;
}

/** Human label like "in 12 min" / "starts in 2h 15m" / "5 min ago". */
export function relativeFromNow(target: Date, now = new Date()): string {
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const phrase = hours > 0 ? `${hours}h ${remMins}m` : `${mins} min`;
  return ms >= 0 ? `in ${phrase}` : `${phrase} ago`;
}
