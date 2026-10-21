import { useEffect, useState, type FormEvent } from 'react'
import {
  compareTimes,
  entryCreateSchema,
  entryUpdateSchema,
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

  useEffect(() => {
    if (!mode) return
    setLocalError(null)
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setLocalError(null)
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
          <Field label="Start">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="End">
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
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
