// imita o endpoint /v1/projects/:ref/database/query usando o Postgres local
const http = require('http'); const { Client } = require('pg');
http.createServer(async (req, res) => {
  const parts = []; req.on('data', (c) => parts.push(c)); await new Promise((r) => req.on('end', r));
  if (req.headers.authorization !== 'Bearer teste') { res.writeHead(401); return res.end('{"message":"Unauthorized"}'); }
  const { query } = JSON.parse(Buffer.concat(parts).toString());
  const c = new Client({ user: 'postgres', database: 'bhapi' }); await c.connect();
  try { const r = await c.query(query); const last = Array.isArray(r) ? r[r.length - 1] : r; res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(last.rows || [])); }
  catch (e) { await c.query('rollback').catch(() => {}); res.writeHead(400); res.end(JSON.stringify({ message: e.message })); }
  finally { await c.end(); }
}).listen(8791, () => console.log('mock ok'));
