# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

## Android app (Capacitor)

The Android app is the same Vite build wrapped in a Capacitor WebView. Native
capabilities live behind `src/lib/platform/`, where each module exports one
interface with a native and a web implementation, so the browser build is
unaffected.

### Prerequisites

**JDK 21 is required.** Capacitor 8's plugins declare `jvmToolchain(21)`, so a
JDK 17 build fails with:

```
Cannot find a Java installation on your machine ... matching: {languageVersion=21}
```

Android Studio bundles a suitable JDK, which is the simplest option:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

Verify with `java -version` (expect 21.x) and `ls "$ANDROID_HOME"`.

`android/local.properties` is gitignored, so each developer sets their own SDK
path.

### Build

```bash
npm run android:sync      # vite build + npx cap sync android
cd android && ./gradlew assembleDebug
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Tests

```bash
npm run test:unit         # Vitest - the pure platform adapter logic
npm run test:e2e          # Playwright - runs against the web build
```

E2E specs that log in need allowlisted phone numbers: set `E2E_TEST_PHONES`
(comma-separated) in `.env.test.local`, and add the same numbers in E.164 form
(`+91…`) to the backend's `TWOFACTOR_TEST_PHONES` secret. A number that is not
allowlisted takes the real 2Factor path, which stores no readable OTP **and
sends a real SMS**. `e2e/helpers/otp.ts` allocates one number per spec file and
throws rather than falling back to a random number.

### Notes

- `server.androidScheme` is `https`, so the WebView origin is
  `https://localhost` and Supabase calls are not blocked as mixed content.
- `android:allowBackup="false"` — the session token lives in Preferences
  (SharedPreferences), which is sandboxed but not encrypted.
- Launcher icon: adaptive icons crop to the central ~66% of the foreground
  layer, so `assets/icon.png` scales the logo to fit that safe zone. Widening it
  clips the wordmark.
