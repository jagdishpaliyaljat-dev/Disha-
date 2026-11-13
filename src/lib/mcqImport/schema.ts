export type MCQType =
  | "single_correct"
  | "direct"
  | "standard"
  | "statement_based"
  | "statement"
  | "multiple_statements"
  | "assertion_reason"
  | "match_list"
  | "match_following"
  | "match_column"
  | "math"
  | "geometry"
  | "diagram_based"
  | "figure_based"
  | "image_based"
  | "graph_based"
  | "numerical"
  | "sequence"
  | "case_based"
  | "passage"
  | "table_based"
  | "true_false"
  | "unsupported";

export type ImportErrorCategory =
  | "Critical Error"
  | "Missing Field"
  | "Invalid Answer"
  | "Invalid Option Mapping"
  | "Unsupported Question Type"
  | "Table Parsing Error"
  | "Matching Mapping Error"
  | "OCR Uncertainty"
  | "Possible Duplicate"
  | "Review Required";

export type ImportReviewCategory =
  | "ready"
  | "needs_review"
  | "invalid"
  | "unsupported"
  | "duplicate";

export interface MCQMatchTableRow {
  left: string;
  right: string;
}

export interface MCQMatchTable {
  leftTitle?: string;
  rightTitle?: string;
  rows: MCQMatchTableRow[];
}

export type QuestionClassification = "pyq" | "practice" | "pyq_practice";

export interface ExamHistoryEntry {
  examName: string;
  year?: number | string;
  verified?: boolean;
  shift?: string;
  source?: string;
}

export interface MCQImportQuestion {
  type?: string;
  questionType?: string;
  question: string;
  text?: string;
  options: string[];
  answer: string;
  correctIndex?: number;
  explanation?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  year?: string | number;
  exam?: string;
  examName?: string;
  isPYQ?: boolean;
  questionClassification?: QuestionClassification;
  examHistory?: ExamHistoryEntry[];
  instruction?: string;
  statements?: string[];
  assertion?: string;
  reason?: string;
  image?: {
    type: "png" | "svg" | string;
    src?: string;
    dataUrl?: string;
    svg?: string;
    alt?: string;
    description?: string;
    fileName?: string;
  };
  imageUrl?: string;
  svgContent?: string;
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
  matchTable?: MCQMatchTable;
  unsupportedReason?: string;
  ocrUncertainties?: string[];
  ambiguousAnswerWarning?: string;
  tableErrorWarning?: string;
  matchingErrorWarning?: string;
  rawInput?: any;
}

export interface MCQImportSchema {
  schemaVersion?: number;
  testId?: string;
  title?: string;
  description?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  exam?: string;
  year?: string | number;
  examHistory?: ExamHistoryEntry[];
  questions: MCQImportQuestion[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidatedQuestionResult extends MCQImportQuestion {
  tempId: string;
  questionNumber: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  errorCategories?: ImportErrorCategory[];
  reviewCategory?: ImportReviewCategory;
  hash: string;
  isDuplicate?: boolean;
  duplicateOf?: "database" | "batch";
  correctIndex: number; // 0, 1, 2, 3... or -1 if missing/invalid
  recoveredByAI?: boolean;
  originalQuestion?: any;
  needsReview?: boolean;
  reviewReason?: string;
  debugKeys?: {
    raw: string;
    norm: string;
    valid: string;
  };
  examHistory?: ExamHistoryEntry[];
  questionClassification?: QuestionClassification;
  isPYQ?: boolean;
}


