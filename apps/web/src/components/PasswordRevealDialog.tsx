import { useState } from 'react'
import { useT } from '../i18n/i18n'
import { Button, Dialog } from './ui'
import { CheckIcon, CopyIcon } from './icons'

export interface PasswordReveal {
  displayName: string
  username: string
  password: string
}

/** Shown once after create/reset — copy it or hand it over via WhatsApp. */
export function PasswordRevealDialog({
  reveal,
  onClose,
}: {
  reveal: PasswordReveal | null
  onClose: () => void
}) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  if (!reveal) return null

  const message = [
    t.owner.shareIntro,
    window.location.origin,
    `${t.username}: ${reveal.username}`,
    `${t.password}: ${reveal.password}`,
    t.owner.shareHint,
  ].join('\n')
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`

  const copy = async () => {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open onClose={onClose} title={reveal.displayName}>
      <p className="mb-3 text-sm text-stone-500">{t.owner.revealNote}</p>
      <p className="mb-1 rounded-xl bg-stone-100 px-3 py-2.5 text-center font-mono text-lg font-semibold tracking-wide">
        {reveal.password}
      </p>
      <p className="mb-4 text-center text-xs text-stone-400">
        {t.username}: {reveal.username}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={copy}>
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          {copied ? t.copied : t.copy}
        </Button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-medium text-white transition hover:bg-emerald-700"
        >
          WhatsApp
        </a>
      </div>
    </Dialog>
  )
}
