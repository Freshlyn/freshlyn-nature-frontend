# Android on-device verification checklist

Gates 3–7 need a real device or emulator and must be run by hand. Gates 1–2 are
automated and already pass (see "Status" below).

Build and install first:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

npm run android:sync
cd android && ./gradlew assembleDebug && cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Keep a second terminal open — WebView JS errors surface nowhere else:

```bash
adb logcat | grep -i "Capacitor\|chromium"
```

---

## Status of the automated gates

| Gate | What | Result |
| --- | --- | --- |
| 1 | No web regression | **PASS** — 11/13 Playwright, 18/18 unit, `tsc -b` clean. The 2 failures are `checkout.spec.ts`, which fail identically on the pre-Capacitor baseline (see note below). |
| 2 | Android build | **PASS** — `BUILD SUCCESSFUL`, `app-debug.apk` produced. |

**Razorpay integration path: compiled clean.** No patch, no vendoring.
`capacitor-razorpay@1.3.0` builds against Capacitor 8 as published — the
`@NativePlugin` annotation the plan expected to fail still exists in Capacitor
8's bridge (deprecated, not removed), and `jcenter()` resolves harmlessly
because `mavenCentral()` and `google()` satisfy everything first.

**About the 2 checkout failures:** they are pre-existing and environmental, not
caused by this work. `Cart.tsx:113` defaults `paymentMethod` to `"razorpay"`, so
the spec takes the online-payment path and tries to load
`https://checkout.razorpay.com/v1/checkout.js`, which gets
`ERR_CONNECTION_REFUSED` inside Playwright's browser sandbox. The `checkout`
edge function itself returns 200 — orders are created. Verified identical with
the original pre-refactor `use-razorpay.ts`.

---

## Gate 3 — Session durability

This is the specific failure `localStorage` had and Preferences fixes.

1. Open the app, log in with OTP, reach the home screen.
2. **Settings → Apps → Freshlyn Nature → Force stop**.
3. Reopen the app.
   - [ ] Still logged in, no login screen.
4. **Settings → Apps → Freshlyn Nature → Storage → Clear cache**
   (**not** "Clear storage" — that wipes app data and is *expected* to log out).
5. Reopen the app.
   - [ ] **Still logged in.** If this fails, `src/lib/platform/storage.ts` is not
     taking its native branch.

## Gate 4 — COD order

1. Add items to the cart.
2. Go to Cart, select an address, choose **Cash on Delivery**, place the order.
   - [ ] "Order Placed!" toast appears.
   - [ ] App navigates to `/orders`.
   - [ ] The new order is listed.

## Gate 5a — Razorpay success (manual by necessity)

1. Add items, go to Cart, select an address, choose online payment.
2. Complete a **real UPI payment** through GPay or PhonePe.
   - [ ] The payment reaches `paid` in the database.
   - [ ] **The Freshlyn app returns to the foreground** after the handoff — not
         the launcher, not the UPI app.

Confirm in the database:

```sql
select id, status, payment_status, created_at
from orders order by created_at desc limit 3;
```

## Gate 5b — Razorpay cancel

The case `isRazorpayCancellation()` exists for.

1. Add items, start an online payment, then **dismiss the Razorpay sheet**
   without paying.
   - [ ] The **"Payment cancelled"** toast appears — "Your cart is saved. You can
         try again whenever you like."
   - [ ] **Not** a red destructive error toast.
   - [ ] The cart **still holds its items**.
   - [ ] The app stays on `/cart`.

A red error toast means the rejection payload was not recognised. Capture the
exact rejection from `adb logcat`, add it as a case to
`src/lib/platform/razorpay-error.test.ts`, fix the parser, re-run.

The parser is already unit-tested against the payload shape `Checkout.java`
actually rejects with (the stringified Razorpay `error` object), including a
`code: 2` cancellation and a `BAD_REQUEST_ERROR` genuine failure.

## Gate 6 — Hardware back button

The priority chain is unit-tested (`src/lib/platform/back-button.test.ts`), but
a hardware back press only exists on a device.

1. Open any dialog (e.g. the location modal from the Header) → press back.
   - [ ] The dialog closes; the app stays on the page.
2. Navigate to an order detail (`/orders/:id`) → press back.
   - [ ] Returns to `/orders`, not out of the app.
3. On `/` (a root route) → press back once, then again.
   - [ ] First press shows the "Press back again to exit" toast.
   - [ ] Second press exits the app.

## Gate 7 — Offline banner

1. Enable airplane mode with the app open.
   - [ ] The red offline banner appears at the top.
2. Disable airplane mode.
   - [ ] The banner disappears.

Verified already on web (appears/disappears on connectivity change, correct
text, `role="status"`); this confirms the `@capacitor/network` branch.

## Gate 8 — Launcher icon

1. Check the home screen / app drawer.
   - [ ] The full "Freshlyn nature" wordmark and leaf are visible.
   - [ ] Nothing is clipped by the circular/squircle mask.

The icon source was deliberately scaled to fit the adaptive-icon safe zone —
the first generated version showed only "reshlyn".

---

## Record the results

Note the device model and Android version, plus anything that needed a fix.
