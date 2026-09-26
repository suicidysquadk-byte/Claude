// Manda os avisos e as mensagens novos para o celular (Firebase Cloud Messaging, API HTTP v1).
// Quem chama é o próprio banco (gatilhos da migração 14, pelo pg_net), com o segredo PUSH_SECRET no cabeçalho.
// Publique com verify_jwt desligado. Segredos: PUSH_SECRET e FCM_SERVICE_ACCOUNT (o JSON da conta de serviço do
// Firebase). Sem FCM_SERVICE_ACCOUNT a função responde 501 e nada é enviado.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { env, json } from '../_shared/util.ts';

type Account = { project_id: string; client_email: string; private_key: string; token_uri?: string };
type Push = { user: string; title: string; body: string; data: Record<string, string>; channel: string; tag?: string };

// canais criados pelo app (www/js/push.js): o jogador pode silenciar cada um nas configurações do Android
const SALAS = new Set(['sala', 'resultado']);
const GOLD = '#C9A24D';

function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const b64url = (b: Uint8Array | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...b)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// token de acesso do Google (vale 1 hora; guardado enquanto a função estiver quente)
let cached: { token: string; exp: number } | null = null;
async function accessToken(acc: Account) {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 120 > now) return cached.token;
  const aud = acc.token_uri ?? 'https://oauth2.googleapis.com/token';
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: acc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud, iat: now, exp: now + 3600 }));
  const pem = acc.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claims)));
  const r = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claims + '.' + b64url(sig) }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('Google recusou a conta de serviço: ' + (d.error_description ?? d.error ?? r.status));
  cached = { token: d.access_token, exp: now + Number(d.expires_in ?? 3600) };
  return cached.token;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
function strings(o: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined && v !== '') out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  return out;
}

async function fromNotifications(db: SupabaseClient, ids: number[]): Promise<Push[]> {
  const { data, error } = await db.from('notifications').select('id, user_id, kind, title, body, data').in('id', ids);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    user: n.user_id, title: cut(n.title, 120), body: cut(n.body ?? '', 400),
    data: strings({ ...(n.data ?? {}), kind: n.kind, nid: n.id }),
    channel: SALAS.has(n.kind) ? 'bh_salas' : 'bh_avisos',
  }));
}

async function fromMessages(db: SupabaseClient, ids: number[]): Promise<Push[]> {
  // o texto das conversas fica criptografado no banco: quem abre é a função svc_message_previews (só service_role)
  const { data, error } = await db.rpc('svc_message_previews', { p_ids: ids });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, string>>).map((m) => {
    const sala = m.thread_kind === 'sala';
    return {
      user: m.recipient_id,
      title: cut((m.sender_nick ?? 'Jogador') + (sala ? ' · sala' : ''), 120),
      body: m.body ? cut(m.body, 400) : m.media_kind === 'audio' ? '🎤 Mensagem de voz' : m.media_kind === 'foto' ? '📷 Foto' : 'Nova mensagem',
      data: strings({ kind: sala ? 'mensagem_sala' : 'mensagem', thread_id: m.thread_id, mid: m.id }),
      channel: 'bh_chat', tag: 'conversa-' + m.thread_id,
    };
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'use POST' }, 405);
    if (!sameSecret(req.headers.get('x-push-secret') ?? '', env('PUSH_SECRET'))) return json({ error: 'segredo inválido' }, 401);
    const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!raw) return json({ error: 'fcm_nao_configurado' }, 501);
    const acc = JSON.parse(raw) as Account;

    const body = await req.json().catch(() => ({}));
    const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 500) : []);
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

    const pushes = [
      ...(ids(body.notifications).length ? await fromNotifications(db, ids(body.notifications)) : []),
      ...(ids(body.messages).length ? await fromMessages(db, ids(body.messages)) : []),
    ];
    if (!pushes.length) return json({ ok: true, sent: 0 });

    const { data: toks, error } = await db.from('push_tokens').select('token, user_id').in('user_id', [...new Set(pushes.map((p) => p.user))]);
    if (error) throw error;
    const byUser = new Map<string, string[]>();
    for (const t of toks ?? []) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);
    const jobs = pushes.flatMap((p) => (byUser.get(p.user) ?? []).map((token) => ({ p, token })));
    if (!jobs.length) return json({ ok: true, sent: 0 });

    const access = await accessToken(acc);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`;
    const dead = new Set<string>();
    let sent = 0, failed = 0;
    // até 20 envios ao mesmo tempo
    for (let i = 0; i < jobs.length; i += 20) {
      await Promise.all(jobs.slice(i, i + 20).map(async ({ p, token }) => {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: p.title, body: p.body },
              data: p.data,
              android: {
                priority: 'HIGH',
                notification: { channel_id: p.channel, icon: 'ic_notificacao', color: GOLD, sound: 'default', ...(p.tag ? { tag: p.tag } : {}) },
              },
            },
          }),
        });
        if (r.ok) { sent++; return; }
        failed++;
        const e = await r.json().catch(() => ({}));
        const code = JSON.stringify(e?.error?.details ?? '') + (e?.error?.status ?? '');
        // aparelho desinstalou o app ou o token venceu: apaga para não tentar de novo
        if (r.status === 404 || /UNREGISTERED/.test(code) || (r.status === 400 && /registration token/i.test(e?.error?.message ?? ''))) dead.add(token);
      }));
    }
    if (dead.size) await db.from('push_tokens').delete().in('token', [...dead]);
    return json({ ok: true, sent, failed, removed: dead.size });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
