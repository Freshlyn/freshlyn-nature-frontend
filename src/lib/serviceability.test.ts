import { describe, it, expect, vi, beforeEach } from 'vitest';

// The supabase client is mocked so this runs in plain jsdom with no network.
// We are testing the RPC argument shape and the result mapping, not PostgREST.
const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { isUsableFix, ACCURACY_THRESHOLD_METRES } from './serviceability';

describe('isUsableFix', () => {
  it('accepts a precise phone GPS fix', () => {
    expect(isUsableFix({ latitude: 22.53, longitude: 88.36, accuracy: 12 })).toBe(true);
  });

  it('accepts a reading exactly at the threshold', () => {
    // The spec says readings WORSE than 2000m are unusable. 2000 itself is not
    // worse than 2000, so it is kept -- a boundary an off-by-one would flip.
    expect(
      isUsableFix({ latitude: 22.53, longitude: 88.36, accuracy: ACCURACY_THRESHOLD_METRES }),
    ).toBe(true);
  });

  it('rejects a reading worse than the threshold', () => {
    // A desktop browser with no GPS hardware returns an IP-derived position,
    // which in India can resolve to the wrong city entirely. Writing that onto
    // an address row would make the wrong verdict permanent.
    expect(
      isUsableFix({ latitude: 22.53, longitude: 88.36, accuracy: ACCURACY_THRESHOLD_METRES + 1 }),
    ).toBe(false);
  });

  it('rejects a 5km-accurate reading', () => {
    expect(isUsableFix({ latitude: 22.53, longitude: 88.36, accuracy: 5000 })).toBe(false);
  });

  it('rejects a reading with a non-finite accuracy', () => {
    // Some WebViews report Infinity or NaN when no fix is available. Neither
    // is "worse than 2000" under a naive comparison, so both would sneak past.
    expect(isUsableFix({ latitude: 22.53, longitude: 88.36, accuracy: Number.NaN })).toBe(false);
    expect(isUsableFix({ latitude: 22.53, longitude: 88.36, accuracy: Infinity })).toBe(false);
  });
});

describe('checkServiceability', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('passes coordinates and pincode through under their p_ names', async () => {
    rpc.mockResolvedValue({ data: [{ serviceable: true, zone_id: 'z1', matched_by: 'gps' }], error: null });
    const { checkServiceability } = await import('./serviceability');

    await checkServiceability({ latitude: 22.53, longitude: 88.36, pincode: '700019' });

    expect(rpc).toHaveBeenCalledWith('check_serviceability', {
      p_lat: 22.53,
      p_lng: 88.36,
      p_pincode: '700019',
    });
  });

  it('sends nulls rather than undefined for absent inputs', async () => {
    // PostgREST omits undefined keys, which would silently pick the function's
    // defaults. That happens to be correct today, but an explicit null keeps
    // the wire shape stable if the defaults ever change.
    rpc.mockResolvedValue({ data: [{ serviceable: true, zone_id: 'z1', matched_by: 'pincode' }], error: null });
    const { checkServiceability } = await import('./serviceability');

    await checkServiceability({ pincode: '700019' });

    expect(rpc).toHaveBeenCalledWith('check_serviceability', {
      p_lat: null,
      p_lng: null,
      p_pincode: '700019',
    });
  });

  it('maps the returned row to camelCase', async () => {
    rpc.mockResolvedValue({ data: [{ serviceable: true, zone_id: 'zone-1', matched_by: 'gps' }], error: null });
    const { checkServiceability } = await import('./serviceability');

    const result = await checkServiceability({ latitude: 22.53, longitude: 88.36 });

    expect(result).toEqual({ serviceable: true, zoneId: 'zone-1', matchedBy: 'gps' });
  });

  it('fails closed when the RPC errors', async () => {
    // A database fault must never be read as "yes". For a delivery business,
    // an unfulfillable accepted order costs a refund, a wasted trip and trust;
    // a wrongly blocked one costs a single order.
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { checkServiceability } = await import('./serviceability');

    const result = await checkServiceability({ latitude: 22.53, longitude: 88.36 });

    expect(result).toEqual({ serviceable: false, zoneId: null, matchedBy: 'none' });
  });

  it('fails closed when the RPC returns no rows', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { checkServiceability } = await import('./serviceability');

    const result = await checkServiceability({ pincode: '700019' });

    expect(result).toEqual({ serviceable: false, zoneId: null, matchedBy: 'none' });
  });
});
