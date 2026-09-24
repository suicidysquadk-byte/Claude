/* Roteador, cabeçalho, navegação e ligação dos eventos */
window.BH = window.BH || {};
(function () {
  const S = BH.store, U = BH.ui, I = BH.icon;
  const TABS = [
    { id: 'home', label: 'Início', icon: 'home' },
    { id: 'torneios', label: 'Torneios', icon: 'trophy' },
    { id: 'ranking', label: 'Ranking', icon: 'chart' },
    { id: 'guildas', label: 'Guildas', icon: 'shield' },
    { id: 'chat', label: 'Chat', icon: 'message' },
    { id: 'perfil', label: 'Perfil', icon: 'user' }
  ];
  const state = { tab: 'home', stack: [], scroll: {}, lastBalance: null, pageClass: '' };
  let nav, view, top;

  BH.logo = (size) => '<span class="logo' + (size ? ' ' + size : '') + '"><span class="logo-mark">' + I('crown') + '</span><span class="logo-word">Battle<b>Hub</b></span></span>';

  function current() {
    const s = state.stack[state.stack.length - 1];
    return s ? { page: s.page, params: s.params, tab: state.tab } : { page: state.tab, params: {}, tab: state.tab };
  }

  function render(mode, dir) {
    const m = S.me();
    const cur = current();
    let name = cur.page;
    if (!m) name = 'login';
    else if (S.db.settings.maintenance && !S.isStaff(m)) name = 'maintenance';
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

    const out = fn(cur.params || {});
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
      if (el) { el.focus({ preventScroll: true }); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) { /* select/number */ } }
    }
    view.classList.remove('enter-fwd', 'enter-back', 'enter-fade', 'is-static');
    void view.offsetWidth;
    if (mode === 'static') view.classList.add('is-static');
    else if (mode === 'enter') view.classList.add(dir === 'back' ? 'enter-back' : dir === 'fade' ? 'enter-fade' : 'enter-fwd');
    U.enhance(view, mode);
    if (out.onMount) out.onMount(view);
    header();
  }

  function header() {
    const m = S.me();
    if (!m) { top.innerHTML = ''; return; }
    const unread = S.db.notifications.filter((n) => n.userId === m.id && !n.read).length;
    const bump = state.lastBalance != null && state.lastBalance !== m.balance;
    const up = bump && m.balance > state.lastBalance;
    state.lastBalance = m.balance;
    top.innerHTML = '<div class="top-in">' +
      '<button type="button" class="logo-btn" data-act="tab" data-v="home" aria-label="BattleHub, ir para o início">' + BH.logo() + '</button>' +
      '<div class="top-right"><button type="button" class="wallet-chip ripple' + (bump ? (up ? ' bump up' : ' bump down') : '') + '" data-act="walletChip" aria-label="Saldo ' + U.money(m.balance) + '">' + I('wallet') + '<b>' + U.money(m.balance) + '</b></button>' +
      '<button type="button" class="icon-btn bell' + (unread ? ' has' : '') + '" data-act="notifications" aria-label="Notificações' + (unread ? ', ' + unread + ' novas' : '') + '">' + I('bell') + (unread ? '<b class="dot-count">' + (unread > 9 ? '9+' : unread) + '</b>' : '') + '</button></div></div>';
    if (nav) {
      const chat = S.conversationsOf(m.id).reduce((s, c) => s + ((c.unread && c.unread[m.id]) || 0), 0);
      nav.badge('chat', chat);
      const p = S.pendingCounts();
      nav.badge('perfil', S.can('access') ? (S.can('finance') ? p.depositos + p.saques : 0) + p.verificacoes + p.denuncias : 0);
    }
  }

  function go(tab, silent) {
    const prev = TABS.findIndex((t) => t.id === state.tab), next = TABS.findIndex((t) => t.id === tab);
    if (next < 0) return;
    if (state.tab === tab && !state.stack.length) {
      window.scrollTo({ top: 0, behavior: U.reduced() ? 'auto' : 'smooth' });
      return;
    }
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
  function boot(first) {
    U.closeAll();
    state.stack = []; state.tab = 'home'; state.scroll = {}; state.lastBalance = null;
    const hash = (location.hash || '').slice(1);
    if (first && S.me()) {
      if (TABS.some((t) => t.id === hash)) state.tab = hash;
      if (hash === 'admin' && S.can('access')) state.stack.push({ page: 'admin', params: { section: 'overview' } });
      if (hash === 'financeiro' && S.can('finance')) state.stack.push({ page: 'admin', params: { section: 'finance' } });
    }
    nav.set(state.tab, false);
    render('enter', 'fade');
    window.scrollTo(0, 0);
  }

  BH.app = {
    go, push, back, replace, boot, header, current,
    refresh: () => render('static'),
    rerender: (mode) => render(mode || 'soft')
  };

  /* ---------- ações globais ---------- */
  const actions = BH.actions;
  actions.tab = (el) => { U.closeAll(); go(el.dataset.v); };
  actions.back = () => back();
  actions.walletChip = () => {
    U.closeAll();
    if (state.tab !== 'perfil' || state.stack.length) { state.stack = []; go('perfil'); }
    setTimeout(() => { const w = document.querySelector('.wallet'); if (w) w.scrollIntoView({ behavior: U.reduced() ? 'auto' : 'smooth', block: 'center' }); }, 60);
  };

  /* ---------- delegação de eventos ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act][tabindex]:not(button)')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = BH.forms[f.dataset.form];
    if (fn) fn(f, e);
  });
  let inputTimer = 0;
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (!el) return;
    const path = el.dataset.input.split('.');
    let o = BH.state;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = el.value;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => render('static'), 120);
  });

  /* ---------- dados ao vivo ---------- */
  S.subscribe((topic) => {
    if (!view) return;
    if (topic === 'chat') {
      const cur = current();
      if (cur.page === 'conversation' || cur.page === 'chat' || cur.page === 'tournament') {
        const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
        render('static');
        if (cur.page === 'conversation' && nearBottom) window.scrollTo(0, document.documentElement.scrollHeight);
        const c = document.getElementById('t-chat'); if (c) c.scrollTop = c.scrollHeight;
      } else header();
      return;
    }
    header();
  });

  /* ---------- app Android (Capacitor) ---------- */
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  function hardwareBack() {
    const dlg = document.querySelector('.dialog-layer');
    if (dlg && dlg._cancel) return dlg._cancel();
    const sheet = U.topSheet();
    if (sheet) return sheet.close();
    if (S.me() && state.stack.length) return back();
    if (S.me() && state.tab !== 'home') return go('home');
    if (Cap.Plugins.App) Cap.Plugins.App.exitApp();
  }
  function setupNative() {
    if (!native) return;
    document.documentElement.classList.add('native');
    if (Cap.Plugins && Cap.Plugins.App) Cap.Plugins.App.addListener('backButton', hardwareBack);
  }

  /* ---------- início ---------- */
  function start() {
    setupNative();
    view = document.getElementById('view');
    top = document.getElementById('top');
    nav = BH.LiquidNav(document.getElementById('nav'), {
      items: TABS, active: state.tab,
      onChange: (id) => { U.closeAll(); go(id); }
    });
    boot(true);
    const splash = document.getElementById('splash');
    if (splash) setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 600); }, U.reduced() ? 0 : native ? 650 : 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
