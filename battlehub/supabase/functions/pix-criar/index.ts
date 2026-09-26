// Gera um Pix no Mercado Pago para o jogador logado adicionar saldo.
// O saldo só entra quando o pix-webhook confirmar o pagamento.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, env, json, mpDate } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = Deno.env.get('MP_ACCESS_TOKEN');
    if (!token) return json({ error: 'mp_nao_configurado' }, 501);

    const url = env('SUPABASE_URL');
    const userClient = createClient(url, env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth?.user) return json({ error: 'Entre na sua conta para continuar.' }, 401);
    const user = auth.user;

    const { data: me, error: meError } = await userClient.rpc('me');
    if (meError || !me) return json({ error: 'Perfil não encontrado.' }, 400);
    if (me.banned) return json({ error: 'Conta suspensa.' }, 403);

    const body = await req.json().catch(() => ({}));
    const cents = Math.round(Number(body.amount_cents));
    const s = me.settings;
    if (!Number.isFinite(cents) || cents < s.min_deposit_cents || cents > s.max_deposit_cents) {
      return json({ error: `O depósito vai de R$ ${(s.min_deposit_cents / 100).toFixed(2).replace('.', ',')} a R$ ${(s.max_deposit_cents / 100).toFixed(2).replace('.', ',')}.` }, 400);
    }

    const expiresMs = Date.now() + 30 * 60e3;
    const mp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        transaction_amount: cents / 100,
        description: 'Saldo BattleHub',
        payment_method_id: 'pix',
        payer: { email: user.email },
        external_reference: user.id,
        notification_url: `${url}/functions/v1/pix-webhook`,
        date_of_expiration: mpDate(expiresMs),
      }),
    });
    const pay = await mp.json();
    if (!mp.ok) return json({ error: 'O Mercado Pago recusou o Pix: ' + (pay?.message ?? mp.status) }, 502);
    const tx = pay.point_of_interaction?.transaction_data;
    if (!tx?.qr_code) return json({ error: 'O Mercado Pago não devolveu o QR Code.' }, 502);

    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'));
    const { data, error } = await admin.rpc('svc_create_deposit', {
      p_user: user.id, p_cents: cents, p_provider_id: String(pay.id),
      p_qr: tx.qr_code, p_qr64: tx.qr_code_base64 ?? null, p_expires: new Date(expiresMs).toISOString(),
    });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
