import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { shell } from 'electron'

export const TICKTICK_AUTHORIZE_URL = 'https://ticktick.com/oauth/authorize'
export const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token'
export const TICKTICK_API_BASE = 'https://api.ticktick.com/open/v1'
// TickTick's authorize step rejects a bare single scope with a generic
// `unknown_exception`; every working integration requests the full pair.
// The app remains display-only: it never calls the write endpoints.
export const TICKTICK_SCOPE = 'tasks:read tasks:write'

// TickTick requires the redirect URI to match the registered one exactly (no
// random-port special case like Google's loopback handling), so this app listens
// on one fixed port. The `/callback` path is required — a pathless redirect URI
// (http://127.0.0.1:14565) is rejected by TickTick's authorize step with a
// generic `unknown_exception` after login. Register this exact URI in the
// TickTick developer app (App Service URL).
export const TICKTICK_REDIRECT_PORT = 14_565
export const TICKTICK_REDIRECT_URI = `http://127.0.0.1:${TICKTICK_REDIRECT_PORT}/callback`

export type TickTickTokens = {
  accessToken: string
  refreshToken?: string
  expiryDate?: number
}

export type TickTickOAuthConfig = {
  clientId: string
  clientSecret: string
}

// The fixed redirect port means every authorization attempt binds the same
// address. A previous attempt that never redirected back (closed tab, error
// page, etc.) would otherwise leave its listener running and the next attempt
// would fail with EADDRINUSE. All listeners belong to this module, so each new
// attempt closes any leftover one first.
let staleServer: Server | undefined

/** Opens TickTick's authorization page and waits for the loopback callback with the code. */
export async function openTickTickAuthorization(config: TickTickOAuthConfig): Promise<{ code: string }> {
  if (staleServer) {
    staleServer.close()
    staleServer = undefined
  }
  const state = randomBytes(24).toString('hex')
  const server = createServer()
  staleServer = server
  let finished = false
  const closeServer = (): void => {
    if (finished) return
    finished = true
    server.close()
    if (staleServer === server) staleServer = undefined
  }
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(TICKTICK_REDIRECT_PORT, '127.0.0.1', () => resolve())
    })
  } catch {
    staleServer = undefined
    throw new Error(`Unable to start the TickTick login callback on port ${TICKTICK_REDIRECT_PORT} (in use by another process).`)
  }
  const url = new URL(TICKTICK_AUTHORIZE_URL)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', TICKTICK_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', TICKTICK_SCOPE)
  url.searchParams.set('state', state)
  await shell.openExternal(url.toString())

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      closeServer()
      reject(new Error('TickTick authorization timed out'))
    }, 5 * 60_000)
    server.on('request', (request, response) => {
      const requestUrl = new URL(request.url ?? '/', TICKTICK_REDIRECT_URI)
      if (requestUrl.searchParams.get('state') !== state) {
        response.writeHead(400)
        response.end('Invalid OAuth state')
        closeServer()
        return
      }
      const code = requestUrl.searchParams.get('code')
      if (!code) {
        response.writeHead(400)
        response.end('Authorization was not granted')
        closeServer()
        return
      }
      clearTimeout(timeout)
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end('<p>You can return to Cat Reminder.</p>')
      closeServer()
      resolve({ code })
    })
  })
}

async function tokenRequest(config: TickTickOAuthConfig, body: URLSearchParams): Promise<TickTickTokens> {
  // TickTick's token endpoint expects the client credentials via HTTP Basic auth
  // (verified against the openapi-cli implementation, tested end-to-end) and the
  // `scope` parameter in the body — form-encoded credentials without scope get a
  // generic `unknown_exception` back.
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
  const response = await fetch(TICKTICK_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`
    },
    body
  })
  const text = await response.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`TickTick token request failed (${response.status}): ${text.slice(0, 200)}`)
  }
  if (!response.ok || typeof data.access_token !== 'string') {
    const detail =
      typeof data.error_description === 'string' ? data.error_description
        : typeof data.errorMessage === 'string' ? data.errorMessage
          : typeof data.error === 'string' ? data.error
            : `HTTP ${response.status}`
    throw new Error(`TickTick token request failed: ${detail} (body: ${text.slice(0, 300)})`)
  }
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    expiryDate: typeof data.expires_in === 'number' ? Date.now() + data.expires_in * 1000 : undefined
  }
}

export async function exchangeTickTickCode(config: TickTickOAuthConfig, code: string): Promise<TickTickTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    scope: TICKTICK_SCOPE,
    redirect_uri: TICKTICK_REDIRECT_URI
  })
  return tokenRequest(config, body)
}

export async function refreshTickTickAccessToken(config: TickTickOAuthConfig, refreshToken: string): Promise<TickTickTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: TICKTICK_SCOPE
  })
  return tokenRequest(config, body)
}
