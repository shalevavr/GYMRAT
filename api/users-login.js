const { findMany, findOne, updateOne } = require('./_lib/mongodb');
const {
  checkLoginRateLimit,
  clearLoginRateLimit,
  createSession,
  hashPassword,
  isLegacyPassword,
  sessionUpdateForDevice,
  validateUsername,
  verifyPassword,
} = require('./_lib/security');
const { verifyGoogleAuthFromBody } = require('./_lib/google-auth');

function publicAccount(user) {
  return {
    username: user.username,
    accountKey: user.accountKey || (user.profile?.google?.sub ? `google:${user.profile.google.sub}:${`${user.username || ''}`.toLowerCase()}` : user.username),
    displayName: user.profile?.displayName || user.username,
    googleEmail: user.googleEmail || user.profile?.google?.email || '',
    picture: user.profile?.google?.picture || '',
  };
}

async function ensureAccountKey(user) {
  if (user.accountKey) return user;
  if (!user.profile?.google?.sub) return user;
  const accountKey = `google:${user.profile.google.sub}:${`${user.username || ''}`.toLowerCase()}`;
  await updateOne(
    { username: user.username },
    { $set: { accountKey, googleEmail: user.profile.google.email || '' } },
    { upsert: false }
  );
  return { ...user, accountKey, googleEmail: user.profile.google.email || '' };
}

async function createLoginSession(user, query, req, rateLimitUsername) {
  const session = createSession();
  const deviceSession = sessionUpdateForDevice(session, req.body?.deviceId);
  await updateOne(
    query,
    {
      $set: {
        sessionTokenHash: session.tokenHash,
        sessionExpiresAt: session.expiresAt,
        sessionToken: null,
        [deviceSession.path]: deviceSession.value,
      }
    },
    { upsert: false }
  );
  if (rateLimitUsername) clearLoginRateLimit(req, rateLimitUsername);
  return {
    ok: true,
    token: session.token,
    deviceId: deviceSession.deviceId,
    username: user.username,
    accountKey: user.accountKey || user.username,
    googleEmail: user.googleEmail || user.profile?.google?.email || '',
    needsLegacyMigration: !user.legacyMigration?.completed,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, googleCredential, googleAccessToken, selectedAccountKey } = req.body || {};

  if (googleCredential || googleAccessToken) {
    try {
      const googleProfile = await verifyGoogleAuthFromBody(req.body);
      const usersRaw = await findMany({ 'profile.google.sub': googleProfile.sub });
      const users = [];
      for (const user of usersRaw) users.push(await ensureAccountKey(user));

      if (selectedAccountKey) {
        const selected = users.find(user => user.accountKey === selectedAccountKey);
        if (!selected) return res.status(403).json({ error: 'That account does not belong to this Google account.' });
        return res.status(200).json(await createLoginSession(selected, { accountKey: selected.accountKey }, req));
      }

      if (users.length === 1) {
        return res.status(200).json(await createLoginSession(users[0], { accountKey: users[0].accountKey }, req));
      }

      return res.status(200).json({
        ok: true,
        requiresAccountSelection: true,
        googleEmail: googleProfile.email,
        accounts: users.map(publicAccount),
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Google login failed.' });
    }
  }

  let normalizedUsername;
  let validatedPassword;
  try {
    normalizedUsername = validateUsername(username);
    validatedPassword = `${password || ''}`;
    if (!validatedPassword || validatedPassword.length > 128) throw new Error('Username and password are required.');
    checkLoginRateLimit(req, normalizedUsername);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  try {
    const user = await findOne({ username: normalizedUsername });
    const storedPassword = user?.passwordHash || user?.password;
    if (!user || !verifyPassword(validatedPassword, storedPassword)) return res.status(401).json({ error: 'Wrong username or password.' });

    const session = createSession();
    const deviceSession = sessionUpdateForDevice(session, req.body?.deviceId);
    const setUpdate = { sessionTokenHash: session.tokenHash, sessionExpiresAt: session.expiresAt, sessionToken: null, [deviceSession.path]: deviceSession.value };
    const unsetUpdate = {};
    if (!user.passwordHash || isLegacyPassword(user.password)) {
      setUpdate.passwordHash = hashPassword(validatedPassword);
      unsetUpdate.password = '';
    }

    await updateOne(
      { username: normalizedUsername },
      Object.keys(unsetUpdate).length ? { $set: setUpdate, $unset: unsetUpdate } : { $set: setUpdate },
      { upsert: false }
    );
    clearLoginRateLimit(req, normalizedUsername);
    return res.status(200).json({ ok: true, token: session.token, deviceId: deviceSession.deviceId, username: normalizedUsername, accountKey: user.accountKey || normalizedUsername });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to log in.' });
  }
};
