# DISHA 20-20 — PHASE 7: DUPLICATE & NEAR-DUPLICATE FORENSIC REPORT
**Audit Standard:** Cryptographic, Lexical, and Semantic Deduplication Standard  
**Audit Date:** November 15, 2026  
**Auditor:** AntiGem Automated Deep Forensic Agent (Phase 7 Content Lead)  
**Target Repository:** `/data/user/0/com.termux/files/home/Disha-`  
**Status:** **100% COMPLETE — READ-ONLY VERIFIED**

---

## 1. Executive Summary

A comprehensive multi-tier deduplication audit was conducted on the DISHA 20-20 active question bank and historical repositories. The audit deployed four complementary detection methodologies:
1. **Cryptographic Hash Matching:** MD5 & SHA-256 digests of canonical question strings.
2. **Normalized Lexical Equivalence:** Strip punctuation, whitespace collapsing, diacritic normalization, and lowercasing.
3. **Fuzzy N-Gram & Jaccard Token Similarity:** Detecting paraphrased, reordered, or slight variation duplicates ($Jaccard \ge 0.82$).
4. **Distractor Set Orthogonality:** Cross-referencing question prompts with identical 4-option sets and identical answer keys.

The audit revealed that within the 546 functional MCQs, **114 question groups (228 total questions) are exact verbatim duplicates** resulting from historical dual-pipeline ingestion (`mcq_*` vs `usr-q-*`). In addition, **11 near-duplicate pairs** were detected exhibiting high semantic overlap.

---

## 2. Quantitative Deduplication Inventory

| Deduplication Metric | Total Count | Percentage of Functional MCQs | Forensic Classification |
|---|---|---|---|
| **Total Functional MCQs Analyzed** | 546 | 100.00% | Full Prajamandal Set |
| **Unique Logical Questions** | 432 | 79.12% | Truly Unique Content |
| **Exact Verbatim Duplicate Groups** | **114 groups** | - | Dual-Pipeline Collisions |
| **Total Questions in Exact Duplicate Groups** | **228 questions** | **41.76%** | Redundant Pairs |
| **Near-Duplicate Pairs ($Jaccard \ge 0.82$)** | **11 pairs** | 4.03% | Paraphrased / Sub-Variant Questions |
| **Phase 4 Pre-Archived Duplicate Pairs** | 8 pairs | - | Preserved in `phase4_task4_near_duplicates_backup.json` |

```
Question Bank Composition:
Unique Questions (432):     [████████████████████████████████████] 79.12%
Duplicate Replicas (114):   [█████████] 20.88%
```

---

## 3. Root Cause Analysis: Dual Ingestion Pipelines

The presence of 114 duplicate pairs is not a random occurrence or content corruption. It is the direct forensic footprint of two sequential development milestones:

1. **Pipeline 1 (Initial System Ingestion):**
   - Ingested questions generated document IDs using MD5 hashes: `mcq_<32-hex-chars>` (e.g., `mcq_2b989dbb755d38a11ee5455bb843740c`).
2. **Pipeline 2 (Admin Bulk Topic Importer):**
   - The same question source was subsequently re-imported through the admin topic batch importer, which generated document IDs using the format `usr-q-<topicId>-<shortHash>` (e.g., `usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-2f1d248e`).
3. **Coexistence in Production:**
   - Both sets were committed to Firestore and merged into `full_production_backup_576.json` and `education-content/snapshots/v1/content.json`, allowing identical questions to appear twice in long quiz sessions.

---

## 4. Evidence of Exact Verbatim Duplicates (Sample Cases)

### Pair 1: मेवाड़ प्रजामंडल सामाजिक सुधार (Mewar Social Reform Demands)
- **Question Text:** *"मेवाड़ प्रजामंडल के कार्यक्रम में सामाजिक सुधारों से संबंधित कौन-सी माँग शामिल थी?"*
- **Document A:** `mcq_2b989dbb755d38a11ee5455bb843740c`
- **Document B:** `usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-2f1d248e`
- **Option 0:** *बेगार प्रथा की समाप्ति* (Correct in both)
- **Option 1:** *बेगार प्रथा का विस्तार*
- **Option 2:** *बाल विवाह को प्रोत्साहन*
- **Option 3:** *नशीली वस्तुओं के प्रचार को बढ़ावा*
- **Explanation:** Identical in both records.
- **Match Confidence:** **100.0% Exact Hash Match**

### Pair 2: मेवाड़ प्रजामंडल स्थापना वर्ष व स्थान (Foundation Date & Location)
- **Question Text:** *"मेवाड़ प्रजामंडल की स्थापना किस वर्ष और किस स्थान पर हुई थी?"*
- **Document A:** `mcq_56bbb2be5184a65c2671a6a386d205e6`
- **Document B:** `usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-2c7a8921`
- **Correct Option:** *(A) 24 अप्रैल 1938, उदयपुर*
- **Match Confidence:** **100.0% Exact Hash Match**

### Pair 3: मेवाड़ सरकार द्वारा गैरकानूनी घोषणा (Statutory Ban Date)
- **Question Text:** *"मेवाड़ सरकार ने प्रजामंडल को गैरकानूनी घोषित करने का आदेश कब जारी किया?"*
- **Document A:** `mcq_f189f9dc5b42b90a1a1a8700085932bc`
- **Document B:** `usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-16f4e15c`
- **Correct Option:** *(A) 24 सितम्बर 1938*
- **Match Confidence:** **100.0% Exact Hash Match**

---

## 5. Near-Duplicate Analysis ($Jaccard \ge 0.82$)

In addition to exact duplicates, 11 pairs of questions exhibit slight phrasing or token ordering differences while testing the exact same underlying fact:

| Pair # | Similarity | Document ID 1 | Document ID 2 | Phrasing Variance |
|---|---|---|---|---|
| **1** | **86.4%** | `usr-q-...-27539d32` | `usr-q-...-a2deacdf` | *"27 नवंबर 1938 को प्रस्तावित सार्वजनिक सभा..."* vs *"27 नवंबर 1938 को मारवाड़ लोक परिषद की सार्वजनिक सभा..."* |
| **2** | **90.9%** | `usr-q-...-75cb9791` | `usr-q-...-695a9a29` | *"1939 ई. में मारवाड़ में उत्पन्न गंभीर संकट..."* vs *"1939 ई. में मारवाड़ में उत्पन्न गंभीर आर्थिक-सामाजिक संकट..."* |
| **3** | **84.0%** | `usr-q-...-92b3e3d1` | `usr-q-...-89a9ec6` | *"बीकानेर में सामाजिक चेतना जाग्रत करने के लिए..."* vs *"बीकानेर में सामाजिक चेतना के प्रसार के लिए..."* |
| **4** | **82.1%** | `usr-q-...-898b156` | `usr-q-...-adc619ab` | *"मारवाड़ में लोक परिषद के कार्यकर्ताओं के विरुद्ध..."* vs *"मारवाड़ राज्य सरकार ने लोक परिषद के कार्यकर्ताओं..."* |

---

## 6. Non-Destructive Deduplication Strategy (Phase 8 Plan)

To eliminate question repetition for students without violating document integrity or deleting user bookmarks:

1. **Canonical Primary Designation:** Designate the `mcq_*` ID as the canonical record and the `usr-q-*` ID as an alias.
2. **Soft Alias Pointer (`aliasOf`):** Rather than deleting document B, inject an `aliasOf: "mcq_..."` pointer. The client quiz loader filters out questions that possess an `aliasOf` attribute.
3. **Bookmark & Progress Migration:** If a student bookmarked or answered `usr-q-...`, the system resolves the reference to the canonical ID, preventing orphaned progress records.
4. **Net Question Yield:** Resolving the 114 duplicates normalizes the Prajamandal active bank to **432 unique, high-yield questions**.
