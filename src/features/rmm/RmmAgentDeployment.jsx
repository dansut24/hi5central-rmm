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
    version: '0.3.24',
  },
  linux: {
    label: 'Linux x64',
    url: 'https://downloads.hi5central.com/agent/latest/Hi5CentralAgent-linux-x64.tar.gz',
    version: '0.3.24',
  },
}

const PLATFORM_ORDER = ['windows', 'macos', 'linux']

function crc32(text) {
  const bytes = new TextEncoder().encode(text)
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear())
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = date.getDate()
  const month = date.getMonth() + 1
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { time, date: dosDate }
}

function executableZip(fileName, content) {
  const encoder = new TextEncoder()
  const name = encoder.encode(fileName)
  const data = encoder.encode(content)
  const checksum = crc32(content)
  const { time, date } = dosDateTime()
  const localSize = 30 + name.length + data.length
  const centralSize = 46 + name.length
  const buffer = new ArrayBuffer(localSize + centralSize + 22)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let offset = 0

  const u16 = (value) => { view.setUint16(offset, value, true); offset += 2 }
  const u32 = (value) => { view.setUint32(offset, value >>> 0, true); offset += 4 }
  const raw = (value) => { bytes.set(value, offset); offset += value.length }

  u32(0x04034b50)
  u16(20)
  u16(0)
  u16(0)
  u16(time)
  u16(date)
  u32(checksum)
  u32(data.length)
  u32(data.length)
  u16(name.length)
  u16(0)
  raw(name)
  raw(data)

  const centralOffset = offset
  u32(0x02014b50)
  u16(0x0314)
  u16(20)
  u16(0)
  u16(0)
  u16(time)
  u16(date)
  u32(checksum)
  u32(data.length)
  u32(data.length)
  u16(name.length)
  u16(0)
  u16(0)
  u16(0)
  u16(0)
  u32((0o100755 << 16) >>> 0)
  u32(0)
  raw(name)

  const centralLength = offset - centralOffset
  u32(0x06054b50)
  u16(0)
  u16(0)
  u16(1)
  u16(1)
  u32(centralLength)
  u32(centralOffset)
  u16(0)

  return new Blob([buffer], { type: 'application/zip' })
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function tenantInstallerScript(platform, command) {
  if (platform === 'macos') {
    return `#!/bin/bash
set -euo pipefail
echo "Hi5Central Agent - macOS"
echo "This installer is preconfigured for your Hi5Central tenant."
${command}
echo
echo "Hi5Central Agent installed and enrolled successfully."
echo "You can close this window."
read -r -p "Press Return to close..." _ || true
`
  }

  if (platform === 'linux') {
    return `#!/usr/bin/env bash
set -euo pipefail
echo "Hi5Central Agent - Linux"
echo "This installer is preconfigured for your Hi5Central tenant."
${command}
echo
echo "Hi5Central Agent installed and enrolled successfully."
read -r -p "Press Enter to close..." _ || true
`
  }

  if (platform === 'windows') {
    const exeUrl = FALLBACK_DOWNLOADS.windows.url
    return `@echo off
setlocal
set "HI5TMP=%TEMP%\\Hi5CentralAgent-%RANDOM%"
mkdir "%HI5TMP%" >nul 2>&1
cd /d "%HI5TMP%"
echo Hi5Central Agent - Windows
echo This installer is preconfigured for your Hi5Central tenant.
curl.exe -fL "${exeUrl}" -o Hi5CentralAgentSetup.exe
if errorlevel 1 (
  echo Failed to download Hi5Central Agent.
  pause
  exit /b 1
)
${command}
echo.
echo Hi5Central Agent installed and enrolled successfully.
pause
`
  }

  return ''
}

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

  async function downloadTenantInstaller(platform) {
    if (!['windows', 'macos', 'linux'].includes(platform)) return

    setBusy(true)
    setError('')
    setCopied('')
    try {
      const response = await fetch(`${API_BASE}/api/v1/rmm/agent/enrollment-packages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `${platform === 'macos' ? 'macOS' : 'Linux'} one-click Agent installer`,
          ttlMinutes: 60,
          maxUses: 1,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to create the tenant Agent installer.')

      const command = payload.installCommands?.[platform]
      if (!command) throw new Error('The server did not return an install command for this platform.')

      const script = tenantInstallerScript(platform, command)
      const scriptName = platform === 'macos'
        ? 'Install Hi5Central Agent.command'
        : platform === 'linux'
          ? 'Install Hi5Central Agent.sh'
          : 'Install Hi5Central Agent.cmd'
      const zipName = platform === 'macos'
        ? 'Hi5CentralAgent-macOS-tenant.zip'
        : platform === 'linux'
          ? 'Hi5CentralAgent-Linux-tenant.zip'
          : 'Hi5CentralAgent-Windows-tenant.zip'

      downloadBlob(executableZip(scriptName, script), zipName)
      setIssued(payload)
      if (payload.downloads) setDownloads((current) => ({ ...current, ...payload.downloads }))
      await load()
    } catch (downloadError) {
      setError(downloadError.message)
    } finally {
      setBusy(false)
    }
  }

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
            <button className="rmm-primary compact" disabled={busy} onClick={() => downloadTenantInstaller(platform)} type="button">
              <Download size={16} /> Download tenant installer
            </button>
            <small>{`Creates a one-use installer bound to the current tenant. Base build ${download.version || 'current'}.`}</small>
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
