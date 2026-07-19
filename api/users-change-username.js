const { findOne, updateOne } = require('./_lib/mongodb');
const { createSession, validateUsername, verifySession } = require('./_lib/security');

function getGoogleAccountKey(user, username = user.username) {
  return user.profile?.google?.sub ? `google:${user.profile.google.sub}:${`${username || ''}`.toLowerCase()}` : username;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accountKey, authToken, newUsername } = req.body || {};
  const cleanAccountKey = `${accountKey || ''}`.trim();
  if (!cleanAccountKey || !authToken) return res.status(400).json({ error: 'Account key and auth token are required.' });

  let cleanNewUsername;
  try {
    cleanNewUsername = validateUsername(newUsername);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const user = await findOne({ accountKey: cleanAccountKey }) || await findOne({ username: cleanAccountKey });
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (!verifySession(user, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });

    if (user.username === cleanNewUsername) {
      return res.status(200).json({
        ok: true,
        username: user.username,
        accountKey: user.accountKey || getGoogleAccountKey(user),
        googleEmail: user.googleEmail || user.profile?.google?.email || '',
        token: authToken,
      });
    }

    const existingUsername = await findOne({ username: cleanNewUsername });
    if (existingUsername && `${existingUsername._id}` !== `${user._id}`) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const nextAccountKey = getGoogleAccountKey(user, cleanNewUsername);
    const existingAccountKey = await findOne({ accountKey: nextAccountKey });
    if (existingAccountKey && `${existingAccountKey._id}` !== `${user._id}`) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const session = createSession();
    const updateResult = await updateOne(
      { _id: user._id },
      {
        $set: {
          username: cleanNewUsername,
          accountKey: nextAccountKey,
          googleEmail: user.googleEmail || user.profile?.google?.email || '',
          sessionTokenHash: session.tokenHash,
          sessionExpiresAt: session.expiresAt,
          sessionToken: null,
          'profile.displayName': user.profile?.displayName || cleanNewUsername,
          'profile.usernameUpdatedAt': new Date().toISOString(),
        }
      },
      { upsert: false }
    );

    if (updateResult.matchedCount === 0) return res.status(404).json({ error: 'Account not found.' });

    return res.status(200).json({
      ok: true,
      username: cleanNewUsername,
      accountKey: nextAccountKey,
      googleEmail: user.googleEmail || user.profile?.google?.email || '',
      token: session.token,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to change username.' });
  }
};
