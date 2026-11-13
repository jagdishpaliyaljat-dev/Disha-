import React, { useState } from "react";

export const useModalState = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [isPDFOpen, setIsPDFOpen] = useState(false);
  const [isFullExamOpen, setIsFullExamOpen] = useState(false);
  const [isCustomTestOpen, setIsCustomTestOpen] = useState(false);
  const [isExamAnalyzerOpen, setIsExamAnalyzerOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [isAddQuestionsOpen, setIsAddQuestionsOpen] = useState(false);
  const [isManageSyllabusOpen, setIsManageSyllabusOpen] = useState(false);
  const [isManageQuestionsOpen, setIsManageQuestionsOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isManageBannersOpen, setIsManageBannersOpen] = useState(false);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [isManagePYQVaultOpen, setIsManagePYQVaultOpen] = useState(false);
  const [isManageLiveTestsOpen, setIsManageLiveTestsOpen] = useState(false);
  
  // Modal parameter states
  const [addChapterSubjectId, setAddChapterSubjectId] = useState<string | undefined>(undefined);
  const [addTopicSubjectId, setAddTopicSubjectId] = useState<string | undefined>(undefined);
  const [addTopicChapterId, setAddTopicChapterId] = useState<string | undefined>(undefined);
  const [addQuestionsChapterId, setAddQuestionsChapterId] = useState<string | undefined>(undefined);
  const [addQuestionsTopicId, setAddQuestionsTopicId] = useState<string | undefined>(undefined);
  const [addQuestionsSubjectId, setAddQuestionsSubjectId] = useState<string | undefined>(undefined);
  const [addQuestionsMethod, setAddQuestionsMethod] = useState<"json" | "file" | "paste" | "manual">("paste");

  const closeAllModals = () => {
    setIsLoginOpen(false);
    setIsSettingsOpen(false);
    setIsApiSettingsOpen(false);
    setIsPDFOpen(false);
    setIsFullExamOpen(false);
    setIsCustomTestOpen(false);
    setIsExamAnalyzerOpen(false);
    setIsAddSubjectOpen(false);
    setIsAddChapterOpen(false);
    setIsAddTopicOpen(false);
    setIsAddQuestionsOpen(false);
    setIsManageSyllabusOpen(false);
    setIsManageQuestionsOpen(false);
    setIsManageCategoriesOpen(false);
    setIsManageBannersOpen(false);
    setIsAIImportOpen(false);
    setIsManagePYQVaultOpen(false);
    setIsManageLiveTestsOpen(false);
    
    // Reset parameters
    setAddChapterSubjectId(undefined);
    setAddTopicSubjectId(undefined);
    setAddTopicChapterId(undefined);
    setAddQuestionsChapterId(undefined);
    setAddQuestionsTopicId(undefined);
    setAddQuestionsSubjectId(undefined);
    setAddQuestionsMethod("paste");
  };

  return {
    modals: {
      isLoginOpen, setIsLoginOpen,
      isSettingsOpen, setIsSettingsOpen,
      isApiSettingsOpen, setIsApiSettingsOpen,
      isPDFOpen, setIsPDFOpen,
      isFullExamOpen, setIsFullExamOpen,
      isCustomTestOpen, setIsCustomTestOpen,
      isExamAnalyzerOpen, setIsExamAnalyzerOpen,
      isAddSubjectOpen, setIsAddSubjectOpen,
      isAddChapterOpen, setIsAddChapterOpen,
      isAddTopicOpen, setIsAddTopicOpen,
      isAddQuestionsOpen, setIsAddQuestionsOpen,
      isManageSyllabusOpen, setIsManageSyllabusOpen,
      isManageQuestionsOpen, setIsManageQuestionsOpen,
      isManageCategoriesOpen, setIsManageCategoriesOpen,
      isManageBannersOpen, setIsManageBannersOpen,
      isAIImportOpen, setIsAIImportOpen,
      isManagePYQVaultOpen, setIsManagePYQVaultOpen,
      isManageLiveTestsOpen, setIsManageLiveTestsOpen,
      // Parameters
      addChapterSubjectId, setAddChapterSubjectId,
      addTopicSubjectId, setAddTopicSubjectId,
      addTopicChapterId, setAddTopicChapterId,
      addQuestionsChapterId, setAddQuestionsChapterId,
      addQuestionsTopicId, setAddQuestionsTopicId,
      addQuestionsSubjectId, setAddQuestionsSubjectId,
      addQuestionsMethod, setAddQuestionsMethod,
    },
    closeAllModals
  };
};
