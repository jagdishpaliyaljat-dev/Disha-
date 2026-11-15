#!/usr/bin/env python3
"""
DISHA 20-20 Phase 7 MCQ Content Intelligence & Quality Audit Script
Reads all question datasets, backups, and curriculum trees without modifying any data.
Produces structured forensic results for all 12 audit reports.
"""

import os
import re
import json
import hashlib
from collections import defaultdict, Counter

PROJECT_ROOT = "/data/user/0/com.termux/files/home/Disha-"

def load_json(rel_path):
    full_path = os.path.join(PROJECT_ROOT, rel_path)
    if not os.path.exists(full_path):
        return None
    with open(full_path, "r", encoding="utf-8") as f:
        return json.load(f)

def normalize_text(text):
    if not text:
        return ""
    # remove punctuation, excessive whitespace, normalize unicode
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip().lower()

def compute_similarity(s1, s2):
    w1 = set(s1.split())
    w2 = set(s2.split())
    if not w1 or not w2:
        return 0.0
    return len(w1 & w2) / len(w1 | w2)

def run_audit():
    print("Starting DISHA 20-20 Phase 7 Content Audit...")

    # 1. Load All Datasets
    snap = load_json("education-content/snapshots/v1/content.json")
    chunk0 = load_json("education-content/snapshots/v1/chunk-0.json")
    chunk1 = load_json("education-content/snapshots/v1/chunk-1.json")
    chunk2 = load_json("education-content/snapshots/v1/chunk-2.json")
    full_prod = load_json("full_production_backup_576.json")
    prajamandal = load_json("prajamandal_backup.json")
    phase2_backup = load_json("backups/phase2_verified_production_backup.json")
    phase4_stale = load_json("backups/phase4_262_stale_questions_backup.json")
    phase4_task2 = load_json("backups/phase4_task2_curriculum_and_19_questions_backup.json")
    phase4_near_dups = load_json("backups/phase4_task4_near_duplicates_backup.json")
    recovery_manifest = load_json("recovery_manifest.json")

    # Canonical snapshot data
    subjects = snap.get("subjects", [])
    chapters = snap.get("chapters", [])
    topics = snap.get("topics", [])
    raw_mcqs = snap.get("mcqs", [])

    # Normalise canonical mcqs
    mcqs = []
    for item in raw_mcqs:
        if "data" in item:
            d = dict(item["data"])
            d["_doc_id"] = item.get("id", d.get("id"))
            mcqs.append(d)
        else:
            mcqs.append(item)

    print(f"Loaded canonical snapshot: {len(subjects)} subjects, {len(chapters)} chapters, {len(topics)} topics, {len(mcqs)} MCQs.")

    # 2. Inventory Metrics
    inventory = {
        "canonical_snapshot_576": len(mcqs),
        "chunk0_mcqs": len(chunk0.get("mcqs", [])) if chunk0 else 0,
        "chunk1_mcqs": len(chunk1.get("mcqs", [])) if chunk1 else 0,
        "chunk2_mcqs": len(chunk2.get("mcqs", [])) if chunk2 else 0,
        "full_production_backup": len(full_prod.get("records", [])) if full_prod else 0,
        "prajamandal_backup": len(prajamandal.get("mcqs", [])) if prajamandal else 0,
        "phase2_verified_backup": len(phase2_backup.get("mcqs", [])) if phase2_backup else 0,
        "phase4_stale_backup": len(phase4_stale.get("records", [])) if phase4_stale else 0,
        "recovery_manifest": len(recovery_manifest.get("manifest", [])) if recovery_manifest else 0,
    }

    # Cross-reference IDs
    canonical_ids = set(m.get("id") or m.get("_doc_id") for m in mcqs)
    phase2_ids = set(phase2_backup.get("mcqIds", [])) if phase2_backup else set()
    full_prod_ids = set(r.get("id") for r in full_prod.get("records", [])) if full_prod else set()
    prajamandal_ids = set(m.get("id") for m in prajamandal.get("mcqs", [])) if prajamandal else set()
    stale_ids = set(r.get("id") for r in phase4_stale.get("records", [])) if phase4_stale else set()

    # 3. Hierarchy Mapping & Orphan Check
    subject_map = {s["id"]: s for s in subjects}
    chapter_map = {c["id"]: c for c in chapters}
    topic_map = {t["id"]: t for t in topics}

    orphaned_subject = []
    orphaned_chapter = []
    orphaned_topic = []
    valid_mapped = []

    questions_by_topic = defaultdict(list)
    questions_by_chapter = defaultdict(list)
    questions_by_subject = defaultdict(list)

    for q in mcqs:
        qid = q.get("id")
        sid = q.get("subjectId")
        cid = q.get("chapterId")
        tid = q.get("topicId")

        s_ok = sid in subject_map
        c_ok = cid in chapter_map
        t_ok = tid in topic_map

        if not s_ok:
            orphaned_subject.append((qid, sid))
        if not c_ok:
            orphaned_chapter.append((qid, cid))
        if not t_ok:
            orphaned_topic.append((qid, tid))

        if s_ok and c_ok and t_ok:
            valid_mapped.append(qid)

        questions_by_subject[sid].append(q)
        questions_by_chapter[cid].append(q)
        questions_by_topic[tid].append(q)

    # 4. Schema & Structure Validation
    schema_results = {
        "total": len(mcqs),
        "valid_schema": 0,
        "missing_text": 0,
        "empty_text": 0,
        "missing_options": 0,
        "invalid_options_count": 0,
        "empty_options": 0,
        "missing_correct_index": 0,
        "invalid_correct_index": 0,
        "missing_explanation": 0,
        "short_explanation": 0,  # < 20 chars
        "rich_explanation": 0,   # > 50 chars
        "missing_subject_id": 0,
        "missing_chapter_id": 0,
        "missing_topic_id": 0,
        "question_types": Counter(),
        "option_counts": Counter(),
        "correct_index_distribution": Counter(),
    }

    # Format classification: single_correct, assertion_reason, statement_based, match_list, math
    format_classification = {
        "single_correct": 0,
        "statement_based": 0,
        "assertion_reason": 0,
        "match_list": 0,
        "math_katex": 0,
    }

    # 5. Answer Accuracy & Explanation Alignment
    accuracy_results = {
        "explanation_confirms_correct": 0,
        "explanation_contradiction_suspect": 0,
        "explanation_neutral_or_brief": 0,
        "option_index_zero_based_verified": 0,
        "flagged_questions": [],
    }

    # 6. Duplicate Detection
    seen_exact = defaultdict(list)
    seen_norm = defaultdict(list)
    seen_hash = defaultdict(list)

    # 7. Language, Formatting, PYQ Authenticity
    lang_results = {
        "devanagari_count": 0,
        "pure_english_count": 0,
        "mixed_bilingual_count": 0,
        "contains_latex": 0,
        "corrupted_unicode": 0,
        "html_tags_present": 0,
    }

    pyq_results = {
        "explicit_pyq": 0,
        "inferred_pyq_by_explanation": 0,
        "practice_only": 0,
        "exam_provenance": Counter(),
        "year_distribution": Counter(),
    }

    # Detailed MCQ Loop
    for idx, q in enumerate(mcqs):
        qid = q.get("id", f"unknown_{idx}")
        text = q.get("text", "")
        options = q.get("options", [])
        correct_idx = q.get("correctIndex")
        explanation = q.get("explanation", "")
        q_type = q.get("questionType", "standard")

        # Schema checks
        if not text:
            schema_results["missing_text"] += 1
        elif len(text.strip()) == 0:
            schema_results["empty_text"] += 1

        if options is None or not isinstance(options, list):
            schema_results["missing_options"] += 1
        else:
            opt_len = len(options)
            schema_results["option_counts"][opt_len] += 1
            if opt_len != 4:
                schema_results["invalid_options_count"] += 1
            if any(not opt or not str(opt).strip() for opt in options):
                schema_results["empty_options"] += 1

        if correct_idx is None:
            schema_results["missing_correct_index"] += 1
        elif not isinstance(correct_idx, int) or correct_idx < 0 or (options and correct_idx >= len(options)):
            schema_results["invalid_correct_index"] += 1
        else:
            schema_results["correct_index_distribution"][correct_idx] += 1
            accuracy_results["option_index_zero_based_verified"] += 1

        if not explanation:
            schema_results["missing_explanation"] += 1
        elif len(explanation.strip()) < 20:
            schema_results["short_explanation"] += 1
        else:
            schema_results["rich_explanation"] += 1

        if not q.get("subjectId"):
            schema_results["missing_subject_id"] += 1
        if not q.get("chapterId"):
            schema_results["missing_chapter_id"] += 1
        if not q.get("topicId"):
            schema_results["missing_topic_id"] += 1

        # Format detection
        has_assertion = "कथन" in text and ("कारण" in text or "निष्कर्ष" in text)
        has_match = ("सूची" in text and ("सुमेलित" in text or "मिलान" in text)) or bool(q.get("matchData")) or bool(q.get("matchTable"))
        has_statements = ("निम्नलिखित कथनों पर विचार" in text or "कथन (1)" in text or "1." in text and "2." in text) and not has_assertion
        has_math = bool(re.search(r'[\$\\^_{}\[\]]|\\frac|\\sqrt', text + explanation))

        if has_assertion:
            format_classification["assertion_reason"] += 1
        elif has_match:
            format_classification["match_list"] += 1
        elif has_statements:
            format_classification["statement_based"] += 1
        elif has_math:
            format_classification["math_katex"] += 1
        else:
            format_classification["single_correct"] += 1

        # Language & Encoding checks
        has_hindi = bool(re.search(r'[\u0900-\u097F]', text))
        has_eng = bool(re.search(r'[a-zA-Z]', text))
        if has_hindi and has_eng:
            lang_results["mixed_bilingual_count"] += 1
        elif has_hindi:
            lang_results["devanagari_count"] += 1
        elif has_eng:
            lang_results["pure_english_count"] += 1

        if has_math:
            lang_results["contains_latex"] += 1

        # Check for HTML / Unicode artifacts (e.g. &nbsp;, &amp;, \uFFFD)
        if re.search(r'&[a-zA-Z]+;|&#\d+;|<[^>]+>', text + explanation):
            lang_results["html_tags_present"] += 1
        if "\ufffd" in text or "\ufffd" in explanation:
            lang_results["corrupted_unicode"] += 1

        # Explanation & Answer Alignment
        if isinstance(correct_idx, int) and options and 0 <= correct_idx < len(options):
            correct_opt_text = str(options[correct_idx]).strip()
            exp_text = explanation.strip()

            # Check if explanation references correct option or mentions other options
            norm_opt = normalize_text(correct_opt_text)
            norm_exp = normalize_text(exp_text)

            # Heuristic: does the correct option keyword appear in explanation?
            opt_words = [w for w in norm_opt.split() if len(w) > 3]
            matched_words = [w for w in opt_words if w in norm_exp]
            if len(opt_words) > 0 and len(matched_words) >= 1:
                accuracy_results["explanation_confirms_correct"] += 1
            else:
                accuracy_results["explanation_neutral_or_brief"] += 1

        # Duplicate tracking
        norm_t = normalize_text(text)
        h = hashlib.md5(norm_t.encode('utf-8')).hexdigest()
        seen_exact[text].append(qid)
        seen_norm[norm_t].append(qid)
        seen_hash[h].append(qid)

        # PYQ Analysis
        is_pyq = q.get("isPYQ", False)
        exam_tag = q.get("exam") or q.get("examName")
        year_tag = q.get("year") or q.get("examYear")

        # Also search explanation or text for exam patterns like "RAS Pre 2021", "REET 2022", "पटवार 2021"
        found_exam = None
        found_year = None
        for pattern in [
            r'(RAS|REET|पटवार|ग्राम सेवक|VDO|CET|Sub Inspector|SI|First Grade|Second Grade|Police Constable|LDC|High Court LDC)\s*(Pre|Mains)?\s*(\d{4})',
            r'(RPSC|RSMSSB)\s*(\w+)?\s*(\d{4})',
        ]:
            m_exp = re.search(pattern, text + " " + explanation, re.IGNORECASE)
            if m_exp:
                found_exam = m_exp.group(1)
                found_year = m_exp.group(len(m_exp.groups()))
                break

        if is_pyq or exam_tag or found_exam:
            if is_pyq or exam_tag:
                pyq_results["explicit_pyq"] += 1
            else:
                pyq_results["inferred_pyq_by_explanation"] += 1
            
            e_name = str(exam_tag or found_exam or "RPSC_Competitive").strip()
            y_name = str(year_tag or found_year or "Unknown").strip()
            pyq_results["exam_provenance"][e_name] += 1
            pyq_results["year_distribution"][y_name] += 1
        else:
            pyq_results["practice_only"] += 1

    # Exact duplicates
    exact_duplicates = {k: v for k, v in seen_exact.items() if len(v) > 1}
    norm_duplicates = {k: v for k, v in seen_norm.items() if len(v) > 1}

    # Near-duplicate pairwise scan (sample or thorough across normalized texts)
    near_duplicate_pairs = []
    norm_keys = list(seen_norm.keys())
    for i in range(len(norm_keys)):
        for j in range(i + 1, min(i + 35, len(norm_keys))):
            s1 = norm_keys[i]
            s2 = norm_keys[j]
            if abs(len(s1) - len(s2)) > 20:
                continue
            sim = compute_similarity(s1, s2)
            if 0.82 <= sim < 1.0:
                near_duplicate_pairs.append({
                    "q1": seen_norm[s1],
                    "q2": seen_norm[s2],
                    "similarity": round(sim, 3),
                    "text1": s1[:80],
                    "text2": s2[:80]
                })

    # Difficulty diversity
    difficulty_dist = Counter()
    for q in mcqs:
        d = q.get("difficulty", "unrated")
        difficulty_dist[d] += 1

    # Quality scoring calculation
    # Weights: Schema (25%), Answer Indexing & Integrity (25%), Explanation (20%),
    # Deduplication (15%), Hierarchy & Mapping (15%)
    schema_score = 100 * (1 - (schema_results["missing_text"] + schema_results["invalid_options_count"] + schema_results["invalid_correct_index"]) / (3 * len(mcqs)))
    answer_indexing_score = 100 * (accuracy_results["option_index_zero_based_verified"] / len(mcqs))
    explanation_score = 100 * (schema_results["rich_explanation"] / len(mcqs))
    dedup_score = 100 * (1 - (len(exact_duplicates) * 2) / len(mcqs))
    mapping_score = 100 * (len(valid_mapped) / len(mcqs))
    overall_quality_score = (
        0.25 * schema_score +
        0.25 * answer_indexing_score +
        0.20 * explanation_score +
        0.15 * dedup_score +
        0.15 * mapping_score
    )

    out = {
        "inventory": inventory,
        "canonical_ids_count": len(canonical_ids),
        "phase2_ids_count": len(phase2_ids),
        "full_prod_ids_count": len(full_prod_ids),
        "prajamandal_ids_count": len(prajamandal_ids),
        "hierarchy": {
            "total_subjects": len(subjects),
            "total_chapters": len(chapters),
            "total_topics": len(topics),
            "orphaned_subjects": len(orphaned_subject),
            "orphaned_chapters": len(orphaned_chapter),
            "orphaned_topics": len(orphaned_topic),
            "valid_mapped": len(valid_mapped),
            "subjects_breakdown": [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "hindiName": s.get("hindiName", ""),
                    "question_count": len(questions_by_subject[s["id"]]),
                    "chapters_count": len([c for c in chapters if c.get("subjectId") == s["id"]])
                } for s in subjects
            ],
            "chapters_breakdown": [
                {
                    "id": c["id"],
                    "title": c.get("title", ""),
                    "hindiTitle": c.get("hindiTitle", ""),
                    "subjectId": c.get("subjectId"),
                    "question_count": len(questions_by_chapter[c["id"]]),
                    "topics_count": len([t for t in topics if t.get("chapterId") == c["id"]])
                } for c in chapters
            ],
            "zero_question_topics": [
                {"id": t["id"], "title": t.get("title", ""), "hindiTitle": t.get("hindiTitle", ""), "chapterId": t.get("chapterId")}
                for t in topics if len(questions_by_topic[t["id"]]) == 0
            ],
            "topics_with_questions_count": len([t for t in topics if len(questions_by_topic[t["id"]]) > 0]),
            "total_topics_count": len(topics)
        },
        "schema": schema_results,
        "format_classification": format_classification,
        "accuracy": accuracy_results,
        "duplicates": {
            "exact_duplicate_groups": len(exact_duplicates),
            "exact_duplicate_examples": [
                {"text": k[:80], "ids": v} for k, v in list(exact_duplicates.items())[:5]
            ],
            "norm_duplicate_groups": len(norm_duplicates),
            "near_duplicate_pairs_found": len(near_duplicate_pairs),
            "near_duplicate_samples": near_duplicate_pairs[:5]
        },
        "difficulty": dict(difficulty_dist),
        "language": lang_results,
        "pyq": {
            "explicit_pyq": pyq_results["explicit_pyq"],
            "inferred_pyq": pyq_results["inferred_pyq_by_explanation"],
            "practice_only": pyq_results["practice_only"],
            "top_exams": pyq_results["exam_provenance"].most_common(10),
            "top_years": pyq_results["year_distribution"].most_common(10)
        },
        "quality_scores": {
            "schema_score": round(schema_score, 2),
            "answer_indexing_score": round(answer_indexing_score, 2),
            "explanation_score": round(explanation_score, 2),
            "dedup_score": round(dedup_score, 2),
            "mapping_score": round(mapping_score, 2),
            "overall_quality_score": round(overall_quality_score, 2)
        }
    }

    out_file = os.path.join(PROJECT_ROOT, "reports/phase7_audit_data.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"Audit completed successfully! Saved raw forensic data to: {out_file}")
    print(f"Overall Quality Score: {out['quality_scores']['overall_quality_score']} / 100")

if __name__ == "__main__":
    run_audit()
