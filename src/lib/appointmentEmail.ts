import { supabase } from '@/integrations/supabase/client';

export type AppointmentEmailType =
  | 'booking_received'
  | 'appointment_approved'
  | 'meeting_reminder'
  | 'appointment_cancelled_by_doctor'
  | 'reschedule_requested'
  | 'reschedule_approved'
  | 'reschedule_rejected'
  | 'appointment_cancelled_by_patient'
  | 'doctor_notification'
  | 'new_appointment_request'
  | 'report_uploaded'
  | 'reschedule_holding'
  | 'prescription_ready';

interface SendAppointmentEmailParams {
  type: AppointmentEmailType;
  to: string;
  patientName: string;
  date: string;
  time: string;
  reason?: string;
  meetLink?: string;
  newDate?: string;
  newTime?: string;
  appointmentId?: string;
  reportName?: string;
  diagnosis?: string;
  medicines?: string;
}

export async function sendAppointmentEmail(params: SendAppointmentEmailParams): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-appointment-email', {
      body: params,
    });
    if (error) {
      console.error('Email send error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false;
  }
}

// Doctor's email - fetched from doctor_settings
export async function getDoctorEmail(): Promise<string | null> {
  const { data } = await supabase.rpc('get_doctor_email');
  return (data as string | null) || null;
}
