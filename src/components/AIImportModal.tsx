import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  X, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Check, 
  BookOpen,
  FolderPlus,
  Layers,
  Zap,
  Tag,
  FileImage,
  Trash2,
  Loader2,
  Plus,
  FileCode,
  ArrowLeft,
  Search,
  Settings2,
  FileText,
  Radio,
  ChevronDown,
  Edit2,
  Download,
  Eye,
  Code,
  FileCheck,
  Copy,
  Award,
  ShieldCheck,
  GitMerge,
  RefreshCw
} from "lucide-react";
import { InlineSpinner } from "./ui/LoadingScreen";
import { motion, AnimatePresence } from "motion/react";
import { Question, Subject, Chapter, Topic, UserQuestionsStore, PYQPaper, LiveTest, ExamHistoryEntry, QuestionClassification } from "../types";
import {
  processJSONImport,
  smartJSONImport,
  parseJSONWithLocation,
  getSampleImportJSON,
  ValidatedQuestionResult,
  generateQuestionHash,
  normalizeQuestion,
  validateQuestion,
  ImportReviewCategory,
  MCQMatchTable,
  mergeExamHistories,
  cleanExamName,
  toAsciiYear
} from "../lib/mcqImport";
import { commitQuestions, formatDatabaseError, promiseWithTimeout } from "../lib/mcqImport/commit";
import { loadLocalPYQPapers, fetchPYQPapers, savePYQPaper } from "../utils/pyqStorage";
import { loadLocalLiveTests, fetchLiveTests, saveLiveTest } from "../utils/liveTestStorage";
import { loadUserQuestionsStore, saveUserQuestionsStore, getCombinedChapters, getCombinedSubjects, deduplicateQuestions } from "../utils/questionsStorage";
import { UniversalSmartParser } from "../utils/UniversalSmartParser";
import { ImageBlock } from "./MCQQuestionBlocks";
import { ParsedQuestion } from "./ParsedQuestion";
import { sanitizeSvgContent, isValidPngOrSvg } from "../utils/svgSanitizer";
import { uploadDiagramToStorage, dataUrlToBlob } from "../utils/diagramStorage";
import { apiFetch } from "../utils/api";
import { recordAIUsage } from "../utils/aiUsageTracker";
import { ImportTemplatesModal } from "./admin/ImportTemplatesModal";
import { SyllabusSelectionModal } from "./AddQuestionsModal";

interface AIImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionsStore: UserQuestionsStore;
  subjects?: Subject[];
  chapters: Chapter[];
  onImportQuestions: (newQuestions: Question[], alreadyCommitted?: boolean) => Promise<void> | void;
  initialSubjectId?: string;
  initialChapterId?: string;
  initialTopicId?: string;
}

type ImportStep = "setup" | "input" | "preview" | "summary";

export const AIImportModal: React.FC<AIImportModalProps> = ({
  isOpen,
  onClose,
  questionsStore,
  subjects = [],
  chapters = [],
  onImportQuestions,
  initialSubjectId,
  initialChapterId,
  initialTopicId,
}) => {
  if (!isOpen) return null;

  const [activeStep, setActiveStep] = useState<ImportStep>("setup");
  const [activeInputTab, setActiveInputTab] = useState<"text" | "json" | "file" | "manual">("text");
  
  // JSON File Upload State
  const [jsonUploadFile, setJsonUploadFile] = useState<File | null>(null);
  const [jsonUploadStats, setJsonUploadStats] = useState<{
    fileName: string;
    fileSizeKb: number;
    questionCount: number;
    isValidJson: boolean;
    error?: string;
  } | null>(null);
  const jsonUploadInputRef = useRef<HTMLInputElement>(null);

  // Bulk Exam Assignment Modal
  const [showBulkExamModal, setShowBulkExamModal] = useState(false);
  const [bulkExamName, setBulkExamName] = useState("CET 12th Level");
  const [bulkExamYear, setBulkExamYear] = useState(new Date().getFullYear().toString());
  const [bulkExamTarget, setBulkExamTarget] = useState<"selected" | "all">("selected");
  const [bulkExamAction, setBulkExamAction] = useState<"append" | "replace">("append");

  // Duplicate Resolution Mode
  const [duplicateResolutionMode, setDuplicateResolutionMode] = useState<"skip" | "merge" | "update">("merge");

  // Shared States
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgressText, setCommitProgressText] = useState("");
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [isSyllabusSheetOpen, setIsSyllabusSheetOpen] = useState(false);
  const [selectingField, setSelectingField] = useState<"subject" | "chapter" | "topic" | null>(null);

  const openSelectionModal = (field: "subject" | "chapter" | "topic") => {
    setSelectingField(field);
    setIsSyllabusSheetOpen(true);
  };

  // 1. Text/AI Mode State
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  // 2. Manual/Diagram Mode State
  const [manualQuestionText, setManualQuestionText] = useState("");
  const [manualOptions, setManualOptions] = useState<[string, string, string, string]>(["", "", "", ""]);
  const [manualCorrectIndex, setManualCorrectIndex] = useState(0);
  const [manualExplanation, setManualExplanation] = useState("");
  const [manualQuestionType, setManualQuestionType] = useState("geometry");
  const [manualUploadedImage, setManualUploadedImage] = useState<{
    file?: File;
    dataUrl: string;
    type: "png" | "svg";
    fileName: string;
    altText: string;
    sanitizedSvg?: string;
  } | null>(null);

  // 3. Batch JSON Mode State
  const [jsonText, setPasteJsonText] = useState("");
  const [jsonAttachedFiles, setJsonAttachedFiles] = useState<{ [fileName: string]: { dataUrl: string; type: "png" | "svg"; file: File } }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImgFilesRef = useRef<HTMLInputElement>(null);
  
  // Requirement 1: Synchronous Guard for double-click prevention
  const isCommittingRef = useRef<boolean>(false);

  // ───────────────────────────────────────────────────────────
  // CLASSIFICATION & TARGET SELECTION WITH DATABASE SYNC
  // ───────────────────────────────────────────────────────────
  const [fetchedSubjects, setFetchedSubjects] = useState<Subject[]>(subjects || []);
  const [fetchedChapters, setFetchedChapters] = useState<Chapter[]>(chapters || []);
  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState<boolean>(false);
  const [syllabusError, setSyllabusError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSyllabusData() {
      setIsLoadingSyllabus(true);
      setSyllabusError(null);
      try {
        const store = loadUserQuestionsStore();
        const combSubjects = getCombinedSubjects(store);
        const combChapters = getCombinedChapters(store);
        
        // Helper to ensure all custom topics from store and props are embedded into chapters
        const mergeTopicsIntoChapters = (targetChapters: Chapter[], extraTopics: Topic[] = []): Chapter[] => {
          const allExtraTopics = [...(store.customTopics || []), ...extraTopics];
          return targetChapters.map(ch => {
            const topicMap = new Map<string, Topic>();
            (ch.topics || []).forEach(t => { if (t?.id) topicMap.set(t.id, t); });
            allExtraTopics
              .filter(t => String(t.chapterId) === String(ch.id))
              .forEach(t => { if (t?.id && !topicMap.has(String(t.id))) topicMap.set(String(t.id), t); });
            return {
              ...ch,
              topics: Array.from(topicMap.values()),
            };
          });
        };

        const initialChapters = combChapters.length > 0 ? combChapters : (chapters && chapters.length > 0 ? chapters : []);
        if (initialChapters.length > 0 && isMounted) {
          setFetchedChapters(mergeTopicsIntoChapters(initialChapters));
        }

        if (combSubjects.length > 0 && isMounted) {
          setFetchedSubjects(combSubjects);
        } else if (subjects && subjects.length > 0 && isMounted) {
          setFetchedSubjects(subjects);
        }

        try {
          const { isSupabaseConfigured } = await import("../lib/supabase");
          if (isSupabaseConfigured()) {
            const { fetchSubjects, fetchChapters, fetchTopics } = await import("../utils/supabaseSyncService");
            const [sbSubjects, sbChapters, sbTopics] = await Promise.all([
              fetchSubjects(),
              fetchChapters(),
              fetchTopics(),
            ]);

            if (isMounted) {
              if (sbSubjects && sbSubjects.length > 0) {
                setFetchedSubjects((prev) => {
                  const map = new Map<string, Subject>();
                  [...prev, ...sbSubjects].forEach((s) => map.set(s.id, s));
                  return Array.from(map.values());
                });
              }

              if (sbChapters && sbChapters.length > 0) {
                setFetchedChapters((prev) => {
                  const map = new Map<string, Chapter>();
                  prev.forEach((c) => map.set(c.id, { ...c }));
                  sbChapters.forEach((remoteCh) => {
                    const existing = map.get(remoteCh.id);
                    const topicMap = new Map<string, Topic>();
                    (existing?.topics || []).forEach((t) => { if (t?.id) topicMap.set(String(t.id), t); });
                    (remoteCh.topics || []).forEach((t) => { if (t?.id) topicMap.set(String(t.id), t); });
                    (sbTopics || [])
                      .filter((t) => String(t.chapterId) === String(remoteCh.id))
                      .forEach((t) => { if (t?.id) topicMap.set(String(t.id), t); });
                    (store.customTopics || [])
                      .filter((t) => String(t.chapterId) === String(remoteCh.id))
                      .forEach((t) => { if (t?.id) topicMap.set(String(t.id), t); });

                    map.set(remoteCh.id, {
                      ...existing,
                      ...remoteCh,
                      topics: Array.from(topicMap.values()),
                    });
                  });
                  return Array.from(map.values());
                });
              } else if (sbTopics && sbTopics.length > 0) {
                setFetchedChapters((prev) => mergeTopicsIntoChapters(prev, sbTopics));
              }
            }
          }
        } catch (sbErr) {
          console.warn("[AIImportModal] Supabase curriculum fetch warning:", sbErr);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to load syllabus for Smart MCQ Import:", err);
          setSyllabusError(err?.message || "Failed to load subjects and chapters from database.");
        }
      } finally {
        if (isMounted) setIsLoadingSyllabus(false);
      }
    }
    loadSyllabusData();
    return () => { isMounted = false; };
  }, [subjects, chapters]);

  // Destination mode state
  const [importDestination, setImportDestination] = useState<"curriculum" | "pyq" | "live">("curriculum");
  const [pyqPapersList, setPyqPapersList] = useState<PYQPaper[]>([]);
  const [selectedPyqPaperId, setSelectedPyqPaperId] = useState<string>("");
  const [liveTestsList, setLiveTestsList] = useState<LiveTest[]>([]);
  const [selectedLiveTestId, setSelectedLiveTestId] = useState<string>("");
  const [saveToPYQVault, setSaveToPYQVault] = useState(false);
  const [selectedPYQPaperId, setSelectedPYQPaperId] = useState<string>("new");
  const [newPYQTitle, setNewPYQTitle] = useState("");
  const [saveToLiveTest, setSaveToLiveTest] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadLists() {
      try {
        const pyqs = await fetchPYQPapers();
        if (isMounted) {
          setPyqPapersList(pyqs);
          if (pyqs.length > 0 && !selectedPyqPaperId) setSelectedPyqPaperId(pyqs[0].id);
        }
      } catch (e) {
        const local = loadLocalPYQPapers();
        if (isMounted) {
          setPyqPapersList(local);
          if (local.length > 0 && !selectedPyqPaperId) setSelectedPyqPaperId(local[0].id);
        }
      }

      try {
        const lives = await fetchLiveTests();
        if (isMounted) {
          setLiveTestsList(lives);
          if (lives.length > 0 && !selectedLiveTestId) setSelectedLiveTestId(lives[0].id);
        }
      } catch (e) {
        const local = loadLocalLiveTests();
        if (isMounted) {
          setLiveTestsList(local);
          if (local.length > 0 && !selectedLiveTestId) setSelectedLiveTestId(local[0].id);
        }
      }
    }
    loadLists();
    return () => { isMounted = false; };
  }, []);

  const availableSubjects = useMemo(() => {
    if (fetchedSubjects && fetchedSubjects.length > 0) return fetchedSubjects;
    if (subjects && subjects.length > 0) return subjects;
    const uniqueIds = Array.from(new Set(fetchedChapters.map((c) => c.subjectId).filter(Boolean))) as string[];
    if (uniqueIds.length > 0) {
      return uniqueIds.map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        hindiName: id,
      }));
    }
    return [];
  }, [fetchedSubjects, subjects, fetchedChapters]);

  const defaultSubjectId = useMemo(() => {
    if (initialSubjectId && (initialSubjectId === "all" || availableSubjects.some((s) => String(s.id) === String(initialSubjectId)))) {
      return initialSubjectId;
    }
    if (initialChapterId) {
      const ch = fetchedChapters.find((c) => String(c.id) === String(initialChapterId));
      if (ch?.subjectId && availableSubjects.some((s) => String(s.id) === String(ch.subjectId))) {
        return String(ch.subjectId);
      }
    }
    return availableSubjects[0]?.id || "economics";
  }, [initialSubjectId, initialChapterId, availableSubjects, fetchedChapters]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(defaultSubjectId);

  const availableChapters = useMemo(() => {
    if (!selectedSubjectId || selectedSubjectId === "all") return fetchedChapters;
    const filtered = fetchedChapters.filter((c) => String(c.subjectId) === String(selectedSubjectId) || (c as any).subject === selectedSubjectId);
    return filtered;
  }, [fetchedChapters, selectedSubjectId]);

  const defaultChapterId = useMemo(() => {
    if (initialChapterId && availableChapters.some((c) => String(c.id) === String(initialChapterId))) {
      return initialChapterId;
    }
    return availableChapters[0]?.id || fetchedChapters[0]?.id || "";
  }, [initialChapterId, availableChapters, fetchedChapters]);

  const [selectedChapterId, setSelectedChapterId] = useState<string>(defaultChapterId);

  useEffect(() => {
    if (availableChapters.length > 0 && !availableChapters.some((c) => String(c.id) === String(selectedChapterId))) {
      setSelectedChapterId(String(availableChapters[0].id));
    }
  }, [availableChapters, selectedChapterId]);

  const selectedChapter = useMemo(() => {
    return fetchedChapters.find((c) => String(c.id) === String(selectedChapterId)) || availableChapters[0] || fetchedChapters[0];
  }, [fetchedChapters, selectedChapterId, availableChapters]);

  const availableTopics = useMemo(() => {
    const topicMap = new Map<string, Topic>();
    
    // 1. From selectedChapter.topics
    (selectedChapter?.topics || []).forEach(t => {
      if (t && t.id) topicMap.set(t.id, t);
    });

    // 2. From chapters prop
    if (selectedChapterId && chapters && chapters.length > 0) {
      const ch = chapters.find(c => String(c.id) === String(selectedChapterId));
      (ch?.topics || []).forEach(t => {
        if (t && t.id && !topicMap.has(String(t.id))) topicMap.set(String(t.id), t);
      });
    }

    // 3. From questionsStore.customTopics
    if (selectedChapterId && questionsStore?.customTopics) {
      questionsStore.customTopics
        .filter(t => String(t.chapterId) === String(selectedChapterId))
        .forEach(t => {
          if (t && t.id && !topicMap.has(String(t.id))) topicMap.set(String(t.id), t);
        });
    }

    // 4. From local storage store.customTopics as fallback
    try {
      const localStore = loadUserQuestionsStore();
      if (selectedChapterId && localStore?.customTopics) {
        localStore.customTopics
          .filter(t => String(t.chapterId) === String(selectedChapterId))
          .forEach(t => {
            if (t && t.id && !topicMap.has(String(t.id))) topicMap.set(String(t.id), t);
          });
      }
    } catch (_) {}

    return Array.from(topicMap.values());
  }, [selectedChapter, selectedChapterId, chapters, questionsStore]);

  const defaultTopicId = useMemo(() => {
    if (initialTopicId && availableTopics.some((t) => t.id === initialTopicId)) {
      return initialTopicId;
    }
    return availableTopics[0]?.id || "";
  }, [initialTopicId, availableTopics]);

  const [selectedTopicId, setSelectedTopicId] = useState<string>(defaultTopicId);

  // Inline Topic Creation State
  const [showAddTopicInput, setShowAddTopicInput] = useState<boolean>(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string>("");
  const [isSavingNewTopic, setIsSavingNewTopic] = useState<boolean>(false);
  const [addTopicError, setAddTopicError] = useState<string | null>(null);

  const handleCreateTopic = async (titleToCreate?: string) => {
    const title = (titleToCreate || newTopicTitle).trim();
    if (!title) {
      setAddTopicError("Please enter a topic title");
      return;
    }
    if (!selectedChapterId) {
      setAddTopicError("Please select a target chapter first");
      return;
    }

    setIsSavingNewTopic(true);
    setAddTopicError(null);

    const topicId = `topic_${crypto.randomUUID()}`;
    const newTopic: Topic = {
      id: topicId,
      chapterId: selectedChapterId,
      subjectId: selectedSubjectId === "all" ? (selectedChapter?.subjectId || "economics") : selectedSubjectId,
      title: title,
      hindiTitle: title,
      questions: [],
      isUserAdded: true,
    };

    // 1. Immediately update fetchedChapters state so availableTopics immediately updates
    setFetchedChapters(prev => {
      return prev.map(ch => {
        if (ch.id === selectedChapterId) {
          const existingTopics = ch.topics || [];
          return {
            ...ch,
            topics: [...existingTopics.filter(t => t.id !== topicId), newTopic],
          };
        }
        return ch;
      });
    });

    // 2. Select the new topic right away!
    setSelectedTopicId(topicId);
    setNewTopicTitle("");
    setShowAddTopicInput(false);

    // 3. Save to localStorage questionsStore
    try {
      const store = loadUserQuestionsStore();
      const updatedTopics = [...(store.customTopics || []).filter(t => t.id !== topicId), newTopic];
      saveUserQuestionsStore({
        ...store,
        customTopics: updatedTopics,
      });
    } catch (e) {
      console.warn("Failed to persist new topic to localStorage:", e);
    }

    // 4. Sync to Supabase if configured
    try {
      const { isSupabaseConfigured } = await import("../lib/supabase");
      if (isSupabaseConfigured()) {
        const { saveTopicToSupabase } = await import("../utils/supabaseSyncService");
        await promiseWithTimeout(saveTopicToSupabase(newTopic), 15000, "Save New Topic to Supabase");
      }
    } catch (cloudErr) {
      console.warn("Failed to sync new topic to Supabase (local copy retained):", cloudErr);
    }

    setIsSavingNewTopic(false);
  };

  useEffect(() => {
    // If we have a selected topic but it's not in the available topics list for the current chapter,
    // we should usually default it. BUT we must be careful not to reset it if it was just created.
    // We also only do this if there's an actual topic selected (not empty string which is "General Topic")
    if (selectedTopicId && selectedTopicId !== "" && availableTopics.length > 0) {
      const exists = availableTopics.some((t) => String(t.id) === String(selectedTopicId));
      if (!exists) {
        // Only auto-reset if it's not a newly created topic that might still be syncing
        if (!selectedTopicId.startsWith('topic_')) {
          setSelectedTopicId(availableTopics[0].id);
        }
      }
    }
  }, [availableTopics, selectedTopicId]);

  const handleSubjectChange = (newSubId: string) => {
    setSelectedSubjectId(newSubId);
    const matched = newSubId === "all" 
      ? fetchedChapters 
      : fetchedChapters.filter(c => String(c.subjectId) === String(newSubId) || (c as any).subject === newSubId);
    
    const firstCh = matched[0] || fetchedChapters[0];
    if (firstCh) {
      setSelectedChapterId(String(firstCh.id));
      // Topic will be handled by useEffect or subsequent chapter change
      const topics = firstCh.topics || [];
      setSelectedTopicId(topics.length > 0 ? String(topics[0].id) : "");
    } else {
      setSelectedChapterId("");
      setSelectedTopicId("");
    }
  };

  const handleChapterChange = (newChId: string) => {
    const chIdStr = String(newChId);
    setSelectedChapterId(chIdStr);
    const ch = fetchedChapters.find(c => String(c.id) === chIdStr);
    const topics = ch?.topics || [];
    setSelectedTopicId(topics.length > 0 ? String(topics[0].id) : "");
  };

  const selectedSubject = useMemo(
    () => availableSubjects.find((s) => String(s.id) === String(selectedSubjectId)),
    [availableSubjects, selectedSubjectId]
  );

  const selectedTopic = useMemo(
    () => availableTopics.find((t) => String(t.id) === String(selectedTopicId)),
    [availableTopics, selectedTopicId]
  );

  // Preview & Results state
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    parseError?: string;
    results: ValidatedQuestionResult[];
    summary: { total: number; valid: number; warnings: number; errors: number; duplicates: number; unsupported?: number };
  } | null>(null);

  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [previewFilter, setPreviewFilter] = useState<"all" | ImportReviewCategory | "pyq" | "practice" | "multi_exam" | "unverified">("all");
  const [rawCompareIds, setRawCompareIds] = useState<Set<string>>(new Set());
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const [commitSummary, setCommitSummary] = useState<{ 
    importedCount: number; 
    failedCount: number;
    batchId: string;
    cloudSynced?: boolean;
    message?: string;
    errors: { chunkIndex: number; error: string; affectedIds: string[] }[];
  } | null>(null);

  const existingHashes = useMemo(() => {
    const hashes = new Set<string>();
    const allQ = [
      ...(questionsStore.customQuestions || []),
      ...(questionsStore.cloudCacheQuestions || []),
      ...Object.values(questionsStore.editedQuestions || {}),
    ];
    allQ.forEach((q) => {
      if ((q as any).hash) hashes.add((q as any).hash);
      else if (q.text) {
        hashes.add(
          generateQuestionHash({
            question: q.text,
            options: q.options || [],
            answer: ["A", "B", "C", "D", "E"][q.correctIndex ?? 0] || "A",
            table: q.table || q.tableData,
            matchTable: (q as any).matchTable,
          } as any)
        );
      }
    });
    return hashes;
  }, [questionsStore]);

  const selectedCount = selectedDraftIds.size;

  // Edit Question State
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editQuestionType, setEditQuestionType] = useState<string>("single_correct");
  const [editOptions, setEditOptions] = useState<string[]>(["", "", "", ""]);
  const [editCorrectIndex, setEditCorrectIndex] = useState<number>(-1);
  const [editExplanation, setEditExplanation] = useState("");
  const [editMatchTable, setEditMatchTable] = useState<MCQMatchTable | null>(null);
  const [editExamHistory, setEditExamHistory] = useState<ExamHistoryEntry[]>([]);
  const [editQuestionClassification, setEditQuestionClassification] = useState<QuestionClassification>("practice");
  const [newExamName, setNewExamName] = useState("");
  const [newExamYear, setNewExamYear] = useState("");

  const handleJsonFileUpload = (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      setErrorMessage("Please select a valid .json file.");
      return;
    }
    const fileSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const { data: parsed, error } = parseJSONWithLocation(text);
      if (error || !parsed) {
        setJsonUploadStats({
          fileName: file.name,
          fileSizeKb,
          questionCount: 0,
          isValidJson: false,
          error: error || "Invalid JSON syntax",
        });
        setErrorMessage(`JSON parse error: ${error || "Invalid JSON syntax"}`);
        return;
      }

      let qCount = 0;
      if (parsed.isMultiBlock && Array.isArray(parsed.blocks)) {
        qCount = parsed.blocks.reduce((acc: number, b: any) => {
          if (Array.isArray(b)) return acc + b.length;
          if (Array.isArray(b.questions)) return acc + b.questions.length;
          return acc + 1;
        }, 0);
      } else if (Array.isArray(parsed)) {
        qCount = parsed.length;
      } else if (Array.isArray(parsed.questions)) {
        qCount = parsed.questions.length;
      } else if (Array.isArray(parsed.data)) {
        qCount = parsed.data.length;
      } else {
        qCount = 1;
      }

      setPasteJsonText(text);
      setJsonUploadFile(file);
      setJsonUploadStats({
        fileName: file.name,
        fileSizeKb,
        questionCount: qCount,
        isValidJson: true,
      });
      setErrorMessage(null);
    };
    reader.readAsText(file);
  };

  const handleStartEdit = (r: ValidatedQuestionResult) => {
    setEditingQuestionId(r.tempId);
    setEditQuestionText(r.question || "");
    setEditQuestionType(r.questionType || r.type || "single_correct");
    const opts = r.options && r.options.length > 0 ? [...r.options] : ["", "", "", ""];
    while (opts.length < 4) opts.push("");
    setEditOptions(opts);
    setEditCorrectIndex(typeof r.correctIndex === "number" ? r.correctIndex : -1);
    setEditExplanation(r.explanation || "");
    setEditExamHistory(Array.isArray(r.examHistory) ? [...r.examHistory] : []);
    setEditQuestionClassification(r.questionClassification || (r.examHistory && r.examHistory.length > 0 ? "pyq" : "practice"));
    setNewExamName("");
    setNewExamYear("");
    setEditMatchTable(
      r.matchTable && Array.isArray(r.matchTable.rows)
        ? {
            leftTitle: r.matchTable.leftTitle || "LIST-I",
            rightTitle: r.matchTable.rightTitle || "LIST-II",
            rows: r.matchTable.rows.map((row) => ({ left: row.left || "", right: row.right || "" })),
          }
        : null
    );
  };

  const handleAddExamToEdit = () => {
    if (!newExamName.trim()) return;
    const yrStr = newExamYear ? toAsciiYear(newExamYear) : "";
    const yrNum = yrStr && /^\d{4}$/.test(yrStr) ? parseInt(yrStr, 10) : yrStr || undefined;
    const updated = mergeExamHistories(editExamHistory, [{
      examName: cleanExamName(newExamName),
      year: yrNum,
      verified: true
    }]);
    setEditExamHistory(updated);
    setEditQuestionClassification("pyq");
    setNewExamName("");
    setNewExamYear("");
  };

  const handleRemoveExamFromEdit = (idx: number) => {
    const updated = editExamHistory.filter((_, i) => i !== idx);
    setEditExamHistory(updated);
    if (updated.length === 0 && editQuestionClassification === "pyq") {
      setEditQuestionClassification("practice");
    }
  };

  const handleBulkAssignExams = () => {
    if (!bulkExamName.trim() || !parseResult) return;
    const yrStr = bulkExamYear ? toAsciiYear(bulkExamYear) : "";
    const yrNum = yrStr && /^\d{4}$/.test(yrStr) ? parseInt(yrStr, 10) : yrStr || undefined;
    const newEntry: ExamHistoryEntry = {
      examName: cleanExamName(bulkExamName),
      year: yrNum,
      verified: true,
    };

    setParseResult((prev) => {
      if (!prev) return prev;
      const updatedResults = prev.results.map((item) => {
        const isTarget = bulkExamTarget === "all" || selectedDraftIds.has(item.tempId);
        if (!isTarget) return item;

        const currentHistory = Array.isArray(item.examHistory) ? item.examHistory : [];
        const nextHistory = bulkExamAction === "replace"
          ? [newEntry]
          : mergeExamHistories(currentHistory, [newEntry]);

        return {
          ...item,
          examHistory: nextHistory,
          isPYQ: nextHistory.length > 0,
          questionClassification: "pyq" as QuestionClassification,
          exam: nextHistory[0]?.examName || item.exam,
          year: nextHistory[0]?.year ? String(nextHistory[0].year) : item.year,
        };
      });

      return {
        ...prev,
        results: updatedResults,
      };
    });

    setShowBulkExamModal(false);
  };

  const handleSaveEdit = (tempId: string) => {
    if (!editQuestionText.trim()) return;
    const cleanedOptions = editOptions.map((o) => o.trim()).filter(Boolean);
    const cleanedMatchTable =
      editMatchTable && Array.isArray(editMatchTable.rows)
        ? {
            leftTitle: editMatchTable.leftTitle || "LIST-I",
            rightTitle: editMatchTable.rightTitle || "LIST-II",
            rows: editMatchTable.rows.filter((row) => row.left.trim() || row.right.trim()),
          }
        : undefined;

    let becameValid = false;

    setParseResult((prev) => {
      if (!prev) return prev;
      const updatedResults = prev.results.map((item) => {
        if (item.tempId === tempId) {
          const normalized = normalizeQuestion({
            ...item,
            question: editQuestionText.trim(),
            text: editQuestionText.trim(),
            type: editQuestionType === "unsupported" ? "single_correct" : editQuestionType,
            questionType: editQuestionType === "unsupported" ? "single_correct" : editQuestionType,
            options: cleanedOptions,
            correctIndex: editCorrectIndex,
            answer: editCorrectIndex >= 0 ? ["A", "B", "C", "D", "E"][editCorrectIndex] || "A" : "",
            explanation: editExplanation.trim(),
            matchTable: cleanedMatchTable && cleanedMatchTable.rows.length > 0 ? cleanedMatchTable : undefined,
            examHistory: editExamHistory,
            questionClassification: editQuestionClassification,
            isPYQ: editExamHistory.length > 0 || editQuestionClassification === "pyq",
            unsupportedReason: undefined,
            ambiguousAnswerWarning: undefined,
            matchingErrorWarning: undefined,
          });
          const validation = validateQuestion(normalized, 1, {
            targetSubjectId: selectedSubjectId,
            targetChapterId: selectedChapterId,
            targetTopicId: selectedTopicId,
          });
          const hash = generateQuestionHash(normalized);
          const isDup = item.isDuplicate;
          let reviewCat = validation.reviewCategory;
          const errCats = [...validation.errorCategories];
          if (isDup) {
            if (!errCats.includes("Possible Duplicate")) errCats.push("Possible Duplicate");
            if (reviewCat === "ready") reviewCat = "duplicate";
          }
          becameValid = validation.isValid && normalized.correctIndex! >= 0;

          return {
            ...item,
            ...normalized,
            tempId: item.tempId,
            rawInput: item.rawInput,
            isDuplicate: isDup,
            duplicateOf: item.duplicateOf,
            isValid: validation.isValid,
            warnings: validation.warnings,
            errors: validation.errors,
            errorCategories: errCats,
            reviewCategory: reviewCat,
            hash,
            correctIndex: normalized.correctIndex ?? -1,
            examHistory: editExamHistory,
            questionClassification: editQuestionClassification,
            isPYQ: editExamHistory.length > 0 || editQuestionClassification === "pyq",
          };
        }
        return item;
      });
      return {
        ...prev,
        results: updatedResults,
        summary: {
          ...prev.summary,
          valid: updatedResults.filter((q) => q.isValid).length,
          warnings: updatedResults.filter((q) => q.warnings.length > 0).length,
          errors: updatedResults.filter((q) => !q.isValid).length,
          unsupported: updatedResults.filter((q) => q.reviewCategory === "unsupported").length,
        },
      };
    });

    if (becameValid) {
      setSelectedDraftIds((prev) => new Set([...prev, tempId]));
    }
    setEditingQuestionId(null);
  };

  const handleDeleteQuestion = (tempId: string) => {
    setParseResult(prev => {
      if (!prev) return prev;
      const updatedResults = prev.results.filter(item => item.tempId !== tempId);
      return {
        ...prev,
        results: updatedResults,
        summary: {
          ...prev.summary,
          total: updatedResults.length,
          valid: updatedResults.filter(q => q.isValid).length,
          warnings: updatedResults.filter(q => q.warnings.length > 0).length,
          errors: updatedResults.filter(q => !q.isValid).length,
          duplicates: updatedResults.filter(q => q.isDuplicate).length,
          unsupported: updatedResults.filter(q => q.reviewCategory === "unsupported").length,
        }
      };
    });
    setSelectedDraftIds(prev => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
  };

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const trimmed = content.trim();
        const isJsonFile =
          file.name.toLowerCase().endsWith(".json") ||
          ((trimmed.startsWith("{") || trimmed.startsWith("[")) && (trimmed.endsWith("}") || trimmed.endsWith("]"))) ||
          trimmed.includes('"schemaVersion"') ||
          trimmed.includes('"questions"') ||
          /```(?:json)?\s*[\{\[]/i.test(trimmed);
        if (isJsonFile) {
          setActiveInputTab("json");
          setPasteJsonText(content);
        } else {
          setActiveInputTab("text");
          setPasteText(content);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadErrorReport = () => {
    if (!parseResult) return;
    const problematic = parseResult.results.filter(
      (r) => !r.isValid || r.warnings.length > 0 || r.isDuplicate || r.reviewCategory !== "ready"
    );
    const report = {
      generatedAt: new Date().toISOString(),
      summary: parseResult.summary,
      flaggedQuestionsCount: problematic.length,
      flaggedQuestions: problematic.map((r, idx) => ({
        index: idx + 1,
        questionNumber: r.questionNumber,
        reviewCategory: r.reviewCategory,
        isValid: r.isValid,
        errorCategories: r.errorCategories || [],
        errors: r.errors,
        warnings: r.warnings,
        mappedQuestion: {
          type: r.questionType || r.type,
          question: r.question,
          options: r.options,
          answer: r.answer,
          correctIndex: r.correctIndex,
          matchTable: r.matchTable,
          table: r.table,
        },
        rawInput: r.rawInput,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disha2020-import-review-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeWithAI = async () => {
    let rawInput = (activeInputTab === "json" || activeInputTab === "file") ? jsonText : pasteText;
    let effectiveMode = activeInputTab === "file" ? "json" : activeInputTab;
    
    // Auto-detect JSON if pasted in Text tab
    if (activeInputTab === "text") {
      const trimmed = rawInput.trim();
      const isLikelyJson =
        ((trimmed.startsWith("{") || trimmed.startsWith("[")) && (trimmed.endsWith("}") || trimmed.endsWith("]"))) ||
        trimmed.includes('"schemaVersion"') ||
        trimmed.includes('"questions"') ||
        /```(?:json)?\s*[\{\[]/i.test(trimmed);

      if (isLikelyJson) {
        setActiveInputTab("json");
        setPasteJsonText(trimmed);
        rawInput = trimmed;
        effectiveMode = "json";
      }
    }

    if (activeInputTab === "file" && !rawInput.trim()) {
      return setErrorMessage("Please choose or upload a valid .json file first.");
    }

    if (!rawInput.trim()) return setErrorMessage("Please enter or upload content first.");
    
    setIsAiProcessing(true);
    setErrorMessage(null);
    setPreviewFilter("all");
    setProcessingStatus(effectiveMode === "json" ? "Parsing & validating JSON data..." : "Analyzing questions...");

    try {
      // 1. JSON Mode: Use smartJSONImport directly (supports varied keys, matchTable, validation, AI recovery for broken items)
      if (effectiveMode === "json") {
        const allCurriculumTopics = fetchedChapters.flatMap((c) =>
          (c.topics || []).map((t) => ({ ...t, chapterId: c.id, subjectId: c.subjectId }))
        );

        const parsed = await smartJSONImport(rawInput, existingHashes, {
          curriculum: {
            subjects: availableSubjects,
            chapters: fetchedChapters,
            topics: allCurriculumTopics,
          },
          targetSubjectId: selectedSubjectId,
          targetChapterId: selectedChapterId,
          targetTopicId: selectedTopicId,
          onProgress: (info) => {
            if (info?.message) setProcessingStatus(info.message);
          },
        });

        if (!parsed.success) {
          setErrorMessage(parsed.parseError || "Invalid JSON syntax. Please check the format.");
          return;
        }

        if (parsed.results.length === 0) {
          setErrorMessage("No questions detected in JSON. Please ensure your JSON contains questions or an array of question objects.");
          return;
        }

        // Attach any matching images by filename
        if (Object.keys(jsonAttachedFiles).length > 0) {
          parsed.results.forEach((d) => {
            if (d.question && !d.image) {
              for (const [fname, fdata] of Object.entries(jsonAttachedFiles)) {
                if (d.question.includes(fname)) {
                  d.image = {
                    type: fdata.type,
                    dataUrl: fdata.dataUrl,
                    fileName: fname,
                    alt: `Image ${fname}`,
                  };
                  break;
                }
              }
            }
          });
        }
        setParseResult({
          success: parsed.success,
          parseError: parsed.parseError,
          results: parsed.results,
          summary: {
            total: parsed.summary.total,
            valid: parsed.summary.valid,
            warnings: parsed.summary.needsReview,
            errors: parsed.summary.errors,
            duplicates: parsed.summary.duplicates,
            unsupported: parsed.summary.unsupported,
          },
        });
        const validIds = new Set<string>();
        parsed.results.forEach((q) => {
          if (q.isValid && q.correctIndex >= 0 && (!skipDuplicates || !q.isDuplicate)) {
            validIds.add(q.tempId);
          }
        });
        setSelectedDraftIds(validIds);
        setActiveStep("preview");
        return;
      }

      // 2. Universal Parser for Text / Mixed Formats
      const drafts = await UniversalSmartParser.parse(rawInput, selectedChapterId, selectedTopicId);
      
      // If we have attached images, try to map them by filename
      if (Object.keys(jsonAttachedFiles).length > 0 && drafts.length > 0) {
        drafts.forEach(d => {
          if (d.text && !d.image) {
            for (const [fname, fdata] of Object.entries(jsonAttachedFiles)) {
              if (d.text.includes(fname)) {
                d.image = {
                  type: fdata.type,
                  dataUrl: fdata.dataUrl,
                  fileName: fname,
                  alt: `Image ${fname}`
                };
                break;
              }
            }
          }
        });
      }

      const hasUsableDrafts = drafts && drafts.length > 0 && drafts.some((d) => Array.isArray(d.options) && d.options.length >= 2);
      if (hasUsableDrafts) {
        // Preserve exact parsed options & answers — NEVER fabricate missing options or default missing answers to "A"
        const schemaObj = {
          schemaVersion: 1,
          questions: drafts.map((d) => ({
            type: d.questionType || d.type || "single_correct",
            questionType: d.questionType || d.type || "single_correct",
            question: d.text || d.question || "",
            options: Array.isArray(d.options) ? d.options : [],
            answer: d.correctIndex >= 0 ? (["A", "B", "C", "D", "E"][d.correctIndex] || d.answer || "") : (d.answer || ""),
            correctIndex: typeof d.correctIndex === "number" ? d.correctIndex : -1,
            explanation: d.explanation || "",
            statements: d.statements,
            assertion: d.assertion,
            reason: d.reason,
            matchTable: d.matchTable,
            table: d.table || d.tableData,
            image: d.image,
            imageUrl: d.imageUrl,
            svgContent: (d as any).svgContent,
            examHistory: (d as any).examHistory,
            questionClassification: (d as any).questionClassification,
            isPYQ: (d as any).isPYQ,
            exam: (d as any).exam,
            year: (d as any).year,
            unsupportedReason: d.unsupportedReason,
            ocrUncertainties: d.ocrUncertainties,
            ambiguousAnswerWarning: d.ambiguousAnswerWarning,
            tableErrorWarning: d.tableErrorWarning,
            matchingErrorWarning: d.matchingErrorWarning,
            rawInput: d.rawInput,
          })),
        };
        const allCurriculumTopics = fetchedChapters.flatMap((c) =>
          (c.topics || []).map((t) => ({ ...t, chapterId: c.id, subjectId: c.subjectId }))
        );
        const parsed = processJSONImport(JSON.stringify(schemaObj), existingHashes, {
          curriculum: {
            subjects: availableSubjects,
            chapters: fetchedChapters,
            topics: allCurriculumTopics,
          },
          targetSubjectId: selectedSubjectId,
          targetChapterId: selectedChapterId,
          targetTopicId: selectedTopicId,
        });
        if (parsed.success && parsed.results.length > 0) {
          // Restore rawInput and multi-exam fields from drafts
          parsed.results.forEach((res, idx) => {
            if (drafts[idx]?.rawInput) res.rawInput = drafts[idx].rawInput;
            if ((drafts[idx] as any)?.examHistory) res.examHistory = (drafts[idx] as any).examHistory;
            if ((drafts[idx] as any)?.questionClassification) res.questionClassification = (drafts[idx] as any).questionClassification;
            if ((drafts[idx] as any)?.isPYQ !== undefined) res.isPYQ = (drafts[idx] as any).isPYQ;
            if ((drafts[idx] as any)?.exam !== undefined) res.exam = (drafts[idx] as any).exam;
            if ((drafts[idx] as any)?.year !== undefined) res.year = (drafts[idx] as any).year;
          });
          setParseResult(parsed);
          const validIds = new Set<string>();
          parsed.results.forEach((q) => {
            if (q.isValid && q.correctIndex >= 0 && (!skipDuplicates || !q.isDuplicate)) {
              validIds.add(q.tempId);
            }
          });
          setSelectedDraftIds(validIds);
          setActiveStep("preview");
          return;
        }
      }
      
      // AI Fallback for text only when deterministic parsing could not extract usable questions
      if (effectiveMode === "text") {
        setProcessingStatus("Formatting questions with AI assistant...");
        const { formatBatchQuestionsWithAI } = await import("../utils/aiFormatter");
        const aiDrafts = await formatBatchQuestionsWithAI(rawInput);
        if (aiDrafts && aiDrafts.length > 0) {
          const schemaObj = {
            schemaVersion: 1,
            questions: aiDrafts.map((d: any) => ({
              type: d.questionType || d.type || "single_correct",
              questionType: d.questionType || d.type || "single_correct",
              question: d.text || d.question || "",
              options: Array.isArray(d.options) ? d.options : [],
              answer: d.correctIndex >= 0 ? (["A", "B", "C", "D", "E"][d.correctIndex] || "") : (d.answer || ""),
              correctIndex: typeof d.correctIndex === "number" ? d.correctIndex : -1,
              explanation: d.explanation || "",
              statements: d.statements,
              assertion: d.assertion,
              reason: d.reason,
              matchTable: d.matchTable,
              table: d.table || d.tableData,
              rawInput: rawInput,
            })),
          };
          const allCurriculumTopics = fetchedChapters.flatMap((c) =>
          (c.topics || []).map((t) => ({ ...t, chapterId: c.id, subjectId: c.subjectId }))
        );
        const parsed = processJSONImport(JSON.stringify(schemaObj), existingHashes, {
          curriculum: {
            subjects: availableSubjects,
            chapters: fetchedChapters,
            topics: allCurriculumTopics,
          },
          targetSubjectId: selectedSubjectId,
          targetChapterId: selectedChapterId,
          targetTopicId: selectedTopicId,
        });
          if (parsed.success && parsed.results.length > 0) {
            setParseResult(parsed);
            const validIds = new Set<string>();
            parsed.results.forEach((q: any) => {
              if (q.isValid && q.correctIndex >= 0 && (!skipDuplicates || !q.isDuplicate)) {
                validIds.add(q.tempId);
              }
            });
            setSelectedDraftIds(validIds);
            setActiveStep("preview");

            recordAIUsage({
              queryType: "ai_import",
              model: "gemini-flash-lite-latest",
              inputChars: rawInput.length,
              outputChars: JSON.stringify(schemaObj).length,
              status: "success",
              promptSnippet: rawInput.slice(0, 100),
              responseSnippet: `Parsed ${parsed.results?.length || 0} questions`,
            });
            return;
          }
        }
        throw new Error("Unable to parse questions from the provided text. Please ensure questions have question text and at least 2 options (A, B, C, D or 1, 2, 3, 4).");
      } else {
        throw new Error("Could not parse JSON. Please check the format.");
      }
    } catch (err: any) { 
      setErrorMessage(err.message); 
    } finally { 
      setIsAiProcessing(false); 
    }
  };

  const handleManualAdd = () => {
    if (!manualQuestionText.trim()) return setErrorMessage("Question text is required.");
    const tempId = `manual-${Date.now()}`;
    const newResult: ValidatedQuestionResult = {
      tempId,
      question: manualQuestionText.trim(),
      options: [...manualOptions],
      correctIndex: manualCorrectIndex,
      answer: ["A", "B", "C", "D"][manualCorrectIndex],
      questionNumber: (parseResult?.results.length || 0) + 1,
      explanation: manualExplanation.trim() || "",
      type: manualQuestionType,
      questionType: manualQuestionType,
      isValid: true,
      warnings: [],
      errors: [],
      errorCategories: [],
      reviewCategory: "ready",
      hash: generateQuestionHash({
        question: manualQuestionText.trim(),
        options: [...manualOptions],
        answer: ["A", "B", "C", "D"][manualCorrectIndex],
      }),
      image: manualUploadedImage ? {
        type: manualUploadedImage.type,
        dataUrl: manualUploadedImage.dataUrl,
        svg: manualUploadedImage.sanitizedSvg,
        alt: manualUploadedImage.altText,
        fileName: manualUploadedImage.fileName
      } : undefined
    };
    setParseResult(prev => {
      const results = [...(prev?.results || []), newResult];
      return { success: true, results, summary: { total: results.length, valid: results.filter(r => r.isValid).length, warnings: 0, errors: 0, duplicates: 0 } };
    });
    setSelectedDraftIds(prev => new Set([...prev, tempId]));
    setManualQuestionText("");
    setManualOptions(["", "", "", ""]);
    setManualUploadedImage(null);
    setActiveStep("preview");
  };

  const handleCommitImport = async () => {
    if (isCommittingRef.current) {
      console.warn("[MCQ Import] Blocked: Import already in progress (Synchronous Guard).");
      return;
    }
    console.log("[MCQ Import] [Step: Parse] handleCommitImport triggered by user");
    isCommittingRef.current = true;
    setErrorMessage(null);
    setErrorCode(null);
    setCommitProgressText("");

    if (!parseResult) {
      console.warn("[MCQ Import] [Step: Parse] No parseResult available");
      isCommittingRef.current = false;
      return;
    }
    const selectedItems = parseResult.results.filter((q) => selectedDraftIds.has(q.tempId));
    if (selectedItems.length === 0) {
      setErrorMessage("No questions selected to import. Please select at least one valid question.");
      setErrorCode("no-selection");
      isCommittingRef.current = false;
      return;
    }

    const invalidSelected = selectedItems.filter((q) => !q.isValid || q.correctIndex < 0 || q.reviewCategory === "unsupported");
    if (invalidSelected.length > 0) {
      setErrorMessage(
        `${invalidSelected.length} selected question(s) are invalid, missing a correct answer, or unsupported. Please edit them first or click "Select Only Valid" before importing.`
      );
      setErrorCode("invalid-selection");
      isCommittingRef.current = false;
      return;
    }

    const toImport = selectedItems;

    setIsCommitting(true);
    console.log(`[MCQ Import] [Step: Parse] Beginning bulk import of ${toImport.length} questions...`);

    try {
      setProcessingStatus("Preparing questions for database...");

      const allCurriculumTopics = fetchedChapters.flatMap((c) =>
        (c.topics || []).map((t) => ({ ...t, chapterId: c.id, subjectId: c.subjectId }))
      );

      const finalQuestions: Question[] = [];
      for (let idx = 0; idx < toImport.length; idx++) {
        const d = toImport[idx];

        // Requirement 3: SVG and diagrams stored directly as string in document fields inline
        let cleanImageUrl = (d as any).imageUrl || d.image?.dataUrl || "";
        let cleanSvg = (d as any).svgContent || "";
        if (d.image?.dataUrl) {
          cleanImageUrl = d.image.dataUrl;
          if (d.image.type === "svg" || d.image.dataUrl.includes("<svg") || d.image.dataUrl.includes("data:image/svg+xml")) {
            cleanSvg = (d.image as any).sanitizedSvg || d.image.svg || cleanSvg || d.image.dataUrl;
          }
        }

        if (cleanImageUrl || cleanSvg) {
          const imgSize = cleanImageUrl.length + cleanSvg.length;
          console.log(`[MCQ Import] [Step: Image] Question index ${idx + 1}/${toImport.length}: SVG/diagram stored inline (${Math.round(imgSize / 1024)}KB).`);
        }

        // Resolve subject, chapter, and topic IDs with semantic fallback
        let resolvedSubjectId = selectedSubjectId === "all" ? (selectedChapter?.subjectId || availableSubjects[0]?.id || "sub_raj_hist") : (selectedSubjectId || availableSubjects[0]?.id || "sub_raj_hist");
        let resolvedChapterId = selectedChapterId || availableChapters[0]?.id || fetchedChapters[0]?.id || "";
        let resolvedTopicId = selectedTopicId || availableTopics[0]?.id || "";

        if (!selectedTopicId && d.topic && allCurriculumTopics.length > 0) {
          const tLower = String(d.topic).trim().toLowerCase();
          const matchT = allCurriculumTopics.find(
            (t) => (t.id && t.id.toLowerCase() === tLower) || (t.title && t.title.toLowerCase() === tLower) || (t.hindiTitle && t.hindiTitle.toLowerCase() === tLower)
          );
          if (matchT) {
            resolvedTopicId = matchT.id;
            if (matchT.chapterId && !selectedChapterId) resolvedChapterId = matchT.chapterId;
            if (matchT.subjectId && (!selectedSubjectId || selectedSubjectId === "all")) resolvedSubjectId = matchT.subjectId;
          }
        }
        if (!selectedChapterId && d.chapter && fetchedChapters.length > 0) {
          const cLower = String(d.chapter).trim().toLowerCase();
          const matchC = fetchedChapters.find(
            (c) => (c.id && c.id.toLowerCase() === cLower) || (c.title && c.title.toLowerCase() === cLower) || (c.hindiTitle && c.hindiTitle.toLowerCase() === cLower)
          );
          if (matchC) {
            resolvedChapterId = matchC.id;
            if (matchC.subjectId && (!selectedSubjectId || selectedSubjectId === "all")) resolvedSubjectId = matchC.subjectId;
            if (!resolvedTopicId && matchC.topics && matchC.topics.length > 0) {
              resolvedTopicId = matchC.topics[0].id;
            }
          }
        }
        if ((!selectedSubjectId || selectedSubjectId === "all") && d.subject && availableSubjects.length > 0) {
          const sLower = String(d.subject).trim().toLowerCase();
          const matchS = availableSubjects.find(
            (s) => (s.id && s.id.toLowerCase() === sLower) || (s.name && s.name.toLowerCase() === sLower) || (s.hindiName && s.hindiName.toLowerCase() === sLower)
          );
          if (matchS) resolvedSubjectId = matchS.id;
        }

        const tId = resolvedTopicId || selectedTopicId || (availableTopics[0]?.id) || (allCurriculumTopics[0]?.id) || "top_inscriptions";
        
        // Requirement: Stable deterministic ID for idempotency and duplicate prevention
        const contentHash = d.hash || generateQuestionHash({
          question: d.question,
          options: d.options,
          answer: d.answer || ["A", "B", "C", "D", "E"][d.correctIndex] || "A",
          table: d.table || (d as any).tableData,
          matchTable: d.matchTable,
        } as any);

        const stableId = `usr-q-${tId}-${contentHash}`;
        const resolvedQuestionType = d.questionType || d.type || (d.matchTable ? "match_following" : d.table ? "table_based" : "single_correct");

        finalQuestions.push({
          id: stableId,
          text: d.question,
          options: d.options as [string, string, string, string],
          correctIndex: d.correctIndex,
          explanation: d.explanation || "",
          subjectId: resolvedSubjectId,
          chapterId: resolvedChapterId,
          topicId: tId,
          questionType: resolvedQuestionType,
          matchTable: d.matchTable || undefined,
          table: d.table || (d as any).tableData || undefined,
          tableData: d.table || (d as any).tableData || undefined,
          statements: d.statements || undefined,
          assertion: d.assertion || undefined,
          reason: d.reason || undefined,
          instruction: (d as any).instruction || undefined,
          imageUrl: cleanImageUrl || undefined,
          svgContent: cleanSvg || undefined,
          image: d.image || undefined,
          createdAt: new Date().toISOString(),
          isUserAdded: true,
          examHistory: (() => {
            let hist = Array.isArray(d.examHistory) ? [...d.examHistory] : [];
            if (duplicateResolutionMode === "merge" && d.isDuplicate) {
              const allExisting = [
                ...(questionsStore.customQuestions || []),
                ...(questionsStore.cloudCacheQuestions || []),
                ...Object.values(questionsStore.editedQuestions || {}),
              ];
              const matched = allExisting.find((ex) => {
                const exHash = (ex as any).hash || generateQuestionHash({
                  question: ex.text,
                  options: ex.options || [],
                  answer: ["A", "B", "C", "D", "E"][ex.correctIndex ?? 0] || "A",
                } as any);
                return exHash === contentHash;
              });
              if (matched && Array.isArray((matched as any).examHistory)) {
                hist = mergeExamHistories((matched as any).examHistory, hist);
              }
            }
            return hist;
          })(),
          questionClassification: d.questionClassification || (Array.isArray(d.examHistory) && d.examHistory.length > 0 ? "pyq" : "practice"),
          isPYQ: d.isPYQ ?? (Boolean(Array.isArray(d.examHistory) && d.examHistory.length > 0)),
          exam: Array.isArray(d.examHistory) && d.examHistory.length > 0 && d.examHistory[0].examName ? d.examHistory[0].examName.trim() : (d.exam && String(d.exam).trim() ? String(d.exam).trim() : undefined),
          year: Array.isArray(d.examHistory) && d.examHistory.length > 0 && d.examHistory[0].year ? String(d.examHistory[0].year).trim() : (d.year && String(d.year).trim() ? String(d.year).trim() : undefined),
        } as Question);
      }

      // Handle PYQ destination if selected (with 30s timeout)
      if (importDestination === "pyq" && selectedPyqPaperId) {
        const paper = pyqPapersList.find((p) => p.id === selectedPyqPaperId);
        if (paper) {
          const dedupedQuestions = deduplicateQuestions([...(paper.questions || []), ...finalQuestions]);
          const updatedPaper = {
            ...paper,
            questions: dedupedQuestions,
            questionCount: dedupedQuestions.length,
          };
          await promiseWithTimeout(savePYQPaper(updatedPaper), 30000, "Save PYQ Paper");
        }
      } else if (importDestination === "live" && selectedLiveTestId) {
        const test = liveTestsList.find((t) => t.id === selectedLiveTestId);
        if (test) {
          const dedupedQuestions = deduplicateQuestions([...(test.questions || []), ...finalQuestions]);
          const updatedTest = {
            ...test,
            questions: dedupedQuestions,
            questionCount: dedupedQuestions.length,
          };
          await promiseWithTimeout(saveLiveTest(updatedTest), 30000, "Save Live Test");
        }
      }

      if (saveToPYQVault && finalQuestions.length > 0) {
        try {
          if (selectedPYQPaperId === "new" || !selectedPYQPaperId) {
            const paperTitle = newPYQTitle.trim() || `${selectedSubject?.name || "Official"} PYQ Paper ${new Date().getFullYear()}`;
            const newPaper: PYQPaper = {
              id: `pyq-admin-${crypto.randomUUID()}`,
              title: paperTitle,
              hindiTitle: paperTitle,
              examBoard: "RPSC",
              paperYear: new Date().getFullYear().toString(),
              category: selectedSubject?.name || "General Studies",
              description: `Official question paper created via Admin Import for ${paperTitle}`,
              durationMinutes: 180,
              totalMarks: finalQuestions.length * 2,
              marksPerQuestion: 2,
              negativeMarking: 0.33,
              questionCount: finalQuestions.length,
              questions: finalQuestions,
              officialKeyReleased: true,
              isPublished: true,
              createdAt: new Date().toISOString(),
            };
            await promiseWithTimeout(savePYQPaper(newPaper), 30000, "Save New PYQ Paper");
          } else {
            const existing = pyqPapersList.find((p) => p.id === selectedPYQPaperId);
            if (existing) {
              const dedupedQuestions = deduplicateQuestions([...(existing.questions || []), ...finalQuestions]);
              const updatedPaper: PYQPaper = {
                ...existing,
                questions: dedupedQuestions,
                questionCount: dedupedQuestions.length,
                updatedAt: new Date().toISOString(),
              };
              await promiseWithTimeout(savePYQPaper(updatedPaper), 30000, "Save PYQ Paper");
            }
          }
        } catch (_) {}
      }

      if (saveToLiveTest && selectedLiveTestId && finalQuestions.length > 0) {
        try {
          const targetTest = liveTestsList.find((t) => t.id === selectedLiveTestId);
          if (targetTest) {
            const dedupedQuestions = deduplicateQuestions([...(targetTest.questions || []), ...finalQuestions]);
            const updatedTest: LiveTest = {
              ...targetTest,
              questions: dedupedQuestions,
              questionCount: dedupedQuestions.length,
              updatedAt: new Date().toISOString(),
            };
            await promiseWithTimeout(saveLiveTest(updatedTest), 30000, "Save Target Live Test");
          }
        } catch (_) {}
      }

      console.log(`[MCQ Import] [Step: Batch Commit] Initiating writeBatch for ${finalQuestions.length} questions...`);
      setProcessingStatus("Connecting to database and committing questions...");

      const batchId = `batch_${Date.now()}`;
      const commitResult = await commitQuestions(finalQuestions, batchId, (progress) => {
        console.log(`[MCQ Import] [Step: Batch Commit] Progress: ${progress.progressText} (${progress.committedCount}/${progress.totalCount} docs saved)`);
        setCommitProgressText(progress.progressText);
        setProcessingStatus(`Saving to database: ${progress.progressText}`);
      });

      if (commitResult.success) {
        if (commitResult.committedCount > 0) {
          console.log(`[MCQ Import] [Step: Finished] Successfully imported ${commitResult.committedCount} questions to database.`);
          const successful = commitResult.failedCount === 0
            ? finalQuestions
            : finalQuestions.filter((q) => !commitResult.failedQuestionIds.includes(q.id));
          await onImportQuestions(successful, true);
        } else {
          console.log(`[MCQ Import] [Step: Finished] All ${commitResult.skippedCount ?? finalQuestions.length} questions already exist (0 writes).`);
        }
        setCommitSummary({
          importedCount: commitResult.committedCount,
          failedCount: commitResult.failedCount,
          batchId: commitResult.batchId || batchId,
          cloudSynced: commitResult.cloudSynced,
          message: commitResult.message,
          errors: commitResult.batchErrors || [],
        });
        setActiveStep("summary");
      } else {
        const errorMsg = commitResult.error || "Failed to commit questions to database.";
        const code = commitResult.errorCode || "import-failed";
        console.error(`[MCQ Import] [Step: Finished] Commit returned error [${code}]:`, errorMsg);
        const formatted = formatDatabaseError(new Error(errorMsg));
        setErrorCode(commitResult.errorCode || formatted.code);
        setErrorMessage(formatted.message);
      }
    } catch (err: any) {
      console.error("[MCQ Import] Uncaught error during bulk import:", err);
      const formatted = formatDatabaseError(err);
      setErrorCode(formatted.code);
      setErrorMessage(formatted.message);
    } finally {
      // Requirement 1: loading state is ALWAYS reset to false in finally
      isCommittingRef.current = false;
      setIsCommitting(false);
      setCommitProgressText("");
      setProcessingStatus("");
      console.log("[MCQ Import] [Step: Finished] Bulk import flow finished (loading state reset to false).");
    }
  };

  const processUploadedFile = async (file: File) => {
    setErrorMessage(null);
    const check = isValidPngOrSvg(file);
    if (!check.valid || !check.type) {
      setErrorMessage(check.error || "Invalid file format.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawContent = e.target?.result as string;
      if (!rawContent) return;
      if (check.type === "svg") {
        const textContent = typeof rawContent === "string" ? rawContent : new TextDecoder().decode(rawContent as any);
        const sanitized = sanitizeSvgContent(textContent);
        setManualUploadedImage({
          file,
          dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`,
          type: "svg",
          fileName: file.name,
          altText: manualQuestionText ? `Diagram for ${manualQuestionText.slice(0, 30)}` : file.name,
          sanitizedSvg: sanitized,
        });
      } else {
        setManualUploadedImage({
          file,
          dataUrl: rawContent,
          type: "png",
          fileName: file.name,
          altText: manualQuestionText ? `Diagram for ${manualQuestionText.slice(0, 30)}` : file.name,
        });
      }
    };
    if (check.type === "svg") reader.readAsText(file);
    else reader.readAsDataURL(file);
  };

  const handleBatchImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newMap = { ...jsonAttachedFiles };
    Array.from(files).forEach((file) => {
      const check = isValidPngOrSvg(file);
      if (check.valid && check.type) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const res = evt.target?.result as string;
          if (res) {
            let dataUrl = res;
            if (check.type === "svg" && !res.startsWith("data:")) {
              dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSvgContent(res))}`;
            }
            newMap[file.name] = { dataUrl, type: check.type as "png" | "svg", file };
            setJsonAttachedFiles({ ...newMap });
          }
        };
        if (check.type === "svg") reader.readAsText(file);
        else reader.readAsDataURL(file);
      }
    });
  };

  // Step Indicator matching reference image
  const StepIndicator = () => (
    <div className="px-6 py-4 flex items-center justify-between bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-slate-800">
      {[
        { id: "setup", label: "Setup & Input", num: 1 },
        { id: "preview", label: "Validation & Review", num: 2 },
      ].map((step, i) => {
        const isSetupActive = activeStep === "setup" || activeStep === "input";
        const isActive = (step.id === "setup" && isSetupActive) || (step.id === "preview" && (activeStep === "preview" || activeStep === "summary"));
        const isPast = step.id === "setup" && (activeStep === "preview" || activeStep === "summary");
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${isActive ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-md shadow-[#800020]/20" : isPast ? "bg-emerald-600 text-white" : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A]"}`}>
                {isPast ? <Check className="w-4 h-4" /> : step.num}
              </div>
              <span className={`text-xs font-black uppercase tracking-wider ${isActive ? "text-[#800020] dark:text-[#F47B20]" : isPast ? "text-emerald-600" : "text-[#52576A] dark:text-[#CBD2E1]"}`}>{step.label}</span>
            </div>
            {i === 0 && <div className="flex-1 h-0.5 mx-4 bg-[#E8D9C0] dark:bg-[#31374A] rounded-full" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  const MobileBottomAction = ({ onClick, disabled, icon: Icon, label, loading }: any) => (
    <div className="sticky bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-[#111622]/90 backdrop-blur-md border-t border-[#E8D9C0] dark:border-[#263045] z-50">
      <button 
        onClick={onClick} 
        disabled={disabled || loading}
        className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-[0_4px_16px_rgba(244,123,32,0.35)] bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 border border-[#C99A45]/40 text-white cursor-pointer"
      >
        {loading ? <InlineSpinner size="sm" /> : <Icon className="w-5 h-5" />}
        <span>{loading ? "Processing..." : label}</span>
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FFF9EF] dark:bg-[#171923] font-hindi overflow-hidden">
      {/* Top Accent Strip */}
      <div className="h-1 w-full bg-gradient-to-r from-[#800020] via-[#F47B20] to-[#C99A45] shrink-0" />
      {/* Header */}
      <div className="safe-top bg-white dark:bg-[#1F2330] border-b border-[#E8D9C0] dark:border-[#31374A] shrink-0">
        <div className="flex items-center justify-between px-5 h-16">
          <div className="flex items-center gap-3">
            {activeStep !== "setup" && activeStep !== "summary" && (
              <button onClick={() => setActiveStep(activeStep === "preview" ? "setup" : "setup")} className="p-2 -ml-2 rounded-xl text-[#52576A] dark:text-[#CBD2E1] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            )}
            <div>
              <h1 className="text-base font-black text-[#171923] dark:text-[#FFF9EF] leading-none">Bulk MCQ Text Import</h1>
              <p className="text-[10px] font-black uppercase text-[#800020] dark:text-[#F47B20] tracking-widest mt-1">Disha PYQ Question Bank</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1] hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <StepIndicator />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative bg-[#F8FAFC] dark:bg-[#020617] overflow-hidden">
        <AnimatePresence mode="wait">
          {activeStep === "setup" && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto flex-1 overflow-y-auto custom-scrollbar"
            >
              {/* Target Syllabus Card matching reference image */}
              <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Target Syllabus</h3>
                  </div>
                  {isLoadingSyllabus && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {/* Subject Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Subject</label>
                    <button
                      type="button"
                      onClick={() => openSelectionModal("subject")}
                      className="w-full h-12 flex items-center justify-between pl-4 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left cursor-pointer transition-all hover:border-blue-400/50"
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {selectedSubjectId === "all" 
                          ? "All Subjects" 
                          : (selectedSubject?.name || selectedSubject?.hindiName || "Select Subject")}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  </div>

                  {/* Chapter Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Chapter</label>
                    <button
                      type="button"
                      onClick={() => openSelectionModal("chapter")}
                      className="w-full h-12 flex items-center justify-between pl-4 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left cursor-pointer transition-all hover:border-blue-400/50"
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {selectedChapter?.title || selectedChapter?.hindiTitle || "Select Chapter"}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  </div>

                  {/* Topic Dropdown & Quick Add */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Topic</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddTopicInput(!showAddTopicInput);
                          setAddTopicError(null);
                        }}
                        className="text-[11px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{showAddTopicInput ? "Close" : "+ Add New Topic"}</span>
                      </button>
                    </div>

                    {/* Inline Add Topic Input Form */}
                    {showAddTopicInput && (
                      <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                            Create New Topic in "{selectedChapter?.title || selectedChapter?.hindiTitle || "Selected Chapter"}"
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newTopicTitle}
                            onChange={(e) => {
                              setNewTopicTitle(e.target.value);
                              if (addTopicError) setAddTopicError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCreateTopic();
                              }
                            }}
                            placeholder="Enter Topic Name (e.g. Monetary Policy)..."
                            className="flex-1 px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={isSavingNewTopic || !newTopicTitle.trim()}
                            onClick={() => handleCreateTopic()}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
                          >
                            {isSavingNewTopic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            <span>Create & Select</span>
                          </button>
                        </div>
                        {addTopicError && (
                          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{addTopicError}</p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => openSelectionModal("topic")}
                      className="w-full h-12 flex items-center justify-between pl-4 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left cursor-pointer transition-all hover:border-blue-400/50"
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {selectedTopic?.title || selectedTopic?.hindiTitle || "General Topic"}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>

                    {/* Selected Topic Badge Confirmation */}
                    {selectedTopic && (
                      <p className="text-[11px] text-purple-700 dark:text-purple-300 font-bold ml-1 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Selected Topic:</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{selectedTopic.hindiTitle || selectedTopic.title}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Save Options Card matching reference image */}
              <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <Settings2 className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Additional Save Options</h3>
                </div>

                {/* PYQ Vault Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">Also Add to PYQ Vault</span>
                      <p className="text-[10px] text-slate-500 font-bold">Link questions to an Official Past Year Paper</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={saveToPYQVault} onChange={(e) => setSaveToPYQVault(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                {saveToPYQVault && (
                  <div className="space-y-2 pt-1">
                    <select
                      value={selectedPYQPaperId}
                      onChange={(e) => setSelectedPYQPaperId(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-xs text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="new">+ Create New PYQ Paper</option>
                      {pyqPapersList.map((p) => (
                        <option key={p.id} value={p.id}>{p.examBoard} {p.paperYear} • {p.title}</option>
                      ))}
                    </select>
                    {selectedPYQPaperId === "new" && (
                      <input
                        type="text"
                        placeholder="Enter New Paper Title..."
                        value={newPYQTitle}
                        onChange={(e) => setNewPYQTitle(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                      />
                    )}
                  </div>
                )}

                {/* Live Test Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">Also Add to Live Test</span>
                      <p className="text-[10px] text-slate-500 font-bold">Instantly add these questions to an active Live Test</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={saveToLiveTest} onChange={(e) => setSaveToLiveTest(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>
                {saveToLiveTest && (
                  <select
                    value={selectedLiveTestId}
                    onChange={(e) => setSelectedLiveTestId(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl font-bold text-xs text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Choose Live Test --</option>
                    {liveTestsList.map((t) => (
                      <option key={t.id} value={t.id}>{t.title} ({t.questionCount} Qs)</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Universal Importer 4-Mode Input Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveInputTab("text")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeInputTab === "text" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">1. Simple Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab("json")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeInputTab === "json" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                >
                  <Code className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">2. Paste JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab("file")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeInputTab === "file" ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">3. Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab("manual")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeInputTab === "manual" ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">4. Manual Add</span>
                </button>
              </div>

              {/* METHOD A: SIMPLE TEXT IMPORT */}
              {activeInputTab === "text" && (
                <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        <FileText className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Method 1: Simple Text Import</h3>
                        <p className="text-[10px] font-bold text-slate-400">Automatic Multi-Exam PYQ Recognition + Ordinary Practice Questions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const sample = `Question: Which Constitutional Amendment Act gave constitutional status to Panchayati Raj institutions in India?\n\nA. 42nd Amendment\nB. 44th Amendment\nC. 73rd Amendment\nD. 74th Amendment\n\nAnswer: C\n\nExplanation: The 73rd Constitutional Amendment Act, 1992 granted constitutional status to Panchayati Raj institutions.\n\nSubject: Indian Polity\nChapter: Panchayati Raj\nTopic: 73rd Constitutional Amendment\n\nExam: CET 12th Level\nYear: 2023\n\nExam: Patwari\nYear: 2021\n\nQuestion: When is World Environment Day celebrated globally?\n\nA. June 5\nB. April 22\nC. September 16\nD. December 1\n\nAnswer: A\n\nExplanation: World Environment Day is celebrated annually on June 5.`;
                          setPasteText(sample);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center gap-1.5 hover:bg-blue-100 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Load Multi-Exam Sample</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTemplatesModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center gap-1.5 hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Templates</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={`Paste standard or numbered MCQs with multiple exams...\n\nExample:\nQuestion: Which Constitutional Amendment Act is related to Panchayati Raj in India?\nA. 42nd\nB. 73rd\nAnswer: B\nExam: CET 12th Level\nYear: 2023\nExam: Patwari\nYear: 2021`}
                      className="w-full h-64 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-blue-500/20 outline-none resize-none font-mono"
                    />
                    {pasteText && (
                      <button
                        type="button"
                        onClick={() => setPasteText("")}
                        className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase hover:bg-slate-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Multi-Exam Recognition Engine Active:</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Supports multiple <code className="text-blue-600 font-bold">Exam:</code> and <code className="text-blue-600 font-bold">Year:</code> tags per question. Questions with verified exams are labeled <span className="font-extrabold text-amber-600">PYQ</span>; questions without exam tags import cleanly as <span className="font-extrabold text-slate-700 dark:text-slate-200">Practice Questions</span> with no fake badges.
                    </p>
                  </div>
                </div>
              )}

              {/* METHOD B: JSON TEXT IMPORT */}
              {activeInputTab === "json" && (
                <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        <Code className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Method 2: Paste JSON Format</h3>
                        <p className="text-[10px] font-bold text-slate-400">Disha PYQ Schema v1 Compatible • Unlimited Multi-Exam Array</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const sample = JSON.stringify({
                            schemaVersion: 1,
                            questions: [
                              {
                                type: "single_correct",
                                question: "Which Constitutional Amendment Act gave constitutional status to Panchayati Raj institutions in India?",
                                options: ["42nd Amendment", "44th Amendment", "73rd Amendment", "74th Amendment"],
                                answer: "C",
                                explanation: "The 73rd Constitutional Amendment Act, 1992 granted constitutional status to Panchayati Raj institutions.",
                                subject: "Indian Polity",
                                chapter: "Panchayati Raj",
                                topic: "73rd Constitutional Amendment"
                              }
                            ]
                          }, null, 2);
                          setPasteJsonText(sample);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center gap-1.5 hover:bg-indigo-100 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Load Sample JSON</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={jsonText}
                      onChange={(e) => setPasteJsonText(e.target.value)}
                      placeholder={`{\n  "schemaVersion": 1,\n  "questions": [\n    {\n      "type": "single_correct",\n      "question": "Question text",\n      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],\n      "answer": "A",\n      "explanation": "Explanation",\n      "subject": "Subject",\n      "chapter": "Chapter",\n      "topic": "Topic"\n    }\n  ]\n}`}
                      className="w-full h-64 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none font-mono"
                    />
                    {jsonText && (
                      <button
                        type="button"
                        onClick={() => setPasteJsonText("")}
                        className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase hover:bg-slate-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 font-bold">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Supports schemaVersion 1, root array, single exam or multiple exams in <code className="text-indigo-600 font-bold">examHistory</code>.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => jsonImgFilesRef.current?.click()}
                      className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Attach Question Images</span>
                    </button>
                    <input 
                      type="file" 
                      ref={jsonImgFilesRef} 
                      className="hidden" 
                      multiple 
                      accept="image/png,image/svg+xml" 
                      onChange={handleBatchImagesUpload} 
                    />
                  </div>
                </div>
              )}

              {/* METHOD C: JSON FILE UPLOAD (.json) */}
              {activeInputTab === "file" && (
                <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                        <Upload className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Method 3: JSON File Upload (.json)</h3>
                        <p className="text-[10px] font-bold text-slate-400">Drag & drop or browse a .json question bank file</p>
                      </div>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={jsonUploadInputRef}
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleJsonFileUpload(e.target.files[0]);
                    }}
                  />

                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files?.[0]) handleJsonFileUpload(e.dataTransfer.files[0]);
                    }}
                    onClick={() => jsonUploadInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                      jsonUploadStats?.isValidJson
                        ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20"
                        : "border-purple-300 dark:border-purple-800/60 bg-purple-50/20 dark:bg-purple-950/10 hover:border-purple-500 hover:bg-purple-50/50"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                      <FileCode className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">
                        Click to select or drag & drop a <span className="text-purple-600 dark:text-purple-400">.json file</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">
                        Compatible with standard Disha PYQ schema v1 and multi-exam format
                      </p>
                    </div>
                  </div>

                  {/* File Metadata & Stats Card */}
                  {jsonUploadStats && (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      jsonUploadStats.isValidJson 
                        ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
                        : "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          jsonUploadStats.isValidJson ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                        }`}>
                          {jsonUploadStats.isValidJson ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {jsonUploadStats.fileName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold">
                            <span className="text-slate-500">{jsonUploadStats.fileSizeKb} KB</span>
                            <span>•</span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-black">
                              {jsonUploadStats.questionCount} Questions Detected
                            </span>
                          </div>
                          {jsonUploadStats.error && (
                            <p className="text-[10px] font-bold text-rose-600 mt-1">
                              Error: {jsonUploadStats.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setJsonUploadFile(null);
                          setJsonUploadStats(null);
                          setPasteJsonText("");
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                      >
                        Change File
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px] font-bold text-slate-500">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Schema v1 backward-compatible</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Unlimited multi-exam history</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Safe duplicate detection</span>
                    </div>
                  </div>
                </div>
              )}

              <input
                type="file"
                ref={docFileInputRef}
                className="hidden"
                accept=".json,.txt,.md,.csv,.html,application/json,text/plain,text/html"
                onChange={handleFileUpload}
              />

              {activeInputTab === "manual" && (
                <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <Plus className="w-4.5 h-4.5" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Manual Question Entry</h3>
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Question Text</label>
                      <textarea
                        value={manualQuestionText}
                        onChange={(e) => setManualQuestionText(e.target.value)}
                        placeholder="Enter the question here..."
                        className="w-full h-24 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {manualOptions.map((opt, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Option {String.fromCharCode(65 + idx)}</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const n = [...manualOptions] as [string, string, string, string];
                                n[idx] = e.target.value;
                                setManualOptions(n);
                              }}
                              className={`flex-1 p-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900 border outline-none focus:ring-2 focus:ring-emerald-500/20 ${manualCorrectIndex === idx ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-200 dark:border-slate-800"}`}
                              placeholder={`Option ${String.fromCharCode(65 + idx)}...`}
                            />
                            <button
                              onClick={() => setManualCorrectIndex(idx)}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${manualCorrectIndex === idx ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-emerald-50"}`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Explanation (Solution)</label>
                      <textarea
                        value={manualExplanation}
                        onChange={(e) => setManualExplanation(e.target.value)}
                        placeholder="Provide reasoning or solution for this answer..."
                        className="w-full h-20 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="pt-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition-all w-full justify-center group"
                      >
                        <FileImage className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black">Attach Diagram / SVG Illustration</span>
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/svg+xml" onChange={(e) => e.target.files?.[0] && processUploadedFile(e.target.files[0])} />
                      
                      {manualUploadedImage && (
                        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                              <img src={manualUploadedImage.dataUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-900 dark:text-white truncate max-w-[150px]">{manualUploadedImage.fileName}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{manualUploadedImage.type}</p>
                            </div>
                          </div>
                          <button onClick={() => setManualUploadedImage(null)} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleManualAdd}
                    disabled={!manualQuestionText.trim() || manualOptions.some(o => !o.trim())}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Preview & Add Question</span>
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}

              {/* Bottom Parse Button matching reference image */}
              {activeInputTab !== "manual" && (
              <button
                onClick={handleAnalyzeWithAI}
                disabled={isAiProcessing || (activeInputTab === "text" ? !pasteText.trim() : !jsonText.trim())}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm text-white bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 border border-[#C99A45]/40 transition-all shadow-[0_4px_16px_rgba(244,123,32,0.35)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isAiProcessing ? <InlineSpinner size="sm" /> : <Sparkles className="w-5 h-5 text-[#FFF9EF]" />}
                <span>{isAiProcessing ? (processingStatus || "Analyzing questions with AI...") : "Preview & Analyze Questions →"}</span>
              </button>
              )}
            </motion.div>
          )}

          {activeStep === "preview" && parseResult && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col min-h-0 overflow-hidden w-full"
            >
              {/* Validation & Review Bar */}
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0 flex flex-col gap-3 z-10 max-w-3xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-blue-500">Validation & Review</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1">
                      {selectedCount} of {parseResult.results.length} Questions Selected
                    </span>
                    <div className="flex flex-wrap items-center gap-1 mt-2 text-[11px] font-bold">
                      <span className="text-slate-400">Target:</span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold truncate max-w-[130px]">
                        {selectedSubject?.name || "Subject"}
                      </span>
                      <span className="text-slate-400">›</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold truncate max-w-[150px]">
                        {selectedChapter?.hindiTitle || selectedChapter?.title || "Chapter"}
                      </span>
                      <span className="text-slate-400">›</span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold truncate max-w-[150px] flex items-center gap-1">
                        <Layers className="w-3 h-3 text-purple-500 shrink-0" />
                        {selectedTopic?.hindiTitle || selectedTopic?.title || "General Topic"}
                      </span>
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const validIds = new Set<string>();
                        parseResult.results.forEach((r) => {
                          if (r.isValid && r.correctIndex >= 0 && (duplicateResolutionMode !== "skip" || !r.isDuplicate)) {
                            validIds.add(r.tempId);
                          }
                        });
                        setSelectedDraftIds(validIds);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider cursor-pointer hover:bg-emerald-100"
                    >
                      Select All Valid
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDraftIds(
                          new Set(
                            selectedDraftIds.size === parseResult.results.length
                              ? []
                              : parseResult.results.filter((r) => r.isValid && r.correctIndex >= 0).map((r) => r.tempId)
                          )
                        )
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {selectedDraftIds.size > 0 ? "Deselect All" : "Select Ready"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBulkExamModal(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>Bulk Assign Exam</span>
                    </button>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Dupes:</span>
                      <select
                        value={duplicateResolutionMode}
                        onChange={(e) => {
                          const mode = e.target.value as "skip" | "merge" | "update";
                          setDuplicateResolutionMode(mode);
                          const shouldSkip = mode === "skip";
                          setSkipDuplicates(shouldSkip);
                          if (shouldSkip) {
                            setSelectedDraftIds((prev) => {
                              const next = new Set(prev);
                              parseResult.results.forEach((r) => {
                                if (r.isDuplicate) next.delete(r.tempId);
                              });
                              return next;
                            });
                          }
                        }}
                        className="bg-transparent font-black text-blue-600 dark:text-blue-400 outline-none cursor-pointer"
                      >
                        <option value="skip">Skip</option>
                        <option value="merge">Merge History</option>
                        <option value="update">Update</option>
                      </select>
                    </div>
                    {parseResult.results.some((r) => !r.isValid || r.warnings.length > 0 || r.isDuplicate) && (
                      <button
                        type="button"
                        onClick={handleDownloadErrorReport}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:bg-amber-100"
                        title="Download JSON Error & Review Report"
                      >
                        <Download className="w-3 h-3" />
                        <span>Error Report</span>
                      </button>
                    )}
                    <button
                      onClick={() => setActiveStep("setup")}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 text-[10px] font-black uppercase cursor-pointer"
                    >
                      Back to Setup
                    </button>
                  </div>
                </div>

                {/* Categorized Review Filter Tabs */}
                {(() => {
                  const counts = {
                    all: parseResult.results.length,
                    ready: parseResult.results.filter((r) => (r.reviewCategory || (r.isValid ? "ready" : "invalid")) === "ready").length,
                    pyq: parseResult.results.filter((r) => r.isPYQ || r.questionClassification === "pyq" || r.questionClassification === "pyq_practice" || (Array.isArray(r.examHistory) && r.examHistory.length > 0)).length,
                    practice: parseResult.results.filter((r) => r.questionClassification === "practice" || (!r.isPYQ && (!r.examHistory || r.examHistory.length === 0))).length,
                    multi_exam: parseResult.results.filter((r) => Array.isArray(r.examHistory) && r.examHistory.length > 1).length,
                    unverified: parseResult.results.filter((r) => (Array.isArray(r.examHistory) && r.examHistory.some((e) => e.verified === false)) || r.warnings.some((w) => w.toLowerCase().includes("unverified"))).length,
                    needs_review: parseResult.results.filter((r) => r.reviewCategory === "needs_review").length,
                    invalid: parseResult.results.filter((r) => r.reviewCategory === "invalid" || (!r.isValid && r.reviewCategory !== "unsupported")).length,
                    unsupported: parseResult.results.filter((r) => r.reviewCategory === "unsupported").length,
                    duplicate: parseResult.results.filter((r) => r.isDuplicate || r.reviewCategory === "duplicate").length,
                  };
                  const tabs: { id: "all" | ImportReviewCategory | "pyq" | "practice" | "multi_exam" | "unverified"; label: string; count: number; color: string }[] = [
                    { id: "all", label: "All Questions", count: counts.all, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
                    { id: "ready", label: "Ready to Import", count: counts.ready, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
                    { id: "pyq", label: "PYQs", count: counts.pyq, color: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
                    { id: "practice", label: "Practice Only", count: counts.practice, color: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
                    { id: "multi_exam", label: "Multi-Exam", count: counts.multi_exam, color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" },
                    { id: "unverified", label: "Unverified Exams", count: counts.unverified, color: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
                    { id: "needs_review", label: "Needs Review", count: counts.needs_review, color: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
                    { id: "invalid", label: "Invalid", count: counts.invalid, color: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
                    { id: "duplicate", label: "Duplicates", count: counts.duplicate, color: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
                  ];
                  return (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPreviewFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                            previewFilter === tab.id
                              ? "ring-2 ring-blue-500 shadow-xs " + tab.color
                              : "opacity-75 hover:opacity-100 " + tab.color
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[9px]">{tab.count}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Scrollable Question List */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 pb-20 space-y-3 max-w-3xl mx-auto w-full">
                <div className="space-y-3">
                  {parseResult.results
                    .map((r, originalIdx) => ({ r, originalIdx }))
                    .filter(({ r }) => {
                      if (previewFilter === "all") return true;
                      if (previewFilter === "pyq") return Boolean(r.isPYQ || r.questionClassification === "pyq" || r.questionClassification === "pyq_practice" || (Array.isArray(r.examHistory) && r.examHistory.length > 0));
                      if (previewFilter === "practice") return Boolean(r.questionClassification === "practice" || (!r.isPYQ && (!r.examHistory || r.examHistory.length === 0)));
                      if (previewFilter === "multi_exam") return Boolean(Array.isArray(r.examHistory) && r.examHistory.length > 1);
                      if (previewFilter === "unverified") return Boolean((Array.isArray(r.examHistory) && r.examHistory.some((e) => e.verified === false)) || r.warnings.some((w) => w.toLowerCase().includes("unverified")));
                      if (previewFilter === "duplicate") return Boolean(r.isDuplicate || r.reviewCategory === "duplicate");
                      if (previewFilter === "invalid") return Boolean(r.reviewCategory === "invalid" || (!r.isValid && r.reviewCategory !== "unsupported"));
                      if (previewFilter === "ready") return Boolean((r.reviewCategory || (r.isValid ? "ready" : "invalid")) === "ready");
                      return r.reviewCategory === previewFilter;
                    })
                    .map(({ r, originalIdx: i }) => {
                      const isShowingRaw = rawCompareIds.has(r.tempId);
                      const reviewBadge = (() => {
                        if (r.reviewCategory === "unsupported") return { text: "Unsupported Type", cls: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" };
                        if (!r.isValid || r.reviewCategory === "invalid") return { text: "Invalid Question", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" };
                        if (r.isDuplicate || r.reviewCategory === "duplicate") return { text: "Possible Duplicate", cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
                        if (r.reviewCategory === "needs_review") return { text: "Needs Review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" };
                        return { text: "Ready to Import", cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" };
                      })();

                      return (
                        <div key={r.tempId} className={`p-4 rounded-2xl border transition-all ${selectedDraftIds.has(r.tempId) ? "bg-white dark:bg-slate-900 border-blue-400 dark:border-blue-500 shadow-md" : "bg-white/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"}`}>
                          {editingQuestionId === r.tempId ? (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-blue-300">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-black text-blue-600">Edit Question #{i + 1}</span>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={editQuestionType}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditQuestionType(val);
                                      if (val === "match_following" && !editMatchTable) {
                                        setEditMatchTable({
                                          leftTitle: "LIST-I",
                                          rightTitle: "LIST-II",
                                          rows: [
                                            { left: "A. ", right: "1. " },
                                            { left: "B. ", right: "2. " },
                                            { left: "C. ", right: "3. " },
                                            { left: "D. ", right: "4. " },
                                          ],
                                        });
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                                  >
                                    <option value="single_correct">Single Correct MCQ</option>
                                    <option value="statement_based">Statement-Based</option>
                                    <option value="assertion_reason">Assertion-Reason</option>
                                    <option value="match_following">Match the Following</option>
                                    <option value="table_based">Table-Based</option>
                                    <option value="math">Mathematical / Numerical</option>
                                  </select>
                                  <button onClick={() => setEditingQuestionId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
                                </div>
                              </div>
                              <textarea
                                value={editQuestionText}
                                onChange={(e) => setEditQuestionText(e.target.value)}
                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border text-xs font-bold text-slate-900 dark:text-white"
                                rows={3}
                                placeholder="Question text..."
                              />

                              {/* Match the Following Editor */}
                              {(editQuestionType === "match_following" || editMatchTable) && (
                                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Match Table (LIST-I / LIST-II)</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditMatchTable((prev) => ({
                                          leftTitle: prev?.leftTitle || "LIST-I",
                                          rightTitle: prev?.rightTitle || "LIST-II",
                                          rows: [...(prev?.rows || []), { left: "", right: "" }],
                                        }))
                                      }
                                      className="text-[10px] font-black text-indigo-600 hover:underline cursor-pointer"
                                    >
                                      + Add Row
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={editMatchTable?.leftTitle || ""}
                                      onChange={(e) =>
                                        setEditMatchTable((prev) => ({
                                          leftTitle: e.target.value,
                                          rightTitle: prev?.rightTitle || "LIST-II",
                                          rows: prev?.rows || [],
                                        }))
                                      }
                                      placeholder="Left Column Title (LIST-I)"
                                      className="p-1.5 rounded-lg border text-xs font-bold bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                    <input
                                      type="text"
                                      value={editMatchTable?.rightTitle || ""}
                                      onChange={(e) =>
                                        setEditMatchTable((prev) => ({
                                          leftTitle: prev?.leftTitle || "LIST-I",
                                          rightTitle: e.target.value,
                                          rows: prev?.rows || [],
                                        }))
                                      }
                                      placeholder="Right Column Title (LIST-II)"
                                      className="p-1.5 rounded-lg border text-xs font-bold bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    {(editMatchTable?.rows || []).map((row, rIdx) => (
                                      <div key={rIdx} className="flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          value={row.left}
                                          onChange={(e) => {
                                            const nextRows = [...(editMatchTable?.rows || [])];
                                            nextRows[rIdx] = { ...nextRows[rIdx], left: e.target.value };
                                            setEditMatchTable((prev) => ({
                                              leftTitle: prev?.leftTitle || "LIST-I",
                                              rightTitle: prev?.rightTitle || "LIST-II",
                                              rows: nextRows,
                                            }));
                                          }}
                                          placeholder={`A. Item ${rIdx + 1}`}
                                          className="flex-1 p-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                        <input
                                          type="text"
                                          value={row.right}
                                          onChange={(e) => {
                                            const nextRows = [...(editMatchTable?.rows || [])];
                                            nextRows[rIdx] = { ...nextRows[rIdx], right: e.target.value };
                                            setEditMatchTable((prev) => ({
                                              leftTitle: prev?.leftTitle || "LIST-I",
                                              rightTitle: prev?.rightTitle || "LIST-II",
                                              rows: nextRows,
                                            }));
                                          }}
                                          placeholder={`${rIdx + 1}. Match ${rIdx + 1}`}
                                          className="flex-1 p-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextRows = (editMatchTable?.rows || []).filter((_, idx) => idx !== rIdx);
                                            setEditMatchTable((prev) =>
                                              prev ? { ...prev, rows: nextRows } : null
                                            );
                                          }}
                                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-slate-500">
                                    Options & Correct Answer {editCorrectIndex < 0 && <span className="text-rose-600">(Click A/B/C/D to set correct answer)</span>}
                                  </span>
                                  {editOptions.length < 5 && (
                                    <button
                                      type="button"
                                      onClick={() => setEditOptions([...editOptions, ""])}
                                      className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer"
                                    >
                                      + Add Option E
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {editOptions.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex gap-1.5 items-center">
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => {
                                          const nextOpts = [...editOptions];
                                          nextOpts[oIdx] = e.target.value;
                                          setEditOptions(nextOpts);
                                        }}
                                        placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                        className={`flex-1 p-2 rounded-xl text-xs bg-white dark:bg-slate-800 border text-slate-900 dark:text-white ${editCorrectIndex === oIdx ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-200 dark:border-slate-700"}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setEditCorrectIndex(oIdx)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black cursor-pointer ${editCorrectIndex === oIdx ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}
                                        title="Mark as Correct Option"
                                      >
                                        {String.fromCharCode(65 + oIdx)}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <textarea
                                value={editExplanation}
                                onChange={(e) => setEditExplanation(e.target.value)}
                                className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border text-xs text-slate-900 dark:text-white"
                                rows={2}
                                placeholder="Explanation (optional)..."
                              />

                              {/* Exam History & Classification Section */}
                              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="text-[10px] font-black uppercase text-slate-500">
                                    Exam Classification & History
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400">Classification:</span>
                                    <select
                                      value={editQuestionClassification}
                                      onChange={(e) => setEditQuestionClassification(e.target.value as QuestionClassification)}
                                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-700 dark:text-slate-200 outline-none"
                                    >
                                      <option value="pyq">PYQ (Verified Exam)</option>
                                      <option value="practice">Practice Question</option>
                                      <option value="pyq_practice">PYQ + Practice</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Active Exam Chips */}
                                <div className="flex flex-wrap gap-1.5">
                                  {editExamHistory.length > 0 ? (
                                    editExamHistory.map((ex, exIdx) => (
                                      <span
                                        key={exIdx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-extrabold"
                                      >
                                        <span>{ex.examName}{ex.year ? ` • ${ex.year}` : ""}</span>
                                        {ex.verified === false && (
                                          <span className="text-[8px] bg-rose-100 text-rose-700 px-1 rounded font-black">Unverified</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveExamFromEdit(exIdx)}
                                          className="text-amber-500 hover:text-rose-600 ml-0.5 cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-400 italic">
                                      No exams associated (Standard Practice Question)
                                    </span>
                                  )}
                                </div>

                                {/* Add New Exam Association */}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <input
                                    type="text"
                                    value={newExamName}
                                    onChange={(e) => setNewExamName(e.target.value)}
                                    placeholder="Add Exam (e.g. CET 12th Level, Patwari)..."
                                    className="flex-1 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                                  />
                                  <input
                                    type="text"
                                    value={newExamYear}
                                    onChange={(e) => setNewExamYear(e.target.value)}
                                    placeholder="Year (e.g. 2023)"
                                    className="w-20 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleAddExamToEdit}
                                    disabled={!newExamName.trim()}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#7045D8] hover:bg-[#5B32BF] text-white text-[10px] font-black disabled:opacity-50 cursor-pointer"
                                  >
                                    + Add Exam
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  onClick={() => setEditingQuestionId(null)}
                                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(r.tempId)}
                                  className="px-4 py-1.5 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  Save & Re-Validate
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <input 
                                type="checkbox" checked={selectedDraftIds.has(r.tempId)} 
                                onChange={() => { const n = new Set(selectedDraftIds); if(n.has(r.tempId)) n.delete(r.tempId); else n.add(r.tempId); setSelectedDraftIds(n); }}
                                className="w-5 h-5 rounded-lg text-blue-600 focus:ring-0 cursor-pointer mt-1" 
                              />
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex items-center justify-between flex-wrap gap-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                                      Q {i + 1} • {r.questionType || r.type || "single_correct"}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reviewBadge.cls}`}>
                                      {reviewBadge.text}
                                    </span>
                                    {(r.errorCategories || []).map((cat) => (
                                      <span
                                        key={cat}
                                        className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                      >
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {r.rawInput !== undefined && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRawCompareIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(r.tempId)) next.delete(r.tempId);
                                            else next.add(r.tempId);
                                            return next;
                                          });
                                        }}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer ${
                                          isShowingRaw
                                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                            : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800"
                                        }`}
                                        title="Compare Original Raw Input vs Mapped Output"
                                      >
                                        <Code className="w-3 h-3" />
                                        <span>{isShowingRaw ? "Hide Raw" : "Compare Raw"}</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleStartEdit(r)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                      title="Edit Question"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteQuestion(r.tempId)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Validation Errors & Warnings */}
                                {(r.errors.length > 0 || r.warnings.length > 0) && (
                                  <div className="space-y-1">
                                    {r.errors.map((err, eIdx) => (
                                      <div key={eIdx} className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center justify-between gap-2">
                                        <span>• {err}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleStartEdit(r)}
                                          className="text-[10px] font-black underline shrink-0 cursor-pointer"
                                        >
                                          Fix Now
                                        </button>
                                      </div>
                                    ))}
                                    {r.warnings.map((warn, wIdx) => (
                                      <div key={wIdx} className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                                        • {warn}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Side-by-Side Raw vs Mapped Comparison */}
                                {isShowingRaw && r.rawInput !== undefined && (
                                  <div className="p-2.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto border border-slate-700">
                                    <div className="text-[9px] font-black uppercase text-indigo-400 mb-1">Original Raw Source Data:</div>
                                    <pre className="whitespace-pre-wrap break-words leading-relaxed">
                                      {typeof r.rawInput === "string" ? r.rawInput : JSON.stringify(r.rawInput, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                <ParsedQuestion 
                                  text={r.question} 
                                  question={r} 
                                  fontSizeClass="text-xs sm:text-sm font-bold text-slate-900 dark:text-white" 
                                />
                                {r.options.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                    {r.options.map((opt, oIdx) => (
                                      <div key={oIdx} className={`p-2 rounded-xl text-xs font-semibold ${r.correctIndex === oIdx ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"}`}>
                                        <span className="font-black mr-1.5">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
                                    No options detected — Click Edit to enter options.
                                  </div>
                                )}
                                {r.correctIndex < 0 && (
                                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                                    <span>Correct Answer is missing (not fabricated)</span>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(r)}
                                      className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                    >
                                      Select Answer
                                    </button>
                                  </div>
                                )}
                                {r.explanation && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1 border-t border-slate-100 dark:border-slate-800">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Explanation:</span> {r.explanation}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Separate Import Action Footer */}
              <div className="p-4 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 shrink-0 z-20 shadow-2xl safe-bottom w-full">
                <div className="max-w-3xl mx-auto w-full space-y-2.5">
                  {/* Requirement 7: Clear Error Message Banner in Preview Screen */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-2">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200 font-mono">
                            {errorCode ? `ERROR: ${errorCode}` : "IMPORT ERROR"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage(null);
                              setErrorCode(null);
                            }}
                            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-bold cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                        <p className="font-semibold text-xs leading-snug">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Requirement 5: Live Batch Progress Banner */}
                  {isCommitting && (
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{processingStatus || "Saving questions to database..."}</span>
                      </div>
                      {commitProgressText && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#7045D8] text-white font-mono text-[11px] font-black tracking-wider shrink-0">
                          {commitProgressText}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleCommitImport}
                    disabled={isCommitting || selectedCount === 0}
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isCommitting ? <InlineSpinner size="sm" /> : <Check className="w-5 h-5" />}
                    <span>
                      {isCommitting
                        ? (commitProgressText ? `Saving to Database (${commitProgressText})...` : "Saving to Database...")
                        : `Save ${selectedCount} Questions to Database`}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeStep === "summary" && commitSummary && (
            <motion.div 
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="p-6 max-w-lg mx-auto text-center space-y-6 pt-12"
            >
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-600/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Import Successful!</h2>
                <p className="text-xs font-bold text-slate-500">
                  Successfully imported <span className="text-emerald-600 font-black">{commitSummary.importedCount}</span> questions into the database.
                </p>
                {commitSummary.message && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 mt-2">
                    {commitSummary.message}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-black text-sm text-white bg-[#7045D8] hover:bg-[#5B32BF] shadow-xl shadow-[#7045D8]/20 cursor-pointer"
              >
                Done & Close
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showTemplatesModal && (
        <ImportTemplatesModal isOpen={showTemplatesModal} onClose={() => setShowTemplatesModal(false)} />
      )}
      <SyllabusSelectionModal
        isOpen={isSyllabusSheetOpen}
        onClose={() => setIsSyllabusSheetOpen(false)}
        type={selectingField}
        subjects={availableSubjects}
        chapters={fetchedChapters}
        selectedSubjectId={selectedSubjectId}
        selectedChapterId={selectedChapterId}
        selectedTopicId={selectedTopicId}
        onSelect={(id) => {
          if (selectingField === "subject") handleSubjectChange(id);
          else if (selectingField === "chapter") handleChapterChange(id);
          else if (selectingField === "topic") setSelectedTopicId(id);
        }}
      />

      {/* Bulk Exam Assignment Modal */}
      {showBulkExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Bulk Assign Exam Info</h3>
                  <p className="text-[10px] font-bold text-slate-400">Attach exam name & year to imported questions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkExamModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500">Exam Name</label>
                <input
                  type="text"
                  value={bulkExamName}
                  onChange={(e) => setBulkExamName(e.target.value)}
                  placeholder="e.g. CET 12th Level, Patwari, SSC CGL..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500">Exam Year</label>
                <input
                  type="text"
                  value={bulkExamYear}
                  onChange={(e) => setBulkExamYear(e.target.value)}
                  placeholder="e.g. 2023, 2022..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-black uppercase text-slate-500">Target Questions</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkExamTarget("selected")}
                    className={`p-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      bulkExamTarget === "selected"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-700 dark:text-indigo-300"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Selected Only ({selectedDraftIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkExamTarget("all")}
                    className={`p-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      bulkExamTarget === "all"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-700 dark:text-indigo-300"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    All Questions ({parseResult?.results.length || 0})
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-black uppercase text-slate-500">Assignment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkExamAction("append")}
                    className={`p-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      bulkExamAction === "append"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Add to Existing Exams
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkExamAction("replace")}
                    className={`p-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      bulkExamAction === "replace"
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-700 dark:text-amber-300"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Replace All Exams
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkExamModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAssignExams}
                disabled={!bulkExamName.trim()}
                className="px-5 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-black disabled:opacity-50 shadow-lg shadow-[#7045D8]/20 cursor-pointer"
              >
                Apply Exam Info
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
