import { ProgressStore, AppSettings } from '../types';
import { loadProgressFromStorage, saveProgressToStorage, loadSettingsFromStorage, loadStudyHistoryFromStorage, saveStudyHistoryToStorage } from './storage';
import { loadUserProfile } from './userProfileStorage';

export interface StudentBackupPayload {
  schema: 'disha2020_student_backup_v1';
  exportedAt: string;
  version: string;
  totalBookmarks: number;
  totalProgressCount: number;
  progress: ProgressStore;
  history?: any;
  settings?: Partial<AppSettings>;
  userProfile?: {
    name?: string;
    targetExam?: string;
  };
}

/**
 * Validates that an imported JSON object complies with the student backup schema
 */
export function validateBackupData(data: any): data is StudentBackupPayload {
  if (!data || typeof data !== 'object') return false;
  if (data.schema !== 'disha2020_student_backup_v1') return false;
  if (!data.progress || typeof data.progress !== 'object') return false;
  return true;
}

/**
 * Generates an exportable JSON payload of all student study data (bookmarks, reason tags, history)
 */
export function generateStudentBackupData(): StudentBackupPayload {
  const progress = loadProgressFromStorage();
  const history = loadStudyHistoryFromStorage();
  const settings = loadSettingsFromStorage();
  const userProfile = loadUserProfile();

  const totalProgressCount = Object.keys(progress).length;
  const totalBookmarks = Object.values(progress).filter((p) => Boolean(p.bookmarked)).length;

  return {
    schema: 'disha2020_student_backup_v1',
    exportedAt: new Date().toISOString(),
    version: '1.0.55',
    totalBookmarks,
    totalProgressCount,
    progress,
    history,
    settings: {
      darkMode: settings.darkMode,
      textSize: settings.textSize,
      dailyGoal: settings.dailyGoal,
      selectedExam: settings.selectedExam,
    },
    userProfile: {
      name: userProfile?.name,
      targetExam: userProfile?.targetExam,
    },
  };
}

/**
 * Triggers a browser download of the student's study data as a formatted JSON file
 */
export function exportStudentBackupToFile(): void {
  const data = generateStudentBackupData();
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `disha2020-study-backup-${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Restores student study data from a JSON backup string with validation
 */
export function restoreStudentBackupFromJSON(jsonString: string): {
  success: boolean;
  restoredBookmarks: number;
  restoredProgressCount: number;
  message: string;
} {
  try {
    const data = JSON.parse(jsonString);

    if (!validateBackupData(data)) {
      return {
        success: false,
        restoredBookmarks: 0,
        restoredProgressCount: 0,
        message: 'अमान्य बैकअप फाइल। कृपया मान्य Disha 20-20 बैकअप JSON चुनें।',
      };
    }

    // Merge or replace progress in storage
    const currentProgress = loadProgressFromStorage();
    const mergedProgress = { ...currentProgress, ...data.progress };
    saveProgressToStorage(mergedProgress);

    if (data.history) {
      saveStudyHistoryToStorage(data.history);
    }

    const restoredBookmarks = Object.values(data.progress).filter((p) => Boolean(p.bookmarked)).length;
    const restoredProgressCount = Object.keys(data.progress).length;

    return {
      success: true,
      restoredBookmarks,
      restoredProgressCount,
      message: `सफलतापूर्वक रीस्टोर किया गया: ${restoredBookmarks} बुकमार्क और ${restoredProgressCount} प्रश्न रिकॉर्ड।`,
    };
  } catch (err: any) {
    return {
      success: false,
      restoredBookmarks: 0,
      restoredProgressCount: 0,
      message: `रीस्टोर विफल: ${err?.message || 'फाइल पढ़ने में त्रुटि'}`,
    };
  }
}
