import json
import os
import hashlib
from datetime import datetime
from art_culture_questions import ALL_ART_QUESTIONS
from economy_and_current_questions import ECONOMY_QUESTIONS, CURRENT_AFFAIRS_QUESTIONS

def compute_sha256(data_bytes):
    return hashlib.sha256(data_bytes).hexdigest()

# 1. Load existing data
with open('education-content/snapshots/v1/content.json', 'r', encoding='utf-8') as f:
    orig_snap = json.load(f)

with open('backups/phase4_262_stale_questions_backup.json', 'r', encoding='utf-8') as f:
    stale_262 = json.load(f)

# Subjects
SUBJECTS = [
    {
        "id": "subj-1793114550283-wpeqo",
        "name": "राजस्थान का इतिहास",
        "hindiName": "राजस्थान का इतिहास",
        "description": "प्राचीन सभ्यताएं, प्रमुख राजवंश, प्रजामंडल आंदोलन, 1857 की क्रांति एवं राजस्थान का एकीकरण",
        "icon": "history",
        "color": "#8B1E3F",
        "order": 1,
        "updatedAt": "2026-11-16T00:00:00.000Z"
    },
    {
        "id": "subj-1793126120889-0jzu2",
        "name": "राजस्थान का भूगोल",
        "hindiName": "राजस्थान का भूगोल",
        "description": "भौतिक स्वरूप, जलवायु, अपवाह तंत्र, वन संपदा, वन्य जीव अभयारण्य, कृषि एवं सिंचाई परियोजनाएं",
        "icon": "map",
        "color": "#102F65",
        "order": 2,
        "updatedAt": "2026-11-16T00:00:00.000Z"
    },
    {
        "id": "subj-1793126281086-96tzj",
        "name": "राजस्थान कला एवं संस्कृति",
        "hindiName": "राजस्थान कला एवं संस्कृति",
        "description": "प्रमुख दुर्ग, महल, लोक देवता-देवियां, मेले-त्योहार, चित्रकला, हस्तशिल्प, लोक नृत्य व संगीत",
        "icon": "palette",
        "color": "#D47311",
        "order": 3,
        "updatedAt": "2026-11-16T00:00:00.000Z"
    },
    {
        "id": "subj-1793126301974-it6mm",
        "name": "राजस्थान की अर्थव्यवस्था",
        "hindiName": "राजस्थान की अर्थव्यवस्था",
        "description": "उद्योग, खनिज, ऊर्जा संसाधन, कृषि परिदृश्य, आर्थिक समीक्षा एवं वित्तीय नीतियां",
        "icon": "trending-up",
        "color": "#2A7B4C",
        "order": 4,
        "updatedAt": "2026-11-16T00:00:00.000Z"
    },
    {
        "id": "subj-1793126332353-e3dxj",
        "name": "समसामयिक घटनाएँ",
        "hindiName": "समसामयिक घटनाएँ",
        "description": "राजस्थान समसामयिकी, नवीनतम फ्लैगशिप योजनाएं, चर्चित व्यक्तित्व, खेलकूद एवं पुरस्कार",
        "icon": "newspaper",
        "color": "#6B21A8",
        "order": 5,
        "updatedAt": "2026-11-16T00:00:00.000Z"
    }
]

# Chapters
existing_chapters = [c for c in orig_snap['chapters']]
existing_topics = [t for t in orig_snap['topics']]

ART_CHAPTERS = [
    {
        "id": "ch_raj_art_arch",
        "subjectId": "subj-1793126281086-96tzj",
        "title": "दुर्ग, महल एवं स्थापत्य कला",
        "hindiTitle": "दुर्ग, महल एवं स्थापत्य कला",
        "number": 1,
        "topics": []
    },
    {
        "id": "ch_raj_folk_deities",
        "subjectId": "subj-1793126281086-96tzj",
        "title": "लोक देवता एवं लोक देवियाँ",
        "hindiTitle": "लोक देवता एवं लोक देवियाँ",
        "number": 2,
        "topics": []
    },
    {
        "id": "ch_raj_fairs_festivals",
        "subjectId": "subj-1793126281086-96tzj",
        "title": "मेले एवं त्योहार",
        "hindiTitle": "मेले एवं त्योहार",
        "number": 3,
        "topics": []
    },
    {
        "id": "ch_raj_paintings_crafts",
        "subjectId": "subj-1793126281086-96tzj",
        "title": "चित्रकला शैलियाँ एवं हस्तशिल्प",
        "hindiTitle": "चित्रकला शैलियाँ एवं हस्तशिल्प",
        "number": 4,
        "topics": []
    },
    {
        "id": "ch_raj_folk_culture",
        "subjectId": "subj-1793126281086-96tzj",
        "title": "लोक नृत्य, लोक नाट्य एवं वाद्ययंत्र",
        "hindiTitle": "लोक नृत्य, लोक नाट्य एवं वाद्ययंत्र",
        "number": 5,
        "topics": []
    },
    {
        "id": "ch_raj_saints_sects",
        "subjectId": "subj-1793126281086-96tzj",
        "title": "संत, संप्रदाय एवं साहित्य",
        "hindiTitle": "संत, संप्रदाय एवं साहित्य",
        "number": 6,
        "topics": []
    }
]

ART_TOPICS = [
    {"id": "top_raj_forts_arch", "chapterId": "ch_raj_art_arch", "subjectId": "subj-1793126281086-96tzj", "title": "प्रमुख दुर्ग एवं स्थापत्य", "hindiTitle": "प्रमुख दुर्ग एवं स्थापत्य", "number": 1},
    {"id": "top_raj_palaces_monuments", "chapterId": "ch_raj_art_arch", "subjectId": "subj-1793126281086-96tzj", "title": "महल, हवेलियाँ एवं छतरियाँ", "hindiTitle": "महल, हवेलियाँ एवं छतरियाँ", "number": 2},
    {"id": "top_raj_panchpeer", "chapterId": "ch_raj_folk_deities", "subjectId": "subj-1793126281086-96tzj", "title": "पंचपीर एवं प्रमुख लोक देवता", "hindiTitle": "पंचपीर एवं प्रमुख लोक देवता", "number": 1},
    {"id": "top_raj_folk_goddesses", "chapterId": "ch_raj_folk_deities", "subjectId": "subj-1793126281086-96tzj", "title": "राजस्थान की प्रमुख लोक देवियाँ", "hindiTitle": "राजस्थान की प्रमुख लोक देवियाँ", "number": 2},
    {"id": "top_raj_festivals", "chapterId": "ch_raj_fairs_festivals", "subjectId": "subj-1793126281086-96tzj", "title": "पारंपरिक एवं धार्मिक त्योहार", "hindiTitle": "पारंपरिक एवं धार्मिक त्योहार", "number": 1},
    {"id": "top_raj_fairs", "chapterId": "ch_raj_fairs_festivals", "subjectId": "subj-1793126281086-96tzj", "title": "प्रसिद्ध पशु एवं सांस्कृतिक मेले", "hindiTitle": "प्रसिद्ध पशु एवं सांस्कृतिक मेले", "number": 2},
    {"id": "top_raj_paintings", "chapterId": "ch_raj_paintings_crafts", "subjectId": "subj-1793126281086-96tzj", "title": "राजस्थानी चित्रकला शैलियाँ", "hindiTitle": "राजस्थानी चित्रकला शैलियाँ", "number": 1},
    {"id": "top_raj_handicrafts", "chapterId": "ch_raj_paintings_crafts", "subjectId": "subj-1793126281086-96tzj", "title": "हस्तकलाएं, वस्त्र एवं आभूषण", "hindiTitle": "हस्तकलाएं, वस्त्र एवं आभूषण", "number": 2},
    {"id": "top_raj_dance", "chapterId": "ch_raj_folk_culture", "subjectId": "subj-1793126281086-96tzj", "title": "राजस्थान के प्रमुख लोक नृत्य", "hindiTitle": "राजस्थान के प्रमुख लोक नृत्य", "number": 1},
    {"id": "top_raj_instruments", "chapterId": "ch_raj_folk_culture", "subjectId": "subj-1793126281086-96tzj", "title": "लोक वाद्ययंत्र एवं लोक संगीत", "hindiTitle": "लोक वाद्ययंत्र एवं लोक संगीत", "number": 2},
    {"id": "top_raj_heritage_inst", "chapterId": "ch_raj_folk_culture", "subjectId": "subj-1793126281086-96tzj", "title": "सांस्कृतिक संस्थाएं एवं लोक नाट्य", "hindiTitle": "सांस्कृतिक संस्थाएं एवं लोक नाट्य", "number": 3},
    {"id": "top_raj_saints", "chapterId": "ch_raj_saints_sects", "subjectId": "subj-1793126281086-96tzj", "title": "प्रमुख संत एवं धार्मिक संप्रदाय", "hindiTitle": "प्रमुख संत एवं धार्मिक संप्रदाय", "number": 1},
    {"id": "top_raj_literature", "chapterId": "ch_raj_saints_sects", "subjectId": "subj-1793126281086-96tzj", "title": "राजस्थानी भाषा, बोलियां एवं साहित्य", "hindiTitle": "राजस्थानी भाषा, बोलियां एवं साहित्य", "number": 2}
]

CURRENT_CHAPTERS = [
    {
        "id": "ch_current_raj",
        "subjectId": "subj-1793126332353-e3dxj",
        "title": "राजस्थान समसामयिकी एवं फ्लैगशिप योजनाएँ",
        "hindiTitle": "राजस्थान समसामयिकी एवं फ्लैगशिप योजनाएँ",
        "number": 1,
        "topics": []
    },
    {
        "id": "ch_current_nat_intl",
        "subjectId": "subj-1793126332353-e3dxj",
        "title": "राष्ट्रीय एवं अंतर्राष्ट्रीय परिदृश्य",
        "hindiTitle": "राष्ट्रीय एवं अंतर्राष्ट्रीय परिदृश्य",
        "number": 2,
        "topics": []
    }
]

CURRENT_TOPICS = [
    {"id": "top_current_schemes", "chapterId": "ch_current_raj", "subjectId": "subj-1793126332353-e3dxj", "title": "नवीनतम योजनाएँ एवं नीतियाँ", "hindiTitle": "नवीनतम योजनाएँ एवं नीतियाँ", "number": 1},
    {"id": "top_current_events", "chapterId": "ch_current_raj", "subjectId": "subj-1793126332353-e3dxj", "title": "चर्चित व्यक्तित्व, पुरस्कार एवं खेल", "hindiTitle": "चर्चित व्यक्तित्व, पुरस्कार एवं खेल", "number": 2},
    {"id": "top_current_nat", "chapterId": "ch_current_nat_intl", "subjectId": "subj-1793126332353-e3dxj", "title": "राष्ट्रीय घटनाक्रम एवं अंतर्राष्ट्रीय सम्मेलन", "hindiTitle": "राष्ट्रीय घटनाक्रम एवं अंतर्राष्ट्रीय सम्मेलन", "number": 1}
]

all_chapters = existing_chapters + ART_CHAPTERS + CURRENT_CHAPTERS
all_topics = existing_topics + ART_TOPICS + CURRENT_TOPICS

# Helper to normalize MCQ
def make_canonical_mcq(q):
    d = q.get('data', q)
    q_id = q.get('id') or d.get('id')
    text = d.get('text') or d.get('question') or ''
    options = d.get('options') or []
    correct_idx = d.get('correctIndex')
    if isinstance(correct_idx, str):
        try:
            correct_idx = int(correct_idx)
        except:
            correct_idx = 0
    elif not isinstance(correct_idx, int):
        correct_idx = 0
    
    explanation = d.get('explanation') or ''
    subject_id = d.get('subjectId') or ''
    chapter_id = d.get('chapterId') or ''
    topic_id = d.get('topicId') or d.get('topic') or ''
    updated_at = d.get('updatedAt') or '2026-11-16T00:00:00.000Z'
    is_user_added = bool(d.get('isUserAdded', False))

    mcq_data = {
        "id": q_id,
        "text": text,
        "options": options,
        "correctIndex": correct_idx,
        "explanation": explanation,
        "subjectId": subject_id,
        "chapterId": chapter_id,
        "topicId": topic_id,
        "isUserAdded": is_user_added,
        "updatedAt": updated_at
    }

    # Dual format: flat properties AND nested 'data' + 'collection' for 100% compatibility
    return {
        "id": q_id,
        "collection": "mcqs",
        "text": text,
        "options": options,
        "correctIndex": correct_idx,
        "explanation": explanation,
        "subjectId": subject_id,
        "chapterId": chapter_id,
        "topicId": topic_id,
        "isUserAdded": is_user_added,
        "updatedAt": updated_at,
        "data": mcq_data
    }

unified_mcqs = []
seen_ids = set()

# 1. Add valid history MCQs from original snapshot
for m in orig_snap['mcqs']:
    d = m.get('data', m)
    txt = d.get('text') or d.get('question')
    opts = d.get('options')
    if txt and isinstance(opts, list) and len(opts) >= 2:
        can = make_canonical_mcq(m)
        if can['id'] not in seen_ids:
            seen_ids.add(can['id'])
            unified_mcqs.append(can)

print(f"Added History MCQs: {len(unified_mcqs)}")

# 2. Add 262 geography MCQs
geo_count = 0
for r in stale_262['records']:
    m = r.get('mcqsRecord') or r.get('questionsRecord')
    if m:
        txt = m.get('text') or m.get('question')
        opts = m.get('options')
        if txt and isinstance(opts, list) and len(opts) >= 2:
            can = make_canonical_mcq(m)
            # Ensure subject is Rajasthan Geography
            can['subjectId'] = 'subj-1793126120889-0jzu2'
            can['data']['subjectId'] = 'subj-1793126120889-0jzu2'
            if can['id'] not in seen_ids:
                seen_ids.add(can['id'])
                unified_mcqs.append(can)
                geo_count += 1

print(f"Added Geography MCQs: {geo_count}")

# 3. Add Art & Culture MCQs
art_count = 0
for m in ALL_ART_QUESTIONS:
    can = make_canonical_mcq(m)
    if can['id'] not in seen_ids:
        seen_ids.add(can['id'])
        unified_mcqs.append(can)
        art_count += 1

print(f"Added Art & Culture MCQs: {art_count}")

# 4. Add Economy MCQs
eco_count = 0
for m in ECONOMY_QUESTIONS:
    can = make_canonical_mcq(m)
    if can['id'] not in seen_ids:
        seen_ids.add(can['id'])
        unified_mcqs.append(can)
        eco_count += 1

print(f"Added Economy MCQs: {eco_count}")

# 5. Add Current Affairs MCQs
curr_count = 0
for m in CURRENT_AFFAIRS_QUESTIONS:
    can = make_canonical_mcq(m)
    if can['id'] not in seen_ids:
        seen_ids.add(can['id'])
        unified_mcqs.append(can)
        curr_count += 1

print(f"Added Current Affairs MCQs: {curr_count}")
print(f"Total Unified MCQs: {len(unified_mcqs)}")

# Build full snapshot object
now_iso = datetime.utcnow().isoformat() + "Z"
full_snapshot = {
    "schemaVersion": 2,
    "snapshotVersion": 2,
    "publishedAt": now_iso,
    "subjects": SUBJECTS,
    "chapters": all_chapters,
    "topics": all_topics,
    "mcqs": unified_mcqs
}

full_snap_json = json.dumps(full_snapshot, ensure_ascii=False, indent=2)
full_checksum = compute_sha256(full_snap_json.encode('utf-8'))

# Chunk MCQs into 200 items each
CHUNK_SIZE = 200
chunks_meta = []
total_chunks = (len(unified_mcqs) + CHUNK_SIZE - 1) // CHUNK_SIZE

# Ensure target directories exist
for d in ['education-content/snapshots/v1', 'education-content/snapshots/v2', 'public/api/snapshots/v1', 'public/api/snapshots/v2', 'education-content/manifests', 'education-content/checksums']:
    os.makedirs(d, exist_ok=True)

# Write chunk files
for i in range(total_chunks):
    start = i * CHUNK_SIZE
    end = start + CHUNK_SIZE
    chunk_items = unified_mcqs[start:end]

    chunk_obj = {
        "chunkIndex": i,
        "snapshotVersion": 2,
        "mcqs": chunk_items
    }
    if i == 0:
        chunk_obj["subjects"] = SUBJECTS
        chunk_obj["chapters"] = all_chapters
        chunk_obj["topics"] = all_topics

    chunk_json = json.dumps(chunk_obj, ensure_ascii=False)
    chunk_checksum = compute_sha256(chunk_json.encode('utf-8'))
    chunk_filename = f"chunk-{i}.json"

    # Write to v1, v2 and public/
    for base in ['education-content/snapshots/v1', 'education-content/snapshots/v2', 'public/api/snapshots/v1', 'public/api/snapshots/v2']:
        with open(os.path.join(base, chunk_filename), 'w', encoding='utf-8') as f:
            f.write(chunk_json)

    chunks_meta.append({
        "chunkIndex": i,
        "url": f"/api/snapshots/v1/{chunk_filename}",
        "checksum": chunk_checksum,
        "itemCount": len(chunk_items)
    })

# Write full content.json to v1, v2, public/
for base in ['education-content/snapshots/v1', 'education-content/snapshots/v2', 'public/api/snapshots/v1', 'public/api/snapshots/v2']:
    with open(os.path.join(base, 'content.json'), 'w', encoding='utf-8') as f:
        f.write(full_snap_json)

# Build manifest
manifest = {
    "schemaVersion": 2,
    "snapshotVersion": 2,
    "previousSnapshotVersion": 1,
    "curriculumVersion": 2,
    "mcqVersion": 2,
    "publishedAt": now_iso,
    "snapshotUrl": "/api/snapshots/v1/content.json",
    "checksum": full_checksum,
    "status": "published",
    "totalMcqs": len(unified_mcqs),
    "totalSubjects": len(SUBJECTS),
    "totalChapters": len(all_chapters),
    "totalTopics": len(all_topics),
    "chunks": chunks_meta
}

with open('education-content/manifests/current.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

checksum_info = {
    "snapshotVersion": 2,
    "checksum": full_checksum,
    "chunks": chunks_meta
}

with open('education-content/checksums/v1.json', 'w', encoding='utf-8') as f:
    json.dump(checksum_info, f, ensure_ascii=False, indent=2)

with open('education-content/checksums/v2.json', 'w', encoding='utf-8') as f:
    json.dump(checksum_info, f, ensure_ascii=False, indent=2)

print(f"SUCCESS: Snapshot v2 published with {len(unified_mcqs)} MCQs across {len(SUBJECTS)} subjects, {len(all_chapters)} chapters, and {len(all_topics)} topics!")
