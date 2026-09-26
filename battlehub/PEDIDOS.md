# O que você pediu e onde está

Conferência de 26/09/2026. **Já existia** = feito numa versão anterior (2.4.0). **Feito agora** = versão 2.5.0 ou 2.6.0.

| # | Pedido | Situação | Onde fica no app |
|---|---|---|---|
| 1 | Fotos estranhas no perfil | Já existia | A foto nova só aparece depois de aprovada: **Painel → Fotos de perfil**. A equipe também remove foto em Usuários. |
| 2 | Coisas estranhas na bio | Já existia | Palavras proibidas editáveis (**Painel → Configurações**), sem link e sem telefone. A equipe apaga a bio em Usuários. |
| 3 | Banir trapaceiro devolvendo o dinheiro (de todos ou só dos prejudicados) | Já existia | Veredito da **Análise de partida**: escolhe "só os prejudicados" ou "todos da sala". |
| 4 | Análise de partida: vídeo no chat do moderador, ligação de voz e de tela | Já existia | O suspeito manda o vídeo pelo aviso; a mensagem cai no chat de salas do moderador. Ligação pelo **Jitsi Meet** (voz e compartilhar tela). |
| 5 | Resultado da análise: prejudicados recebem, o hack perde o saldo e é banido para sempre | Já existia | Saldo retido, saques recusados, ban permanente e bloqueio do ID do Free Fire, do Pix e do aparelho. |
| 6 | Reconhecer o killfeed no vídeo e separar quem ele matou | Já existia | **Ler killfeed** no caso: acha os nicks da sala e monta a lista separada de prejudicados. |
| 7 | Muito mais customização, mais elaborada = mais cara | **Feito agora** | Loja com **raridade do Free Fire** e preço por raridade: 19 molduras desenhadas, 8 banners com cena, 4 fundos novos, 35+ títulos. |
| 8 | Chat abrindo lá em cima (bug) | **Feito agora** | A conversa abre no fim e continua no fim quando as fotos carregam. |
| 9 | Mandar áudio no chat | **Feito agora** | Botão de microfone quando o campo está vazio. Áudio de até 2 minutos. |
| 10 | Conversa criptografada, mas a moderação pode ver em casos específicos | **Feito agora** | Texto criptografado no banco; a equipe só abre com motivo (denúncia, segurança ou ordem judicial), por 24 horas, com registro. Exportação para a Justiça só pelo dono. **Painel → Acessos a conversas** mostra quem abriu. |
| 11 | "Uma ideia para me prevenir de problemas" | **Feito agora** | Registro de acesso (IP e aparelho) guardado 6 meses, como pede o Marco Civil da Internet. Política de privacidade e termos de uso explicam o acesso às conversas. Detalhes em `LEIA-ME.md`. |
| 12 | Moderador ou organizador jogar a própria sala | **Feito agora** | Botão "quer jogar também?" na sala. Paga a inscrição e recebe o prêmio se ganhar. Todos veem o aviso e fica na auditoria. |
| 13 | Lines dentro da guilda (1 a 4 jogadores, código para entrar) | **Feito agora** | Seção **Lines** na página da guilda: criar, código, membros, vagas e "querem entrar" separado. |
| 14 | Procurar lines recrutando, sem código, com 2 critérios do líder | **Feito agora** | **Guildas → Lines recrutando**: filtro por tamanho, critérios em verde ou vermelho e botão "Pedir para entrar". |
| 15 | Sinergia: line que joga muito junta ganha recompensa (banner, avatar, título) | **Feito agora** | 5 níveis de sinergia: título, banner, moldura, título e moldura lendária para todos da line. |
| 16 | Mais títulos (Sniper, O Bravo, Exterminador...) | **Feito agora** | 35+ títulos à venda e 7 de conquista (chegam sozinhos ao bater a meta). |
| 17 | Gateway que recebe, segura e paga sozinho | **Pesquisado** | Recomendação: **Asaas**. Comparação e custos em `PAGAMENTO-AUTOMATICO.md`. Para ligar, preciso da sua conta (passo 3.2 de `O-QUE-VOCE-PRECISA-FAZER.md`). |
| 18 | Letrinhas miúdas: organizadores podem verificar o aparelho (APK modificado) | **Feito agora** | No aviso do suspeito, com aceite obrigatório para mandar o vídeo, na mensagem que ele recebe e nos termos de uso. |
| 19 | Recusou a verificação = ban permanente, sem criar outra conta, só a administração libera | **Feito agora** | Botão **"Recusou a verificação do aparelho"** no caso (admin ou dono). |
| 20 | Aba de banidos: deixar criar outra conta, voltar para esta conta, reativar | **Feito agora** | **Painel → Banidos**, com os três botões e o histórico de liberações. |
| — | Notificação no celular com o app fechado | **Feito agora** (2.5.0) | Precisa do Firebase (passo 3.1). |

## O que ainda depende de você

1. **Access Token do Supabase**, para eu publicar a atualização do servidor. Sem isso, as versões 2.5.0 e 2.6.0 não
   funcionam por completo.
2. **Firebase** (passo 3.1), para a notificação no celular.
3. **Asaas** (passo 3.2), se quiser o saque automático.
4. **Advogado e contador** antes de lançar com dinheiro real (item 7 de `O-QUE-VOCE-PRECISA-FAZER.md`).
