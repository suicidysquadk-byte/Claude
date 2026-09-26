/* Perfil: progresso e recompensas, loja, visual, carteira (Pix), verificação do Free Fire */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, flows = BH.flows, st = BH.state;
  const app = () => BH.app;
  st.shopTab = st.shopTab || 'banner';

  const LEDGER = {
    deposito: ['Depósito', 'arrowIn'], saque: ['Saque', 'arrowOut'], saque_estorno: ['Saque devolvido', 'refresh'], inscricao: ['Inscrição', 'gamepad'],
    reembolso: ['Reembolso', 'refresh'], premio: ['Prêmio', 'trophy'], first_blood: ['Primeiro abate', 'droplet'], rei: ['Player Rei', 'crown'],
    por_kill: ['Abates', 'crosshair'], mvp: ['Líder de abates', 'trophy'], sorteio: ['Sorteio', 'dice'], lucro_sala: ['Sobra da sala', 'vault'], garantia: ['Garantia', 'vault'],
    booyah: ['Booyah', 'medal'], rei_lobby: ['Rei do lobby', 'crown'], destaque: ['Destaque', 'star'], sobrevivente: ['Top 5 vivo', 'heart'], meta_abates: ['Meta de abates', 'target'],
    clutch: ['Clutch', 'zap'], line_agressiva: ['Line agressiva', 'flame'], line_tatica: ['Line tática', 'map'], dominio: ['Domínio absoluto', 'gem'],
    evento_premio: ['Prêmio de evento', 'trophy'], evento_bonus: ['Bônus de evento', 'medal'], inscricao_evento: ['Inscrição em evento', 'trophy'],
    cofre_guilda: ['Cofre da guilda', 'shield'], salario_guilda: ['Salário da guilda', 'shield'], compra: ['Loja', 'bag'], ajuste: ['Ajuste', 'sliders']
  };
  BH.ledgerRow = function (l) {
    const k = LEDGER[l.kind] || [l.kind, 'wallet'], pos = l.amount_cents > 0;
    return '<li class="tx-row"><span class="tx-ic ' + (pos ? 'tone-green' : 'tone-red') + '">' + I(k[1]) + '</span><div class="tx-main"><b>' + esc(l.note || k[0]) + '</b><small>' + esc(k[0]) + ' · ' + U.date(l.created_at) + '</small></div>' +
      '<div class="tx-side"><b class="' + (pos ? 'pos' : 'neg') + '">' + (pos ? '+' : '−') + U.cents(Math.abs(l.amount_cents)) + '</b><small>Saldo ' + U.cents(l.balance_after) + '</small></div></li>';
  };
  const ffStatus = { aprovado: ['tone-cyan', 'badgeCheck', 'ID verificado'], pendente: ['tone-violet', 'clock', 'Em análise'], recusado: ['tone-red', 'alert', 'Recusado'], nao_enviado: ['tone-gold', 'shield', 'Não enviado'] };

  // exclusão da conta (Play Store exige para apps com login)
  actions.deleteAccount = async function () {
    const me = await api.refreshMe();
    const bal = me.balance_cents;
    const typed = await U.confirm({ title: 'Excluir sua conta?', danger: true, icon: 'userX', ok: 'Excluir para sempre',
      body: 'Seu nick, foto, e-mail e dados do Free Fire são apagados e você perde o acesso. O histórico de pagamentos fica guardado sem seus dados, como manda a lei.' +
        (bal > 0 ? '<br><br><b>Você ainda tem ' + U.cents(bal) + ' na carteira.</b> Se continuar, abre mão desse valor. Para receber, faça o saque antes.' : ''),
      input: { label: 'Digite EXCLUIR para confirmar', placeholder: 'EXCLUIR', required: true, error: 'Digite EXCLUIR.' } });
    if (!typed) return;
    if (String(typed).trim().toUpperCase() !== 'EXCLUIR') return U.toast('Digite EXCLUIR para confirmar.', 'bad');
    const r = await U.run(null, async () => { await api.removeMyFiles(); return api.rpc('delete_my_account', { p_forfeit: bal > 0 }); });
    if (!r) return;
    await api.signOut();
    BH.app.setSession(null);
    U.toast('Conta excluída. Obrigado por jogar com a gente.', 'info');
    BH.app.boot(false);
  };

  pages.perfil = async function () {
    const me = await api.refreshMe();
    const e = me.equipped || {};
    const xpPct = (me.xp - me.xp_level) / Math.max(1, me.xp_next - me.xp_level);
    const s = me.stats;
    const fs = ffStatus[me.ff.status] || ffStatus.nao_enviado;
    const card = { id: me.id, nick: me.nick, avatar_url: me.avatar_url, frame: e.frame_data, color: e.color_hex, verified: me.ff.status === 'aprovado', title: e.title_text, accessory: e.accessory_key };
    const bgFx = e.background_data && e.background_data.fx;
    const pend = me.admin_pending;
    const pendN = pend ? (pend.ff || 0) + (pend.reports || 0) + (me.role_level >= 2 ? (pend.deposits || 0) + (pend.withdrawals || 0) : 0) : 0;
    return {
      html: '<section class="page profile' + (bgFx ? ' with-fx' : '') + '">' + (bgFx ? BH.cos.fx(bgFx, me.id, 'p-fx') : '') +
        BH.cos.banner(e.banner_data || { bg: e.banner_bg }, 'p-banner', '<button type="button" class="p-edit icon-btn" data-act="lookSheet" aria-label="Trocar visual">' + I('palette') + '</button>', me.id) +
        '<div class="p-id"><button type="button" class="p-av" data-act="editProfile" aria-label="Trocar foto">' + U.av(card, 'xl', 'pop') + '<span class="p-cam">' + I('camera') + '</span></button>' +
        '<h1 class="h1">' + U.nick(card) + '</h1>' + U.title(card) +
        '<div class="p-badges"><span class="lvl-tag">Nível ' + me.level + '</span>' + U.role(me.role) + (me.guild ? '<button type="button" class="tag tone-violet" data-act="openGuild" data-id="' + me.guild.id + '">' + I('shield') + esc(me.guild.tag) + '</button>' : '') +
        '<button type="button" class="chip mono ripple" data-act="copy" data-v="' + me.code + '">' + I('hash') + me.code + '</button>' + (me.anonymous ? '<span class="chip tone-muted">' + I('eyeOff') + 'Anônimo no ranking</span>' : '') + '</div>' +
        (me.bio ? '<p class="p-bio">' + esc(me.bio) + '</p>' : '') + (me.avatar_pending ? '<p class="pend-photo">' + I('clock') + '<span>Foto nova em análise. Os outros ainda veem a anterior.</span></p>' : '') + '<p class="muted small">' + esc(me.email || '') + '</p></div>' +
        '<button type="button" class="xp-card ripple" data-act="track"><div class="xp-top"><span class="lvl-n big">' + me.level + '</span><div class="grow"><b>Nível ' + me.level + '</b><small>' + U.int(me.xp_next - me.xp) + ' XP para o nível ' + (me.level + 1) + '</small></div>' + I('right', 'chev') + '</div>' + U.bar(xpPct, 'elo') + '</button>' +
        '<div class="v-card ' + (me.ff.status === 'aprovado' ? 'ok' : me.ff.status === 'pendente' ? 'wait' : '') + '"><span class="v-ic">' + I(fs[1]) + '</span><div><b>Free Fire · <span class="' + fs[0] + '-t">' + fs[2] + '</span></b><p>' + esc(me.ff.nick || '–') + ' · ID ' + esc(me.ff.id || '–') + (me.ff.status === 'recusado' && me.ff.note ? '<br>Motivo: ' + esc(me.ff.note) : '') + '</p>' +
        '<button type="button" class="btn outline sm" data-act="ffSheet">' + I('upload') + (me.ff.status === 'nao_enviado' ? 'Enviar print' : 'Atualizar nick, ID ou print') + '</button></div></div>' +
        '<section class="wallet"><span class="wallet-glow" aria-hidden="true"></span><header><span>' + I('wallet') + 'Carteira</span><button type="button" class="link" data-act="wallet">Extrato' + I('right') + '</button></header>' +
        U.num(me.balance_cents, 'cents', 'wallet-num') + (me.held_cents ? '<small class="held">' + U.cents(me.held_cents) + ' em saque</small>' : '') +
        '<div class="btn-row two"><button type="button" class="btn primary" data-act="deposit">' + I('plus') + 'Depositar</button><button type="button" class="btn dark" data-act="withdraw">' + I('arrowOut') + 'Sacar</button></div></section>' +
        '<div class="quick-grid stagger">' +
        '<button type="button" class="quick ripple" data-act="shop"><span>' + I('bag') + '</span><b>Loja</b><small>Visual e prioridade</small></button>' +
        '<button type="button" class="quick ripple" data-act="track"><span>' + I('gift') + '</span><b>Recompensas</b><small>Caminho de níveis</small></button>' +
        '<button type="button" class="quick ripple" data-act="lookSheet"><span>' + I('palette') + '</span><b>Visual</b><small>Seus itens</small></button>' +
        '<button type="button" class="quick ripple" data-act="page" data-v="myRooms"><span>' + I('trophy') + '</span><b>Minhas salas</b><small>Jogadas e criadas</small></button></div>' +
        '<div class="stat-grid stagger">' + [['crosshair', s.kills, 'Abates'], ['gamepad', s.matches, 'Salas'], ['trophy', s.wins, 'Vitórias'], ['target', s.top3, 'Top 3'], ['timer', s.survival_min, 'Min vivo'], ['dollar', Math.round(s.earnings_cents / 100), 'Ganhos (R$)']]
          .map((x) => '<div class="sg"><span>' + I(x[0]) + '</span>' + U.num(x[1]) + '<small>' + x[2] + '</small></div>').join('') + '</div>' +
        '<nav class="menu stagger">' +
        '<button type="button" class="menu-row ripple" data-act="editProfile">' + I('settings') + '<span>Editar perfil</span>' + I('right', 'chev') + '</button>' +
        '<button type="button" class="menu-row ripple" data-act="themeSheet">' + I('palette') + '<span>Aparência</span><small class="muted">' + ({ sistema: 'Sistema', escuro: 'Preto', claro: 'Branco' }[BH.theme.get()] || 'Preto') + '</small>' + I('right', 'chev') + '</button>' +
        (BH.push && BH.push.available ? '<button type="button" class="menu-row ripple" data-act="pushSheet">' + I('bell') + '<span>Notificações no celular</span><small class="muted">' + (BH.push.state === 'granted' ? 'Ligadas' : BH.push.state === 'denied' ? 'Bloqueadas' : 'Desligadas') + '</small>' + I('right', 'chev') + '</button>' : '') +
        (me.role_level >= 1 ? '<button type="button" class="menu-row admin ripple" data-act="admin" data-v="overview">' + I('crown') + '<span>Painel administrativo</span>' + (pendN ? '<b class="dot-count">' + pendN + '</b>' : '') + I('right', 'chev') + '</button>' : '') +
        '<button type="button" class="menu-row ripple" data-act="logout">' + I('logout') + '<span>Sair</span></button>' +
        '<button type="button" class="menu-row danger ripple" data-act="deleteAccount">' + I('userX') + '<span>Excluir minha conta</span></button></nav></section>'
    };
  };

  pages.myRooms = async function () {
    const list = await api.rpc('list_rooms', { p_tab: 'minhas', p_q: null });
    return { html: '<section class="page">' + BH.backRow() + '<h1 class="h1">Minhas salas</h1><div class="stack stagger">' + (list.length ? list.map(BH.roomCard).join('') : U.empty('trophy', 'Nenhuma sala ainda', 'Entre em uma sala na tela inicial.')) + '</div></section>' };
  };

  /* ---------- editar perfil ---------- */
  actions.editProfile = function () {
    const me = api.me;
    U.sheet({
      title: 'Editar perfil', loading: false, data: { blob: null, url: null },
      body: (s) => '<form class="form" data-form="profile"><label class="ob-avatar"><input id="ep-av" type="file" accept="image/*" data-pick="profile-avatar">' +
        (s.data.url || me.avatar_url ? '<img src="' + esc(s.data.url || me.avatar_url) + '" alt="Sua foto">' : '<span>' + I('camera') + '</span>') + '<small>Trocar foto</small></label>' +
        (me.role_level >= 1 ? '' : '<p class="muted small center">A foto nova aparece para os outros depois que a equipe aprova.</p>') +
        '<label class="field"><span>Nickname</span><input id="ep-nick" name="nick" maxlength="20" required value="' + esc(me.nick) + '"></label>' +
        '<label class="field"><span>Bio</span><textarea id="ep-bio" name="bio" rows="2" maxlength="160" placeholder="Seu estilo de jogo">' + esc(me.bio) + '</textarea></label>' +
        '<label class="switch"><input id="ep-anon" type="checkbox" name="anonymous"' + (me.anonymous ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Ficar anônimo no ranking <small>Seu nick e foto somem do ranking e dos pagamentos recentes, mas o valor ganho continua visível.</small></span></label>' +
        '<button class="btn primary block lg">' + I('check') + 'Salvar</button></form>'
    });
  };
  document.addEventListener('bh:picked', (e) => {
    if (e.detail.kind !== 'profile-avatar') return;
    const s = U.topSheet(); if (!s) return;
    s.data.blob = e.detail.blob; s.data.url = URL.createObjectURL(e.detail.blob);
    s.render('static');
  });
  forms.profile = async function (f) {
    const s = U.topSheet();
    const ok = await U.run(f.querySelector('button.primary'), async () => {
      let url = api.me.avatar_url;
      if (s.data.blob) url = api.publicUrl('avatars', await api.upload('avatars', s.data.blob));
      await api.rpc('update_profile', { p_nick: f.nick.value, p_bio: f.bio.value, p_avatar_url: url, p_anonymous: f.anonymous.checked });
      await api.refreshMe();
    }, s.data.blob && api.me.role_level < 1 ? 'Perfil salvo. A foto nova foi para análise.' : 'Perfil salvo.');
    if (ok) { U.closeAll(); app().refresh(); }
  };

  /* ---------- Free Fire ---------- */
  actions.ffSheet = function () {
    const me = api.me;
    U.sheet({
      title: 'Seu Free Fire', loading: false, data: { blob: null, url: null },
      body: (s) => '<form class="form" data-form="ff"><p class="muted">Sempre que você muda o nick ou o ID, a equipe confere de novo. Enquanto isso, saques ficam em espera.</p>' +
        (me.ff.status === 'recusado' ? '<p class="note-red">' + I('alert') + '<span>Última análise: ' + esc(me.ff.note || 'recusado') + '</span></p>' : '') +
        '<div class="grid2"><label class="field"><span>Nick no Free Fire</span><input id="ff-nick" name="ffNick" maxlength="24" required value="' + esc(me.ff.nick || '') + '"></label>' +
        '<label class="field"><span>ID do Free Fire</span><input id="ff-id" name="ffId" inputmode="numeric" maxlength="12" required value="' + esc(me.ff.id || '') + '"></label></div>' +
        '<label class="drop' + (s.data.url ? ' has' : '') + '"><input id="ff-photo" type="file" accept="image/*" data-pick="ff-photo">' +
        '<span class="drop-empty">' + I('image') + '<b>Novo print do perfil</b><small>Precisa aparecer o nick e o ID</small></span>' + (s.data.url ? '<img src="' + esc(s.data.url) + '" alt="Prévia">' : '') + '</label>' +
        '<button class="btn primary block lg">' + I('upload') + 'Enviar para análise</button></form>'
    });
  };
  document.addEventListener('bh:picked', (e) => {
    if (e.detail.kind !== 'ff-photo') return;
    const s = U.topSheet(); if (!s) return;
    s.data.blob = e.detail.blob; s.data.url = URL.createObjectURL(e.detail.blob);
    s.render('static');
  });
  forms.ff = async function (f) {
    const s = U.topSheet();
    if (!s.data.blob) return U.toast('Escolha o print do seu perfil.', 'bad');
    const ok = await U.run(f.querySelector('button'), async () => {
      const path = await api.upload('verificacoes', s.data.blob);
      await api.rpc('submit_ff', { p_ff_nick: f.ffNick.value, p_ff_id: f.ffId.value, p_photo_path: path });
      await api.refreshMe();
    }, 'Enviado. A análise costuma levar algumas horas.');
    if (ok) { U.closeAll(); app().refresh(); }
  };

  /* ---------- carteira ---------- */
  flows.wallet = function () {
    U.sheet({
      title: 'Carteira', size: 'lg',
      body: async () => {
        const w = await api.rpc('my_wallet');
        const pend = w.deposits.filter((d) => d.status === 'pendente').concat(w.withdrawals.filter((x) => x.status === 'pendente'));
        return '<div class="pix-amount"><small>Saldo disponível</small><b>' + U.cents(w.balance_cents) + '</b>' + (w.held_cents ? '<span class="muted small">' + U.cents(w.held_cents) + ' em saque</span>' : '') + '</div>' +
          '<div class="btn-row two"><button type="button" class="btn primary" data-act="deposit">' + I('plus') + 'Depositar</button><button type="button" class="btn dark" data-act="withdraw">' + I('arrowOut') + 'Sacar</button></div>' +
          (pend.length ? '<h4 class="sub-h">Em análise</h4><ul class="tx-list full">' + pend.map((d) => '<li class="tx-row"><span class="tx-ic tone-gold">' + I('clock') + '</span><div class="tx-main"><b>' + (d.pix_key ? 'Saque para ' + esc(d.pix_key) : 'Depósito via Pix') + '</b><small>' + U.date(d.created_at) + '</small></div><div class="tx-side"><b>' + U.cents(d.amount_cents) + '</b><span class="chip tone-gold">Em análise</span></div></li>').join('') + '</ul>' : '') +
          '<h4 class="sub-h">Extrato</h4><ul class="tx-list full stagger">' + (w.ledger.length ? w.ledger.map(BH.ledgerRow).join('') : '<li class="muted center pad">Nenhuma movimentação ainda.</li>') + '</ul>';
      }
    });
  };
  actions.deposit = (el) => { U.closeAll(); flows.deposit(el && el.dataset.v ? Number(el.dataset.v) : null); };
  flows.deposit = function (preset) {
    const set = api.me.settings;
    const chips = [1000, 2000, 5000, 11000, 20000];
    const data = { step: 1, cents: preset || 2000, dep: null, poll: 0 };
    U.sheet({
      title: 'Adicionar saldo', data, loading: false,
      body: (s) => {
        const d = s.data;
        if (d.step === 1) return '<p class="muted">O saldo só entra na carteira depois que o pagamento for confirmado.</p>' +
          '<div class="amounts">' + chips.map((v) => '<button type="button" class="amount ripple' + (d.cents === v ? ' on' : '') + '" data-act="depAmount" data-v="' + v + '">' + U.centsShort(v) + '</button>').join('') + '</div>' +
          '<label class="field money-field"><span>Outro valor</span><b>R$</b><input id="dep-v" inputmode="decimal" value="' + U.centsInput(d.cents) + '"></label>' +
          '<button type="button" class="btn primary block lg" data-act="depGo">' + I('qr') + 'Gerar Pix</button><p class="muted small center">De ' + U.cents(set.min_deposit_cents) + ' a ' + U.cents(set.max_deposit_cents) + '</p>';
        if (d.step === 2) {
          const dep = d.dep;
          const code = dep.qr_code || U.pixPayload({ key: dep.pix_key, name: dep.pix_name, city: dep.pix_city, cents: dep.amount_cents, txid: dep.reference });
          const qr = dep.qr_base64 ? '<img src="data:image/png;base64,' + esc(dep.qr_base64) + '" alt="QR Code Pix">' : U.qrSvg(code);
          return '<div class="pix"><div class="pix-amount"><small>Valor do Pix</small><b>' + U.cents(dep.amount_cents) + '</b></div>' +
            '<div class="qr-wrap">' + qr + '<span class="qr-scan" aria-hidden="true"></span></div>' +
            '<label class="field"><span>Pix copia e cola</span><div class="copy-line"><input id="pix-code" readonly value="' + esc(code) + '"><button type="button" class="btn ghost sm" data-act="pixCopy">' + I('copy') + 'Copiar</button></div></label>' +
            (dep.provider === 'manual'
              ? '<p class="note-gold">' + I('info') + '<span>Pague para <b>' + esc(dep.pix_name) + '</b> (chave ' + esc(dep.pix_key) + '). Código de referência <b class="mono">' + esc(dep.reference) + '</b>. A equipe confere e o saldo entra em seguida.</span></p><button type="button" class="btn primary block lg" data-act="depPaid">' + I('check') + 'Já paguei</button>'
              : '<div class="wait-line"><span class="spin" aria-hidden="true"></span>Aguardando o pagamento. Pode deixar esta tela aberta.</div>') + '</div>';
        }
        return '<div class="done"><span class="done-ic ' + (d.approved ? 'ok' : '') + '">' + I(d.approved ? 'checkCircle' : 'clock') + '</span><h3>' + (d.approved ? 'Pagamento confirmado' : 'Pagamento em análise') + '</h3><p class="muted">' +
          (d.approved ? U.cents(d.dep.amount_cents) + ' já estão na sua carteira.' : 'Assim que a equipe confirmar, ' + U.cents(d.dep.amount_cents) + ' entram na carteira e você recebe um aviso.') + '</p><button type="button" class="btn ghost block" data-close>Fechar</button></div>';
      },
      onMount(s) {
        if (s.data.step === 2 && s.data.dep && s.data.dep.provider !== 'manual' && !s.data.poll) {
          s.data.poll = setInterval(async () => {
            if (s.closed) return clearInterval(s.data.poll);
            try {
              const r = await api.rpc('deposit_status', { p_id: s.data.dep.id });
              if (r && r.status === 'aprovado') { clearInterval(s.data.poll); s.data.approved = true; s.data.step = 3; s.render(); U.confetti(); api.refreshMe().then(() => BH.app.header()); }
              if (r && (r.status === 'recusado' || r.status === 'expirado')) { clearInterval(s.data.poll); U.toast('O Pix ' + (r.status === 'expirado' ? 'venceu' : 'foi recusado') + '. Gere outro.', 'bad'); s.data.step = 1; s.render(); }
            } catch (e) { /* tenta de novo */ }
          }, 4000);
        }
      },
      onDestroy(s) { clearInterval(s.data.poll); }
    });
  };
  actions.depAmount = (el) => { const s = U.topSheet(); s.data.cents = Number(el.dataset.v); const i = s.body.querySelector('#dep-v'); if (i) i.dataset.fresh = '1'; s.render('static'); };
  actions.depGo = async function (el) {
    const s = U.topSheet(), cents = U.toCents(s.body.querySelector('#dep-v').value);
    const dep = await U.run(el, async () => (await api.pixCreate(cents)) || api.rpc('request_manual_deposit', { p_cents: cents }));
    if (!dep) return;
    s.data.dep = dep; s.data.cents = cents; s.data.step = 2; s.render();
  };
  actions.pixCopy = () => { const i = document.getElementById('pix-code'); U.copy(i.value, i); };
  actions.depPaid = () => { const s = U.topSheet(); s.data.step = 3; s.render(); };

  actions.withdraw = function () {
    const me = api.me, set = me.settings;
    U.closeAll();
    if (set.require_verified_withdraw && me.ff.status !== 'aprovado') {
      U.confirm({ title: 'Verificação pendente', body: 'O saque libera depois que a equipe confirmar seu ID do Free Fire. Isso protege seu dinheiro contra golpes.', ok: me.ff.status === 'pendente' ? 'Entendi' : 'Enviar print', icon: 'shieldCheck' }).then((ok) => { if (ok && me.ff.status !== 'pendente') actions.ffSheet(); });
      return;
    }
    U.sheet({
      title: 'Sacar via Pix', loading: false,
      body: '<div class="pix-amount"><small>Disponível</small><b>' + U.cents(me.balance_cents) + '</b></div>' +
        '<form class="form" data-form="withdraw"><label class="field money-field"><span>Valor</span><b>R$</b><input id="wd-v" name="amount" inputmode="decimal" required placeholder="0,00"><button type="button" class="btn ghost sm" data-act="wdAll">Tudo</button></label>' +
        '<div class="grid2"><label class="field"><span>Tipo de chave</span><select id="wd-type" name="keyType"><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Aleatória</option></select></label>' +
        '<label class="field"><span>Chave Pix</span><input id="wd-key" name="key" required placeholder="Sua chave" autocomplete="off"></label></div>' +
        '<p class="muted small">Mínimo ' + U.cents(set.min_withdraw_cents) + ' · máximo ' + U.cents(set.max_withdraw_cents) + ' por pedido. A chave precisa estar no seu nome. Prazo de até 24 horas.</p>' +
        '<button class="btn primary block lg">' + I('arrowOut') + 'Pedir saque</button></form>'
    });
  };
  actions.wdAll = () => { const i = document.getElementById('wd-v'); i.value = U.centsInput(api.me.balance_cents); };
  forms.withdraw = async function (f) {
    const ok = await U.run(f.querySelector('button.primary'), () => api.rpc('request_withdrawal', { p_cents: U.toCents(f.amount.value), p_key_type: f.keyType.value, p_key: f.key.value }), 'Saque pedido. Prazo de até 24 horas.');
    if (ok) { U.closeAll(); await api.refreshMe(); app().refresh(); }
  };

  /* ---------- loja, recompensas e visual ---------- */
  function itemPreview(it) {
    const d = it.data || {};
    if (it.kind === 'banner') return BH.cos.banner(d, 'banner-sw', '', it.id);
    if (it.kind === 'moldura') return U.av({ id: api.me.id, nick: api.me.nick, avatar_url: api.me.avatar_url, frame: d }, 'md');
    if (it.kind === 'acessorio') return U.av({ id: api.me.id, nick: api.me.nick, avatar_url: api.me.avatar_url, frame: api.me.frame, accessory: d.acc }, 'md', 'acc-pv');
    if (it.kind === 'fundo') return '<span class="fundo-sw">' + BH.cos.fx(d.fx, it.id) + '</span>';
    if (it.kind === 'titulo') return '<span class="ptitle">' + esc(d.text) + '</span>';
    if (it.kind === 'cor') return '<b class="nk" style="color:' + esc(d.color) + '">' + esc(api.me.nick) + '</b>';
    return '<span class="prio-ic">' + I('zap') + '</span>';
  }
  const KINDS = [{ id: 'banner', label: 'Banners', icon: 'image' }, { id: 'acessorio', label: 'Acessórios', icon: 'crown' }, { id: 'fundo', label: 'Fundos', icon: 'sparkles' }, { id: 'moldura', label: 'Molduras', icon: 'user' },
    { id: 'titulo', label: 'Títulos', icon: 'hash' }, { id: 'cor', label: 'Cor', icon: 'palette' }, { id: 'prioridade', label: 'Fila', icon: 'zap' }];
  // abas da loja em fileira que rola (são muitas para um controle segmentado)
  const shopTabs = (active) => '<div class="shop-tabs" role="tablist">' + KINDS.map((k) => '<button type="button" role="tab" aria-selected="' + (k.id === active) + '" class="chip-btn' + (k.id === active ? ' on' : '') + '" data-act="shopTab" data-v="' + k.id + '">' + I(k.icon) + k.label + '</button>').join('') + '</div>';
  actions.shop = function () {
    U.sheet({
      title: 'Loja', size: 'lg',
      body: async () => {
        const s = await api.rpc('shop');
        const items = s.items.filter((i) => i.kind === st.shopTab && i.price_cents != null);
        return '<div class="pix-amount"><small>Seu saldo</small><b>' + U.cents(api.me.balance_cents) + '</b></div>' + shopTabs(st.shopTab) +
          (st.shopTab === 'prioridade' ? '<p class="note-gold">' + I('zap') + '<span>Quando uma sala lota, você passa na frente da fila de espera. Se abrir vaga, é sua primeiro.</span></p>' : '') +
          '<ul class="shop-grid stagger">' + (items.length ? items.map((it) => '<li class="shop-item' + (it.owned ? ' owned' : '') + '"><div class="shop-pv"' + (PREVIEW[it.kind] ? ' data-act="shopPreview" data-id="' + esc(it.id) + '" role="button" tabindex="0" aria-label="Ver prévia de ' + esc(it.name) + '"' : '') + '>' + itemPreview(it) + (PREVIEW[it.kind] ? '<span class="pv-hint">' + I('eye') + 'Prévia</span>' : '') + '</div><b>' + esc(it.name) + '</b><small>' + esc(it.description) + '</small>' +
            (it.kind === 'prioridade'
              ? (it.owned ? '<span class="chip tone-green">Ativa até ' + U.date(it.expires_at).slice(0, 5) + '</span>' : '') + '<button type="button" class="btn primary sm" data-act="buy" data-id="' + it.id + '" data-price="' + it.price_cents + '">' + (it.owned ? 'Estender · ' : '') + U.cents(it.price_cents) + '</button>'
              : it.owned ? (it.equipped ? '<span class="chip tone-green">' + I('check') + 'Em uso</span>' : '<button type="button" class="btn ghost sm" data-act="equip" data-id="' + it.id + '">Usar</button>')
                : '<button type="button" class="btn primary sm" data-act="buy" data-id="' + it.id + '" data-price="' + it.price_cents + '">' + U.cents(it.price_cents) + '</button>') + '</li>').join('') : '<li class="muted pad">Nada à venda nessa categoria.</li>') + '</ul>' +
          '<p class="muted small center">Itens de recompensa saem no caminho de níveis.</p>';
      }
    });
  };
  // prévia: mostra o item animado no seu perfil (na grade da loja tudo fica parado, para não pesar)
  const PREVIEW = { banner: 1, fundo: 1, acessorio: 1, moldura: 1 };
  actions.shopPreview = function (el) {
    const id = el.dataset.id;
    U.sheet({
      title: 'Prévia', loading: false,
      body: async () => {
        const s = await api.rpc('shop');
        const it = s.items.find((x) => x.id === id);
        if (!it) return U.empty('bag', 'Item não encontrado', '');
        const me = api.me, e = me.equipped || {}, d = it.data || {};
        const banner = it.kind === 'banner' ? d : (e.banner_data || { bg: e.banner_bg });
        const fx = it.kind === 'fundo' ? d.fx : (e.background_data && e.background_data.fx);
        const card = { id: me.id, nick: me.nick, avatar_url: me.avatar_url, frame: it.kind === 'moldura' ? d : e.frame_data, color: e.color_hex, title: e.title_text,
          accessory: it.kind === 'acessorio' ? d.acc : e.accessory_key };
        const action = it.owned
          ? (it.equipped ? '<span class="chip tone-green center">' + I('check') + 'Em uso</span>' : '<button type="button" class="btn primary block lg" data-act="equip" data-id="' + esc(it.id) + '">Usar agora</button>')
          : it.price_cents != null ? '<button type="button" class="btn primary block lg" data-act="buy" data-id="' + esc(it.id) + '" data-price="' + it.price_cents + '">' + I('bag') + 'Comprar por ' + U.cents(it.price_cents) + '</button>'
            : '<p class="muted small center">Recompensa do nível ' + (it.reward_level || '') + '.</p>';
        return '<div class="preview-card">' + (fx ? BH.cos.fx(fx, me.id, 'p-fx') : '') + BH.cos.banner(banner, 'pp-banner', '', me.id) +
          '<div class="pv-id">' + U.av(card, 'xl', 'pop') + '<h3>' + U.nick(card) + '</h3>' + U.title(card) + '</div></div>' +
          '<div class="stack"><div><b>' + esc(it.name) + '</b><p class="muted small">' + esc(it.description) + '</p></div><div class="preview-actions">' + action + '</div></div>';
      }
    });
  };
  actions.shopTab = (el) => { st.shopTab = el.dataset.v; U.topSheet().render('soft'); };
  actions.buy = async function (el) {
    const price = Number(el.dataset.price);
    if (api.me.balance_cents < price) {
      if (await U.confirm({ title: 'Saldo insuficiente', body: 'Faltam ' + U.cents(price - api.me.balance_cents) + '.', ok: 'Adicionar saldo', icon: 'wallet' })) { U.closeAll(); flows.deposit(Math.max(api.me.settings.min_deposit_cents, price - api.me.balance_cents)); }
      return;
    }
    if (!(await U.confirm({ title: 'Comprar por ' + U.cents(price) + '?', body: 'O valor sai do seu saldo.', ok: 'Comprar', icon: 'bag' }))) return;
    if (await U.run(el, () => api.rpc('buy_item', { p_item: el.dataset.id }), 'Comprado!')) { U.confetti(); await api.refreshMe(); BH.app.header(); U.topSheet().render('static'); app().refresh(); }
  };
  actions.equip = async function (el) {
    if (await U.run(el, () => api.rpc('equip_item', { p_item: el.dataset.id }))) { await api.refreshMe(); const s = U.topSheet(); if (s) s.render('static'); app().refresh(); }
  };
  actions.unequip = async function (el) {
    if (await U.run(el, () => api.rpc('unequip_item', { p_kind: el.dataset.v }))) { await api.refreshMe(); const s = U.topSheet(); if (s) s.render('static'); app().refresh(); }
  };
  // aparência: segue o celular, sempre preto ou sempre branco
  actions.themeSheet = function () {
    U.sheet({
      title: 'Aparência', loading: false,
      body: () => {
        const cur = BH.theme.get();
        const opt = (v, label, hint, sw) => '<button type="button" class="' + (cur === v ? 'on' : '') + '" data-act="themeSet" data-v="' + v + '" aria-pressed="' + (cur === v) + '"><span class="tp-sw ' + sw + '"><i></i><i></i><i></i></span>' + label + '<small>' + hint + '</small></button>';
        return '<div class="theme-pick">' + opt('sistema', 'Sistema', 'Igual ao celular', 'tp-sys') + opt('escuro', 'Preto', 'Sempre escuro', 'tp-dark') + opt('claro', 'Branco', 'Sempre claro', 'tp-light') + '</div>' +
          '<p class="muted small">A coroa e o nome BattleHub ficam sempre em dourado.</p>';
      }
    });
  };
  // notificação no celular: liga, desliga ou explica como desbloquear nas configurações do Android
  actions.pushSheet = function () {
    U.sheet({
      title: 'Notificações no celular',
      body: async () => {
        const st = await BH.push.refreshState();
        const on = st === 'granted';
        return '<p class="muted">' + (on ? 'Ligadas. Você recebe os avisos mesmo com o app fechado.'
            : st === 'denied' ? 'O Android está bloqueando as notificações do BattleHub. Para liberar: <b>Configurações do celular → Apps → BattleHub → Notificações</b>.'
              : 'Desligadas. Ligue para saber na hora quando a sala começa, quando cai prêmio e quando alguém te chama.') + '</p>' +
          '<ul class="push-kinds"><li>' + I('trophy') + '<span><b>Salas e resultados</b>ID e senha da sala, vaga liberada, prêmios</span></li>' +
          '<li>' + I('message') + '<span><b>Conversas</b>Mensagens de jogadores e organizadores</span></li>' +
          '<li>' + I('megaphone') + '<span><b>Avisos</b>Depósitos, saques, amizades, eventos e avisos da equipe</span></li></ul>' +
          '<p class="muted small">Dá para silenciar cada grupo nas configurações de notificação do Android.</p>' +
          (on ? '<button type="button" class="btn outline block" data-act="pushOff">' + I('bell') + 'Desligar neste celular</button>'
            : st === 'denied' ? '' : '<button type="button" class="btn primary block" data-act="pushOn">' + I('bell') + 'Ligar notificações</button>');
      }
    });
  };
  actions.pushOn = async function (el) {
    const ok = await U.run(el, () => BH.push.enable());
    if (ok === false) U.toast('O Android não liberou. Veja em Configurações → Apps → BattleHub → Notificações.', 'info');
    else if (ok) U.toast('Notificações ligadas.', 'good');
    const s = U.topSheet(); if (s) s.render('static'); app().refresh();
  };
  actions.pushOff = async function (el) {
    await U.run(el, () => BH.push.disable());
    U.toast('Notificações desligadas neste celular.', 'info');
    const s = U.topSheet(); if (s) s.render('static'); app().refresh();
  };
  actions.themeSet = (el) => { BH.theme.set(el.dataset.v); const s = U.topSheet(); if (s) s.render('static'); app().refresh(); };
  actions.lookSheet = function () {
    U.sheet({
      title: 'Seu visual', size: 'lg',
      body: async () => {
        const s = await api.rpc('shop');
        const owned = s.items.filter((i) => i.owned && i.kind !== 'prioridade');
        return KINDS.filter((k) => k.id !== 'prioridade').map((k) => {
          const list = owned.filter((i) => i.kind === k.id);
          return '<h4 class="sub-h">' + k.label + (k.id !== 'banner' && list.some((i) => i.equipped) ? '<button type="button" class="link" data-act="unequip" data-v="' + k.id + '">Remover</button>' : '') + '</h4>' +
            (list.length ? '<ul class="look-row">' + list.map((it) => '<li><button type="button" class="look-pick' + (it.equipped ? ' on' : '') + '" data-act="equip" data-id="' + it.id + '">' + itemPreview(it) + '<small>' + esc(it.name) + '</small></button></li>').join('') + '</ul>' : '<p class="muted small">Nenhum item ainda. Suba de nível ou compre na loja.</p>');
        }).join('') + '<button type="button" class="btn outline block" data-act="shop">' + I('bag') + 'Abrir a loja</button>';
      }
    });
  };
  actions.track = function () {
    U.sheet({
      title: 'Caminho de recompensas', size: 'lg',
      body: async () => {
        const s = await api.rpc('shop');
        const xp = (api.me.settings && api.me.settings.xp) || {};
        const pct = (s.xp - s.xp_level) / Math.max(1, s.xp_next - s.xp_level);
        return '<div class="xp-card static"><div class="xp-top"><span class="lvl-n big">' + s.level + '</span><div class="grow"><b>Nível ' + s.level + ' · ' + U.int(s.xp) + ' XP</b><small>' + U.int(s.xp_next - s.xp) + ' XP para o nível ' + (s.level + 1) + '</small></div></div>' + U.bar(pct, 'elo') + '</div>' +
          '<ol class="track stagger">' + s.track.map((t) => '<li class="' + (t.unlocked ? 'on' : '') + (t.level === s.level + 1 || (!t.unlocked && s.track.find((x) => !x.unlocked) === t) ? ' next' : '') + '"><span class="track-lv">' + t.level + '</span><div class="track-pv">' + itemPreview(t.item) + '</div><div class="grow"><b>' + esc(t.item.name) + '</b><small>' + ({ banner: 'Banner', moldura: 'Moldura', titulo: 'Título', cor: 'Cor do nick' }[t.item.kind] || '') + ' · ' + U.int(t.xp) + ' XP</small></div>' + (t.unlocked ? I('checkCircle', 'green') : I('lock', 'muted')) + '</li>').join('') + '</ol>' +
          '<h4 class="sub-h">Como ganhar XP</h4><ul class="xp-rules">' + [['Participar de uma sala', xp.participar], ['Cada abate', xp.abate], ['Ficar no top 3', xp.top3], ['Vencer', xp.vitoria], ['Primeiro abate', xp.first_blood], ['Eliminar o Player Rei', xp.rei], ['Receber prêmio', xp.premio]]
            .map((r) => '<li><span>' + r[0] + '</span><b>+' + (r[1] || 0) + ' XP</b></li>').join('') + '</ul>';
      }
    });
  };
})();
