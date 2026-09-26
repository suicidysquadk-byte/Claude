# Skills OmniRoute: um endereço para várias IAs

O [OmniRoute](https://omniroute.online) é um servidor que você instala no computador ou num servidor próprio. Ele junta mais de 170 provedores de IA (Claude, GPT, Gemini e outros, vários com plano grátis) atrás de um único endereço. Se um provedor atinge o limite, ele passa para o próximo sozinho. Também compacta as mensagens para gastar menos.

As 18 skills em `.claude/skills/omniroute*` ensinam o Claude a usar esse servidor:

| Skill | Para quê |
|---|---|
| `omniroute` | Ponto de partida: configuração e lista das outras |
| `omniroute-chat` | Texto e código |
| `omniroute-image` | Gerar imagens |
| `omniroute-tts` / `omniroute-stt` | Texto em voz e voz em texto |
| `omniroute-embeddings` | Vetores para busca por significado |
| `omniroute-web-search` / `omniroute-web-fetch` | Buscar na web e ler páginas |
| `omniroute-mcp` / `omniroute-a2a` | Ferramentas MCP e conversa entre agentes |
| `omniroute-routing` | Combos e ordem de provedores de reserva |
| `omniroute-compression` | Compactação de mensagens |
| `omniroute-monitoring` | Saúde, latência e orçamento |
| `omniroute-cli*` (6) | Comando `omniroute` no terminal: administração, provedores, agentes em nuvem e testes |

## O que precisa

As skills só funcionam com um servidor OmniRoute rodando. O ambiente de nuvem do Claude Code não tem um, então elas ficam paradas até você:

1. Instalar o OmniRoute (`npx omniroute`, Docker ou o aplicativo), seguindo o [guia oficial](https://github.com/diegosouzapw/OmniRoute).
2. Deixar o servidor acessível pela internet, se for usar no ambiente de nuvem (um servidor próprio ou um túnel).
3. Cadastrar nas variáveis de ambiente do ambiente de nuvem (menu do ambiente → Editar):
   - `OMNIROUTE_URL`: endereço do servidor, por exemplo `http://localhost:20128`
   - `OMNIROUTE_KEY`: chave criada no painel do OmniRoute, em API Keys

Nunca cole chaves no chat. Confira também se o uso de cada provedor ligado ao OmniRoute respeita os termos dele.

## Origem

Copiadas sem alterações de `skills/` do repositório [diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute), licença MIT (© 2026 diegosouzapw). O código do servidor não foi copiado.
