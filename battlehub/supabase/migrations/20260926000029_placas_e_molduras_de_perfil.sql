-- Estilo da Loja do Discord: tipos novos "placa" (placa de identificação atrás do nome nas listas) e "perfil"
-- (moldura do cartão de perfil inteiro), decorações de personagem (orelhas + cauda), placas, molduras e pacotes.
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in (
  'banner', 'moldura', 'titulo', 'cor', 'prioridade', 'acessorio', 'fundo',
  'avatar', 'capa', 'pet', 'chaveiro', 'chapeu', 'arma', 'efeito', 'entrada', 'animacao', 'tema', 'bundle', 'placa', 'perfil'));

create or replace function app.look_kinds() returns text[] language sql immutable as $$
  select array['avatar', 'banner', 'capa', 'moldura', 'pet', 'chaveiro', 'chapeu', 'arma', 'acessorio', 'efeito', 'entrada', 'animacao', 'tema', 'cor', 'fundo', 'titulo', 'placa', 'perfil']
$$;

do $$
declare v_src text; v_new text;
begin
  -- a placa vai junto no cartão do jogador (todas as listas usam app.user_card)
  select pg_get_functiondef('app.user_card(uuid, boolean)'::regprocedure) into v_src;
  if position('''plate''' in v_src) = 0 then
    v_new := replace(v_src, '''av_v'', p.look -> ''avatar'' ->> ''v'',',
      '''av_v'', p.look -> ''avatar'' ->> ''v'',' || E'\n    ' ||
      '''plate'', case when p_mask and p.anonymous and p.id <> auth.uid() then null else (select data from public.shop_items where id = p.look -> ''placa'' ->> ''i'') end,' || E'\n    ' ||
      '''plate_v'', p.look -> ''placa'' ->> ''v'',');
    if v_new = v_src then raise exception 'user_card: ponto de ajuste não encontrado'; end if;
    execute v_new;
  end if;
  -- painel: aceita os tipos novos
  select pg_get_functiondef('public.admin_shop_save(jsonb)'::regprocedure) into v_src;
  if position('''perfil''' in v_src) = 0 then
    v_new := replace(v_src, '''tema'', ''bundle'')', '''tema'', ''bundle'', ''placa'', ''perfil'')');
    if v_new = v_src then raise exception 'admin_shop_save: ponto de ajuste não encontrado'; end if;
    execute v_new;
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, price_cents, data, active, sort, rarity, event_key, available_from, available_until, created_at) values
  ('mold-dc-guaxinim', 'moldura', 'Guaxinim', 'Orelhas de guaxinim com argolas, anel de pelo e cauda listrada.', 1490, '{"art": "dc-guaxinim", "pal": "prata"}'::jsonb, true, 1701, 'epico', null, null, null, now()),
  ('mold-dc-leopardo', 'moldura', 'Leopardo-das-Neves', 'Orelhas brancas e a cauda pintada dando a volta no avatar.', 1490, '{"art": "dc-leopardo", "pal": "branco"}'::jsonb, true, 1702, 'epico', null, null, null, now()),
  ('mold-dc-lobo-lunar', 'moldura', 'Lobo Lunar', 'Orelhas de lobo, lua crescente e cauda de pelo gelado.', 1990, '{"art": "dc-lobo-lunar", "pal": "azul", "variants": ["roxo", "rosa", "verde"]}'::jsonb, true, 1703, 'lendario', null, null, null, now()),
  ('mold-dc-raposa', 'moldura', 'Raposa', 'Orelhas de raposa e a cauda de ponta branca.', 1290, '{"art": "dc-raposa", "pal": "laranja", "variants": ["prata", "vermelho", "roxo"]}'::jsonb, true, 1704, 'epico', null, null, null, now()),
  ('mold-dc-tigre', 'moldura', 'Tigre', 'Orelhas de tigre e cauda listrada.', 1290, '{"art": "dc-tigre", "pal": "laranja", "variants": ["branco", "preto", "azul"]}'::jsonb, true, 1705, 'epico', null, null, null, now()),
  ('mold-dc-panda-vermelho', 'moldura', 'Panda-Vermelho', 'Orelhas de panda-vermelho e cauda anelada.', 1290, '{"art": "dc-panda-vermelho", "pal": "laranja"}'::jsonb, true, 1706, 'epico', null, null, null, now()),
  ('mold-dc-bordo', 'moldura', 'Bordo-Japonês', 'Galho torcido com folhas vermelhas de bordo caindo.', 1990, '{"art": "dc-bordo", "pal": "vermelho", "variants": ["laranja", "amarelo", "rosa"]}'::jsonb, true, 1707, 'lendario', null, null, null, now()),
  ('mold-dc-anjo-caido', 'moldura', 'Anjo Caído', 'Asas enormes subindo atrás do avatar. Três cores: penumbra, preto e branco.', 3990, '{"art": "dc-anjo-caido", "pal": "roxo", "variants": ["preto", "branco"]}'::jsonb, true, 1708, 'mitico', null, null, null, now()),
  ('mold-dc-dragao-neon', 'moldura', 'Dragão Holográfico', 'Dragão em traço neon dando a volta no avatar.', 3490, '{"art": "dc-dragao-neon", "pal": "rosa", "variants": ["azul-ciano", "verde", "dourado"]}'::jsonb, true, 1709, 'mitico', null, null, null, now()),
  ('mold-dc-chapeu-palha', 'moldura', 'Chapéu de Palha', 'Chapéu cônico com cordão.', 1190, '{"art": "dc-chapeu-palha", "pal": "amarelo", "variants": ["azul", "vermelho"]}'::jsonb, true, 1710, 'epico', null, null, null, now()),
  ('mold-dc-katana', 'moldura', 'Katana Cibernética', 'Lâmina neon cortando o ar e flores de cerejeira.', 2490, '{"art": "dc-katana", "pal": "rosa", "variants": ["azul-ciano", "vermelho", "verde"]}'::jsonb, true, 1711, 'lendario', null, null, null, now()),
  ('mold-dc-portal', 'moldura', 'Passagem Dimensional', 'Anel de energia azul estalando em volta do avatar.', 2990, '{"art": "dc-portal", "pal": "azul-ciano", "variants": ["roxo", "vermelho", "verde"]}'::jsonb, true, 1712, 'mitico', null, null, null, now()),
  ('placa-guaxinim', 'placa', 'Pelagem de Guaxinim', 'Pelo listrado com um coração pendurado.', 990, '{"art": "pl-guaxinim", "pal": "prata"}'::jsonb, true, 1713, 'epico', null, null, null, now()),
  ('placa-leopardo', 'placa', 'Estampa de Leopardo', 'Pintas de leopardo-das-neves e brilhos de gelo.', 990, '{"art": "pl-leopardo", "pal": "branco"}'::jsonb, true, 1714, 'epico', null, null, null, now()),
  ('placa-lobo-lunar', 'placa', 'Pelagem de Lobo Lunar', 'Penas de gelo e brilhos azuis.', 1490, '{"art": "pl-lobo-lunar", "pal": "azul", "variants": ["roxo", "rosa", "verde"]}'::jsonb, true, 1715, 'lendario', null, null, null, now()),
  ('placa-olho-lobo', 'placa', 'Lobo Espiritual', 'Olho de lobo brilhando no pelo branco.', 1490, '{"art": "pl-olho-lobo", "pal": "roxo", "variants": ["azul", "vermelho", "verde"]}'::jsonb, true, 1716, 'lendario', null, null, null, now()),
  ('placa-bordo', 'placa', 'Folhas de Bordo', 'Galho com folhas vermelhas de outono.', 690, '{"art": "pl-bordo", "pal": "vermelho", "variants": ["laranja", "amarelo"]}'::jsonb, true, 1717, 'raro', null, null, null, now()),
  ('placa-dragao', 'placa', 'Escamas de Dragão', 'Escamas douradas com o olho do dragão e reflexo passando.', 2990, '{"art": "pl-dragao", "pal": "dourado", "variants": ["vermelho", "azul-ciano", "royal"]}'::jsonb, true, 1718, 'mitico', null, null, null, now()),
  ('placa-galaxia', 'placa', 'Nebulosa', 'Nuvens de gás e estrelas.', 790, '{"art": "pl-galaxia", "pal": "galaxia", "variants": ["azul", "vermelho", "verde"]}'::jsonb, true, 1719, 'raro', null, null, null, now()),
  ('placa-aurora', 'placa', 'Aurora', 'Cortinas de luz no céu.', 790, '{"art": "pl-aurora", "pal": "verde", "variants": ["ciano", "rosa", "roxo"]}'::jsonb, true, 1720, 'raro', null, null, null, now()),
  ('placa-chamas', 'placa', 'Chamas', 'Fogo subindo atrás do nome.', 990, '{"art": "pl-chamas", "pal": "fogo", "variants": ["azul", "roxo", "verde"]}'::jsonb, true, 1721, 'epico', null, null, null, now()),
  ('placa-cidade', 'placa', 'Cidade Neon', 'Prédios com bordas neon.', 690, '{"art": "pl-cidade", "pal": "cyberpunk", "variants": ["azul", "verde", "dourado"]}'::jsonb, true, 1722, 'raro', null, null, null, now()),
  ('placa-sakura', 'placa', 'Cerejeira', 'Galhos floridos e pétalas.', 690, '{"art": "pl-sakura", "pal": "primavera", "variants": ["rosa", "roxo", "branco"]}'::jsonb, true, 1723, 'raro', null, null, null, now()),
  ('placa-ondas', 'placa', 'Mar à Noite', 'Ondas com a lua refletindo.', 390, '{"art": "pl-ondas", "pal": "azul-ciano", "variants": ["roxo", "vermelho"]}'::jsonb, true, 1724, 'incomum', null, null, null, now()),
  ('placa-ouro', 'placa', 'Ouro Negro', 'Preto de luxo com linhas douradas.', 990, '{"art": "pl-ouro", "pal": "dourado", "variants": ["prata", "rosa"]}'::jsonb, true, 1725, 'epico', null, null, null, now()),
  ('placa-raios', 'placa', 'Tempestade', 'Raios clareando as nuvens.', 990, '{"art": "pl-raios", "pal": "eletrico", "variants": ["azul", "vermelho", "verde"]}'::jsonb, true, 1726, 'epico', null, null, null, now()),
  ('placa-synth', 'placa', 'Synthwave', 'Sol listrado e grade neon.', 790, '{"art": "pl-synth", "pal": "cyberpunk", "variants": ["azul", "verde", "dourado"]}'::jsonb, true, 1727, 'raro', null, null, null, now()),
  ('placa-cristais', 'placa', 'Cristais', 'Caverna de cristal brilhando.', 790, '{"art": "pl-cristais", "pal": "mistico", "variants": ["gelo", "rosa", "dourado"]}'::jsonb, true, 1728, 'raro', null, null, null, now()),
  ('perfil-guaxinim', 'perfil', 'Moldura Guaxinim', 'Anel de pelo em volta do cartão e um guaxinim espiando no alto.', 1490, '{"art": "pf-guaxinim", "pal": "prata"}'::jsonb, true, 1729, 'epico', null, null, null, now()),
  ('perfil-leopardo', 'perfil', 'Moldura Leopardo-das-Neves', 'Borda de pelo branco pintado.', 1490, '{"art": "pf-leopardo", "pal": "branco"}'::jsonb, true, 1730, 'epico', null, null, null, now()),
  ('perfil-neon', 'perfil', 'Moldura Neon', 'Tubo de neon pulsando em volta do cartão.', 790, '{"art": "pf-neon", "pal": "cyberpunk", "variants": ["azul", "verde", "dourado"]}'::jsonb, true, 1731, 'raro', null, null, null, now()),
  ('perfil-dourado', 'perfil', 'Moldura Real', 'Borda de ouro com cantos trabalhados e joias.', 2290, '{"art": "pf-dourado", "pal": "royal", "variants": ["vermelho", "azul", "verde"]}'::jsonb, true, 1732, 'lendario', null, null, null, now()),
  ('perfil-bordo', 'perfil', 'Moldura Bordo-Japonês', 'Galhos com folhas de bordo nos cantos.', 1290, '{"art": "pf-bordo", "pal": "vermelho", "variants": ["laranja", "amarelo"]}'::jsonb, true, 1733, 'epico', null, null, null, now()),
  ('perfil-sakura', 'perfil', 'Moldura Cerejeira', 'Galhos floridos nos cantos e pétalas caindo.', 1290, '{"art": "pf-sakura", "pal": "primavera", "variants": ["rosa", "roxo", "branco"]}'::jsonb, true, 1734, 'epico', null, null, null, now()),
  ('perfil-chamas', 'perfil', 'Moldura de Fogo', 'Chamas subindo pela borda de baixo.', 1990, '{"art": "pf-chamas", "pal": "fogo", "variants": ["azul", "roxo", "verde"]}'::jsonb, true, 1735, 'lendario', null, null, null, now()),
  ('perfil-gelo', 'perfil', 'Moldura de Gelo', 'Estalactites de gelo no alto e neve.', 1290, '{"art": "pf-gelo", "pal": "gelo", "variants": ["roxo", "verde", "rosa"]}'::jsonb, true, 1736, 'epico', null, null, null, now()),
  ('perfil-dragao', 'perfil', 'Moldura Dragão', 'Corpo do dragão correndo pela borda e a cabeça no canto.', 2990, '{"art": "pf-dragao", "pal": "dourado", "variants": ["vermelho", "azul-ciano", "royal"]}'::jsonb, true, 1737, 'mitico', null, null, null, now()),
  ('bundle-pac-guaxinim', 'bundle', 'Pacote Guaxinim', 'Vem com 3 itens. Sai mais barato que comprar separado.', 2690, '{"pal": "prata", "icon": "🦝", "items": ["mold-dc-guaxinim", "placa-guaxinim", "perfil-guaxinim"]}'::jsonb, true, 1738, 'epico', null, null, null, now()),
  ('bundle-pac-leopardo', 'bundle', 'Pacote Leopardo-das-Neves', 'Vem com 3 itens. Sai mais barato que comprar separado.', 2690, '{"pal": "branco", "icon": "🐆", "items": ["mold-dc-leopardo", "placa-leopardo", "perfil-leopardo"]}'::jsonb, true, 1739, 'epico', null, null, null, now()),
  ('bundle-pac-lobo-lunar', 'bundle', 'Pacote Lobo Lunar', 'Vem com 2 itens. Sai mais barato que comprar separado.', 2590, '{"pal": "azul", "icon": "🐺", "items": ["mold-dc-lobo-lunar", "placa-lobo-lunar"]}'::jsonb, true, 1740, 'lendario', null, null, null, now()),
  ('bundle-pac-bordo', 'bundle', 'Pacote Bordo-Japonês', 'Vem com 3 itens. Sai mais barato que comprar separado.', 2990, '{"pal": "vermelho", "icon": "🍁", "items": ["mold-dc-bordo", "placa-bordo", "perfil-bordo"]}'::jsonb, true, 1741, 'lendario', null, null, null, now()),
  ('bundle-pac-dragao', 'bundle', 'Pacote Dragão Imperial', 'Vem com 4 itens. Sai mais barato que comprar separado.', 8990, '{"pal": "dourado", "icon": "🐉", "items": ["mold-dc-dragao", "placa-dragao", "perfil-dragao", "capa2-dragao"]}'::jsonb, true, 1742, 'mitico', null, null, null, now()),
  ('bundle-pac-yoru', 'bundle', 'Pacote Passagem Dimensional', 'Vem com 3 itens. Sai mais barato que comprar separado.', 4290, '{"pal": "azul-ciano", "icon": "🌀", "items": ["mold-dc-portal", "placa-raios", "efeito-portal"]}'::jsonb, true, 1743, 'mitico', null, null, null, now()),
  ('bundle-pac-sakura', 'bundle', 'Pacote Cerejeira', 'Vem com 3 itens. Sai mais barato que comprar separado.', 2490, '{"pal": "primavera", "icon": "🌸", "items": ["mold-dc-sakura", "placa-sakura", "perfil-sakura"]}'::jsonb, true, 1744, 'epico', null, null, null, now()),
  ('bundle-pac-neon', 'bundle', 'Pacote Neon', 'Vem com 3 itens. Sai mais barato que comprar separado.', 2690, '{"pal": "cyberpunk", "icon": "🌆", "items": ["mold-dc-cyber", "placa-synth", "perfil-neon"]}'::jsonb, true, 1745, 'lendario', null, null, null, now())
on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents, data = excluded.data, rarity = excluded.rarity, active = true;
