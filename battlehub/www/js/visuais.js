/* Cenas novas de banner e fundos animados do perfil (desenhados aqui, sem imagens de terceiros).
   Entram nas bibliotecas de js/cosmetics.js: BH.cos.ART, BH.cos.BANNER_FX e BH.cos.FX. */
window.BH = window.BH || {};
(function () {
  const C = BH.cos;
  if (!C || !C.ART) return;
  const f = (n) => Math.round(n * 100) / 100;
  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const parts = (kind, n, seed, make) => { const r = rng(kind + seed); let s = ''; for (let i = 0; i < n; i++) s += make(r, i); return s; };

  /* ---------------- cenas de banner (400x140, desenhadas à direita) ---------------- */
  Object.assign(C.ART, {
    fenix: '<defs><linearGradient id="bfx" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7a0010"/><stop offset=".45" stop-color="#ff3d00"/><stop offset=".8" stop-color="#ffb020"/><stop offset="1" stop-color="#fff3b0"/></linearGradient></defs>' +
      '<g class="bn-wing" fill="url(#bfx)">' +
      [0, 1, 2, 3, 4, 5].map((i) => '<path d="M300 92C' + (262 - i * 14) + ' ' + (78 - i * 10) + ' ' + (236 - i * 16) + ' ' + (40 - i * 4) + ' ' + (206 - i * 12) + ' ' + (22 + i * 2) + 'C' + (246 - i * 8) + ' ' + (50 - i * 3) + ' ' + (270 - i * 4) + ' ' + (62 + i * 2) + ' 300 92Z" opacity="' + f(1 - i * .1) + '"/>').join('') +
      [0, 1, 2, 3, 4, 5].map((i) => '<path d="M300 92C' + (338 + i * 14) + ' ' + (78 - i * 10) + ' ' + (364 + i * 16) + ' ' + (40 - i * 4) + ' ' + (394 + i * 2) + ' ' + (22 + i * 2) + 'C' + (354 + i * 8) + ' ' + (50 - i * 3) + ' ' + (330 + i * 4) + ' ' + (62 + i * 2) + ' 300 92Z" opacity="' + f(1 - i * .1) + '"/>').join('') + '</g>' +
      '<path d="M300 58C292 70 292 84 300 96C308 84 308 70 300 58Z" fill="#fff3b0"/><path d="M300 96C290 112 292 128 300 140C308 128 310 112 300 96Z" fill="url(#bfx)"/>' +
      '<path d="M300 58C296 50 298 42 304 38C302 46 306 50 304 56Z" fill="#ffb020"/>',
    coroa: '<defs><linearGradient id="bcr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#ffd766"/><stop offset=".7" stop-color="#c9901e"/><stop offset="1" stop-color="#6b4308"/></linearGradient>' +
      '<radialGradient id="bcl"><stop offset="0" stop-color="#fff5cc" stop-opacity=".9"/><stop offset="1" stop-color="#fff5cc" stop-opacity="0"/></radialGradient></defs>' +
      '<g class="bn-rays">' + [...Array(14)].map((_, i) => '<path transform="rotate(' + (i * 25.7) + ' 300 70)" d="M297 70L300 -60L303 70Z" fill="url(#bcl)" opacity=".5"/>').join('') + '</g>' +
      '<g transform="translate(300 84)"><path d="M-62 14L-74 -44L-38 -18L0 -60L38 -18L74 -44L62 14Z" fill="url(#bcr)" stroke="#6b4308" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="-64" y="8" width="128" height="16" rx="4" fill="url(#bcr)" stroke="#6b4308" stroke-width="1.6"/>' +
      '<path d="M0 -42l9 14-9 14-9-14Z" fill="#c1121f" stroke="#fff6d8"/><path d="M-40 16l6 6-6 6-6-6Z M40 16l6 6-6 6-6-6Z M0 16l6 6-6 6-6-6Z" fill="#1d4ed8" stroke="#fff6d8"/>' +
      '<circle cx="-74" cy="-44" r="6" fill="#fffbe6"/><circle cx="74" cy="-44" r="6" fill="#fffbe6"/><circle cx="0" cy="-60" r="7" fill="#fffbe6"/></g>',
    mira: '<g fill="none" stroke="#e5e7eb" stroke-width="2"><circle cx="300" cy="70" r="54" stroke-width="3"/><circle cx="300" cy="70" r="36" opacity=".6"/>' +
      '<path d="M300 8V52M300 88V132M238 70H282M318 70H362" stroke-width="2.5"/>' + [...Array(8)].map((_, i) => '<path d="M' + (300 - 32 + i * 8) + ' 67V73" opacity=".7"/>').join('') + '</g>' +
      '<circle class="bn-dot" cx="300" cy="70" r="4" fill="#ff1f3d"/><path class="bn-laser" d="M0 118L296 72" stroke="#ff1f3d" stroke-width="1.2" opacity=".55"/>' +
      '<text x="352" y="128" font-family="monospace" font-size="10" fill="#e5e7eb" opacity=".8">312m</text>',
    lobo: '<circle cx="318" cy="46" r="36" fill="#f1f5f9"/><circle cx="306" cy="38" r="6" fill="#cbd5e1" opacity=".7"/><circle cx="330" cy="58" r="4" fill="#cbd5e1" opacity=".7"/>' +
      '<g fill="#070b14"><path d="M0 140V124C60 116 110 130 170 118S250 96 300 108 380 118 400 110V140Z"/>' +
      '<path d="M226 112L236 80L244 70L240 58L248 62L256 46L262 60L272 64L268 72L276 78L274 92L262 98L260 112Z"/><path d="M256 46L252 32L262 44Z"/></g>',
    synth: '<defs><linearGradient id="bsy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd319"/><stop offset=".5" stop-color="#ff2975"/><stop offset="1" stop-color="#8c1eff"/></linearGradient></defs>' +
      '<circle cx="300" cy="70" r="44" fill="url(#bsy)"/>' + [0, 1, 2, 3, 4].map((i) => '<rect x="250" y="' + (78 + i * 7) + '" width="100" height="' + (2 + i * .6) + '" fill="#1a0033"/>').join('') +
      '<rect x="0" y="100" width="400" height="40" fill="#1a0033"/><g class="bn-grid" stroke="#ff2975" stroke-width="1" opacity=".8">' +
      [...Array(9)].map((_, i) => '<path d="M' + (200 + (i - 4) * 12) + ' 100L' + (200 + (i - 4) * 110) + ' 140"/>').join('') + [0, 1, 2, 3].map((i) => '<path class="hl" d="M0 ' + (104 + i * i * 3.4) + 'H400"/>').join('') + '</g>',
    montanha: '<defs><linearGradient id="bmn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb57a"/><stop offset="1" stop-color="#ff7a59" stop-opacity="0"/></linearGradient></defs>' +
      '<circle cx="300" cy="96" r="34" fill="#ffd9a0"/><rect x="0" y="0" width="400" height="140" fill="url(#bmn)" opacity=".35"/>' +
      '<path d="M120 140L200 60L250 104L300 50L380 140Z" fill="#6d3b5b"/><path d="M290 58L300 50L312 62L302 64Z" fill="#f8e7ef"/>' +
      '<path d="M0 140L90 84L150 118L220 78L300 124L360 92L400 118V140Z" fill="#3d1f3c"/><path d="M0 140V128L80 110L160 132L260 114L340 134L400 122V140Z" fill="#1e0f22"/>',
    caveira: '<g transform="translate(300 70)"><g stroke="#9ca3af" stroke-width="7" stroke-linecap="round"><path d="M-70 50L70 -40"/><path d="M-70 -40L70 50"/></g>' +
      '<g stroke="#4b5563" stroke-width="3"><path d="M-70 50L70 -40"/><path d="M-70 -40L70 50"/></g>' +
      '<path d="M0 -48C-30 -48 -40 -26 -38 -6C-37 6 -30 12 -26 16V30H26V16C30 12 37 6 38 -6C40 -26 30 -48 0 -48Z" fill="#f5f5f4"/>' +
      '<ellipse cx="-15" cy="-6" rx="10" ry="12" fill="#0c0a09"/><ellipse cx="15" cy="-6" rx="10" ry="12" fill="#0c0a09"/><path d="M0 8L-5 16H5Z" fill="#0c0a09"/>' +
      '<path d="M-18 30V38M-6 30V38M6 30V38M18 30V38" stroke="#0c0a09" stroke-width="2"/><circle class="bn-dot" cx="-15" cy="-6" r="3" fill="#ff1f3d"/><circle class="bn-dot" cx="15" cy="-6" r="3" fill="#ff1f3d"/></g>',
    arena: '<g class="bn-spots">' + [[150, -8], [250, 4], [350, -4]].map((s) => '<path d="M' + s[0] + ' 0L' + (s[0] - 60 + s[1]) + ' 140H' + (s[0] + 60 + s[1]) + 'Z" fill="#fff8e1" opacity=".13"/>').join('') + '</g>' +
      [150, 250, 350].map((x) => '<rect x="' + (x - 12) + '" y="0" width="24" height="8" rx="2" fill="#fef3c7"/>').join('') +
      '<g fill="#0a0a0f">' + parts('crowd', 40, 'arena', (r, i) => '<circle cx="' + f(i * 10 + 4) + '" cy="' + f(126 - r() * 6) + '" r="' + f(4 + r() * 2) + '"/>') + '<rect x="0" y="128" width="400" height="12"/></g>' +
      '<path d="M170 100h60l-6 28h-48Z" fill="#c9a24d"/><path d="M186 100V88h28v12" fill="none" stroke="#c9a24d" stroke-width="4"/>'
  });

  /* ---------------- efeitos de banner novos ---------------- */
  Object.assign(C.BANNER_FX, {
    scan: () => '<b class="scanline"></b>',
    spots: () => '<b class="spot s1"></b><b class="spot s2"></b>',
    gridmove: () => '',
    rays: () => ''
  });

  /* ---------------- fundos animados do perfil ---------------- */
  Object.assign(C.FX, {
    snow: (sd) => parts('sn', 26, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--s:' + f(2 + r() * 4) + 'px;--d:' + f(7 + r() * 8) + 's;--dl:-' + f(r() * 15) + 's;--sw:' + f(-20 + r() * 40) + 'px"></i>'),
    fireflies: (sd) => parts('ff', 16, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--y:' + f(20 + r() * 75) + '%;--s:' + f(3 + r() * 3) + 'px;--d:' + f(4 + r() * 5) + 's;--dl:-' + f(r() * 9) + 's;--mx:' + f(-30 + r() * 60) + 'px;--my:' + f(-24 + r() * 48) + 'px"></i>'),
    hexgrid: (sd) => '<b class="hex"></b>' + parts('hx', 8, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--y:' + f(r() * 100) + '%;--d:' + f(2.5 + r() * 3) + 's;--dl:-' + f(r() * 5) + 's"></i>'),
    bokeh: (sd) => parts('bk', 12, sd, (r) => '<i style="--x:' + f(r() * 100) + '%;--y:' + f(r() * 100) + '%;--s:' + f(18 + r() * 46) + 'px;--d:' + f(6 + r() * 8) + 's;--dl:-' + f(r() * 12) + 's;--o:' + f(.22 + r() * .3) + '"></i>')
  });
  C.FX_KEYS = Object.keys(C.FX);
})();
