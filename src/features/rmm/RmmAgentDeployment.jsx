import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Download, RefreshCw, ShieldCheck, X } from 'lucide-react'

const API_BASE = window.__HI5_API_BASE__ || ''

const PLATFORM_FORMATS = {
  windows: [
    { format: 'exe', label: 'EXE', detail: 'Single-file native installer for manual, scripted and managed deployment' },
    { format: 'msi', label: 'MSI', detail: 'Tenant-stamped Windows Installer for Intune, Ivanti, GPO and managed deployment' },
  ],
  macos: [
    { format: 'pkg', label: 'PKG', detail: 'Recommended for MDM and managed deployment' },
    { format: 'dmg', label: 'DMG', detail: 'Interactive macOS distribution' },
    { format: 'app', label: 'APP', detail: 'Interactive application bundle' },
  ],
  linux: [
    { format: 'run', label: 'RUN', detail: 'Cross-distribution bootstrap' },
    { format: 'deb', label: 'DEB', detail: 'Debian, Ubuntu and Mint' },
    { format: 'rpm', label: 'RPM', detail: 'Fedora, RHEL and compatible distributions' },
  ],
}

const PLATFORM_META = {
  windows: { label: 'Windows', architecture: 'x64' },
  macos: { label: 'macOS', architecture: 'Universal' },
  linux: { label: 'Linux', architecture: 'x64' },
}

function packageState(pkg) {
  if (pkg.revoked_at) return 'Revoked'
  if (pkg.persistent) return 'Active'
  if (new Date(pkg.expires_at).getTime() <= Date.now()) return 'Expired'
  if (Number(pkg.use_count) >= Number(pkg.max_uses)) return 'Used'
  return 'One-time active'
}

function dateText(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function selectionLabel(pkg) {
  if (!pkg?.persistent) return 'One-time token'
  const platform = PLATFORM_META[pkg.installer_platform]?.label || pkg.installer_platform || 'Agent'
  return `${platform} ${String(pkg.installer_format || '').toUpperCase()}`.trim()
}

function installCommand(pkg, serverCommand = '') {
  if (serverCommand) return serverCommand
  if (pkg?.install_command) return pkg.install_command
  const format = pkg?.installer_format
  if (format === 'exe') {
    return '.\\Hi5CentralAgent.exe --quiet'
  }
  if (format === 'msi') {
    return 'msiexec /i "Hi5CentralAgent.msi" /qn /norestart'
  }
  if (format === 'run') {
    return 'sudo ./Hi5CentralAgentDeployment-Linux.run --config ./Hi5CentralDeployment.json'
  }
  if (format === 'deb') {
    return 'sudo install -d -m 700 /etc/hi5central && sudo install -m 600 ./Hi5CentralDeployment.json /etc/hi5central/deployment.json && sudo dpkg -i ./hi5central-agent-deployment_amd64.deb'
  }
  if (format === 'rpm') {
    return 'sudo install -d -m 700 /etc/hi5central && sudo install -m 600 ./Hi5CentralDeployment.json /etc/hi5central/deployment.json && sudo rpm -U ./hi5central-agent-deployment_x86_64.rpm'
  }
  if (format === 'pkg') {
    return 'Place Hi5CentralDeployment.json at /Library/Application Support/Hi5Central/Deployment.json before installing the PKG.'
  }
  if (format === 'dmg' || format === 'app') {
    return 'Place Hi5CentralDeployment.json beside the app or in Downloads, then open the Hi5Central Agent app.'
  }
  return ''
}

export function RmmAgentDeployment() {
  const [packages, setPackages] = useState([])
  const [issued, setIssued] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('windows')
  const [selectedFormat, setSelectedFormat] = useState('exe')

  async function load() {
    setError('')
    const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, { credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to load Agent installer settings.')
    setPackages(payload.packages || [])
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message))
  }, [])

  function changePlatform(platform) {
    setError('')
    setSelectedPlatform(platform)
    setSelectedFormat(PLATFORM_FORMATS[platform]?.[0]?.format || '')
  }

  function changeFormat(format) {
    setError('')
    setSelectedFormat(format)
  }

  async function createInstaller() {
    setBusy(true)
    setError('')
    setCopied('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persistent: true,
          installerPlatform: selectedPlatform,
          installerFormat: selectedFormat,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to create tenant Agent installer.')
      setIssued(payload)
      await load()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setBusy(false)
    }
  }

  async function createOneTimeToken() {
    setBusy(true)
    setError('')
    setCopied('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'One-time Agent enrollment',
          persistent: false,
          ttlMinutes: 60,
          maxUses: 1,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to generate one-time enrollment token.')
      setIssued(payload)
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
      const response = await fetch(
        `${API_BASE}/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(packageId)}/revoke`,
        { method: 'POST', credentials: 'include' },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to revoke Agent installer.')
      if (issued?.package?.id === packageId) setIssued(null)
      await load()
    } catch (revokeError) {
      setError(revokeError.message)
    } finally {
      setBusy(false)
    }
  }

  function downloadUrl(url, fileName = '') {
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    if (fileName) anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  async function downloadDeploymentConfig(pkg) {
    setError('')
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(pkg.id)}/deployment-config`,
        { credentials: 'include' },
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to download deployment JSON.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      downloadUrl(url, 'Hi5CentralDeployment.json')
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  async function copyText(value, key) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => current === key ? '' : current), 1800)
    } catch {
      setError('Could not copy to the clipboard.')
    }
  }

  const selectedFormatMeta = PLATFORM_FORMATS[selectedPlatform]?.find((item) => item.format === selectedFormat)

  return (
    <>
      <div className="rmm-page-heading">
        <div>
          <span className="rmm-eyebrow">Administration</span>
          <h1>Agent deployment</h1>
          <p>Choose an operating system and installer type. Windows EXE and MSI are tenant-aware, revocable and can be deployed without a JSON sidecar.</p>
        </div>
        <button className="rmm-secondary compact" disabled={busy} onClick={createOneTimeToken} type="button">
          <ShieldCheck size={16} /> {busy ? 'Working…' : 'Generate one-time token'}
        </button>
      </div>

      {error ? <div className="rmm-agent-error">{error}</div> : null}

      <section className="rmm-card rmm-agent-builder">
        <div className="rmm-card-heading">
          <div>
            <span className="rmm-eyebrow">Tenant installer</span>
            <h2>Create Agent installer</h2>
          </div>
        </div>

        <div className="rmm-agent-builder-fields">
          <label>
            <span>Operating system</span>
            <select value={selectedPlatform} onChange={(event) => changePlatform(event.target.value)}>
              {Object.entries(PLATFORM_META).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label} · {meta.architecture}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Installer type</span>
            <select value={selectedFormat} onChange={(event) => changeFormat(event.target.value)}>
              {PLATFORM_FORMATS[selectedPlatform].map((item) => (
                <option key={item.format} value={item.format}>{item.label}</option>
              ))}
            </select>
            <small>{selectedFormatMeta?.detail}</small>
          </label>

          <button className="rmm-primary" disabled={busy || !selectedFormat} onClick={createInstaller} type="button">
            <Download size={16} /> {busy ? 'Creating…' : 'Create installer'}
          </button>
        </div>

        <div className="rmm-agent-shared-installer-note">
          <CheckCircle2 size={16} />
          <div>
            <strong>Tenant-stamped Windows EXE &amp; MSI</strong>
            <span>The VPS stamps the revocable tenant deployment credential into the selected Windows installer instantly. No JSON file, .NET runtime or per-tenant GitHub build is required.</span>
          </div>
        </div>
      </section>

      {issued ? (
        <section className="rmm-card rmm-agent-issued-card">
          <div className="rmm-card-heading">
            <div>
              <span className="rmm-eyebrow">Just created</span>
              <h2>{issued.package?.persistent ? selectionLabel(issued.package) : 'One-time enrollment token'}</h2>
            </div>
            <button onClick={() => setIssued(null)} type="button"><X size={16} /></button>
          </div>

          {issued.package?.persistent ? (
            <>
              <p>
                This installer can enrol any number of devices for this tenant until you revoke record <strong>{issued.package.id}</strong>.
                {issued.package.installer_format === 'exe'
                  ? ' The downloaded Hi5CentralAgent.exe already contains its revocable tenant credential and can be copied to an offline device.'
                  : ' This installer currently uses the deployment configuration shown below.'}
              </p>
              <div className="rmm-agent-issued-actions">
                <button className="rmm-primary compact" onClick={() => downloadUrl(issued.installer?.url)} type="button">
                  <Download size={15} /> Download {String(issued.package.installer_format || '').toUpperCase()}
                </button>
                {!['exe', 'msi'].includes(issued.package.installer_format) ? (
                  <button className="rmm-secondary compact" onClick={() => downloadDeploymentConfig(issued.package)} type="button">
                    <Download size={15} /> Download JSON
                  </button>
                ) : null}
                {installCommand(issued.package, issued.installCommand) ? (
                  <button className="rmm-secondary compact" onClick={() => copyText(installCommand(issued.package, issued.installCommand), 'command')} type="button">
                    <Copy size={15} /> {copied === 'command' ? 'Copied' : 'Copy deployment command'}
                  </button>
                ) : null}
                <button disabled={busy} onClick={() => revokePackage(issued.package.id)} type="button">Revoke</button>
              </div>
              <div className="rmm-agent-command">
                <code>{installCommand(issued.package, issued.installCommand)}</code>
              </div>
            </>
          ) : (
            <>
              <p>
                This token works once and expires at <strong>{dateText(issued.package?.expires_at)}</strong>.
              </p>
              <div className="rmm-agent-command">
                <code>{issued.enrollmentToken}</code>
                <button onClick={() => copyText(issued.enrollmentToken, 'token')} type="button">
                  <Copy size={15} /> {copied === 'token' ? 'Copied' : 'Copy token'}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <section className="rmm-card rmm-agent-package-list">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Installer records</span><h2>Tenant Agent installers</h2></div>
          <button disabled={busy} onClick={() => load().catch((loadError) => setError(loadError.message))} type="button">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="rmm-agent-package-table">
          <div className="rmm-agent-package-row head"><span>Installer</span><span>Status</span><span>Enrollments</span><span>Created</span><span /></div>
          {packages.map((pkg) => {
            const state = packageState(pkg)
            return (
              <div className="rmm-agent-package-row" key={pkg.id}>
                <span>
                  <strong>{pkg.persistent ? selectionLabel(pkg) : pkg.label}</strong>
                  <small>{pkg.id}</small>
                </span>
                <span><strong>{state}</strong></span>
                <span>{pkg.use_count}</span>
                <span>{dateText(pkg.created_at)}</span>
                <span>
                  {pkg.persistent && !pkg.revoked_at ? (
                    <div className="rmm-agent-package-actions">
                      <button className="rmm-secondary compact" onClick={() => downloadUrl(pkg.installer_url)} type="button">
                        <Download size={14} /> {String(pkg.installer_format || '').toUpperCase()}
                      </button>
                      {pkg.installer_format !== 'exe' ? (
                        <button className="rmm-secondary compact" onClick={() => downloadDeploymentConfig(pkg)} type="button">
                          <Download size={14} /> JSON
                        </button>
                      ) : null}
                      <button className="rmm-secondary compact" onClick={() => copyText(installCommand(pkg), `command:${pkg.id}`)} type="button">
                        <Copy size={14} /> {copied === `command:${pkg.id}` ? 'Copied' : 'Command'}
                      </button>
                      <button disabled={busy} onClick={() => revokePackage(pkg.id)} type="button">Revoke</button>
                    </div>
                  ) : state === 'One-time active' ? (
                    <button disabled={busy} onClick={() => revokePackage(pkg.id)} type="button">Revoke</button>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>

        {!packages.length ? (
          <div className="rmm-empty compact">
            <Download size={22} />
            <strong>No Agent installers yet</strong>
            <span>Select an operating system and installer type above.</span>
          </div>
        ) : null}
      </section>
    </>
  )
}