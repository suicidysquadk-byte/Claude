/* Início, lista de salas e a sala (inscrição, cofre, roleta, resultado e chat) */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, flows = BH.flows, st = BH.state;
  const app = () => BH.app;
  st.roomTab = st.roomTab || 'abertas';
  st.roomQ = st.roomQ || '';

  const MECH = {
    first_blood: { icon: 'droplet', short: 'Primeiro abate' },
    rei: { icon: 'crown', short: 'Player Rei' },
    por_kill: { icon: 'crosshair', short: 'Por abate' },
    mvp: { icon: 'trophy', short: 'MVP' },
    sorteio: { icon: 'dice', short: 'Sorteio' }
  };
  const mechInfo = (id) => ((api.me && api.me.mechanics) || []).find((m) => m.id === id) || { id, name: (MECH[id] || {}).short || id, description: '' };
  const TEAM = { 1: 'Solo', 2: 'Dupla', 4: 'Squad' };
  const MODES = ['Battle Royale', 'Contra Squad', 'X1', 'Personalizado'];
  const MAPS = ['Bermuda', 'Purgatório', 'Kalahari', 'Alpine', 'Nova Terra', 'Bermuda Remasterizada'];
  BH.MECH = MECH;

  function statusTag(r) {
    if (r.status === 'em_andamento') return '<span class="live"><i></i>Ao vivo</span>';
    if (r.status === 'finalizada') return '<span class="tag tone-muted">' + I('flag') + 'Finalizada</span>';
    if (r.status === 'cancelada') return '<span class="tag tone-red">' + I('ban') + 'Cancelada</span>';
    if (r.players >= r.max_players) return '<span class="tag tone-gold">' + I('users') + 'Lotada · fila</span>';
    return '<span class="tag tone-green">' + I('zap') + 'Inscrições abertas</span>';
  }
  const mechChips = (list) => (list || []).map((m) => '<span class="mech-chip" title="' + esc(mechInfo(m.type).name) + '">' + I((MECH[m.type] || {}).icon || 'star') + esc((MECH[m.type] || {}).short || m.type) + ' <b>' + U.centsShort(m.cents) + '</b></span>').join('');
  function roomCard(r) {
    const full = r.players >= r.max_players;
    return '<article class="room-card ripple' + (r.featured ? ' featured' : '') + '" data-act="openRoom" data-id="' + r.id + '" tabindex="0">' +
      '<header><span class="room-code">#' + r.code + '</span>' + statusTag(r) + (r.joined ? '<span class="tag tone-violet">' + I('check') + 'Inscrito</span>' : r.in_waitlist ? '<span class="tag tone-gold">Na fila</span>' : '') + (r.is_creator ? '<span class="tag tone-cyan">Sua sala</span>' : '') + '</header>' +
      '<h4>' + esc(r.title) + '</h4>' +
      '<p class="room-host">' + U.av(r.creator, 'xs') + U.nick(r.creator) + '<span>· ' + esc(r.mode) + ' · ' + (TEAM[r.team_size] || '') + ' · ' + esc(r.map) + '</span></p>' +
      '<div class="room-money"><div><small>Premiação</small><b class="gold">' + U.cents(r.prize_cents) + '</b></div><div><small>Inscrição</small><b>' + (r.entry_cents ? U.cents(r.entry_cents) : 'Grátis') + '</b></div></div>' +
      (r.mechanics && r.mechanics.length ? '<div class="mech-row">' + mechChips(r.mechanics) + '</div>' : '') +
      '<div class="room-foot"><span class="' + (full ? 'gold' : '') + '">' + I('users') + r.players + '/' + r.max_players + '</span>' + U.bar(r.players / r.max_players, full ? 'gold' : '') +
      (r.status === 'aberta' ? '<span class="mono" data-until="' + new Date(r.starts_at).getTime() + '">' + U.until(r.starts_at) + '</span>' : '<span>' + U.date(r.finished_at || r.started_at || r.starts_at) + '</span>') + '</div></article>';
  }
  BH.roomCard = roomCard;

  /* ================= INÍCIO ================= */
  pages.home = async function () {
    const me = api.me;
    const [h, rooms] = await Promise.all([api.rpc('home'), api.rpc('list_rooms', { p_tab: st.roomTab, p_q: st.roomQ || null })]);
    const tabs = [{ id: 'abertas', label: 'Abertas' }, { id: 'ao_vivo', label: 'Ao vivo', badge: h.live || 0 }, { id: 'minhas', label: 'Minhas' }, { id: 'encerradas', label: 'Encerradas' }];
    const hour = new Date().getHours();
    const greet = hour < 5 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const xpPct = (me.xp - me.xp_level) / Math.max(1, me.xp_next - me.xp_level);
    return {
      html: '<section class="page home">' +
        (me.pinned ? '<button type="button" class="notice ripple" data-act="pinned">' + I('megaphone') + '<span><b>' + esc(me.pinned.title) + '</b>' + esc(me.pinned.body) + '</span></button>' : '') +
        '<div class="hello"><div><p class="eyebrow">' + greet + '</p><h1 class="h1">' + esc(me.nick) + '</h1></div>' +
        '<button type="button" class="lvl-chip ripple" data-act="track"><span class="lvl-n">' + me.level + '</span><span class="lvl-bar">' + U.bar(xpPct, 'elo') + '<small>' + U.int(me.xp - me.xp_level) + '/' + U.int(me.xp_next - me.xp_level) + ' XP</small></span></button></div>' +
        (me.ff.status !== 'aprovado' ? '<button type="button" class="notice warn ripple" data-act="ffSheet">' + I(me.ff.status === 'recusado' ? 'alert' : 'clock') + '<span><b>' + (me.ff.status === 'recusado' ? 'Seu print foi recusado' : 'ID do Free Fire em análise') + '</b>' + (me.ff.status === 'recusado' ? esc(me.ff.note || 'Envie outro print.') : 'Você já pode ver as salas. Saques liberam depois da verificação.') + '</span></button>' : '') +
        '<div class="stat-row stagger">' +
        '<div class="stat"><span class="stat-ic tone-red">' + I('radio') + '</span>' + U.num(h.live) + '<small>Ao vivo</small></div>' +
        '<div class="stat"><span class="stat-ic tone-violet">' + I('trophy') + '</span>' + U.num(h.open) + '<small>Salas abertas</small></div>' +
        '<div class="stat"><span class="stat-ic tone-gold">' + I('dollar') + '</span>' + U.num(Math.round(h.prize_cents / 100)) + '<small>Em prêmios (R$)</small></div></div>' +
        (h.mine.length ? '<section class="sect"><header class="sec-head"><h3>Suas salas</h3></header><div class="rail stagger">' + h.mine.map((r) => '<div class="rail-item">' + roomCard(r) + '</div>').join('') + '</div></section>' : '') +
        (h.payouts.length ? '<section class="sect"><header class="sec-head"><h3>Pagamentos recentes</h3><span class="muted small">' + U.cents(h.paid_week_cents) + ' em 7 dias</span></header><ul class="payouts stagger">' +
          h.payouts.map((p) => '<li>' + U.av(p.user, 'sm') + '<div class="grow"><b>' + esc(p.user.nick) + '</b><small>Sala #' + p.room_code + ' · ' + esc(p.room_title) + ' · <span data-ago="' + p.at + '">' + U.ago(p.at) + '</span></small></div><b class="pos">+' + U.cents(p.cents) + '</b></li>').join('') + '</ul></section>' : '') +
        '<section class="sect"><header class="page-head"><div><h2 class="h2">Salas</h2><p class="muted small">Criadas pelos organizadores da comunidade</p></div>' +
        (me.can_create_rooms ? '<button type="button" class="fab ripple" data-act="createRoom" aria-label="Criar sala">' + I('plus') + '</button>' : '') + '</header>' +
        U.seg('rooms', tabs, st.roomTab, 'roomTab') +
        '<label class="search">' + I('search') + '<input id="r-search" type="search" placeholder="Buscar por nome, número, mapa ou organizador" value="' + esc(st.roomQ) + '" data-input="roomQ" autocomplete="off"></label>' +
        '<div class="stack stagger">' + (rooms.length ? rooms.map(roomCard).join('') : U.empty('trophy', st.roomTab === 'minhas' ? 'Você ainda não entrou em salas' : 'Nenhuma sala aqui agora', me.can_create_rooms ? 'Crie a primeira no botão +.' : 'Novas salas aparecem aqui assim que os organizadores criarem.')) + '</div></section>' +
        '</section>'
    };
  };
  actions.roomTab = (el) => { st.roomTab = el.dataset.v; app().rerender('soft'); };
  actions.openRoom = (el) => app().push('room', { id: el.dataset.id });
  actions.pinned = () => { const a = api.me.pinned; if (a) U.confirm({ title: a.title, body: esc(a.body), ok: 'Entendi', cancel: 'Fechar', icon: 'megaphone' }); };

  /* ================= SALA ================= */
  pages.room = async function (p) {
    const [r, chat] = await Promise.all([api.rpc('get_room', { p_id: p.id }), api.rpc('room_chat', { p_room: p.id, p_after: 0 })]);
    const me = api.me;
    const full = r.players >= r.max_players;
    const vaultOk = r.vault_cents >= r.commitment_cents;
    const res = r.results;
    const byUser = {};
    if (res) (res.lines || []).forEach((l) => { (byUser[l.user_id] = byUser[l.user_id] || []).push(l); });
    let cta = '';
    if (r.status === 'aberta' && !r.is_creator) {
      if (r.joined) cta = '<div class="cta-bar"><div><small>Você está inscrito</small><b class="green">' + I('checkCircle') + 'Vaga garantida</b></div><button type="button" class="btn ghost" data-act="leaveRoom" data-id="' + r.id + '">Sair</button></div>';
      else if (r.in_waitlist) cta = '<div class="cta-bar"><div><small>Fila de espera</small><b class="gold">' + r.waitlist_pos + 'º da fila</b></div><button type="button" class="btn ghost" data-act="leaveRoom" data-id="' + r.id + '">Sair da fila</button></div>';
      else cta = '<div class="cta-bar"><div><small>' + (full ? 'Sala lotada' : 'Inscrição') + '</small><b>' + (r.entry_cents ? U.cents(r.entry_cents) : 'Grátis') + '</b></div><button type="button" class="btn primary" data-act="joinRoom" data-id="' + r.id + '">' + I(full ? 'clock' : 'zap') + (full ? 'Entrar na fila' : 'Inscrever-se') + '</button></div>';
    }
    const secrets = r.secrets && r.secrets.game_room_id
      ? '<div class="room-card-secret"><span class="live"><i></i>Sala liberada</span><div class="room-grid"><div><small>ID da sala</small><b class="mono">' + esc(r.secrets.game_room_id) + '</b></div><div><small>Senha</small><b class="mono">' + esc(r.secrets.password) + '</b></div></div><button type="button" class="btn ghost sm" data-act="copy" data-v="' + esc(r.secrets.game_room_id) + '">' + I('copy') + 'Copiar ID</button></div>'
      : (r.status === 'em_andamento' && !r.joined && !r.can_manage ? '<div class="room-card-secret locked">' + I('lock') + '<span>O ID e a senha aparecem só para os inscritos.</span></div>' : '');
    const manage = r.can_manage && (r.status === 'aberta' || r.status === 'em_andamento')
      ? '<section class="card manage"><h3 class="card-h">' + I('sliders') + 'Painel do organizador</h3>' +
        '<div class="vault ' + (vaultOk ? 'ok' : 'low') + '"><span class="vault-ic">' + I('vault') + '</span><div class="grow"><small>Cofre da sala</small><b>' + U.cents(r.vault_cents) + '</b><span>A sala promete até ' + U.cents(r.commitment_cents) + ' com ' + Math.max(r.players, 2) + ' jogadores' + (r.guarantee_cents ? ' · garantia ' + U.cents(r.guarantee_cents) : '') + '</span></div>' +
        (r.is_creator ? '<button type="button" class="btn ghost sm" data-act="roomGuarantee" data-id="' + r.id + '">' + I('plus') + 'Garantia</button>' : '') + '</div>' +
        (!vaultOk ? '<p class="note-gold">' + I('info') + '<span>O cofre ainda não cobre a premiação. A sala só começa quando cobrir: espere mais inscritos, coloque garantia ou diminua os prêmios.</span></p>' : '') +
        '<div class="btn-row">' +
        (r.status === 'aberta' ? '<button type="button" class="btn primary sm" data-act="roomStart" data-id="' + r.id + '">' + I('play') + 'Iniciar sala</button>' : '<button type="button" class="btn gold sm" data-act="roomResults" data-id="' + r.id + '">' + I('flag') + 'Lançar resultado</button>') +
        (r.mechanics.some((m) => m.type === 'rei') && !r.king ? '<button type="button" class="btn outline sm" data-act="roomDraw" data-kind="rei" data-id="' + r.id + '">' + I('crown') + 'Sortear Player Rei</button>' : '') +
        (r.mechanics.some((m) => m.type === 'sorteio') && !r.lucky ? '<button type="button" class="btn outline sm" data-act="roomDraw" data-kind="sorteio" data-id="' + r.id + '">' + I('dice') + 'Girar sorteio</button>' : '') +
        (r.status === 'aberta' ? '<button type="button" class="btn ghost sm" data-act="roomEdit" data-id="' + r.id + '">' + I('edit') + 'Editar</button>' : '') +
        '<button type="button" class="btn danger-ghost sm" data-act="roomCancel" data-id="' + r.id + '">' + I('ban') + 'Cancelar</button></div>' +
        (r.waitlist_list && r.waitlist_list.length ? '<div class="waitlist"><small>Fila de espera (' + r.waitlist_list.length + ')</small><div class="wl-row">' + r.waitlist_list.map((w) => '<span class="wl-item" title="' + esc(w.nick) + '">' + U.av(w, 'xs') + (w.priority ? '<i class="prio">' + I('zap') + '</i>' : '') + '</span>').join('') + '</div></div>' : '') +
        '</section>'
      : '';
    const special = (r.king || r.lucky) ? '<div class="specials">' +
      (r.king ? '<div class="special king"><span>' + I('crown') + '</span>' + U.av(r.king, 'md') + '<div><small>Player Rei</small><b>' + esc(r.king.nick) + '</b><em>' + U.cents((r.mechanics.find((m) => m.type === 'rei') || {}).cents) + ' para quem eliminar</em></div></div>' : '') +
      (r.lucky ? '<div class="special lucky"><span>' + I('dice') + '</span>' + U.av(r.lucky, 'md') + '<div><small>Sorteado</small><b>' + esc(r.lucky.nick) + '</b><em>Leva ' + U.cents((r.mechanics.find((m) => m.type === 'sorteio') || {}).cents) + ' no fim</em></div></div>' : '') + '</div>' : '';

    const playersHtml = r.player_list.length ? '<ul class="plist stagger">' + r.player_list.map((u) => {
      const lines = byUser[u.id] || [];
      return '<li><button type="button" class="prow ripple" data-act="roomPlayer" data-id="' + u.id + '" data-room="' + r.id + '">' +
        (res ? '<span class="medal m-' + (u.placement === 1 ? 'gold' : u.placement === 2 ? 'silver' : u.placement === 3 ? 'bronze' : 'slate') + '">' + (u.placement ? u.placement + 'º' : '–') + '</span>' : '') +
        U.av(u, 'sm') + '<div class="grow"><span class="prow-name">' + U.nick(u, { level: true }) + (r.king && r.king.id === u.id ? '<span class="tag tone-gold">' + I('crown') + 'Rei</span>' : '') + '</span>' +
        '<small>' + (u.ff_nick ? esc(u.ff_nick) : '') + (u.ff_id ? ' · ID ' + esc(u.ff_id) : '') + (res ? ' · ' + U.plural(u.kills, 'abate', 'abates') + (u.survival_min ? ' · ' + u.survival_min + ' min' : '') : '') + '</small></div>' +
        (res ? '<div class="prow-side">' + (u.earned_cents ? '<b class="pos">+' + U.cents(u.earned_cents) + '</b>' : '') + '<small>+' + u.xp_earned + ' XP</small></div>' : (u.ff_verified ? '' : '<span class="tag tone-muted" title="ID não verificado">ID ' + I('clock') + '</span>')) +
        '</button>' + (res && lines.length ? '<div class="prow-lines">' + lines.map((l) => '<span>' + I((MECH[l.kind] || { icon: 'trophy' }).icon) + esc(l.note) + ' <b>' + U.cents(l.cents) + '</b></span>').join('') + '</div>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="muted center pad">Nenhum inscrito ainda.</p>';

    const canChat = r.joined || r.can_manage;
    return {
      subKey: 'room:' + r.id,
      subscribe: () => { const ch = api.listenRoom(r.id, () => app().refreshSoon()); return () => api.unlisten(ch); },
      html: '<section class="page room-page">' + BH.backRow() +
        '<header class="room-hero"><div class="t-tags"><span class="room-code">Sala #' + r.code + '</span>' + statusTag(r) + '</div>' +
        '<h1 class="h1">' + esc(r.title) + '</h1>' +
        '<button type="button" class="room-host ripple" data-act="profile" data-id="' + (r.creator.id || '') + '">' + U.av(r.creator, 'xs') + '<span>Organizador ' + U.nick(r.creator) + '</span></button>' +
        '<div class="tiles3 four stagger"><div class="tile"><span>' + I('users') + '</span><b>' + r.players + '/' + r.max_players + '</b><small>Jogadores</small></div>' +
        '<div class="tile"><span>' + I('coins') + '</span><b>' + (r.entry_cents ? U.centsShort(r.entry_cents) : 'Grátis') + '</b><small>Inscrição</small></div>' +
        '<div class="tile tone-gold"><span>' + I('trophy') + '</span><b>' + U.centsShort(r.prize_cents) + '</b><small>Premiação</small></div>' +
        '<div class="tile"><span>' + I('gamepad') + '</span><b>' + (TEAM[r.team_size] || '') + '</b><small>' + esc(r.map) + '</small></div></div>' +
        (r.status === 'aberta' ? '<div class="t-count"><span>' + (new Date(r.starts_at) > new Date() ? 'Começa em' : 'Aguardando o organizador') + '</span><strong class="mono" data-until="' + new Date(r.starts_at).getTime() + '">' + U.until(r.starts_at) + '</strong></div>' : '') +
        (r.status === 'cancelada' ? '<p class="t-cancel">' + I('alert') + 'Cancelada: ' + esc(r.cancel_reason || '') + '. As inscrições foram devolvidas.</p>' : '') + '</header>' +
        secrets + cta + special + manage +
        (res ? '<section class="card result-card"><h3 class="card-h">' + I('trophy') + 'Resultado</h3><div class="tiles3"><div class="tile tone-green"><b>' + U.centsShort(res.payout_cents) + '</b><small>Pago em prêmios</small></div><div class="tile"><b>' + U.centsShort(res.creator_cents) + '</b><small>Organizador</small></div><div class="tile"><b>' + U.centsShort(res.fee_cents) + '</b><small>Taxa</small></div></div></section>' : '') +
        '<section class="card"><h3 class="card-h">' + I('trophy') + 'Premiação</h3><ol class="split">' +
        (r.prizes.length ? r.prizes.map((z) => '<li><span class="medal m-' + (z.place === 1 ? 'gold' : z.place === 2 ? 'silver' : z.place === 3 ? 'bronze' : 'slate') + '">' + z.place + 'º</span><span class="grow">' + (r.team_size > 1 ? 'Dividido entre o time' : 'Colocação') + '</span><b>' + U.cents(z.cents) + '</b></li>').join('') : '<li class="muted">Sem prêmio por colocação.</li>') + '</ol>' +
        (r.mechanics.length ? '<h4 class="sub-h">Mecânicas da sala</h4><ul class="mech-list">' + r.mechanics.map((m) => { const info = mechInfo(m.type); return '<li><span class="mech-ic">' + I((MECH[m.type] || {}).icon || 'star') + '</span><div class="grow"><b>' + esc(info.name) + '</b><small>' + esc(info.description) + '</small></div><b class="gold">' + U.cents(m.cents) + (m.type === 'por_kill' ? '<small>/abate</small>' : '') + '</b></li>'; }).join('') + '</ul>' : '') +
        '<p class="note-gold">' + I('vault') + '<span>As inscrições ficam no cofre da sala até o fim. Prêmios caem na carteira dos vencedores assim que o organizador confirma o resultado; a sobra vai para o organizador' + (r.fee_pct > 0 ? ' (taxa da plataforma de ' + r.fee_pct + '% sobre a sobra)' : '') + '.</span></p></section>' +
        '<section class="card"><h3 class="card-h">' + I('users') + 'Jogadores <span class="muted">(' + r.players + ')</span></h3>' + playersHtml + '</section>' +
        '<section class="card chat-card"><h3 class="card-h">' + I('message') + 'Chat da sala' + (r.status === 'em_andamento' ? '<span class="dot-on"></span>' : '') + '</h3>' +
        '<div class="t-chat" id="r-chat">' + (chat.length ? chat.map((m) => '<div class="t-msg' + (m.sender.id === me.id ? ' me' : '') + '">' + U.av(m.sender, 'xs') + '<div><b>' + esc(m.sender.nick) + (m.is_host ? '<span class="tag tone-cyan">Organizador</span>' : '') + '</b>' + (m.body ? '<p>' + esc(m.body) + '</p>' : '') + (m.image_url ? '<button type="button" class="msg-img" data-act="viewImage" data-v="' + esc(m.image_url) + '"><img src="' + esc(m.image_url) + '" alt="Foto enviada" loading="lazy"></button>' : '') + '<small>' + U.hm(m.created_at) + '</small></div></div>').join('') : '<p class="muted center pad">Nenhuma mensagem ainda.</p>') + '</div>' +
        (canChat && r.status !== 'cancelada' && r.status !== 'finalizada' ? '<form class="composer" data-form="roomChat" data-id="' + r.id + '"><label class="attach ripple" aria-label="Enviar foto">' + I('camera') + '<input type="file" accept="image/*" data-send="room" data-id="' + r.id + '"></label><input id="rc-input" name="text" placeholder="Mensagem para a sala" maxlength="1000" autocomplete="off"><button class="send ripple" aria-label="Enviar">' + I('send') + '</button></form>' : '<p class="locked-line">' + I('lock') + (r.status === 'finalizada' ? 'Sala encerrada.' : 'Inscreva-se para falar no chat.') + '</p>') + '</section>' +
        (r.rules ? '<section class="card"><h3 class="card-h">' + I('file') + 'Regras</h3><p class="rules">' + esc(r.rules) + '</p></section>' : '') +
        '</section>',
      onMount(root) { const c = root.querySelector('#r-chat'); if (c) c.scrollTop = c.scrollHeight; }
    };
  };

  /* inscrição */
  actions.joinRoom = async function (el) {
    const [r] = await Promise.all([api.rpc('get_room', { p_id: el.dataset.id }), api.refreshMe()]);
    const me = api.me;
    const full = r.players >= r.max_players;
    const after = me.balance_cents - r.entry_cents;
    U.sheet({
      title: full ? 'Entrar na fila' : 'Confirmar inscrição', loading: false,
      body: '<div class="confirm-t"><h3>' + esc(r.title) + '</h3><p class="muted">Sala #' + r.code + ' · ' + esc(r.mode) + ' · ' + U.when(r.starts_at) + '</p></div>' +
        (full ? '<p class="note-gold">' + I('clock') + '<span>A sala está lotada. Se alguém sair, você entra na hora e a inscrição é cobrada nesse momento.' + (me.priority ? ' Você tem prioridade na fila.' : ' Com o item Prioridade na fila (loja) você passa na frente.') + '</span></p>' : '') +
        '<dl class="ledger"><div><dt>Inscrição</dt><dd>' + (r.entry_cents ? U.cents(r.entry_cents) : 'Grátis') + '</dd></div><div><dt>Seu saldo</dt><dd>' + U.cents(me.balance_cents) + '</dd></div>' + (full ? '' : '<div class="total"><dt>Saldo depois</dt><dd class="' + (after < 0 ? 'red' : '') + '">' + U.cents(after) + '</dd></div>') + '</dl>' +
        (after < 0 && !full ? '<p class="note-red">' + I('alert') + '<span>Faltam ' + U.cents(-after) + '. Adicione saldo para se inscrever.</span></p><button type="button" class="btn primary block lg" data-act="deposit" data-v="' + Math.max(me.settings.min_deposit_cents, -after) + '">' + I('plus') + 'Adicionar saldo</button>'
          : '<button type="button" class="btn primary block lg" data-act="joinConfirm" data-id="' + r.id + '">' + I(full ? 'clock' : 'zap') + (full ? 'Entrar na fila' : 'Confirmar inscrição') + '</button><p class="muted small center">Você pode sair enquanto as inscrições estiverem abertas e recebe o valor de volta.</p>')
    });
  };
  actions.joinConfirm = async function (el) {
    const r = await U.run(el, () => api.rpc('join_room', { p_id: el.dataset.id }));
    if (!r) return;
    U.closeAll();
    if (r.status === 'fila') U.toast('Você entrou na fila: ' + r.position + 'º lugar.', 'info');
    else { const b = el.getBoundingClientRect(); U.confetti(b.left + b.width / 2, b.top); U.toast('Inscrição confirmada. Boa sorte!', 'good'); }
    await api.refreshMe();
    app().refresh();
  };
  actions.leaveRoom = async function (el) {
    if (!(await U.confirm({ title: 'Sair da sala?', body: 'Se você pagou inscrição, o valor volta para a carteira.', ok: 'Sair', danger: true }))) return;
    if (await U.run(el, () => api.rpc('leave_room', { p_id: el.dataset.id }), 'Você saiu.')) { await api.refreshMe(); app().refresh(); }
  };
  actions.copy = (el) => U.copy(el.dataset.v);
  actions.viewImage = (el) => U.sheet({ title: 'Foto', size: 'lg', loading: false, body: '<img class="shot-full" src="' + esc(el.dataset.v) + '" alt="Foto">' });

  forms.roomChat = async function (f) {
    const input = f.querySelector('input[name=text]');
    const text = input.value.trim();
    if (!text) return;
    if (await U.run(f.querySelector('.send'), () => api.rpc('send_room_message', { p_room: f.dataset.id, p_body: text, p_image: null }))) { input.value = ''; app().refresh(); }
  };
  document.addEventListener('change', async (e) => {
    const inp = e.target.closest('input[type=file][data-send]');
    if (!inp || !inp.files || !inp.files[0]) return;
    const label = inp.closest('label');
    await U.run(label, async () => {
      const blob = await U.compressImage(inp.files[0], 1280);
      const url = api.publicUrl('chat', await api.upload('chat', blob));
      if (inp.dataset.send === 'room') await api.rpc('send_room_message', { p_room: inp.dataset.id, p_body: '', p_image: url });
      else await api.rpc('send_message', { p_thread: inp.dataset.id, p_body: '', p_image: url });
    });
    inp.value = '';
    app().refresh();
  });

  /* jogador dentro da sala */
  actions.roomPlayer = async function (el) {
    const uid = el.dataset.id, rid = el.dataset.room;
    const [p, r] = await Promise.all([api.rpc('get_profile', { p_user: uid }), api.rpc('get_room', { p_id: rid })]);
    const mine = uid === api.me.id;
    U.sheet({
      title: p.nick || 'Jogador', loading: false,
      body: '<div class="pp"><div class="pp-banner" style="background:' + esc(p.banner_bg || '') + '"><span class="p-pattern"></span></div>' + U.av(p, 'lg', 'pop') +
        '<h3>' + U.nick(p, { level: true }) + '</h3>' + U.title(p) +
        '<div class="tiles3 four"><div class="tile"><b>' + U.int(p.stats.kills) + '</b><small>Abates</small></div><div class="tile"><b>' + U.int(p.stats.matches) + '</b><small>Salas</small></div><div class="tile"><b>' + U.int(p.stats.wins) + '</b><small>Vitórias</small></div><div class="tile"><b>' + (p.stats.earnings_cents == null ? '–' : U.centsShort(p.stats.earnings_cents)) + '</b><small>Ganhos</small></div></div>' +
        (mine ? '' : '<div class="btn-row two"><button type="button" class="btn outline" data-act="profile" data-id="' + uid + '">' + I('user') + 'Ver perfil</button><button type="button" class="btn ghost" data-act="dm" data-id="' + uid + '">' + I('message') + 'Mensagem</button></div>') +
        (r.can_manage && !mine ? '<div class="org-actions"><p class="eyebrow">' + I('crown') + 'Como organizador</p><div class="btn-row two"><button type="button" class="btn gold sm" data-act="roomMsg" data-id="' + uid + '" data-room="' + rid + '">' + I('send') + 'Chamar no privado</button>' +
          (r.status === 'aberta' || r.status === 'em_andamento' ? '<button type="button" class="btn danger-ghost sm" data-act="roomKick" data-id="' + uid + '" data-room="' + rid + '">' + I('userMinus') + 'Remover da sala</button>' : '') + '</div></div>' : '') +
        (mine ? '' : '<button type="button" class="btn danger-ghost block sm" data-act="report" data-id="' + uid + '" data-room="' + rid + '">' + I('flag') + 'Denunciar</button>') + '</div>'
    });
  };
  actions.roomMsg = function (el) {
    const uid = el.dataset.id, rid = el.dataset.room;
    U.sheet({
      title: 'Mensagem do organizador', loading: false,
      body: '<form class="form" data-form="roomMsg" data-id="' + uid + '" data-room="' + rid + '"><p class="muted">Chega para o jogador na aba <b>Salas</b> do chat, com aviso na hora.</p>' +
        '<label class="field"><span>Mensagem</span><textarea id="om-body" name="body" rows="3" maxlength="2000" required placeholder="Ex.: confirma seu nick no jogo?"></textarea></label>' +
        '<button class="btn primary block">' + I('send') + 'Enviar</button></form>'
    });
  };
  forms.roomMsg = async function (f) {
    const ok = await U.run(f.querySelector('button'), () => api.rpc('message_player', { p_user: f.dataset.id, p_body: f.body.value, p_room: f.dataset.room, p_image: null }), 'Mensagem enviada.');
    if (ok) U.closeAll();
  };
  actions.roomKick = async function (el) {
    const reason = await U.confirm({ title: 'Remover da sala?', body: 'O jogador recebe a inscrição de volta e é avisado.', ok: 'Remover', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: nick diferente do jogo', required: true, error: 'Escreva o motivo.' } });
    if (!reason) return;
    if (await U.run(null, () => api.rpc('kick_player', { p_room: el.dataset.room, p_user: el.dataset.id, p_reason: reason }), 'Jogador removido.')) { U.closeAll(); app().refresh(); }
  };

  /* organizador */
  actions.roomStart = function (el) {
    U.sheet({
      title: 'Iniciar sala', loading: false,
      body: '<form class="form" data-form="roomStart" data-id="' + el.dataset.id + '"><p class="muted">Crie a sala personalizada no Free Fire e passe os dados. Todos os inscritos recebem na hora.</p>' +
        '<div class="grid2"><label class="field"><span>ID da sala</span><input id="rs-id" name="gid" inputmode="numeric" maxlength="14" required></label><label class="field"><span>Senha</span><input id="rs-pass" name="pass" maxlength="20" required></label></div>' +
        '<button class="btn primary block lg">' + I('play') + 'Liberar sala e iniciar</button></form>'
    });
  };
  forms.roomStart = async function (f) {
    if (await U.run(f.querySelector('button'), () => api.rpc('start_room', { p_id: f.dataset.id, p_game_room_id: f.gid.value, p_password: f.pass.value }), 'Sala ao vivo. Inscritos avisados.')) { U.closeAll(); app().refresh(); }
  };
  actions.roomGuarantee = async function (el) {
    const v = await U.confirm({ title: 'Colocar garantia', body: 'O valor sai da sua carteira e fica no cofre. O que sobrar no fim volta para você junto com a sobra da sala.', ok: 'Colocar no cofre', icon: 'vault', input: { label: 'Valor (R$)', inputmode: 'decimal', placeholder: '50,00', required: true } });
    if (!v) return;
    if (await U.run(null, () => api.rpc('add_guarantee', { p_id: el.dataset.id, p_cents: U.toCents(v) }), 'Garantia adicionada.')) { await api.refreshMe(); app().refresh(); }
  };
  actions.roomCancel = async function (el) {
    const reason = await U.confirm({ title: 'Cancelar a sala?', body: 'Todos os inscritos recebem a inscrição de volta e a garantia volta para o organizador.', ok: 'Cancelar sala', cancel: 'Manter', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: servidor instável', required: true, error: 'Escreva o motivo.' } });
    if (!reason) return;
    if (await U.run(null, () => api.rpc('cancel_room', { p_id: el.dataset.id, p_reason: reason }), 'Sala cancelada e valores devolvidos.')) { await api.refreshMe(); app().refresh(); }
  };
  actions.roomDraw = async function (el) {
    const kind = el.dataset.kind, rid = el.dataset.id;
    const label = kind === 'rei' ? 'Player Rei' : 'Sorteio da sala';
    const ok = await U.confirm({ title: 'Girar a roleta?', body: kind === 'rei' ? 'O sorteado vira o Player Rei: quem eliminar ele leva o bônus. Só dá para girar uma vez.' : 'O sorteado leva o bônus no fim da partida. Só dá para girar uma vez.', ok: 'Girar', icon: kind === 'rei' ? 'crown' : 'dice' });
    if (!ok) return;
    const res = await U.run(el, () => api.rpc('draw_room', { p_id: rid, p_kind: kind }));
    if (!res) return;
    U.sheet({
      title: label, loading: false,
      body: '<div id="reel-host"></div><div id="reel-result" hidden></div>',
      onMount(s) {
        U.reel(s.body.querySelector('#reel-host'), res.players, res.winner.id, 'Sorteando entre ' + res.players.length + ' jogadores…').then(() => {
          const out = s.body.querySelector('#reel-result');
          out.hidden = false;
          out.innerHTML = '<div class="reel-win">' + I(kind === 'rei' ? 'crown' : 'dice') + U.av(res.winner, 'lg', 'pop') + '<b>' + esc(res.winner.nick) + '</b><span>' + (kind === 'rei' ? 'é o Player Rei desta sala' : 'foi sorteado') + '</span></div><button type="button" class="btn primary block" data-close>Fechar</button>';
          U.confetti();
        });
      },
      onClose: () => app().refresh()
    });
  };

  /* lançamento do resultado */
  actions.roomResults = async function (el) {
    const r = await api.rpc('get_room', { p_id: el.dataset.id });
    const data = { rows: {}, first_blood: '', king_outcome: r.king ? 'killed' : 'none', king_killer: '', preview: null };
    r.player_list.forEach((u, i) => { data.rows[u.id] = { kills: 0, placement: '', survival: '' }; });
    const hasFb = r.mechanics.some((m) => m.type === 'first_blood'), hasKing = r.mechanics.some((m) => m.type === 'rei') && r.king;
    const opts = (sel) => '<option value="">Escolha o jogador</option>' + r.player_list.map((u) => '<option value="' + u.id + '"' + (sel === u.id ? ' selected' : '') + '>' + esc(u.nick) + '</option>').join('');
    const payload = () => ({
      players: r.player_list.map((u) => ({ user_id: u.id, kills: Number(data.rows[u.id].kills) || 0, placement: data.rows[u.id].placement === '' ? null : Number(data.rows[u.id].placement), survival_min: data.rows[u.id].survival === '' ? 0 : Number(data.rows[u.id].survival) })),
      first_blood: data.first_blood || null, king_outcome: data.king_outcome, king_killer: data.king_killer || null
    });
    U.sheet({
      title: 'Resultado da sala #' + r.code, size: 'lg', data, loading: false,
      body: (s) => {
        const d = s.data;
        if (d.preview) {
          const pv = d.preview, cards = pv.cards || {};
          const group = {};
          pv.lines.forEach((l) => { (group[l.user_id] = group[l.user_id] || []).push(l); });
          return '<div class="preview"><div class="tiles3"><div class="tile"><b>' + U.centsShort(pv.vault_cents) + '</b><small>Cofre</small></div><div class="tile tone-green"><b>' + U.centsShort(pv.payout_cents) + '</b><small>Prêmios</small></div><div class="tile tone-violet"><b>' + U.centsShort(pv.creator_cents) + '</b><small>Para você</small></div></div>' +
            (pv.fee_cents ? '<p class="muted small center">Taxa da plataforma: ' + U.cents(pv.fee_cents) + '</p>' : '') +
            '<ul class="pv-list">' + Object.keys(group).map((uid) => '<li>' + U.av(cards[uid], 'sm') + '<div class="grow"><b>' + esc((cards[uid] || {}).nick || '') + '</b>' + group[uid].map((l) => '<small>' + I((MECH[l.kind] || { icon: 'trophy' }).icon) + esc(l.note) + ' · ' + U.cents(l.cents) + '</small>').join('') + '</div><b class="pos">+' + U.cents(group[uid].reduce((a, l) => a + l.cents, 0)) + '</b></li>').join('') + '</ul>' +
            '<details class="xp-details"><summary>XP de cada jogador</summary><ul>' + pv.players.map((p) => '<li><span>' + esc((cards[p.user_id] || {}).nick || '') + '</span><b>+' + p.xp + ' XP</b></li>').join('') + '</ul></details>' +
            '<p class="note-gold">' + I('alert') + '<span>Confira com o print do fim da partida. Depois de confirmar, os prêmios caem nas carteiras e não dá para desfazer.</span></p>' +
            '<div class="btn-row two"><button type="button" class="btn ghost" data-act="resBack">' + I('back') + 'Corrigir</button><button type="button" class="btn gold" data-act="resConfirm" data-id="' + r.id + '">' + I('check') + 'Confirmar e pagar</button></div></div>';
        }
        return '<form class="form results-form" data-form="resPreview" data-id="' + r.id + '"><p class="muted">Lance os abates e a colocação de cada jogador. ' + (r.team_size > 1 ? 'No modo ' + TEAM[r.team_size].toLowerCase() + ', coloque a mesma colocação para quem é do mesmo time.' : '') + '</p>' +
          '<div class="res-head"><span>Jogador</span><span>Abates</span><span>Colocação</span><span>Min vivo</span></div>' +
          '<ul class="res-rows">' + r.player_list.map((u) => { const row = d.rows[u.id]; return '<li>' + U.av(u, 'xs') + '<span class="res-name"><b>' + esc(u.nick) + '</b><small>' + esc(u.ff_nick || '') + '</small></span>' +
            '<span class="stepper"><button type="button" data-act="resKill" data-id="' + u.id + '" data-d="-1" aria-label="Menos um abate">' + I('minus') + '</button><b id="k-' + u.id + '">' + row.kills + '</b><button type="button" data-act="resKill" data-id="' + u.id + '" data-d="1" aria-label="Mais um abate">' + I('plus') + '</button></span>' +
            '<input type="number" inputmode="numeric" min="1" max="' + r.player_list.length + '" class="res-in" data-res="placement" data-id="' + u.id + '" value="' + esc(row.placement) + '" placeholder="–" aria-label="Colocação de ' + esc(u.nick) + '">' +
            '<input type="number" inputmode="numeric" min="0" max="120" class="res-in" data-res="survival" data-id="' + u.id + '" value="' + esc(row.survival) + '" placeholder="–" aria-label="Minutos vivo de ' + esc(u.nick) + '"></li>'; }).join('') + '</ul>' +
          '<p class="muted small" id="res-sum"></p>' +
          (hasFb ? '<label class="field"><span>' + I('droplet') + 'Quem fez o primeiro abate?</span><select id="res-fb" data-res="first_blood">' + opts(d.first_blood) + '</select></label>' : '') +
          (hasKing ? '<fieldset class="field king-set"><span>' + I('crown') + 'Player Rei: ' + esc(r.king.nick) + '</span><div class="radio-list">' +
            [['killed', 'Foi eliminado'], ['survived', 'Sobreviveu até o fim (bônus é dele)'], ['none', 'Ninguém eliminou (bônus fica no cofre)']].map((o) => '<label class="radio"><input type="radio" name="king" value="' + o[0] + '"' + (d.king_outcome === o[0] ? ' checked' : '') + ' data-res="king_outcome"><span>' + o[1] + '</span></label>').join('') + '</div>' +
            (d.king_outcome === 'killed' ? '<select id="res-kk" data-res="king_killer">' + opts(d.king_killer) + '</select>' : '') + '</fieldset>' : '') +
          '<button class="btn gold block lg">' + I('eye') + 'Ver prévia do pagamento</button></form>';
      },
      onMount(s) {
        const sum = () => { const el = s.body.querySelector('#res-sum'); if (!el) return; const t = Object.values(s.data.rows).reduce((a, x) => a + (Number(x.kills) || 0), 0); el.textContent = 'Total de abates: ' + t + ' (máximo ' + Math.max(0, r.player_list.length - 1) + ')'; };
        sum();
        s._sum = sum;
        if (s._wired) return;
        s._wired = true;
        s.body.addEventListener('input', (e) => {
          const t = e.target.closest('[data-res]'); if (!t) return;
          if (t.dataset.id) s.data.rows[t.dataset.id][t.dataset.res] = t.value; else s.data[t.dataset.res] = t.value;
        });
        s.body.addEventListener('change', (e) => {
          const t = e.target.closest('[data-res]'); if (!t) return;
          if (!t.dataset.id) { s.data[t.dataset.res] = t.value; if (t.dataset.res === 'king_outcome') s.render('static'); }
        });
      }
    });
    const sheet = U.topSheet();
    sheet._payload = payload;
  };
  actions.resKill = function (el) {
    const s = U.topSheet(), row = s.data.rows[el.dataset.id];
    row.kills = Math.max(0, (Number(row.kills) || 0) + Number(el.dataset.d));
    const b = document.getElementById('k-' + el.dataset.id); if (b) { b.textContent = row.kills; b.classList.remove('bump-n'); void b.offsetWidth; b.classList.add('bump-n'); }
    if (s._sum) s._sum();
  };
  forms.resPreview = async function (f) {
    const s = U.topSheet();
    const pv = await U.run(f.querySelector('button.gold'), () => api.rpc('preview_results', { p_id: f.dataset.id, p_results: s._payload() }));
    if (!pv) return;
    s.data.preview = pv;
    s.render('soft');
  };
  actions.resBack = () => { const s = U.topSheet(); s.data.preview = null; s.render('soft'); };
  actions.resConfirm = async function (el) {
    const s = U.topSheet();
    const r = await U.run(el, () => api.rpc('finish_room', { p_id: el.dataset.id, p_results: s._payload() }));
    if (!r) return;
    U.closeAll();
    U.confetti();
    U.toast(U.cents(r.payout_cents) + ' pagos. Você recebeu ' + U.cents(r.creator_cents) + '.', 'money');
    await api.refreshMe();
    app().refresh();
  };

  /* criar / editar sala */
  actions.createRoom = () => flows.roomForm(null);
  actions.roomEdit = async (el) => flows.roomForm(await api.rpc('get_room', { p_id: el.dataset.id }));
  flows.roomForm = function (room) {
    const me = api.me, fee = room ? room.fee_pct : me.settings.fee_pct;
    const d = room ? {
      title: room.title, mode: room.mode, team_size: room.team_size, map: room.map, max_players: room.max_players, entry: U.centsInput(room.entry_cents),
      starts: U.localInput(room.starts_at), rules: room.rules, prizes: room.prizes.map((z) => ({ place: z.place, value: U.centsInput(z.cents) })),
      mech: Object.fromEntries(room.mechanics.map((m) => [m.type, U.centsInput(m.cents)])), guarantee: ''
    } : { title: '', mode: 'Battle Royale', team_size: 1, map: 'Bermuda', max_players: 48, entry: '2,00', starts: U.localInput(Date.now() + 2 * 3600e3), rules: '', prizes: [{ place: 1, value: '60,00' }], mech: {}, guarantee: '' };
    const locked = room && room.players > 0;
    const calc = () => {
      const entry = U.toCents(d.entry), n = Number(d.max_players) || 0, g = U.toCents(d.guarantee) + (room ? room.guarantee_cents : 0);
      const prizes = d.prizes.reduce((a, z) => a + U.toCents(z.value), 0);
      let fixed = prizes, perKill = 0;
      Object.keys(d.mech).forEach((k) => { if (d.mech[k] == null) return; if (k === 'por_kill') perKill = U.toCents(d.mech[k]); else fixed += U.toCents(d.mech[k]); });
      const vault = entry * n + g, commit = fixed + perKill * Math.max(n - 1, 0);
      let minN = null;
      for (let k = 2; k <= n; k++) if (entry * k + g >= fixed + perKill * (k - 1)) { minN = k; break; }
      const profit = Math.max(0, vault - commit), feeC = Math.floor(profit * fee / 100);
      return { vault, commit, profit: profit - feeC, feeC, minN, ok: vault >= commit };
    };
    const summary = () => {
      const c = calc();
      return '<div class="calc ' + (c.ok ? '' : 'bad') + '"><span>Com a sala cheia (' + d.max_players + ' jogadores)</span><b>' + U.cents(c.vault) + ' no cofre</b>' +
        '<small>Premiação máxima: ' + U.cents(c.commit) + ' · sobra para você: ' + U.cents(c.profit) + (c.feeC ? ' (taxa ' + U.cents(c.feeC) + ')' : '') + '</small>' +
        (c.ok ? '<small>' + (c.minN ? 'A sala pode começar a partir de ' + c.minN + ' inscritos.' : '') + '</small>' : '<small class="red">O cofre não cobre a premiação nem com a sala cheia. Aumente a inscrição, diminua os prêmios ou coloque garantia.</small>') + '</div>';
    };
    const opt = (list, v) => list.map((x) => '<option' + (String(x) === String(v) ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
    U.sheet({
      title: room ? 'Editar sala #' + room.code : 'Criar sala', size: 'lg', data: d, loading: false,
      body: () => '<form class="form room-form" data-form="roomSave" data-id="' + (room ? room.id : '') + '">' +
        '<label class="field"><span>Nome da sala</span><input id="rf-title" data-rf="title" maxlength="60" required placeholder="Ex.: Copa da Quebrada #1" value="' + esc(d.title) + '"></label>' +
        '<div class="grid2"><label class="field"><span>Modo</span><select id="rf-mode" data-rf="mode">' + opt(MODES, d.mode) + '</select></label>' +
        '<label class="field"><span>Mapa</span><select id="rf-map" data-rf="map">' + opt(MAPS, d.map) + '</select></label></div>' +
        '<div class="field"><span>Formato</span>' + U.seg('rf-team', [{ id: '1', label: 'Solo' }, { id: '2', label: 'Dupla' }, { id: '4', label: 'Squad' }], String(d.team_size), 'rfTeam') + '</div>' +
        '<div class="grid2"><label class="field"><span>Vagas</span><input id="rf-max" data-rf="max_players" type="number" inputmode="numeric" min="2" max="100" value="' + esc(d.max_players) + '"></label>' +
        '<label class="field money-field"><span>Inscrição por jogador</span><b>R$</b><input id="rf-entry" data-rf="entry" inputmode="decimal" value="' + esc(d.entry) + '"></label></div>' +
        '<label class="field"><span>Início</span><input id="rf-start" data-rf="starts" type="datetime-local" required value="' + esc(d.starts) + '"></label>' +
        '<h3 class="form-h">' + I('trophy') + 'Premiação por colocação</h3>' +
        '<ul class="prize-rows">' + d.prizes.map((z, i) => '<li><span class="medal m-' + (z.place === 1 ? 'gold' : z.place === 2 ? 'silver' : z.place === 3 ? 'bronze' : 'slate') + '">' + z.place + 'º</span><label class="field money-field grow"><b>R$</b><input id="rf-prize-' + i + '" data-prize="' + i + '" inputmode="decimal" value="' + esc(z.value) + '" aria-label="Prêmio do ' + z.place + 'º lugar"></label>' +
          (d.prizes.length > 1 ? '<button type="button" class="icon-btn" data-act="rfPrizeDel" data-v="' + i + '" aria-label="Remover">' + I('trash') + '</button>' : '') + '</li>').join('') + '</ul>' +
        (d.prizes.length < 10 ? '<button type="button" class="btn ghost sm" data-act="rfPrizeAdd">' + I('plus') + 'Adicionar ' + (d.prizes.length + 1) + 'º lugar</button>' : '') +
        '<h3 class="form-h">' + I('sparkles') + 'Mecânicas</h3><ul class="mech-pick">' + ((me.mechanics) || []).map((m) => {
          const on = d.mech[m.id] != null;
          return '<li class="' + (on ? 'on' : '') + '"><label class="switch"><input type="checkbox" data-mech="' + m.id + '"' + (on ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span><b>' + I((MECH[m.id] || {}).icon || 'star') + esc(m.name) + '</b><small>' + esc(m.description) + '</small></span></label>' +
            (on ? '<label class="field money-field"><b>R$</b><input id="rf-mech-' + m.id + '" data-mechv="' + m.id + '" inputmode="decimal" value="' + esc(d.mech[m.id]) + '" aria-label="Valor de ' + esc(m.name) + '"><em>' + (m.id === 'por_kill' ? 'por abate' : 'bônus') + '</em></label>' : '') + '</li>';
        }).join('') + '</ul>' +
        '<h3 class="form-h">' + I('vault') + 'Cofre</h3>' +
        '<label class="field money-field"><span>Garantia (opcional, sai da sua carteira)</span><b>R$</b><input id="rf-guar" data-rf="guarantee" inputmode="decimal" placeholder="0,00" value="' + esc(d.guarantee) + '"></label>' +
        '<div id="rf-calc">' + summary() + '</div>' +
        '<label class="field"><span>Regras</span><textarea id="rf-rules" data-rf="rules" rows="3" maxlength="1500" placeholder="Ex.: proibido emulador, print do resultado no chat da sala">' + esc(d.rules) + '</textarea></label>' +
        (locked ? '<p class="note-gold">' + I('info') + '<span>Já há inscritos: a premiação só pode aumentar. Quem já pagou mantém o valor pago.</span></p>' : '') +
        '<button class="btn primary block lg">' + I(room ? 'check' : 'plus') + (room ? 'Salvar alterações' : 'Publicar sala') + '</button></form>',
      onMount(s) {
        const upd = () => { const c = s.body.querySelector('#rf-calc'); if (c) c.innerHTML = summary(); };
        if (s._wired) return;
        s._wired = true;
        s.body.addEventListener('input', (e) => {
          const t = e.target;
          if (t.dataset.rf) d[t.dataset.rf] = t.value;
          if (t.dataset.prize != null) d.prizes[Number(t.dataset.prize)].value = t.value;
          if (t.dataset.mechv) d.mech[t.dataset.mechv] = t.value;
          upd();
        });
        s.body.addEventListener('change', (e) => {
          const t = e.target;
          if (t.dataset.rf) d[t.dataset.rf] = t.value;
          if (t.dataset.mech) { if (t.checked) d.mech[t.dataset.mech] = t.dataset.mech === 'por_kill' ? '1,00' : '10,00'; else delete d.mech[t.dataset.mech]; s.render('static'); }
        });
      }
    });
  };
  actions.rfTeam = (el) => { const s = U.topSheet(); s.data.team_size = Number(el.dataset.v); s.render('static'); };
  actions.rfPrizeAdd = () => { const s = U.topSheet(); s.data.prizes.push({ place: s.data.prizes.length + 1, value: '10,00' }); s.render('static'); };
  actions.rfPrizeDel = (el) => { const s = U.topSheet(); s.data.prizes.splice(Number(el.dataset.v), 1); s.data.prizes.forEach((z, i) => { z.place = i + 1; }); s.render('static'); };
  forms.roomSave = async function (f) {
    const s = U.topSheet(), d = s.data, id = f.dataset.id;
    const p = {
      title: d.title, mode: d.mode, team_size: Number(d.team_size), map: d.map, max_players: Number(d.max_players), entry_cents: U.toCents(d.entry),
      starts_at: new Date(d.starts).toISOString(), rules: d.rules,
      prizes: d.prizes.map((z) => ({ place: z.place, cents: U.toCents(z.value) })).filter((z) => z.cents > 0),
      mechanics: Object.keys(d.mech).map((k) => ({ type: k, cents: U.toCents(d.mech[k]) })).filter((m) => m.cents > 0),
      guarantee_cents: U.toCents(d.guarantee)
    };
    const r = await U.run(f.querySelector('button.primary'), async () => {
      const room = id ? await api.rpc('update_room', { p_id: id, p }) : await api.rpc('create_room', { p });
      if (id && p.guarantee_cents > 0) await api.rpc('add_guarantee', { p_id: id, p_cents: p.guarantee_cents });
      return room;
    }, id ? 'Sala atualizada.' : 'Sala publicada.');
    if (!r) return;
    U.closeAll();
    await api.refreshMe();
    if (id) app().refresh(); else app().push('room', { id: r.id });
  };
})();
