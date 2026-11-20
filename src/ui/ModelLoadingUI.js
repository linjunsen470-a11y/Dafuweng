import { DefaultLoadingManager } from 'three';

// Observe Three's actual model/texture requests. Input stays available while models stream.
export function bindModelLoading(manager = DefaultLoadingManager) {
  const panel = document.getElementById('model-loading');
  const bar = panel.querySelector('progress');
  let hideTimer, revealTimer, baseline=0;
  const closed = () => {
    clearTimeout(hideTimer);
    clearTimeout(revealTimer);
    panel.hidden=true;
  };
  const update = (loaded,total) => {
    bar.max=Math.max(1,total-baseline);
    bar.value=Math.max(0,loaded-baseline);
  };
  manager.onStart = (_url, loaded, total) => {
    closed();
    baseline=loaded;
    update(loaded,total);
    revealTimer=setTimeout(()=>{panel.hidden=false;},180);
    hideTimer=setTimeout(closed,7000);
  };
  manager.onProgress = (_url,loaded,total) => update(loaded,total);
  manager.onLoad = closed;
}
