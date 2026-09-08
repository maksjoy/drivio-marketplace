/* Telegram presentation only. Identity and all write permissions remain in Supabase Auth/RLS. */
(function () {
  'use strict';
  const bot = 'P2pcarsalbertabot';
  const params = new URLSearchParams(location.search);
  const launch = new URLSearchParams(location.hash.slice(1));
  const mini = params.get('miniapp') === '1' || launch.has('tgWebAppVersion');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let sdk = null, ready = false, formDirty = false, isTelegram = false;
  const byId = id => document.getElementById(id);
  function safeCall(fn) { try { fn(); } catch { /* Older clients retain the ordinary web UI. */ } }
  function supports(version) { return sdk?.isVersionAtLeast?.(version) === true; }
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
  }
  function back() {
    if (byId('mbg')?.classList.contains('show')) {
      if (byId('post')?.textContent === 'Uploading…' || byId('esave')?.disabled) return;
      const backButton = byId('modal')?.querySelector('.backresults');
      if (backButton) backButton.click(); else if (typeof closeM === 'function') closeM();
    } else if (typeof home === 'function') {
      home();
      const homeButton = document.querySelector('.mobile button');
      if (homeButton && typeof nav === 'function') nav(homeButton);
    }
    syncNavigation();
  }
  function init() {
    sdk = window.Telegram?.WebApp;
    isTelegram = !!sdk && sdk.platform !== 'unknown' && !!(sdk.initData || launch.has('tgWebAppVersion'));
    if (mini || isTelegram) document.documentElement.classList.add('miniapp');
    if (!isTelegram) return;
    safeCall(() => sdk.ready());
    safeCall(() => sdk.expand());
    safeCall(() => sdk.setHeaderColor('#ffffff'));
    safeCall(() => sdk.setBackgroundColor('#f5f6f7'));
    if (supports('7.10')) safeCall(() => sdk.setBottomBarColor('#ffffff'));
    if (supports('6.1')) safeCall(() => sdk.BackButton.onClick(back));
    for (const event of ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged']) safeCall(() => sdk.onEvent(event, syncInsets));
    syncInsets(); syncNavigation();
    if (ready) openLaunchListing();
  }
  let opened = false;
  function openLaunchListing() {
    if (opened) return;
    // start_param is untrusted navigation input, NEVER authentication.
    const start = sdk?.initDataUnsafe?.start_param || params.get('tgWebAppStartParam') || '';
    const id = params.get('listing') || (start.startsWith('car_') ? start.slice(4) : '');
    if (!uuid.test(id)) return;
    opened = true;
    if (typeof detail === 'function') detail(id);
  }
  async function shareListing(id, title) {
    if (!uuid.test(id)) return;
    const url = isTelegram
      ? 'https://t.me/' + bot + '?startapp=car_' + encodeURIComponent(id)
      : location.origin + '/?listing=' + encodeURIComponent(id);
    const shareTitle = title || 'Car for sale on P2PCars';
    if (isTelegram) {
      safeCall(() => sdk.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(shareTitle)));
    } else {
      try {
        if (navigator.share) await navigator.share({title: shareTitle, url});
        else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); window.alert('Listing link copied.'); }
        else window.prompt('Copy this listing link:', url);
      } catch (error) { if (error.name !== 'AbortError') window.prompt('Copy this listing link:', url); }
    }
  }
  document.addEventListener('click', event => {
    const share = event.target.closest?.('[data-share-listing]');
    if (share) { shareListing(share.dataset.shareListing, share.dataset.shareTitle); return; }
    if (!isTelegram) return;
    const link = event.target.closest?.('a[href]');
    // Keep seller contact links inside Telegram; leave phone/email handlers to the OS.
    if (link && /^https:\/\/t\.me\//i.test(link.href)) {
      event.preventDefault(); safeCall(() => sdk.openTelegramLink(link.href));
    }
    if (supports('6.1') && event.target.closest?.('.mobile button,.fav')) safeCall(() => sdk.HapticFeedback.selectionChanged());
  });
  document.addEventListener('input', event => {
    if (!isTelegram || formDirty || !supports('6.2') || !event.target.closest?.('#modal form')) return;
    formDirty = true; safeCall(() => sdk.enableClosingConfirmation());
  });
  if (typeof MutationObserver !== 'undefined' && byId('mbg')) new MutationObserver(syncNavigation).observe(byId('mbg'), {attributes:true, attributeFilter:['class']});
  window.P2PTelegram = { syncNavigation, shareListing, appReady() { ready = true; syncNavigation(); openLaunchListing(); } };
  if (mini) document.documentElement.classList.add('miniapp');
  // Load the SDK only for a Mini App launch. A failed SDK must never prevent browsing.
  if (mini || window.Telegram?.WebApp) {
    if (window.Telegram?.WebApp) init();
    else {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true; script.onload = init;
      document.head.appendChild(script);
    }
  }
}());
