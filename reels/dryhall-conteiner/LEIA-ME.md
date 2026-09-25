# Reels: "O móvel planejado começa antes da obra" (drywall em contêiner)

Vídeo vertical para Instagram Reels, 1080x1920, 30 fps, 43,3 s, sem música de fundo.
A narração gravada conduz a edição. O trecho do drywall é explicado com um diagrama de linhas finas
nas cores da marca (dourado e marfim sobre fundo escuro), em três passos: estrutura, reforço e móvel.

Os arquivos de vídeo não ficam no repositório, porque o `.gitignore` da raiz ignora `*.mp4`.
Aqui ficam os scripts que geram o vídeo, para refazer ou ajustar a edição.

## Arquivos de origem

Coloque os arquivos brutos em `src/` com estes nomes:

| Nome em `src/` | Arquivo original | Conteúdo |
|---|---|---|
| `A.mp4` | `lv_0_20260924104507.mp4` | Chegada no letreiro "Eu ❤ Três Lagoas" (60 fps) |
| `B.mp4` | `lv_0_20260924104748.mp4` | Escada e varanda do escritório em contêiner |
| `C.mp4` | `lv_0_20260924110009.mp4` | Instalação das cantoneiras na linha de nível |
| `D.mp4` | `lv_0_20260924110302.mp4` | Interior: painel ripado, paredes e estrutura dos móveis |
| `E.mp4` | `VID_20260923_102314.mp4` | Montador na bancada (60 fps) |
| `voice.m4a` | `gravação contêiner.m4a` | Narração |

Depois rode `./build.sh`. Precisa de `ffmpeg` e Python com `numpy`, `opencv-python-headless`, `pillow` e `soundfile`.
O resultado sai em `out/reels_dryhall_final.mp4` e `out/reels_dryhall_sem_narracao.mp4`.

## Roteiro de edição

| Tempo | Imagem | Narração | Grafismo |
|---|---|---|---|
| 0,0 a 2,6 | E em câmera lenta | "Móveis planejados não começam na montagem." | Legenda fixa |
| 2,6 a 3,3 | C, parafusadeira | (continuação) | |
| 3,3 a 6,3 | D congelado, sala vazia | "Ele começa antes da obra." | Linhas de projeto desenhando paredes, pontos elétricos e reforços |
| 6,0 a 10,6 | A em câmera lenta | "Na AlphaHome, desenvolvemos projetos tanto para construção em alvenaria" | Etiqueta "Três Lagoas · MS" |
| 10,6 a 14,4 | B, subindo a escada | "quanto para contêineres. Neste projeto, por exemplo," | Etiqueta "Projeto em contêiner" |
| 14,4 a 16,8 | D, a sala real | "as estruturas internas são em drywall." | Etiqueta "Interior em drywall" |
| 16,8 a 26,3 | Diagrama sobre D desfocado | "Por isso, ainda na fase de projeto, já orientamos onde devem ser previstos os pontos de reforço necessários" | 01 Estrutura em drywall, 02 Reforço previsto no projeto, 03 Móvel planejado |
| 26,1 a 27,7 | C, cantoneiras na parede | "para a instalação dos móveis planejados." | Anéis dourados rastreados nas cantoneiras e rótulo "Ponto de reforço" |
| 27,7 a 30,4 | C, fixação | "Assim, quando chega a hora da montagem," | |
| 30,4 a 33,9 | D, estrutura dos móveis | "tudo já está preparado para receber a marcenaria." | |
| 33,9 a 37,0 | B, varanda do contêiner | "Vai construir ou reformar?" | |
| 37,0 a 38,9 | A, letreiro de Três Lagoas | "Planeje seus móveis antes da obra começar." | |
| 38,6 a 43,3 | Encerramento sobre o ripado | "Chama a AlphaHome no direct." | Logo, "Ambientes planejados", botão "Chame no direct" |

## Legendas

- Cada frase aparece inteira, com um fade rápido, e fica parada até sair. Nenhum texto se move na tela.
- O vídeo não tem filtro de granulação, para as letras ficarem nítidas.
- As legendas seguem a fala da narração. A primeira é "Móveis planejados não começam na montagem.", como dito no áudio.

## Áudio

- Narração limpa (ruído, graves, sibilância, compressão) e remontada com pequenas pausas extras para o diagrama respirar.
- Efeitos sintetizados e discretos: quatro "whooshes" nas transições principais, cliques leves quando os pontos de reforço aparecem e um grave suave no logo.
- Volume final em torno de -14 LUFS, pico em -2,6 dBFS.
- Ao colocar a música, deixe-a cerca de 15 a 20 dB abaixo da voz para a narração continuar clara.

## Ajustes rápidos

- Textos das legendas e tempos: lista `CAPTIONS` em `render.py`.
- Cortes e trechos de cada clipe: lista `SHOTS` em `render.py`.
- Textos do diagrama: lista `HEADERS` em `render.py`.
- Posição da narração no tempo: lista `BLOCKS` em `audio.py`.
- `transcribe.py` gerou a transcrição com Whisper (sherpa-onnx). Só é necessário para uma nova narração.
