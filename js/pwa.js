(() => {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  const workerUrl = new URL('sw.js', document.baseURI);
  const scopeUrl = new URL('.', workerUrl);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(workerUrl.href, { scope: scopeUrl.pathname }).catch(() => {});
  }, { once: true });
})();
