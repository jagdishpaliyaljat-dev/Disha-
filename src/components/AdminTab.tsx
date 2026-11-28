import * as React from "react";
import { 
  BookOpen, LayoutDashboard, Users, Terminal, X, 
  PlusCircle, Database, Settings, ShieldCheck, 
  Upload, Sparkles, Menu, ChevronRight, ChevronLeft, Activity, Cpu, RefreshCw, Newspaper,
  Trophy, ChevronDown, Trash2, Building2,
  FileCode, Archive, LogOut, Timer, FileSpreadsheet, Home, Bot, Swords, ShieldAlert,
  ArchiveRestore, FileCheck, CalendarClock,
  Search, Stethoscope, BarChart3, Sun, Moon, Layers, HardDrive, Wrench
} from "lucide-react";
import { Subject, Chapter, UserQuestionsStore, UserProfile } from "../types";
import { ConfirmDialog } from "./admin/ConfirmDialog";
import { deleteSubject, deleteChapter, saveUserQuestionsStore, loadUserQuestionsStore, editQuestionInStore } from "../utils/questionsStorage";
import { AdminSectionLoader } from "./admin/AdminSkeletonLoaders";
import type { SyncProgressState } from "./admin/SyncProgressModal";
import { clearUserProfile } from "../utils/userProfileStorage";
import { 
  getStaffRole, 
  isSuperAdminRole
} from "../utils/rbac";
import { getCombinedSubjects, getCombinedChapters, getCombinedQuestions } from "../utils/questionsStorage";
import { loadLocalPYQPapers } from "../utils/pyqStorage";
import { loadLocalLiveTests } from "../utils/liveTestStorage";
import { triggerAdminToast } from "../utils/adminToast";
import { supabase } from "../lib/supabase";
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
        throw new Error(`Admin subcomponent '${exportName || "default"}' not found`);
      }
      return { default: component };
    })
  ) as unknown as T;
}

// Lazy Loaded Admin Modules
const AdminDashboardSection = adminSafeLazy<any>(() => import("./admin/AdminDashboardSection"), "AdminDashboardSection");
const AdminAnalyticsDashboard = adminSafeLazy<any>(() => import("./admin/AdminAnalyticsDashboard"), "AdminAnalyticsDashboard");
const AdminSyllabusSection = adminSafeLazy<any>(() => import("./admin/AdminSyllabusSection"), "AdminSyllabusSection");
const AdminNewsSection = adminSafeLazy<any>(() => import("./admin/AdminNewsSectionV2"), "AdminNewsSection");
const AdminBannerManagementSection = adminSafeLazy<any>(() => import("./admin/AdminBannerManagementSection"), "AdminBannerManagementSection");
const AdminUserManagementSection = adminSafeLazy<any>(() => import("./admin/AdminUserManagementSection"), "AdminUserManagementSection");
const AdminMessagesSection = adminSafeLazy<any>(() => import("./admin/AdminMessagesSection"), "AdminMessagesSection");
const AdminNotificationBroadcastSection = adminSafeLazy<any>(() => import("./admin/AdminNotificationBroadcastSection"), "AdminNotificationBroadcastSection");
const SupabaseDataExplorer = adminSafeLazy<any>(() => import("./admin/SupabaseDataExplorer"), "SupabaseDataExplorer");
const SupabaseAuditConsole = adminSafeLazy<any>(() => import("./admin/SupabaseAuditConsole"), "SupabaseAuditConsole");
const ProductionStabilityPanel = adminSafeLazy<any>(() => import("./admin/ProductionStabilityPanel"), "ProductionStabilityPanel");
const SupabaseHealthPanel = adminSafeLazy<any>(() => import("./admin/SupabaseHealthPanel"), "SupabaseHealthPanel");
const SyncHealthMonitorPanel = adminSafeLazy<any>(() => import("./admin/SyncHealthMonitorPanel"), "SyncHealthMonitorPanel");
const CrashReportsSection = adminSafeLazy<any>(() => import("./admin/CrashReportsSection"), "CrashReportsSection");
const DishaAIDashboard = adminSafeLazy<any>(() => import("./admin/DishaAIDashboard"), "DishaAIDashboard");
const AIApiManagementSection = adminSafeLazy<any>(() => import("./admin/AIApiManagementSection"), "AIApiManagementSection");
const ExportDataWidget = adminSafeLazy<any>(() => import("./admin/ExportDataWidget"), "ExportDataWidget");
const BackupRestoreSection = adminSafeLazy<any>(() => import("./admin/BackupRestoreSection"), "BackupRestoreSection");
const AdminFeatureControlSection = adminSafeLazy<any>(() => import("./admin/AdminFeatureControlSection"), "AdminFeatureControlSection");
const SyncProgressModal = adminSafeLazy<any>(() => import("./admin/SyncProgressModal"), "SyncProgressModal");
const SyncConfirmationModal = adminSafeLazy<any>(() => import("./admin/SyncConfirmationModal"), "SyncConfirmationModal");
const QATestRunnerModal = adminSafeLazy<any>(() => import("./QATestRunnerModal"), "QATestRunnerModal");
const ManageCoachingHierarchyModal = adminSafeLazy<any>(() => import("./admin/ManageCoachingHierarchyModal"), "ManageCoachingHierarchyModal");
const ExcelCsvQuestionImporter = adminSafeLazy<any>(() => import("./admin/ExcelCsvQuestionImporter"), "ExcelCsvQuestionImporter");
const BulkQuestionDeleteModal = adminSafeLazy<any>(() => import("./admin/BulkQuestionDeleteModal"), "BulkQuestionDeleteModal");
const QuestionReportDesk = adminSafeLazy<any>(() => import("./admin/QuestionReportDesk"), "QuestionReportDesk");
const LiveBattleDashboard = adminSafeLazy<any>(() => import("./admin/LiveBattleDashboard"), "LiveBattleDashboard");
const DuplicateQuestionsHubModal = adminSafeLazy<any>(() => import("./admin/DuplicateQuestionsHubModal"), "DuplicateQuestionsHubModal");
const QuestionRecycleBinModal = adminSafeLazy<any>(() => import("./admin/QuestionRecycleBinModal"), "QuestionRecycleBinModal");
const StaffManagementSection = adminSafeLazy<any>(() => import("./admin/StaffManagementSection"), "StaffManagementSection");
const QuestionHealthAuditor = adminSafeLazy<any>(() => import("./admin/QuestionHealthAuditor"), "QuestionHealthAuditor");
const OutdatedQuestionArchiver = adminSafeLazy<any>(() => import("./admin/OutdatedQuestionArchiver"), "OutdatedQuestionArchiver");
const LeaderboardManagerSection = adminSafeLazy<any>(() => import("./admin/LeaderboardManagerSection"), "LeaderboardManagerSection");
const AppConfigMaintenanceSection = adminSafeLazy<any>(() => import("./admin/AppConfigMaintenanceSection"), "AppConfigMaintenanceSection");
const SubjectTopicAccuracyHeatmap = adminSafeLazy<any>(() => import("./admin/SubjectTopicAccuracyHeatmap"), "SubjectTopicAccuracyHeatmap");

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
  onExitAdmin?: () => void;
  onDeleteSubject?: (subjectId: string) => Promise<void>;
  onDeleteChapter?: (chapterId: string) => Promise<void>;
  onBulkDeleteQuestions?: (questionIds: string[]) => Promise<void> | void;
  onLogout?: () => void;
}

export type AdminPillar =
  | "dashboard"
  | "academic"
  | "tests"
  | "editorial"
  | "ai"
  | "system";

export type AdminGroupSection =
  | AdminPillar
  | "syllabus"
  | "questions"
  | "content-health"
  | "outdated-archiver"
  | "approval"
  | "staff"
  | "content"
  | "users"
  | "supabase"
  | "diagnostics"
  | "crashes"
  | "integrations"
  | "backup"
  | "settings";

function resolvePillarAndSubTab(input: string | null): { pillar: AdminPillar; subTab?: string } {
  if (!input) return { pillar: "dashboard", subTab: "overview" };
  const raw = input.toLowerCase().trim();

  switch (raw) {
    case "syllabus":
      return { pillar: "academic", subTab: "syllabus" };
    case "questions":
      return { pillar: "academic", subTab: "questions" };
    case "content-health":
    case "outdated-archiver":
    case "archiver":
      return { pillar: "academic", subTab: "qa" };
    case "approval":
      return { pillar: "academic", subTab: "qa" };
    case "tests":
    case "mocks":
      return { pillar: "tests", subTab: "mock" };
    case "battle":
    case "battles":
      return { pillar: "tests", subTab: "battle" };
    case "content":
    case "news":
    case "articles":
      return { pillar: "editorial", subTab: "news" };
    case "banners":
      return { pillar: "editorial", subTab: "banners" };
    case "users":
    case "students":
      return { pillar: "editorial", subTab: "directory" };
    case "reports":
    case "doubts":
      return { pillar: "editorial", subTab: "doubts" };
    case "staff":
    case "team":
      return { pillar: "system", subTab: "staff" };
    case "supabase":
    case "database":
      return { pillar: "system", subTab: "database" };
    case "diagnostics":
    case "crashes":
      return { pillar: "system", subTab: "crashes" };
    case "integrations":
    case "ai":
    case "tokens":
      return { pillar: "ai", subTab: "tokens" };
    case "backup":
    case "backups":
      return { pillar: "system", subTab: "backups" };
    case "settings":
    case "features":
      return { pillar: "system", subTab: "features" };
    case "academic":
    case "editorial":
    case "system":
    case "dashboard":
      return { pillar: raw as AdminPillar };
    default:
      return { pillar: "dashboard", subTab: "overview" };
  }
}

export const AdminTab: React.FC<AdminTabProps> = (props) => {
  const initialNav = React.useMemo(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const sec = searchParams.get("section");
      if (sec) return resolvePillarAndSubTab(sec);
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p.includes("/admin/database") || h.includes("#admin/database") || p.includes("/admin/supabase") || h.includes("#admin/supabase")) {
        return { pillar: "system" as AdminPillar, subTab: "database" };
      }
      if (p.includes("/admin/news") || h.includes("#admin/news")) {
        return { pillar: "editorial" as AdminPillar, subTab: "news" };
      }
      if (p.includes("/admin/content-health") || h.includes("#admin/content-health")) {
        return { pillar: "academic" as AdminPillar, subTab: "qa" };
      }
      if (p.includes("/admin/outdated") || h.includes("#admin/outdated")) {
        return { pillar: "academic" as AdminPillar, subTab: "qa" };
      }
      if (p.includes("/admin/syllabus") || h.includes("#admin/syllabus")) {
        return { pillar: "academic" as AdminPillar, subTab: "syllabus" };
      }
    }
    return { pillar: "dashboard" as AdminPillar, subTab: "overview" };
  }, []);

  const [activePillar, setActivePillar] = React.useState<AdminPillar>(initialNav.pillar);

  // Subtabs per pillar (clean, shallow hierarchy)
  const [subTabDashboard, setSubTabDashboard] = React.useState<"overview" | "analytics" | "heatmap">(
    initialNav.pillar === "dashboard" && initialNav.subTab ? (initialNav.subTab as any) : "overview"
  );
  const [subTabAcademic, setSubTabAcademic] = React.useState<"syllabus" | "questions" | "import" | "qa">(
    initialNav.pillar === "academic" && initialNav.subTab ? (initialNav.subTab as any) : "syllabus"
  );
  const [activeQATool, setActiveQATool] = React.useState<"duplicate" | "health" | "outdated" | "recycle" | "bulk">("health");
  const [subTabTests, setSubTabTests] = React.useState<"mock" | "battle">(
    initialNav.pillar === "tests" && initialNav.subTab ? (initialNav.subTab as any) : "mock"
  );
  const [subTabEditorial, setSubTabEditorial] = React.useState<"news" | "banners" | "directory" | "doubts" | "notifications" | "messages">(
    initialNav.pillar === "editorial" && initialNav.subTab ? (initialNav.subTab as any) : "news"
  );
  const [subTabAI, setSubTabAI] = React.useState<"tokens" | "keys">(
    initialNav.pillar === "ai" && initialNav.subTab ? (initialNav.subTab as any) : "tokens"
  );
  const [subTabSystem, setSubTabSystem] = React.useState<"database" | "features" | "staff" | "crashes" | "backups">(
    initialNav.pillar === "system" && initialNav.subTab ? (initialNav.subTab as any) : "database"
  );
  const [dbToolView, setDbToolView] = React.useState<"overview" | "explorer" | "sync">("overview");
  const [staffOrLeaderboard, setStaffOrLeaderboard] = React.useState<"staff" | "leaderboard">("staff");
  const [featureOrConfig, setFeatureOrConfig] = React.useState<"features" | "config">("features");

  // Layout & Theme State
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggleTheme = () => {
    if (typeof document !== "undefined") {
      const next = !document.documentElement.classList.contains("dark");
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("disha_theme", next ? "dark" : "light");
      } catch {}
      setIsDark(next);
    }
  };

  // Modals
  const [selectedUserForDetails, setSelectedUserForDetails] = React.useState<UserProfile | null>(null);
  const [showQATestRunner, setShowQATestRunner] = React.useState(false);
  const [showCoachingHierarchyModal, setShowCoachingHierarchyModal] = React.useState(false);
  const [showExcelCsvImporter, setShowExcelCsvImporter] = React.useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = React.useState(false);
  const [showRecycleBinModal, setShowRecycleBinModal] = React.useState(false);
  const [showDuplicateHubModal, setShowDuplicateHubModal] = React.useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = React.useState(false);
  const adminMenuRef = React.useRef<HTMLDivElement>(null);

  const [cloudAuthState, setCloudAuthState] = React.useState<{
    checked: boolean;
    hasActiveSession: boolean;
    userEmail: string | null;
  }>({ checked: false, hasActiveSession: false, userEmail: null });

  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<{
    type: "subject" | "chapter";
    id: string;
    title: string;
  } | null>(null);
  const [isDeletingCloud, setIsDeletingCloud] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<SyncProgressState | null>(null);

  React.useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setCloudAuthState({
          checked: true,
          hasActiveSession: Boolean(session?.user),
          userEmail: session?.user?.email || null,
        });
      }
    }).catch(() => {
      if (mounted) setCloudAuthState({ checked: true, hasActiveSession: false, userEmail: null });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setCloudAuthState({
          checked: true,
          hasActiveSession: Boolean(session?.user),
          userEmail: session?.user?.email || null,
        });
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminMenuOpen(false);
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAdminMenuOpen]);

  // Data Calculations
  const combinedSubjectsList = React.useMemo(() => {
    return props.subjects && props.subjects.length > 0
      ? props.subjects
      : getCombinedSubjects(props.questionsStore);
  }, [props.subjects, props.questionsStore]);

  const combinedChaptersList = React.useMemo(() => {
    return props.chapters && props.chapters.length > 0
      ? props.chapters
      : getCombinedChapters(props.questionsStore);
  }, [props.chapters, props.questionsStore]);

  const totalQuestionsCount = React.useMemo(() => {
    return combinedChaptersList.reduce((acc, ch) => {
      return acc + (ch.topics || []).reduce((tAcc, t) => tAcc + (t.questions || []).length, 0);
    }, 0);
  }, [combinedChaptersList]);

  const testsStats = React.useMemo(() => {
    let lt: any[] = [];
    let pyq: any[] = [];
    let pyqQCount = 0;
    try { lt = loadLocalLiveTests(); } catch {}
    try {
      pyq = loadLocalPYQPapers();
      pyqQCount = pyq.reduce((acc, p) => acc + (p.questions?.length || 0), 0);
    } catch {}

    const now = new Date();
    const liveActiveCount = lt.filter((t) => {
      if (!t.isActive) return false;
      const start = new Date(t.startTime);
      const end = new Date(t.endTime);
      return now >= start && now <= end;
    }).length;

    return {
      liveTestsTotal: lt.length,
      liveActiveCount,
      pyqTotal: pyq.length,
      pyqQuestionsTotal: pyqQCount,
    };
  }, []);

  const staffRole = React.useMemo(() => getStaffRole(props.userProfile), [props.userProfile]);
  const isSuperAdmin = React.useMemo(() => isSuperAdminRole(props.userProfile), [props.userProfile]);

  const handleSelectPillar = (pillar: AdminPillar, subTab?: string) => {
    setActivePillar(pillar);
    if (subTab) {
      if (pillar === "dashboard") setSubTabDashboard(subTab as any);
      if (pillar === "academic") setSubTabAcademic(subTab as any);
      if (pillar === "tests") setSubTabTests(subTab as any);
      if (pillar === "editorial") setSubTabEditorial(subTab as any);
      if (pillar === "ai") setSubTabAI(subTab as any);
      if (pillar === "system") setSubTabSystem(subTab as any);
    }
    setIsSidebarOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", pillar);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleAdminSignOut = async () => {
    setIsAdminMenuOpen(false);
    setIsSidebarOpen(false);
    try { await supabase.auth.signOut(); } catch {}
    clearUserProfile();
    if (props.onLogout) {
      props.onLogout();
    } else if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const getSyncCost = () => {
    const customQ = props.questionsStore?.customQuestions?.length || 0;
    const customC = props.questionsStore?.customChapters?.length || 0;
    const customT = props.questionsStore?.customTopics?.length || 0;
    return customQ + customC + customT;
  };

  const handleSyncInit = () => setShowConfirm(true);

  const handleSyncClick = async () => {
    setShowConfirm(false);
    if (props.onSyncToCloud) {
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
        currentStatusMessage: "Validating data records and preparing Supabase sync...",
        errorDetails: []
      };
      setSyncProgress(initialProgress);

      try {
        const { executeSupabaseBulkSync } = await import("../utils/supabaseSyncService");
        const report = await executeSupabaseBulkSync(props.questionsStore, (p) => setSyncProgress(p));
        if (report.success) {
          triggerAdminToast("success", "Cloud Sync Complete", "All questions and chapters synchronized with Supabase!");
        }
      } catch (err: any) {
        setSyncProgress({
          status: "error",
          totalRecords: 0,
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
          currentStatusMessage: `Sync failed: ${err.message || "Unknown error"}`,
          errorDetails: [err.message || "Unknown error"]
        });
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeletingCloud(true);
    const { id, title, type } = deleteConfirmTarget;
    try {
      if (type === "subject") {
        if (props.onDeleteSubject) {
          await props.onDeleteSubject(id);
        } else {
          const { deleteSubjectFromSupabase } = await import("../utils/supabaseSyncService");
          const res = await deleteSubjectFromSupabase(id);
          const nextStore = deleteSubject(props.questionsStore, id);
          saveUserQuestionsStore(nextStore);
          props.onStoreUpdated?.(nextStore);
          if (!res.success) throw new Error(res.message);
        }
        triggerAdminToast("delete", "Subject Deleted", `Subject "${title}" has been removed.`);
      } else {
        if (props.onDeleteChapter) {
          await props.onDeleteChapter(id);
        } else {
          const { deleteChapterFromSupabase } = await import("../utils/supabaseSyncService");
          const res = await deleteChapterFromSupabase(id);
          const nextStore = deleteChapter(props.questionsStore, id);
          saveUserQuestionsStore(nextStore);
          props.onStoreUpdated?.(nextStore);
          if (!res.success) throw new Error(res.message);
        }
        triggerAdminToast("delete", "Chapter Deleted", `Chapter "${title}" has been removed.`);
      }
    } catch (e: any) {
      triggerAdminToast("error", "Delete Failed", e.message || "Could not delete from cloud.");
    } finally {
      setIsDeletingCloud(false);
      setDeleteConfirmTarget(null);
    }
  };

  // 6 Executive Pillars
  const executivePillars: {
    id: AdminPillar;
    shortTitle: string;
    title: string;
    subtitle: string;
    icon: any;
    badge?: string;
    category: "Core Operations" | "Exams & Community" | "AI & Infrastructure";
  }[] = [
    {
      id: "dashboard",
      shortTitle: "Overview",
      title: "Dashboard & Metrics",
      subtitle: "Live KPIs, analytics, accuracy heatmap & 21 category matrix",
      icon: LayoutDashboard,
      category: "Core Operations"
    },
    {
      id: "academic",
      shortTitle: "Academic",
      title: "Academic Hub",
      subtitle: "Syllabus tree, question bank, unified import & QA station",
      icon: BookOpen,
      badge: `${totalQuestionsCount}`,
      category: "Core Operations"
    },
    {
      id: "tests",
      shortTitle: "Tests",
      title: "Tests & Battles",
      subtitle: "Mock test series, PYQ vault, coaching & live battle arena",
      icon: Trophy,
      badge: testsStats.liveActiveCount > 0 ? `${testsStats.liveActiveCount} Live` : undefined,
      category: "Exams & Community"
    },
    {
      id: "editorial",
      shortTitle: "Community",
      title: "Editorial & Learners",
      subtitle: "Articles CMS, app banners, students, doubt desk & broadcasts",
      icon: Users,
      category: "Exams & Community"
    },
    {
      id: "ai",
      shortTitle: "Disha AI",
      title: "Disha AI Engine",
      subtitle: "Real-time token analytics & Gemini API key rotation",
      icon: Bot,
      category: "AI & Infrastructure"
    },
    {
      id: "system",
      shortTitle: "System",
      title: "Cloud & System",
      subtitle: "Supabase database, feature toggles, staff RBAC & backups",
      icon: Settings,
      category: "AI & Infrastructure"
    }
  ];

  const currentPillarMeta = executivePillars.find((p) => p.id === activePillar) || executivePillars[0];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 font-sans selection:bg-[#7045D8] selection:text-white transition-colors duration-200">
      
      {/* ===================================================================== */}
      {/* 1. DESKTOP FULL-HEIGHT SIDEBAR (lg+)                                  */}
      {/* ===================================================================== */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen border-r border-slate-200 dark:border-[#31275E] bg-white dark:bg-[#1B1536] transition-all duration-200 z-30 ${
          isSidebarCollapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/80 dark:border-[#31275E]">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7045D8] to-[#5B32BF] flex items-center justify-center shadow-sm shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white truncate">
                    Disha Admin
                  </span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#7045D8]/10 text-[#7045D8] dark:bg-[#A78BFA]/15 dark:text-[#A78BFA]">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {isSuperAdmin ? "Super Admin" : staffRole || "Console"}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#241D48] transition-colors cursor-pointer mx-auto"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5" aria-label="Admin Sidebar Navigation">
          {(["Core Operations", "Exams & Community", "AI & Infrastructure"] as const).map((cat) => {
            const items = executivePillars.filter((p) => p.category === cat);
            return (
              <div key={cat} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {cat}
                  </p>
                )}
                {items.map((pillar) => {
                  const Icon = pillar.icon;
                  const isActive = activePillar === pillar.id;
                  return (
                    <button
                      key={pillar.id}
                      onClick={() => handleSelectPillar(pillar.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer min-h-[42px] ${
                        isActive
                          ? "bg-[#7045D8] text-white shadow-sm font-bold"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48] font-semibold"
                      }`}
                      title={pillar.title}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                      {!isSidebarCollapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0 text-left">
                          <span className="text-xs truncate">{pillar.title}</span>
                          {pillar.badge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-300"
                            }`}>
                              {pillar.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Student App Switcher */}
        {props.onExitAdmin && (
          <div className="p-3 border-t border-slate-200/80 dark:border-[#31275E]">
            <button
              onClick={props.onExitAdmin}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-[#7045D8]/10 hover:text-[#7045D8] dark:hover:text-[#A78BFA] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer min-h-[40px]"
              title="Return to Student App"
            >
              <Home className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Student App</span>}
            </button>
          </div>
        )}
      </aside>

      {/* ===================================================================== */}
      {/* 2. MOBILE SLIDE-OVER DRAWER (< lg)                                    */}
      {/* ===================================================================== */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] bg-white dark:bg-[#1B1536] h-full shadow-2xl flex flex-col border-r border-slate-200 dark:border-[#31275E] z-10 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-[#31275E]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7045D8] to-[#5B32BF] flex items-center justify-center">
                  <ShieldCheck className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <p className="font-black text-sm text-slate-900 dark:text-white">Disha Console</p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Admin Navigation</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#241D48] cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-5">
              {(["Core Operations", "Exams & Community", "AI & Infrastructure"] as const).map((cat) => {
                const items = executivePillars.filter((p) => p.category === cat);
                return (
                  <div key={cat} className="space-y-1">
                    <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {cat}
                    </p>
                    {items.map((pillar) => {
                      const Icon = pillar.icon;
                      const isActive = activePillar === pillar.id;
                      return (
                        <button
                          key={pillar.id}
                          onClick={() => handleSelectPillar(pillar.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
                            isActive
                              ? "bg-[#7045D8] text-white shadow-sm font-bold"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#241D48] font-semibold"
                          }`}
                        >
                          <Icon className="w-4.5 h-4.5 shrink-0" />
                          <span className="text-xs flex-1 text-left">{pillar.title}</span>
                          {pillar.badge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-300"
                            }`}>
                              {pillar.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-[#31275E] space-y-2">
              {props.onExitAdmin && (
                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    props.onExitAdmin?.();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] font-bold text-xs min-h-[42px] cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Return to Student App</span>
                </button>
              )}
              <button
                onClick={handleAdminSignOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs min-h-[42px] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. MAIN WORKSPACE COLUMN                                              */}
      {/* ===================================================================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* UNIFIED TOP BAR (Safe-area aware for Android + clean on Web) */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] pt-[env(safe-area-inset-top,0px)]">
          <div className="px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 max-w-6xl mx-auto w-full">
            {/* Left: Mobile Menu + Active Pillar Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-[#31275E] shrink-0 cursor-pointer active:scale-95 transition-all"
                aria-label="Open menu"
              >
                <Menu className="w-4.5 h-4.5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {currentPillarMeta.title}
                  </h1>
                  <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7045D8]/10 text-[#7045D8] dark:bg-[#A78BFA]/15 dark:text-[#A78BFA] border border-[#7045D8]/20">
                    v1.0.71
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden md:block">
                  {currentPillarMeta.subtitle}
                </p>
              </div>
            </div>

            {/* Right: Student App + Cloud Sync + Theme + Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {props.onExitAdmin && (
                <button
                  onClick={props.onExitAdmin}
                  className="flex items-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-[#7045D8]/10 hover:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] border border-[#7045D8]/20 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                  title="Switch to Student App"
                >
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Student App</span>
                </button>
              )}

              {props.onSyncToCloud && (
                <button
                  onClick={handleSyncInit}
                  className="flex items-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                  title="Sync to Supabase Cloud"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">Cloud Sync</span>
                </button>
              )}

              <button
                onClick={toggleTheme}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-700 dark:text-[#A78BFA] cursor-pointer active:scale-95 transition-all"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-[#7045D8]" />}
              </button>

              <div className="relative" ref={adminMenuRef}>
                <button
                  onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                  className="flex items-center gap-1.5 h-9 sm:h-10 pl-1.5 pr-2 sm:pr-2.5 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer"
                  aria-label="Admin Account Menu"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-[#7045D8] to-[#A78BFA] text-white flex items-center justify-center font-black text-xs">
                    {props.userProfile?.name?.charAt(0) || "A"}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 hidden sm:block" />
                </button>

                {isAdminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] shadow-xl p-2 z-50">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-[#31275E] mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {props.userProfile?.name || "Administrator"}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {props.userProfile?.email || "admin@dishapyq.com"}
                      </p>
                    </div>

                    {props.onExitAdmin && (
                      <button
                        onClick={() => {
                          setIsAdminMenuOpen(false);
                          props.onExitAdmin?.();
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#241D48] rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Home className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
                        <span>Return to Student App</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        setShowQATestRunner(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#241D48] rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Automated QA Runner</span>
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-[#31275E] my-1" />

                    <button
                      onClick={handleAdminSignOut}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <AdminQuotaAlert />

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10">
          <div className="max-w-6xl mx-auto space-y-5">

            {/* ============================================================== */}
            {/* PILLAR 1: DASHBOARD & METRICS                                  */}
            {/* ============================================================== */}
            {activePillar === "dashboard" && (
              <div className="space-y-5">
                {/* Clean Single-Row Subtab Bar */}
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-x-auto no-scrollbar">
                  {[
                    { id: "overview", label: "KPI Summary" },
                    { id: "analytics", label: "Analytics" },
                    { id: "heatmap", label: "Accuracy Heatmap" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSubTabDashboard(tab.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        subTabDashboard === tab.id
                          ? "bg-[#7045D8] text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Dashboard..." />}>
                  {subTabDashboard === "overview" && (
                    <AdminDashboardSection
                      userProfile={props.userProfile}
                      subjects={combinedSubjectsList}
                      chapters={combinedChaptersList}
                      questionsStore={props.questionsStore}
                      onStoreUpdated={props.onStoreUpdated}
                      onShowAddQuestions={props.onShowAddQuestions}
                      onShowManageQuestions={props.onShowManageQuestions}
                      onShowManageSyllabus={props.onShowManageSyllabus}
                      onNavigateToGroup={(group: any) => {
                        const resolved = resolvePillarAndSubTab(group);
                        handleSelectPillar(resolved.pillar, resolved.subTab);
                      }}
                    />
                  )}
                  {subTabDashboard === "analytics" && <AdminAnalyticsDashboard />}
                  {subTabDashboard === "heatmap" && (
                    <SubjectTopicAccuracyHeatmap
                      subjects={combinedSubjectsList}
                      chapters={combinedChaptersList}
                      questionsStore={props.questionsStore}
                    />
                  )}
                </React.Suspense>
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 2: ACADEMIC HUB                                         */}
            {/* ============================================================== */}
            {activePillar === "academic" && (
              <div className="space-y-5">
                {/* Clean Subtab Bar */}
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-x-auto no-scrollbar">
                  {[
                    { id: "syllabus", label: "Syllabus Tree", icon: Layers },
                    { id: "questions", label: "Question Bank", icon: Database },
                    { id: "import", label: "Import Hub", icon: Upload },
                    { id: "qa", label: "QA & Health", icon: Stethoscope },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = subTabAcademic === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSubTabAcademic(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                          isActive
                            ? "bg-[#7045D8] text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 1. Syllabus Tree */}
                {subTabAcademic === "syllabus" && (
                  <React.Suspense fallback={<AdminSectionLoader type="list" title="Loading Syllabus Tree..." />}>
                    <AdminSyllabusSection
                      subjects={combinedSubjectsList}
                      chapters={combinedChaptersList}
                      questionsStore={props.questionsStore}
                      onShowAddSubject={props.onShowAddSubject}
                      onShowAddChapter={props.onShowAddChapter}
                      onShowAddTopic={props.onShowAddTopic}
                      onShowAddQuestions={props.onShowAddQuestions}
                      onShowManageQuestions={props.onShowManageQuestions}
                      onRequestDeleteSubject={(subjectId, subjectTitle) => {
                        setDeleteConfirmTarget({ type: "subject", id: subjectId, title: subjectTitle });
                      }}
                      onRequestDeleteChapter={(chapterId, chapterTitle) => {
                        setDeleteConfirmTarget({ type: "chapter", id: chapterId, title: chapterTitle });
                      }}
                    />
                  </React.Suspense>
                )}

                {/* 2. Question Bank (Clean, Zero Duplicate Buttons) */}
                {subTabAcademic === "questions" && (
                  <div className="space-y-5">
                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center">
                            <Database className="w-5 h-5" />
                          </div>
                          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                            Master Question Bank
                          </h2>
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA]">
                            {totalQuestionsCount.toLocaleString()} MCQs
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Search, inspect, edit, or filter MCQs across {combinedSubjectsList.length} subjects and {combinedChaptersList.length} chapters.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={props.onShowManageQuestions}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 min-h-[42px]"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Browse &amp; Edit MCQs</span>
                        </button>

                        <button
                          onClick={() => props.onShowAddQuestions(undefined, undefined, undefined, "paste")}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] text-slate-900 dark:text-white border border-slate-200 dark:border-[#31275E] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 min-h-[42px]"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
                          <span>Quick Add MCQ</span>
                        </button>
                      </div>
                    </div>

                    {/* Subject-wise Question Distribution */}
                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#31275E] shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Subject-wise MCQ Distribution
                        </h3>
                        <span className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA]">
                          {combinedSubjectsList.length} Subjects
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {combinedSubjectsList.map((subj) => {
                          const subjChapters = combinedChaptersList.filter((c) => c.subjectId === subj.id);
                          const subjQCount = subjChapters.reduce(
                            (acc, ch) => acc + (ch.topics || []).reduce((tAcc, t) => tAcc + (t.questions || []).length, 0),
                            0
                          );
                          return (
                            <div
                              key={subj.id}
                              className="p-3 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200/80 dark:border-[#31275E] flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate font-hindi">
                                  {subj.hindiName || subj.name}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {subjChapters.length} chapters · {subjQCount.toLocaleString()} MCQs
                                </p>
                              </div>
                              <button
                                onClick={() => props.onShowAddQuestions(undefined, undefined, subj.id, "paste")}
                                className="px-2.5 py-1.5 rounded-lg bg-[#7045D8]/10 hover:bg-[#7045D8] text-[#7045D8] hover:text-white dark:text-[#A78BFA] text-[11px] font-bold transition-colors shrink-0 cursor-pointer"
                              >
                                + Add
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Unified Import Hub */}
                {subTabAcademic === "import" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <FileSpreadsheet className="w-5.5 h-5.5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Excel / CSV</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Upload `.xlsx`, `.csv` or `.tsv` spreadsheets with automatic column mapping.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowExcelCsvImporter(true)}
                        className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                      >
                        Import Excel / CSV
                      </button>
                    </div>

                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="w-11 h-11 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center">
                          <Sparkles className="w-5.5 h-5.5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Smart Parser</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Paste raw Hindi or English text and let Disha AI structure MCQs and explanations.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={props.onShowAIImport}
                        className="mt-4 w-full py-2.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                      >
                        Launch AI Parser
                      </button>
                    </div>

                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                          <FileCode className="w-5.5 h-5.5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">HTML Importer</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Extract clean MCQs directly from HTML test files or web page markup.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={props.onShowHTMLImport}
                        className="mt-4 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                      >
                        Open HTML Parser
                      </button>
                    </div>

                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-200 flex items-center justify-center">
                          <PlusCircle className="w-5.5 h-5.5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Paste</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Paste formatted lines or manually author individual questions with hints.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => props.onShowAddQuestions(undefined, undefined, undefined, "paste")}
                        className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 dark:bg-[#241D48] hover:bg-slate-900 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                      >
                        Quick Add MCQ
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Content QA & Health Station */}
                {subTabAcademic === "qa" && (
                  <div className="space-y-5">
                    {/* Unified Action Grid for the 5 QA Tools */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                      <button
                        onClick={() => setActiveQATool("health")}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                          activeQATool === "health"
                            ? "bg-[#7045D8] text-white border-[#7045D8] shadow-sm"
                            : "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
                        }`}
                      >
                        <Activity className={`w-4.5 h-4.5 ${activeQATool === "health" ? "text-white" : "text-[#7045D8] dark:text-[#A78BFA]"}`} />
                        <span className="text-xs font-bold">Health Auditor</span>
                      </button>

                      <button
                        onClick={() => setActiveQATool("outdated")}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                          activeQATool === "outdated"
                            ? "bg-[#7045D8] text-white border-[#7045D8] shadow-sm"
                            : "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
                        }`}
                      >
                        <CalendarClock className={`w-4.5 h-4.5 ${activeQATool === "outdated" ? "text-white" : "text-amber-500"}`} />
                        <span className="text-xs font-bold">2024-25 Facts</span>
                      </button>

                      <button
                        onClick={() => setShowDuplicateHubModal(true)}
                        className="p-3 rounded-2xl border bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-amber-500 text-left transition-all cursor-pointer flex flex-col gap-1.5"
                      >
                        <ShieldAlert className="w-4.5 h-4.5 text-amber-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Duplicates (≥90%)</span>
                      </button>

                      <button
                        onClick={() => setShowRecycleBinModal(true)}
                        className="p-3 rounded-2xl border bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-sky-500 text-left transition-all cursor-pointer flex flex-col gap-1.5"
                      >
                        <ArchiveRestore className="w-4.5 h-4.5 text-sky-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Recycle Bin ({props.questionsStore?.recycleBinQuestions?.length || 0})
                        </span>
                      </button>

                      <button
                        onClick={() => setShowBulkDeleteModal(true)}
                        className="col-span-2 sm:col-span-1 p-3 rounded-2xl border bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-rose-500 text-left transition-all cursor-pointer flex flex-col gap-1.5"
                      >
                        <Trash2 className="w-4.5 h-4.5 text-rose-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Bulk Delete</span>
                      </button>
                    </div>

                    {activeQATool === "health" && (
                      <React.Suspense fallback={<AdminSectionLoader type="cards" title="Auditing Content Health..." />}>
                        <QuestionHealthAuditor
                          chapters={combinedChaptersList}
                          subjects={combinedSubjectsList}
                          questionsStore={props.questionsStore}
                          onStoreUpdated={props.onStoreUpdated}
                        />
                      </React.Suspense>
                    )}

                    {activeQATool === "outdated" && (
                      <React.Suspense fallback={<AdminSectionLoader type="cards" title="Checking Outdated Facts..." />}>
                        <OutdatedQuestionArchiver
                          chapters={combinedChaptersList}
                          subjects={combinedSubjectsList}
                          questionsStore={props.questionsStore}
                          onStoreUpdated={props.onStoreUpdated}
                        />
                      </React.Suspense>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 3: TESTS & BATTLE ARENA                                 */}
            {/* ============================================================== */}
            {activePillar === "tests" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs self-start">
                    <button
                      onClick={() => setSubTabTests("mock")}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        subTabTests === "mock"
                          ? "bg-[#7045D8] text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                      }`}
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>Mocks, PYQ &amp; Coaching</span>
                    </button>

                    <button
                      onClick={() => setSubTabTests("battle")}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        subTabTests === "battle"
                          ? "bg-[#7045D8] text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Live Battle Arena</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </button>
                  </div>
                </div>

                {subTabTests === "battle" ? (
                  <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Battle Telemetry..." />}>
                    <LiveBattleDashboard />
                  </React.Suspense>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                            <Timer className="w-5.5 h-5.5" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            {testsStats.liveActiveCount} Active
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Mock Tests</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Timed full-length exams with state ranking &amp; RPSC negative marking.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-[#31275E] text-xs flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Total Series:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{testsStats.liveTestsTotal} Tests</span>
                        </div>
                      </div>
                      <button
                        onClick={props.onShowManageLiveTests}
                        className="mt-5 w-full py-2.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                      >
                        Manage Live Tests
                      </button>
                    </div>

                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Archive className="w-5.5 h-5.5" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            {testsStats.pyqTotal} Papers
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">PYQ Paper Vault</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Official RPSC RAS, REET, Patwar &amp; Grade papers with answer keys.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-[#31275E] text-xs flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Total MCQs:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{testsStats.pyqQuestionsTotal} MCQs</span>
                        </div>
                      </div>
                      <button
                        onClick={props.onShowManagePYQVault}
                        className="mt-5 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                      >
                        Manage PYQ Vault
                      </button>
                    </div>

                    <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="w-11 h-11 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center">
                            <Building2 className="w-5.5 h-5.5" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Multi-Tenant
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Coaching Hierarchy</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Manage coaching institutes, student batches &amp; private test series.
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-[#31275E] text-xs flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Status:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">Active</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCoachingHierarchyModal(true)}
                        className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 dark:bg-[#241D48] hover:bg-slate-900 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                      >
                        Manage Institutes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 4: EDITORIAL & LEARNERS                                 */}
            {/* ============================================================== */}
            {activePillar === "editorial" && (
              <div className="space-y-5">
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-x-auto no-scrollbar">
                  {[
                    { id: "news", label: "Articles CMS" },
                    { id: "banners", label: "App Banners" },
                    { id: "directory", label: "Students" },
                    { id: "doubts", label: "Doubt Desk" },
                    { id: "notifications", label: "Broadcasts" },
                    { id: "messages", label: "Inquiries" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSubTabEditorial(tab.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        subTabEditorial === tab.id
                          ? "bg-[#7045D8] text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Community Tools..." />}>
                  {subTabEditorial === "news" && <AdminNewsSection onBackToAdmin={() => handleSelectPillar("dashboard")} />}
                  {subTabEditorial === "banners" && <AdminBannerManagementSection />}
                  {subTabEditorial === "directory" && (
                    <AdminUserManagementSection
                      initialSelectedUser={selectedUserForDetails}
                      onClearInitialUser={() => setSelectedUserForDetails(null)}
                    />
                  )}
                  {subTabEditorial === "doubts" && (
                    <QuestionReportDesk
                      questions={getCombinedQuestions(combinedChaptersList, props.questionsStore)}
                      subjects={combinedSubjectsList}
                      chapters={combinedChaptersList}
                      onUpdateQuestion={(updatedQ) => {
                        if (props.questionsStore) {
                          const updatedStore = editQuestionInStore(props.questionsStore, updatedQ);
                          saveUserQuestionsStore(updatedStore);
                          props.onStoreUpdated?.(updatedStore);
                          import("../utils/supabaseSyncService").then(({ upsertQuestionsToSupabase }) => {
                            upsertQuestionsToSupabase([updatedQ]).catch(console.warn);
                          });
                        }
                      }}
                    />
                  )}
                  {subTabEditorial === "notifications" && <AdminNotificationBroadcastSection />}
                  {subTabEditorial === "messages" && <AdminMessagesSection onBackToAdmin={() => handleSelectPillar("dashboard")} />}
                </React.Suspense>
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 5: DISHA AI ENGINE                                      */}
            {/* ============================================================== */}
            {activePillar === "ai" && (
              <div className="space-y-5">
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs self-start w-fit">
                  <button
                    onClick={() => setSubTabAI("tokens")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      subTabAI === "tokens"
                        ? "bg-[#7045D8] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Token Analytics</span>
                  </button>
                  <button
                    onClick={() => setSubTabAI("keys")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      subTabAI === "keys"
                        ? "bg-[#7045D8] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>API Key Rotation</span>
                  </button>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Disha AI..." />}>
                  {subTabAI === "tokens" ? <DishaAIDashboard /> : <AIApiManagementSection />}
                </React.Suspense>
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 6: CLOUD & SYSTEM SETTINGS                              */}
            {/* ============================================================== */}
            {activePillar === "system" && (
              <div className="space-y-5">
                {/* Flattened 5-tab bar (no crowded 8-tab overflow!) */}
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-x-auto no-scrollbar">
                  {[
                    { id: "database", label: "Cloud & Sync", icon: HardDrive },
                    { id: "features", label: "App & Features", icon: Wrench },
                    { id: "staff", label: "Staff & Ranks", icon: ShieldCheck },
                    { id: "crashes", label: "Crashes & QA", icon: Terminal },
                    { id: "backups", label: "Backups", icon: Archive },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = subTabSystem === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSubTabSystem(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                          isActive
                            ? "bg-[#7045D8] text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading System Tools..." />}>
                  {/* 1. Cloud & Sync */}
                  {subTabSystem === "database" && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "overview", label: "Cloud Health" },
                          { id: "explorer", label: "Tables Explorer" },
                          { id: "sync", label: "Sync & Audit" },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setDbToolView(t.id as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              dbToolView === t.id
                                ? "bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] border-[#7045D8]/30"
                                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {dbToolView === "overview" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          <ProductionStabilityPanel />
                          <SupabaseHealthPanel onBulkSync={handleSyncInit} />
                        </div>
                      )}
                      {dbToolView === "explorer" && <SupabaseDataExplorer userProfile={props.userProfile} />}
                      {dbToolView === "sync" && (
                        <div className="space-y-5">
                          <SyncHealthMonitorPanel
                            questionsStore={props.questionsStore}
                            onStoreUpdated={props.onStoreUpdated}
                            userProfile={props.userProfile}
                          />
                          <SupabaseAuditConsole userProfile={props.userProfile} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. App & Features (Feature Toggles + Maintenance Config) */}
                  {subTabSystem === "features" && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setFeatureOrConfig("features")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            featureOrConfig === "features"
                              ? "bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] border-[#7045D8]/30"
                              : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                          }`}
                        >
                          Feature Toggles &amp; Ads
                        </button>
                        <button
                          onClick={() => setFeatureOrConfig("config")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            featureOrConfig === "config"
                              ? "bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] border-[#7045D8]/30"
                              : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                          }`}
                        >
                          App Config &amp; Maintenance
                        </button>
                      </div>

                      {featureOrConfig === "features" ? (
                        <AdminFeatureControlSection adminEmail={cloudAuthState.userEmail || props.userProfile?.email || "admin"} />
                      ) : (
                        <AppConfigMaintenanceSection />
                      )}
                    </div>
                  )}

                  {/* 3. Staff & Ranks */}
                  {subTabSystem === "staff" && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setStaffOrLeaderboard("staff")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            staffOrLeaderboard === "staff"
                              ? "bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] border-[#7045D8]/30"
                              : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                          }`}
                        >
                          Staff &amp; RBAC Roles
                        </button>
                        <button
                          onClick={() => setStaffOrLeaderboard("leaderboard")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            staffOrLeaderboard === "leaderboard"
                              ? "bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] border-[#7045D8]/30"
                              : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                          }`}
                        >
                          Leaderboard Manager
                        </button>
                      </div>

                      {staffOrLeaderboard === "staff" ? (
                        <StaffManagementSection currentUserProfile={props.userProfile} />
                      ) : (
                        <LeaderboardManagerSection />
                      )}
                    </div>
                  )}

                  {/* 4. Crashes & QA */}
                  {subTabSystem === "crashes" && (
                    <div className="space-y-5">
                      <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#31275E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Automated QA Suite</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Verify parser schemas, question integrity, and runtime stability.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowQATestRunner(true)}
                          className="px-4 py-2.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all min-h-[40px]"
                        >
                          <Terminal className="w-4 h-4" />
                          <span>Launch QA Runner</span>
                        </button>
                      </div>
                      <CrashReportsSection />
                    </div>
                  )}

                  {/* 5. Backups & Export */}
                  {subTabSystem === "backups" && (
                    <div className="space-y-5">
                      <BackupRestoreSection userProfile={props.userProfile} />
                      <ExportDataWidget questionsStore={props.questionsStore} />
                    </div>
                  )}
                </React.Suspense>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ===================================================================== */}
      {/* 4. MODALS & DIALOGS                                                   */}
      {/* ===================================================================== */}
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

      {showExcelCsvImporter && (
        <React.Suspense fallback={null}>
          <ExcelCsvQuestionImporter
            subjects={combinedSubjectsList}
            chapters={combinedChaptersList}
            onClose={() => setShowExcelCsvImporter(false)}
            onImportQuestions={(newQuestions: any[], newTopic?: any) => {
              if (props.onStoreUpdated && props.questionsStore) {
                const currentCustom = props.questionsStore.customQuestions || [];
                const currentTopics = props.questionsStore.customTopics || [];
                const currentChapters = props.questionsStore.customChapters || [];

                const updatedTopics = [...currentTopics];
                if (newTopic && !updatedTopics.some(t => t.id === newTopic.id)) {
                  updatedTopics.push(newTopic);
                }

                const updatedChapters = [...currentChapters];
                if (newTopic) {
                  const chIdx = updatedChapters.findIndex(c => c.id === newTopic.chapterId);
                  if (chIdx !== -1) {
                    const exTopics = updatedChapters[chIdx].topics || [];
                    if (!exTopics.some(t => t.id === newTopic.id)) {
                      updatedChapters[chIdx] = {
                        ...updatedChapters[chIdx],
                        topics: [...exTopics, newTopic]
                      };
                    }
                  }
                }

                const updatedStore: UserQuestionsStore = {
                  ...props.questionsStore,
                  customQuestions: [...currentCustom, ...newQuestions],
                  customTopics: updatedTopics,
                  customChapters: updatedChapters
                };
                props.onStoreUpdated(updatedStore);
                saveUserQuestionsStore(updatedStore);
                triggerAdminToast(
                  "success",
                  "Excel Import Complete",
                  `${newQuestions.length} questions successfully imported and saved!`
                );
              }
            }}
          />
        </React.Suspense>
      )}

      {showBulkDeleteModal && (
        <React.Suspense fallback={null}>
          <BulkQuestionDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            subjects={combinedSubjectsList}
            chapters={combinedChaptersList}
            questionsStore={props.questionsStore}
            onBulkDeleteQuestions={props.onBulkDeleteQuestions}
            onStoreUpdated={props.onStoreUpdated}
            onOpenRecycleBin={() => {
              setShowBulkDeleteModal(false);
              setShowRecycleBinModal(true);
            }}
          />
        </React.Suspense>
      )}

      {showRecycleBinModal && (
        <React.Suspense fallback={null}>
          <QuestionRecycleBinModal
            isOpen={showRecycleBinModal}
            onClose={() => setShowRecycleBinModal(false)}
            subjects={combinedSubjectsList}
            chapters={combinedChaptersList}
            questionsStore={props.questionsStore}
            onStoreUpdated={props.onStoreUpdated}
          />
        </React.Suspense>
      )}

      {showDuplicateHubModal && (
        <React.Suspense fallback={null}>
          <DuplicateQuestionsHubModal
            isOpen={showDuplicateHubModal}
            onClose={() => setShowDuplicateHubModal(false)}
            chapters={combinedChaptersList}
            onQuestionsUpdated={() => {
              if (props.onStoreUpdated) {
                props.onStoreUpdated(loadUserQuestionsStore());
              }
            }}
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
        title={deleteConfirmTarget?.type === "subject" ? "Delete Subject from Supabase" : "Delete Chapter from Supabase"}
        message={
          deleteConfirmTarget?.type === "subject"
            ? `Are you sure you want to delete subject "${deleteConfirmTarget?.title}"? This will delete the subject and its associated chapters/topics from Supabase Database.`
            : `Are you sure you want to delete chapter "${deleteConfirmTarget?.title}"? This will delete the chapter and its associated topics/questions from Supabase Database.`
        }
        confirmText="Confirm Delete"
        cancelText="Cancel"
        isDeleting={isDeletingCloud}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeletingCloud) setDeleteConfirmTarget(null);
        }}
      />

      {/* ===================================================================== */}
      {/* 5. MOBILE BOTTOM NAVIGATION BAR (< lg)                                */}
      {/* ===================================================================== */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#31275E] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
        aria-label="Admin Mobile Navigation"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {executivePillars.slice(0, 4).map((pillar) => {
            const Icon = pillar.icon;
            const isActive = activePillar === pillar.id;
            return (
              <button
                key={pillar.id}
                onClick={() => handleSelectPillar(pillar.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer min-h-[48px] ${
                  isActive
                    ? "text-[#7045D8] dark:text-[#A78BFA] font-extrabold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold"
                }`}
              >
                <div className={`px-3 py-1 rounded-full transition-colors ${isActive ? "bg-[#7045D8]/12 dark:bg-[#7045D8]/25" : ""}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
                  {pillar.shortTitle}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer min-h-[48px] ${
              activePillar === "ai" || activePillar === "system"
                ? "text-[#7045D8] dark:text-[#A78BFA] font-extrabold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold"
            }`}
          >
            <div className={`px-3 py-1 rounded-full transition-colors ${activePillar === "ai" || activePillar === "system" ? "bg-[#7045D8]/12 dark:bg-[#7045D8]/25" : ""}`}>
              <Menu className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default AdminTab;
