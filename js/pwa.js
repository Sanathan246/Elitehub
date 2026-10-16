(() => {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  const workerUrl = new URL('/sw.js', location.origin);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(workerUrl.href, { scope: '/' }).catch((error) => {
      console.warn('EliteHub offline support could not be enabled.', error);
    });
  }, { once: true });
})();
