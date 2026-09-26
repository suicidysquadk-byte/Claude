#!/usr/bin/env bash
# Conecta o BattleHub ao seu Supabase: cria as tabelas e regras, publica as funções do Pix,
# guarda as chaves do Mercado Pago, liga a notificação no celular, o login com Google e o código por e-mail e
# grava www/js/config.js. Pode rodar de novo sempre que mudar alguma chave.
#   1) cp scripts/conexao.exemplo.env scripts/conexao.env   e preencha
#   2) bash scripts/configurar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${1:-scripts/conexao.env}"
[ -f "$ENV_FILE" ] || { echo "Crie $ENV_FILE a partir de scripts/conexao.exemplo.env"; exit 1; }
set -a; . "$ENV_FILE"; set +a
: "${SUPABASE_ACCESS_TOKEN:?Preencha SUPABASE_ACCESS_TOKEN em $ENV_FILE}"
: "${SUPABASE_PROJECT_REF:?Preencha SUPABASE_PROJECT_REF em $ENV_FILE}"
export SUPABASE_ACCESS_TOKEN
REF="$SUPABASE_PROJECT_REF"
URL="https://$REF.supabase.co"
SB="npx -y supabase@2"
API="https://api.supabase.com/v1/projects/$REF"
auth() { curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" "$@"; }

echo "1/7 Conferindo o acesso ao projeto $REF"
auth "$API" > /dev/null || { echo "Não consegui acessar o projeto $REF com esse Access Token."; exit 1; }

echo "2/7 Criando tabelas, regras de dinheiro e fotos (migrações, pela API)"
SUPABASE_PROJECT_REF="$REF" node scripts/aplicar-migracoes.js

echo "3/7 Publicando as funções do Pix, do convite de testador e da notificação no celular"
$SB functions deploy pix-criar --project-ref "$REF" --use-api
$SB functions deploy pix-webhook --project-ref "$REF" --no-verify-jwt --use-api
$SB functions deploy convite --project-ref "$REF" --use-api
$SB functions deploy push-enviar --project-ref "$REF" --no-verify-jwt --use-api
$SB functions deploy asaas-saque --project-ref "$REF" --use-api
$SB functions deploy asaas-webhook --project-ref "$REF" --no-verify-jwt --use-api
$SB functions deploy asaas-validar --project-ref "$REF" --no-verify-jwt --use-api

echo "4/7 Guardando as chaves do Mercado Pago"
if [ -n "${MP_ACCESS_TOKEN:-}" ]; then
  $SB secrets set --project-ref "$REF" "MP_ACCESS_TOKEN=$MP_ACCESS_TOKEN" ${MP_WEBHOOK_SECRET:+"MP_WEBHOOK_SECRET=$MP_WEBHOOK_SECRET"}
  echo "   Cadastre no Mercado Pago (Webhooks, evento Pagamentos): $URL/functions/v1/pix-webhook"
else
  echo "   Sem MP_ACCESS_TOKEN: o Pix fica manual (a equipe confirma no painel)."
fi

echo "4b/7 Guardando as chaves do Asaas"
if [ -n "${ASAAS_API_KEY:-}" ]; then
  [ -n "${ASAAS_WEBHOOK_TOKEN:-}" ] || { echo "   Falta ASAAS_WEBHOOK_TOKEN (uma senha longa que você também cadastra no Asaas)."; exit 1; }
  $SB secrets set --project-ref "$REF" "ASAAS_API_KEY=$ASAAS_API_KEY" "ASAAS_ENV=${ASAAS_ENV:-sandbox}" "ASAAS_WEBHOOK_TOKEN=$ASAAS_WEBHOOK_TOKEN" > /dev/null
  echo "   Ambiente: ${ASAAS_ENV:-sandbox}. No Asaas cadastre:"
  echo "   - Webhook (cobranças e transferências): $URL/functions/v1/asaas-webhook"
  echo "   - Validação de saque (Mecanismo de segurança): $URL/functions/v1/asaas-validar"
  echo "   Nos dois, o token de autenticação é o mesmo ASAAS_WEBHOOK_TOKEN."
else
  echo "   Sem ASAAS_API_KEY: depósito e saque seguem pelo Mercado Pago e pela fila manual."
fi

echo "5/7 Ligando a notificação no celular (Firebase)"
if [ -n "${FCM_SERVICE_ACCOUNT_FILE:-}" ]; then
  [ -f "$FCM_SERVICE_ACCOUNT_FILE" ] || { echo "   Não achei $FCM_SERVICE_ACCOUNT_FILE"; exit 1; }
  FCM_JSON=$(node -e 'const a = require(require("path").resolve(process.argv[1])); if (!a.private_key || !a.client_email || !a.project_id) { console.error("   Esse arquivo não é a chave da conta de serviço do Firebase."); process.exit(1); } process.stdout.write(JSON.stringify(a));' "$FCM_SERVICE_ACCOUNT_FILE")
  PUSH_SECRET=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')
  $SB secrets set --project-ref "$REF" "PUSH_SECRET=$PUSH_SECRET" "FCM_SERVICE_ACCOUNT=$FCM_JSON" > /dev/null
  # o banco chama a função com o mesmo segredo (gatilhos da migração 14)
  python3 - "$URL" "$PUSH_SECRET" > /tmp/bh-push.json <<'PY'
import json, sys
url, secret = sys.argv[1], sys.argv[2]
q = ("insert into app.push_config (id, url, secret) values (1, '%s/functions/v1/push-enviar', '%s') "
     "on conflict (id) do update set url = excluded.url, secret = excluded.secret, updated_at = now();") % (url, secret)
print(json.dumps({'query': q}))
PY
  auth -X POST "$API/database/query" --data @/tmp/bh-push.json > /dev/null
  rm -f /tmp/bh-push.json
  echo "   Pronto. Se ainda não fez, ligue no app: node scripts/ligar-push.js caminho/google-services.json"
else
  echo "   Sem FCM_SERVICE_ACCOUNT_FILE: os avisos só aparecem com o app aberto."
fi

echo "6/7 Ligando login com Google e código por e-mail"
python3 - "$URL" > /tmp/bh-auth.json <<'PY'
import json, os, sys
url = sys.argv[1]
code = ('<div style="font-family:Arial,sans-serif;background:#070605;color:#f8f2e4;padding:28px;border-radius:16px">'
        '<h2 style="margin:0 0 8px">BattleHub</h2><p>Seu código de acesso:</p>'
        '<p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#f6c453;margin:12px 0">{{ .Token }}</p>'
        '<p style="color:#8d87a7">Vale por 24 horas. Se não foi você, ignore este e-mail.</p></div>')
cfg = {
  'site_url': url,
  'uri_allow_list': 'gg.battlehub.app://auth,' + url,
  # o link de entrada (e-mail ou convite pelo WhatsApp) vale 24 horas; depois do lançamento dá para baixar para 1 hora
  'mailer_otp_exp': 86400,
  'mailer_otp_length': 6,
  'mailer_subjects_magic_link': 'Seu código do BattleHub',
  'mailer_templates_magic_link_content': code,
  'mailer_subjects_confirmation': 'Seu código do BattleHub',
  'mailer_templates_confirmation_content': code,
}
if os.environ.get('GOOGLE_CLIENT_ID') and os.environ.get('GOOGLE_CLIENT_SECRET'):
  cfg.update({'external_google_enabled': True, 'external_google_client_id': os.environ['GOOGLE_CLIENT_ID'], 'external_google_secret': os.environ['GOOGLE_CLIENT_SECRET']})
print(json.dumps(cfg))
PY
if auth -X PATCH "$API/config/auth" --data @/tmp/bh-auth.json > /dev/null; then
  echo "   Pronto. No Google Cloud, a URL de redirecionamento autorizada é: $URL/auth/v1/callback"
else
  echo "   Não consegui mudar pela API. Faça no painel: Authentication → Providers (Google) e Email Templates (use {{ .Token }})."
fi
rm -f /tmp/bh-auth.json

echo "7/7 Gravando www/js/config.js e copiando para o Android"
ANON=$(auth "$API/api-keys" | python3 -c "import json,sys; print(next(k['api_key'] for k in json.load(sys.stdin) if k.get('name') == 'anon'))")
node scripts/escrever-config.js "$URL" "$ANON"
npx cap sync android

echo
echo "Tudo conectado. Agora gere o app: npm run apk (teste) ou npm run aab (Play Store)."
echo "A primeira conta que entrar no app vira a DONA (painel admin completo). Entre você primeiro."
