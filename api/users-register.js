const crypto = require('crypto');
const { findOne, insertOne } = require('./_lib/mongodb');
const { createSession, hashPassword, sessionUpdateForDevice, validateUsername } = require('./_lib/security');
const { verifyGoogleAuthFromBody } = require('./_lib/google-auth');

function getInitialSelections() {
  return {
    favorites: [],
    favorites_meta: {
      updatedAt: null,
      lastSyncedAt: null,
      pendingSync: false,
      deviceId: null,
      baseCloudUpdatedAt: null,
    },
    pages: {},
    pages_meta: {},
    program: '',
    exercise_plan: {},
    weekly_table: {},
    gym_table: {},
    planner: null,
    gym_plans: {},
    diet: {
      calorieTarget: 2100,
      macroTargets: {
        protein: 150,
        carbs: 220,
        fat: 70,
      },
      profile: {
        isComplete: false,
      },
      recordsByDate: {},
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, id, profile } = req.body || {};

  let normalizedUsername;
  let googleProfile;
  try {
    normalizedUsername = validateUsername(username);
    googleProfile = await verifyGoogleAuthFromBody(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const existingUser = await findOne({ username: normalizedUsername });
    if (existingUser) return res.status(409).json({ error: 'User already exists.' });


    const accountKey = `google:${googleProfile.sub}:${normalizedUsername.toLowerCase()}`;

    const session = createSession();


    const deviceSession = sessionUpdateForDevice(session, req.body?.deviceId);


    const userDoc = {
      username: normalizedUsername,
      accountKey,
      googleEmail: googleProfile.email,
      passwordHash: hashPassword(crypto.randomBytes(32).toString('hex')),
      id: id || `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      profile: {
        displayName: `${profile?.displayName || googleProfile.name || normalizedUsername}`.trim().slice(0, 80),
        google: googleProfile,
      },
      sessionToken: null,
      sessionTokenHash: session.tokenHash,
      sessionExpiresAt: session.expiresAt,
      sessions: {
        [deviceSession.deviceId]: deviceSession.value,
      },
      selections: getInitialSelections(),
    };

    await insertOne(userDoc);
    return res.status(200).json({
      ok: true,
      token: session.token,
      deviceId: deviceSession.deviceId,
      username: normalizedUsername,
      accountKey,
      googleEmail: googleProfile.email,
      needsLegacyMigration: false,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to register user.' });
  }
};

