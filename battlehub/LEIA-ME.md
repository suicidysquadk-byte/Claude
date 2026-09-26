# BattleHub

App Android de salas e eventos de Free Fire valendo prêmio em dinheiro, **online**: os jogadores entram com
Google ou código por e-mail, depositam por Pix, entram em salas oficiais ou de organizadores autorizados,
jogam, e o prêmio cai na carteira assim que o resultado é confirmado.

- **App**: HTML/CSS/JS puro dentro do Capacitor 8 (Android, `gg.battlehub.app`). Pasta `www/`.
- **Servidor**: Supabase (Postgres com regras de segurança, login, fotos e funções). Pasta `supabase/`.
- **Pix**: Mercado Pago (automático) ou manual (QR Pix real gerado no app e confirmado pela equipe).

O passo a passo do que **você** precisa fazer (contas, chaves, loja) está em
[`O-QUE-VOCE-PRECISA-FAZER.md`](O-QUE-VOCE-PRECISA-FAZER.md).

## O que o app faz

**Conta e perfil**
- Login com Google ou pelo e-mail (link de entrada ou código de 6 dígitos que abre em leque de cartas), com
  animação de verificação.
- **Convite de testador**: a administração gera um link de entrada e manda pelo WhatsApp (só para quem ainda
  não entrou no app).
- Cadastro com nick, foto e **print do perfil do Free Fire** (nick + ID). A equipe confere no painel.
  Mudança de nick ou ID volta para a fila de verificação. Saque só com ID verificado.
- XP por participação, abates, top 3, vitória e prêmios; níveis liberam banners, molduras e títulos.
- Loja: banners animados (inclusive discretos e em estilo anime), **acessórios de avatar em 3D** (coroa, chapéu de
  palha, cartola, boné, capacete tático, headset, óculos, máscaras oni e tengu, laço, flor de sakura, asas),
  **fundos animados** do perfil, molduras, títulos, cor do nick e **prioridade na fila** de salas lotadas. Na loja
  tudo fica parado (leve em celular simples) e a **prévia** mostra o item animado no seu perfil.
  - **Raridade** no padrão do Free Fire (simples, comum verde, raro azul, épico roxo, mítico amarelo, lendário
    vermelho). Quanto mais elaborado, mais caro: de R$ 1,90 (comum) a R$ 49,90 (lendário).
  - **19 molduras desenhadas** em SVG com camadas e animação (asas douradas, coroa real, dragão, fênix de fogo, abismo
    celestial com planetas, mestre das sombras, cyber, nove caudas, chamas, gelo, relâmpago...). Em listas pequenas
    aparece só o aro colorido, para não pesar.
  - **Banners com cena** (fênix, trono dourado, mira sniper, lobo, synthwave, amanhecer, terror do lobby, grande final)
    e fundos animados novos (nevasca, vagalumes, colmeia dourada, luzes da final).
  - **35+ títulos** no estilo do Free Fire (O Bravo, Sniper, Exterminador, Lobo Solitário, Rei do Gelo, Headshot,
    Clutch King, Predador, Imparável, Assassino Silencioso, O Mito, Deus da Mira...), cada um com visual da raridade
    (brilho que corre, fogo, sombra, luz divina) e **títulos de conquista** que chegam sozinhos (Centurião com 100
    abates, Chacina com 500, Mil Abates, Rei do Booyah com 25 vitórias, Caçador de Reis, Veterano, Primeiro Sangue).
  - Os acessórios são do **Fluent Emoji** da Microsoft (licença MIT, uso comercial liberado; o aviso de licença vai
    junto, em `www/img/acessorios/LICENCA-FLUENT-EMOJI.txt`). Banners e fundos são desenhados no app (SVG e CSS).
- Opção de ficar anônimo no ranking (o valor ganho continua visível).
- **Aparência**: Sistema (igual ao celular), Preto ou Branco. A coroa e o nome BattleHub ficam sempre em dourado.
- **Excluir minha conta** (exigência da Play Store): apaga os dados pessoais e guarda só o histórico de pagamentos.

**Dinheiro**
- Carteira em centavos. O saldo só entra depois do pagamento confirmado (webhook do Mercado Pago ou equipe).
- Inscrição vai para o **cofre da sala** e fica lá até a sala acabar.
- Ao finalizar: paga os prêmios → a **plataforma** fica com a parte dela → o **organizador** fica com o resto.
  - Salas de organizador: a plataforma recebe `X%` da arrecadação (padrão 10%, dá para combinar uma taxa com
    cada organizador), **nunca mais que a sobra**. O prêmio dos jogadores vem sempre primeiro.
  - Piso de premiação: com a sala cheia, os jogadores precisam poder receber pelo menos `Y%` (padrão 50%).
  - **Teto de premiação** (todas as salas pagas, inclusive as oficiais): com a sala cheia, prêmios e mecânicas no
    pior caso não passam de `Z%` da arrecadação (padrão 70%). Na criação da sala o app mostra quanto ainda cabe,
    trava as mecânicas que não cabem e tem **Sortear mecânicas** (escolhe ao acaso só as que cabem).
  - **Salas oficiais** (da plataforma): a plataforma garante o prêmio (completa se faltar) e fica com a sobra.
- Guildas: cada membro manda uma parte dos prêmios para o cofre da guilda; o líder paga salário mensal
  (sugestão por desempenho ou divisão igual).
- Todo passo de dinheiro é testado: o total dentro do app (carteiras + cofres + receita) sempre bate com o que
  entrou menos o que saiu.

**Salas**
- Só quem tem permissão cria sala (o dono dá a permissão em Usuários). A administração cria **salas oficiais**.
- O **organizador (e a equipe) pode jogar a própria sala**: paga a inscrição e, se ganhar, recebe o prêmio. Todos os
  inscritos veem o aviso "o organizador também está jogando" e a auditoria registra a entrada e o resultado.
- Modelos prontos: **Treino, Base, Intermediária, Elite, Domínio, Ancestral (solo, dupla e squad)** — a tabela
  Ancestral é a da imagem de referência (70% da arrecadação em prêmios até o 4º lugar).
- Mecânicas: Kill paga, Primeira kill, Player Rei (roleta), Líder de abates (top killer), Booyah, Rei do lobby,
  Destaque da partida, Sobrevivente top 5, Meta de abates, Clutch extremo, Line mais agressiva,
  Line mais tática, Domínio absoluto e Sorteio. Empate divide. Bônus só paga se a mecânica acontecer.
- **Evento do dia** (segunda a domingo: Início Forte, Performance, Estratégia, Decisão, Pressão, Premium,
  Final Boss) com base fixa (kill paga, top 3, líder). Editável no painel.
- Organizador lança abates e colocação de cada jogador, vê a **prévia do pagamento** e confirma.
- Fila de espera com prioridade; admin move ou remove jogadores entre salas com reembolso.

**Eventos oficiais**
- Formatos prontos: **Liga Semanal** (14 quedas, pontos kill +2 / Booyah +15..., grande final com os 12
  melhores, campeão da semana), **Champions Series** (32 lines de 4, grupos → semifinal top 16 → final top 8,
  prêmios e bônus MVP, line mais agressiva, clutch, maior pontuador por mapa, domínio absoluto),
  **Intensivo de Lines** (treino de guildas com preço progressivo R$ 20/15/12 e pontos de guilda 10/7/5/3/1),
  **Copa Relâmpago**, **Copa das Duplas** e **Guerra de Guildas**.
- Inscrição por jogador ou por line (o capitão paga e chama os parceiros pelo número do perfil).
- A organização cria as quedas (as lines são divididas em grupos e colocadas nas salas sozinhas),
  a classificação atualiza a cada queda, fecha a fase (os melhores passam), vê a prévia e paga.
- Campeões ganham o título "Campeão da Semana" e a moldura de campeão; ranking de guildas da semana.

**Social**
- Chat privado com fotos e **mensagem de voz** (até 2 minutos, com ondas e tempo), lista de amigos (com sugestões de
  quem jogou com você). A conversa abre **no fim**, como no WhatsApp, e "Mensagens anteriores" carrega o histórico.
- **Conversas protegidas**: o texto fica criptografado no banco (AES-256, chave no Supabase Vault) e fotos e áudios num
  armazenamento privado; só os dois leem. A equipe só abre com **motivo** (denúncia, segurança ou ordem judicial), por
  24 horas, e cada acesso fica registrado para sempre. Exportação completa com resumo SHA-256 só pelo dono, para
  entregar à Justiça. Registro de acesso (data, hora, IP, aparelho) guardado 6 meses (Marco Civil, art. 15).
- **Lines dentro da guilda** (solo, dupla, trio ou squad): entrar pelo **código** da line; lines **recrutando**
  aparecem na busca de guildas sem precisar de código, com até **2 critérios** do líder (nível, abates, vitórias,
  salas, média de abates ou ID verificado) e a lista "querem entrar" separada dos membros.
- **Sinergia**: cada sala em que 2+ jogadores da line jogam juntos soma pontos; nos níveis todos da line ganham
  recompensa (título Entrosados, banner Sinergia, moldura Laço de Sangue, título Irmãos de Guerra, moldura Sinergia
  Suprema).
- Organizador fala com qualquer inscrito: a mensagem chega numa aba separada do chat e aparece num
  **balão no topo** (estilo WhatsApp) com resposta rápida.
- Ranking de abates, salas jogadas, sobrevivência, ganhos, vitórias e XP (semana, mês, geral).

**Notificação no celular**
- Com o app fechado, o jogador recebe no celular: sala começando (ID e senha), vaga liberada, prêmio, depósito, saque,
  mensagens e avisos da equipe. Tocar na notificação abre a tela certa (sala, conversa, evento, guilda).
- Na primeira entrada o app explica antes de o Android pedir a permissão. **Perfil → Notificações no celular** liga e
  desliga. Três canais no Android (Salas e resultados, Conversas, Avisos), que o jogador pode silenciar um a um.
- Como funciona: o app guarda o token do aparelho (`set_push_token`); cada aviso ou mensagem novo chama a função
  `push-enviar` pelo `pg_net` (um lote por comando, então um aviso para todos sai de uma vez), e ela manda pelo
  Firebase Cloud Messaging. Aparelho que desinstalou o app sai da lista sozinho. Sair da conta desliga o aparelho.
- Só liga com o Firebase configurado (`android/app/google-services.json` + chave da conta de serviço no servidor).
  Sem isso o app funciona igual, com os avisos só dentro dele.

**Moderação e anti-trapaça**
- Palavras proibidas (editáveis no painel) bloqueiam nick, bio e nome de guilda; no chat viram asteriscos. O filtro
  pega acento, letra repetida e troca por número (p0rr4). Bio sem link e sem telefone.
- Foto de perfil nova só aparece para os outros depois que a equipe aprova (fila **Fotos de perfil**). A equipe
  apaga bio ou foto de qualquer conta.
- **Análise de partida**: pela sala (tocar no jogador) ou pela denúncia, a equipe chama o suspeito. Ele é avisado
  no início do app e no chat de salas, os saques ficam pausados e ele tem 24 horas para mandar o vídeo da partida
  (até 50 MB pelo app, ou link do Drive/YouTube).
- A equipe liga por voz no **Jitsi Meet** (o jogador compartilha a tela pelo app do Jitsi).
- **Leitura do killfeed**: o app tira quadros do vídeo, lê o texto (Tesseract.js) e acha os nicks da sala. Quem o
  suspeito matou vira a lista separada de prejudicados; a equipe confere e salva.
- **Veredito**: trapaça confirmada devolve a inscrição para os prejudicados (ou todos da sala), retém todo o saldo
  do trapaceiro, recusa os saques pendentes, bane para sempre e bloqueia o ID do Free Fire, as chaves Pix e o
  aparelho. Sem trapaça, os saques voltam.
- **Verificação do aparelho** (letrinhas miúdas): ao ser chamado, o jogador lê que os organizadores podem verificar o
  aparelho (programa de trapaça ou APK modificado) e marca o aceite para mandar o vídeo.
- **Recusou a verificação**: ban permanente e bloqueio do ID do Free Fire, das chaves Pix e do aparelho, sem poder
  criar outra conta. A equipe escolhe se também trata como trapaça (devolve inscrições e retém o saldo).
- **Aba Banidos**: só admin ou dono liberam, de três jeitos: deixar criar outra conta (tira os bloqueios), voltar para
  esta conta (tira o ban, saldo retido continua retido) ou reativar (tira tudo e devolve o saldo retido).

**Painel administrativo** (dono, admin e moderador)
- Visão geral, receita por origem, usuários (cargos, permissão de criar sala, taxa do organizador,
  suspensão com tempo, ajuste de saldo, extrato, apagar bio ou foto), verificação de ID, financeiro (depósitos
  manuais e saques), salas, eventos, modelos de sala, denúncias, análise de partida, fotos de perfil, guildas,
  avisos, loja, configurações (com as palavras proibidas), banidos, acessos a conversas e auditoria.

## Estrutura

```
www/                  o app (index.html, css/, js/, fonts/, vendor/)
  js/config.js        endereço do Supabase e chave pública (gerado pelo script)
  js/api.js           conversa com o Supabase (login, RPC, fotos, Pix, tempo real)
  js/pages-*.js       telas (entrada, salas, eventos, social, perfil, admin)
  js/cosmetics.js     arte da loja: acessórios, fundos e banners animados
  js/pages-mod.js     moderação: fotos, análise de partida, aviso do suspeito
  js/killfeed.js      leitura do killfeed no vídeo (Tesseract.js baixado do jsDelivr só quando usado)
  js/push.js          notificação no celular: permissão, cadastro do aparelho e toque no aviso
  js/pages-lines.js   lines da guilda, recrutamento e sinergia
  js/pages-seguranca.js  acesso excepcional às conversas, registro de acesso e aba Banidos
  js/molduras.js      molduras de avatar desenhadas em SVG (comum a lendária)
  js/visuais.js       cenas de banner e fundos animados novos
  css/molduras.css    animação das molduras, raridade e estilos dos títulos
  css/ouro.css        visual preto e dourado (sóbrio) e a loja
  css/entrada.css     abertura (coroa desenhada, zoom), boas-vindas com mural e login
  css/claro.css       tema Branco
  css/moderacao.css   telas de moderação
  img/acessorios/     acessórios 3D (Fluent Emoji, MIT)
  img/mural/          telas do app usadas no mural das boas-vindas
supabase/
  migrations/         banco: tabelas, regras de dinheiro, API, admin, fotos, competitivo, eventos, conta
  functions/          pix-criar e pix-webhook (Mercado Pago), convite (link de entrada para testador),
                      push-enviar (notificação no celular pelo Firebase)
  tests/              testes das regras de dinheiro e da notificação, e servidor de teste para rodar o app sem internet
scripts/configurar.sh conecta tudo ao seu Supabase (lê scripts/conexao.env)
scripts/ligar-push.js instala o google-services.json do Firebase e liga a notificação no app
android/              projeto Android gerado pelo Capacitor
loja/                 textos, imagens e política de privacidade para a Play Store
```

## Conectar ao servidor

```bash
cp scripts/conexao.exemplo.env scripts/conexao.env   # preencha as chaves
bash scripts/configurar.sh
```

O script liga ao projeto, aplica as migrações, publica as funções do Pix e da notificação, guarda a chave do
Firebase, guarda as chaves do Mercado Pago,
liga o login com Google e o código por e-mail e grava `www/js/config.js`. **A primeira conta que entrar vira
a dona do app.**

## Notificação no celular (Firebase)

```bash
node scripts/ligar-push.js ~/Downloads/google-services.json   # liga no app (o arquivo vai para o GitHub)
# e no scripts/conexao.env: FCM_SERVICE_ACCOUNT_FILE=scripts/battlehub-firebase-adminsdk.json (secreto, ignorado pelo git)
bash scripts/configurar.sh
```

Sem o `google-services.json` o app não chama o Firebase (`BH_CONFIG.push` fica `false`), porque o Android fecharia o
app ao tentar cadastrar o aparelho.

## Gerar o app

```bash
npm ci
npm run apk     # APK de teste (debug)
npm run aab     # pacote para a Play Store (precisa de android/keystore.properties)
```

`android/keystore.properties` (fora do git):

```
storeFile=/caminho/battlehub-upload.jks
storePassword=...
keyAlias=battlehub
keyPassword=...
```

No GitHub, o workflow **BattleHub Android** gera APK/AAB a cada push. Segredos usados (Settings → Secrets):
`BATTLEHUB_SUPABASE_URL`, `BATTLEHUB_SUPABASE_ANON_KEY`, `BATTLEHUB_KEYSTORE_BASE64`,
`BATTLEHUB_KEYSTORE_PASSWORD`, `BATTLEHUB_KEY_ALIAS`, `BATTLEHUB_KEY_PASSWORD`.

## Testes

Precisa de um Postgres local vazio (não usa o Supabase):

```bash
export PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh
for t in money competitivo push chat banidos organizador lines customizacao; do
  ./supabase/tests/reset.sh && node supabase/tests/$t.test.js
done
# money 211 · competitivo 400 · push 39 · chat 66 · banidos 47 · organizador 16 · lines 50 · customizacao 22
```

Para abrir o app no navegador sem internet: `node supabase/tests/fake-supabase.js 8790` e acesse
`http://localhost:8790` (qualquer e-mail, código `123456`).
