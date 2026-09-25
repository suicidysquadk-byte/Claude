// Liga o e-mail próprio (SMTP) no Supabase e troca o modelo do e-mail de entrada para mostrar o CÓDIGO de 6 dígitos.
// Sem SMTP próprio o Supabase grátis não deixa mudar o modelo (e só entrega para a equipe do projeto).
//
// Gmail (mais rápido): ligue a verificação em duas etapas e crie uma senha de app em myaccount.google.com/apppasswords.
//   SMTP_USER=seu.email@gmail.com SMTP_PASS="abcd efgh ijkl mnop" node scripts/ligar-email.js
// Resend: SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=re_... SMTP_FROM=nao-responda@seudominio node scripts/ligar-email.js
// Também precisa de SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF (ficam em scripts/conexao.env).
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const user = process.env.SMTP_USER;
const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
if (!token || !ref || !user || !pass) {
  console.error('Defina SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SMTP_USER e SMTP_PASS.');
  process.exit(1);
}
const gmail = !process.env.SMTP_HOST || /gmail/.test(process.env.SMTP_HOST);
const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = String(process.env.SMTP_PORT || '465');
const from = process.env.SMTP_FROM || user;

// e-mail preto e dourado com o código em destaque e, embaixo, o botão de entrar (abre o app neste celular)
const email = (titulo) => '<div style="font-family:Arial,Helvetica,sans-serif;background:#0b0b0d;color:#f4f2ee;padding:32px 24px;border-radius:18px;max-width:480px;margin:0 auto">' +
  '<p style="margin:0;font:italic 700 26px Georgia,serif;color:#d4af5a">BattleHub</p>' +
  '<p style="margin:22px 0 6px;color:#c9c6bf;font-size:15px">' + titulo + '</p>' +
  '<p style="font-size:40px;letter-spacing:10px;font-weight:700;color:#d4af5a;margin:6px 0 16px">{{ .Token }}</p>' +
  '<p style="color:#8f8c86;margin:0 0 20px;font-size:14px">Digite o código no app. Ele vale por 1 hora e só funciona uma vez.</p>' +
  '<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#c9a24d;color:#17130b;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Ou toque aqui para entrar (neste celular)</a>' +
  '<p style="color:#5d5b57;font-size:12px;margin-top:24px">Se não foi você, ignore este e-mail.</p></div>';

const cfg = {
  smtp_host: host, smtp_port: port, smtp_user: user, smtp_pass: pass,
  smtp_admin_email: from, smtp_sender_name: 'BattleHub', smtp_max_frequency: 30,
  rate_limit_email_sent: gmail ? 60 : 200,
  mailer_otp_length: 6,
  mailer_otp_exp: 3600,
  mailer_subjects_magic_link: 'Seu código do BattleHub: {{ .Token }}',
  mailer_templates_magic_link_content: email('Seu código para entrar:'),
  mailer_subjects_confirmation: 'Seu código do BattleHub: {{ .Token }}',
  mailer_templates_confirmation_content: email('Seu código para criar a conta:')
};

(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cfg)
  });
  const t = await r.text();
  if (!r.ok) { console.error('Falhou (' + r.status + '): ' + t.slice(0, 400)); process.exit(1); }
  const d = JSON.parse(t);
  console.log('E-mail próprio ligado: ' + d.smtp_host + ' · remetente ' + d.smtp_admin_email + ' · até ' + d.rate_limit_email_sent + ' e-mails por hora.');
  console.log('O e-mail de entrada agora traz o código de 6 dígitos (vale 1 hora) e o botão de entrar.');
})().catch((e) => { console.error(e.message); process.exit(1); });
