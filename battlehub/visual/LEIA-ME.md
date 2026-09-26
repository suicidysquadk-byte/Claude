# Motor visual do BattleHub

Aqui fica o processo que toda arte de personalização segue (decorações, banners, placas, molduras, fundos e capas).
Nenhuma arte sai direto de um prompt. O caminho é sempre este:

```
PEDIDO → PESQUISA → REFERÊNCIAS → ANÁLISE → APROVAÇÃO → TEMPLATE → COMPOSIÇÃO → GERAÇÃO → QUALIDADE → RESULTADO
```

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `estilos.json` | Biblioteca com 22 estilos (luz, paleta, profundidade, efeitos, materiais e o que evitar), variações de cor e níveis de intensidade |
| `templates.json` | Templates de composição por formato (onde fica o foco, o que fica livre, camadas, luz e movimento) e as 12 perguntas de análise de referência |
| `qualidade.json` | Os 10 critérios com nota de 0 a 10, a regra de aprovação e a lista de sinais de arte genérica |
| `referencia.modelo.json` | Ficha de cada referência (fonte, estilo, composição, luz, paleta, notas e aprendizados) |
| `perfis/` | Perfis visuais aprovados pelo usuário (`_modelo.json` mostra os campos) |
| `pesquisa/` | Pedidos de pesquisa e `rejeitadas.json` (o que o usuário recusou e não deve voltar) |
| `referencias/` | Fichas das referências aprovadas, separadas por tema |
| `pesquisar.py` | Busca, baixa, mede e monta as folhas de contato das referências |
| `briefing.js` | Transforma um perfil aprovado no briefing de geração |

## Como uma pesquisa acontece

1. Um pedido novo entra em `pesquisa/AAAA-MM-DD-tema-NN.json`, com as páginas, as buscas e os estilos.
2. O push dispara o workflow **BattleHub · pesquisa de referências**, que tem internet. Ele busca as imagens,
   descarta as repetidas e as fracas (resolução, nitidez e contraste) e sobe miniaturas, folhas de contato
   e `candidatos.json` como artifact de 2 dias.
3. As candidatas passam pela análise visual com as 12 perguntas de `templates.json` e recebem as notas de
   `qualidade.json`. As 12 melhores vão para uma grade 4x3 para o usuário escolher.
4. O usuário diz quais gostou (e, se quiser, de qual referência vem a composição, a luz e a paleta).
   Com isso sai a **BASE VISUAL DEFINIDA**, e ele escolhe: GERAR, ALTERAR REFERÊNCIAS ou PESQUISAR NOVAMENTE.
5. Com a base aprovada, o perfil vai para `perfis/` e o `briefing.js` monta o briefing de geração.
6. A arte gerada passa pelo checklist. Só entra no app com média 8 ou mais e nenhum critério abaixo de 6.

Ordem de prioridade: referência do usuário > template aprovado > referências profissionais > biblioteca de estilos > geração livre.

## Regras

- Referência serve para aprender princípios (composição, luz, cor, profundidade). Nunca se copia desenho, logo, personagem ou arte de terceiros.
- Efeito com propósito vale mais que efeito em excesso.
- No app, animação só com `transform` e `opacity`, camadas em WebP com alfa e no máximo 3 camadas animadas por peça.
- O usuário é o diretor de arte: nada é gerado sem a base visual aprovada.

## Comandos

```bash
python pesquisar.py pesquisa/<pedido>.json saida   # roda a pesquisa (no Actions, que tem internet)
node briefing.js perfis/<perfil>.json               # mostra o briefing
node briefing.js perfis/<perfil>.json --json        # briefing em JSON
```
