# Pagamento automático: qual gateway usar

Pesquisa de setembro de 2026. O objetivo é um serviço que **receba o Pix do jogador, guarde o dinheiro até a sala terminar
e pague sozinho** o prêmio ou o saque, sem você precisar abrir o app do banco.

## Recomendação: Asaas (conta de empresa)

O Asaas faz as três coisas na mesma conta:

1. **Recebe** o depósito por Pix (QR Code gerado pela API) e avisa o servidor quando cai (webhook).
2. **Guarda** o dinheiro na conta do BattleHub. O app já controla quanto é de cada jogador e quanto está no cofre de cada
   sala; o dinheiro de verdade fica todo na conta Asaas.
3. **Paga** por API: quando a sala termina ou o jogador pede saque, o servidor manda o Asaas fazer um Pix para a chave do
   jogador (`POST /v3/transfers` com `pixAddressKey`).

Dois recursos do Asaas que ajudam na segurança:

- **Validação de saque por webhook**: antes de cada transferência, o Asaas pergunta ao nosso servidor se ela é legítima.
  Se alguém roubar a chave da API, não consegue sacar sem passar por essa conferência.
- **Conta Escrow** (custódia): segura valores de uma subconta até uma condição ser cumprida. Serve para uma fase 2, se
  cada organizador tiver subconta própria e só receber a parte dele depois que a sala terminar.

Custos informados pelo Asaas:

- Pix recebido: R$ 0,99 por cobrança nos 3 primeiros meses, depois R$ 1,99.
- Pix enviado: as 100 primeiras transferências do mês são grátis; a partir da 101ª há tarifa.

## Comparação

| Serviço | Recebe Pix | Envia Pix pela API | Pontos fortes | Pontos de atenção |
|---|---|---|---|---|
| **Asaas** | Sim | Sim | Recebe e paga na mesma conta, 100 Pix enviados grátis por mês, validação de saque por webhook, Conta Escrow | Tarifa por Pix recebido; conta PJ |
| **Efí Bank** (antiga Gerencianet) | Sim | Sim | Confere se a chave Pix é do CPF informado antes de enviar (bom contra saque para chave de outra pessoa) | Tarifa por Pix enviado; conta PJ |
| **Stark Bank** | Sim | Sim | API robusta para alto volume | Voltado para empresas maiores |
| **Transfeera** | Sim | Sim | Pagamentos em lote e split | Mais focado em pagamentos que em cobrança |
| **Celcoin** | Sim | Sim | Infraestrutura completa | Cerca de R$ 2.000 por mês só pelo acesso à API |
| **Mercado Pago** (o que está ligado hoje) | Sim | Limitado | Já integrado para depósitos | Envio de Pix pela API não está liberado para a maioria das contas; por isso o saque hoje é manual |

Quase todos exigem **CNPJ**. Desde setembro de 2024, envio de Pix pela API só pode ser feito para chave Pix (regra do
Banco Central).

## Como ficaria no BattleHub

```
Jogador deposita (Pix) ──► Asaas ──webhook──► carteira do jogador no app
Inscrição na sala      ──► cofre da sala (controle no banco do app)
Sala finalizada        ──► prêmios caem na carteira de cada vencedor
Saque (ou "receber prêmio direto no Pix")
   ├─ regras ok ────────► servidor pede ao Asaas ──► Asaas confere com o servidor (webhook) ──► Pix enviado
   └─ acima do limite ──► fica na fila do painel para a equipe aprovar
```

Regras para o saque sair sozinho (ajustáveis no painel):

- ID do Free Fire verificado e nenhuma análise de partida aberta;
- chave Pix no **CPF do próprio jogador** (a mesma que já é exigida hoje);
- até um valor por saque (ex.: R$ 200) e um total por dia (ex.: R$ 500) por jogador;
- conta com pelo menos alguns dias de uso;
- acima disso, a equipe aprova no painel, como hoje.

A opção **"Receber prêmio direto no Pix"** no perfil faria o saque automático do prêmio assim que a sala termina.

## Antes de ligar (importante)

- **Jurídico**: guardar saldo de jogadores e pagar prêmios em dinheiro precisa de parecer de advogado e contador. A Lei
  14.790/2023 regula apostas de quota fixa. Torneio em que o resultado depende da habilidade é diferente de aposta, mas
  o enquadramento do BattleHub precisa ser confirmado. A regulamentação de 2026 cita torneios de e-sports com
  autorização do dono do jogo; no caso do Free Fire, a Garena.
- **Impostos**: imposto sobre prêmios pagos e sobre a receita da plataforma.
- **Termos de uso**: já avisam que saques são conferidos e podem ser recusados. Com o saque automático, entra também o
  limite automático.

## O que você precisa fazer

1. Abrir uma conta **PJ no Asaas** (asaas.com) e pedir acesso à API.
2. Criar uma chave de API no **ambiente de testes (sandbox)** primeiro.
3. **Me mandar** a chave do sandbox. Eu ligo:
   - o depósito pelo Asaas;
   - o saque automático com os limites acima;
   - o webhook de validação;
   - a opção "receber prêmio direto no Pix".
4. Depois dos testes, você cria a chave de produção e a gente troca.

## Fontes

- [Asaas: transferir para chave Pix (API)](https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix)
- [Asaas: validação de saque por webhook](https://docs.asaas.com/docs/mecanismo-para-validacao-de-saque-via-webhooks)
- [Asaas: Conta Escrow](https://docs.asaas.com/docs/introducao-conta-escrow)
- [Asaas: taxas do Pix](https://central.ajuda.asaas.com/hc/pt-br/articles/32040230167067-Quais-s%C3%A3o-as-taxas-para-utilizar-as-transfer%C3%AAncias-Pix)
- [Asaas: preços e taxas](https://www.asaas.com/precos-e-taxas)
- [Efí Bank: envio de Pix pela API](https://dev.efipay.com.br/en/docs/api-pix/envio-pagamento-pix/)
- [Efí Bank: taxa do Pix para empresas](https://sejaefi.com.br/blog/qual-custo-do-pix)
- [Banco Central (discussão pública): lista de PSPs com API de envio de Pix](https://github.com/bacen/pix-api/discussions/480)
- [Celcoin: alternativas de API Pix](https://celcoin.com.br/articles/melhores-alternativas-api-pix-brasil/)
- [Ministério da Fazenda: modalidades de apostas regulamentadas (2026)](https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/abril/governo-regulamenta-modalidades-que-podem-ser-objeto-de-apostas-de-quota-fixa-em-eventos-esportivos)
- [Lei das Bets (14.790/2023)](https://pt.wikipedia.org/wiki/Lei_das_Bets)
