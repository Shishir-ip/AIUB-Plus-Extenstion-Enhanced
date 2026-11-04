
(function () {
  /* Login-page theme bridge — same behavior as contentBridge.jsx but as a
     separate file, because @crxjs cannot register one content script file in
     two manifest blocks. Applies the Light/Dark/System theme to <html>. */
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

  function readAll() {
    try {
      chrome.storage.sync.get({ extensionEnabled: true, theme: 'dark' }, (r) => {
        extensionOn = r.extensionEnabled !== false;
        currentTheme = ['light', 'dark', 'system'].includes(r.theme) ? r.theme : 'dark';
        applyTheme();
      });
    } catch (e) {
      applyTheme();
    }
  }

  readAll();

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if ('extensionEnabled' in changes || 'theme' in changes) readAll();
    });
  } catch (e) { /* ignore */ }

  if (media) {
    const onMedia = () => applyTheme();
    if (media.addEventListener) media.addEventListener('change', onMedia);
    else if (media.addListener) media.addListener(onMedia);
  }
})();
