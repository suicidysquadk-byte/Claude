# Skills de design

Skills para criar, revisar e dar acabamento a telas, sites, banners e apresentações. O Claude escolhe sozinho a skill certa pelo pedido. Também dá para chamar pelo nome, por exemplo `/impeccable polish site/index.html`.

| Skill | O que faz | Precisa de chave? |
|---|---|---|
| `impeccable` | Direção de design e revisão de interfaces, com 24 comandos: `critique`, `audit`, `polish`, `bolder`, `quieter`, `animate` e outros | Não |
| `ui-ux-pro-max` | Banco de estilos, paletas, pares de fontes e regras de UX pesquisável, para decidir o visual de uma tela | Não |
| `design-system` | Tokens de cor, tipografia e espaçamento, especificação de componentes | Não (fundo de slide por IA é opcional) |
| `brand` | Voz da marca, identidade visual, guia de estilo | Não |
| `ui-styling` | Telas com shadcn/ui e Tailwind, e artes em canvas | Não |
| `banner-design` | Banners para redes sociais, anúncios, capa de site e impressos | Imagens por IA são opcionais |
| `slides` | Apresentações em HTML com gráficos | Não |
| `design` | Tudo acima, mais logos, ícones e kit de identidade | `GEMINI_API_KEY`, `ATLASCLOUD_API_KEY` ou `MUAPI_API_KEY` só para gerar logos e ícones com IA |
| `21st-ui` | Busca componentes prontos no 21st.dev (mais de 10 mil, em React e Tailwind) | `API_KEY_21ST` |

A `impeccable` também instala 4 ajudantes em `.claude/agents/` (documentação, revisão final, produção de imagens e aplicação de edições), que ela mesma aciona.

## Chaves

Cadastre as chaves como variáveis de ambiente do ambiente de nuvem (menu do ambiente → Editar). Nunca cole chaves no chat.

- `API_KEY_21ST`: <https://21st.dev/mcp>. O arquivo `.mcp.json` da raiz conecta o servidor do 21st.dev e lê a chave dessa variável.
- `GEMINI_API_KEY`: <https://aistudio.google.com/api-keys>. É a mesma usada pela pesquisa de conteúdo.

Sem chave, as skills funcionam normalmente. Só as partes que geram imagens por IA ou buscam no 21st.dev ficam indisponíveis.

## skillui

O zip do skillui só trazia o site de divulgação da ferramenta, então ele não foi instalado. Para extrair as cores, fontes e espaçamentos de um site e transformar em skill, peça ao Claude para rodar:

```bash
npx skillui --url https://site-de-referencia.com.br --mode ultra
```

## Origem e licenças

- `impeccable` e os ajudantes: [pbakaus/impeccable](https://impeccable.style), licença Apache 2.0
- `ui-ux-pro-max`, `design`, `design-system`, `brand`, `ui-styling`, `banner-design`, `slides`: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), licença MIT (© 2024 Next Level Builder)
- `21st-ui` e `.mcp.json`: [21st-dev/magic-mcp](https://github.com/21st-dev/magic-mcp), licença ISC

Todos os arquivos foram copiados sem alterações.
