/** Calendar helpers for event "add to agenda" links (.ics + Google Calendar). */

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Format a Date as UTC ICS timestamp: YYYYMMDDTHHMMSSZ */
export function toIcsUtc(date: Date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/** Escape text for ICS fields */
export function escapeIcs(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildIcs(options: {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  url?: string;
}) {
  const end = options.end ?? new Date(options.start.getTime() + DEFAULT_DURATION_MS);
  const stamp = toIcsUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Porto Nao-Monogamico//Eventos//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${options.id}@porto-nao-monogamico`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(options.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(options.title)}`,
  ];

  if (options.description) {
    lines.push(`DESCRIPTION:${escapeIcs(options.description)}`);
  }
  if (options.location) {
    lines.push(`LOCATION:${escapeIcs(options.location)}`);
  }
  if (options.url) {
    lines.push(`URL:${options.url}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Google Calendar "template" URL (works well on Android + desktop). */
export function buildGoogleCalendarUrl(options: {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  url?: string;
}) {
  const end = options.end ?? new Date(options.start.getTime() + DEFAULT_DURATION_MS);
  const dates = `${toIcsUtc(options.start)}/${toIcsUtc(end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: options.title,
    dates,
  });
  if (options.location) params.set('location', options.location);
  const details = [options.description, options.url].filter(Boolean).join('\n\n');
  if (details) params.set('details', details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
