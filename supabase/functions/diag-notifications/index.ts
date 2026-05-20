// One-shot diagnostic for push + email infrastructure.
// Call from the logged-in app (any user) to get a JSON report of what works:
//   - FCM_SERVICE_ACCOUNT_JSON parses + project_id
//   - FCM OAuth access token can be minted
//   - For each of the caller's device_push_tokens, FCM accepts the send
//   - RESEND_API_KEY presence + a test send to the caller's email (only if ?email=1)
//
// Body (optional): { email?: boolean }  - also send a test email to caller
// Auth: any valid user JWT (auto-injected by supabase.functions.invoke)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_SA_JSON = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getFcmAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`OAuth failed (${resp.status}): ${JSON.stringify(json)}`);
  return json.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const report: any = {
    fcm: { secret_present: !!FCM_SA_JSON },
    resend: { secret_present: !!RESEND_API_KEY },
    caller: {},
    tokens: [],
    email_test: null,
  };

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (!bearer) {
      return new Response(JSON.stringify({ error: 'Unauthorized — sign in first' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: claims } = await admin.auth.getClaims(bearer);
    const callerId = claims?.claims?.sub as string | undefined;
    const callerEmail = claims?.claims?.email as string | undefined;
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    report.caller = { id: callerId, email: callerEmail };

    // Prefer DB-stored FCM JSON (admin can update via Settings UI), fallback to env secret.
    let fcmJson: string | null = FCM_SA_JSON ?? null;
    let fcmSource: 'db' | 'env' | 'none' = FCM_SA_JSON ? 'env' : 'none';
    try {
      const { data: row } = await admin
        .from('app_secrets').select('value').eq('key', 'FCM_SERVICE_ACCOUNT_JSON').maybeSingle();
      if (row?.value) { fcmJson = row.value as string; fcmSource = 'db'; }
    } catch { /* ignore */ }
    report.fcm.secret_present = !!fcmJson;
    report.fcm.source = fcmSource;

    // ── FCM ──
    if (!fcmJson) {
      report.fcm.error = 'FCM_SERVICE_ACCOUNT_JSON not set (neither DB row nor env secret)';
    } else {
      try {
        const sa = JSON.parse(fcmJson);
        report.fcm.top_level_keys = Object.keys(sa);
        report.fcm.type = sa.type;
        report.fcm.project_id = sa.project_id;
        report.fcm.client_email = sa.client_email;
        report.fcm.has_private_key = !!sa.private_key;
        report.fcm.private_key_starts_with = typeof sa.private_key === 'string' ? sa.private_key.slice(0, 30) : null;
        if (sa.type !== 'service_account') {
          report.fcm.hint = `Wrong file. Got type="${sa.type}". You need a Firebase service-account JSON (Project Settings → Service accounts → Generate new private key). It must have type="service_account" and project_id/client_email/private_key fields.`;
        } else if (!sa.project_id || !sa.private_key || !sa.client_email) {
          report.fcm.hint = 'Service-account JSON is missing required fields (project_id / client_email / private_key).';
        }
        if (sa.type === 'service_account' && sa.private_key && sa.client_email) {
          const token = await getFcmAccessToken(sa);
          report.fcm.access_token_ok = !!token;
        }

        const { data: tokenRows } = await admin
          .from('device_push_tokens').select('token, platform, updated_at')
          .eq('user_id', callerId);
        report.fcm.tokens_in_db = tokenRows?.length ?? 0;

        const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
        for (const row of (tokenRows ?? [])) {
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: row.token,
                notification: { title: 'Shifora diag', body: 'Diagnostic test push' },
                android: { priority: 'HIGH', notification: { sound: 'default', channel_id: 'default' } },
              },
            }),
          });
          const txt = await r.text();
          report.tokens.push({
            preview: String(row.token).slice(0, 16) + '…',
            platform: row.platform,
            status: r.status,
            ok: r.ok,
            error: r.ok ? null : txt.slice(0, 400),
          });
        }
      } catch (e) {
        report.fcm.error = String((e as Error).message ?? e);
      }
    }

    // ── Resend test ──
    const body = await req.json().catch(() => ({}));
    if (body?.email && callerEmail) {
      if (!RESEND_API_KEY) {
        report.email_test = { error: 'RESEND_API_KEY not set' };
      } else {
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: Deno.env.get('APPOINTMENT_FROM_EMAIL') || 'Dr. M Abdul Bari <noreply@drmabari.com>',
              to: [callerEmail],
              subject: 'Shifora notification diagnostic',
              html: '<p>If you received this, Resend works. Check sender domain in send-appointment-email.</p>',
            }),
          });
          const j = await r.json();
          report.email_test = { status: r.status, ok: r.ok, response: j };
        } catch (e) {
          report.email_test = { error: String((e as Error).message ?? e) };
        }
      }
    }

    return new Response(JSON.stringify(report, null, 2), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e), report }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
