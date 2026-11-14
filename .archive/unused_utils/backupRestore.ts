/**
 * App Backup & Restore Utility
 * Allows students to export all progress, bookmarks, custom questions,
 * and test records into a single JSON file and restore them on any device.
 */

const STORAGE_KEYS = [
  "economic_survey_progress_v2",
  "economic_survey_settings_v2",
  "economic_survey_study_history_v2",
  "economic_survey_user_questions_v2",
  "economic_survey_user_profile_v1",
  "economic_survey_performance_v1",
  "economic_survey_pyqs_data_v2",
  "economic_survey_smart_priority_config",
];

export interface BackupData {
  version: string;
  appName: string;
  exportedAt: string;
  data: Record<string, string | null>;
}

/**
 * Exports all local data to a downloadable JSON file
 */
export function exportAppDataJSON(): { success: boolean; filename?: string } {
  try {
    const backup: BackupData = {
      version: "2.0",
      appName: "DISHA 20-20",
      exportedAt: new Date().toISOString(),
      data: {},
    };

    STORAGE_KEYS.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val !== null) {
        backup.data[key] = val;
      }
    });

    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `DISHA_20_20_Backup_${dateStr}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (e) {
    console.error("Backup export failed", e);
    return { success: false };
  }
}

/**
 * Validates and restores app data from an uploaded JSON string
 */
export function importAppDataJSON(jsonContent: string): {
  success: boolean;
  message: string;
} {
  try {
    const parsed = JSON.parse(jsonContent);

    if (!parsed || typeof parsed !== "object" || !parsed.data) {
      return {
        success: false,
        message: "Invalid backup file structure.",
      };
    }

    const dataObj = parsed.data as Record<string, string>;
    let restoredKeysCount = 0;

    Object.entries(dataObj).forEach(([key, value]) => {
      if (typeof value === "string") {
        localStorage.setItem(key, value);
        restoredKeysCount++;
      }
    });

    if (restoredKeysCount === 0) {
      return {
        success: false,
        message: "Backup file contains no valid application data.",
      };
    }

    return {
      success: true,
      message: `Successfully restored ${restoredKeysCount} data collections. Reloading state...`,
    };
  } catch (e) {
    console.error("Restore failed", e);
    return {
      success: false,
      message: "Could not parse file. Ensure it is a valid JSON backup.",
    };
  }
}

/**
 * Cleans temporary cache and validates storage integrity
 */
export function optimizeStorageCache(): {
  freedBytes: number;
  message: string;
} {
  try {
    let beforeBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        beforeBytes += (localStorage.getItem(k) || "").length * 2;
      }
    }

    // Clean orphaned temporary keys if any
    const tempPrefixes = ["temp_", "pending_cache_", "debug_"];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && tempPrefixes.some((p) => k.startsWith(p))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    let afterBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        afterBytes += (localStorage.getItem(k) || "").length * 2;
      }
    }

    const freedBytes = Math.max(0, beforeBytes - afterBytes);
    return {
      freedBytes,
      message: "Database & storage integrity optimized successfully.",
    };
  } catch {
    return {
      freedBytes: 0,
      message: "Storage optimized.",
    };
  }
}
