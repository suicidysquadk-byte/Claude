/* Segurança da equipe: acesso excepcional às conversas (com motivo e registro), registro de acesso ao app
   (Marco Civil) e a aba de banidos. As telas entram no painel admin (BH.admin.SECTION). */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const actions = BH.actions, forms = BH.forms;
  const A = () => BH.admin;
  const KIND = { denuncia: 'Denúncia', ordem_judicial: 'Ordem judicial', seguranca: 'Segurança' };

  /* ---------- conversas de um jogador (sem conteúdo) ---------- */
  actions.aThreads = function (el) {
    const uid = el.dataset.id;
    U.sheet({
      title: 'Conversas', size: 'lg',
      body: async () => {
        const list = await api.rpc('admin_user_threads', { p_user: uid });
        return '<p class="note-gold small">' + I('lock') + '<span>As conversas são protegidas. Para ler, abra com o motivo: fica registrado para sempre com o seu nome e vale por 24 horas.</span></p>' +
          (list.length ? '<ul class="stack">' + list.map((t) => '<li class="friend-row">' + U.av(t.other, 'md') + '<div class="grow"><b>' + U.nick(t.other) + (t.kind === 'sala' ? ' <span class="tag tone-cyan">sala</span>' : '') + '</b>' +
            '<small>' + U.plural(t.count, 'mensagem', 'mensagens') + ' · desde ' + U.date(t.created_at) + ' · última ' + U.ago(t.last_at) + (t.reports ? ' · ' + U.plural(t.reports, 'denúncia', 'denúncias') : '') + '</small></div>' +
            (t.open_until ? '<button type="button" class="btn gold sm" data-act="aChatRead" data-id="' + t.id + '">' + I('eye') + 'Ler</button>'
              : '<button type="button" class="btn outline sm" data-act="aChatOpen" data-id="' + t.id + '">' + I('lock') + 'Abrir</button>') + '</li>').join('') + '</ul>'
            : U.empty('message', 'Nenhuma conversa', 'Esta conta ainda não conversou com ninguém.'));
      }
    });
  };
  actions.aChatOpen = function (el) {
    const id = el.dataset.id, lv = api.me.role_level;
    const kinds = [['denuncia', 'Denúncia', 'Tem denúncia envolvendo um dos dois']].concat(lv >= 2 ? [['seguranca', 'Segurança', 'Golpe, ameaça ou risco a alguém']] : [], lv >= 3 ? [['ordem_judicial', 'Ordem judicial', 'Pedido da Justiça, polícia ou Ministério Público']] : []);
    U.sheet({
      title: 'Abrir conversa', data: { kind: 'denuncia' },
      body: (s) => '<form class="form" data-form="aChatOpen" data-id="' + id + '"><p class="note-red small">' + I('alert') + '<span>O acesso fica registrado para sempre com o seu nome, a data e o motivo. Use só quando for necessário.</span></p>' +
        '<fieldset class="field"><legend>Motivo</legend><div class="radio-list">' + kinds.map((k) => '<label class="radio"><input type="radio" name="kind" value="' + k[0] + '" data-act-change="aChatKind"' + (s.data.kind === k[0] ? ' checked' : '') + '><span><b>' + k[1] + '</b><small>' + k[2] + '</small></span></label>').join('') + '</div></fieldset>' +
        (s.data.kind === 'ordem_judicial' ? '<label class="field"><span>Número do processo ou do ofício</span><input id="aco-ref" name="ref" required minlength="5" placeholder="Ex.: 0001234-56.2026.8.26.0100"></label>' : '') +
        '<label class="field"><span>Explique o motivo</span><textarea id="aco-why" name="why" rows="3" required minlength="15" placeholder="Ex.: denúncia de golpe, pediu Pix fora do app"></textarea></label>' +
        '<button class="btn primary block">' + I('lock') + 'Abrir por 24 horas</button></form>'
    });
  };
  actions.aChatKind = (el) => { const s = U.topSheet(); if (s) { s.data.kind = el.value; s.render('static'); } };
  forms.aChatOpen = async function (f) {
    const kind = (f.querySelector('input[name=kind]:checked') || {}).value;
    const r = await U.run(f.querySelector('button'), () => api.rpc('admin_chat_open', { p_thread: f.dataset.id, p_kind: kind, p_reference: f.ref ? f.ref.value : '', p_reason: f.why.value }));
    if (!r) return;
    U.closeAll();
    actions.aChatRead({ dataset: { id: f.dataset.id } });
  };
  actions.aChatRead = function (el) {
    const id = el.dataset.id;
    U.sheet({
      title: 'Conversa (acesso excepcional)', size: 'lg',
      body: async () => {
        const c = await api.rpc('admin_chat_read', { p_thread: id });
        const paths = c.messages.filter((m) => m.media_path).map((m) => m.media_path);
        let urls = {};
        try { urls = await api.signedUrls('conversas', paths); } catch (e) { urls = {}; }
        const who = (uid) => (uid === c.a.id ? c.a : c.b);
        return '<p class="note-gold small">' + I('lock') + '<span>' + esc(KIND[c.access.kind]) + (c.access.reference ? ' · ' + esc(c.access.reference) : '') + ' · aberto até ' + U.when(c.access.expires_at) + '<br>' + esc(c.access.reason) + '</span></p>' +
          '<div class="p-badges">' + U.av(c.a, 'sm') + '<b>' + U.nick(c.a) + '</b><span class="muted">e</span>' + U.av(c.b, 'sm') + '<b>' + U.nick(c.b) + '</b></div>' +
          '<div class="msgs audit-msgs">' + (c.messages.length ? c.messages.map((m) => {
            const url = m.media_path ? urls[m.media_path] : m.image_url;
            const media = m.media_kind === 'audio' ? (url ? '<audio controls preload="none" src="' + esc(url) + '"></audio>' : '<span class="msg-miss">Áudio indisponível</span>')
              : url ? '<button type="button" class="msg-img" data-act="viewImage" data-v="' + esc(url) + '"><img src="' + esc(url) + '" alt="Foto"></button>' : '';
            return '<div class="bubble' + (m.from === c.b.id ? ' me' : '') + '"><small class="who">' + esc(who(m.from).nick || '?') + '</small>' + media + (m.body ? '<p>' + esc(m.body) + '</p>' : '') + '<small>' + U.when(m.created_at) + (m.read_at ? ' · lida' : '') + '</small></div>';
          }).join('') : '<p class="muted center pad">Sem mensagens.</p>') + '</div>' +
          (api.me.role_level >= 3 ? '<button type="button" class="btn outline block" data-act="aChatExport" data-id="' + id + '">' + I('file') + 'Exportar conversa completa (.txt)</button><p class="muted small">Para entregar a quem pediu por ordem judicial. O arquivo sai com o resumo SHA-256, que prova que o texto não foi mudado.</p>' : '');
      }
    });
  };
  actions.aChatExport = async function (el) {
    const r = await U.run(el, () => api.rpc('admin_chat_export', { p_thread: el.dataset.id }));
    if (!r) return;
    const text = r.text + '\nSHA-256 do texto acima: ' + r.sha256 + '\n';
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      a.download = r.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { /* no celular o download pode não abrir: fica o texto abaixo */ }
    U.sheet({
      title: 'Conversa exportada', loading: false,
      body: '<p class="muted small">Se o arquivo não baixou, copie o texto abaixo e salve num documento. O resumo SHA-256 no fim comprova que o conteúdo não foi alterado.</p>' +
        '<textarea class="export-box" readonly rows="12">' + esc(text) + '</textarea><button type="button" class="btn primary block" data-act="copy" data-v="' + esc(text) + '">' + I('copy') + 'Copiar tudo</button>'
    });
  };

  /* ---------- registro de acesso (Marco Civil) ---------- */
  actions.aAccessLog = function (el) {
    const uid = el.dataset.id;
    U.sheet({
      title: 'Registros de acesso',
      body: async () => {
        const list = await api.rpc('admin_access_log', { p_user: uid });
        return '<p class="muted small">Data, hora, IP e aparelho de cada vez que a conta abriu o app. Guardados por 6 meses, como pede o Marco Civil da Internet (art. 15). Só entregue a terceiros com ordem judicial.</p>' +
          (list.length ? '<ul class="mini-log">' + list.map((l) => '<li>' + U.when(l.at) + ' · IP <span class="mono">' + esc(l.ip || 'não informado') + '</span>' + (l.device ? ' · <span class="mono">' + esc(l.device) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="muted">Nenhum acesso registrado ainda.</p>');
      }
    });
  };

  /* ---------- painel: quem abriu quais conversas ---------- */
  function sectionChatLog() {
    return api.rpc('admin_chat_access_log').then((list) => ({
      html: '<p class="muted small">Toda vez que alguém da equipe abre uma conversa, fica aqui com o motivo. Ninguém apaga este registro pelo app.</p>' +
        '<section class="card"><ul class="log-list stagger">' + (list.length ? list.map((a) => '<li><span class="log-ic">' + I(a.kind === 'ordem_judicial' ? 'gavel' : a.kind === 'seguranca' ? 'shieldAlert' : 'flag') + '</span><div class="grow">' +
          '<b>' + esc(a.by.nick || '?') + '</b> abriu a conversa de <b>' + esc(a.a.nick || '?') + '</b> e <b>' + esc(a.b.nick || '?') + '</b>' +
          '<small>' + esc(KIND[a.kind]) + (a.reference ? ' · ' + esc(a.reference) : '') + ' · ' + esc(a.reason) + '</small>' +
          '<small>' + U.when(a.created_at) + (a.exported_at ? ' · exportada em ' + U.when(a.exported_at) : '') + '</small></div></li>').join('') : '<li class="muted pad">Ninguém abriu conversas.</li>') + '</ul></section>'
    }));
  }

  /* ---------- aba Banidos ---------- */
  const st = BH.state;
  const BLOCK = { ff_id: 'ID do Free Fire', pix: 'Chave Pix', device: 'Aparelho' };
  const REL = { nova_conta: 'Liberou criar outra conta', voltar: 'Liberou voltar para a conta', reativar: 'Reativou a conta' };
  function sectionBanned() {
    const sa = st.adm, lv = api.me.role_level;
    return api.rpc('admin_banned', { p_q: sa.bannedQ || null }).then((list) => ({
      html: '<label class="search">' + I('search') + '<input id="ab-q" type="search" placeholder="Buscar por nick, número ou ID do Free Fire" value="' + esc(sa.bannedQ || '') + '" data-input="adm.bannedQ" autocomplete="off"></label>' +
        '<p class="muted small">Contas banidas agora. Ban permanente só sai por aqui, e só admin ou dono libera. Tudo fica na auditoria.</p>' +
        (list.length ? '<div class="stack stagger">' + list.map((b) => '<article class="card ban-card">' +
          '<div class="ban-top">' + A().ucell(b.user, esc(b.email || '') + (b.ff_id ? ' · FF ' + esc(b.ff_id) : '')) + '<span class="tag tone-red">' + (b.permanent ? 'Permanente' : 'Até ' + U.date(b.until)) + '</span></div>' +
          '<p class="ban-why">' + I('ban') + '<span>' + esc(b.reason || 'Sem motivo registrado') + '</span></p>' +
          '<p class="muted small">' + (b.since ? 'Desde ' + U.when(b.since) : '') + (b.by && b.by.nick ? ' · por ' + esc(b.by.nick) : '') + (b.case ? ' · <button type="button" class="link" data-act="aCase" data-id="' + b.case.id + '">caso #' + b.case.code + '</button>' : '') + '</p>' +
          '<div class="chips">' + (b.blocks.length ? b.blocks.map((k) => '<span class="chip tone-red">' + I('lock') + esc(BLOCK[k.kind] || k.kind) + ': <span class="mono">' + esc(k.value) + '</span></span>').join('') : '<span class="chip">Sem bloqueios ativos</span>') + '</div>' +
          '<div class="tiles3 two"><div class="tile tone-red"><b>' + U.cents(b.retained_cents || 0) + '</b><small>Saldo retido</small></div><div class="tile"><b>' + U.cents(b.balance_cents || 0) + '</b><small>Saldo na carteira</small></div></div>' +
          (lv >= 2 ? '<div class="ban-actions">' +
            '<button type="button" class="btn outline sm" data-act="aRelease" data-v="nova_conta" data-id="' + b.user.id + '"' + (b.blocks.length ? '' : ' disabled') + '>' + I('userPlus') + 'Deixar criar outra conta</button>' +
            '<button type="button" class="btn ghost sm" data-act="aRelease" data-v="voltar" data-id="' + b.user.id + '">' + I('login') + 'Voltar para esta conta</button>' +
            '<button type="button" class="btn gold sm" data-act="aRelease" data-v="reativar" data-cents="' + (b.retained_cents || 0) + '" data-id="' + b.user.id + '">' + I('userCheck') + 'Reativar a conta' + (b.retained_cents > 0 ? ' (devolve ' + U.cents(b.retained_cents) + ')' : '') + '</button></div>'
            : '<p class="muted small">Só admin ou dono libera contas banidas.</p>') +
          (b.releases.length ? '<ul class="mini-log">' + b.releases.map((r) => '<li>' + U.date(r.at) + ' · ' + esc(REL[r.action]) + (r.by && r.by.nick ? ' por ' + esc(r.by.nick) : '') + ' · ' + esc(r.note) + '</li>').join('') + '</ul>' : '') +
          '</article>').join('') + '</div>' : U.empty('userCheck', 'Ninguém banido', 'Quando alguém for banido, aparece aqui.'))
    }));
  }
  const RELEASE_TXT = {
    nova_conta: ['Deixar criar outra conta?', 'Tira o aparelho, o ID do Free Fire e as chaves Pix da lista de bloqueio. <b>Esta conta continua banida</b>, mas a pessoa pode criar uma conta nova.'],
    voltar: ['Voltar para esta conta?', 'Tira o ban e os bloqueios. A pessoa volta a entrar nesta conta, com o histórico. <b>O saldo retido continua retido.</b>'],
    reativar: ['Reativar a conta?', 'Tira o ban e os bloqueios e <b>devolve o saldo retido</b> para a carteira. Use quando a punição foi um engano.']
  };
  actions.aRelease = async function (el) {
    const t = RELEASE_TXT[el.dataset.v];
    const cents = Number(el.dataset.cents || 0);
    const why = await U.confirm({ title: t[0], body: t[1] + (el.dataset.v === 'reativar' && cents > 0 ? ' Valor: <b>' + U.cents(cents) + '</b>.' : ''), ok: 'Liberar', icon: 'userCheck',
      input: { label: 'Motivo (fica na auditoria)', placeholder: 'Ex.: revisão do caso, vídeo chegou depois', required: true, error: 'Escreva o motivo.' } });
    if (!why) return;
    const r = await U.run(el, () => api.rpc('admin_ban_release', { p_user: el.dataset.id, p_action: el.dataset.v, p_note: why }));
    if (r) { U.toast(REL[el.dataset.v] + (r.returned_cents ? ' · ' + U.cents(r.returned_cents) + ' devolvidos' : ''), 'good'); A().refresh(); }
  };
  actions.aBannedGo = () => { U.closeAll(); st.adm.section = 'banned'; BH.app.replace('admin', { section: 'banned' }); };

  A().SECTION.chatlog = sectionChatLog;
  A().SECTION.banned = sectionBanned;
  BH.seguranca = { sectionChatLog };
})();
