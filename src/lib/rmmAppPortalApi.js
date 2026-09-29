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
  if (!response.ok) {
    const error = new Error(payload.error || 'App Portal request failed.')
    error.status = response.status
    error.data = payload
    throw error
  }
  return payload
}

export const loadAppPortal = () => request('/api/v1/rmm/app-portal')
export const createAppPortalApp = (payload) => request('/api/v1/rmm/app-portal/apps', {
  method: 'POST', body: JSON.stringify(payload),
})
export const createAppPortalRevision = (appId, payload) => request('/api/v1/rmm/app-portal/apps/' + encodeURIComponent(appId) + '/revisions', {
  method: 'POST', body: JSON.stringify(payload),
})
export const publishAppPortalRevision = (revisionId) => request('/api/v1/rmm/app-portal/revisions/' + encodeURIComponent(revisionId) + '/publish', {
  method: 'POST',
})
export const assignAppPortalApp = (appId, payload) => request('/api/v1/rmm/app-portal/apps/' + encodeURIComponent(appId) + '/assignments', {
  method: 'POST', body: JSON.stringify(payload),
})
export const removeAppPortalAssignment = (assignmentId) => request('/api/v1/rmm/app-portal/assignments/' + encodeURIComponent(assignmentId), {
  method: 'DELETE',
})
export const decideAppPortalRequest = (requestId, decision, note = '') => request('/api/v1/rmm/app-portal/requests/' + encodeURIComponent(requestId) + '/decision', {
  method: 'POST', body: JSON.stringify({ decision, note }),
})

export async function uploadAppPortalPackage(revisionId, file) {
  const response = await fetch(API_BASE + '/api/v1/rmm/app-portal/revisions/' + encodeURIComponent(revisionId) + '/package', {
    method: 'PUT',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Hi5-Filename': encodeURIComponent(file.name || 'package.bin'),
    },
    body: file,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Package upload failed.')
    error.status = response.status
    error.data = payload
    throw error
  }
  return payload
}
