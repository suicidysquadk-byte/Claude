// Recebe os avisos do Mercado Pago. Não confia no conteúdo do aviso:
// confere a assinatura e busca o pagamento direto na API antes de creditar.
// Publique com verify_jwt desligado (o Mercado Pago não manda token do Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { env, json } from '../_shared/util.ts';

async function hmacHex(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function validSignature(req: Request, dataId: string) {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!secret) return true; // sem segredo configurado, a checagem na API abaixo ainda protege
  const header = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  return (await hmacHex(secret, manifest)) === parts.v1;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const type = body?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic');
    const dataId = String(body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');
    if (type !== 'payment' || !dataId) return json({ ok: true, ignored: true });
    if (!(await validSignature(req, dataId))) return json({ error: 'assinatura inválida' }, 401);

    const mp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}` },
    });
    if (!mp.ok) return json({ error: 'pagamento não encontrado no Mercado Pago' }, 502);
    const pay = await mp.json();

    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const { data, error } = await admin.rpc('svc_settle_deposit', {
      p_provider_id: String(pay.id), p_status: String(pay.status), p_amount_cents: Math.round(Number(pay.transaction_amount) * 100),
    });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
