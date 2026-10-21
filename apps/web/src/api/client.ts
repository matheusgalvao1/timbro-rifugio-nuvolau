import type { ApiErrorCode } from '@nuvolau/shared'

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
  }
}

type Options = { method?: string; json?: unknown }

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', json } = options
  const response = await fetch(path, {
    method,
    headers: json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    let code: ApiErrorCode = 'INTERNAL'
    let message = response.statusText || 'Request failed'
    try {
      const body = (await response.json()) as { error?: { code?: ApiErrorCode; message?: string } }
      if (body.error?.code) code = body.error.code
      if (body.error?.message) message = body.error.message
    } catch {
      // Non-JSON error body: keep the status text.
    }
    throw new ApiError(code, message)
  }
  return (await response.json()) as T
}

export function qs(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    search.set(key, Array.isArray(value) ? value.join(',') : value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
