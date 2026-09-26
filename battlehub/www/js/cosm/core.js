/* Motor de cosméticos da Personalização.
   Cada item do banco aponta para um desenho (data.art) e uma paleta (data.pal). O desenho é uma função registrada aqui
   por tipo (avatar, pet, chaveiro...), que recebe a paleta e devolve SVG/HTML. Item novo = linha nova no banco; desenho
   novo = BH.cosm.register(tipo, chave, função) num dos arquivos js/cosm/*.js. Nada na tela precisa mudar. */
window.BH = window.BH || {};
(function () {
  /* ---------- paletas: a = principal, b = secundária, c = clara/brilho, d = escura, g = brilho (glow) ---------- */
  const PAL = {
    // cores
    preto: { name: 'Preto', a: '#2a2a31', b: '#4b4b57', c: '#a1a1aa', d: '#0b0b0e', g: '#6b7280' },
    branco: { name: 'Branco', a: '#f4f4f5', b: '#d4d4d8', c: '#ffffff', d: '#71717a', g: '#ffffff' },
    azul: { name: 'Azul', a: '#2563eb', b: '#60a5fa', c: '#dbeafe', d: '#0b2a6b', g: '#3b82f6' },
    vermelho: { name: 'Vermelho', a: '#dc2626', b: '#f87171', c: '#fee2e2', d: '#5c0d12', g: '#ef4444' },
    roxo: { name: 'Roxo', a: '#7c3aed', b: '#a78bfa', c: '#ede9fe', d: '#2e1065', g: '#8b5cf6' },
    rosa: { name: 'Rosa', a: '#ec4899', b: '#f9a8d4', c: '#fce7f3', d: '#6b0f3a', g: '#f472b6' },
    verde: { name: 'Verde', a: '#16a34a', b: '#4ade80', c: '#dcfce7', d: '#052e16', g: '#22c55e' },
    amarelo: { name: 'Amarelo', a: '#eab308', b: '#fde047', c: '#fef9c3', d: '#5a3c05', g: '#facc15' },
    laranja: { name: 'Laranja', a: '#ea580c', b: '#fb923c', c: '#ffedd5', d: '#5a1d05', g: '#f97316' },
    ciano: { name: 'Ciano', a: '#0891b2', b: '#22d3ee', c: '#cffafe', d: '#083344', g: '#06b6d4' },
    dourado: { name: 'Dourado', a: '#c9901e', b: '#f6d77a', c: '#fffbe6', d: '#5b3a06', g: '#f6c453' },
    prata: { name: 'Prata', a: '#9ca3af', b: '#d1d5db', c: '#f9fafb', d: '#374151', g: '#e5e7eb' },
    neon: { name: 'Neon', a: '#39ff14', b: '#00e5ff', c: '#eafff0', d: '#03140a', g: '#39ff14' },
    rgb: { name: 'RGB', a: '#ff2975', b: '#00e5ff', c: '#fffb96', d: '#140028', g: '#ff2975', rgb: true },
    gradiente: { name: 'Gradiente', a: '#f43f5e', b: '#8b5cf6', c: '#fde68a', d: '#1e1033', g: '#ec4899' },
    'preto-vermelho': { name: 'Preto + Vermelho', a: '#18181b', b: '#dc2626', c: '#fca5a5', d: '#050505', g: '#ef4444' },
    'preto-roxo': { name: 'Preto + Roxo', a: '#18181b', b: '#8b5cf6', c: '#ddd6fe', d: '#050505', g: '#a855f7' },
    'preto-azul': { name: 'Preto + Azul', a: '#18181b', b: '#3b82f6', c: '#bfdbfe', d: '#050505', g: '#3b82f6' },
    'branco-dourado': { name: 'Branco + Dourado', a: '#fafaf9', b: '#d4a537', c: '#fffbe6', d: '#78550f', g: '#f6d77a' },
    'azul-ciano': { name: 'Azul + Ciano', a: '#1d4ed8', b: '#22d3ee', c: '#e0f2fe', d: '#0b1b4d', g: '#38bdf8' },
    'vermelho-preto': { name: 'Vermelho + Preto', a: '#b91c1c', b: '#27272a', c: '#fecaca', d: '#0a0a0a', g: '#f87171' },
    // estilos
    futurista: { name: 'Futurista', a: '#0ea5e9', b: '#e0f2fe', c: '#ffffff', d: '#0b1220', g: '#38bdf8' },
    cyberpunk: { name: 'Cyberpunk', a: '#ff2a6d', b: '#05d9e8', c: '#f9f871', d: '#01012b', g: '#ff2a6d' },
    samurai: { name: 'Samurai', a: '#b91c1c', b: '#1c1917', c: '#fef3c7', d: '#0c0a09', g: '#dc2626' },
    ninja: { name: 'Ninja', a: '#1f2937', b: '#7f1d1d', c: '#d1d5db', d: '#030712', g: '#6b7280' },
    medieval: { name: 'Medieval', a: '#78716c', b: '#b45309', c: '#fef3c7', d: '#1c1917', g: '#d97706' },
    espacial: { name: 'Espacial', a: '#312e81', b: '#6366f1', c: '#e0e7ff', d: '#020617', g: '#818cf8' },
    dark: { name: 'Dark', a: '#111827', b: '#374151', c: '#9ca3af', d: '#000000', g: '#4b5563' },
    royal: { name: 'Royal', a: '#5b21b6', b: '#e5b64a', c: '#fffbe6', d: '#1e0b3a', g: '#f6c453' },
    demoniaco: { name: 'Demoníaco', a: '#7f1d1d', b: '#ef4444', c: '#fca5a5', d: '#1a0303', g: '#dc2626' },
    angelical: { name: 'Angelical', a: '#fef9c3', b: '#ffffff', c: '#fffbeb', d: '#a8a29e', g: '#fde68a' },
    galaxia: { name: 'Galáxia', a: '#4c1d95', b: '#db2777', c: '#e9d5ff', d: '#0a0520', g: '#a855f7' },
    fogo: { name: 'Fogo', a: '#ea580c', b: '#fbbf24', c: '#fff7ae', d: '#5c0d12', g: '#ff6a00' },
    gelo: { name: 'Gelo', a: '#38bdf8', b: '#e0f2fe', c: '#ffffff', d: '#0c4a6e', g: '#7dd3fc' },
    eletrico: { name: 'Eletricidade', a: '#7c3aed', b: '#facc15', c: '#fef9c3', d: '#1e0b3a', g: '#c084fc' },
    shadow: { name: 'Shadow', a: '#1e1b4b', b: '#6d28d9', c: '#c4b5fd', d: '#000000', g: '#7c3aed' },
    tech: { name: 'Tech', a: '#10b981', b: '#064e3b', c: '#d1fae5', d: '#021a13', g: '#34d399' },
    street: { name: 'Street', a: '#f97316', b: '#a3e635', c: '#fef08a', d: '#1c1917', g: '#fb923c' },
    militar: { name: 'Militar', a: '#4d5a2a', b: '#a3a86b', c: '#e7e5c4', d: '#1a1f0c', g: '#84cc16' },
    mistico: { name: 'Místico', a: '#0d9488', b: '#a855f7', c: '#ccfbf1', d: '#082f2c', g: '#2dd4bf' },
    fantasia: { name: 'Fantasia', a: '#db2777', b: '#22d3ee', c: '#fdf4ff', d: '#3b0a2a', g: '#f0abfc' },
    arcade: { name: 'Arcade', a: '#facc15', b: '#ef4444', c: '#ffffff', d: '#111827', g: '#22c55e' },
    // eventos
    halloween: { name: 'Halloween', a: '#f97316', b: '#7c3aed', c: '#fde68a', d: '#1c0a00', g: '#fb923c' },
    natal: { name: 'Natal', a: '#dc2626', b: '#16a34a', c: '#fef2f2', d: '#14532d', g: '#fbbf24' },
    namorados: { name: 'Namorados', a: '#e11d48', b: '#fda4af', c: '#fff1f2', d: '#4c0519', g: '#fb7185' },
    anonovo: { name: 'Ano-Novo', a: '#d4a537', b: '#f5f5f4', c: '#fffbeb', d: '#0c0a09', g: '#fde68a' },
    primavera: { name: 'Primavera', a: '#f472b6', b: '#86efac', c: '#fdf2f8', d: '#3f6212', g: '#f9a8d4' },
    verao: { name: 'Verão', a: '#06b6d4', b: '#fbbf24', c: '#ecfeff', d: '#0e4d64', g: '#fde047' },
    inverno: { name: 'Inverno', a: '#93c5fd', b: '#e2e8f0', c: '#ffffff', d: '#1e3a5f', g: '#bfdbfe' }
  };

  /* ---------- raridade ---------- */
  const RAR = {
    comum: { name: 'Comum', color: '#9ca3af', rank: 0 },
    incomum: { name: 'Incomum', color: '#4ade80', rank: 1 },
    raro: { name: 'Raro', color: '#60a5fa', rank: 2 },
    epico: { name: 'Épico', color: '#c084fc', rank: 3 },
    lendario: { name: 'Lendário', color: '#facc15', rank: 4 },
    mitico: { name: 'Mítico', color: '#f87171', rank: 5 },
    exclusivo: { name: 'Exclusivo', color: '#f0abfc', rank: 6 },
    limitado: { name: 'Limitado', color: '#22d3ee', rank: 5.5 }
  };

  /* ---------- ajudantes de desenho ---------- */
  let seq = 0;
  const uid = (p) => (p || 'cz') + (++seq) + '-';
  const R = (n) => Math.round(n * 100) / 100;
  const pol = (cx, cy, r, a) => [R(cx + r * Math.cos((a - 90) * Math.PI / 180)), R(cy + r * Math.sin((a - 90) * Math.PI / 180))];
  const around = (n, fn, off) => { let s = ''; for (let i = 0; i < n; i++) s += fn((360 / n) * i + (off || 0), i); return s; };
  function rng(seed) {
    let h = 2166136261;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const lin = (id, stops, x2, y2) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 1 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' + stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
  const rad = (id, stops) => '<radialGradient id="' + id + '">' + stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</radialGradient>';
  const svg = (vb, inner, cls, extra) => '<svg class="' + (cls || '') + '" viewBox="' + vb + '" aria-hidden="true" focusable="false"' + (extra || '') + '>' + inner + '</svg>';

  /* ---------- registro ---------- */
  const reg = {};
  function register(kind, art, fn) { (reg[kind] = reg[kind] || {})[art] = fn; }
  function has(kind, art) { return !!(reg[kind] && reg[kind][art]); }
  function pal(key) { return PAL[key] || PAL.dourado; }
  // paleta de um item: variação escolhida > paleta do item > padrão do desenho
  function palOf(data, v) { return pal((v && PAL[v] && v) || (data && data.pal) || 'dourado'); }
  // desenha um item; opts: { still (parado), seed, user }
  function draw(kind, data, v, opts) {
    const d = data || {};
    const fn = reg[kind] && reg[kind][d.art];
    if (!fn) return '';
    const P = palOf(d, v);
    try { return fn(Object.assign({ P, d, u: uid(), still: false, seed: d.art }, opts || {})); } catch (e) { return ''; }
  }

  BH.cosm = { PAL, RAR, pal, palOf, reg, register, has, draw, uid, R, pol, around, rng, lin, rad, svg };
})();
