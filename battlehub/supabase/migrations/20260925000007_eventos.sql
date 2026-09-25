-- BattleHub: eventos oficiais (liga semanal, campeonato de lines, intensivo de guildas, copa).
-- Cada queda é uma sala oficial ligada ao evento. Ao finalizar a queda, os pontos
-- (abates + colocação pela tabela do evento) entram na classificação.

-- ---------------------------------------------------------------- ajudantes
create or replace function app.event_prize_total(e public.events) returns bigint language sql immutable as $$
  select coalesce((select sum((x ->> 'cents')::bigint) from jsonb_array_elements(e.prizes) x), 0)
       + coalesce((select sum((x ->> 'cents')::bigint * case when x ->> 'type' = 'maior_pontuador_mapa'
                                                              then greatest(jsonb_array_length(coalesce(x -> 'maps', '[]')), 1) else 1 end)
                     from jsonb_array_elements(e.awards) x), 0)
$$;

-- entrada ativa de um jogador no evento
create or replace function app.event_entry_of(p_event uuid, p_user uuid) returns public.event_entries
language sql stable security definer set search_path = public, app as $$
  select * from public.event_entries where event_id = p_event and p_user = any (members) and status <> 'desistiu' limit 1
$$;

-- preço da inscrição para quem está na guilda p_guild (preço progressivo por line da mesma guilda)
create or replace function app.event_price(e public.events, p_guild uuid) returns bigint
language sql stable security definer set search_path = public, app as $$
  select case when jsonb_array_length(e.price_steps) = 0 or p_guild is null then e.entry_cents
              else (e.price_steps ->> least((select count(*)::int from public.event_entries x where x.event_id = e.id and x.guild_id = p_guild and x.status <> 'desistiu'),
                                            jsonb_array_length(e.price_steps) - 1))::bigint end
$$;

create or replace function app.event_card(e public.events) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object(
    'id', e.id, 'code', e.code, 'kind', e.kind, 'title', e.title, 'description', e.description, 'tier', e.tier, 'status', e.status,
    'entry_type', e.entry_type, 'line_size', e.line_size, 'entry_cents', e.entry_cents, 'price_steps', e.price_steps,
    'max_entries', e.max_entries, 'require_guild', e.require_guild, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'phases', e.phases, 'current_phase', e.current_phase, 'prizes', e.prizes, 'awards', e.awards, 'guild_points', e.guild_points,
    'prize_total_cents', app.event_prize_total(e), 'vault_cents', e.vault_cents,
    'entries', (select count(*) from public.event_entries x where x.event_id = e.id and x.status <> 'desistiu'),
    'rooms_live', (select count(*) from public.rooms r where r.event_id = e.id and r.status = 'em_andamento'),
    'my_entry', (select jsonb_build_object('id', x.id, 'name', x.name, 'status', x.status, 'captain', x.captain_id = auth.uid())
                   from public.event_entries x where x.event_id = e.id and auth.uid() = any (x.members) and x.status <> 'desistiu' limit 1))
$$;

-- classificação: pontos > booyahs > abates > melhor colocação
create or replace function app.event_standings(p_event uuid, p_phase int) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(q.row order by q.rank), '[]') from (
    select row_number() over (order by coalesce(sc.pts, 0) desc, coalesce(sc.boo, 0) desc, coalesce(sc.k, 0) desc, sc.best nulls last, x.created_at) as rank,
           jsonb_build_object('entry_id', x.id, 'name', x.name, 'status', x.status, 'group', x.group_label,
             'guild', (select jsonb_build_object('id', g.id, 'tag', g.tag, 'name', g.name, 'color', g.color) from public.guilds g where g.id = x.guild_id),
             'members', (select jsonb_agg(app.user_card(m)) from unnest(x.members) m),
             'points', coalesce(sc.pts, 0), 'kills', coalesce(sc.k, 0), 'booyahs', coalesce(sc.boo, 0),
             'best', sc.best, 'drops', coalesce(sc.n, 0),
             'rank', row_number() over (order by coalesce(sc.pts, 0) desc, coalesce(sc.boo, 0) desc, coalesce(sc.k, 0) desc, sc.best nulls last, x.created_at)) as row
      from public.event_entries x
      left join (select entry_id, sum(points) pts, sum(kills) k, count(*) filter (where booyah) boo, min(placement) best, count(*) n
                   from public.event_scores where event_id = p_event and (p_phase is null or phase = p_phase) group by entry_id) sc on sc.entry_id = x.id
     where x.event_id = p_event and x.status <> 'desistiu'
       and (p_phase is null or p_phase = 0 or x.status in ('classificado') or exists (select 1 from public.event_scores s2 where s2.entry_id = x.id and s2.phase = p_phase))
  ) q
$$;

-- pontua uma queda do evento (chamado ao finalizar a sala)
create or replace function app.event_score_room(p_room uuid, c jsonb) returns void
language plpgsql security definer set search_path = public, app as $$
declare r public.rooms; e public.events; u jsonb; x record; v_kills int; v_place int;
begin
  select * into r from public.rooms where id = p_room;
  select * into e from public.events where id = r.event_id;
  if not found then return; end if;
  -- na liga individual, quem jogou uma queda entra na classificação automaticamente
  if e.entry_type = 'jogador' then
    for u in select * from jsonb_array_elements(c -> 'players') loop
      if (app.event_entry_of(e.id, (u ->> 'user_id')::uuid)).id is null then
        insert into public.event_entries (event_id, name, captain_id, guild_id, members, status)
        select e.id, coalesce(p.nick, 'Jogador ' || p.code), p.id, p.guild_id, array[p.id], case when e.current_phase = 0 then 'inscrito' else 'classificado' end
          from public.profiles p where p.id = (u ->> 'user_id')::uuid;
      end if;
    end loop;
  end if;
  for x in select ee.id, ee.members from public.event_entries ee where ee.event_id = e.id and ee.status <> 'desistiu'
            and exists (select 1 from jsonb_array_elements(c -> 'players') pl where (pl ->> 'user_id')::uuid = any (ee.members)) loop
    select coalesce(sum((pl ->> 'kills')::int), 0), min(nullif(pl ->> 'placement', '')::int) into v_kills, v_place
      from jsonb_array_elements(c -> 'players') pl where (pl ->> 'user_id')::uuid = any (x.members);
    insert into public.event_scores (room_id, entry_id, event_id, phase, map, kills, placement, points, booyah)
    values (r.id, x.id, e.id, coalesce(r.phase, e.current_phase), r.map, v_kills, v_place, app.points(e.points, v_kills, v_place), v_place = 1)
    on conflict (room_id, entry_id) do update set kills = excluded.kills, placement = excluded.placement, points = excluded.points, booyah = excluded.booyah;
  end loop;
end $$;

-- ---------------------------------------------------------------- jogador
create or replace function public.list_events(p_tab text default 'ativos') returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_user();
  return coalesce((select jsonb_agg(app.event_card(e) order by
            case when p_tab = 'encerrados' then extract(epoch from coalesce(e.finished_at, e.created_at)) * -1 else extract(epoch from coalesce(e.starts_at, e.created_at)) end)
    from public.events e
   where case p_tab when 'encerrados' then e.status in ('finalizado', 'cancelado')
                    when 'meus' then exists (select 1 from public.event_entries x where x.event_id = e.id and auth.uid() = any (x.members) and x.status <> 'desistiu')
                    else e.status in ('inscricoes', 'andamento') end
   limit 60), '[]');
end $$;

create or replace function public.get_event(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; v_phase jsonb := '[]'; i int;
begin
  me := app.require_user();
  select * into e from public.events where id = p_id;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  for i in 0 .. greatest(jsonb_array_length(e.phases) - 1, 0) loop
    v_phase := v_phase || jsonb_build_array(case when i <= e.current_phase then app.event_standings(e.id, i) else '[]'::jsonb end);
  end loop;
  return app.event_card(e) || jsonb_build_object(
    'rules', e.rules, 'points', e.points, 'results', e.results, 'cancel_reason', e.cancel_reason, 'finished_at', e.finished_at,
    'can_manage', app.role_level(me.role) >= 2,
    'my_price_cents', app.event_price(e, me.guild_id),
    'my_guild', (select jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag) from public.guilds g where g.id = me.guild_id),
    'standings', v_phase,
    'overall', app.event_standings(e.id, null),
    'rooms', coalesce((select jsonb_agg(app.room_summary(r) order by r.phase, r.starts_at, r.group_label) from public.rooms r where r.event_id = e.id and r.status <> 'cancelada'), '[]'),
    'guild_table', coalesce((select jsonb_agg(jsonb_build_object('guild', jsonb_build_object('id', g.id, 'tag', g.tag, 'name', g.name, 'color', g.color), 'points', w.points, 'place', w.place) order by w.points desc)
                               from public.guild_week_points w join public.guilds g on g.id = w.guild_id where w.event_id = e.id), '[]'));
end $$;

-- inscreve o jogador ou a line (o capitão paga a inscrição da line)
create or replace function public.event_register(p_id uuid, p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; v_name text := btrim(coalesce(p ->> 'name', '')); v_members uuid[] := '{}'; m jsonb; v_uid uuid;
        t public.profiles; v_price bigint; v_id uuid; v_n int;
begin
  me := app.require_user();
  select * into e from public.events where id = p_id for update;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  if e.status <> 'inscricoes' then perform app.fail('As inscrições deste evento estão fechadas.'); end if;
  if me.ff_id is null then perform app.fail('Cadastre seu nick e ID do Free Fire no perfil antes de se inscrever.'); end if;
  if e.max_entries is not null and (select count(*) from public.event_entries where event_id = e.id and status <> 'desistiu') >= e.max_entries then
    perform app.fail('O evento já tem todas as ' || e.max_entries || ' vagas preenchidas.');
  end if;
  if e.entry_type = 'jogador' then
    v_members := array[me.id]; v_name := coalesce(me.nick, 'Jogador ' || me.code);
  else
    if length(v_name) < 2 or length(v_name) > 24 then perform app.fail('O nome da line precisa ter de 2 a 24 caracteres.'); end if;
    v_members := array[me.id];
    for m in select * from jsonb_array_elements(coalesce(p -> 'members', '[]')) loop
      if jsonb_typeof(m) = 'number' or (m #>> '{}') ~ '^#?\d+$' then
        select id into v_uid from public.profiles where code = ltrim(m #>> '{}', '#')::int;
      else
        v_uid := (m #>> '{}')::uuid;
      end if;
      if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then perform app.fail('Jogador ' || (m #>> '{}') || ' não encontrado.'); end if;
      if v_uid = any (v_members) then continue; end if;
      v_members := v_members || v_uid;
    end loop;
    if array_length(v_members, 1) <> e.line_size then
      perform app.fail('A line precisa ter ' || e.line_size || ' jogadores contando com você (tem ' || array_length(v_members, 1) || ').');
    end if;
  end if;
  foreach v_uid in array v_members loop
    select * into t from public.profiles where id = v_uid;
    if app.is_banned(t) then perform app.fail(coalesce(t.nick, 'Um jogador') || ' está suspenso.'); end if;
    if t.ff_id is null then perform app.fail(coalesce(t.nick, 'Um jogador') || ' ainda não cadastrou o ID do Free Fire.'); end if;
    if (app.event_entry_of(e.id, v_uid)).id is not null then perform app.fail(coalesce(t.nick, 'Um jogador') || ' já está inscrito neste evento.'); end if;
    if e.require_guild and (t.guild_id is null or t.guild_id is distinct from me.guild_id) then
      perform app.fail('Evento de guildas: todos da line precisam ser da mesma guilda que você.');
    end if;
  end loop;
  if e.require_guild and me.guild_id is null then perform app.fail('Evento de guildas: entre numa guilda para inscrever uma line.'); end if;
  if exists (select 1 from public.event_entries where event_id = e.id and lower(name) = lower(v_name) and status <> 'desistiu') then
    perform app.fail('Já existe uma line com esse nome no evento.');
  end if;
  v_price := app.event_price(e, me.guild_id);
  if v_price > 0 then
    perform app.credit(me.id, -v_price, 'inscricao_evento', 'Inscrição · ' || e.title || ' (evento #' || e.code || ')', 'event', e.id::text);
    update public.events set vault_cents = vault_cents + v_price where id = e.id;
  end if;
  insert into public.event_entries (event_id, name, captain_id, guild_id, members, paid_cents)
  values (e.id, v_name, me.id, me.guild_id, v_members, v_price) returning id into v_id;
  foreach v_uid in array v_members loop
    if v_uid <> me.id then
      perform app.notify(v_uid, 'evento', 'Você está na line ' || v_name, me.nick || ' inscreveu vocês em ' || e.title || '.', jsonb_build_object('event_id', e.id));
    end if;
  end loop;
  perform app.log('Inscreveu no evento', e.title, v_name || ' · ' || app.brl(v_price));
  return public.get_event(e.id);
end $$;

create or replace function public.event_withdraw(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; x public.event_entries;
begin
  me := app.require_user();
  select * into e from public.events where id = p_id for update;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  if e.status <> 'inscricoes' then perform app.fail('O evento já começou. Fale com a organização.'); end if;
  x := app.event_entry_of(e.id, me.id);
  if x.id is null then perform app.fail('Você não está inscrito neste evento.'); end if;
  if x.captain_id <> me.id then perform app.fail('Só o capitão pode tirar a line do evento.'); end if;
  update public.event_entries set status = 'desistiu' where id = x.id;
  if x.paid_cents > 0 then
    update public.events set vault_cents = vault_cents - x.paid_cents where id = e.id;
    perform app.credit(me.id, x.paid_cents, 'reembolso', 'Saída do evento · ' || e.title, 'event', e.id::text);
  end if;
  return public.get_event(e.id);
end $$;

-- ranking de guildas pelos pontos dos eventos (semana, mês ou geral)
create or replace function public.guild_ranking(p_period text default 'semana') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_from date := case p_period
  when 'semana' then date_trunc('week', now() at time zone 'America/Sao_Paulo')::date
  when 'mes' then date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
  else date '2000-01-01' end;
begin
  perform app.require_user();
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('guild', jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'color', g.color,
                         'members', (select count(*) from public.guild_members gm where gm.guild_id = g.id)), 'points', q.pts, 'events', q.n) order by q.pts desc)
        from (select guild_id, sum(points) pts, count(distinct event_id) n from public.guild_week_points where week >= v_from group by guild_id) q
        join public.guilds g on g.id = q.guild_id), '[]'),
    'champion_last_week', (select jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'color', g.color, 'points', q.pts)
        from (select guild_id, sum(points) pts from public.guild_week_points
               where week = (date_trunc('week', now() at time zone 'America/Sao_Paulo') - interval '7 days')::date group by guild_id order by 2 desc limit 1) q
        join public.guilds g on g.id = q.guild_id));
end $$;

-- ---------------------------------------------------------------- administração
create or replace function public.admin_event_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; v_id uuid := nullif(p ->> 'id', '')::uuid; v_title text := btrim(coalesce(p ->> 'title', ''));
        v_has_entries boolean := false; x jsonb;
begin
  me := app.require_level(2);
  if length(v_title) < 3 or length(v_title) > 60 then perform app.fail('O nome do evento precisa ter de 3 a 60 caracteres.'); end if;
  if coalesce(p ->> 'kind', '') not in ('liga', 'campeonato', 'intensivo', 'copa') then perform app.fail('Escolha o tipo do evento.'); end if;
  if coalesce(p ->> 'entry_type', 'line') not in ('jogador', 'line') then perform app.fail('Inscrição por jogador ou por line.'); end if;
  if coalesce((p ->> 'line_size')::int, 4) not in (1, 2, 4) then perform app.fail('A line tem 1, 2 ou 4 jogadores.'); end if;
  if jsonb_typeof(coalesce(p -> 'phases', '[]')) <> 'array' or jsonb_array_length(coalesce(p -> 'phases', '[]')) = 0 then perform app.fail('O evento precisa de pelo menos uma fase.'); end if;
  if jsonb_typeof(coalesce(p -> 'points' -> 'place', '[]')) <> 'array' then perform app.fail('Tabela de pontos inválida.'); end if;
  for x in select * from jsonb_array_elements(coalesce(p -> 'prizes', '[]')) loop
    if coalesce((x ->> 'cents')::bigint, 0) < 0 or coalesce((x ->> 'place')::int, 0) < 1 then perform app.fail('Prêmios inválidos.'); end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'awards', '[]')) loop
    if coalesce(x ->> 'type', '') not in ('mvp', 'line_agressiva', 'maior_pontuador_mapa', 'dominio', 'clutch', 'line_tatica', 'destaque') then
      perform app.fail('Bônus de evento desconhecido: ' || coalesce(x ->> 'type', '?') || '.');
    end if;
  end loop;
  if v_id is not null then
    select * into e from public.events where id = v_id for update;
    if not found then perform app.fail('Evento não encontrado.'); end if;
    if e.status in ('finalizado', 'cancelado') then perform app.fail('Esse evento já foi encerrado.'); end if;
    v_has_entries := exists (select 1 from public.event_entries where event_id = e.id and status <> 'desistiu');
    if v_has_entries and (e.entry_cents <> coalesce((p ->> 'entry_cents')::bigint, 0) or e.price_steps <> coalesce(p -> 'price_steps', '[]')
                          or e.line_size <> coalesce((p ->> 'line_size')::int, 4) or e.entry_type <> coalesce(p ->> 'entry_type', 'line')) then
      perform app.fail('Com inscritos, o valor e o tamanho da line não mudam.');
    end if;
    if v_has_entries and app.event_prize_total(e) > coalesce((select sum((z ->> 'cents')::bigint) from jsonb_array_elements(coalesce(p -> 'prizes', '[]')) z), 0)
                                                    + coalesce((select sum((z ->> 'cents')::bigint * case when z ->> 'type' = 'maior_pontuador_mapa' then greatest(jsonb_array_length(coalesce(z -> 'maps', '[]')), 1) else 1 end)
                                                                  from jsonb_array_elements(coalesce(p -> 'awards', '[]')) z), 0) then
      perform app.fail('Com inscritos, a premiação só pode aumentar.');
    end if;
    update public.events set kind = p ->> 'kind', title = v_title, description = left(coalesce(p ->> 'description', ''), 400), rules = left(coalesce(p ->> 'rules', ''), 4000),
           tier = nullif(p ->> 'tier', ''), entry_type = coalesce(p ->> 'entry_type', 'line'), line_size = coalesce((p ->> 'line_size')::int, 4),
           entry_cents = coalesce((p ->> 'entry_cents')::bigint, 0), price_steps = coalesce(p -> 'price_steps', '[]'), max_entries = nullif(p ->> 'max_entries', '')::int,
           require_guild = coalesce((p ->> 'require_guild')::boolean, false), points = coalesce(p -> 'points', points), phases = p -> 'phases',
           prizes = coalesce(p -> 'prizes', '[]'), awards = coalesce(p -> 'awards', '[]'), guild_points = coalesce(p -> 'guild_points', '[]'),
           starts_at = nullif(p ->> 'starts_at', '')::timestamptz, ends_at = nullif(p ->> 'ends_at', '')::timestamptz
     where id = e.id;
  else
    insert into public.events (kind, title, description, rules, tier, entry_type, line_size, entry_cents, price_steps, max_entries, require_guild,
                               points, phases, prizes, awards, guild_points, starts_at, ends_at, created_by)
    values (p ->> 'kind', v_title, left(coalesce(p ->> 'description', ''), 400), left(coalesce(p ->> 'rules', ''), 4000), nullif(p ->> 'tier', ''),
            coalesce(p ->> 'entry_type', 'line'), coalesce((p ->> 'line_size')::int, 4), coalesce((p ->> 'entry_cents')::bigint, 0),
            coalesce(p -> 'price_steps', '[]'), nullif(p ->> 'max_entries', '')::int, coalesce((p ->> 'require_guild')::boolean, false),
            coalesce(p -> 'points', '{"kill":1,"place":[12,9,8,7,6,5,4,3,2,1]}'), p -> 'phases', coalesce(p -> 'prizes', '[]'), coalesce(p -> 'awards', '[]'),
            coalesce(p -> 'guild_points', '[]'), nullif(p ->> 'starts_at', '')::timestamptz, nullif(p ->> 'ends_at', '')::timestamptz, me.id)
    returning id into v_id;
  end if;
  perform app.log(case when p ->> 'id' is null then 'Criou evento' else 'Editou evento' end, v_title, (p ->> 'kind'));
  return public.get_event(v_id);
end $$;

create or replace function public.admin_event_status(p_id uuid, p_status text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; x record; r record; v_refund bigint := 0;
begin
  me := app.require_level(2);
  select * into e from public.events where id = p_id for update;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  if p_status = 'andamento' then
    if e.status <> 'inscricoes' then perform app.fail('O evento já começou ou foi encerrado.'); end if;
    update public.events set status = 'andamento' where id = e.id;
    for x in select unnest(members) uid from public.event_entries where event_id = e.id and status <> 'desistiu' loop
      perform app.notify(x.uid, 'evento', e.title || ' começou', 'Acompanhe as quedas e a classificação no app.', jsonb_build_object('event_id', e.id));
    end loop;
    perform app.log('Iniciou evento', e.title);
  elsif p_status = 'inscricoes' then
    if e.status <> 'andamento' or exists (select 1 from public.event_scores where event_id = e.id) then perform app.fail('Só dá para reabrir inscrições antes da primeira queda.'); end if;
    update public.events set status = 'inscricoes' where id = e.id;
  elsif p_status = 'cancelado' then
    if e.status in ('finalizado', 'cancelado') then perform app.fail('Esse evento já foi encerrado.'); end if;
    if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo do cancelamento.'); end if;
    for r in select id from public.rooms where event_id = e.id and status in ('aberta', 'em_andamento') loop
      perform public.cancel_room(r.id, 'Evento cancelado: ' || p_reason);
    end loop;
    select * into e from public.events where id = p_id for update;
    for x in select * from public.event_entries where event_id = e.id and status <> 'desistiu' and paid_cents > 0 loop
      perform app.credit(x.captain_id, x.paid_cents, 'reembolso', 'Evento cancelado · ' || e.title, 'event', e.id::text);
      v_refund := v_refund + x.paid_cents;
    end loop;
    if e.vault_cents - v_refund < 0 then
      perform app.platform('cobertura_evento', -(v_refund - e.vault_cents), 'Reembolso do evento cancelado · ' || e.title, 'event', e.id::text);
    elsif e.vault_cents - v_refund > 0 then
      perform app.platform('lucro_evento', e.vault_cents - v_refund, 'Sobra do evento cancelado · ' || e.title, 'event', e.id::text);
    end if;
    for x in select distinct unnest(members) uid from public.event_entries where event_id = e.id and status <> 'desistiu' loop
      perform app.notify(x.uid, 'evento', e.title || ' foi cancelado', 'Motivo: ' || p_reason || '. A inscrição foi devolvida ao capitão.', jsonb_build_object('event_id', e.id));
    end loop;
    update public.events set status = 'cancelado', cancel_reason = p_reason, vault_cents = 0, finished_at = now() where id = e.id;
    perform app.log('Cancelou evento', e.title, p_reason);
  else
    perform app.fail('Situação inválida.');
  end if;
  return public.get_event(e.id);
end $$;

-- cria as quedas da fase atual. Em evento de line, divide as lines em grupos e já coloca todos nas salas.
-- p: {count, starts_at, interval_min, maps:[], mechanics:[], prizes:[], entry_cents, max_players}
create or replace function public.admin_event_drops(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; v_count int := coalesce((p ->> 'count')::int, 1); v_start timestamptz := (p ->> 'starts_at')::timestamptz;
        v_gap int := coalesce((p ->> 'interval_min')::int, 25); v_maps jsonb := coalesce(p -> 'maps', '["Bermuda"]');
        v_max int := coalesce((p ->> 'max_players')::int, 48); v_per int; v_alive uuid[]; v_groups int; g int; d int; v_label text;
        v_room public.rooms; v_phase_name text; v_members uuid[]; v_uid uuid; v_mech jsonb := '[]'; v_prizes jsonb := '[]'; z jsonb; v_created int := 0;
        v_restricted boolean; v_entry bigint := 0;
begin
  me := app.require_level(2);
  select * into e from public.events where id = p_id for update;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  if e.status not in ('inscricoes', 'andamento') then perform app.fail('O evento já foi encerrado.'); end if;
  if v_count < 1 or v_count > 20 then perform app.fail('Crie de 1 a 20 quedas por vez.'); end if;
  if v_start is null or v_start < now() + interval '2 minutes' then perform app.fail('Marque o horário da primeira queda no futuro.'); end if;
  if v_max < 2 or v_max > 100 then perform app.fail('A sala aceita de 2 a 100 jogadores.'); end if;
  if jsonb_typeof(v_maps) <> 'array' or jsonb_array_length(v_maps) = 0 then v_maps := '["Bermuda"]'; end if;
  for z in select * from jsonb_array_elements(coalesce(p -> 'mechanics', '[]')) loop
    if coalesce((z ->> 'cents')::bigint, 0) > 0 and exists (select 1 from public.mechanic_types where id = z ->> 'type') then
      v_mech := v_mech || jsonb_build_object('type', z ->> 'type', 'cents', (z ->> 'cents')::bigint) || case when z ? 'n' then jsonb_build_object('n', (z ->> 'n')::int) else '{}' end;
    end if;
  end loop;
  for z in select * from jsonb_array_elements(coalesce(p -> 'prizes', '[]')) loop
    if coalesce((z ->> 'cents')::bigint, 0) > 0 then v_prizes := v_prizes || jsonb_build_object('place', (z ->> 'place')::int, 'cents', (z ->> 'cents')::bigint); end if;
  end loop;
  v_phase_name := coalesce(e.phases -> e.current_phase ->> 'name', 'Fase ' || (e.current_phase + 1));
  v_restricted := e.entry_type = 'line' or e.current_phase > 0;

  if not v_restricted then
    -- liga individual: salas abertas, cada um paga a inscrição da queda
    v_entry := greatest(coalesce((p ->> 'entry_cents')::bigint, 0), 0);
    for d in 1 .. v_count loop
      insert into public.rooms (creator_id, title, rules, mode, team_size, map, max_players, entry_cents, prizes, mechanics, starts_at, fee_pct,
                                official, featured, event_id, phase, drop_no, restricted, tier)
      values (me.id, left(e.title || ' · Queda ' || ((select count(*) from public.rooms where event_id = e.id and phase = e.current_phase) + 1), 60),
              e.rules, 'Battle Royale', 1, v_maps ->> ((d - 1) % jsonb_array_length(v_maps)), v_max, v_entry, v_prizes, v_mech,
              v_start + make_interval(mins => v_gap * (d - 1)), 0, true, true, e.id, e.current_phase, d, false, e.tier)
      returning * into v_room;
      insert into public.room_secrets (room_id) values (v_room.id);
      v_created := v_created + 1;
    end loop;
  else
    -- lines (ou os classificados da grande final) divididas em grupos
    select array_agg(id order by created_at) into v_alive from public.event_entries
     where event_id = e.id and status = case when e.current_phase = 0 then 'inscrito' else 'classificado' end;
    if v_alive is null then perform app.fail('Não há inscritos ativos nesta fase.'); end if;
    v_per := greatest(v_max / e.line_size, 1);
    v_groups := ceil(array_length(v_alive, 1)::numeric / v_per)::int;
    for g in 1 .. v_groups loop
      v_label := case when v_groups > 1 then chr(64 + g) end;
      update public.event_entries set group_label = v_label
       where id = any (v_alive[((g - 1) * v_per + 1):(g * v_per)]);
    end loop;
    for g in 1 .. v_groups loop
      v_label := case when v_groups > 1 then chr(64 + g) end;
      select array_agg(m) into v_members from (select unnest(x.members) m from public.event_entries x
                                                 where x.id = any (v_alive) and x.group_label is not distinct from v_label) q;
      for d in 1 .. v_count loop
        insert into public.rooms (creator_id, title, rules, mode, team_size, map, max_players, entry_cents, prizes, mechanics, starts_at, fee_pct,
                                  official, featured, event_id, phase, group_label, drop_no, restricted, tier)
        values (me.id, left(e.title || ' · ' || v_phase_name || coalesce(' · Grupo ' || v_label, '') || ' · Queda ' || d, 60),
                e.rules, 'Battle Royale', case when e.line_size in (2, 4) then e.line_size else 1 end,
                v_maps ->> ((d - 1) % jsonb_array_length(v_maps)), greatest(v_per * e.line_size, array_length(v_members, 1)), 0, v_prizes, v_mech,
                v_start + make_interval(mins => v_gap * (d - 1)), 0, true, true, e.id, e.current_phase, v_label, d, true, e.tier)
        returning * into v_room;
        insert into public.room_secrets (room_id) values (v_room.id);
        foreach v_uid in array v_members loop
          insert into public.room_players (room_id, user_id, paid_cents) values (v_room.id, v_uid, 0) on conflict do nothing;
        end loop;
        v_created := v_created + 1;
      end loop;
      foreach v_uid in array v_members loop
        perform app.notify(v_uid, 'evento', e.title || ': quedas marcadas', v_phase_name || coalesce(' · Grupo ' || v_label, '') || ' · ' || v_count || ' queda' || case when v_count > 1 then 's' else '' end
          || ' a partir de ' || to_char(v_start at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.', jsonb_build_object('event_id', e.id));
      end loop;
    end loop;
  end if;
  if e.status = 'inscricoes' then update public.events set status = 'andamento' where id = e.id; end if;
  perform app.log('Criou quedas do evento', e.title, v_created || ' sala(s) · ' || v_phase_name);
  return public.get_event(e.id);
end $$;

-- fecha a fase: os N primeiros passam, os outros ficam eliminados
create or replace function public.admin_event_close_phase(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; v_q int; st jsonb; x jsonb; v_next text;
begin
  me := app.require_level(2);
  select * into e from public.events where id = p_id for update;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  if e.status <> 'andamento' then perform app.fail('O evento precisa estar em andamento.'); end if;
  if e.current_phase >= jsonb_array_length(e.phases) - 1 then perform app.fail('Esta é a última fase. Use "Finalizar e pagar".'); end if;
  if exists (select 1 from public.rooms where event_id = e.id and phase = e.current_phase and status in ('aberta', 'em_andamento')) then
    perform app.fail('Ainda há quedas desta fase abertas ou ao vivo. Finalize ou cancele antes.');
  end if;
  v_q := coalesce((e.phases -> e.current_phase ->> 'qualify')::int, 0);
  if v_q <= 0 then perform app.fail('Defina quantos se classificam nesta fase.'); end if;
  st := app.event_standings(e.id, e.current_phase);
  for x in select * from jsonb_array_elements(st) loop
    if (x ->> 'status') not in ('inscrito', 'classificado') then continue; end if;
    update public.event_entries set status = case when (x ->> 'rank')::int <= v_q then 'classificado' else 'eliminado' end, group_label = null
     where id = (x ->> 'entry_id')::uuid;
  end loop;
  update public.events set current_phase = current_phase + 1 where id = e.id;
  v_next := coalesce(e.phases -> (e.current_phase + 1) ->> 'name', 'próxima fase');
  for x in select jsonb_build_object('uid', m, 'ok', ee.status = 'classificado') from public.event_entries ee, unnest(ee.members) m
            where ee.event_id = e.id and ee.status in ('classificado', 'eliminado') loop
    perform app.notify((x ->> 'uid')::uuid, 'evento', case when (x ->> 'ok')::boolean then 'Classificado para ' || v_next else 'Fim da linha em ' || e.title end,
      case when (x ->> 'ok')::boolean then 'Sua line passou de fase em ' || e.title || '.' else 'Obrigado por jogar. Veja a classificação no app.' end, jsonb_build_object('event_id', e.id));
  end loop;
  perform app.log('Fechou fase do evento', e.title, 'Top ' || v_q || ' → ' || v_next);
  return public.get_event(e.id);
end $$;

-- calcula a premiação final do evento (sem gravar)
-- p_picks: {"clutch": uuid, "destaque": uuid, "line_tatica": entry_id}
create or replace function app.event_payout(p_id uuid, p_picks jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
declare e public.events; st jsonb; x jsonb; aw jsonb; v_lines jsonb := '[]'; v_total bigint; v_entry public.event_entries; v_ids uuid[];
        v_max bigint; v_map text; v_cents bigint; v_guild jsonb := '[]'; v_gp jsonb; i int; v_pick uuid; v_short bigint; v_unpaid bigint := 0;
begin
  select * into e from public.events where id = p_id;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  -- colocação final: quem chegou na última fase primeiro, depois os eliminados pela pontuação geral
  st := app.event_standings(e.id, e.current_phase);
  if e.current_phase > 0 then
    st := st || coalesce((select jsonb_agg(o order by (o ->> 'rank')::int) from jsonb_array_elements(app.event_standings(e.id, null)) o
                           where not exists (select 1 from jsonb_array_elements(st) f where f ->> 'entry_id' = o ->> 'entry_id')), '[]');
  end if;
  if jsonb_array_length(st) = 0 or not exists (select 1 from public.event_scores where event_id = e.id) then perform app.fail('Ninguém pontuou neste evento ainda.'); end if;

  create temp table if not exists _ev_lines (entry_id uuid, user_id uuid, kind text, cents bigint, note text) on commit drop;
  delete from _ev_lines;

  -- prêmios por colocação: dividido igualmente entre os membros da line
  for x in select * from jsonb_array_elements(e.prizes) loop
    select * into v_entry from public.event_entries where id = (st -> ((x ->> 'place')::int - 1) ->> 'entry_id')::uuid;
    if v_entry.id is null or (x ->> 'cents')::bigint <= 0 then v_unpaid := v_unpaid + coalesce((x ->> 'cents')::bigint, 0); continue; end if;
    perform app.event_split(v_entry.id, 'evento_premio', (x ->> 'cents')::bigint, (x ->> 'place') || 'º lugar · ' || e.title);
  end loop;

  for aw in select * from jsonb_array_elements(e.awards) loop
    v_cents := (aw ->> 'cents')::bigint;
    if coalesce(v_cents, 0) <= 0 then continue; end if;
    if aw ->> 'type' = 'mvp' then
      -- jogador com mais abates no evento
      select max(k) into v_max from (select rp.user_id, sum(rp.kills) k from public.room_players rp join public.rooms r on r.id = rp.room_id
                                      where r.event_id = e.id and r.status = 'finalizada' and rp.status = 'inscrito' group by rp.user_id) q;
      if coalesce(v_max, 0) > 0 then
        select array_agg(user_id order by user_id) into v_ids from (select rp.user_id, sum(rp.kills) k from public.room_players rp join public.rooms r on r.id = rp.room_id
                                      where r.event_id = e.id and r.status = 'finalizada' and rp.status = 'inscrito' group by rp.user_id) q where k = v_max;
        for i in 1 .. array_length(v_ids, 1) loop
          insert into _ev_lines values ((app.event_entry_of(e.id, v_ids[i])).id, v_ids[i], 'evento_bonus',
            v_cents / array_length(v_ids, 1) + case when i = 1 then v_cents - (v_cents / array_length(v_ids, 1)) * array_length(v_ids, 1) else 0 end, 'MVP do evento (' || v_max || ' abates)');
        end loop;
      else v_unpaid := v_unpaid + v_cents; end if;
    elsif aw ->> 'type' = 'line_agressiva' then
      select max(k) into v_max from (select entry_id, sum(kills) k from public.event_scores where event_id = e.id group by entry_id) q;
      if coalesce(v_max, 0) > 0 then
        select array_agg(entry_id) into v_ids from (select entry_id, sum(kills) k from public.event_scores where event_id = e.id group by entry_id) q where k = v_max;
        for i in 1 .. array_length(v_ids, 1) loop
          perform app.event_split(v_ids[i], 'evento_bonus', v_cents / array_length(v_ids, 1) + case when i = 1 then v_cents - (v_cents / array_length(v_ids, 1)) * array_length(v_ids, 1) else 0 end, 'Line mais agressiva (' || v_max || ' abates)');
        end loop;
      else v_unpaid := v_unpaid + v_cents; end if;
    elsif aw ->> 'type' = 'dominio' then
      select max(b) into v_max from (select entry_id, count(*) filter (where booyah) b from public.event_scores where event_id = e.id group by entry_id) q;
      if coalesce(v_max, 0) >= 2 then
        select array_agg(entry_id) into v_ids from (select entry_id, count(*) filter (where booyah) b from public.event_scores where event_id = e.id group by entry_id) q where b = v_max;
        for i in 1 .. array_length(v_ids, 1) loop
          perform app.event_split(v_ids[i], 'evento_bonus', v_cents / array_length(v_ids, 1) + case when i = 1 then v_cents - (v_cents / array_length(v_ids, 1)) * array_length(v_ids, 1) else 0 end, 'Domínio absoluto (' || v_max || ' Booyahs)');
        end loop;
      else v_unpaid := v_unpaid + v_cents; end if;
    elsif aw ->> 'type' = 'maior_pontuador_mapa' then
      for v_map in select jsonb_array_elements_text(coalesce(aw -> 'maps', '[]')) loop
        select max(pt) into v_max from (select entry_id, sum(points) pt from public.event_scores where event_id = e.id and map = v_map group by entry_id) q;
        if coalesce(v_max, 0) > 0 then
          select array_agg(entry_id) into v_ids from (select entry_id, sum(points) pt from public.event_scores where event_id = e.id and map = v_map group by entry_id) q where pt = v_max;
          for i in 1 .. array_length(v_ids, 1) loop
            perform app.event_split(v_ids[i], 'evento_bonus', v_cents / array_length(v_ids, 1) + case when i = 1 then v_cents - (v_cents / array_length(v_ids, 1)) * array_length(v_ids, 1) else 0 end, 'Maior pontuador em ' || v_map);
          end loop;
        else v_unpaid := v_unpaid + v_cents; end if;
      end loop;
    elsif aw ->> 'type' in ('clutch', 'destaque') then
      v_pick := nullif(p_picks ->> (aw ->> 'type'), '')::uuid;
      if v_pick is null then v_unpaid := v_unpaid + v_cents;
      else
        if (app.event_entry_of(e.id, v_pick)).id is null then perform app.fail('Quem recebe o bônus precisa estar inscrito no evento.'); end if;
        insert into _ev_lines values ((app.event_entry_of(e.id, v_pick)).id, v_pick, 'evento_bonus', v_cents, case aw ->> 'type' when 'clutch' then 'Clutch extremo' else 'Destaque do evento' end);
      end if;
    elsif aw ->> 'type' = 'line_tatica' then
      v_pick := nullif(p_picks ->> 'line_tatica', '')::uuid;
      if v_pick is null then v_unpaid := v_unpaid + v_cents;
      else
        if not exists (select 1 from public.event_entries where id = v_pick and event_id = e.id and status <> 'desistiu') then perform app.fail('Escolha uma line do evento.'); end if;
        perform app.event_split(v_pick, 'evento_bonus', v_cents, 'Line mais tática');
      end if;
    end if;
  end loop;

  -- pontos das guildas (10/7/5/3/1 para as melhores lines com guilda)
  -- pontos das guildas pela colocação final (1º = 10, 2º = 7...), só para lines com guilda
  if jsonb_array_length(e.guild_points) > 0 then
    for i in 0 .. least(jsonb_array_length(e.guild_points), jsonb_array_length(st)) - 1 loop
      x := st -> i;
      if x -> 'guild' ->> 'id' is null or coalesce((e.guild_points ->> i)::int, 0) <= 0 then continue; end if;
      v_guild := v_guild || jsonb_build_object('guild_id', x -> 'guild' ->> 'id', 'guild', x -> 'guild', 'entry', x ->> 'name', 'place', i + 1, 'points', (e.guild_points ->> i)::int);
    end loop;
  end if;

  select coalesce(sum(cents), 0) into v_total from _ev_lines;
  v_short := greatest(v_total - e.vault_cents, 0);
  select coalesce(jsonb_agg(jsonb_build_object('entry_id', entry_id, 'user_id', user_id, 'kind', kind, 'cents', cents, 'note', note, 'user', app.user_card(user_id))), '[]') into v_lines from _ev_lines;
  return jsonb_build_object('vault_cents', e.vault_cents, 'payout_cents', v_total, 'unpaid_cents', v_unpaid,
    'cover_platform_cents', v_short, 'platform_cents', greatest(e.vault_cents - v_total, 0),
    'lines', v_lines, 'standings', st, 'guild_points', v_guild, 'champion', st -> 0);
end $$;

-- divide um valor entre os membros de uma line (a sobra do centavo fica com o capitão)
create or replace function app.event_split(p_entry uuid, p_kind text, p_cents bigint, p_note text) returns void
language plpgsql security definer set search_path = public, app as $$
declare x public.event_entries; v_n int; v_part bigint; i int;
begin
  select * into x from public.event_entries where id = p_entry;
  v_n := array_length(x.members, 1); v_part := p_cents / v_n;
  for i in 1 .. v_n loop
    insert into _ev_lines values (x.id, x.members[i], p_kind, v_part + case when x.members[i] = x.captain_id then p_cents - v_part * v_n else 0 end, p_note);
  end loop;
end $$;

create or replace function public.admin_event_preview(p_id uuid, p_picks jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return app.event_payout(p_id, coalesce(p_picks, '{}'));
end $$;

create or replace function public.admin_event_finish(p_id uuid, p_picks jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e public.events; c jsonb; u record; v_gross bigint; v_cut bigint; g public.guilds; x jsonb; v_week date; v_champ uuid;
begin
  me := app.require_level(2);
  select * into e from public.events where id = p_id for update;
  if not found then perform app.fail('Evento não encontrado.'); end if;
  if e.status <> 'andamento' then perform app.fail('O evento precisa estar em andamento.'); end if;
  if exists (select 1 from public.rooms where event_id = e.id and status in ('aberta', 'em_andamento')) then
    perform app.fail('Ainda há quedas abertas ou ao vivo. Finalize ou cancele antes.');
  end if;
  c := app.event_payout(p_id, coalesce(p_picks, '{}'));
  if (c ->> 'cover_platform_cents')::bigint > 0 then
    perform app.platform('cobertura_evento', -(c ->> 'cover_platform_cents')::bigint, 'Plataforma completou a premiação · ' || e.title, 'event', e.id::text);
  end if;
  -- paga cada jogador (com a parte da guilda, como nas salas)
  for u in select user_id, sum(cents) total from _ev_lines group by user_id loop
    for x in select jsonb_build_object('kind', kind, 'cents', cents, 'note', note) from _ev_lines where user_id = u.user_id and cents > 0 loop
      perform app.credit(u.user_id, (x ->> 'cents')::bigint, x ->> 'kind', (x ->> 'note') || ' · ' || e.title, 'event', e.id::text);
    end loop;
    v_gross := u.total;
    update public.profiles set earnings_cents = earnings_cents + v_gross where id = u.user_id;
    select g2.* into g from public.guild_members gm join public.guilds g2 on g2.id = gm.guild_id where gm.user_id = u.user_id;
    if found and g.cut_pct > 0 and v_gross > 0 then
      v_cut := floor(v_gross * g.cut_pct / 100.0);
      if v_cut > 0 then
        perform app.credit(u.user_id, -v_cut, 'cofre_guilda', g.cut_pct || '% para o cofre da ' || g.name, 'guild', g.id::text);
        update public.guilds set vault_cents = vault_cents + v_cut where id = g.id;
        insert into public.guild_vault_log (guild_id, user_id, kind, amount_cents, note) values (g.id, u.user_id, 'contribuicao', v_cut, 'Evento #' || e.code || ' ' || e.title);
      end if;
    end if;
    perform app.notify(u.user_id, 'resultado', 'Prêmio: ' || e.title, 'Você ganhou ' || app.brl(v_gross) || ' no evento.', jsonb_build_object('event_id', e.id, 'cents', v_gross));
  end loop;
  if (c ->> 'platform_cents')::bigint > 0 then
    perform app.platform('lucro_evento', (c ->> 'platform_cents')::bigint, 'Sobra do evento · ' || e.title, 'event', e.id::text);
  end if;
  -- pontos de guilda da semana
  v_week := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  for x in select * from jsonb_array_elements(c -> 'guild_points') loop
    insert into public.guild_week_points (guild_id, event_id, week, place, points) values ((x ->> 'guild_id')::uuid, e.id, v_week, (x ->> 'place')::int, (x ->> 'points')::int);
  end loop;
  -- campeão ganha título e moldura
  v_champ := (c -> 'champion' ->> 'entry_id')::uuid;
  for u in select unnest(members) uid from public.event_entries where id = v_champ loop
    insert into public.inventory (user_id, item_id, source) values (u.uid, 'titulo-campeao', 'recompensa'), (u.uid, 'moldura-campeao', 'recompensa') on conflict do nothing;
    perform app.notify(u.uid, 'nivel', 'Campeões de ' || e.title || '!', 'Título "Campeão da Semana" e moldura de campeão liberados no seu perfil.', jsonb_build_object('event_id', e.id));
  end loop;
  update public.events set status = 'finalizado', finished_at = now(), vault_cents = 0, results = c where id = e.id;
  perform app.log('Finalizou evento', e.title, 'Prêmios ' || app.brl((c ->> 'payout_cents')::bigint) || ' · plataforma ' || app.brl((c ->> 'platform_cents')::bigint - (c ->> 'cover_platform_cents')::bigint));
  return c;
end $$;

create or replace function public.admin_events(p_status text default 'ativos') returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return coalesce((select jsonb_agg(app.event_card(e) order by e.created_at desc) from public.events e
    where case p_status when 'ativos' then e.status in ('inscricoes', 'andamento') when 'encerrados' then e.status in ('finalizado', 'cancelado') else true end), '[]');
end $$;

-- prêmios de evento contam no painel e no início
do $$
declare v_src text;
begin
  select pg_get_functiondef('public.admin_dashboard()'::regprocedure) into v_src;
  v_src := replace(v_src, 'kind in (''premio'', ''first_blood'', ''rei'', ''por_kill'', ''mvp'', ''sorteio'')', 'kind = any (app.prize_kinds())');
  execute v_src;
end $$;

-- ---------------------------------------------------------------- permissões de execução
revoke all on all functions in schema app from public;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
