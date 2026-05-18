/**
 * Sign PIN management
 *
 * PINs are 4-6 digit codes providers enter to sign encounters.
 * Stored as scrypt-derived hash (server-only, never client).
 */

import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export async function hashSignPin(pin: string): Promise<string> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('Sign PIN must be 4-6 digits');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(pin, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifySignPin(pin: string, storedHash: string): Promise<boolean> {
  if (!pin || !storedHash) return false;
  if (!/^\d{4,6}$/.test(pin)) return false;

  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;

  try {
    const derived = (await scrypt(pin, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    })) as Buffer;
    const stored = Buffer.from(hashHex, 'hex');
    if (derived.length !== stored.length) return false;
    return timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}
