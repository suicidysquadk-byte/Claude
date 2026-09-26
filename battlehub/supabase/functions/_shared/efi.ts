// Integração com o Efí Bank (API Pix): depósito por cobrança imediata, saque por envio de Pix e avisos (webhook).
// A API do Efí exige certificado (mTLS) e token OAuth. A lógica fica aqui para ser testada com um Efí falso
// (supabase/tests/efi.test.js). deps.rpc chama as funções svc_* do banco com a chave de serviço.

export type Deps = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<any>;
  env: (name: string) => string | undefined;
  fetch?: typeof fetch;
};

export class EfiError extends Error {
  status: number;
  constructor(msg: string, status = 502) { super(msg); this.status = status; }
}

export function efiBase(d: Deps) {
  return d.env('EFI_API_URL') || (d.env('EFI_ENV') === 'producao' ? 'https://pix.api.efipay.com.br' : 'https://pix-h.api.efipay.com.br');
}
export const efiReady = (d: Deps) => !!(d.env('EFI_CLIENT_ID') && d.env('EFI_CLIENT_SECRET') && d.env('EFI_PIX_KEY'));

// cliente HTTP com o certificado do Efí (Deno); nos testes deps.fetch substitui tudo
let mtls: unknown = null;
function client(d: Deps) {
  if (mtls || d.fetch) return mtls;
  // guardados em base64 (secrets de uma linha); aceita também o PEM direto
  const pem = (v?: string) => (v && !v.startsWith('-----') ? atob(v) : v);
  const cert = pem(d.env('EFI_CERT')), key = pem(d.env('EFI_KEY'));
  if (!cert || !key) throw new EfiError('Certificado do Efí não configurado.', 501);
  // deno-lint-ignore no-explicit-any
  const D = (globalThis as any).Deno;
  mtls = D.createHttpClient({ cert, key, certChain: cert, privateKey: key });
  return mtls;
}

let token: { value: string; until: number } | null = null;
async function raw(d: Deps, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const f = d.fetch || fetch;
  // deno-lint-ignore no-explicit-any
  const opts: any = { method: init.method || 'GET', headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, body: init.body ? JSON.stringify(init.body) : undefined };
  const c = client(d);
  if (c) opts.client = c;
  const r = await f(efiBase(d) + path, opts);
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { r, data };
}
async function auth(d: Deps) {
  if (token && token.until > Date.now() + 30e3) return token.value;
  const id = d.env('EFI_CLIENT_ID'), secret = d.env('EFI_CLIENT_SECRET');
  if (!id || !secret) throw new EfiError('efi_nao_configurado', 501);
  const { r, data } = await raw(d, '/oauth/token', { method: 'POST', body: { grant_type: 'client_credentials' }, headers: { Authorization: 'Basic ' + btoa(id + ':' + secret) } });
  if (!r.ok || !data?.access_token) throw new EfiError('O Efí recusou as credenciais (Client ID, Client Secret ou certificado).', 502);
  token = { value: data.access_token, until: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return token.value;
}
export function resetEfiCache() { token = null; mtls = null; }

export async function efi(d: Deps, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const t = await auth(d);
  const { r, data } = await raw(d, path, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + t } });
  if (!r.ok) {
    const msg = data?.mensagem || data?.detail || data?.title || data?.error_description || `HTTP ${r.status}`;
    throw new EfiError('O Efí recusou: ' + msg, r.status >= 500 ? 502 : 400);
  }
  return data;
}

const onlyDigits = (s: string) => String(s || '').replace(/\D/g, '');
const money = (cents: number) => (cents / 100).toFixed(2);
// txid do Efí: 26 a 35 letras/números; idEnvio: até 35
export const txidOf = (seed: string) => (seed.replace(/[^a-zA-Z0-9]/g, '') + 'bh0000000000000000000000000').slice(0, 32);

/* ---------------- depósito ---------------- */
export async function createDeposit(d: Deps, userId: string, cents: number, cpfInput?: string) {
  const payer = await d.rpc('svc_payer', { p_user: userId });
  if (payer.banned) throw new EfiError('Conta suspensa.', 403);
  let cpf = payer.cpf as string | null;
  if (!cpf) {
    if (!cpfInput) throw new EfiError('cpf_necessario', 400);
    await d.rpc('svc_set_payer', { p_user: userId, p_cpf: cpfInput });
    cpf = onlyDigits(cpfInput);
  }
  const txid = txidOf(crypto.randomUUID() + crypto.randomUUID());
  const expiracao = 3600;
  const cob = await efi(d, `/v2/cob/${txid}`, { method: 'PUT', body: {
    calendario: { expiracao }, devedor: { cpf, nome: String(payer.nick || 'Jogador').slice(0, 200) },
    valor: { original: money(cents) }, chave: d.env('EFI_PIX_KEY'), solicitacaoPagador: 'Saldo BattleHub',
  } });
  let copia = cob.pixCopiaECola as string | undefined, img: string | null = null;
  if (cob.loc?.id) {
    const qr = await efi(d, `/v2/loc/${cob.loc.id}/qrcode`);
    copia = copia || qr.qrcode;
    img = qr.imagemQrcode ? String(qr.imagemQrcode).replace(/^data:image\/png;base64,/, '') : null;
  }
  if (!copia) throw new EfiError('O Efí não devolveu o Pix copia e cola.');
  return d.rpc('svc_create_deposit', { p_user: userId, p_cents: cents, p_provider_id: txid, p_qr: copia, p_qr64: img,
    p_expires: new Date(Date.now() + expiracao * 1000).toISOString(), p_provider: 'efi' });
}

// consulta a cobrança no Efí e acerta o depósito (nunca confia só no aviso)
export async function settleCharge(d: Deps, txid: string) {
  const c = await efi(d, `/v2/cob/${encodeURIComponent(txid)}`);
  const paid = (c.pix || []).reduce((s: number, p: any) => s + Math.round(Number(p.valor) * 100), 0);
  const state = c.status === 'CONCLUIDA' ? 'pago' : /REMOVIDA/.test(String(c.status)) ? 'expirado' : 'pendente';
  if (state === 'pendente') return { ok: true, status: 'pendente' };
  return d.rpc('svc_settle_deposit_gw', { p_provider: 'efi', p_provider_id: String(c.txid || txid), p_state: state, p_amount_cents: state === 'pago' ? paid : null });
}

/* ---------------- saque ---------------- */
const KEY_OK: Record<string, (k: string) => string> = {
  CPF: (k) => onlyDigits(k), 'E-mail': (k) => k.trim().toLowerCase(), Telefone: (k) => { const n = onlyDigits(k); return '+55' + (n.length >= 12 && n.startsWith('55') ? n.slice(2) : n); }, 'Aleatória': (k) => k.trim(),
};
export async function sendWithdrawal(d: Deps, id: string, userId?: string | null) {
  const c = await d.rpc('svc_withdrawal_claim', { p_id: id, p_user: userId || null });
  if (!c.ok) return { ok: false, reason: c.reason, status: c.status };
  const idEnvio = txidOf(c.id);
  try {
    const norm = KEY_OK[c.pix_key_type];
    if (!norm) throw new EfiError('Tipo de chave Pix inválido.', 400);
    const favorecido: Record<string, string> = { chave: norm(c.pix_key) };
    if (c.cpf) favorecido.cpf = c.cpf; // o Efí recusa se a chave não for desse CPF
    const t = await efi(d, `/v3/gn/pix/${idEnvio}`, { method: 'PUT', body: {
      valor: money(c.amount_cents), pagador: { chave: d.env('EFI_PIX_KEY'), infoPagador: 'Saque BattleHub' }, favorecido,
    } });
    await d.rpc('svc_withdrawal_sent', { p_id: c.id, p_provider_id: idEnvio, p_provider: 'efi' });
    if (t.status === 'REALIZADO') await d.rpc('svc_withdrawal_settle', { p_provider_id: idEnvio, p_status: 'DONE', p_ref: c.id });
    if (t.status === 'NAO_REALIZADO') await d.rpc('svc_withdrawal_settle', { p_provider_id: idEnvio, p_status: 'FAILED', p_ref: c.id, p_reason: 'Pix não realizado pelo Efí' });
    return { ok: true, provider_id: idEnvio, status: t.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await d.rpc('svc_withdrawal_settle', { p_provider_id: '', p_status: 'ERROR', p_ref: c.id, p_reason: msg });
    return { ok: false, reason: 'erro', message: msg };
  }
}

// consulta um envio e acerta o saque
export async function settleSend(d: Deps, idEnvio: string) {
  const t = await efi(d, `/v2/gn/pix/enviados/id-envio/${encodeURIComponent(idEnvio)}`);
  if (t.status === 'REALIZADO') return d.rpc('svc_withdrawal_settle', { p_provider_id: idEnvio, p_status: 'DONE' });
  if (t.status === 'NAO_REALIZADO') return d.rpc('svc_withdrawal_settle', { p_provider_id: idEnvio, p_status: 'FAILED', p_reason: 'Pix não realizado pelo Efí' });
  return { ok: true, status: t.status };
}

/* ---------------- avisos do Efí ---------------- */
// O Efí manda { pix: [...] } para o endereço cadastrado. Cada item é conferido na API.
export async function handleWebhook(d: Deps, body: any) {
  const out: unknown[] = [];
  for (const p of (body?.pix || [])) {
    const idEnvio = p?.gnExtras?.idEnvio || p?.idEnvio;
    if (idEnvio) out.push(await settleSend(d, String(idEnvio)));
    else if (p?.txid) out.push(await settleCharge(d, String(p.txid)));
  }
  // de carona: confere os envios que ainda esperam o banco
  const pend = await d.rpc('svc_withdrawals_in_flight', { p_provider: 'efi' });
  for (const w of (pend || []).slice(0, 10)) out.push(await settleSend(d, w.provider_id).catch((e) => ({ ok: false, error: String(e) })));
  return { ok: true, results: out };
}

export function tokenOk(d: Deps, given: string | null) {
  const t = d.env('EFI_WEBHOOK_TOKEN');
  if (!t) return false;
  const a = new TextEncoder().encode(t), b = new TextEncoder().encode(given || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// cadastra o endereço do aviso no Efí (o Efí acrescenta "/pix" no fim: o "&ignorar=" absorve isso)
export async function registerWebhook(d: Deps, url: string) {
  const webhookUrl = url + '?t=' + encodeURIComponent(d.env('EFI_WEBHOOK_TOKEN') || '') + '&ignorar=';
  // a função do Supabase não tem certificado de servidor: pede ao Efí para não exigir mTLS no aviso (o token na URL protege)
  return efi(d, `/v2/webhook/${encodeURIComponent(d.env('EFI_PIX_KEY') || '')}`, { method: 'PUT', body: { webhookUrl }, headers: { 'x-skip-mtls-checking': 'true' } });
}
