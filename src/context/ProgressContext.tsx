import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { BookmarkReasonTag, ProgressStore, QuestionProgress } from '../types';
import { loadProgressFromStorage, saveProgressToStorage } from '../utils/storage';

interface ProgressContextType {
  progressStore: ProgressStore;
  updateProgress: (updater: (prev: ProgressStore) => ProgressStore) => void;
  toggleBookmark: (questionId: string, tag?: BookmarkReasonTag | null) => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progressStore, setProgressStore] = useState<ProgressStore>(() => loadProgressFromStorage());

  const updateProgress = useCallback((updater: (prev: ProgressStore) => ProgressStore) => {
    setProgressStore(prev => {
      const next = updater(prev);
      saveProgressToStorage(next);
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((questionId: string, tag?: BookmarkReasonTag | null) => {
    updateProgress((prev) => {
      const defaultProgress: QuestionProgress = {
        status: "unattempted",
        stage: 0,
        nextReviewAt: "",
        wrongCount: 0,
        bookmarked: false,
        lastAnsweredAt: null,
      };
      const existing = prev[questionId] || defaultProgress;
      const newStatus = tag !== undefined ? true : !existing.bookmarked;
      const nextTag = tag === null
        ? undefined
        : tag !== undefined
        ? tag
        : newStatus
        ? existing.bookmarkTag
        : undefined;
      
      // Persist in local IndexedDB bookmarks repository and sync to Supabase
      import("../utils/localDatabaseEngine").then(({ setLocalBookmark }) => {
        import("../lib/supabase").then(({ supabase, isSupabaseConfigured }) => {
          if (isSupabaseConfigured()) {
            supabase.auth.getUser().then(({ data: { user } }) => {
              const uid = user?.id || "guest";
              setLocalBookmark(questionId, newStatus, uid, nextTag).catch(() => {});
              if (user?.id) {
                import("../utils/supabaseSyncService").then(({ toggleBookmarkInSupabase }) => {
                  toggleBookmarkInSupabase(questionId, newStatus, user.id).catch(() => {});
                }).catch(() => {});
              }
            }).catch(() => {
              setLocalBookmark(questionId, newStatus, "guest", nextTag).catch(() => {});
            });
          } else {
            setLocalBookmark(questionId, newStatus, "guest", nextTag).catch(() => {});
          }
        }).catch(() => {});
      }).catch(() => {});

      return {
        ...prev,
        [questionId]: {
          ...existing,
          bookmarked: newStatus,
          bookmarkTag: nextTag,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, [updateProgress]);

  return (
    <ProgressContext.Provider value={{ progressStore, updateProgress, toggleBookmark }}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};
