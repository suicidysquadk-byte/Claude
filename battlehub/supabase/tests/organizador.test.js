// Testa o organizador jogando a própria sala: paga a inscrição, ganha o prêmio, aparece para todos e fica na auditoria.
// Uso: tests/reset.sh e depois  node supabase/tests/organizador.test.js
const H = require('./_util')();
const { call, ok, must, refuse, q1, count, mk } = H;
const bal = async (u) => Number((await q1('select balance_cents b from wallets where user_id = $1', [u])).b);

H.run(async () => {
  const dono = await mk('dono@bh.gg'), org = await mk('org@bh.gg'), mod = await mk('mod@bh.gg');
  const P = [];
  for (let i = 1; i <= 3; i++) P.push(await mk('p' + i + '@bh.gg'));
  const all = [dono, org, mod, ...P];
  for (let i = 0; i < all.length; i++) await call(all[i], 'complete_onboarding', { p_nick: 'Conta' + i, p_ff_nick: 'FF' + i, p_ff_id: String(500000000 + i), p_photo_path: all[i] + '/ff.jpg' });
  await H.db.query("update profiles set ff_status = 'aprovado'");
  await call(dono, 'admin_set_role', { p_user: mod, p_role: 'moderador' });
  await call(dono, 'admin_set_settings', { p: { pix_key: 'pix@bh.gg' } });
  for (const u of [dono, org, mod, ...P]) { const d = await call(u, 'request_manual_deposit', { p_cents: 5000 }); await call(dono, 'admin_deposit', { p_id: d.id, p_approve: true, p_note: null }); }
  await call(dono, 'admin_set_creator', { p_user: org, p_value: true });
  const start = new Date(Date.now() + 3600e3).toISOString();

  // organizador comum
  const r = await must('organizador cria a sala', call(org, 'create_room', { p: { title: 'Sala do Org', max_players: 4, entry_cents: 1000, starts_at: start, prizes: [{ place: 1, cents: 2400 }] } }));
  const b0 = await bal(org);
  const j = await must('organizador entra na própria sala', call(org, 'join_room', { p_id: r.id }));
  ok(j && j.status === 'inscrito', 'inscrito como jogador');
  ok((await bal(org)) === b0 - 1000, 'paga a inscrição do próprio saldo');
  for (const u of P) await call(u, 'join_room', { p_id: r.id });
  const g = await call(P[0], 'get_room', { p_id: r.id });
  ok(g.creator_plays === true, 'jogadores veem que o organizador está jogando');
  ok(await count("select count(*) n from audit_log where action = 'Organizador entrou para jogar a própria sala'") === 1, 'entrada fica na auditoria');
  await refuse('não entra duas vezes', call(org, 'join_room', { p_id: r.id }), /já está inscrito/);
  await must('inicia', call(org, 'start_room', { p_id: r.id, p_game_room_id: '1', p_password: 'a' }));
  const b1 = await bal(org);
  await must('finaliza com o organizador em 1º', call(org, 'finish_room', { p_id: r.id, p_results: { players: [org, ...P].map((u, i) => ({ user_id: u, kills: i === 0 ? 3 : 0, placement: i + 1 })) } }));
  const won = (await bal(org)) - b1;
  ok(won >= 2400, 'prêmio do 1º lugar cai na carteira do organizador (mais a sobra do cofre)', won);
  const log = await q1("select detail from audit_log where action = 'Organizador jogou e finalizou a própria sala'");
  ok(log && /colocação 1/.test(log.detail) && /3 abates/.test(log.detail) && /ganhou R\$ 24,00/.test(log.detail), 'resultado do organizador fica na auditoria', log);

  // sala oficial: o dono e um moderador também jogam
  const ro = await must('sala oficial', call(dono, 'create_room', { p: { title: 'Oficial', max_players: 4, entry_cents: 500, starts_at: start, official: true, prizes: [{ place: 1, cents: 1000 }] } }));
  await must('dono entra na sala oficial', call(dono, 'join_room', { p_id: ro.id }));
  await must('moderador entra na sala oficial', call(mod, 'join_room', { p_id: ro.id }));
  ok((await call(P[1], 'get_room', { p_id: ro.id })).creator_plays === true, 'oficial mostra que quem criou está jogando');
  const s = await call(P[1], 'get_room', { p_id: r.id });
  ok(s.creator_plays === true && s.status === 'finalizada', 'aviso continua na sala finalizada');
});
