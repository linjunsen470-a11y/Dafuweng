// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerPWA } from '../src/pwa.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function setup(readyState) {
  vi.stubEnv('PROD', true);
  vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState);
  const register = vi.fn().mockResolvedValue({});
  vi.stubGlobal('navigator', { serviceWorker: { register } });
  return register;
}

describe('PWA registration timing', () => {
  it('registers when the lazy module arrives after window load', () => {
    const register = setup('complete');
    registerPWA();
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js');
  });

  it('waits for load and registers only once when the page is still loading', () => {
    const register = setup('interactive');
    registerPWA();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js');
  });

  it('reports a rejected registration without an unhandled promise', async () => {
    const register = setup('complete');
    const error = new Error('registration unavailable');
    register.mockRejectedValue(error);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerPWA();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith('离线服务注册失败', error);
  });
});
