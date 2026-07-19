const { deleteOne, findOne } = require('./_lib/mongodb');
const { validateUsername, verifySession } = require('./_lib/security');

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
    const existingUser = await findOne(filter);
    if (!existingUser) return res.status(404).json({ error: 'User not found.' });
    if (!verifySession(existingUser, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });

    const result = await deleteOne(filter);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to delete account.' });
  }
};