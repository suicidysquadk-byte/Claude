// Testa o estilo da Loja do Discord: placa de identificação (atrás do nome nas listas) e moldura de perfil,
// compra de pacote (decoração + placa + moldura), equipar e desequipar, e a placa indo no cartão do jogador.
// Uso: tests/reset.sh e depois  node supabase/tests/placas.test.js
const H = require('./_util')();
const { db, call, ok, must, refuse, q1, count, mk } = H;

H.run(async () => {
  const dono = await mk('dono@bh.gg'), A = await mk('a@bh.gg'), B = await mk('b@bh.gg');
  for (const [u, n] of [[dono, 'Dono'], [A, 'Alfa'], [B, 'Beta']]) await call(u, 'complete_onboarding', { p_nick: n, p_ff_nick: n, p_ff_id: String(800000000 + n.charCodeAt(0)), p_photo_path: u + '/ff.jpg' });
  await db.query("update profiles set ff_status = 'aprovado'");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: dono })]);
  await db.query("select app.credit($1, 200000, 'ajuste', 'teste')", [A]);

  // catálogo
  ok((await count("select count(*) n from shop_items where kind = 'placa' and active")) >= 16, 'placas no catálogo');
  ok((await count("select count(*) n from shop_items where kind = 'perfil' and active")) >= 9, 'molduras de perfil no catálogo');
  ok((await count("select count(*) n from shop_items where id like 'mold-dc-%'")) >= 27, 'decorações de avatar estilo Discord');
  ok((await count("select count(*) n from shop_items b, jsonb_array_elements_text(b.data -> 'items') x(i) where b.kind = 'bundle' and not exists (select 1 from shop_items s where s.id = x.i)")) === 0, 'toda peça dos pacotes existe');

  // pacote: compra entrega as 3 peças e equipar veste tudo (placa e moldura de perfil incluídas)
  await refuse('placa sem ter', call(A, 'set_look', { p: { placa: { i: 'placa-guaxinim' } } }), /ainda não tem/);
  await must('compra o pacote', call(A, 'buy_item', { p_item: 'bundle-pac-guaxinim' }));
  ok((await count("select count(*) n from inventory where user_id = $1 and item_id in ('mold-dc-guaxinim', 'placa-guaxinim', 'perfil-guaxinim')", [A])) === 3, 'recebeu as 3 peças');
  const look = await must('equipa o pacote', call(A, 'equip_bundle', { p_bundle: 'bundle-pac-guaxinim' }));
  ok(look && look.placa && look.placa.i === 'placa-guaxinim' && look.perfil && look.perfil.i === 'perfil-guaxinim' && look.moldura && look.moldura.i === 'mold-dc-guaxinim', 'placa, moldura de perfil e decoração vestidas', look);

  // a placa vai no cartão de qualquer lista; a moldura de perfil no perfil
  const card = await q1('select app.user_card($1) c', [A]);
  ok(card.c.plate && card.c.plate.art === 'pl-guaxinim', 'cartão do jogador traz a placa', card.c.plate);
  const pf = await call(B, 'get_profile', { p_user: A });
  ok(pf && pf.look && pf.look.perfil && pf.look.perfil.data.art === 'pf-guaxinim', 'perfil mostra a moldura de perfil para os outros');

  // cor da placa
  await must('compra placa com cor', call(A, 'buy_item', { p_item: 'placa-olho-lobo' }));
  await must('equipa com cor', call(A, 'set_look', { p: { placa: { i: 'placa-olho-lobo', v: 'azul' } } }));
  ok((await q1('select app.user_card($1) c', [A])).c.plate_v === 'azul', 'cor da placa no cartão');
  await refuse('cor que não existe', call(A, 'set_look', { p: { placa: { i: 'placa-olho-lobo', v: 'xadrez' } } }), /cor não existe/);

  // anônimo no ranking: a placa some junto com a foto
  await db.query('update profiles set anonymous = true where id = $1', [A]);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: B })]);
  ok((await q1('select app.user_card($1, true) c', [A])).c.plate === null, 'anônimo não mostra a placa');
  await db.query('update profiles set anonymous = false where id = $1', [A]);

  // tirar
  await must('tira a placa', call(A, 'set_look', { p: { placa: null, perfil: null } }));
  ok(!(await q1('select app.user_card($1) c', [A])).c.plate, 'sem placa depois de tirar');
  // painel aceita os tipos novos
  await must('painel cria placa', call(dono, 'admin_shop_save', { p: { id: 'placa-teste', kind: 'placa', name: 'Placa Teste', description: 'x', price_cents: 500, data: { art: 'pl-ouro', pal: 'dourado' }, active: true, rarity: 'raro' } }));
});
