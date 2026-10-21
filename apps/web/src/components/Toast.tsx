import { useEffect, useState } from 'react'

/** Tiny auto-dismissing confirmation toast — "was it registered? yes." */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 2200)
    return () => clearTimeout(timer)
  }, [message])

  return {
    show: setMessage,
    node: message ? (
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="rounded-full bg-stone-900/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
          {message}
        </div>
      </div>
    ) : null,
  }
}
