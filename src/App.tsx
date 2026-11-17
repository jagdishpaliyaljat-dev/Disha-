import * as React from "react";
import { useQuestions } from './context/QuestionsContext';
import { useProgress } from './context/ProgressContext';
import { 
  ActiveTab, 
  AppSettings, 
  UserProfile, 
  MCQSession,
  Subject,
  Chapter,
  Question,
  QuestionProgress,
  ProgressStore,
  AppNotification,
} from './types';
import { 
  Home, 
  BookOpen, 
  Trophy, 
  Scan, 
  BarChart2, 
  User, 
  ShieldCheck, 
  Search, 
  Sun, 
  Moon, 
  LogIn, 
  Bell 
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastNotificationContainer, ToastMessage } from './components/ToastNotification';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { BrandSplashAndOnboarding } from './components/BrandSplashAndOnboarding';
import { AdminErrorBoundary } from './components/admin/AdminErrorBoundary';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { OverlayErrorBoundary } from './components/OverlayErrorBoundary';
import { NotFoundView } from './components/NotFoundView';
import { useNavigation } from './hooks/useNavigation';
import { useCurriculumManager } from './hooks/useCurriculumManager';
import { loadUserProfile, saveUserProfile, isUserAdmin } from './utils/userProfileStorage';
import { resolvePathToNavigationState, buildCanonicalPath, isKnownTab } from './utils/routeNavigation';
import { prefetchCoreRoutes } from './utils/routePrefetcher';
import { loadSettingsFromStorage, saveSettingsToStorage, loadProgressFromStorage, saveProgressToStorage, recordStudyAnswerToHistory, loadStudyHistoryFromStorage, saveStudyHistoryToStorage } from './utils/storage';
import { loadNotifications, saveNotifications } from './utils/notificationsStorage';
import { getTodayDateString, calculateNextProgress } from './utils/revision';
import { trackPageView } from './utils/analytics';
import { 
  loadUserQuestionsStore, 
  saveUserQuestionsStore, 
  getCombinedSubjects, 
  getCombinedChapters, 
  getCombinedQuestions, 
  getCombinedChaptersMap, 
  getCombinedQuestionsMap,
  addSubject, 
  editSubject, 
  deleteSubject, 
  editChapter, 
  deleteChapter, 
  editTopic, 
  deleteTopic, 
  bulkDeleteQuestions, 
  bulkMoveQuestions 
} from './utils/questionsStorage';
import {
  bufferProgressUpdate,
  bufferHistoryUpdate,
  flushStudentWriteBuffer,
  hasPendingStudentWrites,
  rehydrateStudentWriteBuffer,
} from './utils/studentWriteBuffer';

// Helper for resilient dynamic imports with clean React 19 reconciler compatibility and retry on chunk load failure
function safeLazy<T extends React.ComponentType<any>>(
  importFn: () => Promise<any>,
  exportName?: string
): T {
  return React.lazy(() =>
    importFn()
      .catch((err) => {
        console.warn('Dynamic import failed, retrying...', err);
        const errMsg = String(err?.message || '');
        const isChunkFail =
          errMsg.includes('dynamically imported module') ||
          errMsg.includes('Loading chunk') ||
          errMsg.includes('Failed to fetch') ||
          err?.name === 'ChunkLoadError';

        if (isChunkFail && typeof window !== 'undefined') {
          const RELOAD_KEY = 'disha_chunk_reload_lock';
          const lastReload = sessionStorage.getItem(RELOAD_KEY);
          if (!lastReload || Date.now() - Number(lastReload) > 15000) {
            sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
            if ('caches' in window) {
              caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).finally(() => {
                window.location.reload();
              });
              return new Promise(() => {});
            } else {
              window.location.reload();
              return new Promise(() => {});
            }
          }
        }
        return new Promise((resolve) => setTimeout(resolve, 800)).then(() => importFn());
      })
      .then((mod) => {
        const component = exportName ? mod[exportName] || mod.default : mod.default || Object.values(mod)[0];
        if (!component) {
          throw new Error(`Module export '${exportName || 'default'}' not found`);
        }
        return { default: component };
      })
  ) as unknown as T;
}

const HomeTab = safeLazy<typeof import('./components/HomeTab').HomeTab>(() => import('./components/HomeTab'), 'HomeTab');
const TopicsTab = safeLazy<typeof import('./components/TopicsTab').TopicsTab>(() => import('./components/TopicsTab'), 'TopicsTab');
const ProfileTab = safeLazy<typeof import('./components/ProfileTab').ProfileTab>(() => import('./components/ProfileTab'), 'ProfileTab');
const AdminTab = safeLazy<typeof import('./components/AdminTab').AdminTab>(() => import('./components/AdminTab'), 'AdminTab');
const PYQVaultTab = safeLazy<typeof import('./components/PYQVaultTab').PYQVaultTab>(() => import('./components/PYQVaultTab'), 'PYQVaultTab');
const LiveTestsTab = safeLazy<typeof import('./components/LiveTestsTab').LiveTestsTab>(() => import('./components/LiveTestsTab'), 'LiveTestsTab');
const WrongTab = safeLazy<typeof import('./components/WrongTab').WrongTab>(() => import('./components/WrongTab'), 'WrongTab');
const NotificationsPage = safeLazy<typeof import('./components/NotificationsPage').NotificationsPage>(() => import('./components/NotificationsPage'), 'NotificationsPage');
const AnalyticsTab = safeLazy<typeof import('./components/AnalyticsTab').AnalyticsTab>(() => import('./components/AnalyticsTab'), 'AnalyticsTab');
const NewsPage = safeLazy<typeof import('./components/news/NewsPage').NewsPage>(() => import('./components/news/NewsPage'), 'NewsPage');
const AboutPage = safeLazy<typeof import('./components/AboutPage').AboutPage>(() => import('./components/AboutPage'), 'AboutPage');
const PrivacyPolicyPage = safeLazy<typeof import('./components/PrivacyPolicyPage').PrivacyPolicyPage>(() => import('./components/PrivacyPolicyPage'), 'PrivacyPolicyPage');
const TermsOfServicePage = safeLazy<typeof import('./components/TermsOfServicePage').TermsOfServicePage>(() => import('./components/TermsOfServicePage'), 'TermsOfServicePage');
const ContactUsPage = safeLazy<typeof import('./components/ContactUsPage').ContactUsPage>(() => import('./components/ContactUsPage'), 'ContactUsPage');
const DisclaimerPage = safeLazy<typeof import('./components/DisclaimerPage').DisclaimerPage>(() => import('./components/DisclaimerPage'), 'DisclaimerPage');
const LoginPage = safeLazy<typeof import('./components/LoginPage').LoginPage>(() => import('./components/LoginPage'), 'LoginPage');
const AppSettingsModal = safeLazy<typeof import('./components/AppSettingsModal').AppSettingsModal>(() => import('./components/AppSettingsModal'), 'AppSettingsModal');
const ApiSettingsModal = safeLazy<typeof import('./components/ApiSettingsModal').ApiSettingsModal>(() => import('./components/ApiSettingsModal'), 'ApiSettingsModal');
const PDFExportModal = safeLazy<typeof import('./components/PDFExportModal').PDFExportModal>(() => import('./components/PDFExportModal'), 'PDFExportModal');
const FullExamModal = safeLazy<typeof import('./components/FullExamModal').FullExamModal>(() => import('./components/FullExamModal'), 'FullExamModal');
const CustomSmartTestModal = safeLazy<typeof import('./components/CustomSmartTestModal').CustomSmartTestModal>(() => import('./components/CustomSmartTestModal'), 'CustomSmartTestModal');
const MCQSessionModal = safeLazy<typeof import('./components/MCQSessionModal').MCQSessionModal>(() => import('./components/MCQSessionModal'), 'MCQSessionModal');
const ChapterDetailView = safeLazy<typeof import('./components/ChapterDetailView').ChapterDetailView>(() => import('./components/ChapterDetailView'), 'ChapterDetailView');
const ExamPaperAnalyzerModal = safeLazy<typeof import('./components/analyzer/ExamPaperAnalyzerModal').ExamPaperAnalyzerModal>(() => import('./components/analyzer/ExamPaperAnalyzerModal'), 'ExamPaperAnalyzerModal');
const AddSubjectModal = safeLazy<typeof import('./components/AddSubjectModal').AddSubjectModal>(() => import('./components/AddSubjectModal'), 'AddSubjectModal');
const AddChapterModal = safeLazy<typeof import('./components/AddChapterModal').AddChapterModal>(() => import('./components/AddChapterModal'), 'AddChapterModal');
const AddTopicModal = safeLazy<typeof import('./components/AddTopicModal').AddTopicModal>(() => import('./components/AddTopicModal'), 'AddTopicModal');
const AddQuestionsModal = safeLazy<typeof import('./components/AddQuestionsModal').AddQuestionsModal>(() => import('./components/AddQuestionsModal'), 'AddQuestionsModal');
const ManageSyllabusModal = safeLazy<typeof import('./components/ManageSyllabusModal').ManageSyllabusModal>(() => import('./components/ManageSyllabusModal'), 'ManageSyllabusModal');
const ManageQuestionsModal = safeLazy<typeof import('./components/ManageQuestionsModal').ManageQuestionsModal>(() => import('./components/ManageQuestionsModal'), 'ManageQuestionsModal');
const ManageExamCategoriesModal = safeLazy<typeof import('./components/ManageExamCategoriesModal').ManageExamCategoriesModal>(() => import('./components/ManageExamCategoriesModal'), 'ManageExamCategoriesModal');
const AIImportModal = safeLazy<typeof import('./components/AIImportModal').AIImportModal>(() => import('./components/AIImportModal'), 'AIImportModal');
const ManagePYQVaultModal = safeLazy<typeof import('./components/ManagePYQVaultModal').ManagePYQVaultModal>(() => import('./components/ManagePYQVaultModal'), 'ManagePYQVaultModal');
const ManageLiveTestsModal = safeLazy<typeof import('./components/ManageLiveTestsModal').ManageLiveTestsModal>(() => import('./components/ManageLiveTestsModal'), 'ManageLiveTestsModal');
const TestSeriesPage = safeLazy<typeof import('./components/TestSeriesPage').TestSeriesPage>(() => import('./components/TestSeriesPage'), 'TestSeriesPage');
const HTMLImportMCQModal = safeLazy<typeof import('./components/admin/HTMLImportMCQModal').HTMLImportMCQModal>(() => import('./components/admin/HTMLImportMCQModal'), 'HTMLImportMCQModal');
const GlobalSearchModal = safeLazy<typeof import('./components/GlobalSearchModal').GlobalSearchModal>(() => import('./components/GlobalSearchModal'), 'GlobalSearchModal');

export default function App() {
  const initialNavState = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        tab: 'home' as ActiveTab,
        articleSlug: null as string | null,
        subjectId: null as string | null,
        chapterId: null as string | null,
        topicId: null as string | null,
        coachingId: null as string | null,
        examId: null as string | null,
        seriesId: null as string | null,
      };
    }
    return resolvePathToNavigationState(window.location.pathname, new URLSearchParams(window.location.search));
  }, []);
  const { 
    activeTab, setActiveTab, selectedArticleSlug, setSelectedArticleSlug,
    selectedSubjectId, setSelectedSubjectId, selectedChapterId, setSelectedChapterId,
    selectedTopicId, setSelectedTopicId,
    selectedCoachingId, setSelectedCoachingId,
    selectedExamId, setSelectedExamId,
    selectedSeriesId, setSelectedSeriesId,
    activeSession, setActiveSession, navigateTo 
  } = useNavigation(initialNavState.tab);

  React.useEffect(() => {
    if (initialNavState.articleSlug) setSelectedArticleSlug(initialNavState.articleSlug);
    if (initialNavState.subjectId) setSelectedSubjectId(initialNavState.subjectId);
    if (initialNavState.chapterId) setSelectedChapterId(initialNavState.chapterId);
    if (initialNavState.topicId) setSelectedTopicId(initialNavState.topicId);
    if (initialNavState.coachingId) setSelectedCoachingId(initialNavState.coachingId);
    if (initialNavState.examId) setSelectedExamId(initialNavState.examId);
    if (initialNavState.seriesId) setSelectedSeriesId(initialNavState.seriesId);
  }, [initialNavState]);

  const { questionsStore, setQuestionsStore } = useQuestions();
  const { progressStore, updateProgress } = useProgress();
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const addToast = React.useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = "toast_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);
  
  const {
    handleAddSubject,
    handleEditSubject,
    handleDeleteSubject,
    handleAddChapter,
    handleEditChapter,
    handleDeleteChapter,
    handleAddTopic,
    handleEditTopic,
    handleDeleteTopic
  } = useCurriculumManager(questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast);

  const isPopStateRef = React.useRef(false);
  const isInitialMountRef = React.useRef(true);

  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(() => loadUserProfile());
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(() => !!userProfile);
  const [settings, setSettings] = React.useState<AppSettings>(() => loadSettingsFromStorage());
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  const [notifications, setNotifications] = React.useState<AppNotification[]>(() => loadNotifications());
  const unreadNotificationsCount = React.useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleUpdateNotifications = React.useCallback((next: AppNotification[]) => {
    setNotifications(next);
    saveNotifications(next);
  }, []);

  // Sync URL with Tab, Subject, Chapter, Topic and Session changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const targetPath = buildCanonicalPath(
      activeTab,
      selectedArticleSlug,
      selectedSubjectId,
      selectedChapterId,
      selectedTopicId,
      selectedCoachingId,
      selectedExamId,
      selectedSeriesId,
      Boolean(activeSession)
    );

    const currentPath = window.location.pathname + window.location.search;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (isPopStateRef.current) {
      // Transition was caused by browser popstate (back/forward button)
      isPopStateRef.current = false;
      return;
    }

    if (currentPath !== targetPath) {
      window.history.pushState(
        {
          tab: activeTab,
          slug: selectedArticleSlug,
          subjectId: selectedSubjectId,
          chapterId: selectedChapterId,
          topicId: selectedTopicId,
          coachingId: selectedCoachingId,
          examId: selectedExamId,
          seriesId: selectedSeriesId,
          hasSession: Boolean(activeSession),
        },
        '',
        targetPath
      );
    }
  }, [activeTab, selectedArticleSlug, selectedSubjectId, selectedChapterId, selectedTopicId, selectedCoachingId, selectedExamId, selectedSeriesId, activeSession]);

  // First-time app open notification permission request
  React.useEffect(() => {
    const prompted = localStorage.getItem("disha2020_notification_prompted") || localStorage.getItem("quizpro_notification_prompted");
    if (!prompted && typeof window !== "undefined" && "Notification" in window) {
      localStorage.setItem("disha2020_notification_prompted", "true");
      const timer = setTimeout(async () => {
        try {
          if (Notification.permission === "default") {
            const perm = await Notification.requestPermission();
            if (perm === "granted") {
              new Notification("DISHA 20-20 — Welcome!", {
                body: "You will now receive important exam updates, daily study reminders, and live test alerts.",
                icon: "/favicon.svg"
              });
            }
          }
        } catch (e) {
          console.warn("Notification permission request error:", e);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Offline-first local notifications persistence
  React.useEffect(() => {
    // Loaded from loadNotifications(), synced locally via saveNotifications()
  }, []);

  const handleUpdateProgress = (
    questionId: string,
    isCorrect: boolean,
    selectedOption: number
  ) => {
    const today = getTodayDateString();
    const nowIso = new Date().toISOString();
    const existing = progressStore[questionId] || ({} as Partial<QuestionProgress>);
    const nextRev = calculateNextProgress(existing as QuestionProgress, isCorrect, selectedOption, today);

    const updatedItem: QuestionProgress = {
      ...existing,
      ...nextRev,
      status: isCorrect ? 'correct' : 'wrong',
      lastAnsweredAt: today,
      timesAttempted: (existing.timesAttempted || 0) + 1,
      lastSelectedOption: selectedOption,
      updatedAt: nowIso,
    } as QuestionProgress;

    updateProgress((prev) => {
      const prevExisting = prev[questionId] as QuestionProgress | undefined;
      return {
        ...prev,
        [questionId]: {
          ...prevExisting,
          ...nextRev,
          status: isCorrect ? 'correct' : 'wrong',
          lastAnsweredAt: today,
          timesAttempted: ((prevExisting?.timesAttempted) || 0) + 1,
          lastSelectedOption: selectedOption,
          updatedAt: nowIso,
        } as QuestionProgress,
      };
    });

    const updatedHistory = recordStudyAnswerToHistory(isCorrect, today);
    bufferProgressUpdate(questionId, updatedItem, { userProfile });
    if (updatedHistory && updatedHistory[today]) {
      bufferHistoryUpdate(today, updatedHistory[today], { userProfile });
    }

    import("./utils/localDatabaseEngine").then(({ saveLocalRevisionRecord }) => {
      const uid = userProfile?.id || "guest";
      saveLocalRevisionRecord({
        recordId: `${uid}_${questionId}`,
        questionId,
        userId: uid,
        stage: nextRev.stage,
        nextReviewAt: nextRev.nextReviewAt,
        lastAnsweredAt: today,
        wrongCount: nextRev.wrongCount,
        status: isCorrect ? "correct" : "wrong",
        updatedAt: Date.now(),
        syncStatus: "pending",
      }).catch(() => {});
    }).catch(() => {});
  };

  const handleToggleBookmark = (questionId: string) => {
    const nowIso = new Date().toISOString();
    const existing = progressStore[questionId] || ({} as Partial<QuestionProgress>);
    const nextBookmarked = !existing.bookmarked;
    const updatedItem: QuestionProgress = {
      ...existing,
      bookmarked: nextBookmarked,
      updatedAt: nowIso,
    } as QuestionProgress;

    updateProgress((prev) => {
      const prevExisting = prev[questionId] || {};
      return {
        ...prev,
        [questionId]: {
          ...prevExisting,
          bookmarked: nextBookmarked,
          updatedAt: nowIso,
        } as QuestionProgress,
      };
    });

    bufferProgressUpdate(questionId, updatedItem, { userProfile });

    import("./utils/localDatabaseEngine").then(({ setLocalBookmark }) => {
      const uid = userProfile?.id || "guest";
      setLocalBookmark(questionId, nextBookmarked, uid).catch(() => {});
    }).catch(() => {});
  };
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = React.useState(false);
  const [isPDFOpen, setIsPDFOpen] = React.useState(false);
  const [isFullExamOpen, setIsFullExamOpen] = React.useState(false);
  const [isCustomTestOpen, setIsCustomTestOpen] = React.useState(false);
  const [isExamAnalyzerOpen, setIsExamAnalyzerOpen] = React.useState(false);
  const [viewCount, setViewCount] = React.useState<number>(1240);

  // Global event listener to sync tier upgrades
  React.useEffect(() => {
    const handleTierUpdated = () => setUserProfile(loadUserProfile());

    window.addEventListener('disha2020-user-tier-updated', handleTierUpdated);
    window.addEventListener('quizpro-user-tier-updated', handleTierUpdated);

    return () => {
      window.removeEventListener('disha2020-user-tier-updated', handleTierUpdated);
      window.removeEventListener('quizpro-user-tier-updated', handleTierUpdated);
    };
  }, []);

  // Curriculum Admin Modal States
  const [isAddSubjectOpen, setIsAddSubjectOpen] = React.useState(false);
  const [isAddChapterOpen, setIsAddChapterOpen] = React.useState(false);
  const [addChapterSubjectId, setAddChapterSubjectId] = React.useState<string | undefined>(undefined);
  const [isAddTopicOpen, setIsAddTopicOpen] = React.useState(false);
  const [addTopicSubjectId, setAddTopicSubjectId] = React.useState<string | undefined>(undefined);
  const [addTopicChapterId, setAddTopicChapterId] = React.useState<string | undefined>(undefined);
  const [isManageSyllabusOpen, setIsManageSyllabusOpen] = React.useState(false);
  const [isAddQuestionsOpen, setIsAddQuestionsOpen] = React.useState(false);
  const [addQuestionsChapterId, setAddQuestionsChapterId] = React.useState<string | undefined>(undefined);
  const [addQuestionsTopicId, setAddQuestionsTopicId] = React.useState<string | undefined>(undefined);
  const [addQuestionsSubjectId, setAddQuestionsSubjectId] = React.useState<string | undefined>(undefined);
  const [addQuestionsMethod, setAddQuestionsMethod] = React.useState<"json" | "file" | "paste" | "manual">("paste");
  const [isManageQuestionsOpen, setIsManageQuestionsOpen] = React.useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = React.useState(false);
  const [isAIImportOpen, setIsAIImportOpen] = React.useState(false);
  const [isManagePYQVaultOpen, setIsManagePYQVaultOpen] = React.useState(false);
  const [isManageLiveTestsOpen, setIsManageLiveTestsOpen] = React.useState(false);
  const [isHTMLImportOpen, setIsHTMLImportOpen] = React.useState(false);
  const [htmlImportChapterId, setHtmlImportChapterId] = React.useState<string | undefined>(undefined);
  const [htmlImportTopicId, setHtmlImportTopicId] = React.useState<string | undefined>(undefined);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = React.useState(false);

  // Global Ctrl+K / Cmd+K Search Shortcut Listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // In-app session close that pops browser history when session=1 query exists
  const handleCloseSession = () => {
    setActiveSession(null);
    if (typeof window !== 'undefined' && window.location.search.includes('session=1')) {
      window.history.back();
    }
  };

  // Handle Android Back button, browser Back button and gesture PopState navigation
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;

      const path = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const hasSessionParam = searchParams.get('session') === '1';

      // 1. If URL no longer has session=1, clear activeSession immediately
      if (!hasSessionParam && activeSession) {
        setActiveSession(null);
      }

      // 2. If this is a sentinel state from MCQSessionModal (Back button protection),
      if (event.state && (event.state.dishaTestActive || event.state.quizProTestActive)) {
        return;
      }

      // 3. Close open modal overlays first to prevent unwanted page navigation
      if (isLoginOpen) { setIsLoginOpen(false); return; }
      if (isSettingsOpen) { setIsSettingsOpen(false); return; }
      if (isApiSettingsOpen) { setIsApiSettingsOpen(false); return; }
      if (isPDFOpen) { setIsPDFOpen(false); return; }
      if (isFullExamOpen) { setIsFullExamOpen(false); return; }
      if (isCustomTestOpen) { setIsCustomTestOpen(false); return; }
      if (isExamAnalyzerOpen) { setIsExamAnalyzerOpen(false); return; }
      if (isAddSubjectOpen) { setIsAddSubjectOpen(false); return; }
      if (isAddChapterOpen) { setIsAddChapterOpen(false); return; }
      if (isAddTopicOpen) { setIsAddTopicOpen(false); return; }
      if (isAddQuestionsOpen) { setIsAddQuestionsOpen(false); return; }
      if (isManageSyllabusOpen) { setIsManageSyllabusOpen(false); return; }
      if (isManageQuestionsOpen) { setIsManageQuestionsOpen(false); return; }
      if (isManageCategoriesOpen) { setIsManageCategoriesOpen(false); return; }
      if (isManagePYQVaultOpen) { setIsManagePYQVaultOpen(false); return; }
      if (isManageLiveTestsOpen) { setIsManageLiveTestsOpen(false); return; }
      if (isAIImportOpen) { setIsAIImportOpen(false); return; }
      if (isHTMLImportOpen) { setIsHTMLImportOpen(false); return; }
      if (isGlobalSearchOpen) { setIsGlobalSearchOpen(false); return; }

      // 4. Parse new URL after back/forward action using centralized resolver
      const parsed = resolvePathToNavigationState(path, searchParams);
      setActiveTab(parsed.tab);
      setSelectedArticleSlug(parsed.articleSlug);
      setSelectedSubjectId(parsed.subjectId);
      setSelectedChapterId(parsed.chapterId);
      setSelectedTopicId(parsed.topicId);
      setSelectedCoachingId(parsed.coachingId);
      setSelectedExamId(parsed.examId);
      setSelectedSeriesId(parsed.seriesId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    activeSession, isLoginOpen, isSettingsOpen, isApiSettingsOpen, isPDFOpen, isFullExamOpen,
    isCustomTestOpen, isExamAnalyzerOpen, isAddSubjectOpen, isAddChapterOpen,
    isAddTopicOpen, isAddQuestionsOpen, isManageSyllabusOpen, isManageQuestionsOpen,
    isManageCategoriesOpen, isManagePYQVaultOpen, isManageLiveTestsOpen,
    isAIImportOpen, isHTMLImportOpen
  ]);

  React.useEffect(() => {
    const handleStoreUpdated = (event: any) => {
      const detail = event?.detail;
      if (
        detail &&
        typeof detail === "object" &&
        !("sourceTabId" in detail) &&
        (Array.isArray(detail.cloudCacheQuestions) ||
          Array.isArray(detail.customSubjects) ||
          Array.isArray(detail.customChapters) ||
          Array.isArray(detail.customQuestions))
      ) {
        setQuestionsStore(detail);
      } else {
        setQuestionsStore(loadUserQuestionsStore());
      }
    };
    window.addEventListener("disha2020_store_updated", handleStoreUpdated);
    window.addEventListener("quizpro_store_updated", handleStoreUpdated);
    return () => {
      window.removeEventListener("disha2020_store_updated", handleStoreUpdated);
      window.removeEventListener("quizpro_store_updated", handleStoreUpdated);
    };
  }, []);

  // Initialize DISHA 20-20 Local-First Engine (Migration + Strict 24h Sync Coordinator)
  React.useEffect(() => {
    Promise.all([
      import('./utils/localDatabaseEngine').then(({ migrateLegacyLocalStorageToIndexedDB }) => {
        migrateLegacyLocalStorageToIndexedDB(userProfile?.id || "guest").catch(() => {});
      }),
      import('./utils/syncCoordinator').then(({ syncCoordinator }) => {
        syncCoordinator.initializeSync().catch(() => {});
      }),
      import('./utils/questionBankCache').then(({ warmQuestionBankCache }) => {
        warmQuestionBankCache().catch(() => {});
      }),
    ]).catch(() => {});
  }, [userProfile?.id]);

  // Mobile/Android background-to-foreground lifecycle persistence guard + crash-recovery flush
  React.useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const flushStateOnBackground = () => {
      try {
        saveProgressToStorage(progressStore);
        saveSettingsToStorage(settings);
        if (hasPendingStudentWrites()) {
          flushStudentWriteBuffer({ trigger: 'background_hide', userProfile }).catch(() => {});
        }
      } catch {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushStateOnBackground();
      } else if (document.visibilityState === 'visible') {
        try {
          const diskProgress = loadProgressFromStorage();
          updateProgress((prev) => {
            const { merged, changedCount } = mergeRealtimeProgressDelta(prev, diskProgress);
            return changedCount > 0 ? merged : prev;
          });
          rehydrateStudentWriteBuffer()
            .then(async () => {
              if (hasPendingStudentWrites()) {
                await flushStudentWriteBuffer({ trigger: 'app_resume', userProfile });
              }
            })
            .catch(() => {});
        } catch {}
      }
    };

    // Attempt recovery flush once on mount if previous session left pending buffered data
    rehydrateStudentWriteBuffer()
      .then(async () => {
        if (hasPendingStudentWrites()) {
          flushStudentWriteBuffer({ trigger: 'app_resume', userProfile }).catch(() => {});
        }
      })
      .catch(() => {});

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushStateOnBackground);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushStateOnBackground);
    };
  }, [progressStore, settings, updateProgress, userProfile]);

  React.useEffect(() => {
    saveSettingsToStorage(settings);
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  React.useEffect(() => {
    let visits = 1240;
    try {
      visits = parseInt(localStorage.getItem('disha2020_visitor_count') || localStorage.getItem('quizpro_visitor_count') || '1240', 10);
    } catch {}
    setViewCount(visits);

    const timer = setTimeout(() => {
      const nextCount = visits + 1;
      try {
        localStorage.setItem('disha2020_visitor_count', String(nextCount));
        setViewCount(nextCount);
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Idle background prefetcher for core application routes and heavy components
  React.useEffect(() => {
    prefetchCoreRoutes();
  }, []);

  // Supabase Auth & Session Lifecycle Listener
  React.useEffect(() => {
    let unsub = () => {};
    import('./lib/supabase').then(({ supabase, isSupabaseConfigured }) => {
      if (!isSupabaseConfigured()) {
        setIsAuthReady(true);
        return;
      }

      const processSession = async (session: any) => {
        setIsAuthReady(true);
        if (session?.user) {
          const u = session.user;
          const emailLower = (u.email || "").trim().toLowerCase();
          const { ADMIN_EMAILS, ADMIN_UIDS, saveUserProfile: saveProfile } = await import('./utils/userProfileStorage');
          const isAdminUser = Boolean(
            (u.email && ADMIN_EMAILS.includes(emailLower)) ||
            ADMIN_UIDS.includes(u.id)
          );
          const profile: UserProfile = {
            id: u.id,
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Student",
            email: u.email || "",
            photoURL: u.user_metadata?.avatar_url || "",
            role: isAdminUser ? "admin" : "student",
            status: "active",
            createdAt: u.created_at || new Date().toISOString(),
          };
          setUserProfile(profile);
          setIsAuthenticated(true);
          saveProfile(profile);
          if (isAdminUser) {
            setActiveTab("admin");
          }
          setIsLoginOpen(false);

          // Restore and merge bookmarks from Supabase PostgreSQL
          try {
            const { fetchUserBookmarksFromSupabase } = await import('./utils/supabaseSyncService');
            const bookmarkedIds = await fetchUserBookmarksFromSupabase(u.id);
            if (bookmarkedIds.length > 0) {
              updateProgress((prev) => {
                const merged = { ...prev };
                bookmarkedIds.forEach((qId) => {
                  merged[qId] = {
                    ...(merged[qId] || {
                      status: "unattempted",
                      stage: 0,
                      nextReviewAt: "",
                      wrongCount: 0,
                      bookmarked: true,
                      lastAnsweredAt: null,
                    }),
                    bookmarked: true,
                  };
                });
                return merged;
              });
            }
          } catch {}
        } else {
          // Restore local cached profile if user was previously in guest/offline mode
          const currentProfile = loadUserProfile();
          if (currentProfile && currentProfile.id !== "student_default") {
            setUserProfile(currentProfile);
            setIsAuthenticated(true);
          }
        }
      };

      supabase.auth.getSession().then(({ data: { session } }) => {
        processSession(session).catch(() => {});
      }).catch(() => {
        setIsAuthReady(true);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        processSession(session).catch(() => {});
      });

      unsub = () => {
        subscription?.unsubscribe();
      };
    }).catch(() => {
      setIsAuthReady(true);
    });

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [updateProgress]);

  // Background fetch of curriculum from Supabase on startup (non-destructive merge, single run)
  React.useEffect(() => {
    let isSubscribed = true;
    let syncThrottleTimeout: any = null;

    const syncFromSupabase = (force: boolean = false) => {
      import('./utils/supabaseSyncService').then(({ fetchSubjects, fetchChapters, fetchTopics }) => {
        Promise.all([
          fetchSubjects(force ? { forceRefresh: true } : undefined),
          fetchChapters(undefined, force ? { forceRefresh: true } : undefined),
          fetchTopics(undefined, force ? { forceRefresh: true } : undefined),
          import('./utils/localDatabaseEngine').then(({ getAllLocalMCQs }) => getAllLocalMCQs()).catch(() => [])
        ]).then(([subs, chaps, tops, mcqs]) => {
          if (!isSubscribed) return;
          if (subs && subs.length > 0) {
            setQuestionsStore((prev) => {
              // 1. Non-destructive merge: preserve local user-added subjects not yet on server
              const existingUserSubs = (prev.customSubjects || []).filter(
                (s) => (s.isUserAdded || String(s.id).startsWith("subj-")) && !subs.some((sub) => sub.id === s.id)
              );
              const mergedSubs = [...subs, ...existingUserSubs];

              // 2. Non-destructive merge for chapters
              const existingUserChaps = (prev.customChapters || []).filter(
                (c) => (c.isUserAdded || String(c.id).startsWith("custom-ch-")) && !chaps.some((ch) => ch.id === c.id)
              );
              const mergedChaps = [...(chaps && chaps.length > 0 ? chaps : prev.customChapters || []), ...existingUserChaps];

              // 3. Non-destructive merge for topics
              const existingUserTops = (prev.customTopics || []).filter(
                (t) => (t.isUserAdded || String(t.id).startsWith("custom-topic-")) && !tops.some((top) => top.id === t.id)
              );
              const mergedTops = [...(tops && tops.length > 0 ? tops : prev.customTopics || []), ...existingUserTops];

              // 4. Filter out any question IDs deleted locally
              const deletedSet = new Set(prev.deletedQuestionIds || []);
              const mergedMcqs = (mcqs && mcqs.length > 0 ? mcqs : prev.cloudCacheQuestions || []).filter(
                (q) => q && q.id && !deletedSet.has(q.id)
              );

              // 5. Shallow comparison to avoid redundant re-renders and loops
              const subsEqual = mergedSubs.length === (prev.customSubjects || []).length;
              const chapsEqual = mergedChaps.length === (prev.customChapters || []).length;
              const topsEqual = mergedTops.length === (prev.customTopics || []).length;
              const mcqsEqual = mergedMcqs.length === (prev.cloudCacheQuestions || []).length;

              if (subsEqual && chapsEqual && topsEqual && mcqsEqual) {
                return prev; // No state change -> prevents re-render cascade
              }

              const next = {
                ...prev,
                customSubjects: mergedSubs,
                customChapters: mergedChaps,
                customTopics: mergedTops,
                cloudCacheQuestions: mergedMcqs,
              };
              saveUserQuestionsStore(next);
              return next;
            });
          }
        }).catch(() => {});
      }).catch(() => {});
    };

    // Initial startup fetch (without force, uses cached IDB first, throttled server check)
    syncFromSupabase(false);

    // Guarded external event handler (throttled to at most once per 30 seconds, NEVER loops)
    let lastHandledSync = Date.now();
    const handleCurriculumSynced = () => {
      const now = Date.now();
      if (now - lastHandledSync < 30000) return; // Strict 30s cooldown
      lastHandledSync = now;
      clearTimeout(syncThrottleTimeout);
      syncThrottleTimeout = setTimeout(() => {
        if (isSubscribed) syncFromSupabase(false);
      }, 2000);
    };

    window.addEventListener("disha2020_curriculum_synced", handleCurriculumSynced);
    window.addEventListener("quizpro_curriculum_synced", handleCurriculumSynced);
    return () => {
      isSubscribed = false;
      clearTimeout(syncThrottleTimeout);
      window.removeEventListener("disha2020_curriculum_synced", handleCurriculumSynced);
      window.removeEventListener("quizpro_curriculum_synced", handleCurriculumSynced);
    };
  }, [setQuestionsStore]);

  const isAdmin = userProfile ? isUserAdmin(userProfile) : false;

  // Track page views dynamically on activeTab navigation
  React.useEffect(() => {
    const path = activeTab === 'home' ? '/' : `/${activeTab}`;
    const title = `DISHA 20-20 — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`;
    trackPageView(path, title, { isUserAdmin: isAdmin, isLoggedIn: isAuthenticated }).catch(() => {});
  }, [activeTab, isAdmin, isAuthenticated]);

  // Sync profile to Supabase on boot or change when authenticated
  React.useEffect(() => {
    if (isAuthenticated && userProfile) {
      import('./utils/supabaseSyncService').then(({ syncUserProfileToSupabase }) => {
        syncUserProfileToSupabase(userProfile).catch(err => {
          console.warn("Background profile sync note:", err?.message || err);
        });
      }).catch(() => {});
    }
  }, [isAuthenticated, userProfile]);

  const handleStartSession = (session: MCQSession) => {
    if (Array.isArray(session.extraQuestions) && session.extraQuestions.length > 0) {
      setQuestionsStore((prev) => {
        const existingCache = prev.cloudCacheQuestions || [];
        const cacheMap = new Map<string, Question>();
        existingCache.forEach((q) => {
          if (q && q.id) cacheMap.set(q.id, q);
        });
        let addedOrUpdated = false;
        session.extraQuestions!.forEach((q, idx) => {
          if (!q) return;
          const qId = q.id || session.questionIds?.[idx];
          if (!qId) return;
          const normalized: Question = {
            ...q,
            id: qId,
            topicId: q.topicId || session.topicId || "",
            chapterId: q.chapterId || session.chapterId || "",
          };
          if (!cacheMap.has(qId)) {
            addedOrUpdated = true;
          }
          cacheMap.set(qId, normalized);
        });
        if (!addedOrUpdated) return prev;
        const nextStore = {
          ...prev,
          cloudCacheQuestions: Array.from(cacheMap.values()),
        };
        saveUserQuestionsStore(nextStore);
        return nextStore;
      });
    }
    setActiveSession(session);
  };

  const handleLogout = async () => {
    try {
      const { supabase } = await import('./lib/supabase');
      await supabase.auth.signOut();
    } catch {}
    setUserProfile(null);
    setIsAuthenticated(false);
    localStorage.removeItem('economic_survey_user_profile_v1');
  };

  // Toast Notifications State
  // Toast Notifications Handlers
  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Derived combined curriculum state
  const combinedSubjects = React.useMemo(() => getCombinedSubjects(questionsStore), [questionsStore]);
  const combinedChapters = React.useMemo(() => getCombinedChapters(questionsStore), [questionsStore]);
  const combinedQuestions = React.useMemo(() => getCombinedQuestions(combinedChapters, questionsStore), [combinedChapters, questionsStore]);
  const chaptersMap = React.useMemo(() => getCombinedChaptersMap(combinedChapters), [combinedChapters]);
  const questionsMap = React.useMemo(() => getCombinedQuestionsMap(combinedQuestions), [combinedQuestions]);

  // Curriculum handlers are now managed by useCurriculumManager

  const handleImportQuestions = async (newQuestions: Question[], alreadyCommitted: boolean = false) => {
    if (alreadyCommitted) {
      // If already in Firestore, we put them in cloudCacheQuestions to avoid "Double Write" in next Sync
      const currentCache = questionsStore.cloudCacheQuestions || [];
      const cacheMap = new Map<string, Question>();
      currentCache.forEach((q) => cacheMap.set(q.id, q));
      newQuestions.forEach((q) => cacheMap.set(q.id, q));
      const dedupedCache = Array.from(cacheMap.values());

      // Also remove any matching IDs from customQuestions to prevent double-counting
      const newIds = new Set(newQuestions.map((q) => q.id));
      const updatedCustom = (questionsStore.customQuestions || []).filter((q) => !newIds.has(q.id));

      const nextStore = {
        ...questionsStore,
        cloudCacheQuestions: dedupedCache,
        customQuestions: updatedCustom,
      };
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      addToast('success', 'Import Success', `${newQuestions.length} question(s) added and synced!`);
      return;
    }

    const currentCustom = questionsStore.customQuestions || [];
    const nextStore = {
      ...questionsStore,
      customQuestions: [...currentCustom, ...newQuestions],
    };
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);

    try {
      const { upsertQuestionsToSupabase } = await import('./utils/supabaseSyncService');
      const commitRes = await upsertQuestionsToSupabase(newQuestions);
      if (commitRes.success) {
        addToast('success', 'Backend Sync Success', commitRes.message);
      } else {
        addToast('error', 'Save Notice', commitRes.message || 'Failed to save questions');
      }
    } catch (saveErr: any) {
      addToast('error', 'Save Error', saveErr?.message || 'Error saving questions to cloud');
    }
  };

  const handleEditQuestion = async (updatedQuestion: Question) => {
    const { editQuestionInStore } = await import('./utils/questionsStorage');
    const nextStore = editQuestionInStore(questionsStore, updatedQuestion);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    const { upsertQuestionsToSupabase } = await import('./utils/supabaseSyncService');
    const res = await upsertQuestionsToSupabase([updatedQuestion]);
    if (res.success) {
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', 'Question updated in Supabase!');
      } else {
        addToast('info', 'Saved Locally', res.message);
      }
    } else {
      addToast('error', 'Save Error', res.message);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const nextStore = bulkDeleteQuestions(questionsStore, [questionId]);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);

    const { deleteQuestionFromSupabase } = await import('./utils/supabaseSyncService');
    const res = await deleteQuestionFromSupabase(questionId);
    if (res.success) {
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', 'Question removed from Supabase!');
      } else {
        addToast('info', 'Deleted Locally', res.message);
      }
    } else {
      addToast('error', 'Delete Error', res.message);
    }
  };

  const handleBulkDeleteQuestions = async (questionIds: string[]) => {
    if (!questionIds || questionIds.length === 0) return;

    const nextStore = bulkDeleteQuestions(questionsStore, questionIds);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);

    const { deleteQuestionsBulkFromSupabase } = await import('./utils/supabaseSyncService');
    const res = await deleteQuestionsBulkFromSupabase(questionIds);
    if (res.success) {
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', `${questionIds.length} question(s) removed from Supabase!`);
      } else {
        addToast('info', 'Deleted Locally', res.message || `${questionIds.length} question(s) deleted locally.`);
      }
    } else {
      addToast('error', 'Delete Error', res.message || 'Failed to delete questions');
    }
  };

  const handleBulkMoveQuestions = async (questionIds: string[], targetChapterId: string, targetTopicId: string) => {
    const questionsMap = getCombinedQuestionsMap(combinedQuestions);
    const targetChapter = combinedChapters.find(c => c.id === targetChapterId);
    const targetSubjectId = targetChapter?.subjectId;

    // 1. Move questions in Supabase using authoritative update
    const { moveQuestionsInSupabase } = await import('./utils/supabaseSyncService');
    const cloudRes = await moveQuestionsInSupabase(
      questionIds,
      targetChapterId,
      targetTopicId,
      targetSubjectId,
      questionsMap
    );

    // 2. Synchronize store locally only after cloud execution
    const nextStore = bulkMoveQuestions(
      questionsStore,
      questionIds,
      targetChapterId,
      targetTopicId,
      questionsMap,
      targetSubjectId
    );
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);

    if (cloudRes.success) {
      addToast(
        'success',
        'Supabase Move',
        `${cloudRes.movedCount} question(s) moved to "${targetChapter?.title || "selected chapter"}" successfully!`
      );
    } else {
      addToast('error', 'Move Error', cloudRes.message);
    }
  };

  const handleDesktopNavigateTab = (tab: ActiveTab) => {
    if (tab === 'analyzer') {
      setIsExamAnalyzerOpen(true);
      return;
    }
    if (tab !== activeTab) {
      setSelectedArticleSlug(null);
      setSelectedSubjectId(null);
      setSelectedChapterId(null);
      setSelectedTopicId(null);
      setActiveSession(null);
      setActiveTab(tab);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] flex flex-col font-sans selection:bg-[#800020] selection:text-white w-full max-w-full overflow-x-hidden">
      <BrandSplashAndOnboarding allowAutoOnboarding={activeTab === 'home'} />
      <ToastNotificationContainer toasts={toasts} onDismiss={handleDismissToast} />
      <PWAUpdateToast />
      <OfflineIndicator />

      {/* Desktop Top Navigation Header */}
      <header className="hidden md:block sticky top-0 z-40 bg-[#FFF9EF]/95 dark:bg-[#171923]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] select-none shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => handleDesktopNavigateTab('home')}
            className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-[1.02] shrink-0"
            role="button"
            tabIndex={0}
            aria-label="DISHA 20-20 Home"
          >
            <span className="text-lg font-black tracking-wider text-[#171923] dark:text-[#FFF9EF] uppercase font-serif whitespace-nowrap">
              DISHA
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#F47B20] to-[#E06A12] text-white font-black text-xs tracking-tight shadow-xs whitespace-nowrap">
              20-20
            </span>
          </div>

          {/* Desktop Navigation Bar */}
          <nav aria-label="Desktop Navigation" className="hidden md:flex items-center gap-1">
            {[
              { id: 'home' as ActiveTab, label: 'Home', icon: Home },
              { id: 'topics' as ActiveTab, label: 'Subjects', icon: BookOpen },
              { id: 'live_tests' as ActiveTab, label: 'Tests', icon: Trophy },
              { id: 'analyzer' as ActiveTab, label: 'Scan', icon: Scan },
              { id: 'analytics' as ActiveTab, label: 'Analytics', icon: BarChart2 },
              { id: 'profile' as ActiveTab, label: 'Profile', icon: User },
              ...(isAdmin ? [{ id: 'admin' as ActiveTab, label: 'Admin', icon: ShieldCheck }] : []),
            ].map((item) => {
              const Icon = item.icon;
              const isActive =
                item.id === 'analyzer'
                  ? isExamAnalyzerOpen || activeTab === 'analyzer'
                  : item.id === 'live_tests'
                  ? activeTab === 'live_tests' || activeTab === 'test_series'
                  : activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleDesktopNavigateTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] shadow-xs'
                      : 'text-[#52576A] dark:text-[#929AB0] hover:text-[#171923] dark:hover:text-[#FFF9EF] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A]/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Desktop Right Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsGlobalSearchOpen(true)}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer"
              aria-label="Search"
              title="Global Search (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleDesktopNavigateTab('notifications')}
              className="relative w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F47B20] ring-2 ring-[#FFF9EF] dark:ring-[#171923]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettings((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#C99A45] active:scale-95 transition-all cursor-pointer"
              aria-label={settings.darkMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
              title={settings.darkMode ? 'Day Mode' : 'Night Mode'}
            >
              {settings.darkMode ? (
                <Sun className="w-4 h-4 text-[#F47B20]" />
              ) : (
                <Moon className="w-4 h-4 text-[#800020]" />
              )}
            </button>

            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => setIsLoginOpen(true)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white text-xs font-extrabold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleDesktopNavigateTab('profile')}
                className="w-9 h-9 rounded-full ring-2 ring-[#C99A45]/60 hover:ring-[#800020] dark:hover:ring-[#F47B20] flex items-center justify-center overflow-hidden active:scale-95 transition-all cursor-pointer bg-[#F7EFE2] dark:bg-[#252A3A]"
                aria-label="Profile"
                title={userProfile?.name || 'User Profile'}
              >
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userProfile?.name || 'Scholar')}`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Rendering */}
      <main className="flex-1 pb-16 md:pb-6">
        <RouteErrorBoundary tabName={activeTab} onNavigateHome={() => setActiveTab('home')}>
        <React.Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-[#800020] dark:border-[#F47B20] border-t-transparent rounded-full animate-spin" /></div>}>
        {activeTab === 'home' && (
          <HomeTab
            progressStore={progressStore}
            settings={settings}
            subjects={combinedSubjects}
            questions={combinedQuestions}
            chapters={combinedChapters}
            questionsStore={questionsStore}
            userProfile={userProfile}
            isAuthenticated={isAuthenticated}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenNotifications={() => setActiveTab('notifications')}
            onOpenSearch={() => setIsGlobalSearchOpen(true)}
            onOpenLogin={() => setIsLoginOpen(true)}
            onStartSession={handleStartSession}
            onNavigateToChapter={(chapId) => {
              setSelectedChapterId(chapId);
              setActiveTab('topics');
            }}
            onSelectSubject={(subId) => {
              setSelectedSubjectId(subId);
              setSelectedChapterId(null);
              setActiveTab('topics');
            }}
            onShowAddSubject={() => setIsAddSubjectOpen(true)}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenPDFExport={() => setIsPDFOpen(true)}
            onOpenFullExam={() => setIsFullExamOpen(true)}
            onOpenExamAnalyzer={() => setIsExamAnalyzerOpen(true)}
            onOpenApiSettings={() => setIsApiSettingsOpen(true)}
            onToggleDarkMode={() => setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }))}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'topics' && (
          <TopicsTab
            progressStore={progressStore}
            subjects={combinedSubjects}
            chapters={combinedChapters}
            questionsStore={questionsStore}
            selectedSubjectId={selectedSubjectId}
            onSelectSubject={(subId: string | null) => setSelectedSubjectId(subId)}
            selectedChapterId={selectedChapterId}
            onSelectChapter={(chapId: string | null) => setSelectedChapterId(chapId)}
            selectedTopicId={selectedTopicId}
            onSelectTopic={(topId: string | null) => setSelectedTopicId(topId)}
            onStartSession={handleStartSession}
            onOpenPDFExport={() => setIsPDFOpen(true)}
            onBack={() => {
              // Hierarchical state-aware back navigation
              if (selectedTopicId) {
                setSelectedTopicId(null);
              } else if (selectedChapterId) {
                setSelectedChapterId(null);
              } else if (selectedSubjectId) {
                setSelectedSubjectId(null);
              } else if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back();
              } else {
                setActiveTab('home');
              }
            }}
          />
        )}

        {activeTab === 'pyq_vault' && (
          <PYQVaultTab
            onStartSession={handleStartSession}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
            isAdmin={isAdmin}
            onOpenAdminManage={() => setIsManagePYQVaultOpen(true)}
          />
        )}

        {activeTab === 'live_tests' && (
          <LiveTestsTab
            onStartSession={handleStartSession}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
            isAdmin={isAdmin}
            onOpenAdminManage={() => setIsManageLiveTestsOpen(true)}
            userProfile={userProfile}
          />
        )}

        {activeTab === 'test_series' && (
          <TestSeriesPage
            coachingId={selectedCoachingId}
            examId={selectedExamId}
            seriesId={selectedSeriesId}
            onNavigate={(cId, eId, sId) => {
              setSelectedCoachingId(cId || null);
              setSelectedExamId(eId || null);
              setSelectedSeriesId(sId || null);
            }}
            onStartSession={handleStartSession}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
            isAdmin={isAdmin}
            onOpenAdminManage={() => setIsManageLiveTestsOpen(true)}
            userProfile={userProfile}
          />
        )}

        {activeTab === 'wrong' && (
          <WrongTab
            progressStore={progressStore}
            questions={combinedQuestions}
            chapters={combinedChapters}
            onStartSession={handleStartSession}
            onToggleBookmark={handleToggleBookmark}
            onSelectWrongChapter={(chapId: string) => setSelectedChapterId(chapId)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={userProfile}
            isAuthenticated={isAuthenticated}
            onOpenLogin={() => setIsLoginOpen(true)}
            progressStore={progressStore}
            settings={settings}
            onUpdateSettings={(newSettings: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSettings }))}
            onResetProgress={() => updateProgress(() => ({}))}
            onLogout={handleLogout}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminErrorBoundary>
            <AdminTab
              userProfile={userProfile}
              subjects={combinedSubjects}
              chapters={combinedChapters}
              questionsStore={questionsStore}
              onStoreUpdated={(next: any) => {
                 setQuestionsStore(next);
                 saveUserQuestionsStore(next);
              }}
              onDeleteSubject={handleDeleteSubject}
              onDeleteChapter={handleDeleteChapter}
              onShowAddSubject={() => setIsAddSubjectOpen(true)}
              onShowAddChapter={(subId?: string) => {
                setAddChapterSubjectId(subId || undefined);
                setIsAddChapterOpen(true);
              }}
              onShowAddTopic={(subId?: string, chapId?: string) => {
                setAddTopicSubjectId(subId || undefined);
                setAddTopicChapterId(chapId || undefined);
                setIsAddTopicOpen(true);
              }}
              onShowManageSyllabus={() => setIsManageSyllabusOpen(true)}
              onShowAddQuestions={(chapId?: string, topId?: string, subId?: string, method?: any) => {
                setAddQuestionsChapterId(chapId || undefined);
                setAddQuestionsTopicId(topId || undefined);
                setAddQuestionsSubjectId(subId || undefined);
                setAddQuestionsMethod((method as any) || "paste");
                setIsAddQuestionsOpen(true);
              }}
              onShowManageQuestions={() => setIsManageQuestionsOpen(true)}
              onShowAIImport={() => setIsAIImportOpen(true)}
              onShowHTMLImport={() => {
                setHtmlImportChapterId(undefined);
                setHtmlImportTopicId(undefined);
                setIsHTMLImportOpen(true);
              }}
              onShowManagePYQVault={() => setIsManagePYQVaultOpen(true)}
              onShowManageLiveTests={() => setIsManageLiveTestsOpen(true)}
              onShowManageExamCategories={() => setIsManageCategoriesOpen(true)}
              onBulkDeleteQuestions={(ids: string[]) => handleBulkDeleteQuestions(ids)}
            />
          </AdminErrorBoundary>
        )}

        {activeTab === 'notifications' && (
          <NotificationsPage
            notifications={notifications}
            onUpdateNotifications={handleUpdateNotifications}
            onBack={() => setActiveTab('home')}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
            onStartSession={handleStartSession}
            onOpenFullExam={() => setIsFullExamOpen(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            progressStore={progressStore}
            settings={settings}
            subjects={combinedSubjects}
            chapters={combinedChapters}
            questions={combinedQuestions}
            onStartSession={handleStartSession}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'news' && (
          <NewsPage
            initialSlug={selectedArticleSlug}
            isAuthenticated={isAuthenticated}
            onOpenLogin={() => setIsLoginOpen(true)}
            onNavigateHome={() => setActiveTab('home')}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
            onSelectArticleSlug={(slug: string | null) => setSelectedArticleSlug(slug)}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'about' && (
          <AboutPage
            onNavigateHome={() => setActiveTab('home')}
            onStartPracticing={() => setActiveTab('topics')}
            onOpenPrivacyPolicy={() => setActiveTab('privacy-policy')}
            onOpenTerms={() => setActiveTab('terms-of-service')}
            onOpenContact={() => setActiveTab('contact')}
            onOpenDisclaimer={() => setActiveTab('disclaimer')}
          />
        )}

        {activeTab === 'privacy-policy' && (
          <PrivacyPolicyPage
            onNavigateHome={() => setActiveTab('home')}
            onStartPracticing={() => setActiveTab('topics')}
            onOpenAbout={() => setActiveTab('about')}
            onOpenTerms={() => setActiveTab('terms-of-service')}
            onOpenContact={() => setActiveTab('contact')}
            onOpenDisclaimer={() => setActiveTab('disclaimer')}
          />
        )}

        {activeTab === 'terms-of-service' && (
          <TermsOfServicePage
            onNavigateHome={() => setActiveTab('home')}
            onStartPracticing={() => setActiveTab('topics')}
            onOpenAbout={() => setActiveTab('about')}
            onOpenPrivacyPolicy={() => setActiveTab('privacy-policy')}
            onOpenContact={() => setActiveTab('contact')}
            onOpenDisclaimer={() => setActiveTab('disclaimer')}
          />
        )}

        {activeTab === 'contact' && (
          <ContactUsPage
            onNavigateHome={() => setActiveTab('home')}
            onStartPracticing={() => setActiveTab('topics')}
            onOpenAbout={() => setActiveTab('about')}
            onOpenPrivacyPolicy={() => setActiveTab('privacy-policy')}
            onOpenTerms={() => setActiveTab('terms-of-service')}
            onOpenDisclaimer={() => setActiveTab('disclaimer')}
          />
        )}

        {activeTab === 'disclaimer' && (
          <DisclaimerPage
            onNavigateHome={() => setActiveTab('home')}
            onStartPracticing={() => setActiveTab('topics')}
            onOpenAbout={() => setActiveTab('about')}
            onOpenPrivacyPolicy={() => setActiveTab('privacy-policy')}
            onOpenTerms={() => setActiveTab('terms-of-service')}
            onOpenContact={() => setActiveTab('contact')}
          />
        )}

        {(activeTab === 'not_found' || (!isKnownTab(activeTab) && activeTab !== 'analyzer')) && (
          <NotFoundView onNavigateTab={(tab) => setActiveTab(tab)} />
        )}
        </React.Suspense>
        </RouteErrorBoundary>
      </main>

      {/* Bottom Navigation (Student view only; Admin has its own specialized management bottom bar) */}
      {activeTab !== 'admin' && (
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab: ActiveTab) => {
            if (tab === activeTab) {
              // Re-tapping current active tab resets drill-down state to section root
              setSelectedArticleSlug(null);
              setSelectedSubjectId(null);
              setSelectedChapterId(null);
              setSelectedTopicId(null);
              setSelectedCoachingId(null);
              setSelectedExamId(null);
              setSelectedSeriesId(null);
              setActiveSession(null);
              return;
            }
            setSelectedArticleSlug(null);
            setSelectedSubjectId(null);
            setSelectedChapterId(null);
            setSelectedTopicId(null);
            setSelectedCoachingId(null);
            setSelectedExamId(null);
            setSelectedSeriesId(null);
            setActiveSession(null);
            setActiveTab(tab);
          }}
          isAdmin={isAdmin}
        />
      )}

      {/* Modals & Overlays */}
      <React.Suspense fallback={null}>
      {isLoginOpen && (
        <LoginPage
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={(profile: any) => {
            setUserProfile(profile);
            setIsAuthenticated(true);
            saveUserProfile(profile);
            setIsLoginOpen(false);
            if (isUserAdmin(profile)) {
              setActiveTab('admin');
            } else {
              setActiveTab('home');
            }
          }}
        />
      )}

      {isSettingsOpen && (
        <AppSettingsModal
          settings={settings}
          onUpdateSettings={(newSettings: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSettings }))}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isApiSettingsOpen && (
        <ApiSettingsModal
          settings={settings}
          onUpdateSettings={(newSettings: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSettings }))}
          onClose={() => setIsApiSettingsOpen(false)}
        />
      )}

      {isPDFOpen && (
        <PDFExportModal
          subjects={combinedSubjects}
          chapters={combinedChapters}
          progressStore={progressStore}
          onClose={() => setIsPDFOpen(false)}
        />
      )}

      {isFullExamOpen && (
        <OverlayErrorBoundary
          viewName="Full Exam Simulation"
          onClose={() => setIsFullExamOpen(false)}
        >
          <FullExamModal
            isOpen={isFullExamOpen}
            onClose={() => setIsFullExamOpen(false)}
            allQuestions={combinedQuestions}
            chapters={combinedChapters}
            subjects={combinedSubjects}
            progressStore={progressStore}
            settings={settings}
            onUpdateProgress={handleUpdateProgress}
            onToggleBookmark={handleToggleBookmark}
          />
        </OverlayErrorBoundary>
      )}

      {isCustomTestOpen && (
        <OverlayErrorBoundary
          viewName="Custom Test"
          onClose={() => setIsCustomTestOpen(false)}
        >
          <CustomSmartTestModal
            chapters={combinedChapters}
            allQuestions={combinedQuestions}
            perfStore={{}}
            onClose={() => setIsCustomTestOpen(false)}
            onStartTest={handleStartSession}
          />
        </OverlayErrorBoundary>
      )}

      {!activeSession && selectedChapterId && (
        <OverlayErrorBoundary
          viewName="Chapter Detail"
          onClose={() => setSelectedChapterId(null)}
          onReset={() => setSelectedChapterId(null)}
        >
          <ChapterDetailView
            chapterId={selectedChapterId}
            chaptersMap={chaptersMap}
            selectedTopicId={selectedTopicId}
            onSelectTopic={(topId: string | null) => setSelectedTopicId(topId)}
            onBack={() => {
              // Hierarchical back: return to subject view
              if (selectedChapterId) {
                setSelectedChapterId(null);
              } else if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back();
              }
            }}
            onStartSession={handleStartSession}
            onAddTopic={(chapId: string, topic: any) => handleAddTopic(chapId, topic)}
            onEditTopic={(topic: any) => handleEditTopic(topic)}
            onRemoveTopic={(topicId: string) => handleDeleteTopic(topicId)}
            onAddQuestions={(chapId?: string, topId?: string) => {
              setAddQuestionsChapterId(chapId || undefined);
              setAddQuestionsTopicId(topId || undefined);
              setIsAddQuestionsOpen(true);
            }}
            isAdmin={isAdmin}
          />
        </OverlayErrorBoundary>
      )}

      {activeSession && (
        <OverlayErrorBoundary
          viewName="MCQ Practice Session"
          onClose={handleCloseSession}
          onReset={handleCloseSession}
        >
          <MCQSessionModal
            session={activeSession}
            settings={settings}
            userProfile={userProfile}
            questionsMap={questionsMap}
            chaptersMap={chaptersMap}
            onUpdateProgress={handleUpdateProgress}
            onToggleBookmark={handleToggleBookmark}
            onClose={handleCloseSession}
            onStartNewSession={handleStartSession}
            onUpdateSettings={(newSet: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSet }))}
          />
        </OverlayErrorBoundary>
      )}

      {(activeTab === 'analyzer' || isExamAnalyzerOpen) && (
        <OverlayErrorBoundary
          viewName="Exam Paper Analyzer"
          onClose={() => {
            setIsExamAnalyzerOpen(false);
            if (activeTab === 'analyzer') setActiveTab('home');
          }}
        >
          <ExamPaperAnalyzerModal
            isOpen={true}
            onClose={() => {
              setIsExamAnalyzerOpen(false);
              if (activeTab === 'analyzer') setActiveTab('home');
            }}
            subjects={combinedSubjects}
            chapters={combinedChapters}
            questions={combinedQuestions}
            onStartSession={handleStartSession}
            onNavigateToChapter={(chapId: string) => {
              setSelectedChapterId(chapId);
              setIsExamAnalyzerOpen(false);
              if (activeTab === 'analyzer') setActiveTab('topics');
            }}
          />
        </OverlayErrorBoundary>
      )}

      {/* Curriculum Admin Modals */}
      {isAddSubjectOpen && (
        <AddSubjectModal
          existingSubjectsCount={combinedSubjects.length}
          existingSubjects={combinedSubjects}
          onAddSubject={(subject: any) => handleAddSubject(subject)}
          onClose={() => setIsAddSubjectOpen(false)}
        />
      )}

      {isAddChapterOpen && (
        <AddChapterModal
          chapters={combinedChapters}
          subjects={combinedSubjects}
          initialSubjectId={addChapterSubjectId}
          onAddChapter={(chapter: any) => handleAddChapter(chapter)}
          onClose={() => setIsAddChapterOpen(false)}
        />
      )}

      {isAddTopicOpen && (
        <AddTopicModal
          subjects={combinedSubjects}
          chapters={combinedChapters}
          initialSubjectId={addTopicSubjectId}
          initialChapterId={addTopicChapterId}
          onAddTopic={(chapId: string, topic: any) => handleAddTopic(chapId, topic)}
          onClose={() => setIsAddTopicOpen(false)}
          onOpenAddChapter={(subId?: string) => {
            setIsAddTopicOpen(false);
            setAddChapterSubjectId(subId || undefined);
            setIsAddChapterOpen(true);
          }}
        />
      )}

      {isManageSyllabusOpen && (
        <ManageSyllabusModal
          subjects={combinedSubjects}
          chapters={combinedChapters}
          onClose={() => setIsManageSyllabusOpen(false)}
          onEditSubject={(subject: any) => handleEditSubject(subject)}
          onRemoveSubject={(id: string) => handleDeleteSubject(id)}
          onEditChapter={(chapter: any) => handleEditChapter(chapter)}
          onRemoveChapter={(id: string) => handleDeleteChapter(id)}
          onEditTopic={(topic: any) => handleEditTopic(topic)}
          onRemoveTopic={(id: string, chapterId?: string) => handleDeleteTopic(id, chapterId)}
          onShowAddTopic={(subId?: string, chapId?: string) => {
            setIsManageSyllabusOpen(false);
            setAddTopicSubjectId(subId || undefined);
            setAddTopicChapterId(chapId || undefined);
            setIsAddTopicOpen(true);
          }}
          onShowAddChapter={(subId?: string) => {
            setIsManageSyllabusOpen(false);
            setAddChapterSubjectId(subId || undefined);
            setIsAddChapterOpen(true);
          }}
        />
      )}

      {isAddQuestionsOpen && (
        <AddQuestionsModal
          chapters={combinedChapters}
          subjects={combinedSubjects}
          initialSubjectId={addQuestionsSubjectId}
          initialChapterId={addQuestionsChapterId}
          initialTopicId={addQuestionsTopicId}
          initialMethod={addQuestionsMethod}
          onClose={() => setIsAddQuestionsOpen(false)}
          onImportQuestions={(questions: any, committed?: boolean) => handleImportQuestions(questions, !!committed)}
        />
      )}

      {isManageQuestionsOpen && (
        <ManageQuestionsModal
          chapters={combinedChapters}
          onClose={() => setIsManageQuestionsOpen(false)}
          onEditQuestion={(q: any) => handleEditQuestion(q)}
          onDeleteQuestion={(id: string) => handleDeleteQuestion(id)}
          onBulkDeleteQuestions={(ids: string[]) => handleBulkDeleteQuestions(ids)}
          onBulkMoveQuestions={(ids: string[], targetChId: string, targetTopId: string) => handleBulkMoveQuestions(ids, targetChId, targetTopId)}
          onAddQuestions={(chapId?: string, topId?: string, method?: any) => {
            setIsManageQuestionsOpen(false);
            setAddQuestionsChapterId(chapId || undefined);
            setAddQuestionsTopicId(topId || undefined);
            setAddQuestionsMethod((method as any) || "paste");
            setIsAddQuestionsOpen(true);
          }}
          onShowHTMLImport={(chapId?: string, topId?: string) => {
            setIsManageQuestionsOpen(false);
            setHtmlImportChapterId(chapId);
            setHtmlImportTopicId(topId);
            setIsHTMLImportOpen(true);
          }}
        />
      )}

      {isHTMLImportOpen && (
        <HTMLImportMCQModal
          isOpen={isHTMLImportOpen}
          chapters={combinedChapters}
          subjects={combinedSubjects}
          questionsStore={questionsStore}
          initialChapterId={htmlImportChapterId}
          initialTopicId={htmlImportTopicId}
          onClose={() => setIsHTMLImportOpen(false)}
          onImportQuestions={(questions: any, committed?: boolean) => handleImportQuestions(questions, !!committed)}
        />
      )}

      {isManageCategoriesOpen && (
        <ManageExamCategoriesModal onClose={() => setIsManageCategoriesOpen(false)} />
      )}

      {isAIImportOpen && (
        <AIImportModal
          isOpen={isAIImportOpen}
          questionsStore={questionsStore}
          chapters={combinedChapters}
          subjects={combinedSubjects}
          onClose={() => setIsAIImportOpen(false)}
          onImportQuestions={(questions: any, committed?: boolean) => handleImportQuestions(questions, !!committed)}
        />
      )}

      {isManagePYQVaultOpen && (
        <ManagePYQVaultModal
          isOpen={isManagePYQVaultOpen}
          chapters={combinedChapters}
          subjects={combinedSubjects}
          onClose={() => setIsManagePYQVaultOpen(false)}
        />
      )}

      {isManageLiveTestsOpen && (
        <ManageLiveTestsModal 
          onClose={() => setIsManageLiveTestsOpen(false)} 
          chapters={combinedChapters}
          subjects={combinedSubjects}
        />
      )}

      {isGlobalSearchOpen && (
        <GlobalSearchModal
          isOpen={isGlobalSearchOpen}
          onClose={() => setIsGlobalSearchOpen(false)}
          onSelectQuestion={(q: any) => {
            handleStartSession({
              title: "लक्षित प्रश्न अभ्यास",
              subtitle: `${q.examCategory || "General"} • Quick Practice`,
              questionIds: [q.id],
              extraQuestions: [q],
              source: "all-chapters",
            });
          }}
          onSelectTopic={(t: any) => {
            setSelectedTopicId(t.id);
            setActiveTab("topics");
          }}
          onSelectPaper={() => {
            setActiveTab("pyq_vault");
          }}
        />
      )}



      </React.Suspense>
    </div>
  );
}
