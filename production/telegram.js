/* Telegram controls only. Identity is verified on the server from signed initData. */
(function () {
  'use strict';
  const bot = 'P2pcarsalbertabot';
  const params = new URLSearchParams(location.search);
  const launch = new URLSearchParams(location.hash.slice(1));
  const mini = !!document.querySelector('meta[name="p2p-app"][content="telegram"]') || params.get('miniapp') === '1' || launch.has('tgWebAppVersion') || !!window.Telegram?.WebApp?.initData;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let sdk = null, ready = false, formDirty = false, isTelegram = false, nativeAction = null, opened = false;
  let finishSdk;
  const sdkReady = new Promise(resolve => { finishSdk = resolve; });
  const byId = id => document.getElementById(id);
  function safeCall(fn) { try { fn(); } catch { /* Older clients keep usable HTML controls. */ } }
  function supports(version) { return sdk?.isVersionAtLeast?.(version) === true; }
  function syncTheme() {
    if (!isTelegram) return;
    const theme = sdk.themeParams || {};
    const defaults = sdk.colorScheme === 'dark'
      ? {bg_color:'#17212b',secondary_bg_color:'#0e1621',text_color:'#f5f5f5',hint_color:'#a0acb8',button_color:'#5288c1',button_text_color:'#ffffff',link_color:'#6ab2f2'}
      : {bg_color:'#ffffff',secondary_bg_color:'#f2f3f5',text_color:'#1c1c1e',hint_color:'#707579',button_color:'#2481cc',button_text_color:'#ffffff',link_color:'#2481cc'};
    for (const [name, fallback] of Object.entries(defaults)) {
      const color = /^#[0-9a-f]{6}$/i.test(theme[name] || '') ? theme[name] : fallback;
      document.documentElement.style.setProperty('--p2p-' + name.replaceAll('_','-'), color);
    }
    document.documentElement.style.colorScheme = sdk.colorScheme === 'dark' ? 'dark' : 'light';
    safeCall(() => sdk.setHeaderColor('bg_color'));
    safeCall(() => sdk.setBackgroundColor(theme.secondary_bg_color || defaults.secondary_bg_color));
    if (supports('7.10')) safeCall(() => sdk.setBottomBarColor(theme.bg_color || defaults.bg_color));
  }
  function syncInsets() {
    if (!isTelegram) return;
    const root = document.documentElement.style;
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const outer = Number(sdk.safeAreaInset?.[edge]) || 0;
      const content = Number(sdk.contentSafeAreaInset?.[edge]) || 0;
      root.setProperty('--p2p-safe-' + edge, Math.max(0, outer + content) + 'px');
    }
    if (sdk.viewportStableHeight > 0) root.setProperty('--p2p-viewport-height', sdk.viewportStableHeight + 'px');
  }
  function syncNavigation() {
    if (!isTelegram || !supports('6.1')) return;
    const modalOpen = byId('mbg')?.classList.contains('show');
    const away = typeof view !== 'undefined' && view !== 'home';
    safeCall(() => modalOpen || away ? sdk.BackButton.show() : sdk.BackButton.hide());
    if (!modalOpen) { formDirty = false; safeCall(() => sdk.disableClosingConfirmation()); }
    nativeAction = null;
    if (!sdk.MainButton) return;
    const submit = modalOpen && (byId('post') || byId('esave'));
    const contact = modalOpen && byId('modal')?.querySelector('[data-contact-telegram]');
    if (submit && !submit.disabled) {
      nativeAction = () => submit.form?.requestSubmit(submit);
      safeCall(() => sdk.MainButton.setParams({text:submit.textContent, is_active:true, is_visible:true}));
    } else if (contact) {
      nativeAction = () => sdk.openTelegramLink(contact.href);
      safeCall(() => sdk.MainButton.setParams({text:'Message seller', is_active:true, is_visible:true}));
    } else safeCall(() => sdk.MainButton.hide());
  }
  function back() {
    if (byId('mbg')?.classList.contains('show')) {
      if ((byId('post')?.disabled && byId('post').textContent !== 'Submitted') || (byId('esave')?.disabled && byId('esave').textContent !== 'Saved')) return;
      const backButton = byId('modal')?.querySelector('.backresults');
      if (backButton) backButton.click(); else if (typeof closeM === 'function') closeM();
    } else if (typeof home === 'function') {
      home();
      const homeButton = document.querySelector('.mobile button');
      if (homeButton && typeof nav === 'function') nav(homeButton);
    }
    syncNavigation();
  }
  function finish() {
    const panel = byId('telegramLaunch');
    if (panel) panel.hidden = isTelegram || !mini;
    finishSdk();
  }
  function init() {
    sdk = window.Telegram?.WebApp;
    isTelegram = !!sdk && sdk.platform !== 'unknown' && !!sdk.initData;
    if (mini || isTelegram) document.documentElement.classList.add('miniapp');
    if (!isTelegram) { finish(); return; }
    safeCall(() => sdk.ready());
    safeCall(() => sdk.expand());
    syncTheme(); syncInsets();
    if (supports('6.1')) {
      safeCall(() => sdk.BackButton.onClick(back));
      safeCall(() => sdk.MainButton?.onClick(() => { if (nativeAction) nativeAction(); }));
    }
    for (const event of ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged']) safeCall(() => sdk.onEvent(event, syncInsets));
    safeCall(() => sdk.onEvent('themeChanged', syncTheme));
    syncNavigation(); finish();
    if (ready) openLaunchListing();
  }
  function openLaunchListing() {
    if (opened) return;
    // Untrusted navigation data never establishes identity.
    const start = sdk?.initDataUnsafe?.start_param || params.get('tgWebAppStartParam') || '';
    const id = params.get('listing') || (start.startsWith('car_') ? start.slice(4) : '');
    if (!uuid.test(id)) return;
    opened = true;
    if (typeof detail === 'function') detail(id);
  }
  async function shareListing(id, title) {
    if (!uuid.test(id)) return;
    const url = mini || isTelegram
      ? 'https://t.me/' + bot + '?startapp=car_' + encodeURIComponent(id)
      : location.origin + '/?listing=' + encodeURIComponent(id);
    const shareTitle = title || 'Car for sale on P2Pcars';
    if (isTelegram) {
      safeCall(() => sdk.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(shareTitle)));
    } else {
      try {
        if (navigator.share) await navigator.share({title:shareTitle,url});
        else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); window.alert('Listing link copied.'); }
        else window.prompt('Copy this listing link:',url);
      } catch (error) { if (error.name !== 'AbortError') window.prompt('Copy this listing link:',url); }
    }
  }
  document.addEventListener('click', event => {
    const share = event.target.closest?.('[data-share-listing]');
    if (share) { shareListing(share.dataset.shareListing, share.dataset.shareTitle); return; }
    if (!isTelegram) return;
    const link = event.target.closest?.('a[href]');
    if (link && /^https:\/\/t\.me\//i.test(link.href)) {
      event.preventDefault(); safeCall(() => sdk.openTelegramLink(link.href));
    }
    if (supports('6.1') && event.target.closest?.('.mobile button,.fav')) safeCall(() => sdk.HapticFeedback.selectionChanged());
  });
  document.addEventListener('input', event => {
    if (!isTelegram || formDirty || !supports('6.2') || !event.target.closest?.('#modal form')) return;
    formDirty = true; safeCall(() => sdk.enableClosingConfirmation());
  });
  if (typeof MutationObserver !== 'undefined' && byId('mbg')) {
    new MutationObserver(syncNavigation).observe(byId('mbg'), {attributes:true,attributeFilter:['class','disabled'],childList:true,subtree:true});
  }
  window.P2PTelegram = {
    isMiniApp:mini, syncNavigation, shareListing,
    async getInitData() { await sdkReady; return isTelegram ? sdk.initData : ''; },
    appReady() { ready = true; syncNavigation(); openLaunchListing(); }
  };
  if (mini) document.documentElement.classList.add('miniapp');
  if (mini || window.Telegram?.WebApp) {
    if (window.Telegram?.WebApp) init();
    else {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true; script.onload = init; script.onerror = finish;
      document.head.appendChild(script);
      setTimeout(finish,8000);
    }
  } else finish();
}());
