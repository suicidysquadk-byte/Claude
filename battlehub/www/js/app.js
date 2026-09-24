/* Roteador, portões de acesso (login, cadastro, suspensão), cabeçalho, tempo real e eventos */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api;
  const TABS = [
    { id: 'home', label: 'Início', icon: 'home' },
    { id: 'ranking', label: 'Ranking', icon: 'chart' },
    { id: 'guildas', label: 'Guildas', icon: 'shield' },
    { id: 'chat', label: 'Chat', icon: 'message' },
    { id: 'perfil', label: 'Perfil', icon: 'user' }
  ];
  BH.pages = BH.pages || {};
  BH.actions = BH.actions || {};
  BH.forms = BH.forms || {};
  BH.flows = BH.flows || {};
  BH.state = BH.state || {};
  const state = { tab: 'home', stack: [], scroll: {}, pageClass: '', seq: 0, sub: null, subKey: null, lastBalance: null, live: null, poll: 0, authing: false };

  BH.logo = (size) => '<span class="logo' + (size ? ' ' + size : '') + '"><span class="logo-mark">' + I('crown') + '</span><span class="logo-word">Battle<b>Hub</b></span></span>';

  let nav, view, top;

  function current() {
    const s = state.stack[state.stack.length - 1];
    return s ? { page: s.page, params: s.params, tab: state.tab } : { page: state.tab, params: {}, tab: state.tab };
  }
  let sessionCache = null;
  function gate(page) {
    if (!api.configured) return 'setup';
    if (!sessionCache || !api.me) return page === 'offline' ? 'offline' : 'login';
    const me = api.me;
    if (me.banned) return 'banned';
    if (!me.onboarded) return 'onboarding';
    if (me.settings && me.settings.maintenance && me.role_level < 1) return 'maintenance';
    return page;
  }

  async function render(mode, dir) {
    const my = ++state.seq;
    const cur = current();
    const name = gate(cur.page);
    const fn = BH.pages[name] || BH.pages.home;

    const keep = {};
    let focusId = null, caret = null;
    if (mode === 'static' || mode === 'soft') {
      view.querySelectorAll('input[id],textarea[id],select[id]').forEach((el) => {
        if (el.type !== 'file' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'range') keep[el.id] = el.value;
      });
      const ae = document.activeElement;
      if (ae && view.contains(ae) && ae.id) { focusId = ae.id; try { caret = ae.selectionStart; } catch (e) { caret = null; } }
    }
    let skel = null;
    if (mode === 'enter') skel = setTimeout(() => { if (my === state.seq) { view.classList.remove('enter-fwd', 'enter-back', 'enter-fade', 'is-static'); view.innerHTML = U.skeleton(); } }, 160);

    let out;
    try { out = await fn(cur.params || {}); }
    catch (e) {
      out = { html: '<section class="page">' + (state.stack.length ? BH.backRow() : '') + U.empty(api.online ? 'alert' : 'wifiOff', api.online ? 'Não foi possível carregar' : 'Sem internet', e.message, '<button type="button" class="btn primary" data-act="retry">' + I('refresh') + 'Tentar de novo</button>') + '</section>' };
    }
    clearTimeout(skel);
    if (my !== state.seq) return;

    document.body.classList.toggle('no-nav', !!out.hideNav);
    document.body.classList.toggle('bare', !!out.bare);
    if (state.pageClass) document.body.classList.remove(state.pageClass);
    state.pageClass = out.className || '';
    if (state.pageClass) document.body.classList.add(state.pageClass);
    document.body.dataset.page = name;

    view.innerHTML = out.html;
    Object.keys(keep).forEach((id) => { const el = document.getElementById(id); if (el && view.contains(el)) el.value = keep[id]; });
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus({ preventScroll: true }); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) { /* select */ } }
    }
    view.classList.remove('enter-fwd', 'enter-back', 'enter-fade', 'is-static');
    void view.offsetWidth;
    if (mode === 'static') view.classList.add('is-static');
    else if (mode === 'enter') view.classList.add(dir === 'back' ? 'enter-back' : dir === 'fade' ? 'enter-fade' : 'enter-fwd');
    U.enhance(view, mode);

    // assinatura de tempo real da página (sala, conversa)
    const key = out.subKey || null;
    if (key !== state.subKey) {
      if (state.sub) { try { state.sub(); } catch (e) { /* ignora */ } }
      state.sub = null; state.subKey = key;
      if (key && out.subscribe) state.sub = out.subscribe();
    }
    if (out.onMount) out.onMount(view);
    header();
  }

  function header() {
    const me = api.me;
    if (!me || !sessionCache) { top.innerHTML = ''; return; }
    const unread = (me.unread && me.unread.notifications) || 0;
    const bump = state.lastBalance != null && state.lastBalance !== me.balance_cents;
    const up = bump && me.balance_cents > state.lastBalance;
    state.lastBalance = me.balance_cents;
    top.innerHTML = '<div class="top-in">' +
      '<button type="button" class="logo-btn" data-act="tab" data-v="home" aria-label="BattleHub, ir para o início">' + BH.logo() + '</button>' +
      '<div class="top-right">' + (api.online ? '' : '<span class="offline-chip">' + I('wifiOff') + 'Sem internet</span>') +
      '<button type="button" class="wallet-chip ripple' + (bump ? (up ? ' bump up' : ' bump down') : '') + '" data-act="wallet" aria-label="Saldo ' + U.cents(me.balance_cents) + '">' + I('wallet') + '<b>' + U.cents(me.balance_cents) + '</b></button>' +
      '<button type="button" class="icon-btn bell' + (unread ? ' has' : '') + '" data-act="notifications" aria-label="Notificações' + (unread ? ', ' + unread + ' novas' : '') + '">' + I('bell') + (unread ? '<b class="dot-count">' + (unread > 9 ? '9+' : unread) + '</b>' : '') + '</button></div></div>';
    if (nav) {
      const u = me.unread || {};
      nav.badge('chat', (u.privado || 0) + (u.sala || 0) + (u.friends || 0));
      const p = me.admin_pending;
      nav.badge('perfil', p ? (p.ff || 0) + (p.reports || 0) + (me.role_level >= 2 ? (p.deposits || 0) + (p.withdrawals || 0) : 0) : 0);
    }
  }

  function go(tab, silent) {
    const prev = TABS.findIndex((t) => t.id === state.tab), next = TABS.findIndex((t) => t.id === tab);
    if (next < 0) return;
    if (state.tab === tab && !state.stack.length) { window.scrollTo({ top: 0, behavior: U.reduced() ? 'auto' : 'smooth' }); render('soft'); return; }
    if (!state.stack.length) state.scroll[state.tab] = window.scrollY;
    state.tab = tab; state.stack = [];
    nav.set(tab);
    if (silent) return;
    render('enter', next >= prev ? 'fwd' : 'back');
    window.scrollTo(0, state.scroll[tab] || 0);
  }
  function push(page, params) {
    const cur = state.stack[state.stack.length - 1];
    if (cur) cur.scroll = window.scrollY; else state.scroll[state.tab] = window.scrollY;
    state.stack.push({ page, params: params || {} });
    render('enter', 'fwd');
    window.scrollTo(0, 0);
  }
  function back() {
    if (!state.stack.length) return go('home');
    state.stack.pop();
    const cur = state.stack[state.stack.length - 1];
    render('enter', 'back');
    window.scrollTo(0, cur ? cur.scroll || 0 : state.scroll[state.tab] || 0);
  }
  function replace(page, params) {
    if (state.stack.length) state.stack[state.stack.length - 1] = { page, params: params || {} };
    else state.stack.push({ page, params: params || {} });
    render('soft');
  }
  let refreshTimer = 0;
  function refreshSoon() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => render('static'), 250); }

  /* ---------- sessão e tempo real ---------- */
  function stopLive() {
    if (state.live) api.unlisten(state.live);
    state.live = null;
    clearInterval(state.poll);
    if (state.sub) { try { state.sub(); } catch (e) { /* ignora */ } }
    state.sub = null; state.subKey = null;
  }
  function startLive() {
    stopLive();
    const me = api.me;
    if (!me) return;
    state.live = api.listenMe(me.id, {
      message: (m) => onMessage(m),
      notification: (n) => onNotification(n),
      wallet: (w) => { if (api.me) { api.me.balance_cents = Number(w.balance_cents); api.me.held_cents = Number(w.held_cents); header(); } }
    });
    state.poll = setInterval(async () => { if (document.hidden || !api.online) return; try { await api.refreshMe(); header(); } catch (e) { /* tenta depois */ } }, 25000);
  }
  const cardCache = {};
  async function cardOf(id) {
    if (cardCache[id]) return cardCache[id];
    try { cardCache[id] = await api.rpc('get_profile', { p_user: id }); } catch (e) { cardCache[id] = { id, nick: 'Jogador' }; }
    return cardCache[id];
  }
  async function onMessage(m) {
    const cur = current();
    if (cur.page === 'thread' && cur.params.id === m.thread_id) { document.dispatchEvent(new CustomEvent('bh:thread', { detail: m })); return; }
    try { await api.refreshMe(); header(); } catch (e) { /* ignora */ }
    const who = await cardOf(m.sender_id);
    U.headsUp({
      avatar: U.av(who, 'sm'), title: who.nick || 'Mensagem', body: m.image_url && !m.body ? 'Enviou uma foto' : m.body, meta: 'agora',
      open: () => { U.closeAll(); push('thread', { id: m.thread_id }); },
      reply: async (text) => { await api.rpc('send_message', { p_thread: m.thread_id, p_body: text, p_image: null }); }
    });
    if (cur.page === 'chat') refreshSoon();
  }
  const NICON = { sala: 'trophy', resultado: 'trophy', deposito: 'wallet', saque: 'wallet', amizade: 'userPlus', nivel: 'sparkles', guilda: 'shield', admin: 'shieldCheck', aviso: 'megaphone', ban: 'ban', conta: 'badgeCheck' };
  async function onNotification(n) {
    try { await api.refreshMe(); header(); } catch (e) { /* ignora */ }
    const d = n.data || {};
    U.headsUp({
      icon: NICON[n.kind] || 'bell', title: n.title, body: n.body, tone: n.kind === 'ban' ? 'bad' : n.kind === 'resultado' || n.kind === 'deposito' ? 'good' : '',
      open: () => {
        U.closeAll();
        if (d.room_id) push('room', { id: d.room_id });
        else if (d.guild_id) push('guild', { id: d.guild_id });
        else if (n.kind === 'amizade') { BH.state.chatTab = 'amigos'; go('chat'); }
        else BH.actions.notifications();
      }
    });
    if (n.kind === 'nivel' || n.kind === 'resultado') U.confetti();
    if (n.kind === 'ban' || n.kind === 'conta') render('static');
    const cur = current();
    if (d.room_id && cur.page === 'room' && cur.params.id === d.room_id) refreshSoon();
  }

  async function boot(first) {
    U.closeAll();
    state.stack = []; state.tab = 'home'; state.scroll = {}; state.lastBalance = null;
    if (api.configured) {
      sessionCache = await api.session();
      if (sessionCache) {
        try { await api.refreshMe(); startLive(); }
        catch (e) {
          if (/sessão expirou/i.test(e.message)) { await api.signOut(); sessionCache = null; }
          else { api.me = null; nav.set('home', false); view.innerHTML = '<section class="page">' + U.empty('wifiOff', 'Sem conexão com o servidor', e.message, '<button type="button" class="btn primary" data-act="retry">' + I('refresh') + 'Tentar de novo</button>') + '</section>'; document.body.classList.add('no-nav'); header(); return; }
        }
      } else { api.me = null; stopLive(); }
    }
    const hash = (location.hash || '').slice(1);
    if (first && api.me) {
      if (TABS.some((t) => t.id === hash)) state.tab = hash;
      if (hash === 'admin' && api.me.role_level >= 1) state.stack.push({ page: 'admin', params: { section: 'overview' } });
    }
    nav.set(state.tab, false);
    await render('enter', 'fade');
    window.scrollTo(0, 0);
  }

  // depois do login (código por e-mail ou Google): animação de verificação e entrada
  BH.flows.afterLogin = async function (session) {
    if (state.authing) return;
    state.authing = true;
    try {
      sessionCache = session || await api.session();
      const anim = BH.flows.verifyAnimation(sessionCache);
      let meErr = null;
      try { await api.refreshMe(); } catch (e) { meErr = e; }
      await anim.done(!meErr);
      if (meErr) { U.err(meErr); await api.signOut(); sessionCache = null; }
      await boot(false);
    } finally { state.authing = false; }
  };

  BH.app = {
    go, push, back, replace, boot, header, current, refreshSoon,
    refresh: () => render('static'),
    rerender: (mode) => render(mode || 'soft'),
    setSession: (s) => { sessionCache = s; }
  };

  /* ---------- ações globais ---------- */
  const actions = BH.actions;
  actions.tab = (el) => { U.closeAll(); go(el.dataset.v); };
  actions.back = () => back();
  actions.retry = () => boot(false);
  actions.page = (el) => push(el.dataset.v, el.dataset.id ? { id: el.dataset.id } : {});
  actions.wallet = () => { U.closeAll(); BH.flows.wallet(); };

  /* ---------- delegação de eventos ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || el.dataset.busy) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    Promise.resolve(fn(el, e)).catch(U.err);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act][tabindex]:not(button)')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = BH.forms[f.dataset.form];
    if (fn) Promise.resolve(fn(f, e)).catch(U.err);
  });
  let inputTimer = 0;
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (!el) return;
    const path = el.dataset.input.split('.');
    let o = BH.state;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {};
    o[path[path.length - 1]] = el.value;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => { if (el.closest('.sheet-body')) { const s = U.topSheet(); if (s) s.render('static'); } else render('static'); }, 320);
  });
  document.addEventListener('bh:online', () => { header(); if (api.me) api.refreshMe().then(header).catch(() => {}); });
  document.addEventListener('bh:offline', header);

  /* ---------- Android ---------- */
  const Cap = window.Capacitor;
  function hardwareBack() {
    const dlg = document.querySelector('.dialog-layer');
    if (dlg && dlg._cancel) return dlg._cancel();
    const sheet = U.topSheet();
    if (sheet) return sheet.close();
    if (state.stack.length) return back();
    if (state.tab !== 'home' && api.me) return go('home');
    if (Cap.Plugins.App) Cap.Plugins.App.exitApp();
  }
  function setupNative() {
    if (!api.native) return;
    document.documentElement.classList.add('native');
    const App = Cap.Plugins && Cap.Plugins.App;
    if (!App) return;
    App.addListener('backButton', hardwareBack);
    App.addListener('appUrlOpen', (ev) => {
      api.handleDeepLink(ev.url).then((ok) => { if (ok) return api.session().then((s) => BH.flows.afterLogin(s)); return null; }).catch(U.err);
    });
    App.addListener('appStateChange', (s) => { if (s.isActive && api.me) api.refreshMe().then(header).catch(() => {}); });
  }

  /* ---------- início ---------- */
  function start() {
    view = document.getElementById('view');
    top = document.getElementById('top');
    setupNative();
    nav = BH.LiquidNav(document.getElementById('nav'), { items: TABS, active: state.tab, onChange: (id) => { U.closeAll(); go(id); } });
    if (api.configured) {
      api.onAuth((event, session) => {
        if (event === 'SIGNED_IN' && session && !sessionCache && !state.authing) BH.flows.afterLogin(session);
        if (event === 'SIGNED_OUT') { sessionCache = null; api.me = null; stopLive(); }
        if (event === 'TOKEN_REFRESHED') sessionCache = session;
      });
    }
    boot(true).finally(() => {
      const splash = document.getElementById('splash');
      if (splash) setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 600); }, U.reduced() ? 0 : api.native ? 350 : 600);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
