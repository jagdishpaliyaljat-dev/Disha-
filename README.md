<div align="center">

<img src="public/icon-512.png" alt="DISHA 20-20 Logo" width="120" height="120" />

# DISHA 20-20 — Competitive Exam Prep Platform

**India's most advanced Rajasthan competitive exam preparation ecosystem**

[![Version](https://img.shields.io/badge/version-1.0.18-blue?style=for-the-badge)](https://github.com/jagdishpaliyaljat-dev/Disha-Android-App/releases/tag/v1.0.18)
[![Build](https://img.shields.io/github/actions/workflow/status/jagdishpaliyaljat-dev/Disha-Android-App/build-apk.yml?branch=main&style=for-the-badge&label=APK%20Build)](https://github.com/jagdishpaliyaljat-dev/Disha-Android-App/actions)
[![Live App](https://img.shields.io/badge/Live%20App-disha--2020.vercel.app-green?style=for-the-badge)](https://disha-2020.vercel.app)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](#license)

> DISHA 20-20 is a full-stack, offline-first Progressive Web App and Android application built for serious aspirants preparing for RPSC RAS, Rajasthan GK, Police Constable, and Patwari exams — featuring live tests, AI tutoring, real-time battle mode, spaced repetition, PYQ vault, and state-wide merit rankings.

[📱 Download APK](https://github.com/jagdishpaliyaljat-dev/Disha-Android-App/releases/tag/v1.0.18) · [🌐 Live Web App](https://disha-2020.vercel.app) · [📖 Docs](./docs/) · [🐛 Issues](https://github.com/jagdishpaliyaljat-dev/Disha-Android-App/issues)

</div>

---

## 📋 Table of Contents

- [About the Platform](#about-the-platform)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Android Build](#android-build)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
- [Architecture Overview](#architecture-overview)
- [Release History](#release-history)
- [Documentation Index](#documentation-index)
- [Contributing](#contributing)
- [License](#license)

---

## About the Platform

DISHA 20-20 is a production-grade, **offline-first** exam preparation platform built specifically for Rajasthan competitive exam aspirants. The platform combines:

- **Real-time competitive infrastructure** — Live mock exams with state-wide verified leaderboards
- **AI-powered learning** — Gemini 2.0-backed AI tutor, doubt resolver, and auto-question formatter
- **Spaced repetition engine** — Adaptive difficulty scheduling using SM-2 inspired algorithm
- **Battle Mode** — Real-time 1v1 MCQ duels with Supabase Realtime channels
- **Full offline support** — IndexedDB v5 (18 object stores), LocalStorage, and service workers ensure 100% functionality without internet
- **Progressive Web App + Android** — Single codebase deployed as a PWA (Vercel) and native Android APK (Capacitor)

The platform covers:
| Exam | Coverage |
|------|----------|
| RPSC RAS (Pre + Mains) | Rajasthan GK, History, Geography, Polity, Economy, Science |
| Rajasthan Police Constable | GK, Reasoning, Hindi, Current Affairs |
| Rajasthan Patwari | Revenue Law, Maths, Computer, GK |
| REET (Level 1 & 2) | Child Psychology, Hindi, Maths, EVS, Social Studies |
| Junior Accountant | Accounts, Commerce, GK |

---

## Key Features

### 🎓 Student / User App
| Feature | Description |
|---------|-------------|
| **Smart Practice Engine** | Chapter-wise, topic-wise, custom difficulty MCQ sessions with real-time scoring |
| **Live Exam Tests** | Scheduled live tests with countdown timers and state-wide merit leaderboards |
| **PYQ Vault** | Searchable archive of Previous Year Questions across all exams with filter-by-year |
| **AI Tutor (Disha AI)** | Gemini 2.0-powered doubt resolver with multi-modal support, KaTeX math rendering |
| **Battle Mode (1v1)** | Real-time MCQ duels via Supabase Realtime — challenge friends or random opponents |
| **Spaced Repetition** | Adaptive revision scheduler — prioritizes weak topics using performance history |
| **QR/Photo Scanner** | Camera-based question import using device OCR + AI formatting |
| **Weakness Heatmap** | Visual analytics dashboard showing subject-wise accuracy trends |
| **Error Journal** | Auto-tracks all wrong answers with smart re-attempt queuing |
| **Google One-Tap Login** | Native Google Sign-In via `@capgo/capacitor-social-login` on Android + web |
| **Offline First** | Full exam sessions, flashcards, and practice work without internet |
| **PWA Installable** | Add to home screen with full app-like experience on any device |

### 🛡️ Admin Panel
| Feature | Description |
|---------|-------------|
| **Curriculum Builder** | Visual Subject → Chapter → Topic → Question hierarchy management |
| **Universal Smart Parser** | AI-powered bulk question importer from plain text, HTML, Excel/CSV |
| **Gemini Auto-Formatter** | Automatically formats and classifies raw question text using AI |
| **Live Test Management** | Schedule live exams, set timers, publish results, generate PDF merit lists |
| **Banner Management** | Upload/manage promotional banners with active/inactive toggle |
| **AI Vault (Multi-Provider)** | AES-256-GCM encrypted API key vault — Gemini, Claude, GPT-4o, Groq |
| **Backup & Restore** | Full Supabase/Firestore database export to ZIP with SHA-256 integrity check |
| **Admin Promotion Security** | Challenge-response admin elevation with 24-hour session lock |
| **Diagnostic Tools** | Orphan detection, duplicate finder, DB health checker |

---

## Technology Stack

| Layer | Technologies & Versions |
|:------|:------------------------|
| **Frontend Framework** | React 19.0.1, TypeScript 5.x |
| **Build Tool** | Vite 8.3.8, `@tailwindcss/vite` 4.3.3 |
| **Styling** | Tailwind CSS v4.3.3, Motion (Framer) 12.x |
| **UI Icons** | Lucide React 0.546.0 |
| **Math & Markdown** | KaTeX 0.19.0, React Markdown 10.x, DOMPurify 3.x |
| **Backend / BaaS** | Supabase (Postgres, Auth, Realtime, Storage) |
| **Offline Storage** | IndexedDB v5 (18 object stores), LocalStorage, LocalForage 1.10.0 |
| **PWA** | Vite-Plugin-PWA 2.0.0, Workbox |
| **Native Android** | Capacitor 8.6.2, `@capacitor/android`, `@capgo/capacitor-social-login` |
| **AI Integration** | `@google/genai` 2.4.0 (Gemini 2.0 Flash / Pro), Multi-Provider REST |
| **Deployment** | Vercel (PWA), GitHub Actions (Android APK) |
| **Testing** | Vitest 5.1.0, JSDOM 30.x |
| **Package Manager** | pnpm (required) |

---

## Project Structure

```
Disha-/
├── android/                    # Capacitor Android project
│   └── app/
│       ├── build.gradle        # versionCode 6, versionName "1.0.15"
│       └── src/main/assets/public/  # Compiled web assets (synced via cap copy)
├── docs/                       # Developer documentation (18 guides)
├── public/                     # Static assets, icons, manifest.json
├── scripts/                    # Seed scripts, health checks, DB utilities
├── src/
│   ├── components/             # ~60+ React UI components
│   │   ├── admin/              # Admin panel modals and sections
│   │   ├── battle/             # 1v1 Battle Mode components
│   │   ├── coaching/           # Coaching hierarchy components
│   │   └── ui/                 # Shared primitive UI components
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # Service layer
│   │   └── snapshot/           # IndexedDB v5 snapshot engine
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Business logic utilities
│       ├── cleanSlate.ts       # App startup data integrity (v13.0.0)
│       ├── supabaseClient.ts   # Supabase client singleton
│       ├── realtimeBattleService.ts  # Battle Mode realtime engine
│       ├── questionsStorage.ts # Offline question store (IndexedDB)
│       ├── aiProviderService.ts # Multi-provider AI with key rotation
│       └── ...                 # 40+ utility modules
├── tests/                      # Vitest test suites
├── .github/workflows/
│   ├── build-apk.yml           # Android release APK builder (triggers on tag)
│   └── build-check.yml         # PR build validation
├── capacitor.config.ts         # Capacitor & Google OAuth config
├── vite.config.ts              # Vite build config
├── tailwind.config.ts          # Tailwind CSS v4 config
├── package.json                # v1.0.15
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** `22.x` or higher
- **pnpm** `>= 9.x` — _required, do not use npm or yarn_
- **Git**

```bash
# Install pnpm globally if not present
npm install -g pnpm
```

### Clone & Install

```bash
# Clone the web/PWA repository
git clone https://github.com/jagdishpaliyaljat-dev/Disha-.git
cd Disha-

# Install dependencies
pnpm install
```

### Development Server

```bash
pnpm dev
# App available at http://localhost:5173
```

### Production Build

```bash
pnpm run build
# Output: dist/

pnpm start  # or: pnpm preview
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# ─── Supabase (Public — VITE_ prefix safe for client) ───────────────────────
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# ─── Google OAuth (Public — used in Capacitor Social Login) ─────────────────
VITE_GOOGLE_WEB_CLIENT_ID=your_google_oauth_web_client_id.apps.googleusercontent.com

# ─── AI Keys (Encrypted — stored in Supabase vault, NOT hardcoded) ──────────
# These are managed via the Admin Panel → AI Provider Vault
# Never commit raw AI API keys to this file or any source file

# ─── Optional: Analytics ────────────────────────────────────────────────────
VITE_VERCEL_ANALYTICS=true
```

> ⚠️ **Security Rule:** Only `VITE_` prefixed keys are exposed to the browser bundle. Service-role keys, encryption keys, and AI API keys must **never** be prefixed with `VITE_` or committed to source code.

---

## Android Build

### Local Android Development

```bash
# 1. Build the web assets
pnpm run build

# 2. Sync web assets to Android project
pnpm exec cap copy android

# 3. Full sync (plugins + assets)
pnpm run app:sync

# 4. Open in Android Studio
pnpm run app:open
```

### Release APK via GitHub Actions

Release APKs are **automatically built** when a version tag is pushed:

```bash
# Tag and push → triggers build-apk.yml workflow automatically
git tag -a v1.0.15 -m "Release v1.0.15"
git push origin main --tags
```

APK download: **[GitHub Releases → v1.0.15](https://github.com/jagdishpaliyaljat-dev/Disha-Android-App/releases/tag/v1.0.15)**

### Android App Details
| Property | Value |
|----------|-------|
| App ID | `com.disha2020.examprep` |
| Version Name | `1.0.15` |
| Version Code | `6` |
| Min SDK | 23 (Android 6.0) |
| Target SDK | 35 (Android 15) |
| Signing | Release keystore (CI secrets) |

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test files
pnpm exec vitest run tests/realtime-battle.test.ts
pnpm exec vitest run tests/adminPromotionSecurity.test.ts

# TypeScript type check
pnpm lint
```

**Current Test Status:** ✅ 17/17 tests passing (v1.0.15)

| Test File | Tests | Status |
|-----------|-------|--------|
| `realtime-battle.test.ts` | 7 | ✅ Pass |
| `adminPromotionSecurity.test.ts` | 10 | ✅ Pass |

---

## Deployment

### Web App (Vercel)

| Property | Value |
|----------|-------|
| **Live URL** | https://disha-2020.vercel.app |
| **Project** | `disha-2020` |
| **Build Command** | `pnpm run build` |
| **Output Directory** | `dist` |
| **Framework** | Vite (Static) |

```bash
# Manual production deploy
npx vercel deploy --prod --yes
```

### Android APK (GitHub Actions)

| Repository | Purpose |
|------------|---------|
| [jagdishpaliyaljat-dev/Disha-Android-App](https://github.com/jagdishpaliyaljat-dev/Disha-Android-App) | Primary — APK CI/CD builds |
| [jagdishpaliyaljat-dev/disha-20-20-app](https://github.com/jagdishpaliyaljat-dev/disha-20-20-app) | Mirror |
| [jagdishpaliyaljat-dev/Disha-](https://github.com/jagdishpaliyaljat-dev/Disha-) | Web/PWA origin |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              CLIENT (React 19 + TypeScript)             │
│  PWA (Vercel CDN)        Android APK (Capacitor 8)      │
├──────────────┬──────────────────────────────────────────┤
│  OFFLINE     │              ONLINE                       │
│  IndexedDB   │    Supabase (Postgres + Auth + Realtime) │
│  LocalStorage│    Supabase Storage (banners, media)     │
│  Service SW  │    Google Gemini 2.0 Flash (AI Tutor)    │
├──────────────┴──────────────────────────────────────────┤
│                 KEY SUBSYSTEMS                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Clean Slate │  │ Battle Mode  │  │  Live Tests   │ │
│  │  v13.0.0   │  │ Realtime 1v1 │  │ Merit Ranking │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Spaced Rep  │  │  AI Vault    │  │  PYQ Vault   │ │
│  │  Engine     │  │ AES-256-GCM  │  │  Search/Filter│ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Data Integrity — Clean Slate System

The app uses a versioned **Clean Slate** system (`src/utils/cleanSlate.ts`) that runs on every app startup. On version mismatch, it automatically:
- Resets all coaching/series keys to empty arrays
- Purges obsolete benchmark, mock, and test-prefixed localStorage entries
- Clears stale IndexedDB snapshots

**Current version:** `13.0.0` (bumped in v1.0.15 to purge all legacy mock data)

---

## Release History

| Version | Date | Highlights |
|---------|------|------------|
| **v1.0.18** | Nov 2026 | 🤖 Global Gemini AI Integration & Universal Disha AI Tutor (Always active, zero key prompts for students, auto-upgraded to `gemini-flash-latest`) |
| **v1.0.17** | Nov 2026 | 🚨 In-House Supabase Crash Reporting Engine, real-time telemetry dashboard & offline queue (Zero 3rd-party setup) |
| **v1.0.16** | Nov 2026 | 🛡️ Production crash reporting integration with Sentry (`@sentry/react` 11.x), PII scrubbing & anonymous user telemetry |
| **v1.0.15** | Nov 2026 | 🧹 Complete mock data purge — real leaderboards, real battle questions, Clean Slate v13.0.0 |
| **v1.0.14** | Nov 2026 | 🎨 Profile UI redesign, compact 68–72dp header optimization, safe-area insets fix |
| **v1.0.13** | Nov 2026 | 📐 Top header vertical whitespace elimination, premium header layout |
| **v1.0.12** | Nov 2026 | 🔄 Platform stability and performance improvements |
| **v1.0.11** | Nov 2026 | 🔐 Native Google One-Tap login integration with Supabase `signInWithIdToken` |
| **v1.0.10** | Oct 2026 | ⚔️ Battle Mode enhancements, realtime channel stability |
| **v1.0.9** | Oct 2026 | 📚 PYQ Vault search & filter improvements |
| **v1.0.8** | Oct 2026 | 🤖 Disha AI Tutor — Gemini 2.0 Flash integration |
| **v1.0.7** | Oct 2026 | 📊 AI Weakness Heatmap and analytics dashboard |
| **v1.0.6** | Sep 2026 | 🏆 Live Exam Tests with state-wide merit leaderboards |

---

## Documentation Index

Full developer documentation is in the [`docs/`](./docs/) folder:

| # | Document | Purpose |
|:--:|:---------|:--------|
| 01 | [PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md) | Business goals, exam coverage, problem statement |
| 02 | [PROJECT_DIRECTORY_GUIDE.md](./docs/PROJECT_DIRECTORY_GUIDE.md) | Complete file tree and directory responsibilities |
| 03 | [SYSTEM_ARCHITECTURE.md](./docs/SYSTEM_ARCHITECTURE.md) | 5-tier architecture, quota defense, security boundaries |
| 04 | [FRONTEND_ARCHITECTURE.md](./docs/FRONTEND_ARCHITECTURE.md) | React 19 UI hierarchy, state, routing, PWA caching |
| 05 | [BACKEND_API_REFERENCE.md](./docs/BACKEND_API_REFERENCE.md) | REST endpoint specs with auth, payloads, responses |
| 06 | [FIREBASE_DATABASE_SCHEMA.md](./docs/FIREBASE_DATABASE_SCHEMA.md) | Supabase/Firestore collections, fields, indexes |
| 07 | [BUSINESS_LOGIC_REFERENCE.md](./docs/BUSINESS_LOGIC_REFERENCE.md) | Spaced repetition, RPSC marking, deduplication logic |
| 08 | [ADMIN_PANEL_GUIDE.md](./docs/ADMIN_PANEL_GUIDE.md) | Admin CMS operational manual |
| 09 | [USER_PANEL_GUIDE.md](./docs/USER_PANEL_GUIDE.md) | Student journey: practice, tests, revision, PYQ |
| 10 | [BACKUP_RESTORE_GUIDE.md](./docs/BACKUP_RESTORE_GUIDE.md) | Disaster recovery, 5 restore modes, SHA-256 integrity |
| 11 | [LOCAL_DEVELOPMENT_SETUP.md](./docs/LOCAL_DEVELOPMENT_SETUP.md) | Developer setup, env vars, Termux guidelines |
| 12 | [DEPLOYMENT_RELEASE_GUIDE.md](./docs/DEPLOYMENT_RELEASE_GUIDE.md) | Vercel + GitHub Actions deployment, build pipeline |
| 13 | [TESTING_GUIDE.md](./docs/TESTING_GUIDE.md) | Test suites, mocks, coverage, performance benchmarks |
| 14 | [TROUBLESHOOTING_GUIDE.md](./docs/TROUBLESHOOTING_GUIDE.md) | Common errors, solutions, Supabase/Capacitor tips |
| 15 | [ARCHITECTURE_DIAGRAMS.md](./docs/ARCHITECTURE_DIAGRAMS.md) | Mermaid diagrams for flows, schemas, states |
| 16 | [DEVELOPER_HANDOVER_CHECKLIST.md](./docs/DEVELOPER_HANDOVER_CHECKLIST.md) | Onboarding, access keys, critical constraints |

---

## Contributing

This is a **private proprietary project**. External contributions are not accepted.

For internal developers:
1. Always use `pnpm` — never `npm` or `yarn`
2. Never commit API keys, service-role tokens, or secrets to source
3. Bump `package.json` version + `android/app/build.gradle` versionCode on each release
4. Run `pnpm test` before every commit — all tests must pass
5. Sync Android assets: `pnpm exec cap copy android` after every build
6. Push to all 3 remotes: `origin`, `neworigin`, `web-origin`
7. Tag releases with `git tag -a vX.X.X` to trigger APK CI builds

---

## License

Copyright © 2024–2026 **DISHA 20-20**. All rights reserved.

Proprietary educational platform software. Unauthorized distribution, reproduction, reverse engineering, or modification is strictly prohibited. This software and its source code are confidential and may only be used by authorized personnel.

---

<div align="center">

**Built with ❤️ for Rajasthan Competitive Exam Aspirants**

[🌐 disha-2020.vercel.app](https://disha-2020.vercel.app) · [📱 Download APK v1.0.18](https://github.com/jagdishpaliyaljat-dev/Disha-Android-App/releases/tag/v1.0.18)

</div>
