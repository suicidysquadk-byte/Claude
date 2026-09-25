// Aplica as migrações da pasta supabase/migrations no seu projeto pela API do Supabase
// (só precisa do Access Token; não usa a senha nem a porta do banco).
// Cada arquivo roda numa transação e fica registrado, então dá para rodar de novo sem repetir nada.
// Uso: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/aplicar-migracoes.js
const fs = require('fs');
const path = require('path');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('Defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF.');
  process.exit(1);
}
const dir = path.join(__dirname, '..', 'supabase', 'migrations');
const base = process.env.SUPABASE_API_URL || 'https://api.supabase.com';

async function sql(query) {
  const r = await fetch(`${base}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : [];
}
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

(async () => {
  await sql(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
  const done = new Set((await sql('select version from supabase_migrations.schema_migrations')).map((r) => r.version));
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const f of files) {
    const [version, ...rest] = f.replace(/\.sql$/, '').split('_');
    if (done.has(version)) { console.log('   já aplicada: ' + f); continue; }
    const body = fs.readFileSync(path.join(dir, f), 'utf8');
    process.stdout.write('   aplicando ' + f + ' ... ');
    await sql('begin;\n' + body + '\n;insert into supabase_migrations.schema_migrations (version, name) values (' + lit(version) + ', ' + lit(rest.join('_')) + ');\ncommit;');
    console.log('ok');
  }
  console.log('   Migrações em dia.');
})().catch((e) => { console.error('\nFalhou: ' + e.message); process.exit(1); });
