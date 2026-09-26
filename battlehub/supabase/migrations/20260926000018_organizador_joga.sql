-- BattleHub: organizador (e a equipe) pode jogar a própria sala
-- Paga a inscrição como qualquer jogador e, se ganhar, o prêmio cai na carteira dele. Para ser transparente:
-- a sala mostra para todos que o organizador está jogando, e a auditoria registra a entrada e o resultado.
do $$
declare v_src text; v_new text;
begin
  select pg_get_functiondef('public.join_room(uuid)'::regprocedure) into v_src;
  v_new := replace(v_src, '  if r.creator_id = me.id then perform app.fail(''Você é o organizador desta sala.''); end if;' || E'\n', '');
  if v_new = v_src then raise exception 'join_room: ponto de ajuste não encontrado'; end if;
  execute v_new;

  select pg_get_functiondef('app.enroll(public.rooms, uuid)'::regprocedure) into v_src;
  v_new := replace(v_src, '  if p_room.creator_id = p_user then perform app.fail(''Você é o organizador desta sala.''); end if;' || E'\n',
    '  if p_room.creator_id = p_user then perform app.log(''Organizador entrou para jogar a própria sala'', ''#'' || p_room.code, p_room.title); end if;' || E'\n');
  if v_new = v_src then raise exception 'enroll: ponto de ajuste não encontrado'; end if;
  execute v_new;

  select pg_get_functiondef('app.room_summary(public.rooms)'::regprocedure) into v_src;
  v_new := replace(v_src, '''is_creator'', r.creator_id = auth.uid(),',
    '''is_creator'', r.creator_id = auth.uid(),' || E'\n    ' ||
    '''creator_plays'', exists (select 1 from public.room_players rp where rp.room_id = r.id and rp.user_id = r.creator_id and rp.status = ''inscrito''),');
  if v_new = v_src then raise exception 'room_summary: ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

-- resultado de sala em que o organizador jogou fica marcado na auditoria
create or replace function app.room_creator_result() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare rp public.room_players;
begin
  select * into rp from public.room_players where room_id = new.id and user_id = new.creator_id and status = 'inscrito';
  if found then
    insert into public.audit_log (actor_id, action, target, detail)
    values (new.creator_id, 'Organizador jogou e finalizou a própria sala', '#' || new.code,
            new.title || ' · colocação ' || coalesce(rp.placement::text, '–') || ' · ' || coalesce(rp.kills, 0) || ' abates · ganhou ' || app.brl(coalesce(rp.earned_cents, 0)));
  end if;
  return null;
end $$;
create trigger rooms_creator_result after update of status on public.rooms
  for each row when (new.status = 'finalizada' and old.status is distinct from 'finalizada')
  execute function app.room_creator_result();

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
grant execute on function app.in_thread(uuid, uuid) to authenticated;
