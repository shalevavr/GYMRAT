const { findOne, updateOne } = require('./_lib/mongodb');
const { sanitizeUser, validateUsername, verifySession } = require('./_lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accountKey, authToken, legacyEmail } = req.body || {};
  const cleanAccountKey = `${accountKey || ''}`.trim();
  let normalizedLegacyEmail;
  try {
    if (!cleanAccountKey.startsWith('google:')) throw new Error('Google account session is required.');
    normalizedLegacyEmail = validateUsername(legacyEmail);
    if (!normalizedLegacyEmail.includes('@')) throw new Error('Enter the email used by your old account.');
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!authToken) return res.status(400).json({ error: 'Auth token is required.' });

  try {
    const googleUser = await findOne({ accountKey: cleanAccountKey });
    if (!googleUser) return res.status(404).json({ error: 'Google account not found.' });
    if (!verifySession(googleUser, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });

    const googleEmail = `${googleUser.googleEmail || googleUser.profile?.google?.email || ''}`.trim().toLowerCase();
    if (!googleEmail || normalizedLegacyEmail.toLowerCase() !== googleEmail) {
      return res.status(403).json({ error: 'The email must match your signed-in Google account.' });
    }

    const legacyUser = await findOne({ username: normalizedLegacyEmail });
    if (!legacyUser) return res.status(404).json({ error: 'No old account was found for that email.' });
    if (legacyUser.accountKey === cleanAccountKey) {
      return res.status(200).json({ ok: true, alreadyLinked: true, user: sanitizeUser(googleUser) });
    }

    const migratedSelections = legacyUser.selections || googleUser.selections || {};
    await updateOne(
      { accountKey: cleanAccountKey },
      {
        $set: {
          selections: migratedSelections,
          legacyMigration: {
            completed: true,
            fromUsername: legacyUser.username,
            migratedAt: new Date().toISOString(),
          },
        },
      },
      { upsert: false }
    );

    await updateOne(
      { username: legacyUser.username },
      {
        $set: {
          migratedToAccountKey: cleanAccountKey,
          migratedAt: new Date().toISOString(),
        },
      },
      { upsert: false }
    );

    const nextUser = await findOne({ accountKey: cleanAccountKey });
    return res.status(200).json({ ok: true, user: sanitizeUser(nextUser) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to migrate old account data.' });
  }
};