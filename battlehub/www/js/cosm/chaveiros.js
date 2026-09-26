/* Chaveiros (caixa 60x130): argola em cima (30,8), corrente e o pingente em (30,90). A parte .kc-swing balança
   com a rolagem (física em js/cosm/vitrine.js). data.fx liga emissão: luz, particulas, fumaca, fogo, gelo, eletrico, holo. */
(function () {
  const C = BH.cosm;
  const { lin, rad, svg, around, pol } = C;
  const O = (P, w) => ' stroke="' + P.d + '" stroke-width="' + (w || 1.4) + '" stroke-linejoin="round"';
  const metal = (u) => lin(u + 'mt', [[0, '#f9fafb'], [.5, '#9ca3af'], [1, '#4b5563']]);

  const CH = {
    chave: (P, u) => '<circle cx="30" cy="76" r="10" fill="none" stroke="url(#' + u + 'g)" stroke-width="5"/><path d="M30 86V112M30 100H38M30 106H36" stroke="url(#' + u + 'g)" stroke-width="5" stroke-linecap="square"/>',
    espada: (P, u) => '<path d="M30 68L34 76V108L30 116L26 108V76Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M30 72V112" stroke="' + P.c + '" stroke-width="1" opacity=".8"/><rect x="20" y="66" width="20" height="4" rx="2" fill="' + P.b + '"' + O(P, 1) + '/><rect x="28" y="58" width="4" height="9" fill="' + P.d + '"/><circle cx="30" cy="57" r="3" fill="' + P.b + '"/>',
    arma: (P, u) => '<path d="M14 76H46V84H30L28 96H20L22 84H14Z" fill="url(#' + u + 'g)"' + O(P) + '/><rect x="16" y="78" width="26" height="2" fill="' + P.c + '" opacity=".6"/><path d="M44 78H50" stroke="' + P.g + '" stroke-width="2"/><circle cx="36" cy="88" r="2" fill="none" stroke="' + P.d + '" stroke-width="1.2"/>',
    boneco: (P) => '<circle cx="30" cy="72" r="10" fill="#fcd9b6"' + O(P) + '/><path d="M20 70C20 60 40 60 40 70L38 66C34 62 26 62 22 66Z" fill="' + P.d + '"/><circle cx="26.5" cy="73" r="1.6" fill="#111"/><circle cx="33.5" cy="73" r="1.6" fill="#111"/>' +
      '<path d="M22 84H38L40 104H20Z" fill="' + P.a + '"' + O(P) + '/><path d="M24 104V112M36 104V112" stroke="' + P.d + '" stroke-width="4" stroke-linecap="round"/><path d="M27 77C29 79 31 79 33 77" fill="none" stroke="#111" stroke-width="1"/>',
    cranio: (P) => '<path d="M30 64C18 64 14 74 15 82C16 88 20 90 22 92V100H38V92C40 90 44 88 45 82C46 74 42 64 30 64Z" fill="#f5f5f4"' + O(P) + '/><ellipse cx="24" cy="82" rx="5" ry="6" fill="' + P.d + '"/><ellipse cx="36" cy="82" rx="5" ry="6" fill="' + P.d + '"/>' +
      '<circle class="kc-eye" cx="24" cy="82" r="2" fill="' + P.g + '"/><circle class="kc-eye" cx="36" cy="82" r="2" fill="' + P.g + '"/><path d="M30 88L28 92H32Z" fill="' + P.d + '"/><path d="M25 100V96M30 100V96M35 100V96" stroke="' + P.d + '" stroke-width="1.2"/>',
    estrela: (P, u) => '<path d="' + around(10, (a, i) => { const p = pol(30, 88, i % 2 ? 9 : 20, a); return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }) + 'Z" fill="url(#' + u + 'g)"' + O(P) + '/><circle cx="26" cy="84" r="3" fill="#fff" opacity=".7"/>',
    coracao: (P, u) => '<path d="M30 110C10 96 12 74 24 74C28 74 30 78 30 80C30 78 32 74 36 74C48 74 50 96 30 110Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M20 82C20 78 24 76 26 78" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>',
    dragao: (P, u) => '<path d="M16 96C12 82 20 70 32 70C42 70 48 78 46 88L52 92L44 94C42 102 30 106 22 102Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M24 72L20 60L28 70Z M34 70L38 58L40 72Z" fill="' + P.c + '"' + O(P, 1) + '/>' +
      '<circle class="kc-eye" cx="34" cy="82" r="2.6" fill="' + P.g + '"/><path d="M40 96C38 98 34 98 32 96" fill="none" stroke="' + P.d + '" stroke-width="1.2"/><path d="M18 88L12 84L16 92Z" fill="' + P.b + '"/>',
    raposa: (P, u) => '<path d="M14 72L18 60L26 70Z M46 72L42 60L34 70Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M14 74C14 66 22 64 30 64C38 64 46 66 46 74C46 86 38 96 30 100C22 96 14 86 14 74Z" fill="url(#' + u + 'g)"' + O(P) + '/>' +
      '<path d="M22 86C26 94 34 94 38 86C36 96 24 96 22 86Z" fill="#fff"/><circle cx="24" cy="78" r="2.2" fill="#111"/><circle cx="36" cy="78" r="2.2" fill="#111"/><circle cx="30" cy="90" r="1.8" fill="#111"/>',
    logo: (P, u) => '<path d="M30 64L48 72V88C48 100 40 108 30 112C20 108 12 100 12 88V72Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M20 94L18 80L25 86L30 76L35 86L42 80L40 94Z" fill="' + P.d + '"/><rect x="20" y="95" width="20" height="3" rx="1" fill="' + P.d + '"/>',
    letra: (P, u, o) => '<rect x="12" y="70" width="36" height="38" rx="10" fill="url(#' + u + 'g)"' + O(P) + '/><text x="30" y="98" text-anchor="middle" font-family="Oswald, Arial Black, sans-serif" font-weight="700" font-size="26" fill="' + P.d + '">' +
      String(((o.user && o.user.nick) || 'B').trim().charAt(0) || 'B').toUpperCase().replace(/[<>&"]/g, '') + '</text>',
    cristal: (P, u) => '<path d="M30 64L44 80L30 114L16 80Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M30 64L36 80L30 114M30 64L24 80L30 114M16 80H44" fill="none" stroke="' + P.c + '" stroke-width=".8" opacity=".8"/>',
    medalha: (P, u) => '<path d="M20 60L30 76L40 60" fill="none" stroke="' + P.a + '" stroke-width="5"/><circle cx="30" cy="92" r="16" fill="url(#' + u + 'g)"' + O(P) + '/><circle cx="30" cy="92" r="11" fill="none" stroke="' + P.c + '" stroke-width="1.2"/>' +
      '<path d="M30 84L32.4 89L38 89.6L33.8 93.4L35 99L30 96L25 99L26.2 93.4L22 89.6L27.6 89Z" fill="' + P.c + '"/>',
    trofeu: (P, u) => '<path d="M18 68H42V78C42 88 36 94 30 94C24 94 18 88 18 78Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M18 72C10 72 10 84 20 84M42 72C50 72 50 84 40 84" fill="none" stroke="' + P.a + '" stroke-width="2.4"/>' +
      '<rect x="27" y="94" width="6" height="8" fill="' + P.a + '"/><rect x="20" y="102" width="20" height="6" rx="2" fill="' + P.d + '"/><path d="M24 72V82" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>',
    patinha: (P, u) => '<ellipse cx="30" cy="96" rx="12" ry="10" fill="url(#' + u + 'g)"' + O(P) + '/>' + [[17, 80], [25, 74], [35, 74], [43, 80]].map((p) => '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="4.4" ry="5.4" fill="url(#' + u + 'g)"' + O(P, 1.2) + '/>').join(''),
    yinyang: (P) => '<circle cx="30" cy="90" r="18" fill="' + P.c + '"' + O(P) + '/><path d="M30 72A18 18 0 0 1 30 108A9 9 0 0 1 30 90A9 9 0 0 0 30 72Z" fill="' + P.a + '"/><circle cx="30" cy="81" r="3" fill="' + P.a + '"/><circle cx="30" cy="99" r="3" fill="' + P.c + '"/>',
    neon: (P) => '<path d="M34 64L18 92H30L24 116L44 84H32L38 64Z" fill="none" stroke="' + P.g + '" stroke-width="3" stroke-linejoin="round" class="kc-neon"/><path d="M34 64L18 92H30L24 116L44 84H32L38 64Z" fill="' + P.g + '" opacity=".15"/>',
    shuriken: (P, u) => '<g class="kc-spin" style="transform-origin:30px 90px"><path d="M30 68L34 86L52 90L34 94L30 112L26 94L8 90L26 86Z" fill="url(#' + u + 'g)"' + O(P) + '/><circle cx="30" cy="90" r="4" fill="' + P.d + '"/></g>',
    abobora: (P) => '<path d="M30 70C42 70 50 78 50 90C50 102 42 108 30 108C18 108 10 102 10 90C10 78 18 70 30 70Z" fill="#f97316"' + O(P) + '/><path d="M28 70C28 64 30 62 34 60" stroke="#3f6212" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M20 86L26 82V90Z M40 86L34 82V90Z M20 96L25 100L30 96L35 100L40 96C38 104 22 104 20 96Z" fill="#fde047" class="kc-eye"/>',
    floco: (P) => '<g class="kc-spin slow" style="transform-origin:30px 90px">' + around(6, (a) => '<g transform="rotate(' + a + ' 30 90)"><path d="M30 90V70M30 76L25 71M30 76L35 71M30 82L26 78M30 82L34 78" stroke="' + P.c + '" stroke-width="2.4" stroke-linecap="round"/></g>') + '</g><circle cx="30" cy="90" r="3" fill="' + P.a + '"/>',
    dado: (P, u) => '<rect x="12" y="72" width="36" height="36" rx="8" fill="url(#' + u + 'g)"' + O(P) + '/>' + [[21, 81], [39, 81], [30, 90], [21, 99], [39, 99]].map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="' + P.d + '"/>').join(''),
    gamepad: (P, u) => '<path d="M14 80C14 74 20 72 30 72C40 72 46 74 46 80L50 100C50 106 42 106 38 98H22C18 106 10 106 10 100Z" fill="url(#' + u + 'g)"' + O(P) + '/><path d="M20 84V92M16 88H24" stroke="' + P.d + '" stroke-width="2.4"/><circle cx="37" cy="85" r="2.2" fill="' + P.g + '"/><circle cx="42" cy="90" r="2.2" fill="' + P.c + '"/>'
  };

  const FX = {
    luz: (P, u) => '<circle class="kc-halo" cx="30" cy="90" r="26" fill="url(#' + u + 'h)"/>',
    particulas: (P) => around(6, (a, i) => { const p = pol(30, 90, 20, a); return '<circle class="kc-part" style="--dl:-' + (i * .4) + 's" cx="' + p[0] + '" cy="' + p[1] + '" r="1.5" fill="' + P.c + '"/>'; }),
    fumaca: (P) => [0, 1, 2].map((i) => '<circle class="kc-smoke" style="--dl:-' + i * .9 + 's" cx="' + (24 + i * 6) + '" cy="72" r="5" fill="' + P.b + '" opacity=".35"/>').join(''),
    fogo: (P) => [0, 1, 2, 3].map((i) => '<path class="kc-flame" style="--dl:-' + (i * .25) + 's;transform-origin:' + (20 + i * 7) + 'px 76px" d="M' + (20 + i * 7) + ' 76C' + (16 + i * 7) + ' 70 ' + (20 + i * 7) + ' 64 ' + (22 + i * 7) + ' 60C' + (24 + i * 7) + ' 66 ' + (26 + i * 7) + ' 70 ' + (20 + i * 7) + ' 76Z" fill="' + (i % 2 ? '#fbbf24' : '#f97316') + '"/>').join(''),
    gelo: (P) => around(6, (a, i) => { const p = pol(30, 90, 22, a + 15); return '<path class="kc-twinkle" style="--dl:' + (i * .35) + 's" d="M' + p[0] + ' ' + (p[1] - 3) + 'l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#e0f2fe"/>'; }),
    eletrico: (P) => [0, 1].map((i) => '<path class="kc-zap" style="--dl:' + i * .8 + 's" d="M' + (i ? 48 : 12) + ' 76L' + (i ? 42 : 18) + ' 86L' + (i ? 50 : 10) + ' 92L' + (i ? 44 : 16) + ' 104" fill="none" stroke="' + P.g + '" stroke-width="1.6" stroke-linecap="round"/>').join(''),
    holo: () => ''
  };

  function keychain(o) {
    const P = o.P, u = o.u, d = o.d;
    const charm = CH[d.art];
    if (!charm) return '';
    const fx = d.fx && FX[d.fx] ? FX[d.fx](P, u) : '';
    const inner = '<defs>' + metal(u) + lin(u + 'g', [[0, P.c], [.45, P.b], [1, P.a]]) + rad(u + 'h', [[0, P.g, .55], [1, P.g, 0]]) + '</defs>' +
      '<circle cx="30" cy="8" r="6" fill="none" stroke="url(#' + u + 'mt)" stroke-width="2.6"/>' +
      '<g class="kc-swing" style="transform-origin:30px 8px">' +
      [0, 1, 2, 3, 4].map((i) => (i % 2 ? '<ellipse cx="30" cy="' + (18 + i * 9) + '" rx="1.8" ry="4.6" fill="none" stroke="url(#' + u + 'mt)" stroke-width="1.8"/>'
        : '<ellipse cx="30" cy="' + (18 + i * 9) + '" rx="3.4" ry="4.6" fill="none" stroke="url(#' + u + 'mt)" stroke-width="1.8"/>')).join('') +
      '<circle cx="30" cy="62" r="3.4" fill="none" stroke="url(#' + u + 'mt)" stroke-width="2"/>' +
      (d.fx === 'luz' || d.fx === 'fogo' ? fx : '') +
      '<g class="kc-charm' + (d.fx === 'holo' ? ' kc-holo' : '') + '">' + charm(P, u, o) + '</g>' +
      (d.fx && d.fx !== 'luz' && d.fx !== 'fogo' ? fx : '') + '</g>';
    return svg('0 0 60 130', inner, 'kc kc-' + d.art + (d.fx ? ' kcfx-' + d.fx : '') + (o.still ? ' still' : ''));
  }
  Object.keys(CH).forEach((k) => C.register('chaveiro', k, keychain));
  C.KC_FX = Object.keys(FX);
})();
