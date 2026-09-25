#!/usr/bin/env bash
# Conecta o BattleHub ao seu Supabase: cria as tabelas e regras, publica as funções do Pix,
# guarda as chaves do Mercado Pago, liga o login com Google e o código por e-mail e grava
# www/js/config.js. Pode rodar de novo sempre que mudar alguma chave.
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

echo "1/6 Conferindo o acesso ao projeto $REF"
auth "$API" > /dev/null || { echo "Não consegui acessar o projeto $REF com esse Access Token."; exit 1; }

echo "2/6 Criando tabelas, regras de dinheiro e fotos (migrações, pela API)"
SUPABASE_PROJECT_REF="$REF" node scripts/aplicar-migracoes.js

echo "3/6 Publicando as funções do Pix"
$SB functions deploy pix-criar --project-ref "$REF" --use-api
$SB functions deploy pix-webhook --project-ref "$REF" --no-verify-jwt --use-api

echo "4/6 Guardando as chaves do Mercado Pago"
if [ -n "${MP_ACCESS_TOKEN:-}" ]; then
  $SB secrets set --project-ref "$REF" "MP_ACCESS_TOKEN=$MP_ACCESS_TOKEN" ${MP_WEBHOOK_SECRET:+"MP_WEBHOOK_SECRET=$MP_WEBHOOK_SECRET"}
  echo "   Cadastre no Mercado Pago (Webhooks, evento Pagamentos): $URL/functions/v1/pix-webhook"
else
  echo "   Sem MP_ACCESS_TOKEN: o Pix fica manual (a equipe confirma no painel)."
fi

echo "5/6 Ligando login com Google e código por e-mail"
python3 - "$URL" > /tmp/bh-auth.json <<'PY'
import json, os, sys
url = sys.argv[1]
code = ('<div style="font-family:Arial,sans-serif;background:#0a0910;color:#f2effa;padding:28px;border-radius:16px">'
        '<h2 style="margin:0 0 8px">BattleHub</h2><p>Seu código de acesso:</p>'
        '<p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#f6b83c;margin:12px 0">{{ .Token }}</p>'
        '<p style="color:#8d87a7">Vale por 10 minutos. Se não foi você, ignore este e-mail.</p></div>')
cfg = {
  'site_url': url,
  'uri_allow_list': 'gg.battlehub.app://auth,' + url,
  'mailer_otp_exp': 600,
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

echo "6/6 Gravando www/js/config.js e copiando para o Android"
ANON=$(auth "$API/api-keys" | python3 -c "import json,sys; print(next(k['api_key'] for k in json.load(sys.stdin) if k.get('name') == 'anon'))")
node scripts/escrever-config.js "$URL" "$ANON"
npx cap sync android

echo
echo "Tudo conectado. Agora gere o app: npm run apk (teste) ou npm run aab (Play Store)."
echo "A primeira conta que entrar no app vira a DONA (painel admin completo). Entre você primeiro."
