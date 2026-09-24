# BattleHub (app Android)

App de torneios para jogadores de Free Fire: inscrição com saldo, carteira Pix, ranking, guildas, chat e painel administrativo completo. Feito em HTML, CSS e JavaScript e empacotado como app Android nativo com [Capacitor 8](https://capacitorjs.com). Mira o Android 16 (API 36), o nível exigido para apps novos na Play Store.

## Instalar no celular agora

1. Baixe o `BattleHub-1.0.0.apk` (enviado na conversa ou gerado pelo GitHub Actions, veja abaixo).
2. Abra o arquivo no Android e permita "instalar apps desta fonte" quando o celular pedir.
3. Abra o BattleHub. Você entra como **SHADOW lock (dono)**, com acesso ao painel admin em Perfil → Painel administrativo.

Para testar como jogador comum: Perfil → Sair → "Jogadora · Luna.ff".

## Publicar na Play Store

O arquivo para a loja é o **`.aab`** (Android App Bundle), assinado com a chave de upload.

1. Crie a conta em <https://play.google.com/console> (taxa única de US$ 25).
2. **Criar app** → nome BattleHub, idioma português (Brasil), tipo App, gratuito.
3. **Testar e lançar → Teste interno → Criar versão** → envie o `.aab`. Aceite a *Assinatura de apps do Google Play*.
4. Preencha a **Ficha da loja** com os textos de `loja/descricao.md` e as imagens de `loja/`:
   - ícone `icone-512.png`, recurso gráfico `banner-1024x500.png`
   - capturas `tela-1-inicio.png` a `tela-5-admin.png`
5. Preencha **Conteúdo do app**: política de privacidade (modelo em `loja/politica-de-privacidade.md`, publique numa página pública e cole o link), segurança de dados, classificação etária e público-alvo.
6. Contas pessoais criadas depois de novembro de 2023 precisam de um **teste fechado com pelo menos 12 testadores por 14 dias seguidos** antes de liberar a produção.

## Antes de abrir para o público

Esta versão é completa nas telas e nas regras, mas **os dados ficam só no celular de cada pessoa** (armazenamento local). Isso serve para testar e apresentar o app. Para jogadores reais se enfrentarem, faltam:

- **Servidor e banco de dados**: contas com login real, torneios, chat e ranking compartilhados. As funções em `www/js/store.js` (`BH.act`) são o ponto de troca: cada uma vira uma chamada à API (Supabase ou Firebase são os caminhos mais rápidos).
- **Pix de verdade**: um intermediador de pagamento (Mercado Pago, Efí, Asaas) para gerar o QR, confirmar o depósito sozinho e pagar os saques. Hoje o QR é de demonstração e o admin confirma à mão.
- **Política de jogos com dinheiro real do Google Play**: torneios com inscrição paga e prêmio em dinheiro, e principalmente o modo **X1 apostado**, contam como jogos com dinheiro real. O Google só aceita esse tipo de app com licença e autorização prévia. Para a primeira versão na loja, o caminho mais seguro é tirar o X1 apostado e deixar os torneios gratuitos com prêmio pago pela plataforma ou por patrocinadores. Consulte um advogado antes de cobrar inscrição.
- **Marca Free Fire**: não use "Free Fire" no nome nem no ícone do app. Na descrição, deixe claro que o BattleHub não é afiliado à Garena.

## Gerar uma versão nova

**Pelo GitHub (sem computador):** cada alteração em `battlehub/` roda o fluxo **BattleHub Android** (aba Actions do repositório). O APK e o AAB ficam em *Artifacts* no fim da execução. O número da versão sobe sozinho a cada execução.

Para o GitHub assinar a versão de loja, cadastre em *Settings → Secrets and variables → Actions*:

| Segredo | Valor |
|---|---|
| `BATTLEHUB_KEYSTORE_BASE64` | o arquivo `battlehub-upload.jks` em base64 (`base64 -w0 battlehub-upload.jks`) |
| `BATTLEHUB_KEYSTORE_PASSWORD` | a senha da chave |
| `BATTLEHUB_KEY_ALIAS` | `battlehub` |
| `BATTLEHUB_KEY_PASSWORD` | a senha da chave |

Sem esses segredos, o GitHub gera só o APK de teste (debug).

**No computador** (Node 22, Java 21 e Android SDK):

```bash
cd battlehub
npm install
npm run apk     # APK de teste
npm run aab     # AAB assinado (precisa de android/keystore.properties)
```

O `android/keystore.properties` fica fora do git e tem este formato:

```
storeFile=/caminho/battlehub-upload.jks
storePassword=SENHA
keyAlias=battlehub
keyPassword=SENHA
```

## Chave de assinatura

A `battlehub-upload.jks` assina todas as versões enviadas à Play Store. **Guarde o arquivo e a senha em dois lugares seguros** (por exemplo, Google Drive e um pendrive). Nunca coloque a chave no repositório. Se ela for perdida, dá para pedir a troca da chave de upload no Play Console, mas o processo leva dias.

## Testar no navegador

```bash
cd battlehub && npm run web
```

Abra <http://localhost:8080>. Atalhos: `#admin` abre o painel e `#financeiro` abre o financeiro.

## Estrutura

| Caminho | O que é |
|---|---|
| `www/index.html` | Página do app |
| `www/css/app.css` | Visual, navegação líquida e animações |
| `www/js/store.js` | Dados de exemplo e todas as regras (inscrição, prêmios, carteira, admin) |
| `www/js/screens.js` | Telas do jogador |
| `www/js/admin.js` | Painel administrativo |
| `www/js/nav.js` | Barra de navegação líquida |
| `www/js/ui.js` | Componentes: janelas, avisos, gráficos, confete |
| `www/js/app.js` | Navegação entre telas e botão Voltar do Android |
| `www/fonts/` | Fontes embutidas (funciona sem internet) |
| `android/` | Projeto Android nativo gerado pelo Capacitor |
| `assets/` | Ícone e abertura em alta resolução (fonte dos ícones do Android) |
| `loja/` | Imagens e textos para a página da Play Store |

Depois de mudar ícone ou abertura em `assets/`, rode `npm run icons`.

## O que o painel admin faz

- **Visão geral**: pendências, usuários, torneios ativos, depósitos e receita, gráfico de entradas e saídas de 14 dias, jogadores por tier e atividade recente.
- **Usuários**: busca por ID, nick, e-mail ou ID do Free Fire; cargo (jogador, moderador, admin), verificação, ajuste de saldo e ELO, notificação individual, banimento e exclusão.
- **Torneios**: criar, editar, iniciar (libera ID e senha da sala para os inscritos), finalizar escolhendo os vencedores (prêmio vai direto para a carteira e a taxa para a plataforma), destacar, cancelar com reembolso e excluir.
- **Financeiro**: entrou, saiu, líquido e receita; confirmar ou recusar depósitos; pagar ou recusar saques (recusa devolve o saldo); histórico com filtros.
- **Verificações**: print do perfil do Free Fire com os dados informados; aprovar ou recusar com motivo.
- **Denúncias**: advertir, banir ou descartar.
- **Guildas**: abrir e fechar recrutamento, dissolver.
- **Avisos**: enviar para todos, verificados ou equipe, com opção de fixar no início.
- **Configurações**: taxa da plataforma, limites de depósito e saque, chave Pix, criação de torneios por jogadores e modo manutenção.
- **Auditoria**: registro de todas as ações do painel.

Moderadores veem usuários, torneios, verificações, denúncias e guildas. Financeiro, avisos, configurações e auditoria são só de admin e dono.
