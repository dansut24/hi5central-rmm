const API_BASE = window.__HI5_API_BASE__

async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'RMM configuration request failed.')
  return payload
}

export function loadRmmScope() {
  return request('/api/v1/rmm/scope')
}

export function createRmmGroup(group) {
  return request('/api/v1/rmm/groups', { method: 'POST', body: JSON.stringify(group) })
}

export function updateRmmGroup(groupId, group) {
  return request('/api/v1/rmm/groups/' + encodeURIComponent(groupId), { method: 'PUT', body: JSON.stringify(group) })
}

export function deleteRmmGroup(groupId) {
  return request('/api/v1/rmm/groups/' + encodeURIComponent(groupId), { method: 'DELETE' })
}

export function createRmmSavedView(view) {
  return request('/api/v1/rmm/saved-views', { method: 'POST', body: JSON.stringify(view) })
}

export function updateRmmSavedView(viewId, changes) {
  return request('/api/v1/rmm/saved-views/' + encodeURIComponent(viewId), { method: 'PATCH', body: JSON.stringify(changes) })
}

export function deleteRmmSavedView(viewId) {
  return request('/api/v1/rmm/saved-views/' + encodeURIComponent(viewId), { method: 'DELETE' })
}

export function createRmmMonitoringPolicy(policy) {
  return request('/api/v1/rmm/monitoring-policies', { method: 'POST', body: JSON.stringify(policy) })
}

export function updateRmmMonitoringPolicy(policyId, policy) {
  return request('/api/v1/rmm/monitoring-policies/' + encodeURIComponent(policyId), { method: 'PUT', body: JSON.stringify(policy) })
}

export function deleteRmmMonitoringPolicy(policyId) {
  return request('/api/v1/rmm/monitoring-policies/' + encodeURIComponent(policyId), { method: 'DELETE' })
}

export function createRmmMonitoringAssignment(assignment) {
  return request('/api/v1/rmm/monitoring-assignments', { method: 'POST', body: JSON.stringify(assignment) })
}

export function deleteRmmMonitoringAssignment(assignmentId) {
  return request('/api/v1/rmm/monitoring-assignments/' + encodeURIComponent(assignmentId), { method: 'DELETE' })
}

export function saveRmmMonitoringOverride(override) {
  return request('/api/v1/rmm/monitoring-overrides', { method: 'POST', body: JSON.stringify(override) })
}

export function deleteRmmMonitoringOverride(overrideId) {
  return request('/api/v1/rmm/monitoring-overrides/' + encodeURIComponent(overrideId), { method: 'DELETE' })
}
