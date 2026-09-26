// Testa a customização: raridade e faixa de preço, títulos com estilo, conquistas automáticas e compra/uso dos itens novos.
// Uso: tests/reset.sh e depois  node supabase/tests/customizacao.test.js
const H = require('./_util')();
const { db, call, ok, must, refuse, q1, count, mk } = H;
const RANGE = { comum: [190, 390], raro: [290, 790], epico: [790, 1490], mitico: [1490, 2990], lendario: [2990, 5990] };

H.run(async () => {
  const dono = await mk('dono@bh.gg'), A = await mk('a@bh.gg');
  for (const [u, n] of [[dono, 'Dono'], [A, 'Alfa']]) await call(u, 'complete_onboarding', { p_nick: n, p_ff_nick: n, p_ff_id: String(800000000 + n.charCodeAt(0)), p_photo_path: u + '/ff.jpg' });
  await db.query("update profiles set ff_status = 'aprovado'");

  // ---------------- raridade e preço
  const items = (await db.query('select id, kind, rarity, price_cents, data from shop_items where active')).rows;
  ok(items.length >= 120, 'loja com mais de 120 itens', items.length);
  const bad = items.filter((i) => i.price_cents != null && RANGE[i.rarity] && (i.price_cents < RANGE[i.rarity][0] || i.price_cents > RANGE[i.rarity][1]));
  ok(bad.length === 0, 'cada preço dentro da faixa da raridade', bad.map((b) => b.id + ' ' + b.rarity + ' ' + b.price_cents));
  const avg = async (r) => Number((await q1("select avg(price_cents) v from shop_items where rarity = $1 and price_cents is not null", [r])).v);
  ok((await avg('comum')) < (await avg('raro')) && (await avg('raro')) < (await avg('epico')) && (await avg('epico')) < (await avg('mitico')) && (await avg('mitico')) < (await avg('lendario')), 'mais raro, mais caro');
  const frames = items.filter((i) => i.kind === 'moldura' && i.data.fr);
  ok(frames.length >= 19 && frames.every((f) => f.data.ring), 'molduras desenhadas com aro de reserva para listas', frames.length);
  ok(items.filter((i) => i.kind === 'titulo').length >= 35, 'mais de 35 títulos');
  ok(items.filter((i) => i.kind === 'titulo' && i.data.fx).length >= 30, 'títulos com estilo');
  const s = await must('loja', call(A, 'shop', {}));
  ok(s && s.items.every((i) => i.rarity), 'loja manda a raridade');

  // ---------------- compra, uso e estilo do título
  await call(dono, 'admin_set_settings', { p: { pix_key: 'pix@bh.gg' } });
  const d = await call(A, 'request_manual_deposit', { p_cents: 10000 });
  await call(dono, 'admin_deposit', { p_id: d.id, p_approve: true, p_note: null });
  await must('compra título lendário', call(A, 'buy_item', { p_item: 'titulo-mito' }));
  await must('usa o título', call(A, 'equip_item', { p_item: 'titulo-mito' }));
  const me = await call(A, 'me', {});
  ok(me.equipped.title_text === 'O Mito' && me.equipped.title_fx === 'divino', 'me traz texto e estilo do título', me.equipped);
  const card = await call(dono, 'get_profile', { p_user: A });
  ok(card.title === 'O Mito' && card.title_fx === 'divino', 'perfil público mostra o estilo', { t: card.title, fx: card.title_fx });
  await must('compra moldura lendária', call(A, 'buy_item', { p_item: 'moldura-fenix' }));
  await must('usa a moldura', call(A, 'equip_item', { p_item: 'moldura-fenix' }));
  const c2 = await call(dono, 'get_profile', { p_user: A });
  ok(c2.frame && c2.frame.fr === 'fenix', 'moldura desenhada chega no cartão', c2.frame);
  await refuse('conquista não se compra', call(A, 'buy_item', { p_item: 'titulo-centuriao' }), /./);

  // ---------------- conquistas
  await db.query('update profiles set kills = 99 where id = $1', [A]);
  ok(await count("select count(*) n from inventory where user_id = $1 and item_id = 'titulo-centuriao'", [A]) === 0, 'antes da meta não ganha');
  await db.query('update profiles set kills = 101 where id = $1', [A]);
  ok(await count("select count(*) n from inventory where user_id = $1 and item_id = 'titulo-centuriao'", [A]) === 1, '100 abates: ganha "Centurião"');
  ok(await count("select count(*) n from notifications where user_id = $1 and title like 'Conquista:%Centurião%'", [A]) === 1, 'e é avisado');
  await db.query('update profiles set kills = 1200, wins = 30 where id = $1', [A]);
  ok(await count("select count(*) n from inventory where user_id = $1 and item_id in ('titulo-chacina', 'titulo-mil', 'titulo-rei-booyah')", [A]) === 3, 'pulando metas ganha todas de uma vez');
  await db.query('update profiles set kills = 1201 where id = $1', [A]);
  ok(await count("select count(*) n from notifications where user_id = $1 and title like 'Conquista:%'", [A]) === 4, 'não repete aviso');
  await must('usa título de conquista', call(A, 'equip_item', { p_item: 'titulo-mil' }));
});
