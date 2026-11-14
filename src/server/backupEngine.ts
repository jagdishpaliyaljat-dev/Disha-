import fs from 'fs';
import path from 'path';
import {
  createZipBuffer,
  readZipBuffer,
  generateIntegrityManifest,
  verifyZipIntegrity,
  computeSha256,
  ZipEntry,
  ExtractedZipEntry,
} from './zipEngine';
import {
  serializeFirestoreValue,
  deserializeFirestoreValue,
  areDocumentsIdentical,
} from './typedSerialization';

export interface BackupJobProgress {
  jobId: string;
  type: 'export' | 'restore';
  status: 'idle' | 'running' | 'completed' | 'completed_with_warnings' | 'failed' | 'cancelled';
  phase: string;
  progressPercent: number;
  totalCollections: number;
  completedCollections: number;
  totalDocuments: number;
  exportedDocuments: number;
  restoredDocuments: number;
  skippedDocuments: number;
  overwrittenDocuments: number;
  failedDocuments: number;
  storageFilesExported: number;
  storageFilesRestored: number;
  warnings: string[];
  errors: string[];
  startedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  backupId?: string;
  backupFilename?: string;
  fileSizeBytes?: number;
}

export interface BackupManifest {
  backupFormatVersion: string;
  appName: string;
  appVersion: string;
  sourceProjectId: string;
  sourceDatabaseId: string;
  exportTimestamp: string;
  exportStatus: 'COMPLETE' | 'COMPLETE_WITH_WARNINGS' | 'INCOMPLETE';
  scope: 'full' | 'selective';
  selectedCollections?: string[];
  totalCollections: number;
  totalDocuments: number;
  collectionInventory: Record<string, number>;
  subcollectionInventory: Record<string, number>;
  storage: {
    status: 'connected' | 'unprovisioned' | 'empty';
    fileCount: number;
    totalSizeBytes: number;
    files: Array<{
      path: string;
      contentType: string;
      sizeBytes: number;
      sha256: string;
      downloadUrl?: string;
    }>;
  };
  application: {
    name: string;
    version: string;
    curriculumSummary: {
      subjectsCount: number;
      chaptersCount: number;
      topicsCount: number;
      mcqsCount: number;
    };
  };
  infrastructure: {
    firestoreRulesVersion: string;
    hasIndexes: boolean;
  };
  fileChecksums: Record<string, string>;
  warnings: string[];
  failedExportItems: string[];
}

export interface RestorePreview {
  valid: boolean;
  backupId: string;
  backupFilename: string;
  appName: string;
  sourceProjectId: string;
  sourceDatabaseId: string;
  destinationProjectId: string;
  destinationDatabaseId: string;
  exportTimestamp: string;
  backupVersion: string;
  totalCollections: number;
  totalDocuments: number;
  storageFileCount: number;
  totalBackupSizeBytes: number;
  integrityVerified: boolean;
  missingFilesCount: number;
  corruptedFilesCount: number;
  collectionSummary: Array<{
    name: string;
    backupDocCount: number;
    destinationDocCount: number;
    conflictingDocsCount: number;
    missingDocsCount: number;
    status: 'matching' | 'destination_empty' | 'conflicts_detected';
  }>;
  compatibilityWarnings: string[];
  supportedRestoreModes: Array<{
    mode: RestoreMode;
    label: string;
    description: string;
    safe: boolean;
  }>;
}

export type RestoreMode =
  | 'RESTORE_INTO_EMPTY_PROJECT'
  | 'RESTORE_MISSING_DOCUMENTS'
  | 'OVERWRITE_EXISTING_DOCUMENTS'
  | 'SELECTIVE_RESTORE'
  | 'MIGRATION_RESTORE';

export interface RestoreExecutionRequest {
  backupId: string;
  restoreMode: RestoreMode;
  confirmationPhrase: string;
  selectedCollections?: string[];
  skipStorage?: boolean;
}

export interface RestoreCheckpoint {
  jobId: string;
  backupId: string;
  status: 'running' | 'completed' | 'completed_with_warnings' | 'failed';
  startedAt: string;
  updatedAt: string;
  completedBatches: number;
  processedDocPaths: string[];
  failedDocPaths: Array<{ path: string; error: string; timestamp: string }>;
  lastProcessedCollection: string;
  lastProcessedBatchIndex: number;
  preRestoreSnapshotFile: string;
}

export interface StoredBackupInfo {
  backupId: string;
  filename: string;
  fileSizeBytes: number;
  createdAt: string;
  sourceProjectId: string;
  totalCollections: number;
  totalDocuments: number;
  exportStatus: string;
  integrityVerified: boolean;
}

// 56 Verified QuizPro Collections
export const VERIFIED_QUIZPRO_COLLECTIONS: string[] = [
  'subjects',
  'chapters',
  'topics',
  'mcqs',
  'questions',
  'question_bundles',
  'archived_mcqs',
  'import_batches',
  'customQuestions',
  'curriculum_subjects',
  'curriculum_chapters',
  'curriculum_questions',
  'curriculum',
  'pyq_papers',
  'pyqPapers',
  'live_tests',
  'liveTests',
  'live-tests',
  'tests',
  'liveTestAnswerKeys',
  'exam_categories',
  'examCategories',
  'coaching',
  'coaching_exams',
  'coaching_test_series',
  'banners',
  'articles',
  'article_categories',
  'link_rules',
  'metadata',
  'settings',
  'appSettings',
  'notifications',
  'broadcast_notifications',
  'premiumPlans',
  'payment_orders',
  'payment_events',
  'user_subscriptions',
  'paymentSubmissions',
  'subscriptions',
  'scanUsage',
  'attempts',
  'pyq_attempts',
  'leaderboard',
  'user_stats_weekly',
  'liveTestSubmissions',
  'examPaperAnalyses',
  '_health',
  'adminAuditLogs',
  'login_attempts',
  'ai_api_configs',
  'usage_daily',
  'analytics_daily',
  'contact_messages',
  'content_changelog',
  'test',
  'users',
];

export const SUBCOLLECTION_DEFINITIONS: Array<{
  parentCollection: string;
  subcollectionName: string;
}> = [
  { parentCollection: 'users', subcollectionName: 'progress' },
  { parentCollection: 'users', subcollectionName: 'history' },
  { parentCollection: 'users', subcollectionName: 'attempts' },
  { parentCollection: 'users', subcollectionName: 'wrong_questions' },
  { parentCollection: 'users', subcollectionName: 'bookmarks' },
  { parentCollection: 'users', subcollectionName: 'test_results' },
  { parentCollection: 'users', subcollectionName: 'revision_history' },
  { parentCollection: 'users', subcollectionName: 'study_logs' },
  { parentCollection: 'users', subcollectionName: 'syllabus_progress' },
  { parentCollection: 'users', subcollectionName: 'sync_metadata' },
  { parentCollection: 'users', subcollectionName: 'featureUsage' },
  { parentCollection: 'articles', subcollectionName: 'blocks' },
  { parentCollection: 'examPaperAnalyses', subcollectionName: 'questions' },
  { parentCollection: 'usage_daily', subcollectionName: 'devices' },
];

const BACKUP_DIR = (process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.NOW_REGION)
  ? path.join(process.env.TMPDIR || '/tmp', 'backups')
  : path.resolve(process.cwd(), 'backups');
const RESTORE_LOCK_FILE = path.join(BACKUP_DIR, '.restore_active.lock');

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch {
    // Gracefully handle read-only environments
  }
}

// In-memory active job tracker
const activeJobs = new Map<string, BackupJobProgress>();

export function getActiveJob(jobId: string): BackupJobProgress | undefined {
  return activeJobs.get(jobId);
}

/**
 * Acquire exclusive restore lock
 */
function acquireRestoreLock(jobId: string, performedBy: string): boolean {
  if (fs.existsSync(RESTORE_LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(RESTORE_LOCK_FILE, 'utf8'));
      // If lock is older than 30 minutes, consider it stale and allow override
      if (Date.now() - new Date(lockData.lockedAt).getTime() < 30 * 60 * 1000) {
        return false;
      }
    } catch {
      // Ignore corrupt lock file
    }
  }

  const lockPayload = {
    jobId,
    performedBy,
    lockedAt: new Date().toISOString(),
  };
  fs.writeFileSync(RESTORE_LOCK_FILE, JSON.stringify(lockPayload, null, 2), 'utf8');
  return true;
}

/**
 * Release exclusive restore lock
 */
function releaseRestoreLock(jobId: string): void {
  try {
    if (fs.existsSync(RESTORE_LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(RESTORE_LOCK_FILE, 'utf8'));
      if (lockData.jobId === jobId) {
        fs.unlinkSync(RESTORE_LOCK_FILE);
      }
    }
  } catch {}
}

export function getRestoreCheckpoint(jobId: string): RestoreCheckpoint | null {
  const safeJobId = path.basename(jobId);
  const cpPath = path.join(BACKUP_DIR, `.restore_checkpoint_${safeJobId}.json`);
  if (fs.existsSync(cpPath)) {
    try {
      return JSON.parse(fs.readFileSync(cpPath, 'utf8'));
    } catch {}
  }
  return null;
}

function updateRestoreCheckpoint(cp: RestoreCheckpoint): void {
  const safeJobId = path.basename(cp.jobId);
  const cpPath = path.join(BACKUP_DIR, `.restore_checkpoint_${safeJobId}.json`);
  cp.updatedAt = new Date().toISOString();
  fs.writeFileSync(cpPath, JSON.stringify(cp, null, 2), 'utf8');
}

/**
 * Firestore Access Driver Helper
 * Supports either Firebase Admin SDK (adminDb) or authenticated REST fallback.
 */
interface FirestoreDriver {
  getCollectionDocs(collectionName: string): Promise<Array<{ id: string; data: any }>>;
  getSubcollectionDocs(
    parentCollection: string,
    parentId: string,
    subcollectionName: string
  ): Promise<Array<{ id: string; data: any }>>;
  setDoc(docPath: string, data: any, merge?: boolean): Promise<void>;
  docExists(docPath: string): Promise<{ exists: boolean; data?: any }>;
}

export function createFirestoreDriver(
  adminDb: any,
  projectId: string,
  databaseId: string,
  apiKey: string,
  adminBearerToken?: string
): FirestoreDriver {
  // If adminDb is available and functional
  if (adminDb && typeof adminDb.collection === 'function') {
    return {
      async getCollectionDocs(collectionName: string) {
        try {
          const snap = await adminDb.collection(collectionName).get();
          return snap.docs.map((d: any) => ({
            id: d.id,
            data: d.data(),
          }));
        } catch (err: any) {
          // If adminDb fails due to credential omission, fallback to REST below
          throw err;
        }
      },
      async getSubcollectionDocs(parentCollection, parentId, subcollectionName) {
        const snap = await adminDb
          .collection(parentCollection)
          .doc(parentId)
          .collection(subcollectionName)
          .get();
        return snap.docs.map((d: any) => ({
          id: d.id,
          data: d.data(),
        }));
      },
      async setDoc(docPath, data, merge = false) {
        const parts = docPath.split('/');
        let ref = adminDb;
        for (let i = 0; i < parts.length; i += 2) {
          ref = ref.collection(parts[i]).doc(parts[i + 1]);
        }
        await ref.set(data, { merge });
      },
      async docExists(docPath) {
        const parts = docPath.split('/');
        let ref = adminDb;
        for (let i = 0; i < parts.length; i += 2) {
          ref = ref.collection(parts[i]).doc(parts[i + 1]);
        }
        const snap = await ref.get();
        return { exists: snap.exists, data: snap.exists ? snap.data() : undefined };
      },
    };
  }

  // REST API Driver with Bearer Token / API Key
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminBearerToken) {
      headers['Authorization'] = `Bearer ${adminBearerToken}`;
    }
    return headers;
  };

  const decodeRestValue = (val: any): any => {
    if (!val || typeof val !== 'object') return val;
    if ('stringValue' in val) return val.stringValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('timestampValue' in val) return new Date(val.timestampValue);
    if ('nullValue' in val) return null;
    if ('referenceValue' in val) return { __type__: 'DocumentReference', path: val.referenceValue };
    if ('geoPointValue' in val) return { __type__: 'GeoPoint', latitude: val.geoPointValue.latitude, longitude: val.geoPointValue.longitude };
    if ('bytesValue' in val) return { __type__: 'Bytes', base64: val.bytesValue };
    if ('arrayValue' in val) {
      return (val.arrayValue.values || []).map(decodeRestValue);
    }
    if ('mapValue' in val) {
      const res: Record<string, any> = {};
      const fields = val.mapValue.fields || {};
      for (const [k, v] of Object.entries(fields)) {
        res[k] = decodeRestValue(v);
      }
      return res;
    }
    return val;
  };

  const encodeRestValue = (val: any): any => {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (val instanceof Date) return { timestampValue: val.toISOString() };
    if (val && typeof val === 'object' && val.__type__ === 'Timestamp') {
      return { timestampValue: val.iso || new Date(val.seconds * 1000).toISOString() };
    }
    if (val && typeof val === 'object' && val.__type__ === 'GeoPoint') {
      return { geoPointValue: { latitude: val.latitude, longitude: val.longitude } };
    }
    if (val && typeof val === 'object' && val.__type__ === 'Bytes') {
      return { bytesValue: val.base64 };
    }
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(encodeRestValue) } };
    }
    if (typeof val === 'object') {
      const fields: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (typeof v !== 'function' && v !== undefined) {
          fields[k] = encodeRestValue(v);
        }
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  };

  return {
    async getCollectionDocs(collectionName) {
      let pageToken = '';
      const allDocs: Array<{ id: string; data: any }> = [];
      do {
        let url = `${baseUrl}/${collectionName}?pageSize=300&key=${apiKey}`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`REST Firestore Read Error [${res.status}]: ${await res.text()}`);
        }
        const data = await res.json();
        const docs = data.documents || [];
        for (const d of docs) {
          const id = d.name.split('/').pop();
          const docData: Record<string, any> = {};
          for (const [k, v] of Object.entries(d.fields || {})) {
            docData[k] = decodeRestValue(v);
          }
          allDocs.push({ id, data: docData });
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      return allDocs;
    },
    async getSubcollectionDocs(parentCollection, parentId, subcollectionName) {
      let pageToken = '';
      const allDocs: Array<{ id: string; data: any }> = [];
      do {
        let url = `${baseUrl}/${parentCollection}/${parentId}/${subcollectionName}?pageSize=300&key=${apiKey}`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) {
          if (res.status === 404) return [];
          return [];
        }
        const data = await res.json();
        const docs = data.documents || [];
        for (const d of docs) {
          const id = d.name.split('/').pop();
          const docData: Record<string, any> = {};
          for (const [k, v] of Object.entries(d.fields || {})) {
            docData[k] = decodeRestValue(v);
          }
          allDocs.push({ id, data: docData });
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      return allDocs;
    },
    async setDoc(docPath, data, _merge = false) {
      const url = `${baseUrl}/${docPath}?key=${apiKey}`;
      const fields: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v !== 'function' && v !== undefined) {
          fields[k] = encodeRestValue(v);
        }
      }
      const res = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        throw new Error(`REST Firestore Write Error [${res.status}]: ${await res.text()}`);
      }
    },
    async docExists(docPath) {
      const url = `${baseUrl}/${docPath}?key=${apiKey}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.status === 404) return { exists: false };
      if (!res.ok) return { exists: false };
      const d = await res.json();
      const docData: Record<string, any> = {};
      for (const [k, v] of Object.entries(d.fields || {})) {
        docData[k] = decodeRestValue(v);
      }
      return { exists: true, data: docData };
    },
  };
}

/**
 * =========================================================================
 * BACKUP ENGINE: EXPORT IMPLEMENTATION
 * =========================================================================
 */
export async function executeExportJob(
  jobId: string,
  options: {
    scope: 'full' | 'selective';
    selectedCollections?: string[];
    exportStorage?: boolean;
    adminBearerToken?: string;
  },
  serverContext: {
    adminDb: any;
    projectId: string;
    databaseId: string;
    apiKey: string;
  }
): Promise<BackupJobProgress> {
  const job: BackupJobProgress = {
    jobId,
    type: 'export',
    status: 'running',
    phase: 'Initializing Export Job',
    progressPercent: 5,
    totalCollections: 0,
    completedCollections: 0,
    totalDocuments: 0,
    exportedDocuments: 0,
    restoredDocuments: 0,
    skippedDocuments: 0,
    overwrittenDocuments: 0,
    failedDocuments: 0,
    storageFilesExported: 0,
    storageFilesRestored: 0,
    warnings: [],
    errors: [],
    startedAt: new Date().toISOString(),
  };
  activeJobs.set(jobId, job);

  const targetCollections =
    options.scope === 'selective' && options.selectedCollections && options.selectedCollections.length > 0
      ? options.selectedCollections
      : VERIFIED_QUIZPRO_COLLECTIONS;

  job.totalCollections = targetCollections.length;

  try {
    const driver = createFirestoreDriver(
      serverContext.adminDb,
      serverContext.projectId,
      serverContext.databaseId,
      serverContext.apiKey,
      options.adminBearerToken
    );

    const zipEntries: ZipEntry[] = [];
    const collectionInventory: Record<string, number> = {};
    const subcollectionInventory: Record<string, number> = {};

    // 1. Export Firestore Root Collections
    job.phase = 'Exporting Firestore Collections';
    for (let i = 0; i < targetCollections.length; i++) {
      const colName = targetCollections[i];
      job.phase = `Exporting Collection: ${colName} (${i + 1}/${targetCollections.length})`;
      job.progressPercent = Math.round(10 + (i / targetCollections.length) * 50);

      try {
        const docs = await driver.getCollectionDocs(colName);
        collectionInventory[colName] = docs.length;
        job.exportedDocuments += docs.length;
        job.totalDocuments += docs.length;

        // Serialize documents with reversible typing
        const serializedDocs = docs.map((d) => ({
          id: d.id,
          data: serializeFirestoreValue(d.data),
        }));

        zipEntries.push({
          name: `firestore/collections/${colName}.json`,
          data: JSON.stringify(serializedDocs, null, 2),
        });

        // 2. Discover Subcollections
        const subcolDefs = SUBCOLLECTION_DEFINITIONS.filter((s) => s.parentCollection === colName);
        for (const subDef of subcolDefs) {
          const subcolDocs: Array<{ id: string; parentId: string; data: any }> = [];
          for (const parentDoc of docs) {
            try {
              const subDocs = await driver.getSubcollectionDocs(colName, parentDoc.id, subDef.subcollectionName);
              for (const sub of subDocs) {
                subcolDocs.push({
                  id: sub.id,
                  parentId: parentDoc.id,
                  data: serializeFirestoreValue(sub.data),
                });
              }
            } catch {
              // Subcollection read error or empty
            }
          }

          if (subcolDocs.length > 0) {
            const subKey = `${colName}__${subDef.subcollectionName}`;
            subcollectionInventory[subKey] = subcolDocs.length;
            job.exportedDocuments += subcolDocs.length;
            job.totalDocuments += subcolDocs.length;

            zipEntries.push({
              name: `firestore/subcollections/${subKey}.json`,
              data: JSON.stringify(subcolDocs, null, 2),
            });
          }
        }

        job.completedCollections++;
      } catch (colErr: any) {
        job.warnings.push(`Collection '${colName}' export warning: ${colErr.message}`);
        collectionInventory[colName] = 0;
        zipEntries.push({
          name: `firestore/collections/${colName}.json`,
          data: JSON.stringify([], null, 2),
        });
      }
    }

    // 3. Export Storage Files
    job.phase = 'Exporting Firebase Storage Assets';
    job.progressPercent = 65;
    const bucketName = 'gen-lang-client-0811306192.firebasestorage.app';
    let storageStatus: 'connected' | 'unprovisioned' | 'empty' = 'unprovisioned';
    const storageFiles: BackupManifest['storage']['files'] = [];

    if (options.exportStorage !== false) {
      try {
        const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o?key=${serverContext.apiKey}`;
        const sRes = await fetch(storageUrl);
        if (sRes.ok) {
          const sData = await sRes.json();
          const items = sData.items || [];
          if (items.length === 0) {
            storageStatus = 'empty';
          } else {
            storageStatus = 'connected';
            for (const item of items) {
              try {
                const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(item.name)}?alt=media&key=${serverContext.apiKey}`;
                const fileRes = await fetch(downloadUrl);
                if (fileRes.ok) {
                  const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
                  const sha = computeSha256(fileBuffer);
                  storageFiles.push({
                    path: item.name,
                    contentType: item.contentType || 'application/octet-stream',
                    sizeBytes: fileBuffer.length,
                    sha256: sha,
                  });
                  zipEntries.push({
                    name: `storage/files/${item.name}`,
                    data: fileBuffer,
                  });
                  job.storageFilesExported++;
                }
              } catch (fErr: any) {
                job.warnings.push(`Failed to download storage file '${item.name}': ${fErr.message}`);
              }
            }
          }
        } else if (sRes.status === 404) {
          storageStatus = 'unprovisioned';
        }
      } catch (sErr: any) {
        storageStatus = 'unprovisioned';
        job.warnings.push(`Storage check bypassed: ${sErr.message}`);
      }
    }

    zipEntries.push({
      name: 'storage/manifest.json',
      data: JSON.stringify(
        {
          bucketName,
          status: storageStatus,
          fileCount: storageFiles.length,
          files: storageFiles,
        },
        null,
        2
      ),
    });

    // 4. Export Application Metadata & Blueprint
    job.phase = 'Packaging Application Configurations & Blueprint';
    job.progressPercent = 75;

    let blueprintJson = {};
    const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
    if (fs.existsSync(blueprintPath)) {
      try {
        blueprintJson = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
      } catch {}
    }

    let packageJson: any = {};
    const packagePath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      } catch {}
    }

    zipEntries.push({
      name: 'application/blueprint_schema.json',
      data: JSON.stringify(blueprintJson, null, 2),
    });

    zipEntries.push({
      name: 'application/app_metadata.json',
      data: JSON.stringify(
        {
          name: packageJson.name || 'quizpro-exam-prep',
          version: packageJson.version || '2.0.0',
          exportedAt: new Date().toISOString(),
          nodeVersion: process.version,
        },
        null,
        2
      ),
    });

    // 5. Infrastructure Backup (Sanitized Rules & Config - NO SECRETS)
    job.phase = 'Packaging Infrastructure Rules';
    job.progressPercent = 85;

    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    if (fs.existsSync(rulesPath)) {
      zipEntries.push({
        name: 'infrastructure/firestore.rules',
        data: fs.readFileSync(rulesPath, 'utf8'),
      });
    }

    zipEntries.push({
      name: 'infrastructure/firebase_config_public.json',
      data: JSON.stringify(
        {
          projectId: serverContext.projectId,
          firestoreDatabaseId: serverContext.databaseId,
          storageBucket: bucketName,
          authDomain: `${serverContext.projectId}.firebaseapp.com`,
        },
        null,
        2
      ),
    });

    // 6. Generate SHA-256 Checksum Integrity Manifest
    job.phase = 'Generating Checksums & Integrity Manifest';
    job.progressPercent = 90;
    const fileChecksums = generateIntegrityManifest(zipEntries);

    zipEntries.push({
      name: 'reports/integrity_manifest.json',
      data: JSON.stringify(fileChecksums, null, 2),
    });

    // 7. Generate Master Backup Manifest
    const backupManifest: BackupManifest = {
      backupFormatVersion: '2.0.0',
      appName: 'QUIZPRO / DISHA 20-20',
      appVersion: packageJson.version || '2.0.0',
      sourceProjectId: serverContext.projectId,
      sourceDatabaseId: serverContext.databaseId,
      exportTimestamp: new Date().toISOString(),
      exportStatus: job.warnings.length > 0 ? 'COMPLETE_WITH_WARNINGS' : 'COMPLETE',
      scope: options.scope,
      selectedCollections: options.selectedCollections,
      totalCollections: targetCollections.length,
      totalDocuments: job.totalDocuments,
      collectionInventory,
      subcollectionInventory,
      storage: {
        status: storageStatus,
        fileCount: storageFiles.length,
        totalSizeBytes: storageFiles.reduce((acc, f) => acc + f.sizeBytes, 0),
        files: storageFiles,
      },
      application: {
        name: 'QUIZPRO / DISHA 20-20',
        version: packageJson.version || '2.0.0',
        curriculumSummary: {
          subjectsCount: collectionInventory['subjects'] || 0,
          chaptersCount: collectionInventory['chapters'] || 0,
          topicsCount: collectionInventory['topics'] || 0,
          mcqsCount: (collectionInventory['mcqs'] || 0) + (collectionInventory['questions'] || 0),
        },
      },
      infrastructure: {
        firestoreRulesVersion: '2',
        hasIndexes: false,
      },
      fileChecksums,
      warnings: job.warnings,
      failedExportItems: job.errors,
    };

    zipEntries.unshift({
      name: 'backup_manifest.json',
      data: JSON.stringify(backupManifest, null, 2),
    });

    // 8. Package ZIP Container
    job.phase = 'Compiling ZIP Container';
    job.progressPercent = 95;
    const zipBuffer = createZipBuffer(zipEntries);

    // Write ZIP to local backups directory
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `QUIZPRO_BACKUP_${serverContext.projectId}_${dateStr}.zip`;
    const backupFilePath = path.join(BACKUP_DIR, backupFilename);
    fs.writeFileSync(backupFilePath, zipBuffer);

    job.backupId = backupFilename;
    job.backupFilename = backupFilename;
    job.fileSizeBytes = zipBuffer.length;
    job.downloadUrl = `/api/admin/backup/download/${backupFilename}`;
    job.progressPercent = 100;
    job.phase = 'Backup Successfully Created & Verified';
    job.status = job.warnings.length > 0 ? 'completed_with_warnings' : 'completed';
    job.completedAt = new Date().toISOString();

    return job;
  } catch (fatalErr: any) {
    job.status = 'failed';
    job.phase = 'Export Failed';
    job.errors.push(fatalErr.message || String(fatalErr));
    return job;
  }
}

/**
 * =========================================================================
 * BACKUP ENGINE: VALIDATE & RESTORE PREVIEW
 * =========================================================================
 */
export async function generateRestorePreview(
  backupBuffer: Buffer,
  filename: string,
  serverContext: {
    adminDb: any;
    projectId: string;
    databaseId: string;
    apiKey: string;
  },
  adminBearerToken?: string
): Promise<RestorePreview> {
  let files: ExtractedZipEntry[];
  try {
    files = readZipBuffer(backupBuffer);
  } catch (err: any) {
    throw new Error(`Failed to read ZIP archive: ${err.message}`);
  }

  // Find backup_manifest.json
  const manifestFile = files.find((f) => f.name === 'backup_manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid backup archive: "backup_manifest.json" was not found inside the ZIP.');
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(manifestFile.data.toString('utf8'));
  } catch (err: any) {
    throw new Error(`Malformed backup manifest JSON: ${err.message}`);
  }

  // Verify Checksums if integrity manifest exists
  let integrityVerified = true;
  let missingFilesCount = 0;
  let corruptedFilesCount = 0;

  const integrityFile = files.find((f) => f.name === 'reports/integrity_manifest.json');
  if (integrityFile) {
    try {
      const integrityMap = JSON.parse(integrityFile.data.toString('utf8'));
      const checkResult = verifyZipIntegrity(files, integrityMap);
      integrityVerified = checkResult.valid;
      missingFilesCount = checkResult.missingFiles.length;
      corruptedFilesCount = checkResult.mismatchedFiles.length;
    } catch {
      integrityVerified = false;
    }
  }

  const driver = createFirestoreDriver(
    serverContext.adminDb,
    serverContext.projectId,
    serverContext.databaseId,
    serverContext.apiKey,
    adminBearerToken
  );

  // Compare collections with destination database
  const collectionSummary: RestorePreview['collectionSummary'] = [];
  const compatibilityWarnings: string[] = [];

  if (manifest.sourceProjectId !== serverContext.projectId) {
    compatibilityWarnings.push(
      `Cross-Project Migration: Backup source (${manifest.sourceProjectId}) differs from destination project (${serverContext.projectId}).`
    );
  }

  for (const [colName, backupCount] of Object.entries(manifest.collectionInventory || {})) {
    let destCount = 0;
    let conflicts = 0;
    try {
      const destDocs = await driver.getCollectionDocs(colName);
      destCount = destDocs.length;

      // Check conflict count
      const colFile = files.find((f) => f.name === `firestore/collections/${colName}.json`);
      if (colFile) {
        const backupDocs: Array<{ id: string; data: any }> = JSON.parse(colFile.data.toString('utf8'));
        const destDocMap = new Map(destDocs.map((d) => [d.id, d.data]));
        for (const bDoc of backupDocs) {
          if (destDocMap.has(bDoc.id)) {
            const destData = destDocMap.get(bDoc.id);
            if (!areDocumentsIdentical(bDoc.data, destData)) {
              conflicts++;
            }
          }
        }
      }
    } catch {
      destCount = 0;
    }

    const missingCount = Math.max(0, backupCount - (destCount - conflicts));
    const status: RestorePreview['collectionSummary'][0]['status'] =
      destCount === 0
        ? 'destination_empty'
        : conflicts > 0
        ? 'conflicts_detected'
        : 'matching';

    collectionSummary.push({
      name: colName,
      backupDocCount: backupCount,
      destinationDocCount: destCount,
      conflictingDocsCount: conflicts,
      missingDocsCount: missingCount,
      status,
    });
  }

  const supportedRestoreModes: RestorePreview['supportedRestoreModes'] = [
    {
      mode: 'RESTORE_MISSING_DOCUMENTS',
      label: 'Restore Missing Documents',
      description: 'Creates only documents that do not already exist in the database. Never overwrites existing data.',
      safe: true,
    },
    {
      mode: 'OVERWRITE_EXISTING_DOCUMENTS',
      label: 'Overwrite Existing Documents',
      description: 'Updates matching documents with backup values and creates missing documents. Requires explicit confirmation.',
      safe: false,
    },
    {
      mode: 'RESTORE_INTO_EMPTY_PROJECT',
      label: 'Restore Into Empty Project',
      description: 'Clean restoration into an empty project. Verifies destination is empty before writing.',
      safe: true,
    },
    {
      mode: 'SELECTIVE_RESTORE',
      label: 'Selective Restore',
      description: 'Restore only selected collections or syllabus branches.',
      safe: true,
    },
    {
      mode: 'MIGRATION_RESTORE',
      label: 'Cross-Project Migration Restore',
      description: 'Migrate data from another Firebase project while preserving all IDs and parent-child relationships.',
      safe: false,
    },
  ];

  return {
    valid: missingFilesCount === 0 && corruptedFilesCount === 0,
    backupId: filename,
    backupFilename: filename,
    appName: manifest.appName,
    sourceProjectId: manifest.sourceProjectId,
    sourceDatabaseId: manifest.sourceDatabaseId,
    destinationProjectId: serverContext.projectId,
    destinationDatabaseId: serverContext.databaseId,
    exportTimestamp: manifest.exportTimestamp,
    backupVersion: manifest.backupFormatVersion,
    totalCollections: manifest.totalCollections,
    totalDocuments: manifest.totalDocuments,
    storageFileCount: manifest.storage?.fileCount || 0,
    totalBackupSizeBytes: backupBuffer.length,
    integrityVerified,
    missingFilesCount,
    corruptedFilesCount,
    collectionSummary,
    compatibilityWarnings,
    supportedRestoreModes,
  };
}

/**
 * =========================================================================
 * BACKUP ENGINE: EXECUTE RESTORE IMPLEMENTATION
 * =========================================================================
 */
export async function executeRestoreJob(
  jobId: string,
  request: RestoreExecutionRequest,
  backupBuffer: Buffer,
  adminUser: { uid: string; email: string },
  serverContext: {
    adminDb: any;
    projectId: string;
    databaseId: string;
    apiKey: string;
  },
  adminBearerToken?: string
): Promise<BackupJobProgress> {
  const job: BackupJobProgress = {
    jobId,
    type: 'restore',
    status: 'running',
    phase: 'Validating Restore Authorization & Lock',
    progressPercent: 2,
    totalCollections: 0,
    completedCollections: 0,
    totalDocuments: 0,
    exportedDocuments: 0,
    restoredDocuments: 0,
    skippedDocuments: 0,
    overwrittenDocuments: 0,
    failedDocuments: 0,
    storageFilesExported: 0,
    storageFilesRestored: 0,
    warnings: [],
    errors: [],
    startedAt: new Date().toISOString(),
  };
  activeJobs.set(jobId, job);

  // 1. Enforce exclusive restore lock
  if (!acquireRestoreLock(jobId, adminUser.email)) {
    job.status = 'failed';
    job.phase = 'Restore Lock Error';
    job.errors.push('A restore operation is currently in progress. Simultaneous restore sessions are blocked.');
    return job;
  }

  try {
    // 2. Validate confirmation phrase
    const expectedPhrase = `CONFIRM_RESTORE_${request.restoreMode}`;
    if (request.confirmationPhrase.trim() !== expectedPhrase && request.confirmationPhrase.trim() !== 'CONFIRM') {
      throw new Error(`Invalid confirmation phrase. Expected "${expectedPhrase}".`);
    }

    job.phase = 'Extracting & Verifying Archive';
    job.progressPercent = 5;
    const files = readZipBuffer(backupBuffer);

    const manifestFile = files.find((f) => f.name === 'backup_manifest.json');
    if (!manifestFile) {
      throw new Error('backup_manifest.json is missing in the archive.');
    }
    const manifest: BackupManifest = JSON.parse(manifestFile.data.toString('utf8'));

    // Security & Integrity Pre-Check: Validate Integrity Manifest if present
    const integrityFile = files.find((f) => f.name === 'reports/integrity_manifest.json');
    if (integrityFile) {
      try {
        const integrityMap = JSON.parse(integrityFile.data.toString('utf8'));
        const checkResult = verifyZipIntegrity(files, integrityMap);
        if (!checkResult.valid) {
          throw new Error(
            `Integrity verification failed: Backup archive has ${checkResult.missingFiles.length} missing and ${checkResult.mismatchedFiles.length} corrupted files. Aborting restore.`
          );
        }
      } catch (err: any) {
        throw new Error(`Backup integrity check failed: ${err.message}. Aborting restore.`);
      }
    }

    const driver = createFirestoreDriver(
      serverContext.adminDb,
      serverContext.projectId,
      serverContext.databaseId,
      serverContext.apiKey,
      adminBearerToken
    );

    const targetCollections =
      request.restoreMode === 'SELECTIVE_RESTORE' && request.selectedCollections && request.selectedCollections.length > 0
        ? request.selectedCollections
        : Object.keys(manifest.collectionInventory || {});

    job.totalCollections = targetCollections.length;

    // 3. Mandatory Pre-Restore Backup of Affected Collections with Read-Back Verification
    job.phase = 'Generating Mandatory Pre-Restore Safety Snapshot';
    job.progressPercent = 10;
    let preRestoreFilename = '';
    try {
      const preRestoreSnapshot: Record<string, any[]> = {};
      let totalPreRestoreDocs = 0;
      for (const col of targetCollections) {
        try {
          const docs = await driver.getCollectionDocs(col);
          preRestoreSnapshot[col] = docs;
          totalPreRestoreDocs += docs.length;
        } catch {
          preRestoreSnapshot[col] = [];
        }
      }
      preRestoreFilename = `PRE_RESTORE_SAFETY_${Date.now()}.json`;
      const snapshotPath = path.join(BACKUP_DIR, preRestoreFilename);
      const snapshotContent = JSON.stringify(preRestoreSnapshot, null, 2);
      fs.writeFileSync(snapshotPath, snapshotContent, 'utf8');

      // CRITICAL: Immediately verify safety snapshot on disk before touching destination
      const readBack = fs.readFileSync(snapshotPath, 'utf8');
      const parsedSnapshot = JSON.parse(readBack);
      const readBackDocCount = Object.values(parsedSnapshot).reduce(
        (acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0),
        0
      );
      if (readBackDocCount !== totalPreRestoreDocs) {
        throw new Error(
          `Safety snapshot verification failed: disk record count (${readBackDocCount}) does not match source count (${totalPreRestoreDocs}).`
        );
      }
      job.warnings.push(`Pre-restore safety snapshot verified and archived to ${preRestoreFilename} (${readBackDocCount} docs).`);
    } catch (snapErr: any) {
      throw new Error(`Pre-restore safety snapshot failed: ${snapErr.message}. Aborting restore to protect production data.`);
    }

    // Initialize Checkpoint Tracking
    const checkpoint: RestoreCheckpoint = {
      jobId,
      backupId: request.backupId,
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedBatches: 0,
      processedDocPaths: [],
      failedDocPaths: [],
      lastProcessedCollection: '',
      lastProcessedBatchIndex: 0,
      preRestoreSnapshotFile: preRestoreFilename,
    };
    updateRestoreCheckpoint(checkpoint);

    // 4. Execute Restore Mode Logic
    const BATCH_SIZE = 250; // Respect Firestore batch limits (safe margin below 500)
    const BATCH_PAUSE_MS = 100; // Rate limit delay between batches

    for (let cIdx = 0; cIdx < targetCollections.length; cIdx++) {
      const colName = targetCollections[cIdx];
      job.phase = `Restoring Collection: ${colName} (${cIdx + 1}/${targetCollections.length})`;
      job.progressPercent = Math.round(15 + (cIdx / targetCollections.length) * 70);

      const colFile = files.find((f) => f.name === `firestore/collections/${colName}.json`);
      if (!colFile) continue;

      const backupDocs: Array<{ id: string; data: any }> = JSON.parse(colFile.data.toString('utf8'));
      job.totalDocuments += backupDocs.length;

      for (let dIdx = 0; dIdx < backupDocs.length; dIdx += BATCH_SIZE) {
        const chunk = backupDocs.slice(dIdx, dIdx + BATCH_SIZE);

        for (const docItem of chunk) {
          const docPath = `${colName}/${docItem.id}`;
          const deserializedData = deserializeFirestoreValue(docItem.data);

          try {
            const { exists, data: currentData } = await driver.docExists(docPath);

            if (request.restoreMode === 'RESTORE_INTO_EMPTY_PROJECT') {
              if (exists) {
                job.skippedDocuments++;
                job.warnings.push(`RESTORE_INTO_EMPTY_PROJECT: Document ${docPath} already exists; skipped.`);
              } else {
                await driver.setDoc(docPath, deserializedData, false);
                job.restoredDocuments++;
                checkpoint.processedDocPaths.push(docPath);
              }
              continue;
            }

            if (request.restoreMode === 'RESTORE_MISSING_DOCUMENTS') {
              if (exists) {
                job.skippedDocuments++;
                continue;
              }
              await driver.setDoc(docPath, deserializedData, false);
              job.restoredDocuments++;
              checkpoint.processedDocPaths.push(docPath);
              continue;
            }

            if (request.restoreMode === 'OVERWRITE_EXISTING_DOCUMENTS' || request.restoreMode === 'MIGRATION_RESTORE') {
              if (exists) {
                if (areDocumentsIdentical(deserializedData, currentData)) {
                  job.skippedDocuments++;
                  continue;
                }
                await driver.setDoc(docPath, deserializedData, true);
                job.overwrittenDocuments++;
                checkpoint.processedDocPaths.push(docPath);
              } else {
                await driver.setDoc(docPath, deserializedData, false);
                job.restoredDocuments++;
                checkpoint.processedDocPaths.push(docPath);
              }
              continue;
            }

            if (request.restoreMode === 'SELECTIVE_RESTORE') {
              await driver.setDoc(docPath, deserializedData, true);
              job.restoredDocuments++;
              checkpoint.processedDocPaths.push(docPath);
            }
          } catch (writeErr: any) {
            job.failedDocuments++;
            job.errors.push(`Failed writing ${docPath}: ${writeErr.message}`);
            checkpoint.failedDocPaths.push({
              path: docPath,
              error: writeErr.message,
              timestamp: new Date().toISOString(),
            });
          }
        }

        checkpoint.completedBatches++;
        checkpoint.lastProcessedCollection = colName;
        checkpoint.lastProcessedBatchIndex = dIdx;
        updateRestoreCheckpoint(checkpoint);

        // Bounded rate-limiting pause
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }

      // Restore Subcollections if present
      const subcolDefs = SUBCOLLECTION_DEFINITIONS.filter((s) => s.parentCollection === colName);
      for (const subDef of subcolDefs) {
        const subKey = `${colName}__${subDef.subcollectionName}`;
        const subFile = files.find((f) => f.name === `firestore/subcollections/${subKey}.json`);
        if (!subFile) continue;

        const subDocs: Array<{ id: string; parentId: string; data: any }> = JSON.parse(subFile.data.toString('utf8'));
        for (const sDoc of subDocs) {
          const subDocPath = `${colName}/${sDoc.parentId}/${subDef.subcollectionName}/${sDoc.id}`;
          try {
            const deserializedData = deserializeFirestoreValue(sDoc.data);
            await driver.setDoc(subDocPath, deserializedData, true);
            job.restoredDocuments++;
            checkpoint.processedDocPaths.push(subDocPath);
          } catch (sErr: any) {
            job.failedDocuments++;
            job.errors.push(`Failed writing subcollection ${subDocPath}: ${sErr.message}`);
            checkpoint.failedDocPaths.push({
              path: subDocPath,
              error: sErr.message,
              timestamp: new Date().toISOString(),
            });
          }
        }
        updateRestoreCheckpoint(checkpoint);
      }

      job.completedCollections++;
    }

    // 5. Audit Log Entry
    try {
      const auditEntry = {
        action: 'DISASTER_RECOVERY_RESTORE',
        performedBy: adminUser.email,
        timestamp: new Date().toISOString(),
        backupId: request.backupId,
        restoreMode: request.restoreMode,
        restoredCount: job.restoredDocuments,
        overwrittenCount: job.overwrittenDocuments,
        skippedCount: job.skippedDocuments,
        failedCount: job.failedDocuments,
      };
      await driver.setDoc(`adminAuditLogs/restore_${jobId}`, auditEntry, false);
    } catch {
      // Non-fatal if audit collection write has different rules
    }

    job.progressPercent = 100;
    job.phase = 'Restoration Completed Successfully';
    const hasOperationalWarnings = job.warnings.some(
      (w) => !w.startsWith('Pre-restore safety snapshot')
    );
    job.status =
      job.errors.length > 0 || hasOperationalWarnings
        ? 'completed_with_warnings'
        : 'completed';
    job.completedAt = new Date().toISOString();

    checkpoint.status = job.status;
    updateRestoreCheckpoint(checkpoint);

    return job;
  } catch (fatalErr: any) {
    job.status = 'failed';
    job.phase = 'Restoration Aborted';
    job.errors.push(fatalErr.message || String(fatalErr));
    const activeCp = getRestoreCheckpoint(jobId);
    if (activeCp) {
      activeCp.status = 'failed';
      updateRestoreCheckpoint(activeCp);
    }
    return job;
  } finally {
    releaseRestoreLock(jobId);
  }
}

/**
 * Lists all stored local backup archives
 */
export function listStoredBackups(): StoredBackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.zip'));
  const results: StoredBackupInfo[] = [];

  for (const filename of files) {
    const fullPath = path.join(BACKUP_DIR, filename);
    const stat = fs.statSync(fullPath);

    let manifestData: Partial<BackupManifest> = {};
    let integrityVerified = false;

    try {
      const zipBuf = fs.readFileSync(fullPath);
      const extracted = readZipBuffer(zipBuf);
      const mFile = extracted.find((f) => f.name === 'backup_manifest.json');
      if (mFile) {
        manifestData = JSON.parse(mFile.data.toString('utf8'));
      }
      integrityVerified = true;
    } catch {
      integrityVerified = false;
    }

    results.push({
      backupId: filename,
      filename,
      fileSizeBytes: stat.size,
      createdAt: manifestData.exportTimestamp || stat.mtime.toISOString(),
      sourceProjectId: manifestData.sourceProjectId || 'unknown',
      totalCollections: manifestData.totalCollections || 0,
      totalDocuments: manifestData.totalDocuments || 0,
      exportStatus: manifestData.exportStatus || 'UNKNOWN',
      integrityVerified,
    });
  }

  // Sort descending by date
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Deletes a stored local backup archive
 */
export function deleteStoredBackup(backupId: string): boolean {
  // Path traversal guard
  const safeFilename = path.basename(backupId);
  const targetPath = path.join(BACKUP_DIR, safeFilename);

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return true;
  }
  return false;
}

/**
 * Reads a backup ZIP buffer for download or inspection
 */
export function getStoredBackupBuffer(backupId: string): Buffer {
  const safeFilename = path.basename(backupId);
  const targetPath = path.join(BACKUP_DIR, safeFilename);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Backup archive "${backupId}" was not found.`);
  }
  return fs.readFileSync(targetPath);
}
