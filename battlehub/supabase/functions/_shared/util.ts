export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function env(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Variável ${name} não configurada`);
  return v;
}

// data no formato que o Mercado Pago aceita, no fuso de Brasília
export function mpDate(ms: number) {
  const d = new Date(ms - 3 * 3600e3);
  return d.toISOString().replace('Z', '-03:00');
}
