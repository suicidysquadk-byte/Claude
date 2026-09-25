# O que você precisa fazer para o BattleHub funcionar

**Onde estamos:**
- O servidor (Supabase) está no ar, com todas as regras de dinheiro, eventos, loja e painel.
- A sua conta já é a **dona**.
- O app da versão **2.4.0** aponta para ele.

O que falta são contas nos serviços, que só você pode criar (ficam no seu nome e no seu CPF/CNPJ). Faça **na
ordem**. Onde está escrito **"me mande"**, cole a informação no chat que eu conecto.

> **Nunca poste as chaves em lugar público.** Mande só aqui no chat ou coloque direto no arquivo
> `scripts/conexao.env` (ele não vai para o GitHub).

---

## Mandar para alguém testar

1. Mande o arquivo **BattleHub-2.4.0.apk** e o **GUIA-DO-TESTADOR.md** para a pessoa.
2. Ela instala, digita o e-mail no app e entra com o **código de 6 dígitos** que chega do battlehubofc@gmail.com.

Se o e-mail dela demorar ou cair no spam, use o **convite**:
1. No app: **Perfil → Painel administrativo → Usuários → Convidar testador**.
2. Digite o e-mail da pessoa e toque em **Gerar link de entrada**.
3. Toque em **Mandar no WhatsApp**. A pessoa toca no link no mesmo celular em que o app está instalado.

Sobre o link:
- Vale por **1 hora** e funciona **uma vez**.
- Por segurança, só funciona para quem **ainda não entrou** no app. Ninguém da equipe consegue usar o convite
  para entrar na conta de um jogador.

## 1. Supabase: o servidor · ✅ feito

- Projeto `tjaqjirsayclexzaycti` (São Paulo) configurado.
- Guarde a **senha do banco** que você criou.
- O **Access Token** que você me mandou ainda é usado para eu publicar as atualizações. Quando o projeto estiver
  pronto, apague-o em *supabase.com/dashboard/account/tokens*. Se precisar de mim depois, é só gerar outro.

## 2. E-mail que manda o código de entrada · ✅ feito (Gmail battlehubofc@gmail.com)

Ligado com a senha de app do Gmail. O e-mail chega com o **código de 6 dígitos** (vale 1 hora) e o botão de entrar.
Limite: até 60 e-mails por hora (o Gmail aceita cerca de 500 por dia). Para cortar o acesso, apague a senha de app em
*myaccount.google.com/apppasswords*. Quando o app crescer, dá para trocar pelo Resend com domínio próprio.

Como era antes (para referência):

Sem isso, só a sua equipe recebe o e-mail de entrada. Escolha **uma** opção.

**Opção A: Gmail (mais rápida, sem domínio)**
1. Use uma conta Gmail do app, por exemplo `battlehub.app@gmail.com`.
2. Ligue a **verificação em duas etapas** em *myaccount.google.com → Segurança*.
3. Em *myaccount.google.com/apppasswords*, crie uma **senha de app** com o nome `BattleHub`. São 16 letras.
4. **Me mande**: o endereço do Gmail e a senha de app.
   - Eu ligo o e-mail próprio no Supabase (script `scripts/ligar-email.js`).
   - Na hora do login o app pede o código, e o e-mail chega com o **código de 6 dígitos** em destaque, além do botão de
     entrar.
   - O Gmail manda até cerca de 500 e-mails por dia.

**Opção B: Resend (profissional, precisa de domínio)**
1. Crie uma conta em **resend.com** (grátis até 3.000 e-mails por mês).
2. Adicione o seu domínio (ex.: `battlehub.com.br`) e siga os registros DNS que eles mostram.
3. Crie uma **API Key**.
4. **Me mande** a API Key e o domínio.

Se ainda não tiver domínio, compre um em **registro.br** (cerca de R$ 40 por ano). Ele também serve para o
site e para o e-mail de suporte que a Play Store pede.

## 3. Login com Google · 15 min (opcional, recomendado)

1. Entre em **console.cloud.google.com** com a conta Google da empresa e crie um projeto chamado `BattleHub`.
2. Vá em *APIs e serviços → Tela de consentimento OAuth*:
   - Tipo: **Externo**.
   - Preencha o nome **BattleHub**, o seu e-mail de suporte e o e-mail de contato.
   - Publique a tela ("Em produção").
3. Vá em *APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth*:
   - Tipo: **Aplicativo da Web**.
   - Em **URIs de redirecionamento autorizados**, coloque
     `https://tjaqjirsayclexzaycti.supabase.co/auth/v1/callback`.
4. **Me mande** o **ID do cliente** e a **Chave secreta do cliente**.

O botão "Continuar com Google" aparece sozinho no app quando isso estiver ligado.

## 4. Pagamento automático (Pix): Mercado Pago · 20 min (comece por aqui)

O app já está pronto para o Mercado Pago:
- o jogador gera o Pix no app;
- o Mercado Pago avisa o servidor quando o pagamento cai;
- o saldo entra sozinho.

O servidor confere a assinatura do aviso e confirma o pagamento direto no Mercado Pago antes de creditar. Os
**saques continuam manuais** no painel. É mais seguro no começo: você confere cada saque antes de pagar.

1. Crie uma conta **Mercado Pago**, de preferência como **empresa (CNPJ)**.
   - Descreva o negócio como ele é: torneios de e-sports com inscrição e premiação.
   - Alguns meios de pagamento pedem documentos para esse tipo de negócio.
2. No app do Mercado Pago, cadastre uma **chave Pix** na conta: *Seu perfil → Pix → Minhas chaves*. Sem chave Pix,
   o Mercado Pago não gera QR Code.
3. Em **mercadopago.com.br/developers**, entre em *Suas integrações → Criar aplicação*:
   - Nome: `BattleHub`.
   - Tipo: **Pagamentos on-line**, com **Checkout Transparente** (pagamento pela API).
4. Na aplicação, abra *Credenciais de produção*. Se pedir, preencha os dados do negócio para ativar. Copie o
   **Access Token**, que começa com `APP_USR-`.
5. Na aplicação, abra *Webhooks → Configurar notificações*:
   - URL de produção: `https://tjaqjirsayclexzaycti.supabase.co/functions/v1/pix-webhook`.
   - Evento: **Pagamentos**.
   - Salve e copie a **assinatura secreta**.
6. **Me mande** o **Access Token** e a **assinatura secreta**.
   - Eu guardo as duas no servidor. Elas não ficam no app nem no GitHub.
   - Depois faço um depósito de teste de R$ 5 com você.

**Saque automático (depois, se quiser):** o Mercado Pago não oferece envio de Pix pela API para a maioria das
contas. Quando o volume crescer, dá para ligar os saques automáticos pelo **Asaas** ou pelo **Efí Bank**, que
mandam Pix pela API. Me avise que eu integro.

## 5. Configurar a plataforma no app · 5 min

1. Instale o **BattleHub-2.4.0.apk** no seu celular (por cima do anterior, sem desinstalar).
2. Painel admin → *Configurações*:
   - Coloque a **chave Pix da plataforma**, o nome e a cidade (usados no Pix manual).
   - Confira a **parte da plataforma**: padrão 10% da arrecadação das salas dos organizadores.
   - Confira o **piso** (padrão 50%) e o **teto** (padrão 70%) da premiação:
     - com a sala cheia, prêmios e mecânicas somados ficam entre o piso e o teto da arrecadação;
     - o resto fica para o organizador e para a plataforma;
     - exemplo: 10 × R$ 10 = R$ 100, os jogadores podem receber até R$ 70;
     - na criação da sala, o app mostra quanto ainda cabe, trava as mecânicas que não cabem e tem o quadradinho
       **Sortear mecânicas**.
   - Revise o **evento do dia** de cada dia da semana.
3. Painel → *Usuários*: dê a permissão **"Pode criar salas"** para os organizadores. Se quiser, combine uma
   taxa diferente para cada um.
4. Crie as **salas oficiais** (botão + → modelo Base, Intermediária, Elite, Domínio ou Ancestral) e os
   **eventos** (painel → Eventos → Novo evento → Liga Semanal, Champions Series, Intensivo de Lines…).
5. Painel → *Loja*: os itens novos (banners animados, arte estilo anime, chapéus e fundos animados) já estão à
   venda. Dá para mudar preço, desativar ou criar outros.

## 5.1 Moderação e anti-trapaça · como usar

**Fotos e bio**
- Painel → **Fotos de perfil**: aprove ou recuse as fotos novas. Até lá, os outros veem a foto anterior.
- Painel → Usuários → Gerenciar conta → **Foto e bio**: apague a bio ou tire a foto de alguém.
- Painel → Configurações → **Palavras proibidas**: acrescente ou tire palavras (uma por linha).

**Suspeita de hack**
1. Abra a sala, toque no jogador e em **Chamar para análise** (ou pelo botão na denúncia). Escreva o motivo.
   - O jogador recebe o aviso e uma mensagem sua no chat de salas.
   - Os saques dele ficam pausados e ele não consegue excluir a conta.
   - Ele tem 24 horas para mandar o vídeo.
2. Painel → **Análise de partida** → toque no caso.
   - **Ligar (voz e tela)**: cria uma sala no Jitsi Meet e manda o link para o jogador. Na primeira vez, o Jitsi pede
     para você entrar com uma conta Google. O jogador compartilha a tela pelo app do Jitsi.
   - **Vídeo**: o que ele mandou pelo app abre ali. Se ele mandou link, baixe o vídeo e toque em **Abrir vídeo do
     celular**.
   - **Ler killfeed**: escolha o lado da tela onde aparece o killfeed (ou marque com o dedo) e toque em **Ler
     killfeed**. O app acha quem o suspeito matou e sugere os prejudicados.
     - Na primeira vez, baixa cerca de 7 MB. Um vídeo de 10 minutos leva alguns minutos para ler.
     - Toque num nome para o vídeo pular para aquele momento e confira.
3. Confira a lista de **Prejudicados** e toque em **Salvar prejudicados**.
4. Resultado:
   - **Sem trapaça**: os saques voltam ao normal.
   - **Confirmar trapaça** (só admin e dono). Escolha quem recebe a inscrição de volta: os prejudicados ou todos da
     sala. Depois disso:
     - o saldo inteiro do trapaceiro fica retido e os saques pendentes dele são recusados;
     - a conta é banida para sempre;
     - o ID do Free Fire, as chaves Pix e o aparelho vão para a lista **Bloqueios**. Conta nova com eles é
       barrada.

A devolução sai da plataforma: o saldo retido do trapaceiro normalmente cobre, mas se ele já tinha sacado, a
diferença fica com você.

Vídeos pelo app vão até **50 MB** (limite do plano grátis do Supabase). No plano Pro dá para subir o limite.

## 6. Play Store · 1 a 3 dias (a análise do Google demora)

1. Crie a conta de desenvolvedor em **play.google.com/console**. A taxa é de **US$ 25**, paga uma vez só.
   - Use conta de **organização** (CNPJ): conta pessoal nova precisa de 12 testadores por 14 dias antes de
     publicar.
   - Organização também passa mais confiança num app com dinheiro.
2. **Publique a política de privacidade** num endereço público. O arquivo pronto é `loja/politica-de-privacidade.html`.
   - Opção grátis: no GitHub, *Settings → Pages → Branch: main, pasta /battlehub/loja*.
   - Ou me peça que eu monto a página.
3. Crie o app no Console:
   - Nome **BattleHub: Salas e Eventos**.
   - Idioma: português (Brasil).
   - Tipo: jogo.
   - Grátis.
4. Envie o arquivo **`BattleHub-2.4.0.aab`** em *Testes → Teste interno* primeiro. Depois vá para *Produção*.
5. Preencha a ficha com os textos de `loja/descricao.md` e as imagens da pasta `loja/` (ícone, destaque e as 8
   telas novas em preto e dourado).
6. Preencha os formulários:
   - **Segurança dos dados**: as respostas estão em `loja/descricao.md`.
   - **Classificação de conteúdo**.
   - **Público-alvo**: 18+.
   - **Exclusão de conta**: o app tem o botão "Excluir minha conta" no perfil. Informe também o e-mail de
     suporte para pedidos pela web.
7. **Guarde a chave de assinatura** que eu te mandei (`battlehub-upload.jks` + `SENHA-DA-CHAVE.txt`):
   - Faça cópia no Google Drive e num pendrive.
   - Sem ela você não consegue atualizar o app.
   - No Console, deixe ativada a "Assinatura de apps do Google Play".

## 7. Atenção antes de lançar (importante)

- **Dinheiro real na Play Store**:
  - O Google tem regras próprias para apps com **inscrição paga e prêmio em dinheiro** ("Jogos, concursos e
    torneios com dinheiro real").
  - Em alguns países esse tipo de app só entra com autorização prévia, e o Google pode pedir documentos da
    empresa ou recusar o app.
  - Leia a política atual no Console antes de enviar.
  - Se houver problema, o mesmo app pode ser distribuído por APK direto no seu site enquanto isso.
- **Jurídico**:
  - Converse com um advogado sobre torneios com premiação no Brasil: competição de habilidade × aposta,
    emissão de nota, impostos sobre prêmios e sobre a receita.
  - Os **termos de uso** (`loja/termos-de-uso.md`) e a **política de privacidade** são modelos para ele revisar.
- **Garena**: o app diz que não é afiliado à Garena. Não use logos nem artes oficiais do Free Fire na loja.
  - As artes da loja do app (estilo anime, chapéus, fundos) foram desenhadas do zero, sem imagens de terceiros.
- **Saques**:
  - Você paga pelo app do banco e marca "pago" no painel.
  - Guarde os comprovantes.
  - Recuse saques de chaves Pix em nome de outra pessoa.

---

## Resumo do que me mandar

| Passo | O que me mandar |
|---|---|
| 4 | Access Token e assinatura secreta do Mercado Pago |
| 3 | (opcional) ID do cliente e chave secreta do Google |
