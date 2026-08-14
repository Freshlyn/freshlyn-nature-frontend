import type { Coordinates } from '@/lib/platform/geolocation';
import { supabase } from '@/lib/supabase';

/**
 * Readings worse than this many metres are treated as unusable.
 *
 * A desktop browser without GPS hardware often returns an IP-derived position,
 * which in India can resolve to the wrong city entirely; a phone indoors
 * without a lock can return a poor Wi-Fi-derived fix for the same reason.
 *
 * The threshold matters most at address save, where a 5km-accurate reading
 * would otherwise be written permanently onto the row as though it were
 * precise, and every future order to that address would inherit the mistake.
 */
export const ACCURACY_THRESHOLD_METRES = 2000;

/**
 * True when a fix is precise enough to run the polygon check against.
 *
 * A false result is handled exactly like a permission denial: the caller
 * discards the coordinates and reveals the pincode fallback.
 */
export function isUsableFix(coords: Coordinates): boolean {
  return Number.isFinite(coords.accuracy) && coords.accuracy <= ACCURACY_THRESHOLD_METRES;
}

export type MatchedBy = 'gps' | 'pincode' | 'none';

export interface ServiceabilityResult {
  serviceable: boolean;
  zoneId: string | null;
  matchedBy: MatchedBy;
}

interface ServiceabilityRow {
  serviceable: boolean;
  zone_id: string | null;
  matched_by: MatchedBy;
}

/**
 * The verdict for a set of location values.
 *
 * Every client caller of this is ADVISORY -- it exists so the user is never
 * surprised at checkout. The binding check runs inside create_order, which
 * asks the same Postgres function with the same stored address values, so the
 * two can never disagree except during a mid-session zone change.
 */
export async function checkServiceability(input: {
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string | null;
}): Promise<ServiceabilityResult> {
  const { data, error } = await supabase.rpc('check_serviceability', {
    p_lat: input.latitude ?? null,
    p_lng: input.longitude ?? null,
    p_pincode: input.pincode ?? null,
  });

  // Fail closed on every uncertain path: an errored or empty response is not
  // an approval.
  if (error || !Array.isArray(data) || data.length === 0) {
    return { serviceable: false, zoneId: null, matchedBy: 'none' };
  }

  const row = data[0] as ServiceabilityRow;
  return {
    serviceable: row.serviceable,
    zoneId: row.zone_id,
    matchedBy: row.matched_by,
  };
}
