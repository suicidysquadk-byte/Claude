/* Entrada: login (Google ou código por e-mail), verificação animada, cadastro do Free Fire, suspensão */
window.BH = window.BH || {};
(function () {
  const U = BH.ui, I = BH.icon, api = BH.api, esc = U.esc;
  const pages = BH.pages, actions = BH.actions, forms = BH.forms, flows = BH.flows, st = BH.state;
  const app = () => BH.app;
  st.auth = st.auth || { step: 'start', email: '', sentAt: 0 };
  st.ob = st.ob || { step: 1 };

  BH.backRow = (label) => '<button type="button" class="back ripple" data-act="back">' + I('back') + (label || 'Voltar') + '</button>';

  pages.setup = function () {
    return {
      hideNav: true, bare: true,
      html: '<section class="login"><div class="login-bg" aria-hidden="true"><i></i><i></i><i></i></div><div class="login-card">' +
        '<div class="login-logo">' + BH.logo('xl') + '</div>' +
        '<p class="login-tag">O servidor ainda não foi conectado.</p>' +
        '<ol class="steps"><li>Crie o projeto no Supabase e rode as migrações da pasta <b>supabase/</b>.</li><li>Cole a URL e a chave <b>anon</b> em <b>www/js/config.js</b>.</li><li>Gere o app de novo.</li></ol>' +
        '<p class="muted small center">O passo a passo completo está no LEIA-ME.</p></div></section>'
    };
  };

  /* ---------------- boas-vindas (primeira vez) ---------------- */
  st.welcomed = () => { try { return !!localStorage.getItem('bh.welcome'); } catch (e) { return true; } };
  const MURAL = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'img/mural/m' + n + '.jpg');
  pages.welcome = function () {
    // três colunas com as telas repetidas: a animação sobe (ou desce) metade da coluna e recomeça sem emenda
    const col = (k) => '<div class="wall-col">' + [0, 1].map(() => MURAL.map((src, i) => MURAL[(i + k * 3) % MURAL.length]).map((src) => '<img src="' + src + '" alt="" loading="eager" decoding="async">').join('')).join('') + '</div>';
    return {
      hideNav: true, bare: true,
      html: '<section class="welcome auth-anim"><div class="wall" aria-hidden="true">' + col(0) + col(1) + col(2) + '</div><div class="welcome-fade"></div>' +
        '<div class="welcome-body"><h1>Salas valendo prêmio. <b>Do seu jeito.</b></h1>' +
        '<p>Entre nas salas oficiais e dos organizadores, dispute a liga da semana, suba no ranking e receba pelo Pix.</p>' +
        '<button type="button" class="btn primary block lg" data-act="welcomeGo">Começar' + I('right') + '</button>' +
        '<small>Salas oficiais · eventos toda semana · prêmio na carteira</small></div></section>'
    };
  };
  actions.welcomeGo = () => { try { localStorage.setItem('bh.welcome', '1'); } catch (e) { /* segue mesmo sem guardar */ } app().rerender('enter'); };

  /* ---------------- login ---------------- */
  const bolt = '<svg class="auth-bolt" viewBox="0 0 70 230" aria-hidden="true"><path d="M44 0 30 58 42 62 22 128 34 132 8 230M30 58 12 80M22 128 4 150"/></svg>';
  pages.login = async function () {
    const a = st.auth;
    const pv = await api.providers();
    const criar = a.mode === 'criar';
    const wait = Math.max(0, 60 - Math.floor((Date.now() - a.sentAt) / 1000));
    const card = a.step === 'code'
      ? '<form class="form" data-form="code"><p class="auth-sent">' + I('mail') + '<span>Enviamos um e-mail para <b>' + esc(a.email) + '</b>. Abra <b>neste celular</b> e toque no botão de entrar, ou digite abaixo o código, se vier um. Olhe também o spam.</span></p>' +
        '<div class="field"><span id="lg-code-l">Código (se o e-mail trouxer)</span><div class="otp" id="lg-otp"><input id="lg-code" class="otp-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required aria-labelledby="lg-code-l">' +
        '<div class="otp-cards" aria-hidden="true">' + [0, 1, 2, 3, 4, 5].map((i) => '<i style="--i:' + i + '"><b></b></i>').join('') + '</div></div></div>' +
        '<button class="btn primary block lg">' + I('login') + 'Entrar</button>' +
        '<div class="login-links"><button type="button" class="link" data-act="authEmail">Trocar e-mail</button>' +
        '<button type="button" class="link" data-act="resendCode"' + (wait ? ' disabled' : '') + '>' + (wait ? 'Reenviar em <span id="lg-wait">' + wait + '</span>s' : 'Reenviar e-mail') + '</button></div></form>'
      : '<div class="auth-tabs" role="tablist"><button type="button" role="tab" aria-selected="' + !criar + '" class="' + (criar ? '' : 'on') + '" data-act="authMode" data-v="entrar">Entrar</button>' +
        '<button type="button" role="tab" aria-selected="' + criar + '" class="' + (criar ? 'on' : '') + '" data-act="authMode" data-v="criar">Criar conta</button></div>' +
        '<form class="form" data-form="email"><label class="auth-field">' + I('mail') + '<input id="lg-email" name="email" type="email" inputmode="email" autocomplete="email" required placeholder="Seu e-mail" value="' + esc(a.email) + '" aria-label="E-mail"></label>' +
        '<p class="muted small">' + (criar ? 'Mandamos um link para criar sua conta. Não precisa de senha.' : 'Mandamos um link de entrada para o seu e-mail. Não precisa de senha.') + '</p>' +
        '<button class="btn primary block lg">' + (criar ? 'Criar minha conta' : 'Entrar') + I('right') + '</button></form>' +
        (pv.google ? '<div class="auth-or">ou continue com</div><button type="button" class="btn google block lg" data-act="google">' + BH.googleLogo + 'Google</button>' : '') +
        '<p class="auth-foot">' + (criar ? 'Já tem conta? <button type="button" class="link" data-act="authMode" data-v="entrar">Entrar</button>' : 'Novo no BattleHub? <button type="button" class="link" data-act="authMode" data-v="criar">Criar conta</button>') + '</p>';
    return {
      hideNav: true, bare: true,
      html: '<section class="auth auth-anim' + (a.seen ? ' no-enter' : '') + '"><div class="auth-top">' + bolt +
        '<div class="auth-brand"><span class="logo-mark">' + I('crown') + '</span><span class="auth-word">Battle<b>Hub</b></span></div>' +
        '<h1 class="auth-title">' + (a.step === 'code' ? 'Confira seu e-mail.' : criar ? 'Crie sua conta.' : 'Bem-vindo de volta.') + '</h1>' +
        '<p class="auth-sub">' + (a.step === 'code' ? 'Falta só um toque para entrar.' : criar ? 'Salas, eventos e prêmios de Free Fire num lugar só.' : 'Suas salas e prêmios estão esperando.') + '</p></div>' +
        '<div class="auth-card">' + card +
        '<p class="auth-terms">Ao entrar você confirma ter 18 anos ou mais e aceita as regras do BattleHub. O BattleHub não é afiliado à Garena.</p></div></section>',
      onMount(root) {
        if (!a.seen) setTimeout(() => { a.seen = true; }, 1200);
        const w = root.querySelector('#lg-wait');
        if (w) {
          const t = setInterval(() => {
            const left = Math.max(0, 60 - Math.floor((Date.now() - st.auth.sentAt) / 1000));
            if (!w.isConnected) return clearInterval(t);
            if (left <= 0) { clearInterval(t); app().refresh(); } else w.textContent = left;
          }, 1000);
        }
        const c = root.querySelector('#lg-code');
        if (c) {
          // cartas do código: abrem em leque, cada dígito ocupa uma carta e a próxima fica marcada
          const cards = root.querySelectorAll('.otp-cards i');
          const paint = () => {
            c.value = c.value.replace(/\D/g, '').slice(0, 6);
            const v = c.value;
            cards.forEach((el, i) => {
              el.querySelector('b').textContent = v[i] || '';
              el.classList.toggle('filled', i < v.length);
              el.classList.toggle('active', i === Math.min(v.length, 5) && document.activeElement === c && v.length < 6);
            });
            root.querySelector('#lg-otp').classList.toggle('full', v.length === 6);
          };
          c.addEventListener('input', paint);
          c.addEventListener('focus', paint);
          c.addEventListener('blur', paint);
          setTimeout(() => { c.focus(); paint(); }, 520);
        }
      }
    };
  };
  actions.authMode = (el) => { st.auth.mode = el.dataset.v; app().rerender('soft'); };
  actions.google = (el) => U.run(el, () => api.signInGoogle());
  forms.email = async function (f) {
    const email = f.email.value.trim();
    const ok = await U.run(f.querySelector('button'), () => api.sendCode(email));
    if (!ok) return;
    Object.assign(st.auth, { step: 'code', email, sentAt: Date.now() });
    app().rerender('soft');
  };
  actions.authEmail = () => { st.auth.step = 'start'; app().rerender('soft'); };
  actions.resendCode = async (el) => {
    if (await U.run(el, () => api.sendCode(st.auth.email), 'E-mail reenviado.')) { st.auth.sentAt = Date.now(); app().refresh(); }
  };
  forms.code = async function (f) {
    const btn = f.querySelector('button.btn');
    const session = await U.run(btn, () => api.verifyCode(st.auth.email, f.code.value));
    const otp = document.getElementById('lg-otp');
    if (!session) {
      if (otp) { otp.classList.remove('err'); void otp.offsetWidth; otp.classList.add('err'); setTimeout(() => otp.classList.remove('err'), 700); }
      return;
    }
    if (otp) otp.classList.add('ok');
    st.auth = { step: 'start', email: '', sentAt: 0 };
    flows.afterLogin(session);
  };

  /* ---------------- verificação animada ---------------- */
  flows.verifyAnimation = function (session) {
    const user = (session && session.user) || {};
    const provider = (user.app_metadata && user.app_metadata.provider) === 'google' ? 'Conta Google conectada' : 'Código confirmado';
    const el = document.createElement('div');
    el.className = 'verify-screen';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="vs-orb"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="vs-track" cx="60" cy="60" r="52"/><circle class="vs-prog" cx="60" cy="60" r="52" pathLength="1"/></svg>' +
      '<span class="vs-scan" aria-hidden="true"></span><span class="vs-shield">' + I('shield') + '</span><span class="vs-check">' + I('check') + '</span></div>' +
      '<h2 class="vs-title">Verificando sua conta</h2>' +
      '<ol class="vs-steps">' +
      '<li><i></i><span>' + provider + '</span></li>' +
      '<li><i></i><span>E-mail confirmado' + (user.email ? ': <b>' + esc(user.email) + '</b>' : '') + '</span></li>' +
      '<li><i></i><span>Carregando seu perfil</span></li></ol>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const steps = el.querySelectorAll('.vs-steps li');
    const set = (i, cls) => steps[i] && steps[i].classList.add(cls);
    const fast = U.reduced();
    set(0, 'run');
    const t0 = Date.now();
    const timers = [
      setTimeout(() => { set(0, 'ok'); set(1, 'run'); el.style.setProperty('--p', '.4'); }, fast ? 0 : 650),
      setTimeout(() => { set(1, 'ok'); set(2, 'run'); el.style.setProperty('--p', '.72'); }, fast ? 0 : 1350)
    ];
    return {
      done(ok) {
        return new Promise((resolve) => {
          const wait = Math.max(0, (fast ? 0 : 2000) - (Date.now() - t0));
          setTimeout(() => {
            timers.forEach(clearTimeout);
            if (!ok) { el.classList.add('fail'); el.querySelector('.vs-title').textContent = 'Não deu para verificar'; setTimeout(() => { el.remove(); resolve(); }, fast ? 0 : 1100); return; }
            [0, 1, 2].forEach((i) => set(i, 'ok'));
            el.style.setProperty('--p', '1');
            el.classList.add('success');
            el.querySelector('.vs-title').textContent = 'Tudo certo!';
            U.confetti(innerWidth / 2, innerHeight * 0.32);
            setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, fast ? 0 : 420); }, fast ? 0 : 900);
          }, wait);
        });
      }
    };
  };

  /* ---------------- cadastro (nick + Free Fire) ---------------- */
  function preview(blob) { return blob ? URL.createObjectURL(blob) : null; }
  pages.onboarding = function () {
    const o = st.ob, me = api.me || {};
    const dots = '<div class="ob-dots"><i class="' + (o.step >= 1 ? 'on' : '') + '"></i><i class="' + (o.step >= 2 ? 'on' : '') + '"></i></div>';
    let body;
    if (o.step === 1) {
      body = '<form class="form" data-form="ob1"><p class="eyebrow">Passo 1 de 2</p><h1 class="h1">Como te chamam?</h1>' +
        '<p class="muted">Esse é o nome que aparece nas salas, no ranking e no chat.</p>' +
        '<label class="ob-avatar"><input id="ob-av" type="file" accept="image/*" data-pick="ob-avatar">' +
        (o.avatarUrl ? '<img src="' + esc(o.avatarUrl) + '" alt="Sua foto">' : (me.avatar_url ? '<img src="' + esc(me.avatar_url) + '" alt="Sua foto">' : '<span>' + I('camera') + '</span>')) +
        '<small>' + (o.avatarUrl || me.avatar_url ? 'Trocar foto' : 'Foto de perfil (opcional)') + '</small></label>' +
        '<label class="field"><span>Nickname</span><input id="ob-nick" name="nick" maxlength="20" required autocomplete="nickname" placeholder="Ex.: SHADOW lock" value="' + esc(o.nick || me.nick || '') + '"></label>' +
        '<button class="btn primary block lg">Continuar' + I('right') + '</button></form>';
    } else {
      body = '<form class="form" data-form="ob2"><p class="eyebrow">Passo 2 de 2</p><h1 class="h1">Seu Free Fire</h1>' +
        '<p class="muted">A equipe confere o print para garantir que o ID é seu. Sem isso, não dá para sacar prêmios.</p>' +
        '<div class="grid2"><label class="field"><span>Nick no Free Fire</span><input id="ob-ffnick" name="ffNick" maxlength="24" required placeholder="Seu nick no jogo" value="' + esc(o.ffNick || '') + '"></label>' +
        '<label class="field"><span>ID do Free Fire</span><input id="ob-ffid" name="ffId" inputmode="numeric" maxlength="12" required placeholder="123456789" value="' + esc(o.ffId || '') + '"></label></div>' +
        '<label class="drop' + (o.photoUrl ? ' has' : '') + '"><input id="ob-photo" type="file" accept="image/*" data-pick="ob-photo">' +
        '<span class="drop-empty">' + I('image') + '<b>Print do perfil do Free Fire</b><small>Abra o jogo, toque no seu avatar e tire um print que mostre o nick e o ID</small></span>' +
        (o.photoUrl ? '<img src="' + esc(o.photoUrl) + '" alt="Prévia do print">' : '') + '</label>' +
        '<button class="btn primary block lg">' + I('check') + 'Concluir cadastro</button>' +
        '<button type="button" class="btn ghost block" data-act="obBack">' + I('back') + 'Voltar</button></form>';
    }
    return {
      hideNav: true, bare: true, className: 'ob-page',
      html: '<section class="page onboarding"><header class="ob-head">' + BH.logo() + dots + '</header>' + body + '</section>'
    };
  };
  // guarda o que foi digitado para nada se perder se a tela for redesenhada
  const OB_FIELDS = { 'ob-nick': 'nick', 'ob-ffnick': 'ffNick', 'ob-ffid': 'ffId' };
  document.addEventListener('input', (e) => { const k = OB_FIELDS[e.target.id]; if (k && st.ob) st.ob[k] = e.target.value; });
  document.addEventListener('change', async (e) => {
    const inp = e.target.closest('input[type=file][data-pick]');
    if (!inp || !inp.files || !inp.files[0]) return;
    const kind = inp.dataset.pick;
    try {
      const blob = await U.compressImage(inp.files[0], kind === 'ob-photo' ? 1600 : 640);
      if (kind === 'ob-avatar') { st.ob.avatarBlob = blob; st.ob.avatarUrl = preview(blob); st.ob.nick = (document.getElementById('ob-nick') || {}).value || st.ob.nick; app().refresh(); }
      if (kind === 'ob-photo') { st.ob.photoBlob = blob; st.ob.photoUrl = preview(blob); st.ob.ffNick = (document.getElementById('ob-ffnick') || {}).value || st.ob.ffNick; st.ob.ffId = (document.getElementById('ob-ffid') || {}).value || st.ob.ffId; app().refresh(); }
      document.dispatchEvent(new CustomEvent('bh:picked', { detail: { kind, blob, input: inp } }));
    } catch (err) { U.err(err); }
  });
  forms.ob1 = function (f) {
    const nick = f.nick.value.trim();
    if (nick.length < 3) return U.toast('O nickname precisa ter pelo menos 3 caracteres.', 'bad');
    st.ob.nick = nick; st.ob.step = 2;
    app().rerender('enter');
  };
  actions.obBack = () => { st.ob.ffNick = (document.getElementById('ob-ffnick') || {}).value; st.ob.ffId = (document.getElementById('ob-ffid') || {}).value; st.ob.step = 1; app().rerender('enter'); };
  forms.ob2 = async function (f) {
    const o = st.ob;
    o.ffNick = f.ffNick.value.trim(); o.ffId = f.ffId.value.trim();
    if (!o.photoBlob) return U.toast('Escolha o print do seu perfil do Free Fire.', 'bad');
    const ok = await U.run(f.querySelector('button.primary'), async () => {
      const path = await api.upload('verificacoes', o.photoBlob);
      await api.rpc('complete_onboarding', { p_nick: o.nick, p_ff_nick: o.ffNick, p_ff_id: o.ffId, p_photo_path: path });
      if (o.avatarBlob) {
        const ap = await api.upload('avatars', o.avatarBlob);
        await api.rpc('update_profile', { p_nick: o.nick, p_bio: '', p_avatar_url: api.publicUrl('avatars', ap), p_anonymous: false });
      }
      await api.refreshMe();
    });
    if (!ok) return;
    st.ob = { step: 1 };
    U.confetti();
    U.toast('Cadastro concluído. Seu ID está em análise.', 'good');
    app().boot(false);
  };

  /* ---------------- suspensão e manutenção ---------------- */
  pages.banned = function () {
    const me = api.me || {};
    const until = me.banned_until ? new Date(me.banned_until) : null;
    const perm = !until || until.getFullYear() > 2200;
    return {
      hideNav: true, bare: true,
      html: '<section class="login"><div class="login-card ban-card"><span class="ban-ic">' + I('ban') + '</span><h1 class="h1">Conta suspensa</h1>' +
        '<p class="muted">Motivo: <b>' + esc(me.ban_reason || 'violação das regras') + '</b></p>' +
        (perm ? '<p class="ban-left">Suspensão permanente</p>' : '<p class="ban-left">Libera em <b class="mono" data-until="' + until.getTime() + '">' + U.until(until.getTime()) + '</b></p>') +
        '<p class="muted small">Seu saldo continua guardado. Se acha que foi um engano, fale com a equipe pelo e-mail de suporte informado na Play Store.</p>' +
        '<button type="button" class="btn ghost block" data-act="logout">' + I('logout') + 'Sair da conta</button></div></section>'
    };
  };
  pages.maintenance = function () {
    return {
      hideNav: true,
      html: '<section class="page">' + U.empty('wrench', 'Estamos em manutenção', 'Voltamos em instantes. Suas salas e seu saldo estão seguros.', '<button type="button" class="btn ghost" data-act="retry">' + I('refresh') + 'Tentar de novo</button>') + '</section>'
    };
  };
  actions.logout = async function () {
    if (!(await U.confirm({ title: 'Sair da conta?', body: 'Você volta para a tela de entrada.', ok: 'Sair', icon: 'logout' }))) return;
    await api.signOut();
    BH.app.setSession(null);
    BH.app.boot(false);
  };
})();
