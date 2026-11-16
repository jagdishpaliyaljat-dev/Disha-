import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createZipBuffer,
  readZipBuffer,
  generateIntegrityManifest,
  computeSha256,
  ZipEntry,
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
  getRestoreCheckpoint,
  VERIFIED_QUIZPRO_COLLECTIONS,
} from '../src/server/backupEngine';

// Fully isolated in-memory Firestore mockup matching Firebase Admin SDK
class IsolatedMockFirestore {
  public collections = new Map<string, Map<string, any>>();
  public subcollections = new Map<string, Map<string, any>>(); // key: parentCol/parentId/subcol
  public writeFailures = new Set<string>(); // docPath triggers error if present

  public reset() {
    this.collections.clear();
    this.subcollections.clear();
    this.writeFailures.clear();
  }

  public setDocSync(col: string, id: string, data: any) {
    if (!this.collections.has(col)) {
      this.collections.set(col, new Map());
    }
    this.collections.get(col)!.set(id, JSON.parse(JSON.stringify(data)));
  }

  public setSubdocSync(parentCol: string, parentId: string, subcol: string, id: string, data: any) {
    const key = `${parentCol}/${parentId}/${subcol}`;
    if (!this.subcollections.has(key)) {
      this.subcollections.set(key, new Map());
    }
    this.subcollections.get(key)!.set(id, JSON.parse(JSON.stringify(data)));
  }

  public getAdminDb() {
    const self = this;
    return {
      collection: (colName: string) => ({
        get: async () => {
          const colMap = self.collections.get(colName) || new Map();
          return {
            docs: Array.from(colMap.entries()).map(([id, data]) => ({
              id,
              data: () => data,
            })),
          };
        },
        doc: (docId: string) => ({
          get: async () => {
            const colMap = self.collections.get(colName);
            const exists = !!colMap && colMap.has(docId);
            return {
              exists,
              data: () => (exists ? colMap!.get(docId) : undefined),
            };
          },
          set: async (data: any, options?: { merge?: boolean }) => {
            const docPath = `${colName}/${docId}`;
            if (self.writeFailures.has(docPath)) {
              throw new Error(`Simulated I/O Error writing document: ${docPath}`);
            }
            if (!self.collections.has(colName)) {
              self.collections.set(colName, new Map());
            }
            const colMap = self.collections.get(colName)!;
            if (options?.merge && colMap.has(docId)) {
              colMap.set(docId, { ...colMap.get(docId), ...data });
            } else {
              colMap.set(docId, data);
            }
          },
          collection: (subName: string) => ({
            get: async () => {
              const key = `${colName}/${docId}/${subName}`;
              const subMap = self.subcollections.get(key) || new Map();
              return {
                docs: Array.from(subMap.entries()).map(([id, data]) => ({
                  id,
                  data: () => data,
                })),
              };
            },
            doc: (subId: string) => ({
              get: async () => {
                const key = `${colName}/${docId}/${subName}`;
                const subMap = self.subcollections.get(key);
                const exists = !!subMap && subMap.has(subId);
                return {
                  exists,
                  data: () => (exists ? subMap!.get(subId) : undefined),
                };
              },
              set: async (data: any, options?: { merge?: boolean }) => {
                const subDocPath = `${colName}/${docId}/${subName}/${subId}`;
                if (self.writeFailures.has(subDocPath)) {
                  throw new Error(`Simulated I/O Error writing subdocument: ${subDocPath}`);
                }
                const key = `${colName}/${docId}/${subName}`;
                if (!self.subcollections.has(key)) {
                  self.subcollections.set(key, new Map());
                }
                const subMap = self.subcollections.get(key)!;
                if (options?.merge && subMap.has(subId)) {
                  subMap.set(subId, { ...subMap.get(subId), ...data });
                } else {
                  subMap.set(subId, data);
                }
              },
            }),
          }),
        }),
      }),
    };
  }
}

describe('PHASE 8 FINAL: Independent Disaster Recovery Validation Test Suite', () => {
  const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
  const mockDb = new IsolatedMockFirestore();

  beforeEach(() => {
    mockDb.reset();
  });

  afterEach(() => {
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      for (const f of files) {
        if (
          f.startsWith('QUIZPRO_BACKUP_') ||
          f.startsWith('TEST_') ||
          f.startsWith('PRE_RESTORE_SAFETY_') ||
          f.startsWith('.restore_checkpoint_')
        ) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, f));
          } catch {}
        }
      }
    }
  });

  // =========================================================================
  // 1. FIRESTORE EXPORT COMPLETENESS & DISCOVERY
  // =========================================================================
  describe('1. Firestore Export Completeness & Discovery', () => {
    it('discovers and exports all 56 verified QuizPro collections without omitting empty ones', async () => {
      // Seed 3 collections, leave remaining 53 empty
      mockDb.setDocSync('subjects', 'subj_neet_phy', { name: 'NEET Physics', code: 'PHY' });
      mockDb.setDocSync('chapters', 'chap_kinematics', { subjectId: 'subj_neet_phy', name: 'Kinematics' });
      mockDb.setDocSync('topics', 'top_vectors', { chapterId: 'chap_kinematics', name: 'Vectors' });

      const exportJob = await executeExportJob(
        'job_export_audit_p8',
        { scope: 'full', exportStorage: false },
        {
          adminDb: mockDb.getAdminDb(),
          projectId: 'quizpro-audit-prod',
          databaseId: '(default)',
          apiKey: 'mock-key',
        }
      );

      expect(exportJob.status).toBe('completed');
      expect(exportJob.totalCollections).toBe(VERIFIED_QUIZPRO_COLLECTIONS.length);
      expect(exportJob.exportedDocuments).toBe(3);

      const zipPath = path.join(BACKUP_DIR, exportJob.backupFilename!);
      expect(fs.existsSync(zipPath)).toBe(true);
      const zipBuf = fs.readFileSync(zipPath);
      const extracted = readZipBuffer(zipBuf);

      // Verify all 56 collections exist as valid JSON files
      for (const col of VERIFIED_QUIZPRO_COLLECTIONS) {
        const file = extracted.find((f) => f.name === `firestore/collections/${col}.json`);
        expect(file).toBeDefined();
        const content = JSON.parse(file!.data.toString('utf8'));
        expect(Array.isArray(content)).toBe(true);
        if (col === 'subjects' || col === 'chapters' || col === 'topics') {
          expect(content.length).toBe(1);
        } else {
          expect(content.length).toBe(0);
        }
      }
      deleteStoredBackup(exportJob.backupFilename!);
    });

    it('recursively discovers and exports nested subcollections (users/progress, articles/blocks)', async () => {
      mockDb.setDocSync('users', 'usr_student_42', { email: 'student42@quizpro.com', role: 'student' });
      mockDb.setSubdocSync('users', 'usr_student_42', 'progress', 'prog_neet_phy', {
        completedQuestions: 150,
        accuracy: 92.4,
      });
      mockDb.setSubdocSync('users', 'usr_student_42', 'bookmarks', 'bm_q101', {
        questionId: 'q101',
        savedAt: '2026-01-01T00:00:00.000Z',
      });

      mockDb.setDocSync('articles', 'art_strategy_guide', { title: 'NEET 2026 Strategy', published: true });
      mockDb.setSubdocSync('articles', 'art_strategy_guide', 'blocks', 'blk_intro', {
        type: 'paragraph',
        text: 'Follow NCERT guidelines.',
      });

      const exportJob = await executeExportJob(
        'job_export_subcols_p8',
        { scope: 'full', exportStorage: false },
        {
          adminDb: mockDb.getAdminDb(),
          projectId: 'quizpro-subcol-test',
          databaseId: '(default)',
          apiKey: 'mock',
        }
      );

      expect(exportJob.status).toBe('completed');
      expect(exportJob.exportedDocuments).toBe(5); // 2 root + 3 subdocs

      const zipBuf = fs.readFileSync(path.join(BACKUP_DIR, exportJob.backupFilename!));
      const extracted = readZipBuffer(zipBuf);

      const userProgress = extracted.find((f) => f.name === 'firestore/subcollections/users__progress.json');
      const userBookmarks = extracted.find((f) => f.name === 'firestore/subcollections/users__bookmarks.json');
      const articleBlocks = extracted.find((f) => f.name === 'firestore/subcollections/articles__blocks.json');

      expect(userProgress).toBeDefined();
      expect(userBookmarks).toBeDefined();
      expect(articleBlocks).toBeDefined();

      const progData = JSON.parse(userProgress!.data.toString('utf8'));
      expect(progData[0].parentId).toBe('usr_student_42');
      expect(progData[0].id).toBe('prog_neet_phy');
      expect(progData[0].data.completedQuestions).toBe(150);

      deleteStoredBackup(exportJob.backupFilename!);
    });

    it('preserves exact custom document IDs, special characters, and slug formats', async () => {
      const specialIds = [
        'neet-ug_biology_2026',
        'chem_equilibrium#sec-02',
        'q_mcq_1001@v1.2',
      ];
      for (const id of specialIds) {
        mockDb.setDocSync('questions', id, { questionNumber: 1, text: `Test question ${id}` });
      }

      const exportJob = await executeExportJob(
        'job_export_ids_p8',
        { scope: 'selective', selectedCollections: ['questions'], exportStorage: false },
        { adminDb: mockDb.getAdminDb(), projectId: 'quizpro-ids', databaseId: '(default)', apiKey: 'mock' }
      );

      const zipBuf = fs.readFileSync(path.join(BACKUP_DIR, exportJob.backupFilename!));
      const extracted = readZipBuffer(zipBuf);
      const qFile = extracted.find((f) => f.name === 'firestore/collections/questions.json');
      const docs = JSON.parse(qFile!.data.toString('utf8'));

      expect(docs.map((d: any) => d.id)).toEqual(expect.arrayContaining(specialIds));
      deleteStoredBackup(exportJob.backupFilename!);
    });
  });

  // =========================================================================
  // 2. ZIP AND MANIFEST SECURITY VALIDATION
  // =========================================================================
  describe('2. ZIP and Manifest Security Validation', () => {
    it('rejects corrupted archives where a file CRC32 checksum does not match central directory', () => {
      const entries: ZipEntry[] = [
        { name: 'backup_manifest.json', data: JSON.stringify({ version: '2.0.0' }) },
        { name: 'firestore/collections/subjects.json', data: JSON.stringify([{ id: 'subj_1', data: { name: 'Physics' } }]) },
      ];
      const validZip = createZipBuffer(entries);

      // Mutate payload byte inside compressed stream to trigger CRC32 failure on inflate
      const corruptedZip = Buffer.from(validZip);
      corruptedZip[70] = corruptedZip[70] ^ 0xff;

      expect(() => readZipBuffer(corruptedZip)).toThrow();
    });

    it('detects and rejects ZIP Slip path traversal attacks (../ escapes)', () => {
      const maliciousEntries: ZipEntry[] = [
        { name: '../../etc/passwd', data: 'root:x:0:0:root:/root:/bin/bash' },
        { name: 'backup_manifest.json', data: '{}' },
      ];
      const zipBuf = createZipBuffer(maliciousEntries);
      expect(() => readZipBuffer(zipBuf)).toThrow(/Security Violation: Illegal path traversal detected/);
    });

    it('detects and rejects duplicate archive entry paths inside the ZIP', () => {
      const entriesWithDuplicates: ZipEntry[] = [
        { name: 'backup_manifest.json', data: '{"version":"2.0.0"}' },
        { name: 'firestore/collections/users.json', data: '[]' },
        { name: 'firestore/collections/users.json', data: '[{"id":"injected"}]' },
      ];
      const zipBuf = createZipBuffer(entriesWithDuplicates);
      expect(() => readZipBuffer(zipBuf)).toThrow(/Security Violation: Duplicate archive entry path detected/);
    });

    it('rejects restore when SHA-256 integrity manifest check fails (tampered file)', async () => {
      const entries: ZipEntry[] = [
        {
          name: 'backup_manifest.json',
          data: JSON.stringify({
            backupFormatVersion: '2.0.0',
            appName: 'QUIZPRO / DISHA 20-20',
            sourceProjectId: 'test-src',
            collectionInventory: { subjects: 1 },
          }),
        },
        { name: 'firestore/collections/subjects.json', data: JSON.stringify([{ id: 'subj_real', data: {} }]) },
      ];

      const integrityMap = generateIntegrityManifest(entries);
      entries.push({
        name: 'reports/integrity_manifest.json',
        data: JSON.stringify(integrityMap, null, 2),
      });

      // Tamper subjects.json after manifest generation
      const subjectsEntry = entries.find((e) => e.name === 'firestore/collections/subjects.json')!;
      subjectsEntry.data = JSON.stringify([{ id: 'subj_TAMPERED', data: { malicious: true } }]);

      const tamperedZipBuf = createZipBuffer(entries);

      const restoreJob = await executeRestoreJob(
        'job_tampered_test_p8',
        {
          backupId: 'tampered.zip',
          restoreMode: 'RESTORE_MISSING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        tamperedZipBuf,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'test-dest', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(restoreJob.status).toBe('failed');
      expect(restoreJob.errors[0]).toMatch(/Integrity verification failed/);
    });
  });

  // =========================================================================
  // 3. RESTORE SAFETY ACROSS ALL 5 MODES
  // =========================================================================
  describe('3. Restore Safety Across All 5 Supported Modes', () => {
    const backupSubjects = [
      { id: 'subj_phy', data: { name: 'Physics', v: 1 } },
      { id: 'subj_chem', data: { name: 'Chemistry', v: 1 } },
    ];
    let testBackupZip: Buffer;

    beforeEach(() => {
      const entries: ZipEntry[] = [
        {
          name: 'backup_manifest.json',
          data: JSON.stringify({
            backupFormatVersion: '2.0.0',
            appName: 'QUIZPRO / DISHA 20-20',
            sourceProjectId: 'quizpro-source',
            collectionInventory: { subjects: 2 },
          }),
        },
        {
          name: 'firestore/collections/subjects.json',
          data: JSON.stringify(backupSubjects, null, 2),
        },
      ];
      const integrityMap = generateIntegrityManifest(entries);
      entries.push({
        name: 'reports/integrity_manifest.json',
        data: JSON.stringify(integrityMap, null, 2),
      });
      testBackupZip = createZipBuffer(entries);
    });

    it('Mode 1: RESTORE_MISSING_DOCUMENTS restores missing docs and NEVER overwrites modified existing docs', async () => {
      mockDb.setDocSync('subjects', 'subj_phy', { name: 'Physics (Modified Production)', v: 99 });

      const job = await executeRestoreJob(
        'job_mode1_p8',
        {
          backupId: 'backup.zip',
          restoreMode: 'RESTORE_MISSING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        testBackupZip,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'quizpro-dest', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(job.status).toBe('completed');
      expect(job.restoredDocuments).toBe(1); // subj_chem added
      expect(job.skippedDocuments).toBe(1);  // subj_phy skipped

      const phyDoc = mockDb.collections.get('subjects')!.get('subj_phy');
      const chemDoc = mockDb.collections.get('subjects')!.get('subj_chem');

      expect(phyDoc.name).toBe('Physics (Modified Production)');
      expect(chemDoc.name).toBe('Chemistry');
    });

    it('Mode 2: OVERWRITE_EXISTING_DOCUMENTS overwrites modified docs, leaves identical docs skipped, adds missing', async () => {
      mockDb.setDocSync('subjects', 'subj_phy', { name: 'Physics', v: 1 });
      mockDb.setDocSync('subjects', 'subj_chem', { name: 'Old Chem', v: 0 });

      const job = await executeRestoreJob(
        'job_mode2_p8',
        {
          backupId: 'backup.zip',
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        testBackupZip,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'quizpro-dest', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(job.status).toBe('completed');
      expect(job.overwrittenDocuments).toBe(1);
      expect(job.skippedDocuments).toBe(1);

      const chemDoc = mockDb.collections.get('subjects')!.get('subj_chem');
      expect(chemDoc.name).toBe('Chemistry');
      expect(chemDoc.v).toBe(1);
    });

    it('Mode 3: RESTORE_INTO_EMPTY_PROJECT writes cleanly into empty project but warns and skips if docs already exist', async () => {
      // 1. Clean destination
      const job1 = await executeRestoreJob(
        'job_mode3_empty_p8',
        {
          backupId: 'backup.zip',
          restoreMode: 'RESTORE_INTO_EMPTY_PROJECT',
          confirmationPhrase: 'CONFIRM',
        },
        testBackupZip,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'quizpro-dest-empty', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(job1.status).toBe('completed');
      expect(job1.restoredDocuments).toBe(2);

      // 2. Re-run against now populated database
      const job2 = await executeRestoreJob(
        'job_mode3_populated_p8',
        {
          backupId: 'backup.zip',
          restoreMode: 'RESTORE_INTO_EMPTY_PROJECT',
          confirmationPhrase: 'CONFIRM',
        },
        testBackupZip,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'quizpro-dest-empty', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(job2.status).toBe('completed_with_warnings');
      expect(job2.restoredDocuments).toBe(0);
      expect(job2.skippedDocuments).toBe(2);
      expect(job2.warnings.some((w) => w.includes('already exists; skipped'))).toBe(true);
    });

    it('Mode 4: SELECTIVE_RESTORE restores only requested collections leaving others untouched', async () => {
      const multiColZipEntries: ZipEntry[] = [
        {
          name: 'backup_manifest.json',
          data: JSON.stringify({
            backupFormatVersion: '2.0.0',
            appName: 'QUIZPRO / DISHA 20-20',
            sourceProjectId: 'src',
            collectionInventory: { subjects: 1, chapters: 1, questions: 1 },
          }),
        },
        { name: 'firestore/collections/subjects.json', data: JSON.stringify([{ id: 's1', data: { name: 'S1' } }]) },
        { name: 'firestore/collections/chapters.json', data: JSON.stringify([{ id: 'c1', data: { name: 'C1' } }]) },
        { name: 'firestore/collections/questions.json', data: JSON.stringify([{ id: 'q1', data: { name: 'Q1' } }]) },
      ];
      const multiZip = createZipBuffer(multiColZipEntries);

      const job = await executeRestoreJob(
        'job_mode4_sel_p8',
        {
          backupId: 'multi.zip',
          restoreMode: 'SELECTIVE_RESTORE',
          selectedCollections: ['subjects'],
          confirmationPhrase: 'CONFIRM',
        },
        multiZip,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'dest', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(job.status).toBe('completed');
      expect(job.totalCollections).toBe(1);
      expect(job.restoredDocuments).toBe(1);

      expect(mockDb.collections.has('subjects')).toBe(true);
      expect(mockDb.collections.has('chapters')).toBe(false);
      expect(mockDb.collections.has('questions')).toBe(false);
    });

    it('Mode 5: MIGRATION_RESTORE restores across project boundaries preserving all foreign keys and relations', async () => {
      const migrationEntries: ZipEntry[] = [
        {
          name: 'backup_manifest.json',
          data: JSON.stringify({
            backupFormatVersion: '2.0.0',
            appName: 'QUIZPRO / DISHA 20-20',
            sourceProjectId: 'old-project',
            collectionInventory: { subjects: 1, chapters: 1, topics: 1, questions: 1 },
          }),
        },
        { name: 'firestore/collections/subjects.json', data: JSON.stringify([{ id: 'subj_botany', data: { title: 'Botany' } }]) },
        { name: 'firestore/collections/chapters.json', data: JSON.stringify([{ id: 'chap_plant_phys', data: { subjectId: 'subj_botany', title: 'Plant Physiology' } }]) },
        { name: 'firestore/collections/topics.json', data: JSON.stringify([{ id: 'top_photosynthesis', data: { chapterId: 'chap_plant_phys', title: 'Photosynthesis' } }]) },
        { name: 'firestore/collections/questions.json', data: JSON.stringify([{ id: 'mcq_calvin_cycle', data: { subjectId: 'subj_botany', chapterId: 'chap_plant_phys', topicId: 'top_photosynthesis', text: 'Where does Calvin cycle take place?' } }]) },
      ];
      const migrationZip = createZipBuffer(migrationEntries);

      const job = await executeRestoreJob(
        'job_mode5_mig_p8',
        {
          backupId: 'migration.zip',
          restoreMode: 'MIGRATION_RESTORE',
          confirmationPhrase: 'CONFIRM',
        },
        migrationZip,
        { uid: 'admin_migrator', email: 'lead@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'new-prod-project', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(job.status).toBe('completed');
      expect(job.restoredDocuments).toBe(4);

      const q = mockDb.collections.get('questions')!.get('mcq_calvin_cycle');
      expect(q.subjectId).toBe('subj_botany');
      expect(q.chapterId).toBe('chap_plant_phys');
      expect(q.topicId).toBe('top_photosynthesis');

      expect(mockDb.collections.get('topics')!.has(q.topicId)).toBe(true);
      expect(mockDb.collections.get('chapters')!.has(q.chapterId)).toBe(true);
      expect(mockDb.collections.get('subjects')!.has(q.subjectId)).toBe(true);
    });
  });

  // =========================================================================
  // 4. PARTIAL FAILURE SIMULATION & CHECKPOINTED RECOVERY
  // =========================================================================
  describe('4. Partial Failure Simulation & Checkpointed Recovery', () => {
    it('accurately tracks progress in checkpoints, identifies exact failed document, and resumes idempotently without duplicate writes', async () => {
      const docs = [
        { id: 'doc_1', data: { val: 1 } },
        { id: 'doc_2', data: { val: 2 } },
        { id: 'doc_FAIL_ME', data: { val: 3 } },
        { id: 'doc_4', data: { val: 4 } },
      ];

      const entries: ZipEntry[] = [
        {
          name: 'backup_manifest.json',
          data: JSON.stringify({
            backupFormatVersion: '2.0.0',
            appName: 'QUIZPRO / DISHA 20-20',
            sourceProjectId: 'src',
            collectionInventory: { test_col: 4 },
          }),
        },
        { name: 'firestore/collections/test_col.json', data: JSON.stringify(docs) },
      ];
      const zipBuf = createZipBuffer(entries);

      // Step 1: Inject failure on doc_FAIL_ME
      mockDb.writeFailures.add('test_col/doc_FAIL_ME');

      const job1 = await executeRestoreJob(
        'job_failure_test_p8',
        {
          backupId: 'fail_test.zip',
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        zipBuf,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'dest', databaseId: '(default)', apiKey: 'mock' }
      );

      // Verify partial failure tracking
      expect(job1.status).toBe('completed_with_warnings');
      expect(job1.failedDocuments).toBe(1);
      expect(job1.restoredDocuments).toBe(3);
      expect(job1.errors[0]).toMatch(/Failed writing test_col\/doc_FAIL_ME/);

      const checkpoint = getRestoreCheckpoint('job_failure_test_p8');
      expect(checkpoint).not.toBeNull();
      expect(checkpoint!.failedDocPaths.length).toBe(1);
      expect(checkpoint!.failedDocPaths[0].path).toBe('test_col/doc_FAIL_ME');

      // Step 2: Clear failure condition and resume
      mockDb.writeFailures.clear();

      const resumeJob = await executeRestoreJob(
        'job_failure_test_p8_resume',
        {
          backupId: 'fail_test.zip',
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        zipBuf,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'dest', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(resumeJob.status).toBe('completed');
      expect(resumeJob.failedDocuments).toBe(0);
      expect(resumeJob.restoredDocuments).toBe(1); // Only the failed doc was missing and restored!
      expect(resumeJob.skippedDocuments).toBe(3);  // doc_1, doc_2, doc_4 identical

      expect(mockDb.collections.get('test_col')!.size).toBe(4);
    });
  });

  // =========================================================================
  // 5. PRE-RESTORE SAFETY SNAPSHOT & ABORT GUARD
  // =========================================================================
  describe('5. Pre-Restore Safety Snapshot & Abort Guard', () => {
    it('creates and verifies pre-restore safety snapshot before writing any documents', async () => {
      mockDb.setDocSync('subjects', 'subj_safe_1', { name: 'Initial Subject' });

      const entries: ZipEntry[] = [
        {
          name: 'backup_manifest.json',
          data: JSON.stringify({
            backupFormatVersion: '2.0.0',
            appName: 'QUIZPRO / DISHA 20-20',
            sourceProjectId: 'src',
            collectionInventory: { subjects: 1 },
          }),
        },
        { name: 'firestore/collections/subjects.json', data: JSON.stringify([{ id: 'subj_new', data: { name: 'New' } }]) },
      ];
      const zipBuf = createZipBuffer(entries);

      const job = await executeRestoreJob(
        'job_safety_snap_p8',
        {
          backupId: 'test.zip',
          restoreMode: 'OVERWRITE_EXISTING_DOCUMENTS',
          confirmationPhrase: 'CONFIRM',
        },
        zipBuf,
        { uid: 'admin_1', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'dest', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(job.status).toBe('completed');
      const safetyWarning = job.warnings.find((w) => w.includes('Pre-restore safety snapshot verified'));
      expect(safetyWarning).toBeDefined();

      const match = safetyWarning!.match(/PRE_RESTORE_SAFETY_\d+\.json/);
      expect(match).not.toBeNull();
      const snapFile = match![0];
      const snapPath = path.join(BACKUP_DIR, snapFile);

      expect(fs.existsSync(snapPath)).toBe(true);
      const snapContent = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
      expect(snapContent.subjects[0].id).toBe('subj_safe_1');
      expect(snapContent.subjects[0].data.name).toBe('Initial Subject');
    });
  });

  // =========================================================================
  // 6. ISOLATED E2E RESTORE SIMULATION & CANONICAL HASH VERIFICATION
  // =========================================================================
  describe('6. Isolated E2E Restore Simulation & Canonical Hash Verification', () => {
    it('guarantees 100% canonical hash and deep equality match between source and restored database', async () => {
      const testTimestamp = { __type__: 'Timestamp', seconds: 1731578400, nanoseconds: 0, iso: '2024-11-14T10:00:00.000Z' };
      const testGeoPoint = { __type__: 'GeoPoint', latitude: 28.6139, longitude: 77.2090 };
      const testDocRef = { __type__: 'DocumentReference', path: 'subjects/neet_chem' };
      const testBytes = { __type__: 'Bytes', base64: Buffer.from('DISHA_2020_EXAM_PREP').toString('base64') };

      mockDb.setDocSync('users', 'usr_student_alpha', {
        name: 'Student Alpha',
        email: 'alpha@quizpro.com',
      });

      mockDb.setDocSync('subjects', 'subj_neet_chem', {
        title: 'NEET Chemistry',
        createdAt: testTimestamp,
        examCenter: testGeoPoint,
      });

      mockDb.setDocSync('questions', 'q_stoichiometry_101', {
        subjectRef: testDocRef,
        assetHash: testBytes,
        marks: 4,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 2,
      });

      mockDb.setSubdocSync('users', 'usr_student_alpha', 'progress', 'prog_chem', {
        score: 96,
        updatedAt: testTimestamp,
      });

      const sourceFingerprint = {
        users: mockDb.collections.get('users')!.get('usr_student_alpha'),
        subjects: mockDb.collections.get('subjects')!.get('subj_neet_chem'),
        questions: mockDb.collections.get('questions')!.get('q_stoichiometry_101'),
        subProgress: mockDb.subcollections.get('users/usr_student_alpha/progress')!.get('prog_chem'),
      };
      const canonicalSource = serializeFirestoreValue(sourceFingerprint);
      const sourceHash = computeSha256(JSON.stringify(canonicalSource));

      // Export
      const exportJob = await executeExportJob(
        'job_e2e_sim_p8',
        { scope: 'full', exportStorage: false },
        { adminDb: mockDb.getAdminDb(), projectId: 'sim-source', databaseId: '(default)', apiKey: 'mock' }
      );
      expect(exportJob.status).toBe('completed');

      const zipBuf = fs.readFileSync(path.join(BACKUP_DIR, exportJob.backupFilename!));

      // Reset DB completely (simulate disaster recovery into clean target)
      mockDb.reset();
      expect(mockDb.collections.size).toBe(0);

      // Restore
      const restoreJob = await executeRestoreJob(
        'job_e2e_restore_p8',
        {
          backupId: exportJob.backupFilename!,
          restoreMode: 'RESTORE_INTO_EMPTY_PROJECT',
          confirmationPhrase: 'CONFIRM',
        },
        zipBuf,
        { uid: 'dr_admin', email: 'admin@quizpro.com' },
        { adminDb: mockDb.getAdminDb(), projectId: 'sim-target', databaseId: '(default)', apiKey: 'mock' }
      );

      expect(restoreJob.status).toBe('completed');
      expect(restoreJob.failedDocuments).toBe(0);

      // Read restored database
      const restoredFingerprint = {
        users: mockDb.collections.get('users')!.get('usr_student_alpha'),
        subjects: mockDb.collections.get('subjects')!.get('subj_neet_chem'),
        questions: mockDb.collections.get('questions')!.get('q_stoichiometry_101'),
        subProgress: mockDb.subcollections.get('users/usr_student_alpha/progress')!.get('prog_chem'),
      };
      const canonicalRestored = serializeFirestoreValue(restoredFingerprint);
      const restoredHash = computeSha256(JSON.stringify(canonicalRestored));
      expect(restoredHash).toBe(sourceHash);
      expect(areDocumentsIdentical(sourceFingerprint, restoredFingerprint)).toBe(true);

      // Value assertions
      expect((restoredFingerprint.subjects.createdAt as Date).toISOString()).toBe('2024-11-14T10:00:00.000Z');
      expect(restoredFingerprint.subjects.examCenter).toEqual({ latitude: 28.6139, longitude: 77.2090 });
      expect(restoredFingerprint.questions.subjectRef).toEqual({
        __type__: 'DocumentReference',
        path: 'subjects/neet_chem',
      });
      expect(Buffer.isBuffer(restoredFingerprint.questions.assetHash)).toBe(true);
      expect((restoredFingerprint.questions.assetHash as Buffer).toString('utf8')).toBe('DISHA_2020_EXAM_PREP');
      expect(restoredFingerprint.subProgress.score).toBe(96);

      deleteStoredBackup(exportJob.backupFilename!);
    });
  });

  // =========================================================================
  // 7. ADMIN PANEL WORKFLOW & LOCAL ARCHIVE DELETION ISOLATION
  // =========================================================================
  describe('7. Admin Panel Workflow & Local Archive Deletion Isolation', () => {
    it('verifies deleting a stored backup file from disk NEVER deletes underlying Firebase database records', async () => {
      mockDb.setDocSync('subjects', 'subj_untouchable', { name: 'Untouchable Record' });

      const exportJob = await executeExportJob(
        'job_delete_safety_test_p8',
        { scope: 'selective', selectedCollections: ['subjects'], exportStorage: false },
        { adminDb: mockDb.getAdminDb(), projectId: 'proj', databaseId: '(default)', apiKey: 'mock' }
      );

      const backupFilename = exportJob.backupFilename!;
      expect(fs.existsSync(path.join(BACKUP_DIR, backupFilename))).toBe(true);

      const deleted = deleteStoredBackup(backupFilename);
      expect(deleted).toBe(true);
      expect(fs.existsSync(path.join(BACKUP_DIR, backupFilename))).toBe(false);

      // Verify Firestore record is completely intact
      expect(mockDb.collections.get('subjects')!.has('subj_untouchable')).toBe(true);
      expect(mockDb.collections.get('subjects')!.get('subj_untouchable').name).toBe('Untouchable Record');
    });
  });
});
