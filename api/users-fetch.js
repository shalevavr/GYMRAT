const { findOne } = require('./_lib/mongodb');
const { sanitizeUser, validateUsername, verifySession } = require('./_lib/security');

function getAccountFilter({ username, accountKey }) {
  const cleanAccountKey = `${accountKey || ''}`.trim();
  if (cleanAccountKey.startsWith('google:')) return { accountKey: cleanAccountKey };
  return { username: validateUsername(username) };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, accountKey, authToken } = req.body || {};
  let filter;
  try {
    filter = getAccountFilter({ username, accountKey });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!authToken) return res.status(400).json({ error: 'Auth token is required.' });

  try {
    const user = await findOne(filter);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!verifySession(user, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to fetch user.' });
  }
};