// Gera um link de entrada para um testador (só a administração).
// Enquanto o SMTP próprio não estiver configurado, o e-mail padrão do Supabase só chega para a equipe do projeto;
// com este link a pessoa entra no app sem precisar do e-mail. Quem decide se pode é o banco (admin_invite_check).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, env, json } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = env('SUPABASE_URL');
    const userClient = createClient(url, env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const body = await req.json().catch(() => ({}));
    const { data: check, error: checkError } = await userClient.rpc('admin_invite_check', { p_email: String(body.email ?? '') });
    if (checkError || !check) return json({ error: checkError?.message ?? 'Sem permissão.' }, 403);

    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'));
    const scheme = Deno.env.get('APP_SCHEME') ?? 'gg.battlehub.app';
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: check.email, options: { redirectTo: `${scheme}://auth` } });
    if (error || !data?.properties?.action_link) return json({ error: error?.message ?? 'O servidor não gerou o link.' }, 400);
    return json({ email: check.email, link: data.properties.action_link, new_account: !check.exists });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
