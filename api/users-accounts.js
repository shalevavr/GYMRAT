const { findMany, findOne, updateOne } = require('./_lib/mongodb');
const { verifySession } = require('./_lib/security');

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

function publicAccount(user) {
  return {
    username: user.username,
    accountKey: getGoogleAccountKey(user),
    displayName: user.profile?.displayName || user.username,
    googleEmail: user.googleEmail || user.profile?.google?.email || '',
    picture: user.profile?.google?.picture || '',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { accountKey, authToken } = req.body || {};
  const cleanAccountKey = `${accountKey || ''}`.trim();
  if (!cleanAccountKey || !authToken) return res.status(400).json({ error: 'Account key and auth token are required.' });

  try {
    const currentUser = await findOne({ accountKey: cleanAccountKey });
    if (!currentUser) return res.status(404).json({ error: 'Current account not found.' });
    if (!verifySession(currentUser, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });
    const googleSub = currentUser.profile?.google?.sub;
    if (!googleSub) return res.status(400).json({ error: 'Google account is required.' });
    const usersRaw = await findMany({ 'profile.google.sub': googleSub });
    const users = [];
    for (const user of usersRaw) users.push(await ensureAccountKey(user));
    return res.status(200).json({ ok: true, googleEmail: currentUser.profile?.google?.email || '', accounts: users.map(publicAccount) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to list accounts.' });
  }
};

