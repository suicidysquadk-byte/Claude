/* Notificação no celular (Firebase): pede permissão, cadastra o aparelho e abre a tela certa ao tocar no aviso.
   Só liga no app Android com o Firebase configurado (BH_CONFIG.push, gravado quando existe
   android/app/google-services.json). Sem isso, register() derrubaria o app, então nada aqui é chamado. */
window.BH = window.BH || {};
(function () {
  const api = BH.api, U = BH.ui;
  const C = window.BH_CONFIG || {};
  const Cap = window.Capacitor;
  const plugin = () => Cap && Cap.Plugins && Cap.Plugins.PushNotifications;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* armazenamento bloqueado */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } }
  };

  // canais do Android: o jogador pode silenciar cada um nas configurações do celular
  // (os ids são os mesmos que a função push-enviar usa)
  const CHANNELS = [
    { id: 'bh_salas', name: 'Salas e resultados', description: 'Sala começando com ID e senha, vaga liberada e prêmios', importance: 4, visibility: 1, vibration: true, lights: true, lightColor: '#C9A24D' },
    { id: 'bh_chat', name: 'Conversas', description: 'Mensagens de jogadores e organizadores', importance: 4, visibility: 0, vibration: true },
    { id: 'bh_avisos', name: 'Avisos', description: 'Depósitos, saques, amizades, eventos e avisos da equipe', importance: 3, visibility: 1 }
  ];

  const push = BH.push = {
    available: !!(api.native && C.push && plugin()),
    // granted | denied | prompt | off (desligado pelo jogador) | na (sem suporte)
    state: 'na'
  };
  let token = store.get('bh.push.token');
  let sentFor = null;
  let pendingTap = null;
  let ready = null;

  // dados do Firebase chegam como texto: devolve true/false e tira as chaves internas do Google
  function clean(d) {
    const out = {};
    Object.keys(d || {}).forEach((k) => {
      if (/^(google\.|gcm\.|from$|collapse_key$)/.test(k)) return;
      const v = d[k];
      out[k] = v === 'true' ? true : v === 'false' ? false : v;
    });
    return out;
  }

  function onTap(action) {
    const d = clean(action && action.notification && action.notification.data);
    if (!d.kind) return;
    if (api.me && BH.flows.openNotice) BH.flows.openNotice(d.kind, d);
    else pendingTap = d;
  }

  async function sendToken() {
    if (!token || !api.me || sentFor === api.me.id + token) return;
    try { await api.rpc('set_push_token', { p_token: token, p_platform: 'android' }); sentFor = api.me.id + token; } catch (e) { sentFor = null; }
  }

  // listeners e canais: uma vez, logo que o app abre (o toque no aviso com o app fechado chega aqui)
  function setup() {
    if (ready || !push.available) return ready;
    const P = plugin();
    ready = Promise.all([
      P.addListener('registration', (t) => { token = t && t.value; if (token) { store.set('bh.push.token', token); sendToken(); } }),
      P.addListener('registrationError', (e) => { console.warn('push: cadastro falhou', e && e.error); }),
      P.addListener('pushNotificationActionPerformed', onTap)
    ].concat(CHANNELS.map((ch) => P.createChannel(ch).catch(() => null)))).catch(() => null);
    return ready;
  }

  async function permission() {
    try { const r = await plugin().checkPermissions(); return r.receive; } catch (e) { return 'denied'; }
  }
  const offFor = () => api.me && store.get('bh.push.off') === api.me.id;

  // depois de entrar: cadastra o aparelho; na primeira vez explica antes de o Android perguntar
  push.start = async function () {
    if (!push.available || !api.me) return;
    await setup();
    if (pendingTap) { const d = pendingTap; pendingTap = null; setTimeout(() => BH.flows.openNotice(d.kind, d), 300); }
    if (offFor()) { push.state = 'off'; return; }
    let p = await permission();
    if (p !== 'granted' && p !== 'denied' && api.me.onboarded && !store.get('bh.push.asked')) {
      store.set('bh.push.asked', '1');
      await new Promise((r) => setTimeout(r, 1200));
      const yes = await U.confirm({
        title: 'Receber avisos no celular?', icon: 'bell', ok: 'Ativar', cancel: 'Agora não',
        body: 'Mesmo com o app fechado, você fica sabendo na hora quando a sala começa (com ID e senha), quando cai prêmio ou depósito e quando alguém te chama no chat.'
      });
      if (yes) { try { p = (await plugin().requestPermissions()).receive; } catch (e) { p = 'denied'; } }
    }
    push.state = p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
    if (p === 'granted') {
      try { await plugin().register(); } catch (e) { console.warn('push: register', e); }
      sendToken();
    }
  };

  // ao sair da conta: o aparelho para de receber os avisos dela
  push.stop = async function () {
    sentFor = null;
    if (!push.available || !token) return;
    try { await api.rpc('clear_push_token', { p_token: token }); } catch (e) { /* sem rede: o próximo login troca o dono do token */ }
  };

  push.enable = async function () {
    store.del('bh.push.off');
    let p = await permission();
    if (p !== 'granted') { try { p = (await plugin().requestPermissions()).receive; } catch (e) { p = 'denied'; } }
    if (p !== 'granted') { push.state = 'denied'; return false; }
    push.state = 'granted';
    try { await plugin().register(); } catch (e) { console.warn('push: register', e); }
    sentFor = null;
    await sendToken();
    return true;
  };
  push.disable = async function () {
    if (api.me) store.set('bh.push.off', api.me.id);
    push.state = 'off';
    await push.stop();
  };
  push.refreshState = async function () {
    if (!push.available) { push.state = 'na'; return push.state; }
    if (offFor()) { push.state = 'off'; return push.state; }
    const p = await permission();
    push.state = p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
    return push.state;
  };

  setup();
})();
