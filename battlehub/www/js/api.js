/* Conexão com o servidor (Supabase): login, chamadas, fotos e tempo real */
window.BH = window.BH || {};
(function () {
  const C = window.BH_CONFIG || {};
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const configured = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);

  const store = {
    getItem(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* armazenamento bloqueado */ } },
    removeItem(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } }
  };

  const sb = configured ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !native, storage: store },
    realtime: { params: { eventsPerSecond: 5 } }
  }) : null;

  const api = BH.api = { configured, native, sb, me: null, online: navigator.onLine !== false };

  const MSG = [
    [/failed to fetch|networkerror|load failed|network request failed/i, 'Sem conexão com o servidor. Confira sua internet e tente de novo.'],
    [/token has expired or is invalid|otp.*expired|invalid.*otp/i, 'Código inválido ou vencido. Peça um código novo.'],
    [/rate limit|too many requests|security purposes/i, 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'],
    [/jwt expired|invalid jwt|not authenticated/i, 'Sua sessão expirou. Entre de novo.'],
    [/unable to validate email|invalid email/i, 'Digite um e-mail válido.'],
    [/payload too large|exceeded the maximum/i, 'O arquivo é grande demais. Escolha outro menor.'],
    [/mime type/i, 'Formato não aceito. Envie foto em JPG, PNG ou WEBP, ou vídeo em MP4.']
  ];
  function fail(e) {
    const raw = (e && (e.message || e.error_description || e.msg || e.error)) || String(e || '');
    const hit = MSG.find((m) => m[0].test(raw));
    const x = new Error(hit ? hit[1] : raw || 'Não foi possível concluir. Tente de novo.');
    x.raw = e;
    return x;
  }
  api.fail = fail;

  api.rpc = async function (fn, args) {
    if (!sb) throw new Error('Servidor não configurado.');
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw fail(error);
    return data;
  };
  api.refreshMe = async function () {
    const me = await api.rpc('me');
    const e = me.equipped || {};
    // o próprio avatar mostra moldura e acessório em qualquer tela
    me.frame = e.frame_data || null;
    me.accessory = e.accessory_key || null;
    api.me = me;
    return me;
  };

  /* ---------- login ---------- */
  api.session = async () => (sb ? (await sb.auth.getSession()).data.session : null);
  api.onAuth = (cb) => (sb ? sb.auth.onAuthStateChange((event, session) => cb(event, session)) : null);
  api.sendCode = async function (email) {
    // o e-mail traz um código ou um botão "Entrar"; o botão volta direto para o app (gg.battlehub.app://auth)
    const back = native ? (C.appScheme || 'gg.battlehub.app') + '://auth' : location.origin + location.pathname;
    const { error } = await sb.auth.signInWithOtp({ email: String(email || '').trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: back } });
    if (error) throw fail(error);
  };
  api.verifyCode = async function (email, code) {
    const { data, error } = await sb.auth.verifyOtp({ email: String(email || '').trim().toLowerCase(), token: String(code || '').replace(/\D/g, ''), type: 'email' });
    if (error) throw fail(error);
    return data.session;
  };
  // quais formas de login estão ligadas no servidor (o botão do Google só aparece se estiver ativo)
  let providers = null;
  api.providers = async function () {
    if (providers) return providers;
    try {
      const r = await fetch(C.supabaseUrl + '/auth/v1/settings', { headers: { apikey: C.supabaseAnonKey } });
      const d = await r.json();
      providers = { google: !!(d.external && d.external.google), email: !(d.external && d.external.email === false) };
    } catch (e) { return { google: true, email: true }; }
    return providers;
  };
  api.signInGoogle = async function () {
    if (native) {
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: (C.appScheme || 'gg.battlehub.app') + '://auth', skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } }
      });
      if (error) throw fail(error);
      const Browser = Cap.Plugins && Cap.Plugins.Browser;
      if (Browser) await Browser.open({ url: data.url, presentationStyle: 'popover' });
      else window.location.href = data.url;
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
    if (error) throw fail(error);
  };
  // volta do navegador no Android: gg.battlehub.app://auth?code=...
  api.handleDeepLink = async function (url) {
    if (!sb || !url || url.indexOf('://auth') < 0) return false;
    const u = new URL(url.replace(/^[^:]+:\/\//, 'https://app/'));
    const q = new URLSearchParams(u.search || (u.hash || '').slice(1));
    const Browser = Cap && Cap.Plugins && Cap.Plugins.Browser;
    if (Browser) Browser.close().catch(() => {});
    if (q.get('error_description')) throw fail(q.get('error_description'));
    if (q.get('code')) {
      const { error } = await sb.auth.exchangeCodeForSession(q.get('code'));
      if (error) throw fail(error);
      return true;
    }
    // link de convite gerado pela administração: volta com a sessão no endereço
    if (q.get('access_token') && q.get('refresh_token')) {
      const { error } = await sb.auth.setSession({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token') });
      if (error) throw fail(error);
      return true;
    }
    return false;
  };
  api.signOut = async function () {
    api.me = null;
    try { await sb.auth.signOut(); } catch (e) { /* sai mesmo sem rede */ }
  };

  // apaga as fotos da própria pasta em cada balde (usado ao excluir a conta)
  api.removeMyFiles = async function () {
    const s = await api.session();
    if (!s) return;
    for (const bucket of ['avatars', 'chat', 'verificacoes', 'analises']) {
      try {
        const { data } = await sb.storage.from(bucket).list(s.user.id, { limit: 1000 });
        const paths = (data || []).map((f) => s.user.id + '/' + f.name);
        if (paths.length) await sb.storage.from(bucket).remove(paths);
      } catch (e) { /* segue mesmo se um balde falhar */ }
    }
  };

  /* ---------- fotos ---------- */
  // opt: { ext, type } para arquivos que não são foto (vídeo da análise)
  api.upload = async function (bucket, blob, opt) {
    const o = opt || {};
    const s = await api.session();
    if (!s) throw new Error('Entre na sua conta para enviar fotos.');
    const path = s.user.id + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + (o.ext || 'jpg');
    const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: o.type || 'image/jpeg', upsert: false, cacheControl: '31536000' });
    if (error) throw fail(error);
    return path;
  };
  api.publicUrl = (bucket, path) => sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  api.signedUrl = async function (path, bucket) {
    const { data, error } = await sb.storage.from(bucket || 'verificacoes').createSignedUrl(path, bucket === 'analises' ? 3600 : 900);
    if (error) throw fail(error);
    return data.signedUrl;
  };

  /* ---------- Pix pelo Mercado Pago (null = modo manual) ---------- */
  api.pixCreate = async function (cents) {
    const { data, error } = await sb.functions.invoke('pix-criar', { body: { amount_cents: cents } });
    if (!error) return data;
    let body = null;
    try { body = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch (e) { body = null; }
    const status = error.context && error.context.status;
    if (status === 501 || status === 404 || (body && body.error === 'mp_nao_configurado')) return null;
    throw fail(body && body.error ? body.error : error);
  };

  // identificador do aparelho (bloqueio de quem foi banido por trapaça). No navegador, um código salvo no aparelho.
  api.deviceId = async function () {
    const Device = Cap && Cap.Plugins && Cap.Plugins.Device;
    if (native && Device && Device.getId) {
      try { const r = await Device.getId(); if (r && r.identifier) return 'and:' + r.identifier; } catch (e) { /* segue para o código salvo */ }
    }
    let id = store.getItem('bh.device');
    if (!id) { id = 'web:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); store.setItem('bh.device', id); }
    return id;
  };

  // abre um endereço fora do app (WhatsApp, navegador)
  api.openExternal = function (url) {
    const Browser = Cap && Cap.Plugins && Cap.Plugins.Browser;
    if (native && Browser) return Browser.open({ url });
    window.open(url, '_blank', 'noopener');
    return Promise.resolve();
  };

  /* ---------- convite de testador (link de entrada, só a administração) ---------- */
  api.invite = async function (email) {
    const { data, error } = await sb.functions.invoke('convite', { body: { email } });
    if (!error) return data;
    let body = null;
    try { body = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch (e) { body = null; }
    throw fail(body && body.error ? body.error : error);
  };

  /* ---------- tempo real ---------- */
  const channels = new Set();
  api.realtime = false;
  api.listenMe = function (uid, h) {
    const ch = sb.channel('eu-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'recipient_id=eq.' + uid }, (p) => h.message && h.message(p.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid }, (p) => h.notification && h.notification(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: 'user_id=eq.' + uid }, (p) => h.wallet && h.wallet(p.new))
      .subscribe((status) => { api.realtime = status === 'SUBSCRIBED'; });
    channels.add(ch);
    return ch;
  };
  api.listenRoom = function (roomId, cb) {
    const ch = sb.channel('sala-' + roomId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: 'room_id=eq.' + roomId }, () => cb('chat'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: 'room_id=eq.' + roomId }, () => cb('players'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: 'id=eq.' + roomId }, () => cb('room'))
      .subscribe();
    channels.add(ch);
    return ch;
  };
  api.listenThread = function (threadId, cb) {
    const ch = sb.channel('conversa-' + threadId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'thread_id=eq.' + threadId }, (p) => cb(p.new))
      .subscribe();
    channels.add(ch);
    return ch;
  };
  api.unlisten = function (ch) {
    if (!ch) return;
    channels.delete(ch);
    try { sb.removeChannel(ch); } catch (e) { /* já fechado */ }
  };
  api.unlistenAll = function () { channels.forEach((ch) => { try { sb.removeChannel(ch); } catch (e) { /* idem */ } }); channels.clear(); };

  window.addEventListener('online', () => { api.online = true; document.dispatchEvent(new CustomEvent('bh:online')); });
  window.addEventListener('offline', () => { api.online = false; document.dispatchEvent(new CustomEvent('bh:offline')); });
})();
