# Skill graphify: mapa do projeto

O graphify lê uma pasta inteira (código, textos, PDFs, imagens e vídeos) e monta um **grafo de conhecimento**: um mapa de quais partes se ligam a quais. Depois, em vez de procurar arquivo por arquivo, o Claude consulta o mapa.

## Como usar

Peça em linguagem normal ou chame pelo nome:

- `/graphify .`: mapeia o repositório inteiro
- `/graphify site`: mapeia só o site
- `/graphify query "como o site carrega os projetos?"`: responde usando o mapa
- `/graphify path "app.js" "projetos.js"`: mostra como duas partes se ligam
- `/graphify explain "projetos"`: explica um conceito do mapa

O resultado fica em `graphify-out/`:

- `graph.html`: o mapa interativo, para abrir no navegador
- `GRAPH_REPORT.md`: resumo em texto, com os conceitos centrais e perguntas sugeridas
- `graph.json`: o mapa completo, que o Claude consulta nas próximas conversas

## O que precisa

- Python 3.10 ou mais novo (já vem no ambiente de nuvem).
- O programa `graphifyy`, do PyPI. Na primeira vez, a skill pede para instalar (`pip install graphifyy` ou `uv tool install graphifyy`). Como o ambiente de nuvem é recriado a cada sessão, a instalação pode ser pedida de novo.
- Chave: não precisa para código, que é lido localmente, sem IA. Para textos, PDFs, imagens e vídeos, ele usa o próprio Claude da sessão. `GEMINI_API_KEY` é opcional.

## Origem

Copiada sem alterações de [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) (versão 0.9.67), licença Apache 2.0. `SKILL.md` é o `graphify/skill.md` original e `references/` vem de `graphify/skills/claude/references/`, que é o que o comando `graphify install --project` copiaria.
