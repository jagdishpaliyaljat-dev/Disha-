/**
 * Snapshot Version Manifest Manager
 * Handles fetching, verifying, and comparing snapshot manifests.
 */

import { VersionManifest, SnapshotMetadataRecord } from "./types";
import { getActiveSnapshotMetadata } from "./indexedDbV5";

export interface VersionComparisonResult {
  isUpToDate: boolean;
  localVersion: number;
  cloudVersion: number;
  canUseDelta: boolean;
  cloudManifest: VersionManifest;
  requiresFullSnapshot: boolean;
}

export class ManifestManager {
  private manifestEndpoint: string;
  private cachedManifest: VersionManifest | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 min memory cache to prevent spam

  constructor(endpoint: string = "/api/manifests/current.json") {
    this.manifestEndpoint = endpoint;
  }

  /**
   * Fetches and strictly validates the version manifest.
   */
  public async fetchLatestManifest(force: boolean = false): Promise<VersionManifest> {
    const now = Date.now();
    if (!force && this.cachedManifest && (now - this.lastFetchTime < this.CACHE_TTL_MS)) {
      return this.cachedManifest;
    }

    try {
      const response = await fetch(this.manifestEndpoint, {
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: HTTP ${response.status} ${response.statusText}`);
      }

      const manifest: VersionManifest = await response.json();
      this.validateManifestStructure(manifest);

      this.cachedManifest = manifest;
      this.lastFetchTime = now;
      return manifest;
    } catch (err: any) {
      console.warn(`[ManifestManager] Could not fetch manifest: ${err.message}`);
      throw err;
    }
  }

  /**
   * Strictly validates manifest structure and checksum format.
   */
  public validateManifestStructure(manifest: any): asserts manifest is VersionManifest {
    if (!manifest || typeof manifest !== "object") {
      throw new Error("Invalid manifest: Manifest is not an object");
    }
    if (typeof manifest.schemaVersion !== "number") {
      throw new Error("Invalid manifest: missing or non-numeric schemaVersion");
    }
    if (typeof manifest.snapshotVersion !== "number") {
      throw new Error("Invalid manifest: missing or non-numeric snapshotVersion");
    }
    if (typeof manifest.checksum !== "string" || manifest.checksum.length !== 64) {
      throw new Error("Invalid manifest: checksum must be a valid 64-character SHA-256 hash");
    }
    if (manifest.status !== "published") {
      throw new Error(`Invalid manifest: status is not 'published' (got ${manifest.status})`);
    }
    if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) {
      throw new Error("Invalid manifest: chunks must be a non-empty array");
    }

    // Validate chunk descriptors
    for (const chunk of manifest.chunks) {
      if (typeof chunk.chunkIndex !== "number" || typeof chunk.url !== "string" || !chunk.checksum) {
        throw new Error(`Invalid chunk descriptor in manifest: ${JSON.stringify(chunk)}`);
      }
    }
  }

  /**
   * Compares the locally installed snapshot version against the cloud manifest.
   */
  public async compareVersions(
    cloudManifest?: VersionManifest
  ): Promise<VersionComparisonResult> {
    const manifest = cloudManifest || await this.fetchLatestManifest();
    const localMeta: SnapshotMetadataRecord | null = await getActiveSnapshotMetadata();

    const localVersion = localMeta ? localMeta.snapshotVersion : 0;
    const isInitialLoaded = localMeta ? localMeta.isInitialSnapshotLoaded : false;
    const cloudVersion = manifest.snapshotVersion;

    if (!isInitialLoaded || localVersion === 0) {
      return {
        isUpToDate: false,
        localVersion: 0,
        cloudVersion,
        canUseDelta: false,
        cloudManifest: manifest,
        requiresFullSnapshot: true
      };
    }

    if (localVersion === cloudVersion) {
      return {
        isUpToDate: true,
        localVersion,
        cloudVersion,
        canUseDelta: false,
        cloudManifest: manifest,
        requiresFullSnapshot: false
      };
    }

    // Check if delta is available from localVersion to cloudVersion
    const deltaAvailableFrom = manifest.deltaAvailableFrom ?? manifest.previousSnapshotVersion;
    const canUseDelta = localVersion >= deltaAvailableFrom && localVersion < cloudVersion;

    return {
      isUpToDate: false,
      localVersion,
      cloudVersion,
      canUseDelta,
      cloudManifest: manifest,
      requiresFullSnapshot: !canUseDelta
    };
  }
}

export const defaultManifestManager = new ManifestManager();
