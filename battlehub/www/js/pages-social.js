/* Ranking, guildas, chat, amigos, perfil público, denúncias e notificações */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, flows = BH.flows, st = BH.state;
  const app = () => BH.app;
  st.rkMetric = st.rkMetric || 'abates';
  st.rkPeriod = st.rkPeriod || 'mes';
  st.chatTab = st.chatTab || 'conversas';
  st.chatQ = st.chatQ || '';
  st.guildQ = st.guildQ || '';

  /* ================= RANKING ================= */
  const METRICS = [['abates', 'Abates', 'crosshair'], ['ganhos', 'Ganhos', 'dollar'], ['salas', 'Salas', 'gamepad'], ['sobrevivencia', 'Sobrevivência', 'timer'], ['vitorias', 'Vitórias', 'trophy'], ['xp', 'XP', 'sparkles']];
  function fmtMetric(m, v) {
    v = Number(v) || 0;
    if (m === 'ganhos') return U.cents(v);
    if (m === 'sobrevivencia') return v >= 60 ? Math.floor(v / 60) + 'h ' + String(v % 60).padStart(2, '0') + 'min' : v + ' min';
    return U.int(v) + (m === 'xp' ? ' XP' : '');
  }
  pages.ranking = async function () {
    const r = await api.rpc('rankings', { p_metric: st.rkMetric, p_period: st.rkPeriod, p_limit: 60 });
    const rows = r.rows || [];
    const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
    const label = (METRICS.find((m) => m[0] === st.rkMetric) || [])[1];
    return {
      html: '<section class="page">' +
        '<header class="page-head"><div><h1 class="h1">Ranking</h1><p class="muted">Conta só salas finalizadas com resultado confirmado</p></div></header>' +
        U.seg('rk-period', [{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mês' }, { id: 'total', label: 'Geral' }], st.rkPeriod, 'rkPeriod') +
        U.chips(METRICS.map((m) => [m[0], m[1], m[2]]), st.rkMetric, 'rkMetric') +
        '<div class="paid-banner">' + I('checkCircle') + '<span><b>' + U.cents(r.total_paid_cents) + '</b> pagos em prêmios ' + (st.rkPeriod === 'semana' ? 'nesta semana' : st.rkPeriod === 'mes' ? 'neste mês' : 'desde o início') + ' para os jogadores do ranking</span></div>' +
        (r.me ? '<div class="my-pos"><span>Sua posição</span><b>' + r.me.pos + 'º</b>' + U.av(api.me, 'xs') + '<span class="grow">' + esc(api.me.nick) + (api.me.anonymous ? ' <small class="muted">(anônimo)</small>' : '') + '</span><b class="gold">' + fmtMetric(st.rkMetric, r.me.value) + '</b></div>' : '') +
        (rows.length ? '<div class="podium" aria-label="Pódio de ' + esc(label) + '">' + podium.map((x) =>
          '<button type="button" class="pod pod-' + x.pos + '"' + (x.user.id ? ' data-act="profile" data-id="' + x.user.id + '"' : ' disabled') + '>' +
          (x.pos === 1 ? '<span class="pod-crown">' + I('crown') + '</span>' : '') + U.av(x.user, x.pos === 1 ? 'lg' : 'md', 'ring-' + x.pos) +
          '<b class="pod-name">' + esc(x.user.nick) + '</b><small class="pod-val">' + fmtMetric(st.rkMetric, x.value) + '</small>' +
          (st.rkMetric !== 'ganhos' && x.earned_cents > 0 ? '<small class="pod-earn">' + U.centsShort(x.earned_cents) + ' ganhos</small>' : '') +
          '<span class="pod-block"><span class="pod-num">' + x.pos + '</span></span></button>').join('') + '</div>' +
          '<ol class="rank-list stagger">' + rows.slice(3).map((x) => '<li class="' + (x.me ? 'me' : '') + '"><button type="button" class="rank-row ripple"' + (x.user.id ? ' data-act="profile" data-id="' + x.user.id + '"' : ' disabled') + '>' +
            '<span class="rk">' + x.pos + 'º</span>' + U.av(x.user, 'sm') + '<div class="grow"><b>' + U.nick(x.user, { level: true, tag: true }) + '</b><small>' + U.plural(x.rooms, 'sala', 'salas') + ' · ' + U.plural(x.kills, 'abate', 'abates') + ' · ' + U.cents(x.earned_cents) + ' ganhos</small></div>' +
            '<b class="val">' + fmtMetric(st.rkMetric, x.value) + '</b></button></li>').join('') + '</ol>'
          : U.empty('chart', 'Ninguém pontuou ainda', 'O ranking aparece depois das primeiras salas finalizadas.')) +
        '<p class="muted small center">Quem escolhe ficar anônimo aparece como "Jogador anônimo", mas o valor ganho continua visível.</p></section>'
    };
  };
  actions.rkMetric = (el) => { st.rkMetric = el.dataset.v; app().rerender('soft'); };
  actions.rkPeriod = (el) => { st.rkPeriod = el.dataset.v; app().rerender('soft'); };

  /* ================= GUILDAS ================= */
  const gTag = (g, cls) => '<span class="g-tag' + (cls ? ' ' + cls : '') + '" style="--g1:' + esc(g.color || '#7c3aed') + '">' + esc(g.tag) + '</span>';
  function guildCard(g) {
    return '<article class="g-item ripple" data-act="openGuild" data-id="' + g.id + '" tabindex="0">' + gTag(g) +
      '<div class="grow"><h4>' + esc(g.name) + (g.recruiting ? '<span class="chip tone-green">Recrutando</span>' : '<span class="chip tone-muted">Fechada</span>') + '</h4>' +
      '<p class="t-by">Líder ' + esc(g.leader.nick) + ' · ' + g.cut_pct + '% dos prêmios vão para o cofre</p>' +
      '<div class="t-meta"><span>' + I('users') + g.members + ' membros</span><span>' + I('crosshair') + U.int(g.month_kills) + ' abates no mês</span>' + (g.min_level > 1 ? '<span>' + I('star') + 'Nível ' + g.min_level + '+</span>' : '') + '</div></div><span class="chev">' + I('right') + '</span></article>';
  }
  pages.guildas = async function () {
    const [list, gr] = await Promise.all([api.rpc('list_guilds', { p_q: st.guildQ || null }), api.rpc('guild_ranking', { p_period: 'semana' }).catch(() => ({ rows: [] }))]);
    const mine = api.me.guild;
    const champ = gr.champion_last_week;
    const weekly = (gr.rows || []).length || champ
      ? '<section class="card g-week"><header class="card-row"><h3 class="card-h">' + I('trophy') + 'Ranking de guildas da semana</h3><button type="button" class="link" data-act="page" data-v="events">Eventos' + I('right') + '</button></header>' +
        (champ ? '<div class="g-champ">' + I('crown') + '<span><small>Guilda campeã da semana passada</small><b>' + gTag(champ, 'xs') + ' ' + esc(champ.name) + '</b></span><b class="pts">' + champ.points + '<small>pts</small></b></div>' : '') +
        '<ol class="stand">' + (gr.rows || []).slice(0, 5).map((x, i) => '<li><span class="rk">' + (i + 1) + 'º</span><div class="grow"><b>' + gTag(x.guild, 'xs') + ' ' + esc(x.guild.name) + '</b><span class="st-mem"><small>' + U.plural(x.events, 'evento', 'eventos') + ' · ' + x.guild.members + ' membros</small></span></div><b class="pts">' + x.points + '<small>pts</small></b></li>').join('') + '</ol>' +
        '<p class="muted small">Pontos dos intensivos e guerras de guildas: 1º 10 · 2º 7 · 3º 5 · 4º 3 · 5º 1.</p></section>'
      : '';
    return {
      html: '<section class="page"><header class="page-head"><div><h1 class="h1">Guildas</h1><p class="muted">Famílias com líder, vice e cofre próprio</p></div>' +
        (mine ? '' : '<button type="button" class="fab ripple" data-act="createGuild" aria-label="Criar guilda">' + I('plus') + '</button>') + '</header>' +
        (mine ? '<button type="button" class="my-guild ripple" data-act="openGuild" data-id="' + mine.id + '">' + gTag(mine) + '<div class="grow"><small>Sua guilda</small><b>' + esc(mine.name) + '</b><span>' + ({ lider: 'Líder', vice: 'Vice-líder', membro: 'Membro' }[mine.role]) + '</span></div>' + I('right') + '</button>' : '') +
        weekly +
        '<label class="search">' + I('search') + '<input id="g-search" type="search" placeholder="Buscar por nome ou tag" value="' + esc(st.guildQ) + '" data-input="guildQ" autocomplete="off"></label>' +
        '<div class="stack stagger">' + (list.length ? list.map(guildCard).join('') : U.empty('shield', 'Nenhuma guilda ainda', 'Crie a primeira no botão +.')) + '</div></section>'
    };
  };
  actions.openGuild = (el) => app().push('guild', { id: el.dataset.id });
  pages.guild = async function (p) {
    const g = await api.rpc('get_guild', { p_id: p.id });
    const me = api.me, role = g.my_role;
    const roleName = { lider: 'Líder', vice: 'Vice-líder', membro: 'Membro' };
    return {
      html: '<section class="page">' + BH.backRow() +
        '<header class="g-hero" style="--g1:' + esc(g.color) + '">' + gTag(g, 'xl') + '<h1 class="h1">' + esc(g.name) + '</h1><p class="muted">' + esc(g.description || 'Sem descrição.') + '</p>' +
        '<div class="tiles3 four stagger"><div class="tile"><b>' + g.members.length + '</b><small>Membros</small></div><div class="tile"><b>' + U.int(g.members.reduce((a, m) => a + m.month.kills, 0)) + '</b><small>Abates no mês</small></div><div class="tile"><b>' + g.cut_pct + '%</b><small>Para o cofre</small></div><div class="tile"><b>' + g.min_level + '+</b><small>Nível mínimo</small></div></div></header>' +
        (role ? '' : me.guild ? '<p class="muted center">Você já faz parte de outra guilda.</p>' : g.recruiting ? '<button type="button" class="btn primary block lg" data-act="joinGuild" data-id="' + g.id + '">' + I('userPlus') + 'Entrar na guilda</button>' : '<button type="button" class="btn ghost block" disabled>' + I('lock') + 'Recrutamento fechado</button>') +
        (g.vault_cents != null ? '<section class="card vault-card"><div class="vault ok"><span class="vault-ic">' + I('vault') + '</span><div class="grow"><small>Cofre da guilda</small>' + U.num(g.vault_cents, 'cents', 'big gold') + '<span>' + g.cut_pct + '% de cada prêmio dos membros cai aqui' + (g.last_payout_at ? ' · último pagamento ' + U.date(g.last_payout_at).slice(0, 5) : '') + '</span></div></div>' +
          (role === 'lider' ? '<button type="button" class="btn gold block" data-act="guildPayout" data-id="' + g.id + '"' + (g.vault_cents > 0 ? '' : ' disabled') + '>' + I('coins') + 'Pagar salários do mês</button>' : '<p class="muted small">O líder distribui o cofre no fim do mês, por desempenho ou igual para todos.</p>') + '</section>' : '') +
        '<section class="card"><header class="card-row"><h3 class="card-h">' + I('users') + 'Membros</h3>' + (role === 'lider' || role === 'vice' ? '<button type="button" class="btn ghost sm" data-act="guildSettings" data-id="' + g.id + '">' + I('settings') + 'Configurar</button>' : '') + '</header>' +
        '<ul class="member-list stagger">' + g.members.map((m) => '<li><button type="button" class="rank-row ripple" data-act="guildMember" data-id="' + m.id + '" data-guild="' + g.id + '">' + U.av(m, 'sm') +
          '<div class="grow"><b>' + U.nick(m, { level: true }) + '<span class="tag tone-' + (m.guild_role === 'lider' ? 'gold' : m.guild_role === 'vice' ? 'cyan' : 'muted') + '">' + roleName[m.guild_role] + '</span></b>' +
          '<small>No mês: ' + U.plural(m.month.kills, 'abate', 'abates') + ' · ' + U.plural(m.month.rooms, 'sala', 'salas') + (role ? ' · colocou ' + U.cents(m.contributed_cents) + ' no cofre' : '') + '</small></div></button></li>').join('') + '</ul></section>' +
        (g.log && g.log.length ? '<section class="card"><h3 class="card-h">' + I('history') + 'Movimento do cofre</h3><ul class="tx-list">' + g.log.map((l) => '<li class="tx-row"><span class="tx-ic ' + (l.amount_cents > 0 ? 'tone-green' : 'tone-red') + '">' + I(l.kind === 'contribuicao' ? 'arrowIn' : 'arrowOut') + '</span><div class="tx-main"><b>' + esc(l.user ? l.user.nick : '') + '</b><small>' + (l.kind === 'contribuicao' ? 'Parte do prêmio · ' : 'Salário · ') + esc(l.note || '') + ' · ' + U.date(l.created_at) + '</small></div><div class="tx-side"><b class="' + (l.amount_cents > 0 ? 'pos' : 'neg') + '">' + (l.amount_cents > 0 ? '+' : '−') + U.cents(Math.abs(l.amount_cents)) + '</b></div></li>').join('') + '</ul></section>' : '') +
        (role ? '<button type="button" class="btn danger-ghost block" data-act="leaveGuild">' + I('logout') + 'Sair da guilda</button>' : '') + '</section>'
    };
  };
  actions.joinGuild = async (el) => { if (await U.run(el, () => api.rpc('join_guild', { p_id: el.dataset.id }), 'Bem-vindo à guilda!')) { U.confetti(); await api.refreshMe(); app().refresh(); } };
  actions.leaveGuild = async () => {
    if (!(await U.confirm({ title: 'Sair da guilda?', body: 'Você pode entrar em outra depois.', ok: 'Sair', danger: true }))) return;
    if (await U.run(null, () => api.rpc('leave_guild'), 'Você saiu da guilda.')) { await api.refreshMe(); app().back(); }
  };
  const COLORS = ['#7c3aed', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#db2777'];
  actions.createGuild = function () {
    const max = api.me.settings.max_guild_cut_pct;
    U.sheet({
      title: 'Criar guilda', loading: false, data: { color: COLORS[0] },
      body: (s) => '<form class="form" data-form="guildCreate"><label class="field"><span>Nome</span><input id="gc-name" name="name" maxlength="24" required placeholder="Ex.: Família Brabos"></label>' +
        '<div class="grid2"><label class="field"><span>Tag</span><input id="gc-tag" name="tag" maxlength="4" required placeholder="FBR" style="text-transform:uppercase"></label>' +
        '<label class="field"><span>Nível mínimo</span><input id="gc-lvl" name="min_level" type="number" inputmode="numeric" min="1" max="60" value="1"></label></div>' +
        '<label class="field"><span>Parte dos prêmios para o cofre: <b id="gc-cut-v">10%</b></span><input id="gc-cut" name="cut_pct" type="range" min="0" max="' + max + '" step="1" value="10"></label>' +
        '<div class="field"><span>Cor</span><div class="swatches">' + COLORS.map((c) => '<button type="button" class="swatch' + (s.data.color === c ? ' on' : '') + '" style="--c:' + c + '" data-act="gcColor" data-v="' + c + '" aria-label="Cor ' + c + '"></button>').join('') + '</div></div>' +
        '<label class="field"><span>Descrição</span><textarea id="gc-desc" name="description" rows="3" maxlength="300" placeholder="Horário de treino, estilo de jogo, requisitos"></textarea></label>' +
        '<button class="btn primary block lg">' + I('shield') + 'Criar guilda</button></form>',
      onMount(s) { const r = s.body.querySelector('#gc-cut'); if (r) r.addEventListener('input', () => { s.body.querySelector('#gc-cut-v').textContent = r.value + '%'; }); }
    });
  };
  actions.gcColor = (el) => { const s = U.topSheet(); s.data.color = el.dataset.v; s.body.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b === el)); };
  forms.guildCreate = async function (f) {
    const s = U.topSheet();
    const g = await U.run(f.querySelector('button.primary'), () => api.rpc('create_guild', { p: { name: f.name.value, tag: f.tag.value, cut_pct: Number(f.cut_pct.value), min_level: Number(f.min_level.value), description: f.description.value, color: s.data.color } }), 'Guilda criada.');
    if (!g) return;
    U.closeAll(); U.confetti(); await api.refreshMe(); app().push('guild', { id: g.id });
  };
  actions.guildSettings = async function (el) {
    const g = await api.rpc('get_guild', { p_id: el.dataset.id });
    const max = api.me.settings.max_guild_cut_pct;
    U.sheet({
      title: 'Configurar ' + g.name, loading: false, data: { color: g.color },
      body: (s) => '<form class="form" data-form="guildSettings"><label class="field"><span>Parte dos prêmios para o cofre: <b id="gs-cut-v">' + g.cut_pct + '%</b></span><input id="gs-cut" name="cut_pct" type="range" min="0" max="' + max + '" step="1" value="' + g.cut_pct + '"></label>' +
        '<label class="switch"><input id="gs-rec" type="checkbox" name="recruiting"' + (g.recruiting ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Aceitando novos membros</span></label>' +
        '<label class="field"><span>Nível mínimo</span><input id="gs-lvl" name="min_level" type="number" inputmode="numeric" min="1" max="60" value="' + g.min_level + '"></label>' +
        '<div class="field"><span>Cor</span><div class="swatches">' + COLORS.map((c) => '<button type="button" class="swatch' + (s.data.color === c ? ' on' : '') + '" style="--c:' + c + '" data-act="gcColor" data-v="' + c + '" aria-label="Cor ' + c + '"></button>').join('') + '</div></div>' +
        '<label class="field"><span>Descrição</span><textarea id="gs-desc" name="description" rows="3" maxlength="300">' + esc(g.description) + '</textarea></label>' +
        '<button class="btn primary block">' + I('check') + 'Salvar</button></form>',
      onMount(s) { const r = s.body.querySelector('#gs-cut'); if (r) r.addEventListener('input', () => { s.body.querySelector('#gs-cut-v').textContent = r.value + '%'; }); }
    });
  };
  forms.guildSettings = async function (f) {
    const s = U.topSheet();
    if (await U.run(f.querySelector('button'), () => api.rpc('guild_manage', { p_action: 'settings', p_user: null, p: { cut_pct: Number(f.cut_pct.value), recruiting: f.recruiting.checked, min_level: Number(f.min_level.value), description: f.description.value, color: s.data.color } }), 'Guilda atualizada.')) { U.closeAll(); app().refresh(); }
  };
  actions.guildMember = async function (el) {
    const [p, g] = await Promise.all([api.rpc('get_profile', { p_user: el.dataset.id }), api.rpc('get_guild', { p_id: el.dataset.guild })]);
    const role = g.my_role, target = g.members.find((m) => m.id === p.id) || {};
    const mine = p.id === api.me.id;
    U.sheet({
      title: p.nick, loading: false,
      body: '<div class="pp">' + U.av(p, 'lg', 'pop') + '<h3>' + U.nick(p, { level: true }) + '</h3><p class="muted">' + ({ lider: 'Líder', vice: 'Vice-líder', membro: 'Membro' }[target.guild_role]) + ' · no mês: ' + U.plural(target.month.kills, 'abate', 'abates') + ', ' + U.plural(target.month.wins, 'vitória', 'vitórias') + '</p>' +
        '<div class="btn-row two">' + (mine ? '' : '<button type="button" class="btn outline" data-act="profile" data-id="' + p.id + '">' + I('user') + 'Perfil</button><button type="button" class="btn ghost" data-act="dm" data-id="' + p.id + '">' + I('message') + 'Mensagem</button>') + '</div>' +
        (!mine && role === 'lider' ? '<div class="org-actions"><p class="eyebrow">' + I('crown') + 'Como líder</p><div class="btn-row">' +
          (target.guild_role === 'vice' ? '<button type="button" class="btn ghost sm" data-act="gm" data-a="membro" data-id="' + p.id + '">Tirar de vice</button>' : '<button type="button" class="btn outline sm" data-act="gm" data-a="vice" data-id="' + p.id + '">' + I('shieldCheck') + 'Tornar vice-líder</button>') +
          '<button type="button" class="btn gold sm" data-act="gm" data-a="transfer" data-id="' + p.id + '">' + I('crown') + 'Passar liderança</button>' +
          '<button type="button" class="btn danger-ghost sm" data-act="gm" data-a="kick" data-id="' + p.id + '">' + I('userMinus') + 'Remover</button></div></div>'
          : !mine && role === 'vice' && target.guild_role === 'membro' ? '<button type="button" class="btn danger-ghost block sm" data-act="gm" data-a="kick" data-id="' + p.id + '">' + I('userMinus') + 'Remover da guilda</button>' : '') + '</div>'
    });
  };
  actions.gm = async function (el) {
    const a = el.dataset.a;
    const text = { vice: 'Tornar vice-líder?', membro: 'Tirar o cargo de vice?', transfer: 'Passar a liderança?', kick: 'Remover da guilda?' }[a];
    if (!(await U.confirm({ title: text, body: a === 'transfer' ? 'Você vira vice-líder e perde o controle do cofre.' : '', ok: 'Confirmar', danger: a === 'kick' || a === 'transfer' }))) return;
    if (await U.run(el, () => api.rpc('guild_manage', { p_action: a, p_user: el.dataset.id, p: {} }), 'Feito.')) { U.closeAll(); await api.refreshMe(); app().refresh(); }
  };
  actions.guildPayout = async function (el) {
    const plan = await api.rpc('guild_payout_plan', { p_id: el.dataset.id });
    const data = { mode: 'desempenho', alloc: {} };
    const fill = () => { plan.rows.forEach((r) => { data.alloc[r.user.id] = U.centsInput(data.mode === 'igual' ? r.equal_cents : r.by_performance_cents); }); };
    fill();
    const gid = el.dataset.id;
    U.sheet({
      title: 'Salários do mês', size: 'lg', data, loading: false,
      body: (s) => {
        const total = Object.values(s.data.alloc).reduce((a, v) => a + U.toCents(v), 0);
        return '<div class="vault ok"><span class="vault-ic">' + I('vault') + '</span><div class="grow"><small>Cofre</small><b>' + U.cents(plan.vault_cents) + '</b><span>O que não for distribuído fica guardado</span></div></div>' +
          U.seg('payout', [{ id: 'desempenho', label: 'Por desempenho' }, { id: 'igual', label: 'Igual para todos' }], s.data.mode, 'payMode') +
          '<p class="muted small">' + (s.data.mode === 'desempenho' ? 'Sugestão do BattleHub com base no mês: abates, vitórias, salas jogadas e quanto cada um colocou no cofre. Ajuste se quiser.' : 'O cofre dividido em partes iguais entre ' + plan.members + ' membros.') + '</p>' +
          '<ul class="pay-rows">' + plan.rows.map((r) => '<li>' + U.av(r.user, 'sm') + '<div class="grow"><b>' + esc(r.user.nick) + '</b><small>' + r.kills + ' abates · ' + r.wins + ' vitórias · ' + r.rooms + ' salas · pôs ' + U.cents(r.contributed_cents) + '</small></div>' +
            '<label class="field money-field"><b>R$</b><input id="pay-' + r.user.id + '" data-pay="' + r.user.id + '" inputmode="decimal" value="' + esc(s.data.alloc[r.user.id]) + '" aria-label="Salário de ' + esc(r.user.nick) + '"></label></li>').join('') + '</ul>' +
          '<div class="calc' + (total > plan.vault_cents ? ' bad' : '') + '" id="pay-total"><span>Total a pagar</span><b>' + U.cents(total) + '</b><small>' + (total > plan.vault_cents ? 'Passa do cofre em ' + U.cents(total - plan.vault_cents) : 'Fica no cofre: ' + U.cents(plan.vault_cents - total)) + '</small></div>' +
          '<button type="button" class="btn gold block lg" data-act="payConfirm" data-id="' + gid + '">' + I('coins') + 'Pagar salários</button>';
      },
      onMount(s) {
        if (s._wired) return; s._wired = true;
        s.body.addEventListener('input', (e) => {
          const t = e.target.closest('[data-pay]'); if (!t) return;
          s.data.alloc[t.dataset.pay] = t.value;
          const total = Object.values(s.data.alloc).reduce((a, v) => a + U.toCents(v), 0), box = s.body.querySelector('#pay-total');
          box.classList.toggle('bad', total > plan.vault_cents);
          box.innerHTML = '<span>Total a pagar</span><b>' + U.cents(total) + '</b><small>' + (total > plan.vault_cents ? 'Passa do cofre em ' + U.cents(total - plan.vault_cents) : 'Fica no cofre: ' + U.cents(plan.vault_cents - total)) + '</small>';
        });
      }
    });
    U.topSheet()._fill = fill;
  };
  actions.payMode = (el) => { const s = U.topSheet(); s.data.mode = el.dataset.v; s._fill(); s.body.querySelectorAll('[data-pay]').forEach((i) => { i.dataset.fresh = '1'; }); s.render('soft'); };
  actions.payConfirm = async function (el) {
    const s = U.topSheet();
    const alloc = Object.keys(s.data.alloc).map((uid) => ({ user_id: uid, cents: U.toCents(s.data.alloc[uid]) })).filter((a) => a.cents > 0);
    const total = alloc.reduce((a, x) => a + x.cents, 0);
    if (!(await U.confirm({ title: 'Pagar ' + U.cents(total) + '?', body: 'Cada membro recebe na carteira na hora. Não dá para desfazer.', ok: 'Pagar', icon: 'coins' }))) return;
    if (await U.run(el, () => api.rpc('guild_distribute', { p_id: el.dataset.id, p_alloc: alloc }), 'Salários pagos.')) { U.closeAll(); U.confetti(); await api.refreshMe(); app().refresh(); }
  };

  /* ================= CHAT ================= */
  pages.chat = async function () {
    const me = api.me, u = me.unread || {};
    const tabs = [{ id: 'conversas', label: 'Conversas', badge: u.privado || 0 }, { id: 'salas', label: 'Salas', badge: u.sala || 0 }, { id: 'amigos', label: 'Amigos', badge: u.friends || 0 }];
    let body = '';
    if (st.chatTab === 'amigos') {
      const [f, found] = await Promise.all([api.rpc('my_friends'), st.chatQ.trim().length >= 2 ? api.rpc('search_players', { p_q: st.chatQ }) : Promise.resolve([])]);
      body = searchBox() + (found.length ? '<ul class="stack">' + found.map(personRow).join('') + '</ul>' : '') +
        (f.incoming.length ? '<h3 class="sub-h">Pedidos de amizade</h3><ul class="stack">' + f.incoming.map((p) => '<li class="friend-row">' + U.av(p, 'md') + '<div class="grow"><b>' + U.nick(p, { level: true }) + '</b><small>quer ser seu amigo</small></div><button type="button" class="btn primary sm" data-act="friendAccept" data-id="' + p.id + '">' + I('check') + 'Aceitar</button><button type="button" class="icon-btn" data-act="friendDecline" data-id="' + p.id + '" aria-label="Recusar">' + I('x') + '</button></li>').join('') + '</ul>' : '') +
        '<h3 class="sub-h">Amigos (' + f.friends.length + ')</h3>' + (f.friends.length ? '<ul class="stack stagger">' + f.friends.map((p) => '<li class="friend-row"><span class="av-wrap">' + U.av(p, 'md') + (p.online ? '<i class="online"></i>' : '') + '</span><button type="button" class="grow link-row" data-act="profile" data-id="' + p.id + '"><b>' + U.nick(p, { level: true, tag: true }) + '</b><small>' + (p.online ? 'online agora' : 'visto ' + U.ago(p.last_seen_at)) + '</small></button><button type="button" class="btn outline sm" data-act="dm" data-id="' + p.id + '">' + I('message') + 'Conversar</button></li>').join('') + '</ul>' : '<p class="muted small">Adicione quem jogou com você para chamar pro próximo jogo.</p>') +
        (f.suggestions.length ? '<h3 class="sub-h">Jogaram com você</h3><ul class="stack">' + f.suggestions.map((p) => '<li class="friend-row">' + U.av(p, 'md') + '<button type="button" class="grow link-row" data-act="profile" data-id="' + p.id + '"><b>' + U.nick(p, { level: true }) + '</b><small>' + U.plural(p.rooms_together, 'sala juntos', 'salas juntos') + ' · ' + esc(p.last_room || '') + '</small></button><button type="button" class="btn ghost sm" data-act="friendAdd" data-id="' + p.id + '">' + I('userPlus') + 'Adicionar</button></li>').join('') + '</ul>' : '') +
        (f.outgoing.length ? '<p class="muted small">Pedidos enviados: ' + f.outgoing.map((p) => esc(p.nick)).join(', ') + '</p>' : '');
    } else {
      const kind = st.chatTab === 'salas' ? 'sala' : 'privado';
      const [threads, found] = await Promise.all([api.rpc('my_threads', { p_kind: kind }), kind === 'privado' && st.chatQ.trim().length >= 2 ? api.rpc('search_players', { p_q: st.chatQ }) : Promise.resolve([])]);
      body = (kind === 'privado' ? searchBox() + (found.length ? '<ul class="stack">' + found.map(personRow).join('') + '</ul>' : '') : '<p class="note-gold">' + I('crown') + '<span>Mensagens dos organizadores das salas em que você entrou. Responda por aqui ou direto no aviso que aparece no topo.</span></p>') +
        '<ul class="conv-list stagger">' + (threads.length ? threads.map((t) => '<li><button type="button" class="conv ripple" data-act="openThread" data-id="' + t.id + '"><span class="av-wrap">' + U.av(t.other, 'md') + (t.other.online ? '<i class="online"></i>' : '') + '</span>' +
          '<div class="grow"><b>' + U.nick(t.other) + (t.room ? '<span class="tag tone-cyan">Sala #' + t.room.code + '</span>' : '') + '</b><small>' + (t.last ? (t.last.mine ? 'Você: ' : '') + (t.last.image && !t.last.body ? 'Foto' : esc(t.last.body)) : '') + '</small></div>' +
          '<div class="conv-side"><small>' + (t.last ? U.ago(t.last.at) : '') + '</small>' + (t.unread ? '<b class="dot-count">' + t.unread + '</b>' : '') + '</div></button></li>').join('')
          : '<li>' + U.empty(kind === 'sala' ? 'crown' : 'message', kind === 'sala' ? 'Nenhuma mensagem de organizador' : 'Nenhuma conversa ainda', kind === 'sala' ? 'Quando um organizador falar com você, aparece aqui.' : 'Busque um jogador ou vá em Amigos.') + '</li>') + '</ul>';
    }
    return { html: '<section class="page"><header class="page-head"><div><h1 class="h1">Chat</h1><p class="muted">Converse com a comunidade e com os organizadores</p></div></header>' + U.seg('chat', tabs, st.chatTab, 'chatTab') + body + '</section>' };
  };
  function searchBox() { return '<label class="search">' + I('search') + '<input id="c-search" type="search" placeholder="Buscar jogador por nick, número ou ID do Free Fire" value="' + esc(st.chatQ) + '" data-input="chatQ" autocomplete="off"></label>'; }
  function personRow(p) {
    const f = p.friend;
    return '<li class="friend-row">' + U.av(p, 'md') + '<button type="button" class="grow link-row" data-act="profile" data-id="' + p.id + '"><b>' + U.nick(p, { level: true, tag: true }) + '</b><small>#' + p.code + '</small></button>' +
      (f === 'amigos' ? '' : f === 'enviado' ? '<span class="chip tone-muted">Pedido enviado</span>' : f === 'recebido' ? '<button type="button" class="btn primary sm" data-act="friendAccept" data-id="' + p.id + '">Aceitar</button>' : '<button type="button" class="icon-btn" data-act="friendAdd" data-id="' + p.id + '" aria-label="Adicionar amigo">' + I('userPlus') + '</button>') +
      '<button type="button" class="btn outline sm" data-act="dm" data-id="' + p.id + '">' + I('message') + '</button></li>';
  }
  actions.chatTab = (el) => { st.chatTab = el.dataset.v; app().rerender('soft'); };
  actions.openThread = (el) => app().push('thread', { id: el.dataset.id });
  actions.dm = async function (el) {
    const r = await U.run(el, () => api.rpc('open_thread', { p_user: el.dataset.id }));
    if (!r) return;
    U.closeAll();
    app().push('thread', { id: r.thread_id });
  };
  actions.friendAdd = async (el) => { const r = await U.run(el, () => api.rpc('friend_request', { p_user: el.dataset.id })); if (r) { U.toast(r.status === 'amigos' ? 'Agora vocês são amigos.' : 'Pedido de amizade enviado.', 'good'); const s = U.topSheet(); if (s) s.render('static'); app().refresh(); } };
  actions.friendAccept = async (el) => { if (await U.run(el, () => api.rpc('friend_respond', { p_user: el.dataset.id, p_accept: true }), 'Amizade aceita.')) { await api.refreshMe(); app().refresh(); } };
  actions.friendDecline = async (el) => { if (await U.run(el, () => api.rpc('friend_respond', { p_user: el.dataset.id, p_accept: false }))) { await api.refreshMe(); app().refresh(); } };
  actions.friendRemove = async (el) => {
    if (!(await U.confirm({ title: 'Desfazer amizade?', ok: 'Desfazer', danger: true }))) return;
    if (await U.run(el, () => api.rpc('friend_remove', { p_user: el.dataset.id }))) app().refresh();
  };

  /* conversa */
  pages.thread = async function (p) {
    const t = await api.rpc('thread_messages', { p_thread: p.id, p_before: null });
    api.refreshMe().then(() => BH.app.header()).catch(() => {});
    const o = t.other;
    let lastDay = '';
    const msgs = t.messages.map((m) => {
      const day = new Date(m.created_at).toDateString();
      const sep = day !== lastDay ? '<div class="day-sep"><span>' + U.when(m.created_at).split(',')[0].split(' · ')[0] + '</span></div>' : '';
      lastDay = day;
      return sep + '<div class="bubble' + (m.mine ? ' me' : '') + (m.image_url ? ' has-img' : '') + '">' + (m.image_url ? '<button type="button" class="msg-img" data-act="viewImage" data-v="' + esc(m.image_url) + '"><img src="' + esc(m.image_url) + '" alt="Foto" loading="lazy"></button>' : '') +
        (m.body ? '<p>' + esc(m.body) + '</p>' : '') + '<small>' + U.hm(m.created_at) + (m.mine ? (m.read ? ' ✓✓' : ' ✓') : '') + '</small></div>';
    }).join('');
    return {
      hideNav: true, bare: true, className: 'conv-page',
      subKey: 'thread:' + p.id,
      subscribe: () => {
        const ch = api.listenThread(p.id, () => app().refreshSoon());
        const onEv = () => app().refreshSoon();
        document.addEventListener('bh:thread', onEv);
        return () => { api.unlisten(ch); document.removeEventListener('bh:thread', onEv); };
      },
      html: '<section class="page conv-view"><header class="conv-head"><button type="button" class="icon-btn" data-act="back" aria-label="Voltar">' + I('back') + '</button>' +
        '<button type="button" class="conv-who" data-act="profile" data-id="' + o.id + '"><span class="av-wrap">' + U.av(o, 'sm') + (o.online ? '<i class="online"></i>' : '') + '</span><span><b>' + U.nick(o) + '</b><small>' + (t.thread.room ? 'Sala #' + t.thread.room.code + ' · ' + esc(t.thread.room.title) : o.online ? 'online' : 'offline') + '</small></span></button>' +
        (o.friend === 'nenhum' ? '<button type="button" class="icon-btn" data-act="friendAdd" data-id="' + o.id + '" aria-label="Adicionar amigo">' + I('userPlus') + '</button>' : '') + '</header>' +
        (t.thread.kind === 'sala' ? '<p class="note-gold small">' + I('crown') + '<span>Conversa com o organizador da sala.</span></p>' : '') +
        '<div class="msgs" id="msgs">' + (msgs || '<p class="muted center pad">Diga oi para ' + esc(o.nick) + '.</p>') + '</div>' +
        '<form class="composer fixed" data-form="dm" data-id="' + p.id + '"><label class="attach ripple" aria-label="Enviar foto">' + I('camera') + '<input type="file" accept="image/*" data-send="thread" data-id="' + p.id + '"></label><input id="dm-input" name="text" placeholder="Mensagem" maxlength="2000" autocomplete="off"><button class="send ripple" aria-label="Enviar">' + I('send') + '</button></form></section>',
      onMount() { window.scrollTo(0, document.documentElement.scrollHeight); }
    };
  };
  forms.dm = async function (f) {
    const input = f.querySelector('input[name=text]'), text = input.value.trim();
    if (!text) return;
    input.value = '';
    const ok = await U.run(f.querySelector('.send'), () => api.rpc('send_message', { p_thread: f.dataset.id, p_body: text, p_image: null }));
    if (!ok) { input.value = text; return; }
    await app().refresh();
    window.scrollTo(0, document.documentElement.scrollHeight);
    const i = document.getElementById('dm-input'); if (i) i.focus();
  };

  /* ================= PERFIL PÚBLICO ================= */
  actions.profile = (el) => { if (!el.dataset.id) return; U.closeAll(); if (el.dataset.id === api.me.id) return app().go('perfil'); app().push('player', { id: el.dataset.id }); };
  pages.player = async function (p) {
    const u = await api.rpc('get_profile', { p_user: p.id });
    const s = u.stats;
    return {
      html: '<section class="page profile">' + BH.backRow() +
        '<div class="p-banner" style="background:' + esc(u.banner_bg || '') + '"><span class="p-pattern"></span></div>' +
        '<div class="p-id">' + U.av(u, 'xl', 'pop') + '<h1 class="h1">' + U.nick(u) + '</h1>' + U.title(u) +
        '<div class="p-badges"><span class="lvl-tag">Nível ' + u.level + '</span>' + U.role(u.role) + (u.guild ? '<button type="button" class="tag tone-violet" data-act="openGuild" data-id="' + u.guild.id + '">' + I('shield') + esc(u.guild.tag) + '</button>' : '') + '<span class="chip mono">#' + u.code + '</span></div>' +
        (u.bio ? '<p class="p-bio">' + esc(u.bio) + '</p>' : '') + '<p class="muted small">' + (u.online ? 'Online agora' : 'Visto ' + U.ago(u.last_seen_at)) + (u.ff_nick ? ' · Free Fire: ' + esc(u.ff_nick) : '') + '</p></div>' +
        '<div class="btn-row two">' + (u.friend === 'amigos' ? '<button type="button" class="btn ghost" data-act="friendRemove" data-id="' + u.id + '">' + I('userCheck') + 'Amigos</button>' : u.friend === 'enviado' ? '<button type="button" class="btn ghost" disabled>' + I('clock') + 'Pedido enviado</button>' : u.friend === 'recebido' ? '<button type="button" class="btn primary" data-act="friendAccept" data-id="' + u.id + '">' + I('check') + 'Aceitar amizade</button>' : '<button type="button" class="btn primary" data-act="friendAdd" data-id="' + u.id + '">' + I('userPlus') + 'Adicionar amigo</button>') +
        '<button type="button" class="btn outline" data-act="dm" data-id="' + u.id + '">' + I('message') + 'Mensagem</button></div>' +
        '<div class="stat-grid stagger">' + [['crosshair', s.kills, 'Abates'], ['gamepad', s.matches, 'Salas'], ['trophy', s.wins, 'Vitórias'], ['target', s.top3, 'Top 3'], ['timer', s.survival_min, 'Min vivo'], ['droplet', s.first_bloods, '1º abate'], ['crown', s.kings_killed, 'Reis abatidos'], ['dollar', s.earnings_cents == null ? null : Math.round(s.earnings_cents / 100), 'Ganhos (R$)']]
          .map((x) => '<div class="sg"><span>' + I(x[0]) + '</span>' + (x[1] == null ? '<span class="num">–</span>' : U.num(x[1])) + '<small>' + x[2] + '</small></div>').join('') + '</div>' +
        (u.recent.length ? '<section class="card"><h3 class="card-h">' + I('history') + 'Últimas salas</h3><ul class="stack">' + u.recent.map((r) => '<li><button type="button" class="match ripple" data-act="openRoom" data-id="' + r.room_id + '"><span class="medal m-' + (r.placement === 1 ? 'gold' : r.placement === 2 ? 'silver' : r.placement === 3 ? 'bronze' : 'slate') + '">' + (r.placement ? r.placement + 'º' : '–') + '</span><div class="grow"><b>' + esc(r.title) + '</b><small>Sala #' + r.code + ' · ' + U.date(r.finished_at) + '</small></div><small>' + U.plural(r.kills, 'abate', 'abates') + '</small></button></li>').join('') + '</ul></section>' : '') +
        '<button type="button" class="btn danger-ghost block sm" data-act="report" data-id="' + u.id + '">' + I('flag') + 'Denunciar jogador</button></section>'
    };
  };
  actions.report = function (el) {
    const uid = el.dataset.id, rid = el.dataset.room || null;
    U.sheet({
      title: 'Denunciar', loading: false,
      body: '<form class="form" data-form="report" data-id="' + uid + '" data-room="' + (rid || '') + '"><p class="muted">A moderação analisa e pode suspender a conta. Denúncias falsas geram punição.</p>' +
        '<div class="radio-list">' + ['Uso de hack', 'Nick ou ID falso', 'Ofensa no chat', 'Cobrança por fora', 'Não pagou/combinado', 'Outro'].map((r, i) => '<label class="radio"><input type="radio" name="reason" value="' + r + '"' + (i === 0 ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>' +
        '<label class="field"><span>O que aconteceu?</span><textarea id="rp-detail" name="detail" rows="3" maxlength="600" placeholder="Sala, horário e o que você viu"></textarea></label>' +
        '<button class="btn danger block lg">' + I('flag') + 'Enviar denúncia</button></form>'
    });
  };
  forms.report = async function (f) {
    const d = new FormData(f);
    if (await U.run(f.querySelector('button'), () => api.rpc('report_player', { p_user: f.dataset.id, p_room: f.dataset.room || null, p_reason: d.get('reason'), p_detail: d.get('detail') }), 'Denúncia enviada para a moderação.')) U.closeAll();
  };

  /* ================= NOTIFICAÇÕES ================= */
  const NICON = { sala: 'trophy', resultado: 'trophy', deposito: 'wallet', saque: 'wallet', amizade: 'userPlus', nivel: 'sparkles', guilda: 'shield', admin: 'shieldCheck', aviso: 'megaphone', ban: 'ban', conta: 'badgeCheck' };
  actions.notifications = function () {
    U.sheet({
      title: 'Notificações',
      body: async () => {
        const list = await api.rpc('my_notifications');
        api.rpc('read_notifications').then(() => api.refreshMe()).then(() => BH.app.header()).catch(() => {});
        return '<ul class="notif-list stagger">' + (list.length ? list.map((n) => '<li class="' + (n.read ? '' : 'unread') + '"><button type="button" class="notif-btn" data-act="notifOpen" data-room="' + esc((n.data || {}).room_id || '') + '" data-guild="' + esc((n.data || {}).guild_id || '') + '" data-kind="' + esc(n.kind) + '"><span class="n-ic tone-' + (n.kind === 'ban' ? 'bad' : n.kind === 'resultado' || n.kind === 'deposito' ? 'good' : 'violet') + '">' + I(NICON[n.kind] || 'bell') + '</span><div><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p><small data-ago="' + n.created_at + '">' + U.ago(n.created_at) + '</small></div></button></li>').join('') : '<li>' + U.empty('bell', 'Tudo em dia', 'Nenhuma notificação por enquanto.') + '</li>') + '</ul>';
      }
    });
  };
  actions.notifOpen = function (el) {
    if (el.dataset.room) { U.closeAll(); return app().push('room', { id: el.dataset.room }); }
    if (el.dataset.guild) { U.closeAll(); return app().push('guild', { id: el.dataset.guild }); }
    if (el.dataset.kind === 'amizade') { U.closeAll(); st.chatTab = 'amigos'; return app().go('chat'); }
    if (el.dataset.kind === 'deposito' || el.dataset.kind === 'saque') { U.closeAll(); return flows.wallet(); }
  };
})();
