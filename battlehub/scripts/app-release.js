#!/usr/bin/env node
/* Publicação do app para quem já tem o BattleHub instalado (usado pelo GitHub Actions).
   node scripts/app-release.js chave     → pega (ou cria, na primeira vez) a chave de assinatura do Android guardada
                                           no Supabase (bucket privado "privado") e deixa pronta para o Gradle.
                                           A chave é sempre a mesma: é o que deixa instalar uma versão por cima da outra.
   node scripts/app-release.js carimbo   → grava www/js/build.js com o número desta versão.
   node scripts/app-release.js publicar  → envia o pacote das telas (zip), o APK e o versao.json para o bucket público "app".
                                           O app instalado lê o versao.json e se atualiza sozinho.
   Precisa de SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF. Nenhuma chave é impressa no log. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REF = process.env.SUPABASE_PROJECT_REF || 'tjaqjirsayclexzaycti';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const BASE = `https://${REF}.supabase.co`;
const BUILD = Number(process.env.BATTLEHUB_VERSION_CODE || process.env.GITHUB_RUN_NUMBER || 0);
const log = (...a) => console.log('•', ...a);
const die = (m) => { console.error('✗ ' + m); process.exit(1); };

function versionName() {
  const g = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
  return (g.match(/versionName\s+"([^"]+)"/) || [])[1] || '0';
}
function addEnv(name, value, secret) {
  if (secret) console.log('::add-mask::' + value);
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}

let serviceKey = null;
async function key() {
  if (serviceKey) return serviceKey;
  if (!TOKEN) die('Falta SUPABASE_ACCESS_TOKEN.');
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: 'Bearer ' + TOKEN } });
  if (!r.ok) die('Não consegui ler as chaves do projeto (HTTP ' + r.status + '). Confira o SUPABASE_ACCESS_TOKEN.');
  const list = await r.json();
  const k = list.find((x) => x.name === 'service_role') || list.find((x) => x.type === 'secret');
  if (!k || !k.api_key) die('O projeto não devolveu a chave de serviço.');
  serviceKey = k.api_key;
  console.log('::add-mask::' + serviceKey);
  return serviceKey;
}
async function storage(method, p, body, headers = {}) {
  const k = await key();
  return fetch(`${BASE}/storage/v1/${p}`, { method, body, headers: { Authorization: 'Bearer ' + k, apikey: k, ...headers } });
}
async function bucket(id, isPublic) {
  const r = await storage('POST', 'bucket', JSON.stringify({ id, name: id, public: isPublic }), { 'Content-Type': 'application/json' });
  if (r.ok) return log('bucket criado:', id);
  const t = await r.text();
  if (!/already exists|Duplicate|409/i.test(t + r.status)) die(`Não consegui criar o bucket ${id}: ${t}`);
  // garante que continua com a visibilidade certa
  await storage('PUT', 'bucket/' + id, JSON.stringify({ public: isPublic }), { 'Content-Type': 'application/json' });
}
async function upload(bucketId, p, data, type, cache = '31536000') {
  const r = await storage('POST', `object/${bucketId}/${p}`, data, { 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=' + cache });
  if (!r.ok) die(`Falha ao enviar ${bucketId}/${p}: HTTP ${r.status} ${await r.text()}`);
  log('enviado:', `${bucketId}/${p}`, `(${(data.length / 1048576).toFixed(1)} MB)`);
}
async function download(bucketId, p) {
  const r = await storage('GET', `object/${bucketId}/${p}`);
  if (r.status === 400 || r.status === 404) return null;
  if (!r.ok) die(`Falha ao baixar ${bucketId}/${p}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* ---------------- chave de assinatura ---------------- */
async function chave() {
  await bucket('privado', false);
  let jks = await download('privado', 'assinatura/battlehub.jks');
  let info = await download('privado', 'assinatura/assinatura.json');
  if (!jks || !info) {
    log('primeira vez: criando a chave de assinatura do app');
    const pass = crypto.randomBytes(24).toString('base64url');
    const tmp = path.join(process.env.RUNNER_TEMP || require('os').tmpdir(), 'battlehub-novo.jks');
    fs.rmSync(tmp, { force: true });
    execFileSync('keytool', ['-genkeypair', '-keystore', tmp, '-storetype', 'PKCS12', '-alias', 'battlehub', '-keyalg', 'RSA', '-keysize', '2048',
      '-validity', '10000', '-storepass', pass, '-keypass', pass, '-dname', 'CN=BattleHub, O=BattleHub, C=BR'], { stdio: 'ignore' });
    jks = fs.readFileSync(tmp); fs.rmSync(tmp, { force: true });
    info = Buffer.from(JSON.stringify({ password: pass, alias: 'battlehub', criada: new Date().toISOString() }));
    await upload('privado', 'assinatura/battlehub.jks', jks, 'application/octet-stream', '0');
    await upload('privado', 'assinatura/assinatura.json', info, 'application/json', '0');
  }
  const j = JSON.parse(info.toString());
  const out = path.join(ROOT, 'android/upload.jks');
  fs.writeFileSync(out, jks, { mode: 0o600 });
  addEnv('BATTLEHUB_KEYSTORE', 'upload.jks');
  addEnv('BATTLEHUB_KEYSTORE_PASSWORD', j.password, true);
  addEnv('BATTLEHUB_KEY_PASSWORD', j.password, true);
  addEnv('BATTLEHUB_KEY_ALIAS', j.alias || 'battlehub');
  log('chave de assinatura pronta (sempre a mesma)');
}

/* ---------------- carimbo ---------------- */
function carimbo() {
  const v = versionName();
  fs.writeFileSync(path.join(ROOT, 'www/js/build.js'),
    `/* Número desta versão (gravado pelo GitHub Actions): o atualizador compara com o versao.json publicado. */\n` +
    `window.BH = window.BH || {};\nBH.BUILD = { code: ${BUILD}, version: '${v}' };\n`);
  log(`versão ${v} (${BUILD})`);
}

/* ---------------- publicar ---------------- */
// o que exige APK novo: plugins nativos, projeto Android e configuração do Capacitor
function nativeHash() {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const deps = Object.entries(lock.packages || {}).filter(([k]) => /node_modules\/@(capacitor|capgo|capacitor-community)\//.test(k))
    .map(([k, v]) => k + '@' + v.version).sort().join('\n');
  const h = crypto.createHash('sha256').update(deps).update(fs.readFileSync(path.join(ROOT, 'capacitor.config.json')));
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name), rel = path.relative(ROOT, p);
      if (/(^|\/)(build|\.gradle|\.idea|assets|capacitor-cordova-android-plugins)(\/|$)|upload\.jks|local\.properties|capacitor\.(config|plugins)\.json|capacitor\.settings\.gradle|capacitor\.build\.gradle/.test(rel)) continue;
      if (e.isDirectory()) { walk(p); continue; }
      let data = fs.readFileSync(p);
      // o número/nome da versão muda a cada lançamento e não conta
      if (e.name === 'build.gradle') data = Buffer.from(data.toString().replace(/^\s*version(Code|Name)\b.*$/gm, ''));
      h.update(rel).update(data);
    }
  };
  walk(path.join(ROOT, 'android'));
  return h.digest('hex');
}

async function publicar() {
  if (!BUILD) die('Falta o número da versão (BATTLEHUB_VERSION_CODE).');
  await bucket('app', true);
  const pub = (p) => `${BASE}/storage/v1/object/public/app/${p}`;
  const zip = path.join(process.env.RUNNER_TEMP || require('os').tmpdir(), `bundle-${BUILD}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: path.join(ROOT, 'www') });
  const zbuf = fs.readFileSync(zip);
  await upload('app', `bundles/${BUILD}.zip`, zbuf, 'application/zip');

  const apkDir = path.join(ROOT, 'android/app/build/outputs/apk/release');
  const apkName = fs.existsSync(apkDir) && fs.readdirSync(apkDir).find((f) => f.endsWith('.apk'));
  if (!apkName) die('APK assinado não encontrado em ' + apkDir);
  const apk = fs.readFileSync(path.join(apkDir, apkName));
  await upload('app', `apk/BattleHub-${BUILD}.apk`, apk, 'application/vnd.android.package-archive');
  await upload('app', 'BattleHub.apk', apk, 'application/vnd.android.package-archive', '60');

  let prev = null;
  try { const r = await fetch(pub('versao.json') + '?t=' + Date.now()); if (r.ok) prev = await r.json(); } catch (e) { /* primeira vez */ }
  const nh = nativeHash();
  const min = prev && prev.native_hash === nh && prev.min_code ? prev.min_code : BUILD;
  const v = {
    build: BUILD, version: versionName(), date: new Date().toISOString(),
    bundle_url: pub(`bundles/${BUILD}.zip`), sha256: sha256(zbuf),
    apk_url: pub('BattleHub.apk'), apk_sha256: sha256(apk), min_code: min, native_hash: nh,
  };
  await upload('app', 'versao.json', Buffer.from(JSON.stringify(v, null, 2)), 'application/json', '30');
  log(`publicado: versão ${v.version} (${BUILD}); ` + (min === BUILD ? 'parte nativa nova: quem tem APK antigo recebe o aviso para baixar o novo' : `atualização automática para quem tem a partir da ${min}`));
  log('APK: ' + v.apk_url);
}

const cmd = process.argv[2];
Promise.resolve().then({ chave, carimbo, publicar }[cmd] || (() => die('Use: chave | carimbo | publicar')))
  .catch((e) => die(e.stack || String(e)));
