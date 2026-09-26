// Testa as lines da guilda: criar (1 a 4), código, recrutamento com critérios, pedidos, gestão e sinergia com recompensas.
// Uso: tests/reset.sh e depois  node supabase/tests/lines.test.js
const H = require('./_util')();
const { db, call, ok, must, refuse, q1, count, mk } = H;

H.run(async () => {
  const dono = await mk('dono@bh.gg');
  const U = [];
  for (let i = 1; i <= 9; i++) U.push(await mk('u' + i + '@bh.gg'));
  const all = [dono, ...U];
  for (let i = 0; i < all.length; i++) await call(all[i], 'complete_onboarding', { p_nick: 'Jog' + i, p_ff_nick: 'FF' + i, p_ff_id: String(600000000 + i), p_photo_path: all[i] + '/ff.jpg' });
  await db.query("update profiles set ff_status = 'aprovado'");
  const [lider, a, b, c, d, novato, outraG, forte, extra] = U;
  // estatísticas para os critérios
  await db.query('update profiles set xp = 5000, kills = 300, wins = 20, matches = 100 where id = $1', [forte]);
  await db.query('update profiles set xp = 0, kills = 2, wins = 0, matches = 10 where id = $1', [novato]);

  const g = await must('cria guilda', call(lider, 'create_guild', { p: { name: 'Lobos', tag: 'LB' } }));
  await must('outra guilda', call(outraG, 'create_guild', { p: { name: 'Corvos', tag: 'CV' } }));
  await refuse('sem guilda não cria line', call(a, 'create_line', { p: { name: 'Alfa', size: 4 } }), /guilda/);
  await refuse('tamanho 5', call(lider, 'create_line', { p: { name: 'Alfa', size: 5 } }), /1 a 4/);
  await refuse('nome com palavrão', call(lider, 'create_line', { p: { name: 'porra', size: 4 } }), /nome da line/i);
  const L = await must('líder cria squad', call(lider, 'create_line', { p: { name: 'Alfa', size: 4 } }));
  ok(L && L.size === 4 && L.count === 1 && L.members[0].line_role === 'lider' && /^[A-Z2-9]{6}$/.test(L.code), 'squad com líder e código', L && { s: L.size, c: L.code });
  await refuse('líder não cria duas lines', call(lider, 'create_line', { p: { name: 'Beta', size: 2 } }), /já está numa line/);

  // ---------------- código: entra direto, inclusive na guilda
  await refuse('código errado', call(a, 'join_line_code', { p_code: 'ZZZZZZ' }), /não encontrado/);
  const ja = await must('entra pelo código (sem guilda)', call(a, 'join_line_code', { p_code: L.code.toLowerCase() }));
  ok(ja && ja.count === 2 && ja.mine, 'entrou na line');
  ok((await q1('select guild_id from guild_members where user_id = $1', [a])).guild_id === g.id, 'e entrou na guilda junto');
  await refuse('quem é de outra guilda não entra', call(outraG, 'join_line_code', { p_code: L.code }), /outra guilda/);
  ok((await call(b, 'guild_lines', { p_guild: g.id }))[0].code === null, 'quem é de fora não vê o código');
  await call(b, 'join_line_code', { p_code: L.code });
  await call(c, 'join_line_code', { p_code: L.code });
  await refuse('line completa', call(d, 'join_line_code', { p_code: L.code }), /completa/);

  // ---------------- recrutamento com critérios
  const D = await must('d cria dupla na mesma guilda? precisa guilda', call(d, 'create_guild', { p: { name: 'Falcões', tag: 'FA' } }));
  const L2 = await must('dupla recrutando com 2 critérios', call(d, 'create_line', { p: { name: 'Duo', size: 2, recruiting: true, req1_kind: 'nivel', req1_value: 5, req2_kind: 'media', req2_value: 15 } }));
  ok(L2 && L2.recruiting && L2.reqs.length === 2 && L2.reqs[1].label === 'Média de 1.5+ abates por sala', 'critérios com texto', L2 && L2.reqs);
  await refuse('critério repetido', call(d, 'line_manage', { p_line: L2.id, p_action: 'settings', p_user: null, p: { req1_kind: 'nivel', req1_value: 2, req2_kind: 'nivel', req2_value: 3 } }), /diferentes/);
  const list = await must('busca de lines recrutando', call(novato, 'list_recruiting_lines', { p_q: null, p_size: null }));
  ok(list && list.length === 1 && list[0].name === 'Duo' && list[0].eligible === false && list[0].code === null, 'novato vê a line, sem código e sem cumprir', list && list[0]);
  ok((await call(novato, 'list_recruiting_lines', { p_q: null, p_size: 4 })).length === 0, 'filtro por tamanho');
  ok((await call(novato, 'list_recruiting_lines', { p_q: 'FA', p_size: null })).length === 1, 'busca pela tag da guilda');
  await refuse('novato não cumpre', call(novato, 'line_request', { p_line: L2.id, p_message: 'bora' }), /critérios/);
  const rq = await must('forte pede para entrar', call(forte, 'line_request', { p_line: L2.id, p_message: 'jogo de rush, 1.5 kd' }));
  ok(rq && rq.requested && rq.count === 1, 'pedido fica esperando, sem entrar ainda');
  const v = await call(d, 'my_line', {});
  ok(v.requests.length === 1 && v.requests[0].stats.kills === 300 && v.requests[0].message === 'jogo de rush, 1.5 kd', 'líder vê "querem entrar" separado dos membros', v.requests);
  await refuse('membro comum não aceita', call(extra, 'line_respond', { p_line: L2.id, p_user: forte, p_accept: true }), /Só o líder/);
  const ac = await must('líder aceita', call(d, 'line_respond', { p_line: L2.id, p_user: forte, p_accept: true }));
  ok(ac && ac.count === 2 && ac.requests.length === 0, 'aceito entra na line');
  ok((await q1('select g.tag from guild_members gm join guilds g on g.id = gm.guild_id where gm.user_id = $1', [forte])).tag === 'FA', 'aceito entra na guilda da line');
  ok((await call(novato, 'list_recruiting_lines', { p_q: null, p_size: null })).length === 0, 'line completa sai da busca');

  // ---------------- gestão
  const nc = await must('novo código', call(lider, 'line_manage', { p_line: L.id, p_action: 'new_code', p_user: null, p: {} }));
  ok(nc && nc.code !== L.code, 'código trocado');
  await must('passa a liderança', call(lider, 'line_manage', { p_line: L.id, p_action: 'transfer', p_user: a, p: {} }));
  await must('remove membro', call(a, 'line_manage', { p_line: L.id, p_action: 'kick', p_user: c, p: {} }));
  await must('c sai da guilda (nada muda na line)', call(c, 'leave_guild', {}));
  await must('b sai da guilda e sai da line', call(b, 'leave_guild', {}));
  ok(await count('select count(*) n from guild_line_members where line_id = $1', [L.id]) === 2, 'b saiu da line junto com a guilda');
  await must('líder sai da line', call(a, 'leave_line', {}));
  ok((await q1('select leader_id from guild_lines where id = $1', [L.id])).leader_id === lider, 'liderança passa para o mais antigo');

  // ---------------- sinergia
  await call(dono, 'admin_set_settings', { p: { pix_key: 'pix@bh.gg' } });
  await call(lider, 'join_line_code', { p_code: 'X' }).catch(() => {});
  await call(b, 'join_line_code', { p_code: nc.code }); // b volta: squad com lider, b (e entra na guilda de novo)
  const start = new Date(Date.now() + 3600e3).toISOString();
  async function playRoom(players) {
    const r = await call(dono, 'create_room', { p: { title: 'Treino', max_players: 8, entry_cents: 0, starts_at: start, official: true } });
    for (const u of players) await call(u, 'join_room', { p_id: r.id });
    await call(dono, 'start_room', { p_id: r.id, p_game_room_id: '1', p_password: 'a' });
    await call(dono, 'finish_room', { p_id: r.id, p_results: { players: players.map((u, i) => ({ user_id: u, kills: 0, placement: i + 1 })) } });
    return r;
  }
  await playRoom([lider, b, novato]);
  let s1 = await q1('select synergy, synergy_tier from guild_lines where id = $1', [L.id]);
  ok(s1.synergy === 1, 'dois da line na mesma sala: +1', s1);
  await playRoom([d, forte]);
  ok((await q1('select synergy from guild_lines where id = $1', [L2.id])).synergy === 2, 'line inteira na sala: +2');
  await playRoom([lider, novato]);
  ok((await q1('select synergy from guild_lines where id = $1', [L.id])).synergy === 1, 'só um da line: não soma');
  for (let i = 0; i < 4; i++) await playRoom([d, forte]);
  const s2 = await q1('select synergy, synergy_tier from guild_lines where id = $1', [L2.id]);
  ok(s2.synergy === 10 && s2.synergy_tier === 1, 'chega a 10 pontos: nível 1', s2);
  ok(await count("select count(*) n from inventory where item_id = 'titulo-entrosados' and user_id in ($1, $2)", [d, forte]) === 2, 'os dois ganham o título "Entrosados"');
  ok(await count("select count(*) n from notifications where title like 'Sinergia nível 1%'") === 2, 'os dois são avisados');
  await must('equipa o título de sinergia', call(forte, 'equip_item', { p_item: 'titulo-entrosados' }));
  const my = await call(forte, 'my_line', {});
  ok(my.synergy === 10 && my.next_tier.points === 25, 'próximo nível aparece', my.next_tier);
  // mesma sala não conta duas vezes
  await db.query("update rooms set status = 'em_andamento' where id = (select room_id from line_synergy_log where line_id = $1 limit 1)", [L2.id]);
  await db.query("update rooms set status = 'finalizada' where status = 'em_andamento'");
  ok((await q1('select synergy from guild_lines where id = $1', [L2.id])).synergy === 10, 'sala repetida não soma de novo');
});
