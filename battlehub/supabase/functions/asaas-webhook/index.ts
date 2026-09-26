// Avisos do Asaas (cobrança paga, transferência concluída ou falha). Publique com verify_jwt desligado.
// Confere o token do cabeçalho asaas-access-token e consulta a cobrança/transferência direto na API antes de mexer em saldo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { env, json, serviceDeps } from '../_shared/util.ts';
import { handleWebhook, tokenOk } from '../_shared/asaas.ts';

Deno.serve(async (req) => {
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const d = serviceDeps(admin);
  if (!tokenOk(d, req.headers.get('asaas-access-token'))) return json({ error: 'token inválido' }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    return json(await handleWebhook(d, body));
  } catch (e) {
    // erro devolve 500: o Asaas tenta de novo depois
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
