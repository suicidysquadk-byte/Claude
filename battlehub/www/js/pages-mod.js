/* Moderação: fotos de perfil, análise de partida (suspeita de hack) e leitura do killfeed */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, st = BH.state;
  const app = () => BH.app;
  const A = BH.admin;
  const sa = st.adm;
  sa.caseTab = sa.caseTab || 'abertas';
  const MAX_VIDEO = 50 * 1024 * 1024;
  const STATUS = { aguardando_video: ['Esperando o vídeo', 'gold'], em_analise: ['Em análise', 'violet'], confirmado: ['Trapaça confirmada', 'red'], descartado: ['Sem trapaça', 'green'], recusado: ['Recusou a verificação', 'red'] };
  const statusTag = (s) => '<span class="tag tone-' + STATUS[s][1] + '">' + esc(STATUS[s][0]) + '</span>';
  const refreshMe = async () => { try { await api.refreshMe(); app().header(); } catch (e) { /* segue */ } };

  /* ================= FOTOS DE PERFIL ================= */
  A.SECTION.photos = async function () {
    const list = await api.rpc('admin_photo_queue');
    return {
      html: '<p class="muted small">Foto nova só aparece para os outros depois de aprovada. Recuse nudez, violência, ofensa, golpe, propaganda ou foto de outra pessoa.</p>' +
        (list.length ? '<div class="ph-grid stagger">' + list.map((x) => '<article class="ph-item">' +
          '<button type="button" class="ph-shot" data-act="viewImage" data-v="' + esc(x.pending_url) + '"><img src="' + esc(x.pending_url) + '" alt="Foto nova de ' + esc(x.user.nick) + '" loading="lazy"><span>' + I('eye') + 'Ampliar</span></button>' +
          '<div class="ph-info">' + A.ucell(x.user, 'Enviou ' + U.ago(x.since)) + (x.bio ? '<p class="ph-bio">' + esc(x.bio) + '</p>' : '') +
          '<div class="btn-row"><button type="button" class="btn green sm" data-act="aPhoto" data-ok="1" data-id="' + x.user.id + '">' + I('check') + 'Aprovar</button>' +
          '<button type="button" class="btn danger-ghost sm" data-act="aPhoto" data-ok="0" data-id="' + x.user.id + '">' + I('x') + 'Recusar</button></div></div></article>').join('') + '</div>'
          : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhuma foto esperando</small></div>')
    };
  };
  actions.aPhoto = async function (el) {
    const ok = el.dataset.ok === '1';
    let note = null;
    if (!ok) {
      const r = await U.confirm({ title: 'Recusar foto?', body: 'O jogador recebe o motivo e continua com a foto anterior.', ok: 'Recusar', danger: true,
        select: { label: 'Motivo', options: [['Nudez ou conteúdo sexual', 'Nudez ou conteúdo sexual'], ['Violência ou ofensa', 'Violência ou ofensa'], ['Propaganda ou golpe', 'Propaganda ou golpe'], ['Foto de outra pessoa', 'Foto de outra pessoa'], ['Foto imprópria', 'Outro motivo']] },
        input: { label: 'Detalhe (opcional)', placeholder: 'Ex.: logo de site de aposta' } });
      if (!r) return;
      note = r.text ? r.value + ': ' + r.text : r.value;
    }
    if (await U.run(el, () => api.rpc('admin_photo_review', { p_user: el.dataset.id, p_approve: ok, p_note: note }), ok ? 'Foto aprovada.' : 'Foto recusada.')) A.refresh();
  };

  // na conta do jogador: apagar bio ou tirar a foto
  actions.aModerate = async function (el) {
    const bio = el.dataset.v === 'bio';
    const reason = await U.confirm({ title: bio ? 'Apagar a bio?' : 'Remover a foto?', body: 'O jogador é avisado com o motivo.', ok: bio ? 'Apagar bio' : 'Remover foto', danger: true,
      input: { label: 'Motivo', placeholder: bio ? 'Ex.: ofensa, link de golpe' : 'Ex.: nudez', required: true, error: 'Escreva o motivo.' } });
    if (!reason) return;
    if (await U.run(el, () => api.rpc('admin_user_moderate', { p_user: el.dataset.id, p_action: el.dataset.v, p_reason: reason }), bio ? 'Bio apagada.' : 'Foto removida.')) A.again();
  };

  /* ================= ANÁLISE DE PARTIDA (equipe) ================= */
  A.SECTION.cases = async function () {
    const pend = api.me.admin_pending || {};
    const tabs = [{ id: 'abertas', label: 'Abertas', badge: pend.cases }, { id: 'confirmado', label: 'Trapaça' }, { id: 'descartado', label: 'Sem trapaça' }, { id: 'bloqueio', label: 'Bloqueios' }];
    let content;
    if (sa.caseTab === 'bloqueio') {
      const list = await api.rpc('admin_blocklist');
      const KIND = { ff_id: ['gamepad', 'ID do Free Fire'], pix: ['key', 'Chave Pix'], device: ['smile', 'Aparelho'] };
      content = '<p class="muted small">Quem é banido por trapaça entra aqui: o ID do Free Fire não cadastra de novo, a chave Pix não saca e o aparelho bane a conta nova na hora.</p>' +
        (list.length ? '<ul class="a-list bl-list stagger">' + list.map((b) => '<li class="a-row"><span class="bl-ic">' + I(KIND[b.kind][0]) + '</span><div class="grow"><b class="mono">' + esc(b.value) + '</b><small>' + KIND[b.kind][1] + ' · ' + esc(b.reason) + ' · ' + U.date(b.created_at) + '</small></div>' +
          (api.me.role_level >= 2 ? '<button type="button" class="btn ghost sm" data-act="aBlockDel" data-k="' + b.kind + '" data-v="' + esc(b.value) + '">' + I('trash') + 'Tirar</button>' : '') + '</li>').join('') + '</ul>'
          : '<div class="all-clear">' + I('checkCircle') + '<b>Lista vazia</b><small>Ninguém banido por trapaça ainda</small></div>');
    } else {
      const list = await api.rpc('admin_cases', { p_status: sa.caseTab });
      content = (sa.caseTab === 'abertas' ? '<p class="muted small">Para chamar alguém: abra a sala, toque no jogador e em <b>Chamar para análise</b>. Também dá pela denúncia. Os saques do suspeito ficam pausados até o resultado.</p>' : '') +
        (list.length ? '<div class="stack stagger">' + list.map(caseCard).join('') + '</div>'
          : '<div class="all-clear">' + I('checkCircle') + '<b>Tudo em dia!</b><small>Nenhuma análise nesse filtro</small></div>');
    }
    return { html: U.seg('cases', tabs, sa.caseTab, 'aCaseTab') + '<div class="fin-body">' + content + '</div>' };
  };
  function caseCard(c) {
    const late = c.status === 'aguardando_video' && c.overdue;
    return '<button type="button" class="case-card ripple" data-act="aCase" data-id="' + c.id + '"><header>' + A.ucell(c.suspect, 'Caso #' + c.code + ' · Sala #' + c.room.code + ' ' + esc(c.room.title)) + statusTag(c.status) + '</header>' +
      '<p class="case-reason">' + esc(c.reason) + '</p><p class="muted small">' +
      (c.status === 'aguardando_video' ? (late ? '<b class="neg">Prazo do vídeo acabou</b>' : 'Prazo do vídeo: ' + U.date(c.deadline)) : c.video_sent ? I('video') + ' Vídeo recebido' : '') +
      (c.victims ? ' · ' + U.plural(c.victims, 'prejudicado marcado', 'prejudicados marcados') : '') + ' · por ' + esc(c.opener ? c.opener.nick : 'equipe') + ' · ' + U.ago(c.created_at) + '</p></button>';
  }
  actions.aCaseTab = (el) => { sa.caseTab = el.dataset.v; app().rerender('soft'); };
  actions.aCase = (el) => { U.closeAll(); app().push('caseAdmin', { id: el.dataset.id }); };
  actions.aBlockDel = async function (el) {
    if (!(await U.confirm({ title: 'Tirar da lista de bloqueio?', body: 'Só faça isso se o bloqueio foi um engano.', ok: 'Tirar', danger: true }))) return;
    if (await U.run(el, () => api.rpc('admin_blocklist_remove', { p_kind: el.dataset.k, p_value: el.dataset.v }), 'Removido da lista.')) app().rerender('soft');
  };

  // abrir análise (pela sala ou pela denúncia)
  actions.caseOpen = async function (el) {
    const reason = await U.confirm({ title: 'Chamar para análise?', icon: 'shieldAlert',
      body: 'O jogador recebe uma mensagem sua no chat de salas e tem <b>24 horas</b> para mandar o vídeo da partida. Os saques dele ficam pausados até o resultado.',
      ok: 'Chamar', input: { label: 'Motivo da suspeita', placeholder: 'Ex.: capa atrás da parede, mira grudando', required: true, error: 'Escreva o motivo.' } });
    if (!reason) return;
    const c = await U.run(el, () => api.rpc('admin_case_open', { p_room: el.dataset.room, p_suspect: el.dataset.id, p_reason: reason }), 'Jogador chamado para análise.');
    if (c) { U.closeAll(); await refreshMe(); app().push('caseAdmin', { id: c.id }); }
  };

  /* ---------- página da análise ---------- */
  const cv = st.caseView = st.caseView || {};
  pages.caseAdmin = async function (p) {
    const me = api.me;
    if (!me || me.role_level < 1) return { html: '<section class="page">' + BH.backRow() + U.empty('lock', 'Acesso restrito', 'Só a equipe vê as análises.') + '</section>' };
    const c = await api.rpc('admin_case', { p_id: p.id });
    if (cv.id !== c.id) { if (cv.local) URL.revokeObjectURL(cv.local); Object.keys(cv).forEach((k) => delete cv[k]); cv.id = c.id; }
    cv.c = c;
    cv.victims = new Set(cv.dirty ? cv.victims : c.victims);
    let src = cv.local || '';
    if (!src && c.video_path) { try { src = await api.signedUrl(c.video_path, 'analises'); } catch (e) { src = ''; } }
    const open = c.status === 'aguardando_video' || c.status === 'em_analise';
    const s = c.suspect;
    return {
      html: '<section class="page case-page">' + BH.backRow() +
        '<header class="case-head"><p class="eyebrow">' + I('shieldAlert') + 'Análise de partida · caso #' + c.code + '</p><h1 class="h1">' + esc(s.nick) + '</h1>' +
        '<div class="t-tags">' + statusTag(c.status) + '<button type="button" class="chip" data-act="aOpenRoom" data-id="' + c.room.id + '">' + I('trophy') + 'Sala #' + c.room.code + ' ' + esc(c.room.title) + '</button></div></header>' +
        '<section class="card"><div class="mu-head">' + U.av(s, 'lg') + '<div><h3>' + U.nick(s, { level: true }) + '</h3><p class="muted">Free Fire: <b>' + esc(s.ff_nick || '–') + '</b> · ID <span class="mono">' + esc(s.ff_id || '–') + '</span></p></div></div>' +
        (s.cases_before ? '<p class="note-red">' + I('alert') + '<span>Já teve ' + U.plural(s.cases_before, 'trapaça confirmada', 'trapaças confirmadas') + ' antes.</span></p>' : '') +
        '<dl class="kv"><div><dt>Motivo</dt><dd>' + esc(c.reason) + '</dd></div><div><dt>Saldo agora</dt><dd>' + U.cents(s.balance_cents) + '</dd></div><div><dt>Aberta por</dt><dd>' + esc(c.opener ? c.opener.nick : '–') + ' · ' + U.date(c.created_at) + '</dd></div>' +
        '<div><dt>Vídeo</dt><dd>' + (c.video_at ? 'Recebido ' + U.ago(c.video_at) : c.overdue ? '<b class="neg">Prazo acabou sem vídeo</b>' : 'Até ' + U.date(c.deadline)) + '</dd></div></dl>' +
        (open ? '<div class="btn-row"><button type="button" class="btn outline sm" data-act="caseChat" data-v="' + (c.thread_id || '') + '">' + I('message') + 'Conversar</button>' +
          '<button type="button" class="btn gold sm" data-act="caseCall" data-id="' + c.id + '">' + I('phone') + 'Ligar (voz e tela)</button></div>' +
          (c.call_link ? '<p class="muted small">Chamada: <button type="button" class="link" data-act="caseJoin" data-v="' + esc(c.call_link) + '">' + esc(c.call_link.replace('https://', '')) + '</button></p>' : '') : '') + '</section>' +
        videoCard(c, src) +
        '<section class="card" id="case-players">' + playersHtml() + '</section>' +
        (open ? '<section class="card"><h3 class="card-h">' + I('gavel') + 'Resultado</h3>' +
          '<p class="muted small">Se for hack: quem ele matou (ou todos da sala) recebe a inscrição de volta, o saldo dele fica retido, os saques pendentes são recusados e a conta é banida para sempre, com bloqueio do ID do Free Fire, das chaves Pix e do aparelho.</p>' +
          '<div class="btn-row two"><button type="button" class="btn green" data-act="caseClear" data-id="' + c.id + '">' + I('checkCircle') + 'Sem trapaça</button>' +
          (me.role_level >= 2 ? '<button type="button" class="btn danger" data-act="caseHack" data-id="' + c.id + '">' + I('ban') + 'Confirmar trapaça</button>' : '<p class="muted small">Só admins confirmam trapaça. Marque os prejudicados e avise um admin.</p>') + '</div>' +
          (me.role_level >= 2 ? '<button type="button" class="btn danger-ghost block sm" data-act="caseRefuse" data-id="' + c.id + '">' + I('userX') + 'Recusou a verificação do aparelho</button>' : '') +
          (c.consent_at ? '<p class="muted small">' + I('checkCircle') + ' Aceitou a verificação do aparelho em ' + U.when(c.consent_at) + '.</p>' : '<p class="muted small">Ainda não aceitou a verificação do aparelho.</p>') + '</section>'
          : resultHtml(c)) + '</section>',
      onMount(root) { mountVideo(root); }
    };
  };

  function playersHtml() {
    const c = cv.c, open = c.status === 'aguardando_video' || c.status === 'em_analise';
    const sug = cv.found || {};
    const n = cv.victims.size;
    return '<header class="card-row"><h3 class="card-h">' + I('users') + 'Prejudicados</h3><span class="chip">' + U.plural(n, 'marcado', 'marcados') + '</span></header>' +
      '<p class="muted small">Marque quem o suspeito matou na partida. A leitura do killfeed sugere os nomes; confira no vídeo antes de salvar.</p>' +
      '<ul class="case-players">' + c.players.map((x) => {
        const id = x.user.id, on = cv.victims.has(id), hit = sug[id];
        if (x.suspect) return '<li class="cp-row suspect">' + U.av(x.user, 'sm') + '<div class="grow"><b>' + esc(x.nick) + '</b><small>' + esc(x.ff_nick || '') + ' · suspeito</small></div><span class="cp-side"><b>' + U.plural(x.kills, 'abate', 'abates') + '</b><small>' + (x.placement ? x.placement + 'º' : '–') + '</small></span></li>';
        return '<li><label class="cp-row' + (on ? ' on' : '') + (hit ? ' hit' : '') + '"><input type="checkbox" data-victim="' + id + '"' + (on ? ' checked' : '') + (open ? '' : ' disabled') + '>' + U.av(x.user, 'sm') +
          '<div class="grow"><b>' + esc(x.nick) + '</b><small>' + esc(x.ff_nick || '') + (hit ? ' · <span class="tone-gold-t">' + I('scan') + 'killfeed ' + fmtT(hit.t) + '</span>' : '') + '</small></div>' +
          '<span class="cp-side"><b>' + U.cents(x.paid_cents) + '</b><small>' + (x.placement ? x.placement + 'º' : '–') + ' · ' + x.kills + ' ab.</small></span></label></li>';
      }).join('') + '</ul>' +
      (open ? '<button type="button" class="btn primary block" data-act="caseSaveVictims"' + (cv.dirty ? '' : ' disabled') + '>' + I('check') + 'Salvar prejudicados</button>' : '');
  }
  function redrawPlayers() { const el = document.getElementById('case-players'); if (el) { el.innerHTML = playersHtml(); } }
  document.addEventListener('change', (e) => {
    const box = e.target.closest('[data-victim]');
    if (!box || !cv.victims) return;
    if (box.checked) cv.victims.add(box.dataset.victim); else cv.victims.delete(box.dataset.victim);
    cv.dirty = true;
    redrawPlayers();
  });
  actions.caseSaveVictims = async function (el) {
    const r = await U.run(el, () => api.rpc('admin_case_update', { p_id: cv.id, p: { victims: [...cv.victims] } }), 'Prejudicados salvos.');
    if (r) { cv.dirty = false; cv.c = r; cv.victims = new Set(r.victims); redrawPlayers(); }
  };
  actions.caseChat = (el) => { if (!el.dataset.v) return U.toast('A conversa ainda não foi criada.', 'bad'); app().push('thread', { id: el.dataset.v }); };
  actions.caseJoin = (el) => api.openExternal(el.dataset.v).catch(U.err);
  actions.caseCall = async function (el) {
    const ok = await U.confirm({ title: 'Ligar para o jogador?', icon: 'phone', ok: 'Criar chamada',
      body: 'Abre uma sala de voz no <b>Jitsi Meet</b> (grátis). O jogador recebe o link no chat e no aviso. Pelo app do Jitsi ele pode <b>compartilhar a tela</b> e mostrar o Free Fire ao vivo. Na primeira vez o Jitsi pede para você entrar com uma conta Google.' });
    if (!ok) return;
    const r = await U.run(el, () => api.rpc('admin_case_call', { p_id: el.dataset.id }), 'Link enviado para o jogador.');
    if (r) { api.openExternal(r.link).catch(U.err); app().refresh(); }
  };
  actions.caseClear = async function (el) {
    const note = await U.confirm({ title: 'Encerrar sem trapaça?', body: 'Os saques do jogador voltam ao normal e ele é avisado.', ok: 'Encerrar', icon: 'checkCircle',
      input: { label: 'Resultado da análise', placeholder: 'Ex.: vídeo limpo, jogada legítima', required: true, error: 'Escreva o resultado.', multiline: true } });
    if (!note) return;
    if (await U.run(el, () => api.rpc('admin_case_resolve', { p_id: el.dataset.id, p_hack: false, p_mode: null, p_note: note }), 'Análise encerrada.')) { await refreshMe(); app().refresh(); }
  };
  actions.caseHack = function (el) {
    const id = el.dataset.id;
    if (cv.dirty) return U.toast('Salve os prejudicados antes de confirmar.', 'bad');
    U.sheet({
      title: 'Confirmar trapaça', data: { mode: cv.victims.size ? 'prejudicados' : 'todos' },
      body: async (s) => {
        const pv = await api.rpc('admin_case_preview', { p_id: id, p_mode: s.data.mode });
        return '<form class="form" data-form="caseResolve" data-id="' + id + '">' +
          '<fieldset class="field"><span>Quem recebe a inscrição de volta</span><div class="radio-list">' +
          '<label class="radio"><input type="radio" name="mode" value="prejudicados" data-act-change="caseMode"' + (s.data.mode === 'prejudicados' ? ' checked' : '') + (cv.victims.size ? '' : ' disabled') + '><span>Só os prejudicados (' + cv.victims.size + ')</span></label>' +
          '<label class="radio"><input type="radio" name="mode" value="todos" data-act-change="caseMode"' + (s.data.mode === 'todos' ? ' checked' : '') + '><span>Todos da sala</span></label></div></fieldset>' +
          '<ul class="a-list">' + (pv.refunds.length ? pv.refunds.map((x) => '<li class="a-row">' + A.ucell(x.user, 'inscrição de volta') + '<b class="pos">+' + U.cents(x.cents) + '</b></li>').join('') : '<li class="muted pad">Ninguém pagou inscrição nessa sala.</li>') + '</ul>' +
          '<div class="tiles3 two"><div class="tile tone-green"><b>' + U.cents(pv.refund_total) + '</b><small>Volta para os jogadores</small></div><div class="tile tone-red"><b>' + U.cents(pv.confiscate) + '</b><small>Fica retido do trapaceiro</small></div></div>' +
          '<p class="note-red">' + I('ban') + '<span>Ban permanente. Saques pendentes recusados. ID do Free Fire, chaves Pix e aparelho entram na lista de bloqueio. A devolução sai da plataforma.</span></p>' +
          '<label class="field"><span>Resultado da análise (fica na auditoria)</span><textarea id="cr-note" name="note" rows="3" maxlength="600" required placeholder="Ex.: no vídeo, 3:12 e 5:40, a mira segue o inimigo atrás da parede"></textarea></label>' +
          '<button class="btn danger block lg">' + I('gavel') + 'Confirmar trapaça e banir</button></form>';
      }
    });
  };
  actions.caseMode = (el) => { const s = U.topSheet(); if (!s) return; s.data.mode = el.value; s.render('static'); };
  // recusou a verificação (ou sumiu depois de chamado): ban permanente e bloqueios; se quiser, trata como trapaça
  actions.caseRefuse = function (el) {
    const id = el.dataset.id;
    if (cv.dirty) return U.toast('Salve os prejudicados antes.', 'bad');
    U.sheet({
      title: 'Recusou a verificação', data: { cheat: true, mode: cv.victims.size ? 'prejudicados' : 'todos' },
      body: (s) => '<form class="form" data-form="caseRefuse" data-id="' + id + '">' +
        '<p class="note-red">' + I('ban') + '<span>Ban permanente. O ID do Free Fire, as chaves Pix e o aparelho entram na lista de bloqueio: a pessoa não cria outra conta. Só admin ou dono libera depois, na aba Banidos.</span></p>' +
        '<label class="switch"><input type="checkbox" name="cheat" data-act-change="caseRefuseCheat"' + (s.data.cheat ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Tratar como trapaça <small>Devolve as inscrições e retém o saldo dele, como no veredito de trapaça.</small></span></label>' +
        (s.data.cheat ? '<fieldset class="field"><span>Quem recebe a inscrição de volta</span><div class="radio-list">' +
          '<label class="radio"><input type="radio" name="mode" value="prejudicados" data-act-change="caseMode"' + (s.data.mode === 'prejudicados' ? ' checked' : '') + (cv.victims.size ? '' : ' disabled') + '><span>Só os prejudicados (' + cv.victims.size + ')</span></label>' +
          '<label class="radio"><input type="radio" name="mode" value="todos" data-act-change="caseMode"' + (s.data.mode === 'todos' ? ' checked' : '') + '><span>Todos da sala</span></label></div></fieldset>' : '') +
        '<label class="field"><span>O que aconteceu (fica na auditoria)</span><textarea id="crf-note" name="note" rows="3" maxlength="600" required placeholder="Ex.: na ligação, recusou compartilhar a tela e desligou"></textarea></label>' +
        '<button class="btn danger block lg">' + I('gavel') + 'Banir para sempre</button></form>'
    });
  };
  actions.caseRefuseCheat = (el) => { const s = U.topSheet(); if (!s) return; s.data.cheat = el.checked; s.render('static'); };
  forms.caseRefuse = async function (f) {
    const s = U.topSheet(), cheat = !!(s && s.data.cheat), mode = cheat ? new FormData(f).get('mode') : null;
    if (!(await U.confirm({ title: 'Banir para sempre?', body: 'A conta e o aparelho ficam bloqueados. Só a administração libera depois.', ok: 'Banir', danger: true }))) return;
    const r = await U.run(f.querySelector('button.danger'), () => api.rpc('admin_case_refuse', { p_id: f.dataset.id, p_as_cheat: cheat, p_mode: mode, p_note: f.note.value }), 'Conta banida por recusar a verificação.');
    if (r) { U.closeAll(); await refreshMe(); app().refresh(); }
  };
  forms.caseResolve = async function (f) {
    const mode = new FormData(f).get('mode');
    if (!(await U.confirm({ title: 'Tem certeza?', body: 'Não dá para desfazer: o dinheiro é devolvido e a conta é banida para sempre.', ok: 'Confirmar', danger: true }))) return;
    const r = await U.run(f.querySelector('button.danger'), () => api.rpc('admin_case_resolve', { p_id: f.dataset.id, p_hack: true, p_mode: mode, p_note: f.note.value }), 'Trapaça confirmada. Jogador banido.');
    if (r) { U.closeAll(); U.toast(U.cents(r.result.refund_total) + ' devolvidos · ' + U.cents(r.result.confiscated) + ' retidos.', 'money'); await refreshMe(); app().refresh(); }
  };
  function resultHtml(c) {
    const r = c.result || {};
    return '<section class="card"><h3 class="card-h">' + I('gavel') + 'Resultado</h3>' + statusTag(c.status) +
      '<blockquote>' + esc(c.verdict_note || '') + '</blockquote><p class="muted small">Por ' + esc(c.resolved_by ? c.resolved_by.nick : '–') + ' · ' + U.date(c.resolved_at) + '</p>' +
      (c.status === 'confirmado' || (c.status === 'recusado' && r.refund_total) ? '<div class="tiles3"><div class="tile tone-green"><b>' + U.cents(r.refund_total) + '</b><small>Devolvido (' + (c.refund_mode === 'todos' ? 'todos' : 'prejudicados') + ')</small></div>' +
        '<div class="tile tone-red"><b>' + U.cents(r.confiscated) + '</b><small>Retido</small></div><div class="tile"><b>' + U.cents(r.withdrawals_refused) + '</b><small>Saques recusados</small></div></div>' +
        '<ul class="mini-log">' + (r.refunds || []).map((x) => '<li>' + esc(x.nick) + ' · ' + U.cents(x.cents) + '</li>').join('') + '</ul>' : '') + '</section>';
  }

  /* ---------- vídeo + leitura do killfeed ---------- */
  function videoCard(c, src) {
    return '<section class="card"><h3 class="card-h">' + I('video') + 'Vídeo da partida</h3>' +
      (src ? '<div class="kf-stage" id="kf-stage"><video id="case-video" controls playsinline preload="metadata"' + (cv.local ? '' : ' crossorigin="anonymous"') + ' src="' + esc(src) + '"></video><div class="kf-crop" id="kf-crop" hidden><i></i></div></div>'
        : '<p class="muted small">' + (c.video_link ? 'O jogador mandou um link. Assista pelo link; para ler o killfeed, baixe o vídeo e abra aqui.' : 'Nenhum vídeo no app ainda.') + '</p>') +
      '<div class="btn-row">' + (c.video_link ? '<button type="button" class="btn outline sm" data-act="caseJoin" data-v="' + esc(c.video_link) + '">' + I('link') + 'Abrir link do vídeo</button>' : '') +
      '<label class="btn ghost sm file-btn">' + I('upload') + 'Abrir vídeo do celular<input type="file" accept="video/*" id="case-local"></label></div>' +
      (src ? '<div class="kf" id="kf">' + kfPanel() + '</div>' : '') + '</section>';
  }
  function kfPanel() {
    const k = cv.kf || {};
    return '<h4 class="kf-t">' + I('scan') + 'Leitura do killfeed</h4>' +
      '<p class="muted small">O app lê o texto do killfeed a cada poucos segundos e procura os nicks da sala. Quando aparece <b>suspeito → outro jogador</b>, esse jogador vai para a lista de prejudicados sugeridos.</p>' +
      '<div class="grid2"><label class="field"><span>Ler a cada</span><select id="kf-step"><option value="1">1 segundo</option><option value="2" selected>2 segundos</option><option value="3">3 segundos</option><option value="5">5 segundos</option></select></label>' +
      '<label class="field"><span>Área</span><select id="kf-area"><option value="left">Lado esquerdo</option><option value="right">Lado direito</option><option value="top">Faixa de cima</option><option value="all">Tela inteira</option><option value="custom"' + (cv.crop && cv.crop.custom ? ' selected' : '') + '>Marcar no vídeo</option></select></label></div>' +
      '<p class="muted small" id="kf-hint">Para marcar, escolha <b>Marcar no vídeo</b> e arraste o dedo sobre o killfeed.</p>' +
      (k.running ? '<div class="kf-prog">' + U.bar(k.pct || 0) + '<small id="kf-status">' + esc(k.status || '') + '</small></div><button type="button" class="btn ghost block sm" data-act="kfStop">' + I('x') + 'Parar</button>'
        : '<button type="button" class="btn gold block" data-act="kfRun">' + I('scan') + (k.done ? 'Ler de novo' : 'Ler killfeed') + '</button>') +
      (k.done || k.running ? kfResults() : '');
  }
  function kfResults() {
    const k = cv.kf, found = cv.found || {}, ids = Object.keys(found);
    const byId = Object.fromEntries(cv.c.players.map((x) => [x.user.id, x]));
    return '<div class="kf-res"><p class="eyebrow">' + I('crosshair') + 'Abates do suspeito encontrados (' + ids.length + ')</p>' +
      (ids.length ? '<ul class="kf-hits">' + ids.map((id) => '<li><button type="button" class="kf-hit" data-act="kfSeek" data-v="' + found[id].t + '">' + U.av(byId[id].user, 'xs') + '<b>' + esc(byId[id].ff_nick || byId[id].nick) + '</b><small>' + fmtT(found[id].t) + ' · ' + U.plural(found[id].n, 'leitura', 'leituras') + '</small>' + I('play') + '</button></li>').join('') + '</ul>' +
        (k.running ? '' : '<button type="button" class="btn primary block sm" data-act="kfApply">' + I('check') + 'Marcar como prejudicados</button>')
        : '<p class="muted small">' + (k.running ? 'Procurando…' : 'Nenhum abate do suspeito lido. Ajuste a área do killfeed ou leia a cada 1 segundo.') + '</p>') +
      (k.lines && k.lines.length ? '<details class="kf-log"><summary>Texto lido (' + k.lines.length + ' linhas)</summary><ul>' + k.lines.slice(-60).map((l) => '<li><button type="button" class="link" data-act="kfSeek" data-v="' + l.t + '">' + fmtT(l.t) + '</button> ' + esc(l.text) + '</li>').join('') + '</ul></details>' : '') + '</div>';
  }
  function redrawKf() { const el = document.getElementById('kf'); if (el) { const keep = { step: val('kf-step'), area: val('kf-area') }; el.innerHTML = kfPanel(); setVal('kf-step', keep.step); setVal('kf-area', keep.area); U.enhance(el, 'static'); } }
  const val = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
  const setVal = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };
  const fmtT = (t) => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  // áreas prontas (frações da tela) e a marcada com o dedo
  const AREAS = { left: { x: 0, y: 0.12, w: 0.5, h: 0.5 }, right: { x: 0.5, y: 0.12, w: 0.5, h: 0.5 }, top: { x: 0.15, y: 0, w: 0.7, h: 0.3 }, all: { x: 0, y: 0, w: 1, h: 1 } };
  function area() { const a = val('kf-area') || 'left'; return a === 'custom' && cv.crop ? cv.crop : AREAS[a] || AREAS.left; }
  function showCrop(r) {
    const box = document.getElementById('kf-crop'); if (!box) return;
    box.hidden = false;
    const i = box.querySelector('i');
    i.style.left = r.x * 100 + '%'; i.style.top = r.y * 100 + '%'; i.style.width = r.w * 100 + '%'; i.style.height = r.h * 100 + '%';
  }
  function mountVideo(root) {
    const local = root.querySelector('#case-local');
    if (local) local.addEventListener('change', () => {
      const f = local.files && local.files[0]; if (!f) return;
      if (cv.local) URL.revokeObjectURL(cv.local);
      cv.local = URL.createObjectURL(f); cv.kf = null; cv.found = null;
      app().refresh();
    });
    const v = root.querySelector('#case-video'), box = root.querySelector('#kf-crop'), sel = root.querySelector('#kf-area');
    if (!v || !box || !sel) return;
    const sync = () => { box.classList.toggle('drawing', sel.value === 'custom'); showCrop(area()); };
    sel.addEventListener('change', sync);
    v.addEventListener('loadedmetadata', sync);
    sync();
    // arrastar para marcar a área (só no modo "Marcar no vídeo")
    let p0 = null;
    const rel = (e) => { const b = box.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
    box.addEventListener('pointerdown', (e) => { if (sel.value !== 'custom') return; e.preventDefault(); box.setPointerCapture(e.pointerId); p0 = rel(e); });
    box.addEventListener('pointermove', (e) => { if (!p0) return; const p = rel(e); cv.crop = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y), custom: true }; showCrop(cv.crop); });
    box.addEventListener('pointerup', () => { p0 = null; if (cv.crop && (cv.crop.w < 0.05 || cv.crop.h < 0.03)) { cv.crop = null; showCrop(area()); } });
  }
  actions.kfSeek = (el) => { const v = document.getElementById('case-video'); if (v) { v.currentTime = Number(el.dataset.v); v.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
  actions.kfStop = () => { if (cv.kf) cv.kf.stop = true; };
  actions.kfApply = () => {
    Object.keys(cv.found || {}).forEach((id) => cv.victims.add(id));
    cv.dirty = true; redrawPlayers();
    const el = document.getElementById('case-players'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    U.toast('Confira e toque em Salvar prejudicados.', 'info');
  };
  actions.kfRun = async function () {
    const v = document.getElementById('case-video');
    if (!v) return;
    if (!v.duration || !isFinite(v.duration)) { await new Promise((r) => { v.addEventListener('loadedmetadata', r, { once: true }); v.load(); setTimeout(r, 8000); }); }
    if (!v.duration || !isFinite(v.duration)) return U.toast('Não foi possível abrir o vídeo.', 'bad');
    const step = Number(val('kf-step')) || 2, crop = area();
    cv.kf = { running: true, pct: 0, status: 'Baixando o leitor de texto (só na primeira vez)…', lines: [] };
    cv.found = {};
    redrawKf(); redrawPlayers();
    let worker = null;
    try {
      worker = await BH.killfeed.worker((m) => { if (m.status && cv.kf && cv.kf.running && cv.kf.pct === 0) setStatus(m.status === 'recognizing text' ? 'Lendo…' : 'Preparando o leitor… ' + Math.round((m.progress || 0) * 100) + '%'); });
      const players = cv.c.players.map((x) => ({ id: x.user.id, suspect: x.suspect, names: [x.ff_nick, x.nick] }));
      const res = await BH.killfeed.scan(v, worker, { crop, step, players,
        progress: (pct, t) => { cv.kf.pct = pct; setStatus('Lendo ' + fmtT(t) + ' de ' + fmtT(v.duration) + ' · ' + Math.round(pct * 100) + '%'); },
        line: (l) => { cv.kf.lines.push(l); },
        kill: (id, t) => { const f = cv.found[id]; if (f) f.n++; else { cv.found[id] = { t, n: 1 }; redrawKf(); redrawPlayers(); } },
        stopped: () => cv.kf && cv.kf.stop });
      U.toast(res.stopped ? 'Leitura parada.' : 'Leitura concluída: ' + U.plural(Object.keys(cv.found).length, 'abate encontrado', 'abates encontrados') + '.', 'good');
    } catch (e) { U.err(e); }
    finally {
      if (worker) worker.terminate().catch(() => {});
      if (cv.kf) { cv.kf.running = false; cv.kf.done = true; }
      redrawKf(); redrawPlayers();
    }
  };
  function setStatus(t) { if (cv.kf) cv.kf.status = t; const el = document.getElementById('kf-status'); if (el) el.textContent = t; const bar = document.querySelector('#kf .meter i'); if (bar && cv.kf) bar.style.width = Math.round(cv.kf.pct * 1000) / 10 + '%'; }

  /* ================= SUSPEITO: aviso no início e envio do vídeo ================= */
  BH.caseBanner = function (c) {
    return '<button type="button" class="notice danger ripple" data-act="myCase">' + I('shieldAlert') + '<span><b>Partida em análise · Sala #' + c.room.code + '</b>' +
      (c.video_sent ? 'Vídeo recebido. A equipe está analisando. Seus saques ficam pausados até o resultado.' : 'Envie o vídeo da partida até ' + U.date(c.deadline) + '. Seus saques ficam pausados até o resultado.') +
      (c.call_link ? '<em class="notice-cta">' + I('phone') + 'A equipe te chamou para uma ligação</em>' : '') + '</span></button>';
  };
  actions.myCase = function () {
    U.sheet({
      title: 'Análise da partida', data: { file: null },
      body: async (s) => {
        const c = await api.rpc('my_case');
        if (!c) return U.empty('checkCircle', 'Nenhuma análise aberta', 'Está tudo certo com a sua conta.');
        const f = s.data.file;
        return '<div class="case-me"><p class="note-red">' + I('shieldAlert') + '<span>A equipe está analisando a sua partida na <b>sala #' + c.room.code + ' ' + esc(c.room.title) + '</b>. Motivo: ' + esc(c.reason) + '.</span></p>' +
          (c.call_link ? '<section class="card"><h3 class="card-h">' + I('phone') + 'Ligação com a equipe</h3><p class="muted small">Abre no app <b>Jitsi Meet</b> (ou no navegador). Para mostrar a tela: na chamada, toque em <b>⋯ → Compartilhar tela</b> e abra o Free Fire.</p>' +
            '<button type="button" class="btn gold block" data-act="caseJoin" data-v="' + esc(c.call_link) + '">' + I('phone') + 'Entrar na ligação</button></section>' : '') +
          '<section class="card"><h3 class="card-h">' + I('video') + (c.video_sent ? 'Vídeo enviado' : 'Envie o vídeo da partida') + '</h3>' +
          (c.video_sent ? '<p class="note-green">' + I('checkCircle') + '<span>Recebemos o seu vídeo. Se quiser, mande outro com mais detalhes.</span></p>' : '<p class="muted small">Prazo: <b>' + U.date(c.deadline) + '</b> (' + U.until(c.deadline) + '). Sem o vídeo, a equipe decide só com o que tem.</p>') +
          '<ol class="steps small"><li><span>Mande a <b>gravação de tela</b> da partida inteira, sem cortes.</span></li><li><span>O <b>killfeed</b> (o aviso de quem matou quem) precisa aparecer: sem dedo, chat ou outro app por cima.</span></li><li><span>Arquivo de até <b>50 MB</b> vai direto por aqui. Maior que isso: coloque no Google Drive (ou YouTube não listado) e cole o link.</span></li></ol>' +
          '<form class="form" data-form="caseVideo" data-id="' + c.id + '">' +
          '<label class="drop' + (f ? ' has' : '') + '"><input id="cs-file" type="file" accept="video/*" data-case-file><span class="drop-empty">' + I('upload') + '<b>' + (f ? esc(f.name) : 'Escolher o vídeo') + '</b><small>' + (f ? (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB' : 'MP4 da galeria, até 50 MB') + '</small></span></label>' +
          '<label class="field"><span>Ou cole o link do vídeo</span><input id="cs-link" name="link" type="url" inputmode="url" placeholder="https://drive.google.com/…" autocomplete="off"></label>' +
          '<p class="fine-print">Pelos termos de uso, quando você é chamado para análise, <b>os organizadores têm total direito de acessar e verificar o seu aparelho</b> (por chamada com compartilhamento de tela, vídeo ou outro meio que a equipe indicar) para conferir se há programa de trapaça, APK modificado do jogo ou qualquer software que dê vantagem. <b>Recusar a verificação é tratado como trapaça</b>: a conta é banida para sempre e o ID do Free Fire, as chaves Pix e o aparelho ficam bloqueados, sem poder criar outra conta. Só a administração do BattleHub pode liberar a volta.</p>' +
          (c.consent_at ? '<p class="muted small">' + I('checkCircle') + ' Você aceitou a verificação em ' + U.when(c.consent_at) + '.</p>'
            : '<label class="check"><input type="checkbox" name="consent" required><span>Li e aceito a verificação do meu aparelho.</span></label>') +
          '<button class="btn primary block lg">' + I('send') + 'Enviar para a equipe</button></form></section>' +
          (c.thread_id ? '<button type="button" class="btn outline block" data-act="caseChat" data-v="' + c.thread_id + '">' + I('message') + 'Conversar com ' + esc(c.opener ? c.opener.nick : 'a equipe') + '</button>' : '') + '</div>';
      }
    });
  };
  document.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-case-file]'); if (!inp) return;
    const s = U.topSheet(); if (!s) return;
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > MAX_VIDEO) { U.toast('O vídeo tem ' + (f.size / 1048576).toFixed(0) + ' MB. O limite é 50 MB: coloque no Google Drive e cole o link.', 'bad'); inp.value = ''; return; }
    s.data.file = f; s.render('static');
  });
  forms.caseVideo = async function (f) {
    const s = U.topSheet(), file = s && s.data.file, link = f.link.value.trim();
    if (!file && !link) return U.toast('Escolha o vídeo ou cole o link.', 'bad');
    if (f.consent && !f.consent.checked) return U.toast('Marque que você aceita a verificação do aparelho.', 'bad');
    const r = await U.run(f.querySelector('button.primary'), async () => {
      let path = null;
      if (file) {
        const ext = ((file.name.match(/\.([a-z0-9]{2,4})$/i) || [])[1] || 'mp4').toLowerCase();
        path = await api.upload('analises', file, { ext, type: file.type || 'video/mp4' });
      }
      return api.rpc('case_submit_video', { p_case: f.dataset.id, p_path: path, p_link: link || null, p_consent: !f.consent || f.consent.checked });
    }, 'Vídeo enviado. A equipe foi avisada.');
    if (r) { U.closeAll(); await refreshMe(); app().refresh(); }
  };

  // ao entrar: manda o identificador do aparelho (quem foi banido por trapaça não volta com conta nova)
  BH.flows.sendDevice = async function () {
    if (!api.me || st.deviceSent === api.me.id) return;
    st.deviceSent = api.me.id;
    try {
      const r = await api.rpc('set_device', { p_device: await api.deviceId() });
      if (r && r.banned) { await api.refreshMe(); app().refresh(); }
    } catch (e) { st.deviceSent = null; }
  };
})();
