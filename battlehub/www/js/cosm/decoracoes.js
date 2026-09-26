/* Decorações de avatar no estilo do Discord: peças que saem do círculo, com uma parte ATRÁS da foto (asas, corpo
   do dragão, chamas do fundo) e outra NA FRENTE (cabeça do dragão, coroa, chifres). São molduras (tipo "moldura")
   com desenho "dc-...".
   Desempenho: cada parte que se mexe é um <svg> próprio dentro de um <span>, e só o <svg> anda (transform/opacity),
   então o celular não redesenha o desenho a cada quadro. Partículas usam as mesmas regras dos cenários.
   Caixa 200x200; a foto ocupa o círculo do centro (raio ~62). */
(function () {
  const C = BH.cosm;
  const f = (n) => Math.round(n * 10) / 10;
  const H = () => C.snHelpers;
  const pol = (r, a) => [f(100 + r * Math.cos((a - 90) * Math.PI / 180)), f(100 + r * Math.sin((a - 90) * Math.PI / 180))];
  const lite = () => typeof document !== 'undefined' && document.documentElement.classList.contains('bh-lite');

  // monta: back (atrás da foto), front (na frente), layers ({ a: animação, z: 'b'|'f', svg, o: origem, d }), parts
  function deco(key, o, spec) {
    const vb = 'viewBox="0 0 200 200"';
    const sv = (inner, cls, st) => '<svg class="' + cls + '" ' + vb + (st ? ' style="' + st + '"' : '') + ' aria-hidden="true" focusable="false" overflow="visible">' + inner + '</svg>';
    const still = !!o.still;
    let out = '<span class="fr dc dc-' + key + (still ? ' still' : '') + '">';
    if (spec.back) out += sv(spec.back, 'dc-b');
    (spec.layers || []).forEach((L) => {
      // órbita: duas camadas uma dentro da outra (vai e vem na horizontal + na vertical, fora de fase = elipse)
      if (L.a === 'orbit') { out += '<span class="dc-f dc-orb"><span class="dc-ox' + (still ? '' : ' dc-l') + '" style="--d:' + (L.d || 5) + 's">' + sv(L.svg, 'dc-oy' + (still ? '' : ' dc-l'), '--d:' + (L.d || 5) + 's') + '</span></span>'; return; }
      const cls = 'dc-' + (L.z === 'b' ? 'b' : 'f') + (still || lite() && L.heavy ? '' : ' dc-l sn-' + L.a);
      out += sv(L.svg, cls, (L.d ? '--d:' + L.d + 's;' : '') + (L.dl ? '--dl:-' + L.dl + 's;' : '') + (L.o ? 'transform-origin:' + L.o : ''));
    });
    if (spec.front) out += sv(spec.front, 'dc-f');
    if (!still && spec.parts && spec.parts.length && C.snParticles) out += '<span class="dc-pw">' + C.snParticles(spec.parts, { u: o.u, kind: 'deco', lite: lite() }) + '</span>';
    return out + '</span>';
  }

  const D = {};

  // Dragão enrolado: o corpo passa por trás da foto, a cabeça e uma volta ficam na frente
  D['dc-dragao'] = (o) => {
    const P = o.P, u = o.u, { lg, glow } = H();
    // caminho pela circunferência (raio R), de um ângulo a outro, no sentido horário
    const arc = (R, a0, a1) => { const p = pol(R, a0), q = pol(R, a1); return 'M' + p.join(' ') + 'A' + R + ' ' + R + ' 0 ' + ((a1 - a0 + 360) % 360 > 180 ? 1 : 0) + ' 1 ' + q.join(' '); };
    const R = 80;
    const backBody = arc(R, 150, 250), frontBody = arc(R, 250, 34);
    const tube = (d, w) => '<path d="' + d + '" fill="none" stroke="' + P.d + '" stroke-width="' + (w + 4) + '" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="url(#' + u + 'bd)" stroke-width="' + w + '" stroke-linecap="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + P.d + '" stroke-width="' + (w - 3) + '" stroke-linecap="round" stroke-dasharray="1 6" opacity=".45"/>';
    const spikes = (a0, a1) => { let sp = ''; for (let a = a0; a < a1; a += 13) { const p = pol(R + 9, a), q = pol(R + 22, a + 4), r2 = pol(R + 9, a + 8); sp += '<path d="M' + p.join(' ') + 'L' + q.join(' ') + 'L' + r2.join(' ') + 'Z" fill="' + P.a + '" stroke="' + P.d + '" stroke-width="1"/>'; } return sp; };
    // cauda afinando embaixo à direita
    const tail = arc(R, 118, 150);
    const hp = pol(R, 40);
    const head = '<g transform="translate(' + hp.join(' ') + ') rotate(-32) scale(1.45)">' +
      '<path d="M-6 -8C-2 -24 12 -32 22 -34C16 -26 14 -18 14 -10Z" fill="url(#' + u + 'hn)" stroke="' + P.d + '" stroke-width="1"/><path d="M-12 -8C-10 -22 0 -30 8 -34C6 -24 4 -16 4 -8Z" fill="url(#' + u + 'hn)" stroke="' + P.d + '" stroke-width="1" opacity=".85"/>' +
      '<path d="M-26 -10C-12 -22 10 -22 24 -12C34 -6 42 0 42 6C34 8 28 6 22 8L14 10C6 16 -10 16 -20 10C-30 4 -32 -4 -26 -10Z" fill="url(#' + u + 'hd)" stroke="' + P.d + '" stroke-width="1.4"/>' +
      '<path d="M14 10C24 10 34 10 42 8C40 16 28 20 14 16Z" fill="url(#' + u + 'hd)" stroke="' + P.d + '" stroke-width="1.1"/><path d="M17 11C25 12 33 12 39 10C36 14 28 15 20 14Z" fill="#6d0f0f"/><path d="M22 9l1.6 3.4 1.6-3.4M30 9l1.6 3.4 1.6-3.4" fill="#fff"/>' +
      '<path d="M-2 -8C2 -12 10 -12 14 -7C10 -4 2 -4 -2 -8Z" fill="#fff"/><ellipse class="dc-eye" cx="7" cy="-8" rx="1.6" ry="2.6" fill="' + P.g + '"/><path d="M-4 -11C2 -15 10 -15 15 -10" fill="none" stroke="' + P.d + '" stroke-width="1.4"/>' +
      '<path d="M38 4C52 -4 64 2 70 12M34 12C44 22 46 32 42 42" fill="none" stroke="' + P.b + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M-24 -8C-38 -16 -44 -6 -52 -12C-46 4 -36 4 -26 4Z" fill="' + P.a + '" stroke="' + P.d + '" stroke-width="1"/></g>';
    const leg = (a) => { const p = pol(R + 2, a); return '<g transform="translate(' + p.join(' ') + ') rotate(' + a + ')"><path d="M0 0C4 10 2 16 8 22" fill="none" stroke="' + P.d + '" stroke-width="9" stroke-linecap="round"/><path d="M0 0C4 10 2 16 8 22" fill="none" stroke="' + P.b + '" stroke-width="6" stroke-linecap="round"/><path d="M8 22q-6 2-8 8M8 22q0 5 2 10M8 22q5 1 8 6" fill="none" stroke="' + P.c + '" stroke-width="2.2" stroke-linecap="round"/></g>'; };
    const defs = '<defs>' + lg(u + 'bd', [[0, P.c], [.45, P.b], [1, P.a]], 1, 1) + lg(u + 'hd', [[0, P.c], [.5, P.b], [1, P.a]]) + lg(u + 'hn', [[0, '#fffbea'], [1, P.b]], 1, 0) + '</defs>';
    return deco('dc-dragao', o, {
      back: defs + glow(u + 'au', 100, 100, 100, P.g, .3) + spikes(150, 250) + '<path d="' + tail + '" fill="none" stroke="' + P.d + '" stroke-width="10" stroke-linecap="round"/><path d="' + tail + '" fill="none" stroke="' + P.b + '" stroke-width="6" stroke-linecap="round"/>' + tube(backBody, 17),
      layers: [
        { a: 'bob', z: 'f', d: 3.6, svg: defs + spikes(250, 360) + spikes(0, 30) + tube(frontBody, 17) + leg(296) + head },
        { a: 'breath', z: 'f', d: 2.2, o: '92% 6%', svg: glow(u + 'pl', 184, 12, 20, P.c, .95) + '<circle cx="184" cy="12" r="6.5" fill="#fffdf2"/>' }
      ],
      parts: [{ t: 'brasa', n: 6, c: [P.g, P.c], x0: 20, x1: 80, y0: 60, y1: 100, s: [1.5, 3], d: [2.5, 4.5], sw: 16 }]
    });
  };

  // Chamas: fogo atrás subindo pelos lados, labaredas menores na frente e brasas
  D['dc-chamas'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const tongue = (x, base, hh, w, lean) => 'M' + f(x - w) + ' ' + base + 'C' + f(x - w * 1.1) + ' ' + f(base - hh * .5) + ' ' + f(x + lean * .4) + ' ' + f(base - hh * .6) + ' ' + f(x + lean) + ' ' + f(base - hh) + 'C' + f(x + lean * .3 + w * .5) + ' ' + f(base - hh * .6) + ' ' + f(x + w * 1.1) + ' ' + f(base - hh * .4) + ' ' + f(x + w) + ' ' + base + 'Z';
    const ring = (n, base, hmin, hmax, wid, seed, fill) => { const r = C.rng(seed); let d = ''; for (let i = 0; i < n; i++) { const a = -110 + i * (220 / (n - 1)); const p = pol(58, a + 180); d += '<path transform="rotate(' + f(a + 180) + ' ' + p[0] + ' ' + p[1] + ')" d="' + tongue(+p[0], +p[1], hmin + r() * (hmax - hmin), wid, (r() - .5) * 10) + '" fill="' + fill + '"/>'; void base; } return d; };
    const defs = '<defs>' + lg(u + 'f1', [[0, '#fff7ae'], [.4, P.g], [1, P.a]], 0, 0, 0, 1) + lg(u + 'f2', [[0, '#fffbe6'], [1, P.b]], 0, 0, 0, 1) + '</defs>';
    return deco('dc-chamas', o, {
      back: defs + H().glow(u + 'g', 100, 130, 100, P.g, .45),
      layers: [
        { a: 'flick', z: 'b', d: .9, o: '50% 80%', svg: defs + ring(9, 0, 34, 58, 12, 'c1' + u, 'url(#' + u + 'f1)') },
        { a: 'flick', z: 'f', d: .7, dl: .3, o: '50% 90%', svg: defs + ring(7, 0, 14, 26, 8, 'c2' + u, 'url(#' + u + 'f2)').replace(/<path/g, '<path opacity=".9"') }
      ],
      parts: [{ t: 'brasa', n: 10, c: [P.g, '#fff3b0'], x0: 15, x1: 85, y0: 70, y1: 100, s: [1.5, 3], d: [1.8, 3.2], sw: 18 }]
    });
  };

  // Coroa real inclinada no alto, com joias, reflexo passando e brilhos
  D['dc-coroa'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const crown = '<g transform="translate(104 34) rotate(-12)">' +
      '<path d="M-44 20L-52 -26L-24 -2L0 -38L24 -2L52 -26L44 20Z" fill="url(#' + u + 'cr)" stroke="#6b4308" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="-46" y="18" width="92" height="14" rx="4" fill="url(#' + u + 'cr)" stroke="#6b4308" stroke-width="2"/>' +
      '<circle cx="-52" cy="-29" r="5" fill="' + P.c + '" stroke="#6b4308"/><circle cx="0" cy="-42" r="6" fill="' + P.c + '" stroke="#6b4308"/><circle cx="52" cy="-29" r="5" fill="' + P.c + '" stroke="#6b4308"/>' +
      '<path d="M0 -6l8 10-8 10-8-10Z" fill="' + P.a + '" stroke="#fff" stroke-opacity=".6"/><circle cx="-26" cy="10" r="4.5" fill="' + P.b + '"/><circle cx="26" cy="10" r="4.5" fill="' + P.b + '"/>' +
      [-30, -15, 0, 15, 30].map((x) => '<circle cx="' + x + '" cy="25" r="2.6" fill="#fff" opacity=".9"/>').join('') + '</g>';
    return deco('dc-coroa', o, {
      back: '<circle cx="100" cy="100" r="68" fill="none" stroke="' + P.g + '" stroke-width="3" opacity=".6"/>',
      front: '<defs>' + lg(u + 'cr', [[0, '#fff5c2'], [.45, '#f6d77a'], [1, '#b8860b']]) + '</defs>' + crown,
      layers: [{ a: 'sweep', z: 'f', d: 4, svg: '<defs><clipPath id="' + u + 'cc"><path transform="translate(104 34) rotate(-12)" d="M-44 20L-52 -26L-24 -2L0 -38L24 -2L52 -26L44 32H-46Z"/></clipPath>' + lg(u + 'sw', [[0, '#fff', 0], [.5, '#fff', .8], [1, '#fff', 0]], 1, 0) + '</defs><g clip-path="url(#' + u + 'cc)"><rect x="80" y="-10" width="30" height="90" fill="url(#' + u + 'sw)"/></g>' }],
      parts: [{ t: 'faisca', n: 6, c: ['#fff5c2', P.c], x0: 15, x1: 85, y0: 5, y1: 40, s: [2, 4], d: [1.6, 3] }]
    });
  };

  // Anjo: auréola flutuando e asas brancas batendo atrás, penas caindo
  D['dc-anjo'] = (o) => {
    const P = o.P, u = o.u, { lg, glow } = H();
    // asa: penas em leque (três fileiras), da base atrás do ombro para fora
    const feather = (x, y, len, ang, wd) => '<path transform="translate(' + x + ' ' + y + ') rotate(' + ang + ')" d="M0 0C' + f(wd) + ' ' + f(-len * .3) + ' ' + f(wd * .8) + ' ' + f(-len * .8) + ' 0 ' + f(-len) + 'C' + f(-wd * .8) + ' ' + f(-len * .8) + ' ' + f(-wd) + ' ' + f(-len * .3) + ' 0 0Z" fill="url(#' + u + 'wg)" stroke="' + P.d + '" stroke-opacity=".3" stroke-width=".8"/>';
    const wing = (dir) => { let w = '<g transform="translate(100 108) scale(' + dir + ' 1)">'; for (let i = 0; i < 10; i++) w += feather(40 + i * 2, -4 - i * 1.5, 96 - i * 5, 22 + i * 9, 11); for (let i = 0; i < 8; i++) w += feather(44 + i * 2, -12, 64 - i * 3, 28 + i * 10, 10); for (let i = 0; i < 6; i++) w += feather(48, -18, 36, 34 + i * 12, 8); return w + '</g>'; };
    return deco('dc-anjo', o, {
      back: '<defs>' + lg(u + 'wg', [[0, '#ffffff'], [.6, P.b], [1, P.a]], 1, 1) + '</defs>' + glow(u + 'g', 100, 100, 100, P.c, .45),
      layers: [
        { a: 'flap', z: 'b', d: 1.6, o: '50% 52%', svg: '<defs>' + lg(u + 'wg', [[0, '#ffffff'], [.6, P.b], [1, P.a]], 1, 1) + '</defs>' + wing(1) + wing(-1) },
        { a: 'bob', z: 'f', d: 2.4, svg: '<ellipse cx="100" cy="24" rx="40" ry="10" fill="none" stroke="' + P.g + '" stroke-width="9" opacity=".35"/><ellipse cx="100" cy="24" rx="40" ry="10" fill="none" stroke="#fffbe6" stroke-width="4"/>' }
      ],
      parts: [{ t: 'petala', n: 5, c: ['#fff', P.c], x0: 10, x1: 90, s: [4, 6], d: [4, 7], sw: 14 }]
    });
  };

  // Demônio: chifres na frente, asas de morcego atrás e aura vermelha pulsando
  D['dc-demonio'] = (o) => {
    const P = o.P, u = o.u, { lg, glow } = H();
    const wing = (dir) => '<g transform="translate(100 96) scale(' + dir + ' 1)"><path d="M46 -10L80 -60L96 -40L110 -66L122 -38L140 -50L132 -8C118 -16 108 -10 102 0C94 -8 82 -8 74 2C66 -4 56 -6 46 -2Z" fill="url(#' + u + 'bw)" stroke="' + P.d + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M80 -60L76 0M110 -66L100 0M132 -8L104 2" stroke="' + P.d + '" stroke-width="1.4"/></g>';
    const horn = (dir) => '<g transform="translate(100 100) scale(' + dir + ' 1)"><path d="M22 -58C30 -80 50 -96 70 -96C58 -86 50 -72 46 -52C40 -52 30 -54 22 -58Z" fill="url(#' + u + 'hn)" stroke="#1a0303" stroke-width="2"/>' +
      '<path d="M30 -64C40 -74 52 -84 64 -90M34 -58C44 -68 52 -74 58 -78" stroke="#fff" stroke-opacity=".25" stroke-width="1.4" fill="none"/></g>';
    return deco('dc-demonio', o, {
      back: '<defs>' + lg(u + 'bw', [[0, P.b], [1, P.d]], 0, 1) + '</defs>' + glow(u + 'g', 100, 100, 100, P.a, .55),
      layers: [{ a: 'flap', z: 'b', d: 2, o: '50% 48%', svg: '<defs>' + lg(u + 'bw', [[0, P.b], [1, P.d]], 0, 1) + '</defs>' + wing(1) + wing(-1) }],
      front: '<defs>' + lg(u + 'hn', [[0, '#3b0a0a'], [.5, P.a], [1, '#1a0303']], 1, 0) + '</defs>' + horn(1) + horn(-1),
      parts: [{ t: 'brasa', n: 8, c: [P.g, P.b], x0: 15, x1: 85, y0: 70, y1: 100, s: [1.5, 3], d: [2, 3.6], sw: 16 }]
    });
  };

  // Gatinho neon: orelhas com brilho, bigodes e corações subindo
  D['dc-gato'] = (o) => {
    const P = o.P, u = o.u, { glow } = H();
    const ear = (dir) => '<g transform="translate(100 100) scale(' + dir + ' 1)"><path d="M18 -58L40 -96L60 -46Z" fill="' + P.a + '" stroke="' + P.c + '" stroke-width="3" stroke-linejoin="round"/><path d="M28 -58L40 -82L52 -52Z" fill="' + P.b + '"/></g>';
    return deco('dc-gato', o, {
      back: glow(u + 'g', 100, 60, 70, P.g, .5),
      layers: [{ a: 'pulse', z: 'b', d: 1.6, svg: '<g opacity=".7">' + ear(1).replace(/stroke-width="3"/, 'stroke-width="9" stroke-opacity=".4"') + ear(-1).replace(/stroke-width="3"/, 'stroke-width="9" stroke-opacity=".4"') + '</g>' }],
      front: ear(1) + ear(-1) + '<g stroke="' + P.c + '" stroke-width="2.4" stroke-linecap="round" opacity=".9"><path d="M40 128L6 120M40 136L4 138M160 128L194 120M160 136L196 138"/></g>',
      parts: [{ t: 'estrela', n: 6, c: [P.c, P.g], x0: 5, x1: 95, y0: 5, y1: 95, s: [2, 4], d: [1.6, 3] }]
    });
  };

  // Galho de cerejeira em volta, com flores e pétalas caindo
  D['dc-sakura'] = (o) => {
    const P = o.P, u = o.u, r = C.rng('sk' + u);
    const branch = 'M16 170C30 140 30 110 44 90M44 90C40 70 46 52 60 40M44 110C30 106 22 98 18 86M150 20C168 40 184 70 180 104M170 50C184 48 194 40 196 28';
    let fl = '';
    const flower = (x, y, s) => { let p = ''; for (let k = 0; k < 5; k++) { const a = k * 72 * Math.PI / 180; p += '<ellipse cx="' + f(x + Math.cos(a) * s) + '" cy="' + f(y + Math.sin(a) * s) + '" rx="' + f(s * .9) + '" ry="' + f(s * .65) + '" transform="rotate(' + f(k * 72) + ' ' + f(x + Math.cos(a) * s) + ' ' + f(y + Math.sin(a) * s) + ')" fill="' + (k % 2 ? P.a : P.c) + '"/>'; } return p + '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(s * .45) + '" fill="#fde68a"/>'; };
    [[18, 160], [34, 128], [44, 92], [58, 44], [20, 88], [152, 24], [172, 52], [182, 92], [196, 30], [40, 64]].forEach((p) => { fl += flower(p[0] + r() * 4, p[1] + r() * 4, 5 + r() * 3); });
    return deco('dc-sakura', o, {
      front: '<path d="' + branch + '" fill="none" stroke="#3b1a14" stroke-width="5" stroke-linecap="round"/>' + fl,
      layers: [],
      parts: [{ t: 'petala', n: 7, c: [P.c, P.b, '#fff'], x0: 0, x1: 100, s: [4, 6], d: [4, 7], sw: 16 }]
    });
  };

  // Tempestade elétrica: anel girando, arcos de raio piscando e faíscas
  D['dc-raio'] = (o) => {
    const P = o.P, u = o.u, r = C.rng('rz' + u);
    const arc = (a0) => { let d = '', a = a0; const p0 = pol(64, a); d = 'M' + p0.join(' '); for (let i = 0; i < 6; i++) { a += 8; const rr = 64 + (r() - .5) * 18; d += 'L' + pol(rr, a).join(' '); } return d; };
    const arcs = (seed) => [0, 120, 240].map((a) => '<path d="' + arc(a + seed) + '" fill="none" stroke="' + P.g + '" stroke-width="6" opacity=".35" stroke-linejoin="round"/><path d="' + arc(a + seed) + '" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>').join('');
    return deco('dc-raio', o, {
      back: H().glow(u + 'g', 100, 100, 96, P.a, .45),
      layers: [
        { a: 'spin', z: 'f', d: 6, svg: '<circle cx="100" cy="100" r="68" fill="none" stroke="' + P.b + '" stroke-width="3" stroke-dasharray="26 10 4 10" stroke-linecap="round"/>' },
        { a: 'flash', z: 'f', d: 2.4, svg: arcs(10) },
        { a: 'flash', z: 'f', d: 3.1, dl: 1.2, svg: arcs(70) }
      ],
      parts: [{ t: 'faisca', n: 8, c: [P.c, '#fff'], x0: 5, x1: 95, y0: 5, y1: 95, s: [2, 3.5], d: [1, 2.2] }]
    });
  };

  // HUD cyber: cantos de mira, anel tracejado girando, varredura e dados
  D['dc-cyber'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const corner = (x, y, sx, sy) => '<path d="M' + x + ' ' + (y + 26 * sy) + 'V' + y + 'H' + (x + 26 * sx) + '" fill="none" stroke="' + P.g + '" stroke-width="4" stroke-linecap="square"/>';
    return deco('dc-cyber', o, {
      back: '<circle cx="100" cy="100" r="70" fill="none" stroke="' + P.b + '" stroke-width="1" opacity=".5"/>',
      front: corner(22, 22, 1, 1) + corner(178, 22, -1, 1) + corner(22, 178, 1, -1) + corner(178, 178, -1, -1) +
        '<text x="100" y="196" text-anchor="middle" font-family="monospace" font-size="11" fill="' + P.c + '" opacity=".85">ONLINE_</text>',
      layers: [
        { a: 'spin', z: 'f', d: 10, svg: '<circle cx="100" cy="100" r="74" fill="none" stroke="' + P.g + '" stroke-width="3" stroke-dasharray="4 8 30 8" />' },
        { a: 'spinr', z: 'f', d: 16, svg: '<circle cx="100" cy="100" r="80" fill="none" stroke="' + P.c + '" stroke-width="1.4" stroke-dasharray="2 6" opacity=".8"/>' },
        { a: 'scan', z: 'f', d: 2.6, svg: '<defs><clipPath id="' + u + 'c"><circle cx="100" cy="100" r="62"/></clipPath>' + lg(u + 's', [[0, P.g, 0], [.5, P.g, .45], [1, P.g, 0]]) + '</defs><g clip-path="url(#' + u + 'c)"><rect x="30" y="90" width="140" height="20" fill="url(#' + u + 's)"/></g>' }
      ],
      parts: []
    });
  };

  // Coroa de gelo: cristais em volta do topo, anel de geada e neve
  D['dc-gelo'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const shard = (a, len, w) => { const p = pol(60, a), q = pol(60 + len, a), l = pol(60, a - w), rr = pol(60, a + w); return '<path d="M' + l.join(' ') + 'L' + q.join(' ') + 'L' + rr.join(' ') + 'L' + p.join(' ') + 'Z" fill="url(#' + u + 'ic)" stroke="#fff" stroke-opacity=".6" stroke-width="1"/>'; };
    const shards = [-70, -48, -26, 0, 26, 48, 70].map((a, i) => shard(a, [22, 30, 38, 48, 38, 30, 22][i], [6, 6, 7, 8, 7, 6, 6][i])).join('');
    return deco('dc-gelo', o, {
      back: '<defs>' + lg(u + 'ic', [[0, '#ffffff'], [.5, P.b], [1, P.a]]) + '</defs>' + H().glow(u + 'g', 100, 60, 80, P.c, .45),
      front: '<defs>' + lg(u + 'ic', [[0, '#ffffff'], [.5, P.b], [1, P.a]]) + '</defs>' + shards + '<circle cx="100" cy="100" r="64" fill="none" stroke="' + P.c + '" stroke-width="3" stroke-dasharray="1 5" stroke-linecap="round"/>',
      layers: [{ a: 'pulse', z: 'f', d: 2.2, svg: '<g opacity=".9">' + [-48, 0, 48].map((a) => { const q = pol(60 + (a ? 30 : 48), a); return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3" fill="#fff"/>'; }).join('') + '</g>' }],
      parts: [{ t: 'neve', n: 8, c: '#fff', x0: 0, x1: 100, s: [1.5, 3], d: [3, 6], sw: 12 }]
    });
  };

  // Órbita: anel inclinado com um planeta dando a volta (a volta é uma camada girando, achatada)
  D['dc-orbita'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    return deco('dc-orbita', o, {
      back: '<defs>' + lg(u + 'pl', [[0, P.c], [1, P.a]], 1, 1) + '</defs><ellipse cx="100" cy="100" rx="92" ry="28" transform="rotate(-18 100 100)" fill="none" stroke="' + P.b + '" stroke-width="3" opacity=".7"/>',
      front: '<path d="M8 100A92 28 0 0 0 192 100" transform="rotate(-18 100 100)" fill="none" stroke="' + P.c + '" stroke-width="3"/>' + '<circle cx="36" cy="30" r="3" fill="#fff"/><circle cx="170" cy="170" r="2" fill="#fff"/>',
      layers: [{ a: 'orbit', z: 'f', d: 5, o: '50% 50%', svg: '<defs>' + lg(u + 'pl', [[0, P.c], [1, P.a]], 1, 1) + '</defs><circle cx="100" cy="8" r="12" fill="url(#' + u + 'pl)"/><ellipse cx="100" cy="8" rx="20" ry="5" fill="none" stroke="' + P.c + '" stroke-width="1.6"/>' }],
      parts: [{ t: 'estrela', n: 6, c: ['#fff', P.c], x0: 5, x1: 95, y0: 5, y1: 95, s: [1.5, 3], d: [1.6, 3.2] }]
    });
  };

  // Fones gamer RGB: headset por cima, conchas pulsando e ondas de som
  D['dc-fones'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const cup = (x) => '<rect x="' + (x - 14) + '" y="80" width="28" height="48" rx="12" fill="#18181b" stroke="#000" stroke-width="2"/><rect x="' + (x - 9) + '" y="86" width="18" height="36" rx="8" fill="url(#' + u + 'rgb)"/>';
    return deco('dc-fones', o, {
      back: '',
      front: '<defs>' + lg(u + 'rgb', [[0, '#ff2975'], [.5, P.g], [1, '#00e5ff']], 0, 1) + '</defs><path d="M34 100C30 40 64 18 100 18C136 18 170 40 166 100" fill="none" stroke="#18181b" stroke-width="12" stroke-linecap="round"/>' +
        '<path d="M34 100C30 40 64 18 100 18C136 18 170 40 166 100" fill="none" stroke="url(#' + u + 'rgb)" stroke-width="3" stroke-linecap="round"/>' + cup(30) + cup(170) +
        '<path d="M30 126C30 150 50 166 72 170" fill="none" stroke="#18181b" stroke-width="4"/><circle cx="74" cy="170" r="6" fill="#18181b"/><circle cx="74" cy="170" r="2.5" fill="' + P.g + '"/>',
      layers: [
        { a: 'pulse', z: 'f', d: 1, svg: '<g fill="none" stroke="' + P.c + '" stroke-width="2.4" stroke-linecap="round"><path d="M8 94Q2 104 8 114M196 94Q202 104 196 114"/><path d="M-2 88Q-10 104 -2 120M206 88Q214 104 206 120" opacity=".6"/></g>' }
      ],
      parts: []
    });
  };

  // Kitsune: orelhas de raposa e fogos-fátuos azuis girando em volta
  D['dc-kitsune'] = (o) => {
    const P = o.P, u = o.u, { glow } = H();
    const ear = (dir) => '<g transform="translate(100 100) scale(' + dir + ' 1)"><path d="M20 -56C24 -78 36 -96 52 -104C56 -84 58 -64 56 -46Z" fill="#f8fafc" stroke="#0f172a" stroke-width="2.4" stroke-linejoin="round"/><path d="M28 -58C32 -74 40 -88 50 -94C52 -80 52 -66 50 -54Z" fill="' + P.a + '"/></g>';
    const wisp = (a) => { const p = pol(84, a); return glow(u + 'w' + a, +p[0], +p[1], 12, P.g, .9) + '<path transform="translate(' + p[0] + ' ' + p[1] + ')" d="M0 7C-5 3 -4 -3 0 -9C1 -4 5 -2 4 3C3 6 1 7 0 7Z" fill="#eaf6ff"/>'; };
    return deco('dc-kitsune', o, {
      back: '',
      front: ear(1) + ear(-1) + '<path d="M40 150C48 158 58 160 66 158M160 150C152 158 142 160 134 158" stroke="' + P.a + '" stroke-width="3" stroke-linecap="round" fill="none"/>',
      layers: [{ a: 'spin', z: 'f', d: 9, svg: wisp(40) + wisp(160) + wisp(280) }],
      parts: []
    });
  };

  // Corações: corações dando a volta e subindo
  D['dc-coracoes'] = (o) => {
    const P = o.P, u = o.u;
    const heart = (x, y, s, col) => '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 6C-10 -2 -10 -10 -4 -12C-1 -13 0 -10 0 -8C0 -10 1 -13 4 -12C10 -10 10 -2 0 6Z" fill="' + col + '" stroke="#fff" stroke-opacity=".5" stroke-width=".6"/>';
    return deco('dc-coracoes', o, {
      back: H().glow(u + 'g', 100, 100, 96, P.g, .4),
      layers: [
        { a: 'spin', z: 'f', d: 12, svg: [0, 60, 120, 180, 240, 300].map((a, i) => { const p = pol(76, a); return heart(p[0], p[1], i % 2 ? 1.2 : 1.6, i % 2 ? P.b : P.a); }).join('') },
        { a: 'spinr', z: 'b', d: 18, svg: [30, 150, 270].map((a) => { const p = pol(90, a); return heart(p[0], p[1], 1, P.c); }).join('') }
      ],
      parts: [{ t: 'brasa', n: 6, c: [P.b, P.c], x0: 15, x1: 85, y0: 60, y1: 100, s: [2, 3.5], d: [2.4, 4], sw: 14 }]
    });
  };

  // Holográfico: anel de arco-íris girando (gradiente cônico) com brilho
  D['dc-holo'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const seg = [...Array(24)].map((_, i) => { const a0 = i * 15, a1 = a0 + 15, p = pol(70, a0), q = pol(70, a1); return '<path d="M' + p.join(' ') + 'A70 70 0 0 1 ' + q.join(' ') + '" stroke="hsl(' + (i * 15) + ' 95% 62%)" stroke-width="8" fill="none"/>'; }).join('');
    return deco('dc-holo', o, {
      back: H().glow(u + 'g', 100, 100, 96, P.c, .3),
      layers: [
        { a: 'spin', z: 'f', d: 5, svg: seg },
        { a: 'spinr', z: 'f', d: 9, svg: '<circle cx="100" cy="100" r="80" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="1 9" stroke-linecap="round" opacity=".9"/>' }
      ],
      front: '<defs>' + lg(u + 'gl', [[0, '#fff', .9], [1, '#fff', 0]], 1, 1) + '</defs><path d="M52 44A70 70 0 0 1 100 30" stroke="url(#' + u + 'gl)" stroke-width="5" fill="none" stroke-linecap="round"/>',
      parts: [{ t: 'faisca', n: 6, c: ['#fff', '#a5f3fc', '#f5d0fe'], x0: 5, x1: 95, y0: 5, y1: 95, s: [2, 3.5], d: [1.4, 2.6] }]
    });
  };

  /* ================= coleção "Todas as Orelhas" (estilo das decorações do Discord) =================
     Orelhas felpudas no alto e uma cauda grossa dando a volta por baixo da foto, na frente dela. */
  const P2 = (a) => pol(1, a); void P2;
  // tubo felpudo seguindo o círculo (raio R) de a0 até a1 (graus, sentido horário); largura muda ao longo (wf)
  function furArc(a0, a1, R, wf, seed, n) {
    const r = C.rng(seed), N = n || 44, out = [], inn = [];
    // tufos: a cada ~4 pontos o pelo sai um pouco mais (curvas suaves entre eles)
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = a0 + (a1 - a0) * t, w = wf(t) / 2, clump = Math.pow(Math.abs(Math.sin(i * Math.PI / 4)), 3) * (2.4 + r() * 2), Rt = typeof R === 'function' ? R(t) : R;
      out.push(pol(Rt + w + clump, a)); inn.push(pol(Rt - w - clump * .5, a));
    }
    const smooth = (pts) => { let d = ''; for (let i = 1; i < pts.length - 1; i++) { const m = [f((+pts[i][0] + +pts[i + 1][0]) / 2), f((+pts[i][1] + +pts[i + 1][1]) / 2)]; d += 'Q' + pts[i].join(' ') + ' ' + m.join(' '); } return d + 'L' + pts[pts.length - 1].join(' '); };
    const ir = inn.slice().reverse();
    return { d: 'M' + out[0].join(' ') + smooth(out) + 'L' + ir[0].join(' ') + smooth(ir) + 'Z', out, inn };
  }
  // faixas escuras atravessando o tubo (guaxinim, tigre, panda-vermelho)
  function bands(a0, a1, R, wf, list, fill, op) {
    return list.map(([t0, t1]) => { const f0 = furArc(a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1, typeof R === 'function' ? (t) => R(t0 + (t1 - t0) * t) : R, (t) => wf(t0 + (t1 - t0) * t) * .98, 'bd' + t0, 8); return '<path d="' + f0.d + '" fill="' + fill + '" opacity="' + (op || 1) + '"/>'; }).join('');
  }
  // manchas de leopardo ao longo do tubo
  function spots(a0, a1, R, wf, n, seed, col) {
    const r = C.rng(seed); let sp = '';
    for (let i = 0; i < n; i++) { const t = (i + .5) / n, a = a0 + (a1 - a0) * t, w = wf(t) / 2, rr = (typeof R === 'function' ? R(t) : R) + (r() - .5) * w * 1.2, p = pol(rr, a), s2 = 2.2 + r() * 2.2;
      sp += '<g transform="translate(' + p.join(' ') + ') rotate(' + f(r() * 180) + ')"><path d="M' + f(-s2 * 1.3) + ' 0A' + f(s2 * 1.3) + ' ' + f(s2) + ' 0 1 1 ' + f(s2 * .9) + ' ' + f(s2 * .7) + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round"/><ellipse rx="' + f(s2 * .55) + '" ry="' + f(s2 * .42) + '" fill="#a8a29e"/></g>'; }
    return sp;
  }
  // orelha felpuda apontando para fora no ângulo a (graus); c1 = pelo de fora, c2 = de dentro
  function ear(a, size, c1, c2, stroke, seed, tuft) {
    const r = C.rng(seed), rad = (x) => (x - 90) * Math.PI / 180;
    const b = pol(54, a), dir = rad(a * .45), perp = dir + Math.PI / 2;
    const P = (along, side) => [f(+b[0] + Math.cos(dir) * along + Math.cos(perp) * side), f(+b[1] + Math.sin(dir) * along + Math.sin(perp) * side)];
    const hw = size * .52, tip = P(size, 0), L0 = P(0, -hw), R0 = P(0, hw);
    // lado de fora com tufos, lado de dentro liso, base arredondada escondida atrás da cabeça
    const furSide = (from, to, sgn) => { let d = ''; for (let i = 1; i <= 6; i++) { const t = i / 6, x = +from[0] + (to[0] - from[0]) * t, y = +from[1] + (to[1] - from[1]) * t, k = (i % 2 ? 3.2 : 1) * (.7 + r() * .6); d += 'Q' + f(x + Math.cos(perp) * k * sgn + Math.cos(dir) * 1.2) + ' ' + f(y + Math.sin(perp) * k * sgn + Math.sin(dir) * 1.2) + ' ' + f(x) + ' ' + f(y); } return d; };
    const outer = 'M' + L0.join(' ') + 'Q' + P(size * .55, -hw * 1.05).join(' ') + ' ' + P(size * .82, -hw * .45).join(' ') + furSide(P(size * .82, -hw * .45), tip, -1) + furSide(tip, P(size * .82, hw * .45), 1) + 'Q' + P(size * .55, hw * 1.05).join(' ') + ' ' + R0.join(' ') + 'Q' + P(-size * .2, 0).join(' ') + ' ' + L0.join(' ') + 'Z';
    const inner = 'M' + P(size * .12, -hw * .5).join(' ') + 'Q' + P(size * .55, -hw * .6).join(' ') + ' ' + P(size * .8, 0).join(' ') + 'Q' + P(size * .55, hw * .6).join(' ') + ' ' + P(size * .12, hw * .5).join(' ') + 'Z';
    let tufts = '';
    if (tuft) for (let i = 0; i < 5; i++) { const st = P(size * (.18 + i * .1), (r() - .5) * hw * .5), en = P(size * (.3 + i * .1), (r() - .5) * hw * .7); tufts += '<path d="M' + st.join(' ') + 'Q' + P(size * (.26 + i * .1), (r() - .5) * hw).join(' ') + ' ' + en.join(' ') + '" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".85"/>'; }
    return '<path d="' + outer + '" fill="' + c1 + '" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/><path d="' + inner + '" fill="' + c2 + '"/>' + tufts +
      '<path d="' + 'M' + P(size * .2, -hw * .7).join(' ') + 'Q' + P(size * .5, -hw * .8).join(' ') + ' ' + P(size * .75, -hw * .35).join(' ') + '" stroke="#fff" stroke-width="1.4" fill="none" opacity=".35" stroke-linecap="round"/>';
  }
  // camada da orelha que mexe (origem na base da orelha)
  const earLayer = (a, svg, d, dl) => { const b = pol(54, a); return { a: 'twitch', z: 'f', d: d || 5, dl: dl || 0, o: f(b[0] / 2) + '% ' + f(b[1] / 2) + '%', svg }; };
  // cauda: grossa no meio, ponta arredondada
  const tailW = (w) => (t) => w * (.25 + 1.05 * Math.sin(Math.PI * (.08 + t * .8)));
  const tailR = (R) => (t) => R - 6 + 12 * Math.sin(Math.PI * t * .9) + (t > .8 ? (t - .8) * 55 : 0);
  function animalDeco(key, o, cfg) {
    const u = o.u, wf = tailW(cfg.tw || 26), TR = tailR(cfg.tr || 72);
    const tail = furArc(cfg.t0, cfg.t1, TR, wf, key + 't');
    const tip = cfg.tip ? furArc(cfg.t1 - (cfg.t1 - cfg.t0) * .16, cfg.t1, (t) => TR(.84 + t * .16), (t) => wf(.84 + t * .16) * 1.02, key + 'tp', 10) : null;
    const defs = '<defs><linearGradient id="' + u + 'tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + cfg.c1 + '"/><stop offset="1" stop-color="' + cfg.c3 + '"/></linearGradient></defs>';
    const tailSvg = defs + '<path d="' + tail.d + '" fill="url(#' + u + 'tg)" stroke="' + cfg.st + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      (cfg.bands ? bands(cfg.t0, cfg.t1, TR, wf, cfg.bands, cfg.bc, cfg.bo) : '') + (cfg.spots ? spots(cfg.t0, cfg.t1 - 12, TR, wf, cfg.spots, key, cfg.sc) : '') +
      (tip ? '<path d="' + tip.d + '" fill="' + cfg.tip + '" stroke="' + cfg.st + '" stroke-width="1.4"/>' : '') +
      // brilho do pelo
      '<path d="' + furArc(cfg.t0 + 8, cfg.t1 - 10, (t) => TR(t) - 5, (t) => wf(t) * .22, key + 'hl', 30).d + '" fill="#fff" opacity=".2"/>';
    return deco(key, o, {
      back: (cfg.ring ? cfg.ring : '') + (cfg.back || ''),
      layers: [
        earLayer(-cfg.ea, ear(-cfg.ea, cfg.es, cfg.c1, cfg.c2, cfg.st, key + 'e1', cfg.tuft), 6.2, 0),
        earLayer(cfg.ea, ear(cfg.ea, cfg.es, cfg.c1, cfg.c2, cfg.st, key + 'e2', cfg.tuft), 7.4, 2.6),
        { a: 'wag', z: 'f', d: cfg.wd || 3.4, o: '50% 50%', svg: tailSvg },
        ...(cfg.extra || [])
      ],
      front: cfg.front || '',
      parts: cfg.parts || []
    });
  }

  // Guaxinim: orelhas cinza, argolas na orelha, cauda listrada e anel de pelo
  D['dc-guaxinim'] = (o) => animalDeco('dc-guaxinim', o, {
    c1: '#b8b3ad', c2: '#3a3432', c3: '#6f6862', st: '#1f1b19', ea: 34, es: 49, tuft: true, t0: 95, t1: 225, tw: 30, bands: [[.12, .22], [.34, .44], [.56, .66], [.78, .88]], bc: '#2a2522', tip: '#1f1b19',
    ring: '<path d="' + furArc(0, 360, 66, () => 10, 'gxr', 90).d + '" fill="#9d978f" stroke="#1f1b19" stroke-width="1.4"/>',
    extra: [{ a: 'bob', z: 'f', d: 2.6, svg: '<g fill="none" stroke="#e5e7eb" stroke-width="2.2"><circle cx="' + pol(84, -44)[0] + '" cy="' + (pol(84, -44)[1] + 14) + '" r="6"/><circle cx="' + (pol(84, -44)[0] - 4) + '" cy="' + (pol(84, -44)[1] + 26) + '" r="4.4"/></g>' }]
  });

  // Leopardo-das-Neves: orelhas brancas, cauda grossa pintada e flocos brilhando
  D['dc-leopardo'] = (o) => animalDeco('dc-leopardo', o, {
    c1: '#f5f5f4', c2: '#d6d3d1', c3: '#c9c5c0', st: '#44403c', ea: 36, es: 43, tuft: true, t0: 110, t1: 250, tw: 30, spots: 9, sc: '#3f3a36',
    parts: [{ t: 'faisca', n: 7, c: ['#e0f2fe', '#fff'], x0: 10, x1: 90, y0: 10, y1: 90, s: [2, 3.5], d: [1.6, 3] }]
  });

  // Lobo Lunar: orelhas brancas com dentro azul, lua crescente entre elas e cauda de pelo gelado
  D['dc-lobo-lunar'] = (o) => { const P = o.P; return animalDeco('dc-lobo-lunar', o, {
    c1: '#f8fafc', c2: P.b, c3: P.b, st: '#1e3a5f', ea: 38, es: 49, tuft: true, t0: 110, t1: 240, tw: 32, tip: '#ffffff',
    extra: [{ a: 'breath', z: 'f', d: 2.6, o: '50% 16%', svg: H().glow(o.u + 'mn', 100, 32, 24, '#fde68a', .8) + '<path d="M106 18A16 16 0 1 0 110 46A13 13 0 1 1 106 18Z" fill="#fde68a" stroke="#b45309" stroke-width="1"/>' }],
    parts: [{ t: 'faisca', n: 8, c: ['#fff', P.c], x0: 10, x1: 90, y0: 5, y1: 95, s: [2, 3.5], d: [1.6, 3] }]
  }); };

  // Raposa: orelhas laranja de ponta preta, cauda laranja de ponta branca
  D['dc-raposa'] = (o) => { const P = o.P; return animalDeco('dc-raposa', o, {
    c1: P.a, c2: '#fff7ed', c3: P.d, st: '#431407', ea: 36, es: 49, t0: 100, t1: 235, tw: 30, tip: '#fffaf0', tuft: true,
    front: '' }); };

  // Tigre: orelhas com mancha branca atrás, cauda listrada de preto
  D['dc-tigre'] = (o) => { const P = o.P; return animalDeco('dc-tigre', o, {
    c1: P.a, c2: '#fff7ed', c3: P.d, st: '#1c0a00', ea: 40, es: 40, t0: 105, t1: 240, tw: 26, bands: [[.1, .16], [.26, .32], [.42, .48], [.58, .64], [.74, .8]], bc: '#1c0a00', tip: '#1c0a00' }); };

  // Panda-vermelho: orelhas com borda branca, cauda anelada
  D['dc-panda-vermelho'] = (o) => animalDeco('dc-panda-vermelho', o, {
    c1: '#c2410c', c2: '#fff7ed', c3: '#7c2d12', st: '#2a0e05', ea: 40, es: 37, tuft: true, t0: 100, t1: 230, tw: 30, bands: [[.16, .26], [.4, .5], [.64, .74]], bc: '#fed7aa', bo: .9, tip: '#2a0e05' });

  // Bordo-Japonês: galho torcido em volta com folhas vermelhas e folhas caindo
  D['dc-bordo'] = (o) => {
    const P = o.P, u = o.u, r = C.rng('bd' + u);
    const leaf = (x, y, s, rot, col) => '<path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ') scale(' + f(s) + ')" d="M0 -10L2 -4L7 -7L5 -1L10 0L5 2L7 7L1 4L0 10L-1 4L-7 7L-5 2L-10 0L-5 -1L-7 -7L-2 -4Z" fill="' + col + '" stroke="#450a0a" stroke-width=".6"/>';
    let branch = '', leaves = '';
    [[200, 330, 70], [340, 470, 72], [60, 170, 68]].forEach(([a0, a1, R], k) => { const fa = furArc(a0, a1, R, () => 5, 'br' + k, 28); branch += '<path d="' + fa.d + '" fill="#6b3a1e" stroke="#2a150a" stroke-width="1"/>'; });
    for (let i = 0; i < 22; i++) { const a = r() * 360, p = pol(68 + (r() - .5) * 16, a); leaves += leaf(p[0], p[1], .8 + r() * .7, r() * 360, [P.a, P.b, '#dc2626', '#b91c1c'][i % 4]); }
    return deco('dc-bordo', o, {
      front: branch + leaves,
      layers: [{ a: 'sway', z: 'f', d: 4, svg: leaf(30, 60, 1.3, 20, P.b) + leaf(172, 150, 1.2, -30, P.a) }],
      parts: [{ t: 'folha', n: 6, c: [P.a, '#dc2626', P.b], x0: 0, x1: 100, s: [5, 7], d: [4, 7], sw: 16 }]
    });
  };

  // Anjo Caído: asas grandes subindo em "V" atrás do avatar, com brilho nas pontas (cores: penumbra, preto, branco)
  D['dc-anjo-caido'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const feather = (x, y, len, ang, wd, id) => '<path transform="translate(' + x + ' ' + y + ') rotate(' + ang + ')" d="M0 0C' + f(wd) + ' ' + f(-len * .3) + ' ' + f(wd * .6) + ' ' + f(-len * .85) + ' 0 ' + f(-len) + 'C' + f(-wd * .6) + ' ' + f(-len * .85) + ' ' + f(-wd) + ' ' + f(-len * .3) + ' 0 0Z" fill="url(#' + id + ')" stroke="' + P.c + '" stroke-opacity=".55" stroke-width=".9"/>';
    const wing = (dir) => { let w = '<g transform="translate(100 168) scale(' + (dir * 1.4) + ' 1.4)">'; for (let i = 0; i < 11; i++) w += feather(30 + i * 3, -10 - i * 7, 70 - Math.abs(i - 5) * 3, -8 + i * 6, 9, u + 'wg'); for (let i = 0; i < 8; i++) w += feather(38 + i * 3, -20 - i * 7, 46, 2 + i * 7, 8, u + 'wg2'); return w + '</g>'; };
    const defs = '<defs>' + lg(u + 'wg', [[0, P.d], [.65, P.a], [1, P.c]], 0, 0, 0, 1) + lg(u + 'wg2', [[0, P.a], [1, '#ffffff']], 0, 0, 0, 1) + '</defs>';
    return deco('dc-anjo-caido', o, {
      back: defs,
      layers: [{ a: 'flap', z: 'b', d: 2.2, o: '50% 75%', svg: defs + wing(1) + wing(-1) }],
      parts: [{ t: 'faisca', n: 6, c: ['#fff', P.c], x0: 5, x1: 95, y0: 0, y1: 60, s: [2, 3.5], d: [1.6, 3] }]
    });
  };

  // Dragão holográfico: dragão em traço neon (sem preenchimento) dando a volta, brilhando
  D['dc-dragao-neon'] = (o) => {
    const P = o.P, u = o.u;
    const R = 76, arc = (a0, a1) => { const p = pol(R, a0), q = pol(R, a1); return 'M' + p.join(' ') + 'A' + R + ' ' + R + ' 0 ' + ((a1 - a0 + 360) % 360 > 180 ? 1 : 0) + ' 1 ' + q.join(' '); };
    const neon = (d, w) => '<path d="' + d + '" fill="none" stroke="' + P.g + '" stroke-width="' + (w + 7) + '" opacity=".25" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + P.b + '" stroke-width="' + w + '" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".9"/>';
    const body = arc(200, 20), belly = arc(206, 14).replace(/A76 76/, 'A68 68').replace(/^M[^A]*/, 'M' + pol(68, 206).join(' '));
    let scales = ''; for (let a = 210; a < 380; a += 12) { const p = pol(R + 10, a), q = pol(R + 20, a + 5); scales += '<path d="M' + p.join(' ') + 'L' + q.join(' ') + 'L' + pol(R + 10, a + 9).join(' ') + '"/>'; }
    const hp = pol(R, 24);
    const head = '<g transform="translate(' + hp.join(' ') + ') rotate(-30) scale(1.3)" fill="none" stroke-linejoin="round"><path d="M-20 -8C-6 -20 16 -18 30 -8C40 -2 46 4 44 8C36 10 30 8 24 10L16 12C6 18 -8 16 -18 8Z"/><path d="M16 12C28 12 36 12 44 8C40 16 28 20 16 16Z"/><path d="M-4 -10C0 -24 12 -32 22 -34M-12 -8C-10 -22 -2 -30 6 -34"/><circle cx="6" cy="-6" r="2.4"/><path d="M40 4C54 -4 66 2 72 12"/></g>';
    return deco('dc-dragao-neon', o, {
      back: '',
      layers: [
        { a: 'pulse', z: 'f', d: 1.8, svg: neon(body, 4) + neon(belly, 2) + '<g fill="none" stroke="' + P.c + '" stroke-width="2">' + scales + '</g>' + '<g stroke="' + P.g + '" stroke-width="8" opacity=".25">' + head + '</g><g stroke="' + P.b + '" stroke-width="3">' + head + '</g><g stroke="#fff" stroke-width="1">' + head + '</g>' }
      ],
      parts: [{ t: 'faisca', n: 7, c: [P.b, P.c, '#fff'], x0: 5, x1: 95, y0: 5, y1: 95, s: [2, 3.5], d: [1.2, 2.6] }]
    });
  };

  // Chapéu de palha cônico com cordão (a cor "chuva" põe chuva caindo)
  D['dc-chapeu-palha'] = (o) => {
    const P = o.P, u = o.u, { lg } = H();
    const hat = '<path d="M100 8L186 58C166 66 34 66 14 58Z" fill="url(#' + u + 'h)" stroke="#3b2a12" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M100 8L100 62M100 8L60 62M100 8L140 62M100 8L32 60M100 8L168 60" stroke="#3b2a12" stroke-width="1" opacity=".5"/>' +
      '<path d="M14 58C34 66 166 66 186 58" fill="none" stroke="#3b2a12" stroke-width="2.4"/><path d="M92 8L108 8" stroke="#3b2a12" stroke-width="3"/>' +
      '<path d="M40 62C36 110 60 160 100 176C140 160 164 110 160 62" fill="none" stroke="' + P.b + '" stroke-width="1.8" opacity=".85"/><circle cx="100" cy="177" r="3" fill="' + P.b + '"/>';
    return deco('dc-chapeu-palha', o, {
      front: '<defs>' + lg(u + 'h', [[0, P.c], [.5, P.a], [1, P.d]], 1, 0) + '</defs>' + hat,
      layers: [],
      parts: o.d && o.d.chuva ? [{ t: 'chuva', n: 18, c: '#bfdbfe', x0: 5, x1: 95, s: [3, 5], d: [.5, .9] }] : []
    });
  };

  // Katana cibernética: lâmina neon passando pelo avatar (vai e volta) e flores embaixo
  D['dc-katana'] = (o) => {
    const P = o.P, u = o.u, r = C.rng('kt' + u);
    const blade = '<g transform="rotate(-28 100 100)"><path d="M20 100H168L184 96L168 104H20Z" fill="' + P.c + '"/><path d="M20 100H176" stroke="' + P.g + '" stroke-width="6" opacity=".35"/><path d="M20 100H178" stroke="#fff" stroke-width="1.2"/>' +
      '<rect x="-6" y="96" width="26" height="8" rx="2" fill="#1f1f24" stroke="' + P.b + '" stroke-width="1"/><rect x="18" y="92" width="4" height="16" rx="1.5" fill="' + P.b + '"/></g>';
    let fl = '';
    for (let i = 0; i < 9; i++) { const p = pol(66 + r() * 10, 100 + i * 14); let pe = ''; for (let k = 0; k < 5; k++) pe += '<ellipse cx="0" cy="-4" rx="2.6" ry="4.6" transform="rotate(' + (k * 72) + ')" fill="' + (i % 2 ? P.a : P.b) + '"/>'; fl += '<g transform="translate(' + p.join(' ') + ') scale(' + f(.9 + r() * .6) + ')">' + pe + '<circle r="1.6" fill="#fff"/></g>'; }
    return deco('dc-katana', o, {
      front: fl,
      layers: [{ a: 'swing', z: 'f', d: 2.6, o: '50% 50%', svg: blade }],
      parts: [{ t: 'petala', n: 6, c: [P.a, P.b, '#fff'], x0: 40, x1: 100, s: [3, 5], d: [3, 5], sw: 10 }]
    });
  };

  // Passagem dimensional: anel de energia azul irregular, estalando
  D['dc-portal'] = (o) => {
    const P = o.P, u = o.u;
    const ring = (seed, R, jag, w, col, op) => { const r = C.rng(seed + u); const pts = []; for (let i = 0; i <= 72; i++) pts.push(pol(R + (r() - .5) * jag, i * 5)); return '<path d="M' + pts.map((p) => p.join(' ')).join('L') + 'Z" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linejoin="round" opacity="' + op + '"/>'; };
    return deco('dc-portal', o, {
      back: H().glow(u + 'g', 100, 100, 96, P.g, .5),
      layers: [
        { a: 'spin', z: 'f', d: 7, svg: ring('p1', 68, 10, 7, P.g, .35) + ring('p2', 68, 8, 3, P.b, .9) },
        { a: 'spinr', z: 'f', d: 5, svg: ring('p3', 70, 14, 1.6, '#fff', .9) },
        { a: 'flash', z: 'f', d: 1.8, svg: ring('p4', 74, 22, 2, P.c, 1) }
      ],
      parts: [{ t: 'faisca', n: 10, c: [P.c, '#fff', P.b], x0: 5, x1: 95, y0: 5, y1: 95, s: [2, 3.5], d: [.8, 1.8] }]
    });
  };

  Object.keys(D).forEach((k) => C.register('moldura', k, D[k]));
  C.DECOS = Object.keys(D);
})();
