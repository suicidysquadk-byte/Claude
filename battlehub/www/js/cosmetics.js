/* Visual da loja: acessórios de avatar, fundos animados e banners animados (arte própria, desenhada em SVG/CSS) */
window.BH = window.BH || {};
(function () {
  // sorteio fixo por semente: os efeitos ficam iguais a cada render (sem pular)
  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const f = (n) => Math.round(n * 100) / 100;

  /* ---------------- acessórios (sobre o avatar; 0..100 = caixa do avatar) ---------------- */
  // coroa de louros: folhas ao longo do alto da cabeça, dos dois lados
  function laurel() {
    let s = '';
    for (let i = 0; i < 7; i++) {
      const t = 192 + i * 12;
      [t, 180 - t].forEach((a, side) => {
        const x = 50 + Math.cos(a * Math.PI / 180) * 54, y = 50 + Math.sin(a * Math.PI / 180) * 54;
        s += '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="3.4" ry="7.6" transform="rotate(' + f(a + (side ? -22 : 22)) + ' ' + f(x) + ' ' + f(y) + ')" fill="' + (i % 2 ? '#e2b24a' : '#f6c453') + '" stroke="#7a5410" stroke-width=".9"/>';
      });
    }
    return s + '<circle cx="50" cy="-3" r="3.2" fill="#f6c453" stroke="#7a5410" stroke-width=".9"/>';
  }
  const ACC = {
    bruxa: '<g transform="rotate(-12 50 10)"><path d="M28 13C34-6 45-22 72-31 61-20 60-6 73 13Z" fill="#2a1747" stroke="#120a22" stroke-width="1.4"/>' +
      '<path d="M62-24C58-12 58-2 64 10" fill="none" stroke="#3d2466" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M4 15C28 3 72 3 96 15 80 23 20 23 4 15Z" fill="#1b1030" stroke="#0b0614" stroke-width="1.5"/>' +
      '<path d="M29 8C45 11 58 11 72 8L73 13C58 16 44 16 28 13Z" fill="#d9a93f"/>' +
      '<rect x="44.5" y="7.2" width="10" height="7" rx="1.6" fill="none" stroke="#fff0c4" stroke-width="1.7"/></g>',
    palha: '<g transform="rotate(-6 50 12)"><ellipse cx="50" cy="13" rx="52" ry="11.5" fill="#e8c56b" stroke="#9c7a2c" stroke-width="1.5"/>' +
      '<path d="M6 13Q50 24 94 13M14 8Q50 17 86 8" fill="none" stroke="#b8923f" stroke-width=".8" opacity=".75"/>' +
      '<path d="M24 13C24-12 76-12 76 13Z" fill="#f0d27e" stroke="#9c7a2c" stroke-width="1.5"/>' +
      '<path d="M32 0Q50 -6 68 0M28 5Q50 0 72 5" fill="none" stroke="#c9a24a" stroke-width=".8" opacity=".8"/>' +
      '<path d="M24.4 6.5C40 10.5 60 10.5 75.6 6.5L76 13C60 17 40 17 24 13Z" fill="#c8242b"/></g>',
    coroa: '<path d="M22 15 18-12 34 2 50-19 66 2 82-12 78 15Z" fill="#f2c14e" stroke="#7a5410" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M24 11 21-6 34 5 50-12 66 5 79-6 76 11Z" fill="#ffd978" opacity=".55"/>' +
      '<rect x="20.5" y="11" width="59" height="9" rx="2.2" fill="#d9a93f" stroke="#7a5410" stroke-width="1.4"/>' +
      '<circle cx="50" cy="-15" r="4" fill="#e11d48" stroke="#7a1026" stroke-width="1"/><circle cx="18" cy="-12" r="3" fill="#fff3cf"/><circle cx="82" cy="-12" r="3" fill="#fff3cf"/>' +
      '<circle cx="35" cy="15.5" r="2.6" fill="#2563eb"/><circle cx="50" cy="15.5" r="3" fill="#e11d48"/><circle cx="65" cy="15.5" r="2.6" fill="#16a34a"/>',
    aureola: '<g class="acc-float"><ellipse cx="50" cy="-9" rx="31" ry="8.5" fill="none" stroke="#f6c453" stroke-width="6" opacity=".35"/>' +
      '<ellipse cx="50" cy="-9" rx="31" ry="8.5" fill="none" stroke="#fff3c4" stroke-width="3.2"/></g>',
    chifres: '<path d="M25 17C13 5 13-10 21-22 24-9 31 2 38 11Z" fill="#b3122a" stroke="#5c0612" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M75 17C87 5 87-10 79-22 76-9 69 2 62 11Z" fill="#b3122a" stroke="#5c0612" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M22 10C18 2 18-8 21-16M78 10C82 2 82-8 79-16" fill="none" stroke="#f87171" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>',
    gato: '<path d="M13 28 15-7 41 10Z" fill="#141414" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/><path d="M19 21 20 2 34 11Z" fill="#f5a3b8"/>' +
      '<path d="M87 28 85-7 59 10Z" fill="#141414" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/><path d="M81 21 80 2 66 11Z" fill="#f5a3b8"/>',
    headset: '<path d="M7 50C7-3 93-3 93 50" fill="none" stroke="#18181d" stroke-width="7.5" stroke-linecap="round"/>' +
      '<path d="M12 36C16 8 84 8 88 36" fill="none" stroke="#3b3b46" stroke-width="1.6" stroke-linecap="round"/>' +
      '<rect x="-5" y="37" width="17" height="27" rx="7.5" fill="#18181d" stroke="#000" stroke-width="1"/><rect x="88" y="37" width="17" height="27" rx="7.5" fill="#18181d" stroke="#000" stroke-width="1"/>' +
      '<rect class="acc-led" x="-2" y="43" width="4" height="15" rx="2" fill="#f6c453"/><rect class="acc-led" x="98" y="43" width="4" height="15" rx="2" fill="#f6c453"/>',
    bandana: '<g class="acc-tail"><path d="M91 24C104 26 113 35 119 46 108 41 100 37 91 33Z" fill="#1d3b8a"/><path d="M90 28C101 35 106 47 107 60 99 51 95 43 89 35Z" fill="#23479f"/></g>' +
      '<path d="M8 23C30 12 70 12 92 23L92 33C70 22 30 22 8 33Z" fill="#1d3b8a" stroke="#0c1a40" stroke-width="1.2"/>' +
      '<rect x="36" y="14.5" width="28" height="14" rx="2.6" fill="#cfd5de" stroke="#6b7280" stroke-width="1.2"/>' +
      '<path d="M43 21.5h14M50 17.5v8" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/><path d="M38 16.5h24" stroke="#fff" stroke-width=".9" opacity=".7"/>',
    kabuto: '<path d="M9 31C9-10 91-10 91 31Z" fill="#23232b" stroke="#0e0e12" stroke-width="1.5"/>' +
      '<path d="M30-2C34 10 34 20 32 31M50-7V31M70-2C66 10 66 20 68 31" stroke="#3b3b47" stroke-width="2" fill="none"/>' +
      '<path d="M3 31C20 25 80 25 97 31L101 39C80 33 20 33-1 39Z" fill="#8a1c1c" stroke="#4a0a0a" stroke-width="1.2"/>' +
      '<path d="M50 5C40-6 30-20 17-31 34-27 44-17 50-5 56-17 66-27 83-31 70-20 60-6 50 5Z" fill="#e2b24a" stroke="#7a5410" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="7" r="5.2" fill="#f6c453" stroke="#7a5410" stroke-width="1.2"/>',
    oni: '<g transform="translate(83 6) rotate(24)"><path d="M-17-6C-17-22 17-22 17-6 17 10 10 20 0 20-10 20-17 10-17-6Z" fill="#c8242b" stroke="#5c0612" stroke-width="1.3"/>' +
      '<path d="M-12-16-16-31-6-19ZM12-16 16-31 6-19Z" fill="#f3e6c8" stroke="#8a7a5a" stroke-width="1"/>' +
      '<path d="M-11-6-3-4-10 0ZM11-6 3-4 10 0Z" fill="#f6c453"/><path d="M-13-10-2-7M13-10 2-7" stroke="#2a0306" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M-9 8C-4 12 4 12 9 8L7 12C3 15-3 15-7 12Z" fill="#2a0306"/><path d="M-6 9-5 13-4 9.5ZM6 9 5 13 4 9.5Z" fill="#fff"/></g>',
    louros: laurel()
  };
  const acc = (key) => (ACC[key] ? '<svg class="acc acc-' + key + '" viewBox="-30 -30 160 160" aria-hidden="true">' + ACC[key] + '</svg>' : '');

  /* ---------------- partículas (fundos e banners) ---------------- */
  function parts(kind, n, seed, make) {
    const r = rng(kind + seed);
    let s = '';
    for (let i = 0; i < n; i++) s += make(r, i);
    return s;
  }
  const KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';
  const FX = {
    gold: (sd) => parts('g', 26, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--y:' + f(r() * 100) + '%;--s:' + f(2 + r() * 4) + 'px;--d:' + f(7 + r() * 9) + 's;--dl:-' + f(r() * 14) + 's"></i>'),
    sakura: (sd) => parts('s', 16, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--s:' + f(7 + r() * 7) + 'px;--d:' + f(8 + r() * 8) + 's;--dl:-' + f(r() * 16) + 's;--sw:' + f(20 + r() * 50) + 'px"></i>'),
    galaxy: (sd) => '<b class="neb"></b>' + parts('gx', 42, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--y:' + f(r() * 100) + '%;--s:' + f(1 + r() * 2.5) + 'px;--d:' + f(2 + r() * 4) + 's;--dl:-' + f(r() * 6) + 's"></i>'),
    embers: (sd) => parts('e', 24, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--s:' + f(2 + r() * 3.5) + 'px;--d:' + f(4 + r() * 6) + 's;--dl:-' + f(r() * 10) + 's;--sw:' + f(-30 + r() * 60) + 'px"></i>'),
    rain: (sd) => parts('r', 34, sd, (r, i) => '<i class="' + (i % 3 ? 'c' : 'm') + '" style="--x:' + f(r() * 100) + '%;--h:' + f(14 + r() * 26) + 'px;--d:' + f(.6 + r() * .8) + 's;--dl:-' + f(r() * 2) + 's"></i>'),
    aurora: () => '<b class="au a1"></b><b class="au a2"></b><b class="au a3"></b>',
    matrix: (sd) => parts('m', 16, sd, (r) => {
      let col = '';
      for (let k = 0; k < 14; k++) col += KANA.charAt(Math.floor(r() * KANA.length));
      return '<i style="--x:' + f(r() * 100) + '%;--d:' + f(5 + r() * 7) + 's;--dl:-' + f(r() * 12) + 's">' + col + '</i>';
    }),
    storm: (sd) => '<b class="flash"></b><svg class="bolt" viewBox="0 0 40 120" aria-hidden="true"><path d="M24 0 8 54h12L10 120 34 44H21L30 0Z"/></svg>' +
      parts('st', 26, sd, (r) => '<i class="c" style="--x:' + f(r() * 100) + '%;--h:' + f(14 + r() * 22) + 'px;--d:' + f(.5 + r() * .6) + 's;--dl:-' + f(r() * 2) + 's"></i>')
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
      '<g class="neon">' + parts('w', 40, 'city', (r) => '<rect x="' + f(122 + r() * 270) + '" y="' + f(36 + r() * 96) + '" width="3" height="4" fill="' + (r() > .5 ? '#ff4fd8' : '#48e5ff') + '" opacity="' + f(.4 + r() * .6) + '"/>') + '</g>' +
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
    lightning: (sd) => FX.storm(sd), flames: (sd) => parts('fl', 7, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--s:' + f(30 + r() * 40) + 'px;--d:' + f(1.4 + r() * 1.4) + 's;--dl:-' + f(r() * 2) + 's"></i>'),
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

  BH.cos = { acc, fx, banner, ACC_KEYS: Object.keys(ACC), FX_KEYS: Object.keys(FX) };
})();
