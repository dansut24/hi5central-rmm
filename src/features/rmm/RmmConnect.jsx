import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clipboard, Clock3, ExternalLink, Laptop, Link2, LoaderCircle, MonitorUp, PauseCircle, PlayCircle, Plus, Power, ShieldCheck } from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import { detectRemoteViewerClient } from './remoteViewerClient.js'
import './RmmConnect.css'

function apiBase() {
  return window.__HI5_API_BASE__ || deploymentConfig().apiUrl
}
function statusLabel(status = '') {
  const value = String(status || '').toLowerCase()
  if (value === 'waiting') return 'Waiting for customer'
  if (value === 'claimed') return 'Download approved'
  if (value === 'host_connected') return 'Customer app online'
  if (value === 'viewer_connected') return 'Technician connecting'
  if (value === 'active') return 'Remote session active'
  if (value === 'ended') return 'Ended'
  if (value === 'expired') return 'Expired'
  if (value === 'failed') return 'Failed'
  return value || 'Unknown'
}
function statusTone(status = '') {
  const value = String(status || '').toLowerCase()
  if (['host_connected','viewer_connected','active'].includes(value)) return 'ready'
  if (['waiting','claimed'].includes(value)) return 'pending'
  if (value === 'failed') return 'failed'
  return 'ended'
}
function formatRemaining(expiresAt, now) {
  const target = new Date(expiresAt || '').getTime()
  if (!Number.isFinite(target)) return ''
  const seconds = Math.max(0, Math.ceil((target - now) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes + ':' + String(remainder).padStart(2, '0')
}
function formatElapsed(startedAt, now) {
  const started = new Date(startedAt || '').getTime()
  if (!Number.isFinite(started)) return ''
  const total = Math.max(0, Math.floor((now - started) / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
    : minutes + ':' + String(seconds).padStart(2, '0')
}

function copyText(value) {
  if (!value) return Promise.resolve()
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const input = document.createElement('textarea')
  input.value = value
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  input.remove()
  return Promise.resolve()
}

export function RmmConnect() {
  const base = useMemo(() => apiBase(), [])
  const [sessions, setSessions] = useState([])
  const [publicUrl, setPublicUrl] = useState('https://connect.hi5central.com')
  const [freshCode, setFreshCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async (silent = false) => {
    try {
      const response = await fetch(base + '/api/v1/rmm/connect-sessions', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load Connect sessions.')
      setSessions(Array.isArray(payload.sessions) ? payload.sessions : [])
      if (payload.publicUrl) setPublicUrl(payload.publicUrl)
      if (!silent) setMessage('')
    } catch (error) {
      if (!silent) setMessage(error.message || 'Unable to load Connect sessions.')
    }
  }, [base])

  useEffect(() => {
    load()
    const poll = window.setInterval(() => load(true), 3000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(clock)
    }
  }, [load])

  async function createSession() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(base + '/api/v1/rmm/connect-sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to create a support code.')
      setFreshCode(payload.session || null)
      if (payload.session?.publicUrl) setPublicUrl(payload.session.publicUrl)
      await load(true)
    } catch (error) {
      setMessage(error.message || 'Unable to create a support code.')
    } finally {
      setBusy(false)
    }
  }

  async function openViewer(session) {
    setMessage('')
    try {
      const viewerTarget = detectRemoteViewerClient()
      const response = await fetch(base + '/api/v1/rmm/connect-sessions/' + encodeURIComponent(session.id) + '/viewer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerClient: viewerTarget.viewerClient }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to open this Connect session.')
      if (payload.browserUrl) window.open(payload.browserUrl, '_blank', 'noopener,noreferrer')
      else if (payload.nativeUrl) window.location.href = payload.nativeUrl
      else throw new Error('No Viewer launch URL was returned.')
    } catch (error) {
      setMessage(error.message || 'Unable to open this Connect session.')
    }
  }

  async function terminate(session) {
    if (!window.confirm('End this Hi5Central Connect support session? The customer app will be disconnected.')) return
    setMessage('')
    try {
      const response = await fetch(base + '/api/v1/rmm/connect-sessions/' + encodeURIComponent(session.id) + '/terminate', {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to end this Connect session.')
      if (freshCode?.id === session.id) setFreshCode(null)
      await load(true)
    } catch (error) {
      setMessage(error.message || 'Unable to end this Connect session.')
    }
  }

  async function holdSession(session) {
    if (!window.confirm('Ask the customer to keep this Connect session available for up to 24 hours? They must approve locally. If approved, Connect can return once after their next Windows sign-in following a restart.')) return
    setMessage('')
    try {
      const response = await fetch(base + '/api/v1/rmm/connect-sessions/' + encodeURIComponent(session.id) + '/hold', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 24 * 60 }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to request a session hold.')
      setMessage('Waiting for the customer to approve keeping this session available…')
      await load(true)
    } catch (error) {
      setMessage(error.message || 'Unable to request a session hold.')
    }
  }

  async function resumeSession(session) {
    setMessage('')
    try {
      const response = await fetch(base + '/api/v1/rmm/connect-sessions/' + encodeURIComponent(session.id) + '/resume', {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to resume this Connect session.')
      setMessage('Session hold released. You can reconnect to the customer computer.')
      await load(true)
    } catch (error) {
      setMessage(error.message || 'Unable to resume this Connect session.')
    }
  }

  const liveSessions = sessions.filter((session) => !['ended','expired','failed'].includes(String(session.status || '').toLowerCase()))
  const recentSessions = sessions.filter((session) => ['ended','expired','failed'].includes(String(session.status || '').toLowerCase())).slice(0, 12)
  const activeFresh = freshCode && new Date(freshCode.expiresAt).getTime() > now

  return <div className="rmm-connect-workspace">
    <section className="rmm-card rmm-connect-hero">
      <div className="rmm-connect-hero-copy">
        <span className="rmm-eyebrow">AD-HOC REMOTE SUPPORT</span>
        <h2>Hi5Central Connect</h2>
        <p>Support a Windows user without enrolling their computer into RMM. Create a short-lived code, ask the customer to visit <strong>connect.hi5central.com</strong>, and open the remote session when their temporary Connect app comes online.</p>
        <div className="rmm-connect-trust">
          <span><ShieldCheck size={15}/> Explicit customer consent</span>
          <span><Laptop size={15}/> No permanent Agent install</span>
          <span><Clock3 size={15}/> Short-lived one-time ticket</span>
        </div>
      </div>
      <button className="rmm-primary rmm-connect-create" disabled={busy} onClick={createSession} type="button">
        {busy ? <LoaderCircle className="rmm-connect-spin" size={17}/> : <Plus size={17}/>}
        Create support code
      </button>
    </section>

    {message ? <div className="rmm-connect-message">{message}</div> : null}

    {activeFresh ? <section className="rmm-card rmm-connect-code-card">
      <div>
        <span className="rmm-eyebrow">GIVE THIS TO THE CUSTOMER</span>
        <div className="rmm-connect-code">{freshCode.code}</div>
        <div className="rmm-connect-expiry"><Clock3 size={14}/> Expires in {formatRemaining(freshCode.expiresAt, now)}</div>
      </div>
      <div className="rmm-connect-code-actions">
        <button className="rmm-secondary" onClick={() => copyText(freshCode.code)} type="button"><Clipboard size={15}/> Copy code</button>
        <button className="rmm-secondary" onClick={() => copyText(publicUrl)} type="button"><Link2 size={15}/> Copy Connect URL</button>
        <a className="rmm-secondary" href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open customer page</a>
      </div>
      <p>The full code is shown only when it is created. Hi5Central stores only a hash of the code.</p>
    </section> : null}

    <section className="rmm-card">
      <div className="rmm-section-heading">
        <div><span className="rmm-eyebrow">LIVE SUPPORT</span><h3>Open Connect sessions</h3></div>
        <span className="rmm-connect-count">{liveSessions.length}</span>
      </div>
      {liveSessions.length ? <div className="rmm-connect-list">
        {liveSessions.map((session) => {
          const status = String(session.status || '').toLowerCase()
          const heldUntil = session.held_until ? new Date(session.held_until).getTime() : 0
          const held = Number.isFinite(heldUntil) && heldUntil > now
          const holdPending = !!session.hold_requested_at && !session.hold_approved_at && !held
          const hostOnline = session.host_online === true
          const canOpen = hostOnline && !held && ['host_connected','viewer_connected','active'].includes(status)
          const displayStatus = held
            ? 'On hold'
            : (!hostOnline && ['host_connected','viewer_connected','active'].includes(status) ? 'Customer app reconnecting' : statusLabel(status))
          const displayTone = held || holdPending ? 'pending' : (!hostOnline && ['host_connected','viewer_connected','active'].includes(status) ? 'pending' : statusTone(status))
          return <article className="rmm-connect-row" key={session.id}>
            <div className="rmm-connect-row-icon"><MonitorUp size={19}/></div>
            <div className="rmm-connect-row-main">
              <div className="rmm-connect-row-title">
                <strong>{session.host_name || (status === 'waiting' ? 'Waiting for customer' : 'Customer computer')}</strong>
                <span className={'rmm-connect-status is-' + displayTone}>{holdPending ? 'Waiting for hold approval' : displayStatus}</span>
              </div>
              <div className="rmm-connect-row-meta">
                <span>{session.host_platform || 'Windows support session'}</span>
                {session.host_version ? <span>Connect {session.host_version}</span> : null}
                {session.technician ? <span>Technician: {session.technician}</span> : null}
                {session.host_elevated ? <span>Administrator access active</span> : null}
                {session.file_access_granted_at ? <span>File access approved</span> : null}
                {hostOnline ? <span>Customer app online</span> : (session.host_disconnected_at ? <span>Customer app offline since {new Date(session.host_disconnected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null)}
                {session.host_connected_at ? <span>First online {formatElapsed(session.host_connected_at, now)} ago</span> : null}
                {session.started_at ? <span>Remote started {formatElapsed(session.started_at, now)} ago</span> : null}
                {held ? <span>Held until {new Date(session.held_until).toLocaleString()}</span> : null}
                <span>Created {new Date(session.created_at).toLocaleString()}</span>
                {session.expires_at ? <span>Expires {new Date(session.expires_at).toLocaleString()}</span> : null}
              </div>
            </div>
            <div className="rmm-connect-row-actions">
              <button className="rmm-primary" disabled={!canOpen} onClick={() => openViewer(session)} type="button"><MonitorUp size={15}/>{status === 'active' ? 'Reopen' : 'Connect'}</button>
              {held
                ? <button className="rmm-secondary" onClick={() => resumeSession(session)} type="button"><PlayCircle size={15}/> Resume</button>
                : <button className="rmm-secondary" disabled={!hostOnline || holdPending} onClick={() => holdSession(session)} type="button"><PauseCircle size={15}/>{holdPending ? 'Awaiting approval' : 'Hold'}</button>}
              <button className="rmm-secondary is-danger" onClick={() => terminate(session)} type="button"><Power size={15}/> End</button>
            </div>
          </article>
        })}
      </div> : <div className="rmm-connect-empty"><CheckCircle2 size={24}/><strong>No open Connect sessions</strong><span>Create a support code when an unmanaged user needs remote assistance.</span></div>}
    </section>

    <section className="rmm-card">
      <div className="rmm-section-heading"><div><span className="rmm-eyebrow">RECENT</span><h3>Recent Connect sessions</h3></div></div>
      {recentSessions.length ? <div className="rmm-connect-history">
        {recentSessions.map((session) => <div key={session.id}>
          <span className={'rmm-connect-status is-' + statusTone(session.status)}>{statusLabel(session.status)}</span>
          <strong>{session.host_name || 'Customer computer'}</strong>
          <span>{new Date(session.created_at).toLocaleString()}</span>
          <span>{session.end_reason ? String(session.end_reason).replaceAll('_', ' ') : ''}</span>
        </div>)}
      </div> : <div className="rmm-connect-empty is-small">No completed Connect sessions yet.</div>}
    </section>
  </div>
}
