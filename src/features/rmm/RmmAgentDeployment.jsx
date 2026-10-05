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

function linuxInstallCommand(formatValue = '') {
  const format = String(formatValue || '').toLowerCase()
  const fileName = format === 'run'
    ? 'Hi5CentralAgentDeployment-Linux.run'
    : format === 'deb'
      ? 'hi5central-agent-deployment_amd64.deb'
      : format === 'rpm'
        ? 'hi5central-agent-deployment_x86_64.rpm'
        : ''
  const bundleName = ['run', 'deb', 'rpm'].includes(format)
    ? 'Hi5CentralAgentDeployment-Linux-' + format.toUpperCase() + '.tar.gz'
    : ''
  const rootCommand = format === 'run'
    ? 'if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then if command -v apt-get >/dev/null 2>&1; then DEBIAN_FRONTEND=noninteractive apt-get install -y curl tar; elif command -v dnf >/dev/null 2>&1; then dnf install -y curl tar; elif command -v yum >/dev/null 2>&1; then yum install -y curl tar; else echo "curl and tar are required before installing the Hi5Central Agent."; exit 1; fi; fi && chmod 0755 "$HI5_DIR/Hi5CentralAgentDeployment-Linux.run" && "$HI5_DIR/Hi5CentralAgentDeployment-Linux.run" --config "$HI5_DIR/Hi5CentralDeployment.json"'
    : format === 'deb'
      ? 'install -d -m 700 /etc/hi5central && install -m 600 "$HI5_DIR/Hi5CentralDeployment.json" /etc/hi5central/deployment.json && if command -v apt-get >/dev/null 2>&1; then DEBIAN_FRONTEND=noninteractive apt-get install -y "$HI5_DIR/hi5central-agent-deployment_amd64.deb"; else dpkg -i "$HI5_DIR/hi5central-agent-deployment_amd64.deb"; fi'
      : format === 'rpm'
        ? 'install -d -m 700 /etc/hi5central && install -m 600 "$HI5_DIR/Hi5CentralDeployment.json" /etc/hi5central/deployment.json && if command -v dnf >/dev/null 2>&1; then dnf install -y "$HI5_DIR/hi5central-agent-deployment_x86_64.rpm"; elif command -v yum >/dev/null 2>&1; then yum localinstall -y "$HI5_DIR/hi5central-agent-deployment_x86_64.rpm"; else rpm -U "$HI5_DIR/hi5central-agent-deployment_x86_64.rpm"; fi'
        : ''
  if (!fileName || !bundleName || !rootCommand) return ''
  return '(' + [
    'HI5_DIR="$PWD"',
    'HI5_EXTRACT=""',
    'HI5_BUNDLE="$HI5_DIR/' + bundleName + '"',
    'if { [ ! -f "$HI5_DIR/Hi5CentralDeployment.json" ] || [ ! -f "$HI5_DIR/' + fileName + '" ]; } && [ ! -f "$HI5_BUNDLE" ]; then HI5_DOWNLOADS="$(command -v xdg-user-dir >/dev/null 2>&1 && xdg-user-dir DOWNLOAD 2>/dev/null || true)"; [ -n "$HI5_DOWNLOADS" ] || HI5_DOWNLOADS="$HOME/Downloads"; HI5_DIR="$HI5_DOWNLOADS"; HI5_BUNDLE="$HI5_DIR/' + bundleName + '"; fi',
    'if { [ ! -f "$HI5_DIR/Hi5CentralDeployment.json" ] || [ ! -f "$HI5_DIR/' + fileName + '" ]; } && [ -f "$HI5_BUNDLE" ]; then command -v tar >/dev/null 2>&1 || { echo "tar is required to unpack the Hi5Central deployment bundle."; exit 1; }; HI5_EXTRACT="$(mktemp -d /tmp/hi5central-deploy.XXXXXX)" || exit 1; tar -xzf "$HI5_BUNDLE" -C "$HI5_EXTRACT" || { rm -rf "$HI5_EXTRACT"; exit 1; }; HI5_DIR="$HI5_EXTRACT"; fi',
    '[ -f "$HI5_DIR/Hi5CentralDeployment.json" ] && [ -f "$HI5_DIR/' + fileName + '" ] || { echo "Hi5Central deployment bundle or installer files were not found in the current folder or Downloads."; [ -n "$HI5_EXTRACT" ] && rm -rf "$HI5_EXTRACT"; exit 1; }',
    'HI5_INSTALL=' + JSON.stringify(rootCommand),
    'if [ "$(id -u)" -eq 0 ]; then HI5_DIR="$HI5_DIR" /bin/sh -c "$HI5_INSTALL"; HI5_STATUS=$?; elif command -v sudo >/dev/null 2>&1 && id -nG | tr " " "\\n" | grep -Eq "^(sudo|wheel)$"; then sudo /usr/bin/env HI5_DIR="$HI5_DIR" /bin/sh -c "$HI5_INSTALL"; HI5_STATUS=$?; elif command -v pkexec >/dev/null 2>&1; then pkexec /usr/bin/env HI5_DIR="$HI5_DIR" /bin/sh -c "$HI5_INSTALL"; HI5_STATUS=$?; else echo "Administrator privileges are required. Enter the root password when prompted."; su -c "HI5_DIR=\\\"$HI5_DIR\\\" /bin/sh -c \'$HI5_INSTALL\'"; HI5_STATUS=$?; fi',
    '[ -n "$HI5_EXTRACT" ] && rm -rf "$HI5_EXTRACT"',
    'exit "$HI5_STATUS"',
  ].join('; ') + ')'
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
  if (['run', 'deb', 'rpm'].includes(format)) {
    return linuxInstallCommand(format)
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

  function downloadDeploymentConfig(pkg) {
    setError('')
    if (!pkg?.id) return
    const path = pkg.deployment_config_url || `/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(pkg.id)}/deployment-config`
    downloadUrl(path.startsWith('http') ? path : `${API_BASE}${path}`, 'Hi5CentralDeployment.json')
  }

  function downloadInstallerBundle(pkg, installerUrl) {
    setError('')
    downloadUrl(installerUrl)
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
                <button className="rmm-primary compact" onClick={() => downloadInstallerBundle(issued.package, issued.installer?.url)} type="button">
                  <Download size={15} /> Download {String(issued.package.installer_format || '').toUpperCase()}{issued.package.installer_platform === 'linux' ? ' bundle' : (!['exe', 'msi'].includes(issued.package.installer_format) ? ' + config' : '')}
                </button>
                {!['exe', 'msi'].includes(issued.package.installer_format) ? (
                  <button className="rmm-secondary compact" onClick={() => downloadDeploymentConfig(issued.package)} type="button">
                    <Download size={15} /> Config only
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
                      <button className="rmm-secondary compact" onClick={() => downloadInstallerBundle(pkg, pkg.installer_url)} type="button">
                        <Download size={14} /> {String(pkg.installer_format || '').toUpperCase()}{pkg.installer_platform === 'linux' ? ' bundle' : (!['exe', 'msi'].includes(pkg.installer_format) ? ' + config' : '')}
                      </button>
                      {!['exe', 'msi'].includes(pkg.installer_format) ? (
                        <button className="rmm-secondary compact" onClick={() => downloadDeploymentConfig(pkg)} type="button">
                          <Download size={14} /> Config only
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