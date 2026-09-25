/* Navegação líquida: a barra tem um recorte que acompanha a bolha do item ativo.
   A posição segue uma mola; a velocidade afunda e estica a bolha e alarga o recorte. */
window.BH = window.BH || {};
(function () {
  const I = BH.icon;
  const R_BUBBLE = 25;   // raio da bolha
  const GAP = 6;         // folga entre bolha e recorte
  const LIFT = 2;        // centro da bolha em relação ao topo da barra

  BH.LiquidNav = function (root, opts) {
    const items = opts.items;
    let active = opts.active || items[0].id;
    root.classList.add('lnav');
    root.setAttribute('aria-label', 'Navegação principal');
    root.innerHTML =
      '<svg class="lnav-bg" aria-hidden="true" overflow="visible">' +
      '<defs><mask id="lnav-mask" maskUnits="userSpaceOnUse"><rect class="m-all" fill="#fff"/><path class="m-notch" fill="#000"/></mask>' +
      '<linearGradient id="lnav-edge" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<rect class="bar" mask="url(#lnav-mask)"/><rect class="bar-edge" fill="url(#lnav-edge)" mask="url(#lnav-mask)"/></svg>' +
      '<span class="lnav-bubble" aria-hidden="true"><span class="lnav-sheen"></span></span>' +
      '<ul class="lnav-items">' + items.map((it) =>
        '<li><button type="button" data-tab="' + it.id + '" aria-label="' + it.label + '">' +
        '<span class="lnav-ic">' + I(it.icon) + '</span><span class="lnav-lb">' + it.label + '</span><b class="lnav-badge" hidden></b></button></li>'
      ).join('') + '</ul>';

    const svg = root.querySelector('svg'), bar = svg.querySelector('.bar'), edge = svg.querySelector('.bar-edge');
    const mAll = svg.querySelector('.m-all'), notch = svg.querySelector('.m-notch');
    const bubble = root.querySelector('.lnav-bubble');
    const buttons = Array.from(root.querySelectorAll('button[data-tab]'));
    let W = 0, H = 0, x = 0, v = 0, target = 0, raf = 0, landed = true;

    function centerOf(id) {
      const i = Math.max(0, items.findIndex((it) => it.id === id));
      const r = buttons[i].getBoundingClientRect(), rr = root.getBoundingClientRect();
      return r.left - rr.left + r.width / 2;
    }
    function measure() {
      W = root.clientWidth; H = root.clientHeight;
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      [bar, edge].forEach((r) => { r.setAttribute('width', W); r.setAttribute('height', H); r.setAttribute('rx', Math.min(24, H / 2 - 6)); });
      edge.setAttribute('height', Math.min(24, H));
      mAll.setAttribute('x', -40); mAll.setAttribute('y', -60); mAll.setAttribute('width', W + 80); mAll.setAttribute('height', H + 100);
      const mask = svg.querySelector('mask');
      mask.setAttribute('x', -40); mask.setAttribute('y', -60); mask.setAttribute('width', W + 80); mask.setAttribute('height', H + 100);
      target = centerOf(active);
    }
    function draw(stretch) {
      const s = Math.min(1, stretch);
      const dip = s * 15;                          // a bolha afunda enquanto corre
      const cy = LIFT + dip;
      const R = R_BUBBLE + GAP;
      const a = R + 15 + s * 22;                   // meia-largura do recorte, alarga com a velocidade
      const dep = Math.max(8, cy + R_BUBBLE + GAP - s * 10);
      const k = 16 + s * 10;
      notch.setAttribute('d',
        'M' + (x - a) + ',-2 L' + (x - a) + ',0 C' + (x - a + k) + ',0 ' + (x - R - 1) + ',' + dep + ' ' + x + ',' + dep +
        ' C' + (x + R + 1) + ',' + dep + ' ' + (x + a - k) + ',0 ' + (x + a) + ',0 L' + (x + a) + ',-2 Z');
      const sx = 1 + s * 0.24, sy = 1 - s * 0.16;
      bubble.style.transform = 'translate(' + (x - R_BUBBLE) + 'px,' + (cy - R_BUBBLE) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    }
    function tick() {
      const f = (target - x) * 0.09;
      v = (v + f) * 0.76;
      x += v;
      draw(Math.abs(v) / 13);
      if (Math.abs(v) < 0.04 && Math.abs(target - x) < 0.2) {
        x = target; v = 0; draw(0); raf = 0;
        if (!landed) { landed = true; bubble.classList.remove('land'); void bubble.offsetWidth; bubble.classList.add('land'); }
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    function mark() {
      buttons.forEach((b) => {
        const on = b.dataset.tab === active;
        b.classList.toggle('on', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
    }
    function set(id, animate) {
      if (!items.some((it) => it.id === id)) return;
      active = id; mark();
      target = centerOf(id);
      const instant = animate === false || (BH.ui && BH.ui.reduced());
      if (instant) { x = target; v = 0; draw(0); return; }
      landed = false;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      const id = b.dataset.tab;
      if (opts.onChange) opts.onChange(id, id === active);
    });
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = buttons.indexOf(document.activeElement); if (i < 0) return;
      const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[j].focus();
    });

    mark(); measure(); x = target; draw(0);
    if (window.ResizeObserver) new ResizeObserver(() => { measure(); x = target; v = 0; draw(0); }).observe(root);
    else window.addEventListener('resize', () => { measure(); x = target; draw(0); });

    return {
      set,
      get active() { return active; },
      badge(id, n) {
        const b = buttons.find((x) => x.dataset.tab === id);
        if (!b) return;
        const el = b.querySelector('.lnav-badge');
        el.hidden = !n; el.textContent = n > 9 ? '9+' : String(n || '');
      }
    };
  };
})();
