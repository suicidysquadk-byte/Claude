/* Vitrine do perfil: junta tema, capa, banner, arma, avatar (com moldura, chapéu, rosto e animação), pet, chaveiro,
   nick com efeito e o efeito de abertura. Também faz as miniaturas dos itens e a física dos chaveiros:
   eles balançam com a rolagem (com peso e inércia) e voltam devagar para o centro quando a tela para.
   Animação fora da tela ou com o app em segundo plano fica pausada para não gastar bateria. */
(function () {
  const C = BH.cosm;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ok = (kind, e) => !!(e && e.data && C.has(kind, e.data.art));
  const D = (kind, e, o) => (ok(kind, e) ? C.draw(kind, e.data, e.v, o) : '');

  // look do servidor ({tipo: {id, data, v, ...}}) → cartão do avatar para BH.ui.av
  function card(u, look) {
    look = look || {};
    const m = look.moldura, a = look.acessorio, t = look.titulo, c = look.cor;
    return {
      id: u.id, nick: u.nick, avatar_url: u.avatar_url, verified: u.verified, anonymous: u.anonymous,
      frame: m ? m.data : null, frame_v: m && m.v, av_art: look.avatar ? look.avatar.data : null, av_v: look.avatar && look.avatar.v,
      accessory: a && a.data && a.data.acc ? a.data.acc : null,
      title: t && t.data ? t.data.text : null, title_fx: t && t.data ? t.data.fx : null,
      color: c && c.data ? (c.data.color || C.palOf(c.data, c.v).g) : null
    };
  }

  function nick(u, look, still) {
    const c = look && look.cor;
    if (ok('cor', c)) return C.draw('cor', c.data, c.v, { user: u, still });
    return '<b class="nk"' + (c && c.data && c.data.color ? ' style="color:' + esc(c.data.color) + '"' : '') + '>' + esc(u.nick || 'Sem nick') + '</b>';
  }

  function bannerHtml(e, seed, still) {
    if (!e || !e.data) return '';
    if (ok('banner', e)) return C.draw('banner', e.data, e.v, { still });
    return BH.cos && BH.cos.banner ? BH.cos.banner(e.data, 'cz-bn-old', '', seed) : '';
  }

  /* ---------------- vitrine ----------------
     opts: { still, play (efeito e entrada ao abrir), edit (html de botões no canto), avatarWrap (fn que envolve o avatar),
             size ('lg' no perfil, 'md' na prévia), id } */
  function stage(u, look, opts) {
    opts = opts || {};
    look = look || {};
    const still = !!opts.still;
    const cardU = card(u, look);
    const tema = look.tema, capa = look.capa, anim = look.animacao, ent = look.entrada, ef = look.efeito;
    const themeP = tema && tema.data ? C.palOf(tema.data, tema.v) : null;
    const hat = D('chapeu', look.chapeu, { still, user: u });
    const face = ok('acessorio', look.acessorio) ? C.draw('acessorio', look.acessorio.data, look.acessorio.v, { still, user: u }) : '';
    const an = D('animacao', anim, { still, user: u, seed: u.id || 'x' });
    const av = BH.ui.av(cardU, 'xl', 'cz-avatar' + (still ? ' still' : ''));
    const avBox = '<div class="cz-av' + (ok('animacao', anim) ? ' an-' + anim.data.art : '') + '">' + an + (opts.avatarWrap ? opts.avatarWrap(av) : av) +
      (hat ? '<div class="cz-hat">' + hat + '</div>' : '') + (face ? '<div class="cz-face">' + face + '</div>' : '') + '</div>';
    const kc = D('chaveiro', look.chaveiro, { still, user: u });
    const kcW = look.chaveiro && look.chaveiro.data && look.chaveiro.data.peso ? look.chaveiro.data.peso : 1;
    const bn = bannerHtml(look.banner, u.id, still);
    return '<div class="cz-stage cz-dc cz-' + (opts.size || 'lg') + (still ? ' still' : '') + (kc ? ' has-kc' : '') + (ok('pet', look.pet) ? ' has-pet' : '') + (bn ? '' : ' no-bn') + (opts.play && !still ? ' cz-play' : '') + (themeP ? ' has-tema' : '') + (capa ? ' has-capa' : '') + '"' +
      (themeP ? ' style="' + C.themeVars(themeP) + '"' : '') + (opts.id ? ' id="' + esc(opts.id) + '"' : '') + '>' +
      (ok('fundo', look.fundo) ? '<div class="cz-tema cz-fundo">' + D('fundo', look.fundo, { still, size: [400, 320] }) + '</div>'
        : look.fundo && look.fundo.data && look.fundo.data.fx && BH.cos && BH.cos.fx ? '<div class="cz-tema cz-fundo">' + BH.cos.fx(look.fundo.data.fx, u.id) + '</div>' : '') +
      (themeP ? '<div class="cz-tema">' + D('tema', tema, { still }) + '</div>' : '') +
      (ok('capa', capa) ? '<div class="cz-capa">' + C.draw('capa', capa.data, capa.v, { still }) + '</div>' : '') +
      (bn ? '<div class="cz-banner">' + bn + '</div>' : '') +
      '<div class="cz-hero' + (ok('entrada', ent) ? ' ent-' + ent.data.art : '') + '"><div class="cz-row">' +
      '<div class="cz-fig">' + (ok('arma', look.arma) ? '<div class="cz-arma">' + D('arma', look.arma, { still }) + '</div>' : '') + avBox + '</div>' +
      '<div class="cz-who"><div class="cz-name">' + nick(u, look, still) + (u.verified && BH.ui.verified ? BH.ui.verified(u) : '') + '</div>' +
      (cardU.title ? '<div class="cz-title">' + BH.ui.title(cardU) + '</div>' : '') + '</div></div>' + (opts.below || '') + '</div>' +
      // chaveiro pendurado na borda do banner e pet sentado no canto do cartão (estilo vitrine do Discord)
      (kc ? '<div class="cz-kc" data-k="' + (32 / kcW).toFixed(1) + '" role="button" tabindex="-1" aria-label="Chaveiro">' + kc + '</div>' : '') +
      (ok('pet', look.pet) ? '<div class="cz-pet">' + D('pet', look.pet, { still }) + '</div>' : '') +
      (ok('entrada', ent) && !still && opts.play ? '<div class="cz-ent">' + C.draw('entrada', ent.data, ent.v, {}) + '</div>' : '') +
      (ok('efeito', ef) && !still ? '<div class="cz-ef">' + (opts.play ? C.draw('efeito', ef.data, ef.v, { seed: u.id }) : '') + '</div>' +
        '<button type="button" class="cz-replay" data-act="czReplay" aria-label="Ver o efeito de novo">✦</button>' : '') +
      (opts.edit || '') + '</div>';
  }

  /* ---------------- miniaturas (grade da loja e do inventário) ---------------- */
  const PH = (u) => BH.ui.av({ id: (u && u.id) || 'x', nick: (u && u.nick) || '?', avatar_url: u && u.avatar_url }, 'lg', 'still');
  // miniatura já desenhada fica guardada: voltar para uma categoria não refaz dezenas de SVGs
  const TH = new Map();
  function thumb(it, v, u, byId) {
    const key = it.id + '|' + (v || '') + '|' + ((u && u.id) || '') + '|' + ((u && u.avatar_url) || '') + '|' + ((u && u.nick) || '') + '|' + (BH.anim && BH.anim.lite() ? 1 : 0);
    let html = TH.get(key);
    if (html == null) { html = thumb0(it, v, u, byId); if (TH.size > 600) TH.clear(); TH.set(key, html); }
    return html;
  }
  function thumb0(it, v, u, byId) {
    const d = it.data || {}, e = { data: d, v: v || null };
    const o = { still: true, user: u, seed: it.id };
    switch (it.kind) {
      case 'avatar': return '<div class="th th-av"><span class="th-circle">' + D('avatar', e, o) + '</span></div>';
      case 'banner': return '<div class="th th-banner">' + bannerHtml(e, it.id, true) + '</div>';
      case 'capa': return '<div class="th th-capa">' + D('capa', e, o) + '</div>';
      case 'fundo': return '<div class="th th-fundo">' + (ok('fundo', e) ? D('fundo', e, o) : (BH.cos && BH.cos.fx ? BH.cos.fx(d.fx, it.id) : '')) + '</div>';
      case 'moldura': return '<div class="th th-fr">' + BH.ui.av({ id: (u && u.id) || 'x', nick: (u && u.nick) || '?', avatar_url: u && u.avatar_url, frame: d, frame_v: v }, 'md', 'still') + '</div>';
      case 'pet': return '<div class="th th-pet">' + D('pet', e, o) + '</div>';
      case 'chaveiro': return '<div class="th th-kc">' + D('chaveiro', e, o) + '</div>';
      case 'chapeu': return '<div class="th th-hat"><div class="cz-av">' + PH(u) + '<div class="cz-hat">' + D('chapeu', e, o) + '</div></div></div>';
      case 'acessorio':
        if (ok('acessorio', e)) return '<div class="th th-hat"><div class="cz-av">' + PH(u) + '<div class="cz-face">' + D('acessorio', e, o) + '</div></div></div>';
        return '<div class="th th-hat">' + BH.ui.av({ id: (u && u.id) || 'x', nick: (u && u.nick) || '?', avatar_url: u && u.avatar_url, accessory: d.acc }, 'md', 'acc-pv') + '</div>';
      case 'arma': return '<div class="th th-arma">' + D('arma', e, o) + '</div>';
      case 'animacao': return '<div class="th th-an"><div class="cz-av an-' + esc(d.art) + '">' + D('animacao', e, o) + PH(u) + '</div></div>';
      case 'efeito': return '<div class="th th-ef">' + D('efeito', e, o) + '<span class="th-dot"></span></div>';
      case 'entrada': return '<div class="th th-ent"><span class="th-ent-ic">' + ({ queda: '⤓', giro: '⟳', portal: '◎', glitch: '▚', raio: 'ϟ', fumaca: '☁', zoom: '⤢', surgir: '↥' }[d.art] || '✦') + '</span>' + PH(u) + '</div>';
      case 'tema': return '<div class="th th-tema">' + D('tema', e, o) + '<span class="th-mock"><i></i><b></b><b></b></span></div>';
      case 'cor': return '<div class="th th-cor">' + (ok('cor', e) ? C.draw('cor', d, v, o) : '<b class="nk" style="color:' + esc(d.color) + '">' + esc((u && u.nick) || 'Nick') + '</b>') + '</div>';
      case 'titulo': return '<div class="th th-cor">' + BH.ui.title({ title: d.text, title_fx: d.fx }) + '</div>';
      case 'bundle': {
        const parts = (d.items || []).map((id) => byId && byId[id]).filter(Boolean).slice(0, 4);
        return '<div class="th th-bundle">' + parts.map((p) => '<span class="th-b">' + thumb0(p, d.variant, u, null) + '</span>').join('') + '</div>';
      }
      default: return '<div class="th th-prio">⚡</div>';
    }
  }

  /* ---------------- física dos chaveiros ---------------- */
  const K = { list: [], raf: 0, last: 0, pos: new WeakMap() };
  function prune() { K.list = K.list.filter((s) => s.el.isConnected); }
  function kick(v) { if (!K.list.length) return; K.list.forEach((s) => { s.w = Math.max(-420, Math.min(420, s.w + v * s.inv)); }); if (!K.raf) { K.last = 0; K.raf = requestAnimationFrame(step); } }
  function step(ts) {
    const dt = K.last ? Math.min(.05, (ts - K.last) / 1000) : 1 / 60;
    K.last = ts;
    prune();
    let moving = false;
    K.list.forEach((s) => {
      // mola com amortecimento: puxa para o centro (k) e perde força (c); o peso deixa mais lento
      const a = -s.k * s.th - s.c * s.w;
      s.w += a * dt;
      s.th = Math.max(-75, Math.min(75, s.th + s.w * dt));
      if (Math.abs(s.th) > .04 || Math.abs(s.w) > .06) moving = true; else { s.th = 0; s.w = 0; }
      s.sw.forEach((g) => { g.style.transform = 'rotate(' + s.th.toFixed(2) + 'deg)'; });
    });
    K.raf = moving ? requestAnimationFrame(step) : 0;
  }
  // qualquer rolagem (a página ou uma lista) empurra o chaveiro para o lado contrário
  window.addEventListener('scroll', (ev) => {
    if (!K.list.length) return;
    const t = ev.target && ev.target.nodeType === 1 ? ev.target : (document.scrollingElement || document.documentElement);
    const y = t.scrollTop, prev = K.pos.has(t) ? K.pos.get(t) : y;
    K.pos.set(t, y);
    const dy = y - prev;
    if (dy) kick(-dy * 5);
  }, { capture: true, passive: true });

  /* ---------------- pausa fora da tela ---------------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('cz-off', !e.isIntersecting)), { rootMargin: '80px' }) : null;
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('bh-hidden', document.hidden));

  // liga a vitrine depois que o HTML entra na tela
  function mount(root) {
    (root || document).querySelectorAll('.cz-stage:not([data-on])').forEach((st) => {
      st.setAttribute('data-on', '1');
      if (io) io.observe(st);
      st.querySelectorAll('.cz-kc').forEach((el) => {
        const k = Number(el.dataset.k) || 32;
        const s = { el, sw: [...el.querySelectorAll('.kc-swing')], th: 0, w: 0, k, c: Math.max(1.4, Math.sqrt(k) * .42), inv: Math.min(1.6, 32 / k) };
        K.list.push(s);
        el.addEventListener('pointerdown', () => { s.w += (Math.random() > .5 ? 1 : -1) * 260; if (!K.raf) { K.last = 0; K.raf = requestAnimationFrame(step); } });
      });
      if (st.classList.contains('cz-play')) setTimeout(() => st.classList.add('cz-played'), C.EFFECT_MS || 2600);
    });
    prune();
    // tela pesada: confere se o celular aguenta (no automático liga o modo leve se travar)
    if (BH.anim && BH.anim.guard) BH.anim.guard();
  }

  // repete o efeito de abertura (botão ✦ na vitrine)
  function replay(st, lookEf, seed) {
    const box = st && st.querySelector('.cz-ef');
    if (!box || !lookEf || !lookEf.data) return;
    box.innerHTML = C.draw('efeito', lookEf.data, lookEf.v, { seed });
    st.classList.remove('cz-played');
    const hero = st.querySelector('.cz-hero');
    if (hero) { hero.style.animation = 'none'; void hero.offsetWidth; hero.style.animation = ''; }
    st.classList.add('cz-play');
    clearTimeout(st._efT);
    st._efT = setTimeout(() => st.classList.add('cz-played'), C.EFFECT_MS || 2600);
  }

  // fundo da página inteira do perfil (fundo antigo de partículas ou cena nova)
  function pageFx(look, seed) {
    const f = look && look.fundo;
    if (!f || !f.data) return '';
    if (ok('fundo', f)) return '<div class="fx p-fx cz-pagefx" aria-hidden="true">' + C.draw('fundo', f.data, f.v, {}) + '</div>';
    return f.data.fx && BH.cos && BH.cos.fx ? BH.cos.fx(f.data.fx, seed, 'p-fx') : '';
  }

  Object.assign(C, { card, nick, stage, thumb, mount, replay, kick, pageFx });
})();
