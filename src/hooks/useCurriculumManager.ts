import React, { useCallback } from "react";
import { UserQuestionsStore, Subject, Chapter, Topic, Question } from '../types';
import { 
  addSubject, 
  editSubject, 
  deleteSubject, 
  editChapter, 
  deleteChapter, 
  editTopic, 
  deleteTopic, 
  bulkDeleteQuestions, 
  bulkMoveQuestions 
} from '../utils/questionsStorage';
import {
  saveSubject,
  deleteSubjectFromCloud,
  saveChapter,
  deleteChapterFromCloud,
  saveTopic,
  deleteTopicFromCloud
} from '../utils/firebaseSyncService';
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
    const res = await saveSubject(newSubject);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Save Success', res.message);
      triggerFirebaseSavedToast({
        title: "Subject Saved to Firebase!",
        message: `Subject "${newSubject.name || newSubject.hindiName}" saved to database and live for users!`,
        itemName: newSubject.name,
      });
    } else {
      addToast('error', 'Firebase Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleEditSubject = useCallback(async (updatedSubject: Subject) => {
    const nextStore = editSubject(questionsStore, updatedSubject);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Saving...', 'Saving subject...');
    const res = await saveSubject(updatedSubject);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Save Success', res.message);
      triggerFirebaseSavedToast({
        title: "Subject Updated in Firebase!",
        message: `Subject "${updatedSubject.name || updatedSubject.hindiName}" updated in database and live for users!`,
        itemName: updatedSubject.name,
      });
    } else {
      addToast('error', 'Firebase Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteSubject = useCallback(async (subjectId: string) => {
    const nextStore = deleteSubject(questionsStore, subjectId);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Deleting...', 'Deleting subject...');
    const res = await deleteSubjectFromCloud(subjectId);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Delete Success', res.message);
    } else {
      addToast('error', 'Firebase Delete Error', res.message);
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
    const res = await saveChapter(chapterToSave);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Save Success', res.message);
      triggerFirebaseSavedToast({
        title: "Chapter Saved to Firebase!",
        message: `Chapter "${chapterToSave.title || chapterToSave.hindiTitle}" saved to database and live for users!`,
        itemName: chapterToSave.title,
      });
    } else {
      addToast('error', 'Firebase Save Error', res.message);
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
    const res = await saveChapter(chapterToSave);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Save Success', res.message);
      triggerFirebaseSavedToast({
        title: "Chapter Updated in Firebase!",
        message: `Chapter "${chapterToSave.title || chapterToSave.hindiTitle}" updated in database and live for users!`,
        itemName: chapterToSave.title,
      });
    } else {
      addToast('error', 'Firebase Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    const nextStore = deleteChapter(questionsStore, chapterId);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Deleting...', 'Deleting chapter...');
    const res = await deleteChapterFromCloud(chapterId);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Delete Success', res.message);
    } else {
      addToast('error', 'Firebase Delete Error', res.message);
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

    // Also sync topic into topics array of matching customChapter if present
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
    const res = await saveTopic(topicWithCh);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Save Success', res.message);
      triggerFirebaseSavedToast({
        title: "Topic Saved to Firebase!",
        message: `Topic "${newTopic.title || newTopic.hindiTitle}" saved to database and live for users!`,
        itemName: newTopic.title,
      });
    } else {
      addToast('error', 'Firebase Save Error', res.message);
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
    const res = await saveTopic(enrichedTopic);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Save Success', res.message);
      triggerFirebaseSavedToast({
        title: "Topic Updated in Firebase!",
        message: `Topic "${updatedTopic.title || updatedTopic.hindiTitle}" updated in database and live for users!`,
        itemName: updatedTopic.title,
      });
    } else {
      addToast('error', 'Firebase Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteTopic = useCallback(async (topicId: string, chapterId?: string) => {
    const targetChId =
      chapterId ||
      (questionsStore.customTopics || []).find((t) => t.id === topicId)?.chapterId ||
      (questionsStore.customChapters || []).find((ch) =>
        (ch.topics || []).some((t) => t.id === topicId)
      )?.id;

    const nextStore = deleteTopic(questionsStore, topicId);
    setQuestionsStore(nextStore);
    saveUserQuestionsStore(nextStore);
    
    addToast('info', 'Deleting...', 'Deleting topic from Firebase...');
    const res = await deleteTopicFromCloud(topicId, targetChId);
    if (res.success) {
      addToast('success', res.isFirebase ? 'Firebase Sync Success' : 'Local Delete Success', res.message);
    } else {
      addToast('error', 'Firebase Delete Error', res.message);
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
