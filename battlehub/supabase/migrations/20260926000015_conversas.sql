-- BattleHub: conversas protegidas, foto e áudio privados, acesso excepcional da equipe e registro de acesso
-- 1) O texto das mensagens fica criptografado no banco (pgcrypto, AES-256). A chave fica no Supabase Vault
--    (fora dos backups do banco); sem o Vault, numa tabela que o app não enxerga. Só quem mandou e quem recebeu
--    leem, pelas funções. O painel do Supabase e o tempo real só mostram o texto embaralhado.
-- 2) Foto e áudio das conversas vão para o balde privado "conversas" (migração 16): só os dois da conversa abrem.
-- 3) Acesso excepcional da equipe: só com motivo (denúncia, ordem judicial ou segurança), vale 24 horas e fica
--    registrado para sempre. Moderador só abre conversa de quem tem denúncia; ordem judicial e exportação
--    completa só o dono.
-- 4) Registro de acesso ao app (data, hora, IP e aparelho), guardado por 6 meses como pede o Marco Civil da
--    Internet (Lei 12.965/2014, art. 15).

-- ================================================================ chave
create table app.chat_secret (id int primary key default 1 check (id = 1), k text not null);
revoke all on app.chat_secret from public, anon, authenticated;

do $$
declare v text := encode(gen_random_bytes(32), 'hex');
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    begin
      execute 'select 1 from vault.secrets where name = ''bh_chat_key''';
      if not found then
        execute 'select vault.create_secret($1, ''bh_chat_key'', ''Chave das conversas do BattleHub'')' using v;
      end if;
      return;
    exception when others then
      raise notice 'Vault indisponível (%): a chave fica em app.chat_secret', sqlerrm;
    end;
  end if;
  insert into app.chat_secret (k) values (v) on conflict (id) do nothing;
end $$;

create or replace function app.chat_key() returns text
language plpgsql stable security definer set search_path = public, app, extensions as $$
declare v text;
begin
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''bh_chat_key'' limit 1' into v;
  exception when others then v := null;
  end;
  if v is null then select k into v from app.chat_secret where id = 1; end if;
  if v is null then raise exception 'Chave das conversas não configurada.'; end if;
  return v;
end $$;

create or replace function app.chat_enc(p_text text, p_key text) returns bytea
language sql immutable set search_path = public, app, extensions as $$
  select pgp_sym_encrypt(p_text, p_key, 'cipher-algo=aes256, s2k-mode=1')
$$;
create or replace function app.chat_dec(p_data bytea, p_key text) returns text
language plpgsql immutable set search_path = public, app, extensions as $$
begin
  return pgp_sym_decrypt(p_data, p_key);
exception when others then
  return '[mensagem ilegível]';
end $$;

-- ================================================================ mensagens: texto criptografado, foto e áudio
alter table public.messages
  add column body_enc bytea,
  add column media_path text,
  add column media_kind text check (media_kind in ('foto', 'audio')),
  add column audio_ms int;

-- todo texto novo entra criptografado, venha de onde vier
create or replace function app.messages_encrypt() returns trigger
language plpgsql security definer set search_path = public, app, extensions as $$
begin
  if coalesce(new.body, '') <> '' then
    new.body_enc := app.chat_enc(new.body, app.chat_key());
    new.body := '';
  end if;
  return new;
end $$;
create trigger messages_encrypt before insert or update of body on public.messages
  for each row execute function app.messages_encrypt();

-- mensagens que já existiam
update public.messages set body = body where body <> '';

-- texto de uma mensagem (antigas sem criptografia continuam legíveis)
create or replace function app.msg_text(p_enc bytea, p_body text, p_key text) returns text
language sql immutable set search_path = public, app, extensions as $$
  select case when p_enc is not null then app.chat_dec(p_enc, p_key) else coalesce(p_body, '') end
$$;

create or replace function app.in_thread(p_thread uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.threads where id = p_thread and p_user in (user_a, user_b))
$$;

-- ================================================================ acesso excepcional (equipe)
create table public.chat_access (
  id bigserial primary key,
  thread_id uuid not null,
  user_a uuid not null,
  user_b uuid not null,
  by_id uuid not null,
  kind text not null check (kind in ('denuncia', 'ordem_judicial', 'seguranca')),
  reference text not null default '',
  reason text not null,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index chat_access_thread on public.chat_access (thread_id, by_id, expires_at desc);
-- ninguém lê, muda ou apaga direto: só pelas funções, e nenhuma função apaga
alter table public.chat_access enable row level security;

create or replace function app.chat_can_read(p_thread uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.in_thread(p_thread, p_user)
      or exists (select 1 from public.chat_access where thread_id = p_thread and by_id = p_user and expires_at > now())
$$;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;

-- ================================================================ registro de acesso (Marco Civil, art. 15)
create table public.access_log (
  id bigserial primary key,
  user_id uuid not null,
  ip text,
  device text,
  created_at timestamptz not null default now()
);
create index access_log_user on public.access_log (user_id, created_at desc);
create index access_log_time on public.access_log (created_at);
alter table public.access_log enable row level security;

-- IP de quem chamou (o Supabase repassa os cabeçalhos da requisição)
create or replace function app.request_ip() returns text language plpgsql stable as $$
declare h jsonb;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  if h is null then return null; end if;
  return left(btrim(split_part(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip', h ->> 'x-forwarded-for', ''), ',', 1)), 64);
end $$;

-- ================================================================ API: conversas
create or replace function public.thread_messages(p_thread uuid, p_before bigint default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.threads; v_other uuid; k text := app.chat_key();
begin
  me := app.require_user();
  select * into t from public.threads where id = p_thread and (user_a = me.id or user_b = me.id);
  if not found then perform app.fail('Conversa não encontrada.'); end if;
  v_other := case when t.user_a = me.id then t.user_b else t.user_a end;
  update public.messages set read_at = now() where thread_id = t.id and recipient_id = me.id and read_at is null;
  return jsonb_build_object('thread', jsonb_build_object('id', t.id, 'kind', t.kind,
       'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title) from public.rooms r where r.id = t.room_id)),
    'other', app.user_card(v_other) || jsonb_build_object('online', (select last_seen_at > now() - interval '5 minutes' from public.profiles where id = v_other), 'friend', app.friend_status(v_other)),
    'more', (select count(*) > 60 from (select 1 from public.messages m where m.thread_id = t.id and (p_before is null or m.id < p_before) limit 61) c),
    'messages', coalesce((select jsonb_agg(x order by (x ->> 'id')::bigint) from (
       select jsonb_build_object('id', m.id, 'body', app.msg_text(m.body_enc, m.body, k), 'image_url', m.image_url,
                'media_path', m.media_path, 'media_kind', m.media_kind, 'audio_ms', m.audio_ms,
                'mine', m.sender_id = me.id, 'created_at', m.created_at, 'read', m.read_at is not null) x
         from public.messages m where m.thread_id = t.id and (p_before is null or m.id < p_before) order by m.id desc limit 60) q), '[]'));
end $$;

create or replace function public.my_threads(p_kind text default 'privado') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; k text := app.chat_key();
begin
  me := app.require_user();
  return coalesce((select jsonb_agg(x order by x ->> 'last_at' desc) from (
    select jsonb_build_object('id', t.id, 'kind', t.kind, 'last_at', t.last_message_at,
       'other', app.user_card(case when t.user_a = me.id then t.user_b else t.user_a end)
               || jsonb_build_object('online', (select last_seen_at > now() - interval '5 minutes' from public.profiles where id = case when t.user_a = me.id then t.user_b else t.user_a end)),
       'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title) from public.rooms r where r.id = t.room_id),
       'last', (select jsonb_build_object('body', app.msg_text(m.body_enc, m.body, k), 'image', m.image_url is not null or m.media_kind = 'foto',
                  'audio', m.media_kind = 'audio', 'mine', m.sender_id = me.id, 'at', m.created_at)
                  from public.messages m where m.thread_id = t.id order by m.id desc limit 1),
       'unread', (select count(*) from public.messages m where m.thread_id = t.id and m.recipient_id = me.id and m.read_at is null)) x
      from public.threads t where (t.user_a = me.id or t.user_b = me.id) and t.kind = p_kind
       and exists (select 1 from public.messages m where m.thread_id = t.id)) q), '[]');
end $$;

-- foto ou áudio: o arquivo já foi enviado para conversas/<quem manda>/<conversa>/<arquivo>
create or replace function public.send_media(p_thread uuid, p_path text, p_kind text, p_ms int default null, p_body text default '') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.threads; v_to uuid; v_id bigint;
begin
  me := app.require_user();
  select * into t from public.threads where id = p_thread and (user_a = me.id or user_b = me.id);
  if not found then perform app.fail('Conversa não encontrada.'); end if;
  if p_kind not in ('foto', 'audio') then perform app.fail('Tipo de arquivo inválido.'); end if;
  if coalesce(p_path, '') !~ ('^' || me.id::text || '/' || t.id::text || '/[A-Za-z0-9._-]{1,80}$') then perform app.fail('Arquivo inválido.'); end if;
  if p_kind = 'audio' and (p_ms is null or p_ms < 500 or p_ms > 180000) then perform app.fail('O áudio precisa ter entre meio segundo e 3 minutos.'); end if;
  v_to := case when t.user_a = me.id then t.user_b else t.user_a end;
  insert into public.messages (thread_id, sender_id, recipient_id, body, media_path, media_kind, audio_ms)
  values (t.id, me.id, v_to, app.mask_text(left(btrim(coalesce(p_body, '')), 2000)), p_path, p_kind, case when p_kind = 'audio' then p_ms end)
  returning id into v_id;
  update public.threads set last_message_at = now() where id = t.id;
  return jsonb_build_object('id', v_id, 'thread_id', t.id);
end $$;

-- texto de uma mensagem para o balão no topo (só quem está na conversa)
create or replace function public.message_preview(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; m public.messages;
begin
  me := app.require_user();
  select * into m from public.messages where id = p_id and (sender_id = me.id or recipient_id = me.id);
  if not found then perform app.fail('Mensagem não encontrada.'); end if;
  return jsonb_build_object('id', m.id, 'thread_id', m.thread_id, 'sender_id', m.sender_id,
    'body', app.msg_text(m.body_enc, m.body, app.chat_key()), 'media_kind', coalesce(m.media_kind, case when m.image_url is not null then 'foto' end));
end $$;

-- para a função push-enviar (service_role): texto das mensagens novas
create or replace function public.svc_message_previews(p_ids bigint[]) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare k text := app.chat_key();
begin
  -- só a service_role executa (grants no fim do arquivo)
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'thread_id', m.thread_id, 'sender_id', m.sender_id, 'recipient_id', m.recipient_id,
      'body', app.msg_text(m.body_enc, m.body, k), 'media_kind', coalesce(m.media_kind, case when m.image_url is not null then 'foto' end),
      'thread_kind', t.kind, 'sender_nick', p.nick))
    from public.messages m join public.threads t on t.id = m.thread_id left join public.profiles p on p.id = m.sender_id
   where m.id = any (p_ids)), '[]');
end $$;

-- ================================================================ API: acesso excepcional
-- conversas de um jogador (sem conteúdo): com quem, quantas mensagens e quando
create or replace function public.admin_user_threads(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_level(1);
  return coalesce((select jsonb_agg(x order by x ->> 'last_at' desc) from (
    select jsonb_build_object('id', t.id, 'kind', t.kind, 'last_at', t.last_message_at, 'created_at', t.created_at,
       'other', app.user_card(case when t.user_a = p_user then t.user_b else t.user_a end),
       'count', (select count(*) from public.messages m where m.thread_id = t.id),
       'reports', (select count(*) from public.reports r where r.target_id in (t.user_a, t.user_b) or r.reporter_id in (t.user_a, t.user_b)),
       'open_until', (select max(expires_at) from public.chat_access a where a.thread_id = t.id and a.by_id = me.id and a.expires_at > now())) x
      from public.threads t where p_user in (t.user_a, t.user_b) and exists (select 1 from public.messages m where m.thread_id = t.id)) q), '[]');
end $$;

create or replace function public.admin_chat_open(p_thread uuid, p_kind text, p_reference text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.threads; lv int; top int; a public.chat_access;
begin
  me := app.require_level(1);
  lv := app.role_level(me.role);
  select * into t from public.threads where id = p_thread;
  if not found then perform app.fail('Conversa não encontrada.'); end if;
  if coalesce(p_kind, '') not in ('denuncia', 'ordem_judicial', 'seguranca') then perform app.fail('Escolha o motivo do acesso.'); end if;
  if length(btrim(coalesce(p_reason, ''))) < 15 then perform app.fail('Explique o motivo com pelo menos 15 letras.'); end if;
  if p_kind = 'ordem_judicial' and lv < 3 then perform app.fail('Só o dono abre conversa por ordem judicial.'); end if;
  if p_kind = 'ordem_judicial' and length(btrim(coalesce(p_reference, ''))) < 5 then perform app.fail('Informe o número do processo ou do ofício.'); end if;
  if p_kind = 'seguranca' and lv < 2 then perform app.fail('Só admin ou dono abre conversa por segurança.'); end if;
  -- ninguém lê conversa de quem tem cargo igual ou maior (o dono lê todas)
  select max(app.role_level(role)) into top from public.profiles where id in (t.user_a, t.user_b) and id <> me.id;
  if lv < 3 and coalesce(top, 0) >= lv then perform app.fail('Você não pode abrir conversa de alguém da equipe com cargo igual ou maior.'); end if;
  if p_kind = 'denuncia' and not exists (select 1 from public.reports r where r.target_id in (t.user_a, t.user_b) or r.reporter_id in (t.user_a, t.user_b)) then
    perform app.fail('Não há denúncia envolvendo esta conversa.');
  end if;
  insert into public.chat_access (thread_id, user_a, user_b, by_id, kind, reference, reason, expires_at)
  values (t.id, t.user_a, t.user_b, me.id, p_kind, left(btrim(coalesce(p_reference, '')), 120), left(btrim(p_reason), 600), now() + interval '24 hours')
  returning * into a;
  perform app.log('Abriu conversa (acesso excepcional)', t.id::text,
    (select string_agg(coalesce(nick, '?') || ' #' || code, ' e ') from public.profiles where id in (t.user_a, t.user_b)) || ' · ' || p_kind || coalesce(' ' || nullif(a.reference, ''), '') || ' · ' || a.reason);
  return jsonb_build_object('id', a.id, 'expires_at', a.expires_at);
end $$;

create or replace function public.admin_chat_read(p_thread uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.threads; k text; a public.chat_access;
begin
  me := app.require_level(1);
  select * into a from public.chat_access where thread_id = p_thread and by_id = me.id and expires_at > now() order by id desc limit 1;
  if not found then perform app.fail('Abra a conversa com o motivo antes (o acesso vale 24 horas).'); end if;
  select * into t from public.threads where id = p_thread;
  k := app.chat_key();
  return jsonb_build_object('thread', jsonb_build_object('id', t.id, 'kind', t.kind, 'created_at', t.created_at),
    'access', jsonb_build_object('kind', a.kind, 'reference', a.reference, 'reason', a.reason, 'expires_at', a.expires_at),
    'a', app.user_card(t.user_a), 'b', app.user_card(t.user_b),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender_id, 'body', app.msg_text(m.body_enc, m.body, k),
        'image_url', m.image_url, 'media_path', m.media_path, 'media_kind', m.media_kind, 'audio_ms', m.audio_ms,
        'created_at', m.created_at, 'read_at', m.read_at) order by m.id)
      from (select * from public.messages where thread_id = t.id order by id desc limit 2000) m), '[]'));
end $$;

-- exportação completa para entregar a quem pediu (ordem judicial): só o dono, com resumo SHA-256
create or replace function public.admin_chat_export(p_thread uuid) returns jsonb
language plpgsql security definer set search_path = public, app, extensions as $$
declare me public.profiles; t public.threads; k text; a public.chat_access; v_lines text; ua public.profiles; ub public.profiles;
begin
  me := app.require_level(3);
  select * into a from public.chat_access where thread_id = p_thread and by_id = me.id and expires_at > now() order by id desc limit 1;
  if not found then perform app.fail('Abra a conversa com o motivo antes (o acesso vale 24 horas).'); end if;
  select * into t from public.threads where id = p_thread;
  select * into ua from public.profiles where id = t.user_a;
  select * into ub from public.profiles where id = t.user_b;
  k := app.chat_key();
  select string_agg(to_char(m.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') || ' · ' ||
           case when m.sender_id = t.user_a then coalesce(ua.nick, '?') || ' #' || ua.code else coalesce(ub.nick, '?') || ' #' || ub.code end || ': ' ||
           case when m.media_kind = 'audio' then '[áudio ' || round(coalesce(m.audio_ms, 0) / 1000.0) || 's: ' || m.media_path || '] ' when m.media_kind = 'foto' then '[foto: ' || m.media_path || '] ' when m.image_url is not null then '[foto: ' || m.image_url || '] ' else '' end ||
           app.msg_text(m.body_enc, m.body, k), E'\n' order by m.id)
    into v_lines from public.messages m where m.thread_id = t.id;
  v_lines := 'BattleHub · exportação de conversa' || E'\n' ||
    'Conversa: ' || t.id || ' (' || t.kind || '), criada em ' || to_char(t.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || E'\n' ||
    'Participante A: ' || coalesce(ua.nick, '?') || ' #' || coalesce(ua.code::text, '?') || ' · Free Fire ' || coalesce(ua.ff_id, '-') || ' · ' || coalesce((select email from auth.users where id = t.user_a), '-') || E'\n' ||
    'Participante B: ' || coalesce(ub.nick, '?') || ' #' || coalesce(ub.code::text, '?') || ' · Free Fire ' || coalesce(ub.ff_id, '-') || ' · ' || coalesce((select email from auth.users where id = t.user_b), '-') || E'\n' ||
    'Motivo do acesso: ' || a.kind || coalesce(' ' || nullif(a.reference, ''), '') || ' · ' || a.reason || E'\n' ||
    'Gerado por: ' || coalesce(me.nick, '?') || ' #' || me.code || ' em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') || ' (horário de Brasília)' || E'\n' ||
    repeat('-', 60) || E'\n' || coalesce(v_lines, '(sem mensagens)') || E'\n';
  update public.chat_access set exported_at = now() where id = a.id;
  perform app.log('Exportou conversa', t.id::text, a.kind || coalesce(' ' || nullif(a.reference, ''), ''));
  return jsonb_build_object('text', v_lines, 'sha256', encode(digest(convert_to(v_lines, 'UTF8'), 'sha256'), 'hex'),
    'filename', 'conversa-' || left(t.id::text, 8) || '-' || to_char(now(), 'YYYYMMDD-HH24MI') || '.txt');
end $$;

-- quem abriu quais conversas (admin e dono)
create or replace function public.admin_chat_access_log() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'thread_id', a.thread_id, 'kind', a.kind, 'reference', a.reference, 'reason', a.reason,
      'created_at', a.created_at, 'expires_at', a.expires_at, 'exported_at', a.exported_at,
      'by', app.user_card(a.by_id), 'a', app.user_card(a.user_a), 'b', app.user_card(a.user_b)) order by a.id desc)
    from (select * from public.chat_access order by id desc limit 200) a), '[]');
end $$;

-- ================================================================ API: registro de acesso
-- set_device (migração 12) passa a gravar o acesso: o app chama ao abrir
create or replace function public.set_device(p_device text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v text := left(btrim(coalesce(p_device, '')), 80); b public.blocklist;
begin
  me := app.require_user();
  insert into public.access_log (user_id, ip, device) values (me.id, app.request_ip(), nullif(v, ''));
  -- guarda 6 meses (com folga de 1 mês); o resto sai aos poucos
  delete from public.access_log where id in (select id from public.access_log where created_at < now() - interval '7 months' order by created_at limit 500);
  if v = '' then return jsonb_build_object('ok', true); end if;
  update public.profiles set device_id = v where id = me.id;
  select * into b from public.blocklist where kind = 'device' and value = v;
  if found and app.role_level(me.role) = 0 then
    update public.profiles set banned_until = 'infinity', ban_reason = 'Aparelho bloqueado por trapaça' where id = me.id;
    insert into public.bans (user_id, until, reason) values (me.id, null, 'Aparelho bloqueado por trapaça (' || b.reason || ')');
    return jsonb_build_object('ok', false, 'banned', true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_access_log(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return coalesce((select jsonb_agg(jsonb_build_object('at', l.created_at, 'ip', l.ip, 'device', l.device) order by l.id desc)
    from (select * from public.access_log where user_id = p_user order by id desc limit 200) l), '[]');
end $$;

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.svc_message_previews(bigint[]) from authenticated;
grant execute on function public.clear_push_token(text) to anon;
