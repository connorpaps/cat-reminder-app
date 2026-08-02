import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { shell } from 'electron'
import { google } from 'googleapis'

export type OAuthConfig = { clientId: string; clientSecret: string; authorizationEndpoint?: string }
export type OAuthTokens = { accessToken: string; refreshToken?: string; expiryDate?: number }

export const GOOGLE_CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
export const GOOGLE_TASKS_READONLY_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly'
export const GOOGLE_COMBINED_SCOPE = `${GOOGLE_CALENDAR_READONLY_SCOPE} ${GOOGLE_TASKS_READONLY_SCOPE}`

export async function openGoogleAuthorization(config: OAuthConfig): Promise<{ code: string; redirectUri: string }> {
  const state = randomBytes(24).toString('hex')
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to create OAuth callback listener')
  const redirectUri = `http://127.0.0.1:${address.port}`
  const authorizationEndpoint = config.authorizationEndpoint ?? 'https://accounts.google.com/o/oauth2/v2/auth'
  const url = new URL(authorizationEndpoint)
  url.searchParams.set('client_id', config.clientId); url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code');  url.searchParams.set('scope', GOOGLE_COMBINED_SCOPE)
  url.searchParams.set('access_type', 'offline'); url.searchParams.set('prompt', 'consent'); url.searchParams.set('state', state)
  await shell.openExternal(url.toString())

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { server.close(); reject(new Error('Google authorization timed out')) }, 5 * 60_000)
    server.on('request', (request, response) => {
      const requestUrl = new URL(request.url ?? '/', redirectUri)
      if (requestUrl.searchParams.get('state') !== state) { response.writeHead(400); response.end('Invalid OAuth state'); return }
      const code = requestUrl.searchParams.get('code')
      if (!code) { response.writeHead(400); response.end('Authorization was not granted'); return }
      clearTimeout(timeout); response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<p>You can return to Cat Reminder.</p>')
      server.close(); resolve({ code, redirectUri })
    })
  })
}

export async function exchangeGoogleCode(config: OAuthConfig & { code: string; redirectUri: string }): Promise<OAuthTokens> {
  const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  const { tokens } = await client.getToken(config.code)
  if (!tokens.access_token) throw new Error('Google did not return an access token')
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? undefined, expiryDate: tokens.expiry_date ?? undefined }
}
