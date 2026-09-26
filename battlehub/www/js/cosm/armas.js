/* Armas e colecionáveis nas costas do avatar (caixa -40..140, avatar em 0..100). Cada arma é desenhada em pé, com a
   ponta em y=-80 e o cabo em y=+70, e depois inclinada atrás do avatar. data.fx liga o efeito da lâmina:
   brilho, energia, particulas, fogo, gelo, eletrico, holo, runas. data.dual espelha a arma (par cruzado). */
(function () {
  const C = BH.cosm;
  const { lin, rad, svg } = C;
  const O = (P, w) => ' stroke="' + P.d + '" stroke-width="' + (w || 1.6) + '" stroke-linejoin="round"';
  const steel = (u, P) => lin(u + 'st', [[0, '#ffffff'], [.35, P.c], [.6, '#9ca3af'], [1, '#4b5563']], 1, 0);
  const wrap = (u, P) => '<defs>' + steel(u, P) + lin(u + 'g', [[0, P.c], [.5, P.a], [1, P.d]], 1, 0) + lin(u + 'w', [[0, '#8a5a2b'], [1, '#3b2412']], 1, 0) + rad(u + 'o', [[0, '#fff'], [.4, P.g], [1, P.a, .2]]) + '</defs>';

  // cada arma: corpo (SVG), lâmina (caminho usado pelos efeitos), trecho da lâmina [início, fim] e meia largura
  const W = {
    katana: (P, u) => ({
      blade: 'M-3.2 18L-4 -42Q-4 -68 2.5 -82Q5.5 -62 4.2 -42L4 18Z', span: [-80, 16], w: 4,
      body: '<path d="M-3.2 18L-4 -42Q-4 -68 2.5 -82Q5.5 -62 4.2 -42L4 18Z" fill="url(#' + u + 'st)"' + O(P, 1.1) + '/><path d="M1.6 16L1.4 -44Q1.8 -66 2.5 -78" fill="none" stroke="#fff" stroke-width=".7" opacity=".7"/>' +
        '<ellipse cx="0" cy="21" rx="10" ry="3.4" fill="' + P.b + '"' + O(P, 1) + '/><rect x="-3.6" y="24" width="7.2" height="38" rx="2" fill="' + P.a + '"' + O(P, 1) + '/>' +
        [0, 1, 2, 3, 4].map((i) => '<path d="M-3.4 ' + (28 + i * 7) + 'L3.4 ' + (31.5 + i * 7) + 'M3.4 ' + (28 + i * 7) + 'L-3.4 ' + (31.5 + i * 7) + '" stroke="' + P.c + '" stroke-width="1" opacity=".75"/>').join('') +
        '<rect x="-4.2" y="61" width="8.4" height="5" rx="2" fill="' + P.b + '"' + O(P, 1) + '/><path d="M3 64C10 68 12 74 8 78" fill="none" stroke="' + P.g + '" stroke-width="1.6" stroke-linecap="round"/>'
    }),
    espada: (P, u) => ({
      blade: 'M0 -84L8 -70V14H-8V-70Z', span: [-82, 12], w: 8,
      body: '<path d="M0 -84L8 -70V14H-8V-70Z" fill="url(#' + u + 'st)"' + O(P, 1.2) + '/><path d="M0 -76V10" stroke="' + P.d + '" stroke-width="1.6" opacity=".35"/><path d="M-4 -68V10" stroke="#fff" stroke-width=".8" opacity=".6"/>' +
        '<path d="M-24 14H24L20 22H-20Z" fill="url(#' + u + 'g)"' + O(P, 1.2) + '/><circle cx="0" cy="18" r="4" fill="' + P.g + '" stroke="#fff" stroke-width=".8"/>' +
        '<rect x="-4" y="22" width="8" height="34" rx="2" fill="' + P.d + '"/>' + [0, 1, 2, 3].map((i) => '<path d="M-4 ' + (26 + i * 8) + 'L4 ' + (30 + i * 8) + '" stroke="' + P.b + '" stroke-width="1.4"/>').join('') +
        '<circle cx="0" cy="61" r="6" fill="url(#' + u + 'g)"' + O(P, 1.2) + '/>'
    }),
    machado: (P, u) => ({
      blade: 'M2 -66C30 -76 44 -52 38 -18C30 -30 16 -32 2 -28Z', span: [-72, -20], w: 18, bx: 20,
      body: '<rect x="-4" y="-78" width="8" height="150" rx="3" fill="url(#' + u + 'w)"' + O(P, 1.1) + '/>' + [0, 1, 2].map((i) => '<rect x="-5" y="' + (30 + i * 12) + '" width="10" height="4" rx="1.4" fill="' + P.b + '"/>').join('') +
        '<path d="M2 -66C30 -76 44 -52 38 -18C30 -30 16 -32 2 -28Z" fill="url(#' + u + 'st)"' + O(P, 1.3) + '/><path d="M36 -60C42 -48 42 -32 38 -22" fill="none" stroke="#fff" stroke-width="1.4" opacity=".75"/>' +
        '<path d="M-2 -60C-14 -62 -20 -50 -18 -38C-12 -44 -6 -44 -2 -40Z" fill="url(#' + u + 'g)"' + O(P, 1.2) + '/><circle cx="0" cy="-48" r="5" fill="' + P.g + '" stroke="' + P.d + '"/>'
    }),
    foice: (P, u) => ({
      blade: 'M2 -80C-30 -90 -64 -74 -78 -46C-56 -62 -28 -68 2 -64Z', span: [-86, -50], w: 20, bx: -34,
      body: '<path d="M-3 -80C-1 -30 -6 20 -2 74L4 74C1 20 5 -30 3 -80Z" fill="url(#' + u + 'w)"' + O(P, 1.1) + '/>' +
        '<path d="M2 -80C-30 -90 -64 -74 -78 -46C-56 -62 -28 -68 2 -64Z" fill="url(#' + u + 'st)"' + O(P, 1.3) + '/><path d="M-4 -78C-30 -84 -56 -72 -72 -52" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/>' +
        '<rect x="-6" y="-86" width="12" height="12" rx="3" fill="' + P.a + '"' + O(P, 1) + '/><circle cx="0" cy="-80" r="3" fill="' + P.g + '"/>' +
        '<path d="M-2 10C-12 16 -14 26 -8 32" fill="none" stroke="' + P.b + '" stroke-width="2" stroke-linecap="round"/><path d="M-6 26L-12 40L-4 36Z" fill="' + P.b + '"/>'
    }),
    arco: (P, u) => ({
      blade: 'M-10 -78C30 -50 30 50 -10 78L-4 78C22 50 22 -50 -4 -78Z', span: [-76, 76], w: 6, bx: 12,
      body: '<path d="M-10 -78C30 -50 30 50 -10 78L-4 78C22 50 22 -50 -4 -78Z" fill="url(#' + u + 'g)"' + O(P, 1.2) + '/><path d="M-8 -78V78" stroke="' + P.c + '" stroke-width=".9" opacity=".9"/>' +
        '<rect x="11" y="-10" width="7" height="20" rx="2" fill="' + P.d + '"/><circle cx="-10" cy="-78" r="3" fill="' + P.g + '"/><circle cx="-10" cy="78" r="3" fill="' + P.g + '"/>' +
        '<path d="M-8 -60V74" stroke="#d6c7a1" stroke-width="2"/><path d="M-8 -70L-12 -58H-4Z" fill="url(#' + u + 'st)"' + O(P, .8) + '/><path d="M-8 66L-14 76M-8 66L-2 76M-8 60L-14 70M-8 60L-2 70" stroke="' + P.b + '" stroke-width="1.6"/>'
    }),
    pistola: (P, u) => ({
      blade: 'M-7 -70H7V-6H-7Z', span: [-70, -8], w: 7,
      body: '<path d="M-9 -72H9L11 -8H-11Z" fill="url(#' + u + 'g)"' + O(P, 1.3) + '/><rect x="-5" y="-66" width="10" height="50" rx="3" fill="' + P.d + '" opacity=".7"/>' +
        [0, 1, 2, 3].map((i) => '<rect class="wp-cell" style="--dl:' + (i * .25) + 's" x="-3" y="' + (-60 + i * 11) + '" width="6" height="7" rx="1.5" fill="' + P.g + '"/>').join('') +
        '<path d="M-11 -8H13L16 34C16 40 6 42 4 36L2 12H-11Z" fill="url(#' + u + 'g)"' + O(P, 1.3) + '/><path d="M-6 0C-14 4 -14 14 -8 16" fill="none" stroke="' + P.d + '" stroke-width="2"/>' +
        '<rect x="-3" y="-80" width="6" height="10" rx="2" fill="' + P.d + '"/><circle cx="0" cy="-80" r="3" fill="' + P.g + '" class="wp-muzzle"/>'
    }),
    rifle: (P, u) => ({
      blade: 'M-5 -82H5V-10H-5Z', span: [-82, -12], w: 5,
      body: '<rect x="-3" y="-90" width="6" height="16" rx="1.5" fill="' + P.d + '"/><circle class="wp-muzzle" cx="0" cy="-90" r="3" fill="' + P.g + '"/><path d="M-6 -76H6L8 20H-8Z" fill="url(#' + u + 'g)"' + O(P, 1.3) + '/>' +
        '<path d="M-3 -70V10" stroke="' + P.g + '" stroke-width="2" class="wp-strip"/><rect x="6" y="-44" width="12" height="26" rx="4" fill="' + P.d + '"' + O(P, 1) + '/><circle cx="12" cy="-44" r="4" fill="' + P.b + '" stroke="' + P.d + '"/>' +
        '<path d="M-8 20H8L12 70H-4Z" fill="' + P.a + '"' + O(P, 1.2) + '/><path d="M-8 0L-20 10L-16 26L-8 18Z" fill="' + P.b + '"' + O(P, 1.1) + '/><rect x="-18" y="-24" width="10" height="16" rx="2" fill="' + P.d + '"/>'
    }),
    martelo: (P, u) => ({
      blade: 'M-26 -86H26V-50H-26Z', span: [-86, -50], w: 26,
      body: '<rect x="-4" y="-56" width="8" height="128" rx="3" fill="url(#' + u + 'w)"' + O(P, 1.1) + '/>' + [0, 1, 2].map((i) => '<rect x="-5" y="' + (36 + i * 10) + '" width="10" height="4" rx="1.4" fill="' + P.b + '"/>').join('') +
        '<path d="M-26 -84H26V-52H-26Z" fill="url(#' + u + 'st)"' + O(P, 1.4) + '/><path d="M-30 -80H-26V-56H-30ZM26 -80H30V-56H26Z" fill="' + P.a + '"' + O(P, 1) + '/>' +
        '<path class="wp-rune" d="M-8 -76L0 -60L8 -76M-6 -64H6" fill="none" stroke="' + P.g + '" stroke-width="2.2" stroke-linecap="round"/><circle cx="0" cy="72" r="5" fill="' + P.a + '"' + O(P, 1) + '/>'
    }),
    lanca: (P, u) => ({
      blade: 'M0 -92C9 -76 9 -64 0 -54C-9 -64 -9 -76 0 -92Z', span: [-92, -54], w: 8,
      body: '<rect x="-2.8" y="-56" width="5.6" height="132" rx="2" fill="url(#' + u + 'w)"' + O(P, 1) + '/><path d="M0 -92C9 -76 9 -64 0 -54C-9 -64 -9 -76 0 -92Z" fill="url(#' + u + 'st)"' + O(P, 1.2) + '/>' +
        '<path d="M0 -88V-58" stroke="#fff" stroke-width=".8" opacity=".7"/><rect x="-5" y="-56" width="10" height="6" rx="2" fill="' + P.a + '"/>' +
        '<g class="wp-ribbon" style="transform-origin:0px -48px"><path d="M0 -50C10 -40 4 -26 14 -14C4 -18 -2 -30 -4 -40Z" fill="' + P.b + '"' + O(P, .8) + '/><path d="M0 -50C-10 -38 -6 -24 -14 -12C-2 -18 2 -32 2 -42Z" fill="' + P.a + '"' + O(P, .8) + '/></g>'
    }),
    cajado: (P, u) => ({
      blade: 'M0 -96A15 15 0 1 1 0 -66A15 15 0 1 1 0 -96Z', span: [-96, -66], w: 15, orb: true,
      body: '<path d="M-3 -64C-5 -20 -1 30 -4 74L4 74C1 30 5 -20 3 -64Z" fill="url(#' + u + 'w)"' + O(P, 1.1) + '/>' +
        '<path d="M-3 -62C-20 -70 -22 -92 -8 -100M3 -62C20 -70 22 -92 8 -100" fill="none" stroke="' + P.a + '" stroke-width="3" stroke-linecap="round"/>' +
        '<circle class="wp-orb" cx="0" cy="-81" r="12" fill="url(#' + u + 'o)"/><g class="wp-orbit" style="transform-origin:0px -81px"><ellipse cx="0" cy="-81" rx="19" ry="6" fill="none" stroke="' + P.c + '" stroke-width="1" opacity=".8"/><circle cx="19" cy="-81" r="2" fill="' + P.c + '"/></g>' +
        '<path d="M-4 -40H4M-4 -34H4" stroke="' + P.b + '" stroke-width="2"/>'
    }),
    tridente: (P, u) => ({
      blade: 'M-20 -92L-16 -58H16L20 -92L10 -66L6 -94H-6L-10 -66Z', span: [-94, -58], w: 18,
      body: '<rect x="-3" y="-60" width="6" height="134" rx="2" fill="url(#' + u + 'g)"' + O(P, 1) + '/>' +
        '<path d="M-20 -92L-16 -58H16L20 -92L10 -66L6 -94H-6L-10 -66Z" fill="url(#' + u + 'st)"' + O(P, 1.2) + '/><path d="M0 -104L6 -94H-6Z" fill="url(#' + u + 'st)"' + O(P, 1) + '/>' +
        '<circle cx="0" cy="-60" r="5" fill="' + P.g + '" stroke="' + P.d + '"/>'
    }),
    shuriken: (P, u) => ({
      blade: 'M0 -40L10 -10L40 0L10 10L0 40L-10 10L-40 0L-10 -10Z', span: [-40, 40], w: 40, spin: true,
      body: '<g class="wp-spin"><path d="M0 -40L10 -10L40 0L10 10L0 40L-10 10L-40 0L-10 -10Z" fill="url(#' + u + 'st)"' + O(P, 1.4) + '/><circle r="8" fill="' + P.a + '"' + O(P, 1.2) + '/><circle r="3" fill="' + P.d + '"/></g>'
    })
  };

  // efeitos da lâmina (no mesmo sistema de coordenadas da arma)
  const FX = {
    brilho: (P, u, w) => '<g clip-path="url(#' + u + 'cl)"><rect class="wp-shine" x="' + ((w.bx || 0) - 60) + '" y="' + (w.span[0] - 30) + '" width="16" height="44" fill="#fff" opacity=".8" transform="skewY(-35)"/></g>',
    energia: (P, u, w) => '<path class="wp-aura" d="' + w.blade + '" fill="none" stroke="' + P.g + '" stroke-width="7" stroke-linejoin="round" opacity=".55"/><path d="' + w.blade + '" fill="' + P.g + '" opacity=".22" class="wp-aura2"/>',
    particulas: (P, u, w, r) => { let s = ''; for (let i = 0; i < 10; i++) { const y = w.span[0] + r() * (w.span[1] - w.span[0]); s += '<circle class="wp-part" style="--dl:-' + (r() * 2.4).toFixed(2) + 's;--dx:' + ((r() - .5) * 18).toFixed(1) + 'px" cx="' + ((w.bx || 0) + (r() - .5) * w.w * 2).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1 + r() * 1.6).toFixed(1) + '" fill="' + (i % 2 ? P.g : P.c) + '"/>'; } return s; },
    fogo: (P, u, w, r) => { let s = '<defs>' + lin(u + 'fl', [[0, '#fff7ae'], [.4, '#ffb020'], [1, '#ff3d00', .1]], 0, 1) + '</defs>'; const n = 7; for (let i = 0; i < n; i++) { const y = w.span[0] + (i + .5) * (w.span[1] - w.span[0]) / n, side = i % 2 ? 1 : -1, x = (w.bx || 0) + side * (w.w * .7); s += '<path class="wp-flame" style="--dl:-' + (r() * 1).toFixed(2) + 's;transform-origin:' + x.toFixed(1) + 'px ' + (y + 6).toFixed(1) + 'px" d="M' + x.toFixed(1) + ' ' + (y + 6).toFixed(1) + 'C' + (x - 7).toFixed(1) + ' ' + (y - 2).toFixed(1) + ' ' + (x - 2).toFixed(1) + ' ' + (y - 10).toFixed(1) + ' ' + (x + side * 3).toFixed(1) + ' ' + (y - 18).toFixed(1) + 'C' + (x + 6).toFixed(1) + ' ' + (y - 8).toFixed(1) + ' ' + (x + 6).toFixed(1) + ' ' + y.toFixed(1) + ' ' + x.toFixed(1) + ' ' + (y + 6).toFixed(1) + 'Z" fill="url(#' + u + 'fl)"/>'; } return s; },
    gelo: (P, u, w, r) => { let s = ''; const n = 8; for (let i = 0; i < n; i++) { const y = w.span[0] + (i + .5) * (w.span[1] - w.span[0]) / n, side = i % 2 ? 1 : -1, x = (w.bx || 0) + side * w.w, h = 5 + r() * 6; s += '<path class="wp-frost" style="--dl:' + (i * .22).toFixed(2) + 's" d="M' + x.toFixed(1) + ' ' + (y - 3).toFixed(1) + 'L' + (x + side * h).toFixed(1) + ' ' + (y - 6).toFixed(1) + 'L' + x.toFixed(1) + ' ' + (y + 3).toFixed(1) + 'Z" fill="#e0f7ff" stroke="#7dd3fc" stroke-width=".6"/>'; } for (let i = 0; i < 5; i++) s += '<circle class="wp-mist" style="--dl:-' + (r() * 3).toFixed(2) + 's" cx="' + ((w.bx || 0) + (r() - .5) * 24).toFixed(1) + '" cy="' + (w.span[0] + r() * (w.span[1] - w.span[0])).toFixed(1) + '" r="' + (5 + r() * 5).toFixed(1) + '" fill="#bae6fd" opacity=".25"/>'; return s; },
    eletrico: (P, u, w, r) => { let s = ''; for (let k = 0; k < 3; k++) { let d = ''; const steps = 9; for (let i = 0; i <= steps; i++) { const y = w.span[0] + i * (w.span[1] - w.span[0]) / steps, x = (w.bx || 0) + (r() - .5) * w.w * 2.6; d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); } s += '<path class="wp-zap" style="--dl:' + (k * .23).toFixed(2) + 's" d="' + d + '" fill="none" stroke="' + (k ? P.c : P.g) + '" stroke-width="' + (k ? 1 : 1.8) + '" stroke-linejoin="round"/>'; } return s; },
    holo: (P, u, w) => '<defs><pattern id="' + u + 'hl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.4" fill="' + P.b + '" opacity=".75"/></pattern></defs>' +
      '<path class="wp-holo" d="' + w.blade + '" fill="url(#' + u + 'hl)"/><path class="wp-holo" d="' + w.blade + '" fill="none" stroke="' + P.b + '" stroke-width="1.4"/>',
    runas: (P, u, w, r) => { let s = ''; const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾ'; const n = 5; for (let i = 0; i < n; i++) { const y = w.span[0] + (i + .7) * (w.span[1] - w.span[0]) / (n + .4); s += '<text class="wp-rune" style="--dl:' + (i * .3).toFixed(2) + 's" x="' + (w.bx || 0) + '" y="' + y.toFixed(1) + '" text-anchor="middle" font-size="' + Math.max(6, Math.min(12, w.w * 1.3)).toFixed(1) + '" fill="' + P.g + '">' + glyphs.charAt(Math.floor(r() * glyphs.length)) + '</text>'; } return s; }
  };
  C.WEAPON_FX = Object.keys(FX);

  // posição nas costas: inclinação padrão e centro um pouco abaixo do meio
  function place(inner, rot, x, y, s) { return '<g transform="translate(' + (x || 50) + ' ' + (y || 52) + ') rotate(' + rot + ')' + (s ? ' scale(' + s + ')' : '') + '">' + inner + '</g>'; }
  Object.keys(W).forEach((k) => C.register('arma', k, (o) => {
    const P = o.P, u = o.u, d = o.d;
    const w = W[k](P, u);
    const fx = d.fx && FX[d.fx] ? '<g class="wp-fx wpfx-' + d.fx + '">' + FX[d.fx](P, u, w, C.rng((o.seed || k) + d.fx)) + '</g>' : '';
    const one = '<defs><clipPath id="' + u + 'cl"><path d="' + w.blade + '"/></clipPath></defs>' + w.body + fx;
    const rot = d.rot != null ? d.rot : (w.spin ? 0 : 38);
    const inner = w.spin ? place(one, 0, 96, 84, .7) + (d.dual ? place(one, 0, 4, 84, .7) : '')
      : d.dual ? place(one, -rot) + place(one, rot) : place(one, rot);
    return svg('-40 -40 180 180', wrap(u, P) + inner, 'wp wp-' + k + (d.fx ? ' wpfx-' + d.fx : '') + (o.still ? ' still' : ''));
  }));
})();
