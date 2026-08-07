import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capacitor's own module is mocked so the test runs in plain Node with no
// native bridge present. We are testing our delegation, not Capacitor.
const isNativePlatform = vi.fn();
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

describe('isNative', () => {
  beforeEach(() => {
    vi.resetModules();
    isNativePlatform.mockReset();
  });

  it('returns false in a browser runtime', async () => {
    isNativePlatform.mockReturnValue(false);
    const { isNative } = await import('./index');
    expect(isNative()).toBe(false);
  });

  it('returns true in a native runtime', async () => {
    isNativePlatform.mockReturnValue(true);
    const { isNative } = await import('./index');
    expect(isNative()).toBe(true);
  });
});
