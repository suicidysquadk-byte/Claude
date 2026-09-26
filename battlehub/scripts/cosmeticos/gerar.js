#!/usr/bin/env node
/* Gera o catálogo da Personalização (supabase/migrations/20260926000022_catalogo_personalizacao.sql).
   Cada item é uma linha em shop_items com data.art (qual desenho), data.pal (paleta) e data.variants (cores extras).
   O script carrega os desenhos de www/js/cosm/*.js e para com erro se algum item apontar para um desenho que não existe.
   Para acrescentar itens: edite as tabelas abaixo e rode  node scripts/cosmeticos/gerar.js  */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// carrega o motor de desenho para conferir cada item
global.window = global; global.BH = {}; global.document = { documentElement: { classList: { contains: () => false } } };
for (const f of ['core', 'pets', 'chaveiros', 'chapeus', 'armas', 'avatares', 'efeitos', 'cenas', 'cenarios', 'molduras']) require(path.join(ROOT, 'www/js/cosm', f + '.js'));
const C = BH.cosm;

/* ---------------- preço por raridade ---------------- */
const BAND = { comum: [90, 290], incomum: [190, 390], raro: [390, 790], epico: [790, 1490], lendario: [1490, 2990], mitico: [2990, 5990], limitado: [990, 2990] };
let seq = 0;
function price(r, bump) {
  if (r === 'exclusivo') return null;
  const b = BAND[r]; const steps = Math.floor((b[1] - b[0]) / 100);
  const k = ((seq++ * 7) + (bump || 0)) % (steps + 1);
  return b[0] + k * 100;
}
const CORES = ['preto', 'branco', 'azul', 'vermelho', 'roxo', 'rosa', 'verde', 'amarelo', 'laranja', 'ciano', 'dourado', 'prata'];
const DUO = ['preto-vermelho', 'preto-roxo', 'preto-azul', 'branco-dourado', 'azul-ciano', 'vermelho-preto', 'neon', 'rgb', 'gradiente'];
// variações: a paleta do item + algumas outras, sem repetir
function vars(pal, n, pool) { const p = pool || CORES; const out = [pal]; let i = p.indexOf(pal) + 3; while (out.length < n + 1) { const c = p[((i % p.length) + p.length) % p.length]; if (!out.includes(c)) out.push(c); i += 5; } return out; }

const items = [];
function add(kind, id, name, rarity, desc, data, extra) {
  if (data.art && !C.has(kind, data.art)) throw new Error('Desenho inexistente: ' + kind + '/' + data.art + ' (' + id + ')');
  if (data.pal && !C.PAL[data.pal]) throw new Error('Paleta inexistente: ' + data.pal + ' (' + id + ')');
  (data.variants || []).forEach((v) => { if (!C.PAL[v]) throw new Error('Variação inexistente: ' + v + ' (' + id + ')'); });
  const it = Object.assign({ kind, id, name, rarity, description: desc, data, price: price(rarity), sort: items.length }, extra || {});
  if (items.some((x) => x.id === id)) throw new Error('Código repetido: ' + id);
  items.push(it);
  return it;
}

/* ---------------- avatares vivos ---------------- */
[['ninja', 'Ninja das Sombras', 'ninja', 'epico', 'Faixa ao vento, olhar atento e folhas caindo atrás.'],
 ['samurai', 'Samurai Carmesim', 'samurai', 'lendario', 'Kabuto com crista dourada e pétalas de cerejeira.'],
 ['cyborg', 'Ciborgue', 'futurista', 'epico', 'Meio rosto de metal com olho que escaneia.'],
 ['astronauta', 'Astronauta', 'espacial', 'raro', 'Capacete com o reflexo das estrelas.'],
 ['demonio', 'Demônio', 'demoniaco', 'mitico', 'Chifres, olhos em brasa e chamas subindo.'],
 ['anjo', 'Anjo', 'angelical', 'lendario', 'Auréola flutuando e asas que batem devagar.'],
 ['cavaleiro', 'Cavaleiro', 'medieval', 'epico', 'Elmo com viseira acesa e penacho ao vento.'],
 ['mago', 'Mago Arcano', 'mistico', 'lendario', 'Barba ao vento, olhos brilhando e faíscas mágicas.'],
 ['caveira', 'Caveira Encapuzada', 'shadow', 'epico', 'Olhos que acendem no fundo do capuz.'],
 ['robo', 'Robô', 'tech', 'raro', 'Engrenagens girando e antena piscando.'],
 ['gamer', 'Gamer', 'cyberpunk', 'incomum', 'Headset RGB e a luz da tela no rosto.'],
 ['rei', 'Rei', 'royal', 'mitico', 'Coroa com brilho e manto de arminho.'],
 ['raposa', 'Kitsune', 'fogo', 'lendario', 'Máscara de raposa e chamas espirituais.'],
 ['bruxa', 'Bruxa', 'halloween', 'epico', 'Chapéu pontudo e bolhas de poção.'],
 ['vampiro', 'Vampiro', 'vermelho-preto', 'lendario', 'Gola alta, olhos vermelhos e morcegos na lua.'],
 ['noel', 'Papai Noel', 'natal', 'raro', 'Gorro com pompom e neve caindo.'],
 ['alien', 'Alienígena', 'neon', 'epico', 'Olhos enormes e disco voador ao fundo.'],
 ['hacker', 'Hacker', 'tech', 'epico', 'Capuz, óculos de código e chuva de dados.']
].forEach(([art, name, pal, r, d]) => add('avatar', 'av-' + art, name, r, d, { art, pal, variants: vars(pal, 3, CORES.concat(DUO)).slice(1) }));

/* ---------------- pets ---------------- */
[['raposa', 'Raposa', 'laranja', 'raro', 'Balança o rabo e mexe as orelhas.'], ['gato', 'Gato', 'preto', 'incomum', 'Pisca devagar e olha para os lados.'],
 ['cachorro', 'Cachorro', 'amarelo', 'incomum', 'Rabo abanando e língua de fora.'], ['dragao', 'Filhote de Dragão', 'verde', 'lendario', 'Bate as asas e solta fumacinha.'],
 ['lobo', 'Lobo', 'prata', 'epico', 'Orelhas atentas e cauda cheia.'], ['corvo', 'Corvo', 'preto-roxo', 'raro', 'Bate as asas e inclina a cabeça.'],
 ['coelho', 'Coelho', 'branco', 'comum', 'Pulinhos no lugar.'], ['panda', 'Panda', 'branco', 'raro', 'Mastiga bambu sem pressa.'],
 ['robo', 'Robô de Bolso', 'futurista', 'epico', 'Flutua com jato e LED piscando.'], ['alien', 'Mini Alien', 'neon', 'epico', 'Flutua e brilha no escuro.'],
 ['espirito', 'Espírito', 'mistico', 'lendario', 'Flutua e solta faíscas.'], ['slime', 'Slime', 'verde', 'incomum', 'Estica e encolhe.'],
 ['salamandra', 'Salamandra de Fogo', 'fogo', 'lendario', 'Chama na cauda que não apaga.'], ['pinguim', 'Pinguim de Gelo', 'gelo', 'raro', 'Balança de um lado para o outro.'],
 ['polvo', 'Polvo', 'rosa', 'raro', 'Tentáculos em movimento.'], ['abobora', 'Abóbora Viva', 'halloween', 'epico', 'Rosto aceso por dentro.'],
 ['rena', 'Rena', 'natal', 'raro', 'Nariz vermelho brilhando.'], ['fenix', 'Fênix', 'fogo', 'mitico', 'Asas de fogo e faíscas subindo.']
].forEach(([art, name, pal, r, d]) => add('pet', 'pet-' + art, name, r, d, { art, pal, variants: vars(pal, 3).slice(1) }));
// pets de cor especial (mesma animação, estilo diferente)
[['lobo', 'Lobo de Gelo', 'gelo', 'lendario'], ['gato', 'Gato Neon', 'neon', 'epico'], ['dragao', 'Dragão Espacial', 'galaxia', 'mitico'], ['raposa', 'Raposa Mística', 'mistico', 'lendario'],
 ['corvo', 'Corvo de Fogo', 'fogo', 'epico'], ['robo', 'Robô Cyberpunk', 'cyberpunk', 'lendario'], ['coelho', 'Coelho Galáctico', 'galaxia', 'epico'], ['slime', 'Slime de Lava', 'fogo', 'raro']
].forEach(([art, name, pal, r]) => add('pet', 'pet-' + art + '-' + pal, name, r, 'Versão ' + C.PAL[pal].name.toLowerCase() + ' do pet, com a mesma animação.', { art, pal }));

/* ---------------- chaveiros ---------------- */
const KC = [['chave', 'Chave Antiga', 'dourado', 'comum'], ['espada', 'Espadinha', 'prata', 'incomum'], ['arma', 'Pistolinha', 'preto', 'incomum'], ['boneco', 'Bonequinho', 'azul', 'comum'],
  ['cranio', 'Crânio', 'shadow', 'raro'], ['estrela', 'Estrela', 'amarelo', 'comum'], ['coracao', 'Coração', 'vermelho', 'comum'], ['dragao', 'Dragãozinho', 'verde', 'raro'],
  ['raposa', 'Raposinha', 'laranja', 'raro'], ['logo', 'Escudo BattleHub', 'dourado', 'incomum'], ['letra', 'Inicial do Nick', 'roxo', 'incomum'], ['cristal', 'Cristal', 'ciano', 'raro'],
  ['medalha', 'Medalha', 'dourado', 'incomum'], ['trofeu', 'Troféu', 'dourado', 'raro'], ['patinha', 'Patinha', 'rosa', 'comum'], ['yinyang', 'Yin-Yang', 'preto', 'incomum'],
  ['neon', 'Raio Neon', 'neon', 'raro'], ['shuriken', 'Shuriken', 'prata', 'raro'], ['abobora', 'Abóbora', 'halloween', 'raro'], ['floco', 'Floco de Neve', 'gelo', 'raro'],
  ['dado', 'Dado da Sorte', 'branco', 'comum'], ['gamepad', 'Controle', 'preto-azul', 'incomum']];
const PESO = { chave: 1.2, espada: 1.3, arma: 1.4, cranio: 1.3, trofeu: 1.5, medalha: 1.2, dado: 1.1, gamepad: 1.3, estrela: .9, coracao: .9, patinha: .8, floco: .7, neon: .8 };
KC.forEach(([art, name, pal, r]) => add('chaveiro', 'kc-' + art, name, r, 'Balança com a rolagem e volta devagar para o centro.', { art, pal, peso: PESO[art] || 1, variants: vars(pal, 3).slice(1) }));
const KCFX = { luz: ['Luz', 'Brilha com uma auréola de luz.'], particulas: ['Partículas', 'Solta partículas brilhantes.'], fumaca: ['Fumaça', 'Deixa um rastro de fumaça.'], fogo: ['Em Chamas', 'Pega fogo sem queimar.'],
  gelo: ['Congelado', 'Solta cristais de gelo.'], eletrico: ['Elétrico', 'Faíscas elétricas em volta.'], holo: ['Holográfico', 'Pisca em cores de holograma.'] };
[['cranio', 'fogo', 'demoniaco', 'epico'], ['cristal', 'gelo', 'gelo', 'epico'], ['estrela', 'particulas', 'galaxia', 'epico'], ['espada', 'eletrico', 'eletrico', 'epico'], ['dragao', 'fogo', 'fogo', 'lendario'],
 ['logo', 'holo', 'cyberpunk', 'lendario'], ['coracao', 'luz', 'rosa', 'raro'], ['shuriken', 'fumaca', 'ninja', 'epico'], ['trofeu', 'luz', 'dourado', 'lendario'], ['gamepad', 'holo', 'rgb', 'epico'],
 ['medalha', 'particulas', 'royal', 'epico'], ['yinyang', 'eletrico', 'shadow', 'lendario'], ['raposa', 'fogo', 'fogo', 'epico'], ['floco', 'gelo', 'inverno', 'raro']
].forEach(([art, fx, pal, r]) => add('chaveiro', 'kc-' + art + '-' + fx, KC.find((k) => k[0] === art)[1] + ' ' + KCFX[fx][0], r, KCFX[fx][1] + ' Balança com a rolagem.', { art, pal, fx, peso: PESO[art] || 1, variants: vars(pal, 2, CORES.concat(DUO)).slice(1) }));

/* ---------------- chapéus e acessórios de rosto ---------------- */
[['bone', 'Boné', 'preto', 'comum', 'Boné de aba curva.'], ['fedora', 'Fedora', 'preto', 'incomum', 'Chapéu de aba com faixa.'], ['touca', 'Touca', 'vermelho', 'comum', 'Touca de lã com pompom que balança.'],
 ['capuz', 'Capuz', 'ninja', 'raro', 'Capuz fechado sobre o rosto.'], ['coroa', 'Coroa Animada', 'royal', 'lendario', 'Brilho correndo e faíscas em volta.'], ['tiara', 'Tiara', 'rosa', 'raro', 'Tiara com pedra e estrela.'],
 ['chifres', 'Chifres de Energia', 'demoniaco', 'epico', 'Chifres que soltam energia.'], ['orelhas-gato', 'Orelhas de Gato', 'rosa', 'incomum', 'Orelhas que mexem sozinhas.'],
 ['orelhas-coelho', 'Orelhas de Coelho', 'branco', 'incomum', 'Orelhas compridas e fofas.'], ['halo', 'Halo Girando', 'angelical', 'lendario', 'Halo de luz girando sobre a cabeça.'],
 ['bandana', 'Bandana', 'vermelho', 'comum', 'Bandana com as pontas ao vento.'], ['capacete', 'Capacete Tático', 'militar', 'raro', 'Capacete com visor e lanterna.'],
 ['kabuto', 'Kabuto', 'samurai', 'epico', 'Elmo samurai com crista.'], ['bruxa', 'Chapéu de Bruxa', 'halloween', 'raro', 'Pontudo e com fivela.'],
 ['gorro-natal', 'Gorro de Natal', 'natal', 'incomum', 'Com pompom que balança.'], ['fones', 'Fones Gamer', 'cyberpunk', 'raro', 'Fones com LED piscando.']
].forEach(([art, name, pal, r, d]) => add('chapeu', 'ht-' + art, name, r, d, { art, pal, variants: vars(pal, 3, CORES.concat(DUO)).slice(1) }));
[['oculos', 'Óculos Redondos', 'preto', 'comum', 'Armação redonda.'], ['oculos-sol', 'Óculos Escuros', 'preto', 'incomum', 'Lentes escuras com reflexo.'],
 ['visor', 'Visor Tático', 'futurista', 'epico', 'Visor com varredura de luz.'], ['mascara-ninja', 'Máscara Ninja', 'ninja', 'raro', 'Cobre o rosto até o nariz.'],
 ['mascara-cyber', 'Máscara Cyber', 'cyberpunk', 'epico', 'LEDs que acendem em sequência.'], ['mascara-caveira', 'Máscara Caveira', 'shadow', 'epico', 'Meia caveira com olhos acesos.'],
 ['tapa-olho', 'Tapa-Olho', 'preto', 'incomum', 'Estilo pirata.'], ['mascara-gas', 'Máscara de Gás', 'militar', 'raro', 'Filtros duplos e visor.']
].forEach(([art, name, pal, r, d]) => add('acessorio', 'rosto-' + art, name, r, d, { art, pal, variants: vars(pal, 3, CORES.concat(DUO)).slice(1) }));

/* ---------------- armas ---------------- */
const ARMAS = { katana: 'Katana', espada: 'Espada', machado: 'Machado', foice: 'Foice', arco: 'Arco', pistola: 'Pistola Futurista', rifle: 'Rifle Futurista', martelo: 'Martelo de Guerra', lanca: 'Lança', cajado: 'Cajado', tridente: 'Tridente', shuriken: 'Shuriken Gigante' };
const WFX = { brilho: 'Brilhante', energia: 'de Energia', particulas: 'Estelar', fogo: 'Flamejante', gelo: 'Congelada', eletrico: 'Elétrica', holo: 'Holográfica', runas: 'Rúnica' };
[['katana', null, 'prata', 'raro'], ['espada', null, 'dourado', 'raro'], ['machado', null, 'medieval', 'incomum'], ['foice', null, 'shadow', 'epico'], ['arco', null, 'verde', 'incomum'],
 ['pistola', null, 'futurista', 'raro'], ['rifle', null, 'militar', 'raro'], ['martelo', null, 'prata', 'raro'], ['lanca', null, 'vermelho', 'incomum'], ['cajado', null, 'mistico', 'raro'],
 ['tridente', null, 'ciano', 'raro'], ['shuriken', null, 'ninja', 'incomum'],
 ['katana', 'fogo', 'fogo', 'lendario'], ['katana', 'eletrico', 'eletrico', 'lendario'], ['espada', 'brilho', 'royal', 'epico'], ['espada', 'gelo', 'gelo', 'lendario'],
 ['machado', 'fogo', 'demoniaco', 'epico'], ['foice', 'energia', 'preto-roxo', 'mitico'], ['arco', 'particulas', 'galaxia', 'epico'], ['pistola', 'holo', 'cyberpunk', 'epico'],
 ['rifle', 'energia', 'neon', 'lendario'], ['martelo', 'eletrico', 'azul-ciano', 'mitico'], ['lanca', 'runas', 'mistico', 'epico'], ['cajado', 'particulas', 'fantasia', 'lendario'],
 ['tridente', 'eletrico', 'azul-ciano', 'lendario'], ['shuriken', 'fogo', 'fogo', 'epico']
].forEach(([art, fx, pal, r]) => add('arma', 'arma-' + art + (fx ? '-' + fx : ''), ARMAS[art] + (fx ? ' ' + WFX[fx] : ''), r,
  fx ? 'Nas costas do avatar, com efeito ' + WFX[fx].toLowerCase() + ' na lâmina.' : 'Fica nas costas do avatar, no perfil.', Object.assign({ art, pal, variants: vars(pal, 2, CORES.concat(DUO)).slice(1) }, fx ? { fx } : {})));
add('arma', 'arma-katanas-duplas', 'Katanas Duplas', 'lendario', 'Duas katanas cruzadas nas costas.', { art: 'katana', pal: 'samurai', dual: true, variants: ['preto-vermelho', 'branco-dourado'] });
add('arma', 'arma-espadas-duplas-fogo', 'Espadas Duplas Flamejantes', 'mitico', 'Par de espadas em chamas.', { art: 'espada', pal: 'fogo', dual: true, fx: 'fogo' });
add('arma', 'arma-shuriken-duplas', 'Shurikens Gêmeas', 'epico', 'Duas shurikens girando ao lado do avatar.', { art: 'shuriken', pal: 'prata', dual: true });

/* ---------------- animações do avatar, efeitos e entradas ---------------- */
[['pulso', 'Pulso de Brilho', 'dourado', 'incomum', 'Um brilho que pulsa em volta do avatar.'], ['aura', 'Aura', 'roxo', 'epico', 'Aura que respira e muda de forma.'],
 ['energia', 'Anel de Energia', 'ciano', 'epico', 'Anéis girando e orbes de energia.'], ['fumaca', 'Fumaça', 'shadow', 'raro', 'Fumaça subindo em volta.'],
 ['particulas', 'Partículas', 'galaxia', 'raro', 'Partículas subindo sem parar.'], ['raios', 'Raios', 'eletrico', 'lendario', 'Raios estalando em volta.'],
 ['chamas', 'Chamas', 'fogo', 'lendario', 'Coroa de fogo em volta do avatar.'], ['neve', 'Neve', 'gelo', 'incomum', 'Neve caindo na frente.'],
 ['faiscas', 'Faíscas', 'laranja', 'raro', 'Faíscas saindo da borda.'], ['glitch', 'Glitch', 'cyberpunk', 'epico', 'O avatar falha em RGB de vez em quando.'],
 ['luz', 'Luz Passando', 'branco', 'incomum', 'Um reflexo de luz cruza o avatar.'], ['olhos', 'Olhar Brilhante', 'vermelho', 'epico', 'Os olhos brilham de repente.'],
 ['respira', 'Respiração', 'prata', 'comum', 'O avatar respira devagar.'], ['zoom', 'Zoom Lento', 'branco', 'incomum', 'A foto aproxima e afasta devagar.'],
 ['camera', 'Câmera Viva', 'prata', 'raro', 'Movimento de câmera, como um vídeo.'], ['orbita', 'Órbita', 'espacial', 'epico', 'Um planeta girando em volta.'],
 ['coracoes', 'Corações', 'namorados', 'limitado', 'Corações subindo.'], ['petalas', 'Pétalas', 'primavera', 'limitado', 'Pétalas caindo.'], ['morcegos', 'Morcegos', 'halloween', 'limitado', 'Morcegos voando em volta.']
].forEach(([art, name, pal, r, d]) => add('animacao', 'anim-' + art, name, r, d, { art, pal, variants: vars(pal, 2, CORES.concat(DUO)).slice(1) }));
[['explosao', 'Explosão', 'fogo', 'lendario', 'Uma explosão de energia quando abrem seu perfil.'], ['fumaca', 'Nuvem de Fumaça', 'shadow', 'raro', 'Seu perfil surge da fumaça.'],
 ['raios', 'Tempestade', 'eletrico', 'lendario', 'Raios caem quando abrem seu perfil.'], ['chamas', 'Muralha de Fogo', 'fogo', 'epico', 'Chamas sobem da base do perfil.'],
 ['neve', 'Nevasca', 'gelo', 'raro', 'Um floco gigante e neve caindo.'], ['confete', 'Confete', 'gradiente', 'incomum', 'Confete voando para todo lado.'],
 ['energia', 'Onda de Energia', 'ciano', 'epico', 'Ondas de choque e feixes de luz.'], ['portal', 'Portal', 'roxo', 'mitico', 'Um portal gira atrás de você.'],
 ['glitch', 'Glitch', 'cyberpunk', 'epico', 'A tela falha em RGB.'], ['estrelas', 'Chuva de Estrelas', 'dourado', 'raro', 'Estrelas saem do avatar.'],
 ['cristais', 'Cristais', 'gelo', 'lendario', 'Cristais crescem em volta.'], ['simbolos', 'Círculo Rúnico', 'mistico', 'mitico', 'Runas girando num círculo mágico.'],
 ['coracoes', 'Explosão de Amor', 'namorados', 'limitado', 'Corações para todo lado.'], ['fogos', 'Fogos de Artifício', 'anonovo', 'limitado', 'Fogos estourando no céu.'],
 ['petalas', 'Chuva de Pétalas', 'primavera', 'limitado', 'Pétalas caindo por todo o perfil.'], ['morcegos', 'Revoada', 'halloween', 'limitado', 'Morcegos saem voando.']
].forEach(([art, name, pal, r, d]) => add('efeito', 'efeito-' + art, name, r, d, { art, pal, variants: vars(pal, 2, CORES.concat(DUO)).slice(1) }));
[['surgir', 'Surgir', 'dourado', 'comum', 'Sobe suave até o lugar.'], ['queda', 'Queda', 'prata', 'incomum', 'Cai do alto e levanta poeira.'], ['giro', 'Giro', 'ciano', 'raro', 'Chega girando com rastro de luz.'],
 ['portal', 'Portal', 'roxo', 'epico', 'Sai de um portal.'], ['glitch', 'Glitch', 'cyberpunk', 'raro', 'Aparece falhando em RGB.'], ['raio', 'Raio', 'eletrico', 'lendario', 'Chega com um raio.'],
 ['fumaca', 'Fumaça', 'shadow', 'raro', 'Aparece da fumaça.'], ['zoom', 'Zoom', 'branco', 'incomum', 'Vem de perto da tela.']
].forEach(([art, name, pal, r, d]) => add('entrada', 'entrada-' + art, 'Entrada: ' + name, r, d, { art, pal }));

/* ---------------- banners, capas e fundos animados ---------------- */
const SCN = { ondas: 'Ondas', fumaca: 'Fumaça', chamas: 'Chamas', raios: 'Tempestade', estrelas: 'Céu Estrelado', glitch: 'Glitch', flutuantes: 'Formas Flutuantes', luzes: 'Holofotes',
  grade: 'Synthwave', aurora: 'Aurora', particulas: 'Bokeh', bolhas: 'Bolhas', circuito: 'Circuito', petalas: 'Cerejeira', neve: 'Montanha Nevada', chuva: 'Cidade na Chuva',
  nebulosa: 'Nebulosa', vortice: 'Vórtice', cristais: 'Caverna de Cristal', cidade: 'Cidade Neon', hexagonos: 'Colmeia Hex' };
const SPAL = { ondas: 'azul-ciano', fumaca: 'shadow', chamas: 'fogo', raios: 'eletrico', estrelas: 'espacial', glitch: 'cyberpunk', flutuantes: 'futurista', luzes: 'dourado', grade: 'cyberpunk',
  aurora: 'verde', particulas: 'rosa', bolhas: 'ciano', circuito: 'tech', petalas: 'primavera', neve: 'inverno', chuva: 'preto-azul', nebulosa: 'galaxia', vortice: 'preto-roxo', cristais: 'mistico', cidade: 'cyberpunk', hexagonos: 'neon' };
const SRAR = ['raro', 'epico', 'lendario', 'epico', 'raro', 'mitico', 'incomum'];
Object.keys(SCN).forEach((art, i) => {
  add('banner', 'bn-' + art, SCN[art], SRAR[i % SRAR.length], 'Banner animado de cabeçalho. Troca de cor.', { art, pal: SPAL[art], variants: vars(SPAL[art], 3, CORES.concat(DUO)).slice(1) });
  add('capa', 'capa-' + art, 'Capa ' + SCN[art], SRAR[(i + 2) % SRAR.length], 'Capa grande atrás da vitrine do perfil.', { art, pal: SPAL[art], variants: vars(SPAL[art], 3, CORES.concat(DUO)).slice(1) });
});
['nebulosa', 'aurora', 'chamas', 'neve', 'cidade', 'particulas', 'circuito', 'petalas'].forEach((art, i) => add('fundo', 'fundo-' + art + '-anim', 'Fundo ' + SCN[art], ['raro', 'epico', 'lendario'][i % 3], 'Fundo animado da página inteira do perfil.', { art, pal: SPAL[art], variants: vars(SPAL[art], 2, CORES.concat(DUO)).slice(1) }));

/* ---------------- temas ---------------- */
const TSTY = { futurista: 'Futurista', cyberpunk: 'Cyberpunk', samurai: 'Samurai', ninja: 'Ninja', medieval: 'Medieval', espacial: 'Espacial', dark: 'Dark', royal: 'Royal', demoniaco: 'Demoníaco', angelical: 'Angelical',
  galaxia: 'Galáxia', fogo: 'Fogo', gelo: 'Gelo', eletrico: 'Elétrico', shadow: 'Shadow', tech: 'Tech', street: 'Street', militar: 'Militar', mistico: 'Místico', fantasia: 'Fantasia', arcade: 'Arcade', neon: 'Neon' };
Object.keys(TSTY).forEach((st, i) => add('tema', 'tema-' + st, 'Tema ' + TSTY[st], ['raro', 'epico', 'raro', 'lendario'][i % 4], 'Muda o fundo, as bordas e o brilho do seu perfil.', { art: st === 'neon' ? 'neon' : st, pal: st }));
['preto', 'branco', 'azul', 'vermelho', 'roxo', 'rosa', 'verde', 'amarelo', 'laranja', 'ciano', 'dourado', 'prata', 'neon', 'rgb', 'gradiente', 'preto-vermelho', 'preto-roxo', 'preto-azul', 'branco-dourado', 'azul-ciano', 'vermelho-preto']
  .forEach((p, i) => add('tema', 'tema-cor-' + p, 'Tema ' + C.PAL[p].name, i < 12 ? 'comum' : 'incomum', 'Cores ' + C.PAL[p].name.toLowerCase() + ' no seu perfil.', { art: 'liso', pal: p }));

/* ---------------- cor do nick ---------------- */
const NKN = { solida: 'Sólida', grad: 'Gradiente', rgb: 'RGB', brilho: 'Brilho', neon: 'Neon', fogo: 'Fogo', gelo: 'Gelo', galaxia: 'Galáxia', metal: 'Metal', glitch: 'Glitch' };
[['solida', 'ciano', 'comum'], ['solida', 'rosa', 'comum'], ['solida', 'verde', 'comum'], ['solida', 'laranja', 'comum'], ['grad', 'gradiente', 'incomum'], ['grad', 'azul-ciano', 'incomum'],
 ['grad', 'preto-vermelho', 'raro'], ['grad', 'royal', 'raro'], ['rgb', 'rgb', 'lendario'], ['brilho', 'dourado', 'epico'], ['brilho', 'prata', 'raro'], ['neon', 'neon', 'epico'], ['neon', 'rosa', 'epico'],
 ['neon', 'ciano', 'epico'], ['fogo', 'fogo', 'lendario'], ['gelo', 'gelo', 'epico'], ['galaxia', 'galaxia', 'lendario'], ['metal', 'prata', 'raro'], ['glitch', 'cyberpunk', 'mitico']
].forEach(([art, pal, r]) => add('cor', 'nick-' + art + '-' + pal, 'Nick ' + NKN[art] + (art === 'solida' || art === 'grad' || art === 'neon' || art === 'brilho' ? ' ' + C.PAL[pal].name : ''), r, 'Cor do seu nome com efeito ' + NKN[art].toLowerCase() + '.', { art, pal, color: C.PAL[pal].g }));

/* ---------------- molduras com cor ---------------- */
const FRN = { portal: 'Portal', estrelas: 'Estrelas', rgb: 'RGB', cristal: 'Cristal', caveira: 'Caveiras', energia: 'Energia', universo: 'Universo', dna: 'DNA', flores: 'Flores', gotas: 'Gotas',
  shuriken: 'Shurikens', eletrica: 'Eletricidade', runas: 'Runas', neon: 'Neon', espinhos: 'Espinhos', penas: 'Penas', labaredas: 'Labaredas', geada: 'Geada' };
const FPAL = { portal: 'roxo', estrelas: 'espacial', rgb: 'rgb', cristal: 'gelo', caveira: 'shadow', energia: 'ciano', universo: 'galaxia', dna: 'tech', flores: 'primavera', gotas: 'vermelho',
  shuriken: 'ninja', eletrica: 'eletrico', runas: 'mistico', neon: 'neon', espinhos: 'demoniaco', penas: 'angelical', labaredas: 'fogo', geada: 'gelo' };
const FRAR = { portal: 'mitico', estrelas: 'epico', rgb: 'lendario', cristal: 'lendario', caveira: 'epico', energia: 'epico', universo: 'mitico', dna: 'raro', flores: 'raro', gotas: 'raro',
  shuriken: 'epico', eletrica: 'lendario', runas: 'lendario', neon: 'raro', espinhos: 'epico', penas: 'lendario', labaredas: 'lendario', geada: 'epico' };
Object.keys(FRN).forEach((art) => add('moldura', 'mold-' + art, 'Moldura ' + FRN[art], FRAR[art], 'Moldura animada que aceita outras cores.', { art, pal: FPAL[art], variants: vars(FPAL[art], 3, CORES.concat(DUO)).slice(1) }));
[['portal', 'Portal Vermelho', 'vermelho-preto', 'mitico'], ['energia', 'Energia Roxa', 'roxo', 'epico'], ['energia', 'Energia Vermelha', 'vermelho', 'epico'], ['labaredas', 'Chamas Azuis', 'azul-ciano', 'lendario'],
 ['estrelas', 'Estrelas Douradas', 'dourado', 'epico'], ['cristal', 'Cristal Rosa', 'rosa', 'lendario'], ['neon', 'Neon Rosa', 'cyberpunk', 'raro']
].forEach(([art, name, pal, r]) => add('moldura', 'mold-' + art + '-' + pal, 'Moldura ' + name, r, 'Edição de cor fixa da moldura ' + FRN[art] + '.', { art, pal }));

/* ---------------- eventos de temporada ---------------- */
const EVENTS = [
  ['primavera', 'Primavera', '🌸', '#f472b6', 'Flores, pétalas e cores claras.', '2026-09-22', '2026-12-20'],
  ['campeonato', 'Copa BattleHub', '🏆', '#facc15', 'Itens do campeonato da temporada.', '2026-09-20', '2026-11-30'],
  ['comunidade', 'Feito pela Comunidade', '🤝', '#22d3ee', 'Ideias votadas pelos jogadores.', '2026-09-01', '2026-12-31'],
  ['halloween', 'Halloween', '🎃', '#f97316', 'Abóboras, morcegos e caveiras.', '2026-10-15', '2026-11-05'],
  ['natal', 'Natal', '🎄', '#dc2626', 'Gorros, renas, luzes e neve.', '2026-12-01', '2027-01-06'],
  ['verao', 'Verão', '☀️', '#06b6d4', 'Sol, praia e ondas.', '2026-12-21', '2027-03-20'],
  ['anonovo', 'Ano-Novo', '🎆', '#d4a537', 'Fogos e dourado para virar o ano.', '2026-12-26', '2027-01-10'],
  ['namorados', 'Dia dos Namorados', '💘', '#e11d48', 'Corações e tons de rosa.', '2027-06-01', '2027-06-15'],
  ['inverno', 'Inverno', '❄️', '#93c5fd', 'Gelo, neve e azul frio.', '2027-06-21', '2027-09-22']
];
const EV = {}; EVENTS.forEach((e) => { EV[e[0]] = { from: e[5] + 'T00:00:00-03:00', to: e[6] + 'T23:59:59-03:00' }; });
function eventItem(ev, kind, id, name, desc, data) { return add(kind, id, name, 'limitado', desc, data, { event_key: ev, available_from: EV[ev].from, available_until: EV[ev].to }); }
// os itens "limitado" de cima (animações e efeitos de data) entram no evento certo
const EVMAP = { 'anim-coracoes': 'namorados', 'anim-petalas': 'primavera', 'anim-morcegos': 'halloween', 'efeito-coracoes': 'namorados', 'efeito-fogos': 'anonovo', 'efeito-petalas': 'primavera', 'efeito-morcegos': 'halloween' };
items.forEach((it) => { if (EVMAP[it.id]) Object.assign(it, { event_key: EVMAP[it.id], available_from: EV[EVMAP[it.id]].from, available_until: EV[EVMAP[it.id]].to }); });
eventItem('primavera', 'moldura', 'ev-prim-moldura', 'Moldura Jardim', 'Flores balançando em volta do avatar.', { art: 'flores', pal: 'primavera' });
eventItem('primavera', 'banner', 'ev-prim-banner', 'Cerejeira em Flor', 'Pétalas caindo no cabeçalho.', { art: 'petalas', pal: 'primavera' });
eventItem('primavera', 'pet', 'ev-prim-coelho', 'Coelho da Primavera', 'Coelho com cores de flor.', { art: 'coelho', pal: 'primavera' });
eventItem('primavera', 'tema', 'ev-prim-tema', 'Tema Primavera', 'Tons de flor no perfil.', { art: 'fantasia', pal: 'primavera' });
eventItem('primavera', 'chaveiro', 'ev-prim-kc', 'Coração em Flor', 'Chaveiro com brilho de primavera.', { art: 'coracao', pal: 'primavera', fx: 'particulas' });
eventItem('campeonato', 'chaveiro', 'ev-copa-kc', 'Troféu da Copa', 'Troféu brilhante da Copa BattleHub.', { art: 'trofeu', pal: 'dourado', fx: 'luz', peso: 1.5 });
eventItem('campeonato', 'banner', 'ev-copa-banner', 'Arena da Copa', 'Holofotes dourados do campeonato.', { art: 'luzes', pal: 'dourado' });
eventItem('campeonato', 'moldura', 'ev-copa-moldura', 'Moldura da Copa', 'Estrelas douradas do campeonato.', { art: 'estrelas', pal: 'dourado' });
eventItem('comunidade', 'pet', 'ev-com-slime', 'Slime da Comunidade', 'O pet mais votado pela comunidade.', { art: 'slime', pal: 'rgb' });
eventItem('comunidade', 'cor', 'ev-com-nick', 'Nick Comunidade', 'Gradiente escolhido pelos jogadores.', { art: 'galaxia', pal: 'fantasia', color: C.PAL.fantasia.g });
eventItem('halloween', 'moldura', 'ev-hw-moldura', 'Moldura Halloween', 'Abóboras acesas e morcegos.', { art: 'halloween', pal: 'halloween' });
eventItem('halloween', 'avatar', 'ev-hw-avatar', 'Caveira de Halloween', 'Caveira com olhos de abóbora.', { art: 'caveira', pal: 'halloween' });
eventItem('halloween', 'pet', 'ev-hw-pet', 'Abóbora Assombrada', 'Abóbora viva com olhos roxos.', { art: 'abobora', pal: 'halloween' });
eventItem('halloween', 'capa', 'ev-hw-capa', 'Noite de Halloween', 'Fumaça laranja e roxa.', { art: 'fumaca', pal: 'halloween' });
eventItem('natal', 'moldura', 'ev-natal-moldura', 'Guirlanda de Natal', 'Luzes piscando em volta.', { art: 'natal', pal: 'natal' });
eventItem('natal', 'pet', 'ev-natal-rena', 'Rena Iluminada', 'Nariz que brilha no escuro.', { art: 'rena', pal: 'natal' });
eventItem('natal', 'chapeu', 'ev-natal-gorro', 'Gorro Dourado', 'Gorro de Natal com pompom dourado.', { art: 'gorro-natal', pal: 'anonovo' });
eventItem('natal', 'banner', 'ev-natal-banner', 'Noite de Natal', 'Neve caindo nas montanhas.', { art: 'neve', pal: 'natal' });
eventItem('verao', 'moldura', 'ev-verao-moldura', 'Sol de Verão', 'Raios de sol girando.', { art: 'verao', pal: 'verao' });
eventItem('verao', 'capa', 'ev-verao-capa', 'Mar de Verão', 'Ondas azuis e sol.', { art: 'ondas', pal: 'verao' });
eventItem('anonovo', 'moldura', 'ev-ano-moldura', 'Réveillon', 'Fogos estourando em volta.', { art: 'festa', pal: 'anonovo' });
eventItem('anonovo', 'cor', 'ev-ano-nick', 'Nick Réveillon', 'Brilho dourado para virar o ano.', { art: 'brilho', pal: 'anonovo', color: C.PAL.anonovo.g });
eventItem('namorados', 'moldura', 'ev-nam-moldura', 'Corações', 'Corações pulsando em volta.', { art: 'coracoes', pal: 'namorados' });
eventItem('namorados', 'chaveiro', 'ev-nam-kc', 'Coração Apaixonado', 'Chaveiro de coração com luz.', { art: 'coracao', pal: 'namorados', fx: 'luz' });
eventItem('inverno', 'moldura', 'ev-inv-moldura', 'Flocos de Inverno', 'Flocos girando em volta.', { art: 'inverno', pal: 'inverno' });
eventItem('inverno', 'pet', 'ev-inv-pinguim', 'Pinguim do Inverno', 'Pinguim com cachecol azul.', { art: 'pinguim', pal: 'inverno' });

/* ---------------- bundles (peças exclusivas do bundle + peças da loja) ---------------- */
const BUNDLES = [
  ['ninja', 'Bundle Ninja', 'ninja', 'lendario', '🥷', [['avatar', 'ninja'], ['arma', 'katana', { dual: true, fx: 'brilho' }], ['chaveiro', 'shuriken', { fx: 'fumaca' }], ['moldura', 'shuriken'], ['efeito', 'fumaca'], ['entrada', 'fumaca'], ['banner', 'fumaca'], ['tema', 'ninja']]],
  ['samurai', 'Bundle Samurai', 'samurai', 'mitico', '⛩️', [['avatar', 'samurai'], ['chapeu', 'kabuto'], ['arma', 'katana', { fx: 'fogo' }], ['pet', 'raposa'], ['moldura', 'labaredas'], ['capa', 'petalas'], ['tema', 'samurai'], ['efeito', 'petalas']]],
  ['cyberpunk', 'Bundle Cyberpunk', 'cyberpunk', 'mitico', '🌆', [['avatar', 'hacker'], ['acessorio', 'mascara-cyber'], ['arma', 'pistola', { fx: 'holo', dual: true }], ['pet', 'robo'], ['chaveiro', 'gamepad', { fx: 'holo' }], ['moldura', 'neon'], ['banner', 'cidade'], ['capa', 'grade'], ['animacao', 'glitch'], ['cor', 'glitch'], ['tema', 'cyberpunk']]],
  ['inferno', 'Bundle Inferno', 'fogo', 'mitico', '🔥', [['avatar', 'demonio'], ['chapeu', 'chifres'], ['arma', 'foice', { fx: 'fogo' }], ['pet', 'salamandra'], ['chaveiro', 'cranio', { fx: 'fogo' }], ['moldura', 'labaredas'], ['animacao', 'chamas'], ['efeito', 'chamas'], ['capa', 'chamas'], ['cor', 'fogo']]],
  ['gelo', 'Bundle Era do Gelo', 'gelo', 'lendario', '🧊', [['avatar', 'cavaleiro'], ['arma', 'espada', { fx: 'gelo' }], ['pet', 'pinguim'], ['chaveiro', 'floco', { fx: 'gelo' }], ['moldura', 'geada'], ['animacao', 'neve'], ['efeito', 'cristais'], ['capa', 'neve'], ['tema', 'gelo']]],
  ['galaxia', 'Bundle Galáxia', 'galaxia', 'mitico', '🌌', [['avatar', 'astronauta'], ['pet', 'alien'], ['arma', 'cajado', { fx: 'particulas' }], ['chaveiro', 'estrela', { fx: 'particulas' }], ['moldura', 'universo'], ['animacao', 'orbita'], ['efeito', 'portal'], ['capa', 'nebulosa'], ['banner', 'estrelas'], ['tema', 'galaxia']]],
  ['royal', 'Bundle Realeza', 'royal', 'mitico', '👑', [['avatar', 'rei'], ['chapeu', 'coroa'], ['arma', 'espada', { fx: 'brilho' }], ['pet', 'lobo'], ['chaveiro', 'trofeu', { fx: 'luz' }], ['moldura', 'estrelas'], ['animacao', 'pulso'], ['efeito', 'estrelas'], ['banner', 'luzes'], ['cor', 'brilho'], ['tema', 'royal']]],
  ['demonio', 'Bundle Sombras', 'shadow', 'lendario', '💀', [['avatar', 'caveira'], ['acessorio', 'mascara-caveira'], ['arma', 'foice', { fx: 'energia' }], ['pet', 'corvo'], ['moldura', 'caveira'], ['animacao', 'fumaca'], ['efeito', 'fumaca'], ['capa', 'vortice'], ['tema', 'shadow']]],
  ['anjo', 'Bundle Celestial', 'angelical', 'mitico', '😇', [['avatar', 'anjo'], ['chapeu', 'halo'], ['arma', 'lanca', { fx: 'brilho' }], ['pet', 'espirito'], ['moldura', 'penas'], ['animacao', 'aura'], ['efeito', 'estrelas'], ['capa', 'aurora'], ['tema', 'angelical']]],
  ['arcade', 'Bundle Arcade', 'arcade', 'lendario', '🕹️', [['avatar', 'gamer'], ['chapeu', 'fones'], ['pet', 'slime'], ['chaveiro', 'gamepad'], ['moldura', 'rgb'], ['animacao', 'glitch'], ['efeito', 'confete'], ['banner', 'grade'], ['cor', 'rgb'], ['tema', 'arcade']]],
  ['militar', 'Bundle Operação', 'militar', 'lendario', '🎖️', [['avatar', 'cyborg'], ['chapeu', 'capacete'], ['acessorio', 'mascara-gas'], ['arma', 'rifle', { fx: 'energia' }], ['chaveiro', 'medalha'], ['moldura', 'dna'], ['entrada', 'queda'], ['banner', 'luzes'], ['tema', 'militar']]],
  ['mago', 'Bundle Arcano', 'mistico', 'mitico', '🔮', [['avatar', 'mago'], ['arma', 'cajado', { fx: 'runas' }], ['pet', 'espirito'], ['chaveiro', 'cristal', { fx: 'luz' }], ['moldura', 'runas'], ['animacao', 'energia'], ['efeito', 'simbolos'], ['capa', 'cristais'], ['tema', 'mistico']]],
  ['halloween', 'Bundle Halloween', 'halloween', 'limitado', '🎃', [['avatar', 'bruxa'], ['chapeu', 'bruxa'], ['pet', 'abobora'], ['chaveiro', 'abobora', { fx: 'fogo' }], ['moldura', 'halloween'], ['animacao', 'morcegos'], ['efeito', 'morcegos'], ['capa', 'fumaca']], 'halloween'],
  ['natal', 'Bundle Natal', 'natal', 'limitado', '🎅', [['avatar', 'noel'], ['chapeu', 'gorro-natal'], ['pet', 'rena'], ['chaveiro', 'floco', { fx: 'luz' }], ['moldura', 'natal'], ['animacao', 'neve'], ['efeito', 'neve'], ['banner', 'neve']], 'natal'],
  ['primavera', 'Bundle Primavera', 'primavera', 'limitado', '🌸', [['avatar', 'anjo'], ['chapeu', 'tiara'], ['pet', 'coelho'], ['chaveiro', 'coracao', { fx: 'particulas' }], ['moldura', 'flores'], ['animacao', 'petalas'], ['efeito', 'petalas'], ['capa', 'petalas'], ['tema', 'fantasia']], 'primavera']
];
const KNAME = { avatar: 'Avatar', chapeu: 'Chapéu', acessorio: 'Máscara', arma: 'Arma', pet: 'Pet', chaveiro: 'Chaveiro', moldura: 'Moldura', efeito: 'Efeito', entrada: 'Entrada', banner: 'Banner', capa: 'Capa', animacao: 'Animação', tema: 'Tema', cor: 'Nick' };
BUNDLES.forEach(([key, name, pal, r, icon, parts, ev]) => {
  const bid = 'bundle-' + key;
  const ids = parts.map(([kind, art, extra]) => {
    const id = bid + '-' + kind;
    const data = Object.assign({ art, pal, bundle: bid }, extra || {});
    if (kind === 'cor') data.color = C.PAL[pal].g;
    if (kind === 'chaveiro') data.peso = PESO[art] || 1;
    const it = add(kind, id, KNAME[kind] + ' ' + name.replace('Bundle ', ''), r === 'limitado' ? 'limitado' : r, 'Peça exclusiva do ' + name + '. Só vem no bundle.', data, ev ? { event_key: ev, available_from: EV[ev].from, available_until: EV[ev].to } : {});
    it.price = null;
    return id;
  });
  const sum = ids.length * (r === 'mitico' ? 1800 : 1200);
  const b = add('bundle', bid, name, r, 'Visual completo: ' + parts.map((p) => KNAME[p[0]].toLowerCase()).join(', ') + '. Equipe tudo de uma vez ou só as partes que quiser.',
    { items: ids, pal, icon, variants: vars(pal, 2, CORES.concat(DUO)).slice(1) }, ev ? { event_key: ev, available_from: EV[ev].from, available_until: EV[ev].to } : {});
  b.price = Math.round(sum * .62 / 100) * 100 - 10;
});

/* ---------------- coleções com recompensa exclusiva ---------------- */
const COLS = [
  ['inferno', 'Inferno', '🔥', 'Tudo que pega fogo.', ['arma-katana-fogo', 'kc-cranio-fogo', 'anim-chamas', 'efeito-chamas', 'mold-labaredas', 'nick-fogo-fogo'], ['moldura', 'excl-moldura-inferno', 'Moldura Inferno Eterno', { art: 'labaredas', pal: 'demoniaco' }]],
  ['gelo', 'Gelo', '❄️', 'Frio de verdade.', ['arma-espada-gelo', 'kc-cristal-gelo', 'anim-neve', 'mold-geada', 'pet-pinguim', 'efeito-neve'], ['pet', 'excl-pet-lobo-gelo', 'Lobo Glacial', { art: 'lobo', pal: 'inverno' }]],
  ['galaxia', 'Galáxia', '🌌', 'Do espaço para o seu perfil.', ['av-astronauta', 'pet-alien', 'mold-universo', 'anim-orbita', 'bn-nebulosa', 'kc-estrela-particulas'], ['efeito', 'excl-efeito-supernova', 'Supernova', { art: 'explosao', pal: 'galaxia' }]],
  ['royal', 'Realeza', '👑', 'Coroa, ouro e brilho.', ['ht-coroa', 'av-rei', 'kc-trofeu-luz', 'nick-brilho-dourado', 'tema-royal', 'arma-espada-brilho'], ['chapeu', 'excl-coroa-imperial', 'Coroa Imperial', { art: 'coroa', pal: 'branco-dourado' }]],
  ['cyber', 'Cyber', '🌆', 'Neon e tecnologia.', ['av-hacker', 'rosto-mascara-cyber', 'arma-pistola-holo', 'mold-neon', 'bn-cidade', 'anim-glitch'], ['animacao', 'excl-anim-hologram', 'Holograma', { art: 'glitch', pal: 'azul-ciano' }]],
  ['sombra', 'Sombra', '🌑', 'Para quem joga no escuro.', ['av-caveira', 'rosto-mascara-caveira', 'arma-foice-energia', 'mold-caveira', 'anim-fumaca', 'tema-shadow'], ['arma', 'excl-foice-abismo', 'Foice do Abismo', { art: 'foice', pal: 'preto-roxo', fx: 'runas' }]],
  ['natureza', 'Natureza', '🌿', 'Bichos e flores.', ['pet-raposa', 'pet-gato', 'pet-cachorro', 'pet-coelho', 'mold-flores', 'bn-aurora'], ['pet', 'excl-pet-raposa-dourada', 'Raposa Dourada', { art: 'raposa', pal: 'dourado' }]],
  ['arcade', 'Arcade', '🕹️', 'Gamer raiz.', ['av-gamer', 'ht-fones', 'kc-gamepad', 'nick-rgb-rgb', 'tema-arcade', 'bn-grade'], ['moldura', 'excl-moldura-arcade', 'Moldura Fliperama', { art: 'rgb', pal: 'arcade' }]],
  ['halloween', 'Halloween', '🎃', 'Colecione os itens do evento.', ['ev-hw-moldura', 'ev-hw-avatar', 'ev-hw-pet', 'ev-hw-capa'], ['chaveiro', 'excl-kc-abobora-rainha', 'Abóbora Rainha', { art: 'abobora', pal: 'halloween', fx: 'fogo' }], 'halloween'],
  ['natal', 'Natal', '🎄', 'Colecione os itens do evento.', ['ev-natal-moldura', 'ev-natal-rena', 'ev-natal-gorro', 'ev-natal-banner'], ['avatar', 'excl-av-noel-dourado', 'Noel Dourado', { art: 'noel', pal: 'anonovo' }], 'natal'],
  ['primavera', 'Primavera', '🌸', 'Colecione os itens do evento.', ['ev-prim-moldura', 'ev-prim-banner', 'ev-prim-coelho', 'ev-prim-tema', 'ev-prim-kc'], ['capa', 'excl-capa-jardim', 'Jardim Eterno', { art: 'petalas', pal: 'fantasia' }], 'primavera'],
  ['copa', 'Copa BattleHub', '🏆', 'Itens do campeonato.', ['ev-copa-kc', 'ev-copa-banner', 'ev-copa-moldura'], ['cor', 'excl-nick-campeao', 'Nick Campeão', { art: 'brilho', pal: 'dourado', color: C.PAL.dourado.g }], 'campeonato']
];
COLS.forEach((c) => {
  const [kind, id, name, data] = c[5];
  const it = add(kind, id, name, 'exclusivo', 'Recompensa exclusiva da coleção ' + c[1] + '. Não está à venda.', data);
  it.price = null;
  c[4].forEach((i) => { if (!items.some((x) => x.id === i)) throw new Error('Coleção ' + c[0] + ' aponta para item inexistente: ' + i); });
});

/* ---------------- SQL ---------------- */
const q = (s) => (s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'");
const j = (o) => q(JSON.stringify(o)) + '::jsonb';
const now = Date.parse('2026-09-26T12:00:00Z');
let sql = '-- Gerado por scripts/cosmeticos/gerar.js — não edite à mão. Catálogo da Personalização:\n' +
  '-- ' + items.length + ' itens, ' + BUNDLES.length + ' bundles, ' + COLS.length + ' coleções e ' + EVENTS.length + ' eventos de temporada.\n\n';
sql += 'insert into public.cosmetic_events (key, name, icon, color, description, starts_at, ends_at, sort) values\n' +
  EVENTS.map((e, i) => '  (' + [q(e[0]), q(e[1]), q(e[2]), q(e[3]), q(e[4]), q(EV[e[0]].from), q(EV[e[0]].to), i].join(', ') + ')').join(',\n') +
  '\non conflict (key) do update set name = excluded.name, icon = excluded.icon, color = excluded.color, description = excluded.description, starts_at = excluded.starts_at, ends_at = excluded.ends_at, sort = excluded.sort;\n\n';
const rows = items.map((it, i) => '  (' + [q(it.id), q(it.kind), q(it.name), q(it.description), it.price == null ? 'null' : it.price, j(it.data), 'true', 1000 + i, q(it.rarity),
  q(it.event_key || null), q(it.available_from || null), q(it.available_until || null), q(new Date(now - (i % 45) * 86400e3).toISOString())].join(', ') + ')');
sql += 'insert into public.shop_items (id, kind, name, description, price_cents, data, active, sort, rarity, event_key, available_from, available_until, created_at) values\n' + rows.join(',\n') +
  '\non conflict (id) do update set kind = excluded.kind, name = excluded.name, description = excluded.description, price_cents = excluded.price_cents, data = excluded.data,\n' +
  '  sort = excluded.sort, rarity = excluded.rarity, event_key = excluded.event_key, available_from = excluded.available_from, available_until = excluded.available_until;\n\n';
sql += 'insert into public.cosmetic_collections (id, name, icon, description, reward_item_id, event_key, sort) values\n' +
  COLS.map((c, i) => '  (' + [q('col-' + c[0]), q(c[1]), q(c[2]), q(c[3]), q(c[5][1]), q(c[6] || null), i].join(', ') + ')').join(',\n') +
  '\non conflict (id) do update set name = excluded.name, icon = excluded.icon, description = excluded.description, reward_item_id = excluded.reward_item_id, event_key = excluded.event_key, sort = excluded.sort;\n\n';
sql += 'delete from public.cosmetic_collection_items where collection_id in (' + COLS.map((c) => q('col-' + c[0])).join(', ') + ');\n';
sql += 'insert into public.cosmetic_collection_items (collection_id, item_id) values\n' + COLS.flatMap((c) => c[4].map((i) => '  (' + q('col-' + c[0]) + ', ' + q(i) + ')')).join(',\n') + ';\n';

const out = path.join(ROOT, 'supabase/migrations/20260926000022_catalogo_personalizacao.sql');
fs.writeFileSync(out, sql);
const byKind = {}; items.forEach((i) => { byKind[i.kind] = (byKind[i.kind] || 0) + 1; });
console.log('Catálogo gerado: ' + items.length + ' itens →', path.relative(ROOT, out));
console.log(Object.entries(byKind).map(([k, n]) => k + ' ' + n).join(' · '));
