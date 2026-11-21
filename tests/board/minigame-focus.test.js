// @vitest-environment happy-dom
import {it,expect,vi,afterEach} from 'vitest';import {MinigameUI} from '../../src/ui/MinigameUI.js';
afterEach(()=>{vi.useRealTimers();document.body.replaceChildren();});
it('focuses Start and keeps forward/backward Tab inside the briefing',async()=>{
 const ui=new MinigameUI(),done=ui.play('SKY_COINS');const start=document.querySelector('.minigame-start'),skip=document.querySelector('.minigame-skip');expect(document.activeElement).toBe(start);window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,cancelable:true}));expect(document.activeElement).toBe(skip);window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',cancelable:true}));expect(document.activeElement).toBe(start);skip.click();expect(await done).toBe(0);
});
it('focuses the actual reward button after timed play and resolves its real score once',async()=>{
 vi.useFakeTimers();const ui=new MinigameUI(),done=ui.play('SKY_COINS');document.querySelector('.minigame-start').click();await vi.advanceTimersByTimeAsync(3000);document.querySelector('.sky-object.kind-coin').click();await vi.advanceTimersByTimeAsync(10000);const claim=document.querySelector('.minigame-claim');expect(document.activeElement).toBe(claim);expect(claim.textContent).toContain('20 点券');window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',cancelable:true}));expect(document.activeElement).toBe(claim);claim.click();claim.click();expect(await done).toBe(10);expect(document.querySelector('.minigame-modal')).toBe(null);expect(ui.activeFinish).toBe(null);
});
it('does not launch the game when Enter is directed at the skip button',async()=>{
 const ui=new MinigameUI(),done=ui.play('SKY_COINS');const skip=document.querySelector('.minigame-skip');skip.focus();skip.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));expect(document.querySelector('.minigame-start')).not.toBe(null);skip.click();expect(await done).toBe(0);
});

it('cleans keyboard handlers even when the briefing is skipped before starting',async()=>{
 vi.useFakeTimers();const ui=new MinigameUI(),done=ui.play('SKY_COINS');document.querySelector('.minigame-skip').click();expect(await done).toBe(0);
 document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));expect(vi.getTimerCount()).toBe(0);expect(document.querySelector('.minigame-modal')).toBe(null);
 const next=ui.play('SKY_COINS');expect(document.activeElement).toBe(document.querySelector('.minigame-start'));ui.activeFinish();expect(await next).toBe(0);
});

it('lets Escape finish the active game through the application modal coordinator', async () => {
  vi.useFakeTimers();
  const { ModalCoordinator } = await import('../../src/ui/ModalCoordinator.js');
  const coordinator = new ModalCoordinator();
  try {
    const done = new MinigameUI().play('SKY_COINS');
    coordinator.sync();
    document.querySelector('.minigame-start').click();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('.minigame-claim').textContent).toContain('0 点券');
    document.querySelector('.minigame-claim').click();
    await expect(done).resolves.toBe(0);
  } finally {
    coordinator.observer.disconnect();
    document.removeEventListener('keydown', coordinator.onKeydown, true);
  }
});

it('keeps the coin in reach when rendering resumes after a long frame', async () => {
  vi.useFakeTimers();
  const { launchSkyCoinsArcade } = await import('../../src/ui/MinigameCanvas.js');
  const stage = document.createElement('div');
  const timers = [];
  launchSkyCoinsArcade({
    stage, progress: document.createElement('span'), onKey: () => {},
    every: callback => timers.push(callback)
  });
  const coin = stage.querySelector('.kind-coin');
  const start = parseFloat(coin.style.top);
  await vi.advanceTimersByTimeAsync(1500);
  timers[0]();
  expect(stage.contains(coin)).toBe(true);
  expect(parseFloat(coin.style.top)).toBeGreaterThan(start);
  expect(parseFloat(coin.style.top) - start).toBeLessThan(5);
});
