/* Cenas animadas que servem em proporções diferentes: banner (cabeçalho 400x140), capa (400x240, atrás da vitrine)
   e fundo (360x720, a página inteira). A mesma cena se ajusta pela largura e altura recebidas.
   Aqui também ficam os temas (padrão + paleta aplicados ao perfil) e as cores de nick com efeito. */
(function () {
  const C = BH.cosm;
  const { lin, rad, svg, pol, around } = C;
  const f = (n) => Math.round(n * 10) / 10;
  const parts = (seed, n, fn) => { const r = C.rng(seed); let s = ''; for (let i = 0; i < n; i++) s += fn(r, i); return s; };
  const SIZE = { banner: [400, 140], capa: [400, 240], fundo: [360, 720] };
  const bg = (u, P, w, h, top) => '<defs>' + lin(u + 'bg', [[0, top || P.d], [.55, P.a, .55], [1, P.d]], 0, 1) + '</defs><rect width="' + w + '" height="' + h + '" fill="#07070b"/><rect width="' + w + '" height="' + h + '" fill="url(#' + u + 'bg)"/>';
  const wave = (w, h, y, amp, len) => { let d = 'M0 ' + f(y); for (let x = 0; x <= w * 2; x += len) d += 'Q' + f(x + len / 4) + ' ' + f(y - amp) + ' ' + f(x + len / 2) + ' ' + f(y) + 'T' + f(x + len) + ' ' + f(y); return d + 'V' + h + 'H0Z'; };
  const flame = (x, y, hh, w) => 'M' + f(x) + ' ' + f(y) + 'C' + f(x - w) + ' ' + f(y - hh * .35) + ' ' + f(x - w * .3) + ' ' + f(y - hh * .7) + ' ' + f(x) + ' ' + f(y - hh) + 'C' + f(x + w * .3) + ' ' + f(y - hh * .7) + ' ' + f(x + w) + ' ' + f(y - hh * .35) + ' ' + f(x) + ' ' + f(y) + 'Z';
  const stars = (seed, n, w, h, P) => parts(seed, n, (r, i) => '<circle class="sc-tw" style="--dl:-' + f(r() * 4) + 's" cx="' + f(r() * w) + '" cy="' + f(r() * h) + '" r="' + f(.5 + r() * 1.3) + '" fill="' + (i % 4 ? '#fff' : P.c) + '"/>');
  const bolt = (x, y, len, r) => { let d = 'M' + f(x) + ' ' + f(y), cx = x, cy = y; for (let i = 0; i < 6; i++) { cx += (r() - .5) * 26; cy += len / 6; d += 'L' + f(cx) + ' ' + f(cy); } return d; };

  const SC = {
    ondas: (P, u, w, h) => bg(u, P, w, h) + stars('on', 14, w, h * .5, P) + [0, 1, 2].map((i) => '<g class="sc-wave" style="--d:' + (9 + i * 4) + 's;--w:-' + w + 'px"><path d="' + wave(w, h, h * (.55 + i * .14), 8 + i * 3, 80 + i * 30) + '" fill="' + [P.b, P.a, P.d][i] + '" opacity="' + [.45, .6, .9][i] + '"/></g>').join(''),
    fumaca: (P, u, w, h) => bg(u, P, w, h) + '<defs>' + rad(u + 'sm', [[0, P.c, .35], [1, P.c, 0]]) + rad(u + 'sm2', [[0, P.b, .45], [1, P.b, 0]]) + '</defs>' +
      parts('fm', 9, (r, i) => '<circle class="sc-drift" style="--dl:-' + f(r() * 20) + 's;--d:' + f(16 + r() * 14) + 's;--dx:' + f(w * .3) + 'px" cx="' + f(r() * w) + '" cy="' + f(h * .3 + r() * h * .7) + '" r="' + f(h * (.25 + r() * .3)) + '" fill="url(#' + u + (i % 2 ? 'sm' : 'sm2') + ')"/>'),
    chamas: (P, u, w, h) => bg(u, P, w, h) + '<defs><linearGradient id="' + u + 'fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + P.d + '"/><stop offset=".4" stop-color="' + P.a + '"/><stop offset=".8" stop-color="' + P.g + '"/><stop offset="1" stop-color="#fff7ae"/></linearGradient></defs>' +
      parts('ch', Math.round(w / 22), (r, i) => { const x = i * 22 + r() * 10, fh = h * (.3 + r() * .4); return '<path class="sc-flame" style="--dl:-' + f(r()) + 's;transform-origin:' + f(x) + 'px ' + h + 'px" d="' + flame(x, h + 4, fh, 12 + r() * 8) + '" fill="url(#' + u + 'fl)" opacity=".9"/>'; }) +
      parts('che', 16, (r) => '<circle class="sc-rise" style="--dl:-' + f(r() * 5) + 's;--d:' + f(3 + r() * 3) + 's;--dy:-' + f(h * .9) + 'px;--dx:' + f((r() - .5) * 40) + 'px" cx="' + f(r() * w) + '" cy="' + f(h - 6) + '" r="' + f(.8 + r() * 1.6) + '" fill="' + P.g + '"/>'),
    raios: (P, u, w, h) => bg(u, P, w, h, '#020205') + '<rect class="sc-flash" width="' + w + '" height="' + h + '" fill="' + P.c + '"/>' +
      parts('rz', 3, (r, i) => '<path class="sc-bolt" style="--dl:' + f(i * 1.3 + r()) + 's" d="' + bolt(w * (.2 + i * .3 + r() * .1), -4, h * .9, r) + '" fill="none" stroke="' + (i % 2 ? '#fff' : P.g) + '" stroke-width="2.4" stroke-linejoin="round"/>') +
      '<g fill="' + P.d + '" opacity=".9">' + parts('rzc', 7, (r) => '<ellipse cx="' + f(r() * w) + '" cy="' + f(4 + r() * 12) + '" rx="' + f(40 + r() * 50) + '" ry="' + f(14 + r() * 10) + '"/>') + '</g>' +
      parts('rzr', 26, (r) => '<path class="sc-rain" style="--dl:-' + f(r() * 1) + 's;--dy:' + f(h + 20) + 'px" d="M' + f(r() * w) + ' ' + f(-20 - r() * h * .3) + 'l-3 12" stroke="' + P.c + '" stroke-width="1" opacity=".5"/>'),
    estrelas: (P, u, w, h) => bg(u, P, w, h, '#02020a') + stars('es', Math.round(w * h / 900), w, h, P) +
      '<g class="sc-shoot" style="--dx:' + f(-w * .8) + 'px;--dy:' + f(h * .6) + 'px"><path d="M' + f(w * .9) + ' ' + f(h * .08) + 'l40 -14" stroke="url(#' + u + 'sh)" stroke-width="2" stroke-linecap="round"/></g>' +
      '<defs>' + lin(u + 'sh', [[0, '#fff'], [1, '#fff', 0]], 1, 0) + '</defs><circle cx="' + f(w * .8) + '" cy="' + f(h * .3) + '" r="' + f(Math.min(w, h) * .12) + '" fill="' + P.b + '" opacity=".35"/>',
    glitch: (P, u, w, h) => bg(u, P, w, h, '#050508') + '<defs><pattern id="' + u + 'sl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity=".06"/></pattern></defs>' +
      parts('gl', 9, (r, i) => '<rect class="sc-glitch" style="--dl:' + f(r() * 3) + 's;--gx:' + f((r() - .5) * 80) + 'px" x="' + f(r() * w * .5) + '" y="' + f(r() * h) + '" width="' + f(w * (.2 + r() * .5)) + '" height="' + f(2 + r() * 10) + '" fill="' + ['#00e5ff', '#ff2975', P.g][i % 3] + '" opacity=".5"/>') +
      '<rect width="' + w + '" height="' + h + '" fill="url(#' + u + 'sl)"/><rect class="sc-scan" width="' + w + '" height="12" fill="#fff" opacity=".05"/>',
    flutuantes: (P, u, w, h) => bg(u, P, w, h) + parts('fl', 14, (r, i) => { const x = r() * w, y = r() * h, s = 6 + r() * 16; const shp = [
      '<rect x="' + f(x - s / 2) + '" y="' + f(y - s / 2) + '" width="' + f(s) + '" height="' + f(s) + '" rx="2"', '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(s / 2) + '"',
      '<path d="M' + f(x) + ' ' + f(y - s / 2) + 'L' + f(x + s / 2) + ' ' + f(y + s / 2) + 'H' + f(x - s / 2) + 'Z"'][i % 3];
      return '<g class="sc-float" style="--dl:-' + f(r() * 8) + 's;--d:' + f(6 + r() * 6) + 's">' + shp + ' fill="none" stroke="' + (i % 2 ? P.g : P.c) + '" stroke-width="1.4" opacity=".7" class="sc-rot" style="transform-origin:' + f(x) + 'px ' + f(y) + 'px"/></g>'; }),
    luzes: (P, u, w, h) => bg(u, P, w, h, '#030306') + '<defs>' + lin(u + 'lb', [[0, P.c, .5], [1, P.c, 0]], 0, 1) + '</defs>' +
      [.2, .5, .8].map((x, i) => '<g class="sc-beam" style="--dl:-' + (i * 1.6) + 's;transform-origin:' + f(w * x) + 'px ' + h + 'px"><path d="M' + f(w * x - 6) + ' ' + h + 'L' + f(w * x - 60) + ' 0H' + f(w * x + 60) + 'L' + f(w * x + 6) + ' ' + h + 'Z" fill="url(#' + u + 'lb)" transform="rotate(180 ' + f(w * x) + ' ' + f(h / 2) + ')" opacity=".5"/></g>').join('') +
      parts('lzc', Math.round(w / 9), (r, i) => '<circle cx="' + f(i * 9 + 4) + '" cy="' + f(h - 3 - r() * 5) + '" r="' + f(3 + r() * 2) + '" fill="#050507"/>'),
    grade: (P, u, w, h) => { const hz = h * .58; return bg(u, P, w, h, P.d) + '<defs>' + lin(u + 'sun', [[0, '#ffd319'], [.5, P.g], [1, P.a]], 0, 1) + '</defs>' +
      '<circle cx="' + f(w / 2) + '" cy="' + f(hz) + '" r="' + f(h * .3) + '" fill="url(#' + u + 'sun)"/>' + [0, 1, 2, 3].map((i) => '<rect x="0" y="' + f(hz - h * .12 + i * h * .045) + '" width="' + w + '" height="' + f(1.4 + i) + '" fill="' + P.d + '"/>').join('') +
      '<rect y="' + f(hz) + '" width="' + w + '" height="' + f(h - hz) + '" fill="' + P.d + '"/><g stroke="' + P.g + '" stroke-width="1" opacity=".85">' +
      [...Array(13)].map((_, i) => '<path d="M' + f(w / 2 + (i - 6) * w * .03) + ' ' + f(hz) + 'L' + f(w / 2 + (i - 6) * w * .22) + ' ' + h + '"/>').join('') +
      '<g class="sc-gridm" style="--dy:' + f((h - hz) / 4) + 'px">' + [0, 1, 2, 3, 4].map((i) => '<path d="M0 ' + f(hz + (h - hz) * i / 4) + 'H' + w + '"/>').join('') + '</g></g>'; },
    aurora: (P, u, w, h) => bg(u, P, w, h, '#020617') + stars('au', 24, w, h * .6, P) + '<defs>' + lin(u + 'a1', [[0, P.g, 0], [.5, P.g, .7], [1, P.b, 0]], 0, 1) + lin(u + 'a2', [[0, P.b, 0], [.5, P.c, .5], [1, P.a, 0]], 0, 1) + '</defs>' +
      [0, 1, 2].map((i) => '<g class="sc-aurora" style="--dl:-' + (i * 3) + 's;transform-origin:' + f(w / 2) + 'px ' + f(h * .4) + 'px"><path d="M0 ' + f(h * (.25 + i * .1)) + 'C' + f(w * .25) + ' ' + f(h * (.05 + i * .08)) + ' ' + f(w * .5) + ' ' + f(h * (.5 + i * .05)) + ' ' + f(w) + ' ' + f(h * (.2 + i * .1)) + 'V' + f(h * (.55 + i * .1)) + 'C' + f(w * .6) + ' ' + f(h * (.75 + i * .05)) + ' ' + f(w * .3) + ' ' + f(h * (.35 + i * .1)) + ' 0 ' + f(h * (.6 + i * .08)) + 'Z" fill="url(#' + u + (i % 2 ? 'a2' : 'a1') + ')"/></g>').join('') +
      '<path d="M0 ' + h + 'L' + f(w * .15) + ' ' + f(h * .78) + 'L' + f(w * .3) + ' ' + f(h * .9) + 'L' + f(w * .5) + ' ' + f(h * .74) + 'L' + f(w * .72) + ' ' + f(h * .92) + 'L' + f(w * .88) + ' ' + f(h * .8) + 'L' + w + ' ' + f(h * .88) + 'V' + h + 'Z" fill="#020308"/>',
    particulas: (P, u, w, h) => bg(u, P, w, h) + '<defs>' + rad(u + 'bk', [[0, P.g, .7], [1, P.g, 0]]) + rad(u + 'bk2', [[0, P.c, .5], [1, P.c, 0]]) + '</defs>' +
      parts('pt', 16, (r, i) => '<circle class="sc-float" style="--dl:-' + f(r() * 8) + 's;--d:' + f(5 + r() * 6) + 's" cx="' + f(r() * w) + '" cy="' + f(r() * h) + '" r="' + f(6 + r() * 22) + '" fill="url(#' + u + (i % 2 ? 'bk' : 'bk2') + ')"/>'),
    bolhas: (P, u, w, h) => bg(u, P, w, h) + parts('bh', 16, (r) => { const s = 3 + r() * 9; return '<g class="sc-rise" style="--dl:-' + f(r() * 8) + 's;--d:' + f(5 + r() * 5) + 's;--dy:-' + f(h + 30) + 'px;--dx:' + f((r() - .5) * 30) + 'px"><circle cx="' + f(r() * w) + '" cy="' + f(h + 10) + '" r="' + f(s) + '" fill="' + P.c + '" fill-opacity=".08" stroke="' + P.c + '" stroke-width=".8" opacity=".8"/></g>'; }),
    circuito: (P, u, w, h) => { const r = C.rng('ct' + w); let paths = ''; for (let i = 0; i < 9; i++) { let x = r() * w, y = r() * h, d = 'M' + f(x) + ' ' + f(y); for (let k = 0; k < 4; k++) { if (k % 2) x += (r() - .5) * 120; else y += (r() - .5) * 80; d += 'L' + f(x) + ' ' + f(y); } paths += '<path d="' + d + '" fill="none" stroke="' + P.a + '" stroke-width="1.4" opacity=".55"/><path class="sc-pulse" style="--dl:-' + f(r() * 3) + 's" d="' + d + '" fill="none" stroke="' + P.g + '" stroke-width="2" stroke-dasharray="14 300" stroke-linecap="round"/><circle cx="' + f(x) + '" cy="' + f(y) + '" r="2.6" fill="' + P.g + '"/>'; }
      return bg(u, P, w, h, '#020806') + paths; },
    petalas: (P, u, w, h) => bg(u, P, w, h) + '<path d="M' + w + ' 0C' + f(w * .8) + ' ' + f(h * .15) + ' ' + f(w * .65) + ' ' + f(h * .1) + ' ' + f(w * .5) + ' ' + f(h * .22) + 'M' + f(w * .72) + ' ' + f(h * .12) + 'C' + f(w * .7) + ' ' + f(h * .25) + ' ' + f(w * .62) + ' ' + f(h * .3) + ' ' + f(w * .56) + ' ' + f(h * .34) + '" fill="none" stroke="#1c0a14" stroke-width="5" stroke-linecap="round"/>' +
      parts('ptb', 10, (r) => '<circle cx="' + f(w * (.5 + r() * .5)) + '" cy="' + f(h * r() * .3) + '" r="' + f(4 + r() * 6) + '" fill="' + P.b + '" opacity=".8"/>') +
      '<g fill="' + P.a + '">' + parts('ptp', 18, (r) => '<g class="sc-fall" style="--dl:-' + f(r() * 10) + 's;--d:' + f(7 + r() * 5) + 's;--dy:' + f(h + 30) + 'px;--dx:-' + f(40 + r() * 80) + 'px"><path transform="translate(' + f(r() * w * 1.2) + ' -12) rotate(' + f(r() * 360) + ')" d="M0 0C4 -2 5 -6 0 -9C-5 -6 -4 -2 0 0Z"/></g>') + '</g>',
    neve: (P, u, w, h) => bg(u, P, w, h, '#0b1220') + '<path d="M0 ' + h + 'L' + f(w * .2) + ' ' + f(h * .5) + 'L' + f(w * .35) + ' ' + f(h * .7) + 'L' + f(w * .55) + ' ' + f(h * .35) + 'L' + f(w * .78) + ' ' + f(h * .68) + 'L' + w + ' ' + f(h * .45) + 'V' + h + 'Z" fill="' + P.d + '"/>' +
      '<path d="M' + f(w * .5) + ' ' + f(h * .42) + 'L' + f(w * .55) + ' ' + f(h * .35) + 'L' + f(w * .6) + ' ' + f(h * .43) + 'L' + f(w * .56) + ' ' + f(h * .41) + 'Z M' + f(w * .17) + ' ' + f(h * .56) + 'L' + f(w * .2) + ' ' + f(h * .5) + 'L' + f(w * .24) + ' ' + f(h * .57) + 'Z" fill="#fff"/>' +
      parts('nv', 36, (r) => '<circle class="sc-fall" style="--dl:-' + f(r() * 10) + 's;--d:' + f(6 + r() * 6) + 's;--dy:' + f(h + 20) + 'px;--dx:' + f((r() - .5) * 60) + 'px" cx="' + f(r() * w) + '" cy="-8" r="' + f(.8 + r() * 2) + '" fill="#fff"/>'),
    chuva: (P, u, w, h) => bg(u, P, w, h, '#05070d') + '<g fill="#04050a">' + parts('cvc', Math.round(w / 24), (r, i) => { const bh = h * (.25 + r() * .45); return '<rect x="' + f(i * 24) + '" y="' + f(h - bh) + '" width="' + f(18 + r() * 8) + '" height="' + f(bh) + '"/>'; }) + '</g>' +
      parts('cvw', 30, (r) => '<rect class="sc-win" style="--dl:-' + f(r() * 6) + 's" x="' + f(r() * w) + '" y="' + f(h * .55 + r() * h * .4) + '" width="3" height="4" fill="' + (r() > .5 ? P.g : P.c) + '" opacity=".7"/>') +
      parts('cvr', 40, (r) => '<path class="sc-rain" style="--dl:-' + f(r()) + 's;--dy:' + f(h + 20) + 'px" d="M' + f(r() * w) + ' ' + f(-20 - r() * h * .4) + 'l-2 14" stroke="' + P.c + '" stroke-width=".9" opacity=".45"/>'),
    nebulosa: (P, u, w, h) => bg(u, P, w, h, '#03010a') + '<defs>' + rad(u + 'n1', [[0, P.g, .7], [1, P.g, 0]]) + rad(u + 'n2', [[0, P.b, .6], [1, P.b, 0]]) + rad(u + 'n3', [[0, P.c, .4], [1, P.c, 0]]) + '</defs>' +
      '<g class="sc-spin" style="transform-origin:' + f(w * .7) + 'px ' + f(h * .5) + 'px"><ellipse cx="' + f(w * .62) + '" cy="' + f(h * .45) + '" rx="' + f(w * .3) + '" ry="' + f(h * .35) + '" fill="url(#' + u + 'n1)"/><ellipse cx="' + f(w * .8) + '" cy="' + f(h * .6) + '" rx="' + f(w * .22) + '" ry="' + f(h * .3) + '" fill="url(#' + u + 'n2)"/></g>' +
      '<ellipse class="sc-breath" cx="' + f(w * .3) + '" cy="' + f(h * .4) + '" rx="' + f(w * .2) + '" ry="' + f(h * .25) + '" fill="url(#' + u + 'n3)"/>' + stars('nb', Math.round(w * h / 700), w, h, P),
    vortice: (P, u, w, h) => { const cx = w * .72, cy = h * .5, R = Math.min(w, h) * .45; return bg(u, P, w, h, '#030208') + '<defs>' + rad(u + 'vx', [[0, '#000'], [.35, P.a, .9], [.7, P.g, .5], [1, P.g, 0]]) + '</defs>' +
      '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R) + '" fill="url(#' + u + 'vx)"/><g class="sc-spin fast" style="transform-origin:' + f(cx) + 'px ' + f(cy) + 'px">' +
      around(7, (a) => '<path transform="rotate(' + a + ' ' + f(cx) + ' ' + f(cy) + ')" d="M' + f(cx) + ' ' + f(cy) + 'C' + f(cx + R * .4) + ' ' + f(cy - R * .2) + ' ' + f(cx + R * .8) + ' ' + f(cy + R * .1) + ' ' + f(cx + R) + ' ' + f(cy + R * .5) + '" fill="none" stroke="' + P.c + '" stroke-width="2" opacity=".55"/>') + '</g>'; },
    cristais: (P, u, w, h) => bg(u, P, w, h, '#05030d') + '<defs>' + lin(u + 'cr', [[0, P.c], [.5, P.b], [1, P.a]], 0, 1) + '</defs>' +
      parts('crb', Math.round(w / 30), (r, i) => { const x = i * 30 + r() * 20, ch = h * (.2 + r() * .35), cw = 8 + r() * 10; return '<path class="sc-glow" style="--dl:-' + f(r() * 3) + 's" d="M' + f(x - cw) + ' ' + h + 'L' + f(x - cw * .4) + ' ' + f(h - ch) + 'L' + f(x) + ' ' + f(h - ch - 10) + 'L' + f(x + cw * .5) + ' ' + f(h - ch * .9) + 'L' + f(x + cw) + ' ' + h + 'Z" fill="url(#' + u + 'cr)" stroke="#fff" stroke-width=".6" opacity=".9"/>'; }) +
      parts('crt', Math.round(w / 45), (r, i) => { const x = i * 45 + r() * 20, ch = h * (.1 + r() * .2); return '<path d="M' + f(x - 7) + ' 0L' + f(x) + ' ' + f(ch) + 'L' + f(x + 7) + ' 0Z" fill="url(#' + u + 'cr)" opacity=".6"/>'; }) + stars('crs', 16, w, h, P),
    cidade: (P, u, w, h) => bg(u, P, w, h, '#050212') + '<circle cx="' + f(w * .78) + '" cy="' + f(h * .3) + '" r="' + f(h * .16) + '" fill="' + P.b + '" opacity=".5"/>' +
      '<g fill="#0a0418">' + parts('cdb', Math.round(w / 20), (r, i) => { const bh = h * (.3 + r() * .5); return '<rect x="' + f(i * 20) + '" y="' + f(h - bh) + '" width="' + f(16 + r() * 8) + '" height="' + f(bh) + '"/>'; }) + '</g>' +
      parts('cdw', 40, (r) => '<rect class="sc-win" style="--dl:-' + f(r() * 6) + 's" x="' + f(r() * w) + '" y="' + f(h * .45 + r() * h * .5) + '" width="3" height="4" fill="' + (r() > .5 ? P.g : P.b) + '"/>') +
      [0, 1].map((i) => '<path class="sc-car" style="--dl:-' + (i * 2.5) + 's;--dx:' + f(w + 80) + 'px" d="M-40 ' + f(h * (.28 + i * .12)) + 'h26" stroke="' + (i ? P.g : P.c) + '" stroke-width="2" stroke-linecap="round"/>').join(''),
    hexagonos: (P, u, w, h) => { let s = ''; const R = 14, dx = R * 1.732; const r = C.rng('hx' + w); for (let y = 0, row = 0; y < h + R; y += R * 1.5, row++) for (let x = (row % 2) * dx / 2; x < w + dx; x += dx) { const lit = r() < .12; s += '<path' + (lit ? ' class="sc-glow" style="--dl:-' + f(r() * 3) + 's"' : '') + ' d="' + around(6, (a, i) => { const p = pol(x, y, R - 1.5, a + 30); return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }) + 'Z" fill="' + (lit ? P.g : 'none') + '" fill-opacity=".35" stroke="' + P.a + '" stroke-width=".8" opacity=".6"/>'; } return bg(u, P, w, h) + s; }
  };
  C.SCENES = Object.keys(SC);
  ['banner', 'capa', 'fundo'].forEach((kind) => Object.keys(SC).forEach((k) => C.register(kind, k, (o) => {
    const sz = o.size || SIZE[kind];
    return svg('0 0 ' + sz[0] + ' ' + sz[1], SC[k](o.P, o.u, sz[0], sz[1]), 'sc sc-' + k + ' sc-' + kind + (o.still ? ' still' : ''), ' preserveAspectRatio="xMidYMid slice"');
  })));

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
