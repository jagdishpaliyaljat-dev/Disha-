import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ProgressStore } from '../types';
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
      const existing = prev[questionId] || {};
      return {
        ...prev,
        [questionId]: {
          ...existing,
          bookmarked: !existing.bookmarked,
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
