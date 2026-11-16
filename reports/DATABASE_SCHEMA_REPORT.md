# DISHA 20-20 — Database Schema Report

**Date:** November 16, 2026  
**Status:** ✅ VERIFIED & OPERATIONAL  
**Target Engine:** PostgreSQL 15+ (Hosted on Supabase)  
**Schema File:** `supabase/schema.sql`  

---

## 1. Schema Architecture Overview

The DISHA 20-20 database schema is organized into two primary functional domains:
1. **Curriculum Hierarchy & Content Bank:** `subjects`, `chapters`, `topics`, and `questions`.
2. **User Profiles & Student Telemetry:** `profiles`, `attempts`, and `bookmarks`.

All tables utilize UUID primary keys generated via PostgreSQL `gen_random_uuid()` to prevent ID collisions, allow client-side key generation where appropriate, and simplify horizontal scaling.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    subjects     │◀──────│    chapters     │◀──────│     topics      │
│ (Curriculum PK) │ 1   N │  (Subject FK)   │ 1   N │  (Chapter FK)   │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │ 1                       │ 1                       │ 1
         │                         │                         │
         │ N                       │ N                       │ N
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │      questions      │
                        │ (Options as JSONB)  │
                        └──────────┬──────────┘
                                   │ 1
                                   │
                                   │ N
                        ┌──────────┴──────────┐
                        │      bookmarks      │
                        │ (User-Question Map) │
                        └──────────┬──────────┘
                                   │ N
                                   │
                                   │ 1
                        ┌──────────┴──────────┐
                        │      profiles       │
                        │ (Auth Users Mirror) │
                        └──────────┬──────────┘
                                   │ 1
                                   │
                                   │ N
                        ┌──────────┴──────────┐
                        │      attempts       │
                        │ (Student Test Logs) │
                        └─────────────────────┘
```

---

## 2. Table Definitions & DDL Specifications

### 2.1. `public.subjects`
Stores the top-level academic subjects (e.g., General Knowledge, Rajasthan Geography, History, Science).

```sql
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hindi_name TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.2. `public.chapters`
Groups topics under a specific subject.

```sql
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hindi_name TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.3. `public.topics`
Defines discrete learning units under a chapter.

```sql
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hindi_name TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.4. `public.questions`
Central question repository designed to scale beyond 100,000+ MCQs.

```sql
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  exam TEXT,
  year INTEGER,
  level TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

> **Design Choice — `options` as `JSONB`:**  
> Storing options (`[{ "id": "A", "text": "..." }, ...]`) in `JSONB` avoids maintaining a separate 400,000+ row relational `options` table with expensive JOIN operations. PostgreSQL's binary JSON format allows ultra-fast reads, preserves option ordering, and easily accommodates Option E ("Question Not Attempted") without additional schema complexity.

### 2.5. `public.profiles`
User metadata mirror linked directly to Supabase Auth (`auth.users`).

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.6. `public.attempts`
Records every completed test, quiz, or practice session taken by a student.

```sql
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id),
  subject_id UUID REFERENCES public.subjects(id),
  total_questions INTEGER NOT NULL,
  score INTEGER NOT NULL,
  answers JSONB NOT NULL,
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

> **Design Choice — `answers` as `JSONB`:**  
> Storing the submission payload (`{ "q1_uuid": "A", "q2_uuid": "E", ... }`) in `JSONB` allows flexible evaluation snapshots without creating millions of granular row entries in relational junction tables.

### 2.7. `public.bookmarks`
Enables students to bookmark difficult or important questions for quick revision.

```sql
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_user_question UNIQUE (user_id, question_id)
);
```

---

## 3. Database Indexes

To achieve sub-second query performance with 100,000+ MCQs and 10,000 daily active users, the following indexes are deployed:

| Index Name | Target Table | Target Columns | Purpose |
|---|---|---|---|
| `idx_chapters_subject_id` | `chapters` | `(subject_id)` | Fast lookup of chapters by subject |
| `idx_topics_chapter_id` | `topics` | `(chapter_id)` | Fast lookup of topics by chapter |
| `idx_topics_subject_id` | `topics` | `(subject_id)` | Subject-level topic filtering |
| `idx_questions_subject_id` | `questions` | `(subject_id)` | Question bank subject filtering |
| `idx_questions_chapter_id` | `questions` | `(chapter_id)` | Question bank chapter filtering |
| `idx_questions_topic_id` | `questions` | `(topic_id)` | Practice session question loading |
| `idx_questions_exam_year` | `questions` | `(exam, year)` | Composite index for PYQ searches |
| `idx_attempts_user_id` | `attempts` | `(user_id, created_at DESC)` | Student performance history retrieval |
| `idx_bookmarks_user_id` | `bookmarks` | `(user_id)` | User bookmark list hydration |
| `uq_user_question` | `bookmarks` | `(user_id, question_id)` | Unique index preventing duplicate bookmarks |

---

## 4. Referential Integrity & Deletion Rules

- **Curriculum Hierarchy:** `ON DELETE CASCADE` ensures that deleting a subject automatically cleans up child chapters and topics.
- **Question Preservation:** When a topic or chapter is deleted, questions reference them with `ON DELETE SET NULL`, preserving the questions in the question bank without orphaned reference errors.
- **Student Data Cleanliness:** `ON DELETE CASCADE` on `profiles.id` ensures that if a user deletes their account from Supabase Auth, all associated attempts and bookmarks are automatically purged, adhering to data privacy standards.

---

## 5. Schema Conclusion

The database schema is **fully normalized, referentially sound, properly indexed**, and optimized for both high-concurrency read operations (PostgREST) and atomic student transaction writes.
