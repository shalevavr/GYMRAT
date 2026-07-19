const crypto = require('crypto');

const PASSWORD_ALGORITHM = 'pbkdf2-sha256';
const PASSWORD_ITERATIONS = 210000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const MAX_LOGIN_ATTEMPTS = 8;
const loginAttempts = new Map();

function normalizeUsername(username) {
  return `${username || ''}`.trim().toLowerCase();
}

function validateUsername(username) {
  const normalized = `${username || ''}`.trim();
  const isSimpleUsername = /^[a-z0-9._-]{3,32}$/i.test(normalized);
  const isEmailUsername = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/i.test(normalized) && normalized.length <= 254;
  if (!isSimpleUsername && !isEmailUsername) {
    throw new Error('Enter a valid email address or a 3-32 character username.');
  }
  return normalized;
}

function validatePassword(password) {
  const value = `${password || ''}`;
  if (!value || value.length > 128) {
    throw new Error('Password is required.');
  }
  return value;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, 'sha256').toString('hex');
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(`${a || ''}`, 'hex');
  const right = Buffer.from(`${b || ''}`, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;

  const parts = `${storedPassword}`.split('$');
  if (parts.length !== 4 || parts[0] !== PASSWORD_ALGORITHM) {
    return storedPassword === password;
  }

  const [, iterationsRaw, salt, expectedHash] = parts;
  const iterations = Number(iterationsRaw);
  if (!Number.isSafeInteger(iterations) || iterations < 100000 || !salt || !expectedHash) return false;

  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, 'sha256').toString('hex');
  return timingSafeEqualHex(actualHash, expectedHash);
}

function isLegacyPassword(storedPassword) {
  return Boolean(storedPassword && !`${storedPassword}`.startsWith(`${PASSWORD_ALGORITHM}$`));
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(`${token || ''}`).digest('hex');
}

function normalizeDeviceId(deviceId) {
  const clean = `${deviceId || ''}`.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return clean.length >= 8 ? clean : 'default-device';
}

function isValidSessionRecord(sessionRecord, authToken) {
  if (!sessionRecord?.tokenHash) return false;
  const expiresAt = Date.parse(sessionRecord.expiresAt || '');
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return timingSafeEqualHex(sessionRecord.tokenHash, hashSessionToken(authToken));
}

function sessionUpdateForDevice(session, deviceId) {
  const cleanDeviceId = normalizeDeviceId(deviceId);
  return {
    deviceId: cleanDeviceId,
    path: `sessions.${cleanDeviceId}`,
    value: {
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      updatedAt: new Date().toISOString(),
    },
  };
}

function verifySession(user, authToken, deviceId = '') {
  if (!user || !authToken) return false;

  const sessions = user.sessions && typeof user.sessions === 'object' ? user.sessions : null;
  if (sessions) {
    const cleanDeviceId = normalizeDeviceId(deviceId);
    if (deviceId && isValidSessionRecord(sessions[cleanDeviceId], authToken)) return true;
    if (Object.values(sessions).some(sessionRecord => isValidSessionRecord(sessionRecord, authToken))) return true;
  }

  if (user.sessionTokenHash) {
    const expiresAt = Date.parse(user.sessionExpiresAt || '');
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
    return timingSafeEqualHex(user.sessionTokenHash, hashSessionToken(authToken));
  }

  return Boolean(user.sessionToken && user.sessionToken === authToken);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkLoginRateLimit(req, username) {
  const key = `${getClientIp(req)}:${normalizeUsername(username)}`;
  const now = Date.now();
  const current = loginAttempts.get(key);
  const record = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + LOGIN_WINDOW_MS };

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    const error = new Error(`Too many login attempts. Try again in ${retryAfterSeconds} seconds.`);
    error.statusCode = 429;
    throw error;
  }

  record.count += 1;
  loginAttempts.set(key, record);
}

function clearLoginRateLimit(req, username) {
  loginAttempts.delete(`${getClientIp(req)}:${normalizeUsername(username)}`);
}

function sanitizeUser(user) {
  if (!user) return null;
  const {
    password,
    passwordHash,
    sessionToken,
    sessionTokenHash,
    sessionExpiresAt,
    sessions,
    ...safeUser
  } = user;
  return safeUser;
}

function sanitizeUpdatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const clean = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'selections')
      && payload.selections
      && typeof payload.selections === 'object'
      && !Array.isArray(payload.selections)) {
    clean.selections = payload.selections;
  }

  return Object.keys(clean).length ? clean : null;
}

module.exports = {
  clearLoginRateLimit,
  checkLoginRateLimit,
  createSession,
  hashPassword,
  isLegacyPassword,
  sanitizeUpdatePayload,
  normalizeDeviceId,
  sanitizeUser,
  sessionUpdateForDevice,
  validatePassword,
  validateUsername,
  verifyPassword,
  verifySession,
};
