import * as React from "react";
import { 
  BookOpen, Layers, LayoutDashboard, Users, Image as ImageIcon, Terminal, Flame, X, 
  FolderPlus, PlusCircle, Database, LayoutGrid, Settings, ShieldCheck, 
  Upload, Sparkles, Menu, ChevronRight, ChevronLeft, HardDrive, Activity, Cpu, RefreshCw, Newspaper,
  Trophy, CheckCircle2, ListFilter, ChevronDown, Trash2, AlertCircle, Building2,
  FileCode, Archive, LogOut, ArrowRight, Timer, FileText, FileSpreadsheet, Home, Bot, Swords, ShieldAlert,
  Crown, ArchiveRestore, FileCheck, GraduationCap, Headphones, AlertTriangle, CalendarClock,
  Search, ExternalLink, SlidersHorizontal, Stethoscope, RefreshCcw, BarChart3, HelpCircle
} from "lucide-react";
import { Subject, Chapter, UserQuestionsStore, UserProfile } from "../types";
import { ConfirmDialog } from "./admin/ConfirmDialog";
import { deleteSubject, deleteChapter, saveUserQuestionsStore, loadUserQuestionsStore, editQuestionInStore } from "../utils/questionsStorage";
import { AdminSectionLoader } from "./admin/AdminSkeletonLoaders";
import type { SyncProgressState } from "./admin/SyncProgressModal";
import { isUserAdmin, clearUserProfile } from "../utils/userProfileStorage";
import { 
  ROLE_CONFIGS, 
  getStaffRole, 
  isSuperAdminRole, 
  isStaffUser, 
  hasPermission 
} from "../utils/rbac";
import { getTotalDisplayCount, getCombinedSubjects, getCombinedChapters, getCombinedQuestions } from "../utils/questionsStorage";
import { loadLocalPYQPapers, getDeletedPYQIds } from "../utils/pyqStorage";
import { loadLocalLiveTests, getDeletedLiveTestIds } from "../utils/liveTestStorage";
import { getDeletedBannerIds } from "../utils/bannerStorage";
import { triggerAdminToast, AdminToastPayload } from "../utils/adminToast";
import { supabase } from "../lib/supabase";
import { AdminQuotaAlert } from "./admin/AdminQuotaAlert";
import { getOAuthRedirectUrl, openOAuthBrowser, performNativeGoogleLogin, isNativePlatform } from "../utils/mobileAuthService";

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

// Feature-wise On-Demand Lazy Loaded Admin Modules
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
const AdminDiagnosticsSection = adminSafeLazy<any>(() => import("./admin/AdminDiagnosticsSection"), "AdminDiagnosticsSection");
const DiagnosticReport = adminSafeLazy<any>(() => import("./admin/DiagnosticReport"), "DiagnosticReport");
const CrashReportsSection = adminSafeLazy<any>(() => import("./admin/CrashReportsSection"), "CrashReportsSection");
const DishaAIDashboard = adminSafeLazy<any>(() => import("./admin/DishaAIDashboard"), "DishaAIDashboard");
const AIApiManagementSection = adminSafeLazy<any>(() => import("./admin/AIApiManagementSection"), "AIApiManagementSection");
const ExportDataWidget = adminSafeLazy<any>(() => import("./admin/ExportDataWidget"), "ExportDataWidget");
const BackupRestoreSection = adminSafeLazy<any>(() => import("./admin/BackupRestoreSection"), "BackupRestoreSection");
const AuditLogWidget = adminSafeLazy<any>(() => import("./admin/AuditLogWidget"), "AuditLogWidget");
const AdminFeatureControlSection = adminSafeLazy<any>(() => import("./admin/AdminFeatureControlSection"), "AdminFeatureControlSection");
const SyncProgressModal = adminSafeLazy<any>(() => import("./admin/SyncProgressModal"), "SyncProgressModal");
const SyncConfirmationModal = adminSafeLazy<any>(() => import("./admin/SyncConfirmationModal"), "SyncConfirmationModal");
const QATestRunnerModal = adminSafeLazy<any>(() => import("./QATestRunnerModal"), "QATestRunnerModal");
const ManageCoachingHierarchyModal = adminSafeLazy<any>(() => import("./admin/ManageCoachingHierarchyModal"), "ManageCoachingHierarchyModal");
const ExcelCsvQuestionImporter = adminSafeLazy<any>(() => import("./admin/ExcelCsvQuestionImporter"), "ExcelCsvQuestionImporter");
const BulkQuestionDeleteModal = adminSafeLazy<any>(() => import("./admin/BulkQuestionDeleteModal"), "BulkQuestionDeleteModal");
const QuestionReportDesk = adminSafeLazy<any>(() => import("./admin/QuestionReportDesk"), "QuestionReportDesk");
const MeritListPdfModal = adminSafeLazy<any>(() => import("./admin/MeritListPdfModal"), "MeritListPdfModal");
const LiveBattleDashboard = adminSafeLazy<any>(() => import("./admin/LiveBattleDashboard"), "LiveBattleDashboard");
const DuplicateQuestionsHubModal = adminSafeLazy<any>(() => import("./admin/DuplicateQuestionsHubModal"), "DuplicateQuestionsHubModal");
const QuestionRecycleBinModal = adminSafeLazy<any>(() => import("./admin/QuestionRecycleBinModal"), "QuestionRecycleBinModal");
const StaffManagementSection = adminSafeLazy<any>(() => import("./admin/StaffManagementSection"), "StaffManagementSection");
const QuestionApprovalWorkflowSection = adminSafeLazy<any>(() => import("./admin/QuestionApprovalWorkflowSection"), "QuestionApprovalWorkflowSection");
const QuestionHealthAuditor = adminSafeLazy<any>(() => import("./admin/QuestionHealthAuditor"), "QuestionHealthAuditor");
const OutdatedQuestionArchiver = adminSafeLazy<any>(() => import("./admin/OutdatedQuestionArchiver"), "OutdatedQuestionArchiver");
const EnterpriseAdminCategoryGrid = adminSafeLazy<any>(() => import("./admin/EnterpriseAdminCategoryGrid"), "EnterpriseAdminCategoryGrid");
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

// 6 Core Executive Pillars for the Modernized Admin Panel
export type AdminPillar = 
  | "dashboard"  // 1. Executive Dashboard & Metrics
  | "academic"   // 2. Academic Hub (Syllabus, Questions, Imports, QA Station, Approval)
  | "tests"      // 3. Tests & Live Arena (Mock tests, PYQs, Coaching, Battles, Merit)
  | "editorial"  // 4. Editorial & Learners (Articles, Banners, Users, Doubts, Broadcasts, Messages)
  | "ai"         // 5. Disha AI Engine (Token Analytics, Gemini Key Rotation)
  | "system";    // 6. Cloud & System Settings (Supabase, Features, Config, Staff, Crashes, Backups)

// Backward-compatible type alias
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

// Helper to map any legacy URL query or path to the clean 6-pillar architecture
function resolvePillarAndSubTab(input: string | null): { pillar: AdminPillar; subTab?: string } {
  if (!input) return { pillar: "dashboard", subTab: "overview" };
  const raw = input.toLowerCase().trim();

  switch (raw) {
    case "syllabus":
      return { pillar: "academic", subTab: "syllabus" };
    case "questions":
      return { pillar: "academic", subTab: "questions" };
    case "content-health":
      return { pillar: "academic", subTab: "qa" };
    case "outdated-archiver":
    case "archiver":
      return { pillar: "academic", subTab: "qa" };
    case "approval":
      return { pillar: "academic", subTab: "approval" };
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
      return { pillar: "system", subTab: "diagnostics" };
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
  // Initial URL Parameter Resolver
  const initialNav = React.useMemo(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const sec = searchParams.get("section");
      if (sec) return resolvePillarAndSubTab(sec);
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p.includes("/admin/database") || h.includes("#admin/database") || p.includes("/admin/supabase") || h.includes("#admin/supabase")) return { pillar: "system" as AdminPillar, subTab: "database" };
      if (p.includes("/admin/news") || h.includes("#admin/news")) return { pillar: "editorial" as AdminPillar, subTab: "news" };
      if (p.includes("/admin/content-health") || h.includes("#admin/content-health")) return { pillar: "academic" as AdminPillar, subTab: "qa" };
      if (p.includes("/admin/outdated") || h.includes("#admin/outdated")) return { pillar: "academic" as AdminPillar, subTab: "qa" };
      if (p.includes("/admin/syllabus") || h.includes("#admin/syllabus")) return { pillar: "academic" as AdminPillar, subTab: "syllabus" };
    }
    return { pillar: "dashboard" as AdminPillar, subTab: "overview" };
  }, []);

  // Primary 6-Pillar Active State
  const [activePillar, setActivePillar] = React.useState<AdminPillar>(initialNav.pillar);

  // Pillar 1: Dashboard Subtabs
  const [subTabDashboard, setSubTabDashboard] = React.useState<"overview" | "analytics" | "heatmap" | "grid">(
    (initialNav.subTab as any) || "overview"
  );

  // Pillar 2: Academic Hub Subtabs
  const [subTabAcademic, setSubTabAcademic] = React.useState<"syllabus" | "questions" | "import" | "qa" | "approval">(
    (initialNav.subTab as any) || "syllabus"
  );
  // Content QA active subtool inside QA Station
  const [activeQATool, setActiveQATool] = React.useState<"duplicate" | "health" | "outdated" | "recycle" | "bulk">("duplicate");

  // Pillar 3: Tests & Battles Subtabs
  const [subTabTests, setSubTabTests] = React.useState<"mock" | "battle" | "hierarchy">(
    (initialNav.subTab as any) || "mock"
  );

  // Pillar 4: Editorial & Users Subtabs
  const [subTabEditorial, setSubTabEditorial] = React.useState<"news" | "banners" | "directory" | "doubts" | "notifications" | "messages">(
    (initialNav.subTab as any) || "news"
  );

  // Pillar 5: Disha AI Engine Subtabs
  const [subTabAI, setSubTabAI] = React.useState<"tokens" | "keys">(
    (initialNav.subTab as any) || "tokens"
  );

  // Pillar 6: Cloud & System Settings Subtabs
  const [subTabSystem, setSubTabSystem] = React.useState<"database" | "features" | "config" | "leaderboard" | "staff" | "crashes" | "backups" | "diagnostics">(
    (initialNav.subTab as any) || "database"
  );
  const [subTabSupabase, setSubTabSupabase] = React.useState<"overview" | "explorer" | "diagnostics" | "report" | "audit" | "sync">("overview");

  // Layout & Navigation State
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Modal Triggers
  const [selectedUserForDetails, setSelectedUserForDetails] = React.useState<UserProfile | null>(null);
  const [showQATestRunner, setShowQATestRunner] = React.useState(false);
  const [showCoachingHierarchyModal, setShowCoachingHierarchyModal] = React.useState(false);
  const [showExcelCsvImporter, setShowExcelCsvImporter] = React.useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = React.useState(false);
  const [showRecycleBinModal, setShowRecycleBinModal] = React.useState(false);
  const [showMeritListModal, setShowMeritListModal] = React.useState(false);
  const [showDuplicateHubModal, setShowDuplicateHubModal] = React.useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = React.useState(false);
  const adminMenuRef = React.useRef<HTMLDivElement>(null);

  // Cloud Auth State
  const [cloudAuthState, setCloudAuthState] = React.useState<{
    checked: boolean;
    hasActiveSession: boolean;
    userEmail: string | null;
  }>({
    checked: false,
    hasActiveSession: false,
    userEmail: null,
  });

  // Cloud Delete & Sync Confirmation State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<{
    type: "subject" | "chapter";
    id: string;
    title: string;
  } | null>(null);
  const [isDeletingCloud, setIsDeletingCloud] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<SyncProgressState | null>(null);

  // Authentication & Session Listener
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
      if (mounted) {
        setCloudAuthState({ checked: true, hasActiveSession: false, userEmail: null });
      }
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

  // Click outside admin menu dismissal
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

  // Combined Data calculations
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

  // Aggregated Test Statistics
  const testsStats = React.useMemo(() => {
    let lt: any[] = [];
    let pyq: any[] = [];
    let pyqQCount = 0;
    try {
      lt = loadLocalLiveTests();
    } catch {}
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

  // RBAC permissions for the logged-in staff
  const staffRole = React.useMemo(() => {
    return getStaffRole(props.userProfile);
  }, [props.userProfile]);

  const isSuperAdmin = React.useMemo(() => {
    return isSuperAdminRole(props.userProfile);
  }, [props.userProfile]);

  // Navigation Selection Handler
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

    // Update URL query smoothly without reloading
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", pillar);
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Sign out handler
  const handleAdminSignOut = async () => {
    setIsAdminMenuOpen(false);
    setIsSidebarOpen(false);
    try {
      await supabase.auth.signOut();
    } catch {}
    clearUserProfile();
    if (props.onLogout) {
      props.onLogout();
    } else if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  // Cloud Sync Handlers
  const getSyncCost = () => {
    const customQ = props.questionsStore?.customQuestions?.length || 0;
    const customC = props.questionsStore?.customChapters?.length || 0;
    const customT = props.questionsStore?.customTopics?.length || 0;
    return customQ + customC + customT;
  };

  const handleSyncInit = () => {
    setShowConfirm(true);
  };

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
          if (!res.success) {
            throw new Error(res.message);
          }
        }
        triggerAdminToast("delete", "Subject Deleted from Supabase", `Subject "${title}" has been removed.`);
      } else {
        if (props.onDeleteChapter) {
          await props.onDeleteChapter(id);
        } else {
          const { deleteChapterFromSupabase } = await import("../utils/supabaseSyncService");
          const res = await deleteChapterFromSupabase(id);
          const nextStore = deleteChapter(props.questionsStore, id);
          saveUserQuestionsStore(nextStore);
          props.onStoreUpdated?.(nextStore);
          if (!res.success) {
            throw new Error(res.message);
          }
        }
        triggerAdminToast("delete", "Chapter Deleted from Supabase", `Chapter "${title}" has been removed.`);
      }
    } catch (e: any) {
      triggerAdminToast("error", "Delete Failed", e.message || "Could not delete from cloud.");
    } finally {
      setIsDeletingCloud(false);
      setDeleteConfirmTarget(null);
    }
  };

  // 6 Primary Executive Pillars Definition
  const executivePillars: {
    id: AdminPillar;
    title: string;
    description: string;
    icon: any;
    badge?: string;
    category: "Core Operations" | "Academic & Community" | "Platform & Security";
  }[] = [
    {
      id: "dashboard",
      title: "Dashboard & Metrics",
      description: "Platform health, live activity, accuracy heatmap & category matrix",
      icon: LayoutDashboard,
      category: "Core Operations"
    },
    {
      id: "academic",
      title: "Academic Hub",
      description: "Syllabus, MCQs, Unified Import Hub, QA Station & Approval Queue",
      icon: BookOpen,
      badge: `${totalQuestionsCount}`,
      category: "Core Operations"
    },
    {
      id: "tests",
      title: "Tests & Battle Arena",
      description: "Live Mocks, PYQ Vault, Coaching Batches, 1v1 Telemetry & Merit Lists",
      icon: Trophy,
      badge: testsStats.liveActiveCount > 0 ? `${testsStats.liveActiveCount} Live` : undefined,
      category: "Academic & Community"
    },
    {
      id: "editorial",
      title: "Editorial & Learners",
      description: "Articles CMS, App Banners, Student Directory, Doubts & Broadcasts",
      icon: Newspaper,
      category: "Academic & Community"
    },
    {
      id: "ai",
      title: "Disha AI Engine",
      description: "Token analytics, query audit, latency logs & Gemini API key rotation",
      icon: Bot,
      category: "Platform & Security"
    },
    {
      id: "system",
      title: "Cloud & System Settings",
      description: "Postgres Explorer, Feature Toggles, Maintenance, Staff RBAC & Backups",
      icon: Settings,
      category: "Platform & Security"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#0E091D] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. TOP EXECUTIVE HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#16102E]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#2E2556] shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left: Mobile Toggle & Brand Emblem */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#800020] via-[#A81D37] to-[#F59E0B] p-0.5 shadow-xs flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                    Disha Console
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#800020]/10 text-[#800020] dark:bg-[#F59E0B]/15 dark:text-[#F59E0B] border border-[#800020]/20 dark:border-[#F59E0B]/30">
                    v1.0.69
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Super Admin Management Suite
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions, Sync Indicator, Return to Student App, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Direct 1-Tap "Return to Student App" */}
            {props.onExitAdmin && (
              <button
                onClick={props.onExitAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 shadow-2xs font-bold text-xs transition-all active:scale-95 cursor-pointer"
                title="Return to Student Application View"
              >
                <Home className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden xs:inline">Student App</span>
              </button>
            )}

            {/* Supabase Cloud Sync Button */}
            {props.onSyncToCloud && (
              <button
                onClick={handleSyncInit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs font-bold text-xs transition-all active:scale-95 cursor-pointer"
                title="Synchronize offline and staged changes with Supabase Database"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Cloud Sync</span>
              </button>
            )}

            {/* Profile & Session Dropdown */}
            <div className="relative" ref={adminMenuRef}>
              <button
                onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#800020] to-[#F59E0B] text-white flex items-center justify-center font-bold text-xs">
                  {props.userProfile?.name?.charAt(0) || "A"}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                    {props.userProfile?.name || "Administrator"}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    {staffRole || "Super Admin"}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {isAdminMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#1A1435] border border-slate-200 dark:border-[#352B63] shadow-xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {props.userProfile?.email || "admin@dishapyq.com"}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                      Role: {staffRole}
                    </p>
                  </div>

                  {props.onExitAdmin && (
                    <button
                      onClick={() => {
                        setIsAdminMenuOpen(false);
                        props.onExitAdmin?.();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl flex items-center gap-2"
                    >
                      <Home className="w-3.5 h-3.5 text-amber-500" />
                      <span>Back to Student App</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsAdminMenuOpen(false);
                      setShowQATestRunner(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl flex items-center gap-2"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Run Automated QA Suite</span>
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                  <button
                    onClick={handleAdminSignOut}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out of Console</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Quota Notification Banner if active */}
      <AdminQuotaAlert />

      {/* 2. BODY LAYOUT: SIDEBAR + MAIN CONTENT AREA */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* DESKTOP SIDEBAR */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 border-r border-[#E8D9C0] dark:border-[#2E2556] bg-white/70 dark:bg-[#140E2A]/70 backdrop-blur-sm transition-all duration-200 ${
            isSidebarCollapsed ? "w-20" : "w-64"
          }`}
        >
          {/* Sidebar Collapse Toggle */}
          <div className="p-3 flex justify-end border-b border-[#E8D9C0]/60 dark:border-[#2E2556]/60">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items Grouped by Category */}
          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            {(["Core Operations", "Academic & Community", "Platform & Security"] as const).map((category) => {
              const items = executivePillars.filter((p) => p.category === category);
              return (
                <div key={category} className="space-y-1">
                  {!isSidebarCollapsed && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3">
                      {category}
                    </span>
                  )}
                  {items.map((pillar) => {
                    const Icon = pillar.icon;
                    const isActive = activePillar === pillar.id;
                    return (
                      <button
                        key={pillar.id}
                        onClick={() => handleSelectPillar(pillar.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer ${
                          isActive
                            ? "bg-gradient-to-r from-[#800020] to-[#991B1E] text-white shadow-md font-bold"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                        }`}
                        title={pillar.title}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-amber-300" : "text-slate-500 dark:text-slate-400"}`} />
                        {!isSidebarCollapsed && (
                          <div className="flex-1 flex items-center justify-between min-w-0 text-left">
                            <span className="text-xs truncate">{pillar.title}</span>
                            {pillar.badge && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
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
          </div>

          {/* Return to App in Sidebar Bottom */}
          {props.onExitAdmin && !isSidebarCollapsed && (
            <div className="p-3 border-t border-[#E8D9C0]/60 dark:border-[#2E2556]/60">
              <button
                onClick={props.onExitAdmin}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 text-xs font-bold transition-all"
              >
                <Home className="w-4 h-4" />
                <span>Return to Student App</span>
              </button>
            </div>
          )}
        </aside>

        {/* MOBILE DRAWER OVERLAY */}
        {isSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="relative w-72 max-w-[80vw] bg-[#FDFBF7] dark:bg-[#140E2A] h-full shadow-2xl flex flex-col p-4 border-r border-[#E8D9C0] dark:border-[#2E2556] z-10">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="font-extrabold text-sm text-[#800020] dark:text-[#F59E0B]">
                  Admin Navigation
                </span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-4">
                {(["Core Operations", "Academic & Community", "Platform & Security"] as const).map((category) => {
                  const items = executivePillars.filter((p) => p.category === category);
                  return (
                    <div key={category} className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3">
                        {category}
                      </span>
                      {items.map((pillar) => {
                        const Icon = pillar.icon;
                        const isActive = activePillar === pillar.id;
                        return (
                          <button
                            key={pillar.id}
                            onClick={() => handleSelectPillar(pillar.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer ${
                              isActive
                                ? "bg-[#800020] text-white shadow-md font-bold"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${isActive ? "text-amber-300" : "text-slate-500"}`} />
                            <span className="text-xs flex-1 text-left">{pillar.title}</span>
                            {pillar.badge && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
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

              {props.onExitAdmin && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      props.onExitAdmin?.();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs"
                  >
                    <Home className="w-4 h-4" />
                    <span>Return to Student App</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. MAIN PILLAR CONTENT CANVAS */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-28 lg:pb-12">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Mobile Top Horizontal Quick Pillar Strip (lg:hidden) */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 touch-pan-x">
              {executivePillars.map((pillar) => {
                const Icon = pillar.icon;
                const isActive = activePillar === pillar.id;
                return (
                  <button
                    key={pillar.id}
                    onClick={() => handleSelectPillar(pillar.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[#800020] text-white shadow-xs"
                        : "bg-white dark:bg-[#1A1435] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#352B63]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{pillar.title.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* ============================================================== */}
            {/* PILLAR 1: DASHBOARD & METRICS                                  */}
            {/* ============================================================== */}
            {activePillar === "dashboard" && (
              <div className="space-y-6">
                {/* Header & Subtab Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Platform Executive Dashboard
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      High-level telemetry, accuracy heatmaps, category matrix & activity streams.
                    </p>
                  </div>

                  <div className="flex items-center p-1 bg-white dark:bg-[#1A1435] rounded-2xl border border-slate-200 dark:border-[#352B63] shadow-xs self-start sm:self-auto overflow-x-auto max-w-full">
                    {[
                      { id: "overview", label: "Overview KPI" },
                      { id: "analytics", label: "Analytics" },
                      { id: "heatmap", label: "Accuracy Heatmap" },
                      { id: "grid", label: "21 Institutional Grid" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSubTabDashboard(tab.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          subTabDashboard === tab.id
                            ? "bg-slate-900 dark:bg-[#800020] text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtab Content */}
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
                  {subTabDashboard === "grid" && (
                    <EnterpriseAdminCategoryGrid
                      subjects={combinedSubjectsList}
                      chapters={combinedChaptersList}
                      questionsStore={props.questionsStore}
                      onSelectSubject={() => handleSelectPillar("academic", "syllabus")}
                    />
                  )}
                </React.Suspense>
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 2: ACADEMIC HUB                                         */}
            {/* ============================================================== */}
            {activePillar === "academic" && (
              <div className="space-y-6">
                {/* Header & Academic Hub Subtabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Academic Content Hub
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Manage subjects, syllabus hierarchies, batch imports, content quality audits & review queue.
                    </p>
                  </div>

                  <div className="flex items-center p-1 bg-white dark:bg-[#1A1435] rounded-2xl border border-slate-200 dark:border-[#352B63] shadow-xs self-start sm:self-auto overflow-x-auto max-w-full">
                    {[
                      { id: "syllabus", label: "Syllabus Tree", icon: BookOpen },
                      { id: "questions", label: "Question Directory", icon: Database },
                      { id: "import", label: "Unified Import Hub", icon: Upload },
                      { id: "qa", label: "Content QA & Health", icon: Stethoscope },
                      { id: "approval", label: "Review Queue", icon: FileCheck },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = subTabAcademic === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setSubTabAcademic(tab.id as any)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            isActive
                              ? "bg-slate-900 dark:bg-[#800020] text-white shadow-xs"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subtab 1: Syllabus Tree */}
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

                {/* Subtab 2: Question Directory (Streamlined, Zero Duplicate Clutter) */}
                {subTabAcademic === "questions" && (
                  <div className="space-y-6">
                    {/* Clean Executive Action Banner */}
                    <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Database className="w-5 h-5 text-[#800020] dark:text-[#F59E0B]" />
                          <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Master Question Directory
                          </h2>
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {totalQuestionsCount.toLocaleString()} MCQs
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Search, inspect, edit, or filter active questions across all 21 RPSC / RSMSSB subjects.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={props.onShowManageQuestions}
                          className="px-4 py-2 bg-[#800020] hover:bg-[#991B1E] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Browse Repository</span>
                        </button>

                        <button
                          onClick={() => props.onShowAddQuestions(undefined, undefined, undefined, "paste")}
                          className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>+ Add New Question</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Access to Unified Import & QA Hub */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        onClick={() => setSubTabAcademic("import")}
                        className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              Unified Import Hub
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Batch import via Excel/CSV, AI Smart Parser, HTML or Quick Paste.
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </div>

                      <div
                        onClick={() => setSubTabAcademic("qa")}
                        className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Stethoscope className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              Content QA &amp; Health Station
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Duplicate Control (≥90%), Error Auditor, Outdated Facts &amp; Recycle Bin.
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab 3: Unified Import Hub (Replaces Scattered Import Buttons) */}
                {subTabAcademic === "import" && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                      <h2 className="text-base font-black text-slate-900 dark:text-white">
                        Unified Question Import Hub
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Choose your preferred ingestion pipeline. All formats support Hindi Unicode, RPSC 5-option format, and subject/chapter auto-tagging.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* 1. Excel / CSV Spreadsheet */}
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between hover:border-emerald-500 transition-all group">
                        <div className="space-y-3">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <FileSpreadsheet className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Excel / CSV Importer</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              Upload standard `.xlsx`, `.csv` or `.tsv` files. Column mapper automatically detects Question, Options A-E, and Explanation.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowExcelCsvImporter(true)}
                          className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Launch Excel Importer
                        </button>
                      </div>

                      {/* 2. AI Smart Parser */}
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between hover:border-amber-500 transition-all group">
                        <div className="space-y-3">
                          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Smart Parser</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              Paste raw unformatted text or PDF extracts in Hindi or English. Disha AI instantly structures questions, answers, and tags.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={props.onShowAIImport}
                          className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Open AI Parser
                        </button>
                      </div>

                      {/* 3. HTML Code / Web Importer */}
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between hover:border-orange-500 transition-all group">
                        <div className="space-y-3">
                          <div className="w-11 h-11 rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <FileCode className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">HTML File &amp; Code</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              Ingest questions directly from HTML web files, online test platforms, or DOM source tables with automated sanitization.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={props.onShowHTMLImport}
                          className="mt-4 w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Open HTML Parser
                        </button>
                      </div>

                      {/* 4. Quick Paste / Manual Builder */}
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between hover:border-[#800020] transition-all group">
                        <div className="space-y-3">
                          <div className="w-11 h-11 rounded-2xl bg-[#800020]/15 text-[#800020] dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <PlusCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Paste &amp; Manual</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              Paste formatted lines or type questions individually with complete formatting controls, hints, and explanations.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => props.onShowAddQuestions(undefined, undefined, undefined, "paste")}
                          className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Quick Add Questions
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab 4: Content QA & Health Station (Unified Station for 5 QA Tools) */}
                {subTabAcademic === "qa" && (
                  <div className="space-y-6">
                    {/* Tool Bar Switcher */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Stethoscope className="w-5 h-5 text-amber-500" />
                          <span>Content Quality Assurance &amp; Health Station</span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Detect similarity duplicates, audit question structure, archive outdated district data, or manage the recycle bin.
                        </p>
                      </div>

                      {/* Tool Tabs */}
                      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full">
                        {[
                          { id: "duplicate", label: "Duplicate Control (≥90%)", icon: ShieldAlert },
                          { id: "health", label: "Health Auditor", icon: Activity },
                          { id: "outdated", label: "2024-25 Outdated Facts", icon: CalendarClock },
                          { id: "recycle", label: `Recycle Bin (${props.questionsStore?.recycleBinQuestions?.length || 0})`, icon: ArchiveRestore },
                          { id: "bulk", label: "Bulk Delete", icon: Trash2 },
                        ].map((tool) => {
                          const Icon = tool.icon;
                          const isActive = activeQATool === tool.id;
                          return (
                            <button
                              key={tool.id}
                              onClick={() => {
                                setActiveQATool(tool.id as any);
                                if (tool.id === "duplicate") setShowDuplicateHubModal(true);
                                if (tool.id === "recycle") setShowRecycleBinModal(true);
                                if (tool.id === "bulk") setShowBulkDeleteModal(true);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                isActive
                                  ? "bg-white dark:bg-[#1A1435] text-slate-900 dark:text-white shadow-2xs"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{tool.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active QA Tool View */}
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
                      <React.Suspense fallback={<AdminSectionLoader type="cards" title="Analyzing Outdated Facts..." />}>
                        <OutdatedQuestionArchiver
                          chapters={combinedChaptersList}
                          subjects={combinedSubjectsList}
                          questionsStore={props.questionsStore}
                          onStoreUpdated={props.onStoreUpdated}
                        />
                      </React.Suspense>
                    )}

                    {/* Card overview when duplicate / recycle / bulk modal is triggerable */}
                    {(activeQATool === "duplicate" || activeQATool === "recycle" || activeQATool === "bulk") && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                              <ShieldAlert className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Duplicate Detection (≥90%)</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Scans the entire database with fuzzy string matching. Lets you merge duplicates, preserve high-quality explanations, and delete redundant entries.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowDuplicateHubModal(true)}
                            className="mt-4 w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            Launch Duplicate Hub
                          </button>
                        </div>

                        <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
                              <ArchiveRestore className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Question Recycle Bin</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Soft-deleted questions are staged here safely. Restore accidentally removed questions with 1-click or permanently purge trash.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowRecycleBinModal(true)}
                            className="mt-4 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            Open Recycle Bin ({props.questionsStore?.recycleBinQuestions?.length || 0})
                          </button>
                        </div>

                        <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center">
                              <Trash2 className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bulk Safe Delete</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Selectively remove large batches of obsolete questions by Subject, Chapter, or Topic with audit confirmations.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowBulkDeleteModal(true)}
                            className="mt-4 w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            Open Bulk Delete Tool
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 5: Teacher Review & Approval Workflow */}
                {subTabAcademic === "approval" && (
                  <React.Suspense fallback={<AdminSectionLoader type="list" title="Loading Approval Workflow..." />}>
                    <QuestionApprovalWorkflowSection
                      questionsStore={props.questionsStore}
                      subjects={combinedSubjectsList}
                      chapters={combinedChaptersList}
                      onStoreUpdated={props.onStoreUpdated}
                    />
                  </React.Suspense>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 3: TESTS & LIVE BATTLE ARENA                            */}
            {/* ============================================================== */}
            {activePillar === "tests" && (
              <div className="space-y-6">
                {/* Header & Subtab Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Examinations &amp; Live Battle Arena
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Full-length RPSC mock test schedules, PYQ papers vault, coaching tiers &amp; real-time battle telemetry.
                    </p>
                  </div>

                  <div className="flex items-center p-1 bg-white dark:bg-[#1A1435] rounded-2xl border border-slate-200 dark:border-[#352B63] shadow-xs self-start sm:self-auto overflow-x-auto max-w-full">
                    <button
                      onClick={() => setSubTabTests("mock")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        subTabTests === "mock"
                          ? "bg-slate-900 dark:bg-[#800020] text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>Mock Tests &amp; PYQs</span>
                    </button>

                    <button
                      onClick={() => setSubTabTests("battle")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        subTabTests === "battle"
                          ? "bg-gradient-to-r from-amber-600 to-[#800020] text-white shadow-xs font-extrabold"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5 text-amber-400" />
                      <span>Live Battle Telemetry</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </button>
                  </div>
                </div>

                {subTabTests === "battle" ? (
                  <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Live Battle Telemetry..." />}>
                    <LiveBattleDashboard />
                  </React.Suspense>
                ) : (
                  <>
                    {/* Top Action Bar for Tests */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => setShowMeritListModal(true)}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-200" />
                        <span>Merit PDF &amp; Telegram</span>
                      </button>

                      <button
                        onClick={() => setShowCoachingHierarchyModal(true)}
                        className="px-3.5 py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Coaching Hierarchy</span>
                      </button>

                      <button
                        onClick={props.onShowManagePYQVault}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ PYQ Paper</span>
                      </button>

                      <button
                        onClick={props.onShowManageLiveTests}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ Live Test</span>
                      </button>
                    </div>

                    {/* Clean Test Management Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Live Mock Tests Card */}
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-6 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between hover:border-rose-400 transition-all group">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <Timer className="w-6 h-6" />
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              {testsStats.liveActiveCount} Active
                            </span>
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Live Mock Examinations</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              Timed full-length examinations with state percentile scoring, RPSC negative marking &amp; instant merit generation.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
                            <span>Total Test Series:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{testsStats.liveTestsTotal} Tests</span>
                          </div>
                        </div>
                        <button
                          onClick={props.onShowManageLiveTests}
                          className="mt-6 w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Manage Live Tests
                        </button>
                      </div>

                      {/* PYQ Vault Card */}
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-6 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all group">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <Archive className="w-6 h-6" />
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              {testsStats.pyqTotal} Papers
                            </span>
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Official PYQ Paper Vault</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              RPSC RAS Pre, 1st/2nd Grade, Patwar, REET &amp; Police Constable previous year papers with official answer keys.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
                            <span>Total PYQ MCQs:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{testsStats.pyqQuestionsTotal} MCQs</span>
                          </div>
                        </div>
                        <button
                          onClick={props.onShowManagePYQVault}
                          className="mt-6 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Manage PYQ Papers
                        </button>
                      </div>

                      {/* Coaching Batches Card */}
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-6 border border-slate-200 dark:border-[#352B63] shadow-xs flex flex-col justify-between hover:border-indigo-400 transition-all group">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <Building2 className="w-6 h-6" />
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                              Enterprise
                            </span>
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Coaching Institutes &amp; Batches</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              Multi-tenant hierarchy to create private test series, batch-specific student rosters, and branded rank reports.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
                            <span>Status:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">Integrated</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowCoachingHierarchyModal(true)}
                          className="mt-6 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Manage Coaching Centers
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 4: EDITORIAL & LEARNERS                                 */}
            {/* ============================================================== */}
            {activePillar === "editorial" && (
              <div className="space-y-6">
                {/* Header & Subtabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Editorial Content &amp; Learner Community
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Publish exam notifications &amp; news, manage banners, student profiles, doubt desk &amp; push notifications.
                    </p>
                  </div>

                  <div className="flex items-center p-1 bg-white dark:bg-[#1A1435] rounded-2xl border border-slate-200 dark:border-[#352B63] shadow-xs self-start sm:self-auto overflow-x-auto max-w-full">
                    {[
                      { id: "news", label: "Articles CMS" },
                      { id: "banners", label: "App Banners" },
                      { id: "directory", label: "Student Directory" },
                      { id: "doubts", label: "Doubt Desk" },
                      { id: "notifications", label: "Push Broadcasts" },
                      { id: "messages", label: "Inquiries" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSubTabEditorial(tab.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          subTabEditorial === tab.id
                            ? "bg-slate-900 dark:bg-[#800020] text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Editorial..." />}>
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
                          if (props.onStoreUpdated) {
                            props.onStoreUpdated(updatedStore);
                          }
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
            {/* PILLAR 5: DISHA AI ENGINE & TOKEN ANALYTICS                   */}
            {/* ============================================================== */}
            {activePillar === "ai" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#800020] to-[#F59E0B] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Disha AI Engine &amp; Quota Manager
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Token telemetry, latency analytics, question explanation generator &amp; API key rotation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center p-1 bg-white dark:bg-[#1A1435] rounded-2xl border border-slate-200 dark:border-[#352B63] shadow-xs self-start sm:self-auto">
                    <button
                      onClick={() => setSubTabAI("tokens")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        subTabAI === "tokens"
                          ? "bg-slate-900 dark:bg-[#800020] text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Token Usage &amp; Logs</span>
                    </button>
                    <button
                      onClick={() => setSubTabAI("keys")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        subTabAI === "keys"
                          ? "bg-slate-900 dark:bg-[#800020] text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Gemini API Key Rotation</span>
                    </button>
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading Disha AI Telemetry..." />}>
                  {subTabAI === "tokens" ? <DishaAIDashboard /> : <AIApiManagementSection />}
                </React.Suspense>
              </div>
            )}

            {/* ============================================================== */}
            {/* PILLAR 6: CLOUD DATABASE & SYSTEM CONTROLS                     */}
            {/* ============================================================== */}
            {activePillar === "system" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Cloud Database &amp; System Settings
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      PostgreSQL Supabase explorer, client feature toggles, maintenance mode, staff RBAC &amp; backups.
                    </p>
                  </div>

                  <div className="flex items-center p-1 bg-white dark:bg-[#1A1435] rounded-2xl border border-slate-200 dark:border-[#352B63] shadow-xs self-start sm:self-auto overflow-x-auto max-w-full">
                    {[
                      { id: "database", label: "PostgreSQL Supabase" },
                      { id: "features", label: "Feature Toggles" },
                      { id: "config", label: "Maintenance Mode" },
                      { id: "leaderboard", label: "Leaderboard" },
                      { id: "staff", label: "Staff RBAC" },
                      { id: "crashes", label: "Crash Sentry" },
                      { id: "backups", label: "Disaster Recovery" },
                      { id: "diagnostics", label: "Diagnostics" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSubTabSystem(tab.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          subTabSystem === tab.id
                            ? "bg-slate-900 dark:bg-[#800020] text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <React.Suspense fallback={<AdminSectionLoader type="cards" title="Loading System Panel..." />}>
                  {/* PostgreSQL Supabase Explorer */}
                  {subTabSystem === "database" && (
                    <div className="space-y-6">
                      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full">
                        <button onClick={() => setSubTabSupabase("overview")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTabSupabase === "overview" ? "bg-white dark:bg-[#1A1435] text-slate-900 dark:text-white shadow-2xs" : "text-slate-500"}`}>Overview</button>
                        <button onClick={() => setSubTabSupabase("explorer")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTabSupabase === "explorer" ? "bg-white dark:bg-[#1A1435] text-slate-900 dark:text-white shadow-2xs" : "text-slate-500"}`}>Tables Explorer</button>
                        <button onClick={() => setSubTabSupabase("diagnostics")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTabSupabase === "diagnostics" ? "bg-white dark:bg-[#1A1435] text-slate-900 dark:text-white shadow-2xs" : "text-slate-500"}`}>Diagnostics</button>
                        <button onClick={() => setSubTabSupabase("report")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTabSupabase === "report" ? "bg-white dark:bg-[#1A1435] text-slate-900 dark:text-white shadow-2xs" : "text-slate-500"}`}>Row Counts</button>
                        <button onClick={() => setSubTabSupabase("audit")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTabSupabase === "audit" ? "bg-white dark:bg-[#1A1435] text-slate-900 dark:text-white shadow-2xs" : "text-slate-500"}`}>Audit Log</button>
                        <button onClick={() => setSubTabSupabase("sync")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTabSupabase === "sync" ? "bg-white dark:bg-[#1A1435] text-slate-900 dark:text-white shadow-2xs" : "text-slate-500"}`}>Sync Monitor</button>
                      </div>

                      {subTabSupabase === "overview" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <ProductionStabilityPanel />
                          <SupabaseHealthPanel onBulkSync={handleSyncInit} />
                        </div>
                      )}
                      {subTabSupabase === "explorer" && <SupabaseDataExplorer userProfile={props.userProfile} />}
                      {subTabSupabase === "diagnostics" && <AdminDiagnosticsSection userProfile={props.userProfile} subjects={combinedSubjectsList} chapters={combinedChaptersList} />}
                      {subTabSupabase === "report" && <DiagnosticReport userProfile={props.userProfile} />}
                      {subTabSupabase === "audit" && <SupabaseAuditConsole userProfile={props.userProfile} />}
                      {subTabSupabase === "sync" && <SyncHealthMonitorPanel questionsStore={props.questionsStore} onStoreUpdated={props.onStoreUpdated} userProfile={props.userProfile} />}
                    </div>
                  )}

                  {subTabSystem === "features" && (
                    <AdminFeatureControlSection adminEmail={cloudAuthState.userEmail || props.userProfile?.email || "admin"} />
                  )}

                  {subTabSystem === "config" && <AppConfigMaintenanceSection />}

                  {subTabSystem === "leaderboard" && <LeaderboardManagerSection />}

                  {subTabSystem === "staff" && (
                    <StaffManagementSection currentUserProfile={props.userProfile} />
                  )}

                  {subTabSystem === "crashes" && <CrashReportsSection />}

                  {subTabSystem === "backups" && (
                    <div className="space-y-6">
                      <BackupRestoreSection userProfile={props.userProfile} />
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <ExportDataWidget questionsStore={props.questionsStore} />
                      </div>
                    </div>
                  )}

                  {subTabSystem === "diagnostics" && (
                    <div className="space-y-6">
                      <div className="bg-white dark:bg-[#1A1435] rounded-3xl p-5 border border-slate-200 dark:border-[#352B63] flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">Automated QA Test Runner</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Run automated parser verifications, question schema checks, and memory profiling.</p>
                        </div>
                        <button
                          onClick={() => setShowQATestRunner(true)}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                        >
                          <Terminal className="w-4 h-4 text-emerald-400" />
                          <span>Launch QA Runner</span>
                        </button>
                      </div>
                      <DiagnosticReport userProfile={props.userProfile} />
                    </div>
                  )}
                </React.Suspense>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* 4. MODALS & SUBCOMPONENT DIALOGS */}
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

                let updatedTopics = [...currentTopics];
                if (newTopic && !updatedTopics.some(t => t.id === newTopic.id)) {
                  updatedTopics.push(newTopic);
                }

                let updatedChapters = [...currentChapters];
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

      {showMeritListModal && (
        <React.Suspense fallback={null}>
          <MeritListPdfModal
            testTitle="RPSC RAS / CET Live Mock Examination"
            onClose={() => setShowMeritListModal(false)}
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

      {/* 5. MOBILE FIXED BOTTOM ACTION BAR (lg:hidden) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#16102E]/95 backdrop-blur-md border-t border-[#E8D9C0] dark:border-[#2E2556] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 py-1 safe-area-pb"
        aria-label="Admin Mobile Navigation"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {executivePillars.slice(0, 5).map((pillar) => {
            const Icon = pillar.icon;
            const isActive = activePillar === pillar.id;
            return (
              <button
                key={pillar.id}
                onClick={() => handleSelectPillar(pillar.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer min-h-[46px] relative ${
                  isActive
                    ? "text-[#800020] dark:text-[#F59E0B] font-black"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div className={`p-1 rounded-lg transition-transform ${isActive ? "scale-110 bg-[#800020]/10 dark:bg-[#F59E0B]/15" : ""}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] tracking-tight truncate max-w-[56px]">
                  {pillar.title.split(" ")[0]}
                </span>
                {isActive && (
                  <span className="w-4 h-0.5 bg-[#800020] dark:bg-[#F59E0B] rounded-full mt-0.5" />
                )}
              </button>
            );
          })}

          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer min-h-[46px] ${
              activePillar === "system"
                ? "text-[#800020] dark:text-[#F59E0B] font-black"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <div className="p-1 rounded-lg">
              <Menu className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] tracking-tight">More</span>
            {activePillar === "system" && (
              <span className="w-4 h-0.5 bg-[#800020] dark:bg-[#F59E0B] rounded-full mt-0.5" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
};

export default AdminTab;
