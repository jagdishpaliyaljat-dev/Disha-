import React, { useState, useMemo, useRef, useEffect } from "react";
import { Chapter, ParsedQuestionDraft, Question, Subject, Topic, UserQuestionsStore, PYQPaper, LiveTest } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { loadLocalPYQPapers, savePYQPaper, fetchPYQPapers } from "../utils/pyqStorage";
import { fetchLiveTests, saveLiveTest } from "../utils/liveTestStorage";
import { deduplicateQuestions } from "../utils/questionsStorage";
import {
  parseJSONQuestions,
  parseCSVQuestions,
  parseTextQuestions,
  validateDraftQuestion,
  normalizeImportedContent,
  detectQuestionType,
  cleanAndStandardizeBulkText,
  formatMathAndChemistryLatex,
} from "../utils/questionsParser";
import { parseRawMcqText, validateMathSyntax } from "../utils/questionParser";
import { UniversalSmartParser } from "../utils/UniversalSmartParser";
import { detectQuestionExams } from "../lib/mcqImport/examDetector";
import { checkBatchForFuzzyDuplicates, calculateQuestionSimilarity } from "../utils/questionSimilarity";
import {
  X,
  Upload,
  FileText,
  FileCode,
  Edit3,
  PlusCircle,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HelpCircle,
  Check,
  Loader2,
  BookOpen,
  FolderPlus,
  Layers,
  Search,
  Filter,
  CheckCheck,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ArrowUpRight,
  RotateCcw,
  Radio,
  ChevronUp,
  Copy,
  Undo2,
} from "lucide-react";
import { ParsedQuestion } from "./ParsedQuestion";
import MathText from "./MathText";
import { RichText } from "./RichText";
import { QuestionTable } from "./QuestionTable";
import { formatQuestionWithAI, formatBatchQuestionsWithAI } from "../utils/aiFormatter";
import { ImportTemplatesModal } from "./admin/ImportTemplatesModal";
import { loadUserQuestionsStore, getCombinedSubjects, getCombinedChapters } from "../utils/questionsStorage";
import { ensureStableUniqueDocId } from "../utils/permanentDataIntegrity";
import { isUserAdmin, loadUserProfile, ADMIN_EMAILS } from "../utils/userProfileStorage";
import { supabase } from "../lib/supabase";
import {
  processJSONImport,
  parseJSONWithLocation,
  commitQuestions,
  formatDatabaseError,
  undoImportBatch,
  getSampleImportJSON,
  generateQuestionHash,
  CommitProgress,
  promiseWithTimeout,
} from "../lib/mcqImport";
import { smartJSONImport } from "../lib/mcqImport/smartImport";

const getQuestionTypeInfo = (type?: string) => {
  switch (type) {
    case "direct":
      return { label: "Direct MCQ", color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/30" };
    case "standard":
      return { label: "Standard MCQ", color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/30" };
    case "statement":
    case "statement_based":
      return { label: "Statement-Based", color: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200/30" };
    case "assertion-reason":
    case "assertion_reason":
      return { label: "Assertion–Reason", color: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/30" };
    case "match-following":
    case "match_following":
    case "match_column":
      return { label: "Match the Following (Column)", color: "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border-pink-200/30" };
    case "sequence":
      return { label: "Sequence / Chronological", color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/30" };
    case "unclassified":
      return { label: "Unclassified (Needs Review)", color: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/30" };
    case "case_based":
      return { label: "Passage / Case-Based", color: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-200/30" };
    case "table_data":
    case "table_based":
    case "data_based":
      return { label: "Table / Data-Based", color: "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-200/30" };
    case "numerical":
      return { label: "Numerical / Calculation", color: "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200/30" };
    case "true_false":
    case "boolean":
      return { label: "True / False", color: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200/30" };
    case "multi_select":
      return { label: "Multi-Select", color: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/30" };
    default:
      return { label: "MCQ", color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/30" };
  }
};

interface AddQuestionsModalProps {
  chapters: Chapter[];
  subjects?: Subject[];
  initialSubjectId?: string;
  initialChapterId?: string;
  initialTopicId?: string;
  onClose: () => void;
  onImportQuestions: (newQuestions: Question[], alreadyCommitted?: boolean) => void | Promise<void>;
  onUndoImportQuestions?: (questionIds: string[]) => void;
  initialMethod?: InputMethod;
}

type InputMethod = "json" | "file" | "paste" | "manual";

export const AddQuestionsModal: React.FC<AddQuestionsModalProps> = ({
  chapters,
  subjects = [],
  initialSubjectId,
  initialChapterId,
  initialTopicId,
  onClose,
  onImportQuestions,
  onUndoImportQuestions,
  initialMethod = "paste",
}) => {
  // 1. Fetched Subjects, Chapters & Loading/Error State
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
              .filter(t => t.chapterId === ch.id)
              .forEach(t => { if (t?.id && !topicMap.has(t.id)) topicMap.set(t.id, t); });
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
                    (existing?.topics || []).forEach((t) => { if (t?.id) topicMap.set(t.id, t); });
                    (remoteCh.topics || []).forEach((t) => { if (t?.id) topicMap.set(t.id, t); });
                    (sbTopics || [])
                      .filter((t) => t.chapterId === remoteCh.id)
                      .forEach((t) => { if (t?.id) topicMap.set(t.id, t); });
                    (store.customTopics || [])
                      .filter((t) => t.chapterId === remoteCh.id)
                      .forEach((t) => { if (t?.id) topicMap.set(t.id, t); });

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
          console.warn("[AddQuestionsModal] Supabase curriculum fetch warning:", sbErr);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to load syllabus for Smart MCQ Import:", err);
          setSyllabusError(err?.message || "Failed to load subjects and chapters from database.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingSyllabus(false);
        }
      }
    }
    loadSyllabusData();
    return () => { isMounted = false; };
  }, [subjects, chapters]);

  const availableSubjects = useMemo(() => {
    let list: Subject[] = [];
    if (fetchedSubjects && fetchedSubjects.length > 0) list = fetchedSubjects;
    else if (subjects && subjects.length > 0) list = subjects;
    else {
      const uniqueIds = Array.from(new Set(fetchedChapters.map((c) => c.subjectId).filter(Boolean))) as string[];
      if (uniqueIds.length > 0) {
        list = uniqueIds.map((id) => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          hindiName: id,
        }));
      }
    }
    // Sort by name or index
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [fetchedSubjects, subjects, fetchedChapters]);

  const defaultSubjectId = useMemo(() => {
    if (initialSubjectId && (initialSubjectId === "all" || availableSubjects.some((s) => s.id === initialSubjectId))) {
      return initialSubjectId;
    }
    if (initialChapterId) {
      const ch = fetchedChapters.find((c) => c.id === initialChapterId);
      if (ch?.subjectId && availableSubjects.some((s) => s.id === ch.subjectId)) {
        return ch.subjectId;
      }
    }
    return availableSubjects[0]?.id || "";
  }, [initialSubjectId, initialChapterId, availableSubjects, fetchedChapters]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(defaultSubjectId);

  // Filter chapters based on selected subject
  const availableChapters = useMemo(() => {
    let matched = fetchedChapters;
    if (selectedSubjectId && selectedSubjectId !== "all") {
      matched = fetchedChapters.filter((c) => c.subjectId === selectedSubjectId);
    }
    // Sort chapters by their number attribute
    return (matched.length > 0 ? matched : fetchedChapters).sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [fetchedChapters, selectedSubjectId]);

  // Ensure default chapter matches
  const defaultChapterId = useMemo(() => {
    if (initialChapterId && availableChapters.some((c) => c.id === initialChapterId)) {
      return initialChapterId;
    }
    return availableChapters[0]?.id || fetchedChapters[0]?.id || "";
  }, [initialChapterId, availableChapters, fetchedChapters]);

  const [selectedChapterId, setSelectedChapterId] = useState<string>(defaultChapterId);

  // When availableChapters change (e.g. subject changed), ensure selectedChapterId is valid
  React.useEffect(() => {
    if (!availableChapters.some((c) => c.id === selectedChapterId)) {
      const firstCh = availableChapters[0] || fetchedChapters[0];
      if (firstCh) {
        setSelectedChapterId(firstCh.id);
        setSelectedTopicId(firstCh.topics?.[0]?.id || "");
      }
    }
  }, [availableChapters, selectedChapterId, fetchedChapters]);

  const selectedChapter = useMemo(
    () => fetchedChapters.find((c) => c.id === selectedChapterId) || availableChapters[0] || fetchedChapters[0],
    [fetchedChapters, selectedChapterId, availableChapters]
  );

  const defaultTopicId =
    initialTopicId && selectedChapter?.topics?.some((t) => t.id === initialTopicId)
      ? initialTopicId
      : selectedChapter?.topics?.[0]?.id || "";

  const [selectedTopicId, setSelectedTopicId] = useState<string>(defaultTopicId);

  // When subject changes, auto-select first chapter of that subject and reset topic
  const handleSubjectChange = (newSubjectId: string) => {
    setSelectedSubjectId(newSubjectId);
    const targetChapters =
      newSubjectId === "all" ? fetchedChapters : fetchedChapters.filter((c) => c.subjectId === newSubjectId);
    const nextList = targetChapters.length > 0 ? targetChapters : fetchedChapters;
    if (nextList.length > 0) {
      const firstCh = nextList[0];
      setSelectedChapterId(firstCh.id);
      setSelectedTopicId(firstCh.topics?.[0]?.id || "");
    } else {
      setSelectedChapterId("");
      setSelectedTopicId("");
    }
  };

  // When chapter changes, auto-select its first topic and reset topic
  const handleChapterChange = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    const ch = fetchedChapters.find((c) => c.id === chapterId);
    if (ch && ch.topics && ch.topics.length > 0) {
      setSelectedTopicId(ch.topics[0].id);
    } else {
      setSelectedTopicId("");
    }
  };

  const selectedTopic = useMemo(
    () => selectedChapter?.topics?.find((t) => t.id === selectedTopicId),
    [selectedChapter, selectedTopicId]
  );

  const selectedSubject = useMemo(
    () => availableSubjects.find((s) => s.id === selectedSubjectId),
    [availableSubjects, selectedSubjectId]
  );

  // Official PYQ Vault Integration States
  const [saveToPYQVault, setSaveToPYQVault] = useState(false);
  const [pyqPapersList, setPyqPapersList] = useState<PYQPaper[]>([]);
  const [selectedPYQPaperId, setSelectedPYQPaperId] = useState<string>("new");
  const [newPYQTitle, setNewPYQTitle] = useState("");

  // Live Test Integration States
  const [saveToLiveTest, setSaveToLiveTest] = useState(false);
  const [liveTestsList, setLiveTestsList] = useState<LiveTest[]>([]);
  const [selectedLiveTestId, setSelectedLiveTestId] = useState<string>("");

  const [isSyllabusSheetOpen, setIsSyllabusSheetOpen] = useState(false);
  const [selectingField, setSelectingField] = useState<"subject" | "chapter" | "topic" | null>(null);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  
  const openSelectionModal = (field: "subject" | "chapter" | "topic") => {
    setSelectingField(field);
    setIsSyllabusSheetOpen(true);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height;
        setKeyboardOffset(offset > 0 ? offset : 0);
      }
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("disha2020_last_syllabus_loc") || localStorage.getItem("quizpro_last_syllabus_loc");
      if (saved) {
        try {
          const loc = JSON.parse(saved);
          if (loc.subjectId && availableSubjects.some(s => s.id === loc.subjectId)) {
            setSelectedSubjectId(loc.subjectId);
          }
          if (loc.chapterId && chapters.some(c => c.id === loc.chapterId)) {
            setSelectedChapterId(loc.chapterId);
          }
          if (loc.topicId) {
            setSelectedTopicId(loc.topicId);
          }
        } catch {}
      }
    }
  }, []);

  const handleUpdateSyllabusAndSave = (sId: string, cId: string, tId: string) => {
    setSelectedSubjectId(sId);
    setSelectedChapterId(cId);
    setSelectedTopicId(tId);
    if (typeof window !== "undefined") {
      localStorage.setItem("disha2020_last_syllabus_loc", JSON.stringify({ subjectId: sId, chapterId: cId, topicId: tId }));
    }
  };

  // Input states
  const [pasteText, setPasteText] = useState("");
  const [jsonPasteText, setJsonPasteText] = useState("");

  const estimatedQuestionsCount = useMemo(() => {
    if (!pasteText.trim()) return 0;
    const lines = pasteText.split("\n");
    let count = 0;
    const re = /^\s*(Q\.?\s*\d+|प्रश्न\s*\d+|\d+[.)])/i;
    for (const l of lines) {
      if (re.test(l)) count++;
    }
    return count > 0 ? count : (pasteText.trim() ? 1 : 0);
  }, [pasteText]);

  useEffect(() => {
    let isMounted = true;
    fetchPYQPapers()
      .then((list) => {
        if (isMounted) setPyqPapersList(list);
      })
      .catch(() => {
        if (isMounted) setPyqPapersList(loadLocalPYQPapers());
      });

    // Fetch Live Tests
    fetchLiveTests().then((list) => {
      if (isMounted) setLiveTestsList(list);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Active Tab
  const [activeMethod, setActiveMethod] = useState<InputMethod>(initialMethod);

  useEffect(() => {
    if (initialMethod) {
      setActiveMethod(initialMethod);
    }
  }, [initialMethod]);

  const [jsonTabMode, setJsonTabMode] = useState<"paste" | "upload">("paste");
  const [showImportTemplates, setShowImportTemplates] = useState(false);
  const [manualQuestion, setManualQuestion] = useState({
    text: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "0",
    explanation: "",
    importantFact: "",
  });

  const [isAiFormattingManual, setIsAiFormattingManual] = useState(false);
  const [isAiFormattingPaste, setIsAiFormattingPaste] = useState(false);
  const [isParsingPastedText, setIsParsingPastedText] = useState(false);
  const [aiFormatMsg, setAiFormatMsg] = useState("");
  const [rawCopiedClip, setRawCopiedClip] = useState("");

  const handleParseAndFillFromRaw = async () => {
    const targetText = rawCopiedClip.trim() || manualQuestion.text.trim();
    if (!targetText) {
      setParseError("Please paste or type raw text from a PDF, website, or document first.");
      return;
    }

    try {
      setIsAiFormattingManual(true);
      setParseError(null);
      const res = await formatQuestionWithAI(targetText);
      setManualQuestion({
        text: res.text,
        optionA: res.options[0],
        optionB: res.options[1],
        optionC: res.options[2],
        optionD: res.options[3],
        correctAnswer: String(res.correctIndex),
        explanation: res.explanation,
        importantFact: res.importantFact || "",
      });
      setRawCopiedClip("");
      setAiFormatMsg("✨ Question, Options A-D, Answer & Explanation populated automatically with Gemini AI!");
      setTimeout(() => setAiFormatMsg(""), 5000);
    } catch (err: any) {
      setParseError(err.message || "Failed to parse copied text.");
    } finally {
      setIsAiFormattingManual(false);
    }
  };

  const handleFormatManualWithAI = async () => {
    const raw = [
      manualQuestion.text,
      manualQuestion.optionA ? `A. ${manualQuestion.optionA}` : "",
      manualQuestion.optionB ? `B. ${manualQuestion.optionB}` : "",
      manualQuestion.optionC ? `C. ${manualQuestion.optionC}` : "",
      manualQuestion.optionD ? `D. ${manualQuestion.optionD}` : "",
      `Answer: ${["A", "B", "C", "D"][parseInt(manualQuestion.correctAnswer, 10)]}`,
      manualQuestion.explanation ? `Explanation: ${manualQuestion.explanation}` : "",
      manualQuestion.importantFact ? `Fact: ${manualQuestion.importantFact}` : "",
    ].filter(Boolean).join("\n");

    if (!raw.trim()) {
      setParseError("Please enter question content in the form before formatting with AI.");
      return;
    }

    try {
      setIsAiFormattingManual(true);
      setParseError(null);
      const res = await formatQuestionWithAI(raw);
      setManualQuestion({
        text: res.text,
        optionA: res.options[0],
        optionB: res.options[1],
        optionC: res.options[2],
        optionD: res.options[3],
        correctAnswer: String(res.correctIndex),
        explanation: res.explanation,
        importantFact: res.importantFact || "",
      });
      setAiFormatMsg("Form fields organized with Gemini AI!");
      setTimeout(() => setAiFormatMsg(""), 4000);
    } catch (err: any) {
      setParseError(err.message || "Failed to format with AI.");
    } finally {
      setIsAiFormattingManual(false);
    }
  };

  const handleFormatPasteWithAI = async () => {
    if (!pasteText.trim()) {
      setParseError("Please paste question text before formatting with AI.");
      return;
    }

    try {
      setIsAiFormattingPaste(true);
      setParseError(null);
      const questions = await formatBatchQuestionsWithAI(pasteText);
      if (!questions || questions.length === 0) {
        throw new Error("Could not extract questions from the provided text.");
      }

      const formattedBlocks = questions.map((res, i) => {
        const qNum = `Q${i + 1}.`;
        if (res.assertion && res.reason) {
          return `${qNum} Assertion (A): ${res.assertion}\n\nReason (R): ${res.reason}\n\nA. ${res.options[0]}\nB. ${res.options[1]}\nC. ${res.options[2]}\nD. ${res.options[3]}\n\nAnswer: ${["A", "B", "C", "D"][res.correctIndex]}\n\n${res.explanation ? `Explanation: ${res.explanation}` : ""}`.trim();
        }
        if (res.statements && res.statements.length > 0) {
          const stmts = res.statements.map((s, si) => `(${si + 1}) ${s}`).join("\n");
          return `${qNum} ${res.text}\n\n${stmts}\n\nA. ${res.options[0]}\nB. ${res.options[1]}\nC. ${res.options[2]}\nD. ${res.options[3]}\n\nAnswer: ${["A", "B", "C", "D"][res.correctIndex]}\n\n${res.explanation ? `Explanation: ${res.explanation}` : ""}`.trim();
        }
        return `${qNum} ${res.text}\n\nA. ${res.options[0]}\nB. ${res.options[1]}\nC. ${res.options[2]}\nD. ${res.options[3]}\n\nAnswer: ${["A", "B", "C", "D"][res.correctIndex]}\n\n${res.explanation ? `Explanation: ${res.explanation}` : ""}`.trim();
      }).join("\n\n---\n\n");

      setPasteText(formattedBlocks);
      setAiFormatMsg(`✨ ${questions.length} Question${questions.length > 1 ? "s" : ""} organized with AI!`);
      setTimeout(() => setAiFormatMsg(""), 5000);
    } catch (err: any) {
      setParseError(err.message || "Failed to format paste text with AI.");
    } finally {
      setIsAiFormattingPaste(false);
    }
  };

  // 3. Preview State
  const [draftQuestions, setDraftQuestions] = useState<ParsedQuestionDraft[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkSaveProgress, setBulkSaveProgress] = useState<string | null>(null);
  const [bulkSaveErrorCode, setBulkSaveErrorCode] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{
    batchId: string;
    uploadedCount?: number;
    validCount?: number;
    importedCount: number;
    createdCount?: number;
    skippedCount?: number;
    actualTotalInTopic?: number;
    failedCount?: number;
  } | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "clean" | "review" | "errors" | "duplicates" | "recovered">("all");
  const [importProcessingState, setImportProcessingState] = useState<
    "idle" | "parsing" | "validating" | "recovering" | "revalidating" | "ready" | "failed"
  >("idle");
  const [recoveryProgress, setRecoveryProgress] = useState<{
    phase: string;
    completed: number;
    total: number;
    currentBatch: number;
    totalBatches: number;
    message: string;
  } | null>(null);
  const [smartImportSummary, setSmartImportSummary] = useState<{
    total: number;
    valid: number;
    recoveredByAI: number;
    needsReview: number;
    errors: number;
    duplicates: number;
  } | null>(null);
  const [inspectingOriginalDraft, setInspectingOriginalDraft] = useState<ParsedQuestionDraft | null>(null);
  const recoveryAbortControllerRef = useRef<AbortController | null>(null);
  
  // Requirement 1: Synchronous Guard for double-click prevention
  const isBulkSavingRef = useRef<boolean>(false);

  const handleCancelAIRecovery = () => {
    if (recoveryAbortControllerRef.current) {
      recoveryAbortControllerRef.current.abort();
      recoveryAbortControllerRef.current = null;
    }
  };
  const [previewSearchQuery, setPreviewSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">("skip");
  const [commitProgress, setCommitProgress] = useState<CommitProgress | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoStatusMsg, setUndoStatusMsg] = useState<string | null>(null);
  const [lastImportedQuestionIds, setLastImportedQuestionIds] = useState<string[]>([]);
  const [copiedSample, setCopiedSample] = useState(false);
  const [showIntegrationDetails, setShowIntegrationDetails] = useState(false);
  const [jsonSelfTestResults, setJsonSelfTestResults] = useState<{
    qNum: number;
    type: string;
    status: "PASS" | "FAIL";
    reason: string;
  }[] | null>(null);

  // Auto-expand all cards by default so user sees full question text and all options clearly
  useEffect(() => {
    if (draftQuestions && draftQuestions.length > 0) {
      setExpandedCardIds(new Set(draftQuestions.map((q) => q.tempId)));
    } else {
      setExpandedCardIds(new Set());
    }
  }, [draftQuestions]);

  const handleToggleExpandCard = (tempId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  const handleExpandAllCards = () => {
    if (!draftQuestions) return;
    setExpandedCardIds(new Set(draftQuestions.map((q) => q.tempId)));
  };

  const handleCollapseAllCards = () => {
    setExpandedCardIds(new Set());
  };

  // Calculate structure counts
  const structureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!draftQuestions) return counts;
    draftQuestions.forEach((q) => {
      const t = q.questionType || "standard";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [draftQuestions]);

  const validCount = useMemo(() => draftQuestions?.filter(q => q.isValid).length || 0, [draftQuestions]);
  const cleanCount = useMemo(() => draftQuestions?.filter(q => q.isValid && !q.needsReview).length || 0, [draftQuestions]);
  const reviewCount = useMemo(() => draftQuestions?.filter(q => (q.warnings && q.warnings.length > 0) || q.needsReview).length || 0, [draftQuestions]);
  const invalidCount = useMemo(() => draftQuestions?.filter(q => !q.isValid).length || 0, [draftQuestions]);
  const aiRecoveredCount = useMemo(() => draftQuestions?.filter(q => q.recoveredByAI).length || 0, [draftQuestions]);

  // Duplicate Detection with Normalized Question Hash + Fuzzy Similarity (>=90%)
  const { duplicateIds, duplicateDetailsMap } = useMemo(() => {
    if (!draftQuestions || draftQuestions.length === 0) {
      return {
        duplicateIds: new Set<string>(),
        duplicateDetailsMap: new Map<string, { matchedText: string; percentage: number; isBatchInternal: boolean; reason: string }>(),
      };
    }

    const allExistingQuestions: Question[] = chapters.flatMap((c) =>
      (c.topics || []).flatMap((t) => t.questions || [])
    );

    const duplicates = new Set<string>();
    const detailsMap = new Map<string, { matchedText: string; percentage: number; isBatchInternal: boolean; reason: string }>();

    // 1. Run 90%+ fuzzy matching across database & batch
    const fuzzyMap = checkBatchForFuzzyDuplicates(draftQuestions, allExistingQuestions, 0.90);
    fuzzyMap.forEach((info, tempId) => {
      duplicates.add(tempId);
      const matchedText = info.matchedWith.text || (info.matchedWith as any).question || "";
      detailsMap.set(tempId, {
        matchedText,
        percentage: info.similarity.percentage,
        isBatchInternal: info.isBatchInternal,
        reason: info.similarity.reason,
      });
    });

    // 2. Also include exact hash matches if any
    const existingHashes = new Set(
      allExistingQuestions.map((q) =>
        generateQuestionHash({
          question: q.text,
          options: q.options,
          answer: ["A", "B", "C", "D", "E"][q.correctIndex] || "A",
        })
      )
    );

    draftQuestions.forEach((q) => {
      if (q.isDuplicate || (q.hash && existingHashes.has(q.hash))) {
        duplicates.add(q.tempId);
      } else {
        const h = generateQuestionHash({
          question: q.text,
          options: q.options,
          answer: q.answer || "A",
        });
        if (existingHashes.has(h)) {
          duplicates.add(q.tempId);
        }
      }
    });

    return { duplicateIds: duplicates, duplicateDetailsMap: detailsMap };
  }, [draftQuestions, chapters]);

  // Compute filtered drafts list for display
  const filteredDrafts = useMemo(() => {
    if (!draftQuestions) return [];
    let list = draftQuestions;

    // Filter by validity tab
    if (filterMode === "clean") {
      list = list.filter((q) => q.isValid && !q.needsReview && (!q.warnings || q.warnings.length === 0));
    } else if (filterMode === "review") {
      list = list.filter((q) => (q.warnings && q.warnings.length > 0) || q.needsReview);
    } else if (filterMode === "errors") {
      list = list.filter((q) => !q.isValid);
    } else if (filterMode === "duplicates") {
      list = list.filter((q) => duplicateIds.has(q.tempId));
    } else if (filterMode === "recovered") {
      list = list.filter((q) => q.recoveredByAI);
    }

    // Filter by question type
    if (selectedTypeFilter !== "all") {
      list = list.filter((q) => (q.questionType || "standard") === selectedTypeFilter);
    }

    // Filter by search query (Hindi/English text, question number, or option text)
    if (previewSearchQuery.trim()) {
      const query = previewSearchQuery.trim().toLowerCase();
      list = list.filter((q, idx) => {
        const qNumStr = `q${q.questionNumber || idx + 1}`.toLowerCase();
        const textMatch = (q.text || "").toLowerCase().includes(query);
        const numMatch = qNumStr.includes(query) || `${q.questionNumber || idx + 1}` === query;
        const optMatch = q.options?.some((opt) => (opt || "").toLowerCase().includes(query));
        const expMatch = (q.explanation || "").toLowerCase().includes(query);
        return textMatch || numMatch || optMatch || expMatch;
      });
    }

    return list;
  }, [draftQuestions, filterMode, selectedTypeFilter, previewSearchQuery, duplicateIds]);

  // Jump to first invalid error card
  const handleJumpToFirstError = () => {
    setFilterMode("errors");
    setSelectedTypeFilter("all");
    setPreviewSearchQuery("");
    const firstErr = draftQuestions?.find((q) => !q.isValid);
    if (firstErr) {
      setExpandedCardIds((prev) => new Set([...prev, firstErr.tempId]));
      setTimeout(() => {
        const el = document.getElementById(`draft-card-${firstErr.tempId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  };

  // File input refs
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);

  // Selected count
  const selectedCount = useMemo(() => {
    if (!draftQuestions) return 0;
    return draftQuestions.filter((q) => q.isValid && selectedDraftIds.has(q.tempId)).length;
  }, [draftQuestions, selectedDraftIds]);

  // Sync selected draft IDs when drafts change
  React.useEffect(() => {
    if (draftQuestions) {
      const validIds = draftQuestions.filter((q) => q.isValid).map((q) => q.tempId);
      setSelectedDraftIds(new Set(validIds));
    } else {
      setSelectedDraftIds(new Set());
    }
  }, [draftQuestions]);

  const handleToggleSelectDraft = (tempId: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (!draftQuestions) return;
    const validIds = draftQuestions.filter((q) => q.isValid).map((q) => q.tempId);
    const areAllSelected = validIds.length > 0 && validIds.every((id) => selectedDraftIds.has(id));
    if (areAllSelected) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(validIds));
    }
  };

  // 4. Input Processors
  // A. Process JSON (Text Paste or File Content)
  const handleProcessJSON = async (jsonString: string) => {
    if (!jsonString || !jsonString.trim()) {
      setParseError("Please paste or upload JSON content before previewing.");
      return;
    }
    setParseError(null);

    const existingHashes = new Set(
      chapters.flatMap((c) =>
        (c.topics || []).flatMap((t) =>
          (t.questions || []).map((q) =>
            generateQuestionHash({
              question: q.text,
              options: q.options,
              answer: ["A", "B", "C", "D", "E"][q.correctIndex] || "A",
            })
          )
        )
      )
    );

    const controller = new AbortController();
    recoveryAbortControllerRef.current = controller;
    setImportProcessingState("parsing");
    setRecoveryProgress(null);

    try {
      const { success, parseError: pErr, results, summary, aiRecoveryRequired, recoveredCount } = await smartJSONImport(
        jsonString,
        existingHashes,
        {
          batchSize: 4,
          signal: controller.signal,
          onProgress: (prog) => {
            if (prog.phase === "recovering") {
              setImportProcessingState("recovering");
            } else if (prog.phase === "revalidating") {
              setImportProcessingState("revalidating");
            }
            setRecoveryProgress(prog);
          },
        }
      );

      if (!success || pErr) {
        setImportProcessingState("failed");
        setParseError(pErr || "Failed to parse JSON. Please check syntax.");
        return;
      }
      if (!results || results.length === 0) {
        setImportProcessingState("failed");
        setParseError("No questions detected in this JSON. Ensure your JSON contains a \"questions\": [ ... ] list.");
        return;
      }

      setSmartImportSummary(summary);
      setImportProcessingState("ready");

      const drafts: ParsedQuestionDraft[] = results.map((r, idx) => {
        const detection = detectQuestionExams(r);
        return {
          tempId: `draft-json-${Date.now()}-${idx}`,
          chapterId: selectedChapterId,
          topicId: selectedTopicId,
          text: detection.cleanText || r.question,
          question: detection.cleanText || r.question,
          options: r.options.map((opt) => String(opt ?? "")),
          correctIndex: r.correctIndex,
          answer: r.answer,
          explanation: r.explanation || "",
          subject: r.subject,
          chapter: r.chapter,
          topic: r.topic,
          year: r.year && String(r.year).trim() ? String(r.year).trim() : (detection.examHistory.length > 0 && detection.examHistory[0].year ? String(detection.examHistory[0].year).trim() : undefined),
          exam: r.exam && String(r.exam).trim() ? String(r.exam).trim() : (detection.examHistory.length > 0 && detection.examHistory[0].examName ? detection.examHistory[0].examName.trim() : undefined),
          examHistory: detection.examHistory,
          questionClassification: detection.questionClassification,
          isPYQ: detection.isPYQ,
          source: "json",
          isValid: r.isValid,
          errors: r.errors,
          warnings: r.warnings,
          hash: r.hash,
          isDuplicate: r.isDuplicate,
          type: r.type || "single_correct",
          questionType: r.type || "single_correct",
          difficulty: "medium",
          createdAt: new Date().toISOString(),
          questionNumber: r.questionNumber,
          table: r.table || r.tableData,
          tableData: r.table || r.tableData,
          image: (r as any).image,
          imageUrl: (r as any).imageUrl,
          recoveredByAI: (r as any).recoveredByAI,
          originalData: (r as any).originalQuestion,
          needsReview: (r as any).needsReview,
          reviewReason: (r as any).reviewReason,
        };
      });

      setDraftQuestions(drafts);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setParseError("AI recovery was cancelled by user.");
      } else {
        setParseError(err.message || "Failed to process JSON.");
      }
      setImportProcessingState("failed");
    } finally {
      recoveryAbortControllerRef.current = null;
    }
  };

  const handleRunSelfTest = () => {
    const samplePayload = {
      schemaVersion: 1,
      questions: [
        {
          type: "single_correct",
          question: "What is the capital of Rajasthan?\nPink City of India.",
          options: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
          answer: "A",
          explanation: "Jaipur is the capital and largest city of Rajasthan.",
          subject: "Rajasthan Geography",
          chapter: "Overview",
          topic: "Capitals"
        },
        {
          type: "statement_based",
          question: "Consider the following statements regarding the Aravalli Range:\nStatement 1: It is one of the oldest fold mountain systems in the world.\nStatement 2: Guru Shikhar is its highest peak.\nWhich of the statements given above is/are correct?",
          options: ["Only 1", "Only 2", "Both 1 and 2", "Neither 1 nor 2"],
          answer: "C",
          explanation: "Both statements are correct. Aravalli is an ancient fold mountain and Guru Shikhar (1722m) is its highest peak.",
          subject: "Rajasthan Geography",
          chapter: "Physical Divisions",
          topic: "Aravalli Range"
        },
        {
          type: "assertion_reason",
          question: "Given below are two statements, one labelled as Assertion (A) and other as Reason (R):\nAssertion (A): The Sun rises in the east and sets in the west.\nReason (R): Earth rotates on its axis from west to east.",
          options: [
            "Both (A) and (R) are true and (R) is the correct explanation of (A)",
            "Both (A) and (R) are true but (R) is not the correct explanation of (A)",
            "(A) is true but (R) is false",
            "(A) is false but (R) is true"
          ],
          answer: "A",
          explanation: "Due to Earth's rotation from west to east, celestial bodies appear to move from east to west.",
          subject: "General Science",
          chapter: "Astronomy",
          topic: "Earth Motion"
        },
        {
          type: "match_list",
          question: "Match List-I with List-II:\nList-I (Wildlife Sanctuary):\nA. Sariska\nB. Keoladeo\nC. Ranthambore\nD. Desert National Park\nList-II (District):\n1. Alwar\n2. Bharatpur\n3. Sawai Madhopur\n4. Jaisalmer",
          options: [
            "A-1, B-2, C-3, D-4",
            "A-2, B-1, C-4, D-3",
            "A-3, B-4, C-1, D-2",
            "A-4, B-3, C-2, D-1"
          ],
          answer: "A",
          explanation: "Sariska is in Alwar, Keoladeo in Bharatpur, Ranthambore in Sawai Madhopur, and Desert National Park in Jaisalmer.",
          subject: "Rajasthan Geography",
          chapter: "Flora and Fauna",
          topic: "Sanctuaries"
        },
        {
          type: "math",
          question: "Solve the algebraic equation for $x$:\nGiven $2x - 2 = 10$, determine the value of $x$.",
          options: ["$x = 4$", "$x = 5$", "$x = 6$", "$x = 8$"],
          answer: "C",
          explanation: "$2x = 12 \\implies x = 6$.",
          subject: "Mathematics",
          chapter: "Algebra",
          topic: "Linear Equations"
        }
      ]
    };

    const rawJson = JSON.stringify(samplePayload, null, 2);
    setJsonPasteText(rawJson);
    setParseError(null);

    const { success, parseError: pErr, results } = processJSONImport(rawJson, new Set());

    if (!success || !results || results.length !== 5) {
      setParseError(pErr || "Self-test failed to parse 5 sample questions.");
      return;
    }

    const testReports = results.map((r, i) => {
      const orig = samplePayload.questions[i];
      const hasLines = r.question.includes("\n");
      const optionsOk = r.options && r.options.length === 4;
      const answerOk = r.answer === orig.answer && r.correctIndex >= 0;
      const explanationOk = Boolean(r.explanation && r.explanation.length > 5);
      const isPass = r.isValid && optionsOk && answerOk && explanationOk;

      return {
        qNum: i + 1,
        type: r.type || "single_correct",
        status: isPass ? ("PASS" as const) : ("FAIL" as const),
        reason: isPass
          ? `Text intact (${r.question.split("\n").length} lines), 4 options, Ans: ${r.answer}, Explanation intact`
          : (r.errors.join("; ") || "Field mismatch"),
      };
    });

    setJsonSelfTestResults(testReports);
    handleProcessJSON(rawJson);
  };

  // B. Process Uploaded File (.json, .csv, .txt)
  const handleFileUpload = (file: File) => {
    setParseError(null);
    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setParseError("File is empty.");
        return;
      }

      try {
        if (fileName.endsWith(".json")) {
          handleProcessJSON(content);
        } else if (fileName.endsWith(".csv") || fileName.endsWith(".tsv")) {
          const drafts = parseCSVQuestions(content, selectedChapterId, selectedTopicId);
          setDraftQuestions(drafts);
        } else {
          // Plain text file with production-grade parser
          const { questions: drafts } = parseRawMcqText(content, selectedChapterId, selectedTopicId);
          if (drafts.length === 0) {
            setParseError("No structured questions detected in the text file.");
            return;
          }
          setDraftQuestions(drafts as any);
        }
      } catch (err: any) {
        setParseError(err.message || "Failed to parse file.");
      }
    };

    reader.readAsText(file);
  };

  // C. Process Paste Text
  const handleProcessPastedText = async () => {
    if (!pasteText.trim()) {
      setParseError("Please paste question text before previewing.");
      return;
    }
    setParseError(null);
    setIsParsingPastedText(true);
    try {
      const trimmed = pasteText.trim();
      // If user pasted JSON in this tab, automatically parse using JSON processor
      const { data: jsonParsed, error: jsonErr } = parseJSONWithLocation(trimmed);
      if (jsonParsed && !jsonErr) {
        handleProcessJSON(trimmed);
        return;
      }

      const drafts = await UniversalSmartParser.parse(pasteText, selectedChapterId, selectedTopicId);
      if (!drafts || drafts.length === 0) {
        setParseError("Could not detect any questions. Please check the formatting or use 'Format with AI' to clean it up.");
        return;
      }
      setDraftQuestions(drafts);
    } catch (err: any) {
      setParseError(err.message || "Failed to parse text.");
    } finally {
      setIsParsingPastedText(false);
    }
  };

  // D. Process Manual Add
  const handleProcessManual = () => {
    const options: [string, string, string, string] = [
      normalizeImportedContent(manualQuestion.optionA),
      normalizeImportedContent(manualQuestion.optionB),
      normalizeImportedContent(manualQuestion.optionC),
      normalizeImportedContent(manualQuestion.optionD),
    ];
    const correctIndex = parseInt(manualQuestion.correctAnswer, 10);
    const text = normalizeImportedContent(manualQuestion.text);
    const explanation = normalizeImportedContent(manualQuestion.explanation);
    const importantFact = normalizeImportedContent(manualQuestion.importantFact);

    const validation = validateDraftQuestion({
      text,
      options,
      correctIndex,
      explanation,
    });

    const ansStr = ["A", "B", "C", "D"][correctIndex] || "";
    const qType = detectQuestionType(text, options, ansStr);

    const draft: ParsedQuestionDraft = {
      tempId: `draft-manual-${Date.now()}`,
      chapterId: selectedChapterId,
      topicId: selectedTopicId,
      text,
      options,
      correctIndex,
      explanation,
      importantFact,
      difficulty: "medium",
      createdAt: new Date().toISOString(),
      isValid: validation.isValid,
      errors: validation.errors,
      questionType: qType,
    };

    setDraftQuestions([draft]);
  };

  // 5. Preview actions
  const handleDeleteDraft = (tempId: string) => {
    if (!draftQuestions) return;
    setDraftQuestions(draftQuestions.filter((q) => q.tempId !== tempId));
  };

  const handleUpdateDraft = (updated: ParsedQuestionDraft) => {
    if (!draftQuestions) return;
    const isJsonSource = updated.source === "json";
    const cleanText = isJsonSource ? updated.text : normalizeImportedContent(updated.text);
    const cleanOptions: string[] = isJsonSource ? updated.options : updated.options.map((opt) => normalizeImportedContent(opt));
    const cleanExplanation = isJsonSource ? (updated.explanation || "") : normalizeImportedContent(updated.explanation || "");
    const cleanImportantFact = updated.importantFact ? (isJsonSource ? updated.importantFact : normalizeImportedContent(updated.importantFact)) : undefined;

    const ansStr = ["A", "B", "C", "D", "E"][updated.correctIndex] || updated.answer || "A";
    const qType = updated.questionType || updated.type || (isJsonSource ? "single_correct" : detectQuestionType(cleanText, cleanOptions as any, ansStr));

    const validation = validateDraftQuestion({
      text: cleanText,
      options: cleanOptions,
      correctIndex: updated.correctIndex,
      explanation: cleanExplanation,
      type: qType,
      sequenceItems: updated.sequenceItems,
      statements: updated.statements,
      instruction: updated.instruction,
      assertion: updated.assertion,
      reason: updated.reason,
      tableData: updated.tableData,
    });

    const validated: ParsedQuestionDraft = {
      ...updated,
      text: cleanText,
      options: cleanOptions,
      explanation: cleanExplanation,
      importantFact: cleanImportantFact,
      isValid: validation.isValid,
      errors: validation.errors,
      questionType: qType,
      tableData: updated.tableData,
      rawInput: updated.rawInput,
    };

    setDraftQuestions(
      draftQuestions.map((q) => (q.tempId === updated.tempId ? validated : q))
    );
    setEditingDraftId(null);
  };

  // 6. Commit Bulk Import to App
  const handleBulkSaveQuestions = async (onlySelected: boolean = false) => {
    if (!draftQuestions || isBulkSavingRef.current) {
      console.warn("[MCQ Import] Blocked: Bulk save already in progress (Synchronous Guard).");
      return;
    }
    
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    isBulkSavingRef.current = true;
    setIsBulkSaving(true);
    setBulkSaveProgress(null);
    setBulkSaveErrorCode(null);
    setParseError(null);

    console.log(`[MCQ Import] [${requestId}] [Step: Parse] handleBulkSaveQuestions initiated (onlySelected: ${onlySelected})`);

    try {
      let toImport = draftQuestions.filter((q) => q.isValid);

      // Strict Duplicate Prevention: Automatically skip >=90% and exact duplicates if strategy is 'skip'
      if (duplicateStrategy === "skip" && duplicateIds.size > 0) {
        const initialCount = toImport.length;
        toImport = toImport.filter((q) => !duplicateIds.has(q.tempId));
        const skippedCount = initialCount - toImport.length;
        if (skippedCount > 0) {
          console.log(`[MCQ Import] [Deduplication Guard] Skipped ${skippedCount} duplicate question(s) (>=90% similarity).`);
        }
      }

      if (onlySelected && selectedCount > 0) {
        toImport = toImport.filter((q) => selectedDraftIds.has(q.tempId));
      }

      if (toImport.length === 0) {
        setParseError(
          duplicateIds.size > 0
            ? "All questions already exist in the database or are duplicates (similarity >=90%). To preserve database integrity, duplicate questions were skipped."
            : "No valid questions selected to import. Please check and fix any errors."
        );
        setBulkSaveErrorCode("all-duplicates");
        setIsBulkSaving(false);
        isBulkSavingRef.current = false;
        return;
      }

      // 1. Verify User Authentication & Authorization Pre-check
      console.log("[MCQ Import] [Step: Auth] Checking admin authorization...");
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      const userProfile = loadUserProfile();
      const isAdminUser =
        isUserAdmin(userProfile) ||
        isUserAdmin(currentUser?.email) ||
        (userProfile?.role === "admin") ||
        (currentUser?.email && ADMIN_EMAILS.includes(currentUser.email.trim().toLowerCase()));

      if (!isAdminUser) {
        setParseError("Missing or insufficient permissions: Only authorized administrators are allowed to save questions.");
        setBulkSaveErrorCode("permission-denied");
        return;
      }

      const timestamp = Date.now();
      const subId =
        (selectedSubjectId && selectedSubjectId !== "all" ? selectedSubjectId : undefined) ||
        selectedChapter?.subjectId ||
        (availableSubjects.length > 0 ? availableSubjects[0]?.id : "economics");

      console.log(`[MCQ Import] [Step: Parse] Mapping ${toImport.length} questions for database commit...`);

      const finalQuestions: Question[] = toImport.map((d, idx) => {
        const chId =
          (selectedChapterId && chapters.some((c) => c.id === selectedChapterId) ? selectedChapterId : null) ||
          (d.chapterId && chapters.some((c) => c.id === d.chapterId) ? d.chapterId : null) ||
          selectedChapterId ||
          chapters[0]?.id;
        const targetCh = chapters.find((c) => c.id === chId) || selectedChapter || chapters[0];
        const tId =
          (selectedTopicId && targetCh?.topics?.some((t) => t.id === selectedTopicId) ? selectedTopicId : null) ||
          (d.topicId && targetCh?.topics?.some((t) => t.id === d.topicId) ? d.topicId : null) ||
          selectedTopicId ||
          targetCh?.topics?.[0]?.id ||
          "";
        const questionSubjectId =
          (selectedSubjectId && selectedSubjectId !== "all" ? selectedSubjectId : undefined) ||
          targetCh?.subjectId ||
          subId;

        // Requirement 3: SVG and diagrams stored directly as string in document fields inline
        let cleanImageUrl = d.imageUrl || "";
        let cleanSvg = (d as any).svgContent || "";
        if (d.image?.dataUrl) {
          cleanImageUrl = d.image.dataUrl;
          if (d.image.type === "svg" || d.image.dataUrl.includes("<svg") || d.image.dataUrl.includes("data:image/svg+xml")) {
            cleanSvg = d.image.sanitizedSvg || cleanSvg || d.image.dataUrl;
          }
        }

        if (cleanImageUrl || cleanSvg) {
          console.log(`[MCQ Import] [Step: Image] Question index ${idx + 1}/${toImport.length}: Inline diagram processed.`);
        }

        const stableId = ensureStableUniqueDocId({
          text: d.text,
          options: d.options,
          correctIndex: d.correctIndex,
          topicId: tId,
          table: d.tableData || d.table,
        } as any, tId);

        const detection = detectQuestionExams(d);
        const finalExamHistory = (d as any).examHistory && Array.isArray((d as any).examHistory) && (d as any).examHistory.length > 0
          ? (d as any).examHistory
          : detection.examHistory;
        const finalIsPYQ = (d as any).isPYQ ?? detection.isPYQ;
        const finalClassification = (d as any).questionClassification || detection.questionClassification;

        return {
          id: stableId,
          subjectId: questionSubjectId,
          chapterId: chId,
          topicId: tId,
          text: (detection.cleanText || d.text).trim(),
          options: d.options,
          correctIndex: d.correctIndex >= 0 ? d.correctIndex : 0,
          explanation: d.explanation || "",
          importantFact: d.importantFact || undefined,
          difficulty: d.difficulty || "medium",
          createdAt: d.createdAt || new Date().toISOString(),
          isUserAdded: true,
          questionType: d.questionType || d.type,
          matchData: d.matchData,
          statements: d.statements,
          instruction: d.instruction,
          assertion: d.assertion,
          reason: d.reason,
          sequenceItems: d.sequenceItems,
          isNegative: d.isNegative,
          rawFallback: d.rawFallback,
          tableData: d.tableData,
          rawInput: d.rawInput || d.rawFallback || d.text,
          subject: d.subject,
          chapter: d.chapter,
          topic: d.topic,
          year: d.year && String(d.year).trim() ? String(d.year).trim() : (finalExamHistory.length > 0 && finalExamHistory[0].year ? String(finalExamHistory[0].year).trim() : undefined),
          exam: d.exam && String(d.exam).trim() ? String(d.exam).trim() : (finalExamHistory.length > 0 && finalExamHistory[0].examName ? finalExamHistory[0].examName.trim() : undefined),
          examName: d.exam && String(d.exam).trim() ? String(d.exam).trim() : (finalExamHistory.length > 0 && finalExamHistory[0].examName ? finalExamHistory[0].examName.trim() : undefined),
          examYear: d.year && String(d.year).trim() ? String(d.year).trim() : (finalExamHistory.length > 0 && finalExamHistory[0].year ? String(finalExamHistory[0].year).trim() : undefined),
          examHistory: finalExamHistory,
          questionClassification: finalClassification,
          isPYQ: finalIsPYQ,
          approvalStatus: (isUserAdmin(userProfile) && (userProfile?.role === "super_admin" || userProfile?.role === "content_reviewer" || userProfile?.staffRole === "content_reviewer" || ADMIN_EMAILS.includes((userProfile?.email || "").toLowerCase()))) ? "published" : "pending_review",
          submittedBy: userProfile?.id,
          submittedAt: new Date().toISOString(),
          image: d.image,
          imageUrl: cleanImageUrl || undefined,
          svgContent: cleanSvg || undefined,
        };
      });

      const batchId = `batch-${Date.now()}`;
      
      // Fast in-memory deduplication to avoid slow sequential getDoc network roundtrips
      const seenBatchIds = new Set<string>();
      const nonDuplicateQuestions: Question[] = [];
      for (const q of finalQuestions) {
        if (!seenBatchIds.has(q.id)) {
          seenBatchIds.add(q.id);
          nonDuplicateQuestions.push(q);
        }
      }

      if (nonDuplicateQuestions.length === 0) {
        setParseError("All selected questions already exist in the database (no new questions to write).");
        setBulkSaveErrorCode("all-duplicates");
        setIsBulkSaving(false);
        isBulkSavingRef.current = false;
        return;
      }

      console.log(`[MCQ Import] [Step: Batch Commit] Committing ${nonDuplicateQuestions.length} new unique questions (${finalQuestions.length - nonDuplicateQuestions.length} duplicates skipped) in chunks of max 400 docs...`);

      // Requirement 5: writeBatch with max 400 docs and progress callback
      const commitResult = await commitQuestions(nonDuplicateQuestions, batchId, (progress) => {
        console.log(`[MCQ Import] [Step: Batch Commit] Progress: ${progress.progressText} (${progress.committedCount}/${progress.totalCount} docs saved)`);
        setBulkSaveProgress(progress.progressText);
      });

      if (!commitResult.success) {
        const errorMsg = commitResult.error || "Failed to commit questions to database.";
        const code = commitResult.errorCode || "import-failed";
        console.error(`[MCQ Import] [Step: Batch Commit] Failed [${code}]:`, errorMsg);
        setBulkSaveErrorCode(code);
        setParseError(
          commitResult.error
            ? `Import Failed [${code}]: ${commitResult.error}`
            : "Import Failed [permission-denied]: Missing or insufficient database permissions."
        );
        return;
      }

      if (commitResult.committedCount === 0 && (commitResult.skippedCount ?? 0) > 0) {
        console.log(`[MCQ Import] [Step: Finished] All ${commitResult.skippedCount} questions already match existing hashes (0 writes performed).`);
        const store = loadUserQuestionsStore();
        const allTopicQs = [...(store.cloudCacheQuestions || []), ...finalQuestions].filter(
          (q) => q.topicId === selectedTopicId
        );
        const dedupedTopicQs = new Map(allTopicQs.map((q) => [q.id, q]));
        setImportReport({
          batchId,
          uploadedCount: draftQuestions.length,
          validCount: finalQuestions.length,
          importedCount: 0,
          createdCount: 0,
          skippedCount: commitResult.skippedCount || finalQuestions.length,
          actualTotalInTopic: dedupedTopicQs.size,
        });
        setDraftQuestions(null);
        setParseError(null);
        setBulkSaveErrorCode(null);
        return;
      }

      console.log(`[MCQ Import] [Step: Finished] Successfully committed ${commitResult.committedCount} questions.`);

      // Success confirmed by Supabase! Update local store
      try {
        await onImportQuestions(finalQuestions, true);
      } catch (storeErr) {
        console.warn("[MCQ Import] Local store update warning:", storeErr);
      }

      // If user checked "Also Add to Official PYQ Vault"
      if (saveToPYQVault && finalQuestions.length > 0) {
        try {
          if (selectedPYQPaperId === "new" || !selectedPYQPaperId) {
            const paperTitle = newPYQTitle.trim() || `${selectedSubject?.name || "Official"} PYQ Paper ${new Date().getFullYear()}`;
            const newPaper: PYQPaper = {
              id: `pyq-admin-${Date.now()}`,
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
            await savePYQPaper(newPaper);
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
              await savePYQPaper(updatedPaper);
            }
          }
        } catch (pyqErr) {
          console.warn("[MCQ Import] Failed to update PYQ Paper:", pyqErr);
        }
      }

      // If user checked "Also Add to Live Test"
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
            await saveLiveTest(updatedTest);
          }
        } catch (liveErr) {
          console.warn("[MCQ Import] Failed to update Live Test:", liveErr);
        }
      }

      const store = loadUserQuestionsStore();
      const createdCount = commitResult.committedCount;
      const skippedCount = commitResult.skippedCount ?? Math.max(0, finalQuestions.length - createdCount);
      const allTopicQs = [...(store.cloudCacheQuestions || []), ...finalQuestions].filter(
        (q) => q.topicId === selectedTopicId
      );
      const dedupedTopicQs = new Map(allTopicQs.map((q) => [q.id, q]));
      const actualTotalInTopic = dedupedTopicQs.size;

      setLastImportedQuestionIds(finalQuestions.map((q) => q.id));
      setImportReport({
        batchId,
        uploadedCount: draftQuestions.length,
        validCount: finalQuestions.length,
        importedCount: commitResult.committedCount,
        createdCount,
        skippedCount,
        actualTotalInTopic,
      });
      setDraftQuestions(null);
      setParseError(null);
      setBulkSaveErrorCode(null);
    } catch (err: any) {
      console.error("[MCQ Import] [Step: Finished] Uncaught Error:", err);
      const formatted = formatDatabaseError(err);
      setBulkSaveErrorCode(formatted.code);
      setParseError(`Import Failed [${formatted.code}]: ${formatted.message}`);
    } finally {
      // Requirement 1: loading state is ALWAYS set to false in finally
      isBulkSavingRef.current = false;
      setIsBulkSaving(false);
      setBulkSaveProgress(null);
      console.log("[MCQ Import] [Step: Finished] handleBulkSaveQuestions completed (isBulkSaving reset to false).");
    }
  };

  const handleImportValidQuestions = () => handleBulkSaveQuestions(false);

  const handleUndo = async () => {
    if (!importReport?.batchId) return;
    try {
      setIsUndoing(true);
      setUndoStatusMsg("Undoing import and deleting records from database...");
      const result = await undoImportBatch(importReport.batchId);
      if (!result.success) {
        setUndoStatusMsg(`Undo failed: ${result.error || "Missing or insufficient permissions."}`);
        return;
      }
      if (onUndoImportQuestions && lastImportedQuestionIds.length > 0) {
        onUndoImportQuestions(lastImportedQuestionIds);
      }
      setUndoStatusMsg(`Import reversed: ${result.deletedCount} questions deleted successfully from database.`);
      setTimeout(() => {
        setImportReport(null);
        setDraftQuestions(null);
        setUndoStatusMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setUndoStatusMsg(`Undo failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsUndoing(false);
    }
  };

  // Save single draft question directly
  const handleSaveSingleDraft = (d: ParsedQuestionDraft) => {
    const timestamp = Date.now();
    const chId = (selectedChapterId && chapters.some((c) => c.id === selectedChapterId) ? selectedChapterId : null) ||
      (d.chapterId && chapters.some((c) => c.id === d.chapterId) ? d.chapterId : null) ||
      selectedChapterId || chapters[0]?.id;
    const targetCh = chapters.find((c) => c.id === chId) || selectedChapter || chapters[0];
    const tId = (selectedTopicId && targetCh?.topics?.some((t) => t.id === selectedTopicId) ? selectedTopicId : null) ||
      (d.topicId && targetCh?.topics?.some((t) => t.id === d.topicId) ? d.topicId : null) ||
      selectedTopicId || targetCh?.topics?.[0]?.id || "";
    const questionSubjectId =
      (selectedSubjectId && selectedSubjectId !== "all" ? selectedSubjectId : undefined) ||
      targetCh?.subjectId ||
      availableSubjects[0]?.id ||
      "economics";

    // Requirement: Stable deterministic ID for single save path too
    const contentHash = d.hash || generateQuestionHash({
      question: d.text,
      options: d.options,
      answer: d.answer || ["A", "B", "C", "D", "E"][d.correctIndex] || "A",
      table: d.tableData || d.table
    } as any);

    const stableId = `usr-q-${tId}-${contentHash}`;

    const singleQ: Question = {
      id: stableId,
      subjectId: questionSubjectId,
      chapterId: chId,
      topicId: tId,
      text: d.text.trim(),
      options: d.options,
      correctIndex: d.correctIndex >= 0 ? d.correctIndex : 0,
      explanation: d.explanation || "",
      importantFact: d.importantFact || undefined,
      difficulty: d.difficulty || "medium",
      createdAt: d.createdAt || new Date().toISOString(),
      isUserAdded: true,
      questionType: d.questionType || d.type,
      matchData: d.matchData,
      statements: d.statements,
      instruction: d.instruction,
      assertion: d.assertion,
      reason: d.reason,
      sequenceItems: d.sequenceItems,
      isNegative: d.isNegative,
      rawFallback: d.rawFallback,
      tableData: d.tableData,
      rawInput: d.rawInput || d.rawFallback || d.text,
      image: d.image,
      imageUrl: d.imageUrl,
    };

    onImportQuestions([singleQ]);
    
    // Also Add to Live Test if checked
    if (saveToLiveTest && selectedLiveTestId) {
      const targetTest = liveTestsList.find(t => t.id === selectedLiveTestId);
      if (targetTest) {
        const updatedTest: LiveTest = {
          ...targetTest,
          questions: [...(targetTest.questions || []), singleQ],
          questionCount: (targetTest.questions?.length || 0) + 1,
          updatedAt: new Date().toISOString(),
        };
        saveLiveTest(updatedTest);
      }
    }

    // Remove from draft list
    setDraftQuestions((prev) => {
      if (!prev) return null;
      const remaining = prev.filter((item) => item.tempId !== d.tempId);
      if (remaining.length === 0) {
        onClose();
        return null;
      }
      return remaining;
    });
  };

  // Sample templates helpers
  const handleInsertSampleText = () => {
    const sample = `Q1. Consider the following statements regarding the Day-Care Centers 'Bhakt Shravan Kumar Kalyan Seva Ashram':
Statement 1: These centers are initiated for men aged 60+ and women aged 55+.
Statement 2: Currently 10 day-care centers are operational in the state, offering medical checkups, adult education, and religious tours.
Which of the above statements is/are correct?
A Only 1
B Only 2
C Both 1 and 2
D Neither 1 nor 2
Answer: C
Explanation: Both statements are correct. The state government operates 10 Bhakt Shravan Kumar day-care centers for senior citizens, providing free healthcare, snacks, and religious pilgrimage facilities.

Q2. Consider the following statements regarding major river valley projects:
1. The Indira Gandhi Canal originates from the Harike Barrage at the confluence of the Satluj and Beas rivers.
2. The Chambal Valley Project is a joint multipurpose project between Rajasthan and Madhya Pradesh.
A Only 1
B Only 2
C Both 1 and 2
D Neither 1 nor 2
Answer: C
Explanation: Both statements are true. Indira Gandhi Canal originates from Harike Barrage, and Chambal project is a joint venture of Rajasthan and MP.`;
    setPasteText(sample);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#171923]/80 backdrop-blur-xs flex flex-col sm:p-4 sm:justify-center sm:items-center overflow-hidden">
      <div
        id="add-questions-modal-card"
        className="w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-[#FFF9EF] dark:bg-[#171923] border-0 sm:border border-[#E8D9C0] dark:border-[#31374A] rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 sm:zoom-in-95 duration-150"
      >
        {/* Heritage accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-[#800020] via-[#F47B20] to-[#C99A45] shrink-0" />
        {/* Mobile Pull Handle Indicator */}
        <div className="pt-2 pb-1 sm:hidden flex justify-center bg-white dark:bg-[#1F2330] shrink-0">
          <div className="w-10 h-1 bg-[#E8D9C0] dark:bg-[#31374A] rounded-full" />
        </div>

        {/* Modal Top Header */}
        <div className="px-4 py-3 sm:py-3.5 bg-white dark:bg-[#1F2330] border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0 border border-[#800020]/20 dark:border-[#F47B20]/30">
              <PlusCircle className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                <span>{draftQuestions ? "Preview Bulk Questions" : "Bulk MCQ Text Import"}</span>
              </h2>
              <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-bold truncate">
                {draftQuestions
                  ? `${selectedSubject?.hindiName || selectedSubject?.name || "All Subjects"} • ${selectedChapter?.hindiTitle || selectedChapter?.title || "All Chapters"} • ${selectedTopic?.hindiTitle || selectedTopic?.title || "All Topics"}`
                  : "Select Subject, Chapter, and Topic to import MCQs in bulk"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {draftQuestions && (
              <div className="text-[10px] font-bold text-slate-500 mr-2">
                Est: {draftQuestions.filter((q) => q.isValid).length || 0} writes
              </div>
            )}
            {draftQuestions && validCount > 0 && (
              <button
                id="btn-header-bulk-save"
                type="button"
                onClick={() => handleBulkSaveQuestions(false)}
                disabled={isBulkSaving}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                title={`Bulk Save All ${validCount} Questions`}
              >
                {isBulkSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                )}
                <span>{isBulkSaving ? (bulkSaveProgress ? `Saving (${bulkSaveProgress})...` : "Saving...") : `Bulk Save (${validCount})`}</span>
              </button>
            )}
            <button
              id="btn-close-add-questions"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Wizard Progress Steps Indicator */}
        <div className="px-4 py-2 bg-slate-50/80 dark:bg-[#0f192b]/80 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between shrink-0 text-xs text-slate-500 dark:text-slate-400 select-none">
          <div className="flex items-center gap-1.5 font-bold">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              draftQuestions 
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/30" 
                : "bg-[#7045D8] text-white"
            }`}>
              {draftQuestions ? "✓" : "1"}
            </span>
            <span className={draftQuestions ? "text-slate-400 line-through text-[11px]" : "text-blue-600 dark:text-blue-400 font-extrabold text-[11px]"}>
              Setup & Input
            </span>
          </div>
          <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 mx-3"></div>
          <div className="flex items-center gap-1.5 font-bold">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              draftQuestions 
                ? "bg-[#7045D8] text-white" 
                : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
            }`}>
              2
            </span>
            <span className={draftQuestions ? "text-blue-600 dark:text-blue-400 font-extrabold text-[11px]" : "text-slate-400 dark:text-slate-500 text-[11px]"}>
              Validation & Review
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 pb-24 sm:pb-6">
          {/* STEP 1: SUBJECT, CHAPTER & TOPIC SELECTOR */}
          {!draftQuestions ? (
            <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#7045D8]" />
                  <span>Target Syllabus Location</span>
                  {isLoadingSyllabus && <Loader2 className="w-3 h-3 animate-spin text-blue-600 ml-1" />}
                </span>
                <div className="flex items-center gap-2">
                  {syllabusError && (
                    <span className="text-[10px] font-bold text-rose-500 truncate max-w-[200px]" title={syllabusError}>
                      Error loading syllabus
                    </span>
                  )}
                  {availableSubjects.length > 1 && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200/30">
                      {availableSubjects.length} Subjects
                    </span>
                  )}
                </div>
              </div>

              {/* 3-Tier Grid: Subject -> Chapter -> Topic */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Select Subject */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Select Subject</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openSelectionModal("subject")}
                    className="w-full flex items-center justify-between pl-3 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left cursor-pointer min-h-[38px] hover:border-blue-400/50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {selectedSubjectId === "all" 
                        ? "All Subjects" 
                        : (selectedSubject?.name || selectedSubject?.hindiName || "Select Subject")}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </button>
                </div>

                {/* 2. Select Chapter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FolderPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Select Chapter</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openSelectionModal("chapter")}
                    className="w-full flex items-center justify-between pl-3 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left cursor-pointer min-h-[38px] hover:border-indigo-400/50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {selectedChapter?.title || selectedChapter?.hindiTitle || "Select Chapter"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </button>
                </div>

                {/* 3. Select Topic */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Select Topic</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openSelectionModal("topic")}
                    className="w-full flex items-center justify-between pl-3 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left cursor-pointer min-h-[38px] hover:border-purple-400/50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {selectedTopic?.title || selectedTopic?.hindiTitle || "Select Topic"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Selected Curriculum Destination in Preview Mode */
            <div className="space-y-2">
              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="min-w-0">
                  <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase tracking-wider font-extrabold block">
                    Import Destination
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                    {selectedSubject?.hindiName || selectedSubject?.name || "All Subjects"}
                    <span className="text-slate-400 dark:text-slate-500 mx-1.5">/</span>
                    {selectedChapter?.hindiTitle || selectedChapter?.title}
                    <span className="text-slate-400 dark:text-slate-500 mx-1.5">/</span>
                    <span className="text-blue-600 dark:text-blue-400">{selectedTopic?.hindiTitle || selectedTopic?.title}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftQuestions(null)}
                  className="self-start sm:self-auto text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/80 px-3 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-all shadow-xs shrink-0"
                >
                  Change Destination
                </button>
              </div>
            </div>
          )}

          {/* INTEGRATION OPTIONS (Step 1 Setup Only to prevent crowding preview mode) */}
          {!draftQuestions && (
            <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Additional Save Options</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Official PYQ Vault Dual-Add Option */}
                <div className={`p-3 rounded-xl border transition-all ${
                  saveToPYQVault 
                    ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 shadow-xs" 
                    : "bg-slate-50/80 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80"
                }`}>
                  <label className="flex items-center justify-between cursor-pointer group mb-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block truncate">
                          Also Add to PYQ Vault
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold truncate">Link questions to an Official Past Year Paper</p>
                      </div>
                    </div>
                    <div className="relative shrink-0 ml-2">
                      <input
                        type="checkbox"
                        checked={saveToPYQVault}
                        onChange={(e) => setSaveToPYQVault(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </div>
                  </label>

                  {saveToPYQVault && (
                    <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5">
                        <select
                          value={selectedPYQPaperId}
                          onChange={(e) => setSelectedPYQPaperId(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-xs text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="new">+ Create New PYQ Paper</option>
                          {pyqPapersList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.examBoard} {p.paperYear} • {p.title}
                            </option>
                          ))}
                        </select>

                        {selectedPYQPaperId === "new" && (
                          <input
                            type="text"
                            placeholder="Enter New Paper Title..."
                            value={newPYQTitle}
                            onChange={(e) => setNewPYQTitle(e.target.value)}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* LIVE TEST INTEGRATION */}
                <div className={`p-3 rounded-xl border transition-all ${
                  saveToLiveTest 
                    ? "bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 shadow-xs" 
                    : "bg-slate-50/80 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80"
                }`}>
                  <label className="flex items-center justify-between cursor-pointer group mb-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                        <Radio className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block truncate">
                          Also Add to Live Test
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold truncate">Instantly add these questions to an active Live Test</p>
                      </div>
                    </div>
                    <div className="relative shrink-0 ml-2">
                      <input
                        type="checkbox"
                        checked={saveToLiveTest}
                        onChange={(e) => setSaveToLiveTest(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                    </div>
                  </label>

                  {saveToLiveTest && (
                    <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <select
                        value={selectedLiveTestId}
                        onChange={(e) => setSelectedLiveTestId(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl font-bold text-xs text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-red-500 focus:outline-none"
                      >
                        <option value="">-- Choose Live Test --</option>
                        {liveTestsList.map((t, tIdx) => (
                          <option key={`${t.id}-${tIdx}`} value={t.id}>
                            {t.title} ({t.questionCount} Qs)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INPUT METHOD SELECTION (If not in preview mode) */}
          {!draftQuestions ? (
            <div className="space-y-3">
              {/* Responsive Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveMethod("paste")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[34px] ${
                    activeMethod === "paste"
                      ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-800"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Paste Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMethod("json")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[34px] ${
                    activeMethod === "json"
                      ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-800"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMethod("file")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[34px] ${
                    activeMethod === "file"
                      ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-800"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">File Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMethod("manual")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[34px] ${
                    activeMethod === "manual"
                      ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-800"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Single MCQ</span>
                </button>
              </div>

              {/* TAB 1: PASTE TEXT */}
              {activeMethod === "paste" && (
                <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Paste MCQ Questions</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowImportTemplates(true)}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs font-extrabold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-1.5 cursor-pointer min-h-[32px] transition-all shadow-xs"
                      title="View downloadable templates"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Import Templates</span>
                    </button>
                  </div>

                  {/* Formatting tools bar */}
                  {pasteText.trim() && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={handleFormatPasteWithAI}
                        disabled={isAiFormattingPaste}
                        className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 text-white text-[11px] font-bold shadow-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                      >
                        {isAiFormattingPaste ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-200" />}
                        <span>{isAiFormattingPaste ? "Formatting..." : "Format with AI"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasteText(cleanAndStandardizeBulkText(pasteText))}
                        className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Clean Text</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasteText("")}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer transition-all ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    </div>
                  )}

                  <textarea
                    id="textarea-paste-questions"
                    rows={8}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    autoComplete="off"
                    placeholder={`Paste bulk MCQ text from Word, PDF, Telegram, or WhatsApp...

Q1. Which river originates in Janapav Hills?
A. Chambal
B. Mahi
C. Banas
D. Luni
Answer: A
Explanation: The Chambal River originates near Janapav Hills in Mhow.`}
                    className={`w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs leading-relaxed min-h-[180px] sm:min-h-[220px] transition-all ${
                      validateMathSyntax(pasteText)
                        ? "border-amber-400 dark:border-amber-600/50"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  />

                  {validateMathSyntax(pasteText) && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold leading-tight">{validateMathSyntax(pasteText)}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <p className="truncate flex items-center gap-1">
                      <span className="text-amber-500 font-bold">⚡</span> Supports Q1. or 1. numbering, bulleted statements, match lists, and Ans: X
                    </p>
                    {pasteText.trim() && (
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        {pasteText.split(/\n\s*(?:Q\d+|Question|\d+\.)/i).length - 1 || 1} block(s)
                      </span>
                    )}
                  </div>

                  <button
                    id="btn-preview-pasted-text"
                    onClick={handleProcessPastedText}
                    disabled={isParsingPastedText || isAiFormattingPaste}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-98 min-h-[44px] disabled:opacity-60"
                  >
                    {isParsingPastedText ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Parsing Questions with AI...</span>
                      </>
                    ) : (
                      <>
                        <span>Parse & Preview Bulk Questions</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* TAB 2: JSON (TEXT PASTE & FILE UPLOAD) */}
              {activeMethod === "json" && (
                <div className="space-y-3">
                  {/* Mode switcher: Paste JSON Text vs Upload .JSON File */}
                  <div className="flex items-center justify-between gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setJsonTabMode("paste")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                        jsonTabMode === "paste"
                          ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/30 dark:border-slate-850/20"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Paste JSON Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setJsonTabMode("upload")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                        jsonTabMode === "upload"
                          ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/30 dark:border-slate-850/20"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload JSON File</span>
                    </button>
                  </div>

                  {/* Sub-mode A: Paste JSON Text */}
                  {jsonTabMode === "paste" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label
                          htmlFor="textarea-paste-json"
                          className="text-xs font-extrabold text-slate-700 dark:text-slate-300"
                        >
                          Paste JSON Text (Strict schemaVersion 1 format)
                        </label>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(getSampleImportJSON());
                                setCopiedSample(true);
                                setTimeout(() => setCopiedSample(false), 2500);
                              } catch {
                                setJsonPasteText(getSampleImportJSON());
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                            title="Copy strict JSON import template to clipboard"
                          >
                            {copiedSample ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Sample JSON</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setJsonPasteText(getSampleImportJSON());
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                            title="Load official schema sample into editor"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Load Sample</span>
                          </button>

                          {jsonPasteText && (
                            <button
                              type="button"
                              onClick={() => setJsonPasteText("")}
                              className="text-[11px] font-extrabold text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="relative">
                        <textarea
                          id="textarea-paste-json"
                          value={jsonPasteText}
                          onChange={(e) => setJsonPasteText(e.target.value)}
                          autoComplete="off"
                          placeholder={`Paste valid JSON here...\n\n{\n  "schemaVersion": 1,\n  "questions": [\n    {\n      "type": "single_correct",\n      "question": "Which national highway connects Jaipur and Delhi in India?",\n      "options": ["NH-48", "NH-52", "NH-11", "NH-21"],\n      "answer": "A",\n      "explanation": "NH-48 connects Delhi and Jaipur.",\n      "subject": "Rajasthan Geography",\n      "chapter": "Transport",\n      "topic": "Highways"\n    }\n  ]\n}`}
                          rows={10}
                          className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          id="btn-validate-preview-json"
                          type="button"
                          onClick={() => handleProcessJSON(jsonPasteText)}
                          className="flex-1 py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 min-h-[48px]"
                        >
                          <Sparkles className="w-4 h-4 text-amber-200" />
                          <span>Validate & Preview Questions</span>
                        </button>

                        <button
                          id="btn-json-self-test"
                          type="button"
                          onClick={handleRunSelfTest}
                          className="py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 min-h-[48px]"
                          title="Run 5 standard question types (single_correct, statement_based, assertion_reason, match_list, math) through the parser"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>JSON Self-Test</span>
                        </button>
                      </div>

                      {/* AI Recovery / Parsing Live Progress Banner */}
                      {importProcessingState !== "idle" && importProcessingState !== "ready" && importProcessingState !== "failed" && (
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-xl border border-blue-300 dark:border-blue-800 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                              <span className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                                {importProcessingState === "parsing" && "Parsing JSON Structure..."}
                                {importProcessingState === "validating" && "Running Deterministic Validation..."}
                                {importProcessingState === "recovering" && (recoveryProgress?.message || "Recovering Unresolved Questions via Gemini AI...")}
                                {importProcessingState === "revalidating" && "Revalidating Recovered Questions..."}
                              </span>
                            </div>
                            {importProcessingState === "recovering" && (
                              <button
                                type="button"
                                onClick={handleCancelAIRecovery}
                                className="text-[11px] font-black text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-rose-300 dark:border-rose-900/60 shadow-xs cursor-pointer active:scale-95 transition-all"
                              >
                                Cancel AI Recovery
                              </button>
                            )}
                          </div>
                          {recoveryProgress && recoveryProgress.total > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <div className="w-full bg-blue-100 dark:bg-blue-900/60 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 transition-all duration-300 rounded-full"
                                  style={{
                                    width: `${Math.min(100, Math.round((recoveryProgress.completed / recoveryProgress.total) * 100))}%`,
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-[11px] text-blue-700 dark:text-blue-300 font-mono font-bold">
                                <span>Batch {recoveryProgress.currentBatch} of {recoveryProgress.totalBatches}</span>
                                <span>{recoveryProgress.completed} / {recoveryProgress.total} questions processed</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Smart Import Summary Banner */}
                      {smartImportSummary && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between mb-2.5">
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span>Smart Import Summary</span>
                            </h4>
                            {smartImportSummary.recoveredByAI > 0 && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                                ✨ {smartImportSummary.recoveredByAI} Recovered by AI
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center font-mono">
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <div className="text-[10px] font-bold text-slate-500 uppercase">Detected</div>
                              <div className="text-sm font-black text-slate-800 dark:text-slate-100">{smartImportSummary.total}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Valid</div>
                              <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">{smartImportSummary.valid}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">AI Recovered</div>
                              <div className="text-sm font-black text-indigo-700 dark:text-indigo-300">{smartImportSummary.recoveredByAI}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Needs Review</div>
                              <div className="text-sm font-black text-amber-700 dark:text-amber-300">{smartImportSummary.needsReview}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Invalid</div>
                              <div className="text-sm font-black text-rose-700 dark:text-rose-300">{smartImportSummary.errors}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                              <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Duplicates</div>
                              <div className="text-sm font-black text-purple-700 dark:text-purple-300">{smartImportSummary.duplicates}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* On-Screen Self-Test Results Panel */}
                      {jsonSelfTestResults && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span>JSON Self-Test Summary: {jsonSelfTestResults.filter(t => t.status === "PASS").length} / {jsonSelfTestResults.length} PASSED</span>
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                              All 5 Types Verified
                            </span>
                          </div>
                          <div className="space-y-1.5 mt-2">
                            {jsonSelfTestResults.map((t) => (
                              <div
                                key={t.qNum}
                                className={`text-xs p-2 rounded-lg font-mono flex items-start gap-2 ${
                                  t.status === "PASS"
                                    ? "bg-white/80 dark:bg-slate-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900/40"
                                    : "bg-rose-50 text-rose-800 border border-rose-300"
                                }`}
                              >
                                <span className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                                  t.status === "PASS" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                                }`}>
                                  Q{t.qNum} {t.status}
                                </span>
                                <div className="flex-1 leading-snug">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mr-1.5">
                                    [{t.type}]
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                                    {t.reason}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error Banner with Line/Column Information */}
                      {parseError && (
                        <div className="p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-900/60 animate-in fade-in duration-150">
                          <h4 className="text-xs font-black text-rose-700 dark:text-rose-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Syntax / Validation Error</span>
                          </h4>
                          <p className="text-xs text-rose-700 dark:text-rose-300 font-mono font-medium leading-relaxed break-words whitespace-pre-wrap">
                            {parseError}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-mode B: Upload .JSON File */}
                  {jsonTabMode === "upload" && (
                    <div className="space-y-3">
                      <input
                        type="file"
                        ref={jsonFileInputRef}
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />

                      <div
                        onClick={() => jsonFileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-white dark:bg-[#111A2E] transition-all active:scale-[0.99]"
                      >
                        <FileCode className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                          Upload JSON File
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                          Click to browse or drag and drop (.json)
                        </p>
                      </div>

                      {/* Sample JSON snippet */}
                      <div className="bg-slate-100 dark:bg-slate-900/40 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400 space-y-1">
                        <span className="font-extrabold text-slate-700 dark:text-slate-300 block text-xs">
                          Accepted Schema Formats:
                        </span>
                        <pre className="overflow-x-auto text-[11px] leading-relaxed">
{`Format A: [ { "question": "...", "options": ["A","B","C","D"], "correctAnswer": "A" } ]

Format B: { "testId": "...", "questions": [ { "question": "...", "options": { "A": "...", ... }, "correctAnswer": "A" } ] }`}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FILE UPLOAD (JSON, CSV, TXT) */}
              {activeMethod === "file" && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={generalFileInputRef}
                    accept=".json,.csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />

                  <div
                    onClick={() => generalFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-white dark:bg-[#111A2E] transition-all active:scale-[0.99]"
                  >
                    <Upload className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      Upload Question File
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Supports .JSON, .CSV, and .TXT formats
                    </p>
                  </div>

                  <p className="text-xs text-slate-400 text-center font-medium">
                    Files will be parsed, validated, and shown in the preview before saving.
                  </p>
                </div>
              )}

              {/* TAB 4: MANUAL FORM */}
              {activeMethod === "manual" && (
                <div className="bg-white dark:bg-[#111A2E] border border-slate-200/60 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  {/* Smart AI Quick-Paste Box */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-purple-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100">
                        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                        <span>Smart AI Auto-Fill from PDF / Web Text</span>
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                        Gemini AI
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={rawCopiedClip}
                      onChange={(e) => setRawCopiedClip(e.target.value)}
                      placeholder="Paste raw copied question text here from PDF or website (e.g., Q1. What is... A) ... B) ... Answer: A)...)"
                      className="w-full p-2.5 text-xs rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed font-hindi placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={handleParseAndFillFromRaw}
                      disabled={isAiFormattingManual}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 hover:from-amber-600 hover:to-blue-700 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                    >
                      {isAiFormattingManual ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>Gemini AI is Analyzing & Filling Fields...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
                          <span>Parse Copied Text & Auto-Fill Form Fields</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      Or Edit Form Fields Manually
                    </span>
                    <button
                      type="button"
                      onClick={handleFormatManualWithAI}
                      disabled={isAiFormattingManual}
                      className="text-xs font-extrabold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Organize current form inputs into Question, Options A-D, Answer & Explanation"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>Re-format Current Fields</span>
                    </button>
                  </div>

                  {aiFormatMsg && (
                    <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>{aiFormatMsg}</span>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                      Question Text
                    </label>
                    <textarea
                      rows={3}
                      value={manualQuestion.text}
                      autoComplete="off"
                      onChange={(e) =>
                        setManualQuestion({ ...manualQuestion, text: e.target.value })
                      }
                      placeholder="Enter question..."
                      className={`w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed transition-all ${
                        validateMathSyntax(manualQuestion.text)
                          ? "border-amber-400 dark:border-amber-600/50"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    />
                    {validateMathSyntax(manualQuestion.text) && (
                      <div className="mt-1 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{validateMathSyntax(manualQuestion.text)}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Option A
                      </label>
                      <input
                        type="text"
                        value={manualQuestion.optionA}
                        onChange={(e) =>
                          setManualQuestion({ ...manualQuestion, optionA: e.target.value })
                        }
                        placeholder="Option A"
                        className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all ${
                          validateMathSyntax(manualQuestion.optionA)
                            ? "border-amber-400 dark:border-amber-600/50"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      />
                      {validateMathSyntax(manualQuestion.optionA) && (
                        <div className="mt-0.5 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                          {validateMathSyntax(manualQuestion.optionA)}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Option B
                      </label>
                      <input
                        type="text"
                        value={manualQuestion.optionB}
                        onChange={(e) =>
                          setManualQuestion({ ...manualQuestion, optionB: e.target.value })
                        }
                        placeholder="Option B"
                        className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all ${
                          validateMathSyntax(manualQuestion.optionB)
                            ? "border-amber-400 dark:border-amber-600/50"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      />
                      {validateMathSyntax(manualQuestion.optionB) && (
                        <div className="mt-0.5 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                          {validateMathSyntax(manualQuestion.optionB)}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Option C
                      </label>
                      <input
                        type="text"
                        value={manualQuestion.optionC}
                        onChange={(e) =>
                          setManualQuestion({ ...manualQuestion, optionC: e.target.value })
                        }
                        placeholder="Option C"
                        className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all ${
                          validateMathSyntax(manualQuestion.optionC)
                            ? "border-amber-400 dark:border-amber-600/50"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      />
                      {validateMathSyntax(manualQuestion.optionC) && (
                        <div className="mt-0.5 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                          {validateMathSyntax(manualQuestion.optionC)}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Option D
                      </label>
                      <input
                        type="text"
                        value={manualQuestion.optionD}
                        onChange={(e) =>
                          setManualQuestion({ ...manualQuestion, optionD: e.target.value })
                        }
                        placeholder="Option D"
                        className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all ${
                          validateMathSyntax(manualQuestion.optionD)
                            ? "border-amber-400 dark:border-amber-600/50"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      />
                      {validateMathSyntax(manualQuestion.optionD) && (
                        <div className="mt-0.5 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                          {validateMathSyntax(manualQuestion.optionD)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Correct Answer
                      </label>
                      <select
                        value={manualQuestion.correctAnswer}
                        onChange={(e) =>
                          setManualQuestion({
                            ...manualQuestion,
                            correctAnswer: e.target.value,
                          })
                        }
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-450 focus:ring-2 focus:ring-blue-500/50 focus:outline-none cursor-pointer"
                      >
                        <option value="0">Option A</option>
                        <option value="1">Option B</option>
                        <option value="2">Option C</option>
                        <option value="3">Option D</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                        Important Fact (Optional)
                      </label>
                      <input
                        type="text"
                        value={manualQuestion.importantFact}
                        onChange={(e) =>
                          setManualQuestion({
                            ...manualQuestion,
                            importantFact: e.target.value,
                          })
                        }
                        placeholder="Optional key takeaway"
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-1">
                      Explanation
                    </label>
                    <textarea
                      rows={2}
                      value={manualQuestion.explanation}
                      onChange={(e) =>
                        setManualQuestion({
                          ...manualQuestion,
                          explanation: e.target.value,
                        })
                      }
                      placeholder="Why is this answer correct?"
                      className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none leading-relaxed transition-all ${
                        validateMathSyntax(manualQuestion.explanation)
                          ? "border-amber-400 dark:border-amber-600/50"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    />
                    {validateMathSyntax(manualQuestion.explanation) && (
                      <div className="mt-1 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        {validateMathSyntax(manualQuestion.explanation)}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleProcessManual}
                    className="w-full py-3 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer active:scale-95 shadow-sm"
                  >
                    Preview Question
                  </button>
                </div>
              )}
            </div>
          ) : importReport ? (
            /* STEP 3: IMPORT SUCCESS & ROLLBACK REPORT SCREEN */
            <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-8 text-center space-y-4 shadow-sm animate-in zoom-in-95 duration-150 max-w-lg mx-auto my-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Bulk Import Completed Successfully!
                </h3>

                {/* 5-Metric Accurate Database Breakdown */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-slate-800">
                    <span className="text-slate-500 font-semibold">Uploaded from input:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{importReport.uploadedCount ?? importReport.importedCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-slate-800">
                    <span className="text-slate-500 font-semibold">Valid questions:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{importReport.validCount ?? importReport.importedCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-slate-800">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">New questions created:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{importReport.createdCount ?? importReport.importedCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-slate-800">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">Duplicates updated/skipped:</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{importReport.skippedCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 pt-1.5">
                    <span className="text-blue-600 dark:text-blue-400 font-black">Actual total in topic:</span>
                    <span className="font-mono font-black text-blue-600 dark:text-blue-400">{importReport.actualTotalInTopic ?? importReport.importedCount}</span>
                  </div>
                </div>

                <div className="inline-block mt-1 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold border border-slate-200/60 dark:border-slate-700/60">
                  Batch ID: {importReport.batchId}
                </div>
              </div>

              {undoStatusMsg && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 text-xs font-bold">
                  {undoStatusMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isUndoing}
                  onClick={handleUndo}
                  className="w-full py-3 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {isUndoing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span>Undo this import</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportReport(null);
                    setDraftQuestions(null);
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[44px]"
                >
                  <Check className="w-4 h-4" />
                  <span>Done & Close</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: QUESTION VALIDATION & PREVIEW SCREEN */
            <div className="space-y-3" id="questions-preview-section">
              {/* Duplicate Question Identification Banner */}
              {duplicateIds.size > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 shadow-xs">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                      ⚠️ 90%+ Similarity Duplicate Questions: {duplicateIds.size} questions already exist in the database or paste batch!
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
                      The system flagged duplicate questions to prevent redundant entries in the database. You can filter them or remove them in one click.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFilterMode("duplicates")}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      View Duplicates ({duplicateIds.size})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to remove all ${duplicateIds.size} duplicate questions from this import list?`)) {
                          setDraftQuestions((prev) => (prev || []).filter((q) => !duplicateIds.has(q.tempId)));
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                      title="Remove all duplicate questions from this import batch"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove All</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 5 Interactive Summary Stat Pills (Mobile: compact swipeable row; Desktop: 5-column grid) */}
              <div className="flex sm:grid sm:grid-cols-5 gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0 -mx-0.5 px-0.5">
                {/* 1. Total */}
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`shrink-0 min-w-[90px] sm:min-w-0 p-2 sm:p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    filterMode === "all"
                      ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                      : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Total
                    </span>
                    <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    {draftQuestions.length}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 truncate hidden sm:block">
                    All Detected
                  </div>
                </button>

                {/* 2. Valid */}
                <button
                  type="button"
                  onClick={() => setFilterMode("clean")}
                  className={`shrink-0 min-w-[90px] sm:min-w-0 p-2 sm:p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    filterMode === "clean"
                      ? "bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                      : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Valid
                    </span>
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {validCount}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 truncate hidden sm:block">
                    Ready to import
                  </div>
                </button>

                {/* 2.5 AI Recovered */}
                {aiRecoveredCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode("recovered")}
                    className={`shrink-0 min-w-[90px] sm:min-w-0 p-2 sm:p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      filterMode === "recovered"
                        ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        Recovered
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    </div>
                    <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {aiRecoveredCount}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 truncate hidden sm:block">
                      By Gemini AI
                    </div>
                  </button>
                )}

                {/* 3. Warnings */}
                <button
                  type="button"
                  onClick={() => setFilterMode("review")}
                  className={`shrink-0 min-w-[90px] sm:min-w-0 p-2 sm:p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    filterMode === "review"
                      ? "bg-amber-50/90 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                      : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Warnings
                    </span>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {reviewCount}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 truncate hidden sm:block">
                    Still importable
                  </div>
                </button>

                {/* 4. Errors */}
                <button
                  type="button"
                  onClick={() => setFilterMode("errors")}
                  className={`shrink-0 min-w-[90px] sm:min-w-0 p-2 sm:p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    filterMode === "errors"
                      ? "bg-rose-50/90 dark:bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                      : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                      Errors
                    </span>
                    <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${invalidCount > 0 ? "text-rose-500 animate-pulse" : "text-slate-400"}`} />
                  </div>
                  <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    {invalidCount}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 truncate hidden sm:block">
                    {invalidCount > 0 ? "Blocks question" : "None"}
                  </div>
                </button>

                {/* 5. Duplicates */}
                <button
                  type="button"
                  onClick={() => setFilterMode("duplicates")}
                  className={`shrink-0 min-w-[90px] sm:min-w-0 p-2 sm:p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    filterMode === "duplicates"
                      ? "bg-purple-50/90 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                      : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Dupes
                    </span>
                    <RotateCcw className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
                    {duplicateIds.size}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 truncate hidden sm:block">
                    Already in DB
                  </div>
                </button>
              </div>

              {/* Action & Filter Toolbar */}
              <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3.5 space-y-2 shadow-xs">
                {/* Search & Type filter */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-7 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={previewSearchQuery}
                      onChange={(e) => setPreviewSearchQuery(e.target.value)}
                      placeholder="Search question keyword, option or Q#..."
                      className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-hindi font-medium"
                    />
                    {previewSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPreviewSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="sm:col-span-5 relative">
                    <select
                      value={selectedTypeFilter}
                      onChange={(e) => setSelectedTypeFilter(e.target.value)}
                      className="w-full py-2 pl-3 pr-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer appearance-none"
                    >
                      <option value="all">All Question Types ({draftQuestions.length})</option>
                      {Object.entries(structureCounts).map(([type, count]) => {
                        const info = getQuestionTypeInfo(type);
                        return (
                          <option key={type} value={type}>
                            {info.label} ({count})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Selection & Card Expand Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-extrabold min-h-[32px]">
                    <input
                      type="checkbox"
                      checked={validCount > 0 && selectedCount === validCount}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Select Valid ({selectedCount}/{validCount})</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {/* Expand/Collapse All Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        if (expandedCardIds.size === filteredDrafts.length && filteredDrafts.length > 0) {
                          handleCollapseAllCards();
                        } else {
                          handleExpandAllCards();
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer min-h-[32px]"
                    >
                      {expandedCardIds.size === filteredDrafts.length && filteredDrafts.length > 0 ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Collapse All</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Expand All ({filteredDrafts.length})</span>
                        </>
                      )}
                    </button>

                    {invalidCount > 0 && (
                      <button
                        type="button"
                        onClick={handleJumpToFirstError}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/50 text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer min-h-[32px]"
                        title="Jump to the first question with an error"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Fix First Error</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Filter Pill if filtered */}
              {filterMode !== "all" && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200/50">
                  <span>
                    Viewing: {filterMode === "clean" ? "Valid Questions Only" : filterMode === "review" ? "Warnings Only" : filterMode === "errors" ? "Errors Only" : "Duplicates Only"} ({filteredDrafts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className="text-[11px] font-black underline hover:text-blue-900 dark:hover:text-blue-200 cursor-pointer"
                  >
                    Show All Questions
                  </button>
                </div>
              )}

              {/* Question Cards List */}
              {filteredDrafts.length === 0 ? (
                <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    {filterMode === "errors"
                      ? "Great! No validation errors in this batch."
                      : "No questions match the current filter or search."}
                  </p>
                  <p className="text-xs text-slate-400">
                    {filterMode === "errors"
                      ? "All detected questions are valid and ready to import."
                      : "Try switching filter tabs or clearing the search box."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDrafts.map((draft, idx) => {
                    const isEditing = editingDraftId === draft.tempId;

                    if (isEditing) {
                      return (
                        <InlineDraftEditor
                          key={draft.tempId}
                          draft={draft}
                          onSave={handleUpdateDraft}
                          onCancel={() => setEditingDraftId(null)}
                        />
                      );
                    }

                    const isSelected = selectedDraftIds.has(draft.tempId);
                    const isExpanded = expandedCardIds.has(draft.tempId);
                    const qTypeInfo = getQuestionTypeInfo(draft.questionType);
                    const isDupe = duplicateIds.has(draft.tempId);
                    const dupeInfo = duplicateDetailsMap.get(draft.tempId);

                    return (
                      <div
                        id={`draft-card-${draft.tempId}`}
                        key={draft.tempId}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          !draft.isValid
                            ? "bg-rose-50/20 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20"
                            : isSelected
                            ? "bg-white dark:bg-[#111A2E] border-blue-400 dark:border-[#7045D8] shadow-xs"
                            : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800"
                        }`}
                      >
                        {/* CARD TOP BAR - Checkbox, Badges, and Action Icons */}
                        <div className="px-3.5 py-3 sm:px-4.5 sm:py-3.5 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Selection Checkbox */}
                            {draft.isValid && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectDraft(draft.tempId)}
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                                title="Select for bulk import"
                              />
                            )}

                            {/* Q# Badge */}
                            <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono font-black text-xs border border-blue-200/40">
                              Q{draft.questionNumber || idx + 1}
                            </span>

                            {/* Question Type Badge */}
                            {draft.questionType && (
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${qTypeInfo.color}`}>
                                {qTypeInfo.label}
                              </span>
                            )}

                            {/* Subject & Chapter Badges from JSON */}
                            {draft.subject && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                                {draft.subject}
                              </span>
                            )}
                            {draft.chapter && (
                              <span className="hidden sm:inline px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {draft.chapter}
                              </span>
                            )}
                            {draft.topic && (
                              <span className="hidden md:inline px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                {draft.topic}
                              </span>
                            )}
                            {draft.year && (
                              <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                                {draft.year}
                              </span>
                            )}
                            {draft.exam && (
                              <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/50">
                                {draft.exam}
                              </span>
                            )}

                            {/* Validation Status Badge */}
                            {!draft.isValid ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Error ({draft.errors.length})</span>
                              </span>
                            ) : draft.warnings && draft.warnings.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>Warning</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Valid</span>
                              </span>
                            )}

                            {isDupe && (
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1 ${
                                  dupeInfo && dupeInfo.percentage === 100
                                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300"
                                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300"
                                }`}
                                title={
                                  dupeInfo
                                    ? `${dupeInfo.percentage}% similarity (${dupeInfo.isBatchInternal ? "in paste batch" : "in database"}): "${dupeInfo.matchedText.slice(0, 100)}..."`
                                    : "Duplicate question detected"
                                }
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>
                                  {dupeInfo
                                    ? `${dupeInfo.percentage}% Duplicate (${dupeInfo.isBatchInternal ? "Batch" : "DB"})`
                                    : "Duplicate in DB"}
                                </span>
                              </span>
                            )}

                            {draft.recoveredByAI && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>AI Recovered</span>
                              </span>
                            )}

                            {draft.needsReview && (
                              <span
                                className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 flex items-center gap-1"
                                title={draft.reviewReason || "Flagged for manual review"}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Needs Review</span>
                              </span>
                            )}
                          </div>

                          {/* Quick Header Buttons */}
                          <div className="flex items-center gap-1.5 ml-auto">
                            {draft.originalData && (
                              <button
                                type="button"
                                onClick={() => setInspectingOriginalDraft(draft)}
                                className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer border border-indigo-200/60 min-h-[30px]"
                                title="Compare recovered question with original raw input"
                              >
                                <FileCode className="w-3 h-3 text-indigo-500" />
                                <span className="hidden sm:inline">Compare</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setEditingDraftId(draft.tempId)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer min-h-[30px]"
                              title="Edit question in inline editor"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(draft.tempId)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                              title="Delete question from preview"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleExpandCard(draft.tempId)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all cursor-pointer"
                              title={isExpanded ? "Collapse card" : "Expand card"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* CARD BODY */}
                        <div className="p-3.5 sm:p-4.5 space-y-3">

                          {/* Full Question Text with Structured Math/Statements */}
                          <div>
                            <RichText
                              text={draft.text}
                              className="text-xs sm:text-base font-bold text-slate-900 dark:text-slate-100"
                            />
                            {(draft.table || draft.tableData) && (
                              <QuestionTable table={draft.table || draft.tableData} />
                            )}
                          </div>

                          {/* Options List (Clean, fully visible, supports 2 to 5 options) */}
                          {isExpanded && (
                            <div className="space-y-2 pt-1 font-hindi">
                              {draft.options.map((optText, optIdx) => {
                                const letter = ["A", "B", "C", "D", "E"][optIdx] || `${optIdx + 1}`;
                                const isCorrect = draft.correctIndex === optIdx;
                                return (
                                  <div
                                    key={letter}
                                    className={`px-3 py-2.5 rounded-xl flex items-start gap-2.5 transition-all text-xs sm:text-sm ${
                                      isCorrect
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs"
                                        : "bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                                    }`}
                                  >
                                    <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[11px] font-black shrink-0 mt-0.5 ${
                                      isCorrect
                                        ? "bg-emerald-600 text-white"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                    }`}>
                                      {letter}
                                    </span>
                                    <div className="flex-1 min-w-0 font-hindi">
                                      {optText ? (
                                        <RichText text={optText} />
                                      ) : (
                                        <span className="text-rose-500 font-bold italic">Empty Option Text</span>
                                      )}
                                    </div>
                                    {isCorrect && (
                                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> Correct
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Answer and Explanation Box */}
                          {isExpanded && (
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2 text-xs font-black">
                                <span className="text-slate-500">Correct Answer:</span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 font-mono">
                                  Option {draft.answer || (draft.correctIndex >= 0 ? ["A", "B", "C", "D", "E"][draft.correctIndex] : "?")}
                                </span>
                              </div>

                              {draft.explanation ? (
                                <div className="bg-slate-50/90 dark:bg-slate-900/60 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 font-hindi border border-slate-200/60 dark:border-slate-800">
                                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    <span>Explanation:</span>
                                  </div>
                                  <div className="leading-relaxed font-medium">
                                    <RichText text={draft.explanation} />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                                  ⚠️ No explanation provided for this question.
                                </div>
                              )}
                            </div>
                          )}

                          {/* If Collapsed, show quick summary row */}
                          {!isExpanded && (
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  Ans: Option {draft.answer || (draft.correctIndex >= 0 ? ["A", "B", "C", "D", "E"][draft.correctIndex] : "?")}
                                </span>
                                <span>•</span>
                                <span>{draft.options.length} Options</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleExpandCard(draft.tempId)}
                                className="text-blue-600 dark:text-blue-400 font-extrabold flex items-center gap-1 cursor-pointer"
                              >
                                <span>Show Options & Details</span>
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {/* Validation Errors List */}
                          {draft.errors && draft.errors.length > 0 && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Errors to resolve ({draft.errors.length})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingDraftId(draft.tempId)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Fix Now</span>
                                </button>
                              </div>
                              <div className="space-y-1">
                                {draft.errors.map((err, eIdx) => (
                                  <div key={eIdx} className="text-xs text-rose-700 dark:text-rose-300 font-bold flex items-start gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                                    <span className="break-words">{err}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Parse error banner */}
          {parseError && (
            <div className="bg-rose-50/60 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 text-rose-700 dark:text-rose-200 p-3.5 rounded-xl text-xs flex items-start gap-2.5 font-medium shadow-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 space-y-1">
                {bulkSaveErrorCode && (
                  <span className="inline-block mr-2 font-mono uppercase text-[10px] px-2 py-0.5 rounded-md bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200 font-black">
                    ERROR: {bulkSaveErrorCode}
                  </span>
                )}
                <span className="font-semibold text-xs leading-snug">{parseError}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 bg-white dark:bg-[#111A2E] border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 pb-6 sm:pb-4">
          {importReport ? (
            <button
              type="button"
              onClick={() => {
                setImportReport(null);
                setDraftQuestions(null);
                onClose();
              }}
              className="w-full py-3.5 px-4 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs sm:text-sm font-black cursor-pointer active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Check className="w-4 h-4" />
              <span>Done & Return to Question Bank</span>
            </button>
          ) : draftQuestions ? (
            <>
              <button
                type="button"
                onClick={() => setDraftQuestions(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-black cursor-pointer active:scale-95 transition-all"
              >
                Back to Edit
              </button>

              <button
                id="btn-import-valid-questions"
                type="button"
                disabled={validCount === 0 || isBulkSaving}
                onClick={() => handleBulkSaveQuestions(selectedCount > 0 && selectedCount !== validCount)}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 min-h-[48px]"
              >
                {isBulkSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{bulkSaveProgress ? `Saving Questions (${bulkSaveProgress})...` : "Saving Questions..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0 text-emerald-200" />
                    <span>
                      {selectedCount > 0 && selectedCount !== validCount
                        ? `Bulk Save Selected (${selectedCount})`
                        : `Bulk Save All (${validCount})`}
                    </span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-black cursor-pointer active:scale-95 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <ImportTemplatesModal
        isOpen={showImportTemplates}
        onClose={() => setShowImportTemplates(false)}
      />

      {/* Original vs Recovered Comparison Modal */}
      {inspectingOriginalDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Question Comparison (Q{inspectingOriginalDraft.questionNumber})
                </h3>
                {inspectingOriginalDraft.recoveredByAI && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    ✨ AI Recovered
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectingOriginalDraft(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Raw Input */}
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Original Raw Input</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-[450px]">
                  {JSON.stringify(inspectingOriginalDraft.originalData || {}, null, 2)}
                </div>
              </div>

              {/* Right Column: Normalized Recovered Question */}
              <div className="space-y-2">
                <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Canonical Recovered Structure</span>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-2.5 max-h-[450px] overflow-y-auto">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Type:</span>
                    <span className="ml-1 text-xs font-black text-indigo-700 dark:text-indigo-300 font-mono">
                      {inspectingOriginalDraft.questionType || inspectingOriginalDraft.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Stem:</span>
                    <p className="text-xs text-slate-800 dark:text-slate-100 font-medium whitespace-pre-wrap mt-0.5">
                      {inspectingOriginalDraft.text}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Options (A-D):</span>
                    {inspectingOriginalDraft.options?.map((opt, i) => (
                      <div
                        key={i}
                        className={`text-xs p-1.5 rounded-lg border font-medium ${
                          i === inspectingOriginalDraft.correctIndex
                            ? "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 text-emerald-800 dark:text-emerald-200 font-bold"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="font-bold mr-1.5">{["A", "B", "C", "D", "E"][i]}.</span>
                        {opt}
                      </div>
                    ))}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Correct Answer:</span>
                    <span className="ml-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {inspectingOriginalDraft.answer || ["A", "B", "C", "D"][inspectingOriginalDraft.correctIndex]}
                    </span>
                  </div>
                  {inspectingOriginalDraft.explanation && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Explanation:</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">
                        {inspectingOriginalDraft.explanation}
                      </p>
                    </div>
                  )}
                  {inspectingOriginalDraft.reviewReason && (
                    <div className="p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                      ⚠️ {inspectingOriginalDraft.reviewReason}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingOriginalDraft(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom Syllabus Selection Modal (Subject/Chapter/Topic) */}
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
    </div>
  );
};

export interface SyllabusSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "subject" | "chapter" | "topic" | null;
  subjects: Subject[];
  chapters: Chapter[];
  selectedSubjectId: string;
  selectedChapterId: string;
  selectedTopicId: string;
  onSelect: (id: string) => void;
}

export const SyllabusSelectionModal: React.FC<SyllabusSelectionModalProps> = ({
  isOpen,
  onClose,
  type,
  subjects,
  chapters,
  selectedSubjectId,
  selectedChapterId,
  selectedTopicId,
  onSelect,
}) => {
  if (!type) return null;

  let title = "";
  let items: { id: string; name: string; hindiName?: string }[] = [];
  let selectedId = "";

  if (type === "subject") {
    title = "Select Subject";
    items = subjects.map(s => ({
      id: s.id,
      name: s.name,
      hindiName: s.hindiName && s.hindiName !== s.name ? s.hindiName : undefined
    }));
    if (subjects.length > 1) {
      items.unshift({ id: "all", name: "All Subjects", hindiName: undefined });
    }
    selectedId = selectedSubjectId;
  } else if (type === "chapter") {
    title = "Select Chapter";
    const targetChapters = selectedSubjectId === "all" ? chapters : chapters.filter(c => c.subjectId === selectedSubjectId);
    // Sort chapters by number
    const sortedChapters = [...targetChapters].sort((a, b) => (a.number || 0) - (b.number || 0));
    items = sortedChapters.map((c, idx) => ({
      id: c.id,
      name: c.title,
      hindiName: `${String(idx + 1).padStart(2, "0")}. ${c.title || c.hindiTitle}`
    }));
    selectedId = selectedChapterId;
  } else if (type === "topic") {
    title = "Select Topic";
    const chapter = chapters.find(c => c.id === selectedChapterId);
    const sortedTopics = [...(chapter?.topics || [])].sort((a, b) => (a.number || 0) - (b.number || 0));
    items = sortedTopics.map((t, idx) => ({
      id: t.id,
      name: t.title,
      hindiName: `${idx + 1}. ${t.title || t.hindiTitle}`
    }));
    selectedId = selectedTopicId;
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[calc(100vw-32px)] sm:max-w-md max-h-[55vh] bg-white dark:bg-[#111A2E] rounded-[12px] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {title}
              </h3>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar bg-white dark:bg-[#111A2E]">
              {items.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium italic">
                  No items available for selection.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isSelected = item.id === selectedId;
                    const displayName = item.hindiName && item.hindiName !== item.name 
                      ? `${item.hindiName} (${item.name})`
                      : (item.hindiName || item.name);
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelect(item.id);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg transition-all text-left group ${
                          isSelected 
                            ? "bg-blue-50/80 dark:bg-blue-900/20 ring-1 ring-blue-500/20" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* Radio Button */}
                        <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected 
                            ? "border-[#7045D8] dark:border-blue-500 bg-[#7045D8] dark:bg-blue-500 shadow-sm" 
                            : "border-slate-300 dark:border-slate-700 group-hover:border-slate-400"
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                        </div>

                        {/* Label */}
                        <span className={`text-[14px] sm:text-[15px] font-[500] leading-snug line-clamp-2 ${
                          isSelected 
                            ? "text-blue-700 dark:text-blue-400 font-bold" 
                            : "text-slate-700 dark:text-slate-200"
                        }`}>
                          {displayName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Inline Editor Sub-component for fixing invalid draft questions
interface InlineDraftEditorProps {
  draft: ParsedQuestionDraft;
  onSave: (updated: ParsedQuestionDraft) => void;
  onCancel: () => void;
}

const InlineDraftEditor: React.FC<InlineDraftEditorProps> = ({
  draft,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(draft.text);
  const [options, setOptions] = useState<string[]>(
    draft.options && draft.options.length > 0
      ? [...draft.options]
      : ["", "", "", ""]
  );
  const [correctIndex, setCorrectIndex] = useState(
    draft.correctIndex >= 0 ? draft.correctIndex : 0
  );
  const [explanation, setExplanation] = useState(draft.explanation || "");
  const [isFormattingDraft, setIsFormattingDraft] = useState(false);
  const [draftSuccessMsg, setDraftSuccessMsg] = useState("");

  const handleFormatDraftWithAI = async () => {
    const rawContent = [
      text,
      options.map((o, i) => `${["A", "B", "C", "D", "E"][i] || i + 1}. ${o}`).join("\n"),
      `Answer: ${["A", "B", "C", "D", "E"][correctIndex] || "A"}`,
      explanation ? `Explanation: ${explanation}` : "",
    ].filter(Boolean).join("\n");

    try {
      setIsFormattingDraft(true);
      setDraftSuccessMsg("");
      const res = await formatQuestionWithAI(rawContent);
      setText(res.text);
      setOptions(res.options);
      setCorrectIndex(res.correctIndex);
      if (res.explanation) setExplanation(res.explanation);
      setDraftSuccessMsg("✨ Reorganized with AI!");
      setTimeout(() => setDraftSuccessMsg(""), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to format with AI.");
    } finally {
      setIsFormattingDraft(false);
    }
  };

  const handleSave = () => {
    onSave({
      ...draft,
      text: draft.source === "json" ? text : formatMathAndChemistryLatex(text),
      options: draft.source === "json" ? options : options.map((opt) => formatMathAndChemistryLatex(opt)),
      correctIndex,
      explanation: draft.source === "json" ? explanation : formatMathAndChemistryLatex(explanation),
    });
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111A2E] border-2 border-blue-500 shadow-md space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
          <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Edit Draft Q{draft.questionNumber || ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFormatDraftWithAI}
            disabled={isFormattingDraft}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 hover:from-amber-600 hover:to-blue-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
            title="Auto-reorganize messy text into structured Question, Options, Answer & Explanation"
          >
            {isFormattingDraft ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            )}
            <span>{isFormattingDraft ? "Formatting..." : "Format with AI"}</span>
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {draftSuccessMsg && (
        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{draftSuccessMsg}</span>
        </div>
      )}

      <div>
        <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
          Question Text (Including Tables, Statements, or Match Lists)
        </label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`w-full p-3 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-900 border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-semibold text-slate-800 dark:text-slate-100 font-hindi transition-all ${
            validateMathSyntax(text)
              ? "border-amber-400 dark:border-amber-600/50"
              : "border-slate-200 dark:border-slate-800"
          }`}
        />
        {validateMathSyntax(text) && (
          <div className="mt-1.5 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>{validateMathSyntax(text)}</span>
          </div>
        )}
        {(draft.table || draft.tableData) && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
              Attached Table (Read-Only Preview)
            </span>
            <QuestionTable table={draft.table || draft.tableData} />
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block">
            Options (Tap circle button to mark correct answer)
          </label>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-mono">
            Selected Answer: Option {["A", "B", "C", "D", "E"][correctIndex] || "A"}
          </span>
        </div>
        {options.map((optVal, idx) => {
          const letter = ["A", "B", "C", "D", "E"][idx] || `${idx + 1}`;
          const isCorrect = correctIndex === idx;
          return (
            <div key={idx} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCorrectIndex(idx)}
                className={`w-10 h-10 rounded-xl text-xs font-mono font-black shrink-0 transition-all cursor-pointer flex items-center justify-center ${
                  isCorrect
                    ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/40"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
                title={`Set Option ${letter} as correct answer`}
              >
                {letter}
              </button>
              <input
                type="text"
                value={optVal}
                onChange={(e) => {
                  const copy = [...options];
                  copy[idx] = e.target.value;
                  setOptions(copy);
                }}
                placeholder={`Option ${letter} text...`}
                className={`flex-1 p-2.5 rounded-xl text-xs sm:text-sm font-hindi border-2 font-semibold transition-all ${
                  isCorrect
                    ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-600 font-bold text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-400/20"
                    : validateMathSyntax(optVal)
                      ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700/50 text-slate-800 dark:text-slate-200"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const copy = options.filter((_, i) => i !== idx);
                    setOptions(copy);
                    if (correctIndex >= copy.length) {
                      setCorrectIndex(Math.max(0, copy.length - 1));
                    }
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  title="Remove option"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        {options.length < 5 && (
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline py-1 flex items-center gap-1 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Option {["A", "B", "C", "D", "E"][options.length]}</span>
          </button>
        )}
      </div>

      <div>
        <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
          Explanation
        </label>
        <textarea
          rows={2}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Detailed explanation for this answer..."
          className={`w-full p-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-900 border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-semibold text-slate-800 dark:text-slate-100 font-hindi transition-all ${
            validateMathSyntax(explanation)
              ? "border-amber-400 dark:border-amber-600/50"
              : "border-slate-200 dark:border-slate-800"
          }`}
        />
        {validateMathSyntax(explanation) && (
          <div className="mt-1 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>{validateMathSyntax(explanation)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 py-3 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs sm:text-sm font-black shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          Save & Apply Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-black cursor-pointer active:scale-95 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
