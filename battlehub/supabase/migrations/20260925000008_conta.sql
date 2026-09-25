-- BattleHub: exclusão da própria conta (exigência da Play Store para apps com login).
-- Os lançamentos de dinheiro ficam guardados (obrigação contábil), mas sem dados pessoais:
-- nick, foto, e-mail e dados do Free Fire são apagados e o acesso é encerrado.

create or replace function public.delete_my_account(p_forfeit boolean default false) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; v_bal bigint; r record; v_left bigint := 0;
begin
  me := app.require_user();
  if me.role = 'dono' then perform app.fail('A conta dona do app não pode ser excluída por aqui.'); end if;
  if exists (select 1 from public.withdrawals where user_id = me.id and status = 'pendente') then
    perform app.fail('Você tem um saque em análise. Espere ele ser pago para excluir a conta.');
  end if;
  if exists (select 1 from public.room_players rp join public.rooms ro on ro.id = rp.room_id
              where rp.user_id = me.id and rp.status = 'inscrito' and ro.status = 'em_andamento') then
    perform app.fail('Você está numa partida ao vivo. Espere ela terminar para excluir a conta.');
  end if;
  if exists (select 1 from public.rooms where creator_id = me.id and status in ('aberta', 'em_andamento')) then
    perform app.fail('Você organiza salas abertas. Finalize ou cancele antes de excluir a conta.');
  end if;
  if exists (select 1 from public.event_entries x join public.events e on e.id = x.event_id
              where me.id = any (x.members) and x.status <> 'desistiu' and e.status in ('inscricoes', 'andamento')) then
    perform app.fail('Você está inscrito num evento em andamento. Saia da line (ou espere o evento acabar) antes de excluir a conta.');
  end if;
  if exists (select 1 from public.guild_members where user_id = me.id and role = 'lider') then
    perform app.fail('Você é líder de uma guilda. Passe a liderança ou dissolva a guilda antes.');
  end if;

  -- sai das salas abertas com reembolso e das filas
  for r in select ro.* from public.room_players rp join public.rooms ro on ro.id = rp.room_id
            where rp.user_id = me.id and rp.status = 'inscrito' and ro.status = 'aberta' loop
    perform app.unenroll(r, me.id, 'saiu', 'Conta excluída');
    perform app.promote_waitlist(r.id);
  end loop;
  delete from public.room_waitlist where user_id = me.id;

  select balance_cents into v_bal from public.wallets where user_id = me.id;
  if coalesce(v_bal, 0) > 0 then
    if not p_forfeit then
      perform app.fail('Você ainda tem ' || app.brl(v_bal) || ' na carteira. Saque antes ou confirme que abre mão desse saldo.');
    end if;
    v_left := v_bal;
    perform app.credit(me.id, -v_bal, 'saldo_abandonado', 'Saldo deixado ao excluir a conta', 'profile', me.id::text);
    perform app.platform('saldo_conta_excluida', v_bal, 'Saldo de conta excluída #' || me.code, 'profile', me.id::text);
  end if;

  delete from public.guild_members where user_id = me.id;
  delete from public.friendships where requester = me.id or addressee = me.id;
  delete from public.notifications where user_id = me.id;
  update public.profiles set nick = 'Conta excluída ' || code, bio = '', avatar_url = null, anonymous = true, guild_id = null,
         ff_nick = null, ff_id = null, ff_photo_path = null, ff_status = 'nao_enviado', ff_note = null,
         can_create_rooms = false, creator_fee_pct = null,
         banned_until = timestamptz '9999-12-31', ban_reason = 'Conta excluída pelo próprio jogador'
   where id = me.id;
  update public.ff_submissions set photo_path = null where user_id = me.id;
  update auth.users set email = 'excluida+' || me.id || '@battlehub.invalid', raw_user_meta_data = '{}' where id = me.id;
  -- no Supabase também some o vínculo com o Google e as sessões
  if to_regclass('auth.identities') is not null then execute 'delete from auth.identities where user_id = $1' using me.id; end if;
  if to_regclass('auth.sessions') is not null then execute 'delete from auth.sessions where user_id = $1' using me.id; end if;
  perform app.log('Excluiu a própria conta', '#' || me.code, case when v_left > 0 then 'Deixou ' || app.brl(v_left) else null end);
  return jsonb_build_object('ok', true, 'forfeit_cents', v_left);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
