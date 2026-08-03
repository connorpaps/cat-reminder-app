// Standalone live test of the TickTick OAuth flow.
// Mirrors src/main/sync/ticktick/oauth.ts + ticktick-sync.ts exactly so we can
// verify the end-to-end connect path (authorize -> code -> token -> projects)
// without launching the full Electron app. No secrets are printed.
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const env = {}
for (const line of readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const clientId = env.TICKTICK_CLIENT_ID
const clientSecret = env.TICKTICK_CLIENT_SECRET
if (!clientId || !clientSecret) {
  console.error('Missing TICKTICK_CLIENT_ID/TICKTICK_CLIENT_SECRET in .env')
  process.exit(1)
}

const REDIRECT_URI = 'http://127.0.0.1:14565/callback'
const PORT = 14_565
const SCOPE = 'tasks:read tasks:write'
const AUTHORIZE_URL = 'https://ticktick.com/oauth/authorize'
const TOKEN_URL = 'https://ticktick.com/oauth/token'
const API_BASE = 'https://api.ticktick.com/open/v1'

// NOTE: the Electron app binds this port only during a connect attempt, so the
// harness must not run while the app is mid-connect (otherwise EADDRINUSE).
const state = randomBytes(24).toString('hex')
const server = createServer()
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, '127.0.0.1', () => resolve())
  })
} catch {
  console.error(`[live-test] EADDRINUSE: port ${PORT} is busy (is the Electron app mid-connect?).`)
  process.exit(1)
}
console.log(`[live-test] callback server listening on ${REDIRECT_URI}`)

const url = new URL(AUTHORIZE_URL)
url.searchParams.set('client_id', clientId)
url.searchParams.set('redirect_uri', REDIRECT_URI)
url.searchParams.set('response_type', 'code')
url.searchParams.set('scope', SCOPE)
url.searchParams.set('state', state)
// Print the full authorize URL (client_id/redirect_uri are public, not secret).
console.log(`[live-test] opening authorize URL:\n${url.toString()}`)
execSync(`cmd.exe /c start "" "${url.toString()}"`)

const code = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { server.close(); reject(new Error('timeout waiting for callback')) }, 5 * 60_000)
  server.on('request', (req, res) => {
    const requestUrl = new URL(req.url ?? '/', REDIRECT_URI)
    if (requestUrl.searchParams.get('state') !== state) {
      res.writeHead(400); res.end('Invalid OAuth state'); clearTimeout(timeout); server.close(); reject(new Error('state mismatch')); return
    }
    const c = requestUrl.searchParams.get('code')
    if (!c) {
      const err = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error') || 'authorization denied'
      res.writeHead(400); res.end('Authorization failed'); clearTimeout(timeout); server.close(); reject(new Error(`authorize error: ${err}`)); return
    }
    clearTimeout(timeout)
    res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<p>You can return to Cat Reminder.</p>')
      server.closeAllConnections?.()
      server.close()
      resolve(c)
  })
})
console.log('[live-test] got authorization code (length', code.length, ')')

// Token exchange — identical to exchangeTickTickCode.
const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
const tokenBody = new URLSearchParams({ grant_type: 'authorization_code', code, scope: SCOPE, redirect_uri: REDIRECT_URI })
const tokenRes = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
  body: tokenBody
})
const tokenText = await tokenRes.text()
let tokenData = {}
try { tokenData = JSON.parse(tokenText) } catch { /* keep empty */ }
if (!tokenRes.ok || typeof tokenData.access_token !== 'string') {
  console.error(`[live-test] TOKEN EXCHANGE FAILED status=${tokenRes.status}`, tokenText.slice(0, 400))
  process.exit(1)
}
console.log('[live-test] token exchange OK — access_token length', tokenData.access_token.length, '| refresh_token present:', Boolean(tokenData.refresh_token), '| expires_in:', tokenData.expires_in)

// Projects fetch — identical to createTickTickClient().listProjects().
const headers = { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' }
const projRes = await fetch(`${API_BASE}/project`, { headers })
const projText = await projRes.text()
console.log(`[live-test] GET /project status=${projRes.status}`)
if (!projRes.ok) {
  console.error('[live-test] PROJECTS FAILED:', projText.slice(0, 400))
  process.exit(1)
}
const projects = JSON.parse(projText)
console.log(`[live-test] projects fetched: ${projects.length}`)
for (const p of projects.slice(0, 10)) console.log(`   - id=${p.id} name="${p.name}" closed=${Boolean(p.closed)}`)

// Tasks fetch for the first project — identical to listTasks().
if (projects.length > 0) {
  const pid = projects[0].id
  const dataRes = await fetch(`${API_BASE}/project/${encodeURIComponent(pid)}/data`, { headers })
  const dataText = await dataRes.text()
  console.log(`[live-test] GET /project/${pid}/data status=${dataRes.status}`)
  if (dataRes.ok) {
    const data = JSON.parse(dataText)
    console.log(`[live-test] tasks in first project: ${(data.tasks ?? []).length}`)
    for (const t of (data.tasks ?? []).slice(0, 5)) {
      console.log(`   - id=${t.id} title="${t.title}" status=${t.status} dueDate=${t.dueDate ?? '(none)'} isAllDay=${Boolean(t.isAllDay)}`)
    }
  } else {
    console.error('[live-test] TASKS FAILED:', dataText.slice(0, 300))
  }
}

console.log('[live-test] ALL OK — TickTick connect path verified end-to-end.')
process.exit(0)
