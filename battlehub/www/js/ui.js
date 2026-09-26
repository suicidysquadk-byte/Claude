/* Componentes de interface: formatação, avatares, folhas, avisos, roleta, gráficos e animações */
window.BH = window.BH || {};
['pages', 'actions', 'forms', 'flows', 'state'].forEach((k) => { BH[k] = BH[k] || {}; });
(function () {
  const I = BH.icon;
  const U = BH.ui = {};
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  U.reduced = () => mq.matches;

  /* ---------- texto e números ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  U.money = (n) => 'R$ ' + nf2.format(Number(n) || 0);
  U.cents = (c) => U.money((Number(c) || 0) / 100);
  U.centsShort = (c) => { const v = (Number(c) || 0) / 100; return Math.abs(v) >= 1000 ? 'R$ ' + nf0.format(Math.round(v)) : U.money(v).replace(',00', ''); };
  U.int = (n) => nf0.format(Math.round(Number(n) || 0));
  U.toCents = (v) => Math.round(parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')) * 100) || 0;
  U.centsInput = (c) => ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');
  const pad = (n) => String(n).padStart(2, '0');
  const T = (ts) => (typeof ts === 'number' ? ts : /^\d+$/.test(String(ts)) ? Number(ts) : new Date(ts).getTime());
  U.hm = (ts) => { const d = new Date(T(ts)); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  U.date = (ts) => { const d = new Date(T(ts)); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + U.hm(ts); };
  U.ago = function (ts) {
    const s = Math.round((Date.now() - T(ts)) / 1000);
    if (s < 50) return 'agora';
    if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    if (s < 86400 * 7) { const d = Math.round(s / 86400); return 'há ' + d + (d === 1 ? ' dia' : ' dias'); }
    return U.date(ts).slice(0, 5);
  };
  const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  U.when = function (ts) {
    const t = T(ts), d = new Date(t), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const diff = Math.floor((new Date(t).setHours(0, 0, 0, 0) - t0.getTime()) / 86400000);
    if (diff === 0) return 'Hoje, ' + U.hm(t);
    if (diff === 1) return 'Amanhã, ' + U.hm(t);
    if (diff === -1) return 'Ontem, ' + U.hm(t);
    return WD[d.getDay()] + ', ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' · ' + U.hm(t);
  };
  U.until = function (ts) {
    let s = Math.floor((T(ts) - Date.now()) / 1000);
    if (s <= 0) return 'agora';
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    if (d > 0) return d + 'd ' + pad(h) + 'h ' + pad(m) + 'm';
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  };
  U.plural = (n, one, many) => U.int(n) + ' ' + (Number(n) === 1 ? one : many);
  U.localInput = (ts) => new Date(T(ts) - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);

  /* ---------- jogadores ---------- */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const GRADS = [['#7a5410', '#f3d27a'], ['#b91c1c', '#fb923c'], ['#0e7490', '#67e8f9'], ['#3f3a33', '#bdb2a0'], ['#15803d', '#86efac'], ['#be185d', '#f9a8d4'], ['#1d4ed8', '#93c5fd']];
  U.av = function (u, size, extra) {
    const s = size || 'md';
    if (!u) return '<span class="av av-' + s + ' av-anon' + (extra ? ' ' + extra : '') + '">' + I('user') + '</span>';
    const frame = u.frame || null;
    let ring = '', style = '', fr = '';
    // moldura desenhada (SVG) a partir do tamanho médio; em listas pequenas fica só o aro colorido, mais leve
    if (frame && frame.fr && BH.cos && BH.cos.frame && !(s === 'xs' || s === 'sm')) fr = BH.cos.frame(frame.fr, /(^| )still( |$)/.test(extra || ''));
    else if (frame && frame.ring) { ring = frame.ring === 'conic' ? ' ring-conic' : ' ring-color'; style = frame.ring === 'conic' ? '' : '--ring:' + frame.ring + ';'; if (frame.glow) ring += ' ring-glow'; }
    const acc = (u.accessory && BH.cos ? BH.cos.acc(u.accessory) : '') + fr;
    const cls = 'av av-' + s + ring + (acc ? ' has-acc' : '') + (fr ? ' has-fr' : '') + (extra ? ' ' + extra : '');
    if (!u.id && u.anonymous) return '<span class="' + cls + ' av-anon" role="img" aria-label="Jogador anônimo">' + I('user') + '</span>';
    // a foto fica dentro de um círculo próprio que corta o que sobra (foto vertical, foto grande)
    if (u.avatar_url) return '<span class="' + cls + '" style="' + style + '"><span class="av-photo"><img src="' + U.esc(u.avatar_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></span>' + acc + '</span>';
    const g = GRADS[hash(String(u.id || u.nick || '?')) % GRADS.length];
    const letter = String(u.nick || '?').trim().charAt(0).toUpperCase() || '?';
    return '<span class="' + cls + ' av-letter" style="' + style + '--a1:' + g[0] + ';--a2:' + g[1] + '" role="img" aria-label="' + U.esc(u.nick || 'Jogador') + '">' + U.esc(letter) + acc + '</span>';
  };
  /* ---------- tema: Sistema, Preto ou Branco ---------- */
  const THEME_KEY = 'bh.theme';
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  BH.theme = {
    get() { try { return localStorage.getItem(THEME_KEY) || 'escuro'; } catch (e) { return 'escuro'; } },
    set(v) { try { localStorage.setItem(THEME_KEY, v); } catch (e) { /* sem armazenamento: vale só nesta abertura */ } BH.theme.apply(v); },
    apply(v) {
      const pref = v || BH.theme.get();
      const light = pref === 'claro' || (pref === 'sistema' && media && media.matches);
      document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
      const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', light ? '#f6f4ef' : '#0b0b0d');
      // ícones da barra do Android: escuros no tema Branco, claros no Preto
      const bars = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SystemBars;
      if (bars && bars.setStyle) bars.setStyle({ style: light ? 'LIGHT' : 'DARK' }).catch(() => {});
      return light;
    }
  };
  if (media) {
    const follow = () => { if (BH.theme.get() === 'sistema') BH.theme.apply('sistema'); };
    if (media.addEventListener) media.addEventListener('change', follow); else if (media.addListener) media.addListener(follow);
  }
  BH.theme.apply();

  U.verified = (u) => (u && u.verified ? '<span class="vbadge" title="ID do Free Fire verificado">' + I('badgeCheck') + '</span>' : '');
  U.nick = function (u, opts) {
    opts = opts || {};
    if (!u) return '<b class="nk">Conta removida</b>';
    const color = u.color ? ' style="color:' + U.esc(u.color) + '"' : '';
    return '<b class="nk"' + color + '>' + U.esc(u.nick || 'Sem nick') + '</b>' + U.verified(u) +
      (opts.level && u.level ? '<span class="lvl">' + u.level + '</span>' : '') +
      (opts.tag && u.guild_tag ? '<span class="gtag">' + U.esc(u.guild_tag) + '</span>' : '');
  };
  U.title = (u) => (u && u.title ? '<span class="ptitle' + (u.title_fx ? ' t-' + U.esc(u.title_fx) : '') + '">' + U.esc(u.title) + '</span>' : '');
  // raridade no padrão do Free Fire
  U.RARITY = { simples: 'Simples', comum: 'Comum', raro: 'Raro', epico: 'Épico', mitico: 'Mítico', lendario: 'Lendário' };
  U.rarity = (r) => (r && U.RARITY[r] ? '<span class="rar rar-' + r + '">' + U.RARITY[r] + '</span>' : '');
  U.role = function (role) {
    if (!role || role === 'jogador') return '';
    const name = { moderador: 'Moderador', admin: 'Admin', dono: 'Dono' }[role] || role;
    return '<span class="tag tone-' + (role === 'moderador' ? 'cyan' : 'gold') + '">' + I('shieldCheck') + name + '</span>';
  };
  U.empty = (icon, title, text, action) => '<div class="empty"><span class="empty-ic">' + I(icon) + '</span><strong>' + U.esc(title) + '</strong>' + (text ? '<p>' + U.esc(text) + '</p>' : '') + (action || '') + '</div>';
  U.bar = (ratio, tone) => '<span class="meter' + (tone ? ' tone-' + tone : '') + '"><i data-w="' + Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 10 + '"></i></span>';
  U.chips = (list, cur, act) => '<div class="chips">' + list.map((c) => '<button type="button" class="chip-btn' + (cur === c[0] ? ' on' : '') + '" data-act="' + act + '" data-v="' + c[0] + '">' + (c[2] ? I(c[2]) : '') + U.esc(c[1]) + (c[3] ? '<b class="dot-count">' + c[3] + '</b>' : '') + '</button>').join('') + '</div>';

  /* controle segmentado com pílula deslizante */
  const segPrev = {};
  U.seg = function (key, options, active, act, cls) {
    const k = Math.max(0, options.findIndex((o) => o.id === active));
    const from = segPrev[key] == null ? k : segPrev[key];
    segPrev[key] = k;
    return '<div class="seg' + (cls ? ' ' + cls : '') + '" role="tablist" style="--n:' + options.length + ';--k:' + from + '" data-k="' + k + '">' +
      options.map((o) => '<button type="button" role="tab" aria-selected="' + (o.id === active) + '" class="' + (o.id === active ? 'on' : '') + '" data-act="' + act + '" data-v="' + o.id + '">' + (o.icon ? I(o.icon) : '') + '<span>' + U.esc(o.label) + '</span>' + (o.badge ? '<b class="dot-count">' + o.badge + '</b>' : '') + '</button>').join('') + '</div>';
  };

  /* ---------- avisos rápidos ---------- */
  U.toast = function (msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const icon = { good: 'checkCircle', bad: 'alert', info: 'info', money: 'wallet' }[kind || 'info'] || 'info';
    const el = document.createElement('div');
    el.className = 'toast tone-' + (kind || 'info');
    el.innerHTML = I(icon) + '<span>' + U.esc(msg) + '</span>';
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3600);
  };
  U.err = (e) => U.toast((e && e.message) || 'Não foi possível concluir.', 'bad');

  /* botão com carregamento: trava, mostra o giro e devolve o resultado */
  U.busy = async function (el, fn) {
    if (el && el.dataset.busy) return undefined;
    if (el) { el.dataset.busy = '1'; el.classList.add('is-busy'); el.setAttribute('aria-busy', 'true'); if (el.tagName === 'BUTTON') el.disabled = true; }
    try { return await fn(); } finally {
      if (el) { delete el.dataset.busy; el.classList.remove('is-busy'); el.removeAttribute('aria-busy'); if (el.tagName === 'BUTTON') el.disabled = false; }
    }
  };
  /* executa uma ação de rede; erro vira aviso. Devolve undefined em caso de erro. */
  U.run = async function (el, fn, okMsg) {
    try {
      const r = await U.busy(el, fn);
      if (okMsg) U.toast(okMsg, 'good');
      return r === undefined ? true : r;
    } catch (e) { U.err(e); return undefined; }
  };

  /* ---------- folhas (bottom sheets) ---------- */
  const stack = [];
  U.sheet = function (opts) {
    const layer = document.createElement('div');
    layer.className = 'sheet-layer' + (opts.size ? ' size-' + opts.size : '');
    layer.innerHTML = '<div class="sheet-backdrop" data-close></div>' +
      '<section class="sheet" role="dialog" aria-modal="true" aria-label="' + U.esc(opts.title || 'Janela') + '">' +
      '<div class="sheet-grip" aria-hidden="true"></div>' +
      '<header class="sheet-head"><h2>' + U.esc(opts.title || '') + '</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">' + I('x') + '</button></header>' +
      '<div class="sheet-body"></div></section>';
    document.body.appendChild(layer);
    const sheetEl = layer.querySelector('.sheet');
    let seq = 0;
    const api = {
      el: layer, body: layer.querySelector('.sheet-body'), data: opts.data || {},
      async render(mode) {
        const my = ++seq;
        if (mode !== 'static' && opts.loading !== false && typeof opts.body === 'function') {
          const t = setTimeout(() => { if (my === seq && !api.closed) api.body.innerHTML = U.skeleton('sheet'); }, 140);
          api._t = t;
        }
        let html;
        try { html = typeof opts.body === 'function' ? await opts.body(api) : opts.body; } catch (e) { html = U.empty('alert', 'Não foi possível carregar', e.message, '<button type="button" class="btn ghost" data-close>Fechar</button>'); }
        clearTimeout(api._t);
        if (my !== seq || api.closed) return;
        const keep = {};
        api.body.querySelectorAll('input[id],textarea[id],select[id]').forEach((el) => { if (el.type !== 'file' && el.type !== 'checkbox' && el.type !== 'radio' && !el.dataset.fresh) keep[el.id] = el.value; });
        const focusId = document.activeElement && api.body.contains(document.activeElement) ? document.activeElement.id : null;
        api.body.innerHTML = html;
        if (mode === 'static' || mode === 'soft') Object.keys(keep).forEach((id) => { const el = document.getElementById(id); if (el && api.body.contains(el)) el.value = keep[id]; });
        U.enhance(api.body, mode || 'enter');
        if (opts.onMount) opts.onMount(api);
        if (focusId) { const f = document.getElementById(focusId); if (f) f.focus({ preventScroll: true }); }
      },
      setTitle(t) { layer.querySelector('.sheet-head h2').textContent = t; },
      close(silent) {
        if (api.closed) return;
        api.closed = true;
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        layer.classList.remove('open'); layer.classList.add('closing');
        setTimeout(() => layer.remove(), U.reduced() ? 0 : 320);
        if (!stack.length) document.documentElement.classList.remove('sheet-open');
        if (opts.onClose && !silent) opts.onClose(api);
        if (opts.onDestroy) opts.onDestroy(api);
      }
    };
    layer._api = api;
    stack.push(api);
    document.documentElement.classList.add('sheet-open');
    layer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    dragToClose(sheetEl, api);
    api.render('enter');
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
    return api;
  };
  U.topSheet = () => stack[stack.length - 1] || null;
  U.closeAll = () => { stack.slice().forEach((s) => s.close(true)); };
  function dragToClose(sheetEl, api) {
    const grip = sheetEl.querySelector('.sheet-grip'), head = sheetEl.querySelector('.sheet-head');
    let y0 = null, dy = 0;
    const down = (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; sheetEl.style.transition = 'none'; };
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheetEl.style.transform = 'translateY(' + dy + 'px)'; };
    const up = () => { if (y0 == null) return; y0 = null; sheetEl.style.transition = ''; sheetEl.style.transform = ''; if (dy > 110) api.close(); };
    [grip, head].forEach((h) => h.addEventListener('pointerdown', down));
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const d = document.querySelector('.dialog-layer:not(.closing)');
    if (d) { d._cancel && d._cancel(); return; }
    const top = U.topSheet(); if (top) top.close();
  });

  /* ---------- confirmação dentro da página ---------- */
  U.confirm = function (o) {
    return new Promise((resolve) => {
      const layer = document.createElement('div');
      layer.className = 'dialog-layer';
      const field = o.input ? '<label class="field"><span>' + U.esc(o.input.label) + '</span>' +
        (o.input.multiline ? '<textarea id="dlg-input" rows="3" placeholder="' + U.esc(o.input.placeholder || '') + '"></textarea>' : '<input id="dlg-input" type="' + (o.input.type || 'text') + '" inputmode="' + (o.input.inputmode || 'text') + '" placeholder="' + U.esc(o.input.placeholder || '') + '" value="' + U.esc(o.input.value || '') + '">') + '</label>' : '';
      const select = o.select ? '<label class="field"><span>' + U.esc(o.select.label) + '</span><select id="dlg-select">' + o.select.options.map((x) => '<option value="' + U.esc(x[0]) + '">' + U.esc(x[1]) + '</option>').join('') + '</select></label>' : '';
      layer.innerHTML = '<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">' +
        '<span class="dialog-ic ' + (o.danger ? 'tone-red' : 'tone-violet') + '">' + I(o.icon || (o.danger ? 'alert' : 'info')) + '</span>' +
        '<h3 id="dlg-t">' + U.esc(o.title) + '</h3>' + (o.body ? '<p>' + o.body + '</p>' : '') + select + field +
        '<p class="dialog-err" hidden></p>' +
        '<div class="dialog-actions"><button type="button" class="btn ghost" data-dlg="0">' + U.esc(o.cancel || 'Voltar') + '</button>' +
        '<button type="button" class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-dlg="1">' + U.esc(o.ok || 'Confirmar') + '</button></div></div>';
      document.body.appendChild(layer);
      requestAnimationFrame(() => layer.classList.add('open'));
      const input = layer.querySelector('#dlg-input'), sel = layer.querySelector('#dlg-select');
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; layer.classList.remove('open'); layer.classList.add('closing'); setTimeout(() => layer.remove(), 220); resolve(v); };
      layer._cancel = () => done(false);
      layer.addEventListener('click', (e) => {
        if (e.target === layer) return done(false);
        const b = e.target.closest('[data-dlg]'); if (!b) return;
        if (b.dataset.dlg === '0') return done(false);
        if (input) {
          const v = input.value.trim();
          if (o.input.required && !v) { const er = layer.querySelector('.dialog-err'); er.hidden = false; er.textContent = o.input.error || 'Preencha este campo.'; input.focus(); return; }
          return done(sel ? { value: sel.value, text: v } : (v || true));
        }
        done(sel ? { value: sel.value } : true);
      });
      setTimeout(() => (input || layer.querySelector('[data-dlg="1"]')).focus(), 40);
    });
  };

  /* ---------- balão de notificação (estilo WhatsApp) com resposta rápida ---------- */
  U.headsUp = function (o) {
    let box = document.getElementById('headsup');
    if (!box) { box = document.createElement('div'); box.id = 'headsup'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'hu' + (o.tone ? ' tone-' + o.tone : '');
    el.setAttribute('role', 'status');
    el.innerHTML = '<button type="button" class="hu-main">' + (o.avatar || '<span class="hu-ic">' + I(o.icon || 'bell') + '</span>') +
      '<span class="hu-text"><b>' + U.esc(o.title) + '</b><span>' + U.esc(o.body || '') + '</span></span><small>' + U.esc(o.meta || 'agora') + '</small></button>' +
      (o.reply ? '<div class="hu-actions"><button type="button" class="hu-btn" data-hu="reply">' + I('message') + 'Responder</button><button type="button" class="hu-btn" data-hu="open">Abrir</button></div>' +
        '<form class="hu-reply" hidden><input type="text" maxlength="2000" placeholder="Responder…" aria-label="Resposta"><button class="send" aria-label="Enviar">' + I('send') + '</button></form>' : '');
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    let timer = null, closed = false;
    const close = () => { if (closed) return; closed = true; clearTimeout(timer); el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 350); };
    const arm = (ms) => { clearTimeout(timer); timer = setTimeout(close, ms); };
    arm(o.reply ? 7000 : 5000);
    el.querySelector('.hu-main').addEventListener('click', () => { close(); if (o.open) o.open(); });
    const form = el.querySelector('.hu-reply');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hu]'); if (!b) return;
      if (b.dataset.hu === 'open') { close(); if (o.open) o.open(); return; }
      form.hidden = false; el.classList.add('replying'); clearTimeout(timer); form.querySelector('input').focus();
    });
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input'), text = input.value.trim();
      if (!text) return;
      input.disabled = true;
      try { await o.reply(text); el.classList.add('sent'); form.innerHTML = '<span class="hu-sent">' + I('check') + 'Enviado</span>'; arm(1200); }
      catch (err) { input.disabled = false; U.err(err); }
    });
    // arrastar para cima fecha
    let y0 = null;
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('input,form')) return; y0 = e.clientY; });
    el.addEventListener('pointermove', (e) => { if (y0 != null && e.clientY - y0 < -30) { y0 = null; close(); } });
    el.addEventListener('pointerup', () => { y0 = null; });
    return { close };
  };

  /* ---------- roleta em fita (Player Rei / sorteio) ---------- */
  U.reel = function (host, players, winnerId, label) {
    return new Promise((resolve) => {
      const list = players.length ? players : [];
      const W = 88, N = 56, WIN = 46;
      const strip = [];
      for (let i = 0; i < N; i++) strip.push(list[Math.floor(Math.random() * list.length)]);
      strip[WIN] = list.find((p) => p.id === winnerId) || strip[WIN];
      host.innerHTML = '<div class="reel"><div class="reel-marker" aria-hidden="true"></div><div class="reel-strip">' +
        strip.map((p, i) => '<div class="reel-card' + (i === WIN ? ' win' : '') + '">' + U.av(p, 'md') + '<span>' + U.esc(p.nick || '') + '</span></div>').join('') +
        '</div></div><p class="reel-label">' + U.esc(label || 'Girando…') + '</p>';
      const el = host.querySelector('.reel-strip');
      const box = host.querySelector('.reel');
      const offset = WIN * W - (box.clientWidth / 2 - W / 2) + (Math.random() * 40 - 20);
      const dur = U.reduced() ? 0 : 5200;
      if (!dur) { el.style.transform = 'translateX(' + (-(WIN * W - (box.clientWidth / 2 - W / 2))) + 'px)'; finish(); return; }
      requestAnimationFrame(() => {
        el.style.transition = 'transform ' + dur + 'ms cubic-bezier(.08,.6,.1,1)';
        el.style.transform = 'translateX(' + (-offset) + 'px)';
      });
      let last = -1;
      const t0 = performance.now();
      (function tick(now) {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const idx = Math.round((-m.m41 + box.clientWidth / 2 - W / 2) / W);
        if (idx !== last) { last = idx; box.classList.remove('tick'); void box.offsetWidth; box.classList.add('tick'); }
        if (now - t0 < dur + 80) requestAnimationFrame(tick); else finish();
      })(t0);
      function finish() {
        el.style.transition = 'transform .5s cubic-bezier(.3,1.4,.5,1)';
        el.style.transform = 'translateX(' + (-(WIN * W - (box.clientWidth / 2 - W / 2))) + 'px)';
        host.querySelector('.reel-card.win').classList.add('landed');
        setTimeout(resolve, 520);
      }
    });
  };

  /* ---------- confete ---------- */
  U.confetti = function (x, y) {
    if (U.reduced()) return;
    const c = document.createElement('canvas');
    c.className = 'confetti';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const ox = x == null ? innerWidth / 2 : x, oy = y == null ? innerHeight * 0.35 : y;
    const colors = ['#d9a93f', '#fff0c4', '#f6c453', '#ffe4a3', '#ffffff', '#8a6114'];
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)] };
    });
    let frame = 0;
    (function tick() {
      frame++;
      g.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - frame / 110);
        g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      });
      if (frame < 110) requestAnimationFrame(tick); else c.remove();
    })();
  };

  /* ---------- esqueleto de carregamento ---------- */
  U.skeleton = function (kind) {
    const line = (w) => '<span class="sk" style="width:' + w + '"></span>';
    if (kind === 'sheet') return '<div class="sk-wrap">' + line('60%') + line('90%') + '<span class="sk sk-card"></span>' + line('75%') + '</div>';
    return '<section class="page sk-wrap">' + line('40%') + '<span class="sk sk-hero"></span><div class="sk-row"><span class="sk sk-tile"></span><span class="sk sk-tile"></span><span class="sk sk-tile"></span></div>' +
      '<span class="sk sk-card"></span><span class="sk sk-card"></span><span class="sk sk-card"></span></section>';
  };

  /* ---------- animações de entrada ---------- */
  U.enhance = function (root, mode) {
    if (!root) return;
    const animate = mode !== 'static' && !U.reduced();
    root.querySelectorAll('.stagger').forEach((list) => {
      Array.from(list.children).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 14)));
    });
    root.querySelectorAll('.seg[data-k]').forEach((seg) => {
      const k = seg.dataset.k;
      requestAnimationFrame(() => requestAnimationFrame(() => seg.style.setProperty('--k', k)));
    });
    root.querySelectorAll('.meter > i[data-w]').forEach((el) => {
      if (!animate) { el.style.width = el.dataset.w + '%'; return; }
      el.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = el.dataset.w + '%'; }));
    });
    root.querySelectorAll('[data-count]').forEach((el) => countUp(el, animate));
  };
  function fmtCount(v, f) {
    if (f === 'cents') return U.cents(v);
    if (f === 'money') return U.money(v);
    if (f === 'pct') return Math.round(v) + '%';
    return U.int(v);
  }
  function countUp(el, animate) {
    const to = Number(el.dataset.count) || 0, f = el.dataset.fmt;
    if (!animate || to === 0) { el.textContent = fmtCount(to, f); return; }
    const t0 = performance.now(), dur = 900;
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtCount(f === 'cents' || f === 'money' ? to * e : Math.round(to * e), f);
      if (p < 1 && el.isConnected) requestAnimationFrame(step);
    })(t0);
  }
  U.num = (v, fmt, cls) => '<span class="' + (cls || 'num') + '" data-count="' + (Number(v) || 0) + '"' + (fmt ? ' data-fmt="' + fmt + '"' : '') + '>' + fmtCount(Number(v) || 0, fmt) + '</span>';

  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn, .ripple');
    if (!b || U.reduced() || b.disabled) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
    const ink = document.createElement('span');
    ink.className = 'ink';
    ink.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(ink);
    setTimeout(() => ink.remove(), 600);
  }, { passive: true });

  setInterval(() => {
    document.querySelectorAll('[data-until]').forEach((el) => { el.textContent = U.until(el.dataset.until); });
    document.querySelectorAll('[data-ago]').forEach((el) => { el.textContent = U.ago(el.dataset.ago); });
  }, 1000);

  /* ---------- gráficos ---------- */
  function nice(max, ticks) {
    if (max <= 0) return { top: ticks, step: 1 };
    const raw = max / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
    return { top: step * ticks, step };
  }
  const short = (n) => (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'k' : U.int(n));
  U.barChart = function (items, opt) {
    opt = opt || {};
    const W = 340, H = opt.height || 190, padL = 36, padB = 26, padT = 22, innerH = H - padB - padT, innerW = W - padL - 6;
    const max = Math.max.apply(null, items.map((i) => i.value).concat(1));
    const sc = nice(max, 4), bw = innerW / Math.max(1, items.length);
    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = sc.step * k, y = padT + innerH - (v / sc.top) * innerH;
      grid += '<line x1="' + padL + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="' + (padL - 6) + '" y="' + (y + 3.5) + '" class="axis" text-anchor="end">' + (opt.fmt ? opt.fmt(v) : short(v)) + '</text>';
    }
    const bars = items.map((it, i) => {
      const h = Math.max(2, (it.value / sc.top) * innerH), x = padL + i * bw + bw * 0.18, w = bw * 0.64, y = padT + innerH - h;
      const lbl = it.label.length > 8 ? it.label.slice(0, 6) + '…' : it.label;
      return '<g class="bar-g" style="--i:' + i + '"><rect class="bar-r" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="' + it.color + '"/>' +
        '<text class="bar-v" x="' + (x + w / 2) + '" y="' + (y - 6) + '" text-anchor="middle">' + (opt.fmt ? opt.fmt(it.value) : short(it.value)) + '</text>' +
        '<text class="axis" x="' + (x + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + U.esc(lbl) + '</text></g>';
    }).join('');
    return '<svg class="chart bar-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(opt.label || 'Gráfico de barras') + '">' + grid + bars + '</svg>';
  };
  function smooth(pts) {
    if (pts.length < 2) return '';
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }
  U.areaChart = function (series, labels, opt) {
    opt = opt || {};
    const W = 560, H = opt.height || 210, padL = 48, padR = 10, padT = 14, padB = 26;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const max = Math.max.apply(null, series.flatMap((s) => s.values).concat(1));
    const sc = nice(max, 4), n = labels.length;
    const X = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const Y = (v) => padT + innerH - (v / sc.top) * innerH;
    let grid = '';
    for (let k = 0; k <= 4; k++) { const v = sc.step * k, y = Y(v); grid += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="' + (padL - 8) + '" y="' + (y + 3.5) + '" class="axis" text-anchor="end">' + short(v) + '</text>'; }
    const every = Math.ceil(n / 7);
    const xl = labels.map((l, i) => (i % every === 0 || i === n - 1) ? '<text class="axis" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + U.esc(l) + '</text>' : '').join('');
    const defs = series.map((s, si) => '<linearGradient id="ag' + si + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".32"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>').join('');
    const paths = series.map((s, si) => {
      const pts = s.values.map((v, i) => [X(i), Y(v)]), line = smooth(pts), last = pts[pts.length - 1];
      return '<path d="' + line + 'L' + X(n - 1) + ',' + Y(0) + 'L' + X(0) + ',' + Y(0) + 'Z" fill="url(#ag' + si + ')" class="area-f"/><path d="' + line + '" fill="none" stroke="' + s.color + '" stroke-width="2.4" class="area-l" pathLength="1"/>' +
        '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="' + s.color + '" class="area-dot"/>';
    }).join('');
    const data = U.esc(JSON.stringify({ labels, series: series.map((s) => ({ name: s.name, color: s.color, values: s.values })), padL, padR, W, fmt: opt.fmt || 'reais' }));
    return '<div class="area-wrap" data-chart="' + data + '"><div class="chart-readout" aria-live="polite"></div><svg class="chart area-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(opt.label || 'Gráfico') + '"><defs>' + defs + '</defs>' + grid + xl + paths + '<line class="cursor" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + innerH) + '" opacity="0"/></svg></div>';
  };
  function readout(wrap, clientX) {
    const d = JSON.parse(wrap.dataset.chart), svg = wrap.querySelector('svg'), r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * d.W, n = d.labels.length, innerW = d.W - d.padL - d.padR;
    const i = Math.max(0, Math.min(n - 1, Math.round(((x - d.padL) / innerW) * (n - 1))));
    const cx = d.padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW), cur = svg.querySelector('.cursor');
    cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.setAttribute('opacity', '1');
    wrap.querySelector('.chart-readout').innerHTML = '<b>' + U.esc(d.labels[i]) + '</b>' + d.series.map((s) => '<span><i style="background:' + s.color + '"></i>' + U.esc(s.name) + ' ' + U.money(s.values[i]) + '</span>').join('');
  }
  document.addEventListener('pointermove', (e) => { const w = e.target.closest && e.target.closest('.area-wrap'); if (w) readout(w, e.clientX); }, { passive: true });
  document.addEventListener('pointerdown', (e) => { const w = e.target.closest && e.target.closest('.area-wrap'); if (w) readout(w, e.clientX); }, { passive: true });

  /* ---------- Pix (BR Code do Banco Central) ---------- */
  function emv(id, value) { const v = String(value); return id + String(v.length).padStart(2, '0') + v; }
  function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  const plain = (s, n) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .-]/g, '').toUpperCase().slice(0, n);
  U.pixPayload = function (o) {
    const acc = emv('00', 'br.gov.bcb.pix') + emv('01', String(o.key).trim());
    let p = emv('00', '01') + emv('26', acc) + emv('52', '0000') + emv('53', '986');
    if (o.cents) p += emv('54', (o.cents / 100).toFixed(2));
    p += emv('58', 'BR') + emv('59', plain(o.name, 25) || 'BATTLEHUB') + emv('60', plain(o.city, 15) || 'SAO PAULO');
    p += emv('62', emv('05', String(o.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'));
    p += '6304';
    return p + crc16(p);
  };
  U.qrSvg = function (text) {
    if (typeof window.qrcode !== 'function') return '';
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  };

  /* ---------- fotos ---------- */
  U.compressImage = function (file, maxSide) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Escolha uma foto (JPG ou PNG).'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('A foto passa de 15 MB. Escolha outra.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a foto.')); };
      img.onload = () => {
        const k = Math.min(1, (maxSide || 1280) / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível preparar a foto.'))), 'image/jpeg', 0.82);
      };
      img.src = url;
    });
  };
  U.copy = function (text, input) {
    const fallback = () => { if (input) { input.focus(); input.select(); } U.toast('Selecionei o código. Copie pelo menu do teclado.', 'info'); };
    try { navigator.clipboard.writeText(text).then(() => U.toast('Copiado.', 'good'), fallback); } catch (e) { fallback(); }
  };
})();
