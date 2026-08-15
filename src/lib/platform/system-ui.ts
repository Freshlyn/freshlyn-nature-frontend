import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNative } from "@/lib/platform";

/**
 * hsl(88 50% 53%) -- the --primary token from src/index.css:34, converted to
 * hex because the native status bar API takes no CSS colour functions.
 *
 * Keep in sync with that token by hand; there is no build-time link between
 * them. (The design doc quoted #8FCC44 for this token, which is a slightly
 * different colour -- the value here is the actual conversion, so the status
 * bar matches the header rather than being visibly off by a shade.)
 */
const PRIMARY_HEX = "#8BC34B";

/**
 * Bring the native chrome in line with the app.
 *
 * Called on first render rather than on a timer: hiding the splash on a timer
 * either flashes a white gap on a slow cold start or stalls a fast one.
 * Idempotent and a no-op on web.
 */
export async function initSystemUi(): Promise<void> {
  if (!isNative()) return;

  try {
    await StatusBar.setBackgroundColor({ color: PRIMARY_HEX });
    // Dark content on the light green bar.
    await StatusBar.setStyle({ style: Style.Light });
    // Header padding (Task 6) assumes content sits below the bar, not under it.
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // Status-bar styling is cosmetic. A failure here must never stop the
    // splash from being hidden below, which would leave a stuck splash.
  }

  await SplashScreen.hide();
}
