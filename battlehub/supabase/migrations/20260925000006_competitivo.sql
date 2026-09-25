-- BattleHub: modo competitivo.
-- Salas oficiais da plataforma, modelos por nível (Base, Intermediária, Elite,
-- Domínio, Ancestral), divisão do cofre entre jogadores / organizador / plataforma,
-- mecânicas novas (Booyah, Rei do lobby, Destaque, Sobrevivente top 5, Clutch,
-- Line mais agressiva, Line mais tática, Domínio absoluto, Meta de abates),
-- eventos do dia e as tabelas das competições (liga, campeonato, intensivo).

-- ---------------------------------------------------------------- configurações
-- platform_fee_pct agora é a parte da plataforma sobre a ARRECADAÇÃO das salas
-- dos organizadores (nunca passa da sobra, então nunca tira prêmio de jogador).
alter table public.settings alter column platform_fee_pct set default 10;
update public.settings set platform_fee_pct = 10 where id = 1 and platform_fee_pct = 0;
alter table public.settings
  add column min_player_pct numeric not null default 50 check (min_player_pct between 0 and 100),
  add column points_default jsonb not null default '{"kill":1,"place":[12,9,8,7,6,5,4,3,2,1]}',
  add column daily_base jsonb not null default '{}',
  add column daily_themes jsonb not null default '[]';

-- base fixa de todo dia e o tema de cada dia da semana (0 = domingo)
update public.settings set
  daily_base = '{"name":"Base fixa","prizes":[{"place":1,"cents":10000},{"place":2,"cents":5000},{"place":3,"cents":2500}],
                 "mechanics":[{"type":"por_kill","cents":100},{"type":"mvp","cents":3000}]}',
  daily_themes = '[
    {"dow":1,"name":"Início Forte","desc":"Começo de semana com sangue quente","mechanics":[{"type":"first_blood","cents":500},{"type":"rei_lobby","cents":1000}]},
    {"dow":2,"name":"Performance","desc":"Quem joga bonito é recompensado","mechanics":[{"type":"rei_lobby","cents":1000},{"type":"destaque","cents":1000}]},
    {"dow":3,"name":"Estratégia","desc":"Sobreviver vale e o líder ganha reforço","mechanics":[{"type":"sobrevivente","cents":300},{"type":"mvp","cents":4000}]},
    {"dow":4,"name":"Decisão","desc":"Primeira kill e rei do lobby","mechanics":[{"type":"first_blood","cents":500},{"type":"rei_lobby","cents":1000}]},
    {"dow":5,"name":"Pressão","desc":"Rei do lobby e sobrevivência até o fim","mechanics":[{"type":"rei_lobby","cents":1000},{"type":"sobrevivente","cents":300}]},
    {"dow":6,"name":"Premium","desc":"Três bônus na mesma partida","mechanics":[{"type":"rei_lobby","cents":1000},{"type":"destaque","cents":1000},{"type":"first_blood","cents":500}]},
    {"dow":0,"name":"Final Boss","desc":"Todas as mecânicas valendo","mechanics":[{"type":"first_blood","cents":500},{"type":"rei_lobby","cents":1000},{"type":"destaque","cents":1000},{"type":"sobrevivente","cents":300},{"type":"mvp","cents":4000}]}
  ]'
where id = 1;

-- taxa combinada com cada organizador (vazio = taxa padrão)
alter table public.profiles add column creator_fee_pct numeric check (creator_fee_pct is null or creator_fee_pct between 0 and 50);

-- ---------------------------------------------------------------- mecânicas
alter table public.mechanic_types
  add column manual boolean not null default false,     -- o organizador escolhe quem ganha
  add column team_only boolean not null default false,  -- só em dupla/squad
  add column unit text not null default 'bonus' check (unit in ('bonus', 'abate', 'jogador')),
  add column has_n boolean not null default false;      -- usa um número (meta de abates)
update public.mechanic_types set unit = 'abate' where id = 'por_kill';
update public.mechanic_types set name = 'Líder de abates', description = 'Quem fizer mais abates na partida (top killer) leva o bônus. Empate divide.' where id = 'mvp';
insert into public.mechanic_types (id, name, description, uses_draw, sort, manual, team_only, unit, has_n) values
  ('booyah', 'Booyah', 'Bônus extra para quem vencer a partida. Em dupla ou squad, divide entre a equipe.', false, 6, false, false, 'bonus', false),
  ('rei_lobby', 'Rei do lobby', 'Maior pontuação somando abates e colocação. Empate vai para a melhor colocação; se continuar, divide.', false, 7, false, false, 'bonus', false),
  ('destaque', 'Destaque da partida', 'O organizador escolhe quem mais se destacou. Só paga se alguém for escolhido.', false, 8, true, false, 'bonus', false),
  ('sobrevivente', 'Sobrevivente top 5', 'Cada um dos 5 últimos jogadores vivos recebe o valor.', false, 9, false, false, 'jogador', false),
  ('meta_abates', 'Meta de abates', 'Todo jogador que chegar à meta de abates recebe o valor.', false, 10, false, false, 'jogador', true),
  ('clutch', 'Clutch extremo', 'Virada sozinho (ex.: 4 abates sozinho no fim). O organizador marca e só paga se acontecer.', false, 11, true, false, 'bonus', false),
  ('line_agressiva', 'Line mais agressiva', 'A equipe que somar mais abates leva o bônus, dividido entre os membros.', false, 12, false, true, 'bonus', false),
  ('line_tatica', 'Line mais tática', 'O organizador escolhe a equipe com o jogo mais tático. Divide entre os membros.', false, 13, true, true, 'bonus', false),
  ('dominio', 'Domínio absoluto', 'Paga se quem deu Booyah também foi quem mais abateu na partida.', false, 14, false, false, 'bonus', false);

-- ---------------------------------------------------------------- competições
create sequence app.event_code start 101;
create table public.events (
  id uuid primary key default gen_random_uuid(),
  code int not null unique default nextval('app.event_code'),
  kind text not null check (kind in ('liga', 'campeonato', 'intensivo', 'copa')),
  title text not null,
  description text not null default '',
  rules text not null default '',
  tier text,
  status text not null default 'inscricoes' check (status in ('inscricoes', 'andamento', 'finalizado', 'cancelado')),
  entry_type text not null default 'line' check (entry_type in ('jogador', 'line')),
  line_size int not null default 4 check (line_size in (1, 2, 4)),
  entry_cents bigint not null default 0 check (entry_cents >= 0),
  price_steps jsonb not null default '[]',   -- preço da 1ª, 2ª, 3ª line da mesma guilda
  max_entries int,
  require_guild boolean not null default false,
  points jsonb not null default '{"kill":1,"place":[12,9,8,7,6,5,4,3,2,1]}',
  phases jsonb not null default '[{"name":"Fase única","drops":4,"qualify":null}]',
  current_phase int not null default 0,
  prizes jsonb not null default '[]',        -- [{"place":1,"cents":240000,"note":"+ 1000 diamantes"}]
  awards jsonb not null default '[]',        -- [{"type":"mvp","cents":40000}]
  guild_points jsonb not null default '[]',  -- [10,7,5,3,1]
  vault_cents bigint not null default 0 check (vault_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles (id),
  results jsonb,
  cancel_reason text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index events_status on public.events (status, starts_at);

create table public.event_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  captain_id uuid not null references public.profiles (id),
  guild_id uuid references public.guilds (id) on delete set null,
  members uuid[] not null,
  paid_cents bigint not null default 0,
  status text not null default 'inscrito' check (status in ('inscrito', 'classificado', 'eliminado', 'desistiu')),
  group_label text,
  created_at timestamptz not null default now()
);
create unique index event_entries_name on public.event_entries (event_id, lower(name)) where status <> 'desistiu';
create index event_entries_event on public.event_entries (event_id);

create table public.event_scores (
  room_id uuid not null references public.rooms (id) on delete cascade,
  entry_id uuid not null references public.event_entries (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  phase int not null,
  map text,
  kills int not null default 0,
  placement int,
  points int not null default 0,
  booyah boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (room_id, entry_id)
);
create index event_scores_event on public.event_scores (event_id, phase);

create table public.guild_week_points (
  id bigserial primary key,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  week date not null,
  place int,
  points int not null,
  created_at timestamptz not null default now()
);
create index guild_week_points_week on public.guild_week_points (week, guild_id);

-- ---------------------------------------------------------------- salas
alter table public.rooms
  add column official boolean not null default false,
  add column tier text,
  add column template_id text,
  add column theme text,
  add column xp_mult numeric not null default 1 check (xp_mult between 1 and 3),
  add column event_id uuid references public.events (id) on delete set null,
  add column phase int,
  add column group_label text,
  add column drop_no int,
  add column restricted boolean not null default false;
create index rooms_event on public.rooms (event_id);

create table public.room_templates (
  id text primary key,
  name text not null,
  tier text not null default 'base',
  description text not null default '',
  mode text not null default 'Battle Royale',
  team_size int not null default 1 check (team_size in (1, 2, 4)),
  map text not null default 'Bermuda',
  max_players int not null default 48,
  entry_cents bigint not null default 0,
  prizes jsonb not null default '[]',
  mechanics jsonb not null default '[]',
  rules text not null default '',
  xp_mult numeric not null default 1,
  official_only boolean not null default false,
  active boolean not null default true,
  sort int not null default 0
);

-- Modelos prontos. Com a sala cheia, cerca de 70% da arrecadação volta para os jogadores.
insert into public.room_templates (id, name, tier, description, mode, team_size, max_players, entry_cents, prizes, mechanics, rules, sort, official_only) values
  ('treino', 'Treino Livre', 'base', 'Sala grátis para treinar e ganhar XP.', 'Battle Royale', 1, 48, 0, '[]', '[]',
   'Sala sem inscrição. Vale XP para o ranking e o caminho de recompensas.', 0, false),
  ('base', 'Sala Base', 'base', 'Entrada acessível, abate pago e top 3 premiado.', 'Battle Royale', 1, 48, 300,
   '[{"place":1,"cents":2500},{"place":2,"cents":1500},{"place":3,"cents":800}]',
   '[{"type":"por_kill","cents":100},{"type":"first_blood","cents":200}]',
   'Abate confirmado pelo print do fim da partida. Empate divide. Prêmio só depois do resultado oficial.', 1, false),
  ('intermediaria', 'Sala Intermediária', 'intermediaria', 'Kill a R$ 1,50, top 3 premiado e Rei do lobby.', 'Battle Royale', 1, 48, 700,
   '[{"place":1,"cents":8000},{"place":2,"cents":4500},{"place":3,"cents":2500}]',
   '[{"type":"por_kill","cents":150},{"type":"first_blood","cents":500},{"type":"rei_lobby","cents":1000}]',
   'Kill paga R$ 1,50. Rei do lobby: mais abates + melhor colocação. Empate divide. Bônus só paga se a mecânica acontecer.', 2, false),
  ('elite', 'Sala Elite', 'elite', 'Kill a R$ 3,50, líder de abates e primeira kill forte.', 'Battle Royale', 1, 48, 1500,
   '[{"place":1,"cents":18000},{"place":2,"cents":9000},{"place":3,"cents":4500}]',
   '[{"type":"por_kill","cents":350},{"type":"mvp","cents":1500},{"type":"first_blood","cents":1000}]',
   'Kill paga R$ 3,50. Top killer R$ 15 (empate divide). Primeira kill R$ 10.', 3, false),
  ('dominio', 'Sala Domínio', 'dominio', 'Premiação alta com cinco mecânicas valendo.', 'Battle Royale', 1, 48, 3000,
   '[{"place":1,"cents":38000},{"place":2,"cents":19000},{"place":3,"cents":8800}]',
   '[{"type":"por_kill","cents":500},{"type":"mvp","cents":5000},{"type":"first_blood","cents":1500},{"type":"rei_lobby","cents":3000},{"type":"destaque","cents":2000}]',
   'Sala de alto nível. Todos os bônus só pagam se a mecânica acontecer. Empates dividem.', 4, true),
  ('ancestral-solo', 'Ancestral Solo', 'ancestral', 'Tabela oficial: R$ 50 por jogador, 70% em prêmios até o 4º.', 'Battle Royale', 1, 48, 5000,
   '[{"place":1,"cents":75000},{"place":2,"cents":45000},{"place":3,"cents":30000},{"place":4,"cents":18000}]', '[]',
   'Arrecadação de R$ 2.400 com 48 jogadores. 70% (R$ 1.680) vai para a premiação e 30% fica com a organização. Premia até o 4º lugar.', 5, true),
  ('ancestral-duo', 'Ancestral Dupla', 'ancestral', 'Tabela oficial: R$ 120 por dupla, 70% em prêmios até o 4º.', 'Battle Royale', 2, 48, 6000,
   '[{"place":1,"cents":100000},{"place":2,"cents":55000},{"place":3,"cents":30000},{"place":4,"cents":16600}]', '[]',
   'R$ 120 por dupla (R$ 60 cada), 24 duplas, arrecadação de R$ 2.880. 70% (R$ 2.016) em prêmios, divididos na dupla.', 6, true),
  ('ancestral-squad', 'Ancestral Squad', 'ancestral', 'Tabela oficial: R$ 240 por squad, 70% em prêmios até o 4º.', 'Battle Royale', 4, 48, 6000,
   '[{"place":1,"cents":120000},{"place":2,"cents":50000},{"place":3,"cents":22000},{"place":4,"cents":9600}]', '[]',
   'R$ 240 por squad (R$ 60 cada), 12 squads, arrecadação de R$ 2.880. 70% (R$ 2.016) em prêmios, divididos no squad.', 7, true);

-- título dado ao campeão de um evento
insert into public.shop_items (id, kind, name, description, price_cents, data, sort) values
  ('titulo-campeao', 'titulo', 'Campeão da Semana', 'Vencedor de um evento oficial', null, '{"text":"Campeão da Semana"}', 40),
  ('moldura-campeao', 'moldura', 'Moldura de Campeão', 'Vencedor de um evento oficial', null, '{"ring":"#f6b83c","glow":true}', 41)
on conflict (id) do nothing;

alter table public.room_templates enable row level security;
alter table public.events enable row level security;
alter table public.event_entries enable row level security;
alter table public.event_scores enable row level security;
alter table public.guild_week_points enable row level security;

-- ---------------------------------------------------------------- ajudantes
-- tipos de lançamento que são prêmio pago a jogador
create or replace function app.prize_kinds() returns text[] language sql immutable as $$
  select array['premio', 'first_blood', 'rei', 'por_kill', 'mvp', 'sorteio', 'booyah', 'rei_lobby', 'destaque', 'sobrevivente',
               'meta_abates', 'clutch', 'line_agressiva', 'line_tatica', 'dominio', 'evento_premio', 'evento_bonus']
$$;

-- pontos de um resultado pela tabela (kill + colocação)
create or replace function app.points(p_table jsonb, p_kills int, p_place int) returns int language sql immutable as $$
  select coalesce(p_kills, 0) * coalesce((p_table ->> 'kill')::int, 1)
       + coalesce(case when p_place between 1 and 100 then (p_table -> 'place' ->> (p_place - 1))::int end, 0)
$$;

-- tabela de pontos da sala (a do evento ou a padrão)
create or replace function app.room_points(p_room public.rooms) returns jsonb language sql stable security definer set search_path = public, app as $$
  select coalesce((select e.points from public.events e where e.id = p_room.event_id), (app.settings()).points_default)
$$;

create or replace function app.mech_n(p_room public.rooms, p_type text) returns int language sql immutable as $$
  select greatest(coalesce((select (e ->> 'n')::int from jsonb_array_elements(p_room.mechanics) e where e ->> 'type' = p_type limit 1), 5), 1)
$$;

-- quanto a sala promete pagar no máximo com p_players jogadores
create or replace function app.room_commitment(p_room public.rooms, p_players int) returns bigint
language sql stable as $$
  select coalesce((select sum((e ->> 'cents')::bigint) from jsonb_array_elements(p_room.prizes) e), 0)
       + coalesce((select sum(case e ->> 'type'
                                when 'por_kill' then (e ->> 'cents')::bigint * greatest(p_players - 1, 0)
                                when 'sobrevivente' then (e ->> 'cents')::bigint * least(5, greatest(p_players, 0))
                                when 'meta_abates' then (e ->> 'cents')::bigint * (greatest(p_players - 1, 0) / greatest(coalesce((e ->> 'n')::int, 5), 1))
                                else (e ->> 'cents')::bigint end)
                     from jsonb_array_elements(p_room.mechanics) e), 0)
$$;

-- divisão prevista da arrecadação com p_players jogadores
create or replace function app.room_split(p_room public.rooms, p_players int) returns jsonb
language plpgsql stable as $$
declare v_pot bigint := p_room.entry_cents * greatest(p_players, 0); v_players bigint; v_left bigint; v_plat bigint;
begin
  v_players := least(app.room_commitment(p_room, p_players), greatest(v_pot, 0) + p_room.guarantee_cents);
  if v_pot = 0 then v_players := app.room_commitment(p_room, p_players); end if;
  v_left := greatest(v_pot + p_room.guarantee_cents - v_players, 0);
  v_plat := case when p_room.official then v_left else least(v_left, floor(v_pot * p_room.fee_pct / 100.0)::bigint) end;
  return jsonb_build_object('players_n', p_players, 'pot_cents', v_pot, 'players_cents', v_players,
    'platform_cents', v_plat, 'creator_cents', case when p_room.official then 0 else v_left - v_plat end,
    'players_pct', case when v_pot > 0 then round(least(v_players, v_pot) * 100.0 / v_pot) end);
end $$;

-- ---------------------------------------------------------------- validação da sala
create or replace function app.parse_room(p jsonb, s public.settings) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_title text := btrim(coalesce(p ->> 'title', '')); v_prizes jsonb := '[]'; v_mech jsonb := '[]'; e jsonb; v_places int[] := '{}'; v_types text[] := '{}';
        v_entry bigint := coalesce((p ->> 'entry_cents')::bigint, 0); v_max int := coalesce((p ->> 'max_players')::int, 0);
        v_team int := coalesce((p ->> 'team_size')::int, 1); v_start timestamptz := (p ->> 'starts_at')::timestamptz; m public.mechanic_types;
        v_n int;
begin
  if length(v_title) < 3 or length(v_title) > 60 then perform app.fail('O nome da sala precisa ter de 3 a 60 caracteres.'); end if;
  if v_max < 2 or v_max > 100 then perform app.fail('A sala aceita de 2 a 100 jogadores.'); end if;
  if v_team not in (1, 2, 4) then perform app.fail('Escolha solo, dupla ou squad.'); end if;
  if v_team > 1 and v_max % v_team <> 0 then perform app.fail('Em ' || case v_team when 2 then 'dupla' else 'squad' end || ', as vagas precisam ser múltiplo de ' || v_team || '.'); end if;
  if v_entry < 0 or v_entry > s.max_entry_cents then perform app.fail('A inscrição vai de R$ 0,00 a ' || app.brl(s.max_entry_cents) || ' por jogador.'); end if;
  if v_start is null or v_start < now() + interval '5 minutes' or v_start > now() + interval '60 days' then
    perform app.fail('Marque o início para daqui a pelo menos 5 minutos (e no máximo 60 dias).');
  end if;
  for e in select * from jsonb_array_elements(coalesce(p -> 'prizes', '[]')) loop
    if coalesce((e ->> 'cents')::bigint, 0) <= 0 then continue; end if;
    if (e ->> 'place')::int < 1 or (e ->> 'place')::int > 10 or (e ->> 'place')::int = any (v_places) then perform app.fail('Colocações dos prêmios precisam ser de 1º a 10º, sem repetir.'); end if;
    v_places := v_places || (e ->> 'place')::int;
    v_prizes := v_prizes || jsonb_build_object('place', (e ->> 'place')::int, 'cents', (e ->> 'cents')::bigint);
  end loop;
  for e in select * from jsonb_array_elements(coalesce(p -> 'mechanics', '[]')) loop
    if coalesce((e ->> 'cents')::bigint, 0) <= 0 then continue; end if;
    select * into m from public.mechanic_types where id = e ->> 'type';
    if not found then perform app.fail('Mecânica desconhecida: ' || coalesce(e ->> 'type', '?') || '.'); end if;
    if m.id = any (v_types) then perform app.fail('Cada mecânica só pode aparecer uma vez.'); end if;
    if m.team_only and v_team = 1 then perform app.fail(m.name || ' só existe em dupla ou squad.'); end if;
    v_types := v_types || m.id;
    if m.has_n then
      v_n := coalesce(nullif(e ->> 'n', '')::int, 5);
      if v_n < 1 or v_n > 30 then perform app.fail('A meta de abates vai de 1 a 30.'); end if;
      v_mech := v_mech || jsonb_build_object('type', m.id, 'cents', (e ->> 'cents')::bigint, 'n', v_n);
    else
      v_mech := v_mech || jsonb_build_object('type', m.id, 'cents', (e ->> 'cents')::bigint);
    end if;
  end loop;
  return jsonb_build_object(
    'title', v_title, 'rules', left(btrim(coalesce(p ->> 'rules', '')), 1500),
    'mode', coalesce(nullif(p ->> 'mode', ''), 'Battle Royale'), 'team_size', v_team,
    'map', coalesce(nullif(p ->> 'map', ''), 'Bermuda'), 'max_players', v_max, 'entry_cents', v_entry,
    'starts_at', v_start, 'prizes', v_prizes, 'mechanics', v_mech,
    'tier', nullif(p ->> 'tier', ''), 'theme', nullif(left(btrim(coalesce(p ->> 'theme', '')), 60), ''),
    'template_id', nullif(p ->> 'template_id', ''),
    'xp_mult', least(greatest(coalesce(nullif(p ->> 'xp_mult', '')::numeric, 1), 1), 3));
end $$;

-- equilíbrio: com a sala cheia, os jogadores precisam poder receber pelo menos min_player_pct da arrecadação
create or replace function app.check_balance(d jsonb, s public.settings) returns void
language plpgsql stable as $$
declare tmp public.rooms; v_pot bigint; v_prom bigint;
begin
  if (d ->> 'entry_cents')::bigint = 0 then return; end if;
  tmp.prizes := d -> 'prizes'; tmp.mechanics := d -> 'mechanics';
  v_pot := (d ->> 'entry_cents')::bigint * (d ->> 'max_players')::int;
  v_prom := app.room_commitment(tmp, (d ->> 'max_players')::int);
  if v_prom * 100 < v_pot * s.min_player_pct then
    perform app.fail('Premiação baixa demais: com a sala cheia a arrecadação é ' || app.brl(v_pot) || ' e os jogadores precisam poder receber pelo menos '
      || s.min_player_pct || '% (' || app.brl(ceil(v_pot * s.min_player_pct / 100.0)::bigint) || '). Hoje a sala promete ' || app.brl(v_prom) || '.');
  end if;
end $$;

-- ---------------------------------------------------------------- resumo da sala
create or replace function app.room_summary(r public.rooms) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'title', r.title, 'mode', r.mode, 'team_size', r.team_size, 'map', r.map,
    'max_players', r.max_players, 'entry_cents', r.entry_cents, 'status', r.status, 'starts_at', r.starts_at,
    'featured', r.featured, 'vault_cents', r.vault_cents, 'guarantee_cents', r.guarantee_cents,
    'prizes', r.prizes, 'mechanics', r.mechanics,
    'prize_cents', coalesce((select sum((e ->> 'cents')::bigint) from jsonb_array_elements(r.prizes) e), 0),
    'players', (select count(*) from public.room_players rp where rp.room_id = r.id and rp.status = 'inscrito'),
    'waitlist', (select count(*) from public.room_waitlist w where w.room_id = r.id),
    'creator', app.user_card(r.creator_id),
    'joined', exists (select 1 from public.room_players rp where rp.room_id = r.id and rp.user_id = auth.uid() and rp.status = 'inscrito'),
    'in_waitlist', exists (select 1 from public.room_waitlist w where w.room_id = r.id and w.user_id = auth.uid()),
    'is_creator', r.creator_id = auth.uid(),
    'finished_at', r.finished_at, 'started_at', r.started_at,
    'official', r.official, 'tier', r.tier, 'theme', r.theme, 'xp_mult', r.xp_mult, 'restricted', r.restricted,
    'phase', r.phase, 'group_label', r.group_label, 'drop_no', r.drop_no,
    'event', (select jsonb_build_object('id', e.id, 'code', e.code, 'title', e.title, 'kind', e.kind) from public.events e where e.id = r.event_id)
  )
$$;

-- ---------------------------------------------------------------- premiação
-- p_results: {"players":[{"user_id","kills","placement","survival_min"}],
--   "first_blood": uuid, "king_outcome": "killed|survived|none", "king_killer": uuid,
--   "survivors": [uuid], "picks": {"destaque": uuid, "clutch": uuid, "line_tatica": uuid}}
create or replace function app.compute_payout(p_room_id uuid, p_results jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
declare
  v_room public.rooms; s public.settings; x jsonb; v_pts jsonb; v_mult numeric;
  v_n int; v_kills_total int := 0; v_lines jsonb := '[]'; v_total bigint := 0;
  v_players jsonb := '[]'; r record; v_winners uuid[]; v_k int; v_part bigint; v_cents bigint; i int;
  v_fb uuid; v_outcome text; v_killer uuid; v_max int; v_rem bigint; v_fee bigint; v_unpaid bigint := 0;
  v_entries bigint; v_short bigint; v_cover_event bigint := 0; v_cover_platform bigint := 0; v_event_vault bigint := 0;
  v_surv uuid[]; v_pick uuid; v_place int; v_best int; v_bp int; v_top int; v_n_meta int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  s := app.settings(); x := s.xp; v_pts := app.room_points(v_room); v_mult := coalesce(v_room.xp_mult, 1);

  create temp table if not exists _res (user_id uuid primary key, kills int, placement int, survival_min int) on commit drop;
  delete from _res;
  insert into _res
    select rp.user_id,
           greatest(coalesce((pl ->> 'kills')::int, 0), 0),
           nullif(pl ->> 'placement', '')::int,
           greatest(coalesce(nullif(pl ->> 'survival_min', '')::int, 0), 0)
      from public.room_players rp
      left join lateral (select e from jsonb_array_elements(coalesce(p_results -> 'players', '[]')) e
                          where (e ->> 'user_id')::uuid = rp.user_id limit 1) q(pl) on true
     where rp.room_id = p_room_id and rp.status = 'inscrito';
  select count(*), coalesce(sum(kills), 0) into v_n, v_kills_total from _res;
  if v_n = 0 then perform app.fail('A sala não tem jogadores inscritos.'); end if;

  if exists (select 1 from jsonb_array_elements(coalesce(p_results -> 'players', '[]')) e
              where not exists (select 1 from _res where user_id = (e ->> 'user_id')::uuid)) then
    perform app.fail('Há um jogador no resultado que não está inscrito na sala.');
  end if;
  if v_n > 1 and v_kills_total > v_n - 1 then
    perform app.fail('Soma de abates (' || v_kills_total || ') maior que o possível numa sala com ' || v_n || ' jogadores.');
  end if;
  if exists (select 1 from _res where placement is not null and (placement < 1 or placement > v_n)) then
    perform app.fail('Colocação precisa ficar entre 1 e ' || v_n || '.');
  end if;

  -- prêmios por colocação (empate na colocação ou equipe divide)
  for r in select (e ->> 'place')::int as place, (e ->> 'cents')::bigint as cents from jsonb_array_elements(v_room.prizes) e order by 1 loop
    select array_agg(user_id order by user_id) into v_winners from _res where placement = r.place;
    if v_winners is null then v_unpaid := v_unpaid + r.cents; continue; end if;
    v_k := array_length(v_winners, 1); v_part := r.cents / v_k;
    for i in 1 .. v_k loop
      v_cents := v_part + case when i = 1 then r.cents - v_part * v_k else 0 end;
      v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'premio', 'cents', v_cents, 'note', r.place || 'º lugar');
    end loop;
  end loop;

  -- primeiro abate
  if app.has_mech(v_room, 'first_blood') then
    v_fb := nullif(p_results ->> 'first_blood', '')::uuid;
    if v_kills_total > 0 and v_fb is null then perform app.fail('Informe quem fez o primeiro abate.'); end if;
    if v_fb is not null then
      if not exists (select 1 from _res where user_id = v_fb and kills >= 1) then perform app.fail('Quem fez o primeiro abate precisa ter pelo menos 1 abate.'); end if;
      v_lines := v_lines || jsonb_build_object('user_id', v_fb, 'kind', 'first_blood', 'cents', app.mech_cents(v_room, 'first_blood'), 'note', 'Primeiro abate');
    else
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'first_blood');
    end if;
  end if;

  -- Player Rei
  if app.has_mech(v_room, 'rei') then
    v_outcome := coalesce(p_results ->> 'king_outcome', 'none');
    v_killer := nullif(p_results ->> 'king_killer', '')::uuid;
    if v_room.king_id is null or not exists (select 1 from _res where user_id = v_room.king_id) then
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'rei');
    elsif v_outcome = 'killed' then
      if v_killer is null or v_killer = v_room.king_id or not exists (select 1 from _res where user_id = v_killer and kills >= 1) then
        perform app.fail('Escolha quem eliminou o Player Rei (precisa ter pelo menos 1 abate e não ser o próprio Rei).');
      end if;
      v_lines := v_lines || jsonb_build_object('user_id', v_killer, 'kind', 'rei', 'cents', app.mech_cents(v_room, 'rei'), 'note', 'Eliminou o Player Rei');
    elsif v_outcome = 'survived' then
      v_lines := v_lines || jsonb_build_object('user_id', v_room.king_id, 'kind', 'rei', 'cents', app.mech_cents(v_room, 'rei'), 'note', 'Player Rei sobreviveu');
    else
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'rei');
    end if;
  end if;

  -- por abate (kill paga)
  if app.has_mech(v_room, 'por_kill') then
    for r in select user_id, kills from _res where kills > 0 order by user_id loop
      v_lines := v_lines || jsonb_build_object('user_id', r.user_id, 'kind', 'por_kill', 'cents', r.kills * app.mech_cents(v_room, 'por_kill'), 'note', r.kills || ' abate' || case when r.kills > 1 then 's' else '' end);
    end loop;
  end if;

  -- líder de abates (empate divide)
  if app.has_mech(v_room, 'mvp') then
    select max(kills) into v_max from _res;
    if coalesce(v_max, 0) > 0 then
      select array_agg(user_id order by user_id) into v_winners from _res where kills = v_max;
      v_k := array_length(v_winners, 1); v_cents := app.mech_cents(v_room, 'mvp'); v_part := v_cents / v_k;
      for i in 1 .. v_k loop
        v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'mvp', 'cents', v_part + case when i = 1 then v_cents - v_part * v_k else 0 end, 'note', 'Líder de abates (' || v_max || ')');
      end loop;
    else
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'mvp');
    end if;
  end if;

  -- sorteio
  if app.has_mech(v_room, 'sorteio') then
    if v_room.lucky_id is not null and exists (select 1 from _res where user_id = v_room.lucky_id) then
      v_lines := v_lines || jsonb_build_object('user_id', v_room.lucky_id, 'kind', 'sorteio', 'cents', app.mech_cents(v_room, 'sorteio'), 'note', 'Sorteado da sala');
    else
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'sorteio');
    end if;
  end if;

  -- Booyah (divide entre a equipe vencedora)
  if app.has_mech(v_room, 'booyah') then
    select array_agg(user_id order by user_id) into v_winners from _res where placement = 1;
    if v_winners is null then v_unpaid := v_unpaid + app.mech_cents(v_room, 'booyah');
    else
      v_k := array_length(v_winners, 1); v_cents := app.mech_cents(v_room, 'booyah'); v_part := v_cents / v_k;
      for i in 1 .. v_k loop
        v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'booyah', 'cents', v_part + case when i = 1 then v_cents - v_part * v_k else 0 end, 'note', 'Booyah');
      end loop;
    end if;
  end if;

  -- Rei do lobby: abates + colocação pela tabela de pontos; empate → melhor colocação → divide
  if app.has_mech(v_room, 'rei_lobby') then
    select max(app.points(v_pts, kills, placement)) into v_best from _res;
    if coalesce(v_best, 0) > 0 then
      select min(placement) into v_bp from _res where app.points(v_pts, kills, placement) = v_best;
      select array_agg(user_id order by user_id) into v_winners from _res
       where app.points(v_pts, kills, placement) = v_best and (v_bp is null or placement = v_bp);
      v_k := array_length(v_winners, 1); v_cents := app.mech_cents(v_room, 'rei_lobby'); v_part := v_cents / v_k;
      for i in 1 .. v_k loop
        v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'rei_lobby', 'cents', v_part + case when i = 1 then v_cents - v_part * v_k else 0 end, 'note', 'Rei do lobby (' || v_best || ' pts)');
      end loop;
    else
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'rei_lobby');
    end if;
  end if;

  -- Destaque e Clutch: escolha do organizador
  if app.has_mech(v_room, 'destaque') then
    v_pick := nullif(p_results -> 'picks' ->> 'destaque', '')::uuid;
    if v_pick is null then v_unpaid := v_unpaid + app.mech_cents(v_room, 'destaque');
    elsif not exists (select 1 from _res where user_id = v_pick) then perform app.fail('O destaque da partida precisa estar inscrito na sala.');
    else v_lines := v_lines || jsonb_build_object('user_id', v_pick, 'kind', 'destaque', 'cents', app.mech_cents(v_room, 'destaque'), 'note', 'Destaque da partida');
    end if;
  end if;
  if app.has_mech(v_room, 'clutch') then
    v_pick := nullif(p_results -> 'picks' ->> 'clutch', '')::uuid;
    if v_pick is null then v_unpaid := v_unpaid + app.mech_cents(v_room, 'clutch');
    elsif not exists (select 1 from _res where user_id = v_pick and kills >= 1) then perform app.fail('Quem fez o clutch precisa estar na sala e ter abates.');
    else v_lines := v_lines || jsonb_build_object('user_id', v_pick, 'kind', 'clutch', 'cents', app.mech_cents(v_room, 'clutch'), 'note', 'Clutch extremo');
    end if;
  end if;

  -- Sobrevivente top 5: lista marcada pelo organizador ou, no solo, os 5 primeiros colocados
  if app.has_mech(v_room, 'sobrevivente') then
    if jsonb_typeof(p_results -> 'survivors') = 'array' and jsonb_array_length(p_results -> 'survivors') > 0 then
      select array_agg(distinct (e #>> '{}')::uuid) into v_surv from jsonb_array_elements(p_results -> 'survivors') e;
      if array_length(v_surv, 1) > 5 then perform app.fail('Marque no máximo 5 sobreviventes.'); end if;
      if exists (select 1 from unnest(v_surv) u where not exists (select 1 from _res where user_id = u)) then perform app.fail('Sobrevivente marcado que não está na sala.'); end if;
    elsif v_room.team_size = 1 then
      select array_agg(user_id order by placement) into v_surv from (select user_id, placement from _res where placement between 1 and 5 order by placement limit 5) q;
    end if;
    if v_surv is null then v_unpaid := v_unpaid + app.mech_cents(v_room, 'sobrevivente') * least(5, v_n);
    else
      foreach v_pick in array v_surv loop
        v_lines := v_lines || jsonb_build_object('user_id', v_pick, 'kind', 'sobrevivente', 'cents', app.mech_cents(v_room, 'sobrevivente'), 'note', 'Sobrevivente top 5');
      end loop;
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'sobrevivente') * greatest(least(5, v_n) - array_length(v_surv, 1), 0);
    end if;
  end if;

  -- Meta de abates
  if app.has_mech(v_room, 'meta_abates') then
    v_n_meta := app.mech_n(v_room, 'meta_abates');
    for r in select user_id, kills from _res where kills >= v_n_meta order by user_id loop
      v_lines := v_lines || jsonb_build_object('user_id', r.user_id, 'kind', 'meta_abates', 'cents', app.mech_cents(v_room, 'meta_abates'), 'note', 'Meta de ' || v_n_meta || ' abates');
    end loop;
  end if;

  -- Line mais agressiva: equipe (mesma colocação) com mais abates somados
  if app.has_mech(v_room, 'line_agressiva') then
    select max(t) into v_top from (select sum(kills) t from _res where placement is not null group by placement) q;
    if coalesce(v_top, 0) > 0 then
      select array_agg(user_id order by user_id) into v_winners from _res
       where placement in (select placement from _res where placement is not null group by placement having sum(kills) = v_top);
      v_k := array_length(v_winners, 1); v_cents := app.mech_cents(v_room, 'line_agressiva'); v_part := v_cents / v_k;
      for i in 1 .. v_k loop
        v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'line_agressiva', 'cents', v_part + case when i = 1 then v_cents - v_part * v_k else 0 end, 'note', 'Line mais agressiva (' || v_top || ' abates)');
      end loop;
    else
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'line_agressiva');
    end if;
  end if;

  -- Line mais tática: o organizador escolhe um jogador e a equipe dele divide
  if app.has_mech(v_room, 'line_tatica') then
    v_pick := nullif(p_results -> 'picks' ->> 'line_tatica', '')::uuid;
    if v_pick is null then v_unpaid := v_unpaid + app.mech_cents(v_room, 'line_tatica');
    else
      select placement into v_place from _res where user_id = v_pick;
      if not found then perform app.fail('A line mais tática precisa estar na sala.'); end if;
      if v_place is null then perform app.fail('Informe a colocação da line mais tática.'); end if;
      select array_agg(user_id order by user_id) into v_winners from _res where placement = v_place;
      v_k := array_length(v_winners, 1); v_cents := app.mech_cents(v_room, 'line_tatica'); v_part := v_cents / v_k;
      for i in 1 .. v_k loop
        v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'line_tatica', 'cents', v_part + case when i = 1 then v_cents - v_part * v_k else 0 end, 'note', 'Line mais tática');
      end loop;
    end if;
  end if;

  -- Domínio absoluto: o Booyah também foi quem mais abateu (sozinho, sem empate)
  if app.has_mech(v_room, 'dominio') then
    select coalesce(sum(kills), 0) into v_best from _res where placement = 1;
    select max(t) into v_top from (select sum(kills) t from _res where placement is not null and placement <> 1 group by placement
                                   union all select kills from _res where placement is null) q;
    if v_best > 0 and v_best > coalesce(v_top, 0) then
      select array_agg(user_id order by user_id) into v_winners from _res where placement = 1;
      v_k := array_length(v_winners, 1); v_cents := app.mech_cents(v_room, 'dominio'); v_part := v_cents / v_k;
      for i in 1 .. v_k loop
        v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'dominio', 'cents', v_part + case when i = 1 then v_cents - v_part * v_k else 0 end, 'note', 'Domínio absoluto');
      end loop;
    else
      v_unpaid := v_unpaid + app.mech_cents(v_room, 'dominio');
    end if;
  end if;

  -- dinheiro: cofre da sala → cofre do evento → plataforma (só em sala oficial)
  select coalesce(sum((e ->> 'cents')::bigint), 0) into v_total from jsonb_array_elements(v_lines) e;
  select coalesce(sum(paid_cents), 0) into v_entries from public.room_players where room_id = p_room_id and status = 'inscrito';
  if v_room.event_id is not null then select vault_cents into v_event_vault from public.events where id = v_room.event_id; end if;
  v_short := greatest(v_total - v_room.vault_cents, 0);
  if v_short > 0 then
    v_cover_event := least(v_short, coalesce(v_event_vault, 0)); v_short := v_short - v_cover_event;
    if v_short > 0 and v_room.official then v_cover_platform := v_short; v_short := 0; end if;
    if v_short > 0 then
      perform app.fail('O cofre tem ' || app.brl(v_room.vault_cents) || ' e a premiação soma ' || app.brl(v_total) || '. Adicione garantia antes de finalizar.');
    end if;
  end if;
  v_rem := v_room.vault_cents + v_cover_event + v_cover_platform - v_total;
  if v_room.official then v_fee := v_rem;
  else v_fee := least(v_rem, floor(v_entries * v_room.fee_pct / 100.0)::bigint);
  end if;

  -- XP de cada jogador (multiplicado em salas de XP em dobro)
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', q.user_id, 'kills', q.kills, 'placement', q.placement, 'survival_min', q.survival_min,
      'earned_cents', q.earned,
      'xp', round(((x ->> 'participar')::int + q.kills * (x ->> 'abate')::int
            + case when q.placement is not null and q.placement <= 3 then (x ->> 'top3')::int else 0 end
            + case when q.placement = 1 then (x ->> 'vitoria')::int else 0 end
            + case when q.user_id = v_fb then (x ->> 'first_blood')::int else 0 end
            + case when v_outcome = 'killed' and q.user_id = v_killer then (x ->> 'rei')::int else 0 end
            + case when q.earned > 0 then (x ->> 'premio')::int else 0 end) * v_mult)::int
    ) order by q.placement nulls last, q.kills desc), '[]')
    into v_players
    from (select rr.*, coalesce((select sum((e ->> 'cents')::bigint) from jsonb_array_elements(v_lines) e where (e ->> 'user_id')::uuid = rr.user_id), 0) as earned
            from _res rr) q;

  return jsonb_build_object(
    'vault_cents', v_room.vault_cents, 'entries_cents', v_entries, 'payout_cents', v_total, 'unpaid_cents', v_unpaid,
    'fee_pct', v_room.fee_pct, 'fee_cents', v_fee, 'creator_cents', case when v_room.official then 0 else v_rem - v_fee end,
    'official', v_room.official, 'cover_event_cents', v_cover_event, 'cover_platform_cents', v_cover_platform,
    'lines', v_lines, 'players', v_players,
    'first_blood', v_fb, 'king_id', v_room.king_id, 'king_outcome', v_outcome, 'king_killer', v_killer, 'lucky_id', v_room.lucky_id,
    'survivors', to_jsonb(v_surv), 'picks', coalesce(p_results -> 'picks', '{}'), 'xp_mult', v_mult
  );
end $$;

-- ---------------------------------------------------------------- criar / editar
create or replace function public.create_room(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings; d jsonb; r public.rooms; v_guar bigint := greatest(coalesce((p ->> 'guarantee_cents')::bigint, 0), 0);
        v_official boolean := coalesce((p ->> 'official')::boolean, false); v_staff boolean;
begin
  me := app.require_user(); s := app.settings(); v_staff := app.role_level(me.role) >= 2;
  if not (me.can_create_rooms or app.role_level(me.role) >= 1) then
    perform app.fail('Sua conta ainda não tem permissão para criar salas. Peça à administração.');
  end if;
  if v_official and not v_staff then perform app.fail('Só a administração cria salas oficiais.'); end if;
  d := app.parse_room(p, s);
  if not v_staff and (d ->> 'xp_mult')::numeric > 1 then perform app.fail('XP em dobro só em salas oficiais.'); end if;
  if not v_official then perform app.check_balance(d, s); end if;
  if (d ->> 'template_id') is not null and exists (select 1 from public.room_templates where id = d ->> 'template_id' and official_only) and not v_official then
    perform app.fail('Esse modelo é exclusivo das salas oficiais.');
  end if;
  insert into public.rooms (creator_id, title, rules, mode, team_size, map, max_players, entry_cents, prizes, mechanics, starts_at, fee_pct,
                            official, tier, template_id, theme, xp_mult, featured)
  values (me.id, d ->> 'title', d ->> 'rules', d ->> 'mode', (d ->> 'team_size')::int, d ->> 'map', (d ->> 'max_players')::int,
          (d ->> 'entry_cents')::bigint, d -> 'prizes', d -> 'mechanics', (d ->> 'starts_at')::timestamptz,
          case when v_official then 0 else coalesce(me.creator_fee_pct, s.platform_fee_pct) end,
          v_official, d ->> 'tier', d ->> 'template_id', d ->> 'theme', (d ->> 'xp_mult')::numeric, v_official)
  returning * into r;
  insert into public.room_secrets (room_id) values (r.id);
  if v_guar > 0 and not v_official then
    perform app.credit(me.id, -v_guar, 'garantia', 'Garantia no cofre · ' || r.title || ' (#' || r.code || ')', 'room', r.id::text);
    update public.rooms set vault_cents = vault_cents + v_guar, guarantee_cents = v_guar where id = r.id returning * into r;
  end if;
  perform app.log(case when v_official then 'Criou sala oficial' else 'Criou sala' end, '#' || r.code || ' ' || r.title, app.brl(r.entry_cents) || ' · ' || r.max_players || ' vagas');
  return public.get_room(r.id);
end $$;

create or replace function public.update_room(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings; d jsonb; r public.rooms; v_n int; v_old bigint; v_new bigint; tmp public.rooms;
begin
  me := app.require_user(); s := app.settings();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador pode editar a sala.'); end if;
  if r.official and app.role_level(me.role) < 2 then perform app.fail('Só a administração edita salas oficiais.'); end if;
  if r.status <> 'aberta' then perform app.fail('Só dá para editar salas com inscrições abertas.'); end if;
  d := app.parse_room(p, s);
  if not r.official then perform app.check_balance(d, s); end if;
  select count(*) into v_n from public.room_players where room_id = r.id and status = 'inscrito';
  if (d ->> 'max_players')::int < v_n then perform app.fail('Já há ' || v_n || ' inscritos. As vagas não podem ser menores que isso.'); end if;
  if v_n > 0 then
    if (d ->> 'entry_cents')::bigint <> r.entry_cents then perform app.fail('Com jogadores inscritos, o valor da inscrição não muda.'); end if;
    tmp := r; tmp.prizes := d -> 'prizes'; tmp.mechanics := d -> 'mechanics';
    v_old := app.room_commitment(r, 2); v_new := app.room_commitment(tmp, 2);
    if v_new < v_old then perform app.fail('Com jogadores inscritos, a premiação só pode aumentar.'); end if;
  end if;
  update public.rooms set title = d ->> 'title', rules = d ->> 'rules', mode = d ->> 'mode', team_size = (d ->> 'team_size')::int,
         map = d ->> 'map', max_players = (d ->> 'max_players')::int, entry_cents = (d ->> 'entry_cents')::bigint,
         starts_at = (d ->> 'starts_at')::timestamptz, prizes = d -> 'prizes', mechanics = d -> 'mechanics',
         tier = coalesce(d ->> 'tier', tier), theme = d ->> 'theme',
         xp_mult = case when app.role_level(me.role) >= 2 then (d ->> 'xp_mult')::numeric else xp_mult end
   where id = r.id;
  perform app.promote_waitlist(r.id);
  perform app.log('Editou sala', '#' || r.code || ' ' || (d ->> 'title'));
  return public.get_room(r.id);
end $$;

create or replace function public.get_room(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_manage boolean; v_joined boolean; v_n int; v_see_ff boolean;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  v_manage := r.creator_id = me.id or app.role_level(me.role) >= 1;
  v_joined := exists (select 1 from public.room_players where room_id = r.id and user_id = me.id and status = 'inscrito');
  select count(*) into v_n from public.room_players where room_id = r.id and status = 'inscrito';
  v_see_ff := v_manage or v_joined;
  return app.room_summary(r) || jsonb_build_object(
    'rules', r.rules, 'can_manage', v_manage, 'fee_pct', r.fee_pct,
    'commitment_cents', app.room_commitment(r, greatest(v_n, 2)),
    'commitment_full_cents', app.room_commitment(r, r.max_players),
    'split_full', app.room_split(r, r.max_players),
    'split_now', app.room_split(r, v_n),
    'points', app.room_points(r),
    'king', app.user_card(r.king_id), 'lucky', app.user_card(r.lucky_id),
    'results', r.results, 'cancel_reason', r.cancel_reason,
    'secrets', case when v_manage or (v_joined and r.status = 'em_andamento')
                    then (select jsonb_build_object('game_room_id', game_room_id, 'password', password) from public.room_secrets where room_id = r.id) end,
    'player_list', coalesce((select jsonb_agg(app.user_card(rp.user_id) || jsonb_build_object(
          'kills', rp.kills, 'placement', rp.placement, 'survival_min', rp.survival_min, 'earned_cents', rp.earned_cents, 'xp_earned', rp.xp_earned,
          'ff_nick', case when v_see_ff then p.ff_nick end, 'ff_id', case when v_manage then p.ff_id end,
          'ff_verified', p.ff_status = 'aprovado', 'joined_at', rp.joined_at,
          'line', (select jsonb_build_object('id', ee.id, 'name', ee.name) from public.event_entries ee
                    where r.event_id is not null and ee.event_id = r.event_id and rp.user_id = any (ee.members) and ee.status <> 'desistiu' limit 1))
          order by coalesce(rp.placement, 999), rp.joined_at)
        from public.room_players rp join public.profiles p on p.id = rp.user_id where rp.room_id = r.id and rp.status = 'inscrito'), '[]'),
    'waitlist_list', case when v_manage then coalesce((select jsonb_agg(app.user_card(w.user_id) || jsonb_build_object('priority', app.has_priority(w.user_id)) order by app.has_priority(w.user_id) desc, w.created_at)
        from public.room_waitlist w where w.room_id = r.id), '[]') end,
    'waitlist_pos', (select pos from (select w.user_id, row_number() over (order by app.has_priority(w.user_id) desc, w.created_at) pos from public.room_waitlist w where w.room_id = r.id) q where q.user_id = me.id)
  );
end $$;

-- sala exclusiva de evento: só entra quem a organização colocou
create or replace function public.join_room(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_n int; v_pos int;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.restricted then perform app.fail('Sala exclusiva do evento: a organização coloca as lines classificadas.'); end if;
  if r.status <> 'aberta' then perform app.fail('As inscrições desta sala estão fechadas.'); end if;
  if exists (select 1 from public.room_players where room_id = r.id and user_id = me.id and status = 'inscrito') then perform app.fail('Você já está inscrito.'); end if;
  if r.creator_id = me.id then perform app.fail('Você é o organizador desta sala.'); end if;
  select count(*) into v_n from public.room_players where room_id = r.id and status = 'inscrito';
  if v_n >= r.max_players then
    if me.ff_id is null then perform app.fail('Cadastre seu nick e ID do Free Fire no perfil antes de entrar em salas.'); end if;
    insert into public.room_waitlist (room_id, user_id) values (r.id, me.id) on conflict do nothing;
    select pos into v_pos from (select w.user_id, row_number() over (order by app.has_priority(w.user_id) desc, w.created_at) pos from public.room_waitlist w where w.room_id = r.id) q where q.user_id = me.id;
    return jsonb_build_object('status', 'fila', 'position', v_pos, 'priority', app.has_priority(me.id));
  end if;
  perform app.enroll(r, me.id);
  return jsonb_build_object('status', 'inscrito', 'room', public.get_room(r.id));
end $$;

create or replace function public.start_room(p_id uuid, p_game_room_id text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_n int; v_need bigint; w record; v_ev bigint := 0;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador pode iniciar a sala.'); end if;
  if r.status <> 'aberta' then perform app.fail('Essa sala já começou ou foi encerrada.'); end if;
  if btrim(coalesce(p_game_room_id, '')) = '' or btrim(coalesce(p_password, '')) = '' then perform app.fail('Digite o ID e a senha da sala do Free Fire.'); end if;
  select count(*) into v_n from public.room_players where room_id = r.id and status = 'inscrito';
  if v_n < 2 then perform app.fail('A sala precisa de pelo menos 2 inscritos para começar.'); end if;
  -- sala oficial: a plataforma garante a premiação
  if not r.official then
    if r.event_id is not null then select vault_cents into v_ev from public.events where id = r.event_id; end if;
    v_need := app.room_commitment(r, v_n);
    if r.vault_cents + coalesce(v_ev, 0) < v_need then
      perform app.fail('O cofre tem ' || app.brl(r.vault_cents) || ' e a sala promete até ' || app.brl(v_need) || ' com ' || v_n || ' jogadores. Coloque ' || app.brl(v_need - r.vault_cents) || ' de garantia ou diminua os prêmios.');
    end if;
  end if;
  update public.room_secrets set game_room_id = btrim(p_game_room_id), password = btrim(p_password) where room_id = r.id;
  update public.rooms set status = 'em_andamento', started_at = now() where id = r.id;
  for w in select user_id from public.room_players where room_id = r.id and status = 'inscrito' loop
    perform app.notify(w.user_id, 'sala', r.title || ' começou', 'Sala ' || btrim(p_game_room_id) || ' · senha ' || btrim(p_password) || '. Entre agora.', jsonb_build_object('room_id', r.id));
  end loop;
  for w in select user_id from public.room_waitlist where room_id = r.id loop
    perform app.notify(w.user_id, 'sala', r.title || ' começou', 'A sala lotou antes de abrir vaga para você.', jsonb_build_object('room_id', r.id));
  end loop;
  delete from public.room_waitlist where room_id = r.id;
  insert into public.room_messages (room_id, sender_id, body) values (r.id, me.id, 'Sala liberada! ID ' || btrim(p_game_room_id) || ' · senha ' || btrim(p_password) || '. Boa sorte a todos.');
  perform app.log('Iniciou sala', '#' || r.code || ' ' || r.title, v_n || ' jogadores');
  return public.get_room(r.id);
end $$;

-- ---------------------------------------------------------------- finalizar
create or replace function public.finish_room(p_id uuid, p_results jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; c jsonb; u jsonb; v_uid uuid; v_gross bigint; v_xp int; v_fb uuid; v_killer uuid;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador pode lançar o resultado.'); end if;
  if r.status <> 'em_andamento' then perform app.fail('Inicie a sala antes de lançar o resultado.'); end if;
  c := app.compute_payout(p_id, p_results);
  v_fb := nullif(c ->> 'first_blood', '')::uuid;
  v_killer := case when c ->> 'king_outcome' = 'killed' then nullif(c ->> 'king_killer', '')::uuid end;

  -- completa o cofre antes de pagar (evento e, em sala oficial, a plataforma)
  if (c ->> 'cover_event_cents')::bigint > 0 then
    update public.events set vault_cents = vault_cents - (c ->> 'cover_event_cents')::bigint where id = r.event_id;
  end if;
  if (c ->> 'cover_platform_cents')::bigint > 0 then
    perform app.platform('cobertura_sala', -(c ->> 'cover_platform_cents')::bigint, 'Plataforma completou a premiação · Sala #' || r.code || ' ' || r.title, 'room', r.id::text);
  end if;

  for u in select * from jsonb_array_elements(c -> 'players') loop
    v_uid := (u ->> 'user_id')::uuid;
    v_gross := app.pay_winnings(v_uid, c -> 'lines', r);
    v_xp := (u ->> 'xp')::int;
    update public.room_players set kills = (u ->> 'kills')::int, placement = nullif(u ->> 'placement', '')::int,
           survival_min = (u ->> 'survival_min')::int, earned_cents = v_gross, xp_earned = v_xp
     where room_id = r.id and user_id = v_uid;
    update public.profiles set kills = kills + (u ->> 'kills')::int, matches = matches + 1,
           wins = wins + case when (u ->> 'placement') = '1' then 1 else 0 end,
           top3 = top3 + case when nullif(u ->> 'placement', '')::int <= 3 then 1 else 0 end,
           survival_min = survival_min + (u ->> 'survival_min')::int,
           earnings_cents = earnings_cents + v_gross,
           first_bloods = first_bloods + case when v_uid = v_fb then 1 else 0 end,
           kings_killed = kings_killed + case when v_uid = v_killer then 1 else 0 end
     where id = v_uid;
    perform app.add_xp(v_uid, v_xp);
    perform app.notify(v_uid, 'resultado', 'Resultado: ' || r.title,
      coalesce((u ->> 'placement') || 'º lugar · ', '') || (u ->> 'kills') || ' abate' || case when (u ->> 'kills')::int = 1 then '' else 's' end
      || case when v_gross > 0 then ' · você ganhou ' || app.brl(v_gross) else '' end || ' · +' || v_xp || ' XP',
      jsonb_build_object('room_id', r.id, 'cents', v_gross, 'xp', v_xp));
  end loop;

  if r.official then
    perform app.platform('sala_oficial', (c ->> 'fee_cents')::bigint, 'Sobra da sala oficial #' || r.code || ' ' || r.title, 'room', r.id::text);
  else
    perform app.platform('taxa_sala', (c ->> 'fee_cents')::bigint, 'Taxa de ' || r.fee_pct || '% da arrecadação · Sala #' || r.code || ' ' || r.title, 'room', r.id::text);
    if (c ->> 'creator_cents')::bigint > 0 then
      perform app.credit(r.creator_id, (c ->> 'creator_cents')::bigint, 'lucro_sala', 'Sobra do cofre · ' || r.title || ' (#' || r.code || ')', 'room', r.id::text);
    end if;
    perform app.notify(r.creator_id, 'sala', 'Sala #' || r.code || ' finalizada',
      'Premiação paga: ' || app.brl((c ->> 'payout_cents')::bigint) || '. Plataforma: ' || app.brl((c ->> 'fee_cents')::bigint)
      || '. Você recebeu ' || app.brl((c ->> 'creator_cents')::bigint) || '.', jsonb_build_object('room_id', r.id));
  end if;
  update public.rooms set status = 'finalizada', finished_at = now(), vault_cents = 0, results = c where id = r.id;
  if r.event_id is not null then perform app.event_score_room(r.id, c); end if;
  insert into public.room_messages (room_id, sender_id, body) values (r.id, me.id, 'Resultado confirmado. Prêmios creditados nas carteiras.');
  perform app.log('Finalizou sala', '#' || r.code || ' ' || r.title, 'Prêmios ' || app.brl((c ->> 'payout_cents')::bigint) || ' · organizador ' || app.brl((c ->> 'creator_cents')::bigint) || ' · plataforma ' || app.brl((c ->> 'fee_cents')::bigint));
  return c;
end $$;

-- ---------------------------------------------------------------- modelos e evento do dia
create or replace function app.today_theme() returns jsonb language sql stable security definer set search_path = public, app as $$
  select coalesce((select t from jsonb_array_elements(s.daily_themes) t
           where (t ->> 'dow')::int = extract(dow from now() at time zone 'America/Sao_Paulo')::int limit 1), '{}')
         || jsonb_build_object('base', s.daily_base, 'dow', extract(dow from now() at time zone 'America/Sao_Paulo')::int)
    from public.settings s where s.id = 1
$$;

create or replace function public.room_templates() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.sort) from public.room_templates t
                    where t.active and (not t.official_only or app.role_level(me.role) >= 2)), '[]');
end $$;

create or replace function public.home() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_user();
  return jsonb_build_object(
    'live', (select count(*) from public.rooms where status = 'em_andamento'),
    'open', (select count(*) from public.rooms where status = 'aberta'),
    'prize_cents', coalesce((select sum((e ->> 'cents')::bigint) from public.rooms r, jsonb_array_elements(r.prizes) e where r.status in ('aberta', 'em_andamento')), 0),
    'paid_week_cents', coalesce((select sum(amount_cents) from public.ledger where kind = any (app.prize_kinds()) and created_at > now() - interval '7 days'), 0),
    'theme', app.today_theme(),
    'official', coalesce((select jsonb_agg(app.room_summary(r) order by r.starts_at) from (select * from public.rooms
                            where official and status in ('aberta', 'em_andamento') and not restricted order by starts_at limit 12) r), '[]'),
    'events', coalesce((select jsonb_agg(app.event_card(e) order by e.starts_at nulls last) from (select * from public.events
                            where status in ('inscricoes', 'andamento') order by starts_at nulls last limit 8) e), '[]'),
    'mine', coalesce((select jsonb_agg(app.room_summary(r) order by r.starts_at) from public.rooms r
                        where r.status in ('aberta', 'em_andamento')
                          and (r.creator_id = auth.uid() or exists (select 1 from public.room_players rp where rp.room_id = r.id and rp.user_id = auth.uid() and rp.status = 'inscrito'))), '[]'),
    'payouts', coalesce((select jsonb_agg(x order by x ->> 'at' desc) from (
        select jsonb_build_object('user', app.user_card(l.user_id, true), 'cents', sum(l.amount_cents), 'at', max(l.created_at),
                                  'room_code', r.code, 'room_title', r.title) as x
          from public.ledger l join public.rooms r on r.id::text = l.ref_id
         where l.kind = any (app.prize_kinds()) and l.created_at > now() - interval '14 days'
         group by l.user_id, r.id order by max(l.created_at) desc limit 12) q), '[]')
  );
end $$;

create or replace function public.list_rooms(p_tab text default 'abertas', p_q text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform app.require_user();
  return coalesce((select jsonb_agg(app.room_summary(r) order by
            case when p_tab in ('encerradas') then extract(epoch from coalesce(r.finished_at, r.created_at)) * -1 else 0 end,
            r.official desc, r.featured desc, r.starts_at)
    from public.rooms r
   where case p_tab
           when 'abertas' then r.status = 'aberta'
           when 'oficiais' then r.official and r.status in ('aberta', 'em_andamento')
           when 'ao_vivo' then r.status = 'em_andamento'
           when 'encerradas' then r.status in ('finalizada', 'cancelada')
           when 'minhas' then r.creator_id = auth.uid() or exists (select 1 from public.room_players rp where rp.room_id = r.id and rp.user_id = auth.uid() and rp.status = 'inscrito')
           else r.status in ('aberta', 'em_andamento') end
     and (v_q is null or r.title ilike '%' || v_q || '%' or r.code::text = v_q or r.map ilike '%' || v_q || '%' or r.tier ilike '%' || v_q || '%'
          or exists (select 1 from public.profiles p where p.id = r.creator_id and p.nick ilike '%' || v_q || '%'))
   limit 100), '[]');
end $$;

-- ---------------------------------------------------------------- admin: modelos, taxas e configurações
create or replace function public.admin_templates() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.sort, t.name) from public.room_templates t), '[]');
end $$;

create or replace function public.admin_template_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id text := lower(regexp_replace(btrim(coalesce(p ->> 'id', '')), '[^a-zA-Z0-9-]+', '-', 'g')); d jsonb; s public.settings;
begin
  perform app.require_level(2); s := app.settings();
  if length(v_id) < 3 then perform app.fail('Defina um código para o modelo (ex.: sala-noturna).'); end if;
  if coalesce(p ->> 'tier', '') not in ('base', 'intermediaria', 'elite', 'dominio', 'ancestral') then perform app.fail('Escolha o nível do modelo.'); end if;
  d := app.parse_room(p || jsonb_build_object('starts_at', now() + interval '1 day'), s);
  insert into public.room_templates (id, name, tier, description, mode, team_size, map, max_players, entry_cents, prizes, mechanics, rules, xp_mult, official_only, active, sort)
  values (v_id, d ->> 'title', p ->> 'tier', left(coalesce(p ->> 'description', ''), 200), d ->> 'mode', (d ->> 'team_size')::int, d ->> 'map',
          (d ->> 'max_players')::int, (d ->> 'entry_cents')::bigint, d -> 'prizes', d -> 'mechanics', d ->> 'rules', (d ->> 'xp_mult')::numeric,
          coalesce((p ->> 'official_only')::boolean, false), coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'sort')::int, 50))
  on conflict (id) do update set name = excluded.name, tier = excluded.tier, description = excluded.description, mode = excluded.mode,
       team_size = excluded.team_size, map = excluded.map, max_players = excluded.max_players, entry_cents = excluded.entry_cents,
       prizes = excluded.prizes, mechanics = excluded.mechanics, rules = excluded.rules, xp_mult = excluded.xp_mult,
       official_only = excluded.official_only, active = excluded.active;
  perform app.log('Salvou modelo de sala', d ->> 'title', app.brl((d ->> 'entry_cents')::bigint) || ' · ' || (p ->> 'tier'));
  return public.admin_templates();
end $$;

create or replace function public.admin_template_delete(p_id text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  delete from public.room_templates where id = p_id;
  perform app.log('Apagou modelo de sala', p_id);
  return public.admin_templates();
end $$;

-- taxa da plataforma combinada com um organizador (null volta para a padrão)
create or replace function public.admin_set_creator_fee(p_user uuid, p_pct numeric) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare t public.profiles;
begin
  perform app.require_level(2);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 50) then perform app.fail('A taxa vai de 0% a 50%.'); end if;
  update public.profiles set creator_fee_pct = p_pct where id = t.id;
  perform app.log('Mudou taxa do organizador', t.nick, coalesce(p_pct || '%', 'padrão'));
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

create or replace function app.admin_user_row(p public.profiles) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select app.user_card(p.id) || jsonb_build_object(
    'email', (select email from auth.users where id = p.id),
    'balance_cents', (select balance_cents from public.wallets where user_id = p.id),
    'held_cents', (select held_cents from public.wallets where user_id = p.id),
    'can_create_rooms', p.can_create_rooms, 'creator_fee_pct', p.creator_fee_pct, 'ff_nick', p.ff_nick, 'ff_id', p.ff_id, 'ff_status', p.ff_status,
    'banned_until', p.banned_until, 'ban_reason', p.ban_reason, 'xp', p.xp, 'kills', p.kills, 'matches', p.matches, 'wins', p.wins,
    'earnings_cents', p.earnings_cents, 'created_at', p.created_at, 'last_seen_at', p.last_seen_at, 'onboarded', p.onboarded,
    'creator_rooms', (select count(*) from public.rooms r where r.creator_id = p.id and r.status = 'finalizada' and not r.official),
    'creator_fee_paid_cents', coalesce((select sum(pl.amount_cents) from public.platform_ledger pl join public.rooms r on r.id::text = pl.ref_id
                                         where pl.kind = 'taxa_sala' and r.creator_id = p.id), 0))
$$;

create or replace function public.admin_set_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; e jsonb;
begin
  me := app.require_level(2);
  if p ? 'daily_themes' then
    if jsonb_typeof(p -> 'daily_themes') <> 'array' then perform app.fail('Temas do dia inválidos.'); end if;
    for e in select * from jsonb_array_elements(p -> 'daily_themes') loop
      if (e ->> 'dow')::int not between 0 and 6 or length(btrim(coalesce(e ->> 'name', ''))) < 2 then perform app.fail('Cada tema precisa de dia da semana e nome.'); end if;
    end loop;
  end if;
  update public.settings set
    platform_fee_pct = coalesce((p ->> 'platform_fee_pct')::numeric, platform_fee_pct),
    min_player_pct = coalesce((p ->> 'min_player_pct')::numeric, min_player_pct),
    max_guild_cut_pct = coalesce((p ->> 'max_guild_cut_pct')::numeric, max_guild_cut_pct),
    min_deposit_cents = coalesce((p ->> 'min_deposit_cents')::bigint, min_deposit_cents),
    max_deposit_cents = coalesce((p ->> 'max_deposit_cents')::bigint, max_deposit_cents),
    min_withdraw_cents = coalesce((p ->> 'min_withdraw_cents')::bigint, min_withdraw_cents),
    max_withdraw_cents = coalesce((p ->> 'max_withdraw_cents')::bigint, max_withdraw_cents),
    max_entry_cents = coalesce((p ->> 'max_entry_cents')::bigint, max_entry_cents),
    pix_key = coalesce(p ->> 'pix_key', pix_key),
    pix_name = coalesce(p ->> 'pix_name', pix_name),
    pix_city = coalesce(p ->> 'pix_city', pix_city),
    require_verified_withdraw = coalesce((p ->> 'require_verified_withdraw')::boolean, require_verified_withdraw),
    require_verified_paid = coalesce((p ->> 'require_verified_paid')::boolean, require_verified_paid),
    maintenance = coalesce((p ->> 'maintenance')::boolean, maintenance),
    xp = coalesce(p -> 'xp', xp),
    points_default = coalesce(p -> 'points_default', points_default),
    daily_base = coalesce(p -> 'daily_base', daily_base),
    daily_themes = coalesce(p -> 'daily_themes', daily_themes)
  where id = 1;
  if (select min_deposit_cents > max_deposit_cents or min_withdraw_cents > max_withdraw_cents from public.settings where id = 1) then
    perform app.fail('O mínimo não pode ser maior que o máximo.');
  end if;
  perform app.log('Alterou configurações', 'Plataforma', (select string_agg(key, ', ') from jsonb_object_keys(p) key));
  return to_jsonb(app.settings());
end $$;

-- me(): inclui as configurações do modo competitivo
create or replace function app.me_extra(p public.profiles) returns jsonb language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object(
    'creator_fee_pct', coalesce(p.creator_fee_pct, s.platform_fee_pct), 'min_player_pct', s.min_player_pct,
    'points_default', s.points_default, 'daily_themes', s.daily_themes, 'daily_base', s.daily_base)
  from public.settings s where s.id = 1
$$;

do $$
declare v_src text;
begin
  -- acrescenta as configurações novas ao me() sem reescrever a função inteira
  select pg_get_functiondef('public.me()'::regprocedure) into v_src;
  if position('app.me_extra' in v_src) = 0 then
    v_src := replace(v_src, '''xp'', s.xp),', '''xp'', s.xp) || app.me_extra(p),');
    execute v_src;
  end if;
end $$;

create or replace function public.admin_dashboard_extra() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(1);
  return jsonb_build_object(
    'prizes_week', coalesce((select sum(amount_cents) from public.ledger where kind = any (app.prize_kinds()) and created_at > now() - interval '7 days'), 0),
    'revenue_by_kind', coalesce((select jsonb_object_agg(kind, total) from (select kind, sum(amount_cents) total from public.platform_ledger
                                  where created_at >= date_trunc('month', now()) group by kind) q), '{}'),
    'events_active', (select count(*) from public.events where status in ('inscricoes', 'andamento')),
    'official_open', (select count(*) from public.rooms where official and status in ('aberta', 'em_andamento')));
end $$;
