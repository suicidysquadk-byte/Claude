-- BattleHub: customização com raridade (padrão do Free Fire) e muitos itens novos
-- Raridade: simples, comum (verde), raro (azul), épico (roxo), mítico (amarelo) e lendário (vermelho).
-- Quanto mais elaborado (camadas, animação, brilho), maior a raridade e o preço:
--   comum R$ 1,90 a 3,90 · raro R$ 3,90 a 7,90 · épico R$ 7,90 a 14,90 · mítico R$ 14,90 a 29,90 · lendário R$ 29,90 a 59,90
-- Molduras novas são desenhos em SVG (js/molduras.js, campo "fr"); "ring" fica como aro simples em listas pequenas.
-- Títulos ganham estilo ("fx") e há títulos de conquista, liberados sozinhos quando o jogador bate a meta.

alter table public.shop_items add column rarity text not null default 'comum'
  check (rarity in ('simples', 'comum', 'raro', 'epico', 'mitico', 'lendario'));

-- ================================================================ itens que já existiam
update public.shop_items set rarity = case
    when price_cents is null then 'raro'
    when price_cents < 390 then 'comum'
    when price_cents < 790 then 'raro'
    when price_cents < 1490 then 'epico'
    when price_cents < 2990 then 'mitico'
    else 'lendario' end;
update public.shop_items set rarity = 'simples' where id = 'banner-padrao';
update public.shop_items set rarity = 'comum' where id in ('moldura-bronze', 'titulo-cacador');
update public.shop_items set rarity = 'epico', data = data || '{"fx":"roxo"}' where id = 'titulo-lenda';
update public.shop_items set rarity = 'lendario', data = data || '{"fx":"fogo"}' where id = 'titulo-imortal';
update public.shop_items set rarity = 'mitico', data = data || '{"fx":"ouro"}' where id = 'titulo-campeao';
update public.shop_items set data = data || '{"fx":"azul"}' where id = 'titulo-cacador';
update public.shop_items set rarity = 'raro', data = data || '{"fx":"azul"}' where id = 'titulo-sniper';
update public.shop_items set rarity = 'comum', data = data || '{"fx":"verde"}' where id in ('titulo-brabo', 'titulo-call');
update public.shop_items set rarity = 'epico' where id in ('moldura-diamante', 'banner-coroa');
-- recompensas de sinergia ganham o desenho novo
update public.shop_items set rarity = 'raro', data = data || '{"fx":"prata"}' where id = 'titulo-entrosados';
update public.shop_items set rarity = 'epico' where id = 'banner-sinergia';
update public.shop_items set rarity = 'epico', data = '{"fr":"laco","ring":"#b91c1c","glow":true}' where id = 'moldura-laco-sangue';
update public.shop_items set rarity = 'mitico', data = data || '{"fx":"sangue"}' where id = 'titulo-irmaos-guerra';
update public.shop_items set rarity = 'lendario', data = '{"fr":"sinergia","ring":"conic","glow":true}' where id = 'moldura-sinergia-suprema';

-- ================================================================ itens novos
insert into public.shop_items (id, kind, name, description, price_cents, duration_days, data, sort, rarity) values
  -- molduras
  ('moldura-aco', 'moldura', 'Aço', 'Aro de aço escovado com rebites', 190, null, '{"fr":"aco","ring":"#9aa3ad"}', 200, 'comum'),
  ('moldura-esmeralda', 'moldura', 'Esmeralda', 'Ouro com quatro esmeraldas lapidadas', 490, null, '{"fr":"esmeralda","ring":"#0f9d58"}', 201, 'raro'),
  ('moldura-safira', 'moldura', 'Safira Real', 'Prata com doze safiras', 590, null, '{"fr":"safira","ring":"#1d4ed8"}', 202, 'raro'),
  ('moldura-circuito', 'moldura', 'Circuito Neon', 'Anéis neon que giram em sentidos opostos', 990, null, '{"fr":"circuito","ring":"#22d3ee","glow":true}', 203, 'epico'),
  ('moldura-chamas', 'moldura', 'Chamas Vivas', 'Fogo que dança em volta da foto', 1190, null, '{"fr":"chamas","ring":"#ff6a00","glow":true}', 204, 'epico'),
  ('moldura-gelo', 'moldura', 'Gelo Eterno', 'Cristais de gelo e um brilho que gira', 990, null, '{"fr":"gelo","ring":"#7dd3fc","glow":true}', 205, 'epico'),
  ('moldura-raio', 'moldura', 'Relâmpago', 'Raios roxos que estalam em volta', 1190, null, '{"fr":"raio","ring":"#a855f7","glow":true}', 206, 'epico'),
  ('moldura-sakura', 'moldura', 'Galho de Sakura', 'Flores de cerejeira e pétalas em órbita', 990, null, '{"fr":"sakura","ring":"#ffb7d5"}', 207, 'epico'),
  ('moldura-asas', 'moldura', 'Asas Douradas', 'Asas de penas douradas que flutuam e auréola', 1990, null, '{"fr":"asas","ring":"#f0c75e","glow":true}', 208, 'mitico'),
  ('moldura-cyber', 'moldura', 'Hexágono Cyber', 'Painel hexagonal com varredura e marcadores', 1990, null, '{"fr":"cyber","ring":"#00e5ff","glow":true}', 209, 'mitico'),
  ('moldura-kitsune', 'moldura', 'Nove Caudas', 'Nove caudas de raposa em fogo azul', 2290, null, '{"fr":"kitsune","ring":"#9ad8ff","glow":true}', 210, 'mitico'),
  ('moldura-coroa', 'moldura', 'Coroa Real', 'Coroa com pedras, louros e raios de luz girando', 2490, null, '{"fr":"coroa","ring":"#e5b64a","glow":true}', 211, 'mitico'),
  ('moldura-dragao', 'moldura', 'Dragão Dourado', 'Dragão enrolado na foto, com olho em brasa', 2490, null, '{"fr":"dragao","ring":"#e5b64a","glow":true}', 212, 'mitico'),
  ('moldura-fenix', 'moldura', 'Fênix Imortal', 'Asas de fogo, anel em chamas girando e brasas subindo', 3990, null, '{"fr":"fenix","ring":"#ff5a00","glow":true}', 213, 'lendario'),
  ('moldura-sombras', 'moldura', 'Mestre das Sombras', 'Aura sombria em movimento, runas vermelhas e olhos no escuro', 3990, null, '{"fr":"sombras","ring":"#9f1239","glow":true}', 214, 'lendario'),
  ('moldura-abismo', 'moldura', 'Abismo Celestial', 'Galáxia com dois planetas em órbita, runas e estrelas', 4490, null, '{"fr":"abismo","ring":"#7c3aed","glow":true}', 215, 'lendario'),
  ('moldura-rei', 'moldura', 'Rei Supremo', 'Coroa cravejada, oito pedras, louros duplos, raios de luz e brilhos', 4990, null, '{"fr":"rei","ring":"#ffd766","glow":true}', 216, 'lendario'),
  -- banners com cena desenhada
  ('banner-montanha', 'banner', 'Amanhecer', 'Montanhas ao nascer do sol', 790, null, '{"bg":"linear-gradient(180deg,#2d1b3d,#b0567a 55%,#ff9a76)","anim":"shimmer","art":"montanha"}', 300, 'raro'),
  ('banner-lobo', 'banner', 'Uivo do Lobo', 'Lobo uivando para a lua cheia', 1290, null, '{"bg":"linear-gradient(180deg,#0b1224,#1e3a5f 60%,#334e7a)","anim":"grain","art":"lobo"}', 301, 'epico'),
  ('banner-mira', 'banner', 'Mira Sniper', 'Luneta com laser e varredura', 1490, null, '{"bg":"linear-gradient(120deg,#05070a,#1f2937 55%,#374151)","anim":"scan","art":"mira"}', 302, 'epico'),
  ('banner-synth', 'banner', 'Synthwave', 'Sol retrô e grade neon em movimento', 1990, null, '{"bg":"linear-gradient(180deg,#0d0221,#261447 55%,#541388)","anim":"gridmove","art":"synth"}', 303, 'mitico'),
  ('banner-caveira', 'banner', 'Terror do Lobby', 'Caveira com fuzis cruzados e olhos em brasa', 1990, null, '{"bg":"linear-gradient(120deg,#0c0a09,#292524 55%,#44403c)","anim":"embers","art":"caveira"}', 304, 'mitico'),
  ('banner-arena', 'banner', 'Grande Final', 'Arena lotada, holofotes e troféu', 2490, null, '{"bg":"linear-gradient(180deg,#0a0a14,#1e1b4b 60%,#312e81)","anim":"spots","art":"arena"}', 305, 'mitico'),
  ('banner-fenix', 'banner', 'Fênix', 'Fênix de asas abertas no meio das brasas', 3490, null, '{"bg":"linear-gradient(120deg,#1a0303,#5c0d12 45%,#b91c1c)","anim":"embers","art":"fenix"}', 306, 'lendario'),
  ('banner-trono', 'banner', 'Trono Dourado', 'Coroa gigante cravejada com raios de luz girando', 3990, null, '{"bg":"linear-gradient(120deg,#140d02,#3d2805 50%,#8a5a12)","anim":"shimmer","art":"coroa"}', 307, 'lendario'),
  -- fundos animados
  ('fundo-neve', 'fundo', 'Nevasca', 'Neve caindo atrás do perfil', 790, null, '{"fx":"snow"}', 400, 'raro'),
  ('fundo-vagalumes', 'fundo', 'Vagalumes', 'Luzes vivas passeando no escuro', 1290, null, '{"fx":"fireflies"}', 401, 'epico'),
  ('fundo-hex', 'fundo', 'Colmeia Dourada', 'Grade hexagonal com células acendendo', 1490, null, '{"fx":"hexgrid"}', 402, 'epico'),
  ('fundo-bokeh', 'fundo', 'Luzes da Final', 'Luzes douradas desfocadas, clima de final', 1990, null, '{"fx":"bokeh"}', 403, 'mitico'),
  -- títulos à venda (estilo do Free Fire)
  ('titulo-bravo', 'titulo', 'O Bravo', 'Título verde embaixo do seu nick', 190, null, '{"text":"O Bravo","fx":"verde"}', 500, 'comum'),
  ('titulo-mira-boa', 'titulo', 'Mira Boa', 'Título verde embaixo do seu nick', 190, null, '{"text":"Mira Boa","fx":"verde"}', 501, 'comum'),
  ('titulo-rushador', 'titulo', 'Rushador', 'Para quem entra primeiro', 290, null, '{"text":"Rushador","fx":"verde"}', 502, 'comum'),
  ('titulo-suporte', 'titulo', 'Suporte', 'Quem levanta a line', 290, null, '{"text":"Suporte","fx":"verde"}', 503, 'comum'),
  ('titulo-capa', 'titulo', 'Capa Certa', 'Só na cabeça', 390, null, '{"text":"Capa Certa","fx":"azul"}', 504, 'raro'),
  ('titulo-exterminador', 'titulo', 'Exterminador', 'Título azul embaixo do seu nick', 490, null, '{"text":"Exterminador","fx":"azul"}', 505, 'raro'),
  ('titulo-lobo', 'titulo', 'Lobo Solitário', 'Para quem vence sozinho', 490, null, '{"text":"Lobo Solitário","fx":"prata"}', 506, 'raro'),
  ('titulo-gelo', 'titulo', 'Rei do Gelo', 'Mestre da parede de gelo', 590, null, '{"text":"Rei do Gelo","fx":"azul"}', 507, 'raro'),
  ('titulo-mao-firme', 'titulo', 'Mão Firme', 'Sem tremer na hora H', 590, null, '{"text":"Mão Firme","fx":"prata"}', 508, 'raro'),
  ('titulo-headshot', 'titulo', 'Headshot', 'Título roxo com brilho', 890, null, '{"text":"Headshot","fx":"roxo"}', 509, 'epico'),
  ('titulo-clutch', 'titulo', 'Clutch King', 'Vira a partida sozinho', 990, null, '{"text":"Clutch King","fx":"roxo"}', 510, 'epico'),
  ('titulo-predador', 'titulo', 'Predador', 'Título vermelho sangue', 1190, null, '{"text":"Predador","fx":"sangue"}', 511, 'epico'),
  ('titulo-fantasma', 'titulo', 'Fantasma', 'Ninguém vê, todo mundo cai', 1190, null, '{"text":"Fantasma","fx":"gelo"}', 512, 'epico'),
  ('titulo-carregador', 'titulo', 'Carregador de Line', 'Leva a line nas costas', 1290, null, '{"text":"Carregador de Line","fx":"roxo"}', 513, 'epico'),
  ('titulo-imparavel', 'titulo', 'Imparável', 'Dourado com brilho que corre', 1690, null, '{"text":"Imparável","fx":"ouro"}', 514, 'mitico'),
  ('titulo-lenda-viva', 'titulo', 'Lenda Viva', 'Dourado com brilho que corre', 1990, null, '{"text":"Lenda Viva","fx":"ouro"}', 515, 'mitico'),
  ('titulo-destruidor', 'titulo', 'Destruidor', 'Em chamas', 2290, null, '{"text":"Destruidor","fx":"fogo"}', 516, 'mitico'),
  ('titulo-silencioso', 'titulo', 'Assassino Silencioso', 'Sombra com vermelho', 2490, null, '{"text":"Assassino Silencioso","fx":"sombra"}', 517, 'mitico'),
  ('titulo-mestre-mira', 'titulo', 'Mestre da Mira', 'Arco-íris que corre', 2490, null, '{"text":"Mestre da Mira","fx":"arco"}', 518, 'mitico'),
  ('titulo-terror', 'titulo', 'Terror do Lobby', 'Sombra lendária', 3490, null, '{"text":"Terror do Lobby","fx":"sombra"}', 519, 'lendario'),
  ('titulo-booyah', 'titulo', 'Booyah Eterno', 'Fogo lendário', 3990, null, '{"text":"Booyah Eterno","fx":"fogo"}', 520, 'lendario'),
  ('titulo-mito', 'titulo', 'O Mito', 'Luz divina', 4490, null, '{"text":"O Mito","fx":"divino"}', 521, 'lendario'),
  ('titulo-deus-mira', 'titulo', 'Deus da Mira', 'Luz divina', 4990, null, '{"text":"Deus da Mira","fx":"divino"}', 522, 'lendario'),
  -- títulos de conquista (não estão à venda)
  ('titulo-centuriao', 'titulo', 'Centurião', 'Conquista: 100 abates em salas do BattleHub', null, null, '{"text":"Centurião","fx":"azul"}', 600, 'raro'),
  ('titulo-veterano', 'titulo', 'Veterano', 'Conquista: 100 salas jogadas', null, null, '{"text":"Veterano","fx":"prata"}', 601, 'raro'),
  ('titulo-primeiro-sangue', 'titulo', 'Primeiro Sangue', 'Conquista: 25 primeiras kills da partida', null, null, '{"text":"Primeiro Sangue","fx":"sangue"}', 602, 'epico'),
  ('titulo-chacina', 'titulo', 'Chacina', 'Conquista: 500 abates', null, null, '{"text":"Chacina","fx":"sangue"}', 603, 'epico'),
  ('titulo-rei-booyah', 'titulo', 'Rei do Booyah', 'Conquista: 25 vitórias', null, null, '{"text":"Rei do Booyah","fx":"ouro"}', 604, 'mitico'),
  ('titulo-cacador-reis', 'titulo', 'Caçador de Reis', 'Conquista: eliminar o Player Rei 10 vezes', null, null, '{"text":"Caçador de Reis","fx":"ouro"}', 605, 'mitico'),
  ('titulo-mil', 'titulo', 'Mil Abates', 'Conquista: 1.000 abates', null, null, '{"text":"Mil Abates","fx":"fogo"}', 606, 'lendario')
on conflict (id) do nothing;

-- ================================================================ conquistas
create table app.achievements (item_id text primary key references public.shop_items (id), stat text not null, threshold int not null);
insert into app.achievements values
  ('titulo-centuriao', 'kills', 100), ('titulo-chacina', 'kills', 500), ('titulo-mil', 'kills', 1000),
  ('titulo-veterano', 'matches', 100), ('titulo-rei-booyah', 'wins', 25),
  ('titulo-primeiro-sangue', 'first_bloods', 25), ('titulo-cacador-reis', 'kings_killed', 10);

create or replace function app.stat_of(p public.profiles, p_stat text) returns int language sql immutable as $$
  select case p_stat when 'kills' then p.kills when 'matches' then p.matches when 'wins' then p.wins
    when 'first_bloods' then p.first_bloods when 'kings_killed' then p.kings_killed else 0 end
$$;

create or replace function app.grant_achievements() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare a record; s public.shop_items;
begin
  for a in select * from app.achievements where app.stat_of(new, stat) >= threshold and app.stat_of(old, stat) < threshold loop
    insert into public.inventory (user_id, item_id, source) values (new.id, a.item_id, 'recompensa') on conflict do nothing;
    if found then
      select * into s from public.shop_items where id = a.item_id;
      perform app.notify(new.id, 'nivel', 'Conquista: título "' || (s.data ->> 'text') || '"', s.description || '. Equipe no seu perfil.', '{}'::jsonb);
    end if;
  end loop;
  return null;
end $$;
create trigger profiles_achievements after update of kills, matches, wins, first_bloods, kings_killed on public.profiles
  for each row execute function app.grant_achievements();

-- ================================================================ estilo do título no cartão e no "me"
do $$
declare v_src text; v_new text;
begin
  select pg_get_functiondef('app.user_card(uuid, boolean)'::regprocedure) into v_src;
  v_new := replace(v_src, '''title'', (select data ->> ''text'' from public.shop_items where id = p.equipped_title),',
    '''title'', (select data ->> ''text'' from public.shop_items where id = p.equipped_title),' || E'\n    ' ||
    '''title_fx'', (select data ->> ''fx'' from public.shop_items where id = p.equipped_title),');
  if v_new = v_src then raise exception 'user_card: ponto de ajuste não encontrado'; end if;
  execute v_new;

  select pg_get_functiondef('public.me()'::regprocedure) into v_src;
  v_new := replace(v_src, '''title_text'', (select data ->> ''text'' from public.shop_items where id = p.equipped_title),',
    '''title_text'', (select data ->> ''text'' from public.shop_items where id = p.equipped_title),' || E'\n       ' ||
    '''title_fx'', (select data ->> ''fx'' from public.shop_items where id = p.equipped_title),');
  if v_new = v_src then raise exception 'me(): ponto de ajuste não encontrado'; end if;
  execute v_new;
end $$;

revoke all on all functions in schema app from public;
grant execute on function app.chat_can_read(uuid, uuid) to authenticated;
grant execute on function app.in_thread(uuid, uuid) to authenticated;
