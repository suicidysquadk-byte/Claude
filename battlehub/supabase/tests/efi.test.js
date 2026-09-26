// Testa o segundo gateway, Efí Bank, com um Efí falso: token OAuth, cobrança Pix no CPF do jogador, aviso conferido
// na API, envio de Pix com conferência do CPF do favorecido, envio que falha volta para a fila e a escolha no painel.
// Uso: tests/reset.sh e depois  node --experimental-strip-types supabase/tests/efi.test.js
const path = require('path');
const H = require('./_util')();
const { db, call, svc, ok, must, refuse, q1, count, mk } = H;

// ---------------- Efí falso ----------------
const E = { cobs: {}, envios: {}, tokens: 0, webhook: null, calls: [], failSend: null };
const res = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
async function fakeFetch(url, init) {
  const u = new URL(url), m = init.method || 'GET', body = init.body ? JSON.parse(init.body) : null, h = init.headers || {};
  E.calls.push(m + ' ' + u.pathname);
  if (u.pathname === '/oauth/token') {
    if (h.Authorization !== 'Basic ' + Buffer.from('cid:csecret').toString('base64')) return res(401, { error_description: 'credenciais' });
    E.tokens++; return res(200, { access_token: 'tok' + E.tokens, expires_in: 3600 });
  }
  if (!/^Bearer tok\d+$/.test(h.Authorization || '')) return res(401, { mensagem: 'sem token' });
  let mm;
  if ((mm = u.pathname.match(/^\/v2\/cob\/(\w+)$/))) {
    if (m === 'PUT') {
      if (!/^[a-zA-Z0-9]{26,35}$/.test(mm[1])) return res(400, { mensagem: 'txid inválido' });
      const c = { txid: mm[1], status: 'ATIVA', loc: { id: 7 }, pixCopiaECola: '00020101EFI' + mm[1], ...body }; E.cobs[mm[1]] = c; return res(201, c);
    }
    return E.cobs[mm[1]] ? res(200, E.cobs[mm[1]]) : res(404, { mensagem: 'não encontrada' });
  }
  if (u.pathname === '/v2/loc/7/qrcode') return res(200, { qrcode: '00020101EFI', imagemQrcode: 'data:image/png;base64,iVBORefi' });
  if ((mm = u.pathname.match(/^\/v3\/gn\/pix\/(\w+)$/)) && m === 'PUT') {
    if (E.failSend) return res(422, { mensagem: E.failSend });
    const cpfOk = !body.favorecido.cpf || body.favorecido.cpf === E.keyOwners[body.favorecido.chave];
    const t = { idEnvio: mm[1], valor: body.valor, status: cpfOk ? 'EM_PROCESSAMENTO' : 'NAO_REALIZADO', body }; E.envios[mm[1]] = t; return res(201, t);
  }
  if ((mm = u.pathname.match(/^\/v2\/gn\/pix\/enviados\/id-envio\/(\w+)$/))) return E.envios[mm[1]] ? res(200, E.envios[mm[1]]) : res(404, {});
  if ((mm = u.pathname.match(/^\/v2\/webhook\/(.+)$/)) && m === 'PUT') { E.webhook = { chave: decodeURIComponent(mm[1]), ...body, skip: h['x-skip-mtls-checking'] }; return res(200, E.webhook); }
  return res(404, { mensagem: 'rota falsa não existe: ' + m + ' ' + u.pathname });
}
E.keyOwners = { '52998224725': '52998224725', 'b@bh.gg': '11144477735' };
const ENV = { EFI_CLIENT_ID: 'cid', EFI_CLIENT_SECRET: 'csecret', EFI_PIX_KEY: 'pix@battlehub.gg', EFI_API_URL: 'https://efi.falso', EFI_WEBHOOK_TOKEN: 'tok-efi-seguro-123' };
const deps = { env: (n) => ENV[n], fetch: fakeFetch, rpc: (fn, args) => svc(fn, args) };

H.run(async () => {
  const S = await import(path.join(__dirname, '..', 'functions', '_shared', 'efi.ts'));
  const dono = await mk('dono@bh.gg'), A1 = await mk('a@bh.gg'), B = await mk('b@bh.gg');
  for (const [u, n] of [[dono, 'Dono'], [A1, 'Alfa'], [B, 'Beta']]) await call(u, 'complete_onboarding', { p_nick: n, p_ff_nick: n, p_ff_id: String(800000000 + n.charCodeAt(0)), p_photo_path: u + '/ff.jpg' });
  await db.query("update profiles set ff_status = 'aprovado', created_at = now() - interval '30 days'");
  await must('painel escolhe o Efí', call(dono, 'admin_set_settings', { p: { deposit_provider: 'efi', payout_provider: 'efi', auto_withdraw: true } }));
  ok((await q1('select deposit_provider, payout_provider from settings')).payout_provider === 'efi', 'configuração salva');
  await refuse('gateway que não existe', call(dono, 'admin_set_settings', { p: { payout_provider: 'banco-x' } }), /check|viola|payout/i);
  ok(S.efiReady(deps) && !S.efiReady({ env: () => undefined }), 'sabe quando o Efí está configurado');

  // ---------------- depósito
  await refuse('sem CPF pede o CPF', S.createDeposit(deps, A1, 2000), /cpf_necessario/);
  const dep = await must('cobrança Pix no Efí', S.createDeposit(deps, A1, 2000, '529.982.247-25'));
  ok(dep && dep.provider === 'efi' && /^00020101EFI/.test(dep.qr_code) && dep.qr_base64 === 'iVBORefi', 'copia e cola e QR', dep);
  const txid = Object.keys(E.cobs)[0], cob = E.cobs[txid];
  ok(cob.devedor.cpf === '52998224725' && cob.valor.original === '20.00' && cob.chave === 'pix@battlehub.gg' && cob.calendario.expiracao === 3600, 'cobrança no CPF do jogador, valor e chave da plataforma', cob);
  ok(E.tokens === 1, 'token reaproveitado entre chamadas', E.tokens);
  const bal = async (u) => Number((await q1('select balance_cents b from wallets where user_id = $1', [u])).b);
  await S.handleWebhook(deps, { pix: [{ txid, valor: '20.00' }] });
  ok((await bal(A1)) === 0, 'aviso sem pagamento de verdade não credita');
  cob.status = 'CONCLUIDA'; cob.pix = [{ endToEndId: 'E1', valor: '20.00' }];
  await must('aviso de Pix recebido', S.handleWebhook(deps, { pix: [{ txid, valor: '20.00' }] }));
  ok((await bal(A1)) === 2000, 'saldo entrou', await bal(A1));
  await S.handleWebhook(deps, { pix: [{ txid }] });
  ok((await bal(A1)) === 2000, 'aviso repetido não credita duas vezes');
  const dep2 = await S.createDeposit(deps, A1, 5000);
  const cob2 = E.cobs[Object.keys(E.cobs)[1]]; cob2.status = 'CONCLUIDA'; cob2.pix = [{ valor: '10.00' }];
  await S.handleWebhook(deps, { pix: [{ txid: cob2.txid }] });
  ok((await bal(A1)) === 2000 && /menor/.test((await q1('select note from deposits where id = $1', [dep2.id])).note), 'pagou menos: não credita e anota');
  ok(S.tokenOk(deps, 'tok-efi-seguro-123') && !S.tokenOk(deps, 'x'), 'confere o token do aviso');

  // ---------------- saque automático pelo Efí
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: dono })]);
  await db.query("select app.credit($1, 50000, 'ajuste', 'teste')", [A1]);
  let w = await must('saque automático', call(A1, 'request_withdrawal', { p_cents: 15000, p_key_type: 'CPF', p_key: '529.982.247-25' }));
  ok(w && w.status === 'processando' && (await q1('select provider from withdrawals where id = $1', [w.id])).provider === 'efi', 'vai pelo Efí', w);
  const s1 = await must('envia Pix pelo Efí', S.sendWithdrawal(deps, w.id, A1));
  const env1 = E.envios[s1.provider_id];
  ok(env1 && env1.body.valor === '150.00' && env1.body.favorecido.chave === '52998224725' && env1.body.favorecido.cpf === '52998224725' && env1.body.pagador.chave === 'pix@battlehub.gg', 'valor, chave, CPF do favorecido e pagador certos', env1 && env1.body);
  ok(/^[a-zA-Z0-9]{1,35}$/.test(s1.provider_id), 'idEnvio no formato do Efí');
  ok(!(await S.sendWithdrawal(deps, w.id, A1)).ok, 'não envia duas vezes');
  env1.status = 'REALIZADO';
  await must('aviso do Pix enviado', S.handleWebhook(deps, { pix: [{ gnExtras: { idEnvio: s1.provider_id } }] }));
  ok((await q1('select status from withdrawals where id = $1', [w.id])).status === 'pago', 'saque pago');

  // chave de outra pessoa: o Efí recusa (CPF do favorecido não bate) → volta para a fila
  w = await call(A1, 'request_withdrawal', { p_cents: 3000, p_key_type: 'E-mail', p_key: 'b@bh.gg' });
  ok(w.status === 'pendente', 'chave que não é o CPF do jogador fica na fila', w);
  await must('equipe manda pelo gateway', call(dono, 'admin_withdrawal_send', { p_id: w.id }));
  const s2 = await S.sendWithdrawal(deps, w.id, null);
  const row = await q1('select status, note from withdrawals where id = $1', [w.id]);
  ok(s2.ok && s2.status === 'NAO_REALIZADO' && row.status === 'pendente' && /não realizado/.test(row.note), 'Efí recusou a chave de outro CPF e o saque voltou para a fila', { s2, row });

  // envio que dá erro na API
  await call(dono, 'admin_withdrawal_send', { p_id: w.id });
  E.failSend = 'Saldo insuficiente';
  const s3 = await S.sendWithdrawal(deps, w.id, null);
  ok(!s3.ok && /Saldo insuficiente/.test((await q1('select note from withdrawals where id = $1', [w.id])).note), 'erro volta para a fila com o motivo');
  E.failSend = null;
  await must('recusa e estorna', call(dono, 'admin_withdrawal', { p_id: w.id, p_paid: false, p_note: 'chave de terceiro' }));

  // envio pendente conferido de carona no próximo aviso
  w = await call(A1, 'request_withdrawal', { p_cents: 2000, p_key_type: 'CPF', p_key: '52998224725' });
  const s4 = await S.sendWithdrawal(deps, w.id, A1);
  E.envios[s4.provider_id].status = 'REALIZADO';
  await S.handleWebhook(deps, { pix: [] });
  ok((await q1('select status from withdrawals where id = $1', [w.id])).status === 'pago', 'envios pendentes são conferidos a cada aviso');

  // cadastro do aviso
  const reg = await must('cadastra o webhook no Efí', S.registerWebhook(deps, 'https://x.supabase.co/functions/v1/efi-webhook'));
  ok(E.webhook && E.webhook.chave === 'pix@battlehub.gg' && E.webhook.webhookUrl === 'https://x.supabase.co/functions/v1/efi-webhook?t=tok-efi-seguro-123&ignorar=' && E.webhook.skip === 'true', 'endereço com token e sem exigir mTLS no aviso', E.webhook);
  void reg;

  // o Asaas continua funcionando junto: saque feito com o Asaas mantém o provedor
  await call(dono, 'admin_set_settings', { p: { payout_provider: 'asaas' } });
  w = await call(A1, 'request_withdrawal', { p_cents: 1000, p_key_type: 'CPF', p_key: '52998224725' });
  ok((await q1('select provider from withdrawals where id = $1', [w.id])).provider === 'asaas', 'trocar no painel passa a usar o outro gateway');
  const fin = await call(dono, 'admin_finance', {});
  ok(fin.pending_withdrawals.some((x) => x.id === w.id && x.provider === 'asaas'), 'painel mostra o gateway do saque');
  ok(E.calls.every((c) => !/undefined|null/.test(c)), 'chamadas bem formadas', E.calls.filter((c) => /undefined|null/.test(c)));
});
