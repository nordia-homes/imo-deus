// Only fixed categories enter logs; provider messages, prompts and record data do not.
export function failureCategory(error: unknown) {
  const value = error as { code?: unknown; status?: unknown } | null;
  const code = Number(value?.status ?? value?.code);
  if ([401, 403, 7, 16].includes(code)) return 'access';
  if ([409, 429, 6, 10].includes(code)) return 'conflict';
  if ([4, 408, 504].includes(code)) return 'timeout';
  if (code === 9) return 'precondition';
  if ([13, 14, 500, 502, 503].includes(code)) return 'infrastructure';
  return 'unexpected';
}
