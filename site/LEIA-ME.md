# Site AlphaHome (versão alfa)

Showroom animado: fachada em 3D → a porta abre → as luzes acendem → passeio pela loja conforme a rolagem, com balões nos projetos 1 a 5.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Página e estilos |
| `app.js` | Fachada 3D (Three.js), transição e passeio |
| `projetos.js` | **Textos dos projetos**: edite aqui |
| `frames/` | 172 quadros do vídeo da loja (15 por segundo, de 0,8 s a 12,2 s) |
| `assets/` | Logo e foto da fachada (usada se o 3D não carregar) |

## Como trocar os textos de um projeto

Abra `projetos.js` e edite `nome`, `frase`, `descricao` e `detalhes`.
Em `pontos`, cada item é `[segundo do vídeo, x, y]`: a bolinha segue esses pontos
enquanto a câmera passa pelo projeto (x e y vão de 0 a 1 sobre a imagem).

## Para trocar o vídeo

Extraia os quadros com:

```bash
ffmpeg -ss 0.8 -to 12.25 -i video.mp4 -vf "fps=15,scale=720:1280" -c:v libwebp -quality 72 frames/f%03d.webp
```

e ajuste `N_QUADROS` e `T0` no começo de `app.js`.

## Testar no computador

```bash
cd site && python3 -m http.server 8000
```

e abra `http://localhost:8000`.

## Pendências para a versão beta

- Descrições finais dos projetos 1 a 5 (enviadas pela AlphaHome)
- WhatsApp, Instagram e endereço reais
- Vídeo com a entrada no escuro e as luzes acendendo de verdade (hoje o efeito é simulado)
- Medidas da fachada para deixar o modelo 3D fiel
