// Ajudantes dos testes: chamar funções como um usuário logado, anotar acertos e falhas.
const { Client } = require('pg');

module.exports = function harness() {
  const db = new Client({ user: process.env.PGUSER || 'postgres' });
  let passed = 0;
  const fails = [];
  async function call(uid, fn, args, role) {
    const names = Object.keys(args || {});
    await db.query('begin');
    try {
      await db.query(`set local role ${role || 'authenticated'}`);
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid || '', role: role || 'authenticated' })]);
      const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
      const vals = names.map((n) => (args[n] !== null && typeof args[n] === 'object' && !Array.isArray(args[n]) ? JSON.stringify(args[n]) : args[n]));
      const res = await db.query(sql, vals);
      await db.query('commit');
      return res.rows[0].r;
    } catch (e) { await db.query('rollback'); throw e; }
  }
  async function as(uid, sql, params) {
    await db.query('begin');
    try {
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      const r = await db.query(sql, params);
      await db.query('commit');
      return r;
    } catch (e) { await db.query('rollback'); throw e; }
  }
  const ok = (cond, label, extra) => { if (cond) { passed++; return; } fails.push(label + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
  async function must(label, p) { try { const r = await p; passed++; return r; } catch (e) { fails.push(label + ' → erro: ' + e.message); return null; } }
  async function refuse(label, p, re) {
    try { await p; fails.push(label + ' → deveria recusar'); } catch (e) {
      if (re && !re.test(e.message)) fails.push(label + ' → mensagem inesperada: ' + e.message); else passed++;
    }
  }
  const q1 = async (sql, params) => (await db.query(sql, params)).rows[0];
  const count = async (sql, params) => Number((await q1(sql, params)).n);
  const mk = async (email) => (await q1('insert into auth.users (email) values ($1) returning id', [email])).id;
  const onboard = (id, nick) => db.query("update profiles set onboarded = true, nick = $2, ff_nick = $2 || 'FF', ff_id = (100000000 + code)::text, ff_status = 'aprovado' where id = $1", [id, nick]);
  async function run(body) {
    await db.connect();
    try { await body(); } catch (e) { console.error(e); fails.push('erro inesperado: ' + e.message); }
    console.log(`\n${passed} verificações passaram, ${fails.length} falharam`);
    fails.forEach((f) => console.log('  ✗ ' + f));
    await db.end();
    process.exit(fails.length ? 1 : 0);
  }
  return { db, call, svc: (fn, args) => call(null, fn, args, 'service_role'), as, ok, must, refuse, q1, count, mk, onboard, run };
};
