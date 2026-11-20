// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { BankUI } from '../src/ui/BankUI.js';
import { PassingBankPill } from '../src/ui/PassingBankPill.js';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('discards an ignored offer on leaving the turn and rejects stale clicks', () => {
  const pill = new PassingBankPill();
  const visit = vi.fn();
  pill.show('第一位', visit);
  const first = pill.el;
  pill.hide();
  expect(pill.el).toBeNull();
  expect(pill.pending).toBeNull();
  pill.show('第二位', visit);
  first.click();
  expect(visit).not.toHaveBeenCalled();
  expect(pill.el.textContent).toContain('第二位');
  pill.hide();
});

it('waits for the selected counter and refreshes the active land choice once', async () => {
  vi.useFakeTimers();
  const pill = new PassingBankPill();
  const footer = document.body.appendChild(document.createElement('footer'));
  let leave;
  const visit = vi.fn(() => new Promise(resolve => { leave = resolve; }));
  const refresh = vi.fn();
  pill.show('路过玩家', visit);
  const button = pill.el;
  pill.dockInLandDialog(footer, refresh);
  vi.advanceTimersByTime(10000);
  expect(footer.previousElementSibling).toBe(button);
  button.click();
  button.click();
  expect(visit).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
  const pending = pill.pending;
  leave();
  await pending;
  expect(refresh).toHaveBeenCalledOnce();
  expect(pill.pending).toBeNull();
});

it('cancels a replaced bank dialog and ignores its delayed confirmation', async () => {
  vi.useFakeTimers();
  const bank = new BankUI();
  const visit = { player: { cash: 4000 }, state: { round: 1 }, passing: true };
  const first = bank.choose(visit);
  bank.overlay.querySelector('.bank-confirm').click();
  const second = bank.choose(visit);
  await expect(first).resolves.toBeNull();
  await vi.advanceTimersByTimeAsync(240);
  expect(bank.overlay?.isConnected).toBe(true);
  bank.close();
  await expect(second).resolves.toBeNull();
});

it('settles the direction and amount chosen when the customer confirms', async () => {
  vi.useFakeTimers();
  const bank = new BankUI();
  const done = bank.choose({ player: { cash: 4000 }, state: { round: 1 } });
  bank.overlay.querySelector('[data-direction="LOAN"]').click();
  bank.overlay.querySelector('.bank-confirm').click();
  bank.overlay.querySelector('[data-direction="DEPOSIT"]').click();
  await vi.advanceTimersByTimeAsync(240);
  await expect(done).resolves.toEqual({ direction: 'LOAN', amount: 5000 });
});
