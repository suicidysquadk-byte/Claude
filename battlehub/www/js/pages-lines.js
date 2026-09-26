/* Lines da guilda: criar (solo, dupla, trio ou squad), entrar pelo código, lines recrutando com até 2 critérios,
   pedidos para entrar e sinergia (quanto mais jogam juntos, mais recompensas para todos). */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, st = BH.state;
  const app = () => BH.app;
  st.guildTab = st.guildTab || 'guildas';
  st.lineQ = st.lineQ || '';
  st.lineSize = st.lineSize || 0;
  const SIZE = { 1: 'Solo', 2: 'Dupla', 3: 'Trio', 4: 'Squad' };
  const REQ = [['', 'Sem critério'], ['nivel', 'Nível mínimo'], ['abates', 'Abates totais'], ['vitorias', 'Vitórias'], ['salas', 'Salas jogadas'], ['media', 'Média de abates por sala'], ['verificado', 'ID do Free Fire verificado']];
  const gTag = (g) => '<span class="g-tag xs" style="--g1:' + esc(g.color || '#b8841f') + '">' + esc(g.tag) + '</span>';

  function slots(l) {
    let s = '';
    for (let i = 0; i < l.size; i++) {
      const m = l.members[i];
      s += m ? '<span class="ln-slot on" title="' + esc(m.nick || '') + '">' + U.av(m, 'sm') + (m.line_role === 'lider' ? '<i class="ln-crown">' + I('crown') + '</i>' : '') + '</span>' : '<span class="ln-slot" aria-label="Vaga livre">' + I('plus') + '</span>';
    }
    return '<div class="ln-slots">' + s + '</div>';
  }
  function synergy(l) {
    const next = l.next_tier;
    const ratio = next ? Math.min(1, l.synergy / next.points) : 1;
    return '<div class="ln-syn"><div class="ln-syn-top"><span>' + I('zap') + '<b>Sinergia ' + l.synergy + '</b>' + (l.synergy_tier ? ' · nível ' + l.synergy_tier : '') + '</span>' +
      '<small>' + (next ? 'Próximo: ' + esc(next.label) + ' em ' + next.points : 'Nível máximo') + '</small></div>' + U.bar(ratio, 'gold') + '</div>';
  }
  function reqChips(l, mine) {
    if (!l.reqs.length) return '<span class="chip">Sem critérios</span>';
    return l.reqs.map((r) => '<span class="chip' + (mine === undefined ? '' : mine ? ' tone-green' : ' tone-red') + '">' + I(mine === undefined ? 'filter' : mine ? 'check' : 'x') + esc(r.label) + '</span>').join('');
  }

  /* ---------- aba Lines recrutando (busca de guildas) ---------- */
  const guildasOrig = pages.guildas;
  pages.guildas = async function () {
    const seg = U.seg('gtab', [{ id: 'guildas', label: 'Guildas' }, { id: 'lines', label: 'Lines recrutando' }], st.guildTab, 'guildTab') +
      '<button type="button" class="btn outline block sm ln-code-btn" data-act="lineCode">' + I('key') + 'Tenho um código de line</button>';
    if (st.guildTab !== 'lines') {
      const out = await guildasOrig();
      out.html = out.html.replace('</header>', '</header>' + seg);
      return out;
    }
    const list = await api.rpc('list_recruiting_lines', { p_q: st.lineQ.trim() || null, p_size: st.lineSize || null });
    return {
      html: '<section class="page"><header class="page-head"><div><h1 class="h1">Guildas</h1><p class="muted">Lines procurando jogadores. Não precisa de código: é só cumprir os critérios e pedir.</p></div></header>' + seg +
        '<label class="search">' + I('search') + '<input id="ln-search" type="search" placeholder="Buscar line, guilda ou tag" value="' + esc(st.lineQ) + '" data-input="lineQ" autocomplete="off"></label>' +
        U.chips([['0', 'Todas'], ['1', 'Solo'], ['2', 'Dupla'], ['3', 'Trio'], ['4', 'Squad']], String(st.lineSize), 'lineSize') +
        '<div class="stack stagger">' + (list.length ? list.map((l) => '<article class="card ln-card">' +
          '<header class="ln-head">' + gTag(l.guild) + '<div class="grow"><b>' + esc(l.name) + '</b><small>' + esc(l.guild.name) + ' · líder ' + esc(l.leader.nick || '') + '</small></div><span class="tag tone-gold">' + SIZE[l.size] + ' · ' + l.count + '/' + l.size + '</span></header>' +
          slots(l) + (l.description ? '<p class="muted small">' + esc(l.description) + '</p>' : '') +
          '<div class="chips">' + reqChips(l, l.eligible) + '</div>' + synergy(l) +
          (l.requested ? '<button type="button" class="btn ghost block sm" data-act="lineCancel" data-id="' + l.id + '">' + I('clock') + 'Pedido enviado · cancelar</button>'
            : l.eligible ? '<button type="button" class="btn primary block" data-act="lineAsk" data-id="' + l.id + '">' + I('userPlus') + 'Pedir para entrar</button>'
              : '<button type="button" class="btn ghost block sm" disabled>' + I('lock') + 'Você ainda não cumpre os critérios</button>') + '</article>').join('')
          : U.empty('users', 'Nenhuma line recrutando', 'Tente outro tamanho ou crie a sua line dentro de uma guilda.')) + '</div></section>'
    };
  };
  actions.guildTab = (el) => { st.guildTab = el.dataset.v; app().rerender('soft'); };
  actions.lineSize = (el) => { st.lineSize = Number(el.dataset.v); app().refresh(); };
  actions.lineCode = async function () {
    const code = await U.confirm({ title: 'Entrar numa line', body: 'Digite o código que o líder da line te passou. Se você ainda não é da guilda dela, entra na guilda junto.', ok: 'Entrar', icon: 'key',
      input: { label: 'Código da line', placeholder: 'Ex.: K7Q2MX', required: true, error: 'Digite o código.' } });
    if (!code) return;
    const l = await U.run(null, () => api.rpc('join_line_code', { p_code: code }));
    if (!l) return;
    U.toast('Você entrou na line ' + l.name + '!', 'good'); U.confetti();
    await api.refreshMe();
    app().push('guild', { id: l.guild.id });
  };
  actions.lineAsk = async function (el) {
    const msg = await U.confirm({ title: 'Pedir para entrar', body: 'O líder da line recebe o seu pedido com os seus números (nível, abates, vitórias).', ok: 'Enviar pedido', icon: 'userPlus',
      input: { label: 'Mensagem (opcional)', placeholder: 'Ex.: jogo de rush, disponível à noite' } });
    if (msg === false) return;
    if (await U.run(el, () => api.rpc('line_request', { p_line: el.dataset.id, p_message: msg === true ? '' : msg }), 'Pedido enviado ao líder.')) app().refresh();
  };
  actions.lineCancel = async (el) => { if (await U.run(el, () => api.rpc('line_cancel_request', { p_line: el.dataset.id }), 'Pedido cancelado.')) app().refresh(); };

  /* ---------- lines dentro da guilda ---------- */
  const guildOrig = pages.guild;
  pages.guild = async function (p) {
    const [out, lines] = await Promise.all([guildOrig(p), api.rpc('guild_lines', { p_guild: p.id }).catch(() => [])]);
    const me = api.me, inGuild = me.guild && me.guild.id === p.id;
    const mineLine = lines.find((l) => l.mine);
    const html = '<section class="card ln-sec"><header class="card-row"><h3 class="card-h">' + I('swords') + 'Lines</h3>' +
      (inGuild && !mineLine ? '<button type="button" class="btn primary sm" data-act="lineCreate">' + I('plus') + 'Criar line</button>' : '') + '</header>' +
      '<p class="muted small">Grupos fixos de 1 a 4 jogadores. Quanto mais a line joga junto, mais sinergia: no nível 1 todos ganham um título, depois banner e molduras.</p>' +
      (lines.length ? '<div class="stack">' + lines.map(lineBlock).join('') + '</div>' : '<p class="muted center pad">Nenhuma line ainda.' + (inGuild ? ' Crie a primeira.' : '') + '</p>') + '</section>';
    const idx = out.html.indexOf('Membros</h3>');
    const at = idx > 0 ? out.html.lastIndexOf('<section class="card">', idx) : -1;
    out.html = at > 0 ? out.html.slice(0, at) + html + out.html.slice(at) : out.html.replace('</section>', html + '</section>');
    return out;
  };
  function lineBlock(l) {
    return '<article class="ln-block' + (l.mine ? ' mine' : '') + '"><header class="ln-head"><div class="grow"><b>' + esc(l.name) + (l.mine ? ' <span class="tag tone-violet">Sua line</span>' : '') + '</b>' +
      '<small>' + SIZE[l.size] + ' · ' + l.count + '/' + l.size + (l.recruiting ? ' · recrutando' : '') + '</small></div>' +
      (l.can_manage ? '<button type="button" class="icon-btn" data-act="lineSettings" data-id="' + l.id + '" aria-label="Configurar line">' + I('settings') + '</button>' : '') + '</header>' +
      '<div class="ln-members">' + l.members.map((m) => '<button type="button" class="ln-member ripple" data-act="lineMember" data-line="' + l.id + '" data-id="' + m.id + '"' + (l.can_manage ? '' : ' data-view="1"') + '>' + U.av(m, 'sm') +
        '<span><b>' + U.nick(m) + '</b><small>' + (m.line_role === 'lider' ? 'Líder da line' : 'Membro') + '</small></span></button>').join('') +
        Array.from({ length: Math.max(0, l.size - l.count) }).map(() => '<span class="ln-member empty">' + I('plus') + '<span><b>Vaga livre</b><small>' + (l.recruiting ? 'recrutando' : 'pelo código') + '</small></span></span>').join('') + '</div>' +
      (l.reqs.length ? '<div class="chips">' + reqChips(l) + '</div>' : '') + synergy(l) +
      (l.code ? '<div class="ln-code"><span><small>Código de entrada</small><b class="mono">' + esc(l.code) + '</b></span><button type="button" class="btn ghost sm" data-act="copy" data-v="' + esc(l.code) + '">' + I('copy') + 'Copiar</button>' +
        '<button type="button" class="btn ghost sm" data-act="lineShare" data-v="' + esc(l.code) + '" data-name="' + esc(l.name) + '">' + I('send') + 'WhatsApp</button></div>' : '') +
      (l.requests && l.requests.length ? '<div class="ln-reqs"><p class="eyebrow">' + I('userPlus') + 'Querem entrar (' + l.requests.length + ')</p>' + l.requests.map((r) => '<div class="ln-req">' + U.av(r, 'sm') +
        '<div class="grow"><b>' + U.nick(r, { level: true }) + (r.in_guild ? ' <span class="tag tone-muted">' + esc(r.in_guild) + '</span>' : '') + '</b><small>Nível ' + r.stats.level + ' · ' + U.int(r.stats.kills) + ' abates · ' + r.stats.wins + ' vitórias · ' + r.stats.matches + ' salas' + (r.stats.verified ? ' · ID verificado' : '') + '</small>' +
        (r.message ? '<em>“' + esc(r.message) + '”</em>' : '') + '</div><div class="ln-req-act"><button type="button" class="btn primary sm" data-act="lineRespond" data-v="1" data-line="' + l.id + '" data-id="' + r.id + '">' + I('check') + 'Aceitar</button>' +
        '<button type="button" class="icon-btn" data-act="lineRespond" data-v="0" data-line="' + l.id + '" data-id="' + r.id + '" aria-label="Recusar">' + I('x') + '</button></div></div>').join('') + '</div>' : '') +
      (l.mine ? '<button type="button" class="btn danger-ghost sm" data-act="lineLeave">' + I('logout') + 'Sair da line</button>' : '') + '</article>';
  }
  actions.lineShare = (el) => api.openExternal('https://wa.me/?text=' + encodeURIComponent('Entra na minha line ' + el.dataset.name + ' no BattleHub! Guildas → Tenho um código de line → ' + el.dataset.v)).catch(U.err);
  actions.lineRespond = async function (el) {
    const yes = el.dataset.v === '1';
    if (await U.run(el, () => api.rpc('line_respond', { p_line: el.dataset.line, p_user: el.dataset.id, p_accept: yes }), yes ? 'Jogador aceito na line.' : 'Pedido recusado.')) { await api.refreshMe(); app().refresh(); }
  };
  actions.lineLeave = async function () {
    if (!(await U.confirm({ title: 'Sair da line?', body: 'Você continua na guilda. Se for o líder, a liderança passa para o mais antigo.', ok: 'Sair', danger: true }))) return;
    if (await U.run(null, () => api.rpc('leave_line'), 'Você saiu da line.')) app().refresh();
  };
  actions.lineMember = function (el) {
    if (el.dataset.view) return actions.profile(el);
    const uid = el.dataset.id, lid = el.dataset.line, self = uid === api.me.id;
    U.sheet({
      title: 'Jogador da line', loading: false,
      body: '<div class="btn-row"><button type="button" class="btn outline" data-act="profile" data-id="' + uid + '">' + I('user') + 'Ver perfil</button>' +
        (self ? '' : '<button type="button" class="btn ghost" data-act="lineAct" data-v="transfer" data-line="' + lid + '" data-id="' + uid + '">' + I('crown') + 'Passar liderança</button>' +
          '<button type="button" class="btn danger-ghost" data-act="lineAct" data-v="kick" data-line="' + lid + '" data-id="' + uid + '">' + I('userMinus') + 'Tirar da line</button>') + '</div>'
    });
  };
  actions.lineAct = async function (el) {
    const v = el.dataset.v;
    if (!(await U.confirm({ title: v === 'kick' ? 'Tirar da line?' : 'Passar a liderança?', ok: 'Confirmar', danger: v === 'kick' }))) return;
    if (await U.run(el, () => api.rpc('line_manage', { p_line: el.dataset.line, p_action: v, p_user: el.dataset.id, p: {} }), 'Feito.')) { U.closeAll(); app().refresh(); }
  };

  /* criar e configurar */
  function lineForm(l) {
    const d = l || { name: '', size: 4, recruiting: false, description: '', reqs: [] };
    const req = (i) => {
      const r = d.reqs[i] || {};
      return '<div class="grid2"><label class="field"><span>Critério ' + (i + 1) + '</span><select id="lf-k' + i + '" name="k' + i + '">' + REQ.map((o) => '<option value="' + o[0] + '"' + ((r.kind || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Mínimo</span><input id="lf-v' + i + '" name="v' + i + '" inputmode="decimal" placeholder="Ex.: 10" value="' + (r.kind === 'media' ? String(r.value / 10).replace('.', ',') : r.value || '') + '"></label></div>';
    };
    return '<form class="form" data-form="lineSave" data-id="' + (l ? l.id : '') + '">' +
      '<label class="field"><span>Nome da line</span><input id="lf-name" name="name" maxlength="20" required value="' + esc(d.name) + '" placeholder="Ex.: Alfa"></label>' +
      '<fieldset class="field"><span>Tamanho</span><div class="radio-list row">' + [1, 2, 3, 4].map((n) => '<label class="radio"><input type="radio" name="size" value="' + n + '"' + (d.size === n ? ' checked' : '') + '><span>' + SIZE[n] + ' (' + n + ')</span></label>').join('') + '</div></fieldset>' +
      '<label class="field"><span>Descrição</span><input id="lf-desc" name="description" maxlength="200" value="' + esc(d.description || '') + '" placeholder="Horário, estilo de jogo"></label>' +
      '<label class="switch"><input type="checkbox" name="recruiting"' + (d.recruiting ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Recrutando <small>Aparece em "Lines recrutando". Quem cumprir os critérios pede para entrar sem código e você aceita.</small></span></label>' +
      '<p class="eyebrow">Até 2 critérios para quem pede</p>' + req(0) + req(1) +
      '<button class="btn primary block lg">' + I(l ? 'check' : 'plus') + (l ? 'Salvar' : 'Criar line') + '</button>' +
      (l ? '<div class="btn-row"><button type="button" class="btn ghost sm" data-act="lineNewCode" data-id="' + l.id + '">' + I('refresh') + 'Trocar código</button><button type="button" class="btn danger-ghost sm" data-act="lineDelete" data-id="' + l.id + '">' + I('trash') + 'Apagar line</button></div>' : '') + '</form>';
  }
  actions.lineCreate = () => U.sheet({ title: 'Criar line', loading: false, body: lineForm(null) });
  actions.lineSettings = function (el) {
    U.sheet({
      title: 'Configurar line',
      body: async () => { const list = await api.rpc('guild_lines', { p_guild: (api.me.guild || {}).id }); const l = list.find((x) => x.id === el.dataset.id); return l ? lineForm(l) : U.empty('alert', 'Line não encontrada', ''); }
    });
  };
  forms.lineSave = async function (f) {
    const val = (k, v) => (k === 'media' ? Math.round(Number(String(v).replace(',', '.')) * 10) : Math.round(Number(String(v).replace(',', '.')) || 0));
    const p = { name: f.name.value, size: Number(new FormData(f).get('size')), description: f.description.value, recruiting: f.recruiting.checked,
      req1_kind: f.k0.value, req1_value: val(f.k0.value, f.v0.value), req2_kind: f.k1.value, req2_value: val(f.k1.value, f.v1.value) };
    const r = await U.run(f.querySelector('button.primary'), () => (f.dataset.id ? api.rpc('line_manage', { p_line: f.dataset.id, p_action: 'settings', p_user: null, p }) : api.rpc('create_line', { p })), f.dataset.id ? 'Line salva.' : 'Line criada! Passe o código para os parceiros.');
    if (r) { U.closeAll(); app().refresh(); }
  };
  actions.lineNewCode = async (el) => { if (await U.run(el, () => api.rpc('line_manage', { p_line: el.dataset.id, p_action: 'new_code', p_user: null, p: {} }), 'Código novo gerado. O antigo não vale mais.')) { U.closeAll(); app().refresh(); } };
  actions.lineDelete = async function (el) {
    if (!(await U.confirm({ title: 'Apagar a line?', body: 'Todos saem da line (continuam na guilda) e a sinergia acumulada é perdida.', ok: 'Apagar', danger: true }))) return;
    if (await U.run(el, () => api.rpc('line_manage', { p_line: el.dataset.id, p_action: 'delete', p_user: null, p: {} }), 'Line apagada.')) { U.closeAll(); app().refresh(); }
  };
})();
