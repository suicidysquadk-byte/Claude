-- BattleHub: lines dentro da guilda, recrutamento e sinergia
-- Line = grupo fixo de 1 a 4 jogadores (solo, dupla, trio ou squad) dentro de uma guilda. Quem cria é o líder.
-- - Entrar pelo código da line: entra direto (e entra na guilda, se ainda não for dela).
-- - Line recrutando: aparece na busca e não precisa de código; o líder escolhe até 2 critérios (nível, abates,
--   vitórias, salas, média de abates ou ID verificado). Quem cumpre pede para entrar e fica na lista "querem entrar"
--   até o líder aceitar.
-- - Sinergia: cada sala finalizada em que 2 ou mais jogadores da line jogaram juntos soma 1 ponto (+1 se a line
--   inteira jogou). Nos níveis de sinergia todos da line ganham recompensa (título, banner ou moldura).

-- ================================================================ tabelas
create table public.guild_lines (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  name text not null,
  size int not null check (size between 1 and 4),
  leader_id uuid not null references public.profiles (id),
  code text not null unique,
  recruiting boolean not null default false,
  description text not null default '',
  req1_kind text check (req1_kind in ('nivel', 'abates', 'vitorias', 'salas', 'media', 'verificado')),
  req1_value int not null default 0,
  req2_kind text check (req2_kind in ('nivel', 'abates', 'vitorias', 'salas', 'media', 'verificado')),
  req2_value int not null default 0,
  synergy int not null default 0,
  synergy_tier int not null default 0,
  created_at timestamptz not null default now()
);
create unique index guild_lines_name on public.guild_lines (guild_id, lower(name));
create index guild_lines_recruiting on public.guild_lines (recruiting) where recruiting;

create table public.guild_line_members (
  line_id uuid not null references public.guild_lines (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membro' check (role in ('lider', 'membro')),
  joined_at timestamptz not null default now(),
  primary key (line_id, user_id)
);
-- cada jogador em uma line só
create unique index guild_line_members_user on public.guild_line_members (user_id);

create table public.guild_line_requests (
  line_id uuid not null references public.guild_lines (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null default '',
  created_at timestamptz not null default now(),
  primary key (line_id, user_id)
);

create table public.line_synergy_log (
  line_id uuid not null references public.guild_lines (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  players int not null,
  points int not null,
  created_at timestamptz not null default now(),
  primary key (line_id, room_id)
);

alter table public.guild_lines enable row level security;
alter table public.guild_line_members enable row level security;
alter table public.guild_line_requests enable row level security;
alter table public.line_synergy_log enable row level security;

-- ================================================================ recompensas de sinergia (só por recompensa, sem preço)
insert into public.shop_items (id, kind, name, description, price_cents, duration_days, data, sort) values
  ('titulo-entrosados', 'titulo', 'Entrosados', 'Sinergia de line nível 1 (10 pontos)', null, null, '{"text":"Entrosados"}', 120),
  ('banner-sinergia', 'banner', 'Sinergia', 'Sinergia de line nível 2 (25 pontos)', null, null, '{"bg":"linear-gradient(120deg,#0b0a08,#3a2b0c 45%,#c9a24d 75%,#0b0a08)","anim":"goldline"}', 121),
  ('moldura-laco-sangue', 'moldura', 'Laço de Sangue', 'Sinergia de line nível 3 (50 pontos)', null, null, '{"ring":"#b91c1c","glow":true}', 122),
  ('titulo-irmaos-guerra', 'titulo', 'Irmãos de Guerra', 'Sinergia de line nível 4 (80 pontos)', null, null, '{"text":"Irmãos de Guerra"}', 123),
  ('moldura-sinergia-suprema', 'moldura', 'Sinergia Suprema', 'Sinergia de line nível 5 (120 pontos)', null, null, '{"ring":"conic","glow":true}', 124)
on conflict (id) do nothing;

create table app.synergy_tiers (tier int primary key, points int not null, item_id text not null references public.shop_items (id), label text not null);
insert into app.synergy_tiers values
  (1, 10, 'titulo-entrosados', 'Título "Entrosados"'),
  (2, 25, 'banner-sinergia', 'Banner "Sinergia"'),
  (3, 50, 'moldura-laco-sangue', 'Moldura "Laço de Sangue"'),
  (4, 80, 'titulo-irmaos-guerra', 'Título "Irmãos de Guerra"'),
  (5, 120, 'moldura-sinergia-suprema', 'Moldura "Sinergia Suprema"');

-- ================================================================ ajudantes
create or replace function app.line_code() returns text language plpgsql volatile as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v text; i int;
begin
  loop
    v := '';
    for i in 1..6 loop v := v || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.guild_lines where code = v);
  end loop;
  return v;
end $$;

-- critério: o jogador cumpre?
create or replace function app.line_req_ok(p public.profiles, p_kind text, p_value int) returns boolean
language sql stable as $$
  select case p_kind
    when 'nivel' then app.level_of(p.xp) >= p_value
    when 'abates' then p.kills >= p_value
    when 'vitorias' then p.wins >= p_value
    when 'salas' then p.matches >= p_value
    when 'media' then p.matches > 0 and p.kills * 10 >= p_value * p.matches
    when 'verificado' then p.ff_status = 'aprovado'
    else true end
$$;
create or replace function app.line_req_label(p_kind text, p_value int) returns text language sql immutable as $$
  select case p_kind
    when 'nivel' then 'Nível ' || p_value || '+'
    when 'abates' then p_value || '+ abates'
    when 'vitorias' then p_value || '+ vitórias'
    when 'salas' then p_value || '+ salas jogadas'
    when 'media' then 'Média de ' || trim(to_char(p_value / 10.0, 'FM990.0')) || '+ abates por sala'
    when 'verificado' then 'ID do Free Fire verificado'
    else null end
$$;
create or replace function app.line_eligible(l public.guild_lines, p public.profiles) returns boolean language sql stable as $$
  select (l.req1_kind is null or app.line_req_ok(p, l.req1_kind, l.req1_value)) and (l.req2_kind is null or app.line_req_ok(p, l.req2_kind, l.req2_value))
$$;

create or replace function app.line_card(l public.guild_lines, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object('id', l.id, 'name', l.name, 'size', l.size, 'recruiting', l.recruiting, 'description', l.description,
    'guild', (select jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'color', g.color) from public.guilds g where g.id = l.guild_id),
    'leader', app.user_card(l.leader_id),
    'reqs', (select coalesce(jsonb_agg(jsonb_build_object('kind', k, 'value', v, 'label', app.line_req_label(k, v))), '[]') from (values (l.req1_kind, l.req1_value), (l.req2_kind, l.req2_value)) x(k, v) where k is not null),
    'members', coalesce((select jsonb_agg(app.user_card(m.user_id) || jsonb_build_object('line_role', m.role, 'joined_at', m.joined_at) order by m.role = 'lider' desc, m.joined_at)
                          from public.guild_line_members m where m.line_id = l.id), '[]'),
    'count', (select count(*) from public.guild_line_members m where m.line_id = l.id),
    'synergy', l.synergy, 'synergy_tier', l.synergy_tier,
    'next_tier', (select jsonb_build_object('tier', t.tier, 'points', t.points, 'label', t.label) from app.synergy_tiers t where t.tier = l.synergy_tier + 1),
    'mine', exists (select 1 from public.guild_line_members m where m.line_id = l.id and m.user_id = p_viewer),
    'requested', exists (select 1 from public.guild_line_requests r where r.line_id = l.id and r.user_id = p_viewer),
    'eligible', coalesce((select app.line_eligible(l, p) from public.profiles p where p.id = p_viewer), false),
    -- código e pedidos: só a line e a liderança da guilda veem
    'code', case when exists (select 1 from public.guild_line_members m where m.line_id = l.id and m.user_id = p_viewer)
                   or app.guild_member_role(l.guild_id, p_viewer) in ('lider', 'vice') then l.code end,
    'can_manage', l.leader_id = p_viewer or coalesce(app.guild_member_role(l.guild_id, p_viewer) in ('lider', 'vice'), false),
    'requests', case when l.leader_id = p_viewer or app.guild_member_role(l.guild_id, p_viewer) in ('lider', 'vice') then
       coalesce((select jsonb_agg(app.user_card(r.user_id) || jsonb_build_object('message', r.message, 'at', r.created_at,
                  'stats', (select jsonb_build_object('level', app.level_of(p.xp), 'kills', p.kills, 'wins', p.wins, 'matches', p.matches, 'verified', p.ff_status = 'aprovado') from public.profiles p where p.id = r.user_id),
                  'in_guild', (select g.tag from public.guild_members gm join public.guilds g on g.id = gm.guild_id where gm.user_id = r.user_id)) order by r.created_at)
                 from public.guild_line_requests r where r.line_id = l.id), '[]') end)
$$;

-- entra na line (e na guilda, se ainda não for dela)
create or replace function app.line_add(l public.guild_lines, p_user uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare gm public.guild_members; g public.guilds; p public.profiles;
begin
  select * into p from public.profiles where id = p_user;
  if exists (select 1 from public.guild_line_members where user_id = p_user) then perform app.fail(coalesce(p.nick, 'O jogador') || ' já está em outra line.'); end if;
  if (select count(*) from public.guild_line_members where line_id = l.id) >= l.size then perform app.fail('A line está completa (' || l.size || ' de ' || l.size || ').'); end if;
  select * into gm from public.guild_members where user_id = p_user;
  if found and gm.guild_id <> l.guild_id then perform app.fail(coalesce(p.nick, 'O jogador') || ' é de outra guilda. Precisa sair dela antes.'); end if;
  if not found then
    select * into g from public.guilds where id = l.guild_id;
    if (select count(*) from public.guild_members where guild_id = g.id) >= 50 then perform app.fail('A guilda está cheia (50 membros).'); end if;
    insert into public.guild_members (user_id, guild_id) values (p_user, g.id);
    update public.profiles set guild_id = g.id where id = p_user;
  end if;
  insert into public.guild_line_members (line_id, user_id) values (l.id, p_user);
  delete from public.guild_line_requests where user_id = p_user;
end $$;

-- line sem líder passa para o mais antigo; line vazia acaba
create or replace function app.line_fix(p_line uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare v uuid;
begin
  if not exists (select 1 from public.guild_line_members where line_id = p_line) then delete from public.guild_lines where id = p_line; return; end if;
  if not exists (select 1 from public.guild_line_members where line_id = p_line and role = 'lider') then
    select user_id into v from public.guild_line_members where line_id = p_line order by joined_at limit 1;
    update public.guild_line_members set role = 'lider' where line_id = p_line and user_id = v;
    update public.guild_lines set leader_id = v where id = p_line;
    perform app.notify(v, 'guilda', 'Você agora lidera a line', 'O líder anterior saiu.', '{}'::jsonb);
  end if;
end $$;

-- quem sai da guilda sai da line
create or replace function app.guild_member_left() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare v uuid;
begin
  delete from public.guild_line_members m using public.guild_lines l
   where m.line_id = l.id and l.guild_id = old.guild_id and m.user_id = old.user_id returning m.line_id into v;
  if v is not null then perform app.line_fix(v); end if;
  return null;
end $$;
create trigger guild_members_left after delete on public.guild_members for each row execute function app.guild_member_left();

-- ================================================================ API
create or replace function public.create_line(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; gm public.guild_members; l public.guild_lines; v_name text := btrim(coalesce(p ->> 'name', '')); v_size int := coalesce((p ->> 'size')::int, 4);
begin
  me := app.require_user();
  select * into gm from public.guild_members where user_id = me.id;
  if not found then perform app.fail('Entre ou crie uma guilda antes de montar uma line.'); end if;
  if exists (select 1 from public.guild_line_members where user_id = me.id) then perform app.fail('Você já está numa line. Saia dela antes de criar outra.'); end if;
  if length(v_name) < 2 or length(v_name) > 20 then perform app.fail('O nome da line tem de 2 a 20 caracteres.'); end if;
  perform app.check_text(v_name, 'O nome da line');
  if v_size not between 1 and 4 then perform app.fail('A line tem de 1 a 4 jogadores.'); end if;
  if exists (select 1 from public.guild_lines where guild_id = gm.guild_id and lower(name) = lower(v_name)) then perform app.fail('Já existe uma line com esse nome na guilda.'); end if;
  if (select count(*) from public.guild_lines where guild_id = gm.guild_id) >= 15 then perform app.fail('A guilda chegou ao limite de 15 lines.'); end if;
  insert into public.guild_lines (guild_id, name, size, leader_id, code, description)
  values (gm.guild_id, v_name, v_size, me.id, app.line_code(), left(btrim(coalesce(p ->> 'description', '')), 200)) returning * into l;
  insert into public.guild_line_members (line_id, user_id, role) values (l.id, me.id, 'lider');
  delete from public.guild_line_requests where user_id = me.id;
  if p ? 'recruiting' or p ? 'req1_kind' then perform public.line_manage(l.id, 'settings', null, p); end if;
  return app.line_card((select x from public.guild_lines x where x.id = l.id), me.id);
end $$;

create or replace function public.guild_lines(p_guild uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return coalesce((select jsonb_agg(app.line_card(l, me.id) order by l.synergy desc, l.created_at) from public.guild_lines l where l.guild_id = p_guild), '[]');
end $$;

create or replace function public.my_line() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return (select app.line_card(l, me.id) from public.guild_lines l join public.guild_line_members m on m.line_id = l.id where m.user_id = me.id);
end $$;

-- entrar pelo código: direto
create or replace function public.join_line_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; l public.guild_lines;
begin
  me := app.require_user();
  select * into l from public.guild_lines where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then perform app.fail('Código de line não encontrado. Confira as letras.'); end if;
  perform app.line_add(l, me.id);
  perform app.notify(l.leader_id, 'guilda', me.nick || ' entrou na line ' || l.name, 'Entrou pelo código.', jsonb_build_object('guild_id', l.guild_id));
  return app.line_card(l, me.id);
end $$;

-- lines recrutando (busca de guilda)
create or replace function public.list_recruiting_lines(p_q text default null, p_size int default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v text := nullif(btrim(coalesce(p_q, '')), '');
begin
  me := app.require_user();
  return coalesce((select jsonb_agg(x order by (x ->> 'eligible')::boolean desc, (x ->> 'synergy')::int desc) from (
    select app.line_card(l, me.id) x from public.guild_lines l join public.guilds g on g.id = l.guild_id
     where l.recruiting and (select count(*) from public.guild_line_members m where m.line_id = l.id) < l.size
       and (p_size is null or l.size = p_size)
       and (v is null or l.name ilike '%' || v || '%' or g.name ilike '%' || v || '%' or g.tag ilike v)
     limit 100) q), '[]');
end $$;

-- pedir para entrar numa line recrutando (sem código): precisa cumprir os critérios
create or replace function public.line_request(p_line uuid, p_message text default '') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; l public.guild_lines; gm public.guild_members;
begin
  me := app.require_user();
  select * into l from public.guild_lines where id = p_line;
  if not found then perform app.fail('Line não encontrada.'); end if;
  if not l.recruiting then perform app.fail('Essa line não está recrutando. Peça o código ao líder.'); end if;
  if exists (select 1 from public.guild_line_members where user_id = me.id) then perform app.fail('Você já está numa line.'); end if;
  if (select count(*) from public.guild_line_members where line_id = l.id) >= l.size then perform app.fail('A line está completa.'); end if;
  select * into gm from public.guild_members where user_id = me.id;
  if found and gm.guild_id <> l.guild_id then perform app.fail('Essa line é de outra guilda. Saia da sua guilda antes.'); end if;
  if not app.line_eligible(l, me) then perform app.fail('Você ainda não cumpre os critérios da line.'); end if;
  if (select count(*) from public.guild_line_requests where user_id = me.id) >= 3 then perform app.fail('Você já tem 3 pedidos esperando resposta.'); end if;
  perform app.check_text(p_message, 'A mensagem');
  insert into public.guild_line_requests (line_id, user_id, message) values (l.id, me.id, left(btrim(coalesce(p_message, '')), 200))
  on conflict (line_id, user_id) do update set message = excluded.message, created_at = now();
  perform app.notify(l.leader_id, 'guilda', me.nick || ' quer entrar na line ' || l.name, coalesce(nullif(btrim(p_message), ''), 'Veja o pedido na guilda.'), jsonb_build_object('guild_id', l.guild_id));
  return app.line_card(l, me.id);
end $$;

create or replace function public.line_cancel_request(p_line uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  delete from public.guild_line_requests where line_id = p_line and user_id = me.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.line_respond(p_line uuid, p_user uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; l public.guild_lines;
begin
  me := app.require_user();
  select * into l from public.guild_lines where id = p_line for update;
  if not found then perform app.fail('Line não encontrada.'); end if;
  if not (l.leader_id = me.id or coalesce(app.guild_member_role(l.guild_id, me.id) in ('lider', 'vice'), false)) then perform app.fail('Só o líder da line ou da guilda responde pedidos.'); end if;
  if not exists (select 1 from public.guild_line_requests where line_id = l.id and user_id = p_user) then perform app.fail('Pedido não encontrado.'); end if;
  if p_accept then
    perform app.line_add(l, p_user);
    perform app.notify(p_user, 'guilda', 'Você entrou na line ' || l.name, 'Pedido aceito por ' || me.nick || '.', jsonb_build_object('guild_id', l.guild_id));
  else
    delete from public.guild_line_requests where line_id = l.id and user_id = p_user;
    perform app.notify(p_user, 'guilda', 'Pedido para a line ' || l.name || ' recusado', '', jsonb_build_object('guild_id', l.guild_id));
  end if;
  return app.line_card(l, me.id);
end $$;

create or replace function public.line_manage(p_line uuid, p_action text, p_user uuid default null, p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; l public.guild_lines; v_k1 text; v_k2 text; v_v1 int; v_v2 int; v_name text;
begin
  me := app.require_user();
  select * into l from public.guild_lines where id = p_line for update;
  if not found then perform app.fail('Line não encontrada.'); end if;
  if not (l.leader_id = me.id or coalesce(app.guild_member_role(l.guild_id, me.id) in ('lider', 'vice'), false)) then perform app.fail('Só o líder da line (ou da guilda) muda a line.'); end if;
  if p_action = 'settings' then
    v_k1 := nullif(p ->> 'req1_kind', ''); v_k2 := nullif(p ->> 'req2_kind', '');
    v_v1 := greatest(coalesce((p ->> 'req1_value')::int, 0), 0); v_v2 := greatest(coalesce((p ->> 'req2_value')::int, 0), 0);
    if v_k1 is not null and v_k1 = v_k2 then perform app.fail('Escolha dois critérios diferentes.'); end if;
    if v_k1 is null and v_k2 is not null then v_k1 := v_k2; v_v1 := v_v2; v_k2 := null; v_v2 := 0; end if;
    v_name := coalesce(nullif(btrim(p ->> 'name'), ''), l.name);
    if length(v_name) < 2 or length(v_name) > 20 then perform app.fail('O nome da line tem de 2 a 20 caracteres.'); end if;
    perform app.check_text(v_name, 'O nome da line');
    if lower(v_name) <> lower(l.name) and exists (select 1 from public.guild_lines where guild_id = l.guild_id and lower(name) = lower(v_name)) then perform app.fail('Já existe uma line com esse nome na guilda.'); end if;
    if coalesce((p ->> 'size')::int, l.size) not between 1 and 4 or coalesce((p ->> 'size')::int, l.size) < (select count(*) from public.guild_line_members where line_id = l.id) then
      perform app.fail('O tamanho vai de 1 a 4 e não pode ser menor que o número de jogadores atual.');
    end if;
    update public.guild_lines set name = v_name, size = coalesce((p ->> 'size')::int, size),
           recruiting = coalesce((p ->> 'recruiting')::boolean, recruiting), description = left(btrim(coalesce(p ->> 'description', description)), 200),
           req1_kind = case when p ? 'req1_kind' or p ? 'req2_kind' then v_k1 else req1_kind end, req1_value = case when p ? 'req1_kind' or p ? 'req2_kind' then v_v1 else req1_value end,
           req2_kind = case when p ? 'req1_kind' or p ? 'req2_kind' then v_k2 else req2_kind end, req2_value = case when p ? 'req1_kind' or p ? 'req2_kind' then v_v2 else req2_value end
     where id = l.id;
  elsif p_action = 'new_code' then
    update public.guild_lines set code = app.line_code() where id = l.id;
  elsif p_action = 'kick' then
    if p_user = l.leader_id then perform app.fail('Passe a liderança antes de remover o líder.'); end if;
    delete from public.guild_line_members where line_id = l.id and user_id = p_user;
    if not found then perform app.fail('Esse jogador não é da line.'); end if;
    perform app.notify(p_user, 'guilda', 'Você saiu da line ' || l.name, 'Removido por ' || me.nick || '.', jsonb_build_object('guild_id', l.guild_id));
  elsif p_action = 'transfer' then
    if not exists (select 1 from public.guild_line_members where line_id = l.id and user_id = p_user) then perform app.fail('Esse jogador não é da line.'); end if;
    update public.guild_line_members set role = 'membro' where line_id = l.id;
    update public.guild_line_members set role = 'lider' where line_id = l.id and user_id = p_user;
    update public.guild_lines set leader_id = p_user where id = l.id;
    perform app.notify(p_user, 'guilda', 'Você agora lidera a line ' || l.name, '', jsonb_build_object('guild_id', l.guild_id));
  elsif p_action = 'delete' then
    delete from public.guild_lines where id = l.id;
    return jsonb_build_object('ok', true, 'deleted', true);
  else
    perform app.fail('Ação inválida.');
  end if;
  return app.line_card((select x from public.guild_lines x where x.id = l.id), me.id);
end $$;

create or replace function public.leave_line() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; m public.guild_line_members;
begin
  me := app.require_user();
  delete from public.guild_line_members where user_id = me.id returning * into m;
  if not found then perform app.fail('Você não está numa line.'); end if;
  perform app.line_fix(m.line_id);
  return jsonb_build_object('ok', true);
end $$;

-- ================================================================ sinergia: conta quando a sala é finalizada
create or replace function app.line_synergy() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare x record; t record; v_pts int; v_new int;
begin
  for x in
    select m.line_id, count(*) n, l.size, l.name, l.synergy, l.synergy_tier
      from public.room_players rp
      join public.guild_line_members m on m.user_id = rp.user_id
      join public.guild_lines l on l.id = m.line_id
     where rp.room_id = new.id and rp.status = 'inscrito'
     group by m.line_id, l.size, l.name, l.synergy, l.synergy_tier
    having count(*) >= 2
  loop
    v_pts := 1 + case when x.n >= x.size then 1 else 0 end;
    insert into public.line_synergy_log (line_id, room_id, players, points) values (x.line_id, new.id, x.n, v_pts) on conflict do nothing;
    if not found then continue; end if;
    update public.guild_lines set synergy = synergy + v_pts where id = x.line_id returning synergy into v_new;
    -- níveis alcançados: todos da line ganham a recompensa
    for t in select * from app.synergy_tiers where tier > x.synergy_tier and points <= v_new order by tier loop
      insert into public.inventory (user_id, item_id, source) select m.user_id, t.item_id, 'recompensa' from public.guild_line_members m where m.line_id = x.line_id
        on conflict do nothing;
      update public.guild_lines set synergy_tier = t.tier where id = x.line_id;
      insert into public.notifications (user_id, kind, title, body, data)
        select m.user_id, 'nivel', 'Sinergia nível ' || t.tier || ' na line ' || x.name, 'Vocês jogaram juntos e ganharam: ' || t.label || '. Equipe no seu perfil.', '{}'::jsonb
          from public.guild_line_members m where m.line_id = x.line_id;
    end loop;
  end loop;
  return null;
end $$;
create trigger rooms_line_synergy after update of status on public.rooms
  for each row when (new.status = 'finalizada' and old.status is distinct from 'finalizada')
  execute function app.line_synergy();

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
grant execute on function app.in_thread(uuid, uuid) to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.svc_message_previews(bigint[]) from authenticated;
grant execute on function public.clear_push_token(text) to anon;
