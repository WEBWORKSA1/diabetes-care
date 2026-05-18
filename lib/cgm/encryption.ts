/**
 * Token encryption for CGM access/refresh tokens.
 *
 * Uses AES-256-GCM with a server-only key. Encrypted at rest in Postgres.
 *
 * Key source: CGM_TOKEN_ENCRYPTION_KEY env var (32 bytes base64-encoded).
 * Generate with: `openssl rand -base64 32` and store in Vercel env vars.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyB64 = process.env.CGM_TOKEN_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error('CGM_TOKEN_ENCRYPTION_KEY not configured');
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('CGM_TOKEN_ENCRYPTION_KEY must be 32 bytes base64-encoded');
  }
  return key;
}

/**
 * Encrypt a token. Output format: base64(iv | authTag | ciphertext)
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error('Cannot encrypt empty token');
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a token previously encrypted with encryptToken().
 */
export function decryptToken(ciphertextB64: string): string {
  if (!ciphertextB64) throw new Error('Cannot decrypt empty token');
  const key = getKey();
  const buf = Buffer.from(ciphertextB64, 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted token too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
