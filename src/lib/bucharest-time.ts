export const BUCHAREST_TIME_ZONE = 'Europe/Bucharest';

type BucharestInput = {
  date: string;
  time: string;
};

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUCHAREST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

export function bucharestLocalToIso(dateValue: string, timeValue: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!match || !timeMatch) return null;
  const requested = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  if (
    requested.month < 1 || requested.month > 12
    || requested.day < 1 || requested.day > 31
    || requested.hour > 23 || requested.minute > 59
  ) return null;

  const wallClockUtc = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute
  );
  let candidate = wallClockUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(candidate));
    const actualWallClockUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    );
    const correction = wallClockUtc - actualWallClockUtc;
    if (!correction) break;
    candidate += correction;
  }

  const finalParts = zonedParts(new Date(candidate));
  if (
    finalParts.year !== requested.year
    || finalParts.month !== requested.month
    || finalParts.day !== requested.day
    || finalParts.hour !== requested.hour
    || finalParts.minute !== requested.minute
  ) return null;
  return new Date(candidate).toISOString();
}

export function bucharestInputFromIso(value: string | Date): BucharestInput {
  const date = value instanceof Date ? value : new Date(value);
  const parts = zonedParts(date);
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
  };
}

export function defaultBucharestScheduleInput(): BucharestInput {
  const future = new Date(Date.now() + 30 * 60 * 1000);
  future.setUTCMinutes(Math.ceil(future.getUTCMinutes() / 5) * 5, 0, 0);
  return bucharestInputFromIso(future);
}

export function formatBucharestDateTime(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ro-RO', {
    timeZone: BUCHAREST_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
}
