/* Pets (caixa 100x100, chão em y≈94). Partes com classes de animação parada (css/cosm.css):
   pz-body respira, pz-head balança, pz-tail abana, pz-eye pisca, pz-pupil olha, pz-ear mexe, pz-hop pula,
   pz-float flutua, pz-wing bate, pz-part sobe. A paleta pinta pelo (a), detalhe (b), barriga (c), contorno (d). */
(function () {
  const C = BH.cosm;
  const { lin, rad, svg, around } = C;
  const OUT = (P) => ' stroke="' + P.d + '" stroke-width="1.6" stroke-linejoin="round"';
  const eye = (x, y, r, P, glow) => '<g class="pz-eye"><ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 1.12) + '" fill="#fff"/>' +
    '<g class="pz-pupil"><circle cx="' + x + '" cy="' + (y + r * .15) + '" r="' + (r * .62) + '" fill="' + (glow ? P.g : '#1a1a1a') + '"/><circle cx="' + (x - r * .22) + '" cy="' + (y - r * .2) + '" r="' + (r * .22) + '" fill="#fff"/></g></g>';
  const cheek = (x, y) => '<ellipse cx="' + x + '" cy="' + y + '" rx="3.4" ry="2" fill="#ff7a9a" opacity=".45"/>';
  const shadow = '<ellipse cx="50" cy="95" rx="24" ry="3.4" fill="#000" opacity=".28" class="pz-shadow"/>';
  const sparks = (n, P, seed, cls) => { const r = C.rng(seed); let s = ''; for (let i = 0; i < n; i++) s += '<circle class="pz-part ' + (cls || '') + '" style="--dl:-' + (r() * 3).toFixed(2) + 's;--dx:' + ((r() - .5) * 16).toFixed(1) + 'px" cx="' + (30 + r() * 40).toFixed(1) + '" cy="' + (40 + r() * 30).toFixed(1) + '" r="' + (0.8 + r() * 1.4).toFixed(1) + '" fill="' + (i % 2 ? P.g : P.c) + '"/>'; return s; };
  const wrap = (o, inner, extra) => svg('0 0 100 100', inner, 'pz pz-' + o.d.art + (o.still ? ' still' : '') + (extra ? ' ' + extra : ''));

  const PETS = {
    raposa: (o) => { const P = o.P, u = o.u; return wrap(o, '<defs>' + lin(u + 'f', [[0, P.b], [1, P.a]], 0, 1) + '</defs>' + shadow +
      '<g class="pz-tail" style="transform-origin:62px 80px"><path d="M62 80C80 84 92 70 90 52C88 42 80 40 78 48C84 60 76 72 60 74Z" fill="url(#' + u + 'f)"' + OUT(P) + '/><path d="M90 52C88 42 80 40 78 48C80 50 86 50 90 52Z" fill="' + P.c + '"/></g>' +
      '<g class="pz-body"><ellipse cx="48" cy="78" rx="18" ry="15" fill="url(#' + u + 'f)"' + OUT(P) + '/><ellipse cx="48" cy="82" rx="10" ry="10" fill="' + P.c + '"/>' +
      '<ellipse cx="38" cy="92" rx="5" ry="3" fill="' + P.d + '"/><ellipse cx="58" cy="92" rx="5" ry="3" fill="' + P.d + '"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 62px"><path class="pz-ear" style="transform-origin:32px 36px" d="M28 38L30 14L44 32Z" fill="url(#' + u + 'f)"' + OUT(P) + '/><path d="M31 32L32 20L39 30Z" fill="' + P.c + '" opacity=".8"/>' +
      '<path class="pz-ear r" style="transform-origin:64px 36px" d="M68 38L66 14L52 32Z" fill="url(#' + u + 'f)"' + OUT(P) + '/><path d="M65 32L64 20L57 30Z" fill="' + P.c + '" opacity=".8"/>' +
      '<path d="M22 44C22 30 34 26 48 26C62 26 74 30 74 44C74 56 62 64 48 64C34 64 22 56 22 44Z" fill="url(#' + u + 'f)"' + OUT(P) + '/>' +
      '<path d="M34 50C38 60 58 60 62 50C58 56 38 56 34 50Z" fill="' + P.c + '"/><path d="M26 46C30 54 40 58 48 58C56 58 66 54 70 46C66 60 30 60 26 46Z" fill="' + P.c + '"/>' +
      eye(38, 43, 5, P) + eye(58, 43, 5, P) + '<path d="M45 52L51 52L48 55Z" fill="' + P.d + '"/>' + cheek(32, 52) + cheek(64, 52) + '</g>'); },

    gato: (o) => { const P = o.P; return wrap(o, shadow +
      '<g class="pz-tail" style="transform-origin:66px 84px"><path d="M66 86C82 88 86 70 80 58C78 54 74 56 76 60C80 70 76 80 64 80Z" fill="' + P.a + '"' + OUT(P) + '/></g>' +
      '<g class="pz-body"><path d="M32 94C28 80 34 66 48 66C62 66 68 80 64 94Z" fill="' + P.a + '"' + OUT(P) + '/><ellipse cx="48" cy="84" rx="8" ry="9" fill="' + P.c + '"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 66px"><path class="pz-ear" style="transform-origin:30px 34px" d="M24 40L26 14L42 30Z" fill="' + P.a + '"' + OUT(P) + '/><path d="M28 34L29 22L36 30Z" fill="#ff9ab5"/>' +
      '<path class="pz-ear r" style="transform-origin:66px 34px" d="M72 40L70 14L54 30Z" fill="' + P.a + '"' + OUT(P) + '/><path d="M68 34L67 22L60 30Z" fill="#ff9ab5"/>' +
      '<ellipse cx="48" cy="46" rx="27" ry="22" fill="' + P.a + '"' + OUT(P) + '/><path d="M40 27L42 34M48 25V33M56 27L54 34" stroke="' + P.b + '" stroke-width="2.4" stroke-linecap="round"/>' +
      eye(37, 45, 5.4, P) + eye(59, 45, 5.4, P) + '<path d="M46 53L50 53L48 55.5Z" fill="#ff7a9a"/><path d="M48 55.5C47 58 44 58 43 57M48 55.5C49 58 52 58 53 57" fill="none" stroke="' + P.d + '" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M22 50L34 52M22 56L34 55M74 50L62 52M74 56L62 55" stroke="' + P.c + '" stroke-width="1" stroke-linecap="round" opacity=".8"/>' + cheek(31, 53) + cheek(65, 53) + '</g>'); },

    cachorro: (o) => { const P = o.P; return wrap(o, shadow +
      '<g class="pz-tail fast" style="transform-origin:66px 78px"><path d="M66 80C74 76 80 68 78 62C76 60 72 62 72 66C72 70 68 74 64 74Z" fill="' + P.a + '"' + OUT(P) + '/></g>' +
      '<g class="pz-body"><ellipse cx="48" cy="80" rx="19" ry="14" fill="' + P.a + '"' + OUT(P) + '/><ellipse cx="48" cy="84" rx="10" ry="9" fill="' + P.c + '"/>' +
      '<rect x="34" y="88" width="9" height="7" rx="3.5" fill="' + P.a + '"' + OUT(P) + '/><rect x="53" y="88" width="9" height="7" rx="3.5" fill="' + P.a + '"' + OUT(P) + '/></g>' +
      '<g class="pz-head" style="transform-origin:48px 64px"><ellipse cx="48" cy="44" rx="24" ry="21" fill="' + P.a + '"' + OUT(P) + '/>' +
      '<path class="pz-ear" style="transform-origin:28px 30px" d="M28 28C16 28 14 46 20 56C24 58 28 50 30 40Z" fill="' + P.b + '"' + OUT(P) + '/>' +
      '<path class="pz-ear r" style="transform-origin:68px 30px" d="M68 28C80 28 82 46 76 56C72 58 68 50 66 40Z" fill="' + P.b + '"' + OUT(P) + '/>' +
      '<ellipse cx="48" cy="54" rx="12" ry="9" fill="' + P.c + '"/>' + eye(38, 42, 5, P) + eye(58, 42, 5, P) +
      '<ellipse cx="48" cy="50" rx="4.4" ry="3.2" fill="' + P.d + '"/><path class="pz-tongue" d="M45 57C45 63 51 63 51 57Z" fill="#ff6b8a"/><path d="M42 56C45 59 51 59 54 56" fill="none" stroke="' + P.d + '" stroke-width="1.3" stroke-linecap="round"/></g>'); },

    dragao: (o) => { const P = o.P, u = o.u; return wrap(o, '<defs>' + lin(u + 's', [[0, P.b], [1, P.a]], 0, 1) + '</defs>' + shadow +
      '<g class="pz-wing" style="transform-origin:34px 64px"><path d="M34 64C18 48 6 52 4 60C12 60 14 66 10 70C18 68 22 74 20 78C28 74 30 70 34 70Z" fill="' + P.b + '"' + OUT(P) + ' opacity=".95"/></g>' +
      '<g class="pz-wing r" style="transform-origin:62px 64px"><path d="M62 64C78 48 90 52 92 60C84 60 82 66 86 70C78 68 74 74 76 78C68 74 66 70 62 70Z" fill="' + P.b + '"' + OUT(P) + ' opacity=".95"/></g>' +
      '<g class="pz-tail" style="transform-origin:62px 86px"><path d="M60 86C74 92 86 88 90 78L96 80L92 72L86 74C82 82 72 84 62 80Z" fill="url(#' + u + 's)"' + OUT(P) + '/></g>' +
      '<g class="pz-body"><ellipse cx="48" cy="78" rx="17" ry="15" fill="url(#' + u + 's)"' + OUT(P) + '/><path d="M40 70C44 66 52 66 56 70L54 90C50 92 46 92 42 90Z" fill="' + P.c + '" opacity=".85"/>' +
      '<path d="M44 74H52M43 79H53M44 84H52" stroke="' + P.b + '" stroke-width="1.2" opacity=".7"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 62px"><path d="M34 26L30 12L40 22Z M62 26L66 12L56 22Z" fill="' + P.c + '"' + OUT(P) + '/>' +
      '<ellipse cx="48" cy="42" rx="21" ry="19" fill="url(#' + u + 's)"' + OUT(P) + '/><ellipse cx="48" cy="52" rx="12" ry="8" fill="' + P.c + '"/>' +
      '<circle cx="44" cy="51" r="1.2" fill="' + P.d + '"/><circle cx="52" cy="51" r="1.2" fill="' + P.d + '"/>' + eye(39, 40, 5, P) + eye(57, 40, 5, P) +
      '<path d="M48 22L50 28L46 28Z" fill="' + P.b + '"/></g>' +
      '<g class="pz-puff"><circle cx="48" cy="60" r="3" fill="' + P.g + '" opacity=".8"/><circle cx="44" cy="63" r="2" fill="' + P.c + '" opacity=".8"/></g>'); },

    lobo: (o) => { const P = o.P; return wrap(o, shadow +
      '<g class="pz-tail" style="transform-origin:64px 84px"><path d="M64 84C80 90 90 82 90 72C84 76 76 76 70 74Z" fill="' + P.a + '"' + OUT(P) + '/></g>' +
      '<g class="pz-body"><path d="M30 94C28 76 36 64 48 64C60 64 68 76 66 94Z" fill="' + P.a + '"' + OUT(P) + '/><path d="M36 70L42 78L48 70L54 78L60 70C58 82 38 82 36 70Z" fill="' + P.c + '"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 64px"><path class="pz-ear" style="transform-origin:30px 30px" d="M26 34L28 8L42 26Z" fill="' + P.a + '"' + OUT(P) + '/><path class="pz-ear r" style="transform-origin:66px 30px" d="M70 34L68 8L54 26Z" fill="' + P.a + '"' + OUT(P) + '/>' +
      '<path d="M22 42C22 28 34 22 48 22C62 22 74 28 74 42C74 52 66 62 48 66C30 62 22 52 22 42Z" fill="' + P.a + '"' + OUT(P) + '/>' +
      '<path d="M36 48C40 58 56 58 60 48L56 62C52 66 44 66 40 62Z" fill="' + P.c + '"/><path d="M30 34L40 38M66 34L56 38" stroke="' + P.d + '" stroke-width="2" stroke-linecap="round"/>' +
      eye(38, 42, 4.6, P, true) + eye(58, 42, 4.6, P, true) + '<ellipse cx="48" cy="54" rx="4" ry="3" fill="' + P.d + '"/></g>'); },

    corvo: (o) => { const P = o.P; return wrap(o, shadow + '<g class="pz-hop">' +
      '<g class="pz-tail" style="transform-origin:62px 74px"><path d="M60 72L86 82L82 86L88 90L60 82Z" fill="' + P.a + '"' + OUT(P) + '/></g>' +
      '<g class="pz-body"><path d="M28 70C28 52 40 42 54 44C68 46 70 62 66 76C62 88 40 92 32 84Z" fill="' + P.a + '"' + OUT(P) + '/></g>' +
      '<g class="pz-wing" style="transform-origin:48px 62px"><path d="M40 60C50 58 62 64 66 74C58 76 46 74 38 68Z" fill="' + P.b + '"' + OUT(P) + '/></g>' +
      '<path d="M40 88V94M46 88V94" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>' +
      '<g class="pz-head" style="transform-origin:40px 50px"><circle cx="38" cy="38" r="15" fill="' + P.a + '"' + OUT(P) + '/><path d="M24 36L10 42L25 44Z" fill="#f59e0b" stroke="#92400e" stroke-width="1"/>' +
      eye(36, 34, 4.6, P, true) + '<path d="M40 24L46 18L44 26Z" fill="' + P.a + '"/></g></g>'); },

    coelho: (o) => { const P = o.P; return wrap(o, shadow + '<g class="pz-hop">' +
      '<g class="pz-body"><ellipse cx="48" cy="80" rx="18" ry="14" fill="' + P.c + '"' + OUT(P) + '/><circle class="pz-tail" cx="67" cy="82" r="6" fill="#fff"' + OUT(P) + '/>' +
      '<ellipse cx="40" cy="93" rx="7" ry="3" fill="' + P.c + '"' + OUT(P) + '/><ellipse cx="57" cy="93" rx="7" ry="3" fill="' + P.c + '"' + OUT(P) + '/></g>' +
      '<g class="pz-head" style="transform-origin:48px 66px"><g class="pz-ear" style="transform-origin:40px 30px"><ellipse cx="38" cy="16" rx="6" ry="17" fill="' + P.c + '"' + OUT(P) + '/><ellipse cx="38" cy="17" rx="3" ry="12" fill="' + P.a + '"/></g>' +
      '<g class="pz-ear r" style="transform-origin:58px 30px"><ellipse cx="59" cy="16" rx="6" ry="17" fill="' + P.c + '"' + OUT(P) + ' transform="rotate(10 59 16)"/><ellipse cx="59" cy="17" rx="3" ry="12" fill="' + P.a + '" transform="rotate(10 59 17)"/></g>' +
      '<ellipse cx="48" cy="48" rx="20" ry="18" fill="' + P.c + '"' + OUT(P) + '/>' + eye(40, 46, 4.6, P) + eye(56, 46, 4.6, P) +
      '<path d="M46 54L50 54L48 56Z" fill="#ff7a9a"/><path d="M46 58H50" stroke="' + P.d + '" stroke-width="1"/>' + cheek(34, 54) + cheek(62, 54) + '</g></g>'); },

    panda: (o) => { const P = o.P; return wrap(o, shadow +
      '<g class="pz-body"><ellipse cx="48" cy="80" rx="20" ry="15" fill="#fafafa"' + OUT(P) + '/><path d="M28 78C28 70 36 66 42 68L40 90C32 90 28 86 28 78ZM68 78C68 70 60 66 54 68L56 90C64 90 68 86 68 78Z" fill="#1f1f1f"/>' +
      '<path class="pz-bamboo" d="M70 96L84 50" stroke="' + P.a + '" stroke-width="4" stroke-linecap="round"/><path d="M76 74L82 76M80 62L86 62" stroke="' + P.b + '" stroke-width="2" stroke-linecap="round"/><path d="M84 52C90 48 94 50 94 54C90 54 88 54 84 52Z" fill="' + P.b + '"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 64px"><circle class="pz-ear" style="transform-origin:28px 28px" cx="28" cy="28" r="8" fill="#1f1f1f"/><circle class="pz-ear r" style="transform-origin:68px 28px" cx="68" cy="28" r="8" fill="#1f1f1f"/>' +
      '<ellipse cx="48" cy="46" rx="25" ry="21" fill="#fafafa"' + OUT(P) + '/><ellipse cx="38" cy="45" rx="7" ry="8.5" fill="#1f1f1f" transform="rotate(-20 38 45)"/><ellipse cx="58" cy="45" rx="7" ry="8.5" fill="#1f1f1f" transform="rotate(20 58 45)"/>' +
      '<g class="pz-eye"><circle cx="39" cy="45" r="3" fill="#fff"/><circle cx="39" cy="45.5" r="1.8" fill="#111"/></g><g class="pz-eye"><circle cx="57" cy="45" r="3" fill="#fff"/><circle cx="57" cy="45.5" r="1.8" fill="#111"/></g>' +
      '<ellipse cx="48" cy="54" rx="3.6" ry="2.6" fill="#1f1f1f"/><path d="M45 58C47 60 49 60 51 58" fill="none" stroke="#1f1f1f" stroke-width="1.2"/>' + cheek(32, 55) + cheek(64, 55) + '</g>'); },

    robo: (o) => { const P = o.P, u = o.u; return wrap(o, '<defs>' + lin(u + 'm', [[0, P.c], [.5, P.b], [1, P.a]]) + rad(u + 'j', [[0, P.g], [1, P.g, 0]]) + '</defs>' +
      '<ellipse cx="50" cy="95" rx="16" ry="3" fill="' + P.g + '" opacity=".35" class="pz-shadow"/><g class="pz-float">' +
      '<ellipse class="pz-thrust" cx="48" cy="90" rx="7" ry="6" fill="url(#' + u + 'j)"/>' +
      '<g class="pz-body"><rect x="32" y="62" width="32" height="24" rx="8" fill="url(#' + u + 'm)"' + OUT(P) + '/><circle cx="48" cy="74" r="5" fill="' + P.d + '"/><circle class="pz-core" cx="48" cy="74" r="3" fill="' + P.g + '"/>' +
      '<rect x="22" y="66" width="8" height="14" rx="4" fill="' + P.b + '"' + OUT(P) + '/><rect x="66" y="66" width="8" height="14" rx="4" fill="' + P.b + '"' + OUT(P) + '/></g>' +
      '<g class="pz-head" style="transform-origin:48px 60px"><path d="M48 20V12" stroke="' + P.d + '" stroke-width="2"/><circle class="pz-blinkled" cx="48" cy="10" r="3.4" fill="' + P.g + '"/>' +
      '<rect x="24" y="20" width="48" height="38" rx="14" fill="url(#' + u + 'm)"' + OUT(P) + '/><rect x="30" y="30" width="36" height="18" rx="9" fill="' + P.d + '"/>' +
      '<g class="pz-eye"><rect x="36" y="35" width="8" height="8" rx="3" fill="' + P.g + '"/></g><g class="pz-eye"><rect x="52" y="35" width="8" height="8" rx="3" fill="' + P.g + '"/></g>' +
      '<rect x="20" y="34" width="5" height="10" rx="2" fill="' + P.b + '"/><rect x="71" y="34" width="5" height="10" rx="2" fill="' + P.b + '"/></g></g>'); },

    alien: (o) => { const P = o.P; return wrap(o, shadow + '<g class="pz-hop soft">' +
      '<g class="pz-body"><path d="M30 94C26 74 34 58 48 58C62 58 70 74 66 94Z" fill="' + P.a + '"' + OUT(P) + '/><ellipse cx="48" cy="80" rx="9" ry="10" fill="' + P.c + '" opacity=".6"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 60px"><path class="pz-ear" style="transform-origin:38px 24px" d="M38 24C34 14 28 10 24 10" fill="none" stroke="' + P.a + '" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="10" r="4" fill="' + P.g + '"/>' +
      '<path class="pz-ear r" style="transform-origin:58px 24px" d="M58 24C62 14 68 10 72 10" fill="none" stroke="' + P.a + '" stroke-width="2.6" stroke-linecap="round"/><circle cx="72" cy="10" r="4" fill="' + P.g + '"/>' +
      '<ellipse cx="48" cy="40" rx="24" ry="20" fill="' + P.a + '"' + OUT(P) + '/>' + eye(36, 40, 5.6, P) + eye(60, 40, 5.6, P) + eye(48, 32, 4.4, P) +
      '<path d="M42 52C46 55 50 55 54 52" fill="none" stroke="' + P.d + '" stroke-width="1.5" stroke-linecap="round"/></g></g>'); },

    espirito: (o) => { const P = o.P, u = o.u; return wrap(o, '<defs>' + lin(u + 'w', [[0, P.c], [.6, P.b], [1, P.a, 0]], 0, 1) + '</defs><g class="pz-float">' +
      '<g class="pz-tail slow" style="transform-origin:48px 70px"><path d="M30 60C30 80 40 88 48 96C52 88 66 82 66 60Z" fill="url(#' + u + 'w)"/></g>' +
      '<g class="pz-body"><circle cx="48" cy="46" r="22" fill="url(#' + u + 'w)"/><circle cx="48" cy="46" r="22" fill="none" stroke="' + P.c + '" stroke-width="1" opacity=".7"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 50px">' + eye(40, 44, 4.4, P) + eye(56, 44, 4.4, P) + '<path d="M44 54C46 56 50 56 52 54" fill="none" stroke="' + P.d + '" stroke-width="1.4" stroke-linecap="round"/>' + cheek(35, 51) + cheek(61, 51) + '</g>' +
      sparks(6, P, 'esp' + P.name) + '</g>'); },

    slime: (o) => { const P = o.P, u = o.u; return wrap(o, '<defs>' + rad(u + 'g', [[0, P.c], [.55, P.b], [1, P.a]]) + '</defs>' +
      '<ellipse cx="50" cy="95" rx="26" ry="3.4" fill="' + P.g + '" opacity=".35" class="pz-shadow"/><g class="pz-squish">' +
      '<path d="M18 92C14 70 28 44 48 44C68 44 82 70 78 92C70 96 26 96 18 92Z" fill="url(#' + u + 'g)" stroke="' + P.g + '" stroke-width="1.6"/>' +
      '<ellipse cx="34" cy="60" rx="6" ry="4" fill="#fff" opacity=".7"/><circle cx="60" cy="54" r="2" fill="#fff" opacity=".8"/>' +
      '<g class="pz-head" style="transform-origin:48px 76px">' + eye(40, 72, 5, P) + eye(58, 72, 5, P) + '<path d="M45 82C47 85 51 85 53 82" fill="none" stroke="' + P.d + '" stroke-width="1.6" stroke-linecap="round"/></g></g>'); },

    salamandra: (o) => { const P = o.P; return wrap(o, shadow +
      '<g class="pz-tail" style="transform-origin:64px 86px"><path d="M62 86C76 92 90 88 94 78C88 80 78 82 70 80Z" fill="' + P.a + '"' + OUT(P) + '/></g>' +
      '<g class="pz-body"><ellipse cx="48" cy="82" rx="20" ry="11" fill="' + P.a + '"' + OUT(P) + '/><ellipse cx="48" cy="86" rx="12" ry="6" fill="' + P.c + '" opacity=".8"/>' +
      around(4, (a, i) => '<circle cx="' + (36 + i * 8) + '" cy="76" r="2" fill="' + P.b + '"/>') + '</g>' +
      '<g class="pz-head" style="transform-origin:40px 70px"><ellipse cx="36" cy="58" rx="18" ry="14" fill="' + P.a + '"' + OUT(P) + '/>' +
      '<g class="pz-flame"><path d="M30 46C28 36 34 32 36 26C38 34 44 34 42 44C46 40 48 36 48 32C52 40 50 46 44 50Z" fill="' + P.b + '"/><path d="M36 46C35 40 38 38 39 34C40 40 43 40 42 46Z" fill="' + P.c + '"/></g>' +
      eye(30, 56, 4.4, P) + eye(44, 56, 4.4, P) + '<path d="M28 66C32 68 40 68 44 66" fill="none" stroke="' + P.d + '" stroke-width="1.4" stroke-linecap="round"/></g>' + sparks(5, P, 'sal' + P.name, 'up')); },

    pinguim: (o) => { const P = o.P; return wrap(o, shadow +
      '<g class="pz-body"><ellipse cx="48" cy="66" rx="22" ry="28" fill="#1f2937"' + OUT(P) + '/><ellipse cx="48" cy="72" rx="14" ry="20" fill="#f8fafc"/>' +
      '<g class="pz-wing" style="transform-origin:28px 60px"><path d="M28 56C18 62 16 74 20 82C24 76 28 72 30 68Z" fill="#1f2937"/></g>' +
      '<g class="pz-wing r" style="transform-origin:68px 60px"><path d="M68 56C78 62 80 74 76 82C72 76 68 72 66 68Z" fill="#1f2937"/></g>' +
      '<ellipse cx="40" cy="94" rx="6" ry="2.6" fill="#f59e0b"/><ellipse cx="56" cy="94" rx="6" ry="2.6" fill="#f59e0b"/>' +
      '<path d="M30 56C38 62 58 62 66 56L64 62C56 66 40 66 32 62Z" fill="' + P.a + '"/><path d="M58 60L62 74L66 72L62 60Z" fill="' + P.b + '"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 50px">' + eye(40, 44, 4, P) + eye(56, 44, 4, P) + '<path d="M44 50L52 50L48 55Z" fill="#f59e0b"/>' + cheek(34, 50) + cheek(62, 50) +
      '<path d="M38 26L42 20L46 26L50 20L54 26L58 20L60 28L36 28Z" fill="' + P.c + '" stroke="' + P.a + '" stroke-width="1"/></g>' + sparks(5, P, 'pin' + P.name)); },

    polvo: (o) => { const P = o.P, u = o.u; return wrap(o, '<defs>' + rad(u + 'h', [[.7, '#ffffff', 0], [1, '#ffffff', .5]]) + '</defs><g class="pz-float">' +
      '<g class="pz-tent">' + [0, 1, 2, 3, 4].map((i) => '<path class="pz-tail' + (i % 2 ? ' slow' : '') + '" style="transform-origin:' + (32 + i * 8) + 'px 66px" d="M' + (30 + i * 8) + ' 64C' + (26 + i * 8) + ' 78 ' + (34 + i * 8) + ' 84 ' + (30 + i * 9) + ' 92" fill="none" stroke="' + P.a + '" stroke-width="5" stroke-linecap="round"/>').join('') + '</g>' +
      '<g class="pz-body"><ellipse cx="48" cy="50" rx="22" ry="20" fill="' + P.a + '"' + OUT(P) + '/><circle cx="36" cy="40" r="3" fill="' + P.b + '"/><circle cx="60" cy="38" r="2.4" fill="' + P.b + '"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 60px">' + eye(40, 52, 4.6, P) + eye(56, 52, 4.6, P) + '<path d="M45 61C47 63 49 63 51 61" fill="none" stroke="' + P.d + '" stroke-width="1.4" stroke-linecap="round"/></g>' +
      '<circle cx="48" cy="50" r="30" fill="url(#' + u + 'h)" stroke="' + P.c + '" stroke-width="1.2" opacity=".85"/><path d="M28 36C30 28 38 22 46 22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>' +
      '</g>' + [[12, 20], [86, 28], [16, 70], [88, 76]].map((s, i) => '<circle class="pz-star" style="--dl:' + i * .6 + 's" cx="' + s[0] + '" cy="' + s[1] + '" r="1.4" fill="' + P.c + '"/>').join('')); },

    abobora: (o) => { const P = o.P; return wrap(o, shadow + '<g class="pz-hop soft">' +
      '<g class="pz-body"><path d="M48 32C64 30 80 42 80 64C80 84 66 92 48 92C30 92 16 84 16 64C16 42 32 30 48 32Z" fill="' + P.a + '"' + OUT(P) + '/>' +
      '<path d="M48 34C40 44 38 80 48 92M48 34C56 44 58 80 48 92M30 40C22 54 24 80 34 90M66 40C74 54 72 80 62 90" fill="none" stroke="' + P.d + '" stroke-width="1.2" opacity=".35"/>' +
      '<path d="M46 34C44 26 46 20 52 18C50 24 52 28 52 34Z" fill="#3f6212"/><path d="M52 24C58 18 66 20 68 24C62 24 58 26 54 28Z" fill="#65a30d"/></g>' +
      '<g class="pz-head pz-glowface" style="transform-origin:48px 64px"><path class="pz-eye" d="M30 56L40 50L40 60Z" fill="' + P.c + '"/><path class="pz-eye" d="M66 56L56 50L56 60Z" fill="' + P.c + '"/>' +
      '<path d="M30 70L36 76L42 70L48 76L54 70L60 76L66 70C62 82 34 82 30 70Z" fill="' + P.c + '"/></g></g>'); },

    rena: (o) => { const P = o.P; return wrap(o, shadow +
      '<g class="pz-body"><ellipse cx="48" cy="80" rx="18" ry="13" fill="#92400e"' + OUT(P) + '/><ellipse cx="48" cy="84" rx="9" ry="8" fill="#fde68a" opacity=".8"/>' +
      '<path d="M34 70C40 74 56 74 62 70L60 76C54 80 42 80 36 76Z" fill="' + P.a + '"/><circle cx="48" cy="78" r="3" fill="' + P.g + '" class="pz-core"/></g>' +
      '<g class="pz-head" style="transform-origin:48px 64px"><path d="M34 28C28 18 28 10 32 4M32 16C26 14 22 10 22 6M36 22C40 16 44 14 46 12" fill="none" stroke="#a16207" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M62 28C68 18 68 10 64 4M64 16C70 14 74 10 74 6M60 22C56 16 52 14 50 12" fill="none" stroke="#a16207" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="48" cy="46" rx="20" ry="19" fill="#b45309"' + OUT(P) + '/><ellipse cx="48" cy="56" rx="11" ry="8" fill="#fde68a"/>' + eye(40, 42, 4.4, P) + eye(56, 42, 4.4, P) +
      '<circle class="pz-nose" cx="48" cy="54" r="4.4" fill="#ef4444"/><circle cx="46.6" cy="52.6" r="1.2" fill="#fff" opacity=".8"/></g>'); },

    fenix: (o) => { const P = o.P, u = o.u; return wrap(o, '<defs>' + lin(u + 'f', [[0, P.c], [.4, P.b], [1, P.a]], 0, 1) + '</defs><g class="pz-float">' +
      '<g class="pz-tail slow" style="transform-origin:50px 70px">' + [-18, 0, 18].map((a) => '<path transform="rotate(' + a + ' 50 70)" d="M50 70C46 82 48 92 50 99C52 92 54 82 50 70Z" fill="url(#' + u + 'f)"/>').join('') + '</g>' +
      '<g class="pz-wing" style="transform-origin:40px 56px"><path d="M40 56C24 40 8 42 4 50C14 50 16 56 12 60C20 58 24 64 22 68C30 64 34 62 40 62Z" fill="url(#' + u + 'f)"/></g>' +
      '<g class="pz-wing r" style="transform-origin:58px 56px"><path d="M58 56C74 40 90 42 94 50C84 50 82 56 86 60C78 58 74 64 76 68C68 64 64 62 58 62Z" fill="url(#' + u + 'f)"/></g>' +
      '<g class="pz-body"><ellipse cx="49" cy="60" rx="12" ry="14" fill="url(#' + u + 'f)"/></g>' +
      '<g class="pz-head" style="transform-origin:49px 48px"><circle cx="49" cy="40" r="11" fill="url(#' + u + 'f)"/><path d="M49 29C46 22 48 16 52 12C52 18 55 22 53 29Z" fill="' + P.b + '"/>' +
      '<path d="M55 42L64 44L55 46Z" fill="#fbbf24"/>' + eye(46, 38, 3.4, P) + '</g>' + sparks(7, P, 'fen' + P.name, 'up') + '</g>'); }
  };
  Object.keys(PETS).forEach((k) => C.register('pet', k, PETS[k]));
})();
