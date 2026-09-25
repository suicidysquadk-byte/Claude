-- BattleHub: funções internas (schema app, fora da API pública).

create or replace function app.fail(p_msg text) returns void language plpgsql as $$
begin
  raise exception using message = p_msg, errcode = 'P0001';
end $$;

create or replace function app.brl(p_cents bigint) returns text language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(p_cents, 0) / 100.0, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.')
$$;

create or replace function app.level_of(p_xp int) returns int language sql immutable as $$
  select floor(sqrt(greatest(p_xp, 0) / 50.0))::int + 1
$$;

create or replace function app.xp_for(p_level int) returns int language sql immutable as $$
  select 50 * (greatest(p_level, 1) - 1) * (greatest(p_level, 1) - 1)
$$;

create or replace function app.role_level(p_role text) returns int language sql immutable as $$
  select case p_role when 'dono' then 3 when 'admin' then 2 when 'moderador' then 1 else 0 end
$$;

create or replace function app.settings() returns public.settings language sql stable security definer set search_path = public, app as $$
  select * from public.settings where id = 1
$$;

create or replace function app.is_banned(p public.profiles) returns boolean language sql stable as $$
  select p.banned_until is not null and p.banned_until > now()
$$;

-- usuário logado, ativo (não banido). Levanta erro em português.
create or replace function app.require_user() returns public.profiles
language plpgsql stable security definer set search_path = public, app as $$
declare v public.profiles;
begin
  if auth.uid() is null then perform app.fail('Entre na sua conta para continuar.'); end if;
  select * into v from public.profiles where id = auth.uid();
  if not found then perform app.fail('Perfil não encontrado. Saia e entre de novo.'); end if;
  if app.is_banned(v) then
    perform app.fail('Conta suspensa' || case when v.banned_until > now() + interval '50 years' then '' else ' até ' || to_char(v.banned_until at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') end || '. Motivo: ' || coalesce(v.ban_reason, 'violação das regras') || '.');
  end if;
  return v;
end $$;

create or replace function app.require_level(p_level int) returns public.profiles
language plpgsql stable security definer set search_path = public, app as $$
declare v public.profiles;
begin
  v := app.require_user();
  if app.role_level(v.role) < p_level then perform app.fail('Sua conta não tem permissão para isso.'); end if;
  return v;
end $$;

create or replace function app.is_staff(p_user uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select coalesce((select app.role_level(role) >= 1 from public.profiles where id = p_user), false)
$$;

-- movimenta a carteira e grava no extrato; negativo debita (falha se não houver saldo)
create or replace function app.credit(p_user uuid, p_cents bigint, p_kind text, p_note text, p_ref_type text default null, p_ref_id text default null)
returns bigint language plpgsql security definer set search_path = public, app as $$
declare v_bal bigint;
begin
  if coalesce(p_cents, 0) = 0 then
    select balance_cents into v_bal from public.wallets where user_id = p_user;
    return v_bal;
  end if;
  update public.wallets set balance_cents = balance_cents + p_cents, updated_at = now()
   where user_id = p_user and balance_cents + p_cents >= 0
   returning balance_cents into v_bal;
  if not found then
    if not exists (select 1 from public.wallets where user_id = p_user) then perform app.fail('Carteira não encontrada.'); end if;
    perform app.fail('Saldo insuficiente. Adicione saldo na sua carteira.');
  end if;
  insert into public.ledger (user_id, kind, amount_cents, balance_after, note, ref_type, ref_id, actor_id)
  values (p_user, p_kind, p_cents, v_bal, p_note, p_ref_type, p_ref_id, auth.uid());
  return v_bal;
end $$;

create or replace function app.platform(p_kind text, p_cents bigint, p_note text, p_ref_type text default null, p_ref_id text default null)
returns void language sql security definer set search_path = public, app as $$
  insert into public.platform_ledger (kind, amount_cents, note, ref_type, ref_id)
  select p_kind, p_cents, p_note, p_ref_type, p_ref_id where coalesce(p_cents, 0) <> 0
$$;

create or replace function app.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public, app as $$
  insert into public.notifications (user_id, kind, title, body, data) values (p_user, p_kind, p_title, coalesce(p_body, ''), coalesce(p_data, '{}'))
$$;

create or replace function app.log(p_action text, p_target text, p_detail text default null)
returns void language sql security definer set search_path = public, app as $$
  insert into public.audit_log (actor_id, action, target, detail) values (auth.uid(), p_action, p_target, p_detail)
$$;

-- XP com subida de nível e entrega das recompensas do caminho
create or replace function app.add_xp(p_user uuid, p_xp int) returns int
language plpgsql security definer set search_path = public, app as $$
declare v_old int; v_new int; v_lv0 int; v_lv1 int; r record; v_names text := '';
begin
  if coalesce(p_xp, 0) <= 0 then return null; end if;
  update public.profiles set xp = xp + p_xp where id = p_user returning xp - p_xp, xp into v_old, v_new;
  v_lv0 := app.level_of(v_old); v_lv1 := app.level_of(v_new);
  if v_lv1 > v_lv0 then
    for r in select rw.level, si.id, si.name from public.rewards rw join public.shop_items si on si.id = rw.item_id
              where rw.level > v_lv0 and rw.level <= v_lv1 order by rw.level loop
      insert into public.inventory (user_id, item_id, source) values (p_user, r.id, 'recompensa') on conflict do nothing;
      v_names := v_names || case when v_names = '' then '' else ', ' end || r.name;
    end loop;
    perform app.notify(p_user, 'nivel', 'Você subiu para o nível ' || v_lv1,
      case when v_names = '' then 'Continue jogando para desbloquear recompensas.' else 'Recompensa liberada: ' || v_names || '.' end,
      jsonb_build_object('level', v_lv1));
  end if;
  return v_new;
end $$;

create or replace function app.has_priority(p_user uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.inventory i join public.shop_items s on s.id = i.item_id
                  where i.user_id = p_user and s.kind = 'prioridade' and (i.expires_at is null or i.expires_at > now()))
$$;

-- dados públicos de um jogador (anônimo esconde nick e foto)
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
    'guild_tag', (select tag from public.guilds where id = p.guild_id),
    'banned', app.is_banned(p)
  ) end
  from (select 1) x left join public.profiles p on p.id = p_id
$$;

-- quanto a sala promete pagar no máximo (prêmios fixos + mecânicas + por abate)
create or replace function app.room_commitment(p_room public.rooms, p_players int) returns bigint
language sql stable as $$
  select coalesce((select sum((e ->> 'cents')::bigint) from jsonb_array_elements(p_room.prizes) e), 0)
       + coalesce((select sum(case when e ->> 'type' = 'por_kill' then (e ->> 'cents')::bigint * greatest(p_players - 1, 0)
                                   else (e ->> 'cents')::bigint end)
                     from jsonb_array_elements(p_room.mechanics) e), 0)
$$;

create or replace function app.mech_cents(p_room public.rooms, p_type text) returns bigint language sql immutable as $$
  select coalesce((select (e ->> 'cents')::bigint from jsonb_array_elements(p_room.mechanics) e where e ->> 'type' = p_type limit 1), 0)
$$;

create or replace function app.has_mech(p_room public.rooms, p_type text) returns boolean language sql immutable as $$
  select exists (select 1 from jsonb_array_elements(p_room.mechanics) e where e ->> 'type' = p_type)
$$;

-- Calcula a premiação sem gravar nada. Usado pela prévia e pela finalização.
-- p_results: {"players":[{"user_id","kills","placement","survival_min"}],
--             "first_blood": uuid, "king_outcome": "killed|survived|none", "king_killer": uuid}
create or replace function app.compute_payout(p_room_id uuid, p_results jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
declare
  v_room public.rooms; s public.settings; x jsonb;
  v_n int; v_kills_total int := 0; v_lines jsonb := '[]'; v_total bigint := 0;
  v_players jsonb := '[]'; r record; v_winners uuid[]; v_k int; v_part bigint; v_cents bigint; i int;
  v_fb uuid; v_outcome text; v_killer uuid; v_max int; v_rem bigint; v_fee bigint; v_unpaid bigint := 0;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  s := app.settings(); x := s.xp;

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

  -- prêmios por colocação (empate na colocação divide)
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

  -- por abate
  if app.has_mech(v_room, 'por_kill') then
    for r in select user_id, kills from _res where kills > 0 order by user_id loop
      v_lines := v_lines || jsonb_build_object('user_id', r.user_id, 'kind', 'por_kill', 'cents', r.kills * app.mech_cents(v_room, 'por_kill'), 'note', r.kills || ' abate' || case when r.kills > 1 then 's' else '' end);
    end loop;
  end if;

  -- MVP de abates
  if app.has_mech(v_room, 'mvp') then
    select max(kills) into v_max from _res;
    if coalesce(v_max, 0) > 0 then
      select array_agg(user_id order by user_id) into v_winners from _res where kills = v_max;
      v_k := array_length(v_winners, 1); v_cents := app.mech_cents(v_room, 'mvp'); v_part := v_cents / v_k;
      for i in 1 .. v_k loop
        v_lines := v_lines || jsonb_build_object('user_id', v_winners[i], 'kind', 'mvp', 'cents', v_part + case when i = 1 then v_cents - v_part * v_k else 0 end, 'note', 'MVP com ' || v_max || ' abates');
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

  select coalesce(sum((e ->> 'cents')::bigint), 0) into v_total from jsonb_array_elements(v_lines) e;
  if v_total > v_room.vault_cents then
    perform app.fail('O cofre tem ' || app.brl(v_room.vault_cents) || ' e a premiação soma ' || app.brl(v_total) || '. Adicione garantia antes de finalizar.');
  end if;
  v_rem := v_room.vault_cents - v_total;
  v_fee := floor(v_rem * v_room.fee_pct / 100.0);

  -- XP de cada jogador
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', q.user_id, 'kills', q.kills, 'placement', q.placement, 'survival_min', q.survival_min,
      'earned_cents', q.earned,
      'xp', (x ->> 'participar')::int + q.kills * (x ->> 'abate')::int
            + case when q.placement is not null and q.placement <= 3 then (x ->> 'top3')::int else 0 end
            + case when q.placement = 1 then (x ->> 'vitoria')::int else 0 end
            + case when q.user_id = v_fb then (x ->> 'first_blood')::int else 0 end
            + case when v_outcome = 'killed' and q.user_id = v_killer then (x ->> 'rei')::int else 0 end
            + case when q.earned > 0 then (x ->> 'premio')::int else 0 end
    ) order by q.placement nulls last, q.kills desc), '[]')
    into v_players
    from (select rr.*, coalesce((select sum((e ->> 'cents')::bigint) from jsonb_array_elements(v_lines) e where (e ->> 'user_id')::uuid = rr.user_id), 0) as earned
            from _res rr) q;

  return jsonb_build_object(
    'vault_cents', v_room.vault_cents, 'payout_cents', v_total, 'unpaid_cents', v_unpaid,
    'fee_pct', v_room.fee_pct, 'fee_cents', v_fee, 'creator_cents', v_rem - v_fee,
    'lines', v_lines, 'players', v_players,
    'first_blood', v_fb, 'king_id', v_room.king_id, 'king_outcome', v_outcome, 'king_killer', v_killer, 'lucky_id', v_room.lucky_id
  );
end $$;

-- paga um ganho: separa a parte da guilda (cofre) e credita o resto
create or replace function app.pay_winnings(p_user uuid, p_lines jsonb, p_room public.rooms) returns bigint
language plpgsql security definer set search_path = public, app as $$
declare l jsonb; v_gross bigint := 0; v_cut bigint; g public.guilds;
begin
  for l in select * from jsonb_array_elements(p_lines) loop
    if (l ->> 'user_id')::uuid = p_user and (l ->> 'cents')::bigint > 0 then
      perform app.credit(p_user, (l ->> 'cents')::bigint, l ->> 'kind', (l ->> 'note') || ' · Sala #' || p_room.code, 'room', p_room.id::text);
      v_gross := v_gross + (l ->> 'cents')::bigint;
    end if;
  end loop;
  if v_gross > 0 then
    select g2.* into g from public.guild_members gm join public.guilds g2 on g2.id = gm.guild_id where gm.user_id = p_user;
    if found and g.cut_pct > 0 then
      v_cut := floor(v_gross * g.cut_pct / 100.0);
      if v_cut > 0 then
        perform app.credit(p_user, -v_cut, 'cofre_guilda', g.cut_pct || '% para o cofre da ' || g.name, 'guild', g.id::text);
        update public.guilds set vault_cents = vault_cents + v_cut where id = g.id;
        insert into public.guild_vault_log (guild_id, user_id, kind, amount_cents, room_id, note)
        values (g.id, p_user, 'contribuicao', v_cut, p_room.id, 'Sala #' || p_room.code);
      end if;
    end if;
  end if;
  return v_gross;
end $$;

-- inscreve (cobra a inscrição e coloca no cofre da sala)
create or replace function app.enroll(p_room public.rooms, p_user uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare s public.settings; p public.profiles;
begin
  s := app.settings();
  select * into p from public.profiles where id = p_user;
  if app.is_banned(p) then perform app.fail(coalesce(p.nick, 'Jogador') || ' está suspenso.'); end if;
  if p.ff_id is null or p.ff_nick is null then perform app.fail('Cadastre seu nick e ID do Free Fire no perfil antes de entrar em salas.'); end if;
  if p_room.entry_cents > 0 and s.require_verified_paid and p.ff_status <> 'aprovado' then
    perform app.fail('Salas pagas exigem o ID do Free Fire verificado. Envie o print no seu perfil.');
  end if;
  if p_room.creator_id = p_user then perform app.fail('Você é o organizador desta sala.'); end if;
  if p_room.entry_cents > 0 then
    perform app.credit(p_user, -p_room.entry_cents, 'inscricao', 'Inscrição · ' || p_room.title || ' (#' || p_room.code || ')', 'room', p_room.id::text);
  end if;
  insert into public.room_players (room_id, user_id, paid_cents) values (p_room.id, p_user, p_room.entry_cents)
  on conflict (room_id, user_id) do update set status = 'inscrito', paid_cents = excluded.paid_cents, joined_at = now(), kills = 0, placement = null, survival_min = 0, earned_cents = 0, xp_earned = 0;
  update public.rooms set vault_cents = vault_cents + p_room.entry_cents where id = p_room.id;
  delete from public.room_waitlist where room_id = p_room.id and user_id = p_user;
end $$;

-- tira da sala devolvendo o valor pago
create or replace function app.unenroll(p_room public.rooms, p_user uuid, p_status text, p_note text) returns bigint
language plpgsql security definer set search_path = public, app as $$
declare v_paid bigint;
begin
  select paid_cents into v_paid from public.room_players where room_id = p_room.id and user_id = p_user and status = 'inscrito' for update;
  if not found then perform app.fail('Esse jogador não está inscrito na sala.'); end if;
  update public.room_players set status = p_status where room_id = p_room.id and user_id = p_user;
  if v_paid > 0 then
    update public.rooms set vault_cents = vault_cents - v_paid where id = p_room.id;
    perform app.credit(p_user, v_paid, 'reembolso', p_note || ' · ' || p_room.title || ' (#' || p_room.code || ')', 'room', p_room.id::text);
  end if;
  if p_room.king_id = p_user then update public.rooms set king_id = null where id = p_room.id; end if;
  if p_room.lucky_id = p_user then update public.rooms set lucky_id = null where id = p_room.id; end if;
  return v_paid;
end $$;

-- abre vaga: chama o próximo da fila (quem tem prioridade passa na frente)
create or replace function app.promote_waitlist(p_room_id uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_room public.rooms; w record; v_count int;
begin
  loop
    select * into v_room from public.rooms where id = p_room_id for update;
    if v_room.status <> 'aberta' then return; end if;
    select count(*) into v_count from public.room_players where room_id = p_room_id and status = 'inscrito';
    if v_count >= v_room.max_players then return; end if;
    select wl.user_id into w from public.room_waitlist wl where wl.room_id = p_room_id
     order by app.has_priority(wl.user_id) desc, wl.created_at limit 1;
    if not found then return; end if;
    begin
      perform app.enroll(v_room, w.user_id);
      perform app.notify(w.user_id, 'sala', 'Vaga liberada: ' || v_room.title, 'Você saiu da fila e já está inscrito na sala #' || v_room.code || '.', jsonb_build_object('room_id', v_room.id));
    exception when others then
      delete from public.room_waitlist where room_id = p_room_id and user_id = w.user_id;
      perform app.notify(w.user_id, 'sala', 'Você perdeu a vaga em ' || v_room.title, 'Abriu uma vaga, mas: ' || sqlerrm, jsonb_build_object('room_id', v_room.id));
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------- novo usuário
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare v_role text := 'jogador';
begin
  -- a primeira conta criada vira dona do app
  if not exists (select 1 from public.profiles where role = 'dono') then v_role := 'dono'; end if;
  insert into public.profiles (id, role, can_create_rooms, avatar_url, equipped_banner)
  values (new.id, v_role, v_role = 'dono', new.raw_user_meta_data ->> 'avatar_url', 'banner-padrao')
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  insert into public.inventory (user_id, item_id, source) values (new.id, 'banner-padrao', 'recompensa') on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- funções internas não podem ser chamadas pelo app
revoke all on all functions in schema app from public;
grant usage on schema app to authenticated, service_role;
