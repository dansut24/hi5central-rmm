import { useEffect, useMemo, useState } from 'react'
import {
  Check, ChevronDown, ChevronRight, Code2, Laptop, ListChecks, Play, Plus,
  RefreshCw, Save, ShieldCheck, TerminalSquare, Upload, X,
} from 'lucide-react'
import './RmmAutomationWorkspace.css'

const API_BASE = window.__HI5_API_BASE__ || ''

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The RMM request failed.')
  return payload
}

function dateText(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function shortHash(value = '') {
  return value ? `${value.slice(0, 10)}…` : '—'
}

function statusTone(value = '') {
  const text = String(value).toLowerCase()
  if (['completed', 'published'].includes(text)) return 'healthy'
  if (['failed', 'cancelled'].includes(text)) return 'critical'
  if (['claimed', 'running'].includes(text)) return 'running'
  if (['queued', 'draft'].includes(text)) return 'warning'
  return 'neutral'
}

function Status({ children }) {
  return <span className={`rmm-auto-status ${statusTone(children)}`}>{children}</span>
}

function AutomationEditor({ automation, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: automation?.name || '',
    description: automation?.description || '',
    category: automation?.category || 'General',
    timeoutSeconds: automation?.latest_timeout_seconds || automation?.published_timeout_seconds || 120,
    scriptText: automation?.latest_script_text || '# Hi5Central automation\n',
    releaseNotes: automation?.latest_release_notes || '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set(name, value) { setForm((current) => ({ ...current, [name]: value })) }

  async function save() {
    setBusy(true); setError('')
    try {
      if (automation?.id) {
        await api(`/api/v1/rmm/automations/${encodeURIComponent(automation.id)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        await onSaved(automation.id)
      } else {
        const created = await api('/api/v1/rmm/automations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        await onSaved(created.id)
      }
    } catch (saveError) { setError(saveError.message) } finally { setBusy(false) }
  }

  return <div className="rmm-auto-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="rmm-auto-editor" role="dialog" aria-modal="true">
      <header><div><span className="rmm-eyebrow">{automation ? 'Draft version' : 'New automation'}</span><h2>{automation ? automation.name : 'Create automation'}</h2></div><button onClick={onClose} type="button"><X size={18} /></button></header>
      {error ? <div className="rmm-auto-error">{error}</div> : null}
      <div className="rmm-auto-form-grid">
        <label><span>Name</span><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Clear Teams cache" /></label>
        <label><span>Category</span><input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Maintenance" /></label>
        <label className="wide"><span>Description</span><input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Explain what this action does and when to use it." /></label>
        <label><span>Run as</span><input disabled value="Local SYSTEM" /></label>
        <label><span>Timeout (seconds)</span><input min="5" max="3600" type="number" value={form.timeoutSeconds} onChange={(e) => set('timeoutSeconds', Number(e.target.value))} /></label>
        <label className="wide"><span>PowerShell</span><textarea className="script" spellCheck="false" value={form.scriptText} onChange={(e) => set('scriptText', e.target.value)} /></label>
        <label className="wide"><span>Release notes</span><input value={form.releaseNotes} onChange={(e) => set('releaseNotes', e.target.value)} placeholder="Optional note describing this revision" /></label>
      </div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary compact" disabled={busy} onClick={save} type="button"><Save size={15} /> {busy ? 'Saving…' : 'Save draft'}</button></footer>
    </section>
  </div>
}

function RunPanel({ automation, devices, onClose, onQueued }) {
  const available = useMemo(() => devices.filter((device) => device.agent_device_id), [devices])
  const onlineAvailable = useMemo(() => available.filter((device) => device.agent_online), [available])
  const offlineCount = available.length - onlineAvailable.length
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function toggle(id) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  async function run() {
    setBusy(true); setError('')
    try {
      const result = await api(`/api/v1/rmm/automations/${encodeURIComponent(automation.id)}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentDeviceIds: selected }),
      })
      onQueued(result)
    } catch (runError) { setError(runError.message) } finally { setBusy(false) }
  }
  return <div className="rmm-auto-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="rmm-auto-run-panel" role="dialog" aria-modal="true">
      <header><div><span className="rmm-eyebrow">Run published automation</span><h2>{automation.name}</h2><p>Version {automation.published_version_number} · {shortHash(automation.published_sha256)}</p></div><button onClick={onClose} type="button"><X size={18} /></button></header>
      {error ? <div className="rmm-auto-error">{error}</div> : null}
      <div className="rmm-auto-target-toolbar"><strong>{selected.length} selected</strong><button disabled={!onlineAvailable.length} onClick={() => setSelected(onlineAvailable.map((device) => device.agent_device_id))} type="button">Select all online</button><button onClick={() => setSelected([])} type="button">Clear</button></div>
      {offlineCount > 0 ? <div className="rmm-auto-offline-note">{offlineCount} offline device{offlineCount === 1 ? '' : 's'} cannot be selected. Hi5Central will not queue work for reconnect.</div> : null}
      <div className="rmm-auto-target-list">{available.map((device) => <label className={device.agent_online ? '' : 'is-offline'} key={device.agent_device_id}><input checked={selected.includes(device.agent_device_id)} disabled={!device.agent_online} onChange={() => toggle(device.agent_device_id)} type="checkbox" /><span className="rmm-device-icon neutral"><Laptop size={16} /></span><span><strong>{device.name}</strong><small>{device.user_display_name || device.agent_active_user || device.reference} · {device.agent_online ? 'Online' : 'Offline · live actions disabled'}</small></span></label>)}</div>
      {!available.length ? <div className="rmm-auto-empty">No enrolled Hi5Central Agent devices are available.</div> : null}
      {available.length > 0 && !onlineAvailable.length ? <div className="rmm-auto-empty">All enrolled Agent devices are offline. No jobs can be started.</div> : null}
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary compact" disabled={busy || !selected.length} onClick={run} type="button"><Play size={15} /> {busy ? 'Starting…' : `Run on ${selected.length || 0} online device${selected.length === 1 ? '' : 's'}`}</button></footer>
    </section>
  </div>
}

function TrayPolicy({ automations, policy, onSaved }) {
  const published = automations.filter((item) => item.status === 'published' && item.published_version_id)
  const [enabled, setEnabled] = useState(Boolean(policy?.enabled))
  const [supportName, setSupportName] = useState(policy?.support?.displayName || '')
  const [supportUrl, setSupportUrl] = useState(policy?.support?.portalUrl || '')
  const [actions, setActions] = useState(() => (policy?.actions || []).map((action) => ({ automationId: action.automation_id, label: action.label, description: action.description, confirmationRequired: action.confirmation_required })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function included(id) { return actions.some((action) => action.automationId === id) }
  function toggle(automation) {
    setActions((current) => current.some((action) => action.automationId === automation.id)
      ? current.filter((action) => action.automationId !== automation.id)
      : [...current, { automationId: automation.id, label: automation.name, description: automation.description || '', confirmationRequired: false }])
  }
  function patch(id, key, value) { setActions((current) => current.map((action) => action.automationId === id ? { ...action, [key]: value } : action)) }
  async function save() {
    setBusy(true); setError('')
    try {
      const result = await api('/api/v1/rmm/tray-policy', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default tray policy', enabled, support: { displayName: supportName, portalUrl: supportUrl }, branding: {}, actions }),
      })
      onSaved(result.policy)
    } catch (saveError) { setError(saveError.message) } finally { setBusy(false) }
  }

  return <section className="rmm-auto-tray-card">
    <div className="rmm-auto-section-heading"><div><span className="rmm-eyebrow">End-user experience</span><h2>Hi5Central system tray</h2><p>Expose only published, administrator-approved actions. Turning this off removes the end-user tray surface without disabling the RMM Agent.</p></div><label className="rmm-auto-switch"><input checked={enabled} onChange={(e) => setEnabled(e.target.checked)} type="checkbox" /><span />{enabled ? 'Enabled' : 'Disabled'}</label></div>
    {error ? <div className="rmm-auto-error">{error}</div> : null}
    <div className="rmm-auto-tray-support"><label><span>Support name</span><input value={supportName} onChange={(e) => setSupportName(e.target.value)} placeholder="IT Support" /></label><label><span>Support portal URL</span><input value={supportUrl} onChange={(e) => setSupportUrl(e.target.value)} placeholder="https://support.example.com" /></label></div>
    <div className="rmm-auto-tray-actions"><div className="head"><strong>Published self-service actions</strong><span>{actions.length}/20 available in tray</span></div>{published.map((automation) => {
      const action = actions.find((item) => item.automationId === automation.id)
      return <article className={action ? 'selected' : ''} key={automation.id}><label className="check"><input checked={Boolean(action)} onChange={() => toggle(automation)} type="checkbox" /><span><strong>{automation.name}</strong><small>v{automation.published_version_number} · {shortHash(automation.published_sha256)}</small></span></label>{action ? <div className="config"><input value={action.label} onChange={(e) => patch(automation.id, 'label', e.target.value)} /><label><input checked={Boolean(action.confirmationRequired)} onChange={(e) => patch(automation.id, 'confirmationRequired', e.target.checked)} type="checkbox" /> Require user confirmation</label></div> : null}</article>
    })}</div>
    {!published.length ? <div className="rmm-auto-empty">Publish an automation before making it available in the system tray.</div> : null}
    <div className="rmm-auto-save-row"><button className="rmm-primary compact" disabled={busy} onClick={save} type="button"><Save size={15} /> {busy ? 'Saving…' : 'Save tray policy'}</button></div>
  </section>
}

export function RmmAutomation() {
  const [automations, setAutomations] = useState([])
  const [devices, setDevices] = useState([])
  const [policy, setPolicy] = useState(null)
  const [editor, setEditor] = useState(null)
  const [runAutomation, setRunAutomation] = useState(null)
  const [tab, setTab] = useState('library')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setError('')
    const [automationData, deviceData, trayData] = await Promise.all([
      api('/api/v1/rmm/automations'), api('/api/v1/rmm/devices'), api('/api/v1/rmm/tray-policy'),
    ])
    setAutomations(automationData.automations || [])
    setDevices(deviceData.devices || [])
    setPolicy(trayData.policy || null)
  }
  useEffect(() => { load().catch((loadError) => setError(loadError.message)) }, [])

  async function publish(item) {
    setBusyId(item.id); setError(''); setNotice('')
    try {
      const result = await api(`/api/v1/rmm/automations/${encodeURIComponent(item.id)}/publish`, { method: 'POST' })
      setNotice(`${item.name} version ${result.versionNumber} published · ${shortHash(result.sha256)}`)
      await load()
    } catch (publishError) { setError(publishError.message) } finally { setBusyId('') }
  }

  const published = automations.filter((item) => item.status === 'published').length
  const drafts = automations.filter((item) => item.latest_version_state === 'draft').length

  return <>
    <div className="rmm-page-heading"><div><span className="rmm-eyebrow">Automation</span><h1>Scripts & automation</h1><p>Build versioned, trusted actions once and invoke the same published version from technicians, schedules, remediation or the end-user tray.</p></div><div className="rmm-auto-heading-actions"><button onClick={() => load().catch((loadError) => setError(loadError.message))} type="button"><RefreshCw size={15} /> Refresh</button><button className="rmm-primary compact" onClick={() => setEditor({ new: true })} type="button"><Plus size={15} /> New automation</button></div></div>
    {error ? <div className="rmm-auto-error">{error}</div> : null}{notice ? <div className="rmm-auto-notice"><Check size={15} /> {notice}</div> : null}
    <div className="rmm-auto-summary"><article><Code2 size={18} /><span><strong>{automations.length}</strong><small>Automations</small></span></article><article><ShieldCheck size={18} /><span><strong>{published}</strong><small>Published</small></span></article><article><Upload size={18} /><span><strong>{drafts}</strong><small>Draft revisions</small></span></article><article><TerminalSquare size={18} /><span><strong>{policy?.actions?.length || 0}</strong><small>Tray actions</small></span></article></div>
    <div className="rmm-auto-tabs"><button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')} type="button">Automation library</button><button className={tab === 'tray' ? 'active' : ''} onClick={() => setTab('tray')} type="button">System tray self-service</button></div>
    {tab === 'library' ? <section className="rmm-auto-library">{automations.map((item) => <article className="rmm-auto-card" key={item.id}><header><span className="rmm-script-icon"><Code2 size={19} /></span><div><div><span className="rmm-eyebrow">{item.category} · Windows</span><Status>{item.status}</Status></div><h2>{item.name}</h2><p>{item.description || 'No description yet.'}</p></div></header><div className="rmm-auto-version-row"><span><small>Published</small><strong>{item.published_version_number ? `v${item.published_version_number}` : 'Not published'}</strong></span><span><small>Latest</small><strong>v{item.latest_version_number || 1} · {item.latest_version_state}</strong></span><span><small>SHA-256</small><strong>{shortHash(item.published_sha256 || item.latest_sha256)}</strong></span><span><small>Timeout</small><strong>{item.latest_timeout_seconds || 120}s</strong></span></div><footer><button onClick={() => setEditor(item)} type="button">Edit draft</button>{item.latest_version_state === 'draft' ? <button disabled={busyId === item.id} onClick={() => publish(item)} type="button"><Upload size={14} /> Publish</button> : null}<button className="rmm-primary compact" disabled={!item.published_version_id} onClick={() => setRunAutomation(item)} type="button"><Play size={14} /> Run</button></footer></article>)}</section> : <TrayPolicy automations={automations} policy={policy} onSaved={(next) => { setPolicy(next); setNotice('System tray policy saved.') }} />}
    {!automations.length && tab === 'library' ? <div className="rmm-auto-empty large"><Code2 size={26} /><strong>No automations yet</strong><span>Create a PowerShell automation, save it as a draft, then explicitly publish the version you want devices to run.</span></div> : null}
    {editor ? <AutomationEditor automation={editor.new ? null : editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice('Draft saved.'); await load() }} /> : null}
    {runAutomation ? <RunPanel automation={runAutomation} devices={devices} onClose={() => setRunAutomation(null)} onQueued={(result) => { setRunAutomation(null); setNotice(result.queued + ' job' + (result.queued === 1 ? '' : 's') + ' started for online devices.' + (result.skippedOffline ? ' ' + result.skippedOffline + ' offline device' + (result.skippedOffline === 1 ? '' : 's') + ' skipped.' : '')) }} /> : null}
  </>
}

export function RmmJobs() {
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load(silent = false) {
    if (!silent) setRefreshing(true)
    try { const result = await api('/api/v1/rmm/jobs?limit=150'); setJobs(result.jobs || []); setError('') }
    catch (loadError) { setError(loadError.message) }
    finally { if (!silent) setRefreshing(false) }
  }
  useEffect(() => {
    load(); const timer = window.setInterval(() => load(true), 5000); return () => window.clearInterval(timer)
  }, [])
  async function cancel(id) {
    try { await api(`/api/v1/rmm/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); await load(true) }
    catch (cancelError) { setError(cancelError.message) }
  }
  return <>
    <div className="rmm-page-heading"><div><span className="rmm-eyebrow">Execution</span><h1>Jobs</h1><p>Live execution history across technician actions, system tray self-service, schedules and future remediation workflows.</p></div><button onClick={() => load()} type="button"><RefreshCw className={refreshing ? 'spin' : ''} size={15} /> Refresh</button></div>
    {error ? <div className="rmm-auto-error">{error}</div> : null}
    <section className="rmm-auto-jobs"><div className="head"><span>Job</span><span>Device</span><span>Status</span><span>Version</span><span>Initiated by</span><span>Started</span><span /></div>{jobs.map((job) => <article key={job.id}><span><strong>{job.automation_name || job.job_type}</strong><small>{job.id.slice(0, 8)} · {job.job_type}</small></span><span><strong>{job.device_name}</strong><small>{job.device_reference}</small></span><span><Status>{job.status}</Status>{job.error_message ? <small className="error">{job.error_message}</small> : null}</span><span><strong>{job.version_number ? `v${job.version_number}` : '—'}</strong><small>{shortHash(job.content_sha256)}</small></span><span><strong>{job.initiated_by_label || job.queued_by_name || job.initiated_by}</strong><small>{job.initiated_by}</small></span><span><strong>{dateText(job.created_at)}</strong><small>{job.completed_at ? `Completed ${dateText(job.completed_at)}` : job.claimed_at ? 'Agent claimed' : 'Waiting for Agent'}</small></span><span>{job.status === 'queued' ? <button onClick={() => cancel(job.id)} type="button"><X size={14} /> Cancel</button> : <ChevronRight size={15} />}</span></article>)}</section>
    {!jobs.length ? <div className="rmm-auto-empty large"><ListChecks size={26} /><strong>No jobs yet</strong><span>Running a published automation will create its first auditable job here.</span></div> : null}
  </>
}
