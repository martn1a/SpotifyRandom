const CLIENT_ID   = 'ed48e32b12fd4b01ad0dbdf383cb3ff6'
const REDIRECT_URI = 'http://127.0.0.1:5173'
const SCOPES = 'user-library-read user-read-playback-state user-modify-playback-state user-read-private playlist-read-private playlist-read-collaborative'

// ── PKCE helpers ────────────────────────────────────────────────────

function randomString(n) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

async function codeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ── Token storage ────────────────────────────────────────────────────

function storeTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem('spotify_access_token', access_token)
  if (refresh_token) localStorage.setItem('spotify_refresh_token', refresh_token)
  localStorage.setItem('spotify_expires_at', String(Date.now() + (expires_in - 60) * 1000))
}

async function refreshAccessToken() {
  const rt = localStorage.getItem('spotify_refresh_token')
  if (!rt) throw new Error('No refresh token.')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: rt,
      client_id: CLIENT_ID,
    }),
  })

  if (!res.ok) {
    logout()
    throw new Error('Session expired — please log in again.')
  }

  storeTokens(await res.json())
}

// ── Public API ───────────────────────────────────────────────────────

export function isLoggedIn() {
  return !!localStorage.getItem('spotify_refresh_token')
}

export async function login() {
  const verifier  = randomString(64)
  const challenge = await codeChallenge(verifier)
  const state     = randomString(16)

  localStorage.setItem('pkce_verifier', verifier)
  localStorage.setItem('pkce_state', state)

  window.location.href =
    'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    })
}

export async function handleCallback(code, returnedState) {
  const savedState = localStorage.getItem('pkce_state')
  if (returnedState !== savedState) throw new Error('State mismatch — please try logging in again.')

  const verifier = localStorage.getItem('pkce_verifier')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })

  if (!res.ok) throw new Error('Token exchange failed: ' + await res.text())

  storeTokens(await res.json())
  window.history.replaceState({}, '', window.location.pathname)
}

export async function getToken() {
  if (Date.now() > Number(localStorage.getItem('spotify_expires_at') || 0)) {
    await refreshAccessToken()
  }
  return localStorage.getItem('spotify_access_token')
}

export function logout() {
  ['spotify_access_token', 'spotify_refresh_token', 'spotify_expires_at', 'pkce_verifier', 'pkce_state']
    .forEach(k => localStorage.removeItem(k))
}
