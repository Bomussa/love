import crypto from 'node:crypto';

const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 8;

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function parseJsonBase64Url(value) {
  return JSON.parse(decodeBase64Url(value));
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

export function hasValidAdminSecret(secret) {
  return typeof secret === 'string' && secret.trim().length >= MIN_SECRET_LENGTH;
}

export function validatePassword(password) {
  if (typeof password !== 'string') return { valid: false, reason: 'Password must be a string' };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  return { valid: true };
}

export function hashPassword(password) {
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function createAdminToken(admin, secret, nowMs = Date.now()) {
  if (!hasValidAdminSecret(secret)) {
    throw new Error('ADMIN_AUTH_SECRET is not configured securely');
  }

  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({
    sub: admin.id,
    username: admin.username,
    role: admin.role || 'admin',
    exp: Math.floor(nowMs / 1000) + (24 * 60 * 60),
  }));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyAdminBearerToken(authorizationHeader, secret, nowMs = Date.now()) {
  if (!hasValidAdminSecret(secret) || typeof authorizationHeader !== 'string') {
    return false;
  }

  const [scheme, rawToken] = authorizationHeader.trim().split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !rawToken) {
    return false;
  }

  const token = rawToken.trim();
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (expectedSignature.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return false;
  }

  try {
    const decodedHeader = parseJsonBase64Url(header);
    if (decodedHeader?.alg !== 'HS256' || decodedHeader?.typ !== 'JWT') {
      return false;
    }

    const decodedPayload = parseJsonBase64Url(payload);
    if (!decodedPayload?.sub || !decodedPayload?.exp) {
      return false;
    }

    const expMillis = decodedPayload.exp < 1_000_000_000_000
      ? decodedPayload.exp * 1000
      : decodedPayload.exp;

    return nowMs <= expMillis;
  } catch {
    return false;
  }
}

export function verifyPasswordHash(password, passwordHash) {
  if (typeof password !== 'string' || !passwordHash || typeof passwordHash !== 'string' || !passwordHash.includes(':')) {
    return false;
  }

  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash || storedHash.length !== 128 || !/^[a-f0-9]+$/i.test(storedHash)) {
    return false;
  }

  const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  if (derivedHash.length !== storedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(storedHash, 'hex'),
    Buffer.from(derivedHash, 'hex')
  );
}

export function resolveAdminLoginStatus({ username, password, admin }) {
  if (!username || !password) {
    return 400;
  }

  const isValid = verifyPasswordHash(password, admin?.password_hash);
  return isValid ? 200 : 401;
}
