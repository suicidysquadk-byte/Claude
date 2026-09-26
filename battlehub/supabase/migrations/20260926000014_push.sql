-- BattleHub: notificação no celular (Firebase Cloud Messaging)
-- O app guarda o token do aparelho em push_tokens. Cada aviso (notifications) e cada mensagem (messages) novos
-- chamam a função push-enviar pelo pg_net, que manda para o Firebase. A chamada sai só depois que a transação
-- confirma (o pg_net envia a fila depois do commit), então aviso de transação desfeita nunca chega.
-- Sem configuração (app.push_config vazia) ou sem pg_net, nada é enviado e nada quebra.

do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponível: notificação no celular desligada neste banco';
end $$;

-- ---------------------------------------------------------------- tokens dos aparelhos
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);
-- ninguém lê ou escreve direto: só pelas funções abaixo e pela função push-enviar (service_role)
alter table public.push_tokens enable row level security;

-- endereço da função e segredo compartilhado (gravados por scripts/configurar.sh)
create table app.push_config (
  id int primary key default 1 check (id = 1),
  url text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);
revoke all on app.push_config from public, anon, authenticated;

-- o app manda o token ao entrar; aparelho que troca de conta passa a receber só da conta nova
create or replace function public.set_push_token(p_token text, p_platform text default 'android') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v text := btrim(coalesce(p_token, ''));
begin
  me := app.require_user();
  if v = '' or length(v) > 4096 then perform app.fail('Token de notificação inválido.'); end if;
  if coalesce(p_platform, 'android') not in ('android', 'web') then perform app.fail('Plataforma inválida.'); end if;
  insert into public.push_tokens (token, user_id, platform) values (v, me.id, coalesce(p_platform, 'android'))
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- no máximo 5 aparelhos por conta: os mais antigos saem
  delete from public.push_tokens where user_id = me.id and token in (
    select token from public.push_tokens where user_id = me.id order by updated_at desc offset 5);
  return jsonb_build_object('ok', true);
end $$;

-- ao sair da conta ou desligar a notificação no app. Sem login também funciona (sessão vencida), mas só apaga o
-- token informado, que só o próprio aparelho conhece.
create or replace function public.clear_push_token(p_token text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  delete from public.push_tokens where token = btrim(coalesce(p_token, ''))
    and (auth.uid() is null or user_id = auth.uid());
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- envio
-- chama a função push-enviar com os ids novos (em lotes de 500). Nunca derruba a transação de quem avisou.
create or replace function app.push_dispatch(p_kind text, p_ids bigint[]) returns void
language plpgsql security definer set search_path = public, app as $$
declare c app.push_config; i int := 1; n int := coalesce(array_length(p_ids, 1), 0);
begin
  if n = 0 then return; end if;
  select * into c from app.push_config where id = 1;
  if not found then return; end if;
  -- só vale a pena chamar se algum destinatário tem aparelho cadastrado
  if p_kind = 'notifications' then
    if not exists (select 1 from public.notifications x join public.push_tokens t on t.user_id = x.user_id where x.id = any (p_ids)) then return; end if;
  else
    if not exists (select 1 from public.messages x join public.push_tokens t on t.user_id = x.recipient_id where x.id = any (p_ids)) then return; end if;
  end if;
  while i <= n loop
    begin
      perform net.http_post(
        url := c.url,
        body := jsonb_build_object(p_kind, to_jsonb(p_ids[i:i + 499])),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.secret),
        timeout_milliseconds := 10000
      );
    exception when others then
      raise warning 'push não enfileirado: %', sqlerrm;
      return;
    end;
    i := i + 500;
  end loop;
end $$;

create or replace function app.push_on_notifications() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.push_dispatch('notifications', (select array_agg(id order by id) from novas));
  return null;
end $$;

create or replace function app.push_on_messages() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.push_dispatch('messages', (select array_agg(id order by id) from novas));
  return null;
end $$;

-- uma chamada por comando (um aviso para todos os jogadores sai num lote só)
create trigger push_notifications after insert on public.notifications
  referencing new table as novas for each statement execute function app.push_on_notifications();
create trigger push_messages after insert on public.messages
  referencing new table as novas for each statement execute function app.push_on_messages();

revoke all on all functions in schema app from public;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- clear_push_token roda também com a sessão vencida (anon), para o aparelho parar de receber ao sair
grant execute on function public.clear_push_token(text) to anon;
