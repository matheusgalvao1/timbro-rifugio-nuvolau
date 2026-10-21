const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * The only clock the app trusts: today's wall-clock date and time at the
 * rifugio (Europe/Rome), independent of the browser timezone.
 */
export function romeNow(now = new Date()): { date: string; time: string } {
  return {
    date: dateFormatter.format(now).replaceAll('/', '-'),
    time: timeFormatter.format(now),
  }
}
