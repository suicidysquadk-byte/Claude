/* PERSONALIZAÇÃO: vitrine com prévia em tempo real, categorias, loja com filtros, bundles, coleções e combinações.
   A prévia usa um rascunho do visual (S.draft): tocar num item mostra na hora, mesmo sem ter;
   EQUIPAR grava no servidor, REMOVER tira, SALVAR COMBINAÇÃO guarda o visual para trocar depois. */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions;
  const app = () => BH.app;
  const C = () => BH.cosm;
  const PAGE = 24;

  // categorias da tela (as que dependem de raridade juntam vários tipos)
  const CATS = [
    { id: 'avatar', e: '👤', label: 'Avatar', kinds: ['avatar'] },
    { id: 'banner', e: '🖼️', label: 'Banners', kinds: ['banner'] },
    { id: 'capa', e: '🏞️', label: 'Capas', kinds: ['capa'] },
    { id: 'moldura', e: '🔲', label: 'Decorações', kinds: ['moldura'] },
    { id: 'placa', e: '🏷️', label: 'Placas', kinds: ['placa'] },
    { id: 'perfil', e: '🖼️', label: 'Molduras de perfil', kinds: ['perfil'] },
    { id: 'bundle', e: '🎁', label: 'Bundles', kinds: ['bundle'] },
    { id: 'efeito', e: '✨', label: 'Efeitos de Perfil', kinds: ['efeito', 'entrada'] },
    { id: 'pet', e: '🐾', label: 'Pets', kinds: ['pet'] },
    { id: 'chaveiro', e: '🔑', label: 'Chaveiros', kinds: ['chaveiro'] },
    { id: 'chapeu', e: '🧢', label: 'Chapéus', kinds: ['chapeu'] },
    { id: 'arma', e: '⚔️', label: 'Armas', kinds: ['arma'] },
    { id: 'acessorio', e: '👕', label: 'Acessórios', kinds: ['acessorio'] },
    { id: 'animacao', e: '🌟', label: 'Animações', kinds: ['animacao'] },
    { id: 'raros', e: '💎', label: 'Itens Raros', rar: ['raro', 'epico'] },
    { id: 'lendarios', e: '👑', label: 'Itens Lendários', rar: ['lendario', 'mitico'] },
    { id: 'exclusivos', e: '🔥', label: 'Itens Exclusivos', rar: ['exclusivo', 'limitado'] },
    { id: 'tema', e: '🎨', label: 'Temas', kinds: ['tema'] },
    { id: 'cor', e: '🌈', label: 'Cores', kinds: ['cor'] },
    { id: 'titulo', e: '🏷️', label: 'Títulos', kinds: ['titulo'] },
    { id: 'fundo', e: '🌄', label: 'Fundos', kinds: ['fundo'] },
    { id: 'prioridade', e: '⚡', label: 'Fila', kinds: ['prioridade'] }
  ];
  const FILTERS = [['todos', 'Todos'], ['novos', 'Novos'], ['populares', 'Populares'], ['raro', 'Raros'], ['epico', 'Épicos'], ['lendario', 'Lendários'], ['mitico', 'Míticos'], ['exclusivos', 'Exclusivos'],
    ['bundle', 'Bundles'], ['animacao', 'Animações'], ['pet', 'Pets'], ['moldura', 'Decorações'], ['placa', 'Placas'], ['perfil', 'Molduras de perfil'], ['avatar', 'Avatares'], ['banner', 'Banners'], ['chaveiro', 'Chaveiros']];
  const KIND_NAME = { placa: 'Placa de identificação', perfil: 'Moldura de perfil', avatar: 'Avatar', banner: 'Banner', capa: 'Capa', moldura: 'Decoração de avatar', bundle: 'Bundle', efeito: 'Efeito de perfil', entrada: 'Entrada', pet: 'Pet', chaveiro: 'Chaveiro',
    chapeu: 'Chapéu', arma: 'Arma', acessorio: 'Acessório', animacao: 'Animação', tema: 'Tema', cor: 'Cor do nick', titulo: 'Título', fundo: 'Fundo', prioridade: 'Fila prioritária' };
  const RK = { comum: 0, incomum: 1, raro: 2, epico: 3, lendario: 4, mitico: 5, limitado: 5.5, exclusivo: 6 };
  const LOOK = ['placa', 'perfil', 'avatar', 'banner', 'capa', 'moldura', 'pet', 'chaveiro', 'chapeu', 'arma', 'acessorio', 'efeito', 'entrada', 'animacao', 'tema', 'cor', 'fundo', 'titulo'];

  const S = { col: null, data: null, byId: {}, tab: 'visual', cat: 'avatar', filter: 'todos', mine: false, sel: null, v: null, draft: {}, shown: PAGE, mini: false, play: false };
  BH.pz = S;

  async function load() {
    const d = await api.rpc('personalizacao');
    S.data = d;
    S.byId = {};
    d.items.forEach((it) => { S.byId[it.id] = it; });
    return d;
  }
  const equipped = () => (S.data && S.data.look) || {};
  const resetDraft = () => { S.draft = JSON.parse(JSON.stringify(equipped())); };
  // rascunho → formato da vitrine ({tipo: {data, v, ...}})
  function resolved(draft) {
    const out = {};
    Object.keys(draft || {}).forEach((k) => { const e = draft[k], it = e && S.byId[e.i]; if (it) out[k] = { id: it.id, kind: it.kind, rarity: it.rarity, name: it.name, data: it.data || {}, v: e.v || null }; });
    return out;
  }
  const me = () => api.me || {};
  const userCard = () => ({ id: me().id, nick: me().nick, avatar_url: me().avatar_url, verified: me().ff && me().ff.status === 'aprovado' });

  /* ---------------- estado de cada item ---------------- */
  function status(it) {
    const eq = equipped()[it.kind];
    const now = Date.now();
    if (it.kind === 'bundle' && it.owned) return { k: 'own', t: 'Possui' };
    if (it.owned && it.kind === 'prioridade') return { k: 'own', t: 'Ativa' };
    if (it.owned) return eq && eq.i === it.id ? { k: 'eq', t: 'Equipado' } : { k: 'own', t: 'Possui' };
    if (it.available_until && Date.parse(it.available_until) < now) return { k: 'off', t: 'Evento acabou' };
    if (it.available_from && Date.parse(it.available_from) > now) return { k: 'off', t: 'Chega ' + U.date(it.available_from).slice(0, 5) };
    if (it.price_cents != null) return { k: 'price', t: U.cents(it.price_cents) };
    if (it.data && it.data.bundle) return { k: 'lock', t: 'Só no bundle' };
    if (it.collection_reward) return { k: 'lock', t: 'Coleção' };
    if (it.reward_level) return { k: 'lock', t: 'Nível ' + it.reward_level };
    if (it.achievement) return { k: 'lock', t: 'Conquista' };
    if (it.synergy_tier) return { k: 'lock', t: 'Sinergia' };
    return { k: 'lock', t: 'Recompensa' };
  }
  function howToGet(it) {
    if (it.data && it.data.bundle) { const b = S.byId[it.data.bundle]; return 'Vem no ' + (b ? b.name : 'bundle') + '.'; }
    if (it.collection_reward) return 'Recompensa exclusiva da coleção ' + it.collection_reward + '.';
    if (it.reward_level) return 'Sai no caminho de níveis (nível ' + it.reward_level + ').';
    if (it.achievement) return 'Sai com uma conquista de jogo.';
    if (it.synergy_tier) return 'Sai com a sinergia da sua line.';
    return 'Sai como recompensa.';
  }
  const isNew = (it) => it.created_at && Date.now() - Date.parse(it.created_at) < 21 * 864e5;

  /* ---------------- listas ---------------- */
  function listFor() {
    const items = S.data.items;
    let list;
    if (S.tab === 'loja') {
      const f = S.filter;
      list = items.filter((it) => {
        if (f === 'todos') return true;
        if (f === 'novos') return isNew(it);
        if (f === 'populares') return it.owners > 0;
        if (f === 'exclusivos') return it.rarity === 'exclusivo' || it.rarity === 'limitado';
        if (RK[f] != null) return it.rarity === f;
        return it.kind === f;
      });
      if (f === 'populares') list.sort((a, b) => b.owners - a.owners);
      else if (f === 'novos') list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      else list.sort((a, b) => (a.owned - b.owned) || (a.price_cents == null) - (b.price_cents == null) || RK[b.rarity] - RK[a.rarity] || (a.sort - b.sort));
      return list;
    }
    const cat = CATS.find((c) => c.id === S.cat) || CATS[0];
    list = items.filter((it) => (cat.kinds ? cat.kinds.includes(it.kind) : cat.rar.includes(it.rarity)) && (!S.mine || it.owned));
    const eq = equipped();
    list.sort((a, b) => ((eq[b.kind] && eq[b.kind].i === b.id) - (eq[a.kind] && eq[a.kind].i === a.id)) || (b.owned - a.owned) || RK[a.rarity] - RK[b.rarity] || a.sort - b.sort);
    return list;
  }

  /* ---------------- pedaços da tela ---------------- */
  function card(it) {
    const st = status(it);
    const pal = C().PAL;
    const vs = (it.data && it.data.variants) || [];
    return '<button type="button" class="pz-card r-' + esc(it.rarity) + (S.sel === it.id ? ' sel' : '') + (st.k === 'lock' || st.k === 'off' ? ' locked' : '') + '" data-act="pzPick" data-id="' + esc(it.id) + '" aria-label="' + esc(it.name) + '">' +
      (it.event_key ? '<span class="pz-flag evento">Evento</span>' : isNew(it) && !it.owned ? '<span class="pz-flag novo">Novo</span>' : '') +
      C().thumb(it, null, userCard(), S.byId) +
      '<span class="pz-name">' + esc(it.name) + '</span>' +
      '<span class="pz-meta">' + U.rarity(it.rarity) + (vs.length ? '<span class="pz-vars">' + [it.data.pal].concat(vs).slice(0, 4).map((v) => '<i style="background:' + (pal[v] ? pal[v].g : '#888') + '"></i>').join('') + '</span>' : '') + '</span>' +
      '<span class="pz-st ' + st.k + '">' + (st.k === 'eq' ? '✓ ' : st.k === 'lock' ? '🔒 ' : '') + esc(st.t) + '</span></button>';
  }

  function grid() {
    const list = listFor();
    const shown = list.slice(0, S.shown);
    return (list.length ? '<div class="pz-grid">' + shown.map(card).join('') + '</div>' +
      (list.length > S.shown ? '<button type="button" class="btn outline block pz-more" data-act="pzMore">' + I('down') + 'Ver mais (' + (list.length - S.shown) + ')</button>' : '')
      : '<div class="pz-empty">' + U.empty('sparkles', S.mine ? 'Nada seu nessa categoria ainda' : 'Nada aqui por enquanto', S.mine ? 'Toque em "Todos" para ver o que dá para conseguir.' : 'Novos itens chegam nos eventos.') + '</div>');
  }

  // barra de ação do item escolhido (fica colada com a prévia)
  function bar() {
    const it = S.sel && S.byId[S.sel];
    if (!it) {
      const n = Object.keys(equipped()).length;
      return '<div class="pz-bar"><div class="pz-bar-t"><b>Seu visual</b><small>' + n + ' ' + (n === 1 ? 'item equipado' : 'itens equipados') + '. Toque num item para ver aqui.</small></div>' +
        '<button type="button" class="btn ghost sm" data-act="pzSavePreset">' + I('check') + 'Salvar combinação</button></div>';
    }
    const st = status(it);
    const eq = equipped()[it.kind];
    const isEq = eq && eq.i === it.id && (eq.v || null) === (S.v || null);
    const vs = [it.data && it.data.pal].concat((it.data && it.data.variants) || []).filter(Boolean);
    const P = C().PAL;
    let main = '';
    if (it.kind === 'bundle') main = it.owned ? '<button type="button" class="btn primary sm" data-act="pzEquipBundle" data-id="' + esc(it.id) + '">' + I('check') + 'Equipar tudo</button>'
      : it.price_cents != null && st.k === 'price' ? '<button type="button" class="btn primary sm" data-act="pzBuy" data-id="' + esc(it.id) + '">' + I('bag') + 'Obter ' + U.cents(it.price_cents) + '</button>' : '<span class="chip">' + esc(st.t) + '</span>';
    else if (it.kind === 'prioridade') main = '<button type="button" class="btn primary sm" data-act="pzBuy" data-id="' + esc(it.id) + '">' + I('zap') + (it.owned ? 'Estender · ' : 'Obter · ') + U.cents(it.price_cents) + '</button>';
    else if (it.owned) main = isEq ? '<button type="button" class="btn ghost sm" data-act="pzRemove" data-v="' + esc(it.kind) + '">' + I('x') + 'Remover</button>'
      : '<button type="button" class="btn primary sm" data-act="pzEquip" data-id="' + esc(it.id) + '">' + I('check') + 'Equipar</button>';
    else if (st.k === 'price') main = '<button type="button" class="btn primary sm" data-act="pzBuy" data-id="' + esc(it.id) + '">' + I('bag') + 'Obter ' + U.cents(it.price_cents) + '</button>';
    else if (it.data && it.data.bundle && S.byId[it.data.bundle]) main = '<button type="button" class="btn outline sm" data-act="pzPick" data-id="' + esc(it.data.bundle) + '">' + I('gift') + 'Ver bundle</button>';
    else main = '<span class="chip">' + I('lock') + esc(st.t) + '</span>';
    return '<div class="pz-bar sel"><div class="pz-bar-t"><b>' + esc(it.name) + '</b><small>' + U.rarity(it.rarity) + ' ' + esc(KIND_NAME[it.kind] || '') + (it.owners ? ' · ' + U.int(it.owners) + ' ' + (it.owners === 1 ? 'jogador tem' : 'jogadores têm') : '') + '</small></div>' +
      '<div class="pz-bar-a">' + main + '<button type="button" class="icon-btn" data-act="pzInfo" aria-label="Detalhes">' + I('info') + '</button></div>' +
      (vs.length > 1 ? '<div class="pz-swatches" role="radiogroup" aria-label="Cores">' + vs.map((v) => '<button type="button" role="radio" aria-checked="' + ((S.v || it.data.pal) === v) + '" class="' + ((S.v || it.data.pal) === v ? 'on' : '') + '" style="--a:' + P[v].a + ';--b:' + P[v].g + '" data-act="pzVar" data-v="' + esc(v) + '" title="' + esc(P[v].name) + '"></button>').join('') + '</div>' : '') + '</div>';
  }

  function stageHtml() {
    const look = resolved(S.draft), u = userCard();
    // placa: mostra como os outros veem numa lista (viva)
    const pl = look.placa ? '<div class="pz-plmock has-pl">' + U.plate(Object.assign({}, u, { plate: look.placa.data, plate_v: look.placa.v }), true) + U.av(u, 'sm') + '<b>' + esc(u.nick || 'Você') + '</b><small>Nível ' + (me().level || 1) + '</small></div>' : '';
    return C().stage(u, look, { size: 'sm', play: S.play, id: 'pz-stage',
      edit: '<div class="cz-edit"><button type="button" class="icon-btn" data-act="pzReset" aria-label="Voltar ao visual equipado">' + I('refresh') + '</button></div>' }) + pl;
  }
  function sticky() {
    return (S.mini ? '' : stageHtml()) + bar().replace('<div class="pz-bar', '<button type="button" class="pz-mini" data-act="pzMini" aria-label="' + (S.mini ? 'Mostrar prévia' : 'Esconder prévia') + '">' + (S.mini ? '▾' : '▴') + '</button><div class="pz-bar');
  }

  function tabBody() {
    if (S.tab === 'colecoes') return collections();
    if (S.tab === 'combos') return combos();
    if (S.tab === 'loja' && S.col) { const c = COLS.find((x) => x.id === S.col); if (c) return shopCol(c); }
    if (S.tab === 'loja') return (S.filter === 'todos' ? shopHome() : '') + events() + (S.filter === 'todos' ? '<h3 class="sub-h lj-all">Tudo na loja</h3>' : '') + '<div class="pz-filters" role="tablist" aria-label="Filtros da loja">' + FILTERS.map((f) => '<button type="button" role="tab" aria-selected="' + (S.filter === f[0]) + '" class="' + (S.filter === f[0] ? 'on' : '') + '" data-act="pzFilter" data-v="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>' +
      '<div id="pz-grid">' + grid() + '</div>';
    const counts = {};
    CATS.forEach((c) => { counts[c.id] = S.data.items.filter((it) => it.owned && (c.kinds ? c.kinds.includes(it.kind) : c.rar.includes(it.rarity))).length; });
    return '<div class="pz-cats" role="tablist" aria-label="Categorias">' + CATS.map((c) => '<button type="button" role="tab" aria-selected="' + (S.cat === c.id) + '" class="' + (S.cat === c.id ? 'on' : '') + '" data-act="pzCat" data-v="' + c.id + '"><span>' + c.e + '</span>' + c.label + (counts[c.id] ? '<small>' + counts[c.id] + '</small>' : '') + '</button>').join('') + '</div>' +
      '<div class="pz-filters"><button type="button" class="' + (S.mine ? '' : 'on') + '" data-act="pzMine" data-v="0">Todos</button><button type="button" class="' + (S.mine ? 'on' : '') + '" data-act="pzMine" data-v="1">Só os meus</button></div>' +
      '<div id="pz-grid">' + grid() + '</div>';
  }

  /* ---------------- Loja no formato da Loja do Discord ----------------
     Coleções com banner ilustrado e uma fileira de itens embaixo; tocar abre a folha com prévia grande. */
  const COLS = [
    { id: 'orelhas', title: 'Todas as Orelhas', sub: 'Orelhas, caudas e pelagens', scene: 'kitsune', pal: 'azul-ciano', items: ['bundle-pac-guaxinim', 'bundle-pac-leopardo', 'bundle-pac-lobo-lunar', 'mold-dc-raposa', 'mold-dc-tigre', 'mold-dc-panda-vermelho', 'mold-dc-gato', 'mold-dc-kitsune', 'placa-olho-lobo', 'placa-guaxinim', 'placa-leopardo', 'perfil-guaxinim'] },
    { id: 'outono', title: 'Folhas de Outono', sub: 'Bordo, cerejeira e chuva', scene: 'amanhecer', pal: 'laranja', items: ['bundle-pac-bordo', 'bundle-pac-sakura', 'mold-dc-bordo', 'mold-dc-sakura', 'mold-dc-chapeu-palha', 'placa-bordo', 'placa-sakura', 'perfil-bordo', 'perfil-sakura'] },
    { id: 'lendas', title: 'Lendas do Oriente', sub: 'Dragões, katanas e espíritos', scene: 'dragao', pal: 'vermelho', items: ['bundle-pac-dragao', 'mold-dc-dragao', 'mold-dc-dragao-neon', 'mold-dc-katana', 'placa-dragao', 'perfil-dragao', 'capa2-dragao', 'capa2-samurai', 'capa2-kitsune'] },
    { id: 'ceu', title: 'Céu e Abismo', sub: 'Anjos, demônios e coroas', scene: 'realeza', pal: 'royal', items: ['mold-dc-anjo-caido', 'mold-dc-anjo', 'mold-dc-demonio', 'mold-dc-coroa', 'perfil-dourado', 'placa-ouro', 'capa2-realeza', 'capa2-fenix'] },
    { id: 'neon', title: 'Dimensão Neon', sub: 'Portais, HUD e luz', scene: 'grade', pal: 'cyberpunk', items: ['bundle-pac-yoru', 'bundle-pac-neon', 'mold-dc-portal', 'mold-dc-cyber', 'mold-dc-holo', 'mold-dc-fones', 'mold-dc-raio', 'placa-synth', 'placa-cidade', 'perfil-neon'] },
    { id: 'elementos', title: 'Elementos', sub: 'Fogo, gelo e tempestade', scene: 'chamas', pal: 'fogo', items: ['mold-dc-chamas', 'mold-dc-gelo', 'mold-dc-orbita', 'mold-dc-coracoes', 'perfil-chamas', 'perfil-gelo', 'placa-chamas', 'placa-raios', 'placa-cristais', 'placa-galaxia'] }
  ];
  function colBanner(c) {
    return '<button type="button" class="lj-col ripple" data-act="pzCol" data-v="' + c.id + '"><span class="lj-col-art">' + C().draw('banner', { art: c.scene, pal: c.pal }, null, { still: true }) + '</span>' +
      '<span class="lj-col-t"><b>' + esc(c.title) + '</b><small>' + esc(c.sub) + '</small></span><span class="lj-col-go">' + I('right') + '</span></button>';
  }
  function shopCard(it) {
    const st = status(it);
    return '<button type="button" class="lj-card r-' + esc(it.rarity) + '" data-act="pzShop" data-id="' + esc(it.id) + '" aria-label="' + esc(it.name) + '">' +
      (it.kind === 'bundle' ? '<span class="lj-tag">' + ((it.data.items || []).length) + ' itens</span>' : isNew(it) && !it.owned ? '<span class="lj-tag novo">Novo</span>' : '') +
      // pacote: mostra a peça principal grande (como a loja do Discord), não uma colagem
      '<span class="lj-pv">' + C().thumb(it.kind === 'bundle' && S.byId[(it.data.items || [])[0]] ? S.byId[it.data.items[0]] : it, null, { id: 'loja', nick: me().nick }, S.byId) + '</span><b>' + esc(it.name) + '</b>' +
      '<small class="' + st.k + '">' + (st.k === 'eq' ? '✓ ' : '') + esc(st.t) + '</small></button>';
  }
  function shopHome() {
    return COLS.map((c) => { const its = c.items.map((id) => S.byId[id]).filter(Boolean); if (!its.length) return ''; return '<section class="lj-sec">' + colBanner(c) + '<div class="lj-row">' + its.map(shopCard).join('') + '</div></section>'; }).join('');
  }
  function shopCol(c) {
    const its = c.items.map((id) => S.byId[id]).filter(Boolean);
    return '<button type="button" class="link lj-back" data-act="pzCol" data-v="">' + I('back') + 'Loja</button>' + colBanner(c).replace('data-act="pzCol"', 'data-act="noop"') + '<div class="lj-grid">' + its.map(shopCard).join('') + '</div>';
  }

  /* folha do item: prévia grande (decoração no avatar, placa numa lista, moldura no cartão; pacote passa as peças) */
  function bigPreview(it, v) {
    const u = Object.assign({}, userCard(), { id: 'pv' });
    const d = it.data || {};
    if (it.kind === 'moldura') return '<div class="sp-av">' + U.av(Object.assign({}, u, { frame: d, frame_v: v }), 'xl') + '</div>';
    if (it.kind === 'placa') {
      const row = (x, pl) => '<li class="sp-row' + (pl ? ' has-pl' : '') + '">' + (pl ? U.plate(Object.assign({}, x, { plate: d, plate_v: v }), true) : '') + U.av(x, 'sm') + '<b>' + esc(x.nick) + '</b></li>';
      return '<div class="sp-list"><small>Online — 3</small><ul>' + row({ id: 'a', nick: 'Phibi' }) + row(u, true) + row({ id: 'c', nick: 'Locke' }) + '</ul></div>';
    }
    if (it.kind === 'perfil') return '<div class="sp-card">' + C().stage(u, { perfil: { data: d, v }, banner: equipped().banner ? resolved({ banner: equipped().banner }).banner : { data: { art: 'ouro', pal: 'dourado' } } }, { size: 'sm' }) + '</div>';
    if (it.kind === 'banner' || it.kind === 'capa' || it.kind === 'efeito' || it.kind === 'tema' || it.kind === 'fundo') { const look = {}; look[it.kind] = { data: d, v }; return '<div class="sp-card">' + C().stage(u, look, { size: 'sm', play: true }) + '</div>'; }
    return '<div class="sp-thumb">' + C().thumb(it, v, u, S.byId) + '</div>';
  }
  actions.pzCol = (el) => { S.col = el.dataset.v || null; paintBody(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  actions.pzShop = (el) => {
    const it = S.byId[el.dataset.id]; if (!it) return;
    const parts = it.kind === 'bundle' ? (it.data.items || []).map((id) => S.byId[id]).filter(Boolean) : [];
    const data = { part: 0, v: null };
    U.sheet({
      title: it.kind === 'bundle' ? 'Pacote' : KIND_NAME[it.kind] || 'Item', size: 'lg', loading: false, data,
      body: (sh) => {
        const cur = parts.length ? parts[sh.data.part] : it;
        const vs = [cur.data && cur.data.pal].concat((cur.data && cur.data.variants) || []).filter(Boolean);
        const st = status(it);
        const buy = it.owned ? (it.kind === 'bundle' ? '<button type="button" class="btn primary block" data-act="pzEquipBundle" data-id="' + esc(it.id) + '">' + I('check') + 'Equipar tudo</button>'
            : '<button type="button" class="btn primary block" data-act="pzShopEquip" data-id="' + esc(it.id) + '">' + I('check') + 'Equipar</button>')
          : st.k === 'price' ? '<button type="button" class="btn primary block" data-act="pzBuy" data-id="' + esc(it.id) + '">' + I('bag') + (it.kind === 'bundle' ? 'Comprar pacote' : 'Comprar') + ' · ' + U.cents(it.price_cents) + '</button>'
            : '<p class="note-gold">' + I('lock') + '<span>' + esc(st.t) + '. ' + esc(howToGet(it)) + '</span></p>';
        return '<div class="sp">' +
          '<div class="sp-stage">' + bigPreview(cur, sh.data.v) + '<button type="button" class="icon-btn sp-eye" data-act="pzTry" data-id="' + esc(cur.id) + '" aria-label="Ver no meu perfil">' + I('eye') + '</button></div>' +
          '<h2 class="sp-name">' + esc(it.name) + '</h2>' +
          (parts.length ? '<p class="muted small">O pacote inclui ' + parts.length + ' itens</p><div class="sp-parts">' + parts.map((p, i) => '<button type="button" class="' + (i === sh.data.part ? 'on' : '') + '" data-act="pzPart" data-i="' + i + '" aria-label="' + esc(p.name) + '">' + C().thumb(p, null, userCard(), S.byId) + '</button>').join('') + '</div>' +
            '<p class="sp-cap"><b>' + esc(cur.name) + '</b> · ' + esc(KIND_NAME[cur.kind] || '') + '</p>' : '<p class="muted">' + esc(it.description || '') + '</p>') +
          (vs.length > 1 ? '<div class="sp-opts"><b>Cor</b> ' + esc(C().PAL[sh.data.v || vs[0]].name) + '<div class="pz-swatches">' + vs.map((x) => '<button type="button" class="' + ((sh.data.v || vs[0]) === x ? 'on' : '') + '" style="--a:' + C().PAL[x].a + ';--b:' + C().PAL[x].g + '" data-act="pzSpVar" data-v="' + x + '" aria-label="' + esc(C().PAL[x].name) + '"></button>').join('') + '</div></div>' : '') +
          buy + '<p class="muted small center">' + U.rarity(it.rarity) + (it.owners ? ' · ' + U.int(it.owners) + ' ' + (it.owners === 1 ? 'jogador tem' : 'jogadores têm') : '') + '</p></div>';
      },
      onMount: (sh) => {
        C().mount(sh.body);
        // pacote: passa sozinho de uma peça para a outra, como na loja do Discord
        clearInterval(sh._cyc);
        if (parts.length > 1) sh._cyc = setInterval(() => { if (sh.closed || !document.body.contains(sh.el)) return clearInterval(sh._cyc); if (sh._hold && Date.now() - sh._hold < 6000) return; sh.data.part = (sh.data.part + 1) % parts.length; sh.data.v = null; sh.render('static'); }, 3200);
      }
    });
  };
  actions.pzPart = (el) => { const sh = U.topSheet(); if (!sh) return; sh.data.part = Number(el.dataset.i); sh.data.v = null; sh._hold = Date.now(); sh.render('static'); };
  actions.pzSpVar = (el) => { const sh = U.topSheet(); if (!sh) return; sh.data.v = el.dataset.v; sh._hold = Date.now(); sh.render('static'); };
  // olho: veste o item na vitrine lá em cima (prévia no seu perfil)
  actions.pzTry = (el) => { const sh = U.topSheet(); const v = sh && sh.data.v; if (sh) sh.close && sh.close(); pick(el.dataset.id); if (v) { const it = S.byId[el.dataset.id]; if (it && S.draft[it.kind]) { S.v = v; S.draft[it.kind].v = v; paintSticky(); } } window.scrollTo({ top: 0, behavior: 'smooth' }); };
  actions.pzShopEquip = async (el) => { const it = S.byId[el.dataset.id]; const sh = U.topSheet(); const v = sh && sh.data.v; if (await U.run(el, () => api.rpc('set_look', { p: { [it.kind]: { i: it.id, v: v || null } } }), 'Equipado.')) { await reload(); if (sh && sh.close) sh.close(); } };

  function events() {
    const now = Date.now();
    const act = (S.data.events || []).filter((e) => e.active);
    const next = (S.data.events || []).filter((e) => Date.parse(e.starts_at) > now).slice(0, 2);
    return act.map((e) => '<div class="pz-ev" style="--ec:' + esc(e.color) + '"><span class="pz-ev-ic">' + esc(e.icon) + '</span><div><b>' + esc(e.name) + '</b><small>' + esc(e.description) + ' Até ' + U.date(e.ends_at).slice(0, 5) + '.</small></div>' +
      '<button type="button" class="btn ghost sm" data-act="pzEvent" data-v="' + esc(e.key) + '">Ver</button></div>').join('') +
      (next.length ? '<p class="muted small">Próximos eventos: ' + next.map((e) => esc(e.icon + ' ' + e.name) + ' (' + U.date(e.starts_at).slice(0, 5) + ')').join(' · ') + '</p>' : '');
  }

  function collections() {
    const cols = S.data.collections || [];
    if (!cols.length) return U.empty('gift', 'Nenhuma coleção ainda', '');
    return '<p class="muted small">Junte todos os itens de uma coleção e resgate um item exclusivo, que não se compra.</p><div class="stack">' + cols.map((c) => {
      const rw = S.byId[c.reward];
      const done = c.owned >= c.total;
      return '<section class="pz-col' + (c.claimed ? ' done' : '') + '"><header><span class="pz-col-ic">' + esc(c.icon) + '</span><div class="grow"><b>' + esc(c.name) + '</b><small class="muted"> ' + c.owned + '/' + c.total + '</small><p class="muted small">' + esc(c.description) + '</p></div></header>' +
        U.bar(c.total ? c.owned / c.total : 0) +
        '<div class="pz-row">' + c.items.map((id) => { const it = S.byId[id]; return it ? '<button type="button" class="' + (it.owned ? '' : 'miss') + '" data-act="pzPickTab" data-id="' + esc(id) + '" aria-label="' + esc(it.name) + '">' + C().thumb(it, null, userCard(), S.byId).replace('class="th ', 'class="th ' + (it.owned ? '' : 'miss ')) + '</button>' : ''; }).join('') + '</div>' +
        (rw ? '<div class="pz-preset"><span class="pz-pv">' + C().thumb(rw, null, userCard(), S.byId) + '</span><b>' + esc(rw.name) + '<br><small class="muted">' + U.rarity(rw.rarity) + ' Recompensa</small></b>' +
          (c.claimed ? '<span class="chip tone-green">' + I('check') + 'Resgatada</span>' : done ? '<button type="button" class="btn primary sm" data-act="pzClaim" data-id="' + esc(c.id) + '">' + I('gift') + 'Resgatar</button>' : '<span class="chip">' + I('lock') + 'Faltam ' + (c.total - c.owned) + '</span>') + '</div>' : '') +
        '</section>';
    }).join('') + '</div>';
  }

  function combos() {
    const ps = S.data.presets || [];
    const slots = (look) => LOOK.filter((k) => look && look[k]).map((k) => S.byId[look[k].i]).filter(Boolean);
    return '<p class="muted small">Salve até 12 combinações e troque o visual inteiro com um toque. Itens que você não tiver mais são pulados.</p>' +
      '<button type="button" class="btn primary block" data-act="pzSavePreset">' + I('plus') + 'Salvar o visual atual</button><div class="pz-presets" style="margin-top:10px">' +
      (ps.length ? ps.map((p) => { const its = slots(p.look); return '<div class="pz-preset"><div class="grow"><b>' + esc(p.name) + '</b><div class="pz-slots">' + its.slice(0, 8).map((it) => '<span class="pz-slot on">' + C().thumb(it, p.look[it.kind] && p.look[it.kind].v, userCard(), S.byId) + '</span>').join('') + '</div></div>' +
        '<div class="stack"><button type="button" class="btn primary sm" data-act="pzApplyPreset" data-id="' + esc(p.id) + '">Aplicar</button><button type="button" class="btn ghost sm" data-act="pzPreviewPreset" data-id="' + esc(p.id) + '">Prévia</button><button type="button" class="icon-btn" data-act="pzDelPreset" data-id="' + esc(p.id) + '" aria-label="Apagar">' + I('trash') + '</button></div></div>'; }).join('')
        : U.empty('palette', 'Nenhuma combinação salva', 'Monte o visual e toque em Salvar.')) + '</div>';
  }

  function whole() {
    return '<section class="page pz-page">' + BH.backRow() +
      '<div class="pz-top"><h1 class="h1">Personalização</h1><button type="button" class="pz-bal" data-act="wallet">' + I('wallet') + U.cents(S.data.balance_cents) + '</button></div>' +
      '<div class="pz-sticky" id="pz-sticky">' + sticky() + '</div>' +
      '<div class="pz-tabs" role="tablist">' + [['visual', 'Visual'], ['loja', 'Loja'], ['colecoes', 'Coleções'], ['combos', 'Combinações']].map((t) => '<button type="button" role="tab" aria-selected="' + (S.tab === t[0]) + '" class="' + (S.tab === t[0] ? 'on' : '') + '" data-act="pzTab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div id="pz-body">' + tabBody() + '</div></section>';
  }

  /* ---------------- atualizações parciais (sem recarregar a página inteira) ---------------- */
  function paintSticky() { const el = document.getElementById('pz-sticky'); if (el) { el.innerHTML = sticky(); C().mount(el); } S.play = false; }
  function paintBody() { const el = document.getElementById('pz-body'); if (el) { el.innerHTML = tabBody(); U.enhance && U.enhance(el, 'static'); } }
  function paintTabs() { document.querySelectorAll('.pz-tabs button').forEach((b) => { const on = b.dataset.v === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); }
  function paintCards() { document.querySelectorAll('.pz-card').forEach((c) => c.classList.toggle('sel', c.dataset.id === S.sel)); }
  function paintBal() { const b = document.querySelector('.pz-bal'); if (b) b.innerHTML = I('wallet') + U.cents(S.data.balance_cents); }
  async function reload(keepDraft) { await load(); if (!keepDraft) resetDraft(); paintSticky(); paintBody(); paintBal(); await api.refreshMe().catch(() => {}); app().header(); }

  pages.personalizacao = async function (p) {
    await load();
    if (p && p.tab) S.tab = p.tab;
    S.mini = S.tab === 'loja';
    if (p && p.cat) { S.cat = p.cat; S.tab = 'visual'; }
    resetDraft();
    S.sel = null; S.v = null; S.shown = PAGE;
    return { html: whole(), onMount: (v) => C().mount(v) };
  };

  /* ---------------- ações ---------------- */
  actions.pzTab = (el) => { S.tab = el.dataset.v; S.col = null; S.shown = PAGE; const m = S.tab === 'loja'; if (m !== S.mini && !S.sel) { S.mini = m; paintSticky(); } paintTabs(); paintBody(); };
  actions.pzCat = (el) => { S.cat = el.dataset.v; S.shown = PAGE; paintBody(); const b = document.querySelector('.pz-cats .on'); if (b) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); };
  actions.pzFilter = (el) => { S.filter = el.dataset.v; S.shown = PAGE; paintBody(); };
  actions.pzMine = (el) => { S.mine = el.dataset.v === '1'; S.shown = PAGE; paintBody(); };
  actions.pzMore = () => { S.shown += PAGE; const g = document.getElementById('pz-grid'); if (g) g.innerHTML = grid(); };
  actions.pzMini = () => { S.mini = !S.mini; paintSticky(); };
  actions.pzReset = () => { resetDraft(); S.sel = null; S.v = null; paintSticky(); paintCards(); };
  actions.pzEvent = (el) => { S.tab = 'loja'; S.filter = 'exclusivos'; paintTabs(); paintBody(); U.toast('Itens de evento ficam em Exclusivos.', 'info'); void el; };

  // tocar num item: mostra na prévia (bundle veste todas as partes)
  function pick(id) {
    const it = S.byId[id];
    if (!it) return;
    S.sel = id;
    const eq = equipped()[it.kind];
    S.v = eq && eq.i === id ? eq.v || null : null;
    if (it.kind === 'bundle') (it.data.items || []).forEach((pid) => { const p = S.byId[pid]; if (p && LOOK.includes(p.kind)) S.draft[p.kind] = { i: pid, v: it.data.variant || null }; });
    else if (LOOK.includes(it.kind)) S.draft[it.kind] = { i: id, v: S.v };
    S.play = it.kind === 'efeito' || it.kind === 'entrada' || it.kind === 'bundle';
    if (S.mini && it.kind !== 'prioridade') S.mini = false;
    paintSticky(); paintCards();
  }
  actions.pzPick = (el) => pick(el.dataset.id);
  actions.pzPickTab = (el) => { S.tab = 'visual'; const it = S.byId[el.dataset.id]; const cat = it && CATS.find((c) => c.kinds && c.kinds.includes(it.kind)); if (cat) S.cat = cat.id; S.mine = false; paintTabs(); paintBody(); pick(el.dataset.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  actions.pzVar = (el) => {
    const it = S.byId[S.sel]; if (!it) return;
    S.v = el.dataset.v === it.data.pal ? null : el.dataset.v;
    if (it.kind === 'bundle') (it.data.items || []).forEach((pid) => { const p = S.byId[pid]; if (p && S.draft[p.kind] && S.draft[p.kind].i === pid) S.draft[p.kind].v = S.v; });
    else S.draft[it.kind] = { i: it.id, v: S.v };
    paintSticky();
  };
  actions.pzInfo = () => {
    const it = S.byId[S.sel]; if (!it) return;
    const parts = it.kind === 'bundle' ? (it.data.items || []).map((id) => S.byId[id]).filter(Boolean) : [];
    U.sheet({ title: it.name, loading: false, body: '<div class="pz-detail"><div class="grid2 sel">' + C().thumb(it, S.v, userCard(), S.byId) + '<div class="stack"><div>' + U.rarity(it.rarity) + '</div><p>' + esc(it.description) + '</p><small class="muted">' + esc(KIND_NAME[it.kind] || '') +
      (it.event_key ? ' · evento até ' + U.date(it.available_until).slice(0, 5) : '') + '</small></div></div>' +
      (it.owned || it.price_cents != null ? '' : '<p class="note-gold">' + I('info') + '<span>' + esc(howToGet(it)) + '</span></p>') +
      (parts.length ? '<h4 class="sub-h">No bundle (' + parts.length + ' peças)</h4><p class="muted small">Depois de obter, você pode equipar tudo ou só as partes que quiser.</p><div class="pz-parts">' +
        parts.map((p) => { const on = equipped()[p.kind] && equipped()[p.kind].i === p.id; return '<button type="button" class="' + (on ? 'on' : '') + '" data-act="' + (it.owned ? 'pzTogglePart' : 'pzPick') + '" data-id="' + esc(p.id) + '">' + (on ? '✓ ' : '') + esc(KIND_NAME[p.kind]) + '</button>'; }).join('') + '</div>' : '') + '</div>' });
  };
  actions.pzTogglePart = async (el) => {
    const it = S.byId[el.dataset.id]; if (!it) return;
    const on = equipped()[it.kind] && equipped()[it.kind].i === it.id;
    if (await U.run(el, () => api.rpc('set_look', { p: { [it.kind]: on ? null : { i: it.id } } }))) { await reload(); const s = U.topSheet(); if (s) s.render('static'); }
  };

  actions.pzEquip = async (el) => {
    const it = S.byId[el.dataset.id]; if (!it) return;
    if (await U.run(el, () => api.rpc('set_look', { p: { [it.kind]: { i: it.id, v: S.v } } }), 'Equipado.')) { await reload(true); S.draft[it.kind] = { i: it.id, v: S.v }; paintSticky(); paintCards(); }
  };
  actions.pzRemove = async (el) => {
    const k = el.dataset.v;
    if (await U.run(el, () => api.rpc('set_look', { p: { [k]: null } }), 'Removido.')) { await reload(true); delete S.draft[k]; if (k === 'banner' && equipped().banner) S.draft.banner = equipped().banner; paintSticky(); }
  };
  actions.pzEquipBundle = async (el) => {
    if (await U.run(el, () => api.rpc('equip_bundle', { p_bundle: el.dataset.id }), 'Bundle equipado.')) { S.play = true; await reload(); }
  };
  actions.pzBuy = async (el) => {
    const it = S.byId[el.dataset.id]; if (!it) return;
    const price = it.price_cents, bal = S.data.balance_cents;
    if (bal < price) {
      if (await U.confirm({ title: 'Saldo insuficiente', body: 'Faltam ' + U.cents(price - bal) + ' para obter ' + esc(it.name) + '.', ok: 'Adicionar saldo', icon: 'wallet' })) BH.flows.deposit(Math.max(me().settings.min_deposit_cents, price - bal));
      return;
    }
    const body = it.kind === 'bundle' ? 'Você recebe as ' + (it.data.items || []).length + ' peças e o visual é equipado.' : it.kind === 'prioridade' ? 'O valor sai do seu saldo.' : 'O valor sai do seu saldo e o item já é equipado.';
    if (!(await U.confirm({ title: 'Obter ' + it.name + ' por ' + U.cents(price) + '?', body, ok: 'Obter', icon: 'bag' }))) return;
    const ok = await U.run(el, async () => {
      await api.rpc('buy_item', { p_item: it.id });
      if (it.kind === 'bundle') await api.rpc('equip_bundle', { p_bundle: it.id });
      else if (LOOK.includes(it.kind)) await api.rpc('set_look', { p: { [it.kind]: { i: it.id, v: S.v } } });
    }, it.kind === 'prioridade' ? 'Fila prioritária ativa.' : 'É seu! Já está equipado.');
    if (ok) { U.confetti(); S.play = it.kind === 'efeito' || it.kind === 'entrada' || it.kind === 'bundle'; await reload(); }
  };
  actions.pzClaim = async (el) => {
    if (await U.run(el, () => api.rpc('claim_collection', { p_id: el.dataset.id }), 'Recompensa resgatada!')) { U.confetti(); await reload(); }
  };
  actions.pzSavePreset = async () => {
    const name = await U.confirm({ title: 'Salvar combinação', body: 'Guarda o visual que está na prévia (só os itens que você já tem).', ok: 'Salvar', icon: 'palette',
      input: { label: 'Nome', placeholder: 'Ex.: Modo ninja', required: true, error: 'Dê um nome.' } });
    if (!name) return;
    const look = {};
    Object.keys(S.draft).forEach((k) => { const e = S.draft[k], it = e && S.byId[e.i]; if (it && it.owned) look[k] = { i: it.id, v: e.v || undefined }; });
    if (await U.run(null, () => api.rpc('save_look_preset', { p_name: String(name).trim(), p_look: look }), 'Combinação salva.')) { await reload(true); if (S.tab === 'combos') paintBody(); }
  };
  actions.pzApplyPreset = async (el) => {
    if (await U.run(el, () => api.rpc('apply_look_preset', { p_id: el.dataset.id }), 'Visual trocado.')) { S.play = true; S.sel = null; await reload(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  actions.pzPreviewPreset = (el) => {
    const p = (S.data.presets || []).find((x) => x.id === el.dataset.id); if (!p) return;
    S.draft = JSON.parse(JSON.stringify(p.look || {})); S.sel = null; S.play = true; S.mini = false; paintSticky(); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  actions.pzDelPreset = async (el) => {
    if (!(await U.confirm({ title: 'Apagar combinação?', ok: 'Apagar', danger: true }))) return;
    if (await U.run(el, () => api.rpc('delete_look_preset', { p_id: el.dataset.id }))) { await reload(true); paintBody(); }
  };
  // ✦ na vitrine: repete o efeito de abertura
  actions.czReplay = (el) => {
    const st = el.closest('.cz-stage');
    const look = st && st.id === 'pz-stage' ? resolved(S.draft) : (BH.state.czLook || {});
    C().replay(st, look.efeito, me().id);
  };
})();
