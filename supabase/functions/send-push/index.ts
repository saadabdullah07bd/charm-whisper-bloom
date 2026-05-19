// Sends a Firebase Cloud Messaging (FCM v1) push to all tokens owned by a user.
// Works when the recipient's Android/iOS app is in foreground, background OR
// fully killed — because we always send a `notification` payload.
//
// Requires secret FCM_SERVICE_ACCOUNT_JSON: the full JSON of a Firebase
// service-account key with "Firebase Cloud Messaging API" enabled.
//
// Body: { userId: string, title: string, body: string, data?: Record<string,string> }
//   OR  { userIds: string[], title, body, data? }
//
// verify_jwt is OFF — callers (other edge functions, cron) authenticate via
// SUPABASE_SERVICE_ROLE_KEY in the Authorization header which we validate.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_SA_JSON = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`OAuth: ${JSON.stringify(json)}`);
  cachedAccessToken = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Auth: only trusted internal callers (edge functions, cron) bearing the
    // service-role key may invoke this. Prevents arbitrary public push spam.
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim() : '';
    if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!FCM_SA_JSON) {
      return new Response(JSON.stringify({ error: 'FCM_SERVICE_ACCOUNT_JSON not set' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sa: ServiceAccount = JSON.parse(FCM_SA_JSON);

    const body = await req.json().catch(() => null);
    if (!body || typeof body.title !== 'string' || typeof body.body !== 'string') {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userIds: string[] = body.userIds ?? (body.userId ? [body.userId] : []);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ error: 'userId or userIds required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: tokenRows, error } = await admin
      .from('device_push_tokens')
      .select('token, user_id')
      .in('user_id', userIds);
    if (error) throw error;

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken(sa);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const dataPayload: Record<string, string> = {};
    if (body.data && typeof body.data === 'object') {
      for (const [k, v] of Object.entries(body.data)) {
        dataPayload[k] = String(v);
      }
    }

    const stale: string[] = [];
    let sent = 0;
    await Promise.all(tokenRows.map(async (row) => {
      const message = {
        message: {
          token: row.token,
          notification: { title: body.title, body: body.body },
          data: dataPayload,
          android: { priority: 'HIGH', notification: { sound: 'default', channel_id: 'default' } },
          apns: { payload: { aps: { sound: 'default', 'content-available': 1 } } },
        },
      };
      const r = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (r.ok) { sent++; return; }
      const errBody = await r.text();
      console.warn('[send-push] FCM error', r.status, errBody);
      // Remove permanently invalid tokens
      if (r.status === 404 || r.status === 400) stale.push(row.token);
    }));

    if (stale.length) {
      await admin.from('device_push_tokens').delete().in('token', stale);
    }

    return new Response(JSON.stringify({ sent, attempted: tokenRows.length, pruned: stale.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[send-push] error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
