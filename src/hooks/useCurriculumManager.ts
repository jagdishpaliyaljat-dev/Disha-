import React, { useCallback } from "react";
import { UserQuestionsStore, Subject, Chapter, Topic } from '../types';
import { 
  addSubject, 
  editSubject, 
  deleteSubject, 
  addChapter,
  editChapter, 
  deleteChapter, 
  addTopic,
  editTopic, 
  deleteTopic,
  getCombinedChapters,
  getCombinedSubjects
} from '../utils/questionsStorage';
import {
  saveSubjectToSupabase,
  deleteSubjectFromSupabase,
  saveChapterToSupabase,
  deleteChapterFromSupabase,
  saveTopicToSupabase,
  deleteTopicFromSupabase
} from '../utils/supabaseSyncService';
import { triggerDatabaseSavedToast } from '../utils/adminToast';

export const useCurriculumManager = (
  questionsStore: UserQuestionsStore,
  setQuestionsStore: React.Dispatch<React.SetStateAction<UserQuestionsStore>>,
  saveUserQuestionsStore: (store: UserQuestionsStore) => void,
  addToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void
) => {

  const handleAddSubject = useCallback(async (newSubject: Subject) => {
    addToast('info', 'Saving...', 'Saving subject...');
    const res = await saveSubjectToSupabase(newSubject);
    if (res.success) {
      const nextStore = addSubject(questionsStore, newSubject);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
        triggerDatabaseSavedToast({
          title: "Subject Saved!",
          message: `Subject "${newSubject.name || newSubject.hindiName}" saved to Supabase and live!`,
          itemName: newSubject.name,
        });
      } else {
        addToast('info', 'Saved Locally', res.message);
      }
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleEditSubject = useCallback(async (updatedSubject: Subject) => {
    addToast('info', 'Saving...', 'Saving subject...');
    const res = await saveSubjectToSupabase(updatedSubject);
    if (res.success) {
      const nextStore = editSubject(questionsStore, updatedSubject);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
        triggerDatabaseSavedToast({
          title: "Subject Updated!",
          message: `Subject "${updatedSubject.name || updatedSubject.hindiName}" updated in Supabase!`,
          itemName: updatedSubject.name,
        });
      } else {
        addToast('info', 'Saved Locally', res.message);
      }
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteSubject = useCallback(async (subjectId: string) => {
    addToast('info', 'Deleting...', 'Deleting subject...');
    const res = await deleteSubjectFromSupabase(subjectId);
    if (res.success) {
      const nextStore = deleteSubject(questionsStore, subjectId);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
      } else {
        addToast('info', 'Deleted Locally', res.message);
      }
    } else {
      addToast('error', 'Delete Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleAddChapter = useCallback(async (newChapter: Chapter) => {
    const chapterToSave: Chapter = {
      ...newChapter,
      isUserAdded: true,
    };
    addToast('info', 'Saving...', 'Saving chapter...');
    const res = await saveChapterToSupabase(chapterToSave);
    if (res.success) {
      const nextStore = addChapter(questionsStore, chapterToSave);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
        triggerDatabaseSavedToast({
          title: "Chapter Saved!",
          message: `Chapter "${chapterToSave.title || chapterToSave.hindiTitle}" saved to Supabase and live!`,
          itemName: chapterToSave.title,
        });
      } else {
        addToast('info', 'Saved Locally', res.message);
      }
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleEditChapter = useCallback(async (updatedChapter: Chapter) => {
    const chapterToSave: Chapter = {
      ...updatedChapter,
      isUserAdded: true,
    };
    addToast('info', 'Saving...', 'Saving chapter...');
    const res = await saveChapterToSupabase(chapterToSave);
    if (res.success) {
      const nextStore = editChapter(questionsStore, chapterToSave);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
        triggerDatabaseSavedToast({
          title: "Chapter Updated!",
          message: `Chapter "${chapterToSave.title || chapterToSave.hindiTitle}" updated in Supabase!`,
          itemName: chapterToSave.title,
        });
      } else {
        addToast('info', 'Saved Locally', res.message);
      }
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    addToast('info', 'Deleting...', 'Deleting chapter...');
    const res = await deleteChapterFromSupabase(chapterId);
    if (res.success) {
      const nextStore = deleteChapter(questionsStore, chapterId);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
      } else {
        addToast('info', 'Deleted Locally', res.message);
      }
    } else {
      addToast('error', 'Delete Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleAddTopic = useCallback(async (chapterId: string, newTopic: Topic) => {
    // 1. Resolve parent chapter from combined chapters as well as custom chapters
    const combinedChaps = getCombinedChapters(questionsStore);
    const parentChapter = combinedChaps.find(ch => ch.id === chapterId) ||
                          (questionsStore.customChapters || []).find(ch => ch.id === chapterId);

    // 2. Resolve subject ID cleanly, avoiding fallback to nonexistent "economics"
    let resolvedSubjectId = newTopic.subjectId || parentChapter?.subjectId;
    if (!resolvedSubjectId || resolvedSubjectId === "economics") {
      const activeSubjects = getCombinedSubjects(questionsStore);
      const validSub = activeSubjects.find(s => s.id !== "economics");
      resolvedSubjectId = validSub?.id || activeSubjects[0]?.id || "sub_raj_hist";
    }

    const existingTopics = parentChapter?.topics || [];
    const assignedNumber = newTopic.number || (existingTopics.length + 1);

    const topicWithCh: Topic = {
      ...newTopic,
      chapterId,
      subjectId: resolvedSubjectId,
      number: assignedNumber,
      isUserAdded: true,
    };

    addToast('info', 'Saving...', 'Saving topic...');
    const res = await saveTopicToSupabase(topicWithCh);
    if (res.success) {
      // Use the canonical addTopic from questionsStorage to guarantee state & IDB consistency
      const nextStore = addTopic(questionsStore, topicWithCh, chapterId);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
        triggerDatabaseSavedToast({
          title: "Topic Saved!",
          message: `Topic "${topicWithCh.title || topicWithCh.hindiTitle}" saved to Supabase and live!`,
          itemName: topicWithCh.title,
        });
      } else {
        addToast('info', 'Saved Locally', res.message);
      }
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleEditTopic = useCallback(async (updatedTopic: Topic, chapterId?: string) => {
    const combinedChaps = getCombinedChapters(questionsStore);
    const targetChId =
      chapterId ||
      updatedTopic.chapterId ||
      (questionsStore.customTopics || []).find((t) => t.id === updatedTopic.id)?.chapterId ||
      combinedChaps.find((ch) =>
        (ch.topics || []).some((t) => t.id === updatedTopic.id)
      )?.id || "";

    const parentChapter = combinedChaps.find(ch => ch.id === targetChId) ||
                          (questionsStore.customChapters || []).find(ch => ch.id === targetChId);
    let resolvedSubjectId = updatedTopic.subjectId || parentChapter?.subjectId;
    if (!resolvedSubjectId || resolvedSubjectId === "economics") {
      const activeSubjects = getCombinedSubjects(questionsStore);
      const validSub = activeSubjects.find(s => s.id !== "economics");
      resolvedSubjectId = validSub?.id || activeSubjects[0]?.id || "sub_raj_hist";
    }

    const enrichedTopic: Topic = {
      ...updatedTopic,
      chapterId: targetChId,
      subjectId: resolvedSubjectId,
      isUserAdded: true,
    };

    addToast('info', 'Saving...', 'Saving topic...');
    const res = await saveTopicToSupabase(enrichedTopic);
    if (res.success) {
      const nextStore = editTopic(questionsStore, enrichedTopic);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
        triggerDatabaseSavedToast({
          title: "Topic Updated!",
          message: `Topic "${updatedTopic.title || updatedTopic.hindiTitle}" updated in Supabase!`,
          itemName: updatedTopic.title,
        });
      } else {
        addToast('info', 'Saved Locally', res.message);
      }
    } else {
      addToast('error', 'Save Error', res.message);
    }
  }, [questionsStore, setQuestionsStore, saveUserQuestionsStore, addToast]);

  const handleDeleteTopic = useCallback(async (topicId: string, chapterId?: string) => {
    addToast('info', 'Deleting...', 'Deleting topic from Supabase...');
    const res = await deleteTopicFromSupabase(topicId);
    if (res.success) {
      const nextStore = deleteTopic(questionsStore, topicId);
      setQuestionsStore(nextStore);
      saveUserQuestionsStore(nextStore);
      if (res.cloudSynced) {
        addToast('success', 'Backend Sync Success', res.message);
      } else {
        addToast('info', 'Deleted Locally', res.message);
      }
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
