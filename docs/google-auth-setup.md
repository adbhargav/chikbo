# Google Sign-In & Password Reset — setup

Both features are built and running. Google Sign-In stays inert until it is
configured, so nothing is broken while it is unconfigured.

## 1. Google Sign-In via Firebase Authentication (preferred)

The API already holds a Firebase service account for push notifications
(`FCM_SERVICE_ACCOUNT_JSON`), and sign-in verification reuses it — so setup
is only two steps in the same Firebase project:

1. Open <https://console.firebase.google.com> → your project →
   **Authentication → Sign-in method → Google → Enable** (pick a support
   email, save). `localhost` is an authorised domain by default; add your
   production domains under **Authentication → Settings → Authorized
   domains**.
2. **Project settings → General → Web API Key** — copy it into
   `apps/api/.env` and restart the API:

```
FIREBASE_WEB_API_KEY=AIza...
```

That is all. The storefront asks `GET /auth/providers`, receives the (public)
Firebase config from the API and lights the button up — no frontend env vars
or rebuild. The browser runs Firebase's Google popup, sends the resulting ID
token to `POST /auth/firebase`, and the API verifies it with the service
account before issuing a normal Chikbo session. Account creation, linking and
privilege rules are identical to the legacy flow below, and accounts created
by either flow stay linked (both store Google's own subject id).

## 2. Legacy: Google Sign-In direct (Google Identity Services)

Used only when Firebase is not configured but `GOOGLE_CLIENT_ID` is set.

### Get a client ID (5 minutes, free)

1. Open <https://console.cloud.google.com> → create a project (e.g. "Chikbo").
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in the
   app name (Chikbo), support email and logo, then publish it. Until it is
   published only test users you list can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → application type **Web application**.
4. Add **Authorised JavaScript origins** — the sites that may show the button:
   - `http://localhost:5173` (development)
   - `https://chikbo.in` and `https://www.chikbo.in` (production)
   No redirect URIs are needed: we use the ID-token flow, not the code flow.
5. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`.

### Configure

Put it in `apps/api/.env` and restart the API:

```
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
```

That is the only setting. The **client secret is not used and must never be
put in any frontend**. The storefront asks `GET /auth/providers` and renders
Google's button only when the API says it is enabled, so no rebuild or
frontend env var is required.

### How it works (and why it is safe)

1. The browser runs Google's own sign-in UI and receives an **ID token** — a
   JWT signed by Google.
2. The browser sends only that token to `POST /auth/google`.
3. The API verifies the signature against Google's public keys and checks the
   issuer, audience (our client ID) and expiry before trusting any field, then
   issues a normal Chikbo session. Email, name and picture from the client are
   never trusted on their own — a forged token is rejected.
4. Only **Google-verified** email addresses are accepted, so an unverified
   Google account cannot be used to claim an existing Chikbo account.

**Account linking.** Signing in with Google when a password account already
exists on that email links the two — the customer keeps their orders, cart and
addresses and can then use either method.

**Privilege safety.** Google sign-in can only ever create a `CUSTOMER`. Staff
and admin accounts must be created deliberately in the admin, so no one can
obtain staff access by signing in with Google.

## 3. Forgot password

Works for password accounts and for Google accounts that want to add a
password (a Google-created account has no password until it sets one this way).

Requires SMTP so the email can be delivered — set `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `apps/api/.env`. Also set
`WEB_APP_URL` to the public storefront URL so links point at the right host:

```
WEB_APP_URL=https://chikbo.in
```

Without SMTP the API still behaves correctly — it just logs that the email was
skipped instead of sending it.

### Flow

1. `/forgot-password` → customer enters their email.
2. The API emails a link to `/reset-password?token=…`, valid **60 minutes**,
   usable **once**.
3. `/reset-password` → customer sets a new password; every existing session is
   revoked, so any attacker session dies with it.

### Security properties

- **No account enumeration** — the endpoint answers identically whether or not
  the address is registered, so nobody can harvest your customer list.
- **Tokens are stored hashed** (SHA-256). A database leak cannot be replayed
  against the reset endpoint.
- **Single use** — a token is consumed on success, and requesting a new link
  invalidates any earlier one.
- **Rate limited** — 20 attempts per 15 minutes per IP, shared with login.
- Passwords must be 8+ characters with a letter and a number, hashed with
  bcrypt (cost 12).
