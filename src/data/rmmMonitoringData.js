import { rmmDevices } from './rmmData.js'

export function monitoringScopeDeviceCount(scopeType, scopeId, options = {}) {
  const devices = options.devices || rmmDevices
  if (scopeType === 'Estate') return devices.length
  if (scopeType === 'Site') return devices.filter((device) => device.siteId === scopeId).length
  if (scopeType === 'Group') {
    const group = (options.groups || []).find((item) => item.id === scopeId)
    if (group) return (group.deviceIds || []).length
    return 0
  }
  if (scopeType === 'Device') return devices.some((device) => device.id === scopeId) ? 1 : 0
  return 0
}

export function monitoringScopeOptions(scopeType, options = {}) {
  const devices = options.devices || rmmDevices
  const sites = options.sites || []
  const groups = options.groups || []
  if (scopeType === 'Estate') return [{ id: 'ALL', name: 'Entire managed estate' }]
  if (scopeType === 'Site') return sites.filter((site) => site.active !== false).map((site) => ({ id: site.id, name: site.name }))
  if (scopeType === 'Group') return groups.map((group) => ({ id: group.id, name: group.name }))
  if (scopeType === 'Device') return devices.map((device) => ({ id: device.id, name: `${device.name} · ${device.user || device.type}` }))
  return []
}
