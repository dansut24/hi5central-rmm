import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Columns3,
  Download,
  FilterX,
  Laptop,
  Lock,
  MapPin,
  Monitor,
  Network,
  Plus,
  Save,
  Server,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  Wifi,
  X,
} from 'lucide-react'
import { rmmDevices } from '../../data/rmmData.js'
import { rmmDefaultSavedViews } from '../../data/rmmScopeData.js'
import {
  createRmmGroup,
  createRmmSavedView,
  deleteRmmGroup,
  deleteRmmSavedView,
  loadRmmScope,
} from '../../lib/rmmScopeApi.js'
import './RmmEstateManagement.css'

const DEFAULT_COLUMNS = ['device', 'user', 'siteGroup', 'sourceTenant', 'health', 'resources', 'patch', 'lastSeen']
const COLUMN_OPTIONS = [
  ['device', 'Device'],
  ['user', 'User'],
  ['siteGroup', 'Site / group'],
  ['sourceTenant', 'Source tenant'],
  ['health', 'Health'],
  ['resources', 'Resources'],
  ['patch', 'Patch'],
  ['lastSeen', 'Last seen'],
]

const HEALTH_ORDER = { Critical: 5, Warning: 4, Offline: 3, Healthy: 1, Online: 1 }

function healthClass(value = '') {
  const normalized = String(value).toLowerCase()
  if (['critical', 'failed'].includes(normalized)) return 'critical'
  if (['warning', 'high', 'attention'].includes(normalized)) return 'warning'
  if (['offline'].includes(normalized)) return 'offline'
  if (['healthy', 'online', 'completed', 'active'].includes(normalized)) return 'healthy'
  return 'neutral'
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

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="rmm-page-heading"><div><span className="rmm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function normalizeInventoryFilters(filters = {}) {
  return {
    quickView: filters.quickView || 'all',
    siteId: filters.siteId || 'All',
    groupId: filters.groupId || 'All',
    sourceTenant: filters.sourceTenant || 'All',
    platform: filters.platform || 'All',
    health: filters.health || 'All',
    patchState: filters.patchState || 'All',
  }
}

function deviceMatchesQuickView(device, quickView) {
  if (quickView === 'attention') return device.health !== 'Healthy'
  if (quickView === 'online') return device.status === 'Online'
  if (quickView === 'offline') return device.status === 'Offline'
  if (quickView === 'servers') return String(device.type).toLowerCase().includes('server')
  if (quickView === 'laptops') return String(device.type).toLowerCase().includes('laptop') || String(device.type).toLowerCase().includes('macbook')
  return true
}

function deviceMatchesPatchState(device, patchState) {
  if (patchState === 'At risk') return device.patchCompliance != null && Number(device.patchCompliance) < 90
  if (patchState === 'Compliant') return device.patchCompliance != null && Number(device.patchCompliance) >= 90
  return true
}

function sortDevices(devices, sort) {
  const direction = sort.direction === 'desc' ? -1 : 1
  return [...devices].sort((a, b) => {
    if (sort.field === 'health') return ((HEALTH_ORDER[a.health] || 0) - (HEALTH_ORDER[b.health] || 0)) * direction
    if (sort.field === 'patch') return (Number(a.patchCompliance || 0) - Number(b.patchCompliance || 0)) * direction
    if (sort.field === 'site') return String(a.site || '').localeCompare(String(b.site || '')) * direction
    return String(a.name || '').localeCompare(String(b.name || '')) * direction
  })
}

function buildGridTemplate(columns) {
  const widths = {
    device: 'minmax(250px, 2fr)',
    user: 'minmax(180px, 1.15fr)',
    siteGroup: 'minmax(170px, 1fr)',
    sourceTenant: 'minmax(150px, .9fr)',
    health: 'minmax(120px, .72fr)',
    resources: 'minmax(180px, 1fr)',
    patch: 'minmax(125px, .72fr)',
    lastSeen: 'minmax(135px, .78fr)',
  }
  return `${columns.map((column) => widths[column]).join(' ')} 36px`
}

function renderColumnHeader(column) {
  return COLUMN_OPTIONS.find(([id]) => id === column)?.[1] || column
}

function SavedViewModal({ filters, onClose, onSave, sort, visibleColumns }) {
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState('Private')
  const [favourite, setFavourite] = useState(false)
  const [makeDefault, setMakeDefault] = useState(false)
  const valid = name.trim().length >= 2

  return (
    <div className="rmm-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rmm-modal rmm-save-view-modal" role="dialog" aria-modal="true" aria-label="Save device view">
        <header><div><span className="rmm-eyebrow">Device inventory</span><h2>Save current view</h2><p>Store these filters, sorting and visible columns for quick reuse.</p></div><button aria-label="Close" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="rmm-modal-body">
          <label>View name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. London patch risk" /></label>
          <fieldset><legend>Visibility</legend><button className={visibility === 'Private' ? 'active' : ''} onClick={() => setVisibility('Private')} type="button"><Lock size={16} /><span><strong>Private</strong><small>Only visible to you</small></span></button><button className={visibility === 'Shared' ? 'active' : ''} onClick={() => setVisibility('Shared')} type="button"><Share2 size={16} /><span><strong>Shared</strong><small>Available to RMM technicians</small></span></button></fieldset>
          <div className="rmm-saved-view-options"><label><input checked={favourite} onChange={(event) => setFavourite(event.target.checked)} type="checkbox" /><span><strong>Favourite</strong><small>Keep this view at the front of the list.</small></span></label><label><input checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} type="checkbox" /><span><strong>Default view</strong><small>Open Devices using this view automatically.</small></span></label></div>
          <div className="rmm-saved-view-summary"><strong>Will save</strong><span>{Object.values(filters).filter((value) => value && value !== 'All' && value !== 'all').length} active filters</span><span>{visibleColumns.length} visible columns</span><span>Sort: {sort.field} · {sort.direction}</span></div>
        </div>
        <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid} onClick={() => valid && onSave({ name: name.trim(), visibility, favourite, default: makeDefault })} type="button"><Save size={15} /> Save view</button></footer>
      </section>
    </div>
  )
}

function ColumnChooser({ columns, onChange, onClose }) {
  return (
    <div className="rmm-column-popover">
      <header><strong>Visible columns</strong><button aria-label="Close columns" onClick={onClose} type="button"><X size={14} /></button></header>
      {COLUMN_OPTIONS.map(([id, label]) => {
        const required = ['device', 'health'].includes(id)
        const checked = columns.includes(id)
        return <label key={id}><input checked={checked} disabled={required} onChange={() => onChange(checked ? columns.filter((column) => column !== id) : [...columns, id])} type="checkbox" /><span>{label}</span>{required && <small>Required</small>}</label>
      })}
    </div>
  )
}

export function RmmDeviceInventory({ openDevice, query, preset, onPresetApplied, devices = rmmDevices, sites = [] }) {
  const [filters, setFilters] = useState(() => normalizeInventoryFilters())
  const [sort, setSort] = useState({ field: 'name', direction: 'asc' })
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS)
  const [customViews, setCustomViews] = useState([])
  const [customGroups, setCustomGroups] = useState([])
  const [activeViewId, setActiveViewId] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showColumns, setShowColumns] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [scopeError, setScopeError] = useState('')
  const normalized = query.trim().toLowerCase()

  const allViews = useMemo(() => [...rmmDefaultSavedViews, ...customViews], [customViews])
  const allSites = useMemo(() => sites.filter((site) => site.active !== false), [sites])
  const allGroups = customGroups

  useEffect(() => {
    let active = true
    loadRmmScope()
      .then((payload) => {
        if (!active) return
        const savedViews = payload.savedViews || []
        setCustomViews(savedViews)
        setCustomGroups(payload.groups || [])
        const savedDefault = savedViews.find((view) => view.default)
        if (savedDefault) {
          setFilters(normalizeInventoryFilters(savedDefault.filters))
          setSort(savedDefault.sort || { field: 'name', direction: 'asc' })
          setVisibleColumns(Array.isArray(savedDefault.columns) && savedDefault.columns.length ? savedDefault.columns : DEFAULT_COLUMNS)
          setActiveViewId(savedDefault.id)
        }
        setScopeError('')
      })
      .catch((error) => {
        if (active) setScopeError(error?.message || 'Unable to load RMM scope configuration.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!preset) return
    setFilters((current) => normalizeInventoryFilters({ ...current, ...preset }))
    setActiveViewId('')
    onPresetApplied?.()
  }, [preset, onPresetApplied])

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
    setActiveViewId('')
  }

  function applySavedView(view) {
    setFilters(normalizeInventoryFilters(view.filters))
    setSort(view.sort || { field: 'name', direction: 'asc' })
    setVisibleColumns(Array.isArray(view.columns) && view.columns.length ? view.columns : DEFAULT_COLUMNS)
    setActiveViewId(view.id)
    setShowColumns(false)
    setShowMobileFilters(false)
  }

  function resetView() {
    setFilters(normalizeInventoryFilters())
    setSort({ field: 'name', direction: 'asc' })
    setVisibleColumns(DEFAULT_COLUMNS)
    setActiveViewId('')
    setShowMobileFilters(false)
  }

  async function saveCurrentView({ name, visibility, favourite = false, default: makeDefault = false }) {
    try {
      const result = await createRmmSavedView({
        name,
        visibility,
        favourite,
        default: makeDefault,
        filters,
        sort,
        columns: visibleColumns,
      })
      setCustomViews(result.bundle?.savedViews || [])
      setCustomGroups(result.bundle?.groups || customGroups)
      setActiveViewId(result.id || '')
      setScopeError('')
      setShowSaveModal(false)
    } catch (error) {
      setScopeError(error?.message || 'Unable to save this view.')
    }
  }

  async function deleteView(viewId) {
    try {
      const result = await deleteRmmSavedView(viewId)
      setCustomViews(result.bundle?.savedViews || [])
      setCustomGroups(result.bundle?.groups || customGroups)
      if (activeViewId === viewId) setActiveViewId('')
      setScopeError('')
    } catch (error) {
      setScopeError(error?.message || 'Unable to delete this view.')
    }
  }

  const visible = useMemo(() => sortDevices(devices.filter((device) => {
    const searchMatch = !normalized || [
      device.id,
      device.name,
      device.user,
      device.userEmail,
      device.os,
      device.site,
      device.group,
      device.sourceTenant,
      device.ip,
      device.publicIp,
      device.manufacturer,
      device.model,
      device.serial,
      ...(device.tags || []),
    ].join(' ').toLowerCase().includes(normalized)
    if (!searchMatch || !deviceMatchesQuickView(device, filters.quickView)) return false
    if (filters.siteId !== 'All' && device.siteId !== filters.siteId) return false
    if (filters.groupId !== 'All') {
      const group = allGroups.find((item) => item.id === filters.groupId)
      if (!group || !(group.deviceIds || []).includes(device.id)) return false
    }
    if (filters.sourceTenant !== 'All' && device.sourceTenant !== filters.sourceTenant) return false
    if (filters.platform !== 'All' && device.platform !== filters.platform) return false
    if (filters.health !== 'All' && device.health !== filters.health) return false
    if (!deviceMatchesPatchState(device, filters.patchState)) return false
    return true
  }), sort), [allGroups, devices, filters, normalized, sort])

  const needsAttention = devices.filter((device) => device.health !== 'Healthy').length
  const offline = devices.filter((device) => device.status === 'Offline').length
  const patchRisk = devices.filter((device) => device.patchCompliance != null && Number(device.patchCompliance) < 90).length
  const quickViews = [['all', 'All devices'], ['attention', 'Needs attention'], ['online', 'Online'], ['offline', 'Offline'], ['servers', 'Servers'], ['laptops', 'Laptops']]
  const activeFilters = Object.values(filters).filter((value) => value && value !== 'All' && value !== 'all').length
  const advancedFilterCount = Object.entries(filters).filter(([key, value]) => key !== 'quickView' && value && value !== 'All' && value !== 'all').length
  const gridTemplateColumns = buildGridTemplate(visibleColumns)
  const emptyTitle = devices.length ? 'No devices match this view' : 'No managed devices yet'
  const emptyCopy = devices.length
    ? 'Change the search, scope or saved view filters.'
    : 'Deploy the Hi5Central agent or connect a supported source tenant to populate this estate.'

  return (
    <>
      <PageHeading eyebrow="Estate" title="Devices" description="Search, scope and manage every endpoint, server and monitored network device." action={<button className="rmm-primary compact" type="button"><Download size={15} /> Deploy agent</button>} />
      {scopeError && <div className="rmm-scope-explainer warning"><AlertTriangle size={18} /><div><strong>Saved views and groups</strong><span>{scopeError}</span></div></div>}

      <div className="rmm-device-inventory-metrics">
        <div><span><Monitor size={17} /></span><div><strong>{devices.length}</strong><small>Inventory records</small></div></div>
        <div><span className="warning"><AlertTriangle size={17} /></span><div><strong>{needsAttention}</strong><small>Need attention</small></div></div>
        <div><span className="offline"><Wifi size={17} /></span><div><strong>{offline}</strong><small>Offline</small></div></div>
        <div><span className="warning"><ShieldCheck size={17} /></span><div><strong>{patchRisk}</strong><small>Below 90% patch</small></div></div>
      </div>

      <section className="rmm-saved-views-card">
        <div className="rmm-saved-views-heading"><div><span className="rmm-eyebrow">Saved views</span><strong>Reusable estate views</strong><small>Saved views remember filters, sort order and visible columns.</small></div><button className="rmm-primary compact" onClick={() => setShowSaveModal(true)} type="button"><Plus size={14} /> Save current view</button></div>
        <div className="rmm-saved-view-strip">
          {allViews.map((view) => <div className={`rmm-saved-view-chip ${activeViewId === view.id ? 'active' : ''}`} key={view.id}><button onClick={() => applySavedView(view)} type="button"><span>{view.visibility === 'Private' ? <Lock size={13} /> : <Share2 size={13} />}</span><strong>{view.name}</strong><small>{[view.default ? 'Default' : '', view.favourite ? 'Favourite' : '', view.description].filter(Boolean).join(' · ')}</small></button>{!view.builtIn && <button aria-label={`Delete ${view.name}`} className="delete" onClick={() => deleteView(view.id)} type="button"><Trash2 size={13} /></button>}</div>)}
        </div>
      </section>

      <div className="rmm-list-toolbar rmm-device-toolbar rmm-device-toolbar-v2">
        <div className="rmm-device-toolbar-top">
          <div className="rmm-filter-pills" aria-label="Device quick views">{quickViews.map(([id, label]) => <button className={filters.quickView === id ? 'active' : ''} key={id} onClick={() => setFilter('quickView', id)} type="button">{label}</button>)}</div>
          <button aria-controls="rmm-device-filter-controls" aria-expanded={showMobileFilters} className={'rmm-mobile-filter-toggle ' + (showMobileFilters ? 'active' : '')} onClick={() => setShowMobileFilters((value) => !value)} type="button"><SlidersHorizontal size={15} /> Filters{advancedFilterCount > 0 && <b>{advancedFilterCount}</b>}</button>
        </div>
        <div className={'rmm-device-filter-controls ' + (showMobileFilters ? 'is-open' : '')} id="rmm-device-filter-controls">
          <label>Site<select value={filters.siteId} onChange={(event) => setFilter('siteId', event.target.value)}><option value="All">All</option>{allSites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Source tenant<select value={filters.sourceTenant} onChange={(event) => setFilter('sourceTenant', event.target.value)}><option value="All">All</option>{[...new Set(devices.map((device) => device.sourceTenant).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Group<select value={filters.groupId} onChange={(event) => setFilter('groupId', event.target.value)}><option value="All">All</option>{allGroups.map((item) => <option key={item.id} value={item.id}>{item.name}{item.mode === 'Dynamic' ? ' · dynamic' : ''}</option>)}</select></label>
          <label>Platform<select value={filters.platform} onChange={(event) => setFilter('platform', event.target.value)}><option>All</option>{[...new Set(devices.map((device) => device.platform))].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Health<select value={filters.health} onChange={(event) => setFilter('health', event.target.value)}><option>All</option>{['Healthy', 'Warning', 'Critical', 'Offline'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Patch<select value={filters.patchState} onChange={(event) => setFilter('patchState', event.target.value)}><option>All</option><option>At risk</option><option>Compliant</option></select></label>
          <label>Sort<select value={sort.field + ':' + sort.direction} onChange={(event) => { const [field, direction] = event.target.value.split(':'); setSort({ field, direction }); setActiveViewId('') }}><option value="name:asc">Device A–Z</option><option value="health:desc">Health priority</option><option value="patch:asc">Patch lowest first</option><option value="site:asc">Site A–Z</option></select></label>
          <div className="rmm-column-control"><button className="rmm-toolbar-button" onClick={() => setShowColumns((value) => !value)} type="button"><Columns3 size={14} /> Columns</button>{showColumns && <ColumnChooser columns={visibleColumns} onChange={(value) => { setVisibleColumns(value); setActiveViewId('') }} onClose={() => setShowColumns(false)} />}</div>
          {activeFilters > 0 && <button className="rmm-toolbar-button" onClick={resetView} type="button"><FilterX size={14} /> Reset</button>}
          <span className="rmm-device-result-count">{visible.length} shown</span>
        </div>
      </div>

      <section className="rmm-table-card rmm-inventory-table-card">
        <div className="rmm-table rmm-device-table inventory rmm-device-table-v2">
          <div className="rmm-table-head" style={{ gridTemplateColumns }}>{visibleColumns.map((column) => <span key={column}>{renderColumnHeader(column)}</span>)}<span /></div>
          {visible.map((device) => <button className="rmm-table-row" key={device.id} onClick={() => openDevice(device)} style={{ gridTemplateColumns }} type="button">
            {visibleColumns.includes('device') && <span className="rmm-device-cell"><span className={`rmm-device-icon ${healthClass(device.health)}`}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.manufacturer} {device.model} · {device.os}</small></span></span>}
            {visibleColumns.includes('user') && <span><strong>{device.user}</strong><small>{device.userEmail || device.type}</small></span>}
            {visibleColumns.includes('siteGroup') && <span><strong>{device.site}</strong><small>{device.group}</small></span>}
            {visibleColumns.includes('sourceTenant') && <span><strong>{device.sourceTenant || 'Hi5Central'}</strong><small>{device.sourceDirectoryTenantId || device.agentChannel || 'Native'}</small></span>}
            {visibleColumns.includes('health') && <span><StatusPill>{device.health}</StatusPill><small>{device.alerts} alerts</small></span>}
            {visibleColumns.includes('resources') && <span><strong>CPU {device.cpu == null ? '—' : device.cpu + '%'} · RAM {device.memory == null ? '—' : device.memory + '%'}</strong><small>Disk {device.disk == null ? '—' : device.disk + '%'}</small></span>}
            {visibleColumns.includes('patch') && <span><strong>{device.patchCompliance == null ? 'Not reported' : device.patchCompliance + '%'}</strong><small>{device.pendingPatches == null ? 'Update state unavailable' : device.pendingPatches + ' pending'}</small></span>}
            {visibleColumns.includes('lastSeen') && <span><strong>{device.lastSeen}</strong><small>Agent {device.agent}</small></span>}
            <span><ChevronRight size={16} /></span>
          </button>)}
        </div>
        {!visible.length && <div className="rmm-empty"><AlertTriangle size={24} /><strong>{emptyTitle}</strong><span>{emptyCopy}</span></div>}
      </section>
      <section className="rmm-mobile-device-list" aria-label="Device inventory">
        {visible.map((device) => <button className="rmm-mobile-device-card" key={device.id} onClick={() => openDevice(device)} type="button">
          <span className={'rmm-device-icon ' + healthClass(device.health)}><DeviceIcon device={device} /></span>
          <span className="rmm-mobile-device-copy"><strong>{device.name}</strong><small>{device.user || 'No assigned user'} · {device.site || 'No site'}</small><small>{device.os || device.platform || 'Platform not reported'}</small></span>
          <StatusPill>{device.health || device.status || 'Unknown'}</StatusPill>
          <span className="rmm-mobile-device-facts">
            <span><small>Status</small><strong>{device.status || 'Unknown'}</strong></span>
            <span><small>Patch</small><strong>{device.patchCompliance == null ? '—' : device.patchCompliance + '%'}</strong></span>
            <span><small>Last seen</small><strong>{device.lastSeen || 'Not reported'}</strong></span>
          </span>
          <ChevronRight className="rmm-mobile-device-chevron" size={17} />
        </button>)}
        {!visible.length && <div className="rmm-card rmm-empty rmm-mobile-device-empty"><AlertTriangle size={24} /><strong>{emptyTitle}</strong><span>{emptyCopy}</span></div>}
      </section>

      {showSaveModal && <SavedViewModal filters={filters} onClose={() => setShowSaveModal(false)} onSave={saveCurrentView} sort={sort} visibleColumns={visibleColumns} />}
    </>
  )
}

function SiteModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', code: '', type: 'Office', address1: '', city: '', postcode: '', country: 'United Kingdom', timezone: 'Europe/London', notes: '' })
  const valid = form.name.trim().length >= 2 && form.code.trim().length >= 2
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  return <div className="rmm-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="rmm-modal" role="dialog" aria-modal="true"><header><div><span className="rmm-eyebrow">Organisation</span><h2>New site</h2><p>Create a real organisation site. Devices assigned to people at this site are scoped here automatically.</p></div><button onClick={onClose} type="button"><X size={18} /></button></header><div className="rmm-modal-body rmm-form-grid"><label>Site name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Leeds Office" /></label><label>Site code<input value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase())} placeholder="LDS" /></label><label>Type<select value={form.type} onChange={(event) => update('type', event.target.value)}><option>Office</option><option>Datacentre</option><option>Remote</option><option>Branch</option><option>Cloud</option></select></label><label>Address<input value={form.address1} onChange={(event) => update('address1', event.target.value)} /></label><label>City<input value={form.city} onChange={(event) => update('city', event.target.value)} /></label><label>Postcode<input value={form.postcode} onChange={(event) => update('postcode', event.target.value)} /></label><label>Country<input value={form.country} onChange={(event) => update('country', event.target.value)} /></label><label>Time zone<input value={form.timezone} onChange={(event) => update('timezone', event.target.value)} /></label><label className="wide">Notes<input value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label></div><footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid} onClick={() => valid && onSave(form)} type="button"><Plus size={15} /> Create site</button></footer></section></div>
}

export function RmmSitesManagement({ devices = [], query, sites = [], onSitesChange, onViewDevices }) {
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const normalized = query.trim().toLowerCase()
  const scopedSites = useMemo(() => sites.filter((site) => site.active !== false).map((site) => {
    const scoped = devices.filter((device) => device.siteId === site.id)
    return { ...site, location: [site.address1, site.city, site.postcode, site.country].filter(Boolean).join(', ') || 'No address recorded', devices: scoped.length, online: scoped.filter((device) => device.status === 'Online').length, warning: scoped.filter((device) => device.health === 'Warning').length, critical: scoped.filter((device) => device.health === 'Critical').length, offline: scoped.filter((device) => device.status === 'Offline').length }
  }), [devices, sites])
  const visible = scopedSites.filter((site) => !normalized || [site.name, site.code, site.location, site.type, site.timezone].join(' ').toLowerCase().includes(normalized))
  const totalDevices = scopedSites.reduce((sum, site) => sum + site.devices, 0)
  const totalOnline = scopedSites.reduce((sum, site) => sum + site.online, 0)
  const attention = scopedSites.filter((site) => site.warning || site.critical || site.offline).length
  async function addSite(form) {
    if (!onSitesChange) return
    setSaving(true); setMessage('')
    try {
      await onSitesChange([...sites.filter((site) => site.active !== false), { id: createId('SITE'), ...form, primaryContactId: '', supportTeamId: '', rmmSite: { status: 'not_linked', id: '', label: '' }, active: true, source: { provider: 'hi5central' } }])
      setShowModal(false); setMessage('Site created.')
    } catch (error) { setMessage(error?.message || 'Unable to create site.') } finally { setSaving(false) }
  }
  async function deleteSite(site) {
    if (!onSitesChange || site.devices > 0 || !window.confirm('Remove empty site ' + site.name + '?')) return
    setSaving(true); setMessage('')
    try { await onSitesChange(sites.filter((item) => item.id !== site.id && item.active !== false)); setMessage('Site removed.') }
    catch (error) { setMessage(error?.message || 'Unable to remove site.') } finally { setSaving(false) }
  }
  return <>
    <PageHeading eyebrow="Estate structure" title="Sites" description="Real organisation sites populated from your people directory and used automatically for RMM device scope." action={<button className="rmm-primary compact" disabled={saving || !onSitesChange} onClick={() => setShowModal(true)} type="button"><Plus size={15} /> New site</button>} />
    {message && <div className="rmm-scope-explainer"><Building2 size={18} /><div><strong>Site update</strong><span>{message}</span></div></div>}
    <div className="rmm-scope-metrics"><div><span><Building2 size={17} /></span><div><strong>{scopedSites.length}</strong><small>Organisation sites</small></div></div><div><span><Monitor size={17} /></span><div><strong>{totalDevices}</strong><small>Scoped devices</small></div></div><div><span><Wifi size={17} /></span><div><strong>{totalDevices ? Math.round(totalOnline / totalDevices * 100) : 0}%</strong><small>Reported online</small></div></div><div><span className="warning"><AlertTriangle size={17} /></span><div><strong>{attention}</strong><small>Sites need attention</small></div></div></div>
    <div className="rmm-scope-explainer"><SlidersHorizontal size={18} /><div><strong>Site assignment follows your organisation data</strong><span>When a managed device is associated with a staff user, the user&apos;s organisation site becomes the device site automatically. No separate placeholder RMM site list is used.</span></div></div>
    <div className="rmm-site-grid">{visible.map((site) => <article className="rmm-card rmm-site-card" key={site.id}><header><span className={'rmm-site-icon ' + (site.type === 'Datacentre' ? 'datacentre' : site.type === 'Remote' ? 'remote' : '')}>{site.type === 'Datacentre' ? <Server size={20} /> : site.type === 'Remote' ? <Wifi size={20} /> : <Building2 size={20} />}</span><div><span className="rmm-eyebrow">{site.code || 'SITE'} · {site.type || 'Office'}</span><h2>{site.name}</h2><p><MapPin size={13} /> {site.location}</p></div><StatusPill tone={site.warning || site.critical || site.offline ? 'warning' : 'healthy'}>{site.warning || site.critical || site.offline ? 'Attention' : 'Healthy'}</StatusPill></header><div className="rmm-site-stats"><span><strong>{site.devices}</strong><small>Devices</small></span><span><strong>{site.online}</strong><small>Online</small></span><span><strong>{site.warning + site.critical}</strong><small>Health issues</small></span><span><strong>{site.offline}</strong><small>Offline</small></span></div><div className="rmm-scope-properties"><span><small>Time zone</small><strong>{site.timezone || 'Not recorded'}</strong></span><span><small>RMM link</small><strong>{site.rmmSite?.status === 'linked' ? 'Linked' : 'Automatic organisation scope'}</strong></span><span><small>Support team</small><strong>{site.supportTeamId || 'Not assigned'}</strong></span><span><small>Primary contact</small><strong>{site.primaryContactId || 'Not assigned'}</strong></span></div><footer><button onClick={() => onViewDevices?.({ siteId: site.id })} type="button">View devices <ChevronRight size={14} /></button>{site.devices === 0 && onSitesChange && <button className="danger-text" disabled={saving} onClick={() => deleteSite(site)} type="button"><Trash2 size={14} /> Remove empty site</button>}</footer></article>)}</div>
    {!visible.length && <div className="rmm-empty"><Building2 size={24} /><strong>{sites.length ? 'No sites match your search' : 'No organisation sites configured'}</strong><span>{sites.length ? 'Try another site name, code or location.' : 'Create a site here or assign one from People. Devices will inherit the user site automatically.'}</span></div>}
    {showModal && <SiteModal onClose={() => setShowModal(false)} onSave={addSite} />}
  </>
}

function GroupModal({ devices = [], onClose, onSave, sites = [] }) {
  const [form, setForm] = useState({
    name: '', mode: 'Static', siteId: '', platformContains: '', osContains: '',
    manufacturerContains: '', modelContains: '', userContains: '', tagContains: '',
    onlineState: 'Any', softwareNameContains: '', softwareVersionContains: '',
    encryptionState: 'Any', updateState: 'Any', patchRing: 'Inherited',
    softwareProfile: 'Inherited', automationProfile: 'Inherited', deviceIds: [],
  })
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  const scopedDevices = useMemo(() => devices.filter((device) => !form.siteId || device.siteId === form.siteId), [devices, form.siteId])
  const valid = form.name.trim().length >= 2

  function toggleDevice(deviceId) {
    setForm((current) => ({ ...current, deviceIds: current.deviceIds.includes(deviceId) ? current.deviceIds.filter((id) => id !== deviceId) : [...current.deviceIds, deviceId] }))
  }

  function submit() {
    if (!valid) return
    const site = sites.find((item) => item.id === form.siteId)
    onSave({
      name: form.name.trim(),
      mode: form.mode,
      siteId: form.siteId,
      description: form.mode === 'Dynamic' ? 'Server-resolved dynamic device group.' : 'Static device membership group.',
      rules: form.mode === 'Dynamic' ? {
        siteId: form.siteId, siteName: site?.name || '', platformContains: form.platformContains.trim(),
        osContains: form.osContains.trim(), manufacturerContains: form.manufacturerContains.trim(),
        modelContains: form.modelContains.trim(), userContains: form.userContains.trim(),
        tagContains: form.tagContains.trim(), onlineState: form.onlineState,
        softwareNameContains: form.softwareNameContains.trim(), softwareVersionContains: form.softwareVersionContains.trim(),
        encryptionState: form.encryptionState, updateState: form.updateState,
      } : {},
      deviceIds: form.mode === 'Static' ? form.deviceIds : [],
      patchRing: form.patchRing, softwareProfile: form.softwareProfile, automationProfile: form.automationProfile,
    })
  }

  return <div className="rmm-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="rmm-modal rmm-group-modal" role="dialog" aria-modal="true">
      <header><div><span className="rmm-eyebrow">RMM scope</span><h2>New device group</h2><p>Create membership once, then reuse it across Monitoring, Automation, Patching and Software.</p></div><button onClick={onClose} type="button"><X size={18} /></button></header>
      <div className="rmm-modal-body rmm-form-grid">
        <label>Group name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Windows kiosks" /></label>
        <label>Membership<select value={form.mode} onChange={(event) => update('mode', event.target.value)}><option>Static</option><option>Dynamic</option></select></label>
        <label>Site scope<select value={form.siteId} onChange={(event) => update('siteId', event.target.value)}><option value="">All sites</option>{sites.filter((site) => site.active !== false).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
        {form.mode === 'Static' ? <div className="wide rmm-group-device-picker">
          <div className="rmm-group-device-picker-heading"><strong>Static members</strong><span>{form.deviceIds.length} selected · {scopedDevices.length} available</span></div>
          <div className="rmm-group-device-picker-list">{scopedDevices.map((device) => <label key={device.id}><input checked={form.deviceIds.includes(device.id)} onChange={() => toggleDevice(device.id)} type="checkbox" /><span><strong>{device.name}</strong><small>{device.user || 'Unassigned'} · {device.site || 'No site'} · {device.status}</small></span></label>)}</div>
        </div> : <>
          <div className="wide rmm-group-rule-note"><SlidersHorizontal size={16} /><span><strong>All populated criteria use AND.</strong> Membership is recalculated server-side from current inventory and live Agent state.</span></div>
          <label>Platform contains<input value={form.platformContains} onChange={(event) => update('platformContains', event.target.value)} placeholder="Windows" /></label>
          <label>OS contains<input value={form.osContains} onChange={(event) => update('osContains', event.target.value)} placeholder="Windows 11" /></label>
          <label>Manufacturer contains<input value={form.manufacturerContains} onChange={(event) => update('manufacturerContains', event.target.value)} placeholder="Dell" /></label>
          <label>Model contains<input value={form.modelContains} onChange={(event) => update('modelContains', event.target.value)} placeholder="Latitude" /></label>
          <label>User contains<input value={form.userContains} onChange={(event) => update('userContains', event.target.value)} placeholder="Finance" /></label>
          <label>Tag contains<input value={form.tagContains} onChange={(event) => update('tagContains', event.target.value)} placeholder="Kiosk" /></label>
          <label>Online state<select value={form.onlineState} onChange={(event) => update('onlineState', event.target.value)}><option>Any</option><option>Online</option><option>Offline</option></select></label>
          <label>Encryption<select value={form.encryptionState} onChange={(event) => update('encryptionState', event.target.value)}><option>Any</option><option>Protected</option><option>Unprotected</option></select></label>
          <label>Update state<select value={form.updateState} onChange={(event) => update('updateState', event.target.value)}><option>Any</option><option value="Pending">Pending updates</option><option value="Clear">No pending updates</option></select></label>
          <label>Software contains<input value={form.softwareNameContains} onChange={(event) => update('softwareNameContains', event.target.value)} placeholder="Microsoft 365" /></label>
          <label>Software version contains<input value={form.softwareVersionContains} onChange={(event) => update('softwareVersionContains', event.target.value)} placeholder="16." /></label>
        </>}
        <label>Patch ring<input value={form.patchRing} onChange={(event) => update('patchRing', event.target.value)} /></label>
        <label>Software profile<input value={form.softwareProfile} onChange={(event) => update('softwareProfile', event.target.value)} /></label>
        <label>Automation profile<input value={form.automationProfile} onChange={(event) => update('automationProfile', event.target.value)} /></label>
      </div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid} onClick={submit} type="button"><Plus size={15} /> Create group</button></footer>
    </section>
  </div>
}

export function RmmDeviceGroupsManagement({ devices = [], query, onViewDevices, sites = [] }) {
  const [groups, setGroups] = useState([])
  const [monitoringPolicies, setMonitoringPolicies] = useState([])
  const [monitoringAssignments, setMonitoringAssignments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scopeError, setScopeError] = useState('')
  const normalized = query.trim().toLowerCase()

  useEffect(() => {
    let active = true
    loadRmmScope().then((payload) => {
      if (!active) return
      setGroups(payload.groups || [])
      setMonitoringPolicies(payload.monitoring?.policies || [])
      setMonitoringAssignments(payload.monitoring?.assignments || [])
      setScopeError('')
    }).catch((error) => {
      if (active) setScopeError(error?.message || 'Unable to load device groups.')
    })
    return () => { active = false }
  }, [])

  function monitoringLabel(group) {
    const assignment = monitoringAssignments
      .filter((item) => item.enabled !== false && item.scopeType === 'Group' && item.scopeId === group.id)
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0]
    return monitoringPolicies.find((policy) => policy.id === assignment?.policyId)?.name || 'Inherited'
  }

  const visible = groups.filter((group) => !normalized || [
    group.name, group.type, group.mode, group.scope, group.ruleText, monitoringLabel(group), group.patchRing,
  ].join(' ').toLowerCase().includes(normalized))
  const dynamicCount = groups.filter((group) => group.mode === 'Dynamic').length
  const staticCount = groups.filter((group) => group.mode !== 'Dynamic').length
  const resolvedMemberships = groups.reduce((sum, group) => sum + Number(group.devices || 0), 0)

  async function addGroup(form) {
    setSaving(true)
    setScopeError('')
    try {
      const result = await createRmmGroup(form)
      setGroups(result.bundle?.groups || [])
      setMonitoringPolicies(result.bundle?.monitoring?.policies || [])
      setMonitoringAssignments(result.bundle?.monitoring?.assignments || [])
      setShowModal(false)
    } catch (error) {
      setScopeError(error?.message || 'Unable to create device group.')
    } finally {
      setSaving(false)
    }
  }

  async function removeGroup(group) {
    if (!window.confirm('Delete device group ' + group.name + '? Monitoring assignments targeting it will also be removed.')) return
    setSaving(true)
    setScopeError('')
    try {
      const result = await deleteRmmGroup(group.id)
      setGroups(result.bundle?.groups || [])
      setMonitoringPolicies(result.bundle?.monitoring?.policies || [])
      setMonitoringAssignments(result.bundle?.monitoring?.assignments || [])
    } catch (error) {
      setScopeError(error?.message || 'Unable to delete device group.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageHeading eyebrow="Estate structure" title="Device groups" description="Build static and dynamic server-resolved scopes for policies, patching, software and automation." action={<button className="rmm-primary compact" disabled={saving} onClick={() => setShowModal(true)} type="button"><Plus size={15} /> New group</button>} />
    {scopeError && <div className="rmm-scope-explainer warning"><AlertTriangle size={18} /><div><strong>Device group configuration</strong><span>{scopeError}</span></div></div>}
    <div className="rmm-scope-metrics"><div><span><Users size={17} /></span><div><strong>{groups.length}</strong><small>Total groups</small></div></div><div><span><Users size={17} /></span><div><strong>{staticCount}</strong><small>Static groups</small></div></div><div><span><SlidersHorizontal size={17} /></span><div><strong>{dynamicCount}</strong><small>Dynamic groups</small></div></div><div><span><Monitor size={17} /></span><div><strong>{resolvedMemberships}</strong><small>Resolved memberships</small></div></div></div>
    <div className="rmm-scope-explainer"><Users size={18} /><div><strong>One reusable scope model</strong><span>Membership is stored or calculated server-side. Monitoring Policies, Automation, Patching and Software can all target the same group IDs.</span></div></div>
    <div className="rmm-group-list">{visible.map((group) => {
      const siteName = sites.find((site) => site.id === group.siteId)?.name || group.scope || 'All sites'
      return <article className="rmm-card rmm-group-card" key={group.id}><span className={'rmm-group-icon ' + (group.mode === 'Dynamic' ? 'dynamic' : '')}>{group.mode === 'Dynamic' ? <SlidersHorizontal size={18} /> : <Users size={18} />}</span><div className="rmm-group-main"><div><span className="rmm-eyebrow">{group.id} · {siteName}</span><h2>{group.name}</h2><p>{group.description}</p></div><div className="rmm-group-rule"><span>{group.mode === 'Dynamic' ? 'Server-resolved dynamic membership' : 'Static membership'}</span><strong>{group.ruleText}</strong></div></div><div className="rmm-group-targeting"><span><small>Devices</small><strong>{group.devices}</strong></span><span><small>Monitoring</small><strong>{monitoringLabel(group)}</strong></span><span><small>Patch ring</small><strong>{group.patchRing}</strong></span><span><small>Software</small><strong>{group.softwareProfile}</strong></span><span><small>Automation</small><strong>{group.automationProfile}</strong></span></div><div className="rmm-group-actions"><StatusPill tone={group.mode === 'Dynamic' ? 'running' : 'neutral'}>{group.mode}</StatusPill><button onClick={() => onViewDevices?.({ groupId: group.id })} type="button">View devices <ChevronRight size={14} /></button><button aria-label={'Delete ' + group.name} className="danger-text icon-only" disabled={saving} onClick={() => removeGroup(group)} type="button"><Trash2 size={14} /></button></div></article>
    })}</div>
    {!visible.length && <div className="rmm-empty"><Users size={24} /><strong>No tenant device groups yet</strong><span>Create a static membership list or a dynamic group evaluated from current device data.</span></div>}
    {showModal && <GroupModal devices={devices} sites={sites} onClose={() => setShowModal(false)} onSave={addGroup} />}
  </>
}
