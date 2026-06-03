const jwt = require('jsonwebtoken');
const axios = require('axios');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post(GOOGLE_TOKEN_URL, {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });
    return response.data;
  } catch (err) {
    throw new Error('Failed to exchange code for token: ' + err.message);
  }
}

async function getGoogleUserInfo(accessToken) {
  try {
    const response = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (err) {
    throw new Error('Failed to get user info: ' + err.message);
  }
}

function issueJWT(userId, email, role) {
  return jwt.sign(
    { user_id: userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { exchangeCodeForToken, getGoogleUserInfo, issueJWT, verifyJWT };
