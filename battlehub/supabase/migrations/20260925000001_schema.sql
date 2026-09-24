-- BattleHub: tabelas, índices, segurança (RLS) e dados iniciais.
-- Valores em dinheiro sempre em centavos (bigint). Nenhuma tabela aceita
-- escrita direta do app: toda mudança passa pelas funções em public (API).

create extension if not exists pgcrypto;
create schema if not exists app;

-- ---------------------------------------------------------------- perfis
create sequence if not exists app.profile_code start 10231;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  code int not null unique default nextval('app.profile_code'),
  nick text unique,
  bio text not null default '',
  avatar_url text,
  role text not null default 'jogador' check (role in ('jogador', 'moderador', 'admin', 'dono')),
  can_create_rooms boolean not null default false,
  onboarded boolean not null default false,
  anonymous boolean not null default false,
  -- Free Fire
  ff_nick text,
  ff_id text,
  ff_photo_path text,
  ff_status text not null default 'nao_enviado' check (ff_status in ('nao_enviado', 'pendente', 'aprovado', 'recusado')),
  ff_note text,
  -- progresso
  xp int not null default 0,
  kills int not null default 0,
  matches int not null default 0,
  wins int not null default 0,
  top3 int not null default 0,
  survival_min int not null default 0,
  earnings_cents bigint not null default 0,
  first_bloods int not null default 0,
  kings_killed int not null default 0,
  -- visual
  equipped_banner text,
  equipped_frame text,
  equipped_title text,
  equipped_color text,
  -- moderação
  banned_until timestamptz,
  ban_reason text,
  guild_id uuid,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index profiles_nick_lower on public.profiles (lower(nick));
create index profiles_ff_id on public.profiles (ff_id);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  held_cents bigint not null default 0 check (held_cents >= 0),
  updated_at timestamptz not null default now()
);

-- extrato de cada jogador (+ crédito, − débito)
create table public.ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  amount_cents bigint not null,
  balance_after bigint not null,
  note text,
  ref_type text,
  ref_id text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index ledger_user on public.ledger (user_id, created_at desc);

-- receita da plataforma (taxas e loja)
create table public.platform_ledger (
  id bigserial primary key,
  kind text not null,
  amount_cents bigint not null,
  note text,
  ref_type text,
  ref_id text,
  created_at timestamptz not null default now()
);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'expirado')),
  provider text not null default 'manual',
  provider_id text unique,
  qr_code text,
  qr_base64 text,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index deposits_status on public.deposits (status, created_at);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  pix_key_type text not null,
  pix_key text not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'recusado')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index withdrawals_status on public.withdrawals (status, created_at);

-- ---------------------------------------------------------------- salas
create sequence if not exists app.room_code start 1001;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code int not null unique default nextval('app.room_code'),
  creator_id uuid not null references public.profiles (id),
  title text not null,
  rules text not null default '',
  mode text not null default 'Battle Royale',
  team_size int not null default 1 check (team_size in (1, 2, 4)),
  map text not null default 'Bermuda',
  max_players int not null check (max_players between 2 and 100),
  entry_cents bigint not null default 0 check (entry_cents >= 0),
  prizes jsonb not null default '[]',      -- [{"place":1,"cents":6000}]
  mechanics jsonb not null default '[]',   -- [{"type":"rei","cents":1000}]
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'finalizada', 'cancelada')),
  starts_at timestamptz not null,
  vault_cents bigint not null default 0 check (vault_cents >= 0),
  guarantee_cents bigint not null default 0 check (guarantee_cents >= 0),
  king_id uuid references public.profiles (id),
  lucky_id uuid references public.profiles (id),
  featured boolean not null default false,
  fee_pct numeric not null default 0,
  results jsonb,
  cancel_reason text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index rooms_status on public.rooms (status, starts_at);
create index rooms_creator on public.rooms (creator_id, created_at desc);

create table public.room_secrets (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  game_room_id text,
  password text
);

create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'inscrito' check (status in ('inscrito', 'removido', 'saiu')),
  paid_cents bigint not null default 0,
  kills int not null default 0,
  placement int,
  survival_min int not null default 0,
  earned_cents bigint not null default 0,
  xp_earned int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_players_user on public.room_players (user_id, joined_at desc);

create table public.room_waitlist (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.room_messages (
  id bigserial primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);
create index room_messages_room on public.room_messages (room_id, id);

-- catálogo das mecânicas prontas (a regra de pagamento de cada uma está em app.compute_payout)
create table public.mechanic_types (
  id text primary key,
  name text not null,
  description text not null,
  uses_draw boolean not null default false,
  sort int not null default 0
);

-- ---------------------------------------------------------------- guildas
create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  description text not null default '',
  leader_id uuid not null references public.profiles (id),
  vault_cents bigint not null default 0 check (vault_cents >= 0),
  cut_pct numeric not null default 10 check (cut_pct between 0 and 50),
  recruiting boolean not null default true,
  min_level int not null default 1,
  color text not null default '#7c3aed',
  last_payout_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index guilds_name_lower on public.guilds (lower(name));
create unique index guilds_tag_upper on public.guilds (upper(tag));
alter table public.profiles add constraint profiles_guild_fk foreign key (guild_id) references public.guilds (id) on delete set null;

create table public.guild_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  role text not null default 'membro' check (role in ('lider', 'vice', 'membro')),
  joined_at timestamptz not null default now()
);
create index guild_members_guild on public.guild_members (guild_id);

create table public.guild_vault_log (
  id bigserial primary key,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('contribuicao', 'salario', 'ajuste')),
  amount_cents bigint not null,
  room_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index guild_vault_log_guild on public.guild_vault_log (guild_id, created_at desc);

-- ---------------------------------------------------------------- social
create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceita')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index friendships_addressee on public.friendships (addressee);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'privado' check (kind in ('privado', 'sala')),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);
create unique index threads_pair on public.threads (kind, least(user_a, user_b), greatest(user_a, user_b));

create table public.messages (
  id bigserial primary key,
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  image_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_thread on public.messages (thread_id, id);
create index messages_unread on public.messages (recipient_id) where read_at is null;

create table public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, id desc);

-- ---------------------------------------------------------------- loja e progresso
create table public.shop_items (
  id text primary key,
  kind text not null check (kind in ('banner', 'moldura', 'titulo', 'cor', 'prioridade')),
  name text not null,
  description text not null default '',
  price_cents bigint,               -- null = só por recompensa
  duration_days int,                -- para prioridade
  data jsonb not null default '{}', -- cores, gradiente, texto
  active boolean not null default true,
  sort int not null default 0
);

create table public.rewards (
  level int primary key,
  item_id text not null references public.shop_items (id)
);

create table public.inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.shop_items (id),
  source text not null default 'compra' check (source in ('compra', 'recompensa', 'admin')),
  expires_at timestamptz,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------- moderação
create table public.ff_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ff_nick text not null,
  ff_id text not null,
  photo_path text,
  previous jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index ff_submissions_status on public.ff_submissions (status, created_at);

create table public.bans (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  until timestamptz,             -- null = permanente
  reason text not null,
  by_id uuid,
  lifted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  reason text not null,
  detail text not null default '',
  status text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  resolution text,
  created_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);

create table public.announcements (
  id bigserial primary key,
  title text not null,
  body text not null,
  target text not null default 'todos',
  pinned boolean not null default false,
  reach int not null default 0,
  by_id uuid,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target text,
  detail text,
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  platform_fee_pct numeric not null default 0 check (platform_fee_pct between 0 and 50),
  max_guild_cut_pct numeric not null default 20 check (max_guild_cut_pct between 0 and 50),
  min_deposit_cents bigint not null default 500,
  max_deposit_cents bigint not null default 500000,
  min_withdraw_cents bigint not null default 1000,
  max_withdraw_cents bigint not null default 500000,
  max_entry_cents bigint not null default 100000,
  pix_key text not null default '',
  pix_name text not null default 'BattleHub',
  pix_city text not null default 'SAO PAULO',
  require_verified_withdraw boolean not null default true,
  require_verified_paid boolean not null default false,
  maintenance boolean not null default false,
  xp jsonb not null default '{"participar":20,"abate":10,"top3":40,"vitoria":100,"first_blood":15,"rei":30,"premio":25}'
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------- segurança
-- Tudo fechado por padrão. As políticas abaixo existem para o tempo real
-- (Realtime só entrega linhas que o usuário pode ler).
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger enable row level security;
alter table public.platform_ledger enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.rooms enable row level security;
alter table public.room_secrets enable row level security;
alter table public.room_players enable row level security;
alter table public.room_waitlist enable row level security;
alter table public.room_messages enable row level security;
alter table public.mechanic_types enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_vault_log enable row level security;
alter table public.friendships enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.shop_items enable row level security;
alter table public.rewards enable row level security;
alter table public.inventory enable row level security;
alter table public.ff_submissions enable row level security;
alter table public.bans enable row level security;
alter table public.reports enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings enable row level security;

create policy "carteira própria" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "notificações próprias" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mensagens da conversa" on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "depósitos próprios" on public.deposits for select to authenticated using (user_id = auth.uid());
create policy "salas públicas" on public.rooms for select to authenticated using (true);
create policy "jogadores das salas" on public.room_players for select to authenticated using (true);
create policy "chat da sala" on public.room_messages for select to authenticated using (
  exists (select 1 from public.room_players rp where rp.room_id = room_messages.room_id and rp.user_id = auth.uid() and rp.status = 'inscrito')
  or exists (select 1 from public.rooms r where r.id = room_messages.room_id and r.creator_id = auth.uid())
);

-- tempo real
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.messages, public.room_messages, public.rooms, public.room_players, public.wallets, public.deposits;
  end if;
end $$;

-- ---------------------------------------------------------------- dados iniciais
insert into public.mechanic_types (id, name, description, uses_draw, sort) values
  ('first_blood', 'Primeiro abate', 'Quem fizer o primeiro abate da partida leva o bônus.', false, 1),
  ('rei', 'Player Rei', 'A roleta sorteia um jogador para ser o Rei. Quem eliminar o Rei leva o bônus. Se o Rei sobreviver até o fim, o bônus é dele.', true, 2),
  ('por_kill', 'Recompensa por abate', 'Cada abate confirmado vale o valor definido.', false, 3),
  ('mvp', 'MVP de abates', 'Quem fizer mais abates leva o bônus. Empate divide.', false, 4),
  ('sorteio', 'Sorteio da sala', 'A roleta sorteia um participante que ganha o bônus no fim da partida.', true, 5);

insert into public.shop_items (id, kind, name, description, price_cents, duration_days, data, sort) values
  ('banner-padrao', 'banner', 'Padrão', 'Banner inicial', null, null, '{"bg":"linear-gradient(135deg,#1c1b2e,#2d2b45 55%,#15141f)"}', 0),
  ('banner-roxo', 'banner', 'Roxo Competitivo', 'Recompensa do nível 2', null, null, '{"bg":"linear-gradient(120deg,#3b0f7a,#7c3aed 50%,#c084fc)"}', 1),
  ('banner-chamas', 'banner', 'Chamas', 'Recompensa do nível 7', null, null, '{"bg":"linear-gradient(120deg,#5c0d12,#dc2626 50%,#fb923c)"}', 2),
  ('banner-gelo', 'banner', 'Gelo Mortal', 'Recompensa do nível 15', null, null, '{"bg":"linear-gradient(120deg,#0b3954,#0891b2 50%,#a5f3fc)"}', 3),
  ('banner-coroa', 'banner', 'Coroa Suprema', 'Recompensa do nível 25', null, null, '{"bg":"linear-gradient(120deg,#5b3308,#b7791f 45%,#f6c453 70%,#8a5a12)"}', 4),
  ('banner-neon', 'banner', 'Neon Noturno', 'Luzes de cidade à noite', 490, null, '{"bg":"linear-gradient(120deg,#0f0c29,#302b63 45%,#ff2e97 100%)"}', 10),
  ('banner-aurora', 'banner', 'Aurora', 'Verde e violeta boreal', 690, null, '{"bg":"linear-gradient(120deg,#0b1e2d,#11998e 45%,#8e2de2)"}', 11),
  ('banner-lava', 'banner', 'Lava', 'Magma em movimento', 490, null, '{"bg":"linear-gradient(120deg,#1a0500,#c2410c 50%,#fde047)"}', 12),
  ('banner-galaxia', 'banner', 'Galáxia', 'Nebulosa com estrelas', 990, null, '{"bg":"radial-gradient(circle at 20% 30%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 60%,#fff 0 1px,transparent 2px),linear-gradient(120deg,#030014,#3b0764 50%,#0e7490)"}', 13),
  ('moldura-bronze', 'moldura', 'Bronze', 'Recompensa do nível 3', null, null, '{"ring":"#d08a5b"}', 20),
  ('moldura-ouro', 'moldura', 'Ouro', 'Recompensa do nível 10', null, null, '{"ring":"#f6b83c"}', 21),
  ('moldura-diamante', 'moldura', 'Diamante', 'Recompensa do nível 20', null, null, '{"ring":"#7dd3fc"}', 22),
  ('moldura-neon', 'moldura', 'Neon Roxo', 'Contorno brilhante', 390, null, '{"ring":"#b69cff","glow":true}', 23),
  ('moldura-fogo', 'moldura', 'Fogo', 'Contorno em chamas', 590, null, '{"ring":"#fb923c","glow":true}', 24),
  ('moldura-arco', 'moldura', 'Arco-íris', 'Contorno que gira', 790, null, '{"ring":"conic","glow":true}', 25),
  ('titulo-cacador', 'titulo', 'Caçador', 'Recompensa do nível 5', null, null, '{"text":"Caçador"}', 30),
  ('titulo-lenda', 'titulo', 'Lenda da Sala', 'Recompensa do nível 12', null, null, '{"text":"Lenda da Sala"}', 31),
  ('titulo-imortal', 'titulo', 'Imortal', 'Recompensa do nível 30', null, null, '{"text":"Imortal"}', 32),
  ('titulo-brabo', 'titulo', 'O Brabo', 'Aparece embaixo do seu nick', 290, null, '{"text":"O Brabo"}', 33),
  ('titulo-sniper', 'titulo', 'Sniper', 'Aparece embaixo do seu nick', 290, null, '{"text":"Sniper"}', 34),
  ('titulo-call', 'titulo', 'Rei da Call', 'Aparece embaixo do seu nick', 290, null, '{"text":"Rei da Call"}', 35),
  ('cor-dourado', 'cor', 'Nick dourado', 'Seu nick em dourado', 390, null, '{"color":"#f6b83c"}', 40),
  ('cor-ciano', 'cor', 'Nick ciano', 'Seu nick em ciano', 390, null, '{"color":"#67e8f9"}', 41),
  ('cor-rosa', 'cor', 'Nick rosa', 'Seu nick em rosa neon', 390, null, '{"color":"#ff5fa2"}', 42),
  ('prioridade-7', 'prioridade', 'Prioridade na fila · 7 dias', 'Passa na frente na fila de espera das salas cheias', 490, 7, '{}', 50),
  ('prioridade-30', 'prioridade', 'Prioridade na fila · 30 dias', 'Passa na frente na fila de espera das salas cheias', 1490, 30, '{}', 51);

insert into public.rewards (level, item_id) values
  (2, 'banner-roxo'), (3, 'moldura-bronze'), (5, 'titulo-cacador'), (7, 'banner-chamas'),
  (10, 'moldura-ouro'), (12, 'titulo-lenda'), (15, 'banner-gelo'), (20, 'moldura-diamante'),
  (25, 'banner-coroa'), (30, 'titulo-imortal');
