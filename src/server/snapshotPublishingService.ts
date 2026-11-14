/**
 * Server-Side Snapshot Publishing & Storage Service
 * Manages manifests, immutable versioned chunk files, deltas, and atomic publishing.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { VersionManifest, VersionManifestChunk, DeltaBundle } from '../services/snapshot/types';

export interface SnapshotPublishOptions {
  curriculumVersion?: number;
  mcqVersion?: number;
  chunkSize?: number;
  sourceBackupFile?: string;
}

export class SnapshotPublishingService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'education-content');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    const dirs = [
      this.baseDir,
      path.join(this.baseDir, 'manifests'),
      path.join(this.baseDir, 'snapshots'),
      path.join(this.baseDir, 'deltas'),
      path.join(this.baseDir, 'checksums'),
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    }
  }

  /**
   * Helper to compute SHA-256 checksum of raw string or buffer.
   */
  public computeSha256(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get the current active version manifest.
   */
  public getCurrentManifest(): VersionManifest | null {
    const manifestPath = path.join(this.baseDir, 'manifests', 'current.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  /**
   * Generates and publishes an initial or new snapshot version from verified production data.
   */
  public async publishNewSnapshot(options: SnapshotPublishOptions = {}): Promise<VersionManifest> {
    const chunkSize = options.chunkSize || 200;
    const backupPath = options.sourceBackupFile || path.join(process.cwd(), 'backups', 'phase2_verified_production_backup.json');

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Source backup file not found at: ${backupPath}`);
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const mcqs: any[] = backupData.mcqs || [];
    const subjects: any[] = backupData.subjects || [];
    const chapters: any[] = backupData.chapters || [];
    const topics: any[] = backupData.topics || [];

    const existingManifest = this.getCurrentManifest();
    const newVersion = existingManifest ? existingManifest.snapshotVersion + 1 : 1;
    const previousVersion = existingManifest ? existingManifest.snapshotVersion : 0;

    const versionDir = path.join(this.baseDir, 'snapshots', `v${newVersion}`);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    // Split MCQs into chunks
    const chunks: VersionManifestChunk[] = [];
    const totalChunks = Math.ceil(mcqs.length / chunkSize) || 1;

    for (let i = 0; i < totalChunks; i++) {
      const sliceStart = i * chunkSize;
      const sliceEnd = sliceStart + chunkSize;
      const chunkMcqs = mcqs.slice(sliceStart, sliceEnd);

      const chunkData: any = {
        chunkIndex: i,
        snapshotVersion: newVersion,
        mcqs: chunkMcqs
      };

      // Put curriculum hierarchy in the first chunk
      if (i === 0) {
        chunkData.subjects = subjects;
        chunkData.chapters = chapters;
        chunkData.topics = topics;
      }

      const chunkString = JSON.stringify(chunkData);
      const chunkChecksum = this.computeSha256(chunkString);
      const chunkFileName = `chunk-${i}.json`;
      const chunkFilePath = path.join(versionDir, chunkFileName);

      fs.writeFileSync(chunkFilePath, chunkString, 'utf-8');

      chunks.push({
        chunkIndex: i,
        url: `/api/snapshots/v${newVersion}/${chunkFileName}`,
        checksum: chunkChecksum,
        itemCount: chunkMcqs.length
      });
    }

    // Also write full snapshot for reference / single fallback
    const fullSnapshotPayload = {
      schemaVersion: 2,
      snapshotVersion: newVersion,
      publishedAt: new Date().toISOString(),
      subjects,
      chapters,
      topics,
      mcqs
    };
    const fullSnapshotString = JSON.stringify(fullSnapshotPayload);
    const fullChecksum = this.computeSha256(fullSnapshotString);
    fs.writeFileSync(path.join(versionDir, 'content.json'), fullSnapshotString, 'utf-8');

    // Write checksum file
    fs.writeFileSync(
      path.join(this.baseDir, 'checksums', `v${newVersion}.json`),
      JSON.stringify({ snapshotVersion: newVersion, checksum: fullChecksum, chunks }, null, 2),
      'utf-8'
    );

    // Build VersionManifest
    const manifest: VersionManifest = {
      schemaVersion: 2,
      snapshotVersion: newVersion,
      previousSnapshotVersion: previousVersion,
      curriculumVersion: options.curriculumVersion || newVersion,
      mcqVersion: options.mcqVersion || newVersion,
      publishedAt: new Date().toISOString(),
      snapshotUrl: `/api/snapshots/v${newVersion}/content.json`,
      checksum: fullChecksum,
      status: 'published',
      totalMcqs: mcqs.length,
      totalSubjects: subjects.length,
      totalChapters: chapters.length,
      totalTopics: topics.length,
      chunks,
      deltaAvailableFrom: previousVersion > 0 ? previousVersion : undefined
    };

    // Atomic manifest write (write to temp file then rename)
    const manifestPath = path.join(this.baseDir, 'manifests', 'current.json');
    const tempManifestPath = path.join(this.baseDir, 'manifests', `current.tmp.${Date.now()}.json`);
    fs.writeFileSync(tempManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    fs.renameSync(tempManifestPath, manifestPath);

    console.log(`[SnapshotPublishingService] Successfully published Snapshot v${newVersion} (${mcqs.length} MCQs, ${chunks.length} chunks)`);
    return manifest;
  }

  /**
   * Generates and publishes an incremental delta bundle between two versions.
   */
  public async publishDelta(
    fromVersion: number,
    toVersion: number,
    delta: Omit<DeltaBundle, 'fromVersion' | 'toVersion' | 'publishedAt' | 'checksum'>
  ): Promise<DeltaBundle> {
    const deltaPayload: any = {
      fromVersion,
      toVersion,
      publishedAt: new Date().toISOString(),
      ...delta
    };

    const payloadString = JSON.stringify({
      fromVersion: deltaPayload.fromVersion,
      toVersion: deltaPayload.toVersion,
      upsertSubjects: deltaPayload.upsertSubjects || [],
      upsertChapters: deltaPayload.upsertChapters || [],
      upsertTopics: deltaPayload.upsertTopics || [],
      upsertMcqs: deltaPayload.upsertMcqs || [],
      deletedMcqIds: deltaPayload.deletedMcqIds || [],
      movedQuestions: deltaPayload.movedQuestions || []
    });

    const checksum = this.computeSha256(payloadString);
    deltaPayload.checksum = checksum;

    const deltaFileName = `v${fromVersion}-to-v${toVersion}.json`;
    const deltaFilePath = path.join(this.baseDir, 'deltas', deltaFileName);
    fs.writeFileSync(deltaFilePath, JSON.stringify(deltaPayload, null, 2), 'utf-8');

    console.log(`[SnapshotPublishingService] Published delta bundle: ${deltaFileName} (checksum: ${checksum.substring(0, 8)}...)`);
    return deltaPayload;
  }

  /**
   * Retrieve file buffer/stream for snapshot delivery.
   */
  public getSnapshotFile(version: string, filename: string): { filePath: string; exists: boolean } {
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
    const filePath = path.join(this.baseDir, 'snapshots', sanitizedVersion, sanitizedFilename);
    return {
      filePath,
      exists: fs.existsSync(filePath)
    };
  }

  /**
   * Retrieve delta bundle file.
   */
  public getDeltaFile(filename: string): { filePath: string; exists: boolean } {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
    const filePath = path.join(this.baseDir, 'deltas', sanitizedFilename);
    return {
      filePath,
      exists: fs.existsSync(filePath)
    };
  }
}

export const defaultSnapshotPublishingService = new SnapshotPublishingService();
