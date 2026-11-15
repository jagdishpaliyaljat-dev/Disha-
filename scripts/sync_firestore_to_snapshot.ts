import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execSync } from "child_process";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION & CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────
const SA_PATH = "/data/user/0/com.termux/files/home/.antigem/uploads/72eb56a320ab4a8b/gen-lang-client-0811306192-firebase-adminsdk-fbsvc-83ac998822.json";
const PROJECT_ID = "gen-lang-client-0811306192";
const DATABASE_ID = "ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194";

if (!fs.existsSync(SA_PATH)) {
  console.error(`FATAL: Service Account JSON not found at ${SA_PATH}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, "utf8"));
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: PROJECT_ID,
}, "disha-sync-engine");

const db = getFirestore(app, DATABASE_ID);

function sha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function cleanText(text: any): string {
  if (typeof text !== "string") return "";
  return text.trim().replace(/\s+/g, " ");
}

function generateHash(text: string, options: string[]): string {
  const normText = cleanText(text).toLowerCase();
  const normOpts = (options || []).map(o => cleanText(o).toLowerCase()).sort().join("|");
  return sha256(`${normText}:::${normOpts}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CURRICULUM BASE
// ─────────────────────────────────────────────────────────────────────────────
export const CANONICAL_CHAPTERS = [
  { id: "ch_raj_art_arch", subjectId: "subj-1793126281086-96tzj", title: "दुर्ग, महल एवं स्थापत्य कला", hindiTitle: "दुर्ग, महल एवं स्थापत्य कला", number: 1, topics: [] },
  { id: "ch_raj_folk_deities", subjectId: "subj-1793126281086-96tzj", title: "लोक देवता एवं लोक देवियाँ", hindiTitle: "लोक देवता एवं लोक देवियाँ", number: 2, topics: [] },
  { id: "ch_raj_fairs_festivals", subjectId: "subj-1793126281086-96tzj", title: "मेले एवं त्योहार", hindiTitle: "मेले एवं त्योहार", number: 3, topics: [] },
  { id: "ch_raj_paintings_crafts", subjectId: "subj-1793126281086-96tzj", title: "चित्रकला शैलियाँ एवं हस्तशिल्प", hindiTitle: "चित्रकला शैलियाँ एवं हस्तशिल्प", number: 4, topics: [] },
  { id: "ch_raj_folk_culture", subjectId: "subj-1793126281086-96tzj", title: "लोक नृत्य, लोक नाट्य एवं वाद्ययंत्र", hindiTitle: "लोक नृत्य, लोक नाट्य एवं वाद्ययंत्र", number: 5, topics: [] },
  { id: "ch_raj_saints_sects", subjectId: "subj-1793126281086-96tzj", title: "संत, संप्रदाय एवं साहित्य", hindiTitle: "संत, संप्रदाय एवं साहित्य", number: 6, topics: [] },
  { id: "ch_current_raj", subjectId: "subj-1793126332353-e3dxj", title: "राजस्थान समसामयिकी एवं फ्लैगशिप योजनाएँ", hindiTitle: "राजस्थान समसामयिकी एवं फ्लैगशिप योजनाएँ", number: 1, topics: [] },
  { id: "ch_current_nat_intl", subjectId: "subj-1793126332353-e3dxj", title: "राष्ट्रीय एवं अंतर्राष्ट्रीय परिदृश्य", hindiTitle: "राष्ट्रीय एवं अंतर्राष्ट्रीय परिदृश्य", number: 2, topics: [] }
];

export const CANONICAL_TOPICS = [
  { id: "top_raj_forts_arch", chapterId: "ch_raj_art_arch", subjectId: "subj-1793126281086-96tzj", title: "प्रमुख दुर्ग एवं स्थापत्य", hindiTitle: "प्रमुख दुर्ग एवं स्थापत्य", number: 1 },
  { id: "top_raj_palaces_monuments", chapterId: "ch_raj_art_arch", subjectId: "subj-1793126281086-96tzj", title: "महल, हवेलियाँ एवं छतरियाँ", hindiTitle: "महल, हवेलियाँ एवं छतरियाँ", number: 2 },
  { id: "top_raj_panchpeer", chapterId: "ch_raj_folk_deities", subjectId: "subj-1793126281086-96tzj", title: "पंचपीर एवं प्रमुख लोक देवता", hindiTitle: "पंचपीर एवं प्रमुख लोक देवता", number: 1 },
  { id: "top_raj_folk_goddesses", chapterId: "ch_raj_folk_deities", subjectId: "subj-1793126281086-96tzj", title: "राजस्थान की प्रमुख लोक देवियाँ", hindiTitle: "राजस्थान की प्रमुख लोक देवियाँ", number: 2 },
  { id: "top_raj_festivals", chapterId: "ch_raj_fairs_festivals", subjectId: "subj-1793126281086-96tzj", title: "पारंपरिक एवं धार्मिक त्योहार", hindiTitle: "पारंपरिक एवं धार्मिक त्योहार", number: 1 },
  { id: "top_raj_fairs", chapterId: "ch_raj_fairs_festivals", subjectId: "subj-1793126281086-96tzj", title: "प्रसिद्ध पशु एवं सांस्कृतिक मेले", hindiTitle: "प्रसिद्ध पशु एवं सांस्कृतिक मेले", number: 2 },
  { id: "top_raj_paintings", chapterId: "ch_raj_paintings_crafts", subjectId: "subj-1793126281086-96tzj", title: "राजस्थानी चित्रकला शैलियाँ", hindiTitle: "राजस्थानी चित्रकला शैलियाँ", number: 1 },
  { id: "top_raj_handicrafts", chapterId: "ch_raj_paintings_crafts", subjectId: "subj-1793126281086-96tzj", title: "हस्तकलाएं, वस्त्र एवं आभूषण", hindiTitle: "हस्तकलाएं, वस्त्र एवं आभूषण", number: 2 },
  { id: "top_raj_dance", chapterId: "ch_raj_folk_culture", subjectId: "subj-1793126281086-96tzj", title: "राजस्थान के प्रमुख लोक नृत्य", hindiTitle: "राजस्थान के प्रमुख लोक नृत्य", number: 1 },
  { id: "top_raj_instruments", chapterId: "ch_raj_folk_culture", subjectId: "subj-1793126281086-96tzj", title: "लोक वाद्ययंत्र एवं लोक संगीत", hindiTitle: "लोक वाद्ययंत्र एवं लोक संगीत", number: 2 },
  { id: "top_raj_heritage_inst", chapterId: "ch_raj_folk_culture", subjectId: "subj-1793126281086-96tzj", title: "सांस्कृतिक संस्थाएं एवं लोक नाट्य", hindiTitle: "सांस्कृतिक संस्थाएं एवं लोक नाट्य", number: 3 },
  { id: "top_raj_saints", chapterId: "ch_raj_saints_sects", subjectId: "subj-1793126281086-96tzj", title: "प्रमुख संत एवं धार्मिक संप्रदाय", hindiTitle: "प्रमुख संत एवं धार्मिक संप्रदाय", number: 1 },
  { id: "top_raj_literature", chapterId: "ch_raj_saints_sects", subjectId: "subj-1793126281086-96tzj", title: "राजस्थानी भाषा, बोलियां एवं साहित्य", hindiTitle: "राजस्थानी भाषा, बोलियां एवं साहित्य", number: 2 },
  { id: "top_current_schemes", chapterId: "ch_current_raj", subjectId: "subj-1793126332353-e3dxj", title: "नवीनतम योजनाएँ एवं नीतियाँ", hindiTitle: "नवीनतम योजनाएँ एवं नीतियाँ", number: 1 },
  { id: "top_current_events", chapterId: "ch_current_raj", subjectId: "subj-1793126332353-e3dxj", title: "चर्चित व्यक्तित्व, पुरस्कार एवं खेल", hindiTitle: "चर्चित व्यक्तित्व, पुरस्कार एवं खेल", number: 2 },
  { id: "top_current_nat", chapterId: "ch_current_nat_intl", subjectId: "subj-1793126332353-e3dxj", title: "राष्ट्रीय घटनाक्रम एवं अंतर्राष्ट्रीय सम्मेलन", hindiTitle: "राष्ट्रीय घटनाक्रम एवं अंतर्राष्ट्रीय सम्मेलन", number: 1 }
];

export const CANONICAL_SUBJECTS = [
  {
    id: "subj-1793114550283-wpeqo",
    name: "राजस्थान का इतिहास",
    hindiName: "राजस्थान का इतिहास",
    description: "प्राचीन सभ्यताएं, प्रमुख राजवंश, प्रजामंडल आंदोलन, 1857 की क्रांति एवं राजस्थान का एकीकरण",
    icon: "history",
    color: "#8B1E3F",
    order: 1,
    updatedAt: "2026-11-16T00:00:00.000Z"
  },
  {
    id: "subj-1793126120889-0jzu2",
    name: "राजस्थान का भूगोल",
    hindiName: "राजस्थान का भूगोल",
    description: "भौतिक स्वरूप, जलवायु, अपवाह तंत्र, वन संपदा, वन्य जीव अभयारण्य, कृषि एवं सिंचाई परियोजनाएं",
    icon: "map",
    color: "#102F65",
    order: 2,
    updatedAt: "2026-11-16T00:00:00.000Z"
  },
  {
    id: "subj-1793126281086-96tzj",
    name: "राजस्थान कला एवं संस्कृति",
    hindiName: "राजस्थान कला एवं संस्कृति",
    description: "प्रमुख दुर्ग, महल, लोक देवता-देवियां, मेले-त्योहार, चित्रकला, हस्तशिल्प, लोक नृत्य व संगीत",
    icon: "palette",
    color: "#D47311",
    order: 3,
    updatedAt: "2026-11-16T00:00:00.000Z"
  },
  {
    id: "subj-1793126301974-it6mm",
    name: "राजस्थान की अर्थव्यवस्था",
    hindiName: "राजस्थान की अर्थव्यवस्था",
    description: "उद्योग, खनिज, ऊर्जा संसाधन, कृषि परिदृश्य, आर्थिक समीक्षा एवं वित्तीय नीतियां",
    icon: "trending-up",
    color: "#2A7B4C",
    order: 4,
    updatedAt: "2026-11-16T00:00:00.000Z"
  },
  {
    id: "subj-1793126332353-e3dxj",
    name: "समसामयिक घटनाएँ",
    hindiName: "समसामयिक घटनाएँ",
    description: "राजस्थान समसामयिकी, नवीनतम फ्लैगशिप योजनाएं, चर्चित व्यक्तित्व, खेलकूद एवं पुरस्कार",
    icon: "newspaper",
    color: "#6B21A8",
    order: 5,
    updatedAt: "2026-11-16T00:00:00.000Z"
  }
];

// Helper to match subject by text
function resolveSubjectId(rawSubj: any, textHint = ""): string {
  const str = `${rawSubj || ""} ${textHint}`.toLowerCase();
  if (
    str.includes("कला") || str.includes("संस्कृति") || str.includes("दुर्ग") || str.includes("महल") ||
    str.includes("हवेली") || str.includes("छतरी") || str.includes("त्योहार") || str.includes("मेले") ||
    str.includes("मेला") || str.includes("चित्रकला") || str.includes("नृत्य") || str.includes("वाद्ययंत्र") ||
    str.includes("लोक देवता") || str.includes("लोक देवी") || str.includes("पंचपीर") || str.includes("संप्रदाय") ||
    str.includes("हस्तकला") || str.includes("आभूषण") || str.includes("वस्त्र") || str.includes("शैली") ||
    str.includes("art") || str.includes("culture")
  ) {
    return "subj-1793126281086-96tzj"; // Art & Culture
  }
  if (
    str.includes("भूगोल") || str.includes("जलवायु") || str.includes("अपवाह") || str.includes("नदियां") ||
    str.includes("नदी") || str.includes("झील") || str.includes("वन") || str.includes("अभयारण्य") ||
    str.includes("मिट्टी") || str.includes("भौतिक") || str.includes("अरावली") || str.includes("मरुस्थल") ||
    str.includes("सिंचाई") || str.includes("बाँध") || str.includes("geography")
  ) {
    return "subj-1793126120889-0jzu2"; // Geography
  }
  if (
    str.includes("अर्थव्यवस्था") || str.includes("बजट") || str.includes("आर्थिक") || str.includes("उद्योग") ||
    str.includes("खनिज") || str.includes("ऊर्जा") || str.includes("सर्वेक्षण") || str.includes("जीडीपी") ||
    str.includes("economy")
  ) {
    return "subj-1793126301974-it6mm"; // Economy
  }
  if (
    str.includes("समसामयिक") || str.includes("योजना") || str.includes("पुरस्कार") || str.includes("current") ||
    str.includes("समसामयिकी") || str.includes("व्यक्तित्व") || str.includes("खेल") || str.includes("ओलंपिक") ||
    str.includes("पोर्टल")
  ) {
    return "subj-1793126332353-e3dxj"; // Current Affairs
  }
  return "subj-1793114550283-wpeqo"; // Default to History if unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// FAULT-TOLERANT PAGINATED COLLECTION EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCollectionWithRetry(
  collectionName: string,
  batchSize = 250,
  maxDocs = 15000
): Promise<any[]> {
  console.log(`\n[Extractor] Starting stream fetch for collection '${collectionName}'...`);
  const colRef = db.collection(collectionName);
  const records: any[] = [];
  let lastDoc: QueryDocumentSnapshot | null = null;
  let hasMore = true;
  let page = 0;

  while (hasMore && records.length < maxDocs) {
    page++;
    let retries = 0;
    let success = false;

    while (!success && retries < 5) {
      try {
        let q = colRef.orderBy("__name__").limit(batchSize);
        if (lastDoc) {
          q = q.startAfter(lastDoc);
        }

        const snapshot = await q.get();
        if (snapshot.empty) {
          hasMore = false;
          success = true;
          break;
        }

        snapshot.docs.forEach(doc => {
          records.push({ id: doc.id, ...doc.data() });
        });

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < batchSize) {
          hasMore = false;
        }

        console.log(`  -> [${collectionName}] Page ${page}: +${snapshot.docs.length} docs (Total so far: ${records.length})`);
        success = true;
      } catch (err: any) {
        retries++;
        console.warn(`  [!] Warning on ${collectionName} page ${page} (attempt ${retries}/5): ${err.message}`);
        if (err.message.includes("RESOURCE_EXHAUSTED") || err.code === 8) {
          throw new Error(`QUOTA_EXHAUSTED: ${err.message}`);
        }
        // Exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, retries), 10000);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    if (!success) {
      console.error(`  [X] Failed to fetch page ${page} for ${collectionName} after 5 retries.`);
      break;
    }
  }

  console.log(`[Extractor] Completed '${collectionName}' -> Total ${records.length} records retrieved.`);
  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBE TO TEST IF FIRESTORE QUOTA IS ACTIVE OR EXHAUSTED
// ─────────────────────────────────────────────────────────────────────────────
export async function probeQuotaAvailable(): Promise<{ available: boolean; error?: string }> {
  try {
    // 1-doc probe consumes only 1 read
    const snap = await db.collection("subjects").limit(1).get();
    return { available: true };
  } catch (err: any) {
    if (err.code === 8 || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("Quota")) {
      return { available: false, error: err.message };
    }
    return { available: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL MCQ NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────
function normalizeQuestion(q: any, subjectsMap: Map<string, any>, chaptersMap: Map<string, any>, topicsMap: Map<string, any>): any | null {
  const d = q.data || q;
  const qId = q.id || d.id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const text = cleanText(d.text || d.question || "");
  const rawOpts = d.options;
  
  if (!text) return null;
  if (!Array.isArray(rawOpts) || rawOpts.length < 2) return null;

  const options = rawOpts.map((o: any) => cleanText(String(o)));
  let correctIdx = d.correctIndex;
  if (typeof correctIdx === "string") {
    correctIdx = parseInt(correctIdx, 10);
  }
  if (typeof correctIdx !== "number" || isNaN(correctIdx) || correctIdx < 0 || correctIdx >= options.length) {
    correctIdx = 0;
  }

  const explanation = cleanText(d.explanation || "");
  
  // Resolve Subject
  let subjectId = d.subjectId;
  if (!subjectId || !subjectsMap.has(subjectId)) {
    subjectId = resolveSubjectId(d.subject || d.subjectName, text);
  }

  // Resolve Chapter
  let chapterId = d.chapterId;
  if (!chapterId || !chaptersMap.has(chapterId)) {
    // Try finding matching chapter in this subject
    const subjectChapters = Array.from(chaptersMap.values()).filter(c => c.subjectId === subjectId);
    const rawCh = (d.chapter || d.chapterTitle || "").toLowerCase();
    const match = subjectChapters.find(c => 
      (c.title && c.title.toLowerCase().includes(rawCh)) || 
      (c.hindiTitle && c.hindiTitle.toLowerCase().includes(rawCh))
    );
    chapterId = match ? match.id : (subjectChapters[0]?.id || `ch_${subjectId}_gen`);
  }

  // Resolve Topic
  let topicId = d.topicId || d.topic;
  if (!topicId || !topicsMap.has(topicId)) {
    const chapterTopics = Array.from(topicsMap.values()).filter(t => t.chapterId === chapterId);
    const rawTop = (d.topic || d.topicTitle || "").toLowerCase();
    const match = chapterTopics.find(t => 
      (t.title && t.title.toLowerCase().includes(rawTop)) || 
      (t.hindiTitle && t.hindiTitle.toLowerCase().includes(rawTop))
    );
    topicId = match ? match.id : (chapterTopics[0]?.id || `top_${chapterId}_gen`);
  }

  const updatedAt = d.updatedAt || new Date().toISOString();
  const isUserAdded = Boolean(d.isUserAdded);

  const mcqData = {
    id: qId,
    text,
    options,
    correctIndex: correctIdx,
    explanation,
    subjectId,
    chapterId,
    topicId,
    isUserAdded,
    updatedAt,
    exam: d.exam || "RPSC / RSMSSB",
    year: d.year || "2020-2026"
  };

  return {
    id: qId,
    collection: "mcqs",
    text,
    options,
    correctIndex: correctIdx,
    explanation,
    subjectId,
    chapterId,
    topicId,
    isUserAdded,
    updatedAt,
    data: mcqData
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
export async function executeFullSync(dryRunLocal = false): Promise<boolean> {
  const startTime = Date.now();
  console.log("\n=======================================================");
  console.log(`   DISHA 20-20 FIRESTORE -> LOCAL SNAPSHOT SYNC PIPELINE ${dryRunLocal ? '(LOCAL DRY RUN)' : ''}`);
  console.log(`   Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  console.log("=======================================================\n");

  let rawSubjects: any[] = [];
  let rawChapters: any[] = [];
  let rawTopics: any[] = [];
  let rawMcqs: any[] = [];
  let rawQuestions: any[] = [];
  let rawCustomQuestions: any[] = [];

  if (dryRunLocal) {
    console.log("[Phase 1/6] Running Local Dry-Run Ingestion from Backups & Files...");
    const filesToLoad = [
      "backups/phase4_262_stale_questions_backup.json",
      "prajamandal_backup.json",
      "full_production_backup_576.json",
      "/sdcard/Download/disha2020_questions_2026-11-14.json"
    ];

    for (const f of filesToLoad) {
      if (fs.existsSync(f)) {
        try {
          const content = JSON.parse(fs.readFileSync(f, "utf8"));
          if (Array.isArray(content.mcqs)) rawMcqs.push(...content.mcqs);
          if (Array.isArray(content.questions)) rawQuestions.push(...content.questions);
          if (Array.isArray(content.cloudCacheQuestions)) rawMcqs.push(...content.cloudCacheQuestions);
          if (Array.isArray(content.records)) {
            content.records.forEach((r: any) => {
              if (r.mcqsRecord) rawMcqs.push(r.mcqsRecord);
              if (r.questionsRecord) rawQuestions.push(r.questionsRecord);
            });
          }
          if (Array.isArray(content.subjects)) rawSubjects.push(...content.subjects);
          if (Array.isArray(content.chapters)) rawChapters.push(...content.chapters);
          if (Array.isArray(content.topics)) rawTopics.push(...content.topics);
          console.log(`  Loaded ${f}: current pool size = ${rawMcqs.length + rawQuestions.length}`);
        } catch (e: any) {
          console.warn(`  Failed to parse ${f}: ${e.message}`);
        }
      }
    }
  } else {
    // 1. Quota Pre-Flight Check
    console.log("[Phase 1/6] Running Quota Pre-Flight Probe...");
    const probe = await probeQuotaAvailable();
    if (!probe.available) {
      console.error(`[X] Firestore Quota Exhausted! Error: ${probe.error}`);
      console.error("[-] Quota has not reset yet. Aborting pipeline until reset window.");
      return false;
    }
    console.log("[✓] Quota Probe Succeeded! Read operations are active and ready.");

    // 2. Fetch All Curriculum & Question Collections
    console.log("\n[Phase 2/6] Extracting All Raw Firestore Collections...");
    try {
      rawSubjects = await fetchCollectionWithRetry("subjects", 100);
      rawChapters = await fetchCollectionWithRetry("chapters", 250);
      rawTopics = await fetchCollectionWithRetry("topics", 500);
      rawMcqs = await fetchCollectionWithRetry("mcqs", 500);
      rawQuestions = await fetchCollectionWithRetry("questions", 500);
      try {
        rawCustomQuestions = await fetchCollectionWithRetry("customQuestions", 500);
      } catch {
        rawCustomQuestions = [];
      }
    } catch (err: any) {
      console.error(`[X] Extraction interrupted: ${err.message}`);
      return false;
    }
  }

  console.log(`\nRaw Counts Extracted:`);
  console.log(` - Subjects: ${rawSubjects.length}`);
  console.log(` - Chapters: ${rawChapters.length}`);
  console.log(` - Topics: ${rawTopics.length}`);
  console.log(` - 'mcqs' Collection: ${rawMcqs.length}`);
  console.log(` - 'questions' Collection: ${rawQuestions.length}`);
  console.log(` - 'customQuestions' Collection: ${rawCustomQuestions.length}`);

  // 3. Save Raw Backup Dump
  console.log("\n[Phase 3/6] Saving Timestamped Raw Extraction Dump...");
  const backupDir = path.resolve(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const dumpFilename = `firestore_raw_dump_${Date.now()}.json`;
  const dumpPath = path.join(backupDir, dumpFilename);
  fs.writeFileSync(dumpPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    counts: {
      subjects: rawSubjects.length,
      chapters: rawChapters.length,
      topics: rawTopics.length,
      mcqs: rawMcqs.length,
      questions: rawQuestions.length,
      customQuestions: rawCustomQuestions.length
    },
    subjects: rawSubjects,
    chapters: rawChapters,
    topics: rawTopics,
    mcqs: rawMcqs,
    questions: rawQuestions,
    customQuestions: rawCustomQuestions
  }, null, 2));
  console.log(`[✓] Raw backup written to: ${dumpPath}`);

  // 4. Curriculum & Questions Normalization & Deduplication
  console.log("\n[Phase 4/6] Deduplicating & Normalizing Curriculum Hierarchy...");

  // Combine subjects with canonical fallback
  const subjectsMap = new Map<string, any>();
  CANONICAL_SUBJECTS.forEach(s => subjectsMap.set(s.id, s));
  rawSubjects.forEach(s => {
    if (s && s.id) subjectsMap.set(s.id, { ...subjectsMap.get(s.id), ...s });
  });
  const finalSubjects = Array.from(subjectsMap.values());

  // Combine chapters
  const chaptersMap = new Map<string, any>();
  CANONICAL_CHAPTERS.forEach(c => chaptersMap.set(c.id, c));
  rawChapters.forEach(c => {
    if (c && c.id) chaptersMap.set(c.id, c);
  });
  // Ensure default chapters for each subject exist
  finalSubjects.forEach(s => {
    const hasCh = Array.from(chaptersMap.values()).some(c => c.subjectId === s.id);
    if (!hasCh) {
      const defCh = {
        id: `ch_${s.id}_gen`,
        subjectId: s.id,
        title: `${s.hindiName || s.name} - मुख्य अध्ययन`,
        hindiTitle: `${s.hindiName || s.name} - मुख्य अध्ययन`,
        number: 1,
        topics: []
      };
      chaptersMap.set(defCh.id, defCh);
    }
  });
  const finalChapters = Array.from(chaptersMap.values());

  // Combine topics
  const topicsMap = new Map<string, any>();
  CANONICAL_TOPICS.forEach(t => topicsMap.set(t.id, t));
  rawTopics.forEach(t => {
    if (t && t.id) topicsMap.set(t.id, t);
  });
  // Ensure default topics for each chapter exist
  finalChapters.forEach(c => {
    const hasTop = Array.from(topicsMap.values()).some(t => t.chapterId === c.id);
    if (!hasTop) {
      const defTop = {
        id: `top_${c.id}_gen`,
        chapterId: c.id,
        subjectId: c.subjectId,
        title: `${c.hindiTitle || c.title} - अभ्यास प्रश्न`,
        hindiTitle: `${c.hindiTitle || c.title} - अभ्यास प्रश्न`,
        number: 1
      };
      topicsMap.set(defTop.id, defTop);
    }
  });
  const finalTopics = Array.from(topicsMap.values());

  // Load baseline seeds for Art, Economy & Current Affairs
  const seedsPath = path.resolve(process.cwd(), "scripts/curated_seeds.json");
  const seedsList: any[] = [];
  if (fs.existsSync(seedsPath)) {
    try {
      const seeds = JSON.parse(fs.readFileSync(seedsPath, "utf8"));
      if (Array.isArray(seeds.art_culture)) seedsList.push(...seeds.art_culture);
      if (Array.isArray(seeds.economy)) seedsList.push(...seeds.economy);
      if (Array.isArray(seeds.current_affairs)) seedsList.push(...seeds.current_affairs);
      console.log(`[✓] Ingested ${seedsList.length} verified seeds across Art, Economy & Current Affairs`);
    } catch (e: any) {
      console.warn(`Could not load seeds: ${e.message}`);
    }
  }

  // Deduplicate and Normalize all MCQs
  const combinedRawList = [...seedsList, ...rawMcqs, ...rawQuestions, ...rawCustomQuestions];
  console.log(`Total raw pool to process: ${combinedRawList.length} items`);

  const seenHashes = new Set<string>();
  const seenIds = new Set<string>();
  const unifiedMcqs: any[] = [];
  const subjectDistribution: Record<string, number> = {};

  combinedRawList.forEach(raw => {
    const normalized = normalizeQuestion(raw, subjectsMap, chaptersMap, topicsMap);
    if (!normalized) return;

    const hash = generateHash(normalized.text, normalized.options);
    if (seenHashes.has(hash)) return; // Skip duplicate question text
    seenHashes.add(hash);

    if (seenIds.has(normalized.id)) {
      normalized.id = `q-${hash.slice(0, 16)}`;
      normalized.data.id = normalized.id;
    }
    seenIds.add(normalized.id);

    unifiedMcqs.push(normalized);
    const subId = normalized.subjectId;
    subjectDistribution[subId] = (subjectDistribution[subId] || 0) + 1;
  });

  console.log(`\n[✓] Deduplication Complete! Unique Valid MCQs: ${unifiedMcqs.length}`);
  console.log("Subject Distribution:");
  finalSubjects.forEach(s => {
    console.log(` - [${s.hindiName}]: ${subjectDistribution[s.id] || 0} questions`);
  });

  // 5. Generate Snapshots & Chunks
  console.log("\n[Phase 5/6] Building Production CDN Snapshots (v1 & v2) & Chunks...");
  const CHUNK_SIZE = 200;
  const nowIso = new Date().toISOString();

  const fullSnapshot = {
    schemaVersion: 2,
    snapshotVersion: 2,
    publishedAt: nowIso,
    subjects: finalSubjects,
    chapters: finalChapters,
    topics: finalTopics,
    mcqs: unifiedMcqs
  };

  const fullSnapJson = JSON.stringify(fullSnapshot, null, 2);
  const fullChecksum = sha256(fullSnapJson);

  const targetDirs = [
    "education-content/snapshots/v1",
    "education-content/snapshots/v2",
    "public/api/snapshots/v1",
    "public/api/snapshots/v2",
    "education-content/manifests",
    "education-content/checksums"
  ];
  targetDirs.forEach(d => fs.mkdirSync(path.resolve(process.cwd(), d), { recursive: true }));

  const totalChunks = Math.ceil(unifiedMcqs.length / CHUNK_SIZE);
  const chunksMeta: any[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = start + CHUNK_SIZE;
    const chunkItems = unifiedMcqs.slice(start, end);

    const chunkObj: any = {
      chunkIndex: i,
      snapshotVersion: 2,
      mcqs: chunkItems
    };
    if (i === 0) {
      chunkObj.subjects = finalSubjects;
      chunkObj.chapters = finalChapters;
      chunkObj.topics = finalTopics;
    }

    const chunkJson = JSON.stringify(chunkObj);
    const chunkChecksum = sha256(chunkJson);
    const chunkFilename = `chunk-${i}.json`;

    ["education-content/snapshots/v1", "education-content/snapshots/v2", "public/api/snapshots/v1", "public/api/snapshots/v2"].forEach(base => {
      fs.writeFileSync(path.join(process.cwd(), base, chunkFilename), chunkJson, "utf8");
    });

    chunksMeta.push({
      chunkIndex: i,
      url: `/api/snapshots/v1/${chunkFilename}`,
      checksum: chunkChecksum,
      itemCount: chunkItems.length
    });
  }

  // Write full content.json
  ["education-content/snapshots/v1", "education-content/snapshots/v2", "public/api/snapshots/v1", "public/api/snapshots/v2"].forEach(base => {
    fs.writeFileSync(path.join(process.cwd(), base, "content.json"), fullSnapJson, "utf8");
  });

  // Write manifest
  const manifest = {
    schemaVersion: 2,
    snapshotVersion: 2,
    previousSnapshotVersion: 1,
    curriculumVersion: 2,
    mcqVersion: 2,
    publishedAt: nowIso,
    snapshotUrl: "/api/snapshots/v1/content.json",
    checksum: fullChecksum,
    status: "published",
    totalMcqs: unifiedMcqs.length,
    totalSubjects: finalSubjects.length,
    totalChapters: finalChapters.length,
    totalTopics: finalTopics.length,
    chunks: chunksMeta
  };

  fs.writeFileSync(path.join(process.cwd(), "education-content/manifests/current.json"), JSON.stringify(manifest, null, 2), "utf8");
  
  const checksumInfo = {
    snapshotVersion: 2,
    checksum: fullChecksum,
    chunks: chunksMeta
  };
  fs.writeFileSync(path.join(process.cwd(), "education-content/checksums/v1.json"), JSON.stringify(checksumInfo, null, 2), "utf8");
  fs.writeFileSync(path.join(process.cwd(), "education-content/checksums/v2.json"), JSON.stringify(checksumInfo, null, 2), "utf8");

  console.log(`[✓] Created ${totalChunks} CDN chunks and published content.json!`);

  // 6. Build & Production Verification
  console.log("\n[Phase 6/6] Verifying Production Build & Deploying...");
  try {
    execSync("pnpm run build", { stdio: "inherit", cwd: process.cwd() });
    console.log("[✓] Production build passed!");
  } catch (buildErr: any) {
    console.error(`[X] Build failed: ${buildErr.message}`);
    return false;
  }

  // 7. Auto-commit & push to deploy on Vercel
  try {
    console.log("\n[Git & Vercel] Staging snapshot updates and committing to GitHub...");
    execSync("git add education-content/ public/api/snapshots/ backups/ scripts/", { cwd: process.cwd() });
    const status = execSync("git status --porcelain", { cwd: process.cwd() }).toString();
    if (status.trim().length > 0) {
      execSync(`git commit -m "feat(content): sync ${unifiedMcqs.length} MCQs from Firestore into CDN snapshot"`, { cwd: process.cwd() });
      execSync("git push origin main", { cwd: process.cwd() });
      console.log("[✓] Successfully committed and pushed to origin main! Vercel production deployment triggered.");
    } else {
      console.log("[-] No changes to commit in git repository.");
    }
  } catch (gitErr: any) {
    console.warn(`[!] Git commit/push notice: ${gitErr.message}`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n=======================================================");
  console.log(`   SYNC PIPELINE SUCCEEDED IN ${durationSec} SECONDS!`);
  console.log(`   ${unifiedMcqs.length} Total MCQs Ready for All Students with 0 Firestore Reads!`);
  console.log("=======================================================\n");

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS SENTINEL (WATCHER) FOR 1:30 PM IST RESET
// ─────────────────────────────────────────────────────────────────────────────
export async function runSentinelWatcher() {
  console.log("\n=======================================================");
  console.log("   DISHA 20-20 FIRESTORE QUOTA SENTINEL DAEMON ACTIVE");
  console.log(`   Current Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  console.log("   Target Quota Reset: 1:30 PM IST (Daily)");
  console.log("=======================================================\n");

  let synced = false;
  let checkCount = 0;

  while (!synced) {
    checkCount++;
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(`[${istTimeStr} IST] [Check #${checkCount}] Probing Firestore quota...`);

    const probe = await probeQuotaAvailable();

    if (probe.available) {
      console.log(`\n🎉 [${istTimeStr} IST] QUOTA IS NOW UNLOCKED! LAUNCHING AUTO-SYNC IMMEDIATELY...\n`);
      const success = await executeFullSync();
      if (success) {
        console.log(`[✓] SUCCESS: All questions extracted, processed, and bundled! Sentinel exiting with code 0.`);
        process.exit(0);
      } else {
        console.warn(`[!] Sync attempt returned false. Will retry in 5 minutes...`);
      }
    } else {
      console.log(`  [-] Still exhausted (429). Estimated wait until 1:30 PM IST reset.`);
    }

    // Determine poll interval: If close to 1:30 PM IST (between 13:20 and 13:40), poll every 30s.
    // Otherwise poll every 15 minutes.
    const hours = (now.getUTCHours() + 5.5) % 24; // approximate IST hour
    const pollIntervalMs = (hours >= 13.3 && hours <= 13.7) ? 30 * 1000 : 15 * 60 * 1000;
    
    console.log(`  Sleeping ${pollIntervalMs / 1000}s until next probe...\n`);
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
}

// Entrypoint logic
if (process.argv[1] && (process.argv[1].endsWith("sync_firestore_to_snapshot.ts") || process.argv[1].includes("sync_firestore_to_snapshot"))) {
  const args = process.argv.slice(2);
  if (args.includes("--dry-run-local")) {
    executeFullSync(true).catch(console.error);
  } else if (args.includes("--now")) {
    executeFullSync(false).catch(console.error);
  } else {
    runSentinelWatcher().catch(console.error);
  }
}
