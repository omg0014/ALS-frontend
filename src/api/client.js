// Small wrapper around fetch for the backend API (same origin, cookie session).

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('acls:logout'))
    throw new ApiError(res.status, data?.error || res.statusText, data?.details)
  }
  return data
}

// One readable sentence for an error, including validation details.
export const errorText = (err) => [err.message, ...(Array.isArray(err.details) ? err.details : [])].filter(Boolean).join(': ')
