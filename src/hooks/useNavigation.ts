import React, { useState, useCallback } from "react";
import { ActiveTab, MCQSession } from '../types';

export const useNavigation = (initialTab: ActiveTab) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedCoachingId, setSelectedCoachingId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<MCQSession | null>(null);

  const navigateTo = useCallback((
    tab: ActiveTab, 
    params: { 
      slug?: string | null; 
      subjectId?: string | null; 
      chapterId?: string | null; 
      topicId?: string | null;
      coachingId?: string | null;
      examId?: string | null;
      seriesId?: string | null;
    } = {}
  ) => {
    setActiveTab(tab);
    if (params.slug !== undefined) setSelectedArticleSlug(params.slug);
    if (params.subjectId !== undefined) setSelectedSubjectId(params.subjectId);
    if (params.chapterId !== undefined) setSelectedChapterId(params.chapterId);
    if (params.topicId !== undefined) setSelectedTopicId(params.topicId);
    if (params.coachingId !== undefined) setSelectedCoachingId(params.coachingId);
    if (params.examId !== undefined) setSelectedExamId(params.examId);
    if (params.seriesId !== undefined) setSelectedSeriesId(params.seriesId);
  }, []);

  return {
    activeTab,
    setActiveTab,
    selectedArticleSlug,
    setSelectedArticleSlug,
    selectedSubjectId,
    setSelectedSubjectId,
    selectedChapterId,
    setSelectedChapterId,
    selectedTopicId,
    setSelectedTopicId,
    selectedCoachingId,
    setSelectedCoachingId,
    selectedExamId,
    setSelectedExamId,
    selectedSeriesId,
    setSelectedSeriesId,
    activeSession,
    setActiveSession,
    navigateTo
  };
};
