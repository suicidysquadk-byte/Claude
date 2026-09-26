-- BattleHub: PERSONALIZAÇÃO (sistema de cosméticos)
-- - Tipos novos: avatar, capa, pet, chaveiro, chapéu, arma, efeito de perfil, efeito de entrada, animação de avatar,
--   tema e bundle (além de banner, moldura, título, cor, acessório, fundo e prioridade).
-- - Raridade nova: comum (cinza), incomum (verde), raro (azul), épico (roxo), lendário (dourado), mítico (vermelho),
--   exclusivo (efeito especial) e limitado (só durante um evento).
-- - Variações de cor: o item traz data.variants (lista de paletas) e quem tem o item usa qualquer cor.
-- - Visual por espaço (profiles.look): { tipo: { "i": item, "v": variação } }. As colunas equipped_* antigas continuam
--   sincronizadas (listas e funções antigas seguem funcionando).
-- - Combinações salvas (presets), coleções com recompensa, eventos sazonais e bundles (comprar o bundle entrega
--   todas as partes; equipar o bundle troca tudo de uma vez, ou cada parte sozinha).
-- - Tudo é dado: item novo = linha nova em shop_items apontando para um desenho (data.art) e uma paleta (data.pal).

-- ================================================================ itens
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in (
  'banner', 'moldura', 'titulo', 'cor', 'prioridade', 'acessorio', 'fundo',
  'avatar', 'capa', 'pet', 'chaveiro', 'chapeu', 'arma', 'efeito', 'entrada', 'animacao', 'tema', 'bundle'));

-- raridade: o que era "mítico" (amarelo) vira "lendário" (dourado) e o que era "lendário" (vermelho) vira "mítico"
-- (vermelho), para as cores e os preços continuarem batendo com a escala nova
alter table public.shop_items drop constraint if exists shop_items_rarity_check;
update public.shop_items set rarity = case rarity
  when 'simples' then 'comum' when 'comum' then 'incomum' when 'mitico' then 'x-lendario' when 'lendario' then 'mitico' else rarity end;
update public.shop_items set rarity = 'lendario' where rarity = 'x-lendario';
alter table public.shop_items add constraint shop_items_rarity_check
  check (rarity in ('comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'exclusivo', 'limitado'));

alter table public.shop_items
  add column created_at timestamptz not null default now(),
  add column event_key text,
  add column available_from timestamptz,
  add column available_until timestamptz;
-- o que já existia não aparece como "novo"
update public.shop_items set created_at = now() - interval '30 days';
create index if not exists inventory_item on public.inventory (item_id);

-- ================================================================ eventos sazonais
create table public.cosmetic_events (
  key text primary key,
  name text not null,
  icon text not null default '🎮',
  color text not null default '#c9a24d',
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sort int not null default 0
);
alter table public.cosmetic_events enable row level security;

-- ================================================================ visual por espaço
alter table public.profiles add column look jsonb not null default '{}';

-- espaços que o jogador equipa (um item por espaço); bundle e prioridade não são espaço
create or replace function app.look_kinds() returns text[] language sql immutable as $$
  select array['avatar', 'banner', 'capa', 'moldura', 'pet', 'chaveiro', 'chapeu', 'arma', 'acessorio', 'efeito', 'entrada', 'animacao', 'tema', 'cor', 'fundo', 'titulo']
$$;

-- visual efetivo: o look, com os espaços antigos vindos das colunas equipped_*
create or replace function app.look_effective(p public.profiles) returns jsonb
language sql stable as $$
  select (coalesce(p.look, '{}') - array['banner', 'moldura', 'titulo', 'cor', 'acessorio', 'fundo'])
    || jsonb_strip_nulls(jsonb_build_object(
      'banner', case when p.equipped_banner is not null then jsonb_strip_nulls(jsonb_build_object('i', p.equipped_banner, 'v', case when p.look -> 'banner' ->> 'i' = p.equipped_banner then p.look -> 'banner' ->> 'v' end)) end,
      'moldura', case when p.equipped_frame is not null then jsonb_strip_nulls(jsonb_build_object('i', p.equipped_frame, 'v', case when p.look -> 'moldura' ->> 'i' = p.equipped_frame then p.look -> 'moldura' ->> 'v' end)) end,
      'titulo', case when p.equipped_title is not null then jsonb_build_object('i', p.equipped_title) end,
      'cor', case when p.equipped_color is not null then jsonb_build_object('i', p.equipped_color) end,
      'acessorio', case when p.equipped_accessory is not null then jsonb_strip_nulls(jsonb_build_object('i', p.equipped_accessory, 'v', case when p.look -> 'acessorio' ->> 'i' = p.equipped_accessory then p.look -> 'acessorio' ->> 'v' end)) end,
      'fundo', case when p.equipped_background is not null then jsonb_build_object('i', p.equipped_background) end))
$$;

-- visual pronto para desenhar (com os dados de cada item)
create or replace function app.look_resolved(p public.profiles) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_object_agg(e.key, jsonb_build_object('id', s.id, 'kind', s.kind, 'rarity', s.rarity, 'name', s.name, 'data', s.data, 'v', e.value ->> 'v')), '{}')
    from jsonb_each(app.look_effective(p)) e join public.shop_items s on s.id = e.value ->> 'i'
$$;

-- troca o visual: p = { tipo: { "i": item, "v": cor } ou null para tirar }. p_replace tira os espaços que não vieram.
-- p_lenient ignora itens que a pessoa não tem mais (usado nas combinações salvas).
create or replace function app.apply_look(p_user uuid, p jsonb, p_replace boolean, p_lenient boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; k text; val jsonb; s public.shop_items; v_look jsonb; v_var text;
begin
  select * into me from public.profiles where id = p_user for update;
  v_look := app.look_effective(me);
  if p_replace then
    foreach k in array app.look_kinds() loop
      if not (p ? k) then p := p || jsonb_build_object(k, null); end if;
    end loop;
  end if;
  for k, val in select key, value from jsonb_each(coalesce(p, '{}')) loop
    if not (k = any (app.look_kinds())) then perform app.fail('Espaço de visual inválido: ' || k); end if;
    if val is null or jsonb_typeof(val) = 'null' or coalesce(val ->> 'i', '') = '' then
      v_look := v_look - k;
      continue;
    end if;
    select * into s from public.shop_items where id = val ->> 'i';
    if not found or s.kind <> k then
      if p_lenient then continue; end if;
      perform app.fail('Item inválido para ' || k || '.');
    end if;
    if not exists (select 1 from public.inventory where user_id = me.id and item_id = s.id and (expires_at is null or expires_at > now())) then
      if p_lenient then continue; end if;
      perform app.fail('Você ainda não tem "' || s.name || '".');
    end if;
    v_var := nullif(val ->> 'v', '');
    if v_var is not null and not coalesce(s.data -> 'variants' ? v_var, false) then
      if p_lenient then v_var := null; else perform app.fail('Essa cor não existe para "' || s.name || '".'); end if;
    end if;
    v_look := v_look || jsonb_build_object(k, jsonb_strip_nulls(jsonb_build_object('i', s.id, 'v', v_var)));
  end loop;
  update public.profiles set look = v_look,
    equipped_banner = coalesce(v_look -> 'banner' ->> 'i', 'banner-padrao'),
    equipped_frame = v_look -> 'moldura' ->> 'i',
    equipped_title = v_look -> 'titulo' ->> 'i',
    equipped_color = v_look -> 'cor' ->> 'i',
    equipped_accessory = v_look -> 'acessorio' ->> 'i',
    equipped_background = v_look -> 'fundo' ->> 'i'
   where id = me.id;
  select * into me from public.profiles where id = me.id;
  return app.look_effective(me);
end $$;

create or replace function public.set_look(p jsonb, p_replace boolean default false) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return app.apply_look(me.id, p, coalesce(p_replace, false), false);
end $$;

-- equipar o bundle inteiro (cada parte entra no seu espaço)
create or replace function public.equip_bundle(p_bundle text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; b public.shop_items; v jsonb := '{}';
begin
  me := app.require_user();
  select * into b from public.shop_items where id = p_bundle and kind = 'bundle';
  if not found then perform app.fail('Bundle não encontrado.'); end if;
  if not exists (select 1 from public.inventory where user_id = me.id and item_id = b.id) then perform app.fail('Você ainda não tem esse bundle.'); end if;
  select coalesce(jsonb_object_agg(s.kind, jsonb_strip_nulls(jsonb_build_object('i', s.id, 'v', nullif(b.data ->> 'variant', '')))), '{}') into v
    from jsonb_array_elements_text(b.data -> 'items') x(item) join public.shop_items s on s.id = x.item
   where s.kind = any (app.look_kinds());
  return app.apply_look(me.id, v, false, true);
end $$;

-- ================================================================ compra (bundles e eventos)
create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.shop_items; i public.inventory; v_missing int;
begin
  me := app.require_user();
  select * into s from public.shop_items where id = p_item and active;
  if not found then perform app.fail('Item não encontrado.'); end if;
  if s.price_cents is null then
    perform app.fail(case when s.data ? 'bundle' then 'Esse item só vem no bundle.' when s.rarity = 'exclusivo' then 'Item exclusivo: sai só como recompensa.' else 'Esse item só sai como recompensa.' end);
  end if;
  if s.available_from is not null and now() < s.available_from then
    perform app.fail('Item do evento: chega em ' || to_char(s.available_from at time zone 'America/Sao_Paulo', 'DD/MM') || '.');
  end if;
  if s.available_until is not null and now() > s.available_until then perform app.fail('O evento acabou: esse item não está mais à venda.'); end if;
  select * into i from public.inventory where user_id = me.id and item_id = s.id;
  if found and s.kind <> 'prioridade' then perform app.fail('Você já tem esse item.'); end if;
  perform app.credit(me.id, -s.price_cents, 'compra', 'Loja · ' || s.name, 'item', s.id);
  perform app.platform('loja', s.price_cents, s.name, 'item', s.id);
  if s.kind = 'prioridade' then
    insert into public.inventory (user_id, item_id, source, expires_at) values (me.id, s.id, 'compra', now() + make_interval(days => s.duration_days))
    on conflict (user_id, item_id) do update set expires_at = greatest(coalesce(inventory.expires_at, now()), now()) + make_interval(days => s.duration_days);
  elsif s.kind = 'bundle' then
    insert into public.inventory (user_id, item_id, source) values (me.id, s.id, 'compra');
    insert into public.inventory (user_id, item_id, source)
      select me.id, x.item, 'compra' from jsonb_array_elements_text(s.data -> 'items') x(item) join public.shop_items t on t.id = x.item
      on conflict do nothing;
  else
    insert into public.inventory (user_id, item_id, source) values (me.id, s.id, 'compra');
    if s.kind in ('banner', 'moldura', 'titulo', 'cor', 'acessorio', 'fundo') then perform public.equip_item(s.id); end if;
  end if;
  return public.shop();
end $$;

-- ================================================================ combinações salvas
create table public.look_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  look jsonb not null,
  created_at timestamptz not null default now()
);
create index look_presets_user on public.look_presets (user_id, created_at);
alter table public.look_presets enable row level security;

create or replace function public.look_presets() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'look', look, 'created_at', created_at) order by created_at) from public.look_presets where user_id = me.id), '[]');
end $$;

create or replace function public.save_look_preset(p_name text, p_look jsonb default null, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v_name text := btrim(coalesce(p_name, '')); v_look jsonb;
begin
  me := app.require_user();
  if length(v_name) < 1 or length(v_name) > 24 then perform app.fail('Dê um nome de até 24 letras para a combinação.'); end if;
  perform app.check_text(v_name, 'O nome da combinação');
  v_look := coalesce(p_look, app.look_effective(me));
  if jsonb_typeof(v_look) <> 'object' then perform app.fail('Combinação inválida.'); end if;
  if p_id is not null then
    update public.look_presets set name = v_name, look = v_look where id = p_id and user_id = me.id;
    if not found then perform app.fail('Combinação não encontrada.'); end if;
  else
    if (select count(*) from public.look_presets where user_id = me.id) >= 12 then perform app.fail('Você pode salvar até 12 combinações. Apague uma antes.'); end if;
    insert into public.look_presets (user_id, name, look) values (me.id, v_name, v_look);
  end if;
  return public.look_presets();
end $$;

create or replace function public.apply_look_preset(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; pr public.look_presets;
begin
  me := app.require_user();
  select * into pr from public.look_presets where id = p_id and user_id = me.id;
  if not found then perform app.fail('Combinação não encontrada.'); end if;
  return app.apply_look(me.id, pr.look, true, true);
end $$;

create or replace function public.delete_look_preset(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  delete from public.look_presets where id = p_id and user_id = me.id;
  return public.look_presets();
end $$;

-- ================================================================ coleções
create table public.cosmetic_collections (
  id text primary key,
  name text not null,
  icon text not null default '✨',
  description text not null default '',
  reward_item_id text references public.shop_items (id),
  event_key text references public.cosmetic_events (key),
  sort int not null default 0,
  active boolean not null default true
);
create table public.cosmetic_collection_items (
  collection_id text not null references public.cosmetic_collections (id) on delete cascade,
  item_id text not null references public.shop_items (id) on delete cascade,
  primary key (collection_id, item_id)
);
create table public.collection_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  collection_id text not null references public.cosmetic_collections (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);
alter table public.cosmetic_collections enable row level security;
alter table public.cosmetic_collection_items enable row level security;
alter table public.collection_claims enable row level security;

create or replace function app.collections_of(p_user uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(x order by (x ->> 'sort')::int), '[]') from (
    select jsonb_build_object('id', c.id, 'name', c.name, 'icon', c.icon, 'description', c.description, 'sort', c.sort, 'event_key', c.event_key,
      'items', (select coalesce(jsonb_agg(ci.item_id), '[]') from public.cosmetic_collection_items ci where ci.collection_id = c.id),
      'total', (select count(*) from public.cosmetic_collection_items ci where ci.collection_id = c.id),
      'owned', (select count(*) from public.cosmetic_collection_items ci join public.inventory i on i.item_id = ci.item_id and i.user_id = p_user where ci.collection_id = c.id),
      'reward', c.reward_item_id,
      'claimed', exists (select 1 from public.collection_claims cc where cc.collection_id = c.id and cc.user_id = p_user)) x
      from public.cosmetic_collections c where c.active) q
$$;

create or replace function public.my_collections() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return app.collections_of(me.id);
end $$;

create or replace function public.claim_collection(p_id text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; c public.cosmetic_collections; v_total int; v_owned int; r public.shop_items;
begin
  me := app.require_user();
  select * into c from public.cosmetic_collections where id = p_id and active;
  if not found then perform app.fail('Coleção não encontrada.'); end if;
  if exists (select 1 from public.collection_claims where user_id = me.id and collection_id = c.id) then perform app.fail('Você já resgatou essa recompensa.'); end if;
  select count(*), count(i.item_id) into v_total, v_owned from public.cosmetic_collection_items ci
    left join public.inventory i on i.item_id = ci.item_id and i.user_id = me.id where ci.collection_id = c.id;
  if v_total = 0 or v_owned < v_total then perform app.fail('Complete a coleção primeiro (' || v_owned || '/' || v_total || ').'); end if;
  insert into public.collection_claims (user_id, collection_id) values (me.id, c.id);
  if c.reward_item_id is not null then
    insert into public.inventory (user_id, item_id, source) values (me.id, c.reward_item_id, 'recompensa') on conflict do nothing;
    select * into r from public.shop_items where id = c.reward_item_id;
    perform app.notify(me.id, 'nivel', 'Coleção ' || c.name || ' completa!', 'Você ganhou: ' || r.name || '.', '{}'::jsonb);
  end if;
  perform app.log('Completou coleção', c.name, coalesce(r.name, ''));
  return app.collections_of(me.id);
end $$;

-- ================================================================ catálogo da Personalização (uma chamada só)
create or replace function public.personalizacao() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; w public.wallets;
begin
  me := app.require_user();
  select * into w from public.wallets where user_id = me.id;
  return jsonb_build_object(
    'now', now(), 'balance_cents', coalesce(w.balance_cents, 0), 'level', app.level_of(me.xp),
    'look', app.look_effective(me),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'kind', s.kind, 'name', s.name, 'description', s.description, 'price_cents', s.price_cents, 'rarity', s.rarity,
        'data', s.data, 'sort', s.sort, 'created_at', s.created_at, 'event_key', s.event_key, 'available_from', s.available_from, 'available_until', s.available_until,
        'duration_days', s.duration_days,
        'owned', i.user_id is not null and (i.expires_at is null or i.expires_at > now()), 'expires_at', i.expires_at,
        'owners', coalesce(pop.n, 0),
        'reward_level', (select level from public.rewards where item_id = s.id),
        'achievement', (select jsonb_build_object('stat', a.stat, 'threshold', a.threshold) from app.achievements a where a.item_id = s.id),
        'synergy_tier', (select t.tier from app.synergy_tiers t where t.item_id = s.id),
        'collection_reward', (select c.name from public.cosmetic_collections c where c.reward_item_id = s.id limit 1)) order by s.kind, s.sort, s.id)
      from public.shop_items s
      left join public.inventory i on i.item_id = s.id and i.user_id = me.id
      left join (select item_id, count(*) n from public.inventory group by item_id) pop on pop.item_id = s.id
     where s.active), '[]'),
    'presets', public.look_presets(),
    'collections', app.collections_of(me.id),
    'events', coalesce((select jsonb_agg(jsonb_build_object('key', e.key, 'name', e.name, 'icon', e.icon, 'color', e.color, 'description', e.description,
        'starts_at', e.starts_at, 'ends_at', e.ends_at, 'active', now() between e.starts_at and e.ends_at) order by e.starts_at) from public.cosmetic_events e), '[]'));
end $$;

-- ================================================================ o visual completo no perfil e no cartão
do $$
declare v_src text; v_new text;
begin
  select pg_get_functiondef('public.get_profile(uuid)'::regprocedure) into v_src;
  v_new := replace(v_src, '''friend'', app.friend_status(p.id),', '''look'', app.look_resolved(p),' || E'\n    ' || '''friend'', app.friend_status(p.id),');
  if v_new = v_src then raise exception 'get_profile: ponto de ajuste não encontrado'; end if;
  execute v_new;

  select pg_get_functiondef('public.me()'::regprocedure) into v_src;
  v_new := replace(v_src, '''equipped'', jsonb_build_object(', '''look'', app.look_resolved(p), ''equipped'', jsonb_build_object(');
  if v_new = v_src then raise exception 'me(): ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- listas: avatar desenhado e cor da moldura
  select pg_get_functiondef('app.user_card(uuid, boolean)'::regprocedure) into v_src;
  v_new := replace(v_src, '''frame'', (select data from public.shop_items where id = p.equipped_frame),',
    '''frame'', (select data from public.shop_items where id = p.equipped_frame),' || E'\n    ' ||
    '''frame_v'', p.look -> ''moldura'' ->> ''v'',' || E'\n    ' ||
    '''av_art'', case when p_mask and p.anonymous and p.id <> auth.uid() then null else (select data from public.shop_items where id = p.look -> ''avatar'' ->> ''i'') end,' || E'\n    ' ||
    '''av_v'', p.look -> ''avatar'' ->> ''v'',');
  if v_new = v_src then raise exception 'user_card: ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

-- painel: tipos novos, raridade e evento
create or replace function public.admin_shop_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id text := lower(regexp_replace(btrim(coalesce(p ->> 'id', '')), '[^a-zA-Z0-9-]+', '-', 'g'));
begin
  perform app.require_level(2);
  if length(v_id) < 3 then perform app.fail('Defina um código para o item (ex.: banner-verao).'); end if;
  if coalesce(p ->> 'kind', '') not in ('banner', 'moldura', 'titulo', 'cor', 'prioridade', 'acessorio', 'fundo', 'avatar', 'capa', 'pet', 'chaveiro', 'chapeu', 'arma', 'efeito', 'entrada', 'animacao', 'tema', 'bundle') then
    perform app.fail('Tipo de item inválido.');
  end if;
  if coalesce(p ->> 'rarity', 'comum') not in ('comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'exclusivo', 'limitado') then perform app.fail('Raridade inválida.'); end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 2 then perform app.fail('Dê um nome ao item.'); end if;
  insert into public.shop_items (id, kind, name, description, price_cents, duration_days, data, active, sort, rarity, event_key, available_from, available_until)
  values (v_id, p ->> 'kind', btrim(p ->> 'name'), coalesce(p ->> 'description', ''), nullif(p ->> 'price_cents', '')::bigint,
          nullif(p ->> 'duration_days', '')::int, coalesce(p -> 'data', '{}'), coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'sort')::int, 100),
          coalesce(p ->> 'rarity', 'comum'), nullif(p ->> 'event_key', ''), nullif(p ->> 'available_from', '')::timestamptz, nullif(p ->> 'available_until', '')::timestamptz)
  on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
       duration_days = excluded.duration_days, data = excluded.data, active = excluded.active, kind = excluded.kind,
       rarity = excluded.rarity, event_key = excluded.event_key, available_from = excluded.available_from, available_until = excluded.available_until;
  perform app.log('Salvou item da loja', btrim(p ->> 'name'), coalesce(app.brl(nullif(p ->> 'price_cents', '')::bigint), 'só recompensa'));
  return public.admin_shop();
end $$;

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
grant execute on function app.in_thread(uuid, uuid) to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.svc_message_previews(bigint[]) from authenticated;
grant execute on function public.clear_push_token(text) to anon;
