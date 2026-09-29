import { useEffect, useMemo, useState } from 'react'
import { RmmPlatformApp } from '../features/rmm/RmmPlatformApp.jsx'
import { resolveTenantSurface } from '../lib/tenantSurface.js'
import './ProductionWorkspaceBootstrap.css'

const API_BASE = window.__HI5_API_BASE__

function sessionHasPermission(session, permission) {
  const effective = session?.access?.effectivePermissions || []
  const grants = session?.access?.permissions || []
  if (effective.includes(permission) || grants.includes('*') || grants.includes(permission)) return true
  return grants.some((grant) => grant.endsWith('*') && permission.startsWith(grant.slice(0, -1)))
}

function deviceToRmm(row) {
  const inventory = row.agent_inventory_payload && typeof row.agent_inventory_payload === 'object' ? row.agent_inventory_payload : {}
  const summary = inventory.summary || {}
  const security = inventory.security || {}
  const hardware = inventory.hardware || {}
  const cpuInfo = inventory.cpu || {}
  const osInfo = inventory.os || {}
  const battery = inventory.battery || {}
  const displayInfo = inventory.displays || {}
  const gpus = Array.isArray(inventory.gpu) ? inventory.gpu : (Array.isArray(displayInfo.gpus) ? displayInfo.gpus : [])
  const storageVolumes = Array.isArray(inventory.storage) ? inventory.storage : []
  const warrantyIdentity = inventory.warranty_identity || {}
  const software = Array.isArray(inventory.software?.items) ? inventory.software.items : []
  const windowsPendingRaw = inventory.windows_updates?.pending_count
  const windowsPendingReported = windowsPendingRaw !== null && windowsPendingRaw !== undefined && Number.isFinite(Number(windowsPendingRaw))
  const windowsPending = windowsPendingReported ? Math.max(0, Number(windowsPendingRaw)) : 0
  const softwarePatchCurrent = Math.max(0, Number(row.agent_patch_current_count || 0))
  const softwarePatchPending = Math.max(0, Number(row.agent_patch_pending_count || 0))
  const softwarePatchTotal = Math.max(0, Number(row.agent_patch_total_count || 0))
  const combinedPatchTotal = softwarePatchTotal + windowsPending
  const patchCompliance = combinedPatchTotal > 0 ? Math.round((100 * softwarePatchCurrent) / combinedPatchTotal) : null
  const total = Number(row.storage_total_bytes || summary.storage_total_bytes || 0)
  const free = Number(row.storage_free_bytes || summary.storage_free_bytes || 0)
  const hasAgent = Boolean(row.agent_device_id)
  const compliant = String(row.compliance_state || '').toLowerCase() === 'compliant'
  const uptimeSeconds = row.agent_uptime_seconds == null ? null : Number(row.agent_uptime_seconds)
  const memoryTotal = Number(row.agent_memory_total_bytes || row.memory_bytes || summary.total_memory_bytes || inventory.memory?.total_bytes || 0)
  const memoryUsed = Number(row.agent_memory_used_bytes || inventory.memory?.used_bytes || 0)
  const uptime = uptimeSeconds == null ? 'Not reported' : uptimeSeconds >= 86400 ? `${Math.floor(uptimeSeconds / 86400)}d ${Math.floor((uptimeSeconds % 86400) / 3600)}h` : `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
  return {
    id: row.reference, agentDeviceId: row.agent_device_id || '', rmmReference: row.rmm_reference || '', rmmMatchMethod: row.rmm_match_method || '',
    sourceDeviceId: row.source_device_id, directoryDeviceId: row.directory_device_id, name: row.name,
    type: String(row.operating_system || '').toLowerCase().includes('windows') ? 'Windows device' : (row.platform || 'Device'),
    platform: row.platform || row.operating_system || 'Unknown', os: [row.operating_system, row.os_version].filter(Boolean).join(' '), edition: '', osBuild: row.os_version || '',
    user: row.assigned_person_name || row.user_display_name || row.agent_active_user || 'Unassigned', userEmail: row.assigned_person_email || row.user_principal_name || '', assignedPersonId: row.assigned_person_id || '',
    site: row.assigned_site_name || 'Unassigned', siteId: row.assigned_site_external_key || '', group: hasAgent ? 'Hi5Central Agent' : 'Microsoft Intune', groupId: hasAgent ? 'agent' : 'intune', policy: hasAgent ? 'Agent managed' : 'Intune managed',
    sourceTenant: row.source_connection_name || '', sourceDirectoryTenantId: row.source_directory_tenant_id || '', sourceConnectionId: row.microsoft_connection_id || '',
    status: hasAgent ? (row.agent_online ? 'Online' : 'Offline') : 'Managed', health: hasAgent ? (row.agent_online ? 'Healthy' : 'Warning') : (compliant ? 'Healthy' : 'Warning'), alerts: hasAgent && !row.agent_online ? 1 : (compliant ? 0 : 1),
    cpu: row.agent_cpu_percent == null ? null : Math.round(Number(row.agent_cpu_percent)), memory: row.agent_memory_used_percent == null ? null : Math.round(Number(row.agent_memory_used_percent)), disk: row.agent_disk_used_percent == null ? null : Math.round(Number(row.agent_disk_used_percent)),
    patchCompliance, softwarePatchCompliance: row.agent_software_patch_compliance == null ? null : Number(row.agent_software_patch_compliance),
    pendingPatches: softwarePatchPending + windowsPending, pendingSoftwarePatches: softwarePatchPending, pendingWindowsPatches: windowsPendingReported ? windowsPending : null,
    patchCurrentCount: softwarePatchCurrent, patchTotalCount: softwarePatchTotal, patchStateReported: softwarePatchTotal > 0 || windowsPendingReported,
    manufacturer: row.manufacturer || hardware.manufacturer || summary.manufacturer || 'Unknown', model: row.model || hardware.model || summary.model || 'Unknown', serial: row.serial_number || hardware.serial_number || summary.serial_number || 'Not reported', processor: cpuInfo.name || 'Not reported',
    cpuVendor: cpuInfo.vendor || '', cpuCores: cpuInfo.cores ?? null, cpuLogicalProcessors: cpuInfo.logical_processors ?? null, cpuMaxClockMhz: cpuInfo.max_clock_mhz ?? null,
    architecture: osInfo.architecture || '', osDisplayVersion: osInfo.display_version || '', osInstallDate: osInfo.install_date || '', deviceUuid: hardware.device_uuid || warrantyIdentity.device_uuid || '', systemSku: hardware.sku || '', systemFamily: hardware.system_family || '',
    biosDate: hardware.bios_date || warrantyIdentity.bios_date || '', battery, gpus, displayInfo, storageVolumes,
    memoryModules: Array.isArray(inventory.memory_modules) ? inventory.memory_modules : [],
    motherboard: inventory.motherboard || {},
    physicalDisks: Array.isArray(inventory.physical_disks) ? inventory.physical_disks : [],
    monitors: Array.isArray(inventory.monitors) ? inventory.monitors : [],
    drivers: Array.isArray(inventory.drivers) ? inventory.drivers : [],
    problemDevices: Array.isArray(inventory.problem_devices) ? inventory.problem_devices : [],
    installedHotfixes: Array.isArray(inventory.installed_hotfixes) ? inventory.installed_hotfixes : [],
    windowsLicensing: inventory.windows_licensing || {},
    rebootState: inventory.reboot_state || {},
    startupItems: Array.isArray(inventory.startup_items) ? inventory.startup_items : [],
    scheduledTasks: Array.isArray(inventory.scheduled_tasks) ? inventory.scheduled_tasks : [],
    localGroups: Array.isArray(inventory.local_groups) ? inventory.local_groups : [],
    printers: Array.isArray(inventory.printers) ? inventory.printers : [],
    usbDevices: Array.isArray(inventory.usb_devices) ? inventory.usb_devices : [],
    optionalFeatures: Array.isArray(inventory.optional_features) ? inventory.optional_features : [],
    powerPlan: inventory.power_plan || '',
    networkProfiles: Array.isArray(inventory.network_profiles) ? inventory.network_profiles : [],
    networkConfigurations: Array.isArray(inventory.network_configurations) ? inventory.network_configurations : Array.isArray(inventory.network?.configurations) ? inventory.network.configurations : [],
    wifiInterfaces: Array.isArray(inventory.wifi_interfaces) ? inventory.wifi_interfaces : Array.isArray(inventory.network?.wifi_interfaces) ? inventory.network.wifi_interfaces : [],
    defaultRoutes: Array.isArray(inventory.default_routes) ? inventory.default_routes : Array.isArray(inventory.network?.default_routes) ? inventory.network.default_routes : [],
    directoryJoin: inventory.directory_join || {},
    machineCertificates: Array.isArray(inventory.machine_certificates) ? inventory.machine_certificates : [],
    virtualization: inventory.virtualization || {},
    localUsers: Array.isArray(inventory.local_users?.users) ? inventory.local_users.users : [],
    bitlockerVolumes: Array.isArray(security.bitlocker) ? security.bitlocker : [],
    defender: security.defender || {},
    firewallProfiles: Array.isArray(security.firewall_profiles) ? security.firewall_profiles : [],
    tpmDetail: security.tpm || {},
    deepInventoryCollectedAt: inventory.deep_inventory_collected_at || '',
    lastSeen: row.agent_last_telemetry_at ? new Date(row.agent_last_telemetry_at).toLocaleString() : (row.source_last_sync_at ? new Date(row.source_last_sync_at).toLocaleString() : 'Not reported'), uptime, lastBoot: inventory.os?.last_boot || 'Not reported',
    managedSince: row.enrolled_at ? new Date(row.enrolled_at).toLocaleDateString() : 'Not reported', agent: hasAgent ? (row.agent_version ? `Hi5Central ${row.agent_version}` : 'Hi5Central Agent') : (row.management_agent || 'Intune'), agentChannel: hasAgent ? 'Stable' : 'Microsoft',
    storageGb: total ? Math.round(total / (1024 ** 3)) : null, storageFreeGb: free ? Math.round(free / (1024 ** 3)) : null, ramGb: memoryTotal > 0 ? Math.round(memoryTotal / (1024 ** 3)) : null, memoryTotalBytes: memoryTotal || null, memoryUsedBytes: memoryUsed || null,
    security: {
      encryptionState: security.bitlocker_status === 'On' ? 'Protected' : security.bitlocker_status === 'Off' ? 'Unprotected' : (row.is_encrypted ? 'Protected' : 'Not reported'),
      encryption: security.bitlocker_status === 'On' ? 'BitLocker enabled' : security.bitlocker_status === 'Off' ? 'BitLocker protection is off' : (row.is_encrypted ? 'Intune reports encrypted' : 'Not reported'),
      avState: security.defender_enabled === true ? 'Enabled' : security.defender_enabled === false ? 'Disabled' : 'Not reported',
      av: security.defender_realtime_enabled === true ? 'Real-time protection enabled' : security.defender_realtime_enabled === false ? 'Real-time protection disabled' : 'Not reported',
      firewall: security.firewall_enabled === true ? 'Enabled' : security.firewall_enabled === false ? 'Disabled' : 'Not reported',
      secureBoot: security.secure_boot || 'Not reported',
      edrState: security.mde_present === true ? (security.mde_service_state === 'Running' ? 'Enabled' : security.mde_service_state || 'Present') : security.mde_present === false ? 'Not installed' : 'Not reported',
      edr: security.mde_present === true ? 'Microsoft Defender for Endpoint Sense service ' + String(security.mde_service_state || 'present').toLowerCase() : security.mde_present === false ? 'Microsoft Defender for Endpoint service not installed' : 'Not reported',
      tpm: security.tpm_present === true ? 'Present' : security.tpm_present === false ? 'Not present' : 'Not reported',
    },
    securityDetails: security,
    tags: [row.source === 'intune' ? 'Intune' : null, hasAgent ? 'Hi5Central Agent' : null, row.source_connection_name, row.compliance_state].filter(Boolean),
    installedSoftware: software.map((app) => ({
      name: app.name, version: app.version || '', publisher: app.publisher || '', installed: app.install_date || '', managed: false,
      registryKey: app.registry_key || '', scope: app.scope || '', userSid: app.user_sid || '', userProfile: app.user_profile || '',
      uninstallString: app.uninstall_string || '', quietUninstallString: app.quiet_uninstall_string || '',
      estimatedSizeKb: app.estimated_size_kb ?? null, installLocation: app.install_location || '',
    })),
    patches: Array.isArray(inventory.windows_updates?.updates) ? inventory.windows_updates.updates : [],
    activity: [], networkAdapters: Array.isArray(inventory.network?.adapters) ? inventory.network.adapters : [], relatedRecordIds: [],
    ip: inventory.network?.primary_ipv4 || '', publicIp: inventory.network?.public_ip || '', gateway: inventory.network?.gateway || '', mac: inventory.network?.mac || '',
    bios: [inventory.hardware?.bios_vendor, inventory.hardware?.bios_version].filter(Boolean).join(' '), warranty: 'Not reported',
    timeZone: inventory.os?.timezone || 'Not reported', inventory,
    complianceState: row.compliance_state || 'unknown', managementState: row.management_state || 'managed', enrollmentType: row.enrollment_type || '', categoryName: row.category_name || '',
  }
}

export function ProductionRmmBootstrap() {
  const surface = useMemo(() => resolveTenantSurface(), [])
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [theme, setTheme] = useState('light')
  const [devices, setDevices] = useState([])
  const [sites, setSites] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [passwordStep, setPasswordStep] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/v1/auth/session`, { credentials: 'include' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (active && response.ok && payload?.tenant?.slug === surface.tenantSlug) setSession(payload)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [surface.tenantSlug])


  useEffect(() => {
    if (!session) return undefined
    let active = true

    async function loadEstate(initial = false) {
      if (initial) setDataLoading(true)
      try {
        const [deviceResult, organisationResult] = await Promise.all([
          fetch(`${API_BASE}/api/v1/rmm/devices`, { credentials: 'include', cache: 'no-store' }).then(async (response) => ({ response, payload: await response.json().catch(() => ({})) })),
          fetch(`${API_BASE}/api/v1/organisation`, { credentials: 'include', cache: 'no-store' }).then(async (response) => ({ response, payload: await response.json().catch(() => ({})) })),
        ])
        if (!active) return
        if (deviceResult.response.ok) setDevices((deviceResult.payload.devices || []).map(deviceToRmm))
        else if (initial) setDevices([])
        if (organisationResult.response.ok) setSites((organisationResult.payload.sites || []).filter((site) => site.active !== false))
        else if (initial) setSites([])
      } catch {
        if (!active || !initial) return
        setDevices([])
        setSites([])
      } finally {
        if (active && initial) setDataLoading(false)
      }
    }

    loadEstate(true)
    const timer = window.setInterval(() => loadEstate(false), 15000)
    const refreshOnFocus = () => loadEstate(false)
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [session])

  async function login(event) {
    event.preventDefault()
    setError('')
    const email = form.email.trim()
    if (!email) { setError('Enter your email address to continue.'); return }
    if (!passwordStep) {
      setSubmitting(true)
      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/microsoft/discover/${encodeURIComponent(surface.tenantSlug)}?email=${encodeURIComponent(email)}`)
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload.method === 'microsoft') {
          const params = new URLSearchParams({ tenantSlug: surface.tenantSlug, surface: 'rmm', returnTo: '/devices', loginHint: email })
          window.location.href = `${API_BASE}/api/v1/auth/microsoft/start?${params.toString()}`
          return
        }
        setPasswordStep(true)
      } finally { setSubmitting(false) }
      return
    }
    setSubmitting(true)
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug: surface.tenantSlug, email, password: form.password }),
    })
    const payload = await response.json().catch(() => ({}))
    setSubmitting(false)
    if (!response.ok) { setError(payload.error || 'Sign in failed.'); return }
    setSession(payload)
  }

  async function saveSites(nextSites) {
    const response = await fetch(`${API_BASE}/api/v1/organisation/sites`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: nextSites }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to save organisation sites.')
    const updated = (payload.sites || []).filter((site) => site.active !== false)
    setSites(updated)
    return updated
  }

  async function logout() {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setDevices([])
    setSites([])
    setDataLoading(false)
    setSession(null)
  }

  if (loading) return <main className="production-auth-shell"><div className="production-auth-card">Opening RMM…</div></main>
  if (!session) {
    return (
      <main className="production-auth-shell">
        <form className="production-auth-card" onSubmit={login}>
          <img src="/hi5central-logo.png" alt="Hi5Central" />
          <h1>RMM sign in</h1>
          <p>Enter your email address and Hi5Central will use the sign-in method configured by {surface.tenantName || surface.tenantSlug}.</p>
          <label><span>Email address</span><input type="email" autoComplete="username" required value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); if (passwordStep) setPasswordStep(false); setError('') }} /></label>
          {passwordStep ? <label><span>Password</span><input type="password" autoComplete="current-password" required autoFocus value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label> : <p className="production-auth-method-note">Your organisation may continue with Microsoft 365 or ask for your Hi5Central password.</p>}
          {error ? <div className="production-auth-error">{error}</div> : null}
          <button disabled={submitting} type="submit">{submitting ? (passwordStep ? 'Signing in…' : 'Checking sign-in…') : passwordStep ? 'Sign in' : 'Continue'}</button>
          {passwordStep ? <button className="production-auth-secondary-action" type="button" onClick={() => { setPasswordStep(false); setForm((current) => ({ ...current, password: '' })); setError('') }}>Use a different email</button> : null}
        </form>
      </main>
    )
  }

  return (
    <RmmPlatformApp
      accent="amber"
      dataLoading={dataLoading}
      devices={devices}
      sites={sites}
      canRemote={sessionHasPermission(session, 'rmm.devices.remote')}
      canBackstageRemote={sessionHasPermission(session, 'rmm.devices.backstage')}
      canAudit={sessionHasPermission(session, 'rmm.audit.view') || sessionHasPermission(session, 'audit.view')}
      currentUser={{ role: 'rmm', name: session.user?.name || session.user?.email || 'RMM user', username: session.user?.email || '' }}
      handleLogout={logout}
      onCreateItsmIncident={() => null}
      onSitesChange={saveSites}
      setTheme={setTheme}
      tenantName={session.tenant?.companyName || surface.tenantName || surface.tenantSlug}
      theme={theme}
      tickets={[]}
    />
  )
}
