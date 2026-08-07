import { Geolocation } from '@capacitor/geolocation';
import { isNative } from '@/lib/platform';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * One position fix.
 *
 * Native goes through @capacitor/geolocation, which handles the Android
 * runtime permission prompt; web uses navigator.geolocation, which is exactly
 * what LocationModal did before. Both reject on denial or unavailability, so
 * the caller has a single failure path.
 *
 * The coordinates are currently discarded by the only consumer -- turning them
 * into an address is a separate feature with its own provider and cost
 * decisions.
 */
export async function getCurrentPosition(): Promise<Coordinates> {
  if (isNative()) {
    // requestPermissions() is a no-op when already granted, and shows the
    // Android system prompt otherwise. A denial rejects, which the caller
    // handles identically to a positioning failure.
    const status = await Geolocation.requestPermissions();
    if (status.location === 'denied' && status.coarseLocation === 'denied') {
      throw new Error('Location permission denied.');
    }
    const position = await Geolocation.getCurrentPosition();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported by your browser');
  }

  return new Promise<Coordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error('Could not access location. Please enter manually.')),
    );
  });
}
