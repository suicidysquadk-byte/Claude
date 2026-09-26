// Testa o modo competitivo: taxa da plataforma, salas oficiais, mecânicas novas e eventos.
// Uso (banco recém-criado pelo reset.sh):
//   PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh node supabase/tests/competitivo.test.js
const { Client } = require('pg');

const db = new Client({ user: process.env.PGUSER || 'postgres' });
let passed = 0;
const fails = [];

async function call(uid, fn, args) {
  const names = Object.keys(args || {});
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid || '', role: 'authenticated' })]);
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
const platform = async () => Number((await q1('select coalesce(sum(amount_cents),0) s from platform_ledger')).s);
const sum = (lines, uid, kind) => lines.filter((l) => l.user_id === uid && (!kind || l.kind === kind)).reduce((a, l) => a + Number(l.cents), 0);

async function conservation(label) {
  const r = await q1(`select
      (select coalesce(sum(balance_cents + held_cents), 0) from wallets) w,
      (select coalesce(sum(vault_cents), 0) from rooms where status in ('aberta','em_andamento')) rv,
      (select coalesce(sum(vault_cents), 0) from events where status in ('inscricoes','andamento')) ev,
      (select coalesce(sum(vault_cents), 0) from guilds) gv,
      (select coalesce(sum(amount_cents), 0) from platform_ledger) pl,
      (select coalesce(sum(amount_cents), 0) from deposits where status = 'aprovado') dep,
      (select coalesce(sum(amount_cents), 0) from withdrawals where status = 'pago') wd,
      (select coalesce(sum(amount_cents), 0) from ledger where kind = 'ajuste') adj`);
  const inside = Number(r.w) + Number(r.rv) + Number(r.ev) + Number(r.gv) + Number(r.pl);
  const outside = Number(r.dep) - Number(r.wd) + Number(r.adj);
  ok(inside === outside, 'dinheiro conservado (' + label + ')', { inside, outside, r });
}

(async () => {
  await db.connect();
  const mk = async (email) => (await q1('insert into auth.users (email) values ($1) returning id', [email])).id;
  const owner = await mk('dono@bh.gg');
  const creator = await mk('criador@bh.gg');
  const P = [];
  for (let i = 1; i <= 12; i++) P.push(await mk('p' + i + '@bh.gg'));
  const all = [owner, creator, ...P];
  for (let i = 0; i < all.length; i++) {
    await must('cadastro', call(all[i], 'complete_onboarding', { p_nick: 'Jogador' + i, p_ff_nick: 'FF' + i, p_ff_id: String(200000000 + i), p_photo_path: all[i] + '/ff.jpg' }));
  }
  await must('Pix da plataforma', call(owner, 'admin_set_settings', { p: { pix_key: 'pix@bh.gg' } }));
  for (const u of [creator, ...P]) {
    const d = await must('depósito', call(u, 'request_manual_deposit', { p_cents: 20000 }));
    if (d) await must('confirma depósito', call(owner, 'admin_deposit', { p_id: d.id, p_approve: true, p_note: null }));
  }
  await must('libera criador', call(owner, 'admin_set_creator', { p_user: creator, p_value: true }));
  const me = await must('me', call(creator, 'me'));
  ok(me && me.settings.creator_fee_pct === 10 && me.settings.min_player_pct === 50, 'me traz taxa e equilíbrio', me && me.settings);
  ok(me && me.settings.daily_themes.length === 7, 'sete temas do dia');
  const start = new Date(Date.now() + 3600e3).toISOString();

  // ---------------- taxa da plataforma sobre a arrecadação
  await refuse('premiação baixa é recusada', call(creator, 'create_room', { p: {
    title: 'Sala Pão-Dura', max_players: 10, entry_cents: 1000, starts_at: start, prizes: [{ place: 1, cents: 2000 }] } }), /Premiação baixa/);
  const r1 = await must('sala do criador', call(creator, 'create_room', { p: {
    title: 'Sala do Criador', max_players: 10, entry_cents: 1000, starts_at: start, prizes: [{ place: 1, cents: 6000 }] } }));
  ok(r1 && Number(r1.fee_pct) === 10 && r1.split_full.pot_cents === 10000 && r1.split_full.platform_cents === 1000 && r1.split_full.creator_cents === 3000,
     'divisão prevista: 60 jogadores, 10 plataforma, 30 organizador', r1 && r1.split_full);
  for (let i = 0; i < 10; i++) await must('entra', call(P[i], 'join_room', { p_id: r1.id }));
  await must('inicia', call(creator, 'start_room', { p_id: r1.id, p_game_room_id: '1', p_password: 'a' }));
  const pl0 = await platform(), c0 = await bal(creator);
  const res1 = { players: P.slice(0, 10).map((u, i) => ({ user_id: u, kills: i === 0 ? 3 : 0, placement: i + 1 })) };
  const f1 = await must('finaliza', call(creator, 'finish_room', { p_id: r1.id, p_results: res1 }));
  ok(f1 && f1.fee_cents === 1000 && f1.creator_cents === 3000, 'plataforma 10% da arrecadação, organizador fica com o resto', f1 && { f: f1.fee_cents, c: f1.creator_cents });
  ok((await platform()) - pl0 === 1000 && (await bal(creator)) - c0 === 3000, 'dinheiro caiu nos lugares certos');
  await conservation('sala do criador');

  // taxa combinada com o organizador
  await must('taxa especial 5%', call(owner, 'admin_set_creator_fee', { p_user: creator, p_pct: 5 }));
  const r2 = await must('sala com taxa especial', call(creator, 'create_room', { p: {
    title: 'Sala Taxa 5', max_players: 6, entry_cents: 1000, starts_at: start, prizes: [{ place: 1, cents: 3900 }] } }));
  ok(r2 && Number(r2.fee_pct) === 5, 'sala usa a taxa combinada', r2 && r2.fee_pct);
  for (let i = 0; i < 4; i++) await must('entra', call(P[i], 'join_room', { p_id: r2.id }));
  await must('inicia', call(creator, 'start_room', { p_id: r2.id, p_game_room_id: '1', p_password: 'a' }));
  const f2 = await must('finaliza', call(creator, 'finish_room', { p_id: r2.id, p_results: { players: P.slice(0, 4).map((u, i) => ({ user_id: u, kills: 0, placement: i + 1 })) } }));
  ok(f2 && f2.fee_cents === 100 && f2.creator_cents === 0, 'taxa nunca tira da premiação (limitada à sobra)', f2 && { f: f2.fee_cents, c: f2.creator_cents });
  await refuse('só admin cria sala oficial', call(creator, 'create_room', { p: { title: 'Oficial?', max_players: 4, entry_cents: 0, starts_at: start, official: true } }), /administração/);
  await conservation('taxa especial');

  // ---------------- sala oficial com mecânicas novas (a plataforma garante)
  const tpl = await must('modelos', call(owner, 'room_templates'));
  ok(tpl && tpl.find((t) => t.id === 'ancestral-solo') && tpl.find((t) => t.id === 'intermediaria').entry_cents === 700, 'modelos oficiais disponíveis', tpl && tpl.map((t) => t.id));
  const tplC = await must('modelos do criador', call(creator, 'room_templates'));
  ok(tplC && !tplC.find((t) => t.official_only), 'criador não vê modelos exclusivos');
  const ro = await must('sala oficial', call(owner, 'create_room', { p: {
    title: 'Oficial Domínio', max_players: 20, entry_cents: 600, starts_at: start, official: true, tier: 'dominio', xp_mult: 2,
    prizes: [{ place: 1, cents: 1500 }, { place: 2, cents: 800 }],
    mechanics: [{ type: 'booyah', cents: 300 }, { type: 'rei_lobby', cents: 400 }, { type: 'destaque', cents: 200 }, { type: 'sobrevivente', cents: 100 },
                { type: 'meta_abates', cents: 150, n: 2 }, { type: 'clutch', cents: 250 }, { type: 'dominio', cents: 500 }, { type: 'por_kill', cents: 100 }] } }));
  ok(ro && ro.official && ro.tier === 'dominio' && Number(ro.xp_mult) === 2, 'sala oficial marcada', ro && { o: ro.official, t: ro.tier });
  for (let i = 0; i < 6; i++) await must('entra oficial', call(P[i], 'join_room', { p_id: ro.id }));
  await must('oficial inicia sem garantia', call(owner, 'start_room', { p_id: ro.id, p_game_room_id: '9', p_password: 'z' }));
  // P0 vence com 3 abates (domínio), P1 2º com 2 abates
  const resO = { players: [
      { user_id: P[0], kills: 3, placement: 1 }, { user_id: P[1], kills: 2, placement: 2 }, { user_id: P[2], kills: 0, placement: 3 },
      { user_id: P[3], kills: 0, placement: 4 }, { user_id: P[4], kills: 0, placement: 5 }, { user_id: P[5], kills: 0, placement: 6 }],
    picks: { destaque: P[2], clutch: P[1] } };
  const pv = await must('prévia oficial', call(owner, 'preview_results', { p_id: ro.id, p_results: resO }));
  const L = pv ? pv.lines : [];
  ok(sum(L, P[0], 'booyah') === 300 && sum(L, P[0], 'dominio') === 500, 'booyah e domínio absoluto para quem venceu abatendo mais');
  ok(sum(L, P[0], 'rei_lobby') === 400, 'rei do lobby = mais pontos (abates + colocação)');
  ok(sum(L, P[2], 'destaque') === 200 && sum(L, P[1], 'clutch') === 250, 'destaque e clutch escolhidos pelo organizador');
  ok(L.filter((l) => l.kind === 'sobrevivente').length === 5, 'sobrevivente top 5 paga os 5 primeiros', L.filter((l) => l.kind === 'sobrevivente').length);
  ok(sum(L, P[0], 'meta_abates') === 150 && sum(L, P[1], 'meta_abates') === 150 && sum(L, P[2], 'meta_abates') === 0, 'meta de 2 abates');
  const total = L.reduce((a, l) => a + Number(l.cents), 0);
  ok(pv && pv.cover_platform_cents === total - 3600 && pv.fee_cents === 0, 'plataforma cobre o que falta na sala oficial', pv && { cover: pv.cover_platform_cents, total });
  const xpP0 = pv && pv.players.find((x) => x.user_id === P[0]).xp;
  ok(xpP0 === (20 + 30 + 40 + 100 + 25) * 2, 'XP em dobro', xpP0);
  await must('finaliza oficial', call(owner, 'finish_room', { p_id: ro.id, p_results: resO }));
  await conservation('sala oficial');

  // oficial que sobra dinheiro: sobra inteira para a plataforma
  const ro2 = await must('oficial com sobra', call(owner, 'create_room', { p: { title: 'Oficial Base', max_players: 4, entry_cents: 1000, starts_at: start, official: true, prizes: [{ place: 1, cents: 2000 }] } }));
  for (let i = 0; i < 4; i++) await must('entra', call(P[6 + i], 'join_room', { p_id: ro2.id }));
  await must('inicia', call(owner, 'start_room', { p_id: ro2.id, p_game_room_id: '9', p_password: 'z' }));
  const plB = await platform();
  const fo2 = await must('finaliza', call(owner, 'finish_room', { p_id: ro2.id, p_results: { players: P.slice(6, 10).map((u, i) => ({ user_id: u, kills: 0, placement: i + 1 })) } }));
  ok(fo2 && fo2.fee_cents === 2000 && (await platform()) - plB === 2000, 'sobra da sala oficial vai toda para a plataforma', fo2 && fo2.fee_cents);

  // ---------------- dupla: line mais agressiva e line mais tática
  const rd = await must('sala em dupla', call(owner, 'create_room', { p: { title: 'Duplas', team_size: 2, max_players: 6, entry_cents: 0, starts_at: start, official: true,
    mechanics: [{ type: 'line_agressiva', cents: 600 }, { type: 'line_tatica', cents: 400 }] } }));
  await refuse('line em solo não existe', call(owner, 'create_room', { p: { title: 'Solo line', max_players: 4, entry_cents: 0, starts_at: start, official: true, mechanics: [{ type: 'line_agressiva', cents: 100 }] } }), /dupla ou squad/);
  for (let i = 0; i < 6; i++) await must('entra dupla', call(P[i], 'join_room', { p_id: rd.id }));
  await must('inicia dupla', call(owner, 'start_room', { p_id: rd.id, p_game_room_id: '9', p_password: 'z' }));
  const resD = { players: [
      { user_id: P[0], kills: 1, placement: 1 }, { user_id: P[1], kills: 0, placement: 1 },
      { user_id: P[2], kills: 2, placement: 2 }, { user_id: P[3], kills: 1, placement: 2 },
      { user_id: P[4], kills: 0, placement: 3 }, { user_id: P[5], kills: 0, placement: 3 }], picks: { line_tatica: P[5] } };
  const pd = await must('prévia dupla', call(owner, 'preview_results', { p_id: rd.id, p_results: resD }));
  ok(pd && sum(pd.lines, P[2], 'line_agressiva') === 300 && sum(pd.lines, P[3], 'line_agressiva') === 300, 'line mais agressiva divide entre a dupla');
  ok(pd && sum(pd.lines, P[4], 'line_tatica') === 200 && sum(pd.lines, P[5], 'line_tatica') === 200, 'line mais tática vai para a dupla escolhida');
  await must('finaliza dupla', call(owner, 'finish_room', { p_id: rd.id, p_results: resD }));
  await conservation('dupla');

  // ---------------- campeonato de lines (duplas para caber no teste)
  const guildA = await must('guilda A', call(P[0], 'create_guild', { p: { name: 'Alfa', tag: 'ALF', cut_pct: 0 } }));
  await must('P1 entra na guilda A', call(P[1], 'join_guild', { p_id: guildA.id }));
  await must('P2 entra na guilda A', call(P[2], 'join_guild', { p_id: guildA.id }));
  await must('P3 entra na guilda A', call(P[3], 'join_guild', { p_id: guildA.id }));
  const ev = await must('cria campeonato', call(owner, 'admin_event_save', { p: {
    kind: 'campeonato', title: 'Champions Teste', entry_type: 'line', line_size: 2, entry_cents: 2000, max_entries: 6,
    points: { kill: 1, place: [12, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
    phases: [{ name: 'Grupos', drops: 2, qualify: 2 }, { name: 'Final', drops: 1, qualify: null }],
    prizes: [{ place: 1, cents: 4000 }, { place: 2, cents: 2000 }],
    awards: [{ type: 'mvp', cents: 1000 }, { type: 'line_agressiva', cents: 600 }, { type: 'maior_pontuador_mapa', cents: 400, maps: ['Bermuda', 'Kalahari'] }, { type: 'clutch', cents: 500 }],
    guild_points: [10, 7, 5] } }));
  ok(ev && ev.prize_total_cents === 4000 + 2000 + 1000 + 600 + 800 + 500, 'total de prêmios do evento', ev && ev.prize_total_cents);
  await refuse('line com tamanho errado', call(P[0], 'event_register', { p_id: ev.id, p: { name: 'Solo', members: [] } }), /2 jogadores/);
  const codes = {};
  for (const u of P) codes[u] = (await q1('select code from profiles where id = $1', [u])).code;
  const b0 = await bal(P[0]);
  await must('line 1', call(P[0], 'event_register', { p_id: ev.id, p: { name: 'Alfa Um', members: ['#' + codes[P[1]]] } }));
  ok(b0 - (await bal(P[0])) === 2000, 'capitão paga a inscrição da line');
  await refuse('jogador em duas lines', call(P[2], 'event_register', { p_id: ev.id, p: { name: 'Repetida', members: [P[1]] } }), /já está inscrito/);
  await must('line 2', call(P[2], 'event_register', { p_id: ev.id, p: { name: 'Alfa Dois', members: [P[3]] } }));
  await must('line 3', call(P[4], 'event_register', { p_id: ev.id, p: { name: 'Bravo', members: [P[5]] } }));
  await must('line 4', call(P[6], 'event_register', { p_id: ev.id, p: { name: 'Charlie', members: [P[7]] } }));
  await must('line 5', call(P[8], 'event_register', { p_id: ev.id, p: { name: 'Desiste', members: [P[9]] } }));
  const b8 = await bal(P[8]);
  await must('line 5 desiste', call(P[8], 'event_withdraw', { p_id: ev.id }));
  ok((await bal(P[8])) - b8 === 2000, 'desistência devolve a inscrição');
  const evv = Number((await q1('select vault_cents v from events where id = $1', [ev.id])).v);
  ok(evv === 8000, 'cofre do evento com 4 lines × R$ 20', evv);
  await conservation('inscrições do evento');
  await refuse('só admin cria quedas', call(P[0], 'admin_event_drops', { p_id: ev.id, p: {} }), /permissão/);
  const later = new Date(Date.now() + 7200e3).toISOString();
  // grupos de 4 jogadores (2 lines) por sala → 2 grupos × 2 quedas
  const evd = await must('cria quedas dos grupos', call(owner, 'admin_event_drops', { p_id: ev.id, p: { count: 2, starts_at: later, interval_min: 30, max_players: 4, maps: ['Bermuda', 'Kalahari'], mechanics: [{ type: 'first_blood', cents: 100 }] } }));
  const rooms0 = (evd ? evd.rooms : []).filter((r) => r.phase === 0);
  ok(rooms0.length === 4 && rooms0.every((r) => r.restricted && r.official && r.players === 4), '4 quedas exclusivas com as lines dentro', rooms0.map((r) => [r.group_label, r.players]));
  ok(evd && evd.status === 'andamento', 'evento entra em andamento');
  await refuse('ninguém entra em queda exclusiva', call(P[10], 'join_room', { p_id: rooms0[0].id }), /exclusiva/);
  const lineOf = {};
  for (const [name, a, b] of [['Alfa Um', P[0], P[1]], ['Alfa Dois', P[2], P[3]], ['Bravo', P[4], P[5]], ['Charlie', P[6], P[7]]]) { lineOf[a] = name; lineOf[b] = name; }
  // cada queda: a primeira line da sala vence com 2 abates (quem abate é o capitão)
  for (const r of rooms0) {
    const g = await call(owner, 'get_room', { p_id: r.id });
    const ids = g.player_list.map((p) => p.id);
    const lines = [...new Set(ids.map((u) => lineOf[u]))];
    const winLine = r.group_label === 'A' ? 'Alfa Um' : (r.drop_no === 1 ? 'Bravo' : 'Charlie');
    const players = ids.map((u) => ({ user_id: u, kills: lineOf[u] === winLine && [P[0], P[4], P[6]].includes(u) ? 2 : 0, placement: lineOf[u] === winLine ? 1 : 2 }));
    await must('inicia queda', call(owner, 'start_room', { p_id: r.id, p_game_room_id: '7', p_password: 'q' }));
    const fb = players.find((p) => p.kills > 0).user_id;
    await must('finaliza queda', call(owner, 'finish_room', { p_id: r.id, p_results: { players, first_blood: fb } }));
    ok(lines.length === 2, 'duas lines por sala');
  }
  const ge = await must('classificação', call(P[0], 'get_event', { p_id: ev.id }));
  const st0 = ge ? ge.standings[0] : [];
  ok(st0.length === 4 && st0[0].name === 'Alfa Um' && st0[0].points === 2 * (12 + 2), 'Alfa Um lidera com 2 booyahs', st0.map((x) => [x.name, x.points]));
  await conservation('quedas dos grupos');
  await must('fecha grupos', call(owner, 'admin_event_close_phase', { p_id: ev.id }));
  const ge2 = await call(owner, 'get_event', { p_id: ev.id });
  const qual = ge2.overall.filter((x) => x.status === 'classificado').map((x) => x.name).sort();
  ok(ge2.current_phase === 1 && qual.length === 2 && qual.includes('Alfa Um'), 'top 2 classificados para a final', qual);
  const evf = await must('quedas da final', call(owner, 'admin_event_drops', { p_id: ev.id, p: { count: 1, starts_at: later, max_players: 4, maps: ['Kalahari'] } }));
  const fin = evf.rooms.filter((r) => r.phase === 1);
  ok(fin.length === 1 && fin[0].players === 4, 'final com as 2 lines', fin.map((r) => r.players));
  const gf = await call(owner, 'get_room', { p_id: fin[0].id });
  const other = qual.find((n) => n !== 'Alfa Um');
  await must('inicia final', call(owner, 'start_room', { p_id: fin[0].id, p_game_room_id: '7', p_password: 'q' }));
  await must('finaliza final', call(owner, 'finish_room', { p_id: fin[0].id, p_results: { players: gf.player_list.map((p) => ({ user_id: p.id, kills: lineOf[p.id] === other && [P[4], P[6]].includes(p.id) ? 1 : 0, placement: lineOf[p.id] === other ? 1 : 2 })) } }));
  const prevE = await must('prévia do evento', call(owner, 'admin_event_preview', { p_id: ev.id, p_picks: { clutch: P[1] } }));
  const champ = prevE && prevE.champion.name;
  ok(champ === other, 'campeão = quem venceu a final', champ);
  const EL = prevE ? prevE.lines : [];
  ok(sum(EL, P[0], 'evento_bonus') >= 1000 + 300, 'MVP do evento e line mais agressiva para Alfa Um', sum(EL, P[0], 'evento_bonus'));
  ok(sum(EL, P[1], 'evento_bonus') >= 500, 'clutch escolhido pela organização');
  ok(prevE && prevE.guild_points.length === 1 && prevE.guild_points[0].guild_id === guildA.id && prevE.guild_points[0].place === 2 && prevE.guild_points[0].points === 7, 'pontos de guilda para a line da Alfa', prevE && prevE.guild_points);
  const payout = prevE ? prevE.payout_cents : 0;
  const vaultNow = Number((await q1('select vault_cents v from events where id = $1', [ev.id])).v);
  ok(prevE && prevE.cover_platform_cents === Math.max(payout - vaultNow, 0), 'plataforma cobre a diferença', { payout, vaultNow, cover: prevE && prevE.cover_platform_cents });
  const fe = await must('finaliza evento', call(owner, 'admin_event_finish', { p_id: ev.id, p_picks: { clutch: P[1] } }));
  ok(fe && fe.payout_cents === payout, 'pagou o que a prévia mostrou');
  const champMembers = other === 'Bravo' ? [P[4], P[5]] : [P[6], P[7]];
  const inv = await q1("select count(*) n from inventory where item_id = 'titulo-campeao' and user_id = any($1)", [champMembers]);
  ok(Number(inv.n) === 2, 'campeões ganham o título', inv);
  const gr = await must('ranking de guildas', call(P[0], 'guild_ranking', { p_period: 'semana' }));
  ok(gr && gr.rows[0] && gr.rows[0].guild.id === guildA.id && gr.rows[0].points === 7, 'guilda soma pontos da semana', gr && gr.rows);
  await refuse('não finaliza duas vezes', call(owner, 'admin_event_finish', { p_id: ev.id, p_picks: {} }), /andamento/);
  await conservation('campeonato finalizado');

  // ---------------- intensivo: preço progressivo por line da mesma guilda
  const iv = await must('cria intensivo', call(owner, 'admin_event_save', { p: {
    kind: 'intensivo', title: 'Intensivo Teste', entry_type: 'line', line_size: 1, entry_cents: 2000, price_steps: [2000, 1500, 1200], require_guild: true,
    phases: [{ name: 'Treino', drops: 3, qualify: null }], prizes: [{ place: 1, cents: 5000, note: '+ 100 diamantes' }], guild_points: [10, 7, 5, 3, 1] } }));
  const bI = [await bal(P[0]), await bal(P[1]), await bal(P[2]), await bal(P[3])];
  await must('1ª line da guilda', call(P[0], 'event_register', { p_id: iv.id, p: { name: 'L1', members: [] } }));
  await must('2ª line da guilda', call(P[1], 'event_register', { p_id: iv.id, p: { name: 'L2', members: [] } }));
  await must('3ª line da guilda', call(P[2], 'event_register', { p_id: iv.id, p: { name: 'L3', members: [] } }));
  await must('4ª line da guilda', call(P[3], 'event_register', { p_id: iv.id, p: { name: 'L4', members: [] } }));
  const paid = [bI[0] - await bal(P[0]), bI[1] - await bal(P[1]), bI[2] - await bal(P[2]), bI[3] - await bal(P[3])];
  ok(paid.join() === '2000,1500,1200,1200', 'preço progressivo R$ 20 / 15 / 12', paid);
  await refuse('sem guilda não entra no intensivo', call(P[10], 'event_register', { p_id: iv.id, p: { name: 'Sem', members: [] } }), /guilda/);
  const bRef = await bal(P[0]);
  await must('cancela intensivo', call(owner, 'admin_event_status', { p_id: iv.id, p_status: 'cancelado', p_reason: 'teste' }));
  ok((await bal(P[0])) - bRef === 2000, 'cancelamento devolve as inscrições');
  await conservation('intensivo cancelado');

  // ---------------- liga individual: quem joga a queda entra na classificação
  const lg = await must('cria liga', call(owner, 'admin_event_save', { p: {
    kind: 'liga', title: 'Liga Semanal', entry_type: 'jogador', line_size: 1, entry_cents: 0,
    points: { kill: 2, place: [15, 10, 8, 6, 6, 4, 4, 4, 4, 4, 2, 2] },
    phases: [{ name: 'Semana', drops: 14, qualify: 2 }, { name: 'Grande final', drops: 1, qualify: null }], prizes: [{ place: 1, cents: 3000 }] } }));
  const lgd = await must('quedas da liga', call(owner, 'admin_event_drops', { p_id: lg.id, p: { count: 2, starts_at: later, max_players: 3, entry_cents: 500, prizes: [{ place: 1, cents: 1000 }] } }));
  const lr = lgd.rooms;
  ok(lr.length === 2 && lr.every((r) => !r.restricted && r.entry_cents === 500), 'quedas abertas e pagas', lr.map((r) => r.entry_cents));
  for (const [k, r] of lr.entries()) {
    const trio = k === 0 ? [P[9], P[10], P[11]] : [P[10], P[11], P[9]];
    for (const u of trio) await must('entra na liga', call(u, 'join_room', { p_id: r.id }));
    await must('inicia liga', call(owner, 'start_room', { p_id: r.id, p_game_room_id: '5', p_password: 'l' }));
    await must('finaliza liga', call(owner, 'finish_room', { p_id: r.id, p_results: { players: trio.map((u, i) => ({ user_id: u, kills: i === 0 ? 2 : 0, placement: i + 1 })) } }));
  }
  const gl = await call(P[9], 'get_event', { p_id: lg.id });
  ok(gl.standings[0].length === 3 && gl.standings[0][0].points === 29 && gl.standings[0][1].points === 27, 'liga soma pontos (abate vale 2)', gl.standings[0].map((x) => [x.name, x.points]));
  await must('fecha semana', call(owner, 'admin_event_close_phase', { p_id: lg.id }));
  const gfin = await must('grande final', call(owner, 'admin_event_drops', { p_id: lg.id, p: { count: 1, starts_at: later, max_players: 12 } }));
  const gr1 = gfin.rooms.find((r) => r.phase === 1);
  ok(gr1 && gr1.restricted && gr1.players === 2, 'grande final só com os classificados', gr1 && gr1.players);
  await conservation('liga');

  // ---------------- tema do dia e início
  const home = await must('início', call(P[0], 'home'));
  ok(home && home.theme && home.theme.name && home.theme.base && Array.isArray(home.official) && Array.isArray(home.events), 'início traz tema do dia, salas oficiais e eventos', home && home.theme);
  const dash = await must('painel extra', call(owner, 'admin_dashboard_extra'));
  ok(dash && dash.prizes_week > 0, 'painel soma prêmios dos eventos', dash);

  // ---------------- teto da premiação: com a sala cheia, no máximo 70% vai para os jogadores
  const meT = await must('me com teto', call(creator, 'me'));
  ok(meT && meT.settings.max_player_pct === 70, 'me traz o teto da premiação', meT && meT.settings.max_player_pct);
  const cap10 = { title: 'Sala Justa', max_players: 10, entry_cents: 1000, starts_at: start, mechanics: [{ type: 'por_kill', cents: 200 }] };
  await refuse('organizador não passa do teto', call(creator, 'create_room', { p: { ...cap10, prizes: [{ place: 1, cents: 5201 }] } }), /acima do limite/);
  await refuse('sala oficial também respeita o teto', call(owner, 'create_room', { p: { ...cap10, official: true, prizes: [{ place: 1, cents: 5201 }] } }), /acima do limite/);
  const rt = await must('sala exatamente no teto', call(creator, 'create_room', { p: { ...cap10, prizes: [{ place: 1, cents: 5200 }] } }));
  ok(rt && rt.split_full.creator_cents + rt.split_full.platform_cents === 3000, 'sobra de 30% entre organizador e plataforma', rt && rt.split_full);
  await refuse('editar não passa do teto', call(creator, 'update_room', { p_id: rt && rt.id, p: { ...cap10, prizes: [{ place: 1, cents: 5300 }] } }), /acima do limite/);
  await refuse('mecânicas que não cabem', call(creator, 'update_room', { p_id: rt && rt.id, p: { ...cap10, prizes: [{ place: 1, cents: 5200 }],
    mechanics: [...cap10.mechanics, { type: 'booyah', cents: 1 }] } }), /acima do limite/);
  await must('cancela sala do teto', call(creator, 'cancel_room', { p_id: rt && rt.id, p_reason: 'teste' }));
  await refuse('teto fora da faixa', call(owner, 'admin_set_settings', { p: { max_player_pct: 99 } }), /10% a 95%/);
  await refuse('teto abaixo do piso', call(owner, 'admin_set_settings', { p: { max_player_pct: 40 } }), /piso e o teto/);
  const st80 = await must('dono sobe o teto', call(owner, 'admin_set_settings', { p: { max_player_pct: 80 } }));
  ok(st80 && Number(st80.max_player_pct) === 80, 'teto salvo', st80 && st80.max_player_pct);
  const r80 = await must('sala com teto de 80%', call(creator, 'create_room', { p: { ...cap10, prizes: [{ place: 1, cents: 6200 }] } }));
  await must('cancela', call(creator, 'cancel_room', { p_id: r80 && r80.id, p_reason: 'teste' }));
  await must('teto volta a 70%', call(owner, 'admin_set_settings', { p: { max_player_pct: 70 } }));
  await refuse('modelo acima do teto', call(owner, 'admin_template_save', { p: { id: 'guloso', title: 'Gulosa', tier: 'base', max_players: 10, entry_cents: 1000,
    prizes: [{ place: 1, cents: 7001 }] } }), /acima do limite/);
  for (const t of tpl || []) {
    const rr = await must('modelo ' + t.id + ' cabe no teto', call(owner, 'create_room', { p: { title: t.name, template_id: t.id, tier: t.tier, team_size: t.team_size,
      max_players: t.max_players, entry_cents: t.entry_cents, prizes: t.prizes, mechanics: t.mechanics, starts_at: start, official: true } }));
    if (rr) await call(owner, 'cancel_room', { p_id: rr.id, p_reason: 'teste' });
  }
  await conservation('teto');

  // ---------------- loja nova: banners animados, anime, acessórios e fundos
  const sh = await must('loja nova', call(P[0], 'shop'));
  const items = sh ? sh.items : [];
  ok(items.filter((i) => i.kind === 'acessorio' && i.price_cents).length >= 10 && items.filter((i) => i.kind === 'fundo' && i.price_cents).length >= 8
     && items.filter((i) => i.kind === 'banner' && i.data && i.data.anim).length >= 12, 'loja com acessórios, fundos e banners animados',
     { a: items.filter((i) => i.kind === 'acessorio').length, f: items.filter((i) => i.kind === 'fundo').length });
  const bS = await bal(P[0]);
  await must('compra chapéu de palha', call(P[0], 'buy_item', { p_item: 'acc-palha' }));
  await must('compra fundo sakura', call(P[0], 'buy_item', { p_item: 'fundo-sakura' }));
  await must('compra banner kitsune', call(P[0], 'buy_item', { p_item: 'banner-kitsune' }));
  ok(bS - (await bal(P[0])) === 490 + 790 + 1290, 'compras debitadas', bS - (await bal(P[0])));
  const meS = await must('me equipado', call(P[0], 'me'));
  ok(meS && meS.equipped.accessory_key === 'palha' && meS.equipped.background_data.fx === 'sakura' && meS.equipped.banner_data.art === 'kitsune',
     'acessório, fundo e banner equipados', meS && meS.equipped);
  const pf = await must('perfil público', call(P[1], 'get_profile', { p_user: P[0] }));
  ok(pf && pf.accessory === 'palha' && pf.background_data.fx === 'sakura' && pf.banner_data.anim === 'flames', 'outros veem o visual', pf && { a: pf.accessory, b: pf.banner_data });
  await must('troca de acessório', call(P[0], 'buy_item', { p_item: 'acc-cartola' }));
  const pf2 = await call(P[1], 'get_profile', { p_user: P[0] });
  ok(pf2.accessory === 'cartola', 'um acessório por vez', pf2.accessory);
  ok(!items.find((i) => i.id === 'acc-bruxa') && items.find((i) => i.id === 'acc-asas'), 'acessórios desenhados à mão saíram, os 3D entraram');
  const lv18 = await q1("select item_id from rewards where level = 18");
  ok(lv18 && lv18.item_id === 'acc-capelo', 'recompensa do nível 18 é o capelo', lv18);
  await must('tira o acessório', call(P[0], 'unequip_item', { p_kind: 'acessorio' }));
  await must('tira o fundo', call(P[0], 'unequip_item', { p_kind: 'fundo' }));
  const pf3 = await call(P[1], 'get_profile', { p_user: P[0] });
  ok(pf3.accessory === null && pf3.background_data === null, 'sem acessório nem fundo', pf3 && { a: pf3.accessory, b: pf3.background_data });
  await refuse('recompensa não se compra', call(P[0], 'buy_item', { p_item: 'acc-capelo' }), /recompensa/);
  await must('admin cria acessório', call(owner, 'admin_shop_save', { p: { id: 'acc-teste', kind: 'acessorio', name: 'Teste', price_cents: 100, data: { acc: 'gato' } } }));
  await conservation('loja nova');

  // ---------------- convite de testador (link de entrada só para quem nunca entrou)
  await refuse('jogador não gera convite', call(P[0], 'admin_invite_check', { p_email: 'amigo@bh.gg' }), /permissão/);
  const cv = await must('dono gera convite', call(owner, 'admin_invite_check', { p_email: ' Amigo@BH.gg ' }));
  ok(cv && cv.email === 'amigo@bh.gg' && cv.exists === false, 'convite para e-mail novo', cv);
  await refuse('convite com e-mail inválido', call(owner, 'admin_invite_check', { p_email: 'nada' }), /inválido/);
  await db.query('update auth.users set last_sign_in_at = now() where id = $1', [P[0]]);
  const e0 = (await q1('select email from auth.users where id = $1', [P[0]])).email;
  await refuse('não gera link para conta ativa', call(owner, 'admin_invite_check', { p_email: e0 }), /já entrou/);
  const e1 = (await q1('select email from auth.users where id = $1', [P[1]])).email;
  const inv2 = await must('conta que nunca entrou', call(owner, 'admin_invite_check', { p_email: e1 }));
  ok(inv2 && inv2.exists === true, 'convite vale para conta criada que nunca entrou', inv2);

  // ---------------- moderação: palavras proibidas, bio sem link nem telefone, chat com asteriscos
  const prof = (u, o) => ({ p_nick: o.nick, p_bio: o.bio || '', p_avatar_url: o.av === undefined ? null : o.av, p_anonymous: false });
  const nick9 = (await q1('select nick from profiles where id = $1', [P[9]])).nick;
  await refuse('nick com palavrão', call(P[9], 'update_profile', prof(P[9], { nick: 'Porr4 Loka' })), /não é permitida/);
  await refuse('nick com palavrão disfarçado', call(P[9], 'update_profile', prof(P[9], { nick: 'Fdp_King' })), /não é permitida/);
  await refuse('bio com palavrão', call(P[9], 'update_profile', prof(P[9], { nick: nick9, bio: 'jogo muito, sou CARAAALHO' })), /não é permitida/);
  await refuse('bio com telefone', call(P[9], 'update_profile', prof(P[9], { nick: nick9, bio: 'chama no zap (11) 98765-4321' })), /telefone/);
  await refuse('bio com link', call(P[9], 'update_profile', prof(P[9], { nick: nick9, bio: 'vendo conta em loja-ff.com.br/barato' })), /links/);
  await refuse('bio vendendo hack', call(P[9], 'update_profile', prof(P[9], { nick: nick9, bio: 'vendo MOD MENU e aimbot' })), /não é permitida/);
  const okBio = await must('bio normal', call(P[9], 'update_profile', prof(P[9], { nick: 'Escudo Azul', bio: 'Rush de Bermuda, 100 kills por semana. GG!' })));
  ok(okBio && okBio.nick === 'Escudo Azul', 'palavra dentro de outra não bloqueia (escudo, computador)');
  await refuse('guilda com palavrão', call(P[10], 'create_guild', { p: { name: 'Tropa do Caralho', tag: 'TDC', cut_pct: 0 } }), /não é permitida/);
  const th = await must('mensagem com palavrão', call(P[10], 'message_player', { p_user: P[11], p_body: 'seu p0rr4, joga direito!', p_room: null, p_image: null }));
  const msg = th && await q1('select app.msg_text(body_enc, body, app.chat_key()) body from messages where thread_id = $1 order by id desc limit 1', [th.thread_id]);
  ok(msg && msg.body === 'seu *****, joga direito!', 'chat troca palavrão por asteriscos', msg);
  await refuse('jogador não vê a lista de palavras', call(P[0], 'admin_banned_words'), /permissão/);
  const words = await must('lista de palavras', call(owner, 'admin_banned_words'));
  ok(words && words.includes('porra') && words.includes('aimbot'), 'lista de palavras proibidas', words && words.length);
  await must('dono acrescenta palavra', call(owner, 'admin_banned_words_set', { p_words: [...words, 'Noobzão'] }));
  await refuse('palavra nova bloqueia', call(P[9], 'update_profile', prof(P[9], { nick: 'Escudo Azul', bio: 'sou noobzao' })), /não é permitida/);
  await must('lista volta', call(owner, 'admin_banned_words_set', { p_words: words }));

  // ---------------- foto de perfil só aparece para os outros depois da aprovação
  const fotoA = 'https://cdn.bh.gg/avatars/' + P[9] + '/a.jpg', fotoB = 'https://cdn.bh.gg/avatars/' + P[9] + '/b.jpg';
  const meF = await must('troca a foto', call(P[9], 'update_profile', prof(P[9], { nick: 'Escudo Azul', av: fotoA })));
  ok(meF && meF.avatar_url === fotoA && meF.avatar_pending === true, 'a própria pessoa vê a foto em análise', meF && [meF.avatar_url, meF.avatar_pending]);
  const seen = await call(P[10], 'get_profile', { p_user: P[9] });
  ok(seen && !seen.avatar_url, 'os outros ainda não veem a foto nova', seen && seen.avatar_url);
  await refuse('jogador não modera fotos', call(P[0], 'admin_photo_queue'), /permissão/);
  const qF = await must('fila de fotos', call(owner, 'admin_photo_queue'));
  ok(qF && qF.length === 1 && qF[0].pending_url === fotoA, 'foto na fila da equipe', qF);
  const meAdm = await call(owner, 'me');
  ok(meAdm.admin_pending && meAdm.admin_pending.photos === 1, 'contador de fotos no painel', meAdm.admin_pending);
  await refuse('recusa sem motivo', call(owner, 'admin_photo_review', { p_user: P[9], p_approve: false, p_note: ' ' }), /motivo/);
  await must('recusa a foto', call(owner, 'admin_photo_review', { p_user: P[9], p_approve: false, p_note: 'Foto imprópria' }));
  const meF2 = await call(P[9], 'me');
  ok(!meF2.avatar_url && !meF2.avatar_pending, 'foto recusada some', [meF2.avatar_url, meF2.avatar_pending]);
  const nf = await q1("select title from notifications where user_id = $1 order by created_at desc limit 1", [P[9]]);
  ok(nf && nf.title === 'Foto recusada', 'jogador é avisado da recusa', nf);
  await refuse('não analisa duas vezes', call(owner, 'admin_photo_review', { p_user: P[9], p_approve: true, p_note: null }), /já foi analisada/);
  await must('manda outra foto', call(P[9], 'update_profile', prof(P[9], { nick: 'Escudo Azul', av: fotoB })));
  await must('aprova a foto', call(owner, 'admin_photo_review', { p_user: P[9], p_approve: true, p_note: null }));
  const seen2 = await call(P[10], 'get_profile', { p_user: P[9] });
  ok(seen2 && seen2.avatar_url === fotoB, 'foto aprovada aparece para todos', seen2 && seen2.avatar_url);
  await must('salva o perfil sem trocar a foto', call(P[9], 'update_profile', prof(P[9], { nick: 'Escudo Azul', bio: 'GG', av: fotoB })));
  ok((await q1('select avatar_pending from profiles where id = $1', [P[9]])).avatar_pending === null, 'mesma foto não volta para a fila');
  const fotoDono = 'https://cdn.bh.gg/avatars/' + owner + '/d.jpg';
  await must('equipe troca a foto direto', call(owner, 'update_profile', prof(owner, { nick: (await q1('select nick from profiles where id = $1', [owner])).nick, av: fotoDono })));
  ok((await q1('select avatar_url from profiles where id = $1', [owner])).avatar_url === fotoDono, 'foto da equipe não passa pela fila');
  await refuse('moderar sem motivo', call(owner, 'admin_user_moderate', { p_user: P[9], p_action: 'foto', p_reason: '' }), /motivo/);
  await must('equipe remove a foto', call(owner, 'admin_user_moderate', { p_user: P[9], p_action: 'foto', p_reason: 'Nudez' }));
  await must('equipe apaga a bio', call(owner, 'admin_user_moderate', { p_user: P[9], p_action: 'bio', p_reason: 'Ofensa' }));
  const mod9 = await q1('select avatar_url, bio from profiles where id = $1', [P[9]]);
  ok(mod9.avatar_url === null && mod9.bio === '', 'foto e bio apagadas pela equipe', mod9);

  // ---------------- análise de partida (suspeita de hack)
  const mod = P[11];
  await must('P11 vira moderador', call(owner, 'admin_set_role', { p_user: mod, p_role: 'moderador' }));
  for (const u of P.slice(0, 6)) await db.query("update profiles set ff_status = 'aprovado' where id = $1", [u]);
  const rc = await must('sala da análise', call(creator, 'create_room', { p: { title: 'Sala Suspeita', max_players: 6, entry_cents: 1000, starts_at: start, prizes: [{ place: 1, cents: 3000 }] } }));
  for (let i = 0; i < 6; i++) await must('entra', call(P[i], 'join_room', { p_id: rc.id }));
  const sus = P[3];
  await refuse('análise só depois de começar', call(mod, 'admin_case_open', { p_room: rc.id, p_suspect: sus, p_reason: 'Capa atrás da parede' }), /já começaram/);
  await must('inicia', call(creator, 'start_room', { p_id: rc.id, p_game_room_id: '3', p_password: 'h' }));
  await must('finaliza', call(creator, 'finish_room', { p_id: rc.id, p_results: { players: [sus, ...P.slice(0, 6).filter((u) => u !== sus)].map((u, i) => ({ user_id: u, kills: u === sus ? 5 : 0, placement: i + 1 })) } }));
  await must('P1 denuncia o suspeito', call(P[1], 'report_player', { p_user: sus, p_room: rc.id, p_reason: 'hack', p_detail: 'Capa atrás da parede' }));
  await must('suspeito pede saque antes da análise', call(sus, 'request_withdrawal', { p_cents: 2000, p_key_type: 'E-mail', p_key: 'Hacker.Pix@BH.gg' }));
  await must('suspeito informa o aparelho', call(sus, 'set_device', { p_device: 'aparelho-do-suspeito' }));
  await refuse('jogador não abre análise', call(P[0], 'admin_case_open', { p_room: rc.id, p_suspect: sus, p_reason: 'x' }), /permissão/);
  await refuse('análise de quem não jogou', call(mod, 'admin_case_open', { p_room: rc.id, p_suspect: P[10], p_reason: 'x' }), /não jogou/);
  await refuse('análise sem motivo', call(mod, 'admin_case_open', { p_room: rc.id, p_suspect: sus, p_reason: ' ' }), /motivo/);
  const cs = await must('moderador abre análise', call(mod, 'admin_case_open', { p_room: rc.id, p_suspect: sus, p_reason: 'Capa atrás da parede' }));
  ok(cs && cs.status === 'aguardando_video' && cs.thread_id && cs.players.length === 6 && cs.suspect.balance_cents > 0, 'análise aberta com os jogadores da sala', cs && { s: cs.status, p: cs.players.length });
  await refuse('duas análises iguais', call(mod, 'admin_case_open', { p_room: rc.id, p_suspect: sus, p_reason: 'de novo' }), /Já existe/);
  const rep = await q1('select status, resolution from reports where target_id = $1 and room_id = $2', [sus, rc.id]);
  ok(rep.status === 'resolvida' && /caso #/.test(rep.resolution), 'denúncia vira análise', rep);
  const meS1 = await must('suspeito vê o aviso', call(sus, 'me'));
  const ck = meS1 && meS1.cheat_case;
  ok(ck && ck.id === cs.id && ck.thread_id === cs.thread_id && !ck.video_sent && ck.room.id === rc.id, 'aviso da análise no me()', ck);
  ok((await call(P[0], 'me')).cheat_case === null, 'quem não está em análise não vê aviso');
  const firstMsg = await q1('select app.msg_text(body_enc, body, app.chat_key()) body, sender_id from messages where thread_id = $1 order by id limit 1', [cs.thread_id]);
  ok(firstMsg && firstMsg.sender_id === mod && /caso #/.test(firstMsg.body), 'mensagem da análise no chat do moderador', firstMsg);
  await refuse('saque pausado na análise', call(sus, 'request_withdrawal', { p_cents: 1000, p_key_type: 'E-mail', p_key: 'outra@bh.gg' }), /pausados/);
  const wd = await q1("select id from withdrawals where user_id = $1 and status = 'pendente'", [sus]);
  await refuse('não paga saque de quem está em análise', call(owner, 'admin_withdrawal', { p_id: wd.id, p_paid: true, p_note: null }), /em análise/);
  await refuse('outro jogador não manda vídeo', call(P[4], 'case_submit_video', { p_case: cs.id, p_path: P[4] + '/v.mp4', p_link: null, p_consent: true }), /não encontrada/);
  await refuse('vídeo sem nada', call(sus, 'case_submit_video', { p_case: cs.id, p_path: null, p_link: ' ', p_consent: true }), /vídeo/);
  await refuse('arquivo de outra pasta', call(sus, 'case_submit_video', { p_case: cs.id, p_path: P[4] + '/v.mp4', p_link: null, p_consent: true }), /inválido/);
  await refuse('link inválido', call(sus, 'case_submit_video', { p_case: cs.id, p_path: null, p_link: 'ftp://video', p_consent: true }), /https/);
  const sv = await must('suspeito manda o vídeo', call(sus, 'case_submit_video', { p_case: cs.id, p_path: sus + '/caso.mp4', p_link: 'https://drive.google.com/file/d/abc', p_consent: true }));
  ok(sv && sv.video_sent && sv.status === 'em_analise', 'vídeo recebido, análise em andamento', sv);
  const nmod = await q1("select kind, data from notifications where user_id = $1 order by created_at desc limit 1", [mod]);
  ok(nmod && nmod.kind === 'analise' && nmod.data.case_id === cs.id, 'moderador é avisado do vídeo', nmod);
  const up = await must('marca os prejudicados', call(mod, 'admin_case_update', { p_id: cs.id, p: { victims: [P[0], P[1], sus, P[10]] } }));
  ok(up && up.victims.length === 2 && up.victims.includes(P[0]) && up.victims.includes(P[1]), 'só jogadores da sala (e não o suspeito) viram prejudicados', up && up.victims);
  ok(up && up.players.filter((x) => x.victim).length === 2 && up.players.find((x) => x.suspect).kills === 5, 'lista separada dos prejudicados', up && up.players.map((x) => [x.victim, x.kills]));
  const callR = await must('chamada de voz', call(mod, 'admin_case_call', { p_id: cs.id }));
  ok(callR && /^https:\/\/meet\.jit\.si\/BattleHub-Analise-\d+-[0-9a-f]{10}$/.test(callR.link), 'link da chamada com compartilhamento de tela', callR);
  const nsus = await q1("select kind, data from notifications where user_id = $1 and kind = 'analise' order by created_at desc limit 1", [sus]);
  ok(nsus && nsus.data.link === callR.link, 'suspeito recebe o link da chamada', nsus);
  ok((await call(sus, 'my_case')).call_link === callR.link, 'link aparece no aviso');
  const pvP = await must('prévia prejudicados', call(mod, 'admin_case_preview', { p_id: cs.id, p_mode: 'prejudicados' }));
  const pvT = await must('prévia todos', call(mod, 'admin_case_preview', { p_id: cs.id, p_mode: 'todos' }));
  const susTotal = (await bal(sus)) + 2000;
  ok(pvP && pvP.refund_total === 2000 && pvP.refunds.length === 2 && pvT.refund_total === 5000 && pvP.confiscate === susTotal, 'prévia do que volta e do que fica retido', pvP && { p: pvP.refund_total, t: pvT.refund_total, c: pvP.confiscate });
  await refuse('moderador não confirma trapaça', call(mod, 'admin_case_resolve', { p_id: cs.id, p_hack: true, p_mode: 'prejudicados', p_note: 'hack' }), /Só admins/);
  await refuse('veredito sem resultado escrito', call(owner, 'admin_case_resolve', { p_id: cs.id, p_hack: true, p_mode: 'prejudicados', p_note: '' }), /resultado/);
  const b0v = await bal(P[0]), b1v = await bal(P[1]), b2v = await bal(P[2]), plV = await platform();
  const rs = await must('confirma trapaça', call(owner, 'admin_case_resolve', { p_id: cs.id, p_hack: true, p_mode: 'prejudicados', p_note: 'Mira grudando atrás da parede no vídeo' }));
  ok(rs && rs.status === 'confirmado' && rs.result.refund_total === 2000 && rs.result.confiscated === susTotal && rs.result.withdrawals_refused === 2000, 'resultado registrado', rs && rs.result);
  ok((await bal(P[0])) - b0v === 1000 && (await bal(P[1])) - b1v === 1000 && (await bal(P[2])) === b2v, 'prejudicados recebem a inscrição de volta, os outros não');
  const ws = await q1('select balance_cents, held_cents from wallets where user_id = $1', [sus]);
  ok(Number(ws.balance_cents) === 0 && Number(ws.held_cents) === 0, 'trapaceiro perde o saldo', ws);
  ok((await q1('select status from withdrawals where id = $1', [wd.id])).status === 'recusado', 'saque pendente recusado');
  ok((await platform()) - plV === susTotal - 2000, 'plataforma paga as devoluções e fica com o saldo retido', (await platform()) - plV);
  await refuse('trapaceiro banido para sempre', call(sus, 'home'), /suspensa/);
  const banned = await q1('select banned_until from profiles where id = $1', [sus]);
  ok(banned.banned_until === Infinity || String(banned.banned_until) === 'infinity', 'ban permanente', banned);
  const bl = await must('lista de bloqueio', call(mod, 'admin_blocklist'));
  const ffSus = (await q1('select ff_id from profiles where id = $1', [sus])).ff_id;
  ok(bl && bl.find((b) => b.kind === 'ff_id' && b.value === ffSus) && bl.find((b) => b.kind === 'pix' && b.value === 'hacker.pix@bh.gg') && bl.find((b) => b.kind === 'device' && b.value === 'aparelho-do-suspeito'),
     'ID do Free Fire, chave Pix e aparelho bloqueados', bl);
  await refuse('análise encerrada não muda', call(owner, 'admin_case_resolve', { p_id: cs.id, p_hack: false, p_mode: null, p_note: 'x' }), /encerrada/);
  await conservation('trapaça confirmada');
  // conta nova do trapaceiro
  const alt = await mk('conta-nova@bh.gg');
  await refuse('ID do Free Fire banido não volta', call(alt, 'complete_onboarding', { p_nick: 'Conta Nova', p_ff_nick: 'Outro', p_ff_id: ffSus, p_photo_path: alt + '/ff.jpg' }), /banido/);
  await must('cadastro com outro ID', call(alt, 'complete_onboarding', { p_nick: 'Conta Nova', p_ff_nick: 'Outro', p_ff_id: '299999999', p_photo_path: alt + '/ff.jpg' }));
  const sd = await must('mesmo aparelho', call(alt, 'set_device', { p_device: 'aparelho-do-suspeito' }));
  ok(sd && sd.banned === true, 'aparelho bloqueado bane a conta nova', sd);
  await refuse('conta nova banida', call(alt, 'home'), /suspensa/);
  await refuse('chave Pix bloqueada', call(P[5], 'request_withdrawal', { p_cents: 1000, p_key_type: 'E-mail', p_key: ' hacker.pix@bh.gg' }), /bloqueada/);
  await refuse('moderador não tira da lista', call(mod, 'admin_blocklist_remove', { p_kind: 'pix', p_value: 'hacker.pix@bh.gg' }), /permissão/);
  const bl2 = await must('dono tira da lista', call(owner, 'admin_blocklist_remove', { p_kind: 'pix', p_value: 'hacker.pix@bh.gg' }));
  ok(bl2 && !bl2.find((b) => b.kind === 'pix'), 'chave Pix liberada', bl2);
  // análise sem trapaça: saques voltam
  const cs2 = await must('segunda análise', call(mod, 'admin_case_open', { p_room: rc.id, p_suspect: P[4], p_reason: 'Movimento estranho' }));
  await refuse('saque pausado', call(P[4], 'request_withdrawal', { p_cents: 1000, p_key_type: 'E-mail', p_key: 'p4@bh.gg' }), /pausados/);
  await refuse('não exclui a conta em análise', call(P[4], 'delete_my_account', { p_forfeit: true }), /em análise/);
  const ls = await must('lista de análises', call(mod, 'admin_cases', { p_status: 'abertas' }));
  ok(ls && ls.length === 1 && ls[0].id === cs2.id, 'lista só com as abertas', ls && ls.length);
  ok((await call(owner, 'me')).admin_pending.cases === 1, 'contador de análises no painel');
  const rs2 = await must('moderador descarta', call(mod, 'admin_case_resolve', { p_id: cs2.id, p_hack: false, p_mode: null, p_note: 'Vídeo limpo' }));
  ok(rs2 && rs2.status === 'descartado', 'análise descartada', rs2 && rs2.status);
  await must('saque volta ao normal', call(P[4], 'request_withdrawal', { p_cents: 1000, p_key_type: 'E-mail', p_key: 'p4@bh.gg' }));
  ok((await call(P[4], 'me')).cheat_case === null, 'aviso some');
  const cf = await must('confirmadas', call(mod, 'admin_cases', { p_status: 'confirmado' }));
  ok(cf && cf.length === 1 && cf[0].victims === 2, 'histórico de trapaças confirmadas', cf);
  // devolver para todos da sala
  const rt2 = await must('outra sala', call(creator, 'create_room', { p: { title: 'Sala Todos', max_players: 4, entry_cents: 1000, starts_at: start, prizes: [{ place: 1, cents: 2000 }] } }));
  for (const u of [P[5], P[6], P[7], P[10]]) await must('entra', call(u, 'join_room', { p_id: rt2.id }));
  await must('inicia', call(creator, 'start_room', { p_id: rt2.id, p_game_room_id: '4', p_password: 't' }));
  const cs3 = await must('análise durante a partida', call(owner, 'admin_case_open', { p_room: rt2.id, p_suspect: P[10], p_reason: 'Velocidade' }));
  await refuse('prejudicados vazios', call(owner, 'admin_case_resolve', { p_id: cs3.id, p_hack: true, p_mode: 'prejudicados', p_note: 'hack' }), /Marque os prejudicados/);
  const bT = [await bal(P[5]), await bal(P[6]), await bal(P[7])];
  const rs3 = await must('confirma devolvendo para todos', call(owner, 'admin_case_resolve', { p_id: cs3.id, p_hack: true, p_mode: 'todos', p_note: 'Speed hack' }));
  ok(rs3 && rs3.result.refunds.length === 3 && rs3.result.refund_total === 3000, 'todos da sala recebem de volta', rs3 && rs3.result);
  ok((await bal(P[5])) - bT[0] === 1000 && (await bal(P[6])) - bT[1] === 1000 && (await bal(P[7])) - bT[2] === 1000, 'inscrição devolvida para todos');
  await conservation('devolução para todos');

  // ---------------- excluir a própria conta
  const quit = P[8];
  await refuse('não exclui com saldo sem abrir mão', call(quit, 'delete_my_account', { p_forfeit: false }), /carteira/);
  const plQ = await platform(), balQ = await bal(quit);
  const del = await must('exclui a conta', call(quit, 'delete_my_account', { p_forfeit: true }));
  ok(del && del.forfeit_cents === balQ && (await platform()) - plQ === balQ, 'saldo deixado vai para a plataforma', del);
  const gone = await q1('select p.nick, p.ff_id, p.avatar_url, u.email from profiles p join auth.users u on u.id = p.id where p.id = $1', [quit]);
  ok(gone.ff_id === null && gone.avatar_url === null && /^Conta excluída/.test(gone.nick) && /@battlehub\.invalid$/.test(gone.email), 'dados pessoais apagados', gone);
  await refuse('conta excluída não entra mais', call(quit, 'home'), /suspensa/);
  await refuse('dono não se exclui', call(owner, 'delete_my_account', { p_forfeit: true }), /dona/);
  await conservation('conta excluída');

  console.log(`\n${passed} verificações passaram, ${fails.length} falharam`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  await db.end();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log(`${passed} ok antes do erro; falhas:`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(2); });
