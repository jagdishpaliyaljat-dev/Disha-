# Cashfree Domain / App Whitelisting Setup

## The error this prevents

```
https://localhost/ is not enabled or approved. Please whitelist your domain
or app package from merchant.cashfree.com > developers.
```

Cashfree validates the `return_url` / request origin for every order against
the domains and app packages registered on your merchant account. `localhost`,
`127.0.0.1`, `capacitor://localhost` and `file://` **cannot be whitelisted** for
an approved production merchant, so they must never reach Cashfree.

The app now resolves all payment URLs from configuration:

| Setting | Where | Used for |
|---|---|---|
| `VITE_APP_URL` / `NEXT_PUBLIC_APP_URL` | Vercel project env (browser bundle) | Return URL + Android checkout bridge |
| `APP_URL` | Supabase Edge Function secrets | Server-side return-URL allowlist + CORS |
| `ALLOWED_RETURN_ORIGINS` | Supabase Edge Function secrets | Extra approved origins (comma-separated) |
| `VITE_CASHFREE_ENV` / `CASHFREE_ENV` | Vercel / Supabase | `PRODUCTION` (default) or `SANDBOX` |

Default fallback (used only if nothing is configured):
`https://disha-2020.vercel.app`.

---

## 1. Whitelist the domain in the Cashfree Merchant Dashboard

1. Log in to <https://merchant.cashfree.com>.
2. Go to **Developers → Whitelist URLs** (sometimes under *Settings → Developers*).
3. Add every origin that can legitimately start or receive a payment:
   - `https://disha-2020.vercel.app`
   - `https://disha2020.in` (if/when the custom domain DNS is active)
   - Any staging preview domain you actually pay on, e.g.
     `https://disha-2020-git-main-*.vercel.app`
4. Add the return URLs if the dashboard asks for full URLs rather than origins:
   - `https://disha-2020.vercel.app/`
   - `https://disha2020.in/`
5. Save and wait for Cashfree confirmation (can take a few minutes).

> Do **not** add `http://localhost:*` or `capacitor://localhost` — Cashfree
> rejects them. For local development, use a public HTTPS tunnel URL and add
> that tunnel domain via `VITE_APP_URL`.

## 2. Android app package (native flow)

The Android app does not post a localhost URL. It opens the hosted checkout
bridge on the public domain inside Chrome Custom Tabs:

```
https://disha-2020.vercel.app/checkout.html?session_id=...&order_id=...&mode=production
```

- The **bridge domain must be the same whitelisted domain** (`VITE_APP_URL`).
- `capacitor.config.ts` `allowNavigation` must include that domain and
  `*.cashfree.com` so the WebView/Custom Tab can navigate to the gateway.
- If you switch to the Cashfree Android SDK directly, also register the app
  package `com.rajexam.prep` under **Developers → App/SDK settings** in
  the same dashboard.

## 3. Configure environment variables

### Vercel (web app)
Project → **Settings → Environment Variables**. Add for Production (and
Preview if needed):

```
VITE_APP_URL=https://disha-2020.vercel.app
VITE_CASHFREE_ENV=PRODUCTION
```

`NEXT_PUBLIC_APP_URL` is also accepted — `vite.config.ts` exposes both
`VITE_` and `NEXT_PUBLIC_` prefixes to the browser.

Redeploy after changing these; Vite bakes them into the bundle at build time.

### Supabase (Edge Functions)
Dashboard → **Project Settings → Edge Functions → Secrets**:

```
APP_URL=https://disha-2020.vercel.app
CASHFREE_ENV=PRODUCTION
CASHFREE_APP_ID=<your app id>
CASHFREE_SECRET_KEY=<your secret key>
ALLOWED_RETURN_ORIGINS=https://disha-2020.vercel.app,https://disha2020.in
```

`CASHFREE_SECRET_KEY` is server-side only. Never place it in a `VITE_` /
`NEXT_PUBLIC_` variable or in localStorage.

Redeploy these functions after secret changes:
`create-cashfree-order`, `verify-cashfree-order`, `cashfree-webhook`,
`admin-manage-orders`.

## 4. Verify after setup

- Create an order from the live app and confirm the browser never shows a
  `localhost` URL in the Cashfree checkout request.
- Confirm the `return_url` on the created Cashfree order is
  `https://<your-domain>/?order_id=...` (no `localhost`, no `capacitor://`).
- Complete a small real payment only after the above checks pass (requires
  explicit approval — no test order is created during development).

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| `https://localhost/ is not enabled or approved` | `VITE_APP_URL` is unset/local; set it to a whitelisted HTTPS domain and redeploy |
| Cashfree opens but return goes to blank page | Bridge domain not in `allowNavigation` in `capacitor.config.ts`, or return URL not whitelisted |
| CORS error calling Edge Function | Add the calling origin to `ALLOWED_RETURN_ORIGINS` and redeploy the function |
| Sandbox works, production fails | `CASHFREE_ENV` / credentials mismatch; ensure production app id + secret are used together |
