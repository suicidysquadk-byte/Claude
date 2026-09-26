// Grava www/js/config.js com o endereço do seu Supabase e a chave pública (anon).
// Uso: node scripts/escrever-config.js https://SEU-PROJETO.supabase.co CHAVE_ANON
const fs = require('fs');
const path = require('path');
const [url, anon] = process.argv.slice(2);
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') || !anon) {
  console.error('Uso: node scripts/escrever-config.js https://SEU-PROJETO.supabase.co CHAVE_ANON');
  process.exit(1);
}
// notificação no celular só liga com o arquivo do Firebase no projeto Android (sem ele o app fecharia ao cadastrar)
const push = fs.existsSync(path.join(__dirname, '..', 'android', 'app', 'google-services.json'));
const out = `/* Configuração do servidor do BattleHub (gerado por scripts/escrever-config.js).
   A chave "anon" é pública: quem protege os dados são as regras do banco. */
window.BH_CONFIG = {
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(anon)},
  // endereço de retorno do login com Google no app Android (igual ao appId do capacitor.config.json)
  appScheme: 'gg.battlehub.app',
  // notificação no celular (Firebase): ligada quando existe android/app/google-services.json
  push: ${push}
};
`;
fs.writeFileSync(path.join(__dirname, '..', 'www', 'js', 'config.js'), out);
console.log('www/js/config.js atualizado para ' + url + (push ? ' (notificação no celular ligada)' : ''));
