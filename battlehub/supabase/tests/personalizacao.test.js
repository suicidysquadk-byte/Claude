// Testa a Personalização: visual por espaço (com cores), bundles, combinações salvas, coleções com recompensa,
// itens de evento e exclusivos, e o visual aparecendo no perfil, no me() e nas listas.
// Uso: tests/reset.sh e depois  node supabase/tests/personalizacao.test.js
const H = require('./_util')();
const { db, call, ok, must, refuse, q1, count, mk } = H;

H.run(async () => {
  const dono = await mk('dono@bh.gg'), A = await mk('a@bh.gg'), B = await mk('b@bh.gg');
  for (const [u, n] of [[dono, 'Dono'], [A, 'Alfa'], [B, 'Beta']]) await call(u, 'complete_onboarding', { p_nick: n, p_ff_nick: n, p_ff_id: String(800000000 + n.charCodeAt(0)), p_photo_path: u + '/ff.jpg' });
  await db.query("update profiles set ff_status = 'aprovado'");
  await call(dono, 'admin_set_settings', { p: { pix_key: 'pix@bh.gg' } });
  const d = await call(A, 'request_manual_deposit', { p_cents: 200000 });
  await call(dono, 'admin_deposit', { p_id: d.id, p_approve: true, p_note: null });

  // ---------------- catálogo
  ok((await count("select count(*) n from shop_items where active")) >= 600, 'catálogo com mais de 600 itens');
  for (const k of ['avatar', 'pet', 'chaveiro', 'chapeu', 'arma', 'animacao', 'efeito', 'entrada', 'capa', 'tema', 'bundle']) ok((await count('select count(*) n from shop_items where kind = $1', [k])) >= 8, 'tem ' + k);
  ok((await count("select count(*) n from shop_items where rarity = 'exclusivo' and price_cents is not null")) === 0, 'exclusivo nunca está à venda');
  ok((await count("select count(*) n from shop_items where data ? 'bundle' and price_cents is not null")) === 0, 'peça de bundle não se vende sozinha');
  ok((await count("select count(*) n from shop_items b, jsonb_array_elements_text(b.data -> 'items') x(i) where b.kind = 'bundle' and not exists (select 1 from shop_items s where s.id = x.i)")) === 0, 'bundle só aponta para itens que existem');
  ok((await count('select count(*) n from cosmetic_collections c where not exists (select 1 from shop_items s where s.id = c.reward_item_id)')) === 0, 'recompensa de coleção existe');

  const P = await must('personalizacao()', call(A, 'personalizacao', {}));
  ok(P && P.items.length >= 600 && P.balance_cents === 200000, 'personalizacao traz itens e saldo', P && P.items.length);
  ok(P && P.collections.length >= 10 && P.events.some((e) => e.active), 'traz coleções e evento ativo');
  const it = (id) => P.items.find((x) => x.id === id);
  ok(it('av-ninja') && it('av-ninja').data.variants.length >= 2, 'item com variações de cor');

  // ---------------- comprar e equipar com cor
  await refuse('sem ter, não equipa', call(A, 'set_look', { p: { avatar: { i: 'av-ninja' } } }), /ainda não tem/);
  await must('compra avatar', call(A, 'buy_item', { p_item: 'av-ninja' }));
  const v = it('av-ninja').data.variants[0];
  const L = await must('equipa com cor', call(A, 'set_look', { p: { avatar: { i: 'av-ninja', v } } }));
  ok(L && L.avatar && L.avatar.v === v, 'cor gravada', L);
  await refuse('cor que não existe', call(A, 'set_look', { p: { avatar: { i: 'av-ninja', v: 'xadrez' } } }), /cor não existe/);
  await refuse('item no espaço errado', call(A, 'set_look', { p: { pet: { i: 'av-ninja' } } }), /inválido/);
  await refuse('espaço inventado', call(A, 'set_look', { p: { asa: { i: 'av-ninja' } } }), /inválido/);
  await must('compra moldura nova', call(A, 'buy_item', { p_item: 'mold-portal' }));
  await must('equipa moldura', call(A, 'set_look', { p: { moldura: { i: 'mold-portal', v: it('mold-portal').data.variants[0] } } }));
  ok((await q1('select equipped_frame f from profiles where id = $1', [A])).f === 'mold-portal', 'moldura também vai para a coluna antiga (listas)');
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: B })]);
  const card = await q1('select app.user_card($1, false) c', [A]);
  ok(card.c.av_art && card.c.av_art.art === 'ninja' && card.c.av_v === v && card.c.frame_v === it('mold-portal').data.variants[0], 'cartão das listas tem avatar desenhado e cor da moldura', card.c);
  await must('tira o avatar', call(A, 'set_look', { p: { avatar: null } }));
  ok(!(await call(A, 'personalizacao', {})).look.avatar, 'avatar saiu');
  await must('tira o banner', call(A, 'set_look', { p: { banner: null } }));
  ok((await q1('select equipped_banner b from profiles where id = $1', [A])).b === 'banner-padrao', 'sem banner volta para o padrão');

  // ---------------- bundle
  const bundle = it('bundle-ninja');
  const partes = bundle.data.items;
  await refuse('peça do bundle sozinha', call(A, 'buy_item', { p_item: partes[0] }), /só vem no bundle/);
  await refuse('equipar bundle sem ter', call(A, 'equip_bundle', { p_bundle: 'bundle-ninja' }), /ainda não tem/);
  const antes = (await q1('select balance_cents b from wallets where user_id = $1', [A])).b;
  await must('compra bundle', call(A, 'buy_item', { p_item: 'bundle-ninja' }));
  ok(Number((await q1('select balance_cents b from wallets where user_id = $1', [A])).b) === Number(antes) - bundle.price_cents, 'cobrou o preço do bundle');
  ok((await count('select count(*) n from inventory where user_id = $1 and item_id = any($2)', [A, partes])) === partes.length, 'recebeu todas as peças');
  const LB = await must('equipa bundle inteiro', call(A, 'equip_bundle', { p_bundle: 'bundle-ninja' }));
  ok(LB && partes.every((pid) => Object.values(LB).some((e) => e.i === pid)), 'todas as peças equipadas', LB);
  await must('tira só uma parte', call(A, 'set_look', { p: { tema: null } }));
  const L2 = (await call(A, 'personalizacao', {})).look;
  ok(!L2.tema && L2.arma && L2.arma.i === 'bundle-ninja-arma', 'dá para usar só parte do bundle');

  // ---------------- combinações
  const pr = await must('salva combinação', call(A, 'save_look_preset', { p_name: 'Modo ninja' }));
  const pid = pr && pr[0] && pr[0].id;
  ok(pid, 'combinação criada', pr);
  await must('muda tudo', call(A, 'set_look', { p: { arma: null, pet: null, chaveiro: null } }));
  await must('aplica combinação', call(A, 'apply_look_preset', { p_id: pid }));
  ok((await call(A, 'personalizacao', {})).look.arma.i === 'bundle-ninja-arma', 'combinação volta o visual');
  await refuse('combinação de outro', call(B, 'apply_look_preset', { p_id: pid }), /não encontrada|Combinação/);
  for (let i = 0; i < 11; i++) await call(A, 'save_look_preset', { p_name: 'C' + i });
  await refuse('máximo de 12', call(A, 'save_look_preset', { p_name: 'Demais' }), /12/);
  await must('apaga', call(A, 'delete_look_preset', { p_id: pid }));
  ok((await count('select count(*) n from look_presets where user_id = $1', [A])) === 11, 'apagou');

  // ---------------- coleções
  const col = (await call(A, 'my_collections', {})).find((c) => c.id === 'col-natureza');
  await refuse('coleção incompleta', call(A, 'claim_collection', { p_id: 'col-natureza' }), /omplete a coleção/);
  for (const id of col.items) { const x = it(id); if (x.price_cents != null) await call(A, 'buy_item', { p_item: id }); }
  await must('resgata coleção completa', call(A, 'claim_collection', { p_id: 'col-natureza' }));
  ok((await count('select count(*) n from inventory where user_id = $1 and item_id = $2', [A, col.reward])) === 1, 'ganhou o exclusivo');
  await refuse('resgatar duas vezes', call(A, 'claim_collection', { p_id: 'col-natureza' }), /já/);
  await refuse('exclusivo não se compra', call(B, 'buy_item', { p_item: col.reward }), /exclusivo/);

  // ---------------- eventos
  await db.query("update cosmetic_events set starts_at = now() + interval '10 days', ends_at = now() + interval '20 days' where key = 'halloween'");
  await db.query("update shop_items set available_from = now() + interval '10 days', available_until = now() + interval '20 days' where event_key = 'halloween'");
  await refuse('evento que não começou', call(A, 'buy_item', { p_item: 'ev-hw-moldura' }), /chega em/);
  await db.query("update shop_items set available_from = now() - interval '20 days', available_until = now() - interval '1 day' where id = 'ev-hw-moldura'");
  await refuse('evento que acabou', call(A, 'buy_item', { p_item: 'ev-hw-moldura' }), /acabou/);
  await db.query("update shop_items set available_from = now() - interval '1 day', available_until = now() + interval '5 days' where id = 'ev-hw-moldura'");
  await must('compra no evento', call(A, 'buy_item', { p_item: 'ev-hw-moldura' }));

  // ---------------- o visual aparece para os outros
  await must('equipa chaveiro', call(A, 'set_look', { p: { chaveiro: { i: 'bundle-ninja-chaveiro' } } }));
  const gp = await must('perfil público', call(B, 'get_profile', { p_user: A }));
  ok(gp && gp.look && gp.look.moldura && gp.look.moldura.data && gp.look.moldura.data.art, 'perfil público traz o visual com os dados de desenho', gp && gp.look);
  const m = await must('me()', call(A, 'me', {}));
  ok(m && m.look && m.look.chaveiro, 'me() traz o visual');
});
