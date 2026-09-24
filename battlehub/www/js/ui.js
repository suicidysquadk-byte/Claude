/* Componentes de interface: formatação, avatares, folhas, avisos, gráficos e animações */
window.BH = window.BH || {};
(function () {
  const S = BH.store;
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
  U.moneyShort = (n) => (Math.abs(n) >= 1000 ? 'R$ ' + nf0.format(Math.round(n)) : U.money(n));
  U.int = (n) => nf0.format(Math.round(Number(n) || 0));
  const pad = (n) => String(n).padStart(2, '0');
  U.hm = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  U.date = (ts) => { const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + U.hm(ts); };
  U.ago = function (ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 50) return 'agora';
    if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    if (s < 86400 * 7) { const d = Math.round(s / 86400); return 'há ' + d + (d === 1 ? ' dia' : ' dias'); }
    return U.date(ts).slice(0, 5);
  };
  const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  U.when = function (ts) {
    const d = new Date(ts), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const diff = Math.floor((new Date(ts).setHours(0, 0, 0, 0) - t0.getTime()) / S.DAY);
    if (diff === 0) return 'Hoje, ' + U.hm(ts);
    if (diff === 1) return 'Amanhã, ' + U.hm(ts);
    if (diff === -1) return 'Ontem, ' + U.hm(ts);
    return WD[d.getDay()] + ', ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' · ' + U.hm(ts);
  };
  U.until = function (ts) {
    let s = Math.floor((ts - Date.now()) / 1000);
    if (s <= 0) return 'agora';
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    if (d > 0) return d + 'd ' + pad(h) + 'h ' + pad(m) + 'm';
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  };
  U.plural = (n, one, many) => U.int(n) + ' ' + (n === 1 ? one : many);

  /* ---------- peças visuais ---------- */
  U.avatar = function (u, size, extra) {
    const a = (u && S.AVATARS.find((x) => x.id === u.avatar)) || S.AVATARS[0];
    const label = u ? U.esc(u.nick) : 'Jogador';
    return '<span class="av av-' + (size || 'md') + (extra ? ' ' + extra : '') + '" style="--a1:' + a.grad[0] + ';--a2:' + a.grad[1] + '" role="img" aria-label="' + label + '">' + I(a.icon) + '</span>';
  };
  U.banner = function (u) {
    const b = S.BANNERS.find((x) => x.id === (u && u.banner)) || S.BANNERS[0];
    return b.bg;
  };
  U.tier = function (elo, withElo) {
    const t = S.tierOf(elo).tier;
    return '<span class="tier" style="--c:' + t.color + '">' + (t.id === 'coroa' ? I('crown') : '') + U.esc(t.name) + (withElo ? ' · ' + U.int(elo) : '') + '</span>';
  };
  U.typeTag = function (type) {
    const t = S.TYPES[type] || S.TYPES.rapido;
    return '<span class="tag tone-' + t.tone + '">' + I(t.icon) + U.esc(t.name) + '</span>';
  };
  U.status = function (t) {
    if (t.status === 'ao_vivo') return '<span class="live"><i></i>Ao vivo</span>';
    if (t.status === 'finalizado') return '<span class="tag tone-muted">' + I('flag') + 'Finalizado</span>';
    if (t.status === 'cancelado') return '<span class="tag tone-red">' + I('ban') + 'Cancelado</span>';
    if (S.count(t) >= t.max) return '<span class="tag tone-muted">' + I('lock') + 'Sala cheia</span>';
    if (t.startsAt <= Date.now()) return '<span class="tag tone-gold">' + I('clock') + 'Começando</span>';
    return '';
  };
  U.role = function (u) {
    if (!u || u.role === 'jogador') return '';
    const tone = u.role === 'moderador' ? 'cyan' : 'gold';
    return '<span class="tag tone-' + tone + '">' + I('shieldCheck') + S.ROLE_NAME[u.role] + '</span>';
  };
  U.verified = (u) => (u && u.verified ? '<span class="vbadge" title="Conta verificada">' + I('badgeCheck') + '</span>' : '');
  U.empty = (icon, title, text, action) => '<div class="empty">' + '<span class="empty-ic">' + I(icon) + '</span><strong>' + U.esc(title) + '</strong>' + (text ? '<p>' + U.esc(text) + '</p>' : '') + (action || '') + '</div>';
  U.bar = (ratio, tone) => '<span class="meter' + (tone ? ' tone-' + tone : '') + '"><i data-w="' + Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 10 + '"></i></span>';

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
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
  };
  U.result = function (r, okMsg) {
    if (r && r.ok) { if (okMsg) U.toast(okMsg, 'good'); return true; }
    U.toast((r && r.error) || 'Não foi possível concluir.', 'bad');
    return false;
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
    const api = {
      el: layer, body: layer.querySelector('.sheet-body'), data: opts.data || {},
      render(mode) {
        const html = typeof opts.body === 'function' ? opts.body(api) : opts.body;
        const focusId = document.activeElement && api.body.contains(document.activeElement) ? document.activeElement.id : null;
        api.body.innerHTML = html;
        U.enhance(api.body, mode || 'enter');
        if (opts.onMount) opts.onMount(api);
        if (focusId) { const f = document.getElementById(focusId); if (f) f.focus(); }
      },
      setTitle(t) { layer.querySelector('.sheet-head h2').textContent = t; },
      close(silent) {
        if (api.closed) return;
        api.closed = true;
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        layer.classList.remove('open'); layer.classList.add('closing');
        setTimeout(() => layer.remove(), U.reduced() ? 0 : 320);
        if (!stack.length) document.documentElement.classList.remove('sheet-open');
        if (opts.onClose && !silent) opts.onClose();
        if (api.returnFocus && api.returnFocus.focus) api.returnFocus.focus();
      }
    };
    api.returnFocus = document.activeElement;
    layer._api = api;
    stack.push(api);
    document.documentElement.classList.add('sheet-open');
    layer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    dragToClose(sheetEl, api);
    api.render('enter');
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
    setTimeout(() => { const f = sheetEl.querySelector('input:not([type=hidden]):not([readonly]),select,textarea'); if (f && opts.autofocus) f.focus(); else sheetEl.querySelector('.sheet-head .icon-btn').focus({ preventScroll: true }); }, 60);
    return api;
  };
  U.topSheet = () => stack[stack.length - 1] || null;
  U.closeAll = () => { stack.slice().forEach((s) => s.close(true)); };
  function dragToClose(sheetEl, api) {
    const grip = sheetEl.querySelector('.sheet-grip'), head = sheetEl.querySelector('.sheet-head');
    let y0 = null, dy = 0;
    const down = (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; sheetEl.style.transition = 'none'; sheetEl.setPointerCapture && sheetEl.setPointerCapture(e.pointerId); };
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheetEl.style.transform = 'translateY(' + dy + 'px)'; };
    const up = () => {
      if (y0 == null) return; y0 = null;
      sheetEl.style.transition = ''; sheetEl.style.transform = '';
      if (dy > 110) api.close();
    };
    [grip, head].forEach((h) => h.addEventListener('pointerdown', down));
    sheetEl.addEventListener('pointermove', move);
    sheetEl.addEventListener('pointerup', up);
    sheetEl.addEventListener('pointercancel', up);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const d = document.querySelector('.dialog-layer');
    if (d) { d._cancel && d._cancel(); return; }
    const top = U.topSheet(); if (top) top.close();
  });

  /* ---------- confirmação dentro da página ---------- */
  U.confirm = function (o) {
    return new Promise((resolve) => {
      const layer = document.createElement('div');
      layer.className = 'dialog-layer';
      const field = o.input ? '<label class="field"><span>' + U.esc(o.input.label) + '</span>' +
        (o.input.multiline ? '<textarea id="dlg-input" rows="3" placeholder="' + U.esc(o.input.placeholder || '') + '"></textarea>' : '<input id="dlg-input" type="' + (o.input.type || 'text') + '" placeholder="' + U.esc(o.input.placeholder || '') + '" value="' + U.esc(o.input.value || '') + '">') + '</label>' : '';
      layer.innerHTML = '<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">' +
        '<span class="dialog-ic ' + (o.danger ? 'tone-red' : 'tone-violet') + '">' + I(o.icon || (o.danger ? 'alert' : 'info')) + '</span>' +
        '<h3 id="dlg-t">' + U.esc(o.title) + '</h3>' + (o.body ? '<p>' + o.body + '</p>' : '') + field +
        '<p class="dialog-err" hidden></p>' +
        '<div class="dialog-actions"><button type="button" class="btn ghost" data-dlg="0">' + U.esc(o.cancel || 'Voltar') + '</button>' +
        '<button type="button" class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-dlg="1">' + U.esc(o.ok || 'Confirmar') + '</button></div></div>';
      document.body.appendChild(layer);
      requestAnimationFrame(() => layer.classList.add('open'));
      const input = layer.querySelector('#dlg-input');
      const done = (v) => { layer.classList.remove('open'); setTimeout(() => layer.remove(), 220); resolve(v); };
      layer._cancel = () => done(false);
      layer.addEventListener('click', (e) => {
        if (e.target === layer) return done(false);
        const b = e.target.closest('[data-dlg]'); if (!b) return;
        if (b.dataset.dlg === '0') return done(false);
        if (input) {
          const v = input.value.trim();
          if (o.input.required && !v) { const er = layer.querySelector('.dialog-err'); er.hidden = false; er.textContent = o.input.error || 'Preencha este campo.'; input.focus(); return; }
          return done(v || true);
        }
        done(true);
      });
      setTimeout(() => (input || layer.querySelector('[data-dlg="1"]')).focus(), 40);
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
    const colors = ['#8b5cf6', '#b69cff', '#f6b83c', '#ffd98a', '#ffffff', '#34d399'];
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)], life: 0 };
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
      el.textContent = fmtCount(f === 'money' ? to * e : Math.round(to * e), f);
      if (p < 1 && el.isConnected) requestAnimationFrame(step);
    })(t0);
  }
  U.num = (v, fmt, cls) => '<span class="' + (cls || 'num') + '" data-count="' + (Number(v) || 0) + '"' + (fmt ? ' data-fmt="' + fmt + '"' : '') + '>' + fmtCount(Number(v) || 0, fmt) + '</span>';

  /* efeito de toque */
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

  /* relógios ao vivo */
  setInterval(() => {
    document.querySelectorAll('[data-until]').forEach((el) => { el.textContent = U.until(Number(el.dataset.until)); });
    document.querySelectorAll('[data-ago]').forEach((el) => { el.textContent = U.ago(Number(el.dataset.ago)); });
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
    const sc = nice(max, 4);
    const bw = innerW / items.length;
    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = sc.step * k, y = padT + innerH - (v / sc.top) * innerH;
      grid += '<line x1="' + padL + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="' + (padL - 6) + '" y="' + (y + 3.5) + '" class="axis" text-anchor="end">' + short(v) + '</text>';
    }
    const bars = items.map((it, i) => {
      const h = Math.max(2, (it.value / sc.top) * innerH), x = padL + i * bw + bw * 0.18, w = bw * 0.64, y = padT + innerH - h;
      const lbl = it.label.length > 8 ? it.label.slice(0, 6) + '…' : it.label;
      return '<g class="bar-g" style="--i:' + i + '"><rect class="bar-r" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="' + it.color + '"/>' +
        '<text class="bar-v" x="' + (x + w / 2) + '" y="' + (y - 6) + '" text-anchor="middle">' + short(it.value) + '</text>' +
        '<text class="axis" x="' + (x + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + U.esc(lbl) + '</text></g>';
    }).join('');
    return '<svg class="chart bar-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(opt.label || 'Gráfico de barras') + '">' + grid + bars + '</svg>';
  };

  function smooth(pts) {
    if (pts.length < 2) return '';
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + c1x.toFixed(1) + ',' + Math.min(c1y, 999).toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }
  U.areaChart = function (series, labels, opt) {
    opt = opt || {};
    const W = 560, H = opt.height || 210, padL = 44, padR = 10, padT = 14, padB = 26;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const max = Math.max.apply(null, series.flatMap((s) => s.values).concat(1));
    const sc = nice(max, 4);
    const n = labels.length;
    const X = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const Y = (v) => padT + innerH - (v / sc.top) * innerH;
    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = sc.step * k, y = Y(v);
      grid += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="' + (padL - 8) + '" y="' + (y + 3.5) + '" class="axis" text-anchor="end">' + short(v) + '</text>';
    }
    const every = Math.ceil(n / 7);
    const xl = labels.map((l, i) => (i % every === 0 || i === n - 1) ? '<text class="axis" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + U.esc(l) + '</text>' : '').join('');
    const defs = series.map((s, si) => '<linearGradient id="ag' + si + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".32"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>').join('');
    const paths = series.map((s, si) => {
      const pts = s.values.map((v, i) => [X(i), Y(v)]);
      const line = smooth(pts);
      const area = line + 'L' + X(n - 1) + ',' + Y(0) + 'L' + X(0) + ',' + Y(0) + 'Z';
      const last = pts[pts.length - 1];
      return '<path d="' + area + '" fill="url(#ag' + si + ')" class="area-f"/>' +
        '<path d="' + line + '" fill="none" stroke="' + s.color + '" stroke-width="2.4" class="area-l" pathLength="1"/>' +
        '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="' + s.color + '" class="area-dot"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="9" fill="' + s.color + '" opacity=".18" class="area-dot"/>';
    }).join('');
    const data = U.esc(JSON.stringify({ labels, series: series.map((s) => ({ name: s.name, color: s.color, values: s.values })), padL, padR, W }));
    return '<div class="area-wrap" data-chart="' + data + '"><div class="chart-readout" aria-live="polite"></div>' +
      '<svg class="chart area-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(opt.label || 'Gráfico') + '"><defs>' + defs + '</defs>' + grid + xl + paths +
      '<line class="cursor" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + innerH) + '" opacity="0"/></svg></div>';
  };
  function readout(wrap, clientX) {
    const d = JSON.parse(wrap.dataset.chart);
    const svg = wrap.querySelector('svg'), r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * d.W;
    const n = d.labels.length, innerW = d.W - d.padL - d.padR;
    const i = Math.max(0, Math.min(n - 1, Math.round(((x - d.padL) / innerW) * (n - 1))));
    const cx = d.padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const cur = svg.querySelector('.cursor');
    cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.setAttribute('opacity', '1');
    wrap.querySelector('.chart-readout').innerHTML = '<b>' + U.esc(d.labels[i]) + '</b>' + d.series.map((s) => '<span><i style="background:' + s.color + '"></i>' + U.esc(s.name) + ' ' + U.money(s.values[i]) + '</span>').join('');
  }
  document.addEventListener('pointermove', (e) => { const w = e.target.closest && e.target.closest('.area-wrap'); if (w) readout(w, e.clientX); }, { passive: true });
  document.addEventListener('pointerdown', (e) => { const w = e.target.closest && e.target.closest('.area-wrap'); if (w) readout(w, e.clientX); }, { passive: true });

  U.spark = function (values, color) {
    const W = 96, H = 30, max = Math.max.apply(null, values.concat(1)), min = Math.min.apply(null, values);
    const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * (W - 4) + 2, H - 3 - ((v - min) / Math.max(1, max - min)) * (H - 6)]);
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + smooth(pts) + '" fill="none" stroke="' + color + '" stroke-width="2" pathLength="1" class="area-l"/><circle cx="' + pts[pts.length - 1][0] + '" cy="' + pts[pts.length - 1][1] + '" r="2.8" fill="' + color + '"/></svg>';
  };

  /* ---------- Pix e imagens ---------- */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  U.drawQR = function (canvas, text) {
    const N = 29, px = 6, q = 2, size = (N + q * 2) * px;
    canvas.width = size; canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    let h = hash(text);
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    const finder = (x, y) => x < 8 && y < 8 || x > N - 9 && y < 8 || x < 8 && y > N - 9;
    g.fillStyle = '#0b0a12';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (finder(x, y)) continue;
      if (rnd() > 0.52) g.fillRect((x + q) * px, (y + q) * px, px, px);
    }
    [[0, 0], [N - 7, 0], [0, N - 7]].forEach(([fx, fy]) => {
      g.fillRect((fx + q) * px, (fy + q) * px, 7 * px, 7 * px);
      g.fillStyle = '#fff'; g.fillRect((fx + q + 1) * px, (fy + q + 1) * px, 5 * px, 5 * px);
      g.fillStyle = '#0b0a12'; g.fillRect((fx + q + 2) * px, (fy + q + 2) * px, 3 * px, 3 * px);
    });
  };
  U.readImage = function (file, maxSide) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Escolha um arquivo de imagem (JPG ou PNG).'));
      if (file.size > 12 * 1024 * 1024) return reject(new Error('A imagem passa de 12 MB. Escolha um print menor.'));
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
        img.onload = () => {
          const k = Math.min(1, (maxSide || 900) / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };
  /* print de exemplo para verificações sem imagem enviada */
  U.ffShot = function (ff, nick) {
    const e = (s) => U.esc(s || '');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1b0b"/><stop offset=".55" stop-color="#15101d"/><stop offset="1" stop-color="#0b0a12"/></linearGradient></defs>' +
      '<rect width="360" height="640" fill="url(#g)"/><rect x="0" y="0" width="360" height="54" fill="#000" opacity=".35"/>' +
      '<text x="18" y="34" font-family="Arial Black,Arial" font-size="18" fill="#f6b83c">FREE FIRE</text><text x="342" y="34" font-family="Arial" font-size="12" fill="#bbb" text-anchor="end">PERFIL</text>' +
      '<circle cx="180" cy="170" r="62" fill="#3b2a55" stroke="#f6b83c" stroke-width="4"/><circle cx="180" cy="152" r="24" fill="#8b7aa8"/><path d="M134 214c10-30 82-30 92 0" fill="#8b7aa8"/>' +
      '<text x="180" y="276" font-family="Arial" font-weight="700" font-size="24" fill="#fff" text-anchor="middle">' + e(ff.nick || nick) + '</text>' +
      '<rect x="60" y="300" width="240" height="44" rx="8" fill="#000" opacity=".4"/><text x="180" y="328" font-family="Courier New,monospace" font-size="18" fill="#fde68a" text-anchor="middle">ID: ' + e(ff.id) + '</text>' +
      '<rect x="40" y="370" width="130" height="90" rx="10" fill="#fff" opacity=".06"/><text x="105" y="405" font-family="Arial" font-size="13" fill="#aaa" text-anchor="middle">NÍVEL</text><text x="105" y="440" font-family="Arial Black,Arial" font-size="28" fill="#fff" text-anchor="middle">' + e(ff.level) + '</text>' +
      '<rect x="190" y="370" width="130" height="90" rx="10" fill="#fff" opacity=".06"/><text x="255" y="405" font-family="Arial" font-size="13" fill="#aaa" text-anchor="middle">RANK BR</text><text x="255" y="438" font-family="Arial" font-weight="700" font-size="17" fill="#7dd3fc" text-anchor="middle">' + e(ff.rank) + '</text>' +
      '<text x="180" y="600" font-family="Arial" font-size="11" fill="#666" text-anchor="middle">Print de exemplo (dados de demonstração)</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  U.copy = function (text, input) {
    const fallback = () => { if (input) { input.focus(); input.select(); } U.toast('Selecionei o código. Copie com o menu do teclado.', 'info'); };
    try {
      navigator.clipboard.writeText(text).then(() => U.toast('Código copiado.', 'good'), fallback);
    } catch (e) { fallback(); }
  };
})();
