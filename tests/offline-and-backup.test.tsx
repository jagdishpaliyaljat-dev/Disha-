// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateStudentBackupData,
  restoreStudentBackupFromJSON,
  validateBackupData,
} from '../src/utils/studentBackupService';
import fs from 'node:fs';
import path from 'node:path';

describe('Task 3: Offline Study & Student Data Backup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Student Progress JSON Backup & Restore Engine', () => {
    it('generates a well-structured backup JSON payload with schema metadata', () => {
      // Seed some test data in localStorage
      localStorage.setItem(
        'economic_survey_progress_v2',
        JSON.stringify({
          q1: { id: 'q1', bookmarked: true, bookmarkTag: 'exam_trap', status: 'wrong' },
          q2: { id: 'q2', bookmarked: true, bookmarkTag: 'formula_dates', status: 'correct' },
        })
      );

      const backup = generateStudentBackupData();

      expect(backup.schema).toBe('disha2020_student_backup_v1');
      expect(backup.exportedAt).toBeDefined();
      expect(backup.totalBookmarks).toBe(2);
      expect(backup.progress['q1'].bookmarked).toBe(true);
      expect(backup.progress['q1'].bookmarkTag).toBe('exam_trap');
    });

    it('validates valid backup JSON schema and rejects corrupted payloads', () => {
      const validPayload = {
        schema: 'disha2020_student_backup_v1',
        exportedAt: new Date().toISOString(),
        progress: {
          q100: { id: 'q100', bookmarked: true },
        },
      };

      expect(validateBackupData(validPayload)).toBe(true);
      expect(validateBackupData({ invalid: true })).toBe(false);
      expect(validateBackupData(null)).toBe(false);
    });

    it('restores backup data into storage successfully', () => {
      const backupJSON = JSON.stringify({
        schema: 'disha2020_student_backup_v1',
        exportedAt: '2026-11-26T10:00:00.000Z',
        progress: {
          q_restored_1: { id: 'q_restored_1', bookmarked: true, bookmarkTag: 'revision_needed', status: 'correct' },
          q_restored_2: { id: 'q_restored_2', bookmarked: false, status: 'wrong' },
        },
      });

      const result = restoreStudentBackupFromJSON(backupJSON);

      expect(result.success).toBe(true);
      expect(result.restoredBookmarks).toBe(1);
      expect(result.restoredProgressCount).toBe(2);

      // Verify localStorage was updated
      const storedRaw = localStorage.getItem('economic_survey_progress_v2');
      expect(storedRaw).toBeDefined();
      const stored = JSON.parse(storedRaw!);
      expect(stored['q_restored_1'].bookmarked).toBe(true);
    });
  });

  describe('UI Component Integration', () => {
    it('TopicsTab.tsx contains explicit offline download button and status indicators', () => {
      const topicsPath = path.resolve(import.meta.dirname, '../src/components/TopicsTab.tsx');
      const content = fs.readFileSync(topicsPath, 'utf8');
      expect(content).toContain('offlineDownload');
    });

    it('AppSettingsModal.tsx contains Export Backup and Restore Backup controls', () => {
      const settingsPath = path.resolve(import.meta.dirname, '../src/components/AppSettingsModal.tsx');
      const content = fs.readFileSync(settingsPath, 'utf8');
      expect(content).toContain('exportStudentBackupToFile');
      expect(content).toContain('restoreStudentBackupFromJSON');
    });
  });
});
