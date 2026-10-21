import { useEffect, useState, type FormEvent } from 'react'
import {
  compareTimes,
  entryCreateSchema,
  entryUpdateSchema,
  entryMinutes,
  type TimeEntry,
} from '@nuvolau/shared'
import { useEntryMutation } from '../api/hooks'
import { romeNow } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { Button, Dialog, ErrorNote, Field, Input } from './ui'

type Mode = { kind: 'create'; defaultDate?: string } | { kind: 'edit'; entry: TimeEntry }

/** Add or edit one work period. Running entries simply omit the end time. */
export function EntryDialog({ mode, onClose }: { mode: Mode | null; onClose: () => void }) {
  const { t } = useT()
  const mutation = useEntryMutation(mode?.kind === 'edit' ? mode.entry.id : null)
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [longConfirmed, setLongConfirmed] = useState(false)

  useEffect(() => {
    if (!mode) return
    setLocalError(null)
    setLongConfirmed(false)
    if (mode.kind === 'edit') {
      setDate(mode.entry.workDate)
      setStart(mode.entry.startTime)
      setEnd(mode.entry.endTime ?? '')
    } else {
      const now = romeNow()
      setDate(mode.defaultDate ?? now.date)
      setStart('')
      setEnd('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (!mode) return null

  // Guardrail: entries beyond a full workday deserve a second look.
  const minutes = end ? entryMinutes(start, end) : 0
  const tooLong = !!end && minutes > 14 * 60

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setLocalError(null)
    if (tooLong && !longConfirmed) {
      setLongConfirmed(true)
      return
    }
    const body = end
      ? { workDate: date, startTime: start, endTime: end }
      : { workDate: date, startTime: start }
    const schema = mode.kind === 'edit' ? entryUpdateSchema : entryCreateSchema
    if (!schema.safeParse(body).success) {
      setLocalError(t.errors.VALIDATION)
      return
    }
    if (end && compareTimes(end, start) < 0) {
      setLocalError(t.errors.VALIDATION)
      return
    }
    mutation.mutate(body, { onSuccess: () => onClose() })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode.kind === 'edit' ? t.employee.editEntry : t.employee.addEntry}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t.date}>
          <Input
            type="date"
            max={romeNow().date}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.employee.start}>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label={t.employee.end}>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        {tooLong && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">
            {t.employee.longEntry}
          </p>
        )}
        {mode.kind === 'edit' && !mode.entry.endTime && (
          <p className="text-xs text-stone-500">{t.employee.running}</p>
        )}
        {localError && <ErrorNote error={new Error(localError)} />}
        <ErrorNote error={mutation.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" busy={mutation.isPending}>
            {t.save}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
