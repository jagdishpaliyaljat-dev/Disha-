# DISHA 20-20 — System Architecture & Workflow Diagrams

This document collects architectural and operational sequence diagrams illustrating the design of **DISHA 20-20 (दिशा 20-20)**.

---

## 1. System Component & Data Flow Diagram

```mermaid
flowchart TD
    Client["Client Browser / PWA (React 19 + TypeScript)"]
    ServiceWorker["Workbox Service Worker (CacheFirst Strategy)"]
    EdgeAPI["Vercel Edge Network / Express 4 API (Node.js 22)"]
    Firestore["Google Cloud Firestore (56 Collections)"]
    IndexedDB["Client IndexedDB v5 (18 Object Stores)"]
    AIVault["Multi-Provider AI Vault (AES-256 Encrypted)"]

    Client -->|1. Intercept Route / Asset| ServiceWorker
    ServiceWorker -->|2. Cache Hit: Serve Immutable Asset| Client
    ServiceWorker -->|3. Cache Miss: Forward to Edge| EdgeAPI
    Client -->|4. Interactive Telemetry: Write Local| IndexedDB
    EdgeAPI -->|5. Authorized Cloud Sync / Backup| Firestore
    EdgeAPI -->|6. Encrypted Prompts / Keys| AIVault
    IndexedDB -.->|7. Deferred 24h Batch Sync| EdgeAPI
```

---

## 2. Five-Tier Data Storage & Caching Hierarchy

```mermaid
flowchart LR
    Tier1["Tier 1: React Memory Context\n(Sub-millisecond latency)"]
    Tier2["Tier 2: IndexedDB v5\n(2-10ms local persistence)"]
    Tier3["Tier 3: Service Worker Cache\n(Workbox static quiz assets)"]
    Tier4["Tier 4: Serverless CDN\n(Version-keyed immutable JSON)"]
    Tier5["Tier 5: Cloud Firestore\n(Authoritative Cloud Database)"]

    Tier1 --> Tier2
    Tier2 --> Tier3
    Tier3 --> Tier4
    Tier4 --> Tier5
```

---

## 3. Student 24-Hour Write-Buffer & Quota Defense Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (Aspirant)
    participant UI as React UI (MCQSessionModal)
    participant Buffer as StudentWriteBuffer (IndexedDB v5)
    participant Outbox as Pending Sync Outbox
    participant Gate as 24h Sync Gate (canPerformRoutineSync)
    participant Cloud as Cloud Firestore

    Student->>UI: Selects Option B on Question Q-101
    UI->>Buffer: commitLocalProgress(Q-101, isCorrect)
    Note over Buffer: Instant local write to 'user_progress'<br/>UI updates instantly (< 10ms)
    Buffer->>Outbox: appendToOutbox(Q-101, mutationPayload)
    Outbox->>Gate: checkEligibility(lastSyncTimestamp)
    
    alt Elapsed Time < 24 Hours
        Gate-->>Outbox: GATED (false)
        Note over Outbox: Mutation retained safely in local storage.<br/>Zero Firestore writes issued.
    else Elapsed Time >= 24 Hours
        Gate-->>Outbox: ELIGIBLE (true)
        Outbox->>Cloud: flushOutboxBatch(aggregatedMutations)
        Cloud-->>Outbox: Batch Commit OK (200)
        Outbox->>Buffer: clearOutbox() & updateSyncCheckpoint()
    end
```

---

## 4. Snapshot Publishing & Delta Synchronization Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrator
    participant Desk as Admin Publish Desk
    participant Engine as SnapshotPublishingService
    participant Storage as Immutable Asset CDN
    participant Client as Student Service Worker
    participant LocalDB as Client IndexedDB v5

    Admin->>Desk: Trigger "Publish New Snapshot"
    Desk->>Engine: compileSnapshot()
    Engine->>Engine: Scan collections & compute SHA-256
    Engine->>Engine: Generate Version Delta Bundle
    Engine->>Storage: Upload snapshot chunks & manifest.json
    Storage-->>Desk: Publish Complete (Version N+1)
    
    Note over Client: Next background check / App launch
    Client->>Storage: GET /api/manifests/current.json
    Storage-->>Client: Returns Manifest Version N+1
    
    alt Client Version == N
        Client->>Storage: GET /api/deltas/vN_to_vN+1.json
        Storage-->>Client: Returns Micro-Delta Change Bundle
        Client->>LocalDB: Apply upserts & purge tombstones
    else Client Version < N (Outdated)
        Client->>Storage: GET /api/snapshots/vN+1/chunk_*.json
        Storage-->>Client: Full Snapshot Stream
        Client->>LocalDB: Re-hydrate full curriculum tree
    end
```

---

## 5. Authentication, Authorization & RBAC State Machine

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated: App Launch

    Unauthenticated --> AnonymousGuest: Explore Curriculum (Guest Mode)
    AnonymousGuest --> AuthenticatedStudent: Sign In (Google OAuth / Email)
    Unauthenticated --> AuthenticatedStudent: Direct Sign In

    state AuthenticatedStudent {
        [*] --> CheckVerification
        CheckVerification --> StudentActive: email_verified == true
        CheckVerification --> StudentUnverified: email_verified == false
        StudentActive --> PracticeEngine: Standard Permissions
        StudentActive --> LiveTestRoom: Verified Permissions
    }

    AuthenticatedStudent --> AdminEvaluating: Access /admin route
    
    state AdminEvaluating {
        [*] --> CheckAllowlist
        CheckAllowlist --> SuperAdmin: Email in [zdpaliyal, jagdishpaliyaljat]
        CheckAllowlist --> CustomAdmin: Token custom claim 'admin' == true
        CheckAllowlist --> AccessDenied: Not Allowlisted (HTTP 403)
    }

    SuperAdmin --> AdminConsole: Full Control (56 Collections, Backup, AI Vault)
    CustomAdmin --> AdminConsole: Role-Guarded Permissions
    AccessDenied --> StudentActive: Redirect with Access Notification
```

---

## 6. Disaster Recovery & Reversible Backup/Restore Flow

```mermaid
flowchart TD
    Start["Admin Triggers Backup Export"] --> ReadCollections["Query 56 Discovered Collections"]
    ReadCollections --> Serialize["Reversible Firestore Type Serialization\n(Timestamp, GeoPoint, Ref, Bytes)"]
    Serialize --> Compress["In-Memory ZIP Engine (zipEngine.ts)"]
    Compress --> HashGen["Generate SHA-256 Checksums for every entry"]
    HashGen --> Manifest["Compile manifest.json & checksums.sha256"]
    Manifest --> DownloadZip["Download Verified Archive (.zip)"]

    UploadZip["Admin Uploads Archive for Restoration"] --> Validate["Preflight Validation (DRY_RUN)\n- Checksum Validation\n- JSON Syntax Inspection\n- Referential Key Check"]
    Validate --> StrategySelect{"Select Restore Strategy"}
    StrategySelect -->|MERGE_UPSERT| Merge["Update existing docs,\ninsert missing docs"]
    StrategySelect -->|CLEAN_RESTORE| Clean["Wipe obsolete docs,\noverwrite full tree"]
    StrategySelect -->|SKIP_EXISTING| Skip["Insert new docs only,\nretain live state"]
    StrategySelect -->|MIGRATION_RESTORE| Migrate["Rewrite project references,\nimport to target project"]

    Merge --> Deserialize["Deserialize Envelopes to Native Firestore Types"]
    Clean --> Deserialize
    Skip --> Deserialize
    Migrate --> Deserialize
    Deserialize --> Finish["Restore Complete (RTO < 60s, RPO = 0s)"]
```

---

## 7. Multi-Provider AI Rotation & Cooldown State Machine

```mermaid
stateDiagram-v2
    [*] --> PrimaryProvider: Initialize AI Router (Gemini 2.0 Flash)

    state PrimaryProvider {
        [*] --> Ready: Key Available
        Ready --> Processing: Prompt Dispatched
        Processing --> Ready: HTTP 200 OK
        Processing --> RateLimited: HTTP 429 / 503 Quota Error
    }

    RateLimited --> SecondaryProvider: Auto-Failover to Claude 3.5 Sonnet
    RateLimited --> TimerCooldown: Set Cooldown (5 Minutes)

    state SecondaryProvider {
        [*] --> ClaudeReady: Key Available
        ClaudeReady --> ClaudeProcessing: Fallback Prompt
        ClaudeProcessing --> ClaudeReady: HTTP 200 OK
        ClaudeProcessing --> TertiaryProvider: HTTP 429 Error
    }

    TertiaryProvider --> OpenAI_GPT4o: Fallback to GPT-4o / Groq
    TimerCooldown --> PrimaryProvider: Cooldown Expired / Admin Reset
```

---

## 8. Exam Paper OCR Extraction & Semantic Matcher Pipeline

```mermaid
flowchart LR
    Capture["1. Capture / Upload\n(Paper Scan or PDF)"] --> OCR["2. Multimodal OCR\n(Gemini 2.0 Vision)"]
    OCR --> Parser["3. Structure Extractor\n(Question, Options, Index)"]
    Parser --> Embedding["4. Canonical Normalization\n(Devanagari Normalization + Hash)"]
    Embedding --> FuzzyMatch["5. Semantic Matching Engine\n(Jaccard + Levenshtein + Embeddings)"]
    FuzzyMatch --> MatchResult{"Match Score"}
    MatchResult -->|>= 90%| Exact["Exact Match\n(Verified Answer & Explanation)"]
    MatchResult -->|70% - 89%| NearExact["Near-Exact Match\n(Review Differences)"]
    MatchResult -->|< 70%| Unmatched["Unmatched Question\n(Flagged for Review)"]
```

---

## 9. Core Curriculum Relational Entity Model

```mermaid
erDiagram
    SUBJECT ||--o{ CHAPTER : contains
    CHAPTER ||--o{ TOPIC : contains
    TOPIC ||--o{ QUESTION : contains
    USER ||--o{ PROGRESS : tracks
    USER ||--o{ ATTEMPT : submits
    LIVE_TEST ||--o{ QUESTION : includes
    LIVE_TEST ||--o{ SUBMISSION : receives

    SUBJECT {
        string id PK
        string name
        string hindiName
        int order
        int questionCount
    }
    CHAPTER {
        string id PK
        string subjectId FK
        int number
        string title
        string hindiTitle
        boolean isPublished
    }
    TOPIC {
        string id PK
        string chapterId FK
        string title
        string hindiTitle
        int questionCount
    }
    QUESTION {
        string id PK
        string topicId FK
        string chapterId FK
        string text
        array options
        int correctIndex
        string explanation
        boolean isPYQ
    }
    USER {
        string id PK
        string name
        string email
        string role
        string targetExam
    }
    PROGRESS {
        string questionId PK
        string userId FK
        int stage
        string nextReviewAt
        int wrongCount
        boolean bookmarked
    }
```
