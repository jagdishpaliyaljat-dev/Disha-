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
import { FirebaseSavedBanner } from './components/FirebaseSavedBanner';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { BrandSplashAndOnboarding } from './components/BrandSplashAndOnboarding';
import { AdminErrorBoundary } from './components/admin/AdminErrorBoundary';
import { useFirebaseSync, mergeRealtimeProgressDelta, mergeRealtimeHistoryDelta } from './hooks/useFirebaseSync';
import { useNavigation } from './hooks/useNavigation';
import { useCurriculumManager } from './hooks/useCurriculumManager';
import { loadUserProfile, saveUserProfile, isUserAdmin } from './utils/userProfileStorage';
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
import { auth, db } from './lib/firebase';
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

// Navigation helpers for deep-linking and browser history synchronization
function getInitialNavigationState() {
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

  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  let tab: ActiveTab = 'home';
  let articleSlug: string | null = null;
  let coachingId: string | null = null;
  let examId: string | null = null;
  let seriesId: string | null = null;

  if (path.startsWith('/news')) {
    tab = 'news';
    articleSlug = path.split('/news/')[1]?.split('/')[0] || null;
  } else if (path.startsWith('/test-series') || path.startsWith('/test_series')) {
    tab = 'test_series';
    const parts = path.split('/');
    const coachingIdx = parts.indexOf('coaching');
    if (coachingIdx !== -1 && parts[coachingIdx + 1]) {
      coachingId = decodeURIComponent(parts[coachingIdx + 1]);
    }
    const examIdx = parts.indexOf('exam');
    if (examIdx !== -1 && parts[examIdx + 1]) {
      examId = decodeURIComponent(parts[examIdx + 1]);
    }
    const seriesIdx = parts.indexOf('series');
    if (seriesIdx !== -1 && parts[seriesIdx + 1]) {
      seriesId = decodeURIComponent(parts[seriesIdx + 1]);
    }
  } else if (path.startsWith('/topics')) {
    tab = 'topics';
  } else if (path.startsWith('/pyq_vault')) {
    tab = 'pyq_vault';
  } else if (path.startsWith('/live_tests')) {
    tab = 'live_tests';
  } else if (path.startsWith('/wrong')) {
    tab = 'wrong';
  } else if (path.startsWith('/profile')) {
    tab = 'profile';
  } else if (path.startsWith('/admin')) {
    tab = 'admin';
  } else if (path.startsWith('/notifications')) {
    tab = 'notifications';
  } else if (path.startsWith('/analytics')) {
    tab = 'analytics';
  } else if (path.startsWith('/about')) {
    tab = 'about';
  } else if (path.startsWith('/privacy-policy')) {
    tab = 'privacy-policy';
  } else if (path.startsWith('/terms-of-service')) {
    tab = 'terms-of-service';
  } else if (path.startsWith('/contact')) {
    tab = 'contact';
  } else if (path.startsWith('/disclaimer')) {
    tab = 'disclaimer';
  }

  return {
    tab,
    articleSlug,
    subjectId: searchParams.get('subject') || null,
    chapterId: searchParams.get('chapter') || null,
    topicId: searchParams.get('topic') || null,
    coachingId,
    examId,
    seriesId,
  };
}

function buildCanonicalPath(
  tab: ActiveTab,
  slug: string | null,
  subjectId: string | null,
  chapterId: string | null,
  topicId: string | null,
  coachingId: string | null,
  examId: string | null,
  seriesId: string | null,
  hasSession: boolean
): string {
  if (tab === 'home') return '/';
  if (tab === 'news') {
    return slug ? `/news/${slug}` : '/news';
  }
  if (tab === 'test_series') {
    let pathStr = '/test-series';
    if (coachingId) {
      pathStr += `/coaching/${encodeURIComponent(coachingId)}`;
      if (examId) {
        pathStr += `/exam/${encodeURIComponent(examId)}`;
        if (seriesId) {
          pathStr += `/series/${encodeURIComponent(seriesId)}`;
        }
      }
    }
    if (hasSession) {
      pathStr += '?session=1';
    }
    return pathStr;
  }

  const params = new URLSearchParams();
  if (tab === 'topics') {
    if (subjectId) params.set('subject', subjectId);
    if (chapterId) params.set('chapter', chapterId);
    if (topicId) params.set('topic', topicId);
  }
  if (hasSession) {
    params.set('session', '1');
  }

  const qs = params.toString();
  return `/${tab}${qs ? `?${qs}` : ''}`;
}

export default function App() {
  const initialNavState = React.useMemo(() => getInitialNavigationState(), []);
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
    const prompted = localStorage.getItem("quizpro_notification_prompted");
    if (!prompted && typeof window !== "undefined" && "Notification" in window) {
      localStorage.setItem("quizpro_notification_prompted", "true");
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

  const {
    subscribeToCurriculum,
    subscribeToUserProgressAndHistory,
    loadUserData,
    flushBufferedWrites,
  } = useFirebaseSync(isAuthenticated, userProfile);

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
      const uid = userProfile?.id || auth.currentUser?.uid || "guest";
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
      const uid = userProfile?.id || auth.currentUser?.uid || "guest";
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

    window.addEventListener('quizpro-user-tier-updated', handleTierUpdated);

    return () => {
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
      if (event.state && event.state.quizProTestActive) {
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

      // 4. Parse new URL after back action
      if (path === '/' || path === '/home') {
        setActiveTab('home');
        setSelectedArticleSlug(null);
        setSelectedSubjectId(null);
        setSelectedChapterId(null);
        setSelectedTopicId(null);
        setSelectedCoachingId(null);
        setSelectedExamId(null);
        setSelectedSeriesId(null);
      } else if (path.startsWith('/news')) {
        setActiveTab('news');
        const slug = path.split('/news/')[1]?.split('/')[0] || null;
        setSelectedArticleSlug(slug);
        setSelectedSubjectId(null);
        setSelectedChapterId(null);
        setSelectedTopicId(null);
      } else if (path.startsWith('/test-series') || path.startsWith('/test_series')) {
        setActiveTab('test_series');
        const parts = path.split('/');
        let coachingId: string | null = null;
        let examId: string | null = null;
        let seriesId: string | null = null;

        const coachingIdx = parts.indexOf('coaching');
        if (coachingIdx !== -1 && parts[coachingIdx + 1]) {
          coachingId = decodeURIComponent(parts[coachingIdx + 1]);
        }
        const examIdx = parts.indexOf('exam');
        if (examIdx !== -1 && parts[examIdx + 1]) {
          examId = decodeURIComponent(parts[examIdx + 1]);
        }
        const seriesIdx = parts.indexOf('series');
        if (seriesIdx !== -1 && parts[seriesIdx + 1]) {
          seriesId = decodeURIComponent(parts[seriesIdx + 1]);
        }

        setSelectedCoachingId(coachingId);
        setSelectedExamId(examId);
        setSelectedSeriesId(seriesId);
        setSelectedArticleSlug(null);
        setSelectedSubjectId(null);
        setSelectedChapterId(null);
        setSelectedTopicId(null);
      } else if (path.startsWith('/topics')) {
        setActiveTab('topics');
        setSelectedArticleSlug(null);
        setSelectedSubjectId(searchParams.get('subject') || null);
        setSelectedChapterId(searchParams.get('chapter') || null);
        setSelectedTopicId(searchParams.get('topic') || null);
      } else {
        const tab = path.slice(1).split('?')[0].split('/')[0] as ActiveTab;
        setActiveTab(tab || 'home');
        setSelectedArticleSlug(null);
        setSelectedSubjectId(null);
        setSelectedChapterId(null);
        setSelectedTopicId(null);
      }
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

  // Sync with Firebase & view count
  React.useEffect(() => {
    const unsubscribe = subscribeToCurriculum((updates: any) => {
      if (updates) {
        setQuestionsStore((prev) => {
          const next = { ...prev, ...updates };
          saveUserQuestionsStore(next);
          return next;
        });
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [subscribeToCurriculum]);

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
    window.addEventListener("quizpro_store_updated", handleStoreUpdated);
    return () => window.removeEventListener("quizpro_store_updated", handleStoreUpdated);
  }, []);

  // Initialize QuizPro Local-First Engine (Migration + Strict 24h Sync Coordinator)
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

  // Real-time cross-device user progress & revision history synchronization
  React.useEffect(() => {
    const unsubscribe = subscribeToUserProgressAndHistory(
      (progressDeltas) => {
        updateProgress((prev) => {
          const { merged, changedCount } = mergeRealtimeProgressDelta(prev, progressDeltas);
          return changedCount > 0 ? merged : prev;
        });
      },
      (historyDeltas) => {
        try {
          const localHist = loadStudyHistoryFromStorage();
          const { merged, changedCount } = mergeRealtimeHistoryDelta(localHist, historyDeltas);
          if (changedCount > 0) {
            saveStudyHistoryToStorage(merged);
          }
        } catch {}
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [subscribeToUserProgressAndHistory, updateProgress]);

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
          flushBufferedWrites('app_resume').catch(() => {});
        }
      })
      .catch(() => {});

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushStateOnBackground);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushStateOnBackground);
    };
  }, [progressStore, settings, updateProgress, userProfile, flushBufferedWrites]);

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
      visits = parseInt(localStorage.getItem('quizpro_visitor_count') || '1240', 10);
    } catch {}
    setViewCount(visits);

    // Defer network count check so initial UI paint completes immediately
    const timer = setTimeout(() => {
      import('./utils/firebaseSyncService').then(({ getAndUpdateViewCountAsync }) => {
        getAndUpdateViewCountAsync().then((realVisits) => {
          if (realVisits && realVisits > visits) {
            setViewCount(realVisits);
          }
        }).catch(() => {});
      }).catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Firebase Auth State Listener
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      if (auth && typeof auth.onAuthStateChanged === 'function') {
        unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
          setIsAuthReady(true);
          
          if (firebaseUser) {
            // User is signed in to Firebase Auth
            const { fetchUserProfileFromCloud } = await import('./utils/firebaseSyncService');
            
            let profile: UserProfile | null = null;
            try {
              profile = await fetchUserProfileFromCloud(firebaseUser.uid);
            } catch (err) {
              console.warn("Could not fetch remote profile on auth change:", err);
            }

            const emailLower = (firebaseUser.email || "").trim().toLowerCase();
            const { ADMIN_EMAILS, ADMIN_UIDS } = await import('./utils/userProfileStorage');
            const isAdminUser = Boolean((firebaseUser.email && ADMIN_EMAILS.includes(emailLower)) || ADMIN_UIDS.includes(firebaseUser.uid));

            if (!profile) {
              profile = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || "Student",
                email: firebaseUser.email || "",
                photoURL: firebaseUser.photoURL || "",
                role: isAdminUser ? "admin" : "student",
                status: "active",
                createdAt: new Date().toISOString(),
              };
            } else if (isAdminUser || profile.role === "admin") {
              profile.role = "admin";
            }

            setUserProfile(profile);
            setIsAuthenticated(true);
            saveUserProfile(profile);

            // Non-destructively restore and merge cloud progress, bookmarks & revision history
            try {
              const cloudData = await loadUserData();
              if (cloudData?.progress && Object.keys(cloudData.progress).length > 0) {
                updateProgress((prev) => {
                  const merged: ProgressStore = { ...cloudData.progress, ...prev };
                  Object.keys(cloudData.progress).forEach((qId) => {
                    const remoteP = cloudData.progress[qId];
                    const localP = prev[qId];
                    if (localP && remoteP) {
                      merged[qId] = {
                        ...remoteP,
                        ...localP,
                        bookmarked: Boolean(localP.bookmarked || remoteP.bookmarked),
                        timesAttempted: Math.max(localP.timesAttempted || 0, remoteP.timesAttempted || 0),
                      };
                    }
                  });
                  return merged;
                });
              }
              if (cloudData?.history && Object.keys(cloudData.history).length > 0) {
                const { loadStudyHistoryFromStorage, saveStudyHistoryToStorage } = await import('./utils/storage');
                const localHist = loadStudyHistoryFromStorage();
                const mergedHist = { ...cloudData.history, ...localHist };
                Object.keys(cloudData.history).forEach((dateKey) => {
                  const rH = cloudData.history[dateKey];
                  const lH = localHist[dateKey];
                  if (lH && rH) {
                    mergedHist[dateKey] = {
                      correct: Math.max(lH.correct || 0, rH.correct || 0),
                      wrong: Math.max(lH.wrong || 0, rH.wrong || 0),
                    };
                  }
                });
                saveStudyHistoryToStorage(mergedHist);
              }
            } catch {}
          } else {
            // Keep existing loaded profile if available without wiping
            const currentProfile = loadUserProfile();
            if (currentProfile) {
               setUserProfile(currentProfile);
               setIsAuthenticated(true);
            }
          }
        });
      } else {
        setIsAuthReady(true);
      }
    } catch (e) {
      console.warn('[App] Could not initialize auth listener:', e);
      setIsAuthReady(true);
    }

    return () => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch {}
    };
  }, []);

  // Supabase Auth State Listener
  React.useEffect(() => {
    let unsub = () => {};
    import('./lib/supabase').then(({ supabase, isSupabaseConfigured }) => {
      if (!isSupabaseConfigured()) return;

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const u = session.user;
          const emailLower = (u.email || "").trim().toLowerCase();
          import('./utils/userProfileStorage').then(({ ADMIN_EMAILS, ADMIN_UIDS, saveUserProfile: saveProfile }) => {
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
          }).catch(() => {});
        }
      }).catch(() => {});

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const u = session.user;
          const emailLower = (u.email || "").trim().toLowerCase();
          import('./utils/userProfileStorage').then(({ ADMIN_EMAILS, ADMIN_UIDS, saveUserProfile: saveProfile }) => {
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
            } else {
              setActiveTab("home");
            }
            setIsLoginOpen(false);
          }).catch(() => {});
        }
      });

      unsub = () => {
        subscription?.unsubscribe();
      };
    }).catch(() => {});

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  const isAdmin = userProfile ? isUserAdmin(userProfile) : false;

  // Track page views dynamically on activeTab navigation
  React.useEffect(() => {
    const path = activeTab === 'home' ? '/' : `/${activeTab}`;
    const title = `DISHA 20-20 — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`;
    trackPageView(path, title, { isUserAdmin: isAdmin, isLoggedIn: isAuthenticated }).catch(() => {});
  }, [activeTab, isAdmin, isAuthenticated]);

  // Sync profile to cloud on boot or change
  React.useEffect(() => {
    if (isAuthenticated && userProfile) {
      import('./utils/firebaseSyncService').then(({ syncUserProfileToCloud }) => {
        syncUserProfileToCloud(userProfile).catch(err => {
          console.warn("Background profile sync failed:", err);
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

  const handleLogout = () => {
    auth.signOut().catch(() => {});
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
      addToast('success', 'Backend Sync Success', 'Question updated in Supabase!');
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
      addToast('success', 'Backend Sync Success', 'Question removed from Supabase!');
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
      addToast('success', 'Backend Sync Success', `${res.count || questionIds.length} questions removed from Supabase!`);
    } else {
      addToast('error', 'Delete Notice', 'Failed to remove questions from backend');
    }
  };

  const handleBulkMoveQuestions = async (questionIds: string[], targetChapterId: string, targetTopicId: string) => {
    const questionsMap = getCombinedQuestionsMap(combinedQuestions);
    const targetChapter = combinedChapters.find(c => c.id === targetChapterId);
    const targetSubjectId = targetChapter?.subjectId;

    // 1. Move questions in cloud using batched in-place update (prevents ID regeneration & copies)
    const { moveMCQsInCloud } = await import('./utils/firebaseSyncService');
    const cloudRes = await moveMCQsInCloud(
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
        cloudRes.isFirebase ? 'Firebase Sync' : 'Local Move',
        `${cloudRes.movedCount} question(s) moved to "${targetChapter?.title || "selected chapter"}" successfully!`
      );
    } else {
      addToast('error', 'Firebase Move Error', cloudRes.message);
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
      <FirebaseSavedBanner />
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
        </React.Suspense>
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab: ActiveTab) => {
          if (tab !== activeTab) {
            setSelectedArticleSlug(null);
            setSelectedSubjectId(null);
            setSelectedChapterId(null);
            setSelectedTopicId(null);
            setActiveSession(null);
            setActiveTab(tab);
          }
        }}
        isAdmin={isAdmin}
      />

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
      )}

      {isCustomTestOpen && (
        <CustomSmartTestModal
          chapters={combinedChapters}
          allQuestions={combinedQuestions}
          perfStore={{}}
          onClose={() => setIsCustomTestOpen(false)}
          onStartTest={handleStartSession}
        />
      )}

      {!activeSession && selectedChapterId && (
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
      )}

      {activeSession && (
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
      )}

      {(activeTab === 'analyzer' || isExamAnalyzerOpen) && (
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
      )}

      {/* Curriculum Admin Modals */}
      {isAddSubjectOpen && (
        <AddSubjectModal
          existingSubjectsCount={combinedSubjects.length}
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
