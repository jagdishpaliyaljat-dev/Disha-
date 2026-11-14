import * as React from "react";
import { 
  BookOpen, Layers, LayoutDashboard, Users, Image as ImageIcon, Terminal, Flame, X, 
  FolderPlus, PlusCircle, Database, LayoutGrid, Settings, ShieldCheck, 
  Upload, Sparkles, Menu, ChevronRight, Activity, Cpu, RefreshCw, Newspaper,
  Trophy, CheckCircle2, ListFilter, ChevronDown, Trash2, AlertCircle, Building2,
  FileCode, Archive, LogOut, ArrowRight, Timer, FileText
} from "lucide-react";
import { Subject, Chapter, UserQuestionsStore, UserProfile } from "../types";
import { ConfirmDialog } from "./admin/ConfirmDialog";
import { deleteSubject, deleteChapter, saveUserQuestionsStore } from "../utils/questionsStorage";
import { AdminSectionLoader } from "./admin/AdminSkeletonLoaders";
import type { SyncProgressState } from "../utils/bulkSyncService";
import { isUserAdmin } from "../utils/userProfileStorage";
import { getTotalDisplayCount, getCombinedSubjects, getCombinedChapters, getCombinedQuestions } from "../utils/questionsStorage";
import { loadLocalPYQPapers, getDeletedPYQIds } from "../utils/pyqStorage";
import { loadLocalLiveTests, getDeletedLiveTestIds } from "../utils/liveTestStorage";
import { getDeletedBannerIds } from "../utils/bannerStorage";
import { triggerAdminToast, AdminToastPayload } from "../utils/adminToast";
import { auth } from "../lib/firebase";
import { AdminQuotaAlert } from "./admin/AdminQuotaAlert";

// Resilient lazy loader helper for admin subcomponents compatible with React 19
function adminSafeLazy<T extends React.ComponentType<any>>(
  importFn: () => Promise<any>,
  exportName?: string
): T {
  return React.lazy(() =>
    importFn().then((mod) => {
      const component = exportName ? mod[exportName] || mod.default : mod.default || Object.values(mod)[0];
      if (!component) {
        throw new Error(`Admin subcomponent '${exportName || 'default'}' not found`);
      }
      return { default: component };
    })
  ) as unknown as T;
}

// Feature-wise On-Demand Lazy Loaded Admin Modules (cached automatically by React)
const AdminDashboardSection = adminSafeLazy<any>(() => import("./admin/AdminDashboardSection"), "AdminDashboardSection");
const AdminAnalyticsDashboard = adminSafeLazy<any>(() => import("./admin/AdminAnalyticsDashboard"), "AdminAnalyticsDashboard");
const AdminSyllabusSection = adminSafeLazy<any>(() => import("./admin/AdminSyllabusSection"), "AdminSyllabusSection");
const McqDuplicateScannerWidget = adminSafeLazy<any>(() => import("./admin/McqDuplicateScannerWidget"), "McqDuplicateScannerWidget");
const AdminNewsSection = adminSafeLazy<any>(() => import("./admin/AdminNewsSectionV2"), "AdminNewsSection");
const AdminBannerManagementSection = adminSafeLazy<any>(() => import("./admin/AdminBannerManagementSection"), "AdminBannerManagementSection");
const AdminUserManagementSection = adminSafeLazy<any>(() => import("./admin/AdminUserManagementSection"), "AdminUserManagementSection");
const AdminMessagesSection = adminSafeLazy<any>(() => import("./admin/AdminMessagesSection"), "AdminMessagesSection");
const AdminNotificationBroadcastSection = adminSafeLazy<any>(() => import("./admin/AdminNotificationBroadcastSection"), "AdminNotificationBroadcastSection");
const FirebaseDataExplorer = adminSafeLazy<any>(() => import("./admin/FirebaseDataExplorer"), "FirebaseDataExplorer");
const FirebaseAuditConsole = adminSafeLazy<any>(() => import("./admin/FirebaseAuditConsole"), "FirebaseAuditConsole");
const ProductionStabilityPanel = adminSafeLazy<any>(() => import("./admin/ProductionStabilityPanel"), "ProductionStabilityPanel");
const FirebaseQuotaHealthPanel = adminSafeLazy<any>(() => import("./admin/FirebaseQuotaHealthPanel"), "FirebaseQuotaHealthPanel");
const SyncHealthMonitorPanel = adminSafeLazy<any>(() => import("./admin/SyncHealthMonitorPanel"), "SyncHealthMonitorPanel");
const AdminDiagnosticsSection = adminSafeLazy<any>(() => import("./admin/AdminDiagnosticsSection"), "AdminDiagnosticsSection");
const DiagnosticReport = adminSafeLazy<any>(() => import("./admin/DiagnosticReport"), "DiagnosticReport");
const AIApiManagementSection = adminSafeLazy<any>(() => import("./admin/AIApiManagementSection"), "AIApiManagementSection");
const ExportDataWidget = adminSafeLazy<any>(() => import("./admin/ExportDataWidget"), "ExportDataWidget");
const BackupRestoreSection = adminSafeLazy<any>(() => import("./admin/BackupRestoreSection"), "BackupRestoreSection");
const AuditLogWidget = adminSafeLazy<any>(() => import("./admin/AuditLogWidget"), "AuditLogWidget");
const SyncProgressModal = adminSafeLazy<any>(() => import("./admin/SyncProgressModal"), "SyncProgressModal");
const SyncConfirmationModal = adminSafeLazy<any>(() => import("./admin/SyncConfirmationModal"), "SyncConfirmationModal");
const QATestRunnerModal = adminSafeLazy<any>(() => import("./QATestRunnerModal"), "QATestRunnerModal");
const ManageCoachingHierarchyModal = adminSafeLazy<any>(() => import("./admin/ManageCoachingHierarchyModal"), "ManageCoachingHierarchyModal");

interface AdminTabProps {
  userProfile: UserProfile | null;
  subjects?: Subject[];
  chapters: Chapter[];
  questionsStore: UserQuestionsStore;
  onStoreUpdated?: (updatedStore: UserQuestionsStore) => void;
  onSyncToCloud?: () => Promise<void>;
  onShowAddSubject: () => void;
  onShowAddChapter: (subjectId?: string) => void;
  onShowAddTopic: (subjectId?: string, chapterId?: string) => void;
  onShowManageSyllabus: () => void;
  onShowAddQuestions: (chapterId?: string, topicId?: string, subjectId?: string, initialMethod?: "json" | "file" | "paste" | "manual") => void;
  onShowManageQuestions: () => void;
  onShowAIImport?: () => void;
  onShowHTMLImport?: () => void;
  onShowManagePYQVault?: () => void;
  onShowManageLiveTests?: () => void;
  onShowManageExamCategories: () => void;
  onShowManageBanners?: () => void;
  onDeleteSubject?: (subjectId: string) => Promise<void>;
  onDeleteChapter?: (chapterId: string) => Promise<void>;
}

export type AdminGroupSection = 
  | "dashboard"
  | "syllabus"
  | "questions"
  | "tests"
  | "content"
  | "users"
  | "firebase"
  | "diagnostics"
  | "integrations"
  | "backup"
  | "settings";

export const AdminTab: React.FC<AdminTabProps> = (props) => {
  // Active Group Section State
  const [activeGroup, setActiveGroup] = React.useState<AdminGroupSection>(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const sec = searchParams.get("section") as AdminGroupSection | null;
      if (sec) return sec;
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p.includes("/admin/firebase-data") || h.includes("#admin/firebase-data")) return "firebase";
      if (p.includes("/admin/news") || h.includes("#admin/news")) return "content";
    }
    return "dashboard";
  });

  // Sub-tab toggles for multi-view groups
  const [subTabDashboard, setSubTabDashboard] = React.useState<"overview" | "analytics">("overview");
  const [subTabContent, setSubTabContent] = React.useState<"news" | "banners">("news");
  const [subTabUsers, setSubTabUsers] = React.useState<"directory" | "messages" | "notifications">("directory");
  const [subTabFirebase, setSubTabFirebase] = React.useState<"diagnostics" | "explorer" | "audit" | "quota" | "sync" | "integrity">("diagnostics");

  const [selectedUserForDetails, setSelectedUserForDetails] = React.useState<UserProfile | null>(null);
  const [showQATestRunner, setShowQATestRunner] = React.useState(false);
  const [showCoachingHierarchyModal, setShowCoachingHierarchyModal] = React.useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = React.useState(false);
  const adminMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminMenuOpen(false);
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAdminMenuOpen]);

  // Aggregate metrics for tests tab overview
  const testsStats = React.useMemo(() => {
    let lt: any[] = [];
    let pyq: any[] = [];
    let pyqQCount = 0;
    try {
      lt = loadLocalLiveTests();
    } catch {}
    try {
      pyq = loadLocalPYQPapers();
      pyq.forEach(p => { pyqQCount += (p.questions?.length || 0); });
    } catch {}
    const activeLt = lt.filter(t => t.status === "live" || t.status === "upcoming").length;
    return {
      liveTestsTotal: lt.length,
      liveActiveCount: activeLt,
      pyqPapersTotal: pyq.length,
      pyqQuestionsTotal: pyqQCount,
    };
  }, [props.questionsStore, activeGroup]);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<SyncProgressState | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  // Deletion Confirmation Dialog State for Subject / Chapter
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<{
    type: "subject" | "chapter";
    id: string;
    title: string;
  } | null>(null);
  const [isDeletingCloud, setIsDeletingCloud] = React.useState(false);
  const [deleteNotification, setDeleteNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [topToast, setTopToast] = React.useState<AdminToastPayload | null>(null);
  const [syllabusViewTab, setSyllabusViewTab] = React.useState<"subjects" | "chapters">("subjects");

  React.useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AdminToastPayload>;
      if (customEvent.detail) {
        setTopToast(customEvent.detail);
      }
    };
    window.addEventListener("quizpro_admin_toast", handleToastEvent);
    return () => window.removeEventListener("quizpro_admin_toast", handleToastEvent);
  }, []);

  React.useEffect(() => {
    if (topToast) {
      const timer = setTimeout(() => {
        setTopToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [topToast]);

  const promptDeleteSubject = (id: string, title: string) => {
    setDeleteConfirmTarget({ type: "subject", id, title });
  };

  const promptDeleteChapter = (id: string, title: string) => {
    setDeleteConfirmTarget({ type: "chapter", id, title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, id, title } = deleteConfirmTarget;
    setIsDeletingCloud(true);

    try {
      if (type === "subject") {
        if (props.onDeleteSubject) {
          await props.onDeleteSubject(id);
        } else {
          const { deleteSubjectFromCloud } = await import("../utils/firebaseSyncService");
          const res = await deleteSubjectFromCloud(id);
          const nextStore = deleteSubject(props.questionsStore, id);
          saveUserQuestionsStore(nextStore);
          props.onStoreUpdated?.(nextStore);
          if (!res.success) {
            throw new Error(res.message);
          }
        }
        setDeleteNotification({
          type: "success",
          message: `Subject "${title}" deleted from Cloud & local storage.`
        });
        triggerAdminToast(
          "delete",
          "Subject Deleted from Firebase",
          `Subject "${title}" has been deleted from Firebase Firestore.`
        );
      } else {
        if (props.onDeleteChapter) {
          await props.onDeleteChapter(id);
        } else {
          const { deleteChapterFromCloud } = await import("../utils/firebaseSyncService");
          const res = await deleteChapterFromCloud(id);
          const nextStore = deleteChapter(props.questionsStore, id);
          saveUserQuestionsStore(nextStore);
          props.onStoreUpdated?.(nextStore);
          if (!res.success) {
            throw new Error(res.message);
          }
        }
        setDeleteNotification({
          type: "success",
          message: `Chapter "${title}" deleted from Cloud & local storage.`
        });
        triggerAdminToast(
          "delete",
          "Chapter Deleted from Firebase",
          `Chapter "${title}" has been deleted from Firebase Firestore.`
        );
      }
      setTimeout(() => setDeleteNotification(null), 3500);
    } catch (err: any) {
      setDeleteNotification({
        type: "error",
        message: err?.message || `Failed to delete ${type} from Cloud.`
      });
      setTimeout(() => setDeleteNotification(null), 4000);
    } finally {
      setIsDeletingCloud(false);
      setDeleteConfirmTarget(null);
    }
  };

  React.useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const search = new URLSearchParams(window.location.search);
        const sec = search.get("section") as AdminGroupSection | null;
        const userId = search.get("userId");

        if (!userId) {
          setSelectedUserForDetails(null);
        }
        if (sec) {
          setActiveGroup(sec);
        } else if (window.location.pathname === "/admin") {
          setActiveGroup("dashboard");
        } else if (window.location.pathname === "/admin/firebase-data" || window.location.hash === "#admin/firebase-data") {
          setActiveGroup("firebase");
          setSubTabFirebase("explorer");
        } else if (window.location.pathname === "/admin/news" || window.location.hash === "#admin/news") {
          setActiveGroup("content");
          setSubTabContent("news");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectGroup = React.useCallback((group: AdminGroupSection) => {
    setActiveGroup(group);
    setIsSidebarOpen(false);
    if (typeof window !== "undefined") {
      try {
        if (group === "firebase" && subTabFirebase === "explorer") {
          window.history.pushState({ group }, "", "/admin/firebase-data");
        } else if (group === "content" && subTabContent === "news") {
          window.history.pushState({ group }, "", "/admin/news");
        } else if (group === "dashboard") {
          if (window.location.pathname + window.location.search !== "/admin") {
            window.history.pushState({ group: "dashboard" }, "", "/admin");
          }
        } else {
          const target = `/admin?section=${group}`;
          if (window.location.pathname + window.location.search !== target) {
            window.history.pushState({ group }, "", target);
          }
        }
      } catch (err) {
        console.warn("Failed to push history state:", err);
      }
    }
  }, [subTabFirebase, subTabContent]);

  // Compatibility helper for legacy section triggers
  const handleLegacyNavigateSection = (sec: string) => {
    switch (sec) {
      case "dashboard":
        setActiveGroup("dashboard");
        setSubTabDashboard("overview");
        break;
      case "analytics":
        setActiveGroup("dashboard");
        setSubTabDashboard("analytics");
        break;
      case "curriculum":
        setActiveGroup("syllabus");
        break;
      case "questions":
        setActiveGroup("questions");
        break;
      case "tests":
      case "live-tests":
      case "pyq":
        setActiveGroup("tests");
        break;
      case "users":
        setActiveGroup("users");
        setSubTabUsers("directory");
        break;
      case "messages":
        setActiveGroup("users");
        setSubTabUsers("messages");
        break;
      case "plans":
        setActiveGroup("users");
        setSubTabUsers("directory");
        break;
      case "news":
        setActiveGroup("content");
        setSubTabContent("news");
        break;
      case "banners":
        setActiveGroup("content");
        setSubTabContent("banners");
        break;
      case "health":
        setActiveGroup("firebase");
        setSubTabFirebase("quota");
        break;
      case "sync-health":
        setActiveGroup("firebase");
        setSubTabFirebase("sync");
        break;
      case "firebase-data":
        setActiveGroup("firebase");
        setSubTabFirebase("explorer");
        break;
      case "firebase-audit":
        setActiveGroup("firebase");
        setSubTabFirebase("audit");
        break;
      case "ai-api":
        setActiveGroup("integrations");
        break;
      case "backup":
      case "restore":
        setActiveGroup("backup");
        break;
      default:
        setActiveGroup("dashboard");
    }
  };

  const [activeSyncCost, setActiveSyncCost] = React.useState<number | null>(null);

  const computeSyncCost = React.useCallback(() => {
    const combinedSubjects = props.subjects || [];
    const combinedChapters = props.chapters;
    const curriculumQuestions = getCombinedQuestions(combinedChapters);
    
    // Core curriculum deletions
    const delCount = (props.questionsStore.deletedQuestionIds?.length || 0) + 
                     (props.questionsStore.deletedSubjectIds?.length || 0) + 
                     (props.questionsStore.deletedChapterIds?.length || 0) + 
                     (props.questionsStore.deletedTopicIds?.length || 0);

    let pyqCount = 0;
    let pyqQCount = 0;
    let pyqDelCount = 0;
    try {
      const papers = loadLocalPYQPapers();
      pyqCount = papers.length;
      papers.forEach(p => pyqQCount += (p.questions?.length || 0));
      pyqDelCount = getDeletedPYQIds().length;
    } catch {}
    
    let liveCount = 0;
    let liveQCount = 0;
    let liveDelCount = 0;
    try {
      const tests = loadLocalLiveTests();
      liveCount = tests.length;
      tests.forEach(t => liveQCount += (t.questions?.length || 0));
      liveDelCount = getDeletedLiveTestIds().length;
    } catch {}
    
    let bannerDelCount = 0;
    try {
        bannerDelCount = getDeletedBannerIds().length;
    } catch {}

    return combinedSubjects.length + combinedChapters.length + curriculumQuestions.length + 
           pyqCount + pyqQCount + liveCount + liveQCount + 
           delCount + pyqDelCount + liveDelCount + bannerDelCount + 1;
  }, [props.questionsStore, props.subjects, props.chapters]);

  const getSyncCost = React.useCallback(() => {
    if (activeSyncCost !== null) return activeSyncCost;
    return computeSyncCost();
  }, [activeSyncCost, computeSyncCost]);

  const handleSyncInit = () => {
    const cost = computeSyncCost();
    setActiveSyncCost(cost);
    if (cost > 0) {
      setShowConfirm(true);
    } else {
      alert("All custom data is already synced with Cloud Firestore.");
    }
  };

  const handleSyncClick = async () => {
    setShowConfirm(false);
    setIsSyncing(true);

    // Diagnostic Log for Sync Initialization
    console.log("[AdminSync] Initializing bulk sync...", {
      user: props.userProfile?.email || auth.currentUser?.email || "unknown",
      uid: auth.currentUser?.uid || "missing",
      isAdmin: isUserAdmin(props.userProfile),
      recordCount: getSyncCost()
    });

    const initialProgress: SyncProgressState = {
      status: "validating",
      totalRecords: getSyncCost(),
      validRecords: 0,
      invalidRecords: 0,
      existingRecords: 0,
      uploadedRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      failedRecords: 0,
      currentBatch: 0,
      totalBatches: 0,
      progressPercentage: 0,
      currentStatusMessage: "Validating data records and preparing cloud sync...",
      errorDetails: []
    };
    setSyncProgress(initialProgress);

    try {
      const { executeBulkSync } = await import("../utils/bulkSyncService");
      const report = await executeBulkSync(props.questionsStore, (p) => setSyncProgress(p));
      if (report.success) {
        // Clear deleted IDs from store after successful sync
        const syncedStore: UserQuestionsStore = {
          ...props.questionsStore,
          deletedQuestionIds: [],
          deletedSubjectIds: [],
          deletedChapterIds: [],
          deletedTopicIds: [],
        };
        
        // Clear deletions from other storage modules
        try {
          const { clearDeletedPYQIds } = await import("../utils/pyqStorage");
          const { clearDeletedLiveTestIds } = await import("../utils/liveTestStorage");
          const { clearDeletedBannerIds } = await import("../utils/bannerStorage");
          clearDeletedPYQIds();
          clearDeletedLiveTestIds();
          clearDeletedBannerIds();
        } catch (clearErr) {
          console.warn("Could not clear supplemental deleted ID lists:", clearErr);
        }

        if (props.onStoreUpdated) {
          props.onStoreUpdated(syncedStore);
        }
      } else if (props.onStoreUpdated) {
        props.onStoreUpdated(props.questionsStore);
      }
    } catch (e: any) {
      console.error("Bulk sync error:", e);
      const errMsg = e?.message || "Sync failed unexpectedly.";
      setSyncProgress({
        status: "error",
        totalRecords: getSyncCost(),
        validRecords: 0,
        invalidRecords: 0,
        existingRecords: 0,
        uploadedRecords: 0,
        updatedRecords: 0,
        skippedRecords: 0,
        failedRecords: 1,
        currentBatch: 0,
        totalBatches: 0,
        progressPercentage: 0,
        currentStatusMessage: errMsg,
        errorDetails: [errMsg]
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const combinedSubjectsList = React.useMemo(() => (props.subjects && props.subjects.length > 0 ? props.subjects : getCombinedSubjects(props.questionsStore)), [props.subjects, props.questionsStore]);
  const combinedChaptersList = React.useMemo(() => (props.chapters && props.chapters.length > 0 ? props.chapters : getCombinedChapters(props.questionsStore)), [props.chapters, props.questionsStore]);
  const subjectCount = React.useMemo(() => combinedSubjectsList.length, [combinedSubjectsList]);
  const questionCount = React.useMemo(() => {
    return combinedChaptersList.reduce((acc, ch) => {
      return acc + (ch.topics || []).reduce((tAcc, t) => tAcc + (t.questions || []).length, 0);
    }, 0);
  }, [combinedChaptersList]);

  // Nav Groups definition mapping to the requested professional structure
  const navGroupItems: {
    id: AdminGroupSection;
    title: string;
    icon: any;
    badge?: string;
  }[] = React.useMemo(() => [
    {
      id: "dashboard",
      title: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "syllabus",
      title: "Syllabus",
      icon: Layers,
      badge: `${subjectCount}`,
    },
    {
      id: "questions",
      title: "Question Bank",
      icon: Database,
      badge: `${questionCount}`,
    },
    {
      id: "tests",
      title: "Exams & Tests",
      icon: Trophy,
    },
    {
      id: "content",
      title: "News & Banners",
      icon: Newspaper,
    },
    {
      id: "users",
      title: "Students",
      icon: Users,
    },
    {
      id: "firebase",
      title: "Database Explorer",
      icon: Terminal,
    },
    {
      id: "diagnostics",
      title: "Diagnostics Report",
      icon: Activity,
    },
    {
      id: "integrations",
      title: "AI API Config",
      icon: Cpu,
    },
    {
      id: "backup",
      title: "Backup & Restore",
      icon: Archive,
    },
    {
      id: "settings",
      title: "System Settings",
      icon: Settings,
    },
  ], [subjectCount, questionCount]);

  const mobileBottomShortcuts: { id: AdminGroupSection; label: string; icon: any }[] = React.useMemo(() => [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "syllabus", label: "Syllabus", icon: Layers },
    { id: "questions", label: "Questions", icon: Database },
    { id: "tests", label: "Tests", icon: Trophy },
    { id: "users", label: "Users", icon: Users },
  ], []);

  if (!isUserAdmin(props.userProfile)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Access Denied</h2>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          This portal is restricted to DISHA 20-20 Administrators. Please sign in with an authorized account.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. Sticky Compact Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0B1220]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-3 sm:px-6 h-14 sm:h-16">
          
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Toggle Menu"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-black text-xs sm:text-sm shadow-xs shrink-0">
                D
              </div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                DISHA 20-20 Admin
              </h1>
            </div>
            
            <div className="hidden md:flex items-center gap-2 text-slate-300 dark:text-slate-700 ml-2">
              <span className="text-xs">/</span>
              <span className="text-xs font-medium text-slate-500 capitalize">{activeGroup.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button
              onClick={handleSyncInit}
              className={`p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isSyncing ? "animate-spin text-blue-600" : ""}`}
              title="Cloud Sync"
            >
              <RefreshCw className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>
            
            <button
              onClick={() => { setActiveGroup("users"); setSubTabUsers("notifications"); }}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
              title="View Broadcasts & System Alerts"
            >
              <Activity className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-[#0B1220]"></span>
            </button>

            <div className="h-5 sm:h-6 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block"></div>

            <div className="relative" ref={adminMenuRef}>
              <button
                onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-2 pl-1 pr-1 sm:pr-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Admin Account Profile"
                aria-expanded={isAdminMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
                  {props.userProfile?.name?.charAt(0) || "A"}
                </div>
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">{props.userProfile?.name?.split(' ')[0] || "Admin"}</span>
                <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 hidden sm:inline transition-transform duration-200 ${isAdminMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {isAdminMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-3 space-y-3">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {props.userProfile?.name?.charAt(0) || "A"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {props.userProfile?.name || "System Admin"}
                        </p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 shrink-0">
                          {props.userProfile?.role || "Admin"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {props.userProfile?.email || auth.currentUser?.email || "admin@quizpro.local"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveGroup("users");
                        setSubTabUsers("directory");
                        setIsAdminMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>View Student Directory</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        auth.signOut().catch(() => {});
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Mobile Backdrop Overlay */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden cursor-pointer"
            aria-hidden="true"
          />
        )}

        {/* 2. Responsive Navigation Drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0B1220] border-r border-slate-200 dark:border-slate-800 transform ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 transition-transform duration-200 ease-in-out lg:static lg:z-0 flex flex-col`}
        >
          {/* Mobile-only Drawer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-black text-xs shadow-xs">
                D
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Admin Navigation</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
            <div className="px-3 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management</p>
            </div>

            {navGroupItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeGroup === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectGroup(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] cursor-pointer touch-manipulation min-h-[42px] ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600"}`} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                      isActive ? "bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                setShowQATestRunner(true);
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors min-h-[42px] cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-slate-400" />
              <span>QA Debug Suite</span>
            </button>
          </div>
        </aside>

        {/* 3. Main Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-[#080E1A] p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-screen-xl mx-auto space-y-5 sm:space-y-6">
            
            {/* Mobile Horizontal Quick Navigation Strip (lg:hidden) */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 touch-pan-x">
              {navGroupItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeGroup === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectGroup(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs"
                        : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </div>

            <React.Suspense fallback={null}>
              <AdminQuotaAlert />
            </React.Suspense>
            
            {activeGroup === "dashboard" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time system health and student activity metrics.</p>
                  </div>
                  
                  <div className="flex items-center p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs self-start sm:self-auto overflow-x-auto max-w-full no-scrollbar">
                    <button
                      onClick={() => setSubTabDashboard("overview")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        subTabDashboard === "overview"
                          ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Real-time
                    </button>
                    <button
                      onClick={() => setSubTabDashboard("analytics")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        subTabDashboard === "analytics"
                          ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Analytics
                    </button>
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="metrics" title="Loading Dashboard..." />}>
                  {subTabDashboard === "overview" ? (
                    <AdminDashboardSection
                      onNavigateSection={handleLegacyNavigateSection}
                      onSelectUser={(user: any) => {
                        setSelectedUserForDetails(user);
                        setActiveGroup("users");
                        setSubTabUsers("directory");
                      }}
                      onOpenQARunner={() => setShowQATestRunner(true)}
                      questionsStore={props.questionsStore}
                    />
                  ) : (
                    <AdminAnalyticsDashboard />
                  )}
                </React.Suspense>
              </div>
            )}

            {activeGroup === "syllabus" && (
              <React.Suspense fallback={<AdminSectionLoader type="list" title="Loading Syllabus..." />}>
                <AdminSyllabusSection
                  subjects={combinedSubjectsList}
                  chapters={combinedChaptersList}
                  onShowAddSubject={props.onShowAddSubject}
                  onShowAddChapter={props.onShowAddChapter}
                  onShowAddTopic={props.onShowAddTopic}
                  onShowManageSyllabus={props.onShowManageSyllabus}
                  onShowManageExamCategories={props.onShowManageExamCategories}
                  promptDeleteSubject={promptDeleteSubject}
                  promptDeleteChapter={promptDeleteChapter}
                  isDeletingCloud={isDeletingCloud}
                  syllabusViewTab={syllabusViewTab}
                  setSyllabusViewTab={setSyllabusViewTab}
                />
              </React.Suspense>
            )}

            {/* Question Bank Section */}
            {activeGroup === "questions" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="space-y-0.5">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Question Repository</h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Manage thousands of MCQs and batch imports.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={props.onShowHTMLImport}
                      className="px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Import MCQs from HTML files or HTML source code"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>HTML Import</span>
                    </button>
                    <button onClick={props.onShowManageQuestions} className="px-3.5 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 dark:hover:bg-slate-600 transition-all cursor-pointer active:scale-95">
                      Browse Repository
                    </button>
                    <button onClick={props.onShowAIImport} className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      AI Import
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                  {[
                    { label: "Directory", action: props.onShowManageQuestions, icon: Database, isHtml: false },
                    { label: "HTML Import", action: props.onShowHTMLImport, icon: FileCode, isHtml: true },
                    { label: "Quick Add", action: () => props.onShowAddQuestions(undefined, undefined, undefined, "paste"), icon: PlusCircle, isHtml: false },
                    { 
                      label: "Deduplication", 
                      action: () => {
                        const el = document.getElementById("duplicate-scanner-widget");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }, 
                      icon: ListFilter,
                      isHtml: false
                    },
                    { label: "Batch Upload", action: () => props.onShowAddQuestions(undefined, undefined, undefined, "file"), icon: Upload, isHtml: false },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className={`p-3 sm:p-4 bg-white dark:bg-slate-800 border rounded-2xl shadow-xs flex flex-col items-center gap-2 transition-all text-center group cursor-pointer active:scale-95 ${
                        item.isHtml
                          ? "border-orange-300 dark:border-orange-900/60 hover:border-orange-600 bg-orange-50/20 dark:bg-orange-950/10"
                          : "border-slate-100 dark:border-slate-800 hover:border-slate-900 dark:hover:border-slate-400"
                      }`}
                    >
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors ${
                        item.isHtml
                          ? "bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 group-hover:scale-105"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                      }`}>
                        <item.icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                      </div>
                      <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-tight ${
                        item.isHtml
                          ? "text-orange-700 dark:text-orange-400 font-extrabold"
                          : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                      }`}>{item.label}</span>
                    </button>
                  ))}
                </div>

                <div id="duplicate-scanner-widget">
                  <React.Suspense fallback={<AdminSectionLoader type="list" />}>
                    <McqDuplicateScannerWidget />
                  </React.Suspense>
                </div>
              </div>
            )}

            {/* Exams Section */}
            {activeGroup === "tests" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="space-y-0.5">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Exam Series & PYQs</h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Historical papers and live mock schedules.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setShowCoachingHierarchyModal(true)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Coaching Hierarchy</span>
                    </button>
                    <button
                      onClick={props.onShowManagePYQVault}
                      className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ PYQ Paper</span>
                    </button>
                    <button
                      onClick={props.onShowManageLiveTests}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Live Test</span>
                    </button>
                  </div>
                </div>

                {/* Responsive Test Management Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* 1. Live Mock Tests Overview Card */}
                  <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-rose-300 dark:hover:border-rose-900/50 transition-all group">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Timer className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          {testsStats.liveActiveCount} Active
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          Live Mock Tests
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Full-length timed examinations with state percentile scoring, RPSC 5th-option compliance, and live ranks.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Total Test Series:</span>
                        <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {testsStats.liveTestsTotal} {testsStats.liveTestsTotal === 1 ? "Test" : "Tests"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={props.onShowManageLiveTests}
                      className="w-full mt-5 py-2.5 sm:py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                    >
                      <span>Manage Live Tests</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 2. Previous Year Papers (PYQ Vault) Overview Card */}
                  <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-amber-300 dark:hover:border-amber-900/50 transition-all group">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                          <Archive className="w-3.5 h-3.5" />
                          {testsStats.pyqPapersTotal} Papers
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          PYQ Paper Vault
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Official past question papers indexed by examination, commission, year, and subject with authentic answer keys.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Archived MCQs:</span>
                        <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {testsStats.pyqQuestionsTotal.toLocaleString()} Questions
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={props.onShowManagePYQVault}
                      className="w-full mt-5 py-2.5 sm:py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-98 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                    >
                      <span>Open PYQ Vault</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 3. Coaching Hierarchy & Batches Overview Card */}
                  <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-900/50 transition-all group">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Building2 className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                          Multi-Tenant
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          Coaching & Batches
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Manage coaching partner institutions, branch centers, and private batches to restrict exclusive test schedules.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Access Control:</span>
                        <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          Batch Gated
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowCoachingHierarchyModal(true)}
                      className="w-full mt-5 py-2.5 sm:py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                    >
                      <span>Configure Hierarchy</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Content Section */}
            {activeGroup === "content" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Editorial Content</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage articles, news feed and app-wide banners.</p>
                  </div>
                  <div className="flex items-center p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-x-auto max-w-full no-scrollbar self-start sm:self-auto">
                    <button onClick={() => setSubTabContent("news")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabContent === "news" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Articles</button>
                    <button onClick={() => setSubTabContent("banners")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabContent === "banners" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Banners</button>
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Content..." />}>
                  {subTabContent === "news" ? (
                    <AdminNewsSection onBackToAdmin={() => handleSelectGroup("dashboard")} />
                  ) : (
                    <AdminBannerManagementSection />
                  )}
                </React.Suspense>
              </div>
            )}

            {/* Users Section */}
            {activeGroup === "users" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Student Directory</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage user profiles, permissions and communication.</p>
                  </div>
                  <div className="flex items-center p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-x-auto max-w-full no-scrollbar self-start sm:self-auto">
                    <button onClick={() => setSubTabUsers("directory")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabUsers === "directory" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Students</button>
                    <button onClick={() => setSubTabUsers("messages")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabUsers === "messages" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Inquiries</button>
                    <button onClick={() => setSubTabUsers("notifications")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabUsers === "notifications" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Broadcasts</button>
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Users..." />}>
                  {subTabUsers === "directory" && (
                    <AdminUserManagementSection
                      initialSelectedUser={selectedUserForDetails}
                      onClearInitialUser={() => setSelectedUserForDetails(null)}
                    />
                  )}
                  {subTabUsers === "messages" && <AdminMessagesSection onBackToAdmin={() => handleSelectGroup("dashboard")} />}
                  {subTabUsers === "notifications" && <AdminNotificationBroadcastSection />}
                </React.Suspense>
              </div>
            )}

            {/* Firebase Section */}
            {activeGroup === "firebase" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Database Explorer</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Direct access to Firestore records and audit logs.</p>
                  </div>
                  <div className="flex items-center p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-x-auto max-w-full no-scrollbar self-start sm:self-auto">
                    <button onClick={() => setSubTabFirebase("diagnostics")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabFirebase === "diagnostics" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Diagnostics</button>
                    <button onClick={() => setSubTabFirebase("explorer")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabFirebase === "explorer" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Explorer</button>
                    <button onClick={() => setSubTabFirebase("audit")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabFirebase === "audit" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Audit</button>
                    <button onClick={() => setSubTabFirebase("quota")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabFirebase === "quota" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Quota</button>
                    <button onClick={() => setSubTabFirebase("sync")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${subTabFirebase === "sync" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>Sync</button>
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="table" title="Loading Database Tools..." />}>
                  {subTabFirebase === "diagnostics" && <AdminDiagnosticsSection userProfile={props.userProfile} subjects={combinedSubjectsList} chapters={combinedChaptersList} />}
                  {subTabFirebase === "explorer" && <FirebaseDataExplorer userProfile={props.userProfile} />}
                  {subTabFirebase === "audit" && <FirebaseAuditConsole userProfile={props.userProfile} />}
                  {subTabFirebase === "quota" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ProductionStabilityPanel />
                      <FirebaseQuotaHealthPanel onBulkSync={handleSyncInit} />
                    </div>
                  )}
                  {subTabFirebase === "sync" && <SyncHealthMonitorPanel questionsStore={props.questionsStore} onStoreUpdated={props.onStoreUpdated} userProfile={props.userProfile} />}
                </React.Suspense>
              </div>
            )}

            {/* Diagnostics Report Section */}
            {activeGroup === "diagnostics" && (
              <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Diagnostics Report..." />}>
                <DiagnosticReport userProfile={props.userProfile} />
              </React.Suspense>
            )}

            {/* Integrations Section */}
            {activeGroup === "integrations" && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#111A2E] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 dark:text-white">
                        Group 8: API & Model Integrations
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Configure Gemini API keys, provider rotation pool & quota limits
                      </p>
                    </div>
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading API Configurations..." />}>
                  <AIApiManagementSection />
                </React.Suspense>
              </div>
            )}

            {/* Disaster Recovery: Backup & Restore Section */}
            {activeGroup === "backup" && (
              <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Disaster Recovery..." />}>
                <BackupRestoreSection userProfile={props.userProfile} />
              </React.Suspense>
            )}

            {/* Settings Section */}
            {activeGroup === "settings" && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#111A2E] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 dark:text-white">
                        Group 9: Application Settings & Maintenance
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Database backup exports, system audit trail & QA debug suite
                      </p>
                    </div>
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="list" title="Loading Settings..." />}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Backup & Registry</h3>
                      <ExportDataWidget questionsStore={props.questionsStore} />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">QA Debug Suite</h3>
                      <div className="p-4 bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <p className="text-xs text-slate-500 font-medium">
                          Execute automated QA tests for questions, parser verification, and performance benchmarks.
                        </p>
                        <button
                          onClick={() => setShowQATestRunner(true)}
                          className="w-full py-3 px-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                        >
                          <Terminal className="w-4 h-4 text-emerald-400" />
                          <span>Launch Automated QA Runner</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <AuditLogWidget />
                </React.Suspense>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modals & Dialogs */}
      {showQATestRunner && (
        <React.Suspense fallback={null}>
          <QATestRunnerModal isOpen={showQATestRunner} onClose={() => setShowQATestRunner(false)} />
        </React.Suspense>
      )}
      {showCoachingHierarchyModal && (
        <React.Suspense fallback={null}>
          <ManageCoachingHierarchyModal
            isOpen={showCoachingHierarchyModal}
            onClose={() => setShowCoachingHierarchyModal(false)}
          />
        </React.Suspense>
      )}
      {syncProgress && (
        <React.Suspense fallback={null}>
          <SyncProgressModal progress={syncProgress} onClose={() => setSyncProgress(null)} />
        </React.Suspense>
      )}
      {showConfirm && (
        <React.Suspense fallback={null}>
          <SyncConfirmationModal itemCount={getSyncCost()} onConfirm={handleSyncClick} onClose={() => setShowConfirm(false)} />
        </React.Suspense>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteConfirmTarget)}
        title={deleteConfirmTarget?.type === "subject" ? "Delete Subject from Cloud" : "Delete Chapter from Cloud"}
        message={
          deleteConfirmTarget?.type === "subject"
            ? `Are you sure you want to delete subject "${deleteConfirmTarget?.title}"? This action triggers deleteSubjectFromCloud, removing the subject and its associated chapters/topics from Firebase Firestore. This cannot be undone.`
            : `Are you sure you want to delete chapter "${deleteConfirmTarget?.title}"? This action triggers deleteChapterFromCloud, removing the chapter and its associated topics/questions from Firebase Firestore. This cannot be undone.`
        }
        confirmText="Confirm Delete"
        cancelText="Cancel"
        isDeleting={isDeletingCloud}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeletingCloud) setDeleteConfirmTarget(null);
        }}
      />
    </div>
  );
};

export default AdminTab;
