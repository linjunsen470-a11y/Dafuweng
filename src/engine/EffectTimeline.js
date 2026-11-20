// Wall-clock expiry also releases GPU resources when the browser suspends drawing.
export function playEffect(duration, frame, finish, skip = () => false) {
  const start = performance.now();
  let done = false, raf;
  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    finish();
  };
  const timer = setTimeout(stop, duration + 100);
  const tick = now => {
    const t = Math.min(1, (now - start) / duration);
    if (skip() || t >= 1) return stop();
    frame(Math.max(0, t));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return stop;
}

export function quietMotion() {
  const html = globalThis.document?.documentElement;
  return html?.classList.contains('reduce-motion') || html?.classList.contains('skip-ai-motion')
    || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function releaseEffect(group) {
  const resources = new Set();
  group.traverse(mesh => {
    if (mesh.geometry) resources.add(mesh.geometry);
    if (mesh.material) resources.add(mesh.material);
    if (mesh.isInstancedMesh) mesh.dispose();
  });
  group.removeFromParent();
  resources.forEach(resource => resource.dispose());
}
