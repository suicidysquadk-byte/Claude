// Integração com o Asaas: depósito por Pix, saque por transferência Pix e os avisos (webhooks).
// A lógica fica aqui, separada do servidor, para poder ser testada com um Asaas falso (supabase/tests/asaas.test.js).
// deps.rpc chama as funções svc_* do banco com a chave de serviço; deps.env lê as variáveis do Supabase.

export type Deps = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<any>;
  env: (name: string) => string | undefined;
  fetch?: typeof fetch;
};

export class AsaasError extends Error {
  status: number;
  constructor(msg: string, status = 502) { super(msg); this.status = status; }
}

export function asaasBase(d: Deps) {
  return d.env('ASAAS_API_URL') || (d.env('ASAAS_ENV') === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
}

export async function asaas(d: Deps, path: string, init: { method?: string; body?: unknown } = {}) {
  const key = d.env('ASAAS_API_KEY');
  if (!key) throw new AsaasError('asaas_nao_configurado', 501);
  const r = await (d.fetch || fetch)(asaasBase(d) + path, {
    method: init.method || 'GET',
    headers: { access_token: key, 'Content-Type': 'application/json', 'User-Agent': 'BattleHub' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!r.ok) {
    const msg = data?.errors?.[0]?.description || data?.message || `HTTP ${r.status}`;
    throw new AsaasError('O Asaas recusou: ' + msg, r.status >= 500 ? 502 : 400);
  }
  return data;
}

const onlyDigits = (s: string) => String(s || '').replace(/\D/g, '');
const KEY_TYPE: Record<string, string> = { CPF: 'CPF', 'E-mail': 'EMAIL', Telefone: 'PHONE', 'Aleatória': 'EVP' };
export function pixKey(type: string, key: string) {
  const t = KEY_TYPE[type];
  if (!t) throw new AsaasError('Tipo de chave Pix inválido.', 400);
  let k = String(key || '').trim();
  if (t === 'CPF') k = onlyDigits(k);
  if (t === 'PHONE') { k = onlyDigits(k); if (k.length === 13 && k.startsWith('55')) k = k.slice(2); }
  return { pixAddressKey: k, pixAddressKeyType: t };
}
// data de hoje no fuso de Brasília (AAAA-MM-DD)
export const todayBR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);

/* ---------------- depósito ---------------- */
export async function createDeposit(d: Deps, userId: string, cents: number, cpfInput?: string) {
  const payer = await d.rpc('svc_payer', { p_user: userId });
  if (payer.banned) throw new AsaasError('Conta suspensa.', 403);
  let cpf = payer.cpf as string | null;
  if (!cpf) {
    if (!cpfInput) throw new AsaasError('cpf_necessario', 400);
    await d.rpc('svc_set_payer', { p_user: userId, p_cpf: cpfInput }); // valida o CPF e se ele já é de outra conta
    cpf = onlyDigits(cpfInput);
  }
  let customer = payer.customer as string | null;
  if (!customer) {
    const c = await asaas(d, '/customers', { method: 'POST', body: { name: payer.nick || 'Jogador BattleHub', cpfCnpj: cpf, email: payer.email || undefined, externalReference: userId, notificationDisabled: true } });
    customer = c.id;
    await d.rpc('svc_set_payer', { p_user: userId, p_cpf: cpf, p_customer: customer });
  }
  const pay = await asaas(d, '/payments', { method: 'POST', body: {
    customer, billingType: 'PIX', value: cents / 100, dueDate: todayBR(), description: 'Saldo BattleHub', externalReference: userId,
  } });
  const qr = await asaas(d, `/payments/${encodeURIComponent(pay.id)}/pixQrCode`);
  if (!qr?.payload) throw new AsaasError('O Asaas não devolveu o QR Code.');
  const expires = qr.expirationDate ? new Date(String(qr.expirationDate).replace(' ', 'T') + '-03:00').toISOString() : new Date(Date.now() + 24 * 3600e3).toISOString();
  return d.rpc('svc_create_deposit', { p_user: userId, p_cents: cents, p_provider_id: String(pay.id), p_qr: qr.payload, p_qr64: qr.encodedImage || null, p_expires: expires, p_provider: 'asaas' });
}

/* ---------------- saque ---------------- */
// envia um saque que está "processando". Se o Asaas recusar, o saque volta para a fila da equipe.
export async function sendWithdrawal(d: Deps, id: string, userId?: string | null) {
  const c = await d.rpc('svc_withdrawal_claim', { p_id: id, p_user: userId || null });
  if (!c.ok) return { ok: false, reason: c.reason, status: c.status };
  try {
    const t = await asaas(d, '/transfers', { method: 'POST', body: {
      value: c.amount_cents / 100, ...pixKey(c.pix_key_type, c.pix_key), description: 'Saque BattleHub · ' + (c.nick || ''), externalReference: c.id,
    } });
    await d.rpc('svc_withdrawal_sent', { p_id: c.id, p_provider_id: String(t.id) });
    // alguns envios já voltam concluídos
    if (t.status === 'DONE') await d.rpc('svc_withdrawal_settle', { p_provider_id: String(t.id), p_status: 'DONE', p_ref: c.id });
    if (t.status === 'FAILED' || t.status === 'CANCELLED') await d.rpc('svc_withdrawal_settle', { p_provider_id: String(t.id), p_status: t.status, p_ref: c.id, p_reason: t.failReason || null });
    return { ok: true, provider_id: t.id, status: t.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await d.rpc('svc_withdrawal_settle', { p_provider_id: '', p_status: 'ERROR', p_ref: c.id, p_reason: msg });
    return { ok: false, reason: 'erro', message: msg };
  }
}

/* ---------------- avisos do Asaas ---------------- */
// Confere o token do aviso. Nunca confia no conteúdo: consulta a cobrança ou a transferência direto na API.
export function tokenOk(d: Deps, headerToken: string | null) {
  const t = d.env('ASAAS_WEBHOOK_TOKEN');
  if (!t) return false;
  const a = new TextEncoder().encode(t), b = new TextEncoder().encode(headerToken || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function handleWebhook(d: Deps, body: any) {
  const ev = String(body?.event || '');
  if (ev.startsWith('PAYMENT_') && body?.payment?.id) {
    const p = await asaas(d, `/payments/${encodeURIComponent(body.payment.id)}`);
    return d.rpc('svc_settle_deposit_asaas', { p_provider_id: String(p.id), p_status: String(p.status), p_amount_cents: Math.round(Number(p.value) * 100) });
  }
  if (ev.startsWith('TRANSFER_') && body?.transfer?.id) {
    const t = await asaas(d, `/transfers/${encodeURIComponent(body.transfer.id)}`);
    if (!['DONE', 'FAILED', 'CANCELLED'].includes(String(t.status))) return { ok: true, status: t.status };
    return d.rpc('svc_withdrawal_settle', { p_provider_id: String(t.id), p_status: String(t.status), p_ref: t.externalReference || null, p_reason: t.failReason || null });
  }
  return { ok: true, ignored: ev };
}

// "Mecanismo de validação de saque": o Asaas pergunta antes de cada transferência sair
export async function validateTransfer(d: Deps, body: any) {
  const t = body?.transfer;
  if (body?.type !== 'TRANSFER' || !t) return { status: 'REFUSED', refuseReason: 'Só transferências de saque do BattleHub são aprovadas.' };
  const key = t.bankAccount?.pixAddressKey ?? t.pixAddressKey ?? null;
  const r = await d.rpc('svc_withdrawal_validate', { p_ref: String(t.externalReference || ''), p_cents: Math.round(Number(t.value) * 100), p_key: key });
  return r.ok ? { status: 'APPROVED' } : { status: 'REFUSED', refuseReason: r.reason };
}
