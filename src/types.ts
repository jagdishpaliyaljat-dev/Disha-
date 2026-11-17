export interface Question {
  id: string;
  topicId: string;
  chapterId: string;
  sectionId?: string; // Mapped to Chapter / Section
  subjectId?: string; // Always Economics
  text: string; // Question text (Hindi or English)
  options: string[];
  correctIndex: number; // 0, 1, 2, 3
  explanation: string;
  importantFact?: string;
  difficulty?: "easy" | "medium" | "hard";
  createdAt?: string;
  updatedAt?: string;
  isUserAdded?: boolean;
  importBatchId?: string;
  importedAt?: string;
  
  // Concept & Semantic Analysis Fields
  conceptId?: string;
  conceptName?: string;
  relatedConcepts?: string[];
  importantEntities?: string[];
  questionType?: 
    | "factual" | "conceptual" | "analytical" | "data_trend" | "statement_based" 
    | "statement" | "multiple_statements" | "assertion_reason" | "match_following" | "match_column" 
    | "sequence" | "case_based" | "passage" | "standard" | "numerical" | "table_based"
    | "true_false" | "boolean" | "pair_based" | "odd_one_out" | "fill_blank" | "application" 
    | "image_based" | "mixed" | string;
  semanticEmbedding?: number[]; // Vector embedding or hash
  confidenceScore?: number; // 0 to 1
  analysisStatus?: "pending" | "analyzed" | "needs_review" | "reviewed";
  
  // Structured Content (Optional)
  matchData?: {
    listI: string[];
    listII: string[];
  };
  matchTable?: {
    leftTitle?: string;
    rightTitle?: string;
    rows: { left: string; right: string }[];
  };
  statements?: (string | { number?: number; text: string })[];
  instruction?: string;
  assertion?: string;
  reason?: string;
  passage?: string;
  caseContent?: string;
  table?: {
    caption?: string;
    headers: string[];
    rows: (string[] | { cells: string[] })[];
  };
  tableData?: {
    caption?: string;
    headers: string[];
    rows: (string[] | { cells: string[] })[];
  };
  imageUrl?: string;
  image?: any;
  diagram?: any;
  sequenceItems?: (string | { number?: number; text: string })[];
  pairData?: { left: string; right: string }[];
  isNegative?: boolean;
  rawFallback?: string;
  rawInput?: string;
  subject?: string;
  chapter?: string;
  section?: string;
  topic?: string;
  year?: string | number;
  exam?: string;
  examName?: string;
  examYear?: string | number;
  isPYQ?: boolean;
  questionClassification?: QuestionClassification;
  examHistory?: ExamHistoryEntry[];
}

export type QuestionClassification = "pyq" | "practice" | "pyq_practice";

export interface ExamHistoryEntry {
  examName: string;
  year?: number | string;
  verified?: boolean;
  shift?: string;
  source?: string;
}

export interface Subject {
  id: string;
  name: string;
  hindiName: string;
  slug?: string;
  icon?: string;
  color?: string; // "blue" | "emerald" | "amber" | "purple" | "rose" | "indigo" | "cyan"
  description?: string;
  order?: number;
  questionCount?: number;
  seoTitle?: string;
  seoDescription?: string;
  isUserAdded?: boolean;
}

export interface Topic {
  id: string;
  chapterId: string;
  subjectId?: string;
  title: string;
  hindiTitle: string;
  number?: number;
  slug?: string;
  questions: Question[];
  questionCount?: number;
  seoTitle?: string;
  seoDescription?: string;
  introText?: string;
  isUserAdded?: boolean;
}

export interface Chapter {
  id: string;
  subjectId?: string;
  number: number;
  title: string;
  hindiTitle: string;
  topics: Topic[];
  questionCount?: number;
  isPublished?: boolean;
  isUserAdded?: boolean;
}

export interface QuestionProgress {
  status: "unattempted" | "correct" | "wrong";
  stage: number; // 0–4
  nextReviewAt: string; // YYYY-MM-DD
  wrongCount: number;
  bookmarked: boolean;
  lastAnsweredAt: string | null;
  lastSelectedOption?: number;
  timesAttempted?: number;
  updatedAt?: string;
}

export type ProgressStore = Record<string, QuestionProgress>;

// ──────────────────────────────────────────
// CUSTOM SMART TEST & PERFORMANCE TYPES
// ──────────────────────────────────────────

export type PriorityLevel = "high" | "medium" | "attention" | "low" | "new";
export type SpecialPerformanceTag = "fast_wrong" | "slow_recall" | "strong" | null;

export interface RecentAttemptSummary {
  timeTakenSeconds: number;
  isCorrect: boolean;
  attemptedAt: string; // ISO string
  selectedOption?: string; // "A" | "B" | "C" | "D"
  correctOption?: string;
}

export interface QuestionPerformance {
  questionId: string;
  userId?: string;
  subjectId?: string;
  chapterId: string;
  topicId: string;

  attemptCount: number;
  correctCount: number;
  wrongCount: number;

  totalTimeSeconds: number;
  averageTimeSeconds: number;

  lastTimeTakenSeconds: number;
  fastestTimeSeconds: number;
  slowestTimeSeconds: number;

  lastResult: "correct" | "wrong";
  lastAttemptAt: string; // ISO string

  recentAttempts: RecentAttemptSummary[]; // Max 10 recent attempts

  accuracy: number; // 0–100%
  smartPriorityScore: number; // 0–100
  priorityLevel: PriorityLevel;
  specialTag?: SpecialPerformanceTag;

  updatedAt: string;
}

export type PerformanceStore = Record<string, QuestionPerformance>;

export interface QuestionAttemptRecord {
  attemptId: string;
  userId?: string;
  questionId: string;
  testId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  timeTakenSeconds: number;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  attemptNumber: number;
  attemptedAt: string;
}

export interface SmartTestRecord {
  testId: string;
  userId?: string;
  type: "custom_smart" | "all-chapters" | "chapter" | "topic";
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  questionCount: number;
  smartPriorityEnabled: boolean;
  createdAt: string;
  status: "completed" | "in_progress";
  score: number;
  accuracy: number;
  averageTimeSeconds: number;
  // Optional runtime fields used by the MCQ session result writer.
  title?: string;
  testType?: string;
  totalQuestions?: number;
  attemptedQuestions?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  skippedQuestions?: number;
  timeSpentSeconds?: number;
  completedAt?: string;
  maxScore?: number;
  answers?: Record<string, any>;
  insights?: {
    needPracticeCount: number;
    slowRecallCount: number;
    performingWellCount: number;
    priorityQuestionIds: string[];
  };
}

export interface SmartTestConfig {
  subjectId?: string;
  chapterId?: string | "all";
  topicId?: string | "all";
  questionCount: number | "custom";
  customCount?: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  questionSource: "new" | "attempted" | "both";
  smartPriorityEnabled: boolean;
}

export interface AppSettings {
  darkMode: boolean;
  textSize: "S" | "M" | "L";
  shuffleQuestions?: boolean;
  lastTopicId: string | null;
  todayDate: string;
  todayAnsweredCount: number;
  studyTimeMinutes?: number;
  dailyGoal?: number;
  soundEffects?: boolean;
  hapticFeedback?: boolean;
  instantExplanation?: boolean;
  geminiApiKey?: string;
  useCustomApiKey?: boolean;
  aiMode?: "platform_default" | "personal_keys";
  personalAiKeys?: UserPersonalAIKey[];
  activePersonalKeyId?: string;
}

export interface UserPersonalAIKey {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  model: string;
  enabled: boolean;
  createdAt: string;
  lastTestedAt?: string;
  latencyMs?: number;
}

export type ActiveTab = "home" | "topics" | "analytics" | "wrong" | "profile" | "admin" | "notifications" | "analyzer" | "pyq_vault" | "live_tests" | "test_series" | "news" | "admin_news" | "about" | "privacy-policy" | "terms-of-service" | "contact" | "disclaimer" | "not_found";

export interface FAQItem {
  question: string;
  answer: string;
}

export type ArticleBlockType =
  | "heading"
  | "paragraph"
  | "intro"
  | "conclusion"
  | "list"
  | "image"
  | "table"
  | "quote"
  | "callout"
  | "key_points"
  | "faq"
  | "cta"
  | "embed"
  | "related_quiz"
  | "diagram"
  | "divider"
  | "pdf_download"
  | "book_course";

export interface ArticleBlock {
  id: string;
  type: ArticleBlockType;
  level?: 1 | 2 | 3 | 4; // for heading (H1, H2, H3, H4)
  text?: string; // for heading, paragraph, quote, callout, cta
  calloutType?: "info" | "warning" | "tip" | "important";
  listType?: "bullet" | "numbered";
  listItems?: string[];
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  tableHeaders?: string[];
  tableRows?: { cells: string[] }[];
  tableAlignments?: ("left" | "center" | "right")[];
  tableCaption?: string;
  faqs?: FAQItem[];
  ctaText?: string;
  ctaUrl?: string;
  embedType?: "youtube" | "telegram";
  embedUrl?: string;
  relatedQuizTopicId?: string;
  relatedQuizTopicTitle?: string;
  relatedQuizSubjectId?: string;
  diagramType?: "active_recall" | "spaced_repetition" | "pomodoro" | "study_zone" | "mind_map";
  diagramData?: any;

  // PDF Download / Document fields
  pdfTitle?: string;
  pdfUrl?: string;
  pdfFileSize?: string;
  pdfDescription?: string;
  pdfButtonText?: string;
  pdfBadge?: string;

  // Book & Course Recommendation fields
  itemType?: "book" | "course" | "test_series" | "notes";
  itemTitle?: string;
  itemSubtitle?: string;
  itemUrl?: string;
  itemImageUrl?: string;
  itemPrice?: string;
  itemOriginalPrice?: string;
  itemBadge?: string;
  itemAuthor?: string;
  itemFeatures?: string[];
  itemButtonText?: string;
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  hindiTitle?: string;
  excerpt: string;
  content: string; // Markdown or fallback plain text
  blocks?: ArticleBlock[]; // Rich Block-Based Article Content
  category: "Exam Notification" | "Current Affairs" | "Study Strategy" | "Economics & Survey" | "General" | string;
  tags?: string[];
  language?: "Hindi" | "English" | "Both";
  coverImageUrl?: string;
  authorName: string;
  authorBio?: string;
  authorPhotoUrl?: string;
  status: "published" | "draft" | "scheduled";
  scheduledFor?: string; // ISO date/time for scheduled publish
  isFeatured?: boolean;
  isPinned?: boolean;
  pinnedAt?: string;
  styleVariant?: "default" | "exam_alert" | "result_key";
  layoutConfig?: {
    showTableOfContents?: boolean;
    showAuthorBox?: boolean;
    showRelatedArticles?: boolean;
    showShareButtons?: boolean;
  };
  focusKeyword?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  views?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  faqs?: FAQItem[];
  ogTitle?: string;
  ogDescription?: string;
  featuredImageAlt?: string;
  storageVersion?: number; // 1 = legacy (all-in-one), 2 = chunked (blocks in subcollection)
  blockCount?: number;
}

export interface ExamCategory {
  id: string;
  name: string;
  hindiName?: string;
  order?: number;
  createdAt: string;
}

export interface LiveTest {
  id: string;
  title: string;
  hindiTitle?: string;
  examCategory: "RAS Pre" | "RPSC EO/RO" | "RSMSSB CET" | "RPSC Assistant Professor" | "SI Exam" | string;
  status: "live" | "upcoming" | "ended" | "draft";
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  totalMarks: number;
  marksPerQuestion: number;
  negativeMarking: number;
  questionCount: number;
  questions: Question[];
  instructions?: string;
  createdAt: string;
  updatedAt?: string;
  participantCount?: number;
}

export interface LiveTestSubmission {
  submissionId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  testId: string;
  testTitle: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  unattemptedECount?: number;
  completelyBlankCount?: number;
  blankPenalty?: number;
  isRpscDisqualified?: boolean;
  accuracy: number;
  timeSpentSeconds: number;
  submittedAt: string;
  rank?: number;
}

export interface PYQPaper {
  id: string;
  title: string;
  hindiTitle: string;
  examBoard: "RPSC" | "RSMSSB" | "UPSC" | "State Board" | string;
  paperYear: string;
  examDate?: string;
  category: string;
  description: string;
  hindiDescription?: string;
  durationMinutes: number;
  totalMarks: number;
  marksPerQuestion: number;
  negativeMarking: number; // e.g. 0.33, 0.25, 0
  questionCount: number;
  questions: Question[];
  pdfUrl?: string;
  officialKeyReleased?: boolean;
  isPublished?: boolean;
  createdAt: string;
  updatedAt?: string;
  attemptStats?: {
    totalAttempts: number;
    averageScore: number;
    highestScore: number;
  };
}

export interface PYQPaperAttempt {
  attemptId: string;
  userId?: string;
  paperId: string;
  paperTitle: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  accuracy: number;
  timeSpentSeconds: number;
  attemptedAt: string;
  selectedAnswers?: Record<string, number>; // questionId -> optionIndex
}

export interface AppNotification {
  id: string;
  title: string;
  hindiTitle?: string;
  message: string;
  hindiMessage?: string;
  category: "study" | "exam" | "achievement" | "system";
  timestamp: string; // ISO string
  read: boolean;
  priority?: "high" | "normal" | "low";
  actionType?: "open_session" | "open_tab" | "open_full_exam" | "open_link" | "none";
  actionData?: {
    tab?: ActiveTab;
    source?: MCQSession["source"];
    sessionTitle?: string;
    url?: string;
  };
}

export interface MCQSession {
  title: string;
  subtitle?: string;
  questionIds: string[];
  source:
    | "topic"
    | "chapter"
    | "all-chapters"
    | "wrong-chapter"
    | "all-wrong"
    | "due-today"
    | "quick"
    | "resume"
    | "custom-smart"
    | "smart-priority"
    | "full-exam";
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  shuffleQuestions?: boolean;
  isTestMode?: boolean;
  isSmartTest?: boolean;
  isExamSimulation?: boolean;
  timeLimitMinutes?: number;
  negativeMarking?: number;
  marksPerQuestion?: number;
  smartPriorityEnabled?: boolean;
  testId?: string;
  extraQuestions?: Question[];
  testType?: "live" | "pyq" | "subject" | "topic" | "custom_smart";
  isLiveTest?: boolean;
  isPYQ?: boolean;
  isAdminPreview?: boolean;
  liveTestDetails?: LiveTest;
  pyqDetails?: PYQPaper;
}

export interface FullExamPreset {
  id: string;
  title: string;
  hindiTitle: string;
  description: string;
  questionCount: number;
  durationMinutes: number;
  negativeMarking: number; // e.g. 0.33, 0.25, 0
  marksPerQuestion: number;
  badge: string;
}

export type ViewState =
  | { type: "tab" }
  | { type: "chapter"; chapterId: string }
  | { type: "chapter-wrong-list"; chapterId: string }
  | { type: "mcq"; session: MCQSession };

export interface ParsedQuestionDraft {
  tempId: string;
  id?: string;
  chapterId: string;
  topicId: string;
  text: string;
  question?: string; // alias for text
  type?: "direct" | "statement" | "assertion-reason" | "match-following" | "sequence" | "table_data" | "unclassified" | string;
  isNegative?: boolean;
  options: string[];
  parsedOptions?: { label: string; text: string }[];
  correctIndex: number; // -1 if missing/invalid
  answer?: string; // resolved option label, e.g. "B"
  rawAnswerStr?: string;
  explanation: string;
  importantFact?: string;
  difficulty: "easy" | "medium" | "hard";
  createdAt: string;
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  hash?: string;
  isDuplicate?: boolean;
  questionNumber?: number;
  questionType?: string;
  needsReview?: boolean;
  reviewReason?: string;
  recoveredByAI?: boolean;
  originalData?: any;
  rawFallback?: string;
  rawInput?: string;
  table?: {
    caption?: string;
    headers: string[];
    rows: (string[] | { cells: string[] })[];
  };
  tableData?: {
    caption?: string;
    headers: string[];
    rows: (string[] | { cells: string[] })[];
  };
  debugKeys?: {
    raw: string;
    norm: string;
    valid: string;
  };
  matchData?: {
    listI: string[];
    listII: string[];
  };
  matchTable?: {
    leftTitle?: string;
    rightTitle?: string;
    rows: { left: string; right: string }[];
  };
  list1?: string[];
  list2?: string[];
  statements?: (string | { number?: number; text: string })[];
  instruction?: string;
  assertion?: string;
  reason?: string;
  passage?: string;
  caseContent?: string;
  sequenceItems?: (string | { number?: number; text: string })[];
  subject?: string;
  chapter?: string;
  topic?: string;
  year?: string | number;
  exam?: string;
  examHistory?: ExamHistoryEntry[];
  questionClassification?: QuestionClassification;
  isPYQ?: boolean;
  image?: any;
  imageUrl?: string;
  source?: "json" | "paste" | "csv" | "manual";
  unsupportedReason?: string;
  ocrUncertainties?: string[];
  ambiguousAnswerWarning?: string;
  tableErrorWarning?: string;
  matchingErrorWarning?: string;
}

export interface UserQuestionsStore {
  customSubjects?: Subject[];
  editedSubjects?: Record<string, Subject>;
  deletedSubjectIds?: string[];
  customQuestions: Question[];
  editedQuestions: Record<string, Question>;
  deletedQuestionIds: string[];
  customChapters?: Chapter[];
  editedChapters?: Record<string, Chapter>;
  deletedChapterIds?: string[];
  customTopics?: Topic[];
  editedTopics?: Record<string, Topic>;
  deletedTopicIds?: string[];
  cloudCacheQuestions?: Question[];
  syncedTopicIds?: string[];
  syncedTopicVersions?: Record<string, number>;
}

export interface DailyStudyRecord {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Mon"
  fullDateLabel: string; // e.g. "Sep 18"
  correct: number;
  wrong: number;
  total: number;
  accuracy: number; // 0-100
}

export type DailyStudyHistory = Record<string, { correct: number; wrong: number }>;

export interface AppBanner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  color: string; // Gradient color string like "from-blue-600 to-indigo-700"
  iconName: string; // Lucide icon name string
  actionLabel: string;
  actionTab?: ActiveTab | string;
  imageUrl?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  avatar?: string;
  role: "admin" | "student" | "user";
  blocked?: boolean;
  status?: "active" | "inactive" | "blocked";
  targetExam?: string;
  dailyGoalQuestions?: number;
  streakDays?: number;
  loginCount?: number;
  createdAt: string;
  lastLoginAt?: string;
  isTest?: boolean;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: "activate_account" | "deactivate_account" | "block_user" | "unblock_user" | "delete_user" | "update_role" | "bulk_import" | "delete_subject" | "update_banner";
  targetUserId: string;
  targetUserEmail?: string;
  targetUserName?: string;
  reason?: string;
  timestamp: string;
  details?: Record<string, any>;
}

// ──────────────────────────────────────────
// AI EXAM PAPER SCANNER & MATCHER TYPES
// ──────────────────────────────────────────

export type ExamMatchCategory =
  | "exact"
  | "near_exact"
  | "similar"
  | "concept_related"
  | "unmatched";

export interface ExtractedQuestionDraft {
  tempId: string;
  originalQuestionNumber: string | number;
  sourcePageNumber: number;
  originalText: string;
  extractedOptions: string[];
  ocrConfidence?: number;
  ocrStatus: "high" | "low" | "edited";
  questionType?: string;
  isFlaggedForReview?: boolean;
}

export interface ExamQuestionMatch {
  examQuestionId: string;
  originalQuestionNumber: string | number;
  sourcePageNumber: number;
  originalText: string;
  normalizedText: string;
  extractedOptions: string[];
  ocrStatus: "high" | "low" | "edited";
  reviewStatus: "pending" | "confirmed" | "rejected" | "manually_matched";
  primaryMatchCategory: ExamMatchCategory;
  bestMatchQuestionId?: string;
  bestMatchQuestion?: {
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
    conceptName?: string;
    difficulty?: string;
  };
  alternativeMatches?: {
    questionId: string;
    category: ExamMatchCategory;
    score: number;
    explanation: string;
    questionText: string;
  }[];
  matchScore: number; // 0 to 100
  matchExplanation: string;
  meaningfulDifferences?: string[];
  processingStatus: "completed" | "needs_review" | "failed";
  userFeedback?: {
    reviewedCategory?: ExamMatchCategory;
    notes?: string;
    reviewedAt?: string;
  };
}

export interface ExamPaperAnalysis {
  analysisId: string;
  userId: string;
  examId: string;
  examName: string;
  paperYear: string;
  paperDate: string;
  paperName: string;
  shiftCode?: string;
  status: "uploaded" | "extracting" | "extracted" | "matching" | "completed" | "completed_with_warnings" | "failed";
  totalPages: number;
  detectedQuestionCount: number;
  analyzedQuestionCount: number;
  exactMatchCount: number;
  nearExactMatchCount: number;
  similarMatchCount: number;
  conceptMatchCount: number;
  unmatchedCount: number;
  needsReviewCount: number;
  createdAt: string;
  completedAt?: string;
  schemaVersion: number;
  questions: ExamQuestionMatch[];
  subjectBreakdown?: Record<string, { total: number; exact: number; nearExact: number; similar: number; concept: number; unmatched: number; name: string }>;
  chapterBreakdown?: Record<string, { total: number; exact: number; nearExact: number; similar: number; concept: number; unmatched: number; name: string }>;
}

export interface Attempt {
  attemptId: string;
  id?: string;
  userId: string;
  testId: string;
  type: "live_test" | "pyq_paper" | "smart_test";
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  timeSpentSeconds: number;
  attemptedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaderboardEntry {
  id?: string;
  userId: string;
  userName: string;
  testId: string;
  score: number;
  accuracy?: number;
  timeSpentSeconds?: number;
  rank?: number;
  updatedAt: string;
}

export type AIProvider = "gemini" | "openai" | "claude" | "groq";

export type AIKeyHealthStatus = 
  | "available" 
  | "rate_limited" 
  | "quota_exhausted" 
  | "temporarily_unavailable" 
  | "auth_failed" 
  | "disabled"
  | "Active" 
  | "Exhausted" 
  | "Invalid" 
  | "Disabled";

export interface AIApiConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority?: number;
  createdAt: string;
  isSystem?: boolean;
  requestsTotal?: number;
  requestsToday?: number;
  successTotal?: number;
  errorsTotal?: number;
  lastUsedAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  status?: AIKeyHealthStatus;
  cooldownUntil?: number;
  remainingCooldownSec?: number;
  consecutiveErrors?: number;
  resetAt?: string;
  isSharedUserKey?: boolean;
}

export interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  timestamp: string;
  reason?: string;
}

// ──────────────────────────────────────────
// COACHING -> EXAM -> TEST SERIES HIERARCHY TYPES
// ──────────────────────────────────────────

export interface Coaching {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoachingExam {
  id: string;
  coachingId: string;
  examName: string;
  description?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoachingTestSeries {
  id: string;
  coachingId: string;
  examId: string;
  seriesName: string;
  description?: string;
  badge?: string;
  testIds?: string[];
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}


