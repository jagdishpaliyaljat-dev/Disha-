import React, { useCallback } from "react";
import { UserQuestionsStore, Subject, Chapter, Topic } from '../types';
import { 
  addSubject, 
  editSubject, 
  deleteSubject, 
  editChapter, 
  deleteChapter, 
  editTopic, 
  deleteTopic 
} from '../utils/questionsStorage';
import {
  saveSubjectToSupabase,
  deleteSubjectFromSupabase,
  saveChapterToSupabase,
  deleteChapterFromSupabase,
  saveTopicToSupabase,
  deleteTopicFromSupabase
} from '../utils/supabaseSyncService';
import { triggerFirebaseSavedToast } from '../utils/adminToast';

export const useCurriculumManager = (
  questionsStore: UserQuestionsStore,
  setQuestionsStore: React.Dispatch<React.SetStateAction<UserQuestionsStore>>,
  saveUserQuestionsStore: (store: UserQuestionsStore) => void,
  addToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void
) => {

  const handleAddSubject = useCallback(async (newSubject: Subject) => {
    const nextStore = addSubject(questionsStore, newSubject);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Saving...', 'Saving subject...');
    const res = await saveSubjectToSupabase(newSubject);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
      triggerFirebaseSavedToast({
        title: "Subject Saved!",
        message: `Subject "${newSubject.name || newSubject.hindiName}" saved to Supabase and live!`,
        itemName: newSubject.name,
      });
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleEditSubject = useCallback(async (updatedSubject: Subject) => {
    const nextStore = editSubject(questionsStore, updatedSubject);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Saving...', 'Saving subject...');
    const res = await saveSubjectToSupabase(updatedSubject);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
      triggerFirebaseSavedToast({
        title: "Subject Updated!",
        message: `Subject "${updatedSubject.name || updatedSubject.hindiName}" updated in Supabase!`,
        itemName: updatedSubject.name,
      });
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteSubject = useCallback(async (subjectId: string) => {
    const nextStore = deleteSubject(questionsStore, subjectId);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Deleting...', 'Deleting subject...');
    const res = await deleteSubjectFromSupabase(subjectId);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
    } else {
      addToast('error', 'Delete Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleAddChapter = useCallback(async (newChapter: Chapter) => {
    const chapterToSave: Chapter = {
      ...newChapter,
      isUserAdded: true,
    };
    const currentCustom = questionsStore.customChapters || [];
    const filteredCustom = currentCustom.filter(c => c.id !== chapterToSave.id);
    const nextStore = {
      ...questionsStore,
      customChapters: [...filteredCustom, chapterToSave],
    };
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Saving...', 'Saving chapter...');
    const res = await saveChapterToSupabase(chapterToSave);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
      triggerFirebaseSavedToast({
        title: "Chapter Saved!",
        message: `Chapter "${chapterToSave.title || chapterToSave.hindiTitle}" saved to Supabase and live!`,
        itemName: chapterToSave.title,
      });
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleEditChapter = useCallback(async (updatedChapter: Chapter) => {
    const chapterToSave: Chapter = {
      ...updatedChapter,
      isUserAdded: true,
    };
    const nextStore = editChapter(questionsStore, chapterToSave);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Saving...', 'Saving chapter...');
    const res = await saveChapterToSupabase(chapterToSave);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
      triggerFirebaseSavedToast({
        title: "Chapter Updated!",
        message: `Chapter "${chapterToSave.title || chapterToSave.hindiTitle}" updated in Supabase!`,
        itemName: chapterToSave.title,
      });
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    const nextStore = deleteChapter(questionsStore, chapterId);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Deleting...', 'Deleting chapter...');
    const res = await deleteChapterFromSupabase(chapterId);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
    } else {
      addToast('error', 'Delete Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleAddTopic = useCallback(async (chapterId: string, newTopic: Topic) => {
    const topicWithCh: Topic = {
      ...newTopic,
      chapterId,
      isUserAdded: true,
    };
    const currentCustomTopics = questionsStore.customTopics || [];
    const filteredCustomTopics = currentCustomTopics.filter(t => t.id !== topicWithCh.id);

    const updatedCustomChapters = (questionsStore.customChapters || []).map(ch => {
      if (ch.id === chapterId) {
        const existingTopics = ch.topics || [];
        const filteredTopics = existingTopics.filter(t => t.id !== topicWithCh.id);
        return {
          ...ch,
          topics: [...filteredTopics, topicWithCh],
        };
      }
      return ch;
    });

    const nextStore = {
      ...questionsStore,
      customChapters: updatedCustomChapters,
      customTopics: [...filteredCustomTopics, topicWithCh],
    };
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Saving...', 'Saving topic...');
    const res = await saveTopicToSupabase(topicWithCh);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
      triggerFirebaseSavedToast({
        title: "Topic Saved!",
        message: `Topic "${newTopic.title || newTopic.hindiTitle}" saved to Supabase and live!`,
        itemName: newTopic.title,
      });
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleEditTopic = useCallback(async (updatedTopic: Topic, chapterId?: string) => {
    const targetChId =
      chapterId ||
      updatedTopic.chapterId ||
      (questionsStore.customTopics || []).find((t) => t.id === updatedTopic.id)?.chapterId ||
      (questionsStore.customChapters || []).find((ch) =>
        (ch.topics || []).some((t) => t.id === updatedTopic.id)
      )?.id || "";

    const enrichedTopic = {
      ...updatedTopic,
      chapterId: targetChId,
    };

    const nextStore = editTopic(questionsStore, enrichedTopic);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Saving...', 'Saving topic...');
    const res = await saveTopicToSupabase(enrichedTopic);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
      triggerFirebaseSavedToast({
        title: "Topic Updated!",
        message: `Topic "${updatedTopic.title || updatedTopic.hindiTitle}" updated in Supabase!`,
        itemName: updatedTopic.title,
      });
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteTopic = useCallback(async (topicId: string, chapterId?: string) => {
    const nextStore = deleteTopic(questionsStore, topicId);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Deleting...', 'Deleting topic from Supabase...');
    const res = await deleteTopicFromSupabase(topicId);
    if (res.success) {
      addToast('success', 'Backend Sync Success', res.message);
    } else {
      addToast('error', 'Delete Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  return {
    handleAddSubject,
    handleEditSubject,
    handleDeleteSubject,
    handleAddChapter,
    handleEditChapter,
    handleDeleteChapter,
    handleAddTopic,
    handleEditTopic,
    handleDeleteTopic
  };
};
