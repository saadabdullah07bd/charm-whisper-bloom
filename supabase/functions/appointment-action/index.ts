import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAND = {
  primary: "#171717",
  primaryFg: "#fafafa",
  bg: "#f7f7f7",
  card: "#ffffff",
  success: "#22c55e",
  danger: "#ef4444",
  muted: "#737373",
  border: "#e0e0e0",
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resultPage(title: string, message: string, color: string): string {
  const safeTitle = esc(title);
  const safeMessage = esc(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', sans-serif; background: ${BRAND.bg}; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
  .card { background: ${BRAND.card}; border-radius: 20px; padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; border: 1px solid ${BRAND.border}; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
  .icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
  h1 { font-size: 22px; font-weight: 600; color: ${BRAND.primary}; margin-bottom: 12px; }
  p { font-size: 14px; color: ${BRAND.muted}; line-height: 1.6; }
  .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid ${BRAND.border}; }
  .footer p { font-size: 11px; }
</style>
</head>
<body>
<div class="card">
  <div class="icon" style="background: ${color}15;">
    <span>${color === BRAND.success ? '&#10003;' : color === BRAND.danger ? '&#10005;' : '&#8505;'}</span>
  </div>
  <h1>${safeTitle}</h1>
  <p>${safeMessage}</p>
  <div class="footer">
    <p>Dr. Muhammad Abdul Bari &middot; MBBS, MD, FACP (USA)</p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action"); // approve | cancel
  const appointmentId = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  if (!action || !appointmentId || !token) {
    return new Response(resultPage("Invalid Link", "This action link is invalid or incomplete.", BRAND.danger), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Simple token: we use HMAC of appointment_id + action using service role key as secret
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify token
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${appointmentId}:${action}`));
  const expectedToken = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (token !== expectedToken) {
    return new Response(resultPage("Invalid Token", "This action link has expired or is invalid.", BRAND.danger), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Get appointment
  const { data: apt, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !apt) {
    return new Response(resultPage("Not Found", "This appointment was not found.", BRAND.danger), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (apt.status !== "pending") {
    const statusMsg = apt.status === "confirmed" ? "already been approved" : apt.status === "cancelled" ? "already been cancelled" : `status: ${apt.status}`;
    return new Response(resultPage("Already Processed", `This appointment has ${statusMsg}. No further action needed.`, "#3b82f6"), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const formattedDate = new Date(apt.appointment_date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  if (action === "approve") {
    const { error } = await supabase.from("appointments").update({
      status: "confirmed",
      updated_at: new Date().toISOString(),
    }).eq("id", appointmentId);

    if (error) {
      return new Response(resultPage("Error", "Failed to approve the appointment. Please try from the dashboard.", BRAND.danger), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Send confirmation email to patient
    if (apt.patient_email) {
      try {
        await supabase.functions.invoke("send-appointment-email", {
          body: {
            type: "appointment_approved",
            to: apt.patient_email,
            patientName: apt.patient_name,
            date: apt.appointment_date,
            time: apt.time_slot,
          },
        });
      } catch (e) { console.error("Email error:", e); }
    }

    return new Response(resultPage(
      "Appointment Approved ✓",
      `${apt.patient_name}'s appointment on ${formattedDate} at ${apt.time_slot} has been confirmed. The patient has been notified.`,
      BRAND.success
    ), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (action === "cancel") {
    const { error } = await supabase.from("appointments").update({
      status: "cancelled",
      cancel_reason: "Cancelled via email",
      updated_at: new Date().toISOString(),
    }).eq("id", appointmentId);

    if (error) {
      return new Response(resultPage("Error", "Failed to cancel the appointment. Please try from the dashboard.", BRAND.danger), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Send cancellation email to patient
    if (apt.patient_email) {
      try {
        await supabase.functions.invoke("send-appointment-email", {
          body: {
            type: "appointment_cancelled_by_doctor",
            to: apt.patient_email,
            patientName: apt.patient_name,
            date: apt.appointment_date,
            time: apt.time_slot,
            reason: "Cancelled via email",
          },
        });
      } catch (e) { console.error("Email error:", e); }
    }

    return new Response(resultPage(
      "Appointment Cancelled",
      `${apt.patient_name}'s appointment on ${formattedDate} at ${apt.time_slot} has been cancelled. The patient has been notified.`,
      BRAND.danger
    ), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(resultPage("Invalid Action", "Unknown action type.", BRAND.danger), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
});
