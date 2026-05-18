import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scopes — minimum needed to add the appointment to the patient's primary calendar.
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return json({ error: "Google OAuth not configured" }, 500);
    }

    const userClient = getUserClient(req);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const redirectUri = body.redirectUri as string | undefined;

    // 1) Build the Google consent URL
    if (action === "authorize") {
      if (!redirectUri) return json({ error: "redirectUri required" }, 400);
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state: user.id,
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    // 2) Exchange auth code for tokens & persist them
    if (action === "exchange") {
      const code = body.code as string | undefined;
      if (!code || !redirectUri) return json({ error: "code & redirectUri required" }, 400);

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenResp.json();
      if (!tokenResp.ok) {
        console.error("Google token exchange failed:", tokens);
        return json({ error: "Token exchange failed", details: tokens }, 400);
      }

      // Try to read the user's email from the id_token (no verification needed; Google issued it).
      let email: string | null = null;
      if (tokens.id_token) {
        try {
          const payload = JSON.parse(atob(tokens.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          email = payload.email ?? null;
        } catch (_) { /* ignore */ }
      }

      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

      // Use service client so we always upsert even if RLS evolves.
      const svc = getServiceClient();
      const { error: upsertErr } = await svc.from("patient_google_tokens").upsert({
        user_id: user.id,
        refresh_token: tokens.refresh_token ?? "",
        access_token: tokens.access_token ?? null,
        expires_at: expiresAt,
        scope: tokens.scope ?? SCOPES,
        email,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (upsertErr) {
        console.error("Token upsert failed:", upsertErr);
        return json({ error: "Failed to store tokens" }, 500);
      }
      return json({ success: true, email });
    }

    // 3) Status check
    if (action === "status") {
      const svc = getServiceClient();
      const { data } = await svc.from("patient_google_tokens").select("email, scope, updated_at").eq("user_id", user.id).maybeSingle();
      return json({ connected: !!data, email: data?.email ?? null });
    }

    // 4) Disconnect
    if (action === "disconnect") {
      const svc = getServiceClient();
      await svc.from("patient_google_tokens").delete().eq("user_id", user.id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("patient-google-oauth error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});