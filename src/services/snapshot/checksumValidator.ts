/**
 * Checksum & Integrity Validation Engine
 * Supports browser SubtleCrypto and Node.js crypto seamlessly.
 */

export async function computeSha256(data: string | Uint8Array): Promise<string> {
  const binaryData = typeof data === "string" ? new TextEncoder().encode(data) : data;

  // Browser SubtleCrypto
  if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
    const hashBuffer = await crypto.subtle.digest("SHA-256", binaryData as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // Node.js crypto fallback
  try {
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHash("sha256").update(binaryData).digest("hex");
  } catch {
    throw new Error("No cryptographic hash implementation available in this environment.");
  }
}

export async function verifyChecksum(content: string | Uint8Array, expectedSha256: string): Promise<boolean> {
  const actualSha256 = await computeSha256(content);
  return actualSha256.toLowerCase() === expectedSha256.toLowerCase();
}
