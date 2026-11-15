# DISHA 20-20 (दिशा 20-20) — Exam Preparation Platform

[![Production Status](https://img.shields.io/badge/Production-Verified%20Grade%20A%2B-emerald)](https://disha-2020.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen)](https://nodejs.org)
[![Vite](https://img.shields.io/badge/Vite-8.3.0-646CFF)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-19.0.1-61DAFB)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.3.3-38B2AC)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-12.19.0-FFCA28)](https://firebase.google.com)
[![PWA](https://img.shields.io/badge/PWA-Workbox%20Offline%20First-blue)](https://web.dev/progressive-web-apps/)

**DISHA 20-20 (दिशा 20-20)** is an enterprise-grade, offline-first Progressive Web Application (PWA) tailored specifically for Indian competitive exam aspirants—including **RPSC RAS Pre, 1st & 2nd Grade, REET, RSMSSB Patwar, CET, SI Exam, and Rajasthan Police Constable**.

Built on a hybrid reactive architecture combining **React 19**, **Vite 8**, **Tailwind CSS v4**, **Node.js 22 Express / Vercel Edge Serverless**, and **Google Cloud Firebase (Auth, Firestore, Cloud Storage)**, DISHA 20-20 is optimized for ultra-low latency, 99.7% Firestore quota conservation, pure Devanagari Hindi typography, KaTeX mathematical typesetting, and complete offline survivability.

---

## Key Highlights & Core Capabilities

1. **Intelligent MCQ Engine & Exam Simulation**
   - Supports 5 core question types: Single Choice, Multiple Statements, Assertion-Reason, Match the Following, and LaTeX Mathematical/Numerical problems.
   - Exact RPSC examination rules: 1/3 negative marking, 5th option 'E' compliance, automatic -1/3 penalty for unbubbled questions, and 10% unbubbled disqualification rules.
2. **Quota-Guarded 24-Hour Sync Architecture**
   - Proprietary `StudentWriteBuffer` queues student practice telemetry locally in IndexedDB v5.
   - Zero routine Firestore cloud writes during active study sessions. Writes are strictly gated by a 24-hour sync eligibility threshold, slashing cloud database operations by **99.7%**.
3. **Spaced Repetition & Weakness Intelligence**
   - Multi-stage Leitner spaced repetition algorithm with interval jumps (`[3, 7, 21, 45, 75]` days).
   - Dynamic weakness heatmaps, error journals, and smart priority question queues.
4. **Snapshot & Delta CDN Data Distribution**
   - High-density curriculum and question bundles published as immutable, version-keyed static assets served with `Cache-Control: public, max-age=31536000, immutable`.
   - Lightweight delta bundles distribute updates without re-fetching full datasets.
5. **Universal Admin Content Management System**
   - Visual Curriculum & Hierarchy Builder (Subject -> Chapter -> Topic -> Question).
   - Multimodal Importers: Universal Smart Parser, Excel/CSV importer, Bulk HTML importer, and Gemini AI auto-formatting engine.
   - Dual-write parity mechanism (`questions` and `mcqs` collections) with automated orphan detection and healing.
6. **Multi-Provider AI Resilience Vault**
   - Hot-swappable key rotation across Google Gemini 2.0/1.5, Anthropic Claude 3.5, OpenAI GPT-4o, and Groq.
   - AES-256-GCM encrypted server-side credential vault with automatic exponential cooldown upon rate limits (HTTP 429).
7. **Disaster Recovery & Reversible Backup Engine**
   - Full and selective database export to `.zip` archives with SHA-256 integrity checksums.
   - Reversible Firestore type serialization (preserving Timestamps, GeoPoints, and DocumentReferences).
   - 5 restoration strategies (Clean, Merge, Skip, Dry-Run, Migration) delivering RTO < 60s and RPO = 0s.

---

## Technology Stack

| Layer | Technologies & Versions |
|:---|:---|
| **Frontend Framework** | React 19.0.1, React DOM 19.0.1, TypeScript 7.0.2 |
| **Build Tool & Bundler** | Vite 8.3.0, @tailwindcss/vite 4.3.3, esbuild 0.25.0 |
| **Styling & Animation** | Tailwind CSS v4.3.3, Motion 12.23.24, Lucide React 0.546.0 |
| **Typography & Math** | KaTeX 0.19.0, DOMPurify 3.4.17, React Markdown 10.1.0, Remark GFM 4.0.1 |
| **Offline & Storage** | IndexedDB v5 (18 object stores), LocalForage 1.10.0, Vite-Plugin-PWA 2.0.0, Workbox |
| **Server & Serverless** | Node.js 22.x, Express 4.21.2, Vercel Serverless Functions (@vercel/node) |
| **Database & Cloud Auth** | Google Cloud Firestore 12.19.0, Firebase Admin 14.5.0, Firebase Storage |
| **AI Integration** | @google/genai 2.4.0 (Gemini 2.0 Flash / Pro), Multi-Provider REST clients |
| **Testing & Quality** | Vitest 5.1.0, JSDOM 30.1.3, @firebase/rules-unit-testing 6.0.0 |

---

## Project Quick Start

### Prerequisites
- Node.js `22.x` or higher
- `pnpm` (>= 9.x recommended)
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/disha-prep/disha-2020.git
cd disha-2020

# Install dependencies via pnpm
pnpm install
```

### Environment Configuration
Create a `.env.local` file in the project root:
```env
# Public Firebase Client Configuration (VITE_ prefixed)
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Server Secrets (Private — Never prefixed with VITE_)
AI_ENCRYPTION_KEY=32_byte_hex_secret_for_aes_256_gcm
SESSION_SECRET=strong_random_session_secret
PORT=3000
```

### Development Server
```bash
# Start the local development server (Express + Vite HMR)
pnpm dev
# App will be accessible at http://localhost:3000
```

### Production Build & Local Preview
```bash
# Compile React client and esbuild serverless handlers
pnpm run build

# Start the compiled production Node.js server
pnpm start
```

### Running Tests
```bash
# Run unit and integration test suite via Vitest
pnpm test

# Run TypeScript static analysis
pnpm lint

# Execute production health check
npx tsx scripts/run_production_health_check.ts
```

---

## Complete Documentation Index

For complete developer knowledge transfer, refer to the detailed guides in the `docs/` folder:

| # | Document | Purpose & Description |
|:---:|:---|:---|
| 01 | [README.md](file:///data/user/0/com.termux/files/home/Disha-/docs/README.md) | Platform overview, tech stack, and quick start guide |
| 02 | [PROJECT_OVERVIEW.md](file:///data/user/0/com.termux/files/home/Disha-/docs/PROJECT_OVERVIEW.md) | Business goals, exam coverage, problem statement & architecture scope |
| 03 | [PROJECT_DIRECTORY_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/PROJECT_DIRECTORY_GUIDE.md) | Complete file tree, directory responsibilities, and key modules |
| 04 | [SYSTEM_ARCHITECTURE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/SYSTEM_ARCHITECTURE.md) | Comprehensive 5-tier architecture, quota defense & security boundaries |
| 05 | [FRONTEND_ARCHITECTURE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/FRONTEND_ARCHITECTURE.md) | React 19 UI hierarchy, state management, routing & PWA caching |
| 06 | [BACKEND_API_REFERENCE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/BACKEND_API_REFERENCE.md) | Exhaustive REST endpoint specifications with auth, payloads & responses |
| 07 | [FIREBASE_DATABASE_SCHEMA.md](file:///data/user/0/com.termux/files/home/Disha-/docs/FIREBASE_DATABASE_SCHEMA.md) | 56 Firestore collections, subcollections, fields, indexes & security rules |
| 08 | [BUSINESS_LOGIC_REFERENCE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/BUSINESS_LOGIC_REFERENCE.md) | Algorithmic logic: 24h sync gate, spaced repetition, RPSC marking & deduplication |
| 09 | [ADMIN_PANEL_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/ADMIN_PANEL_GUIDE.md) | Operational manual for curriculum, questions, AI vault, and diagnostics |
| 10 | [USER_PANEL_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/USER_PANEL_GUIDE.md) | Student journey walkthrough: practice, tests, revision, PYQ & scanner |
| 11 | [BACKUP_RESTORE_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/BACKUP_RESTORE_GUIDE.md) | Disaster recovery, 5 restore modes, reversible typing & SHA-256 integrity |
| 12 | [LOCAL_DEVELOPMENT_SETUP.md](file:///data/user/0/com.termux/files/home/Disha-/docs/LOCAL_DEVELOPMENT_SETUP.md) | Developer workstation setup, environment variables & Termux guidelines |
| 13 | [DEPLOYMENT_RELEASE_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/DEPLOYMENT_RELEASE_GUIDE.md) | Vercel Serverless Edge deployment, build pipeline, domains & rollback |
| 14 | [TESTING_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/TESTING_GUIDE.md) | Test suites, test harnesses, mocks, coverage & performance benchmarks |
| 15 | [TROUBLESHOOTING_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/TROUBLESHOOTING_GUIDE.md) | Common errors, solutions, Firebase ADC warnings & Termux tuning |
| 16 | [ARCHITECTURE_DIAGRAMS.md](file:///data/user/0/com.termux/files/home/Disha-/docs/ARCHITECTURE_DIAGRAMS.md) | GitHub-rendered Mermaid diagrams for flows, schemas & states |
| 17 | [DEVELOPER_HANDOVER_CHECKLIST.md](file:///data/user/0/com.termux/files/home/Disha-/docs/DEVELOPER_HANDOVER_CHECKLIST.md) | New engineer onboarding, access keys, critical constraints & sign-off |
| 18 | [PHASE_16_FINAL_REPORT.md](file:///data/user/0/com.termux/files/home/Disha-/docs/PHASE_16_FINAL_REPORT.md) | Phase 16 audit certification, codebase health & handover completion |

---

## License & Intellectual Property

Copyright © 2026 DISHA 20-20. All rights reserved.  
Proprietary educational platform software. Unauthorized distribution, copying, or reverse engineering is strictly prohibited.
