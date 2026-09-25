-- BattleHub: API do painel administrativo.
-- Níveis: moderador (1), admin (2), dono (3).

create or replace function app.admin_user_row(p public.profiles) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select app.user_card(p.id) || jsonb_build_object(
    'email', (select email from auth.users where id = p.id),
    'balance_cents', (select balance_cents from public.wallets where user_id = p.id),
    'held_cents', (select held_cents from public.wallets where user_id = p.id),
    'can_create_rooms', p.can_create_rooms, 'ff_nick', p.ff_nick, 'ff_id', p.ff_id, 'ff_status', p.ff_status,
    'banned_until', p.banned_until, 'ban_reason', p.ban_reason, 'xp', p.xp, 'kills', p.kills, 'matches', p.matches, 'wins', p.wins,
    'earnings_cents', p.earnings_cents, 'created_at', p.created_at, 'last_seen_at', p.last_seen_at, 'onboarded', p.onboarded)
$$;

create or replace function public.admin_dashboard() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v_series jsonb; v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  me := app.require_level(1);
  select jsonb_agg(jsonb_build_object('day', d, 'deposits', dep, 'withdrawals', wd, 'revenue', rev) order by d) into v_series from (
    select g::date d,
      coalesce((select sum(amount_cents) from public.deposits where status = 'aprovado' and (reviewed_at at time zone 'America/Sao_Paulo')::date = g::date), 0) dep,
      coalesce((select sum(amount_cents) from public.withdrawals where status = 'pago' and (reviewed_at at time zone 'America/Sao_Paulo')::date = g::date), 0) wd,
      coalesce((select sum(amount_cents) from public.platform_ledger where (created_at at time zone 'America/Sao_Paulo')::date = g::date), 0) rev
    from generate_series(v_today - 13, v_today, interval '1 day') g) q;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles), 'users_week', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'creators', (select count(*) from public.profiles where can_create_rooms),
    'banned', (select count(*) from public.profiles where banned_until > now()),
    'rooms_open', (select count(*) from public.rooms where status = 'aberta'), 'rooms_live', (select count(*) from public.rooms where status = 'em_andamento'),
    'rooms_week', (select count(*) from public.rooms where status = 'finalizada' and finished_at > now() - interval '7 days'),
    'deposits_total', coalesce((select sum(amount_cents) from public.deposits where status = 'aprovado'), 0),
    'withdrawals_total', coalesce((select sum(amount_cents) from public.withdrawals where status = 'pago'), 0),
    'revenue_total', coalesce((select sum(amount_cents) from public.platform_ledger), 0),
    'revenue_month', coalesce((select sum(amount_cents) from public.platform_ledger where created_at >= date_trunc('month', now())), 0),
    'wallets_total', coalesce((select sum(balance_cents + held_cents) from public.wallets), 0),
    'vaults_total', coalesce((select sum(vault_cents) from public.rooms where status in ('aberta', 'em_andamento')), 0) + coalesce((select sum(vault_cents) from public.guilds), 0),
    'prizes_week', coalesce((select sum(amount_cents) from public.ledger where kind in ('premio', 'first_blood', 'rei', 'por_kill', 'mvp', 'sorteio') and created_at > now() - interval '7 days'), 0),
    'pending', jsonb_build_object(
      'ff', (select count(*) from public.ff_submissions where status = 'pendente'),
      'reports', (select count(*) from public.reports where status = 'aberta'),
      'deposits', (select count(*) from public.deposits where status = 'pendente' and provider = 'manual'),
      'withdrawals', (select count(*) from public.withdrawals where status = 'pendente')),
    'series', v_series,
    'top_creators', coalesce((select jsonb_agg(x) from (select jsonb_build_object('user', app.user_card(r.creator_id), 'rooms', count(*), 'players', sum((select count(*) from public.room_players rp where rp.room_id = r.id and rp.status = 'inscrito'))) x
        from public.rooms r where r.status = 'finalizada' and r.finished_at > now() - interval '30 days' group by r.creator_id order by count(*) desc limit 5) q), '[]'),
    'logs', coalesce((select jsonb_agg(jsonb_build_object('actor', app.user_card(l.actor_id), 'action', l.action, 'target', l.target, 'detail', l.detail, 'created_at', l.created_at) order by l.id desc)
        from (select * from public.audit_log order by id desc limit 8) l), '[]'));
end $$;

create or replace function public.admin_users(p_q text default null, p_filter text default 'todos') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(app.admin_user_row(p) order by app.role_level(p.role) desc, p.created_at desc) from (
    select p.* from public.profiles p left join auth.users u on u.id = p.id
     where (v is null or p.nick ilike '%' || v || '%' or u.email ilike '%' || v || '%' or p.code::text = v or p.ff_id = v or p.id::text = v)
       and case p_filter
             when 'verificar' then p.ff_status = 'pendente'
             when 'verificados' then p.ff_status = 'aprovado'
             when 'staff' then app.role_level(p.role) >= 1
             when 'criadores' then p.can_create_rooms
             when 'banidos' then p.banned_until > now()
             else true end
     order by p.created_at desc limit 200) p), '[]');
end $$;

create or replace function public.admin_user(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p public.profiles;
begin
  perform app.require_level(1);
  select * into p from public.profiles where id = p_id;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  return app.admin_user_row(p) || jsonb_build_object(
    'ff_photo_path', p.ff_photo_path, 'ff_note', p.ff_note, 'bio', p.bio,
    'guild', (select jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'role', gm.role) from public.guild_members gm join public.guilds g on g.id = gm.guild_id where gm.user_id = p.id),
    'ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.id desc) from (select id, kind, amount_cents, balance_after, note, created_at from public.ledger where user_id = p.id order by id desc limit 40) l), '[]'),
    'bans', coalesce((select jsonb_agg(jsonb_build_object('until', b.until, 'reason', b.reason, 'by', app.user_card(b.by_id), 'created_at', b.created_at, 'lifted_at', b.lifted_at) order by b.id desc) from public.bans b where b.user_id = p.id), '[]'),
    'rooms', coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title, 'status', r.status, 'role', case when r.creator_id = p.id then 'organizador' else 'jogador' end, 'at', r.created_at) x
        from public.rooms r where r.creator_id = p.id or exists (select 1 from public.room_players rp where rp.room_id = r.id and rp.user_id = p.id) order by r.created_at desc limit 15) q), '[]'),
    'reports_against', (select count(*) from public.reports where target_id = p.id),
    'ff_history', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from (select id, ff_nick, ff_id, status, note, created_at, previous from public.ff_submissions where user_id = p.id order by created_at desc limit 10) s), '[]'));
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles;
begin
  me := app.require_level(2);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if p_role not in ('jogador', 'moderador', 'admin') then perform app.fail('Cargo inválido.'); end if;
  if t.id = me.id then perform app.fail('Você não pode mudar o próprio cargo.'); end if;
  if t.role = 'dono' then perform app.fail('O cargo do dono não pode ser alterado.'); end if;
  if p_role = 'admin' and me.role <> 'dono' then perform app.fail('Só o dono nomeia admins.'); end if;
  if app.role_level(t.role) >= app.role_level(me.role) then perform app.fail('Você não pode alterar alguém do mesmo cargo ou acima.'); end if;
  update public.profiles set role = p_role where id = t.id;
  perform app.notify(t.id, 'admin', 'Seu cargo mudou', 'Agora você é ' || initcap(p_role) || '.');
  perform app.log('Alterou cargo', t.nick, t.role || ' → ' || p_role);
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

create or replace function public.admin_set_creator(p_user uuid, p_value boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles;
begin
  me := app.require_level(2);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  update public.profiles set can_create_rooms = p_value where id = t.id;
  perform app.notify(t.id, 'admin', case when p_value then 'Você pode criar salas' else 'Permissão de criar salas removida' end,
    case when p_value then 'Toque no + da tela inicial para montar sua primeira sala.' else 'Fale com a administração se tiver dúvidas.' end);
  perform app.log(case when p_value then 'Deu permissão de criar salas' else 'Tirou permissão de criar salas' end, t.nick);
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

create or replace function public.admin_ban(p_user uuid, p_hours numeric, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles; v_until timestamptz; r public.rooms;
begin
  me := app.require_level(1);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if t.id = me.id then perform app.fail('Você não pode banir a própria conta.'); end if;
  if app.role_level(t.role) >= app.role_level(me.role) then perform app.fail('Você não pode banir alguém do mesmo cargo ou acima.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo do banimento.'); end if;
  if coalesce(p_hours, 0) <= 0 then
    if app.role_level(me.role) < 2 then perform app.fail('Só admins aplicam banimento permanente.'); end if;
    v_until := 'infinity';
  else
    if app.role_level(me.role) < 2 and p_hours > 168 then perform app.fail('Moderadores banem por no máximo 7 dias.'); end if;
    v_until := now() + make_interval(secs => p_hours * 3600);
  end if;
  -- sai das salas abertas com reembolso e das filas
  for r in select ro.* from public.rooms ro join public.room_players rp on rp.room_id = ro.id where rp.user_id = t.id and rp.status = 'inscrito' and ro.status = 'aberta' loop
    perform app.unenroll(r, t.id, 'removido', 'Removido por suspensão');
    perform app.promote_waitlist(r.id);
  end loop;
  delete from public.room_waitlist where user_id = t.id;
  update public.profiles set banned_until = v_until, ban_reason = btrim(p_reason) where id = t.id;
  insert into public.bans (user_id, until, reason, by_id) values (t.id, case when v_until = 'infinity' then null else v_until end, btrim(p_reason), me.id);
  perform app.notify(t.id, 'ban', 'Conta suspensa', case when v_until = 'infinity' then 'Suspensão permanente. ' else 'Até ' || to_char(v_until at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '. ' end || 'Motivo: ' || btrim(p_reason) || '.');
  perform app.log('Baniu conta', t.nick, case when v_until = 'infinity' then 'Permanente' else p_hours || ' h' end || ' · ' || btrim(p_reason));
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

create or replace function public.admin_unban(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles;
begin
  me := app.require_level(1);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  update public.profiles set banned_until = null, ban_reason = null where id = t.id;
  update public.bans set lifted_at = now() where user_id = t.id and lifted_at is null;
  perform app.notify(t.id, 'ban', 'Suspensão encerrada', 'Sua conta voltou ao normal. Bons jogos.');
  perform app.log('Desbaniu conta', t.nick);
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

create or replace function public.admin_adjust(p_user uuid, p_cents bigint, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles;
begin
  me := app.require_level(2);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if coalesce(p_cents, 0) = 0 then perform app.fail('Digite um valor diferente de zero.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo do ajuste.'); end if;
  perform app.credit(t.id, p_cents, 'ajuste', btrim(p_reason), 'admin', me.id::text);
  perform app.notify(t.id, 'admin', case when p_cents > 0 then 'Crédito na carteira' else 'Débito na carteira' end, case when p_cents > 0 then '+' else '−' end || app.brl(abs(p_cents)) || ': ' || btrim(p_reason) || '.');
  perform app.log('Ajustou saldo', t.nick, case when p_cents > 0 then '+' else '−' end || app.brl(abs(p_cents)) || ' · ' || btrim(p_reason));
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

create or replace function public.admin_ff_queue(p_status text default 'pendente') returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'user', app.user_card(s.user_id), 'email', (select email from auth.users where id = s.user_id),
      'ff_nick', s.ff_nick, 'ff_id', s.ff_id, 'photo_path', s.photo_path, 'previous', s.previous, 'status', s.status, 'note', s.note,
      'created_at', s.created_at, 'reviewed_by', app.user_card(s.reviewed_by),
      'duplicates', (select count(*) from public.profiles p where p.ff_id = s.ff_id and p.id <> s.user_id))
      order by case when p_status = 'pendente' then extract(epoch from s.created_at) else -extract(epoch from s.created_at) end)
    from (select * from public.ff_submissions where status = p_status order by created_at desc limit 100) s), '[]');
end $$;

create or replace function public.admin_ff_review(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.ff_submissions;
begin
  me := app.require_level(1);
  select * into s from public.ff_submissions where id = p_id for update;
  if not found or s.status <> 'pendente' then perform app.fail('Esse envio já foi analisado.'); end if;
  if not p_approve and btrim(coalesce(p_note, '')) = '' then perform app.fail('Escreva o motivo da recusa.'); end if;
  update public.ff_submissions set status = case when p_approve then 'aprovado' else 'recusado' end, note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now(), reviewed_by = me.id where id = s.id;
  update public.profiles set ff_status = case when p_approve then 'aprovado' else 'recusado' end, ff_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = s.user_id and ff_id = s.ff_id;
  perform app.notify(s.user_id, 'conta', case when p_approve then 'ID do Free Fire verificado' else 'Verificação recusada' end,
    case when p_approve then 'Saques e salas pagas liberados.' else btrim(p_note) || '. Envie outro print no seu perfil.' end);
  perform app.log(case when p_approve then 'Aprovou ID do Free Fire' else 'Recusou ID do Free Fire' end, (select nick from public.profiles where id = s.user_id), s.ff_nick || ' · ' || s.ff_id || coalesce(' · ' || nullif(btrim(coalesce(p_note, '')), ''), ''));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_finance() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return jsonb_build_object(
    'deposits_total', coalesce((select sum(amount_cents) from public.deposits where status = 'aprovado'), 0),
    'withdrawals_total', coalesce((select sum(amount_cents) from public.withdrawals where status = 'pago'), 0),
    'revenue_total', coalesce((select sum(amount_cents) from public.platform_ledger), 0),
    'wallets_total', coalesce((select sum(balance_cents + held_cents) from public.wallets), 0),
    'pending_deposits', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'user', app.user_card(d.user_id), 'amount_cents', d.amount_cents, 'provider', d.provider,
        'reference', 'BH' || (select code from public.profiles where id = d.user_id) || upper(left(replace(d.id::text, '-', ''), 8)), 'created_at', d.created_at, 'expires_at', d.expires_at) order by d.created_at)
      from public.deposits d where d.status = 'pendente'), '[]'),
    'pending_withdrawals', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'user', app.user_card(w.user_id), 'amount_cents', w.amount_cents, 'pix_key_type', w.pix_key_type, 'pix_key', w.pix_key,
        'verified', (select ff_status = 'aprovado' from public.profiles where id = w.user_id), 'created_at', w.created_at) order by w.created_at)
      from public.withdrawals w where w.status = 'pendente'), '[]'),
    'history', coalesce((select jsonb_agg(x order by x ->> 'at' desc) from (
        select jsonb_build_object('type', 'deposito', 'id', d.id, 'user', app.user_card(d.user_id), 'amount_cents', d.amount_cents, 'status', d.status, 'provider', d.provider, 'note', d.note, 'at', coalesce(d.reviewed_at, d.created_at)) x
          from public.deposits d where d.status <> 'pendente'
        union all
        select jsonb_build_object('type', 'saque', 'id', w.id, 'user', app.user_card(w.user_id), 'amount_cents', w.amount_cents, 'status', w.status, 'note', w.note, 'at', coalesce(w.reviewed_at, w.created_at))
          from public.withdrawals w where w.status <> 'pendente'
        order by 1 limit 150) q), '[]'),
    'revenue', coalesce((select jsonb_agg(to_jsonb(p) order by p.id desc) from (select * from public.platform_ledger order by id desc limit 60) p), '[]'));
end $$;

create or replace function public.admin_deposit(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; d public.deposits;
begin
  me := app.require_level(2);
  select * into d from public.deposits where id = p_id for update;
  if not found or d.status <> 'pendente' then perform app.fail('Esse depósito já foi resolvido.'); end if;
  if p_approve then
    perform app.approve_deposit(d, coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Confirmado pela administração'));
    perform app.log('Confirmou depósito', (select nick from public.profiles where id = d.user_id), app.brl(d.amount_cents));
  else
    if btrim(coalesce(p_note, '')) = '' then perform app.fail('Escreva o motivo da recusa.'); end if;
    update public.deposits set status = 'recusado', note = btrim(p_note), reviewed_at = now(), reviewed_by = me.id where id = d.id;
    perform app.notify(d.user_id, 'deposito', 'Depósito recusado', app.brl(d.amount_cents) || ': ' || btrim(p_note) || '.');
    perform app.log('Recusou depósito', (select nick from public.profiles where id = d.user_id), app.brl(d.amount_cents) || ' · ' || btrim(p_note));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_withdrawal(p_id uuid, p_paid boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; w public.withdrawals;
begin
  me := app.require_level(2);
  select * into w from public.withdrawals where id = p_id for update;
  if not found or w.status <> 'pendente' then perform app.fail('Esse saque já foi resolvido.'); end if;
  update public.wallets set held_cents = held_cents - w.amount_cents where user_id = w.user_id;
  if p_paid then
    update public.withdrawals set status = 'pago', note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now(), reviewed_by = me.id where id = w.id;
    perform app.notify(w.user_id, 'saque', 'Saque pago', app.brl(w.amount_cents) || ' enviados para sua chave Pix.');
    perform app.log('Pagou saque', (select nick from public.profiles where id = w.user_id), app.brl(w.amount_cents));
  else
    if btrim(coalesce(p_note, '')) = '' then perform app.fail('Escreva o motivo da recusa.'); end if;
    update public.withdrawals set status = 'recusado', note = btrim(p_note), reviewed_at = now(), reviewed_by = me.id where id = w.id;
    perform app.credit(w.user_id, w.amount_cents, 'saque_estorno', 'Saque recusado: ' || btrim(p_note), 'withdrawal', w.id::text);
    perform app.notify(w.user_id, 'saque', 'Saque recusado', app.brl(w.amount_cents) || ' voltaram para a carteira. Motivo: ' || btrim(p_note) || '.');
    perform app.log('Recusou saque', (select nick from public.profiles where id = w.user_id), app.brl(w.amount_cents) || ' · ' || btrim(p_note));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_rooms(p_status text default 'ativas', p_q text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(app.room_summary(r) || jsonb_build_object('commitment_cents', app.room_commitment(r, greatest((select count(*)::int from public.room_players rp where rp.room_id = r.id and rp.status = 'inscrito'), 2)))
          order by case when r.status = 'em_andamento' then 0 when r.status = 'aberta' then 1 else 2 end, r.starts_at desc)
    from (select * from public.rooms r
           where case p_status when 'ativas' then r.status in ('aberta', 'em_andamento') when 'encerradas' then r.status in ('finalizada', 'cancelada') else true end
             and (v is null or r.title ilike '%' || v || '%' or r.code::text = v)
           order by r.created_at desc limit 150) r), '[]');
end $$;

create or replace function public.admin_move_player(p_user uuid, p_from uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; a public.rooms; b public.rooms; v_n int;
begin
  me := app.require_level(1);
  if p_from = p_to then perform app.fail('Escolha outra sala de destino.'); end if;
  select * into a from public.rooms where id = p_from for update;
  select * into b from public.rooms where id = p_to for update;
  if a.id is null or b.id is null then perform app.fail('Sala não encontrada.'); end if;
  if a.status not in ('aberta', 'em_andamento') then perform app.fail('A sala de origem já foi encerrada.'); end if;
  if b.status <> 'aberta' then perform app.fail('A sala de destino precisa estar com inscrições abertas.'); end if;
  select count(*) into v_n from public.room_players where room_id = b.id and status = 'inscrito';
  if v_n >= b.max_players then perform app.fail('A sala de destino está cheia.'); end if;
  if exists (select 1 from public.room_players where room_id = b.id and user_id = p_user and status = 'inscrito') then perform app.fail('O jogador já está na sala de destino.'); end if;
  perform app.unenroll(a, p_user, 'removido', 'Movido para a sala #' || b.code);
  select * into b from public.rooms where id = p_to;
  perform app.enroll(b, p_user);
  perform app.notify(p_user, 'sala', 'Você foi movido para a sala #' || b.code, 'Saiu de ' || a.title || ' (valor devolvido) e entrou em ' || b.title || '.', jsonb_build_object('room_id', b.id));
  if a.status = 'aberta' then perform app.promote_waitlist(a.id); end if;
  perform app.log('Moveu jogador', (select nick from public.profiles where id = p_user), '#' || a.code || ' → #' || b.code);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_reports(p_status text default 'aberta') returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'target', app.user_card(r.target_id), 'reporter', app.user_card(r.reporter_id),
      'room', (select jsonb_build_object('id', ro.id, 'code', ro.code, 'title', ro.title) from public.rooms ro where ro.id = r.room_id),
      'reason', r.reason, 'detail', r.detail, 'status', r.status, 'resolution', r.resolution, 'created_at', r.created_at,
      'against_count', (select count(*) from public.reports x where x.target_id = r.target_id)) order by r.created_at desc)
    from (select * from public.reports where status = p_status order by created_at desc limit 100) r), '[]');
end $$;

create or replace function public.admin_report_resolve(p_id uuid, p_status text, p_note text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; r public.reports;
begin
  me := app.require_level(1);
  select * into r from public.reports where id = p_id for update;
  if not found or r.status <> 'aberta' then perform app.fail('Essa denúncia já foi resolvida.'); end if;
  if p_status not in ('resolvida', 'descartada') then perform app.fail('Status inválido.'); end if;
  update public.reports set status = p_status, resolution = coalesce(nullif(btrim(coalesce(p_note, '')), ''), case when p_status = 'descartada' then 'Sem violação' else 'Resolvida' end), reviewed_by = me.id, reviewed_at = now() where id = r.id;
  perform app.notify(r.reporter_id, 'admin', 'Sua denúncia foi analisada', coalesce(nullif(btrim(coalesce(p_note, '')), ''), case when p_status = 'descartada' then 'Sem violação encontrada.' else 'Medidas tomadas.' end) || ' Obrigado por ajudar.');
  perform app.log(case when p_status = 'resolvida' then 'Resolveu denúncia' else 'Descartou denúncia' end, (select nick from public.profiles where id = r.target_id), r.reason || coalesce(' · ' || nullif(btrim(coalesce(p_note, '')), ''), ''));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_guild_dissolve(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; g public.guilds; v_n int; v_part bigint; v_rest bigint; m record;
begin
  me := app.require_level(1);
  select * into g from public.guilds where id = p_id for update;
  if not found then perform app.fail('Guilda não encontrada.'); end if;
  if btrim(coalesce(p_reason, '')) = '' then perform app.fail('Escreva o motivo.'); end if;
  select count(*) into v_n from public.guild_members where guild_id = g.id;
  -- o cofre é dividido igualmente entre os membros (a sobra vai para o líder)
  if g.vault_cents > 0 and v_n > 0 then
    v_part := g.vault_cents / v_n; v_rest := g.vault_cents - v_part * v_n;
    for m in select user_id from public.guild_members where guild_id = g.id loop
      perform app.credit(m.user_id, v_part + case when m.user_id = g.leader_id then v_rest else 0 end, 'salario_guilda', 'Divisão do cofre · ' || g.name || ' dissolvida', 'guild', g.id::text);
    end loop;
  end if;
  for m in select user_id from public.guild_members where guild_id = g.id loop
    perform app.notify(m.user_id, 'guilda', g.name || ' foi dissolvida', 'Motivo: ' || btrim(p_reason) || '.' || case when g.vault_cents > 0 then ' O cofre foi dividido entre os membros.' else '' end);
  end loop;
  update public.profiles set guild_id = null where guild_id = g.id;
  delete from public.guilds where id = g.id;
  perform app.log('Dissolveu guilda', g.name || ' [' || g.tag || ']', btrim(p_reason) || ' · cofre ' || app.brl(g.vault_cents));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_get_settings() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return to_jsonb(app.settings());
end $$;

create or replace function public.admin_set_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; s public.settings;
begin
  me := app.require_level(2); s := app.settings();
  update public.settings set
    platform_fee_pct = coalesce((p ->> 'platform_fee_pct')::numeric, platform_fee_pct),
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
    xp = coalesce(p -> 'xp', xp)
  where id = 1;
  if (select min_deposit_cents > max_deposit_cents or min_withdraw_cents > max_withdraw_cents from public.settings where id = 1) then
    perform app.fail('O mínimo não pode ser maior que o máximo.');
  end if;
  perform app.log('Alterou configurações', 'Plataforma', (select string_agg(key, ', ') from jsonb_object_keys(p) key));
  return to_jsonb(app.settings());
end $$;

create or replace function public.admin_broadcast(p_title text, p_body text, p_target text, p_pinned boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v_n int;
begin
  me := app.require_level(2);
  if length(btrim(coalesce(p_title, ''))) < 3 then perform app.fail('Escreva um título.'); end if;
  if length(btrim(coalesce(p_body, ''))) < 5 then perform app.fail('Escreva a mensagem.'); end if;
  insert into public.notifications (user_id, kind, title, body)
    select id, 'aviso', btrim(p_title), btrim(p_body) from public.profiles
     where coalesce(banned_until, '-infinity') <= now()
       and case p_target when 'verificados' then ff_status = 'aprovado' when 'staff' then app.role_level(role) >= 1 when 'criadores' then can_create_rooms else true end;
  get diagnostics v_n = row_count;
  if p_pinned then update public.announcements set pinned = false where pinned; end if;
  insert into public.announcements (title, body, target, pinned, reach, by_id) values (btrim(p_title), btrim(p_body), coalesce(p_target, 'todos'), coalesce(p_pinned, false), v_n, me.id);
  perform app.log('Publicou aviso', btrim(p_title), v_n || ' contas' || case when p_pinned then ', fixado no início' else '' end);
  return jsonb_build_object('reach', v_n);
end $$;

create or replace function public.admin_announcements() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('by', app.user_card(a.by_id)) order by a.id desc) from (select * from public.announcements order by id desc limit 50) a), '[]');
end $$;

create or replace function public.admin_pin(p_id bigint, p_pinned boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  if p_pinned then update public.announcements set pinned = false where pinned; end if;
  update public.announcements set pinned = p_pinned where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_shop() returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_level(2);
  return coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object(
      'owners', (select count(*) from public.inventory i where i.item_id = s.id),
      'revenue_cents', coalesce((select sum(amount_cents) from public.platform_ledger p where p.ref_type = 'item' and p.ref_id = s.id), 0),
      'reward_level', (select level from public.rewards r where r.item_id = s.id)) order by s.kind, s.sort)
    from public.shop_items s), '[]');
end $$;

create or replace function public.admin_shop_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id text := lower(regexp_replace(btrim(coalesce(p ->> 'id', '')), '[^a-zA-Z0-9-]+', '-', 'g'));
begin
  perform app.require_level(2);
  if length(v_id) < 3 then perform app.fail('Defina um código para o item (ex.: banner-verao).'); end if;
  if coalesce(p ->> 'kind', '') not in ('banner', 'moldura', 'titulo', 'cor', 'prioridade') then perform app.fail('Tipo de item inválido.'); end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 2 then perform app.fail('Dê um nome ao item.'); end if;
  insert into public.shop_items (id, kind, name, description, price_cents, duration_days, data, active, sort)
  values (v_id, p ->> 'kind', btrim(p ->> 'name'), coalesce(p ->> 'description', ''), nullif(p ->> 'price_cents', '')::bigint,
          nullif(p ->> 'duration_days', '')::int, coalesce(p -> 'data', '{}'), coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'sort')::int, 100))
  on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
       duration_days = excluded.duration_days, data = excluded.data, active = excluded.active, kind = excluded.kind;
  perform app.log('Salvou item da loja', btrim(p ->> 'name'), coalesce(app.brl(nullif(p ->> 'price_cents', '')::bigint), 'só recompensa'));
  return public.admin_shop();
end $$;

create or replace function public.admin_logs(p_q text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform app.require_level(2);
  return coalesce((select jsonb_agg(jsonb_build_object('actor', app.user_card(l.actor_id), 'action', l.action, 'target', l.target, 'detail', l.detail, 'created_at', l.created_at) order by l.id desc)
    from (select l.* from public.audit_log l left join public.profiles p on p.id = l.actor_id
           where v is null or l.action ilike '%' || v || '%' or l.target ilike '%' || v || '%' or l.detail ilike '%' || v || '%' or p.nick ilike '%' || v || '%'
           order by l.id desc limit 200) l), '[]');
end $$;

-- ---------------------------------------------------------------- permissões de execução
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
