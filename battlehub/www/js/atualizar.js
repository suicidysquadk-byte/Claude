/* Atualização automática do app.
   A cada abertura (e quando o app volta para a tela) o app confere o arquivo versao.json publicado pelo GitHub Actions
   no Supabase (bucket público "app"). Se houver versão nova:
   - só telas e funções (o normal): baixa o pacote em segundo plano e aplica na próxima vez que o app abrir,
     ou na hora, se a pessoa tocar em "Atualizar agora";
   - mudou a parte nativa do Android: mostra o aviso para baixar o APK novo.
   Tudo é conferido: o pacote tem o código SHA-256 publicado junto e o plugin só troca se o download bater. */
window.BH = window.BH || {};
(function () {
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  if (!native) return;
  const P = Cap.Plugins || {};
  const Up = P.CapacitorUpdater;
  // avisa o plugin que este pacote abriu bem (sem isso ele volta para o anterior sozinho)
  if (Up && Up.notifyAppReady) Up.notifyAppReady().catch(() => {});

  const cfg = window.BH_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  if (!base) return;
  const manifestUrl = base + '/storage/v1/object/public/app/versao.json';
  const mine = (BH.BUILD && BH.BUILD.code) || 0;
  let busy = false, lastCheck = 0, ready = null, warnedApk = false;

  async function nativeCode() {
    try { const i = await P.App.getInfo(); return Number(i.build) || 0; } catch (e) { return 0; }
  }

  async function check(force) {
    if (busy || (!force && Date.now() - lastCheck < 20 * 60e3)) return;
    busy = true; lastCheck = Date.now();
    try {
      const r = await fetch(manifestUrl + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const v = await r.json();
      if (!v || !(Number(v.build) > mine)) return;
      const code = await nativeCode();
      // parte nativa mudou (ou o app é antigo, sem o atualizador): precisa do APK novo
      if (!Up || code < Number(v.min_code || 0)) {
        if (!warnedApk && v.apk_url) { warnedApk = true; offerApk(v); }
        return;
      }
      if (ready && ready.build === v.build) return offerReload();
      const b = await Up.download({ url: v.bundle_url, version: String(v.build), checksum: v.sha256 || undefined });
      await Up.next({ id: b.id }); // aplica na próxima abertura
      ready = { build: v.build, id: b.id, version: v.version };
      offerReload();
    } catch (e) {
      /* sem internet ou servidor fora: tenta de novo depois */
    } finally { busy = false; }
  }

  function offerReload() {
    if (!ready || !BH.ui) return;
    BH.ui.confirm({ title: 'Atualização pronta', icon: 'refresh', ok: 'Atualizar agora', cancel: 'Depois',
      body: 'A versão ' + (ready.version || ready.build) + ' do BattleHub já foi baixada. Se preferir, ela entra sozinha na próxima vez que você abrir o app.' })
      .then((ok) => { if (ok) Up.set({ id: ready.id }).catch(() => {}); });
  }

  function offerApk(v) {
    if (!BH.ui) return;
    BH.ui.confirm({ title: 'Nova versão do app', icon: 'arrowIn', ok: 'Baixar', cancel: 'Depois',
      body: 'Saiu a versão ' + (v.version || '') + ' do BattleHub com mudanças que precisam do instalador novo. Toque em Baixar, abra o arquivo e confirme a instalação.' +
        (v.apk_note ? '<br><br>' + BH.ui.esc(v.apk_note) : '') })
      .then((ok) => { if (!ok) return; if (P.Browser) P.Browser.open({ url: v.apk_url }); else window.open(v.apk_url, '_system'); });
  }

  // abre, volta para a tela e, de vez em quando, com o app aberto
  window.addEventListener('load', () => setTimeout(() => check(true), 4000));
  if (P.App && P.App.addListener) P.App.addListener('appStateChange', (s) => { if (s.isActive) check(false); });
  setInterval(() => check(false), 30 * 60e3);
  BH.update = { check: () => check(true) };
})();
