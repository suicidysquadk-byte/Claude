/* Placas de identificação e molduras de perfil (no estilo da Loja do Discord).
   - Placa ("placa"): faixa ilustrada atrás do nick nas listas (salas, ranking, amigos, guilda). A arte fica à
     direita e some em degradê para a esquerda, para o nome continuar legível.
   - Moldura de perfil ("perfil"): contorno do cartão do perfil inteiro, com um personagem espiando no alto.
     É desenhada no tamanho exato do cartão quando ele entra na tela (BH.cosm.mount chama drawFrames).
   As duas usam as mesmas regras de desempenho: arte parada em SVG e só camadas <div>/<svg> se movendo. */
(function () {
  const C = BH.cosm;
  const f = (n) => Math.round(n * 10) / 10;
  const W = 320, H = 56;
  const lg = (id, stops, x2, y2) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 1 : x2) + '" y2="' + (y2 == null ? 0 : y2) + '">' + stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
  const sv = (inner, cls, vb) => '<svg class="' + (cls || '') + '" viewBox="' + (vb || '0 0 ' + W + ' ' + H) + '" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">' + inner + '</svg>';

  /* ---------------- placas próprias (pelo, olho, penas...) ---------------- */
  // faixas de pelo curvas (guaxinim, tigre)
  function furStripes(r, col, n, x0) { let s = ''; for (let i = 0; i < n; i++) { const x = x0 + i * (W - x0) / n + r() * 8; s += '<path d="M' + f(x) + ' -4C' + f(x + 10) + ' 14 ' + f(x - 8) + ' 34 ' + f(x + 6) + ' ' + (H + 4) + 'L' + f(x + 18) + ' ' + (H + 4) + 'C' + f(x + 6) + ' 34 ' + f(x + 22) + ' 16 ' + f(x + 14) + ' -4Z" fill="' + col + '"/>'; } return s; }
  // fios de pelo (textura)
  function hairs(r, col, n, x0, op) { let s = '<g stroke="' + col + '" stroke-width="1" stroke-linecap="round" opacity="' + (op || .5) + '">'; for (let i = 0; i < n; i++) { const x = x0 + r() * (W - x0), y = r() * H; s += '<path d="M' + f(x) + ' ' + f(y) + 'q' + f(3 + r() * 3) + ' ' + f(-2 - r() * 3) + ' ' + f(7 + r() * 5) + ' ' + f(-1 + r() * 2) + '"/>'; } return s + '</g>'; }
  const PL = {};

  PL['pl-guaxinim'] = (o) => { const r = C.rng('pg' + o.u), u = o.u; return {
    back: '<defs>' + lg(u + 'g', [[0, '#57524d'], [1, '#a8a29e']]) + '</defs><rect width="' + W + '" height="' + H + '" fill="url(#' + u + 'g)"/>' + furStripes(r, '#1c1917', 5, 90) + hairs(r, '#e7e5e4', 60, 80, .45) +
      '<g transform="translate(284 28)"><path d="M0 12C-16 2 -16 -10 -8 -12C-3 -13 0 -9 0 -6C0 -9 3 -13 8 -12C16 -10 16 2 0 12Z" fill="#27272a" stroke="#f5f5f4" stroke-width="2.4"/><path d="M-7 -8C-5 -10 -2 -9 -1 -7" stroke="#fff" stroke-width="1.4" fill="none" opacity=".7"/></g>',
    layers: [{ a: 'sway', d: 3, svg: '<g transform="translate(284 10)"><path d="M0 -12V6" stroke="#d6d3d1" stroke-width="1.6"/></g>' }] }; };

  PL['pl-leopardo'] = (o) => { const r = C.rng('pl' + o.u), u = o.u; let sp = ''; for (let i = 0; i < 26; i++) { const x = 70 + r() * 250, y = r() * H, s = 3 + r() * 4; sp += '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(r() * 180) + ')"><path d="M' + f(-s * 1.3) + ' 0A' + f(s * 1.3) + ' ' + f(s) + ' 0 1 1 ' + f(s) + ' ' + f(s * .6) + '" fill="none" stroke="#3f3a36" stroke-width="2.2" stroke-linecap="round"/><ellipse rx="' + f(s * .5) + '" ry="' + f(s * .4) + '" fill="#a8a29e"/></g>'; }
    return { back: '<defs>' + lg(u + 'g', [[0, '#d6d3d1'], [1, '#fafaf9']]) + '</defs><rect width="' + W + '" height="' + H + '" fill="url(#' + u + 'g)"/>' + hairs(r, '#78716c', 40, 60, .35) + sp,
      layers: [], parts: [{ t: 'faisca', n: 5, c: ['#fff', '#bae6fd'], x0: 40, x1: 98, s: [2, 3], d: [1.6, 3] }] }; };

  PL['pl-lobo-lunar'] = (o) => { const r = C.rng('pw' + o.u), u = o.u, P = o.P; let fe = ''; for (let i = 0; i < 16; i++) { const x = 90 + i * 15 + r() * 6, y = r() * H; fe += '<path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(-30 + r() * 60) + ')" d="M0 0C6 -6 18 -8 30 -4C20 0 10 4 0 0Z" fill="' + (i % 2 ? P.b : '#e0f2fe') + '" opacity=".9"/>'; }
    return { back: '<defs>' + lg(u + 'g', [[0, P.d], [1, P.a]]) + '</defs><rect width="' + W + '" height="' + H + '" fill="url(#' + u + 'g)"/>' + fe,
      layers: [], parts: [{ t: 'faisca', n: 7, c: ['#fff', P.c], x0: 30, x1: 98, s: [2, 3.5], d: [1.4, 2.8] }] }; };

  // Lobo Espiritual: olho de lobo brilhando no pelo branco
  PL['pl-olho-lobo'] = (o) => { const r = C.rng('po' + o.u), u = o.u, P = o.P; return {
    back: '<defs>' + lg(u + 'g', [[0, '#a8a29e'], [.6, '#e7e5e4'], [1, '#fafaf9']]) + '<radialGradient id="' + u + 'ir"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="' + P.c + '"/><stop offset="1" stop-color="' + P.a + '"/></radialGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#' + u + 'g)"/>' + hairs(r, '#78716c', 70, 60, .4) +
      '<path d="M200 30C224 6 268 2 300 18C286 16 276 20 270 26C284 26 296 30 306 38C276 44 236 46 200 30Z" fill="#1c1917"/>' +
      '<path d="M214 30C236 14 268 12 290 24C278 36 244 40 214 30Z" fill="url(#' + u + 'ir)"/><ellipse cx="256" cy="26" rx="4" ry="10" fill="#0c0a09"/>',
    layers: [{ a: 'pulse', d: 2.2, svg: '<ellipse cx="252" cy="27" rx="46" ry="14" fill="' + P.g + '" opacity=".25"/>' }] }; };

  PL['pl-bordo'] = (o) => { const r = C.rng('pb' + o.u), u = o.u, P = o.P; let lv = ''; for (let i = 0; i < 16; i++) { const x = 110 + r() * 210, y = r() * H, s = .8 + r() * .8; lv += '<path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(r() * 360) + ') scale(' + f(s) + ')" d="M0 -10L2 -4L7 -7L5 -1L10 0L5 2L7 7L1 4L0 10L-1 4L-7 7L-5 2L-10 0L-5 -1L-7 -7L-2 -4Z" fill="' + [P.a, P.b, '#dc2626', '#f97316'][i % 4] + '"/>'; }
    return { back: '<defs>' + lg(u + 'g', [[0, '#1c0a05'], [1, '#431407']]) + '</defs><rect width="' + W + '" height="' + H + '" fill="url(#' + u + 'g)"/><path d="M120 50C170 38 220 44 330 10" stroke="#6b3a1e" stroke-width="4" fill="none"/>' + lv,
      layers: [], parts: [{ t: 'folha', n: 4, c: [P.a, '#dc2626'], x0: 40, x1: 98, s: [4, 6], d: [3, 5], sw: 10 }] }; };

  PL['pl-dragao'] = (o) => { const u = o.u, P = o.P; let sc = ''; for (let y = -6; y < H + 10; y += 10) for (let x = 90 + (y / 10 % 2) * 9; x < W + 20; x += 18) sc += '<path d="M' + x + ' ' + y + 'q9 10 18 0" fill="none" stroke="' + P.d + '" stroke-width="2" opacity=".55"/>';
    return { back: '<defs>' + lg(u + 'g', [[0, P.d], [.5, P.a], [1, P.b]]) + '</defs><rect width="' + W + '" height="' + H + '" fill="url(#' + u + 'g)"/>' + sc +
      '<path d="M236 28C252 16 280 14 300 24C286 36 256 40 236 28Z" fill="#fff7d6"/><ellipse cx="268" cy="26" rx="3" ry="9" fill="#1c0a00"/>',
      layers: [{ a: 'sweep', d: 4, svg: '<rect x="130" y="-10" width="40" height="80" fill="#fff" opacity=".18"/>' }] }; };

  // placas feitas com os cenários (mesma arte do banner, cortada em faixa)
  const SCN = { 'pl-galaxia': 'nebulosa', 'pl-aurora': 'aurora', 'pl-chamas': 'chamas', 'pl-cidade': 'cidade', 'pl-sakura': 'petalas', 'pl-ondas': 'ondas', 'pl-ouro': 'ouro', 'pl-raios': 'raios', 'pl-synth': 'grade', 'pl-cristais': 'cristais' };

  function renderPlate(key, o) {
    if (SCN[key]) return '<span class="pl pl-' + key + (o.still ? ' still' : '') + '">' + C.sceneRender('placa', SCN[key], Object.assign({}, o, { size: [W, H] })) + '</span>';
    const s = PL[key](o);
    let out = '<span class="pl pl-' + key + (o.still ? ' still' : '') + '"><span class="sn sn-placa' + (o.still ? ' still' : '') + '">' + sv(s.back, 'sn-back');
    (s.layers || []).forEach((L) => { out += '<div class="sn-l sn-' + (o.still ? 'static' : L.a) + '" style="--d:' + (L.d || 3) + 's">' + sv(L.svg, '') + '</div>'; });
    if (!o.still && s.parts && C.snParticles) out += C.snParticles(s.parts, { u: o.u, kind: 'placa', lite: document.documentElement.classList.contains('bh-lite') });
    return out + '</span></span>';
  }
  Object.keys(PL).concat(Object.keys(SCN)).forEach((k) => C.register('placa', k, (o) => renderPlate(k, o)));
  C.PLATES = Object.keys(PL).concat(Object.keys(SCN));

  /* ---------------- molduras de perfil (contorno do cartão) ----------------
     Cada desenho recebe (P, u, w, h) no tamanho real do cartão e devolve { back, front, layers } em SVG. */
  const R = 22; // raio do canto do cartão
  // borda felpuda seguindo o retângulo arredondado (w x h), grossura t
  function furBorder(w, h, t, seed) {
    const r = C.rng(seed), pts = [];
    const per = 2 * (w + h), n = Math.round(per / 7);
    for (let i = 0; i < n; i++) {
      let d = (i / n) * per, x, y, nx, ny;
      if (d < w) { x = d; y = 0; nx = 0; ny = -1; } else if (d < w + h) { x = w; y = d - w; nx = 1; ny = 0; } else if (d < 2 * w + h) { x = w - (d - w - h); y = h; nx = 0; ny = 1; } else { x = 0; y = h - (d - 2 * w - h); nx = -1; ny = 0; }
      const k = (i % 2 ? 1 : .35) * (2 + r() * 2.5);
      pts.push([f(x - nx * (t - k)), f(y - ny * (t - k))]);
    }
    return 'M-40 -40H' + (w + 40) + 'V' + (h + 40) + 'H-40Z M' + pts.map((p) => p.join(' ')).join('L') + 'Z';
  }
  const PF = {};
  // Guaxinim espiando no alto + borda de pelo cinza
  PF['pf-guaxinim'] = (P, u, w, h) => ({
    back: '',
    front: '<path d="' + furBorder(w, h, 11, 'fg' + u) + '" fill="#8f8983" fill-rule="evenodd" stroke="#1f1b19" stroke-width="1.2"/>' +
      '<g transform="translate(' + f(w / 2) + ' 40)"><path d="M-34 10C-34 -14 -18 -30 0 -30C18 -30 34 -14 34 10Z" fill="#a8a29e" stroke="#1f1b19" stroke-width="2"/>' +
      '<path d="M-30 -8L-40 -34L-16 -24Z M30 -8L40 -34L16 -24Z" fill="#a8a29e" stroke="#1f1b19" stroke-width="2" stroke-linejoin="round"/><path d="M-30 -14L-35 -28L-22 -22Z M30 -14L35 -28L22 -22Z" fill="#3a3432"/>' +
      '<path d="M-30 -6C-18 -16 18 -16 30 -6C24 4 12 2 0 2C-12 2 -24 4 -30 -6Z" fill="#1f1b19"/><circle cx="-13" cy="-7" r="4.5" fill="#fff"/><circle cx="13" cy="-7" r="4.5" fill="#fff"/><circle class="pf-eye" cx="-12" cy="-6" r="2.4" fill="#111"/><circle class="pf-eye" cx="14" cy="-6" r="2.4" fill="#111"/>' +
      '<ellipse cx="0" cy="4" rx="4" ry="3" fill="#111"/><path d="M-34 10H34" stroke="#1f1b19" stroke-width="2"/><path d="M-40 12C-38 4 -32 2 -26 6M40 12C38 4 32 2 26 6" stroke="#1f1b19" stroke-width="4" stroke-linecap="round" fill="#a8a29e"/></g>',
    layers: [] });
  PF['pf-leopardo'] = (P, u, w, h) => { const r = C.rng('pl' + u); let sp = ''; for (let i = 0; i < Math.round((w + h) / 18); i++) { const d = r() * 2 * (w + h); let x, y; if (d < w) { x = d; y = 5; } else if (d < w + h) { x = w - 5; y = d - w; } else if (d < 2 * w + h) { x = w - (d - w - h); y = h - 5; } else { x = 5; y = h - (d - 2 * w - h); } sp += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(2 + r() * 1.6) + '" fill="none" stroke="#3f3a36" stroke-width="1.8"/>'; }
    return { back: '', front: '<path d="' + furBorder(w, h, 12, 'fl' + u) + '" fill="#e7e5e4" fill-rule="evenodd" stroke="#78716c" stroke-width="1"/>' + sp, layers: [], parts: true }; };
  PF['pf-neon'] = (P, u, w, h) => ({
    back: '', front: '<rect x="4" y="4" width="' + (w - 8) + '" height="' + (h - 8) + '" rx="' + R + '" fill="none" stroke="' + P.b + '" stroke-width="2.4"/>' +
      [[14, 14, 1, 1], [w - 14, 14, -1, 1], [14, h - 14, 1, -1], [w - 14, h - 14, -1, -1]].map(([x, y, sx, sy]) => '<path d="M' + x + ' ' + (y + 26 * sy) + 'V' + y + 'H' + (x + 26 * sx) + '" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>').join(''),
    layers: [{ a: 'pulse', d: 1.6, svg: '<rect x="4" y="4" width="' + (w - 8) + '" height="' + (h - 8) + '" rx="' + R + '" fill="none" stroke="' + P.g + '" stroke-width="9" opacity=".35"/>' }] });
  PF['pf-dourado'] = (P, u, w, h) => { const corner = (x, y, rot) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><path d="M0 0C18 2 30 10 36 26C28 16 18 12 6 12C14 20 16 30 12 40C8 28 2 18 0 0Z" fill="url(#' + u + 'go)" stroke="#6b4308" stroke-width="1"/><circle cx="8" cy="8" r="5" fill="' + P.c + '" stroke="#6b4308"/></g>';
    return { back: '', front: '<defs>' + lg(u + 'go', [[0, '#fff5c2'], [.5, '#f6d77a'], [1, '#b8860b']], 1, 1) + '</defs><rect x="3" y="3" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="' + R + '" fill="none" stroke="url(#' + u + 'go)" stroke-width="5"/>' +
      '<rect x="10" y="10" width="' + (w - 20) + '" height="' + (h - 20) + '" rx="' + (R - 6) + '" fill="none" stroke="#f6d77a" stroke-width="1" opacity=".6"/>' + corner(4, 4, 0) + corner(w - 4, 4, 90) + corner(w - 4, h - 4, 180) + corner(4, h - 4, 270),
      layers: [{ a: 'sweep', d: 5, svg: '<rect x="' + f(w * .4) + '" y="-20" width="' + f(w * .12) + '" height="' + (h + 40) + '" fill="#fff" opacity=".2"/>' }] }; };
  PF['pf-bordo'] = (P, u, w, h) => { const r = C.rng('pfb' + u); let lv = ''; const leaf = (x, y, s, rot, col) => '<path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ') scale(' + f(s) + ')" d="M0 -10L2 -4L7 -7L5 -1L10 0L5 2L7 7L1 4L0 10L-1 4L-7 7L-5 2L-10 0L-5 -1L-7 -7L-2 -4Z" fill="' + col + '" stroke="#450a0a" stroke-width=".6"/>';
    for (let i = 0; i < 18; i++) { const c = i % 4; const x = c === 0 || c === 3 ? r() * 70 : w - r() * 70, y = c < 2 ? r() * 50 : h - r() * 50; lv += leaf(x, y, .9 + r() * .7, r() * 360, [P.a, P.b, '#dc2626', '#f97316'][i % 4]); }
    return { back: '', front: '<path d="M-4 60C20 30 30 16 70 -4M' + (w + 4) + ' ' + (h - 60) + 'C' + (w - 20) + ' ' + (h - 30) + ' ' + (w - 30) + ' ' + (h - 16) + ' ' + (w - 70) + ' ' + (h + 4) + '" stroke="#6b3a1e" stroke-width="5" fill="none" stroke-linecap="round"/>' + lv, layers: [], parts: 'folha' }; };
  PF['pf-sakura'] = (P, u, w, h) => { const r = C.rng('pfs' + u); let fl = ''; const flower = (x, y, s) => { let p = ''; for (let k = 0; k < 5; k++) p += '<ellipse cx="0" cy="' + f(-s) + '" rx="' + f(s * .7) + '" ry="' + f(s) + '" transform="rotate(' + (k * 72) + ')" fill="' + (k % 2 ? P.a : P.c) + '"/>'; return '<g transform="translate(' + f(x) + ' ' + f(y) + ')">' + p + '<circle r="' + f(s * .4) + '" fill="#fde68a"/></g>'; };
    for (let i = 0; i < 16; i++) { const top = i < 8; fl += flower(top ? w - r() * 110 : r() * 110, top ? r() * 40 : h - r() * 40, 4 + r() * 3); }
    return { back: '', front: '<path d="M' + (w + 4) + ' 30C' + (w - 40) + ' 10 ' + (w - 80) + ' 20 ' + (w - 120) + ' -4M-4 ' + (h - 30) + 'C40 ' + (h - 10) + ' 80 ' + (h - 20) + ' 120 ' + (h + 4) + '" stroke="#3b1a14" stroke-width="4" fill="none" stroke-linecap="round"/>' + fl, layers: [], parts: 'petala' }; };
  PF['pf-chamas'] = (P, u, w, h) => { const r = C.rng('pfc' + u); let fl = ''; for (let x = -10; x < w + 10; x += 16) { const hh = 14 + r() * 26; fl += '<path d="M' + f(x - 9) + ' ' + h + 'C' + f(x - 8) + ' ' + f(h - hh * .5) + ' ' + f(x + 2) + ' ' + f(h - hh * .6) + ' ' + f(x) + ' ' + f(h - hh) + 'C' + f(x + 6) + ' ' + f(h - hh * .5) + ' ' + f(x + 10) + ' ' + f(h - hh * .4) + ' ' + f(x + 9) + ' ' + h + 'Z"/>'; }
    return { back: '', front: '<defs>' + lg(u + 'fl', [[0, '#fff7ae'], [.5, P.g], [1, P.a]], 0, 0) + '</defs><rect x="2" y="2" width="' + (w - 4) + '" height="' + (h - 4) + '" rx="' + R + '" fill="none" stroke="' + P.a + '" stroke-width="3"/>',
      layers: [{ a: 'flick', d: .8, svg: '<defs><linearGradient id="' + u + 'f2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff7ae"/><stop offset=".5" stop-color="' + P.g + '"/><stop offset="1" stop-color="' + P.a + '" stop-opacity="0"/></linearGradient></defs><g fill="url(#' + u + 'f2)">' + fl + '</g>' }], parts: 'brasa' }; };
  PF['pf-gelo'] = (P, u, w, h) => { const r = C.rng('pfg' + u); let ic = ''; for (let x = 8; x < w - 8; x += 12 + r() * 10) { const l = 8 + r() * 22; ic += '<path d="M' + f(x - 4) + ' 2L' + f(x) + ' ' + f(l) + 'L' + f(x + 4) + ' 2Z" fill="url(#' + u + 'ic)"/>'; }
    return { back: '', front: '<defs>' + lg(u + 'ic', [[0, '#ffffff'], [1, P.b]], 0, 1) + '</defs><rect x="2" y="2" width="' + (w - 4) + '" height="' + (h - 4) + '" rx="' + R + '" fill="none" stroke="' + P.c + '" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>' + ic, layers: [], parts: 'neve' }; };
  PF['pf-dragao'] = (P, u, w, h) => {
    // corpo sobe pela borda esquerda, corre pelo alto e a cabeça fica no canto de cima à direita
    const path = 'M10 ' + (h - 26) + 'V34Q10 10 34 10H' + (w - 64);
    let sp = ''; for (let y = h - 40; y > 40; y -= 14) sp += '<path d="M4 ' + y + 'L-6 ' + (y - 6) + 'L4 ' + (y - 12) + 'Z" fill="' + P.a + '" stroke="' + P.d + '" stroke-width=".8" transform="translate(6 0)"/>';
    for (let x = 40; x < w - 70; x += 14) sp += '<path d="M' + x + ' 4L' + (x + 6) + ' -6L' + (x + 12) + ' 4Z" fill="' + P.a + '" stroke="' + P.d + '" stroke-width=".8" transform="translate(0 6)"/>';
    return { back: '', front: '<defs>' + lg(u + 'bd', [[0, P.c], [.5, P.b], [1, P.a]], 0, 1) + '</defs>' + sp +
      '<path d="' + path + '" fill="none" stroke="' + P.d + '" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="' + path + '" fill="none" stroke="url(#' + u + 'bd)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + path + '" fill="none" stroke="' + P.d + '" stroke-width="8" stroke-dasharray="1 6" opacity=".45"/>' +
      '<g transform="translate(' + (w - 60) + ' 12) rotate(18) scale(1.15)"><path d="M-10 -8C4 -18 22 -16 32 -8C40 -2 44 2 44 6C36 8 30 6 26 8L18 10C10 14 -4 14 -12 8Z" fill="url(#' + u + 'bd)" stroke="' + P.d + '" stroke-width="1.4"/>' +
      '<path d="M18 10C26 10 36 10 44 6C42 14 30 18 18 14Z" fill="url(#' + u + 'bd)" stroke="' + P.d + '" stroke-width="1"/><path d="M0 -10C4 -22 14 -28 22 -30C18 -22 16 -16 16 -10Z" fill="' + P.c + '" stroke="' + P.d + '"/>' +
      '<path d="M4 -8C8 -11 14 -11 17 -7C13 -5 8 -5 4 -8Z" fill="#fff"/><circle cx="11" cy="-7.5" r="2" fill="' + P.g + '"/><path d="M40 4C52 -2 62 4 66 12M36 10C44 18 44 26 40 32" stroke="' + P.b + '" stroke-width="1.6" fill="none"/></g>' +
      '<path d="M10 ' + (h - 26) + 'l-4 14 6 -4 4 8 2 -12" fill="' + P.b + '" stroke="' + P.d + '"/>',
      layers: [{ a: 'breath', d: 2.4, svg: '<circle cx="' + (w - 20) + '" cy="50" r="7" fill="#fffdf2"/><circle cx="' + (w - 20) + '" cy="50" r="14" fill="' + P.c + '" opacity=".35"/>' }], parts: 'brasa' }; };
  const PARTS = { folha: (P) => [{ t: 'folha', n: 6, c: [P.a, '#dc2626', P.b], s: [5, 7], d: [5, 8], sw: 20 }], petala: (P) => [{ t: 'petala', n: 8, c: [P.c, P.b, '#fff'], s: [4, 6], d: [5, 8], sw: 20 }],
    brasa: (P) => [{ t: 'brasa', n: 10, c: [P.g, '#fff3b0'], y0: 70, y1: 100, s: [1.5, 3], d: [2.5, 4.5], sw: 20 }], neve: () => [{ t: 'neve', n: 12, c: '#fff', s: [1.5, 3], d: [5, 9], sw: 20 }],
    true: () => [{ t: 'faisca', n: 6, c: ['#fff', '#bae6fd'], s: [2, 3], d: [1.6, 3] }] };
  // desenha no tamanho real (chamado depois que o cartão entra na tela, e de novo se o tamanho mudar)
  function paintFrame(el) {
    const key = el.dataset.pf, fn = PF[key];
    if (!fn) return;
    const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight);
    if (!w || !h || (el._w === w && el._h === h)) return;
    el._w = w; el._h = h;
    const P = C.pal(el.dataset.pal), u = C.uid('pf'), still = el.classList.contains('still');
    const s = fn(P, u, w, h), vb = '0 0 ' + w + ' ' + h;
    const svg = (inner, cls, st) => '<svg class="' + cls + '" viewBox="' + vb + '" width="' + w + '" height="' + h + '" overflow="visible" aria-hidden="true"' + (st ? ' style="' + st + '"' : '') + '>' + inner + '</svg>';
    let out = (s.back ? svg(s.back, 'pf-b') : '');
    (s.layers || []).forEach((L) => { out += svg(L.svg, 'pf-l' + (still ? '' : ' dc-l sn-' + L.a), '--d:' + (L.d || 3) + 's'); });
    out += svg(s.front, 'pf-f');
    if (!still && s.parts && PARTS[s.parts] && C.snParticles) out += '<span class="dc-pw">' + C.snParticles(PARTS[s.parts](P), { u, kind: 'deco', lite: document.documentElement.classList.contains('bh-lite') }) + '</span>';
    el.innerHTML = out;
  }
  Object.keys(PF).forEach((k) => C.register('perfil', k, (o) => '<div class="pf pf-' + k + (o.still ? ' still' : '') + '" data-pf="' + k + '" data-pal="' + ((o.v && C.PAL[o.v] && o.v) || (o.d && o.d.pal) || 'dourado') + '" aria-hidden="true"></div>'));
  C.PROFILE_FRAMES = Object.keys(PF);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((es) => es.forEach((e) => paintFrame(e.target))) : null;
  C.drawFrames = (root) => { (root || document).querySelectorAll('.pf[data-pf]').forEach((el) => { paintFrame(el); if (ro && !el._ro) { el._ro = 1; ro.observe(el); } }); };
})();
