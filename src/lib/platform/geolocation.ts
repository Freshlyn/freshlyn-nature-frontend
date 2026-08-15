import { Geolocation } from "@capacitor/geolocation";
import { isNative } from "@/lib/platform";

export interface Coordinates {
  latitude: number;
  longitude: number;
  /**
   * Radius of 68% confidence, in metres, as reported by the platform.
   *
   * Carried through rather than discarded because a position is only useful
   * if it is precise enough to sit inside a delivery polygon. A desktop
   * browser without GPS hardware returns an IP-derived fix that can name the
   * wrong city; callers apply isUsableFix() from @/lib/serviceability before
   * trusting the coordinates.
   */
  accuracy: number;
}

/**
 * One position fix.
 *
 * Native goes through @capacitor/geolocation, which handles the Android
 * runtime permission prompt; web uses navigator.geolocation. Both reject on
 * denial or unavailability, so the caller has a single failure path.
 */
export async function getCurrentPosition(): Promise<Coordinates> {
  if (isNative()) {
    // requestPermissions() is a no-op when already granted, and shows the
    // Android system prompt otherwise. A denial rejects, which the caller
    // handles identically to a positioning failure.
    const status = await Geolocation.requestPermissions();
    if (status.location === "denied" && status.coarseLocation === "denied") {
      throw new Error("Location permission denied.");
    }
    const position = await Geolocation.getCurrentPosition();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  }

  if (!("geolocation" in navigator)) {
    throw new Error("Geolocation is not supported by your browser");
  }

  return new Promise<Coordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => reject(new Error("Could not access location. Please enter manually.")),
    );
  });
}
