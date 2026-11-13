import React, { ReactNode } from "react";
import { QuestionsProvider } from './QuestionsContext';
import { ProgressProvider } from './ProgressContext';

export const QuizProProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <QuestionsProvider>
      <ProgressProvider>
        {children}
      </ProgressProvider>
    </QuestionsProvider>
  );
};
