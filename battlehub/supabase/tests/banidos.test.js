// Testa a verificação do aparelho, a recusa (ban permanente com bloqueios) e a aba de banidos (3 jeitos de liberar).
// Uso: tests/reset.sh e depois  node supabase/tests/banidos.test.js
const H = require('./_util')();
const { db, call, ok, must, refuse, q1, count, mk } = H;

async function conservation(label) {
  const r = await q1(`select
      (select coalesce(sum(balance_cents + held_cents), 0) from wallets) w,
      (select coalesce(sum(vault_cents), 0) from rooms where status in ('aberta','em_andamento')) rv,
      (select coalesce(sum(vault_cents), 0) from guilds) gv,
      (select coalesce(sum(amount_cents), 0) from platform_ledger) pl,
      (select coalesce(sum(amount_cents), 0) from deposits where status = 'aprovado') dep,
      (select coalesce(sum(amount_cents), 0) from withdrawals where status = 'pago') wd,
      (select coalesce(sum(amount_cents), 0) from ledger where kind = 'ajuste') adj`);
  const inside = Number(r.w) + Number(r.rv) + Number(r.gv) + Number(r.pl), outside = Number(r.dep) - Number(r.wd) + Number(r.adj);
  ok(inside === outside, 'dinheiro conservado (' + label + ')', { inside, outside });
}
const bal = async (u) => Number((await q1('select balance_cents b from wallets where user_id = $1', [u])).b);
const bals = async (list) => { const out = []; for (const u of list) out.push(await bal(u)); return out; };

H.run(async () => {
  const dono = await mk('dono@bh.gg'), admin = await mk('admin@bh.gg'), mod = await mk('mod@bh.gg');
  const P = [];
  for (let i = 1; i <= 6; i++) P.push(await mk('p' + i + '@bh.gg'));
  const all = [dono, admin, mod, ...P];
  for (let i = 0; i < all.length; i++) await call(all[i], 'complete_onboarding', { p_nick: 'Conta' + i, p_ff_nick: 'FF' + i, p_ff_id: String(300000000 + i), p_photo_path: all[i] + '/ff.jpg' });
  await call(dono, 'admin_set_role', { p_user: admin, p_role: 'admin' });
  await call(dono, 'admin_set_role', { p_user: mod, p_role: 'moderador' });
  await call(dono, 'admin_set_settings', { p: { pix_key: 'pix@bh.gg' } });
  for (const u of P) { const d = await call(u, 'request_manual_deposit', { p_cents: 5000 }); await call(dono, 'admin_deposit', { p_id: d.id, p_approve: true, p_note: null }); }
  for (let i = 0; i < P.length; i++) await call(P[i], 'set_device', { p_device: 'and:aparelho' + i });
  const start = new Date(Date.now() + 3600e3).toISOString();
  const room = await call(dono, 'create_room', { p: { title: 'Oficial Teste', max_players: 6, entry_cents: 1000, starts_at: start, official: true, prizes: [{ place: 1, cents: 3000 }] } });
  for (const u of P) await call(u, 'join_room', { p_id: room.id });
  await call(dono, 'start_room', { p_id: room.id, p_game_room_id: '77', p_password: 'x' });
  await conservation('antes');

  // ---------------- letrinhas miúdas
  const c1 = await must('moderador chama P1 para análise', call(mod, 'admin_case_open', { p_room: room.id, p_suspect: P[0], p_reason: 'mira grudando através da parede' }));
  const msg = await q1("select count(*) n from messages m join threads t on t.id = m.thread_id where m.recipient_id = $1 and t.kind = 'sala'", [P[0]]);
  ok(Number(msg.n) === 1, 'suspeito recebe a mensagem no chat de salas');
  const tm = await call(P[0], 'thread_messages', { p_thread: (await q1("select id from threads where kind = 'sala' and $1 in (user_a, user_b)", [P[0]])).id });
  ok(/total direito de verificar o seu aparelho/.test(tm.messages[0].body) && /ban permanente/.test(tm.messages[0].body), 'mensagem leva as letrinhas miúdas', tm.messages[0].body);
  await refuse('vídeo sem aceitar a verificação', call(P[0], 'case_submit_video', { p_case: c1.id, p_path: null, p_link: 'https://drive.google.com/x', p_consent: false }), /aceita a verificação/);
  const mc = await must('vídeo com o aceite', call(P[0], 'case_submit_video', { p_case: c1.id, p_path: null, p_link: 'https://drive.google.com/x', p_consent: true }));
  ok(mc && mc.consent_at, 'aceite gravado no caso', mc);

  // ---------------- recusou a verificação (sem tratar como trapaça)
  await refuse('moderador não bane por recusa', call(mod, 'admin_case_refuse', { p_id: c1.id, p_as_cheat: false, p_mode: null, p_note: 'recusou compartilhar a tela' }), /permissão/);
  const b0 = await bal(P[0]);
  const r1 = await must('admin registra a recusa', call(admin, 'admin_case_refuse', { p_id: c1.id, p_as_cheat: false, p_mode: null, p_note: 'recusou compartilhar a tela na ligação' }));
  ok(r1 && r1.status === 'recusado', 'caso fica "recusado"', r1 && r1.status);
  const p1 = await q1('select banned_until, ban_reason from profiles where id = $1', [P[0]]);
  ok(p1.banned_until === Infinity || String(p1.banned_until) === 'Infinity', 'ban permanente', p1.banned_until);
  ok(/Recusou a verificação/.test(p1.ban_reason), 'motivo é a recusa', p1.ban_reason);
  ok(await count("select count(*) n from blocklist where value in ('300000003', 'and:aparelho0')") === 2, 'ID do Free Fire e aparelho bloqueados');
  ok((await bal(P[0])) === b0, 'sem tratar como trapaça, o saldo não é retido');
  ok((await call(P[0], 'me')).banned === true, 'app mostra a tela de banido');
  await refuse('banido não faz nada', call(P[0], 'join_room', { p_id: room.id }), /suspensa/);
  const novo = await mk('novo@bh.gg');
  const sd = await must('conta nova no mesmo aparelho', call(novo, 'set_device', { p_device: 'and:aparelho0' }));
  ok(sd && sd.banned === true, 'conta nova no aparelho bloqueado é banida', sd);
  await refuse('moderador não tira ban permanente', call(mod, 'admin_unban', { p_user: P[0] }), /aba Banidos/);
  await refuse('nem admin pelo botão antigo', call(admin, 'admin_unban', { p_user: P[0] }), /aba Banidos/);

  // ---------------- aba de banidos
  const bl = await must('moderador vê a aba de banidos', call(mod, 'admin_banned', { p_q: null }));
  const e1 = bl && bl.find((x) => x.user.id === P[0]);
  ok(e1 && e1.permanent && e1.blocks.length === 2 && e1.case && e1.case.status === 'recusado', 'banido aparece com bloqueios e caso', e1);
  ok(bl && bl.some((x) => x.user.id === novo), 'conta nova banida pelo aparelho também aparece');
  ok((await call(mod, 'admin_banned', { p_q: 'conta3' })).length === 1, 'busca por nick');
  await refuse('moderador não libera', call(mod, 'admin_ban_release', { p_user: P[0], p_action: 'voltar', p_note: 'pediu revisão' }), /permissão/);
  await refuse('liberar sem motivo', call(admin, 'admin_ban_release', { p_user: P[0], p_action: 'nova_conta', p_note: '' }), /motivo/);
  const rl = await must('admin deixa criar outra conta', call(admin, 'admin_ban_release', { p_user: P[0], p_action: 'nova_conta', p_note: 'acordo com o jogador' }));
  ok(rl && rl.unblocked.length === 2, 'bloqueios retirados', rl);
  ok((await q1('select banned_until > now() b from profiles where id = $1', [P[0]])).b === true, 'a conta antiga continua banida');
  const outro = await mk('outro@bh.gg');
  const sd2 = await must('outra conta no aparelho liberado', call(outro, 'set_device', { p_device: 'and:aparelho0' }));
  ok(sd2 && !sd2.banned, 'aparelho liberado não bane a conta nova');

  await call(admin, 'admin_ban_release', { p_user: novo, p_action: 'voltar', p_note: 'banido só por usar o aparelho' });
  ok((await call(novo, 'me')).banned === false, 'conta nova volta a entrar');

  // ---------------- recusa tratada como trapaça + reativar devolve o saldo retido
  const c2 = await must('abre análise de P2', call(mod, 'admin_case_open', { p_room: room.id, p_suspect: P[1], p_reason: 'movimento impossível' }));
  const b2 = await bal(P[1]), others = await bals(P.slice(2));
  const r2 = await must('recusa tratada como trapaça', call(admin, 'admin_case_refuse', { p_id: c2.id, p_as_cheat: true, p_mode: 'todos', p_note: 'não atendeu a ligação nem mandou vídeo' }));
  ok(r2 && r2.status === 'recusado' && r2.result.confiscated === b2, 'saldo retido e caso recusado', r2 && { s: r2.status, c: r2.result && r2.result.confiscated, b2 });
  ok((await bals(P.slice(2))).every((v, i) => v === others[i] + 1000), 'todos da sala receberam a inscrição de volta');
  ok((await bal(P[1])) === 0, 'trapaceiro fica sem saldo');
  await conservation('depois da recusa como trapaça');
  const rv = await must('dono reativa P2 por completo', call(dono, 'admin_ban_release', { p_user: P[1], p_action: 'reativar', p_note: 'revisão: vídeo chegou depois e estava limpo' }));
  ok(rv && rv.returned_cents === b2, 'saldo retido devolvido', rv);
  ok((await bal(P[1])) === b2, 'carteira de volta ao que era');
  ok((await call(P[1], 'me')).banned === false, 'P2 volta a entrar');
  await conservation('depois da reativação');
  const again = await must('reativar de novo', call(dono, 'admin_ban_release', { p_user: P[1], p_action: 'nova_conta', p_note: 'só conferindo bloqueios' }));
  ok(again && again.returned_cents === 0, 'não devolve duas vezes');
  ok(await count('select count(*) n from ban_releases') === 4, 'liberações registradas');
  ok(await count("select count(*) n from audit_log where action in ('Baniu por recusar a verificação', 'Reativou a conta', 'Liberou criar outra conta', 'Liberou voltar para a conta')") >= 5, 'tudo na auditoria');
});
