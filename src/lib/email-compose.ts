export function plainTextToEmailHtml(value: string) {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('');
}

export function emailHtmlToPlainText(value: string) {
  if (typeof window === 'undefined') {
    return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
  const documentNode = new DOMParser().parseFromString(value, 'text/html');
  return (documentNode.body.innerText || documentNode.body.textContent || '').trim();
}

export function sanitizeEmailHtml(value: string) {
  return value
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export function parseEmailList(value: string) {
  return [...new Set(value.split(/[;,\s]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

export function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
