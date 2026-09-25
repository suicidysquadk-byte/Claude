-- BattleHub: moderação e anti-trapaça.
-- 1) Palavras proibidas no nick, na bio e nas guildas (e sem link ou telefone na bio, que é por onde entra golpe).
--    No chat as palavras viram asteriscos.
-- 2) Foto de perfil nova só aparece para os outros depois que a equipe aprova.
-- 3) Análise de partida: a equipe chama o suspeito, os saques dele ficam pausados, ele manda o vídeo da partida,
--    a equipe pode abrir uma chamada de voz com compartilhamento de tela e marca quem ele matou (prejudicados).
-- 4) Trapaça confirmada: os prejudicados (ou todos da sala) recebem a inscrição de volta, o saldo do trapaceiro fica
--    retido, a conta é banida para sempre e o ID do Free Fire, as chaves Pix e o aparelho entram na lista de bloqueio.

-- ======================================================================== 1) palavras proibidas
create table if not exists public.banned_words (
  word text primary key,
  created_at timestamptz not null default now()
);
alter table public.banned_words enable row level security;

insert into public.banned_words (word) values
  ('porra'), ('caralho'), ('krl'), ('buceta'), ('boceta'), ('xoxota'), ('xota'), ('piroca'), ('pau no cu'), ('cu'), ('cuzao'),
  ('arrombado'), ('arrombada'), ('puta'), ('putaria'), ('fdp'), ('filho da puta'), ('vsf'), ('vai se foder'), ('foder'), ('fuder'),
  ('fodase'), ('foda se'), ('punheta'), ('siririca'), ('boquete'), ('corno'), ('vagabunda'), ('vadia'), ('piranha'), ('viado'),
  ('veado'), ('viadinho'), ('bicha'), ('traveco'), ('sapatao'), ('retardado'), ('mongoloide'), ('nazista'), ('hitler'), ('estupro'),
  ('estuprador'), ('pedofilo'), ('nudes'), ('onlyfans'), ('xvideos'), ('pornhub'), ('porno'),
  ('mod menu'), ('modmenu'), ('aimbot'), ('regedit'), ('auxilio de mira'), ('painel hs'), ('hack ff'), ('vendo hack'), ('vendo painel')
on conflict do nothing;

-- texto normalizado para comparar: minúsculo, sem acento, 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s !→i (só no meio da palavra),
-- letras repetidas juntas
create or replace function app.norm_text(p text) returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             translate(lower(regexp_replace(coalesce(p, ''), '[!|]+(?![[:alnum:]])', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüçñ013457@$!|', 'aaaaaeeeeiiiiooooouuuucnoieastasii'),
             '[^a-z0-9]+', ' ', 'g'),
           '([a-z])\1{2,}', '\1', 'g')
$$;

create or replace function app.bad_word(p text) returns text language sql stable security definer set search_path = public, app as $$
  select w.word from public.banned_words w
   where (' ' || app.norm_text(p) || ' ') like '% ' || app.norm_text(w.word) || ' %'
   order by length(w.word) desc limit 1
$$;

create or replace function app.check_text(p text, p_what text) returns void
language plpgsql stable security definer set search_path = public, app as $$
declare v text := app.bad_word(p);
begin
  if v is not null then
    perform app.fail(p_what || ' tem uma palavra que não é permitida no BattleHub (' || left(v, 1) || repeat('*', greatest(length(v) - 1, 1))
      || '). Tire e tente de novo.');
  end if;
end $$;

-- bio: sem palavrão, sem link e sem número de celular (golpe de "chama no zap")
create or replace function app.check_bio(p text) returns void
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.check_text(p, 'A bio');
  if coalesce(p, '') ~* '(https?://|www\.|wa\.me|t\.me/|bit\.ly|discord\.gg|chat\.whatsapp|[a-z0-9-]+\.(com|net|org|gg|io|me|xyz|site|store|shop)(\.br)?(/|\s|$))' then
    perform app.fail('A bio não pode ter links. Isso protege os jogadores de golpes.');
  end if;
  if regexp_replace(coalesce(p, ''), '[\s().+-]', '', 'g') ~ '(^|[^0-9])(55)?[1-9][0-9]9[0-9]{8}([^0-9]|$)' then
    perform app.fail('A bio não pode ter número de telefone. Isso protege os jogadores de golpes.');
  end if;
end $$;

-- chat: palavra proibida vira asterisco (a mensagem continua indo). Pega também "p0rr4", "caraaalho" e acentos.
create or replace function app.mask_text(p text) returns text
language plpgsql stable security definer set search_path = public, app as $$
declare v text := coalesce(p, ''); w record;
begin
  if app.bad_word(v) is null then return v; end if;
  -- palavra por palavra (compara a forma normalizada)
  select coalesce(string_agg(m[1] || case when exists (select 1 from public.banned_words b where position(' ' in b.word) = 0
                                                   and app.norm_text(b.word) = btrim(app.norm_text(m[2])))
                                       then repeat('*', char_length(regexp_replace(m[2], '[^[:alnum:]]+$', ''))) || coalesce(substring(m[2] from '[^[:alnum:]]+$'), '') else m[2] end, '' order by n), '') || coalesce(substring(v from '\s+$'), '')
    into v from regexp_matches(v, '(\s*)(\S+)', 'g') with ordinality x(m, n);
  -- expressões com mais de uma palavra
  for w in select word from public.banned_words where position(' ' in word) > 0 order by length(word) desc loop
    v := regexp_replace(v, '\m' || replace(regexp_replace(w.word, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'), ' ', '\s+') || '\M', repeat('*', length(w.word)), 'gi');
  end loop;
  return v;
end $$;

create or replace function app.check_nick(p_nick text, p_self uuid) returns text language plpgsql stable security definer set search_path = public, app as $$
declare v text := btrim(coalesce(p_nick, ''));
begin
  if length(v) < 3 or length(v) > 20 then perform app.fail('O nickname precisa ter de 3 a 20 caracteres.'); end if;
  if v !~ '^[[:alnum:] ._\-•]+$' then perform app.fail('Use só letras, números, espaço, ponto, traço ou sublinhado no nickname.'); end if;
  perform app.check_text(v, 'O nickname');
  if exists (select 1 from public.profiles where lower(nick) = lower(v) and id <> p_self) then perform app.fail('Esse nickname já está em uso.'); end if;
  return v;
end $$;

-- lista editável pela administração
create or replace function public.admin_banned_words() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(word order by word) from public.banned_words), '[]');
end $$;

create or replace function public.admin_banned_words_set(p_words jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_n int;
begin
  perform app.require_level(2);
  delete from public.banned_words;
  insert into public.banned_words (word)
    select distinct lower(btrim(w)) from jsonb_array_elements_text(coalesce(p_words, '[]')) w where length(btrim(w)) >= 2 on conflict do nothing;
  get diagnostics v_n = row_count;
  perform app.log('Alterou palavras proibidas', v_n || ' palavras');
  return public.admin_banned_words();
end $$;

-- ======================================================================== 2) foto de perfil com aprovação
alter table public.profiles
  add column if not exists avatar_pending text,
  add column if not exists avatar_pending_at timestamptz,
  add column if not exists device_id text;

create or replace function public.update_profile(p_nick text, p_bio text, p_avatar_url text, p_anonymous boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles; v_bio text := left(btrim(coalesce(p_bio, '')), 160); v_av text := nullif(btrim(coalesce(p_avatar_url, '')), '');
begin
  p := app.require_user();
  perform app.check_bio(v_bio);
  update public.profiles set nick = app.check_nick(p_nick, p.id), bio = v_bio, anonymous = coalesce(p_anonymous, false) where id = p.id;
  if v_av is null then
    update public.profiles set avatar_url = null, avatar_pending = null, avatar_pending_at = null where id = p.id;
  elsif v_av is distinct from p.avatar_url and v_av is distinct from p.avatar_pending then
    if app.role_level(p.role) >= 1 then
      update public.profiles set avatar_url = v_av, avatar_pending = null, avatar_pending_at = null where id = p.id;
    else
      -- a foto nova fica em análise; os outros continuam vendo a anterior
      update public.profiles set avatar_pending = v_av, avatar_pending_at = now() where id = p.id;
    end if;
  end if;
  return public.me();
end $$;

create or replace function public.admin_photo_queue() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(jsonb_build_object('user', app.user_card(p.id), 'pending_url', p.avatar_pending, 'current_url', p.avatar_url,
      'since', p.avatar_pending_at, 'bio', p.bio) order by p.avatar_pending_at)
    from public.profiles p where p.avatar_pending is not null), '[]');
end $$;

create or replace function public.admin_photo_review(p_user uuid, p_approve boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles;
begin
  me := app.require_level(1);
  select * into t from public.profiles where id = p_user for update;
  if not found or t.avatar_pending is null then perform app.fail('Essa foto já foi analisada.'); end if;
  if p_approve then
    update public.profiles set avatar_url = t.avatar_pending, avatar_pending = null, avatar_pending_at = null where id = t.id;
    perform app.notify(t.id, 'conta', 'Foto aprovada', 'Sua nova foto de perfil já aparece para todos.');
  else
    if btrim(coalesce(p_note, '')) = '' then perform app.fail('Escreva o motivo da recusa.'); end if;
    update public.profiles set avatar_pending = null, avatar_pending_at = null where id = t.id;
    perform app.notify(t.id, 'conta', 'Foto recusada', 'Motivo: ' || btrim(p_note) || '. Escolha outra foto em Editar perfil.');
  end if;
  perform app.log(case when p_approve then 'Aprovou foto' else 'Recusou foto' end, t.nick, nullif(btrim(coalesce(p_note, '')), ''));
  return public.admin_photo_queue();
end $$;

-- a equipe limpa bio ou tira foto de alguém
create or replace function public.admin_user_moderate(p_user uuid, p_action text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles;
begin
  me := app.require_level(1);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if t.id <> me.id and app.role_level(t.role) >= app.role_level(me.role) then perform app.fail('Você não pode mexer em alguém do mesmo cargo ou acima.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo.'); end if;
  if p_action = 'bio' then
    update public.profiles set bio = '' where id = t.id;
    perform app.notify(t.id, 'conta', 'Sua bio foi apagada pela equipe', 'Motivo: ' || btrim(p_reason) || '.');
  elsif p_action = 'foto' then
    update public.profiles set avatar_url = null, avatar_pending = null, avatar_pending_at = null where id = t.id;
    perform app.notify(t.id, 'conta', 'Sua foto foi removida pela equipe', 'Motivo: ' || btrim(p_reason) || '.');
  else
    perform app.fail('Ação inválida.');
  end if;
  perform app.log(case when p_action = 'bio' then 'Apagou bio' else 'Removeu foto' end, t.nick, btrim(p_reason));
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

-- ======================================================================== 3) análise de partida
create sequence if not exists app.case_code start 1;

create table if not exists public.cheat_cases (
  id uuid primary key default gen_random_uuid(),
  code int not null unique default nextval('app.case_code'),
  room_id uuid not null references public.rooms (id) on delete cascade,
  suspect_id uuid not null references public.profiles (id) on delete cascade,
  opened_by uuid references public.profiles (id) on delete set null,
  reason text not null,
  status text not null default 'aguardando_video' check (status in ('aguardando_video', 'em_analise', 'confirmado', 'descartado')),
  deadline timestamptz not null,
  video_path text,
  video_link text,
  video_at timestamptz,
  victims uuid[] not null default '{}',
  call_link text,
  refund_mode text check (refund_mode in ('prejudicados', 'todos')),
  verdict_note text,
  result jsonb,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists cheat_cases_open on public.cheat_cases (room_id, suspect_id) where status in ('aguardando_video', 'em_analise');
create index if not exists cheat_cases_suspect on public.cheat_cases (suspect_id, status);
alter table public.cheat_cases enable row level security;

-- lista de bloqueio: ID do Free Fire, chave Pix e aparelho de quem foi banido por trapaça
create table if not exists public.blocklist (
  kind text not null check (kind in ('ff_id', 'pix', 'device')),
  value text not null,
  reason text not null,
  case_id uuid references public.cheat_cases (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (kind, value)
);
alter table public.blocklist enable row level security;

create or replace function app.norm_key(p text) returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(p, ''), '[^a-zA-Z0-9@._]', '', 'g'))
$$;

create or replace function app.open_case(p_user uuid) returns public.cheat_cases language sql stable security definer set search_path = public, app as $$
  select * from public.cheat_cases where suspect_id = p_user and status in ('aguardando_video', 'em_analise') order by created_at limit 1
$$;

-- o que o suspeito vê
create or replace function app.my_case_json(p_user uuid) returns jsonb language sql stable security definer set search_path = public, app as $$
  select case when c.id is null then null else jsonb_build_object(
    'id', c.id, 'code', c.code, 'status', c.status, 'reason', c.reason, 'deadline', c.deadline, 'video_sent', c.video_at is not null,
    'call_link', c.call_link, 'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title) from public.rooms r where r.id = c.room_id),
    'thread_id', (select t.id from public.threads t where t.kind = 'sala' and least(t.user_a, t.user_b) = least(c.suspect_id, c.opened_by)
                    and greatest(t.user_a, t.user_b) = greatest(c.suspect_id, c.opened_by)),
    'opener', app.user_card(c.opened_by)) end
  from (select 1) x left join lateral (select * from app.open_case(p_user)) c on true
$$;

create or replace function public.my_case() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return app.my_case_json(me.id);
end $$;

-- o que a equipe vê
create or replace function public.admin_case(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare c public.cheat_cases; r public.rooms;
begin
  perform app.require_level(1);
  select * into c from public.cheat_cases where id = p_id;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  select * into r from public.rooms where id = c.room_id;
  return jsonb_build_object(
    'id', c.id, 'code', c.code, 'status', c.status, 'reason', c.reason, 'deadline', c.deadline, 'overdue', c.deadline < now() and c.video_at is null,
    'video_path', c.video_path, 'video_link', c.video_link, 'video_at', c.video_at, 'victims', to_jsonb(c.victims), 'call_link', c.call_link,
    'refund_mode', c.refund_mode, 'verdict_note', c.verdict_note, 'result', c.result, 'resolved_at', c.resolved_at, 'created_at', c.created_at,
    'resolved_by', app.user_card(c.resolved_by), 'opener', app.user_card(c.opened_by),
    'room', jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title, 'status', r.status, 'entry_cents', r.entry_cents, 'team_size', r.team_size,
                               'starts_at', r.starts_at, 'finished_at', r.finished_at),
    'suspect', app.user_card(c.suspect_id) || (select jsonb_build_object('ff_nick', p.ff_nick, 'ff_id', p.ff_id,
        'balance_cents', (select balance_cents + held_cents from public.wallets where user_id = p.id),
        'cases_before', (select count(*) from public.cheat_cases x where x.suspect_id = p.id and x.id <> c.id and x.status = 'confirmado'))
      from public.profiles p where p.id = c.suspect_id),
    'players', coalesce((select jsonb_agg(jsonb_build_object('user', app.user_card(rp.user_id), 'ff_nick', p.ff_nick, 'nick', p.nick,
        'kills', rp.kills, 'placement', rp.placement, 'paid_cents', rp.paid_cents, 'earned_cents', rp.earned_cents,
        'victim', rp.user_id = any (c.victims), 'suspect', rp.user_id = c.suspect_id) order by rp.placement nulls last, p.nick)
      from public.room_players rp join public.profiles p on p.id = rp.user_id where rp.room_id = r.id and rp.status = 'inscrito'), '[]'),
    'thread_id', (select t.id from public.threads t where t.kind = 'sala' and least(t.user_a, t.user_b) = least(c.suspect_id, c.opened_by)
                    and greatest(t.user_a, t.user_b) = greatest(c.suspect_id, c.opened_by)));
end $$;

create or replace function public.admin_cases(p_status text default 'abertas') returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'status', c.status, 'reason', c.reason, 'deadline', c.deadline,
      'overdue', c.deadline < now() and c.video_at is null, 'video_sent', c.video_at is not null, 'victims', cardinality(c.victims),
      'created_at', c.created_at, 'suspect', app.user_card(c.suspect_id), 'opener', app.user_card(c.opened_by),
      'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title) from public.rooms r where r.id = c.room_id))
      order by c.created_at desc)
    from public.cheat_cases c
    where case when p_status = 'abertas' then c.status in ('aguardando_video', 'em_analise') else c.status = p_status end), '[]');
end $$;

-- abrir: chama o suspeito, pausa os saques e manda a mensagem no chat de salas
create or replace function public.admin_case_open(p_room uuid, p_suspect uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles; r public.rooms; c public.cheat_cases; v_thread uuid;
begin
  me := app.require_level(1);
  select * into r from public.rooms where id = p_room;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.status not in ('em_andamento', 'finalizada') then perform app.fail('A análise é para partidas que já começaram ou terminaram.'); end if;
  select * into t from public.profiles where id = p_suspect;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if not exists (select 1 from public.room_players where room_id = r.id and user_id = t.id and status = 'inscrito') then
    perform app.fail('Esse jogador não jogou essa sala.');
  end if;
  if t.id = me.id or app.role_level(t.role) >= app.role_level(me.role) then perform app.fail('Você não pode abrir análise contra alguém do mesmo cargo ou acima.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo da suspeita.'); end if;
  select * into c from public.cheat_cases where room_id = r.id and suspect_id = t.id and status in ('aguardando_video', 'em_analise');
  if found then perform app.fail('Já existe uma análise aberta desse jogador nessa sala (caso #' || c.code || ').'); end if;
  insert into public.cheat_cases (room_id, suspect_id, opened_by, reason, deadline)
  values (r.id, t.id, me.id, left(btrim(p_reason), 300), now() + interval '24 hours') returning * into c;
  v_thread := app.get_thread('sala', me.id, t.id, r.id);
  perform public.send_message(v_thread, 'Análise de partida · caso #' || c.code || ' · Sala #' || r.code || E'\n' ||
    'Você foi chamado para análise por suspeita de trapaça. Motivo: ' || btrim(p_reason) || '.' || E'\n' ||
    'Envie o vídeo da partida, com o killfeed aparecendo, em até 24 horas pelo aviso no início do app. ' ||
    'Seus saques ficam pausados até o resultado. Se precisar, eu te chamo numa ligação de voz para você compartilhar a tela.', null);
  perform app.notify(t.id, 'analise', 'Sua partida está em análise', 'Sala #' || r.code || ' · envie o vídeo da partida em até 24 horas.', jsonb_build_object('case_id', c.id));
  update public.reports set status = 'resolvida', resolution = 'Em análise (caso #' || c.code || ')', reviewed_by = me.id, reviewed_at = now()
   where target_id = t.id and room_id = r.id and status = 'aberta';
  perform app.log('Abriu análise de partida', t.nick, 'Caso #' || c.code || ' · Sala #' || r.code || ' · ' || btrim(p_reason));
  return public.admin_case(c.id);
end $$;

-- o suspeito manda o vídeo (arquivo no app ou link do Drive/YouTube)
create or replace function public.case_submit_video(p_case uuid, p_path text, p_link text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; c public.cheat_cases; v_path text := nullif(btrim(coalesce(p_path, '')), ''); v_link text := nullif(btrim(coalesce(p_link, '')), '');
        v_thread uuid;
begin
  me := app.require_user();
  select * into c from public.cheat_cases where id = p_case and suspect_id = me.id for update;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  if c.status not in ('aguardando_video', 'em_analise') then perform app.fail('Essa análise já foi encerrada.'); end if;
  if v_path is null and v_link is null then perform app.fail('Envie o arquivo do vídeo ou cole o link.'); end if;
  if v_path is not null and position(me.id::text || '/' in v_path) <> 1 then perform app.fail('Arquivo inválido. Envie de novo.'); end if;
  if v_link is not null and v_link !~* '^https?://[^\s]+$' then perform app.fail('Cole um link que comece com https://'); end if;
  update public.cheat_cases set video_path = coalesce(v_path, video_path), video_link = coalesce(v_link, video_link), video_at = now(), status = 'em_analise'
   where id = c.id;
  if c.opened_by is not null then
    v_thread := app.get_thread('sala', me.id, c.opened_by, c.room_id);
    perform public.send_message(v_thread, 'Enviei o vídeo da partida (caso #' || c.code || ').' || case when v_link is not null then ' Link: ' || v_link else '' end, null);
    perform app.notify(c.opened_by, 'analise', 'Vídeo recebido · caso #' || c.code, me.nick || ' mandou o vídeo da partida.', jsonb_build_object('case_id', c.id, 'staff', true));
  end if;
  return app.my_case_json(me.id);
end $$;

-- a equipe marca os prejudicados (os que o suspeito matou)
create or replace function public.admin_case_update(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare c public.cheat_cases; v_victims uuid[];
begin
  perform app.require_level(1);
  select * into c from public.cheat_cases where id = p_id for update;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  if c.status not in ('aguardando_video', 'em_analise') then perform app.fail('Essa análise já foi encerrada.'); end if;
  if p ? 'victims' then
    select coalesce(array_agg(distinct rp.user_id), '{}') into v_victims
      from jsonb_array_elements_text(p -> 'victims') v join public.room_players rp on rp.user_id = v::uuid and rp.room_id = c.room_id and rp.status = 'inscrito'
     where v::uuid <> c.suspect_id;
    update public.cheat_cases set victims = v_victims where id = c.id;
  end if;
  return public.admin_case(c.id);
end $$;

-- chamada de voz com compartilhamento de tela (Jitsi Meet, grátis)
create or replace function public.admin_case_call(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; c public.cheat_cases; v_link text; v_thread uuid;
begin
  me := app.require_level(1);
  select * into c from public.cheat_cases where id = p_id for update;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  if c.status not in ('aguardando_video', 'em_analise') then perform app.fail('Essa análise já foi encerrada.'); end if;
  v_link := 'https://meet.jit.si/BattleHub-Analise-' || c.code || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  update public.cheat_cases set call_link = v_link where id = c.id;
  v_thread := app.get_thread('sala', me.id, c.suspect_id, c.room_id);
  perform public.send_message(v_thread, 'Entre na chamada de voz da análise (caso #' || c.code || '). Pelo app Jitsi Meet dá para compartilhar a tela: ' || v_link, null);
  perform app.notify(c.suspect_id, 'analise', 'Chamada de análise', me.nick || ' está te chamando para uma ligação de voz.', jsonb_build_object('case_id', c.id, 'link', v_link));
  perform app.log('Chamou para ligação de análise', (select nick from public.profiles where id = c.suspect_id), 'Caso #' || c.code);
  return jsonb_build_object('link', v_link);
end $$;

-- quanto volta para quem e quanto fica retido, antes de confirmar
create or replace function app.case_targets(c public.cheat_cases, p_mode text) returns table (user_id uuid, cents bigint)
language sql stable security definer set search_path = public, app as $$
  select rp.user_id, rp.paid_cents from public.room_players rp
   where rp.room_id = c.room_id and rp.status = 'inscrito' and rp.user_id <> c.suspect_id
     and (p_mode = 'todos' or rp.user_id = any (c.victims))
$$;

create or replace function public.admin_case_preview(p_id uuid, p_mode text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare c public.cheat_cases;
begin
  perform app.require_level(1);
  select * into c from public.cheat_cases where id = p_id;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  return jsonb_build_object('mode', p_mode,
    'refunds', coalesce((select jsonb_agg(jsonb_build_object('user', app.user_card(t.user_id), 'cents', t.cents)) from app.case_targets(c, p_mode) t), '[]'),
    'refund_total', coalesce((select sum(t.cents) from app.case_targets(c, p_mode) t), 0),
    'confiscate', coalesce((select balance_cents + held_cents from public.wallets where user_id = c.suspect_id), 0));
end $$;

-- veredito
create or replace function public.admin_case_resolve(p_id uuid, p_hack boolean, p_mode text, p_note text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; c public.cheat_cases; r public.rooms; t public.profiles; x record; w public.withdrawals;
        v_refunds jsonb := '[]'; v_total bigint := 0; v_bal bigint; v_refused bigint := 0; v_note text := btrim(coalesce(p_note, ''));
begin
  me := app.require_level(1);
  select * into c from public.cheat_cases where id = p_id for update;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  if c.status not in ('aguardando_video', 'em_analise') then perform app.fail('Essa análise já foi encerrada.'); end if;
  if v_note = '' then perform app.fail('Escreva o resultado da análise.'); end if;
  select * into r from public.rooms where id = c.room_id;
  select * into t from public.profiles where id = c.suspect_id;

  if not p_hack then
    update public.cheat_cases set status = 'descartado', verdict_note = v_note, resolved_by = me.id, resolved_at = now() where id = c.id;
    perform app.notify(t.id, 'analise', 'Análise concluída', 'Nenhuma trapaça encontrada na sala #' || r.code || '. Seus saques voltaram ao normal.', jsonb_build_object('case_id', c.id));
    perform app.log('Encerrou análise sem trapaça', t.nick, 'Caso #' || c.code || ' · ' || v_note);
    return public.admin_case(c.id);
  end if;

  if app.role_level(me.role) < 2 then perform app.fail('Só admins confirmam trapaça, porque mexe com dinheiro e ban permanente.'); end if;
  if p_mode not in ('prejudicados', 'todos') then perform app.fail('Escolha quem recebe o dinheiro de volta.'); end if;
  if p_mode = 'prejudicados' and cardinality(c.victims) = 0 then perform app.fail('Marque os prejudicados (quem ele matou) ou escolha devolver para todos.'); end if;

  -- 1) inscrição de volta para os prejudicados (ou para todos da sala), paga pela plataforma
  for x in select tg.user_id, tg.cents, p.nick from app.case_targets(c, p_mode) tg join public.profiles p on p.id = tg.user_id loop
    if x.cents > 0 then
      perform app.credit(x.user_id, x.cents, 'reembolso_trapaca', 'Devolução da sala #' || r.code || ': trapaça confirmada', 'cheat_case', c.id::text);
      perform app.platform('reembolso_trapaca', -x.cents, 'Devolução para ' || x.nick || ' · caso #' || c.code, 'cheat_case', c.id::text);
      perform app.notify(x.user_id, 'analise', 'Você recebeu ' || app.brl(x.cents) || ' de volta',
        'Trapaça confirmada na sala #' || r.code || '. A inscrição voltou para a sua carteira.', jsonb_build_object('room_id', r.id));
    end if;
    v_refunds := v_refunds || jsonb_build_object('user_id', x.user_id, 'nick', x.nick, 'cents', x.cents);
    v_total := v_total + x.cents;
  end loop;

  -- 2) ban permanente: sai das salas abertas (a inscrição volta para a carteira e é retida junto no passo 3)
  perform public.admin_ban(t.id, 0, 'Trapaça confirmada na sala #' || r.code || ' (caso #' || c.code || ')');

  -- 3) saques em análise do trapaceiro são recusados e o saldo inteiro fica retido
  for w in select * from public.withdrawals where user_id = t.id and status = 'pendente' for update loop
    update public.wallets set held_cents = held_cents - w.amount_cents where user_id = t.id;
    update public.withdrawals set status = 'recusado', note = 'Conta banida por trapaça (caso #' || c.code || ')', reviewed_at = now(), reviewed_by = me.id where id = w.id;
    perform app.credit(t.id, w.amount_cents, 'saque_estorno', 'Saque recusado: trapaça confirmada', 'withdrawal', w.id::text);
    v_refused := v_refused + w.amount_cents;
  end loop;
  select balance_cents into v_bal from public.wallets where user_id = t.id;
  if coalesce(v_bal, 0) > 0 then
    perform app.credit(t.id, -v_bal, 'confisco_trapaca', 'Saldo retido: trapaça confirmada (caso #' || c.code || ')', 'cheat_case', c.id::text);
    perform app.platform('confisco_trapaca', v_bal, 'Saldo retido de ' || t.nick || ' · caso #' || c.code, 'cheat_case', c.id::text);
  end if;

  -- 4) lista de bloqueio: ID do Free Fire, chaves Pix usadas e aparelho
  if t.ff_id is not null then
    insert into public.blocklist (kind, value, reason, case_id) values ('ff_id', t.ff_id, 'Trapaça confirmada · caso #' || c.code, c.id) on conflict do nothing;
  end if;
  insert into public.blocklist (kind, value, reason, case_id)
    select distinct 'pix', app.norm_key(pix_key), 'Trapaça confirmada · caso #' || c.code, c.id from public.withdrawals where user_id = t.id and app.norm_key(pix_key) <> ''
    on conflict do nothing;
  if t.device_id is not null then
    insert into public.blocklist (kind, value, reason, case_id) values ('device', t.device_id, 'Trapaça confirmada · caso #' || c.code, c.id) on conflict do nothing;
  end if;

  update public.cheat_cases set status = 'confirmado', refund_mode = p_mode, verdict_note = v_note, resolved_by = me.id, resolved_at = now(),
         result = jsonb_build_object('refunds', v_refunds, 'refund_total', v_total, 'confiscated', coalesce(v_bal, 0), 'withdrawals_refused', v_refused)
   where id = c.id;
  perform app.log('Confirmou trapaça', t.nick, 'Caso #' || c.code || ' · devolveu ' || app.brl(v_total) || ' · reteve ' || app.brl(coalesce(v_bal, 0)) || ' · ' || v_note);
  return public.admin_case(c.id);
end $$;

-- lista de bloqueio na administração
create or replace function public.admin_blocklist() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(jsonb_build_object('kind', b.kind, 'value', b.value, 'reason', b.reason, 'created_at', b.created_at) order by b.created_at desc)
    from public.blocklist b), '[]');
end $$;

create or replace function public.admin_blocklist_remove(p_kind text, p_value text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  delete from public.blocklist where kind = p_kind and value = p_value;
  perform app.log('Tirou da lista de bloqueio', p_kind, p_value);
  return public.admin_blocklist();
end $$;

-- aparelho: o app manda o identificador ao entrar; aparelho bloqueado bane a conta nova
create or replace function public.set_device(p_device text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v text := left(btrim(coalesce(p_device, '')), 80); b public.blocklist;
begin
  me := app.require_user();
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

-- ======================================================================== ajustes nas funções que já existiam
do $$
declare v_src text; v_new text;
begin
  -- saque: pausado com análise aberta e bloqueado para chave Pix da lista
  select pg_get_functiondef('public.request_withdrawal(bigint, text, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'me := app.require_user(); s := app.settings();',
    'me := app.require_user(); s := app.settings();
  if exists (select 1 from public.cheat_cases where suspect_id = me.id and status in (''aguardando_video'', ''em_analise'')) then
    perform app.fail(''Seus saques estão pausados: uma partida sua está em análise. Veja o aviso no início do app.'');
  end if;
  if exists (select 1 from public.blocklist where kind = ''pix'' and value = app.norm_key(p_key)) then
    perform app.fail(''Essa chave Pix foi bloqueada no BattleHub. Fale com o suporte.'');
  end if;');
  if v_new = v_src then raise exception 'request_withdrawal: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- pagar saque de quem está em análise não pode
  select pg_get_functiondef('public.admin_withdrawal(uuid, boolean, text)'::regprocedure) into v_src;
  v_new := replace(v_src, '  update public.wallets set held_cents = held_cents - w.amount_cents where user_id = w.user_id;
  if p_paid then',
    '  if p_paid and exists (select 1 from public.cheat_cases where suspect_id = w.user_id and status in (''aguardando_video'', ''em_analise'')) then
    perform app.fail(''Esse jogador está em análise de trapaça. Resolva a análise antes de pagar o saque.'');
  end if;
  update public.wallets set held_cents = held_cents - w.amount_cents where user_id = w.user_id;
  if p_paid then');
  if v_new = v_src then raise exception 'admin_withdrawal: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- ID do Free Fire banido não volta
  select pg_get_functiondef('app.submit_ff(uuid, text, text, text)'::regprocedure) into v_src;
  v_new := replace(v_src, '  if coalesce(p_photo, '''') = '''' then',
    '  if exists (select 1 from public.blocklist where kind = ''ff_id'' and value = v_id) then
    perform app.fail(''Esse ID do Free Fire foi banido do BattleHub por trapaça.'');
  end if;
  if coalesce(p_photo, '''') = '''' then');
  if v_new = v_src then raise exception 'submit_ff: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- chat: palavra proibida vira asterisco
  select pg_get_functiondef('public.send_message(uuid, text, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'left(btrim(coalesce(p_body, '''')), 2000)', 'app.mask_text(left(btrim(coalesce(p_body, '''')), 2000))');
  if v_new = v_src then raise exception 'send_message: ponto de ajuste não encontrado'; end if;
  execute v_new;
  select pg_get_functiondef('public.send_room_message(uuid, text, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'left(btrim(coalesce(p_body, '''')), 1000)', 'app.mask_text(left(btrim(coalesce(p_body, '''')), 1000))');
  if v_new = v_src then raise exception 'send_room_message: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- guildas: nome e descrição sem palavra proibida
  select pg_get_functiondef('public.create_guild(jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, '  me := app.require_user(); s := app.settings();',
    '  me := app.require_user(); s := app.settings();
  perform app.check_text(v_name, ''O nome da guilda''); perform app.check_text(p ->> ''description'', ''A descrição da guilda'');');
  if v_new = v_src then raise exception 'create_guild: ponto de ajuste não encontrado'; end if;
  execute v_new;
  select pg_get_functiondef('public.guild_manage(text, uuid, jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, '  me := app.require_user(); s := app.settings();',
    '  me := app.require_user(); s := app.settings();
  perform app.check_text(p ->> ''name'', ''O nome da guilda''); perform app.check_text(p ->> ''description'', ''A descrição da guilda'');');
  if v_new = v_src then raise exception 'guild_manage: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- quem está em análise não apaga a conta (senão os prejudicados ficam sem a devolução)
  select pg_get_functiondef('public.delete_my_account(boolean)'::regprocedure) into v_src;
  v_new := replace(v_src, '  if me.role = ''dono'' then perform app.fail(''A conta dona do app não pode ser excluída por aqui.''); end if;',
    '  if me.role = ''dono'' then perform app.fail(''A conta dona do app não pode ser excluída por aqui.''); end if;
  if exists (select 1 from public.cheat_cases where suspect_id = me.id and status in (''aguardando_video'', ''em_analise'')) then
    perform app.fail(''Uma partida sua está em análise. Espere o resultado para excluir a conta.'');
  end if;');
  if v_new = v_src then raise exception 'delete_my_account: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- a própria pessoa vê a foto em análise; os outros veem a aprovada
  select pg_get_functiondef('app.user_card(uuid, boolean)'::regprocedure) into v_src;
  v_new := replace(v_src, 'else p.avatar_url end,', 'else case when p.id = auth.uid() then coalesce(p.avatar_pending, p.avatar_url) else p.avatar_url end end,');
  if v_new = v_src then raise exception 'user_card: ponto de ajuste não encontrado'; end if;
  execute v_new;

  select pg_get_functiondef('public.me()'::regprocedure) into v_src;
  v_new := replace(v_src, '''avatar_url'', p.avatar_url,', '''avatar_url'', coalesce(p.avatar_pending, p.avatar_url), ''avatar_pending'', p.avatar_pending is not null, ''cheat_case'', app.my_case_json(p.id),');
  v_new := replace(v_new, '''reports'', (select count(*) from public.reports where status = ''aberta''),',
    '''reports'', (select count(*) from public.reports where status = ''aberta''),
       ''photos'', (select count(*) from public.profiles where avatar_pending is not null),
       ''cases'', (select count(*) from public.cheat_cases where status in (''aguardando_video'', ''em_analise'')),');
  if v_new not like '%cheat_case%' or v_new not like '%''photos''%' then raise exception 'me(): ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

revoke all on all functions in schema app from public;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
