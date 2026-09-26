// Testa as conversas protegidas: texto criptografado, foto e áudio, acesso excepcional da equipe e registro de acesso.
// Uso: tests/reset.sh e depois  node supabase/tests/chat.test.js
const H = require('./_util')();
const { db, call, svc, as, ok, must, refuse, q1, count, mk, onboard } = H;

H.run(async () => {
  const dono = await mk('dono@bh.gg'), admin = await mk('admin@bh.gg'), mod = await mk('mod@bh.gg');
  const A = await mk('a@bh.gg'), B = await mk('b@bh.gg'), C = await mk('c@bh.gg');
  for (const [id, n] of [[dono, 'Dono'], [admin, 'Admin'], [mod, 'Mod'], [A, 'Alfa'], [B, 'Bravo'], [C, 'Charlie']]) await onboard(id, n);
  await call(dono, 'admin_set_role', { p_user: admin, p_role: 'admin' });
  await call(dono, 'admin_set_role', { p_user: mod, p_role: 'moderador' });

  // ---------------- texto criptografado
  const th = (await call(A, 'open_thread', { p_user: B })).thread_id;
  await must('manda mensagem', call(A, 'send_message', { p_thread: th, p_body: 'senha da sala é 4455, não conta pra ninguém' }));
  const raw = await q1('select body, body_enc, encode(body_enc, $2) hex from messages where thread_id = $1', [th, 'escape']);
  ok(raw.body === '' && raw.body_enc, 'texto não fica aberto na tabela', raw.body);
  ok(!/4455|senha/.test(raw.hex), 'o texto guardado é embaralhado');
  const tm = await must('B lê a conversa', call(B, 'thread_messages', { p_thread: th }));
  ok(tm && tm.messages[0].body === 'senha da sala é 4455, não conta pra ninguém', 'quem recebe lê o texto', tm && tm.messages[0]);
  const list = await must('lista de conversas', call(B, 'my_threads', { p_kind: 'privado' }));
  ok(list && list[0].last.body.startsWith('senha da sala'), 'prévia na lista de conversas');
  const pv = await must('prévia do balão', call(B, 'message_preview', { p_id: tm.messages[0].id }));
  ok(pv && pv.body.includes('4455'), 'prévia do balão no topo');
  await refuse('terceiro não lê a conversa', call(C, 'thread_messages', { p_thread: th }), /não encontrada/);
  await refuse('terceiro não lê a prévia', call(C, 'message_preview', { p_id: tm.messages[0].id }), /não encontrada/);
  await refuse('app não pega a chave', as(A, 'select app.chat_key()'), /permission denied/);
  await refuse('app não lê a tabela da chave', as(A, 'select * from app.chat_secret'), /permission denied/);
  await must('palavrão continua mascarado', call(A, 'send_message', { p_thread: th, p_body: 'seu porra' }));
  const tm2 = await call(B, 'thread_messages', { p_thread: th });
  ok(!/porra/.test(tm2.messages[1].body), 'filtro de palavras antes de criptografar', tm2.messages[1].body);
  await db.query("update messages set body = 'editado' where id = $1", [tm.messages[0].id]);
  ok((await q1('select body from messages where id = $1', [tm.messages[0].id])).body === '', 'texto mudado também é criptografado');
  ok((await q1("select app.msg_text(null, 'antiga', 'x') t")).t === 'antiga', 'mensagem antiga sem criptografia continua legível');

  // ---------------- foto e áudio
  const pa = A + '/' + th + '/a1.webm';
  await must('manda áudio', call(A, 'send_media', { p_thread: th, p_path: pa, p_kind: 'audio', p_ms: 4200 }));
  await must('manda foto', call(A, 'send_media', { p_thread: th, p_path: A + '/' + th + '/f1.jpg', p_kind: 'foto', p_ms: null }));
  await refuse('arquivo na pasta de outra pessoa', call(A, 'send_media', { p_thread: th, p_path: B + '/' + th + '/x.webm', p_kind: 'audio', p_ms: 3000 }), /inválido/);
  await refuse('arquivo de outra conversa', call(A, 'send_media', { p_thread: th, p_path: A + '/' + A + '/x.webm', p_kind: 'audio', p_ms: 3000 }), /inválido/);
  await refuse('caminho com ../', call(A, 'send_media', { p_thread: th, p_path: A + '/' + th + '/../x', p_kind: 'foto', p_ms: null }), /inválido/);
  await refuse('áudio longo demais', call(A, 'send_media', { p_thread: th, p_path: pa, p_kind: 'audio', p_ms: 200000 }), /3 minutos/);
  await refuse('tipo estranho', call(A, 'send_media', { p_thread: th, p_path: pa, p_kind: 'video', p_ms: 1000 }), /inválido/);
  await refuse('quem não é da conversa não manda', call(C, 'send_media', { p_thread: th, p_path: C + '/' + th + '/x.webm', p_kind: 'audio', p_ms: 3000 }), /não encontrada/);
  const tm3 = await call(B, 'thread_messages', { p_thread: th });
  const au = tm3.messages.find((m) => m.media_kind === 'audio');
  ok(au && au.media_path === pa && au.audio_ms === 4200, 'áudio aparece na conversa', au);
  const l2 = await call(B, 'my_threads', { p_kind: 'privado' });
  ok(l2[0].last.image === true, 'lista mostra "foto" na última');
  ok(await call(A, 'thread_messages', { p_thread: th }).then((t) => t.more === false), 'sem mensagens anteriores para carregar');
  ok((await q1('select app.chat_can_read($1, $2) v', [th, B])).v === true && (await q1('select app.chat_can_read($1, $2) v', [th, C])).v === false, 'arquivo: só quem está na conversa abre');

  // ---------------- notificação lê o texto pela service_role
  const ids = (await db.query('select id from messages where thread_id = $1 order by id', [th])).rows.map((r) => Number(r.id));
  await refuse('app não usa a função da notificação', call(A, 'svc_message_previews', { p_ids: ids }), /permission denied/);
  const sp = await must('service_role lê as prévias', svc('svc_message_previews', { p_ids: ids }));
  ok(sp && sp.length === ids.length && sp.some((x) => x.media_kind === 'audio') && sp.some((x) => x.body.includes('4455') || x.body === 'editado') && sp[0].sender_nick === 'Alfa', 'prévias com texto, tipo e nick', sp && sp[0]);

  // ---------------- acesso excepcional
  const tAdm = (await call(C, 'open_thread', { p_user: admin })).thread_id;
  await call(C, 'send_message', { p_thread: tAdm, p_body: 'oi admin' });
  const ut = await must('moderador vê as conversas de A (sem conteúdo)', call(mod, 'admin_user_threads', { p_user: A }));
  ok(ut && ut.length === 1 && ut[0].count === 4 && !JSON.stringify(ut).includes('4455'), 'lista sem o texto', ut);
  await refuse('jogador não lista conversas alheias', call(C, 'admin_user_threads', { p_user: A }), /permissão/);
  await refuse('ler sem abrir antes', call(mod, 'admin_chat_read', { p_thread: th }), /Abra a conversa/);
  await refuse('motivo curto', call(mod, 'admin_chat_open', { p_thread: th, p_kind: 'denuncia', p_reference: '', p_reason: 'ver' }), /15 letras/);
  await refuse('moderador sem denúncia', call(mod, 'admin_chat_open', { p_thread: th, p_kind: 'denuncia', p_reference: '', p_reason: 'quero conferir essa conversa aqui' }), /Não há denúncia/);
  await refuse('moderador por ordem judicial', call(mod, 'admin_chat_open', { p_thread: th, p_kind: 'ordem_judicial', p_reference: '0001234-56.2026', p_reason: 'ofício recebido do juízo' }), /Só o dono/);
  await refuse('moderador por segurança', call(mod, 'admin_chat_open', { p_thread: th, p_kind: 'seguranca', p_reference: '', p_reason: 'suspeita de golpe entre eles' }), /admin ou dono/);
  await call(B, 'report_player', { p_user: A, p_room: null, p_reason: 'golpe', p_detail: 'pediu Pix fora do app' });
  const op = await must('moderador abre com denúncia', call(mod, 'admin_chat_open', { p_thread: th, p_kind: 'denuncia', p_reference: '', p_reason: 'denúncia de golpe: pediu Pix fora do app' }));
  ok(op && new Date(op.expires_at) - Date.now() > 23 * 3600e3, 'acesso vale 24 horas');
  const rd = await must('moderador lê', call(mod, 'admin_chat_read', { p_thread: th }));
  ok(rd && rd.messages.length === 4 && rd.messages.some((m) => m.body === 'editado') && rd.a.nick && rd.b.nick, 'moderação lê o texto com o acesso aberto', rd && rd.messages.length);
  ok((await q1('select app.chat_can_read($1, $2) v', [th, mod])).v === true, 'moderação abre os arquivos com o acesso aberto');
  ok(await count("select count(*) n from audit_log where action like 'Abriu conversa%'") === 1, 'acesso fica na auditoria');
  await refuse('moderador não abre conversa com admin', call(mod, 'admin_chat_open', { p_thread: tAdm, p_kind: 'denuncia', p_reference: '', p_reason: 'denúncia contra o jogador Charlie' }), /cargo igual ou maior/);
  await refuse('app não lê o registro de acessos', as(mod, 'select count(*) from chat_access').then((r) => { if (Number(r.rows[0].count)) throw new Error('leu'); throw new Error('bloqueado'); }), /bloqueado|permission/);
  await refuse('ninguém apaga o registro de acessos', as(dono, 'delete from chat_access').then((r) => { if (r.rowCount) throw new Error('apagou'); throw new Error('bloqueado'); }), /bloqueado|permission/);
  await refuse('moderador não exporta', call(mod, 'admin_chat_export', { p_thread: th }), /permissão/);
  await refuse('dono precisa abrir antes de exportar', call(dono, 'admin_chat_export', { p_thread: th }), /Abra a conversa/);
  await refuse('ordem judicial sem número', call(dono, 'admin_chat_open', { p_thread: th, p_kind: 'ordem_judicial', p_reference: '', p_reason: 'ofício recebido do juízo da comarca' }), /número/);
  await must('dono abre por ordem judicial', call(dono, 'admin_chat_open', { p_thread: th, p_kind: 'ordem_judicial', p_reference: 'Proc. 0001234-56.2026.8.26.0100', p_reason: 'ofício recebido do juízo da comarca' }));
  const ex = await must('dono exporta', call(dono, 'admin_chat_export', { p_thread: th }));
  ok(ex && /Alfa #\d+: editado/.test(ex.text) && /áudio 4s/.test(ex.text) && ex.sha256.length === 64 && /Proc\. 0001234/.test(ex.text) && /a@bh\.gg/.test(ex.text), 'exportação completa com resumo', ex && ex.text.slice(0, 400));
  ok(await count('select count(*) n from chat_access where exported_at is not null') === 1, 'exportação registrada');
  const log = await must('admin vê quem abriu', call(admin, 'admin_chat_access_log', {}));
  ok(log && log.length === 2 && log.some((x) => x.kind === 'ordem_judicial'), 'registro de acessos lista os dois');
  await refuse('moderador não vê o registro de acessos', call(mod, 'admin_chat_access_log', {}), /permissão/);
  await db.query("update chat_access set expires_at = now() - interval '1 minute' where by_id = $1", [mod]);
  await refuse('acesso vencido', call(mod, 'admin_chat_read', { p_thread: th }), /Abra a conversa/);
  ok((await q1('select app.chat_can_read($1, $2) v', [th, mod])).v === false, 'arquivos fecham quando o acesso vence');

  // ---------------- registro de acesso (Marco Civil)
  await db.query("insert into access_log (user_id, ip, created_at) values ($1, '1.2.3.4', now() - interval '8 months')", [A]);
  await must('app abre e manda o aparelho', call(A, 'set_device', { p_device: 'and:abc123' }));
  const al = await must('admin vê os acessos', call(admin, 'admin_access_log', { p_user: A }));
  ok(al && al.length === 1 && al[0].device === 'and:abc123', 'acesso gravado e o antigo (8 meses) apagado', al);
  await refuse('moderador não vê IPs', call(mod, 'admin_access_log', { p_user: A }), /permissão/);
  await refuse('app não lê access_log direto', as(A, 'select count(*) from access_log').then((r) => { if (Number(r.rows[0].count)) throw new Error('leu'); throw new Error('bloqueado'); }), /bloqueado|permission/);
});
