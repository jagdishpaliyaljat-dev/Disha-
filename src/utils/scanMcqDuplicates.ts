import { collection, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { guardedGetDocs } from "./quotaTracker";
import { loadUserQuestionsStore } from "./questionsStorage";

export interface DuplicateGroupItem {
  docId: string;
  internalId: string;
  textPreview: string;
  exam?: string;
  year?: string | number;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  topicTitle?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  isStaleMoveCopy?: boolean;
}

export interface DuplicateGroup {
  normalizedText: string;
  previewText: string;
  count: number;
  docIds: string[];
  items: DuplicateGroupItem[];
  hasStaleMoveDuplicates?: boolean;
}

export interface McqScanResult {
  collectionName: string;
  totalScanned: number;
  totalUniqueTexts: number;
  duplicateIdCount: number;
  duplicateTextGroupCount: number;
  totalDuplicateDocsInGroups: number;
  duplicateIds: string[];
  duplicateGroups: DuplicateGroup[];
  summaryMessage: string;
  timestamp: string;
  scannedSources: string[];
}

/**
 * Normalizes question text for robust text equality comparison.
 * Strips HTML tags, converts to lowercase, removes special punctuation, and collapses spaces.
 */
export function normalizeQuestionText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "") // Strip HTML
    .replace(/[^\w\s\u0900-\u097F]/gi, "") // Keep alphanumeric, whitespace, Devanagari characters
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Scans the Firestore 'mcqs' collection (and local question stores) for:
 * 1. Duplicate document IDs or duplicate internal 'id' properties.
 * 2. Documents with identical 'question' text but different document IDs.
 */
export async function scanMcqCollectionDuplicates(
  targetCollection = "mcqs",
  maxScanLimit = 2000
): Promise<McqScanResult> {
  const timestamp = new Date().toISOString();
  const scannedSources: string[] = [];

  let docsToScan: Array<{ docId: string; data: any; source: string }> = [];

  // 1. Fetch from Firestore collection
  try {
    const collRef = collection(db, targetCollection);
    const q = query(collRef, limit(maxScanLimit));
    const snap = await guardedGetDocs(q, "Admin", `Scan Duplicates in ${targetCollection}`, undefined, 10000, true);
    
    scannedSources.push(`Firestore Collection '${targetCollection}' (${snap.docs.length} docs)`);
    
    snap.docs.forEach((docSnap) => {
      docsToScan.push({
        docId: docSnap.id,
        data: docSnap.data(),
        source: `Firestore (${targetCollection})`,
      });
    });
  } catch (err: any) {
    console.warn(`[McqScan] Firestore scan for '${targetCollection}' failed or timed out:`, err?.message || err);
    scannedSources.push(`Firestore Collection '${targetCollection}' (Failed/Timed out: ${err?.message || String(err)})`);
  }

  // 2. Also incorporate local custom questions if available
  try {
    const localStore = loadUserQuestionsStore();
    if (localStore.customQuestions && localStore.customQuestions.length > 0) {
      scannedSources.push(`Local Store Custom Questions (${localStore.customQuestions.length} items)`);
      localStore.customQuestions.forEach((q) => {
        docsToScan.push({
          docId: q.id,
          data: q,
          source: "Local Storage (customQuestions)",
        });
      });
    }
  } catch (err) {
    console.warn("[McqScan] Local store scan warning:", err);
  }

  // 3. Scan analysis
  const totalScanned = docsToScan.length;
  const seenDocIds = new Set<string>();
  const duplicateIdsSet = new Set<string>();

  // Map normalized text -> items array
  const textMap = new Map<string, DuplicateGroupItem[]>();

  docsToScan.forEach(({ docId, data, source }) => {
    // Check ID duplicates
    const internalId = data.id || docId;
    if (seenDocIds.has(docId)) {
      duplicateIdsSet.add(docId);
    } else {
      seenDocIds.add(docId);
    }

    if (internalId !== docId && seenDocIds.has(internalId)) {
      duplicateIdsSet.add(internalId);
    } else {
      seenDocIds.add(internalId);
    }

    // Check Question Text duplicates
    const rawText = data.text || data.question || data.questionText || data.question_text || "";
    const norm = normalizeQuestionText(rawText);

    if (norm) {
      const item: DuplicateGroupItem = {
        docId,
        internalId,
        textPreview: rawText.length > 120 ? `${rawText.slice(0, 120)}...` : rawText,
        exam: data.exam || data.examName || data.pyqDetails?.examBoard || undefined,
        year: data.year || data.examYear || data.pyqDetails?.paperYear || undefined,
        subjectId: data.subjectId || undefined,
        chapterId: data.chapterId || undefined,
        topicId: data.topicId || undefined,
        topicTitle: data.topicTitle || data.topicName || data.topic || undefined,
        createdAt: data.createdAt || undefined,
        updatedAt: data.updatedAt || undefined,
        source,
      };

      if (!textMap.has(norm)) {
        textMap.set(norm, [item]);
      } else {
        textMap.get(norm)!.push(item);
      }
    }
  });

  // Extract duplicate text groups (count > 1)
  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicateDocsInGroups = 0;

  textMap.forEach((items, normKey) => {
    if (items.length > 1) {
      // Deduplicate items with the exact same docId if any
      const uniqueItemsByDoc = new Map<string, DuplicateGroupItem>();
      items.forEach((it) => uniqueItemsByDoc.set(it.docId, it));
      const dedupedItems = Array.from(uniqueItemsByDoc.values());

      if (dedupedItems.length > 1) {
        // Check if group contains stale move duplicates (e.g. usr-q source doc and mcq_ moved doc in differing topics)
        const hasDiffTopics = new Set(dedupedItems.map((it) => it.topicId || "none")).size > 1;
        const hasUsrQAndMcq = dedupedItems.some((it) => it.docId.startsWith("usr-q-")) && 
                              dedupedItems.some((it) => it.docId.startsWith("mcq_"));
        const hasStaleMoveDuplicates = hasDiffTopics && hasUsrQAndMcq;

        if (hasStaleMoveDuplicates) {
          // Find the newest document representing the destination topic
          let latestTime = 0;
          let newestDocId = "";
          dedupedItems.forEach((it) => {
            const t = new Date(it.updatedAt || it.createdAt || 0).getTime();
            if (t > latestTime) {
              latestTime = t;
              newestDocId = it.docId;
            }
          });
          dedupedItems.forEach((it) => {
            it.isStaleMoveCopy = it.docId !== newestDocId;
          });
        }

        duplicateGroups.push({
          normalizedText: normKey,
          previewText: dedupedItems[0].textPreview,
          count: dedupedItems.length,
          docIds: dedupedItems.map((it) => it.docId),
          items: dedupedItems,
          hasStaleMoveDuplicates,
        });
        totalDuplicateDocsInGroups += dedupedItems.length;
      }
    }
  });

  const duplicateIds = Array.from(duplicateIdsSet);
  const duplicateTextGroupCount = duplicateGroups.length;
  const duplicateIdCount = duplicateIds.length;
  const totalUniqueTexts = textMap.size;

  let summaryMessage = "";
  if (totalScanned === 0) {
    summaryMessage = `Scan complete for '${targetCollection}': No documents were found in Firestore or local storage.`;
  } else if (duplicateTextGroupCount === 0 && duplicateIdCount === 0) {
    summaryMessage = `Clean Scan! Total ${totalScanned} MCQs checked. Zero duplicate IDs and zero identical question text duplicates found. Import process is not creating duplicate documents in '${targetCollection}'.`;
  } else {
    summaryMessage = `Scan Warning! Scanned ${totalScanned} MCQs. Found ${duplicateIdCount} duplicate IDs and ${duplicateTextGroupCount} duplicate question text group(s) containing ${totalDuplicateDocsInGroups} total documents.`;
  }

  const result: McqScanResult = {
    collectionName: targetCollection,
    totalScanned,
    totalUniqueTexts,
    duplicateIdCount,
    duplicateTextGroupCount,
    totalDuplicateDocsInGroups,
    duplicateIds,
    duplicateGroups,
    summaryMessage,
    timestamp,
    scannedSources,
  };

  console.log("[McqScanResult]", result);
  return result;
}
