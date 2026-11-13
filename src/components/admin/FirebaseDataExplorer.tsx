import * as React from "react";
import {
  Database,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Eye,
  Layers,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  ArrowLeft,
  Lock,
  Unlock,
  Info,
  X,
  FileText,
  Clock,
  Wifi,
  WifiOff,
  Server,
  BookOpen,
  Folder,
  CheckCircle2,
  ListFilter
} from "lucide-react";
import {
  collection,
  doc,
  query,
  limit,
  startAfter,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from "firebase/firestore";
import { 
  guardedGetDoc, 
  guardedGetDocs, 
  guardedGetCountFromServer 
} from "../../utils/quotaTracker";
import { db, firebaseConfig, auth } from "../../lib/firebase";
import { UserProfile } from "../../types";
import { isUserAdmin } from "../../utils/userProfileStorage";
import { AdminCard } from "./AdminCard";
import { TableSkeleton } from "./AdminSkeletonLoaders";

interface FirebaseDataExplorerProps {
  userProfile: UserProfile | null;
  onNavigateBack?: () => void;
}

interface KnownCollectionDef {
  id: string;
  name: string;
  category: "Curriculum" | "Assessments" | "System & Users" | "Content" | "User Activity";
  description: string;
}

const KNOWN_COLLECTIONS: KnownCollectionDef[] = [
  // Curriculum (v2 and Legacy)
  { id: "curriculum_subjects", name: "curriculum_subjects", category: "Curriculum", description: "Legacy curriculum subjects collection" },
  { id: "curriculum_chapters", name: "curriculum_chapters", category: "Curriculum", description: "Legacy curriculum chapters collection" },
  { id: "curriculum_questions", name: "curriculum_questions", category: "Curriculum", description: "Legacy curriculum questions collection" },
  { id: "curriculum", name: "curriculum", category: "Curriculum", description: "Legacy root curriculum collection (contains /main doc)" },
  { id: "subjects", name: "subjects", category: "Curriculum", description: "Active curriculum subjects (v2)" },
  { id: "chapters", name: "chapters", category: "Curriculum", description: "Active curriculum chapters (v2)" },
  { id: "topics", name: "topics", category: "Curriculum", description: "Active curriculum topics (v2)" },
  { id: "mcqs", name: "mcqs", category: "Curriculum", description: "Active question bank MCQs (v2)" },
  { id: "questions", name: "questions", category: "Curriculum", description: "Questions repository" },
  
  // System & Users
  { id: "users", name: "users", category: "System & Users", description: "Registered users directory and profiles" },
  { id: "metadata", name: "metadata", category: "System & Users", description: "Curriculum master metadata and system state" },
  { id: "adminAuditLogs", name: "adminAuditLogs", category: "System & Users", description: "Administrative security audit logs" },
  { id: "notifications", name: "notifications", category: "System & Users", description: "App announcements and push alerts" },
  { id: "_health", name: "_health", category: "System & Users", description: "System health check records and ping probes" },

  // Assessments
  { id: "liveTests", name: "liveTests", category: "Assessments", description: "Scheduled online live tests" },
  { id: "live_tests", name: "live_tests", category: "Assessments", description: "Alternate live tests collection" },
  { id: "liveTestSubmissions", name: "liveTestSubmissions", category: "Assessments", description: "Live test submissions by students" },
  { id: "pyq_papers", name: "pyq_papers", category: "Assessments", description: "Previous Year Question papers repository" },
  { id: "pyqPapers", name: "pyqPapers", category: "Assessments", description: "Alternate PYQ papers schema" },
  { id: "tests", name: "tests", category: "Assessments", description: "Alternate tests collection" },
  
  // Content & Activity
  { id: "examCategories", name: "examCategories", category: "Content", description: "Target exam categories" },
  { id: "exam_categories", name: "exam_categories", category: "Content", description: "Exam categories alternate collection" },
  { id: "banners", name: "banners", category: "Content", description: "Promotional and news banners" },
  { id: "attempts", name: "attempts", category: "User Activity", description: "User quiz and test attempts" },
  { id: "leaderboard", name: "leaderboard", category: "User Activity", description: "Quiz and test rankings leaderboard" },
  { id: "examPaperAnalyses", name: "examPaperAnalyses", category: "User Activity", description: "Exam paper analyzer records" }
];

interface CollectionMeta {
  id: string;
  count: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated?: string | null;
}

export const FirebaseDataExplorer: React.FC<FirebaseDataExplorerProps> = ({
  userProfile
}) => {
  // Admin Guard
  const hasAdminAccess = isUserAdmin(userProfile);

  // Status Bar State
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine);
  const [lastFetchTime, setLastFetchTime] = React.useState<Date | null>(null);

  // Collection Metadata State
  const [collectionsMeta, setCollectionsMeta] = React.useState<Record<string, CollectionMeta>>({});
  const [loadingAllCounts, setLoadingAllCounts] = React.useState(false);
  const [collectionSearch, setCollectionSearch] = React.useState("");
  const [showOnlyWithData, setShowOnlyWithData] = React.useState(false);

  // Curriculum Compatibility State
  const [curriculumV2Doc, setCurriculumV2Doc] = React.useState<any | null>(null);
  const [curriculumLegacyDoc, setCurriculumLegacyDoc] = React.useState<any | null>(null);
  const [curriculumMetaLoading, setCurriculumMetaLoading] = React.useState(false);

  // Document Viewer State
  const [selectedCollection, setSelectedCollection] = React.useState<string | null>(null);
  const [documents, setDocuments] = React.useState<Array<{ id: string; data: any }>>([]);
  const [loadingDocs, setLoadingDocs] = React.useState(false);
  const [docsError, setDocsError] = React.useState<string | null>(null);
  const [lastDocSnap, setLastDocSnap] = React.useState<QueryDocumentSnapshot | null>(null);
  const [docSnapHistory, setDocSnapHistory] = React.useState<Array<QueryDocumentSnapshot | null>>([]);
  const [pageIndex, setPageIndex] = React.useState<number>(0);
  const [docSearchQuery, setDocSearchQuery] = React.useState("");

  // Document Detail Modal State
  const [inspectDoc, setInspectDoc] = React.useState<{ path: string; id: string; data: any } | null>(null);
  const [maskSensitiveData, setMaskSensitiveData] = React.useState(true);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Listen to network status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === label ? null : prev));
    }, 2000);
  };

  // 1. Fetch counts lazily using getCountFromServer (Spark plan friendly)
  const loadCollectionCounts = React.useCallback(async () => {
    if (!hasAdminAccess) return;
    setLoadingAllCounts(true);

    const initialMeta: Record<string, CollectionMeta> = {};
    KNOWN_COLLECTIONS.forEach(c => {
      initialMeta[c.id] = { id: c.id, count: null, loading: true, error: null };
    });
    setCollectionsMeta(initialMeta);

    // Fetch counts in parallel chunks of 4 to avoid hitting any burst limits
    const collectionList = [...KNOWN_COLLECTIONS];
    const chunkSize = 4;

    for (let i = 0; i < collectionList.length; i += chunkSize) {
      const chunk = collectionList.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (c) => {
          try {
            const collRef = collection(db, c.id);
            const countSnap = await guardedGetCountFromServer(collRef, "Admin", `Explorer Count: ${c.id}`);
            const count = countSnap.data().count;

            let lastUpdated: string | null = null;
            // If collection has documents, sample 1 doc to get an update timestamp
            if (count > 0) {
              try {
                const sampleSnap = await guardedGetDocs(query(collRef, limit(1)), "Admin", `Explorer Sample: ${c.id}`);
                if (!sampleSnap.empty) {
                  const data = sampleSnap.docs[0].data();
                  const rawTime = data.updatedAt || data.lastUpdatedAt || data.timestamp || data.createdAt || data.lastSyncAt;
                  if (rawTime) {
                    if (typeof rawTime === "string") {
                      lastUpdated = new Date(rawTime).toLocaleDateString() + " " + new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else if (rawTime?.toDate) {
                      const d = rawTime.toDate();
                      lastUpdated = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                  }
                }
              } catch {
                // Ignore sample timestamp error
              }
            }

            setCollectionsMeta((prev) => ({
              ...prev,
              [c.id]: { id: c.id, count, loading: false, error: null, lastUpdated }
            }));
          } catch (err: any) {
            const isPermDenied = err?.code === "permission-denied" || err?.message?.includes("permission");
            setCollectionsMeta((prev) => ({
              ...prev,
              [c.id]: {
                id: c.id,
                count: null,
                loading: false,
                error: isPermDenied ? "Permission Denied" : (err?.message || "Error reading count")
              }
            }));
          }
        })
      );
    }

    setLastFetchTime(new Date());
    setLoadingAllCounts(false);
  }, [hasAdminAccess]);

  // 2. Inspect Curriculum Metadata Documents (Requirement 8)
  const inspectCurriculumMetadata = React.useCallback(async () => {
    if (!hasAdminAccess) return;
    setCurriculumMetaLoading(true);
    try {
      // 1. Check v2 metadata: metadata/curriculum
      try {
        const v2Snap = await guardedGetDoc(doc(db, "metadata", "curriculum"), "Admin", "Explorer Metadata V2");
        if (v2Snap.exists()) {
          setCurriculumV2Doc(v2Snap.data());
        } else {
          setCurriculumV2Doc(null);
        }
      } catch {
        setCurriculumV2Doc(null);
      }

      // 2. Check legacy metadata: curriculum/main
      try {
        const legacySnap = await guardedGetDoc(doc(db, "curriculum", "main"), "Admin", "Explorer Metadata Legacy");
        if (legacySnap.exists()) {
          setCurriculumLegacyDoc(legacySnap.data());
        } else {
          setCurriculumLegacyDoc(null);
        }
      } catch {
        setCurriculumLegacyDoc(null);
      }
    } finally {
      setCurriculumMetaLoading(false);
    }
  }, [hasAdminAccess]);

  React.useEffect(() => {
    if (hasAdminAccess) {
      loadCollectionCounts();
      inspectCurriculumMetadata();
    }
  }, [hasAdminAccess, loadCollectionCounts, inspectCurriculumMetadata]);

  // 3. Load documents for a selected collection (Cursor pagination: limit 25)
  const loadDocuments = async (
    collName: string,
    cursorDoc: QueryDocumentSnapshot | null = null,
    direction: "next" | "prev" | "initial" = "initial"
  ) => {
    setLoadingDocs(true);
    setDocsError(null);

    try {
      const collRef = collection(db, collName);
      let q = query(collRef, limit(25));
      if (cursorDoc && direction === "next") {
        q = query(collRef, startAfter(cursorDoc), limit(25));
      }

      const snap = await guardedGetDocs(q, "Admin", `Explorer Docs: ${collName}`);
      const docsList = snap.docs.map((d) => ({
        id: d.id,
        data: d.data()
      }));

      setDocuments(docsList);

      if (snap.docs.length > 0) {
        const newLast = snap.docs[snap.docs.length - 1];
        setLastDocSnap(newLast);

        if (direction === "next") {
          setDocSnapHistory((prev) => [...prev, cursorDoc]);
          setPageIndex((p) => p + 1);
        } else if (direction === "initial") {
          setDocSnapHistory([]);
          setPageIndex(0);
        }
      } else {
        setLastDocSnap(null);
      }
      setLastFetchTime(new Date());
    } catch (err: any) {
      const isPermDenied = err?.code === "permission-denied" || err?.message?.includes("permission");
      setDocsError(isPermDenied ? "Permission Denied: Missing read permissions in firestore.rules for this collection." : (err?.message || "Failed to load documents"));
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleSelectCollection = (collId: string) => {
    setSelectedCollection(collId);
    setDocSearchQuery("");
    loadDocuments(collId, null, "initial");
  };

  const handleNextPage = () => {
    if (!lastDocSnap || !selectedCollection) return;
    loadDocuments(selectedCollection, lastDocSnap, "next");
  };

  const handlePrevPage = () => {
    if (pageIndex <= 0 || !selectedCollection) return;
    const prevHistory = [...docSnapHistory];
    const prevCursor = prevHistory.pop() || null;
    setDocSnapHistory(prevHistory);
    setPageIndex((p) => Math.max(0, p - 1));
    loadDocuments(selectedCollection, prevCursor, "initial");
  };

  // Derive Overview Counts
  const overviewCounts = React.useMemo(() => {
    let collectionsCount = 0;
    let totalDocsCount = 0;

    Object.values(collectionsMeta).forEach((m) => {
      if (m.count !== null && m.count > 0) {
        collectionsCount++;
        totalDocsCount += m.count;
      }
    });

    const getCount = (collId: string) => collectionsMeta[collId]?.count || 0;

    // Requirement 3: Overview counts
    const questionsCount = (getCount("mcqs") + getCount("curriculum_questions") + getCount("questions")) || (curriculumV2Doc?.totalQuestions || 0);
    const subjectsCount = getCount("subjects") + getCount("curriculum_subjects");
    const chaptersCount = getCount("chapters") + getCount("curriculum_chapters");
    const topicsCount = getCount("topics");
    const testsCount = getCount("liveTests") + getCount("live_tests") + getCount("pyq_papers") + getCount("pyqPapers") + getCount("tests");
    const usersCount = getCount("users");

    return {
      collectionsCount,
      totalDocsCount,
      questionsCount,
      subjectsCount,
      chaptersCount,
      topicsCount,
      testsCount,
      usersCount
    };
  }, [collectionsMeta, curriculumV2Doc]);

  // Filtered collections
  const filteredCollections = React.useMemo(() => {
    return KNOWN_COLLECTIONS.filter((c) => {
      const meta = collectionsMeta[c.id];
      if (showOnlyWithData && (meta?.count === null || meta?.count === 0)) {
        return false;
      }
      if (collectionSearch.trim()) {
        const queryStr = collectionSearch.toLowerCase();
        return c.name.toLowerCase().includes(queryStr) || c.category.toLowerCase().includes(queryStr) || c.description.toLowerCase().includes(queryStr);
      }
      return true;
    });
  }, [collectionsMeta, collectionSearch, showOnlyWithData]);

  // Filtered documents within loaded page (Requirement 7)
  const filteredDocuments = React.useMemo(() => {
    if (!docSearchQuery.trim()) return documents;
    const q = docSearchQuery.toLowerCase();
    return documents.filter((docItem) => {
      if (docItem.id.toLowerCase().includes(q)) return true;
      try {
        const jsonStr = JSON.stringify(docItem.data).toLowerCase();
        return jsonStr.includes(q);
      } catch {
        return false;
      }
    });
  }, [documents, docSearchQuery]);

  // Sensitive field masker (Requirement 9)
  const maskValue = (key: string, value: any): any => {
    if (!maskSensitiveData) return value;
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("email")) {
        const parts = value.split("@");
        if (parts.length === 2) {
          const name = parts[0];
          return `${name.slice(0, 2)}***@${parts[1]}`;
        }
      }
      if (lowerKey.includes("phone") || lowerKey.includes("mobile")) {
        return `••••••••${value.slice(-3)}`;
      }
      if (lowerKey.includes("token") || lowerKey.includes("secret") || lowerKey.includes("key") || lowerKey.includes("password")) {
        return "••••••••••••••••";
      }
    }
    return value;
  };

  // Helper to extract key fields dynamically without schema assumption
  const deriveKeyFields = (data: any) => {
    if (!data || typeof data !== "object") return "Empty document";
    const candidateKeys = [
      "name", "title", "text", "subjectName", "chapterName", "email", "role",
      "examCategory", "status", "score", "totalQuestions", "version", "category", "code"
    ];

    const found: string[] = [];
    for (const key of candidateKeys) {
      if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
        const val = maskValue(key, data[key]);
        const displayVal = typeof val === "object" ? JSON.stringify(val) : String(val);
        found.push(`${key}: ${displayVal.slice(0, 35)}${displayVal.length > 35 ? "..." : ""}`);
        if (found.length >= 3) break;
      }
    }

    if (found.length === 0) {
      const keys = Object.keys(data).slice(0, 3);
      keys.forEach(k => {
        const val = maskValue(k, data[k]);
        found.push(`${k}: ${String(val).slice(0, 25)}`);
      });
    }

    return found.join(" • ") || "No key fields";
  };

  // Helper to derive updated timestamp from document
  const deriveUpdatedTime = (data: any) => {
    if (!data || typeof data !== "object") return "-";
    const rawTime = data.updatedAt || data.lastUpdatedAt || data.timestamp || data.createdAt || data.lastSyncAt;
    if (!rawTime) return "-";
    if (typeof rawTime === "string") {
      try {
        const d = new Date(rawTime);
        return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return rawTime;
      }
    }
    if (rawTime?.toDate) {
      try {
        const d = rawTime.toDate();
        return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return "-";
      }
    }
    return "-";
  };

  if (!hasAdminAccess) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-[#111A2E] rounded-3xl border border-rose-200 dark:border-rose-900/40 text-center shadow-lg">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-rose-600 dark:text-rose-400">Access Denied: Admin Privileges Required</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          The Firebase Data Explorer is strictly restricted to verified DISHA 20-20 administrators. You must be authenticated with an approved admin UID or email.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Database className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Firebase Data Explorer
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                  Read-Only
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live inspection of Firestore collections, counts, and raw documents without modifying state
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadCollectionCounts();
              inspectCurriculumMetadata();
              if (selectedCollection) {
                loadDocuments(selectedCollection, null, "initial");
              }
            }}
            disabled={loadingAllCounts}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingAllCounts ? "animate-spin" : ""}`} />
            Refresh Counts
          </button>
        </div>
      </div>

      {/* 2. Status Bar */}
      <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800/50 text-xs">
          {/* Connection */}
          <div className="flex items-center gap-4 pb-4 sm:pb-0 sm:pr-4">
            <div className={`p-3 rounded-2xl ${isOnline ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600" : "bg-rose-100 dark:bg-rose-950/60 text-rose-600"}`}>
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connection</div>
              <div className="font-black flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span className={isOnline ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}>
                  {isOnline ? "CONNECTED" : "OFFLINE"}
                </span>
              </div>
            </div>
          </div>

          {/* Project ID */}
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firebase Project</div>
            <div className="font-mono font-black text-slate-800 dark:text-slate-200 truncate mt-1 text-[13px]" title={firebaseConfig.projectId}>
              {firebaseConfig.projectId || "Not configured"}
            </div>
          </div>

          {/* Firestore Status / DB ID */}
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firestore DB</div>
            <div className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mt-1 text-[13px]">
              <Server className="w-4 h-4 text-blue-500" />
              <span className="truncate" title={firebaseConfig.firestoreDatabaseId || "(default)"}>
                {firebaseConfig.firestoreDatabaseId || "(DEFAULT)"}
              </span>
            </div>
          </div>

          {/* Last Successful Fetch */}
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Sync</div>
            <div className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 mt-1 text-[13px]">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>
                {lastFetchTime ? lastFetchTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "PENDING"}
              </span>
            </div>
          </div>

          {/* Admin Auth Status */}
          <div className="pt-4 sm:pt-0 sm:pl-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Identity</div>
            <div className="font-black text-blue-600 dark:text-blue-400 flex items-center gap-2 mt-1 truncate text-[13px]" title={auth.currentUser?.email || userProfile?.email || "Admin verified"}>
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="truncate">
                {auth.currentUser?.email || userProfile?.email || "VERIFIED"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Overview Counts */}
      <AdminCard title="Global Data Overview" subtitle="System-wide document counts across core collections" icon={Layers}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {[
            { label: "Collections", value: overviewCounts.collectionsCount, icon: Database, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40" },
            { label: "Documents", value: overviewCounts.totalDocsCount, icon: FileText, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/40" },
            { label: "Questions", value: overviewCounts.questionsCount, icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40" },
            { label: "Subjects", value: overviewCounts.subjectsCount, icon: Layers, color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/40" },
            { label: "Chapters", value: overviewCounts.chaptersCount, icon: Folder, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40" },
            { label: "Topics", value: overviewCounts.topicsCount, icon: Layers, color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/40" },
            { label: "Tests", value: overviewCounts.testsCount, icon: CheckCircle2, color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40" },
            { label: "Users", value: overviewCounts.usersCount, icon: ShieldCheck, color: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/40" },
          ].map((card) => (
            <div
              key={card.label}
              className={`p-4 rounded-[20px] border ${card.color} flex flex-col justify-between transition-all hover:scale-[1.03] shadow-xs`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  {card.label}
                </span>
                <card.icon className="w-3.5 h-3.5 opacity-60" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-black tracking-tighter">
                  {loadingAllCounts && card.value === 0 ? (
                    <span className="text-[10px] uppercase opacity-40 font-black animate-pulse">Syncing...</span>
                  ) : (
                    card.value.toLocaleString()
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* 4. Curriculum Architecture */}
      <AdminCard title="Architecture Inspector" subtitle="Manage compatibility between v2 and Legacy data schemas" icon={ShieldCheck}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Hybrid Schema Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Inspects both denormalized v2 (<code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">metadata/curriculum</code>) 
              and legacy format (<code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">curriculum/main</code>). 
              Diagnostic mode ensures all content renders correctly regardless of storage origin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {curriculumMetaLoading ? (
              <div className="flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Scanning Docs...
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (curriculumV2Doc) {
                      setInspectDoc({ path: "/metadata/curriculum", id: "curriculum", data: curriculumV2Doc });
                    }
                  }}
                  disabled={!curriculumV2Doc}
                  className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border transition-all ${
                    curriculumV2Doc
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  v2 Meta {curriculumV2Doc ? "(FOUND)" : "(MISSING)"}
                </button>

                <button
                  onClick={() => {
                    if (curriculumLegacyDoc) {
                      setInspectDoc({ path: "/curriculum/main", id: "main", data: curriculumLegacyDoc });
                    }
                  }}
                  disabled={!curriculumLegacyDoc}
                  className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border transition-all ${
                    curriculumLegacyDoc
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  Legacy Meta {curriculumLegacyDoc ? "(FOUND)" : "(MISSING)"}
                </button>
              </>
            )}
          </div>
        </div>
      </AdminCard>

      {/* 5. Main Content: Collections List OR Document Viewer */}
      {!selectedCollection ? (
        /* COLLECTION EXPLORER (Requirement 4) */
        <AdminCard 
          title="Registered Firestore Collections" 
          subtitle={`${filteredCollections.length} of ${KNOWN_COLLECTIONS.length} core schemas identified`} 
          icon={Database}
          headerAction={
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search schemas..."
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <button
                onClick={() => setShowOnlyWithData(!showOnlyWithData)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  showOnlyWithData
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                    : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                }`}
              >
                <ListFilter className="w-3 h-3" />
                {showOnlyWithData ? "Active Only" : "All Schemas"}
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* SDK Limitation Notice (Requirement 4) */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-2xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300 shadow-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="font-medium leading-relaxed">
                <strong className="font-black uppercase tracking-wider text-[10px] block mb-0.5">SDK Limitation Note</strong>
                The Firebase Client SDK cannot dynamically enumerate arbitrary root collections due to security boundaries. This explorer automatically verifies all known collections declared across the DISHA 20-20 architecture.
              </div>
            </div>

            {/* Mobile Card List for Collections (touch-friendly on small screens) */}
            <div className="block md:hidden space-y-2.5">
              {filteredCollections.map((col) => {
                const meta = collectionsMeta[col.id];
                const docCount = meta?.count;
                const isLoadingCount = meta?.loading || (meta === undefined && loadingAllCounts);

                return (
                  <div
                    key={col.id}
                    className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="p-2 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                          <Folder className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm truncate">
                            /{col.name}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate mt-0.5">
                            {col.description}
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-lg text-[8.5px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                        {col.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        {isLoadingCount ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-widest text-[9px] animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Counting...
                          </span>
                        ) : meta?.error ? (
                          <span className="text-rose-500 text-[10px] font-black uppercase tracking-tighter" title={meta.error}>
                            Access Denied
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                            (docCount || 0) > 0
                              ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          }`}>
                            {(docCount ?? 0).toLocaleString()} Docs
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleSelectCollection(col.id)}
                        className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Collections Table */}
            <div className="hidden md:block border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/30 dark:bg-black/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 font-black text-slate-500 uppercase tracking-widest text-[9px]">
                    <tr>
                      <th className="px-5 py-3">Collection Path</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Documents</th>
                      <th className="px-4 py-3">Last Change (Sample)</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredCollections.map((col) => {
                      const meta = collectionsMeta[col.id];
                      const docCount = meta?.count;
                      const isLoadingCount = meta?.loading || (meta === undefined && loadingAllCounts);

                      return (
                        <tr key={col.id} className="hover:bg-white dark:hover:bg-slate-800/60 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="p-2 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-950/60 transition-colors">
                                <Folder className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-[13px]">
                                  /{col.name}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                                  {col.description}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {col.category}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            {isLoadingCount ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-widest text-[9px] animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Counting...
                              </span>
                            ) : meta?.error ? (
                              <span className="text-rose-500 text-[10px] font-black uppercase tracking-tighter" title={meta.error}>
                                Access Denied
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                                  (docCount || 0) > 0
                                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                }`}>
                                  {(docCount ?? 0).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 text-slate-500 text-[11px]">
                            {meta?.lastUpdated ? (
                              <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-400">
                                <Clock className="w-3 h-3 opacity-50" />
                                {meta.lastUpdated}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">No timestamp</span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handleSelectCollection(col.id)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </AdminCard>
      ) : (
        /* DOCUMENT VIEWER (Requirement 5) */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCollection(null)}
                className="p-2 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs group"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Viewing Schema</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    {collectionsMeta[selectedCollection]?.count?.toLocaleString() || 0} Total Records
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="opacity-40">/</span>{selectedCollection}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  className="w-full sm:min-w-[280px] pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-blue-500 font-medium shadow-xs"
                />
              </div>
              <button
                onClick={() => loadDocuments(selectedCollection, null, "initial")}
                disabled={loadingDocs}
                className="p-3 bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDocs ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <AdminCard noPadding>
            {/* Error State with Retry */}
            {docsError && (
              <div className="m-4 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-start justify-between gap-4 text-xs text-rose-700 dark:text-rose-300">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black uppercase tracking-wider text-[10px]">Permission Denied or Connection Error</span>
                    <p className="mt-1 font-medium leading-relaxed opacity-80">{docsError}</p>
                  </div>
                </div>
                <button
                  onClick={() => loadDocuments(selectedCollection, null, "initial")}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shrink-0 shadow-sm"
                >
                  Retry Access
                </button>
              </div>
            )}

            {loadingDocs ? (
              <div className="p-4">
                <TableSkeleton rows={5} cols={4} />
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-[24px] flex items-center justify-center mx-auto text-slate-300">
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Empty Results</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {docSearchQuery
                    ? "No documents matched your active filter in this results page."
                    : "This collection currently has no documents stored in Firestore."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Document Cards (touch-friendly on small screens) */}
                <div className="block md:hidden p-3 space-y-2.5">
                  {filteredDocuments.map((docItem) => {
                    const fieldKeys = Object.keys(docItem.data || {});
                    const keyPreview = deriveKeyFields(docItem.data);
                    const updatedTime = deriveUpdatedTime(docItem.data);

                    return (
                      <div
                        key={docItem.id}
                        className="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs truncate">
                              {docItem.id}
                            </span>
                            <button
                              onClick={() => handleCopy(docItem.id, `id-${docItem.id}`)}
                              className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg active:scale-90 transition-all shrink-0 cursor-pointer"
                              title="Copy ID"
                            >
                              {copiedKey === `id-${docItem.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <span className="px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-wider bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                            {fieldKeys.length} fields
                          </span>
                        </div>

                        {keyPreview && (
                          <div className="text-slate-600 dark:text-slate-400 text-xs font-medium line-clamp-2 bg-white dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                            {keyPreview}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-400 font-bold truncate">
                            {updatedTime}
                          </span>

                          <button
                            onClick={() => setInspectDoc({
                              path: `/${selectedCollection}/${docItem.id}`,
                              id: docItem.id,
                              data: docItem.data
                            })}
                            className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Documents Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 font-black text-slate-500 uppercase tracking-widest text-[9px]">
                      <tr>
                        <th className="px-6 py-4">Document Unique ID</th>
                        <th className="px-4 py-4">Structure Preview</th>
                        <th className="px-4 py-4">Complexity</th>
                        <th className="px-4 py-4">Last Serialized</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredDocuments.map((docItem) => {
                        const fieldKeys = Object.keys(docItem.data || {});
                        const keyPreview = deriveKeyFields(docItem.data);
                        const updatedTime = deriveUpdatedTime(docItem.data);

                        return (
                          <tr key={docItem.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-[13px]">
                                  {docItem.id}
                                </span>
                                <button
                                  onClick={() => handleCopy(docItem.id, `id-${docItem.id}`)}
                                  className="p-1 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Copy ID"
                                >
                                  {copiedKey === `id-${docItem.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            <td className="px-4 py-4 max-w-sm">
                              <div className="text-slate-600 dark:text-slate-400 font-medium truncate text-[11px]" title={keyPreview}>
                                {keyPreview}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <span className="px-2 py-0.5 rounded-lg font-black text-[10px] uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {fieldKeys.length} items
                              </span>
                            </td>

                            <td className="px-4 py-4 text-slate-400 font-bold text-[10px]">
                              {updatedTime}
                            </td>

                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setInspectDoc({
                                  path: `/${selectedCollection}/${docItem.id}`,
                                  id: docItem.id,
                                  data: docItem.data
                                })}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDocuments.map((docItem) => {
                    const fieldKeys = Object.keys(docItem.data || {});
                    const keyPreview = deriveKeyFields(docItem.data);

                    return (
                      <div key={docItem.id} className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm truncate max-w-[200px]">
                            {docItem.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {fieldKeys.length} items
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {keyPreview}
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setInspectDoc({
                              path: `/${selectedCollection}/${docItem.id}`,
                              id: docItem.id,
                              data: docItem.data
                            })}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect Document
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Page {pageIndex + 1} <span className="mx-1.5 opacity-30">|</span> {documents.length} Records Loaded
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={pageIndex === 0 || loadingDocs}
                  className="px-3 py-1.5 bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={documents.length < 25 || loadingDocs}
                  className="px-3 py-1.5 bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-xs"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </AdminCard>
        </div>
      )}

      {/* 6. Document Detail Modal (Requirement 6) */}
      {inspectDoc && (
        <DocumentDetailModal
          docPath={inspectDoc.path}
          docId={inspectDoc.id}
          data={inspectDoc.data}
          maskSensitiveData={maskSensitiveData}
          onToggleMask={() => setMaskSensitiveData(!maskSensitiveData)}
          onClose={() => setInspectDoc(null)}
          onCopy={handleCopy}
          copiedKey={copiedKey}
        />
      )}
    </div>
  );
};

// Collapsible JSON Tree Node Component (Requirement 6)
interface JsonTreeNodeProps {
  keyName: string;
  value: any;
  isRoot?: boolean;
  depth?: number;
  maskSensitiveData: boolean;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  keyName,
  value,
  isRoot = false,
  depth = 0,
  maskSensitiveData
}) => {
  const [collapsed, setCollapsed] = React.useState(depth > 2); // Auto collapse deep nested objects

  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);

  // Mask sensitive values
  const getDisplayValue = () => {
    if (value === null) return <span className="text-slate-400 italic">null</span>;
    if (value === undefined) return <span className="text-slate-400 italic">(undefined)</span>;

    const lowerKey = keyName.toLowerCase();
    if (maskSensitiveData && typeof value === "string") {
      if (lowerKey.includes("email") && value.includes("@")) {
        const parts = value.split("@");
        return <span className="text-emerald-600 dark:text-emerald-400 font-mono">"{parts[0].slice(0, 2)}***@{parts[1]}"</span>;
      }
      if (lowerKey.includes("phone") || lowerKey.includes("mobile")) {
        return <span className="text-emerald-600 dark:text-emerald-400 font-mono">"••••••••{value.slice(-3)}"</span>;
      }
      if (lowerKey.includes("key") || lowerKey.includes("secret") || lowerKey.includes("token") || lowerKey.includes("password")) {
        return <span className="text-emerald-600 dark:text-emerald-400 font-mono">"••••••••••••••••"</span>;
      }
    }

    if (typeof value === "string") {
      return <span className="text-emerald-600 dark:text-emerald-400 font-mono">"{value}"</span>;
    }
    if (typeof value === "number") {
      return <span className="text-blue-600 dark:text-blue-400 font-mono">{value}</span>;
    }
    if (typeof value === "boolean") {
      return <span className="text-purple-600 dark:text-purple-400 font-mono">{value ? "true" : "false"}</span>;
    }

    // Firestore Timestamp heuristic
    if (value?.toDate) {
      try {
        const d = value.toDate();
        return (
          <span className="text-amber-600 dark:text-amber-400 font-mono" title={`Seconds: ${value.seconds}`}>
            Timestamp({d.toISOString()})
          </span>
        );
      } catch {
        // Fallback
      }
    }

    return <span className="text-slate-700 dark:text-slate-300 font-mono">{String(value)}</span>;
  };

  if (isObject || isArray) {
    const keys = Object.keys(value || {});
    const count = keys.length;

    return (
      <div className={`text-xs ${depth > 0 ? "pl-4 border-l border-slate-200 dark:border-slate-800 my-0.5" : ""}`}>
        <div
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded px-1 group"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
          )}

          {!isRoot && (
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {keyName}:
            </span>
          )}

          <span className="text-slate-400 font-mono text-[11px]">
            {isArray ? `Array(${count})` : `Object {${count} keys}`}
          </span>
        </div>

        {!collapsed && (
          <div className="space-y-0.5">
            {count === 0 ? (
              <div className="pl-5 text-slate-400 italic text-[11px] py-0.5">
                {isArray ? "(empty array)" : "(empty object)"}
              </div>
            ) : (
              keys.map((k) => (
                <JsonTreeNode
                  key={k}
                  keyName={k}
                  value={value[k]}
                  depth={depth + 1}
                  maskSensitiveData={maskSensitiveData}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`text-xs flex items-baseline gap-2 py-0.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 rounded px-1 ${depth > 0 ? "pl-4" : ""}`}>
      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 shrink-0">
        {keyName}:
      </span>
      <div className="break-all">{getDisplayValue()}</div>
    </div>
  );
};

// Document Detail Modal Component (Requirement 6)
interface DocumentDetailModalProps {
  docPath: string;
  docId: string;
  data: any;
  maskSensitiveData: boolean;
  onToggleMask: () => void;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  copiedKey: string | null;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  docPath,
  docId,
  data,
  maskSensitiveData,
  onToggleMask,
  onClose,
  onCopy,
  copiedKey
}) => {
  const [activeTab, setActiveTab] = React.useState<"tree" | "raw">("tree");

  const formattedJson = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Document Inspector</div>
            <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5 mt-0.5">
              <span>{docPath}</span>
              <button
                onClick={() => onCopy(docPath, "path")}
                className="p-1 text-slate-400 hover:text-blue-500"
                title="Copy Path"
              >
                {copiedKey === "path" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Tabs, Copy ID, Copy JSON, Mask Toggle */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-xl font-bold">
            <button
              onClick={() => setActiveTab("tree")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "tree" ? "bg-white dark:bg-[#111A2E] text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Interactive Tree
            </button>
            <button
              onClick={() => setActiveTab("raw")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "raw" ? "bg-white dark:bg-[#111A2E] text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Raw JSON
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Masking Toggle */}
            <button
              onClick={onToggleMask}
              className={`px-2.5 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition-all ${
                maskSensitiveData
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
              title="Toggle masking of emails, phone numbers, and secrets"
            >
              {maskSensitiveData ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {maskSensitiveData ? "Masking ON" : "Masking OFF"}
            </button>

            {/* Copy ID */}
            <button
              onClick={() => onCopy(docId, "modal-id")}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 hover:bg-slate-100 font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shadow-sm"
            >
              {copiedKey === "modal-id" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              Copy ID
            </button>

            {/* Copy JSON */}
            <button
              onClick={() => onCopy(formattedJson, "modal-json")}
              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 shadow-sm"
            >
              {copiedKey === "modal-json" ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              Copy JSON
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 font-mono">
          {activeTab === "tree" ? (
            <div className="space-y-1">
              {data && Object.keys(data).length > 0 ? (
                Object.keys(data).map((key) => (
                  <JsonTreeNode
                    key={key}
                    keyName={key}
                    value={data[key]}
                    maskSensitiveData={maskSensitiveData}
                  />
                ))
              ) : (
                <div className="text-slate-400 italic text-xs py-4 text-center">
                  Empty document (no fields)
                </div>
              )}
            </div>
          ) : (
            <pre className="text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-pre-wrap">
              {formattedJson}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
