-- BattleHub: verificação do aparelho, recusa da verificação e aba de banidos
-- 1) Letrinhas miúdas: ao mandar o vídeo, o suspeito aceita que os organizadores verifiquem o aparelho
--    (programa de trapaça ou APK modificado). O aceite fica gravado no caso.
-- 2) Recusou a verificação (ou não se apresentou): ban permanente e bloqueio do ID do Free Fire, das chaves Pix e do
--    aparelho, sem poder criar outra conta. A equipe escolhe se também trata como trapaça (devolve as inscrições e
--    retém o saldo).
-- 3) Aba de banidos: só admin ou dono libera, de três jeitos:
--    - nova_conta: tira os bloqueios; esta conta continua banida, mas a pessoa pode criar outra;
--    - voltar: tira o ban e os bloqueios; volta para esta conta, e o saldo retido continua retido;
--    - reativar: como "voltar", e ainda devolve o saldo retido para a carteira.

alter table public.cheat_cases drop constraint if exists cheat_cases_status_check;
alter table public.cheat_cases add constraint cheat_cases_status_check
  check (status in ('aguardando_video', 'em_analise', 'confirmado', 'descartado', 'recusado'));
alter table public.cheat_cases add column consent_at timestamptz;

create table public.ban_releases (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('nova_conta', 'voltar', 'reativar')),
  by_id uuid references public.profiles (id) on delete set null,
  note text not null,
  returned_cents bigint not null default 0,
  unblocked jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.ban_releases enable row level security;

-- ================================================================ ajudantes
-- chaves que prendem a pessoa: ID do Free Fire, chaves Pix usadas nos saques e aparelho
create or replace function app.block_user(p_user uuid, p_reason text, p_case uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare t public.profiles;
begin
  select * into t from public.profiles where id = p_user;
  if t.ff_id is not null then
    insert into public.blocklist (kind, value, reason, case_id) values ('ff_id', t.ff_id, p_reason, p_case) on conflict do nothing;
  end if;
  insert into public.blocklist (kind, value, reason, case_id)
    select distinct 'pix', app.norm_key(pix_key), p_reason, p_case from public.withdrawals where user_id = t.id and app.norm_key(pix_key) <> ''
    on conflict do nothing;
  if t.device_id is not null then
    insert into public.blocklist (kind, value, reason, case_id) values ('device', t.device_id, p_reason, p_case) on conflict do nothing;
  end if;
end $$;

create or replace function app.user_blocks(p_user uuid) returns table (kind text, value text)
language sql stable security definer set search_path = public, app as $$
  select b.kind, b.value from public.blocklist b, public.profiles t
   where t.id = p_user and (
         (b.kind = 'ff_id' and b.value = t.ff_id)
      or (b.kind = 'device' and b.value = t.device_id)
      or (b.kind = 'pix' and b.value in (select app.norm_key(w.pix_key) from public.withdrawals w where w.user_id = t.id)))
$$;

-- saldo retido por trapaça que ainda não foi devolvido
create or replace function app.retained_cents(p_user uuid) returns bigint
language sql stable security definer set search_path = public, app as $$
  select coalesce(sum(case when kind = 'confisco_trapaca' then -amount_cents when kind = 'devolucao_confisco' then -amount_cents else 0 end), 0)::bigint
    from public.ledger where user_id = p_user and kind in ('confisco_trapaca', 'devolucao_confisco')
$$;

-- ================================================================ 1) aceite da verificação
drop function if exists public.case_submit_video(uuid, text, text);
create or replace function public.case_submit_video(p_case uuid, p_path text, p_link text, p_consent boolean default false) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; c public.cheat_cases; v_path text := nullif(btrim(coalesce(p_path, '')), ''); v_link text := nullif(btrim(coalesce(p_link, '')), '');
        v_thread uuid;
begin
  me := app.require_user();
  select * into c from public.cheat_cases where id = p_case and suspect_id = me.id for update;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  if c.status not in ('aguardando_video', 'em_analise') then perform app.fail('Essa análise já foi encerrada.'); end if;
  if not coalesce(p_consent, false) and c.consent_at is null then perform app.fail('Marque que você aceita a verificação do aparelho.'); end if;
  if v_path is null and v_link is null then perform app.fail('Envie o arquivo do vídeo ou cole o link.'); end if;
  if v_path is not null and position(me.id::text || '/' in v_path) <> 1 then perform app.fail('Arquivo inválido. Envie de novo.'); end if;
  if v_link is not null and v_link !~* '^https?://[^\s]+$' then perform app.fail('Cole um link que comece com https://'); end if;
  update public.cheat_cases set video_path = coalesce(v_path, video_path), video_link = coalesce(v_link, video_link), video_at = now(), status = 'em_analise',
         consent_at = coalesce(consent_at, now())
   where id = c.id;
  if c.opened_by is not null then
    v_thread := app.get_thread('sala', me.id, c.opened_by, c.room_id);
    perform public.send_message(v_thread, 'Enviei o vídeo da partida (caso #' || c.code || ') e aceito a verificação do aparelho.' || case when v_link is not null then ' Link: ' || v_link else '' end, null);
    perform app.notify(c.opened_by, 'analise', 'Vídeo recebido · caso #' || c.code, me.nick || ' mandou o vídeo da partida.', jsonb_build_object('case_id', c.id, 'staff', true));
  end if;
  return app.my_case_json(me.id);
end $$;

do $$
declare v_src text; v_new text;
begin
  select pg_get_functiondef('app.my_case_json(uuid)'::regprocedure) into v_src;
  v_new := replace(v_src, '''video_sent'', c.video_at is not null,', '''video_sent'', c.video_at is not null, ''consent_at'', c.consent_at,');
  if v_new = v_src then raise exception 'my_case_json: ponto de ajuste não encontrado'; end if;
  execute v_new;
  -- a mensagem que o suspeito recebe já leva as letrinhas miúdas
  select pg_get_functiondef('public.admin_case_open(uuid, uuid, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'Se precisar, eu te chamo numa ligação de voz para você compartilhar a tela.''',
    'Se precisar, eu te chamo numa ligação de voz para você compartilhar a tela.'' || E''\n\n'' ||
    ''Importante: pelos termos de uso, os organizadores têm total direito de verificar o seu aparelho para conferir se há programa de trapaça ou APK modificado. '' ||
    ''Recusar a verificação é tratado como trapaça: ban permanente, sem poder criar outra conta.''');
  if v_new = v_src then raise exception 'admin_case_open: ponto de ajuste não encontrado'; end if;
  execute v_new;
  select pg_get_functiondef('public.admin_case(uuid)'::regprocedure) into v_src;
  v_new := replace(v_src, '''video_link'', c.video_link,', '''video_link'', c.video_link, ''consent_at'', c.consent_at,');
  if v_new <> v_src then execute v_new; end if;
end $$;

-- ================================================================ 2) recusou a verificação
create or replace function public.admin_case_refuse(p_id uuid, p_as_cheat boolean, p_mode text, p_note text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; c public.cheat_cases; t public.profiles; r public.rooms; v_note text := btrim(coalesce(p_note, ''));
        v_reason text;
begin
  me := app.require_level(2);
  select * into c from public.cheat_cases where id = p_id;
  if not found then perform app.fail('Análise não encontrada.'); end if;
  if c.status not in ('aguardando_video', 'em_analise') then perform app.fail('Essa análise já foi encerrada.'); end if;
  if length(v_note) < 5 then perform app.fail('Escreva o que aconteceu (ex.: recusou compartilhar a tela na ligação).'); end if;
  select * into t from public.profiles where id = c.suspect_id;
  select * into r from public.rooms where id = c.room_id;
  v_reason := 'Recusou a verificação do aparelho (caso #' || c.code || ')';

  if coalesce(p_as_cheat, false) then
    -- trata como trapaça: devolve as inscrições, retém o saldo, bane e bloqueia (tudo no veredito normal)
    perform public.admin_case_resolve(c.id, true, p_mode, 'Recusou a verificação do aparelho. ' || v_note);
  else
    perform public.admin_ban(t.id, 0, v_reason);
    perform app.block_user(t.id, 'Recusou a verificação · caso #' || c.code, c.id);
    update public.cheat_cases set verdict_note = 'Recusou a verificação do aparelho. ' || v_note, resolved_by = me.id, resolved_at = now(),
           result = jsonb_build_object('refunds', '[]'::jsonb, 'refund_total', 0, 'confiscated', 0, 'withdrawals_refused', 0) where id = c.id;
  end if;
  update public.cheat_cases set status = 'recusado' where id = c.id;
  update public.profiles set ban_reason = v_reason where id = t.id;
  update public.bans set reason = v_reason where id = (select max(id) from public.bans where user_id = t.id);
  perform app.log('Baniu por recusar a verificação', t.nick, 'Caso #' || c.code || case when p_as_cheat then ' · tratado como trapaça' else '' end || ' · ' || v_note);
  return public.admin_case(c.id);
end $$;

-- ================================================================ 3) aba de banidos
create or replace function public.admin_banned(p_q text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_q text := lower(btrim(coalesce(p_q, '')));
begin
  perform app.require_level(1);
  return coalesce((select jsonb_agg(x order by (x ->> 'since') desc nulls last) from (
    select jsonb_build_object(
      'user', app.user_card(p.id), 'email', (select email from auth.users where id = p.id), 'ff_id', p.ff_id,
      'reason', p.ban_reason, 'permanent', p.banned_until > now() + interval '50 years', 'until', p.banned_until,
      'since', (select max(b.created_at) from public.bans b where b.user_id = p.id),
      'by', (select app.user_card(b.by_id) from public.bans b where b.user_id = p.id order by b.id desc limit 1),
      'case', (select jsonb_build_object('id', c.id, 'code', c.code, 'status', c.status) from public.cheat_cases c where c.suspect_id = p.id order by c.created_at desc limit 1),
      'retained_cents', app.retained_cents(p.id),
      'balance_cents', (select balance_cents from public.wallets where user_id = p.id),
      'blocks', coalesce((select jsonb_agg(jsonb_build_object('kind', ub.kind, 'value', ub.value)) from app.user_blocks(p.id) ub), '[]'),
      'releases', coalesce((select jsonb_agg(jsonb_build_object('action', br.action, 'at', br.created_at, 'note', br.note, 'by', app.user_card(br.by_id)) order by br.id desc)
                            from public.ban_releases br where br.user_id = p.id), '[]')) x
      from public.profiles p
     where p.banned_until > now()
       and (v_q = '' or lower(coalesce(p.nick, '')) like '%' || v_q || '%' or p.code::text = v_q or coalesce(p.ff_id, '') = v_q)
     limit 200) q), '[]');
end $$;

create or replace function public.admin_ban_release(p_user uuid, p_action text, p_note text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles; v_note text := btrim(coalesce(p_note, '')); v_blocks jsonb; v_ret bigint := 0;
begin
  me := app.require_level(2);
  select * into t from public.profiles where id = p_user for update;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if p_action not in ('nova_conta', 'voltar', 'reativar') then perform app.fail('Escolha o que liberar.'); end if;
  if length(v_note) < 5 then perform app.fail('Escreva o motivo da liberação.'); end if;
  if app.role_level(t.role) >= app.role_level(me.role) and me.role <> 'dono' then perform app.fail('Você não pode mexer nessa conta.'); end if;

  -- tira os bloqueios (aparelho, ID do Free Fire e chaves Pix): sem isso o aparelho baniria a conta de novo
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'value', value)), '[]') into v_blocks from app.user_blocks(t.id);
  delete from public.blocklist b using app.user_blocks(t.id) ub where b.kind = ub.kind and b.value = ub.value;

  if p_action in ('voltar', 'reativar') then
    if t.banned_until is null or t.banned_until <= now() then perform app.fail('Essa conta não está banida.'); end if;
    update public.profiles set banned_until = null, ban_reason = null where id = t.id;
    update public.bans set lifted_at = now() where user_id = t.id and lifted_at is null;
  end if;

  if p_action = 'reativar' then
    v_ret := app.retained_cents(t.id);
    if v_ret > 0 then
      perform app.credit(t.id, v_ret, 'devolucao_confisco', 'Saldo retido devolvido na reativação da conta', 'ban_release', t.id::text);
      perform app.platform('devolucao_confisco', -v_ret, 'Saldo devolvido para ' || coalesce(t.nick, '?') || ' na reativação', 'ban_release', t.id::text);
    end if;
  end if;

  insert into public.ban_releases (user_id, action, by_id, note, returned_cents, unblocked) values (t.id, p_action, me.id, v_note, v_ret, v_blocks);
  if p_action <> 'nova_conta' then
    perform app.notify(t.id, 'ban', 'Sua conta foi liberada', 'A administração liberou o seu acesso.' || case when v_ret > 0 then ' ' || app.brl(v_ret) || ' voltaram para a sua carteira.' else '' end);
  end if;
  perform app.log(case p_action when 'nova_conta' then 'Liberou criar outra conta' when 'voltar' then 'Liberou voltar para a conta' else 'Reativou a conta' end,
    t.nick, v_note || case when v_ret > 0 then ' · devolveu ' || app.brl(v_ret) else '' end || ' · ' || jsonb_array_length(v_blocks) || ' bloqueios retirados');
  return jsonb_build_object('ok', true, 'returned_cents', v_ret, 'unblocked', v_blocks);
end $$;

-- ban permanente só a administração tira, pela aba Banidos (o aparelho bloqueado baniria de novo)
create or replace function public.admin_unban(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; t public.profiles;
begin
  me := app.require_level(1);
  select * into t from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  if t.banned_until > now() + interval '50 years' then perform app.fail('Ban permanente: libere pela aba Banidos (só admin ou dono).'); end if;
  update public.profiles set banned_until = null, ban_reason = null where id = t.id;
  update public.bans set lifted_at = now() where user_id = t.id and lifted_at is null;
  perform app.notify(t.id, 'ban', 'Suspensão encerrada', 'Sua conta voltou ao normal. Bons jogos.');
  perform app.log('Desbaniu conta', t.nick);
  return app.admin_user_row((select p from public.profiles p where p.id = t.id));
end $$;

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
grant execute on function app.in_thread(uuid, uuid) to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.svc_message_previews(bigint[]) from authenticated;
grant execute on function public.clear_push_token(text) to anon;
