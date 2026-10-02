import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Download, RefreshCw, ShieldCheck, X } from 'lucide-react'

const API_BASE = window.__HI5_API_BASE__ || ''
const FALLBACK_DOWNLOADS = {
  windows: {
    label: 'Windows x64',
    url: 'https://downloads.hi5central.com/agent/latest/Hi5CentralAgentSetup.exe',
  },
  macos: {
    label: 'macOS universal',
    url: 'https://downloads.hi5central.com/agent/latest/Hi5CentralAgent-macOS-universal.tar.gz',
    version: '0.3.1',
  },
  linux: {
    label: 'Linux x64',
    url: 'https://downloads.hi5central.com/agent/latest/Hi5CentralAgent-linux-x64.tar.gz',
    version: '0.3.1',
  },
}

const PLATFORM_ORDER = ['windows', 'macos', 'linux']

function packageState(pkg) {
  if (pkg.revoked_at) return 'Revoked'
  if (new Date(pkg.expires_at).getTime() <= Date.now()) return 'Expired'
  if (Number(pkg.use_count) >= Number(pkg.max_uses)) return 'Used'
  return 'Ready'
}

function dateText(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function platformDescription(platform) {
  if (platform === 'windows') return 'Full Windows Agent including the existing remote, patching and device-management stack.'
  if (platform === 'macos') return 'Initial macOS Agent: enrollment, persistent service, telemetry and hardware/OS inventory. Remote permissions come next.'
  return 'Initial Linux Agent: enrollment, systemd service, telemetry and hardware/OS inventory. Remote control comes next.'
}

function platformDownloadLabel(platform) {
  if (platform === 'windows') return 'Download latest EXE'
  if (platform === 'macos') return 'Download macOS Agent'
  return 'Download Linux Agent'
}

export function RmmAgentDeployment() {
  const [packages, setPackages] = useState([])
  const [downloads, setDownloads] = useState(FALLBACK_DOWNLOADS)
  const [issued, setIssued] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function load() {
    setError('')
    const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, { credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to load Agent deployment settings.')
    setPackages(payload.packages || [])
    setDownloads({
      ...FALLBACK_DOWNLOADS,
      ...(payload.downloads || {}),
      windows: {
        ...FALLBACK_DOWNLOADS.windows,
        ...(payload.downloads?.windows || {}),
        url: payload.downloads?.windows?.url || payload.downloadUrl || FALLBACK_DOWNLOADS.windows.url,
      },
    })
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message))
  }, [])

  async function createPackage() {
    setBusy(true)
    setError('')
    setIssued(null)
    setCopied('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Hi5Central Agent test deployment', ttlMinutes: 60, maxUses: 1 }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to create enrollment package.')
      setIssued(payload)
      if (payload.downloads) setDownloads((current) => ({ ...current, ...payload.downloads }))
      await load()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setBusy(false)
    }
  }

  async function revokePackage(packageId) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(packageId)}/revoke`, {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to revoke enrollment package.')
      if (issued?.package?.id === packageId) setIssued(null)
      await load()
    } catch (revokeError) {
      setError(revokeError.message)
    } finally {
      setBusy(false)
    }
  }

  function commandFor(platform) {
    if (issued?.installCommands?.[platform]) return issued.installCommands[platform]
    if (platform === 'windows') return issued?.installCommand || ''
    return ''
  }

  async function copyInstallCommand(platform) {
    const command = commandFor(platform)
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopied(platform)
      window.setTimeout(() => setCopied((current) => current === platform ? '' : current), 1800)
    } catch {
      setError('Could not copy the install command. Select and copy it manually.')
    }
  }

  return (
    <>
      <div className="rmm-page-heading">
        <div>
          <span className="rmm-eyebrow">Administration</span>
          <h1>Agent deployment</h1>
          <p>Deploy Hi5Central Agent to Windows, macOS or Linux using secure, short-lived tenant enrollment packages.</p>
        </div>
        <button className="rmm-primary compact" disabled={busy} onClick={createPackage} type="button">
          <ShieldCheck size={16} /> {busy ? 'Working…' : 'Create one-use package'}
        </button>
      </div>

      {error ? <div className="rmm-agent-error">{error}</div> : null}

      <div className="rmm-agent-deployment-grid">
        {PLATFORM_ORDER.map((platform) => {
          const download = downloads[platform] || FALLBACK_DOWNLOADS[platform]
          return <section className="rmm-card rmm-agent-download-card" key={platform}>
            <span className="rmm-eyebrow">{download.label}</span>
            <h2>Hi5Central Agent</h2>
            <p>{platformDescription(platform)}</p>
            <a className="rmm-primary compact" href={download.url} rel="noreferrer">
              <Download size={16} /> {platformDownloadLabel(platform)}
            </a>
            <small>{download.version ? `Test build ${download.version} · ` : ''}{download.url}</small>
          </section>
        })}

        <section className="rmm-card rmm-agent-security-card">
          <span className="rmm-eyebrow">Enrollment security</span>
          <h2>Server-issued credentials</h2>
          <p>One enrollment package works on any supported OS. Each endpoint receives a unique device secret after enrollment.</p>
          <div><CheckCircle2 size={15} /> One-use by default</div>
          <div><CheckCircle2 size={15} /> 60 minute lifetime</div>
          <div><CheckCircle2 size={15} /> Per-device secret after enrollment</div>
        </section>
      </div>

      {issued ? <section className="rmm-card rmm-agent-issued-card">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Just created</span><h2>One-use install commands</h2></div>
          <button onClick={() => setIssued(null)} type="button"><X size={16} /></button>
        </div>
        <p>Use the command for the target operating system. The same one-use enrollment token is embedded in each command and is shown only in this response.</p>

        <div className="rmm-agent-command-list">
          {PLATFORM_ORDER.map((platform) => {
            const command = commandFor(platform)
            if (!command) return null
            const label = downloads[platform]?.label || FALLBACK_DOWNLOADS[platform].label
            return <div className="rmm-agent-command-group" key={platform}>
              <strong>{label}</strong>
              <div className="rmm-agent-command">
                <code>{command}</code>
                <button onClick={() => copyInstallCommand(platform)} type="button">
                  <Copy size={15} /> {copied === platform ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          })}
        </div>

        <small>Expires {dateText(issued.package?.expires_at)} · Package {issued.package?.id}</small>
      </section> : null}

      <section className="rmm-card rmm-agent-package-list">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Recent packages</span><h2>Enrollment package history</h2></div>
          <button disabled={busy} onClick={() => load().catch((loadError) => setError(loadError.message))} type="button">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <div className="rmm-agent-package-table">
          <div className="rmm-agent-package-row head"><span>Package</span><span>Status</span><span>Uses</span><span>Expires</span><span /></div>
          {packages.map((pkg) => {
            const state = packageState(pkg)
            return <div className="rmm-agent-package-row" key={pkg.id}>
              <span><strong>{pkg.label}</strong><small>…{pkg.token_hint}</small></span>
              <span>{state}</span>
              <span>{pkg.use_count}/{pkg.max_uses}</span>
              <span>{dateText(pkg.expires_at)}</span>
              <span>{state === 'Ready' ? <button disabled={busy} onClick={() => revokePackage(pkg.id)} type="button">Revoke</button> : null}</span>
            </div>
          })}
        </div>
        {!packages.length ? <div className="rmm-empty compact">
          <Download size={22} />
          <strong>No enrollment packages yet</strong>
          <span>Create a one-use package when you are ready to install the Agent.</span>
        </div> : null}
      </section>
    </>
  )
}
