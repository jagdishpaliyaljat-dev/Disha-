# DISHA 20-20 — Termux / Android Setup

This project is a React 19 + Vite 8 + TypeScript PWA. It also runs on Android
inside Termux (no root required).

## 1. Install dependencies

```bash
pkg install nodejs-lts git
cd ~/projects/Disha-
pnpm install
```

> `typescript` is pinned to `5.9.3` because TypeScript 7 currently ships a
> native binary that has no Android/arm64 build. Do not upgrade it on Termux.

## 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

Only the public publishable/anon key belongs in the client. Never put
`SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable.

## 3. Run

```bash
pnpm dev --host 127.0.0.1 --port 5173
```

Open <http://127.0.0.1:5173> in the phone browser.

Production build:

```bash
pnpm build
pnpm preview --host 127.0.0.1 --port 4173
```

## 4. Quality checks

```bash
pnpm lint     # tsc --noEmit, zero errors expected
pnpm test     # Vitest (integration tests need live Supabase access)
```

## 5. Useful Supabase checks

```bash
curl "$VITE_SUPABASE_URL/rest/v1/subjects?select=id&limit=1" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

If this returns `200` with a JSON array, the client/database connection works.

## 6. Seed / restore pilot data

Pilot data lives in `pilots/import_pilot.sql` and `pilots/sample_pilot_import.json`.
Seeding requires a Supabase **service-role** key or dashboard SQL access; it
cannot be done with the public anon key. Several integration tests expect the
`q_pilot_001…q_pilot_010` rows to exist.

## Notes

- `scripts/` and `app/` contain archived Firebase-era tooling and are excluded
  from `tsc`; the live app is Supabase-only.
- Built assets are written to `dist/` (ignored by git).
- `.env.local` is ignored by git. Keep it out of commits.
