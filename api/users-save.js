const { findOne, updateOne } = require('./_lib/mongodb');
const { sanitizeUpdatePayload, sanitizeUser, validateUsername, verifySession } = require('./_lib/security');

function getAccountFilter({ username, accountKey }) {
  const cleanAccountKey = `${accountKey || ''}`.trim();
  if (cleanAccountKey.startsWith('google:')) return { accountKey: cleanAccountKey };
  return { username: validateUsername(username) };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, accountKey, authToken, payload } = req.body || {};
  let filter;
  let cleanPayload;
  try {
    filter = getAccountFilter({ username, accountKey });
    cleanPayload = sanitizeUpdatePayload(payload);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!authToken || !cleanPayload) {
    return res.status(400).json({ error: 'Auth token and valid payload are required.' });
  }

  try {
    const existingUser = await findOne(filter);
    if (!existingUser) return res.status(404).json({ error: 'User not found.' });
    if (!verifySession(existingUser, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });

    const result = await updateOne(filter, { $set: cleanPayload }, { upsert: false });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'User not found.' });

    const user = await findOne(filter);
    return res.status(200).json({ ok: true, user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to save user data.' });
  }
};