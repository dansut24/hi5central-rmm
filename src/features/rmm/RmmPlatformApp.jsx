import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Code2,
  Cable,
  Cpu,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  History,
  KeyRound,
  GitBranch,
  Laptop,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  Network,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Tag,
  TerminalSquare,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import {
  rmmAlerts,
  rmmDevices,
} from '../../data/rmmData.js'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import { resolveTenantSurface, rmmDevicePath, rmmPath, rmmRouteFromLocation } from '../../lib/tenantSurface.js'
import { loadRmmScope } from '../../lib/rmmScopeApi.js'
import { deploySoftwarePatch, deploySoftwarePatches, loadDevicePatchPolicyResolution, loadRmmPatching, rejectDeviceSoftwarePatch, restoreDeviceSoftwarePatch } from '../../lib/rmmPatchingApi.js'
import {
  RmmDeviceGroupsManagement,
  RmmDeviceInventory,
  RmmSitesManagement,
} from './RmmEstateManagement.jsx'
import { RmmMonitoringPolicies } from './RmmMonitoringPolicies.jsx'
import { RmmNetworkDiscovery } from './RmmNetworkDiscovery.jsx'
import { RmmPatching as RmmPatchingWorkspace } from './RmmPatching.jsx'
import { RmmAgentDeployment } from './RmmAgentDeployment.jsx'
import { RmmAutomation } from './RmmAutomationWorkspace.jsx'
import { RmmConnect } from './RmmConnect.jsx'
import { DeviceActivityTimeline, DeviceJobsPanel, RmmAuditActivity, prefetchDeviceHistory } from './RmmActivityViews.jsx'
import { detectRemoteViewerClient } from './remoteViewerClient.js'
import { RmmDeviceToolWorkspace } from './RmmDeviceTools.jsx'
import './RmmPlatformApp.css'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Workspace' },
  { id: 'devices', label: 'Devices', icon: Monitor, section: 'Manage' },
  { id: 'sites', label: 'Sites', icon: MapPin, section: 'Manage' },
  { id: 'groups', label: 'Device groups', icon: Users, section: 'Manage' },
  { id: 'network-discovery', label: 'Network discovery', icon: Network, section: 'Manage' },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, section: 'Manage' },
  { id: 'connect', label: 'Connect', icon: Cable, section: 'Operate', requiresRemote: true },
  { id: 'patching', label: 'Patching', icon: ShieldCheck, section: 'Operate' },
  { id: 'software', label: 'Software', icon: PackageCheck, section: 'Operate' },
  { id: 'automation', label: 'Automation', icon: Code2, section: 'Operate' },
  { id: 'policies', label: 'Policies', icon: SlidersHorizontal, section: 'Configure' },
  { id: 'reports', label: 'Reports', icon: BarChart3, section: 'Insights' },
  { id: 'activity-audit', label: 'Activity audit', icon: History, section: 'Administration', requiresAudit: true },
  { id: 'agent-deployment', label: 'Agent deployment', icon: Download, section: 'Administration' },
  { id: 'settings', label: 'RMM settings', icon: Settings, section: 'Administration' },
]

const pageMeta = {
  dashboard: ['RMM overview', 'Dashboard', 'Health, alerts, automation and fleet activity across your managed estate.'],
  devices: ['Estate', 'Devices', 'Search and manage every endpoint, server and monitored network device.'],
  sites: ['Estate structure', 'Sites', 'Organise devices by location and define default management scope.'],
  groups: ['Estate structure', 'Device groups', 'Build static and dynamic scopes for policy and deployment targeting.'],
  'network-discovery': ['Network management', 'Network discovery', 'Discover and inventory SNMP devices through managed on-site Agent probes.'],
  alerts: ['Monitoring', 'Alerts', 'Prioritise active monitoring conditions and device health exceptions.'],
  remote: ['Support', 'Remote access', 'Connect to managed endpoints using remote desktop, terminal and file tools.'],
  connect: ['Support', 'Hi5Central Connect', 'Create one-time support codes for unmanaged Windows computers.'],
  patching: ['Maintenance', 'Patching', 'Track update compliance, maintenance rings and deployment failures.'],
  software: ['Applications', 'Software', 'Understand installed software and manage application deployments.'],
  automation: ['Automation', 'Scripts & automation', 'Run trusted scripts, recurring maintenance and remediation actions.'],
  policies: ['Configuration', 'Policies', 'Control monitoring, maintenance, agent and security settings by scope.'],
  reports: ['Insights', 'Reports', 'Fleet health, patch compliance, software and operational reporting.'],
  'activity-audit': ['Administration', 'Activity audit', 'Search the tenant-wide RMM operational and technician audit history.'],
  'agent-deployment': ['Administration', 'Agent deployment', 'Download the Windows agent and create secure, expiring enrollment packages.'],
  settings: ['Administration', 'RMM settings', 'Agent, sites, credentials, maintenance and integration configuration.'],
}

function deviceIsOnline(device) {
  return Boolean(device?.agentDeviceId) && String(device?.status || '').toLowerCase() === 'online'
}

function healthClass(value = '') {
  const normalized = String(value).toLowerCase()
  if (['critical', 'failed'].includes(normalized)) return 'critical'
  if (['warning', 'high'].includes(normalized)) return 'warning'
  if (['offline'].includes(normalized)) return 'offline'
  if (['healthy', 'online', 'completed', 'active'].includes(normalized)) return 'healthy'
  if (['running'].includes(normalized)) return 'running'
  return 'neutral'
}

function metricTone(value, warning = 75, critical = 90) {
  if (Number(value) >= critical) return 'critical'
  if (Number(value) >= warning) return 'warning'
  return 'healthy'
}

function DeviceIcon({ device, size = 18 }) {
  if (String(device?.type).toLowerCase().includes('server')) return <Server size={size} />
  if (String(device?.type).toLowerCase().includes('network')) return <Network size={size} />
  if (String(device?.type).toLowerCase().includes('mac')) return <Laptop size={size} />
  return <Monitor size={size} />
}

function StatusPill({ children, tone }) {
  return <span className={`rmm-status-pill ${tone || healthClass(children)}`}>{children}</span>
}

function recordPrefix(ticket) {
  if (ticket?.type === 'Incident') return 'incidents'
  if (ticket?.type === 'Service Request') return 'requests'
  if (ticket?.type === 'Problem') return 'problems'
  if (ticket?.type === 'Change') return 'changes'
  const id = String(ticket?.id || '')
  if (id.startsWith('INC-')) return 'incidents'
  if (id.startsWith('REQ-')) return 'requests'
  if (id.startsWith('PRB-')) return 'problems'
  if (id.startsWith('CHG-')) return 'changes'
  return 'tickets'
}

function itsmRecordHref(ticket) {
  const path = `/${recordPrefix(ticket)}/${encodeURIComponent(ticket.id)}`
  const surface = resolveTenantSurface()
  const deployment = deploymentConfig()
  if (deployment.tenancyMode === 'single') return path
  if (surface?.canonical && surface?.tenantSlug) {
    return `https://${surface.tenantSlug}.${deployment.rootDomain}${path}`
  }
  return path
}

function securityTone(value = '') {
  const normalized = String(value).toLowerCase()
  if (normalized.includes('disabled') || normalized.includes('not protected') || normalized.includes('not onboarded')) return 'critical'
  if (normalized.includes('warning') || normalized.includes('attention')) return 'warning'
  if (normalized.includes('protected') || normalized.includes('healthy') || normalized.includes('enabled') || normalized.includes('ready') || normalized.includes('onboarded') || normalized.includes('full security')) return 'healthy'
  return 'neutral'
}

function RmmSidebar({ activeView, canAudit = false, canRemote = false, mobileOpen, navigate, onClose, tenantName }) {
  const visibleNavigation = navigation.filter((item) => (!item.requiresAudit || canAudit) && (!item.requiresRemote || canRemote))
  const sections = [...new Set(visibleNavigation.map((item) => item.section))]
  return <><button className={`rmm-sidebar-backdrop ${mobileOpen ? 'is-open' : ''}`} aria-label="Close navigation" onClick={onClose} type="button" /><aside className={`rmm-sidebar ${mobileOpen ? 'mobile-open' : ''}`}><div className="rmm-sidebar-brand"><img src={`${import.meta.env.BASE_URL}hi5central-logo.png`} alt="Hi5Central" /><div><strong>{tenantName}</strong><span>RMM</span></div><button className="rmm-mobile-close" onClick={onClose} type="button"><X size={19} /></button></div><nav className="rmm-nav">{sections.map((section) => <div className="rmm-nav-section" key={section}><span>{section}</span>{visibleNavigation.filter((item) => item.section === section).map(({ id, label, icon: Icon }) => <button className={activeView === id ? 'active' : ''} key={id} onClick={() => navigate(id)} type="button"><Icon size={17} /><span>{label}</span>{id === 'alerts' && <b>{rmmAlerts.filter((alert) => alert.status === 'Open').length}</b>}</button>)}</div>)}</nav><div className="rmm-sidebar-footer"><div><span>HC</span><div><strong>Hi5Central</strong><small>Microsoft-connected estate</small></div></div></div></aside></>
}

function RmmPageSkeleton() {
  return <div className="rmm-page-skeleton" aria-label="Loading RMM data">
    <div className="rmm-page-skeleton-heading"><span /><strong /><small /></div>
    <div className="rmm-page-skeleton-metrics">{Array.from({ length: 4 }).map((_, index) => <div key={index}><i /><span><b /><small /></span></div>)}</div>
    <div className="rmm-page-skeleton-panel">
      <div className="rmm-page-skeleton-toolbar"><strong /><span /></div>
      {Array.from({ length: 7 }).map((_, index) => <div className="rmm-page-skeleton-row" key={index}><i /><span /><span /><span /></div>)}
    </div>
  </div>
}

function RmmTopbar({ activeView, currentUser, navigate, onLogout, onMenu, query, setQuery, setTheme, theme }) {
  const [, title] = pageMeta[activeView] || pageMeta.dashboard
  const initials = String(currentUser?.name || 'HC').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'HC'
  return <header className="rmm-topbar"><div className="rmm-topbar-title"><button className="rmm-menu-button" onClick={onMenu} type="button"><Menu size={19} /></button><div><span>RMM</span><strong>{title}</strong></div></div><label className="rmm-global-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices, users, sites, groups, alerts…" /></label><div className="rmm-topbar-actions"><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><button className="rmm-notification-button" onClick={() => navigate('alerts')} type="button"><Bell size={17} /><b>{rmmAlerts.filter((alert) => alert.status === 'Open').length}</b></button><button className="rmm-user" onClick={onLogout} type="button"><span>{initials}</span><div><strong>{currentUser?.name || 'Hi5Central user'}</strong><small>Sign out</small></div><LogOut size={14} /></button></div></header>
}

function PageHeading({ activeView, action }) {
  const [eyebrow, title, description] = pageMeta[activeView] || pageMeta.dashboard
  return <div className="rmm-page-heading"><div><span className="rmm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function dashboardWhen(value) {
  if (!value) return 'Not reported'
  try {
    return new Date(value).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(value)
  }
}

function operationTone(value = '') {
  const normalized = String(value).toLowerCase()
  if (['completed', 'success', 'healthy'].includes(normalized)) return 'healthy'
  if (['failed', 'critical', 'cancelled'].includes(normalized)) return 'critical'
  if (['claimed', 'running'].includes(normalized)) return 'running'
  if (['queued', 'requested', 'warning'].includes(normalized)) return 'warning'
  return 'neutral'
}

function operationLabel(job = {}) {
  if (job.automation_name) return job.automation_name
  return String(job.job_type || 'Device job').replaceAll('.', ' ')
}

function dashboardActivityIcon(category = '') {
  if (category === 'terminal') return TerminalSquare
  if (category === 'remote') return Monitor
  if (category === 'software') return Package
  if (category === 'service') return Server
  if (category === 'security') return ShieldCheck
  if (category === 'job') return ListChecks
  return Activity
}

function RmmDashboard({ canAudit = false, devices = [], navigate, openDevice }) {
  const online = devices.filter((device) => device.status === 'Online').length
  const offline = devices.filter((device) => device.status === 'Offline').length
  const healthy = devices.filter((device) => device.health === 'Healthy').length
  const warning = devices.filter((device) => device.health === 'Warning').length
  const criticalDevices = devices.filter((device) => device.health === 'Critical').length
  const attentionDevices = devices.filter((device) => device.health !== 'Healthy')
  const criticalAlerts = rmmAlerts.filter((alert) => alert.severity === 'Critical' && alert.status === 'Open').length
  const openAlerts = rmmAlerts.filter((alert) => alert.status === 'Open').length
  const patchReported = devices.filter((device) => Number.isFinite(Number(device.patchCompliance)))
  const compliance = patchReported.length ? Math.round(patchReported.reduce((sum, device) => sum + Number(device.patchCompliance), 0) / patchReported.length) : null
  const pendingPatches = devices.reduce((sum, device) => sum + (Number.isFinite(Number(device.pendingPatches)) ? Number(device.pendingPatches) : 0), 0)
  const healthPercent = devices.length ? Math.round((healthy / devices.length) * 100) : null
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl
  const [recentJobs, setRecentJobs] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [operationsLoading, setOperationsLoading] = useState(true)
  const [operationsError, setOperationsError] = useState('')

  useEffect(() => {
    let active = true
    let initial = true

    async function loadOperations() {
      try {
        const jobsResponse = await fetch(apiBase + '/api/v1/rmm/jobs?limit=50', { credentials: 'include' })
        const jobsPayload = await jobsResponse.json().catch(() => ({}))
        if (!jobsResponse.ok) throw new Error(jobsPayload.error || 'Unable to load recent jobs.')

        let activityPayload = { events: [] }
        if (canAudit) {
          const activityResponse = await fetch(apiBase + '/api/v1/rmm/activity?limit=12', { credentials: 'include' })
          activityPayload = await activityResponse.json().catch(() => ({}))
          if (!activityResponse.ok) throw new Error(activityPayload.error || 'Unable to load recent activity.')
        }

        if (!active) return
        setRecentJobs(jobsPayload.jobs || [])
        setRecentActivity(canAudit ? activityPayload.events || [] : [])
        setOperationsError('')
      } catch (error) {
        if (active && initial) setOperationsError(error?.message || 'Unable to load live operations.')
      } finally {
        if (active && initial) setOperationsLoading(false)
        initial = false
      }
    }

    loadOperations()
    const timer = window.setInterval(loadOperations, 10000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [apiBase, canAudit])

  const activeJobs = recentJobs.filter((job) => ['queued', 'claimed', 'running'].includes(String(job.status || '').toLowerCase())).length

  return (
    <>
      <PageHeading activeView="dashboard" action={<div className="rmm-dashboard-heading-actions"><span className="rmm-dashboard-live-state"><i /> Live estate</span><button className="rmm-primary compact" onClick={() => navigate('devices')} type="button"><Monitor size={16} /> View devices</button></div>} />
      <div className="rmm-metric-grid">
        <button onClick={() => navigate('devices')} type="button"><span className="rmm-metric-icon blue"><Monitor size={19} /></span><div><span>Managed devices</span><strong>{devices.length}</strong><small>{devices.length ? `${online} online · ${offline} offline` : 'No devices enrolled'}</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('alerts')} type="button"><span className="rmm-metric-icon red"><AlertTriangle size={19} /></span><div><span>Critical alerts</span><strong>{criticalAlerts}</strong><small>{openAlerts ? `${openAlerts} open alert${openAlerts === 1 ? '' : 's'}` : 'No real alerts reported'}</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('patching')} type="button"><span className="rmm-metric-icon green"><ShieldCheck size={19} /></span><div><span>Patch compliance</span><strong>{compliance == null ? '—' : `${compliance}%`}</strong><small>{patchReported.length ? `${pendingPatches} pending update${pendingPatches === 1 ? '' : 's'}` : 'Not reported by enrolled devices'}</small></div><ChevronRight size={16} /></button>
        <button onClick={() => navigate('devices')} type="button"><span className="rmm-metric-icon violet"><Zap size={19} /></span><div><span>Active jobs</span><strong>{operationsLoading ? '—' : activeJobs}</strong><small>{operationsLoading ? 'Loading live execution state…' : recentJobs.length ? `${recentJobs.length} recent execution${recentJobs.length === 1 ? '' : 's'} loaded` : 'No queued or running device work'}</small></div><ChevronRight size={16} /></button>
      </div>

      <div className="rmm-dashboard-grid">
        <section className="rmm-card rmm-health-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Estate health</span><h2>Device health</h2></div><button onClick={() => navigate('devices')} type="button">All devices <ChevronRight size={14} /></button></div>
          {devices.length ? <>
            <div className="rmm-health-summary">
              <div className="rmm-health-ring" style={{ background: `conic-gradient(#239e63 0 ${healthPercent}%, var(--rmm-soft-strong) ${healthPercent}% 100%)` }}><strong>{healthPercent}%</strong><span>Healthy</span></div>
              <div className="rmm-health-legend"><span><b className="healthy" />Healthy<strong>{healthy}</strong></span><span><b className="warning" />Warning<strong>{warning}</strong></span><span><b className="critical" />Critical<strong>{criticalDevices}</strong></span><span><b className="offline" />Offline<strong>{offline}</strong></span></div>
            </div>
            <div className="rmm-health-list">{attentionDevices.slice(0, 4).map((device) => <button key={device.id} onClick={() => openDevice(device)} type="button"><span className={`rmm-device-icon ${healthClass(device.health)}`}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.user} · {device.site || 'No site'}</small></span><StatusPill>{device.health}</StatusPill><ChevronRight size={15} /></button>)}</div>
          </> : <div className="rmm-empty"><Monitor size={24} /><strong>No managed devices yet</strong><span>Enroll the Hi5Central Agent or connect Microsoft Intune to populate this dashboard with real device data.</span></div>}
        </section>

        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Alerts requiring attention</h2></div><button onClick={() => navigate('alerts')} type="button">Open alerts <ChevronRight size={14} /></button></div>
          <div className="rmm-alert-mini-list">{rmmAlerts.slice(0, 5).map((alert) => <article key={alert.id}><span className={`rmm-alert-dot ${healthClass(alert.severity)}`} /><div><strong>{alert.title}</strong><span>{alert.device}</span><small>{alert.raised} · {alert.policy}</small></div><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill></article>)}{!rmmAlerts.length && <div className="rmm-empty compact"><CheckCircle2 size={22} /><strong>No real alert records</strong><span>Alerts will appear here when monitoring reports a condition.</span></div>}</div>
        </section>
      </div>

      <div className="rmm-dashboard-lower">
        <section className="rmm-card rmm-dashboard-operations-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Execution</span><h2>Recent device jobs</h2></div><div className="rmm-dashboard-feed-status"><span>{activeJobs} active</span><button onClick={() => navigate('devices')} type="button">Device history <ChevronRight size={14} /></button></div></div>
          {operationsLoading ? <div className="rmm-dashboard-feed-loading">{Array.from({ length: 4 }).map((_, index) => <span key={index} />)}</div> : operationsError && !recentJobs.length ? <div className="rmm-empty compact"><AlertTriangle size={22} /><strong>Execution feed unavailable</strong><span>{operationsError}</span></div> : recentJobs.length ? <div className="rmm-dashboard-job-feed">{recentJobs.slice(0, 5).map((job) => <article key={job.id}><span className={'rmm-dashboard-job-icon ' + operationTone(job.status)}><ListChecks size={15} /></span><div><strong>{operationLabel(job)}</strong><small>{job.device_name || job.device_reference || 'Managed device'} · {job.initiated_by_label || job.queued_by_name || job.initiated_by || 'SYSTEM'}</small></div><StatusPill tone={operationTone(job.status)}>{job.status || 'unknown'}</StatusPill><time>{dashboardWhen(job.completed_at || job.claimed_at || job.created_at)}</time></article>)}</div> : <div className="rmm-empty compact"><CheckCircle2 size={22} /><strong>No recent device jobs</strong><span>New technician, automation and maintenance work will appear here automatically.</span></div>}
        </section>
        <section className="rmm-card rmm-dashboard-operations-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Audit</span><h2>Operational activity</h2></div>{canAudit ? <button onClick={() => navigate('activity-audit')} type="button">Open audit <ChevronRight size={14} /></button> : <span className="rmm-dashboard-feed-status-text">Latest estate events</span>}</div>
          {!canAudit ? <div className="rmm-empty compact"><History size={22} /><strong>Activity stays with each device</strong><span>Open a managed device to view its technician actions, remote sessions, jobs and Agent-detected changes.</span></div> : operationsLoading ? <div className="rmm-dashboard-feed-loading">{Array.from({ length: 4 }).map((_, index) => <span key={index} />)}</div> : operationsError && !recentActivity.length ? <div className="rmm-empty compact"><AlertTriangle size={22} /><strong>Activity feed unavailable</strong><span>{operationsError}</span></div> : recentActivity.length ? <div className="rmm-dashboard-activity-feed">{recentActivity.slice(0, 5).map((event) => { const Icon = dashboardActivityIcon(event.category); return <article key={event.id}><span className={'rmm-dashboard-activity-icon ' + operationTone(event.outcome)}><Icon size={15} /></span><div><strong>{event.summary}</strong><small>{event.device_name || 'Managed device'} · {event.actor_label || 'SYSTEM'}</small></div><StatusPill tone={operationTone(event.outcome)}>{event.outcome || 'info'}</StatusPill><time>{dashboardWhen(event.created_at)}</time></article> })}</div> : <div className="rmm-empty compact"><History size={22} /><strong>No operational activity yet</strong><span>Remote sessions, terminal work, jobs and Agent-detected changes will appear here.</span></div>}
        </section>
      </div>
    </>
  )
}

function DeviceMetric({ icon: Icon, label, value, suffix = '%', tone }) {
  const reported = value !== null && value !== undefined && Number.isFinite(Number(value))
  return <div className={`rmm-device-metric ${reported ? tone : 'neutral'}`}><span><Icon size={17} /></span><div><small>{label}</small><strong>{reported ? `${value}${suffix}` : 'Not reported'}</strong></div><div className="rmm-device-meter"><span style={{ width: reported ? `${Math.min(100, Number(value))}%` : '0%' }} /></div></div>
}

function DeviceProperty({ label, value, detail }) {
  const reported = value !== null && value !== undefined && value !== ''
  return <div><span>{label}</span><strong>{reported ? value : 'Not reported'}</strong>{detail && <small>{detail}</small>}</div>
}

function formatBytes(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 'Not reported'
  if (number >= 1024 ** 4) return (number / (1024 ** 4)).toFixed(1).replace(/\.0$/, '') + ' TB'
  if (number >= 1024 ** 3) return (number / (1024 ** 3)).toFixed(1).replace(/\.0$/, '') + ' GB'
  if (number >= 1024 ** 2) return (number / (1024 ** 2)).toFixed(1).replace(/\.0$/, '') + ' MB'
  if (number >= 1024) return (number / 1024).toFixed(1).replace(/\.0$/, '') + ' KB'
  return Math.round(number) + ' B'
}

function formatInventoryDate(value) {
  if (!value) return 'Not reported'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}

function softwareScopeLabel(scope = '') {
  const value = String(scope || '')
  if (value === 'machine64') return 'Machine · 64-bit'
  if (value === 'machine32') return 'Machine · 32-bit'
  if (value.startsWith('user:')) return 'User'
  return value || 'Not reported'
}

function formatLinkSpeed(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0 || number > 1_000_000_000_000) return 'Not reported'
  if (number >= 1_000_000_000) return (number / 1_000_000_000).toFixed(number >= 10_000_000_000 ? 0 : 1).replace(/\.0$/, '') + ' Gbps'
  if (number >= 1_000_000) return (number / 1_000_000).toFixed(number >= 100_000_000 ? 0 : 1).replace(/\.0$/, '') + ' Mbps'
  if (number >= 1_000) return (number / 1_000).toFixed(1).replace(/\.0$/, '') + ' Kbps'
  return Math.round(number) + ' bps'
}

function formatTrafficRate(bytesPerSecond) {
  const value = Number(bytesPerSecond) * 8
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + ' Gbps'
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' Mbps'
  if (value >= 1_000) return (value / 1_000).toFixed(0) + ' Kbps'
  return Math.round(value) + ' bps'
}

function networkLinePoints(samples, key) {
  if (!samples?.length) return ''
  const width = 320
  const height = 68
  const values = samples.map((sample) => Math.max(0, Number(sample[key]) || 0))
  const ceiling = Math.max(1, ...samples.flatMap((sample) => [Number(sample.rx) || 0, Number(sample.tx) || 0]))
  return values.map((value, index) => {
    const x = samples.length <= 1 ? width : (index / (samples.length - 1)) * width
    const y = height - (value / ceiling) * (height - 6) - 3
    return x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')
}

function AgentMaintenance({ device }) {
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(Boolean(device.agentDeviceId))
  const [busy, setBusy] = useState(false)
  const [watching, setWatching] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!device.agentDeviceId) return
    const response = await fetch(apiBase + '/api/v1/rmm/agent/devices/' + encodeURIComponent(device.agentDeviceId) + '/upgrade-info', { credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to load Agent maintenance state.')
    setInfo(payload)
    const target = (payload.releases || []).find((release) => !release.installed)
    if (!target && watching) setWatching(false)
  }

  useEffect(() => {
    let active = true
    if (!device.agentDeviceId) return undefined
    setLoading(true)
    load().catch((loadError) => { if (active) setError(loadError.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [device.agentDeviceId])

  useEffect(() => {
    if (!watching) return undefined
    const interval = window.setInterval(() => load().catch(() => {}), 3000)
    const stop = window.setTimeout(() => setWatching(false), 180000)
    return () => { window.clearInterval(interval); window.clearTimeout(stop) }
  }, [watching, device.agentDeviceId])

  const releases = info?.releases || []
  const target = releases.find((release) => !release.installed) || releases[0]
  const latest = info?.latestUpgrade
  const latestTargetsTarget = Boolean(target?.id && latest?.request_metadata?.release_id === target.id)
  const verified = Boolean(target?.installed)
  const running = latestTargetsTarget && ['queued', 'claimed'].includes(latest?.status)
  const scheduledAt = latest?.completed_at || latest?.updated_at || latest?.created_at
  const scheduledAgeMs = scheduledAt ? Date.now() - new Date(scheduledAt).getTime() : 0
  const scheduled = latestTargetsTarget && latest?.status === 'completed' && !verified && scheduledAgeMs < 180000
  const staleScheduled = latestTargetsTarget && latest?.status === 'completed' && !verified && scheduledAgeMs >= 180000
  const failed = latestTargetsTarget && ['failed', 'cancelled'].includes(latest?.status)

  async function upgrade() {
    if (!target?.id || busy || verified || !info?.device?.online) return
    if (!window.confirm('Upgrade ' + device.name + ' to Hi5Central Agent ' + target.version + '? The Agent service will briefly disconnect and reconnect.')) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(apiBase + '/api/v1/rmm/agent/devices/' + encodeURIComponent(device.agentDeviceId) + '/upgrade', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: target.id }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to start Agent upgrade.')
      setWatching(true)
      await load()
    } catch (upgradeError) {
      setError(upgradeError?.message || 'Unable to start Agent upgrade.')
    } finally {
      setBusy(false)
    }
  }

  if (!device.agentDeviceId) return null
  return <section className="rmm-card rmm-agent-maintenance-card">
    <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Agent maintenance</span><h2>Hi5Central Agent</h2></div>{verified ? <StatusPill tone="healthy">Verified</StatusPill> : running || scheduled ? <StatusPill tone="running">{running ? 'Preparing' : 'Reconnecting'}</StatusPill> : failed ? <StatusPill tone="critical">Attention</StatusPill> : <StatusPill tone="neutral">{target?.status === 'test' ? 'Test release' : 'Managed'}</StatusPill>}</div>
    {loading ? <p>Loading Agent release state…</p> : <>
      <div className="rmm-agent-maintenance-meta">
        <span><small>Agent reports</small><strong>{info?.device?.agentVersion || 'Not reported'}</strong></span>
        <span><small>PatchHost</small><strong>{info?.device?.patchHostVersion || 'Not reported'}</strong></span>
        <span><small>Target</small><strong>{target ? target.version + ' / ' + (target.patchHostVersion || '—') : 'No release'}</strong></span>
      </div>
      {target?.releaseNotes && <p>{target.releaseNotes}</p>}
      {scheduled && <div className="rmm-agent-maintenance-state running"><Clock3 size={14} /><span>Installer scheduled. Waiting for the Agent to restart and report PatchHost {target.patchHostVersion}.</span></div>}
      {staleScheduled && <div className="rmm-agent-maintenance-state critical"><AlertTriangle size={14} /><span>The scheduled upgrade did not report the target Agent/PatchHost within 3 minutes. The device is still online, so you can retry the upgrade.</span></div>}
      {verified && <div className="rmm-agent-maintenance-state healthy"><CheckCircle2 size={14} /><span>PatchHost {info?.device?.patchHostVersion} is reporting. This release is verified on the endpoint.</span></div>}
      {failed && <div className="rmm-agent-maintenance-state critical"><AlertTriangle size={14} /><span>{latest?.error_message || 'The Agent upgrade preparation job failed.'}</span></div>}
      {error && <div className="rmm-agent-maintenance-state critical"><AlertTriangle size={14} /><span>{error}</span></div>}
      {!verified && <button className="rmm-primary compact" disabled={busy || running || scheduled || !target || !info?.device?.online} onClick={upgrade} type="button"><Download size={14} /> {busy ? 'Starting…' : running ? 'Preparing…' : scheduled ? 'Waiting for restart…' : !info?.device?.online ? 'Device offline' : target ? 'Upgrade to ' + target.version : 'No release available'}</button>}
      {target?.sha256 && <small className="rmm-agent-maintenance-sha">SHA-256 {target.sha256.slice(0, 12)}…{target.sha256.slice(-12)} · {target.channel}</small>}
    </>}
  </section>
}


function patchPolicyWindowLabel(window = {}) {
  const start = window.start || '18:00'
  const end = window.end || '05:00'
  const timezone = window.timezone || 'Europe/London'
  return start + '–' + end + ' · ' + timezone
}

function softwarePolicyScopeLabel(settings = {}) {
  if (settings.targetMode === 'all_winget') return 'Use WinGet'
  if (settings.targetMode === 'selected_catalogue') {
    const count = Number(settings.selectedCount || 0)
    return count + ' selected Hi5Central app' + (count === 1 ? '' : 's')
  }
  return 'All Hi5Central catalogue applications'
}

function AppliedPatchPolicyRow({ domain, resolution, loading = false }) {
  const policy = resolution?.effective
  const isOs = domain === 'os'
  const Icon = isOs ? ShieldCheck : PackageCheck
  if (loading) return <div className="rmm-device-applied-policy is-loading"><span><Icon size={16} /></span><div><strong>Loading {isOs ? 'OS' : 'software'} policy…</strong><small>Resolving scope precedence</small></div></div>
  if (!policy) return <div className="rmm-device-applied-policy is-empty"><span><Icon size={16} /></span><div><strong>No {isOs ? 'OS patching' : 'software patching'} policy</strong><small>No matching Estate, Site, Group or Device assignment.</small></div><StatusPill tone="neutral">None</StatusPill></div>

  const assignment = policy.assignment || {}
  const scopeName = assignment.scopeName || assignment.scopeId || assignment.scopeType || 'Scope'
  const inheritance = assignment.scopeType === 'Device' ? 'Direct device assignment' : 'Inherited from ' + (assignment.scopeType || 'scope')
  const matchCount = Array.isArray(resolution?.matches) ? resolution.matches.length : 1
  const detail = isOs
    ? (policy.settings?.automaticInstall ? 'Automatic install' : 'Managed only') + ' · ' + patchPolicyWindowLabel(policy.settings?.maintenanceWindow)
    : softwarePolicyScopeLabel(policy.settings) + ' · ' + patchPolicyWindowLabel(policy.settings?.maintenanceWindow)

  return <div className="rmm-device-applied-policy">
    <span><Icon size={16} /></span>
    <div>
      <strong>{policy.name}</strong>
      <small>{detail}</small>
      <small>{inheritance} · {scopeName} · priority {assignment.priority ?? 0}{matchCount > 1 ? ' · ' + matchCount + ' matching assignments' : ''}</small>
    </div>
    <StatusPill tone={assignment.scopeType === 'Device' ? 'warning' : 'healthy'}>{assignment.scopeType === 'Device' ? 'Direct' : 'Inherited'}</StatusPill>
  </div>
}

function DeviceOverview({ device, deviceAlerts, monitoringResolution, patchPolicyResolution, patchPolicyLoading, relatedTickets, navigate, onCreateIncident }) {
  const security = device.security || {}
  return (
    <div className="rmm-device-overview-layout">
      <div className="rmm-device-overview-main">
        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Inventory</span><h2>System & ownership</h2></div></div>
          <div className="rmm-property-grid detailed">
            <DeviceProperty label="Assigned user" value={device.user} detail={device.userEmail} />
            <DeviceProperty label="Manufacturer / model" value={`${device.manufacturer} ${device.model}`} detail={device.serial} />
            <DeviceProperty label="Operating system" value={device.os} detail={`${device.edition || ''}${device.osBuild ? ` · build ${device.osBuild}` : ''}`} />
            <DeviceProperty label="Processor" value={device.processor} />
            <DeviceProperty label="Memory" value={device.ramGb == null ? null : `${device.ramGb} GB`} detail={device.memoryUsedBytes && device.memoryTotalBytes ? `${(device.memoryUsedBytes / (1024 ** 3)).toFixed(1)} GB used · ${device.memory == null ? 'usage not reported' : device.memory + '%'}` : (device.memory == null ? '' : device.memory + '% used')} />
            <DeviceProperty label="Storage" value={device.storageGb == null ? null : `${device.storageGb} GB`} detail={device.storageFreeGb == null ? '' : `${device.storageFreeGb} GB free`} />
            <DeviceProperty label="Site" value={device.site} />
            <DeviceProperty label="Device group" value={device.group} detail={device.policy} />
          </div>
        </section>

        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Network</span><h2>Connectivity</h2></div></div>
          <div className="rmm-property-grid detailed">
            <DeviceProperty label="Private IP" value={device.ip} />
            <DeviceProperty label="Public IP" value={device.publicIp} />
            <DeviceProperty label="Gateway" value={device.gateway} />
            <DeviceProperty label="Primary MAC" value={device.mac} />
            <DeviceProperty label="Last seen" value={device.lastSeen} />
            <DeviceProperty label="Uptime" value={device.uptime} detail={`Last boot ${device.lastBoot}`} />
          </div>
        </section>

        <section className="rmm-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Current alerts</h2></div><button onClick={() => navigate('alerts')} type="button">All alerts <ChevronRight size={14} /></button></div>
          <div className="rmm-alert-mini-list">
            {deviceAlerts.length ? deviceAlerts.map((alert) => (
              <article key={alert.id}>
                <span className={`rmm-alert-dot ${healthClass(alert.severity)}`} />
                <div><strong>{alert.title}</strong><span>{alert.detail}</span><small>{alert.raised} · {alert.policy}</small></div>
                <div className="rmm-device-alert-actions"><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill><button onClick={() => onCreateIncident(alert)} type="button">Create incident</button></div>
              </article>
            )) : <div className="rmm-empty compact"><CheckCircle2 size={24} /><strong>No active alerts</strong><span>This device currently passes its assigned monitoring policies.</span></div>}
          </div>
        </section>
      </div>

      <aside className="rmm-device-overview-side">
        <section className="rmm-card rmm-security-summary">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Security</span><h2>Security posture</h2></div></div>
          {[
            ['Encryption', security.encryptionState, security.encryption],
            ['Antivirus', security.avState, security.av],
            ['Firewall', security.firewall, 'Host firewall'],
            ['Secure boot', security.secureBoot, 'Platform integrity'],
            ['EDR', security.edrState, security.edr],
          ].map(([label, value, detail]) => <div key={label}><span className={`rmm-security-state ${securityTone(value)}`}><ShieldCheck size={15} /></span><span><strong>{label}</strong><small>{detail}</small></span><StatusPill tone={securityTone(value)}>{value}</StatusPill></div>)}
        </section>

        <section className="rmm-card rmm-device-monitoring-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Monitoring</span><h2>Effective policy</h2></div><StatusPill>{monitoringResolution?.override ? 'Override' : 'Inherited'}</StatusPill></div>
          <p>Resolved through estate, site, group and device precedence.</p>
          <div className="rmm-device-monitoring-effective"><span><SlidersHorizontal size={16} /></span><div><strong>{monitoringResolution?.policy?.name || 'No monitoring policy assigned'}</strong><small>{monitoringResolution?.policy ? `${monitoringResolution.policy.checks?.length || 0} checks · ${monitoringResolution.policy.evaluation || 'Evaluation not set'}` : 'Assign a tenant policy from Monitoring policies'}</small></div></div>
          <button onClick={() => navigate('policies')} type="button"><GitBranch size={14} /> View policy inheritance</button>
        </section>

        <section className="rmm-card rmm-device-policies-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Patching</span><h2>Applied policies</h2></div><StatusPill tone="neutral">Effective</StatusPill></div>
          <p>OS and software policies are resolved independently through Estate → Site → Group → Device precedence.</p>
          <div className="rmm-device-applied-policies">
            <AppliedPatchPolicyRow domain="os" loading={patchPolicyLoading} resolution={patchPolicyResolution?.os} />
            <AppliedPatchPolicyRow domain="software" loading={patchPolicyLoading} resolution={patchPolicyResolution?.software} />
          </div>
          <button onClick={() => navigate('patching')} type="button"><GitBranch size={14} /> Manage patch policies</button>
        </section>

        <AgentMaintenance device={device} />

        <section className="rmm-card rmm-itsm-bridge-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Hi5Central ITSM</span><h2>Related service records</h2></div></div>
          <p>When ITSM and RMM are licensed together, device context can travel with incidents without merging the two product interfaces.</p>
          {relatedTickets.slice(0, 4).map((ticket) => <a href={itsmRecordHref(ticket)} key={ticket.id} target="_blank" rel="noreferrer"><span><strong>{ticket.id}</strong><small>{ticket.type}</small></span><span>{ticket.title}</span><ExternalLink size={14} /></a>)}
          {!relatedTickets.length && <div className="rmm-empty compact"><Database size={22} /><strong>No linked ITSM records</strong><span>Create an incident to establish an explicit device relationship.</span></div>}
          <button className="rmm-primary compact" onClick={() => onCreateIncident()} type="button"><AlertTriangle size={14} /> Create ITSM incident</button>
        </section>

        <section className="rmm-card rmm-device-tags-card">
          <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Classification</span><h2>Tags & management</h2></div></div>
          <div className="rmm-device-tags">{(device.tags || []).map((tag) => <span key={tag}><Tag size={12} />{tag}</span>)}</div>
          <div className="rmm-device-management-meta"><span><strong>{device.agent}</strong><small>Agent · {device.agentChannel}</small></span><span><strong>{device.managedSince}</strong><small>Managed since</small></span><span><strong>{device.timeZone}</strong><small>Time zone</small></span></div>
        </section>
      </aside>
    </div>
  )
}

function NetworkAdaptersPanel({ device }) {
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl
  const previousRef = useRef(new Map())
  const [liveByName, setLiveByName] = useState({})
  const [liveState, setLiveState] = useState(deviceIsOnline(device) ? 'Measuring live throughput…' : 'Device offline')

  useEffect(() => {
    let active = true
    let timer = null
    previousRef.current = new Map()
    setLiveByName({})
    if (!deviceIsOnline(device) || !device.agentDeviceId) { setLiveState('Device offline'); return undefined }

    const poll = async () => {
      try {
        const response = await fetch(apiBase + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/network-stats', { credentials: 'include', cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (!active) return
        if (response.status === 426) { setLiveState('Upgrade the Agent to enable live throughput graphs.'); return }
        if (!response.ok) throw new Error(payload.error || 'Live network statistics unavailable.')
        const sampleMs = Number(payload.unixMs || Date.now())
        setLiveByName((current) => {
          const next = { ...current }
          for (const adapter of payload.adapters || []) {
            const name = String(adapter.name || adapter.description || '').trim()
            if (!name) continue
            const key = name.toLowerCase()
            const previous = previousRef.current.get(key)
            let rx = null
            let tx = null
            if (previous && sampleMs > previous.at) {
              const seconds = (sampleMs - previous.at) / 1000
              rx = Math.max(0, (Number(adapter.receive_bytes || 0) - previous.rxBytes) / seconds)
              tx = Math.max(0, (Number(adapter.send_bytes || 0) - previous.txBytes) / seconds)
            }
            previousRef.current.set(key, { at: sampleMs, rxBytes: Number(adapter.receive_bytes || 0), txBytes: Number(adapter.send_bytes || 0) })
            const before = next[key] || {}
            const history = rx == null || tx == null ? (before.history || []) : [...(before.history || []), { at: sampleMs, rx, tx }].slice(-30)
            next[key] = { ...adapter, rx, tx, history }
          }
          return next
        })
        setLiveState('Live · updates every 2 seconds')
        timer = window.setTimeout(poll, 2000)
      } catch (error) {
        if (!active) return
        setLiveState(error?.message || 'Live network statistics unavailable.')
        timer = window.setTimeout(poll, 5000)
      }
    }
    poll()
    return () => { active = false; if (timer) window.clearTimeout(timer) }
  }, [apiBase, device.agentDeviceId, device.status, device.agent])

  const adapters = [...(device.networkAdapters || [])].sort((left, right) => (String(right.status).toLowerCase() === 'up') - (String(left.status).toLowerCase() === 'up'))
  return <section className="rmm-card rmm-network-adapters-card">
    <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Interfaces</span><h2>Network adapters</h2></div><small>{liveState}</small></div>
    <div className="rmm-adapter-list">{adapters.map((adapter) => {
      const name = adapter.name || adapter.adapter || adapter.description || 'Network adapter'
      const live = liveByName[String(name).toLowerCase()]
        || liveByName[String(adapter.description || '').toLowerCase()]
        || {}
      const ipv4 = Array.isArray(adapter.ipv4) ? adapter.ipv4.find((value) => value && !String(value).startsWith('169.254.')) || adapter.ipv4[0] : adapter.address
      const type = adapter.connection_type || adapter.connection || adapter.type || 'Network'
      const inventorySpeed = Number(adapter.speed_bps)
      const linkSpeed = Number(live.transmit_link_speed_bps || live.receive_link_speed_bps || (inventorySpeed > 1_000_000_000_000 ? 0 : inventorySpeed))
      const history = live.history || []
      const adapterIsUp = String(adapter.status).toLowerCase() === 'up'
      return <article className={adapterIsUp ? 'is-up' : 'is-down'} key={name}>
        <div className="rmm-adapter-heading"><span><Network size={17} /></span><div><strong>{name}</strong><small>{adapter.description || type} · {adapter.mac || adapter.mac_address || 'MAC not reported'}</small></div><StatusPill tone={adapterIsUp ? 'healthy' : 'neutral'}>{adapter.status || 'Unknown'}</StatusPill></div>
        <div className="rmm-adapter-metrics"><span><small>IPv4</small><strong>{ipv4 || 'Not assigned'}</strong></span><span><small>Link</small><strong>{formatLinkSpeed(linkSpeed)}</strong></span><span><small>Receive</small><strong>{adapterIsUp ? (live.rx == null ? 'Measuring…' : formatTrafficRate(live.rx)) : 'Inactive'}</strong></span><span><small>Send</small><strong>{adapterIsUp ? (live.tx == null ? 'Measuring…' : formatTrafficRate(live.tx)) : 'Inactive'}</strong></span></div>
        {adapterIsUp && <div className="rmm-network-graph" aria-label={'Live receive and send throughput for ' + name}>
          {history.length > 1 ? <svg viewBox="0 0 320 74" preserveAspectRatio="none" role="img"><polyline className="rx" points={networkLinePoints(history, 'rx')} /><polyline className="tx" points={networkLinePoints(history, 'tx')} /></svg> : <span>Waiting for enough live samples…</span>}
          <div><span className="rx">Receive</span><span className="tx">Send</span><small>Last {Math.min(60, history.length * 2)}s</small></div>
        </div>}
      </article>
    })}</div>
    {!adapters.length && <div className="rmm-empty compact"><Network size={22} /><strong>No network adapters reported</strong><span>Refresh device inventory after the Agent reconnects.</span></div>}
  </section>
}


function InventoryTableCard({ detail = '', eyebrow = 'Inventory', empty = 'No inventory reported', items = [], columns = [], searchPlaceholder = 'Search inventory…', title }) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(100)
  const normalized = String(search || '').trim().toLowerCase()
  const filtered = normalized
    ? items.filter((item) => JSON.stringify(item || {}).toLowerCase().includes(normalized))
    : items
  const visible = filtered.slice(0, limit)
  return <section className="rmm-card rmm-deep-inventory-card">
    <div className="rmm-card-heading">
      <div><span className="rmm-eyebrow">{eyebrow}</span><h2>{title}</h2>{detail && <small>{detail}</small>}</div>
      <strong>{items.length}</strong>
    </div>
    {items.length > 8 && <label className="rmm-deep-inventory-search"><Search size={14} /><input value={search} onChange={(event) => { setSearch(event.target.value); setLimit(100) }} placeholder={searchPlaceholder} /></label>}
    {visible.length > 0 ? <div className="rmm-deep-inventory-table" style={{ '--inventory-columns': columns.map((column) => column.width || 'minmax(120px,1fr)').join(' ') }}>
      <div className="rmm-deep-inventory-head">{columns.map((column) => <span key={column.label}>{column.label}</span>)}</div>
      {visible.map((item, index) => <div className="rmm-deep-inventory-row" key={(item.id || item.device_id || item.pnp_device_id || item.serial_number || item.name || item.hotfix_id || index) + ':' + index}>
        {columns.map((column) => <span key={column.label}><strong>{column.value ? column.value(item) : (item[column.key] ?? 'Not reported')}</strong>{column.detail && <small>{column.detail(item)}</small>}</span>)}
      </div>)}
    </div> : <div className="rmm-empty compact"><Database size={22} /><strong>{normalized ? 'No matching inventory' : empty}</strong></div>}
    {filtered.length > visible.length && <button className="rmm-inventory-load-more" onClick={() => setLimit((current) => current + 100)} type="button">Show more ({filtered.length - visible.length} remaining)</button>}
  </section>
}

function DeviceHardware({ device }) {
  const memoryDetail = device.memoryUsedBytes && device.memoryTotalBytes ? (device.memoryUsedBytes / (1024 ** 3)).toFixed(1) + ' GB used · ' + (device.memory == null ? 'usage not reported' : device.memory + '%') : (device.memory == null ? '' : device.memory + '% used')
  const battery = device.battery || {}
  const gpus = Array.isArray(device.gpus) ? device.gpus : []
  const storageVolumes = Array.isArray(device.storageVolumes) ? device.storageVolumes : []
  const memoryModules = Array.isArray(device.memoryModules) ? device.memoryModules : []
  const physicalDisks = Array.isArray(device.physicalDisks) ? device.physicalDisks : []
  const monitors = Array.isArray(device.monitors) ? device.monitors : []
  const printers = Array.isArray(device.printers) ? device.printers : []
  const usbDevices = Array.isArray(device.usbDevices) ? device.usbDevices : []
  const motherboard = device.motherboard || {}
  const virtualization = device.virtualization || {}
  const monitorCount = Number(device.displayInfo?.monitor_count)
  return (
    <div className="rmm-device-section-grid rmm-hardware-expanded">
      <section className="rmm-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">System</span><h2>Hardware identity</h2></div></div>
        <div className="rmm-property-grid detailed">
          <DeviceProperty label="Manufacturer" value={device.manufacturer} />
          <DeviceProperty label="Model" value={device.model} />
          <DeviceProperty label="Serial number" value={device.serial} />
          <DeviceProperty label="System family" value={device.systemFamily} />
          <DeviceProperty label="System SKU" value={device.systemSku} />
          <DeviceProperty label="Device UUID" value={device.deviceUuid} />
          <DeviceProperty label="BIOS / firmware" value={device.bios} />
          <DeviceProperty label="BIOS date" value={device.biosDate ? formatInventoryDate(device.biosDate) : null} />
        </div>
      </section>

      <section className="rmm-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Firmware</span><h2>Motherboard & BIOS</h2></div></div>
        <div className="rmm-property-grid detailed">
          <DeviceProperty label="Board manufacturer" value={motherboard.manufacturer} />
          <DeviceProperty label="Board model" value={motherboard.product} />
          <DeviceProperty label="Board serial" value={motherboard.serial_number} />
          <DeviceProperty label="Board version" value={motherboard.version} />
          <DeviceProperty label="BIOS manufacturer" value={motherboard.bios_manufacturer} />
          <DeviceProperty label="BIOS version" value={motherboard.bios_version} />
          <DeviceProperty label="SMBIOS version" value={motherboard.smbios_version} />
          <DeviceProperty label="Active power plan" value={device.powerPlan} />
        </div>
      </section>

      <section className="rmm-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Virtualization</span><h2>Hypervisor capability</h2></div></div>
        <div className="rmm-property-grid detailed">
          <DeviceProperty label="Hypervisor present" value={virtualization.hypervisor_present === true ? 'Yes' : virtualization.hypervisor_present === false ? 'No' : null} />
          <DeviceProperty label="Firmware virtualization" value={virtualization.virtualization_firmware_enabled === true ? 'Enabled' : virtualization.virtualization_firmware_enabled === false ? 'Disabled' : null} />
          <DeviceProperty label="VM monitor extensions" value={virtualization.vm_monitor_mode_extensions === true ? 'Available' : virtualization.vm_monitor_mode_extensions === false ? 'Unavailable' : null} />
          <DeviceProperty label="Second-level address translation" value={virtualization.second_level_address_translation === true ? 'Available' : virtualization.second_level_address_translation === false ? 'Unavailable' : null} />
          <DeviceProperty label="DEP capability" value={virtualization.data_execution_prevention_available === true ? 'Available' : virtualization.data_execution_prevention_available === false ? 'Unavailable' : null} />
        </div>
      </section>

      <section className="rmm-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Compute</span><h2>Processor & memory</h2></div></div>
        <div className="rmm-property-grid detailed">
          <DeviceProperty label="Processor" value={device.processor} detail={device.cpuVendor} />
          <DeviceProperty label="Physical cores" value={device.cpuCores} />
          <DeviceProperty label="Logical processors" value={device.cpuLogicalProcessors} />
          <DeviceProperty label="Maximum clock" value={device.cpuMaxClockMhz ? Math.round(Number(device.cpuMaxClockMhz)) + ' MHz' : null} />
          <DeviceProperty label="Installed RAM" value={device.ramGb == null ? null : device.ramGb + ' GB'} detail={memoryDetail} />
          <DeviceProperty label="OS architecture" value={device.architecture} />
          <DeviceProperty label="Windows release" value={device.osDisplayVersion} />
          <DeviceProperty label="OS installed" value={device.osInstallDate ? formatInventoryDate(device.osInstallDate) : null} />
        </div>
      </section>

      <section className="rmm-card rmm-hardware-list-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Graphics</span><h2>GPU & displays</h2></div><small>{Number.isFinite(monitorCount) ? monitorCount + ' monitor' + (monitorCount === 1 ? '' : 's') : 'Monitor count not reported'}</small></div>
        <div className="rmm-hardware-item-list">
          {gpus.map((gpu, index) => <article key={(gpu.pnp_device_id || gpu.name || 'gpu') + ':' + index}>
            <span className="rmm-hardware-item-icon"><Monitor size={17} /></span>
            <div><strong>{gpu.name || gpu.video_processor || 'Graphics adapter'}</strong><small>Driver {gpu.driver_version || 'not reported'} · {gpu.status || 'Status not reported'}</small></div>
            <div className="rmm-hardware-item-meta">
              <span><small>Memory</small><strong>{gpu.adapter_ram_bytes ? formatBytes(gpu.adapter_ram_bytes) : 'Not reported'}</strong></span>
              <span><small>Resolution</small><strong>{gpu.current_horizontal_resolution && gpu.current_vertical_resolution ? gpu.current_horizontal_resolution + ' × ' + gpu.current_vertical_resolution : 'Not reported'}</strong></span>
              <span><small>Driver date</small><strong>{gpu.driver_date ? formatInventoryDate(gpu.driver_date) : 'Not reported'}</strong></span>
            </div>
          </article>)}
        </div>
        {!gpus.length && <div className="rmm-empty compact"><Monitor size={22} /><strong>No graphics inventory reported</strong><span>Refresh inventory after the Agent reconnects.</span></div>}
      </section>

      <section className="rmm-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Power</span><h2>Battery & power</h2></div></div>
        <div className="rmm-property-grid detailed">
          <DeviceProperty label="Battery" value={battery.present === true || battery.battery_present === true ? 'Present' : battery.present === false || battery.battery_present === false ? 'Not present' : null} />
          <DeviceProperty label="Charge" value={battery.charge_percent != null ? Math.round(Number(battery.charge_percent)) + '%' : battery.battery_percent != null ? Math.round(Number(battery.battery_percent)) + '%' : null} />
          <DeviceProperty label="Power source" value={battery.ac_line_status} />
          <DeviceProperty
            label="Power state"
            value={battery.charging === true
              ? 'Charging'
              : battery.ac_line_status === 'Online' && Number(battery.charge_percent ?? battery.battery_percent) >= 99
                ? 'Plugged in · fully charged'
                : battery.ac_line_status === 'Online'
                  ? 'Plugged in · not actively charging'
                  : battery.ac_line_status === 'Offline'
                    ? 'On battery'
                    : null}
          />
          <DeviceProperty label="Battery health" value={battery.health_percent != null ? Math.round(Number(battery.health_percent)) + '%' : battery.health} detail={battery.wear_percent != null ? Math.round(Number(battery.wear_percent)) + '% wear' : ''} />
          <DeviceProperty label="Cycle count" value={battery.cycle_count} />
          <DeviceProperty label="Design capacity" value={battery.design_capacity_mwh ? Math.round(Number(battery.design_capacity_mwh)) + ' mWh' : null} />
          <DeviceProperty label="Full-charge capacity" value={battery.full_charge_capacity_mwh ? Math.round(Number(battery.full_charge_capacity_mwh)) + ' mWh' : null} />
          <DeviceProperty label="Remaining capacity" value={battery.remaining_capacity_mwh ? Math.round(Number(battery.remaining_capacity_mwh)) + ' mWh' : null} />
          <DeviceProperty label="Voltage" value={battery.voltage_mv ? Math.round(Number(battery.voltage_mv)) + ' mV' : null} />
          <DeviceProperty label="Charge / discharge rate" value={battery.rate_mw != null ? Math.round(Number(battery.rate_mw)) + ' mW' : null} />
          <DeviceProperty label="Estimated runtime" value={battery.battery_life_seconds ? Math.round(Number(battery.battery_life_seconds) / 60) + ' minutes' : null} />
        </div>
      </section>

      <section className="rmm-card rmm-hardware-list-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Storage</span><h2>Volumes & encryption</h2></div><small>{storageVolumes.length ? storageVolumes.length + ' volume' + (storageVolumes.length === 1 ? '' : 's') : 'No volumes reported'}</small></div>
        <div className="rmm-hardware-item-list">
          {storageVolumes.map((volume, index) => <article key={(volume.drive || volume.mount || 'volume') + ':' + index}>
            <span className="rmm-hardware-item-icon"><HardDrive size={17} /></span>
            <div><strong>{[volume.drive, volume.label].filter(Boolean).join(' · ') || 'Storage volume'}</strong><small>{volume.filesystem || 'Filesystem not reported'} · {volume.type || 'Volume type not reported'}</small></div>
            <div className="rmm-hardware-item-meta">
              <span><small>Capacity</small><strong>{formatBytes(volume.total_bytes)}</strong></span>
              <span><small>Free</small><strong>{formatBytes(volume.free_bytes)}</strong></span>
              <span><small>Used</small><strong>{volume.used_percent == null ? 'Not reported' : Math.round(Number(volume.used_percent)) + '%'}</strong></span>
              <span><small>BitLocker</small><strong>{volume.bitlocker_status || volume.bitlocker?.protection_status || 'Not reported'}</strong></span>
            </div>
          </article>)}
        </div>
      </section>

      <InventoryTableCard
        eyebrow="Memory"
        title="Physical memory modules"
        detail="Individual DIMMs reported by Windows SMBIOS/WMI."
        items={memoryModules}
        columns={[
          { label: 'Slot', width: 'minmax(120px,.8fr)', value: (item) => item.device_locator || item.bank_label || 'Not reported' },
          { label: 'Capacity', width: '100px', value: (item) => formatBytes(item.capacity_bytes) },
          { label: 'Manufacturer', value: (item) => item.manufacturer || 'Not reported' },
          { label: 'Part / serial', value: (item) => item.part_number || 'Not reported', detail: (item) => item.serial_number || '' },
          { label: 'Speed', width: '110px', value: (item) => item.configured_speed_mhz ? item.configured_speed_mhz + ' MHz' : item.speed_mhz ? item.speed_mhz + ' MHz' : 'Not reported' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Physical storage"
        title="Disks & SMART health"
        detail="Physical devices, firmware and reliability counters where Windows exposes them."
        items={physicalDisks}
        columns={[
          { label: 'Disk', value: (item) => item.friendly_name || 'Physical disk', detail: (item) => item.serial_number || item.device_id || '' },
          { label: 'Type / bus', width: '130px', value: (item) => [item.media_type, item.bus_type].filter(Boolean).join(' · ') || 'Not reported' },
          { label: 'Capacity', width: '100px', value: (item) => formatBytes(item.size_bytes) },
          { label: 'Health', width: '110px', value: (item) => item.health_status || item.operational_status || 'Not reported', detail: (item) => item.wear_percent == null ? '' : item.wear_percent + '% wear' },
          { label: 'Temperature', width: '100px', value: (item) => item.temperature_c == null ? 'Not reported' : item.temperature_c + ' °C' },
          { label: 'Firmware', width: '120px', value: (item) => item.firmware_version || 'Not reported' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Displays"
        title="Physical monitors"
        detail="EDID identity reported by Windows monitor instrumentation."
        items={monitors}
        columns={[
          { label: 'Monitor', value: (item) => item.model || item.product_code || 'Monitor', detail: (item) => item.manufacturer || '' },
          { label: 'Serial', value: (item) => item.serial_number || 'Not reported' },
          { label: 'Manufactured', width: '120px', value: (item) => item.manufacture_year ? 'Week ' + (item.manufacture_week || '?') + ' · ' + item.manufacture_year : 'Not reported' },
          { label: 'State', width: '90px', value: (item) => item.active === true ? 'Active' : item.active === false ? 'Inactive' : 'Unknown' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Peripherals"
        title="Printers"
        items={printers}
        columns={[
          { label: 'Printer', value: (item) => item.name || 'Printer', detail: (item) => item.driver_name || '' },
          { label: 'Port', value: (item) => item.port_name || 'Not reported' },
          { label: 'Connection', width: '110px', value: (item) => item.network ? 'Network' : 'Local' },
          { label: 'Default', width: '90px', value: (item) => item.default ? 'Yes' : 'No' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Peripherals"
        title="USB devices"
        searchPlaceholder="Search USB devices…"
        items={usbDevices}
        columns={[
          { label: 'Device', value: (item) => item.name || 'USB device', detail: (item) => item.manufacturer || '' },
          { label: 'Class', width: '120px', value: (item) => item.pnp_class || 'Not reported' },
          { label: 'Status', width: '90px', value: (item) => item.status || 'Not reported' },
          { label: 'Device ID', value: (item) => item.device_id || 'Not reported' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Hardware health"
        title="Problem devices"
        detail="PnP devices with a non-zero Windows Config Manager error code."
        items={device.problemDevices || []}
        columns={[
          { label: 'Device', value: (item) => item.name || 'Problem device', detail: (item) => item.manufacturer || '' },
          { label: 'Class', width: '120px', value: (item) => item.pnp_class || 'Not reported' },
          { label: 'Error', width: '100px', value: (item) => item.error_code == null ? 'Not reported' : 'Code ' + item.error_code },
          { label: 'Status', width: '100px', value: (item) => item.status || 'Not reported' },
          { label: 'Device ID', value: (item) => item.device_id || 'Not reported' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Network"
        title="Connection profiles"
        items={device.networkProfiles || []}
        columns={[
          { label: 'Profile', value: (item) => item.name || 'Network', detail: (item) => item.interface_alias || '' },
          { label: 'Category', width: '110px', value: (item) => item.network_category || 'Not reported' },
          { label: 'IPv4', width: '110px', value: (item) => item.ipv4_connectivity || 'Not reported' },
          { label: 'IPv6', width: '110px', value: (item) => item.ipv6_connectivity || 'Not reported' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Network"
        title="IP & DHCP configuration"
        searchPlaceholder="Search adapter, address or DHCP server…"
        items={device.networkConfigurations || []}
        columns={[
          { label: 'Adapter', value: (item) => item.description || 'Network adapter', detail: (item) => item.mac_address || '' },
          { label: 'Addresses', value: (item) => Array.isArray(item.ip_addresses) && item.ip_addresses.length ? item.ip_addresses.join(', ') : 'Not reported' },
          { label: 'DHCP', width: '110px', value: (item) => item.dhcp_enabled ? 'Enabled' : 'Static', detail: (item) => item.dhcp_server || '' },
          { label: 'DNS', value: (item) => Array.isArray(item.dns_servers) && item.dns_servers.length ? item.dns_servers.join(', ') : 'Not reported', detail: (item) => item.dns_domain || '' },
          { label: 'Gateway', value: (item) => Array.isArray(item.gateways) && item.gateways.length ? item.gateways.join(', ') : 'Not reported' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Wireless"
        title="Wi-Fi interfaces"
        items={device.wifiInterfaces || []}
        columns={[
          { label: 'Interface', value: (item) => item.name || 'Wi-Fi', detail: (item) => item.state || '' },
          { label: 'SSID', value: (item) => item.ssid || 'Not connected', detail: (item) => item.bssid || '' },
          { label: 'Signal', width: '100px', value: (item) => item.signal || 'Not reported' },
          { label: 'Channel / radio', value: (item) => [item.channel, item.radio_type].filter(Boolean).join(' · ') || 'Not reported' },
          { label: 'Security', value: (item) => [item.authentication, item.cipher].filter(Boolean).join(' · ') || 'Not reported' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Routing"
        title="Default routes"
        items={device.defaultRoutes || []}
        columns={[
          { label: 'Destination', width: '120px', value: (item) => item.destination || 'Default' },
          { label: 'Next hop', value: (item) => item.next_hop || 'On-link' },
          { label: 'Interface', value: (item) => item.interface_alias || 'Not reported' },
          { label: 'Metric', width: '90px', value: (item) => item.route_metric ?? 'Not reported' },
          { label: 'Protocol', width: '110px', value: (item) => item.protocol || 'Not reported' },
        ]}
      />

      <NetworkAdaptersPanel device={device} />
    </div>
  )
}

function DeviceSoftware({ device }) {
  const deviceOnline = deviceIsOnline(device)
  const [search, setSearch] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [removedKeys, setRemovedKeys] = useState([])
  const [resultByKey, setResultByKey] = useState({})
  const [visibleLimit, setVisibleLimit] = useState(120)
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl

  function softwareKey(app) {
    return `${app.scope || 'unknown'}:${app.registryKey || app.name}:${app.version || ''}`
  }

  function protectedSoftware(app) {
    const value = `${app.name || ''} ${app.publisher || ''}`.toLowerCase()
    return [
      'hi5central', 'chatpass', 'microsoft defender', 'windows defender', 'crowdstrike', 'sentinelone',
      'sophos', 'bitdefender', 'eset', 'malwarebytes', 'webroot', 'cylance', 'carbon black',
      'symantec endpoint', 'trend micro', 'mcafee', 'trellix', 'forticlient', 'huntress',
      'cisco secure', 'cisco amp', 'cortex xdr', 'palo alto cortex', 'avast', 'avg antivirus',
      'kaspersky', 'f-secure', 'withsecure',
    ].some((term) => value.includes(term))
  }

  function uninstallMessage(result) {
    const reason = result?.reason || ''
    if (result?.status === 'uninstalled') return result?.reboot_required ? 'Uninstalled successfully · restart required' : 'Uninstalled successfully'
    if (reason === 'protected_security_or_agent') return result?.detail || 'Protected Agent or security software cannot be removed here.'
    if (reason === 'password_or_vendor_protection_required') return 'The vendor requires a password, tamper-protection change or another authorised removal method.'
    if (reason === 'no_safe_silent_uninstaller_found') return 'No safe silent uninstall method was found for this application.'
    if (reason === 'user_context_or_silent_uninstall_failed') return 'The application is installed for a user profile and could not be removed silently from the available user/system context.'
    if (reason === 'silent_uninstall_failed') return 'Silent uninstall methods were attempted but the application is still installed.'
    return result?.error || 'The uninstall could not be completed.'
  }

  async function waitForAction(jobId) {
    for (let attempt = 0; attempt < 450; attempt += 1) {
      const response = await fetch(`${apiBase}/api/v1/rmm/device-actions/${encodeURIComponent(jobId)}`, { credentials: 'include' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to read uninstall status.')
      if (['completed', 'failed', 'cancelled'].includes(payload.job?.status)) return payload.job
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    }
    throw new Error('The uninstall is still running. Check Jobs for its final result.')
  }

  async function uninstallSoftware(app) {
    if (!deviceOnline || !device.agentDeviceId || busyKey || protectedSoftware(app)) return
    const key = softwareKey(app)
    if (!window.confirm(`Uninstall ${app.name} silently from ${device.name}? Hi5Central will try the vendor command first, verify removal, then try recognised silent fallbacks if needed.`)) return
    setBusyKey(key)
    setResultByKey((current) => ({ ...current, [key]: { tone: 'running', message: 'Preparing silent uninstall…' } }))
    try {
      const response = await fetch(`${apiBase}/api/v1/rmm/devices/${encodeURIComponent(device.agentDeviceId)}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'software.uninstall',
          payload: { name: app.name, registry_key: app.registryKey, scope: app.scope, user_profile: app.userProfile },
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to queue the uninstall.')
      setResultByKey((current) => ({ ...current, [key]: { tone: 'running', message: 'Uninstall running in the background…' } }))
      const job = await waitForAction(payload.job?.id)
      const result = job?.result || {}
      const success = job?.status === 'completed' && result?.status === 'uninstalled'
      setResultByKey((current) => ({ ...current, [key]: { tone: success ? 'healthy' : 'critical', message: uninstallMessage(result), result } }))
      if (success) setRemovedKeys((current) => [...current, key])
    } catch (error) {
      setResultByKey((current) => ({ ...current, [key]: { tone: 'critical', message: error?.message || 'Uninstall failed.' } }))
    } finally {
      setBusyKey('')
    }
  }

  const normalized = search.trim().toLowerCase()
  const visibleSoftware = (device.installedSoftware || []).filter((app) => {
    const key = softwareKey(app)
    if (removedKeys.includes(key)) return false
    return !normalized || [app.name, app.version, app.publisher, app.installLocation].join(' ').toLowerCase().includes(normalized)
  })
  const renderedSoftware = visibleSoftware.slice(0, visibleLimit)

  return (
    <section className="rmm-table-card rmm-device-software-card">
      <div className="rmm-device-section-heading">
        <div><span className="rmm-eyebrow">Inventory</span><h2>Installed software</h2><p>{visibleSoftware.length} applications are reported by the latest real device inventory.</p></div>
        <label className="rmm-device-inline-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleLimit(120) }} placeholder="Search installed software…" /></label>
      </div>
      <div className="rmm-table rmm-device-software-table">
        <div className="rmm-table-head"><span>Application</span><span>Version</span><span>Publisher</span><span>Installed</span><span>Scope / size</span><span>Removal</span></div>
        {renderedSoftware.map((app) => {
          const key = softwareKey(app)
          const protectedApp = protectedSoftware(app)
          const status = resultByKey[key]
          return <div className="rmm-table-row" key={key}>
            <span className="rmm-device-cell"><span className="rmm-device-icon neutral"><Package size={16} /></span><span><strong>{app.name}</strong><small>{app.installLocation || app.scope || 'Observed software'}</small>{status && <small className={`rmm-software-action-state ${status.tone}`}>{status.message}</small>}</span></span>
            <span><strong>{app.version || 'Not reported'}</strong></span>
            <span><strong>{app.publisher || 'Not reported'}</strong></span>
            <span><strong>{app.installed || 'Not reported'}</strong></span>
            <span><strong>{softwareScopeLabel(app.scope)}</strong><small>{app.estimatedSizeKb == null ? 'Size not reported' : formatBytes(Number(app.estimatedSizeKb) * 1024)}</small></span>
            <span>{protectedApp ? <StatusPill tone="neutral">Protected</StatusPill> : !device.agentDeviceId ? <StatusPill tone="neutral">Agent required</StatusPill> : !deviceOnline ? <button className="rmm-software-uninstall" disabled title="Device is offline" type="button"><WifiOff size={13} /> Offline</button> : <button className="rmm-software-uninstall" disabled={busyKey === key} onClick={() => uninstallSoftware(app)} type="button"><Trash2 size={13} /> {busyKey === key ? 'Uninstalling…' : 'Uninstall'}</button>}</span>
          </div>
        })}
      </div>
      {visibleSoftware.length > renderedSoftware.length && <div className="rmm-software-load-more"><button type="button" onClick={() => setVisibleLimit((current) => current + 120)}>Show 120 more <span>{renderedSoftware.length} of {visibleSoftware.length}</span></button></div>}
      {!visibleSoftware.length && <div className="rmm-empty"><Package size={24} /><strong>{search ? 'No software matches this search' : 'No software inventory'}</strong><span>{search ? 'Try another application, version or publisher.' : 'This device does not report installed application inventory.'}</span></div>}
    </section>
  )
}

function DeviceWindows({ device }) {
  const licensing = device.windowsLicensing || {}
  const reboot = device.rebootState || {}
  return <div className="rmm-device-section-grid rmm-system-inventory-grid">
    <section className="rmm-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Windows</span><h2>Operating system state</h2></div></div>
      <div className="rmm-property-grid detailed">
        <DeviceProperty label="Edition" value={device.os} detail={device.version} />
        <DeviceProperty label="Architecture" value={device.architecture} />
        <DeviceProperty label="Windows release" value={device.osDisplayVersion} />
        <DeviceProperty label="Installed" value={device.osInstallDate ? formatInventoryDate(device.osInstallDate) : null} />
        <DeviceProperty label="Last boot" value={device.lastBoot} />
        <DeviceProperty label="Active power plan" value={device.powerPlan} />
        <DeviceProperty label="Deep inventory" value={device.deepInventoryCollectedAt ? new Date(device.deepInventoryCollectedAt).toLocaleString() : null} />
      </div>
    </section>

    <section className="rmm-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Activation</span><h2>Licensing & reboot</h2></div></div>
      <div className="rmm-property-grid detailed">
        <DeviceProperty label="Activation" value={licensing.status} detail={licensing.name || ''} />
        <DeviceProperty label="Partial product key" value={licensing.partial_product_key ? '•••••-' + licensing.partial_product_key : null} />
        <DeviceProperty label="Licence description" value={licensing.description} />
        <DeviceProperty label="Pending reboot" value={reboot.pending === true ? 'Required' : reboot.pending === false ? 'No' : null} detail={Array.isArray(reboot.reasons) ? reboot.reasons.join(' · ') : ''} />
      </div>
    </section>

    <section className="rmm-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Identity</span><h2>Directory join</h2></div></div>
      <div className="rmm-property-grid detailed">
        <DeviceProperty label="Computer name" value={device.directoryJoin?.computer_name || device.name} />
        <DeviceProperty label="AD domain joined" value={device.directoryJoin?.domain_joined === true ? 'Yes' : device.directoryJoin?.domain_joined === false ? 'No' : null} detail={device.directoryJoin?.domain || ''} />
        <DeviceProperty label="Microsoft Entra joined" value={device.directoryJoin?.azure_ad_joined === true ? 'Yes' : device.directoryJoin?.azure_ad_joined === false ? 'No' : null} detail={device.directoryJoin?.entra_tenant_name || ''} />
        <DeviceProperty label="Workplace joined" value={device.directoryJoin?.workplace_joined === true ? 'Yes' : device.directoryJoin?.workplace_joined === false ? 'No' : null} />
        <DeviceProperty label="Domain role" value={device.directoryJoin?.domain_role} />
        <DeviceProperty label="Entra device ID" value={device.directoryJoin?.entra_device_id} />
        <DeviceProperty label="Tenant ID" value={device.directoryJoin?.entra_tenant_id} />
        <DeviceProperty label="Workgroup" value={device.directoryJoin?.workgroup} />
      </div>
    </section>

    <InventoryTableCard
      eyebrow="Windows Update"
      title="Installed updates / KB history"
      detail="Installed Windows hotfix history reported by Get-HotFix."
      items={device.installedHotfixes || []}
      columns={[
        { label: 'KB', width: '110px', value: (item) => item.hotfix_id || 'Not reported' },
        { label: 'Description', value: (item) => item.description || 'Update' },
        { label: 'Installed', width: '120px', value: (item) => item.installed_on || 'Not reported' },
        { label: 'Installed by', value: (item) => item.installed_by || 'Not reported' },
      ]}
    />

    <InventoryTableCard
      eyebrow="Device Manager"
      title="Problem devices"
      detail="PnP devices with a non-zero Windows Config Manager error code."
      items={device.problemDevices || []}
      columns={[
        { label: 'Device', value: (item) => item.name || 'Problem device', detail: (item) => item.manufacturer || '' },
        { label: 'Class', width: '120px', value: (item) => item.pnp_class || 'Not reported' },
        { label: 'Error', width: '100px', value: (item) => item.error_code == null ? 'Not reported' : 'Code ' + item.error_code },
        { label: 'Status', width: '100px', value: (item) => item.status || 'Not reported' },
        { label: 'Device ID', value: (item) => item.device_id || 'Not reported' },
      ]}
    />

    <InventoryTableCard
      eyebrow="Drivers"
      title="Installed device drivers"
      detail="Signed PnP driver inventory including version, date and INF identity."
      searchPlaceholder="Search drivers, devices or INF files…"
      items={device.drivers || []}
      columns={[
        { label: 'Device', value: (item) => item.device_name || 'Device', detail: (item) => item.device_class || '' },
        { label: 'Version', width: '130px', value: (item) => item.driver_version || 'Not reported', detail: (item) => item.driver_date ? formatInventoryDate(item.driver_date) : '' },
        { label: 'Provider', value: (item) => item.driver_provider || item.manufacturer || 'Not reported' },
        { label: 'INF', width: '130px', value: (item) => item.inf_name || 'Not reported' },
        { label: 'Signed', width: '90px', value: (item) => item.signed === true ? 'Yes' : item.signed === false ? 'No' : 'Unknown', detail: (item) => item.signer || '' },
      ]}
    />

    <InventoryTableCard
      eyebrow="Accounts"
      title="Local user accounts"
      searchPlaceholder="Search local users…"
      items={device.localUsers || []}
      columns={[
        { label: 'User', value: (item) => item.name || 'Local user', detail: (item) => item.full_name || item.description || '' },
        { label: 'Enabled', width: '90px', value: (item) => item.enabled === true ? 'Yes' : item.enabled === false ? 'No' : 'Unknown' },
        { label: 'Administrator', width: '110px', value: (item) => item.is_admin === true ? 'Yes' : 'No' },
        { label: 'Last logon', width: '150px', value: (item) => item.last_logon ? new Date(item.last_logon).toLocaleString() : 'Not reported' },
        { label: 'Password last set', width: '150px', value: (item) => item.password_last_set ? new Date(item.password_last_set).toLocaleString() : 'Not reported' },
        { label: 'SID', value: (item) => item.sid || 'Not reported' },
      ]}
    />

    <InventoryTableCard
      eyebrow="Accounts"
      title="Local groups & membership"
      searchPlaceholder="Search local groups or members…"
      items={device.localGroups || []}
      columns={[
        { label: 'Group', value: (item) => item.name || 'Local group', detail: (item) => item.description || '' },
        { label: 'Members', width: '110px', value: (item) => Array.isArray(item.members) ? item.members.length : 0 },
        { label: 'Member names', value: (item) => Array.isArray(item.members) && item.members.length ? item.members.map((member) => member.name).join(', ') : 'No members reported' },
        { label: 'SID', value: (item) => item.sid || 'Not reported' },
      ]}
    />

    <InventoryTableCard
      eyebrow="Startup"
      title="Startup applications"
      items={device.startupItems || []}
      columns={[
        { label: 'Name', value: (item) => item.name || 'Startup item' },
        { label: 'Command', value: (item) => item.command || 'Not reported' },
        { label: 'Location', value: (item) => item.location || 'Not reported' },
        { label: 'User', width: '150px', value: (item) => item.user || 'Not reported' },
      ]}
    />

    <InventoryTableCard
      eyebrow="Automation"
      title="Scheduled tasks"
      searchPlaceholder="Search scheduled tasks…"
      items={device.scheduledTasks || []}
      columns={[
        { label: 'Task', value: (item) => item.name || 'Scheduled task', detail: (item) => item.path || '' },
        { label: 'State', width: '100px', value: (item) => item.state || 'Not reported' },
        { label: 'Author', value: (item) => item.author || 'Not reported' },
        { label: 'Description', value: (item) => item.description || 'Not reported' },
      ]}
    />

    <InventoryTableCard
      eyebrow="Windows"
      title="Enabled optional features"
      items={device.optionalFeatures || []}
      columns={[
        { label: 'Feature', value: (item) => item.name || 'Windows feature' },
        { label: 'State', width: '120px', value: (item) => item.state || 'Enabled' },
      ]}
    />
  </div>
}

function devicePatchVulnerabilityTone(item) {
  const exploitation = String(item?.ssvc_exploitation || '').toLowerCase()
  const cvss = Number(item?.cvss_score || 0)
  if (item?.kev || item?.cisa_kev || item?.cisaKev || exploitation === 'active' || cvss >= 9) return 'critical'
  if (cvss >= 7 || exploitation === 'poc') return 'warning'
  return 'neutral'
}

function DevicePatchVulnerabilityDetails({ detail, onClose }) {
  if (!detail) return null
  const row = detail.row || {}
  const vulnerabilities = detail.vulnerabilities || []
  const maxCvss = vulnerabilities.reduce((max, item) => Math.max(max, Number(item?.cvss_score || 0)), 0)
  const maxEpss = vulnerabilities.reduce((max, item) => Math.max(max, Number(item?.epss_score || 0)), 0)
  const kevCount = vulnerabilities.filter((item) => item?.kev || item?.cisa_kev || item?.cisaKev).length
  const modal = <div className="rmm-patch-vuln-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="rmm-patch-vuln-sheet" role="dialog" aria-modal="true" aria-label={(row.name || 'Application') + ' linked vulnerabilities'}>
      <header>
        <div><span className="rmm-eyebrow">Linked vulnerabilities</span><h2>{row.name || 'Application patch'}</h2><p>{row.installedVersion || 'Unknown version'} → {row.targetVersion || row.availableVersion || 'Target version not reported'}</p></div>
        <button onClick={onClose} type="button" aria-label="Close vulnerability details"><X size={19} /></button>
      </header>
      <div className="rmm-patch-vuln-summary">
        <span><small>Linked CVEs</small><strong>{vulnerabilities.length}</strong></span>
        <span><small>Max CVSS</small><strong>{maxCvss > 0 ? maxCvss.toFixed(1) : '—'}</strong></span>
        <span><small>Max EPSS</small><strong>{maxEpss > 0 ? (maxEpss * 100).toFixed(1) + '%' : '—'}</strong></span>
        <span><small>CISA KEV</small><strong>{kevCount}</strong></span>
      </div>
      <div className="rmm-patch-vuln-list">
        {vulnerabilities.map((item) => {
          const epss = item.epss_score == null ? null : Number(item.epss_score)
          const percentile = item.epss_percentile == null ? null : Number(item.epss_percentile)
          const exploitation = String(item.ssvc_exploitation || '').toLowerCase()
          const remediationTarget = item.remediation_target_version || item.fixed_version || row.targetVersion || row.availableVersion || ''
          return <article key={item.id || item.cve_id}>
            <div className="rmm-patch-vuln-title">
              <div><strong>{item.cve_id || 'CVE pending'}</strong><small>{item.source || 'Vulnerability intelligence'}</small></div>
              <StatusPill tone={devicePatchVulnerabilityTone(item)}>{item.kev || item.cisa_kev || item.cisaKev ? 'CISA KEV' : item.severity || (Number(item.cvss_score || 0) >= 9 ? 'Critical' : Number(item.cvss_score || 0) >= 7 ? 'High' : 'Observed')}</StatusPill>
            </div>
            <div className="rmm-patch-vuln-metrics">
              <span><small>CVSS</small><strong>{item.cvss_score ?? '—'}</strong><em>{item.cvss_version || 'Score pending'}</em></span>
              <span><small>EPSS</small><strong>{epss == null ? '—' : (epss * 100).toFixed(1) + '%'}</strong><em>{percentile == null ? 'Percentile pending' : Math.round(percentile * 100) + 'th percentile'}</em></span>
              <span><small>Exploitation</small><strong>{item.kev || item.cisa_kev || item.cisaKev ? 'Known exploited' : exploitation === 'active' ? 'Active' : exploitation === 'poc' ? 'PoC observed' : 'Not reported'}</strong><em>{item.known_ransomware_use ? 'Ransomware: ' + item.known_ransomware_use : ''}</em></span>
              <span><small>Remediation</small><strong>{remediationTarget || 'No fixed version reported'}</strong><em>{String(item.remediation_state || item.status || '').replaceAll('_', ' ') || 'Observed'}</em></span>
            </div>
            <p>{item.summary || 'Description pending vulnerability enrichment.'}</p>
          </article>
        })}
      </div>
    </section>
  </div>
  return createPortal(modal, document.querySelector('.rmm-app') || document.body)
}

function DevicePatching({ device }) {
  const windowsUpdates = device.patches || []
  const online = deviceIsOnline(device)
  const [bundle, setBundle] = useState(null)
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [vulnerabilityDetail, setVulnerabilityDetail] = useState(null)
  const refresh = () => loadRmmPatching().then(setBundle).catch((error) => setMessage(error?.message || 'Patch state could not be loaded.'))
  useEffect(() => { refresh() }, [device.agentDeviceId])
  const rejections = (bundle?.devicePatchRejections || []).filter((row) => row.agent_device_id === device.agentDeviceId)
  const rejectionFor = (row) => rejections.find((item) => item.catalogue_id === row.catalogue?.id && item.target_version === (row.targetVersion || row.availableVersion))
  const actionableUpdate = (row) => row.catalogue?.installable === true
  const appUpdates = (bundle?.deviceSoftware || []).filter((row) => row.agentDeviceId === device.agentDeviceId && row.patchStatus === 'update_available' && actionableUpdate(row) && !rejectionFor(row))
  const ignoredUpdates = (bundle?.deviceSoftware || []).filter((row) => row.agentDeviceId === device.agentDeviceId && row.patchStatus === 'update_available' && actionableUpdate(row) && rejectionFor(row))
  const exposures = bundle?.vulnerabilityExposureRows || []
  async function patch(rows) {
    if (!online || busy || !rows.length) return
    setBusy(true); setMessage('')
    try {
      let dispatched
      if (rows.length === 1) dispatched = await deploySoftwarePatch(device.agentDeviceId, rows[0].catalogue.id)
      else if (rows.length === appUpdates.length) dispatched = await deploySoftwarePatches(device.agentDeviceId, [], 'all_catalogue')
      else dispatched = await deploySoftwarePatches(device.agentDeviceId, rows.map((row) => row.catalogue.id))
      setSelected([])
      const dispatchedCount = Number(dispatched?.itemCount || (rows.length === 1 ? 1 : rows.length))
      const skipped = [
        ...(Array.isArray(dispatched?.rejected) ? dispatched.rejected : []),
        ...(Array.isArray(dispatched?.ignored) ? dispatched.ignored : []),
      ]
      const skippedDetail = skipped[0]
        ? ` ${skipped.length} skipped: ${skipped[0].applicationName || 'Application'} — ${skipped[0].error || skipped[0].reason || 'not eligible'}.`
        : ''
      setMessage(`${dispatchedCount} update${dispatchedCount === 1 ? '' : 's'} dispatched.${skippedDetail} Follow progress in Jobs and Activity.`)
    } catch (error) {
      const rejected = Array.isArray(error?.data?.rejected) ? error.data.rejected : []
      setMessage(rejected.length ? `Nothing was queued. ${rejected[0].error}` : (error?.message || 'The patch request could not be dispatched.'))
    } finally {
      setBusy(false); refresh()
    }
  }
  async function ignorePatch(row) {
    if (!row.catalogue?.id) return
    setBusy(true); setMessage('')
    try { await rejectDeviceSoftwarePatch(device.agentDeviceId, row.catalogue.id, row.targetVersion || row.availableVersion, 'Ignored from Device Details'); setMessage('Update ignored for this device and exact target version.') }
    catch (error) { setMessage(error?.message || 'Update could not be ignored.') }
    finally { setBusy(false); refresh() }
  }
  async function restorePatch(row) {
    const rejection = rejectionFor(row); if (!rejection) return
    setBusy(true); setMessage('')
    try { await restoreDeviceSoftwarePatch(rejection.id); setMessage('Ignored update restored for this device.') }
    catch (error) { setMessage(error?.message || 'Update could not be restored.') }
    finally { setBusy(false); refresh() }
  }
  const selectedRows = appUpdates.filter((row) => selected.includes(row.catalogue?.id))
  return <>
    <div className="rmm-device-patch-summary"><div><span><PackageCheck size={18} /></span><div><strong>{appUpdates.length}</strong><small>Application updates</small></div></div><div><span><ShieldCheck size={18} /></span><div><strong>{device.pendingWindowsPatches ?? 'Not reported'}</strong><small>Windows updates</small></div></div><div><span><Clock3 size={18} /></span><div><strong>{device.inventory?.windows_updates?.last_scan_utc ? new Date(device.inventory.windows_updates.last_scan_utc).toLocaleString() : 'Not reported'}</strong><small>Last scan</small></div></div></div>
    <section className="rmm-table-card rmm-device-app-patching-card"><div className="rmm-device-section-heading"><div><span className="rmm-eyebrow">Device-scoped patching</span><h2>Application updates</h2><p>Vendor catalogue and WinGet discovery combined for this endpoint.</p></div><div className="rmm-row-actions"><button disabled={!online || busy || !selectedRows.length} onClick={() => patch(selectedRows)} type="button">Patch selected ({selectedRows.length})</button><button className="rmm-primary" disabled={!online || busy || !appUpdates.length} onClick={() => patch(appUpdates)} type="button">Patch all</button></div></div>
    {!online && <div className="rmm-device-action-message"><WifiOff size={14} /> Offline — update state is visible but execution is disabled and no job is queued.</div>}{message && <div className="rmm-device-action-message">{message}</div>}
    <div className="rmm-table rmm-device-patch-table rmm-app-patch-table"><div className="rmm-table-head"><span>Select</span><span>Application</span><span>Version</span><span>Provider / trust</span><span>Vulnerabilities</span><span>Action</span></div>{appUpdates.map((row) => { const id = row.catalogue?.id; const vulns = exposures.filter((v) => v.agent_device_id === device.agentDeviceId && v.catalogue_id === id); const kev = vulns.some((v) => v.kev || v.cisa_kev || v.cisaKev); return <div className="rmm-table-row" key={row.inventoryId + ':' + (id || row.applicationKey)}><span><input checked={selected.includes(id)} disabled={!online || !id} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((value) => value !== id))} type="checkbox" /></span><span><strong>{row.name}</strong><small>{row.publisher || row.catalogue?.publisher || 'Publisher not reported'}</small></span><span><strong>{row.installedVersion || '—'} → {row.targetVersion || row.availableVersion || '—'}</strong></span><span><strong>{row.provider || row.catalogue?.provider || 'catalogue'}</strong><small>{row.catalogue?.qualificationState || 'qualification pending'}</small></span><span><button className="rmm-linked-cves" disabled={!vulns.length} onClick={() => vulns.length && setVulnerabilityDetail({ row, vulnerabilities: vulns })} type="button"><strong>{vulns.length ? `${vulns.length} linked CVEs` : 'No linked exposure'}</strong>{vulns.length ? <ChevronRight size={13} /> : null}</button><small>{kev ? 'CISA KEV' : ''}</small></span><span><div className="rmm-row-actions"><button disabled={!online || busy || !id} onClick={() => patch([row])} type="button">Patch</button><button disabled={busy || !id} onClick={() => ignorePatch(row)} type="button">Ignore</button></div></span></div> })}</div>
    {!appUpdates.length && <div className="rmm-empty"><PackageCheck size={24} /><strong>{bundle ? 'No application updates detected' : 'Loading application patch state…'}</strong><span>Only installed software with a verified update is offered here.</span></div>}
    {ignoredUpdates.length > 0 && <div className="rmm-device-ignored-patches"><strong>Ignored on this device ({ignoredUpdates.length})</strong>{ignoredUpdates.map((row) => <div className="rmm-device-action-message" key={'ignored:' + row.catalogue?.id}><span>{row.name} · {row.targetVersion || row.availableVersion}</span><button disabled={busy} onClick={() => restorePatch(row)} type="button">Restore</button></div>)}</div>}</section>
    <section className="rmm-table-card rmm-device-windows-patching-card"><div className="rmm-device-section-heading"><div><span className="rmm-eyebrow">Windows Update</span><h2>Pending Windows updates</h2><p>Reported directly by the Windows Update Agent.</p></div></div>
    <div className="rmm-table rmm-device-patch-table"><div className="rmm-table-head"><span>Update</span><span>Categories</span><span>Severity</span><span>Downloaded</span><span>Mandatory</span><span>Reboot</span></div>{windowsUpdates.map((item, index) => <div className="rmm-table-row" key={(item.kb || []).join('-') || item.title || index}><span><strong>{item.title || 'Windows update'}</strong><small>{(item.kb || []).map((kb) => 'KB' + kb).join(', ') || 'No KB reference'}</small></span><span>{(item.categories || []).join(', ') || 'Not classified'}</span><span>{item.severity || 'Not rated'}</span><span>{item.downloaded ? 'Yes' : 'No'}</span><span>{item.mandatory ? 'Yes' : 'No'}</span><span>{item.reboot_required ? 'Required' : 'No'}</span></div>)}</div>
    {!windowsUpdates.length && <div className="rmm-empty"><ShieldCheck size={24} /><strong>No pending Windows updates reported</strong></div>}</section>
    <DevicePatchVulnerabilityDetails detail={vulnerabilityDetail} onClose={() => setVulnerabilityDetail(null)} />
  </>
}


function BitLockerRecoveryPanel({ device }) {
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl
  const [state, setState] = useState({ loading: true, canReveal: false, items: [], entra: { linked: false, status: 'not_linked', keys: [] } })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState({})

  async function loadRecovery() {
    if (!device.agentDeviceId) {
      setState({ loading: false, canReveal: false, items: [], entra: { linked: false, status: 'not_linked', keys: [] } })
      return
    }
    try {
      const response = await fetch(apiBase + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/bitlocker-recovery', { credentials: 'include' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load recovery-key status.')
      setState({ loading: false, canReveal: Boolean(payload.canReveal), items: Array.isArray(payload.items) ? payload.items : [], entra: payload.entra || { linked: false, status: 'not_linked', keys: [] } })
    } catch (error) {
      setState((current) => ({ ...current, loading: false }))
      setMessage(error?.message || 'Unable to load recovery-key status.')
    }
  }

  useEffect(() => {
    let active = true
    if (!device.agentDeviceId) {
      setState({ loading: false, canReveal: false, items: [], entra: { linked: false, status: 'not_linked', keys: [] } })
      return () => { active = false }
    }
    fetch(apiBase + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/bitlocker-recovery', { credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to load recovery-key status.')
        if (active) setState({ loading: false, canReveal: Boolean(payload.canReveal), items: Array.isArray(payload.items) ? payload.items : [], entra: payload.entra || { linked: false, status: 'not_linked', keys: [] } })
      })
      .catch((error) => { if (active) { setState((current) => ({ ...current, loading: false })); setMessage(error?.message || 'Unable to load recovery-key status.') } })
    return () => { active = false }
  }, [apiBase, device.agentDeviceId])

  async function requestEscrow() {
    if (!device.agentDeviceId || busy) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(apiBase + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/bitlocker-recovery/escrow', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Recovery-key escrow could not be requested.')
      setMessage('Escrow requested. Waiting for the Agent to return the recovery protector…')
      await new Promise((resolve) => window.setTimeout(resolve, 1500))
      await loadRecovery()
    } catch (error) {
      setMessage(error?.message || 'Recovery-key escrow could not be requested.')
    } finally {
      setBusy(false)
    }
  }

  async function reveal(item) {
    if (!state.canReveal || busy) return
    const reason = window.prompt('Why do you need to reveal this BitLocker recovery key?')
    if (!reason || reason.trim().length < 3) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(apiBase + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/bitlocker-recovery/' + encodeURIComponent(item.id) + '/reveal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Recovery key could not be revealed.')
      const password = String(payload.recoveryPassword || '')
      setRevealed((current) => ({ ...current, [item.id]: password }))
      window.setTimeout(() => setRevealed((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      }), 60_000)
      await loadRecovery()
    } catch (error) {
      setMessage(error?.message || 'Recovery key could not be revealed.')
    } finally {
      setBusy(false)
    }
  }


  async function revealEntra(item) {
    if (!state.canReveal || busy) return
    const reason = window.prompt('Why do you need to reveal this Microsoft Entra BitLocker recovery key?')
    if (!reason || reason.trim().length < 3) return
    const revealId = 'entra:' + item.id
    setBusy(true); setMessage('')
    try {
      const response = await fetch(apiBase + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/bitlocker-recovery/entra/' + encodeURIComponent(item.id) + '/reveal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Microsoft Entra recovery key could not be revealed.')
      const password = String(payload.recoveryPassword || '')
      setRevealed((current) => ({ ...current, [revealId]: password }))
      window.setTimeout(() => setRevealed((current) => {
        const next = { ...current }
        delete next[revealId]
        return next
      }), 60_000)
    } catch (error) {
      setMessage(error?.message || 'Microsoft Entra recovery key could not be revealed.')
    } finally {
      setBusy(false)
    }
  }

  const volumes = Array.isArray(device.bitlockerVolumes) ? device.bitlockerVolumes : []
  const activeKeys = state.items.filter((item) => item.active)
  const entraKeys = Array.isArray(state.entra?.keys) ? state.entra.keys : []
  const hasRecoveryProtector = volumes.some((volume) => Number(volume.recovery_protector_count || 0) > 0 || volume.recovery_password_present === true)
  const hasRecoveryBackup = activeKeys.length > 0 || entraKeys.length > 0
  return <section className="rmm-card rmm-bitlocker-recovery-card">
    <div className="rmm-card-heading">
      <div><span className="rmm-eyebrow">BitLocker</span><h2>Encryption & recovery</h2></div>
      <StatusPill tone={hasRecoveryBackup ? 'healthy' : hasRecoveryProtector ? 'warning' : 'neutral'}>{hasRecoveryBackup ? 'Recovery backed up' : hasRecoveryProtector ? 'Recovery not escrowed' : 'No recovery protector'}</StatusPill>
    </div>
    <div className="rmm-bitlocker-volume-list">
      {volumes.map((volume, index) => {
        const protectors = Array.isArray(volume.key_protectors) ? volume.key_protectors : []
        const matching = activeKeys.filter((item) => String(item.drive || '').toLowerCase() === String(volume.drive || volume.mount_point || '').toLowerCase())
        return <article key={(volume.drive || volume.mount_point || 'volume') + ':' + index}>
          <div className="rmm-bitlocker-volume-heading">
            <span><HardDrive size={16} /></span>
            <div><strong>{volume.drive || volume.mount_point || 'Volume'}</strong><small>{volume.volume_status || 'Status not reported'} · {volume.encryption_method || 'Method not reported'}</small></div>
            <StatusPill tone={String(volume.protection_status).toLowerCase() === 'on' ? 'healthy' : 'neutral'}>{volume.protection_status || 'Unknown'}</StatusPill>
          </div>
          <div className="rmm-bitlocker-volume-meta">
            <span><small>Encrypted</small><strong>{volume.encryption_percentage == null ? 'Not reported' : volume.encryption_percentage + '%'}</strong></span>
            <span><small>Lock state</small><strong>{volume.lock_status || 'Not reported'}</strong></span>
            <span><small>Protectors</small><strong>{volume.key_protector_count ?? protectors.length}</strong></span>
            <span><small>Recovery protectors</small><strong>{volume.recovery_protector_count ?? protectors.filter((item) => String(item.type).toLowerCase() === 'recoverypassword').length}</strong></span>
          </div>
          {protectors.length > 0 && <div className="rmm-bitlocker-protectors">{protectors.map((protector, protectorIndex) => <span key={(protector.id || protector.type || 'protector') + ':' + protectorIndex}><KeyRound size={12} /><strong>{protector.type || 'Protector'}</strong><small>{protector.id || 'ID not reported'}</small></span>)}</div>}
          {matching.map((item) => <div className="rmm-recovery-key-row" key={item.id}>
            <div><strong>Recovery password escrowed</strong><small>Protector {item.protectorId} · Last seen {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : 'Not reported'}</small></div>
            {revealed[item.id]
              ? <div className="rmm-recovery-key-revealed"><code>{revealed[item.id]}</code><button onClick={() => navigator.clipboard?.writeText(revealed[item.id])} type="button">Copy</button><button onClick={() => setRevealed((current) => { const next = { ...current }; delete next[item.id]; return next })} type="button">Hide</button></div>
              : <button disabled={!state.canReveal || busy} onClick={() => reveal(item)} type="button">{state.canReveal ? 'Reveal recovery key' : 'Reveal restricted'}</button>}
          </div>)}
        </article>
      })}
      {state.entra?.linked && <article className="rmm-bitlocker-entra-source">
        <div className="rmm-bitlocker-volume-heading">
          <span><KeyRound size={16} /></span>
          <div><strong>Microsoft Entra recovery backup</strong><small>{state.entra.connectionName || 'Microsoft 365'} · Device {state.entra.directoryDeviceId || 'linked'}</small></div>
          <StatusPill tone={entraKeys.length ? 'healthy' : state.entra.status === 'permission_required' ? 'warning' : 'neutral'}>
            {entraKeys.length ? entraKeys.length + ' key' + (entraKeys.length === 1 ? '' : 's') : state.entra.status === 'permission_required' ? 'Permission required' : state.entra.status === 'error' ? 'Lookup unavailable' : 'No keys'}
          </StatusPill>
        </div>
        {state.entra.status === 'permission_required' && <div className="rmm-bitlocker-entra-note"><strong>Microsoft recovery access needs admin consent</strong><span>Add the Microsoft Graph application permission <code>BitLockerKey.Read.All</code> to the Hi5Central app registration and grant tenant admin consent. Agent escrow remains independent.</span></div>}
        {state.entra.status === 'error' && <div className="rmm-bitlocker-entra-note"><strong>Microsoft recovery lookup failed</strong><span>{state.entra.error || 'The Microsoft connection could not return BitLocker recovery metadata.'}</span></div>}
        {entraKeys.map((item) => {
          const revealId = 'entra:' + item.id
          return <div className="rmm-recovery-key-row" key={revealId}>
            <div><strong>Recovery key backed up to Microsoft Entra</strong><small>{item.volumeType || 'Volume type not reported'} · Backed up {item.createdDateTime ? new Date(item.createdDateTime).toLocaleString() : 'date not reported'} · Key {item.id}</small></div>
            {revealed[revealId]
              ? <div className="rmm-recovery-key-revealed"><code>{revealed[revealId]}</code><button onClick={() => navigator.clipboard?.writeText(revealed[revealId])} type="button">Copy</button><button onClick={() => setRevealed((current) => { const next = { ...current }; delete next[revealId]; return next })} type="button">Hide</button></div>
              : <button disabled={!state.canReveal || busy} onClick={() => revealEntra(item)} type="button">{state.canReveal ? 'Reveal Entra key' : 'Reveal restricted'}</button>}
          </div>
        })}
      </article>}
    </div>
    {!volumes.length && !state.entra?.linked && <div className="rmm-empty compact"><KeyRound size={22} /><strong>BitLocker inventory not reported</strong><span>Refresh inventory after the Agent reconnects.</span></div>}
    {hasRecoveryProtector && !activeKeys.length && <div className="rmm-bitlocker-escrow-callout"><div><strong>{entraKeys.length ? 'Microsoft Entra recovery backup is available' : 'Recovery password is not backed up in Hi5Central'}</strong><span>{entraKeys.length ? 'You can also escrow the local recovery protector in Hi5Central for an independent recovery path.' : 'Escrow it securely now so it remains available even if the endpoint cannot boot.'}</span></div><button disabled={!deviceIsOnline(device) || busy} onClick={requestEscrow} type="button"><KeyRound size={14} /> {busy ? 'Requesting…' : entraKeys.length ? 'Also escrow in Hi5Central' : 'Escrow now'}</button></div>}
    {message && <div className="rmm-device-action-message">{message}</div>}
  </section>
}

function DeviceSecurity({ device }) {
  const security = device.security || {}
  const checks = [
    ['Disk encryption', security.encryptionState, security.encryption],
    ['Antivirus', security.avState, security.av],
    ['Endpoint detection', security.edrState, security.edr],
    ['Host firewall', security.firewall, 'Operating system firewall state'],
    ['Secure boot', security.secureBoot, 'Boot integrity'],
    ['TPM / trust', security.tpm, 'Hardware-backed trust capability'],
  ]
  const securityDetails = device.securityDetails || {}
  const defender = securityDetails.defender || {}
  const tpm = securityDetails.tpm || {}
  const firewallProfiles = Array.isArray(securityDetails.firewall_profiles) ? securityDetails.firewall_profiles : []
  const machineCertificates = Array.isArray(device.machineCertificates) ? device.machineCertificates : []
  return <>
    <div className="rmm-security-grid">{checks.map(([label, state, detail]) => <article className="rmm-card" key={label}><span className={`rmm-security-card-icon ${securityTone(state)}`}><ShieldCheck size={20} /></span><span className="rmm-eyebrow">{label}</span><h2>{state || 'Not reported'}</h2><p>{detail}</p><StatusPill tone={securityTone(state)}>{securityTone(state) === 'healthy' ? 'Compliant' : securityTone(state) === 'critical' ? 'Action required' : 'Observed'}</StatusPill></article>)}</div>

    <div className="rmm-device-section-grid rmm-security-detail-grid">
      <BitLockerRecoveryPanel device={device} />

      <section className="rmm-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Microsoft Defender</span><h2>Antivirus detail</h2></div></div>
        <div className="rmm-property-grid detailed">
          <DeviceProperty label="Antivirus" value={defender.antivirus_enabled === true ? 'Enabled' : defender.antivirus_enabled === false ? 'Disabled' : null} />
          <DeviceProperty label="Real-time protection" value={defender.realtime_protection_enabled === true ? 'Enabled' : defender.realtime_protection_enabled === false ? 'Disabled' : null} />
          <DeviceProperty label="Behavior monitoring" value={defender.behavior_monitor_enabled === true ? 'Enabled' : defender.behavior_monitor_enabled === false ? 'Disabled' : null} />
          <DeviceProperty label="Tamper protection" value={defender.is_tamper_protected === true ? 'Enabled' : defender.is_tamper_protected === false ? 'Disabled' : null} detail={defender.tamper_protection_source || ''} />
          <DeviceProperty label="Engine version" value={defender.engine_version} />
          <DeviceProperty label="Platform version" value={defender.product_version} />
          <DeviceProperty label="Signature version" value={defender.antivirus_signature_version} detail={defender.antivirus_signature_last_updated ? 'Updated ' + new Date(defender.antivirus_signature_last_updated).toLocaleString() : ''} />
          <DeviceProperty label="Last quick scan" value={defender.quick_scan_end ? new Date(defender.quick_scan_end).toLocaleString() : null} detail={defender.quick_scan_age_days == null ? '' : defender.quick_scan_age_days + ' days old'} />
          <DeviceProperty label="Last full scan" value={defender.full_scan_end ? new Date(defender.full_scan_end).toLocaleString() : null} detail={defender.full_scan_age_days == null ? '' : defender.full_scan_age_days + ' days old'} />
        </div>
      </section>

      <section className="rmm-card">
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Trusted Platform Module</span><h2>TPM detail</h2></div></div>
        <div className="rmm-property-grid detailed">
          <DeviceProperty label="Present" value={tpm.present === true ? 'Yes' : tpm.present === false ? 'No' : null} />
          <DeviceProperty label="Enabled" value={tpm.enabled === true ? 'Yes' : tpm.enabled === false ? 'No' : null} />
          <DeviceProperty label="Activated" value={tpm.activated === true ? 'Yes' : tpm.activated === false ? 'No' : null} />
          <DeviceProperty label="Owned" value={tpm.owned === true ? 'Yes' : tpm.owned === false ? 'No' : null} />
          <DeviceProperty label="Ready" value={tpm.ready === true ? 'Yes' : tpm.ready === false ? 'No' : null} />
          <DeviceProperty label="Specification" value={tpm.spec_version} />
          <DeviceProperty label="Manufacturer ID" value={tpm.manufacturer_id} />
          <DeviceProperty label="Manufacturer version" value={tpm.manufacturer_version} />
        </div>
      </section>

      <InventoryTableCard
        eyebrow="Firewall"
        title="Windows Firewall profiles"
        items={firewallProfiles}
        columns={[
          { label: 'Profile', value: (item) => item.name || 'Firewall profile' },
          { label: 'Enabled', width: '90px', value: (item) => item.enabled === true ? 'Yes' : item.enabled === false ? 'No' : 'Unknown' },
          { label: 'Inbound', width: '110px', value: (item) => item.default_inbound_action || 'Not reported' },
          { label: 'Outbound', width: '110px', value: (item) => item.default_outbound_action || 'Not reported' },
          { label: 'Logging', value: (item) => [item.log_allowed ? 'Allowed' : '', item.log_blocked ? 'Blocked' : ''].filter(Boolean).join(' + ') || 'Off', detail: (item) => item.log_file || '' },
        ]}
      />

      <InventoryTableCard
        eyebrow="Certificates"
        title="Machine certificates"
        detail="Public certificate metadata from LocalMachine personal/web-hosting stores. Private key material is never collected."
        searchPlaceholder="Search certificate subject, issuer or thumbprint…"
        items={machineCertificates}
        columns={[
          { label: 'Subject', value: (item) => item.subject || item.friendly_name || 'Certificate', detail: (item) => item.store || '' },
          { label: 'Issuer', value: (item) => item.issuer || 'Not reported' },
          { label: 'Expires', width: '130px', value: (item) => item.not_after ? formatInventoryDate(item.not_after) : 'Not reported' },
          { label: 'Private key', width: '100px', value: (item) => item.has_private_key ? 'Present locally' : 'No' },
          { label: 'Thumbprint', value: (item) => item.thumbprint || 'Not reported' },
        ]}
      />

    </div>
  </>
}

function DeviceItsm({ relatedTickets, onCreateIncident }) {
  return (
    <div className="rmm-device-itsm-layout">
      <section className="rmm-card rmm-itsm-bridge-intro"><span className="rmm-itsm-logo"><Database size={24} /></span><span className="rmm-eyebrow">Native product bridge</span><h2>RMM device ↔ ITSM service context</h2><p>Keep Hi5Central RMM and Hi5Central ITSM as separate products while sharing device identity, requester context and operational history when both modules are licensed.</p><div><span><CheckCircle2 size={15} /> Create an ITSM incident directly from a device or alert</span><span><CheckCircle2 size={15} /> Carry hostname, device ID and alert metadata into the incident</span><span><CheckCircle2 size={15} /> Open related ITSM records without putting ITSM navigation inside RMM</span><span><CheckCircle2 size={15} /> Open the originating RMM device again from the ITSM record</span></div><button className="rmm-primary" onClick={() => onCreateIncident()} type="button"><AlertTriangle size={15} /> Create incident for this device</button></section>
      <section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Related records</span><h2>ITSM history</h2></div></div><div className="rmm-device-itsm-records">{relatedTickets.length ? relatedTickets.map((ticket) => <a href={itsmRecordHref(ticket)} key={ticket.id} target="_blank" rel="noreferrer"><span className={`rmm-itsm-record-type ${String(ticket.type).toLowerCase().replace(/\s+/g, '-')}`}>{ticket.type}</span><span><strong>{ticket.id} · {ticket.title}</strong><small>{ticket.status} · {ticket.team || 'Unassigned group'} · Updated {ticket.updated}</small></span><ExternalLink size={15} /></a>) : <div className="rmm-empty"><Database size={24} /><strong>No ITSM history for this device yet</strong><span>Create an incident to link support history to this device.</span></div>}</div></section>
    </div>
  )
}

function RmmDeviceDetail({ canBackstageRemote = false, canRemote = false, device, initialSection = 'overview', initialTool = '', onBack, onDeviceRoute, navigate, onCreateIncident, tickets = [] }) {
  const [section, setSection] = useState(initialSection || 'overview')
  const hasLiveAgent = Boolean(device.agentDeviceId)
  const deviceOnline = deviceIsOnline(device)
  const deviceOffline = hasLiveAgent && !deviceOnline
  const [tool, setTool] = useState(initialTool || '')
  const subnavRef = useRef(null)
  const [remoteState, setRemoteState] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [powerBusy, setPowerBusy] = useState(false)
  const [monitoringResolution, setMonitoringResolution] = useState(null)
  const [patchPolicyResolution, setPatchPolicyResolution] = useState(null)
  const [patchPolicyLoading, setPatchPolicyLoading] = useState(true)
  const deviceAlerts = rmmAlerts.filter((alert) => alert.deviceId === device.id)
  const relatedTickets = tickets.filter((ticket) => (
    ticket.rmmDeviceId === device.id
    || ticket.rmmDeviceName === device.name
    || (ticket.linkedAssets || []).includes(device.id)
    || (ticket.linkedAssets || []).includes(device.name)
    || (device.relatedRecordIds || []).includes(ticket.id)
    || (device.user && ticket.requester === device.user)
  ))
  const apiBase = window.__HI5_API_BASE__ || deploymentConfig().apiUrl

  useEffect(() => {
    prefetchDeviceHistory(device).catch(() => {})
  }, [device.agentDeviceId])

  useEffect(() => {
    setSection(initialSection || 'overview')
    setTool(initialSection === 'tools' ? (initialTool || '') : '')
  }, [device.id, initialSection, initialTool])

  useEffect(() => {
    const nav = subnavRef.current
    if (!nav) return
    const active = nav.querySelector('[aria-current="page"]')
    if (!active) return
    const frame = window.requestAnimationFrame(() => {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [section])

  useEffect(() => {
    let active = true
    loadRmmScope()
      .then((payload) => {
        if (!active) return
        const resolved = (payload.monitoring?.effectivePolicies || []).find((item) => item.deviceId === device.id)
        setMonitoringResolution(resolved || null)
      })
      .catch(() => { if (active) setMonitoringResolution(null) })
    return () => { active = false }
  }, [device.id])

  useEffect(() => {
    let active = true
    setPatchPolicyLoading(true)
    setPatchPolicyResolution(null)
    loadDevicePatchPolicyResolution(device.agentDeviceId || device.id)
      .then((payload) => {
        if (!active) return
        setPatchPolicyResolution(payload || null)
      })
      .catch(() => {
        if (!active) return
        setPatchPolicyResolution(null)
      })
      .finally(() => {
        if (active) setPatchPolicyLoading(false)
      })
    return () => { active = false }
  }, [device.id, device.agentDeviceId])

  const sections = [
    ['overview', 'Overview', CircleGauge],
    ['hardware', 'Hardware', Cpu],
    ['windows', 'Windows', Settings],
    ['software', 'Software', Package],
    ['patching', 'Patching', ShieldCheck],
    ['security', 'Security', ShieldCheck],
    ['tools', 'Tools', TerminalSquare],
    ['activity', 'Activity', History],
    ['jobs', 'Jobs', ListChecks],
    ['itsm', 'ITSM', Database],
  ]

  function createIncident(alert) {
    onCreateIncident?.({ device, alert })
  }

  async function startRemote(mode = 'console') {
    if (!hasLiveAgent) {
      setRemoteState('Remote tools require the Hi5Central Agent on this device.')
      return
    }
    if (!deviceOnline) {
      setRemoteState('This device is offline. Live remote sessions cannot be started.')
      return
    }
    if (mode === 'backstage' && !canBackstageRemote) {
      setRemoteState('Your role does not include Background remote access.')
      return
    }
    if (mode === 'console' && !canRemote) {
      setRemoteState('Your role does not include unattended remote access.')
      return
    }
    setRemoteBusy(true)
    setRemoteState(mode === 'backstage' ? 'Starting Background session…' : 'Starting remote desktop…')
    try {
      const viewerTarget = detectRemoteViewerClient()
      const response = await fetch(apiBase + '/api/v1/rmm/remote-sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDeviceId: device.agentDeviceId,
          mode,
          viewerClient: viewerTarget.viewerClient,
          viewerDeviceClass: viewerTarget.deviceClass,
          viewerDetection: viewerTarget.reason,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to start remote session.')
      const launchUrl = payload.browserUrl || payload.nativeUrl
      if (!launchUrl) throw new Error('The remote session was created but no viewer launch URL was returned.')
      setRemoteState(mode === 'backstage' ? 'Background session ready.' : 'Remote session ready.')
      if (payload.browserUrl) window.open(payload.browserUrl, '_blank', 'noopener,noreferrer')
      else window.location.href = payload.nativeUrl
    } catch (error) {
      setRemoteState(error?.message || 'Unable to start remote session.')
    } finally {
      setRemoteBusy(false)
    }
  }

  async function restartDevice() {
    if (!hasLiveAgent || !deviceOnline || powerBusy) return
    if (!window.confirm(`Restart ${device.name}? The device will restart in 15 seconds and unsaved user work may be lost.`)) return
    setPowerBusy(true)
    setRemoteState('Scheduling restart…')
    try {
      const response = await fetch(apiBase + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/power', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart', delaySeconds: 15 }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to restart this device.')
      setRemoteState('Restart scheduled. The device may go offline briefly.')
    } catch (error) {
      setRemoteState(error?.message || 'Unable to restart this device.')
    } finally {
      setPowerBusy(false)
    }
  }

  function selectSection(nextSection) {
    const nextTool = nextSection === 'tools' && section === 'tools' ? tool : ''
    if (nextSection !== 'tools') setTool('')
    else if (section !== 'tools') setTool('')
    setSection(nextSection)
    onDeviceRoute?.(nextSection, nextTool)
  }

  const patchPendingParts = []
  if (Number(device.pendingSoftwarePatches || 0) > 0) patchPendingParts.push(device.pendingSoftwarePatches + ' app')
  if (Number(device.pendingWindowsPatches || 0) > 0) patchPendingParts.push(device.pendingWindowsPatches + ' Windows')
  const patchPendingText = device.patchStateReported === false
    ? 'Update state not reported'
    : patchPendingParts.length
      ? patchPendingParts.join(' · ') + ' pending'
      : 'No pending updates'

  let content
  if (section === 'hardware') content = <DeviceHardware device={device} />
  else if (section === 'windows') content = <DeviceWindows device={device} />
  else if (section === 'software') content = <DeviceSoftware device={device} />
  else if (section === 'patching') content = <DevicePatching device={device} />
  else if (section === 'security') content = <DeviceSecurity device={device} />
  else if (section === 'tools') content = <RmmDeviceToolWorkspace device={device} embedded initialTool={tool} key={device.id + ':' + (tool || 'tool-launcher')} onToolChange={(nextTool) => { setTool(nextTool); onDeviceRoute?.('tools', nextTool) }} />
  else if (section === 'activity') content = <DeviceActivityTimeline device={device} />
  else if (section === 'jobs') content = <DeviceJobsPanel device={device} />
  else if (section === 'itsm') content = <DeviceItsm device={device} onCreateIncident={createIncident} relatedTickets={relatedTickets} />
  else content = <DeviceOverview device={device} deviceAlerts={deviceAlerts} monitoringResolution={monitoringResolution} patchPolicyLoading={patchPolicyLoading} patchPolicyResolution={patchPolicyResolution} navigate={navigate} onCreateIncident={createIncident} relatedTickets={relatedTickets} />

  return (
    <div className={`rmm-device-detail ${deviceOnline ? 'is-online' : deviceOffline ? 'is-offline' : 'is-agentless'}`}>
      <button className="rmm-back" onClick={onBack} type="button"><ChevronRight size={15} /> Back to devices</button>
      <header className="rmm-device-hero">
        <div className={'rmm-device-hero-icon ' + healthClass(device.health)}><DeviceIcon device={device} size={28} /></div>
        <div className="rmm-device-hero-copy">
          <span className="rmm-eyebrow">{device.id} · {device.serial}</span>
          <h1>{device.name}</h1>
          <p>{device.user} · {device.site || 'No site'} · {device.group || 'No group'}</p>
          <div><StatusPill>{device.status}</StatusPill><StatusPill>{device.health}</StatusPill><span>{device.os}</span><span>Agent {device.agent}</span></div>
          {remoteState && <small className="rmm-device-action-message">{remoteState}</small>}
        </div>
        <div className="rmm-device-actions">
          <button className="rmm-primary compact" disabled={remoteBusy || !hasLiveAgent || !canRemote || !deviceOnline} title={!hasLiveAgent ? 'Hi5Central Agent required' : !deviceOnline ? 'Device is offline' : canRemote ? 'Start unattended console remote session' : 'Your role does not include unattended remote access'} onClick={() => startRemote('console')} type="button"><Monitor size={16} /> {remoteBusy ? 'Starting…' : 'Remote desktop'}</button>
          <button disabled={!hasLiveAgent} title={!hasLiveAgent ? 'Hi5Central Agent required' : 'Open the full device tools workspace'} onClick={() => selectSection('tools')} type="button"><TerminalSquare size={16} /> Tools</button>
          <button disabled={!hasLiveAgent || !deviceOnline || powerBusy} title={!hasLiveAgent ? 'Hi5Central Agent required' : !deviceOnline ? 'Device is offline' : 'Restart this device'} onClick={restartDevice} type="button"><RefreshCw size={16} /> {powerBusy ? 'Restarting…' : 'Restart'}</button>
          <button onClick={() => createIncident()} type="button"><AlertTriangle size={16} /> ITSM incident</button>
        </div>
      </header>

      {deviceOffline && <div className="rmm-device-offline-banner"><WifiOff size={17} /><div><strong>Device offline</strong><span>Live controls are disabled and no new Agent jobs will be queued. Last-known inventory, Activity, Jobs and ITSM history remain available.</span></div><small>Last seen {device.lastSeen || 'not reported'}</small></div>}
      {!hasLiveAgent && <div className="rmm-device-offline-banner agentless"><Monitor size={17} /><div><strong>Hi5Central Agent not installed</strong><span>This device can show synchronized inventory, but live RMM controls require the Hi5Central Agent.</span></div></div>}

      <div className="rmm-device-metric-grid">
        <DeviceMetric icon={CircleGauge} label="CPU" value={device.cpu} tone={metricTone(device.cpu)} />
        <DeviceMetric icon={Activity} label="Memory" value={device.memory} tone={metricTone(device.memory)} />
        <DeviceMetric icon={HardDrive} label="Disk" value={device.disk} tone={metricTone(device.disk, 80, 92)} />
        <button className={'rmm-device-metric patch ' + (device.patchCompliance == null ? 'neutral' : device.patchCompliance < 90 ? 'warning' : 'healthy')} onClick={() => selectSection('patching')} type="button"><span><ShieldCheck size={17} /></span><div><small>Patch compliance</small><strong>{device.patchCompliance == null ? 'Not reported' : device.patchCompliance + '%'}</strong></div><small>{patchPendingText}</small></button>
      </div>

      <nav className="rmm-device-subnav" aria-label="Device detail sections" ref={subnavRef}>
        {sections.map(([id, label, Icon]) => <button aria-current={section === id ? 'page' : undefined} className={section === id ? 'active' : ''} key={id} onClick={() => selectSection(id)} type="button"><Icon size={14} />{label}{id === 'itsm' && relatedTickets.length > 0 && <b>{relatedTickets.length}</b>}</button>)}
      </nav>

      <div className={'rmm-device-section ' + (section === 'tools' ? 'is-tools' : '')}>{content}</div>
    </div>
  )
}

function RmmAlerts({ onCreateIncident, openDevice, query }) {
  const [severity, setSeverity] = useState('All')
  const normalized = query.trim().toLowerCase()
  const visible = rmmAlerts.filter((alert) => (severity === 'All' || alert.severity === severity) && (!normalized || [alert.title, alert.device, alert.detail, alert.policy].join(' ').toLowerCase().includes(normalized)))
  return <><PageHeading activeView="alerts" action={<button className="rmm-primary compact" type="button"><CheckCircle2 size={16} /> Acknowledge selected</button>} /><div className="rmm-list-toolbar"><div className="rmm-filter-pills">{['All', 'Critical', 'High', 'Medium'].map((value) => <button className={severity === value ? 'active' : ''} key={value} onClick={() => setSeverity(value)} type="button">{value}</button>)}</div><span>{visible.filter((alert) => alert.status === 'Open').length} open</span></div><div className="rmm-alert-list">{visible.map((alert) => <article className="rmm-card" key={alert.id}><div className={`rmm-alert-severity ${healthClass(alert.severity)}`}><AlertTriangle size={19} /></div><div className="rmm-alert-copy"><div><span className="rmm-eyebrow">{alert.id} · {alert.policy}</span><h2>{alert.title}</h2><p>{alert.detail}</p></div><button onClick={() => openDevice(rmmDevices.find((device) => device.id === alert.deviceId))} type="button"><Monitor size={14} /> {alert.device}</button></div><div className="rmm-alert-meta"><StatusPill tone={healthClass(alert.severity)}>{alert.severity}</StatusPill><span>{alert.raised}</span><button onClick={() => onCreateIncident?.({ alert, device: rmmDevices.find((device) => device.id === alert.deviceId) })} type="button">Create incident</button><button type="button">Acknowledge</button><button type="button"><MoreHorizontal size={16} /></button></div></article>)}</div></>
}

function RmmSoftware({ devices = [] }) {
  const [view, setView] = useState('catalogue')
  const applications = useMemo(() => {
    const map = new Map()
    for (const device of devices) {
      for (const app of device.installedSoftware || []) {
        const key = [String(app.name || '').toLowerCase(), String(app.version || '').toLowerCase(), String(app.publisher || '').toLowerCase()].join('|')
        const current = map.get(key) || { name: app.name || 'Unnamed application', version: app.version || 'Not reported', publisher: app.publisher || 'Not reported', devices: new Set(), scopes: new Set() }
        current.devices.add(device.id)
        if (app.scope) current.scopes.add(app.scope.startsWith('user:') ? 'Per-user' : app.scope.startsWith('machine') ? 'Machine' : app.scope)
        map.set(key, current)
      }
    }
    return [...map.values()].map((app) => ({ ...app, deviceCount: app.devices.size, scopeLabel: [...app.scopes].join(', ') || 'Not reported' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [devices])
  const reportingDevices = devices.filter((device) => (device.installedSoftware || []).length > 0).length
  return <>
    <PageHeading activeView="software" />
    <nav className="rmm-software-workspace-tabs" aria-label="Software workspace">
      <button className={view === 'catalogue' ? 'active' : ''} onClick={() => setView('catalogue')} type="button"><ShieldCheck size={15} /> Catalogue & qualification</button>
      <button className={view === 'inventory' ? 'active' : ''} onClick={() => setView('inventory')} type="button"><Box size={15} /> Installed inventory <b>{applications.length}</b></button>
    </nav>
    {view === 'catalogue'
      ? <RmmPatchingWorkspace devices={devices} softwareOnly />
      : <>
        <div className="rmm-request-stats"><div><strong>{applications.length}</strong><span>Unique application versions</span></div><div><strong>{reportingDevices}</strong><span>Devices reporting software</span></div><div><strong>{devices.length - reportingDevices}</strong><span>Awaiting inventory</span></div><div><strong>{applications.reduce((sum, app) => sum + app.deviceCount, 0)}</strong><span>Observed installations</span></div></div>
        <section className="rmm-table-card"><div className="rmm-table rmm-software-table"><div className="rmm-table-head"><span>Application</span><span>Version</span><span>Installed</span><span>Publisher</span><span>Scope</span><span /></div>{applications.map((app) => <div className="rmm-table-row" key={[app.name, app.version, app.publisher].join('|')}><span className="rmm-device-cell"><span className="rmm-device-icon neutral"><Box size={17} /></span><span><strong>{app.name}</strong><small>Observed from live device inventory</small></span></span><span><strong>{app.version}</strong></span><span><strong>{app.deviceCount}</strong><small>device{app.deviceCount === 1 ? '' : 's'}</small></span><span><strong>{app.publisher}</strong></span><span><StatusPill tone="neutral">{app.scopeLabel}</StatusPill></span><span /></div>)}</div>{!applications.length && <div className="rmm-empty"><PackageCheck size={24} /><strong>No software inventory yet</strong><span>Applications appear here after managed devices report their installed-software inventory.</span></div>}</section>
      </>}
  </>
}

function SoftwareInventoryReport({ devices = [] }) {
  const [search, setSearch] = useState('')
  const installations = useMemo(() => {
    const rows = []
    for (const device of devices) {
      for (const app of device.installedSoftware || []) {
        rows.push({
          key: [device.id, app.registryKey, app.scope, app.name, app.version].join('|'),
          name: app.name || 'Unnamed application',
          version: app.version || 'Not reported',
          publisher: app.publisher || 'Not reported',
          installed: app.installed || 'Not reported',
          scope: app.scope || 'Not reported',
          device: device.name,
          deviceId: device.id,
          user: device.user || 'Unassigned',
          site: device.site || 'Unassigned',
        })
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name) || a.device.localeCompare(b.device))
  }, [devices])
  const normalized = search.trim().toLowerCase()
  const visible = installations.filter((row) => !normalized || [row.name, row.version, row.publisher, row.device, row.user, row.site, row.installed, row.scope].join(' ').toLowerCase().includes(normalized))

  function exportCsv() {
    const quote = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"'
    const lines = [
      ['Software', 'Version', 'Publisher', 'Device', 'User', 'Site', 'Install date', 'Scope'].map(quote).join(','),
      ...visible.map((row) => [row.name, row.version, row.publisher, row.device, row.user, row.site, row.installed, row.scope].map(quote).join(',')),
    ]
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'hi5central-installed-software.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="rmm-card rmm-software-report-card">
    <div className="rmm-card-heading">
      <div><span className="rmm-eyebrow">Installed software report</span><h2>Every observed installation</h2><p>Current Agent inventory with device, assigned user, site, version, publisher and install date where Windows reports it.</p></div>
      <div className="rmm-software-report-actions">
        <label><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search software or device…" /></label>
        <button disabled={!visible.length} onClick={exportCsv} type="button"><Download size={14} /> Export CSV</button>
      </div>
    </div>
    <div className="rmm-software-report">
      <div className="rmm-software-report-head"><span>Software</span><span>Version</span><span>Device</span><span>Publisher</span><span>Install date</span><span>Scope</span></div>
      {visible.map((row) => <div className="rmm-software-report-row" key={row.key}>
        <span><strong>{row.name}</strong><small>{row.publisher}</small></span>
        <span data-label="Version">{row.version}</span>
        <span data-label="Device"><strong>{row.device}</strong><small>{row.user} · {row.site}</small></span>
        <span data-label="Publisher">{row.publisher}</span>
        <span data-label="Install date">{row.installed}</span>
        <span data-label="Scope">{row.scope}</span>
      </div>)}
    </div>
    {!visible.length && <div className="rmm-empty compact"><PackageCheck size={22} /><strong>{installations.length ? 'No matching software' : 'No software inventory yet'}</strong><span>{installations.length ? 'Change the search to see other installations.' : 'Managed-device software will appear here after Agent inventory is received.'}</span></div>}
  </section>
}

function RmmReports({ devices = [] }) {
  const total = devices.length
  const online = devices.filter((device) => device.status === 'Online').length
  const healthy = devices.filter((device) => device.health === 'Healthy').length
  const softwareReported = devices.filter((device) => (device.installedSoftware || []).length > 0).length
  const updatesReported = devices.filter((device) => device.pendingPatches != null).length
  const siteAssigned = devices.filter((device) => device.siteId).length
  const cards = [
    ['Online devices', total ? Math.round(online / total * 100) + '%' : '—', total ? online + ' of ' + total + ' devices currently online' : 'No managed devices', Wifi],
    ['Healthy devices', total ? Math.round(healthy / total * 100) + '%' : '—', total ? healthy + ' of ' + total + ' devices healthy' : 'No managed devices', CircleGauge],
    ['Software inventory', total ? Math.round(softwareReported / total * 100) + '%' : '—', softwareReported + ' devices reporting applications', PackageCheck],
    ['Update inventory', total ? Math.round(updatesReported / total * 100) + '%' : '—', updatesReported + ' devices reporting Windows Update state', ShieldCheck],
  ]
  return <><PageHeading activeView="reports" /><div className="rmm-report-metrics">{cards.map(([title, value, detail, Icon]) => <article className="rmm-card" key={title}><Icon size={20} /><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>)}</div><div className="rmm-dashboard-grid"><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Inventory coverage</span><h2>Device reporting</h2></div></div><div className="rmm-report-list"><span><strong>Managed devices</strong><b>{total}</b></span><span><strong>Online now</strong><b>{online}</b></span><span><strong>Software inventory reported</strong><b>{softwareReported}</b></span><span><strong>Windows Update inventory reported</strong><b>{updatesReported}</b></span></div></section><section className="rmm-card"><div className="rmm-card-heading"><div><span className="rmm-eyebrow">Organisation scope</span><h2>Site assignment</h2></div></div><div className="rmm-report-list"><span><strong>Assigned to an organisation site</strong><b>{siteAssigned}</b></span><span><strong>Unassigned</strong><b>{Math.max(0, total - siteAssigned)}</b></span><span><strong>Agent-backed</strong><b>{devices.filter((device) => device.agentDeviceId).length}</b></span><span><strong>Encrypted / protected</strong><b>{devices.filter((device) => device.security?.encryptionState === 'Protected').length}</b></span></div></section></div><SoftwareInventoryReport devices={devices} /><div className="rmm-scope-explainer"><BarChart3 size={18} /><div><strong>Reports now use current device inventory only</strong><span>Historical trend charts will appear when time-series reporting data exists; fabricated percentages and example alert counts are no longer used here.</span></div></div></>
}

function RmmSettings({ navigate }) {
  const settings = [
    { icon: Download, title: 'Agent deployment', detail: 'Installer packages, enrollment tokens and stable/preview channels.', target: 'agent-deployment' },
    { icon: MapPin, title: 'Sites & device groups', detail: 'Organise endpoints by location, department, role or dynamic rule.', target: 'sites' },
    { icon: SlidersHorizontal, title: 'Monitoring policies & inheritance', detail: 'Set estate defaults, target Sites or Groups and audit per-device overrides.', target: 'policies' },
    { icon: ShieldCheck, title: 'Maintenance windows', detail: 'Control when patching, restarts and automated remediation may run.' },
    { icon: KeyRound, title: 'Credentials & secrets', detail: 'Secure credentials used by remote actions, scripts and integrations.' },
    { icon: Bell, title: 'Alerting & notifications', detail: 'Thresholds, escalation targets and integrations for monitoring events.' },
    { icon: Network, title: 'Network discovery', detail: 'Discovery ranges, SNMP credentials and monitored network devices.', target: 'network-discovery' },
  ]
  return <><PageHeading activeView="settings" /><div className="rmm-settings-grid">{settings.map(({ icon: Icon, title, detail, target }) => <button className="rmm-card" key={title} onClick={() => target && navigate(target)} type="button"><span><Icon size={19} /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={17} /></button>)}</div></>
}

export function RmmPlatformApp({ accent, canAudit = false, canBackstageRemote = false, canRemote = false, currentUser, dataLoading = false, devices = rmmDevices, sites = [], handleLogout, onCreateItsmIncident, onSitesChange, setTheme, tenantName, theme, tickets = [] }) {
  const initialRoute = rmmRouteFromLocation()
  const [activeView, setActiveView] = useState(initialRoute.viewId || 'dashboard')
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialRoute.deviceId || '')
  const [selectedDeviceSection, setSelectedDeviceSection] = useState(initialRoute.deviceSection || 'overview')
  const [selectedDeviceTool, setSelectedDeviceTool] = useState(initialRoute.deviceTool || '')
  const [selectedActivityCategory, setSelectedActivityCategory] = useState(initialRoute.activityCategory || '')
  const [selectedActivityId, setSelectedActivityId] = useState(initialRoute.activityId || '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [inventoryPreset, setInventoryPreset] = useState(null)
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId)
  const visibleActiveView = (activeView === 'activity-audit' && !canAudit) || (activeView === 'connect' && !canRemote) ? 'dashboard' : activeView

  useEffect(() => {
    const handlePop = () => {
      const route = rmmRouteFromLocation()
      setActiveView(route.viewId || 'dashboard')
      setSelectedDeviceId(route.deviceId || '')
      setSelectedDeviceSection(route.deviceSection || 'overview')
      setSelectedDeviceTool(route.deviceTool || '')
      setSelectedActivityCategory(route.activityCategory || '')
      setSelectedActivityId(route.activityId || '')
      setMobileOpen(false)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  function createItsmIncident(context) {
    const created = onCreateItsmIncident?.(context)
    if (created?.id) setToast(`${created.id} created in Hi5Central ITSM`)
    return created
  }

  function navigate(viewId, options = {}) {
    setActiveView(viewId)
    setSelectedDeviceId('')
    setSelectedDeviceSection('overview')
    setSelectedDeviceTool('')
    setSelectedActivityCategory('')
    setSelectedActivityId('')
    setMobileOpen(false)
    setQuery('')
    const path = rmmPath(undefined, viewId)
    window.history.pushState({}, '', path)
    if (options.scroll !== false) document.querySelector('.rmm-main-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' })
  }

  function openDevice(device) {
    if (!device) return
    setActiveView('devices')
    setSelectedDeviceId(device.id)
    setSelectedDeviceSection('overview')
    setSelectedDeviceTool('')
    setSelectedActivityCategory('')
    setSelectedActivityId('')
    setMobileOpen(false)
    window.history.pushState({}, '', rmmDevicePath(undefined, device.id, 'overview'))
    document.querySelector('.rmm-main-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' })
  }

  function openScopedInventory(preset) {
    setInventoryPreset({ ...preset, requestedAt: Date.now() })
    navigate('devices')
  }

  function renderPage() {
    if (dataLoading && !selectedDevice && ['dashboard','devices','sites','groups','network-discovery','patching','software','reports'].includes(activeView)) return <RmmPageSkeleton />
    if (selectedDevice) return <RmmDeviceDetail canBackstageRemote={canBackstageRemote} canRemote={canRemote} device={selectedDevice} initialSection={selectedDeviceSection} initialTool={selectedDeviceTool} navigate={navigate} onDeviceRoute={(nextSection, nextTool = '') => { setSelectedDeviceSection(nextSection || 'overview'); setSelectedDeviceTool(nextTool || ''); window.history.pushState({}, '', rmmDevicePath(undefined, selectedDevice.id, nextSection || 'overview', nextTool || '')) }} onBack={() => { setSelectedDeviceId(''); setSelectedDeviceSection('overview'); setSelectedDeviceTool(''); window.history.pushState({}, '', rmmPath(undefined, 'devices')) }} onCreateIncident={createItsmIncident} tickets={tickets} />
    if (activeView === 'devices') return <RmmDeviceInventory devices={devices} sites={sites} openDevice={openDevice} query={query} preset={inventoryPreset} onPresetApplied={() => setInventoryPreset(null)} />
    if (activeView === 'sites') return <RmmSitesManagement devices={devices} query={query} sites={sites} onSitesChange={onSitesChange} onViewDevices={openScopedInventory} />
    if (activeView === 'groups') return <RmmDeviceGroupsManagement devices={devices} query={query} sites={sites} onViewDevices={openScopedInventory} />
    if (activeView === 'network-discovery') return <RmmNetworkDiscovery />
    if (activeView === 'alerts') return <RmmAlerts onCreateIncident={createItsmIncident} openDevice={openDevice} query={query} />
    if (activeView === 'connect') return <RmmConnect />
    if (activeView === 'remote') return <RmmDeviceInventory devices={devices} sites={sites} openDevice={openDevice} query={query} preset={inventoryPreset} onPresetApplied={() => setInventoryPreset(null)} />
    if (activeView === 'patching') return <RmmPatchingWorkspace devices={devices} />
    if (activeView === 'software') return <RmmSoftware devices={devices} />
    if (activeView === 'automation') return <RmmAutomation />
    if (activeView === 'policies') return <RmmMonitoringPolicies devices={devices} openDevice={openDevice} sites={sites} />
    if (activeView === 'reports') return <RmmReports devices={devices} />
    if (activeView === 'activity-audit') return canAudit ? <RmmAuditActivity activityCategory={selectedActivityCategory} activityId={selectedActivityId} devices={devices} /> : <RmmDashboard canAudit={canAudit} devices={devices} navigate={navigate} openDevice={openDevice} />
    if (activeView === 'agent-deployment') return <RmmAgentDeployment />
    if (activeView === 'settings') return <RmmSettings navigate={navigate} />
    return <RmmDashboard canAudit={canAudit} devices={devices} navigate={navigate} openDevice={openDevice} />
  }

  return (
    <div className="rmm-app" data-accent={accent} data-theme={theme}>
      <RmmSidebar activeView={visibleActiveView} canAudit={canAudit} canRemote={canRemote} mobileOpen={mobileOpen} navigate={navigate} onClose={() => setMobileOpen(false)} tenantName={tenantName} />
      <div className="rmm-shell-main">
        <RmmTopbar activeView={visibleActiveView} currentUser={currentUser} navigate={navigate} onLogout={handleLogout} onMenu={() => setMobileOpen(true)} query={query} setQuery={setQuery} setTheme={setTheme} theme={theme} />
        <main className="rmm-main-scroll"><div className="rmm-page">{renderPage()}</div></main>
      </div>
      {toast && <div className="rmm-toast"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  )
}
