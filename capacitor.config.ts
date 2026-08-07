import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.freshlyn.nature',
  appName: 'Freshlyn Nature',
  webDir: 'dist',
  server: {
    // Required. With this the WebView origin is https://localhost, so calls to
    // Supabase (https) are same-scheme and not blocked as insecure mixed
    // content. Dropping to the default http scheme silently breaks every
    // network call in the app.
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      // The splash is dismissed explicitly on first render (see
      // src/lib/platform/system-ui.ts), not on a timer -- a timer either
      // flashes a white gap on a slow cold start or stalls a fast one.
      launchAutoHide: false,
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
