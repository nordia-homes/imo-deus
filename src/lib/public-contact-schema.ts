import { z } from 'zod';
export const publicContactSchema = z.object({
  agencyId: z.string().min(1).max(128).regex(/^[^/]+$/),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(30).regex(/^[+\d\s().-]+$/),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  city: z.string().trim().min(2).max(120),
  message: z.string().trim().max(4000), consent: z.literal(true),
  website: z.string().max(200), formStartedAt: z.number().finite(),
});
