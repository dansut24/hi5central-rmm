import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ChevronRight, CircleStop, Command, Download, Folder, FolderPlus,
  HardDrive, ListTree, Play, Power, RefreshCw, RotateCw, Search,
  Server, Settings2, SquareTerminal, Trash2, Upload, Users, WifiOff, X,
} from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { deploymentConfig } from '../../lib/deploymentConfig.js'
import './RmmDeviceTools.css'

function apiBase() {
  return window.__HI5_API_BASE__ || deploymentConfig().apiUrl
}

function websocketUrl(path, params) {
  const base = new URL(apiBase())
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = path
  base.search = new URLSearchParams(params).toString()
  return base.toString()
}

function bytes(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (number < 1024) return number + ' B'
  if (number < 1024 ** 2) return (number / 1024).toFixed(1) + ' KB'
  if (number < 1024 ** 3) return (number / 1024 ** 2).toFixed(1) + ' MB'
  return (number / 1024 ** 3).toFixed(1) + ' GB'
}

async function waitForJob(jobId, timeoutMs = 150000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(apiBase() + '/api/v1/rmm/device-actions/' + encodeURIComponent(jobId), { credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to read device action status.')
    if (['completed', 'failed', 'cancelled'].includes(payload.job?.status)) return payload.job
    await new Promise((resolve) => window.setTimeout(resolve, 400))
  }
  throw new Error('The device action is still running. Check Jobs for its final result.')
}

async function runAction(device, type, payload = {}, timeoutMs) {
  if (!device?.agentDeviceId) throw new Error('This device does not have a connected Hi5Central Agent.')
  if (String(device?.status || '').toLowerCase() !== 'online') throw new Error('This device is offline. No job was queued.')
  const response = await fetch(apiBase() + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/actions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Unable to queue the device action.')
  if (result.job && ['completed', 'failed', 'cancelled'].includes(result.job.status)) return result.job
  return waitForJob(result.job?.id, timeoutMs)
}

async function createToolSession(device, tool, shell, runAs = 'system') {
  if (String(device?.status || '').toLowerCase() !== 'online') throw new Error('This device is offline. Live tools are unavailable.')
  const response = await fetch(apiBase() + '/api/v1/rmm/devices/' + encodeURIComponent(device.agentDeviceId) + '/tool-sessions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, shell, runAs }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to start the live device tool.')
  return payload
}

function Empty({ children }) {
  return <div className="rmm-tool-empty">{children}</div>
}

function ToolStatusPill({ children, tone = 'neutral' }) {
  return <span className={`rmm-status-pill ${tone}`}>{children}</span>
}

function ToolSearch({ value, onChange, placeholder }) {
  return <label className="rmm-tool-search"><Search size={15} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function ToolLoadingRows({ columns = 5, count = 8 }) {
  return <div className="rmm-tool-loading-rows" aria-label="Loading">
    {Array.from({ length: count }).map((_, row) => <div key={row} style={{ '--tool-loading-columns': columns }}>
      {Array.from({ length: columns }).map((__, column) => <span key={column} />)}
    </div>)}
  </div>
}

const liveToolCache = new Map()
function cachedToolValue(key, maxAgeMs = 60000) {
  const item = liveToolCache.get(key)
  return item && Date.now() - item.savedAt <= maxAgeMs ? item.value : null
}
function rememberToolValue(key, value) {
  liveToolCache.set(key, { value, savedAt: Date.now() })
}

function TerminalTool({ device, shell, runAs = 'system' }) {
  const [state, setState] = useState('Connecting…')
  const [command, setCommand] = useState('')
  const socketRef = useRef(null)
  const terminalHostRef = useRef(null)
  const terminalRef = useRef(null)

  useEffect(() => {
    let closed = false
    let socket
    let resizeObserver
    let resizeTimer
    const host = terminalHostRef.current
    if (!host) return undefined

    const terminal = new Terminal({
      convertEol: false,
      cursorBlink: true,
      cursorStyle: 'block',
      disableStdin: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.25,
      scrollback: 6000,
      theme: {
        background: '#0c1118',
        foreground: '#e8edf4',
        cursor: '#e8edf4',
        selectionBackground: '#35506d',
      },
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host)
    terminalRef.current = terminal

    const fitAndResize = () => {
      try { fit.fit() } catch {}
      const current = socketRef.current
      if (current?.readyState === WebSocket.OPEN) {
        current.send(JSON.stringify({ type: 'terminal_resize', cols: terminal.cols, rows: terminal.rows }))
      }
    }
    window.requestAnimationFrame(fitAndResize)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        window.clearTimeout(resizeTimer)
        resizeTimer = window.setTimeout(fitAndResize, 40)
      })
      resizeObserver.observe(host)
    }

    createToolSession(device, 'terminal', shell, runAs).then((payload) => {
      if (closed) return
      socket = new WebSocket(websocketUrl(payload.websocketPath, { session_id: payload.session.id, token: payload.token }))
      socketRef.current = socket
      socket.onopen = () => {
        const label = shell === 'cmd' ? 'Command Prompt' : 'PowerShell'
        setState(label + ' · ' + (runAs === 'user' ? 'User' : 'SYSTEM') + ' · connected')
        fitAndResize()
      }
      socket.onmessage = (event) => {
        let message
        try { message = JSON.parse(event.data) } catch { return }
        if (message.type === 'terminal_output') terminal.write(String(message.data || ''))
        if (message.type === 'terminal_error') setState(message.error || 'Terminal error')
        if (message.type === 'terminal_closed') setState('Terminal closed')
      }
      socket.onerror = () => setState('Terminal connection failed')
      socket.onclose = () => { if (!closed) setState('Terminal disconnected') }
    }).catch((error) => setState(error.message))

    return () => {
      closed = true
      window.clearTimeout(resizeTimer)
      resizeObserver?.disconnect()
      try { socketRef.current?.send(JSON.stringify({ type: 'terminal_stop' })) } catch {}
      try { socketRef.current?.close() } catch {}
      socketRef.current = null
      terminalRef.current = null
      terminal.dispose()
    }
  }, [device.agentDeviceId, shell, runAs])

  function send(event) {
    event.preventDefault()
    const socket = socketRef.current
    if (!command || !socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'terminal_input', data: command + '\r' }))
    setCommand('')
  }

  return <div className="rmm-terminal-tool">
    <div className="rmm-tool-inline-status"><SquareTerminal size={15} /><span>{state}</span><button onClick={() => terminalRef.current?.clear()} type="button">Clear</button></div>
    <div className="rmm-xterm-host" ref={terminalHostRef} />
    <form onSubmit={send}><span>{shell === 'cmd' ? '>' : 'PS>'}</span><input autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Enter a command…" /><button type="submit">Send</button></form>
  </div>
}

function arrayBufferToBase64(buffer) {
  const bytesArray = new Uint8Array(buffer)
  let binary = ''
  const step = 0x8000
  for (let index = 0; index < bytesArray.length; index += step) {
    binary += String.fromCharCode(...bytesArray.subarray(index, Math.min(index + step, bytesArray.length)))
  }
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index)
  return out
}

function FilesTool({ device }) {
  const [state, setState] = useState('Connecting…')
  const [path, setPath] = useState('C:\\')
  const [parent, setParent] = useState('')
  const [entries, setEntries] = useState([])
  const [drives, setDrives] = useState([])
  const [search, setSearch] = useState('')
  const socketRef = useRef(null)
  const downloadsRef = useRef(new Map())
  const fileInputRef = useRef(null)

  function send(message) {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(message))
    return true
  }

  function list(nextPath) {
    const target = nextPath || path || 'C:\\'
    setState('Loading ' + target + '…')
    send({ type: 'files_list', path: target })
  }

  useEffect(() => {
    let disposed = false
    createToolSession(device, 'files').then((payload) => {
      if (disposed) return
      const socket = new WebSocket(websocketUrl(payload.websocketPath, { session_id: payload.session.id, token: payload.token }))
      socketRef.current = socket
      socket.onopen = () => {
        setState('Connected')
        socket.send(JSON.stringify({ type: 'files_list', path: 'C:\\' }))
      }
      socket.onmessage = (event) => {
        let message
        try { message = JSON.parse(event.data) } catch { return }
        if (message.type === 'files_result') {
          setPath(message.path || message.result?.path || 'C:\\')
          setParent(message.parent || message.result?.parent || '')
          setEntries(message.entries || message.result?.entries || [])
          setDrives(message.drives || message.result?.drives || [])
          setState('Connected')
          return
        }
        if (message.type === 'files_error') {
          setState(message.error || 'File operation failed')
          return
        }
        if (message.type === 'files_action_result' || message.type === 'files_upload_result') {
          if (message.success === false) setState(message.error || 'File operation failed')
          else {
            setState(message.message || 'Completed')
            window.setTimeout(() => list(message.refreshPath || message.refresh_path || path), 250)
          }
          return
        }
        if (message.type === 'files_download_start') {
          const size = Number(message.size_bytes || message.size || 0)
          if (size > 256 * 1024 * 1024) {
            setState('Browser download is limited to 256 MB in this view.')
            send({ type: 'files_download_cancel', transferId: message.transferId || message.transfer_id })
            return
          }
          downloadsRef.current.set(message.transferId || message.transfer_id, { chunks: [], filename: message.filename || 'download.bin' })
          setState('Downloading ' + (message.filename || 'file') + '…')
          return
        }
        if (message.type === 'files_download_chunk') {
          const id = message.transferId || message.transfer_id
          const download = downloadsRef.current.get(id)
          if (download) download.chunks.push(base64ToBytes(message.data || ''))
          return
        }
        if (message.type === 'files_download_complete') {
          const id = message.transferId || message.transfer_id
          const download = downloadsRef.current.get(id)
          if (!download) return
          const blob = new Blob(download.chunks)
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = download.filename
          anchor.click()
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          downloadsRef.current.delete(id)
          setState('Download complete')
        }
      }
      socket.onerror = () => setState('File browser connection failed')
      socket.onclose = () => { if (!disposed) setState('File browser disconnected') }
    }).catch((error) => setState(error.message))
    return () => {
      disposed = true
      try { socketRef.current?.close() } catch {}
    }
  }, [device.agentDeviceId])

  async function uploadFile(file) {
    if (!file) return
    if (file.size > 256 * 1024 * 1024) { setState('Browser upload is currently limited to 256 MB.'); return }
    const transferId = crypto.randomUUID()
    const buffer = await file.arrayBuffer()
    const chunkSize = 48 * 1024
    setState('Uploading ' + file.name + '…')
    send({ type: 'files_upload_start', transferId, directory: path, filename: file.name, size_bytes: file.size })
    for (let offset = 0, index = 0; offset < buffer.byteLength; offset += chunkSize, index += 1) {
      const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.byteLength))
      send({ type: 'files_upload_chunk', transferId, index, data: arrayBufferToBase64(chunk) })
      while ((socketRef.current?.bufferedAmount || 0) > 1024 * 1024) await new Promise((resolve) => window.setTimeout(resolve, 20))
    }
    send({ type: 'files_upload_complete', transferId, directory: path, filename: file.name, size_bytes: file.size })
  }

  function download(entry) {
    send({ type: 'files_download_request', transferId: crypto.randomUUID(), path: entry.full_path || entry.path })
  }

  function createFolder() {
    const name = window.prompt('New folder name')
    if (name) send({ type: 'files_mkdir_request', currentPath: path, name })
  }

  function rename(entry) {
    const name = window.prompt('New name', entry.name)
    if (name && name !== entry.name) send({ type: 'files_rename_request', path: entry.full_path || entry.path, currentPath: path, name })
  }

  function remove(entry) {
    if (window.confirm('Delete ' + entry.name + '? This is a remote filesystem action.')) {
      send({ type: 'files_delete_request', path: entry.full_path || entry.path, currentPath: path })
    }
  }

  const normalized = search.toLowerCase()
  const visible = entries.filter((entry) => !normalized || String(entry.name || '').toLowerCase().includes(normalized))

  return <div className="rmm-files-tool">
    <div className="rmm-files-toolbar">
      <button disabled={!parent} onClick={() => parent && list(parent)} type="button"><ArrowLeft size={15} /></button>
      <input value={path} onChange={(event) => setPath(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') list(event.currentTarget.value) }} />
      <button onClick={() => list(path)} type="button"><RefreshCw size={15} /></button>
      <button onClick={createFolder} type="button"><FolderPlus size={15} /> New folder</button>
      <button onClick={() => fileInputRef.current?.click()} type="button"><Upload size={15} /> Upload</button>
      <input ref={fileInputRef} hidden type="file" onChange={(event) => { uploadFile(event.target.files?.[0]); event.target.value = '' }} />
    </div>
    <div className="rmm-file-drive-strip">{drives.map((drive) => <button key={drive.root || drive.name} onClick={() => list(drive.root)} type="button"><HardDrive size={14} />{drive.name || drive.root}<small>{bytes(drive.free_bytes)} free</small></button>)}</div>
    <div className="rmm-tool-table-head files"><span>Name</span><span>Type</span><span>Size</span><span>Modified</span><span /></div>
    <div className="rmm-tool-table-body">{!entries.length && /connecting|loading/i.test(state) ? <ToolLoadingRows columns={5} /> : visible.map((entry) => <div className="rmm-tool-table-row files" key={entry.full_path || entry.path || entry.name}>
      <button className="rmm-file-name" onDoubleClick={() => entry.type === 'folder' && list(entry.full_path || entry.path)} onClick={() => {}} type="button"><Folder size={15} /><strong>{entry.name}</strong></button>
      <span>{entry.type || 'file'}</span><span>{entry.type === 'folder' ? '—' : bytes(entry.size_bytes)}</span><span>{entry.modified_at ? new Date(entry.modified_at).toLocaleString() : '—'}</span>
      <span className="rmm-row-actions">{entry.type !== 'folder' && <button onClick={() => download(entry)} title="Download" type="button"><Download size={14} /></button>}<button onClick={() => rename(entry)} title="Rename" type="button"><Settings2 size={14} /></button><button onClick={() => remove(entry)} title="Delete" type="button"><Trash2 size={14} /></button></span>
    </div>)}</div>
    <div className="rmm-tool-footer-status">{state}<span>{visible.length} item{visible.length === 1 ? '' : 's'}</span><ToolSearch value={search} onChange={setSearch} placeholder="Search this folder…" /></div>
  </div>
}

function ProcessesTool({ device }) {
  const cacheKey = `processes:${device.agentDeviceId}`
  const cachedRows = cachedToolValue(cacheKey, 30000)
  const [rows, setRows] = useState(() => cachedRows || [])
  const [search, setSearch] = useState('')
  const [state, setState] = useState(cachedRows ? 'Showing recent process list · refreshing…' : '')
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true); setState(rows.length ? 'Refreshing processes…' : 'Loading processes…')
    try {
      const job = await runAction(device, 'processes.list', {})
      if (job.status !== 'completed') throw new Error(job.error_message || 'Process inventory failed.')
      const nextRows = job.result?.processes || []
      setRows(nextRows)
      rememberToolValue(cacheKey, nextRows)
      setState('Live process list refreshed')
    } catch (error) { setState(error.message) } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [device.agentDeviceId])

  async function control(type, row) {
    const verb = type === 'process.restart' ? 'restart' : 'end'
    if (!window.confirm((verb === 'restart' ? 'Restart ' : 'End ') + row.name + ' (PID ' + row.pid + ')?')) return
    setBusy(true); setState((verb === 'restart' ? 'Restarting ' : 'Ending ') + row.name + '…')
    try {
      const job = await runAction(device, type, { pid: row.pid })
      if (job.status !== 'completed') throw new Error(job.error_message || job.result?.error || 'Process action failed.')
      await load()
    } catch (error) { setState(error.message); setBusy(false) }
  }

  const normalized = search.toLowerCase()
  const visible = rows.filter((row) => !normalized || [row.name, row.pid, row.window_title, row.path].join(' ').toLowerCase().includes(normalized))
  return <div className="rmm-live-list-tool">
    <div className="rmm-tool-commandbar"><ToolSearch value={search} onChange={setSearch} placeholder="Search processes…" /><button disabled={busy} onClick={load} type="button"><RefreshCw size={14} /> Refresh</button></div>
    <div className="rmm-tool-table-head processes"><span>Process</span><span>PID</span><span>CPU time</span><span>Memory</span><span>Threads</span><span /></div>
    <div className="rmm-tool-table-body">{busy && !rows.length ? <ToolLoadingRows columns={6} /> : visible.map((row) => <div className="rmm-tool-table-row processes" key={row.pid}><span><strong>{row.name}</strong><small>{row.window_title || row.path}</small></span><span>{row.pid}</span><span>{row.cpu_seconds ?? '—'}s</span><span>{bytes(row.working_set_bytes)}</span><span>{row.thread_count ?? '—'}</span><span className="rmm-row-actions"><button disabled={busy} onClick={() => control('process.restart', row)} title="Restart process" type="button"><RotateCw size={14} /></button><button className="danger" disabled={busy} onClick={() => control('process.kill', row)} title="End task" type="button"><CircleStop size={14} /></button></span></div>)}</div>
    <div className="rmm-tool-footer-status">{state}<span>{visible.length} processes</span></div>
  </div>
}

function ServicesTool({ device }) {
  const cacheKey = `services:${device.agentDeviceId}`
  const cachedRows = cachedToolValue(cacheKey, 60000)
  const [rows, setRows] = useState(() => cachedRows || [])
  const [search, setSearch] = useState('')
  const [state, setState] = useState(cachedRows ? 'Showing recent service list · refreshing…' : '')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(!cachedRows)

  function startupValue(row) {
    const raw = String(row.start_mode || 'Manual').toLowerCase()
    if (raw.includes('delay')) return 'AutomaticDelayed'
    if (raw === 'auto' || raw === 'automatic') return 'Automatic'
    if (raw === 'disabled') return 'Disabled'
    return 'Manual'
  }

  async function load() {
    setLoading(true)
    setState(rows.length ? 'Refreshing services…' : 'Loading services…')
    try {
      const job = await runAction(device, 'services.list', {})
      if (job.status !== 'completed') throw new Error(job.error_message || 'Service inventory failed.')
      const nextRows = job.result?.services || []
      setRows(nextRows)
      rememberToolValue(cacheKey, nextRows)
      setState('Service list refreshed')
    } catch (error) { setState(error.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [device.agentDeviceId])

  async function control(type, row, payload = {}) {
    setBusy(row.name + ':' + type); setState('Applying service action…')
    try {
      const job = await runAction(device, type, { serviceName: row.name, ...payload })
      if (job.status !== 'completed') throw new Error(job.error_message || job.result?.error || 'Service action failed.')
      await load()
    } catch (error) { setState(error.message) } finally { setBusy('') }
  }

  const normalized = search.toLowerCase()
  const visible = rows.filter((row) => !normalized || [row.name, row.display_name, row.state, row.start_mode, row.description].join(' ').toLowerCase().includes(normalized))
  return <div className="rmm-live-list-tool">
    <div className="rmm-tool-commandbar"><ToolSearch value={search} onChange={setSearch} placeholder="Search services…" /><button disabled={loading} onClick={load} type="button"><RefreshCw size={14} /> Refresh</button></div>
    <div className="rmm-tool-table-head services"><span>Service</span><span>Status</span><span>Startup</span><span>Account</span><span /></div>
    <div className="rmm-tool-table-body">{loading && !rows.length ? <ToolLoadingRows columns={5} /> : visible.map((row) => <div className="rmm-tool-table-row services" key={row.name}>
      <span><strong>{row.display_name || row.name}</strong><small>{row.name} · {row.description || row.path_name}</small></span>
      <span>{row.state}</span>
      <span><select value={startupValue(row)} onChange={(event) => control('services.set_start_type', row, { startType: event.target.value })}><option value="Automatic">Automatic</option><option value="AutomaticDelayed">Automatic (Delayed)</option><option value="Manual">Manual</option><option value="Disabled">Disabled</option></select></span>
      <span>{row.start_name || '—'}</span>
      <span className="rmm-row-actions"><button disabled={busy || row.state === 'Running'} onClick={() => control('services.start', row)} title="Start" type="button"><Play size={14} /></button><button disabled={busy || row.state !== 'Running'} onClick={() => control('services.stop', row)} title="Stop" type="button"><Power size={14} /></button><button disabled={busy} onClick={() => control('services.restart', row)} title="Restart" type="button"><RotateCw size={14} /></button></span>
    </div>)}</div>
    <div className="rmm-tool-footer-status">{state}<span>{visible.length} services</span></div>
  </div>
}

function parentRegistryPath(path) {
  const normalized = String(path || '').replace(/\\+$/, '')
  const index = normalized.lastIndexOf('\\')
  if (index <= normalized.indexOf(':')) return normalized.slice(0, normalized.indexOf(':') + 2)
  return normalized.slice(0, index)
}

function RegistryTool({ device }) {
  const hives = [
    ['HKLM:\\', 'HKEY_LOCAL_MACHINE', 'Machine-wide Windows and application settings'],
    ['HKCU:\\', 'HKEY_CURRENT_USER', 'Settings for the Agent service user context'],
    ['HKCR:\\', 'HKEY_CLASSES_ROOT', 'File associations and COM registrations'],
    ['HKU:\\', 'HKEY_USERS', 'Loaded user registry profiles'],
    ['HKCC:\\', 'HKEY_CURRENT_CONFIG', 'Current hardware profile settings'],
  ]
  const [path, setPath] = useState('')
  const [data, setData] = useState({ subkeys: [], values: [] })
  const [state, setState] = useState('Select a registry hive')
  const [busy, setBusy] = useState(false)

  async function load(nextPath) {
    if (!nextPath) return
    const cacheKey = `registry:${device.agentDeviceId}:${nextPath}`
    const cached = cachedToolValue(cacheKey, 30000)
    if (cached) { setData(cached); setPath(nextPath) }
    setBusy(true); setState(cached ? 'Refreshing registry…' : 'Reading registry…')
    try {
      const job = await runAction(device, 'registry.list', { path: nextPath })
      if (job.status !== 'completed') throw new Error(job.error_message || job.result?.error || 'Registry read failed.')
      const nextData = { subkeys: job.result?.subkeys || [], values: job.result?.values || [] }
      setData(nextData)
      rememberToolValue(cacheKey, nextData)
      setPath(nextPath)
      setState('Registry loaded')
    } catch (error) { setState(error.message) } finally { setBusy(false) }
  }

  useEffect(() => {
    setPath('')
    setData({ subkeys: [], values: [] })
    setState('Select a registry hive')
    setBusy(false)
  }, [device.agentDeviceId])

  function showHives() {
    setPath('')
    setData({ subkeys: [], values: [] })
    setState('Select a registry hive')
  }
  function goBack() {
    const normalized = String(path || '').replace(/\\+$/, '')
    if (!normalized || /^HK(?:LM|CU|CR|U|CC):$/i.test(normalized)) { showHives(); return }
    load(parentRegistryPath(path))
  }

  async function mutation(type, payload, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); setState('Applying registry change…')
    try {
      const job = await runAction(device, type, payload)
      if (job.status !== 'completed') throw new Error(job.error_message || job.result?.error || 'Registry action failed.')
      if (type === 'registry.delete_key') {
        const parent = parentRegistryPath(payload.path)
        if (/^HK(?:LM|CU|CR|U|CC):\\?$/i.test(parent)) await load(parent)
        else await load(parent)
      } else await load(path)
    } catch (error) { setState(error.message) } finally { setBusy(false) }
  }

  function createKey() {
    if (!path) return
    const name = window.prompt('New registry key name')
    if (name) mutation('registry.create_key', { path, name })
  }
  function editValue(row) {
    const value = window.prompt('Value for ' + row.name, row.value ?? '')
    if (value != null) mutation('registry.set_value', { path, name: row.name, value, kind: row.kind || 'String' })
  }

  return <div className={'rmm-registry-tool ' + (!path ? 'is-hive-picker' : '')}>
    <div className="rmm-files-toolbar">
      {path ? <><button onClick={goBack} title="Back" type="button"><ArrowLeft size={15} /></button><button onClick={showHives} title="Registry hives" type="button"><Settings2 size={15} /> Hives</button><input value={path} onChange={(event) => setPath(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(event.currentTarget.value) }} /><button onClick={() => load(path)} type="button"><RefreshCw size={15} /></button><button onClick={createKey} type="button"><FolderPlus size={15} /> New key</button></> : <span className="rmm-registry-picker-title"><Settings2 size={16} /><strong>Select a registry hive</strong><small>No registry data is read until you choose a hive.</small></span>}
    </div>
    {!path ? <div className="rmm-registry-hive-picker">{hives.map(([root, label, description]) => <button key={root} onClick={() => load(root)} type="button"><span><Folder size={18} /></span><strong>{label}</strong><small>{description}</small><code>{root}</code><ChevronRight size={15} /></button>)}</div> : <div className="rmm-registry-layout">
      <section><header>Subkeys</header>{busy && !data.subkeys.length && !data.values.length ? <ToolLoadingRows columns={2} count={7} /> : data.subkeys.map((row) => <div className="rmm-registry-row" key={row.name}><button onClick={() => load(path.replace(/\\+$/, '') + '\\' + row.name)} type="button"><Folder size={14} /><span>{row.name}</span></button><button className="danger" onClick={() => mutation('registry.delete_key', { path: path.replace(/\\+$/, '') + '\\' + row.name }, 'Delete registry key ' + row.name + ' and all of its contents?')} type="button"><Trash2 size={13} /></button></div>)}</section>
      <section><header>Values</header>{busy && !data.subkeys.length && !data.values.length ? <ToolLoadingRows columns={3} count={7} /> : data.values.map((row) => <div className="rmm-registry-value" key={row.name}><button onClick={() => editValue(row)} type="button"><strong>{row.name || '(Default)'}</strong><small>{row.kind || 'String'}</small><span>{row.value}</span></button><button className="danger" onClick={() => mutation('registry.delete_value', { path, name: row.name }, 'Delete registry value ' + row.name + '?')} type="button"><Trash2 size={13} /></button></div>)}</section>
    </div>}
    <div className="rmm-tool-footer-status">{busy ? 'Working…' : state}{path && <span>{data.subkeys.length} keys · {data.values.length} values</span>}</div>
  </div>
}

function StorageTool({ device }) {
  const rows = Array.isArray(device.inventory?.storage) ? device.inventory.storage : []
  return <div className="rmm-storage-tool">{rows.length ? rows.map((drive) => {
    const used = Number(drive.used_percent || 0)
    return <article key={drive.drive || drive.mount}><header><span><HardDrive size={19} /></span><div><strong>{drive.drive || drive.mount} {drive.label && '· ' + drive.label}</strong><small>{drive.type || 'Disk'} · {drive.filesystem || 'Unknown filesystem'}</small></div><b>{used.toFixed(0)}% used</b></header><div className="rmm-storage-meter"><span style={{ width: Math.min(100, used) + '%' }} /></div><div><span><small>Capacity</small><strong>{bytes(drive.total_bytes)}</strong></span><span><small>Free</small><strong>{bytes(drive.free_bytes)}</strong></span><span><small>BitLocker</small><strong>{drive.bitlocker_status || 'Not reported'}</strong></span><span><small>Encryption</small><strong>{drive.encryption_percentage == null ? 'Not reported' : drive.encryption_percentage + '%'}</strong></span></div></article>
  }) : <Empty>No disk inventory has been reported by this device yet.</Empty>}</div>
}

function windowsSessionState(value) {
  const labels = ['Active','Connected','Connect query','Shadow','Disconnected','Idle','Listen','Reset','Down','Initialising']
  const index = Number(value)
  return Number.isInteger(index) && labels[index] ? labels[index] : String(value ?? 'Unknown')
}

function SessionsTool({ device }) {
  const info = device.inventory?.sessions || {}
  const sessions = Array.isArray(info.sessions) ? info.sessions : []
  const localInfo = device.inventory?.local_users || {}
  const users = Array.isArray(localInfo.users) ? localInfo.users : []
  const admins = Array.isArray(device.inventory?.security?.local_admins) ? device.inventory.security.local_admins : []
  const adminNames = new Set(admins.flatMap((admin) => {
    const full = String(admin.name || '').toLowerCase()
    const leaf = full.split('\\').pop()
    return [full, leaf].filter(Boolean)
  }))
  const localUserCount = localInfo.count ?? (users.length || null)
  const adminCount = device.inventory?.security?.local_admin_count ?? admins.length
  const isAdmin = (user) => Boolean(user.is_admin || adminNames.has(String(user.name || '').toLowerCase()))

  return <div className="rmm-static-tool rmm-users-sessions-tool">
    <div className="rmm-tool-summary-grid sessions-summary"><span><small>Console user</small><strong>{info.console_user || 'Not reported'}</strong></span><span><small>Local users</small><strong>{localUserCount ?? 'Awaiting Agent inventory'}</strong></span><span><small>Local admins</small><strong>{adminCount ?? 'Not reported'}</strong></span><span><small>RDP sessions</small><strong>{info.rdp_sessions ?? 'Not reported'}</strong></span></div>

    <section className="rmm-account-section"><header><div><strong>Local users</strong><small>Windows accounts defined on this endpoint</small></div><span>{users.length || '—'}</span></header>
      {users.length ? <div className="rmm-account-grid">{users.map((user) => <article key={user.sid || user.name}><div className="rmm-account-title"><span><Users size={16} /></span><div><strong>{user.name || 'Unnamed account'}</strong><small>{user.full_name || user.description || user.sid || 'Local account'}</small></div><ToolStatusPill tone={user.enabled === false ? 'neutral' : 'healthy'}>{user.enabled === false ? 'Disabled' : 'Enabled'}</ToolStatusPill></div><div className="rmm-account-meta"><span><small>Role</small><strong>{isAdmin(user) ? 'Administrator' : 'Standard user'}</strong></span><span><small>Last logon</small><strong>{user.last_logon ? new Date(user.last_logon).toLocaleString() : 'Not reported'}</strong></span><span><small>SID</small><strong title={user.sid || ''}>{user.sid || 'Not reported'}</strong></span></div></article>)}</div> : <Empty>Local-user inventory will appear after the updated Agent reports its next inventory snapshot.</Empty>}
    </section>

    <section className="rmm-account-section"><header><div><strong>Local administrators</strong><small>Members of the endpoint Administrators group</small></div><span>{admins.length}</span></header>
      {admins.length ? <div className="rmm-admin-list">{admins.map((admin, index) => <article key={(admin.name || 'admin') + index}><span><Users size={15} /></span><div><strong>{admin.name || 'Unknown principal'}</strong><small>{[admin.object_class, admin.principal_source].filter(Boolean).join(' · ') || 'Administrator'}</small></div><ToolStatusPill tone="warning">Admin</ToolStatusPill></article>)}</div> : <Empty>No local administrator membership has been reported.</Empty>}
    </section>

    <section className="rmm-account-section"><header><div><strong>Interactive sessions</strong><small>Console, Remote Desktop and Windows session state</small></div><span>{sessions.length}</span></header><div className="rmm-tool-table-head sessions"><span>User</span><span>Session</span><span>Station</span><span>State</span></div><div className="rmm-tool-table-body">{sessions.map((row) => <div className="rmm-tool-table-row sessions" key={row.id}><span><strong>{row.user || 'System / no user'}</strong></span><span>{row.id}</span><span>{row.station || '—'}</span><span>{windowsSessionState(row.state)}</span></div>)}</div>{!sessions.length && <Empty>No Windows session inventory has been reported.</Empty>}</section>
  </div>
}

function EventsTool({ device }) {
  const initialCacheKey = `events:${device.agentDeviceId}:System:All`
  const cachedInitial = cachedToolValue(initialCacheKey, 30000)
  const [logName, setLogName] = useState('System')
  const [level, setLevel] = useState('All')
  const [events, setEvents] = useState(() => cachedInitial || [])
  const [search, setSearch] = useState('')
  const [state, setState] = useState(cachedInitial ? 'Showing recent events · refreshing…' : '')
  const [busy, setBusy] = useState(false)

  async function load(nextLog = logName, nextLevel = level) {
    const cacheKey = `events:${device.agentDeviceId}:${nextLog}:${nextLevel}`
    const cached = cachedToolValue(cacheKey, 30000)
    if (cached) setEvents(cached)
    setBusy(true)
    setState(cached ? 'Refreshing ' + nextLog + ' events…' : 'Reading ' + nextLog + ' events…')
    try {
      const job = await runAction(device, 'events.list', { logName: nextLog, level: nextLevel, maxEvents: 100 }, 210000)
      if (job.status !== 'completed') throw new Error(job.error_message || job.result?.error || 'Event log read failed.')
      const nextEvents = job.result?.events || []
      setEvents(nextEvents)
      rememberToolValue(cacheKey, nextEvents)
      setState(nextEvents.length + ' events loaded')
    } catch (error) {
      if (!cached) setEvents([])
      setState(error.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load('System', 'All') }, [device.agentDeviceId])

  const normalized = search.trim().toLowerCase()
  const visible = events.filter((event) => !normalized || [event.event_id, event.provider, event.level, event.message, event.computer].join(' ').toLowerCase().includes(normalized))

  return <div className="rmm-live-list-tool">
    <div className="rmm-tool-commandbar">
      <select value={logName} onChange={(event) => { const value=event.target.value; setLogName(value); load(value, level) }}><option>System</option><option>Application</option><option>Security</option></select>
      <select value={level} onChange={(event) => { const value=event.target.value; setLevel(value); load(logName, value) }}><option>All</option><option>Critical</option><option>Error</option><option>Warning</option><option>Information</option><option>Verbose</option></select>
      <ToolSearch value={search} onChange={setSearch} placeholder="Search events…" />
      <button disabled={busy} onClick={() => load()} type="button"><RefreshCw size={14} /> Refresh</button>
    </div>
    <div className="rmm-tool-table-head events"><span>Level</span><span>Date & time</span><span>Source</span><span>Event ID</span><span>Message</span></div>
    <div className="rmm-tool-table-body">{busy && !events.length ? <ToolLoadingRows columns={5} /> : visible.map((row) => <div className="rmm-tool-table-row events" key={(row.record_id || row.event_id) + ':' + (row.time_created || '')}><span><strong>{row.level || 'Information'}</strong></span><span>{row.time_created ? new Date(row.time_created).toLocaleString() : '—'}</span><span><strong>{row.provider || 'Unknown'}</strong></span><span>{row.event_id ?? '—'}</span><span title={row.message || ''}>{row.message || 'No message text'}</span></div>)}</div>
    {!busy && !visible.length && <Empty>{search ? 'No events match this search.' : 'No events were returned for this log and level.'}</Empty>}
    <div className="rmm-tool-footer-status">{busy ? 'Working…' : state}<span>{visible.length} event{visible.length === 1 ? '' : 's'}</span></div>
  </div>
}

const TOOLS = [
  ['powershell', 'PowerShell', SquareTerminal, 'Native ConPTY terminal for administrative PowerShell work.'],
  ['cmd', 'Command Prompt', Command, 'Native Command Prompt session for interactive Windows commands.'],
  ['files', 'File browser', Folder, 'Browse, upload, download and manage endpoint files.'],
  ['processes', 'Task Manager', ListTree, 'Inspect running processes and terminate or restart them.'],
  ['services', 'Services', Server, 'Review service state, startup configuration and control services.'],
  ['registry', 'Registry Editor', Settings2, 'Browse and edit the Windows registry remotely.'],
  ['disks', 'Disk Management', HardDrive, 'Inspect volumes, capacity and BitLocker state.'],
  ['sessions', 'Users & Sessions', Users, 'Review interactive, console and Remote Desktop sessions.'],
  ['events', 'Event Logs', ListTree, 'Search Windows event logs for diagnostics and health events.'],
]

function ToolLauncher({ onSelect }) {
  return <div className="rmm-tool-launcher">
    <div className="rmm-tool-launcher-heading"><span className="rmm-eyebrow">Live management</span><h3>Choose a device tool</h3><p>Tools start only when selected. Leaving the Tools tab closes the active live session or workspace.</p></div>
    <div className="rmm-tool-launcher-grid">{TOOLS.map(([id, label, Icon, description]) => <button key={id} onClick={() => onSelect(id)} type="button"><span><Icon size={18} /></span><strong>{label}</strong><small>{description}</small><ChevronRight size={15} /></button>)}</div>
  </div>
}

export function RmmDeviceToolWorkspace({ device, embedded = false, initialTool = '', onClose, onToolChange }) {
  const [tool, setTool] = useState(initialTool)
  const [runAs, setRunAs] = useState('system')
  const toolNavRef = useRef(null)
  useEffect(() => { setTool(initialTool || '') }, [initialTool])
  useEffect(() => {
    const nav = toolNavRef.current
    if (!nav) return undefined
    const frame = window.requestAnimationFrame(() => {
      const activeId = tool || 'all'
      const button = nav.querySelector('[data-tool-id="' + activeId + '"]')
      if (!button) return
      const left = Math.max(0, button.offsetLeft - Math.max(0, (nav.clientWidth - button.offsetWidth) / 2))
      nav.scrollTo({ left, behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [tool])
  function selectTool(nextTool) {
    const normalized = TOOLS.some((item) => item[0] === nextTool) ? nextTool : ''
    setTool(normalized)
    onToolChange?.(normalized)
  }
  const selected = TOOLS.find((item) => item[0] === tool) || null
  const online = Boolean(device?.agentDeviceId) && String(device?.status || '').toLowerCase() === 'online'

  let content = null
  if (tool === 'powershell' || tool === 'cmd') content = <TerminalTool device={device} key={tool + ':' + runAs} runAs={runAs} shell={tool} />
  else if (tool === 'files') content = <FilesTool device={device} />
  else if (tool === 'processes') content = <ProcessesTool device={device} />
  else if (tool === 'services') content = <ServicesTool device={device} />
  else if (tool === 'registry') content = <RegistryTool device={device} />
  else if (tool === 'disks') content = <StorageTool device={device} />
  else if (tool === 'sessions') content = <SessionsTool device={device} />
  else if (tool === 'events') content = <EventsTool device={device} />

  const workspace = <section className={'rmm-device-tool-workspace ' + (embedded ? 'is-embedded' : '')} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : 'true'} aria-label={selected?.[1] || 'Device tools'}>
    <header><div><span className="rmm-eyebrow">{device.name}</span><h2>{selected?.[1] || 'Device tools'}</h2><p>{online ? selected ? 'Live management from the device Tools tab' : 'Select a live management workspace for this endpoint' : 'Device is offline'}</p></div>{!embedded && <button aria-label="Close device tool" onClick={onClose} type="button"><X size={19} /></button>}</header>
    {online
      ? <div className="rmm-device-tool-body">
          <nav aria-label="Device tools" ref={toolNavRef}>
            <button aria-current={!tool ? 'page' : undefined} className={!tool ? 'active' : ''} data-tool-id="all" onClick={() => selectTool('')} type="button"><Settings2 size={16} /><span>All tools</span><ChevronRight size={13} /></button>
            {TOOLS.map(([id, label, Icon]) => <button aria-current={tool === id ? 'page' : undefined} className={tool === id ? 'active' : ''} data-tool-id={id} key={id} onClick={() => selectTool(id)} type="button"><Icon size={16} /><span>{label}</span><ChevronRight size={13} /></button>)}
          </nav>
          <main className={tool === 'powershell' || tool === 'cmd' ? 'is-terminal' : ''}>
            {(tool === 'powershell' || tool === 'cmd') && <div className="rmm-terminal-context"><span><strong>Run as</strong><small>Changing context starts a new terminal session.</small></span><div role="group" aria-label="Terminal execution context"><button className={runAs === 'user' ? 'active' : ''} onClick={() => setRunAs('user')} type="button">User</button><button className={runAs === 'system' ? 'active' : ''} onClick={() => setRunAs('system')} type="button">SYSTEM</button></div></div>}
            {tool ? content : <ToolLauncher onSelect={selectTool} />}
          </main>
        </div>
      : <div className="rmm-device-tool-offline"><WifiOff size={28} /><strong>Live tools are unavailable while this device is offline</strong><span>No Agent job or tool session will be queued. Use Overview, Activity or Jobs while you wait for the endpoint to reconnect.</span></div>}
  </section>

  return embedded ? workspace : <div className="rmm-tool-backdrop" role="presentation">{workspace}</div>
}
