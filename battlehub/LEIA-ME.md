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
- Login com Google ou código de 6 dígitos no e-mail, com animação de verificação.
- Cadastro com nick, foto e **print do perfil do Free Fire** (nick + ID). A equipe confere no painel.
  Mudança de nick ou ID volta para a fila de verificação. Saque só com ID verificado.
- XP por participação, abates, top 3, vitória e prêmios; níveis liberam banners, molduras e títulos.
- Loja (visual do perfil e **prioridade na fila** de salas lotadas).
- Opção de ficar anônimo no ranking (o valor ganho continua visível).
- **Excluir minha conta** (exigência da Play Store): apaga os dados pessoais e guarda só o histórico de pagamentos.

**Dinheiro**
- Carteira em centavos. O saldo só entra depois do pagamento confirmado (webhook do Mercado Pago ou equipe).
- Inscrição vai para o **cofre da sala** e fica lá até a sala acabar.
- Ao finalizar: paga os prêmios → a **plataforma** fica com a parte dela → o **organizador** fica com o resto.
  - Salas de organizador: a plataforma recebe `X%` da arrecadação (padrão 10%, dá para combinar uma taxa com
    cada organizador), **nunca mais que a sobra**. O prêmio dos jogadores vem sempre primeiro.
  - Piso de premiação: com a sala cheia, os jogadores precisam poder receber pelo menos `Y%` (padrão 50%).
  - **Salas oficiais** (da plataforma): a plataforma garante o prêmio (completa se faltar) e fica com a sobra.
- Guildas: cada membro manda uma parte dos prêmios para o cofre da guilda; o líder paga salário mensal
  (sugestão por desempenho ou divisão igual).
- Todo passo de dinheiro é testado: o total dentro do app (carteiras + cofres + receita) sempre bate com o que
  entrou menos o que saiu.

**Salas**
- Só quem tem permissão cria sala (o dono dá a permissão em Usuários). A administração cria **salas oficiais**.
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
- Chat privado com fotos, lista de amigos (com sugestões de quem jogou com você).
- Organizador fala com qualquer inscrito: a mensagem chega numa aba separada do chat e aparece num
  **balão no topo** (estilo WhatsApp) com resposta rápida.
- Ranking de abates, salas jogadas, sobrevivência, ganhos, vitórias e XP (semana, mês, geral).

**Painel administrativo** (dono, admin e moderador)
- Visão geral, receita por origem, usuários (cargos, permissão de criar sala, taxa do organizador,
  suspensão com tempo, ajuste de saldo, extrato), verificação de ID, financeiro (depósitos manuais e saques),
  salas, eventos, modelos de sala, denúncias, guildas, avisos, loja, configurações e auditoria.

## Estrutura

```
www/                  o app (index.html, css/, js/, fonts/, vendor/)
  js/config.js        endereço do Supabase e chave pública (gerado pelo script)
  js/api.js           conversa com o Supabase (login, RPC, fotos, Pix, tempo real)
  js/pages-*.js       telas (entrada, salas, eventos, social, perfil, admin)
supabase/
  migrations/         banco: tabelas, regras de dinheiro, API, admin, fotos, competitivo, eventos, conta
  functions/          pix-criar e pix-webhook (Mercado Pago)
  tests/              testes das regras de dinheiro e servidor de teste para rodar o app sem internet
scripts/configurar.sh conecta tudo ao seu Supabase (lê scripts/conexao.env)
android/              projeto Android gerado pelo Capacitor
loja/                 textos, imagens e política de privacidade para a Play Store
```

## Conectar ao servidor

```bash
cp scripts/conexao.exemplo.env scripts/conexao.env   # preencha as chaves
bash scripts/configurar.sh
```

O script liga ao projeto, aplica as migrações, publica as funções do Pix, guarda as chaves do Mercado Pago,
liga o login com Google e o código por e-mail e grava `www/js/config.js`. **A primeira conta que entrar vira
a dona do app.**

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
PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh ./supabase/tests/reset.sh
PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh node supabase/tests/money.test.js        # 196 verificações
PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh ./supabase/tests/reset.sh
PGHOST=/var/run/postgresql PGPORT=5433 PGDATABASE=bh node supabase/tests/competitivo.test.js  # 216 verificações
```

Para abrir o app no navegador sem internet: `node supabase/tests/fake-supabase.js 8790` e acesse
`http://localhost:8790` (qualquer e-mail, código `123456`).
