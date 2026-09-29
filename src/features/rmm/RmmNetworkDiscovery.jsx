import { useEffect, useMemo, useState } from 'react'
import {
  Camera,
  ChevronDown,
  ChevronUp,
  CircleDot,
  KeyRound,
  Monitor,
  Network,
  Play,
  Radar,
  RefreshCw,
  Router,
  Server,
  ShieldCheck,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  Wifi,
} from 'lucide-react'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import './RmmNetworkDiscovery.css'

const API_BASE = window.__HI5_API_BASE__ || deploymentConfig().apiUrl

async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: options.body
      ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
      : (options.headers || {}),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Network discovery request failed.')
  return payload
}

function when(value) {
  if (!value) return 'Never'
  try { return new Date(value).toLocaleString() } catch { return String(value) }
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={'rmm-network-pill ' + tone}>{children}</span>
}

function formatSpeed(value) {
  const speed = Number(value)
  if (!Number.isFinite(speed) || speed <= 0) return 'Unknown'
  const units = [['Tbps', 1e12], ['Gbps', 1e9], ['Mbps', 1e6], ['Kbps', 1e3]]
  for (const [label, size] of units) {
    if (speed >= size) {
      const result = speed / size
      return (result >= 10 || Number.isInteger(result) ? result.toFixed(0) : result.toFixed(1)) + ' ' + label
    }
  }
  return speed + ' bps'
}

function formatUptimeTicks(value) {
  const ticks = Number(value)
  if (!Number.isFinite(ticks) || ticks < 0) return 'Unknown'
  let seconds = Math.floor(ticks / 100)
  const days = Math.floor(seconds / 86400)
  seconds %= 86400
  const hours = Math.floor(seconds / 3600)
  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  if (days) return days + 'd ' + hours + 'h ' + minutes + 'm'
  if (hours) return hours + 'h ' + minutes + 'm'
  return minutes + 'm'
}

function deviceIcon(type = '') {
  const normalized = String(type).toLowerCase()
  if (normalized === 'switch' || normalized === 'router') return Router
  if (normalized === 'access_point') return Wifi
  if (normalized === 'firewall') return ShieldCheck
  if (normalized === 'server' || normalized === 'storage') return Server
  if (normalized === 'computer') return Monitor
  if (normalized === 'mobile_device') return Smartphone
  if (normalized === 'media_device') return Tv
  if (normalized === 'camera') return Camera
  return Network
}

function niceLabel(value = '') {
  return String(value || '').replaceAll('_', ' ').split(' ').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function isPrivateMac(value = '') {
  const first = Number.parseInt(String(value).split(':')[0], 16)
  return Number.isFinite(first) && Boolean(first & 0x02)
}

function capabilityLabel(value = '') {
  const normalized = String(value).toLowerCase()
  const known = {
    airplay: 'AirPlay',
    airplay_audio: 'AirPlay Audio',
    amazon_echo: 'Amazon Echo',
    amazon_echo_remote: 'Echo Remote',
    amazon_fire_tv: 'Amazon Fire TV',
    amazon_wplay: 'Amazon WPlay',
    companion_link: 'Apple Continuity',
    eero: 'eero',
    gateway: 'Gateway',
    google_cast: 'Google Cast',
    homekit: 'HomeKit',
    matter: 'Matter',
    printing: 'Printing',
    smb: 'SMB',
    spotify_connect: 'Spotify Connect',
    spotify_zeroconf: 'Spotify identity',
    ssh: 'SSH',
    web_service: 'Web service',
    workstation: 'Workstation',
  }
  return known[normalized] || niceLabel(normalized)
}

function devicePresentation(item = {}) {
  const vendor = String(item.vendor || '').toLowerCase()
  const model = String(item.model || '').toLowerCase()
  const hostname = String(item.hostname || item.sys_name || '').toLowerCase()
  const type = String(item.device_type || 'network_device').toLowerCase()
  const capabilities = new Set(
    Array.isArray(item.metadata?.mdns?.capabilities)
      ? item.metadata.mdns.capabilities.map((value) => String(value).toLowerCase())
      : [],
  )

  if (model === 'echo_dot' || capabilities.has('amazon_echo')) {
    return { label: 'Amazon Echo Dot', Icon: Speaker }
  }
  if (capabilities.has('amazon_fire_tv')
      || model.startsWith('aft')
      || hostname.includes('firetv')
      || hostname.includes('fire tv')) {
    return { label: 'Amazon Fire TV', Icon: Tv }
  }
  if (vendor.includes('apple') && hostname.includes('ipad')) {
    return { label: 'Apple iPad', Icon: Tablet }
  }
  if (vendor.includes('apple') && type === 'mobile_device') {
    return { label: 'Apple mobile device', Icon: Smartphone }
  }
  if (vendor.includes('ring') || type === 'camera') {
    return { label: vendor.includes('ring') ? 'Ring Camera' : 'Network Camera', Icon: Camera }
  }
  if (vendor.includes('eero') || capabilities.has('eero')) {
    return { label: 'eero Router', Icon: Router }
  }
  if (type === 'computer') return { label: 'Computer', Icon: Monitor }
  if (type === 'router') return { label: 'Router', Icon: Router }
  if (type === 'media_device') return { label: 'Media device', Icon: Tv }
  if (type === 'mobile_device') return { label: 'Mobile device', Icon: Smartphone }
  return { label: niceLabel(type || 'network_device'), Icon: deviceIcon(type) }
}

function managementPresentation(item = {}) {
  if (item.managed) {
    return {
      label: 'Agent installed',
      tone: 'healthy',
      detail: item.managed_agent_version
        ? 'Agent ' + item.managed_agent_version
        : (item.managed_reference || 'Managed endpoint'),
    }
  }

  const type = String(item.device_type || 'network_device').toLowerCase()
  if (type === 'computer') {
    return {
      label: 'Endpoint candidate',
      tone: 'warning',
      detail: 'Assess OS, then deploy Hi5Central Agent',
    }
  }
  if (type === 'mobile_device') {
    return {
      label: 'Mobile device',
      tone: 'neutral',
      detail: 'Observed only · endpoint Agent not applicable',
    }
  }
  if (['router', 'switch', 'access_point', 'firewall', 'server', 'storage'].includes(type)) {
    return {
      label: 'Network managed',
      tone: 'neutral',
      detail: 'Manage through discovery / network credentials',
    }
  }
  if (['media_device', 'camera', 'printer', 'smart_home'].includes(type)) {
    return {
      label: 'Network only',
      tone: 'neutral',
      detail: 'No endpoint Agent expected',
    }
  }
  return {
    label: 'Needs assessment',
    tone: 'warning',
    detail: 'Identify device class before Agent deployment',
  }
}

export function RmmNetworkDiscovery() {
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expandedDeviceId, setExpandedDeviceId] = useState('')
  const [credential, setCredential] = useState({ name: '', snmpVersion: 'v2c', community: '', username: '', securityLevel: 'authPriv', authProtocol: 'sha256', authSecret: '', privacyProtocol: 'aes128', privacySecret: '', contextName: '' })
  const [profile, setProfile] = useState({
    name: '',
    cidr: '',
    probeAgentDeviceId: '',
    credentialId: '',
    siteId: '',
    scanIntervalMinutes: 60,
    presenceEnabled: true,
    presenceTimeoutMs: 350,
    snmpEnabled: true,
    timeoutMs: 800,
    retries: 1,
    concurrency: 32,
  })

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    try {
      const payload = await request('/api/v1/rmm/network-discovery')
      setBundle(payload)
      setError('')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const active = (bundle?.runs || []).some((run) => ['queued', 'running'].includes(run.status))
    if (!active) return undefined
    const timer = window.setInterval(() => load({ quiet: true }), 4000)
    return () => window.clearInterval(timer)
  }, [bundle?.runs])

  const probes = bundle?.probes || []
  const credentials = bundle?.credentials || []
  const profiles = bundle?.profiles || []
  const devices = bundle?.devices || []
  const runs = bundle?.runs || []
  const sites = bundle?.sites || []

  const probeById = useMemo(
    () => new Map(probes.map((item) => [item.agent_device_id, item])),
    [probes],
  )
  const selectedProbe = probeById.get(profile.probeAgentDeviceId)
  const selectedCredential = credentials.find((item) => item.id === profile.credentialId)
  const selectedCredentialNeedsV3 = selectedCredential?.snmpVersion === 'v3'
  const selectedProbeSupportsCredential = !selectedCredentialNeedsV3 || Boolean(selectedProbe?.snmp_v3_capable)
  const suggestedRanges = Array.isArray(selectedProbe?.suggested_cidrs)
    ? selectedProbe.suggested_cidrs
    : []

  async function createCredential(event) {
    event.preventDefault()
    setBusy('credential')
    setError('')
    setNotice('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/credentials', {
        method: 'POST',
        body: JSON.stringify(credential),
      })
      setBundle(payload.bundle)
      setCredential({ name: '', snmpVersion: 'v2c', community: '', username: '', securityLevel: 'authPriv', authProtocol: 'sha256', authSecret: '', privacyProtocol: 'aes128', privacySecret: '', contextName: '' })
      setNotice('SNMP credential saved securely.')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  async function createProfile(event) {
    event.preventDefault()
    setBusy('profile')
    setError('')
    setNotice('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/profiles', {
        method: 'POST',
        body: JSON.stringify({
          ...profile,
          scanIntervalMinutes: Number(profile.scanIntervalMinutes),
          presenceEnabled: true,
          presenceTimeoutMs: Number(profile.presenceTimeoutMs),
          snmpEnabled: Boolean(profile.credentialId),
          timeoutMs: Number(profile.timeoutMs),
          retries: Number(profile.retries),
          concurrency: Number(profile.concurrency),
        }),
      })
      setBundle(payload.bundle)
      setProfile({
        name: '',
        cidr: '',
        probeAgentDeviceId: '',
        credentialId: '',
        siteId: '',
        scanIntervalMinutes: 60,
        presenceEnabled: true,
        presenceTimeoutMs: 350,
        snmpEnabled: true,
        timeoutMs: 800,
        retries: 1,
        concurrency: 32,
      })
      setNotice('Discovery profile created.')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  async function runScan(profileId) {
    setBusy('scan:' + profileId)
    setError('')
    setNotice('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/profiles/' + encodeURIComponent(profileId) + '/scan', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setBundle(payload.bundle)
      setNotice('Network discovery scan started on the selected probe.')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  async function toggleProfile(item) {
    const key = 'profile:' + item.id
    setBusy(key)
    setError('')
    try {
      const payload = await request('/api/v1/rmm/network-discovery/profiles/' + encodeURIComponent(item.id), {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !item.enabled }),
      })
      setBundle(payload.bundle)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy('')
    }
  }

  const summary = bundle?.summary || {}
  const capabilities = bundle?.capabilities || {}

  return <div className="rmm-network-discovery">
    <div className="rmm-page-heading">
      <div>
        <span className="rmm-eyebrow">Network management</span>
        <h1>Network discovery</h1>
        <p>Use a managed Agent as an on-site probe to discover devices quickly by ARP and ICMP, then enrich identity separately with MAC vendor data, reverse DNS, SSDP, dynamic DNS-SD/mDNS and optional SNMP.</p>
      </div>
      <button className="rmm-primary compact" disabled={loading} onClick={() => load()} type="button">
        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
      </button>
    </div>

    {error && <div className="rmm-network-message error">{error}</div>}
    {notice && <div className="rmm-network-message success">{notice}</div>}

    <div className="rmm-network-metrics">
      <article className="rmm-card"><Radar size={19} /><span>Discovery profiles</span><strong>{summary.profiles ?? 0}</strong><small>Enabled network ranges</small></article>
      <article className="rmm-card"><Network size={19} /><span>Discovered devices</span><strong>{summary.devices ?? 0}</strong><small>{summary.onlineDevices ?? 0} online · {summary.offlineDevices ?? 0} offline</small></article>
      <article className="rmm-card"><Server size={19} /><span>Discovery-capable probes</span><strong>{summary.presenceCapableProbes ?? 0}</strong><small>{summary.onlineProbes ?? 0} online · presence requires Agent {capabilities.minPresenceAgentVersion || '0.1.233'}+</small></article>
      <article className="rmm-card"><ShieldCheck size={19} /><span>Coverage</span><strong>{summary.managedDevices ?? 0} managed</strong><small>{summary.unmanagedDevices ?? 0} discovered without an Agent</small></article>
    </div>

    <div className="rmm-network-config-grid">
      <section className="rmm-card rmm-network-config-card">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Optional enrichment</span><h2>SNMP credentials</h2><p>Presence discovery does not require SNMP. Add credentials for richer identity, uptime and interface data. SNMPv3 USM requires Agent {capabilities.minSnmpV3AgentVersion || '0.1.245'}+.</p></div>
          <KeyRound size={19} />
        </div>
        <form className="rmm-network-form" onSubmit={createCredential}>
          <label><span>Name</span><input value={credential.name} onChange={(e) => setCredential({ ...credential, name: e.target.value })} placeholder="e.g. Site A network" required /></label>
          <label><span>Version</span><select value={credential.snmpVersion} onChange={(e) => setCredential({ ...credential, snmpVersion: e.target.value })}><option value="v3">SNMP v3</option><option value="v2c">SNMP v2c</option><option value="v1">SNMP v1</option></select>{credential.snmpVersion === 'v3' && <small>Requires probe Agent {capabilities.minSnmpV3AgentVersion || '0.1.245'}+ · SHA-256 + AES-128 recommended</small>}</label>
          {credential.snmpVersion === 'v3' ? <>
            <label><span>Username</span><input value={credential.username} onChange={(e) => setCredential({ ...credential, username: e.target.value })} required /></label>
            <label><span>Security level</span><select value={credential.securityLevel} onChange={(e) => setCredential({ ...credential, securityLevel: e.target.value })}><option value="authPriv">Authentication + privacy</option><option value="authNoPriv">Authentication only</option><option value="noAuthNoPriv">No authentication / no privacy</option></select></label>
            {credential.securityLevel !== 'noAuthNoPriv' && <><label><span>Authentication</span><select value={credential.authProtocol} onChange={(e) => setCredential({ ...credential, authProtocol: e.target.value })}><option value="sha256">SHA-256</option><option value="sha1">SHA-1 (legacy)</option></select></label><label><span>Authentication secret</span><input type="password" value={credential.authSecret} onChange={(e) => setCredential({ ...credential, authSecret: e.target.value })} autoComplete="new-password" required /></label></>}
            {credential.securityLevel === 'authPriv' && <><label><span>Privacy</span><select value={credential.privacyProtocol} onChange={(e) => setCredential({ ...credential, privacyProtocol: e.target.value })}><option value="aes128">AES-128</option></select></label><label><span>Privacy secret</span><input type="password" value={credential.privacySecret} onChange={(e) => setCredential({ ...credential, privacySecret: e.target.value })} autoComplete="new-password" required /></label></>}
            <label className="wide"><span>Context name (optional)</span><input value={credential.contextName} onChange={(e) => setCredential({ ...credential, contextName: e.target.value })} placeholder="Default SNMP context" /></label>
          </> : <label className="wide"><span>Community string</span><input type="password" value={credential.community} onChange={(e) => setCredential({ ...credential, community: e.target.value })} autoComplete="new-password" placeholder="Stored encrypted — never displayed again" required /></label>}
          <button className="rmm-primary" disabled={busy === 'credential'} type="submit">{busy === 'credential' ? 'Saving…' : 'Save credential'}</button>
        </form>
        <div className="rmm-network-credential-list">
          {credentials.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.snmpVersion.toUpperCase()}{item.snmpVersion === 'v3' ? ' · ' + item.securityLevel + (item.authProtocol ? ' · ' + item.authProtocol.toUpperCase() : '') + (item.privacyProtocol ? ' · ' + item.privacyProtocol.toUpperCase() : '') : ''} · secret {item.secretConfigured ? 'configured' : 'missing'}</small></span><StatusPill tone={item.enabled ? 'healthy' : 'neutral'}>{item.enabled ? 'Enabled' : 'Disabled'}</StatusPill></div>)}
          {!credentials.length && <div className="rmm-network-mini-empty">No SNMP credentials configured. Presence discovery will still work.</div>}
        </div>
      </section>

      <section className="rmm-card rmm-network-config-card">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Ranges & probes</span><h2>Create discovery profile</h2><p>Choose an Agent and private IPv4 range. Hi5Central discovers devices quickly by ARP and ICMP; names and richer identity are enriched separately.</p></div>
          <Radar size={19} />
        </div>
        <form className="rmm-network-form" onSubmit={createProfile}>
          <label><span>Profile name</span><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="e.g. Head Office LAN" required /></label>
          <label><span>IPv4 CIDR</span><input value={profile.cidr} onChange={(e) => setProfile({ ...profile, cidr: e.target.value })} placeholder="192.168.1.0/24" required /><small>{suggestedRanges.length > 0 ? 'Fast/local suggestion first: ' + suggestedRanges.join(', ') : 'Private RFC1918 ranges only · /20 to /32'}</small></label>
          <label><span>Probe endpoint</span><select value={profile.probeAgentDeviceId} onChange={(e) => {
            const probeId = e.target.value
            const probe = probeById.get(probeId)
            const suggested = Array.isArray(probe?.suggested_cidrs) ? probe.suggested_cidrs[0] : ''
            setProfile((current) => ({
              ...current,
              probeAgentDeviceId: probeId,
              cidr: current.cidr || suggested || '',
            }))
          }} required><option value="">Select probe…</option>{probes.map((item) => <option value={item.agent_device_id} key={item.agent_device_id}>{item.name || item.reference} {item.online ? (item.presence_capable ? '· Discovery ready' : item.snmp_capable ? '· SNMP only · upgrade for presence' : '· Upgrade Agent') : '· Offline'}</option>)}</select></label>
          <label><span>SNMP credential (optional)</span><select value={profile.credentialId} onChange={(e) => setProfile({ ...profile, credentialId: e.target.value })}><option value="">None · presence discovery only</option>{credentials.filter((item) => item.enabled).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.snmpVersion.toUpperCase()}</option>)}</select><small>{selectedCredentialNeedsV3 && !selectedProbeSupportsCredential ? 'SNMPv3 requires probe Agent ' + (capabilities.minSnmpV3AgentVersion || '0.1.245') + '+.' : 'Attach a credential only to enrich devices that expose SNMP.'}</small></label>
          <label><span>Site</span><select value={profile.siteId} onChange={(e) => setProfile({ ...profile, siteId: e.target.value })}><option value="">No site assignment</option>{sites.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Poll interval</span><select value={profile.scanIntervalMinutes} onChange={(e) => setProfile({ ...profile, scanIntervalMinutes: e.target.value })}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="240">4 hours</option><option value="1440">Daily</option></select></label>
          <details className="wide rmm-network-advanced"><summary>Advanced scan settings</summary><div>
            <label><span>Presence timeout (ms)</span><input type="number" min="50" max="5000" value={profile.presenceTimeoutMs} onChange={(e) => setProfile({ ...profile, presenceTimeoutMs: e.target.value })} /></label>
            <label><span>SNMP timeout (ms)</span><input type="number" min="100" max="10000" value={profile.timeoutMs} onChange={(e) => setProfile({ ...profile, timeoutMs: e.target.value })} /></label>
            <label><span>Retries</span><input type="number" min="0" max="5" value={profile.retries} onChange={(e) => setProfile({ ...profile, retries: e.target.value })} /></label>
            <label><span>Concurrency</span><input type="number" min="1" max="128" value={profile.concurrency} onChange={(e) => setProfile({ ...profile, concurrency: e.target.value })} /></label>
          </div></details>
          <button className="rmm-primary" disabled={busy === 'profile' || !probes.length || !selectedProbeSupportsCredential} type="submit">{busy === 'profile' ? 'Creating…' : 'Create profile'}</button>
        </form>
      </section>
    </div>

    <section className="rmm-table-card rmm-network-profile-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Discovery scopes</span><h2>Network ranges</h2><p>Each range is scanned from its assigned on-site Agent probe.</p></div></div>
      <div className="rmm-network-table profiles">
        <div className="head"><span>Profile</span><span>Range</span><span>Probe</span><span>Enrichment</span><span>Last scan</span><span>Status</span><span /></div>
        {profiles.map((item) => {
          const probe = probeById.get(item.probe_agent_device_id)
          const scanning = runs.some((run) => run.profile_id === item.id && ['queued', 'running'].includes(run.status))
          const presenceRequired = item.presence_enabled !== false
          const probeReady = Boolean(probe?.online && (presenceRequired ? probe?.presence_capable : probe?.snmp_capable))
          return <div className="row" key={item.id}>
            <span><strong>{item.name}</strong><small>{item.site_name || 'No site assigned'} · every {item.scan_interval_minutes} min</small></span>
            <span><strong>{item.cidr}</strong><small>{presenceRequired ? 'ARP + ICMP · names enrich separately' : 'SNMP only'} · {item.concurrency} workers</small></span>
            <span><strong>{item.probe_name || item.probe_reference}</strong><small>{probe?.agent_version || 'Agent'} · {probe?.online ? 'Online' : 'Offline'}</small></span>
            <span><strong>{item.credential_name || 'No SNMP credential'}</strong><small>{item.credential_name ? String(item.snmp_version || '').toUpperCase() + ' enrichment' : 'Presence discovery only'}</small></span>
            <span><strong>{when(item.last_scan_at)}</strong><small>Next: {item.enabled ? when(item.next_scan_at) : 'Disabled'}</small></span>
            <span><StatusPill tone={item.enabled ? (probeReady ? 'healthy' : 'warning') : 'neutral'}>{item.enabled ? (!probe?.online ? 'Probe offline' : probeReady ? 'Ready' : 'Upgrade Agent') : 'Disabled'}</StatusPill></span>
            <span className="actions"><button disabled={!item.enabled || !probeReady || scanning || busy === 'scan:' + item.id} onClick={() => runScan(item.id)} type="button"><Play size={13} /> {scanning ? 'Scanning…' : 'Scan now'}</button><button disabled={busy === 'profile:' + item.id} onClick={() => toggleProfile(item)} type="button">{item.enabled ? 'Disable' : 'Enable'}</button></span>
          </div>
        })}
      </div>
      {!profiles.length && <div className="rmm-empty compact"><Radar size={22} /><strong>No discovery ranges yet</strong><span>Create a profile above to start finding devices. SNMP credentials are optional.</span></div>}
    </section>

    <section className="rmm-table-card rmm-network-devices-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Network inventory</span><h2>Discovered network devices</h2><p>Presence discovery identifies devices by IP and MAC. DNS-SD/mDNS adds friendly names, models, device families and capabilities; private/randomized MACs are flagged rather than guessed. SNMP remains optional for deeper managed-network identity.</p></div><span>{devices.length} device{devices.length === 1 ? '' : 's'}</span></div>
      <div className="rmm-network-table devices">
        <div className="head"><span>Device</span><span>Address</span><span>Identity</span><span>Capabilities / discovery</span><span>Management</span><span>Last seen</span><span>Status</span></div>
       {devices.map((item) => {
          const presentation = devicePresentation(item)
          const Icon = presentation.Icon
          const methods = Array.isArray(item.discovery_methods) ? item.discovery_methods : []
          const mdnsCapabilities = Array.isArray(item.metadata?.mdns?.capabilities)
            ? item.metadata.mdns.capabilities
            : []
          const matterDeviceType = item.metadata?.mdns?.matterDeviceType || ''
          const capabilityLabels = [...new Set([
            ...mdnsCapabilities.map(capabilityLabel),
            ...(matterDeviceType ? [matterDeviceType] : []),
          ])].slice(0, 5)
          const spotifyGroups = Array.isArray(item.metadata?.mdns?.spotifyConnect?.groupAliases)
            ? item.metadata.mdns.spotifyConnect.groupAliases
            : []
          const discoveryDetail = item.icmp_reachable
            ? 'ICMP reachable' + (item.latency_ms != null ? ' · ' + item.latency_ms + ' ms' : '')
            : item.snmp_version
              ? 'SNMP ' + String(item.snmp_version).toUpperCase()
              : 'Seen on local network'
          const management = managementPresentation(item)
          const privateMac = isPrivateMac(item.mac_address)
          const interfaces = Array.isArray(item.interfaces) ? item.interfaces : []
          const snmpMeta = item.metadata?.snmp || {}
          const expanded = expandedDeviceId === item.id
          const upInterfaces = interfaces.filter((entry) => entry?.operStatus === 'up' || entry?.up === true).length
          const downInterfaces = interfaces.filter((entry) => entry?.operStatus && entry?.operStatus !== 'up').length
          const toggleExpanded = () => setExpandedDeviceId(expanded ? '' : item.id)

          return <div className={'rmm-network-device-entry' + (expanded ? ' expanded' : '')} key={item.id}>
            <div
              className="row rmm-network-device-row"
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              onClick={toggleExpanded}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggleExpanded()
                }
              }}
            >
              <span className="device"><i><Icon size={16} /></i><span><strong>{item.managed_device_name || item.sys_name || item.hostname || item.ip_address}</strong><small>{presentation.label}{item.profile_name ? ' · ' + item.profile_name : ''}{item.site_name ? ' · ' + item.site_name : ''}</small></span></span>
              <span><strong>{item.ip_address}</strong><small>{item.mac_address || 'MAC not resolved'}</small>{privateMac && <em className="rmm-network-private-mac">Private/randomized MAC</em>}</span>
              <span><strong>{presentation.label}</strong><small>{item.vendor || (privateMac ? 'Vendor hidden by private MAC' : 'Unknown vendor')}{item.model ? ' · ' + item.model : ''}</small></span>
              <span className="rmm-network-discovery-cell">
                <strong>{methods.length ? methods.map((value) => String(value).toUpperCase()).join(' · ') : 'Presence'}</strong>
                <small>{discoveryDetail}</small>
                {!!capabilityLabels.length && <span className="rmm-network-capabilities">{capabilityLabels.map((value) => <b key={value}>{value}</b>)}</span>}
                {!!spotifyGroups.length && <small className="rmm-network-groups">Groups: {spotifyGroups.join(', ')}</small>}
              </span>
              <span className="rmm-network-management"><StatusPill tone={management.tone}>{management.label}</StatusPill><small>{management.detail}</small></span>
              <span><strong>{when(item.last_seen_at)}</strong><small>{item.hostname || item.sys_location || 'No hostname reported'}</small></span>
              <span className="rmm-network-status-expand"><StatusPill tone={item.status === 'online' ? 'healthy' : 'offline'}>{item.status}</StatusPill>{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
            </div>

            {expanded && <div className="rmm-network-device-detail">
              <div className="rmm-network-device-facts">
                <div><span>SNMP</span><strong>{item.snmp_version ? String(item.snmp_version).toUpperCase() : 'Not enriched'}</strong><small>{item.last_snmp_at ? 'Last SNMP: ' + when(item.last_snmp_at) : 'No SNMP response stored'}</small></div>
                <div><span>System name</span><strong>{item.sys_name || item.hostname || 'Not reported'}</strong><small>{item.vendor || 'Vendor unknown'}{item.model ? ' · ' + item.model : ''}</small></div>
                <div><span>Object ID</span><strong>{item.sys_object_id || 'Not reported'}</strong><small>{item.sys_descr || 'No system description'}</small></div>
                <div><span>Uptime</span><strong>{formatUptimeTicks(item.uptime_ticks)}</strong><small>{item.interface_count != null ? item.interface_count + ' interfaces reported' : 'Interface count unavailable'}</small></div>
                <div><span>Location</span><strong>{item.sys_location || 'Not set'}</strong><small>{item.sys_contact ? 'Contact: ' + item.sys_contact : 'No SNMP contact set'}</small></div>
                <div><span>Interface state</span><strong>{interfaces.length ? upInterfaces + ' up · ' + downInterfaces + ' other' : 'No interface inventory'}</strong><small>{interfaces.length + ' collected'}{snmpMeta.interfacesTruncated ? ' · capped at collection limit' : ''}</small></div>
              </div>

              {!!interfaces.length && <div className="rmm-network-interface-table">
                <div className="head"><span>Interface</span><span>Type</span><span>MAC</span><span>Link</span><span>Speed</span><span>MTU</span></div>
                {interfaces.map((entry) => <div className="row" key={entry.index ?? entry.name}>
                  <span><strong>{entry.name || 'Interface ' + entry.index}</strong><small>{entry.alias || entry.description || ('ifIndex ' + entry.index)}</small></span>
                  <span><strong>{niceLabel(entry.type || 'unknown')}</strong><small>ifIndex {entry.index}{entry.typeCode != null ? ' · type ' + entry.typeCode : ''}</small></span>
                  <span><strong>{entry.macAddress || '—'}</strong><small>{entry.adminStatus ? 'Admin ' + niceLabel(entry.adminStatus) : 'Admin state unknown'}</small></span>
                  <span><StatusPill tone={entry.operStatus === 'up' ? 'healthy' : entry.operStatus === 'down' ? 'offline' : 'neutral'}>{niceLabel(entry.operStatus || 'unknown')}</StatusPill><small>{entry.up === true ? 'Forwarding' : entry.up === false ? 'Not forwarding' : ''}</small></span>
                  <span><strong>{formatSpeed(entry.speedBps)}</strong><small>{entry.description || ''}</small></span>
                  <span><strong>{entry.mtu || '—'}</strong><small>{entry.alias || ''}</small></span>
                </div>)}
              </div>}
            </div>}
          </div>
        })}
      </div>
      {!devices.length && <div className="rmm-empty compact"><Network size={22} /><strong>No network devices discovered yet</strong><span>Create a presence profile and run a scan. SNMP is optional.</span></div>}
    </section>

    <section className="rmm-card rmm-network-runs-card">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">History</span><h2>Recent discovery runs</h2></div></div>
      <div className="rmm-network-run-list">
        {runs.slice(0, 12).map((run) => <div key={run.id}><CircleDot size={13} /><span><strong>{run.profile_name}</strong><small>{when(run.created_at)} · {run.addresses_total || 0} addresses · {run.presence_devices || 0} devices found · {run.snmp_enriched_devices || 0} SNMP enriched</small></span><StatusPill tone={run.status === 'completed' ? 'healthy' : run.status === 'failed' ? 'critical' : run.status === 'running' ? 'running' : 'neutral'}>{run.status}</StatusPill></div>)}
        {!runs.length && <div className="rmm-network-mini-empty">No network discovery scans have run yet.</div>}
      </div>
    </section>
  </div>
}
