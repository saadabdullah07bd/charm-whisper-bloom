// Creates (or reuses) a Daily.co room for an appointment and mints a meeting token.
// POST body: { appointmentId: string }
// Returns: { url: string, token: string, roomName: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAILY_API = "https://api.daily.co/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("DAILY_API_KEY");
    if (!apiKey) return json({ error: "DAILY_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth token" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const appointmentId = body?.appointmentId as string | undefined;
    if (!appointmentId) return json({ error: "appointmentId required" }, 400);

    // Verify the caller is part of this appointment (patient or doctor).
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select("id, patient_id, status, patients:patient_id(user_id)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (aptErr || !apt) {
      console.error("[daily-room] appointment lookup failed", { appointmentId, aptErr });
      return json({ error: "Appointment not found", appointmentId, details: aptErr?.message }, 404);
    }

    const patientUserId = (apt as any).patients?.user_id ?? null;
    const isPatient = patientUserId && patientUserId === user.id;
    // Doctor check: any user with the doctor role.
    let isDoctor = false;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    isDoctor = (roles ?? []).some((r: any) => r.role === "doctor");

    // TESTING MODE: allow any authenticated user to join. Tighten before prod.
    const allowAnyAuthed = true;
    if (!isPatient && !isDoctor && !allowAnyAuthed) {
      return json({ error: "Not authorized for this appointment" }, 403);
    }

    // Daily room name must be <= 41 chars, alphanum + hyphen.
    const roomName = `apt-${appointmentId}`.slice(0, 41);

    // Ensure room exists (idempotent).
    const expSec = Math.floor(Date.now() / 1000) + 60 * 60 * 4; // 4h
    const getRoom = await fetch(`${DAILY_API}/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (getRoom.status === 404) {
      const create = await fetch(`${DAILY_API}/rooms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp: expSec,
            enable_chat: true,
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
            eject_at_room_exp: true,
          },
        }),
      });
      if (!create.ok) {
        const txt = await create.text();
        return json({ error: "Failed to create room", details: txt }, 500);
      }
    } else if (!getRoom.ok) {
      const txt = await getRoom.text();
      return json({ error: "Failed to fetch room", details: txt }, 500);
    }

    // Mint a meeting token.
    const tokenResp = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: user.email ?? (isDoctor ? "Doctor" : "Patient"),
          user_id: user.id,
          is_owner: isDoctor,
          exp: expSec,
        },
      }),
    });
    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      return json({ error: "Failed to mint token", details: txt }, 500);
    }
    const { token: meetingToken } = await tokenResp.json();

    return json({
      url: `https://${Deno.env.get("DAILY_SUBDOMAIN") ?? "drmabari"}.daily.co/${roomName}`,
      token: meetingToken,
      roomName,
    });
  } catch (err) {
    console.error("[daily-room] error", err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});
