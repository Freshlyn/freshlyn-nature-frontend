import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNative = vi.fn();
vi.mock('@/lib/platform', () => ({ isNative: () => isNative() }));

const prefsGet = vi.fn();
const prefsSet = vi.fn();
const prefsRemove = vi.fn();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: (opts: { key: string }) => prefsGet(opts),
    set: (opts: { key: string; value: string }) => prefsSet(opts),
    remove: (opts: { key: string }) => prefsRemove(opts),
  },
}));

describe('platformStorage', () => {
  beforeEach(() => {
    vi.resetModules();
    isNative.mockReset();
    prefsGet.mockReset();
    prefsSet.mockReset();
    prefsRemove.mockReset();
    localStorage.clear();
  });

  it('reads and writes localStorage on web', async () => {
    isNative.mockReturnValue(false);
    const { platformStorage } = await import('./storage');

    await platformStorage.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
    expect(await platformStorage.getItem('k')).toBe('v');

    await platformStorage.removeItem('k');
    expect(await platformStorage.getItem('k')).toBeNull();
    expect(prefsSet).not.toHaveBeenCalled();
  });

  it('returns null for a missing key on web', async () => {
    isNative.mockReturnValue(false);
    const { platformStorage } = await import('./storage');
    expect(await platformStorage.getItem('absent')).toBeNull();
  });

  it('delegates to Preferences on native', async () => {
    isNative.mockReturnValue(true);
    prefsGet.mockResolvedValue({ value: 'stored' });
    prefsSet.mockResolvedValue(undefined);
    prefsRemove.mockResolvedValue(undefined);
    const { platformStorage } = await import('./storage');

    await platformStorage.setItem('k', 'v');
    expect(prefsSet).toHaveBeenCalledWith({ key: 'k', value: 'v' });

    expect(await platformStorage.getItem('k')).toBe('stored');

    await platformStorage.removeItem('k');
    expect(prefsRemove).toHaveBeenCalledWith({ key: 'k' });
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('normalises a missing native key to null', async () => {
    // Preferences resolves { value: null } for an absent key. supabase-js
    // expects exactly null, so an undefined leaking through here would be
    // read as a corrupt session rather than as "no session".
    isNative.mockReturnValue(true);
    prefsGet.mockResolvedValue({ value: null });
    const { platformStorage } = await import('./storage');
    expect(await platformStorage.getItem('absent')).toBeNull();
  });
});
