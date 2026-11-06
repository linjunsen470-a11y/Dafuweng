export function registerPWA() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('离线服务注册失败', error);
    });
  };
  // The module is imported asynchronously after game initialization, so load
  // may already have fired before this function runs.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
