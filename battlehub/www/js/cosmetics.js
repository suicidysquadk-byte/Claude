/* Visual da loja: acessórios de avatar (imagens 3D licenciadas), fundos animados e banners animados (desenhados em SVG/CSS) */
window.BH = window.BH || {};
(function () {
  // sorteio fixo por semente: os efeitos ficam iguais a cada render (sem pular)
  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const f = (n) => Math.round(n * 100) / 100;

  /* ---------------- acessórios (imagens 3D do Fluent Emoji, da Microsoft, licença MIT) ----------------
     Posição em % da caixa do avatar: x/y = canto de cima à esquerda, w = largura, r = giro, back = atrás da foto */
  const ACC = {
    coroa: { x: 18, y: -38, w: 64, r: -10 },
    palha: { x: -2, y: -68, w: 104, r: -8 },
    cartola: { x: 15, y: -58, w: 70, r: -10 },
    bone: { x: 0, y: -40, w: 92, r: -6 },
    capacete: { x: 2, y: -66, w: 96, r: -3 },
    headset: { x: -9, y: -30, w: 118, r: 0 },
    oculos: { x: 13, y: 10, w: 74, r: 0 },
    goggles: { x: 14, y: -30, w: 72, r: -4 },
    laco: { x: 58, y: -18, w: 46, r: 18 },
    sakura: { x: 62, y: -10, w: 42, r: 12 },
    oni: { x: 62, y: -24, w: 52, r: 22 },
    tengu: { x: 62, y: -24, w: 52, r: 22 },
    capelo: { x: 10, y: -44, w: 80, r: -8 },
    asas: { x: 60, y: -4, w: 70, r: 6, back: true, pair: true }
  };
  const accImg = (key, a, flip) => '<img class="acc acc-' + key + (a.back ? ' acc-back' : '') + '" src="img/acessorios/' + key + '.webp" alt="" draggable="false" style="left:' +
    (flip ? 100 - a.x - a.w : a.x) + '%;top:' + a.y + '%;width:' + a.w + '%;transform:rotate(' + (flip ? -a.r : a.r) + 'deg)' + (flip ? ' scaleX(-1)' : '') + '">';
  const acc = (key) => { const a = ACC[key]; return a ? accImg(key, a) + (a.pair ? accImg(key, a, true) : '') : ''; };

  /* ---------------- partículas (fundos e banners) ---------------- */
  function parts(kind, n, seed, make) {
    const r = rng(kind + seed);
    let s = '';
    for (let i = 0; i < n; i++) s += make(r, i);
    return s;
  }
  const KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';
  const FX = {
    gold: (sd) => parts('g', 14, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--y:' + f(r() * 100) + '%;--s:' + f(2 + r() * 4) + 'px;--d:' + f(7 + r() * 9) + 's;--dl:-' + f(r() * 14) + 's"></i>'),
    sakura: (sd) => parts('s', 10, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--s:' + f(7 + r() * 7) + 'px;--d:' + f(8 + r() * 8) + 's;--dl:-' + f(r() * 16) + 's;--sw:' + f(20 + r() * 50) + 'px"></i>'),
    galaxy: (sd) => '<b class="neb"></b>' + parts('gx', 22, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--y:' + f(r() * 100) + '%;--s:' + f(1 + r() * 2.5) + 'px;--d:' + f(2 + r() * 4) + 's;--dl:-' + f(r() * 6) + 's"></i>'),
    embers: (sd) => parts('e', 12, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--s:' + f(2 + r() * 3.5) + 'px;--d:' + f(4 + r() * 6) + 's;--dl:-' + f(r() * 10) + 's;--sw:' + f(-30 + r() * 60) + 'px"></i>'),
    rain: (sd) => parts('r', 16, sd, (r, i) => '<i class="' + (i % 3 ? 'c' : 'm') + '" style="--x:' + f(r() * 100) + '%;--h:' + f(14 + r() * 26) + 'px;--d:' + f(.6 + r() * .8) + 's;--dl:-' + f(r() * 2) + 's"></i>'),
    aurora: () => '<b class="au a1"></b><b class="au a2"></b><b class="au a3"></b>',
    matrix: (sd) => parts('m', 8, sd, (r) => {
      let col = '';
      for (let k = 0; k < 14; k++) col += KANA.charAt(Math.floor(r() * KANA.length));
      return '<i style="--x:' + f(r() * 100) + '%;--d:' + f(5 + r() * 7) + 's;--dl:-' + f(r() * 12) + 's">' + col + '</i>';
    }),
    storm: (sd) => '<b class="flash"></b><svg class="bolt" viewBox="0 0 40 120" aria-hidden="true"><path d="M24 0 8 54h12L10 120 34 44H21L30 0Z"/></svg>' +
      parts('st', 12, sd, (r) => '<i class="c" style="--x:' + f(r() * 100) + '%;--h:' + f(14 + r() * 22) + 'px;--d:' + f(.5 + r() * .6) + 's;--dl:-' + f(r() * 2) + 's"></i>')
  };
  // camada de fundo animado (perfil)
  const fx = (key, seed, extra) => (FX[key] ? '<div class="fx fx-' + key + (extra ? ' ' + extra : '') + '" aria-hidden="true">' + FX[key](seed || key) + '</div>' : '');

  /* ---------------- banners ---------------- */
  const ART = {
    torii: '<circle cx="330" cy="40" r="24" fill="#ffd1e4" opacity=".85"/><g fill="#12040f"><path d="M232 46h150l-8 10H240Z"/><rect x="246" y="62" width="122" height="7"/>' +
      '<rect x="256" y="52" width="9" height="88"/><rect x="349" y="52" width="9" height="88"/><rect x="302" y="56" width="9" height="12"/><path d="M226 40q81-12 162 0l-4 7q-77-10-154 0Z"/></g>' +
      '<path d="M0 140V122q60-12 120-4t110-6 170 8v20Z" fill="#12040f" opacity=".9"/>',
    kitsune: '<g fill="#050b18">' + [-58, -40, -22, -6, 8, 22, 38, 54, 70].map((a) => '<path transform="rotate(' + a + ' 300 110)" d="M300 110c-8-30-4-62 14-86 4 26 2 58-10 88Z"/>').join('') +
      '<path d="M272 140c0-26 8-44 24-54l-4-22 14 14 14-14-4 22c16 10 24 28 24 54Z"/></g>' +
      '<g class="wisp" fill="#5ab8ff"><path d="M250 70c-6-10 0-22 8-26-2 8 4 12 2 20-2 5-7 8-10 6Z"/><path d="M356 54c-6-10 0-22 8-26-2 8 4 12 2 20-2 5-7 8-10 6Z"/><path d="M372 104c-5-8 0-18 6-21-1 6 3 10 2 16-2 4-6 6-8 5Z"/></g>',
    city: '<g fill="#0a0418">' + [[200, 70, 24], [226, 44, 30], [258, 84, 20], [280, 30, 26], [308, 60, 22], [332, 20, 30], [364, 74, 18], [384, 50, 16], [150, 90, 30], [120, 100, 26]].map((b) => '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (140 - b[1]) + '"/>').join('') + '</g>' +
      '<g class="neon">' + parts('w', 24, 'city', (r) => '<rect x="' + f(122 + r() * 270) + '" y="' + f(36 + r() * 96) + '" width="3" height="4" fill="' + (r() > .5 ? '#ff4fd8' : '#48e5ff') + '" opacity="' + f(.4 + r() * .6) + '"/>') + '</g>' +
      '<rect x="336" y="26" width="3" height="40" fill="#ff4fd8" class="sign"/>',
    samurai: '<circle class="moon-c" cx="300" cy="62" r="46" fill="#e0203a"/><g fill="#0b0102"><path d="M286 140l4-40-12-16 6-20c4-8 12-12 20-10 8-2 14 6 12 14l-2 10 10 22-6 40Z"/>' +
      '<path d="M290 58q14-16 30 0l-4 2q-11-9-22 0Z"/><path d="M322 84 386 22l3 3-62 66Z"/><path d="M0 140V128q100-10 200-4t200 0v16Z"/></g>',
    wave: '<g class="wave-g"><path d="M160 140c10-50 60-96 120-96 40 0 64 22 62 44-14-18-40-22-58-6 20-4 34 6 36 20-22-12-52-6-64 16-10 18-6 22-6 22Z" fill="#1d4e89"/>' +
      '<path d="M178 140c14-40 56-78 104-80 26 0 44 12 50 26-16-10-40-8-52 6" fill="none" stroke="#f3ecd9" stroke-width="5" stroke-linecap="round"/>' +
      parts('wv', 9, 'wave', (r, i) => '<circle cx="' + f(282 + i * 7) + '" cy="' + f(52 + Math.sin(i) * 4) + '" r="' + f(3 + r() * 2) + '" fill="#f3ecd9"/>') +
      '<path d="M0 140v-18q40-14 80 0t80 0 80 0 80 0 80 0v18Z" fill="#2b5fa0"/></g><circle cx="90" cy="40" r="16" fill="#c8242b" opacity=".85"/>',
    dragon: '<path class="drg" d="M400 30C350 10 300 60 250 50S170 10 130 40 90 110 40 100" fill="none" stroke="#f6c453" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M400 30C350 10 300 60 250 50S170 10 130 40 90 110 40 100" fill="none" stroke="#7a5410" stroke-width="12" stroke-dasharray="3 7" stroke-linecap="round" opacity=".6"/>' +
      '<path d="M40 100l-18-6 8 14-14 2 16 8" fill="#f6c453" stroke="#7a5410" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M388 26l12-18 4 16 14-6-8 14" fill="#f6c453" stroke="#7a5410" stroke-width="1.5" stroke-linejoin="round"/>'
  };
  const BANNER_FX = {
    embers: (sd) => FX.embers(sd), sakura: (sd) => FX.sakura(sd), rain: (sd) => FX.rain(sd),
    lightning: (sd) => FX.storm(sd), flames: (sd) => parts('fl', 5, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--s:' + f(30 + r() * 40) + 'px;--d:' + f(1.4 + r() * 1.4) + 's;--dl:-' + f(r() * 2) + 's"></i>'),
    grain: () => '', shimmer: () => '<b class="sweep"></b>', goldline: () => '<b class="gline"></b>', moon: () => '', waves: () => ''
  };
  // classes e camadas de um banner: data = { bg, anim, art }
  function banner(d, cls, extraHtml, seed) {
    d = d || {};
    const anim = d.anim && BANNER_FX[d.anim] ? d.anim : '';
    return '<div class="' + (cls || 'p-banner') + (anim ? ' bn bn-' + anim : '') + (d.art ? ' has-art' : '') + '" style="background:' + BH.ui.esc(d.bg || '') + '">' +
      (anim ? '<div class="bn-fx fx-' + (anim === 'lightning' ? 'storm' : anim) + '" aria-hidden="true">' + BANNER_FX[anim](seed || anim) + '</div>' : '') +
      (d.art && ART[d.art] ? '<svg class="bn-art art-' + d.art + '" viewBox="0 0 400 140" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">' + ART[d.art] + '</svg>' : '') +
      (cls && cls.indexOf('banner-sw') >= 0 ? '' : '<span class="p-pattern"></span>') + (extraHtml || '') + '</div>';
  }

  // ART, FX e BANNER_FX ficam abertos para js/visuais.js acrescentar cenas e efeitos novos
  BH.cos = Object.assign(BH.cos || {}, { acc, fx, banner, ART, FX, BANNER_FX, ACC_KEYS: Object.keys(ACC), FX_KEYS: Object.keys(FX) });
})();
