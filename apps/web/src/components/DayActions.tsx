import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { TimeEntry } from '@nuvolau/shared'
import { usePauseTimer, useResumeTimer, useStartTimer, useStopTimer } from '../api/hooks'
import { romeNow } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { Button, Dialog, ErrorNote, Field, Input } from './ui'
import { PauseIcon, PlayIcon, StopIcon } from './icons'

export type QuickAction = 'start' | 'pause' | 'resume' | 'stop'

/**
 * The workday quick actions, shown on today's view. The exact set depends on
 * the state machine: idle → start; work running → pause/finish; pause
 * running → end pause/finish. Every action opens a dialog prefilled with
 * "now" so a forgotten clock-in can be registered at the real time.
 */
export function DayActions({
  running,
  onRegistered,
}: {
  running: TimeEntry | null
  onRegistered: () => void
}) {
  const { t } = useT()
  const [action, setAction] = useState<QuickAction | null>(null)

  const idle = !running
  const onPause = running?.kind === 'pause'

  const buttons: { key: QuickAction; label: string; icon: ReactNode; primary: boolean }[] = idle
    ? [{ key: 'start', label: t.employee.startDay, icon: <PlayIcon className="size-4" />, primary: true }]
    : onPause
      ? [
          { key: 'resume', label: t.employee.endPause, icon: <PlayIcon className="size-4" />, primary: true },
          { key: 'stop', label: t.employee.finishDay, icon: <StopIcon className="size-4" />, primary: false },
        ]
      : [
          { key: 'pause', label: t.employee.startPause, icon: <PauseIcon className="size-4" />, primary: false },
          { key: 'stop', label: t.employee.finishDay, icon: <StopIcon className="size-4" />, primary: true },
        ]

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((button) => (
          <Button
            key={button.key}
            variant={button.primary ? 'primary' : 'secondary'}
            className={idle ? 'col-span-2' : ''}
            onClick={() => setAction(button.key)}
          >
            {button.icon}
            {button.label}
          </Button>
        ))}
      </div>
      <QuickActionDialog
        action={action}
        running={running}
        onClose={() => setAction(null)}
        onRegistered={onRegistered}
      />
    </>
  )
}

function QuickActionDialog({
  action,
  running,
  onClose,
  onRegistered,
}: {
  action: QuickAction | null
  running: TimeEntry | null
  onClose: () => void
  onRegistered: () => void
}) {
  const { t } = useT()
  const start = useStartTimer()
  const pause = usePauseTimer()
  const resume = useResumeTimer()
  const stop = useStopTimer()
  const [now] = useState(() => romeNow())
  const [date, setDate] = useState(now.date)
  const [time, setTime] = useState(now.time)

  useEffect(() => {
    if (action) {
      const current = romeNow()
      setDate(current.date)
      setTime(current.time)
    }
  }, [action])

  if (!action) return null

  const titles: Record<QuickAction, string> = {
    start: t.employee.startDay,
    pause: t.employee.startPause,
    resume: t.employee.endPause,
    stop: t.employee.finishDay,
  }
  const busy = { start, pause, resume, stop }[action].isPending
  const error = { start, pause, resume, stop }[action].error

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const onSuccess = () => {
      onRegistered()
      onClose()
    }
    if (action === 'start') start.mutate({ workDate: date, startTime: time }, { onSuccess })
    else if (action === 'pause') pause.mutate({ workDate: date, startTime: time }, { onSuccess })
    else if (action === 'resume') resume.mutate({ endDate: date, endTime: time }, { onSuccess })
    else stop.mutate({ endDate: date, endTime: time }, { onSuccess })
  }

  return (
    <Dialog open onClose={onClose} title={titles[action]}>
      <form onSubmit={onSubmit} className="space-y-4">
        {running && (
          <p className="text-sm text-stone-500">
            {t.employee.startedAt} {running.startTime}
          </p>
        )}
        <Field label={t.date}>
          <Input type="date" max={now.date} value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label={t.time}>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" busy={busy}>
            {titles[action]}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
