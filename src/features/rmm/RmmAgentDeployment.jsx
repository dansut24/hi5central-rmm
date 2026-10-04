import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Download, RefreshCw, ShieldCheck, X } from 'lucide-react'

const API_BASE = window.__HI5_API_BASE__ || ''

const PLATFORM_FORMATS = {
  windows: [
    { format: 'exe', label: 'EXE' },
    { format: 'msi', label: 'MSI' },
  ],
  macos: [
    { format: 'pkg', label: 'PKG' },
    { format: 'dmg', label: 'DMG' },
    { format: 'app', label: 'APP' },
  ],
  linux: [
    { format: 'run', label: 'RUN' },
    { format: 'deb', label: 'DEB' },
    { format: 'rpm', label: 'RPM' },
  ],
}

const PLATFORM_META = {
  windows: {
    eyebrow: 'Windows x64',
    description: 'Tenant-bound Windows installers for interactive or software-deployment use.',
  },
  macos: {
    eyebrow: 'macOS',
    description: 'Tenant-bound native Apple installer formats. The deployment remains valid until revoked.',
  },
  linux: {
    eyebrow: 'Linux x64',
    description: 'Tenant-bound Linux bootstrap for Debian, Ubuntu, Mint, Fedora and compatible distributions.',
  },
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

function fileNameFor(packageId, format) {
  if (format === 'exe') return `Hi5CentralAgent-${packageId}-Windows.exe`
  if (format === 'msi') return `Hi5CentralAgent-${packageId}-Windows.msi`
  if (format === 'pkg') return `Hi5CentralAgent-${packageId}-macOS.pkg`
  if (format === 'dmg') return `Hi5CentralAgent-${packageId}-macOS.dmg`
  if (format === 'app') return `Hi5CentralAgent-${packageId}-macOS.app.zip`
  if (format === 'deb') return `hi5central-agent-${packageId}_amd64.deb`
  if (format === 'rpm') return `hi5central-agent-${packageId}.x86_64.rpm`
  return `Hi5CentralAgent-${packageId}-Linux.run`
}

export function RmmAgentDeployment() {
  const [packages, setPackages] = useState([])
  const [issued, setIssued] = useState(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState('')
  const [artifactStatus, setArtifactStatus] = useState({})
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function load() {
    setError('')
    const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, { credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to load Agent deployment settings.')
    setPackages(payload.packages || [])
  }

  async function loadArtifactStatus(packageId) {
    const response = await fetch(
      `${API_BASE}/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(packageId)}/artifacts`,
      { credentials: 'include' },
    )
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 410) return
      throw new Error(payload.error || 'Unable to load installer build status.')
    }
    setArtifactStatus((current) => ({ ...current, [packageId]: payload }))
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message))
  }, [])

  useEffect(() => {
    const activeIds = packages
      .filter((pkg) => pkg.persistent && !pkg.revoked_at)
      .map((pkg) => pkg.id)
    if (!activeIds.length) return undefined

    let stopped = false
    const refresh = async () => {
      await Promise.all(activeIds.map(async (packageId) => {
        try {
          const response = await fetch(
            `${API_BASE}/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(packageId)}/artifacts`,
            { credentials: 'include' },
          )
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || stopped) return
          setArtifactStatus((current) => ({ ...current, [packageId]: payload }))
        } catch {
          // Keep the last known build state; manual Refresh still surfaces API errors.
        }
      }))
    }

    refresh()
    const timer = window.setInterval(() => {
      const stillBuilding = activeIds.some((id) => artifactStatus[id]?.status !== 'ready')
      if (stillBuilding) refresh()
    }, 5000)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [packages])

  async function createPackage(persistent = true) {
    setBusy(true)
    setError('')
    setCopied('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persistent
          ? {
              label: 'Hi5Central bulk Agent deployment',
              persistent: true,
            }
          : {
              label: 'One-time Agent enrollment',
              persistent: false,
              ttlMinutes: 60,
              maxUses: 1,
            }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || (persistent
        ? 'Unable to create bulk Agent deployment.'
        : 'Unable to create one-time enrollment token.'))
      setIssued(payload)
      if (persistent && payload.package?.id) {
        setArtifactStatus((current) => ({
          ...current,
          [payload.package.id]: {
            status: 'building',
            readyCount: (payload.artifacts || []).filter((artifact) => artifact.ready).length,
            totalCount: (payload.artifacts || []).length,
            artifacts: payload.artifacts || [],
            buildError: payload.artifactBuildError || null,
          },
        }))
      }
      await load()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setBusy(false)
    }
  }

  async function retryArtifactBuild(packageId) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(packageId)}/build-artifacts`,
        { method: 'POST', credentials: 'include' },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to start installer build.')
      setArtifactStatus((current) => ({
        ...current,
        [packageId]: {
          ...(current[packageId] || {}),
          status: 'building',
          buildError: null,
          artifacts: payload.artifacts || current[packageId]?.artifacts || [],
        },
      }))
      await load()
    } catch (buildError) {
      setError(buildError.message)
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
      if (!response.ok) throw new Error(payload.error || 'Unable to revoke Agent deployment.')
      if (issued?.package?.id === packageId) setIssued(null)
      await load()
    } catch (revokeError) {
      setError(revokeError.message)
    } finally {
      setBusy(false)
    }
  }

  async function downloadArtifact(packageId, format) {
    const key = `${packageId}:${format}`
    setDownloading(key)
    setError('')
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/rmm/agent/enrollment-packages/${encodeURIComponent(packageId)}/artifacts/${encodeURIComponent(format)}`,
        { credentials: 'include' },
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        if (response.status === 409) {
          await loadArtifactStatus(packageId).catch(() => {})
        }
        throw new Error(payload.error || `Unable to download ${format.toUpperCase()} installer.`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileNameFor(packageId, format)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (downloadError) {
      setError(downloadError.message)
    } finally {
      setDownloading('')
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

  async function copyEnrollmentToken() {
    const token = issued?.enrollmentToken || ''
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied('token')
      window.setTimeout(() => setCopied((current) => current === 'token' ? '' : current), 1800)
    } catch {
      setError('Could not copy the enrollment token. Select and copy it manually.')
    }
  }

  function artifactButtons(packageId, platform) {
    const status = artifactStatus[packageId]
    return (
      <div className="rmm-agent-artifact-buttons">
        {PLATFORM_FORMATS[platform].map(({ format, label }) => {
          const key = `${packageId}:${format}`
          const artifact = status?.artifacts?.find((item) => item.format === format)
          const ready = artifact?.ready === true
          const checking = !status
          const failed = !ready && Boolean(status?.buildError)
          const building = !ready && !checking && !failed
          const buttonText = downloading === key
            ? 'Downloading…'
            : checking
              ? `${label} checking…`
              : failed
                ? `${label} unavailable`
                : building
                  ? `${label} building…`
                  : label
          return (
            <button
              className="rmm-primary compact"
              disabled={Boolean(downloading) || !ready}
              key={format}
              onClick={() => downloadArtifact(packageId, format)}
              title={ready
                ? `Download ${label}`
                : failed
                  ? status.buildError
                  : `${label} installer is building`}
              type="button"
            >
              <Download size={15} /> {buttonText}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="rmm-page-heading">
        <div>
          <span className="rmm-eyebrow">Administration</span>
          <h1>Agent deployment</h1>
          <p>Create revocable bulk installers for managed rollout, or issue a short-lived one-time token for a single device.</p>
        </div>
        <div className="rmm-agent-heading-actions">
          <button className="rmm-secondary compact" disabled={busy} onClick={() => createPackage(false)} type="button">
            <ShieldCheck size={16} /> {busy ? 'Working…' : 'Generate one-time token'}
          </button>
          <button className="rmm-primary compact" disabled={busy} onClick={() => createPackage(true)} type="button">
            <ShieldCheck size={16} /> {busy ? 'Working…' : 'Create bulk deployment'}
          </button>
        </div>
      </div>

      {error ? <div className="rmm-agent-error">{error}</div> : null}

      <div className="rmm-agent-deployment-grid">
        {Object.entries(PLATFORM_META).map(([platform, meta]) => (
          <section className="rmm-card rmm-agent-download-card" key={platform}>
            <span className="rmm-eyebrow">{meta.eyebrow}</span>
            <h2>Hi5Central Agent</h2>
            <p>{meta.description}</p>
            {issued?.package?.persistent && issued?.package?.id
              ? artifactButtons(issued.package.id, platform)
              : <small>Create a bulk deployment to enable reusable native downloads.</small>}
          </section>
        ))}

        <section className="rmm-card rmm-agent-security-card">
          <span className="rmm-eyebrow">Enrollment security</span>
          <h2>Two enrollment modes</h2>
          <p>Use a revocable bulk deployment for Intune, Ivanti, MDM/RMM and imaging. Use a one-time token for an individual manual enrollment.</p>
          <div><CheckCircle2 size={15} /> Bulk deployment remains reusable until explicitly revoked</div>
          <div><CheckCircle2 size={15} /> One-time token expires after 60 minutes and works once</div>
          <div><CheckCircle2 size={15} /> Every enrolled device receives its own unique device secret</div>
        </section>
      </div>

      {issued ? (
        <section className="rmm-card rmm-agent-issued-card">
          <div className="rmm-card-heading">
            <div>
              <span className="rmm-eyebrow">Just created</span>
              <h2>{issued.package?.persistent ? 'Bulk Agent deployment' : 'One-time enrollment token'}</h2>
            </div>
            <button onClick={() => setIssued(null)} type="button"><X size={16} /></button>
          </div>

          {issued.package?.persistent ? (
            <>
              <p>
                Deployment <strong>{issued.package?.id}</strong> is active until you revoke it.
                Download any installer format now or later from the deployment history.
              </p>
              {artifactStatus[issued.package?.id]?.buildError ? (
                <div className="rmm-agent-build-state error">
                  Installer build failed: {artifactStatus[issued.package.id].buildError}
                  <button disabled={busy} onClick={() => retryArtifactBuild(issued.package.id)} type="button">
                    Retry build
                  </button>
                </div>
              ) : artifactStatus[issued.package?.id]?.status !== 'ready' ? (
                <div className="rmm-agent-build-state">
                  Building native installers… {artifactStatus[issued.package?.id]?.readyCount || 0}/{artifactStatus[issued.package?.id]?.totalCount || 8} ready
                </div>
              ) : (
                <div className="rmm-agent-build-state ready">All native installers are ready to download.</div>
              )}
            </>
          ) : (
            <>
              <p>
                This token works once and expires at <strong>{dateText(issued.package?.expires_at)}</strong>.
                Use it for a single manual enrollment; generate another token for another device.
              </p>
              <div className="rmm-agent-command-group">
                <strong>Enrollment token</strong>
                <div className="rmm-agent-command">
                  <code>{issued.enrollmentToken}</code>
                  <button onClick={copyEnrollmentToken} type="button">
                    <Copy size={15} /> {copied === 'token' ? 'Copied' : 'Copy token'}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="rmm-agent-command-list">
            {Object.keys(PLATFORM_META).map((platform) => {
              const command = commandFor(platform)
              if (!command) return null
              return (
                <div className="rmm-agent-command-group" key={platform}>
                  <strong>{PLATFORM_META[platform].eyebrow} command</strong>
                  <div className="rmm-agent-command">
                    <code>{command}</code>
                    <button onClick={() => copyInstallCommand(platform)} type="button">
                      <Copy size={15} /> {copied === platform ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="rmm-card rmm-agent-package-list">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Deployments</span><h2>Tenant Agent installer history</h2></div>
          <button disabled={busy} onClick={() => load().catch((loadError) => setError(loadError.message))} type="button">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="rmm-agent-package-table">
          <div className="rmm-agent-package-row head"><span>Deployment</span><span>Status</span><span>Enrollments</span><span>Created</span><span /></div>
          {packages.map((pkg) => {
            const state = packageState(pkg)
            const build = artifactStatus[pkg.id]
            const buildLabel = !pkg.persistent || pkg.revoked_at
              ? ''
              : build?.buildError
                ? 'Installer build failed'
                : build?.status === 'ready'
                  ? 'Installers ready'
                  : build
                    ? `Building ${build.readyCount || 0}/${build.totalCount || 8}`
                    : 'Checking installers…'
            return (
              <div className="rmm-agent-package-row" key={pkg.id}>
                <span><strong>{pkg.label}</strong><small>{pkg.id}</small></span>
                <span><strong>{state}</strong>{buildLabel ? <small>{buildLabel}</small> : null}</span>
                <span>{pkg.use_count}</span>
                <span>{dateText(pkg.created_at)}</span>
                <span>
                  {pkg.persistent && !pkg.revoked_at ? (
                    <div className="rmm-agent-package-actions">
                      {artifactButtons(pkg.id, 'windows')}
                      {artifactButtons(pkg.id, 'macos')}
                      {artifactButtons(pkg.id, 'linux')}
                      {artifactStatus[pkg.id]?.buildError ? (
                        <button disabled={busy} onClick={() => retryArtifactBuild(pkg.id)} type="button">Retry build</button>
                      ) : null}
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
            <strong>No Agent deployments yet</strong>
            <span>Create a tenant deployment to generate reusable native installers.</span>
          </div>
        ) : null}
      </section>
    </>
  )
}