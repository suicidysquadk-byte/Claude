(() => {
  'use strict';

  const PROJETOS = window.PROJETOS || [];
  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // ------------------------------------------------------------------ quadros do vídeo
  const FPS = 15;
  const N_QUADROS = 172;
  const T0 = 0.8;                      // segundo do vídeo do primeiro quadro
  const T1 = T0 + (N_QUADROS - 1) / FPS;
  const quadros = new Array(N_QUADROS);
  let carregados = 0;

  function carregarQuadros() {
    const ordem = [];
    // primeiro a cada 8, depois o resto: o passeio fica usável cedo
    for (let i = 0; i < N_QUADROS; i += 8) ordem.push(i);
    for (let i = 0; i < N_QUADROS; i++) if (i % 8) ordem.push(i);
    let fila = 0;
    const proximo = () => {
      if (fila >= ordem.length) return;
      const i = ordem[fila++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { quadros[i] = img; carregados++; atualizarCarga(); proximo(); };
      img.onerror = () => { carregados++; atualizarCarga(); proximo(); };
      img.src = `frames/f${String(i + 1).padStart(3, '0')}.webp`;
    };
    for (let k = 0; k < 6; k++) proximo();
  }

  function atualizarCarga() {
    const pct = Math.round((carregados / N_QUADROS) * 100);
    $('carregando').textContent = pct < 100 ? `Preparando a loja… ${pct}%` : 'Arraste para girar a fachada';
  }

  function quadroMaisProximo(i) {
    if (quadros[i]) return quadros[i];
    for (let d = 1; d < N_QUADROS; d++) {
      if (quadros[i - d]) return quadros[i - d];
      if (quadros[i + d]) return quadros[i + d];
    }
    return null;
  }

  // ------------------------------------------------------------------ fachada 3D
  const cena3d = { ok: false };

  function montarFachada() {
    if (!window.THREE) return false;
    const canvas = $('cena3d');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#cfd4d6');
    scene.fog = new THREE.Fog('#cfd4d6', 22, 48);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, o));
    const escuro = M('#1f2022', { roughness: 0.75 });
    const metal = M('#111112', { roughness: 0.35, metalness: 0.6 });
    const madeira = M('#8b5b35', { roughness: 0.7 });
    const branco = M('#e8e6e1', { roughness: 0.5 });
    const piso = M('#c3bfb7', { roughness: 0.95 });
    const vidro = M('#39424a', { roughness: 0.08, metalness: 0.85, transparent: true, opacity: 0.6 });
    const terracota = M('#b0643a', { roughness: 0.8 });
    const folha = M('#4f6b3a', { roughness: 0.8 });
    const internoMat = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color('#ffcf8f'), emissiveIntensity: 0 });

    const box = (w, h, d, mat, x, y, z, sombra = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = sombra; m.receiveShadow = true;
      scene.add(m);
      return m;
    };

    // chão
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), piso);
    chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
    // juntas da calçada
    const juntas = new THREE.GridHelper(60, 50, '#a9a59c', '#a9a59c');
    juntas.position.y = 0.005; juntas.material.opacity = 0.35; juntas.material.transparent = true; scene.add(juntas);

    // volume da loja com o vão da porta (x -1.36..1.36, y 0..3.2)
    const VAO = 1.36, ALT = 3.2, PROF = 6;
    box(5 - VAO, 8, PROF, escuro, -(VAO + (5 - VAO) / 2), 4, -PROF / 2);
    box(5 - VAO, 8, PROF, escuro, VAO + (5 - VAO) / 2, 4, -PROF / 2);
    box(VAO * 2, 8 - ALT, PROF, escuro, 0, ALT + (8 - ALT) / 2, -PROF / 2);
    // pavimento superior envidraçado
    box(9.4, 2.2, 0.08, vidro, 0, 6.75, 0.05, false);
    box(9.6, 0.1, 0.3, metal, 0, 5.55, 0.1);

    // interior (acende na entrada)
    const interior = new THREE.Mesh(new THREE.BoxGeometry(VAO * 2, ALT, 5.5), internoMat);
    interior.position.set(0, ALT / 2, -2.75); scene.add(interior);
    const luzInterna = new THREE.PointLight('#ffd9a0', 0, 9, 1.6);
    luzInterna.position.set(0, 2.6, -1.2); scene.add(luzInterna);

    // letreiro
    box(6.2, 1.25, 0.35, escuro, -0.6, 4.75, 0.2);
    box(6.2, 0.12, 0.38, madeira, -0.6, 5.4, 0.2);
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 1240; texCanvas.height = 250;
    const tex = new THREE.CanvasTexture(texCanvas);
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.25 }));
    placa.position.set(-0.6, 4.75, 0.38); scene.add(placa);
    const logo = new Image();
    logo.src = 'assets/logo-ah.png';
    const desenharLetreiro = () => {
      const c = texCanvas.getContext('2d');
      c.fillStyle = '#1c1b1a'; c.fillRect(0, 0, 1240, 250);
      if (logo.complete && logo.naturalWidth) {
        const h = 170, w = (logo.naturalWidth / logo.naturalHeight) * h;
        c.drawImage(logo, 40, 40, w, h);
      }
      c.fillStyle = '#f2eee6';
      c.font = '400 118px Marcellus, Georgia, serif';
      c.textBaseline = 'alphabetic';
      c.fillText('ALPHAHOME', 340, 150);
      c.fillStyle = '#c39953';
      c.font = '600 34px Montserrat, Arial, sans-serif';
      if ('letterSpacing' in c) c.letterSpacing = '10px';
      c.fillText('AMBIENTES PLANEJADOS', 346, 205);
      tex.needsUpdate = true;
    };
    logo.onload = desenharLetreiro;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(desenharLetreiro);
    desenharLetreiro();

    // marquise
    box(5.4, 0.22, 1.8, branco, 0, 3.58, 0.85);
    box(5.4, 0.3, 0.06, branco, 0, 3.43, 1.73);

    // portal da porta
    box(0.18, 3.35, 0.3, metal, -VAO - 0.09, 1.67, 0.08);
    box(0.18, 3.35, 0.3, metal, VAO + 0.09, 1.67, 0.08);
    box(VAO * 2 + 0.36, 0.18, 0.3, metal, 0, 3.3, 0.08);
    // bandeira gradeada acima das folhas
    for (let x = -VAO + 0.1; x < VAO; x += 0.11) box(0.03, 0.42, 0.03, metal, x, 3.0, 0.06, false);
    box(VAO * 2, 0.05, 0.05, metal, 0, 2.78, 0.06, false);
    // porta de vidro por trás do portão
    const portaVidro = new THREE.Mesh(new THREE.PlaneGeometry(VAO * 2 - 0.1, 2.7), vidro);
    portaVidro.position.set(0, 1.4, -0.35); scene.add(portaVidro);

    // folhas do portão (abrem para fora)
    const folhaPortao = (lado) => {
      const g = new THREE.Group();
      g.position.set(lado * -VAO, 0, 0.1);
      const w = VAO - 0.02, s = lado; // lado -1 = esquerda
      const add = (bw, bh, x, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.04), metal);
        m.position.set(x, y, 0); m.castShadow = true; g.add(m);
      };
      const cx = (x) => -s * x; // cresce para dentro do vão
      add(0.06, 2.7, cx(0.03), 1.4); add(0.06, 2.7, cx(w - 0.03), 1.4);
      add(w, 0.06, cx(w / 2), 0.08); add(w, 0.06, cx(w / 2), 2.72); add(w, 0.05, cx(w / 2), 1.3);
      for (let x = 0.12; x < w - 0.05; x += 0.1) add(0.025, 2.62, cx(x), 1.4);
      scene.add(g);
      return g;
    };
    const folhaE = folhaPortao(-1), folhaD = folhaPortao(1);

    // coluna de ripas de madeira (esquerda) e painel escuro (direita)
    for (let x = -3.55; x <= -2.05; x += 0.15) box(0.08, 3.5, 0.12, madeira, x, 1.75, 0.08);
    box(1.2, 3.5, 0.08, M('#2a2b2d'), 2.75, 1.75, 0.04);
    box(0.22, 0.34, 0.1, metal, 2.35, 1.55, 0.13);

    // vasos com plantas
    const vaso = (x) => {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.22, 0.85, 28), terracota);
      v.position.set(x, 0.425, 0.95); v.castShadow = true; scene.add(v);
      for (let k = 0; k < 11; k++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.025, 1.1 + Math.random() * 0.5, 5), folha);
        const a = (k / 11) * Math.PI * 2, r = 0.05 + Math.random() * 0.08;
        f.position.set(x + Math.cos(a) * r, 1.35, 0.95 + Math.sin(a) * r);
        f.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
        f.castShadow = true; scene.add(f);
      }
    };
    vaso(-1.95); vaso(1.95);
    // tapete
    const tapete = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), M('#2b2723', { roughness: 1 }));
    tapete.rotation.x = -Math.PI / 2; tapete.position.set(0, 0.01, 0.7); tapete.receiveShadow = true; scene.add(tapete);

    // luzes
    scene.add(new THREE.HemisphereLight('#f6f2ea', '#8a8378', 0.75));
    const sol = new THREE.DirectionalLight('#fff4e3', 1.25);
    sol.position.set(7, 11, 9); sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 10, bottom: -3, near: 1, far: 40 });
    scene.add(sol);
    const spot = new THREE.SpotLight('#ffe2b5', 0.9, 7, 0.9, 0.6, 1.5);
    spot.position.set(0, 3.4, 0.9); spot.target.position.set(0, 0, 0.9); scene.add(spot); scene.add(spot.target);

    // câmera e interação
    const alvo = new THREE.Vector3(0, 2.6, 0);
    let yaw = 0, yawAlvo = 0, arrastando = false, x0 = 0, yaw0 = 0;
    const distancia = () => (camera.aspect < 0.8 ? 23 : 12.5);
    canvas.addEventListener('pointerdown', (e) => { arrastando = true; x0 = e.clientX; yaw0 = yawAlvo; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (arrastando) yawAlvo = clamp(yaw0 - (e.clientX - x0) * 0.004, -0.5, 0.5); });
    const soltar = () => { arrastando = false; };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);

    const redimensionar = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.8 ? 46 : 38;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', redimensionar);
    redimensionar();

    let entrada = null; // {inicio, camPos0, alvo0}
    let ativo = true;
    const t0 = performance.now();

    function quadro(agora) {
      if (!ativo) return;
      requestAnimationFrame(quadro);
      const t = (agora - t0) / 1000;
      if (!entrada) {
        yaw = lerp(yaw, yawAlvo + (arrastando || reduz ? 0 : Math.sin(t * 0.35) * 0.12), 0.06);
        const d = distancia();
        const retrato = camera.aspect < 0.8;
        alvo.y = retrato ? 1.4 : 2.6;
        camera.position.set(Math.sin(yaw) * d, (retrato ? 3.2 : 2.2) + Math.sin(t * 0.5) * 0.05, Math.cos(yaw) * d);
        camera.lookAt(alvo);
      } else {
        const u = (agora - entrada.inicio) / 1000;
        const dur = reduz ? 0.6 : 2.6;
        const k = easeInOut(clamp(u / (dur * 0.75), 0, 1));
        camera.position.lerpVectors(entrada.pos0, new THREE.Vector3(0, 1.55, 2.3), k);
        const olhar = new THREE.Vector3().lerpVectors(alvo, new THREE.Vector3(0, 1.45, -2), k);
        camera.lookAt(olhar);
        const abre = easeInOut(clamp((u - dur * 0.3) / (dur * 0.45), 0, 1));
        folhaE.rotation.y = -1.75 * abre;
        folhaD.rotation.y = 1.75 * abre;
        const luz = clamp((u - dur * 0.5) / (dur * 0.25), 0, 1);
        const pisca = luz > 0 && luz < 0.6 ? (Math.sin(u * 60) > 0 ? 1 : 0.3) : 1;
        luzInterna.intensity = 3.2 * luz * pisca;
        internoMat.emissiveIntensity = 1.1 * luz * pisca;
        if (u > dur && !entrada.fim) { entrada.fim = true; entrada.aoTerminar(); }
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(quadro);

    cena3d.ok = true;
    cena3d.entrar = (aoTerminar) => {
      entrada = { inicio: performance.now(), pos0: camera.position.clone(), aoTerminar };
    };
    cena3d.reiniciar = () => {
      entrada = null; yaw = yawAlvo = 0;
      folhaE.rotation.y = folhaD.rotation.y = 0;
      luzInterna.intensity = 0; internoMat.emissiveIntensity = 0;
      if (!ativo) { ativo = true; requestAnimationFrame(quadro); }
    };
    cena3d.pausar = () => { ativo = false; };
    return true;
  }

  // ------------------------------------------------------------------ passeio por rolagem
  const trilho = $('trilho');
  const cQuadro = $('quadro'), cFundo = $('fundo');
  const ctx = cQuadro.getContext('2d');
  const ctxF = cFundo.getContext('2d');
  const svg = $('linhas');
  const baloes = $('baloes');

  // cada projeto ganha mais rolagem, para o passeio "parar" nele
  const janelas = PROJETOS.map((p) => [p.pontos[0][0] - 0.15, p.pontos[p.pontos.length - 1][0] + 0.15]);
  const PASSO = 0.01;
  const acumulado = [0];
  for (let t = T0 + PASSO; t <= T1 + 1e-6; t += PASSO) {
    const dentro = janelas.some(([a, b]) => t >= a && t <= b);
    acumulado.push(acumulado[acumulado.length - 1] + (dentro ? 3.2 : 1));
  }
  const TOTAL = acumulado[acumulado.length - 1];
  const tempoDaFracao = (f) => {
    const alvo = clamp(f, 0, 1) * TOTAL;
    let lo = 0, hi = acumulado.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (acumulado[m] < alvo) lo = m + 1; else hi = m; }
    return T0 + lo * PASSO;
  };
  const fracaoDoTempo = (t) => acumulado[clamp(Math.round((t - T0) / PASSO), 0, acumulado.length - 1)] / TOTAL;

  // elementos dos balões
  const els = PROJETOS.map((p) => {
    const ponto = document.createElement('button');
    ponto.className = 'ponto'; ponto.type = 'button'; ponto.hidden = true;
    ponto.setAttribute('aria-label', `Projeto ${p.numero}: ${p.nome}`);
    const et = document.createElement('button');
    et.className = 'etiqueta'; et.type = 'button'; et.hidden = true;
    et.innerHTML = `<span class="num">Projeto ${String(p.numero).padStart(2, '0')}</span><span class="nome"></span><span class="frase"></span><span class="ver">Ver detalhes</span>`;
    et.querySelector('.nome').textContent = p.nome;
    et.querySelector('.frase').textContent = p.frase;
    const linha = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linha.setAttribute('fill', 'none');
    linha.setAttribute('stroke', '#e0bf85');
    linha.setAttribute('stroke-width', '1.5');
    linha.setAttribute('pathLength', '1');
    linha.style.strokeDasharray = '1';
    linha.style.strokeDashoffset = '1';
    linha.style.transition = 'stroke-dashoffset .5s ease';
    svg.appendChild(linha);
    baloes.appendChild(ponto); baloes.appendChild(et);
    const abrir = () => abrirPainel(p);
    ponto.addEventListener('click', abrir);
    et.addEventListener('click', abrir);
    return { p, ponto, et, linha, visivel: false };
  });

  // trilho de navegação
  const rail = $('rail');
  const botoesRail = PROJETOS.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = p.numero;
    b.setAttribute('aria-label', `Ir para o projeto ${p.numero}: ${p.nome}`);
    b.addEventListener('click', () => {
      const [a, z] = janelas[i];
      const f = fracaoDoTempo((a + z) / 2 + 0.05);
      const topo = trilho.offsetTop + f * (trilho.offsetHeight - innerHeight);
      window.scrollTo({ top: topo, behavior: reduz ? 'auto' : 'smooth' });
    });
    rail.appendChild(b);
    return b;
  });

  let W = 0, H = 0, dpr = 1, rect = { x: 0, y: 0, w: 1, h: 1 };
  function dimensionar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cQuadro.width = Math.round(W * dpr); cQuadro.height = Math.round(H * dpr);
    cFundo.width = Math.round(W / 4); cFundo.height = Math.round(H / 4);
    // celular em pé: preenche a tela; tela larga: vídeo inteiro com fundo desfocado
    const cobre = W / H <= 0.78;
    const s = cobre ? Math.max(W / 720, H / 1280) : Math.min(W / 720, H / 1280);
    rect = { w: 720 * s, h: 1280 * s };
    rect.x = (W - rect.w) / 2; rect.y = (H - rect.h) / 2;
    trilho.style.height = `${Math.round(H * (W < 700 ? 8 : 9.5))}px`;
    ultimoDesenho = -1;
  }

  let tAtual = T0, tAlvo = T0, ultimoDesenho = -1, luz = 1;
  function desenhar(t) {
    const i = clamp(Math.round((t - T0) * FPS), 0, N_QUADROS - 1);
    const img = quadroMaisProximo(i);
    if (!img) return;
    if (i === ultimoDesenho && img === quadros[i]) return;
    ultimoDesenho = img === quadros[i] ? i : -1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    const s = Math.max(cFundo.width / 720, cFundo.height / 1280);
    ctxF.drawImage(img, (cFundo.width - 720 * s) / 2, (cFundo.height - 1280 * s) / 2, 720 * s, 1280 * s);
  }

  function posicaoProjeto(p, t) {
    const pts = p.pontos;
    if (t <= pts[0][0]) return pts[0].slice(1);
    for (let k = 1; k < pts.length; k++) {
      if (t <= pts[k][0]) {
        const u = (t - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]);
        return [lerp(pts[k - 1][1], pts[k][1], u), lerp(pts[k - 1][2], pts[k][2], u)];
      }
    }
    return pts[pts.length - 1].slice(1);
  }

  function atualizarBaloes(t) {
    els.forEach((e, idx) => {
      const [a, z] = janelas[idx];
      const on = t >= a && t <= z && luz > 0.9;
      botoesRail[idx].classList.toggle('ativo', on);
      if (!on) {
        if (e.visivel) {
          e.visivel = false;
          e.et.classList.remove('visivel');
          e.linha.style.strokeDashoffset = '1';
          e.ponto.hidden = true;
          setTimeout(() => { if (!e.visivel) e.et.hidden = true; }, 350);
        }
        return;
      }
      const [px, py] = posicaoProjeto(e.p, t);
      const x = clamp(rect.x + px * rect.w, 24, W - 24);
      const y = clamp(rect.y + py * rect.h, 90, H - 90);
      e.ponto.style.left = `${x}px`; e.ponto.style.top = `${y}px`;
      const lw = e.et.offsetWidth || 240, lh = e.et.offsetHeight || 110;
      const direita = x < W / 2;
      const margemRail = 56;
      let lx = direita ? x + 46 : x - 46 - lw;
      lx = clamp(lx, 16, W - lw - margemRail);
      let ly = clamp(y - lh - 70, 70, H - lh - 110);
      e.et.style.left = `${lx}px`; e.et.style.top = `${ly}px`;
      const bx = direita ? lx : lx + lw, by = ly + lh;
      const cotovelo = direita ? bx - 18 : bx + 18;
      e.linha.setAttribute('d', `M${x},${y} L${cotovelo},${by} L${bx},${by}`);
      if (!e.visivel) {
        e.visivel = true;
        e.ponto.hidden = false; e.et.hidden = false;
        requestAnimationFrame(() => { e.et.classList.add('visivel'); e.linha.style.strokeDashoffset = '0'; });
      }
    });
  }

  function lerRolagem() {
    const total = trilho.offsetHeight - H;
    const f = total > 0 ? (window.scrollY - trilho.offsetTop) / total : 0;
    tAlvo = tempoDaFracao(f);
    $('dica').style.opacity = f > 0.02 ? '0' : '1';
  }

  let passeioAtivo = false;
  function laco() {
    if (!passeioAtivo) return;
    requestAnimationFrame(laco);
    tAtual = Math.abs(tAlvo - tAtual) < 0.004 ? tAlvo : lerp(tAtual, tAlvo, reduz ? 1 : 0.18);
    desenhar(tAtual);
    atualizarBaloes(tAtual);
  }

  function acenderLuzes() {
    const inicio = performance.now();
    const dur = reduz ? 200 : 1500;
    const passo = (agora) => {
      const u = clamp((agora - inicio) / dur, 0, 1);
      // escuro, duas piscadas e acende
      let v;
      if (u < 0.35) v = 0.12;
      else if (u < 0.42) v = 0.75;
      else if (u < 0.5) v = 0.2;
      else if (u < 0.56) v = 0.9;
      else if (u < 0.62) v = 0.35;
      else v = lerp(0.6, 1, (u - 0.62) / 0.38);
      luz = reduz ? 1 : v;
      cQuadro.style.filter = `brightness(${luz})`;
      cFundo.style.filter = `blur(28px) brightness(${0.45 * luz}) saturate(1.1)`;
      if (u < 1) requestAnimationFrame(passo);
      else { luz = 1; cQuadro.style.filter = 'none'; }
    };
    requestAnimationFrame(passo);
  }

  // ------------------------------------------------------------------ painel de detalhes
  const painel = $('painel'), veu = $('veu');
  function abrirPainel(p) {
    $('p-num').textContent = `Projeto ${String(p.numero).padStart(2, '0')}`;
    $('p-nome').textContent = p.nome;
    $('p-desc').textContent = p.descricao;
    const ul = $('p-det'); ul.textContent = '';
    (p.detalhes || []).forEach((d) => { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); });
    painel.classList.add('aberto'); veu.classList.add('aberto');
    $('p-fechar').focus({ preventScroll: true });
  }
  function fecharPainel() { painel.classList.remove('aberto'); veu.classList.remove('aberto'); }
  $('p-fechar').addEventListener('click', fecharPainel);
  veu.addEventListener('click', fecharPainel);
  $('p-orc').addEventListener('click', (e) => {
    e.preventDefault(); fecharPainel();
    $('final').scrollIntoView({ behavior: reduz ? 'auto' : 'smooth' });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharPainel(); });

  // ------------------------------------------------------------------ fluxo fachada → loja
  const fachada = $('fachada'), passeio = $('passeio'), cortina = $('cortina');

  function abrirLoja() {
    cortina.classList.add('fechada');
    setTimeout(() => {
      passeio.hidden = false;
      fachada.classList.add('saindo');
      if (cena3d.pausar) cena3d.pausar();
      dimensionar();
      window.scrollTo(0, 0);
      tAtual = tAlvo = T0;
      luz = 0.12;
      cQuadro.style.filter = 'brightness(0.12)';
      passeioAtivo = true; laco();
      setTimeout(() => { fachada.hidden = true; }, 700);
      cortina.classList.remove('fechada');
      setTimeout(acenderLuzes, 450);
    }, 650);
  }

  $('entrar').addEventListener('click', () => {
    $('entrar').disabled = true;
    if (cena3d.ok) cena3d.entrar(abrirLoja);
    else abrirLoja();
  });

  $('voltar').addEventListener('click', () => {
    cortina.classList.add('fechada');
    setTimeout(() => {
      passeioAtivo = false;
      passeio.hidden = true;
      fachada.hidden = false;
      fachada.classList.remove('saindo');
      window.scrollTo(0, 0);
      $('entrar').disabled = false;
      if (cena3d.reiniciar) cena3d.reiniciar();
      cortina.classList.remove('fechada');
    }, 650);
  });

  window.addEventListener('scroll', lerRolagem, { passive: true });
  window.addEventListener('resize', () => { if (passeioAtivo) { dimensionar(); lerRolagem(); } });

  // ------------------------------------------------------------------ início
  if (!montarFachada()) {
    $('fallback-img').hidden = false;
    $('cena3d').hidden = true;
  }
  carregarQuadros();
})();
