# DISHA 20-20 — Complete System Data Flow Diagrams

**Audit Level:** Visual Architecture & Sequence Tracing  
**Audit Roles:** Senior Firebase Architect, Full-Stack Performance Engineer, Systems Visualizer  
**Target Repository:** `/data/user/0/com.termux/files/home/Disha-`  
**Execution Mode:** 100% Read-Only Forensic Analysis  
**Output Deliverable:** Phase 9 Complete Mermaid Architecture Diagrams  

---

## Executive Summary

This document provides complete, end-to-end visual data flow specifications for **all 10 critical operational flows** in DISHA 20-20. Every connection between the **User Interface**, **React Components**, **Custom Hooks & Contexts**, **Client Storage Layers**, **Backend APIs**, and **Google Cloud Firestore** is explicitly mapped with protocol distinctions:
- **Direct Firebase SDK Calls** (HTTP Long-Polling over `experimentalForceLongPolling: true`).
- **Backend API Calls** (Express `/api/*` REST endpoints with Bearer tokens).
- **Local In-Memory / IndexedDB Calls** (Sub-millisecond local reads).

---

## 1. User Login & Registration Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Candidate
    participant UI as LoginPage.tsx
    participant AuthSDK as Firebase Auth SDK
    participant Storage as userProfileStorage.ts
    participant Firestore as Cloud Firestore (users/{uid})
    participant IDB as LocalStorage / IndexedDB

    Student->>UI: Enters credentials / Clicks Google Login
    UI->>AuthSDK: signInWithEmailAndPassword() or signInWithPopup()
    AuthSDK-->>UI: Returns UserCredential & ID Token
    UI->>Storage: loadUserProfile(user.uid)
    alt Cached Profile Present in LocalStorage
        Storage->>IDB: Reads quizpro_user_profile
        IDB-->>Storage: Returns profile object
    else First-Time Login / Cache Miss
        Storage->>Firestore: [Direct SDK] getDoc(doc(db, "users", uid)) [1 Read]
        Firestore-->>Storage: Returns remote user document
    end
    UI->>Firestore: [Direct SDK] setDoc(doc(db, "users", uid), { lastLoginAt: serverTimestamp() }, { merge: true }) [1 Write]
    UI->>Storage: saveUserProfile(mergedProfile)
    Storage->>IDB: Persists updated profile to LocalStorage
    UI->>Student: Dismisses modal, updates Header avatar
```

---

## 2. User Dashboard Loading Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Candidate
    participant App as App.tsx
    participant Home as HomeTab.tsx
    participant Sync as useFirebaseSync.ts
    participant IDB as IndexedDB V5 (disha_offline_db_v5)
    participant Banners as bannerStorage.ts
    participant Firestore as Cloud Firestore

    Student->>App: Opens DISHA 20-20
    App->>Sync: Mounts single curriculum listener
    Sync->>IDB: Reads local curriculum version from store
    IDB-->>Sync: Local Version = 142
    Sync->>Firestore: [Direct SDK] onSnapshot(metadata/version) [1 Read]
    Firestore-->>Sync: Remote Version = 142 (Match!)
    
    Note over Sync,IDB: Version match! Zero curriculum reads from cloud.
    App->>Home: Mounts HomeTab component
    Home->>IDB: Reads store_subjects & store_chapters
    IDB-->>Home: Returns cached curriculum hierarchy (Sub-30ms)
    Home->>Banners: loadBannersFromStorage()
    Banners->>Firestore: [Direct SDK] getDocs(collection(db, "banners")) [1 Read]
    Firestore-->>Banners: Returns banner carousel slides
    Home->>Student: Renders Home feed, quick pills, and recent practice resume
```

---

## 3. MCQ Question Fetching Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Candidate
    participant UI as TopicInteractionModal.tsx
    participant Cache as questionBankCache.ts
    participant IDB as IndexedDB V5 (store_questions)
    participant API as Backend Server (/api/quiz-assets/*)
    participant Firestore as Cloud Firestore (question_bundles)
    participant Modal as MCQSessionModal.tsx

    Student->>UI: Selects Topic "1857 Revolt in Rajasthan"
    UI->>Cache: fetchQuestionsForTopic("top-1857-revolt")
    Cache->>IDB: getQuestionsByTopic("top-1857-revolt")
    alt Questions Cached in IndexedDB (Cache Hit - 95% of cases)
        IDB-->>Cache: Returns 40 cached MCQs
        Cache-->>UI: Yields questions instantly (0 Network Latency)
    else Cache Miss (First time studying topic)
        Cache->>Firestore: [Direct SDK] getDoc(question_bundles/top-1857-revolt) [1 Read]
        alt Firestore Read Succeeds
            Firestore-->>Cache: Returns compressed question bundle
        else Fallback to Serverless Asset Cache
            Cache->>API: [Backend REST] GET /api/quiz-assets/bundle/top-1857-revolt
            API-->>Cache: Returns cached static bundle
        end
        Cache->>IDB: Writes 40 questions into store_questions
        Cache-->>UI: Yields questions
    end
    UI->>Modal: Launches interactive test session with questions
```

---

## 4. Quiz Submission & Server Grading Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Candidate
    participant Modal as MCQSessionModal.tsx
    participant Server as server.ts (/api/live-tests/:id/submit)
    participant Auth as authMiddleware.ts (verifyIdToken)
    participant Grading as liveTestService.ts
    participant Firestore as Cloud Firestore (attempts)

    Student->>Modal: Clicks "Submit Final Exam"
    alt Scheduled Live Exam (Server Graded Anti-Cheat Mode)
        Modal->>Server: [Backend REST] POST /api/live-tests/:id/submit { answers: [...] }
        Server->>Auth: Verifies Firebase ID Token
        Auth-->>Server: User verified (student UID)
        Server->>Grading: gradeAndSubmitLiveTest(testId, answers)
        Grading->>Firestore: Reads liveTestAnswerKeys/{testId} [Server Privileged Read]
        Grading->>Grading: Computes score, negative marking, percentiles
        Grading->>Firestore: setDoc(attempts/{attemptId}, verifiedScoreRecord) [1 Write]
        Server-->>Modal: Returns verified scorecard & merit percentile
    else Self-Paced Practice Quiz (Client Graded Mode)
        Modal->>Modal: Computes score locally against bundled explanations
    end
    Modal->>Student: Displays final score, accuracy %, and review palette
```

---

## 5. User Progress & Outbox Buffering Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Candidate
    participant Engine as MCQSessionModal.tsx
    participant Ctx as ProgressContext.tsx
    participant Buffer as studentWriteBuffer.ts
    participant Outbox as IndexedDB (store_outbox)
    participant Firestore as Cloud Firestore (WriteBatch)

    Student->>Engine: Answers Question #1
    Engine->>Ctx: recordAnswer(questionId, selectedOption, isCorrect)
    Ctx->>Buffer: bufferProgressUpdate(userId, questionId, delta)
    Buffer->>Outbox: idbPutOutboxItem(attemptData)
    Note over Buffer: Buffered in memory. 0 Cloud Writes!

    loop Student answers Questions #2 through #10
        Student->>Engine: Answers Question #2 ... #10
        Engine->>Buffer: bufferProgressUpdate() [Accumulating]
    end

    Note over Buffer: Threshold Reached (10 Questions)! Draining buffer...
    Buffer->>Firestore: [Direct SDK] guardedWriteBatch() [1 Cloud Write Operation!]
    Firestore-->>Buffer: Batch commit success
    Buffer->>Outbox: idbDeleteOutboxItem() [Cleans outbox]
    Note over Buffer: Saved 9 out of 10 cloud writes (90% reduction)!
```

---

## 6. Admin MCQ Creation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Platform Administrator
    participant UI as UniversalQuestionImporter / AddQuestionsModal
    participant Parser as UniversalMcqParser / questionsParser.ts
    participant Hash as contentHash.ts (64-bit FNV-1a)
    participant Commit as commitBatch() in commit.ts
    participant Firestore as Cloud Firestore (mcqs, metadata)
    participant IDB as Local IndexedDB V5

    Admin->>UI: Pastes raw question text or uploads Excel
    UI->>Parser: parseRawMcqText(input)
    Parser-->>UI: Returns structured ParsedQuestion items
    UI->>Admin: Displays editable preview table with KaTeX math rendering
    Admin->>UI: Clicks "Commit Questions to Bank"
    UI->>Commit: commitBatch(parsedQuestions, targetTopicId)
    loop For each question
        Commit->>Hash: computeQuestionContentHash(q)
        Hash-->>Commit: Deterministic 64-bit FNV-1a hash
    end
    Commit->>Firestore: [Direct SDK] guardedWriteBatch(mcqs) [1 WriteBatch]
    Commit->>Firestore: [Direct SDK] setDoc(metadata/version, { appVersion: increment(1) }) [1 Write]
    Firestore-->>Commit: Success response
    Commit->>IDB: Writes new MCQs into local store_questions
    Commit-->>UI: Summary: 50 added, 0 duplicates
    UI->>Admin: Shows green success confirmation toast
```

---

## 7. Admin Subject / Chapter / Topic Update Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Platform Administrator
    participant UI as AdminSyllabusSection.tsx
    participant Store as questionsStorage.ts
    participant Firestore as Cloud Firestore (curriculum, metadata)
    participant IDB as Local IndexedDB V5

    Admin->>UI: Edits Chapter Title: "राजस्थान के प्रजामण्डल आन्दोलन"
    UI->>Store: editChapter(chapterId, updatedFields)
    Store->>Firestore: [Direct SDK] setDoc(doc(db, "chapters", chapterId), updatedFields, { merge: true }) [1 Write]
    Store->>Firestore: [Direct SDK] setDoc(doc(db, "metadata", "version"), { appVersion: increment(1) }) [1 Write]
    Firestore-->>Store: Cloud write confirmed
    Store->>IDB: Updates store_chapters locally
    Store-->>UI: Update complete
    UI->>Admin: Renders updated title in curriculum editor tree
```

---

## 8. Firebase Synchronization Flow

```mermaid
sequenceDiagram
    autonumber
    participant Client as useFirebaseSync.ts (Student Device)
    participant IDB as IndexedDB V5 (disha_offline_db_v5)
    participant Cloud as Cloud Firestore (metadata/version)
    participant Bundles as Cloud Firestore (question_bundles)

    Client->>Cloud: [Direct SDK] onSnapshot(doc(db, "metadata", "version")) [1 Listener Read]
    Note over Client,Cloud: Listener remains active in background
    
    Cloud-->>Client: Snapshot Event: Remote appVersion = 143 (Local = 142)
    Client->>Client: Detects Version Mismatch (Outdated Cache)!
    Client->>Cloud: [Direct SDK] getDoc(doc(db, "metadata", "curriculum_digest")) [1 Read]
    Cloud-->>Client: Returns manifest with topic checksums
    
    loop For each changed topic bundle
        Client->>Bundles: [Direct SDK] getDoc(doc(db, "question_bundles", changedTopicId)) [1 Read]
        Bundles-->>Client: Returns updated bundle chunk
        Client->>IDB: Overwrites updated questions in store_questions
    end
    
    Client->>IDB: Sets local recorded version = 143
    Client->>Client: Emits update event to React Contexts
```

---

## 9. Cache Invalidation Flow

```mermaid
flowchart TD
    A[Admin Publishes Changes] --> B[Increment metadata/version in Firestore]
    B --> C[Active Student Listener Fires via onSnapshot]
    C --> D{Remote Version == Local Version?}
    D -- Yes --> E[Keep 100% Cached Data in IndexedDB V5 - 0 Network Reads]
    D -- No --> F[Download curriculum_digest checksum manifest]
    F --> G{Compare Topic Hashes via FNV-1a Checksums}
    G -- Hash Matches --> H[Topic Unchanged: Retain Cached Questions]
    G -- Hash Differs --> I[Download Only Changed Topic Bundle Chunk]
    I --> J[Atomic Write into IndexedDB V5 store_questions]
    J --> K[Update Local Version = Remote Version]
    K --> L[React State Hydration Without Page Reload]
```

---

## 10. Authentication & Security Flow

```mermaid
sequenceDiagram
    autonumber
    actor Attacker as Malicious Actor
    participant Client as Client Browser
    participant Server as Express Backend (/api/admin/*)
    participant AuthAdmin as Firebase Admin SDK (verifyIdToken)
    participant Rules as Cloud Firestore Security Rules

    Attacker->>Client: Manually modifies LocalStorage role = 'admin'
    Client->>Attacker: Client UI renders Admin Tab (Local Spoof)
    
    Note over Attacker,Rules: Attack Vector 1: Direct Firestore SDK Mutation
    Attacker->>Rules: Calls deleteDoc(doc(db, "subjects", "sub_history"))
    Rules->>Rules: Evaluates isTrustedAdminEmail()
    Note over Rules: Decoded JWT email not in allowlist.
    Rules-->>Attacker: 403 PERMISSION_DENIED! [BLOCKED]
    
    Note over Attacker,Server: Attack Vector 2: Calling Backend Admin REST Endpoint
    Attacker->>Server: POST /api/admin/backup/export (with student Bearer token)
    Server->>AuthAdmin: verifyAuthenticatedRequest(req, { requireAdmin: true })
    AuthAdmin->>AuthAdmin: Decodes token & checks email allowlist
    Note over AuthAdmin: Email 'student@gmail.com' is not trusted admin.
    AuthAdmin-->>Server: Returns ok: false, status: 403
    Server-->>Attacker: HTTP 403 Forbidden! [BLOCKED]
```
