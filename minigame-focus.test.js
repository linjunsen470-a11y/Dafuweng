// @vitest-environment happy-dom
import {it,expect,vi,afterEach} from 'vitest';import {MinigameUI} from './src/ui/MinigameUI.js';
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
