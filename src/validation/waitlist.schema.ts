import { z } from 'zod';

export const CreateWaitlistSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional().default(''),
  company: z.string().trim().max(160).optional().default(''),
  role: z.string().trim().max(120).optional().default(''),
  size: z.string().trim().max(80).optional().default(''),
});

export type CreateWaitlistSignupInput = z.infer<typeof CreateWaitlistSignupSchema>;
