// O Supabase recusa DELETE/UPDATE sem WHERE nas chamadas do app ("DELETE requires a WHERE clause").
// Confere todas as funções do banco: nenhum desses comandos pode ficar sem WHERE.
// Uso: tests/reset.sh e depois  node supabase/tests/sem-delete-livre.test.js
const H = require('./_util')();
const { db, ok } = H;
H.run(async () => {
  const { rows } = await db.query(`select n.nspname || '.' || p.proname as name, p.prosrc as src from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
    where n.nspname in ('public', 'app') and l.lanname in ('plpgsql', 'sql')`);
  const bad = [];
  for (const { name, src } of rows) {
    const clean = src.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
    const re = /\b(delete\s+from|update)\s+([a-z_.]+)\b([\s\S]*?);/gi;
    let m;
    while ((m = re.exec(clean))) {
      if (/^update$/i.test(m[1]) && !/^\s+set\b/i.test(m[3])) continue;
      if (!/\bwhere\b/i.test(m[3])) bad.push(name + ': ' + (m[1] + ' ' + m[2] + m[3]).replace(/\s+/g, ' ').slice(0, 80));
    }
  }
  ok(rows.length > 50, 'funções encontradas', rows.length);
  ok(bad.length === 0, 'nenhum DELETE/UPDATE sem WHERE', bad);
});
