import crypto from 'crypto';

const PREFIX = 'v1:';

// Derive 32-byte encryption key from AI_CONFIG_ENCRYPTION_KEY if set,
// otherwise generate an ephemeral cryptographically secure key per boot.
// Never uses hardcoded secrets or Base64 obfuscation.
const envEncryptionKey = (process.env.AI_CONFIG_ENCRYPTION_KEY || '').trim();
export const encryptionKeyMode: 'env' | 'ephemeral' = envEncryptionKey.length >= 16 ? 'env' : 'ephemeral';

const AES_KEY: Buffer =
  encryptionKeyMode === 'env'
    ? crypto.createHash('sha256').update(envEncryptionKey, 'utf8').digest()
    : crypto.randomBytes(32);

export function encryptSecret(plaintext: string): string {
  const clean = (plaintext || '').trim();
  if (!clean) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith(PREFIX)) {
    return '';
  }

  try {
    const parts = ciphertext.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return '';

    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');

    if (iv.length !== 12 || tag.length !== 16) return '';

    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function redactSensitiveText(input: unknown): string {
  const msg = input instanceof Error ? input.message : String(input || '');
  return msg
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/sk-(?:proj-|ant-)?[0-9A-Za-z\-_]{16,}/g, '[REDACTED_API_KEY]')
    .replace(/gsk_[0-9A-Za-z\-_]{16,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
}
