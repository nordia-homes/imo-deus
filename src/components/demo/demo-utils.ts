export function createDemoEntityId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDemoCurrency(value: number) {
  return `€${Math.round(value || 0).toLocaleString("ro-RO")}`;
}

export function formatDemoDateTime(value: string) {
  return new Date(value).toLocaleString("ro-RO");
}

export function formatDemoDate(value: string) {
  return new Date(value).toLocaleDateString("ro-RO");
}
