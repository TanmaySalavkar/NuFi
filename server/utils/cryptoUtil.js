'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for GCM

// Derive a deterministic 32-byte key from HEALTH_DATA_ENCRYPTION_KEY or fallback
function getEncryptionKey() {
  const secret = process.env.HEALTH_DATA_ENCRYPTION_KEY || 'default-nufi-health-data-encryption-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an arbitrary JS object or string using AES-256-GCM.
 * Returns { ciphertext: string (hex), iv: string (hex), authTag: string (hex) }
 */
function encryptData(data) {
  if (data === undefined || data === null) {
    return { ciphertext: '', iv: '', authTag: '' };
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const textToEncrypt = typeof data === 'string' ? data : JSON.stringify(data);
  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts AES-256-GCM ciphertext using the provided iv and authTag.
 * Returns parsed object or string.
 */
function decryptData(ciphertext, ivHex, authTagHex) {
  if (!ciphertext || !ivHex || !authTagHex) {
    return null;
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch (e) {
    return decrypted;
  }
}

/**
 * Sanitizes an object before logging so sensitive biometric readings and tokens
 * are never written to server logs.
 */
function sanitizeForLog(data) {
  if (!data || typeof data !== 'object') return data;

  const safe = { ...data };
  const sensitiveKeys = ['latest', 'daily_summaries', 'password', 'token', 'authorization', 'ciphertext', 'authTag'];

  for (const key of Object.keys(safe)) {
    if (sensitiveKeys.includes(key)) {
      safe[key] = '[REDACTED_FOR_PRIVACY]';
    } else if (typeof safe[key] === 'object' && safe[key] !== null) {
      safe[key] = sanitizeForLog(safe[key]);
    }
  }

  return safe;
}

module.exports = {
  encryptData,
  decryptData,
  sanitizeForLog,
};
