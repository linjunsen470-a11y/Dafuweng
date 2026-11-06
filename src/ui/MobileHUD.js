// Reuse the full game's existing toolbar; keep a small board view on phones.
export function bindMobileHUD(root = document) {
  const button = root.getElementById('btn-mobile-tools');
  const tools = root.getElementById('hud-tools');
  if (!button || !tools) return;
  const setOpen = open => {
    tools.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? '关闭菜单' : '地图 / 菜单';
  };
  const compact = root.defaultView?.matchMedia('(max-width: 820px)');
  compact?.addEventListener('change', event => { if (!event.matches) setOpen(false); });
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  tools.addEventListener('click', event => {
    if (event.target.closest('button')) setOpen(false);
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
}
