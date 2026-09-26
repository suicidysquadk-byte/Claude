// Testa a notificação no celular: tokens dos aparelhos e a fila de envio para a função push-enviar.
// O pg_net não existe no Postgres local, então o teste cria um net.http_post falso que só anota as chamadas.
// Uso: aplique tests/shim.sql + migrations num banco vazio (tests/reset.sh) e rode
//   PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh node supabase/tests/push.test.js
const { Client } = require('pg');

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
    const vals = names.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
    const res = await db.query(sql, vals);
    await db.query('commit');
    return res.rows[0].r;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
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

function ok(cond, label, extra) {
  if (cond) { passed++; return; }
  fails.push(label + (extra !== undefined ? ' → ' + JSON.stringify(extra) : ''));
}
async function must(label, p) {
  try { const r = await p; passed++; return r; } catch (e) { fails.push(label + ' → erro: ' + e.message); return null; }
}
async function refuse(label, p, re) {
  try { await p; fails.push(label + ' → deveria recusar'); } catch (e) {
    if (re && !re.test(e.message)) fails.push(label + ' → mensagem inesperada: ' + e.message); else passed++;
  }
}
const q1 = async (sql, params) => (await db.query(sql, params)).rows[0];
const count = async (sql, params) => Number((await q1(sql, params)).n);
const sent = () => db.query('select body, headers from net.fake_requests order by id').then((r) => r.rows);

(async () => {
  await db.connect();
  const mk = async (email) => (await q1('insert into auth.users (email) values ($1) returning id', [email])).id;
  const owner = await mk('dono@bh.gg');
  const A = await mk('a@bh.gg');
  const B = await mk('b@bh.gg');
  const C = await mk('c@bh.gg');

  // ---------------- tokens
  await must('jogador cadastra o aparelho', call(A, 'set_push_token', { p_token: 'tok-a1', p_platform: 'android' }));
  ok((await q1('select user_id from push_tokens where token = $1', ['tok-a1'])).user_id === A, 'token fica na conta de quem entrou');
  await must('cadastrar de novo não duplica', call(A, 'set_push_token', { p_token: 'tok-a1', p_platform: 'android' }));
  ok(await count("select count(*) n from push_tokens where token = 'tok-a1'") === 1, 'um token, uma linha');
  await refuse('token vazio', call(A, 'set_push_token', { p_token: '  ', p_platform: 'android' }), /inválido/);
  await refuse('plataforma estranha', call(A, 'set_push_token', { p_token: 'x', p_platform: 'ios' }), /inválida/);
  await refuse('sem login não cadastra', call(null, 'set_push_token', { p_token: 'tok-anon', p_platform: 'android' }, 'anon'), /permission denied|permissão/);

  await must('aparelho troca de conta', call(B, 'set_push_token', { p_token: 'tok-a1', p_platform: 'android' }));
  ok((await q1('select user_id from push_tokens where token = $1', ['tok-a1'])).user_id === B, 'token passa para a conta nova');
  await must('A volta a cadastrar o próprio aparelho', call(A, 'set_push_token', { p_token: 'tok-a2', p_platform: 'android' }));

  for (let i = 1; i <= 6; i++) await call(C, 'set_push_token', { p_token: 'tok-c' + i, p_platform: 'android' });
  ok(await count('select count(*) n from push_tokens where user_id = $1', [C]) === 5, 'no máximo 5 aparelhos por conta');
  ok(await count("select count(*) n from push_tokens where token = 'tok-c1'") === 0, 'o aparelho mais antigo sai');

  await refuse('app não lê tokens direto', as(A, 'select count(*) from push_tokens').then((r) => { if (Number(r.rows[0].count) > 0) throw new Error('leu'); throw new Error('bloqueado'); }), /bloqueado|permission denied/);
  await refuse('app não grava token direto', as(A, "insert into push_tokens (token, user_id) values ('x', $1)", [A]), /row-level security|permission denied/);
  await refuse('app não lê a configuração do envio', as(A, 'select * from app.push_config'), /permission denied/);

  await must('outra conta não apaga token alheio', call(A, 'clear_push_token', { p_token: 'tok-c2' }));
  ok(await count("select count(*) n from push_tokens where token = 'tok-c2'") === 1, 'token alheio continua');
  await must('dono do token apaga ao sair', call(C, 'clear_push_token', { p_token: 'tok-c2' }));
  ok(await count("select count(*) n from push_tokens where token = 'tok-c2'") === 0, 'token apagado');
  await must('sessão vencida (anon) ainda apaga o próprio token', call(null, 'clear_push_token', { p_token: 'tok-c3' }, 'anon'));
  ok(await count("select count(*) n from push_tokens where token = 'tok-c3'") === 0, 'token apagado sem login');

  // ---------------- fila de envio
  await db.query(`create schema if not exists net;
    create table if not exists net.fake_requests (id bigserial primary key, url text, body jsonb, headers jsonb);
    create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $$ insert into net.fake_requests (url, body, headers) values (url, body, headers) returning id $$;
    grant usage on schema net to authenticated, service_role;`);

  await db.query("select app.notify($1, 'aviso', 'Teste', 'sem configuração')", [A]);
  ok((await sent()).length === 0, 'sem configuração nada é enviado');

  await db.query("insert into app.push_config (url, secret) values ('https://exemplo.supabase.co/functions/v1/push-enviar', 'segredo-123')");

  await db.query("select app.notify($1, 'sala', 'Sala começou', 'ID 123 · senha 9', jsonb_build_object('room_id', gen_random_uuid()))", [A]);
  let r = await sent();
  ok(r.length === 1 && r[0].body.notifications && r[0].body.notifications.length === 1, 'aviso para quem tem aparelho gera uma chamada', r);
  ok(r[0] && r[0].headers['x-push-secret'] === 'segredo-123', 'chamada leva o segredo');
  const nid = r[0] && r[0].body.notifications[0];
  ok(nid && (await q1('select user_id from notifications where id = $1', [nid])).user_id === A, 'chamada leva o id do aviso certo');

  const noTok = await mk('semaparelho@bh.gg');
  await db.query('delete from net.fake_requests');
  await db.query("select app.notify($1, 'aviso', 'Oi', 'sem aparelho')", [noTok]);
  ok((await sent()).length === 0, 'quem não tem aparelho não gera chamada');

  await db.query('delete from net.fake_requests');
  await must('aviso geral', call(owner, 'admin_broadcast', { p_title: 'Temporada 2', p_body: 'Começou a temporada!', p_target: 'todos', p_pinned: false }));
  r = await sent();
  const total = await count("select count(*) n from notifications where title = 'Temporada 2'");
  ok(r.length === 1 && r[0].body.notifications.length === total && total >= 5, 'aviso para todos sai numa chamada só', { calls: r.length, total });

  await db.query('delete from net.fake_requests');
  await db.query("insert into notifications (user_id, kind, title) select $1, 'aviso', 'lote ' || g from generate_series(1, 1200) g", [A]);
  r = await sent();
  ok(r.length === 3 && r.map((x) => x.body.notifications.length).join(',') === '500,500,200', 'lotes de 500', r.map((x) => x.body.notifications.length));

  await db.query('delete from net.fake_requests');
  const th = await must('abre conversa', call(B, 'open_thread', { p_user: A }));
  await must('manda mensagem', call(B, 'send_message', { p_thread: th && th.thread_id, p_body: 'bora jogar?' }));
  r = await sent();
  ok(r.length === 1 && r[0].body.messages && r[0].body.messages.length === 1, 'mensagem gera uma chamada', r);

  await db.query('delete from net.fake_requests');
  const th2 = await must('conversa com quem não tem aparelho', call(A, 'open_thread', { p_user: noTok }));
  await must('manda mensagem sem aparelho', call(A, 'send_message', { p_thread: th2 && th2.thread_id, p_body: 'oi' }));
  ok((await sent()).length === 0, 'mensagem para quem não tem aparelho não gera chamada');

  await db.query('delete from net.fake_requests');
  await db.query('begin');
  await db.query("select app.notify($1, 'aviso', 'Desfeito', 'rollback')", [A]);
  await db.query('rollback');
  ok((await sent()).length === 0, 'transação desfeita não deixa chamada na fila');

  // a chamada nunca derruba quem avisou, mesmo com o envio quebrado
  await db.query("create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql as $$ begin raise exception 'rede fora'; end $$");
  await must('aviso continua funcionando com o envio quebrado', db.query("select app.notify($1, 'aviso', 'Mesmo assim', 'ok')", [A]));
  ok(await count("select count(*) n from notifications where title = 'Mesmo assim'") === 1, 'aviso gravado apesar do erro no envio');

  // conta excluída leva os tokens junto
  await db.query('delete from auth.users where id = $1', [C]);
  ok(await count('select count(*) n from push_tokens where user_id = $1', [C]) === 0, 'conta apagada apaga os tokens');

  console.log(`\n${passed} verificações passaram, ${fails.length} falharam`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  await db.end();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log(`${passed} ok antes do erro; falhas:`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(2); });
