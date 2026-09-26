// Envia pelo Asaas um saque que está "processando" (saque automático do jogador ou botão do painel).
// O jogador só pode mandar o próprio saque; a equipe (nível 2) pode mandar qualquer um.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, env, json, serviceDeps } from '../_shared/util.ts';
import { AsaasError, sendWithdrawal } from '../_shared/asaas.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!Deno.env.get('ASAAS_API_KEY')) return json({ error: 'asaas_nao_configurado' }, 501);
    const url = env('SUPABASE_URL');
    const userClient = createClient(url, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: me, error } = await userClient.rpc('me');
    if (error || !me) return json({ error: 'Entre na sua conta para continuar.' }, 401);
    const body = await req.json().catch(() => ({}));
    if (!body.id) return json({ error: 'Saque não informado.' }, 400);
    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'));
    return json(await sendWithdrawal(serviceDeps(admin), String(body.id), me.role_level >= 2 ? null : me.id));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, e instanceof AsaasError ? e.status : 500);
  }
});
