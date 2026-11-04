
(function () {
  // Sentinel so we know if state has been resolved yet
  const ATTR = 'data-aiub-ext';
  const ATTR_FEATURES = 'data-aiub-features';
  const ATTR_THEME = 'data-aiub-theme';
  const DARK_CLASS = 'apx-dark';

  let currentTheme = 'dark';
  let extensionOn = true;
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function darkActive() {
    if (!extensionOn) return false;
    if (currentTheme === 'dark') return true;
    if (currentTheme === 'system') return media ? media.matches : false;
    return false;
  }

  function applyTheme() {
    const root = document.documentElement;
    if (!root) return;
    root.classList.toggle(DARK_CLASS, darkActive());
    root.setAttribute(ATTR_THEME, extensionOn ? currentTheme : 'light');
  }

  function dispatch(enabled, features) {
    extensionOn = Boolean(enabled);
    // Store resolved state as a data attribute (synchronous read for MAIN world)
    document.documentElement.setAttribute(ATTR, extensionOn ? '1' : '0');
    if (features) {
      document.documentElement.setAttribute(ATTR_FEATURES, JSON.stringify(features));
    }
    applyTheme();

    // Also fire an event for any listener still waiting
    document.dispatchEvent(
      new CustomEvent('__aiubExt:state', { detail: { enabled: extensionOn, features: features || {}, theme: currentTheme } })
    );
  }

  function readAll() {
    chrome.storage.sync.get({ extensionEnabled: true, featureToggles: {}, theme: 'dark' }, (r) => {
      currentTheme = ['light', 'dark', 'system'].includes(r.theme) ? r.theme : 'dark';
      dispatch(r.extensionEnabled, r.featureToggles);
    });
  }

  // Initial state on page load
  readAll();

  // React to popup toggles without requiring a page reload
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if ('extensionEnabled' in changes || 'featureToggles' in changes || 'theme' in changes) {
      readAll();
    }
  });

  // Follow OS theme changes while in "system" mode
  if (media) {
    const onMedia = () => applyTheme();
    if (media.addEventListener) media.addEventListener('change', onMedia);
    else if (media.addListener) media.addListener(onMedia);
  }
})();
