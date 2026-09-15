import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { TikTokAdsError } from './errors';

function encryptionKeys() {
  const current = (process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY || '').trim();
  const previous = (process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY_PREVIOUS || '').trim();
  if (!current) {
    throw new TikTokAdsError(
      'CAPABILITY_UNAVAILABLE',
      'Configurează TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY înainte de conectarea TikTok Ads.'
    );
  }
  if (Buffer.byteLength(current, 'utf8') < 32) {
    throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY trebuie să aibă cel puțin 32 de octeți.');
  }
  if (previous && Buffer.byteLength(previous, 'utf8') < 32) {
    throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY_PREVIOUS trebuie să aibă cel puțin 32 de octeți.');
  }
  return Array.from(new Set([current, previous].filter(Boolean))).map((source) => createHash('sha256').update(source).digest());
}

function purposeKeys(purpose: string) {
  return encryptionKeys().map((master) => {
    const key = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), Buffer.from(`imodeus:tiktok-ads:${purpose}`), 32));
    return { key, id: createHash('sha256').update(key).digest('hex').slice(0, 12) };
  });
}

export function encryptTikTokSecret(value: string, purpose = 'oauth-token') {
  if (!/^[a-z0-9-]{1,32}$/.test(purpose)) throw new TikTokAdsError('INVALID_REQUEST', 'Contextul de criptare TikTok nu este valid.');
  const current = purposeKeys(purpose)[0];
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', current.key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v3:${purpose}:${current.id}:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptTikTokSecret(payload: string, expectedPurpose = 'oauth-token') {
  const parts = payload.split(':');
  const version = parts[0];
  const purpose = version === 'v3' ? parts[1] : null;
  const keyId = version === 'v3' ? parts[2] : version === 'v2' ? parts[1] : null;
  const [iv, tag, encrypted] = version === 'v3' ? parts.slice(3) : version === 'v2' ? parts.slice(2) : parts.slice(1);
  if (!['v1', 'v2', 'v3'].includes(version) || version !== 'v1' && !keyId || version === 'v3' && purpose !== expectedPurpose || !iv || !tag || !encrypted) {
    throw new TikTokAdsError('CONNECTION_EXPIRED', 'Credentialele TikTok Ads stocate au un format invalid.');
  }
  const candidates = version === 'v3'
    ? purposeKeys(expectedPurpose).filter((candidate) => candidate.id === keyId)
    : encryptionKeys().map((key) => ({ key, id: createHash('sha256').update(key).digest('hex').slice(0, 12) })).filter((candidate) => version === 'v1' || candidate.id === keyId);
  for (const candidate of candidates) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', candidate.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      // Try the previous dedicated key during a controlled rotation.
    }
  }
  throw new TikTokAdsError('CONNECTION_EXPIRED', 'Credentialele TikTok Ads nu mai pot fi decriptate.');
}

export function randomOpaque(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Base64Url(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function createPkcePair() {
  const verifier = randomOpaque(64);
  return { verifier, challenge: sha256Base64Url(verifier) };
}
