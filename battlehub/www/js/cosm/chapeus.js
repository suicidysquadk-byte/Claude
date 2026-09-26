/* Chapéus (tipo chapeu) e acessórios de rosto desenhados (tipo acessorio com data.art).
   Coordenadas no espaço do avatar (0..100, centro 50,50); a caixa vai de -25,-45 a 125,105 para caber o que sobra
   para fora. Classes de animação: ht-spark, ht-shine, ht-energy, ht-halo, ht-flap, ht-led, ht-scan, ht-bob. */
(function () {
  const C = BH.cosm;
  const { lin, rad, svg, around } = C;
  const O = (P, w) => ' stroke="' + P.d + '" stroke-width="' + (w || 1.6) + '" stroke-linejoin="round"';
  const box = (o, kind, inner) => svg('-25 -45 150 150', inner, 'ht ht-' + o.d.art + ' ' + kind + (o.still ? ' still' : ''));
  const star = (x, y, s, cls, dl, fill) => '<path class="' + cls + '" style="--dl:' + (dl || 0) + 's" d="M' + x + ' ' + (y - s) + 'l' + s * .3 + ' ' + s * .7 + ' ' + s * .7 + ' ' + s * .3 + '-' + s * .7 + ' ' + s * .3 + '-' + s * .3 + ' ' + s * .7 + '-' + s * .3 + '-' + s * .7 + '-' + s * .7 + '-' + s * .3 + ' ' + s * .7 + '-' + s * .3 + 'Z" fill="' + (fill || '#fff') + '"/>';
  const gem = (x, y, s, c1) => '<path d="M' + x + ' ' + (y - s) + 'L' + (x + s * .75) + ' ' + y + 'L' + x + ' ' + (y + s) + 'L' + (x - s * .75) + ' ' + y + 'Z" fill="' + c1 + '" stroke="#fff" stroke-width=".6"/>';

  const HATS = {
    bone: (P, u) => '<path d="M14 26C14 2 30 -10 50 -10C70 -10 86 2 86 26Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M86 22C100 22 112 26 114 32C104 34 92 32 84 28Z" fill="' + P.b + '"' + O(P) + '/>' +
      '<path d="M50 -10V26M30 -4L34 26M70 -4L66 26" stroke="' + P.d + '" stroke-width=".8" opacity=".4"/><circle cx="50" cy="-10" r="3" fill="' + P.b + '"/><path d="M36 12H64" stroke="' + P.c + '" stroke-width="4" stroke-linecap="round" opacity=".7"/>',
    fedora: (P, u) => '<ellipse cx="50" cy="18" rx="50" ry="10" fill="' + P.a + '"' + O(P) + '/><path d="M24 18C22 0 30 -20 50 -20C70 -20 78 0 76 18Z" fill="url(#' + u + 'g)"' + O(P) + '/>' +
      '<path d="M50 -20C46 -12 46 -6 50 0C54 -6 54 -12 50 -20Z" fill="' + P.d + '" opacity=".35"/><path d="M24 10H76V16H24Z" fill="' + P.b + '"/><path d="M60 10L64 4L68 10" fill="' + P.c + '"/>',
    touca: (P, u) => '<path d="M16 24C14 0 30 -14 50 -14C70 -14 86 0 84 24Z" fill="url(#' + u + 'g)"' + O(P) + '/>' + [0, 1, 2, 3, 4, 5, 6].map((i) => '<path d="M' + (24 + i * 9) + ' -8V22" stroke="' + P.d + '" stroke-width="1" opacity=".25"/>').join('') +
      '<rect x="12" y="16" width="76" height="14" rx="7" fill="' + P.b + '"' + O(P) + '/>' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path d="M' + (18 + i * 9) + ' 18V28" stroke="' + P.d + '" stroke-width="1.2" opacity=".35"/>').join('') +
      '<g class="ht-bob" style="transform-origin:50px -14px"><circle cx="50" cy="-20" r="9" fill="' + P.c + '"' + O(P, 1.2) + '/></g>',
    capuz: (P, u) => '<path d="M2 90C-6 50 6 -12 50 -14C94 -12 106 50 98 90L86 94C92 56 82 10 50 8C18 10 8 56 14 94Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M14 94C8 56 18 10 50 8C82 10 92 56 86 94" fill="none" stroke="' + P.d + '" stroke-width="3" opacity=".5"/>' +
      '<path d="M50 -14C46 -4 46 2 50 8" stroke="' + P.d + '" stroke-width="1" opacity=".4"/>',
    coroa: (P, u) => '<defs>' + lin(u + 'cr', [[0, '#fffbe6'], [.35, '#ffd766'], [.7, '#c9901e'], [1, '#6b4308']]) + '</defs>' +
      '<path d="M16 22L10 -18L32 2L50 -26L68 2L90 -18L84 22Z" fill="url(#' + u + 'cr)" stroke="#6b4308" stroke-width="1.8" stroke-linejoin="round"/><rect x="14" y="16" width="72" height="12" rx="4" fill="url(#' + u + 'cr)" stroke="#6b4308" stroke-width="1.4"/>' +
      gem(50, -8, 7, P.a) + gem(30, 22, 4, P.b) + gem(50, 22, 4.4, P.a) + gem(70, 22, 4, P.b) + '<circle cx="10" cy="-18" r="3.6" fill="#fffbe6"/><circle cx="90" cy="-18" r="3.6" fill="#fffbe6"/><circle cx="50" cy="-26" r="4" fill="#fffbe6"/>' +
      '<rect class="ht-shine" x="-10" y="-30" width="10" height="64" fill="#fff" opacity=".45" transform="skewX(-20)"/>' +
      star(18, -24, 4, 'ht-spark', 0) + star(82, -28, 3.4, 'ht-spark', .7) + star(96, 6, 3, 'ht-spark', 1.3) + star(4, 4, 3, 'ht-spark', 1.8),
    tiara: (P, u) => '<path d="M14 26C24 12 76 12 86 26" fill="none" stroke="url(#' + u + 'g)" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M30 16L34 6L38 14L44 2L50 -8L56 2L62 14L66 6L70 16" fill="none" stroke="url(#' + u + 'g)" stroke-width="3" stroke-linejoin="round"/>' + gem(50, 2, 5, P.a) + '<circle cx="34" cy="6" r="2" fill="' + P.c + '"/><circle cx="66" cy="6" r="2" fill="' + P.c + '"/>' + star(50, -16, 3.4, 'ht-spark', .4),
    chifres: (P, u) => '<defs>' + rad(u + 'en', [[0, P.g, .9], [1, P.g, 0]]) + '</defs>' +
      [false, true].map((f) => '<g transform="' + (f ? 'translate(100 0) scale(-1 1)' : '') + '"><circle class="ht-energy" cx="10" cy="-22" r="16" fill="url(#' + u + 'en)"/>' +
        '<path d="M26 16C18 6 10 -6 12 -26C20 -18 28 -8 36 8Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M16 -16C20 -8 26 0 30 8" fill="none" stroke="' + P.c + '" stroke-width="1" opacity=".7"/>' +
        [0, 1, 2].map((i) => '<circle class="ht-rise" style="--dl:-' + i * .7 + 's" cx="' + (12 + i * 3) + '" cy="-24" r="1.6" fill="' + P.g + '"/>').join('') + '</g>').join(''),
    'orelhas-gato': (P, u) => [false, true].map((f) => '<g transform="' + (f ? 'translate(100 0) scale(-1 1)' : '') + '"><g class="ht-flap" style="transform-origin:26px 14px"><path d="M12 22L16 -14L42 8Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M18 14L20 -4L34 8Z" fill="#ffb3c7"/></g></g>').join(''),
    'orelhas-coelho': (P, u) => [false, true].map((f) => '<g transform="' + (f ? 'translate(100 0) scale(-1 1)' : '') + '"><g class="ht-flap" style="transform-origin:34px 14px"><ellipse cx="32" cy="-16" rx="9" ry="28" fill="url(#' + u + 'g)"' + O(P) + ' transform="rotate(-12 32 -16)"/><ellipse cx="32" cy="-14" rx="4.4" ry="20" fill="#ffc6d6" transform="rotate(-12 32 -14)"/></g></g>').join('') +
      '<path d="M18 14C30 6 70 6 82 14" fill="none" stroke="' + P.a + '" stroke-width="4" stroke-linecap="round"/>',
    halo: (P, u) => '<defs>' + rad(u + 'hl', [[0, P.g, .6], [1, P.g, 0]]) + '</defs><ellipse cx="50" cy="-18" rx="40" ry="14" fill="url(#' + u + 'hl)"/>' +
      '<ellipse cx="50" cy="-18" rx="30" ry="8" fill="none" stroke="' + P.c + '" stroke-width="4"/><ellipse class="ht-halo" cx="50" cy="-18" rx="30" ry="8" fill="none" stroke="' + P.g + '" stroke-width="4" stroke-dasharray="20 168" stroke-linecap="round"/>',
    bandana: (P, u) => '<path d="M8 22C24 12 76 12 92 22L92 34C76 24 24 24 8 34Z" fill="url(#' + u + 'g)"' + O(P) + '/>' + [20, 36, 52, 68, 84].map((x) => '<circle cx="' + x + '" cy="26" r="1.6" fill="' + P.c + '" opacity=".7"/>').join('') +
      '<g class="ht-flap" style="transform-origin:94px 28px"><path d="M92 26C104 22 112 30 114 40C106 38 100 34 94 32Z M92 30C100 36 104 46 102 54C96 48 94 40 92 34Z" fill="' + P.a + '"' + O(P, 1.2) + '/></g>',
    capacete: (P, u) => '<path d="M8 40C6 8 26 -12 50 -12C74 -12 94 8 92 40L84 42C84 18 70 6 50 6C30 6 16 18 16 42Z" fill="url(#' + u + 'g)"' + O(P) + '/>' +
      '<path d="M16 26H84V36H16Z" fill="' + P.d + '"/><rect class="ht-scan" x="16" y="28" width="14" height="6" fill="' + P.g + '" opacity=".85"/><circle class="ht-led" cx="80" cy="-2" r="3" fill="' + P.g + '"/><path d="M50 -12V6" stroke="' + P.d + '" stroke-width="1" opacity=".4"/>',
    kabuto: (P, u) => '<defs>' + lin(u + 'kg', [[0, '#fffbe6'], [.5, '#e5b64a'], [1, '#7a5a1c']]) + '</defs>' +
      '<path d="M26 12L8 -34L38 4Z M74 12L92 -34L62 4Z" fill="url(#' + u + 'kg)" stroke="#5b3a06" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M4 38C4 6 24 -10 50 -10C76 -10 96 6 96 38L84 40C84 16 70 8 50 8C30 8 16 16 16 40Z" fill="url(#' + u + 'g)"' + O(P) + '/>' +
      '<path d="M2 38L-8 50L16 44M98 38L108 50L84 44" fill="' + P.a + '"' + O(P, 1.2) + '/><circle cx="50" cy="0" r="6" fill="url(#' + u + 'kg)" stroke="#5b3a06" stroke-width="1.2"/><rect class="ht-shine" x="0" y="-36" width="8" height="50" fill="#fff" opacity=".35" transform="skewX(-20)"/>',
    bruxa: (P, u) => '<ellipse cx="50" cy="20" rx="52" ry="10" fill="' + P.d + '"' + O(P) + '/><path d="M22 20C30 -4 40 -30 64 -42C60 -30 56 -26 66 -18C74 -4 76 8 78 20Z" fill="url(#' + u + 'g)"' + O(P) + '/>' +
      '<path d="M24 12H78V20H22Z" fill="' + P.b + '"/><rect x="44" y="11" width="10" height="10" rx="1" fill="none" stroke="' + P.c + '" stroke-width="1.6"/>' + star(40, -8, 3, 'ht-spark', 0, P.c) + star(58, -22, 2.4, 'ht-spark', .9, P.c),
    'gorro-natal': (P, u) => '<g class="ht-bob" style="transform-origin:70px 0px"><path d="M16 22C18 -4 40 -18 62 -14C80 -10 94 4 100 24C92 12 84 10 80 14C74 -2 56 -2 50 8Z" fill="url(#' + u + 'g)"' + O(P) + '/><circle cx="100" cy="26" r="8" fill="#fff"' + O(P, 1) + '/></g>' +
      '<rect x="10" y="16" width="80" height="14" rx="7" fill="#fff"' + O(P, 1.2) + '/>' + [18, 30, 44, 58, 72, 84].map((x) => '<circle cx="' + x + '" cy="23" r="2.4" fill="#e5e7eb"/>').join(''),
    fones: (P, u) => '<path d="M6 60C0 14 22 -10 50 -10C78 -10 100 14 94 60" fill="none" stroke="url(#' + u + 'g)" stroke-width="7" stroke-linecap="round"/>' +
      [false, true].map((f) => '<g transform="' + (f ? 'translate(100 0) scale(-1 1)' : '') + '"><rect x="-6" y="44" width="18" height="30" rx="8" fill="' + P.d + '"' + O(P) + '/><rect class="ht-led" x="-4" y="48" width="4" height="22" rx="2" fill="' + P.g + '"/></g>').join('') +
      '<path d="M12 70C18 84 28 88 36 88" fill="none" stroke="' + P.d + '" stroke-width="2"/><circle cx="37" cy="88" r="3" fill="' + P.a + '"/>'
  };

  const FACE = {
    oculos: (P) => '<circle cx="33" cy="42" r="12" fill="' + P.c + '" fill-opacity=".18" stroke="' + P.a + '" stroke-width="3"/><circle cx="67" cy="42" r="12" fill="' + P.c + '" fill-opacity=".18" stroke="' + P.a + '" stroke-width="3"/>' +
      '<path d="M45 42C48 39 52 39 55 42M21 40L6 36M79 40L94 36" fill="none" stroke="' + P.a + '" stroke-width="3" stroke-linecap="round"/><path d="M26 36L30 32" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>',
    'oculos-sol': (P, u) => '<defs>' + lin(u + 'ls', [[0, P.b], [1, P.d]], 0, 1) + '</defs><path d="M18 36H46C46 50 40 56 32 56C24 56 18 50 18 36ZM54 36H82C82 50 76 56 68 56C60 56 54 50 54 36Z" fill="url(#' + u + 'ls)" stroke="' + P.a + '" stroke-width="2"/>' +
      '<path d="M46 38H54M18 36L6 34M82 36L94 34" stroke="' + P.a + '" stroke-width="2.6" stroke-linecap="round"/><rect class="ht-shine" x="10" y="30" width="6" height="30" fill="#fff" opacity=".5" transform="skewX(-20)"/>',
    visor: (P, u) => '<defs>' + lin(u + 'vs', [[0, P.g, .9], [1, P.a, .6]], 1, 0) + '</defs><path d="M8 34C20 28 80 28 92 34L90 50C78 56 22 56 10 50Z" fill="url(#' + u + 'vs)" stroke="' + P.c + '" stroke-width="1.6"/>' +
      '<rect class="ht-scan" x="12" y="34" width="10" height="16" fill="#fff" opacity=".55"/><path d="M14 42H86" stroke="#fff" stroke-width=".6" opacity=".5"/><circle class="ht-led" cx="86" cy="36" r="2" fill="#fff"/>',
    'mascara-ninja': (P, u) => '<path d="M8 56C20 50 80 50 92 56L90 86C76 100 24 100 10 86Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M20 64C34 60 66 60 80 64M18 74C34 70 66 70 82 74" fill="none" stroke="' + P.d + '" stroke-width="1" opacity=".5"/>',
    'mascara-cyber': (P) => '<path d="M14 58C26 52 74 52 86 58L82 84C70 92 30 92 18 84Z" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="2"/>' +
      [0, 1, 2, 3, 4, 5].map((i) => '<rect class="ht-led" style="--dl:' + (i * .2) + 's" x="' + (28 + i * 8) + '" y="68" width="5" height="' + (4 + (i % 3) * 3) + '" rx="1" fill="' + P.g + '"/>').join('') + '<path d="M14 58L4 54M86 58L96 54" stroke="' + P.a + '" stroke-width="2"/>',
    'mascara-caveira': (P) => '<path d="M50 16C24 16 14 34 16 50C17 60 22 64 26 66V80H74V66C78 64 83 60 84 50C86 34 76 16 50 16Z" fill="#f5f5f4" stroke="#1c1917" stroke-width="1.6"/>' +
      '<ellipse cx="36" cy="46" rx="9" ry="10" fill="#1c1917"/><ellipse cx="64" cy="46" rx="9" ry="10" fill="#1c1917"/><circle class="ht-led" cx="36" cy="47" r="3" fill="' + P.g + '"/><circle class="ht-led" cx="64" cy="47" r="3" fill="' + P.g + '"/>' +
      '<path d="M50 56L46 64H54Z" fill="#1c1917"/><path d="M36 80V72M43 80V72M50 80V72M57 80V72M64 80V72" stroke="#1c1917" stroke-width="1.4"/>',
    'tapa-olho': (P) => '<path d="M4 20L96 58" stroke="' + P.d + '" stroke-width="2.4"/><ellipse cx="66" cy="44" rx="13" ry="11" fill="' + P.d + '" stroke="' + P.a + '" stroke-width="1.6"/><path d="M60 40L72 48M72 40L60 48" stroke="' + P.a + '" stroke-width="1.4"/>',
    'mascara-gas': (P, u) => '<path d="M22 50C22 40 78 40 78 50L74 80C66 92 34 92 26 80Z" fill="url(#' + u + 'g)"' + O(P) + '/><circle cx="50" cy="76" r="10" fill="' + P.d + '" stroke="' + P.c + '" stroke-width="1.4"/>' +
      [0, 1, 2].map((i) => '<path d="M' + (44 + i * 6) + ' 70V82" stroke="' + P.c + '" stroke-width="1.2"/>').join('') + '<circle cx="22" cy="68" r="7" fill="' + P.b + '"' + O(P, 1) + '/><circle cx="78" cy="68" r="7" fill="' + P.b + '"' + O(P, 1) + '/>' +
      '<circle class="ht-rise" cx="50" cy="66" r="2" fill="' + P.g + '"/>'
  };

  const defs = (P, u) => '<defs>' + lin(u + 'g', [[0, P.c], [.4, P.b], [1, P.a]]) + '</defs>';
  Object.keys(HATS).forEach((k) => C.register('chapeu', k, (o) => box(o, 'hat', defs(o.P, o.u) + HATS[k](o.P, o.u))));
  Object.keys(FACE).forEach((k) => C.register('acessorio', k, (o) => box(o, 'face', defs(o.P, o.u) + FACE[k](o.P, o.u))));
})();
