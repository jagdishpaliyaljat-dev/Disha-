import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { UserQuestionsStore } from '../types';
import { loadUserQuestionsStore, saveUserQuestionsStore } from '../utils/questionsStorage';

interface QuestionsContextType {
  questionsStore: UserQuestionsStore;
  setQuestionsStore: React.Dispatch<React.SetStateAction<UserQuestionsStore>>;
  updateStore: (updater: (prev: UserQuestionsStore) => UserQuestionsStore) => void;
}

const QuestionsContext = createContext<QuestionsContextType | undefined>(undefined);

export const QuestionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [questionsStore, setQuestionsStore] = useState<UserQuestionsStore>(() => loadUserQuestionsStore());

  React.useEffect(() => {
    const handleStoreUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<UserQuestionsStore>;
      const detail = customEvent.detail as any;
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

    window.addEventListener("disha2020_store_updated", handleStoreUpdate);
    window.addEventListener("quizpro_store_updated", handleStoreUpdate);
    return () => {
      window.removeEventListener("disha2020_store_updated", handleStoreUpdate);
      window.removeEventListener("quizpro_store_updated", handleStoreUpdate);
    };
  }, []);

  const updateStore = useCallback((updater: (prev: UserQuestionsStore) => UserQuestionsStore) => {
    setQuestionsStore(prev => {
      const next = updater(prev);
      saveUserQuestionsStore(next);
      return next;
    });
  }, []);

  return (
    <QuestionsContext.Provider value={{ questionsStore, setQuestionsStore, updateStore }}>
      {children}
    </QuestionsContext.Provider>
  );
};

export const useQuestions = () => {
  const context = useContext(QuestionsContext);
  if (context === undefined) {
    throw new Error('useQuestions must be used within a QuestionsProvider');
  }
  return context;
};
