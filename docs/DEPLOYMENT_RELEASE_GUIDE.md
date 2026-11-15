# DISHA 20-20 — Production Deployment & Release Engineering

## 1. Hosting Infrastructure & Edge Topology

**DISHA 20-20 (दिशा 20-20)** is deployed to **Vercel's Global Edge Network** with backend cloud persistence managed on **Google Cloud Platform (Firebase)**.

```
                      User Request (Mobile / Desktop)
                                     |
                                     v
                       [ Vercel Global Edge CDN ]
                                     |
             +-----------------------+-----------------------+
             |                                               |
     Static Asset Request                           Dynamic API / Route Request
   (/assets/*, /index.html)                       (/api/*, /news/*, /sitemap.xml)
             |                                               |
             v                                               v
   [ Edge Cache / dist/ ]                         [ Vercel Serverless Function ]
   - Sub-50ms TTFB                                  - File: api/index.js
   - Brotli / Gzip Compressed                       - Memory: 1024 MB | Timeout: 60s
   - Cache-Control: Immutable                       - Node.js 22 Runtime
                                                             |
                                                             v
                                                  [ Google Cloud Firestore ]
                                                  - Authoritative Data Store
                                                  - 56 Collections / Security Rules
```

---

## 2. The Multi-Stage Build Pipeline

The production build pipeline (`pnpm run build`) coordinates three distinct compilation stages:

### Stage 1: Client Application Build (`vite build`)
- Compiles React 19 source code, TypeScript components, and Tailwind CSS v4 stylesheets into optimized production bundles located in `dist/`.
- Employs manual chunk splitting (`vendor-react`, `vendor-firebase`, `vendor-icons`, `vendor-motion`, `vendor-katex`, `vendor-pdf`).
- Generates PWA Service Worker assets and Workbox precache manifests via `vite-plugin-pwa`.

### Stage 2: Serverless Function Compilation (`esbuild vercelHandler`)
- Compiles `src/server/vercelHandler.ts` into a standalone Node.js ECMAScript Module (`api/index.js`).
- Uses `esbuild` with custom banners to polyfill CommonJS globals (`require`, `__filename`, `__dirname`) in native ESM environments:
  ```bash
  esbuild src/server/vercelHandler.ts \
    --bundle --platform=node --format=esm --external:vite \
    "--banner:js=import { createRequire as __cr } from 'module'; import { fileURLToPath as __futp } from 'url'; import { dirname as __dname } from 'path'; const require = __cr(import.meta.url); const __filename = __futp(import.meta.url); const __dirname = __dname(__filename);" \
    --outfile=api/index.js
  ```

### Stage 3: Standalone Server Compilation (`esbuild server.ts`)
- Bundles `server.ts` into `dist/server.cjs` (CommonJS), enabling execution in standard Node.js Docker containers or bare-metal VPS hosting if needed outside Vercel.

---

## 3. Vercel Configuration (`vercel.json`)

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "framework": null,
  "functions": {
    "api/index.js": {
      "maxDuration": 60,
      "memory": 1024,
      "includeFiles": "education-content/**"
    }
  },
  "rewrites": [
    { "source": "/api", "destination": "/api/index.js" },
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/sitemap.xml", "destination": "/api/index.js" },
    { "source": "/robots.txt", "destination": "/api/index.js" },
    { "source": "/news/(.*)", "destination": "/api/index.js" },
    { "source": "/news", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. Production Environment Variables (Vercel Project Settings)

Configure the following environment variables in the **Vercel Dashboard -> Settings -> Environment Variables**:

| Variable Name | Exposure | Description |
|:---|:---|:---|
| `VITE_FIREBASE_API_KEY` | Public (Client) | Firebase Web Client API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Public (Client) | Firebase Auth Domain (e.g. `disha-2020.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Public (Client) | Google Cloud Project ID (`disha-2020`) |
| `VITE_FIREBASE_STORAGE_BUCKET`| Public (Client) | Cloud Storage Bucket Name |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Public (Client) | Firebase Cloud Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Public (Client) | Firebase Application ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Public (Client) | Google Analytics 4 Measurement ID |
| `AI_ENCRYPTION_KEY` | Private (Server) | 32-byte hex key for encrypting AI secrets via AES-256-GCM |
| `SESSION_SECRET` | Private (Server) | Random entropy secret for session integrity |
| `FIREBASE_ADMIN_CLIENT_EMAIL`| Private (Server) | Service Account email for server-side Firebase Admin |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Private (Server) | Service Account RSA private key (with escaped `\n` characters) |

---

## 5. Deployment Procedures

### 5.1 Automated Continuous Deployment (Git Push)
Every commit pushed to the `main` branch triggers an automated Vercel build and deployment:
```bash
git checkout main
git pull origin main
git add .
git commit -m "feat(release): deploy release candidate v1.2.0"
git push origin main
```
Vercel automatically executes `pnpm install`, `pnpm run build`, and routes traffic to the newly deployed immutable container.

### 5.2 Manual Production Deployment (Vercel CLI)
If deploying directly from the command line:
```bash
# Deploy directly to production
vercel --prod
```

---

## 6. Post-Deployment Verification & Smoke Tests

Immediately following deployment, run the following health checks against the live domain:

### Check 1: Root HTML Shell Availability
```bash
curl -I https://disha-2020.vercel.app/
# Expected: HTTP/2 200 OK, content-type: text/html; charset=UTF-8
```

### Check 2: Serverless API Health Endpoint
```bash
curl https://disha-2020.vercel.app/api/health
# Expected: {"status":"ok","appName":"DISHA 20-20 (दिशा 20-20)","firebaseAdmin":"initialized"}
```

### Check 3: Static Quiz Assets Manifest
```bash
curl https://disha-2020.vercel.app/api/quiz-assets/version
# Expected: {"schemaVersion":5,"appVersion":"1.2.0",...}
```

### Check 4: Dynamic XML Sitemap
```bash
curl -I https://disha-2020.vercel.app/sitemap.xml
# Expected: HTTP/2 200 OK, content-type: application/xml
```

---

## 7. Emergency Rollback Playbook

If a critical regression or runtime defect is detected in production:
1. Open the **Vercel Dashboard -> Deployments**.
2. Locate the previous verified production deployment (e.g., deployment tagged with Phase 15 certification).
3. Click the three dots `...` next to the deployment and select **Instant Rollback**.
4. Confirm rollback.
5. Vercel routes 100% of global DNS and edge traffic back to the prior deployment in **$< 5$ seconds**, with zero downtime and no recompilation.
