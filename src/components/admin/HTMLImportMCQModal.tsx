import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SyllabusSelectionModal } from "../AddQuestionsModal";
import { Chapter, LiveTest, PYQPaper, Question, Subject, Topic, UserQuestionsStore } from "../../types";
import {
  ParsedHtmlMCQ,
  HtmlImportSummary,
  parseHtmlMCQs,
  getSampleHtmlMCQs,
} from "../../utils/htmlMcqParser";
import {
  X,
  Upload,
  FileCode,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Layers,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Copy,
  Check,
  Loader2,
  Trash2,
  Edit3,
  Radio,
  Plus,
} from "lucide-react";
import { InlineSpinner } from "../ui/LoadingScreen";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";
import { generateQuestionHash } from "../../lib/mcqImport/dedupe";
import { commitQuestions, CommitProgress } from "../../lib/mcqImport/commit";
import { detectQuestionExams } from "../../lib/mcqImport/examDetector";
import { ensureStableUniqueDocId } from "../../utils/permanentDataIntegrity";
import { fetchLiveTests, loadLocalLiveTests, saveLiveTest } from "../../utils/liveTestStorage";
import { fetchPYQPapers, loadLocalPYQPapers, savePYQPaper } from "../../utils/pyqStorage";
import { fetchExamCategories } from "../../utils/categoryStorage";
import { deduplicateQuestions } from "../../utils/questionsStorage";

export type HTMLImportDestination = "question_bank" | "live_test" | "pyq_paper";

export interface HTMLImportMCQModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects?: Subject[];
  chapters?: Chapter[];
  questionsStore?: UserQuestionsStore;
  initialSubjectId?: string;
  initialChapterId?: string;
  initialTopicId?: string;
  initialTargetType?: HTMLImportDestination;
  initialLiveTestId?: string;
  initialPaperId?: string;
  onImportQuestions: (questions: Question[], alreadyCommitted: boolean) => void | Promise<void>;
  onImportToLiveTest?: (questions: Question[], testId?: string, newTestTitle?: string) => void | Promise<void>;
  onImportToPYQPaper?: (questions: Question[], paperId?: string, newPaperTitle?: string) => void | Promise<void>;
}

export const HTMLImportMCQModal: React.FC<HTMLImportMCQModalProps> = ({
  isOpen,
  onClose,
  subjects = [],
  chapters = [],
  questionsStore,
  initialSubjectId,
  initialChapterId,
  initialTopicId,
  initialTargetType,
  initialLiveTestId,
  initialPaperId,
  onImportQuestions,
  onImportToLiveTest,
  onImportToPYQPaper,
}) => {
  // Destination: "question_bank" | "live_test" | "pyq_paper"
  const [targetDestination, setTargetDestination] = useState<HTMLImportDestination>(
    initialTargetType || "question_bank"
  );

  // Live Test Target State
  const [liveTestsList, setLiveTestsList] = useState<LiveTest[]>([]);
  const [selectedLiveTestId, setSelectedLiveTestId] = useState<string>(
    initialLiveTestId || ""
  );
  const [liveTestMode, setLiveTestMode] = useState<"existing" | "new">("existing");
  const [newLiveTestTitle, setNewLiveTestTitle] = useState<string>("");
  const [newLiveTestCategory, setNewLiveTestCategory] = useState<string>("RAS Pre");
  const [newLiveTestDuration, setNewLiveTestDuration] = useState<number>(180);
  const [newLiveTestTotalMarks, setNewLiveTestTotalMarks] = useState<number>(200);

  // PYQ Paper Target State
  const [pyqPapersList, setPyqPapersList] = useState<PYQPaper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>(
    initialPaperId || ""
  );
  const [pyqMode, setPyqMode] = useState<"existing" | "new">("existing");
  const [newPaperTitle, setNewPaperTitle] = useState<string>("");
  const [newPaperBoard, setNewPaperBoard] = useState<string>("RPSC");
  const [newPaperYear, setNewPaperYear] = useState<string>(new Date().getFullYear().toString());
  const [newPaperCategory, setNewPaperCategory] = useState<string>("General Studies");

  // Exam categories
  const [categories, setCategories] = useState<string[]>([
    "RAS Pre",
    "General Studies",
    "Rajasthan Police",
    "Patwar",
    "REET",
  ]);

  // Input method: "file" | "paste"
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");

  // Raw HTML content & File details
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Curriculum Mapping Selection
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || "");
  const [selectedChapterId, setSelectedChapterId] = useState<string>(initialChapterId || "");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId || "");

  // Parsed Questions & Summary State
  const [parsedQuestions, setParsedQuestions] = useState<ParsedHtmlMCQ[]>([]);
  const [summary, setSummary] = useState<HtmlImportSummary | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Selection & Filtering
  const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | "valid" | "duplicate" | "error">("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Confirmation & Commit States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState<CommitProgress | null>(null);
  const [commitSuccessInfo, setCommitSuccessInfo] = useState<{
    count: number;
    batchId: string;
    destinationName?: string;
  } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    text: string;
    options: string[];
    correctIndex: number;
    offsetY?: number;
    explanation: string;
  } | null>(null);

  const [isSyllabusSheetOpen, setIsSyllabusSheetOpen] = useState(false);
  const [selectingField, setSelectingField] = useState<"subject" | "chapter" | "topic" | null>(null);

  const openSelectionModal = (field: "subject" | "chapter" | "topic") => {
    setSelectingField(field);
    setIsSyllabusSheetOpen(true);
  };

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );
  
  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId),
    [chapters, selectedChapterId]
  );
  


  const handleSubjectChange = (id: string) => {
    setSelectedSubjectId(id);
    setSelectedChapterId("");
    setSelectedTopicId("");
  };

  const handleChapterChange = (id: string) => {
    setSelectedChapterId(id);
    setSelectedTopicId("");
  };

  // Copy sample HTML feedback
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);

  // Load Live Tests, PYQ Papers & Categories on open
  useEffect(() => {
    if (isOpen) {
      // 1. Live Tests
      const localLT = loadLocalLiveTests();
      setLiveTestsList(localLT);
      fetchLiveTests()
        .then((tests) => {
          if (tests && tests.length > 0) setLiveTestsList(tests);
        })
        .catch(() => {});

      // 2. PYQ Papers
      const localPYQ = loadLocalPYQPapers();
      setPyqPapersList(localPYQ);
      fetchPYQPapers()
        .then((papers) => {
          if (papers && papers.length > 0) setPyqPapersList(papers);
        })
        .catch(() => {});

      // 3. Exam Categories
      fetchExamCategories()
        .then((cats) => {
          if (cats && cats.length > 0) {
            setCategories(cats.map((c) => c.name));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Sync initial target selections
  useEffect(() => {
    if (initialTargetType) {
      setTargetDestination(initialTargetType);
    }
    if (initialLiveTestId) {
      setSelectedLiveTestId(initialLiveTestId);
    }
    if (initialPaperId) {
      setSelectedPaperId(initialPaperId);
    }
  }, [initialTargetType, initialLiveTestId, initialPaperId]);

  // Build existing question hashes for duplicate detection
  const existingHashes = useMemo(() => {
    const hashes = new Set<string>();
    const allQuestions: Question[] = [
      ...(questionsStore?.customQuestions || []),
      ...(questionsStore?.cloudCacheQuestions || []),
    ];
    chapters.forEach((ch) => {
      ch.topics?.forEach((top) => {
        top.questions?.forEach((q) => {
          if (q) allQuestions.push(q);
        });
      });
    });

    // Also include questions from Live Tests and PYQ Papers
    liveTestsList.forEach((t) => {
      t.questions?.forEach((q) => {
        if (q) allQuestions.push(q);
      });
    });
    pyqPapersList.forEach((p) => {
      p.questions?.forEach((q) => {
        if (q) allQuestions.push(q);
      });
    });

    allQuestions.forEach((q) => {
      const qText = q?.text || (q as any)?.question;
      if (q && qText) {
        const h = generateQuestionHash({
          question: qText,
          options: q.options || [],
          table: q.table,
        } as any);
        if (h) hashes.add(h);
      }
    });

    return hashes;
  }, [questionsStore, chapters, liveTestsList, pyqPapersList]);

  // Sync initial subject/chapter/topic
  useEffect(() => {
    if (initialSubjectId && !selectedSubjectId) {
      setSelectedSubjectId(initialSubjectId);
    } else if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
    if (initialChapterId && !selectedChapterId) setSelectedChapterId(initialChapterId);
    if (initialTopicId && !selectedTopicId) setSelectedTopicId(initialTopicId);
  }, [initialSubjectId, initialChapterId, initialTopicId, subjects, selectedSubjectId, selectedChapterId, selectedTopicId]);

  // Derived filtered chapters for selected subject
  const availableChapters = useMemo(() => {
    if (!selectedSubjectId) return chapters;
    return chapters.filter((c) => c.subjectId === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  // Derived filtered topics for selected chapter
  const availableTopics = useMemo(() => {
    if (!selectedChapterId) return [];
    const ch = chapters.find((c) => c.id === selectedChapterId);
    return ch?.topics || [];
  }, [chapters, selectedChapterId]);

  const selectedTopic = useMemo(
    () => availableTopics.find((t) => t.id === selectedTopicId),
    [availableTopics, selectedTopicId]
  );

  // Auto-select first chapter/topic if available
  useEffect(() => {
    if (availableChapters.length > 0 && (!selectedChapterId || !availableChapters.some(c => c.id === selectedChapterId))) {
      setSelectedChapterId(availableChapters[0].id);
    }
  }, [selectedSubjectId, availableChapters, selectedChapterId]);

  useEffect(() => {
    if (selectedChapterId && availableTopics.length > 0 && (!selectedTopicId || !availableTopics.some(t => t.id === selectedTopicId))) {
      setSelectedTopicId(availableTopics[0].id);
    }
  }, [selectedChapterId, availableTopics, selectedTopicId]);

  // Parse HTML Runner
  const handleRunParse = (contentToParse: string) => {
    if (!contentToParse || !contentToParse.trim()) {
      setParseError("Please provide HTML markup to parse.");
      setParsedQuestions([]);
      setSummary(null);
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setCommitSuccessInfo(null);
    setCommitError(null);

    try {
      const result = parseHtmlMCQs(contentToParse, {
        defaultSubjectId: selectedSubjectId,
        defaultChapterId: selectedChapterId,
        defaultTopicId: selectedTopicId,
        existingHashes,
      });

      if (result.questions.length === 0) {
        setParseError(
          "No MCQ questions were detected in this HTML document. Ensure your HTML has question containers, list items, or formatted paragraphs."
        );
        setParsedQuestions([]);
        setSummary(null);
      } else {
        setParsedQuestions(result.questions);
        setSummary(result.summary);

        // Auto-select all valid non-duplicate questions
        const validIds = new Set(
          result.questions
            .filter((q) => q.isValid && !q.isDuplicate)
            .map((q) => q.tempId)
        );
        // If all are marked duplicates or none valid, select all valid ones
        if (validIds.size === 0) {
          result.questions.filter((q) => q.isValid).forEach((q) => validIds.add(q.tempId));
        }
        setSelectedTempIds(validIds);

        // Try mapping global metadata if present
        if (result.globalMetadata.subject && !selectedSubjectId) {
          const matchSub = subjects.find(
            (s) => s.name?.toLowerCase().includes(result.globalMetadata.subject!.toLowerCase())
          );
          if (matchSub) setSelectedSubjectId(matchSub.id);
        }

        if (result.globalMetadata.paperTitle) {
          if (!newLiveTestTitle) {
            setNewLiveTestTitle(result.globalMetadata.paperTitle);
          }
          if (!newPaperTitle) {
            setNewPaperTitle(result.globalMetadata.paperTitle);
          }
        }
      }
    } catch (err: any) {
      setParseError(err.message || "An error occurred while parsing HTML content.");
    } finally {
      setIsParsing(false);
    }
  };

  // Handle File Upload
  const handleFileChange = (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".html" && ext !== ".htm" && !file.type.includes("html")) {
      setParseError("Invalid file type. Please upload a '.html' or '.htm' file.");
      return;
    }

    setUploadedFileName(file.name);
    setUploadedFileSize(file.size);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      setHtmlContent(text);
      handleRunParse(text);
    };
    reader.onerror = () => {
      setParseError("Failed to read the selected file. Please try again.");
    };
    reader.readAsText(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Load Sample HTML
  const handleLoadSample = () => {
    triggerHaptic("light");
    playClickSound();
    const sample = getSampleHtmlMCQs();
    setHtmlContent(sample);
    setUploadedFileName("sample_rajasthan_history_paper.html");
    setUploadedFileSize(sample.length);
    setIsSampleLoaded(true);
    handleRunParse(sample);
  };

  // Question Selection Toggle
  const toggleSelectQuestion = (tempId: string) => {
    triggerHaptic("light");
    setSelectedTempIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    triggerHaptic("light");
    setSelectedTempIds(new Set(parsedQuestions.map((q) => q.tempId)));
  };

  const handleDeselectAll = () => {
    triggerHaptic("light");
    setSelectedTempIds(new Set());
  };

  const handleSelectValidOnly = () => {
    triggerHaptic("light");
    setSelectedTempIds(
      new Set(parsedQuestions.filter((q) => q.isValid && !q.isDuplicate).map((q) => q.tempId))
    );
  };

  // Filtered Questions in Preview List
  const displayQuestions = useMemo(() => {
    let list = parsedQuestions;

    if (filterMode === "valid") {
      list = list.filter((q) => q.isValid && !q.isDuplicate);
    } else if (filterMode === "duplicate") {
      list = list.filter((q) => q.isDuplicate);
    } else if (filterMode === "error") {
      list = list.filter((q) => !q.isValid);
    }

    if (searchFilter.trim()) {
      const query = searchFilter.toLowerCase().trim();
      list = list.filter(
        (q) =>
          q.questionText.toLowerCase().includes(query) ||
          q.options.some((o) => o.toLowerCase().includes(query)) ||
          q.explanation?.toLowerCase().includes(query)
      );
    }

    return list;
  }, [parsedQuestions, filterMode, searchFilter]);

  // Edit Inline Question Handlers
  const handleStartEdit = (q: ParsedHtmlMCQ) => {
    setEditingQuestionId(q.tempId);
    setEditForm({
      text: q.questionText,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
    });
  };

  const handleSaveEdit = (tempId: string) => {
    if (!editForm) return;
    setParsedQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId !== tempId) return q;
        const errors: string[] = [];
        if (!editForm.text.trim()) errors.push("Question statement cannot be empty.");
        if (editForm.options.length < 2) errors.push("Must have at least 2 options.");
        return {
          ...q,
          questionText: editForm.text.trim(),
          options: editForm.options.map((o) => o.trim()),
          correctIndex: editForm.correctIndex,
          explanation: editForm.explanation.trim() || undefined,
          isValid: errors.length === 0,
          errors,
        };
      })
    );
    setEditingQuestionId(null);
    setEditForm(null);
  };

  // Final Commit Routine
  const handleProceedToImport = async () => {
    setShowConfirmModal(false);
    setIsCommitting(true);
    setCommitError(null);
    setCommitProgress({
      currentChunk: 0,
      totalChunks: 1,
      committedCount: 0,
      totalCount: selectedTempIds.size,
      progressText: `0/${selectedTempIds.size} saved`,
    });

    try {
      const selectedList = parsedQuestions.filter((q) => selectedTempIds.has(q.tempId));
      if (selectedList.length === 0) {
        throw new Error("No questions selected to import.");
      }

      const effectiveChapterId = selectedChapterId || availableChapters[0]?.id || chapters[0]?.id;
      const activeChapter = chapters.find((c) => c.id === effectiveChapterId);
      const effectiveSubjectId = selectedSubjectId || activeChapter?.subjectId || subjects[0]?.id;
      const activeSubject = subjects.find((s) => s.id === effectiveSubjectId);
      const effectiveTopicId = selectedTopicId || activeChapter?.topics?.[0]?.id || "gen";
      const activeTopic = activeChapter?.topics?.find((t) => t.id === effectiveTopicId);

      // Convert ParsedHtmlMCQs to standard Question entities
      const now = new Date().toISOString();
      const targetQuestions = selectedList.map((q) => {
        const detection = detectQuestionExams(q);
        const partialQ: Partial<Question> = {
          subjectId: effectiveSubjectId || undefined,
          chapterId: effectiveChapterId || undefined,
          topicId: effectiveTopicId,
          text: detection.cleanText || q.questionText,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          questionType: (q.questionType as any) || "standard",
          table: q.table ? {
            caption: q.table.caption,
            headers: q.table.headers || [],
            rows: q.table.rows || [],
          } : undefined,
          matchTable: q.matchTable && q.matchTable.rows ? {
            leftTitle: q.matchTable.leftTitle,
            rightTitle: q.matchTable.rightTitle,
            rows: q.matchTable.rows,
          } : undefined,
          examHistory: detection.examHistory,
          questionClassification: detection.questionClassification,
          isPYQ: detection.isPYQ,
          exam: detection.examHistory.length > 0 && detection.examHistory[0].examName ? detection.examHistory[0].examName.trim() : (q.exam && String(q.exam).trim() ? String(q.exam).trim() : undefined),
          year: detection.examHistory.length > 0 && detection.examHistory[0].year ? String(detection.examHistory[0].year).trim() : (q.year && String(q.year).trim() ? String(q.year).trim() : undefined),
          isUserAdded: true,
          importedAt: now,
          createdAt: now,
          updatedAt: now,
        };

        const docId = ensureStableUniqueDocId(partialQ, effectiveTopicId);
        return {
          ...partialQ,
          id: docId,
          text: detection.cleanText || q.questionText,
          subject: activeSubject?.name,
          chapter: activeChapter?.title,
          topic: activeTopic?.title,
        } as Question;
      });

      const batchId = `html_import_${Date.now()}`;

      if (targetDestination === "live_test") {
        let targetTestTitle = "";
        if (selectedLiveTestId === "current_form") {
          targetTestTitle = "Currently Active Live Test (Editor)";
          if (onImportToLiveTest) {
            await onImportToLiveTest(targetQuestions, "current_form");
          } else {
            await onImportQuestions(targetQuestions, true);
          }
        } else if (liveTestMode === "new") {
          targetTestTitle = newLiveTestTitle.trim() || `Live Mock Test (${new Date().toLocaleDateString()})`;
          const newTest: LiveTest = {
            id: `live_test_${Date.now()}`,
            title: targetTestTitle,
            examCategory: newLiveTestCategory,
            status: "live",
            durationMinutes: Number(newLiveTestDuration) || 180,
            totalMarks: Number(newLiveTestTotalMarks) || 200,
            marksPerQuestion: 2,
            negativeMarking: 0.66,
            questionCount: targetQuestions.length,
            instructions: "Official Exam Pattern • Negative Marking: 1/3rd • Time Limit strictly enforced",
            questions: targetQuestions,
            createdAt: now,
            updatedAt: now,
          };
          await saveLiveTest(newTest);
          if (onImportToLiveTest) {
            await onImportToLiveTest(targetQuestions, newTest.id, targetTestTitle);
          }
          await onImportQuestions(targetQuestions, false);
        } else {
          // Existing Live Test
          const existingTest =
            liveTestsList.find((t) => t.id === selectedLiveTestId) ||
            loadLocalLiveTests().find((t) => t.id === selectedLiveTestId);
          if (!existingTest) {
            throw new Error("Please select an existing Live Test or choose to create a new one.");
          }
          targetTestTitle = existingTest.title;
          const merged = deduplicateQuestions([...(existingTest.questions || []), ...targetQuestions]);
          const updatedTest: LiveTest = {
            ...existingTest,
            questions: merged,
            questionCount: merged.length,
            updatedAt: now,
          };
          await saveLiveTest(updatedTest);
          if (onImportToLiveTest) {
            await onImportToLiveTest(targetQuestions, updatedTest.id, updatedTest.title);
          }
          await onImportQuestions(targetQuestions, false);
        }

        setCommitSuccessInfo({
          count: targetQuestions.length,
          batchId,
          destinationName: `Live Test: "${targetTestTitle}"`,
        });
      } else if (targetDestination === "pyq_paper") {
        let targetPaperTitle = "";
        if (selectedPaperId === "current_form") {
          targetPaperTitle = "Currently Active PYQ Paper (Editor)";
          if (onImportToPYQPaper) {
            await onImportToPYQPaper(targetQuestions, "current_form");
          } else {
            await onImportQuestions(targetQuestions, true);
          }
        } else if (pyqMode === "new") {
          targetPaperTitle = newPaperTitle.trim() || `Previous Year Paper (${newPaperYear})`;
          const newPaper: PYQPaper = {
            id: `pyq_paper_${Date.now()}`,
            title: targetPaperTitle,
            hindiTitle: targetPaperTitle,
            description: `${targetPaperTitle} Official Previous Year Question Paper`,
            examBoard: newPaperBoard,
            paperYear: newPaperYear,
            category: newPaperCategory,
            durationMinutes: 180,
            totalMarks: 200,
            marksPerQuestion: 1.33,
            negativeMarking: 0.44,
            isPublished: true,
            questionCount: targetQuestions.length,
            questions: targetQuestions,
            createdAt: now,
            updatedAt: now,
          };
          await savePYQPaper(newPaper);
          if (onImportToPYQPaper) {
            await onImportToPYQPaper(targetQuestions, newPaper.id, targetPaperTitle);
          }
          await onImportQuestions(targetQuestions, false);
        } else {
          // Existing PYQ Paper
          const existingPaper =
            pyqPapersList.find((p) => p.id === selectedPaperId) ||
            loadLocalPYQPapers().find((p) => p.id === selectedPaperId);
          if (!existingPaper) {
            throw new Error("Please select an existing PYQ Paper or choose to create a new one.");
          }
          targetPaperTitle = existingPaper.title;
          const merged = deduplicateQuestions([...(existingPaper.questions || []), ...targetQuestions]);
          const updatedPaper: PYQPaper = {
            ...existingPaper,
            questions: merged,
            questionCount: merged.length,
            updatedAt: now,
          };
          await savePYQPaper(updatedPaper);
          if (onImportToPYQPaper) {
            await onImportToPYQPaper(targetQuestions, updatedPaper.id, updatedPaper.title);
          }
          await onImportQuestions(targetQuestions, false);
        }

        setCommitSuccessInfo({
          count: targetQuestions.length,
          batchId,
          destinationName: `PYQ Paper: "${targetPaperTitle}"`,
        });
      } else {
        // Question Bank (Default)
        const result = await commitQuestions(targetQuestions, batchId, (prog) => {
          setCommitProgress(prog);
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to commit questions to the database.");
        }

        // Update local store via App.tsx handler if new questions were committed
        if (result.committedCount > 0) {
          await onImportQuestions(targetQuestions, true);
        }

        const subjName = activeSubject?.name || "General";
        const chapName = activeChapter?.title || "General";
        setCommitSuccessInfo({
          count: result.committedCount,
          batchId: result.batchId || batchId,
          destinationName:
            result.committedCount === 0 && (result.skippedCount ?? 0) > 0
              ? `Question Bank (${subjName} > ${chapName}) — ${result.skippedCount} duplicate(s) skipped, 0 writes`
              : `Question Bank (${subjName} > ${chapName})`,
        });
      }

      triggerHaptic("success");
      playClickSound();
    } catch (err: any) {
      console.error("[HTML Import] Commit error:", err);
      setCommitError(err.message || "Failed to save questions. Please try again.");
    } finally {
      setIsCommitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0B1220] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-xs">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  HTML Import MCQ
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                  Native HTML / Web Parser
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Upload or paste HTML test papers with automatic MCQ & answer extraction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isCommitting}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close HTML Import Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Screen */}
        {commitSuccessInfo ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Import Completed Successfully!
              </h3>
              <p className="text-sm text-slate-500 max-w-md">
                Successfully saved <span className="font-bold text-emerald-600">{commitSuccessInfo.count} MCQs</span> directly to {commitSuccessInfo.destinationName || "your Question Bank"}.
              </p>
              <p className="text-xs text-slate-400 font-mono pt-1">
                Batch ID: {commitSuccessInfo.batchId}
              </p>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  setCommitSuccessInfo(null);
                  setParsedQuestions([]);
                  setSummary(null);
                  setHtmlContent("");
                  setUploadedFileName(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Import Another HTML File
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Done & Close
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            
            {/* Top Toolbar: Destination Switcher & Options */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/30 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-orange-500" />
                    Upload Target Destination
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Select where the extracted questions should be added
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSampleLoaded ? "Sample Loaded ✓" : "Load Sample HTML Paper"}</span>
                </button>
              </div>

              {/* 3 Destination Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTargetDestination("question_bank")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    targetDestination === "question_bank"
                      ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="truncate">Question Bank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetDestination("live_test")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    targetDestination === "live_test"
                      ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span className="truncate">Live Test</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetDestination("pyq_paper")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    targetDestination === "pyq_paper"
                      ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate">PYQ Test / Paper</span>
                </button>
              </div>

              {/* Destination 1: Question Bank Curriculum */}
              {targetDestination === "question_bank" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Subject */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Subject
                    </label>
                    <button
                      type="button"
                      onClick={() => openSelectionModal("subject")}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium hover:border-orange-400/50 transition-colors min-h-[38px]"
                    >
                      <span className="truncate">
                        {selectedSubject?.hindiName && selectedSubject?.hindiName !== selectedSubject?.name 
                          ? `${selectedSubject.hindiName} (${selectedSubject.name})` 
                          : (selectedSubject?.hindiName || selectedSubject?.name || "Select Subject")}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </button>
                  </div>

                  {/* Chapter */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Chapter
                    </label>
                    <button
                      type="button"
                      onClick={() => openSelectionModal("chapter")}
                      disabled={!selectedSubjectId && availableChapters.length === 0}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium hover:border-orange-400/50 transition-colors disabled:opacity-50 min-h-[38px]"
                    >
                      <span className="truncate">
                        {selectedChapter?.hindiTitle || selectedChapter?.title || "Select Chapter"}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </button>
                  </div>

                  {/* Topic */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Topic
                    </label>
                    <button
                      type="button"
                      onClick={() => openSelectionModal("topic")}
                      disabled={!selectedChapterId && availableTopics.length === 0}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium hover:border-orange-400/50 transition-colors disabled:opacity-50 min-h-[38px]"
                    >
                      <span className="truncate">
                        {selectedTopic?.hindiTitle || selectedTopic?.title || "Select Topic"}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </button>
                  </div>
                </div>
              )}

              {/* Destination 2: Live Test */}
              {targetDestination === "live_test" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="liveTestMode"
                        checked={liveTestMode === "existing"}
                        onChange={() => setLiveTestMode("existing")}
                        className="text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <span>Add to Existing Live Test</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="liveTestMode"
                        checked={liveTestMode === "new"}
                        onChange={() => setLiveTestMode("new")}
                        className="text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <span>Create New Live Test</span>
                    </label>
                  </div>

                  {liveTestMode === "existing" ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Select Target Live Test
                      </label>
                      <select
                        value={selectedLiveTestId}
                        onChange={(e) => setSelectedLiveTestId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                      >
                        {initialLiveTestId === "current_form" && (
                          <option value="current_form">
                            ⚡ Current Live Test (Being edited in form)
                          </option>
                        )}
                        <option value="">-- Choose a Live Test ({liveTestsList.length} available) --</option>
                        {liveTestsList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.examCategory || "Live"} • {t.questions?.length || 0} Questions)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          New Live Test Title *
                        </label>
                        <input
                          type="text"
                          value={newLiveTestTitle}
                          onChange={(e) => setNewLiveTestTitle(e.target.value)}
                          placeholder="e.g. RAS Pre 2026 — Special Mock Test 02"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Exam Category
                        </label>
                        <select
                          value={newLiveTestCategory}
                          onChange={(e) => setNewLiveTestCategory(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Destination 3: PYQ Paper */}
              {targetDestination === "pyq_paper" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="pyqMode"
                        checked={pyqMode === "existing"}
                        onChange={() => setPyqMode("existing")}
                        className="text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <span>Add to Existing PYQ Paper</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="pyqMode"
                        checked={pyqMode === "new"}
                        onChange={() => setPyqMode("new")}
                        className="text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <span>Create New PYQ Paper</span>
                    </label>
                  </div>

                  {pyqMode === "existing" ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Select Target PYQ Paper
                      </label>
                      <select
                        value={selectedPaperId}
                        onChange={(e) => setSelectedPaperId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                      >
                        {initialPaperId === "current_form" && (
                          <option value="current_form">
                            ⚡ Current PYQ Paper (Being edited in form)
                          </option>
                        )}
                        <option value="">-- Choose a PYQ Paper ({pyqPapersList.length} available) --</option>
                        {pyqPapersList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.examBoard || "RPSC"} • {p.paperYear || "2024"} • {p.questions?.length || 0} Questions)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          New PYQ Paper Title *
                        </label>
                        <input
                          type="text"
                          value={newPaperTitle}
                          onChange={(e) => setNewPaperTitle(e.target.value)}
                          placeholder="e.g. RPSC RAS Pre 2023 Official Paper"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Exam Board
                        </label>
                        <input
                          type="text"
                          value={newPaperBoard}
                          onChange={(e) => setNewPaperBoard(e.target.value)}
                          placeholder="RPSC"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Year
                        </label>
                        <input
                          type="text"
                          value={newPaperYear}
                          onChange={(e) => setNewPaperYear(e.target.value)}
                          placeholder="2024"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Method Selector & Container */}
            <div className="p-4 space-y-4">
              
              {/* Segmented Tab Control */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl max-w-sm">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("file");
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "file"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .html File</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("paste");
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "paste"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Paste HTML Source</span>
                </button>
              </div>

              {/* Mode A: File Upload */}
              {activeTab === "file" && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-orange-400 dark:hover:border-orange-600 bg-slate-50/40 dark:bg-slate-900/20"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".html,.htm,text/html"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>

                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {uploadedFileName ? uploadedFileName : "Click or drag & drop HTML file here"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Supports <span className="font-semibold text-slate-700 dark:text-slate-300">.html</span> and <span className="font-semibold text-slate-700 dark:text-slate-300">.htm</span> files. Scripts and unwanted styling are automatically stripped safely.
                  </p>

                  {uploadedFileSize && (
                    <span className="text-[11px] font-mono font-medium text-slate-400 mt-2 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {(uploadedFileSize / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              )}

              {/* Mode B: Paste HTML Source */}
              {activeTab === "paste" && (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      placeholder="Paste your HTML code here (e.g. <div><h3>1. Question...</h3><ul><li>Option A</li>...</ul></div>)..."
                      rows={6}
                      className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {htmlContent && (
                      <button
                        onClick={() => {
                          setHtmlContent("");
                          setParsedQuestions([]);
                          setSummary(null);
                        }}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white/80 dark:bg-slate-800/80 rounded-md cursor-pointer"
                        title="Clear"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {htmlContent.length} characters
                    </span>

                    <button
                      type="button"
                      disabled={isParsing || !htmlContent.trim()}
                      onClick={() => handleRunParse(htmlContent)}
                      className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 border border-[#C99A45]/40 disabled:opacity-50 rounded-xl shadow-[0_3px_12px_rgba(244,123,32,0.3)] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isParsing ? <InlineSpinner size="xs" /> : <FileCode className="w-3.5 h-3.5" />}
                      <span>{isParsing ? "Analyzing HTML..." : "Parse HTML Questions"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {parseError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Parsing Notice:</span> {parseError}
                  </div>
                </div>
              )}
            </div>

            {/* Parsed Preview Section */}
            {parsedQuestions.length > 0 && summary && (
              <div className="p-4 space-y-4">
                
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Detected</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{summary.totalDetected}</span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Valid Ready</span>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">{summary.validCount}</span>
                  </div>

                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block">Duplicates</span>
                    <span className="text-xl font-black text-amber-700 dark:text-amber-400">{summary.duplicateCount}</span>
                  </div>

                  <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 block">Invalid / Missing</span>
                    <span className="text-xl font-black text-rose-700 dark:text-rose-400">{summary.invalidCount}</span>
                  </div>
                </div>

                {/* Filtering & Bulk Selection Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  
                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1 text-xs">
                    {(
                      [
                        { id: "all", label: `All (${parsedQuestions.length})` },
                        { id: "valid", label: `Valid (${summary.validCount})` },
                        { id: "duplicate", label: `Duplicates (${summary.duplicateCount})` },
                        { id: "error", label: `Invalid (${summary.invalidCount})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilterMode(tab.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs ${
                          filterMode === tab.id
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Bulk Select Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <button
                      type="button"
                      onClick={handleSelectValidOnly}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Select Valid Only
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                {/* Search in preview */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search within parsed questions..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Questions Preview List */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {displayQuestions.map((q) => {
                    const isSelected = selectedTempIds.has(q.tempId);
                    const isEditing = editingQuestionId === q.tempId;

                    return (
                      <div
                        key={q.tempId}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-white dark:bg-slate-800/80 border-orange-500/50 shadow-xs ring-1 ring-orange-500/20"
                            : "bg-slate-50/60 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {isEditing && editForm ? (
                          /* Inline Edit View */
                          <div className="space-y-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                                Question Text
                              </label>
                              <textarea
                                value={editForm.text}
                                onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                                rows={2}
                                className="w-full p-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500 block">
                                Options & Correct Answer
                              </label>
                              {editForm.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`edit_correct_${q.tempId}`}
                                    checked={editForm.correctIndex === oIdx}
                                    onChange={() => setEditForm({ ...editForm, correctIndex: oIdx })}
                                    className="text-orange-600 focus:ring-orange-500"
                                  />
                                  <span className="text-xs font-bold text-slate-400 w-4">
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const next = [...editForm.options];
                                      next[oIdx] = e.target.value;
                                      setEditForm({ ...editForm, options: next });
                                    }}
                                    className="flex-1 p-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                                  />
                                </div>
                              ))}
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                                Explanation
                              </label>
                              <textarea
                                value={editForm.explanation}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, explanation: e.target.value })
                                }
                                rows={2}
                                className="w-full p-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQuestionId(null);
                                  setEditForm(null);
                                }}
                                className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(q.tempId)}
                                className="px-3 py-1 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Standard Preview Card */
                          <div>
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => toggleSelectQuestion(q.tempId)}
                                className="mt-0.5 text-slate-400 hover:text-orange-600 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-orange-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400">
                                      #{q.questionNumber}
                                    </span>
                                    {q.isDuplicate && (
                                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                        Duplicate
                                      </span>
                                    )}
                                    {!q.isValid && (
                                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                                        Invalid
                                      </span>
                                    )}
                                    <span className="text-[10px] font-medium text-slate-400 uppercase">
                                      {q.questionType}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(q)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                                    title="Edit Question"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                                  {q.questionText}
                                </p>

                                {/* Options grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                  {q.options.map((opt, oIdx) => {
                                    const isCorrect = q.correctIndex === oIdx;
                                    return (
                                      <div
                                        key={oIdx}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 ${
                                          isCorrect
                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60"
                                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                                        }`}
                                      >
                                        <span className="w-4 text-[10px] font-bold shrink-0">
                                          ({String.fromCharCode(65 + oIdx)})
                                        </span>
                                        <span className="truncate">{opt}</span>
                                        {isCorrect && (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-auto" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Explanation */}
                                {q.explanation && (
                                  <div className="text-[11px] text-slate-500 bg-slate-100/70 dark:bg-slate-800/50 p-2 rounded-lg">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      Explanation:
                                    </span>{" "}
                                    {q.explanation}
                                  </div>
                                )}

                                {/* Errors & Warnings list */}
                                {q.errors.length > 0 && (
                                  <div className="text-[11px] text-rose-600 space-y-0.5">
                                    {q.errors.map((err, eIdx) => (
                                      <div key={eIdx}>• {err}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer with Selection Summary & Commit Action */}
        {!commitSuccessInfo && (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-white">
                {selectedTempIds.size}
              </span>{" "}
              of {parsedQuestions.length} questions selected for import.
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isCommitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={selectedTempIds.size === 0 || isCommitting}
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 border border-[#C99A45]/40 disabled:opacity-50 rounded-xl shadow-[0_3px_12px_rgba(244,123,32,0.3)] flex items-center gap-2 transition-all cursor-pointer"
              >
                {isCommitting ? (
                  <>
                    <InlineSpinner size="xs" />
                    <span>Saving to database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Import {selectedTempIds.size} Question{selectedTempIds.size === 1 ? "" : "s"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Explicit Confirmation Dialog */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <FileCode className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm HTML MCQ Import
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are about to import <span className="font-bold text-orange-600">{selectedTempIds.size} questions</span>.
                </p>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 text-slate-600 dark:text-slate-300 mt-2">
                  {targetDestination === "live_test" ? (
                    <>
                      <div>
                        <strong>Target:</strong> Live Test & Mocks
                      </div>
                      <div>
                        <strong>Test:</strong>{" "}
                        {selectedLiveTestId === "current_form"
                          ? "Currently Active Live Test (Editor)"
                          : liveTestMode === "new"
                          ? newLiveTestTitle || "New Live Test"
                          : liveTestsList.find((t) => t.id === selectedLiveTestId)?.title || "Selected Live Test"}
                      </div>
                    </>
                  ) : targetDestination === "pyq_paper" ? (
                    <>
                      <div>
                        <strong>Target:</strong> PYQ Vault Paper
                      </div>
                      <div>
                        <strong>Paper:</strong>{" "}
                        {selectedPaperId === "current_form"
                          ? "Currently Active PYQ Paper (Editor)"
                          : pyqMode === "new"
                          ? newPaperTitle || "New PYQ Paper"
                          : pyqPapersList.find((p) => p.id === selectedPaperId)?.title || "Selected PYQ Paper"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>Target:</strong> Question Bank
                      </div>
                      <div>
                        <strong>Subject:</strong> {subjects.find((s) => s.id === selectedSubjectId)?.name || "General"}
                      </div>
                      <div>
                        <strong>Chapter:</strong> {chapters.find((c) => c.id === selectedChapterId)?.title || "General"}
                      </div>
                      <div>
                        <strong>Topic:</strong> {availableTopics.find((t) => t.id === selectedTopicId)?.title || "General"}
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Existing questions will never be overwritten. Immutable document IDs will be generated securely.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedToImport}
                  className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs"
                >
                  Yes, Import Now
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <SyllabusSelectionModal
        isOpen={isSyllabusSheetOpen}
        onClose={() => setIsSyllabusSheetOpen(false)}
        type={selectingField}
        subjects={subjects}
        chapters={chapters}
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

export default HTMLImportMCQModal;
