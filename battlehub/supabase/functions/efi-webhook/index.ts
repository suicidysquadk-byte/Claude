// Avisos do Efí (Pix recebido e Pix enviado). Publique com verify_jwt desligado.
// O token vai na própria URL cadastrada (?t=...); cada Pix é conferido direto na API do Efí antes de mexer em saldo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { env, json, serviceDeps } from '../_shared/util.ts';
import { handleWebhook, registerWebhook, tokenOk } from '../_shared/efi.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const d = serviceDeps(admin);
  if (!tokenOk(d, url.searchParams.get('t'))) return json({ error: 'token inválido' }, 401);
  try {
    // ?registrar=1 cadastra este endereço no Efí (usado pelo script de configuração)
    if (url.searchParams.get('registrar') === '1') return json(await registerWebhook(d, `${env('SUPABASE_URL')}/functions/v1/efi-webhook`));
    const body = await req.json().catch(() => ({}));
    return json(await handleWebhook(d, body));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
