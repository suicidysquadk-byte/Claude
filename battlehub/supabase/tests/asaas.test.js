// Testa o gateway Asaas de ponta a ponta com um Asaas falso: CPF, depósito por Pix, aviso de pagamento (sem confiar
// no conteúdo do aviso), saque automático com limites, validação de cada transferência e volta para a fila quando falha.
// Uso: tests/reset.sh e depois  node --experimental-strip-types supabase/tests/asaas.test.js
const path = require('path');
const H = require('./_util')();
const { db, call, svc, ok, must, refuse, q1, count, mk } = H;

// ---------------- Asaas falso (responde como a API v3) ----------------
const A = { customers: [], payments: {}, transfers: {}, seq: 0, failTransfer: null, calls: [] };
const res = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
async function fakeFetch(url, init) {
  const u = new URL(url), m = (init && init.method) || 'GET', body = init && init.body ? JSON.parse(init.body) : null;
  A.calls.push(m + ' ' + u.pathname);
  if (init.headers.access_token !== 'chave-sandbox') return res(401, { errors: [{ description: 'Chave inválida' }] });
  const p = u.pathname.replace(/^\/v3/, '');
  let mm;
  if (m === 'POST' && p === '/customers') { const c = { id: 'cus_' + (++A.seq), ...body }; A.customers.push(c); return res(200, c); }
  if (m === 'POST' && p === '/payments') { const x = { id: 'pay_' + (++A.seq), status: 'PENDING', ...body }; A.payments[x.id] = x; return res(200, x); }
  if ((mm = p.match(/^\/payments\/([^/]+)\/pixQrCode$/))) return res(200, { encodedImage: 'iVBOR', payload: '00020126PIX' + mm[1], expirationDate: '2099-01-01 23:59:59' });
  if ((mm = p.match(/^\/payments\/([^/]+)$/))) return A.payments[mm[1]] ? res(200, A.payments[mm[1]]) : res(404, { errors: [{ description: 'não encontrada' }] });
  if (m === 'POST' && p === '/transfers') {
    if (A.failTransfer) return res(400, { errors: [{ description: A.failTransfer }] });
    const t = { id: 'tra_' + (++A.seq), status: 'PENDING', ...body }; A.transfers[t.id] = t; return res(200, t);
  }
  if ((mm = p.match(/^\/transfers\/([^/]+)$/))) return A.transfers[mm[1]] ? res(200, A.transfers[mm[1]]) : res(404, {});
  return res(404, { errors: [{ description: 'rota falsa não existe: ' + m + ' ' + p }] });
}
const ENV = { ASAAS_API_KEY: 'chave-sandbox', ASAAS_API_URL: 'https://asaas.falso/v3', ASAAS_WEBHOOK_TOKEN: 'token-do-webhook-123' };
const deps = { env: (n) => ENV[n], fetch: fakeFetch, rpc: (fn, args) => svc(fn, args) };

H.run(async () => {
  const S = await import(path.join(__dirname, '..', 'functions', '_shared', 'asaas.ts'));
  const dono = await mk('dono@bh.gg'), A1 = await mk('a@bh.gg'), B = await mk('b@bh.gg');
  for (const [u, n] of [[dono, 'Dono'], [A1, 'Alfa'], [B, 'Beta']]) await call(u, 'complete_onboarding', { p_nick: n, p_ff_nick: n, p_ff_id: String(800000000 + n.charCodeAt(0)), p_photo_path: u + '/ff.jpg' });
  await db.query("update profiles set ff_status = 'aprovado', created_at = now() - interval '30 days'");
  await call(dono, 'admin_set_settings', { p: { deposit_provider: 'asaas' } });
  const info = await must('my_payment_info', call(A1, 'my_payment_info', {}));
  ok(info && info.deposit_provider === 'asaas' && !info.has_cpf, 'app sabe que o depósito é pelo Asaas e que falta CPF', info);

  // ---------------- depósito
  await refuse('sem CPF pede o CPF', S.createDeposit(deps, A1, 2000), /cpf_necessario/);
  await refuse('CPF inválido', S.createDeposit(deps, A1, 2000, '123.456.789-00'), /CPF inválido/);
  const dep = await must('gera Pix no Asaas', S.createDeposit(deps, A1, 2000, '529.982.247-25'));
  ok(dep && dep.provider === 'asaas' && /^00020126PIX/.test(dep.qr_code) && dep.qr_base64, 'Pix com copia e cola e QR', dep);
  ok(A.customers.length === 1 && A.customers[0].cpfCnpj === '52998224725', 'cliente criado no Asaas com o CPF');
  const dep2 = await must('segundo depósito reaproveita o cliente', S.createDeposit(deps, A1, 3000));
  ok(A.customers.length === 1 && dep2, 'não cria cliente de novo');
  ok((await call(A1, 'my_payment_info', {})).cpf === '***.982.247-**', 'CPF aparece mascarado');
  await refuse('mesmo CPF em outra conta', S.createDeposit(deps, B, 2000, '52998224725'), /outra conta/);
  ok((await count("select count(*) n from public.deposits where provider = 'asaas' and status = 'pendente'")) === 2, 'dois depósitos pendentes');

  const bal = async (u) => Number((await q1('select balance_cents b from wallets where user_id = $1', [u])).b);
  const payId = Object.keys(A.payments)[0];
  // aviso falso: diz que pagou, mas na API ainda está pendente → não credita
  await S.handleWebhook(deps, { event: 'PAYMENT_RECEIVED', payment: { id: payId, status: 'RECEIVED', value: 20 } });
  ok((await bal(A1)) === 0, 'aviso sem pagamento de verdade não credita');
  A.payments[payId].status = 'RECEIVED';
  await must('aviso de pagamento', S.handleWebhook(deps, { event: 'PAYMENT_RECEIVED', payment: { id: payId } }));
  ok((await bal(A1)) === 2000, 'saldo entrou', await bal(A1));
  await S.handleWebhook(deps, { event: 'PAYMENT_CONFIRMED', payment: { id: payId } });
  ok((await bal(A1)) === 2000, 'aviso repetido não credita duas vezes');
  const pay2 = Object.keys(A.payments)[1];
  A.payments[pay2].status = 'OVERDUE';
  await S.handleWebhook(deps, { event: 'PAYMENT_OVERDUE', payment: { id: pay2 } });
  ok((await q1('select status from deposits where provider_id = $1', [pay2])).status === 'expirado', 'Pix vencido expira');
  ok(S.tokenOk(deps, 'token-do-webhook-123') && !S.tokenOk(deps, 'errado') && !S.tokenOk(deps, null), 'confere o token do aviso');

  // mais saldo para os saques
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: dono })]);
  await db.query("select app.credit($1, 100000, 'ajuste', 'teste')", [A1]);

  // ---------------- saque automático
  let w = await must('saque com automático desligado', call(A1, 'request_withdrawal', { p_cents: 5000, p_key_type: 'CPF', p_key: '529.982.247-25' }));
  ok(w && w.status === 'pendente' && !w.auto, 'desligado: vai para a fila da equipe', w);
  await call(dono, 'admin_withdrawal', { p_id: w.id, p_paid: false, p_note: 'teste' });
  await call(dono, 'admin_set_settings', { p: { auto_withdraw: true, auto_withdraw_max_cents: 20000, auto_withdraw_daily_cents: 30000, auto_withdraw_min_days: 3 } });
  w = await must('saque automático', call(A1, 'request_withdrawal', { p_cents: 15000, p_key_type: 'CPF', p_key: '52998224725' }));
  ok(w && w.status === 'processando' && w.auto, 'dentro da regra: sai sozinho', w);
  await refuse('um saque por vez', call(A1, 'request_withdrawal', { p_cents: 1000, p_key_type: 'CPF', p_key: '52998224725' }), /em andamento/);
  await refuse('não exclui a conta com saque a caminho', call(A1, 'delete_my_account', { p_forfeit: true }), /saque/);
  await refuse('outro jogador não manda meu saque', S.sendWithdrawal(deps, w.id, B).then((r) => { if (!r.ok) throw new Error(r.reason); }), /nao_encontrado/);
  const sent = await must('envia pelo Asaas', S.sendWithdrawal(deps, w.id, A1));
  ok(sent && sent.ok && sent.provider_id, 'transferência criada', sent);
  const tr = A.transfers[sent.provider_id];
  ok(tr && tr.value === 150 && tr.pixAddressKey === '52998224725' && tr.pixAddressKeyType === 'CPF' && tr.externalReference === w.id, 'transferência com valor, chave e referência certos', tr);
  const again = await S.sendWithdrawal(deps, w.id, A1);
  ok(!again.ok && again.reason === 'ja_enviado' && Object.keys(A.transfers).length === 1, 'não envia duas vezes', again);

  // validação: o Asaas pergunta antes de a transferência sair
  const v1 = await S.validateTransfer(deps, { type: 'TRANSFER', transfer: { value: 150, externalReference: w.id, bankAccount: { pixAddressKey: '52998224725' } } });
  ok(v1.status === 'APPROVED', 'aprova a transferência do saque', v1);
  const v2 = await S.validateTransfer(deps, { type: 'TRANSFER', transfer: { value: 999, externalReference: w.id } });
  ok(v2.status === 'REFUSED' && /Valor/.test(v2.refuseReason), 'recusa valor diferente', v2);
  const v3 = await S.validateTransfer(deps, { type: 'TRANSFER', transfer: { value: 150, externalReference: w.id, bankAccount: { pixAddressKey: '11122233344' } } });
  ok(v3.status === 'REFUSED' && /Chave/.test(v3.refuseReason), 'recusa chave diferente', v3);
  const v4 = await S.validateTransfer(deps, { type: 'TRANSFER', transfer: { value: 150, externalReference: 'qualquer-coisa' } });
  ok(v4.status === 'REFUSED', 'recusa transferência que não é do BattleHub', v4);
  const v5 = await S.validateTransfer(deps, { type: 'BILL', bill: {} });
  ok(v5.status === 'REFUSED', 'recusa pagamento de conta', v5);

  // concluída
  const held = async (u) => Number((await q1('select held_cents h from wallets where user_id = $1', [u])).h);
  ok((await held(A1)) === 15000, 'valor reservado enquanto envia');
  tr.status = 'DONE';
  await must('aviso de transferência concluída', S.handleWebhook(deps, { event: 'TRANSFER_DONE', transfer: { id: tr.id } }));
  ok((await q1('select status from withdrawals where id = $1', [w.id])).status === 'pago' && (await held(A1)) === 0, 'saque pago e reserva liberada');
  ok((await count("select count(*) n from notifications where user_id = $1 and title = 'Saque pago'", [A1])) === 1, 'jogador avisado');
  const v6 = await S.validateTransfer(deps, { type: 'TRANSFER', transfer: { value: 150, externalReference: w.id } });
  ok(v6.status === 'REFUSED', 'saque já pago não é aprovado de novo');

  // regras que mandam para a fila
  w = await call(A1, 'request_withdrawal', { p_cents: 20000, p_key_type: 'CPF', p_key: '52998224725' });
  ok(w.status === 'pendente', 'limite do dia (150 + 200 > 300) vai para a fila', w);
  await call(dono, 'admin_withdrawal', { p_id: w.id, p_paid: false, p_note: 'teste' });
  w = await call(A1, 'request_withdrawal', { p_cents: 5000, p_key_type: 'E-mail', p_key: 'a@bh.gg' });
  ok(w.status === 'pendente', 'chave que não é o CPF do jogador vai para a fila', w);

  // painel manda pelo Asaas; o Asaas recusa → volta para a fila com o motivo, dinheiro continua reservado
  await must('painel manda pelo Asaas', call(dono, 'admin_withdrawal_send', { p_id: w.id }));
  A.failTransfer = 'Saldo insuficiente na conta';
  const f = await S.sendWithdrawal(deps, w.id, null);
  ok(!f.ok && f.reason === 'erro', 'falha no envio', f);
  let row = await q1('select status, note from withdrawals where id = $1', [w.id]);
  ok(row.status === 'pendente' && /Saldo insuficiente/.test(row.note) && (await held(A1)) === 5000, 'voltou para a fila com o motivo', row);
  A.failTransfer = null;
  await call(dono, 'admin_withdrawal_send', { p_id: w.id });
  const s2 = await S.sendWithdrawal(deps, w.id, null);
  A.transfers[s2.provider_id].status = 'FAILED'; A.transfers[s2.provider_id].failReason = 'Chave Pix não encontrada';
  await S.handleWebhook(deps, { event: 'TRANSFER_FAILED', transfer: { id: s2.provider_id } });
  row = await q1('select status, note, provider_id from withdrawals where id = $1', [w.id]);
  ok(row.status === 'pendente' && /Chave Pix não encontrada/.test(row.note) && !row.provider_id, 'transferência que falhou volta para a fila', row);
  await must('equipe recusa e estorna', call(dono, 'admin_withdrawal', { p_id: w.id, p_paid: false, p_note: 'chave errada' }));
  ok((await held(A1)) === 0, 'estornado');
  await refuse('jogador não usa o botão do painel', call(A1, 'admin_withdrawal_send', { p_id: w.id }), /permiss|acesso|equipe/i);

  // painel vê o estado do envio
  const w3 = await call(A1, 'request_withdrawal', { p_cents: 1000, p_key_type: 'CPF', p_key: '52998224725' });
  const fin = await call(dono, 'admin_finance', {});
  const pw = fin.pending_withdrawals.find((x) => x.id === w3.id);
  ok(pw && pw.status === 'processando' && pw.auto && pw.cpf_ok && !pw.sent, 'painel mostra saque automático ainda não enviado', pw);
  await must('equipe pode pagar à mão o que não foi enviado', call(dono, 'admin_withdrawal', { p_id: w3.id, p_paid: true, p_note: null }));

  // serviço protegido
  await refuse('jogador não chama função de serviço', call(A1, 'svc_withdrawal_settle', { p_provider_id: 'x', p_status: 'DONE' }), /.+/);
  ok(A.calls.every((c) => !/undefined/.test(c)), 'chamadas ao Asaas bem formadas');
});
