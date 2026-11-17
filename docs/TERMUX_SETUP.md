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

Pilot data lives in `pilots/import_pilot.sql` and `pilots/sample_pilot_import.json`
(1 subject, 2 chapters, 4 topics, 10 questions). Seeding requires a Supabase
**service-role** key or dashboard SQL access; the public anon key is blocked by
RLS. Integration tests tolerate an empty database but exercise the full flow
when `q_pilot_001…q_pilot_010` exist.

Preview the payload without writing:

```bash
pnpm seed:dry-run
```

Seed with the service-role key from
**Supabase Dashboard → Project Settings → API → service_role secret**:

```bash
SUPABASE_SERVICE_ROLE_KEY='eyJ...' pnpm seed:pilot
```

Alternative: paste `pilots/import_pilot.sql` into the Supabase SQL editor.

`pnpm seed:supabase` is the generic seeder and accepts
`--file <path> --dry-run`. It reads `supabase/seed_data.json` when present and
falls back to the pilot payload.

## Notes

- `scripts/` and `app/` contain archived Firebase-era tooling and are excluded
  from `tsc`; the live app is Supabase-only.
- Built assets are written to `dist/` (ignored by git).
- `.env.local` is ignored by git. Keep it out of commits.
