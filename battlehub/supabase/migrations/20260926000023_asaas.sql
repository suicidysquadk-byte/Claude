-- Gateway Asaas: depósito por Pix com cobrança no CPF do jogador, saque automático com limites e conferência,
-- validação de cada transferência pelo nosso servidor e fila manual quando algo foge da regra.
-- O Mercado Pago continua funcionando: o painel escolhe qual gateway gera o Pix de depósito.

-- ================================================================ configurações
alter table public.settings
  add column if not exists deposit_provider text not null default 'mercadopago',
  add column if not exists auto_withdraw boolean not null default false,
  add column if not exists auto_withdraw_max_cents bigint not null default 20000,
  add column if not exists auto_withdraw_daily_cents bigint not null default 50000,
  add column if not exists auto_withdraw_min_days int not null default 3;
alter table public.settings drop constraint if exists settings_deposit_provider_check;
alter table public.settings add constraint settings_deposit_provider_check check (deposit_provider in ('mercadopago', 'asaas'));

-- ================================================================ CPF do jogador (privado: fora da API pública)
create table if not exists app.player_docs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  cpf text not null,
  asaas_customer text,
  updated_at timestamptz not null default now()
);
create unique index if not exists player_docs_cpf on app.player_docs (cpf);

create or replace function app.only_digits(p text) returns text language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;
-- dígitos verificadores do CPF
create or replace function app.cpf_valid(p text) returns boolean language plpgsql immutable as $$
declare d text := app.only_digits(p); s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end $$;
create or replace function app.cpf_mask(p text) returns text language sql immutable as $$
  select case when length(app.only_digits(p)) = 11 then '***.' || substr(app.only_digits(p), 4, 3) || '.' || substr(app.only_digits(p), 7, 3) || '-**' end
$$;

-- ================================================================ saques: estado "processando" (enviando pelo Asaas)
alter table public.withdrawals
  add column if not exists provider text,
  add column if not exists provider_id text,
  add column if not exists auto boolean not null default false,
  add column if not exists attempts int not null default 0,
  add column if not exists sent_at timestamptz;
create unique index if not exists withdrawals_provider_id on public.withdrawals (provider_id) where provider_id is not null;
alter table public.withdrawals drop constraint if exists withdrawals_status_check;
alter table public.withdrawals add constraint withdrawals_status_check check (status in ('pendente', 'processando', 'pago', 'recusado'));

-- o saque pode sair sozinho? (regras ajustáveis no painel)
create or replace function app.auto_withdraw_ok(p_user uuid, p_cents bigint, p_key_type text, p_key text) returns text
language plpgsql stable security definer set search_path = public, app as $$
declare s public.settings := app.settings(); me public.profiles; v_cpf text; v_today bigint;
begin
  if not s.auto_withdraw then return 'desligado'; end if;
  select * into me from public.profiles where id = p_user;
  if me.ff_status <> 'aprovado' then return 'id_nao_verificado'; end if;
  if me.created_at > now() - make_interval(days => s.auto_withdraw_min_days) then return 'conta_nova'; end if;
  if p_cents > s.auto_withdraw_max_cents then return 'acima_do_limite'; end if;
  select coalesce(sum(amount_cents), 0) into v_today from public.withdrawals
   where user_id = p_user and auto and status in ('processando', 'pago') and created_at > now() - interval '24 hours';
  if v_today + p_cents > s.auto_withdraw_daily_cents then return 'limite_do_dia'; end if;
  select cpf into v_cpf from app.player_docs where user_id = p_user;
  if v_cpf is null then return 'sem_cpf'; end if;
  if p_key_type <> 'CPF' or app.only_digits(p_key) <> v_cpf then return 'chave_diferente'; end if;
  if exists (select 1 from public.cheat_cases where suspect_id = p_user and status in ('aguardando_video', 'em_analise')) then return 'em_analise'; end if;
  return null;
end $$;

-- ================================================================ ajustes nas funções que já existiam
do $$
declare v_src text; v_new text;
begin
  -- pedido de saque: tenta o automático; senão fica na fila da equipe
  select pg_get_functiondef('public.request_withdrawal(bigint, text, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'status = ''pendente'') then perform app.fail(''Você já tem um saque em análise.'');',
    'status in (''pendente'', ''processando'')) then perform app.fail(''Você já tem um saque em andamento.'');');
  v_new := replace(v_new, '  perform app.notify(me.id, ''saque'', ''Saque solicitado'', app.brl(p_cents) || '' em análise. O prazo é de até 24 horas.'');
  return jsonb_build_object(''id'', w.id, ''status'', w.status);',
    '  if app.auto_withdraw_ok(me.id, p_cents, p_key_type, p_key) is null then
    update public.withdrawals set status = ''processando'', auto = true, provider = ''asaas'' where id = w.id returning * into w;
    perform app.notify(me.id, ''saque'', ''Saque a caminho'', app.brl(p_cents) || '' estão sendo enviados para sua chave Pix.'');
  else
    perform app.notify(me.id, ''saque'', ''Saque solicitado'', app.brl(p_cents) || '' em análise. O prazo é de até 24 horas.'');
  end if;
  return jsonb_build_object(''id'', w.id, ''status'', w.status, ''auto'', w.auto);');
  if v_new = v_src or position('auto_withdraw_ok' in v_new) = 0 then raise exception 'request_withdrawal: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- pagar ou recusar à mão também vale para saque automático que não chegou a ser enviado
  select pg_get_functiondef('public.admin_withdrawal(uuid, boolean, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'if not found or w.status <> ''pendente'' then',
    'if not found or not (w.status = ''pendente'' or (w.status = ''processando'' and w.provider_id is null)) then');
  if v_new = v_src then raise exception 'admin_withdrawal: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- banimento por trapaça: saque ainda não enviado também é recusado
  select pg_get_functiondef('public.admin_case_resolve(uuid, boolean, text, text)'::regprocedure) into v_src;
  v_new := replace(v_src, 'for w in select * from public.withdrawals where user_id = t.id and status = ''pendente'' for update loop',
    'for w in select * from public.withdrawals where user_id = t.id and (status = ''pendente'' or (status = ''processando'' and provider_id is null)) for update loop');
  if v_new = v_src then raise exception 'admin_case_resolve: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- excluir a conta com saque a caminho não pode
  select pg_get_functiondef('public.delete_my_account(boolean)'::regprocedure) into v_src;
  v_new := replace(v_src, 'where user_id = me.id and status = ''pendente'') then', 'where user_id = me.id and status in (''pendente'', ''processando'')) then');
  if v_new = v_src then raise exception 'delete_my_account: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- financeiro do painel: saques em andamento com o estado do envio
  select pg_get_functiondef('public.admin_finance()'::regprocedure) into v_src;
  v_new := replace(v_src, '''verified'', (select ff_status = ''aprovado'' from public.profiles where id = w.user_id), ''created_at'', w.created_at)',
    '''verified'', (select ff_status = ''aprovado'' from public.profiles where id = w.user_id), ''created_at'', w.created_at,
        ''status'', w.status, ''auto'', w.auto, ''sent'', w.provider_id is not null, ''attempts'', w.attempts, ''note'', w.note,
        ''cpf_ok'', exists (select 1 from app.player_docs pd where pd.user_id = w.user_id and w.pix_key_type = ''CPF'' and app.only_digits(w.pix_key) = pd.cpf))');
  v_new := replace(v_new, 'from public.withdrawals w where w.status = ''pendente''), ''[]''),', 'from public.withdrawals w where w.status in (''pendente'', ''processando'')), ''[]''),');
  v_new := replace(v_new, 'from public.withdrawals w where w.status <> ''pendente''', 'from public.withdrawals w where w.status not in (''pendente'', ''processando'')');
  if v_new = v_src then raise exception 'admin_finance: ponto de ajuste não encontrado'; end if;
  execute v_new;

  -- configurações: gateway do depósito e regras do saque automático
  select pg_get_functiondef('public.admin_set_settings(jsonb)'::regprocedure) into v_src;
  v_new := replace(v_src, '    maintenance = coalesce((p ->> ''maintenance'')::boolean, maintenance),',
    '    maintenance = coalesce((p ->> ''maintenance'')::boolean, maintenance),
    deposit_provider = coalesce(p ->> ''deposit_provider'', deposit_provider),
    auto_withdraw = coalesce((p ->> ''auto_withdraw'')::boolean, auto_withdraw),
    auto_withdraw_max_cents = coalesce((p ->> ''auto_withdraw_max_cents'')::bigint, auto_withdraw_max_cents),
    auto_withdraw_daily_cents = coalesce((p ->> ''auto_withdraw_daily_cents'')::bigint, auto_withdraw_daily_cents),
    auto_withdraw_min_days = coalesce((p ->> ''auto_withdraw_min_days'')::int, auto_withdraw_min_days),');
  if v_new = v_src then raise exception 'admin_set_settings: ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

-- me(): o app sabe qual gateway usar e se o jogador já cadastrou o CPF
create or replace function public.my_payment_info() returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare me public.profiles; s public.settings := app.settings(); d app.player_docs;
begin
  me := app.require_user();
  select * into d from app.player_docs where user_id = me.id;
  return jsonb_build_object('deposit_provider', s.deposit_provider, 'cpf', app.cpf_mask(d.cpf), 'has_cpf', d.user_id is not null,
    'min_deposit_cents', s.min_deposit_cents, 'max_deposit_cents', s.max_deposit_cents,
    'auto_withdraw', s.auto_withdraw, 'auto_withdraw_max_cents', s.auto_withdraw_max_cents, 'auto_withdraw_daily_cents', s.auto_withdraw_daily_cents);
end $$;

-- ================================================================ funções do servidor (só as edge functions chamam)
-- depósito: guarda o provedor certo
drop function if exists public.svc_create_deposit(uuid, bigint, text, text, text, timestamptz);
create or replace function public.svc_create_deposit(p_user uuid, p_cents bigint, p_provider_id text, p_qr text, p_qr64 text, p_expires timestamptz, p_provider text default 'mercadopago') returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare s public.settings; d public.deposits;
begin
  perform app.require_service(); s := app.settings();
  if p_cents < s.min_deposit_cents or p_cents > s.max_deposit_cents then perform app.fail('Valor fora dos limites de depósito.'); end if;
  if p_provider not in ('mercadopago', 'asaas') then perform app.fail('Gateway inválido.'); end if;
  insert into public.deposits (user_id, amount_cents, provider, provider_id, qr_code, qr_base64, expires_at)
  values (p_user, p_cents, p_provider, p_provider_id, p_qr, p_qr64, p_expires) returning * into d;
  return jsonb_build_object('id', d.id, 'amount_cents', d.amount_cents, 'status', d.status, 'qr_code', d.qr_code, 'qr_base64', d.qr_base64, 'expires_at', d.expires_at, 'provider', p_provider);
end $$;

-- cliente do jogador no Asaas (CPF e código do cliente)
create or replace function public.svc_payer(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; d app.player_docs; v_email text;
begin
  perform app.require_service();
  select * into me from public.profiles where id = p_user;
  if not found then perform app.fail('Conta não encontrada.'); end if;
  select * into d from app.player_docs where user_id = p_user;
  select email into v_email from auth.users where id = p_user;
  return jsonb_build_object('user_id', me.id, 'nick', me.nick, 'email', v_email, 'banned', exists (select 1 from public.bans b where b.user_id = me.id and (b.until is null or b.until > now())),
    'cpf', d.cpf, 'customer', d.asaas_customer);
end $$;

create or replace function public.svc_set_payer(p_user uuid, p_cpf text, p_customer text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_cpf text := app.only_digits(p_cpf); d app.player_docs;
begin
  perform app.require_service();
  if not app.cpf_valid(v_cpf) then perform app.fail('CPF inválido. Confira os números.'); end if;
  select * into d from app.player_docs where user_id = p_user;
  if found and d.cpf <> v_cpf then perform app.fail('Sua conta já tem um CPF cadastrado. Para trocar, fale com o suporte.'); end if;
  if exists (select 1 from app.player_docs where cpf = v_cpf and user_id <> p_user) then perform app.fail('Esse CPF já está em outra conta do BattleHub.'); end if;
  insert into app.player_docs (user_id, cpf, asaas_customer) values (p_user, v_cpf, p_customer)
  on conflict (user_id) do update set asaas_customer = coalesce(excluded.asaas_customer, player_docs.asaas_customer), updated_at = now();
  return jsonb_build_object('ok', true, 'cpf', app.cpf_mask(v_cpf));
end $$;

-- depósito confirmado pelo Asaas (o valor vem da consulta direta na API)
create or replace function public.svc_settle_deposit_asaas(p_provider_id text, p_status text, p_amount_cents bigint) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.deposits;
begin
  perform app.require_service();
  select * into d from public.deposits where provider_id = p_provider_id and provider = 'asaas' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'desconhecido'); end if;
  if d.status <> 'pendente' then return jsonb_build_object('ok', true, 'status', d.status); end if;
  if p_status in ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH') then
    if p_amount_cents is not null and p_amount_cents < d.amount_cents then
      update public.deposits set note = 'Valor pago menor que o esperado: ' || app.brl(p_amount_cents) where id = d.id;
      return jsonb_build_object('ok', false, 'reason', 'valor');
    end if;
    perform app.approve_deposit(d, 'Confirmado pelo Asaas');
  elsif p_status in ('REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'DELETED') then
    update public.deposits set status = 'recusado', note = 'Pagamento ' || lower(p_status), reviewed_at = now() where id = d.id;
  elsif p_status = 'OVERDUE' then
    update public.deposits set status = 'expirado', reviewed_at = now() where id = d.id;
  end if;
  return jsonb_build_object('ok', true, 'status', (select status from public.deposits where id = d.id));
end $$;

-- pega o saque para enviar (uma vez só: quem pegou marca a tentativa)
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
    'nick', (select nick from public.profiles where id = w.user_id));
end $$;

create or replace function public.svc_withdrawal_sent(p_id uuid, p_provider_id text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_service();
  update public.withdrawals set provider_id = p_provider_id, provider = 'asaas' where id = p_id and status = 'processando';
  return jsonb_build_object('ok', found);
end $$;

-- o Asaas pergunta antes de cada transferência: só aprova o que está na fila, com o mesmo valor e a mesma chave
create or replace function public.svc_withdrawal_validate(p_ref text, p_cents bigint, p_key text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare w public.withdrawals;
begin
  perform app.require_service();
  begin
    select * into w from public.withdrawals where id = p_ref::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'reason', 'Transferência sem saque do BattleHub.');
  end;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Transferência sem saque do BattleHub.'); end if;
  if w.status <> 'processando' then return jsonb_build_object('ok', false, 'reason', 'Saque não está liberado para envio.'); end if;
  if w.amount_cents <> p_cents then return jsonb_build_object('ok', false, 'reason', 'Valor diferente do saque pedido.'); end if;
  if p_key is not null and lower(app.only_digits(p_key)) <> lower(app.only_digits(w.pix_key)) and lower(btrim(p_key)) <> lower(btrim(w.pix_key)) then
    return jsonb_build_object('ok', false, 'reason', 'Chave Pix diferente da pedida.');
  end if;
  if exists (select 1 from public.cheat_cases where suspect_id = w.user_id and status in ('aguardando_video', 'em_analise')) then
    return jsonb_build_object('ok', false, 'reason', 'Jogador em análise de trapaça.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- resultado da transferência: pago, ou volta para a fila da equipe (o dinheiro continua reservado)
create or replace function public.svc_withdrawal_settle(p_provider_id text, p_status text, p_ref text default null, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare w public.withdrawals;
begin
  perform app.require_service();
  select * into w from public.withdrawals where provider_id = p_provider_id for update;
  if not found and p_ref is not null then
    begin select * into w from public.withdrawals where id = p_ref::uuid for update; exception when invalid_text_representation then null; end;
  end if;
  if w.id is null then return jsonb_build_object('ok', false, 'reason', 'desconhecido'); end if;
  if w.status <> 'processando' then return jsonb_build_object('ok', true, 'status', w.status); end if;
  if p_status = 'DONE' then
    update public.wallets set held_cents = held_cents - w.amount_cents where user_id = w.user_id;
    update public.withdrawals set status = 'pago', provider_id = coalesce(provider_id, p_provider_id), note = 'Pago pelo Asaas', reviewed_at = now() where id = w.id;
    perform app.notify(w.user_id, 'saque', 'Saque pago', app.brl(w.amount_cents) || ' enviados para sua chave Pix.');
    perform app.log('Saque automático pago', (select nick from public.profiles where id = w.user_id), app.brl(w.amount_cents));
  elsif p_status in ('FAILED', 'CANCELLED', 'REFUSED', 'ERROR') then
    update public.withdrawals set status = 'pendente', provider_id = null, note = 'Envio automático não concluído: ' || coalesce(nullif(btrim(p_reason), ''), lower(p_status)) || '. A equipe vai conferir.' where id = w.id;
    perform app.log('Saque automático voltou para a fila', (select nick from public.profiles where id = w.user_id), app.brl(w.amount_cents) || ' · ' || coalesce(p_reason, p_status));
  end if;
  return jsonb_build_object('ok', true, 'status', (select status from public.withdrawals where id = w.id));
end $$;

-- painel: mandar um saque da fila pelo Asaas
create or replace function public.admin_withdrawal_send(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare me public.profiles; w public.withdrawals;
begin
  me := app.require_level(2);
  select * into w from public.withdrawals where id = p_id for update;
  if not found then perform app.fail('Saque não encontrado.'); end if;
  if w.status = 'processando' and w.provider_id is null then
    update public.withdrawals set sent_at = null where id = w.id;
  elsif w.status <> 'pendente' then perform app.fail('Esse saque já foi resolvido.');
  else
    if exists (select 1 from public.cheat_cases where suspect_id = w.user_id and status in ('aguardando_video', 'em_analise')) then
      perform app.fail('Esse jogador está em análise de trapaça. Resolva a análise antes de pagar o saque.');
    end if;
    update public.withdrawals set status = 'processando', provider = 'asaas', sent_at = null, note = null where id = w.id;
  end if;
  perform app.log('Mandou saque pelo Asaas', (select nick from public.profiles where id = w.user_id), app.brl(w.amount_cents));
  return jsonb_build_object('ok', true, 'id', w.id);
end $$;

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
grant execute on function app.in_thread(uuid, uuid) to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.svc_message_previews(bigint[]) from authenticated;
grant execute on function public.clear_push_token(text) to anon;
