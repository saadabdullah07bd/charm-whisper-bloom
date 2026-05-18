import { JOIN_WINDOW_MS } from '@/lib/appointmentWindow';
import { CLINIC_TZ, parseClinicDateTime } from '@/lib/timezone';

export const PATIENT_BOOKING_MIN_HOURS = 4;
export const PATIENT_CHANGE_MIN_HOURS = 2;

export interface AppointmentRuleInput {
  appointment_date: string;
  time_slot: string;
  status: string;
  google_meet_link?: string | null;
}

export function getClinicTodayDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

export function getAppointmentStart(date: string, time: string): Date | null {
  return parseClinicDateTime(date, time);
}

export function getAppointmentEnd(date: string, time: string): Date | null {
  const start = getAppointmentStart(date, time);
  if (!start) return null;
  return new Date(start.getTime() + JOIN_WINDOW_MS);
}

export function hoursUntilAppointment(date: string, time: string, now: Date = new Date()): number | null {
  const start = getAppointmentStart(date, time);
  if (!start) return null;
  return (start.getTime() - now.getTime()) / 3_600_000;
}

export function canPatientBookSlot(date: string, time: string, now: Date = new Date()): boolean {
  const hoursUntil = hoursUntilAppointment(date, time, now);
  return hoursUntil !== null && hoursUntil >= PATIENT_BOOKING_MIN_HOURS;
}

export function canPatientModifyAppointment(appointment: AppointmentRuleInput, now: Date = new Date()): boolean {
  const effectiveStatus = getEffectiveAppointmentStatus(appointment, now);
  if (!['pending', 'confirmed'].includes(effectiveStatus)) return false;

  const hoursUntil = hoursUntilAppointment(appointment.appointment_date, appointment.time_slot, now);
  return hoursUntil !== null && hoursUntil >= PATIENT_CHANGE_MIN_HOURS;
}

export function canDoctorModifyAppointment(appointment: AppointmentRuleInput, now: Date = new Date()): boolean {
  const effectiveStatus = getEffectiveAppointmentStatus(appointment, now);
  if (!['pending', 'confirmed', 'reschedule_requested'].includes(effectiveStatus)) return false;

  const start = getAppointmentStart(appointment.appointment_date, appointment.time_slot);
  return start !== null && now.getTime() < start.getTime();
}

export function shouldAutoCompleteAppointment(appointment: AppointmentRuleInput, now: Date = new Date()): boolean {
  if (['cancelled', 'completed'].includes(appointment.status)) return false;

  const end = getAppointmentEnd(appointment.appointment_date, appointment.time_slot);
  if (!end || now.getTime() <= end.getTime()) return false;

  const videoWasStarted = Boolean(appointment.google_meet_link) || ['in_call', 'awaiting_prescription'].includes(appointment.status);
  return videoWasStarted;
}

export function getEffectiveAppointmentStatus(appointment: AppointmentRuleInput, now: Date = new Date()): string {
  if (shouldAutoCompleteAppointment(appointment, now)) return 'completed';
  return appointment.status;
}