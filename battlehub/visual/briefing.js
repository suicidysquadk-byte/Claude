#!/usr/bin/env node
// Monta o briefing de geração a partir de um perfil visual APROVADO (visual/perfis/<id>.json).
// Junta estilo + template + variação de cor + intensidade + o que o usuário escolheu nas referências
// e devolve: descrição positiva, lista do que evitar, plano de camadas, animação e checklist.
// Uso: node briefing.js perfis/<id>.json [--json]
'use strict';
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const ler = f => JSON.parse(fs.readFileSync(path.join(AQUI, f), 'utf8'));

function briefing(perfil) {
  const { estilos, variacoes_de_cor: cores, intensidades } = ler('estilos.json');
  const { formatos, templates } = ler('templates.json');
  const qual = ler('qualidade.json');
  const est = estilos[perfil.estilo];
  const tpl = templates[perfil.template];
  if (!est) throw new Error('estilo desconhecido: ' + perfil.estilo);
  if (!tpl) throw new Error('template desconhecido: ' + perfil.template);
  if (tpl.formato !== perfil.formato) throw new Error(`o template ${perfil.template} é de ${tpl.formato}, não de ${perfil.formato}`);
  const fmt = formatos[perfil.formato];
  const cor = perfil.variacao_de_cor ? cores[perfil.variacao_de_cor] : null;
  const intens = intensidades[perfil.intensidade || 'equilibrado'];
  const paleta = perfil.paleta && perfil.paleta.length ? perfil.paleta : est.paleta;
  const evitar = [...new Set([...(tpl.evitar || []), ...(est.evitar || []), ...(perfil.evitar || []), ...qual.arte_generica])];

  const descricao = [
    `${fmt.nome}, ${tpl.descricao.toLowerCase()}`,
    `Estilo ${est.nome}: materiais ${est.materiais.join(', ')}.`,
    `Composição: ${tpl.foco}; área livre: ${tpl.zonas.livre}.`,
    `Luz: ${est.luz}; ${tpl.luz}.`,
    `Profundidade: ${tpl.profundidade}; ${est.profundidade}.`,
    `Paleta: ${paleta.join(', ')}${cor ? ` (variação ${perfil.variacao_de_cor}: ${Array.isArray(cor) ? cor.join(', ') : cor})` : ''}.`,
    `Efeitos com propósito: ${(perfil.efeitos && perfil.efeitos.length ? perfil.efeitos : est.efeitos).join(', ')}.`,
    `Intensidade: ${intens}.`,
    'Acabamento de ilustração premium de jogo, bordas limpas, sem texto, sem marca d\'água, sem logos.',
  ].join(' ');

  return {
    perfil: perfil.id,
    formato: perfil.formato,
    tela: fmt.tela,
    avatar: fmt.avatar || null,
    referencias: { principal: perfil.referencia_principal, secundarias: perfil.referencias_secundarias || [],
      composicao_de: perfil.composicao_de, luz_de: perfil.luz_de, paleta_de: perfil.paleta_de },
    descricao,
    evitar,
    camadas: tpl.camadas,
    animacao: tpl.movimento,
    regras_de_desempenho: ['animar só transform e opacity', 'camadas em WebP com alfa', 'nada de filtro animado', 'no máximo 3 camadas animadas'],
    checklist: Object.entries(qual.criterios).map(([k, c]) => `${k}: ${c.pergunta}`),
    aprovacao: qual.aprovacao,
  };
}

module.exports = { briefing };

if (require.main === module) {
  const arq = process.argv[2];
  if (!arq) { console.error('uso: node briefing.js perfis/<id>.json [--json]'); process.exit(1); }
  const b = briefing(JSON.parse(fs.readFileSync(path.resolve(arq), 'utf8')));
  if (process.argv.includes('--json')) { console.log(JSON.stringify(b, null, 2)); process.exit(0); }
  console.log(`BRIEFING · ${b.perfil} (${b.formato}, ${b.tela.join('x')})\n`);
  console.log(b.descricao + '\n');
  console.log('Evitar:\n- ' + b.evitar.join('\n- ') + '\n');
  console.log('Camadas:\n- ' + b.camadas.join('\n- ') + '\n');
  console.log('Animação:\n- ' + b.animacao.join('\n- ') + '\n');
  console.log('Checklist:\n- ' + b.checklist.join('\n- '));
}
