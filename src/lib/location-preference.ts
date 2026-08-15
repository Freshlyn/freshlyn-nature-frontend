import { platformStorage } from "@/lib/platform/storage";
import type { MatchedBy } from "@/lib/serviceability";

const KEY = "freshlyn.location-preference";

export interface LocationPreference {
  serviceable: boolean;
  /** What the header shows: a zone name, or the pincode the user typed. */
  label: string;
  matchedBy: MatchedBy;
  /**
   * The fix that produced a GPS verdict, kept so the address form can offer
   * it rather than opening a second permission moment. Absent for a
   * pincode-tier verdict and for values stored before this field existed.
   */
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * The app-open screen's outcome, remembered per device.
 *
 * Local storage rather than the database, for two reasons: the user is often
 * anonymous when the screen runs, and the answer is a device-level preference
 * with no bearing on checkout. Nothing here is ever consulted for an order --
 * that verdict always comes from the address row.
 */
export async function readLocationPreference(): Promise<LocationPreference | null> {
  const raw = await platformStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocationPreference;
  } catch {
    // A corrupt value is treated as absent: the screen shows once more, which
    // costs the user one tap and cannot break app start.
    return null;
  }
}

export async function writeLocationPreference(pref: LocationPreference): Promise<void> {
  await platformStorage.setItem(KEY, JSON.stringify(pref));
}

export async function clearLocationPreference(): Promise<void> {
  await platformStorage.removeItem(KEY);
}
