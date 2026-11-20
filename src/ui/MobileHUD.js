// The same disclosure works with a mouse, touchscreen or keyboard.
export function bindMobileHUD(root = document) {
  const button = root.getElementById('btn-mobile-tools');
  const tools = root.getElementById('hud-tools');
  if (!button || !tools) return;
  const setOpen = open => {
    tools.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? '收起 ▴' : '更多 ▾';
  };
  root.addEventListener('pointerdown', event => {
    if (tools.classList.contains('is-open') && !tools.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  root.getElementById('btn-news-menu').onclick = () => root.getElementById('btn-news-history').click();
  const pace = root.getElementById('ai-pace');
  root.getElementById('btn-ai-pace').onclick = () => {
    pace.selectedIndex = (pace.selectedIndex + 1) % pace.options.length;
    pace.dispatchEvent(new Event('change'));
  };
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
