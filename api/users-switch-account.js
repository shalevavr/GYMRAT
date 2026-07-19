const { findOne, updateOne } = require('./_lib/mongodb');
const { createSession, sessionUpdateForDevice, verifySession } = require('./_lib/security');

function getGoogleAccountKey(user) {
  return user.accountKey || (user.profile?.google?.sub ? `google:${user.profile.google.sub}:${`${user.username || ''}`.toLowerCase()}` : user.username);
}

async function ensureAccountKey(user) {
  const accountKey = getGoogleAccountKey(user);
  if (user.accountKey === accountKey) return user;
  await updateOne(
    { username: user.username },
    { $set: { accountKey, googleEmail: user.googleEmail || user.profile?.google?.email || '' } },
    { upsert: false }
  );
  return { ...user, accountKey, googleEmail: user.googleEmail || user.profile?.google?.email || '' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { accountKey, authToken, selectedAccountKey } = req.body || {};
  const cleanAccountKey = `${accountKey || ''}`.trim();
  const cleanSelectedAccountKey = `${selectedAccountKey || ''}`.trim();
  if (!cleanAccountKey || !cleanSelectedAccountKey || !authToken) {
    return res.status(400).json({ error: 'Current account, selected account, and auth token are required.' });
  }

  try {
    const currentUserRaw = await findOne({ accountKey: cleanAccountKey }) || await findOne({ username: cleanAccountKey });
    if (!currentUserRaw) return res.status(404).json({ error: 'Current account not found.' });
    const currentUser = await ensureAccountKey(currentUserRaw);
    if (!verifySession(currentUser, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });

    const selectedUserRaw = await findOne({ accountKey: cleanSelectedAccountKey }) || await findOne({ username: cleanSelectedAccountKey });
    if (!selectedUserRaw) return res.status(404).json({ error: 'Selected account not found.' });
    const selectedUser = await ensureAccountKey(selectedUserRaw);
    if (!currentUser.profile?.google?.sub || selectedUser.profile?.google?.sub !== currentUser.profile.google.sub) {
      return res.status(403).json({ error: 'That account does not belong to your Google account.' });
    }

    const session = createSession();
    const deviceSession = sessionUpdateForDevice(session, req.body?.deviceId);
    await updateOne(
      { accountKey: cleanSelectedAccountKey },
      { $set: { sessionTokenHash: session.tokenHash, sessionExpiresAt: session.expiresAt, sessionToken: null, [deviceSession.path]: deviceSession.value } },
      { upsert: false }
    );

    return res.status(200).json({
      ok: true,
      token: session.token,
      deviceId: deviceSession.deviceId,
      username: selectedUser.username,
      accountKey: getGoogleAccountKey(selectedUser),
      googleEmail: selectedUser.googleEmail || selectedUser.profile?.google?.email || '',
      needsLegacyMigration: !selectedUser.legacyMigration?.completed,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to switch account.' });
  }
};


