-- BattleHub: acessórios em 3D e visual mais sóbrio.
-- Os acessórios desenhados à mão saem da loja; entram imagens 3D profissionais do Fluent Emoji
-- (Microsoft, licença MIT, uso comercial liberado). As imagens ficam no app em www/img/acessorios.

-- ---------------------------------------------------------------- saem (sem arte profissional)
update public.shop_items set active = false
 where id in ('acc-bruxa', 'acc-chifres', 'acc-gato', 'acc-bandana', 'acc-kabuto', 'acc-aureola', 'acc-louros');
update public.profiles set equipped_accessory = null
 where equipped_accessory in ('acc-bruxa', 'acc-chifres', 'acc-gato', 'acc-bandana', 'acc-kabuto', 'acc-aureola', 'acc-louros');

-- ---------------------------------------------------------------- ficam, com a arte nova
update public.shop_items set name = 'Coroa Real', description = 'Coroa de ouro com pedras', sort = 50 where id = 'acc-coroa';
update public.shop_items set name = 'Chapéu de Palha', description = 'Chapéu de palha com laço vermelho', sort = 51 where id = 'acc-palha';
update public.shop_items set name = 'Máscara Oni', description = 'Máscara de demônio japonês, usada de lado', sort = 52 where id = 'acc-oni';
update public.shop_items set name = 'Headset Gamer', description = 'Fone por cima da cabeça', sort = 60 where id = 'acc-headset';

-- ---------------------------------------------------------------- novos
insert into public.shop_items (id, kind, name, description, price_cents, data, sort) values
  ('acc-tengu', 'acessorio', 'Máscara Tengu', 'Máscara vermelha de nariz longo, usada de lado', 790, '{"acc":"tengu"}', 53),
  ('acc-cartola', 'acessorio', 'Cartola', 'Cartola preta com faixa', 590, '{"acc":"cartola"}', 54),
  ('acc-capacete', 'acessorio', 'Capacete Tático', 'Capacete militar verde-oliva', 690, '{"acc":"capacete"}', 55),
  ('acc-bone', 'acessorio', 'Boné', 'Boné azul de aba', 390, '{"acc":"bone"}', 56),
  ('acc-oculos', 'acessorio', 'Óculos Escuros', 'Óculos escuros por cima da foto', 490, '{"acc":"oculos"}', 57),
  ('acc-goggles', 'acessorio', 'Óculos de Proteção', 'Óculos de proteção na testa', 490, '{"acc":"goggles"}', 58),
  ('acc-laco', 'acessorio', 'Laço Vermelho', 'Laço de fita no alto da cabeça', 390, '{"acc":"laco"}', 61),
  ('acc-sakura', 'acessorio', 'Flor de Sakura', 'Flor de cerejeira do lado da cabeça', 390, '{"acc":"sakura"}', 62),
  ('acc-asas', 'acessorio', 'Asas de Anjo', 'Asas brancas atrás da foto', 1290, '{"acc":"asas"}', 63),
  ('acc-capelo', 'acessorio', 'Capelo de Mestre', 'Recompensa do nível 18', null, '{"acc":"capelo"}', 64)
on conflict (id) do update set data = excluded.data, name = excluded.name, description = excluded.description, active = true;

-- a recompensa do nível 18 passa a ser o capelo (quem já tinha os louros ganha o capelo)
delete from public.rewards where item_id = 'acc-louros';
insert into public.rewards (level, item_id) values (18, 'acc-capelo') on conflict do nothing;
insert into public.inventory (user_id, item_id, source)
  select user_id, 'acc-capelo', 'recompensa' from public.inventory where item_id = 'acc-louros'
  on conflict do nothing;

-- ---------------------------------------------------------------- dourado mais discreto
update public.shop_items set data = '{"bg":"linear-gradient(120deg,#131210,#27211a 45%,#5e4d2e 72%,#16140f)","anim":"goldline"}' where id = 'banner-coroa';
update public.shop_items set data = '{"bg":"linear-gradient(115deg,#0b0b0d 0%,#15130f 40%,#3f3421 55%,#6e5b35 60%,#15130f 72%,#0b0b0d 100%)","anim":"shimmer"}' where id = 'banner-ouro-negro';
update public.shop_items set data = '{"bg":"linear-gradient(120deg,#0b0b0d,#1d1911 40%,#4f4026 55%,#1d1911 70%,#0b0b0d)","anim":"shimmer","art":"dragon"}' where id = 'banner-imperador';
update public.shop_items set data = '{"bg":"linear-gradient(120deg,#0b0a09,#1b160e 45%,#342a18 60%,#0b0a09)","anim":"shimmer","art":"dragon"}' where id = 'banner-dragao-dourado';
update public.shop_items set data = '{"color":"#d4af5a"}' where id = 'cor-dourado';
update public.shop_items set data = '{"ring":"#c9a24d"}' where id = 'moldura-ouro';
update public.shop_items set data = '{"glow":true,"ring":"#c9a24d"}' where id = 'moldura-campeao';
