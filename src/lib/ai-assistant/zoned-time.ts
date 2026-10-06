export function zonedParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const part = (key: string) => parts.find(item => item.type === key)!.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
export function zonedInstant(date: string, time: string, timezone: string, utcOffsetMinutes?: number) {
  const nominal = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 10) !== date) throw new Error('Dată calendaristică invalidă.');
  const candidates: string[] = [];
  // Collect actual offsets near this date, including both sides of DST.
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const instant = new Date(nominal + delta * 3600000), local = zonedParts(instant, timezone);
    offsets.add((Date.parse(`${local.date}T${local.time}:00Z`) - instant.getTime()) / 60000);
  }
  for (const offset of offsets) {
    if (utcOffsetMinutes !== undefined && offset !== utcOffsetMinutes) continue;
    const instant = new Date(nominal - offset * 60000), local = zonedParts(instant, timezone);
    if (local.date === date && local.time === time) candidates.push(instant.toISOString());
  }
  if (candidates.length !== 1) throw new Error(candidates.length ? 'Ora este ambiguă la schimbarea orei; precizează offsetul UTC.' : 'Ora locală nu există; alege alt interval.');
  return candidates[0];
}
