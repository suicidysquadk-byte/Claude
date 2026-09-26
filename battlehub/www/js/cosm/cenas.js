/* Cenas animadas que servem em proporções diferentes: banner (cabeçalho 400x140), capa (400x240, atrás da vitrine)
   e fundo (360x720, a página inteira). A mesma cena se ajusta pela largura e altura recebidas.
   Aqui também ficam os temas (padrão + paleta aplicados ao perfil) e as cores de nick com efeito. */
(function () {
  const C = BH.cosm;
  const { lin, rad, svg, pol, around } = C;
  const f = (n) => Math.round(n * 10) / 10;
  const parts = (seed, n, fn) => { const r = C.rng(seed); let s = ''; for (let i = 0; i < n; i++) s += fn(r, i); return s; };

  /* ---------------- temas: padrão em mosaico + cores do perfil ---------------- */
  const PAT = {
    liso: () => '',
    futurista: (P) => '<path d="M20 2L37 12V32L20 42L3 32V12Z" fill="none" stroke="' + P.a + '" stroke-width="1"/>',
    cyberpunk: (P) => '<path d="M0 40L40 0" stroke="' + P.a + '" stroke-width="2"/><circle cx="30" cy="30" r="1.6" fill="' + P.b + '"/>',
    samurai: (P) => '<circle cx="20" cy="40" r="18" fill="none" stroke="' + P.a + '" stroke-width="1.2"/><circle cx="20" cy="40" r="12" fill="none" stroke="' + P.a + '" stroke-width="1"/><circle cx="0" cy="20" r="18" fill="none" stroke="' + P.b + '" stroke-width="1"/><circle cx="40" cy="20" r="18" fill="none" stroke="' + P.b + '" stroke-width="1"/>',
    ninja: (P) => '<path d="M20 0V40M0 20H40M0 0L40 40M40 0L0 40" stroke="' + P.a + '" stroke-width=".6"/><path d="M20 14L22 20L20 26L18 20Z" fill="' + P.b + '"/>',
    medieval: (P) => '<path d="M20 4L36 20L20 36L4 20Z" fill="none" stroke="' + P.b + '" stroke-width="1"/><circle cx="20" cy="20" r="2.4" fill="' + P.a + '"/>',
    espacial: (P) => '<circle cx="6" cy="8" r="1" fill="#fff"/><circle cx="28" cy="18" r=".7" fill="' + P.c + '"/><circle cx="16" cy="32" r="1.2" fill="' + P.b + '"/>',
    dark: (P) => '<circle cx="10" cy="10" r=".8" fill="' + P.c + '"/><circle cx="30" cy="30" r=".8" fill="' + P.c + '"/>',
    royal: (P) => '<path d="M20 2C26 10 26 14 20 20C14 14 14 10 20 2ZM20 38C26 30 26 26 20 20C14 26 14 30 20 38Z" fill="none" stroke="' + P.b + '" stroke-width="1"/><circle cx="0" cy="20" r="2" fill="' + P.b + '"/><circle cx="40" cy="20" r="2" fill="' + P.b + '"/>',
    demoniaco: (P) => '<path d="M4 40L10 22L16 40ZM24 40L30 26L36 40Z" fill="' + P.a + '" opacity=".8"/>',
    angelical: (P) => '<path d="M20 36C10 30 8 16 20 4C24 16 26 28 20 36Z" fill="none" stroke="' + P.a + '" stroke-width="1"/>',
    galaxia: (P) => '<path d="M20 20m-10 0a10 10 0 1 1 20 0a6 6 0 1 1 -12 0" fill="none" stroke="' + P.b + '" stroke-width="1"/><circle cx="36" cy="6" r="1" fill="#fff"/>',
    fogo: (P) => '<path d="M20 36C10 30 14 20 18 14C18 22 24 22 22 10C30 18 30 30 20 36Z" fill="' + P.a + '" opacity=".7"/>',
    gelo: (P) => '<g stroke="' + P.a + '" stroke-width="1.2" stroke-linecap="round">' + around(6, (a) => '<path transform="rotate(' + a + ' 20 20)" d="M20 20V8M20 12L17 9M20 12L23 9"/>') + '</g>',
    eletrico: (P) => '<path d="M0 20L8 12L14 26L22 8L28 24L34 14L40 20" fill="none" stroke="' + P.b + '" stroke-width="1.2"/>',
    shadow: (P) => '<circle cx="12" cy="14" r="9" fill="' + P.b + '" opacity=".35"/><circle cx="32" cy="32" r="6" fill="' + P.a + '" opacity=".5"/>',
    tech: (P) => '<path d="M0 10H14L20 16V40M40 28H26L22 24" fill="none" stroke="' + P.a + '" stroke-width="1"/><circle cx="20" cy="16" r="2" fill="' + P.a + '"/><circle cx="22" cy="24" r="1.6" fill="' + P.c + '"/>',
    street: (P) => '<path d="M0 10H40M0 30H40M20 10V30M0 30V40M40 30V40M10 0V10M30 0V10" stroke="' + P.a + '" stroke-width="1"/><circle cx="30" cy="20" r="3" fill="' + P.b + '" opacity=".6"/>',
    militar: (P) => '<path d="M0 8C8 2 16 12 22 6C30 0 36 8 40 4V16C32 20 24 12 16 18C10 22 4 16 0 20Z" fill="' + P.b + '" opacity=".45"/><path d="M4 30C12 26 18 34 26 30C32 27 36 34 40 32V40H0Z" fill="' + P.a + '" opacity=".5"/>',
    mistico: (P) => '<circle cx="20" cy="20" r="12" fill="none" stroke="' + P.a + '" stroke-width="1"/><path d="' + around(6, (a, i) => { const p = pol(20, 20, 12, a); return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }) + 'Z" fill="none" stroke="' + P.b + '" stroke-width=".8"/>',
    fantasia: (P) => '<path d="M10 6l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4Z" fill="' + P.a + '"/><path d="M30 26l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="' + P.b + '"/>',
    arcade: (P) => '<rect x="4" y="4" width="6" height="6" fill="' + P.a + '"/><rect x="24" y="24" width="6" height="6" fill="' + P.b + '"/><rect x="30" y="4" width="4" height="4" fill="' + P.g + '"/>',
    neon: (P) => '<path d="M0 0H40V40" fill="none" stroke="' + P.g + '" stroke-width="1"/>'
  };
  C.THEME_PATTERNS = Object.keys(PAT);
  Object.keys(PAT).forEach((k) => C.register('tema', k, (o) => {
    const P = o.P, u = o.u;
    const inner = '<defs><pattern id="' + u + 'tp" width="40" height="40" patternUnits="userSpaceOnUse">' + PAT[k](P) + '</pattern>' +
      rad(u + 'tg', [[0, P.g, .35], [1, P.g, 0]]) + '</defs>' +
      '<rect width="400" height="400" fill="' + P.d + '"/><ellipse cx="200" cy="40" rx="260" ry="180" fill="url(#' + u + 'tg)"/>' +
      '<g class="tm-drift"><rect x="-40" y="-40" width="480" height="480" fill="url(#' + u + 'tp)" opacity=".5"/></g>';
    return svg('0 0 400 400', inner, 'tm tm-' + k + (o.still ? ' still' : ''), ' preserveAspectRatio="xMidYMid slice"');
  }));
  // variáveis de cor do tema, para bordas, botões e brilho do perfil
  C.themeVars = (P) => '--ta:' + P.a + ';--tb:' + P.b + ';--tc:' + P.c + ';--td:' + P.d + ';--tg:' + P.g + ';';

  /* ---------------- cores de nick com efeito ---------------- */
  const NK = ['solida', 'grad', 'rgb', 'brilho', 'neon', 'fogo', 'gelo', 'galaxia', 'metal', 'glitch'];
  NK.forEach((k) => C.register('cor', k, (o) => {
    const P = o.P;
    const nick = String((o.user && o.user.nick) || 'Seu nick').replace(/[<>&"]/g, '');
    return '<b class="nk nkfx nkfx-' + k + (o.still ? ' still' : '') + '" data-t="' + nick + '" style="--c1:' + P.a + ';--c2:' + P.b + ';--c3:' + P.g + ';--c4:' + P.c + '">' + nick + '</b>';
  }));
  C.NICK_FX = NK;
})();
