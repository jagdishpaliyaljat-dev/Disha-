# DISHA 20-20 — PHASE 7: SUBJECT-CHAPTER-TOPIC HIERARCHICAL MAPPING REPORT
**Audit Standard:** Relational Hierarchy, Foreign Key Integrity, and Taxonomical Forensic Standard  
**Audit Date:** November 15, 2026  
**Auditor:** AntiGem Automated Deep Forensic Agent (Phase 7 Content Lead)  
**Target Repository:** `/data/user/0/com.termux/files/home/Disha-`  
**Status:** **100% COMPLETE — READ-ONLY VERIFIED**

---

## 1. Executive Summary

A forensic audit of the curriculum hierarchy within the DISHA 20-20 exam portal was conducted to verify relational integrity between **Subjects $\longrightarrow$ Chapters $\longrightarrow$ Topics $\longrightarrow$ Questions**.

The audit confirmed that the active curriculum schema consists of **5 Subjects**, **14 Chapters**, and **57 Topics**. All **546 functional MCQs** are mapped with 100% relational consistency to the *Rajasthan History* subject, *Prajamandal* chapter, and *MCQ 1* topic. Exactly **30 records** lack curriculum foreign keys, representing legacy exam test reference stubs. 

Furthermore, cross-referencing against the Phase 4 archival store (`phase4_262_stale_questions_backup.json`) identified **262 high-quality questions** belonging to *Irrigation Projects (सिंचाई परियोजनाएं)* and *Rajasthan Economy* that are architecturally prepared for seamless re-attachment to existing zero-question nodes.

---

## 2. Master Curriculum Tree Architecture

The hierarchical structure defined in `education-content/snapshots/v1/content.json` spans 5 core competitive exam domains:

```
DISHA 20-20 Curriculum Taxonomy
├── 1. राजस्थान का इतिहास (subj-1793114550283-wpeqo)
│   ├── प्राचीन सभ्यता (custom-ch-1793114583187-txi6p)
│   ├── राजस्थान का एकीकरण (custom-ch-1793216900259-r5wpm)
│   ├── प्रजामंडल (custom-ch-1793292191934-f9c1l) ── [546 MCQs Active]
│   │   ├── MCQ 1 (topic_1b890441-cad7-4e64-82db-4e9680de9f4b) ── [546 MCQs]
│   │   ├── MCQ 2 (custom-topic-1793306683981-h86ms) ── [0 MCQs]
│   │   └── MCQ 3 (custom-topic-1793306697578-t3ce7) ── [0 MCQs]
│   └── राजस्थान के मुख्य समाचार पत्र (custom-ch-1793308288015-junr4)
├── 2. राजस्थान का भूगोल (subj-1793126120889-0jzu2)
│   ├── विस्तार एवं स्थिति (custom-ch-1793196395934-v2yex)
│   ├── भौतिक प्रदेश (custom-ch-1793170570488-95wl6)
│   ├── अपवाह तंत्र और नदियां (custom-ch-1793631882188-aw7g0)
│   ├── राजस्थान की मिट्टी (custom-ch-1793686604671-16qca)
│   ├── सिंचाई परियोजनाएं (custom-ch-1793691805813-wj58c) ── [Target for 262 Qs]
│   ├── वन संपदा (custom-ch-1793722070182-fh7bn)
│   ├── वन्य जीव (custom-ch-1793808219116-u7vwa)
│   └── कृषि जलवायु प्रदेश (custom-ch-1793890002003-y0cfs)
├── 3. राजस्थान की अर्थव्यवस्था (subj-1793126301974-it6mm)
│   ├── INDUSTRY (custom-ch-1793205795234-q2qgn)
│   └── कृषि एवं संबद्ध क्षेत्र (custom-ch-1793972492646-jg9yy)
├── 4. राजस्थान कला एवं संस्कृति (subj-1793126281086-96tzj)
│   └── [Chapters Pending Provisioning]
└── 5. समसामयिक घटनाएँ (subj-1793126332353-e3dxj)
    └── [Chapters Pending Provisioning]
```

---

## 3. Comprehensive Subject Breakdown

| Subject ID | Subject Name | Hindi Title | Chapters | Topics | Active MCQs | Archival MCQs Available |
|---|---|---|---|---|---|---|
| `subj-1793114550283-wpeqo` | Rajasthan History | राजस्थान का इतिहास | 4 | 16 | 546 | 0 |
| `subj-1793126120889-0jzu2` | Rajasthan Geography | राजस्थान का भूगोल | 8 | 33 | 0 | 262 (Irrigation/RSLP) |
| `subj-1793126301974-it6mm` | Rajasthan Economy | राजस्थान की अर्थव्यवस्था | 2 | 8 | 0 | In Archival Staging |
| `subj-1793126281086-96tzj` | Art & Culture | राजस्थान कला एवं संस्कृति | 0 | 0 | 0 | Requires Syllabus Seed |
| `subj-1793126332353-e3dxj` | Current Affairs | समसामयिक घटनाएँ | 0 | 0 | 0 | Monthly Digest Seed |
| **Total** | - | - | **14** | **57** | **546** | **262 Available** |

---

## 4. Foreign Key Relational Integrity Analysis

Every question in the active database was checked against the subject, chapter, and topic lookup maps:

1. **Subject Foreign Key (`subjectId`):**
   - 546 questions contain `subjectId: "subj-1793114550283-wpeqo"`.
   - Integrity: **100% Valid**. Matches subject *राजस्थान का इतिहास*.
2. **Chapter Foreign Key (`chapterId`):**
   - 546 questions contain `chapterId: "custom-ch-1793292191934-f9c1l"`.
   - Integrity: **100% Valid**. Matches chapter *प्रजामंडल*.
3. **Topic Foreign Key (`topicId`):**
   - 546 questions contain `topicId: "topic_1b890441-cad7-4e64-82db-4e9680de9f4b"`.
   - Integrity: **100% Valid**. Matches topic *MCQ 1 (MCQ 01)*.
4. **Orphaned Question Count:**
   - Active Content: **0 orphaned questions**.
   - Test Reference Stubs: **30 records** lacking all three foreign keys.

---

## 5. Stale / Archival Question Bank Mapping (262 Questions)

In Phase 4, 262 questions were isolated in `backups/phase4_262_stale_questions_backup.json` to preserve database integrity during curriculum refactoring. An audit of their relational fields reveals:

- **Target Subject:** `subj-1793126120889-0jzu2` (*राजस्थान का भूगोल*)
- **Target Chapter:** `custom-ch-1793691805813-wj58c` (*सिंचाई परियोजनाएं*)
- **Target Topics:**
  - `custom-topic-1793693900482-xpvow` (*RSLP & Livelihood Projects*)
  - `custom-topic-1793959456575-1gugi` (*Canal Irrigation Systems*)
- **Status:** **100% Structurally Intact.** These 262 questions feature complete question statements, options, answer keys, and explanations. Re-attaching them to Chapter `custom-ch-1793691805813-wj58c` will immediately expand the active functional question count from 546 to 808 without writing new content.

---

## 6. Actionable Hierarchy Recommendations

1. **Topic Redistribution for Prajamandal:** Currently, all 546 questions reside under a single topic (`MCQ 1`). Subdivide these 546 questions logically across:
   - *MCQ 1:* मेवाड़, मारवाड़, बीकानेर प्रजामंडल (180 questions)
   - *MCQ 2:* जयपुर, कोटा, बूंदी, अलवर प्रजामंडल (180 questions)
   - *MCQ 3:* डूंगरपुर, बांसवाड़ा, सिरोही, झालावाड़ एवं अन्य (186 questions)
2. **Re-activate 262 Irrigation Questions:** Connect `phase4_262_stale_questions_backup.json` to `custom-ch-1793691805813-wj58c` (*सिंचाई परियोजनाएं*) in the next scheduled snapshot release (v2).
3. **Seed Art & Culture Chapters:** Add core standard chapters (दुर्ग एवं किले, लोक देवता, हस्तकला, मेले एवं त्योहार) under `subj-1793126281086-96tzj`.
