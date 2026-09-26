-- Banners antigos (só um degradê, alguns quase pretos) passam a usar os cenários ilustrados novos
-- (www/js/cosm/cenarios.js), com cores para trocar. Quem já tem o banner continua com ele.
update public.shop_items s set data = v.d
from (values
  ('banner-padrao', '{"art": "ouro", "pal": "dourado", "variants": ["vermelho", "azul-ciano", "neon"]}'::jsonb),
  ('banner-roxo', '{"art": "prisma", "pal": "roxo", "variants": ["azul", "vermelho", "rosa"]}'::jsonb),
  ('banner-chamas', '{"art": "chamas", "pal": "fogo", "variants": ["azul", "roxo", "neon"]}'::jsonb),
  ('banner-gelo', '{"art": "cristais", "pal": "gelo", "variants": ["roxo", "verde", "dourado"]}'::jsonb),
  ('banner-coroa', '{"art": "realeza", "pal": "dark", "variants": ["royal", "vermelho", "azul"]}'::jsonb),
  ('banner-neon', '{"art": "cidade", "pal": "cyberpunk", "variants": ["azul", "verde", "dourado"]}'::jsonb),
  ('banner-aurora', '{"art": "aurora", "pal": "mistico", "variants": ["verde", "rosa", "azul"]}'::jsonb),
  ('banner-lava', '{"art": "vulcao", "pal": "fogo", "variants": ["azul", "roxo", "neon"]}'::jsonb),
  ('banner-galaxia', '{"art": "nebulosa", "pal": "galaxia", "variants": ["azul", "vermelho", "verde"]}'::jsonb),
  ('banner-ouro-negro', '{"art": "carbono", "pal": "dourado", "variants": ["vermelho", "azul-ciano", "neon"]}'::jsonb),
  ('banner-linha-dourada', '{"art": "ouro", "pal": "anonovo", "variants": ["prata", "rosa", "azul"]}'::jsonb),
  ('banner-grafite', '{"art": "carbono", "pal": "prata", "variants": ["azul", "verde", "roxo"]}'::jsonb),
  ('banner-carbono', '{"art": "carbono", "pal": "vermelho", "variants": ["azul", "dourado", "verde"]}'::jsonb),
  ('banner-brasas', '{"art": "chamas", "pal": "vermelho", "variants": ["azul", "dourado", "verde"]}'::jsonb),
  ('banner-tempestade', '{"art": "raios", "pal": "azul", "variants": ["roxo", "vermelho", "verde"]}'::jsonb),
  ('banner-sakura', '{"art": "petalas", "pal": "rosa", "variants": ["roxo", "azul", "dourado"]}'::jsonb),
  ('banner-kitsune', '{"art": "kitsune", "pal": "azul-ciano", "variants": ["vermelho", "roxo", "verde"]}'::jsonb),
  ('banner-neo-toquio', '{"art": "chuva", "pal": "cyberpunk", "variants": ["azul", "verde", "dourado"]}'::jsonb),
  ('banner-lua-carmesim', '{"art": "samurai", "pal": "vermelho", "variants": ["azul", "dourado", "verde"]}'::jsonb),
  ('banner-grande-onda', '{"art": "kanagawa", "pal": "azul", "variants": ["roxo", "vermelho", "verde"]}'::jsonb),
  ('banner-dragao-dourado', '{"art": "dragao", "pal": "dourado", "variants": ["vermelho", "azul-ciano", "neon"]}'::jsonb),
  ('banner-imperador', '{"art": "dragao", "pal": "royal", "variants": ["vermelho", "azul", "verde"]}'::jsonb),
  ('banner-sinergia', '{"art": "luzes", "pal": "dourado", "variants": ["vermelho", "azul-ciano", "neon"]}'::jsonb),
  ('banner-montanha', '{"art": "amanhecer", "pal": "rosa", "variants": ["roxo", "azul", "dourado"]}'::jsonb),
  ('banner-lobo', '{"art": "lobo", "pal": "azul", "variants": ["roxo", "vermelho", "verde"]}'::jsonb),
  ('banner-mira', '{"art": "mira", "pal": "verde", "variants": ["vermelho", "azul", "dourado"]}'::jsonb),
  ('banner-synth', '{"art": "grade", "pal": "cyberpunk", "variants": ["azul", "verde", "dourado"]}'::jsonb),
  ('banner-caveira', '{"art": "caveira", "pal": "vermelho", "variants": ["azul", "dourado", "verde"]}'::jsonb),
  ('banner-arena', '{"art": "luzes", "pal": "espacial", "variants": ["vermelho", "verde", "dourado"]}'::jsonb),
  ('banner-fenix', '{"art": "fenix", "pal": "fogo", "variants": ["azul", "roxo", "neon"]}'::jsonb),
  ('banner-trono', '{"art": "realeza", "pal": "royal", "variants": ["vermelho", "azul", "verde"]}'::jsonb)
) as v(id, d)
where s.id = v.id;
