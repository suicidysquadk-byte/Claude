// Servidor de teste que imita o Supabase (login por código, RPC no Postgres,
// fotos e funções) para rodar o app de ponta a ponta sem internet.
// Uso: PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh node supabase/tests/fake-supabase.js 8790
// Código de acesso de qualquer e-mail: 123456
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = Number(process.argv[2] || 8790);
const WWW = path.join(__dirname, '..', '..', 'www');
const FILES = path.join(require('os').tmpdir(), 'bh-fake-storage');
const SECRET = 'segredo-de-teste';
const pool = new Pool({ user: process.env.PGUSER || 'postgres', max: 8 });
fs.mkdirSync(FILES, { recursive: true });

const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify(payload));
  return h + '.' + p + '.' + crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url');
}
function verify(token) {
  const [h, p, s] = String(token || '').split('.');
  if (!s) return null;
  if (crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url') !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp * 1000 > Date.now() ? c : null;
}
const refresh = new Map();
async function sessionFor(email) {
  let u = (await pool.query('select id, email, created_at from auth.users where email = $1', [email])).rows[0];
  if (!u) u = (await pool.query('insert into auth.users (email) values ($1) returning id, email, created_at', [email])).rows[0];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: u.created_at };
  const rt = crypto.randomBytes(16).toString('hex');
  refresh.set(rt, email);
  return { access_token: sign({ sub: u.id, role: 'authenticated', email: u.email, aud: 'authenticated', exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: rt, user };
}
function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json', 'Cache-Control': 'no-store' });
  res.end(body == null ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const readBody = (req) => new Promise((resolve) => { const parts = []; req.on('data', (c) => parts.push(c)); req.on('end', () => resolve(Buffer.concat(parts))); });
function multipartFile(buf, ctype) {
  const m = /boundary=(.+)$/.exec(ctype || '');
  if (!m) return buf;
  const boundary = Buffer.from('--' + m[1]);
  let idx = 0; const parts = [];
  while ((idx = buf.indexOf(boundary, idx)) >= 0) { const next = buf.indexOf(boundary, idx + boundary.length); if (next < 0) break; parts.push(buf.slice(idx + boundary.length, next)); idx = next; }
  const filePart = parts.find((p) => /filename=|Content-Type: image/i.test(p.slice(0, 300).toString())) || parts[parts.length - 1];
  const start = filePart.indexOf('\r\n\r\n') + 4;
  return filePart.slice(start, filePart.length - 2);
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p === '/js/config.js') return send(res, 200, "window.BH_CONFIG = { supabaseUrl: location.origin, supabaseAnonKey: 'chave-anon-de-teste', appScheme: 'gg.battlehub.app' };", MIME['.js']);
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length).replace(/[^a-z0-9_]/g, '');
      const args = JSON.parse((await readBody(req)).toString() || '{}');
      const claims = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
      const role = claims ? 'authenticated' : 'anon';
      const names = Object.keys(args);
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query('set local role ' + role);
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims || { role: 'anon' })]);
        const sql = 'select public.' + fn + '(' + names.map((n, i) => n + ' => $' + (i + 1)).join(', ') + ') as r';
        const r = await client.query(sql, names.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n])));
        await client.query('commit');
        const v = r.rows[0].r;
        return v === null || v === undefined || v === '' ? send(res, 200, 'null') : send(res, 200, v);
      } catch (e) {
        await client.query('rollback').catch(() => {});
        return send(res, 400, { code: e.code, message: e.message, details: e.detail || null, hint: e.hint || null });
      } finally { client.release(); }
    }
    if (p === '/auth/v1/otp') { const b = JSON.parse((await readBody(req)).toString() || '{}'); console.log('[código] ' + b.email + ' → 123456'); return send(res, 200, {}); }
    if (p === '/auth/v1/verify') {
      const b = JSON.parse((await readBody(req)).toString() || '{}');
      if (String(b.token) !== '123456') return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      return send(res, 200, await sessionFor(String(b.email).toLowerCase()));
    }
    if (p === '/auth/v1/token') {
      const b = JSON.parse((await readBody(req)).toString() || '{}');
      const email = refresh.get(b.refresh_token);
      if (!email) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      return send(res, 200, await sessionFor(email));
    }
    if (p === '/auth/v1/user') {
      const c = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!c) return send(res, 401, { msg: 'invalid JWT' });
      return send(res, 200, { id: c.sub, aud: 'authenticated', role: 'authenticated', email: c.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} });
    }
    if (p === '/auth/v1/logout') return send(res, 204, null);
    if (p === '/auth/v1/settings') return send(res, 200, { external: { email: true, google: true }, disable_signup: false });
    if (p.startsWith('/functions/v1/')) { await readBody(req); return send(res, 501, { error: 'mp_nao_configurado' }); }
    if (p.startsWith('/storage/v1/object/sign/') && req.method === 'POST' && !p.slice('/storage/v1/object/sign/'.length).includes('/')) {
      // vários endereços de uma vez (createSignedUrls)
      const bucket = p.slice('/storage/v1/object/sign/'.length);
      const b = JSON.parse((await readBody(req)).toString() || '{}');
      return send(res, 200, (b.paths || []).map((x) => ({ path: x, signedURL: '/object/sign/' + bucket + '/' + x + '?token=teste', error: null })));
    }
    if (p.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
      await readBody(req);
      const key = p.slice('/storage/v1/object/sign/'.length);
      return send(res, 200, { signedURL: '/object/sign/' + key + '?token=teste' });
    }
    if (p.startsWith('/storage/v1/object/public/') || (p.startsWith('/storage/v1/object/sign/') && req.method === 'GET')) {
      const key = decodeURIComponent(p.replace(/^\/storage\/v1\/object\/(public|sign)\//, ''));
      const file = path.join(FILES, key.replace(/[^a-zA-Z0-9._/-]/g, '_'));
      if (!file.startsWith(FILES) || !fs.existsSync(file)) return send(res, 404, { message: 'not found' });
      const buf = fs.readFileSync(file), type = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' }[path.extname(file)] || 'image/jpeg';
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (range) { // vídeo: o navegador pede pedaços para poder avançar
        const a = range[1] ? Number(range[1]) : 0, b = range[2] ? Math.min(Number(range[2]), buf.length - 1) : buf.length - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + a + '-' + b + '/' + buf.length, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
        return res.end(buf.subarray(a, b + 1));
      }
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
      return res.end(buf);
    }
    if (p.startsWith('/storage/v1/object/') && (req.method === 'POST' || req.method === 'PUT')) {
      const c = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!c) return send(res, 403, { message: 'new row violates row-level security policy' });
      const key = decodeURIComponent(p.slice('/storage/v1/object/'.length));
      const [bucket, owner] = key.split('/');
      if (owner !== c.sub) return send(res, 403, { message: 'new row violates row-level security policy' });
      const file = path.join(FILES, key.replace(/[^a-zA-Z0-9._/-]/g, '_'));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, multipartFile(await readBody(req), req.headers['content-type']));
      return send(res, 200, { Key: key, Id: crypto.randomUUID(), bucket });
    }
    if (p.startsWith('/realtime/')) return send(res, 404, { message: 'sem tempo real no servidor de teste' });
    // arquivos do app
    const file = path.join(WWW, p === '/' ? 'index.html' : decodeURIComponent(p));
    if (!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'não encontrado', 'text/plain');
    return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    console.error(e);
    return send(res, 500, { message: e.message });
  }
}).listen(PORT, () => console.log('Supabase de teste em http://localhost:' + PORT));
