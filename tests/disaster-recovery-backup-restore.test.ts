import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createZipBuffer,
  readZipBuffer,
  computeSha256,
  generateIntegrityManifest,
  verifyZipIntegrity,
} from '../src/server/zipEngine';
import {
  serializeFirestoreValue,
  deserializeFirestoreValue,
  areDocumentsIdentical,
} from '../src/server/typedSerialization';
import {
  executeExportJob,
  generateRestorePreview,
  executeRestoreJob,
  listStoredBackups,
  deleteStoredBackup,
  getStoredBackupBuffer,
  VERIFIED_QUIZPRO_COLLECTIONS,
} from '../src/server/backupEngine';

describe('QUIZPRO / DISHA 20-20: Disaster Recovery, Backup & Restore System', () => {
  const mockDbStorage: Record<string, Record<string, any>> = {};

  const mockAdminDb = {
    collection: (name: string) => ({
      get: async () => {
        const col = mockDbStorage[name] || {};
        return {
          docs: Object.entries(col).map(([id, data]) => ({
            id,
            data: () => data,
          })),
        };
      },
      doc: (id: string) => ({
        get: async () => {
          const col = mockDbStorage[name] || {};
          const exists = id in col;
          return {
            exists,
            data: () => col[id],
          };
        },
        set: async (data: any, options?: { merge?: boolean }) => {
          if (!mockDbStorage[name]) mockDbStorage[name] = {};
          if (options?.merge && mockDbStorage[name][id]) {
            mockDbStorage[name][id] = { ...mockDbStorage[name][id], ...data };
          } else {
            mockDbStorage[name][id] = data;
          }
        },
      }),
    }),
  };

  beforeEach(() => {
    // Seed mock database with representative production records
    mockDbStorage['subjects'] = {
      'subj-econ-01': {
        name: 'Economics',
        hindiName: 'अर्थशास्त्र',
        order: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    };
    mockDbStorage['chapters'] = {
      'ch-rajasthan-budget-01': {
        subjectId: 'subj-econ-01',
        title: 'Rajasthan Budget 2026',
        hindiTitle: 'राजस्थान बजट 2026',
        number: 1,
      },
    };
    mockDbStorage['topics'] = {
      'topic-fiscal-deficit-01': {
        chapterId: 'ch-rajasthan-budget-01',
        subjectId: 'subj-econ-01',
        title: 'Fiscal Deficit Trends',
        hindiTitle: 'राजकोषीय घाटा प्रवृत्तियां',
        number: 1,
      },
    };
    mockDbStorage['mcqs'] = {
      'mcq_budget_q1': {
        topicId: 'topic-fiscal-deficit-01',
        chapterId: 'ch-rajasthan-budget-01',
        subjectId: 'subj-econ-01',
        text: 'वर्ष 2026-27 में राजस्थान का अनुमानित राजकोषीय घाटा कितना है?',
        options: ['3.4%', '3.98%', '4.2%', '2.8%'],
        correctIndex: 1,
        explanation: 'बजट अनुमानों के अनुसार राजकोषीय घाटा 3.98% अनुमानित किया गया है।',
        createdAt: new Date('2026-02-01T12:00:00.000Z'),
      },
    };
    mockDbStorage['pyq_papers'] = {
      'ras_pre_2024': {
        title: 'RAS Pre 2024 General Studies',
        hindiTitle: 'आरएएस प्री 2024 सामान्य ज्ञान',
        examBoard: 'RPSC',
        durationMinutes: 180,
        totalMarks: 200,
        questionCount: 150,
      },
    };
    mockDbStorage['users'] = {
      'student_user_101': {
        name: 'Vikram Singh',
        email: 'vikram@example.com',
        role: 'student',
        status: 'active',
        createdAt: new Date('2026-01-15T00:00:00.000Z'),
      },
    };
  });

  afterEach(() => {
    // Clean up created test backups
    const backupsDir = path.resolve(process.cwd(), 'backups');
    if (fs.existsSync(backupsDir)) {
      const testFiles = fs.readdirSync(backupsDir).filter((f) => f.includes('test_') || f.includes('STAGED_') || f.includes('QUIZPRO_BACKUP_test-proj'));
      testFiles.forEach((f) => {
        try {
          fs.unlinkSync(path.join(backupsDir, f));
        } catch {}
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ZIP ENGINE & SHA-256 INTEGRITY
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. PKZIP Engine & SHA-256 Checksum Integrity', () => {
    it('creates standard ZIP buffer preserving relative directories and subfolders', () => {
      const entries = [
        { name: 'backup_manifest.json', data: JSON.stringify({ version: '2.0.0' }) },
        { name: 'firestore/collections/subjects.json', data: JSON.stringify([{ id: 'subj-1' }]) },
        { name: 'storage/files/banners/hero.webp', data: Buffer.from('mock-webp-binary-content') },
      ];

      const zipBuf = createZipBuffer(entries);
      expect(Buffer.isBuffer(zipBuf)).toBe(true);
      expect(zipBuf.length).toBeGreaterThan(100);

      const extracted = readZipBuffer(zipBuf);
      expect(extracted.length).toBe(3);
      expect(extracted.map((e) => e.name)).toEqual([
        'backup_manifest.json',
        'firestore/collections/subjects.json',
        'storage/files/banners/hero.webp',
      ]);
    });

    it('detects corrupted or modified files via SHA-256 integrity verification', () => {
      const entries = [
        { name: 'file1.json', data: '{"key": "value1"}' },
        { name: 'file2.json', data: '{"key": "value2"}' },
      ];

      const zipBuf = createZipBuffer(entries);
      const manifest = generateIntegrityManifest(entries);

      const extracted = readZipBuffer(zipBuf);
      const initialCheck = verifyZipIntegrity(extracted, manifest);
      expect(initialCheck.valid).toBe(true);
      expect(initialCheck.mismatchedFiles.length).toBe(0);

      // Simulate bit corruption
      extracted[0].data = Buffer.from('{"key": "TAMPERED"}');
      const tamperedCheck = verifyZipIntegrity(extracted, manifest);
      expect(tamperedCheck.valid).toBe(false);
      expect(tamperedCheck.mismatchedFiles).toContain('file1.json');
    });

    it('enforces Zip-Slip path traversal protection', () => {
      const maliciousEntries = [
        { name: '../../etc/passwd', data: 'root:x:0:0' },
      ];
      const zipBuf = createZipBuffer(maliciousEntries);
      expect(() => readZipBuffer(zipBuf)).toThrow(/path traversal/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. REVERSIBLE TYPED SERIALIZATION
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Reversible Typed Serialization', () => {
    it('serializes and deserializes Firestore Timestamps without precision loss', () => {
      const date = new Date('2026-11-14T08:00:00.123Z');
      const doc = {
        title: 'Test Doc',
        timestamp: date,
        stats: {
          lastLogin: date,
        },
      };

      const serialized = serializeFirestoreValue(doc);
      expect(serialized.timestamp.__type__).toBe('Timestamp');
      expect(serialized.timestamp.iso).toBe(date.toISOString());

      const deserialized = deserializeFirestoreValue(serialized);
      expect(deserialized.timestamp instanceof Date).toBe(true);
      expect(deserialized.timestamp.toISOString()).toBe(date.toISOString());
    });

    it('serializes and deserializes GeoPoints and Bytes', () => {
      const rawData = {
        location: { latitude: 26.9124, longitude: 75.7873 }, // Jaipur
        signature: Buffer.from('DISHA_2020_SECURE'),
      };

      const serialized = serializeFirestoreValue(rawData);
      expect(serialized.location.__type__).toBe('GeoPoint');
      expect(serialized.signature.__type__).toBe('Bytes');

      const deserialized = deserializeFirestoreValue(serialized);
      expect(deserialized.location.latitude).toBe(26.9124);
      expect(Buffer.isBuffer(deserialized.signature)).toBe(true);
      expect(deserialized.signature.toString('utf8')).toBe('DISHA_2020_SECURE');
    });

    it('correctly compares identical and modified documents', () => {
      const docA = { id: 'q1', text: 'Sample Question', options: ['A', 'B'], correctIndex: 0 };
      const docB = { id: 'q1', text: 'Sample Question', options: ['A', 'B'], correctIndex: 0 };
      const docC = { id: 'q1', text: 'Modified Question Text', options: ['A', 'B'], correctIndex: 0 };

      expect(areDocumentsIdentical(docA, docB)).toBe(true);
      expect(areDocumentsIdentical(docA, docC)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. FULL EXPORT ENGINE
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Export Engine Execution', () => {
    it('executes full export across verified collections, generating manifest and checksums', async () => {
      const jobId = 'export_test_001';
      const result = await executeExportJob(
        jobId,
        {
          scope: 'full',
          exportStorage: false, // test environment
        },
        {
          adminDb: mockAdminDb,
          projectId: 'test-project-disha',
          databaseId: 'test-db',
          apiKey: 'test-key',
        }
      );

      expect(result.status).toBe('completed');
      expect(result.exportedDocuments).toBeGreaterThanOrEqual(6);
      expect(result.totalCollections).toBe(VERIFIED_QUIZPRO_COLLECTIONS.length);
      expect(result.downloadUrl).toBeDefined();

      // Read created ZIP from disk
      const zipBuffer = getStoredBackupBuffer(result.backupFilename!);
      const extracted = readZipBuffer(zipBuffer);

      const manifestFile = extracted.find((f) => f.name === 'backup_manifest.json');
      expect(manifestFile).toBeDefined();

      const manifest = JSON.parse(manifestFile!.data.toString('utf8'));
      expect(manifest.appName).toBe('QUIZPRO / DISHA 20-20');
      expect(manifest.sourceProjectId).toBe('test-project-disha');
      expect(manifest.collectionInventory['subjects']).toBe(1);
      expect(manifest.collectionInventory['mcqs']).toBe(1);
      expect(manifest.collectionInventory['pyq_papers']).toBe(1);

      // Verify integrity manifest inside the zip
      const integrityFile = extracted.find((f) => f.name === 'reports/integrity_manifest.json');
      expect(integrityFile).toBeDefined();
    });

    it('supports selective collection export', async () => {
      const jobId = 'export_selective_002';
      const result = await executeExportJob(
        jobId,
        {
          scope: 'selective',
          selectedCollections: ['subjects', 'chapters', 'topics'],
          exportStorage: false,
        },
        {
          adminDb: mockAdminDb,
          projectId: 'test-project-disha',
          databaseId: 'test-db',
          apiKey: 'test-key',
        }
      );

      expect(result.status).toBe('completed');
      expect(result.totalCollections).toBe(3);

      const zipBuffer = getStoredBackupBuffer(result.backupFilename!);
      const extracted = readZipBuffer(zipBuffer);

      expect(extracted.some((f) => f.name.includes('subjects.json'))).toBe(true);
      expect(extracted.some((f) => f.name.includes('chapters.json'))).toBe(true);
      expect(extracted.some((f) => f.name.includes('topics.json'))).toBe(true);
      expect(extracted.some((f) => f.name.includes('mcqs.json'))).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. RESTORE PREVIEW & CONFLICT DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Restore Preview & Conflict Analysis', () => {
    it('analyzes uploaded backup and detects conflicting, missing, and matching records', async () => {
      // 1. Create a backup buffer
      const exportJob = await executeExportJob(
        'job_preview_src',
        { scope: 'selective', selectedCollections: ['subjects', 'mcqs'], exportStorage: false },
        { adminDb: mockAdminDb, projectId: 'test-project-src', databaseId: 'test-db', apiKey: 'test-key' }
      );
      const backupBuffer = getStoredBackupBuffer(exportJob.backupFilename!);

      // 2. Modify destination database to induce conflicts
      mockDbStorage['mcqs']['mcq_budget_q1'].text = 'Locally edited text causing conflict';
      mockDbStorage['mcqs']['mcq_extra_q2'] = { text: 'New local question not in backup' };

      // 3. Generate Restore Preview
      const preview = await generateRestorePreview(
        backupBuffer,
        exportJob.backupFilename!,
        {
          adminDb: mockAdminDb,
          projectId: 'test-project-dest',
          databaseId: 'test-db',
          apiKey: 'test-key',
        }
      );

      expect(preview.valid).toBe(true);
      expect(preview.integrityVerified).toBe(true);
      expect(preview.compatibilityWarnings.length).toBeGreaterThan(0); // Cross project notice
      expect(preview.collectionSummary.length).toBe(2);

      const mcqSummary = preview.collectionSummary.find((c) => c.name === 'mcqs');
      expect(mcqSummary?.conflictingDocsCount).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. RESTORE MODES & IDEMPOTENCY
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Restore Execution Modes & Idempotency', () => {
    it('executes RESTORE_MISSING_DOCUMENTS: never overwrites existing records', async () => {
      // Create backup
      const exportJob = await executeExportJob(
        'job_restore_mode_1',
        { scope: 'selective', selectedCollections: ['subjects', 'chapters'], exportStorage: false },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );
      const backupBuffer = getStoredBackupBuffer(exportJob.backupFilename!);

      // Modify a local subject and delete a chapter
      mockDbStorage['subjects']['subj-econ-01'].name = 'Custom Modified Economics';
      delete mockDbStorage['chapters']['ch-rajasthan-budget-01'];

      // Restore with RESTORE_MISSING_DOCUMENTS
      const restoreJob = await executeRestoreJob(
        'job_restore_missing',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'RESTORE_MISSING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM_RESTORE_RESTORE_MISSING_DOCUMENTS',
        },
        backupBuffer,
        { uid: 'admin_1', email: 'zdpaliyal@gmail.com' },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );

      expect(restoreJob.status).toBe('completed');
      expect(restoreJob.restoredDocuments).toBe(1); // restored deleted chapter
      expect(restoreJob.skippedDocuments).toBe(1);  // skipped existing subject

      // Verify that existing subject was preserved without overwrite
      expect(mockDbStorage['subjects']['subj-econ-01'].name).toBe('Custom Modified Economics');
      // Verify deleted chapter was restored
      expect(mockDbStorage['chapters']['ch-rajasthan-budget-01'].title).toBe('Rajasthan Budget 2026');
    });

    it('executes OVERWRITE_EXISTING_DOCUMENTS: overwrites matching records and preserves original IDs', async () => {
      const exportJob = await executeExportJob(
        'job_restore_mode_2',
        { scope: 'selective', selectedCollections: ['subjects'], exportStorage: false },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );
      const backupBuffer = getStoredBackupBuffer(exportJob.backupFilename!);

      // Modify local subject
      mockDbStorage['subjects']['subj-econ-01'].name = 'Changed Name';

      // Restore with OVERWRITE_EXISTING_DOCUMENTS
      const restoreJob = await executeRestoreJob(
        'job_restore_overwrite',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM_RESTORE_OVERWRITE_EXISTING_DOCUMENTS',
        },
        backupBuffer,
        { uid: 'admin_1', email: 'zdpaliyal@gmail.com' },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );

      expect(restoreJob.status).toBe('completed');
      expect(restoreJob.overwrittenDocuments).toBe(1);
      // Value restored to backup state
      expect(mockDbStorage['subjects']['subj-econ-01'].name).toBe('Economics');
    });

    it('is completely idempotent: importing same backup twice creates zero duplicates', async () => {
      const exportJob = await executeExportJob(
        'job_idempotent_test',
        { scope: 'selective', selectedCollections: ['subjects', 'mcqs'], exportStorage: false },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );
      const backupBuffer = getStoredBackupBuffer(exportJob.backupFilename!);

      const countBefore = Object.keys(mockDbStorage['mcqs']).length;

      // Restore Pass 1
      await executeRestoreJob(
        'restore_pass_1',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        backupBuffer,
        { uid: 'admin_1', email: 'zdpaliyal@gmail.com' },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );

      // Restore Pass 2 (Immediate repeat)
      const pass2Result = await executeRestoreJob(
        'restore_pass_2',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        backupBuffer,
        { uid: 'admin_1', email: 'zdpaliyal@gmail.com' },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );

      const countAfter = Object.keys(mockDbStorage['mcqs']).length;
      expect(countAfter).toBe(countBefore);
      // All documents skipped because they were already identical
      expect(pass2Result.skippedDocuments).toBe(2);
      expect(pass2Result.overwrittenDocuments).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. PRODUCTION DATA PROTECTION & SAFETY
  // ──────────────────────────────────────────────────────────────────────────
  describe('6. Production Safety Controls', () => {
    it('creates automatic pre-restore safety snapshot before executing restore', async () => {
      const exportJob = await executeExportJob(
        'job_safety_test',
        { scope: 'selective', selectedCollections: ['subjects'], exportStorage: false },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );
      const backupBuffer = getStoredBackupBuffer(exportJob.backupFilename!);

      const restoreJob = await executeRestoreJob(
        'job_safety_exec',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        backupBuffer,
        { uid: 'admin_1', email: 'zdpaliyal@gmail.com' },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );

      expect(restoreJob.warnings.some((w) => w.includes('Pre-restore safety snapshot'))).toBe(true);

      // Verify safety snapshot file exists on disk
      const backupsDir = path.resolve(process.cwd(), 'backups');
      const safetyFiles = fs.readdirSync(backupsDir).filter((f) => f.startsWith('PRE_RESTORE_SAFETY_'));
      expect(safetyFiles.length).toBeGreaterThan(0);
    });

    it('rejects restore if confirmation phrase is invalid', async () => {
      const exportJob = await executeExportJob(
        'job_phrase_test',
        { scope: 'selective', selectedCollections: ['subjects'], exportStorage: false },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );
      const backupBuffer = getStoredBackupBuffer(exportJob.backupFilename!);

      const restoreJob = await executeRestoreJob(
        'job_bad_phrase',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'WRONG_PHRASE',
        },
        backupBuffer,
        { uid: 'admin_1', email: 'zdpaliyal@gmail.com' },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );

      expect(restoreJob.status).toBe('failed');
      expect(restoreJob.errors[0]).toMatch(/Invalid confirmation phrase/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. SYLLABUS, CHAPTER, TOPIC & MCQ HIERARCHY PRESERVATION
  // ──────────────────────────────────────────────────────────────────────────
  describe('7. Data Relationship Integrity Preservation', () => {
    it('preserves exact multi-level subject/chapter/topic/MCQ relationship references after restoration', async () => {
      const exportJob = await executeExportJob(
        'job_rel_test',
        { scope: 'selective', selectedCollections: ['subjects', 'chapters', 'topics', 'mcqs'], exportStorage: false },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );
      const backupBuffer = getStoredBackupBuffer(exportJob.backupFilename!);

      // Clear destination database completely
      mockDbStorage['subjects'] = {};
      mockDbStorage['chapters'] = {};
      mockDbStorage['topics'] = {};
      mockDbStorage['mcqs'] = {};

      // Restore into empty destination
      const restoreJob = await executeRestoreJob(
        'job_rel_restore',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'RESTORE_INTO_EMPTY_PROJECT',
          confirmationPhrase: 'CONFIRM',
        },
        backupBuffer,
        { uid: 'admin_1', email: 'zdpaliyal@gmail.com' },
        { adminDb: mockAdminDb, projectId: 'test-project-disha', databaseId: 'test-db', apiKey: 'test-key' }
      );

      expect(restoreJob.status).toBe('completed');

      // Verify that restored documents match original relationship references
      const restoredMcq = mockDbStorage['mcqs']['mcq_budget_q1'];
      const restoredTopic = mockDbStorage['topics'][restoredMcq.topicId];
      const restoredChapter = mockDbStorage['chapters'][restoredMcq.chapterId];
      const restoredSubject = mockDbStorage['subjects'][restoredMcq.subjectId];

      expect(restoredMcq).toBeDefined();
      expect(restoredTopic).toBeDefined();
      expect(restoredChapter).toBeDefined();
      expect(restoredSubject).toBeDefined();

      expect(restoredTopic.chapterId).toBe(restoredChapter.id || 'ch-rajasthan-budget-01');
      expect(restoredChapter.subjectId).toBe(restoredSubject.id || 'subj-econ-01');
      expect(restoredMcq.correctIndex).toBe(1);
    });
  });
});
