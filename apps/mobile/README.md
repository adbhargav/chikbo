# Chikbo Mobile

React Native (Expo) customer app for **Chikbo** — premium Indian fashion, dealing in textiles since 1992.

This app is intentionally **excluded from the repo's npm workspaces** — it is standalone with its own `node_modules`. Run every `npm`/`npx` command from inside `apps/mobile`. The shared API types are a maintained copy in `src/types/shared.ts` (provenance: `packages/shared/src/index.ts`) because the workspace package cannot be linked from a non-workspace app.

## Stack

- Expo SDK 57 (TypeScript, strict), React Native
- React Navigation (native-stack + bottom-tabs)
- @tanstack/react-query for server state
- axios with auth + auto-refresh interceptors
- expo-secure-store (token pair), expo-notifications (push), expo-image-picker (return photos)
- react-native-webview (Razorpay hosted Checkout)
- Fraunces + Inter via @expo-google-fonts

## Install & run

```bash
cd apps/mobile
npm install
npm start           # starts the Expo dev server
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS), or press `i` / `a` for a simulator/emulator.

Verify types any time with:

```bash
npm run typecheck   # tsc --noEmit, strict
```

## Configuring the API base URL

The app talks to the Chikbo API (`apps/api`, default `http://localhost:4000/api/v1`). Resolution order (first wins):

1. `EXPO_PUBLIC_API_URL` environment variable
2. `expo.extra.apiUrl` in `app.json`
3. Fallback `http://localhost:4000/api/v1`

`localhost` only works on the **iOS simulator** (and `10.0.2.2` on the Android emulator). For a **physical device on the same LAN**, point the app at your machine's LAN IP:

```bash
# find your LAN IP, e.g. 192.168.1.42 (macOS: ipconfig getifaddr en0)
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api/v1 npm start
```

or create `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api/v1
```

Make sure the API listens on `0.0.0.0` and your firewall allows port 4000. Server-relative asset URLs (`/uploads/...`, `/images/...`) are automatically prefixed with the API origin; seed image paths that 404 render a graceful cream placeholder instead of a broken image.

## Auth & session

- Login/register store the `{accessToken, refreshToken}` pair in **SecureStore**.
- The axios response interceptor catches 401s, calls `POST /auth/refresh` (single-flight), stores the **rotated** pair, and replays the failed request. If refresh fails, the session is cleared and the app returns to the login screen.
- On boot the app shows a splash gate while it restores the session via `GET /auth/me`.

## Razorpay WebView flow

Checkout is a three-step flow (`Cart → AddressSelect → Payment`):

1. **AddressSelect** generates a client UUID `idempotencyKey` (expo-crypto) and navigates to Payment.
2. **Payment** calls `POST /checkout {addressId, couponCode?, idempotencyKey}`. The response's `razorpayOrderId`/`razorpayKeyId`/amount are injected into an HTML page that loads `https://checkout.razorpay.com/v1/checkout.js` inside a `react-native-webview` and calls `rzp.open()`.
3. The page reports back via `window.ReactNativeWebView.postMessage`:
   - `handler` (success) → `POST /payments/verify` with the `razorpay_*` payload → **OrderConfirmed** screen. A verify failure is treated as non-fatal (the server also confirms via webhook).
   - `payment.failed` / `modal.ondismiss` → `POST /payments/failed` → **PaymentFailed** retry screen. Retrying reuses the **same idempotencyKey**, so the server returns the same pending order.

Razorpay test mode: use test card `4111 1111 1111 1111`, any future expiry, any CVV.

## Push notifications

After sign-in the app asks for notification permission, fetches the Expo push token and registers it via `POST /users/me/device-tokens`. This is best-effort: simulators and Expo Go (SDK 53+ on Android) can't receive remote push, and failures never block login. Foreground notifications show an in-app banner.

## Project layout

```
src/
  api/          axios client (auth + refresh interceptors), typed endpoint functions
  auth/         AuthContext (session restore, login/register/logout), SecureStore token store
  components/   Button, PriceText, StatusPill, ProductCard, ProductImage (cream fallback),
                Skeleton, QtyStepper, Chip, TextField, EmptyState, ErrorState, ...
  hooks/        react-query hooks + query keys
  navigation/   RootNavigator (auth gate), MainTabs, typed param lists
  notifications/ push registration + foreground handler
  screens/      auth, home, catalog, cart, checkout, orders, wishlist, profile
  theme.ts      Chikbo "Heritage Modern" design tokens
  types/        shared.ts — copy of @chikbo/shared DTOs (keep in sync)
```
