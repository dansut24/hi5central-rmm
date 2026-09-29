import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Download, RefreshCw, ShieldCheck, X } from 'lucide-react'

const API_BASE = window.__HI5_API_BASE__ || ''
const FALLBACK_DOWNLOAD = 'https://downloads.hi5central.com/agent/latest/Hi5CentralAgentSetup.exe'

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

export function RmmAgentDeployment() {
  const [packages, setPackages] = useState([])
  const [downloadUrl, setDownloadUrl] = useState(FALLBACK_DOWNLOAD)
  const [issued, setIssued] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  async function load() {
    setError('')
    const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, { credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to load Agent deployment settings.')
    setPackages(payload.packages || [])
    setDownloadUrl(payload.downloadUrl || FALLBACK_DOWNLOAD)
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message))
  }, [])

  async function createPackage() {
    setBusy(true)
    setError('')
    setIssued(null)
    setCopied(false)
    try {
      const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Windows Agent test deployment', ttlMinutes: 60, maxUses: 1 }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to create enrollment package.')
      setIssued(payload)
      setDownloadUrl(payload.downloadUrl || FALLBACK_DOWNLOAD)
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
        method: 'POST', credentials: 'include',
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
  async function copyInstallCommand() {
    if (!issued?.installCommand) return
    try {
      await navigator.clipboard.writeText(issued.installCommand)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the install command. Select and copy it manually.')
    }
  }

  return (
    <>
      <div className="rmm-page-heading">
        <div><span className="rmm-eyebrow">Administration</span><h1>Agent deployment</h1><p>Download the Windows agent and create short-lived, tenant-scoped enrollment packages.</p></div>
        <button className="rmm-primary compact" disabled={busy} onClick={createPackage} type="button"><ShieldCheck size={16} /> {busy ? 'Working…' : 'Create one-use package'}</button>
      </div>

      {error ? <div className="rmm-agent-error">{error}</div> : null}

      <div className="rmm-agent-deployment-grid">
        <section className="rmm-card rmm-agent-download-card">
          <span className="rmm-eyebrow">Windows x64</span>
          <h2>Hi5Central Agent</h2>
          <p>The installer is unsigned while testing. Windows may show a SmartScreen warning.</p>          <a className="rmm-primary compact" href={downloadUrl} rel="noreferrer"><Download size={16} /> Download latest EXE</a>
          <small>{downloadUrl}</small>
        </section>

        <section className="rmm-card rmm-agent-security-card">
          <span className="rmm-eyebrow">Enrollment security</span>
          <h2>Server-issued credentials</h2>
          <p>Enrollment tokens expire, are usage-limited and are stored only as hashes. Each device receives its own secret after enrollment.</p>
          <div><CheckCircle2 size={15} /> One-use by default</div>
          <div><CheckCircle2 size={15} /> 60 minute lifetime</div>
          <div><CheckCircle2 size={15} /> Per-device secret after enrollment</div>
        </section>
      </div>

      {issued ? <section className="rmm-card rmm-agent-issued-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Just created</span><h2>One-use install command</h2></div><button onClick={() => setIssued(null)} type="button"><X size={16} /></button></div>
        <p>Download the EXE, open an elevated PowerShell window in the download folder, then run this command. The raw enrollment token is shown only in this response.</p>
        <div className="rmm-agent-command"><code>{issued.installCommand}</code><button onClick={copyInstallCommand} type="button"><Copy size={15} /> {copied ? 'Copied' : 'Copy'}</button></div>
        <small>Expires {dateText(issued.package?.expires_at)} · Package {issued.package?.id}</small>
      </section> : null}

      <section className="rmm-card rmm-agent-package-list">        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Recent packages</span><h2>Enrollment package history</h2></div><button disabled={busy} onClick={() => load().catch((loadError) => setError(loadError.message))} type="button"><RefreshCw size={15} /> Refresh</button></div>
        <div className="rmm-agent-package-table">
          <div className="rmm-agent-package-row head"><span>Package</span><span>Status</span><span>Uses</span><span>Expires</span><span /></div>
          {packages.map((pkg) => {
            const state = packageState(pkg)
            return <div className="rmm-agent-package-row" key={pkg.id}><span><strong>{pkg.label}</strong><small>…{pkg.token_hint}</small></span><span>{state}</span><span>{pkg.use_count}/{pkg.max_uses}</span><span>{dateText(pkg.expires_at)}</span><span>{state === 'Ready' ? <button disabled={busy} onClick={() => revokePackage(pkg.id)} type="button">Revoke</button> : null}</span></div>
          })}
        </div>
        {!packages.length ? <div className="rmm-empty compact"><Download size={22} /><strong>No enrollment packages yet</strong><span>Create a one-use package when you are ready to install the Agent.</span></div> : null}
      </section>
    </>
  )
}
