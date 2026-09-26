/* Avatares vivos (caixa 100x100, cortados em círculo). Cada um respira (ab-breathe), pisca (ab-blink) e tem partes
   próprias que se mexem: cabelo e roupa ao vento (ab-hair, ab-cloth), olhos que brilham (ab-glow), fumaça (ab-smoke),
   partículas (ab-part), chamas (ab-flame), neve e pétalas (ab-fall), luz de tela (ab-flick). A paleta pinta a roupa. */
(function () {
  const C = BH.cosm;
  const { lin, svg } = C;
  const SK = { l: ['#f6d2b4', '#dfae8a'], m: ['#d59b73', '#b0774f'], e: ['#9a6446', '#744630'], p: ['#eae6f0', '#c7c0d4'], g: ['#9be58a', '#5fae52'] };
  const O = (c, w) => ' stroke="' + c + '" stroke-width="' + (w || 1.2) + '" stroke-linejoin="round"';
  const bgd = (u, top, bot) => '<radialGradient id="' + u + 'bg" cx="50%" cy="32%" r="75%"><stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bot + '"/></radialGradient>';
  // luz de estúdio: auréola atrás da cabeça, sombra nas bordas (parece um disco) e um brilho em cima
  const base = (u, P, inner, top) => '<defs>' + bgd(u, top || P.a, P.d) + lin(u + 'cl', [[0, P.b], [1, P.a]], 0, 1) + lin(u + 'dk', [[0, P.a], [1, P.d]], 0, 1) +
    '<radialGradient id="' + u + 'hl" cx="50%" cy="40%" r="42%"><stop offset="0" stop-color="' + P.c + '" stop-opacity=".55"/><stop offset="1" stop-color="' + P.c + '" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="' + u + 'ed" cx="50%" cy="46%" r="54%"><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>' +
    '<linearGradient id="' + u + 'gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '</defs><rect width="100" height="100" fill="url(#' + u + 'bg)"/><circle cx="50" cy="40" r="42" fill="url(#' + u + 'hl)"/>' + inner +
    '<rect width="100" height="100" fill="url(#' + u + 'ed)" pointer-events="none"/><ellipse cx="50" cy="18" rx="38" ry="20" fill="url(#' + u + 'gl)" pointer-events="none"/>';
  const breathe = (inner) => '<g class="ab-breathe" style="transform-origin:50px 100px">' + inner + '</g>';
  const body = (fill, line) => '<path d="M6 104C8 82 26 72 50 72C74 72 92 82 94 104Z" fill="' + fill + '"' + O(line || '#0006') + '/>';
  const neck = (s) => '<path d="M43 58H57V74C54 77 46 77 43 74Z" fill="' + s[1] + '"/>';
  const head = (s, rx, ry) => '<ellipse cx="50" cy="44" rx="' + (rx || 16) + '" ry="' + (ry || 19) + '" fill="' + s[0] + '"' + O('#0003', .8) + '/>';
  const ears = (s) => '<ellipse cx="34" cy="46" rx="3" ry="5" fill="' + s[1] + '"/><ellipse cx="66" cy="46" rx="3" ry="5" fill="' + s[1] + '"/>';
  const eyes = (y, col, glow, gap) => { const g = gap || 6.4; return '<g class="ab-blink" style="transform-origin:50px ' + y + 'px">' +
    (glow ? '<ellipse class="ab-glow" cx="' + (50 - g) + '" cy="' + y + '" rx="4.6" ry="3.4" fill="' + col + '" opacity=".35"/><ellipse class="ab-glow" cx="' + (50 + g) + '" cy="' + y + '" rx="4.6" ry="3.4" fill="' + col + '" opacity=".35"/>' : '') +
    '<ellipse cx="' + (50 - g) + '" cy="' + y + '" rx="2.6" ry="' + (glow ? 1.8 : 2.4) + '" fill="' + (glow ? col : '#fff') + '"/><ellipse cx="' + (50 + g) + '" cy="' + y + '" rx="2.6" ry="' + (glow ? 1.8 : 2.4) + '" fill="' + (glow ? col : '#fff') + '"/>' +
    (glow ? '' : '<g class="ab-look"><circle cx="' + (50 - g) + '" cy="' + (y + .3) + '" r="1.5" fill="' + col + '"/><circle cx="' + (50 + g) + '" cy="' + (y + .3) + '" r="1.5" fill="' + col + '"/><circle cx="' + (50 - g - .5) + '" cy="' + (y - .5) + '" r=".5" fill="#fff"/><circle cx="' + (50 + g - .5) + '" cy="' + (y - .5) + '" r=".5" fill="#fff"/></g>') + '</g>'; };
  const brows = (y, c) => '<path d="M40 ' + y + 'L47 ' + (y - 1) + 'M53 ' + (y - 1) + 'L60 ' + y + '" stroke="' + (c || '#3b2412') + '" stroke-width="1.6" stroke-linecap="round"/>';
  const mouth = (y, c) => '<path d="M46 ' + y + 'C48 ' + (y + 1.6) + ' 52 ' + (y + 1.6) + ' 54 ' + y + '" fill="none" stroke="' + (c || '#8a4a3a') + '" stroke-width="1.2" stroke-linecap="round"/>';
  const parts = (seed, n, fn) => { const r = C.rng(seed); let s = ''; for (let i = 0; i < n; i++) s += fn(r, i); return s; };
  const dots = (seed, n, fill, cls, y0, y1) => parts(seed, n, (r, i) => '<circle class="' + (cls || 'ab-part') + '" style="--dl:-' + (r() * 4).toFixed(2) + 's;--dx:' + ((r() - .5) * 14).toFixed(1) + 'px" cx="' + (6 + r() * 88).toFixed(1) + '" cy="' + ((y0 || 60) + r() * ((y1 || 100) - (y0 || 60))).toFixed(1) + '" r="' + (.6 + r() * 1.3).toFixed(1) + '" fill="' + (Array.isArray(fill) ? fill[i % fill.length] : fill) + '"/>');
  const wrap = (o, inner) => svg('0 0 100 100', inner, 'ab ab-' + o.d.art + (o.still ? ' still' : ''));

  const A = {
    ninja: (o) => { const P = o.P, u = o.u, s = SK.m; return wrap(o, base(u, P,
      '<circle cx="74" cy="24" r="14" fill="' + P.c + '" opacity=".22"/>' + parts('nj', 6, (r) => '<path class="ab-fall" style="--dl:-' + (r() * 6).toFixed(2) + 's;--dx:' + ((r() - .5) * 30).toFixed(0) + 'px" d="M' + (r() * 100).toFixed(0) + ' -6c3 -2 6 0 4 3c-2 2 -5 1 -4 -3Z" fill="' + P.b + '" opacity=".7"/>') +
      breathe(body('url(#' + u + 'dk)') + '<path d="M36 74L50 92L64 74" fill="none" stroke="' + P.b + '" stroke-width="2.4"/>' + neck(s) +
        '<g class="ab-cloth" style="transform-origin:64px 34px"><path d="M64 34C76 34 84 40 90 48C82 44 76 44 70 42C78 48 80 54 84 60C74 54 70 46 64 40Z" fill="' + P.b + '"' + O('#0005') + '/></g>' +
        '<path d="M33 46C31 26 40 23 50 23C60 23 69 26 67 46C67 58 60 64 50 64C40 64 33 58 33 46Z" fill="url(#' + u + 'dk)"' + O('#0006') + '/>' +
        '<path d="M34 40H66V50H34Z" fill="' + s[0] + '"/><path d="M33 32H67V37H33Z" fill="' + P.b + '"/><circle cx="50" cy="34.5" r="2" fill="' + P.c + '"/>' +
        eyes(45, '#111') + '<path d="M40 41L46 42.5M60 41L54 42.5" stroke="#111" stroke-width="1.4" stroke-linecap="round"/>'))); },

    samurai: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      parts('sm', 7, (r) => '<ellipse class="ab-fall" style="--dl:-' + (r() * 7).toFixed(2) + 's;--dx:' + ((r() - .5) * 40).toFixed(0) + 'px" cx="' + (r() * 100).toFixed(0) + '" cy="-4" rx="2.2" ry="1.3" fill="#fbcfe8"/>') +
      breathe(body('url(#' + u + 'dk)') + [0, 1, 2].map((i) => '<path d="M' + (10 + i * 2) + ' ' + (88 - i * 7) + 'Q30 ' + (80 - i * 7) + ' 36 ' + (86 - i * 6) + '" fill="none" stroke="' + P.c + '" stroke-width="1.3" opacity=".6"/><path d="M' + (90 - i * 2) + ' ' + (88 - i * 7) + 'Q70 ' + (80 - i * 7) + ' 64 ' + (86 - i * 6) + '" fill="none" stroke="' + P.c + '" stroke-width="1.3" opacity=".6"/>').join('') +
        neck(s) + head(s) + '<path d="M36 52C38 62 46 66 50 66C54 66 62 62 64 52L60 50H40Z" fill="' + P.a + '"' + O('#0006') + '/><path d="M42 56H58M44 60H56" stroke="' + P.d + '" stroke-width="1"/>' +
        '<path d="M28 36C28 18 40 14 50 14C60 14 72 18 72 36L78 44L66 40H34L22 44Z" fill="url(#' + u + 'dk)"' + O('#0007') + '/>' +
        '<path d="M50 16L38 -2L46 14ZM50 16L62 -2L54 14Z" fill="#f6c453"' + O('#6b4308', .8) + '/><circle cx="50" cy="20" r="3.4" fill="#f6c453" stroke="#6b4308" stroke-width=".8"/>' +
        eyes(46, '#111') + brows(41.5, '#111')))); },

    cyborg: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      '<g opacity=".25" stroke="' + P.g + '" stroke-width=".6">' + [0, 1, 2, 3, 4, 5].map((i) => '<path d="M0 ' + (10 + i * 16) + 'H100"/>').join('') + '</g>' +
      breathe(body('url(#' + u + 'dk)') + '<path d="M50 74V100M40 80L30 100M60 80L70 100" stroke="' + P.g + '" stroke-width="1" class="ab-glow"/>' + neck(s) + head(s) +
        '<path d="M50 25C60 25 66 32 66 44C66 56 60 63 50 63Z" fill="#9ca3af"' + O('#374151', 1) + '/><path d="M52 30H62M52 36H64M52 52H63M55 58H60" stroke="#4b5563" stroke-width="1"/>' +
        '<g class="ab-hair" style="transform-origin:50px 26px"><path d="M32 40C30 22 42 18 50 18C58 18 68 20 68 34L62 26L58 32L54 24L50 30L44 24L40 32L36 28Z" fill="' + P.d + '"/></g>' +
        '<g class="ab-blink" style="transform-origin:50px 45px"><ellipse cx="43.6" cy="45" rx="2.6" ry="2.4" fill="#fff"/><circle class="ab-look" cx="43.6" cy="45.3" r="1.5" fill="#1f2937"/>' +
        '<circle cx="56.4" cy="45" r="4" fill="#111"/><circle class="ab-glow" cx="56.4" cy="45" r="2.6" fill="' + P.g + '"/></g><path class="ab-scan" d="M52 40H66" stroke="' + P.g + '" stroke-width=".8" opacity=".8"/>' + mouth(55)))); },

    astronauta: (o) => { const P = o.P, u = o.u, s = SK.m; return wrap(o, base(u, P,
      dots('as', 14, ['#fff', P.c], 'ab-twinkle', 0, 100) +
      breathe(body('#e5e7eb') + '<rect x="30" y="80" width="14" height="9" rx="2" fill="' + P.a + '"/><circle cx="64" cy="84" r="4" fill="' + P.g + '" class="ab-led"/><path d="M26 78C34 74 66 74 74 78" fill="none" stroke="#9ca3af" stroke-width="3"/>' +
        '<circle cx="50" cy="44" r="27" fill="#f3f4f6"' + O('#9ca3af', 1.4) + '/>' + '<defs>' + lin(u + 'vz', [[0, P.b], [.6, P.a], [1, P.d]], 1, 1) + '</defs>' +
        '<path d="M28 44C28 30 38 24 50 24C62 24 72 30 72 44C72 56 62 62 50 62C38 62 28 56 28 44Z" fill="url(#' + u + 'vz)"/>' +
        '<g opacity=".55">' + head(s, 12, 14).replace('cy="44"', 'cy="46"') + eyes(46, '#111', false, 5) + '</g>' +
        '<path class="ab-shine" d="M34 34C38 28 46 26 52 27" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/><circle cx="64" cy="54" r="2" fill="#fff" opacity=".6"/>')));
    },

    demonio: (o) => { const P = o.P, u = o.u, s = ['#e0584c', '#b43a31']; return wrap(o, base(u, P,
      parts('dm', 5, (r) => '<ellipse class="ab-smoke" style="--dl:-' + (r() * 4).toFixed(2) + 's" cx="' + (10 + r() * 80).toFixed(0) + '" cy="96" rx="10" ry="6" fill="' + P.d + '" opacity=".6"/>') +
      '<g class="ab-flame" style="transform-origin:50px 100px"><path d="M0 100C10 86 14 92 20 80C24 92 30 84 34 90C40 78 46 88 50 76C54 88 60 78 66 90C70 84 76 92 80 80C86 92 90 86 100 100Z" fill="' + P.g + '" opacity=".55"/></g>' +
      breathe(body('url(#' + u + 'dk)') + neck(s) + head(s) +
        '<path d="M36 32C28 26 24 14 28 4C32 14 38 20 42 26Z M64 32C72 26 76 14 72 4C68 14 62 20 58 26Z" fill="#1c1917"' + O('#000', .8) + '/>' +
        '<path d="M34 34C34 24 42 21 50 21C58 21 66 24 66 34C60 28 54 30 50 26C46 30 40 28 34 34Z" fill="#1c1917"/>' +
        eyes(45, '#fde047', true) + '<path d="M40 40L47 43M60 40L53 43" stroke="#1c1917" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M44 55C47 57 53 57 56 55" fill="none" stroke="#450a0a" stroke-width="1.3"/><path d="M46 55.6L47 58L48 56ZM54 55.6L53 58L52 56Z" fill="#fff"/>'))); },

    anjo: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      '<g class="ab-rays" style="transform-origin:50px 40px">' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path transform="rotate(' + (i * 45) + ' 50 40)" d="M48 40L50 -20L52 40Z" fill="#fff" opacity=".12"/>').join('') + '</g>' +
      '<g class="ab-wing" style="transform-origin:34px 74px"><path d="M34 74C18 60 4 62 0 72C8 72 6 80 2 84C10 82 12 88 10 94C20 88 26 86 34 82Z" fill="#fff"' + O('#d6d3d1') + '/></g>' +
      '<g class="ab-wing r" style="transform-origin:66px 74px"><path d="M66 74C82 60 96 62 100 72C92 72 94 80 98 84C90 82 88 88 90 94C80 88 74 86 66 82Z" fill="#fff"' + O('#d6d3d1') + '/></g>' +
      breathe(body('#fafaf9') + '<path d="M40 74L50 86L60 74" fill="none" stroke="' + P.b + '" stroke-width="2"/>' + neck(s) +
        '<g class="ab-hair" style="transform-origin:50px 24px"><path d="M30 50C26 26 38 20 50 20C62 20 74 26 70 50C68 60 66 64 64 70L60 44H40L36 70C34 64 32 60 30 50Z" fill="#fcd34d"' + O('#b45309', .8) + '/></g>' + head(s, 15, 18) +
        '<path d="M35 38C38 26 62 26 65 38C60 32 54 30 50 34C46 30 40 32 35 38Z" fill="#fcd34d"/>' + eyes(45, '#1d4ed8') + mouth(55) +
        '<g class="ab-halo" style="transform-origin:50px 14px"><ellipse cx="50" cy="14" rx="15" ry="4" fill="none" stroke="#fde68a" stroke-width="2.4"/><ellipse class="ab-glow" cx="50" cy="14" rx="15" ry="4" fill="none" stroke="#fff" stroke-width="5" opacity=".3"/></g>'))); },

    cavaleiro: (o) => { const P = o.P, u = o.u; return wrap(o, base(u, P,
      breathe('<g class="ab-cloth" style="transform-origin:50px 16px"><path d="M50 18C56 6 70 2 82 8C74 10 70 14 68 20C76 18 82 22 84 28C74 24 64 24 56 26Z" fill="' + P.b + '"' + O('#0006') + '/></g>' +
        body('#9ca3af', '#374151') + '<path d="M14 88C18 78 30 76 36 80L32 100H12Z M86 88C82 78 70 76 64 80L68 100H88Z" fill="#d1d5db"' + O('#374151') + '/><path d="M44 78H56L54 100H46Z" fill="' + P.a + '"/>' +
        '<path d="M30 46C30 24 38 16 50 16C62 16 70 24 70 46C70 58 64 66 50 66C36 66 30 58 30 46Z" fill="url(#' + u + 'mt)"' + O('#374151', 1.2) + '/>' +
        '<defs>' + lin(u + 'mt', [[0, '#f9fafb'], [.5, '#9ca3af'], [1, '#4b5563']], 1, 0) + '</defs>' +
        '<path d="M34 42H66V47H34Z" fill="#111827"/><path class="ab-glow" d="M37 44.5H47M53 44.5H63" stroke="' + P.g + '" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M50 18V66M42 52V60M46 52V61M54 52V61M58 52V60" stroke="#4b5563" stroke-width="1"/>'))); },

    mago: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      dots('mg', 12, [P.g, P.c, '#fff'], 'ab-part', 50, 100) +
      breathe(body('url(#' + u + 'dk)') + '<path d="M50 72V100" stroke="' + P.c + '" stroke-width="1.4" stroke-dasharray="2 3"/>' + neck(s) + head(s, 15, 17) +
        '<g class="ab-hair" style="transform-origin:50px 52px"><path d="M36 50C36 62 42 80 50 86C58 80 64 62 64 50C58 56 42 56 36 50Z" fill="#e5e7eb"' + O('#9ca3af', .8) + '/></g>' +
        '<path d="M40 52C44 50 56 50 60 52" fill="none" stroke="#e5e7eb" stroke-width="3" stroke-linecap="round"/>' + eyes(44, P.g, true, 6) +
        '<path d="M24 34C34 30 66 30 76 34C70 38 30 38 24 34Z" fill="url(#' + u + 'dk)"' + O('#0007') + '/>' +
        '<g class="ab-hat" style="transform-origin:50px 34px"><path d="M30 34C38 20 46 4 62 -4C58 8 60 18 70 34Z" fill="url(#' + u + 'dk)"' + O('#0007') + '/>' +
        '<path class="ab-twinkle" d="M52 16l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4Z" fill="' + P.c + '"/><circle class="ab-twinkle" style="--dl:.6s" cx="60" cy="24" r="1.2" fill="' + P.c + '"/></g>'))); },

    caveira: (o) => { const P = o.P, u = o.u; return wrap(o, base(u, P,
      parts('cv', 5, (r) => '<ellipse class="ab-smoke" style="--dl:-' + (r() * 4).toFixed(2) + 's" cx="' + (10 + r() * 80).toFixed(0) + '" cy="92" rx="12" ry="7" fill="' + P.g + '" opacity=".3"/>') +
      breathe(body('url(#' + u + 'dk)') + '<path d="M22 100C22 60 30 20 50 18C70 20 78 60 78 100Z" fill="' + P.d + '"' + O('#000') + '/>' +
        '<path d="M50 24C38 24 34 32 34 42C34 50 38 54 40 56V62H60V56C62 54 66 50 66 42C66 32 62 24 50 24Z" fill="#f5f5f4"' + O('#a8a29e', .8) + '/>' +
        '<ellipse cx="43" cy="43" rx="5" ry="5.6" fill="#0c0a09"/><ellipse cx="57" cy="43" rx="5" ry="5.6" fill="#0c0a09"/>' +
        '<g class="ab-blink" style="transform-origin:50px 43px"><circle class="ab-glow" cx="43" cy="43" r="2.2" fill="' + P.g + '"/><circle class="ab-glow" cx="57" cy="43" r="2.2" fill="' + P.g + '"/></g>' +
        '<path d="M50 49L47.6 53H52.4Z" fill="#0c0a09"/><path d="M44 62V58M48 62V58M52 62V58M56 62V58" stroke="#0c0a09" stroke-width="1"/>'))); },

    robo: (o) => { const P = o.P, u = o.u; return wrap(o, base(u, P,
      breathe(body('url(#' + u + 'cl)') + '<rect x="40" y="80" width="20" height="12" rx="3" fill="' + P.d + '"/><rect class="ab-led" x="43" y="84" width="4" height="4" fill="' + P.g + '"/><rect class="ab-led" style="--dl:.4s" x="53" y="84" width="4" height="4" fill="' + P.c + '"/>' +
        '<rect x="46" y="60" width="8" height="14" fill="#6b7280"/><path d="M50 22V10" stroke="#9ca3af" stroke-width="2"/><circle class="ab-led" cx="50" cy="9" r="3" fill="' + P.g + '"/>' +
        '<g class="ab-spin" style="transform-origin:28px 44px"><circle cx="28" cy="44" r="5" fill="#9ca3af" stroke="#4b5563" stroke-dasharray="2 1.4" stroke-width="2"/></g><g class="ab-spin" style="transform-origin:72px 44px"><circle cx="72" cy="44" r="5" fill="#9ca3af" stroke="#4b5563" stroke-dasharray="2 1.4" stroke-width="2"/></g>' +
        '<rect x="30" y="22" width="40" height="40" rx="9" fill="url(#' + u + 'cl)"' + O(P.d, 1.4) + '/><rect x="35" y="30" width="30" height="22" rx="5" fill="#0b1220"/>' +
        '<g class="ab-blink" style="transform-origin:50px 40px"><rect x="39" y="36" width="7" height="7" rx="1.5" fill="' + P.g + '"/><rect x="54" y="36" width="7" height="7" rx="1.5" fill="' + P.g + '"/></g><path d="M43 48H57" stroke="' + P.g + '" stroke-width="1.6" stroke-dasharray="2 1.5"/>'))); },

    gamer: (o) => { const P = o.P, u = o.u, s = SK.e; return wrap(o, base(u, P,
      '<rect class="ab-flick" x="0" y="0" width="100" height="100" fill="' + P.b + '" opacity=".12"/>' +
      breathe(body('url(#' + u + 'dk)') + '<path d="M36 74C36 84 42 90 50 90C58 90 64 84 64 74" fill="none" stroke="' + P.d + '" stroke-width="3"/><path d="M44 80V92M56 80V92" stroke="' + P.c + '" stroke-width="1.4"/>' +
        neck(s) + ears(s) + head(s) + '<g class="ab-hair" style="transform-origin:50px 26px"><path d="M33 40C31 22 42 19 50 19C60 19 70 22 67 40C64 30 58 28 50 30C44 28 38 30 33 40Z" fill="#111"/></g>' +
        eyes(46, '#111') + brows(41) + mouth(55) +
        '<path d="M31 46C31 26 40 20 50 20C60 20 69 26 69 46" fill="none" stroke="#1f2937" stroke-width="4"/>' +
        '<rect x="26" y="40" width="9" height="14" rx="4" fill="#1f2937"/><rect x="65" y="40" width="9" height="14" rx="4" fill="#1f2937"/>' +
        '<rect class="ab-rgb" x="27.5" y="42" width="3" height="10" rx="1.5" fill="' + P.g + '"/><rect class="ab-rgb" x="69.5" y="42" width="3" height="10" rx="1.5" fill="' + P.g + '"/>' +
        '<path d="M30 52C30 60 36 60 42 58" fill="none" stroke="#1f2937" stroke-width="2"/><circle cx="43" cy="58" r="1.6" fill="' + P.g + '"/>'))); },

    rei: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      breathe(body('url(#' + u + 'dk)') + '<path d="M10 100C12 84 22 76 30 74C36 82 40 84 50 84C60 84 64 82 70 74C78 76 88 84 90 100" fill="none" stroke="#fafaf9" stroke-width="6"/>' +
        [18, 30, 70, 82].map((x) => '<circle cx="' + x + '" cy="' + (x < 50 ? 86 - (x - 18) * .5 : 86 - (82 - x) * .5) + '" r="1.2" fill="#111"/>').join('') +
        neck(s) + head(s) + '<path d="M36 50C36 62 44 68 50 68C56 68 64 62 64 50C58 56 42 56 36 50Z" fill="#78350f"/>' +
        '<path d="M34 40C32 30 40 26 50 26C60 26 68 30 66 40C62 34 56 34 50 34C44 34 38 34 34 40Z" fill="#78350f"/>' + eyes(45, '#111') + brows(40.6, '#78350f') +
        '<path d="M44 53C47 55 53 55 56 53" fill="none" stroke="#fef3c7" stroke-width="1.4"/>' +
        '<g transform="translate(0 -3)"><path d="M34 28L32 12L41 20L50 8L59 20L68 12L66 28Z" fill="#f6c453"' + O('#6b4308', 1) + '/><rect x="33" y="25" width="34" height="5" rx="1.5" fill="#e5b64a"' + O('#6b4308', .8) + '/>' +
        '<circle cx="50" cy="20" r="2.4" fill="' + P.a + '" stroke="#fff" stroke-width=".6"/><circle cx="41" cy="27.5" r="1.4" fill="' + P.b + '"/><circle cx="59" cy="27.5" r="1.4" fill="' + P.b + '"/>' +
        '<path class="ab-twinkle" d="M66 8l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z" fill="#fff"/></g>'))); },

    raposa: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      parts('kb', 4, (r, i) => '<g class="ab-float" style="--dl:-' + (i * .8).toFixed(1) + 's"><path d="M' + [14, 86, 20, 80][i] + ' ' + [30, 34, 70, 72][i] + 'c-4 -4 -2 -10 2 -12c-1 4 3 6 2 10c-1 2 -3 3 -4 2Z" fill="' + P.g + '" opacity=".85"/></g>') +
      breathe(body('url(#' + u + 'dk)') + '<path d="M38 74L50 84L62 74" fill="none" stroke="#fafaf9" stroke-width="2.4"/>' + neck(s) +
        '<g class="ab-hair" style="transform-origin:50px 26px"><path d="M32 52C28 30 38 22 50 22C62 22 72 30 68 52C66 44 60 40 50 40C40 40 34 44 32 52Z" fill="' + P.a + '"/></g>' +
        '<path class="ab-ear" style="transform-origin:36px 28px" d="M34 30L30 10L44 24Z" fill="' + P.a + '"' + O('#0005') + '/><path class="ab-ear r" style="transform-origin:64px 28px" d="M66 30L70 10L56 24Z" fill="' + P.a + '"' + O('#0005') + '/>' +
        '<path d="M34 42C34 30 42 26 50 26C58 26 66 30 66 42C66 52 58 60 50 64C42 60 34 52 34 42Z" fill="#fafaf9"' + O('#d6d3d1', .8) + '/>' +
        '<path d="M38 38L46 42M62 38L54 42" stroke="' + P.b + '" stroke-width="2.2" stroke-linecap="round"/><path d="M44 30L50 34L56 30" fill="none" stroke="' + P.b + '" stroke-width="1.6"/>' +
        eyes(44, '#111') + '<circle cx="50" cy="54" r="1.8" fill="#111"/><path d="M44 58C47 60 53 60 56 58" fill="none" stroke="' + P.b + '" stroke-width="1.2"/>'))); },

    bruxa: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      parts('bx', 6, (r) => '<circle class="ab-part" style="--dl:-' + (r() * 4).toFixed(2) + 's;--dx:' + ((r() - .5) * 10).toFixed(1) + 'px" cx="' + (20 + r() * 60).toFixed(0) + '" cy="' + (80 + r() * 20).toFixed(0) + '" r="' + (1.4 + r() * 2).toFixed(1) + '" fill="none" stroke="' + P.g + '" stroke-width=".8"/>') +
      breathe(body('url(#' + u + 'dk)') + neck(s) +
        '<g class="ab-hair" style="transform-origin:50px 30px"><path d="M30 38C24 58 22 80 30 96C34 80 36 64 38 50H62C64 64 66 80 70 96C78 80 76 58 70 38Z" fill="' + P.b + '"/></g>' + head(s, 15, 18) +
        eyes(46, '#16a34a') + '<path d="M40 41L47 42.4M60 41L53 42.4" stroke="#1f2937" stroke-width="1.2" stroke-linecap="round"/>' + mouth(56, '#be123c') +
        '<g class="ab-hat" style="transform-origin:50px 32px"><path d="M14 34C28 26 72 26 86 34C74 40 26 40 14 34Z" fill="url(#' + u + 'dk)"' + O('#0008') + '/>' +
        '<path d="M32 32C38 18 46 0 70 -6C58 4 62 16 68 32Z" fill="url(#' + u + 'dk)"' + O('#0008') + '/><path d="M33 29H67V33H33Z" fill="' + P.g + '"/><rect x="46" y="28" width="7" height="6" fill="none" stroke="#fde047" stroke-width="1"/></g>'))); },

    vampiro: (o) => { const P = o.P, u = o.u, s = SK.p; return wrap(o, base(u, P,
      '<circle cx="76" cy="20" r="11" fill="#fef3c7" opacity=".3"/>' + [0, 1].map((i) => '<g class="ab-bat" style="--dl:-' + (i * 2.2) + 's"><path d="M' + (20 + i * 50) + ' ' + (18 + i * 6) + 'c3 -3 5 -3 6 0c1 -1 2 -1 2 0c0 -1 1 -1 2 0c1 -3 3 -3 6 0c-3 0 -4 2 -5 3c-1 -1 -2 -1 -3 0c-1 -1 -2 -1 -3 0c-1 -1 -2 -3 -5 -3Z" fill="#0c0a09"/></g>').join('') +
      breathe('<path d="M16 100L22 64L36 74L50 90L64 74L78 64L84 100Z" fill="' + P.a + '"' + O('#0008') + '/>' + body('#0c0a09') + '<path d="M40 74L50 90L60 74" fill="#fafaf9"/><path d="M50 76L47 84H53Z" fill="' + P.a + '"/>' + neck(s) + head(s, 15, 19) +
        '<path d="M34 40C32 22 42 18 50 18C58 18 68 22 66 40C64 32 60 28 55 28L50 36L45 28C40 28 36 32 34 40Z" fill="#0c0a09"/>' + eyes(46, '#ef4444', true) + brows(41, '#0c0a09') +
        '<path d="M45 55C48 56.4 52 56.4 55 55" fill="none" stroke="#7f1d1d" stroke-width="1.2"/><path d="M46.4 55.4L47.2 58.4L48.2 55.8ZM53.6 55.4L52.8 58.4L51.8 55.8Z" fill="#fff"/>'))); },

    noel: (o) => { const P = o.P, u = o.u, s = SK.l; return wrap(o, base(u, P,
      dots('nl', 16, '#fff', 'ab-fall', -10, 0) +
      breathe(body('#dc2626') + '<path d="M10 96C16 80 30 74 50 74C70 74 84 80 90 96" fill="none" stroke="#fafaf9" stroke-width="5"/><circle cx="50" cy="90" r="2.4" fill="#111"/>' + neck(s) + head(s, 15, 17) +
        '<path d="M34 48C32 70 44 80 50 82C56 80 68 70 66 48C60 56 40 56 34 48Z" fill="#fafaf9"' + O('#d6d3d1', .8) + '/><path d="M42 52C46 50 54 50 58 52C54 55 46 55 42 52Z" fill="#fafaf9"' + O('#d6d3d1', .6) + '/>' +
        eyes(44, '#111') + '<circle cx="50" cy="49" r="2.6" fill="#f0a08a"/>' + '<ellipse cx="41" cy="50" rx="3" ry="1.8" fill="#f87171" opacity=".4"/><ellipse cx="59" cy="50" rx="3" ry="1.8" fill="#f87171" opacity=".4"/>' +
        '<path d="M32 34C34 16 50 8 66 14C74 18 80 30 82 40L74 36C70 28 64 24 58 24L66 34Z" fill="#dc2626"' + O('#7f1d1d', .8) + '/><rect x="30" y="30" width="40" height="8" rx="4" fill="#fafaf9"/>' +
        '<g class="ab-bob" style="transform-origin:78px 36px"><circle cx="80" cy="42" r="5" fill="#fafaf9"/></g>'))); },

    alien: (o) => { const P = o.P, u = o.u, s = SK.g; return wrap(o, base(u, P,
      '<g class="ab-float"><ellipse cx="80" cy="18" rx="12" ry="3.6" fill="#9ca3af"/><ellipse cx="80" cy="15" rx="5" ry="4" fill="' + P.c + '" opacity=".7"/><path d="M74 20L68 36H92L86 20Z" fill="' + P.g + '" opacity=".15"/></g>' +
      breathe(body('url(#' + u + 'dk)') + '<path d="M36 76H64" stroke="' + P.g + '" stroke-width="2" class="ab-glow"/>' + '<path d="M45 56H55V74H45Z" fill="' + s[1] + '"/>' +
        '<path d="M50 18C66 18 72 30 70 42C68 54 58 64 50 64C42 64 32 54 30 42C28 30 34 18 50 18Z" fill="' + s[0] + '"' + O('#3f6212', .8) + '/>' +
        '<g class="ab-blink" style="transform-origin:50px 44px"><path d="M36 42C38 36 46 38 47 46C44 50 36 48 36 42Z" fill="#0b0b0b"/><path d="M64 42C62 36 54 38 53 46C56 50 64 48 64 42Z" fill="#0b0b0b"/>' +
        '<circle class="ab-glow" cx="41" cy="42" r="1.4" fill="' + P.c + '"/><circle class="ab-glow" cx="59" cy="42" r="1.4" fill="' + P.c + '"/></g><path d="M47 56C49 57 51 57 53 56" fill="none" stroke="#3f6212" stroke-width="1"/>' +
        '<path d="M42 20C38 12 34 8 30 8M58 20C62 12 66 8 70 8" fill="none" stroke="' + s[1] + '" stroke-width="1.6"/><circle class="ab-led" cx="30" cy="8" r="2.4" fill="' + P.g + '"/><circle class="ab-led" style="--dl:.5s" cx="70" cy="8" r="2.4" fill="' + P.g + '"/>'))); },

    hacker: (o) => { const P = o.P, u = o.u, s = SK.m; return wrap(o, base(u, P,
      parts('hk', 8, (r) => '<text class="ab-code" style="--dl:-' + (r() * 4).toFixed(2) + 's" x="' + (4 + r() * 92).toFixed(0) + '" y="0" font-family="monospace" font-size="6" fill="' + P.g + '" opacity=".6">' + ['01', '10', '0x', 'ア', '1', 'Λ'][Math.floor(r() * 6)] + '</text>') +
      breathe(body('#111827') + '<path d="M22 100C22 58 32 18 50 16C68 18 78 58 78 100Z" fill="#1f2937"' + O('#000') + '/>' + '<path d="M44 74V92M56 74V92" stroke="#9ca3af" stroke-width="1.2"/>' +
        '<path d="M36 48C36 34 42 28 50 28C58 28 64 34 64 48C64 58 58 64 50 64C42 64 36 58 36 48Z" fill="' + s[0] + '"/>' +
        '<rect x="37" y="42" width="26" height="8" rx="3" fill="#111"/><rect class="ab-scan" x="37" y="42" width="26" height="8" rx="3" fill="' + P.g + '" opacity=".35"/>' + mouth(57, '#5b3a2a') +
        '<rect class="ab-flick" x="30" y="30" width="40" height="40" fill="' + P.g + '" opacity=".08"/>')));
    }
  };
  Object.keys(A).forEach((k) => C.register('avatar', k, A[k]));
  C.AVATARS = Object.keys(A);
})();
