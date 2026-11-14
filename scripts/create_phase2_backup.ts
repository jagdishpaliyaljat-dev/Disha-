import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface BackupPayload {
  backupTimestamp: string;
  schemaVersion: number;
  totalMCQs: number;
  totalSubjects: number;
  totalChapters: number;
  totalTopics: number;
  mcqIds: string[];
  subjects: any[];
  chapters: any[];
  topics: any[];
  mcqs: any[];
  sha256Checksum: string;
  metadata: {
    source: string;
    description: string;
    status: string;
  };
}

async function runPreMigrationBackup() {
  console.log('[Phase 2 Backup] Starting verified pre-migration backup generation...');

  const rootDir = process.cwd();
  const prodBackupPath = path.join(rootDir, 'full_production_backup_576.json');
  const task2BackupPath = path.join(rootDir, 'backups', 'phase4_task2_curriculum_and_19_questions_backup.json');
  const targetBackupDir = path.join(rootDir, 'backups');

  if (!fs.existsSync(prodBackupPath)) {
    throw new Error(`Production backup file missing at: ${prodBackupPath}`);
  }
  if (!fs.existsSync(task2BackupPath)) {
    throw new Error(`Task 2 curriculum backup missing at: ${task2BackupPath}`);
  }

  const prodRaw = JSON.parse(fs.readFileSync(prodBackupPath, 'utf-8'));
  const task2Raw = JSON.parse(fs.readFileSync(task2BackupPath, 'utf-8'));

  const mcqs: any[] = prodRaw.records || [];
  if (mcqs.length !== 576) {
    throw new Error(`Expected exactly 576 MCQs, found ${mcqs.length}`);
  }

  const subjects: any[] = task2Raw.existingSubjects || [];
  const chapters: any[] = task2Raw.existingChapters || [];
  const topics: any[] = task2Raw.existingTopics || [];

  const mcqIds = mcqs.map(m => m.id).sort();
  const uniqueIds = new Set(mcqIds);
  if (uniqueIds.size !== 576) {
    throw new Error(`Duplicate MCQ IDs detected! Expected 576 unique, got ${uniqueIds.size}`);
  }

  // Pre-calculate content hash (without sha256Checksum field)
  const contentToHash = JSON.stringify({
    schemaVersion: 2,
    totalMCQs: mcqs.length,
    totalSubjects: subjects.length,
    totalChapters: chapters.length,
    totalTopics: topics.length,
    mcqIds,
    subjects,
    chapters,
    topics,
    mcqs
  });

  const sha256 = crypto.createHash('sha256').update(contentToHash).digest('hex');

  const backupData: BackupPayload = {
    backupTimestamp: new Date().toISOString(),
    schemaVersion: 2,
    totalMCQs: mcqs.length,
    totalSubjects: subjects.length,
    totalChapters: chapters.length,
    totalTopics: topics.length,
    mcqIds,
    subjects,
    chapters,
    topics,
    mcqs,
    sha256Checksum: sha256,
    metadata: {
      source: 'full_production_backup_576.json + task2_curriculum',
      description: 'Phase 2 Pre-Migration Immutable Backup for Complete Snapshot Architecture Replacement',
      status: 'VERIFIED_HEALTHY'
    }
  };

  const backupFilePath = path.join(targetBackupDir, 'phase2_verified_production_backup.json');
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

  // Verify readability and checksum match
  const readBack = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));
  const verifyHashContent = JSON.stringify({
    schemaVersion: readBack.schemaVersion,
    totalMCQs: readBack.totalMCQs,
    totalSubjects: readBack.totalSubjects,
    totalChapters: readBack.totalChapters,
    totalTopics: readBack.totalTopics,
    mcqIds: readBack.mcqIds,
    subjects: readBack.subjects,
    chapters: readBack.chapters,
    topics: readBack.topics,
    mcqs: readBack.mcqs
  });
  const recomputedHash = crypto.createHash('sha256').update(verifyHashContent).digest('hex');

  if (recomputedHash !== readBack.sha256Checksum) {
    throw new Error(`Integrity verification failed! Hashes do not match.`);
  }

  const manifestPath = path.join(targetBackupDir, 'phase2_backup_manifest.json');
  const manifest = {
    backupFile: 'phase2_verified_production_backup.json',
    fileSizeBytes: fs.statSync(backupFilePath).size,
    createdAt: backupData.backupTimestamp,
    mcqCount: backupData.totalMCQs,
    subjectCount: backupData.totalSubjects,
    chapterCount: backupData.totalChapters,
    topicCount: backupData.totalTopics,
    sha256: sha256,
    verificationStatus: 'PASSED_100_PERCENT'
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`[Phase 2 Backup] Successfully generated and verified backup:`);
  console.log(` - File: ${backupFilePath} (${(manifest.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(` - Total MCQs: ${backupData.totalMCQs} (100% unique IDs)`);
  console.log(` - Total Subjects: ${backupData.totalSubjects}`);
  console.log(` - Total Chapters: ${backupData.totalChapters}`);
  console.log(` - Total Topics: ${backupData.totalTopics}`);
  console.log(` - SHA-256: ${sha256}`);
  console.log(` - Manifest: ${manifestPath}`);
}

runPreMigrationBackup().catch(err => {
  console.error('[Phase 2 Backup] ERROR:', err);
  process.exit(1);
});
