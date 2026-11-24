// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  compareSemver,
  checkAppUpdateStatus,
  CURRENT_APP_VERSION,
} from '../src/utils/versionUtils';
import { appConfigService, GlobalAppConfig } from '../src/utils/appConfigService';

describe('Remote Version Control & Force Update Desk Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('compareSemver', () => {
    it('correctly compares equal versions', () => {
      expect(compareSemver('1.0.52', '1.0.52')).toBe(0);
      expect(compareSemver('v1.0.52', '1.0.52')).toBe(0);
      expect(compareSemver('1.0.0', '1.0')).toBe(0);
    });

    it('identifies older versions', () => {
      expect(compareSemver('1.0.51', '1.0.52')).toBe(-1);
      expect(compareSemver('1.0.9', '1.1.0')).toBe(-1);
      expect(compareSemver('0.9.99', '1.0.0')).toBe(-1);
    });

    it('identifies newer versions', () => {
      expect(compareSemver('1.0.53', '1.0.52')).toBe(1);
      expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
      expect(compareSemver('1.2.0', '1.1.9')).toBe(1);
    });
  });

  describe('checkAppUpdateStatus', () => {
    const mockConfig: GlobalAppConfig = {
      version: '1.0.52',
      maintenance: {
        enabled: false,
        title: '',
        message: '',
        allowedEmails: [],
        allowAdminBypass: true,
      },
      broadcast: {
        id: '1',
        enabled: false,
        type: 'info',
        message: '',
        updatedAt: '',
      },
      features: {
        leaderboardEnabled: true,
        dailyStreakEnabled: true,
        liveBattleEnabled: true,
        omrScannerEnabled: true,
        doubtDeskEnabled: true,
        pyqVaultEnabled: true,
      },
      minSupportedVersion: '1.0.50',
      versionControl: {
        latestVersion: '1.0.52',
        minSupportedVersion: '1.0.50',
        forceUpdate: false,
        downloadUrl: 'https://example.com/download.apk',
        releaseNotes: '• Major bug fixes\n• English voice pronunciation',
        title: 'New Update Available',
        message: 'Please update your app to enjoy new features.',
      },
      updatedAt: '',
      updatedBy: 'Admin',
    };

    it('reports UP_TO_DATE when running latest version', () => {
      const result = checkAppUpdateStatus('1.0.52', mockConfig);
      expect(result.status).toBe('UP_TO_DATE');
      expect(result.isHardLock).toBe(false);
    });

    it('reports UPDATE_AVAILABLE (Soft Update) when version is between min and latest', () => {
      const result = checkAppUpdateStatus('1.0.51', mockConfig);
      expect(result.status).toBe('UPDATE_AVAILABLE');
      expect(result.isHardLock).toBe(false);
      expect(result.currentVersion).toBe('1.0.51');
      expect(result.latestVersion).toBe('1.0.52');
      expect(result.releaseNotes).toContain('Major bug fixes');
      expect(result.releaseNotes).toContain('English voice pronunciation');
    });

    it('reports FORCE_UPDATE_REQUIRED (Hard Lock) when version is below minSupportedVersion', () => {
      const result = checkAppUpdateStatus('1.0.48', mockConfig);
      expect(result.status).toBe('FORCE_UPDATE_REQUIRED');
      expect(result.isHardLock).toBe(true);
      expect(result.currentVersion).toBe('1.0.48');
      expect(result.minSupportedVersion).toBe('1.0.50');
    });

    it('reports FORCE_UPDATE_REQUIRED when global forceUpdate toggle is active', () => {
      const strictConfig = {
        ...mockConfig,
        versionControl: {
          ...mockConfig.versionControl!,
          forceUpdate: true,
        },
      };

      const result = checkAppUpdateStatus('1.0.51', strictConfig);
      expect(result.status).toBe('FORCE_UPDATE_REQUIRED');
      expect(result.isHardLock).toBe(true);
    });
  });

  describe('appConfigService Version Control Integration', () => {
    it('persists and notifies updated version control configuration', () => {
      let notifiedConfig: GlobalAppConfig | null = null;
      const unsub = appConfigService.subscribe((cfg) => {
        notifiedConfig = cfg;
      });

      appConfigService.updateConfig({
        versionControl: {
          latestVersion: '1.0.53',
          minSupportedVersion: '1.0.52',
          forceUpdate: true,
          downloadUrl: 'https://example.com/disha-v1.0.53.apk',
          releaseNotes: '• Speed boost\n• OMR mode added',
          title: 'Mandatory Update',
          message: 'Update now to continue.',
        },
      });

      expect(notifiedConfig).toBeDefined();
      expect(notifiedConfig!.versionControl?.latestVersion).toBe('1.0.53');
      expect(notifiedConfig!.versionControl?.forceUpdate).toBe(true);

      unsub();
    });
  });
});
