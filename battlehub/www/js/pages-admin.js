/* Painel administrativo (online) */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, st = BH.state;
  const app = () => BH.app;
  st.adm = Object.assign({ section: 'overview', uQ: '', uFilter: 'todos', ffStatus: 'pendente', finTab: 'depositos', roomsTab: 'ativas', roomsQ: '', repStatus: 'aberta', logQ: '' }, st.adm || {});
  const sa = st.adm;

  const SECTIONS = [
    { id: 'overview', label: 'Visão geral', icon: 'dashboard', level: 1 },
    { id: 'users', label: 'Usuários', icon: 'users', level: 1 },
    { id: 'ff', label: 'Verificação de ID', icon: 'badgeCheck', level: 1, badge: 'ff' },
    { id: 'finance', label: 'Financeiro', icon: 'dollar', level: 2, badge: 'money' },
    { id: 'rooms', label: 'Salas', icon: 'trophy', level: 1 },
    { id: 'events', label: 'Eventos', icon: 'medal', level: 2 },
    { id: 'templates', label: 'Modelos de sala', icon: 'gem', level: 2 },
    { id: 'reports', label: 'Denúncias', icon: 'flag', level: 1, badge: 'reports' },
    { id: 'guilds', label: 'Guildas', icon: 'shield', level: 1 },
    { id: 'broadcast', label: 'Avisos', icon: 'megaphone', level: 2 },
    { id: 'shop', label: 'Loja', icon: 'bag', level: 2 },
    { id: 'settings', label: 'Configurações', icon: 'settings', level: 2 },
    { id: 'logs', label: 'Auditoria', icon: 'file', level: 2 }
  ];
  const tile = (icon, tone, value, label, fmt, extra) => '<div class="kpi tone-' + tone + '"><span class="kpi-ic">' + I(icon) + '</span><div>' + U.num(value, fmt, 'kpi-num') + '<small>' + label + '</small>' + (extra || '') + '</div></div>';
  const ucell = (u, sub) => '<span class="ucell">' + U.av(u, 'sm') + '<span><b>' + U.nick(u) + '</b><small>' + (sub || '') + '</small></span></span>';

  pages.admin = async function (p) {
    const me = api.me;
    if (!me || me.role_level < 1) return { html: '<section class="page">' + BH.backRow() + U.empty('lock', 'Acesso restrito', 'Só a equipe acessa o painel.') + '</section>' };
    if (p && p.section) sa.section = p.section;
    const list = SECTIONS.filter((s) => me.role_level >= s.level);
    if (!list.some((s) => s.id === sa.section)) sa.section = 'overview';
    const cur = list.find((s) => s.id === sa.section);
    const pend = me.admin_pending || {};
    const badge = (s) => s.badge === 'ff' ? pend.ff : s.badge === 'reports' ? pend.reports : s.badge === 'money' ? (pend.deposits || 0) + (pend.withdrawals || 0) : 0;
    const nav = (cls) => list.map((s) => { const b = badge(s); return '<button type="button" class="' + cls + (s.id === sa.section ? ' on' : '') + '" data-act="aSection" data-v="' + s.id + '">' + I(s.icon) + '<span>' + s.label + '</span>' + (b ? '<b class="dot-count">' + b + '</b>' : '') + '</button>'; }).join('');
    const body = await SECTION[sa.section]();
    return {
      hideNav: true, bare: true, className: 'admin-mode',
      html: '<div class="admin"><aside class="a-side">' + BH.logo() + '<p class="eyebrow">Painel admin</p><nav class="a-side-nav">' + nav('a-link') + '</nav>' +
        '<button type="button" class="a-link back-app" data-act="back">' + I('back') + '<span>Voltar ao app</span></button></aside>' +
        '<div class="a-main"><header class="a-head"><button type="button" class="icon-btn" data-act="back" aria-label="Voltar ao app">' + I('back') + '</button>' +
        '<div class="grow"><p class="eyebrow">' + I('crown') + 'Painel admin</p><h1 class="h1">' + cur.label + '</h1></div>' +
        '<span class="a-me">' + U.av(me, 'sm') + '<span><b>' + esc(me.nick) + '</b><small>' + ({ moderador: 'Moderador', admin: 'Admin', dono: 'Dono' }[me.role]) + '</small></span></span></header>' +
        '<nav class="a-tabs" aria-label="Seções do painel">' + nav('a-tab') + '</nav>' +
        '<div class="a-body">' + body.html + '</div></div></div>',
      onMount: body.onMount
    };
  };
  actions.admin = (el) => { U.closeAll(); sa.section = (el && el.dataset.v) || 'overview'; app().push('admin', { section: sa.section }); };
  actions.aSection = (el) => { sa.section = el.dataset.v; app().replace('admin', { section: sa.section }); window.scrollTo(0, 0); };
  actions.aGo = (el) => { sa.section = el.dataset.v; if (el.dataset.tab) sa.finTab = el.dataset.tab; app().replace('admin', { section: sa.section }); window.scrollTo(0, 0); };
  const refresh = async () => { await api.refreshMe(); app().refresh(); };
  const SECTION = {};

  /* ---------- visão geral ---------- */
  SECTION.overview = async function () {
    const [d, x] = await Promise.all([api.rpc('admin_dashboard'), api.rpc('admin_dashboard_extra').catch(() => ({ revenue_by_kind: {} }))]);
    const me = api.me, p = d.pending;
    const REV = { taxa_sala: 'Taxa das salas dos organizadores', sala_oficial: 'Sobra das salas oficiais', lucro_evento: 'Sobra dos eventos', loja: 'Loja', cobertura_sala: 'Prêmio completado em salas oficiais', cobertura_evento: 'Prêmio completado em eventos' };
    const rev = Object.keys(x.revenue_by_kind || {}).map((k) => [k, Number(x.revenue_by_kind[k])]).sort((a, b) => b[1] - a[1]);
    const labels = d.series.map((x) => x.day.slice(8, 10) + '/' + x.day.slice(5, 7));
    const todo = [['ff', null, 'badgeCheck', 'IDs para verificar', p.ff, 1], ['finance', 'depositos', 'arrowIn', 'Depósitos manuais', p.deposits, 2], ['finance', 'saques', 'arrowOut', 'Saques para pagar', p.withdrawals, 2], ['reports', null, 'flag', 'Denúncias abertas', p.reports, 1]].filter((x) => me.role_level >= x[5]);
    const total = todo.reduce((a, x) => a + x[4], 0);
    return {
      html: '<p class="a-hello">Olá, ' + esc(me.nick) + '. ' + (total ? 'Tem ' + U.plural(total, 'pendência', 'pendências') + ' esperando por você.' : 'Nenhuma pendência agora.') + '</p>' +
        '<div class="todo stagger">' + todo.map((x) => '<button type="button" class="todo-item ripple' + (x[4] ? ' hot' : '') + '" data-act="aGo" data-v="' + x[0] + '"' + (x[1] ? ' data-tab="' + x[1] + '"' : '') + '><span class="todo-ic">' + I(x[2]) + '</span><b>' + x[4] + '</b><small>' + x[3] + '</small></button>').join('') + '</div>' +
        '<div class="kpis stagger">' + tile('users', 'violet', d.users, 'Jogadores', null, '<em>+' + d.users_week + ' em 7 dias · ' + d.online + ' online</em>') +
        tile('trophy', 'gold', d.rooms_open + d.rooms_live, 'Salas ativas', null, '<em>' + d.rooms_live + ' ao vivo · ' + d.rooms_week + ' finalizadas na semana</em>') +
        (me.role_level >= 2 ? tile('arrowIn', 'green', d.deposits_total, 'Depósitos confirmados', 'cents') + tile('percent', 'cyan', d.revenue_total, 'Receita da plataforma', 'cents', '<em>' + U.cents(d.revenue_month) + ' neste mês</em>') +
          tile('wallet', 'violet', d.wallets_total, 'Saldo dos jogadores', 'cents', '<em>Dinheiro que você deve aos jogadores</em>') + tile('vault', 'gold', d.vaults_total, 'Em cofres', 'cents', '<em>Salas abertas e guildas</em>') : '') + '</div>' +
        (me.role_level >= 2 ? '<div class="a-cols"><section class="card"><h3 class="card-h">' + I('percent') + 'Receita do mês por origem</h3><ul class="a-list">' + (rev.length ? rev.map((r) => '<li class="a-row rev-row"><span>' + esc(REV[r[0]] || r[0]) + '</span><b class="' + (r[1] < 0 ? 'neg' : 'pos') + '">' + (r[1] < 0 ? '−' : '+') + U.cents(Math.abs(r[1])) + '</b></li>').join('') : '<li class="muted pad">Sem receita neste mês.</li>') + '</ul></section>' +
          '<section class="card"><h3 class="card-h">' + I('medal') + 'Competições</h3><div class="kpis two">' + tile('medal', 'gold', x.events_active || 0, 'Eventos ativos') + tile('shieldCheck', 'cyan', x.official_open || 0, 'Salas oficiais abertas') + '</div>' +
          '<div class="btn-row"><button type="button" class="btn outline sm" data-act="aGo" data-v="events">' + I('medal') + 'Eventos</button><button type="button" class="btn ghost sm" data-act="createRoom">' + I('plus') + 'Sala oficial</button></div></section></div>' : '') +
        (me.role_level >= 2 ? '<section class="card"><header class="card-row"><h3 class="card-h">' + I('chart') + 'Últimos 14 dias</h3><div class="legend"><span><i style="background:#34d399"></i>Depósitos</span><span><i style="background:#fb7185"></i>Saques</span><span><i style="background:#67e8f9"></i>Receita</span></div></header>' +
          U.areaChart([{ name: 'Depósitos', color: '#34d399', values: d.series.map((x) => x.deposits / 100) }, { name: 'Saques', color: '#fb7185', values: d.series.map((x) => x.withdrawals / 100) }, { name: 'Receita', color: '#67e8f9', values: d.series.map((x) => x.revenue / 100) }], labels, { label: 'Movimento diário' }) + '</section>' : '') +
        '<div class="a-cols"><section class="card"><h3 class="card-h">' + I('crown') + 'Organizadores do mês</h3><ul class="a-list">' + (d.top_creators.length ? d.top_creators.map((t) => '<li class="a-row">' + ucell(t.user, U.plural(t.rooms, 'sala', 'salas') + ' · ' + U.plural(t.players, 'jogador', 'jogadores')) + '</li>').join('') : '<li class="muted pad">Nenhuma sala finalizada ainda.</li>') + '</ul></section>' +
        '<section class="card"><header class="card-row"><h3 class="card-h">' + I('history') + 'Atividade recente</h3>' + (me.role_level >= 2 ? '<button type="button" class="link" data-act="aGo" data-v="logs">Auditoria' + I('right') + '</button>' : '') + '</header><ul class="log-list">' + d.logs.map(logRow).join('') + '</ul></section></div>'
    };
  };
  function logRow(l) {
    return '<li class="log">' + U.av(l.actor, 'xs') + '<div class="grow"><p><b>' + esc(l.actor ? l.actor.nick : 'Sistema') + '</b> ' + esc(String(l.action).toLowerCase()) + (l.target ? ' <b>' + esc(l.target) + '</b>' : '') + '</p>' + (l.detail ? '<small>' + esc(l.detail) + '</small>' : '') + '</div><small class="mono" data-ago="' + l.created_at + '">' + U.ago(l.created_at) + '</small></li>';
  }

  /* ---------- usuários ---------- */
  SECTION.users = async function () {
    const list = await api.rpc('admin_users', { p_q: sa.uQ || null, p_filter: sa.uFilter });
    return {
      html: '<label class="search">' + I('search') + '<input id="au-q" type="search" placeholder="Buscar por nick, e-mail, número, ID do Free Fire" value="' + esc(sa.uQ) + '" data-input="adm.uQ" autocomplete="off"></label>' +
        U.chips([['todos', 'Todos'], ['verificar', 'ID em análise'], ['verificados', 'Verificados'], ['criadores', 'Criadores de sala'], ['staff', 'Equipe'], ['banidos', 'Suspensos']], sa.uFilter, 'aUFilter') +
        '<p class="muted small">' + U.plural(list.length, 'conta', 'contas') + '</p>' +
        '<div class="u-grid stagger">' + (list.length ? list.map((u) => '<article class="u-card' + (u.banned ? ' banned' : '') + '"><header>' + U.av(u, 'md') + '<div class="grow"><b>' + U.nick(u, { level: true }) + '</b><small>' + esc(u.email || '') + '</small>' +
          '<div class="p-badges"><span class="chip mono">#' + u.code + '</span>' + U.role(u.role) + (u.can_create_rooms ? '<span class="tag tone-green">' + I('trophy') + 'Cria salas</span>' : '') + (u.banned ? '<span class="tag tone-red">' + I('ban') + 'Suspenso</span>' : '') + (u.ff_status === 'pendente' ? '<span class="tag tone-violet">ID em análise</span>' : '') + '</div></div></header>' +
          '<dl class="kv"><div><dt>Saldo</dt><dd>' + U.centsShort(u.balance_cents) + '</dd></div><div><dt>Free Fire</dt><dd>' + esc(u.ff_id || '–') + '</dd></div><div><dt>Salas</dt><dd>' + u.matches + '</dd></div></dl>' +
          '<button type="button" class="btn outline block sm" data-act="aUser" data-id="' + u.id + '">' + I('sliders') + 'Gerenciar conta</button></article>').join('') : U.empty('search', 'Nenhuma conta encontrada', 'Tente outro termo ou filtro.')) + '</div>'
    };
  };
  actions.aUFilter = (el) => { sa.uFilter = el.dataset.v; app().rerender('soft'); };
  actions.aUser = function (el) {
    const id = el.dataset.id;
    U.closeAll();
    U.sheet({
      title: 'Gerenciar conta', size: 'lg', data: { id },
      body: async () => {
        const u = await api.rpc('admin_user', { p_id: id });
        const me = api.me;
        let photo = '';
        if (u.ff_photo_path) { try { photo = await api.signedUrl(u.ff_photo_path); } catch (e) { photo = ''; } }
        const canRole = me.role_level >= 2 && u.id !== me.id && u.role !== 'dono' && ({ jogador: 0, moderador: 1, admin: 2 }[u.role] || 0) < me.role_level;
        const canBan = u.id !== me.id && ({ jogador: 0, moderador: 1, admin: 2, dono: 3 }[u.role] || 0) < me.role_level;
        return '<div class="mu-head">' + U.av(u, 'lg') + '<div><h3>' + U.nick(u, { level: true }) + '</h3><p class="muted">' + esc(u.email || '') + '</p><div class="p-badges"><button type="button" class="chip mono" data-act="copy" data-v="' + u.code + '">#' + u.code + '</button>' + U.role(u.role) + (u.guild ? '<span class="tag tone-violet">' + esc(u.guild.tag) + '</span>' : '') + '</div></div></div>' +
          (u.banned ? '<p class="note-red">' + I('ban') + '<span>Suspenso ' + (u.banned_until && new Date(u.banned_until).getFullYear() < 2200 ? 'até ' + U.date(u.banned_until) : 'permanentemente') + ': ' + esc(u.ban_reason || '') + '</span></p>' : '') +
          '<div class="tiles3 four"><div class="tile tone-green"><b>' + U.centsShort(u.balance_cents) + '</b><small>Saldo</small></div><div class="tile"><b>' + u.matches + '</b><small>Salas</small></div><div class="tile"><b>' + U.centsShort(u.earnings_cents) + '</b><small>Ganhos</small></div><div class="tile"><b>' + u.reports_against + '</b><small>Denúncias</small></div></div>' +
          '<section class="mu-sec"><h4>Free Fire</h4><div class="ff-review">' + (photo ? '<button type="button" class="v-shot" data-act="viewImage" data-v="' + esc(photo) + '"><img src="' + esc(photo) + '" alt="Print do Free Fire"><span>' + I('eye') + 'Ampliar</span></button>' : '<span class="v-shot empty">' + I('image') + '</span>') +
          '<dl class="kv inline"><div><dt>Nick</dt><dd>' + esc(u.ff_nick || '–') + '</dd></div><div><dt>ID</dt><dd class="mono">' + esc(u.ff_id || '–') + '</dd></div><div><dt>Status</dt><dd>' + esc(u.ff_status) + '</dd></div></dl></div></section>' +
          (me.role_level >= 2 ? '<section class="mu-sec"><h4>Permissões</h4>' +
            '<label class="switch"><input type="checkbox" data-act-change="aCreator" data-id="' + u.id + '"' + (u.can_create_rooms ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Pode criar salas <small>O organizador define inscrição e prêmios e recebe a sobra do cofre, menos a parte da plataforma.</small></span></label>' +
            (u.can_create_rooms ? '<form class="form tight fee-form" data-form="aCreatorFee" data-id="' + u.id + '"><label class="field"><span>Parte da plataforma nas salas dele (% da arrecadação)</span><div class="copy-line"><input id="au-fee" name="pct" type="number" inputmode="decimal" min="0" max="50" step="0.5" placeholder="Padrão: ' + me.settings.fee_pct + '%" value="' + (u.creator_fee_pct != null ? u.creator_fee_pct : '') + '"><button class="btn ghost sm">' + I('check') + 'Salvar</button></div></label>' +
              '<p class="muted small">' + U.plural(u.creator_rooms || 0, 'sala finalizada', 'salas finalizadas') + ' · já pagou ' + U.cents(u.creator_fee_paid_cents || 0) + ' para a plataforma. Deixe vazio para usar a taxa padrão.</p></form>' : '') +
            (canRole ? '<label class="field"><span>Cargo</span><select id="au-role" data-act-change="aRole" data-id="' + u.id + '">' + [['jogador', 'Jogador'], ['moderador', 'Moderador'], ['admin', 'Admin']].filter((r) => r[0] !== 'admin' || me.role === 'dono').map((r) => '<option value="' + r[0] + '"' + (u.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') + '</select></label>' : '') + '</section>' : '') +
          '<section class="mu-sec"><h4>Suspensão</h4>' + (u.banned ? '<button type="button" class="btn ghost sm" data-act="aUnban" data-id="' + u.id + '">' + I('userCheck') + 'Tirar suspensão</button>' : canBan ? '<button type="button" class="btn danger sm" data-act="aBan" data-id="' + u.id + '">' + I('ban') + 'Suspender conta</button>' : '<p class="muted small">Você não pode suspender esta conta.</p>') +
          (u.bans.length ? '<ul class="mini-log">' + u.bans.map((b) => '<li>' + U.date(b.created_at) + ' · ' + (b.until ? 'até ' + U.date(b.until) : 'permanente') + ' · ' + esc(b.reason) + (b.by ? ' · por ' + esc(b.by.nick) : '') + (b.lifted_at ? ' · encerrada' : '') + '</li>').join('') + '</ul>' : '') + '</section>' +
          (me.role_level >= 2 ? '<section class="mu-sec"><h4>Ajustar saldo</h4><form class="form tight" data-form="aAdjust" data-id="' + u.id + '"><div class="grid2"><label class="field"><span>Valor (use − para debitar)</span><input id="aa-v" name="value" inputmode="decimal" required placeholder="10,00 ou -10,00"></label><label class="field"><span>Motivo</span><input id="aa-r" name="reason" required maxlength="80" placeholder="Ex.: bônus de evento"></label></div><button class="btn ghost block sm">' + I('wallet') + 'Aplicar ajuste</button></form></section>' : '') +
          '<section class="mu-sec"><h4>Extrato</h4><ul class="tx-list">' + (u.ledger.length ? u.ledger.slice(0, 12).map(BH.ledgerRow).join('') : '<li class="muted small">Sem movimentações.</li>') + '</ul></section>' +
          '<section class="mu-sec"><h4>Salas</h4><ul class="mini-log">' + (u.rooms.length ? u.rooms.map((r) => '<li><button type="button" class="link" data-act="aOpenRoom" data-id="' + r.id + '">#' + r.code + ' ' + esc(r.title) + '</button> · ' + r.role + ' · ' + r.status + '</li>').join('') : '<li>Nenhuma.</li>') + '</ul></section>' +
          (u.ff_history.length ? '<section class="mu-sec"><h4>Histórico de nick e ID</h4><ul class="mini-log">' + u.ff_history.map((h) => '<li>' + U.date(h.created_at) + ' · ' + esc(h.ff_nick) + ' · ' + esc(h.ff_id) + ' · ' + h.status + (h.note ? ' (' + esc(h.note) + ')' : '') + '</li>').join('') + '</ul></section>' : '');
      }
    });
  };
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act-change]');
    if (!el) return;
    const fn = actions[el.dataset.actChange];
    if (fn) Promise.resolve(fn(el)).catch(U.err);
  });
  const again = async () => { const s = U.topSheet(); if (s) s.render('static'); await refresh(); };
  actions.aCreator = async (el) => { if (!(await U.run(null, () => api.rpc('admin_set_creator', { p_user: el.dataset.id, p_value: el.checked }), el.checked ? 'Agora pode criar salas.' : 'Permissão removida.'))) el.checked = !el.checked; else again(); };
  forms.aCreatorFee = async function (f) {
    const v = f.pct.value.trim();
    if (await U.run(f.querySelector('button'), () => api.rpc('admin_set_creator_fee', { p_user: f.dataset.id, p_pct: v === '' ? null : Number(v.replace(',', '.')) }), 'Taxa do organizador salva.')) again();
  };
  actions.aRole = async (el) => { if (await U.run(null, () => api.rpc('admin_set_role', { p_user: el.dataset.id, p_role: el.value }), 'Cargo atualizado.')) again(); };
  actions.aBan = async function (el) {
    const r = await U.confirm({ title: 'Suspender conta', body: 'A conta perde o acesso e sai das salas abertas com reembolso.', ok: 'Suspender', danger: true,
      select: { label: 'Duração', options: [['1', '1 hora'], ['24', '24 horas'], ['72', '3 dias'], ['168', '7 dias'], ['720', '30 dias'], ['0', 'Permanente']] },
      input: { label: 'Motivo', placeholder: 'Ex.: uso de hack confirmado', required: true, error: 'Escreva o motivo.' } });
    if (!r) return;
    if (await U.run(null, () => api.rpc('admin_ban', { p_user: el.dataset.id, p_hours: Number(r.value), p_reason: r.text }), 'Conta suspensa.')) again();
  };
  actions.aUnban = async (el) => { if (await U.run(el, () => api.rpc('admin_unban', { p_user: el.dataset.id }), 'Suspensão encerrada.')) again(); };
  forms.aAdjust = async function (f) {
    const raw = f.value.value.trim(), neg = raw.startsWith('-') || raw.startsWith('−');
    const cents = U.toCents(raw.replace(/^[-−]/, '')) * (neg ? -1 : 1);
    if (!(await U.confirm({ title: (cents > 0 ? 'Creditar ' : 'Debitar ') + U.cents(Math.abs(cents)) + '?', body: 'Fica registrado na auditoria com o motivo.', ok: 'Aplicar', icon: 'wallet' }))) return;
    if (await U.run(f.querySelector('button'), () => api.rpc('admin_adjust', { p_user: f.dataset.id, p_cents: cents, p_reason: f.reason.value }), 'Saldo ajustado.')) again();
  };
  actions.aOpenRoom = (el) => { U.closeAll(); app().push('room', { id: el.dataset.id }); };

  /* ---------- verificação de ID ---------- */
  SECTION.ff = async function () {
    const list = await api.rpc('admin_ff_queue', { p_status: sa.ffStatus });
    const urls = await Promise.all(list.map((s) => (s.photo_path ? api.signedUrl(s.photo_path).catch(() => '') : Promise.resolve(''))));
    return {
      html: U.chips([['pendente', 'Pendentes', null, (api.me.admin_pending || {}).ff], ['aprovado', 'Aprovados'], ['recusado', 'Recusados']], sa.ffStatus, 'aFfStatus') +
        '<p class="muted small">Confira se o nick e o ID digitados aparecem no print. Mudanças de nick ou ID voltam para esta fila.</p>' +
        (list.length ? '<div class="v-grid stagger">' + list.map((s, i) => '<article class="v-item">' +
          (urls[i] ? '<button type="button" class="v-shot" data-act="viewImage" data-v="' + esc(urls[i]) + '"><img src="' + esc(urls[i]) + '" alt="Print de ' + esc(s.ff_nick) + '" loading="lazy"><span>' + I('eye') + 'Ampliar</span></button>' : '<span class="v-shot empty">' + I('image') + '</span>') +
          '<div class="v-info">' + ucell(s.user, esc(s.email || '') + ' · ' + U.ago(s.created_at)) +
          '<dl class="kv inline"><div><dt>Nick no jogo</dt><dd>' + esc(s.ff_nick) + '</dd></div><div><dt>ID</dt><dd class="mono">' + esc(s.ff_id) + '</dd></div></dl>' +
          (s.previous ? '<p class="muted small">Antes: ' + esc(s.previous.ff_nick || '–') + ' · ' + esc(s.previous.ff_id || '–') + ' (' + esc(s.previous.status || '') + ')</p>' : '<p class="muted small">Primeiro envio</p>') +
          (s.duplicates ? '<p class="note-red small">' + I('alert') + '<span>Esse ID aparece em outra conta.</span></p>' : '') +
          (s.status === 'pendente' ? '<div class="btn-row"><button type="button" class="btn green sm" data-act="aFf" data-ok="1" data-id="' + s.id + '">' + I('check') + 'Aprovar</button><button type="button" class="btn danger-ghost sm" data-act="aFf" data-ok="0" data-id="' + s.id + '">' + I('x') + 'Recusar</button></div>'
            : '<p class="muted small">' + (s.status === 'aprovado' ? 'Aprovado' : 'Recusado: ' + esc(s.note || '')) + (s.reviewed_by ? ' por ' + esc(s.reviewed_by.nick) : '') + '</p>') + '</div></article>').join('') + '</div>'
          : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhum envio nesse filtro</small></div>')
    };
  };
  actions.aFfStatus = (el) => { sa.ffStatus = el.dataset.v; app().rerender('soft'); };
  actions.aFf = async function (el) {
    const ok = el.dataset.ok === '1';
    let note = null;
    if (!ok) { note = await U.confirm({ title: 'Recusar verificação?', body: 'O jogador recebe o motivo e pode mandar outro print.', ok: 'Recusar', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: o ID do print não é o digitado', required: true } }); if (!note) return; }
    if (await U.run(el, () => api.rpc('admin_ff_review', { p_id: el.dataset.id, p_approve: ok, p_note: note }), ok ? 'ID verificado.' : 'Verificação recusada.')) refresh();
  };

  /* ---------- financeiro ---------- */
  SECTION.finance = async function () {
    const f = await api.rpc('admin_finance');
    const tabs = [{ id: 'depositos', label: 'Depósitos', badge: f.pending_deposits.length }, { id: 'saques', label: 'Saques', badge: f.pending_withdrawals.length }, { id: 'historico', label: 'Histórico' }, { id: 'receita', label: 'Receita' }];
    let content;
    if (sa.finTab === 'depositos') {
      content = f.pending_deposits.length ? '<p class="muted small">Depósitos pelo Mercado Pago confirmam sozinhos. Os manuais: procure no extrato do banco o valor e o código de referência.</p><div class="stack stagger">' + f.pending_deposits.map((d) => '<article class="pend">' + ucell(d.user, (d.provider === 'manual' ? 'Pix manual · ref. <b class="mono">' + esc(d.reference) + '</b>' : 'Mercado Pago · aguardando pagamento') + ' · ' + U.ago(d.created_at)) +
        '<b class="pend-amt pos">' + U.cents(d.amount_cents) + '</b><div class="btn-row"><button type="button" class="btn green sm" data-act="aDep" data-ok="1" data-id="' + d.id + '">' + I('check') + 'Pix recebido</button><button type="button" class="btn danger-ghost sm" data-act="aDep" data-ok="0" data-id="' + d.id + '">' + I('x') + 'Recusar</button></div></article>').join('') + '</div>'
        : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhum depósito pendente</small></div>';
    } else if (sa.finTab === 'saques') {
      content = f.pending_withdrawals.length ? '<p class="muted small">Faça o Pix pelo app do banco e depois marque como pago. Recusar devolve o valor para a carteira do jogador.</p><div class="stack stagger">' + f.pending_withdrawals.map((w) => '<article class="pend">' + ucell(w.user, esc(w.pix_key_type) + ': <b>' + esc(w.pix_key) + '</b> · ' + U.ago(w.created_at)) +
        '<b class="pend-amt neg">' + U.cents(w.amount_cents) + '</b>' + (w.verified ? '' : '<p class="note-red small">' + I('alert') + '<span>ID do Free Fire não verificado.</span></p>') +
        '<div class="btn-row"><button type="button" class="btn ghost sm" data-act="copy" data-v="' + esc(w.pix_key) + '">' + I('copy') + 'Copiar chave</button><button type="button" class="btn green sm" data-act="aWd" data-ok="1" data-id="' + w.id + '">' + I('check') + 'Marcar como pago</button><button type="button" class="btn danger-ghost sm" data-act="aWd" data-ok="0" data-id="' + w.id + '">' + I('x') + 'Recusar</button></div></article>').join('') + '</div>'
        : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhum saque pendente</small></div>';
    } else if (sa.finTab === 'historico') {
      content = '<ul class="tx-list full stagger">' + (f.history.length ? f.history.map((h) => '<li class="tx-row"><span class="tx-ic ' + (h.type === 'deposito' ? 'tone-green' : 'tone-red') + '">' + I(h.type === 'deposito' ? 'arrowIn' : 'arrowOut') + '</span><div class="tx-main"><b>' + esc(h.user.nick) + '</b><small>' + (h.type === 'deposito' ? 'Depósito' : 'Saque') + ' · ' + U.date(h.at) + (h.note ? ' · ' + esc(h.note) : '') + '</small></div><div class="tx-side"><b class="' + (h.status === 'recusado' || h.status === 'expirado' ? 'strike' : h.type === 'deposito' ? 'pos' : 'neg') + '">' + U.cents(h.amount_cents) + '</b><span class="chip tone-' + (h.status === 'aprovado' || h.status === 'pago' ? 'green' : 'red') + '">' + esc(h.status) + '</span></div></li>').join('') : '<li class="muted center pad">Nada ainda.</li>') + '</ul>';
    } else {
      content = '<ul class="tx-list full stagger">' + (f.revenue.length ? f.revenue.map((r) => '<li class="tx-row"><span class="tx-ic tone-cyan">' + I(r.kind === 'loja' ? 'bag' : 'percent') + '</span><div class="tx-main"><b>' + esc(r.note || r.kind) + '</b><small>' + ({ loja: 'Loja', taxa_sala: 'Taxa de sala', sala_oficial: 'Sala oficial', lucro_evento: 'Evento', cobertura_sala: 'Prêmio completado', cobertura_evento: 'Prêmio de evento completado' }[r.kind] || r.kind) + ' · ' + U.date(r.created_at) + '</small></div><div class="tx-side"><b class="' + (r.amount_cents < 0 ? 'neg' : 'pos') + '">' + (r.amount_cents < 0 ? '−' : '+') + U.cents(Math.abs(r.amount_cents)) + '</b></div></li>').join('') : '<li class="muted center pad">Sem receita ainda.</li>') + '</ul>';
    }
    return {
      html: '<div class="kpis four stagger">' + tile('arrowIn', 'green', f.deposits_total, 'Entrou', 'cents') + tile('arrowOut', 'red', f.withdrawals_total, 'Saiu', 'cents') + tile('wallet', 'violet', f.wallets_total, 'Saldo dos jogadores', 'cents') + tile('percent', 'cyan', f.revenue_total, 'Receita', 'cents') + '</div>' +
        '<p class="muted small">Chave Pix da plataforma: <b class="mono">' + esc(api.me.settings.pix_key || 'não configurada') + '</b></p>' +
        U.seg('fin', tabs, sa.finTab, 'aFinTab') + '<div class="fin-body">' + content + '</div>'
    };
  };
  actions.aFinTab = (el) => { sa.finTab = el.dataset.v; app().rerender('soft'); };
  actions.aDep = async function (el) {
    const ok = el.dataset.ok === '1';
    let note = null;
    if (ok && !(await U.confirm({ title: 'Confirmar o depósito?', body: 'Só confirme se o Pix já caiu na conta da plataforma. O saldo entra na hora.', ok: 'Confirmar', icon: 'checkCircle' }))) return;
    if (!ok) { note = await U.confirm({ title: 'Recusar depósito?', ok: 'Recusar', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: Pix não encontrado', required: true } }); if (!note) return; }
    if (await U.run(el, () => api.rpc('admin_deposit', { p_id: el.dataset.id, p_approve: ok, p_note: note }), ok ? 'Depósito confirmado.' : 'Depósito recusado.')) refresh();
  };
  actions.aWd = async function (el) {
    const ok = el.dataset.ok === '1';
    let note = null;
    if (ok && !(await U.confirm({ title: 'Marcar como pago?', body: 'Confirme que você já fez o Pix para a chave do jogador.', ok: 'Já paguei', icon: 'checkCircle' }))) return;
    if (!ok) { note = await U.confirm({ title: 'Recusar saque?', body: 'O valor volta para a carteira do jogador.', ok: 'Recusar', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: chave em nome de outra pessoa', required: true } }); if (!note) return; }
    if (await U.run(el, () => api.rpc('admin_withdrawal', { p_id: el.dataset.id, p_paid: ok, p_note: note }), ok ? 'Saque pago.' : 'Saque recusado e estornado.')) refresh();
  };

  /* ---------- salas ---------- */
  SECTION.rooms = async function () {
    const list = await api.rpc('admin_rooms', { p_status: sa.roomsTab, p_q: sa.roomsQ || null });
    return {
      html: '<div class="a-toolbar"><label class="search grow">' + I('search') + '<input id="ar-q" type="search" placeholder="Buscar sala por nome ou número" value="' + esc(sa.roomsQ) + '" data-input="adm.roomsQ" autocomplete="off"></label><button type="button" class="btn outline" data-act="aMove">' + I('move') + 'Mover jogador</button></div>' +
        U.chips([['ativas', 'Ativas'], ['encerradas', 'Encerradas'], ['todas', 'Todas']], sa.roomsTab, 'aRoomsTab') +
        '<p class="muted small">Abra a sala para iniciar, lançar resultado, remover jogadores ou cancelar com reembolso.</p>' +
        '<div class="stack stagger">' + (list.length ? list.map((r) => BH.roomCard(r).replace('data-act="openRoom"', 'data-act="aOpenRoom"')).join('') : U.empty('trophy', 'Nenhuma sala aqui', '')) + '</div>'
    };
  };
  actions.aRoomsTab = (el) => { sa.roomsTab = el.dataset.v; app().rerender('soft'); };
  actions.aMove = async function () {
    const rooms = await api.rpc('admin_rooms', { p_status: 'ativas', p_q: null });
    const open = rooms.filter((r) => r.status === 'aberta');
    U.sheet({
      title: 'Mover jogador', loading: false, data: { from: '', players: [] },
      body: (s) => '<form class="form" data-form="aMove"><p class="muted">O jogador sai da sala de origem com reembolso e entra na de destino pagando a inscrição dela.</p>' +
        '<label class="field"><span>Sala de origem</span><select id="mv-from" name="from" data-act-change="aMoveFrom"><option value="">Escolha</option>' + rooms.map((r) => '<option value="' + r.id + '"' + (s.data.from === r.id ? ' selected' : '') + '>#' + r.code + ' ' + esc(r.title) + ' (' + r.players + ')</option>').join('') + '</select></label>' +
        '<label class="field"><span>Jogador</span><select id="mv-user" name="user" required><option value="">' + (s.data.from ? 'Escolha' : 'Escolha a sala primeiro') + '</option>' + s.data.players.map((p) => '<option value="' + p.id + '">' + esc(p.nick) + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Sala de destino</span><select id="mv-to" name="to" required><option value="">Escolha</option>' + open.map((r) => '<option value="' + r.id + '">#' + r.code + ' ' + esc(r.title) + ' (' + r.players + '/' + r.max_players + ')</option>').join('') + '</select></label>' +
        '<button class="btn primary block">' + I('move') + 'Mover</button></form>'
    });
  };
  actions.aMoveFrom = async function (el) {
    const s = U.topSheet();
    s.data.from = el.value;
    s.data.players = el.value ? (await api.rpc('get_room', { p_id: el.value })).player_list : [];
    s.render('static');
  };
  forms.aMove = async function (f) {
    if (await U.run(f.querySelector('button'), () => api.rpc('admin_move_player', { p_user: f.user.value, p_from: f.from.value, p_to: f.to.value }), 'Jogador movido.')) { U.closeAll(); app().refresh(); }
  };

  /* ---------- denúncias ---------- */
  SECTION.reports = async function () {
    const list = await api.rpc('admin_reports', { p_status: sa.repStatus });
    return {
      html: U.chips([['aberta', 'Abertas', null, (api.me.admin_pending || {}).reports], ['resolvida', 'Resolvidas'], ['descartada', 'Descartadas']], sa.repStatus, 'aRepStatus') +
        (list.length ? '<div class="stack stagger">' + list.map((r) => '<article class="report"><header>' + ucell(r.target, U.plural(r.against_count, 'denúncia', 'denúncias') + ' contra') + '<span class="tag tone-red">' + I('flag') + esc(r.reason) + '</span></header>' +
          '<blockquote>' + esc(r.detail || 'Sem detalhes.') + '</blockquote><p class="muted small">Por ' + esc(r.reporter.nick) + (r.room ? ' · Sala #' + r.room.code : '') + ' · ' + U.ago(r.created_at) + (r.resolution ? ' · <b>' + esc(r.resolution) + '</b>' : '') + '</p>' +
          (r.status === 'aberta' ? '<div class="btn-row"><button type="button" class="btn ghost sm" data-act="aUser" data-id="' + r.target.id + '">' + I('user') + 'Ver conta</button><button type="button" class="btn green sm" data-act="aRep" data-s="resolvida" data-id="' + r.id + '">' + I('check') + 'Resolvida</button><button type="button" class="btn danger-ghost sm" data-act="aRep" data-s="descartada" data-id="' + r.id + '">' + I('x') + 'Descartar</button></div>' : '') + '</article>').join('') + '</div>'
          : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhuma denúncia nesse filtro</small></div>')
    };
  };
  actions.aRepStatus = (el) => { sa.repStatus = el.dataset.v; app().rerender('soft'); };
  actions.aRep = async function (el) {
    const note = await U.confirm({ title: el.dataset.s === 'resolvida' ? 'Marcar como resolvida' : 'Descartar denúncia', body: 'Quem denunciou recebe esta resposta.', ok: 'Salvar', icon: 'flag', input: { label: 'Resposta (opcional)', placeholder: el.dataset.s === 'resolvida' ? 'Ex.: conta suspensa por 7 dias' : 'Ex.: sem prova de hack' } });
    if (note === false) return;
    if (await U.run(el, () => api.rpc('admin_report_resolve', { p_id: el.dataset.id, p_status: el.dataset.s, p_note: note === true ? '' : note }), 'Denúncia atualizada.')) refresh();
  };

  /* ---------- guildas ---------- */
  SECTION.guilds = async function () {
    const list = await api.rpc('list_guilds', { p_q: null });
    return {
      html: '<div class="stack stagger">' + (list.length ? list.map((g) => '<article class="at-row"><div class="at-main" data-act="openGuild" data-id="' + g.id + '" role="button" tabindex="0"><div class="g-line"><span class="g-tag" style="--g1:' + esc(g.color) + '">' + esc(g.tag) + '</span><div class="grow"><h4>' + esc(g.name) + '</h4><p class="t-by">Líder ' + esc(g.leader.nick) + ' · ' + g.members + ' membros · ' + g.cut_pct + '% para o cofre</p></div></div></div>' +
        '<div class="at-actions"><button type="button" class="btn danger-ghost sm" data-act="aDissolve" data-id="' + g.id + '">' + I('trash') + 'Dissolver</button></div></article>').join('') : U.empty('shield', 'Nenhuma guilda', '')) + '</div>'
    };
  };
  actions.aDissolve = async function (el) {
    const reason = await U.confirm({ title: 'Dissolver guilda?', body: 'O cofre é dividido igualmente entre os membros. Não dá para desfazer.', ok: 'Dissolver', danger: true, input: { label: 'Motivo', required: true } });
    if (!reason) return;
    if (await U.run(el, () => api.rpc('admin_guild_dissolve', { p_id: el.dataset.id, p_reason: reason }), 'Guilda dissolvida.')) refresh();
  };

  /* ---------- avisos ---------- */
  SECTION.broadcast = async function () {
    const list = await api.rpc('admin_announcements');
    return {
      html: '<div class="a-cols"><section class="card"><h3 class="card-h">' + I('megaphone') + 'Novo aviso</h3><form class="form" data-form="aBroadcast">' +
        '<label class="field"><span>Título</span><input id="bc-title" name="title" maxlength="60" required placeholder="Ex.: Campeonato de sábado"></label>' +
        '<label class="field"><span>Mensagem</span><textarea id="bc-body" name="body" rows="3" maxlength="300" required></textarea></label>' +
        '<div class="radio-list row">' + [['todos', 'Todos'], ['verificados', 'Verificados'], ['criadores', 'Criadores'], ['staff', 'Equipe']].map((t, i) => '<label class="radio"><input type="radio" name="target" value="' + t[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + t[1] + '</span></label>').join('') + '</div>' +
        '<label class="switch"><input id="bc-pin" type="checkbox" name="pinned"><span class="sw" aria-hidden="true"></span><span>Fixar no topo do início</span></label>' +
        '<button class="btn primary block">' + I('send') + 'Enviar aviso</button></form></section>' +
        '<section class="card"><h3 class="card-h">' + I('history') + 'Enviados</h3><ul class="a-list">' + (list.length ? list.map((a) => '<li class="bc-item"><div class="grow"><b>' + esc(a.title) + (a.pinned ? '<span class="chip tone-gold">' + I('pinned') + 'Fixado</span>' : '') + '</b><p>' + esc(a.body) + '</p><small>' + U.date(a.created_at) + ' · ' + esc(a.target) + ' · ' + a.reach + ' contas</small></div><button type="button" class="btn ghost sm" data-act="aPin" data-id="' + a.id + '" data-v="' + (a.pinned ? '0' : '1') + '">' + (a.pinned ? 'Desafixar' : 'Fixar') + '</button></li>').join('') : '<li class="muted pad">Nenhum aviso.</li>') + '</ul></section></div>'
    };
  };
  forms.aBroadcast = async function (f) {
    if (!(await U.confirm({ title: 'Enviar aviso?', body: 'Todos do público escolhido recebem uma notificação agora.', ok: 'Enviar', icon: 'megaphone' }))) return;
    const r = await U.run(f.querySelector('button'), () => api.rpc('admin_broadcast', { p_title: f.title.value, p_body: f.body.value, p_target: new FormData(f).get('target'), p_pinned: f.pinned.checked }));
    if (r) { U.toast('Aviso enviado para ' + U.plural(r.reach, 'conta', 'contas') + '.', 'good'); refresh(); }
  };
  actions.aPin = async (el) => { if (await U.run(el, () => api.rpc('admin_pin', { p_id: Number(el.dataset.id), p_pinned: el.dataset.v === '1' }))) refresh(); };

  /* ---------- loja ---------- */
  SECTION.shop = async function () {
    const list = await api.rpc('admin_shop');
    const kinds = { banner: 'Banner', moldura: 'Moldura', titulo: 'Título', cor: 'Cor', prioridade: 'Prioridade' };
    return {
      html: '<div class="a-toolbar"><p class="muted small grow">Itens com preço aparecem na loja. Sem preço, só saem como recompensa de nível.</p><button type="button" class="btn primary" data-act="aItem">' + I('plus') + 'Novo item</button></div>' +
        '<div class="u-grid stagger">' + list.map((it) => '<article class="u-card' + (it.active ? '' : ' banned') + '"><header>' + (it.kind === 'banner' ? '<span class="banner-sw sm" style="background:' + esc(it.data.bg) + '"></span>' : '<span class="kpi-ic tone-violet">' + I({ moldura: 'user', titulo: 'hash', cor: 'palette', prioridade: 'zap' }[it.kind] || 'bag') + '</span>') +
          '<div class="grow"><b>' + esc(it.name) + '</b><small>' + kinds[it.kind] + ' · ' + (it.price_cents != null ? U.cents(it.price_cents) : 'recompensa' + (it.reward_level ? ' do nível ' + it.reward_level : '')) + (it.active ? '' : ' · desativado') + '</small></div></header>' +
          '<dl class="kv"><div><dt>Donos</dt><dd>' + it.owners + '</dd></div><div><dt>Receita</dt><dd>' + U.centsShort(it.revenue_cents) + '</dd></div></dl>' +
          '<button type="button" class="btn ghost block sm" data-act="aItem" data-id="' + esc(it.id) + '">' + I('edit') + 'Editar</button></article>').join('') + '</div>'
    };
  };
  actions.aItem = async function (el) {
    const list = el.dataset.id ? await api.rpc('admin_shop') : [];
    const it = list.find((x) => x.id === el.dataset.id) || { id: '', kind: 'banner', name: '', description: '', price_cents: 490, duration_days: null, data: { bg: 'linear-gradient(120deg,#3b0f7a,#7c3aed 50%,#c084fc)' }, active: true };
    U.sheet({
      title: it.id ? 'Editar item' : 'Novo item', loading: false,
      body: '<form class="form" data-form="aItem"><div class="grid2"><label class="field"><span>Código</span><input id="it-id" name="id" required value="' + esc(it.id) + '"' + (it.id ? ' readonly' : '') + ' placeholder="banner-verao"></label>' +
        '<label class="field"><span>Tipo</span><select id="it-kind" name="kind">' + ['banner', 'moldura', 'titulo', 'cor', 'prioridade'].map((k) => '<option' + (it.kind === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label></div>' +
        '<label class="field"><span>Nome</span><input id="it-name" name="name" required value="' + esc(it.name) + '"></label>' +
        '<label class="field"><span>Descrição</span><input id="it-desc" name="description" value="' + esc(it.description) + '"></label>' +
        '<div class="grid2"><label class="field money-field"><span>Preço (vazio = só recompensa)</span><b>R$</b><input id="it-price" name="price" inputmode="decimal" value="' + (it.price_cents != null ? U.centsInput(it.price_cents) : '') + '"></label>' +
        '<label class="field"><span>Dias (prioridade)</span><input id="it-days" name="days" type="number" inputmode="numeric" value="' + esc(it.duration_days || '') + '"></label></div>' +
        '<label class="field"><span>Visual (JSON): bg para banner, ring e glow para moldura, text para título, color para cor</span><textarea id="it-data" name="data" rows="3">' + esc(JSON.stringify(it.data || {})) + '</textarea></label>' +
        '<label class="switch"><input id="it-active" type="checkbox" name="active"' + (it.active ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Ativo</span></label>' +
        '<button class="btn primary block">' + I('check') + 'Salvar item</button></form>'
    });
  };
  forms.aItem = async function (f) {
    let data;
    try { data = JSON.parse(f.data.value || '{}'); } catch (e) { return U.toast('O visual precisa ser um JSON válido.', 'bad'); }
    const p = { id: f.id.value, kind: f.kind.value, name: f.name.value, description: f.description.value, price_cents: f.price.value.trim() ? U.toCents(f.price.value) : '', duration_days: f.days.value || '', data, active: f.active.checked };
    if (await U.run(f.querySelector('button'), () => api.rpc('admin_shop_save', { p }), 'Item salvo.')) { U.closeAll(); app().refresh(); }
  };

  /* ---------- evento do dia (segunda a domingo) ---------- */
  const THEME_MECH = ['first_blood', 'rei_lobby', 'destaque', 'sobrevivente', 'mvp', 'booyah', 'clutch', 'meta_abates'];
  const mname = (id) => ((api.me.mechanics || []).find((m) => m.id === id) || { name: id }).name;
  function themesEditor(s) {
    const themes = s.daily_themes || [], base = s.daily_base || {};
    const bm = Object.fromEntries((base.mechanics || []).map((m) => [m.type, m.cents]));
    const bp = Object.fromEntries((base.prizes || []).map((z) => [z.place, z.cents]));
    const val = (c) => (c ? U.centsInput(c) : '');
    return '<section class="card"><h3 class="card-h">' + I('calendar') + 'Evento do dia</h3><p class="muted small">Aparece no início do app e quem cria a sala aplica com um toque. Deixe o valor vazio para desligar a mecânica.</p>' +
      '<details class="day-ed" open><summary><b>Base fixa (todo dia)</b><small>kill paga, top 3 e líder</small></summary><div class="grid3">' +
      [1, 2, 3].map((n) => '<label class="field money-field"><span>' + n + 'º lugar</span><b>R$</b><input name="base_p' + n + '" inputmode="decimal" value="' + val(bp[n]) + '"></label>').join('') +
      '<label class="field money-field"><span>Kill paga</span><b>R$</b><input name="base_por_kill" inputmode="decimal" value="' + val(bm.por_kill) + '"></label><label class="field money-field"><span>Líder de abates</span><b>R$</b><input name="base_mvp" inputmode="decimal" value="' + val(bm.mvp) + '"></label></div></details>' +
      [1, 2, 3, 4, 5, 6, 0].map((dow) => {
        const t = themes.find((x) => x.dow === dow) || { dow, name: '', desc: '', mechanics: [] };
        const on = Object.fromEntries((t.mechanics || []).map((m) => [m.type, m.cents]));
        return '<details class="day-ed"><summary><b>' + BH.DOW[dow] + '</b><small>' + esc(t.name || 'sem tema') + '</small></summary>' +
          '<div class="grid2"><label class="field"><span>Nome do tema</span><input name="th_' + dow + '_name" maxlength="30" value="' + esc(t.name) + '"></label><label class="field"><span>Frase</span><input name="th_' + dow + '_desc" maxlength="80" value="' + esc(t.desc || '') + '"></label></div>' +
          '<div class="grid3">' + THEME_MECH.map((m) => '<label class="field money-field"><span>' + esc(mname(m)) + '</span><b>R$</b><input name="th_' + dow + '_' + m + '" inputmode="decimal" value="' + val(on[m]) + '"></label>').join('') + '</div></details>';
      }).join('') + '</section>';
  }
  function readThemes(f) {
    const out = [];
    [0, 1, 2, 3, 4, 5, 6].forEach((dow) => {
      const name = (f.querySelector('[name="th_' + dow + '_name"]') || {}).value || '';
      if (!name.trim()) return;
      const mechanics = THEME_MECH.map((m) => ({ type: m, cents: U.toCents((f.querySelector('[name="th_' + dow + '_' + m + '"]') || {}).value) })).filter((m) => m.cents > 0);
      out.push({ dow, name: name.trim(), desc: ((f.querySelector('[name="th_' + dow + '_desc"]') || {}).value || '').trim(), mechanics });
    });
    return out;
  }
  function readBase(f) {
    const v = (n) => U.toCents((f.querySelector('[name="' + n + '"]') || {}).value);
    return { name: 'Base fixa', prizes: [1, 2, 3].map((n) => ({ place: n, cents: v('base_p' + n) })).filter((z) => z.cents > 0),
      mechanics: [{ type: 'por_kill', cents: v('base_por_kill') }, { type: 'mvp', cents: v('base_mvp') }].filter((m) => m.cents > 0) };
  }

  /* ---------- eventos ---------- */
  const IDEAS = [
    ['Caça ao Rei', 'crown', 'Player Rei em todas as quedas da noite: quem eliminar o Rei leva o bônus; se o Rei sobreviver, o bônus é dele.'],
    ['Corrida de Abates', 'target', 'Meta de 5 abates: todo mundo que chegar à meta ganha. Premia quem joga agressivo mesmo sem vencer.'],
    ['Sobrevivência Extrema', 'heart', 'Sem kill paga: Sobrevivente top 5 e Booyah valendo mais. Premia o jogo estratégico.'],
    ['Noite do Sniper', 'crosshair', 'Só armas de precisão (regra da sala). Destaque da partida para o melhor jogador, escolhido pela organização.'],
    ['Rei da Colina', 'medal', 'Quem vencer uma queda defende o título na próxima; Domínio absoluto paga quem vence abatendo mais.'],
    ['Copa Iniciantes', 'star', 'Inscrição barata e prêmio garantido para trazer jogadores novos.'],
    ['Madrugada Relâmpago', 'zap', 'Copa de 3 quedas depois da meia-noite com XP em dobro.'],
    ['Guerra de Guildas', 'shield', 'Cada guilda inscreve várias lines; os pontos somam no ranking de guildas da semana.']
  ];
  SECTION.events = async function () {
    sa.evStatus = sa.evStatus || 'ativos';
    const list = await api.rpc('admin_events', { p_status: sa.evStatus });
    return {
      html: '<div class="a-toolbar"><p class="muted small grow">Eventos oficiais da plataforma. As quedas são salas oficiais: a plataforma garante os prêmios e fica com a sobra.</p><button type="button" class="btn primary" data-act="eventNew">' + I('plus') + 'Novo evento</button></div>' +
        U.chips([['ativos', 'Ativos'], ['encerrados', 'Encerrados'], ['todos', 'Todos']], sa.evStatus, 'aEvStatus') +
        '<div class="u-grid stagger">' + (list.length ? list.map(BH.eventCard).join('') : U.empty('medal', 'Nenhum evento', 'Crie a Liga Semanal, a Champions Series ou o Intensivo de Lines em "Novo evento".')) + '</div>' +
        '<section class="card"><h3 class="card-h">' + I('sparkles') + 'Ideias de eventos para o Free Fire</h3><ul class="ideas">' + IDEAS.map((x) => '<li>' + I(x[1]) + '<span><b>' + x[0] + '</b><small>' + x[2] + '</small></span></li>').join('') + '</ul>' +
        '<p class="muted small">Todas dá para montar com os formatos prontos e as mecânicas das salas (Player Rei, Meta de abates, Sobrevivente, Destaque, Domínio e XP em dobro).</p></section>'
    };
  };
  actions.aEvStatus = (el) => { sa.evStatus = el.dataset.v; app().rerender('soft'); };

  /* ---------- modelos de sala ---------- */
  SECTION.templates = async function () {
    const list = await api.rpc('admin_templates');
    return {
      html: '<div class="a-toolbar"><p class="muted small grow">Modelos prontos que aparecem ao criar sala. Os exclusivos só aparecem para a administração (salas oficiais).</p><button type="button" class="btn primary" data-act="aTpl">' + I('plus') + 'Novo modelo</button></div>' +
        '<div class="u-grid stagger">' + list.map((t) => {
          const prize = t.prizes.reduce((a, z) => a + Number(z.cents), 0), pot = t.entry_cents * t.max_players;
          return '<article class="u-card tpl-card t-' + esc(t.tier) + (t.active ? '' : ' banned') + '"><header><span class="kpi-ic">' + I('gem') + '</span><div class="grow"><b>' + esc(t.name) + '</b><small>' + (BH.TIERS[t.tier] || [t.tier])[0] + (t.official_only ? ' · exclusivo oficial' : '') + (t.active ? '' : ' · desativado') + '</small></div></header>' +
            '<dl class="kv"><div><dt>Inscrição</dt><dd>' + (t.entry_cents ? U.centsShort(t.entry_cents) : 'Grátis') + '</dd></div><div><dt>Prêmios</dt><dd>' + U.centsShort(prize) + '</dd></div><div><dt>Vagas</dt><dd>' + t.max_players + '</dd></div></dl>' +
            (pot ? '<p class="muted small">Sala cheia: ' + U.cents(pot) + ' · prêmios por colocação ' + Math.round(prize * 100 / pot) + '%</p>' : '') +
            '<div class="mech-row">' + BH.mechChips(t.mechanics) + '</div>' +
            '<div class="btn-row two"><button type="button" class="btn ghost sm" data-act="aTpl" data-id="' + esc(t.id) + '">' + I('edit') + 'Editar</button><button type="button" class="btn danger-ghost sm" data-act="aTplDel" data-id="' + esc(t.id) + '">' + I('trash') + 'Apagar</button></div></article>';
        }).join('') + '</div>'
    };
  };
  actions.aTpl = async function (el) {
    const list = el.dataset.id ? await api.rpc('admin_templates') : [];
    const t = list.find((x) => x.id === el.dataset.id) || { id: '', name: '', tier: 'base', description: '', mode: 'Battle Royale', team_size: 1, map: 'Bermuda', max_players: 48, entry_cents: 500, prizes: [{ place: 1, cents: 5000 }], mechanics: [], rules: '', xp_mult: 1, official_only: false, active: true };
    const mech = Object.fromEntries(t.mechanics.map((m) => [m.type, m]));
    U.sheet({
      title: t.id ? 'Editar modelo' : 'Novo modelo', size: 'lg', loading: false,
      body: '<form class="form" data-form="aTpl"><div class="grid2"><label class="field"><span>Código</span><input name="id" required value="' + esc(t.id) + '"' + (t.id ? ' readonly' : '') + ' placeholder="sala-noturna"></label>' +
        '<label class="field"><span>Nível</span><select name="tier">' + Object.keys(BH.TIERS).map((k) => '<option value="' + k + '"' + (t.tier === k ? ' selected' : '') + '>' + BH.TIERS[k][0] + '</option>').join('') + '</select></label></div>' +
        '<label class="field"><span>Nome</span><input name="title" required maxlength="60" value="' + esc(t.name) + '"></label>' +
        '<label class="field"><span>Descrição</span><input name="description" maxlength="200" value="' + esc(t.description) + '"></label>' +
        '<div class="grid3"><label class="field"><span>Formato</span><select name="team_size">' + [[1, 'Solo'], [2, 'Dupla'], [4, 'Squad']].map((x) => '<option value="' + x[0] + '"' + (t.team_size === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Vagas</span><input name="max_players" type="number" inputmode="numeric" value="' + t.max_players + '"></label>' +
        '<label class="field money-field"><span>Inscrição</span><b>R$</b><input name="entry" inputmode="decimal" value="' + U.centsInput(t.entry_cents) + '"></label></div>' +
        '<label class="field"><span>Prêmios por colocação (1º; 2º; 3º...)</span><input name="prizes" value="' + esc(t.prizes.map((z) => U.centsInput(z.cents)).join('; ')) + '"></label>' +
        '<h3 class="form-h">' + I('sparkles') + 'Mecânicas (vazio = desligada)</h3><div class="grid3">' + (api.me.mechanics || []).map((m) => '<label class="field money-field"><span>' + esc(m.name) + '</span><b>R$</b><input name="m_' + m.id + '" inputmode="decimal" value="' + (mech[m.id] ? U.centsInput(mech[m.id].cents) : '') + '"></label>').join('') + '</div>' +
        '<label class="field"><span>Regras</span><textarea name="rules" rows="3">' + esc(t.rules) + '</textarea></label>' +
        '<label class="switch"><input type="checkbox" name="official_only"' + (t.official_only ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Exclusivo das salas oficiais</span></label>' +
        '<label class="switch"><input type="checkbox" name="active"' + (t.active ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Ativo</span></label>' +
        '<button class="btn primary block">' + I('check') + 'Salvar modelo</button></form>'
    });
  };
  forms.aTpl = async function (f) {
    const g = (n) => f.querySelector('[name="' + n + '"]');
    const p = { id: g('id').value, tier: g('tier').value, title: g('title').value, description: g('description').value, team_size: Number(g('team_size').value), max_players: Number(g('max_players').value),
      entry_cents: U.toCents(g('entry').value), rules: g('rules').value, official_only: g('official_only').checked, active: g('active').checked,
      prizes: g('prizes').value.split(';').map((x) => x.trim()).filter(Boolean).map((x, i) => ({ place: i + 1, cents: U.toCents(x) })).filter((z) => z.cents > 0),
      mechanics: (api.me.mechanics || []).map((m) => ({ type: m.id, cents: U.toCents(g('m_' + m.id).value) })).filter((m) => m.cents > 0) };
    if (await U.run(f.querySelector('button'), () => api.rpc('admin_template_save', { p }), 'Modelo salvo.')) { U.closeAll(); app().refresh(); }
  };
  actions.aTplDel = async function (el) {
    if (!(await U.confirm({ title: 'Apagar modelo?', body: 'As salas já criadas com ele não mudam.', ok: 'Apagar', danger: true }))) return;
    if (await U.run(el, () => api.rpc('admin_template_delete', { p_id: el.dataset.id }), 'Modelo apagado.')) app().refresh();
  };

  /* ---------- configurações ---------- */
  SECTION.settings = async function () {
    const s = await api.rpc('admin_get_settings');
    const xp = s.xp || {};
    const money = (name, label, v) => '<label class="field money-field"><span>' + label + '</span><b>R$</b><input id="st-' + name + '" name="' + name + '" inputmode="decimal" value="' + U.centsInput(v) + '"></label>';
    return {
      html: '<form class="form settings" data-form="aSettings">' +
        '<section class="card"><h3 class="card-h">' + I('qr') + 'Pix da plataforma</h3><p class="muted small">Usado nos depósitos manuais (QR Pix gerado no app). Com o Mercado Pago configurado, os depósitos confirmam sozinhos.</p>' +
        '<label class="field"><span>Chave Pix</span><input id="st-pix" name="pix_key" maxlength="80" value="' + esc(s.pix_key) + '" placeholder="CNPJ, e-mail, telefone ou chave aleatória"></label>' +
        '<div class="grid2"><label class="field"><span>Nome do recebedor</span><input id="st-pixname" name="pix_name" maxlength="25" value="' + esc(s.pix_name) + '"></label><label class="field"><span>Cidade</span><input id="st-pixcity" name="pix_city" maxlength="15" value="' + esc(s.pix_city) + '"></label></div></section>' +
        '<section class="card"><h3 class="card-h">' + I('percent') + 'Taxas e limites</h3>' +
        '<label class="field"><span>Parte da plataforma na arrecadação das salas dos organizadores: <b id="st-fee-v">' + s.platform_fee_pct + '%</b></span><input id="st-fee" name="platform_fee_pct" type="range" min="0" max="50" step="1" value="' + s.platform_fee_pct + '"></label>' +
        '<p class="muted small">Ex.: sala de 48 × R$ 5 = R$ 240. Com ' + s.platform_fee_pct + '%, a plataforma recebe ' + U.cents(Math.floor(24000 * s.platform_fee_pct / 100)) + ' quando a sala acaba. Nunca passa da sobra, então o prêmio dos jogadores vem sempre primeiro. Dá para combinar uma taxa diferente com cada organizador em Usuários.</p>' +
        '<label class="field"><span>Mínimo que os jogadores precisam poder receber: <b id="st-mp-v">' + s.min_player_pct + '%</b> da arrecadação</span><input id="st-mp" name="min_player_pct" type="range" min="0" max="90" step="5" value="' + s.min_player_pct + '"></label>' +
        '<label class="field"><span>Máximo que uma guilda pode guardar dos prêmios: <b id="st-gc-v">' + s.max_guild_cut_pct + '%</b></span><input id="st-gc" name="max_guild_cut_pct" type="range" min="0" max="50" step="1" value="' + s.max_guild_cut_pct + '"></label>' +
        '<div class="grid2">' + money('min_deposit', 'Depósito mínimo', s.min_deposit_cents) + money('max_deposit', 'Depósito máximo', s.max_deposit_cents) + money('min_withdraw', 'Saque mínimo', s.min_withdraw_cents) + money('max_withdraw', 'Saque máximo', s.max_withdraw_cents) + '</div>' +
        money('max_entry', 'Inscrição máxima por sala', s.max_entry_cents) + '</section>' +
        themesEditor(s) +
        '<section class="card"><h3 class="card-h">' + I('sparkles') + 'XP por ação</h3><div class="grid3">' + [['participar', 'Participar'], ['abate', 'Abate'], ['top3', 'Top 3'], ['vitoria', 'Vitória'], ['first_blood', 'Primeiro abate'], ['rei', 'Eliminar o Rei'], ['premio', 'Receber prêmio']]
          .map((x) => '<label class="field"><span>' + x[1] + '</span><input id="st-xp-' + x[0] + '" name="xp_' + x[0] + '" type="number" inputmode="numeric" min="0" max="1000" value="' + (xp[x[0]] || 0) + '"></label>').join('') + '</div></section>' +
        '<section class="card"><h3 class="card-h">' + I('sliders') + 'Regras</h3>' +
        '<label class="switch"><input id="st-vw" type="checkbox" name="require_verified_withdraw"' + (s.require_verified_withdraw ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Saque só com ID do Free Fire verificado</span></label>' +
        '<label class="switch"><input id="st-vp" type="checkbox" name="require_verified_paid"' + (s.require_verified_paid ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Salas pagas só com ID verificado</span></label>' +
        '<label class="switch warn"><input id="st-mt" type="checkbox" name="maintenance"' + (s.maintenance ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Modo manutenção <small>Só a equipe entra no app</small></span></label></section>' +
        '<button class="btn primary block lg">' + I('check') + 'Salvar configurações</button></form>',
      onMount(root) {
        [['st-fee', 'st-fee-v'], ['st-gc', 'st-gc-v'], ['st-mp', 'st-mp-v']].forEach(([a, b]) => { const r = root.querySelector('#' + a); if (r) r.addEventListener('input', () => { root.querySelector('#' + b).textContent = r.value + '%'; }); });
      }
    };
  };
  forms.aSettings = async function (f) {
    const g = (n) => f.querySelector('[name="' + n + '"]');
    const p = {
      pix_key: g('pix_key').value.trim(), pix_name: g('pix_name').value.trim(), pix_city: g('pix_city').value.trim(),
      platform_fee_pct: Number(g('platform_fee_pct').value), max_guild_cut_pct: Number(g('max_guild_cut_pct').value), min_player_pct: Number(g('min_player_pct').value),
      daily_themes: readThemes(f), daily_base: readBase(f),
      min_deposit_cents: U.toCents(g('min_deposit').value), max_deposit_cents: U.toCents(g('max_deposit').value),
      min_withdraw_cents: U.toCents(g('min_withdraw').value), max_withdraw_cents: U.toCents(g('max_withdraw').value), max_entry_cents: U.toCents(g('max_entry').value),
      require_verified_withdraw: g('require_verified_withdraw').checked, require_verified_paid: g('require_verified_paid').checked, maintenance: g('maintenance').checked,
      xp: Object.fromEntries(['participar', 'abate', 'top3', 'vitoria', 'first_blood', 'rei', 'premio'].map((k) => [k, Number(g('xp_' + k).value) || 0]))
    };
    if (await U.run(f.querySelector('button.primary'), () => api.rpc('admin_set_settings', { p }), 'Configurações salvas.')) refresh();
  };

  /* ---------- auditoria ---------- */
  SECTION.logs = async function () {
    const list = await api.rpc('admin_logs', { p_q: sa.logQ || null });
    return {
      html: '<label class="search">' + I('search') + '<input id="al-q" type="search" placeholder="Buscar por pessoa, ação ou alvo" value="' + esc(sa.logQ) + '" data-input="adm.logQ" autocomplete="off"></label>' +
        '<p class="muted small">Cada ação da equipe e dos organizadores fica gravada aqui.</p><section class="card"><ul class="log-list stagger">' + (list.length ? list.map(logRow).join('') : '<li class="muted pad">Nenhum registro.</li>') + '</ul></section>'
    };
  };
})();
