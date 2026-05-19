// Cron-invoked function: every minute, finds appointments starting in ~10 minutes
// (clinic timezone GMT+6, Bangladesh) and sends a "meeting_reminder" email to
// both the patient and the doctor. Uses appointments.meet_reminder_sent_at to
// guarantee at-most-once delivery per appointment.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bangladesh is UTC+6 (no DST). Build a UTC timestamp for the appointment slot.
function slotToUtc(dateStr: string, timeSlot: string): Date | null {
  // timeSlot example: "10:00 PM" or "9:30 AM"
  const m = timeSlot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  // dateStr is YYYY-MM-DD in Bangladesh local; UTC = local - 6h.
  return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00+06:00`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  // Window: appointment starts in [9, 11) minutes from now → fire reminder once.
  const windowStart = new Date(now.getTime() + 9 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 11 * 60 * 1000);
  // Look at today + tomorrow (Bangladesh) to keep the query small.
  const today = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 30 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("appointments")
    .select("id, patient_id, patient_name, patient_email, appointment_date, time_slot, status, meet_reminder_sent_at, google_meet_link")
    .in("appointment_date", [today, tomorrow])
    .eq("status", "confirmed")
    .is("meet_reminder_sent_at", null);

  if (error) {
    console.error("query error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: doctor } = await supabase
    .from("doctor_settings")
    .select("email, name, user_id")
    .limit(1)
    .maybeSingle();

  let sent = 0;
  for (const apt of rows ?? []) {
    const start = slotToUtc(apt.appointment_date as string, apt.time_slot as string);
    if (!start) continue;
    if (start < windowStart || start >= windowEnd) continue;

    const recipients: { to: string; name: string; isDoctor: boolean }[] = [];
    if (apt.patient_email) {
      recipients.push({ to: apt.patient_email, name: apt.patient_name, isDoctor: false });
    }
    if (doctor?.email) {
      recipients.push({ to: doctor.email, name: doctor.name || "Doctor", isDoctor: true });
    }

    // Emails
    for (const r of recipients) {
      try {
        await supabase.functions.invoke("send-appointment-email", {
          body: {
            type: "meeting_reminder",
            to: r.to,
            patientName: r.isDoctor ? apt.patient_name : r.name,
            date: apt.appointment_date,
            time: apt.time_slot,
            meetLink: apt.google_meet_link || undefined,
            appointmentId: apt.id,
          },
        });
      } catch (e) {
        console.error("reminder email failed", apt.id, r.to, e);
      }
    }

    // Native pushes (works when app is fully killed)
    const pushTargets: string[] = [];
    if (apt.patient_id) {
      const { data: p } = await supabase.from("patients").select("user_id").eq("id", apt.patient_id).maybeSingle();
      if (p?.user_id) pushTargets.push(p.user_id as string);
    }
    if (doctor?.user_id) pushTargets.push(doctor.user_id as string);
    for (const uid of pushTargets) {
      try {
        await supabase.functions.invoke("send-push", {
          body: {
            userId: uid,
            title: "📞 Appointment in 10 minutes",
            body: `${apt.patient_name} • ${apt.time_slot}. Tap to join.`,
            data: { aptId: apt.id, type: "meeting_reminder" },
          },
        });
      } catch (e) {
        console.error("reminder push failed", apt.id, uid, e);
      }
    }

    await supabase
      .from("appointments")
      .update({ meet_reminder_sent_at: new Date().toISOString() })
      .eq("id", apt.id);

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, checked: rows?.length ?? 0, sent }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
