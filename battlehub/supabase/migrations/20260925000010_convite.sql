-- BattleHub: convite de testador.
-- Enquanto o e-mail próprio (SMTP) não estiver ligado, o e-mail padrão do Supabase só chega para a equipe do projeto.
-- A administração gera um link de entrada (função convite) e manda para a pessoa pelo WhatsApp.
-- Segurança: o link só é gerado para quem ainda não entrou no app, então ninguém da equipe consegue entrar na conta de um jogador.
create or replace function public.admin_invite_check(p_email text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_exists boolean; v_signed boolean;
begin
  perform app.require_level(2);
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then perform app.fail('E-mail inválido.'); end if;
  select true, u.last_sign_in_at is not null into v_exists, v_signed from auth.users u where lower(u.email) = v_email;
  if coalesce(v_signed, false) then
    perform app.fail('Essa pessoa já entrou no app. Por segurança o convite só vale para quem ainda não tem conta ativa; ela entra pelo e-mail normalmente.');
  end if;
  perform app.log('Gerou convite de testador', v_email);
  return jsonb_build_object('email', v_email, 'exists', coalesce(v_exists, false));
end $$;

revoke execute on function public.admin_invite_check(text) from public, anon;
grant execute on function public.admin_invite_check(text) to authenticated, service_role;
