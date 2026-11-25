import * as React from "react";
import { Analytics } from '@vercel/analytics/react';
import { useQuestions } from './context/QuestionsContext';
import { useProgress } from './context/ProgressContext';
import { 
  ActiveTab, 
  AppSettings, 
  UserProfile, 
  MCQSession,
  Subject,
  Chapter,
  Topic,
  Question,
  QuestionProgress,
  ProgressStore,
  AppNotification,
  BookmarkReasonTag,
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
  Bell,
  Ban,
  LogOut,
  Video,
  Crown,
  Sparkles,
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { DishaAITutorModal, FloatingAIAssistant } from './components/DishaAITutorModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastNotificationContainer, ToastMessage } from './components/ToastNotification';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { MobileAppReturnBanner } from './components/MobileAppReturnBanner';
import { BrandSplashAndOnboarding } from './components/BrandSplashAndOnboarding';
import { AppLogo } from './components/AppLogo';
import { UserAvatar } from './components/ui/UserAvatar';
import { ContentLoader } from './components/ui/LoadingScreen';
import { AdminErrorBoundary } from './components/admin/AdminErrorBoundary';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { OverlayErrorBoundary } from './components/OverlayErrorBoundary';
import { NotFoundView } from './components/NotFoundView';
import { useNavigation } from './hooks/useNavigation';
import { useCurriculumManager } from './hooks/useCurriculumManager';
import { useAppFeatures } from './utils/featureControlService';
import { isFeatureVipLocked } from './services/payment/premiumConfigService';
import { loadUserProfile, saveUserProfile, isUserAdmin, isProfileAuthenticated } from './utils/userProfileStorage';
import { setSentryUser, clearSentryUser } from './utils/sentryInit';
import { resolvePathToNavigationState, buildCanonicalPath, isKnownTab } from './utils/routeNavigation';
import { prefetchCoreRoutes } from './utils/routePrefetcher';
import { loadSettingsFromStorage, saveSettingsToStorage, loadProgressFromStorage, saveProgressToStorage, recordStudyAnswerToHistory, loadStudyHistoryFromStorage, saveStudyHistoryToStorage, mergeRealtimeProgressDelta } from './utils/storage';
import { loadNotifications, saveNotifications } from './utils/notificationsStorage';
import { getTodayDateString, calculateNextProgress } from './utils/revision';
import { AppUpdateModal } from './components/AppUpdateModal';
import { appConfigService, GlobalAppConfig } from './utils/appConfigService';
import { CURRENT_APP_VERSION, checkAppUpdateStatus } from './utils/versionUtils';
import { trackPageView } from './utils/analytics';
import { triggerHaptic } from './utils/audioFeedback';
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
import {
  safeGetSessionStorageItem,
  safeSetSessionStorageItem,
  safeRemoveSessionStorageItem,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
  safeRemoveLocalStorageItem,
} from './utils/safeStorage';

// Helper for resilient dynamic imports with clean React 19 reconciler compatibility, retry with backoff, and chunk auto-recovery
function safeLazy<T extends React.ComponentType<any>>(
  importFn: () => Promise<any>,
  exportName?: string
): T {
  return React.lazy(() => {
    const attemptImport = (attemptsLeft: number): Promise<any> => {
      return importFn().catch((err) => {
        if (attemptsLeft <= 0) throw err;
        console.warn(`[safeLazy] Retrying dynamic import (${attemptsLeft} tries left)...`, err);
        return new Promise((resolve) => setTimeout(resolve, 600)).then(() => attemptImport(attemptsLeft - 1));
      });
    };

    return attemptImport(2)
      .catch((err) => {
        console.warn('[safeLazy] Dynamic import failed after retries, checking chunk error...', err);
        const errMsg = String(err?.message || '');
        const isChunkFail =
          errMsg.includes('dynamically imported module') ||
          errMsg.includes('Loading chunk') ||
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('ChunkLoadError') ||
          err?.name === 'ChunkLoadError';

        if (isChunkFail && typeof window !== 'undefined') {
          const RELOAD_KEY = 'disha_chunk_reload_lock';
          const lastReload = safeGetSessionStorageItem(RELOAD_KEY);
          if (!lastReload || Date.now() - Number(lastReload) > 15000) {
            safeSetSessionStorageItem(RELOAD_KEY, String(Date.now()));
            const targetUrl = `/?recovery=1&_t=${Date.now()}`;
            if (typeof caches !== 'undefined') {
              caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).finally(() => {
                (window as Window).location.replace(targetUrl);
              });
              return new Promise(() => {});
            } else {
              (window as Window).location.replace(targetUrl);
              return new Promise(() => {});
            }
          }
        }
        throw err;
      })
      .then((mod) => {
        const component = exportName ? mod[exportName] || mod.default : mod.default || Object.values(mod)[0];
        if (!component) {
          throw new Error(`Module export '${exportName || 'default'}' not found`);
        }
        return { default: component };
      });
  }) as unknown as T;
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
const LiveBattleModal = safeLazy<typeof import('./components/battle/LiveBattleModal').LiveBattleModal>(() => import('./components/battle/LiveBattleModal'), 'LiveBattleModal');
const PremiumUpgradeModal = safeLazy<typeof import('./components/payment/PremiumUpgradeModal').PremiumUpgradeModal>(() => import('./components/payment/PremiumUpgradeModal'), 'PremiumUpgradeModal');

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
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(() => isProfileAuthenticated(userProfile));
  const [settings, setSettings] = React.useState<AppSettings>(() => loadSettingsFromStorage());
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const { isEnabled: isFeatureEnabled } = useAppFeatures();

  // Guard disabled features: redirect to home if current tab is disabled by admin
  React.useEffect(() => {
    if (activeTab === 'live_tests' && !isFeatureEnabled('live_tests')) {
      setActiveTab('home');
    }
  }, [activeTab, isFeatureEnabled, setActiveTab]);

  // Remote App Configuration & Version Control State
  const [appConfig, setAppConfig] = React.useState<GlobalAppConfig>(() => appConfigService.getConfig());
  const [isUpdateDismissed, setIsUpdateDismissed] = React.useState(false);

  React.useEffect(() => {
    const unsub = appConfigService.subscribe(setAppConfig);
    appConfigService.fetchFromCloud().then(setAppConfig).catch(() => {});
    return unsub;
  }, []);

  const updateInfo = React.useMemo(() => {
    return checkAppUpdateStatus(CURRENT_APP_VERSION, appConfig);
  }, [appConfig]);

  const isUpdateModalOpen = updateInfo.status !== 'UP_TO_DATE' && (updateInfo.isHardLock || !isUpdateDismissed);

  const [notifications, setNotifications] = React.useState<AppNotification[]>(() => loadNotifications());
  const unreadNotificationsCount = React.useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleUpdateNotifications = React.useCallback((next: AppNotification[]) => {
    setNotifications(next);
    saveNotifications(next);
  }, []);

  // React to live notifications from student objection resolutions & broadcasts
  React.useEffect(() => {
    const handleNotificationsUpdate = () => {
      setNotifications(loadNotifications());
    };
    window.addEventListener("disha_notifications_updated", handleNotificationsUpdate);
    window.addEventListener("storage", handleNotificationsUpdate);
    return () => {
      window.removeEventListener("disha_notifications_updated", handleNotificationsUpdate);
      window.removeEventListener("storage", handleNotificationsUpdate);
    };
  }, []);

  // Fetch active Supabase broadcast announcements and merge for student
  React.useEffect(() => {
    let active = true;
    const syncBroadcastAnnouncements = async () => {
      try {
        const { fetchActiveBroadcasts, mergeBroadcastsIntoUserNotifications } = await import("./utils/broadcastNotificationService");
        const cloudBroadcasts = await fetchActiveBroadcasts();
        if (active && cloudBroadcasts.length > 0) {
          setNotifications((prev) => {
            const { updatedNotifications, newCount } = mergeBroadcastsIntoUserNotifications(
              prev,
              cloudBroadcasts,
              userProfile?.targetExam
            );
            if (newCount > 0 || updatedNotifications.length !== prev.length) {
              saveNotifications(updatedNotifications);
              return updatedNotifications;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("[App] Broadcast sync note:", err);
      }
    };

    syncBroadcastAnnouncements();
    return () => {
      active = false;
    };
  }, [userProfile?.targetExam]);

  // Real-Time Online Presence Tracking via Supabase
  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { initStudentPresence } = await import("./utils/presenceService");
        cleanup = initStudentPresence({
          page: activeTab,
          isLoggedIn: isAuthenticated,
          targetExam: userProfile?.targetExam,
          userName: userProfile?.name,
        });
      } catch (err) {
        console.warn("[App] Presence init note:", err);
      }
    })();
    return () => {
      if (cleanup) cleanup();
    };
  }, [isAuthenticated, userProfile?.targetExam, userProfile?.name]);

  // Update presence active page on tab change
  React.useEffect(() => {
    import("./utils/presenceService")
      .then(({ updateStudentPresencePage }) => {
        updateStudentPresencePage(activeTab);
      })
      .catch(() => {});
  }, [activeTab]);

  // Background district detection for regional Rajasthan analytics
  React.useEffect(() => {
    import("./utils/analytics")
      .then(({ detectAndCacheDistrict }) => detectAndCacheDistrict())
      .catch(() => {});
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
    try {
      const prompted = safeGetLocalStorageItem("disha2020_notification_prompted") || safeGetLocalStorageItem("quizpro_notification_prompted");
      if (!prompted && typeof window !== "undefined" && "Notification" in window) {
        safeSetLocalStorageItem("disha2020_notification_prompted", "true");
        const timer = setTimeout(async () => {
          try {
            if (Notification.permission === "default") {
              const perm = await Notification.requestPermission();
              if (perm === "granted") {
                new Notification("Disha PYQ — Welcome!", {
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
    } catch {}
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

  const handleToggleBookmark = (questionId: string, tag?: BookmarkReasonTag | null) => {
    const nowIso = new Date().toISOString();
    const existing = progressStore[questionId] || ({} as Partial<QuestionProgress>);
    const nextBookmarked = tag !== undefined ? true : !existing.bookmarked;
    const nextTag =
      tag === null
        ? undefined
        : tag !== undefined
        ? tag
        : nextBookmarked
        ? existing.bookmarkTag
        : undefined;

    const updatedItem: QuestionProgress = {
      ...existing,
      bookmarked: nextBookmarked,
      bookmarkTag: nextTag,
      updatedAt: nowIso,
    } as QuestionProgress;

    updateProgress((prev) => {
      const prevExisting = prev[questionId] || ({} as Partial<QuestionProgress>);
      return {
        ...prev,
        [questionId]: {
          ...prevExisting,
          bookmarked: nextBookmarked,
          bookmarkTag: nextTag,
          updatedAt: nowIso,
        } as QuestionProgress,
      };
    });

    bufferProgressUpdate(questionId, updatedItem, { userProfile });

    import("./utils/localDatabaseEngine").then(({ setLocalBookmark }) => {
      const uid = userProfile?.id || "guest";
      setLocalBookmark(questionId, nextBookmarked, uid, nextTag).catch(() => {});
    }).catch(() => {});
  };
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = React.useState(false);
  const [isPDFOpen, setIsPDFOpen] = React.useState(false);
  const [isFullExamOpen, setIsFullExamOpen] = React.useState(false);
  const [isCustomTestOpen, setIsCustomTestOpen] = React.useState(false);
  const [isExamAnalyzerOpen, setIsExamAnalyzerOpen] = React.useState(false);
  const [isLiveBattleOpen, setIsLiveBattleOpen] = React.useState(false);
  const [battleInitialRoomCode, setBattleInitialRoomCode] = React.useState<string>("");
  const [isAITutorOpen, setIsAITutorOpen] = React.useState(false);
  const [aiTutorContextQuestion, setAiTutorContextQuestion] = React.useState<Question | null>(null);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = React.useState(false);
  const [premiumFeatureTrigger, setPremiumFeatureTrigger] = React.useState<"ai_tutor" | "mock_tests" | "profile" | "general" | "pdf_export" | "live_battle" | "mistake_bank" | "state_merit_rank">("general");
  const [viewCount, setViewCount] = React.useState<number>(1240);

  // Check for direct battle invite link (?battle=CODE or ?room=CODE)
  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        let battleCode = urlParams.get("battle") || urlParams.get("room") || urlParams.get("quiz");

        if (!battleCode && window.location.hash) {
          const hashMatch = window.location.hash.match(/(?:battle|room)=([A-Za-z0-9]{4,8})/i);
          if (hashMatch) {
            battleCode = hashMatch[1];
          }
        }

        if (battleCode && battleCode.trim().length >= 4) {
          const cleanCode = battleCode.trim().toUpperCase();
          setBattleInitialRoomCode(cleanCode);
          setIsLiveBattleOpen(true);
        }
      }
    } catch (e) {
      console.error("[Battle Link] Error parsing URL query params:", e);
    }
  }, []);
  React.useEffect(() => {
    const handleOpenAITutor = (e: any) => {
      if (e?.detail?.question) {
        setAiTutorContextQuestion(e.detail.question);
      }
      setIsAITutorOpen(true);
    };

    window.addEventListener("disha2020_open_ai_tutor", handleOpenAITutor);
    window.addEventListener("quizpro_open_ai_tutor", handleOpenAITutor);

    return () => {
      window.removeEventListener("disha2020_open_ai_tutor", handleOpenAITutor);
      window.removeEventListener("quizpro_open_ai_tutor", handleOpenAITutor);
    };
  }, []);

  // Global event listener to sync tier upgrades and VIP subscriptions
  React.useEffect(() => {
    const handleTierUpdated = () => setUserProfile(loadUserProfile());

    const handleOpenPremium = (e: any) => {
      setPremiumFeatureTrigger(e?.detail?.trigger || "general");
      setIsPremiumModalOpen(true);
    };

    const handleSubscriptionUpdated = async () => {
      if (userProfile?.id) {
        try {
          const { fetchUserProfileFromSupabase } = await import("./utils/supabaseSyncService");
          const remote = await fetchUserProfileFromSupabase(userProfile.id);
          if (remote) {
            setUserProfile((prev: any) => ({ ...prev, ...remote }));
            saveUserProfile(remote);
          }
        } catch {}
      } else {
        setUserProfile(loadUserProfile());
      }
    };

    window.addEventListener('disha2020-user-tier-updated', handleTierUpdated);
    window.addEventListener('quizpro-user-tier-updated', handleTierUpdated);
    window.addEventListener('disha_open_premium_modal', handleOpenPremium);
    window.addEventListener('disha_subscription_updated', handleSubscriptionUpdated);

    return () => {
      window.removeEventListener('disha2020-user-tier-updated', handleTierUpdated);
      window.removeEventListener('quizpro-user-tier-updated', handleTierUpdated);
      window.removeEventListener('disha_open_premium_modal', handleOpenPremium);
      window.removeEventListener('disha_subscription_updated', handleSubscriptionUpdated);
    };
  }, [userProfile?.id]);

  // Check for return from Cashfree official hosted payment page (?order_id=...)
  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const urlParams = new URLSearchParams(window.location.search);
      const returnedOrderId = urlParams.get("order_id");
      if (returnedOrderId) {
        import("./services/payment/cashfreeService").then(async ({ verifyCashfreeOrder }) => {
          const res = await verifyCashfreeOrder(returnedOrderId);
          if (res.success || res.isPremium) {
            addToast('success', 'VIP पास सक्रिय!', '🎉 बधाई हो! आपका Disha VIP पास आधिकारिक रूप से सक्रिय हो गया है!');
          }
          // If user paid in Chrome Custom Tabs or mobile browser, return to app via deep link
          if (window.location.hostname !== "localhost" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
            setTimeout(() => {
              try {
                window.location.href = `disha2020://auth-callback?order_id=${returnedOrderId}`;
              } catch (_) {}
            }, 1500);
          } else {
            // Clean order_id from browser URL without reloading
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("order_id");
            window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ""));
          }
        });
      }
    } catch (e) {
      console.warn("[Cashfree Return] Error checking order_id:", e);
    }
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

  // Detect URL query parameter for Live Quiz Battle (e.g. ?battle=849201 via WhatsApp invite)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const battleCode = params.get('battle');
      if (battleCode) {
        setBattleInitialRoomCode(battleCode.toUpperCase().trim());
        setIsLiveBattleOpen(true);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // In-app session close that cleans up URL and selected topic state
  const handleCloseSession = React.useCallback(() => {
    setActiveSession(null);
    setSelectedTopicId(null);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('session')) {
        url.searchParams.delete('session');
      }
      const cleanSearch = url.searchParams.toString();
      // Strip trailing topic slug so back navigation returns cleanly to chapter
      const cleanPath = url.pathname.replace(/\/topic_[^/?#]+|\/custom-topic-[^/?#]+/, '');
      const cleanUrl = cleanPath + (cleanSearch ? `?${cleanSearch}` : '');
      window.history.replaceState(
        { ...window.history.state, hasSession: false, topicId: null, dishaTestActive: false, quizProTestActive: false },
        '',
        cleanUrl
      );
    }
  }, []);

  const isAnyModalOpen = Boolean(
    isAITutorOpen || isLoginOpen || isSettingsOpen || isApiSettingsOpen || isPDFOpen ||
    isFullExamOpen || isCustomTestOpen || isExamAnalyzerOpen ||
    isLiveBattleOpen || isAddSubjectOpen || isAddChapterOpen ||
    isAddTopicOpen || isAddQuestionsOpen || isManageSyllabusOpen || isManageQuestionsOpen ||
    isManageCategoriesOpen || isManagePYQVaultOpen || isManageLiveTestsOpen ||
    isAIImportOpen || isHTMLImportOpen || isGlobalSearchOpen
  );

  const modalHistoryPushedRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isAnyModalOpen) {
      if (!modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = true;
        try {
          window.history.pushState({ dishaModalOpen: true }, '', window.location.href);
        } catch (_) {}
      }
    } else {
      if (modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = false;
        if (window.history.state?.dishaModalOpen) {
          try {
            window.history.back();
          } catch (_) {}
        }
      }
    }
  }, [isAnyModalOpen]);

  // Handle Android Back button, browser Back button and gesture PopState navigation
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;
      if (modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = false;
      }

      const path = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const hasSessionParam = searchParams.get('session') === '1';
      const wasSessionActive = Boolean(activeSession);

      // 1. If URL no longer has session=1, clear activeSession immediately
      if (!hasSessionParam && activeSession) {
        setActiveSession(null);
        setSelectedTopicId(null);
      }

      // 2. If this is a sentinel state from MCQSessionModal (Back button protection),
      if (event.state && (event.state.dishaTestActive || event.state.quizProTestActive)) {
        return;
      }

      // 3. Close open modal overlays first to prevent unwanted page navigation
      if (isAITutorOpen) { setIsAITutorOpen(false); setAiTutorContextQuestion(null); return; }
      if (isLoginOpen) { setIsLoginOpen(false); return; }
      if (isSettingsOpen) { setIsSettingsOpen(false); return; }
      if (isApiSettingsOpen) { setIsApiSettingsOpen(false); return; }
      if (isPDFOpen) { setIsPDFOpen(false); return; }
      if (isFullExamOpen) { setIsFullExamOpen(false); return; }
      if (isCustomTestOpen) { setIsCustomTestOpen(false); return; }
      if (isExamAnalyzerOpen) { setIsExamAnalyzerOpen(false); return; }
      if (isLiveBattleOpen) { setIsLiveBattleOpen(false); return; }
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
      // If user backed out of an active session, do not re-open the topic modal
      if (!wasSessionActive) {
        setSelectedTopicId(parsed.topicId);
      } else {
        setSelectedTopicId(null);
      }
      setSelectedCoachingId(parsed.coachingId);
      setSelectedExamId(parsed.examId);
      setSelectedSeriesId(parsed.seriesId);
    };


    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    activeSession, isLoginOpen, isSettingsOpen, isApiSettingsOpen, isPDFOpen, isFullExamOpen,
    isCustomTestOpen, isExamAnalyzerOpen, isLiveBattleOpen, isAddSubjectOpen, isAddChapterOpen,
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

    const handleOnline = () => {
      rehydrateStudentWriteBuffer()
        .then(async () => {
          if (hasPendingStudentWrites()) {
            await flushStudentWriteBuffer({ trigger: 'online_resume', userProfile });
          }
        })
        .catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushStateOnBackground);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushStateOnBackground);
      window.removeEventListener('online', handleOnline);
    };
  }, [progressStore, settings, updateProgress, userProfile]);

  React.useEffect(() => {
    saveSettingsToStorage(settings);
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (settings.darkMode && settings.amoledBlack) {
      document.documentElement.classList.add('amoled-black');
    } else {
      document.documentElement.classList.remove('amoled-black');
    }
  }, [settings]);

  const handleCycleTheme = React.useCallback(() => {
    triggerHaptic('light');
    setSettings((prev) => {
      if (!prev.darkMode) {
        return { ...prev, darkMode: true, amoledBlack: false };
      } else if (!prev.amoledBlack) {
        return { ...prev, darkMode: true, amoledBlack: true };
      } else {
        return { ...prev, darkMode: false, amoledBlack: false };
      }
    });
  }, []);

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
          const [
            { isSuperAdmin, saveUserProfile: saveProfile, loadUserProfile: loadLocalProfile },
            { fetchUserProfileFromSupabase }
          ] = await Promise.all([
            import('./utils/userProfileStorage'),
            import('./utils/supabaseSyncService'),
          ]);

          // 1. Check if user is Super Admin
          const isSuper = isSuperAdmin(emailLower) || isSuperAdmin(u.id);

          // 2. Fetch remote profile from Supabase to verify persistent database role
          let remoteProfile: any = null;
          try {
            remoteProfile = await fetchUserProfileFromSupabase(u.id);
          } catch (fetchErr) {
            console.warn("Could not fetch remote profile on session restore:", fetchErr);
          }

          // 3. Fallback: check stored local profile
          const localProfile = loadLocalProfile();
          const hasAdminRole = Boolean(
            isSuper ||
            remoteProfile?.role === "admin" ||
            (localProfile?.id === u.id && localProfile?.role === "admin")
          );

          const profile: UserProfile = {
            id: u.id,
            name: remoteProfile?.name || remoteProfile?.displayName || u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Student",
            email: u.email || "",
            photoURL: remoteProfile?.photoURL || u.user_metadata?.avatar_url || u.user_metadata?.picture || "",
            role: hasAdminRole ? "admin" : "student",
            status: remoteProfile?.status || "active",
            createdAt: remoteProfile?.createdAt || u.created_at || new Date().toISOString(),
          };
          setUserProfile(profile);
          setIsAuthenticated(true);
          saveProfile(profile);
          setSentryUser(profile.id);

          // Direct immediate sync to Supabase database & user directory on login
          try {
            const [{ syncUserProfileToSupabase }, { registerUserToDirectory }] = await Promise.all([
              import('./utils/supabaseSyncService'),
              import('./utils/userManagementStorage'),
            ]);
            syncUserProfileToSupabase(profile).catch(() => {});
            registerUserToDirectory(profile).catch(() => {});
          } catch (syncErr) {
            console.warn("Immediate profile sync note:", syncErr);
          }

          // Only force admin view on (re)login when the admin hasn't explicitly
          // chosen to browse the student app. This keeps "Return to Student App"
          // from being overridden by the session restore redirect.
          const preferStudentView = safeGetSessionStorageItem("disha_admin_view_mode") === "student";
          if (hasAdminRole && !preferStudentView) {
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

          // If running in mobile browser and this was a fresh OAuth redirect with tokens:
          try {
            const { isNativePlatform, isMobileBrowser, getAppDeepLinkFromSession } = await import('./utils/mobileAuthService');
            if (!isNativePlatform() && isMobileBrowser() && session?.access_token && session?.refresh_token) {
              const hashHasTokens = typeof window !== 'undefined' && (
                window.location.hash.includes('access_token=') ||
                window.location.search.includes('code=')
              );
              if (hashHasTokens) {
                const deepLink = getAppDeepLinkFromSession(session.access_token, session.refresh_token);
                // Attempt automatic handover to the installed Disha 20-20 App
                window.location.href = deepLink;
              }
            }
          } catch {}
        } else {
          // Restore local cached profile if user was previously in guest/offline mode
          const currentProfile = loadUserProfile();
          if (currentProfile && isProfileAuthenticated(currentProfile)) {
            setUserProfile(currentProfile);
            setIsAuthenticated(true);
            setSentryUser(currentProfile.id);
          } else {
            setUserProfile(currentProfile);
            setIsAuthenticated(false);
            clearSentryUser();
          }
        }
      };

      // Native Capacitor Deep Link Listener & Cold-Start check
      let cleanupDeepLink = () => {};
      import('./utils/mobileAuthService').then(({ registerMobileDeepLinkListener, checkLaunchUrlForAuth }) => {
        cleanupDeepLink = registerMobileDeepLinkListener((session) => {
          processSession(session).catch(() => {});
        });
        checkLaunchUrlForAuth((session) => {
          processSession(session).catch(() => {});
        });
      }).catch(() => {});

      supabase.auth.getSession().then(({ data: { session } }) => {
        processSession(session).catch(() => {});
      }).catch(() => {
        setIsAuthReady(true);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        processSession(session).catch(() => {});
      });

      unsub = () => {
        try { cleanupDeepLink(); } catch {}
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

  // Real-time listener for user profile role updates (e.g., Super Admin promotes user)
  React.useEffect(() => {
    if (!isAuthenticated || !userProfile?.id) return;
    const currentUserId = userProfile.id;
    let channel: any = null;
    let isDisposed = false;

    import('./lib/supabase').then(({ supabase, isSupabaseConfigured }) => {
      if (isDisposed || !isSupabaseConfigured() || !supabase) return;

      const refreshCurrentProfile = async () => {
        try {
          const { fetchUserProfileFromSupabase } = await import('./utils/supabaseSyncService');
          const remote = await fetchUserProfileFromSupabase(currentUserId);
          if (isDisposed || !remote) return;

          const { isSuperAdmin, saveUserProfile: saveProfile } = await import('./utils/userProfileStorage');
          const isSuper = isSuperAdmin(remote.email) || isSuperAdmin(remote.id);
          const authoritativeRole = (isSuper || remote.role === "admin") ? "admin" : "student";

          setUserProfile((prev) => {
            if (!prev) return null;
            if (prev.role === authoritativeRole && prev.name === (remote.name || remote.displayName)) {
              return prev;
            }
            const updated: UserProfile = {
              ...prev,
              role: authoritativeRole,
              name: remote.name || remote.displayName || prev.name,
              displayName: remote.displayName || remote.name || prev.displayName,
              photoURL: remote.photoURL || prev.photoURL,
              status: remote.status || prev.status,
              blocked: Boolean(remote.blocked || remote.status === "blocked"),
            };
            saveProfile(updated);
            return updated;
          });

          if (authoritativeRole === "admin" && userProfile.role !== "admin") {
            try {
              const { showAdminToast } = await import('./utils/adminToast');
              showAdminToast("Congratulations! You have been granted Admin privileges. Admin Panel is now active.", "success");
            } catch {
              alert("Congratulations! You have been granted Admin privileges. Admin Panel is now active.");
            }
          }
        } catch (e) {
          console.warn("[ProfileSync] Auto-refresh check note:", e);
        }
      };

      // 1. Listen to Realtime WebSocket updates on profiles table
      try {
        channel = supabase
          .channel(`user-profile-sync-${currentUserId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${currentUserId}`,
            },
            (payload) => {
              console.log("[Supabase Realtime] Profile update received:", payload.new);
              refreshCurrentProfile();
            }
          )
          .subscribe();
      } catch (subErr) {
        console.warn("[Supabase Realtime] Profile subscription error:", subErr);
      }

      // 2. Also refresh on window focus / app return
      const handleAppFocus = () => {
        refreshCurrentProfile();
      };
      window.addEventListener("focus", handleAppFocus);
      document.addEventListener("visibilitychange", handleAppFocus);

      // 3. Initial check right now in case promotion happened just before
      refreshCurrentProfile();

      return () => {
        window.removeEventListener("focus", handleAppFocus);
        document.removeEventListener("visibilitychange", handleAppFocus);
        if (channel && supabase) {
          try { supabase.removeChannel(channel); } catch {}
        }
      };
    }).catch(() => {});

    return () => {
      isDisposed = true;
    };
  }, [isAuthenticated, userProfile?.id]);

  // Background fetch of curriculum from Supabase on startup (non-destructive merge, single run)
  React.useEffect(() => {
    let isSubscribed = true;
    let syncThrottleTimeout: any = null;

    const syncFromSupabase = async (force: boolean = false) => {
      try {
        const { fetchFullAuthoritativeCurriculum } = await import('./utils/supabaseSyncService');
        const { subjects: subs, chapters: chaps, topics: tops, questions: mcqs } = await fetchFullAuthoritativeCurriculum({ force });
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

            // 4. Server questions take authoritative place in cloudCacheQuestions, respecting local deletions
            const deletedSet = new Set(prev.deletedQuestionIds || []);
            const serverMcqsMap = new Map<string, Question>();
            (mcqs || []).forEach(q => {
              if (q && q.id && !deletedSet.has(q.id)) serverMcqsMap.set(q.id, q);
            });
            (prev.cloudCacheQuestions || []).forEach(q => {
              if (q && q.id && !deletedSet.has(q.id) && !serverMcqsMap.has(q.id)) {
                serverMcqsMap.set(q.id, q);
              }
            });
            const mergedMcqs = Array.from(serverMcqsMap.values());

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
      } catch (syncErr) {
        console.warn("[App] Background Supabase sync notice:", syncErr);
      }
    };

    // Initial startup fetch (with authoritative server check)
    syncFromSupabase(true);

    // Guarded external event handler (throttled to at most once per 10 seconds, NEVER loops)
    let lastHandledSync = 0;
    const handleCurriculumSynced = () => {
      const now = Date.now();
      if (now - lastHandledSync < 10000) return; // 10s cooldown
      lastHandledSync = now;
      clearTimeout(syncThrottleTimeout);
      syncThrottleTimeout = setTimeout(() => {
        if (isSubscribed) syncFromSupabase(false);
      }, 1000);
    };

    // Supabase Realtime channel to automatically synchronize changes when admin publishes new items
    let realtimeChannel: any = null;
    import("./lib/supabase").then(({ supabase, isSupabaseConfigured }) => {
      if (!isSubscribed || !isSupabaseConfigured() || !supabase) return;

      try {
        realtimeChannel = supabase
          .channel("public:curriculum_realtime_stream")
          .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, () => handleCurriculumSynced())
          .on("postgres_changes", { event: "*", schema: "public", table: "chapters" }, () => handleCurriculumSynced())
          .on("postgres_changes", { event: "*", schema: "public", table: "topics" }, () => handleCurriculumSynced())
          .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, () => handleCurriculumSynced())
          .subscribe();
      } catch (err) {
        console.warn("[App] Realtime curriculum subscription notice:", err);
      }
    }).catch(() => {});

    window.addEventListener("disha2020_curriculum_synced", handleCurriculumSynced);
    window.addEventListener("quizpro_curriculum_synced", handleCurriculumSynced);
    return () => {
      isSubscribed = false;
      clearTimeout(syncThrottleTimeout);
      window.removeEventListener("disha2020_curriculum_synced", handleCurriculumSynced);
      window.removeEventListener("quizpro_curriculum_synced", handleCurriculumSynced);
      if (realtimeChannel) {
        import("./lib/supabase").then(({ supabase }) => {
          try { supabase.removeChannel(realtimeChannel); } catch {}
        }).catch(() => {});
      }
    };
  }, [setQuestionsStore]);

  const isAdmin = userProfile ? isUserAdmin(userProfile) : false;
  const isUserBlocked = Boolean(userProfile?.status === 'blocked' || userProfile?.blocked);

  // Track page views dynamically on activeTab navigation
  React.useEffect(() => {
    const path = activeTab === 'home' ? '/' : `/${activeTab}`;
    const title = `Disha PYQ — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`;
    trackPageView(path, title, { isUserAdmin: isAdmin, isLoggedIn: isAuthenticated }).catch(() => {});
  }, [activeTab, isAdmin, isAuthenticated]);

  // Sync profile to Supabase on boot or change for all users (student, guest, admin)
  React.useEffect(() => {
    if (userProfile && userProfile.id) {
      Promise.all([
        import('./utils/supabaseSyncService'),
        import('./utils/userManagementStorage'),
      ]).then(([{ syncUserProfileToSupabase }, { registerUserToDirectory }]) => {
        syncUserProfileToSupabase(userProfile).catch(err => {
          console.warn("Background profile sync note:", err?.message || err);
        });
        registerUserToDirectory(userProfile).catch(() => {});
      }).catch(() => {});
    }
  }, [userProfile, isAuthenticated]);

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
    const { clearUserProfile } = await import('./utils/userProfileStorage');
    clearUserProfile();
    safeRemoveSessionStorageItem("disha_admin_view_mode");
    safeRemoveLocalStorageItem("disha_user_progress_v2");
    safeRemoveLocalStorageItem("disha2020_progress");
    safeRemoveLocalStorageItem("disha2020_user_bookmarks_v1");
    safeRemoveLocalStorageItem("disha2020_student_reported_qids_v1");
    // BUG-06: Clear per-user test data to prevent leakage to next user on same device
    safeRemoveLocalStorageItem("remix_rajprep_live_submissions_v1");
    safeRemoveLocalStorageItem("remix_rajprep_pyq_attempts_v2");
    safeRemoveLocalStorageItem("economic_survey_test_history_v1");
    safeRemoveLocalStorageItem("disha2020_smart_test_records_v1");
    updateProgress(() => ({}));
    setUserProfile(null);
    setIsAuthenticated(false);
    clearSentryUser();
    setActiveTab('home');
  };

  // Toast Notifications State
  // Toast Notifications Handlers
  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Derived combined curriculum state with bulletproof error shielding
  const combinedSubjects = React.useMemo(() => {
    try {
      return getCombinedSubjects(questionsStore);
    } catch (e) {
      console.error("[Curriculum] Failed to derive combinedSubjects:", e);
      return [];
    }
  }, [questionsStore]);

  const combinedChapters = React.useMemo(() => {
    try {
      return getCombinedChapters(questionsStore);
    } catch (e) {
      console.error("[Curriculum] Failed to derive combinedChapters:", e);
      return [];
    }
  }, [questionsStore]);

  const combinedQuestions = React.useMemo(() => {
    try {
      return getCombinedQuestions(combinedChapters, questionsStore);
    } catch (e) {
      console.error("[Curriculum] Failed to derive combinedQuestions:", e);
      return [];
    }
  }, [combinedChapters, questionsStore]);

  const chaptersMap = React.useMemo(() => {
    try {
      return getCombinedChaptersMap(combinedChapters);
    } catch (e) {
      console.error("[Curriculum] Failed to derive chaptersMap:", e);
      return {} as Record<string, Chapter>;
    }
  }, [combinedChapters]);

  const questionsMap = React.useMemo(() => {
    try {
      return getCombinedQuestionsMap(combinedQuestions);
    } catch (e) {
      console.error("[Curriculum] Failed to derive questionsMap:", e);
      return {} as Record<string, Question>;
    }
  }, [combinedQuestions]);

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
      const { triggerDatabaseSavedToast } = await import('./utils/adminToast');
      triggerDatabaseSavedToast({
        type: "add",
        title: "Questions Live in Supabase!",
        message: `${newQuestions.length} new question(s) saved to Supabase and live in the app.`,
        count: newQuestions.length,
      });
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
        const { triggerDatabaseSavedToast } = await import('./utils/adminToast');
        triggerDatabaseSavedToast({
          type: "add",
          title: "Questions Live in Supabase!",
          message: `${newQuestions.length} new question(s) saved to Supabase and live in the app.`,
          count: newQuestions.length,
        });
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
        const { triggerDatabaseSavedToast } = await import('./utils/adminToast');
        triggerDatabaseSavedToast({
          type: "update",
          title: "Question Updated in Supabase!",
          message: "Question details have been updated live in Supabase.",
        });
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
        addToast('success', 'Moved to Recycle Bin', 'Question moved to Recycle Bin (Supabase synced)!');
        const { triggerAdminToast } = await import('./utils/adminToast');
        triggerAdminToast(
          "delete",
          "Question Moved to Recycle Bin",
          "The question has been safely moved to Question Recycle Bin for recovery.",
        );
      } else {
        addToast('info', 'Moved to Recycle Bin Locally', res.message);
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
        addToast('success', 'Moved to Recycle Bin', `${questionIds.length} question(s) moved to Recycle Bin!`);
        const { triggerAdminToast } = await import('./utils/adminToast');
        triggerAdminToast(
          "delete",
          "Questions Moved to Recycle Bin",
          `${questionIds.length} question(s) moved to Recycle Bin. You can restore them anytime.`,
          { count: questionIds.length }
        );
      } else {
        addToast('info', 'Moved to Recycle Bin Locally', res.message || `${questionIds.length} question(s) moved to Recycle Bin.`);
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
    safeSetSessionStorageItem("disha_admin_view_mode", tab === 'admin' ? "admin" : "student");
    if (tab !== activeTab) {
      setSelectedArticleSlug(null);
      setSelectedSubjectId(null);
      setSelectedChapterId(null);
      setSelectedTopicId(null);
      setActiveSession(null);
      setActiveTab(tab);
    }
  };

  // ─── ROOT AUTH GATE ──────────────────────────────────────────────────────────
  // 1. Session check in-flight: Show branded splash screen (prevents unauthenticated flicker)
  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 z-[999] bg-[#F4F1FA] dark:bg-[#171329] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#201B38] shadow-md flex items-center justify-center mb-4 p-2 border border-[#E2DCF0] dark:border-[#362E5B]">
          <AppLogo size="md" variant="symbol" />
        </div>
        <div className="w-6 h-6 border-3 border-[#7045D8] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-[#5E5873] dark:text-[#A39DBE] tracking-wider uppercase">
          Initializing Disha PYQ...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated Gate: Show ONLY the full-screen Google Login Screen
  if (!isAuthenticated || !userProfile || !isProfileAuthenticated(userProfile)) {
    return (
      <React.Suspense
        fallback={
          <div className="fixed inset-0 z-[999] bg-[#F4F1FA] dark:bg-[#171329] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-6 h-6 border-3 border-[#7045D8] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-[#5E5873] dark:text-[#A39DBE]">Loading Sign In...</p>
          </div>
        }
      >
        <ToastNotificationContainer toasts={toasts} onDismiss={handleDismissToast} />
        <LoginPage
          isMandatory={true}
          onLoginSuccess={(profile: UserProfile) => {
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
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#130E26] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col font-sans selection:bg-[#7045D8] selection:text-white w-full max-w-full overflow-x-hidden">
      <OverlayErrorBoundary viewName="System Overlays" fallbackComponent={null}>
        <BrandSplashAndOnboarding />
        <ToastNotificationContainer toasts={toasts} onDismiss={handleDismissToast} />
        <PWAUpdateToast />
        <OfflineIndicator />
        <MobileAppReturnBanner userName={userProfile?.name} />
        <Analytics />
      </OverlayErrorBoundary>

      {/* Desktop Top Navigation Header */}
      <OverlayErrorBoundary viewName="Desktop Navigation Header" fallbackComponent={null}>
        <header className="hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-[#171329]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#2D264E] select-none shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            {/* Brand Logo */}
            <div
              onClick={() => handleDesktopNavigateTab('home')}
              className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-[1.02] shrink-0"
              role="button"
              tabIndex={0}
              aria-label="Disha PYQ Home"
            >
              <span className="text-lg font-black tracking-tight text-[#171329] dark:text-[#FFFFFF] uppercase whitespace-nowrap">
                DISHA
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-[#7045D8] to-[#A78BFA] text-white font-black text-xs tracking-wide shadow-xs whitespace-nowrap">
                PYQ
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
                        ? 'bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#221B3E]'
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
                onClick={handleCycleTheme}
                className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#C99A45] active:scale-95 transition-all cursor-pointer"
                aria-label={!settings.darkMode ? 'Light Mode' : !settings.amoledBlack ? 'Charcoal Dark' : 'AMOLED Black'}
                title={!settings.darkMode ? 'Light Mode (Tap for Charcoal Dark)' : !settings.amoledBlack ? 'Charcoal Dark (Tap for AMOLED Black)' : 'AMOLED Black (Tap for Light)'}
              >
                {!settings.darkMode ? (
                  <Moon className="w-4 h-4 text-[#800020]" />
                ) : settings.amoledBlack ? (
                  <Sparkles className="w-4 h-4 text-amber-400" />
                ) : (
                  <Sun className="w-4 h-4 text-[#F47B20]" />
                )}
              </button>

              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => setIsLoginOpen(true)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-extrabold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDesktopNavigateTab('profile')}
                  className="w-9 h-9 rounded-full ring-2 ring-[#7045D8]/50 hover:ring-[#7045D8] flex items-center justify-center overflow-hidden active:scale-95 transition-all cursor-pointer bg-slate-100 dark:bg-[#201B38]"
                  aria-label="Profile"
                  title={userProfile?.name || 'User Profile'}
                >
                  <UserAvatar
                    name={userProfile?.name}
                    photoURL={userProfile?.photoURL}
                    sizeClassName="w-full h-full"
                  />
                </button>
              )}
            </div>
          </div>
        </header>
      </OverlayErrorBoundary>

      {/* Main Content Rendering */}
      <main className="flex-1 pb-16 md:pb-6">
        {isUserBlocked ? (
          <div className="max-w-xl mx-auto my-12 px-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 bg-white dark:bg-[#111A2E] rounded-3xl border-2 border-rose-500/30 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
                <Ban className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Account Suspended
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your student account has been suspended under administrative review or security policy. You cannot currently access quizzes, live tests, or AI services.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5 text-left">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Contact for Support & Appeals:</p>
                <p className="font-mono text-indigo-600 dark:text-indigo-400 select-all">disha2020prep@gmail.com</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-all cursor-pointer inline-flex items-center gap-2 shadow-md"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
        <RouteErrorBoundary tabName={activeTab} onNavigateHome={() => setActiveTab('home')}>
        <React.Suspense fallback={<ContentLoader message="Loading content..." submessage="Disha PYQ • Precision Learning" minHeight="min-h-[60vh]" />}>
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
            onOpenPDFExport={() => {
              setIsPDFOpen(true);
            }}
            onOpenFullExam={() => setIsFullExamOpen(true)}
            onOpenExamAnalyzer={() => setIsExamAnalyzerOpen(true)}
            onOpenApiSettings={() => setIsApiSettingsOpen(true)}
            onOpenLiveBattle={() => {
              setBattleInitialRoomCode('');
              setIsLiveBattleOpen(true);
            }}
            onOpenPremium={() => {
              setPremiumFeatureTrigger('general');
              setIsPremiumModalOpen(true);
            }}
            onToggleDarkMode={handleCycleTheme}
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
            onOpenPDFExport={() => {
              setIsPDFOpen(true);
            }}
            isAdmin={isAdmin}
            onEditTopic={(topic: Topic) => handleEditTopic(topic)}
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
            questions={combinedQuestions}
            onUpdateSettings={(newSettings: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSettings }))}
            onUpdateProfile={(updatedProfile: UserProfile) => {
              setUserProfile(updatedProfile);
              saveUserProfile(updatedProfile);
            }}
            onResetProgress={() => updateProgress(() => ({}))}
            onLogout={handleLogout}
            onNavigateTab={(tab: ActiveTab) => setActiveTab(tab)}
            onOpenPremium={() => {
              setPremiumFeatureTrigger('profile');
              setIsPremiumModalOpen(true);
            }}
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
              onLogout={handleLogout}
              onExitAdmin={() => {
                safeSetSessionStorageItem("disha_admin_view_mode", "student");
                setActiveTab('home');
              }}
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
            userProfile={userProfile}
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
        )}
      </main>

      {/* Bottom Navigation (Student view only; Admin has its own specialized management bottom bar) */}
      {activeTab !== 'admin' && !isUserBlocked && (
        <OverlayErrorBoundary viewName="Bottom Navigation" fallbackComponent={null}>
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
        </OverlayErrorBoundary>
      )}

      {/* Floating AI Assistant (Student view only; hidden in Admin, active test sessions, or when disabled) */}
      {activeTab !== 'admin' && !isUserBlocked && isFeatureEnabled('disha_ai') && (
        <FloatingAIAssistant
          onOpen={() => {
            setAiTutorContextQuestion(null);
            setIsAITutorOpen(true);
          }}
          isHidden={Boolean(activeSession || isFullExamOpen || isCustomTestOpen)}
        />
      )}

      {/* Disha AI Tutor Drawer / Modal */}
      {isAITutorOpen && !isUserBlocked && isFeatureEnabled('disha_ai') && (
        <DishaAITutorModal
          isOpen={isAITutorOpen}
          onClose={() => {
            setIsAITutorOpen(false);
            setAiTutorContextQuestion(null);
          }}
          contextQuestion={aiTutorContextQuestion}
          onClearContextQuestion={() => setAiTutorContextQuestion(null)}
          onOpenApiSettings={() => setIsApiSettingsOpen(true)}
          progressStore={progressStore}
          chapters={combinedChapters}
          subjects={combinedSubjects}
          questions={combinedQuestions}
          onStartSession={handleStartSession}
          onNavigateTab={(tab) => {
            if (isKnownTab(tab)) {
              setActiveTab(tab as ActiveTab);
            }
          }}
        />
      )}

      {/* Modals & Overlays */}
      <React.Suspense fallback={null}>
      {isLoginOpen && (
        <OverlayErrorBoundary viewName="Login Modal" onClose={() => setIsLoginOpen(false)}>
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
        </OverlayErrorBoundary>
      )}

      {isSettingsOpen && (
        <OverlayErrorBoundary viewName="App Settings Modal" onClose={() => setIsSettingsOpen(false)}>
          <AppSettingsModal
            settings={settings}
            onUpdateSettings={(newSettings: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSettings }))}
            onClose={() => setIsSettingsOpen(false)}
          />
        </OverlayErrorBoundary>
      )}

      {isApiSettingsOpen && (
        <OverlayErrorBoundary viewName="API Settings Modal" onClose={() => setIsApiSettingsOpen(false)}>
          <ApiSettingsModal
            settings={settings}
            onUpdateSettings={(newSettings: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSettings }))}
            onClose={() => setIsApiSettingsOpen(false)}
          />
        </OverlayErrorBoundary>
      )}

      {isPDFOpen && isFeatureEnabled('pdf_export') && (
        <OverlayErrorBoundary viewName="PDF Export Modal" onClose={() => setIsPDFOpen(false)}>
          <PDFExportModal
            subjects={combinedSubjects}
            chapters={combinedChapters}
            progressStore={progressStore}
            onClose={() => setIsPDFOpen(false)}
          />
        </OverlayErrorBoundary>
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
            userProfile={userProfile}
            onOpenLogin={() => setIsLoginOpen(true)}
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

      {isLiveBattleOpen && !isUserBlocked && isFeatureEnabled('live_battle') && (
        <OverlayErrorBoundary
          viewName="Live Quiz Battle"
          onClose={() => setIsLiveBattleOpen(false)}
        >
          <LiveBattleModal
            isOpen={isLiveBattleOpen}
            initialRoomCode={battleInitialRoomCode}
            onClose={() => setIsLiveBattleOpen(false)}
          />
        </OverlayErrorBoundary>
      )}

      {isPremiumModalOpen && (
        <OverlayErrorBoundary
          viewName="Disha VIP Premium Upgrade"
          onClose={() => setIsPremiumModalOpen(false)}
        >
          <PremiumUpgradeModal
            isOpen={isPremiumModalOpen}
            onClose={() => setIsPremiumModalOpen(false)}
            currentUser={userProfile}
            featureTrigger={premiumFeatureTrigger}
            onSuccess={() => {
              setIsPremiumModalOpen(false);
            }}
            onOpenLogin={() => {
              setIsPremiumModalOpen(false);
              setIsLoginOpen(true);
            }}
          />
        </OverlayErrorBoundary>
      )}

      {!activeSession && selectedChapterId && activeTab !== 'topics' && (
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
              // Hierarchical back: return to subject view cleanly
              setSelectedTopicId(null);
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
            onOpenLogin={() => setIsLoginOpen(true)}
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
        <OverlayErrorBoundary viewName="Add Subject Modal" onClose={() => setIsAddSubjectOpen(false)}>
          <AddSubjectModal
            existingSubjectsCount={combinedSubjects.length}
            existingSubjects={combinedSubjects}
            onAddSubject={(subject: any) => handleAddSubject(subject)}
            onClose={() => setIsAddSubjectOpen(false)}
          />
        </OverlayErrorBoundary>
      )}

      {isAddChapterOpen && (
        <OverlayErrorBoundary viewName="Add Chapter Modal" onClose={() => setIsAddChapterOpen(false)}>
          <AddChapterModal
            chapters={combinedChapters}
            subjects={combinedSubjects}
            initialSubjectId={addChapterSubjectId}
            onAddChapter={(chapter: any) => handleAddChapter(chapter)}
            onClose={() => setIsAddChapterOpen(false)}
          />
        </OverlayErrorBoundary>
      )}

      {isAddTopicOpen && (
        <OverlayErrorBoundary viewName="Add Topic Modal" onClose={() => setIsAddTopicOpen(false)}>
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
        </OverlayErrorBoundary>
      )}

      {isManageSyllabusOpen && (
        <OverlayErrorBoundary viewName="Manage Syllabus Modal" onClose={() => setIsManageSyllabusOpen(false)}>
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
        </OverlayErrorBoundary>
      )}

      {isAddQuestionsOpen && (
        <OverlayErrorBoundary viewName="Add Questions Modal" onClose={() => setIsAddQuestionsOpen(false)}>
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
        </OverlayErrorBoundary>
      )}

      {isManageQuestionsOpen && (
        <OverlayErrorBoundary viewName="Manage Questions Modal" onClose={() => setIsManageQuestionsOpen(false)}>
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
        </OverlayErrorBoundary>
      )}

      {isHTMLImportOpen && (
        <OverlayErrorBoundary viewName="HTML Import Modal" onClose={() => setIsHTMLImportOpen(false)}>
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
        </OverlayErrorBoundary>
      )}

      {isManageCategoriesOpen && (
        <OverlayErrorBoundary viewName="Manage Exam Categories Modal" onClose={() => setIsManageCategoriesOpen(false)}>
          <ManageExamCategoriesModal onClose={() => setIsManageCategoriesOpen(false)} />
        </OverlayErrorBoundary>
      )}

      {isAIImportOpen && (
        <OverlayErrorBoundary viewName="AI MCQ Importer Modal" onClose={() => setIsAIImportOpen(false)}>
          <AIImportModal
            isOpen={isAIImportOpen}
            questionsStore={questionsStore}
            chapters={combinedChapters}
            subjects={combinedSubjects}
            onClose={() => setIsAIImportOpen(false)}
            onImportQuestions={(questions: any, committed?: boolean) => handleImportQuestions(questions, !!committed)}
          />
        </OverlayErrorBoundary>
      )}

      {isManagePYQVaultOpen && (
        <OverlayErrorBoundary viewName="Manage PYQ Vault Modal" onClose={() => setIsManagePYQVaultOpen(false)}>
          <ManagePYQVaultModal
            isOpen={isManagePYQVaultOpen}
            chapters={combinedChapters}
            subjects={combinedSubjects}
            onClose={() => setIsManagePYQVaultOpen(false)}
          />
        </OverlayErrorBoundary>
      )}

      {isManageLiveTestsOpen && (
        <OverlayErrorBoundary viewName="Manage Live Tests Modal" onClose={() => setIsManageLiveTestsOpen(false)}>
          <ManageLiveTestsModal 
            onClose={() => setIsManageLiveTestsOpen(false)} 
            chapters={combinedChapters}
            subjects={combinedSubjects}
          />
        </OverlayErrorBoundary>
      )}

      {isGlobalSearchOpen && (
        <OverlayErrorBoundary viewName="Global Search Modal" onClose={() => setIsGlobalSearchOpen(false)}>
          <GlobalSearchModal
            isOpen={isGlobalSearchOpen}
            onClose={() => setIsGlobalSearchOpen(false)}
            onSelectQuestion={(q: any) => {
              handleStartSession({
                title: "Targeted Question Practice",
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
        </OverlayErrorBoundary>
      )}

      {/* Remote Version Control & Force Update Modal */}
      <AppUpdateModal
        isOpen={isUpdateModalOpen}
        updateInfo={updateInfo}
        onDismiss={() => setIsUpdateDismissed(true)}
      />



      {/* Eye Comfort Warm Reading Shield */}
      {settings.eyeComfort && (
        <div
          id="eye-comfort-shield-layer"
          aria-hidden="true"
          className="eye-comfort-filter-layer pointer-events-none"
        />
      )}

      </React.Suspense>
    </div>
  );
}
