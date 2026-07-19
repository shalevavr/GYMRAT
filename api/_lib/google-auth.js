function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    throw new Error('Google sign in is not configured. Set GOOGLE_CLIENT_ID in Vercel.');
  }
  return clientId;
}

function normalizeGoogleProfile(payload) {
  if (!payload?.sub || !payload?.email) {
    throw new Error('Google account data is incomplete.');
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('Google email must be verified.');
  }
  return {
    sub: `${payload.sub}`,
    email: `${payload.email}`.toLowerCase(),
    name: `${payload.name || ''}`.trim().slice(0, 120),
    picture: `${payload.picture || ''}`.trim().slice(0, 500),
    verifiedAt: new Date().toISOString(),
  };
}

async function verifyGoogleCredential(credential) {
  const token = `${credential || ''}`.trim();
  if (!token) throw new Error('Google sign in is required.');

  const clientId = getGoogleClientId();
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error('Google sign in could not be verified.');
  if (payload.aud !== clientId) throw new Error('Google sign in was issued for the wrong app.');
  return normalizeGoogleProfile(payload);
}

async function verifyGoogleAccessToken(accessToken) {
  const token = `${accessToken || ''}`.trim();
  if (!token) throw new Error('Google sign in is required.');

  const clientId = getGoogleClientId();
  const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  const tokenInfo = await tokenInfoResponse.json().catch(() => null);
  if (!tokenInfoResponse.ok || !tokenInfo) throw new Error('Google sign in could not be verified.');
  if (tokenInfo.aud !== clientId) throw new Error('Google sign in was issued for the wrong app.');

  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const userInfo = await userInfoResponse.json().catch(() => null);
  if (!userInfoResponse.ok || !userInfo) throw new Error('Google account data could not be loaded.');
  return normalizeGoogleProfile({ ...tokenInfo, ...userInfo });
}

async function verifyGoogleAuthFromBody(body = {}) {
  if (body.googleAccessToken) return verifyGoogleAccessToken(body.googleAccessToken);
  return verifyGoogleCredential(body.googleCredential);
}

module.exports = { verifyGoogleAccessToken, verifyGoogleAuthFromBody, verifyGoogleCredential };