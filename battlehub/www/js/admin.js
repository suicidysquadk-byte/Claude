/* Painel administrativo */
window.BH = window.BH || {};
(function () {
  const S = BH.store, U = BH.ui, I = BH.icon, A = BH.act;
  const esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms;
  const app = () => BH.app;
  const st = BH.state;
  st.admin = Object.assign({ section: 'overview', uFilter: 'todos', uSearch: '', tFilter: 'abertos', tSearch: '', finTab: 'depositos', histFilter: 'tudo', vFilter: 'pendente', rFilter: 'aberta', logSearch: '' }, st.admin || {});
  const sa = st.admin;

  const SECTIONS = [
    { id: 'overview', label: 'Visão geral', icon: 'dashboard', perm: 'access' },
    { id: 'users', label: 'Usuários', icon: 'users', perm: 'users' },
    { id: 'tournaments', label: 'Torneios', icon: 'trophy', perm: 'tournaments' },
    { id: 'finance', label: 'Financeiro', icon: 'dollar', perm: 'finance' },
    { id: 'verify', label: 'Verificações', icon: 'badgeCheck', perm: 'verify' },
    { id: 'reports', label: 'Denúncias', icon: 'flag', perm: 'reports' },
    { id: 'guilds', label: 'Guildas', icon: 'shield', perm: 'guilds' },
    { id: 'broadcast', label: 'Avisos', icon: 'megaphone', perm: 'broadcast' },
    { id: 'settings', label: 'Configurações', icon: 'settings', perm: 'settings' },
    { id: 'logs', label: 'Auditoria', icon: 'file', perm: 'logs' }
  ];
  function badgeFor(id, p) {
    return id === 'finance' ? p.depositos + p.saques : id === 'verify' ? p.verificacoes : id === 'reports' ? p.denuncias : 0;
  }
  const chips = (list, cur, act) => '<div class="chips">' + list.map((c) => '<button type="button" class="chip-btn' + (cur === c[0] ? ' on' : '') + '" data-act="' + act + '" data-v="' + c[0] + '">' + c[1] + (c[2] ? '<b class="dot-count">' + c[2] + '</b>' : '') + '</button>').join('') + '</div>';
  const tile = (icon, tone, value, label, fmt, extra) => '<div class="kpi tone-' + tone + '"><span class="kpi-ic">' + I(icon) + '</span><div>' + U.num(value, fmt, 'kpi-num') + '<small>' + label + '</small>' + (extra || '') + '</div></div>';
  const userCell = (u, sub) => '<span class="ucell">' + U.avatar(u, 'sm') + '<span><b>' + (u ? esc(u.nick) : 'Conta excluída') + U.verified(u) + '</b><small>' + (sub != null ? sub : u ? esc(u.email) : '') + '</small></span></span>';

  pages.admin = function (p) {
    const m = S.me();
    if (!S.can('access')) return { html: '<section class="page">' + BH.backRow() + U.empty('lock', 'Acesso restrito', 'Só a equipe BattleHub acessa o painel.') + '</section>' };
    const list = SECTIONS.filter((s) => S.can(s.perm));
    if (p && p.section) sa.section = p.section;
    if (!list.some((s) => s.id === sa.section)) sa.section = 'overview';
    const cur = list.find((s) => s.id === sa.section);
    const pend = S.pendingCounts();
    const nav = (cls) => list.map((s) => { const b = badgeFor(s.id, pend); return '<button type="button" class="' + cls + (s.id === sa.section ? ' on' : '') + '" data-act="aSection" data-v="' + s.id + '">' + I(s.icon) + '<span>' + s.label + '</span>' + (b ? '<b class="dot-count">' + b + '</b>' : '') + '</button>'; }).join('');
    const body = SECTION[sa.section]();
    return {
      hideNav: true, bare: true, className: 'admin-mode',
      html: '<div class="admin">' +
        '<aside class="a-side">' + BH.logo() + '<p class="eyebrow">Painel admin</p><nav class="a-side-nav">' + nav('a-link') + '</nav>' +
        '<button type="button" class="a-link back-app" data-act="exitAdmin">' + I('back') + '<span>Voltar ao app</span></button></aside>' +
        '<div class="a-main"><header class="a-head"><button type="button" class="icon-btn" data-act="exitAdmin" aria-label="Voltar ao app">' + I('back') + '</button>' +
        '<div class="grow"><p class="eyebrow">' + I('crown') + 'Painel admin</p><h1 class="h1">' + cur.label + '</h1></div>' +
        '<span class="a-me">' + U.avatar(m, 'sm') + '<span><b>' + esc(m.nick) + '</b><small>' + S.ROLE_NAME[m.role] + '</small></span></span></header>' +
        '<nav class="a-tabs" aria-label="Seções do painel">' + nav('a-tab') + '</nav>' +
        '<div class="a-body" data-section="' + sa.section + '">' + body.html + '</div></div></div>',
      onMount: body.onMount
    };
  };
  actions.admin = (el) => { U.closeAll(); sa.section = (el && el.dataset.v) || 'overview'; app().push('admin', { section: sa.section }); };
  actions.aSection = (el) => { sa.section = el.dataset.v; app().replace('admin', { section: sa.section }); window.scrollTo(0, 0); };
  actions.exitAdmin = () => { app().back(); };

  const SECTION = {};

  /* ---------- visão geral ---------- */
  SECTION.overview = function () {
    const db = S.db, m = S.me(), p = S.pendingCounts(), f = S.financeTotals();
    const series = S.financeSeries(14);
    const labels = series.map((d) => { const x = new Date(d.start); return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0'); });
    const week = Date.now() - 7 * S.DAY;
    const newUsers = db.users.filter((u) => u.createdAt >= week).length;
    const activeT = db.tournaments.filter((t) => t.status === 'aberto' || t.status === 'ao_vivo');
    const rev14 = db.tx.filter((x) => x.type === 'taxa' && x.at >= Date.now() - 14 * S.DAY).reduce((s, x) => s + x.amount, 0);
    const volume14 = series.reduce((s, d) => s + d.entrou, 0);
    const tierCounts = S.TIERS.map((t, i) => ({ label: t.name, value: db.users.filter((u) => !u.banned && S.tierOf(u.elo).tier.id === t.id).length, color: t.color }));
    const upcoming = activeT.slice().sort((a, b) => (a.status === 'ao_vivo' ? -1 : 0) - (b.status === 'ao_vivo' ? -1 : 0) || a.startsAt - b.startsAt).slice(0, 5);
    const todo = [
      ['finance', 'depositos', 'arrowIn', 'Depósitos para confirmar', p.depositos, S.can('finance')],
      ['finance', 'saques', 'arrowOut', 'Saques para pagar', p.saques, S.can('finance')],
      ['verify', null, 'badgeCheck', 'Verificações', p.verificacoes, S.can('verify')],
      ['reports', null, 'flag', 'Denúncias abertas', p.denuncias, S.can('reports')]
    ].filter((x) => x[5]);
    return {
      html: '<p class="a-hello">Olá, ' + esc(m.nick) + '. ' + (todo.some((x) => x[4]) ? 'Tem ' + U.plural(todo.reduce((s, x) => s + x[4], 0), 'pendência', 'pendências') + ' esperando por você.' : 'Nenhuma pendência agora.') + '</p>' +
        '<div class="todo stagger">' + todo.map((x) => '<button type="button" class="todo-item ripple' + (x[4] ? ' hot' : '') + '" data-act="aGo" data-v="' + x[0] + '"' + (x[1] ? ' data-tab="' + x[1] + '"' : '') + '><span class="todo-ic">' + I(x[2]) + '</span><b>' + x[4] + '</b><small>' + x[3] + '</small></button>').join('') + '</div>' +
        '<div class="kpis stagger">' +
        tile('users', 'violet', db.users.length, 'Usuários', null, '<em>+' + newUsers + ' em 7 dias</em>') +
        tile('trophy', 'gold', activeT.length, 'Torneios ativos', null, '<em>' + p.aoVivo + ' ao vivo agora</em>') +
        (S.can('finance') ? tile('arrowIn', 'green', volume14, 'Depósitos em 14 dias', 'money', U.spark(series.map((d) => d.entrou), '#34d399')) +
          tile('percent', 'cyan', f.receita, 'Receita da plataforma', 'money', '<em>' + U.money(rev14) + ' em 14 dias</em>') : '') +
        '</div>' +
        (S.can('finance') ? '<section class="card"><header class="card-row"><h3 class="card-h">' + I('chart') + 'Entradas e saídas · 14 dias</h3><div class="legend"><span><i style="background:#34d399"></i>Entrou</span><span><i style="background:#fb7185"></i>Saiu</span></div></header>' +
          U.areaChart([{ name: 'Entrou', color: '#34d399', values: series.map((d) => d.entrou) }, { name: 'Saiu', color: '#fb7185', values: series.map((d) => d.saiu) }], labels, { label: 'Entradas e saídas por dia' }) + '</section>' : '') +
        '<div class="a-cols"><section class="card"><header class="card-row"><h3 class="card-h">' + I('radio') + 'Ao vivo e próximos</h3><button type="button" class="link" data-act="aGo" data-v="tournaments">Todos' + I('right') + '</button></header>' +
        '<ul class="a-list">' + (upcoming.length ? upcoming.map((t) => '<li><button type="button" class="a-row ripple" data-act="openT" data-id="' + t.id + '"><div class="grow"><b>' + esc(t.name) + '</b><small>' + S.count(t) + '/' + t.max + ' · ' + (t.status === 'ao_vivo' ? 'em andamento' : U.when(t.startsAt)) + '</small></div>' + (t.status === 'ao_vivo' ? U.status(t) : '<span class="mono small" data-until="' + t.startsAt + '">' + U.until(t.startsAt) + '</span>') + '</button></li>').join('') : '<li class="muted pad">Nenhum torneio ativo.</li>') + '</ul></section>' +
        '<section class="card"><h3 class="card-h">' + I('gem') + 'Jogadores por tier</h3>' + U.barChart(tierCounts, { label: 'Jogadores por tier', height: 180 }) + '</section></div>' +
        (S.can('logs') ? '<section class="card"><header class="card-row"><h3 class="card-h">' + I('history') + 'Atividade recente</h3><button type="button" class="link" data-act="aGo" data-v="logs">Auditoria' + I('right') + '</button></header><ul class="log-list">' + db.logs.slice(0, 6).map(logRow).join('') + '</ul></section>' : '')
    };
  };
  actions.aGo = (el) => { sa.section = el.dataset.v; if (el.dataset.tab) sa.finTab = el.dataset.tab; app().replace('admin', { section: sa.section }); window.scrollTo(0, 0); };
  function logRow(l) {
    const by = S.user(l.by);
    return '<li class="log">' + U.avatar(by, 'xs') + '<div class="grow"><p><b>' + (by ? esc(by.nick) : 'Sistema') + '</b> ' + esc(l.action.toLowerCase()) + (l.target ? ' <b>' + esc(l.target) + '</b>' : '') + '</p>' + (l.detail ? '<small>' + esc(l.detail) + '</small>' : '') + '</div><small class="mono" data-ago="' + l.at + '">' + U.ago(l.at) + '</small></li>';
  }

  /* ---------- usuários ---------- */
  SECTION.users = function () {
    const db = S.db, q = sa.uSearch.trim().toLowerCase();
    let list = db.users.slice();
    const f = sa.uFilter;
    if (f === 'verificados') list = list.filter((u) => u.verified);
    if (f === 'pendentes') list = list.filter((u) => !u.verified && !u.banned);
    if (f === 'staff') list = list.filter((u) => S.level(u) >= 1);
    if (f === 'banidos') list = list.filter((u) => u.banned);
    if (q) list = list.filter((u) => (u.nick + ' ' + u.email + ' ' + u.code + ' ' + u.id + ' ' + (u.ff.id || '')).toLowerCase().includes(q));
    list.sort((a, b) => S.level(b) - S.level(a) || b.createdAt - a.createdAt);
    return {
      html: '<div class="kpis four stagger">' +
        tile('users', 'violet', db.users.length, 'Total') + tile('badgeCheck', 'cyan', db.users.filter((u) => u.verified).length, 'Verificados') +
        tile('shieldCheck', 'gold', db.users.filter((u) => S.level(u) >= 1).length, 'Staff') + tile('ban', 'red', db.users.filter((u) => u.banned).length, 'Banidos') + '</div>' +
        '<label class="search">' + I('search') + '<input id="au-search" type="search" placeholder="Buscar por ID, nickname, e-mail ou ID do Free Fire" value="' + esc(sa.uSearch) + '" data-input="admin.uSearch" autocomplete="off"></label>' +
        chips([['todos', 'Todos'], ['verificados', 'Verificados'], ['pendentes', 'Não verificados'], ['staff', 'Staff'], ['banidos', 'Banidos']], f, 'aUFilter') +
        '<p class="muted small">' + U.plural(list.length, 'conta', 'contas') + '</p>' +
        '<div class="u-grid stagger">' + (list.length ? list.map((u) => '<article class="u-card' + (u.banned ? ' banned' : '') + '">' +
          '<header>' + U.avatar(u, 'md') + '<div class="grow"><b>' + esc(u.nick) + U.verified(u) + '</b><small>' + esc(u.email) + '</small><div class="p-badges">' + '<span class="chip mono">' + u.code + '</span>' + U.role(u) + (u.banned ? '<span class="tag tone-red">' + I('ban') + 'Banido</span>' : '') + '</div></div></header>' +
          '<dl class="kv"><div><dt>Saldo</dt><dd>' + U.money(u.balance) + '</dd></div><div><dt>ELO</dt><dd>' + U.int(u.elo) + '</dd></div><div><dt>Vitórias</dt><dd>' + u.stats.wins + '</dd></div></dl>' +
          '<button type="button" class="btn outline block sm" data-act="aUser" data-id="' + u.id + '">' + I('sliders') + 'Gerenciar conta</button></article>').join('')
          : U.empty('search', 'Nenhuma conta encontrada', 'Tente outro termo ou filtro.')) + '</div>'
    };
  };
  actions.aUFilter = (el) => { sa.uFilter = el.dataset.v; app().rerender('soft'); };

  actions.aUser = function (el) {
    const id = el.dataset.id;
    U.closeAll();
    U.sheet({
      title: 'Gerenciar conta', size: 'lg', data: { sign: 1, id },
      body: (api) => {
        const u = S.user(id), m = S.me();
        if (!u) return U.empty('user', 'Conta não encontrada', 'Ela pode ter sido excluída.');
        const tx = S.db.tx.filter((x) => x.userId === u.id).sort((a, b) => b.at - a.at).slice(0, 5);
        const tCount = S.db.tournaments.filter((t) => t.participants.includes(u.id)).length;
        const v = S.verificationOf(u.id);
        const roleOpts = [{ id: 'jogador', label: 'Jogador' }, { id: 'moderador', label: 'Moderador' }, { id: 'admin', label: 'Admin' }];
        const canRole = S.can('roles') && u.id !== m.id && u.role !== 'owner' && S.level(u) < S.level(m);
        const canBan = S.can('ban') && u.id !== m.id && S.level(u) < S.level(m);
        return '<div class="mu-head">' + U.avatar(u, 'lg') + '<div><h3>' + esc(u.nick) + U.verified(u) + '</h3><p class="muted">' + esc(u.email) + '</p><div class="p-badges"><button type="button" class="chip mono" data-act="copy" data-v="' + u.code + '">' + I('hash') + u.code + '</button>' + U.tier(u.elo, true) + U.role(u) + (u.banned ? '<span class="tag tone-red">' + I('ban') + 'Banido</span>' : '') + '</div></div></div>' +
          (u.banned ? '<p class="note-red">' + I('ban') + '<span>Banido: ' + esc(u.banReason) + '</span></p>' : '') +
          '<div class="tiles3 four"><div class="tile tone-green"><b>' + U.money(u.balance) + '</b><small>Saldo</small></div><div class="tile"><b>' + u.stats.wins + '</b><small>Vitórias</small></div><div class="tile"><b>' + tCount + '</b><small>Torneios</small></div><div class="tile"><b>' + U.date(u.createdAt).slice(0, 5) + '</b><small>Cadastro</small></div></div>' +
          '<section class="mu-sec"><h4>Free Fire</h4><dl class="kv inline"><div><dt>ID</dt><dd class="mono">' + (esc(u.ff.id) || '–') + '</dd></div><div><dt>Nick</dt><dd>' + (esc(u.ff.nick) || '–') + '</dd></div><div><dt>Level</dt><dd>' + (esc(u.ff.level) || '–') + '</dd></div><div><dt>Rank</dt><dd>' + (esc(u.ff.rank) || '–') + '</dd></div></dl>' +
          '<div class="btn-row"><button type="button" class="btn ' + (u.verified ? 'ghost' : 'primary') + ' sm" data-act="aVerifyToggle" data-id="' + u.id + '"' + (S.can('verify') ? '' : ' disabled') + '>' + I('badgeCheck') + (u.verified ? 'Remover verificação' : 'Marcar como verificada') + '</button>' + (v && v.status === 'pendente' ? '<button type="button" class="btn gold sm" data-act="aGoVerify">' + I('eye') + 'Ver print enviado</button>' : '') + '</div></section>' +
          (S.can('roles') ? '<section class="mu-sec"><h4>Cargo</h4>' + (canRole ? U.seg('role-' + u.id, roleOpts, u.role, 'aRole') : '<p class="muted small">' + (u.id === m.id ? 'Você não pode mudar o próprio cargo.' : 'Cargo de ' + S.ROLE_NAME[u.role] + ' não pode ser alterado por você.') + '</p>') + '</section>' : '') +
          (S.can('balance') ? '<section class="mu-sec"><h4>Ajustar saldo</h4><form class="form tight" data-form="aBalance" data-id="' + u.id + '">' +
            '<div class="sign-toggle">' + [[1, 'Creditar', 'plus'], [-1, 'Debitar', 'minus']].map((s) => '<button type="button" class="' + (api.data.sign === s[0] ? 'on ' + (s[0] > 0 ? 'good' : 'bad') : '') + '" data-act="aSign" data-v="' + s[0] + '">' + I(s[2]) + s[1] + '</button>').join('') + '</div>' +
            '<div class="grid2"><label class="field money-field"><span>Valor</span><b>R$</b><input id="ab-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required placeholder="0,00"></label>' +
            '<label class="field"><span>Motivo</span><input id="ab-reason" name="reason" required maxlength="80" placeholder="Ex.: bônus de indicação"></label></div>' +
            '<button class="btn ' + (api.data.sign > 0 ? 'green' : 'danger') + ' block sm">' + I('wallet') + (api.data.sign > 0 ? 'Creditar saldo' : 'Debitar saldo') + '</button></form>' +
            '<form class="form tight row" data-form="aElo" data-id="' + u.id + '"><label class="field grow"><span>ELO</span><input id="ae-elo" name="elo" type="number" inputmode="numeric" min="0" max="4000" value="' + u.elo + '"></label><button class="btn ghost sm">' + I('zap') + 'Salvar ELO</button></form></section>' : '') +
          '<section class="mu-sec"><h4>Enviar notificação</h4><form class="form tight" data-form="aNotify" data-id="' + u.id + '"><label class="field"><span>Título</span><input id="an-title" name="title" maxlength="60" required placeholder="Ex.: Aviso da moderação"></label><label class="field"><span>Mensagem</span><textarea id="an-body" name="body" rows="2" maxlength="240" required></textarea></label><button class="btn ghost block sm">' + I('send') + 'Enviar</button></form></section>' +
          '<section class="mu-sec"><h4>Últimas movimentações</h4><ul class="tx-list">' + (tx.length ? tx.map((x) => BH.txRow(x)).join('') : '<li class="muted small">Nenhuma movimentação.</li>') + '</ul></section>' +
          '<section class="mu-sec danger-zone"><h4>Zona de risco</h4><div class="btn-row">' +
          (canBan ? '<button type="button" class="btn ' + (u.banned ? 'ghost' : 'danger') + ' sm" data-act="aBan" data-id="' + u.id + '">' + I('ban') + (u.banned ? 'Desbanir' : 'Banir conta') + '</button>' : '<span class="muted small">Você não pode banir esta conta.</span>') +
          (S.can('remove') && u.id !== m.id && u.role !== 'owner' ? '<button type="button" class="btn danger-ghost sm" data-act="aDelete" data-id="' + u.id + '">' + I('trash') + 'Excluir conta</button>' : '') + '</div></section>';
      }
    });
  };
  const again = () => { const s = U.topSheet(); if (s) s.render('static'); app().refresh(); };
  actions.aSign = (el) => { const s = U.topSheet(); s.data.sign = Number(el.dataset.v); s.render('static'); };
  actions.aRole = function (el) {
    const sheet = U.topSheet(), id = sheet.data.id;
    if (U.result(A.setRole(id, el.dataset.v), 'Cargo atualizado.')) again(); else sheet.render('static');
  };
  actions.aVerifyToggle = (el) => { const u = S.user(el.dataset.id); if (U.result(A.setVerified(u.id, !u.verified), u.verified ? 'Verificação removida.' : 'Conta verificada.')) again(); };
  actions.aGoVerify = () => { U.closeAll(); sa.section = 'verify'; sa.vFilter = 'pendente'; app().replace('admin', { section: 'verify' }); };
  forms.aBalance = function (f) {
    const s = U.topSheet(), d = Object.fromEntries(new FormData(f).entries());
    if (U.result(A.adjustBalance(f.dataset.id, s.data.sign * Number(d.amount), d.reason), 'Saldo ajustado.')) again();
  };
  forms.aElo = (f) => { if (U.result(A.setElo(f.dataset.id, f.elo.value), 'ELO atualizado.')) again(); };
  forms.aNotify = function (f) {
    const d = Object.fromEntries(new FormData(f).entries());
    if (U.result(A.messageUser(f.dataset.id, d.title, d.body), 'Notificação enviada.')) f.reset();
  };
  actions.aBan = async function (el) {
    const u = S.user(el.dataset.id);
    if (u.banned) {
      if (!(await U.confirm({ title: 'Desbanir ' + u.nick + '?', body: 'A conta volta a entrar e jogar torneios.', ok: 'Desbanir', icon: 'userCheck' }))) return;
      if (U.result(A.setBan(u.id, false), 'Conta desbanida.')) again();
      return;
    }
    const reason = await U.confirm({ title: 'Banir ' + u.nick + '?', body: 'A conta perde o acesso e sai dos torneios abertos, com reembolso das inscrições.', ok: 'Banir', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: uso de hack confirmado', required: true, error: 'Escreva o motivo do banimento.' } });
    if (!reason) return;
    if (U.result(A.setBan(u.id, true, reason), 'Conta banida.')) again();
  };
  actions.aDelete = async function (el) {
    const u = S.user(el.dataset.id);
    const ok = await U.confirm({ title: 'Excluir ' + u.nick + '?', body: 'Apaga a conta, as conversas e as inscrições. Não dá para desfazer.', ok: 'Excluir', danger: true, input: { label: 'Digite o nickname para confirmar', placeholder: u.nick, required: true } });
    if (!ok) return;
    if (ok !== u.nick) return U.toast('O nickname não confere. Nada foi excluído.', 'bad');
    if (U.result(A.deleteUser(u.id), 'Conta excluída.')) { U.closeAll(); app().refresh(); }
  };

  /* ---------- torneios ---------- */
  SECTION.tournaments = function () {
    const db = S.db, q = sa.tSearch.trim().toLowerCase();
    const by = { abertos: (t) => t.status === 'aberto', ao_vivo: (t) => t.status === 'ao_vivo', encerrados: (t) => t.status === 'finalizado' || t.status === 'cancelado', todos: () => true };
    let list = db.tournaments.filter(by[sa.tFilter] || by.todos);
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    list.sort((a, b) => (sa.tFilter === 'encerrados' ? b.startsAt - a.startsAt : a.startsAt - b.startsAt));
    const n = (k) => db.tournaments.filter(by[k]).length;
    const raised = db.tx.filter((x) => x.type === 'inscricao').reduce((s, x) => s + x.amount, 0);
    return {
      html: '<div class="kpis four stagger">' + tile('trophy', 'violet', n('abertos'), 'Inscrições abertas') + tile('radio', 'red', n('ao_vivo'), 'Ao vivo') + tile('flag', 'cyan', n('encerrados'), 'Encerrados') + tile('coins', 'gold', raised, 'Inscrições pagas', 'money') + '</div>' +
        '<div class="a-toolbar"><label class="search grow">' + I('search') + '<input id="at-search" type="search" placeholder="Buscar torneio" value="' + esc(sa.tSearch) + '" data-input="admin.tSearch" autocomplete="off"></label><button type="button" class="btn primary" data-act="createT">' + I('plus') + 'Novo torneio</button></div>' +
        chips([['abertos', 'Abertos', n('abertos')], ['ao_vivo', 'Ao vivo', n('ao_vivo')], ['encerrados', 'Encerrados'], ['todos', 'Todos']], sa.tFilter, 'aTFilter') +
        '<div class="stack stagger">' + (list.length ? list.map(adminTRow).join('') : U.empty('trophy', 'Nenhum torneio aqui', 'Crie um no botão Novo torneio.')) + '</div>'
    };
  };
  function adminTRow(t) {
    const p = S.prizeTable(t, false), live = t.status === 'ao_vivo', openT = t.status === 'aberto', closed = !live && !openT;
    return '<article class="at-row"><div class="at-main" data-act="openT" data-id="' + t.id + '" role="button" tabindex="0">' +
      '<div class="t-tags">' + U.status(t) + U.typeTag(t.type) + (t.featured ? '<span class="tag tone-gold">' + I('star') + 'Destaque</span>' : '') + '</div>' +
      '<h4>' + esc(t.name) + '</h4><p class="t-by">' + esc(t.mode) + ' · ' + esc(t.map) + ' · ' + (openT ? U.when(t.startsAt) : U.date(t.startsAt)) + '</p>' +
      '<div class="at-nums"><span><small>Inscritos</small><b>' + S.count(t) + '/' + t.max + '</b></span><span><small>Entrada</small><b>' + (t.entry ? U.money(t.entry) : 'Grátis') + '</b></span><span><small>Prêmio</small><b class="gold">' + U.money(p.total) + '</b></span><span><small>Taxa</small><b>' + U.money(p.fee) + '</b></span></div>' +
      U.bar(S.count(t) / t.max) + '</div>' +
      '<div class="at-actions">' +
      (openT ? '<button type="button" class="btn primary sm" data-act="aStartT" data-id="' + t.id + '">' + I('play') + 'Iniciar</button>' : '') +
      (live || openT ? '<button type="button" class="btn gold sm" data-act="aFinishT" data-id="' + t.id + '">' + I('flag') + 'Finalizar</button>' : '') +
      (live || openT ? '<button type="button" class="btn ghost sm" data-act="aEditT" data-id="' + t.id + '">' + I('edit') + 'Editar</button>' : '') +
      '<button type="button" class="btn ghost sm" data-act="aFeatureT" data-id="' + t.id + '">' + I('star') + (t.featured ? 'Tirar destaque' : 'Destacar') + '</button>' +
      (live || openT ? '<button type="button" class="btn danger-ghost sm" data-act="aCancelT" data-id="' + t.id + '">' + I('ban') + 'Cancelar</button>' : '') +
      (closed && S.can('remove') ? '<button type="button" class="btn danger-ghost sm" data-act="aDeleteT" data-id="' + t.id + '">' + I('trash') + 'Excluir</button>' : '') +
      '</div></article>';
  }
  actions.aTFilter = (el) => { sa.tFilter = el.dataset.v; app().rerender('soft'); };
  actions.aEditT = (el) => BH.flows.tournamentForm(S.tournament(el.dataset.id));
  actions.aFeatureT = (el) => { const r = A.toggleFeatured(el.dataset.id); if (U.result(r, r.featured ? 'Torneio em destaque no início.' : 'Destaque removido.')) app().refresh(); };
  actions.aStartT = function (el) {
    const t = S.tournament(el.dataset.id);
    U.sheet({
      title: 'Iniciar ' + t.name,
      body: () => '<form class="form" data-form="aStart" data-id="' + t.id + '"><p class="muted">Crie a sala personalizada no Free Fire e passe os dados. Os ' + U.plural(t.participants.length, 'inscrito recebe', 'inscritos recebem') + ' uma notificação na hora.</p>' +
        '<div class="grid2"><label class="field"><span>ID da sala</span><input id="as-id" name="id" inputmode="numeric" maxlength="12" required value="' + (10000000 + Math.floor(Math.random() * 89999999)) + '"></label>' +
        '<label class="field"><span>Senha</span><input id="as-pass" name="pass" maxlength="16" required value="bh' + Math.floor(100 + Math.random() * 899) + '"></label></div>' +
        '<button class="btn primary block lg">' + I('play') + 'Liberar sala e iniciar</button></form>'
    });
  };
  forms.aStart = function (f) {
    if (!U.result(A.startTournament(f.dataset.id, f.id.value, f.pass.value), 'Torneio ao vivo. Inscritos notificados.')) return;
    U.closeAll(); app().refresh();
  };
  actions.aFinishT = function (el) {
    const t = S.tournament(el.dataset.id), p = S.prizeTable(t, false);
    const known = t.participants.map(S.user).filter(Boolean);
    const slots = Math.min(p.split.length, known.length);
    const medal = ['gold', 'silver', 'bronze', 'violet', 'slate'];
    U.sheet({
      title: 'Finalizar ' + t.name, size: 'lg',
      body: () => '<form class="form" data-form="aFinish" data-id="' + t.id + '">' +
        '<dl class="ledger"><div><dt>Pool de inscrições</dt><dd>' + U.money(p.entryPool) + '</dd></div><div><dt>Taxa da plataforma (' + p.feePct + '%)</dt><dd>−' + U.money(p.fee) + '</dd></div>' + (t.bonus ? '<div><dt>Prêmio garantido</dt><dd>+' + U.money(t.bonus) + '</dd></div>' : '') + '<div class="total"><dt>Prêmio total</dt><dd class="gold">' + U.money(p.total) + '</dd></div></dl>' +
        (slots ? '<p class="muted small">Escolha os vencedores entre os inscritos com conta no app. O prêmio cai direto na carteira.</p>' + p.split.slice(0, slots).map((pct, i) => '<label class="field place"><span><i class="medal m-' + medal[i] + '">' + (i + 1) + 'º</i>' + U.money(p.prizes[i]) + ' (' + pct + '%)</span><select id="af-' + i + '" name="p' + i + '" required><option value="">Escolha o jogador</option>' + known.map((u) => '<option value="' + u.id + '">' + esc(u.nick) + '</option>').join('') + '</select></label>').join('')
          : '<p class="note-gold">' + I('info') + '<span>Nenhum inscrito tem conta no app. O prêmio fica com a plataforma.</span></p>') +
        (slots < p.split.length ? '<p class="muted small">Posições sem vencedor (' + (p.split.length - slots) + ') voltam para a plataforma.</p>' : '') +
        '<button class="btn gold block lg">' + I('trophy') + 'Distribuir prêmios e finalizar</button></form>'
    });
  };
  forms.aFinish = async function (f) {
    const ids = Array.from(f.querySelectorAll('select')).map((s) => s.value);
    const t = S.tournament(f.dataset.id);
    if (!(await U.confirm({ title: 'Finalizar e pagar?', body: 'Os prêmios vão para a carteira dos vencedores agora. Não dá para desfazer.', ok: 'Finalizar', icon: 'trophy' }))) return;
    const r = A.finishTournament(t.id, ids);
    if (!U.result(r)) return;
    U.closeAll();
    U.confetti();
    U.toast(U.money(r.paid) + ' distribuídos · taxa ' + U.money(r.fee) + '.', 'money');
    app().refresh();
  };
  actions.aCancelT = async function (el) {
    const t = S.tournament(el.dataset.id);
    const reason = await U.confirm({ title: 'Cancelar ' + t.name + '?', body: t.entry && t.participants.length ? 'Cada inscrito recebe ' + U.money(t.entry) + ' de volta.' : 'Os inscritos são avisados.', ok: 'Cancelar torneio', cancel: 'Manter', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: servidor instável', required: true, error: 'Escreva o motivo do cancelamento.' } });
    if (!reason) return;
    const r = A.cancelTournament(t.id, reason);
    if (U.result(r, 'Torneio cancelado' + (r.refunded ? '. ' + U.money(r.refunded) + ' devolvidos.' : '.'))) { U.closeAll(); app().refresh(); }
  };
  actions.aDeleteT = async function (el) {
    const t = S.tournament(el.dataset.id);
    if (!(await U.confirm({ title: 'Excluir ' + t.name + '?', body: 'Some da lista de torneios. O extrato dos jogadores continua.', ok: 'Excluir', danger: true }))) return;
    if (U.result(A.deleteTournament(t.id), 'Torneio excluído.')) app().refresh();
  };

  /* ---------- financeiro ---------- */
  SECTION.finance = function () {
    const f = S.financeTotals(), db = S.db;
    const series = S.financeSeries(14);
    const labels = series.map((d) => { const x = new Date(d.start); return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0'); });
    const tabs = [{ id: 'depositos', label: 'Depósitos', icon: 'up', badge: f.pendDep }, { id: 'saques', label: 'Saques', icon: 'downTrend', badge: f.pendSaq }, { id: 'historico', label: 'Histórico', icon: 'history' }];
    let content = '';
    if (sa.finTab === 'depositos' || sa.finTab === 'saques') {
      const type = sa.finTab === 'depositos' ? 'deposito' : 'saque';
      const pend = db.tx.filter((x) => x.type === type && x.status === 'pendente').sort((a, b) => a.at - b.at);
      const total = pend.reduce((s, x) => s + x.amount, 0);
      content = pend.length
        ? '<p class="muted small">' + U.plural(pend.length, 'pedido', 'pedidos') + ' · ' + U.money(total) + ' · mais antigo primeiro</p><div class="stack stagger">' + pend.map((x) => {
          const u = S.user(x.userId);
          return '<article class="pend">' + userCell(u, (type === 'saque' ? 'Chave ' + esc(x.pixKey || '') : x.paidAt ? 'Marcou como pago ' + U.ago(x.paidAt) : 'Pix gerado, aguardando pagamento') + ' · ' + U.ago(x.at)) +
            '<b class="pend-amt ' + (type === 'deposito' ? 'pos' : 'neg') + '">' + U.money(x.amount) + '</b>' +
            (type === 'saque' && u && !u.verified ? '<p class="note-red small">' + I('alert') + '<span>Conta não verificada.</span></p>' : '') +
            '<div class="btn-row"><button type="button" class="btn green sm" data-act="aApprove" data-id="' + x.id + '">' + I('check') + (type === 'deposito' ? 'Confirmar Pix recebido' : 'Marcar como pago') + '</button>' +
            '<button type="button" class="btn danger-ghost sm" data-act="aReject" data-id="' + x.id + '">' + I('x') + 'Recusar</button></div></article>';
        }).join('') + '</div>'
        : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhum ' + (type === 'deposito' ? 'depósito' : 'saque') + ' pendente</small></div>';
    } else {
      const filters = { tudo: () => true, depositos: (x) => x.type === 'deposito', saques: (x) => x.type === 'saque', premios: (x) => x.type === 'premio', taxas: (x) => x.type === 'taxa', ajustes: (x) => x.type === 'ajuste' || x.type === 'reembolso' };
      const list = db.tx.filter((x) => x.status !== 'pendente' && x.type !== 'inscricao' && filters[sa.histFilter](x)).sort((a, b) => b.at - a.at).slice(0, 60);
      content = chips([['tudo', 'Tudo'], ['depositos', 'Depósitos'], ['saques', 'Saques'], ['premios', 'Prêmios'], ['taxas', 'Taxas'], ['ajustes', 'Ajustes e reembolsos']], sa.histFilter, 'aHist') +
        '<ul class="tx-list full stagger">' + (list.length ? list.map((x) => x.userId === 'platform' ? platformRow(x) : BH.txRow(x, true)).join('') : '<li class="muted center pad">Nada nesse filtro.</li>') + '</ul>';
    }
    return {
      html: '<div class="kpis four stagger">' + tile('up', 'green', f.entrou, 'Entrou', 'money') + tile('downTrend', 'red', f.saiu, 'Saiu', 'money') + tile('coins', 'gold', f.liquido, 'Líquido', 'money') + tile('percent', 'cyan', f.receita, 'Receita (taxas)', 'money') + '</div>' +
        '<section class="card"><header class="card-row"><h3 class="card-h">' + I('chart') + 'Últimos 14 dias</h3><div class="legend"><span><i style="background:#34d399"></i>Entrou</span><span><i style="background:#fb7185"></i>Saiu</span></div></header>' +
        U.areaChart([{ name: 'Entrou', color: '#34d399', values: series.map((d) => d.entrou) }, { name: 'Saiu', color: '#fb7185', values: series.map((d) => d.saiu) }], labels, { label: 'Entradas e saídas por dia' }) + '</section>' +
        '<p class="muted small">Chave Pix da plataforma: <b class="mono">' + esc(db.settings.pixKey) + '</b> · saque mínimo ' + U.money(db.settings.minWithdraw) + '</p>' +
        U.seg('fin', tabs, sa.finTab, 'aFinTab') + '<div class="fin-body">' + content + '</div>'
    };
  };
  function platformRow(x) {
    return '<li class="tx-row"><span class="tx-ic tone-cyan">' + I('percent') + '</span><div class="tx-main"><b>Taxa da plataforma</b><small>' + esc(x.note || '') + ' · ' + U.date(x.at) + '</small></div><div class="tx-side"><b class="pos">+' + U.money(x.amount) + '</b><span class="chip tone-cyan">Receita</span></div></li>';
  }
  actions.aFinTab = (el) => { sa.finTab = el.dataset.v; app().rerender('soft'); };
  actions.aHist = (el) => { sa.histFilter = el.dataset.v; app().rerender('soft'); };
  actions.aApprove = function (el) {
    const x = S.db.tx.find((t) => t.id === el.dataset.id);
    const r = x.type === 'deposito' ? A.approveDeposit(x.id) : A.approveWithdraw(x.id);
    if (U.result(r, x.type === 'deposito' ? 'Depósito confirmado. Saldo creditado.' : 'Saque marcado como pago.')) {
      const card = el.closest('.pend');
      if (card && !U.reduced()) { card.classList.add('leaving'); setTimeout(() => app().refresh(), 280); } else app().refresh();
    }
  };
  actions.aReject = async function (el) {
    const x = S.db.tx.find((t) => t.id === el.dataset.id);
    const reason = await U.confirm({ title: x.type === 'deposito' ? 'Recusar depósito?' : 'Recusar saque?', body: x.type === 'saque' ? U.money(x.amount) + ' voltam para a carteira do jogador.' : 'O jogador é avisado com o motivo.', ok: 'Recusar', danger: true, input: { label: 'Motivo', placeholder: x.type === 'deposito' ? 'Ex.: Pix não identificado' : 'Ex.: chave Pix inválida', required: true, error: 'Escreva o motivo.' } });
    if (!reason) return;
    const r = x.type === 'deposito' ? A.rejectDeposit(x.id, reason) : A.rejectWithdraw(x.id, reason);
    if (U.result(r, 'Pedido recusado.')) app().refresh();
  };

  /* ---------- verificações ---------- */
  SECTION.verify = function () {
    const list = S.db.verifications.filter((v) => v.status === sa.vFilter).sort((a, b) => (sa.vFilter === 'pendente' ? a.at - b.at : b.at - a.at));
    const n = (s) => S.db.verifications.filter((v) => v.status === s).length;
    return {
      html: chips([['pendente', 'Pendentes', n('pendente')], ['aprovada', 'Aprovadas'], ['recusada', 'Recusadas']], sa.vFilter, 'aVFilter') +
        (list.length ? '<div class="v-grid stagger">' + list.map((v) => {
          const u = S.user(v.userId), img = v.image || U.ffShot(v.ff, u ? u.nick : '');
          const match = u && v.ff.nick && u.ff.id && u.ff.id !== v.ff.id ? '<p class="note-red small">' + I('alert') + '<span>ID diferente do cadastrado no perfil (' + esc(u.ff.id) + ').</span></p>' : '';
          return '<article class="v-item"><button type="button" class="v-shot" data-act="aShot" data-id="' + v.id + '" aria-label="Ampliar print"><img src="' + img + '" alt="Print do perfil de ' + esc(v.ff.nick) + '" loading="lazy"><span>' + I('eye') + 'Ampliar</span></button>' +
            '<div class="v-info">' + userCell(u, 'Enviado ' + U.ago(v.at)) +
            '<dl class="kv inline"><div><dt>ID</dt><dd class="mono">' + esc(v.ff.id) + '</dd></div><div><dt>Nick</dt><dd>' + esc(v.ff.nick) + '</dd></div><div><dt>Level</dt><dd>' + esc(v.ff.level) + '</dd></div><div><dt>Rank</dt><dd>' + esc(v.ff.rank) + '</dd></div></dl>' + match +
            (v.status === 'pendente' ? '<div class="btn-row"><button type="button" class="btn green sm" data-act="aVApprove" data-id="' + v.id + '">' + I('check') + 'Aprovar</button><button type="button" class="btn danger-ghost sm" data-act="aVReject" data-id="' + v.id + '">' + I('x') + 'Recusar</button></div>'
              : '<p class="muted small">' + (v.status === 'aprovada' ? 'Aprovada' : 'Recusada' + (v.note ? ': ' + esc(v.note) : '')) + (v.reviewedBy && S.user(v.reviewedBy) ? ' por ' + esc(S.user(v.reviewedBy).nick) : '') + '</p>') +
            '</div></article>';
        }).join('') + '</div>' : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhuma verificação ' + (sa.vFilter === 'pendente' ? 'pendente' : sa.vFilter === 'aprovada' ? 'aprovada ainda' : 'recusada') + '</small></div>')
    };
  };
  actions.aVFilter = (el) => { sa.vFilter = el.dataset.v; app().rerender('soft'); };
  actions.aShot = function (el) {
    const v = S.db.verifications.find((x) => x.id === el.dataset.id), u = S.user(v.userId);
    U.sheet({ title: 'Print de ' + (u ? u.nick : ''), size: 'lg', body: () => '<img class="shot-full" src="' + (v.image || U.ffShot(v.ff, u ? u.nick : '')) + '" alt="Print do perfil">' });
  };
  actions.aVApprove = (el) => { if (U.result(A.reviewVerification(el.dataset.id, true), 'Conta verificada.')) app().refresh(); };
  actions.aVReject = async function (el) {
    const note = await U.confirm({ title: 'Recusar verificação?', body: 'O jogador pode enviar outro print.', ok: 'Recusar', danger: true, input: { label: 'Motivo', placeholder: 'Ex.: o print não mostra o ID', required: true, error: 'Escreva o motivo.' } });
    if (!note) return;
    if (U.result(A.reviewVerification(el.dataset.id, false, note), 'Verificação recusada.')) app().refresh();
  };

  /* ---------- denúncias ---------- */
  SECTION.reports = function () {
    const list = S.db.reports.filter((r) => r.status === sa.rFilter).sort((a, b) => b.at - a.at);
    const n = (s) => S.db.reports.filter((r) => r.status === s).length;
    return {
      html: chips([['aberta', 'Abertas', n('aberta')], ['resolvida', 'Resolvidas'], ['descartada', 'Descartadas']], sa.rFilter, 'aRFilter') +
        (list.length ? '<div class="stack stagger">' + list.map((r) => {
          const t = S.user(r.target), by = S.user(r.reporter);
          const prior = S.db.reports.filter((x) => x.target === r.target).length;
          return '<article class="report"><header>' + userCell(t, t ? U.int(t.elo) + ' ELO · ' + U.plural(prior, 'denúncia', 'denúncias') : '') + '<span class="tag tone-red">' + I('flag') + esc(r.reason) + '</span></header>' +
            '<blockquote>' + esc(r.detail || 'Sem detalhes.') + '</blockquote><p class="muted small">Denunciado por ' + (by ? esc(by.nick) : '?') + ' · ' + U.ago(r.at) + (r.resolution ? ' · <b>' + esc(r.resolution) + '</b>' : '') + '</p>' +
            (r.status === 'aberta' ? '<div class="btn-row"><button type="button" class="btn ghost sm" data-act="aWarn" data-id="' + r.id + '">' + I('megaphone') + 'Advertir</button>' +
              (t && !t.banned && S.level(t) < S.level(S.me()) ? '<button type="button" class="btn danger sm" data-act="aRBan" data-id="' + r.id + '">' + I('ban') + 'Banir</button>' : '') +
              '<button type="button" class="btn danger-ghost sm" data-act="aDismiss" data-id="' + r.id + '">' + I('x') + 'Descartar</button>' +
              (t ? '<button type="button" class="btn ghost sm" data-act="aUser" data-id="' + t.id + '">' + I('user') + 'Ver conta</button>' : '') + '</div>' : '') +
            '</article>';
        }).join('') + '</div>' : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhuma denúncia nesse filtro</small></div>')
    };
  };
  actions.aRFilter = (el) => { sa.rFilter = el.dataset.v; app().rerender('soft'); };
  actions.aWarn = function (el) {
    const r = S.db.reports.find((x) => x.id === el.dataset.id);
    A.messageUser(r.target, 'Advertência da moderação', 'Recebemos uma denúncia de "' + r.reason.toLowerCase() + '". Se acontecer de novo, a conta pode ser banida.');
    if (U.result(A.resolveReport(r.id, 'Advertência enviada'), 'Advertência enviada.')) app().refresh();
  };
  actions.aRBan = async function (el) {
    const r = S.db.reports.find((x) => x.id === el.dataset.id), t = S.user(r.target);
    if (!(await U.confirm({ title: 'Banir ' + t.nick + '?', body: 'Motivo registrado: ' + esc(r.reason) + '.', ok: 'Banir', danger: true }))) return;
    if (!U.result(A.setBan(t.id, true, r.reason))) return;
    A.resolveReport(r.id, 'Conta banida');
    U.toast('Conta banida e denúncia resolvida.', 'good');
    app().refresh();
  };
  actions.aDismiss = (el) => { if (U.result(A.resolveReport(el.dataset.id, 'descartada'), 'Denúncia descartada.')) app().refresh(); };

  /* ---------- guildas ---------- */
  SECTION.guilds = function () {
    const list = S.db.guilds.slice().sort((a, b) => b.points - a.points);
    return {
      html: '<div class="kpis four stagger">' + tile('shield', 'violet', list.length, 'Guildas') + tile('userPlus', 'green', list.filter((g) => g.recruiting).length, 'Recrutando') + tile('users', 'cyan', list.reduce((s, g) => s + g.memberCount, 0), 'Membros') + tile('trophy', 'gold', list.reduce((s, g) => s + g.wins, 0), 'Vitórias') + '</div>' +
        '<div class="stack stagger">' + (list.length ? list.map((g) => {
          const l = S.user(g.leader);
          return '<article class="at-row"><div class="at-main" data-act="openG" data-id="' + g.id + '" role="button" tabindex="0"><div class="g-line"><span class="g-tag" style="--g1:' + g.color[0] + ';--g2:' + g.color[1] + '">' + esc(g.tag) + '</span><div class="grow"><h4>' + esc(g.name) + '</h4><p class="t-by">Líder ' + (l ? esc(l.nick) : '?') + ' · ' + g.memberCount + '/' + g.max + ' membros · ' + U.int(g.points) + ' pts</p></div></div></div>' +
            '<div class="at-actions"><button type="button" class="btn ghost sm" data-act="aRecruit" data-id="' + g.id + '">' + I(g.recruiting ? 'lock' : 'userPlus') + (g.recruiting ? 'Fechar recrutamento' : 'Abrir recrutamento') + '</button>' +
            '<button type="button" class="btn danger-ghost sm" data-act="aDissolve" data-id="' + g.id + '">' + I('trash') + 'Dissolver</button></div></article>';
        }).join('') : U.empty('shield', 'Nenhuma guilda', '')) + '</div>'
    };
  };
  actions.aRecruit = (el) => { if (U.result(A.toggleRecruiting(el.dataset.id), 'Recrutamento atualizado.')) app().refresh(); };
  actions.aDissolve = async function (el) {
    const g = S.guild(el.dataset.id);
    if (!(await U.confirm({ title: 'Dissolver ' + g.name + '?', body: 'Os membros ficam sem guilda e recebem um aviso. Não dá para desfazer.', ok: 'Dissolver', danger: true }))) return;
    if (U.result(A.dissolveGuild(g.id), 'Guilda dissolvida.')) app().refresh();
  };

  /* ---------- avisos ---------- */
  SECTION.broadcast = function () {
    const list = S.db.announcements.slice().sort((a, b) => b.at - a.at);
    const count = (t) => S.db.users.filter((u) => !u.banned && (t === 'verificados' ? u.verified : t === 'staff' ? S.level(u) >= 1 : true)).length;
    return {
      html: '<div class="a-cols"><section class="card"><h3 class="card-h">' + I('megaphone') + 'Novo aviso</h3><form class="form" data-form="aBroadcast">' +
        '<label class="field"><span>Título</span><input id="bc-title" name="title" maxlength="60" required placeholder="Ex.: Manutenção sexta às 3h"></label>' +
        '<label class="field"><span>Mensagem</span><textarea id="bc-body" name="body" rows="3" maxlength="240" required placeholder="O que os jogadores precisam saber"></textarea></label>' +
        '<div class="radio-list row">' + [['todos', 'Todos'], ['verificados', 'Verificados'], ['staff', 'Staff']].map((t, i) => '<label class="radio"><input type="radio" name="target" value="' + t[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + t[1] + ' <small>(' + count(t[0]) + ')</small></span></label>').join('') + '</div>' +
        '<label class="switch"><input id="bc-pin" type="checkbox" name="pinned"><span class="sw" aria-hidden="true"></span><span>Fixar no topo do início</span></label>' +
        '<div class="bc-preview"><small>Prévia</small><div class="notice"><span class="n-ic tone-violet">' + I('megaphone') + '</span><span><b id="bc-pt">Título do aviso</b><span id="bc-pb">A mensagem aparece aqui.</span></span></div></div>' +
        '<button class="btn primary block">' + I('send') + 'Enviar aviso</button></form></section>' +
        '<section class="card"><h3 class="card-h">' + I('history') + 'Enviados</h3><ul class="a-list">' + (list.length ? list.map((a) => '<li class="bc-item"><div class="grow"><b>' + esc(a.title) + (a.pinned ? '<span class="chip tone-gold">' + I('pinned') + 'Fixado</span>' : '') + '</b><p>' + esc(a.body) + '</p><small>' + U.date(a.at) + ' · para ' + esc(a.target) + (a.reach ? ' · ' + a.reach + ' contas' : '') + '</small></div><button type="button" class="btn ghost sm" data-act="aPin" data-id="' + a.id + '">' + I('pinned') + (a.pinned ? 'Desafixar' : 'Fixar') + '</button></li>').join('') : '<li class="muted pad">Nenhum aviso enviado.</li>') + '</ul></section></div>',
      onMount(root) {
        const f = root.querySelector('[data-form="aBroadcast"]'); if (!f) return;
        const upd = () => { root.querySelector('#bc-pt').textContent = f.title.value || 'Título do aviso'; root.querySelector('#bc-pb').textContent = f.body.value || 'A mensagem aparece aqui.'; };
        f.addEventListener('input', upd); upd();
      }
    };
  };
  forms.aBroadcast = async function (f) {
    const d = Object.fromEntries(new FormData(f).entries());
    if (!(await U.confirm({ title: 'Enviar aviso?', body: 'Todos do público escolhido recebem uma notificação agora.', ok: 'Enviar', icon: 'megaphone' }))) return;
    const r = A.broadcast(d.title, d.body, d.target, !!d.pinned);
    if (U.result(r, 'Aviso enviado para ' + U.plural(r.reach || 0, 'conta', 'contas') + '.')) { app().refresh(); BH.app.header(); }
  };
  actions.aPin = (el) => { if (U.result(A.unpinAnnouncement(el.dataset.id))) app().refresh(); };

  /* ---------- configurações ---------- */
  SECTION.settings = function () {
    const s = S.db.settings;
    return {
      html: '<form class="form settings" data-form="aSettings">' +
        '<section class="card"><h3 class="card-h">' + I('percent') + 'Taxa e limites</h3>' +
        '<label class="field"><span>Taxa da plataforma sobre as inscrições: <b id="fee-out">' + s.fee + '%</b></span><input id="st-fee" name="fee" type="range" min="0" max="30" step="1" value="' + s.fee + '"></label>' +
        '<p class="muted small" id="fee-ex"></p>' +
        '<div class="grid3"><label class="field money-field"><span>Depósito mínimo</span><b>R$</b><input id="st-mindep" name="minDeposit" type="number" inputmode="decimal" min="1" step="1" value="' + s.minDeposit + '"></label>' +
        '<label class="field money-field"><span>Saque mínimo</span><b>R$</b><input id="st-minwd" name="minWithdraw" type="number" inputmode="decimal" min="1" step="1" value="' + s.minWithdraw + '"></label>' +
        '<label class="field money-field"><span>Saque máximo</span><b>R$</b><input id="st-maxwd" name="maxWithdraw" type="number" inputmode="decimal" min="1" step="10" value="' + s.maxWithdraw + '"></label></div>' +
        '<label class="field"><span>Chave Pix da plataforma</span><input id="st-pix" name="pixKey" maxlength="80" value="' + esc(s.pixKey) + '"></label></section>' +
        '<section class="card"><h3 class="card-h">' + I('sliders') + 'Funcionamento</h3>' +
        '<label class="switch"><input id="st-create" type="checkbox" name="allowCreate"' + (s.allowCreate ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Jogadores verificados podem criar torneios</span></label>' +
        '<label class="switch warn"><input id="st-maint" type="checkbox" name="maintenance"' + (s.maintenance ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Modo manutenção <small>Só a equipe entra no app</small></span></label></section>' +
        '<button class="btn primary block lg">' + I('check') + 'Salvar configurações</button></form>' +
        '<section class="card danger-zone"><h3 class="card-h">' + I('refresh') + 'Dados de demonstração</h3><p class="muted small">Tudo o que você fez aqui fica salvo só neste navegador. Restaurar apaga as mudanças e volta aos dados de exemplo.</p><button type="button" class="btn danger-ghost" data-act="aReset">' + I('refresh') + 'Restaurar dados de exemplo</button></section>',
      onMount(root) {
        const r = root.querySelector('#st-fee'); if (!r) return;
        const upd = () => { root.querySelector('#fee-out').textContent = r.value + '%'; root.querySelector('#fee-ex').textContent = 'Exemplo: sala de 48 vagas a R$ 10,00 paga ' + U.money(480 * (1 - r.value / 100)) + ' em prêmios e a plataforma fica com ' + U.money(480 * r.value / 100) + '.'; };
        r.addEventListener('input', upd); upd();
      }
    };
  };
  forms.aSettings = function (f) {
    const d = Object.fromEntries(new FormData(f).entries());
    d.allowCreate = !!f.allowCreate.checked; d.maintenance = !!f.maintenance.checked;
    if (U.result(A.updateSettings(d), 'Configurações salvas.')) app().refresh();
  };
  actions.aReset = async function () {
    if (!(await U.confirm({ title: 'Restaurar dados de exemplo?', body: 'Contas criadas, torneios, depósitos e mensagens deste navegador serão apagados.', ok: 'Restaurar', danger: true }))) return;
    A.resetDemo();
    U.toast('Dados de exemplo restaurados.', 'good');
    app().boot();
  };

  /* ---------- auditoria ---------- */
  SECTION.logs = function () {
    const q = sa.logSearch.trim().toLowerCase();
    let list = S.db.logs.slice();
    if (q) list = list.filter((l) => ((S.user(l.by) || {}).nick + ' ' + l.action + ' ' + l.target + ' ' + l.detail).toLowerCase().includes(q));
    return {
      html: '<label class="search">' + I('search') + '<input id="al-search" type="search" placeholder="Buscar por pessoa, ação ou alvo" value="' + esc(sa.logSearch) + '" data-input="admin.logSearch" autocomplete="off"></label>' +
        '<p class="muted small">' + U.plural(list.length, 'registro', 'registros') + ' · cada ação do painel fica gravada aqui</p>' +
        '<section class="card"><ul class="log-list stagger">' + (list.length ? list.slice(0, 120).map(logRow).join('') : '<li class="muted pad">Nenhum registro.</li>') + '</ul></section>'
    };
  };
})();
