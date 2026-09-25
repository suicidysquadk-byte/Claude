// Testa as regras do BattleHub num Postgres real (sem o Supabase).
// Uso: aplique tests/shim.sql + migrations/0001..0004 num banco vazio e rode
//   PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh node supabase/tests/money.test.js
const { Client } = require('pg');

const db = new Client({ user: process.env.PGUSER || 'postgres' });
let passed = 0;
const fails = [];

async function call(uid, fn, args, role) {
  const names = Object.keys(args || {});
  await db.query('begin');
  try {
    await db.query(`set local role ${role || 'authenticated'}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid || '', role: role || 'authenticated' })]);
    const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
    const vals = names.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
    const res = await db.query(sql, vals);
    await db.query('commit');
    return res.rows[0].r;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
const svc = (fn, args) => call(null, fn, args, 'service_role');

function ok(cond, label, extra) {
  if (cond) { passed++; return; }
  fails.push(label + (extra !== undefined ? ' → ' + JSON.stringify(extra) : ''));
}
async function must(label, p) {
  try { const r = await p; passed++; return r; } catch (e) { fails.push(label + ' → erro: ' + e.message); return null; }
}
async function refuse(label, p, re) {
  try { await p; fails.push(label + ' → deveria recusar'); } catch (e) {
    if (re && !re.test(e.message)) fails.push(label + ' → mensagem inesperada: ' + e.message); else passed++;
  }
}
const q1 = async (sql, params) => (await db.query(sql, params)).rows[0];
const bal = async (uid) => Number((await q1('select balance_cents b from wallets where user_id = $1', [uid])).b);

async function conservation(label) {
  const r = await q1(`select
      (select coalesce(sum(balance_cents + held_cents), 0) from wallets) w,
      (select coalesce(sum(vault_cents), 0) from rooms where status in ('aberta','em_andamento')) rv,
      (select coalesce(sum(vault_cents), 0) from guilds) gv,
      (select coalesce(sum(amount_cents), 0) from platform_ledger) pl,
      (select coalesce(sum(amount_cents), 0) from deposits where status = 'aprovado') dep,
      (select coalesce(sum(amount_cents), 0) from withdrawals where status = 'pago') wd,
      (select coalesce(sum(amount_cents), 0) from ledger where kind = 'ajuste') adj`);
  const inside = Number(r.w) + Number(r.rv) + Number(r.gv) + Number(r.pl);
  const outside = Number(r.dep) - Number(r.wd) + Number(r.adj);
  ok(inside === outside, 'dinheiro conservado (' + label + ')', { inside, outside, r });
}

(async () => {
  await db.connect();
  const mk = async (email) => (await q1('insert into auth.users (email) values ($1) returning id', [email])).id;
  const owner = await mk('dono@bh.gg');
  const creator = await mk('criador@bh.gg');
  const mod = await mk('mod@bh.gg');
  const P = [];
  for (let i = 1; i <= 8; i++) P.push(await mk('p' + i + '@bh.gg'));

  // ---------------- contas
  const me0 = await must('me do dono', call(owner, 'me'));
  ok(me0 && me0.role === 'dono', 'primeira conta vira dona', me0 && me0.role);
  const meP = await must('me do jogador', call(P[0], 'me'));
  ok(meP && meP.role === 'jogador', 'segunda conta é jogador');
  await refuse('onboarding sem foto', call(P[0], 'complete_onboarding', { p_nick: 'Jogador1', p_ff_nick: 'J1', p_ff_id: '123456789', p_photo_path: '' }), /print/);
  await refuse('foto de outra pasta', call(P[0], 'complete_onboarding', { p_nick: 'Jogador1', p_ff_nick: 'J1', p_ff_id: '123456789', p_photo_path: P[1] + '/x.jpg' }), /inválida/);
  const all = [owner, creator, mod, ...P];
  const nicks = ['Dono', 'Criador', 'Moder', 'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Fox', 'Golf', 'Hotel'];
  for (let i = 0; i < all.length; i++) {
    await must('onboarding ' + nicks[i], call(all[i], 'complete_onboarding', { p_nick: nicks[i], p_ff_nick: nicks[i] + 'FF', p_ff_id: String(100000000 + i), p_photo_path: all[i] + '/ff.jpg' }));
  }
  await refuse('nick repetido', call(P[1], 'update_profile', { p_nick: 'alpha', p_bio: '', p_avatar_url: null, p_anonymous: false }), /em uso/);
  await refuse('ID FF repetido', call(P[1], 'submit_ff', { p_ff_nick: 'x', p_ff_id: '100000003', p_photo_path: P[1] + '/b.jpg' }), /outra conta/);

  await must('dono nomeia moderador', call(owner, 'admin_set_role', { p_user: mod, p_role: 'moderador' }));
  await refuse('moderador não mexe em cargos', call(mod, 'admin_set_role', { p_user: P[0], p_role: 'moderador' }), /permissão/);
  const queue = await must('fila de verificação', call(mod, 'admin_ff_queue', { p_status: 'pendente' }));
  ok(queue && queue.length === all.length, 'todos na fila de verificação', queue && queue.length);
  for (const s of queue || []) await must('aprovar FF', call(mod, 'admin_ff_review', { p_id: s.id, p_approve: true, p_note: null }));

  // ---------------- depósitos
  await refuse('depósito sem chave Pix configurada', call(P[0], 'request_manual_deposit', { p_cents: 5000 }), /configurados/);
  await must('dono configura Pix', call(owner, 'admin_set_settings', { p: { pix_key: 'pix@battlehub.gg', platform_fee_pct: 10 } }));
  await refuse('depósito abaixo do mínimo', call(P[0], 'request_manual_deposit', { p_cents: 100 }), /mínimo/);
  for (const u of [creator, ...P.slice(0, 7)]) {
    const d = await must('pedir depósito', call(u, 'request_manual_deposit', { p_cents: 5000 }));
    if (d) await must('admin confirma depósito', call(owner, 'admin_deposit', { p_id: d.id, p_approve: true, p_note: null }));
  }
  await refuse('moderador não confirma depósito', call(mod, 'admin_finance'), /permissão/);
  ok((await bal(P[0])) === 5000, 'saldo creditado só após confirmação', await bal(P[0]));
  // Mercado Pago (via funções de servidor)
  await refuse('jogador não chama função de serviço', call(P[7], 'svc_create_deposit', { p_user: P[7], p_cents: 2000, p_provider_id: 'mp1', p_qr: 'x', p_qr64: 'y', p_expires: new Date(Date.now() + 3600e3).toISOString() }), /negado/);
  await must('serviço cria depósito MP', svc('svc_create_deposit', { p_user: P[7], p_cents: 2000, p_provider_id: 'mp1', p_qr: 'x', p_qr64: 'y', p_expires: new Date(Date.now() + 3600e3).toISOString() }));
  ok((await bal(P[7])) === 0, 'depósito pendente não credita');
  await must('webhook aprova', svc('svc_settle_deposit', { p_provider_id: 'mp1', p_status: 'approved', p_amount_cents: 2000 }));
  await must('webhook repetido é ignorado', svc('svc_settle_deposit', { p_provider_id: 'mp1', p_status: 'approved', p_amount_cents: 2000 }));
  ok((await bal(P[7])) === 2000, 'webhook credita uma vez só', await bal(P[7]));
  await conservation('depois dos depósitos');

  // ---------------- salas
  const start = new Date(Date.now() + 3600e3).toISOString();
  const roomDef = {
    title: 'Copa Teste', mode: 'Battle Royale', team_size: 1, map: 'Bermuda', max_players: 6, entry_cents: 200, starts_at: start,
    prizes: [{ place: 1, cents: 300 }],
    mechanics: [{ type: 'first_blood', cents: 60 }, { type: 'rei', cents: 100 }, { type: 'por_kill', cents: 20 }, { type: 'mvp', cents: 60 }, { type: 'sorteio', cents: 40 }]
  };
  // teto: com a sala cheia (6 × R$ 2 = R$ 12) os jogadores recebem no máximo 70% (R$ 8,40)
  await must('admin libera criador', call(owner, 'admin_set_creator', { p_user: creator, p_value: true }));
  await refuse('prêmio igual à arrecadação passa do teto', call(creator, 'create_room', { p: { ...roomDef, prizes: [{ place: 1, cents: 1200 }], mechanics: [] } }), /acima do limite/);
  await refuse('mecânicas demais passam do teto', call(creator, 'create_room', { p: { ...roomDef, mechanics: [...roomDef.mechanics, { type: 'booyah', cents: 200 }] } }), /acima do limite/);
  await must('exatamente no teto passa', call(creator, 'create_room', { p: { ...roomDef, title: 'No teto', prizes: [{ place: 1, cents: 840 }], mechanics: [] } }).then((r) => call(creator, 'cancel_room', { p_id: r.id, p_reason: 'teste' })));
  await must('admin libera criador de novo', call(owner, 'admin_set_creator', { p_user: creator, p_value: false }));
  await refuse('sem permissão não cria sala', call(creator, 'create_room', { p: roomDef }), /permissão/);
  await must('admin libera criador', call(owner, 'admin_set_creator', { p_user: creator, p_value: true }));
  const room = await must('criar sala', call(creator, 'create_room', { p: roomDef }));
  const rid = room && room.id;
  await refuse('organizador não entra na própria sala', call(creator, 'join_room', { p_id: rid }), /organizador/);
  for (let i = 0; i < 6; i++) await must('entrar ' + i, call(P[i], 'join_room', { p_id: rid }));
  ok((await bal(P[0])) === 4800, 'inscrição debitada', await bal(P[0]));
  const vault1 = Number((await q1('select vault_cents v from rooms where id = $1', [rid])).v);
  ok(vault1 === 1200, 'cofre com 6 × R$ 2', vault1);
  // fila com prioridade
  await must('P7 compra prioridade', call(P[7], 'buy_item', { p_item: 'prioridade-7' }));
  const w1 = await must('P6 cai na fila', call(P[6], 'join_room', { p_id: rid }));
  ok(w1 && w1.status === 'fila', 'sala cheia manda para a fila', w1);
  const w2 = await must('P7 cai na fila', call(P[7], 'join_room', { p_id: rid }));
  ok(w2 && w2.position === 1, 'prioridade passa na frente da fila', w2);
  await must('P5 sai da sala', call(P[5], 'leave_room', { p_id: rid }));
  const inP7 = await q1("select status from room_players where room_id = $1 and user_id = $2", [rid, P[7]]);
  ok(inP7 && inP7.status === 'inscrito', 'vaga vai para quem tem prioridade', inP7);
  ok((await bal(P[5])) === 5000, 'quem sai recebe de volta', await bal(P[5]));
  const players = [P[0], P[1], P[2], P[3], P[4], P[7]];

  // roleta
  await refuse('jogador não gira roleta', call(P[0], 'draw_room', { p_id: rid, p_kind: 'rei' }), /organizador/);
  const king = await must('sortear Player Rei', call(creator, 'draw_room', { p_id: rid, p_kind: 'rei' }));
  const lucky = await must('sorteio da sala', call(creator, 'draw_room', { p_id: rid, p_kind: 'sorteio' }));
  await refuse('roleta só uma vez', call(creator, 'draw_room', { p_id: rid, p_kind: 'rei' }), /já foi girada/);
  const kingId = king && king.winner.id;
  const luckyId = lucky && lucky.winner.id;
  ok(players.includes(kingId), 'rei é um inscrito');

  // compromisso: 300 + 60 + 100 + 20×5 + 60 + 40 = 660, cabe no cofre de 1200
  await must('iniciar sala', call(creator, 'start_room', { p_id: rid, p_game_room_id: '12345678', p_password: 'abc' }));
  const secret = await must('inscrito vê a senha', call(P[0], 'get_room', { p_id: rid }));
  ok(secret && secret.secrets && secret.secrets.password === 'abc', 'senha liberada para inscritos');
  const outsider = await must('fora da sala', call(P[5], 'get_room', { p_id: rid }));
  ok(outsider && !outsider.secrets, 'quem não está inscrito não vê a senha');

  // guilda de dois jogadores
  const gld = await must('criar guilda', call(P[0], 'create_guild', { p: { name: 'Dragões', tag: 'DRG', cut_pct: 10 } }));
  await must('entrar na guilda', call(P[1], 'join_guild', { p_id: gld && gld.id }));

  // resultado: alguém que não é o rei mata o rei
  const killer = players.find((u) => u !== kingId);
  const others = players.filter((u) => u !== killer);
  const results = {
    players: [
      { user_id: killer, kills: 3, placement: 1, survival_min: 22 },
      ...others.map((u, i) => ({ user_id: u, kills: i === 0 ? 1 : i === 1 ? 1 : 0, placement: i + 2, survival_min: 20 - i * 3 }))
    ],
    first_blood: killer, king_outcome: 'killed', king_killer: killer
  };
  await refuse('abates impossíveis', call(creator, 'preview_results', { p_id: rid, p_results: { ...results, players: results.players.map((p) => ({ ...p, kills: 9 })) } }), /maior que o possível/);
  await refuse('first blood sem abate', call(creator, 'preview_results', { p_id: rid, p_results: { ...results, first_blood: others[5] } }), /primeiro abate/);
  const prev = await must('prévia do resultado', call(creator, 'preview_results', { p_id: rid, p_results: results }));
  const expected = 300 + 60 + 100 + 20 * 5 + 60 + 40; // killer: 1º + fb + rei + 3 kills + mvp; + sorteio
  const creatorCut = 1200 - expected - 120; // taxa da plataforma: 10% da arrecadação
  ok(prev && prev.payout_cents === expected, 'premiação calculada', prev && prev.payout_cents);
  ok(prev && prev.vault_cents === 1200 && prev.fee_cents === 120 && prev.creator_cents === creatorCut, 'sobra vai para o criador (menos taxa)', prev && { v: prev.vault_cents, c: prev.creator_cents, f: prev.fee_cents });

  const beforeKiller = await bal(killer), beforeCreator = await bal(creator), beforeLucky = await bal(luckyId);
  await must('finalizar sala', call(creator, 'finish_room', { p_id: rid, p_results: results }));
  const killerGain = 300 + 60 + 100 + 60 + 60 + (luckyId === killer ? 40 : 0);
  const killerGuild = killer === P[0] || killer === P[1];
  const killerNet = killerGuild ? killerGain - Math.floor(killerGain * 0.1) : killerGain;
  ok((await bal(killer)) - beforeKiller === killerNet, 'vencedor recebe prêmio + mecânicas (menos guilda se tiver)', { got: (await bal(killer)) - beforeKiller, killerNet });
  if (luckyId !== killer) {
    const lg = (luckyId === P[0] || luckyId === P[1]) ? 40 - Math.floor(40 * 0.1) : 40;
    // o sorteado pode ter ganho por abate também
    const lp = results.players.find((p) => p.user_id === luckyId);
    const extra = lp.kills * 20;
    const gross = 40 + extra;
    const net = (luckyId === P[0] || luckyId === P[1]) ? gross - Math.floor(gross * 0.1) : gross;
    ok((await bal(luckyId)) - beforeLucky === net, 'sorteado recebe o bônus', { got: (await bal(luckyId)) - beforeLucky, net, lg });
  }
  ok((await bal(creator)) - beforeCreator === creatorCut, 'criador recebe a sobra', (await bal(creator)) - beforeCreator);
  const rs = await q1('select status, vault_cents from rooms where id = $1', [rid]);
  ok(rs.status === 'finalizada' && Number(rs.vault_cents) === 0, 'sala finalizada com cofre zerado', rs);
  const st = await q1('select kills, wins, matches, xp, first_bloods, kings_killed from profiles where id = $1', [killer]);
  ok(st.kills === 3 && st.wins === 1 && st.matches === 1 && st.first_bloods === 1 && st.kings_killed === 1, 'estatísticas atualizadas', st);
  ok(st.xp === 20 + 30 + 40 + 100 + 15 + 30 + 25, 'XP do vencedor', st.xp);
  await refuse('não finaliza duas vezes', call(creator, 'finish_room', { p_id: rid, p_results: results }), /Inicie/);
  await conservation('depois da sala');

  // ---------------- rankings
  const rk = await must('ranking de abates', call(P[3], 'rankings', { p_metric: 'abates', p_period: 'mes', p_limit: 10 }));
  ok(rk && rk.rows[0].user.id === killer && Number(rk.rows[0].value) === 3, 'topo do ranking', rk && rk.rows[0]);
  await must('ficar anônimo', call(killer, 'update_profile', { p_nick: nicks[3 + P.indexOf(killer)], p_bio: '', p_avatar_url: null, p_anonymous: true }));
  const rk2 = await must('ranking de ganhos', call(P[3], 'rankings', { p_metric: 'ganhos', p_period: 'total', p_limit: 10 }));
  ok(rk2 && rk2.rows[0].user.nick === 'Jogador anônimo' && rk2.rows[0].user.id === null && Number(rk2.rows[0].value) > 0, 'anônimo aparece com o valor ganho', rk2 && rk2.rows[0]);
  const home = await must('início', call(P[3], 'home'));
  ok(home && home.payouts.length > 0, 'pagamentos recentes na tela inicial');

  // ---------------- guilda
  const g1 = await must('ver guilda', call(P[0], 'get_guild', { p_id: gld && gld.id }));
  ok(g1 && g1.vault_cents > 0, 'cofre da guilda recebeu a parte dos ganhos', g1 && g1.vault_cents);
  await refuse('membro não distribui', call(P[1], 'guild_payout_plan', { p_id: gld.id }), /líder/);
  const plan = await must('plano de salários', call(P[0], 'guild_payout_plan', { p_id: gld.id }));
  ok(plan && plan.rows.length === 2, 'plano lista os membros');
  await refuse('distribuir mais que o cofre', call(P[0], 'guild_distribute', { p_id: gld.id, p_alloc: [{ user_id: P[1], cents: g1.vault_cents + 1 }] }), /passa do cofre/);
  const alloc = plan.rows.map((r) => ({ user_id: r.user.id, cents: r.equal_cents }));
  await must('distribuir cofre igual', call(P[0], 'guild_distribute', { p_id: gld.id, p_alloc: alloc }));
  await must('vice-líder', call(P[0], 'guild_manage', { p_action: 'vice', p_user: P[1], p: {} }));
  await conservation('depois da guilda');

  // ---------------- saques
  await must('P2 saca', call(P[2], 'request_withdrawal', { p_cents: 2000, p_key_type: 'E-mail', p_key: 'p3@bh.gg' }));
  await refuse('segundo saque em análise', call(P[2], 'request_withdrawal', { p_cents: 1000, p_key_type: 'E-mail', p_key: 'p3@bh.gg' }), /em análise/);
  await must('P3 saca', call(P[3], 'request_withdrawal', { p_cents: 1500, p_key_type: 'CPF', p_key: '12345678900' }));
  const fin = await must('financeiro', call(owner, 'admin_finance'));
  const [wA, wB] = fin.pending_withdrawals;
  await must('pagar saque', call(owner, 'admin_withdrawal', { p_id: wA.id, p_paid: true, p_note: 'pago' }));
  const b3 = await bal(P[3]);
  await refuse('recusar sem motivo', call(owner, 'admin_withdrawal', { p_id: wB.id, p_paid: false, p_note: '' }), /motivo/);
  await must('recusar saque', call(owner, 'admin_withdrawal', { p_id: wB.id, p_paid: false, p_note: 'Chave inválida' }));
  ok((await bal(P[3])) - b3 === 1500, 'saque recusado devolve o saldo');
  await conservation('depois dos saques');

  // ---------------- sala que não encheu: o organizador cobre a diferença com garantia
  const rg = await must('sala garantia', call(creator, 'create_room', { p: { ...roomDef, title: 'Sala Garantia', mechanics: [], prizes: [{ place: 1, cents: 700 }] } }));
  await must('P5 entra na sala garantia', call(P[5], 'join_room', { p_id: rg && rg.id }));
  await must('P2 entra na sala garantia', call(P[2], 'join_room', { p_id: rg && rg.id }));
  await refuse('não inicia sem cobrir o prêmio', call(creator, 'start_room', { p_id: rg && rg.id, p_game_room_id: '11223344', p_password: 'g' }), /garantia/);
  await must('garantia no cofre', call(creator, 'add_guarantee', { p_id: rg && rg.id, p_cents: 300 }));
  await must('inicia com garantia', call(creator, 'start_room', { p_id: rg && rg.id, p_game_room_id: '11223344', p_password: 'g' }));
  const b5g = await bal(P[5]);
  await must('finaliza sala garantia', call(creator, 'finish_room', { p_id: rg && rg.id, p_results: { players: [{ user_id: P[5], kills: 1, placement: 1 }, { user_id: P[2], kills: 0, placement: 2 }] } }));
  ok((await bal(P[5])) - b5g === 700, 'prêmio pago com a garantia', (await bal(P[5])) - b5g);
  await conservation('depois da garantia');

  // ---------------- segunda sala: mover, remover, cancelar, banir
  const r2 = await must('sala 2', call(creator, 'create_room', { p: { ...roomDef, title: 'Sala Dois', mechanics: [], prizes: [{ place: 1, cents: 500 }], max_players: 4 } }));
  const r3 = await must('sala 3', call(creator, 'create_room', { p: { ...roomDef, title: 'Sala Três', mechanics: [], prizes: [{ place: 1, cents: 700 }], entry_cents: 300, max_players: 4 } }));
  await must('P4 entra na sala 2', call(P[4], 'join_room', { p_id: r2.id }));
  await must('P5 entra na sala 2', call(P[5], 'join_room', { p_id: r2.id }));
  const b4 = await bal(P[4]);
  await refuse('jogador não move ninguém', call(P[0], 'admin_move_player', { p_user: P[4], p_from: r2.id, p_to: r3.id }), /permissão/);
  await must('moderação move jogador', call(mod, 'admin_move_player', { p_user: P[4], p_from: r2.id, p_to: r3.id }));
  ok(b4 - (await bal(P[4])) === 100, 'mover cobra só a diferença da inscrição', b4 - (await bal(P[4])));
  const b5 = await bal(P[5]);
  await must('organizador remove jogador', call(creator, 'kick_player', { p_room: r2.id, p_user: P[5], p_reason: 'Nick diferente do jogo' }));
  ok((await bal(P[5])) - b5 === 200, 'remoção devolve a inscrição');
  await refuse('moderador não bane permanente', call(mod, 'admin_ban', { p_user: P[6], p_hours: 0, p_reason: 'hack' }), /permanente/);
  await must('P6 entra na sala 3', call(P[6], 'join_room', { p_id: r3.id }));
  const b6 = await bal(P[6]);
  await must('banir 24h', call(mod, 'admin_ban', { p_user: P[6], p_hours: 24, p_reason: 'Uso de hack' }));
  ok((await bal(P[6])) - b6 === 300, 'banido sai das salas com reembolso');
  await refuse('banido não entra em sala', call(P[6], 'join_room', { p_id: r2.id }), /suspensa/);
  await refuse('moderador não bane dono', call(mod, 'admin_ban', { p_user: owner, p_hours: 1, p_reason: 'x' }), /mesmo cargo ou acima/);
  await must('desbanir', call(mod, 'admin_unban', { p_user: P[6] }));
  await must('P6 volta a jogar', call(P[6], 'join_room', { p_id: r2.id }));
  const b6b = await bal(P[6]);
  await must('cancelar sala 2', call(creator, 'cancel_room', { p_id: r2.id, p_reason: 'Servidor caiu' }));
  ok((await bal(P[6])) - b6b === 200, 'cancelamento devolve inscrições');
  await conservation('depois de mover, banir e cancelar');

  // ---------------- chat e amigos
  const dm = await must('organizador fala com inscrito', call(creator, 'message_player', { p_user: P[4], p_body: 'Confirma seu nick?', p_room: r3.id, p_image: null }));
  ok(dm && dm.kind === 'sala', 'mensagem do organizador vai para a aba de salas', dm);
  const th = await must('threads de sala', call(P[4], 'my_threads', { p_kind: 'sala' }));
  ok(th && th.length === 1 && th[0].unread === 1, 'chega como não lida na aba separada', th);
  await must('responder', call(P[4], 'send_message', { p_thread: dm.thread_id, p_body: 'Confirmo!', p_image: null }));
  const msgs = await must('ler conversa', call(P[4], 'thread_messages', { p_thread: dm.thread_id, p_before: null }));
  ok(msgs && msgs.messages.length === 2, 'conversa com as duas mensagens');
  await refuse('estranho não lê a conversa', call(P[2], 'thread_messages', { p_thread: dm.thread_id, p_before: null }), /não encontrada/);
  await must('pedido de amizade', call(P[2], 'friend_request', { p_user: P[3] }));
  await must('aceitar amizade', call(P[3], 'friend_respond', { p_user: P[2], p_accept: true }));
  const fr = await must('amigos', call(P[2], 'my_friends'));
  ok(fr && fr.friends.length === 1 && fr.suggestions.length > 0, 'lista de amigos e sugestões de quem jogou junto', fr && { f: fr.friends.length, s: fr.suggestions.length });

  // ---------------- loja e níveis
  const b0 = await bal(P[2]);
  await must('comprar banner', call(P[2], 'buy_item', { p_item: 'banner-neon' }));
  ok(b0 - (await bal(P[2])) === 490, 'compra debita a carteira');
  await refuse('comprar de novo', call(P[2], 'buy_item', { p_item: 'banner-neon' }), /já tem/);
  await refuse('item de recompensa não se compra', call(P[2], 'buy_item', { p_item: 'banner-coroa' }), /recompensa/);
  await refuse('equipar item que não tem', call(P[2], 'equip_item', { p_item: 'banner-coroa' }), /ainda não tem/);
  const shop = await must('loja', call(P[2], 'shop'));
  ok(shop && shop.items.find((i) => i.id === 'banner-neon').equipped, 'item comprado já vem equipado');
  const lvl = await q1('select xp from profiles where id = $1', [killer]);
  const inv = await q1("select count(*)::int n from inventory where user_id = $1 and source = 'recompensa'", [killer]);
  ok(lvl.xp >= 200 && inv.n >= 3, 'subir de nível entrega recompensas', { xp: lvl.xp, inv: inv.n });
  await conservation('final');

  // ---------------- squad: prêmio dividido, Rei sobrevive, empate no MVP
  const sq = await must('sala de duplas', call(creator, 'create_room', { p: { ...roomDef, title: 'Duplas', team_size: 2, max_players: 4, entry_cents: 500,
    prizes: [{ place: 1, cents: 800 }], mechanics: [{ type: 'rei', cents: 300 }, { type: 'mvp', cents: 201 }] } }));
  const duo = [P[0], P[1], P[2], P[3]];
  for (const u of duo) await must('entra na dupla', call(u, 'join_room', { p_id: sq.id }));
  const kg = await must('rei da dupla', call(creator, 'draw_room', { p_id: sq.id, p_kind: 'rei' }));
  await must('inicia dupla', call(creator, 'start_room', { p_id: sq.id, p_game_room_id: '99887766', p_password: 'duo' }));
  const kId = kg.winner.id;
  const winners = [kId, duo.find((u) => u !== kId)];
  const losers = duo.filter((u) => !winners.includes(u));
  const res2 = { players: [
      { user_id: winners[0], kills: 1, placement: 1 }, { user_id: winners[1], kills: 1, placement: 1 },
      { user_id: losers[0], kills: 0, placement: 2 }, { user_id: losers[1], kills: 0, placement: 2 }],
    king_outcome: 'survived' };
  const pv2 = await must('prévia duplas', call(creator, 'preview_results', { p_id: sq.id, p_results: res2 }));
  const byUser = {};
  (pv2 ? pv2.lines : []).forEach((l) => { byUser[l.user_id] = (byUser[l.user_id] || 0) + l.cents; });
  ok(pv2 && byUser[winners[0]] + byUser[winners[1]] === 800 + 300 + 201, 'dupla vencedora divide prêmio, rei e MVP', byUser);
  ok(pv2 && pv2.lines.filter((l) => l.kind === 'rei')[0].user_id === kId, 'rei que sobrevive fica com o bônus');
  ok(pv2 && pv2.lines.filter((l) => l.kind === 'mvp').length === 2, 'empate no MVP divide');
  await must('finaliza duplas', call(creator, 'finish_room', { p_id: sq.id, p_results: res2 }));
  await conservation('depois das duplas');

  // ---------------- painel
  const dash = await must('painel', call(owner, 'admin_dashboard'));
  ok(dash && dash.users === all.length && dash.series.length === 14, 'painel com números e série de 14 dias', dash && { u: dash.users, s: dash.series.length });
  await must('aviso geral', call(owner, 'admin_broadcast', { p_title: 'Temporada 1', p_body: 'Começou a temporada!', p_target: 'todos', p_pinned: true }));
  const me2 = await must('me com aviso fixado', call(P[0], 'me'));
  ok(me2 && me2.pinned && me2.pinned.title === 'Temporada 1', 'aviso fixado aparece para o jogador');
  const logs = await must('auditoria', call(owner, 'admin_logs', { p_q: null }));
  ok(logs && logs.length > 10, 'auditoria registra as ações', logs && logs.length);

  console.log(`\n${passed} verificações passaram, ${fails.length} falharam`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  await db.end();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log(`${passed} ok antes do erro; falhas:`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(2); });
