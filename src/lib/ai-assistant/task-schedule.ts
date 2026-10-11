// CRM task startTime is a Bucharest wall-clock time, not a UTC timestamp.
export function taskScheduleDetails(task: Record<string, any>) {
  const startTime = task.startTime ?? null;
  return {
    startTime,
    duration: task.duration ?? null,
    taskLocal: typeof startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
      ? `${startTime} (ora București)` : null,
  };
}
