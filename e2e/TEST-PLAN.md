# E2E Test Plan — Feature Coverage Checklist

A living checklist of every user-facing feature in the app and the Playwright
scenarios that should cover it. Use it to see what's already tested, what's
missing, and where each new spec should live.

**Status legend**

- ✅ Covered — a Playwright test asserts this today
- 🟡 Partial — touched incidentally by another test, no dedicated assertion
- ⬜ Missing — no coverage yet

Existing specs: `smoke.spec.ts`, `auth.spec.ts`, `checkout.spec.ts`,
`route-guards.spec.ts`. Specs that
hit real Supabase (`auth`, `checkout`, and anything below marked _needs
service-role_) are skipped when `SUPABASE_SERVICE_ROLE_KEY` is absent — see
[README.md](./README.md).

---

## 1. Authentication & Onboarding

Source: [Auth.tsx](../src/pages/Auth.tsx), [Register.tsx](../src/pages/Register.tsx), [use-auth.tsx](../src/hooks/use-auth.tsx)
Suggested spec: `auth.spec.ts` (exists — extend)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 1.1 | Login page renders phone form | ✅ | smoke |
| 1.2 | Phone input strips non-digits and caps at 10 | ⬜ | `input-phone`; type letters/15 digits |
| 1.3 | Continue disabled below 10 digits | ✅ | smoke |
| 1.4 | Send OTP → OTP screen appears | ✅ | auth (needs service-role) |
| 1.5 | New user verifies OTP → lands on `/register` | ✅ | auth |
| 1.6 | Existing user verifies OTP → lands on `/` with "Welcome back" | ⬜ | needs a pre-seeded returning user |
| 1.7 | Wrong OTP → error toast, stays on OTP screen | ✅ | auth |
| 1.8 | "Change number" resets to phone step, clears OTP | ⬜ | `button-back-phone` |
| 1.9 | "Resend" re-sends OTP | ⬜ | `button-resend-otp` |
| 1.10 | OTP input caps at 6 digits; Verify disabled until 6 | ⬜ | `input-otp` |
| 1.11 | Register requires name; empty name → error toast | ⬜ | `button-register` with blank `input-name` |
| 1.12 | Register with name only (email optional) → `/` | ✅ | auth/checkout complete this step |
| 1.13 | Register with name + email persists email (shown on Profile) | ⬜ | `input-email` → assert `text-user-email` |
| 1.14 | `/register` redirects to `/login` when signed out | ⬜ | Register useEffect guard |
| 1.15 | `/register` redirects to `/` when profile already complete | ⬜ | guard for returning user |
| 1.17 | Session without a profile row → redirected to `/register`, not stranded on Home | ✅ | route-guards (mobile viewport); regression for the "Login button + no bottom nav on Home" bug |
| 1.16 | Session persists across reload (stays signed in) | ⬜ | reload, assert not bounced to `/login` |

## 2. Routing, Guards & Navigation

Source: [App.tsx](../src/App.tsx), [ProtectedRoute.tsx](../src/components/ProtectedRoute.tsx), [PublicOnlyRoute.tsx](../src/components/PublicOnlyRoute.tsx), [BottomNav.tsx](../src/components/BottomNav.tsx), [DesktopSidebar.tsx](../src/components/DesktopSidebar.tsx)
Suggested spec: `smoke.spec.ts` (exists — extend) + `navigation.spec.ts` (new, authed)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 2.1 | Protected `/` redirects to `/login` when signed out | ✅ | smoke |
| 2.2 | Protected `/orders` redirects to `/login` when signed out | ✅ | smoke |
| 2.3 | Protected `/cart`, `/profile`, `/terms`, `/privacy` redirect when signed out | ⬜ | one per route |
| 2.4 | `/login` (PublicOnly) redirects to `/` when already signed in | ⬜ | authed visit to `/login` |
| 2.5 | Unknown route renders 404 | ✅ | smoke |
| 2.6 | Bottom nav visible on `/`, `/orders`, `/profile` (mobile) only | ⬜ | `bottom-nav`, `nav-*` |
| 2.7 | Bottom nav links navigate to each tab | ⬜ | `nav-home`, `nav-orders`, `nav-profile` |
| 2.8 | Desktop sidebar toggles via hamburger | ⬜ | `button-hamburger`; layout margin shifts; `desktop-sidebar` + `sidebar-*` links |
| 2.9 | Header back button returns to expected page, stays visible when scrolled | ⬜ | `button-header-back` on Cart/Orders/OrderDetail/Profile/Terms/Privacy; absent on `/`; covered by `back-button.spec.ts` |
| 2.9a | Register header clears the status bar on a notched device | ⬜ | `button-back` on `/register`; Capacitor build — verify `pt-safe-t`, not reproducible in a browser |
| 2.10 | Header cart button navigates to `/cart` | ⬜ | `button-cart` |
| 2.11 | Header "Login" button shows for signed-out users | ⬜ | `button-login` (absent when authed) |
| 2.12 | Header location button (desktop) | 🟡 | `button-location` — opens `LocationModal` (currently static "Set Location") |

## 3. Product Catalog (Home)

Source: [Home.tsx](../src/pages/Home.tsx), [ProductCard.tsx](../src/components/ProductCard.tsx), [Header.tsx](../src/components/Header.tsx), [use-products.ts](../src/hooks/use-products.ts)
Suggested spec: `catalog.spec.ts` (new, authed)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 3.1 | Product grid renders after load | 🟡 | checkout waits on `product-grid` |
| 3.2 | Loading skeletons show while fetching | ⬜ | `hero-skeleton`, `categories-skeleton`, `product-grid-skeleton` |
| 3.3 | Category filter narrows products | ⬜ | `category-dairy` etc. |
| 3.4 | Search filters products (debounced 300ms) | ⬜ | `input-search` / `input-search-mobile` |
| 3.5 | No-match search shows empty state | ⬜ | `text-no-products` |
| 3.6 | "Clear all filters" resets category + search | ⬜ | `button-clear-filters` |
| 3.7 | Product card shows starting price + subscription badge | ⬜ | via `product-card-<id>`; `Subscribe` badge when `hasSubscription` |
| 3.8 | Card quantity badge reflects items already in cart | ⬜ | badge on card + `button-add-<id>` label flips "Add" → "Update" |
| 3.9 | Clicking a card opens the product detail modal | ✅ | checkout (implicitly) |
| 3.10 | Card "Add"/"Update" button opens the modal (not a quick-add) | ⬜ | `button-add-<id>`; `stopPropagation`, same `onAdd` as the card |

## 4. Product Detail Modal (add to cart / subscribe)

Source: [ProductDetailModal.tsx](../src/components/ProductDetailModal.tsx)
Suggested spec: `product-modal.spec.ts` (new, authed)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 4.1 | Variant selection updates price | ⬜ | `variant-<id>` |
| 4.2 | One-time: add to cart → cart count increments | ✅ | checkout |
| 4.3 | Delivery-type toggle switches one-time ↔ subscription | ⬜ | shown only when `hasSubscription` |
| 4.4 | Subscription: pick duration + frequency + start date | ✅ | checkout (`duration-15`, `frequency-daily`) |
| 4.5 | Duration discount badge reflects selected plan | ⬜ | `-X%` on `duration-<days>` |
| 4.6 | Start-date calendar: prev/next month, pick a day | ⬜ | `button-prev-month`, `calendar-day-<date>` |
| 4.7 | Subscribe → modal closes, item added | ✅ | checkout |
| 4.8 | One-time stepper (+/–) adjusts quantity in modal | ⬜ | `stepper-one-time` |
| 4.9 | Editing an existing subscription pre-fills plan | ⬜ | opened from Cart "Edit plan" |
| 4.10 | Unsubscribe flow (confirm/cancel) | ⬜ | `button-unsubscribe`, `button-confirm-unsubscribe`, `button-cancel-unsubscribe` |
| 4.11 | `hideDeliveryToggle` hides toggle when editing from cart | ⬜ | Cart edit modal |
| 4.12 | Explicit close button dismisses the modal | ⬜ | `button-close-modal` — sits behind the Radix overlay; checkout works around it with `Escape` (see checkout.spec.ts) |

## 5. Cart

Source: [Cart.tsx](../src/pages/Cart.tsx), [use-static-cart.ts](../src/hooks/use-static-cart.ts)
Suggested spec: `cart.spec.ts` (new, authed)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 5.1 | Empty cart shows empty state + "Start Shopping" | ⬜ | `text-empty-cart`, `button-start-shopping` |
| 5.2 | One-time item: increase/decrease quantity | ⬜ | `button-increase-*`, `button-decrease-*`, `text-quantity-*` |
| 5.3 | Decrease at qty 1 removes the item | ⬜ | trash icon at min qty |
| 5.4 | Remove item via trash button | ⬜ | `button-remove-*` |
| 5.5 | Clear cart empties it | ⬜ | `button-clear-cart` |
| 5.6 | Subtotal / delivery fee / grand total compute correctly | 🟡 | checkout asserts non-zero total only |
| 5.7 | Free delivery over ₹299; ₹30 fee under; progress bar | ⬜ | `text-delivery-fee`, "add ₹X more" |
| 5.8 | Subscription item shows badges + "Edit plan" | 🟡 | checkout asserts "Subscription" text |
| 5.9 | Delivery-time slot picker appears with subscription items | ⬜ | `button-time-*` |
| 5.10 | Cart persists across reload (localStorage) | ⬜ | reload, items remain |
| 5.11 | Header cart-count animation reflects adds | ✅ | checkout (`text-cart-count`) |

## 6. Checkout

Source: [Cart.tsx](../src/pages/Cart.tsx) `handleCheckout`, [use-checkout.ts](../src/hooks/use-checkout.ts)
Suggested spec: `checkout.spec.ts` (exists — extend)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 6.1 | One-time order → `/orders` | ✅ | checkout (needs service-role) |
| 6.2 | Subscription order → `/orders` | ✅ | checkout |
| 6.3 | Checkout while signed out → login toast + redirect | ⬜ | reachable if cart flow allows |
| 6.4 | Checkout with no address → prompts address modal | ⬜ | `button-checkout` w/o seeded address |
| 6.5 | Selected address shown before checkout | ✅ | checkout (`text-selected-address`) |
| 6.6 | Cart clears after a successful order | ⬜ | assert empty cart post-order |
| 6.7 | Checkout button shows processing state / disabled | ⬜ | `button-checkout` spinner |
| 6.8 | Backend error surfaces an error toast | ⬜ | force failure |

## 7. Orders (list, filters, tracking)

Source: [Orders.tsx](../src/pages/Orders.tsx), [OrderFilters.tsx](../src/components/orders/OrderFilters.tsx), [OrderCard.tsx](../src/components/orders/OrderCard.tsx), [order-filters.ts](../src/lib/order-filters.ts), [use-orders.ts](../src/hooks/use-orders.ts)
Suggested spec: `orders.spec.ts` (new, authed + seeded orders)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 7.1 | Empty state when no orders | ⬜ | `text-no-orders` |
| 7.2 | Placed order appears in the list | 🟡 | checkout lands on `/orders`, no card assertion |
| 7.3 | Type segment filter (All / Subscription / One-Time) | ⬜ | `order-filter-segment-*` |
| 7.4 | Status filter (Active / Delivered / Cancelled) | ⬜ | sheet `order-filter-sheet-pill-*` |
| 7.5 | Date-range presets (7d / 30d / 3m) | ⬜ | filter sheet |
| 7.6 | Custom date range | ⬜ | `order-filter-date-from/-to` |
| 7.7 | Apply enabled only when filters dirty | ⬜ | `order-filter-sheet-apply` |
| 7.8 | Clear filters resets to defaults | ⬜ | `order-filter-sheet-clear` / `button-clear-order-filters` |
| 7.9 | "No orders match filters" empty state | ⬜ | `text-no-filtered-orders` |
| 7.10 | Order card status badge + tracker | ⬜ | per-status rendering |
| 7.11 | Clicking a card opens `/orders/:id` | ⬜ | navigation |

## 8. Order Detail

Source: [OrderDetail.tsx](../src/pages/OrderDetail.tsx)
Suggested spec: `order-detail.spec.ts` (new, authed + seeded order)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 8.1 | Unknown / other-user order → "Order not found" | ⬜ | `button-back-orders` |
| 8.2 | Order id, date, status badge render | ⬜ | `text-order-detail-id` |
| 8.3 | Delivery address renders | ⬜ | `text-delivery-address` |
| 8.4 | One-time items section + line totals | ⬜ | `card-onetime-items`, `text-item-price-*` |
| 8.5 | Subscription items section + discounted total | ⬜ | `card-subscription-items` |
| 8.6 | Delivery schedule timeline (past/today/upcoming) | ⬜ | `delivery-date-*`, `badge-today-*` |
| 8.7 | "View full schedule" expand/collapse | ⬜ | `button-toggle-schedule` |
| 8.8 | Order summary subtotal / fee / total | ⬜ | `text-order-detail-total` |

## 9. Profile

Source: [Profile.tsx](../src/pages/Profile.tsx)
Suggested spec: `profile.spec.ts` (new, authed)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 9.1 | Header shows name, initials, phone, member-since | ⬜ | `text-user-name`, `text-user-initials`, `text-user-phone` |
| 9.2 | Email shown when set | ⬜ | `text-user-email` |
| 9.3 | Menu items navigate (Orders / Terms / Privacy) | ⬜ | `menu-my-orders`, `menu-terms`, `menu-privacy` |
| 9.4 | Info dialogs (Notifications / Contact / Rate / About) | ⬜ | `text-info-content` |
| 9.5 | Saved-addresses dialog opens | ⬜ | `menu-saved-addresses` |
| 9.6 | Logout confirm dialog: cancel keeps session | ⬜ | `button-logout`, `button-logout-cancel` |
| 9.7 | Logout confirm: confirm signs out → `/` then guarded | ⬜ | `button-logout-confirm` |

## 10. Address Management

Source: [Profile.tsx](../src/pages/Profile.tsx) address dialog, [AddressModal.tsx](../src/components/AddressModal.tsx), [use-addresses.ts](../src/hooks/use-addresses.ts)
Suggested spec: `addresses.spec.ts` (new, authed)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 10.1 | Empty state when no addresses | ⬜ | address dialog |
| 10.2 | Add address: required-field validation gates Save | ⬜ | `button-save-address` disabled |
| 10.3 | Add address: label (Home/Work/Other) selectable | ⬜ | `button-label-*` |
| 10.4 | Pincode strips non-digits, caps at 6 | ⬜ | `input-profile-new-pincode` |
| 10.5 | First address auto-set as default | ⬜ | `is_default` |
| 10.6 | Set a different address as default | ⬜ | `button-set-default-*` |
| 10.7 | Delete address (only when >1 exists) | ⬜ | `button-delete-address-*` |
| 10.8 | Select address in cart's AddressModal | ⬜ | `button-change-address` on Cart |

## 11. Data Privacy & Account Deletion

Source: [DataPrivacy.tsx](../src/pages/DataPrivacy.tsx), [use-account-deletion.ts](../src/hooks/use-account-deletion.ts)
Suggested spec: `account-deletion.spec.ts` (new, authed — destructive, use throwaway user)

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 11.1 | Privacy policy content renders | ⬜ | `text-privacy-title`, `text-privacy-intro`, `section-privacy-*`, `text-privacy-closing` |
| 11.1a | "Delete my account and data" link opens the confirm dialog | ⬜ | `link-delete-account` → `input-delete-confirm` visible |
| 11.2 | Delete dialog requires typing "DELETE" to enable | ⬜ | `input-delete-confirm`, `button-confirm-delete` disabled until exact match |
| 11.3 | Cancel closes dialog, keeps account | ⬜ | `button-cancel-delete` |
| 11.4 | Confirm deletes account → redirect to `/login` | ⬜ | verify user gone in DB |
| 11.5 | Deletion error surfaces a toast | ⬜ | force failure |

## 12. Static Content

Source: [TermsAndConditions.tsx](../src/pages/TermsAndConditions.tsx), [not-found.tsx](../src/pages/not-found.tsx)
Suggested spec: fold into `smoke.spec.ts` / `navigation.spec.ts`

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 12.1 | Terms & Conditions page renders | ⬜ | authed route; `text-terms-title`, `text-terms-intro`, `section-terms-*`, `section-terms-contact`, `text-terms-closing` |
| 12.2 | 404 page renders on unknown route | ✅ | smoke |

## 13. Cross-cutting

Suggested spec: assert inline within the relevant specs above

| # | Feature / scenario | Status | Notes |
|---|---|---|---|
| 13.1 | Toasts appear and auto-dismiss (~3s) | 🟡 | auth uses this pattern |
| 13.2 | Responsive: mobile bottom-nav vs desktop sidebar | ⬜ | viewport-dependent UI |
| 13.3 | Error boundaries / getErrorMessage surfacing | ⬜ | network-failure paths |
| 13.4 | Offline / "no internet" behaviour on every page | ⬜ | planned in detail in [OFFLINE-TEST-PLAN.md](./OFFLINE-TEST-PLAN.md) — banner works; per-page degradation largely unimplemented (incl. a confirmed silent-failure bug on login) |

---

## Priority order for filling gaps

1. **`cart.spec.ts`** (§5) — pure client state, no service-role needed; high value.
2. **`catalog.spec.ts`** (§3) — search/category/empty-state; no service-role.
3. **`product-modal.spec.ts`** (§4) — variant/subscription controls; no service-role.
4. **`navigation.spec.ts`** (§2) — guards + nav; a few need an authed session.
5. **`orders.spec.ts` / `order-detail.spec.ts`** (§7–8) — need seeded orders (service-role).
6. **`profile.spec.ts` / `addresses.spec.ts` / `account-deletion.spec.ts`** (§9–11) — authed + seeded (service-role).

Client-only specs (§3–5 partially) can run without `SUPABASE_SERVICE_ROLE_KEY`
by stubbing the products query or asserting only against local cart state —
prefer these first so the suite stays useful in secret-less CI.
