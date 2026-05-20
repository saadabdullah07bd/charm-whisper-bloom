// Creates (or fetches) a Daily.co room for an appointment and returns the join URL.
// Room name is derived deterministically from appointmentId so doctor + patient join the same room.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY") ?? "";

    if (!DAILY_API_KEY) return json({ error: "DAILY_API_KEY missing" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return json({ error: "Unauthorized" }, 401);

    let userId = "";
    let userEmail = "";
    if (SERVICE_ROLE && token === SERVICE_ROLE) {
      userId = "service";
    } else {
      const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
      });
      if (!userResp.ok) return json({ error: "Unauthorized" }, 401);
      const user = await userResp.json();
      userId = user?.id ?? "";
      userEmail = user?.email ?? "";
    }

    const { appointmentId, displayName } = await req.json();
    if (!appointmentId) return json({ error: "appointmentId required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_date, time_slot, status, google_meet_link")
      .eq("id", appointmentId).single();
    if (aptErr || !apt) return json({ error: "Appointment not found" }, 404);

    // Authorization: only the booked patient or a doctor may join.
    let isDoctor = false;
    let isAuthorized = false;
    if (userId === "service") {
      isAuthorized = true;
    } else if (userId) {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "doctor").maybeSingle();
      if (roleRow) { isAuthorized = true; isDoctor = true; }
      else if (apt.patient_id) {
        const { data: patientRow } = await supabase
          .from("patients").select("user_id").eq("id", apt.patient_id).maybeSingle();
        if (patientRow?.user_id === userId) isAuthorized = true;
      }
    }
    if (!isAuthorized) return json({ error: "Forbidden" }, 403);

    // Deterministic, Daily-safe room name (lowercase, <=41 chars, alnum/dash).
    const roomName = `apt-${String(appointmentId).replace(/-/g, "").slice(0, 24)}`.toLowerCase();

    // Try to get the room; create if it doesn't exist.
    const dailyHeaders = {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      "Content-Type": "application/json",
    };
    // Room properties — prejoin UI is OFF because inside the Capacitor WebView
    // Daily's prejoin "browser permission" screen incorrectly tells the user to
    // open browser settings. Skipping prejoin lets Daily request mic/camera
    // directly, which our WebChromeClient grants via the native OS permissions.
    const roomProps = {
      enable_prejoin_ui: false,
      enable_screenshare: true,
      enable_chat: true,
      start_video_off: false,
      start_audio_off: false,
    };

    let getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, { headers: dailyHeaders });
    let room: any = null;
    if (getRes.ok) {
      room = await getRes.json();
      // Make sure existing rooms also have prejoin disabled — patch idempotently.
      if (room?.config?.enable_prejoin_ui !== false) {
        const patchRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: "POST",
          headers: dailyHeaders,
          body: JSON.stringify({ properties: { enable_prejoin_ui: false } }),
        });
        if (patchRes.ok) room = await patchRes.json();
      }
    } else if (getRes.status === 404) {
      // Expire 24h from now so stale rooms don't pile up.
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      const createRes = await fetch(`https://api.daily.co/v1/rooms`, {
        method: "POST",
        headers: dailyHeaders,
        body: JSON.stringify({
          name: roomName,
          privacy: "public",
          properties: { exp, ...roomProps },
        }),
      });
      if (!createRes.ok) {
        const txt = await createRes.text();
        console.error("Daily room create failed:", txt);
        return json({ error: "Could not create room", detail: txt }, 500);
      }
      room = await createRes.json();
    } else {
      const txt = await getRes.text();
      console.error("Daily room fetch failed:", txt);
      return json({ error: "Could not fetch room", detail: txt }, 500);
    }

    // Issue a meeting token so we control identity & owner status.
    const tokenExp = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
    const tokenRes = await fetch(`https://api.daily.co/v1/meeting-tokens`, {
      method: "POST",
      headers: dailyHeaders,
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: (displayName as string) || userEmail || (isDoctor ? "Doctor" : "Patient"),
          is_owner: isDoctor,
          exp: tokenExp,
        },
      }),
    });
    const meetingToken = tokenRes.ok ? (await tokenRes.json())?.token : null;

    // Persist room marker so the appointment shows "video ready".
    if (!apt.google_meet_link) {
      await supabase.from("appointments").update({
        google_meet_link: `daily:${roomName}`,
        google_event_id: roomName,
        updated_at: new Date().toISOString(),
      }).eq("id", appointmentId);
    }

    return json({
      success: true,
      url: room.url,
      token: meetingToken,
      room: roomName,
      isDoctor,
    });
  } catch (err) {
    console.error("daily-room error:", err);
    return json({ error: String(err) }, 500);
  }
});
