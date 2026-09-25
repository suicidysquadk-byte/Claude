-- BattleHub: API do jogador (chamadas pelo app com supabase.rpc)

-- ================================================================ conta
create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles; w public.wallets; s public.settings; v_lv int; v_staff boolean;
begin
  if auth.uid() is null then return null; end if;
  select * into p from public.profiles where id = auth.uid();
  if not found then
    insert into public.profiles (id, role, can_create_rooms, equipped_banner)
    values (auth.uid(), case when exists (select 1 from public.profiles where role = 'dono') then 'jogador' else 'dono' end, false, 'banner-padrao');
    insert into public.wallets (user_id) values (auth.uid()) on conflict do nothing;
    insert into public.inventory (user_id, item_id, source) values (auth.uid(), 'banner-padrao', 'recompensa') on conflict do nothing;
    select * into p from public.profiles where id = auth.uid();
  end if;
  update public.profiles set last_seen_at = now() where id = p.id;
  select * into w from public.wallets where user_id = p.id;
  s := app.settings(); v_lv := app.level_of(p.xp); v_staff := app.role_level(p.role) >= 1;
  return jsonb_build_object(
    'id', p.id, 'email', (select email from auth.users where id = p.id), 'code', p.code, 'nick', p.nick, 'bio', p.bio,
    'avatar_url', p.avatar_url, 'role', p.role, 'role_level', app.role_level(p.role),
    'can_create_rooms', p.can_create_rooms or v_staff, 'onboarded', p.onboarded, 'anonymous', p.anonymous,
    'ff', jsonb_build_object('nick', p.ff_nick, 'id', p.ff_id, 'status', p.ff_status, 'note', p.ff_note, 'photo_path', p.ff_photo_path),
    'xp', p.xp, 'level', v_lv, 'xp_level', app.xp_for(v_lv), 'xp_next', app.xp_for(v_lv + 1),
    'stats', jsonb_build_object('kills', p.kills, 'matches', p.matches, 'wins', p.wins, 'top3', p.top3, 'survival_min', p.survival_min,
                                'earnings_cents', p.earnings_cents, 'first_bloods', p.first_bloods, 'kings_killed', p.kings_killed),
    'equipped', jsonb_build_object(
       'banner', p.equipped_banner, 'frame', p.equipped_frame, 'title', p.equipped_title, 'color', p.equipped_color,
       'banner_bg', (select data ->> 'bg' from public.shop_items where id = coalesce(p.equipped_banner, 'banner-padrao')),
       'frame_data', (select data from public.shop_items where id = p.equipped_frame),
       'title_text', (select data ->> 'text' from public.shop_items where id = p.equipped_title),
       'color_hex', (select data ->> 'color' from public.shop_items where id = p.equipped_color)),
    'balance_cents', coalesce(w.balance_cents, 0), 'held_cents', coalesce(w.held_cents, 0),
    'banned', app.is_banned(p), 'banned_until', p.banned_until, 'ban_reason', p.ban_reason,
    'guild', (select jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'role', gm.role, 'color', g.color)
                from public.guild_members gm join public.guilds g on g.id = gm.guild_id where gm.user_id = p.id),
    'priority', app.has_priority(p.id),
    'unread', jsonb_build_object(
       'notifications', (select count(*) from public.notifications where user_id = p.id and not read),
       'privado', (select count(*) from public.messages m join public.threads t on t.id = m.thread_id where m.recipient_id = p.id and m.read_at is null and t.kind = 'privado'),
       'sala', (select count(*) from public.messages m join public.threads t on t.id = m.thread_id where m.recipient_id = p.id and m.read_at is null and t.kind = 'sala'),
       'friends', (select count(*) from public.friendships where addressee = p.id and status = 'pendente')),
    'settings', jsonb_build_object('min_deposit_cents', s.min_deposit_cents, 'max_deposit_cents', s.max_deposit_cents,
       'min_withdraw_cents', s.min_withdraw_cents, 'max_withdraw_cents', s.max_withdraw_cents, 'max_entry_cents', s.max_entry_cents,
       'pix_key', s.pix_key, 'pix_name', s.pix_name, 'pix_city', s.pix_city, 'fee_pct', s.platform_fee_pct, 'max_guild_cut_pct', s.max_guild_cut_pct,
       'require_verified_withdraw', s.require_verified_withdraw, 'require_verified_paid', s.require_verified_paid, 'maintenance', s.maintenance, 'xp', s.xp),
    'pinned', (select jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body) from public.announcements a where a.pinned order by a.id desc limit 1),
    'admin_pending', case when v_staff then jsonb_build_object(
       'ff', (select count(*) from public.ff_submissions where status = 'pendente'),
       'reports', (select count(*) from public.reports where status = 'aberta'),
       'deposits', (select count(*) from public.deposits where status = 'pendente' and provider = 'manual'),
       'withdrawals', (select count(*) from public.withdrawals where status = 'pendente')) end,
    'mechanics', (select jsonb_agg(to_jsonb(m) order by m.sort) from public.mechanic_types m)
  );
end $$;

create or replace function app.check_nick(p_nick text, p_self uuid) returns text language plpgsql stable security definer set search_path = public, app as $$
declare v text := btrim(coalesce(p_nick, ''));
begin
  if length(v) < 3 or length(v) > 20 then perform app.fail('O nickname precisa ter de 3 a 20 caracteres.'); end if;
  if v !~ '^[[:alnum:] ._\-•]+$' then perform app.fail('Use só letras, números, espaço, ponto, traço ou sublinhado no nickname.'); end if;
  if exists (select 1 from public.profiles where lower(nick) = lower(v) and id <> p_self) then perform app.fail('Esse nickname já está em uso.'); end if;
  return v;
end $$;

create or replace function app.submit_ff(p_user uuid, p_ff_nick text, p_ff_id text, p_photo text) returns void
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles; v_nick text := btrim(coalesce(p_ff_nick, '')); v_id text := regexp_replace(coalesce(p_ff_id, ''), '\D', '', 'g');
begin
  select * into p from public.profiles where id = p_user;
  if length(v_nick) < 1 or length(v_nick) > 24 then perform app.fail('Digite seu nick do Free Fire (até 24 caracteres).'); end if;
  if length(v_id) < 8 or length(v_id) > 12 then perform app.fail('O ID do Free Fire tem de 8 a 12 números.'); end if;
  if coalesce(p_photo, '') = '' then perform app.fail('Envie o print do seu perfil do Free Fire mostrando o ID.'); end if;
  if position(p_user::text || '/' in p_photo) <> 1 then perform app.fail('Foto inválida. Envie de novo.'); end if;
  if exists (select 1 from public.profiles where ff_id = v_id and id <> p_user and ff_status in ('pendente', 'aprovado')) then
    perform app.fail('Esse ID do Free Fire já está em outra conta. Fale com o suporte se for seu.');
  end if;
  update public.ff_submissions set status = 'recusado', note = 'Substituído por um envio novo', reviewed_at = now() where user_id = p_user and status = 'pendente';
  insert into public.ff_submissions (user_id, ff_nick, ff_id, photo_path, previous)
  values (p_user, v_nick, v_id, p_photo, case when p.ff_id is null then null else jsonb_build_object('ff_nick', p.ff_nick, 'ff_id', p.ff_id, 'status', p.ff_status) end);
  update public.profiles set ff_nick = v_nick, ff_id = v_id, ff_photo_path = p_photo, ff_status = 'pendente', ff_note = null where id = p_user;
end $$;

create or replace function public.complete_onboarding(p_nick text, p_ff_nick text, p_ff_id text, p_photo_path text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles; v_nick text;
begin
  p := app.require_user();
  v_nick := app.check_nick(p_nick, p.id);
  update public.profiles set nick = v_nick where id = p.id;
  perform app.submit_ff(p.id, p_ff_nick, p_ff_id, p_photo_path);
  update public.profiles set onboarded = true where id = p.id;
  perform app.notify(p.id, 'conta', 'Bem-vindo ao BattleHub, ' || v_nick, 'Seu ID do Free Fire está em análise. Enquanto isso, já pode explorar as salas.');
  return public.me();
end $$;

create or replace function public.update_profile(p_nick text, p_bio text, p_avatar_url text, p_anonymous boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles;
begin
  p := app.require_user();
  update public.profiles set nick = app.check_nick(p_nick, p.id), bio = left(btrim(coalesce(p_bio, '')), 160),
         avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), ''), anonymous = coalesce(p_anonymous, false)
   where id = p.id;
  return public.me();
end $$;

create or replace function public.submit_ff(p_ff_nick text, p_ff_id text, p_photo_path text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles;
begin
  p := app.require_user();
  perform app.submit_ff(p.id, p_ff_nick, p_ff_id, p_photo_path);
  return public.me();
end $$;

-- ================================================================ salas
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
    'finished_at', r.finished_at, 'started_at', r.started_at
  )
$$;

create or replace function public.home() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_user();
  return jsonb_build_object(
    'live', (select count(*) from public.rooms where status = 'em_andamento'),
    'open', (select count(*) from public.rooms where status = 'aberta'),
    'prize_cents', coalesce((select sum((e ->> 'cents')::bigint) from public.rooms r, jsonb_array_elements(r.prizes) e where r.status in ('aberta', 'em_andamento')), 0),
    'paid_week_cents', coalesce((select sum(amount_cents) from public.ledger where kind in ('premio', 'first_blood', 'rei', 'por_kill', 'mvp', 'sorteio') and created_at > now() - interval '7 days'), 0),
    'mine', coalesce((select jsonb_agg(app.room_summary(r) order by r.starts_at) from public.rooms r
                        where r.status in ('aberta', 'em_andamento')
                          and (r.creator_id = auth.uid() or exists (select 1 from public.room_players rp where rp.room_id = r.id and rp.user_id = auth.uid() and rp.status = 'inscrito'))), '[]'),
    'payouts', coalesce((select jsonb_agg(x order by x ->> 'at' desc) from (
        select jsonb_build_object('user', app.user_card(l.user_id, true), 'cents', sum(l.amount_cents), 'at', max(l.created_at),
                                  'room_code', r.code, 'room_title', r.title) as x
          from public.ledger l join public.rooms r on r.id::text = l.ref_id
         where l.kind in ('premio', 'first_blood', 'rei', 'por_kill', 'mvp', 'sorteio') and l.created_at > now() - interval '14 days'
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
            r.featured desc, r.starts_at)
    from public.rooms r
   where case p_tab
           when 'abertas' then r.status = 'aberta'
           when 'ao_vivo' then r.status = 'em_andamento'
           when 'encerradas' then r.status in ('finalizada', 'cancelada')
           when 'minhas' then r.creator_id = auth.uid() or exists (select 1 from public.room_players rp where rp.room_id = r.id and rp.user_id = auth.uid() and rp.status = 'inscrito')
           else r.status in ('aberta', 'em_andamento') end
     and (v_q is null or r.title ilike '%' || v_q || '%' or r.code::text = v_q or r.map ilike '%' || v_q || '%'
          or exists (select 1 from public.profiles p where p.id = r.creator_id and p.nick ilike '%' || v_q || '%'))
   limit 100), '[]');
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
    'king', app.user_card(r.king_id), 'lucky', app.user_card(r.lucky_id),
    'results', r.results, 'cancel_reason', r.cancel_reason,
    'secrets', case when v_manage or (v_joined and r.status = 'em_andamento')
                    then (select jsonb_build_object('game_room_id', game_room_id, 'password', password) from public.room_secrets where room_id = r.id) end,
    'player_list', coalesce((select jsonb_agg(app.user_card(rp.user_id) || jsonb_build_object(
          'kills', rp.kills, 'placement', rp.placement, 'survival_min', rp.survival_min, 'earned_cents', rp.earned_cents, 'xp_earned', rp.xp_earned,
          'ff_nick', case when v_see_ff then p.ff_nick end, 'ff_id', case when v_manage then p.ff_id end,
          'ff_verified', p.ff_status = 'aprovado', 'joined_at', rp.joined_at) order by coalesce(rp.placement, 999), rp.joined_at)
        from public.room_players rp join public.profiles p on p.id = rp.user_id where rp.room_id = r.id and rp.status = 'inscrito'), '[]'),
    'waitlist_list', case when v_manage then coalesce((select jsonb_agg(app.user_card(w.user_id) || jsonb_build_object('priority', app.has_priority(w.user_id)) order by app.has_priority(w.user_id) desc, w.created_at)
        from public.room_waitlist w where w.room_id = r.id), '[]') end,
    'waitlist_pos', (select pos from (select w.user_id, row_number() over (order by app.has_priority(w.user_id) desc, w.created_at) pos from public.room_waitlist w where w.room_id = r.id) q where q.user_id = me.id)
  );
end $$;

create or replace function app.parse_room(p jsonb, s public.settings) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_title text := btrim(coalesce(p ->> 'title', '')); v_prizes jsonb := '[]'; v_mech jsonb := '[]'; e jsonb; v_places int[] := '{}'; v_types text[] := '{}';
        v_entry bigint := coalesce((p ->> 'entry_cents')::bigint, 0); v_max int := coalesce((p ->> 'max_players')::int, 0);
        v_team int := coalesce((p ->> 'team_size')::int, 1); v_start timestamptz := (p ->> 'starts_at')::timestamptz;
begin
  if length(v_title) < 3 or length(v_title) > 60 then perform app.fail('O nome da sala precisa ter de 3 a 60 caracteres.'); end if;
  if v_max < 2 or v_max > 100 then perform app.fail('A sala aceita de 2 a 100 jogadores.'); end if;
  if v_team not in (1, 2, 4) then perform app.fail('Escolha solo, dupla ou squad.'); end if;
  if v_entry < 0 or v_entry > s.max_entry_cents then perform app.fail('A inscrição vai de R$ 0,00 a ' || app.brl(s.max_entry_cents) || '.'); end if;
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
    if not exists (select 1 from public.mechanic_types where id = e ->> 'type') then perform app.fail('Mecânica desconhecida: ' || coalesce(e ->> 'type', '?') || '.'); end if;
    if (e ->> 'type') = any (v_types) then perform app.fail('Cada mecânica só pode aparecer uma vez.'); end if;
    v_types := v_types || (e ->> 'type');
    v_mech := v_mech || jsonb_build_object('type', e ->> 'type', 'cents', (e ->> 'cents')::bigint);
  end loop;
  return jsonb_build_object(
    'title', v_title, 'rules', left(btrim(coalesce(p ->> 'rules', '')), 1500),
    'mode', coalesce(nullif(p ->> 'mode', ''), 'Battle Royale'), 'team_size', v_team,
    'map', coalesce(nullif(p ->> 'map', ''), 'Bermuda'), 'max_players', v_max, 'entry_cents', v_entry,
    'starts_at', v_start, 'prizes', v_prizes, 'mechanics', v_mech);
end $$;

create or replace function public.create_room(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings; d jsonb; r public.rooms; v_guar bigint := greatest(coalesce((p ->> 'guarantee_cents')::bigint, 0), 0);
begin
  me := app.require_user(); s := app.settings();
  if not (me.can_create_rooms or app.role_level(me.role) >= 1) then
    perform app.fail('Sua conta ainda não tem permissão para criar salas. Peça à administração.');
  end if;
  d := app.parse_room(p, s);
  insert into public.rooms (creator_id, title, rules, mode, team_size, map, max_players, entry_cents, prizes, mechanics, starts_at, fee_pct)
  values (me.id, d ->> 'title', d ->> 'rules', d ->> 'mode', (d ->> 'team_size')::int, d ->> 'map', (d ->> 'max_players')::int,
          (d ->> 'entry_cents')::bigint, d -> 'prizes', d -> 'mechanics', (d ->> 'starts_at')::timestamptz, s.platform_fee_pct)
  returning * into r;
  insert into public.room_secrets (room_id) values (r.id);
  if v_guar > 0 then
    perform app.credit(me.id, -v_guar, 'garantia', 'Garantia no cofre · ' || r.title || ' (#' || r.code || ')', 'room', r.id::text);
    update public.rooms set vault_cents = vault_cents + v_guar, guarantee_cents = v_guar where id = r.id returning * into r;
  end if;
  perform app.log('Criou sala', '#' || r.code || ' ' || r.title, app.brl(r.entry_cents) || ' · ' || r.max_players || ' vagas');
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
  if r.status <> 'aberta' then perform app.fail('Só dá para editar salas com inscrições abertas.'); end if;
  d := app.parse_room(p, s);
  select count(*) into v_n from public.room_players where room_id = r.id and status = 'inscrito';
  if (d ->> 'max_players')::int < v_n then perform app.fail('Já há ' || v_n || ' inscritos. As vagas não podem ser menores que isso.'); end if;
  if v_n > 0 then
    tmp := r; tmp.prizes := d -> 'prizes'; tmp.mechanics := d -> 'mechanics';
    v_old := app.room_commitment(r, 2); v_new := app.room_commitment(tmp, 2);
    if v_new < v_old then perform app.fail('Com jogadores inscritos, a premiação só pode aumentar.'); end if;
  end if;
  update public.rooms set title = d ->> 'title', rules = d ->> 'rules', mode = d ->> 'mode', team_size = (d ->> 'team_size')::int,
         map = d ->> 'map', max_players = (d ->> 'max_players')::int, entry_cents = (d ->> 'entry_cents')::bigint,
         starts_at = (d ->> 'starts_at')::timestamptz, prizes = d -> 'prizes', mechanics = d -> 'mechanics'
   where id = r.id;
  perform app.promote_waitlist(r.id);
  perform app.log('Editou sala', '#' || r.code || ' ' || (d ->> 'title'));
  return public.get_room(r.id);
end $$;

create or replace function public.add_guarantee(p_id uuid, p_cents bigint) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found or r.creator_id <> me.id then perform app.fail('Só o organizador pode colocar garantia no cofre.'); end if;
  if r.status not in ('aberta', 'em_andamento') then perform app.fail('A sala já foi encerrada.'); end if;
  if coalesce(p_cents, 0) <= 0 then perform app.fail('Digite um valor maior que zero.'); end if;
  perform app.credit(me.id, -p_cents, 'garantia', 'Garantia no cofre · ' || r.title || ' (#' || r.code || ')', 'room', r.id::text);
  update public.rooms set vault_cents = vault_cents + p_cents, guarantee_cents = guarantee_cents + p_cents where id = r.id;
  return public.get_room(r.id);
end $$;

create or replace function public.join_room(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_n int; v_pos int;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
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

create or replace function public.leave_room(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if exists (select 1 from public.room_waitlist where room_id = r.id and user_id = me.id) then
    delete from public.room_waitlist where room_id = r.id and user_id = me.id;
    return jsonb_build_object('status', 'saiu_da_fila');
  end if;
  if r.status <> 'aberta' then perform app.fail('A partida já começou. Fale com o organizador.'); end if;
  perform app.unenroll(r, me.id, 'saiu', 'Saída');
  perform app.promote_waitlist(r.id);
  return jsonb_build_object('status', 'saiu');
end $$;

create or replace function public.start_room(p_id uuid, p_game_room_id text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_n int; v_need bigint; w record;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador pode iniciar a sala.'); end if;
  if r.status <> 'aberta' then perform app.fail('Essa sala já começou ou foi encerrada.'); end if;
  if btrim(coalesce(p_game_room_id, '')) = '' or btrim(coalesce(p_password, '')) = '' then perform app.fail('Digite o ID e a senha da sala do Free Fire.'); end if;
  select count(*) into v_n from public.room_players where room_id = r.id and status = 'inscrito';
  if v_n < 2 then perform app.fail('A sala precisa de pelo menos 2 inscritos para começar.'); end if;
  v_need := app.room_commitment(r, v_n);
  if r.vault_cents < v_need then
    perform app.fail('O cofre tem ' || app.brl(r.vault_cents) || ' e a sala promete até ' || app.brl(v_need) || ' com ' || v_n || ' jogadores. Coloque ' || app.brl(v_need - r.vault_cents) || ' de garantia ou diminua os prêmios.');
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

create or replace function public.draw_room(p_id uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_n int; v_pick uuid; v_label text; w record;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador pode girar a roleta.'); end if;
  if p_kind not in ('rei', 'sorteio') or not app.has_mech(r, p_kind) then perform app.fail('Essa sala não tem essa mecânica.'); end if;
  if r.status not in ('aberta', 'em_andamento') then perform app.fail('A sala já foi encerrada.'); end if;
  select count(*) into v_n from public.room_players where room_id = r.id and status = 'inscrito';
  if v_n < 2 then perform app.fail('Precisa de pelo menos 2 jogadores para girar a roleta.'); end if;
  if r.status = 'aberta' and v_n < r.max_players then perform app.fail('A roleta libera quando a sala lotar ou quando a partida começar.'); end if;
  if (p_kind = 'rei' and r.king_id is not null) or (p_kind = 'sorteio' and r.lucky_id is not null) then
    perform app.fail('A roleta dessa mecânica já foi girada nesta sala.');
  end if;
  select user_id into v_pick from public.room_players where room_id = r.id and status = 'inscrito' order by random() limit 1;
  v_label := case p_kind when 'rei' then 'Player Rei' else 'Sorteado da sala' end;
  if p_kind = 'rei' then update public.rooms set king_id = v_pick where id = r.id; else update public.rooms set lucky_id = v_pick where id = r.id; end if;
  insert into public.room_messages (room_id, sender_id, body)
  values (r.id, me.id, case p_kind when 'rei' then 'A roleta escolheu o Player Rei: ' || (select nick from public.profiles where id = v_pick) || '. Quem eliminar leva ' || app.brl(app.mech_cents(r, 'rei')) || '.'
                                   else 'Sorteado da sala: ' || (select nick from public.profiles where id = v_pick) || ' leva ' || app.brl(app.mech_cents(r, 'sorteio')) || ' no fim da partida.' end);
  for w in select user_id from public.room_players where room_id = r.id and status = 'inscrito' loop
    perform app.notify(w.user_id, 'sala', v_label || ' sorteado', case when w.user_id = v_pick then 'Deu você! ' else (select nick from public.profiles where id = v_pick) || ' foi escolhido. ' end || r.title || ' (#' || r.code || ').', jsonb_build_object('room_id', r.id));
  end loop;
  perform app.log('Girou roleta', '#' || r.code || ' ' || r.title, v_label || ': ' || (select nick from public.profiles where id = v_pick));
  return jsonb_build_object('kind', p_kind, 'winner', app.user_card(v_pick),
    'players', (select jsonb_agg(app.user_card(user_id)) from public.room_players where room_id = r.id and status = 'inscrito'));
end $$;

create or replace function public.preview_results(p_id uuid, p_results jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; c jsonb;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador pode lançar o resultado.'); end if;
  if r.status <> 'em_andamento' then perform app.fail('Inicie a sala antes de lançar o resultado.'); end if;
  c := app.compute_payout(p_id, p_results);
  return c || jsonb_build_object('cards', (select jsonb_object_agg(rp.user_id, app.user_card(rp.user_id)) from public.room_players rp where rp.room_id = p_id and rp.status = 'inscrito'));
end $$;

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

  if (c ->> 'fee_cents')::bigint > 0 then perform app.platform('taxa_sala', (c ->> 'fee_cents')::bigint, 'Sala #' || r.code || ' ' || r.title, 'room', r.id::text); end if;
  if (c ->> 'creator_cents')::bigint > 0 then
    perform app.credit(r.creator_id, (c ->> 'creator_cents')::bigint, 'lucro_sala', 'Sobra do cofre · ' || r.title || ' (#' || r.code || ')', 'room', r.id::text);
  end if;
  perform app.notify(r.creator_id, 'sala', 'Sala #' || r.code || ' finalizada',
    'Premiação paga: ' || app.brl((c ->> 'payout_cents')::bigint) || '. Você recebeu ' || app.brl((c ->> 'creator_cents')::bigint) || ' da sobra do cofre.', jsonb_build_object('room_id', r.id));
  update public.rooms set status = 'finalizada', finished_at = now(), vault_cents = 0, results = c where id = r.id;
  insert into public.room_messages (room_id, sender_id, body) values (r.id, me.id, 'Resultado confirmado. Prêmios creditados nas carteiras.');
  perform app.log('Finalizou sala', '#' || r.code || ' ' || r.title, 'Prêmios ' || app.brl((c ->> 'payout_cents')::bigint) || ' · organizador ' || app.brl((c ->> 'creator_cents')::bigint) || ' · taxa ' || app.brl((c ->> 'fee_cents')::bigint));
  return c;
end $$;

create or replace function public.cancel_room(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; w record; v_ref bigint := 0;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_id for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador pode cancelar a sala.'); end if;
  if r.status not in ('aberta', 'em_andamento') then perform app.fail('Essa sala já foi encerrada.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo do cancelamento.'); end if;
  for w in select user_id, paid_cents from public.room_players where room_id = r.id and status = 'inscrito' loop
    if w.paid_cents > 0 then
      perform app.credit(w.user_id, w.paid_cents, 'reembolso', 'Sala cancelada · ' || r.title || ' (#' || r.code || ')', 'room', r.id::text);
      v_ref := v_ref + w.paid_cents;
    end if;
    perform app.notify(w.user_id, 'sala', r.title || ' foi cancelada', case when w.paid_cents > 0 then app.brl(w.paid_cents) || ' devolvidos. ' else '' end || 'Motivo: ' || btrim(p_reason) || '.', jsonb_build_object('room_id', r.id));
  end loop;
  if r.guarantee_cents > 0 then
    perform app.credit(r.creator_id, r.guarantee_cents, 'reembolso', 'Garantia devolvida · ' || r.title || ' (#' || r.code || ')', 'room', r.id::text);
  end if;
  if r.vault_cents <> v_ref + r.guarantee_cents then perform app.fail('Cofre inconsistente. Nada foi alterado; fale com o suporte.'); end if;
  delete from public.room_waitlist where room_id = r.id;
  update public.rooms set status = 'cancelada', vault_cents = 0, cancel_reason = btrim(p_reason), finished_at = now() where id = r.id;
  perform app.log('Cancelou sala', '#' || r.code || ' ' || r.title, btrim(p_reason) || ' · reembolso ' || app.brl(v_ref));
  return jsonb_build_object('refunded_cents', v_ref, 'guarantee_cents', r.guarantee_cents);
end $$;

create or replace function public.kick_player(p_room uuid, p_user uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_paid bigint;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_room for update;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if r.creator_id <> me.id and app.role_level(me.role) < 1 then perform app.fail('Só o organizador ou a moderação podem remover jogadores.'); end if;
  if r.status not in ('aberta', 'em_andamento') then perform app.fail('A sala já foi encerrada.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo da remoção.'); end if;
  v_paid := app.unenroll(r, p_user, 'removido', 'Removido da sala');
  perform app.notify(p_user, 'sala', 'Você foi removido de ' || r.title, case when v_paid > 0 then app.brl(v_paid) || ' devolvidos. ' else '' end || 'Motivo: ' || btrim(p_reason) || '.', jsonb_build_object('room_id', r.id));
  if r.status = 'aberta' then perform app.promote_waitlist(r.id); end if;
  perform app.log('Removeu jogador da sala', (select nick from public.profiles where id = p_user) || ' · #' || r.code, btrim(p_reason));
  return public.get_room(r.id);
end $$;

create or replace function public.room_chat(p_room uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_room;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if not (r.creator_id = me.id or app.role_level(me.role) >= 1 or exists (select 1 from public.room_players where room_id = r.id and user_id = me.id and status = 'inscrito')) then
    return '[]';
  end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'id')::bigint) from (
    select jsonb_build_object('id', m.id, 'body', m.body, 'image_url', m.image_url, 'created_at', m.created_at,
                              'sender', app.user_card(m.sender_id), 'is_host', m.sender_id = r.creator_id) x
      from public.room_messages m where m.room_id = r.id and m.id > coalesce(p_after, 0) order by m.id desc limit 80) q), '[]');
end $$;

create or replace function public.send_room_message(p_room uuid, p_body text, p_image text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_id bigint;
begin
  me := app.require_user();
  select * into r from public.rooms where id = p_room;
  if not found then perform app.fail('Sala não encontrada.'); end if;
  if not (r.creator_id = me.id or app.role_level(me.role) >= 1 or exists (select 1 from public.room_players where room_id = r.id and user_id = me.id and status = 'inscrito')) then
    perform app.fail('Só inscritos falam no chat da sala.');
  end if;
  if btrim(coalesce(p_body, '')) = '' and p_image is null then perform app.fail('Escreva uma mensagem.'); end if;
  insert into public.room_messages (room_id, sender_id, body, image_url) values (r.id, me.id, left(btrim(coalesce(p_body, '')), 1000), p_image) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- ================================================================ social
create or replace function app.friend_status(p_other uuid) returns text language sql stable security definer set search_path = public, app as $$
  select coalesce((select case when status = 'aceita' then 'amigos' when requester = auth.uid() then 'enviado' else 'recebido' end
                     from public.friendships where (requester = auth.uid() and addressee = p_other) or (requester = p_other and addressee = auth.uid()) limit 1), 'nenhum')
$$;

create or replace function public.search_players(p_q text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v text := btrim(coalesce(p_q, ''));
begin
  perform app.require_user();
  if length(v) < 2 then return '[]'; end if;
  return coalesce((select jsonb_agg(app.user_card(p.id) || jsonb_build_object('friend', app.friend_status(p.id))) from (
      select id from public.profiles where id <> auth.uid() and nick is not null
         and (nick ilike '%' || v || '%' or code::text = regexp_replace(v, '\D', '', 'g') or ff_id = v)
       order by nick limit 20) p), '[]');
end $$;

create or replace function public.get_profile(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles;
begin
  perform app.require_user();
  select * into p from public.profiles where id = p_user;
  if not found then perform app.fail('Jogador não encontrado.'); end if;
  return app.user_card(p.id) || jsonb_build_object(
    'bio', p.bio, 'xp', p.xp, 'ff_nick', p.ff_nick, 'online', p.last_seen_at > now() - interval '5 minutes', 'last_seen_at', p.last_seen_at,
    'banner_bg', (select data ->> 'bg' from public.shop_items where id = coalesce(p.equipped_banner, 'banner-padrao')),
    'stats', jsonb_build_object('kills', p.kills, 'matches', p.matches, 'wins', p.wins, 'top3', p.top3, 'survival_min', p.survival_min,
                                'earnings_cents', case when p.anonymous and p.id <> auth.uid() then null else p.earnings_cents end, 'first_bloods', p.first_bloods, 'kings_killed', p.kings_killed),
    'friend', app.friend_status(p.id),
    'guild', (select jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'role', gm.role) from public.guild_members gm join public.guilds g on g.id = gm.guild_id where gm.user_id = p.id),
    'recent', coalesce((select jsonb_agg(x) from (select jsonb_build_object('room_id', r.id, 'code', r.code, 'title', r.title, 'placement', rp.placement, 'kills', rp.kills, 'finished_at', r.finished_at) x
        from public.room_players rp join public.rooms r on r.id = rp.room_id where rp.user_id = p.id and r.status = 'finalizada' and rp.status = 'inscrito' order by r.finished_at desc limit 6) q), '[]'));
end $$;

create or replace function public.friend_request(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  if p_user = me.id or not exists (select 1 from public.profiles where id = p_user) then perform app.fail('Jogador não encontrado.'); end if;
  if exists (select 1 from public.friendships where requester = p_user and addressee = me.id and status = 'pendente') then
    update public.friendships set status = 'aceita' where requester = p_user and addressee = me.id;
    perform app.notify(p_user, 'amizade', me.nick || ' aceitou seu pedido de amizade', 'Agora vocês podem conversar e jogar juntos.', jsonb_build_object('user_id', me.id));
    return jsonb_build_object('status', 'amigos');
  end if;
  if exists (select 1 from public.friendships where (requester = me.id and addressee = p_user) or (requester = p_user and addressee = me.id)) then
    return jsonb_build_object('status', app.friend_status(p_user));
  end if;
  insert into public.friendships (requester, addressee) values (me.id, p_user);
  perform app.notify(p_user, 'amizade', me.nick || ' quer ser seu amigo', 'Aceite na aba Chat → Amigos.', jsonb_build_object('user_id', me.id));
  return jsonb_build_object('status', 'enviado');
end $$;

create or replace function public.friend_respond(p_user uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  if not exists (select 1 from public.friendships where requester = p_user and addressee = me.id and status = 'pendente') then perform app.fail('Pedido não encontrado.'); end if;
  if p_accept then
    update public.friendships set status = 'aceita' where requester = p_user and addressee = me.id;
    perform app.notify(p_user, 'amizade', me.nick || ' aceitou seu pedido de amizade', 'Agora vocês podem conversar e jogar juntos.', jsonb_build_object('user_id', me.id));
  else
    delete from public.friendships where requester = p_user and addressee = me.id;
  end if;
  return jsonb_build_object('status', case when p_accept then 'amigos' else 'nenhum' end);
end $$;

create or replace function public.friend_remove(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_user();
  delete from public.friendships where (requester = auth.uid() and addressee = p_user) or (requester = p_user and addressee = auth.uid());
  return jsonb_build_object('status', 'nenhum');
end $$;

create or replace function public.my_friends() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(app.user_card(o) || jsonb_build_object('online', p.last_seen_at > now() - interval '5 minutes', 'last_seen_at', p.last_seen_at) order by p.last_seen_at desc)
        from (select case when requester = me.id then addressee else requester end o from public.friendships where status = 'aceita' and (requester = me.id or addressee = me.id)) f
        join public.profiles p on p.id = f.o), '[]'),
    'incoming', coalesce((select jsonb_agg(app.user_card(requester)) from public.friendships where addressee = me.id and status = 'pendente'), '[]'),
    'outgoing', coalesce((select jsonb_agg(app.user_card(addressee)) from public.friendships where requester = me.id and status = 'pendente'), '[]'),
    'suggestions', coalesce((select jsonb_agg(app.user_card(q.user_id) || jsonb_build_object('rooms_together', q.n, 'last_room', q.title)) from (
        select o.user_id, count(*) n, max(r.title) title from public.room_players mine
          join public.room_players o on o.room_id = mine.room_id and o.user_id <> mine.user_id and o.status = 'inscrito'
          join public.rooms r on r.id = mine.room_id and r.status = 'finalizada' and r.finished_at > now() - interval '30 days'
         where mine.user_id = me.id and mine.status = 'inscrito'
           and not exists (select 1 from public.friendships f where (f.requester = me.id and f.addressee = o.user_id) or (f.requester = o.user_id and f.addressee = me.id))
         group by o.user_id order by n desc limit 12) q), '[]'));
end $$;

-- conversas: 'privado' entre jogadores; 'sala' quando o organizador fala com um inscrito
create or replace function app.get_thread(p_kind text, p_a uuid, p_b uuid, p_room uuid) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  select id into v_id from public.threads where kind = p_kind and least(user_a, user_b) = least(p_a, p_b) and greatest(user_a, user_b) = greatest(p_a, p_b);
  if v_id is null then
    insert into public.threads (kind, user_a, user_b, room_id) values (p_kind, p_a, p_b, p_room) returning id into v_id;
  elsif p_room is not null then
    update public.threads set room_id = p_room where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.open_thread(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  if p_user = me.id or not exists (select 1 from public.profiles where id = p_user) then perform app.fail('Jogador não encontrado.'); end if;
  return jsonb_build_object('thread_id', app.get_thread('privado', me.id, p_user, null));
end $$;

create or replace function public.message_player(p_user uuid, p_body text, p_room uuid default null, p_image text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.rooms; v_kind text := 'privado'; v_thread uuid;
begin
  me := app.require_user();
  if p_room is not null then
    select * into r from public.rooms where id = p_room;
    if found and (r.creator_id = me.id or app.role_level(me.role) >= 1)
       and exists (select 1 from public.room_players where room_id = r.id and user_id = p_user) then v_kind := 'sala'; end if;
  end if;
  v_thread := app.get_thread(v_kind, me.id, p_user, case when v_kind = 'sala' then p_room end);
  return public.send_message(v_thread, p_body, p_image) || jsonb_build_object('thread_id', v_thread, 'kind', v_kind);
end $$;

create or replace function public.send_message(p_thread uuid, p_body text, p_image text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.threads; v_to uuid; v_id bigint;
begin
  me := app.require_user();
  select * into t from public.threads where id = p_thread and (user_a = me.id or user_b = me.id);
  if not found then perform app.fail('Conversa não encontrada.'); end if;
  if btrim(coalesce(p_body, '')) = '' and p_image is null then perform app.fail('Escreva uma mensagem.'); end if;
  v_to := case when t.user_a = me.id then t.user_b else t.user_a end;
  insert into public.messages (thread_id, sender_id, recipient_id, body, image_url) values (t.id, me.id, v_to, left(btrim(coalesce(p_body, '')), 2000), p_image) returning id into v_id;
  update public.threads set last_message_at = now() where id = t.id;
  return jsonb_build_object('id', v_id, 'thread_id', t.id);
end $$;

create or replace function public.my_threads(p_kind text default 'privado') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return coalesce((select jsonb_agg(x order by x ->> 'last_at' desc) from (
    select jsonb_build_object('id', t.id, 'kind', t.kind, 'last_at', t.last_message_at,
       'other', app.user_card(case when t.user_a = me.id then t.user_b else t.user_a end)
               || jsonb_build_object('online', (select last_seen_at > now() - interval '5 minutes' from public.profiles where id = case when t.user_a = me.id then t.user_b else t.user_a end)),
       'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title) from public.rooms r where r.id = t.room_id),
       'last', (select jsonb_build_object('body', m.body, 'image', m.image_url is not null, 'mine', m.sender_id = me.id, 'at', m.created_at) from public.messages m where m.thread_id = t.id order by m.id desc limit 1),
       'unread', (select count(*) from public.messages m where m.thread_id = t.id and m.recipient_id = me.id and m.read_at is null)) x
      from public.threads t where (t.user_a = me.id or t.user_b = me.id) and t.kind = p_kind
       and exists (select 1 from public.messages m where m.thread_id = t.id)) q), '[]');
end $$;

create or replace function public.thread_messages(p_thread uuid, p_before bigint default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.threads; v_other uuid;
begin
  me := app.require_user();
  select * into t from public.threads where id = p_thread and (user_a = me.id or user_b = me.id);
  if not found then perform app.fail('Conversa não encontrada.'); end if;
  v_other := case when t.user_a = me.id then t.user_b else t.user_a end;
  update public.messages set read_at = now() where thread_id = t.id and recipient_id = me.id and read_at is null;
  return jsonb_build_object('thread', jsonb_build_object('id', t.id, 'kind', t.kind,
       'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title) from public.rooms r where r.id = t.room_id)),
    'other', app.user_card(v_other) || jsonb_build_object('online', (select last_seen_at > now() - interval '5 minutes' from public.profiles where id = v_other), 'friend', app.friend_status(v_other)),
    'messages', coalesce((select jsonb_agg(x order by (x ->> 'id')::bigint) from (
       select jsonb_build_object('id', m.id, 'body', m.body, 'image_url', m.image_url, 'mine', m.sender_id = me.id, 'created_at', m.created_at, 'read', m.read_at is not null) x
         from public.messages m where m.thread_id = t.id and (p_before is null or m.id < p_before) order by m.id desc limit 60) q), '[]'));
end $$;

create or replace function public.read_thread(p_thread uuid) returns void
language sql security definer set search_path = public, app as $$
  update public.messages set read_at = now() where thread_id = p_thread and recipient_id = auth.uid() and read_at is null
$$;

create or replace function public.my_notifications() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_user();
  return coalesce((select jsonb_agg(to_jsonb(n) order by n.id desc) from (select * from public.notifications where user_id = auth.uid() order by id desc limit 60) n), '[]');
end $$;

create or replace function public.read_notifications() returns void
language sql security definer set search_path = public, app as $$
  update public.notifications set read = true where user_id = auth.uid() and not read
$$;

create or replace function public.report_player(p_user uuid, p_room uuid, p_reason text, p_detail text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  if p_user = me.id then perform app.fail('Você não pode denunciar a própria conta.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escolha o motivo.'); end if;
  if (select count(*) from public.reports where reporter_id = me.id and created_at > now() - interval '1 hour') >= 5 then perform app.fail('Muitas denúncias em pouco tempo. Tente mais tarde.'); end if;
  insert into public.reports (reporter_id, target_id, room_id, reason, detail) values (me.id, p_user, p_room, btrim(p_reason), left(btrim(coalesce(p_detail, '')), 600));
  return jsonb_build_object('ok', true);
end $$;

-- ================================================================ carteira
create or replace function public.my_wallet() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return jsonb_build_object(
    'balance_cents', (select balance_cents from public.wallets where user_id = me.id),
    'held_cents', (select held_cents from public.wallets where user_id = me.id),
    'ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.id desc) from (select id, kind, amount_cents, balance_after, note, created_at from public.ledger where user_id = me.id order by id desc limit 80) l), '[]'),
    'deposits', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'amount_cents', d.amount_cents, 'status', d.status, 'provider', d.provider, 'created_at', d.created_at, 'note', d.note) order by d.created_at desc)
        from (select * from public.deposits where user_id = me.id order by created_at desc limit 10) d), '[]'),
    'withdrawals', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'amount_cents', w.amount_cents, 'status', w.status, 'pix_key', w.pix_key, 'created_at', w.created_at, 'note', w.note) order by w.created_at desc)
        from (select * from public.withdrawals where user_id = me.id order by created_at desc limit 10) w), '[]'));
end $$;

-- depósito manual: o jogador paga o Pix da plataforma e a administração confirma
create or replace function public.request_manual_deposit(p_cents bigint) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings; d public.deposits;
begin
  me := app.require_user(); s := app.settings();
  if coalesce(p_cents, 0) < s.min_deposit_cents then perform app.fail('O depósito mínimo é ' || app.brl(s.min_deposit_cents) || '.'); end if;
  if p_cents > s.max_deposit_cents then perform app.fail('O depósito máximo é ' || app.brl(s.max_deposit_cents) || '.'); end if;
  if s.pix_key = '' then perform app.fail('Os depósitos ainda não foram configurados pela administração.'); end if;
  if (select count(*) from public.deposits where user_id = me.id and status = 'pendente') >= 3 then perform app.fail('Você já tem 3 depósitos em análise. Aguarde a confirmação.'); end if;
  insert into public.deposits (user_id, amount_cents, provider, expires_at) values (me.id, p_cents, 'manual', now() + interval '24 hours') returning * into d;
  return jsonb_build_object('id', d.id, 'amount_cents', d.amount_cents, 'status', d.status, 'provider', 'manual', 'pix_key', s.pix_key, 'pix_name', s.pix_name, 'pix_city', s.pix_city, 'reference', 'BH' || me.code || upper(left(replace(d.id::text, '-', ''), 8)));
end $$;

create or replace function public.deposit_status(p_id uuid) returns jsonb
language sql security definer set search_path = public, app as $$
  select jsonb_build_object('id', id, 'status', status, 'amount_cents', amount_cents, 'note', note) from public.deposits where id = p_id and user_id = auth.uid()
$$;

-- usadas pelas funções de servidor do Pix (chave de serviço)
create or replace function app.require_service() returns void language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then perform app.fail('Acesso negado.'); end if;
end $$;

create or replace function public.svc_create_deposit(p_user uuid, p_cents bigint, p_provider_id text, p_qr text, p_qr64 text, p_expires timestamptz) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare s public.settings; d public.deposits;
begin
  perform app.require_service(); s := app.settings();
  if p_cents < s.min_deposit_cents or p_cents > s.max_deposit_cents then perform app.fail('Valor fora dos limites de depósito.'); end if;
  insert into public.deposits (user_id, amount_cents, provider, provider_id, qr_code, qr_base64, expires_at)
  values (p_user, p_cents, 'mercadopago', p_provider_id, p_qr, p_qr64, p_expires) returning * into d;
  return jsonb_build_object('id', d.id, 'amount_cents', d.amount_cents, 'status', d.status, 'qr_code', d.qr_code, 'qr_base64', d.qr_base64, 'expires_at', d.expires_at, 'provider', 'mercadopago');
end $$;

create or replace function app.approve_deposit(d public.deposits, p_note text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  update public.deposits set status = 'aprovado', reviewed_at = now(), reviewed_by = auth.uid(), note = p_note where id = d.id and status = 'pendente';
  if not found then return; end if;
  perform app.credit(d.user_id, d.amount_cents, 'deposito', 'Depósito via Pix', 'deposit', d.id::text);
  perform app.notify(d.user_id, 'deposito', 'Depósito confirmado', app.brl(d.amount_cents) || ' já estão na sua carteira.', jsonb_build_object('deposit_id', d.id));
end $$;

create or replace function public.svc_settle_deposit(p_provider_id text, p_status text, p_amount_cents bigint) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.deposits;
begin
  perform app.require_service();
  select * into d from public.deposits where provider_id = p_provider_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'desconhecido'); end if;
  if d.status <> 'pendente' then return jsonb_build_object('ok', true, 'status', d.status); end if;
  if p_status = 'approved' then
    if p_amount_cents is not null and p_amount_cents < d.amount_cents then
      update public.deposits set note = 'Valor pago menor que o esperado: ' || app.brl(p_amount_cents) where id = d.id;
      return jsonb_build_object('ok', false, 'reason', 'valor');
    end if;
    perform app.approve_deposit(d, 'Confirmado pelo Mercado Pago');
  elsif p_status in ('rejected', 'cancelled', 'refunded', 'charged_back') then
    update public.deposits set status = 'recusado', note = 'Pagamento ' || p_status, reviewed_at = now() where id = d.id;
  elsif p_status = 'expired' then
    update public.deposits set status = 'expirado', reviewed_at = now() where id = d.id;
  end if;
  return jsonb_build_object('ok', true, 'status', (select status from public.deposits where id = d.id));
end $$;

create or replace function public.request_withdrawal(p_cents bigint, p_key_type text, p_key text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings; w public.withdrawals;
begin
  me := app.require_user(); s := app.settings();
  if s.require_verified_withdraw and me.ff_status <> 'aprovado' then perform app.fail('Para sacar, seu ID do Free Fire precisa estar verificado.'); end if;
  if coalesce(p_cents, 0) < s.min_withdraw_cents then perform app.fail('O saque mínimo é ' || app.brl(s.min_withdraw_cents) || '.'); end if;
  if p_cents > s.max_withdraw_cents then perform app.fail('O saque máximo por pedido é ' || app.brl(s.max_withdraw_cents) || '.'); end if;
  if p_key_type not in ('CPF', 'E-mail', 'Telefone', 'Aleatória') then perform app.fail('Escolha o tipo da chave Pix.'); end if;
  if length(btrim(coalesce(p_key, ''))) < 5 then perform app.fail('Digite sua chave Pix.'); end if;
  if exists (select 1 from public.withdrawals where user_id = me.id and status = 'pendente') then perform app.fail('Você já tem um saque em análise.'); end if;
  perform app.credit(me.id, -p_cents, 'saque', 'Saque via Pix (em análise)');
  update public.wallets set held_cents = held_cents + p_cents where user_id = me.id;
  insert into public.withdrawals (user_id, amount_cents, pix_key_type, pix_key) values (me.id, p_cents, p_key_type, btrim(p_key)) returning * into w;
  perform app.notify(me.id, 'saque', 'Saque solicitado', app.brl(p_cents) || ' em análise. O prazo é de até 24 horas.');
  return jsonb_build_object('id', w.id, 'status', w.status);
end $$;

-- ================================================================ rankings
create or replace function public.rankings(p_metric text default 'abates', p_period text default 'mes', p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_from timestamptz; v_rows jsonb; v_me jsonb;
begin
  perform app.require_user();
  v_from := case p_period
    when 'semana' then (date_trunc('week', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
    when 'mes' then (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
    else '-infinity'::timestamptz end;
  create temp table if not exists _rank (user_id uuid primary key, value numeric, kills int, rooms int, wins int, earned bigint) on commit drop;
  delete from _rank;
  insert into _rank
    select rp.user_id,
           case p_metric
             when 'abates' then sum(rp.kills)
             when 'salas' then count(*)
             when 'sobrevivencia' then sum(rp.survival_min)
             when 'ganhos' then sum(rp.earned_cents)
             when 'vitorias' then count(*) filter (where rp.placement = 1)
             when 'xp' then sum(rp.xp_earned)
             else sum(rp.kills) end,
           sum(rp.kills), count(*), count(*) filter (where rp.placement = 1), sum(rp.earned_cents)
      from public.room_players rp join public.rooms r on r.id = rp.room_id
     where r.status = 'finalizada' and rp.status = 'inscrito' and r.finished_at >= v_from
     group by rp.user_id;
  delete from _rank where value <= 0 or user_id in (select id from public.profiles where banned_until > now());
  select coalesce(jsonb_agg(x order by (x ->> 'pos')::int), '[]') into v_rows from (
    select jsonb_build_object('pos', row_number() over (order by value desc, earned desc), 'user', app.user_card(user_id, true), 'value', value,
                              'kills', kills, 'rooms', rooms, 'wins', wins, 'earned_cents', earned, 'me', user_id = auth.uid()) x
      from _rank order by value desc, earned desc limit greatest(least(p_limit, 100), 3)) q;
  select jsonb_build_object('pos', pos, 'value', value) into v_me from (
    select user_id, value, row_number() over (order by value desc, earned desc) pos from _rank) q where q.user_id = auth.uid();
  return jsonb_build_object('metric', p_metric, 'period', p_period, 'rows', v_rows, 'me', v_me,
    'total_paid_cents', coalesce((select sum(earned) from _rank), 0));
end $$;

-- ================================================================ guildas
create or replace function app.guild_member_role(p_guild uuid, p_user uuid) returns text language sql stable security definer set search_path = public, app as $$
  select role from public.guild_members where guild_id = p_guild and user_id = p_user
$$;

create or replace function public.list_guilds(p_q text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform app.require_user();
  return coalesce((select jsonb_agg(x order by (x ->> 'month_kills')::int desc, x ->> 'name') from (
    select jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'color', g.color, 'description', g.description, 'recruiting', g.recruiting,
      'min_level', g.min_level, 'cut_pct', g.cut_pct, 'members', (select count(*) from public.guild_members where guild_id = g.id),
      'leader', app.user_card(g.leader_id),
      'month_kills', coalesce((select sum(rp.kills) from public.room_players rp join public.rooms r on r.id = rp.room_id join public.guild_members gm on gm.user_id = rp.user_id and gm.guild_id = g.id
                                 where r.status = 'finalizada' and r.finished_at >= date_trunc('month', now())), 0)) x
      from public.guilds g where v is null or g.name ilike '%' || v || '%' or g.tag ilike v) q), '[]');
end $$;

create or replace function public.get_guild(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; g public.guilds; v_role text; v_from timestamptz := (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
begin
  me := app.require_user();
  select * into g from public.guilds where id = p_id;
  if not found then perform app.fail('Guilda não encontrada.'); end if;
  v_role := app.guild_member_role(g.id, me.id);
  return jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'color', g.color, 'description', g.description, 'recruiting', g.recruiting,
    'min_level', g.min_level, 'cut_pct', g.cut_pct, 'my_role', v_role, 'created_at', g.created_at, 'last_payout_at', g.last_payout_at,
    'vault_cents', case when v_role is not null or app.role_level(me.role) >= 1 then g.vault_cents end,
    'members', coalesce((select jsonb_agg(app.user_card(gm.user_id) || jsonb_build_object('guild_role', gm.role, 'joined_at', gm.joined_at,
        'month', (select jsonb_build_object('kills', coalesce(sum(rp.kills), 0), 'rooms', count(rp.*), 'wins', count(*) filter (where rp.placement = 1), 'earned_cents', coalesce(sum(rp.earned_cents), 0))
                    from public.room_players rp join public.rooms r on r.id = rp.room_id where rp.user_id = gm.user_id and r.status = 'finalizada' and r.finished_at >= v_from and rp.status = 'inscrito'),
        'contributed_cents', (select coalesce(sum(amount_cents), 0) from public.guild_vault_log where guild_id = g.id and user_id = gm.user_id and kind = 'contribuicao' and created_at >= v_from))
        order by case gm.role when 'lider' then 0 when 'vice' then 1 else 2 end, gm.joined_at)
      from public.guild_members gm where gm.guild_id = g.id), '[]'),
    'log', case when v_role is not null then coalesce((select jsonb_agg(jsonb_build_object('kind', l.kind, 'amount_cents', l.amount_cents, 'user', app.user_card(l.user_id), 'note', l.note, 'created_at', l.created_at) order by l.id desc)
        from (select * from public.guild_vault_log where guild_id = g.id order by id desc limit 30) l), '[]') end);
end $$;

create or replace function public.create_guild(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings; g public.guilds; v_name text := btrim(coalesce(p ->> 'name', '')); v_tag text := upper(btrim(coalesce(p ->> 'tag', '')));
        v_cut numeric := coalesce((p ->> 'cut_pct')::numeric, 10);
begin
  me := app.require_user(); s := app.settings();
  if exists (select 1 from public.guild_members where user_id = me.id) then perform app.fail('Saia da sua guilda atual antes de criar outra.'); end if;
  if length(v_name) < 3 or length(v_name) > 24 then perform app.fail('O nome da guilda precisa ter de 3 a 24 caracteres.'); end if;
  if v_tag !~ '^[A-Z0-9]{2,4}$' then perform app.fail('A tag tem de 2 a 4 letras ou números.'); end if;
  if v_cut < 0 or v_cut > s.max_guild_cut_pct then perform app.fail('A parte para o cofre vai de 0% a ' || s.max_guild_cut_pct || '%.'); end if;
  if exists (select 1 from public.guilds where lower(name) = lower(v_name)) then perform app.fail('Já existe uma guilda com esse nome.'); end if;
  if exists (select 1 from public.guilds where upper(tag) = v_tag) then perform app.fail('Essa tag já é usada por outra guilda.'); end if;
  insert into public.guilds (name, tag, description, leader_id, cut_pct, color, min_level)
  values (v_name, v_tag, left(btrim(coalesce(p ->> 'description', '')), 300), me.id, v_cut, coalesce(nullif(p ->> 'color', ''), '#7c3aed'), greatest(coalesce((p ->> 'min_level')::int, 1), 1))
  returning * into g;
  insert into public.guild_members (user_id, guild_id, role) values (me.id, g.id, 'lider');
  update public.profiles set guild_id = g.id where id = me.id;
  perform app.log('Criou guilda', g.name || ' [' || g.tag || ']');
  return public.get_guild(g.id);
end $$;

create or replace function public.join_guild(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; g public.guilds;
begin
  me := app.require_user();
  select * into g from public.guilds where id = p_id for update;
  if not found then perform app.fail('Guilda não encontrada.'); end if;
  if exists (select 1 from public.guild_members where user_id = me.id) then perform app.fail('Você já está em uma guilda.'); end if;
  if not g.recruiting then perform app.fail('Essa guilda não está recrutando.'); end if;
  if (select count(*) from public.guild_members where guild_id = g.id) >= 50 then perform app.fail('A guilda está cheia (50 membros).'); end if;
  if app.level_of(me.xp) < g.min_level then perform app.fail('Essa guilda pede nível ' || g.min_level || ' ou mais.'); end if;
  insert into public.guild_members (user_id, guild_id) values (me.id, g.id);
  update public.profiles set guild_id = g.id where id = me.id;
  perform app.notify(g.leader_id, 'guilda', 'Novo membro na ' || g.name, me.nick || ' entrou na guilda.', jsonb_build_object('guild_id', g.id));
  return public.get_guild(g.id);
end $$;

create or replace function public.leave_guild() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; gm public.guild_members; v_left int;
begin
  me := app.require_user();
  select * into gm from public.guild_members where user_id = me.id;
  if not found then perform app.fail('Você não está em uma guilda.'); end if;
  select count(*) into v_left from public.guild_members where guild_id = gm.guild_id;
  if gm.role = 'lider' and v_left > 1 then perform app.fail('Você é o líder. Passe a liderança antes de sair.'); end if;
  if gm.role = 'lider' and (select vault_cents from public.guilds where id = gm.guild_id) > 0 then perform app.fail('Distribua o cofre antes de encerrar a guilda.'); end if;
  delete from public.guild_members where user_id = me.id;
  update public.profiles set guild_id = null where id = me.id;
  if v_left = 1 then delete from public.guilds where id = gm.guild_id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.guild_manage(p_action text, p_user uuid default null, p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings; gm public.guild_members; target public.guild_members; g public.guilds; v_cut numeric;
begin
  me := app.require_user(); s := app.settings();
  select * into gm from public.guild_members where user_id = me.id;
  if not found then perform app.fail('Você não está em uma guilda.'); end if;
  select * into g from public.guilds where id = gm.guild_id for update;
  if p_user is not null then
    select * into target from public.guild_members where user_id = p_user and guild_id = g.id;
    if not found then perform app.fail('Esse jogador não é da sua guilda.'); end if;
  end if;
  if p_action = 'settings' then
    if gm.role not in ('lider', 'vice') then perform app.fail('Só líder e vice mudam as configurações.'); end if;
    v_cut := coalesce((p ->> 'cut_pct')::numeric, g.cut_pct);
    if v_cut < 0 or v_cut > s.max_guild_cut_pct then perform app.fail('A parte para o cofre vai de 0% a ' || s.max_guild_cut_pct || '%.'); end if;
    update public.guilds set cut_pct = v_cut, recruiting = coalesce((p ->> 'recruiting')::boolean, recruiting),
           description = left(btrim(coalesce(p ->> 'description', description)), 300), min_level = greatest(coalesce((p ->> 'min_level')::int, min_level), 1),
           color = coalesce(nullif(p ->> 'color', ''), color)
     where id = g.id;
  elsif p_action in ('vice', 'membro') then
    if gm.role <> 'lider' then perform app.fail('Só o líder define o vice-líder.'); end if;
    if target.role = 'lider' then perform app.fail('O líder não pode mudar o próprio cargo.'); end if;
    if p_action = 'vice' then update public.guild_members set role = 'membro' where guild_id = g.id and role = 'vice'; end if;
    update public.guild_members set role = p_action where user_id = p_user;
    perform app.notify(p_user, 'guilda', case when p_action = 'vice' then 'Você agora é vice-líder da ' else 'Você agora é membro da ' end || g.name, '', jsonb_build_object('guild_id', g.id));
  elsif p_action = 'kick' then
    if gm.role not in ('lider', 'vice') or target.role = 'lider' or (gm.role = 'vice' and target.role = 'vice') then perform app.fail('Você não pode remover esse membro.'); end if;
    delete from public.guild_members where user_id = p_user;
    update public.profiles set guild_id = null where id = p_user;
    perform app.notify(p_user, 'guilda', 'Você saiu da ' || g.name, 'Removido por ' || me.nick || '.', jsonb_build_object('guild_id', g.id));
  elsif p_action = 'transfer' then
    if gm.role <> 'lider' then perform app.fail('Só o líder passa a liderança.'); end if;
    update public.guild_members set role = 'vice' where user_id = me.id;
    update public.guild_members set role = 'lider' where user_id = p_user;
    update public.guilds set leader_id = p_user where id = g.id;
    perform app.notify(p_user, 'guilda', 'Você agora lidera a ' || g.name, me.nick || ' passou a liderança para você.', jsonb_build_object('guild_id', g.id));
  else
    perform app.fail('Ação inválida.');
  end if;
  return public.get_guild(g.id);
end $$;

-- sugestão de salário: por desempenho no mês (abates, vitórias, salas) ou igual para todos
create or replace function public.guild_payout_plan(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; g public.guilds; v_from timestamptz := (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
        v_total numeric; v_n int;
begin
  me := app.require_user();
  select * into g from public.guilds where id = p_id;
  if not found then perform app.fail('Guilda não encontrada.'); end if;
  if app.guild_member_role(g.id, me.id) <> 'lider' then perform app.fail('Só o líder vê o plano de salários.'); end if;
  create temp table if not exists _plan (user_id uuid, kills int, rooms int, wins int, contributed bigint, score numeric) on commit drop;
  delete from _plan;
  insert into _plan
    select gm.user_id, coalesce(sum(rp.kills), 0), count(rp.*), count(*) filter (where rp.placement = 1),
           (select coalesce(sum(amount_cents), 0) from public.guild_vault_log l where l.guild_id = g.id and l.user_id = gm.user_id and l.kind = 'contribuicao' and l.created_at >= v_from), 0
      from public.guild_members gm
      left join public.room_players rp on rp.user_id = gm.user_id and rp.status = 'inscrito'
       and exists (select 1 from public.rooms r where r.id = rp.room_id and r.status = 'finalizada' and r.finished_at >= v_from)
     where gm.guild_id = g.id group by gm.user_id;
  update _plan set score = kills * 3 + wins * 10 + rooms * 2 + contributed / 100.0;
  select sum(score), count(*) into v_total, v_n from _plan;
  return jsonb_build_object('vault_cents', g.vault_cents, 'members', v_n,
    'rows', (select jsonb_agg(jsonb_build_object('user', app.user_card(user_id), 'kills', kills, 'rooms', rooms, 'wins', wins, 'contributed_cents', contributed,
              'score', round(score, 1),
              'by_performance_cents', case when v_total > 0 then floor(g.vault_cents * score / v_total) else floor(g.vault_cents / v_n) end,
              'equal_cents', floor(g.vault_cents / v_n)) order by score desc) from _plan));
end $$;

create or replace function public.guild_distribute(p_id uuid, p_alloc jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; g public.guilds; e jsonb; v_sum bigint := 0; v_c bigint; v_u uuid; v_paid int := 0;
begin
  me := app.require_user();
  select * into g from public.guilds where id = p_id for update;
  if not found then perform app.fail('Guilda não encontrada.'); end if;
  if app.guild_member_role(g.id, me.id) <> 'lider' then perform app.fail('Só o líder distribui o cofre.'); end if;
  for e in select * from jsonb_array_elements(coalesce(p_alloc, '[]')) loop
    v_c := coalesce((e ->> 'cents')::bigint, 0);
    if v_c < 0 then perform app.fail('Valores não podem ser negativos.'); end if;
    if v_c > 0 and not exists (select 1 from public.guild_members where guild_id = g.id and user_id = (e ->> 'user_id')::uuid) then perform app.fail('Só membros da guilda recebem do cofre.'); end if;
    v_sum := v_sum + v_c;
  end loop;
  if v_sum = 0 then perform app.fail('Defina quanto cada membro recebe.'); end if;
  if v_sum > g.vault_cents then perform app.fail('A soma (' || app.brl(v_sum) || ') passa do cofre (' || app.brl(g.vault_cents) || ').'); end if;
  for e in select * from jsonb_array_elements(p_alloc) loop
    v_c := coalesce((e ->> 'cents')::bigint, 0); v_u := (e ->> 'user_id')::uuid;
    if v_c = 0 then continue; end if;
    perform app.credit(v_u, v_c, 'salario_guilda', 'Salário do cofre · ' || g.name, 'guild', g.id::text);
    insert into public.guild_vault_log (guild_id, user_id, kind, amount_cents, note) values (g.id, v_u, 'salario', -v_c, 'Pago por ' || me.nick);
    perform app.notify(v_u, 'guilda', 'Salário da ' || g.name, app.brl(v_c) || ' caíram na sua carteira.', jsonb_build_object('guild_id', g.id));
    v_paid := v_paid + 1;
  end loop;
  update public.guilds set vault_cents = vault_cents - v_sum, last_payout_at = now() where id = g.id;
  perform app.log('Distribuiu cofre da guilda', g.name || ' [' || g.tag || ']', app.brl(v_sum) || ' para ' || v_paid || ' membros');
  return public.get_guild(g.id);
end $$;

-- ================================================================ loja e progresso
create or replace function public.shop() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles;
begin
  me := app.require_user();
  return jsonb_build_object('level', app.level_of(me.xp), 'xp', me.xp, 'xp_level', app.xp_for(app.level_of(me.xp)), 'xp_next', app.xp_for(app.level_of(me.xp) + 1),
    'items', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'owned', i.user_id is not null and (i.expires_at is null or i.expires_at > now()), 'expires_at', i.expires_at,
        'equipped', s.id in (me.equipped_banner, me.equipped_frame, me.equipped_title, me.equipped_color),
        'reward_level', (select level from public.rewards where item_id = s.id)) order by s.kind, s.sort)
      from public.shop_items s left join public.inventory i on i.item_id = s.id and i.user_id = me.id where s.active), '[]'),
    'track', coalesce((select jsonb_agg(jsonb_build_object('level', r.level, 'item', to_jsonb(s), 'unlocked', app.level_of(me.xp) >= r.level, 'xp', app.xp_for(r.level)) order by r.level)
      from public.rewards r join public.shop_items s on s.id = r.item_id), '[]'));
end $$;

create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.shop_items; i public.inventory;
begin
  me := app.require_user();
  select * into s from public.shop_items where id = p_item and active;
  if not found then perform app.fail('Item não encontrado.'); end if;
  if s.price_cents is null then perform app.fail('Esse item só sai como recompensa de nível.'); end if;
  select * into i from public.inventory where user_id = me.id and item_id = s.id;
  if found and s.kind <> 'prioridade' then perform app.fail('Você já tem esse item.'); end if;
  perform app.credit(me.id, -s.price_cents, 'compra', 'Loja · ' || s.name, 'item', s.id);
  perform app.platform('loja', s.price_cents, s.name, 'item', s.id);
  if s.kind = 'prioridade' then
    insert into public.inventory (user_id, item_id, source, expires_at) values (me.id, s.id, 'compra', now() + make_interval(days => s.duration_days))
    on conflict (user_id, item_id) do update set expires_at = greatest(coalesce(inventory.expires_at, now()), now()) + make_interval(days => s.duration_days);
  else
    insert into public.inventory (user_id, item_id, source) values (me.id, s.id, 'compra');
    perform public.equip_item(s.id);
  end if;
  return public.shop();
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
    equipped_color = case when s.kind = 'cor' then s.id else equipped_color end
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
    equipped_color = case when p_kind = 'cor' then null else equipped_color end
   where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;
