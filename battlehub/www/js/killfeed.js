/* Leitura do killfeed: tira quadros do vídeo, lê o texto com o Tesseract.js e procura os nicks da sala.
   Uma linha "suspeito ... outro jogador" vira um abate do suspeito. A equipe sempre confere no vídeo antes de salvar. */
window.BH = window.BH || {};
(function () {
  // baixado só quando a equipe usa a leitura (cerca de 7 MB na primeira vez, depois fica no cache)
  const TS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1';
  const CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1';
  const LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int';
  let loading = null;
  function load() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = TS + '/dist/tesseract.min.js'; s.async = true;
      s.onload = () => res(window.Tesseract);
      s.onerror = () => { loading = null; s.remove(); rej(new Error('Não foi possível baixar o leitor de texto. Confira a internet e tente de novo.')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  async function worker(logger) {
    const T = await load();
    const w = await T.createWorker('eng', 1, { workerPath: TS + '/dist/worker.min.js', corePath: CORE, langPath: LANG, logger: logger || (() => {}) });
    await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    return w;
  }

  // nick comparável: sem acento, minúsculo, só letras e números; letras que o leitor confunde viram uma só
  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[!|]/g, 'l').replace(/[^a-z0-9]/g, '').replace(/0/g, 'o').replace(/[1i]/g, 'l').replace(/5/g, 's').replace(/8/g, 'b');

  // menor distância de edição de p contra qualquer trecho de t (e onde o trecho termina)
  function approx(p, t) {
    const m = p.length;
    let prev = new Array(m + 1);
    for (let i = 0; i <= m; i++) prev[i] = i;
    let best = m, end = -1;
    for (let j = 1; j <= t.length; j++) {
      const cur = [0];
      for (let i = 1; i <= m; i++) cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (p[i - 1] === t[j - 1] ? 0 : 1));
      if (cur[m] < best) { best = cur[m]; end = j; }
      prev = cur;
    }
    return { d: best, end };
  }
  function prep(players) {
    return players.map((p) => ({ id: p.id, suspect: !!p.suspect, keys: [...new Set((p.names || []).map(norm).filter((k) => k.length >= 3))] }));
  }
  // jogadores citados numa linha, na ordem em que aparecem
  function findNames(text, players) {
    const t = norm(text);
    if (t.length < 3) return [];
    const hits = [];
    players.forEach((p) => {
      let best = null;
      p.keys.forEach((k) => {
        const r = approx(k, t), score = 1 - r.d / k.length;
        const need = k.length <= 4 ? 1 : k.length <= 6 ? 0.8 : 0.72;
        if (score >= need && (!best || score > best.score)) best = { id: p.id, suspect: p.suspect, score, start: r.end - k.length, end: r.end, len: k.length };
      });
      if (best) hits.push(best);
    });
    hits.sort((a, b) => b.score * b.len - a.score * a.len);
    const out = [];
    hits.forEach((h) => { if (!out.some((o) => h.start < o.end && o.start < h.end)) out.push(h); });
    return out.sort((a, b) => a.start - b.start);
  }
  // abatidos pelo suspeito numa linha: quem vem depois dele ("Assassino [arma] Vítima")
  function killsIn(text, players) {
    const names = findNames(text, players);
    const si = names.findIndex((n) => n.suspect);
    return { names, victims: si < 0 ? [] : names.slice(si + 1).filter((n) => !n.suspect).map((n) => n.id) };
  }

  // quadro recortado, ampliado e em preto no branco (o texto do killfeed é claro sobre fundo escuro)
  function grab(video, crop, canvas) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const sx = Math.round(crop.x * vw), sy = Math.round(crop.y * vh);
    const sw = Math.max(8, Math.round(crop.w * vw)), sh = Math.max(8, Math.round(crop.h * vh));
    const scale = Math.min(3, Math.max(1, 900 / sw));
    canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const img = g.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.max(d[i], d[i + 1], d[i + 2]) > 175 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(img, 0, 0);
  }
  const small = document.createElement('canvas');
  function sig(canvas) {
    small.width = 64; small.height = 32;
    const g = small.getContext('2d', { willReadFrequently: true });
    g.drawImage(canvas, 0, 0, 64, 32);
    const d = g.getImageData(0, 0, 64, 32).data, out = new Uint8Array(64 * 32);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) out[j] = d[i] < 128 ? 1 : 0;
    return out;
  }
  const diff = (a, b) => { if (!a || !b) return 1; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n / a.length; };
  function seek(v, t) {
    return new Promise((res) => {
      const done = () => { v.removeEventListener('seeked', done); clearTimeout(to); res(); };
      const to = setTimeout(done, 5000);
      v.addEventListener('seeked', done);
      v.currentTime = t;
    });
  }

  // o: { crop, step, players, progress(pct, t), line({t, text}), kill(id, t), stopped() }
  async function scan(video, w, o) {
    video.pause();
    const players = prep(o.players);
    const canvas = document.createElement('canvas');
    const dur = video.duration, step = o.step || 2;
    let prev = null, stopped = false;
    for (let t = Math.min(0.5, dur / 2); t < dur; t += step) {
      if (o.stopped && o.stopped()) { stopped = true; break; }
      await seek(video, t);
      grab(video, o.crop, canvas);
      if (o.progress) o.progress(Math.min(1, t / dur), t);
      const s = sig(canvas);
      if (diff(s, prev) < 0.012) continue; // killfeed igual ao do quadro anterior
      prev = s;
      const { data } = await w.recognize(canvas);
      String(data.text || '').split('\n').map((x) => x.trim()).filter((x) => x.length >= 3).forEach((text) => {
        const k = killsIn(text, players);
        if (!k.names.length) return;
        if (o.line) o.line({ t, text });
        k.victims.forEach((id) => { if (o.kill) o.kill(id, t); });
      });
    }
    if (o.progress) o.progress(1, dur);
    return { stopped };
  }

  BH.killfeed = { worker, scan, norm, prep, findNames, killsIn };
})();
