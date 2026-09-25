# O que você precisa fazer para o BattleHub funcionar

O app, o banco, as regras de dinheiro, os eventos e o painel estão prontos e testados. O que falta são as
contas nos serviços, que só você pode criar (elas ficam no seu nome e no seu CPF/CNPJ). Faça **na ordem**:
cada passo usa algo do anterior. Onde está escrito **"me mande"**, cole a informação no chat que eu conecto.

> **Nunca poste as chaves em lugar público.** Mande só aqui no chat ou coloque direto no arquivo
> `scripts/conexao.env` (ele não vai para o GitHub).

---

## 1. Supabase: o servidor (grátis para começar) · 10 min

1. Crie a conta em **supabase.com** (dá para entrar com o GitHub).
2. **New project**:
   - Nome: `battlehub`.
   - Região: **South America (São Paulo)**.
   - Crie uma **senha do banco** forte e guarde (fica só com você).
3. Espere o projeto ficar pronto (uns 2 minutos).
4. **Me mande**:
   - O **Reference ID**: *Project Settings → General*. São umas 20 letras, por exemplo `abcdefghijklmnopqrst`.
   - Um **Access Token**: clique no seu avatar (canto de baixo à esquerda) → *Access Tokens* → *Generate new token*.

Com isso eu rodo o `scripts/configurar.sh`, que:
- cria as tabelas, as regras de dinheiro e os lugares das fotos;
- publica as funções do Pix;
- liga o login por código no e-mail;
- gera o app apontando para o seu servidor.

## 2. Login com Google · 15 min

1. Entre em **console.cloud.google.com** com a conta Google da empresa e crie um projeto chamado `BattleHub`.
2. Vá em *APIs e serviços → Tela de consentimento OAuth*:
   - Tipo: **Externo**.
   - Preencha o nome **BattleHub**, o seu e-mail de suporte e o e-mail de contato.
   - Publique a tela ("Em produção").
3. Vá em *APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth*:
   - Tipo: **Aplicativo da Web**.
   - Em **URIs de redirecionamento autorizados**, coloque `https://SEU-REFERENCE-ID.supabase.co/auth/v1/callback`
     (troque pelo Reference ID do passo 1).
4. **Me mande** o **ID do cliente** e a **Chave secreta do cliente**.

Sem esse passo o app funciona só com o código por e-mail.

## 3. E-mail que manda o código · 10 min (recomendado antes de lançar)

O Supabase manda poucos e-mails por hora no plano grátis, o que dá para testar mas não para lançar.

1. Crie uma conta em **resend.com** (grátis até 3.000 e-mails por mês).
2. Adicione o seu domínio (ex.: `battlehub.com.br`) e siga os registros DNS que eles mostram.
3. Crie uma **API Key**.
4. No Supabase: *Project Settings → Authentication → SMTP Settings → Enable custom SMTP*:

   | Campo | Valor |
   |---|---|
   | Host | `smtp.resend.com` |
   | Porta | `465` |
   | Usuário | `resend` |
   | Senha | a API Key |
   | Remetente | `nao-responda@seudominio` |

   Se preferir, **me mande** a API Key e o domínio que eu te passo o passo a passo exato.

Se ainda não tiver domínio, compre um em **registro.br** (cerca de R$ 40 por ano). Ele também serve para o
site e para o e-mail de suporte que a Play Store pede.

## 4. Pix automático: Mercado Pago · 20 min (opcional no começo)

Sem isso o Pix já funciona no modo **manual**:
- o jogador paga pelo QR Code gerado com a **sua chave Pix**;
- você confere no banco e aperta "Pix recebido" no painel.

Para confirmar sozinho:
1. Crie uma conta **Mercado Pago** (de preferência como **empresa/CNPJ**).
2. Em **mercadopago.com.br/developers**: *Suas integrações → Criar aplicação* (tipo: pagamentos on-line / Checkout
   Transparente).
3. Em *Credenciais de produção*, copie o **Access Token**.
4. Em *Webhooks*:
   - URL de produção: `https://SEU-REFERENCE-ID.supabase.co/functions/v1/pix-webhook`.
   - Evento: **Pagamentos**.
   - Salve e copie a **assinatura secreta**.
5. **Me mande** o **Access Token** e a **assinatura secreta**.

## 5. Configurar a plataforma no app · 5 min

Depois que eu gerar o app conectado:
1. Instale o APK no seu celular e **entre primeiro**. **A primeira conta vira a DONA** (painel admin completo).
2. Painel admin → *Configurações*:
   - Coloque a **chave Pix da plataforma**, o nome e a cidade (usados no Pix manual).
   - Confira a **parte da plataforma** (padrão 10% da arrecadação das salas dos organizadores) e o
     **piso de premiação** (padrão 50%).
   - Revise o **evento do dia** de cada dia da semana.
3. Painel → *Usuários*: dê a permissão **"Pode criar salas"** para os organizadores. Se quiser, combine uma
   taxa diferente para cada um.
4. Crie as **salas oficiais** (botão + → modelo Base, Intermediária, Elite, Domínio ou Ancestral) e os
   **eventos** (painel → Eventos → Novo evento → Liga Semanal, Champions Series, Intensivo de Lines…).

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
4. Envie o arquivo **`BattleHub-2.0.0.aab`** em *Testes → Teste interno* primeiro. Depois vá para *Produção*.
5. Preencha a ficha com os textos de `loja/descricao.md` e as imagens da pasta `loja/`.
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
- **Saques**:
  - Você paga pelo app do banco e marca "pago" no painel.
  - Guarde os comprovantes.
  - Recuse saques de chaves Pix em nome de outra pessoa.

---

## Resumo do que me mandar

| Passo | O que me mandar |
|---|---|
| 1 | Reference ID do Supabase e Access Token |
| 2 | ID do cliente e chave secreta do Google |
| 3 | (opcional) API Key do Resend e o domínio |
| 4 | (opcional) Access Token e assinatura secreta do Mercado Pago |

Assim que eu tiver o passo 1, conecto tudo e te devolvo um APK funcionando online para testar com os seus
amigos.
