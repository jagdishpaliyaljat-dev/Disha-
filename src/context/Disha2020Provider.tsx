import React, { ReactNode } from "react";
import { QuestionsProvider } from './QuestionsContext';
import { ProgressProvider } from './ProgressContext';

export const Disha2020Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <QuestionsProvider>
      <ProgressProvider>
        {children}
      </ProgressProvider>
    </QuestionsProvider>
  );
};

// Backward compatibility alias
export const QuizProProvider = Disha2020Provider;
