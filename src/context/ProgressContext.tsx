import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ProgressStore, QuestionProgress } from '../types';
import { loadProgressFromStorage, saveProgressToStorage } from '../utils/storage';

interface ProgressContextType {
  progressStore: ProgressStore;
  updateProgress: (updater: (prev: ProgressStore) => ProgressStore) => void;
  toggleBookmark: (questionId: string) => void;
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

  const toggleBookmark = useCallback((questionId: string) => {
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
      const newStatus = !existing.bookmarked;
      
      // Persist in local IndexedDB bookmarks repository & queue
      import("../utils/localDatabaseEngine").then(({ setLocalBookmark }) => {
        import("../lib/firebase").then(({ auth }) => {
          const uid = auth.currentUser?.uid || "guest";
          setLocalBookmark(questionId, newStatus, uid).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});

      return {
        ...prev,
        [questionId]: {
          ...existing,
          bookmarked: newStatus,
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
