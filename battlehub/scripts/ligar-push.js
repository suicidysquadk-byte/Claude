// Liga a notificação no celular: instala o arquivo do Firebase no projeto Android e liga a opção no app.
// Uso: node scripts/ligar-push.js caminho/do/google-services.json
// O google-services.json não é segredo (o Google diz que pode ir junto com o app), então ele vai para o GitHub
// e o app gerado pelo GitHub Actions também sai com a notificação ligada.
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Uso: node scripts/ligar-push.js caminho/do/google-services.json');
  process.exit(1);
}
let cfg;
try { cfg = JSON.parse(fs.readFileSync(src, 'utf8')); } catch (e) { console.error('Esse arquivo não é um JSON válido.'); process.exit(1); }
const pkgs = (cfg.client || []).map((c) => c.client_info && c.client_info.android_client_info && c.client_info.android_client_info.package_name);
if (!cfg.project_info || !pkgs.includes('gg.battlehub.app')) {
  console.error('Esse google-services.json não é do app gg.battlehub.app (achei: ' + (pkgs.join(', ') || 'nenhum') + ').');
  console.error('No Firebase, adicione um app Android com o pacote gg.battlehub.app e baixe o arquivo de novo.');
  process.exit(1);
}
const root = path.join(__dirname, '..');
fs.copyFileSync(src, path.join(root, 'android', 'app', 'google-services.json'));

const conf = path.join(root, 'www', 'js', 'config.js');
let js = fs.readFileSync(conf, 'utf8');
if (/push:\s*(true|false)/.test(js)) js = js.replace(/push:\s*(true|false)/, 'push: true');
else js = js.replace(/\n};\s*$/, ",\n  push: true\n};\n");
fs.writeFileSync(conf, js);

console.log('Firebase do projeto ' + cfg.project_info.project_id + ' instalado e notificação ligada no app.');
console.log('Falta: guardar a conta de serviço no servidor (FCM_SERVICE_ACCOUNT_FILE no scripts/conexao.env e bash scripts/configurar.sh).');
