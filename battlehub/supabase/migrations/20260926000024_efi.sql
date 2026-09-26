-- Segundo gateway: Efí Bank (antiga Gerencianet). Recebe Pix (cobrança imediata) e paga Pix pela API, conferindo
-- se a chave pertence ao CPF do jogador. O painel escolhe o gateway do depósito e o gateway que paga os saques.

alter table public.settings drop constraint if exists settings_deposit_provider_check;
alter table public.settings add constraint settings_deposit_provider_check check (deposit_provider in ('mercadopago', 'asaas', 'efi'));
alter table public.settings add column if not exists payout_provider text not null default 'asaas';
alter table public.settings drop constraint if exists settings_payout_provider_check;
alter table public.settings add constraint settings_payout_provider_check check (payout_provider in ('asaas', 'efi'));

do $$
declare v_src text; v_new text;
begin
  -- saque automático e botão do painel usam o gateway de saque escolhido
  select pg_get_functiondef('public.request_withdrawal(bigint, text, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'update public.withdrawals set status = ''processando'', auto = true, provider = ''asaas'' where id = w.id returning * into w;',
    'update public.withdrawals set status = ''processando'', auto = true, provider = s.payout_provider where id = w.id returning * into w;');
  if v_new = v_src then raise exception 'request_withdrawal: ponto de ajuste não encontrado'; end if;
  execute v_new;

  select pg_get_functiondef('public.admin_withdrawal_send(uuid)'::regprocedure) into v_src;
  v_new := replace(v_src, 'update public.withdrawals set status = ''processando'', provider = ''asaas'', sent_at = null, note = null where id = w.id;',
    'update public.withdrawals set status = ''processando'', provider = (select payout_provider from public.settings where id = 1), sent_at = null, note = null where id = w.id;');
  v_new := replace(v_new, '''Mandou saque pelo Asaas''', '''Mandou saque pelo gateway''');
  if v_new = v_src then raise exception 'admin_withdrawal_send: ponto de ajuste não encontrado'; end if;
  execute v_new;

  select pg_get_functiondef('public.admin_set_settings(jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, '    deposit_provider = coalesce(p ->> ''deposit_provider'', deposit_provider),',
    '    deposit_provider = coalesce(p ->> ''deposit_provider'', deposit_provider),
    payout_provider = coalesce(p ->> ''payout_provider'', payout_provider),');
  if v_new = v_src then raise exception 'admin_set_settings: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- depósito pelo gateway escolhido (aceita o Efí)
  select pg_get_functiondef('public.svc_create_deposit(uuid, bigint, text, text, text, timestamptz, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'if p_provider not in (''mercadopago'', ''asaas'') then', 'if p_provider not in (''mercadopago'', ''asaas'', ''efi'') then');
  if v_new = v_src then raise exception 'svc_create_deposit: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- o painel mostra por qual gateway o saque vai
  select pg_get_functiondef('public.admin_finance()'::regprocedure) into v_src;
  v_new := replace(v_src, '''status'', w.status, ''auto'', w.auto,', '''status'', w.status, ''auto'', w.auto, ''provider'', w.provider,');
  if v_new = v_src then raise exception 'admin_finance: ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

-- pegar o saque para enviar: devolve também o gateway e o CPF do jogador (o Efí confere se a chave é desse CPF)
create or replace function public.svc_withdrawal_claim(p_id uuid, p_user uuid default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare w public.withdrawals;
begin
  perform app.require_service();
  select * into w from public.withdrawals where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  if p_user is not null and w.user_id <> p_user then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  if w.status <> 'processando' then return jsonb_build_object('ok', false, 'reason', 'estado', 'status', w.status); end if;
  if w.provider_id is not null or (w.sent_at is not null and w.sent_at > now() - interval '10 minutes') then
    return jsonb_build_object('ok', false, 'reason', 'ja_enviado');
  end if;
  update public.withdrawals set attempts = attempts + 1, sent_at = now() where id = w.id;
  return jsonb_build_object('ok', true, 'id', w.id, 'amount_cents', w.amount_cents, 'pix_key', w.pix_key, 'pix_key_type', w.pix_key_type,
    'provider', coalesce(w.provider, (select payout_provider from public.settings where id = 1)),
    'cpf', (select cpf from app.player_docs where user_id = w.user_id),
    'nick', (select nick from public.profiles where id = w.user_id));
end $$;

drop function if exists public.svc_withdrawal_sent(uuid, text);
create or replace function public.svc_withdrawal_sent(p_id uuid, p_provider_id text, p_provider text default 'asaas') returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_service();
  update public.withdrawals set provider_id = p_provider_id, provider = p_provider where id = p_id and status = 'processando';
  return jsonb_build_object('ok', found);
end $$;

-- resultado do depósito em qualquer gateway (estado já traduzido: pago, recusado, expirado)
create or replace function public.svc_settle_deposit_gw(p_provider text, p_provider_id text, p_state text, p_amount_cents bigint, p_detail text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.deposits;
begin
  perform app.require_service();
  select * into d from public.deposits where provider_id = p_provider_id and provider = p_provider for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'desconhecido'); end if;
  if d.status <> 'pendente' then return jsonb_build_object('ok', true, 'status', d.status); end if;
  if p_state = 'pago' then
    if p_amount_cents is not null and p_amount_cents < d.amount_cents then
      update public.deposits set note = 'Valor pago menor que o esperado: ' || app.brl(p_amount_cents) where id = d.id;
      return jsonb_build_object('ok', false, 'reason', 'valor');
    end if;
    perform app.approve_deposit(d, 'Confirmado pelo ' || case p_provider when 'efi' then 'Efí' when 'asaas' then 'Asaas' else p_provider end);
  elsif p_state = 'recusado' then
    update public.deposits set status = 'recusado', note = coalesce(p_detail, 'Pagamento recusado'), reviewed_at = now() where id = d.id;
  elsif p_state = 'expirado' then
    update public.deposits set status = 'expirado', reviewed_at = now() where id = d.id;
  end if;
  return jsonb_build_object('ok', true, 'status', (select status from public.deposits where id = d.id));
end $$;

-- saques enviados que ainda esperam o banco (para conferir o estado no gateway)
create or replace function public.svc_withdrawals_in_flight(p_provider text) returns jsonb
language sql security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'provider_id', provider_id)), '[]')
    from public.withdrawals where status = 'processando' and provider = p_provider and provider_id is not null
$$;

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
grant execute on function app.in_thread(uuid, uuid) to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.svc_message_previews(bigint[]) from authenticated;
revoke execute on function public.svc_withdrawals_in_flight(text) from authenticated;
grant execute on function public.clear_push_token(text) to anon;
