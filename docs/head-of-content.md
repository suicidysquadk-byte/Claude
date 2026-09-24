# Head of Content: pesquisa de conteúdo

Seis skills que pesquisam o que está dando resultado nas redes, analisam os vídeos com IA e montam um plano de conteúdo.
Origem: [bradautomates/head-of-content](https://github.com/bradautomates/head-of-content) (licença MIT, © 2026 bradautomates).

| Skill | O que faz | Chave necessária |
|---|---|---|
| `instagram-research` | Acha os posts e Reels que mais se destacam nos perfis acompanhados | `APIFY_TOKEN` + `GEMINI_API_KEY` |
| `tiktok-research` | O mesmo para TikTok | `APIFY_TOKEN` + `GEMINI_API_KEY` |
| `x-research` | O mesmo para X/Twitter | `APIFY_TOKEN` |
| `youtube-research` | Vídeos fora da curva por palavra-chave | `TUBELAB_API_KEY` + `GEMINI_API_KEY` |
| `video-content-analyzer` | Analisa ganchos, estrutura e chamada para ação dos vídeos | `GEMINI_API_KEY` |
| `content-planner` | Roda as pesquisas e gera o plano de conteúdo e os playbooks | as chaves das redes usadas |

## Chaves

Cadastre as chaves como variáveis de ambiente do ambiente de nuvem do Claude Code (menu do ambiente → Editar), com estes nomes:

- `APIFY_TOKEN`: <https://console.apify.com/account/integrations>
- `TUBELAB_API_KEY`: <https://tubelab.net/developers>
- `GEMINI_API_KEY`: <https://aistudio.google.com/api-keys>

No computador, também dá para copiar `.env.example` para `.env` e preencher. O `.env` não vai para o GitHub.
Nunca cole chaves no chat.

## Contexto da AlphaHome

Os arquivos em `.claude/context/` dizem às skills qual é o nicho e quais perfis acompanhar:

- `alphahome.md`: empresa, público e tom
- `instagram-accounts.md`, `tiktok-accounts.md`, `x-accounts.md`: tabela de perfis de referência (troque as linhas `@example`)
- `youtube-channel.md`: canal e palavras-chave

## Como usar

Peça em linguagem normal, por exemplo: "faça uma pesquisa de Instagram", "analise esses Reels" ou "crie um plano de conteúdo".
Os resultados ficam em `instagram-research/`, `tiktok-research/`, `x-research/`, `youtube-research/` e `content-plans/`.
Os arquivos de cada execução não vão para o GitHub.

O aviso sonoro ao terminar, que existe no projeto original, não foi incluído, porque só funciona no Mac.
