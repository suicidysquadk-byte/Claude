/* Eventos oficiais: liga semanal, campeonato de lines, intensivo de guildas e copas.
   Lista, página do evento (classificação, quedas, prêmios), inscrição de line e painel da organização. */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, flows = BH.flows, st = BH.state;
  const app = () => BH.app;
  st.evTab = st.evTab || 'ativos';
  st.evStand = st.evStand || {};

  const KIND = { liga: ['Liga semanal', 'chart'], campeonato: ['Campeonato', 'trophy'], intensivo: ['Intensivo de guildas', 'shield'], copa: ['Copa', 'zap'] };
  const STATUS = { inscricoes: ['Inscrições abertas', 'green'], andamento: ['Em andamento', 'red'], finalizado: ['Finalizado', 'muted'], cancelado: ['Cancelado', 'red'] };
  const AWARD = {
    mvp: ['MVP (mais abates)', 'trophy'], line_agressiva: ['Line mais agressiva', 'flame'], maior_pontuador_mapa: ['Maior pontuador por mapa', 'map'],
    dominio: ['Domínio absoluto (mais Booyahs)', 'gem'], clutch: ['Clutch extremo', 'zap'], line_tatica: ['Line mais tática', 'map'], destaque: ['Destaque do evento', 'star']
  };
  const MANUAL = ['clutch', 'destaque', 'line_tatica'];
  BH.EVENT_AWARDS = AWARD;
  const unit = (e) => (e.entry_type === 'jogador' ? 'jogador' : e.line_size === 2 ? 'dupla' : e.line_size === 4 ? 'line' : 'inscrição');
  function priceLabel(e) {
    if (e.price_steps && e.price_steps.length) return e.price_steps.map((c) => U.centsShort(c).replace('R$ ', '')).join(' / ') + ' por ' + unit(e);
    if (!e.entry_cents) return e.entry_type === 'jogador' ? 'Grátis · paga por queda' : 'Grátis';
    return U.cents(e.entry_cents) + ' por ' + unit(e);
  }
  const statusTag = (e) => '<span class="tag tone-' + (STATUS[e.status] || ['', 'muted'])[1] + '">' + (e.status === 'andamento' ? '<i class="dot-live"></i>' : '') + (STATUS[e.status] || [e.status])[0] + '</span>';
  const phaseName = (e, i) => ((e.phases || [])[i] || {}).name || 'Fase ' + (i + 1);

  BH.eventCard = function (e) {
    const k = KIND[e.kind] || ['Evento', 'trophy'];
    return '<article class="event-card k-' + e.kind + ' ripple" data-act="openEvent" data-id="' + e.id + '" tabindex="0"><span class="ev-glow" aria-hidden="true"></span>' +
      '<header><span class="ev-kind">' + I(k[1]) + k[0] + '</span>' + statusTag(e) + (e.my_entry ? '<span class="tag tone-violet">' + I('check') + 'Inscrito</span>' : '') + '</header>' +
      '<h4>' + esc(e.title) + '</h4>' + (e.description ? '<p class="ev-desc">' + esc(e.description) + '</p>' : '') +
      '<div class="ev-money"><div><small>Premiação</small><b class="gold">' + U.cents(e.prize_total_cents) + '</b></div><div><small>Inscrição</small><b>' + esc(priceLabel(e)) + '</b></div></div>' +
      '<footer><span>' + I('users') + e.entries + (e.max_entries ? '/' + e.max_entries : '') + ' ' + (e.entry_type === 'jogador' ? 'jogadores' : 'lines') + '</span>' +
      '<span>' + I('flag') + esc(phaseName(e, e.current_phase)) + '</span>' + (e.starts_at ? '<span>' + I('calendar') + U.date(e.starts_at) + '</span>' : '') + '</footer></article>';
  };
  actions.openEvent = (el) => { U.closeAll(); app().push('event', { id: el.dataset.id }); };

  /* ================= LISTA ================= */
  pages.events = async function () {
    const list = await api.rpc('list_events', { p_tab: st.evTab });
    const me = api.me;
    return {
      html: '<section class="page events-page">' + BH.backRow() +
        '<header class="page-head"><div><h1 class="h1">Eventos oficiais</h1><p class="muted">Liga semanal, campeonatos de lines, intensivo de guildas e copas da plataforma</p></div>' +
        (me.role_level >= 2 ? '<button type="button" class="fab ripple" data-act="eventNew" aria-label="Criar evento">' + I('plus') + '</button>' : '') + '</header>' +
        U.seg('ev', [{ id: 'ativos', label: 'Ativos' }, { id: 'meus', label: 'Meus' }, { id: 'encerrados', label: 'Encerrados' }], st.evTab, 'evTab') +
        '<div class="stack stagger">' + (list.length ? list.map(BH.eventCard).join('') : U.empty('trophy', st.evTab === 'meus' ? 'Você ainda não entrou em eventos' : 'Nenhum evento aqui agora', 'Os eventos oficiais aparecem aqui assim que a organização abrir as inscrições.')) + '</div>' +
        '<section class="card how"><h3 class="card-h">' + I('info') + 'Como funciona</h3><ul class="how-list">' +
        '<li>' + I('users') + '<span><b>Inscrição</b> por jogador ou por line. O capitão paga a line e escolhe os parceiros pelo número do perfil.</span></li>' +
        '<li>' + I('crosshair') + '<span><b>Pontos</b> por abate e por colocação em cada queda. A classificação atualiza sozinha.</span></li>' +
        '<li>' + I('flag') + '<span><b>Fases</b>: os melhores de cada fase passam para a próxima.</span></li>' +
        '<li>' + I('trophy') + '<span><b>Prêmios</b> caem na carteira no fim do evento, com título de campeão para quem vencer.</span></li></ul></section></section>'
    };
  };
  actions.evTab = (el) => { st.evTab = el.dataset.v; app().rerender('soft'); };

  /* ================= EVENTO ================= */
  function standingsTable(rows, e, showStatus) {
    if (!rows || !rows.length) return '<p class="muted center pad">Ninguém pontuou ainda.</p>';
    const q = ((e.phases || [])[e.current_phase] || {}).qualify;
    return '<ol class="stand">' + rows.map((x, i) => '<li class="' + (x.status === 'eliminado' ? 'out' : '') + (q && i < q && e.status === 'andamento' && !showStatus ? ' in-zone' : '') + (e.my_entry && e.my_entry.id === x.entry_id ? ' me' : '') + '">' +
      '<span class="rk">' + (i + 1) + 'º</span><div class="grow"><b>' + esc(x.name) + (x.guild ? ' <span class="g-tag xs" style="--g1:' + esc(x.guild.color) + '">' + esc(x.guild.tag) + '</span>' : '') + (x.group ? ' <small class="chip">Grupo ' + esc(x.group) + '</small>' : '') + '</b>' +
      '<span class="st-mem">' + (x.members || []).slice(0, 4).map((m) => U.av(m, 'xs')).join('') + '<small>' + x.drops + ' queda' + (x.drops === 1 ? '' : 's') + ' · ' + x.booyahs + ' Booyah' + (x.booyahs === 1 ? '' : 's') + ' · ' + x.kills + ' abates</small></span></div>' +
      (showStatus && x.status !== 'inscrito' ? '<span class="tag tone-' + (x.status === 'classificado' ? 'green' : 'muted') + '">' + (x.status === 'classificado' ? 'Classificado' : 'Eliminado') + '</span>' : '') +
      '<b class="pts">' + x.points + '<small>pts</small></b></li>').join('') + '</ol>';
  }

  pages.event = async function (p) {
    const e = await api.rpc('get_event', { p_id: p.id });
    const me = api.me, k = KIND[e.kind] || ['Evento', 'trophy'];
    const lastPhase = (e.phases || []).length - 1;
    const tabs = (e.phases || []).slice(0, e.current_phase + 1).map((ph, i) => ({ id: String(i), label: ph.name || 'Fase ' + (i + 1) }));
    if (e.current_phase > 0) tabs.push({ id: 'geral', label: 'Geral' });
    const cur = st.evStand[e.id] != null ? st.evStand[e.id] : String(e.current_phase);
    const rows = cur === 'geral' ? e.overall : (e.standings[Number(cur)] || []);
    const byPhase = {};
    (e.rooms || []).forEach((r) => { (byPhase[r.phase || 0] = byPhase[r.phase || 0] || []).push(r); });

    let cta = '';
    if (e.my_entry) {
      cta = '<div class="cta-bar"><div><small>' + (e.entry_type === 'jogador' ? 'Você está na classificação' : 'Sua line') + '</small><b class="green">' + I('checkCircle') + esc(e.my_entry.name) + '</b></div>' +
        (e.status === 'inscricoes' && e.my_entry.captain ? '<button type="button" class="btn ghost" data-act="evLeave" data-id="' + e.id + '">Sair</button>' : '') + '</div>';
    } else if (e.status === 'inscricoes' && !(e.entry_type === 'jogador' && !e.entry_cents && e.kind === 'liga')) {
      cta = '<div class="cta-bar"><div><small>Inscrição</small><b>' + (e.my_price_cents ? U.cents(e.my_price_cents) + ' por ' + unit(e) : 'Grátis') + '</b></div><button type="button" class="btn primary" data-act="evJoin" data-id="' + e.id + '">' + I('zap') + (e.entry_type === 'jogador' ? 'Participar' : 'Inscrever line') + '</button></div>';
    } else if (e.entry_type === 'jogador' && e.status !== 'finalizado' && e.status !== 'cancelado') {
      cta = '<p class="note-gold">' + I('info') + '<span>Entre nas quedas da ' + esc(k[0].toLowerCase()) + ' abaixo: seus pontos entram na classificação sozinhos.</span></p>';
    }

    const admin = e.can_manage && (e.status === 'inscricoes' || e.status === 'andamento')
      ? '<section class="card manage"><h3 class="card-h">' + I('sliders') + 'Painel da organização</h3>' +
        '<div class="vault ok"><span class="vault-ic">' + I('vault') + '</span><div class="grow"><small>Cofre do evento</small><b>' + U.cents(e.vault_cents) + '</b><span>Prêmios de ' + U.cents(e.prize_total_cents) + ' · a plataforma completa o que faltar</span></div></div>' +
        '<div class="btn-row">' +
        '<button type="button" class="btn primary sm" data-act="evDrops" data-id="' + e.id + '">' + I('plus') + 'Criar quedas · ' + esc(phaseName(e, e.current_phase)) + '</button>' +
        (e.status === 'inscricoes' ? '<button type="button" class="btn outline sm" data-act="evStart" data-id="' + e.id + '">' + I('play') + 'Fechar inscrições</button>' : '') +
        (e.status === 'andamento' && e.current_phase < lastPhase ? '<button type="button" class="btn outline sm" data-act="evClose" data-id="' + e.id + '">' + I('flag') + 'Fechar fase (top ' + (((e.phases || [])[e.current_phase] || {}).qualify || '?') + ')</button>' : '') +
        (e.status === 'andamento' && e.current_phase === lastPhase ? '<button type="button" class="btn gold sm" data-act="evFinish" data-id="' + e.id + '">' + I('trophy') + 'Finalizar e pagar</button>' : '') +
        '<button type="button" class="btn ghost sm" data-act="evEdit" data-id="' + e.id + '">' + I('edit') + 'Editar</button>' +
        '<button type="button" class="btn danger-ghost sm" data-act="evCancel" data-id="' + e.id + '">' + I('ban') + 'Cancelar</button></div></section>'
      : '';

    const res = e.results;
    const champ = res && res.champion;
    return {
      html: '<section class="page event-page k-' + e.kind + '">' + BH.backRow() +
        '<header class="event-hero"><span class="ev-glow" aria-hidden="true"></span><div class="t-tags"><span class="ev-kind">' + I(k[1]) + k[0] + '</span><span class="room-code">#' + e.code + '</span>' + BH.tierTag(e.tier) + statusTag(e) + '</div>' +
        '<h1 class="h1">' + esc(e.title) + '</h1>' + (e.description ? '<p class="muted">' + esc(e.description) + '</p>' : '') +
        '<div class="tiles3 four stagger"><div class="tile tone-gold"><span>' + I('trophy') + '</span><b>' + U.centsShort(e.prize_total_cents) + '</b><small>Premiação</small></div>' +
        '<div class="tile"><span>' + I('coins') + '</span><b>' + (e.my_price_cents ? U.centsShort(e.my_price_cents) : 'Grátis') + '</b><small>Por ' + unit(e) + '</small></div>' +
        '<div class="tile"><span>' + I('users') + '</span><b>' + e.entries + (e.max_entries ? '/' + e.max_entries : '') + '</b><small>' + (e.entry_type === 'jogador' ? 'Jogadores' : 'Lines de ' + e.line_size) + '</small></div>' +
        '<div class="tile"><span>' + I('flag') + '</span><b>' + (e.current_phase + 1) + '/' + (lastPhase + 1) + '</b><small>' + esc(phaseName(e, e.current_phase)) + '</small></div></div>' +
        (e.starts_at ? '<p class="ev-when">' + I('calendar') + 'Começa ' + U.when(e.starts_at) + (e.ends_at ? ' · termina ' + U.when(e.ends_at) : '') + '</p>' : '') +
        (e.status === 'cancelado' ? '<p class="t-cancel">' + I('alert') + 'Cancelado: ' + esc(e.cancel_reason || '') + '. As inscrições foram devolvidas.</p>' : '') + '</header>' +
        (champ ? '<section class="champ-card"><span class="champ-crown">' + I('crown') + '</span><small>Campeões</small><h2>' + esc(champ.name) + '</h2><div class="champ-mem">' + (champ.members || []).map((m) => U.av(m, 'md')).join('') + '</div><p>' + champ.points + ' pontos · ' + champ.booyahs + ' Booyahs · ' + champ.kills + ' abates</p></section>' : '') +
        cta + admin +
        '<section class="card"><h3 class="card-h">' + I('flag') + 'Fases</h3><ol class="phases">' + (e.phases || []).map((ph, i) => '<li class="' + (i < e.current_phase || e.status === 'finalizado' ? 'done' : i === e.current_phase ? 'now' : '') + '"><span class="ph-dot">' + (i < e.current_phase || e.status === 'finalizado' ? I('check') : i + 1) + '</span><div><b>' + esc(ph.name || 'Fase ' + (i + 1)) + '</b><small>' + (ph.drops ? ph.drops + ' quedas' : '') + (ph.qualify ? ' · passam ' + ph.qualify : i === lastPhase ? ' · decide o campeão' : '') + '</small></div></li>').join('') + '</ol></section>' +
        '<section class="card"><header class="card-row"><h3 class="card-h">' + I('chart') + 'Classificação</h3>' + (cur !== 'geral' && e.status === 'andamento' && ((e.phases || [])[Number(cur)] || {}).qualify ? '<span class="muted small">Top ' + e.phases[Number(cur)].qualify + ' passa</span>' : '') + '</header>' +
        (tabs.length > 1 ? U.seg('evs-' + e.id, tabs, cur, 'evStand', 'sm') : '') + standingsTable(rows, e, cur === 'geral' || e.status === 'finalizado') +
        '<p class="muted small">Desempate: pontos, depois Booyahs, abates e melhor colocação.</p></section>' +
        (e.guild_table && e.guild_table.length ? '<section class="card"><h3 class="card-h">' + I('shield') + 'Pontos de guilda</h3><ol class="stand">' + e.guild_table.map((g, i) => '<li><span class="rk">' + (i + 1) + 'º</span><div class="grow"><b><span class="g-tag xs" style="--g1:' + esc(g.guild.color) + '">' + esc(g.guild.tag) + '</span> ' + esc(g.guild.name) + '</b></div><b class="pts">' + g.points + '<small>pts</small></b></li>').join('') + '</ol></section>' : '') +
        (e.rooms && e.rooms.length ? '<section class="card"><h3 class="card-h">' + I('gamepad') + 'Quedas</h3>' + Object.keys(byPhase).map((ph) => '<h4 class="sub-h">' + esc(phaseName(e, Number(ph))) + '</h4><ul class="drops">' + byPhase[ph].map((r) =>
          '<li><button type="button" class="drop-row ripple" data-act="openRoom" data-id="' + r.id + '"><span class="drop-n">' + (r.group_label ? esc(r.group_label) : '') + (r.drop_no || '') + '</span><div class="grow"><b>' + esc(r.title) + '</b><small>' + esc(r.map) + ' · ' + U.date(r.starts_at) + ' · ' + r.players + '/' + r.max_players + '</small></div>' +
          (r.status === 'em_andamento' ? '<span class="live"><i></i>Ao vivo</span>' : r.status === 'finalizada' ? '<span class="tag tone-muted">' + I('check') + 'Feita</span>' : r.joined ? '<span class="tag tone-violet">Você joga</span>' : '<span class="mono small" data-until="' + new Date(r.starts_at).getTime() + '">' + U.until(r.starts_at) + '</span>') + '</button></li>').join('') + '</ul>').join('') + '</section>' : '') +
        '<section class="card"><h3 class="card-h">' + I('trophy') + 'Premiação</h3><ol class="split">' + (e.prizes || []).map((z) => '<li><span class="medal m-' + (z.place === 1 ? 'gold' : z.place === 2 ? 'silver' : z.place === 3 ? 'bronze' : 'slate') + '">' + z.place + 'º</span><span class="grow">' + (z.note ? esc(z.note) : e.entry_type === 'line' ? 'Dividido na line' : 'Colocação final') + '</span><b>' + U.cents(z.cents) + '</b></li>').join('') + '</ol>' +
        ((e.awards || []).length ? '<h4 class="sub-h">Bônus do evento</h4><ul class="mech-list">' + e.awards.map((a) => '<li><span class="mech-ic">' + I((AWARD[a.type] || [0, 'star'])[1]) + '</span><div class="grow"><b>' + esc((AWARD[a.type] || [a.type])[0]) + '</b>' + (a.maps && a.maps.length ? '<small>' + a.maps.map(esc).join(', ') + ' (cada)</small>' : MANUAL.includes(a.type) ? '<small>Escolhido pela organização</small>' : '') + '</div><b class="gold">' + U.cents(a.cents) + '</b></li>').join('') + '</ul>' : '') +
        ((e.guild_points || []).length ? '<p class="muted small">Pontos de guilda pela colocação: ' + e.guild_points.map((v, i) => (i + 1) + 'º ' + v).join(' · ') + '. Somam na Guilda campeã da semana.</p>' : '') + '</section>' +
        '<section class="card"><h3 class="card-h">' + I('hash') + 'Pontuação por queda</h3><div class="pts-grid"><span><b>' + e.points.kill + '</b><small>por abate</small></span>' + (e.points.place || []).map((v, i) => '<span><b>' + v + '</b><small>' + (i === 0 ? 'Booyah' : (i + 1) + 'º') + '</small></span>').join('') + '</div></section>' +
        (e.rules ? '<section class="card"><h3 class="card-h">' + I('file') + 'Regras</h3><p class="rules">' + esc(e.rules) + '</p></section>' : '') +
        '</section>'
    };
  };
  actions.evStand = (el) => { const cur = app().current(); st.evStand[cur.params.id] = el.dataset.v; app().rerender('soft'); };

  /* inscrição de line (o capitão paga) */
  actions.evJoin = async function (el) {
    const [e, fr] = await Promise.all([api.rpc('get_event', { p_id: el.dataset.id }), api.rpc('my_friends').catch(() => ({ friends: [] })), api.refreshMe()]);
    const me = api.me;
    const slots = e.entry_type === 'jogador' ? 0 : e.line_size - 1;
    const pool = (fr.friends || []).slice(0, 24);
    let guildMates = [];
    if (me.guild) { try { guildMates = ((await api.rpc('get_guild', { p_id: me.guild.id })).members || []).filter((m) => m.id !== me.id); } catch (err) { guildMates = []; } }
    const suggestions = (e.require_guild ? guildMates : pool.concat(guildMates.filter((g) => !pool.some((f) => f.id === g.id)))).slice(0, 24);
    const after = me.balance_cents - e.my_price_cents;
    U.sheet({
      title: e.entry_type === 'jogador' ? 'Participar' : 'Inscrever line', loading: false, data: { members: Array(slots).fill('') },
      body: (s) => '<form class="form" data-form="evJoin" data-id="' + e.id + '"><div class="confirm-t"><h3>' + esc(e.title) + '</h3><p class="muted">' + esc((KIND[e.kind] || ['Evento'])[0]) + (e.require_guild ? ' · só lines da mesma guilda' : '') + '</p></div>' +
        (slots ? '<label class="field"><span>Nome da line</span><input id="ev-name" name="name" maxlength="24" required placeholder="Ex.: ' + esc(me.guild ? me.guild.tag + ' Alpha' : 'Os Brabos') + '"></label>' +
          '<div class="field"><span>Parceiros (número do perfil, ex.: #10233)</span>' + s.data.members.map((v, i) => '<input id="ev-m' + i + '" class="ev-slot" data-slot="' + i + '" inputmode="numeric" required placeholder="Jogador ' + (i + 2) + '" value="' + esc(v) + '">').join('') + '</div>' +
          (suggestions.length ? '<div class="field"><span>' + (e.require_guild ? 'Sua guilda' : 'Amigos e guilda') + ' · toque para adicionar</span><div class="pick-row">' + suggestions.map((f) => '<button type="button" class="pick ripple" data-act="evPick" data-v="#' + f.code + '">' + U.av(f, 'xs') + '<span>' + esc(f.nick) + '</span></button>').join('') + '</div></div>' : '') : '') +
        '<dl class="ledger"><div><dt>Inscrição' + (e.price_steps && e.price_steps.length ? ' (' + (e.my_guild ? 'preço da sua guilda' : 'preço cheio') + ')' : '') + '</dt><dd>' + (e.my_price_cents ? U.cents(e.my_price_cents) : 'Grátis') + '</dd></div><div><dt>Seu saldo</dt><dd>' + U.cents(me.balance_cents) + '</dd></div><div class="total"><dt>Saldo depois</dt><dd class="' + (after < 0 ? 'red' : '') + '">' + U.cents(after) + '</dd></div></dl>' +
        (after < 0 ? '<p class="note-red">' + I('alert') + '<span>Faltam ' + U.cents(-after) + '.</span></p><button type="button" class="btn primary block lg" data-act="deposit" data-v="' + Math.max(me.settings.min_deposit_cents, -after) + '">' + I('plus') + 'Adicionar saldo</button>'
          : '<button class="btn primary block lg">' + I('zap') + (slots ? 'Pagar e inscrever a line' : 'Confirmar') + '</button><p class="muted small center">O capitão paga a inscrição. Se desistir antes do início, o valor volta.</p>') + '</form>',
      onMount(s) {
        if (s._wired) return;
        s._wired = true;
        s.body.addEventListener('input', (ev) => { const t = ev.target; if (t.dataset.slot != null) s.data.members[Number(t.dataset.slot)] = t.value; });
      }
    });
  };
  actions.evPick = function (el) {
    const s = U.topSheet(), list = s.data.members;
    if (list.includes(el.dataset.v)) return;
    const i = list.findIndex((x) => !x.trim());
    if (i < 0) return U.toast('A line já está completa.', 'info');
    list[i] = el.dataset.v;
    const inp = document.getElementById('ev-m' + i); if (inp) inp.value = el.dataset.v;
  };
  forms.evJoin = async function (f) {
    const s = U.topSheet();
    const p = { name: f.name ? f.name.value.trim() : '', members: s.data.members.map((x) => x.trim()).filter(Boolean) };
    const r = await U.run(f.querySelector('button.primary'), () => api.rpc('event_register', { p_id: f.dataset.id, p }), 'Inscrição confirmada!');
    if (!r) return;
    U.closeAll(); U.confetti();
    await api.refreshMe();
    app().refresh();
  };
  actions.evLeave = async function (el) {
    if (!(await U.confirm({ title: 'Tirar a line do evento?', body: 'A inscrição volta para a sua carteira.', ok: 'Sair do evento', danger: true }))) return;
    if (await U.run(el, () => api.rpc('event_withdraw', { p_id: el.dataset.id }), 'Você saiu do evento.')) { await api.refreshMe(); app().refresh(); }
  };

  /* ================= ORGANIZAÇÃO ================= */
  actions.evStart = async function (el) {
    if (!(await U.confirm({ title: 'Fechar as inscrições?', body: 'O evento entra em andamento e os inscritos são avisados.', ok: 'Fechar inscrições', icon: 'play' }))) return;
    if (await U.run(el, () => api.rpc('admin_event_status', { p_id: el.dataset.id, p_status: 'andamento', p_reason: null }), 'Evento em andamento.')) app().refresh();
  };
  actions.evCancel = async function (el) {
    const reason = await U.confirm({ title: 'Cancelar o evento?', body: 'As quedas abertas são canceladas e cada capitão recebe a inscrição de volta.', ok: 'Cancelar evento', danger: true, input: { label: 'Motivo', required: true, error: 'Escreva o motivo.' } });
    if (!reason) return;
    if (await U.run(el, () => api.rpc('admin_event_status', { p_id: el.dataset.id, p_status: 'cancelado', p_reason: reason }), 'Evento cancelado e valores devolvidos.')) { await api.refreshMe(); app().refresh(); }
  };
  actions.evClose = async function (el) {
    if (!(await U.confirm({ title: 'Fechar a fase?', body: 'Os primeiros da classificação passam para a próxima fase e os outros ficam eliminados. Todos são avisados.', ok: 'Fechar fase', icon: 'flag' }))) return;
    if (await U.run(el, () => api.rpc('admin_event_close_phase', { p_id: el.dataset.id }), 'Fase fechada.')) { st.evStand = {}; app().refresh(); }
  };
  actions.evDrops = async function (el) {
    const e = await api.rpc('get_event', { p_id: el.dataset.id });
    const open = e.entry_type === 'jogador' && e.current_phase === 0;
    const ph = (e.phases || [])[e.current_phase] || {};
    const d = { maps: ['Bermuda', 'Kalahari', 'Purgatório', 'Alpine'].slice(0, e.kind === 'campeonato' ? 4 : 1) };
    const maps = BH.MAPS || ['Bermuda'];
    U.sheet({
      title: 'Criar quedas · ' + (ph.name || 'Fase ' + (e.current_phase + 1)), size: 'lg', data: d, loading: false,
      body: (s) => '<form class="form" data-form="evDrops" data-id="' + e.id + '">' +
        '<p class="muted">' + (open ? 'Salas oficiais abertas: cada jogador entra e paga a inscrição da queda. Os pontos vão para a classificação da liga.' : 'As ' + (e.entry_type === 'line' ? 'lines' : 'jogadores') + ' ' + (e.current_phase ? 'classificados' : 'inscritos') + ' são divididos em grupos e colocados nas salas automaticamente.') + '</p>' +
        '<div class="grid2"><label class="field"><span>Quantas quedas</span><input name="count" type="number" inputmode="numeric" min="1" max="20" value="' + (Math.min(ph.drops || 4, open ? 7 : 8)) + '"></label>' +
        '<label class="field"><span>Intervalo (min)</span><input name="gap" type="number" inputmode="numeric" min="5" max="240" value="25"></label></div>' +
        '<label class="field"><span>Primeira queda</span><input name="starts" type="datetime-local" required value="' + U.localInput(Date.now() + 3600e3) + '"></label>' +
        '<div class="field"><span>Mapas (em rodízio)</span><div class="chips">' + maps.map((m) => '<button type="button" class="chip-btn' + (s.data.maps.includes(m) ? ' on' : '') + '" data-act="evMap" data-v="' + esc(m) + '">' + esc(m) + '</button>').join('') + '</div></div>' +
        '<div class="grid2"><label class="field"><span>Jogadores por sala</span><input name="max" type="number" inputmode="numeric" min="2" max="100" value="48"></label>' +
        '<label class="field money-field"><span>Primeira kill por queda</span><b>R$</b><input name="fb" inputmode="decimal" value="' + (e.kind === 'campeonato' ? '50,00' : '0,00') + '"></label></div>' +
        (open ? '<h3 class="form-h">' + I('coins') + 'Cada queda</h3><div class="grid2"><label class="field money-field"><span>Inscrição por jogador</span><b>R$</b><input name="entry" inputmode="decimal" value="5,00"></label><label class="field money-field"><span>Kill paga</span><b>R$</b><input name="kill" inputmode="decimal" value="1,00"></label></div>' +
          '<div class="grid3"><label class="field money-field"><span>1º</span><b>R$</b><input name="p1" inputmode="decimal" value="60,00"></label><label class="field money-field"><span>2º</span><b>R$</b><input name="p2" inputmode="decimal" value="30,00"></label><label class="field money-field"><span>3º</span><b>R$</b><input name="p3" inputmode="decimal" value="15,00"></label></div>' : '') +
        '<button class="btn primary block lg">' + I('plus') + 'Criar quedas</button></form>'
    });
  };
  actions.evMap = function (el) { const s = U.topSheet(), list = s.data.maps, v = el.dataset.v; s.data.maps = list.includes(v) ? list.filter((x) => x !== v) : list.concat(v); if (!s.data.maps.length) s.data.maps = [v]; s.render('static'); };
  forms.evDrops = async function (f) {
    const s = U.topSheet();
    const g = (n) => (f[n] ? f[n].value : '');
    const mech = [];
    if (U.toCents(g('fb')) > 0) mech.push({ type: 'first_blood', cents: U.toCents(g('fb')) });
    if (f.kill && U.toCents(g('kill')) > 0) mech.push({ type: 'por_kill', cents: U.toCents(g('kill')) });
    const p = { count: Number(g('count')), interval_min: Number(g('gap')), starts_at: new Date(g('starts')).toISOString(), maps: s.data.maps, max_players: Number(g('max')), mechanics: mech,
      entry_cents: f.entry ? U.toCents(g('entry')) : 0,
      prizes: f.p1 ? [1, 2, 3].map((n) => ({ place: n, cents: U.toCents(g('p' + n)) })).filter((z) => z.cents > 0) : [] };
    if (await U.run(f.querySelector('button.primary'), () => api.rpc('admin_event_drops', { p_id: f.dataset.id, p }), 'Quedas criadas.')) { U.closeAll(); app().refresh(); }
  };

  // prévia e pagamento final do evento
  actions.evFinish = async function (el) {
    const e = await api.rpc('get_event', { p_id: el.dataset.id });
    const people = [];
    (e.overall || []).forEach((x) => (x.members || []).forEach((m) => { if (!people.some((p) => p.id === m.id)) people.push(Object.assign({ line: x.name }, m)); }));
    const need = (e.awards || []).filter((a) => MANUAL.includes(a.type));
    const data = { picks: {}, preview: null };
    U.sheet({
      title: 'Finalizar ' + e.title, size: 'lg', data, loading: false,
      body: (s) => {
        const d = s.data;
        if (d.preview) {
          const pv = d.preview, group = {};
          pv.lines.forEach((l) => { (group[l.user_id] = group[l.user_id] || { user: l.user, lines: [] }).lines.push(l); });
          return '<div class="preview">' + (pv.champion ? '<section class="champ-card sm"><span class="champ-crown">' + I('crown') + '</span><small>Campeões</small><h2>' + esc(pv.champion.name) + '</h2></section>' : '') +
            '<div class="tiles3"><div class="tile"><b>' + U.centsShort(pv.vault_cents) + '</b><small>Cofre</small></div><div class="tile tone-green"><b>' + U.centsShort(pv.payout_cents) + '</b><small>Prêmios</small></div><div class="tile ' + (pv.cover_platform_cents ? 'tone-gold' : 'tone-cyan') + '"><b>' + U.centsShort(pv.cover_platform_cents || pv.platform_cents) + '</b><small>' + (pv.cover_platform_cents ? 'A plataforma completa' : 'Sobra da plataforma') + '</small></div></div>' +
            (pv.unpaid_cents ? '<p class="muted small center">' + U.cents(pv.unpaid_cents) + ' em bônus que não aconteceram.</p>' : '') +
            (pv.guild_points && pv.guild_points.length ? '<p class="note-gold">' + I('shield') + '<span>Pontos de guilda: ' + pv.guild_points.map((g) => esc(g.guild.tag) + ' +' + g.points).join(' · ') + '</span></p>' : '') +
            '<ul class="pv-list">' + Object.keys(group).map((uid) => '<li>' + U.av(group[uid].user, 'sm') + '<div class="grow"><b>' + esc((group[uid].user || {}).nick || '') + '</b>' + group[uid].lines.map((l) => '<small>' + I(l.kind === 'evento_premio' ? 'trophy' : 'medal') + esc(l.note) + ' · ' + U.cents(l.cents) + '</small>').join('') + '</div><b class="pos">+' + U.cents(group[uid].lines.reduce((a, l) => a + Number(l.cents), 0)) + '</b></li>').join('') + '</ul>' +
            '<p class="note-gold">' + I('alert') + '<span>Depois de confirmar, os prêmios caem nas carteiras, o campeão ganha o título e o evento é encerrado.</span></p>' +
            '<div class="btn-row two"><button type="button" class="btn ghost" data-act="evFinBack">' + I('back') + 'Voltar</button><button type="button" class="btn gold" data-act="evFinConfirm" data-id="' + e.id + '">' + I('check') + 'Confirmar e pagar</button></div></div>';
        }
        return '<form class="form" data-form="evFinPreview" data-id="' + e.id + '"><p class="muted">A classificação final define os prêmios. MVP, line mais agressiva, maior pontuador por mapa e domínio são calculados sozinhos.</p>' +
          need.map((a) => a.type === 'line_tatica'
            ? '<label class="field"><span>' + I('map') + (AWARD[a.type] || [a.type])[0] + ' · ' + U.cents(a.cents) + '</span><select data-evpick="line_tatica"><option value="">Ninguém</option>' + (e.overall || []).map((x) => '<option value="' + x.entry_id + '"' + (d.picks.line_tatica === x.entry_id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>'
            : '<label class="field"><span>' + I((AWARD[a.type] || [0, 'star'])[1]) + (AWARD[a.type] || [a.type])[0] + ' · ' + U.cents(a.cents) + '</span><select data-evpick="' + a.type + '"><option value="">Ninguém</option>' + people.map((m) => '<option value="' + m.id + '"' + (d.picks[a.type] === m.id ? ' selected' : '') + '>' + esc(m.nick) + ' · ' + esc(m.line) + '</option>').join('') + '</select></label>').join('') +
          '<button class="btn gold block lg">' + I('eye') + 'Ver prévia do pagamento</button></form>';
      },
      onMount(s) {
        if (s._wired) return;
        s._wired = true;
        s.body.addEventListener('change', (ev) => { const t = ev.target; if (t.dataset.evpick) s.data.picks[t.dataset.evpick] = t.value; });
      }
    });
  };
  const picksOf = (s) => Object.fromEntries(Object.entries(s.data.picks).filter((x) => x[1]));
  forms.evFinPreview = async function (f) {
    const s = U.topSheet();
    const pv = await U.run(f.querySelector('button.gold'), () => api.rpc('admin_event_preview', { p_id: f.dataset.id, p_picks: picksOf(s) }));
    if (!pv) return;
    s.data.preview = pv; s.render('soft');
  };
  actions.evFinBack = () => { const s = U.topSheet(); s.data.preview = null; s.render('soft'); };
  actions.evFinConfirm = async function (el) {
    const s = U.topSheet();
    const r = await U.run(el, () => api.rpc('admin_event_finish', { p_id: el.dataset.id, p_picks: picksOf(s) }));
    if (!r) return;
    U.closeAll(); U.confetti();
    U.toast(U.cents(r.payout_cents) + ' pagos. Campeões: ' + ((r.champion || {}).name || '—') + '.', 'money');
    await api.refreshMe();
    app().refresh();
  };

  /* ================= CRIAR / EDITAR EVENTO ================= */
  const MAPS4 = ['Bermuda', 'Kalahari', 'Purgatório', 'Alpine'];
  const PRESETS = {
    liga: { kind: 'liga', title: 'Liga Semanal', tier: 'elite', description: '14 quedas por semana (7 na sexta, 7 no sábado). Os 12 melhores jogam a grande final.', entry_type: 'jogador', line_size: 1, entry_cents: 0,
      points: { kill: 2, place: [15, 10, 8, 6, 6, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] }, phases: [{ name: 'Semana', drops: 14, qualify: 12 }, { name: 'Grande final', drops: 1, qualify: null }],
      prizes: [{ place: 1, cents: 10000, note: 'Campeão da semana' }, { place: 2, cents: 5000 }, { place: 3, cents: 2500 }], awards: [{ type: 'mvp', cents: 3000 }], guild_points: [],
      rules: 'Pontos: kill +2 · Booyah +15 · 2º +10 · 3º +8 · 4º e 5º +6 · 6º ao 10º +4 · 11º ao 20º +2 · 21º em diante 0.\nCada queda é uma sala oficial com inscrição própria e prêmio da queda.\nOs 12 melhores da semana jogam a grande final. O vencedor é o Campeão da semana.' },
    campeonato: { kind: 'campeonato', title: 'Champions Series', tier: 'ancestral', description: '32 lines de 4. Fase de grupos, semifinal com as 16 melhores e final com as 8.', entry_type: 'line', line_size: 4, entry_cents: 25000, max_entries: 32,
      points: { kill: 1, place: [12, 9, 8, 7, 6, 5, 4, 3, 2, 1] }, phases: [{ name: 'Fase de grupos', drops: 8, qualify: 16 }, { name: 'Semifinal', drops: 6, qualify: 8 }, { name: 'Final', drops: 8, qualify: null }],
      prizes: [{ place: 1, cents: 240000 }, { place: 2, cents: 160000 }, { place: 3, cents: 100000 }, { place: 4, cents: 60000 }],
      awards: [{ type: 'mvp', cents: 40000 }, { type: 'line_agressiva', cents: 30000 }, { type: 'clutch', cents: 20000 }, { type: 'maior_pontuador_mapa', cents: 15000, maps: MAPS4 }, { type: 'dominio', cents: 20000 }], guild_points: [],
      rules: 'R$ 250 por line de 4 · 32 lines.\nFase de grupos: 2 dias × 4 quedas. Semifinal: top 16, 6 quedas. Final: top 8, 8 quedas.\nPontos: kill 1 · Booyah 12 · 2º 9 · 3º 8 · 4º 7 · 5º 6 · 6º 5 · 7º 4 · 8º 3 · 9º 2 · 10º 1.\nPrimeira kill: R$ 50 por queda. Clutch extremo: 4 abates sozinho na última queda (se não acontecer, vale o último clutch do campeonato).\nDesempate: pontos, Booyahs, abates, melhor colocação.' },
    intensivo: { kind: 'intensivo', title: 'Intensivo de Lines', tier: 'intermediaria', description: 'Treino oficial de guildas com preço progressivo por line e ranking de guildas.', entry_type: 'line', line_size: 4, entry_cents: 2000, price_steps: [2000, 1500, 1200], require_guild: true,
      points: { kill: 1, place: [10, 5, 3] }, phases: [{ name: 'Treino', drops: 5, qualify: null }], prizes: [{ place: 1, cents: 5000, note: '+ diamantes' }, { place: 2, cents: 2500, note: '+ diamantes' }],
      awards: [{ type: 'mvp', cents: 1000 }, { type: 'line_agressiva', cents: 1000 }, { type: 'line_tatica', cents: 1000 }, { type: 'destaque', cents: 1000 }], guild_points: [10, 7, 5, 3, 1],
      rules: '3 a 5 quedas. Kill 1 · Booyah 10 · 2º 5 · 3º 3.\n1ª line da guilda R$ 20, 2ª R$ 15, 3ª em diante R$ 12.\nPontos de guilda: 1º 10 · 2º 7 · 3º 5 · 4º 3 · 5º 1. Somam na Guilda campeã da semana.\nDesempate: Booyah, abates, colocação.' },
    copa: { kind: 'copa', title: 'Copa Relâmpago', tier: 'base', description: 'Uma noite, 3 quedas, pontos corridos. Rápida e valendo título.', entry_type: 'jogador', line_size: 1, entry_cents: 0,
      points: { kill: 1, place: [12, 9, 8, 7, 6, 5, 4, 3, 2, 1] }, phases: [{ name: 'Noite', drops: 3, qualify: null }], prizes: [{ place: 1, cents: 5000 }, { place: 2, cents: 2500 }, { place: 3, cents: 1000 }], awards: [{ type: 'mvp', cents: 1000 }], guild_points: [],
      rules: '3 quedas seguidas na mesma noite. Soma de pontos das 3 quedas. Cada queda tem inscrição e prêmio próprios.' },
    duplas: { kind: 'copa', title: 'Copa das Duplas', tier: 'intermediaria', description: 'Duplas de parceiros, 4 quedas, final com as 8 melhores duplas.', entry_type: 'line', line_size: 2, entry_cents: 2000, max_entries: 48,
      points: { kill: 1, place: [12, 9, 8, 7, 6, 5, 4, 3, 2, 1] }, phases: [{ name: 'Classificatória', drops: 4, qualify: 8 }, { name: 'Final', drops: 3, qualify: null }],
      prizes: [{ place: 1, cents: 30000 }, { place: 2, cents: 15000 }, { place: 3, cents: 8000 }], awards: [{ type: 'line_agressiva', cents: 5000 }, { type: 'clutch', cents: 3000 }], guild_points: [],
      rules: 'R$ 20 por dupla. Classificatória com 4 quedas; as 8 melhores duplas jogam a final.' },
    guildas: { kind: 'intensivo', title: 'Guerra de Guildas', tier: 'elite', description: 'As guildas se enfrentam com várias lines. A guilda que somar mais pontos vence a semana.', entry_type: 'line', line_size: 4, entry_cents: 4000, price_steps: [4000, 3000, 2500], require_guild: true,
      points: { kill: 1, place: [12, 9, 8, 7, 6, 5, 4, 3, 2, 1] }, phases: [{ name: 'Guerra', drops: 6, qualify: null }], prizes: [{ place: 1, cents: 20000 }, { place: 2, cents: 10000 }, { place: 3, cents: 5000 }],
      awards: [{ type: 'mvp', cents: 5000 }, { type: 'dominio', cents: 5000 }], guild_points: [15, 10, 7, 5, 3, 2, 1],
      rules: 'Cada guilda inscreve quantas lines quiser (preço cai a partir da 2ª line). 6 quedas. Pontos de guilda para as 7 melhores lines.' }
  };
  const PRESET_LABEL = { liga: 'Liga Semanal', campeonato: 'Champions Series', intensivo: 'Intensivo de Lines', copa: 'Copa Relâmpago', duplas: 'Copa das Duplas', guildas: 'Guerra de Guildas' };
  BH.EVENT_PRESETS = PRESETS;
  actions.eventNew = function () {
    U.sheet({
      title: 'Novo evento', loading: false,
      body: '<p class="muted">Comece de um formato pronto (como nas imagens de referência) e ajuste valores, fases e datas.</p><div class="preset-grid">' +
        Object.keys(PRESETS).map((k) => { const p = PRESETS[k]; return '<button type="button" class="preset ripple k-' + p.kind + '" data-act="eventPreset" data-v="' + k + '">' + I((KIND[p.kind] || [0, 'trophy'])[1]) + '<b>' + PRESET_LABEL[k] + '</b><small>' + esc(p.description) + '</small></button>'; }).join('') + '</div>'
    });
  };
  actions.eventPreset = (el) => { U.closeAll(); flows.eventForm(JSON.parse(JSON.stringify(PRESETS[el.dataset.v]))); };
  actions.evEdit = async (el) => flows.eventForm(await api.rpc('get_event', { p_id: el.dataset.id }));

  flows.eventForm = function (src) {
    const d = {
      id: src.id || '', kind: src.kind, title: src.title || '', description: src.description || '', rules: src.rules || '', tier: src.tier || '',
      entry_type: src.entry_type || 'line', line_size: src.line_size || 4, entry: U.centsInput(src.entry_cents || 0),
      steps: (src.price_steps || []).map((c) => U.centsInput(c)).join('; '), max_entries: src.max_entries || '', require_guild: !!src.require_guild,
      kill: (src.points || {}).kill != null ? src.points.kill : 1, place: ((src.points || {}).place || []).join(', '),
      phases: (src.phases || [{ name: 'Fase única', drops: 4, qualify: null }]).map((p) => ({ name: p.name || '', drops: p.drops || '', qualify: p.qualify || '' })),
      prizes: (src.prizes || []).map((z) => ({ value: U.centsInput(z.cents), note: z.note || '' })),
      awards: (src.awards || []).map((a) => ({ type: a.type, value: U.centsInput(a.cents), maps: (a.maps || []).join(', ') })),
      guild_points: (src.guild_points || []).join(', '), starts: src.starts_at ? U.localInput(src.starts_at) : '', ends: src.ends_at ? U.localInput(src.ends_at) : ''
    };
    const tiers = BH.TIERS || {};
    U.sheet({
      title: d.id ? 'Editar evento' : 'Criar evento', size: 'lg', data: d, loading: false,
      body: (s) => { const v = s.data; return '<form class="form ev-form" data-form="eventSave">' +
        '<div class="grid2"><label class="field"><span>Tipo</span><select data-ef="kind">' + Object.keys(KIND).map((k) => '<option value="' + k + '"' + (v.kind === k ? ' selected' : '') + '>' + KIND[k][0] + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Nível</span><select data-ef="tier"><option value="">Sem nível</option>' + Object.keys(tiers).map((k) => '<option value="' + k + '"' + (v.tier === k ? ' selected' : '') + '>' + tiers[k][0] + '</option>').join('') + '</select></label></div>' +
        '<label class="field"><span>Nome</span><input data-ef="title" maxlength="60" required value="' + esc(v.title) + '"></label>' +
        '<label class="field"><span>Descrição curta</span><input data-ef="description" maxlength="200" value="' + esc(v.description) + '"></label>' +
        '<div class="grid2"><label class="field"><span>Início</span><input data-ef="starts" type="datetime-local" value="' + esc(v.starts) + '"></label><label class="field"><span>Fim</span><input data-ef="ends" type="datetime-local" value="' + esc(v.ends) + '"></label></div>' +
        '<h3 class="form-h">' + I('users') + 'Inscrição</h3>' +
        '<div class="grid2"><label class="field"><span>Quem se inscreve</span><select data-ef="entry_type"><option value="line"' + (v.entry_type === 'line' ? ' selected' : '') + '>Line (capitão paga)</option><option value="jogador"' + (v.entry_type === 'jogador' ? ' selected' : '') + '>Jogador</option></select></label>' +
        '<label class="field"><span>Jogadores por line</span><select data-ef="line_size">' + [1, 2, 4].map((n) => '<option' + (Number(v.line_size) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div>' +
        '<div class="grid2"><label class="field money-field"><span>Valor da inscrição</span><b>R$</b><input data-ef="entry" inputmode="decimal" value="' + esc(v.entry) + '"></label>' +
        '<label class="field"><span>Máximo de inscrições</span><input data-ef="max_entries" type="number" inputmode="numeric" min="2" placeholder="Sem limite" value="' + esc(v.max_entries) + '"></label></div>' +
        '<label class="field"><span>Preço progressivo por line da mesma guilda (ex.: 20,00; 15,00; 12,00)</span><input data-ef="steps" placeholder="Vazio = preço único" value="' + esc(v.steps) + '"></label>' +
        '<label class="switch"><input type="checkbox" data-efb="require_guild"' + (v.require_guild ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Só lines da mesma guilda <small>Para treinos e guerras de guildas</small></span></label>' +
        '<h3 class="form-h">' + I('hash') + 'Pontos por queda</h3>' +
        '<div class="grid2"><label class="field"><span>Por abate</span><input data-ef="kill" type="number" inputmode="numeric" min="0" max="20" value="' + esc(v.kill) + '"></label>' +
        '<label class="field"><span>Por colocação (1º, 2º, 3º...)</span><input data-ef="place" value="' + esc(v.place) + '"></label></div>' +
        '<h3 class="form-h">' + I('flag') + 'Fases</h3><ul class="ev-rows">' + v.phases.map((p, i) => '<li><input data-ph="' + i + '" data-k="name" placeholder="Nome" value="' + esc(p.name) + '"><input data-ph="' + i + '" data-k="drops" type="number" inputmode="numeric" placeholder="Quedas" value="' + esc(p.drops) + '"><input data-ph="' + i + '" data-k="qualify" type="number" inputmode="numeric" placeholder="' + (i === v.phases.length - 1 ? 'Final' : 'Passam') + '" value="' + esc(p.qualify) + '">' + (v.phases.length > 1 ? '<button type="button" class="icon-btn" data-act="efDel" data-list="phases" data-v="' + i + '" aria-label="Remover fase">' + I('trash') + '</button>' : '') + '</li>').join('') + '</ul>' +
        '<button type="button" class="btn ghost sm" data-act="efAdd" data-list="phases">' + I('plus') + 'Adicionar fase</button>' +
        '<h3 class="form-h">' + I('trophy') + 'Prêmios pela colocação final</h3><ul class="ev-rows">' + v.prizes.map((z, i) => '<li><span class="medal m-' + (i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'slate') + '">' + (i + 1) + 'º</span><label class="money-field"><b>R$</b><input data-pz="' + i + '" data-k="value" inputmode="decimal" value="' + esc(z.value) + '"></label><input data-pz="' + i + '" data-k="note" placeholder="Extra (ex.: + diamantes)" value="' + esc(z.note) + '"><button type="button" class="icon-btn" data-act="efDel" data-list="prizes" data-v="' + i + '" aria-label="Remover">' + I('trash') + '</button></li>').join('') + '</ul>' +
        '<button type="button" class="btn ghost sm" data-act="efAdd" data-list="prizes">' + I('plus') + 'Adicionar ' + (v.prizes.length + 1) + 'º lugar</button>' +
        '<h3 class="form-h">' + I('medal') + 'Bônus do evento</h3><ul class="ev-rows">' + v.awards.map((a, i) => '<li><select data-aw="' + i + '" data-k="type">' + Object.keys(AWARD).map((k) => '<option value="' + k + '"' + (a.type === k ? ' selected' : '') + '>' + AWARD[k][0] + '</option>').join('') + '</select><label class="money-field"><b>R$</b><input data-aw="' + i + '" data-k="value" inputmode="decimal" value="' + esc(a.value) + '"></label>' +
          (a.type === 'maior_pontuador_mapa' ? '<input data-aw="' + i + '" data-k="maps" placeholder="Mapas separados por vírgula" value="' + esc(a.maps) + '">' : '') + '<button type="button" class="icon-btn" data-act="efDel" data-list="awards" data-v="' + i + '" aria-label="Remover">' + I('trash') + '</button></li>').join('') + '</ul>' +
        '<button type="button" class="btn ghost sm" data-act="efAdd" data-list="awards">' + I('plus') + 'Adicionar bônus</button>' +
        '<label class="field"><span>Pontos de guilda pela colocação (ex.: 10, 7, 5, 3, 1)</span><input data-ef="guild_points" placeholder="Vazio = sem ranking de guildas" value="' + esc(v.guild_points) + '"></label>' +
        '<label class="field"><span>Regras</span><textarea data-ef="rules" rows="5" maxlength="4000">' + esc(v.rules) + '</textarea></label>' +
        '<button class="btn primary block lg">' + I('check') + (v.id ? 'Salvar evento' : 'Publicar evento') + '</button></form>'; },
      onMount(s) {
        if (s._wired) return;
        s._wired = true;
        const set = (t) => {
          const v = s.data;
          if (t.dataset.ef) v[t.dataset.ef] = t.value;
          if (t.dataset.ph != null) v.phases[Number(t.dataset.ph)][t.dataset.k] = t.value;
          if (t.dataset.pz != null) v.prizes[Number(t.dataset.pz)][t.dataset.k] = t.value;
          if (t.dataset.aw != null) v.awards[Number(t.dataset.aw)][t.dataset.k] = t.value;
        };
        s.body.addEventListener('input', (ev) => set(ev.target));
        s.body.addEventListener('change', (ev) => { const t = ev.target; set(t); if (t.dataset.efb) s.data[t.dataset.efb] = t.checked; if ((t.dataset.aw != null && t.dataset.k === 'type') || t.dataset.ef === 'entry_type') s.render('static'); });
      }
    });
  };
  actions.efAdd = function (el) {
    const s = U.topSheet(), v = s.data, l = el.dataset.list;
    if (l === 'phases') v.phases.push({ name: 'Fase ' + (v.phases.length + 1), drops: 4, qualify: '' });
    if (l === 'prizes') v.prizes.push({ value: '10,00', note: '' });
    if (l === 'awards') v.awards.push({ type: 'mvp', value: '10,00', maps: '' });
    s.render('static');
  };
  actions.efDel = function (el) { const s = U.topSheet(); s.data[el.dataset.list].splice(Number(el.dataset.v), 1); s.render('static'); };
  const nums = (txt) => String(txt || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
  forms.eventSave = async function (f) {
    const v = U.topSheet().data;
    const p = {
      id: v.id || null, kind: v.kind, title: v.title, description: v.description, rules: v.rules, tier: v.tier || null,
      entry_type: v.entry_type, line_size: v.entry_type === 'jogador' ? 1 : Number(v.line_size), entry_cents: U.toCents(v.entry),
      price_steps: String(v.steps || '').split(';').map((x) => x.trim()).filter(Boolean).map(U.toCents).filter((c) => c > 0),
      max_entries: v.max_entries ? Number(v.max_entries) : null, require_guild: !!v.require_guild,
      points: { kill: Number(v.kill) || 0, place: nums(v.place) },
      phases: v.phases.map((p2, i) => ({ name: p2.name || 'Fase ' + (i + 1), drops: Number(p2.drops) || null, qualify: i < v.phases.length - 1 ? Number(p2.qualify) || null : null })),
      prizes: v.prizes.map((z, i) => Object.assign({ place: i + 1, cents: U.toCents(z.value) }, z.note ? { note: z.note } : {})).filter((z) => z.cents > 0),
      awards: v.awards.map((a) => Object.assign({ type: a.type, cents: U.toCents(a.value) }, a.type === 'maior_pontuador_mapa' ? { maps: String(a.maps || '').split(',').map((x) => x.trim()).filter(Boolean) } : {})).filter((a) => a.cents > 0),
      guild_points: nums(v.guild_points), starts_at: v.starts ? new Date(v.starts).toISOString() : null, ends_at: v.ends ? new Date(v.ends).toISOString() : null
    };
    const r = await U.run(f.querySelector('button.primary'), () => api.rpc('admin_event_save', { p }), v.id ? 'Evento salvo.' : 'Evento publicado.');
    if (!r) return;
    U.closeAll();
    if (v.id) app().refresh(); else app().push('event', { id: r.id });
  };
})();
