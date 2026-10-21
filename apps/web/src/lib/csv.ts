import { decimalHours, formatDuration, type ReportDetailRow, type ReportSummaryRow } from '@nuvolau/shared'

type Cell = string | number | null | undefined

function escapeCell(value: Cell): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(table: Cell[][]): string {
  // BOM keeps Excel/Numbers happy with UTF-8.
  return '\ufeff' + table.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, table: Cell[][]): void {
  const blob = new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export interface SummaryCsvLabels {
  name: string
  username: string
  days: string
  entries: string
  hours: string
  decimal: string
}

export type DetailCsvLabels = SummaryCsvLabels & {
  date: string
  start: string
  end: string
  type: string
  pause: string
}

export function summaryCsvTable(rows: ReportSummaryRow[], labels: SummaryCsvLabels): Cell[][] {
  return [
    [labels.name, labels.username, labels.days, labels.entries, labels.hours, labels.decimal],
    ...rows.map((row) => [
      row.displayName,
      row.username,
      row.dayCount,
      row.entryCount,
      formatDuration(row.totalMinutes),
      decimalHours(row.totalMinutes),
    ]),
  ]
}

export function detailCsvTable(rows: ReportDetailRow[], labels: DetailCsvLabels): Cell[][] {
  const header = [
    labels.name,
    labels.username,
    labels.date,
    labels.start,
    labels.end,
    labels.type,
    labels.hours,
    labels.decimal,
  ]
  return [
    header,
    ...rows.map((row) => [
      row.displayName,
      row.username,
      row.workDate,
      row.startTime,
      row.endTime ?? '',
      row.kind === 'pause' ? labels.pause : '',
      row.minutes === null ? '' : formatDuration(row.minutes),
      row.minutes === null ? '' : decimalHours(row.minutes),
    ]),
  ]
}
