/**
 * Version Utilities & Semantic Version Comparison for DISHA 20-20
 */

import { GlobalAppConfig } from './appConfigService';

export const CURRENT_APP_VERSION = '1.0.65';

/**
 * Compares two semantic version strings (e.g. '1.0.52' vs '1.0.51').
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '0.0.0').trim().replace(/^v/i, '');
  const clean2 = (v2 || '0.0.0').trim().replace(/^v/i, '');

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

export type UpdateCheckResult = {
  status: 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'FORCE_UPDATE_REQUIRED';
  currentVersion: string;
  latestVersion: string;
  minSupportedVersion: string;
  isHardLock: boolean;
  downloadUrl: string;
  title: string;
  message: string;
  releaseNotes: string[];
};

/**
 * Determines whether the current running app version is outdated,
 * and if so, whether a soft or hard (forced) update is required.
 */
export function checkAppUpdateStatus(
  currentVersion: string = CURRENT_APP_VERSION,
  config?: GlobalAppConfig
): UpdateCheckResult {
  const vc = config?.versionControl;

  const latestVersion = vc?.latestVersion || config?.version || CURRENT_APP_VERSION;
  const minSupportedVersion = vc?.minSupportedVersion || config?.minSupportedVersion || '1.0.0';
  const forceUpdateGlobal = vc?.forceUpdate ?? false;
  const downloadUrl = vc?.downloadUrl || config?.forceUpdateUrl || 'https://play.google.com/store/apps/details?id=com.rajexam.prep';
  const title = vc?.title || 'New Update Available!';
  const message = vc?.message || 'A newer version of Disha 20-20 is available with new exam features and bug fixes.';
  
  // Format release notes into array
  const rawNotes = vc?.releaseNotes || '';
  const releaseNotes = rawNotes
    ? rawNotes.split('\n').map((n) => n.trim().replace(/^[-•*]\s*/, '')).filter(Boolean)
    : [
        'Enhanced English vocabulary pronunciation',
        'Performance & offline stability improvements',
        'Updated PYQ questions and answer keys',
      ];

  // Hard update check 1: Below minimum supported version
  const belowMin = compareSemver(currentVersion, minSupportedVersion) < 0;

  // Hard update check 2: Global force update is enabled and below latest
  const belowLatest = compareSemver(currentVersion, latestVersion) < 0;
  const isHardLock = belowMin || (forceUpdateGlobal && belowLatest);

  if (isHardLock) {
    return {
      status: 'FORCE_UPDATE_REQUIRED',
      currentVersion,
      latestVersion,
      minSupportedVersion,
      isHardLock: true,
      downloadUrl,
      title: vc?.title || 'Critical Update Required',
      message: vc?.message || 'Your current app version is deprecated. Please update to continue practicing.',
      releaseNotes,
    };
  }

  if (belowLatest) {
    return {
      status: 'UPDATE_AVAILABLE',
      currentVersion,
      latestVersion,
      minSupportedVersion,
      isHardLock: false,
      downloadUrl,
      title,
      message,
      releaseNotes,
    };
  }

  return {
    status: 'UP_TO_DATE',
    currentVersion,
    latestVersion,
    minSupportedVersion,
    isHardLock: false,
    downloadUrl,
    title,
    message,
    releaseNotes,
  };
}
