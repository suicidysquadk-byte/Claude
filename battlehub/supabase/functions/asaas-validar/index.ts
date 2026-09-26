// Validação de saque do Asaas: antes de cada transferência sair da conta, o Asaas pergunta aqui.
// Só aprova transferência de um saque do BattleHub que está sendo enviado, com o mesmo valor e a mesma chave.
// Publique com verify_jwt desligado. Qualquer erro recusa a transferência.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { env, json, serviceDeps } from '../_shared/util.ts';
import { tokenOk, validateTransfer } from '../_shared/asaas.ts';

Deno.serve(async (req) => {
  try {
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const d = serviceDeps(admin);
    if (!tokenOk(d, req.headers.get('asaas-access-token'))) return json({ status: 'REFUSED', refuseReason: 'Token de validação inválido.' });
    const body = await req.json().catch(() => ({}));
    return json(await validateTransfer(d, body));
  } catch (e) {
    return json({ status: 'REFUSED', refuseReason: 'Erro ao conferir: ' + (e instanceof Error ? e.message : String(e)) });
  }
});
