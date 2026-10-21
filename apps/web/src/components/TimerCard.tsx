import { useEffect, useState, type FormEvent } from 'react'
import type { TimeEntry } from '@nuvolau/shared'
import { formatDuration } from '@nuvolau/shared'
import { useRunningTimer, useStartTimer, useStopTimer } from '../api/hooks'
import { absoluteRomeMinutes, romeNow } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { Button, Card, Dialog, ErrorNote, Field, Input, Spinner } from './ui'
import { PlayIcon, StopIcon } from './icons'

/** Everything about starting/stopping the timer, in one rounded card. */
export function TimerCard() {
  const { t } = useT()
  const runningTimer = useRunningTimer()
  const startNow = useStartTimer()
  const [startOpen, setStartOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const [, setTick] = useState(0)
  const running = runningTimer.data?.entry ?? null

  // Re-render every 20s while the timer runs so the elapsed clock moves.
  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => setTick((tick) => tick + 1), 20_000)
    return () => clearInterval(interval)
  }, [running?.id])

  if (runningTimer.isPending) {
    return (
      <Card className="grid place-items-center py-8">
        <Spinner className="size-6 text-stone-300" />
      </Card>
    )
  }

  const now = romeNow()
  const elapsedMinutes = running
    ? Math.max(0, absoluteRomeMinutes(now.date, now.time) - absoluteRomeMinutes(running.workDate, running.startTime))
    : 0

  return (
    <>
      {running ? (
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-3xl font-semibold tabular-nums">{formatDuration(elapsedMinutes)}</p>
              <p className="text-sm text-stone-500">
                {t.employee.running} · {t.employee.startedAt} {running.startTime}
              </p>
            </div>
          </div>
          {elapsedMinutes > 16 * 60 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">
              {t.employee.longRunning}
            </p>
          )}
          <Button className="w-full" onClick={() => setStopOpen(true)}>
            <StopIcon className="size-4" />
            {t.employee.stop}
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3">
          <Button
            className="w-full"
            busy={startNow.isPending}
            onClick={() => startNow.mutate({})}
          >
            <PlayIcon className="size-4" />
            {t.employee.startNow}
          </Button>
          <ErrorNote error={startNow.error} />
          <Button variant="secondary" className="w-full" onClick={() => setStartOpen(true)}>
            {t.employee.startedEarlier}
          </Button>
        </Card>
      )}

      <StartDialog open={startOpen} onClose={() => setStartOpen(false)} />
      <StopDialog open={stopOpen} running={running} onClose={() => setStopOpen(false)} />
    </>
  )
}

/** "Started earlier?" — backdate the start before the timer begins. */
function StartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const start = useStartTimer()
  const [now] = useState(() => romeNow())
  const [date, setDate] = useState(now.date)
  const [time, setTime] = useState(now.time)

  useEffect(() => {
    if (open) {
      const current = romeNow()
      setDate(current.date)
      setTime(current.time)
    }
  }, [open])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    start.mutate(
      { workDate: date, startTime: time },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title={t.employee.startQuestion}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t.date}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label={t.time}>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <ErrorNote error={start.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" busy={start.isPending}>
            <PlayIcon className="size-4" />
            {t.employee.startNow}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Stop now or set the real end time (covers "I forgot to stop"). */
function StopDialog({
  open,
  running,
  onClose,
}: {
  open: boolean
  running: TimeEntry | null
  onClose: () => void
}) {
  const { t } = useT()
  const stop = useStopTimer()
  const [date, setDate] = useState(() => romeNow().date)
  const [time, setTime] = useState(() => romeNow().time)

  useEffect(() => {
    if (open) {
      const current = romeNow()
      setDate(current.date)
      setTime(current.time)
    }
  }, [open])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!running) return
    stop.mutate(
      { endDate: date, endTime: time },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title={t.employee.stopQuestion}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-stone-500">
          {t.employee.startedAt} {running?.startTime}
        </p>
        <Field label={t.date}>
          <Input type="date" max={romeNow().date} value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label={t.time}>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <ErrorNote error={stop.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" busy={stop.isPending}>
            <StopIcon className="size-4" />
            {t.employee.stop}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
