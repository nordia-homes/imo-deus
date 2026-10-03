import { z } from 'zod';

const label = z.string().trim().min(1, 'Completează textul butonului.').max(25, 'Textul butonului poate avea maximum 25 de caractere.').refine(v => !/[{}\r\n]/.test(v), 'Textul butonului nu poate conține variabile sau rânduri noi.');
const url = z.string().trim().max(2000).url('Introdu un URL complet.').refine(v => {
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && !/[{}\s]/.test(v) && !/%7b|%7d/i.test(v); } catch { return false; }
}, 'Folosește un link HTTPS fix, fără variabile sau credențiale.');
export const templateButtonSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('QUICK_REPLY'), text: label }),
  z.object({ type: z.literal('URL'), text: label, url }),
  z.object({ type: z.literal('PHONE_NUMBER'), text: label, phone_number: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Introdu numărul internațional, de exemplu +40712345678.') }),
]);
export const templateButtonsSchema = z.array(templateButtonSchema).max(3, 'Editorul acceptă maximum 3 răspunsuri rapide.').superRefine((buttons, ctx) => {
  const replies = buttons.filter(b => b.type === 'QUICK_REPLY').length;
  if (replies && replies !== buttons.length) ctx.addIssue({ code: 'custom', message: 'Alege fie răspunsuri rapide, fie butoane de link și apel.' });
  for (const type of ['URL', 'PHONE_NUMBER']) if (buttons.filter(b => b.type === type).length > 1) ctx.addIssue({ code: 'custom', message: 'Editorul acceptă un buton de link și un buton de apel.' });
  const names = buttons.map(b => b.text.toLocaleLowerCase());
  if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', message: 'Folosește etichete diferite pentru butoane.' });
});
export type TemplateButton = z.infer<typeof templateButtonSchema>;
