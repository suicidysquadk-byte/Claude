#!/usr/bin/env node
/* Confere o catálogo contra os desenhos: cada item de supabase/migrations/*catalogo_personalizacao.sql, em cada cor,
   precisa gerar SVG válido (sem NaN/undefined, tags equilibradas), e a migração precisa estar em dia com o gerador. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const MIG = path.join(ROOT, 'supabase/migrations/20260926000022_catalogo_personalizacao.sql');
global.window = global; global.BH = {}; global.document = { documentElement: { classList: { contains: () => false } } };
for (const f of ['core', 'pets', 'chaveiros', 'chapeus', 'armas', 'avatares', 'efeitos', 'cenas', 'cenarios', 'molduras']) require(path.join(ROOT, 'www/js/cosm', f + '.js'));
const C = BH.cosm;
let fails = 0, checks = 0;
const bad = (m) => { fails++; console.log('  ✗ ' + m); };

const before = fs.readFileSync(MIG, 'utf8');
execFileSync(process.execPath, [path.join(__dirname, 'gerar.js')], { stdio: 'ignore' });
if (fs.readFileSync(MIG, 'utf8') !== before) bad('a migração do catálogo estava desatualizada (rode node scripts/cosmeticos/gerar.js)'); else checks++;

const rows = [...before.matchAll(/\('([^']+)', '([a-z]+)', '(?:[^']|'')*', '(?:[^']|'')*', (?:null|\d+), '((?:[^']|'')*)'::jsonb/g)];
if (rows.length < 400) bad('poucos itens lidos da migração: ' + rows.length);
for (const [, id, kind, json] of rows) {
  const d = JSON.parse(json.replace(/''/g, "'"));
  if (kind === 'bundle' || !d.art) continue;
  for (const v of [null].concat(d.variants || [])) {
    const s = C.draw(kind, d, v, { user: { nick: 'Teste' }, seed: id });
    checks++;
    if (!s && !(kind === 'entrada' && (d.art === 'surgir' || d.art === 'zoom'))) { bad(id + ' (' + v + '): desenho vazio'); continue; }
    if (/NaN|undefined|\[object/.test(s)) bad(id + ' (' + v + '): valor inválido no SVG');
    const open = (s.match(/<svg\b/g) || []).length, close = (s.match(/<\/svg>/g) || []).length;
    if (open !== close) bad(id + ': <svg> desequilibrado');
  }
}
console.log(checks + ' verificações dos desenhos, ' + fails + ' falharam');
process.exit(fails ? 1 : 0);
