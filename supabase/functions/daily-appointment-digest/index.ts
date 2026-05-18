import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const BRAND = {
  primary: "#171717",
  primaryFg: "#fafafa",
  bg: "#f7f7f7",
  card: "#ffffff",
  muted: "#737373",
  border: "#e0e0e0",
  success: "#22c55e",
  info: "#3b82f6",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require a shared-secret header (CRON_SECRET) or a valid service-role bearer
  // token. This prevents unauthenticated callers from triggering digest emails
  // on demand and exhausting the email quota.
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
  const providedCron = req.headers.get("x-cron-secret") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const cronOk = CRON_SECRET && providedCron === CRON_SECRET;
  const serviceOk = SERVICE_ROLE && bearer === SERVICE_ROLE;
  if (!cronOk && !serviceOk) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date in Bangladesh time (GMT+6)
    const now = new Date();
    const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const todayStr = bdTime.toISOString().split("T")[0];

    // Get today's confirmed appointments
    const { data: appointments, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", todayStr)
      .eq("status", "confirmed")
      .order("time_slot", { ascending: true });

    if (aptError) throw aptError;

    // Get doctor email
    const { data: doctorData } = await supabase
      .from("doctor_settings")
      .select("email, name")
      .limit(1)
      .single();

    if (!doctorData?.email) {
      return new Response(JSON.stringify({ message: "No doctor email configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = appointments?.length || 0;

    const formattedDate = new Date(todayStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    let appointmentRows = "";
    if (count > 0) {
      appointmentRows = (appointments || []).map((apt: any, i: number) =>
        `<tr>
          <td style="padding:10px 14px;font-size:13px;font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">${i + 1}</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:500;font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">${esc(apt.patient_name)}</td>
          <td style="padding:10px 14px;font-size:13px;font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">${esc(apt.time_slot)}</td>
          <td style="padding:10px 14px;font-size:13px;font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">${esc(apt.chief_complaint || "—")}</td>
        </tr>`
      ).join("");
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:'Poppins',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;max-width:600px;">
<tr><td style="background-color:${BRAND.primary};padding:28px 32px;text-align:center;">
<h1 style="margin:0;color:${BRAND.primaryFg};font-size:20px;font-weight:600;font-family:'Poppins',Arial,sans-serif;">Today's Appointments</h1>
<p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;font-family:'Poppins',Arial,sans-serif;">${formattedDate}</p>
</td></tr>
<tr><td style="padding:32px;">
${count > 0 ? `
<p style="margin:0 0 16px;font-size:14px;color:#333;font-family:'Poppins',Arial,sans-serif;">You have <strong>${count}</strong> confirmed appointment${count > 1 ? "s" : ""} today.</p>
<span style="display:inline-block;padding:4px 14px;border-radius:20px;background-color:${BRAND.success}15;color:${BRAND.success};font-size:12px;font-weight:600;font-family:'Poppins',Arial,sans-serif;">${count} Appointment${count > 1 ? "s" : ""}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};border-radius:12px;border:1px solid ${BRAND.border};margin:20px 0;">
<tr>
<th style="padding:10px 14px;text-align:left;font-size:12px;color:${BRAND.muted};font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">#</th>
<th style="padding:10px 14px;text-align:left;font-size:12px;color:${BRAND.muted};font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">Patient</th>
<th style="padding:10px 14px;text-align:left;font-size:12px;color:${BRAND.muted};font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">Time</th>
<th style="padding:10px 14px;text-align:left;font-size:12px;color:${BRAND.muted};font-family:'Poppins',Arial,sans-serif;border-bottom:1px solid ${BRAND.border};">Complaint</th>
</tr>
${appointmentRows}
</table>
` : `
<p style="margin:0 0 16px;font-size:14px;color:#333;font-family:'Poppins',Arial,sans-serif;">You have <strong>no confirmed appointments</strong> for today.</p>
<span style="display:inline-block;padding:4px 14px;border-radius:20px;background-color:${BRAND.info}15;color:${BRAND.info};font-size:12px;font-weight:600;font-family:'Poppins',Arial,sans-serif;">No Appointments</span>
`}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid ${BRAND.border};text-align:center;">
<p style="margin:0;color:${BRAND.muted};font-size:11px;font-family:'Poppins',Arial,sans-serif;">Daily appointment digest • MedPortal</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    const subject = count > 0
      ? `Today's Appointments (${count}) – ${formattedDate}`
      : `No Appointments Today – ${formattedDate}`;

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Dr. M Abdul Bari <onboarding@resend.dev>",
        to: [doctorData.email],
        subject,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Resend error:", JSON.stringify(data));
      throw new Error(`Email send failed: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, appointments: count }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
