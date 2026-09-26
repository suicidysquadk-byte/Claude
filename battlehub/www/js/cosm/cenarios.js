/* Cenários ilustrados dos banners, capas e fundos (estilo Discord: arte cheia, com profundidade e movimento suave).
   Desempenho em primeiro lugar. Cada cena é montada em camadas:
   - fundo (SVG parado, desenhado uma vez só);
   - camadas que se mexem: cada uma é um <div> com o próprio SVG, e só o <div> anda (transform/opacity).
     Quem move é a placa de vídeo do celular; o desenho não é refeito a cada quadro;
   - partículas (neve, brasas, pétalas...) são <i> com CSS, também só transform/opacity;
   - frente (SVG parado por cima: silhuetas, vinheta).
   A mesma cena serve em proporções diferentes: banner (480x180), capa (400x240) e fundo (360x720). */
(function () {
  const C = BH.cosm;
  const f = (n) => Math.round(n * 10) / 10;
  const SIZE = { banner: [480, 180], capa: [400, 240], fundo: [360, 720] };
  const lite = () => document.documentElement.classList.contains('bh-lite');

  /* ---------------- ajudantes de desenho ---------------- */
  // gradiente linear vertical (x1,y1 → x2,y2 em fração) e radial
  const lg = (id, stops, x2, y2, x1, y1) => '<linearGradient id="' + id + '" x1="' + (x1 || 0) + '" y1="' + (y1 || 0) + '" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' +
    stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
  const rg = (id, stops, cx, cy, r) => '<radialGradient id="' + id + '"' + (cx != null ? ' cx="' + cx + '" cy="' + cy + '" r="' + r + '"' : '') + '>' +
    stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</radialGradient>';
  const rect = (w, h, fill, op) => '<rect width="' + w + '" height="' + h + '" fill="' + fill + '"' + (op != null ? ' opacity="' + op + '"' : '') + '/>';
  // brilho redondo (luz, lua, sol): só gradiente, sem filtro
  const glow = (id, cx, cy, r, color, op) => '<defs>' + rg(id, [[0, color, op == null ? .9 : op], [.35, color, (op == null ? .9 : op) * .35], [1, color, 0]]) + '</defs><circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="url(#' + id + ')"/>';
  // vinheta nas bordas: dá profundidade e deixa o avatar/nome legíveis
  const vignette = (u, w, h, strength) => '<defs>' + rg(u + 'vg', [[.55, '#000', 0], [1, '#000', strength == null ? .55 : strength]], .5, .45, .75) + '</defs>' + rect(w, h, 'url(#' + u + 'vg)');
  // montanhas: picos sorteados entre y e y-amp
  function ridge(r, w, h, y, amp, n, sharp) {
    let d = 'M-10 ' + f(h + 2) + 'L-10 ' + f(y), x = -10;
    const step = (w + 20) / n;
    for (let i = 0; i < n; i++) {
      const px = x + step * (.35 + r() * .3), py = y - amp * (.35 + r() * .65);
      const nx = x + step, ny = y - amp * r() * .35;
      d += sharp ? 'L' + f(px) + ' ' + f(py) + 'L' + f(nx) + ' ' + f(ny) : 'Q' + f(px) + ' ' + f(py - amp * .25) + ' ' + f(nx) + ' ' + f(ny);
      x = nx;
    }
    return d + 'L' + f(w + 10) + ' ' + f(h + 2) + 'Z';
  }
  // pinheiros em silhueta ao longo de uma linha
  function pines(r, w, y, n, hmin, hmax, fill) {
    let s = '<g fill="' + fill + '">';
    for (let i = 0; i < n; i++) {
      const x = (i + r() * .8) * (w / n), th = hmin + r() * (hmax - hmin), tw = th * .34;
      s += '<path d="M' + f(x) + ' ' + f(y - th) + 'L' + f(x + tw * .55) + ' ' + f(y - th * .55) + 'L' + f(x + tw * .3) + ' ' + f(y - th * .55) + 'L' + f(x + tw) + ' ' + f(y) + 'L' + f(x - tw) + ' ' + f(y) + 'L' + f(x - tw * .3) + ' ' + f(y - th * .55) + 'L' + f(x - tw * .55) + ' ' + f(y - th * .55) + 'Z"/>';
    }
    return s + '</g>';
  }
  // prédios com janelas acesas (paradas)
  function skyline(r, w, h, base, hmin, hmax, fill, lit, winColors) {
    let s = '<g fill="' + fill + '">', win = '', x = -6;
    while (x < w + 6) {
      const bw = 16 + r() * 26, bh = hmin + r() * (hmax - hmin);
      s += '<rect x="' + f(x) + '" y="' + f(base - bh) + '" width="' + f(bw) + '" height="' + f(bh + 4) + '"/>';
      if (r() < .3) s += '<rect x="' + f(x + bw * .4) + '" y="' + f(base - bh - 10) + '" width="2" height="10"/>';
      if (lit) for (let wy = base - bh + 6; wy < base - 4; wy += 7) for (let wx = x + 4; wx < x + bw - 4; wx += 6) if (r() < lit) win += '<rect x="' + f(wx) + '" y="' + f(wy) + '" width="2.4" height="3" fill="' + winColors[Math.floor(r() * winColors.length)] + '" opacity="' + f(.5 + r() * .5) + '"/>';
      x += bw + r() * 4;
    }
    return s + '</g>' + win;
  }
  // nuvem fofa (vários círculos)
  function cloud(x, y, s, fill, op) {
    return '<g fill="' + fill + '" opacity="' + (op == null ? 1 : op) + '"><ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(s * 1.6) + '" ry="' + f(s * .55) + '"/><circle cx="' + f(x - s * .6) + '" cy="' + f(y - s * .25) + '" r="' + f(s * .55) + '"/>' +
      '<circle cx="' + f(x + s * .15) + '" cy="' + f(y - s * .45) + '" r="' + f(s * .7) + '"/><circle cx="' + f(x + s * .85) + '" cy="' + f(y - s * .15) + '" r="' + f(s * .5) + '"/></g>';
  }
  // estrelas paradas (as que piscam são partículas)
  function starfield(r, w, h, n, color) {
    let s = '<g fill="' + (color || '#fff') + '">';
    for (let i = 0; i < n; i++) s += '<circle cx="' + f(r() * w) + '" cy="' + f(r() * h) + '" r="' + f(.35 + r() * .9) + '" opacity="' + f(.25 + r() * .75) + '"/>';
    return s + '</g>';
  }
  // raio com brilho (traço largo e transparente + traço fino claro)
  function bolt(r, x, y, len, color) {
    let d = 'M' + f(x) + ' ' + f(y), cx = x, cy = y, br = '';
    for (let i = 0; i < 7; i++) {
      cx += (r() - .5) * len * .22; cy += len / 7; d += 'L' + f(cx) + ' ' + f(cy);
      if (i === 2 || i === 4) { let bx = cx, by = cy; br += 'M' + f(bx) + ' ' + f(by); for (let k = 0; k < 3; k++) { bx += (r() - .3) * len * .12; by += len / 12; br += 'L' + f(bx) + ' ' + f(by); } }
    }
    return '<path d="' + d + br + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linejoin="round" opacity=".18"/>' +
      '<path d="' + d + br + '" fill="none" stroke="' + color + '" stroke-width="3.2" stroke-linejoin="round" opacity=".55"/>' +
      '<path d="' + d + br + '" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>';
  }

  /* ---------------- partículas (HTML: só transform e opacity) ----------------
     tipos: neve, chuva, brasa, petala, folha, estrela, bokeh, bolha, faisca, vagalume, pacote, carro, passaro, cinza, poeira, fogo-fatuo */
  const PMAX = { banner: 1, capa: 1.1, fundo: 1.3, deco: 1 };
  function particles(list, k) {
    if (!list || !list.length) return '';
    const r = C.rng('pt' + k.u), mul = (PMAX[k.kind] || 1) * (k.lite ? .5 : 1);
    let s = '<div class="sn-p" aria-hidden="true">';
    list.forEach((p) => {
      const n = Math.max(1, Math.round(p.n * mul)), cols = [].concat(p.c || '#fff');
      for (let i = 0; i < n; i++) {
        const x = (p.x0 != null ? p.x0 : 0) + r() * ((p.x1 != null ? p.x1 : 100) - (p.x0 != null ? p.x0 : 0));
        const y = (p.y0 != null ? p.y0 : 0) + r() * ((p.y1 != null ? p.y1 : 100) - (p.y0 != null ? p.y0 : 0));
        const sz = (p.s || [2, 4]), size = sz[0] + r() * (sz[1] - sz[0]);
        const d = (p.d || [6, 10]), dur = d[0] + r() * (d[1] - d[0]);
        s += '<i class="pt-' + p.t + '" style="left:' + f(x) + '%;top:' + f(y) + '%;--s:' + f(size) + 'px;--c:' + cols[i % cols.length] + ';--d:' + f(dur) + 's;--dl:-' + f(r() * dur) + 's;--sw:' + f((r() - .5) * 2 * (p.sw || 20)) + 'px;--r:' + f(r() * 360) + 'deg"></i>';
      }
    });
    return s + '</div>';
  }

  /* ---------------- cenas ----------------
     cada uma recebe k = { P (paleta), u (id único), w, h, r (sorteio fixo), kind, lite } e devolve
     { back, layers: [{ a: animação, svg, d, dl, o: origem }], parts: [...], front } */
  const S = {};

  // Ondas: mar à noite com lua, reflexo e três ondas em camadas
  S.ondas = (k) => {
    const { P, u, w, h, r } = k, hz = h * .56;
    const wave = (y, amp, len, ph) => { let d = 'M' + f(-w * .1) + ' ' + f(y); for (let x = -w * .1; x <= w * 1.2; x += len) d += 'q' + f(len / 4) + ' ' + f(-amp) + ' ' + f(len / 2) + ' 0t' + f(len / 2) + ' 0'; void ph; return d + 'V' + f(h + 4) + 'H' + f(-w * .1) + 'Z'; };
    return {
      back: '<defs>' + lg(u + 's', [[0, '#03040c'], [.55, P.d], [1, P.a]]) + lg(u + 'm', [[0, P.a], [1, '#02030a']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        starfield(r, w, hz * .9, Math.round(w * hz / 700), P.c) + glow(u + 'lg', w * .74, h * .3, h * .55, P.c, .45) +
        '<circle cx="' + f(w * .74) + '" cy="' + f(h * .3) + '" r="' + f(h * .12) + '" fill="' + P.c + '"/><circle cx="' + f(w * .72) + '" cy="' + f(h * .28) + '" r="' + f(h * .025) + '" fill="#000" opacity=".08"/>' +
        '<rect y="' + f(hz) + '" width="' + w + '" height="' + f(h - hz) + '" fill="url(#' + u + 'm)"/>' +
        '<g fill="' + P.c + '" opacity=".55">' + [...Array(9)].map((_, i) => '<rect x="' + f(w * .74 - (6 + i * 4) / 2 - r() * 6) + '" y="' + f(hz + 4 + i * (h - hz) / 10) + '" width="' + f(10 + i * 5 + r() * 8) + '" height="1.6" rx=".8"/>').join('') + '</g>',
      layers: [
        { a: 'sway', d: 9, svg: '<path d="' + wave(hz + (h - hz) * .22, 5, w / 6) + '" fill="' + P.b + '" opacity=".35"/>' },
        { a: 'sway2', d: 7, svg: '<path d="' + wave(hz + (h - hz) * .45, 8, w / 4.5) + '" fill="' + P.a + '" opacity=".55"/><path d="' + wave(hz + (h - hz) * .45, 8, w / 4.5).replace(/V.*$/, '') + '" fill="none" stroke="' + P.c + '" stroke-width="1.4" opacity=".6"/>' },
        { a: 'sway', d: 6, dl: 2, svg: '<path d="' + wave(hz + (h - hz) * .72, 12, w / 3.4) + '" fill="' + P.d + '"/><path d="' + wave(hz + (h - hz) * .72, 12, w / 3.4).replace(/V.*$/, '') + '" fill="none" stroke="' + P.c + '" stroke-width="2" opacity=".8" stroke-dasharray="14 10"/>' }
      ],
      parts: [{ t: 'estrela', n: 14, c: ['#fff', P.c], y1: 50, s: [1.5, 3], d: [2, 5] }, { t: 'faisca', n: 8, c: P.c, x0: 55, x1: 95, y0: 60, y1: 95, s: [1.5, 2.5], d: [2, 4] }],
      front: vignette(u, w, h, .5)
    };
  };

  // Dragão: dragão oriental dourado serpenteando entre nuvens, perseguindo a pérola
  S.dragao = (k) => {
    const { P, u, w, h, r } = k;
    const sx = w / 480, sy = h / 180, s = Math.min(sx, sy * 1.25);
    const T = (x, y) => f(x * sx) + ' ' + f(y * sy);
    const segs = [[[-30, 172], [30, 176], [60, 88], [130, 82]], [[130, 82], [200, 76], [215, 168], [285, 150]], [[285, 150], [340, 136], [340, 78], [372, 70]]];
    const spine = 'M' + T(-30, 172) + segs.map((g) => 'C' + T(g[1][0], g[1][1]) + ' ' + T(g[2][0], g[2][1]) + ' ' + T(g[3][0], g[3][1])).join('');
    const bw = 25 * s;
    const bez = (g, t) => { const m = 1 - t; return [0, 1].map((j) => m * m * m * g[0][j] + 3 * m * m * t * g[1][j] + 3 * m * t * t * g[2][j] + t * t * t * g[3][j]); };
    let scales = '', fins = '', belly = '';
    segs.forEach((g, si) => {
      for (let t = .03; t < .99; t += .06) {
        const p = bez(g, t), q = bez(g, t + .01), ang = Math.atan2((q[1] - p[1]) * sy, (q[0] - p[0]) * sx) * 180 / Math.PI;
        const tr = 'translate(' + T(p[0], p[1]) + ') rotate(' + f(ang) + ')';
        // escamas em arco, da cor escura, bem discretas
        scales += '<path transform="' + tr + '" d="M' + f(-3 * s) + ' ' + f(-bw * .42) + 'q' + f(7 * s) + ' ' + f(bw * .42) + ' 0 ' + f(bw * .84) + '" fill="none" stroke="' + P.d + '" stroke-width="' + f(1.1 * s) + '" opacity=".45"/>';
        // placas da barriga (lado de baixo)
        belly += '<path transform="' + tr + '" d="M' + f(-4 * s) + ' ' + f(bw * .18) + 'h' + f(8 * s) + 'l' + f(-1 * s) + ' ' + f(bw * .28) + 'h' + f(-6 * s) + 'Z" fill="' + P.c + '" opacity=".55"/>';
        // crista de espinhos nas costas, alternando tamanho
        if (si < 3) { const sp = (Math.round(t * 50) % 2 ? 8 : 12) * s; fins += '<path transform="' + tr + '" d="M' + f(-5 * s) + ' ' + f(-bw * .46) + 'Q' + f(-2 * s) + ' ' + f(-bw * .46 - sp) + ' ' + f(5 * s) + ' ' + f(-bw * .46 - sp * 1.1) + 'Q' + f(3 * s) + ' ' + f(-bw * .5) + ' ' + f(6 * s) + ' ' + f(-bw * .44) + 'Z" fill="' + P.a + '" stroke="' + P.d + '" stroke-width="' + f(.8 * s) + '"/>'; }
      }
    });
    // pata com três garras
    const leg = (g, t, flip) => {
      const p = bez(g, t);
      return '<g transform="translate(' + T(p[0], p[1]) + ') scale(' + f(s * (flip ? -1 : 1)) + ' ' + f(s) + ')"><path d="M0 4C4 14 2 22 10 28" fill="none" stroke="' + P.d + '" stroke-width="14" stroke-linecap="round"/><path d="M0 4C4 14 2 22 10 28" fill="none" stroke="url(#' + u + 'bd)" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M10 28q-8 2-10 10M10 28q-1 6 2 12M10 28q6 2 10 8" fill="none" stroke="' + P.c + '" stroke-width="2.6" stroke-linecap="round"/></g>';
    };
    const hx = 372 * sx, hy = 70 * sy, hs = s * 1.15;
    const head = '<g transform="translate(' + f(hx) + ' ' + f(hy) + ') rotate(-14) scale(' + f(hs) + ')">' +
      // juba atrás da cabeça
      '<path d="M-6 -10C-22 -26 -34 -16 -44 -26C-38 -6 -26 -2 -14 0C-30 6 -34 18 -46 20C-30 30 -16 20 -8 12Z" fill="' + P.a + '" stroke="' + P.d + '" stroke-width="1.2"/>' +
      '<path d="M-2 -12C-12 -34 -24 -30 -30 -42C-18 -40 -8 -30 0 -18Z" fill="' + P.b + '" opacity=".8"/>' +
      // chifres
      '<path d="M8 -14C12 -34 26 -46 44 -48C32 -40 24 -28 20 -12Z" fill="url(#' + u + 'hn)" stroke="' + P.d + '" stroke-width="1.2"/><path d="M0 -12C0 -30 8 -42 20 -50C14 -38 10 -26 10 -10Z" fill="url(#' + u + 'hn)" stroke="' + P.d + '" stroke-width="1.2" opacity=".85"/>' +
      // crânio e focinho
      '<path d="M-10 -10C4 -22 26 -20 40 -10C52 -4 60 2 60 8C50 9 44 8 38 10L30 12C22 20 6 22 -6 16C-16 10 -18 -2 -10 -10Z" fill="url(#' + u + 'hd)" stroke="' + P.d + '" stroke-width="1.6"/>' +
      '<path d="M16 -14C24 -16 34 -12 40 -8" fill="none" stroke="' + P.c + '" stroke-width="2" stroke-linecap="round" opacity=".8"/>' +
      // narina
      '<circle cx="54" cy="4" r="1.6" fill="' + P.d + '"/>' +
      // mandíbula aberta, língua e dentes
      '<path d="M30 12C40 12 52 12 60 10C58 20 44 26 30 20Z" fill="url(#' + u + 'hd)" stroke="' + P.d + '" stroke-width="1.4"/><path d="M34 13C42 14 50 14 56 12C52 17 44 19 36 17Z" fill="#6d0f0f"/>' +
      '<path d="M38 10l2 5 2-5M46 10l2 5 2-5M52 10l1.6 4 1.6-4" fill="#fffbea"/>' +
      // olho
      '<path d="M14 -8C18 -12 26 -12 30 -7C26 -4 18 -4 14 -8Z" fill="#fff"/><ellipse class="dr-eye" cx="23" cy="-8" rx="2.2" ry="3.4" fill="' + P.g + '"/><path d="M12 -12C18 -16 28 -16 33 -10" fill="none" stroke="' + P.d + '" stroke-width="2"/>' +
      // bigodes longos
      '<path d="M56 6C72 -4 90 0 100 12M50 16C64 26 70 40 64 54" fill="none" stroke="' + P.b + '" stroke-width="2" stroke-linecap="round"/></g>';
    return {
      back: '<defs>' + lg(u + 'sk', [[0, '#040203'], [.55, P.d], [1, '#070403']]) + lg(u + 'bd', [[0, P.c], [.35, P.b], [.75, P.a], [1, P.d]]) +
        lg(u + 'hd', [[0, P.c], [.5, P.b], [1, P.a]]) + lg(u + 'hn', [[0, '#fffbea'], [1, P.b]], 1, 0) + '</defs>' + rect(w, h, 'url(#' + u + 'sk)') +
        glow(u + 'g1', w * .3, h * .7, h * 1.1, P.a, .3) + glow(u + 'g2', w * .95, h * .1, h * .7, P.g, .25) +
        // nuvens em espiral ao fundo
        '<g fill="none" stroke="' + P.b + '" stroke-width="' + f(1.4 * s) + '" opacity=".22" stroke-linecap="round">' + [...Array(6)].map((_, i) => { const cx = (40 + i * 85 + r() * 20) * sx, cy = (28 + (i % 2) * 110 + r() * 20) * sy, rr = (10 + r() * 8) * s; return '<path d="M' + f(cx - rr * 2.4) + ' ' + f(cy + rr) + 'H' + f(cx - rr) + 'a' + f(rr) + ' ' + f(rr) + ' 0 1 1 ' + f(rr * 1.2) + ' ' + f(-rr * .8) + 'a' + f(rr * .5) + ' ' + f(rr * .5) + ' 0 1 0 ' + f(-rr * .5) + ' ' + f(rr * .4) + 'M' + f(cx + rr * .4) + ' ' + f(cy + rr) + 'H' + f(cx + rr * 3) + '"/>'; }).join('') + '</g>',
      layers: [
        // pérola que o dragão persegue
        { a: 'breath', d: 2.6, o: '92.5% 22%', svg: glow(u + 'pl', 444 * sx, 40 * sy, 30 * s, P.c, .95) + '<circle cx="' + f(444 * sx) + '" cy="' + f(40 * sy) + '" r="' + f(8 * s) + '" fill="#fffdf2"/>' },
        // corpo inteiro: flutua devagar
        { a: 'bob', d: 5.5, svg: '<path d="' + spine + '" fill="none" stroke="' + P.d + '" stroke-width="' + f(bw + 4 * s) + '" stroke-linecap="round"/>' +
          fins + '<path d="' + spine + '" fill="none" stroke="url(#' + u + 'bd)" stroke-width="' + f(bw) + '" stroke-linecap="round"/>' + belly + scales +
          leg(segs[0], .75, false) + leg(segs[1], .7, true) + head },
        // nuvens da frente
        { a: 'sway', d: 12, svg: cloud(w * .1, h * .98, 30 * s, '#0b0705', 1) + cloud(w * .55, h * 1.02, 40 * s, '#0b0705', 1) + cloud(w * .92, h * .96, 26 * s, '#0b0705', 1) +
          cloud(w * .1, h * .98, 30 * s, P.d, .55) }
      ],
      parts: [{ t: 'brasa', n: 16, c: [P.g, P.c], y0: 20, y1: 100, s: [1.5, 3.5], d: [4, 8], sw: 30 }, { t: 'faisca', n: 7, c: P.c, s: [1.5, 3], d: [2, 4] }],
      front: vignette(u, w, h, .5)
    };
  };

  // Fumaça: névoa escura densa, com volumes que respiram e poeira no ar
  S.fumaca = (k) => {
    const { P, u, w, h, r } = k;
    const puff = (id, cx, cy, rr, col, op) => '<defs>' + rg(id, [[0, col, op], [.6, col, op * .35], [1, col, 0]]) + '</defs><ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rr * 1.6) + '" ry="' + f(rr) + '" fill="url(#' + id + ')"/>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#050508'], [.6, P.d], [1, '#020203']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'l', w * .5, h * .55, h * .9, P.b, .25),
      layers: [
        { a: 'drift', d: 26, svg: puff(u + 'a', w * .2, h * .62, h * .6, P.b, .85) + puff(u + 'b', w * .78, h * .3, h * .5, P.g, .7) },
        { a: 'sway2', d: 17, svg: puff(u + 'c', w * .45, h * .85, h * .6, P.c, .35) + puff(u + 'd', w * .98, h * .8, h * .45, P.b, .75) },
        { a: 'breath', d: 7, o: '30% 50%', svg: puff(u + 'e', w * .32, h * .4, h * .4, P.g, .55) }
      ],
      parts: [{ t: 'poeira', n: 18, c: [P.c, '#fff'], s: [1, 2.4], d: [5, 10], sw: 30 }, { t: 'faisca', n: 6, c: P.g, s: [1.5, 2.5], d: [2, 4] }],
      front: '<path d="' + ridge(r, w, h, h * .96, h * .1, 7) + '" fill="#020203"/>' + vignette(u, w, h, .5)
    };
  };

  // Chamas: muralha de fogo em duas camadas, chão de pedra e brasas subindo
  S.chamas = (k) => {
    const { P, u, w, h, r } = k;
    // língua de fogo: base larga, corpo que entorta para um lado e ponta fina curvada
    const flames = (n, base, hmin, hmax, fill, seed) => { const rr = C.rng(seed); let d = ''; for (let i = 0; i <= n; i++) { const x = (i / n) * w * 1.1 - w * .05, fh = hmin + rr() * (hmax - hmin), fw = w / n * (.8 + rr() * .6), lean = (rr() - .5) * fw * 1.4;
      d += 'M' + f(x - fw) + ' ' + f(base) + 'C' + f(x - fw * 1.1) + ' ' + f(base - fh * .45) + ' ' + f(x - fw * .2 + lean * .5) + ' ' + f(base - fh * .55) + ' ' + f(x + lean * .6) + ' ' + f(base - fh * .78) + 'Q' + f(x + lean) + ' ' + f(base - fh * .92) + ' ' + f(x + lean * 1.3) + ' ' + f(base - fh) +
        'Q' + f(x + lean * .4 + fw * .35) + ' ' + f(base - fh * .7) + ' ' + f(x + fw * .5) + ' ' + f(base - fh * .5) + 'C' + f(x + fw * 1.1) + ' ' + f(base - fh * .3) + ' ' + f(x + fw * 1.05) + ' ' + f(base - fh * .1) + ' ' + f(x + fw) + ' ' + f(base) + 'Z'; } return '<path d="' + d + '" fill="' + fill + '"/>'; };
    return {
      back: '<defs>' + lg(u + 's', [[0, '#050101'], [.55, P.d], [1, P.a]]) + lg(u + 'f1', [[0, '#fff7ae'], [.35, P.g], [.75, P.a], [1, P.d]], 0, 0, 0, 1) + lg(u + 'f2', [[0, '#fffbe6'], [.4, P.b], [1, P.a]], 0, 0, 0, 1) + '</defs>' +
        rect(w, h, 'url(#' + u + 's)') + glow(u + 'g', w * .5, h, h * 1.1, P.g, .55),
      layers: [
        { a: 'flick', d: 1.1, svg: flames(8, h + 2, h * .55, h * .95, 'url(#' + u + 'f1)', 'fa') },
        { a: 'flick', d: .8, dl: .4, svg: flames(11, h + 2, h * .35, h * .65, 'url(#' + u + 'f2)', 'fb') },
        { a: 'flick', d: .6, dl: .2, svg: flames(15, h + 2, h * .12, h * .3, '#fffbe6', 'fc').replace('<path', '<path opacity=".75"') }
      ],
      parts: [{ t: 'brasa', n: 22, c: [P.g, '#fff3b0', P.b], s: [1.5, 3.5], d: [2.5, 5], sw: 40 }],
      front: '<path d="' + ridge(r, w, h, h * .97, h * .08, 8) + '" fill="#0a0302"/>' + vignette(u, w, h, .45)
    };
  };

  // Tempestade: nuvens pesadas em camadas, raios que clareiam o céu e chuva
  S.raios = (k) => {
    const { P, u, w, h, r } = k;
    const clouds = (y, n, sz, fill, op, seed) => { const rr = C.rng(seed); let c = ''; for (let i = 0; i < n; i++) c += cloud((i + rr() * .6) * w / (n - 1), y + rr() * sz * .4, sz * (.8 + rr() * .5), fill, op); return c; };
    return {
      back: '<defs>' + lg(u + 's', [[0, '#020206'], [.7, P.d], [1, '#07060d']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + '<path d="' + ridge(r, w, h, h * .92, h * .12, 6) + '" fill="#030306"/>',
      layers: [
        { a: 'flashbg', d: 5.5, svg: rect(w, h, P.c, .3) },
        { a: 'flash', d: 5.5, svg: bolt(C.rng('b1' + u), w * .62, -4, h * .95, P.g) },
        { a: 'flash', d: 7, dl: 3, svg: bolt(C.rng('b2' + u), w * .22, -4, h * .8, P.c) },
        { a: 'sway', d: 16, svg: clouds(h * .12, 6, h * .22, P.a, .55, 'c1') },
        { a: 'sway2', d: 12, svg: clouds(h * .02, 5, h * .26, '#0a0912', .95, 'c2') }
      ],
      parts: [{ t: 'chuva', n: 34, c: P.c, s: [3, 5], d: [.5, .9] }],
      front: vignette(u, w, h, .45)
    };
  };

  // Céu estrelado: via láctea, cadente e silhueta de montanhas com barraca e fogueira
  S.estrelas = (k) => {
    const { P, u, w, h, r } = k;
    return {
      back: '<defs>' + lg(u + 's', [[0, '#01010a'], [.7, P.d], [1, P.a]]) + lg(u + 'mw', [[0, P.b, 0], [.5, P.c, .35], [1, P.b, 0]], 1, 1) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        '<ellipse cx="' + f(w * .5) + '" cy="' + f(h * .35) + '" rx="' + f(w * .7) + '" ry="' + f(h * .16) + '" fill="url(#' + u + 'mw)" transform="rotate(-14 ' + f(w * .5) + ' ' + f(h * .35) + ')"/>' +
        starfield(r, w, h * .8, Math.round(w * h / 260), '#fff') + glow(u + 'pl', w * .82, h * .22, h * .18, P.c, .6),
      layers: [
        { a: 'sweep', d: 7, dl: 2, svg: '<defs>' + lg(u + 'sh', [[0, '#fff', 0], [1, '#fff']], 1, 0) + '</defs><path d="M' + f(w * .3) + ' ' + f(h * .3) + 'l' + f(w * .12) + ' ' + f(-h * .12) + '" stroke="url(#' + u + 'sh)" stroke-width="1.6" stroke-linecap="round"/>' }
      ],
      parts: [{ t: 'estrela', n: 22, c: ['#fff', P.c, P.b], y1: 70, s: [1.5, 3.2], d: [2, 5] }],
      front: '<path d="' + ridge(r, w, h, h * .86, h * .22, 5) + '" fill="' + P.d + '"/><path d="' + ridge(r, w, h, h * .95, h * .12, 9, true) + '" fill="#020206"/>' +
        '<path d="M' + f(w * .2) + ' ' + f(h * .95) + 'l' + f(h * .07) + ' ' + f(-h * .1) + 'l' + f(h * .07) + ' ' + f(h * .1) + 'Z" fill="#020206"/>' + glow(u + 'fo', w * .32, h * .93, h * .08, '#ffb020', .9)
    };
  };

  // Glitch: tela cyber com letreiro distorcido, faixas RGB e linha de varredura
  S.glitch = (k) => {
    const { P, u, w, h, r } = k;
    const bars = (seed, col) => { const rr = C.rng(seed); let b = ''; for (let i = 0; i < 7; i++) b += '<rect x="' + f(rr() * w * .6) + '" y="' + f(rr() * h) + '" width="' + f(w * (.15 + rr() * .5)) + '" height="' + f(2 + rr() * 9) + '" fill="' + col + '" opacity=".7"/>'; return b; };
    const grid = '<g stroke="' + P.b + '" stroke-width=".5" opacity=".18">' + [...Array(Math.ceil(w / 24))].map((_, i) => '<path d="M' + i * 24 + ' 0V' + h + '"/>').join('') + [...Array(Math.ceil(h / 24))].map((_, i) => '<path d="M0 ' + i * 24 + 'H' + w + '"/>').join('') + '</g>';
    const tri = (x, y, sz, col, dx) => '<path d="M' + f(x + dx) + ' ' + f(y - sz) + 'L' + f(x + sz * .9 + dx) + ' ' + f(y + sz * .6) + 'H' + f(x - sz * .9 + dx) + 'Z" fill="none" stroke="' + col + '" stroke-width="' + f(sz * .12) + '"/>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#050508'], [1, P.d]]) + '<pattern id="' + u + 'sl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.2" fill="#000" opacity=".35"/></pattern></defs>' + rect(w, h, 'url(#' + u + 's)') + grid +
        glow(u + 'g', w * .7, h * .5, h * .7, P.a, .35) + tri(w * .7, h * .55, h * .28, '#00e5ff', -3) + tri(w * .7, h * .55, h * .28, '#ff2975', 3) + tri(w * .7, h * .55, h * .28, '#fff', 0),
      layers: [
        { a: 'glitch', d: 3.2, svg: bars('g1' + u, '#00e5ff') },
        { a: 'glitch', d: 4.1, dl: 1.4, svg: bars('g2' + u, '#ff2975') + bars('g3' + u, P.g) },
        { a: 'scan', d: 4, svg: '<rect y="' + f(h * .45) + '" width="' + w + '" height="' + f(h * .1) + '" fill="#fff" opacity=".07"/>' }
      ],
      parts: [{ t: 'faisca', n: 10, c: ['#00e5ff', '#ff2975', P.g], s: [1.5, 3], d: [1.5, 3] }],
      front: rect(w, h, 'url(#' + u + 'sl)') + vignette(u, w, h, .55)
    };
  };

  // Formas flutuantes: sólidos de vidro em três profundidades (paralaxe)
  S.flutuantes = (k) => {
    const { P, u, w, h, r } = k;
    const shape = (rr, sz, col, op) => { const x = rr() * w, y = rr() * h, t = Math.floor(rr() * 3), rot = rr() * 360; const inner = t === 0 ? '<rect x="' + f(-sz / 2) + '" y="' + f(-sz / 2) + '" width="' + f(sz) + '" height="' + f(sz) + '" rx="' + f(sz * .18) + '"/>' : t === 1 ? '<circle r="' + f(sz / 2) + '"/>' : '<path d="M0 ' + f(-sz * .6) + 'L' + f(sz * .55) + ' ' + f(sz * .4) + 'H' + f(-sz * .55) + 'Z"/>';
      return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ')" fill="' + col + '" fill-opacity="' + op + '" stroke="' + P.c + '" stroke-opacity=".7" stroke-width="' + f(Math.max(1, sz * .05)) + '">' + inner + '</g>'; };
    const set = (seed, n, sz, col, op) => { const rr = C.rng(seed + u); let s = ''; for (let i = 0; i < n; i++) s += shape(rr, sz * (.6 + rr() * .8), col, op); return s; };
    return {
      back: '<defs>' + lg(u + 's', [[0, P.d], [.6, P.a], [1, P.b]], 1, 1) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'g', w * .3, h * .2, h * .9, P.c, .3),
      layers: [
        { a: 'float', d: 9, svg: set('f1', 8, h * .09, P.b, .15) },
        { a: 'float', d: 6.5, dl: 2, svg: set('f2', 5, h * .16, P.a, .3) },
        { a: 'bob', d: 5, svg: set('f3', 3, h * .26, P.g, .35) }
      ],
      parts: [{ t: 'bokeh', n: 8, c: P.c, s: [10, 26], d: [4, 8], sw: 12 }],
      front: vignette(u, w, h, .4)
    };
  };

  // Holofotes: arena com fachos de luz, torcida em silhueta e poeira brilhando
  S.luzes = (k) => {
    const { P, u, w, h, r } = k;
    const beam = (x, col, id) => '<defs>' + lg(id, [[0, col, .55], [1, col, 0]]) + '</defs><path d="M' + f(x - 4) + ' ' + f(h) + 'L' + f(x - w * .16) + ' ' + f(-h * .1) + 'H' + f(x + w * .16) + 'L' + f(x + 4) + ' ' + f(h) + 'Z" fill="url(#' + id + ')" transform="rotate(180 ' + f(x) + ' ' + f(h * .45) + ')"/>';
    const crowd = (() => { let s = '<g fill="#030305">'; for (let x = -6; x < w + 6; x += 7 + r() * 5) { const hh = h * (.1 + r() * .08); s += '<circle cx="' + f(x) + '" cy="' + f(h - hh) + '" r="' + f(3.2 + r() * 1.4) + '"/><rect x="' + f(x - 4) + '" y="' + f(h - hh + 2) + '" width="8" height="' + f(hh) + '" rx="3"/>'; if (r() < .12) s += '<path d="M' + f(x + 2) + ' ' + f(h - hh) + 'l' + f(4) + ' ' + f(-h * .08) + '" stroke="#030305" stroke-width="2.4" stroke-linecap="round"/>'; } return s + '</g>'; })();
    return {
      back: '<defs>' + lg(u + 's', [[0, '#020204'], [.7, P.d], [1, '#050507']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'c', w * .5, h * .95, h * .7, P.g, .5) +
        [.12, .5, .88].map((x, i) => glow(u + 'lf' + i, w * x, h * .02, h * .14, '#fff', .9)).join(''),
      layers: [
        { a: 'beam', d: 5, o: '18% 100%', svg: beam(w * .18, P.c, u + 'b1') },
        { a: 'beam', d: 6.5, dl: 2.5, o: '50% 100%', svg: beam(w * .5, P.b, u + 'b2') },
        { a: 'beam', d: 5.8, dl: 1, o: '82% 100%', svg: beam(w * .82, P.c, u + 'b3') }
      ],
      parts: [{ t: 'poeira', n: 20, c: [P.c, '#fff'], s: [1, 2.2], d: [4, 9], sw: 18 }, { t: 'faisca', n: 6, c: '#fff', y1: 20, s: [2, 3], d: [1.5, 3] }],
      front: crowd + vignette(u, w, h, .5)
    };
  };

  // Synthwave: sol listrado, montanhas de arame e o chão de grade correndo
  S.grade = (k) => {
    const { P, u, w, h, r } = k, hz = h * .6;
    const lines = (off) => '<g stroke="' + P.g + '" stroke-width="1.2" opacity=".9">' + [...Array(9)].map((_, i) => { const t = (i + off) / 8; return '<path d="M0 ' + f(hz + (h - hz) * t * t) + 'H' + w + '"/>'; }).join('') + '</g>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#0d0221'], [.55, P.d], [1, P.a]]) + lg(u + 'sun', [[0, '#fff3a0'], [.45, '#ffb14e'], [1, P.a]]) + lg(u + 'fl', [[0, P.d], [1, '#0d0221']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        starfield(r, w, hz * .7, 40, '#fff') + glow(u + 'sg', w / 2, hz, h * .55, P.g, .45) +
        '<g><circle cx="' + f(w / 2) + '" cy="' + f(hz - h * .02) + '" r="' + f(h * .3) + '" fill="url(#' + u + 'sun)"/>' + [0, 1, 2, 3, 4].map((i) => '<rect x="0" y="' + f(hz - h * .14 + i * h * .035) + '" width="' + w + '" height="' + f(1 + i * .9) + '" fill="' + P.d + '"/>').join('') + '</g>' +
        '<path d="' + ridge(r, w, h, hz, h * .2, 7, true) + '" fill="' + P.d + '" stroke="' + P.g + '" stroke-width="1" stroke-opacity=".7"/>' +
        '<rect y="' + f(hz) + '" width="' + w + '" height="' + f(h - hz) + '" fill="url(#' + u + 'fl)"/>' +
        '<g stroke="' + P.g + '" stroke-width="1" opacity=".85">' + [...Array(17)].map((_, i) => '<path d="M' + f(w / 2 + (i - 8) * w * .02) + ' ' + f(hz) + 'L' + f(w / 2 + (i - 8) * w * .16) + ' ' + h + '"/>').join('') + '</g>',
      layers: [{ a: 'gridm', d: 1.4, svg: '<svg x="0" y="0" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" overflow="hidden"><clipPath id="' + u + 'cp"><rect y="' + f(hz) + '" width="' + w + '" height="' + f(h - hz) + '"/></clipPath><g clip-path="url(#' + u + 'cp)">' + lines(0) + '</g></svg>' }],
      parts: [{ t: 'estrela', n: 10, c: ['#fff', P.b], y1: 45, s: [1.5, 3], d: [2, 4] }],
      front: vignette(u, w, h, .4)
    };
  };

  // Aurora: cortinas de luz sobre floresta de pinheiros e lago que reflete
  S.aurora = (k) => {
    const { P, u, w, h, r } = k;
    const curtain = (id, y, amp, c1, c2) => '<defs>' + lg(id, [[0, c1, 0], [.45, c1, .75], [.8, c2, .35], [1, c2, 0]]) + '</defs><path d="M-10 ' + f(y) + 'C' + f(w * .2) + ' ' + f(y - amp) + ' ' + f(w * .45) + ' ' + f(y + amp) + ' ' + f(w * .7) + ' ' + f(y - amp * .4) + 'S' + f(w + 10) + ' ' + f(y + amp * .4) + ' ' + f(w + 10) + ' ' + f(y) + 'V' + f(y + h * .45) + 'H-10Z" fill="url(#' + id + ')"/>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#01030a'], [.7, '#041424'], [1, P.d]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + starfield(r, w, h * .7, Math.round(w * h / 400), '#fff'),
      layers: [
        { a: 'sway', d: 10, svg: curtain(u + 'a1', h * .18, h * .14, P.g, P.b) },
        { a: 'sway2', d: 13, svg: '<g opacity=".8">' + curtain(u + 'a2', h * .3, h * .1, P.c, P.a) + '</g>' },
        { a: 'pulse', d: 4, svg: '<g opacity=".6">' + curtain(u + 'a3', h * .12, h * .18, P.b, P.g) + '</g>' }
      ],
      parts: [{ t: 'estrela', n: 14, c: ['#fff', P.c], y1: 55, s: [1.5, 3], d: [2, 5] }],
      front: '<path d="' + ridge(r, w, h, h * .8, h * .14, 6) + '" fill="#030a12"/>' + pines(r, w, h * .9, Math.round(w / 12), h * .12, h * .3, '#010407') +
        '<rect y="' + f(h * .9) + '" width="' + w + '" height="' + f(h * .1) + '" fill="#01060c"/><rect y="' + f(h * .9) + '" width="' + w + '" height="' + f(h * .1) + '" fill="' + P.g + '" opacity=".12"/>' + vignette(u, w, h, .4)
    };
  };

  // Bokeh: luzes desfocadas de cidade, com reflexo diagonal
  S.particulas = (k) => {
    const { P, u, w, h } = k;
    return {
      back: '<defs>' + lg(u + 's', [[0, P.d], [.5, '#0b0710'], [1, P.d]], 1, 1) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'g1', w * .25, h * .6, h * .7, P.g, .35) + glow(u + 'g2', w * .8, h * .3, h * .6, P.b, .3),
      layers: [{ a: 'sweep', d: 8, svg: '<defs>' + lg(u + 'sw', [[0, '#fff', 0], [.5, '#fff', .12], [1, '#fff', 0]], 1, 0) + '</defs><rect x="' + f(w * .35) + '" y="-10" width="' + f(w * .3) + '" height="' + f(h + 20) + '" fill="url(#' + u + 'sw)"/>' }],
      parts: [{ t: 'bokeh', n: 16, c: [P.g, P.c, P.b, P.a], s: [14, 44], d: [4, 9], sw: 16 }, { t: 'faisca', n: 8, c: '#fff', s: [1.5, 2.5], d: [2, 4] }],
      front: vignette(u, w, h, .45)
    };
  };

  // Fundo do mar: feixes de luz de cima, algas balançando e bolhas subindo
  S.bolhas = (k) => {
    const { P, u, w, h, r } = k;
    const weed = (seed, n, col) => { const rr = C.rng(seed + u); let s = ''; for (let i = 0; i < n; i++) { const x = rr() * w, hh = h * (.25 + rr() * .45), b = (rr() - .5) * 30; s += '<path d="M' + f(x) + ' ' + f(h + 4) + 'C' + f(x + b) + ' ' + f(h - hh * .4) + ' ' + f(x - b) + ' ' + f(h - hh * .7) + ' ' + f(x + b * .5) + ' ' + f(h - hh) + '" fill="none" stroke="' + col + '" stroke-width="' + f(3 + rr() * 4) + '" stroke-linecap="round"/>'; } return s; };
    const rays = '<defs>' + lg(u + 'ry', [[0, P.c, .4], [1, P.c, 0]]) + '</defs><g fill="url(#' + u + 'ry)">' + [.15, .38, .6, .82].map((x) => '<path d="M' + f(w * x - 8) + ' -4H' + f(w * x + 14) + 'L' + f(w * x + 50) + ' ' + f(h) + 'H' + f(w * x + 10) + 'Z"/>').join('') + '</g>';
    return {
      back: '<defs>' + lg(u + 's', [[0, P.b], [.45, P.a], [1, P.d]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'g', w * .5, 0, h * .8, P.c, .45),
      layers: [
        { a: 'pulse', d: 5, svg: rays },
        { a: 'sway', d: 6, svg: weed('w1', 8, P.d) },
        { a: 'sway2', d: 4.5, svg: weed('w2', 6, '#02140f') }
      ],
      parts: [{ t: 'bolha', n: 16, c: P.c, s: [4, 12], d: [5, 9], sw: 16 }, { t: 'poeira', n: 10, c: P.c, s: [1, 2], d: [5, 9] }],
      front: '<path d="' + ridge(r, w, h, h, h * .08, 7) + '" fill="#020a10"/>' + vignette(u, w, h, .45)
    };
  };

  // Circuito: placa com trilhas e chips, com pacotes de dados correndo
  S.circuito = (k) => {
    const { P, u, w, h, r } = k;
    let tr = '', pads = '';
    for (let i = 0; i < 14; i++) {
      let x = r() * w, y = r() * h, d = 'M' + f(x) + ' ' + f(y);
      pads += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="2.4" fill="none" stroke="' + P.g + '" stroke-width="1.2"/>';
      for (let s = 0; s < 3; s++) { if (s % 2) { const nx = x + (r() - .5) * w * .4; x = nx; } else { const ny = y + (r() - .5) * h * .5; y = ny; } d += 'L' + f(x) + ' ' + f(y); }
      tr += '<path d="' + d + '"/>'; pads += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="2" fill="' + P.g + '"/>';
    }
    const chip = (x, y, sz) => '<rect x="' + f(x - sz / 2) + '" y="' + f(y - sz / 2) + '" width="' + f(sz) + '" height="' + f(sz) + '" rx="3" fill="#03110c" stroke="' + P.g + '" stroke-width="1.2"/>' + [...Array(5)].map((_, i) => '<path d="M' + f(x - sz / 2 + sz * (i + .5) / 5) + ' ' + f(y - sz / 2) + 'v-5M' + f(x - sz / 2 + sz * (i + .5) / 5) + ' ' + f(y + sz / 2) + 'v5" stroke="' + P.g + '" stroke-width="1.2"/>').join('');
    return {
      back: '<defs>' + lg(u + 's', [[0, '#020806'], [1, P.d]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + '<g fill="none" stroke="' + P.a + '" stroke-width="1.2" opacity=".55">' + tr + '</g>' + pads +
        chip(w * .72, h * .45, h * .3) + chip(w * .25, h * .62, h * .18) + glow(u + 'g', w * .72, h * .45, h * .5, P.g, .35),
      layers: [{ a: 'pulse', d: 2.4, svg: '<g fill="' + P.c + '">' + [...Array(10)].map(() => '<circle cx="' + f(r() * w) + '" cy="' + f(r() * h) + '" r="1.6"/>').join('') + '</g>' }],
      parts: [{ t: 'pacote', n: 9, c: [P.g, P.c], s: [2, 3], d: [2.5, 5] }],
      front: vignette(u, w, h, .5)
    };
  };

  // Cerejeira: pôr do sol rosa, torii, galhos floridos e pétalas caindo
  S.petalas = (k) => {
    const { P, u, w, h, r } = k;
    const branch = 'M' + f(w + 10) + ' ' + f(h * .02) + 'C' + f(w * .8) + ' ' + f(h * .12) + ' ' + f(w * .7) + ' ' + f(h * .06) + ' ' + f(w * .55) + ' ' + f(h * .2) + 'M' + f(w * .78) + ' ' + f(h * .09) + 'C' + f(w * .74) + ' ' + f(h * .22) + ' ' + f(w * .68) + ' ' + f(h * .3) + ' ' + f(w * .62) + ' ' + f(h * .34);
    let blossom = '';
    for (let i = 0; i < 26; i++) blossom += '<circle cx="' + f(w * (.55 + r() * .45)) + '" cy="' + f(h * r() * .36) + '" r="' + f(4 + r() * 8) + '" fill="' + (i % 3 ? P.a : P.c) + '" opacity="' + f(.7 + r() * .3) + '"/>';
    const tx = w * .25, tb = h * .88, tw = h * .5, th = h * .5;
    const torii = '<g fill="#1a0610"><path d="M' + f(tx - tw * .7) + ' ' + f(tb - th) + 'Q' + f(tx) + ' ' + f(tb - th - h * .06) + ' ' + f(tx + tw * .7) + ' ' + f(tb - th) + 'l-4 ' + f(h * .045) + 'Q' + f(tx) + ' ' + f(tb - th - h * .02) + ' ' + f(tx - tw * .7 + 4) + ' ' + f(tb - th + h * .045) + 'Z"/>' +
      '<rect x="' + f(tx - tw * .55) + '" y="' + f(tb - th * .78) + '" width="' + f(tw * 1.1) + '" height="' + f(h * .03) + '"/><rect x="' + f(tx - tw * .42) + '" y="' + f(tb - th * .95) + '" width="' + f(h * .035) + '" height="' + f(th * .95) + '"/><rect x="' + f(tx + tw * .42 - h * .035) + '" y="' + f(tb - th * .95) + '" width="' + f(h * .035) + '" height="' + f(th * .95) + '"/></g>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#1c0716'], [.5, P.a], [1, P.b]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'sun', w * .3, h * .55, h * .7, P.c, .55) +
        '<circle cx="' + f(w * .3) + '" cy="' + f(h * .52) + '" r="' + f(h * .16) + '" fill="' + P.c + '" opacity=".85"/>' +
        '<path d="' + ridge(r, w, h, h * .78, h * .16, 4) + '" fill="' + P.d + '" opacity=".55"/>' + torii + '<path d="' + ridge(r, w, h, h * .92, h * .06, 8) + '" fill="#12040c"/>',
      layers: [{ a: 'sway', d: 7, o: '100% 0%', svg: '<path d="' + branch + '" fill="none" stroke="#1a0610" stroke-width="' + f(h * .03) + '" stroke-linecap="round"/>' + blossom }],
      parts: [{ t: 'petala', n: 20, c: [P.c, P.a, '#fff'], s: [4, 7], d: [6, 11], sw: 18 }],
      front: vignette(u, w, h, .35)
    };
  };

  // Montanha nevada: cordilheira em camadas com neve nos picos, pinheiros, névoa e neve caindo
  S.neve = (k) => {
    const { P, u, w, h, r } = k;
    const peaks = (y, amp, n, fill, cap) => { const rr = C.rng('pk' + y + u); let d = 'M-10 ' + f(h) + 'L-10 ' + f(y), caps = '', x = -10; const step = (w + 20) / n; for (let i = 0; i < n; i++) { const px = x + step * (.4 + rr() * .2), py = y - amp * (.5 + rr() * .5), nx = x + step, ny = y - amp * rr() * .2; d += 'L' + f(px) + ' ' + f(py) + 'L' + f(nx) + ' ' + f(ny); if (cap) caps += '<path d="M' + f(px) + ' ' + f(py) + 'L' + f(px + step * .14) + ' ' + f(py + amp * .22) + 'L' + f(px + step * .05) + ' ' + f(py + amp * .18) + 'L' + f(px - step * .03) + ' ' + f(py + amp * .26) + 'L' + f(px - step * .12) + ' ' + f(py + amp * .2) + 'Z" fill="#fff" opacity=".92"/>'; x = nx; } return '<path d="' + d + 'L' + f(w + 10) + ' ' + f(h) + 'Z" fill="' + fill + '"/>' + caps; };
    return {
      back: '<defs>' + lg(u + 's', [[0, P.d], [.6, P.a], [1, P.c]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'm', w * .8, h * .2, h * .3, '#fff', .7) +
        '<circle cx="' + f(w * .8) + '" cy="' + f(h * .2) + '" r="' + f(h * .07) + '" fill="#fff"/>' + peaks(h * .62, h * .42, 4, P.b, true) + peaks(h * .8, h * .3, 6, P.a, true),
      layers: [{ a: 'drift', d: 22, svg: '<defs>' + lg(u + 'fg', [[0, '#fff', 0], [.5, '#fff', .35], [1, '#fff', 0]]) + '</defs><rect y="' + f(h * .6) + '" width="' + w + '" height="' + f(h * .25) + '" fill="url(#' + u + 'fg)"/>' }],
      parts: [{ t: 'neve', n: 36, c: '#fff', s: [1.5, 4], d: [6, 12], sw: 30 }],
      front: pines(r, w, h + 2, Math.round(w / 14), h * .14, h * .32, P.d) + vignette(u, w, h, .35)
    };
  };

  // Cidade na chuva: prédios em três profundidades, letreiros e chuva
  S.chuva = (k) => {
    const { P, u, w, h, r } = k;
    return {
      back: '<defs>' + lg(u + 's', [[0, '#04060c'], [.7, P.d], [1, P.a]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'g', w * .5, h, h * .8, P.g, .35) +
        skyline(C.rng('c1' + u), w, h, h * .82, h * .25, h * .55, P.a, 0) + skyline(C.rng('c2' + u), w, h, h * .9, h * .2, h * .6, '#070a12', .2, [P.c, P.g, '#ffd166']),
      layers: [{ a: 'pulse', d: 1.8, svg: '<rect x="' + f(w * .62) + '" y="' + f(h * .38) + '" width="' + f(h * .05) + '" height="' + f(h * .24) + '" rx="2" fill="' + P.g + '"/>' + glow(u + 'ns', w * .62 + h * .025, h * .5, h * .2, P.g, .6) }],
      parts: [{ t: 'chuva', n: 40, c: P.c, s: [3, 5], d: [.45, .8] }],
      front: skyline(C.rng('c3' + u), w, h, h + 2, h * .1, h * .3, '#020306', .1, [P.g, P.c]) + '<rect y="' + f(h * .96) + '" width="' + w + '" height="' + f(h * .04) + '" fill="' + P.g + '" opacity=".25"/>' + vignette(u, w, h, .45)
    };
  };

  // Nebulosa: nuvens de gás girando devagar, estrelas e um planeta com anel
  S.nebulosa = (k) => {
    const { P, u, w, h, r } = k;
    const gas = (id, cx, cy, rx, ry, col, op) => '<defs>' + rg(id, [[0, col, op], [.5, col, op * .4], [1, col, 0]]) + '</defs><ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="url(#' + id + ')"/>';
    const pr = h * .16, px = w * .2, py = h * .7;
    return {
      back: rect(w, h, '#03010a') + starfield(r, w, h, Math.round(w * h / 300), '#fff'),
      layers: [
        { a: 'spin', d: 120, o: '65% 45%', svg: gas(u + 'n1', w * .65, h * .45, w * .38, h * .42, P.g, .7) + gas(u + 'n2', w * .8, h * .6, w * .25, h * .35, P.b, .6) },
        { a: 'breath', d: 8, o: '40% 40%', svg: gas(u + 'n3', w * .4, h * .35, w * .22, h * .3, P.c, .45) + gas(u + 'n4', w * .55, h * .5, w * .1, h * .14, '#fff', .45) }
      ],
      parts: [{ t: 'estrela', n: 18, c: ['#fff', P.c], s: [1.5, 3.2], d: [2, 5] }],
      front: '<defs>' + lg(u + 'pp', [[0, P.c], [.5, P.a], [1, P.d]], 1, 1) + '</defs><circle cx="' + f(px) + '" cy="' + f(py) + '" r="' + f(pr) + '" fill="url(#' + u + 'pp)"/>' +
        '<ellipse cx="' + f(px) + '" cy="' + f(py) + '" rx="' + f(pr * 1.9) + '" ry="' + f(pr * .45) + '" fill="none" stroke="' + P.c + '" stroke-width="' + f(pr * .12) + '" opacity=".8" transform="rotate(-18 ' + f(px) + ' ' + f(py) + ')"/>' + vignette(u, w, h, .4)
    };
  };

  // Vórtice: espiral de energia girando em volta de um núcleo escuro
  S.vortice = (k) => {
    const { P, u, w, h } = k, cx = w * .7, cy = h * .5, R = Math.min(w, h) * .6;
    const arms = (n, col, sw, op) => '<g fill="none" stroke="' + col + '" stroke-width="' + sw + '" opacity="' + op + '" stroke-linecap="round">' + [...Array(n)].map((_, i) => { const a = i * 360 / n; return '<path transform="rotate(' + f(a) + ' ' + f(cx) + ' ' + f(cy) + ')" d="M' + f(cx) + ' ' + f(cy) + 'C' + f(cx + R * .3) + ' ' + f(cy - R * .35) + ' ' + f(cx + R * .75) + ' ' + f(cy - R * .1) + ' ' + f(cx + R) + ' ' + f(cy + R * .45) + '"/>'; }).join('') + '</g>';
    const o = f(cx / w * 100) + '% ' + f(cy / h * 100) + '%';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#030208'], [1, P.d]], 1, 1) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'g', cx, cy, R, P.a, .7),
      layers: [
        { a: 'spin', d: 30, o, svg: arms(7, P.g, 3, .5) },
        { a: 'spinr', d: 18, o, svg: arms(5, P.c, 1.4, .6) },
        { a: 'breath', d: 2.4, o, svg: glow(u + 'c', cx, cy, R * .3, P.c, .9) + '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R * .09) + '" fill="#000"/>' }
      ],
      parts: [{ t: 'faisca', n: 14, c: [P.c, P.g], s: [1.5, 3], d: [1.5, 3.5] }],
      front: vignette(u, w, h, .5)
    };
  };

  // Caverna de cristal: estalactites e cristais que brilham, com faíscas no ar
  S.cristais = (k) => {
    const { P, u, w, h, r } = k;
    const crystal = (x, base, ch, cw, id) => '<path d="M' + f(x - cw) + ' ' + f(base) + 'L' + f(x - cw * .5) + ' ' + f(base - ch * .85) + 'L' + f(x) + ' ' + f(base - ch) + 'L' + f(x + cw * .55) + ' ' + f(base - ch * .8) + 'L' + f(x + cw) + ' ' + f(base) + 'Z" fill="url(#' + id + ')"/><path d="M' + f(x) + ' ' + f(base - ch) + 'L' + f(x - cw * .1) + ' ' + f(base) + '" stroke="#fff" stroke-width="1" opacity=".5"/>';
    let big = '', small = '';
    for (let i = 0; i < Math.round(w / 40); i++) { const x = (i + r() * .6) * 40; big += crystal(x, h + 2, h * (.25 + r() * .45), 9 + r() * 12, u + 'cr'); }
    for (let i = 0; i < Math.round(w / 55); i++) { const x = (i + r()) * 55; small += '<path d="M' + f(x - 8) + ' -2L' + f(x) + ' ' + f(h * (.12 + r() * .2)) + 'L' + f(x + 8) + ' -2Z" fill="url(#' + u + 'cr)" opacity=".6"/>'; }
    return {
      back: '<defs>' + lg(u + 's', [[0, '#040209'], [1, P.d]]) + lg(u + 'cr', [[0, P.c], [.5, P.b], [1, P.a]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + small,
      layers: [{ a: 'pulse', d: 3, svg: glow(u + 'g1', w * .3, h * .85, h * .5, P.g, .55) + glow(u + 'g2', w * .75, h * .8, h * .45, P.b, .5) }],
      parts: [{ t: 'faisca', n: 14, c: [P.c, '#fff'], s: [1.5, 3], d: [1.8, 4] }, { t: 'poeira', n: 8, c: P.c, s: [1, 2], d: [5, 9] }],
      front: big + vignette(u, w, h, .5)
    };
  };

  // Cidade neon: skyline com bordas neon, lua grande e carros voadores
  S.cidade = (k) => {
    const { P, u, w, h, r } = k;
    let neon = '';
    const rr = C.rng('cn' + u);
    for (let x = 0; x < w; x += 22 + rr() * 30) { const bh = h * (.3 + rr() * .45), bw = 14 + rr() * 18; neon += '<rect x="' + f(x) + '" y="' + f(h - bh) + '" width="' + f(bw) + '" height="' + f(bh) + '" fill="#07031a" stroke="' + (rr() > .5 ? P.g : P.b) + '" stroke-width="1" stroke-opacity=".8"/>'; }
    return {
      back: '<defs>' + lg(u + 's', [[0, '#050212'], [.6, P.d], [1, P.a]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'm', w * .76, h * .3, h * .5, P.b, .5) +
        '<circle cx="' + f(w * .76) + '" cy="' + f(h * .3) + '" r="' + f(h * .17) + '" fill="' + P.b + '" opacity=".75"/>' + [0, 1, 2].map((i) => '<rect x="' + f(w * .76 - h * .17) + '" y="' + f(h * (.3 + i * .045)) + '" width="' + f(h * .34) + '" height="' + f(1.4 + i) + '" fill="' + P.d + '"/>').join('') +
        skyline(C.rng('cd' + u), w, h, h * .9, h * .2, h * .5, '#0a0520', .12, [P.g, P.b]),
      layers: [{ a: 'pulse', d: 2, svg: neon }],
      parts: [{ t: 'carro', n: 6, c: [P.g, P.c], y0: 15, y1: 55, s: [2, 3], d: [3, 6] }],
      front: '<rect y="' + f(h * .96) + '" width="' + w + '" height="' + f(h * .04) + '" fill="' + P.g + '" opacity=".35"/>' + vignette(u, w, h, .4)
    };
  };

  // Colmeia hex: grade hexagonal escura com células acendendo
  S.hexagonos = (k) => {
    const { P, u, w, h, r } = k;
    const R = Math.max(12, h / 9), dx = R * 1.732;
    let grid = '', lit1 = '', lit2 = '';
    for (let y = 0, row = 0; y < h + R; y += R * 1.5, row++) for (let x = (row % 2) * dx / 2; x < w + dx; x += dx) {
      const d = 'M' + [0, 60, 120, 180, 240, 300].map((a) => f(x + R * .92 * Math.sin(a * Math.PI / 180)) + ' ' + f(y - R * .92 * Math.cos(a * Math.PI / 180))).join('L') + 'Z';
      grid += '<path d="' + d + '"/>';
      const q = r();
      if (q < .1) lit1 += '<path d="' + d + '"/>'; else if (q < .18) lit2 += '<path d="' + d + '"/>';
    }
    return {
      back: '<defs>' + lg(u + 's', [[0, '#020402'], [1, P.d]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + '<g fill="#050805" stroke="' + P.a + '" stroke-width="1" stroke-opacity=".55">' + grid + '</g>' + glow(u + 'g', w * .7, h * .5, h * .8, P.g, .3),
      layers: [
        { a: 'pulse', d: 2.6, svg: '<g fill="' + P.g + '" fill-opacity=".35" stroke="' + P.c + '" stroke-width="1.4">' + lit1 + '</g>' },
        { a: 'pulse', d: 3.4, dl: 1.7, svg: '<g fill="' + P.b + '" fill-opacity=".3" stroke="' + P.g + '" stroke-width="1.2">' + lit2 + '</g>' },
        { a: 'scan', d: 5, svg: '<defs>' + lg(u + 'sc', [[0, P.g, 0], [.5, P.g, .25], [1, P.g, 0]]) + '</defs><rect y="' + f(h * .4) + '" width="' + w + '" height="' + f(h * .2) + '" fill="url(#' + u + 'sc)"/>' }
      ],
      parts: [],
      front: vignette(u, w, h, .55)
    };
  };

  // Ouro: preto de luxo com linhas douradas em diagonal, reflexo passando e pó de ouro
  S.ouro = (k) => {
    const { P, u, w, h, r } = k;
    let lines = '';
    for (let i = -4; i < 14; i++) { const x = i * w / 9 + r() * 10; lines += '<path d="M' + f(x) + ' ' + f(h + 10) + 'L' + f(x + h * .9) + ' -10" stroke="url(#' + u + 'gl)" stroke-width="' + f(r() < .25 ? 2.2 : .8) + '" opacity="' + f(.25 + r() * .5) + '"/>'; }
    return {
      back: '<defs>' + lg(u + 's', [[0, '#050505'], [.5, '#0d0b08'], [1, '#050505']], 1, 1) + lg(u + 'gl', [[0, P.b, 0], [.5, P.c], [1, P.b, 0]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        glow(u + 'g1', w * .78, h * .3, h * .9, P.a, .35) + glow(u + 'g2', w * .1, h, h * .6, P.b, .2) + lines +
        '<path d="M' + f(w * .56) + ' ' + f(h + 2) + 'L' + f(w * .56 + h * 1.1) + ' -2" stroke="' + P.b + '" stroke-width="3"/><path d="M' + f(w * .6) + ' ' + f(h + 2) + 'L' + f(w * .6 + h * 1.1) + ' -2" stroke="' + P.c + '" stroke-width="1"/>',
      layers: [{ a: 'sweep', d: 6, svg: '<defs>' + lg(u + 'sw', [[0, '#fff', 0], [.5, P.c, .28], [1, '#fff', 0]], 1, 0) + '</defs><rect x="' + f(w * .38) + '" y="-10" width="' + f(w * .24) + '" height="' + f(h + 20) + '" fill="url(#' + u + 'sw)"/>' }],
      parts: [{ t: 'faisca', n: 12, c: [P.c, P.b], s: [1.5, 3], d: [2, 4] }, { t: 'bokeh', n: 7, c: P.b, s: [8, 22], d: [5, 9], sw: 10 }],
      front: vignette(u, w, h, .45)
    };
  };

  // Prisma: cacos de vidro em ângulos, fachos de luz e brilhos (competitivo)
  S.prisma = (k) => {
    const { P, u, w, h, r } = k;
    const shard = (col, op) => { const x = r() * w, y = r() * h, sz = h * (.25 + r() * .5); return '<path d="M' + f(x) + ' ' + f(y - sz * .6) + 'L' + f(x + sz * (.3 + r() * .4)) + ' ' + f(y + sz * (.1 + r() * .4)) + 'L' + f(x - sz * (.3 + r() * .4)) + ' ' + f(y + sz * .5) + 'Z" fill="' + col + '" fill-opacity="' + op + '" stroke="' + P.c + '" stroke-opacity=".4" stroke-width="1"/>'; };
    let a = '', b = '';
    for (let i = 0; i < 9; i++) a += shard(i % 2 ? P.a : P.b, .25);
    for (let i = 0; i < 5; i++) b += shard(P.g, .35);
    return {
      back: '<defs>' + lg(u + 's', [[0, P.d], [.55, P.a], [1, P.d]], 1, 1) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'g', w * .7, h * .4, h, P.g, .45) + a,
      layers: [
        { a: 'float', d: 7, svg: b },
        { a: 'sweep', d: 5.5, svg: '<defs>' + lg(u + 'sw', [[0, '#fff', 0], [.5, '#fff', .2], [1, '#fff', 0]], 1, 0) + '</defs><rect x="' + f(w * .4) + '" y="-10" width="' + f(w * .2) + '" height="' + f(h + 20) + '" fill="url(#' + u + 'sw)"/>' }
      ],
      parts: [{ t: 'faisca', n: 12, c: ['#fff', P.c], s: [1.5, 3], d: [1.8, 3.6] }],
      front: vignette(u, w, h, .4)
    };
  };

  // Fibra de carbono: trama escura com brilho metálico passando e um filete de cor
  S.carbono = (k) => {
    const { P, u, w, h } = k;
    return {
      back: '<defs><pattern id="' + u + 'cb" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#101012"/><rect width="6" height="6" fill="#1b1b20"/><rect x="6" y="6" width="6" height="6" fill="#1b1b20"/>' +
        '<rect width="6" height="1" fill="#26262c"/><rect x="6" y="6" width="6" height="1" fill="#26262c"/></pattern>' + lg(u + 'sh', [[0, '#000', .6], [.5, '#000', 0], [1, '#000', .7]]) + '</defs>' + rect(w, h, 'url(#' + u + 'cb)') + rect(w, h, 'url(#' + u + 'sh)') +
        '<rect y="' + f(h * .78) + '" width="' + w + '" height="2" fill="' + P.g + '" opacity=".9"/><rect y="' + f(h * .78 + 5) + '" width="' + w + '" height="1" fill="' + P.g + '" opacity=".4"/>',
      layers: [{ a: 'sweep', d: 7, svg: '<defs>' + lg(u + 'sw', [[0, '#fff', 0], [.5, '#fff', .12], [1, '#fff', 0]], 1, 0) + '</defs><rect x="' + f(w * .35) + '" y="-10" width="' + f(w * .3) + '" height="' + f(h + 20) + '" fill="url(#' + u + 'sw)"/>' }],
      parts: [],
      front: vignette(u, w, h, .5)
    };
  };

  // Vulcão: vulcão em erupção, rio de lava brilhando, cinzas e brasas
  S.vulcao = (k) => {
    const { P, u, w, h, r } = k;
    const vx = w * .62, top = h * .3;
    const cone = 'M' + f(vx - w * .5) + ' ' + f(h + 2) + 'L' + f(vx - w * .06) + ' ' + f(top) + 'H' + f(vx + w * .06) + 'L' + f(vx + w * .5) + ' ' + f(h + 2) + 'Z';
    const lava = 'M' + f(vx - 4) + ' ' + f(top) + 'C' + f(vx - 10) + ' ' + f(h * .5) + ' ' + f(vx + 12) + ' ' + f(h * .62) + ' ' + f(vx - 6) + ' ' + f(h * .8) + 'S' + f(vx - 30) + ' ' + f(h * .95) + ' ' + f(vx - 40) + ' ' + f(h + 4);
    return {
      back: '<defs>' + lg(u + 's', [[0, '#0a0202'], [.6, P.d], [1, '#1a0503']]) + lg(u + 'cn', [[0, '#2a0b06'], [1, '#050101']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        '<path d="' + ridge(r, w, h, h * .75, h * .2, 5) + '" fill="#140504"/><path d="' + cone + '" fill="url(#' + u + 'cn)"/>' +
        '<path d="' + lava + '" fill="none" stroke="' + P.a + '" stroke-width="' + f(h * .05) + '" stroke-linecap="round"/><path d="' + lava + '" fill="none" stroke="' + P.b + '" stroke-width="' + f(h * .02) + '" stroke-linecap="round"/>',
      layers: [
        { a: 'breath', d: 2.2, o: f(vx / w * 100) + '% 30%', svg: glow(u + 'er', vx, top, h * .55, P.g, .9) + glow(u + 'er2', vx, top - h * .05, h * .2, '#fff3b0', .9) },
        { a: 'drift', d: 16, svg: cloud(vx - w * .1, top - h * .12, h * .12, '#2a1512', .85) + cloud(vx + w * .12, top - h * .2, h * .1, '#1e0e0c', .9) + cloud(vx - w * .25, top - h * .22, h * .09, '#1e0e0c', .8) }
      ],
      parts: [{ t: 'brasa', n: 18, c: [P.g, P.b, '#fff3b0'], x0: 40, x1: 85, s: [1.5, 3.5], d: [2.5, 5], sw: 50 }, { t: 'cinza', n: 14, c: '#6b5b55', s: [1.5, 3], d: [7, 12], sw: 30 }],
      front: vignette(u, w, h, .45)
    };
  };

  // Kitsune: floresta à noite, raposa de nove caudas em silhueta e fogos-fátuos azuis
  S.kitsune = (k) => {
    const { P, u, w, h, r } = k;
    const fx = w * .7, fy = h * .94, s = h / 180;
    // nove caudas em leque, cada uma com a ponta clara
    const tails = [-70, -52, -35, -18, 0, 18, 35, 52, 70].map((a, i) => '<g transform="rotate(' + a + ' ' + f(fx - 14 * s) + ' ' + f(fy - 16 * s) + ')"><path d="M' + f(fx - 14 * s) + ' ' + f(fy - 16 * s) + 'C' + f(fx - 30 * s) + ' ' + f(fy - 50 * s) + ' ' + f(fx - 20 * s) + ' ' + f(fy - 90 * s) + ' ' + f(fx + 4 * s) + ' ' + f(fy - 104 * s) + 'C' + f(fx - 4 * s) + ' ' + f(fy - 80 * s) + ' ' + f(fx + 6 * s) + ' ' + f(fy - 50 * s) + ' ' + f(fx - 8 * s) + ' ' + f(fy - 16 * s) + 'Z" fill="#01040c" stroke="' + P.b + '" stroke-opacity=".35" stroke-width="1"/>' +
      '<path d="M' + f(fx + 4 * s) + ' ' + f(fy - 104 * s) + 'C' + f(fx - 8 * s) + ' ' + f(fy - 98 * s) + ' ' + f(fx - 12 * s) + ' ' + f(fy - 88 * s) + ' ' + f(fx - 10 * s) + ' ' + f(fy - 82 * s) + 'C' + f(fx - 4 * s) + ' ' + f(fy - 86 * s) + ' ' + f(fx) + ' ' + f(fy - 94 * s) + ' ' + f(fx + 4 * s) + ' ' + f(fy - 104 * s) + 'Z" fill="' + P.c + '" opacity="' + (.5 + i * .04) + '"/></g>').join('');
    // corpo sentado, olhando para a direita, orelhas pontudas
    const fox = '<path d="M' + f(fx - 26 * s) + ' ' + f(fy) + 'C' + f(fx - 28 * s) + ' ' + f(fy - 22 * s) + ' ' + f(fx - 20 * s) + ' ' + f(fy - 40 * s) + ' ' + f(fx - 6 * s) + ' ' + f(fy - 50 * s) + 'C' + f(fx - 4 * s) + ' ' + f(fy - 60 * s) + ' ' + f(fx) + ' ' + f(fy - 66 * s) + ' ' + f(fx + 4 * s) + ' ' + f(fy - 70 * s) +
      'L' + f(fx + 2 * s) + ' ' + f(fy - 88 * s) + 'L' + f(fx + 12 * s) + ' ' + f(fy - 76 * s) + 'L' + f(fx + 20 * s) + ' ' + f(fy - 88 * s) + 'L' + f(fx + 21 * s) + ' ' + f(fy - 72 * s) + 'C' + f(fx + 26 * s) + ' ' + f(fy - 68 * s) + ' ' + f(fx + 34 * s) + ' ' + f(fy - 64 * s) + ' ' + f(fx + 42 * s) + ' ' + f(fy - 62 * s) +
      'C' + f(fx + 38 * s) + ' ' + f(fy - 56 * s) + ' ' + f(fx + 30 * s) + ' ' + f(fy - 54 * s) + ' ' + f(fx + 22 * s) + ' ' + f(fy - 54 * s) + 'C' + f(fx + 18 * s) + ' ' + f(fy - 40 * s) + ' ' + f(fx + 20 * s) + ' ' + f(fy - 20 * s) + ' ' + f(fx + 16 * s) + ' ' + f(fy) + 'Z"/>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#01030b'], [.6, P.d], [1, '#030814']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + starfield(r, w, h * .6, 60, '#cfe8ff') +
        glow(u + 'm', w * .2, h * .25, h * .35, P.c, .6) + '<circle cx="' + f(w * .2) + '" cy="' + f(h * .25) + '" r="' + f(h * .1) + '" fill="#eaf4ff"/>' + pines(r, w, h * .96, Math.round(w / 18), h * .25, h * .5, '#030a18'),
      layers: [{ a: 'sway', d: 6, o: f(fx / w * 100) + '% 90%', svg: tails }, { a: 'static', svg: '<g fill="#01040c">' + fox + '</g>' + '<path d="M' + f(fx + 20 * s) + ' ' + f(fy - 70 * s) + 'l' + f(5 * s) + ' ' + f(1.5 * s) + '" stroke="' + P.g + '" stroke-width="' + f(1.6 * s) + '" stroke-linecap="round"/>' }],
      parts: [{ t: 'fogo-fatuo', n: 10, c: [P.g, P.c], x0: 5, x1: 95, y0: 20, y1: 85, s: [8, 14], d: [4, 8], sw: 24 }, { t: 'vagalume', n: 8, c: P.c, s: [2, 3], d: [4, 8], sw: 20 }],
      front: '<rect y="' + f(h * .96) + '" width="' + w + '" height="' + f(h * .04) + '" fill="#01040c"/>' + vignette(u, w, h, .4)
    };
  };

  // Samurai: lua carmesim enorme, samurai com katana num penhasco e grama ao vento
  S.samurai = (k) => {
    const { P, u, w, h, r } = k;
    const s = h / 180, sx = w * .64, sy = h * .74;
    const sam = '<g transform="translate(' + f(sx) + ' ' + f(sy) + ') scale(' + f(s) + ')" fill="#050102">' +
      '<path d="M-10 0L-6 -38L-16 -52L-8 -74C-4 -82 6 -84 12 -78C18 -72 16 -62 12 -56L20 -40L14 0Z"/>' +
      '<path d="M-6 -80C0 -92 10 -92 14 -84L18 -88L16 -78Z"/><path d="M-16 -86Q2 -100 20 -86L16 -82Q2 -92 -12 -82Z"/>' +
      '<path d="M16 -60L86 -120L89 -117L20 -56Z"/><path d="M-12 -48L-40 -30L-38 -27L-10 -42Z"/>' +
      '<path d="M-20 -50C-34 -44 -44 -30 -52 -20C-40 -26 -30 -30 -18 -36Z" opacity=".9"/></g>';
    let grass = '';
    for (let x = 0; x < w; x += 5) { const gh = h * (.04 + r() * .06); grass += '<path d="M' + f(x) + ' ' + f(h + 1) + 'q' + f(2 + r() * 4) + ' ' + f(-gh * .6) + ' ' + f(r() * 8 - 2) + ' ' + f(-gh) + '"/>'; }
    return {
      back: '<defs>' + lg(u + 's', [[0, '#0d0204'], [.6, '#2b0508'], [1, '#12030a']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        glow(u + 'mg', w * .6, h * .45, h * .7, P.a, .6) + '<circle cx="' + f(w * .6) + '" cy="' + f(h * .45) + '" r="' + f(h * .34) + '" fill="' + P.a + '"/>' +
        '<circle cx="' + f(w * .56) + '" cy="' + f(h * .4) + '" r="' + f(h * .06) + '" fill="#000" opacity=".12"/><circle cx="' + f(w * .67) + '" cy="' + f(h * .55) + '" r="' + f(h * .04) + '" fill="#000" opacity=".1"/>' +
        '<path d="M' + f(w * .3) + ' ' + f(h + 2) + 'L' + f(w * .52) + ' ' + f(h * .76) + 'H' + f(w * .82) + 'L' + f(w + 10) + ' ' + f(h * .9) + 'V' + f(h + 2) + 'Z" fill="#050102"/>' + sam,
      layers: [{ a: 'sway', d: 3.2, o: '50% 100%', svg: '<g fill="none" stroke="#050102" stroke-width="1.4" stroke-linecap="round">' + grass + '</g>' }],
      parts: [{ t: 'petala', n: 12, c: [P.b, P.a, '#fff'], s: [3, 6], d: [5, 9], sw: 30 }],
      front: vignette(u, w, h, .5)
    };
  };

  // Amanhecer: sol nascendo atrás de montanhas em camadas, nuvens e pássaros
  S.amanhecer = (k) => {
    const { P, u, w, h, r } = k;
    return {
      back: '<defs>' + lg(u + 's', [[0, '#2d1b3d'], [.45, P.a], [.8, '#ff9a76'], [1, '#ffd3a1']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)'),
      layers: [
        { a: 'breath', d: 5, o: '50% 72%', svg: glow(u + 'sg', w * .5, h * .72, h * .8, '#ffe0a3', .75) + '<circle cx="' + f(w * .5) + '" cy="' + f(h * .72) + '" r="' + f(h * .16) + '" fill="#fff4d6"/>' },
        { a: 'drift', d: 30, svg: cloud(w * .18, h * .28, h * .08, '#ffd0b5', .55) + cloud(w * .78, h * .2, h * .1, '#ffc0a0', .5) + cloud(w * .5, h * .12, h * .06, '#fff', .35) }
      ],
      parts: [{ t: 'passaro', n: 5, c: '#2d1b3d', y0: 20, y1: 45, s: [4, 7], d: [9, 16], sw: 20 }],
      front: '<path d="' + ridge(r, w, h, h * .78, h * .22, 5) + '" fill="' + P.b + '" opacity=".75"/><path d="' + ridge(r, w, h, h * .88, h * .2, 6) + '" fill="' + P.a + '" opacity=".85"/>' +
        '<path d="' + ridge(r, w, h, h * .98, h * .16, 8) + '" fill="#2d1b3d"/>' + vignette(u, w, h, .25)
    };
  };

  // Lobo: lua cheia, lobo uivando numa rocha, pinheiros e névoa
  S.lobo = (k) => {
    const { P, u, w, h, r } = k;
    const s = h / 180, wx = w * .3, wy = h * .72;
    const wolf = '<g transform="translate(' + f(wx) + ' ' + f(wy) + ') scale(' + f(s) + ')" fill="#02040a">' +
      '<path d="M44 0C54 -4 60 -14 56 -26C54 -18 48 -12 40 -12C38 -20 34 -28 28 -34C26 -46 22 -58 16 -68C14 -74 14 -80 12 -84L10 -96L4 -86C0 -88 -4 -88 -6 -86L-10 -96L-12 -84C-16 -88 -22 -96 -28 -110C-30 -104 -28 -96 -24 -90C-30 -90 -34 -92 -38 -96C-36 -88 -28 -82 -20 -78C-16 -70 -14 -62 -16 -52C-20 -40 -22 -22 -22 0H-12L-10 -24C-6 -30 2 -30 4 -24L6 0H18C18 -8 22 -12 28 -12L30 0Z"/></g>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#050a18'], [.6, P.d], [1, P.a]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + starfield(r, w, h * .6, 70, '#dbe8ff') +
        glow(u + 'mg', w * .32, h * .36, h * .6, P.c, .55) + '<circle cx="' + f(w * .32) + '" cy="' + f(h * .36) + '" r="' + f(h * .22) + '" fill="#eef4ff"/>' +
        '<circle cx="' + f(w * .28) + '" cy="' + f(h * .32) + '" r="' + f(h * .04) + '" fill="#000" opacity=".06"/><circle cx="' + f(w * .37) + '" cy="' + f(h * .42) + '" r="' + f(h * .05) + '" fill="#000" opacity=".05"/>' +
        '<path d="' + ridge(r, w, h, h * .8, h * .18, 5) + '" fill="' + P.a + '" opacity=".6"/>' + pines(r, w, h * .92, Math.round(w / 16), h * .2, h * .4, '#040a16'),
      layers: [{ a: 'drift', d: 20, svg: '<defs>' + lg(u + 'fg', [[0, '#fff', 0], [.5, P.c, .3], [1, '#fff', 0]]) + '</defs><rect y="' + f(h * .7) + '" width="' + w + '" height="' + f(h * .22) + '" fill="url(#' + u + 'fg)"/>' }],
      parts: [{ t: 'estrela', n: 12, c: '#fff', y1: 55, s: [1.5, 3], d: [2, 5] }],
      front: '<path d="M' + f(wx - 70 * s) + ' ' + f(h + 2) + 'L' + f(wx - 44 * s) + ' ' + f(wy) + 'H' + f(wx + 50 * s) + 'L' + f(wx + 80 * s) + ' ' + f(h + 2) + 'Z" fill="#02040a"/>' + wolf + vignette(u, w, h, .45)
    };
  };

  // Mira sniper: lente com retículo, anel girando, marcações e varredura
  S.mira = (k) => {
    const { P, u, w, h, r } = k, cx = w * .7, cy = h * .5, R = h * .42;
    const ticks = [...Array(36)].map((_, i) => { const a = i * 10 * Math.PI / 180, l = i % 3 ? 4 : 9; return '<path d="M' + f(cx + Math.cos(a) * R) + ' ' + f(cy + Math.sin(a) * R) + 'L' + f(cx + Math.cos(a) * (R - l)) + ' ' + f(cy + Math.sin(a) * (R - l)) + '"/>'; }).join('');
    const o = f(cx / w * 100) + '% 50%';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#05070a'], [1, P.d]]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        skyline(C.rng('mr' + u), w, h, h, h * .2, h * .6, '#0c1016', .08, [P.g]) + '<g stroke="' + P.b + '" stroke-width=".6" opacity=".25">' + [...Array(Math.ceil(w / 30))].map((_, i) => '<path d="M' + i * 30 + ' 0V' + h + '"/>').join('') + '</g>' +
        '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R + 4) + '" fill="none" stroke="#000" stroke-width="10" opacity=".6"/>' +
        '<g stroke="' + P.g + '" stroke-width="1.2"><path d="M' + f(cx - R) + ' ' + f(cy) + 'H' + f(cx - 10) + 'M' + f(cx + 10) + ' ' + f(cy) + 'H' + f(cx + R) + 'M' + f(cx) + ' ' + f(cy - R) + 'V' + f(cy - 10) + 'M' + f(cx) + ' ' + f(cy + 10) + 'V' + f(cy + R) + '"/>' +
        [1, 2, 3].map((i) => '<path d="M' + f(cx - 4) + ' ' + f(cy + i * R / 4.5) + 'h8"/>').join('') + '</g><circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="2" fill="' + P.g + '"/>' +
        '<text x="' + f(w * .06) + '" y="' + f(h * .2) + '" fill="' + P.g + '" font-family="monospace" font-size="' + f(h * .07) + '" opacity=".8">DIST 287m</text><text x="' + f(w * .06) + '" y="' + f(h * .3) + '" fill="' + P.b + '" font-family="monospace" font-size="' + f(h * .06) + '" opacity=".6">VENTO 2.1</text>',
      layers: [
        { a: 'spin', d: 24, o, svg: '<g stroke="' + P.c + '" stroke-width="1" opacity=".75">' + ticks + '</g>' },
        { a: 'spinr', d: 14, o, svg: '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R * .62) + '" fill="none" stroke="' + P.g + '" stroke-width="1.4" stroke-dasharray="20 14" opacity=".8"/>' },
        { a: 'scan', d: 3.5, svg: '<defs>' + lg(u + 'sc', [[0, P.g, 0], [.5, P.g, .18], [1, P.g, 0]]) + '</defs><rect y="' + f(h * .45) + '" width="' + w + '" height="' + f(h * .1) + '" fill="url(#' + u + 'sc)"/>' }
      ],
      parts: [],
      front: vignette(u, w, h, .6)
    };
  };

  // Caveira: emblema de caveira com olhos acesos, fumaça e brasas
  S.caveira = (k) => {
    const { P, u, w, h } = k, s = h / 180, cx = w * .68, cy = h * .48;
    const skull = '<g transform="translate(' + f(cx) + ' ' + f(cy) + ') scale(' + f(s) + ')">' +
      '<path d="M-86 60L60 -70M86 60L-60 -70" stroke="#2a2522" stroke-width="12" stroke-linecap="round"/><path d="M-86 60L60 -70M86 60L-60 -70" stroke="' + P.c + '" stroke-width="2" stroke-linecap="round" opacity=".35"/>' +
      '<path d="M0 -62C-40 -62 -56 -34 -52 -6C-50 8 -40 16 -36 26V44H36V26C40 16 50 8 52 -6C56 -34 40 -62 0 -62Z" fill="url(#' + u + 'sk)" stroke="#0a0908" stroke-width="3"/>' +
      '<path d="M-24 44V56M-8 44V58M8 44V58M24 44V56" stroke="#0a0908" stroke-width="3"/><path d="M-30 44H30V58C20 62 -20 62 -30 58Z" fill="url(#' + u + 'sk)" stroke="#0a0908" stroke-width="3"/>' +
      '<path d="M-34 -4C-34 -18 -14 -20 -10 -8C-8 4 -20 10 -28 8C-32 6 -34 2 -34 -4ZM34 -4C34 -18 14 -20 10 -8C8 4 20 10 28 8C32 6 34 2 34 -4Z" fill="#0a0908"/>' +
      '<path d="M0 12L-6 26H6Z" fill="#0a0908"/><path d="M-14 -40C-6 -46 6 -46 14 -40" stroke="#fff" stroke-width="2" opacity=".25" fill="none"/></g>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#050404'], [1, P.d]]) + lg(u + 'sk', [[0, '#f2ede4'], [1, '#9e958a']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') + glow(u + 'bg', cx, cy, h * .7, P.a, .45),
      layers: [
        { a: 'drift', d: 18, svg: glow(u + 'f1', w * .3, h * .7, h * .5, '#3a3530', .7) + glow(u + 'f2', w * .9, h * .8, h * .45, '#2a2522', .7) },
        { a: 'static', svg: skull },
        { a: 'pulse', d: 1.6, svg: glow(u + 'e1', cx - 21 * s, cy - 4 * s, 14 * s, P.g, 1) + glow(u + 'e2', cx + 21 * s, cy - 4 * s, 14 * s, P.g, 1) }
      ],
      parts: [{ t: 'brasa', n: 14, c: [P.g, P.b], s: [1.5, 3], d: [3, 6], sw: 30 }],
      front: vignette(u, w, h, .55)
    };
  };

  // Fênix: ave de fogo com asas abertas batendo, rastro de chamas e brasas
  S.fenix = (k) => {
    const { P, u, w, h } = k, s = h / 180, cx = w * .62, cy = h * .55;
    const wing = (dir) => '<path transform="translate(' + f(cx) + ' ' + f(cy) + ') scale(' + f(s * dir) + ' ' + f(s) + ')" d="M0 -6C20 -30 50 -60 100 -70C90 -60 86 -54 84 -46C100 -48 116 -56 128 -66C120 -48 104 -34 88 -28C100 -26 112 -28 122 -34C110 -16 90 -8 68 -6C80 0 92 0 104 -4C88 12 60 16 30 10C20 8 8 4 0 0Z" fill="url(#' + u + 'wg)" stroke="' + P.d + '" stroke-width="1"/>';
    const body = '<g transform="translate(' + f(cx) + ' ' + f(cy) + ') scale(' + f(s) + ')"><path d="M-10 -8C-8 -26 8 -30 14 -18C18 -10 12 4 8 18C4 34 0 54 -8 76C-4 52 -6 34 -12 18C-16 8 -12 -2 -10 -8Z" fill="url(#' + u + 'bd)"/>' +
      '<path d="M4 -26C10 -34 20 -34 24 -28L32 -24L22 -22C18 -18 10 -18 6 -22Z" fill="' + P.b + '"/><circle cx="16" cy="-27" r="1.8" fill="#fff"/>' +
      '<path d="M2 -28C-4 -40 0 -50 8 -54C6 -46 10 -40 14 -34M8 -30C8 -42 16 -48 24 -48C18 -42 18 -36 18 -30" fill="none" stroke="' + P.c + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M-8 60C-20 80 -30 96 -50 104C-34 92 -26 78 -22 60M-2 64C-2 86 -8 100 -20 112C-10 94 -8 80 -8 64M4 58C12 78 12 92 6 108C16 90 18 74 12 56" fill="none" stroke="' + P.g + '" stroke-width="3" stroke-linecap="round"/></g>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#0c0202'], [.6, P.d], [1, '#1a0404']]) + lg(u + 'wg', [[0, '#fff3b0'], [.35, P.b], [.75, P.a], [1, P.d]], 1, 0) + lg(u + 'bd', [[0, '#fff3b0'], [.5, P.b], [1, P.a]]) + '</defs>' +
        rect(w, h, 'url(#' + u + 's)'),
      layers: [
        { a: 'breath', d: 3, o: f(cx / w * 100) + '% 55%', svg: glow(u + 'g', cx, cy, h * .75, P.g, .6) },
        { a: 'flap', d: 1.4, o: f(cx / w * 100) + '% 55%', svg: wing(1) + wing(-1) },
        { a: 'bob', d: 2.8, svg: body }
      ],
      parts: [{ t: 'brasa', n: 22, c: [P.g, '#fff3b0', P.b], s: [1.5, 3.5], d: [2.5, 5], sw: 40 }],
      front: vignette(u, w, h, .45)
    };
  };

  // Realeza: veludo, coroa com joias no centro, raios de luz e pó dourado
  S.realeza = (k) => {
    const { P, u, w, h } = k, s = h / 180, cx = w * .68, cy = h * .52;
    const crown = '<g transform="translate(' + f(cx) + ' ' + f(cy) + ') scale(' + f(s) + ')">' +
      '<path d="M-60 30L-70 -34L-34 -4L0 -52L34 -4L70 -34L60 30Z" fill="url(#' + u + 'cr)" stroke="#5b3a06" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<rect x="-62" y="28" width="124" height="18" rx="4" fill="url(#' + u + 'cr)" stroke="#5b3a06" stroke-width="2.4"/>' +
      '<circle cx="-70" cy="-38" r="6" fill="' + P.c + '"/><circle cx="0" cy="-58" r="7" fill="' + P.c + '"/><circle cx="70" cy="-38" r="6" fill="' + P.c + '"/>' +
      '<path d="M0 0l10 12-10 12-10-12Z" fill="#e0203a" stroke="#fff" stroke-width="1" stroke-opacity=".5"/><circle cx="-34" cy="14" r="6" fill="#2563eb"/><circle cx="34" cy="14" r="6" fill="#16a34a"/>' +
      '<circle cx="-40" cy="37" r="3.4" fill="#fff" opacity=".85"/><circle cx="-20" cy="37" r="3.4" fill="#fff" opacity=".85"/><circle cx="0" cy="37" r="3.4" fill="#fff" opacity=".85"/><circle cx="20" cy="37" r="3.4" fill="#fff" opacity=".85"/><circle cx="40" cy="37" r="3.4" fill="#fff" opacity=".85"/>' +
      '<path d="M-52 20L-58 -18" stroke="#fff" stroke-width="2" opacity=".35"/></g>';
    const rays = '<defs>' + lg(u + 'ry', [[0, P.c, .3], [1, P.c, 0]]) + '</defs><g fill="url(#' + u + 'ry)">' + [...Array(10)].map((_, i) => '<path transform="rotate(' + (i * 36) + ' ' + f(cx) + ' ' + f(cy) + ')" d="M' + f(cx - 6) + ' ' + f(cy) + 'L' + f(cx - 30 * s) + ' ' + f(cy - h) + 'H' + f(cx + 30 * s) + 'L' + f(cx + 6) + ' ' + f(cy) + 'Z"/>').join('') + '</g>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#12051f'], [.6, P.a], [1, '#0b0314']], 1, 1) + lg(u + 'cr', [[0, '#fff5c2'], [.4, '#f6d77a'], [1, '#b8860b']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        '<g stroke="' + P.b + '" stroke-width=".8" opacity=".25" fill="none">' + [...Array(8)].map((_, i) => '<path d="M' + f(i * w / 7) + ' 0q20 ' + f(h / 2) + ' 0 ' + h + '"/>').join('') + '</g>',
      layers: [
        { a: 'spin', d: 50, o: f(cx / w * 100) + '% 52%', svg: rays },
        { a: 'static', svg: glow(u + 'cg', cx, cy, h * .5, P.b, .45) + crown }
      ],
      parts: [{ t: 'faisca', n: 14, c: ['#fff5c2', P.c], s: [1.5, 3], d: [1.8, 3.6] }, { t: 'neve', n: 10, c: '#f6d77a', s: [1, 2.2], d: [6, 11], sw: 20 }],
      front: vignette(u, w, h, .45)
    };
  };

  // Grande Onda (ukiyo-e): céu creme, onda gigante com garras de espuma e o monte ao fundo
  S.kanagawa = (k) => {
    const { P, u, w, h, r } = k, s = h / 180;
    const wave = 'M' + f(w * .02) + ' ' + f(h + 2) + 'C' + f(w * .08) + ' ' + f(h * .5) + ' ' + f(w * .28) + ' ' + f(h * .08) + ' ' + f(w * .5) + ' ' + f(h * .12) + 'C' + f(w * .64) + ' ' + f(h * .14) + ' ' + f(w * .7) + ' ' + f(h * .32) + ' ' + f(w * .64) + ' ' + f(h * .42) +
      'C' + f(w * .6) + ' ' + f(h * .3) + ' ' + f(w * .5) + ' ' + f(h * .28) + ' ' + f(w * .44) + ' ' + f(h * .38) + 'C' + f(w * .52) + ' ' + f(h * .36) + ' ' + f(w * .56) + ' ' + f(h * .44) + ' ' + f(w * .52) + ' ' + f(h * .5) + 'C' + f(w * .4) + ' ' + f(h * .5) + ' ' + f(w * .3) + ' ' + f(h * .7) + ' ' + f(w * .3) + ' ' + f(h + 2) + 'Z';
    let claws = '';
    for (let i = 0; i < 12; i++) { const t = i / 11, x = w * (.3 + t * .36), y = h * (.1 + Math.sin(t * Math.PI) * .02 + t * .1); claws += '<path d="M' + f(x) + ' ' + f(y) + 'q' + f(4 * s) + ' ' + f(-8 * s) + ' ' + f(10 * s) + ' ' + f(-2 * s) + 'q' + f(-5 * s) + ' ' + f(-2 * s) + ' ' + f(-6 * s) + ' ' + f(4 * s) + 'Z" fill="#f3ecd9"/>'; }
    let foam = '';
    for (let i = 0; i < 26; i++) foam += '<circle cx="' + f(w * (.3 + r() * .5)) + '" cy="' + f(h * (.05 + r() * .35)) + '" r="' + f((1 + r() * 2.2) * s) + '" fill="#f3ecd9"/>';
    return {
      back: '<defs>' + lg(u + 's', [[0, '#e9dfc7'], [1, '#d8ccb0']]) + '</defs>' + rect(w, h, 'url(#' + u + 's)') +
        '<path d="M' + f(w * .74) + ' ' + f(h * .78) + 'L' + f(w * .82) + ' ' + f(h * .56) + 'L' + f(w * .9) + ' ' + f(h * .78) + 'Z" fill="' + P.a + '"/><path d="M' + f(w * .8) + ' ' + f(h * .6) + 'L' + f(w * .82) + ' ' + f(h * .56) + 'L' + f(w * .84) + ' ' + f(h * .6) + 'L' + f(w * .82) + ' ' + f(h * .59) + 'Z" fill="#fff"/>' +
        '<circle cx="' + f(w * .9) + '" cy="' + f(h * .2) + '" r="' + f(h * .07) + '" fill="#c8242b" opacity=".85"/>',
      layers: [
        { a: 'bob', d: 4, svg: '<path d="' + wave + '" fill="' + P.a + '"/><path d="' + wave + '" fill="none" stroke="' + P.d + '" stroke-width="' + f(2 * s) + '"/>' + claws + foam },
        { a: 'sway', d: 5, svg: '<path d="M-10 ' + f(h * .85) + 'q' + f(w * .12) + ' ' + f(-h * .12) + ' ' + f(w * .25) + ' 0t' + f(w * .25) + ' 0t' + f(w * .25) + ' 0t' + f(w * .25) + ' 0V' + f(h + 4) + 'H-10Z" fill="' + P.b + '"/>' }
      ],
      parts: [{ t: 'neve', n: 10, c: '#f3ecd9', y0: 0, y1: 40, x0: 30, x1: 80, s: [2, 3.5], d: [3, 6], sw: 20 }],
      front: '<rect width="' + w + '" height="' + h + '" fill="none" stroke="#3b2f1e" stroke-width="' + f(3 * s) + '" opacity=".3"/>'
    };
  };

  /* ---------------- montagem ---------------- */
  const ANIM = { flashbg: 1, sway: 1, sway2: 1, drift: 1, bob: 1, breath: 1, pulse: 1, spin: 1, spinr: 1, flick: 1, beam: 1, flash: 1, scan: 1, zoom: 1, sweep: 1, glitch: 1, flap: 1, float: 1, gridm: 1, static: 1 };
  // miniatura: tudo achatado num SVG só (sem camadas e sem <i>), bem mais leve numa grade com dezenas de itens
  const FALL = { neve: 1, cinza: 1, petala: 1, folha: 1, chuva: 1 }, RISE = { brasa: 1, bolha: 1 };
  function flatParts(list, k) {
    if (!list) return '';
    const r = C.rng('pt' + k.u);
    let s = '';
    list.forEach((p) => {
      const n = Math.max(1, Math.round(p.n * .6)), cols = [].concat(p.c || '#fff');
      for (let i = 0; i < n; i++) {
        const x = ((p.x0 != null ? p.x0 : 0) + r() * ((p.x1 != null ? p.x1 : 100) - (p.x0 != null ? p.x0 : 0))) * k.w / 100;
        let y = ((p.y0 != null ? p.y0 : 0) + r() * ((p.y1 != null ? p.y1 : 100) - (p.y0 != null ? p.y0 : 0))) * k.h / 100;
        const pr = .1 + r() * .8, sz = (p.s || [2, 4]), size = sz[0] + r() * (sz[1] - sz[0]);
        if (FALL[p.t]) y = pr * k.h; else if (RISE[p.t]) y = k.h - pr * k.h;
        if (p.t === 'chuva') s += '<path d="M' + f(x) + ' ' + f(y) + 'l-2 ' + f(size * 3) + '" stroke="' + cols[i % cols.length] + '" stroke-width=".8" opacity=".5"/>';
        else if (p.t === 'bokeh') s += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(size / 2) + '" fill="' + cols[i % cols.length] + '" opacity=".35"/>';
        else if (p.t === 'carro' || p.t === 'pacote' || p.t === 'passaro') s += '<rect x="' + f(pr * k.w) + '" y="' + f(y) + '" width="' + f(size * 3) + '" height="' + f(Math.max(1, size * .6)) + '" rx="1" fill="' + cols[i % cols.length] + '" opacity=".8"/>';
        else s += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(Math.max(.6, size / 2)) + '" fill="' + cols[i % cols.length] + '" opacity="' + f(.5 + r() * .5) + '"/>';
      }
    });
    return s;
  }
  function render(kind, key, o) {
    const sz = o.size || SIZE[kind] || SIZE.banner;
    const k = { P: o.P, u: o.u, w: sz[0], h: sz[1], r: C.rng(key + sz[0] + 'x' + sz[1]), kind, lite: lite() };
    const sc = S[key](k);
    const vb = '0 0 ' + k.w + ' ' + k.h;
    const svg = (inner, cls) => '<svg class="' + cls + '" viewBox="' + vb + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + inner + '</svg>';
    // parado: um SVG só (camadas na pose inicial; o clarão da tempestade fica de fora)
    if (o.still) return '<div class="sn sn-' + kind + ' sn-' + key + ' still">' + svg(sc.back + (sc.layers || []).filter((L) => L.a !== 'flashbg').map((L) => L.svg).join('') + flatParts(sc.parts, k) + (sc.front || ''), 'sn-back') + '</div>';
    // no fundo da página inteira as camadas grandes custam memória: no modo leve ficam paradas
    const maxL = k.lite ? (kind === 'fundo' ? 0 : 2) : kind === 'fundo' ? 2 : 9;
    let out = '<div class="sn sn-' + kind + ' sn-' + key + '">' + svg(sc.back, 'sn-back');
    (sc.layers || []).forEach((L, i) => {
      const a = i < maxL && ANIM[L.a] ? L.a : 'static';
      out += '<div class="sn-l sn-' + a + '" style="--d:' + (L.d || 8) + 's;--dl:-' + (L.dl || 0) + 's' + (L.o ? ';transform-origin:' + L.o : '') + '">' + svg(L.svg, '') + '</div>';
    });
    out += particles(sc.parts, k);
    if (sc.front) out += svg(sc.front, 'sn-front');
    return out + '</div>';
  }
  C.SCENES2 = S;
  C.snParticles = particles;
  C.snHelpers = { lg, rg, glow, cloud, bolt };
  C.sceneRender = render;
  ['banner', 'capa', 'fundo'].forEach((kind) => Object.keys(S).forEach((key) => C.register(kind, key, (o) => render(kind, key, o))));
})();
