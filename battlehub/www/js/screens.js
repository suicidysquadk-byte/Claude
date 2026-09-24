/* Telas do jogador */
window.BH = window.BH || {};
(function () {
  const S = BH.store, U = BH.ui, I = BH.icon, A = BH.act;
  const esc = U.esc;
  const st = BH.state = Object.assign({
    tFilter: 'todos', tSearch: '', rankTab: 'elo', gSearch: '', gFilter: 'todas', chatSearch: '', lookTab: 'avatar', walletTab: 'tudo'
  }, BH.state || {});
  const pages = BH.pages = BH.pages || {};
  const actions = BH.actions = BH.actions || {};
  const forms = BH.forms = BH.forms || {};
  const flows = BH.flows = BH.flows || {};
  const app = () => BH.app;

  const TX = {
    deposito: { name: 'Depósito', icon: 'arrowIn', sign: 1 },
    saque: { name: 'Saque', icon: 'arrowOut', sign: -1 },
    inscricao: { name: 'Inscrição', icon: 'gamepad', sign: -1 },
    premio: { name: 'Prêmio', icon: 'trophy', sign: 1 },
    reembolso: { name: 'Reembolso', icon: 'refresh', sign: 1 },
    ajuste: { name: 'Ajuste', icon: 'sliders', sign: 1 },
    taxa: { name: 'Taxa', icon: 'percent', sign: 1 }
  };
  const txSign = (x) => (x.type === 'ajuste' ? (x.sign || 1) : TX[x.type].sign);
  const statusChip = (s) => s === 'pendente' ? '<span class="chip tone-gold">Em análise</span>' : s === 'recusado' ? '<span class="chip tone-red">Recusado</span>' : '<span class="chip tone-green">' + I('check') + 'Confirmado</span>';
  BH.txRow = function (x, showUser) {
    const t = TX[x.type] || TX.ajuste, sign = txSign(x), u = showUser ? S.user(x.userId) : null;
    return '<li class="tx-row">' +
      '<span class="tx-ic ' + (sign > 0 ? 'tone-green' : 'tone-red') + '">' + I(t.icon) + '</span>' +
      '<div class="tx-main"><b>' + (u ? esc(u.nick) : esc(x.note || t.name)) + '</b><small>' + (u ? esc(t.name) + ' · ' : '') + U.date(x.at) + (x.reason ? ' · ' + esc(x.reason) : '') + '</small></div>' +
      '<div class="tx-side"><b class="' + (x.status === 'recusado' ? 'strike' : sign > 0 ? 'pos' : 'neg') + '">' + (sign > 0 ? '+' : '−') + U.money(x.amount) + '</b>' + statusChip(x.status) + '</div></li>';
  };

  const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
  const open = (list) => list.filter((t) => t.status === 'aberto' || t.status === 'ao_vivo');
  const orgName = (t) => { const o = S.user(t.organizer); return o ? esc(o.nick) + U.verified(o) : 'BattleHub'; };
  const spots = (t) => t.max - S.count(t);

  function prizeCard(t) {
    const full = S.prizeTable(t, true), now = S.prizeTable(t, false);
    return '<article class="prize-card ripple" data-act="openT" data-id="' + t.id + '" tabindex="0">' +
      '<header>' + U.typeTag(t.type) + (t.status === 'ao_vivo' ? U.status(t) : '<span class="muted small">' + esc(t.mode) + '</span>') + '</header>' +
      '<h4>' + esc(t.name) + '</h4>' +
      '<dl class="kv"><div><dt>Inscrição</dt><dd>' + (t.entry ? U.money(t.entry) : 'Grátis') + '</dd></div><div><dt>Jogadores</dt><dd class="violet">' + I('users') + S.count(t) + '/' + t.max + '</dd></div></dl>' +
      '<div class="pot"><small>Potencial de ganho</small><strong>' + U.money(full.total) + '</strong><span>Hoje: ' + U.money(now.total) + '</span></div>' +
      '</article>';
  }
  function tItem(t) {
    const type = S.TYPES[t.type] || S.TYPES.rapido;
    return '<article class="t-item ripple" data-act="openT" data-id="' + t.id + '" tabindex="0">' +
      '<span class="t-ic tone-' + type.tone + '">' + I(type.icon) + '</span>' +
      '<div class="t-main"><div class="t-tags">' + U.status(t) + U.typeTag(t.type) + (t.featured ? '<span class="tag tone-gold">' + I('star') + 'Destaque</span>' : '') + '</div>' +
      '<h4>' + esc(t.name) + '</h4><p class="t-by">por ' + orgName(t) + ' · ' + esc(t.mode) + ' · ' + esc(t.map) + '</p>' +
      '<div class="t-meta"><span class="' + (spots(t) <= 0 ? 'red' : '') + '">' + I('users') + S.count(t) + '/' + t.max + '</span>' +
      '<span>' + I('clock') + (t.status === 'aberto' && t.startsAt > Date.now() ? U.when(t.startsAt) : t.status === 'ao_vivo' ? 'Em andamento' : U.date(t.startsAt)) + '</span>' +
      '<span class="gold">' + I('coins') + (t.entry ? U.money(t.entry) : 'Grátis') + '</span></div></div>' +
      '<span class="chev">' + I('right') + '</span></article>';
  }
  BH.tItem = tItem;

  /* ================= INÍCIO ================= */
  pages.home = function () {
    const m = S.me(), db = S.db;
    const tier = S.tierOf(m.elo);
    const pin = db.announcements.find((a) => a.pinned);
    const all = open(db.tournaments);
    const mine = all.filter((t) => t.participants.includes(m.id)).sort((a, b) => a.startsAt - b.startsAt);
    const hero = mine[0] || all.filter((t) => t.status === 'aberto' && t.featured).sort((a, b) => a.startsAt - b.startsAt)[0] || all.sort((a, b) => a.startsAt - b.startsAt)[0];
    const live = db.tournaments.filter((t) => t.status === 'ao_vivo').length;
    const inscritos = all.reduce((s, t) => s + S.count(t), 0);
    const premios = all.reduce((s, t) => s + S.prizeTable(t, false).total, 0);
    const best = all.filter((t) => t.status === 'aberto').sort((a, b) => S.prizeTable(b, true).total - S.prizeTable(a, true).total).slice(0, 6);
    const soon = all.filter((t) => t.status === 'aberto' && spots(t) > 0 && t.startsAt > Date.now()).sort((a, b) => a.startsAt - b.startsAt).slice(0, 4);
    const top = S.rankingList('semanal').slice(0, 5);
    const guilds = db.guilds.filter((g) => g.recruiting).slice(0, 2);

    let heroHtml = '';
    if (hero) {
      const p = S.prizeTable(hero, false), inT = hero.participants.includes(m.id);
      heroHtml = '<article class="hero-card ripple" data-act="openT" data-id="' + hero.id + '" tabindex="0">' +
        '<span class="hero-shine" aria-hidden="true"></span>' +
        '<header>' + U.typeTag(hero.type) + (hero.status === 'ao_vivo' ? U.status(hero) : inT ? '<span class="tag tone-green">' + I('checkCircle') + 'Você está inscrito</span>' : '<span class="tag tone-gold">' + I('star') + 'Destaque</span>') + '</header>' +
        '<h2>' + esc(hero.name) + '</h2>' +
        '<p class="hero-meta">' + esc(hero.mode) + ' · ' + esc(hero.map) + ' · por ' + orgName(hero) + '</p>' +
        '<div class="hero-clock">' + (hero.status === 'ao_vivo' ? '<span>Em andamento desde</span><strong>' + U.hm(hero.startedAt || hero.startsAt) + '</strong>' : '<span>Começa em</span><strong class="mono" data-until="' + hero.startsAt + '">' + U.until(hero.startsAt) + '</strong>') + '</div>' +
        '<div class="hero-foot"><div><small>Premiação atual</small><b>' + U.money(p.total) + '</b></div>' +
        '<div class="grow"><small>Vagas ' + S.count(hero) + '/' + hero.max + '</small>' + U.bar(S.count(hero) / hero.max) + '</div></div>' +
        (inT || hero.status !== 'aberto' ? '' : '<button type="button" class="btn primary block" data-act="join" data-id="' + hero.id + '">' + I('zap') + 'Inscrever · ' + (hero.entry ? U.money(hero.entry) : 'Grátis') + '</button>') +
        '</article>';
    }

    return {
      html:
        '<section class="page home">' +
        (pin ? '<button type="button" class="notice ripple" data-act="pinned">' + I('megaphone') + '<span><b>' + esc(pin.title) + '</b>' + esc(pin.body) + '</span></button>' : '') +
        '<div class="hello"><div><p class="eyebrow">' + greet() + '</p><h1 class="h1">' + esc(m.nick) + '</h1></div>' +
        '<button type="button" class="elo-chip ripple" data-act="tab" data-v="ranking" style="--c:' + tier.tier.color + '">' + I('zap') + '<b>' + U.int(m.elo) + '</b> ELO · ' + tier.tier.name + '</button></div>' +
        heroHtml +
        '<div class="stat-row stagger">' +
        '<div class="stat"><span class="stat-ic tone-red">' + I('radio') + '</span>' + U.num(live) + '<small>Ao vivo</small></div>' +
        '<div class="stat"><span class="stat-ic tone-violet">' + I('users') + '</span>' + U.num(inscritos) + '<small>Inscritos</small></div>' +
        '<div class="stat"><span class="stat-ic tone-gold">' + I('dollar') + '</span>' + U.num(Math.round(premios), 'int', 'num') + '<small>Em prêmios (R$)</small></div></div>' +
        '<section class="sect"><header class="sec-head"><h3>Maiores prêmios</h3><button type="button" class="link" data-act="tab" data-v="torneios">Ver todos' + I('right') + '</button></header>' +
        '<div class="rail stagger">' + best.map(prizeCard).join('') + '</div></section>' +
        '<section class="sect"><header class="sec-head"><h3>Quase começando</h3></header><div class="soon stagger">' +
        (soon.length ? soon.map((t) => '<button type="button" class="soon-row ripple" data-act="openT" data-id="' + t.id + '">' +
          '<div><b>' + esc(t.name) + '</b><small>' + (spots(t) === 1 ? 'Falta 1 vaga' : 'Faltam ' + spots(t) + ' vagas') + ' · ' + esc(t.mode) + '</small>' + U.bar(S.count(t) / t.max, spots(t) <= 4 ? 'gold' : '') + '</div>' +
          '<div class="soon-side"><small>Começa em</small><b class="mono" data-until="' + t.startsAt + '">' + U.until(t.startsAt) + '</b><span class="gold">' + (t.entry ? U.money(t.entry) : 'Grátis') + '</span></div></button>').join('')
          : U.empty('clock', 'Nenhum torneio começando agora', 'Crie o seu na aba Torneios.')) + '</div></section>' +
        '<section class="sect"><header class="sec-head"><h3>Top da semana</h3><button type="button" class="link" data-act="rankTo" data-v="semanal">Ranking' + I('right') + '</button></header>' +
        '<ol class="mini-rank stagger">' + top.map((r, i) => '<li><button type="button" class="ripple" data-act="player" data-id="' + r.u.id + '"><span class="rk p' + (i + 1) + '">' + (i + 1) + '</span>' + U.avatar(r.u, 'sm') + '<b>' + esc(r.u.nick) + '</b><span class="val">' + U.int(r.value) + ' pts</span></button></li>').join('') + '</ol></section>' +
        (guilds.length ? '<section class="sect"><header class="sec-head"><h3>Guildas recrutando</h3><button type="button" class="link" data-act="tab" data-v="guildas">Ver guildas' + I('right') + '</button></header><div class="stack stagger">' + guilds.map(guildCard).join('') + '</div></section>' : '') +
        '</section>'
    };
  };

  /* ================= TORNEIOS ================= */
  pages.torneios = function () {
    const m = S.me(), q = st.tSearch.trim().toLowerCase();
    const chips = [{ id: 'todos', label: 'Todos', icon: 'trophy' }, { id: 'campeonato', label: 'Campeonato', icon: 'crown' }, { id: 'rapido', label: 'Rápido', icon: 'zap' }, { id: 'diario', label: 'Diário', icon: 'calendar' }, { id: 'apostas', label: 'X1 apostado', icon: 'swords' }, { id: 'meus', label: 'Meus', icon: 'user' }];
    let list = S.db.tournaments.slice();
    if (st.tFilter === 'meus') list = list.filter((t) => t.participants.includes(m.id) || t.organizer === m.id);
    else if (st.tFilter !== 'todos') list = list.filter((t) => t.type === st.tFilter);
    if (q) list = list.filter((t) => (t.name + ' ' + t.map + ' ' + t.mode + ' ' + ((S.user(t.organizer) || {}).nick || '')).toLowerCase().includes(q));
    const rank = { ao_vivo: 0, aberto: 1, finalizado: 2, cancelado: 3 };
    list.sort((a, b) => rank[a.status] - rank[b.status] || (a.status === 'aberto' ? a.startsAt - b.startsAt : b.startsAt - a.startsAt));
    const active = list.filter((t) => t.status === 'aberto' || t.status === 'ao_vivo');
    const closed = list.filter((t) => t.status === 'finalizado' || t.status === 'cancelado');
    return {
      html: '<section class="page">' +
        '<header class="page-head"><div><h1 class="h1">Torneios</h1><p class="muted">' + U.plural(active.length, 'torneio aberto', 'torneios abertos') + '</p></div>' +
        '<button type="button" class="fab ripple" data-act="createT" aria-label="Criar torneio">' + I('plus') + '</button></header>' +
        '<label class="search">' + I('search') + '<input id="t-search" type="search" placeholder="Buscar por nome, mapa ou organizador" value="' + esc(st.tSearch) + '" data-input="tSearch" autocomplete="off"></label>' +
        '<div class="chips" role="tablist">' + chips.map((c) => '<button type="button" class="chip-btn' + (st.tFilter === c.id ? ' on' : '') + '" data-act="tFilter" data-v="' + c.id + '">' + I(c.icon) + c.label + '</button>').join('') + '</div>' +
        '<div class="stack stagger">' + (active.length ? active.map(tItem).join('') : U.empty('trophy', 'Nenhum torneio encontrado', q ? 'Tente outro termo de busca.' : 'Crie um torneio no botão +.')) + '</div>' +
        (closed.length ? '<h3 class="sub-h">Encerrados</h3><div class="stack stagger dim">' + closed.slice(0, 8).map(tItem).join('') + '</div>' : '') +
        '</section>'
    };
  };

  pages.tournament = function (p) {
    const t = S.tournament(p.id), m = S.me();
    if (!t) return { html: '<section class="page">' + backRow() + U.empty('alert', 'Torneio não encontrado', 'Ele pode ter sido excluído.') + '</section>' };
    const type = S.TYPES[t.type] || S.TYPES.rapido;
    const prize = S.prizeTable(t, false), full = S.prizeTable(t, true);
    const inT = t.participants.includes(m.id), staff = S.can('tournaments'), org = t.organizer === m.id;
    const canChat = inT || org || S.isStaff(m);
    const medal = ['gold', 'silver', 'bronze', 'violet', 'slate'];
    const known = t.participants.map(S.user).filter(Boolean);

    let action = '';
    if (t.status === 'aberto') {
      action = inT
        ? '<div class="cta-bar"><div><small>Você está inscrito</small><b class="green">' + I('checkCircle') + 'Vaga garantida</b></div><button type="button" class="btn ghost" data-act="leaveT" data-id="' + t.id + '">Sair do torneio</button></div>'
        : spots(t) > 0 ? '<div class="cta-bar"><div><small>Inscrição</small><b>' + (t.entry ? U.money(t.entry) : 'Grátis') + '</b></div><button type="button" class="btn primary" data-act="join" data-id="' + t.id + '">' + I('zap') + 'Inscrever-se</button></div>'
          : '<div class="cta-bar"><div><small>Inscrições</small><b>Sala cheia</b></div><button type="button" class="btn ghost" disabled>' + I('lock') + 'Sem vagas</button></div>';
    }

    const room = t.status === 'ao_vivo' && t.room
      ? (inT || org || S.isStaff(m)
        ? '<div class="room-card"><span class="live"><i></i>Sala liberada</span><div class="room-grid"><div><small>ID da sala</small><b class="mono">' + esc(t.room.id) + '</b></div><div><small>Senha</small><b class="mono">' + esc(t.room.pass) + '</b></div></div><button type="button" class="btn ghost sm" data-act="copy" data-v="' + esc(t.room.id) + '">' + I('copy') + 'Copiar ID</button></div>'
        : '<div class="room-card locked">' + I('lock') + '<span>O ID e a senha da sala aparecem só para inscritos.</span></div>')
      : '';

    const results = t.status === 'finalizado' && t.results.length
      ? '<section class="card"><h3 class="card-h">' + I('trophy') + 'Resultado</h3><ol class="results">' + t.results.map((r) => { const u = S.user(r.u); return '<li><span class="medal m-' + medal[r.place - 1] + '">' + r.place + 'º</span>' + U.avatar(u, 'sm') + '<b>' + (u ? esc(u.nick) : 'Conta excluída') + '</b><span class="gold">' + U.money(r.prize) + '</span></li>'; }).join('') + '</ol></section>'
      : '';

    const manage = staff || org
      ? '<section class="card manage"><h3 class="card-h">' + I('sliders') + 'Gestão do torneio</h3>' +
        '<div class="tiles3"><div class="tile tone-gold"><b>' + S.count(t) + '</b><small>Inscritos</small></div><div class="tile tone-green"><b>' + U.moneyShort(prize.entryPool) + '</b><small>Arrecadado</small></div><div class="tile tone-violet"><b>' + U.moneyShort(prize.fee) + '</b><small>Taxa ' + prize.feePct + '%</small></div></div>' +
        (staff && (t.status === 'aberto' || t.status === 'ao_vivo') ? '<div class="btn-row">' +
          (t.status === 'aberto' ? '<button type="button" class="btn primary sm" data-act="aStartT" data-id="' + t.id + '">' + I('play') + 'Iniciar</button>' : '') +
          '<button type="button" class="btn gold sm" data-act="aFinishT" data-id="' + t.id + '">' + I('flag') + 'Finalizar</button>' +
          '<button type="button" class="btn ghost sm" data-act="aEditT" data-id="' + t.id + '">' + I('edit') + 'Editar</button>' +
          '<button type="button" class="btn danger-ghost sm" data-act="aCancelT" data-id="' + t.id + '">' + I('ban') + 'Cancelar</button></div>'
          : !staff && org ? '<p class="muted small">A administração inicia e finaliza a sala. Os prêmios caem na carteira dos vencedores automaticamente.</p>' : '') +
        '</section>'
      : '';

    return {
      html: '<section class="page t-detail">' + backRow() +
        '<header class="t-hero tone-' + type.tone + '"><span class="t-hero-ic">' + I(type.icon) + '</span>' +
        '<div class="t-tags">' + U.typeTag(t.type) + U.status(t) + (t.featured ? '<span class="tag tone-gold">' + I('star') + 'Destaque</span>' : '') + '</div>' +
        '<h1 class="h1">' + esc(t.name) + '</h1><p class="t-by">por ' + orgName(t) + '</p>' +
        '<div class="tiles3 stagger"><div class="tile"><span>' + I('users') + '</span><b>' + S.count(t) + '/' + t.max + '</b><small>Jogadores</small></div>' +
        '<div class="tile"><span>' + I('clock') + '</span><b>' + U.hm(t.startsAt) + '</b><small>' + U.date(t.startsAt).slice(0, 5) + '</small></div>' +
        '<div class="tile"><span>' + I('coins') + '</span><b>' + (t.entry ? U.money(t.entry).replace(',00', '') : 'Grátis') + '</b><small>Entrada</small></div></div>' +
        (t.status === 'aberto' ? '<div class="t-count"><span>' + (t.startsAt > Date.now() ? 'Começa em' : 'Aguardando a sala') + '</span><strong class="mono" data-until="' + t.startsAt + '">' + U.until(t.startsAt) + '</strong></div>' : '') +
        (t.status === 'cancelado' ? '<p class="t-cancel">' + I('alert') + 'Cancelado: ' + esc(t.cancelReason || 'sem motivo informado') + '. As inscrições foram devolvidas.</p>' : '') +
        '</header>' +
        room + action + results +
        '<section class="card"><h3 class="card-h">' + I('trophy') + 'Premiação</h3>' +
        '<div class="prize-top"><div><small>Total agora</small>' + U.num(prize.total, 'money', 'big gold') + '</div><div class="right"><small>Com sala cheia</small><b>' + U.money(full.total) + '</b></div></div>' +
        '<ol class="split">' + prize.split.map((pct, i) => '<li><span class="medal m-' + medal[i] + '">' + (i + 1) + 'º</span><span class="grow">' + pct + '% do prêmio</span><b>' + U.money(prize.prizes[i]) + '</b></li>').join('') + '</ol>' +
        '<p class="note-gold">' + I('info') + '<span>Prêmios distribuídos automaticamente após a finalização (' + (100 - prize.feePct) + '% do pool de inscrições · ' + prize.feePct + '% plataforma)' + (t.bonus ? '. Inclui ' + U.money(t.bonus) + ' garantidos pela BattleHub.' : '.') + '</span></p></section>' +
        manage +
        '<section class="card"><h3 class="card-h">' + I('users') + 'Participantes <span class="muted">(' + S.count(t) + ')</span></h3>' +
        (S.count(t) ? '<ul class="people stagger">' + known.map((u) => '<li><button type="button" class="ripple" data-act="player" data-id="' + u.id + '">' + U.avatar(u, 'sm') + '<span>' + esc(u.nick) + '</span></button></li>').join('') +
          (t.extra ? '<li class="more"><span class="av av-sm av-more">+' + t.extra + '</span><span>outros</span></li>' : '') + '</ul>' : '<p class="muted center pad">Nenhum participante ainda. Seja o primeiro.</p>') + '</section>' +
        '<section class="card chat-card"><h3 class="card-h">' + I('message') + 'Chat do torneio' + (t.status === 'ao_vivo' ? '<span class="dot-on" title="Ao vivo"></span>' : '') + '</h3>' +
        '<div class="t-chat" id="t-chat">' + (t.chat.length ? t.chat.map((c) => { const u = S.user(c.u); return '<div class="t-msg' + (c.u === m.id ? ' me' : '') + '">' + U.avatar(u, 'xs') + '<div><b>' + (u ? esc(u.nick) : '?') + (u && S.isStaff(u) ? U.role(u) : '') + '</b><p>' + esc(c.text) + '</p><small>' + U.hm(c.at) + '</small></div></div>'; }).join('') : '<p class="muted center pad">Nenhuma mensagem ainda. Seja o primeiro a falar.</p>') + '</div>' +
        (canChat && t.status !== 'cancelado'
          ? '<form class="composer" data-form="tchat" data-id="' + t.id + '"><input id="tchat-input" name="text" placeholder="Digite uma mensagem" maxlength="300" autocomplete="off"><button class="send ripple" aria-label="Enviar">' + I('send') + '</button></form>'
          : '<p class="locked-line">' + I('lock') + 'Inscreva-se para falar no chat.</p>') + '</section>' +
        '<section class="card"><h3 class="card-h">' + I('file') + 'Regras</h3><p class="rules">' + esc(t.rules) + '</p>' +
        '<dl class="kv inline"><div><dt>Modo</dt><dd>' + esc(t.mode) + '</dd></div><div><dt>Mapa</dt><dd>' + esc(t.map) + '</dd></div><div><dt>Premiados</dt><dd>' + prize.split.length + '</dd></div></dl></section>' +
        '</section>',
      onMount(root) { const c = root.querySelector('#t-chat'); if (c) c.scrollTop = c.scrollHeight; }
    };
  };
  function backRow(label) { return '<button type="button" class="back ripple" data-act="back">' + I('back') + (label || 'Voltar') + '</button>'; }
  BH.backRow = backRow;

  flows.join = function (tid) {
    const t = S.tournament(tid), m = S.me();
    if (!t) return;
    if (t.type === 'apostas' && !m.verified) {
      U.toast('X1 apostado exige conta verificada.', 'bad');
      return flows.verify();
    }
    const after = BH.store.r2(m.balance - t.entry), enough = after >= 0;
    U.sheet({
      title: 'Confirmar inscrição',
      body: () => '<div class="confirm-t"><h3>' + esc(t.name) + '</h3><p class="muted">' + esc(t.mode) + ' · ' + esc(t.map) + ' · ' + U.when(t.startsAt) + '</p></div>' +
        '<dl class="ledger"><div><dt>Inscrição</dt><dd>' + (t.entry ? U.money(t.entry) : 'Grátis') + '</dd></div><div><dt>Seu saldo</dt><dd>' + U.money(m.balance) + '</dd></div><div class="total"><dt>Saldo depois</dt><dd class="' + (enough ? '' : 'red') + '">' + U.money(after) + '</dd></div></dl>' +
        (enough
          ? '<button type="button" class="btn primary block lg" data-act="joinConfirm" data-id="' + t.id + '">' + I('zap') + 'Confirmar inscrição</button><p class="muted small center">Você pode sair até 10 minutos antes do início e recebe o valor de volta.</p>'
          : '<p class="note-red">' + I('alert') + '<span>Faltam ' + U.money(-after) + ' para se inscrever.</span></p><button type="button" class="btn primary block lg" data-act="deposit" data-v="' + Math.max(S.db.settings.minDeposit, Math.ceil(-after)) + '">' + I('plus') + 'Adicionar saldo</button>')
    });
  };
  actions.join = (el) => flows.join(el.dataset.id);
  actions.joinConfirm = function (el) {
    const r = A.join(el.dataset.id);
    const sh = U.topSheet();
    if (r.ok) {
      if (sh) sh.close(true);
      const rect = el.getBoundingClientRect();
      U.confetti(rect.left + rect.width / 2, rect.top);
      U.toast('Inscrição confirmada. Boa sorte!', 'good');
      app().refresh();
    } else {
      U.result(r);
      if (r.code === 'saldo') { if (sh) sh.close(true); flows.deposit(); }
      if (r.code === 'verify') { if (sh) sh.close(true); flows.verify(); }
    }
  };
  actions.leaveT = async function (el) {
    const t = S.tournament(el.dataset.id);
    const ok = await U.confirm({ title: 'Sair do torneio?', body: t.entry ? U.money(t.entry) + ' voltam para sua carteira.' : 'Sua vaga fica livre para outro jogador.', ok: 'Sair', danger: true });
    if (!ok) return;
    if (U.result(A.leave(t.id), 'Você saiu do torneio.')) app().refresh();
  };
  actions.openT = (el) => app().push('tournament', { id: el.dataset.id });
  actions.tFilter = (el) => { st.tFilter = el.dataset.v; app().rerender('soft'); };
  actions.copy = (el) => U.copy(el.dataset.v);
  forms.tchat = function (f) {
    const input = f.querySelector('input');
    const r = A.tournamentChat(f.dataset.id, input.value);
    if (!r.ok) return U.result(r);
    input.value = '';
    app().refresh();
    setTimeout(() => { const c = document.getElementById('t-chat'); if (c) c.scrollTop = c.scrollHeight; const i = document.getElementById('tchat-input'); if (i) i.focus(); }, 0);
  };

  /* criar / editar torneio (também usado pelo admin) */
  flows.tournamentForm = function (t) {
    const m = S.me();
    const edit = !!t;
    const d = t || { name: '', type: 'rapido', mode: 'Solo', map: 'Bermuda', entry: 5, bonus: 0, max: 24, split: '3', startsAt: Date.now() + 3 * S.HOUR, rules: '' };
    const dt = new Date(d.startsAt - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
    const opt = (list, v, labels) => list.map((x, i) => '<option value="' + x + '"' + (String(x) === String(v) ? ' selected' : '') + '>' + (labels ? labels[i] : x) + '</option>').join('');
    const locked = edit && S.count(t) > 0;
    U.sheet({
      title: edit ? 'Editar torneio' : 'Criar torneio', size: 'lg',
      body: () => '<form class="form" data-form="tournament" data-id="' + (edit ? t.id : '') + '">' +
        '<label class="field"><span>Nome do torneio</span><input id="tf-name" name="name" maxlength="40" required placeholder="Ex.: Copa da Quebrada #1" value="' + esc(d.name) + '"></label>' +
        '<div class="grid2"><label class="field"><span>Formato</span><select id="tf-type" name="type">' + opt(Object.keys(S.TYPES), d.type, Object.values(S.TYPES).map((x) => x.name)) + '</select></label>' +
        '<label class="field"><span>Modo</span><select id="tf-mode" name="mode">' + opt(S.MODES, d.mode) + '</select></label></div>' +
        '<div class="grid2"><label class="field"><span>Mapa</span><select id="tf-map" name="map">' + opt(S.MAPS, d.map) + '</select></label>' +
        '<label class="field"><span>Vagas</span><input id="tf-max" name="max" type="number" inputmode="numeric" min="2" max="100" value="' + d.max + '"></label></div>' +
        '<div class="grid2"><label class="field"><span>Inscrição (R$)</span><input id="tf-entry" name="entry" type="number" inputmode="decimal" min="0" max="500" step="0.5" value="' + d.entry + '"' + (locked ? ' readonly' : '') + '>' + (locked ? '<em>Travada: já há inscritos</em>' : '') + '</label>' +
        '<label class="field"><span>Premiados</span><select id="tf-split" name="split">' + opt(['1', '3', '5'], d.split, ['Só o 1º (100%)', 'Top 3 (60/30/10)', 'Top 5 (45/25/15/10/5)']) + '</select></label></div>' +
        (S.can('finance', m) ? '<label class="field"><span>Prêmio garantido pela plataforma (R$)</span><input id="tf-bonus" name="bonus" type="number" inputmode="decimal" min="0" step="1" value="' + (d.bonus || 0) + '"></label>' : '') +
        '<label class="field"><span>Início</span><input id="tf-start" name="startsAt" type="datetime-local" value="' + dt + '" required></label>' +
        '<label class="field"><span>Regras</span><textarea id="tf-rules" name="rules" rows="3" maxlength="600" placeholder="Ex.: proibido emulador, print do resultado obrigatório">' + esc(d.rules) + '</textarea></label>' +
        '<div class="calc" id="tf-calc"></div>' +
        '<button class="btn primary block lg">' + I(edit ? 'check' : 'plus') + (edit ? 'Salvar alterações' : 'Publicar torneio') + '</button></form>',
      onMount(api) {
        const f = api.body.querySelector('form');
        const calc = () => {
          const fake = { entry: Number(f.entry.value) || 0, max: Number(f.max.value) || 0, bonus: f.bonus ? Number(f.bonus.value) || 0 : (d.bonus || 0), split: f.split.value, fee: edit ? t.fee : S.db.settings.fee, participants: [], extra: 0 };
          const p = S.prizeTable(fake, true);
          api.body.querySelector('#tf-calc').innerHTML = '<span>Com sala cheia</span><b>' + U.money(p.total) + '</b><small>1º leva ' + U.money(p.prizes[0]) + ' · taxa de ' + p.feePct + '%: ' + U.money(p.fee) + '</small>';
        };
        f.addEventListener('input', calc); calc();
      }
    });
  };
  actions.createT = function () {
    const m = S.me();
    if (!m.verified && !S.isStaff(m)) { U.toast('Verifique sua conta para criar torneios.', 'bad'); return flows.verify(); }
    flows.tournamentForm(null);
  };
  forms.tournament = function (f) {
    const data = Object.fromEntries(new FormData(f).entries());
    data.startsAt = new Date(data.startsAt).getTime();
    const id = f.dataset.id;
    const r = id ? A.updateTournament(id, data) : A.createTournament(data);
    if (!U.result(r, id ? 'Torneio atualizado.' : 'Torneio publicado.')) return;
    U.topSheet() && U.topSheet().close(true);
    if (!id) app().push('tournament', { id: r.tournament.id }); else app().refresh();
  };

  /* ================= RANKING ================= */
  pages.ranking = function () {
    const m = S.me();
    const tabs = [{ id: 'elo', label: 'ELO' }, { id: 'global', label: 'Global' }, { id: 'semanal', label: 'Semanal' }, { id: 'mensal', label: 'Mensal' }];
    const list = S.rankingList(st.rankTab);
    const unit = st.rankTab === 'elo' ? 'ELO' : 'pts';
    const colors = ['#f6b83c', '#c3cad6', '#d08a5b', '#8b5cf6', '#5d5877'];
    const top5 = list.slice(0, 5).map((r, i) => ({ label: r.u.nick, value: r.value, color: colors[i] }));
    const podium = [list[1], list[0], list[2]].filter(Boolean);
    const myPos = list.findIndex((r) => r.u.id === m.id);
    const label = { elo: 'ELO', global: 'Global', semanal: 'Semanal', mensal: 'Mensal' }[st.rankTab];
    return {
      html: '<section class="page">' +
        '<header class="page-head"><div><h1 class="h1">Ranking</h1><p class="muted">Temporada 3 · semanal zera segunda às 00h</p></div></header>' +
        U.seg('rank', tabs, st.rankTab, 'rankTab') +
        (myPos >= 0 ? '<button type="button" class="my-pos ripple" data-act="page" data-v="history"><span>Sua posição</span><b>' + (myPos + 1) + 'º</b>' + U.avatar(m, 'xs') + '<span class="grow">' + esc(m.nick) + '</span><b class="gold">' + U.int(list[myPos].value) + ' ' + unit + '</b></button>' : '') +
        '<section class="card chart-card"><h3 class="eyebrow">Top 5 · ' + label + '</h3>' + U.barChart(top5, { label: 'Top 5 ' + label }) + '</section>' +
        '<div class="podium" aria-label="Pódio">' + podium.map((r) => {
          const pos = list.indexOf(r) + 1;
          return '<button type="button" class="pod pod-' + pos + '" data-act="player" data-id="' + r.u.id + '">' +
            (pos === 1 ? '<span class="pod-crown">' + I('crown') + '</span>' : '') +
            U.avatar(r.u, pos === 1 ? 'lg' : 'md', 'ring-' + pos) +
            '<b class="pod-name">' + esc(r.u.nick) + '</b><small class="pod-val">' + U.int(r.value) + ' ' + unit + '</small>' +
            '<span class="pod-block"><span class="pod-num">' + pos + '</span></span></button>';
        }).join('') + '</div>' +
        '<ol class="rank-list stagger" start="4">' + list.slice(3).map((r, i) => rankRow(r, i + 4, unit, m)).join('') + '</ol>' +
        '</section>'
    };
  };
  function rankRow(r, pos, unit, m) {
    return '<li class="' + (r.u.id === m.id ? 'me' : '') + '"><button type="button" class="rank-row ripple" data-act="player" data-id="' + r.u.id + '">' +
      '<span class="rk">' + pos + 'º</span>' + U.avatar(r.u, 'sm') +
      '<div class="grow"><b>' + esc(r.u.nick) + U.verified(r.u) + ' ' + U.tier(r.u.elo) + '</b><small>' + I('trophy') + U.int(r.u.stats.wins) + ' vitórias · ' + I('crosshair') + U.int(r.u.stats.kills) + ' kills</small></div>' +
      '<b class="val">' + U.int(r.value) + '<small>' + unit + '</small></b></button></li>';
  }
  actions.rankTab = (el) => { st.rankTab = el.dataset.v; app().rerender('soft'); };
  actions.rankTo = (el) => { st.rankTab = el.dataset.v; app().go('ranking'); };

  /* ================= GUILDAS ================= */
  function guildCard(g) {
    const leader = S.user(g.leader);
    return '<article class="g-item ripple" data-act="openG" data-id="' + g.id + '" tabindex="0">' +
      '<span class="g-tag" style="--g1:' + g.color[0] + ';--g2:' + g.color[1] + '">' + esc(g.tag) + '</span>' +
      '<div class="grow"><h4>' + esc(g.name) + (g.recruiting && g.memberCount < g.max ? '<span class="chip tone-green">Recrutando</span>' : '<span class="chip tone-muted">Fechada</span>') + '</h4>' +
      '<p class="t-by">Líder: ' + (leader ? esc(leader.nick) : '?') + '</p>' +
      '<div class="t-meta"><span>' + I('users') + g.memberCount + '/' + g.max + '</span><span>' + I('trophy') + g.wins + ' vitórias</span><span class="gold">' + I('star') + U.int(g.points) + ' pts</span></div></div>' +
      '<span class="chev">' + I('right') + '</span></article>';
  }
  BH.guildCard = guildCard;
  pages.guildas = function () {
    const m = S.me(), q = st.gSearch.trim().toLowerCase();
    let list = S.db.guilds.slice().sort((a, b) => b.points - a.points);
    if (st.gFilter === 'recrutando') list = list.filter((g) => g.recruiting && g.memberCount < g.max);
    if (q) list = list.filter((g) => (g.name + ' ' + g.tag).toLowerCase().includes(q));
    const mine = S.guild(m.guildId);
    return {
      html: '<section class="page"><header class="page-head"><div><h1 class="h1">Guildas</h1><p class="muted">' + U.plural(S.db.guilds.length, 'guilda', 'guildas') + ' na temporada</p></div>' +
        (mine ? '' : '<button type="button" class="fab ripple" data-act="createG" aria-label="Criar guilda">' + I('plus') + '</button>') + '</header>' +
        (mine ? '<div class="my-guild"><p class="eyebrow">Sua guilda</p>' + guildCard(mine) + '</div>' : '') +
        '<label class="search">' + I('search') + '<input id="g-search" type="search" placeholder="Buscar guildas" value="' + esc(st.gSearch) + '" data-input="gSearch" autocomplete="off"></label>' +
        '<div class="chips">' + [['todas', 'Todas'], ['recrutando', 'Recrutando']].map((c) => '<button type="button" class="chip-btn' + (st.gFilter === c[0] ? ' on' : '') + '" data-act="gFilter" data-v="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
        '<div class="stack stagger">' + (list.length ? list.map(guildCard).join('') : U.empty('shield', 'Nenhuma guilda encontrada', 'Crie a sua no botão +.')) + '</div></section>'
    };
  };
  pages.guild = function (p) {
    const g = S.guild(p.id), m = S.me();
    if (!g) return { html: '<section class="page">' + backRow() + U.empty('shield', 'Guilda não encontrada', 'Ela pode ter sido dissolvida.') + '</section>' };
    const leader = S.user(g.leader), members = g.members.map(S.user).filter(Boolean);
    const isMember = m.guildId === g.id;
    return {
      html: '<section class="page">' + backRow() +
        '<header class="g-hero" style="--g1:' + g.color[0] + ';--g2:' + g.color[1] + '"><span class="g-tag xl">' + esc(g.tag) + '</span><h1 class="h1">' + esc(g.name) + '</h1>' +
        '<p class="muted">' + esc(g.desc || 'Sem descrição.') + '</p>' +
        '<div class="tiles3 four stagger"><div class="tile"><b>' + g.memberCount + '/' + g.max + '</b><small>Membros</small></div><div class="tile"><b>' + g.wins + '</b><small>Vitórias</small></div><div class="tile"><b>' + U.int(g.points) + '</b><small>Pontos</small></div><div class="tile"><b>' + (g.minElo || 'Livre') + '</b><small>ELO mínimo</small></div></div></header>' +
        (isMember
          ? '<button type="button" class="btn ghost block" data-act="leaveG">' + I('logout') + 'Sair da guilda</button>'
          : m.guildId ? '<p class="muted center">Você já faz parte de outra guilda.</p>'
            : g.recruiting && g.memberCount < g.max ? '<button type="button" class="btn primary block lg" data-act="joinG" data-id="' + g.id + '">' + I('userPlus') + 'Entrar na guilda</button>'
              : '<button type="button" class="btn ghost block" disabled>' + I('lock') + 'Recrutamento fechado</button>') +
        '<section class="card"><h3 class="card-h">' + I('users') + 'Membros</h3><ul class="member-list stagger">' +
        members.map((u) => '<li><button type="button" class="rank-row ripple" data-act="player" data-id="' + u.id + '">' + U.avatar(u, 'sm') + '<div class="grow"><b>' + esc(u.nick) + U.verified(u) + '</b><small>' + (u.id === g.leader ? 'Líder' : 'Membro') + ' · ' + U.int(u.elo) + ' ELO</small></div>' + U.tier(u.elo) + '</button></li>').join('') +
        (g.memberCount > members.length ? '<li class="muted small pad">e mais ' + (g.memberCount - members.length) + ' membros</li>' : '') + '</ul></section>' +
        '<p class="muted small center">Fundada em ' + U.date(g.createdAt).slice(0, 5) + ' · líder ' + (leader ? esc(leader.nick) : '?') + '</p></section>'
    };
  };
  actions.openG = (el) => app().push('guild', { id: el.dataset.id });
  actions.gFilter = (el) => { st.gFilter = el.dataset.v; app().rerender('soft'); };
  actions.joinG = (el) => { if (U.result(A.joinGuild(el.dataset.id), 'Bem-vindo à guilda!')) { U.confetti(); app().refresh(); } };
  actions.leaveG = async () => {
    if (!(await U.confirm({ title: 'Sair da guilda?', body: 'Você pode entrar em outra depois.', ok: 'Sair', danger: true }))) return;
    if (U.result(A.leaveGuild(), 'Você saiu da guilda.')) app().refresh();
  };
  actions.createG = function () {
    U.sheet({
      title: 'Criar guilda',
      body: () => '<form class="form" data-form="guild">' +
        '<label class="field"><span>Nome</span><input id="gf-name" name="name" maxlength="24" required placeholder="Ex.: Lobos da Serra"></label>' +
        '<div class="grid2"><label class="field"><span>Tag</span><input id="gf-tag" name="tag" maxlength="4" required placeholder="LDS" style="text-transform:uppercase"></label>' +
        '<label class="field"><span>ELO mínimo</span><input id="gf-elo" name="minElo" type="number" inputmode="numeric" min="0" max="3000" value="0"></label></div>' +
        '<label class="field"><span>Descrição</span><textarea id="gf-desc" name="desc" rows="3" maxlength="200" placeholder="Horário de treino, estilo de jogo, requisitos"></textarea></label>' +
        '<button class="btn primary block lg">' + I('shield') + 'Criar guilda</button></form>'
    });
  };
  forms.guild = function (f) {
    const r = A.createGuild(Object.fromEntries(new FormData(f).entries()));
    if (!U.result(r, 'Guilda criada.')) return;
    U.topSheet() && U.topSheet().close(true);
    U.confetti();
    app().push('guild', { id: r.guild.id });
  };

  /* ================= MENSAGENS ================= */
  pages.chat = function () {
    const m = S.me(), q = st.chatSearch.trim().toLowerCase();
    const convs = S.conversationsOf(m.id);
    const found = q ? S.db.users.filter((u) => u.id !== m.id && !u.banned && u.nick.toLowerCase().includes(q)).slice(0, 6) : [];
    return {
      html: '<section class="page"><header class="page-head"><div><h1 class="h1">Mensagens</h1><p class="muted">' + U.plural(convs.length, 'conversa', 'conversas') + '</p></div></header>' +
        '<label class="search">' + I('search') + '<input id="c-search" type="search" placeholder="Buscar jogadores para conversar" value="' + esc(st.chatSearch) + '" data-input="chatSearch" autocomplete="off"></label>' +
        (q ? '<div class="stack">' + (found.length ? found.map((u) => '<div class="rank-row"><span class="av-wrap">' + U.avatar(u, 'sm') + '</span><div class="grow"><b>' + esc(u.nick) + U.verified(u) + '</b><small>' + U.int(u.elo) + ' ELO</small></div><button type="button" class="btn primary sm" data-act="dm" data-id="' + u.id + '">' + I('message') + 'Conversar</button></div>').join('') : '<p class="muted center pad">Nenhum jogador com esse nome.</p>') + '</div>' : '') +
        '<ul class="conv-list stagger">' + (convs.length ? convs.map((c) => {
          const other = S.user(c.members.find((x) => x !== m.id)), last = c.messages[c.messages.length - 1];
          const unread = (c.unread && c.unread[m.id]) || 0;
          return '<li><button type="button" class="conv ripple" data-act="openC" data-id="' + c.id + '">' + U.avatar(other, 'md') +
            '<div class="grow"><b>' + (other ? esc(other.nick) : 'Conta excluída') + U.verified(other) + '</b><small>' + (c.typing ? '<em class="violet">digitando…</em>' : last ? (last.from === m.id ? 'Você: ' : '') + esc(last.text) : 'Nenhuma mensagem ainda') + '</small></div>' +
            '<div class="conv-side"><small>' + (last ? U.ago(last.at) : '') + '</small>' + (unread ? '<b class="dot-count">' + unread + '</b>' : '') + '</div></button></li>';
        }).join('') : '<li>' + U.empty('message', 'Nenhuma conversa ainda', 'Use a busca para encontrar jogadores.') + '</li>') + '</ul></section>'
    };
  };
  pages.conversation = function (p) {
    const m = S.me(), c = S.db.conversations.find((x) => x.id === p.id);
    if (!c) return { html: '<section class="page">' + backRow() + U.empty('message', 'Conversa não encontrada', '') + '</section>' };
    A.readConversation(c.id);
    const other = S.user(c.members.find((x) => x !== m.id));
    let lastDay = '';
    const msgs = c.messages.map((msg) => {
      const day = new Date(msg.at).toDateString();
      const sep = day !== lastDay ? '<div class="day-sep"><span>' + U.when(msg.at).split(',')[0].split(' · ')[0] + '</span></div>' : '';
      lastDay = day;
      return sep + '<div class="bubble' + (msg.from === m.id ? ' me' : '') + '"><p>' + esc(msg.text) + '</p><small>' + U.hm(msg.at) + '</small></div>';
    }).join('');
    return {
      hideNav: true, bare: true, className: 'conv-page',
      html: '<section class="page conv-view"><header class="conv-head"><button type="button" class="icon-btn" data-act="back" aria-label="Voltar">' + I('back') + '</button>' +
        '<button type="button" class="conv-who" data-act="player" data-id="' + (other ? other.id : '') + '">' + U.avatar(other, 'sm') + '<span><b>' + (other ? esc(other.nick) : '?') + U.verified(other) + '</b><small>' + (c.typing ? 'digitando…' : 'online há pouco') + '</small></span></button></header>' +
        '<div class="msgs" id="msgs">' + (msgs || '<p class="muted center pad">Diga oi para ' + (other ? esc(other.nick) : 'o jogador') + '.</p>') +
        (c.typing ? '<div class="bubble typing" aria-label="digitando"><i></i><i></i><i></i></div>' : '') + '</div>' +
        '<form class="composer fixed" data-form="dm" data-id="' + c.id + '"><input id="dm-input" name="text" placeholder="Mensagem" maxlength="500" autocomplete="off"><button class="send ripple" aria-label="Enviar">' + I('send') + '</button></form></section>',
      onMount() { window.scrollTo(0, document.documentElement.scrollHeight); }
    };
  };
  actions.openC = (el) => app().push('conversation', { id: el.dataset.id });
  actions.dm = function (el) {
    const r = A.openConversation(el.dataset.id);
    if (!U.result(r)) return;
    U.closeAll();
    st.chatSearch = '';
    if (app().current().tab !== 'chat') app().go('chat', true);
    app().push('conversation', { id: r.conversation.id });
  };
  forms.dm = function (f) {
    const input = f.querySelector('input');
    const r = A.sendMessage(f.dataset.id, input.value);
    if (!r.ok) return U.result(r);
    input.value = '';
    app().refresh();
    window.scrollTo(0, document.documentElement.scrollHeight);
  };

  /* ================= PERFIL ================= */
  pages.perfil = function () {
    const m = S.me(), tier = S.tierOf(m.elo);
    const v = S.verificationOf(m.id);
    const myTx = S.db.tx.filter((x) => x.userId === m.id).sort((a, b) => b.at - a.at);
    const gd = S.guild(m.guildId);
    let verify;
    if (m.verified) verify = '<div class="v-card ok"><span class="v-ic">' + I('badgeCheck') + '</span><div><b>Conta verificada</b><p>Free Fire ' + esc(m.ff.nick || '') + ' · ID ' + esc(m.ff.id || '') + ' · ' + esc(m.ff.rank || '') + '</p></div></div>';
    else if (v && v.status === 'pendente') verify = '<div class="v-card wait"><span class="v-ic">' + I('clock') + '</span><div><b>Verificação em análise</b><p>Enviada ' + U.ago(v.at) + '. A moderação responde em até 24 horas.</p></div></div>';
    else verify = '<div class="v-card"><span class="v-ic">' + I('shield') + '</span><div><b>Verificação Free Fire</b><p>' + (v && v.status === 'recusada' ? 'Recusada: ' + esc(v.note || 'print ilegível') + '. Envie outro print.' : 'Envie um print do seu perfil do Free Fire mostrando ID, level e rank. Libera saques e X1 apostado.') + '</p>' +
      '<button type="button" class="btn outline sm" data-act="verify">' + I('upload') + 'Enviar print</button></div></div>';

    return {
      html: '<section class="page profile">' +
        '<div class="p-banner" style="background:' + U.banner(m) + '"><span class="p-pattern"></span></div>' +
        '<div class="p-id">' + U.avatar(m, 'xl', 'pop') +
        '<h1 class="h1">' + esc(m.nick) + U.verified(m) + '</h1><p class="muted">' + esc(m.email) + '</p>' +
        '<div class="p-badges">' + U.tier(m.elo) + U.role(m) + '<button type="button" class="chip mono ripple" data-act="copy" data-v="' + m.code + '">' + I('hash') + m.code + '</button></div>' +
        (m.bio ? '<p class="p-bio">' + esc(m.bio) + '</p>' : '') +
        '<div class="elo-box"><div class="elo-line"><span>' + I('zap') + '<b>' + U.int(m.elo) + '</b> ELO · ' + tier.tier.name + '</span><small>' + (tier.next ? 'faltam ' + (tier.next.min - m.elo) + ' para ' + tier.next.name : 'tier máximo') + '</small></div>' + U.bar(tier.progress, 'elo') + '</div>' +
        '<div class="follow-row"><div>' + U.num(S.followers(m)) + '<small>Seguidores</small></div><div>' + U.num(m.following.length) + '<small>Seguindo</small></div><div>' + U.num(m.reputation) + '<small>Reputação</small></div>' + (gd ? '<button type="button" data-act="openG" data-id="' + gd.id + '"><b>' + esc(gd.tag) + '</b><small>Guilda</small></button>' : '') + '</div></div>' +
        '<div class="btn-row two"><button type="button" class="btn outline" data-act="look">' + I('palette') + 'Personalizar</button><button type="button" class="btn green-ghost" data-act="deposit">' + I('plus') + 'Adicionar saldo</button></div>' +
        verify +
        '<section class="wallet"><span class="wallet-glow" aria-hidden="true"></span><header><span>' + I('wallet') + 'Minha carteira</span><button type="button" class="link" data-act="statement">Extrato' + I('right') + '</button></header>' +
        U.num(m.balance, 'money', 'wallet-num') +
        '<div class="btn-row two"><button type="button" class="btn primary" data-act="deposit">' + I('plus') + 'Depositar</button><button type="button" class="btn dark" data-act="withdraw">' + I('arrowIn') + 'Sacar</button></div>' +
        '<ul class="tx-list">' + (myTx.length ? myTx.slice(0, 3).map((x) => BH.txRow(x)).join('') : '<li class="muted small">Nenhuma movimentação ainda.</li>') + '</ul></section>' +
        '<div class="stat-grid stagger">' +
        [['trophy', m.stats.wins, 'Vitórias'], ['crosshair', m.stats.kills, 'Kills'], ['gamepad', m.stats.matches, 'Partidas'], ['up', m.stats.points, 'Pontos'], ['target', m.stats.top3, 'Top 3'], ['heart', m.reputation, 'Reputação', 'pct']]
          .map((s) => '<div class="sg"><span>' + I(s[0]) + '</span>' + U.num(s[1], s[3]) + '<small>' + s[2] + '</small></div>').join('') + '</div>' +
        '<nav class="menu stagger">' +
        '<button type="button" class="menu-row ripple" data-act="page" data-v="history">' + I('history') + '<span>Histórico de partidas</span>' + I('right', 'chev') + '</button>' +
        '<button type="button" class="menu-row ripple" data-act="page" data-v="editProfile">' + I('settings') + '<span>Editar perfil</span>' + I('right', 'chev') + '</button>' +
        (S.can('access') ? '<button type="button" class="menu-row admin ripple" data-act="admin" data-v="overview">' + I('crown') + '<span>Painel administrativo</span>' + adminBadge() + I('right', 'chev') + '</button>' : '') +
        (S.can('finance') ? '<button type="button" class="menu-row finance ripple" data-act="admin" data-v="finance">' + I('dollar') + '<span>Painel financeiro</span>' + I('right', 'chev') + '</button>' : '') +
        '<button type="button" class="menu-row ripple" data-act="logout">' + I('logout') + '<span>Sair</span></button></nav>' +
        '<p class="muted small center">Membro desde ' + U.date(m.createdAt).slice(0, 5) + '/' + new Date(m.createdAt).getFullYear() + '</p></section>'
    };
  };
  function adminBadge() {
    const p = S.pendingCounts();
    const n = (S.can('finance') ? p.depositos + p.saques : 0) + p.verificacoes + p.denuncias;
    return n ? '<b class="dot-count">' + n + '</b>' : '';
  }
  actions.page = (el) => app().push(el.dataset.v, {});
  actions.logout = async function () {
    if (!(await U.confirm({ title: 'Sair da conta?', body: 'Você volta para a tela de entrada.', ok: 'Sair', icon: 'logout' }))) return;
    A.logout();
    app().boot();
  };

  pages.editProfile = function () {
    const m = S.me();
    const opt = S.FF_RANKS.map((r) => '<option' + (m.ff.rank === r ? ' selected' : '') + '>' + r + '</option>').join('');
    const lock = m.verified ? ' readonly' : '';
    return {
      html: '<section class="page">' + backRow() + '<h1 class="h1">Editar perfil</h1>' +
        '<form class="form" data-form="profile">' +
        '<h3 class="form-h">Informações básicas</h3>' +
        '<label class="field"><span>Nickname</span><input id="ep-nick" name="nick" maxlength="20" required value="' + esc(m.nick) + '"></label>' +
        '<label class="field"><span>Bio</span><textarea id="ep-bio" name="bio" rows="3" maxlength="140" placeholder="Conte seu estilo de jogo">' + esc(m.bio) + '</textarea></label>' +
        '<label class="field"><span>Região ou servidor</span><input id="ep-region" name="region" maxlength="30" placeholder="Ex.: Brasil" value="' + esc(m.region) + '"></label>' +
        '<h3 class="form-h">' + I('gamepad') + 'Free Fire</h3>' +
        (m.verified ? '<p class="note-green">' + I('badgeCheck') + '<span>Dados confirmados na verificação. Para mudar, fale com a moderação.</span></p>' : '') +
        '<label class="field"><span>ID do Free Fire</span><input id="ep-ffid" name="ffId" inputmode="numeric" maxlength="12" placeholder="Ex.: 123456789" value="' + esc(m.ff.id) + '"' + lock + '></label>' +
        '<label class="field"><span>Nickname no Free Fire</span><input id="ep-ffnick" name="ffNick" maxlength="24" placeholder="Seu nick no jogo" value="' + esc(m.ff.nick) + '"' + lock + '></label>' +
        '<div class="grid2"><label class="field"><span>Level da conta</span><input id="ep-fflv" name="ffLevel" type="number" inputmode="numeric" min="1" max="100" placeholder="Ex.: 65" value="' + esc(m.ff.level) + '"' + lock + '></label>' +
        '<label class="field"><span>Rank atual</span><select id="ep-ffrank" name="ffRank"' + (m.verified ? ' disabled' : '') + '><option value="">Selecione</option>' + opt + '</select></label></div>' +
        '<button class="btn primary block lg">' + I('check') + 'Salvar</button></form></section>'
    };
  };
  forms.profile = function (f) {
    if (U.result(A.updateProfile(Object.fromEntries(new FormData(f).entries())), 'Perfil salvo.')) app().back();
  };

  pages.history = function () {
    const m = S.me();
    const list = S.db.matches.filter((x) => x.userId === m.id).sort((a, b) => b.at - a.at);
    const earned = list.reduce((s, x) => s + x.prize, 0);
    const avg = list.length ? list.reduce((s, x) => s + x.place, 0) / list.length : 0;
    const medal = (p) => p === 1 ? 'gold' : p === 2 ? 'silver' : p === 3 ? 'bronze' : 'slate';
    return {
      html: '<section class="page">' + backRow() + '<h1 class="h1">Histórico de partidas</h1>' +
        '<div class="tiles3 four stagger"><div class="tile"><b>' + list.length + '</b><small>Partidas</small></div><div class="tile"><b>' + (avg ? avg.toFixed(1).replace('.', ',') + 'º' : '–') + '</b><small>Média</small></div><div class="tile"><b>' + list.reduce((s, x) => s + x.kills, 0) + '</b><small>Kills</small></div><div class="tile tone-green"><b>' + U.moneyShort(earned) + '</b><small>Ganhos</small></div></div>' +
        '<ul class="stack stagger">' + (list.length ? list.map((x) => '<li class="match"><span class="medal m-' + medal(x.place) + '">' + x.place + 'º</span><div class="grow"><b>' + esc(x.name) + '</b><small>' + esc(x.mode) + ' · ' + esc(x.map) + ' · ' + U.date(x.at) + '</small></div><div class="match-side"><small>' + I('crosshair') + x.kills + ' kills</small>' + (x.prize ? '<b class="gold">+' + U.money(x.prize) + '</b>' : '<b class="muted">–</b>') + '</div></li>').join('') : '<li>' + U.empty('history', 'Nenhuma partida ainda', 'Inscreva-se em um torneio para começar.') + '</li>') + '</ul></section>'
    };
  };

  /* ---------- carteira ---------- */
  flows.deposit = function (preset) {
    const min = S.db.settings.minDeposit;
    const data = { step: 1, amount: preset || 20, tx: null };
    U.sheet({
      title: 'Adicionar saldo',
      data,
      body: (api) => {
        const d = api.data;
        if (d.step === 1) return '<p class="muted">Escolha o valor. O saldo entra na carteira quando o Pix for confirmado.</p>' +
          '<div class="amounts">' + [10, 20, 50, 100].map((v) => '<button type="button" class="amount ripple' + (d.amount === v ? ' on' : '') + '" data-act="depAmount" data-v="' + v + '">' + U.money(v).replace(',00', '') + '</button>').join('') + '</div>' +
          '<label class="field money-field"><span>Outro valor</span><b>R$</b><input id="dep-amount" type="number" inputmode="decimal" min="' + min + '" max="5000" step="1" value="' + d.amount + '"></label>' +
          '<button type="button" class="btn primary block lg" data-act="depGenerate">' + I('qr') + 'Gerar Pix</button><p class="muted small center">Depósito mínimo: ' + U.money(min) + '</p>';
        if (d.step === 2) return '<div class="pix"><div class="pix-amount"><small>Valor do Pix</small><b>' + U.money(d.tx.amount) + '</b></div>' +
          '<div class="qr-wrap"><canvas id="pix-qr" width="198" height="198" aria-label="QR Code Pix de demonstração"></canvas><span class="qr-scan" aria-hidden="true"></span></div>' +
          '<label class="field"><span>Pix copia e cola</span><div class="copy-line"><input id="pix-code" readonly value="' + esc(d.tx.pixCode) + '"><button type="button" class="btn ghost sm" data-act="pixCopy">' + I('copy') + 'Copiar</button></div></label>' +
          '<p class="note-gold">' + I('info') + '<span>QR de demonstração. Na versão com pagamento real, o Pix é confirmado sozinho. Aqui, quem confirma é o admin no Painel financeiro.</span></p>' +
          '<button type="button" class="btn primary block lg" data-act="depPaid">' + I('check') + 'Já paguei</button></div>';
        return '<div class="done"><span class="done-ic">' + I('clock') + '</span><h3>Depósito em análise</h3><p class="muted">' + U.money(d.tx.amount) + ' entram na carteira assim que o Pix for confirmado. Você recebe uma notificação.</p>' +
          (S.can('finance') ? '<button type="button" class="btn gold block" data-act="admin" data-v="finance">' + I('dollar') + 'Abrir Painel financeiro</button>' : '') +
          '<button type="button" class="btn ghost block" data-close>Fechar</button></div>';
      },
      onMount(api) { const c = api.body.querySelector('#pix-qr'); if (c) U.drawQR(c, api.data.tx.pixCode); }
    });
  };
  actions.deposit = (el) => { U.closeAll(); flows.deposit(el && el.dataset.v ? Number(el.dataset.v) : null); };
  actions.depAmount = (el) => { const s = U.topSheet(); s.data.amount = Number(el.dataset.v); s.render('static'); };
  actions.depGenerate = function () {
    const s = U.topSheet(), v = Number(s.body.querySelector('#dep-amount').value);
    const r = A.requestDeposit(v);
    if (!U.result(r)) return;
    s.data.tx = r.tx; s.data.step = 2; s.render();
  };
  actions.pixCopy = function () { const i = document.getElementById('pix-code'); U.copy(i.value, i); };
  actions.depPaid = function () {
    const s = U.topSheet();
    A.confirmDepositSent(s.data.tx.id);
    s.data.step = 3; s.render();
    app().refresh();
  };

  flows.withdraw = function () {
    const m = S.me(), set = S.db.settings;
    if (!m.verified) {
      U.confirm({ title: 'Verifique sua conta', body: 'O saque só é liberado para contas com o Free Fire verificado. Isso protege seu dinheiro contra golpes.', ok: 'Enviar verificação', icon: 'shieldCheck' }).then((ok) => { if (ok) flows.verify(); });
      return;
    }
    U.sheet({
      title: 'Sacar via Pix',
      body: () => '<div class="pix-amount"><small>Disponível</small><b>' + U.money(m.balance) + '</b></div>' +
        '<form class="form" data-form="withdraw">' +
        '<label class="field money-field"><span>Valor</span><b>R$</b><input id="wd-amount" name="amount" type="number" inputmode="decimal" min="' + set.minWithdraw + '" max="' + Math.min(set.maxWithdraw, m.balance) + '" step="0.01" required placeholder="0,00"><button type="button" class="btn ghost sm" data-act="wdAll">Tudo</button></label>' +
        '<div class="grid2"><label class="field"><span>Tipo de chave</span><select id="wd-type" name="keyType"><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Aleatória</option></select></label>' +
        '<label class="field"><span>Chave Pix</span><input id="wd-key" name="key" required placeholder="Sua chave"></label></div>' +
        '<p class="muted small">Mínimo ' + U.money(set.minWithdraw) + ' · máximo ' + U.money(set.maxWithdraw) + ' por pedido · prazo de até 24 horas.</p>' +
        '<button class="btn primary block lg">' + I('arrowIn') + 'Solicitar saque</button></form>'
    });
  };
  actions.withdraw = () => flows.withdraw();
  actions.wdAll = () => { const i = document.getElementById('wd-amount'); i.value = S.me().balance.toFixed(2); };
  forms.withdraw = function (f) {
    const d = Object.fromEntries(new FormData(f).entries());
    const r = A.requestWithdraw(Number(d.amount), d.keyType, d.key);
    if (!U.result(r, 'Saque solicitado. Prazo de até 24 horas.')) { if (r.code === 'verify') { U.closeAll(); flows.verify(); } return; }
    U.closeAll();
    app().refresh();
  };
  actions.statement = function () {
    const m = S.me();
    U.sheet({
      title: 'Extrato', size: 'lg',
      body: () => {
        const tabs = [{ id: 'tudo', label: 'Tudo' }, { id: 'entradas', label: 'Entradas' }, { id: 'saidas', label: 'Saídas' }];
        let list = S.db.tx.filter((x) => x.userId === m.id).sort((a, b) => b.at - a.at);
        if (st.walletTab === 'entradas') list = list.filter((x) => txSign(x) > 0);
        if (st.walletTab === 'saidas') list = list.filter((x) => txSign(x) < 0);
        return U.seg('wallet', tabs, st.walletTab, 'walletTab') + '<ul class="tx-list full stagger">' + (list.length ? list.map((x) => BH.txRow(x)).join('') : '<li class="muted center pad">Nada por aqui.</li>') + '</ul>';
      }
    });
  };
  actions.walletTab = (el) => { st.walletTab = el.dataset.v; U.topSheet().render('soft'); };

  /* ---------- verificação ---------- */
  flows.verify = function () {
    const m = S.me(), v = S.verificationOf(m.id);
    if (m.verified) return U.toast('Sua conta já está verificada.', 'good');
    if (v && v.status === 'pendente') return U.toast('Sua verificação já está em análise.', 'info');
    const opt = S.FF_RANKS.map((r) => '<option' + (m.ff.rank === r ? ' selected' : '') + '>' + r + '</option>').join('');
    U.sheet({
      title: 'Verificação Free Fire', size: 'lg', data: { image: null },
      body: () => '<ol class="steps"><li>Abra o Free Fire e toque no seu avatar.</li><li>Tire um print em que apareçam <b>ID</b>, <b>level</b> e <b>rank</b>.</li><li>Envie o print e confira os dados abaixo.</li></ol>' +
        '<form class="form" data-form="verify">' +
        '<label class="drop" id="v-drop"><input id="v-file" type="file" accept="image/*"><span class="drop-empty">' + I('image') + '<b>Escolher print</b><small>JPG ou PNG, até 12 MB</small></span><img id="v-prev" alt="Prévia do print" hidden></label>' +
        '<div class="grid2"><label class="field"><span>ID do Free Fire</span><input id="v-id" name="id" inputmode="numeric" maxlength="12" required placeholder="123456789" value="' + esc(m.ff.id) + '"></label>' +
        '<label class="field"><span>Level</span><input id="v-lv" name="level" type="number" inputmode="numeric" min="1" max="100" required placeholder="65" value="' + esc(m.ff.level) + '"></label></div>' +
        '<div class="grid2"><label class="field"><span>Nick no jogo</span><input id="v-nick" name="nick" maxlength="24" required placeholder="Seu nick" value="' + esc(m.ff.nick) + '"></label>' +
        '<label class="field"><span>Rank atual</span><select id="v-rank" name="rank" required><option value="">Selecione</option>' + opt + '</select></label></div>' +
        '<button class="btn primary block lg">' + I('upload') + 'Enviar para análise</button></form>',
      onMount(api) {
        const file = api.body.querySelector('#v-file'), prev = api.body.querySelector('#v-prev'), drop = api.body.querySelector('#v-drop');
        const take = (f) => U.readImage(f, 900).then((url) => { api.data.image = url; prev.src = url; prev.hidden = false; drop.classList.add('has'); }).catch((e) => U.toast(e.message, 'bad'));
        file.addEventListener('change', () => file.files[0] && take(file.files[0]));
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
      }
    });
  };
  actions.verify = () => flows.verify();
  forms.verify = function (f) {
    const s = U.topSheet();
    const r = A.submitVerification(s.data.image, Object.fromEntries(new FormData(f).entries()));
    if (!U.result(r, 'Print enviado. A análise leva até 24 horas.')) return;
    s.close(true);
    app().refresh();
  };

  /* ---------- personalização ---------- */
  actions.look = function () {
    U.sheet({
      title: 'Personalização', size: 'lg',
      body: () => {
        const m = S.me();
        const tabs = [{ id: 'avatar', label: 'Avatares' }, { id: 'banner', label: 'Banners' }];
        const list = st.lookTab === 'avatar' ? S.AVATARS : S.BANNERS;
        return U.seg('look', tabs, st.lookTab, 'lookTab') + '<ul class="looks stagger">' + list.map((x) => {
          const ok = x.ok(m), on = m[st.lookTab] === x.id;
          const pic = st.lookTab === 'avatar'
            ? '<span class="av av-md" style="--a1:' + x.grad[0] + ';--a2:' + x.grad[1] + '">' + I(x.icon) + '</span>'
            : '<span class="banner-sw" style="background:' + x.bg + '"></span>';
          return '<li><button type="button" class="look' + (on ? ' on' : '') + (ok ? '' : ' locked') + ' ' + st.lookTab + ' ripple" data-act="setLook" data-v="' + x.id + '"' + (ok ? '' : ' aria-disabled="true"') + '>' + pic +
            '<span class="look-t"><b>' + esc(x.name) + (on ? I('check', 'violet') : '') + '</b><small>' + esc(x.req) + '</small></span>' + (ok ? '' : I('lock', 'look-lock')) + '</button></li>';
        }).join('') + '</ul>';
      }
    });
  };
  actions.lookTab = (el) => { st.lookTab = el.dataset.v; U.topSheet().render('soft'); };
  actions.setLook = function (el) {
    const r = A.setLook(st.lookTab, el.dataset.v);
    if (!r.ok) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return U.toast(r.error + ' Requisito: ' + (st.lookTab === 'avatar' ? S.AVATARS : S.BANNERS).find((x) => x.id === el.dataset.v).req + '.', 'bad'); }
    U.topSheet().render('static');
    app().refresh();
    BH.app.header();
  };

  /* ---------- perfil público ---------- */
  actions.player = function (el) {
    const id = el.dataset.id;
    if (!id) return;
    const me = S.me();
    if (id === me.id) { U.closeAll(); return app().go('perfil'); }
    U.sheet({
      title: 'Perfil do jogador',
      body: () => {
        const u = S.user(id); if (!u) return U.empty('user', 'Conta não encontrada', '');
        const following = me.following.includes(u.id), gd = S.guild(u.guildId);
        return '<div class="pp"><div class="pp-banner" style="background:' + U.banner(u) + '"><span class="p-pattern"></span></div>' + U.avatar(u, 'lg', 'pop') +
          '<h3>' + esc(u.nick) + U.verified(u) + '</h3><div class="p-badges">' + U.tier(u.elo, true) + U.role(u) + (gd ? '<span class="tag tone-violet">' + I('shield') + esc(gd.tag) + '</span>' : '') + '</div>' +
          (u.bio ? '<p class="p-bio">' + esc(u.bio) + '</p>' : '') +
          '<div class="tiles3 four"><div class="tile"><b>' + U.int(u.stats.wins) + '</b><small>Vitórias</small></div><div class="tile"><b>' + U.int(u.stats.kills) + '</b><small>Kills</small></div><div class="tile"><b>' + U.int(S.followers(u)) + '</b><small>Seguidores</small></div><div class="tile"><b>' + u.reputation + '%</b><small>Reputação</small></div></div>' +
          (u.banned ? '<p class="note-red">' + I('ban') + '<span>Conta banida.</span></p>' :
            '<div class="btn-row two"><button type="button" class="btn ' + (following ? 'ghost' : 'primary') + '" data-act="follow" data-id="' + u.id + '">' + I(following ? 'userCheck' : 'userPlus') + (following ? 'Seguindo' : 'Seguir') + '</button><button type="button" class="btn outline" data-act="dm" data-id="' + u.id + '">' + I('message') + 'Mensagem</button></div>') +
          '<div class="btn-row two">' + (S.can('users') ? '<button type="button" class="btn gold sm" data-act="aUser" data-id="' + u.id + '">' + I('crown') + 'Gerenciar conta</button>' : '') + '<button type="button" class="btn danger-ghost sm" data-act="report" data-id="' + u.id + '">' + I('flag') + 'Denunciar</button></div></div>';
      }
    });
  };
  actions.follow = function (el) {
    const r = A.follow(el.dataset.id);
    if (!U.result(r)) return;
    U.toast(r.following ? 'Você agora segue esse jogador.' : 'Você deixou de seguir.', 'good');
    U.topSheet() && U.topSheet().render('static');
  };
  actions.report = function (el) {
    const u = S.user(el.dataset.id);
    U.sheet({
      title: 'Denunciar ' + u.nick,
      body: () => '<form class="form" data-form="report" data-id="' + u.id + '"><p class="muted">A moderação analisa em até 24 horas. Denúncias falsas geram punição.</p>' +
        '<div class="radio-list">' + ['Suspeita de hack', 'Ofensa no chat', 'Cobrança por fora', 'Conta fake', 'Outro'].map((r, i) => '<label class="radio"><input type="radio" name="reason" value="' + r + '"' + (i === 0 ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>' +
        '<label class="field"><span>O que aconteceu?</span><textarea id="rp-detail" name="detail" rows="3" maxlength="300" placeholder="Torneio, horário e o que você viu"></textarea></label>' +
        '<button class="btn danger block lg">' + I('flag') + 'Enviar denúncia</button></form>'
    });
  };
  forms.report = function (f) {
    const d = Object.fromEntries(new FormData(f).entries());
    if (!U.result(A.report(f.dataset.id, d.reason, d.detail), 'Denúncia enviada para a moderação.')) return;
    U.closeAll();
  };

  /* ---------- notificações ---------- */
  actions.notifications = function () {
    const m = S.me();
    const list = S.db.notifications.filter((n) => n.userId === m.id).slice(0, 40);
    const unreadIds = new Set(list.filter((n) => !n.read).map((n) => n.id));
    U.sheet({
      title: 'Notificações',
      body: () => '<ul class="notif-list stagger">' + (list.length ? list.map((n) => '<li class="' + (unreadIds.has(n.id) ? 'unread' : '') + '"><span class="n-ic tone-' + (n.tone || 'violet') + '">' + I(n.icon || 'bell') + '</span><div><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p><small data-ago="' + n.at + '">' + U.ago(n.at) + '</small></div></li>').join('') : '<li>' + U.empty('bell', 'Tudo em dia', 'Nenhuma notificação por enquanto.') + '</li>') + '</ul>',
      onClose() { BH.app.header(); }
    });
    A.readNotifications();
    BH.app.header();
  };
  actions.pinned = function () {
    const a = S.db.announcements.find((x) => x.pinned); if (!a) return;
    U.confirm({ title: a.title, body: esc(a.body), ok: 'Entendi', cancel: 'Fechar', icon: 'megaphone' });
  };

  /* ================= ENTRAR ================= */
  pages.login = function () {
    return {
      hideNav: true, bare: true,
      html: '<section class="login">' +
        '<div class="login-bg" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '<div class="login-card">' +
        '<div class="login-logo">' + BH.logo('xl') + '</div>' +
        '<p class="login-tag">Torneios de Free Fire com premiação via Pix, ranking e guildas.</p>' +
        U.seg('auth', [{ id: 'entrar', label: 'Entrar' }, { id: 'criar', label: 'Criar conta' }], st.auth || 'entrar', 'authTab') +
        (st.auth === 'criar'
          ? '<form class="form" data-form="register"><label class="field"><span>Nickname</span><input id="rg-nick" name="nick" maxlength="20" required placeholder="Como te chamam no jogo"></label>' +
            '<label class="field"><span>E-mail</span><input id="rg-email" name="email" type="email" required placeholder="voce@email.com" autocomplete="email"></label>' +
            '<label class="field"><span>Senha</span><input id="rg-pass" name="pass" type="password" minlength="6" required placeholder="Mínimo de 6 caracteres" autocomplete="new-password"></label>' +
            '<button class="btn primary block lg">' + I('userPlus') + 'Criar conta</button></form>'
          : '<form class="form" data-form="login"><label class="field"><span>E-mail ou nickname</span><input id="lg-user" name="user" required placeholder="voce@email.com" autocomplete="username"></label>' +
            '<label class="field"><span>Senha</span><input id="lg-pass" name="pass" type="password" minlength="6" required placeholder="Sua senha" autocomplete="current-password"></label>' +
            '<button class="btn primary block lg">' + I('login') + 'Entrar</button></form>') +
        '<div class="demo"><p>Contas de demonstração (qualquer senha com 6 caracteres)</p><div class="btn-row two">' +
        '<button type="button" class="btn outline sm" data-act="demoLogin" data-v="shadowlock@battlehub.gg">' + I('crown') + 'Dono · SHADOW lock</button>' +
        '<button type="button" class="btn ghost sm" data-act="demoLogin" data-v="luna.ff">' + I('user') + 'Jogadora · Luna.ff</button></div></div>' +
        '</div></section>'
    };
  };
  actions.authTab = (el) => { st.auth = el.dataset.v; app().rerender('soft'); };
  forms.login = function (f) {
    const d = Object.fromEntries(new FormData(f).entries());
    if ((d.pass || '').length < 6) return U.toast('A senha precisa ter pelo menos 6 caracteres.', 'bad');
    const r = A.login(d.user);
    if (!U.result(r)) return;
    U.toast('Bem-vindo de volta, ' + r.user.nick + '.', 'good');
    app().boot();
  };
  forms.register = function (f) {
    const d = Object.fromEntries(new FormData(f).entries());
    if ((d.pass || '').length < 6) return U.toast('A senha precisa ter pelo menos 6 caracteres.', 'bad');
    const r = A.register(d.nick, d.email);
    if (!U.result(r)) return;
    U.toast('Conta criada. Bem-vindo ao BattleHub!', 'good');
    app().boot();
    U.confetti();
  };
  actions.demoLogin = function (el) {
    const r = A.login(el.dataset.v === 'luna.ff' ? 'Luna.ff' : el.dataset.v);
    if (!U.result(r)) return;
    U.toast('Entrou como ' + r.user.nick + '.', 'good');
    app().boot();
  };

  pages.maintenance = function () {
    return {
      hideNav: true,
      html: '<section class="page">' + U.empty('wrench', 'Estamos em manutenção', 'Voltamos em instantes. Seus torneios e seu saldo estão seguros.', '<button type="button" class="btn ghost" data-act="logout">Sair da conta</button>') + '</section>'
    };
  };
})();
