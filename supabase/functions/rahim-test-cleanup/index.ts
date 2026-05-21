import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("x-maintenance-token") !== "rahim-cleanup-2026-05-21") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const keepId = "55233b0a-6dc5-4489-8f2c-a214d9ee901f";
  const rahimPatientId = "44857ea3-ba82-4825-bca4-d6e6013e777e";
  const dailyUrl = "https://drmabari.daily.co/apt-55233b0a6dc544898f2ca214";

  const { data: removed, error: removeError } = await supabase
    .from("appointments")
    .delete()
    .or(`patient_id.eq.${rahimPatientId},patient_name.ilike.Rahim Ahmed,patient_name.ilike.Rahims Ahmed`)
    .neq("id", keepId)
    .select("id, patient_name, appointment_date, time_slot, status");

  if (removeError) {
    return new Response(JSON.stringify({ error: removeError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: kept, error: keepError } = await supabase
    .from("appointments")
    .update({
      appointment_date: "2026-05-23",
      time_slot: "10:00 PM",
      status: "confirmed",
      google_meet_link: dailyUrl,
      google_event_id: "apt-55233b0a6dc544898f2ca214",
      session_ended_at: null,
      session_ended_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", keepId)
    .select("id, patient_name, appointment_date, time_slot, status, google_meet_link")
    .single();

  if (keepError) {
    return new Response(JSON.stringify({ error: keepError.message, removed }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ removed, kept, dailyUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});