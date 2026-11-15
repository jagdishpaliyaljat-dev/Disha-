# DISHA 20-20 — Local Development & Environment Setup

This guide provides step-by-step instructions for configuring, developing, testing, and debugging **DISHA 20-20 (दिशा 20-20)** in a local workstation or Termux Android environment.

---

## 1. System Prerequisites

| Requirement | Supported Version | Verification Command | Notes |
|:---|:---|:---|:---|
| **Node.js** | `22.x` (LTS) | `node -v` | Strictly required by `engines.node` in `package.json` |
| **pnpm** | `>= 9.0.0` | `pnpm -v` | Primary package manager (do not use npm unless required) |
| **Git** | `>= 2.30` | `git --version` | Source control management |
| **Operating System** | Linux / macOS / Termux | `uname -a` | Full Linux compatibility (POSIX shell) |

---

## 2. Termux / Android Environment Guidelines

When developing directly inside **Termux (Android)**:
1. **No Root / No Sudo:** Never execute commands with `sudo`. All files reside within `/data/user/0/com.termux/files/home`.
2. **Temporary Directory:** Standard Linux `/tmp` is non-standard or restricted. Always use `$TMPDIR` (`/data/user/0/com.termux/files/usr/tmp`).
3. **Memory Management:** Mobile kernels enforce aggressive memory limits. Always execute TypeScript compiler passes with expanded memory heaps:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```
4. **Package Management:** Install native binaries via Termux package manager (`pkg install <package>`).

---

## 3. Step-by-Step Installation

### Step 3.1: Clone Repository
```bash
git clone https://github.com/disha-prep/disha-2020.git
cd /data/user/0/com.termux/files/home/Disha-
```

### Step 3.2: Install Dependencies
Install all production and development dependencies using `pnpm`:
```bash
pnpm install
```
*(Dependencies include React 19, Vite 8, Tailwind CSS v4, Firebase 12, Vitest 5, and esbuild).*

---

## 4. Environment Variables Configuration (`.env.local`)

Create a `.env.local` file in the project root directory.

> [!CAUTION]
> Never commit `.env.local` to Git. Ensure `.env.local` is listed in `.gitignore`. Never prefix private server keys with `VITE_`.

```env
# ==============================================================================
# PUBLIC CLIENT FIREBASE CONFIGURATION (VITE_ Prefixed — Safe for Client Bundle)
# ==============================================================================
VITE_FIREBASE_API_KEY=AIzaSyA_ExamplePublicWebApiKey_Disha2020
VITE_FIREBASE_AUTH_DOMAIN=disha-2020.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=disha-2020
VITE_FIREBASE_STORAGE_BUCKET=disha-2020.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=109283746512
VITE_FIREBASE_APP_ID=1:109283746512:web:abcdef1234567890
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEF1234

# ==============================================================================
# PRIVATE SERVER SECRETS (No VITE_ Prefix — Never Exposed to Browser)
# ==============================================================================
# AES-256-GCM symmetric master key for encrypting AI keys in Firestore (32 hex bytes)
AI_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Session secret for cookie and token signing
SESSION_SECRET=c9f8a3b7e4d2a1c0f5e8b4a7d1c6e9f2a5b8c1d4e7f0a3b6c9d2e5f8a1b4c7d0

# Local server listening port
PORT=3000

# Optional: Google Service Account Credentials path for local Firebase Admin
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
```

---

## 5. Development Server Workflow

### Starting the Development Server
```bash
pnpm dev
```
- Executes `tsx server.ts`.
- Initializes Express 4 on port 3000.
- Attaches the **Vite HMR (Hot Module Replacement)** middleware.
- Connects local routing to `http://localhost:3000`.

### Local Development Mock Mode
When running without a physical Google Cloud Service Account JSON file:
- The server automatically activates **Application Default Credentials (ADC) Fallback / Local Dev Mode**.
- Client requests fall back gracefully to **IndexedDB v5** and mock drivers (`mockFirestoreDriver.ts`), allowing offline development of the entire UI, MCQ engine, and admin panels without incurring cloud costs.

---

## 6. Verification & Quality Scripts

### 6.1 Type Checking & Linting
Run strict TypeScript analysis without emitting build artifacts:
```bash
pnpm lint
```
*(Executes `NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit`. Expected result: 0 errors).*

### 6.2 Running Automated Unit & Integration Tests
Execute the Vitest test suite:
```bash
pnpm test
```
*(Executes `vitest run --fileParallelism=false`. Evaluates 10 test files and 89 test assertions).*

### 6.3 Building the Production Bundle
Compile the production client and serverless distributions:
```bash
pnpm run build
```
The build process executes three sequential phases:
1. `vite build`: Compiles React 19 app, Tailwind CSS v4, and PWA assets into `dist/`.
2. `esbuild src/server/vercelHandler.ts`: Bundles the Vercel serverless function into `api/index.js` (Node ESM).
3. `esbuild server.ts`: Bundles the standalone production server into `dist/server.cjs` (Node CJS).

### 6.4 Previewing the Production Build
Start the compiled production server locally:
```bash
pnpm start
```
App will serve production-optimized assets at `http://localhost:3000`.
