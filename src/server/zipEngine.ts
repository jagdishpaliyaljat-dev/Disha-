import zlib from 'zlib';
import crypto from 'crypto';

export interface ZipEntry {
  name: string;
  data: Buffer | string;
  comment?: string;
  modifiedTime?: Date;
}

export interface ExtractedZipEntry {
  name: string;
  data: Buffer;
  uncompressedSize: number;
}

export interface ZipIntegrityResult {
  valid: boolean;
  totalFiles: number;
  verifiedFiles: number;
  mismatchedFiles: string[];
  missingFiles: string[];
}

// Precomputed CRC32 Lookup Table (IEEE 802.3)
const CRC32_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c;
}

export function computeCrc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

export function computeSha256(data: Buffer | string): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Format a JavaScript Date into MS-DOS Time and Date 16-bit integers
 */
function toDosDateTime(d: Date = new Date()): { dosTime: number; dosDate: number } {
  const dosTime = ((d.getHours() & 0x1F) << 11) |
                  ((d.getMinutes() & 0x3F) << 5) |
                  ((Math.floor(d.getSeconds() / 2)) & 0x1F);

  const year = Math.max(1980, d.getFullYear());
  const dosDate = (((year - 1980) & 0x7F) << 9) |
                  (((d.getMonth() + 1) & 0x0F) << 5) |
                  ((d.getDate() & 0x1F));

  return { dosTime, dosDate };
}

/**
 * Pure TypeScript PKZIP Archive Builder
 * Produces 100% standard ZIP archives compatible with Linux unzip, Windows Explorer, macOS Archive Utility.
 */
export function createZipBuffer(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    // Standardize path separators to forward slash, strip leading slashes
    const normalizedName = entry.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(normalizedName, 'utf8');
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const uncompressedSize = dataBuf.length;
    const crc = computeCrc32(dataBuf);

    // Deflate compression
    let compressedBuf: Buffer;
    let compressionMethod = 8; // Deflate
    try {
      compressedBuf = zlib.deflateRawSync(dataBuf);
      if (compressedBuf.length >= uncompressedSize) {
        // Fall back to Store if deflate didn't save space
        compressedBuf = dataBuf;
        compressionMethod = 0;
      }
    } catch {
      compressedBuf = dataBuf;
      compressionMethod = 0;
    }
    const compressedSize = compressedBuf.length;

    const { dosTime, dosDate } = toDosDateTime(entry.modifiedTime);

    // 1. Local File Header (30 bytes + nameBuf + compressedBuf)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034B50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (Bit 11: UTF-8)
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressedBuf);

    // 2. Central Directory File Header (46 bytes + nameBuf)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014B50, 0); // Central header signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by (2.0)
    centralHeader.writeUInt16LE(20, 6);         // Version needed to extract (2.0)
    centralHeader.writeUInt16LE(0x0800, 8);     // General purpose bit flag (UTF-8)
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // Extra field length
    centralHeader.writeUInt16LE(0, 32);         // File comment length
    centralHeader.writeUInt16LE(0, 34);         // Disk number start
    centralHeader.writeUInt16LE(0, 36);         // Internal file attributes
    centralHeader.writeUInt32LE(0x81A40000, 38); // External file attributes (regular file rw-r--r--)
    centralHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    currentOffset += localHeader.length + compressedBuf.length;
  }

  const centralDirOffset = currentOffset;
  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // 3. End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // Number of this disk
  eocd.writeUInt16LE(0, 6);          // Disk with start of central directory
  eocd.writeUInt16LE(entries.length, 8); // Total entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // Total entries in central directory
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);         // ZIP comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Pure TypeScript PKZIP Archive Reader & Unpacker
 */
export function readZipBuffer(buf: Buffer): ExtractedZipEntry[] {
  if (!buf || buf.length < 22) {
    throw new Error('Invalid archive buffer: file is too small to be a valid ZIP archive.');
  }

  // Scan backwards for End of Central Directory Record signature (0x06054B50)
  let eocdOffset = -1;
  const maxScan = Math.min(buf.length, 65557); // 65535 max comment length + 22 bytes EOCD
  for (let i = buf.length - 22; i >= buf.length - maxScan; i--) {
    if (buf.readUInt32LE(i) === 0x06054B50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Corrupted or invalid ZIP archive: End of Central Directory record not found.');
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  if (cdOffset > buf.length) {
    throw new Error('Corrupted ZIP archive: Central Directory offset out of range.');
  }

  const extractedFiles: ExtractedZipEntry[] = [];
  const seenNames = new Set<string>();
  let curr = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (curr + 46 > buf.length) {
      throw new Error(`Corrupted ZIP archive: Truncated Central Directory header at entry ${i}.`);
    }

    const cdSig = buf.readUInt32LE(curr);
    if (cdSig !== 0x02014B50) {
      throw new Error(`Corrupted ZIP archive: Expected Central Directory signature 0x02014B50 at ${curr}, got 0x${cdSig.toString(16)}.`);
    }

    const compression = buf.readUInt16LE(curr + 10);
    const expectedCrc = buf.readUInt32LE(curr + 16);
    const compressedSize = buf.readUInt32LE(curr + 20);
    const uncompressedSize = buf.readUInt32LE(curr + 24);
    const nameLen = buf.readUInt16LE(curr + 28);
    const extraLen = buf.readUInt16LE(curr + 30);
    const commentLen = buf.readUInt16LE(curr + 32);
    const localHeaderOffset = buf.readUInt32LE(curr + 42);

    const name = buf.toString('utf8', curr + 46, curr + 46 + nameLen);
    curr += 46 + nameLen + extraLen + commentLen;

    // Security Check: Path Traversal Guard (prevent zip-slip ../ attacks)
    if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) {
      throw new Error(`Security Violation: Illegal path traversal detected in ZIP entry: "${name}"`);
    }

    // Skip directory-only entries
    if (name.endsWith('/')) {
      continue;
    }

    // Security Check: Duplicate archive entry detection
    if (seenNames.has(name)) {
      throw new Error(`Security Violation: Duplicate archive entry path detected in ZIP: "${name}"`);
    }
    seenNames.add(name);

    if (localHeaderOffset + 30 > buf.length) {
      throw new Error(`Corrupted ZIP archive: Truncated Local Header for file "${name}".`);
    }

    const localSig = buf.readUInt32LE(localHeaderOffset);
    if (localSig !== 0x04034B50) {
      throw new Error(`Corrupted ZIP archive: Invalid Local File Header for file "${name}".`);
    }

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const rawData = buf.subarray(dataStart, dataStart + compressedSize);

    let uncompressedData: Buffer;
    if (compression === 0) {
      uncompressedData = rawData;
    } else if (compression === 8) {
      try {
        uncompressedData = zlib.inflateRawSync(rawData);
      } catch (err: any) {
        throw new Error(`Corrupted ZIP archive: Failed to decompress "${name}" via Deflate: ${err.message}`);
      }
    } else {
      throw new Error(`Unsupported ZIP compression method ${compression} for file "${name}".`);
    }

    // Verify CRC32
    const actualCrc = computeCrc32(uncompressedData);
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC32 Checksum Mismatch for file "${name}": expected ${expectedCrc}, computed ${actualCrc}.`);
    }

    extractedFiles.push({
      name,
      data: uncompressedData,
      uncompressedSize: uncompressedData.length,
    });
  }

  return extractedFiles;
}

/**
 * Generates an SHA-256 integrity map for all files in a backup
 */
export function generateIntegrityManifest(entries: ZipEntry[]): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const entry of entries) {
    manifest[entry.name] = computeSha256(entry.data);
  }
  return manifest;
}

/**
 * Validates extracted files against an SHA-256 integrity manifest
 */
export function verifyZipIntegrity(
  files: ExtractedZipEntry[],
  integrityManifest: Record<string, string>
): ZipIntegrityResult {
  const mismatchedFiles: string[] = [];
  const missingFiles: string[] = [];
  let verifiedFiles = 0;

  const fileMap = new Map<string, Buffer>();
  for (const f of files) {
    fileMap.set(f.name, f.data);
  }

  for (const [filePath, expectedSha] of Object.entries(integrityManifest)) {
    const fileBuf = fileMap.get(filePath);
    if (!fileBuf) {
      missingFiles.push(filePath);
      continue;
    }

    const actualSha = computeSha256(fileBuf);
    if (actualSha !== expectedSha) {
      mismatchedFiles.push(filePath);
    } else {
      verifiedFiles++;
    }
  }

  const valid = missingFiles.length === 0 && mismatchedFiles.length === 0;

  return {
    valid,
    totalFiles: Object.keys(integrityManifest).length,
    verifiedFiles,
    mismatchedFiles,
    missingFiles,
  };
}
