import { describe, expect, it } from 'vitest';
import { emailHtmlToPlainText, isEmailAddress, parseEmailList, plainTextToEmailHtml, sanitizeEmailHtml } from '@/lib/email-compose';

describe('email compose helpers', () => {
  it('normalizes and deduplicates CC recipients', () => {
    expect(parseEmailList('A@Example.com; b@example.com, a@example.com')).toEqual(['a@example.com', 'b@example.com']);
  });
  it('validates email addresses', () => {
    expect(isEmailAddress('agent@example.com')).toBe(true);
    expect(isEmailAddress('agent@')).toBe(false);
  });
  it('preserves paragraphs in HTML and plain text', () => {
    const html = plainTextToEmailHtml('Salut\nCristian\n\nMulțumesc');
    expect(html).toContain('<br>');
    expect(emailHtmlToPlainText(html)).toContain('Salut');
  });
  it('removes executable HTML', () => {
    expect(sanitizeEmailHtml('<p onclick="alert(1)">Salut</p><script>alert(1)</script>')).toBe('<p>Salut</p>');
  });
});
