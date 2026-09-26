/* Molduras de avatar desenhadas em SVG (sem imagens de terceiros), da Comum à Lendária.
   Caixa 200x200, avatar no centro com raio 62. As partes animadas usam classes .fr-* (css/molduras.css);
   na grade da loja e em listas pequenas tudo fica parado. */
window.BH = window.BH || {};
(function () {
  let uid = 0;
  const P = (n) => Math.round(n * 100) / 100;
  const pol = (cx, cy, r, a) => [P(cx + r * Math.cos((a - 90) * Math.PI / 180)), P(cy + r * Math.sin((a - 90) * Math.PI / 180))];
  // n itens em volta do círculo
  const around = (n, fn, off) => { let s = ''; for (let i = 0; i < n; i++) s += fn((360 / n) * i + (off || 0), i); return s; };
  const grad = (id, stops, x2, y2) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 1 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' + stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
  const rgrad = (id, stops) => '<radialGradient id="' + id + '">' + stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</radialGradient>';
  const ring = (r, stroke, w, extra) => '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '"' + (extra || '') + '/>';
  // pedra lapidada (losango com brilho)
  const gem = (x, y, s, c1, c2, rot) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ')"><path d="M0 ' + (-s) + 'L' + P(s * .72) + ' 0L0 ' + s + 'L' + P(-s * .72) + ' 0Z" fill="' + c1 + '" stroke="#fff6d8" stroke-width=".8"/>' +
    '<path d="M0 ' + (-s) + 'L' + P(s * .72) + ' 0L0 0Z" fill="' + c2 + '" opacity=".75"/><circle cx="' + P(-s * .2) + '" cy="' + P(-s * .35) + '" r="' + P(s * .16) + '" fill="#fff" opacity=".9"/></g>';
  // pena (asa)
  const feather = (x, y, len, w, rot, fill) => '<path transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')" d="M0 0C' + P(w) + ' ' + P(-len * .3) + ' ' + P(w * .6) + ' ' + P(-len * .8) + ' 0 ' + (-len) + 'C' + P(-w * .6) + ' ' + P(-len * .8) + ' ' + P(-w) + ' ' + P(-len * .3) + ' 0 0Z" fill="' + fill + '"/>';

  // camadas de fundo (raios, asas, caudas) não cobrem a foto
  const M = (u) => ' mask="url(#' + u + 'm)"';
  const F = {
    /* ---------- Comum / Raro: desenho limpo, parado ---------- */
    aco: (u) => '<defs>' + grad(u + 'a', [[0, '#f4f6f8'], [.45, '#8b95a1'], [.55, '#5b6470'], [1, '#e1e6ea']]) + '</defs>' +
      ring(68, 'url(#' + u + 'a)', 7) + ring(76, '#3a4048', 2) + around(8, (a) => { const p = pol(100, 100, 68, a); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="#2b3036" stroke="#cfd5db" stroke-width="1"/>'; }),

    esmeralda: (u) => '<defs>' + grad(u + 'g', [[0, '#fff1bf'], [.5, '#c9a24d'], [1, '#7a5a1c']]) + '</defs>' +
      ring(68, 'url(#' + u + 'g)', 5) + ring(74, '#c9a24d', 1, ' opacity=".6"') +
      around(4, (a) => { const p = pol(100, 100, 70, a); return gem(p[0], p[1], 9, '#0f9d58', '#6ee7b7', a); }) +
      around(12, (a) => { const p = pol(100, 100, 70, a); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.6" fill="#fff1bf"/>'; }, 15),

    safira: (u) => '<defs>' + grad(u + 's', [[0, '#ffffff'], [.5, '#aeb8c4'], [1, '#5f6b78']]) + '</defs>' +
      ring(68, 'url(#' + u + 's)', 5) + around(12, (a) => { const p = pol(100, 100, 69, a); return gem(p[0], p[1], 5.5, '#1d4ed8', '#93c5fd', a); }),

    /* ---------- Épico: efeitos animados ---------- */
    circuito: (u) => '<defs>' + grad(u + 'c', [[0, '#22d3ee'], [1, '#a855f7']]) + '</defs>' +
      '<g class="fr-glow" style="--gc:#22d3ee">' + ring(67, 'url(#' + u + 'c)', 3) + '</g>' +
      '<g class="fr-spin">' + ring(76, '#22d3ee', 2.5, ' stroke-dasharray="18 10 4 10" stroke-linecap="round"') + '</g>' +
      '<g class="fr-spin rev slow">' + ring(84, '#a855f7', 1.5, ' stroke-dasharray="2 8" opacity=".8"') + '</g>' +
      around(6, (a) => { const p = pol(100, 100, 76, a), q = pol(100, 100, 90, a + 8); return '<path d="M' + p[0] + ' ' + p[1] + 'L' + q[0] + ' ' + q[1] + '" stroke="#22d3ee" stroke-width="1.5"/><circle class="fr-blink" style="--dl:' + (a / 360).toFixed(2) + 's" cx="' + q[0] + '" cy="' + q[1] + '" r="3" fill="#e0fbff"/>'; }),

    chamas: (u) => '<defs>' + grad(u + 'f', [[0, '#fff3b0'], [.35, '#ffb020'], [.75, '#ff4d00'], [1, '#b3001b', 0]], 0, 1) + rgrad(u + 'h', [[.6, '#ff6a00', 0], [.8, '#ff6a00', .45], [1, '#ff6a00', 0]]) + '</defs>' +
      '<circle cx="100" cy="100" r="92" fill="url(#' + u + 'h)"/>' +
      around(14, (a, i) => '<g transform="rotate(' + a + ' 100 100)"><path class="fr-flick" style="--dl:-' + ((i * .23) % 1).toFixed(2) + 's" d="M100 34C92 22 96 10 101 2C104 12 110 16 108 26C107 30 104 33 100 34Z" fill="url(#' + u + 'f)"/></g>') +
      ring(66, '#ff8a00', 4) + ring(66, '#fff0a0', 1.2, ' opacity=".9"'),

    gelo: (u) => '<defs>' + grad(u + 'i', [[0, '#ffffff'], [.5, '#9be7ff'], [1, '#2b7fb8']]) + '</defs>' +
      ring(67, 'url(#' + u + 'i)', 5) +
      around(10, (a, i) => { const l = i % 2 ? 16 : 26; return '<path transform="rotate(' + a + ' 100 100)" d="M96 34L100 ' + (34 - l) + 'L104 34Z" fill="url(#' + u + 'i)" stroke="#e6fbff" stroke-width=".6" opacity=".95"/>'; }) +
      around(20, (a) => { const p = pol(100, 100, 74, a); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.3" fill="#fff"/>'; }, 9) +
      '<g class="fr-spin slow"><path d="M100 30A70 70 0 0 1 150 51" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/></g>',

    raio: (u) => '<defs>' + grad(u + 'r', [[0, '#f5d0fe'], [1, '#7c3aed']]) + '</defs>' +
      '<g class="fr-glow" style="--gc:#a855f7">' + ring(67, 'url(#' + u + 'r)', 4) + '</g>' +
      around(5, (a, i) => '<path class="fr-zap" style="--dl:' + (i * .37).toFixed(2) + 's" transform="rotate(' + a + ' 100 100)" d="M100 32L94 20L103 18L96 4" fill="none" stroke="#f5d0fe" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>') +
      '<g class="fr-spin">' + ring(78, '#c084fc', 1.2, ' stroke-dasharray="1 6" stroke-linecap="round"') + '</g>',

    sakura: (u) => '<defs>' + grad(u + 'k', [[0, '#5a2e1c'], [1, '#2b140c']]) + '</defs>' +
      ring(66, '#ffd1e4', 3) + '<path d="M28 132C40 170 90 186 136 172" fill="none" stroke="url(#' + u + 'k)" stroke-width="5" stroke-linecap="round"/>' +
      [[34, 146], [52, 166], [78, 176], [108, 176], [132, 170], [44, 158]].map((p, i) => '<g transform="translate(' + p[0] + ' ' + p[1] + ') rotate(' + (i * 40) + ')">' + around(5, (a) => '<ellipse transform="rotate(' + a + ')" cx="0" cy="-5" rx="3.4" ry="5.4" fill="#ffb7d5" stroke="#ff7ab2" stroke-width=".5"/>') + '<circle r="2" fill="#ffe066"/></g>').join('') +
      '<g class="fr-spin slow">' + around(6, (a) => { const p = pol(100, 100, 84, a); return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="2.6" ry="4" fill="#ffc6de" transform="rotate(' + a + ' ' + p[0] + ' ' + p[1] + ')"/>'; }) + '</g>',

    /* ---------- Mítico: desenho premium + efeitos ---------- */
    asas: (u) => {
      const wing = (flip) => '<g transform="' + (flip ? 'translate(200 0) scale(-1 1)' : '') + '"' + M(u) + '><g class="fr-float">' +
        [0, 1, 2, 3, 4, 5, 6].map((i) => feather(46 - i, 96 + i * 5, 72 - i * 6, 13 - i, -28 - i * 12, 'url(#' + u + 'w)')).join('') +
        [0, 1, 2, 3, 4].map((i) => feather(50 - i, 104 + i * 5, 46 - i * 5, 8 - i * .8, -24 - i * 13, 'url(#' + u + 'w2)')).join('') + '</g></g>';
      return '<defs>' + grad(u + 'w', [[0, '#fff7d6'], [.5, '#f0c75e'], [1, '#a8741a']]) + grad(u + 'w2', [[0, '#ffffff'], [1, '#e8c270']]) + grad(u + 'g', [[0, '#fff1bf'], [.5, '#c9a24d'], [1, '#7a5a1c']]) + '</defs>' +
        wing(false) + wing(true) + '<ellipse class="fr-pulse" cx="100" cy="24" rx="30" ry="7" fill="none" stroke="#ffe7a0" stroke-width="3"/>' + ring(67, 'url(#' + u + 'g)', 5) + ring(62.5, '#fff1bf', 1);
    },

    coroa: (u) => '<defs>' + grad(u + 'g', [[0, '#fff1bf'], [.45, '#e5b64a'], [1, '#8a5a12']]) + rgrad(u + 'l', [[0, '#fff5cc', .9], [1, '#fff5cc', 0]]) + '</defs>' +
      '<g' + M(u) + '><g class="fr-spin slower" opacity=".55">' + around(16, (a) => '<path transform="rotate(' + a + ' 100 100)" d="M97 100L100 4L103 100Z" fill="url(#' + u + 'l)"/>') + '</g></g>' +
      // louros
      [false, true].map((fl) => '<g' + M(u) + '><g transform="' + (fl ? 'translate(200 0) scale(-1 1)' : '') + '"><path d="M58 158C40 140 34 112 40 88" fill="none" stroke="#7a5a1c" stroke-width="2.5"/>' +
        [0, 1, 2, 3, 4, 5].map((i) => { const y = 156 - i * 12, x = 56 - i * 3.4 + (i > 3 ? i : 0); return '<ellipse cx="' + P(x - 7) + '" cy="' + y + '" rx="8" ry="3.6" transform="rotate(' + (-35 - i * 8) + ' ' + P(x - 7) + ' ' + y + ')" fill="url(#' + u + 'g)"/><ellipse cx="' + P(x + 4) + '" cy="' + (y - 4) + '" rx="7" ry="3.2" transform="rotate(' + (30 - i * 6) + ' ' + P(x + 4) + ' ' + (y - 4) + ')" fill="#d9a93f"/>'; }).join('') + '</g></g>').join('') +
      ring(67, 'url(#' + u + 'g)', 6) + ring(67, '#fff1bf', 1, ' stroke-dasharray="2 5"') +
      '<g transform="translate(100 38)"><path d="M-34 0L-40 -30L-20 -14L0 -38L20 -14L40 -30L34 0Z" fill="url(#' + u + 'g)" stroke="#7a5a1c" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<rect x="-35" y="-4" width="70" height="9" rx="3" fill="url(#' + u + 'g)" stroke="#7a5a1c" stroke-width="1.2"/>' + gem(0, -24, 6, '#c1121f', '#ff8fa3') + gem(-22, 0, 4, '#1d4ed8', '#93c5fd') + gem(22, 0, 4, '#1d4ed8', '#93c5fd') + gem(0, 0.5, 4.5, '#0f9d58', '#6ee7b7') +
      '<circle cx="-40" cy="-30" r="3" fill="#fff1bf"/><circle cx="40" cy="-30" r="3" fill="#fff1bf"/><circle cx="0" cy="-38" r="3.4" fill="#fff1bf"/></g>' +
      '<path class="fr-twinkle" d="M150 40l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fff"/>',

    dragao: (u) => '<defs>' + grad(u + 'd', [[0, '#fff1bf'], [.4, '#e5b64a'], [1, '#7a4a0c']]) + grad(u + 'b', [[0, '#3b0d0d'], [1, '#8b1e1e']]) + '</defs>' +
      ring(66, '#5a3a0c', 5) +
      '<path d="M100 172C58 172 28 142 28 100C28 58 58 28 100 28C136 28 160 50 168 76" fill="none" stroke="url(#' + u + 'd)" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M100 172C58 172 28 142 28 100C28 58 58 28 100 28C136 28 160 50 168 76" fill="none" stroke="#7a4a0c" stroke-width="13" stroke-dasharray="3 5" stroke-linecap="round" opacity=".55"/>' +
      '<path d="M100 172C58 172 28 142 28 100C28 58 58 28 100 28" fill="none" stroke="#ffdf8a" stroke-width="2" stroke-dasharray="1 9" transform="translate(0 -5)" opacity=".8"/>' +
      // cauda
      '<path d="M100 172C120 172 140 166 152 156L162 166L160 150" fill="none" stroke="url(#' + u + 'd)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
      // cabeça
      '<g transform="translate(166 78) rotate(20)"><path d="M-10 -8C0 -20 18 -18 26 -6L34 -8L28 2L34 8L22 8C14 16 -2 14 -10 6Z" fill="url(#' + u + 'd)" stroke="#7a4a0c" stroke-width="1.4"/>' +
      '<path d="M-4 -12L-14 -26M4 -15L0 -30" stroke="#e5b64a" stroke-width="3" stroke-linecap="round"/><circle class="fr-blink" cx="10" cy="-4" r="2.6" fill="#ff3b30"/><path d="M22 8C26 14 20 18 16 14" fill="none" stroke="#7a4a0c" stroke-width="1.4"/></g>' +
      around(4, (a) => { const p = pol(100, 100, 72, a + 20); return '<path d="M' + p[0] + ' ' + p[1] + 'l-4 -7l4 3l4 -3Z" fill="#e5b64a"/>'; }),

    cyber: (u) => {
      const pts = []; for (let i = 0; i < 6; i++) pts.push(pol(100, 100, 82, i * 60 + 30).join(','));
      return '<defs>' + grad(u + 'c', [[0, '#39ff14'], [1, '#00e5ff']]) + '</defs>' +
        '<polygon points="' + pts.join(' ') + '" fill="rgba(0,229,255,.06)" stroke="url(#' + u + 'c)" stroke-width="2.5"/>' +
        '<g class="fr-glow" style="--gc:#00e5ff">' + ring(67, '#00e5ff', 2) + '</g>' +
        '<g class="fr-spin">' + '<path d="M100 26A74 74 0 0 1 164 63" fill="none" stroke="#39ff14" stroke-width="4" stroke-linecap="round"/>' + '<path d="M100 174A74 74 0 0 1 36 137" fill="none" stroke="#39ff14" stroke-width="4" stroke-linecap="round"/></g>' +
        around(36, (a, i) => { const p = pol(100, 100, 72, a), q = pol(100, 100, i % 3 ? 75 : 78, a); return '<path d="M' + p[0] + ' ' + p[1] + 'L' + q[0] + ' ' + q[1] + '" stroke="#00e5ff" stroke-width="1" opacity=".7"/>'; }) +
        [[26, 26, 1, 1], [174, 26, -1, 1], [26, 174, 1, -1], [174, 174, -1, -1]].map((c) => '<path d="M' + c[0] + ' ' + (c[1] + 14 * c[3]) + 'V' + c[1] + 'H' + (c[0] + 14 * c[2]) + '" fill="none" stroke="#39ff14" stroke-width="3"/>').join('') +
        '<text x="100" y="192" text-anchor="middle" font-family="monospace" font-size="9" fill="#39ff14" letter-spacing="2" class="fr-blink">ONLINE</text>';
    },

    kitsune: (u) => '<defs>' + grad(u + 't', [[0, '#ffffff'], [.4, '#9ad8ff'], [1, '#1e40af', .2]], 0, 1) + '</defs>' +
      '<g' + M(u) + '><g class="fr-sway">' + [-80, -60, -40, -20, 0, 20, 40, 60, 80].map((a) => '<path transform="rotate(' + a + ' 100 100)" d="M100 62C88 40 90 16 104 2C108 22 114 36 108 60Z" fill="url(#' + u + 't)" stroke="#dff3ff" stroke-width=".8" opacity=".92"/>').join('') + '</g></g>' +
      ring(67, '#dff3ff', 4) + '<g class="fr-spin slow">' + around(3, (a) => { const p = pol(100, 100, 80, a); return '<path d="M' + p[0] + ' ' + (p[1] + 5) + 'c-4-6 0-12 4-14-1 4 2 6 1 10-1 3-3 4-5 4Z" fill="#7cc8ff"/>'; }) + '</g>',

    /* ---------- Lendário: várias camadas, partículas e brilho ---------- */
    fenix: (u) => {
      const wing = (fl) => '<g transform="' + (fl ? 'translate(200 0) scale(-1 1)' : '') + '"' + M(u) + '><g class="fr-float">' +
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => feather(44 - i, 94 + i * 5, 80 - i * 7, 13 - i, -22 - i * 12, 'url(#' + u + 'f)')).join('') +
        [0, 1, 2, 3, 4].map((i) => feather(48 - i, 104 + i * 5, 50 - i * 6, 7 - i * .6, -20 - i * 14, '#fff2a8')).join('') + '</g></g>';
      return '<defs>' + grad(u + 'f', [[0, '#fff6b0'], [.3, '#ffb020'], [.7, '#ff3d00'], [1, '#7a0010']], 0, 1) + rgrad(u + 'h', [[.55, '#ff5a00', 0], [.8, '#ff5a00', .5], [1, '#ff5a00', 0]]) + grad(u + 'r', [[0, '#fff6b0'], [.5, '#ff8a00'], [1, '#c1121f']]) + '</defs>' +
        '<circle cx="100" cy="100" r="95" fill="url(#' + u + 'h)" class="fr-pulse"' + M(u) + '/>' + wing(false) + wing(true) +
        // cauda
        [-24, -8, 8, 24].map((a) => '<path transform="rotate(' + a + ' 100 160)" d="M100 160C94 176 96 190 100 199C104 190 106 176 100 160Z" fill="url(#' + u + 'f)"/>').join('') +
        '<g class="fr-spin">' + around(18, (a, i) => '<path transform="rotate(' + a + ' 100 100)" d="M100 31C96 25 98 19 101 15C102 20 105 22 104 27C103 29 102 30 100 31Z" fill="' + (i % 2 ? '#ffb020' : '#ff5a00') + '"/>') + '</g>' +
        ring(67, 'url(#' + u + 'r)', 5) + ring(62.5, '#fff6b0', 1.2) +
        // crista
        '<g transform="translate(100 30)"><path d="M0 4C-8 -6 -6 -16 0 -24C6 -16 8 -6 0 4Z" fill="url(#' + u + 'f)"/><path d="M-10 6C-18 0 -18 -10 -14 -16C-10 -8 -6 -4 -6 4Z" fill="#ff8a00"/><path d="M10 6C18 0 18 -10 14 -16C10 -8 6 -4 6 4Z" fill="#ff8a00"/></g>' +
        around(10, (a, i) => { const p = pol(100, 100, 50 + (i % 3) * 16, a * 1.7 + 11); return '<circle class="fr-ember" style="--dl:-' + (i * .31).toFixed(2) + 's" cx="' + p[0] + '" cy="' + P(p[1] + 40) + '" r="' + (1.2 + (i % 3) * .6) + '" fill="#ffd166"/>'; });
    },

    rei: (u) => '<defs>' + grad(u + 'g', [[0, '#fffbe6'], [.3, '#ffd766'], [.6, '#c9901e'], [1, '#6b4308']]) + rgrad(u + 'l', [[0, '#fff5cc', .95], [1, '#fff5cc', 0]]) + rgrad(u + 'h', [[.6, '#ffd766', 0], [.82, '#ffd766', .4], [1, '#ffd766', 0]]) + '</defs>' +
      '<circle cx="100" cy="100" r="96" fill="url(#' + u + 'h)" class="fr-pulse"/>' +
      '<g' + M(u) + '><g class="fr-spin slower">' + around(24, (a, i) => '<path transform="rotate(' + a + ' 100 100)" d="M' + (i % 2 ? 98.5 : 97) + ' 100L100 ' + (i % 2 ? 14 : 2) + 'L' + (i % 2 ? 101.5 : 103) + ' 100Z" fill="url(#' + u + 'l)" opacity=".7"/>') + '</g></g>' +
      [false, true].map((fl) => '<g transform="' + (fl ? 'translate(200 0) scale(-1 1)' : '') + '">' + [0, 1, 2, 3, 4, 5, 6].map((i) => { const a = 200 - i * 17, p = pol(100, 100, 80, a); return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="10" ry="4.2" transform="rotate(' + (a + 60) + ' ' + p[0] + ' ' + p[1] + ')" fill="url(#' + u + 'g)" stroke="#6b4308" stroke-width=".6"/>'; }).join('') + '</g>').join('') +
      ring(68, 'url(#' + u + 'g)', 8) + ring(68, '#6b4308', 1, ' stroke-dasharray="1 3"') + ring(63.5, '#fffbe6', 1.2) +
      around(8, (a, i) => { const p = pol(100, 100, 68, a + 22.5); return gem(p[0], p[1], 4.4, i % 2 ? '#c1121f' : '#1d4ed8', i % 2 ? '#ff8fa3' : '#93c5fd', a); }) +
      '<g transform="translate(100 34) scale(1.12)"><path d="M-36 2L-44 -32L-22 -14L0 -42L22 -14L44 -32L36 2Z" fill="url(#' + u + 'g)" stroke="#6b4308" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M-28 -6L-22 -14M0 -30L0 -42M28 -6L22 -14" stroke="#fffbe6" stroke-width="1.2" opacity=".7"/>' +
      '<rect x="-37" y="-3" width="74" height="10" rx="3" fill="url(#' + u + 'g)" stroke="#6b4308" stroke-width="1.3"/>' + gem(0, -26, 7, '#c1121f', '#ff8fa3') + gem(-24, 2, 4.4, '#0f9d58', '#6ee7b7') + gem(24, 2, 4.4, '#0f9d58', '#6ee7b7') + gem(0, 2, 4.4, '#1d4ed8', '#93c5fd') +
      '<circle cx="-44" cy="-32" r="3.6" fill="#fffbe6"/><circle cx="44" cy="-32" r="3.6" fill="#fffbe6"/><circle cx="0" cy="-42" r="4" fill="#fffbe6"/></g>' +
      [[152, 44, 0], [40, 60, .6], [166, 132, 1.1], [34, 142, 1.6]].map((s) => '<path class="fr-twinkle" style="--dl:' + s[2] + 's" d="M' + s[0] + ' ' + s[1] + 'l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fff"/>').join(''),

    abismo: (u) => '<defs><linearGradient id="' + u + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#7c3aed"/><stop offset="1" stop-color="#db2777"/></linearGradient>' + rgrad(u + 'h', [[.6, '#7c3aed', 0], [.82, '#7c3aed', .45], [1, '#7c3aed', 0]]) + rgrad(u + 'p', [[0, '#fff'], [.5, '#fbbf24'], [1, '#b45309']]) + '</defs>' +
      '<circle cx="100" cy="100" r="96" fill="url(#' + u + 'h)" class="fr-pulse"/>' +
      '<g class="fr-spin rev slow">' + ring(84, 'url(#' + u + 'a)', 1.2, ' stroke-dasharray="3 5"') + around(12, (a) => { const p = pol(100, 100, 84, a); return '<text x="' + p[0] + '" y="' + P(p[1] + 3) + '" text-anchor="middle" font-size="8" fill="#e9d5ff" transform="rotate(' + a + ' ' + p[0] + ' ' + p[1] + ')">' + '᚛ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'.charAt(1 + (a / 30) % 12) + '</text>'; }) + '</g>' +
      ring(68, 'url(#' + u + 'a)', 6) + ring(63.5, '#f5f3ff', 1) +
      '<g class="fr-spin">' + '<circle cx="100" cy="24" r="7" fill="url(#' + u + 'p)"/><ellipse cx="100" cy="24" rx="12" ry="3" fill="none" stroke="#fde68a" stroke-width="1.2" transform="rotate(-20 100 24)"/>' + '</g>' +
      '<g class="fr-spin rev">' + '<circle cx="100" cy="178" r="4.5" fill="#67e8f9"/><circle cx="100" cy="178" r="7" fill="none" stroke="#67e8f9" stroke-width=".8" opacity=".6"/>' + '</g>' +
      around(14, (a, i) => { const p = pol(100, 100, 74 + (i % 3) * 7, a + i * 7); return '<circle class="fr-twinkle" style="--dl:' + ((i * .29) % 2).toFixed(2) + 's" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 4 ? 1 : 1.8) + '" fill="#fff"/>'; }),

    sombras: (u) => '<defs>' + rgrad(u + 's', [[.55, '#1a0b2e', 0], [.75, '#2e1065', .85], [1, '#000', 0]]) + grad(u + 'r', [[0, '#ff4d6d'], [1, '#7f1d1d']]) + '</defs>' +
      '<circle cx="100" cy="100" r="96" fill="url(#' + u + 's)"/>' +
      '<g class="fr-spin slow">' + around(7, (a) => '<path transform="rotate(' + a + ' 100 100)" d="M100 30C80 26 70 12 76 0C86 10 98 10 106 18C110 24 106 30 100 30Z" fill="#2e1065" opacity=".85"/>') + '</g>' +
      '<g class="fr-spin rev">' + around(7, (a) => '<path transform="rotate(' + a + ' 100 100)" d="M100 32C90 28 86 20 90 12C94 18 100 20 104 24C106 28 104 31 100 32Z" fill="#5b21b6" opacity=".9"/>', 25) + '</g>' +
      '<g class="fr-glow" style="--gc:#ff4d6d">' + ring(67, 'url(#' + u + 'r)', 4) + '</g>' +
      '<g class="fr-spin slower">' + around(16, (a) => { const p = pol(100, 100, 76, a); return '<text x="' + p[0] + '" y="' + P(p[1] + 3) + '" text-anchor="middle" font-size="7.5" fill="#ff4d6d" transform="rotate(' + a + ' ' + p[0] + ' ' + p[1] + ')">' + 'ᛟᛞᛗᛚᛜᛝᛏᛒ'.charAt((a / 22.5) % 8) + '</text>'; }) + '</g>' +
      '<g transform="translate(100 176)"><ellipse class="fr-blink" cx="-9" cy="0" rx="4" ry="2" fill="#ff1f3d"/><ellipse class="fr-blink" cx="9" cy="0" rx="4" ry="2" fill="#ff1f3d"/></g>',

    /* ---------- recompensas de sinergia ---------- */
    laco: (u) => '<defs>' + grad(u + 'c', [[0, '#ff8fa3'], [.5, '#b91c1c'], [1, '#450a0a']]) + '</defs>' + ring(66, '#450a0a', 3) +
      around(18, (a, i) => { const p = pol(100, 100, 74, a); return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="' + (i % 2 ? 7 : 3.4) + '" ry="' + (i % 2 ? 3.4 : 7) + '" fill="none" stroke="url(#' + u + 'c)" stroke-width="2.6" transform="rotate(' + a + ' ' + p[0] + ' ' + p[1] + ')"/>'; }),

    sinergia: (u) => '<defs>' + grad(u + 'g', [[0, '#fffbe6'], [.5, '#e5b64a'], [1, '#7a5a1c']]) + '</defs>' +
      '<g class="fr-spin"><ellipse cx="100" cy="100" rx="82" ry="70" fill="none" stroke="url(#' + u + 'g)" stroke-width="4"/></g>' +
      '<g class="fr-spin rev"><ellipse cx="100" cy="100" rx="70" ry="82" fill="none" stroke="url(#' + u + 'g)" stroke-width="4"/></g>' +
      ring(66, 'url(#' + u + 'g)', 4) + around(4, (a, i) => '<path class="fr-twinkle" style="--dl:' + (i * .5) + 's" transform="rotate(' + a + ' 100 100)" d="M100 6l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fff"/>')
  };

  // moldura em volta do avatar; parada = sem animação (loja, listas)
  function frame(key, still) {
    const fn = F[key];
    if (!fn) return '';
    const u = 'fr' + (++uid) + '-';
    return '<svg class="fr fr-' + key + (still ? ' still' : '') + '" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<defs><mask id="' + u + 'm"><rect width="200" height="200" fill="#fff"/><circle cx="100" cy="100" r="61" fill="#000"/></mask></defs>' + fn(u) + '</svg>';
  }
  BH.cos = BH.cos || {};
  BH.cos.frame = frame;
  BH.cos.FRAME_KEYS = Object.keys(F);
})();
