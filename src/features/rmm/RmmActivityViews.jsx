import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Filter,
  History, ListChecks, Monitor, Package, RefreshCw, Search, Server, ShieldCheck,
  TerminalSquare, User, X, XCircle,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import { rmmActivityPath, rmmPath } from '../../lib/tenantSurface.js'
import './RmmActivityViews.css'

const API_BASE = window.__HI5_API_BASE__ || deploymentConfig().apiUrl
const deviceHistoryCache = new Map()
const HISTORY_CACHE_MS = 30000

function historyCacheGet(key) {
  const entry = deviceHistoryCache.get(key)
  return entry && Date.now() - entry.savedAt < HISTORY_CACHE_MS ? entry.value : null
}
function historyCacheSet(key, value) {
  deviceHistoryCache.set(key, { value, savedAt: Date.now() })
}

async function apiJson(path) {
  const response = await fetch(API_BASE + path, { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to load RMM data.')
  return payload
}

function formatWhen(value) {
  if (!value) return 'Not reported'
  try { return new Date(value).toLocaleString() } catch { return String(value) }
}
function durationBetween(start, end) {
  if (!start || !end) return ''
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  if (seconds < 60) return seconds + 's'
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  return remain ? minutes + 'm ' + remain + 's' : minutes + 'm'
}
function jobLabel(type = '') {
  const map = {
    'software.uninstall': 'Uninstall software',
    'process.kill': 'End process',
    'process.restart': 'Restart process',
    'processes.list': 'Read processes',
    'services.list': 'Read services',
    'services.start': 'Start service',
    'services.stop': 'Stop service',
    'services.restart': 'Restart service',
    'services.set_start_type': 'Change service startup',
    'registry.list': 'Read registry',
    'registry.create_key': 'Create registry key',
    'registry.delete_key': 'Delete registry key',
    'registry.set_value': 'Change registry value',
    'registry.delete_value': 'Delete registry value',
    'events.list': 'Read event log',
    'files.list': 'Read files',
    'inventory.scan': 'Refresh inventory',
    'windows_update.manage': 'Windows Update management',
  }
  return map[type] || String(type || 'Device job').replaceAll('.', ' ')
}
function outcomeTone(value = '') {
  const normalized = String(value).toLowerCase()
  if (['success', 'completed', 'succeeded'].includes(normalized)) return 'healthy'
  if (['failed', 'critical', 'verification_failed'].includes(normalized)) return 'critical'
  if (['running', 'claimed'].includes(normalized)) return 'running'
  if (['queued', 'requested', 'warning', 'reboot_required', 'remediation_required', 'completed_with_issues'].includes(normalized)) return 'warning'
  if (normalized === 'not_applicable') return 'neutral'
  return 'neutral'
}
function outcomeLabel(value = '') {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'not_applicable') return 'Not applicable'
  if (!normalized) return 'Info'
  return normalized.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}
function comparePatchVersions(left = '', right = '') {
  const a = String(left).match(/\d+/g)?.map(Number) || []
  const b = String(right).match(/\d+/g)?.map(Number) || []
  for (let index = 0; index < Math.max(a.length, b.length, 1); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0)
    if (delta) return delta > 0 ? 1 : -1
  }
  return 0
}
function bulkPatchItemStatus(item = {}) {
  if (item.serverStatus) return item.serverStatus
  if (item.success === true) return item.rebootRequired || item.reboot_required ? 'reboot_required' : 'succeeded'
  const target = String(item.targetVersion || item.target_version || '')
  const versions = Array.isArray(item?.verification?.installedVersions) ? item.verification.installedVersions.map(String) : []
  const targetObserved = target && versions.some((version) => comparePatchVersions(version, target) >= 0)
  const superseded = target ? versions.filter((version) => comparePatchVersions(version, target) < 0) : []
  if (targetObserved && superseded.length) return 'remediation_required'
  if (targetObserved) return 'succeeded'
  if (item.verificationFailed || item.verification_failed) return 'verification_failed'
  return 'failed'
}
function bulkPatchSummary(result = {}) {
  const items = Array.isArray(result.items) ? result.items : []
  const statuses = items.map(bulkPatchItemStatus)
  const succeeded = statuses.filter((status) => status === 'succeeded').length
  const rebootRequired = statuses.filter((status) => status === 'reboot_required').length
  const remediationRequired = statuses.filter((status) => status === 'remediation_required').length
  const failed = statuses.filter((status) => ['failed', 'verification_failed'].includes(status)).length
  const successful = succeeded + rebootRequired
  return {
    items, succeeded, rebootRequired, remediationRequired, failed, successful,
    needsAttention: remediationRequired + failed,
    label: remediationRequired + failed > 0 ? 'Completed with issues' : 'Completed',
  }
}
function jobVisualStatus(job = {}) {
  if (job.job_type === 'windows_update.manage') {
    const result = job.result && typeof job.result === 'object' ? job.result : {}
    const status = String(result.status || result.parsed?.status || '').toLowerCase()
    if (['conflict', 'unsupported', 'not_applicable'].includes(status)) {
      return { label: 'Not applicable', tone: 'neutral', notApplicable: true }
    }
  }
  if (job.job_type !== 'patch.software.bulk') return { label: outcomeLabel(job.status || 'unknown'), tone: outcomeTone(job.status) }
  const summary = bulkPatchSummary(job.result || {})
  if (!summary.items.length) return { label: job.status || 'unknown', tone: outcomeTone(job.status) }
  return { label: summary.label, tone: summary.needsAttention ? 'warning' : 'healthy', summary }
}
function bulkItemLabel(status) {
  if (status === 'succeeded') return 'Succeeded'
  if (status === 'reboot_required') return 'Succeeded · Restart required'
  if (status === 'remediation_required') return 'Needs old-version cleanup'
  if (status === 'verification_failed') return 'Verification failed'
  return 'Failed'
}
function BulkPatchResults({ result = {} }) {
  const summary = bulkPatchSummary(result)
  if (!summary.items.length) return null
  return <section className="rmm-bulk-result">
    <div className="rmm-bulk-result-summary">
      <span><small>Succeeded</small><strong>{summary.successful}</strong></span>
      <span><small>Restart required</small><strong>{summary.rebootRequired}</strong></span>
      <span><small>Needs cleanup</small><strong>{summary.remediationRequired}</strong></span>
      <span><small>Failed</small><strong>{summary.failed}</strong></span>
    </div>
    <div className="rmm-bulk-result-list">
      {summary.items.map((item, index) => {
        const status = bulkPatchItemStatus(item)
        const tone = outcomeTone(status)
        const Icon = tone === 'healthy' ? CheckCircle2 : tone === 'critical' ? XCircle : AlertTriangle
        const versions = Array.isArray(item?.verification?.installedVersions) ? item.verification.installedVersions : []
        const detail = status === 'remediation_required'
          ? 'Target installed; older version remains: ' + versions.filter((version) => comparePatchVersions(version, item.targetVersion || item.target_version) < 0).join(', ')
          : item.verifiedVersion
            ? 'Verified ' + item.verifiedVersion
            : item.error || item.agentError || ''
        return <article className={'rmm-bulk-result-item ' + tone} key={item.catalogueId || item.packageId || index}>
          <Icon size={16} />
          <div><strong>{item.applicationName || item.packageId || 'Software update'}</strong><small>{item.installedVersion || '—'} → {item.targetVersion || '—'}{detail ? ' · ' + detail : ''}</small></div>
          <span className={'rmm-audit-outcome ' + tone}>{bulkItemLabel(status)}</span>
        </article>
      })}
    </div>
  </section>
}
function textValue(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return ''
}
function jobDetailRows(job = {}) {
  const type = String(job.job_type || '')
  const request = job.payload && typeof job.payload === 'object' ? job.payload : {}
  const result = job.result && typeof job.result === 'object' ? job.result : {}
  const rows = []
  const add = (label, value) => { const text = textValue(value); if (text) rows.push({ label, value: text }) }

  if (type === 'windows_update.manage') {
    const status = String(result.status || result.parsed?.status || '').toLowerCase()
    const notApplicable = ['conflict', 'unsupported', 'not_applicable'].includes(status)
    add('Action', 'Windows Update management')
    add('Result', notApplicable ? 'Not applicable' : (job.status === 'completed' ? 'Completed successfully' : 'Failed'))
    add('Management channel', result.management_channel || result.parsed?.management_channel)
    add('Reason', result.message || result.parsed?.message)
    if (Array.isArray(result.conflicts) && result.conflicts.length) add('Detected policy', result.conflicts.join(', ').replaceAll('_', ' '))
    return rows
  }
  if (type === 'patch.software') {
    add('Application', result.applicationName || request.applicationName || request.packageId)
    const installed = result.installedVersion || request.installedVersion
    const target = result.targetVersion || request.targetVersion
    if (installed || target) add('Version', (installed || 'Unknown') + ' → ' + (target || 'Unknown'))
    add('Verified version', result.verifiedVersion)
    add('Provider', result.provider || request.provider)
    add('Installer', result.installerType || request.installerType)
    add('Restart required', Boolean(result.rebootRequired || result.reboot_required))
    if (result.verificationPassed === true) add('Verification', 'Passed')
    else if (result.verificationFailed === true || result.verification_failed === true) add('Verification', 'Failed')
    add('Install strategy', result.successfulStrategy)
    return rows
  }
  if (type === 'software.uninstall') {
    add('Application', result.name || request.name)
    add('Version', result.version)
    add('Publisher', result.publisher)
    add('Scope', request.scope)
    add('Result', result.status || (job.status === 'completed' ? 'Uninstalled successfully' : 'Uninstall failed'))
    add('Restart required', Boolean(result.reboot_required || result.rebootRequired))
    add('Reason', result.reason)
    return rows
  }
  if (type === 'process.kill' || type === 'process.restart') {
    add('Process', result.name || request.name || request.processName)
    add('Process ID', request.processId || request.pid || result.process_id || result.pid)
    add('Result', job.status === 'completed' ? (type === 'process.kill' ? 'Process ended' : 'Process restarted') : 'Action failed')
    add('Exit code', result.exit_code ?? result.exitCode)
    return rows
  }
  if (type.startsWith('services.')) {
    add('Service', result.display_name || result.service_name || request.serviceName)
    if (type === 'services.set_start_type') add('Startup type', request.startType || result.start_mode)
    add('Result', job.status === 'completed' ? jobLabel(type) + ' completed' : jobLabel(type) + ' failed')
    add('State', result.state || result.status)
    return rows
  }
  if (type.startsWith('registry.')) {
    add('Registry path', request.path || result.path)
    add('Value', request.name)
    if (request.value !== undefined && request.value !== '') add('New value', request.value)
    add('Type', request.kind)
    if (type === 'registry.list') {
      if (Array.isArray(result.subkeys)) add('Subkeys returned', result.subkeys.length)
      if (Array.isArray(result.values)) add('Values returned', result.values.length)
    }
    add('Result', job.status === 'completed' ? jobLabel(type) + ' completed' : jobLabel(type) + ' failed')
    return rows
  }
  if (type === 'events.list') {
    add('Event log', request.logName || result.log_name)
    add('Level', request.level || result.level)
    add('Events returned', result.count ?? (Array.isArray(result.events) ? result.events.length : ''))
    add('Result', job.status === 'completed' ? 'Event log read successfully' : 'Event log read failed')
    return rows
  }
  if (type === 'processes.list') {
    add('Processes returned', result.count ?? (Array.isArray(result.processes) ? result.processes.length : ''))
    add('Result', job.status === 'completed' ? 'Process list refreshed' : 'Process list failed')
    return rows
  }
  if (type === 'services.list') {
    add('Services returned', result.count ?? (Array.isArray(result.services) ? result.services.length : ''))
    add('Result', job.status === 'completed' ? 'Service list refreshed' : 'Service list failed')
    return rows
  }
  if (type === 'files.list') {
    add('Path', request.path || result.path)
    add('Items returned', result.count ?? (Array.isArray(result.items) ? result.items.length : ''))
    add('Result', job.status === 'completed' ? 'Folder read successfully' : 'Folder read failed')
    return rows
  }
  if (type === 'inventory.scan') {
    add('Result', result.inventory_sent === true ? 'Inventory refreshed and uploaded' : (job.status === 'completed' ? 'Inventory refresh completed' : 'Inventory refresh failed'))
    return rows
  }
  if (type === 'custom.command') {
    const metadata = job.request_metadata && typeof job.request_metadata === 'object' ? job.request_metadata : {}
    if (metadata.source === 'device_power_action') {
      const action = metadata.power_action === 'shutdown' ? 'Shut down' : 'Restart'
      add('Action', action)
      if (metadata.delay_seconds !== undefined) add('Countdown', metadata.delay_seconds + ' seconds')
      add('Result', job.status === 'completed' ? action + ' scheduled' : action + ' failed')
      return rows
    }
    add('Command', request.command || result.command)
    add('Exit code', result.exit_code ?? result.exitCode)
    if (result.duration_ms !== undefined) add('Duration', Math.round(Number(result.duration_ms) / 1000) + 's')
    return rows
  }
  if (type === 'patch.vendor_artifact.inspect') {
    add('Application', request.applicationName || request.packageId || request.name)
    add('Version', request.targetVersion || request.version)
    add('Result', job.status === 'completed' ? 'Installer inspection completed' : 'Installer inspection failed')
    add('Signer', result.signer || result.subject)
    return rows
  }
  if (type.startsWith('qualification.observer.')) {
    add('Result', job.status === 'completed' ? 'Qualification observation completed' : 'Qualification observation failed')
    return rows
  }

  add('Action', jobLabel(type))
  add('Result', job.status === 'completed' ? 'Completed successfully' : job.status || 'Unknown')
  return rows
}
function HumanJobDetails({ job = {} }) {
  const type = String(job.job_type || '')
  if (type === 'patch.software.bulk') return <BulkPatchResults result={job.result || {}} />
  const rows = jobDetailRows(job)
  const result = job.result && typeof job.result === 'object' ? job.result : {}
  const metadata = job.request_metadata && typeof job.request_metadata === 'object' ? job.request_metadata : {}
  const commandOutput = type === 'custom.command' && metadata.source !== 'device_power_action' ? String(result.output || '').trim() : ''
  return <section className="rmm-job-human-detail">
    <div className="rmm-job-human-heading"><strong>Action details</strong><span>{jobLabel(type)}</span></div>
    <div className="rmm-job-human-grid">
      {rows.map((row, index) => <span key={row.label + index}><small>{row.label}</small><strong>{row.value}</strong></span>)}
    </div>
    {commandOutput && <div className="rmm-job-human-output"><strong>Command output</strong><pre>{commandOutput}</pre></div>}
  </section>
}
function activityIcon(category = '') {
  if (category === 'terminal') return TerminalSquare
  if (category === 'remote') return Monitor
  if (category === 'software') return Package
  if (category === 'service') return Server
  if (category === 'security') return ShieldCheck
  if (category === 'job') return ListChecks
  return Activity
}

function SkeletonRows({ count = 6 }) {
  return <div className="rmm-audit-skeleton" aria-label="Loading">
    {Array.from({ length: count }).map((_, index) => <div key={index}><span /><div><b /><i /></div><em /></div>)}
  </div>
}

function DetailModal({ detail, loading, onClose }) {
  if (!detail && !loading) return null
  const isTool = detail?.kind === 'tool'
  const payload = detail?.data || {}
  const visualStatus = !isTool ? jobVisualStatus(payload) : null
  const powerAction = payload?.request_metadata?.source === 'device_power_action' ? payload.request_metadata.power_action : ''
  const title = isTool
    ? ((payload.shell === 'cmd' ? 'Command Prompt' : payload.shell === 'powershell' ? 'PowerShell' : payload.tool) + ' session')
    : powerAction === 'shutdown'
      ? 'Shut down device'
      : powerAction === 'restart'
        ? 'Restart device'
        : jobLabel(payload.job_type)
  const modal = <div className="rmm-audit-modal-backdrop" role="presentation">
    <section className="rmm-audit-modal" role="dialog" aria-modal="true" aria-label="Activity details">
      <header><div><span className="rmm-eyebrow">RMM audit detail</span><h2>{loading ? 'Loading details…' : title}</h2></div><button onClick={onClose} type="button" aria-label="Close"><X size={18} /></button></header>
      {loading ? <SkeletonRows count={4} /> : <>
        <div className="rmm-audit-detail-grid">
          <span><small>Status</small><strong>{visualStatus?.label || payload.status || 'Completed'}</strong></span>
          <span><small>Technician</small><strong>{payload.initiated_by_label || payload.initiatedByLabel || 'SYSTEM'}</strong></span>
          <span><small>Started</small><strong>{formatWhen(payload.started_at || payload.created_at)}</strong></span>
          <span><small>Finished</small><strong>{formatWhen(payload.ended_at || payload.completed_at)}</strong></span>
          {isTool && <span><small>Commands</small><strong>{payload.command_count ?? 0}</strong></span>}
          {isTool && <span><small>Duration</small><strong>{durationBetween(payload.started_at, payload.ended_at) || '—'}</strong></span>}
        </div>
        {isTool ? <div className="rmm-audit-transcript">
          <div><strong>Session transcript</strong>{payload.transcript_truncated && <span>Transcript truncated at audit limit</span>}</div>
          <pre>{payload.transcript || 'No terminal output was captured for this session.'}</pre>
        </div> : <>
          <HumanJobDetails job={payload} />
          {payload.error_message && !visualStatus?.notApplicable && <div className="rmm-audit-error"><AlertTriangle size={15} />{payload.error_message}</div>}
        </>}
      </>}
    </section>
  </div>
  return createPortal(modal, document.querySelector('.rmm-app') || document.body)
}

function activityVisualOutcome(event = {}) {
  const result = event?.metadata?.result && typeof event.metadata.result === 'object' ? event.metadata.result : {}
  const resultStatus = String(result.status || result.parsed?.status || '').toLowerCase()
  if (
    ['conflict', 'unsupported', 'not_applicable'].includes(resultStatus)
    && (
      event.event_type === 'windows_update.manage'
      || String(event.event_type || '').startsWith('windows_updates.management')
      || String(event.summary || '').toLowerCase().includes('windows update management')
    )
  ) return 'not_applicable'
  return event.outcome || 'info'
}
function ActivityRow({ event, onDetails }) {
  const Icon = activityIcon(event.category)
  const canOpen = Boolean(event.job_id || event.tool_session_id)
  const visualOutcome = activityVisualOutcome(event)
  return <article className="rmm-audit-event">
    <span className={'rmm-audit-event-icon ' + outcomeTone(visualOutcome)}><Icon size={16} /></span>
    <div className="rmm-audit-event-copy">
      <strong>{event.summary}</strong>
      {event.detail && <p>{event.detail}</p>}
      <small>{formatWhen(event.created_at)} · {event.device_name || 'Device'} · {event.actor_label || 'SYSTEM'}</small>
    </div>
    <span className={'rmm-audit-outcome ' + outcomeTone(visualOutcome)}>{outcomeLabel(visualOutcome)}</span>
    {canOpen && <button className="rmm-audit-details-button" onClick={() => onDetails(event)} type="button">Details <ChevronRight size={13} /></button>}
  </article>
}

function useActivityDetails({ activityCategory = '', activityId = '' } = {}) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const returnPathRef = useRef('')
  const routeOpenedRef = useRef('')

  async function loadEventDetail(event) {
    setLoading(true)
    setDetail({ kind: event?.tool_session_id ? 'tool' : 'job', data: {} })
    try {
      if (event?.tool_session_id) {
        const payload = await apiJson('/api/v1/rmm/tool-sessions/' + encodeURIComponent(event.tool_session_id))
        setDetail({ kind: 'tool', data: payload.session || {} })
      } else if (event?.job_id) {
        const payload = await apiJson('/api/v1/rmm/device-actions/' + encodeURIComponent(event.job_id))
        setDetail({ kind: 'job', data: payload.job || {} })
      } else {
        throw new Error('This activity record has no detailed job or tool session.')
      }
    } catch (error) {
      setDetail({ kind: 'job', data: { status: 'failed', error_message: error.message } })
    } finally {
      setLoading(false)
    }
  }

  async function open(event, { updatePath = true } = {}) {
    if (!event) return
    if (updatePath && event.id) {
      returnPathRef.current = window.location.pathname + window.location.search
      window.history.pushState({}, '', rmmActivityPath(undefined, event.category || 'job', event.id))
    }
    routeOpenedRef.current = String(event.id || '')
    await loadEventDetail(event)
  }

  async function openById(id, expectedCategory = '') {
    if (!id) return
    setLoading(true)
    setDetail({ kind: 'job', data: {} })
    try {
      const payload = await apiJson('/api/v1/rmm/activity/' + encodeURIComponent(id))
      const event = payload.event || {}
      const canonicalCategory = event.category || expectedCategory || 'job'
      if (expectedCategory && event.category && String(event.category).toLowerCase() !== String(expectedCategory).toLowerCase()) {
        window.history.replaceState({}, '', rmmActivityPath(undefined, canonicalCategory, event.id || id))
      }
      routeOpenedRef.current = String(event.id || id)
      await loadEventDetail(event)
    } catch (error) {
      setDetail({ kind: 'job', data: { status: 'failed', error_message: error.message } })
      setLoading(false)
    }
  }

  function close() {
    setDetail(null)
    setLoading(false)
    routeOpenedRef.current = ''
    const returnPath = returnPathRef.current
    returnPathRef.current = ''
    if (returnPath) {
      window.history.back()
      return
    }
    if (/\/activity\/[^/]+\/[^/]+\/?$/i.test(window.location.pathname)) {
      window.history.replaceState({}, '', rmmPath(undefined, 'activity-audit'))
    }
  }

  useEffect(() => {
    if (activityId) {
      if (routeOpenedRef.current !== String(activityId)) openById(activityId, activityCategory)
    } else if (routeOpenedRef.current) {
      routeOpenedRef.current = ''
      setDetail(null)
      setLoading(false)
    }
  }, [activityCategory, activityId])

  useEffect(() => {
    const handlePop = () => {
      if (!/\/activity\/[^/]+\/[^/]+\/?$/i.test(window.location.pathname)) {
        routeOpenedRef.current = ''
        returnPathRef.current = ''
        setDetail(null)
        setLoading(false)
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  return { detail, loading, open, close }
}

export async function prefetchDeviceHistory(device) {
  if (!device?.agentDeviceId) return
  const activityKey = 'activity:' + device.agentDeviceId
  const jobsKey = 'jobs:' + device.agentDeviceId
  const tasks = []
  if (!historyCacheGet(activityKey)) {
    tasks.push(apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/activity?limit=120')
      .then((payload) => historyCacheSet(activityKey, payload.events || []))
      .catch(() => {}))
  }
  if (!historyCacheGet(jobsKey)) {
    tasks.push(apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/actions?limit=100')
      .then((payload) => historyCacheSet(jobsKey, payload.jobs || []))
      .catch(() => {}))
  }
  await Promise.all(tasks)
}

export function DeviceActivityTimeline({ device }) {
  const initialEvents = device?.agentDeviceId ? historyCacheGet('activity:' + device.agentDeviceId) : null
  const [events, setEvents] = useState(() => initialEvents || [])
  const [loading, setLoading] = useState(!initialEvents)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('')
  const details = useActivityDetails()

  async function load(silent = false) {
    if (!device?.agentDeviceId) { setLoading(false); setEvents([]); return }
    if (!silent) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '120' })
      if (category) params.set('category', category)
      const payload = await apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/activity?' + params.toString())
      const nextEvents = payload.events || []
      setEvents(nextEvents)
      if (!category) historyCacheSet('activity:' + device.agentDeviceId, nextEvents)
    } catch (err) {
      if (!silent) { setError(err.message); setEvents([]) }
    } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    const cached = !category && device?.agentDeviceId ? historyCacheGet('activity:' + device.agentDeviceId) : null
    load(Boolean(cached))
    if (!device?.agentDeviceId) return undefined
    const timer = window.setInterval(() => load(true), 5000)
    return () => window.clearInterval(timer)
  }, [device?.agentDeviceId, category])

  return <section className="rmm-audit-card">
    <div className="rmm-device-section-heading">
      <div><span className="rmm-eyebrow">Device history</span><h2>Activity</h2><p>Technician actions, remote sessions, jobs and Agent-detected changes for this device.</p></div>
      <div className="rmm-audit-toolbar compact">
        <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All activity</option><option value="remote">Remote</option><option value="terminal">Terminal</option><option value="files">Files</option><option value="software">Software</option><option value="process">Processes</option><option value="service">Services</option><option value="registry">Registry</option><option value="security">Security</option><option value="updates">Updates</option><option value="session">Sessions</option><option value="inventory">Inventory</option><option value="device">Device</option><option value="job">Jobs</option></select>
        <button onClick={load} type="button"><RefreshCw size={14} /> Refresh</button>
      </div>
    </div>
    {loading ? <SkeletonRows /> : error ? <div className="rmm-audit-empty"><AlertTriangle size={22} /><strong>Activity could not be loaded</strong><span>{error}</span></div> : events.length ? <div className="rmm-audit-timeline">{events.map((event) => <ActivityRow event={event} key={event.id} onDetails={details.open} />)}</div> : <div className="rmm-audit-empty"><History size={24} /><strong>No activity recorded yet</strong><span>New remote sessions, terminal work, jobs and Agent-detected changes will appear here automatically.</span></div>}
    <DetailModal detail={details.detail} loading={details.loading} onClose={details.close} />
  </section>
}

export function DeviceJobsPanel({ device }) {
  const initialJobs = device?.agentDeviceId ? historyCacheGet('jobs:' + device.agentDeviceId) : null
  const [jobs, setJobs] = useState(() => initialJobs || [])
  const [loading, setLoading] = useState(!initialJobs)
  const [error, setError] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)

  async function load(silent = false) {
    if (!device?.agentDeviceId) { setLoading(false); setJobs([]); return }
    if (!silent) setLoading(true)
    try {
      const payload = await apiJson('/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/actions?limit=100')
      const nextJobs = payload.jobs || []
      setJobs(nextJobs)
      historyCacheSet('jobs:' + device.agentDeviceId, nextJobs)
      setError('')
    } catch (err) { if (!silent) setError(err.message) } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    const cached = device?.agentDeviceId ? historyCacheGet('jobs:' + device.agentDeviceId) : null
    load(Boolean(cached))
    const timer = window.setInterval(() => {
      if (jobs.some((job) => ['queued', 'claimed'].includes(job.status))) load(true)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [device?.agentDeviceId, jobs.some((job) => ['queued', 'claimed'].includes(job.status))])

  return <section className="rmm-audit-card">
    <div className="rmm-device-section-heading"><div><span className="rmm-eyebrow">Execution history</span><h2>Jobs</h2><p>Queued, running, successful and failed work for this device only.</p></div><button className="rmm-audit-refresh" onClick={() => load()} type="button"><RefreshCw size={14} /> Refresh</button></div>
    {loading ? <SkeletonRows /> : error ? <div className="rmm-audit-empty"><AlertTriangle size={22} /><strong>Jobs could not be loaded</strong><span>{error}</span></div> : jobs.length ? <div className="rmm-device-jobs">
      <div className="rmm-device-job-head"><span>Job</span><span>Status</span><span>Requested by</span><span>Started</span><span>Duration</span><span /></div>
      {jobs.map((job) => {
        const visual = jobVisualStatus(job)
        const bulkSummary = visual.summary
        return <button className="rmm-device-job-row" key={job.id} onClick={() => setSelectedJob({ kind: 'job', data: job })} type="button">
          <span><strong>{jobLabel(job.job_type)}</strong><small>{job.job_type}</small>{bulkSummary && <small>{bulkSummary.successful} succeeded{bulkSummary.remediationRequired ? ' · ' + bulkSummary.remediationRequired + ' cleanup' : ''}{bulkSummary.failed ? ' · ' + bulkSummary.failed + ' failed' : ''}</small>}</span>
          <span className={'rmm-audit-outcome ' + visual.tone}>{visual.label}</span>
          <span>{job.initiated_by_label || job.initiated_by || 'SYSTEM'}</span>
          <span>{formatWhen(job.claimed_at || job.created_at)}</span>
          <span>{durationBetween(job.claimed_at || job.created_at, job.completed_at || job.updated_at) || '—'}</span>
          <ChevronRight size={15} />
        </button>
      })}
    </div> : <div className="rmm-audit-empty"><ListChecks size={24} /><strong>No jobs for this device</strong><span>Device actions, maintenance and automation jobs will appear here.</span></div>}
    <DetailModal detail={selectedJob} loading={false} onClose={() => setSelectedJob(null)} />
  </section>
}

export function RmmAuditActivity({ activityCategory = '', activityId = '', devices = [] }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ q: '', actor: '', agentDeviceId: '', category: '', outcome: '', from: '', to: '' })
  const [applied, setApplied] = useState(filters)
  const details = useActivityDetails({ activityCategory, activityId })

  async function load(next = applied) {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ limit: '200' })
      Object.entries(next).forEach(([key, value]) => {
        if (!value) return
        if (key === 'from') params.set(key, value + 'T00:00:00')
        else if (key === 'to') params.set(key, value + 'T23:59:59')
        else params.set(key, value)
      })
      const payload = await apiJson('/api/v1/rmm/activity?' + params.toString())
      setEvents(payload.events || [])
    } catch (err) { setError(err.message); setEvents([]) } finally { setLoading(false) }
  }
  useEffect(() => { load(applied) }, [applied])

  function apply(event) { event.preventDefault(); setApplied({ ...filters }) }
  function clear() {
    const empty = { q: '', actor: '', agentDeviceId: '', category: '', outcome: '', from: '', to: '' }
    setFilters(empty); setApplied(empty)
  }

  const categories = useMemo(() => ['remote', 'terminal', 'files', 'software', 'process', 'service', 'registry', 'security', 'updates', 'session', 'inventory', 'device', 'job'], [])
  return <>
    <div className="rmm-page-heading"><div><span className="rmm-eyebrow">Administration</span><h1>RMM activity audit</h1><p>Tenant-wide immutable operational history, filterable by device, technician, activity and outcome.</p></div></div>
    <form className="rmm-audit-filters" onSubmit={apply}>
      <label className="wide"><Search size={15} /><input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Search activity, devices or details…" /></label>
      <label><User size={14} /><input value={filters.actor} onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))} placeholder="Technician" /></label>
      <select value={filters.agentDeviceId} onChange={(event) => setFilters((current) => ({ ...current, agentDeviceId: event.target.value }))}><option value="">All devices</option>{devices.filter((device) => device.agentDeviceId).map((device) => <option key={device.agentDeviceId} value={device.agentDeviceId}>{device.name}</option>)}</select>
      <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option>{categories.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
      <select value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value }))}><option value="">All outcomes</option><option value="success">Success</option><option value="failed">Failed</option><option value="not_applicable">Not applicable</option><option value="requested">Requested</option><option value="running">Running</option><option value="info">Info</option></select>
      <label><Clock3 size={14} /><input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
      <label><Clock3 size={14} /><input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
      <button className="rmm-primary compact" type="submit"><Filter size={14} /> Apply</button>
      <button onClick={clear} type="button">Clear</button>
    </form>
    <section className="rmm-audit-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Audit stream</span><h2>{events.length} activities</h2></div><button onClick={() => load()} type="button"><RefreshCw size={14} /> Refresh</button></div>
      {loading ? <SkeletonRows count={8} /> : error ? <div className="rmm-audit-empty"><XCircle size={24} /><strong>Audit log could not be loaded</strong><span>{error}</span></div> : events.length ? <div className="rmm-audit-timeline admin">{events.map((event) => <ActivityRow event={event} key={event.id} onDetails={details.open} />)}</div> : <div className="rmm-audit-empty"><CheckCircle2 size={24} /><strong>No matching activity</strong><span>Adjust the filters or wait for managed-device activity to be recorded.</span></div>}
    </section>
    <DetailModal detail={details.detail} loading={details.loading} onClose={details.close} />
  </>
}

export { SkeletonRows }
