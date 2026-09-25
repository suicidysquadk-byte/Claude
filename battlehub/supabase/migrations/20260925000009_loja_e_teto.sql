-- BattleHub: teto de premiação por sala e loja nova.
-- 1) Com a sala cheia, prêmios + mecânicas (no pior caso) não passam de max_player_pct da arrecadação.
--    O resto fica para o organizador e para a plataforma. Vale para toda sala paga, inclusive a oficial.
-- 2) Loja: banners animados, arte estilo anime (desenhada no app), acessórios de avatar e fundos animados.

-- ---------------------------------------------------------------- teto de premiação
alter table public.settings
  add column max_player_pct numeric not null default 70 check (max_player_pct between 10 and 95);

-- teto: nunca prometer mais do que a sala arrecada (menos a parte do organizador e da plataforma)
create or replace function app.check_budget(d jsonb, s public.settings) returns void
language plpgsql stable as $$
declare tmp public.rooms; v_pot bigint; v_prom bigint; v_cap bigint;
begin
  if coalesce((d ->> 'entry_cents')::bigint, 0) = 0 then return; end if;
  tmp.prizes := d -> 'prizes'; tmp.mechanics := d -> 'mechanics';
  v_pot := (d ->> 'entry_cents')::bigint * (d ->> 'max_players')::int;
  v_prom := app.room_commitment(tmp, (d ->> 'max_players')::int);
  v_cap := floor(v_pot * s.max_player_pct / 100.0)::bigint;
  if v_prom > v_cap then
    perform app.fail('Premiação acima do limite: com a sala cheia a arrecadação é ' || app.brl(v_pot) || ' e os jogadores podem receber no máximo '
      || s.max_player_pct || '% (' || app.brl(v_cap) || '). O resto fica para o organizador e a plataforma. Hoje a sala promete até '
      || app.brl(v_prom) || '. Tire alguma mecânica ou diminua os valores.');
  end if;
end $$;

-- liga o teto na criação e na edição de salas
do $$
declare v_src text; v_new text;
begin
  select pg_get_functiondef('public.create_room(jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, 'if not v_official then perform app.check_balance(d, s); end if;',
                          'if not v_official then perform app.check_balance(d, s); end if;
  perform app.check_budget(d, s);');
  if v_new = v_src then raise exception 'create_room: ponto de ajuste não encontrado'; end if;
  execute v_new;
  select pg_get_functiondef('public.update_room(uuid, jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, 'if not r.official then perform app.check_balance(d, s); end if;',
                          'if not r.official then perform app.check_balance(d, s); end if;
  perform app.check_budget(d, s);');
  if v_new = v_src then raise exception 'update_room: ponto de ajuste não encontrado'; end if;
  execute v_new;
  select pg_get_functiondef('public.admin_set_settings(jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, 'min_player_pct = coalesce((p ->> ''min_player_pct'')::numeric, min_player_pct),',
                          'min_player_pct = coalesce((p ->> ''min_player_pct'')::numeric, min_player_pct),
    max_player_pct = coalesce((p ->> ''max_player_pct'')::numeric, max_player_pct),');
  v_new := replace(v_new, '  update public.settings set',
                          '  if (p ->> ''max_player_pct'')::numeric not between 10 and 95 then perform app.fail(''O teto da premiação vai de 10% a 95%.''); end if;
  update public.settings set');
  v_new := replace(v_new, 'min_withdraw_cents > max_withdraw_cents from',
                          'min_withdraw_cents > max_withdraw_cents or min_player_pct > max_player_pct from');
  v_new := replace(v_new, 'perform app.fail(''O mínimo não pode ser maior que o máximo.'');',
                          'perform app.fail(''O mínimo não pode ser maior que o máximo (vale também para o piso e o teto da premiação).'');');
  if v_new = v_src or v_new not like '%not between 10 and 95%' or v_new not like '%min_player_pct > max_player_pct%' then
    raise exception 'admin_set_settings: ponto de ajuste não encontrado';
  end if;
  execute v_new;
  -- modelos também respeitam o teto
  select pg_get_functiondef('public.admin_template_save(jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, 'd := app.parse_room(p || jsonb_build_object(''starts_at'', now() + interval ''1 day''), s);',
                          'd := app.parse_room(p || jsonb_build_object(''starts_at'', now() + interval ''1 day''), s);
  perform app.check_budget(d, s);');
  if v_new = v_src then raise exception 'admin_template_save: ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

-- modelos que passavam um pouco de 70%
update public.room_templates set prizes = '[{"place":1,"cents":8000},{"place":2,"cents":4500},{"place":3,"cents":2450}]' where id = 'intermediaria';
update public.room_templates set prizes = '[{"place":1,"cents":18000},{"place":2,"cents":9000},{"place":3,"cents":4450}]' where id = 'elite';

create or replace function app.me_extra(p public.profiles) returns jsonb language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object(
    'creator_fee_pct', coalesce(p.creator_fee_pct, s.platform_fee_pct), 'min_player_pct', s.min_player_pct, 'max_player_pct', s.max_player_pct,
    'points_default', s.points_default, 'daily_themes', s.daily_themes, 'daily_base', s.daily_base)
  from public.settings s where s.id = 1
$$;

-- banner inicial no visual preto e dourado
update public.shop_items set data = '{"bg":"linear-gradient(135deg,#0b0906,#1d160b 55%,#0a0806)","anim":"goldline"}' where id = 'banner-padrao';

-- ---------------------------------------------------------------- loja: tipos novos
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('banner', 'moldura', 'titulo', 'cor', 'prioridade', 'acessorio', 'fundo'));
alter table public.profiles add column equipped_accessory text, add column equipped_background text;

-- banners animados: data.anim = efeito, data.art = desenho (feito no app, arte própria)
insert into public.shop_items (id, kind, name, description, price_cents, data, sort) values
  ('banner-ouro-negro', 'banner', 'Ouro Negro', 'Preto e dourado com brilho passando', 790, '{"bg":"linear-gradient(115deg,#050505 0%,#1a1206 35%,#8a6412 52%,#f6c453 60%,#1a1206 72%,#050505 100%)","anim":"shimmer"}', 14),
  ('banner-linha-dourada', 'banner', 'Linha Dourada', 'Discreto: preto fosco com um fio de ouro', 390, '{"bg":"linear-gradient(180deg,#0b0b0d,#111014)","anim":"goldline"}', 15),
  ('banner-grafite', 'banner', 'Grafite', 'Discreto: cinza escuro com textura', 290, '{"bg":"linear-gradient(135deg,#17171b,#232329 55%,#141417)","anim":"grain"}', 16),
  ('banner-carbono', 'banner', 'Fibra de Carbono', 'Discreto: trama de carbono', 390, '{"bg":"repeating-linear-gradient(45deg,#101012 0 6px,#18181c 6px 12px)","anim":"grain"}', 17),
  ('banner-brasas', 'banner', 'Brasas', 'Faíscas subindo no escuro', 490, '{"bg":"linear-gradient(180deg,#0a0503,#2a0d04 60%,#5c1a05)","anim":"embers"}', 18),
  ('banner-tempestade', 'banner', 'Tempestade', 'Raios cortando o céu', 690, '{"bg":"linear-gradient(180deg,#05070f,#141a33 60%,#1c2447)","anim":"lightning"}', 19),
  ('banner-sakura', 'banner', 'Sakura Noturna', 'Pétalas caindo na noite', 990, '{"bg":"linear-gradient(160deg,#12061a,#3a1033 55%,#7a2352)","anim":"sakura","art":"torii"}', 20),
  ('banner-kitsune', 'banner', 'Espírito Raposa', 'Raposa de nove caudas com chamas azuis', 1290, '{"bg":"linear-gradient(150deg,#030712,#0c1e3a 55%,#123c66)","anim":"flames","art":"kitsune"}', 21),
  ('banner-neo-toquio', 'banner', 'Neo Tóquio', 'Cidade neon debaixo de chuva', 990, '{"bg":"linear-gradient(180deg,#070214,#1a0936 55%,#3d0f5c)","anim":"rain","art":"city"}', 22),
  ('banner-lua-carmesim', 'banner', 'Lua Carmesim', 'Samurai diante da lua vermelha', 1290, '{"bg":"linear-gradient(180deg,#0d0204,#2b0508 55%,#4a0a0e)","anim":"moon","art":"samurai"}', 23),
  ('banner-grande-onda', 'banner', 'Grande Onda', 'Onda em estilo gravura japonesa', 890, '{"bg":"linear-gradient(180deg,#e9dfc7,#d8ccb0)","anim":"waves","art":"wave"}', 24),
  ('banner-dragao-dourado', 'banner', 'Dragão Dourado', 'Dragão de ouro com brilho — edição premium', 1990, '{"bg":"linear-gradient(120deg,#050403,#2a1c05 45%,#6b4a0b 60%,#050403)","anim":"shimmer","art":"dragon"}', 25)
on conflict (id) do nothing;

-- acessórios de avatar (desenhados no app)
insert into public.shop_items (id, kind, name, description, price_cents, data, sort) values
  ('acc-bruxa', 'acessorio', 'Chapéu de Bruxa', 'Chapéu pontudo com fivela dourada', 490, '{"acc":"bruxa"}', 50),
  ('acc-palha', 'acessorio', 'Chapéu de Palha', 'Chapéu de palha com fita vermelha', 490, '{"acc":"palha"}', 51),
  ('acc-coroa', 'acessorio', 'Coroa Real', 'Coroa de ouro com pedras', 990, '{"acc":"coroa"}', 52),
  ('acc-aureola', 'acessorio', 'Auréola', 'Anel de luz que flutua', 590, '{"acc":"aureola"}', 53),
  ('acc-chifres', 'acessorio', 'Chifres de Demônio', 'Chifres vermelhos', 590, '{"acc":"chifres"}', 54),
  ('acc-gato', 'acessorio', 'Orelhas de Gato', 'Orelhinhas pretas', 390, '{"acc":"gato"}', 55),
  ('acc-headset', 'acessorio', 'Headset Gamer', 'Fone com LED', 390, '{"acc":"headset"}', 56),
  ('acc-bandana', 'acessorio', 'Bandana Ninja', 'Faixa com placa de metal', 390, '{"acc":"bandana"}', 57),
  ('acc-kabuto', 'acessorio', 'Elmo Samurai', 'Elmo com chifres dourados', 890, '{"acc":"kabuto"}', 58),
  ('acc-oni', 'acessorio', 'Máscara Oni', 'Máscara de demônio japonês de lado', 790, '{"acc":"oni"}', 59)
on conflict (id) do nothing;

-- fundos animados do perfil
insert into public.shop_items (id, kind, name, description, price_cents, data, sort) values
  ('fundo-poeira-ouro', 'fundo', 'Poeira de Ouro', 'Partículas douradas flutuando', 690, '{"fx":"gold"}', 70),
  ('fundo-sakura', 'fundo', 'Chuva de Sakura', 'Pétalas caindo devagar', 790, '{"fx":"sakura"}', 71),
  ('fundo-galaxia', 'fundo', 'Galáxia Viva', 'Estrelas piscando e nebulosa girando', 790, '{"fx":"galaxy"}', 72),
  ('fundo-brasas', 'fundo', 'Brasas', 'Faíscas subindo', 590, '{"fx":"embers"}', 73),
  ('fundo-chuva-neon', 'fundo', 'Chuva Neon', 'Chuva de luz na cidade', 690, '{"fx":"rain"}', 74),
  ('fundo-aurora', 'fundo', 'Aurora', 'Luz do norte se mexendo', 690, '{"fx":"aurora"}', 75),
  ('fundo-codigo', 'fundo', 'Código Verde', 'Letras caindo como em filme hacker', 590, '{"fx":"matrix"}', 76),
  ('fundo-tempestade', 'fundo', 'Tempestade', 'Raios de vez em quando', 690, '{"fx":"storm"}', 77)
on conflict (id) do nothing;

-- recompensas novas no caminho de níveis
insert into public.shop_items (id, kind, name, description, price_cents, data, sort) values
  ('acc-louros', 'acessorio', 'Coroa de Louros', 'Recompensa do nível 18', null, '{"acc":"louros"}', 60),
  ('fundo-coroado', 'fundo', 'Salão Dourado', 'Recompensa do nível 40', null, '{"fx":"gold"}', 78),
  ('banner-imperador', 'banner', 'Imperador', 'Recompensa do nível 35', null, '{"bg":"linear-gradient(120deg,#000,#3b2a07 40%,#f6c453 55%,#3b2a07 70%,#000)","anim":"shimmer","art":"dragon"}', 26)
on conflict (id) do nothing;
insert into public.rewards (level, item_id) values (18, 'acc-louros'), (35, 'banner-imperador'), (40, 'fundo-coroado') on conflict do nothing;

-- ---------------------------------------------------------------- loja: equipar e mostrar
create or replace function public.shop() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return jsonb_build_object('level', app.level_of(me.xp), 'xp', me.xp, 'xp_level', app.xp_for(app.level_of(me.xp)), 'xp_next', app.xp_for(app.level_of(me.xp) + 1),
    'items', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'owned', i.user_id is not null and (i.expires_at is null or i.expires_at > now()), 'expires_at', i.expires_at,
        'equipped', s.id in (me.equipped_banner, me.equipped_frame, me.equipped_title, me.equipped_color, me.equipped_accessory, me.equipped_background),
        'reward_level', (select level from public.rewards where item_id = s.id)) order by s.kind, s.sort)
      from public.shop_items s left join public.inventory i on i.item_id = s.id and i.user_id = me.id where s.active), '[]'),
    'track', coalesce((select jsonb_agg(jsonb_build_object('level', r.level, 'item', to_jsonb(s), 'unlocked', app.level_of(me.xp) >= r.level, 'xp', app.xp_for(r.level)) order by r.level)
      from public.rewards r join public.shop_items s on s.id = r.item_id), '[]'));
end $$;

create or replace function public.equip_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.shop_items;
begin
  me := app.require_user();
  select * into s from public.shop_items where id = p_item;
  if not found then perform app.fail('Item não encontrado.'); end if;
  if s.kind = 'prioridade' then perform app.fail('Prioridade na fila fica ativa sozinha.'); end if;
  if not exists (select 1 from public.inventory where user_id = me.id and item_id = s.id) then perform app.fail('Você ainda não tem esse item.'); end if;
  update public.profiles set
    equipped_banner = case when s.kind = 'banner' then s.id else equipped_banner end,
    equipped_frame = case when s.kind = 'moldura' then s.id else equipped_frame end,
    equipped_title = case when s.kind = 'titulo' then s.id else equipped_title end,
    equipped_color = case when s.kind = 'cor' then s.id else equipped_color end,
    equipped_accessory = case when s.kind = 'acessorio' then s.id else equipped_accessory end,
    equipped_background = case when s.kind = 'fundo' then s.id else equipped_background end
   where id = me.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.unequip_item(p_kind text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_user();
  update public.profiles set
    equipped_banner = case when p_kind = 'banner' then 'banner-padrao' else equipped_banner end,
    equipped_frame = case when p_kind = 'moldura' then null else equipped_frame end,
    equipped_title = case when p_kind = 'titulo' then null else equipped_title end,
    equipped_color = case when p_kind = 'cor' then null else equipped_color end,
    equipped_accessory = case when p_kind = 'acessorio' then null else equipped_accessory end,
    equipped_background = case when p_kind = 'fundo' then null else equipped_background end
   where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- o acessório aparece em todo avatar
create or replace function app.user_card(p_id uuid, p_mask boolean default false) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select case when p.id is null then null else jsonb_build_object(
    'id', case when p_mask and p.anonymous and p.id <> auth.uid() then null else p.id end,
    'nick', case when p_mask and p.anonymous and p.id <> auth.uid() then 'Jogador anônimo' else p.nick end,
    'anonymous', p.anonymous,
    'avatar_url', case when p_mask and p.anonymous and p.id <> auth.uid() then null else p.avatar_url end,
    'code', p.code,
    'level', app.level_of(p.xp),
    'role', p.role,
    'verified', p.ff_status = 'aprovado',
    'frame', (select data from public.shop_items where id = p.equipped_frame),
    'title', (select data ->> 'text' from public.shop_items where id = p.equipped_title),
    'color', (select data ->> 'color' from public.shop_items where id = p.equipped_color),
    'accessory', case when p_mask and p.anonymous and p.id <> auth.uid() then null else (select data ->> 'acc' from public.shop_items where id = p.equipped_accessory) end,
    'guild_tag', (select tag from public.guilds where id = p.guild_id),
    'banned', app.is_banned(p)
  ) end
  from (select 1) x left join public.profiles p on p.id = p_id
$$;

-- banner animado e fundo no perfil (próprio e público)
do $$
declare v_src text; v_new text;
begin
  select pg_get_functiondef('public.me()'::regprocedure) into v_src;
  v_new := replace(v_src, '''color_hex'', (select data ->> ''color'' from public.shop_items where id = p.equipped_color)),',
    '''color_hex'', (select data ->> ''color'' from public.shop_items where id = p.equipped_color),
       ''accessory'', p.equipped_accessory, ''background'', p.equipped_background,
       ''accessory_key'', (select data ->> ''acc'' from public.shop_items where id = p.equipped_accessory),
       ''banner_data'', (select data from public.shop_items where id = coalesce(p.equipped_banner, ''banner-padrao'')),
       ''background_data'', (select data from public.shop_items where id = p.equipped_background)),');
  if v_new = v_src then raise exception 'me(): ponto de ajuste não encontrado'; end if;
  execute v_new;
  select pg_get_functiondef('public.get_profile(uuid)'::regprocedure) into v_src;
  v_new := replace(v_src, '''banner_bg'', (select data ->> ''bg'' from public.shop_items where id = coalesce(p.equipped_banner, ''banner-padrao'')),',
    '''banner_bg'', (select data ->> ''bg'' from public.shop_items where id = coalesce(p.equipped_banner, ''banner-padrao'')),
    ''banner_data'', (select data from public.shop_items where id = coalesce(p.equipped_banner, ''banner-padrao'')),
    ''background_data'', (select data from public.shop_items where id = p.equipped_background),');
  if v_new = v_src then raise exception 'get_profile: ponto de ajuste não encontrado'; end if;
  execute v_new;
  select pg_get_functiondef('public.admin_shop_save(jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, 'not in (''banner'', ''moldura'', ''titulo'', ''cor'', ''prioridade'')', 'not in (''banner'', ''moldura'', ''titulo'', ''cor'', ''prioridade'', ''acessorio'', ''fundo'')');
  if v_new = v_src then raise exception 'admin_shop_save: ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

revoke all on all functions in schema app from public;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
